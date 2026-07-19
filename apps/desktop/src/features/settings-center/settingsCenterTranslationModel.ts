import type {
  AiModelTranslationSource,
  AiProviderProfile,
  ApiTranslationSource,
  AppSettings,
  BaiduTranslateSource,
  GoogleTranslateSource,
  LibreTranslateSource,
  MicrosoftTranslatorSource,
  TranslationLanguage,
  TranslationSource,
} from '../../types';
import { normalizeAiProviderProfilesForUi } from './settingsCenterAiProviderModel';

export const defaultAiTranslationSource: AiModelTranslationSource = {
  id: 'translation-ai-default',
  name: 'AI Translation',
  kind: 'ai-model',
  enabled: true,
  providerId: 'openai-default',
  model: 'gpt-4.1-mini',
};

export const defaultLibreTranslationSource: LibreTranslateSource = {
  id: 'translation-libre-default',
  name: 'LibreTranslate',
  kind: 'libretranslate',
  enabled: false,
  apiBaseUrl: '',
  apiKey: '',
  requestTimeoutSecs: 30,
};

export const translationSourceKinds: TranslationSource['kind'][] = [
  'ai-model',
  'baidu-translate',
  'google-translate',
  'microsoft-translator',
  'libretranslate',
];

export const translationLanguageValues: TranslationLanguage[] = [
  'auto',
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'ru',
];

export type TranslationTargetLanguage = Exclude<TranslationLanguage, 'auto'>;

export type TranslationSourcePickerOption = {
  id: string;
  label: string;
  kind: TranslationSource['kind'];
  groupId: string;
  groupLabel: string;
  available: boolean;
};

export function normalizeTranslationSettings(settings: AppSettings): AppSettings {
  const profiles = normalizeAiProviderProfilesForUi(settings);
  const sources = normalizeTranslationSources(settings.translationSources, profiles, settings.aiActiveProviderProfileId);
  const activeId = sources.some((source) => source.id === settings.translationActiveSourceId)
    ? settings.translationActiveSourceId
    : sources.find((source) => source.enabled !== false)?.id ?? sources[0]?.id ?? '';
  return {
    ...settings,
    aiProviderProfiles: profiles,
    translationSources: sources,
    translationActiveSourceId: activeId,
    translationSourceLanguage: normalizeTranslationLanguage(settings.translationSourceLanguage, true, 'auto'),
    translationTargetLanguage: normalizeTranslationLanguage(settings.translationTargetLanguage, false, 'zh-CN'),
  };
}

export function normalizeTranslationSources(
  sources: TranslationSource[] | undefined,
  profiles: AiProviderProfile[] = [],
  preferredProfileId = '',
): TranslationSource[] {
  const input = sources === undefined
    ? [{ ...defaultAiTranslationSource }, { ...defaultLibreTranslationSource }]
    : sources;
  const ids = new Set<string>();
  return input.map((source, index) => {
    const normalized = normalizeTranslationSource(source, index, profiles, preferredProfileId);
    let id = normalized.id;
    let suffix = 2;
    while (ids.has(id)) id = `${normalized.id}-${suffix++}`;
    ids.add(id);
    return id === normalized.id ? normalized : { ...normalized, id };
  });
}

export function getAvailableTranslationSources(settings: AppSettings) {
  const normalized = normalizeTranslationSettings(settings);
  return (normalized.translationSources ?? []).filter((source) => isTranslationSourceAvailable(source, normalized.aiProviderProfiles ?? []));
}

export function getSelectableTranslationSources(settings: AppSettings) {
  const normalized = normalizeTranslationSettings(settings);
  return (normalized.translationSources ?? []).filter((source) => source.enabled !== false);
}

export function buildTranslationSourcePickerOptions(settings: AppSettings): TranslationSourcePickerOption[] {
  const normalized = normalizeTranslationSettings(settings);
  const profiles = normalized.aiProviderProfiles ?? [];
  return (normalized.translationSources ?? [])
    .filter((source) => source.enabled !== false)
    .map((source) => ({
      id: source.id,
      label: getTranslationSourceLabel(source, profiles),
      kind: source.kind,
      groupId: getTranslationSourceGroupId(source),
      groupLabel: getTranslationSourceGroupLabel(source, profiles),
      available: isTranslationSourceAvailable(source, profiles),
    }));
}

export function isTranslationSourceAvailable(source: TranslationSource, profiles: AiProviderProfile[]) {
  if (source.enabled === false) return false;
  if (source.kind === 'ai-model') {
    const profile = profiles.find((candidate) => candidate.id === source.providerId);
    return Boolean(profile && profile.enabled !== false && profile.apiBaseUrl.trim() && (source.model.trim() || profile.model.trim()));
  }
  if (!source.apiBaseUrl.trim()) return false;
  if (source.kind === 'baidu-translate') return Boolean(source.appId.trim());
  return true;
}

export function getTranslationSourceLabel(source: TranslationSource, profiles: AiProviderProfile[]) {
  if (source.kind !== 'ai-model') return source.name.trim() || getTranslationSourceProtocolLabel(source.kind);
  const profile = profiles.find((candidate) => candidate.id === source.providerId);
  const model = source.model.trim() || profile?.model.trim() || '';
  return [source.name.trim() || profile?.name.trim() || 'AI', model].filter(Boolean).join(' · ');
}

export function getTranslationSourceProtocolLabel(kind: TranslationSource['kind']) {
  switch (kind) {
    case 'ai-model': return 'AI Models';
    case 'baidu-translate': return 'Baidu Translate';
    case 'google-translate': return 'Google Translate';
    case 'microsoft-translator': return 'Microsoft Translator';
    case 'libretranslate': return 'LibreTranslate';
  }
}

export function getTranslationSourceGroupId(source: TranslationSource) {
  return source.kind === 'ai-model' ? `ai:${source.providerId}` : `api:${source.kind}`;
}

export function getTranslationSourceGroupLabel(source: TranslationSource, profiles: AiProviderProfile[]) {
  if (source.kind !== 'ai-model') return getTranslationSourceProtocolLabel(source.kind);
  return profiles.find((profile) => profile.id === source.providerId)?.name.trim() || 'AI Models';
}

export function createTranslationSource(
  kind: TranslationSource['kind'],
  profiles: AiProviderProfile[],
  id = createTranslationSourceId(kind),
): TranslationSource {
  const profile = profiles.find((candidate) => candidate.enabled !== false) ?? profiles[0];
  switch (kind) {
    case 'ai-model':
      return { ...defaultAiTranslationSource, id, name: profile ? `${profile.name} Translation` : 'AI Translation', enabled: true, providerId: profile?.id ?? '', model: profile?.model ?? '' };
    case 'baidu-translate':
      return { id, name: 'Baidu Translate', kind, enabled: true, apiBaseUrl: 'https://fanyi-api.baidu.com/api/trans/vip/translate', appId: '', apiKey: '', requestTimeoutSecs: 30 } satisfies BaiduTranslateSource;
    case 'google-translate':
      return { id, name: 'Google Translate', kind, enabled: true, apiBaseUrl: 'https://translation.googleapis.com/language/translate/v2', apiKey: '', requestTimeoutSecs: 30 } satisfies GoogleTranslateSource;
    case 'microsoft-translator':
      return { id, name: 'Microsoft Translator', kind, enabled: true, apiBaseUrl: 'https://api.cognitive.microsofttranslator.com', apiKey: '', region: '', requestTimeoutSecs: 30 } satisfies MicrosoftTranslatorSource;
    case 'libretranslate':
      return { ...defaultLibreTranslationSource, id, enabled: true };
  }
}

export function copyTranslationSource(source: TranslationSource, id = createTranslationSourceId(source.kind)): TranslationSource {
  return { ...source, id, name: `${source.name} Copy`, apiKey: '' } as TranslationSource;
}

export function updateTranslationSource(
  settings: AppSettings,
  sourceId: string,
  patch: Partial<TranslationSource>,
): AppSettings {
  const normalized = normalizeTranslationSettings(settings);
  return {
    ...normalized,
    translationSources: normalized.translationSources?.map((source) => source.id === sourceId
      ? normalizeTranslationSource({ ...source, ...patch } as TranslationSource, 0, normalized.aiProviderProfiles ?? [], normalized.aiActiveProviderProfileId ?? '')
      : source),
  };
}

export function removeTranslationSource(settings: AppSettings, sourceId: string): AppSettings {
  const normalized = normalizeTranslationSettings(settings);
  const translationSources = (normalized.translationSources ?? []).filter((source) => source.id !== sourceId);
  return {
    ...normalized,
    translationSources,
    translationActiveSourceId: normalized.translationActiveSourceId === sourceId
      ? translationSources.find((source) => source.enabled !== false)?.id ?? translationSources[0]?.id ?? ''
      : normalized.translationActiveSourceId,
  };
}

export function normalizeTranslationLanguage<T extends boolean>(
  value: unknown,
  allowAuto: T,
  fallback: T extends true ? TranslationLanguage : TranslationTargetLanguage,
): T extends true ? TranslationLanguage : TranslationTargetLanguage {
  const normalized = String(value ?? '').trim() as TranslationLanguage;
  if (translationLanguageValues.includes(normalized) && (allowAuto || normalized !== 'auto')) return normalized as never;
  return fallback;
}

function normalizeTranslationSource(source: TranslationSource, index: number, profiles: AiProviderProfile[], preferredProfileId: string): TranslationSource {
  const id = source.id.trim() || `translation-source-${index + 1}`;
  if (source.kind === 'ai-model') {
    const requestedProfile = profiles.find((candidate) => candidate.id === source.providerId);
    const preferredProfile = resolvePreferredAiTranslationProfile(profiles, preferredProfileId);
    const migrateLegacyDefault = source.id === defaultAiTranslationSource.id && !requestedProfile && Boolean(preferredProfile);
    const profile = !requestedProfile || migrateLegacyDefault ? preferredProfile : requestedProfile;
    const providerChanged = Boolean(profile && profile.id !== source.providerId);
    return {
      ...source,
      id,
      name: source.name.trim() || `AI Translation ${index + 1}`,
      enabled: source.enabled !== false,
      providerId: profile?.id || source.providerId.trim(),
      model: providerChanged ? profile?.model || '' : source.model.trim() || profile?.model || '',
    };
  }
  return normalizeApiTranslationSource(source, id, index);
}

function normalizeApiTranslationSource(source: ApiTranslationSource, id: string, index: number): ApiTranslationSource {
  const apiBaseUrl = source.apiBaseUrl.trim().replace(/\/+$/, '');
  const apiKey = source.apiKey?.trim() ?? '';
  const requestTimeoutSecs = clampNumber(source.requestTimeoutSecs, 30, 5, 600);
  switch (source.kind) {
    case 'baidu-translate': return { ...source, id, enabled: source.enabled !== false, apiBaseUrl, apiKey, requestTimeoutSecs, name: source.name.trim() || `Baidu Translate ${index + 1}`, appId: source.appId.trim() };
    case 'google-translate': return { ...source, id, enabled: source.enabled !== false, apiBaseUrl, apiKey, requestTimeoutSecs, name: source.name.trim() || `Google Translate ${index + 1}` };
    case 'microsoft-translator': return { ...source, id, enabled: source.enabled !== false, apiBaseUrl, apiKey, requestTimeoutSecs, name: source.name.trim() || `Microsoft Translator ${index + 1}`, region: source.region.trim() };
    case 'libretranslate': return { ...source, id, enabled: source.enabled !== false, apiBaseUrl, apiKey, requestTimeoutSecs, name: source.name.trim() || `LibreTranslate ${index + 1}` };
  }
}

function resolvePreferredAiTranslationProfile(profiles: AiProviderProfile[], preferredProfileId: string) {
  return profiles.find((profile) => profile.id === preferredProfileId)
    ?? profiles.find((profile) => profile.enabled !== false)
    ?? profiles[0];
}

function createTranslationSourceId(kind: TranslationSource['kind']) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `translation-${kind}-${random}`;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

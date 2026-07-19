import type { ReaderPreset, ReaderSettings } from '../../types';
import type { Translator } from '../../i18n';
import { emitSettingsCenterSaveFailed, formatSettingsSaveError, loadSettingsV2Snapshot, updateSettingsV2Branch } from '../../services/settingsCenterService';
import {
  emitReaderApplySettingsNow,
  emitReaderGlobalSettingsUpdated,
  readerApplySettingsNowEvent,
  readerGlobalSettingsUpdatedEvent,
  subscribeReaderApplySettingsNow,
  type ReaderApplySettingsNowDetail,
  type ReaderGlobalSettingsUpdatedDetail,
} from './readerDomainEvents';

export const READER_GLOBAL_SETTINGS_KEY = 'bookmind:reader-global-settings';
export const READER_CUSTOM_PRESETS_KEY = 'bookmind:reader-custom-presets';
export { readerApplySettingsNowEvent, readerGlobalSettingsUpdatedEvent } from './readerDomainEvents';
export const readerMinimumFontSizes = {
  fontSize: 16,
  titleFontSize: 20,
  headerFooterFontSize: 12,
} as const;

export type ReaderCustomPreset = {
  id: string;
  name: string;
  createdAt: string;
  settings: ReaderSettings;
};

export { emitReaderApplySettingsNow, subscribeReaderApplySettingsNow, type ReaderApplySettingsNowDetail } from './readerDomainEvents';

type ReaderCustomPresetExport = {
  schema: 'bookmind.readerCustomPresets.v1';
  exportedAt: string;
  presets: ReaderCustomPreset[];
};

let readerSettingsLocalWriteAt = 0;

export const defaultReaderSettings: ReaderSettings = {
  theme: 'paper',
  preset: 'custom',
  layoutMode: 'page',
  pageMode: 'double',
  pageVerticalAlign: 'top',
  chapterStartsNewPage: false,
  longParagraphStrategy: 'strict',
  fontSize: 16,
  letterSpacing: 0,
  lineHeight: 1.2,
  paragraphSpacing: 9,
  paperTextureStrength: 0.18,
  eyeComfortBackgroundStrength: 1,
  paperBackgroundStrength: 1,
  customBackgroundColor: '',
  customTextColor: '',
  customSelectionColor: '',
  fontFamily: 'Georgia, "LXGW WenKai", "Source Han Serif SC", serif',
  customFontFamily: '',
  fontFallbacks: ['LXGW WenKai', 'Source Han Serif SC', 'serif'],
  cjkPunctuationHanging: 'off',
  mixedTextSpacing: 'off',
  fontWeightBoost: 'off',
  firstLineIndent: 2,
  pageWidth: 1160,
  pageGap: 28,
  bodyMarginX: 24,
  bodyMarginY: 24,
  narrowBodyMarginX: 28,
  narrowBodyMarginY: 32,
  headerMarginX: 0,
  headerMarginY: 0,
  footerMarginX: 0,
  footerMarginY: 0,
  titleAlign: 'center',
  titleOnlyOnChapterStart: true,
  titleNumberCleanup: 'keep',
  titleDecoration: 'off',
  titleFontSize: 34,
  titleMarginTop: 0,
  titleMarginBottom: 22,
  headerVisible: true,
  headerLeft: 'time',
  headerCenter: 'chapter',
  headerRight: 'title',
  footerVisible: true,
  footerLeft: 'progress',
  footerCenter: 'none',
  footerRight: 'page',
  headerFooterCustomFormat: '{title} · {chapter} · {progress} · {page}',
  headerFooterTimeFormat: 'short-24h',
  headerFooterProgressFormat: 'percent',
  headerFooterFontSize: 15,
  headerFooterOpacity: 1,
  pageAnimation: 'turn',
  wheelPaging: true,
  touchpadNaturalScroll: true,
  preserveBlankLines: false,
  privacyMode: false,
  encryptSensitiveReaderData: true,
};

export const readerPresetSettings: Record<Exclude<ReaderPreset, 'custom'>, Partial<ReaderSettings>> = {
  novel: { preset: 'novel', theme: 'paper', fontSize: 20, lineHeight: 1.95, paragraphSpacing: 24, firstLineIndent: 2, pageWidth: 1080 },
  paper: { preset: 'paper', theme: 'white', fontSize: 18, lineHeight: 1.75, paragraphSpacing: 18, firstLineIndent: 0, pageWidth: 920 },
  eyeComfort: { preset: 'eyeComfort', theme: 'eyeComfort', fontSize: 20, lineHeight: 2.05, paragraphSpacing: 26, firstLineIndent: 2, bodyMarginX: 76, bodyMarginY: 62 },
  compact: { preset: 'compact', theme: 'white', fontSize: 17, lineHeight: 1.55, paragraphSpacing: 12, firstLineIndent: 1.5, pageWidth: 840, bodyMarginX: 46, bodyMarginY: 40 },
  spacious: { preset: 'spacious', theme: 'paper', fontSize: 21, lineHeight: 2.15, paragraphSpacing: 30, firstLineIndent: 2, pageWidth: 1180, bodyMarginX: 86, bodyMarginY: 70 },
  eInk: { preset: 'eInk', theme: 'white', fontSize: 19, lineHeight: 1.85, paragraphSpacing: 20, firstLineIndent: 2, pageAnimation: 'none' },
};

export function getReaderFontOptions(t: Translator) {
  return [
    { value: 'Georgia, "LXGW WenKai", "Source Han Serif SC", serif', label: t('reader.font.literarySerif') },
    { value: '"Microsoft YaHei", "HarmonyOS Sans SC", sans-serif', label: t('reader.font.clearSans') },
    { value: '"LXGW WenKai", "Source Han Serif SC", serif', label: t('reader.font.warmKai') },
  ];
}

export function normalizeReaderSettings(settings?: Partial<ReaderSettings> | null): ReaderSettings {
  return {
    ...defaultReaderSettings,
    ...(settings ?? {}),
    fontSize: clampReaderNumber(settings?.fontSize, defaultReaderSettings.fontSize, readerMinimumFontSizes.fontSize, 42),
    titleFontSize: clampReaderNumber(settings?.titleFontSize, defaultReaderSettings.titleFontSize, readerMinimumFontSizes.titleFontSize, 56),
    headerFooterFontSize: clampReaderNumber(settings?.headerFooterFontSize, defaultReaderSettings.headerFooterFontSize, readerMinimumFontSizes.headerFooterFontSize, 18),
    customBackgroundColor: normalizeOptionalHexColor(settings?.customBackgroundColor),
    customTextColor: normalizeOptionalHexColor(settings?.customTextColor),
    customSelectionColor: normalizeOptionalHexColor(settings?.customSelectionColor),
  };
}

function clampReaderNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeOptionalHexColor(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const [, r, g, b] = normalized.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '';
}

export function loadGlobalReaderSettings(): ReaderSettings {
  try {
    const raw = window.localStorage.getItem(READER_GLOBAL_SETTINGS_KEY);
    if (!raw) return defaultReaderSettings;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return normalizeReaderSettings(parsed);
  } catch (error) {
    console.warn('Failed to load global Reader settings:', error);
    return defaultReaderSettings;
  }
}

export function saveGlobalReaderSettings(settings: ReaderSettings, options?: { changedKeys?: (keyof ReaderSettings)[]; reason?: ReaderGlobalSettingsUpdatedDetail['reason'] }): ReaderSettings {
  const normalized = normalizeReaderSettings(settings);
  saveReaderSettingsFallback(normalized);
  void saveReaderSettingsToSettingsV2(normalized);
  dispatchGlobalReaderSettingsUpdated(normalized, 'localStorage', options?.changedKeys, options?.reason ?? 'user-action');
  return normalized;
}

export async function hydrateReaderSettingsV2FromBackend(): Promise<ReaderSettings> {
  const hydrateStartedAt = Date.now();
  try {
    const snapshot = await loadSettingsV2Snapshot();
    const readerSettingsFromV2 = normalizeReaderSettings(Object.keys(snapshot.reader ?? {}).length ? snapshot.reader as Partial<ReaderSettings> : null);
    if (Object.keys(snapshot.reader ?? {}).length) {
      if (readerSettingsLocalWriteAt > hydrateStartedAt) return loadGlobalReaderSettings();
      saveReaderSettingsFallback(readerSettingsFromV2);
      dispatchGlobalReaderSettingsUpdated(readerSettingsFromV2, 'settings_v2', undefined, 'hydrate');
      return readerSettingsFromV2;
    }
    const fallback = loadGlobalReaderSettings();
    if (window.localStorage.getItem(READER_GLOBAL_SETTINGS_KEY)) {
      void saveReaderSettingsToSettingsV2(fallback, false);
    }
    return fallback;
  } catch {
    return loadGlobalReaderSettings();
  }
}

export async function saveReaderSettingsToSettingsV2(settings: ReaderSettings, reportFailure = true): Promise<ReaderSettings> {
  const normalized = normalizeReaderSettings(settings);
  try {
    await updateSettingsV2Branch({ reader: normalized });
  } catch (error) {
    if (reportFailure) {
      emitSettingsCenterSaveFailed({
        target: 'settings_v2',
        message: formatSettingsSaveError(error),
      });
    }
  }
  return normalized;
}

function saveReaderSettingsFallback(settings: ReaderSettings) {
  readerSettingsLocalWriteAt = Date.now();
  window.localStorage.setItem(READER_GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
}

function dispatchGlobalReaderSettingsUpdated(settings: ReaderSettings, source: ReaderGlobalSettingsUpdatedDetail['source'], changedKeys?: (keyof ReaderSettings)[], reason: ReaderGlobalSettingsUpdatedDetail['reason'] = 'user-action') {
  emitReaderGlobalSettingsUpdated({ settings, source, changedKeys, reason });
}

export function loadReaderCustomPresets(): ReaderCustomPreset[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READER_CUSTOM_PRESETS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReaderCustomPreset).slice(0, 24);
  } catch {
    return [];
  }
}

export function saveReaderCustomPreset(name: string, settings: ReaderSettings): ReaderCustomPreset[] {
  const preset: ReaderCustomPreset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `自定义预设 ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    settings: normalizeReaderSettings({ ...settings, preset: 'custom' }),
  };
  const presets = [preset, ...loadReaderCustomPresets()].slice(0, 24);
  window.localStorage.setItem(READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export function renameReaderCustomPreset(id: string, name: string): ReaderCustomPreset[] {
  const nextName = name.trim();
  const presets = loadReaderCustomPresets().map((preset) => preset.id === id && nextName ? { ...preset, name: nextName } : preset);
  window.localStorage.setItem(READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export function deleteReaderCustomPreset(id: string): ReaderCustomPreset[] {
  const presets = loadReaderCustomPresets().filter((preset) => preset.id !== id);
  window.localStorage.setItem(READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export function exportReaderCustomPresets(): string {
  const payload: ReaderCustomPresetExport = {
    schema: 'bookmind.readerCustomPresets.v1',
    exportedAt: new Date().toISOString(),
    presets: loadReaderCustomPresets(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importReaderCustomPresets(raw: string): ReaderCustomPreset[] {
  const parsed = JSON.parse(raw) as unknown;
  const imported: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as Partial<ReaderCustomPresetExport>).presets)
      ? (parsed as Partial<ReaderCustomPresetExport>).presets ?? []
      : [];
  const normalized = imported.filter(isReaderCustomPreset).map((preset) => ({
    ...preset,
    id: preset.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    settings: normalizeReaderSettings(preset.settings),
  }));
  const existing = loadReaderCustomPresets();
  const byId = new Map<string, ReaderCustomPreset>();
  [...normalized, ...existing].forEach((preset) => byId.set(preset.id, preset));
  const presets = [...byId.values()].slice(0, 24);
  window.localStorage.setItem(READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

function isReaderCustomPreset(value: unknown): value is ReaderCustomPreset {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Partial<ReaderCustomPreset>;
  return typeof draft.id === 'string'
    && typeof draft.name === 'string'
    && typeof draft.createdAt === 'string'
    && typeof draft.settings === 'object'
    && draft.settings !== null;
}

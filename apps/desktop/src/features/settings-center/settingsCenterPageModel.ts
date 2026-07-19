import type { AppSettings } from '../../types';
import { defaultAiProviderProfile } from './settingsCenterAiProviderModel';
import { defaultAiTranslationSource, defaultLibreTranslationSource } from './settingsCenterTranslationModel';
import { buildAllReaderCacheLocalStoragePrefixes, buildCurrentBookAllDataLocalStoragePlan, buildReaderCacheLocalStoragePlanForBook } from './settingsCenterReaderCleanupModel';

type RemoveLocalStorageKeys = (keys: string[]) => number;
type RemoveLocalStorageByPrefix = (prefix: string) => number;

export function defaultAppSettings(): AppSettings {
  return {
    schemaVersion: 1,
    trashRetentionDays: 3,
    trashAutoCleanupEnabled: true,
    trashProtectReadingProgress: true,
    trashProtectReaderAssets: true,
    aiApiKey: '',
    aiApiBaseUrl: 'https://api.openai.com/v1',
    aiEndpointMode: 'responses',
    aiModel: 'gpt-4.1-mini',
    aiRequestTimeoutSecs: 120,
    aiRetryCount: 1,
    aiProxyUrl: '',
    aiCustomHeaders: '',
    aiStreamingEnabled: true,
    aiTemperature: 0.2,
    aiMaxTokens: 0,
    aiTopP: 1,
    aiReasoningEffort: 'none',
    aiResponseFormat: 'auto',
    aiActiveProviderProfileId: 'openai-default',
    aiProviderProfiles: [
      defaultAiProviderProfile,
    ],
    translationActiveSourceId: defaultAiTranslationSource.id,
    translationSources: [{ ...defaultAiTranslationSource }, { ...defaultLibreTranslationSource }],
    translationSourceLanguage: 'auto',
    translationTargetLanguage: 'zh-CN',
    aiCancelStrategy: 'abort-and-save-stopped',
    operationLogLevel: 'none',
  };
}

export function sanitizeTauriCommandFailureInfo(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeTauriCommandFailureInfo);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, sanitizeTauriCommandFailureInfo(entryValue)]));
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]+|token[-_:= ][A-Za-z0-9._-]+/gi, '[redacted-secret]')
    .replace(/([a-zA-Z]:[\\/][^"'<>|,，。；;\n\r]+|\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[^"'<>|,，。；;\n\r]+)/g, '[redacted-path]');
}

export function clearReaderCacheLocalStorageForBook(
  bookId: string,
  removeKeys: RemoveLocalStorageKeys = removeSettingsLocalStorageKeys,
  removeByPrefix: RemoveLocalStorageByPrefix = removeSettingsLocalStorageByPrefix,
) {
  const plan = buildReaderCacheLocalStoragePlanForBook(bookId);
  return removeKeys(plan.keys) + plan.prefixes.reduce((sum, prefix) => sum + removeByPrefix(prefix), 0);
}

export function clearAllReaderCacheLocalStorage(removeByPrefix: RemoveLocalStorageByPrefix = removeSettingsLocalStorageByPrefix) {
  return buildAllReaderCacheLocalStoragePrefixes()
    .reduce((sum, prefix) => sum + removeByPrefix(prefix), 0);
}

export function clearCurrentBookAllDataLocalStorage(
  bookId: string,
  removeKeys: RemoveLocalStorageKeys = removeSettingsLocalStorageKeys,
  removeByPrefix: RemoveLocalStorageByPrefix = removeSettingsLocalStorageByPrefix,
) {
  const plan = buildCurrentBookAllDataLocalStoragePlan(bookId);
  return removeKeys(plan.keys)
    + plan.prefixes.reduce((sum, prefix) => sum + removeByPrefix(prefix), 0);
}

export function formatSettingsChangeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function downloadSettingsText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function removeSettingsLocalStorageKeys(keys: string[]) {
  if (typeof localStorage === 'undefined') return 0;
  let removed = 0;
  keys.forEach((key) => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removed += 1;
    }
  });
  return removed;
}

function removeSettingsLocalStorageByPrefix(prefix: string) {
  if (typeof localStorage === 'undefined') return 0;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  return keys.length;
}

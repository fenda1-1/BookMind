import type { Translator, TranslationKey } from '../../i18n';

export type LocalEncryptionStatusLike = {
  keyStatus?: string;
  fallbackProtection?: string;
};

export type DataDirectoryStatusLike = {
  mode?: string;
};

export type AiApiKeyStorageStatusLike = {
  keyStatus?: string;
  primaryStore?: string;
};

export function formatSettingsByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatSettingsPageError(error: unknown) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function formatLocalEncryptionKeyStatus(status: LocalEncryptionStatusLike | null, loading: boolean, error: string, t?: Translator) {
  if (loading) return translateStatus(t, 'settings.statusFormat.loading', 'Loading');
  if (error) return translateStatus(t, 'settings.statusFormat.error', 'Error');
  if (!status) return translateStatus(t, 'settings.statusFormat.notLoaded', 'Not loaded');
  if (status.keyStatus === 'available') return translateStatus(t, 'settings.statusFormat.available', 'Available');
  if (status.keyStatus === 'locked') return translateStatus(t, 'settings.statusFormat.masterPasswordRequired', 'Master password required');
  if (status.keyStatus === 'missing') return translateStatus(t, 'settings.statusFormat.notCreated', 'Not created');
  if (status.keyStatus === 'error') return translateStatus(t, 'settings.statusFormat.error', 'Error');
  return status.keyStatus || translateStatus(t, 'settings.statusFormat.unknown', 'Unknown');
}

export function formatLocalEncryptionFallbackProtection(status: LocalEncryptionStatusLike | null, t?: Translator) {
  if (!status) return translateStatus(t, 'settings.statusFormat.waitingLoad', 'Waiting for load');
  if (status.fallbackProtection === 'masterPassword') return translateStatus(t, 'settings.statusFormat.masterPasswordProtected', 'Master password protected');
  if (status.fallbackProtection === 'plaintextFile') return translateStatus(t, 'settings.statusFormat.plaintextFallbackFile', 'Plaintext fallback file');
  if (status.fallbackProtection === 'keyringOnly') return translateStatus(t, 'settings.statusFormat.keyringOnly', 'Keyring only');
  if (status.fallbackProtection === 'none') return translateStatus(t, 'settings.statusFormat.notCreated', 'Not created');
  return status.fallbackProtection || translateStatus(t, 'settings.statusFormat.unknown', 'Unknown');
}

export function shortKeyId(keyId?: string) {
  if (!keyId) return 'none';
  if (keyId.length <= 14) return keyId;
  return `${keyId.slice(0, 8)}…${keyId.slice(-4)}`;
}

export function formatDataDirectoryMode(status: DataDirectoryStatusLike | null, t?: Translator) {
  if (!status) return translateStatus(t, 'settings.statusFormat.waitingLoad', 'Waiting for load');
  if (status.mode === 'portable') return translateStatus(t, 'settings.statusFormat.portableMode', 'Portable mode');
  if (status.mode === 'custom') return translateStatus(t, 'settings.statusFormat.customDirectory', 'Custom directory');
  return translateStatus(t, 'settings.statusFormat.defaultDirectory', 'Default directory');
}

export function formatAiApiKeyStorageStatus(status: AiApiKeyStorageStatusLike | null, loading: boolean, error: string, t?: Translator) {
  if (loading) return translateStatus(t, 'settings.statusFormat.loading', 'Loading');
  if (error) return translateStatus(t, 'settings.statusFormat.error', 'Error');
  if (!status) return translateStatus(t, 'settings.statusFormat.notLoaded', 'Not loaded');
  if (status.keyStatus === 'saved') return translateStatus(t, 'settings.statusFormat.saved', 'Saved');
  if (status.keyStatus === 'missing') return translateStatus(t, 'settings.statusFormat.notSaved', 'Not saved');
  if (status.keyStatus === 'error') return translateStatus(t, 'settings.statusFormat.error', 'Error');
  return status.keyStatus || translateStatus(t, 'settings.statusFormat.unknown', 'Unknown');
}

export function formatAiApiKeyPrimaryStore(primaryStore?: string, t?: Translator) {
  if (primaryStore === 'keyring') return 'keyring';
  if (primaryStore === 'fallbackFile') return translateStatus(t, 'settings.statusFormat.fallbackFile', 'fallback file');
  if (primaryStore === 'none') return translateStatus(t, 'settings.statusFormat.notSaved', 'Not saved');
  return primaryStore || translateStatus(t, 'settings.statusFormat.notLoaded', 'Not loaded');
}

function translateStatus(t: Translator | undefined, key: TranslationKey, fallback: string) {
  return t ? t(key) : fallback;
}

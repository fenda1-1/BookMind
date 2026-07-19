import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  AiApiKeyStorageStatus,
  DataDirectoryStatus,
  DataDirectoryMigrationProgress,
  ExtendedSettings,
  LocalDataKeyRotationResult,
  LocalEncryptionStatus,
} from './schema';

export async function loadLocalEncryptionStatus(): Promise<LocalEncryptionStatus> {
  return await invoke<LocalEncryptionStatus>('get_local_encryption_status');
}

export async function setLocalMasterPassword(password: string): Promise<LocalEncryptionStatus> {
  return await invoke<LocalEncryptionStatus>('set_local_master_password', { password });
}

export async function verifyLocalMasterPassword(password: string): Promise<LocalEncryptionStatus> {
  return await invoke<LocalEncryptionStatus>('verify_local_master_password', { password });
}

export async function rotateLocalDataKey(masterPassword?: string): Promise<LocalDataKeyRotationResult> {
  return await invoke<LocalDataKeyRotationResult>('rotate_local_data_key', { masterPassword: masterPassword || undefined });
}

export async function loadAiApiKeyStorageStatus(): Promise<AiApiKeyStorageStatus> {
  return await invoke<AiApiKeyStorageStatus>('get_ai_api_key_storage_status');
}

export async function loadDataDirectoryStatus(): Promise<DataDirectoryStatus> {
  return await invoke<DataDirectoryStatus>('get_data_directory_status');
}

export async function openDataDirectory(): Promise<string> {
  return await invoke<string>('open_data_directory');
}

export async function migrateDataDirectory(targetDir: string): Promise<DataDirectoryStatus> {
  // Keep the legacy command as the stable service contract; the progress-aware command is used by the settings UI.
  return await invoke<DataDirectoryStatus>('migrate_data_directory', { targetDir });
}

export async function migrateDataDirectoryWithProgress(targetDir: string): Promise<DataDirectoryStatus> {
  return await invoke<DataDirectoryStatus>('migrate_data_directory_with_progress', { targetDir });
}

export async function subscribeDataDirectoryMigrationProgress(
  handler: (progress: DataDirectoryMigrationProgress) => void,
) {
  return await listen<DataDirectoryMigrationProgress>('bookmind://data-directory-migration-progress', (event) => {
    handler(event.payload);
  });
}

export async function enablePortableDataDirectory(): Promise<DataDirectoryStatus> {
  return await invoke<DataDirectoryStatus>('enable_portable_data_directory');
}

export function isApplicationPrivacyEnabled(settings: ExtendedSettings) {
  return settings.applicationPrivacyMode;
}

export function shouldHideRecentReading(settings: ExtendedSettings) {
  return settings.applicationPrivacyMode || settings.hideRecentReadingInPrivacyMode || !settings.recordRecentReaderBooks;
}

export function shouldHideFilePaths(settings: ExtendedSettings) {
  return settings.applicationPrivacyMode || settings.hideFilePathsInPrivacyMode;
}

export function shouldHideBookTitles(settings: ExtendedSettings) {
  return settings.applicationPrivacyMode || settings.hideBookTitlesInPrivacyMode;
}

export function getPrivacyBookTitle(title: string, settings: ExtendedSettings) {
  return shouldHideBookTitles(settings) ? '私密书籍' : title;
}

export function getPrivacyFileName(fileName: string, settings: ExtendedSettings) {
  return shouldHideFilePaths(settings) ? '已隐藏文件名' : fileName;
}

export function getPrivacyFilePath(filePath: string, settings: ExtendedSettings) {
  return shouldHideFilePaths(settings) ? '已隐藏文件路径' : filePath;
}

export function getPrivacyExportFileBaseName(title: string, settings: ExtendedSettings) {
  const safeTitle = getPrivacyBookTitle(title || 'bookmind', settings);
  return sanitizeExportFileBaseName(safeTitle || 'bookmind');
}

export function redactPrivacyText(value: string, settingsOrEnabled: ExtendedSettings | boolean) {
  const enabled = typeof settingsOrEnabled === 'boolean' ? settingsOrEnabled : isApplicationPrivacyEnabled(settingsOrEnabled) || shouldHideBookTitles(settingsOrEnabled) || shouldHideFilePaths(settingsOrEnabled);
  if (!enabled) return value;
  return value
    .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*/g, '[path]')
    .replace(/(?:\/(?:Users|home|tmp|var|Volumes)\/[^\s,，。；;]+|\/[^\s,，。；;]+\/[^\s,，。；;]+(?:\/[^\s,，。；;]+)+)/g, '[path]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\+?\d[\d\s-]{8,}\d/g, '[number]')
    .replace(/[\u4e00-\u9fa5A-Za-z0-9《》“”"'-]{2,80}\s*[·-]\s*(?:第\s*\d+\s*(?:章|节|段|页)|Chapter\s+\d+|Part\s+\d+|Book\s+\d+|Volume\s+\d+)/gi, '私密书籍 · [location]');
}

export function sanitizePrivacyObject<T>(value: T, settingsOrEnabled: ExtendedSettings | boolean): T {
  const enabled = typeof settingsOrEnabled === 'boolean' ? settingsOrEnabled : isApplicationPrivacyEnabled(settingsOrEnabled) || shouldHideBookTitles(settingsOrEnabled) || shouldHideFilePaths(settingsOrEnabled);
  if (!enabled) return value;
  return sanitizePrivacyValue(value, enabled) as T;
}

function sanitizeExportFileBaseName(value: string) {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, ' ');
  return normalized || 'bookmind';
}

function sanitizePrivacyValue(value: unknown, enabled: boolean): unknown {
  if (!enabled) return value;
  if (typeof value === 'string') return redactPrivacyText(value, true);
  if (Array.isArray(value)) return value.map((item) => sanitizePrivacyValue(item, enabled));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (isSensitivePrivacyKey(key)) return [key, typeof item === 'string' ? redactPrivacyText(item, true) : '[redacted]'];
      return [key, sanitizePrivacyValue(item, enabled)];
    }));
  }
  return value;
}

function isSensitivePrivacyKey(key: string) {
  return /^(instruction|userText|prompt|query|queryUsed|retrievalQuery|scopeText|scopeLabel|bookRange|title|label|text|quote|snippet|sourceText|path|filePath|inputPath|cachePath)$/i.test(key);
}

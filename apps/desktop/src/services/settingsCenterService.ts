export type {
  AiApiKeyStorageStatus,
  AiCustomSlashCommandDraft,
  ChapterRegexRuleDraft,
  ChapterRuleDraft,
  CustomCleanupRuleDraft,
  DataDirectoryMigrationProgress,
  DataDirectoryStatus,
  ExtendedSettings,
  LocalDataKeyRotationResult,
  LocalEncryptionStatus,
  SettingsChangeHistoryEntry,
  SettingsUpdatedDetail,
  SettingsV2,
  TocTitleGroupRuleDraft,
} from './settingsCenter/schema';

export type { MoyuReaderProfile } from '../features/reader-core/moyuReaderSettingsModel';

export {
  aiCustomSlashCommandsStorageKey,
  aiCustomSlashCommandsUpdatedEvent,
  defaultChapterRules,
  defaultExtendedSettings,
  defaultHighlightColorMeanings,
  defaultHighlightColorShortcuts,
  extendedSettingsStorageKey,
  settingsCenterSaveFailedEvent,
  settingsCenterUpdatedEvent,
  settingsChangeHistoryStorageKey,
  settingsUpdatedEvent,
} from './settingsCenter/defaults';

export {
  defaultMoyuReaderProfile,
  normalizeMoyuReaderProfile,
  patchMoyuReaderProfile,
} from '../features/reader-core/moyuReaderSettingsModel';

export {
  loadAiCustomSlashCommands,
  normalizeChapterRegexRules,
  normalizeChapterRules,
  normalizeCustomCleanupRules,
  normalizeExtendedSettings,
  normalizeTocTitleGroupRules,
  saveAiCustomSlashCommands,
} from './settingsCenter/migrations';

export {
  dispatchSettingsUpdated,
  formatSettingsSaveError,
  hydrateSettingsV2FromBackend,
  installSettingsUpdatedBridge,
  loadChapterRules,
  loadExtendedSettings,
  loadSettingsChangeHistory,
  loadSettingsV2Snapshot,
  recordSettingsChangeHistory,
  removeLocalStorageByPrefix,
  removeLocalStorageKeys,
  saveChapterRules,
  saveExtendedSettings,
  undoLastSettingsChange,
  updateSettingsV2Branch,
} from './settingsCenter/persistence';

export {
  emitAiCustomSlashCommandsUpdated,
  emitSettingsCenterSaveFailed,
  emitSettingsUpdated,
  subscribeAiCustomSlashCommandsUpdated,
  subscribeSettingsCenterSaveFailed,
  subscribeSettingsUpdated,
  type SettingsCenterSaveFailureDetail,
} from './settingsCenter/events';

export {
  sanitizeSettingsSnapshotExtended,
} from './settingsCenter/importExport';

export {
  enablePortableDataDirectory,
  getPrivacyBookTitle,
  getPrivacyExportFileBaseName,
  getPrivacyFileName,
  getPrivacyFilePath,
  isApplicationPrivacyEnabled,
  loadAiApiKeyStorageStatus,
  loadDataDirectoryStatus,
  loadLocalEncryptionStatus,
  migrateDataDirectory,
  migrateDataDirectoryWithProgress,
  openDataDirectory,
  subscribeDataDirectoryMigrationProgress,
  redactPrivacyText,
  rotateLocalDataKey,
  sanitizePrivacyObject,
  setLocalMasterPassword,
  shouldHideBookTitles,
  shouldHideFilePaths,
  shouldHideRecentReading,
  verifyLocalMasterPassword,
} from './settingsCenter/service';

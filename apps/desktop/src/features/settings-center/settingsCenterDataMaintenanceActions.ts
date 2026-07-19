import { open } from '@tauri-apps/plugin-dialog';
import { isTauriRuntime } from '../../app/platform';
import type { CloudAiRequestHistoryEntry } from '../../services/cloudAiHistoryService';
import { createDataBackup, restoreDataBackup, type DataBackupResult } from '../../services/dataBackupService';
import { clearOperationLogs, loadOperationLogs } from '../../services/operationLogService';
import {
  cleanupOrphanReaderRecords,
  deleteAllReaderRecordsByKind,
  deleteReaderRecord,
  deleteReaderRecordsByBook,
  getReaderRecord,
  listReaderRecordsByKind,
  parseReaderRecord,
  saveReaderRecord,
  type ReaderRecordKind,
} from '../../services/readerStorageService';
import {
  enablePortableDataDirectory,
  loadDataDirectoryStatus,
  migrateDataDirectoryWithProgress,
  openDataDirectory,
  removeLocalStorageByPrefix,
  removeLocalStorageKeys,
  subscribeDataDirectoryMigrationProgress,
  type DataDirectoryMigrationProgress,
  type DataDirectoryStatus,
  type ExtendedSettings,
} from '../../services/settingsCenterService';
import { loadIndexDiagnostics, rebuildDatabaseIndexes, vacuumDatabase } from '../../services/taskService';
import type { Translator } from '../../i18n';
import { buildCloudAiHistoryDiagnosticsPayload } from './settingsCenterCloudAiHistoryDiagnosticsModel';
import {
  emitCloudAiConsentUpdated,
  emitReaderCacheCleared,
  emitReaderPageCacheCleared,
  emitReaderSearchDataCleared,
} from '../reader-core/readerDomainEvents';
import { publishCurrentBookDataCleared } from '../reader-core/currentBookDataEvents';
import { joinDisplayPath, normalizeDisplayPath } from './settingsCenterPathDisplayModel';
import { clearAllReaderCacheLocalStorage, clearCurrentBookAllDataLocalStorage, clearReaderCacheLocalStorageForBook, downloadSettingsText } from './settingsCenterPageModel';
import { readerPageCacheLocalStoragePrefix } from './settingsCenterReaderCleanupModel';
import { formatSettingsByteSize, formatSettingsPageError } from './settingsCenterStatusFormatModel';
import { requestAppConfirm } from '../../components/useAppConfirm';

export type DiagnosticPaths = {
  dataDir: string;
  settingsFile: string;
  ftsDatabase: string;
};

type Setter<T> = (value: T) => void;

type SettingsDataMaintenanceActionDeps = {
  currentBookId: string;
  currentBookTitle?: string;
  extendedSettings: ExtendedSettings;
  selectedDataBackupPath: string;
  operationLogRetentionDays: (value: string) => number;
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
  setSaveStatus: Setter<string>;
  t: Translator;
  dataDirectoryStatus: DataDirectoryStatus | null;
  setDataDirectoryStatus: Setter<DataDirectoryStatus | null>;
  setDataDirectoryBusy: Setter<boolean>;
  setDataDirectoryError: Setter<string>;
  setDataDirectoryMigrationProgress: Setter<DataDirectoryMigrationProgress | null>;
  setDiagnosticPaths: Setter<DiagnosticPaths>;
  setDataBackupBusy: Setter<boolean>;
  setLastDataBackupResult: Setter<DataBackupResult | null>;
  setSelectedDataBackupPath: Setter<string>;
  setOperationLogs: Setter<ReturnType<typeof loadOperationLogs>>;
  setLastTauriCommandFailure: Setter<{ at: string; source: string; message: string } | null>;
};

export const readerCacheRecordKinds: ReaderRecordKind[] = ['state', 'pageCache', 'readingStats'];
export const currentBookDataRecordKinds: ReaderRecordKind[] = ['state', 'highlights', 'bookmarks', 'highlightColor', 'tocEdits', 'tocManifest', 'pageCache', 'readingStats', 'chapterTimeline', 'cloudAiRequestHistory', 'cloudAiConsent', 'aiModePreference'];

export function createSettingsDataMaintenanceActions(deps: SettingsDataMaintenanceActionDeps) {
  const {
    currentBookId,
    currentBookTitle,
    extendedSettings,
    selectedDataBackupPath,
    operationLogRetentionDays,
    updateExtendedSetting,
    setSaveStatus,
    t,
    dataDirectoryStatus,
    setDataDirectoryStatus,
    setDataDirectoryBusy,
    setDataDirectoryError,
    setDataDirectoryMigrationProgress,
    setDiagnosticPaths,
    setDataBackupBusy,
    setLastDataBackupResult,
    setSelectedDataBackupPath,
    setOperationLogs,
    setLastTauriCommandFailure,
  } = deps;

  function recordTauriCommandFailure(source: string, error: unknown) {
    setLastTauriCommandFailure({
      at: new Date().toISOString(),
      source,
      message: formatSettingsPageError(error),
    });
  }

  async function getDataDirectoryStatusFromSettings() {
    if (!isTauriRuntime()) {
      setDataDirectoryStatus(null);
      setDataDirectoryError(t('settings.dataActions.browserPreviewUnavailable'));
      return null;
    }
    try {
      const status = await loadDataDirectoryStatus();
      setDataDirectoryStatus(status);
      setDataDirectoryError('');
      return status;
    } catch (error) {
      setDataDirectoryStatus(null);
      setDataDirectoryError(formatSettingsPageError(error));
      return null;
    }
  }

  async function useAppDataDirAsDefaultImportPath() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotReadAppDataDir'));
      return;
    }
    const status = await getDataDirectoryStatusFromSettings();
    const dataDir = normalizeDisplayPath(status?.dataDir ?? '');
    if (!dataDir) {
      setSaveStatus(t('settings.dataActions.currentDataDirUnavailable'));
      return;
    }
    updateExtendedSetting('defaultImportPath', dataDir);
  }

  async function openDataDirectoryFromSettings() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotOpenDataDir'));
      return;
    }
    try {
      const openedPath = await openDataDirectory();
      setSaveStatus(t('settings.dataActions.dataDirOpened', { path: normalizeDisplayPath(openedPath) }));
    } catch (error) {
      recordTauriCommandFailure('open_data_directory', error);
      setSaveStatus(t('settings.dataActions.dataDirOpenFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function chooseAndMigrateDataDirectoryFromSettings() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotMigrateDataDir'));
      return;
    }
    let selected: string | string[] | null;
    try {
      selected = await open({ directory: true, multiple: false, title: t('settings.dataActions.chooseNewDataDirTitle') });
    } catch (error) {
      recordTauriCommandFailure('choose_data_directory', error);
      setDataDirectoryError(formatSettingsPageError(error));
      return;
    }
    if (typeof selected !== 'string' || !selected.trim()) return;
    const confirmed = await requestAppConfirm(t('settings.dataActions.migrateDataDirConfirm'));
    if (!confirmed) return;
    const previousDataDir = dataDirectoryStatus?.dataDir ?? '';
    setDataDirectoryBusy(true);
    setDataDirectoryError('');
    setDataDirectoryMigrationProgress({
      phase: 'preparing',
      copiedFiles: 0,
      totalFiles: 0,
      copiedBytes: 0,
      totalBytes: 0,
      currentPath: selected,
    });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await subscribeDataDirectoryMigrationProgress(setDataDirectoryMigrationProgress);
      // migrateDataDirectory(selected) remains the legacy non-streaming service path.
      const status = await migrateDataDirectoryWithProgress(selected);
      rebaseBrowserStoragePaths(previousDataDir, status.dataDir);
      setDataDirectoryStatus(status);
      setDiagnosticPaths(await loadSettingsDiagnosticPaths());
      setSaveStatus(t('settings.dataActions.dataDirMigrated', { path: normalizeDisplayPath(status.dataDir) }));
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      recordTauriCommandFailure('migrate_data_directory', error);
      const message = formatSettingsPageError(error);
      setDataDirectoryError(message);
      setDataDirectoryMigrationProgress(null);
      setSaveStatus(t('settings.dataActions.dataDirMigrateFailed', { error: message }));
    } finally {
      unlisten?.();
      setDataDirectoryBusy(false);
    }
  }

  async function enablePortableDataDirectoryFromSettings() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotEnablePortable'));
      return;
    }
    const confirmed = await requestAppConfirm(t('settings.dataActions.enablePortableConfirm'));
    if (!confirmed) return;
    const previousDataDir = dataDirectoryStatus?.dataDir ?? '';
    setDataDirectoryBusy(true);
    setDataDirectoryError('');
    try {
      const status = await enablePortableDataDirectory();
      rebaseBrowserStoragePaths(previousDataDir, status.dataDir);
      setDataDirectoryStatus(status);
      setDiagnosticPaths(await loadSettingsDiagnosticPaths());
      setSaveStatus(t('settings.dataActions.portableEnabled', { path: normalizeDisplayPath(status.dataDir) }));
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      recordTauriCommandFailure('enable_portable_data_directory', error);
      const message = formatSettingsPageError(error);
      setDataDirectoryError(message);
      setSaveStatus(t('settings.dataActions.portableEnableFailed', { error: message }));
    } finally {
      setDataDirectoryBusy(false);
    }
  }

  async function createDataBackupFromSettings() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotCreateBackup'));
      return;
    }
    setDataBackupBusy(true);
    try {
      const result = await createDataBackup(extendedSettings.dataBackupMode);
      setLastDataBackupResult(result);
      setSelectedDataBackupPath(result.backupPath);
      setSaveStatus(t('settings.dataActions.backupCreated', { path: normalizeDisplayPath(result.backupPath), copied: result.copiedFiles, bytes: formatSettingsByteSize(result.copiedBytes), reused: result.reusedFiles }));
    } catch (error) {
      recordTauriCommandFailure('create_data_backup', error);
      setSaveStatus(t('settings.dataActions.backupCreateFailed', { error: formatSettingsPageError(error) }));
    } finally {
      setDataBackupBusy(false);
    }
  }

  async function chooseDataBackupDirectoryFromSettings() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotChooseBackup'));
      return;
    }
    try {
      const selected = await open({ directory: true, multiple: false, title: t('settings.dataActions.chooseBackupDirTitle') });
      if (typeof selected !== 'string') return;
      setSelectedDataBackupPath(selected);
      setSaveStatus(t('settings.dataActions.backupDirSelected', { path: normalizeDisplayPath(selected) }));
    } catch (error) {
      recordTauriCommandFailure('choose_data_backup_directory', error);
      setSaveStatus(t('settings.dataActions.backupDirChooseFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function restoreDataBackupFromSettings() {
    const backupPath = selectedDataBackupPath.trim();
    if (!backupPath) {
      setSaveStatus(t('settings.dataActions.chooseBackupFirst'));
      return;
    }
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotRestoreBackup'));
      return;
    }
    const confirmed = await requestAppConfirm(t('settings.dataActions.restoreBackupConfirm'));
    if (!confirmed) return;
    setDataBackupBusy(true);
    try {
      const result = await restoreDataBackup(backupPath);
      setLastDataBackupResult(result);
      setSaveStatus(t('settings.dataActions.backupRestored', { restoredFrom: normalizeDisplayPath(result.restoredFrom), backupPath: normalizeDisplayPath(result.backupPath) }));
    } catch (error) {
      recordTauriCommandFailure('restore_data_backup', error);
      setSaveStatus(t('settings.dataActions.backupRestoreFailed', { error: formatSettingsPageError(error) }));
    } finally {
      setDataBackupBusy(false);
    }
  }

  function clearOperationLogSettingsData() {
    clearOperationLogs();
    setOperationLogs([]);
    setSaveStatus(t('settings.dataActions.operationLogsCleared'));
  }

  function exportOperationLogsSettingsData(format: 'json' | 'ndjson') {
    const logs = loadOperationLogs(operationLogRetentionDays(extendedSettings.operationLogRetention));
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'ndjson') {
      downloadSettingsText(`bookmind-operation-logs-${date}.ndjson`, logs.map((item) => JSON.stringify(item)).join('\n'), 'application/x-ndjson;charset=utf-8');
      setSaveStatus(t('settings.dataActions.operationLogsNdjsonExported'));
      return;
    }
    downloadSettingsText(`bookmind-operation-logs-${date}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), logs }, null, 2), 'application/json;charset=utf-8');
    setSaveStatus(t('settings.dataActions.operationLogsJsonExported'));
  }

  function clearReaderPageCacheSettingsData() {
    void clearAllReaderPageCacheSettingsData();
  }

  async function clearCurrentBookReaderCacheSettingsData() {
    const removedLocal = currentBookId ? clearReaderCacheLocalStorageForBook(currentBookId) : 0;
    let removedSqlite = 0;
    if (currentBookId && isTauriRuntime()) {
      const removals = await Promise.all(readerCacheRecordKinds.map((kind) => deleteReaderRecord(currentBookId, kind).catch(() => 0)));
      removedSqlite = removals.reduce((sum, count) => sum + count, 0);
    }
    dispatchReaderCacheClearedEvents();
    setSaveStatus(currentBookId ? t('settings.dataActions.currentBookReaderCacheCleared', { count: removedLocal + removedSqlite }) : t('settings.dataActions.noCurrentBookReaderCache'));
  }

  async function clearAllReaderCacheSettingsData() {
    const removedLocal = clearAllReaderCacheLocalStorage();
    const removedSqlite = isTauriRuntime()
      ? (await Promise.all(readerCacheRecordKinds.map((kind) => deleteAllReaderRecordsByKind(kind).catch(() => 0)))).reduce((sum, count) => sum + count, 0)
      : 0;
    dispatchReaderCacheClearedEvents();
    setSaveStatus(t('settings.dataActions.allReaderCacheCleared', { count: removedLocal + removedSqlite }));
  }

  async function clearCurrentBookReaderPageCacheSettingsData() {
    const removedLocal = currentBookId ? removeLocalStorageByPrefix(readerPageCacheLocalStoragePrefix(currentBookId)) : 0;
    let removedSqlite = 0;
    if (currentBookId && isTauriRuntime()) {
      removedSqlite = await deleteReaderRecord(currentBookId, 'pageCache').catch(() => 0);
    }
    emitReaderPageCacheCleared();
    setSaveStatus(currentBookId ? t('settings.dataActions.currentBookPageCacheCleared', { count: removedLocal + removedSqlite }) : t('settings.dataActions.noCurrentBookPageCache'));
  }

  async function clearAllReaderPageCacheSettingsData() {
    const removed = removeLocalStorageByPrefix('bookmind:reader-page-cache:');
    const removedSqlite = isTauriRuntime() ? await deleteAllReaderRecordsByKind('pageCache').catch(() => 0) : 0;
    emitReaderPageCacheCleared();
    setSaveStatus(t('settings.dataActions.allPageCacheCleared', { count: removed + removedSqlite }));
  }

  async function clearCurrentBookAllDataSettingsData() {
    if (!currentBookId) {
      setSaveStatus(t('settings.dataActions.noCurrentBookAllData'));
      return;
    }
    const title = currentBookTitle || currentBookId;
    const confirmed = await requestAppConfirm(t('settings.dataActions.clearCurrentBookAllConfirm', { title }));
    if (!confirmed) return;
    const removedLocal = clearCurrentBookAllDataLocalStorage(currentBookId);
    let removedSqlite = 0;
    try {
      if (isTauriRuntime()) {
        removedSqlite = await deleteReaderRecordsByBook(currentBookId);
      }
      await dispatchCurrentBookDataClearedEvent(currentBookId);
      setSaveStatus(t('settings.dataActions.currentBookAllDataCleared', { count: removedLocal + removedSqlite }));
    } catch (error) {
      recordTauriCommandFailure('delete_reader_records_by_book', error);
      setSaveStatus(t('settings.dataActions.currentBookAllDataClearFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function clearOrphanReaderRecordsSettingsData() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotClearOrphans'));
      return;
    }
    const confirmed = await requestAppConfirm(t('settings.dataActions.clearOrphansConfirm'));
    if (!confirmed) return;
    try {
      const payload = await cleanupOrphanReaderRecords();
      const removedBookLabel = payload.removedBookIds.length > 0 ? t('settings.dataActions.orphanRemovedBookLabel', { count: payload.removedBookIds.length }) : '';
      setSaveStatus(t('settings.dataActions.orphanReaderRecordsCleared', { records: payload.removedRecords, removedBookLabel, kept: payload.keptLibraryBookCount }));
    } catch (error) {
      recordTauriCommandFailure('cleanup_orphan_reader_records', error);
      setSaveStatus(t('settings.dataActions.orphanReaderRecordsClearFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function rebuildDatabaseIndexesSettingsData() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotRebuildDbIndexes'));
      return;
    }
    const confirmed = await requestAppConfirm(t('settings.dataActions.rebuildDbIndexesConfirm'));
    if (!confirmed) return;
    try {
      const payload = await rebuildDatabaseIndexes();
      await loadSettingsDiagnosticPaths();
      setSaveStatus(t('settings.dataActions.dbIndexesRebuilt', {
        reindex: t(payload.reindexed ? 'settings.dataActions.dbStepDone' : 'settings.dataActions.dbStepSkipped'),
        analyze: t(payload.analyzed ? 'settings.dataActions.dbStepDone' : 'settings.dataActions.dbStepSkipped'),
        fts: t(payload.ftsOptimized ? 'settings.dataActions.dbStepDone' : 'settings.dataActions.dbStepSkipped'),
        chunks: payload.chunkCount,
        rows: payload.ftsRowCount,
      }));
    } catch (error) {
      recordTauriCommandFailure('rebuild_database_indexes', error);
      setSaveStatus(t('settings.dataActions.dbIndexesRebuildFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function vacuumDatabaseSettingsData() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotVacuumDb'));
      return;
    }
    const confirmed = await requestAppConfirm(t('settings.dataActions.vacuumDbConfirm'));
    if (!confirmed) return;
    try {
      const payload = await vacuumDatabase();
      await loadSettingsDiagnosticPaths();
      setSaveStatus(t('settings.dataActions.dbVacuumCompleted', {
        before: formatSettingsByteSize(payload.sizeBeforeBytes),
        after: formatSettingsByteSize(payload.sizeAfterBytes),
        reclaimed: formatSettingsByteSize(payload.bytesReclaimed),
        chunks: payload.chunkCount,
        rows: payload.ftsRowCount,
      }));
    } catch (error) {
      recordTauriCommandFailure('vacuum_database', error);
      setSaveStatus(t('settings.dataActions.dbVacuumFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function clearCurrentBookCloudAiHistorySettingsData() {
    if (!currentBookId) {
      setSaveStatus(t('settings.dataActions.noCurrentBookAiHistoryClear'));
      return;
    }
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotClearCurrentAiHistory'));
      return;
    }
    try {
      const removed = await deleteReaderRecord(currentBookId, 'cloudAiRequestHistory');
      setSaveStatus(t('settings.dataActions.currentAiHistoryCleared', { count: removed }));
    } catch (error) {
      recordTauriCommandFailure('delete_reader_record:cloudAiRequestHistory', error);
      setSaveStatus(t('settings.dataActions.currentAiHistoryClearFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function clearAllCloudAiHistorySettingsData() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotClearAllAiHistory'));
      return;
    }
    try {
      const removed = await deleteAllReaderRecordsByKind('cloudAiRequestHistory');
      setSaveStatus(t('settings.dataActions.allAiHistoryCleared', { count: removed }));
    } catch (error) {
      recordTauriCommandFailure('delete_reader_records_by_kind:cloudAiRequestHistory', error);
      setSaveStatus(t('settings.dataActions.allAiHistoryClearFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function exportCurrentBookCloudAiHistoryDiagnostics() {
    if (!currentBookId) {
      setSaveStatus(t('settings.dataActions.noCurrentBookAiHistoryExport'));
      return;
    }
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotExportAiHistory'));
      return;
    }
    try {
      const record = await getReaderRecord(currentBookId, 'cloudAiRequestHistory');
      const entries = parseReaderRecord<CloudAiRequestHistoryEntry[]>(record, []);
      const exportedAt = new Date().toISOString();
      const payload = buildCloudAiHistoryDiagnosticsPayload([{ bookId: currentBookId, bookTitle: currentBookTitle, updatedAt: record?.updatedAt ?? '', entries }], exportedAt);
      downloadSettingsText(`bookmind-ai-history-diagnostics-${currentBookId}-${exportedAt.slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
      setSaveStatus(t('settings.dataActions.currentAiHistoryDiagnosticsExported', { count: entries.length }));
    } catch (error) {
      recordTauriCommandFailure('get_reader_record:cloudAiRequestHistory', error);
      setSaveStatus(t('settings.dataActions.aiHistoryDiagnosticsExportFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function exportAllCloudAiHistoryDiagnostics() {
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotExportAiHistory'));
      return;
    }
    try {
      const records = await listReaderRecordsByKind('cloudAiRequestHistory');
      const exportedAt = new Date().toISOString();
      const books = records.map((record) => ({
        bookId: record.bookId,
        updatedAt: record.updatedAt,
        entries: parseReaderRecord<CloudAiRequestHistoryEntry[]>(record, []),
      }));
      const payload = buildCloudAiHistoryDiagnosticsPayload(books, exportedAt);
      downloadSettingsText(`bookmind-ai-history-diagnostics-all-${exportedAt.slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
      setSaveStatus(t('settings.dataActions.allAiHistoryDiagnosticsExported', { entries: payload.summary.totalEntries, books: payload.summary.bookCount }));
    } catch (error) {
      recordTauriCommandFailure('list_reader_records_by_kind:cloudAiRequestHistory', error);
      setSaveStatus(t('settings.dataActions.aiHistoryDiagnosticsExportFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function allowCurrentBookCloudAiSettingsData() {
    if (!currentBookId) {
      setSaveStatus(t('settings.dataActions.noCurrentBookCloudAllow'));
      return;
    }
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotWriteCloudConsent'));
      return;
    }
    try {
      await saveReaderRecord(currentBookId, 'cloudAiConsent', { bookId: currentBookId, alwaysAllowBook: true, updatedAt: new Date().toISOString() }, 'settings-center');
      emitCloudAiConsentUpdated({ bookId: currentBookId, alwaysAllowBook: true });
      setSaveStatus(t('settings.dataActions.currentBookCloudAllowed', { title: currentBookTitle || currentBookId }));
    } catch (error) {
      recordTauriCommandFailure('save_reader_record:cloudAiConsent', error);
      setSaveStatus(t('settings.dataActions.currentBookCloudAllowFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function revokeCurrentBookCloudAiConsentSettingsData() {
    if (!currentBookId) {
      setSaveStatus(t('settings.dataActions.noCurrentBookCloudRevoke'));
      return;
    }
    if (!isTauriRuntime()) {
      setSaveStatus(t('settings.dataActions.browserCannotRevokeCloudConsent'));
      return;
    }
    try {
      const removed = await deleteReaderRecord(currentBookId, 'cloudAiConsent');
      emitCloudAiConsentUpdated({ bookId: currentBookId, alwaysAllowBook: false });
      setSaveStatus(t('settings.dataActions.currentBookCloudRevoked', { count: removed }));
    } catch (error) {
      recordTauriCommandFailure('delete_reader_record:cloudAiConsent', error);
      setSaveStatus(t('settings.dataActions.currentBookCloudRevokeFailed', { error: formatSettingsPageError(error) }));
    }
  }

  function clearReaderSearchSettingsData() {
    removeLocalStorageKeys(['bookmind:global-search-history', 'bookmind:global-search-saved']);
    emitReaderSearchDataCleared();
    setSaveStatus(t('settings.dataActions.searchHistoryCleared'));
  }

  return {
    recordTauriCommandFailure,
    getDataDirectoryStatusFromSettings,
    useAppDataDirAsDefaultImportPath,
    openDataDirectoryFromSettings,
    chooseAndMigrateDataDirectoryFromSettings,
    enablePortableDataDirectoryFromSettings,
    createDataBackupFromSettings,
    chooseDataBackupDirectoryFromSettings,
    restoreDataBackupFromSettings,
    clearOperationLogSettingsData,
    exportOperationLogsSettingsData,
    clearReaderPageCacheSettingsData,
    clearCurrentBookReaderCacheSettingsData,
    clearAllReaderCacheSettingsData,
    clearCurrentBookReaderPageCacheSettingsData,
    clearAllReaderPageCacheSettingsData,
    clearCurrentBookAllDataSettingsData,
    clearOrphanReaderRecordsSettingsData,
    rebuildDatabaseIndexesSettingsData,
    vacuumDatabaseSettingsData,
    clearCurrentBookCloudAiHistorySettingsData,
    clearAllCloudAiHistorySettingsData,
    exportCurrentBookCloudAiHistoryDiagnostics,
    exportAllCloudAiHistoryDiagnostics,
    allowCurrentBookCloudAiSettingsData,
    revokeCurrentBookCloudAiConsentSettingsData,
    clearReaderSearchSettingsData,
  };
}

function rebaseBrowserStoragePaths(previousDataDir: string, nextDataDir: string) {
  const source = previousDataDir.trim();
  const target = nextDataDir.trim();
  if (!source || !target || source === target) return;
  const replacements = [
    [source.replaceAll('\\', '\\\\'), target.replaceAll('\\', '\\\\')],
    [source, target],
    [source.replaceAll('\\', '/'), target.replaceAll('\\', '/')],
  ].filter(([from, to]) => from && from !== to);
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    const raw = window.localStorage.getItem(key);
    if (raw === null) continue;
    const rewritten = replacements.reduce(
      (value, [from, to]) => value.replaceAll(from, to),
      raw,
    );
    if (rewritten !== raw) window.localStorage.setItem(key, rewritten);
  }
}

function dispatchReaderCacheClearedEvents() {
  emitReaderCacheCleared();
  emitReaderPageCacheCleared();
}

async function dispatchCurrentBookDataClearedEvent(bookId: string) {
  const detail = { bookId, kinds: currentBookDataRecordKinds };
  await publishCurrentBookDataCleared(detail);
  emitCloudAiConsentUpdated({ bookId, alwaysAllowBook: false });
  dispatchReaderCacheClearedEvents();
}

export async function loadSettingsDiagnosticPaths(): Promise<DiagnosticPaths> {
  if (!isTauriRuntime()) {
    return {
      dataDir: 'Browser preview unavailable',
      settingsFile: 'Browser preview unavailable',
      ftsDatabase: 'Browser preview unavailable',
    };
  }
  const status = await loadDataDirectoryStatus();
  const dataDir = normalizeDisplayPath(status.dataDir);
  const diagnostics = await loadIndexDiagnostics().catch(() => null);
  return {
    dataDir,
    settingsFile: joinDisplayPath(dataDir, 'settings/settings.json'),
    ftsDatabase: diagnostics?.summary.ftsDatabasePath || joinDisplayPath(dataDir, 'db/bookmind.sqlite'),
  };
}

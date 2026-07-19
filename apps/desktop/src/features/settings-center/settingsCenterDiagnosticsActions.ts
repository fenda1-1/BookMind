import { isTauriRuntime } from '../../app/platform';
import type { CloudAiRequestHistoryEntry } from '../../services/cloudAiHistoryService';
import { listReaderRecordsByKind, parseReaderRecord } from '../../services/readerStorageService';
import {
  type AiApiKeyStorageStatus,
  type AiCustomSlashCommandDraft,
  type ChapterRuleDraft,
  type ExtendedSettings,
  type LocalEncryptionStatus,
} from '../../services/settingsCenterService';
import {
  buildAiDiagnosticsExport,
  buildApplicationDiagnostics,
  buildIndexDiagnosticsExport,
  buildReaderDiagnostics,
  buildSystemInfoDiagnostics,
  collectRuntimeDiagnostics,
  formatSystemInfoDiagnosticsText,
} from '../../services/systemDiagnosticsService';
import { buildTaskDiagnosticsExport } from '../../services/taskDiagnosticsExport';
import { loadIndexDiagnostics, loadTaskLogs, loadTaskStatuses } from '../../services/taskService';
import type { CloudAiTestResult } from '../../services/aiService';
import { loadOperationLogs } from '../../services/operationLogService';
import { getLifecycleDiagnostics } from '../../services/lifecycleDiagnosticsService';
import type { AppSettings, ReaderSettings } from '../../types';
import type { Translator } from '../../i18n';
import type { DiagnosticPaths } from './settingsCenterDataMaintenanceActions';
import type { SettingsSnapshot } from './settingsCenterImportModel';
import { downloadSettingsText, sanitizeTauriCommandFailureInfo } from './settingsCenterPageModel';
import { formatSettingsPageError } from './settingsCenterStatusFormatModel';

type Setter<T> = (value: T) => void;

type SettingsDiagnosticsActionDeps = {
  settings: AppSettings;
  extendedSettings: ExtendedSettings;
  readerGlobalSettings: ReaderSettings;
  chapterRules: ChapterRuleDraft;
  diagnosticPaths: DiagnosticPaths;
  localEncryptionStatus: LocalEncryptionStatus | null;
  aiApiKeyStorageStatus: AiApiKeyStorageStatus | null;
  aiTestStatus: CloudAiTestResult | null;
  aiModels: string[];
  customSlashCommandList: AiCustomSlashCommandDraft[];
  fontRenderingDiagnostics: unknown;
  chapterParseDiagnostics: unknown;
  chapterDiagnosticsCleanedContent: string;
  lastTauriCommandFailure: { at: string; source: string; message: string } | null;
  saveStatus: string;
  t: Translator;
  operationLogRetentionDays: (value: string) => number;
  buildSettingsSnapshot: () => SettingsSnapshot;
  recordTauriCommandFailure: (source: string, error: unknown) => void;
  setDiagnosticsRedactionPreview: Setter<string>;
  setSaveStatus: Setter<string>;
};

export function createSettingsDiagnosticsActions(deps: SettingsDiagnosticsActionDeps) {
  const {
    settings,
    extendedSettings,
    readerGlobalSettings,
    chapterRules,
    diagnosticPaths,
    localEncryptionStatus,
    aiApiKeyStorageStatus,
    aiTestStatus,
    aiModels,
    customSlashCommandList,
    fontRenderingDiagnostics,
    chapterParseDiagnostics,
    chapterDiagnosticsCleanedContent,
    lastTauriCommandFailure,
    saveStatus,
    t,
    operationLogRetentionDays,
    buildSettingsSnapshot,
    recordTauriCommandFailure,
    setDiagnosticsRedactionPreview,
    setSaveStatus,
  } = deps;

  function copyDiagnosticSettingsSnapshot() {
    const snapshot = buildSettingsSnapshot();
    const payload = JSON.stringify({
      ...snapshot,
      diagnostics: {
        source: 'settings-center',
        appSettingsVersion: settings.schemaVersion ?? 1,
        redactedFields: ['aiApiKey'],
        copiedAt: new Date().toISOString(),
      },
    }, null, 2);
    void navigator.clipboard?.writeText(payload);
    setSaveStatus(t('settings.diagnosticsActions.snapshotCopied'));
  }

  function buildDiagnosticsRedactionPreview() {
    const exportedAt = new Date().toISOString();
    const runtime = collectRuntimeDiagnostics(isTauriRuntime());
    const sampleIndexDiagnostics = {
      summary: {
        ftsAvailable: true,
        indexedBookCount: 1,
        indexedChunkCount: 2,
        ftsDatabasePath: 'C:\\Users\\reader\\BookMind\\db\\bookmind.sqlite',
        recentError: 'Bearer token-preview-leak /Users/reader/private/Secret Book.txt',
      },
      books: [{
        bookId: 'preview-book',
        bookTitle: 'Secret Book',
        filePath: 'D:\\private\\Secret Book.txt',
        firstChunkPreview: 'This private text sample should not appear in exported diagnostics.',
        status: 'failed',
        lastError: 'sk-preview-should-not-leak',
      }],
    };
    const packages = [
      buildApplicationDiagnostics({
        exportedAt,
        appSettings: { ...settings, aiApiKey: settings.aiApiKey || 'sk-preview-should-not-leak' },
        extendedSettings,
        readerSettings: readerGlobalSettings,
        chapterRules,
        diagnosticPaths: {
          dataDir: 'C:\\Users\\reader\\AppData\\Roaming\\BookMind',
          settingsFile: 'C:\\Users\\reader\\AppData\\Roaming\\BookMind\\settings\\settings.json',
          ftsDatabase: 'D:\\private\\bookmind.sqlite',
        },
        localEncryptionStatus,
        aiApiKeyStorageStatus,
        indexDiagnostics: sampleIndexDiagnostics,
        taskStatuses: [],
        taskLogs: [],
        operationLogs: [{
          at: exportedAt,
          level: 'debug',
          action: 'preview.diagnostics',
          detail: { prompt: 'Private prompt', filePath: 'D:\\private\\Secret Book.txt', apiKey: 'sk-log-preview' },
        }],
        runtime,
      }),
      buildAiDiagnosticsExport({
        exportedAt,
        appSettings: { ...settings, aiApiKey: settings.aiApiKey || 'sk-preview-should-not-leak' },
        extendedSettings,
        aiApiKeyStorageStatus,
        aiTestStatus: { ok: false, status: 401, model: settings.aiModel ?? '', durationMs: 0, text: 'Private response text', error: 'Bearer preview-token' },
        aiModels: aiModels.length ? aiModels : [settings.aiModel || 'private-model'],
        customSlashCommands: customSlashCommandList,
        historyRecords: [],
        indexDiagnostics: sampleIndexDiagnostics,
        runtime,
      }),
      buildReaderDiagnostics({
        exportedAt,
        readerSettings: readerGlobalSettings,
        extendedSettings,
        chapterRules,
        fontRenderingDiagnostics,
        parserDiagnostics: chapterParseDiagnostics,
        runtime,
      }),
      buildIndexDiagnosticsExport({
        exportedAt,
        indexDiagnostics: sampleIndexDiagnostics,
        runtime,
      }),
      buildSystemInfoDiagnostics({
        copiedAt: exportedAt,
        appSettings: { ...settings, aiApiKey: settings.aiApiKey || 'sk-preview-should-not-leak' },
        extendedSettings,
        diagnosticPaths,
        localEncryptionStatus,
        aiApiKeyStorageStatus,
        runtime,
      }),
    ];
    return JSON.stringify({
      generatedAt: exportedAt,
      previewPurpose: 'diagnostics-redaction-preview',
      packageCount: packages.length,
      schemas: packages.map((item) => ('schema' in item ? item.schema : 'bookmind.system-info.v1')),
      redactionPolicies: packages.map((item) => ('redaction' in item ? item.redaction : null)),
      excludedFields: packages.map((item) => ('excludedFields' in item ? item.excludedFields : [])),
      samplePayloads: packages.map((item) => ({
        schema: 'schema' in item ? item.schema : 'bookmind.system-info.v1',
        jsonPreview: JSON.stringify(item, null, 2).slice(0, 900),
      })),
    }, null, 2);
  }

  function refreshDiagnosticsRedactionPreview() {
    setDiagnosticsRedactionPreview(buildDiagnosticsRedactionPreview());
    setSaveStatus(t('settings.diagnosticsActions.redactionPreviewGenerated'));
  }

  async function exportTaskDiagnosticsFromSettings() {
    try {
      const [tasks, diagnostics, logs] = await Promise.all([
        loadTaskStatuses(),
        loadIndexDiagnostics(),
        loadTaskLogs(),
      ]);
      const payload = buildTaskDiagnosticsExport({
        diagnostics,
        logs,
        tasks,
      });
      downloadSettingsText(
        `bookmind-task-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
      );
      setSaveStatus(t('settings.diagnosticsActions.taskDiagnosticsExported'));
    } catch (error) {
      recordTauriCommandFailure('task_diagnostics_export', error);
      setSaveStatus(t('settings.diagnosticsActions.taskDiagnosticsExportFailed', { error: formatSettingsPageError(error) }));
    }
  }

  async function exportApplicationDiagnosticsFromSettings() {
    const exportedAt = new Date().toISOString();
    const [tasks, indexDiagnostics, taskLogs] = await Promise.all([
      loadTaskStatuses().catch((error) => [{ status: 'diagnostic-load-failed', stage: 'task-statuses', errorMessage: formatSettingsPageError(error) }]),
      loadIndexDiagnostics().catch((error) => ({ summary: { status: 'diagnostic-load-failed', recentError: formatSettingsPageError(error) }, books: [] })),
      loadTaskLogs().catch((error) => [{ level: 'error', stage: 'task-logs', message: formatSettingsPageError(error) }]),
    ]);
    const payload = buildApplicationDiagnostics({
      exportedAt,
      appSettings: settings,
      extendedSettings,
      readerSettings: readerGlobalSettings,
      chapterRules,
      diagnosticPaths,
      localEncryptionStatus,
      aiApiKeyStorageStatus,
      indexDiagnostics,
      taskStatuses: tasks,
      taskLogs,
      operationLogs: loadOperationLogs(operationLogRetentionDays(extendedSettings.operationLogRetention)),
      lifecycleDiagnostics: getLifecycleDiagnostics(),
      runtime: collectRuntimeDiagnostics(isTauriRuntime()),
    });
    downloadSettingsText(
      `bookmind-application-diagnostics-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
    setSaveStatus(t('settings.diagnosticsActions.applicationDiagnosticsExported'));
  }

  async function exportAiDiagnosticsFromSettings() {
    const exportedAt = new Date().toISOString();
    const [historyRecords, indexDiagnostics] = await Promise.all([
      isTauriRuntime()
        ? listReaderRecordsByKind('cloudAiRequestHistory')
          .then((records) => records.map((record) => ({
            bookId: record.bookId,
            updatedAt: record.updatedAt,
            entries: parseReaderRecord<CloudAiRequestHistoryEntry[]>(record, []),
          })))
          .catch(() => [{
            bookId: 'diagnostic-load-failed',
            updatedAt: exportedAt,
            entries: [{
              id: 'diagnostic-load-failed',
              bookId: 'diagnostic-load-failed',
              createdAt: exportedAt,
              durationMs: 0,
              endpointMode: settings.aiEndpointMode ?? 'responses',
              model: settings.aiModel ?? '',
              scope: extendedSettings.aiDefaultScope,
              resultCount: 0,
              status: 'failed',
              errorKind: 'diagnostic-load-failed',
              redactedFields: ['body', 'scopeText', 'userText', 'apiKey'],
            } satisfies CloudAiRequestHistoryEntry],
          }])
        : Promise.resolve([]),
      loadIndexDiagnostics().catch((error) => ({ summary: { status: 'diagnostic-load-failed', recentError: formatSettingsPageError(error) }, books: [] })),
    ]);
    const payload = buildAiDiagnosticsExport({
      exportedAt,
      appSettings: settings,
      extendedSettings,
      aiApiKeyStorageStatus,
      aiTestStatus,
      aiModels,
      customSlashCommands: customSlashCommandList,
      historyRecords,
      indexDiagnostics,
      runtime: collectRuntimeDiagnostics(isTauriRuntime()),
    });
    downloadSettingsText(
      `bookmind-ai-diagnostics-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
    setSaveStatus(t('settings.diagnosticsActions.aiDiagnosticsExported'));
  }

  function exportReaderDiagnosticsFromSettings() {
    const exportedAt = new Date().toISOString();
    const payload = buildReaderDiagnostics({
      exportedAt,
      readerSettings: readerGlobalSettings,
      extendedSettings,
      chapterRules,
      fontRenderingDiagnostics,
      parserDiagnostics: chapterParseDiagnostics,
      runtime: collectRuntimeDiagnostics(isTauriRuntime()),
    });
    downloadSettingsText(
      `bookmind-reader-diagnostics-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
    setSaveStatus(t('settings.diagnosticsActions.readerDiagnosticsExported'));
  }

  async function exportIndexDiagnosticsFromSettings() {
    try {
      const exportedAt = new Date().toISOString();
      const diagnostics = await loadIndexDiagnostics();
      const payload = buildIndexDiagnosticsExport({
        exportedAt,
        indexDiagnostics: diagnostics,
        runtime: collectRuntimeDiagnostics(isTauriRuntime()),
      });
      downloadSettingsText(
        `bookmind-index-diagnostics-${exportedAt.slice(0, 10)}.json`,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
      );
      setSaveStatus(t('settings.diagnosticsActions.indexDiagnosticsExported'));
    } catch (error) {
      recordTauriCommandFailure('get_index_diagnostics', error);
      setSaveStatus(t('settings.diagnosticsActions.indexDiagnosticsExportFailed', { error: formatSettingsPageError(error) }));
    }
  }

  function copySystemInfoFromSettings() {
    const payload = buildSystemInfoDiagnostics({
      copiedAt: new Date().toISOString(),
      appSettings: settings,
      extendedSettings,
      diagnosticPaths,
      localEncryptionStatus,
      aiApiKeyStorageStatus,
      runtime: collectRuntimeDiagnostics(isTauriRuntime()),
    });
    const text = formatSystemInfoDiagnosticsText(payload);
    if (!navigator.clipboard?.writeText) {
      setSaveStatus(t('settings.diagnosticsActions.systemInfoClipboardUnsupported'));
      return;
    }
    void navigator.clipboard.writeText(text)
      .then(() => setSaveStatus(t('settings.diagnosticsActions.systemInfoCopied')))
      .catch((error) => setSaveStatus(t('settings.diagnosticsActions.systemInfoCopyFailed', { error: formatSettingsPageError(error) })));
  }

  function copyTauriCommandFailureInfo() {
    if (!navigator.clipboard?.writeText) {
      setSaveStatus(t('settings.diagnosticsActions.tauriFailureClipboardUnsupported'));
      return;
    }
    const recentErrors = loadOperationLogs(operationLogRetentionDays(extendedSettings.operationLogRetention))
      .filter((entry) => entry.level === 'error')
      .slice(0, 5);
    const payload = JSON.stringify(sanitizeTauriCommandFailureInfo({
      schema: 'bookmind.tauri-command-failure.v1',
      copiedAt: new Date().toISOString(),
      tauriRuntime: isTauriRuntime(),
      latestFailure: lastTauriCommandFailure ?? { at: new Date().toISOString(), source: 'settings-status', message: saveStatus },
      recentErrorLogs: recentErrors,
    }), null, 2);
    void navigator.clipboard.writeText(payload)
      .then(() => setSaveStatus(t('settings.diagnosticsActions.tauriFailureCopied')))
      .catch((error) => setSaveStatus(t('settings.diagnosticsActions.tauriFailureCopyFailed', { error: formatSettingsPageError(error) })));
  }

  function copyChapterParseDiagnostics() {
    const payload = JSON.stringify({
      source: 'settings-center.chapter-parser',
      copiedAt: new Date().toISOString(),
      sampleCharacterCount: chapterDiagnosticsCleanedContent.length,
      diagnostics: chapterParseDiagnostics,
    }, null, 2);
    void navigator.clipboard?.writeText(payload);
    setSaveStatus(t('settings.diagnosticsActions.chapterParseCopied'));
  }

  return {
    copyDiagnosticSettingsSnapshot,
    refreshDiagnosticsRedactionPreview,
    exportTaskDiagnosticsFromSettings,
    exportApplicationDiagnosticsFromSettings,
    exportAiDiagnosticsFromSettings,
    exportReaderDiagnosticsFromSettings,
    exportIndexDiagnosticsFromSettings,
    copySystemInfoFromSettings,
    copyTauriCommandFailureInfo,
    copyChapterParseDiagnostics,
  };
}

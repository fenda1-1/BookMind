import { useEffect, useMemo, useRef, useState } from 'react';
import { loadGlobalReaderSettings, loadReaderCustomPresets, type ReaderCustomPreset } from '../features/reader-core/readerSettings';
import type { CloudAiTestResult } from '../services/aiService';
import type { DataBackupResult } from '../services/dataBackupService';
import { loadOperationLogs } from '../services/operationLogService';
import { defaultAppSettings } from '../features/settings-center/settingsCenterPageModel';
import { defaultCustomSlashCommandDraft, type SettingsGroupId } from '../features/settings-center/settingsCenterModel';
import type { SettingsImportPreview } from '../features/settings-center/settingsCenterImportModel';
import type { DiagnosticPaths } from '../features/settings-center/settingsCenterDataMaintenanceActions';
import {
  defaultExtendedSettings,
  loadAiCustomSlashCommands,
  loadChapterRules,
  loadExtendedSettings,
  loadSettingsChangeHistory,
  type AiApiKeyStorageStatus,
  type AiCustomSlashCommandDraft,
  type ChapterRuleDraft,
  type DataDirectoryMigrationProgress,
  type DataDirectoryStatus,
  type ExtendedSettings,
  type LocalEncryptionStatus,
  type SettingsChangeHistoryEntry,
} from '../services/settingsCenterService';
import type { AppSettings, OperationLogLevel, ReaderSettings } from '../types';
import type { Translator } from '../i18n';

const settingsPageMemoryStorageKey = 'bookmind:settings-page-memory:v1';

type SettingsPageMemory = {
  activeGroup?: SettingsGroupId;
  settingsQuery?: string;
  pageFilterQuery?: string;
  scrollTopByGroup?: Partial<Record<SettingsGroupId, number>>;
};

type SettingsPageLocalizedDefaults = {
  chapterRegexTestInput: string;
  compactSplitPreviewInput: string;
  txtCleanupPreviewInput: string;
  chapterDiagnosticsSampleInput: string;
  cloudRedactionPreviewInput: string;
  saveStatus: string;
  diagnosticUnavailable: string;
};

function buildSettingsPageLocalizedDefaults(t: Translator): SettingsPageLocalizedDefaults {
  return {
    chapterRegexTestInput: t('settings.state.sample.chapterRegex'),
    compactSplitPreviewInput: t('settings.state.sample.compactSplit'),
    txtCleanupPreviewInput: t('settings.state.sample.txtCleanup'),
    chapterDiagnosticsSampleInput: t('settings.state.sample.chapterDiagnostics'),
    cloudRedactionPreviewInput: t('settings.state.sample.cloudRedaction'),
    saveStatus: t('settings.state.saveStatus.loaded'),
    diagnosticUnavailable: t('settings.state.diagnostic.browserUnavailable'),
  };
}

function loadSettingsPageMemory(): SettingsPageMemory {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(settingsPageMemoryStorageKey) ?? '{}') as SettingsPageMemory;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSettingsPageMemory(patch: SettingsPageMemory) {
  if (typeof window === 'undefined') return;
  const current = loadSettingsPageMemory();
  window.localStorage.setItem(settingsPageMemoryStorageKey, JSON.stringify({
    ...current,
    ...patch,
    scrollTopByGroup: {
      ...(current.scrollTopByGroup ?? {}),
      ...(patch.scrollTopByGroup ?? {}),
    },
  }));
}

export function useSettingsPageState(t: Translator) {
  const settingsPageMemory = loadSettingsPageMemory();
  const localizedDefaults = useMemo(() => buildSettingsPageLocalizedDefaults(t), [t]);
  const previousLocalizedDefaultsRef = useRef(localizedDefaults);
  const [activeGroup, setActiveGroup] = useState<SettingsGroupId>(() => settingsPageMemory.activeGroup ?? 'general');
  const [settingsQuery, setSettingsQuery] = useState(() => settingsPageMemory.settingsQuery ?? '');
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings());
  const [operationLogs, setOperationLogs] = useState(() => loadOperationLogs(Number(defaultExtendedSettings.operationLogRetention)));
  const [operationLogFilterLevel, setOperationLogFilterLevel] = useState<'all' | Exclude<OperationLogLevel, 'none'>>('all');
  const [operationLogFilterQuery, setOperationLogFilterQuery] = useState('');
  const [readerGlobalSettings, setReaderGlobalSettings] = useState<ReaderSettings>(() => loadGlobalReaderSettings());
  const [readerCustomPresets, setReaderCustomPresets] = useState<ReaderCustomPreset[]>(() => loadReaderCustomPresets());
  const [chapterRules, setChapterRules] = useState<ChapterRuleDraft>(() => loadChapterRules());
  const [chapterRegexTestInput, setChapterRegexTestInput] = useState(localizedDefaults.chapterRegexTestInput);
  const [compactSplitPreviewInput, setCompactSplitPreviewInput] = useState(localizedDefaults.compactSplitPreviewInput);
  const [txtCleanupPreviewInput, setTxtCleanupPreviewInput] = useState(localizedDefaults.txtCleanupPreviewInput);
  const [chapterDiagnosticsSampleInput, setChapterDiagnosticsSampleInput] = useState(localizedDefaults.chapterDiagnosticsSampleInput);
  const [cloudRedactionPreviewInput, setCloudRedactionPreviewInput] = useState(localizedDefaults.cloudRedactionPreviewInput);
  const [extendedSettings, setExtendedSettings] = useState<ExtendedSettings>(() => loadExtendedSettings());
  const settingsImportInputRef = useRef<HTMLInputElement | null>(null);
  const readerPresetImportInputRef = useRef<HTMLInputElement | null>(null);
  const customSlashCommandImportInputRef = useRef<HTMLInputElement | null>(null);
  const customCleanupRuleImportInputRef = useRef<HTMLInputElement | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSettingsJsonPreview, setShowSettingsJsonPreview] = useState(false);
  const [settingsImportPreview, setSettingsImportPreview] = useState<SettingsImportPreview | null>(null);
  const [settingsChangeHistory, setSettingsChangeHistory] = useState<SettingsChangeHistoryEntry[]>(() => loadSettingsChangeHistory());
  const [saveStatus, setSaveStatus] = useState(localizedDefaults.saveStatus);
  const [lastDataBackupResult, setLastDataBackupResult] = useState<DataBackupResult | null>(null);
  const [selectedDataBackupPath, setSelectedDataBackupPath] = useState('');
  const [dataBackupBusy, setDataBackupBusy] = useState(false);
  const [diagnosticsRedactionPreview, setDiagnosticsRedactionPreview] = useState('');
  const [lastTauriCommandFailure, setLastTauriCommandFailure] = useState<{ at: string; source: string; message: string } | null>(null);
  const [aiTestStatus, setAiTestStatus] = useState<CloudAiTestResult | null>(null);
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [customSlashCommandList, setCustomSlashCommandList] = useState<AiCustomSlashCommandDraft[]>(() => loadAiCustomSlashCommands(Number(defaultExtendedSettings.aiCustomSlashCommandLimit)));
  const [customSlashCommandDraft, setCustomSlashCommandDraft] = useState(defaultCustomSlashCommandDraft);
  const [customSlashCommandEditingId, setCustomSlashCommandEditingId] = useState('');
  const [customSlashCommandEditDraft, setCustomSlashCommandEditDraft] = useState(defaultCustomSlashCommandDraft);
  const [loadingAiModels, setLoadingAiModels] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [diagnosticPaths, setDiagnosticPaths] = useState<DiagnosticPaths>(() => ({
    dataDir: localizedDefaults.diagnosticUnavailable,
    settingsFile: localizedDefaults.diagnosticUnavailable,
    ftsDatabase: localizedDefaults.diagnosticUnavailable,
  }));
  const [localEncryptionStatus, setLocalEncryptionStatus] = useState<LocalEncryptionStatus | null>(null);
  const [loadingLocalEncryptionStatus, setLoadingLocalEncryptionStatus] = useState(false);
  const [localEncryptionStatusError, setLocalEncryptionStatusError] = useState('');
  const [masterPasswordDraft, setMasterPasswordDraft] = useState('');
  const [masterPasswordVerifyDraft, setMasterPasswordVerifyDraft] = useState('');
  const [masterPasswordBusy, setMasterPasswordBusy] = useState(false);
  const [localKeyRotationBusy, setLocalKeyRotationBusy] = useState(false);
  const [lastLocalKeyRotationSummary, setLastLocalKeyRotationSummary] = useState('');
  const [aiApiKeyStorageStatus, setAiApiKeyStorageStatus] = useState<AiApiKeyStorageStatus | null>(null);
  const [loadingAiApiKeyStorageStatus, setLoadingAiApiKeyStorageStatus] = useState(false);
  const [aiApiKeyStorageStatusError, setAiApiKeyStorageStatusError] = useState('');
  const [dataDirectoryStatus, setDataDirectoryStatus] = useState<DataDirectoryStatus | null>(null);
  const [dataDirectoryBusy, setDataDirectoryBusy] = useState(false);
  const [dataDirectoryError, setDataDirectoryError] = useState('');
  const [dataDirectoryMigrationProgress, setDataDirectoryMigrationProgress] = useState<DataDirectoryMigrationProgress | null>(null);
  const [highlightedSetting, setHighlightedSetting] = useState<'ai-api' | 'reader-memory-warning' | null>(null);
  const aiApiSettingRef = useRef<HTMLElement | null>(null);
  const readerMemoryWarningSettingRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previous = previousLocalizedDefaultsRef.current;
    setChapterRegexTestInput((current) => current === previous.chapterRegexTestInput ? localizedDefaults.chapterRegexTestInput : current);
    setCompactSplitPreviewInput((current) => current === previous.compactSplitPreviewInput ? localizedDefaults.compactSplitPreviewInput : current);
    setTxtCleanupPreviewInput((current) => current === previous.txtCleanupPreviewInput ? localizedDefaults.txtCleanupPreviewInput : current);
    setChapterDiagnosticsSampleInput((current) => current === previous.chapterDiagnosticsSampleInput ? localizedDefaults.chapterDiagnosticsSampleInput : current);
    setCloudRedactionPreviewInput((current) => current === previous.cloudRedactionPreviewInput ? localizedDefaults.cloudRedactionPreviewInput : current);
    setSaveStatus((current) => current === previous.saveStatus ? localizedDefaults.saveStatus : current);
    setDiagnosticPaths((current) => ({
      dataDir: current.dataDir === previous.diagnosticUnavailable ? localizedDefaults.diagnosticUnavailable : current.dataDir,
      settingsFile: current.settingsFile === previous.diagnosticUnavailable ? localizedDefaults.diagnosticUnavailable : current.settingsFile,
      ftsDatabase: current.ftsDatabase === previous.diagnosticUnavailable ? localizedDefaults.diagnosticUnavailable : current.ftsDatabase,
    }));
    previousLocalizedDefaultsRef.current = localizedDefaults;
  }, [localizedDefaults]);

  return {
    activeGroup,
    setActiveGroup,
    settingsQuery,
    setSettingsQuery,
    settings,
    setSettings,
    operationLogs,
    setOperationLogs,
    operationLogFilterLevel,
    setOperationLogFilterLevel,
    operationLogFilterQuery,
    setOperationLogFilterQuery,
    readerGlobalSettings,
    setReaderGlobalSettings,
    readerCustomPresets,
    setReaderCustomPresets,
    chapterRules,
    setChapterRules,
    chapterRegexTestInput,
    setChapterRegexTestInput,
    compactSplitPreviewInput,
    setCompactSplitPreviewInput,
    txtCleanupPreviewInput,
    setTxtCleanupPreviewInput,
    chapterDiagnosticsSampleInput,
    setChapterDiagnosticsSampleInput,
    cloudRedactionPreviewInput,
    setCloudRedactionPreviewInput,
    extendedSettings,
    setExtendedSettings,
    settingsImportInputRef,
    readerPresetImportInputRef,
    customSlashCommandImportInputRef,
    customCleanupRuleImportInputRef,
    showApiKey,
    setShowApiKey,
    showSettingsJsonPreview,
    setShowSettingsJsonPreview,
    settingsImportPreview,
    setSettingsImportPreview,
    settingsChangeHistory,
    setSettingsChangeHistory,
    saveStatus,
    setSaveStatus,
    lastDataBackupResult,
    setLastDataBackupResult,
    selectedDataBackupPath,
    setSelectedDataBackupPath,
    dataBackupBusy,
    setDataBackupBusy,
    diagnosticsRedactionPreview,
    setDiagnosticsRedactionPreview,
    lastTauriCommandFailure,
    setLastTauriCommandFailure,
    aiTestStatus,
    setAiTestStatus,
    aiModels,
    setAiModels,
    customSlashCommandList,
    setCustomSlashCommandList,
    customSlashCommandDraft,
    setCustomSlashCommandDraft,
    customSlashCommandEditingId,
    setCustomSlashCommandEditingId,
    customSlashCommandEditDraft,
    setCustomSlashCommandEditDraft,
    loadingAiModels,
    setLoadingAiModels,
    testingAi,
    setTestingAi,
    diagnosticPaths,
    setDiagnosticPaths,
    localEncryptionStatus,
    setLocalEncryptionStatus,
    loadingLocalEncryptionStatus,
    setLoadingLocalEncryptionStatus,
    localEncryptionStatusError,
    setLocalEncryptionStatusError,
    masterPasswordDraft,
    setMasterPasswordDraft,
    masterPasswordVerifyDraft,
    setMasterPasswordVerifyDraft,
    masterPasswordBusy,
    setMasterPasswordBusy,
    localKeyRotationBusy,
    setLocalKeyRotationBusy,
    lastLocalKeyRotationSummary,
    setLastLocalKeyRotationSummary,
    aiApiKeyStorageStatus,
    setAiApiKeyStorageStatus,
    loadingAiApiKeyStorageStatus,
    setLoadingAiApiKeyStorageStatus,
    aiApiKeyStorageStatusError,
    setAiApiKeyStorageStatusError,
    dataDirectoryStatus,
    setDataDirectoryStatus,
    dataDirectoryBusy,
    setDataDirectoryBusy,
    dataDirectoryError,
    setDataDirectoryError,
    dataDirectoryMigrationProgress,
    setDataDirectoryMigrationProgress,
    highlightedSetting,
    setHighlightedSetting,
    aiApiSettingRef,
    readerMemoryWarningSettingRef,
  };
}

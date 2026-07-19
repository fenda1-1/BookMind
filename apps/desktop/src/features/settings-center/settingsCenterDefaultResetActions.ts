import type { LocalePreference, Translator } from '../../i18n';
import type { CloudAiTestResult } from '../../services/aiService';
import { saveAppSettings } from '../../services/settingsService';
import {
  defaultChapterRules,
  defaultExtendedSettings,
  dispatchSettingsUpdated,
  saveChapterRules,
  saveExtendedSettings,
  type ChapterRuleDraft,
  type ExtendedSettings,
} from '../../services/settingsCenterService';
import type { AppSettings, OperationLogLevel, ReaderSettings } from '../../types';
import { defaultReaderSettings, saveGlobalReaderSettings } from '../reader-core/readerSettings';
import { buildSettingsGroups, type SettingsGroupId } from './settingsCenterModel';
import { defaultAppSettings } from './settingsCenterPageModel';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;
type ValueSetter<T> = (value: T) => void;

type SettingsDefaultResetActionDeps = {
  settings: AppSettings;
  extendedSettings: ExtendedSettings;
  readerGlobalSettings: ReaderSettings;
  t: Translator;
  confirmReset: (message: string) => Promise<boolean>;
  setSettings: StateSetter<AppSettings>;
  setOperationLogLevel: ValueSetter<OperationLogLevel>;
  setReaderGlobalSettings: StateSetter<ReaderSettings>;
  setChapterRules: StateSetter<ChapterRuleDraft>;
  setExtendedSettings: StateSetter<ExtendedSettings>;
  setAiTestStatus: StateSetter<CloudAiTestResult | null>;
  setAiModels: StateSetter<string[]>;
  setLocalePreference: (preference: LocalePreference) => void;
  setSaveStatus: StateSetter<string>;
};

export function createSettingsDefaultResetActions(deps: SettingsDefaultResetActionDeps) {
  const {
    settings,
    extendedSettings,
    readerGlobalSettings,
    t,
    confirmReset,
    setSettings,
    setOperationLogLevel,
    setReaderGlobalSettings,
    setChapterRules,
    setExtendedSettings,
    setAiTestStatus,
    setAiModels,
    setLocalePreference,
    setSaveStatus,
  } = deps;

  function restoreReaderGlobalDefaults() {
    setReaderGlobalSettings(saveGlobalReaderSettings(defaultReaderSettings));
    dispatchSettingsUpdated({ key: 'readerDefaults', keys: Object.keys(defaultReaderSettings), scope: 'reader' });
    setSaveStatus(t('settings.defaultResetActions.readerDefaultsRestored'));
  }

  async function restoreAllSettingsDefaults() {
    if (!await confirmReset(t('settings.defaultResetActions.confirmAllDefaults'))) return;
    const nextAppSettings = defaultAppSettings();
    const savedAppSettings = await saveAppSettings(nextAppSettings);
    setSettings({ ...defaultAppSettings(), ...savedAppSettings });
    setOperationLogLevel(savedAppSettings.operationLogLevel ?? 'none');
    setReaderGlobalSettings(saveGlobalReaderSettings(defaultReaderSettings));
    setChapterRules(saveChapterRules(defaultChapterRules));
    setExtendedSettings(saveExtendedSettings(defaultExtendedSettings, { key: 'all', keys: Object.keys(defaultExtendedSettings) }));
    dispatchSettingsUpdated({ key: 'readerDefaults', keys: Object.keys(defaultReaderSettings), scope: 'reader' });
    dispatchSettingsUpdated({ key: 'chapterRules', keys: Object.keys(defaultChapterRules), scope: 'chapterRules' });
    setAiTestStatus(null);
    setAiModels([]);
    setSaveStatus(t('settings.defaultResetActions.allDefaultsRestored'));
  }

  async function restoreGroupDefaults(groupId: SettingsGroupId) {
    const groupLabel = buildSettingsGroups(t).find((group) => group.id === groupId)?.label ?? t('settings.defaultResetActions.currentGroup');
    if (!await confirmReset(t('settings.defaultResetActions.confirmGroupDefaults', { group: groupLabel }))) return;
    if (groupId === 'general') {
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, startupPage: defaultExtendedSettings.startupPage, openLastReaderBookOnStartup: defaultExtendedSettings.openLastReaderBookOnStartup, restoreLastReaderPositionOnStartup: defaultExtendedSettings.restoreLastReaderPositionOnStartup, checkUnfinishedTasksOnStartup: defaultExtendedSettings.checkUnfinishedTasksOnStartup, refreshLibraryMetadataOnStartup: defaultExtendedSettings.refreshLibraryMetadataOnStartup, startupOverviewMode: defaultExtendedSettings.startupOverviewMode, rememberWindowGeometry: defaultExtendedSettings.rememberWindowGeometry }, { key: 'general', keys: ['startupPage', 'openLastReaderBookOnStartup', 'restoreLastReaderPositionOnStartup', 'checkUnfinishedTasksOnStartup', 'refreshLibraryMetadataOnStartup', 'startupOverviewMode', 'rememberWindowGeometry'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.general'));
      return;
    }
    if (groupId === 'appearance') {
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, appTheme: defaultExtendedSettings.appTheme, customThemeColor: defaultExtendedSettings.customThemeColor, sidebarCollapsed: defaultExtendedSettings.sidebarCollapsed, libraryPanelPersistent: defaultExtendedSettings.libraryPanelPersistent, sidebarRecentBookLimit: defaultExtendedSettings.sidebarRecentBookLimit, pageTitleMode: defaultExtendedSettings.pageTitleMode, visibleNavItems: defaultExtendedSettings.visibleNavItems, topbarButtonVisibility: defaultExtendedSettings.topbarButtonVisibility, readerThemeFollowsApp: defaultExtendedSettings.readerThemeFollowsApp }, { key: 'appearance', keys: ['appTheme', 'customThemeColor', 'sidebarCollapsed', 'libraryPanelPersistent', 'sidebarRecentBookLimit', 'pageTitleMode', 'visibleNavItems', 'topbarButtonVisibility', 'readerThemeFollowsApp'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.appearance'));
      return;
    }
    if (groupId === 'reader') {
      setReaderGlobalSettings(saveGlobalReaderSettings(defaultReaderSettings));
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, wheelPagingThresholdPx: defaultExtendedSettings.wheelPagingThresholdPx, autoSaveReaderPosition: defaultExtendedSettings.autoSaveReaderPosition, readerPositionSaveDebounceMs: defaultExtendedSettings.readerPositionSaveDebounceMs, multiWindowReaderSync: defaultExtendedSettings.multiWindowReaderSync, booksOpenInStandaloneReader: defaultExtendedSettings.booksOpenInStandaloneReader, readerNavHiddenByStandaloneOnly: defaultExtendedSettings.readerNavHiddenByStandaloneOnly, multiWindowConflictStrategy: defaultExtendedSettings.multiWindowConflictStrategy, readerProgressMode: defaultExtendedSettings.readerProgressMode, tocShowVolumeHierarchy: defaultExtendedSettings.tocShowVolumeHierarchy, tocVolumeClickable: defaultExtendedSettings.tocVolumeClickable, tocShowChapterNumbers: defaultExtendedSettings.tocShowChapterNumbers, tocCollapseVolumes: defaultExtendedSettings.tocCollapseVolumes, tocExpandActiveVolume: defaultExtendedSettings.tocExpandActiveVolume, tocShowChapterWordCount: defaultExtendedSettings.tocShowChapterWordCount, tocShowChapterProgress: defaultExtendedSettings.tocShowChapterProgress, tocTitleGroupingEnabled: defaultExtendedSettings.tocTitleGroupingEnabled, tocTitleGroupKeywords: defaultExtendedSettings.tocTitleGroupKeywords, tocTitleGroupRules: defaultExtendedSettings.tocTitleGroupRules, readerHistoryStackLimit: defaultExtendedSettings.readerHistoryStackLimit, readerDailyGoalEnabled: defaultExtendedSettings.readerDailyGoalEnabled, readerDailyPagesGoal: defaultExtendedSettings.readerDailyPagesGoal, readerDailyMinutesGoal: defaultExtendedSettings.readerDailyMinutesGoal, readerDailyChaptersGoal: defaultExtendedSettings.readerDailyChaptersGoal, largeBookPerformanceMode: defaultExtendedSettings.largeBookPerformanceMode, readerPageCacheEnabled: defaultExtendedSettings.readerPageCacheEnabled, readerPagePreheatEnabled: defaultExtendedSettings.readerPagePreheatEnabled, readerPageMeasureCacheLimit: defaultExtendedSettings.readerPageMeasureCacheLimit, readerFpsDiagnosticsEnabled: defaultExtendedSettings.readerFpsDiagnosticsEnabled, readerMemoryWarningEnabled: defaultExtendedSettings.readerMemoryWarningEnabled, readerMemoryWarningThresholdMb: defaultExtendedSettings.readerMemoryWarningThresholdMb, readerPageCacheLimit: defaultExtendedSettings.readerPageCacheLimit, readerPagePreheatRange: defaultExtendedSettings.readerPagePreheatRange }, { key: 'reader', keys: ['wheelPagingThresholdPx', 'autoSaveReaderPosition', 'readerPositionSaveDebounceMs', 'multiWindowReaderSync', 'booksOpenInStandaloneReader', 'readerNavHiddenByStandaloneOnly', 'multiWindowConflictStrategy', 'readerProgressMode', 'tocShowVolumeHierarchy', 'tocVolumeClickable', 'tocShowChapterNumbers', 'tocCollapseVolumes', 'tocExpandActiveVolume', 'tocShowChapterWordCount', 'tocShowChapterProgress', 'tocTitleGroupingEnabled', 'tocTitleGroupKeywords', 'tocTitleGroupRules', 'readerHistoryStackLimit', 'readerDailyGoalEnabled', 'readerDailyPagesGoal', 'readerDailyMinutesGoal', 'readerDailyChaptersGoal', 'largeBookPerformanceMode', 'readerPageCacheEnabled', 'readerPagePreheatEnabled', 'readerPageMeasureCacheLimit', 'readerFpsDiagnosticsEnabled', 'readerMemoryWarningEnabled', 'readerMemoryWarningThresholdMb', 'readerPageCacheLimit', 'readerPagePreheatRange'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.reader'));
      return;
    }
    if (groupId === 'moyu') {
      setExtendedSettings(saveExtendedSettings(
        { ...extendedSettings, moyuReaderProfile: defaultExtendedSettings.moyuReaderProfile },
        { key: 'moyuReaderProfile', keys: ['moyuReaderProfile'] },
      ));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.moyu'));
      return;
    }
    if (groupId === 'chapters') {
      setChapterRules(saveChapterRules(defaultChapterRules));
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, autoParseTocOnImport: defaultExtendedSettings.autoParseTocOnImport, autoRebuildTocWhenEmpty: defaultExtendedSettings.autoRebuildTocWhenEmpty, tocRuleChangeRebuildMode: defaultExtendedSettings.tocRuleChangeRebuildMode, previewTocRebuildDiff: defaultExtendedSettings.previewTocRebuildDiff }, { key: 'autoParseTocOnImport', keys: ['autoParseTocOnImport', 'autoRebuildTocWhenEmpty', 'tocRuleChangeRebuildMode', 'previewTocRebuildDiff'] }));
      dispatchSettingsUpdated({ key: 'chapterRules', keys: [...Object.keys(defaultChapterRules), 'autoParseTocOnImport', 'autoRebuildTocWhenEmpty', 'tocRuleChangeRebuildMode', 'previewTocRebuildDiff'], scope: 'chapterRules' });
      setSaveStatus(t('settings.defaultResetActions.groupRestored.chapters'));
      return;
    }
    if (groupId === 'library') {
      const savedAppSettings = await saveAppSettings({
        ...settings,
        trashRetentionDays: defaultAppSettings().trashRetentionDays,
        trashAutoCleanupEnabled: defaultAppSettings().trashAutoCleanupEnabled,
        trashProtectReadingProgress: defaultAppSettings().trashProtectReadingProgress,
        trashProtectReaderAssets: defaultAppSettings().trashProtectReaderAssets,
      });
      setSettings({ ...defaultAppSettings(), ...savedAppSettings });
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, defaultViewMode: defaultExtendedSettings.defaultViewMode, defaultSort: defaultExtendedSettings.defaultSort, defaultFilter: defaultExtendedSettings.defaultFilter, duplicateStrategy: defaultExtendedSettings.duplicateStrategy, defaultCoverToneStrategy: defaultExtendedSettings.defaultCoverToneStrategy, defaultCoverLabelStrategy: defaultExtendedSettings.defaultCoverLabelStrategy, cleanTitleFromFilename: defaultExtendedSettings.cleanTitleFromFilename, autoDetectAuthor: defaultExtendedSettings.autoDetectAuthor, defaultImportPath: defaultExtendedSettings.defaultImportPath, importFileFilter: defaultExtendedSettings.importFileFilter, txtImportEncodingMode: defaultExtendedSettings.txtImportEncodingMode, openImportedBookAfterImport: defaultExtendedSettings.openImportedBookAfterImport, directoryImportRecursive: defaultExtendedSettings.directoryImportRecursive, showImportSummaryAfterImport: defaultExtendedSettings.showImportSummaryAfterImport, continueDirectoryImportAfterFailure: defaultExtendedSettings.continueDirectoryImportAfterFailure, autoCleanTxtOnImport: defaultExtendedSettings.autoCleanTxtOnImport, autoBackupImportedOriginals: defaultExtendedSettings.autoBackupImportedOriginals, confirmOpenExternalPath: defaultExtendedSettings.confirmOpenExternalPath, confirmMoveToTrash: defaultExtendedSettings.confirmMoveToTrash, confirmPermanentDelete: defaultExtendedSettings.confirmPermanentDelete, confirmEmptyTrash: defaultExtendedSettings.confirmEmptyTrash, showEmptyLibraryGuide: defaultExtendedSettings.showEmptyLibraryGuide, rememberLibraryTabState: defaultExtendedSettings.rememberLibraryTabState, showLibraryDetailSidebar: defaultExtendedSettings.showLibraryDetailSidebar, libraryDensity: defaultExtendedSettings.libraryDensity }, { key: 'library', keys: ['defaultViewMode', 'defaultSort', 'defaultFilter', 'duplicateStrategy', 'defaultCoverToneStrategy', 'defaultCoverLabelStrategy', 'cleanTitleFromFilename', 'autoDetectAuthor', 'defaultImportPath', 'importFileFilter', 'txtImportEncodingMode', 'openImportedBookAfterImport', 'directoryImportRecursive', 'showImportSummaryAfterImport', 'continueDirectoryImportAfterFailure', 'autoCleanTxtOnImport', 'autoBackupImportedOriginals', 'confirmOpenExternalPath', 'confirmMoveToTrash', 'confirmPermanentDelete', 'confirmEmptyTrash', 'showEmptyLibraryGuide', 'rememberLibraryTabState', 'showLibraryDetailSidebar', 'libraryDensity'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.library'));
      return;
    }
    if (groupId === 'ai') {
      const savedAppSettings = await saveAppSettings({
        ...settings,
        aiApiKey: '',
        aiApiBaseUrl: defaultAppSettings().aiApiBaseUrl,
        aiEndpointMode: defaultAppSettings().aiEndpointMode,
        aiModel: defaultAppSettings().aiModel,
        aiRequestTimeoutSecs: defaultAppSettings().aiRequestTimeoutSecs,
        aiRetryCount: defaultAppSettings().aiRetryCount,
        aiProxyUrl: defaultAppSettings().aiProxyUrl,
        aiCustomHeaders: defaultAppSettings().aiCustomHeaders,
        aiStreamingEnabled: defaultAppSettings().aiStreamingEnabled,
        aiTemperature: defaultAppSettings().aiTemperature,
        aiMaxTokens: defaultAppSettings().aiMaxTokens,
        aiTopP: defaultAppSettings().aiTopP,
        aiReasoningEffort: defaultAppSettings().aiReasoningEffort,
        aiResponseFormat: defaultAppSettings().aiResponseFormat,
        aiActiveProviderProfileId: defaultAppSettings().aiActiveProviderProfileId,
        aiProviderProfiles: defaultAppSettings().aiProviderProfiles,
        aiCancelStrategy: defaultAppSettings().aiCancelStrategy,
      });
      setSettings({ ...defaultAppSettings(), ...savedAppSettings });
      const savedExtendedSettings = saveExtendedSettings({ ...extendedSettings, defaultAiMode: defaultExtendedSettings.defaultAiMode, aiDefaultScope: defaultExtendedSettings.aiDefaultScope, aiNoSelectionFallbackScope: defaultExtendedSettings.aiNoSelectionFallbackScope, aiScopePriorityStrategy: defaultExtendedSettings.aiScopePriorityStrategy, aiAutoDowngradeScopeOnTokenOverflow: defaultExtendedSettings.aiAutoDowngradeScopeOnTokenOverflow, aiScopeTokenLimit: defaultExtendedSettings.aiScopeTokenLimit, cloudAiRequestSizeLimitTokens: defaultExtendedSettings.cloudAiRequestSizeLimitTokens, aiCommandDefaultScopes: defaultExtendedSettings.aiCommandDefaultScopes, aiSlashMenuEnabled: defaultExtendedSettings.aiSlashMenuEnabled, aiBuiltInSlashCommandEnabled: defaultExtendedSettings.aiBuiltInSlashCommandEnabled, aiDefaultRetrievalStrategy: defaultExtendedSettings.aiDefaultRetrievalStrategy, aiRetrievalQueryRewriteMode: defaultExtendedSettings.aiRetrievalQueryRewriteMode, aiMultiStageRetrievalMode: defaultExtendedSettings.aiMultiStageRetrievalMode, aiCommandRetrievalStrategies: defaultExtendedSettings.aiCommandRetrievalStrategies, aiFallbackEnabled: defaultExtendedSettings.aiFallbackEnabled, aiFtsUnavailableBehavior: defaultExtendedSettings.aiFtsUnavailableBehavior, aiLocalIndexResultLimit: defaultExtendedSettings.aiLocalIndexResultLimit, aiCitationMinConfidence: defaultExtendedSettings.aiCitationMinConfidence, aiDefaultOutputFormat: defaultExtendedSettings.aiDefaultOutputFormat, aiRequireCitations: defaultExtendedSettings.aiRequireCitations, aiNoCitationWarningEnabled: defaultExtendedSettings.aiNoCitationWarningEnabled, aiCustomSlashCommandLimit: defaultExtendedSettings.aiCustomSlashCommandLimit, aiRecentSlashCommandLimit: defaultExtendedSettings.aiRecentSlashCommandLimit, aiSaveStructuredResponseWithNote: defaultExtendedSettings.aiSaveStructuredResponseWithNote, aiCitationDefaultSaveTarget: defaultExtendedSettings.aiCitationDefaultSaveTarget, cloudAiEnabled: defaultExtendedSettings.cloudAiEnabled, localAiEnabled: defaultExtendedSettings.localAiEnabled, cloudAiRequireConfirmation: defaultExtendedSettings.cloudAiRequireConfirmation, cloudAiAutoRedact: defaultExtendedSettings.cloudAiAutoRedact, cloudAiSensitiveWords: defaultExtendedSettings.cloudAiSensitiveWords, cloudAiAllowSelectionText: defaultExtendedSettings.cloudAiAllowSelectionText, cloudAiAllowCurrentPageText: defaultExtendedSettings.cloudAiAllowCurrentPageText, cloudAiAllowCurrentChapterText: defaultExtendedSettings.cloudAiAllowCurrentChapterText, cloudAiAllowBookSummaryContext: defaultExtendedSettings.cloudAiAllowBookSummaryContext, cloudAiRequestHistoryEnabled: defaultExtendedSettings.cloudAiRequestHistoryEnabled, cloudAiRequestHistoryLimit: defaultExtendedSettings.cloudAiRequestHistoryLimit, cloudAiRequestHistorySaveFailed: defaultExtendedSettings.cloudAiRequestHistorySaveFailed, cloudAiRequestHistorySaveStopped: defaultExtendedSettings.cloudAiRequestHistorySaveStopped, cloudAiFallbackToLocalOnFailure: defaultExtendedSettings.cloudAiFallbackToLocalOnFailure, aiHybridLocalFirstCloudSummary: defaultExtendedSettings.aiHybridLocalFirstCloudSummary, aiStreamingFlushIntervalMs: defaultExtendedSettings.aiStreamingFlushIntervalMs, localAiCancelTimeoutMs: defaultExtendedSettings.localAiCancelTimeoutMs }, { key: 'ai', keys: ['defaultAiMode', 'aiDefaultScope', 'aiNoSelectionFallbackScope', 'aiScopePriorityStrategy', 'aiAutoDowngradeScopeOnTokenOverflow', 'aiScopeTokenLimit', 'cloudAiRequestSizeLimitTokens', 'aiCommandDefaultScopes', 'aiSlashMenuEnabled', 'aiBuiltInSlashCommandEnabled', 'aiDefaultRetrievalStrategy', 'aiRetrievalQueryRewriteMode', 'aiMultiStageRetrievalMode', 'aiCommandRetrievalStrategies', 'aiFallbackEnabled', 'aiFtsUnavailableBehavior', 'aiLocalIndexResultLimit', 'aiCitationMinConfidence', 'aiDefaultOutputFormat', 'aiRequireCitations', 'aiNoCitationWarningEnabled', 'aiCustomSlashCommandLimit', 'aiRecentSlashCommandLimit', 'aiSaveStructuredResponseWithNote', 'aiCitationDefaultSaveTarget', 'cloudAiEnabled', 'localAiEnabled', 'cloudAiRequireConfirmation', 'cloudAiAutoRedact', 'cloudAiSensitiveWords', 'cloudAiAllowSelectionText', 'cloudAiAllowCurrentPageText', 'cloudAiAllowCurrentChapterText', 'cloudAiAllowBookSummaryContext', 'cloudAiRequestHistoryEnabled', 'cloudAiRequestHistoryLimit', 'cloudAiRequestHistorySaveFailed', 'cloudAiRequestHistorySaveStopped', 'cloudAiFallbackToLocalOnFailure', 'aiHybridLocalFirstCloudSummary', 'aiStreamingFlushIntervalMs', 'localAiCancelTimeoutMs'] });
      setExtendedSettings(saveExtendedSettings({ ...savedExtendedSettings, aiCitationCoverageVisible: defaultExtendedSettings.aiCitationCoverageVisible, aiCitationCardDefaultDensity: defaultExtendedSettings.aiCitationCardDefaultDensity, aiExternalCitationsDisabled: defaultExtendedSettings.aiExternalCitationsDisabled, aiCitationJumpRepairEnabled: defaultExtendedSettings.aiCitationJumpRepairEnabled, aiCitationFieldStrictness: defaultExtendedSettings.aiCitationFieldStrictness, aiToolCallDisplayMode: defaultExtendedSettings.aiToolCallDisplayMode, aiRenderedBlockLimit: defaultExtendedSettings.aiRenderedBlockLimit, sidecarEnabled: defaultExtendedSettings.sidecarEnabled, sidecarCommand: defaultExtendedSettings.sidecarCommand, sidecarWorkingDir: defaultExtendedSettings.sidecarWorkingDir, sidecarHealthTimeoutMs: defaultExtendedSettings.sidecarHealthTimeoutMs, sidecarMaxMemoryMb: defaultExtendedSettings.sidecarMaxMemoryMb }, { key: 'ai', keys: ['aiCitationCoverageVisible', 'aiCitationCardDefaultDensity', 'aiExternalCitationsDisabled', 'aiCitationJumpRepairEnabled', 'aiCitationFieldStrictness', 'aiToolCallDisplayMode', 'aiRenderedBlockLimit', 'sidecarEnabled', 'sidecarCommand', 'sidecarWorkingDir', 'sidecarHealthTimeoutMs', 'sidecarMaxMemoryMb'] }));
      setAiTestStatus(null);
      setAiModels([]);
      setSaveStatus(t('settings.defaultResetActions.groupRestored.ai'));
      return;
    }
    if (groupId === 'translation') {
      const defaults = defaultAppSettings();
      const savedAppSettings = await saveAppSettings({
        ...settings,
        translationActiveSourceId: defaults.translationActiveSourceId,
        translationSources: defaults.translationSources,
        translationSourceLanguage: defaults.translationSourceLanguage,
        translationTargetLanguage: defaults.translationTargetLanguage,
      });
      setSettings({ ...defaultAppSettings(), ...savedAppSettings });
      setSaveStatus(t('settings.defaultResetActions.groupRestored.translation'));
      return;
    }
    if (groupId === 'search') {
      setExtendedSettings(saveExtendedSettings({
        ...extendedSettings,
        searchScope: defaultExtendedSettings.searchScope,
        searchLimit: defaultExtendedSettings.searchLimit,
        globalSearchMode: defaultExtendedSettings.globalSearchMode,
        globalSearchDebounceMs: defaultExtendedSettings.globalSearchDebounceMs,
        globalSearchSnippetLength: defaultExtendedSettings.globalSearchSnippetLength,
        globalSearchShowScore: defaultExtendedSettings.globalSearchShowScore,
        globalSearchHistoryLimit: defaultExtendedSettings.globalSearchHistoryLimit,
        globalSearchSavedLimit: defaultExtendedSettings.globalSearchSavedLimit,
        caseSensitive: defaultExtendedSettings.caseSensitive,
        fuzzy: defaultExtendedSettings.fuzzy,
        regex: defaultExtendedSettings.regex,
        readerSearchRegexFallbackLiteral: defaultExtendedSettings.readerSearchRegexFallbackLiteral,
        searchNormalizeTraditionalChinese: defaultExtendedSettings.searchNormalizeTraditionalChinese,
        searchNormalizeNfkc: defaultExtendedSettings.searchNormalizeNfkc,
        searchPinyinInitials: defaultExtendedSettings.searchPinyinInitials,
        autoIndexImportedBooks: defaultExtendedSettings.autoIndexImportedBooks,
        indexStrategyVersion: defaultExtendedSettings.indexStrategyVersion,
        indexChunkSize: defaultExtendedSettings.indexChunkSize,
        indexChunkOverlap: defaultExtendedSettings.indexChunkOverlap,
        indexRebuildStrategy: defaultExtendedSettings.indexRebuildStrategy,
        ftsRepairStrategy: defaultExtendedSettings.ftsRepairStrategy,
        indexRecentErrorLimit: defaultExtendedSettings.indexRecentErrorLimit,
        indexPauseResumeStrategy: defaultExtendedSettings.indexPauseResumeStrategy,
        parseConcurrency: defaultExtendedSettings.parseConcurrency,
        readerSearchHistoryLimit: defaultExtendedSettings.readerSearchHistoryLimit,
        readerSavedSearchLimit: defaultExtendedSettings.readerSavedSearchLimit,
        readerSearchChapterFilterDefault: defaultExtendedSettings.readerSearchChapterFilterDefault,
        readerSearchHighlightColor: defaultExtendedSettings.readerSearchHighlightColor,
      }, {
        key: 'search',
        keys: [
          'searchScope',
          'searchLimit',
          'globalSearchMode',
          'globalSearchDebounceMs',
          'globalSearchSnippetLength',
          'globalSearchShowScore',
          'globalSearchHistoryLimit',
          'globalSearchSavedLimit',
          'caseSensitive',
          'fuzzy',
          'regex',
          'readerSearchRegexFallbackLiteral',
          'searchNormalizeTraditionalChinese',
          'searchNormalizeNfkc',
          'searchPinyinInitials',
          'autoIndexImportedBooks',
          'indexStrategyVersion',
          'indexChunkSize',
          'indexChunkOverlap',
          'indexRebuildStrategy',
          'ftsRepairStrategy',
          'indexRecentErrorLimit',
          'indexPauseResumeStrategy',
          'parseConcurrency',
          'readerSearchHistoryLimit',
          'readerSavedSearchLimit',
          'readerSearchChapterFilterDefault',
          'readerSearchHighlightColor',
        ],
      }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.search'));
      return;
    }
    if (groupId === 'annotations') {
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, defaultHighlightColor: defaultExtendedSettings.defaultHighlightColor, highlightColorShortcuts: defaultExtendedSettings.highlightColorShortcuts, highlightColorMeanings: defaultExtendedSettings.highlightColorMeanings, defaultHighlightImportance: defaultExtendedSettings.defaultHighlightImportance, defaultHighlightReviewStatus: defaultExtendedSettings.defaultHighlightReviewStatus, highlightOverlapStrategy: defaultExtendedSettings.highlightOverlapStrategy, anchorRepairStrategy: defaultExtendedSettings.anchorRepairStrategy, defaultExportFormat: defaultExtendedSettings.defaultExportFormat, annotationExportContent: defaultExtendedSettings.annotationExportContent, annotationJsonImportConflictStrategy: defaultExtendedSettings.annotationJsonImportConflictStrategy, annotationMarkdownTemplate: defaultExtendedSettings.annotationMarkdownTemplate, annotationExportLastDirectory: defaultExtendedSettings.annotationExportLastDirectory, annotationCsvFields: defaultExtendedSettings.annotationCsvFields, ankiDefaultTags: defaultExtendedSettings.ankiDefaultTags, obsidianWikiLinks: defaultExtendedSettings.obsidianWikiLinks, logseqPropertyFormat: defaultExtendedSettings.logseqPropertyFormat, readwiseDefaultAuthor: defaultExtendedSettings.readwiseDefaultAuthor, annotationTagSuggestionsEnabled: defaultExtendedSettings.annotationTagSuggestionsEnabled, annotationMarkdownEditorEnabled: defaultExtendedSettings.annotationMarkdownEditorEnabled, knowledgeMarkdownExportIncludeAiMetadata: defaultExtendedSettings.knowledgeMarkdownExportIncludeAiMetadata, knowledgeMarkdownExportIncludeStructuredResponse: defaultExtendedSettings.knowledgeMarkdownExportIncludeStructuredResponse, knowledgeMarkdownExportPath: defaultExtendedSettings.knowledgeMarkdownExportPath, knowledgeDefaultColumns: defaultExtendedSettings.knowledgeDefaultColumns, knowledgeBidirectionalLinksEnabled: defaultExtendedSettings.knowledgeBidirectionalLinksEnabled, knowledgeHighlightCardTemplate: defaultExtendedSettings.knowledgeHighlightCardTemplate, knowledgeNoteCardTemplate: defaultExtendedSettings.knowledgeNoteCardTemplate, knowledgeFlashcardCardTemplate: defaultExtendedSettings.knowledgeFlashcardCardTemplate, highlightFlashcardGenerationEnabled: defaultExtendedSettings.highlightFlashcardGenerationEnabled, highlightFlashcardDefaultTags: defaultExtendedSettings.highlightFlashcardDefaultTags, highlightFlashcardDefaultReviewStatus: defaultExtendedSettings.highlightFlashcardDefaultReviewStatus, highlightFlashcardFrontTemplate: defaultExtendedSettings.highlightFlashcardFrontTemplate, highlightFlashcardBackTemplate: defaultExtendedSettings.highlightFlashcardBackTemplate, selectionMenuEnabled: defaultExtendedSettings.selectionMenuEnabled, openNoteAfterHighlight: defaultExtendedSettings.openNoteAfterHighlight, allowEmptyNotes: defaultExtendedSettings.allowEmptyNotes, noteDefaultSaveTarget: defaultExtendedSettings.noteDefaultSaveTarget, noteAutoReaderLocation: defaultExtendedSettings.noteAutoReaderLocation, noteAutoContext: defaultExtendedSettings.noteAutoContext, noteTemplate: defaultExtendedSettings.noteTemplate, defaultBookmarkSort: defaultExtendedSettings.defaultBookmarkSort, defaultBookmarkGroupBy: defaultExtendedSettings.defaultBookmarkGroupBy, defaultBookmarkTags: defaultExtendedSettings.defaultBookmarkTags, defaultBookmarkColor: defaultExtendedSettings.defaultBookmarkColor, bookmarkTitleFromChapter: defaultExtendedSettings.bookmarkTitleFromChapter }, { key: 'annotations', keys: ['defaultHighlightColor', 'highlightColorShortcuts', 'highlightColorMeanings', 'defaultHighlightImportance', 'defaultHighlightReviewStatus', 'highlightOverlapStrategy', 'anchorRepairStrategy', 'defaultExportFormat', 'annotationExportContent', 'annotationJsonImportConflictStrategy', 'annotationMarkdownTemplate', 'annotationExportLastDirectory', 'annotationCsvFields', 'ankiDefaultTags', 'obsidianWikiLinks', 'logseqPropertyFormat', 'readwiseDefaultAuthor', 'annotationTagSuggestionsEnabled', 'annotationMarkdownEditorEnabled', 'knowledgeMarkdownExportIncludeAiMetadata', 'knowledgeMarkdownExportIncludeStructuredResponse', 'knowledgeMarkdownExportPath', 'knowledgeDefaultColumns', 'knowledgeBidirectionalLinksEnabled', 'knowledgeHighlightCardTemplate', 'knowledgeNoteCardTemplate', 'knowledgeFlashcardCardTemplate', 'highlightFlashcardGenerationEnabled', 'highlightFlashcardDefaultTags', 'highlightFlashcardDefaultReviewStatus', 'highlightFlashcardFrontTemplate', 'highlightFlashcardBackTemplate', 'selectionMenuEnabled', 'openNoteAfterHighlight', 'allowEmptyNotes', 'noteDefaultSaveTarget', 'noteAutoReaderLocation', 'noteAutoContext', 'noteTemplate', 'defaultBookmarkSort', 'defaultBookmarkGroupBy', 'defaultBookmarkTags', 'defaultBookmarkColor', 'bookmarkTitleFromChapter'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.annotations'));
      return;
    }
    if (groupId === 'data') {
      setReaderGlobalSettings(saveGlobalReaderSettings({ ...readerGlobalSettings, privacyMode: defaultReaderSettings.privacyMode, encryptSensitiveReaderData: defaultReaderSettings.encryptSensitiveReaderData }));
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, applicationPrivacyMode: defaultExtendedSettings.applicationPrivacyMode, hideRecentReadingInPrivacyMode: defaultExtendedSettings.hideRecentReadingInPrivacyMode, hideFilePathsInPrivacyMode: defaultExtendedSettings.hideFilePathsInPrivacyMode, hideBookTitlesInPrivacyMode: defaultExtendedSettings.hideBookTitlesInPrivacyMode, appLockEnabled: defaultExtendedSettings.appLockEnabled, appLockIdleTimeoutMinutes: defaultExtendedSettings.appLockIdleTimeoutMinutes, copyDiagnosticsAutoRedact: defaultExtendedSettings.copyDiagnosticsAutoRedact, operationLogRecordInputContent: defaultExtendedSettings.operationLogRecordInputContent, operationLogRecordPaths: defaultExtendedSettings.operationLogRecordPaths, recordRecentReaderBooks: defaultExtendedSettings.recordRecentReaderBooks, trackReadingTime: defaultExtendedSettings.trackReadingTime, dataAutoBackupEnabled: defaultExtendedSettings.dataAutoBackupEnabled, dataAutoBackupFrequency: defaultExtendedSettings.dataAutoBackupFrequency, dataAutoBackupRetentionLimit: defaultExtendedSettings.dataAutoBackupRetentionLimit, dataBackupMode: defaultExtendedSettings.dataBackupMode }, { key: 'data', keys: ['applicationPrivacyMode', 'hideRecentReadingInPrivacyMode', 'hideFilePathsInPrivacyMode', 'hideBookTitlesInPrivacyMode', 'appLockEnabled', 'appLockIdleTimeoutMinutes', 'copyDiagnosticsAutoRedact', 'operationLogRecordInputContent', 'operationLogRecordPaths', 'recordRecentReaderBooks', 'trackReadingTime', 'dataAutoBackupEnabled', 'dataAutoBackupFrequency', 'dataAutoBackupRetentionLimit', 'dataBackupMode'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.data'));
      return;
    }
    if (groupId === 'tasks') {
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, taskConcurrency: defaultExtendedSettings.taskConcurrency, importConcurrency: defaultExtendedSettings.importConcurrency, parseConcurrency: defaultExtendedSettings.parseConcurrency, ftsWriteSerial: defaultExtendedSettings.ftsWriteSerial, vectorConcurrencyReserved: defaultExtendedSettings.vectorConcurrencyReserved, taskRetryCount: defaultExtendedSettings.taskRetryCount, checkUnfinishedTasksOnStartup: defaultExtendedSettings.checkUnfinishedTasksOnStartup, backgroundTaskNotificationMode: defaultExtendedSettings.backgroundTaskNotificationMode, refreshLibraryOnTaskCompletion: defaultExtendedSettings.refreshLibraryOnTaskCompletion, taskAutoRunQueuedWhenIdle: defaultExtendedSettings.taskAutoRunQueuedWhenIdle, taskCenterDefaultStatusFilter: defaultExtendedSettings.taskCenterDefaultStatusFilter, autoShowTaskCenterForLongOperations: defaultExtendedSettings.autoShowTaskCenterForLongOperations, errorDetailsDefaultExpanded: defaultExtendedSettings.errorDetailsDefaultExpanded, largeBookPerformanceMode: defaultExtendedSettings.largeBookPerformanceMode, virtualChapterRadius: defaultExtendedSettings.virtualChapterRadius, virtualParagraphWindowSize: defaultExtendedSettings.virtualParagraphWindowSize }, { key: 'tasks', keys: ['taskConcurrency', 'importConcurrency', 'parseConcurrency', 'ftsWriteSerial', 'vectorConcurrencyReserved', 'taskRetryCount', 'checkUnfinishedTasksOnStartup', 'backgroundTaskNotificationMode', 'refreshLibraryOnTaskCompletion', 'taskAutoRunQueuedWhenIdle', 'taskCenterDefaultStatusFilter', 'autoShowTaskCenterForLongOperations', 'errorDetailsDefaultExpanded', 'largeBookPerformanceMode', 'virtualChapterRadius', 'virtualParagraphWindowSize'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.tasks'));
      return;
    }
    if (groupId === 'shortcuts') {
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, globalShortcutsEnabled: defaultExtendedSettings.globalShortcutsEnabled, commandPaletteIncludesSettings: defaultExtendedSettings.commandPaletteIncludesSettings, commandPaletteShortcut: defaultExtendedSettings.commandPaletteShortcut, commandPaletteShowDescriptions: defaultExtendedSettings.commandPaletteShowDescriptions, commandPaletteSortMode: defaultExtendedSettings.commandPaletteSortMode, navigationShortcuts: defaultExtendedSettings.navigationShortcuts, importShortcut: defaultExtendedSettings.importShortcut, aiSummaryShortcut: defaultExtendedSettings.aiSummaryShortcut, readerShortcuts: defaultExtendedSettings.readerShortcuts, contextMenuEnabled: defaultExtendedSettings.contextMenuEnabled, arrowKeyPaging: defaultExtendedSettings.arrowKeyPaging, spaceKeyPaging: defaultExtendedSettings.spaceKeyPaging, escapeClosesPanels: defaultExtendedSettings.escapeClosesPanels, homeEndJump: defaultExtendedSettings.homeEndJump, vimStyleNavigation: defaultExtendedSettings.vimStyleNavigation, doubleClickWordSelectionEnabled: defaultExtendedSettings.doubleClickWordSelectionEnabled, pageClickPaging: defaultExtendedSettings.pageClickPaging, gesturePagingEnabled: defaultExtendedSettings.gesturePagingEnabled, gesturePagingThresholdPx: defaultExtendedSettings.gesturePagingThresholdPx, autoHideCursor: defaultExtendedSettings.autoHideCursor, pageTurnSound: defaultExtendedSettings.pageTurnSound }, { key: 'shortcuts', keys: ['globalShortcutsEnabled', 'commandPaletteIncludesSettings', 'commandPaletteShortcut', 'commandPaletteShowDescriptions', 'commandPaletteSortMode', 'navigationShortcuts', 'importShortcut', 'aiSummaryShortcut', 'readerShortcuts', 'contextMenuEnabled', 'arrowKeyPaging', 'spaceKeyPaging', 'escapeClosesPanels', 'homeEndJump', 'vimStyleNavigation', 'doubleClickWordSelectionEnabled', 'pageClickPaging', 'gesturePagingEnabled', 'gesturePagingThresholdPx', 'autoHideCursor', 'pageTurnSound'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.shortcuts'));
      return;
    }
    if (groupId === 'accessibility') {
      setLocalePreference('zh-CN');
      setExtendedSettings(saveExtendedSettings({ ...extendedSettings, translationFallbackStrategy: defaultExtendedSettings.translationFallbackStrategy, customTerminologyEnabled: defaultExtendedSettings.customTerminologyEnabled, customTerminologyRules: defaultExtendedSettings.customTerminologyRules, reduceMotion: defaultExtendedSettings.reduceMotion, highContrast: defaultExtendedSettings.highContrast, enhancedFocus: defaultExtendedSettings.enhancedFocus, largeTouchTargets: defaultExtendedSettings.largeTouchTargets, colorBlindFriendlyHighlights: defaultExtendedSettings.colorBlindFriendlyHighlights, readerReadAloudEnabled: defaultExtendedSettings.readerReadAloudEnabled, readerReadAloudRate: defaultExtendedSettings.readerReadAloudRate, readerReadAloudPitch: defaultExtendedSettings.readerReadAloudPitch }, { key: 'accessibility', keys: ['translationFallbackStrategy', 'customTerminologyEnabled', 'customTerminologyRules', 'reduceMotion', 'highContrast', 'enhancedFocus', 'largeTouchTargets', 'colorBlindFriendlyHighlights', 'readerReadAloudEnabled', 'readerReadAloudRate', 'readerReadAloudPitch'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.accessibility'));
      return;
    }
    if (groupId === 'diagnostics') {
      const savedAppSettings = await saveAppSettings({ ...settings, operationLogLevel: defaultAppSettings().operationLogLevel });
      setSettings({ ...defaultAppSettings(), ...savedAppSettings });
      setOperationLogLevel(savedAppSettings.operationLogLevel ?? 'none');
      setExtendedSettings(saveExtendedSettings({
        ...extendedSettings,
        operationLogRetention: defaultExtendedSettings.operationLogRetention,
        taskLogRetention: defaultExtendedSettings.taskLogRetention,
        experimentalAiToolCallingEnabled: defaultExtendedSettings.experimentalAiToolCallingEnabled,
        experimentalEpubPdfEnabled: defaultExtendedSettings.experimentalEpubPdfEnabled,
        experimentalMultiWindowConflictResolutionEnabled: defaultExtendedSettings.experimentalMultiWindowConflictResolutionEnabled,
        experimentalKnowledgeGraphEnabled: defaultExtendedSettings.experimentalKnowledgeGraphEnabled,
        experimentalSyncEnabled: defaultExtendedSettings.experimentalSyncEnabled,
      }, { key: 'diagnostics', keys: ['operationLogRetention', 'taskLogRetention', 'experimentalAiToolCallingEnabled', 'experimentalEpubPdfEnabled', 'experimentalMultiWindowConflictResolutionEnabled', 'experimentalKnowledgeGraphEnabled', 'experimentalSyncEnabled'] }));
      setSaveStatus(t('settings.defaultResetActions.groupRestored.diagnostics'));
      return;
    }
    setSaveStatus(t('settings.defaultResetActions.noPersistedSettings'));
  }

  return {
    restoreReaderGlobalDefaults,
    restoreAllSettingsDefaults,
    restoreGroupDefaults,
  };
}

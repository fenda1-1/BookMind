import { useMemo } from 'react';
import { buildReaderChapterDiagnostics, cleanTxtContent } from '../features/reader-core/readerModel';
import { buildCloudRedactionPreview } from '../services/cloudAiPrivacy';
import { buildAiInteractionStaticSelectOptions, buildAiModeSelectOptions, buildAiProviderStaticSelectOptions, buildAnnotationKnowledgeStaticSelectOptions, buildChapterStaticSelectOptions, buildLibraryImportStaticSelectOptions, buildNavigationShortcutStaticSelectOptions, buildReaderStaticSelectOptions, buildRetentionSelectOptions, buildSearchIndexStaticSelectOptions, buildSearchStaticSelectOptions, buildSettingsGroups, normalizeSettingsSearchText, resolveAvailableAiModeOptions, resolveSettingsVisibleGroups, type SettingsGroupId } from '../features/settings-center/settingsCenterModel';
import { normalizeAiProviderProfilesForUi } from '../features/settings-center/settingsCenterAiProviderModel';
import { buildChapterParsingOptions, createChapterDiagnosticsSampleBook } from '../features/settings-center/settingsCenterChapterDiagnosticsModel';
import { buildSettingsPerformanceTuningProfile } from '../features/settings-center/settingsCenterPerformanceModel';
import { getShortcutConflictMessages } from '../features/settings-center/settingsCenterShortcutModel';
import { getPrivacyFilePath, type AiApiKeyStorageStatus, type ChapterRuleDraft, type ExtendedSettings, type LocalEncryptionStatus } from '../services/settingsCenterService';
import type { LocalePreference, Translator } from '../i18n';
import type { AppPage, AppSettings, OperationLogLevel, ReaderAlign, ReaderAnimation, ReaderCjkPunctuationHanging, ReaderFontWeightBoost, ReaderHeaderFooterProgressFormat, ReaderHeaderFooterTimeFormat, ReaderInfoSlot, ReaderLayoutMode, ReaderLongParagraphStrategy, ReaderMixedTextSpacing, ReaderPageMode, ReaderPageVerticalAlign, ReaderPreset, ReaderSettings, ReaderTheme, ReaderTitleDecoration, ReaderTitleNumberCleanup } from '../types';

type OperationLogEntry = {
  at: string;
  level: Exclude<OperationLogLevel, 'none'>;
  action: string;
  detail?: Record<string, unknown>;
};

export function useSettingsPageOptions({
  t,
  localePreference,
  diagnosticPaths,
  localEncryptionStatus,
  aiApiKeyStorageStatus,
  settings,
  extendedSettings,
  readerGlobalSettings,
  chapterRules,
  txtCleanupPreviewInput,
  chapterDiagnosticsSampleInput,
  operationLogs,
  operationLogFilterLevel,
  operationLogFilterQuery,
  aiModels,
  cloudRedactionPreviewInput,
  settingsQuery,
  activeGroup,
}: {
  t: Translator;
  localePreference: LocalePreference;
  diagnosticPaths: { dataDir: string; settingsFile: string; ftsDatabase: string };
  localEncryptionStatus: LocalEncryptionStatus | null;
  aiApiKeyStorageStatus: AiApiKeyStorageStatus | null;
  settings: AppSettings;
  extendedSettings: ExtendedSettings;
  readerGlobalSettings: ReaderSettings;
  chapterRules: ChapterRuleDraft;
  txtCleanupPreviewInput: string;
  chapterDiagnosticsSampleInput: string;
  operationLogs: OperationLogEntry[];
  operationLogFilterLevel: 'all' | Exclude<OperationLogLevel, 'none'>;
  operationLogFilterQuery: string;
  aiModels: string[];
  cloudRedactionPreviewInput: string;
  settingsQuery: string;
  activeGroup: SettingsGroupId;
}) {
  const privacyDiagnosticPaths = useMemo(() => ({
    dataDir: getPrivacyFilePath(diagnosticPaths.dataDir, extendedSettings),
    settingsFile: getPrivacyFilePath(diagnosticPaths.settingsFile, extendedSettings),
    ftsDatabase: getPrivacyFilePath(diagnosticPaths.ftsDatabase, extendedSettings),
  }), [diagnosticPaths, extendedSettings.applicationPrivacyMode, extendedSettings.hideFilePathsInPrivacyMode]);
  const privacyLocalEncryptionFallbackPath = useMemo(() => (
    localEncryptionStatus ? getPrivacyFilePath(localEncryptionStatus.fallbackFilePath, extendedSettings) : ''
  ), [localEncryptionStatus, extendedSettings.applicationPrivacyMode, extendedSettings.hideFilePathsInPrivacyMode]);
  const privacyAiApiKeyFallbackPath = useMemo(() => (
    aiApiKeyStorageStatus ? getPrivacyFilePath(aiApiKeyStorageStatus.fallbackFilePath, extendedSettings) : ''
  ), [aiApiKeyStorageStatus, extendedSettings.applicationPrivacyMode, extendedSettings.hideFilePathsInPrivacyMode]);
  const localeOptions: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t('locale.system') },
    { value: 'zh-CN', label: t('locale.zhCN') },
    { value: 'en-US', label: t('locale.enUS') },
    { value: 'ja-JP', label: t('locale.jaJP') },
    { value: 'es-ES', label: t('locale.esES') },
    { value: 'fr-FR', label: t('locale.frFR') },
    { value: 'ko-KR', label: t('locale.koKR') },
  ];
  const translationFallbackOptions: Array<{ value: ExtendedSettings['translationFallbackStrategy']; label: string }> = [
    { value: 'default-locale', label: t('settings.options.page.translationFallback.defaultLocale') },
    { value: 'key', label: t('settings.options.page.translationFallback.key') },
  ];
  const settingsGroups = useMemo(() => buildSettingsGroups(t), [t]);
  const retentionSelectOptions = buildRetentionSelectOptions(t);
  const operationLogFilterLevelOptions: Array<{ value: 'all' | Exclude<OperationLogLevel, 'none'>; label: string }> = [
    { value: 'all', label: t('settings.options.page.operationLogFilter.all') },
    { value: 'error', label: t('settings.logs.level.error') },
    { value: 'basic', label: t('settings.logs.level.basic') },
    { value: 'debug', label: t('settings.logs.level.debug') },
  ];
  const readerPresetOptions: { value: ReaderPreset; label: string }[] = [
    { value: 'custom', label: t('reader.preset.custom') },
    { value: 'novel', label: t('reader.preset.novel') },
    { value: 'paper', label: t('reader.preset.paper') },
    { value: 'eyeComfort', label: t('reader.preset.eyeComfort') },
    { value: 'compact', label: t('reader.preset.compact') },
    { value: 'spacious', label: t('reader.preset.spacious') },
    { value: 'eInk', label: t('reader.preset.eInk') },
  ];
  const readerThemeOptions: { value: ReaderTheme; label: string }[] = [
    { value: 'white', label: t('reader.theme.white') },
    { value: 'paper', label: t('reader.theme.paper') },
    { value: 'eyeComfort', label: t('reader.theme.eyeComfort') },
    { value: 'dark', label: t('reader.theme.dark') },
    { value: 'oled', label: t('reader.theme.oled') },
    { value: 'system', label: t('reader.theme.system') },
  ];
  const readerLayoutOptions: { value: ReaderLayoutMode; label: string }[] = [
    { value: 'page', label: t('reader.layout.page') },
    { value: 'flow', label: t('reader.layout.flow') },
  ];
  const readerPageModeOptions: { value: ReaderPageMode; label: string }[] = [
    { value: 'single', label: t('reader.pageMode.single') },
    { value: 'double', label: t('reader.pageMode.double') },
  ];
  const readerStaticSelectOptions = buildReaderStaticSelectOptions(t);
  const readerPageVerticalAlignOptions: Array<{ value: ReaderPageVerticalAlign; label: string }> = readerStaticSelectOptions.pageVerticalAlign;
  const readerLongParagraphStrategyOptions: Array<{ value: ReaderLongParagraphStrategy; label: string }> = readerStaticSelectOptions.longParagraphStrategy;
  const readerCjkPunctuationOptions: Array<{ value: ReaderCjkPunctuationHanging; label: string }> = readerStaticSelectOptions.cjkPunctuation;
  const readerMixedTextSpacingOptions: Array<{ value: ReaderMixedTextSpacing; label: string }> = readerStaticSelectOptions.mixedTextSpacing;
  const readerFontWeightBoostOptions: Array<{ value: ReaderFontWeightBoost; label: string }> = readerStaticSelectOptions.fontWeightBoost;
  const chapterStaticSelectOptions = buildChapterStaticSelectOptions(t);
  const bookTitleBracketModeOptions: Array<{ value: ChapterRuleDraft['bookTitleBracketMode']; label: string }> = chapterStaticSelectOptions.bookTitleBracketMode;
  const paragraphModeOptions: Array<{ value: ChapterRuleDraft['paragraphMode']; label: string }> = chapterStaticSelectOptions.paragraphMode;
  const tocRuleChangeRebuildModeOptions: Array<{ value: ExtendedSettings['tocRuleChangeRebuildMode']; label: string }> = chapterStaticSelectOptions.tocRuleChangeRebuildMode;
  const fontRenderingDiagnostics = useMemo(() => {
    const supports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      ? {
        hangingPunctuation: CSS.supports('hanging-punctuation', 'first allow-end last'),
        textAutospace: CSS.supports('text-autospace', 'normal'),
        textSpacingTrim: CSS.supports('text-spacing-trim', 'trim-start'),
        textStroke: CSS.supports('-webkit-text-stroke', '0.01em currentColor'),
      }
      : { hangingPunctuation: false, textAutospace: false, textSpacingTrim: false, textStroke: false };
    return {
      primaryFont: readerGlobalSettings.customFontFamily || readerGlobalSettings.fontFamily.split(',')[0]?.trim() || t('settings.options.page.font.default'),
      fallbackCount: readerGlobalSettings.fontFallbacks.length,
      fontFamily: readerGlobalSettings.fontFamily,
      fontWeightBoost: readerGlobalSettings.fontWeightBoost,
      cjkPunctuationHanging: readerGlobalSettings.cjkPunctuationHanging,
      mixedTextSpacing: readerGlobalSettings.mixedTextSpacing,
      supports,
    };
  }, [readerGlobalSettings]);
  const chapterParsingOptions = useMemo(() => buildChapterParsingOptions(chapterRules), [chapterRules]);
  const chapterDiagnosticsAdKeywords = useMemo(() => chapterRules.adKeywords.split(/[\uFF0C,\n]/).map((keyword) => keyword.trim()).filter(Boolean), [chapterRules.adKeywords]);
  const txtCleanupPreviewOutput = useMemo(() => cleanTxtContent(txtCleanupPreviewInput, {
    removeAds: chapterRules.removeAds,
    adKeywords: chapterDiagnosticsAdKeywords,
    removeAdUrls: chapterRules.removeAdUrls,
    removePaginationNoise: chapterRules.removePaginationNoise,
    normalizeBlankLines: chapterRules.normalizeBlankLines,
    trimTrailingWhitespace: chapterRules.trimTrailingWhitespace,
    normalizeFullWidthSpaces: chapterRules.normalizeFullWidthSpaces,
    customCleanupRules: chapterRules.customCleanupRules,
  }), [txtCleanupPreviewInput, chapterRules.removeAds, chapterDiagnosticsAdKeywords, chapterRules.removeAdUrls, chapterRules.removePaginationNoise, chapterRules.normalizeBlankLines, chapterRules.trimTrailingWhitespace, chapterRules.normalizeFullWidthSpaces, chapterRules.customCleanupRules]);
  const chapterDiagnosticsCleanedContent = useMemo(() => cleanTxtContent(chapterDiagnosticsSampleInput, {
    removeAds: chapterRules.removeAds,
    adKeywords: chapterDiagnosticsAdKeywords,
    removeAdUrls: chapterRules.removeAdUrls,
    removePaginationNoise: chapterRules.removePaginationNoise,
    normalizeBlankLines: chapterRules.normalizeBlankLines,
    trimTrailingWhitespace: chapterRules.trimTrailingWhitespace,
    normalizeFullWidthSpaces: chapterRules.normalizeFullWidthSpaces,
    customCleanupRules: chapterRules.customCleanupRules,
  }), [chapterDiagnosticsSampleInput, chapterRules.removeAds, chapterDiagnosticsAdKeywords, chapterRules.removeAdUrls, chapterRules.removePaginationNoise, chapterRules.normalizeBlankLines, chapterRules.trimTrailingWhitespace, chapterRules.normalizeFullWidthSpaces, chapterRules.customCleanupRules]);
  const filteredOperationLogs = useMemo(() => {
    const normalizedQuery = operationLogFilterQuery.trim().toLowerCase();
    return operationLogs.filter((entry) => {
      if (operationLogFilterLevel !== 'all' && entry.level !== operationLogFilterLevel) return false;
      if (!normalizedQuery) return true;
      return [
        entry.at,
        entry.level,
        entry.action,
        entry.detail ? JSON.stringify(entry.detail) : '',
      ].join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [operationLogs, operationLogFilterLevel, operationLogFilterQuery]);
  const chapterParseDiagnostics = useMemo(() => buildReaderChapterDiagnostics(createChapterDiagnosticsSampleBook(chapterDiagnosticsCleanedContent), chapterParsingOptions, {
    sampleLimit: 8,
    shortChapterCharacterThreshold: 120,
    longChapterCharacterThreshold: 20000,
  }), [chapterDiagnosticsCleanedContent, chapterParsingOptions]);
  const readerAlignOptions: { value: ReaderAlign; label: string }[] = [
    { value: 'left', label: t('settings.options.page.readerAlign.left') },
    { value: 'center', label: t('settings.options.page.readerAlign.center') },
    { value: 'right', label: t('settings.options.page.readerAlign.right') },
    { value: 'hidden', label: t('settings.options.page.readerAlign.hidden') },
  ];
  const readerTitleNumberCleanupOptions: { value: ReaderTitleNumberCleanup; label: string }[] = [
    { value: 'keep', label: t('settings.options.page.titleNumberCleanup.keep') },
    { value: 'strip-number', label: t('settings.options.page.titleNumberCleanup.stripNumber') },
  ];
  const readerTitleDecorationOptions: { value: ReaderTitleDecoration; label: string }[] = [
    { value: 'off', label: t('settings.options.page.titleDecoration.off') },
    { value: 'line', label: t('settings.options.page.titleDecoration.line') },
  ];
  const readerHeaderFooterTimeFormatOptions: { value: ReaderHeaderFooterTimeFormat; label: string }[] = [
    { value: 'short-24h', label: t('settings.options.page.timeFormat.short24h') },
    { value: 'short-12h', label: t('settings.options.page.timeFormat.short12h') },
    { value: 'date-time', label: t('settings.options.page.timeFormat.dateTime') },
  ];
  const readerHeaderFooterProgressFormatOptions: { value: ReaderHeaderFooterProgressFormat; label: string }[] = [
    { value: 'percent', label: t('settings.options.page.progressFormat.percent') },
    { value: 'current-page', label: t('settings.options.page.progressFormat.currentPage') },
    { value: 'chapter-page', label: t('settings.options.page.progressFormat.chapterPage') },
    { value: 'total-pages', label: t('settings.options.page.progressFormat.totalPages') },
  ];
  const readerInfoSlotOptions: { value: ReaderInfoSlot; label: string }[] = [
    { value: 'none', label: t('reader.slot.none') },
    { value: 'title', label: t('reader.slot.title') },
    { value: 'chapter', label: t('reader.slot.chapter') },
    { value: 'progress', label: t('reader.slot.progress') },
    { value: 'page', label: t('reader.slot.page') },
    { value: 'time', label: t('reader.slot.time') },
    { value: 'custom', label: t('reader.slot.custom') },
  ];
  const readerAnimationOptions: { value: ReaderAnimation; label: string }[] = [
    { value: 'none', label: t('reader.animation.none') },
    { value: 'fade', label: t('reader.animation.fade') },
    { value: 'slide', label: t('reader.animation.slide') },
    { value: 'lift', label: t('reader.animation.lift') },
    { value: 'turn', label: t('reader.animation.turn') },
    { value: 'zoom', label: t('reader.animation.zoom') },
  ];
  const aiProviderStaticSelectOptions = buildAiProviderStaticSelectOptions(t);
  const aiEndpointOptions = aiProviderStaticSelectOptions.endpoint.map((option) => ({
    ...option,
    label: option.value === 'responses' ? t('settings.ai.endpoint.responses') : t('settings.ai.endpoint.chatCompletions'),
  }));
  const aiProviderKindOptions = aiProviderStaticSelectOptions.providerKind;
  const aiCancelStrategyOptions = aiProviderStaticSelectOptions.cancelStrategy;
  const aiModeOptions: Array<{ value: ExtendedSettings['defaultAiMode']; label: string }> = buildAiModeSelectOptions(t);
  const availableAiModeOptions = resolveAvailableAiModeOptions(aiModeOptions, extendedSettings);
  const aiInteractionStaticSelectOptions = buildAiInteractionStaticSelectOptions(t);
  const aiScopeOptions = aiInteractionStaticSelectOptions.scope;
  const aiCommandScopeOptions = aiScopeOptions;
  const aiNoSelectionFallbackScopeOptions = aiInteractionStaticSelectOptions.noSelectionFallbackScope;
  const aiScopePriorityStrategyOptions = aiInteractionStaticSelectOptions.scopePriorityStrategy;
  const aiRetrievalStrategyOptions = aiInteractionStaticSelectOptions.retrievalStrategy;
  const aiRetrievalQueryRewriteModeOptions = aiInteractionStaticSelectOptions.retrievalQueryRewriteMode;
  const aiMultiStageRetrievalModeOptions = aiInteractionStaticSelectOptions.multiStageRetrievalMode;
  const aiFtsUnavailableBehaviorOptions = aiInteractionStaticSelectOptions.ftsUnavailableBehavior;
  const aiDefaultOutputFormatOptions = aiInteractionStaticSelectOptions.defaultOutputFormat;
  const aiCitationCardDefaultDensityOptions = aiInteractionStaticSelectOptions.citationCardDefaultDensity;
  const aiCitationFieldStrictnessOptions = aiInteractionStaticSelectOptions.citationFieldStrictness;
  const aiToolCallDisplayModeOptions = aiInteractionStaticSelectOptions.toolCallDisplayMode;
  const aiCitationDefaultSaveTargetOptions = aiInteractionStaticSelectOptions.citationDefaultSaveTarget;
  const aiReasoningEffortOptions = aiProviderStaticSelectOptions.reasoningEffort;
  const aiResponseFormatOptions = aiProviderStaticSelectOptions.responseFormat;
  const operationLogOptions: { value: OperationLogLevel; label: string }[] = [
    { value: 'none', label: t('settings.logs.level.none') },
    { value: 'error', label: t('settings.logs.level.error') },
    { value: 'basic', label: t('settings.logs.level.basic') },
    { value: 'debug', label: t('settings.logs.level.debug') },
  ];
  const aiProviderProfiles = normalizeAiProviderProfilesForUi(settings);
  const rawAiProviderProfiles = Array.isArray(settings.aiProviderProfiles) ? settings.aiProviderProfiles : [];
  const rawActiveAiProviderProfile = rawAiProviderProfiles.find((profile) => profile.id === settings.aiActiveProviderProfileId);
  const normalizedActiveAiProviderProfile = aiProviderProfiles.find((profile) => profile.id === settings.aiActiveProviderProfileId) ?? aiProviderProfiles[0];
  const activeAiProviderProfile = rawActiveAiProviderProfile
    ? { ...normalizedActiveAiProviderProfile, ...rawActiveAiProviderProfile }
    : normalizedActiveAiProviderProfile;
  const aiModelOptions = Array.from(new Set([
    settings.aiModel || 'gpt-4.1-mini',
    activeAiProviderProfile?.model ?? '',
    ...(activeAiProviderProfile?.models ?? []),
    ...aiProviderProfiles.flatMap((profile) => [profile.model, ...(profile.models ?? [])]),
    ...aiModels,
  ]))
    .filter((model) => model.trim())
    .map((model) => ({ value: model, label: model }));
  const aiProviderProfileOptions = aiProviderProfiles.map((profile) => ({
    value: profile.id,
    label: `${profile.enabled === false ? `${t('settings.options.page.providerProfile.disabled')} · ` : ''}${profile.name || profile.id}`,
  }));
  const cloudRedactionPreview = useMemo(() => buildCloudRedactionPreview(cloudRedactionPreviewInput, extendedSettings.cloudAiSensitiveWords), [cloudRedactionPreviewInput, extendedSettings.cloudAiSensitiveWords]);
  const startupPageOptions: Array<{ value: ExtendedSettings['startupPage']; label: string }> = [
    { value: 'last', label: t('settings.options.page.startupPage.last') },
    { value: 'overview', label: t('settings.options.page.startupPage.overview') },
    { value: 'reader', label: t('settings.options.page.startupPage.reader') },
    { value: 'library', label: t('settings.options.page.startupPage.library') },
  ];
  const startupOverviewModeOptions: Array<{ value: ExtendedSettings['startupOverviewMode']; label: string }> = [
    { value: 'auto', label: t('settings.options.page.startupOverview.auto') },
    { value: 'welcome', label: t('settings.options.page.startupOverview.welcome') },
    { value: 'recent', label: t('settings.options.page.startupOverview.recent') },
    { value: 'emptyGuide', label: t('settings.options.page.startupOverview.emptyGuide') },
  ];
  const backgroundTaskNotificationModeOptions: Array<{ value: ExtendedSettings['backgroundTaskNotificationMode']; label: string }> = [
    { value: 'toast', label: t('settings.options.page.backgroundTaskNotification.toast') },
    { value: 'silent', label: t('settings.options.page.backgroundTaskNotification.silent') },
    { value: 'system-notification', label: t('settings.options.page.backgroundTaskNotification.systemNotification') },
  ];
  const taskCenterDefaultStatusFilterOptions: Array<{ value: ExtendedSettings['taskCenterDefaultStatusFilter']; label: string }> = [
    { value: 'all', label: t('settings.options.page.taskStatus.all') },
    { value: 'queued', label: t('settings.options.page.taskStatus.queued') },
    { value: 'running', label: t('settings.options.page.taskStatus.running') },
    { value: 'paused', label: t('settings.options.page.taskStatus.paused') },
    { value: 'cancelling', label: t('settings.options.page.taskStatus.cancelling') },
    { value: 'cancelled', label: t('settings.options.page.taskStatus.cancelled') },
    { value: 'failed', label: t('settings.options.page.taskStatus.failed') },
    { value: 'succeeded', label: t('settings.options.page.taskStatus.succeeded') },
    { value: 'skipped', label: t('settings.options.page.taskStatus.skipped') },
    { value: 'archived', label: t('settings.options.page.taskStatus.archived') },
  ];
  const searchIndexStaticSelectOptions = buildSearchIndexStaticSelectOptions(t);
  const indexStrategyVersionOptions = searchIndexStaticSelectOptions.indexStrategyVersion;
  const ftsRepairStrategyOptions = searchIndexStaticSelectOptions.ftsRepairStrategy;
  const indexRebuildStrategyOptions = searchIndexStaticSelectOptions.indexRebuildStrategy;
  const indexPauseResumeStrategyOptions = searchIndexStaticSelectOptions.indexPauseResumeStrategy;
  const taskLogRetentionOptions: Array<{ value: ExtendedSettings['taskLogRetention']; label: string }> = [
    { value: 'session', label: t('settings.options.page.taskLogRetention.session') },
    { value: '7-days', label: t('settings.options.page.taskLogRetention.7Days') },
    { value: '30-days', label: t('settings.options.page.taskLogRetention.30Days') },
    { value: '90-days', label: t('settings.options.page.taskLogRetention.90Days') },
    { value: 'forever', label: t('settings.options.page.taskLogRetention.forever') },
  ];
  const dataAutoBackupFrequencyOptions: Array<{ value: ExtendedSettings['dataAutoBackupFrequency']; label: string }> = [
    { value: 'daily', label: t('settings.options.page.backupFrequency.daily') },
    { value: 'weekly', label: t('settings.options.page.backupFrequency.weekly') },
    { value: 'monthly', label: t('settings.options.page.backupFrequency.monthly') },
  ];
  const dataBackupModeOptions: Array<{ value: ExtendedSettings['dataBackupMode']; label: string }> = [
    { value: 'full', label: t('settings.options.page.backupMode.full') },
    { value: 'incremental', label: t('settings.options.page.backupMode.incremental') },
  ];
  const appThemeOptions: Array<{ value: ExtendedSettings['appTheme']; label: string }> = [
    { value: 'system', label: t('settings.options.page.appTheme.system') },
    { value: 'light', label: t('settings.options.page.appTheme.light') },
    { value: 'dark', label: t('settings.options.page.appTheme.dark') },
  ];
  const pageTitleModeOptions: Array<{ value: ExtendedSettings['pageTitleMode']; label: string }> = [
    { value: 'full', label: t('settings.options.page.pageTitleMode.full') },
    { value: 'compact', label: t('settings.options.page.pageTitleMode.compact') },
  ];
  const navigationShortcutStaticSelectOptions = buildNavigationShortcutStaticSelectOptions(t);
  const navItemOptions: Array<{ value: AppPage; label: string }> = navigationShortcutStaticSelectOptions.navItem;
  const topbarButtonOptions = navigationShortcutStaticSelectOptions.topbarButton;
  const multiWindowConflictStrategyOptions: Array<{ value: ExtendedSettings['multiWindowConflictStrategy']; label: string }> = [
    { value: 'latest', label: t('settings.options.page.multiWindowConflict.latest') },
    { value: 'current-window', label: t('settings.options.page.multiWindowConflict.currentWindow') },
    { value: 'manual', label: t('settings.options.page.multiWindowConflict.manual') },
  ];
  const readerProgressModeOptions: Array<{ value: ExtendedSettings['readerProgressMode']; label: string }> = [
    { value: 'chapters', label: t('settings.options.page.readerProgress.chapters') },
    { value: 'characters', label: t('settings.options.page.readerProgress.characters') },
    { value: 'pages', label: t('settings.options.page.readerProgress.pages') },
  ];
  const commandPaletteShortcutOptions = navigationShortcutStaticSelectOptions.commandPaletteShortcut;
  const commandPaletteSortModeOptions = navigationShortcutStaticSelectOptions.commandPaletteSortMode;
  const readerNavigationShortcutOptions = navigationShortcutStaticSelectOptions.readerNavigationShortcut;
  const libraryNavigationShortcutOptions = navigationShortcutStaticSelectOptions.libraryNavigationShortcut;
  const searchNavigationShortcutOptions = navigationShortcutStaticSelectOptions.searchNavigationShortcut;
  const importShortcutOptions = navigationShortcutStaticSelectOptions.importShortcut;
  const aiSummaryShortcutOptions = navigationShortcutStaticSelectOptions.aiSummaryShortcut;
  const readerHighlightShortcutOptions = navigationShortcutStaticSelectOptions.readerHighlightShortcut;
  const readerBookmarkShortcutOptions = navigationShortcutStaticSelectOptions.readerBookmarkShortcut;
  const readerAiPanelShortcutOptions = navigationShortcutStaticSelectOptions.readerAiPanelShortcut;
  const readerSearchShortcutOptions = navigationShortcutStaticSelectOptions.readerSearchShortcut;
  const libraryImportStaticSelectOptions = buildLibraryImportStaticSelectOptions(t);
  const libraryViewOptions = libraryImportStaticSelectOptions.viewMode;
  const librarySortOptions = libraryImportStaticSelectOptions.sort;
  const libraryFilterOptions = libraryImportStaticSelectOptions.filter;
  const duplicateStrategyOptions = libraryImportStaticSelectOptions.duplicateStrategy;
  const defaultCoverToneStrategyOptions = libraryImportStaticSelectOptions.coverToneStrategy;
  const defaultCoverLabelStrategyOptions = libraryImportStaticSelectOptions.coverLabelStrategy;
  const importFileFilterOptions = libraryImportStaticSelectOptions.importFileFilter;
  const txtImportEncodingModeOptions = libraryImportStaticSelectOptions.txtImportEncodingMode;
  const libraryDensityOptions = libraryImportStaticSelectOptions.density;
  const searchStaticSelectOptions = buildSearchStaticSelectOptions(t);
  const searchScopeOptions = searchStaticSelectOptions.scope;
  const globalSearchModeOptions = searchStaticSelectOptions.globalMode;
  const readerSearchChapterFilterOptions = searchStaticSelectOptions.readerChapterFilter;
  const readerSearchHighlightColorOptions = searchStaticSelectOptions.readerHighlightColor;
  const annotationKnowledgeStaticSelectOptions = buildAnnotationKnowledgeStaticSelectOptions(t);
  const highlightColorOptions = annotationKnowledgeStaticSelectOptions.highlightColor;
  const highlightColorShortcutOptions = annotationKnowledgeStaticSelectOptions.highlightColorShortcut;
  const highlightImportanceOptions = annotationKnowledgeStaticSelectOptions.highlightImportance;
  const highlightReviewStatusOptions = annotationKnowledgeStaticSelectOptions.highlightReviewStatus;
  const highlightOverlapStrategyOptions = annotationKnowledgeStaticSelectOptions.highlightOverlapStrategy;
  const anchorRepairStrategyOptions = annotationKnowledgeStaticSelectOptions.anchorRepairStrategy;
  const exportFormatOptions = annotationKnowledgeStaticSelectOptions.exportFormat;
  const annotationExportContentOptions = annotationKnowledgeStaticSelectOptions.annotationExportContent;
  const annotationJsonImportConflictStrategyOptions = annotationKnowledgeStaticSelectOptions.annotationJsonImportConflictStrategy;
  const noteDefaultSaveTargetOptions = annotationKnowledgeStaticSelectOptions.noteDefaultSaveTarget;
  const annotationCsvFieldOptions = annotationKnowledgeStaticSelectOptions.annotationCsvField;
  const knowledgeDefaultColumnOptions = annotationKnowledgeStaticSelectOptions.knowledgeDefaultColumn;
  const bookmarkSortOptions = annotationKnowledgeStaticSelectOptions.bookmarkSort;
  const bookmarkGroupOptions = annotationKnowledgeStaticSelectOptions.bookmarkGroup;
  const performanceTuningProfile = useMemo(() => buildSettingsPerformanceTuningProfile({
    taskConcurrency: extendedSettings.taskConcurrency,
    importConcurrency: extendedSettings.importConcurrency,
    parseConcurrency: extendedSettings.parseConcurrency,
    vectorConcurrencyReserved: extendedSettings.vectorConcurrencyReserved,
    indexChunkSize: extendedSettings.indexChunkSize,
    indexChunkOverlap: extendedSettings.indexChunkOverlap,
    ftsWriteSerial: extendedSettings.ftsWriteSerial,
    largeBookPerformanceMode: extendedSettings.largeBookPerformanceMode,
    virtualChapterRadius: extendedSettings.virtualChapterRadius,
    virtualParagraphWindowSize: extendedSettings.virtualParagraphWindowSize,
    readerPageCacheLimit: extendedSettings.readerPageCacheLimit,
    readerPageMeasureCacheLimit: extendedSettings.readerPageMeasureCacheLimit,
    readerPagePreheatRange: extendedSettings.readerPagePreheatRange,
  }), [
    extendedSettings.taskConcurrency,
    extendedSettings.importConcurrency,
    extendedSettings.parseConcurrency,
    extendedSettings.vectorConcurrencyReserved,
    extendedSettings.indexChunkSize,
    extendedSettings.indexChunkOverlap,
    extendedSettings.ftsWriteSerial,
    extendedSettings.largeBookPerformanceMode,
    extendedSettings.virtualChapterRadius,
    extendedSettings.virtualParagraphWindowSize,
    extendedSettings.readerPageCacheLimit,
    extendedSettings.readerPageMeasureCacheLimit,
    extendedSettings.readerPagePreheatRange,
  ]);
  const shortcutConflictMessages = useMemo(() => getShortcutConflictMessages(extendedSettings, t), [extendedSettings, t]);
  const normalizedSettingsQuery = normalizeSettingsSearchText(settingsQuery);
  const displaySettingsQuery = settingsQuery.trim();
  const activeSettingsGroup = settingsGroups.find((group) => group.id === activeGroup);
  const visibleGroups = resolveSettingsVisibleGroups(settingsQuery, activeGroup, settingsGroups);

  return {
    activeAiProviderProfile,
    activeSettingsGroup,
    aiCancelStrategyOptions,
    aiCitationCardDefaultDensityOptions,
    aiCitationDefaultSaveTargetOptions,
    aiCitationFieldStrictnessOptions,
    aiCommandScopeOptions,
    aiDefaultOutputFormatOptions,
    aiEndpointOptions,
    aiFtsUnavailableBehaviorOptions,
    aiModeOptions,
    aiModelOptions,
    aiMultiStageRetrievalModeOptions,
    aiNoSelectionFallbackScopeOptions,
    aiProviderKindOptions,
    aiProviderProfileOptions,
    aiProviderProfiles,
    aiReasoningEffortOptions,
    aiResponseFormatOptions,
    aiRetrievalQueryRewriteModeOptions,
    aiRetrievalStrategyOptions,
    aiSummaryShortcutOptions,
    aiScopeOptions,
    aiScopePriorityStrategyOptions,
    aiToolCallDisplayModeOptions,
    anchorRepairStrategyOptions,
    annotationCsvFieldOptions,
    annotationExportContentOptions,
    annotationJsonImportConflictStrategyOptions,
    appThemeOptions,
    availableAiModeOptions,
    backgroundTaskNotificationModeOptions,
    bookmarkGroupOptions,
    bookmarkSortOptions,
    bookTitleBracketModeOptions,
    chapterDiagnosticsCleanedContent,
    chapterParseDiagnostics,
    commandPaletteShortcutOptions,
    commandPaletteSortModeOptions,
    cloudRedactionPreview,
    dataAutoBackupFrequencyOptions,
    dataBackupModeOptions,
    defaultCoverLabelStrategyOptions,
    defaultCoverToneStrategyOptions,
    displaySettingsQuery,
    duplicateStrategyOptions,
    exportFormatOptions,
    filteredOperationLogs,
    fontRenderingDiagnostics,
    ftsRepairStrategyOptions,
    globalSearchModeOptions,
    highlightColorOptions,
    highlightColorShortcutOptions,
    highlightImportanceOptions,
    highlightOverlapStrategyOptions,
    highlightReviewStatusOptions,
    importFileFilterOptions,
    importShortcutOptions,
    indexPauseResumeStrategyOptions,
    indexRebuildStrategyOptions,
    indexStrategyVersionOptions,
    knowledgeDefaultColumnOptions,
    libraryDensityOptions,
    libraryFilterOptions,
    libraryNavigationShortcutOptions,
    librarySortOptions,
    libraryViewOptions,
    localeOptions,
    multiWindowConflictStrategyOptions,
    navItemOptions,
    normalizedSettingsQuery,
    noteDefaultSaveTargetOptions,
    operationLogFilterLevelOptions,
    operationLogOptions,
    pageTitleModeOptions,
    paragraphModeOptions,
    performanceTuningProfile,
    privacyAiApiKeyFallbackPath,
    privacyDiagnosticPaths,
    privacyLocalEncryptionFallbackPath,
    readerAiPanelShortcutOptions,
    readerAlignOptions,
    readerAnimationOptions,
    readerBookmarkShortcutOptions,
    readerCjkPunctuationOptions,
    readerFontWeightBoostOptions,
    readerHeaderFooterProgressFormatOptions,
    readerHeaderFooterTimeFormatOptions,
    readerHighlightShortcutOptions,
    readerInfoSlotOptions,
    readerLayoutOptions,
    readerLongParagraphStrategyOptions,
    readerMixedTextSpacingOptions,
    readerNavigationShortcutOptions,
    readerPageModeOptions,
    readerPageVerticalAlignOptions,
    readerPresetOptions,
    readerProgressModeOptions,
    readerSearchChapterFilterOptions,
    readerSearchHighlightColorOptions,
    readerSearchShortcutOptions,
    readerThemeOptions,
    readerTitleDecorationOptions,
    readerTitleNumberCleanupOptions,
    retentionSelectOptions,
    searchNavigationShortcutOptions,
    searchScopeOptions,
    settingsGroups,
    shortcutConflictMessages,
    startupOverviewModeOptions,
    startupPageOptions,
    taskCenterDefaultStatusFilterOptions,
    taskLogRetentionOptions,
    tocRuleChangeRebuildModeOptions,
    topbarButtonOptions,
    translationFallbackOptions,
    txtCleanupPreviewOutput,
    txtImportEncodingModeOptions,
    visibleGroups,
  };
}

import type {
  AiCustomSlashCommandDraft,
  ChapterRegexRuleDraft,
  ChapterRuleDraft,
  CustomCleanupRuleDraft,
  ExtendedSettings,
  TocTitleGroupRuleDraft,
} from './schema';
import { normalizeMoyuReaderProfile } from '../../features/reader-core/moyuReaderSettingsModel';
import {
  aiCustomSlashCommandsStorageKey,
  aiCustomSlashCommandsUpdatedEvent,
  allNavItems,
  defaultChapterRules,
  defaultExtendedSettings,
  defaultHighlightColorMeanings,
  defaultHighlightColorShortcuts,
} from './defaults';
import { emitAiCustomSlashCommandsUpdated } from './events';
export function normalizeChapterRules(settings: Partial<ChapterRuleDraft> | null | undefined): ChapterRuleDraft {
  return {
    ...defaultChapterRules,
    ...(settings ?? {}),
    tocHierarchyMode: settings?.tocHierarchyMode === 'document' ? 'document' : 'novel',
    maxHeadingLength: Number(clampNumericString(String(settings?.maxHeadingLength ?? defaultChapterRules.maxHeadingLength), String(defaultChapterRules.maxHeadingLength), 5, 80)),
    minHeadingConfidence: Number(clampNumericString(String(settings?.minHeadingConfidence ?? defaultChapterRules.minHeadingConfidence), String(defaultChapterRules.minHeadingConfidence), 0, 100)),
    compactHeadingSuffixLength: Number(clampNumericString(String(settings?.compactHeadingSuffixLength ?? defaultChapterRules.compactHeadingSuffixLength), String(defaultChapterRules.compactHeadingSuffixLength), 0, 40)),
    bookTitleMaxLength: Number(clampNumericString(String(settings?.bookTitleMaxLength ?? defaultChapterRules.bookTitleMaxLength), String(defaultChapterRules.bookTitleMaxLength), 5, 120)),
    shortLineMergeThreshold: Number(clampNumericString(String(settings?.shortLineMergeThreshold ?? defaultChapterRules.shortLineMergeThreshold), String(defaultChapterRules.shortLineMergeThreshold), 2, 80)),
    longParagraphSliceSize: Number(clampNumericString(String(settings?.longParagraphSliceSize ?? defaultChapterRules.longParagraphSliceSize), String(defaultChapterRules.longParagraphSliceSize), 200, 5000)),
    removeAds: typeof settings?.removeAds === 'boolean' ? settings.removeAds : defaultChapterRules.removeAds,
    adKeywords: normalizeAdKeywords(settings?.adKeywords),
    removeAdUrls: typeof settings?.removeAdUrls === 'boolean' ? settings.removeAdUrls : defaultChapterRules.removeAdUrls,
    removePaginationNoise: typeof settings?.removePaginationNoise === 'boolean' ? settings.removePaginationNoise : defaultChapterRules.removePaginationNoise,
    preserveOriginalBackup: typeof settings?.preserveOriginalBackup === 'boolean' ? settings.preserveOriginalBackup : defaultChapterRules.preserveOriginalBackup,
    normalizeBlankLines: typeof settings?.normalizeBlankLines === 'boolean' ? settings.normalizeBlankLines : defaultChapterRules.normalizeBlankLines,
    trimTrailingWhitespace: typeof settings?.trimTrailingWhitespace === 'boolean' ? settings.trimTrailingWhitespace : defaultChapterRules.trimTrailingWhitespace,
    normalizeFullWidthSpaces: typeof settings?.normalizeFullWidthSpaces === 'boolean' ? settings.normalizeFullWidthSpaces : defaultChapterRules.normalizeFullWidthSpaces,
    customCleanupRules: normalizeCustomCleanupRules(settings?.customCleanupRules),
    bookTitleBracketMode: isBookTitleBracketMode(settings?.bookTitleBracketMode) ? settings.bookTitleBracketMode : defaultChapterRules.bookTitleBracketMode,
    paragraphMode: isParagraphMode(settings?.paragraphMode) ? settings.paragraphMode : defaultChapterRules.paragraphMode,
    customBookTitleBracketPattern: typeof settings?.customBookTitleBracketPattern === 'string' ? settings.customBookTitleBracketPattern.slice(0, 240) : defaultChapterRules.customBookTitleBracketPattern,
    forbiddenHeadingPunctuation: normalizeChapterRuleText(settings?.forbiddenHeadingPunctuation, defaultChapterRules.forbiddenHeadingPunctuation),
    forbiddenHeadingStartChars: normalizeChapterRuleText(settings?.forbiddenHeadingStartChars, defaultChapterRules.forbiddenHeadingStartChars),
    customRegexRules: normalizeChapterRegexRules(settings),
    customRegex: typeof settings?.customRegex === 'string' ? settings.customRegex.slice(0, 240) : defaultChapterRules.customRegex,
  };
}

export function normalizeCustomCleanupRules(value: unknown): CustomCleanupRuleDraft[] {
  const sourceRules = Array.isArray(value) ? value : [];
  return sourceRules
    .slice(0, 16)
    .map((rule, index) => ({
      id: normalizeChapterRuleId(rule?.id, index),
      name: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim().slice(0, 40) : `清洗规则 ${index + 1}`,
      pattern: typeof rule?.pattern === 'string' ? rule.pattern.trim().slice(0, 240) : '',
      replacement: typeof rule?.replacement === 'string' ? rule.replacement.slice(0, 240) : '',
      enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : true,
      mode: isCustomCleanupMode(rule?.mode) ? rule.mode : 'remove-line',
      priority: Number(clampNumericString(String(rule?.priority ?? index), String(index), 0, 999)),
    }))
    .filter((rule) => rule.pattern)
    .sort((a, b) => a.priority - b.priority);
}

export function normalizeTocTitleGroupRules(value: unknown): TocTitleGroupRuleDraft[] {
  const sourceRules = Array.isArray(value) ? value : [];
  return sourceRules
    .slice(0, 16)
    .map((rule, index) => ({
      id: normalizeChapterRuleId(rule?.id, index),
      name: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim().slice(0, 40) : `分组规则 ${index + 1}`,
      groupName: typeof rule?.groupName === 'string' && rule.groupName.trim() ? rule.groupName.trim().slice(0, 20) : '正文',
      pattern: typeof rule?.pattern === 'string' ? rule.pattern.trim().slice(0, 240) : '',
      enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : true,
      priority: Number(clampNumericString(String(rule?.priority ?? index), String(index), 0, 999)),
    }))
    .filter((rule) => rule.pattern)
    .sort((a, b) => a.priority - b.priority);
}

export function normalizeChapterRegexRules(settings: Partial<ChapterRuleDraft> | null | undefined): ChapterRegexRuleDraft[] {
  const sourceRules = Array.isArray(settings?.customRegexRules) ? settings.customRegexRules : [];
  const migratedRule = typeof settings?.customRegex === 'string' && settings.customRegex.trim()
    ? [{ id: 'legacy-custom-regex', name: '旧版自定义正则', pattern: settings.customRegex.trim(), enabled: true, priority: 0 }]
    : [];
  return [...migratedRule, ...sourceRules]
    .slice(0, 12)
    .map((rule, index) => ({
      id: normalizeChapterRuleId(rule?.id, index),
      name: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim().slice(0, 40) : `正则规则 ${index + 1}`,
      pattern: typeof rule?.pattern === 'string' ? rule.pattern.trim().slice(0, 240) : '',
      enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : true,
      priority: Number(clampNumericString(String(rule?.priority ?? index), String(index), 0, 999)),
    }))
    .filter((rule) => rule.pattern)
    .sort((a, b) => a.priority - b.priority);
}

function isCustomCleanupMode(value: unknown): value is CustomCleanupRuleDraft['mode'] {
  return value === 'remove-line' || value === 'replace';
}

function normalizeChapterRuleId(value: unknown, index: number) {
  if (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,48}$/.test(value)) return value;
  return `chapter-regex-${index + 1}`;
}

function isBookTitleBracketMode(value: unknown): value is ChapterRuleDraft['bookTitleBracketMode'] {
  return value === 'book-title' || value === 'angle' || value === 'both' || value === 'custom';
}

function isTranslationFallbackStrategy(value: unknown): value is ExtendedSettings['translationFallbackStrategy'] {
  return value === 'default-locale' || value === 'key';
}

function isParagraphMode(value: unknown): value is ChapterRuleDraft['paragraphMode'] {
  return value === 'line' || value === 'blank-line' || value === 'merge-short-lines' || value === 'chinese-reflow';
}

function normalizeChapterRuleText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  return Array.from(value.replace(/\s+/g, '')).slice(0, 40).join('');
}

function normalizeMultilineSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, maxLength);
  return normalized || fallback;
}

function normalizeSpaceSeparatedSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean).join(' ').slice(0, maxLength);
  return normalized || fallback;
}

function normalizeOptionalSpaceSeparatedSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  return value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean).join(' ').slice(0, maxLength);
}

function normalizeTextSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizeTemplateSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\r\n/g, '\n').trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizePathTextSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizeAnnotationCsvFields(value: unknown): ExtendedSettings['annotationCsvFields'] {
  const fields = defaultExtendedSettings.annotationCsvFields;
  if (!Array.isArray(value)) return fields;
  const selected = fields.filter((field) => value.includes(field));
  return selected.length ? selected : fields;
}

function normalizeKnowledgeDefaultColumns(value: unknown): ExtendedSettings['knowledgeDefaultColumns'] {
  const columns = defaultExtendedSettings.knowledgeDefaultColumns;
  if (!Array.isArray(value)) return columns;
  const selected = columns.filter((column) => value.includes(column));
  return selected.length ? selected : columns;
}

function normalizeAdKeywords(value: unknown) {
  if (typeof value !== 'string') return defaultChapterRules.adKeywords;
  return value
    .split(/[,，\n]/)
    .map((keyword) => keyword.trim())
    .filter((keyword, index, list) => keyword && list.indexOf(keyword) === index)
    .slice(0, 24)
    .join('，')
    .slice(0, 240);
}

export function normalizeExtendedSettings(settings: Partial<ExtendedSettings> | null | undefined): ExtendedSettings {
  return {
    ...defaultExtendedSettings,
    ...(settings ?? {}),
    openLastReaderBookOnStartup: typeof settings?.openLastReaderBookOnStartup === 'boolean' ? settings.openLastReaderBookOnStartup : defaultExtendedSettings.openLastReaderBookOnStartup,
    restoreLastReaderPositionOnStartup: typeof settings?.restoreLastReaderPositionOnStartup === 'boolean' ? settings.restoreLastReaderPositionOnStartup : defaultExtendedSettings.restoreLastReaderPositionOnStartup,
    checkUnfinishedTasksOnStartup: typeof settings?.checkUnfinishedTasksOnStartup === 'boolean' ? settings.checkUnfinishedTasksOnStartup : defaultExtendedSettings.checkUnfinishedTasksOnStartup,
    refreshLibraryMetadataOnStartup: typeof settings?.refreshLibraryMetadataOnStartup === 'boolean' ? settings.refreshLibraryMetadataOnStartup : defaultExtendedSettings.refreshLibraryMetadataOnStartup,
    startupOverviewMode: isStartupOverviewMode(settings?.startupOverviewMode) ? settings.startupOverviewMode : defaultExtendedSettings.startupOverviewMode,
    rememberWindowGeometry: typeof settings?.rememberWindowGeometry === 'boolean' ? settings.rememberWindowGeometry : defaultExtendedSettings.rememberWindowGeometry,
    backgroundTaskNotificationMode: isBackgroundTaskNotificationMode(settings?.backgroundTaskNotificationMode) ? settings.backgroundTaskNotificationMode : defaultExtendedSettings.backgroundTaskNotificationMode,
    refreshLibraryOnTaskCompletion: typeof settings?.refreshLibraryOnTaskCompletion === 'boolean' ? settings.refreshLibraryOnTaskCompletion : defaultExtendedSettings.refreshLibraryOnTaskCompletion,
    taskAutoRunQueuedWhenIdle: typeof settings?.taskAutoRunQueuedWhenIdle === 'boolean' ? settings.taskAutoRunQueuedWhenIdle : defaultExtendedSettings.taskAutoRunQueuedWhenIdle,
    taskCenterDefaultStatusFilter: isTaskCenterDefaultStatusFilter(settings?.taskCenterDefaultStatusFilter) ? settings.taskCenterDefaultStatusFilter : defaultExtendedSettings.taskCenterDefaultStatusFilter,
    confirmOpenExternalPath: typeof settings?.confirmOpenExternalPath === 'boolean' ? settings.confirmOpenExternalPath : defaultExtendedSettings.confirmOpenExternalPath,
    defaultCoverToneStrategy: isDefaultCoverToneStrategy(settings?.defaultCoverToneStrategy) ? settings.defaultCoverToneStrategy : defaultExtendedSettings.defaultCoverToneStrategy,
    defaultCoverLabelStrategy: isDefaultCoverLabelStrategy(settings?.defaultCoverLabelStrategy) ? settings.defaultCoverLabelStrategy : defaultExtendedSettings.defaultCoverLabelStrategy,
    cleanTitleFromFilename: typeof settings?.cleanTitleFromFilename === 'boolean' ? settings.cleanTitleFromFilename : defaultExtendedSettings.cleanTitleFromFilename,
    autoDetectAuthor: typeof settings?.autoDetectAuthor === 'boolean' ? settings.autoDetectAuthor : defaultExtendedSettings.autoDetectAuthor,
    defaultImportPath: normalizeTextSetting(settings?.defaultImportPath, defaultExtendedSettings.defaultImportPath, 500),
    importFileFilter: isImportFileFilter(settings?.importFileFilter) ? settings.importFileFilter : defaultExtendedSettings.importFileFilter,
    txtImportEncodingMode: isTxtImportEncodingMode(settings?.txtImportEncodingMode) ? settings.txtImportEncodingMode : defaultExtendedSettings.txtImportEncodingMode,
    openImportedBookAfterImport: typeof settings?.openImportedBookAfterImport === 'boolean' ? settings.openImportedBookAfterImport : defaultExtendedSettings.openImportedBookAfterImport,
    directoryImportRecursive: typeof settings?.directoryImportRecursive === 'boolean' ? settings.directoryImportRecursive : defaultExtendedSettings.directoryImportRecursive,
    showImportSummaryAfterImport: typeof settings?.showImportSummaryAfterImport === 'boolean' ? settings.showImportSummaryAfterImport : defaultExtendedSettings.showImportSummaryAfterImport,
    continueDirectoryImportAfterFailure: typeof settings?.continueDirectoryImportAfterFailure === 'boolean' ? settings.continueDirectoryImportAfterFailure : defaultExtendedSettings.continueDirectoryImportAfterFailure,
    autoCleanTxtOnImport: typeof settings?.autoCleanTxtOnImport === 'boolean' ? settings.autoCleanTxtOnImport : defaultExtendedSettings.autoCleanTxtOnImport,
    autoParseTocOnImport: typeof settings?.autoParseTocOnImport === 'boolean' ? settings.autoParseTocOnImport : defaultExtendedSettings.autoParseTocOnImport,
    autoRebuildTocWhenEmpty: typeof settings?.autoRebuildTocWhenEmpty === 'boolean' ? settings.autoRebuildTocWhenEmpty : defaultExtendedSettings.autoRebuildTocWhenEmpty,
    tocRuleChangeRebuildMode: isTocRuleChangeRebuildMode(settings?.tocRuleChangeRebuildMode) ? settings.tocRuleChangeRebuildMode : defaultExtendedSettings.tocRuleChangeRebuildMode,
    previewTocRebuildDiff: typeof settings?.previewTocRebuildDiff === 'boolean' ? settings.previewTocRebuildDiff : defaultExtendedSettings.previewTocRebuildDiff,
    autoBackupImportedOriginals: typeof settings?.autoBackupImportedOriginals === 'boolean' ? settings.autoBackupImportedOriginals : defaultExtendedSettings.autoBackupImportedOriginals,
    autoShowTaskCenterForLongOperations: typeof settings?.autoShowTaskCenterForLongOperations === 'boolean' ? settings.autoShowTaskCenterForLongOperations : defaultExtendedSettings.autoShowTaskCenterForLongOperations,
    errorDetailsDefaultExpanded: typeof settings?.errorDetailsDefaultExpanded === 'boolean' ? settings.errorDetailsDefaultExpanded : defaultExtendedSettings.errorDetailsDefaultExpanded,
    customThemeColor: normalizeHexColor(settings?.customThemeColor, defaultExtendedSettings.customThemeColor),
    highlightColorShortcuts: normalizeHighlightColorShortcuts(settings?.highlightColorShortcuts),
    highlightColorMeanings: normalizeHighlightColorMeanings(settings?.highlightColorMeanings),
    defaultHighlightImportance: isHighlightImportance(settings?.defaultHighlightImportance) ? settings.defaultHighlightImportance : defaultExtendedSettings.defaultHighlightImportance,
    defaultHighlightReviewStatus: isHighlightReviewStatus(settings?.defaultHighlightReviewStatus) ? settings.defaultHighlightReviewStatus : defaultExtendedSettings.defaultHighlightReviewStatus,
    highlightOverlapStrategy: isHighlightOverlapStrategy(settings?.highlightOverlapStrategy) ? settings.highlightOverlapStrategy : defaultExtendedSettings.highlightOverlapStrategy,
    anchorRepairStrategy: isAnchorRepairStrategy(settings?.anchorRepairStrategy) ? settings.anchorRepairStrategy : defaultExtendedSettings.anchorRepairStrategy,
    defaultBookmarkSort: isBookmarkSort(settings?.defaultBookmarkSort) ? settings.defaultBookmarkSort : defaultExtendedSettings.defaultBookmarkSort,
    defaultBookmarkGroupBy: isBookmarkGroupBy(settings?.defaultBookmarkGroupBy) ? settings.defaultBookmarkGroupBy : defaultExtendedSettings.defaultBookmarkGroupBy,
    defaultBookmarkTags: typeof settings?.defaultBookmarkTags === 'string' ? settings.defaultBookmarkTags : defaultExtendedSettings.defaultBookmarkTags,
    defaultBookmarkColor: isHighlightColor(settings?.defaultBookmarkColor) ? settings.defaultBookmarkColor : defaultExtendedSettings.defaultBookmarkColor,
    annotationExportContent: isAnnotationExportContent(settings?.annotationExportContent) ? settings.annotationExportContent : defaultExtendedSettings.annotationExportContent,
    annotationJsonImportConflictStrategy: isAnnotationJsonImportConflictStrategy(settings?.annotationJsonImportConflictStrategy) ? settings.annotationJsonImportConflictStrategy : defaultExtendedSettings.annotationJsonImportConflictStrategy,
    annotationMarkdownTemplate: typeof settings?.annotationMarkdownTemplate === 'string' ? settings.annotationMarkdownTemplate.slice(0, 4000) : defaultExtendedSettings.annotationMarkdownTemplate,
    annotationExportLastDirectory: normalizePathTextSetting(settings?.annotationExportLastDirectory, defaultExtendedSettings.annotationExportLastDirectory, 500),
    annotationCsvFields: normalizeAnnotationCsvFields(settings?.annotationCsvFields),
    ankiDefaultTags: normalizeSpaceSeparatedSetting(settings?.ankiDefaultTags, defaultExtendedSettings.ankiDefaultTags, 160),
    obsidianWikiLinks: typeof settings?.obsidianWikiLinks === 'boolean' ? settings.obsidianWikiLinks : defaultExtendedSettings.obsidianWikiLinks,
    logseqPropertyFormat: typeof settings?.logseqPropertyFormat === 'boolean' ? settings.logseqPropertyFormat : defaultExtendedSettings.logseqPropertyFormat,
    readwiseDefaultAuthor: normalizeTextSetting(settings?.readwiseDefaultAuthor, defaultExtendedSettings.readwiseDefaultAuthor, 120),
    annotationTagSuggestionsEnabled: typeof settings?.annotationTagSuggestionsEnabled === 'boolean' ? settings.annotationTagSuggestionsEnabled : defaultExtendedSettings.annotationTagSuggestionsEnabled,
    annotationMarkdownEditorEnabled: typeof settings?.annotationMarkdownEditorEnabled === 'boolean' ? settings.annotationMarkdownEditorEnabled : defaultExtendedSettings.annotationMarkdownEditorEnabled,
    doubleClickWordSelectionEnabled: typeof settings?.doubleClickWordSelectionEnabled === 'boolean' ? settings.doubleClickWordSelectionEnabled : defaultExtendedSettings.doubleClickWordSelectionEnabled,
    allowEmptyNotes: typeof settings?.allowEmptyNotes === 'boolean' ? settings.allowEmptyNotes : defaultExtendedSettings.allowEmptyNotes,
    noteDefaultSaveTarget: isNoteDefaultSaveTarget(settings?.noteDefaultSaveTarget) ? settings.noteDefaultSaveTarget : defaultExtendedSettings.noteDefaultSaveTarget,
    noteAutoReaderLocation: typeof settings?.noteAutoReaderLocation === 'boolean' ? settings.noteAutoReaderLocation : defaultExtendedSettings.noteAutoReaderLocation,
    noteAutoContext: typeof settings?.noteAutoContext === 'boolean' ? settings.noteAutoContext : defaultExtendedSettings.noteAutoContext,
    noteTemplate: typeof settings?.noteTemplate === 'string' ? settings.noteTemplate.slice(0, 1000) : defaultExtendedSettings.noteTemplate,
    chapterNoticeDurationMs: clampNumericString(settings?.chapterNoticeDurationMs, defaultExtendedSettings.chapterNoticeDurationMs, 0, 10000),
    virtualChapterRadius: clampNumericString(settings?.virtualChapterRadius, defaultExtendedSettings.virtualChapterRadius, 0, 10),
    virtualParagraphWindowSize: clampNumericString(settings?.virtualParagraphWindowSize, defaultExtendedSettings.virtualParagraphWindowSize, 20, 240),
    wheelPagingThresholdPx: clampNumericString(settings?.wheelPagingThresholdPx, defaultExtendedSettings.wheelPagingThresholdPx, 20, 240),
    readerPositionSaveDebounceMs: clampNumericString(settings?.readerPositionSaveDebounceMs, defaultExtendedSettings.readerPositionSaveDebounceMs, 100, 5000),
    multiWindowConflictStrategy: isMultiWindowConflictStrategy(settings?.multiWindowConflictStrategy) ? settings.multiWindowConflictStrategy : defaultExtendedSettings.multiWindowConflictStrategy,
    readerProgressMode: isReaderProgressMode(settings?.readerProgressMode) ? settings.readerProgressMode : defaultExtendedSettings.readerProgressMode,
    tocShowVolumeHierarchy: typeof settings?.tocShowVolumeHierarchy === 'boolean' ? settings.tocShowVolumeHierarchy : defaultExtendedSettings.tocShowVolumeHierarchy,
    tocVolumeClickable: typeof settings?.tocVolumeClickable === 'boolean' ? settings.tocVolumeClickable : defaultExtendedSettings.tocVolumeClickable,
    tocShowChapterNumbers: typeof settings?.tocShowChapterNumbers === 'boolean' ? settings.tocShowChapterNumbers : defaultExtendedSettings.tocShowChapterNumbers,
    tocCollapseVolumes: typeof settings?.tocCollapseVolumes === 'boolean' ? settings.tocCollapseVolumes : defaultExtendedSettings.tocCollapseVolumes,
    tocExpandActiveVolume: typeof settings?.tocExpandActiveVolume === 'boolean' ? settings.tocExpandActiveVolume : defaultExtendedSettings.tocExpandActiveVolume,
    tocShowChapterWordCount: typeof settings?.tocShowChapterWordCount === 'boolean' ? settings.tocShowChapterWordCount : defaultExtendedSettings.tocShowChapterWordCount,
    tocShowChapterProgress: typeof settings?.tocShowChapterProgress === 'boolean' ? settings.tocShowChapterProgress : defaultExtendedSettings.tocShowChapterProgress,
    tocTitleGroupingEnabled: typeof settings?.tocTitleGroupingEnabled === 'boolean' ? settings.tocTitleGroupingEnabled : defaultExtendedSettings.tocTitleGroupingEnabled,
    tocTitleGroupKeywords: normalizeMultilineSetting(settings?.tocTitleGroupKeywords, defaultExtendedSettings.tocTitleGroupKeywords, 600),
    tocTitleGroupRules: normalizeTocTitleGroupRules(settings?.tocTitleGroupRules),
    tocAllowRename: typeof settings?.tocAllowRename === 'boolean' ? settings.tocAllowRename : defaultExtendedSettings.tocAllowRename,
    tocAllowHide: typeof settings?.tocAllowHide === 'boolean' ? settings.tocAllowHide : defaultExtendedSettings.tocAllowHide,
    tocAllowUnhide: typeof settings?.tocAllowUnhide === 'boolean' ? settings.tocAllowUnhide : defaultExtendedSettings.tocAllowUnhide,
    tocAllowSplit: typeof settings?.tocAllowSplit === 'boolean' ? settings.tocAllowSplit : defaultExtendedSettings.tocAllowSplit,
    tocAllowMergeNext: typeof settings?.tocAllowMergeNext === 'boolean' ? settings.tocAllowMergeNext : defaultExtendedSettings.tocAllowMergeNext,
    tocAllowRestoreDefault: typeof settings?.tocAllowRestoreDefault === 'boolean' ? settings.tocAllowRestoreDefault : defaultExtendedSettings.tocAllowRestoreDefault,
    tocAllowUndoRedo: typeof settings?.tocAllowUndoRedo === 'boolean' ? settings.tocAllowUndoRedo : defaultExtendedSettings.tocAllowUndoRedo,
    readerHistoryStackLimit: clampNumericString(settings?.readerHistoryStackLimit, defaultExtendedSettings.readerHistoryStackLimit, 1, 200),
    readerDailyGoalEnabled: typeof settings?.readerDailyGoalEnabled === 'boolean' ? settings.readerDailyGoalEnabled : defaultExtendedSettings.readerDailyGoalEnabled,
    readerDailyPagesGoal: clampNumericString(settings?.readerDailyPagesGoal, defaultExtendedSettings.readerDailyPagesGoal, 0, 1000),
    readerDailyMinutesGoal: clampNumericString(settings?.readerDailyMinutesGoal, defaultExtendedSettings.readerDailyMinutesGoal, 0, 1440),
    readerDailyChaptersGoal: clampNumericString(settings?.readerDailyChaptersGoal, defaultExtendedSettings.readerDailyChaptersGoal, 0, 200),
    recordRecentReaderBooks: typeof settings?.recordRecentReaderBooks === 'boolean' ? settings.recordRecentReaderBooks : defaultExtendedSettings.recordRecentReaderBooks,
    trackReadingTime: typeof settings?.trackReadingTime === 'boolean' ? settings.trackReadingTime : defaultExtendedSettings.trackReadingTime,
    largeBookPerformanceMode: typeof settings?.largeBookPerformanceMode === 'boolean' ? settings.largeBookPerformanceMode : defaultExtendedSettings.largeBookPerformanceMode,
    readerPageCacheEnabled: typeof settings?.readerPageCacheEnabled === 'boolean' ? settings.readerPageCacheEnabled : defaultExtendedSettings.readerPageCacheEnabled,
    readerPagePreheatEnabled: typeof settings?.readerPagePreheatEnabled === 'boolean' ? settings.readerPagePreheatEnabled : defaultExtendedSettings.readerPagePreheatEnabled,
    readerPageMeasureCacheLimit: clampNumericString(settings?.readerPageMeasureCacheLimit, defaultExtendedSettings.readerPageMeasureCacheLimit, 1, 96),
    readerFpsDiagnosticsEnabled: typeof settings?.readerFpsDiagnosticsEnabled === 'boolean' ? settings.readerFpsDiagnosticsEnabled : defaultExtendedSettings.readerFpsDiagnosticsEnabled,
    readerMemoryWarningEnabled: typeof settings?.readerMemoryWarningEnabled === 'boolean' ? settings.readerMemoryWarningEnabled : defaultExtendedSettings.readerMemoryWarningEnabled,
    readerMemoryWarningThresholdMb: clampNumericString(settings?.readerMemoryWarningThresholdMb, defaultExtendedSettings.readerMemoryWarningThresholdMb, 64, 4096),
    readerPageCacheLimit: clampNumericString(settings?.readerPageCacheLimit, defaultExtendedSettings.readerPageCacheLimit, 0, 200),
    readerPagePreheatRange: clampNumericString(settings?.readerPagePreheatRange, defaultExtendedSettings.readerPagePreheatRange, 0, 5),
    searchLimit: clampNumericString(settings?.searchLimit, defaultExtendedSettings.searchLimit, 5, 800),
    globalSearchMode: settings?.globalSearchMode === 'enter' ? 'enter' : 'instant',
    globalSearchDebounceMs: clampNumericString(settings?.globalSearchDebounceMs, defaultExtendedSettings.globalSearchDebounceMs, 0, 2000),
    globalSearchSnippetLength: clampNumericString(settings?.globalSearchSnippetLength, defaultExtendedSettings.globalSearchSnippetLength, 80, 500),
    globalSearchShowScore: typeof settings?.globalSearchShowScore === 'boolean' ? settings.globalSearchShowScore : defaultExtendedSettings.globalSearchShowScore,
    libraryPanelPersistent: typeof settings?.libraryPanelPersistent === 'boolean' ? settings.libraryPanelPersistent : defaultExtendedSettings.libraryPanelPersistent,
    sidebarRecentBookLimit: defaultExtendedSettings.sidebarRecentBookLimit,
    pageTitleMode: settings?.pageTitleMode === 'compact' ? 'compact' : 'full',
    visibleNavItems: normalizeVisibleNavItems(settings?.visibleNavItems),
    topbarButtonVisibility: normalizeTopbarButtonVisibility(settings?.topbarButtonVisibility),
    readerShortcuts: normalizeReaderShortcuts(settings?.readerShortcuts),
    pageClickPaging: typeof settings?.pageClickPaging === 'boolean' ? settings.pageClickPaging : defaultExtendedSettings.pageClickPaging,
    gesturePagingEnabled: typeof settings?.gesturePagingEnabled === 'boolean' ? settings.gesturePagingEnabled : defaultExtendedSettings.gesturePagingEnabled,
    gesturePagingThresholdPx: clampNumericString(settings?.gesturePagingThresholdPx, defaultExtendedSettings.gesturePagingThresholdPx, 40, 240),
    autoHideCursor: typeof settings?.autoHideCursor === 'boolean' ? settings.autoHideCursor : defaultExtendedSettings.autoHideCursor,
    booksOpenInStandaloneReader: typeof settings?.booksOpenInStandaloneReader === 'boolean' ? settings.booksOpenInStandaloneReader : defaultExtendedSettings.booksOpenInStandaloneReader,
    readerNavHiddenByStandaloneOnly: typeof settings?.readerNavHiddenByStandaloneOnly === 'boolean' ? settings.readerNavHiddenByStandaloneOnly : defaultExtendedSettings.readerNavHiddenByStandaloneOnly,
    pageTurnSound: typeof settings?.pageTurnSound === 'boolean' ? settings.pageTurnSound : defaultExtendedSettings.pageTurnSound,
    globalShortcutsEnabled: typeof settings?.globalShortcutsEnabled === 'boolean' ? settings.globalShortcutsEnabled : defaultExtendedSettings.globalShortcutsEnabled,
    commandPaletteIncludesSettings: typeof settings?.commandPaletteIncludesSettings === 'boolean' ? settings.commandPaletteIncludesSettings : defaultExtendedSettings.commandPaletteIncludesSettings,
    commandPaletteShortcut: isCommandPaletteShortcut(settings?.commandPaletteShortcut) ? settings.commandPaletteShortcut : defaultExtendedSettings.commandPaletteShortcut,
    commandPaletteShowDescriptions: typeof settings?.commandPaletteShowDescriptions === 'boolean' ? settings.commandPaletteShowDescriptions : defaultExtendedSettings.commandPaletteShowDescriptions,
    commandPaletteSortMode: isCommandPaletteSortMode(settings?.commandPaletteSortMode) ? settings.commandPaletteSortMode : defaultExtendedSettings.commandPaletteSortMode,
    navigationShortcuts: normalizeNavigationShortcuts(settings?.navigationShortcuts),
    importShortcut: isImportShortcut(settings?.importShortcut) ? settings.importShortcut : defaultExtendedSettings.importShortcut,
    aiSummaryShortcut: isAiSummaryShortcut(settings?.aiSummaryShortcut) ? settings.aiSummaryShortcut : defaultExtendedSettings.aiSummaryShortcut,
    defaultAiMode: normalizeDefaultAiMode(settings?.defaultAiMode, settings?.cloudAiEnabled, settings?.localAiEnabled),
    aiDefaultScope: isAiDefaultScope(settings?.aiDefaultScope) ? settings.aiDefaultScope : defaultExtendedSettings.aiDefaultScope,
    aiNoSelectionFallbackScope: isAiNoSelectionFallbackScope(settings?.aiNoSelectionFallbackScope) ? settings.aiNoSelectionFallbackScope : defaultExtendedSettings.aiNoSelectionFallbackScope,
    aiScopePriorityStrategy: isAiScopePriorityStrategy(settings?.aiScopePriorityStrategy) ? settings.aiScopePriorityStrategy : defaultExtendedSettings.aiScopePriorityStrategy,
    aiAutoDowngradeScopeOnTokenOverflow: typeof settings?.aiAutoDowngradeScopeOnTokenOverflow === 'boolean' ? settings.aiAutoDowngradeScopeOnTokenOverflow : defaultExtendedSettings.aiAutoDowngradeScopeOnTokenOverflow,
    aiScopeTokenLimit: clampNumericString(settings?.aiScopeTokenLimit, defaultExtendedSettings.aiScopeTokenLimit, 200, 200000),
    cloudAiRequestSizeLimitTokens: clampNumericString(settings?.cloudAiRequestSizeLimitTokens, defaultExtendedSettings.cloudAiRequestSizeLimitTokens, 1000, 200000),
    aiCommandDefaultScopes: normalizeAiCommandDefaultScopes(settings?.aiCommandDefaultScopes),
    aiSlashMenuEnabled: typeof settings?.aiSlashMenuEnabled === 'boolean' ? settings.aiSlashMenuEnabled : defaultExtendedSettings.aiSlashMenuEnabled,
    aiBuiltInSlashCommandEnabled: normalizeAiBuiltInSlashCommandEnabled(settings?.aiBuiltInSlashCommandEnabled),
    aiDefaultRetrievalStrategy: isAiRetrievalStrategy(settings?.aiDefaultRetrievalStrategy) ? settings.aiDefaultRetrievalStrategy : defaultExtendedSettings.aiDefaultRetrievalStrategy,
    aiRetrievalQueryRewriteMode: isAiRetrievalQueryRewriteMode(settings?.aiRetrievalQueryRewriteMode) ? settings.aiRetrievalQueryRewriteMode : defaultExtendedSettings.aiRetrievalQueryRewriteMode,
    aiMultiStageRetrievalMode: isAiMultiStageRetrievalMode(settings?.aiMultiStageRetrievalMode) ? settings.aiMultiStageRetrievalMode : defaultExtendedSettings.aiMultiStageRetrievalMode,
    aiCommandRetrievalStrategies: normalizeAiCommandRetrievalStrategies(settings?.aiCommandRetrievalStrategies),
    aiFallbackEnabled: typeof settings?.aiFallbackEnabled === 'boolean' ? settings.aiFallbackEnabled : defaultExtendedSettings.aiFallbackEnabled,
    aiFtsUnavailableBehavior: isAiFtsUnavailableBehavior(settings?.aiFtsUnavailableBehavior) ? settings.aiFtsUnavailableBehavior : defaultExtendedSettings.aiFtsUnavailableBehavior,
    aiLocalIndexResultLimit: clampNumericString(settings?.aiLocalIndexResultLimit, defaultExtendedSettings.aiLocalIndexResultLimit, 1, 100),
    aiCitationMinConfidence: clampDecimalString(settings?.aiCitationMinConfidence, defaultExtendedSettings.aiCitationMinConfidence, 0, 1, 2),
    aiDefaultOutputFormat: isAiDefaultOutputFormat(settings?.aiDefaultOutputFormat) ? settings.aiDefaultOutputFormat : defaultExtendedSettings.aiDefaultOutputFormat,
    aiRequireCitations: typeof settings?.aiRequireCitations === 'boolean' ? settings.aiRequireCitations : defaultExtendedSettings.aiRequireCitations,
    aiNoCitationWarningEnabled: typeof settings?.aiNoCitationWarningEnabled === 'boolean' ? settings.aiNoCitationWarningEnabled : defaultExtendedSettings.aiNoCitationWarningEnabled,
    aiCitationCoverageVisible: typeof settings?.aiCitationCoverageVisible === 'boolean' ? settings.aiCitationCoverageVisible : defaultExtendedSettings.aiCitationCoverageVisible,
    aiCitationCardDefaultDensity: isAiCitationCardDefaultDensity(settings?.aiCitationCardDefaultDensity) ? settings.aiCitationCardDefaultDensity : defaultExtendedSettings.aiCitationCardDefaultDensity,
    aiExternalCitationsDisabled: typeof settings?.aiExternalCitationsDisabled === 'boolean' ? settings.aiExternalCitationsDisabled : defaultExtendedSettings.aiExternalCitationsDisabled,
    aiCitationJumpRepairEnabled: typeof settings?.aiCitationJumpRepairEnabled === 'boolean' ? settings.aiCitationJumpRepairEnabled : defaultExtendedSettings.aiCitationJumpRepairEnabled,
    aiCitationFieldStrictness: isAiCitationFieldStrictness(settings?.aiCitationFieldStrictness) ? settings.aiCitationFieldStrictness : defaultExtendedSettings.aiCitationFieldStrictness,
    aiToolCallDisplayMode: isAiToolCallDisplayMode(settings?.aiToolCallDisplayMode) ? settings.aiToolCallDisplayMode : defaultExtendedSettings.aiToolCallDisplayMode,
    aiRenderedBlockLimit: clampNumericString(settings?.aiRenderedBlockLimit, defaultExtendedSettings.aiRenderedBlockLimit, 20, 500),
    aiCustomSlashCommandLimit: clampNumericString(settings?.aiCustomSlashCommandLimit, defaultExtendedSettings.aiCustomSlashCommandLimit, 0, 50),
    aiRecentSlashCommandLimit: clampNumericString(settings?.aiRecentSlashCommandLimit, defaultExtendedSettings.aiRecentSlashCommandLimit, 0, 20),
    aiSaveStructuredResponseWithNote: typeof settings?.aiSaveStructuredResponseWithNote === 'boolean' ? settings.aiSaveStructuredResponseWithNote : defaultExtendedSettings.aiSaveStructuredResponseWithNote,
    aiCitationDefaultSaveTarget: isAiCitationDefaultSaveTarget(settings?.aiCitationDefaultSaveTarget) ? settings.aiCitationDefaultSaveTarget : defaultExtendedSettings.aiCitationDefaultSaveTarget,
    knowledgeMarkdownExportIncludeAiMetadata: typeof settings?.knowledgeMarkdownExportIncludeAiMetadata === 'boolean' ? settings.knowledgeMarkdownExportIncludeAiMetadata : defaultExtendedSettings.knowledgeMarkdownExportIncludeAiMetadata,
    knowledgeMarkdownExportIncludeStructuredResponse: typeof settings?.knowledgeMarkdownExportIncludeStructuredResponse === 'boolean' ? settings.knowledgeMarkdownExportIncludeStructuredResponse : defaultExtendedSettings.knowledgeMarkdownExportIncludeStructuredResponse,
    knowledgeMarkdownExportPath: normalizeTextSetting(settings?.knowledgeMarkdownExportPath, defaultExtendedSettings.knowledgeMarkdownExportPath, 500),
    knowledgeDefaultColumns: normalizeKnowledgeDefaultColumns(settings?.knowledgeDefaultColumns),
    knowledgeBidirectionalLinksEnabled: typeof settings?.knowledgeBidirectionalLinksEnabled === 'boolean' ? settings.knowledgeBidirectionalLinksEnabled : defaultExtendedSettings.knowledgeBidirectionalLinksEnabled,
    knowledgeHighlightCardTemplate: normalizeTemplateSetting(settings?.knowledgeHighlightCardTemplate, defaultExtendedSettings.knowledgeHighlightCardTemplate, 800),
    knowledgeNoteCardTemplate: normalizeTemplateSetting(settings?.knowledgeNoteCardTemplate, defaultExtendedSettings.knowledgeNoteCardTemplate, 1000),
    knowledgeFlashcardCardTemplate: normalizeTemplateSetting(settings?.knowledgeFlashcardCardTemplate, defaultExtendedSettings.knowledgeFlashcardCardTemplate, 800),
    highlightFlashcardGenerationEnabled: typeof settings?.highlightFlashcardGenerationEnabled === 'boolean' ? settings.highlightFlashcardGenerationEnabled : defaultExtendedSettings.highlightFlashcardGenerationEnabled,
    highlightFlashcardDefaultTags: normalizeOptionalSpaceSeparatedSetting(settings?.highlightFlashcardDefaultTags, defaultExtendedSettings.highlightFlashcardDefaultTags, 160),
    highlightFlashcardDefaultReviewStatus: isHighlightReviewStatus(settings?.highlightFlashcardDefaultReviewStatus) ? settings.highlightFlashcardDefaultReviewStatus : defaultExtendedSettings.highlightFlashcardDefaultReviewStatus,
    highlightFlashcardFrontTemplate: normalizeTemplateSetting(settings?.highlightFlashcardFrontTemplate, defaultExtendedSettings.highlightFlashcardFrontTemplate, 500),
    highlightFlashcardBackTemplate: normalizeTemplateSetting(settings?.highlightFlashcardBackTemplate, defaultExtendedSettings.highlightFlashcardBackTemplate, 1000),
    cloudAiEnabled: typeof settings?.cloudAiEnabled === 'boolean' ? settings.cloudAiEnabled : defaultExtendedSettings.cloudAiEnabled,
    localAiEnabled: typeof settings?.localAiEnabled === 'boolean' ? settings.localAiEnabled : defaultExtendedSettings.localAiEnabled,
    cloudAiRequireConfirmation: typeof settings?.cloudAiRequireConfirmation === 'boolean' ? settings.cloudAiRequireConfirmation : defaultExtendedSettings.cloudAiRequireConfirmation,
    cloudAiAutoRedact: typeof settings?.cloudAiAutoRedact === 'boolean' ? settings.cloudAiAutoRedact : defaultExtendedSettings.cloudAiAutoRedact,
    cloudAiSensitiveWords: normalizeMultilineSetting(settings?.cloudAiSensitiveWords, defaultExtendedSettings.cloudAiSensitiveWords, 2000),
    cloudAiAllowSelectionText: typeof settings?.cloudAiAllowSelectionText === 'boolean' ? settings.cloudAiAllowSelectionText : defaultExtendedSettings.cloudAiAllowSelectionText,
    cloudAiAllowCurrentPageText: typeof settings?.cloudAiAllowCurrentPageText === 'boolean' ? settings.cloudAiAllowCurrentPageText : defaultExtendedSettings.cloudAiAllowCurrentPageText,
    cloudAiAllowCurrentChapterText: typeof settings?.cloudAiAllowCurrentChapterText === 'boolean' ? settings.cloudAiAllowCurrentChapterText : defaultExtendedSettings.cloudAiAllowCurrentChapterText,
    cloudAiAllowBookSummaryContext: typeof settings?.cloudAiAllowBookSummaryContext === 'boolean' ? settings.cloudAiAllowBookSummaryContext : defaultExtendedSettings.cloudAiAllowBookSummaryContext,
    cloudAiRequestHistoryEnabled: typeof settings?.cloudAiRequestHistoryEnabled === 'boolean' ? settings.cloudAiRequestHistoryEnabled : defaultExtendedSettings.cloudAiRequestHistoryEnabled,
    cloudAiRequestHistoryLimit: clampNumericString(settings?.cloudAiRequestHistoryLimit, defaultExtendedSettings.cloudAiRequestHistoryLimit, 0, 500),
    cloudAiRequestHistorySaveFailed: typeof settings?.cloudAiRequestHistorySaveFailed === 'boolean' ? settings.cloudAiRequestHistorySaveFailed : defaultExtendedSettings.cloudAiRequestHistorySaveFailed,
    cloudAiRequestHistorySaveStopped: typeof settings?.cloudAiRequestHistorySaveStopped === 'boolean' ? settings.cloudAiRequestHistorySaveStopped : defaultExtendedSettings.cloudAiRequestHistorySaveStopped,
    cloudAiFallbackToLocalOnFailure: typeof settings?.cloudAiFallbackToLocalOnFailure === 'boolean' ? settings.cloudAiFallbackToLocalOnFailure : defaultExtendedSettings.cloudAiFallbackToLocalOnFailure,
    aiHybridLocalFirstCloudSummary: typeof settings?.aiHybridLocalFirstCloudSummary === 'boolean' ? settings.aiHybridLocalFirstCloudSummary : defaultExtendedSettings.aiHybridLocalFirstCloudSummary,
    aiStreamingFlushIntervalMs: clampNumericString(settings?.aiStreamingFlushIntervalMs, defaultExtendedSettings.aiStreamingFlushIntervalMs, 16, 500),
    localAiCancelTimeoutMs: clampNumericString(settings?.localAiCancelTimeoutMs, defaultExtendedSettings.localAiCancelTimeoutMs, 100, 10000),
    sidecarEnabled: typeof settings?.sidecarEnabled === 'boolean' ? settings.sidecarEnabled : defaultExtendedSettings.sidecarEnabled,
    sidecarCommand: normalizePathTextSetting(settings?.sidecarCommand, defaultExtendedSettings.sidecarCommand, 500),
    sidecarWorkingDir: normalizePathTextSetting(settings?.sidecarWorkingDir, defaultExtendedSettings.sidecarWorkingDir, 500),
    sidecarHealthTimeoutMs: clampNumericString(settings?.sidecarHealthTimeoutMs, defaultExtendedSettings.sidecarHealthTimeoutMs, 1000, 60000),
    sidecarMaxMemoryMb: clampNumericString(settings?.sidecarMaxMemoryMb, defaultExtendedSettings.sidecarMaxMemoryMb, 256, 65536),
    experimentalAiToolCallingEnabled: typeof settings?.experimentalAiToolCallingEnabled === 'boolean' ? settings.experimentalAiToolCallingEnabled : defaultExtendedSettings.experimentalAiToolCallingEnabled,
    experimentalEpubPdfEnabled: typeof settings?.experimentalEpubPdfEnabled === 'boolean' ? settings.experimentalEpubPdfEnabled : defaultExtendedSettings.experimentalEpubPdfEnabled,
    experimentalMultiWindowConflictResolutionEnabled: typeof settings?.experimentalMultiWindowConflictResolutionEnabled === 'boolean' ? settings.experimentalMultiWindowConflictResolutionEnabled : defaultExtendedSettings.experimentalMultiWindowConflictResolutionEnabled,
    experimentalKnowledgeGraphEnabled: typeof settings?.experimentalKnowledgeGraphEnabled === 'boolean' ? settings.experimentalKnowledgeGraphEnabled : defaultExtendedSettings.experimentalKnowledgeGraphEnabled,
    experimentalSyncEnabled: typeof settings?.experimentalSyncEnabled === 'boolean' ? settings.experimentalSyncEnabled : defaultExtendedSettings.experimentalSyncEnabled,
    applicationPrivacyMode: typeof settings?.applicationPrivacyMode === 'boolean' ? settings.applicationPrivacyMode : defaultExtendedSettings.applicationPrivacyMode,
    hideRecentReadingInPrivacyMode: typeof settings?.hideRecentReadingInPrivacyMode === 'boolean' ? settings.hideRecentReadingInPrivacyMode : defaultExtendedSettings.hideRecentReadingInPrivacyMode,
    hideFilePathsInPrivacyMode: typeof settings?.hideFilePathsInPrivacyMode === 'boolean' ? settings.hideFilePathsInPrivacyMode : defaultExtendedSettings.hideFilePathsInPrivacyMode,
    hideBookTitlesInPrivacyMode: typeof settings?.hideBookTitlesInPrivacyMode === 'boolean' ? settings.hideBookTitlesInPrivacyMode : defaultExtendedSettings.hideBookTitlesInPrivacyMode,
    appLockEnabled: typeof settings?.appLockEnabled === 'boolean' ? settings.appLockEnabled : defaultExtendedSettings.appLockEnabled,
    appLockIdleTimeoutMinutes: clampNumericString(settings?.appLockIdleTimeoutMinutes, defaultExtendedSettings.appLockIdleTimeoutMinutes, 1, 240),
    copyDiagnosticsAutoRedact: typeof settings?.copyDiagnosticsAutoRedact === 'boolean' ? settings.copyDiagnosticsAutoRedact : defaultExtendedSettings.copyDiagnosticsAutoRedact,
    operationLogRecordInputContent: typeof settings?.operationLogRecordInputContent === 'boolean' ? settings.operationLogRecordInputContent : defaultExtendedSettings.operationLogRecordInputContent,
    operationLogRecordPaths: typeof settings?.operationLogRecordPaths === 'boolean' ? settings.operationLogRecordPaths : defaultExtendedSettings.operationLogRecordPaths,
    translationFallbackStrategy: isTranslationFallbackStrategy(settings?.translationFallbackStrategy) ? settings.translationFallbackStrategy : defaultExtendedSettings.translationFallbackStrategy,
    customTerminologyEnabled: typeof settings?.customTerminologyEnabled === 'boolean' ? settings.customTerminologyEnabled : defaultExtendedSettings.customTerminologyEnabled,
    customTerminologyRules: normalizeMultilineSetting(settings?.customTerminologyRules, defaultExtendedSettings.customTerminologyRules, 2000),
    reduceMotion: typeof settings?.reduceMotion === 'boolean' ? settings.reduceMotion : defaultExtendedSettings.reduceMotion,
    highContrast: typeof settings?.highContrast === 'boolean' ? settings.highContrast : defaultExtendedSettings.highContrast,
    enhancedFocus: typeof settings?.enhancedFocus === 'boolean' ? settings.enhancedFocus : defaultExtendedSettings.enhancedFocus,
    largeTouchTargets: typeof settings?.largeTouchTargets === 'boolean' ? settings.largeTouchTargets : defaultExtendedSettings.largeTouchTargets,
    colorBlindFriendlyHighlights: typeof settings?.colorBlindFriendlyHighlights === 'boolean' ? settings.colorBlindFriendlyHighlights : defaultExtendedSettings.colorBlindFriendlyHighlights,
    readerReadAloudEnabled: typeof settings?.readerReadAloudEnabled === 'boolean' ? settings.readerReadAloudEnabled : defaultExtendedSettings.readerReadAloudEnabled,
    readerReadAloudRate: clampNumericString(settings?.readerReadAloudRate, defaultExtendedSettings.readerReadAloudRate, 50, 200),
    readerReadAloudPitch: clampNumericString(settings?.readerReadAloudPitch, defaultExtendedSettings.readerReadAloudPitch, 50, 200),
    readerReadAloudNarratorVoiceURI: normalizePathTextSetting(settings?.readerReadAloudNarratorVoiceURI, defaultExtendedSettings.readerReadAloudNarratorVoiceURI, 240),
    readerReadAloudMaleVoiceURI: normalizePathTextSetting(settings?.readerReadAloudMaleVoiceURI, defaultExtendedSettings.readerReadAloudMaleVoiceURI, 240),
    readerReadAloudFemaleVoiceURI: normalizePathTextSetting(settings?.readerReadAloudFemaleVoiceURI, defaultExtendedSettings.readerReadAloudFemaleVoiceURI, 240),
    readerReadAloudCharacterVoiceRules: normalizeMultilineSetting(settings?.readerReadAloudCharacterVoiceRules, defaultExtendedSettings.readerReadAloudCharacterVoiceRules, 8000),
    moyuReaderProfile: normalizeMoyuReaderProfile(settings?.moyuReaderProfile),
    globalSearchHistoryLimit: clampNumericString(settings?.globalSearchHistoryLimit, defaultExtendedSettings.globalSearchHistoryLimit, 0, 20),
    globalSearchSavedLimit: clampNumericString(settings?.globalSearchSavedLimit, defaultExtendedSettings.globalSearchSavedLimit, 0, 20),
    readerSearchRegexFallbackLiteral: typeof settings?.readerSearchRegexFallbackLiteral === 'boolean' ? settings.readerSearchRegexFallbackLiteral : defaultExtendedSettings.readerSearchRegexFallbackLiteral,
    searchNormalizeTraditionalChinese: typeof settings?.searchNormalizeTraditionalChinese === 'boolean' ? settings.searchNormalizeTraditionalChinese : defaultExtendedSettings.searchNormalizeTraditionalChinese,
    searchNormalizeNfkc: typeof settings?.searchNormalizeNfkc === 'boolean' ? settings.searchNormalizeNfkc : defaultExtendedSettings.searchNormalizeNfkc,
    searchPinyinInitials: typeof settings?.searchPinyinInitials === 'boolean' ? settings.searchPinyinInitials : defaultExtendedSettings.searchPinyinInitials,
    autoIndexImportedBooks: typeof settings?.autoIndexImportedBooks === 'boolean' ? settings.autoIndexImportedBooks : defaultExtendedSettings.autoIndexImportedBooks,
    indexStrategyVersion: isIndexStrategyVersion(settings?.indexStrategyVersion) ? settings.indexStrategyVersion : defaultExtendedSettings.indexStrategyVersion,
    indexChunkSize: clampNumericString(settings?.indexChunkSize, defaultExtendedSettings.indexChunkSize, 200, 5000),
    indexChunkOverlap: clampNumericString(settings?.indexChunkOverlap, defaultExtendedSettings.indexChunkOverlap, 0, 1000),
    indexRebuildStrategy: isIndexRebuildStrategy(settings?.indexRebuildStrategy) ? settings.indexRebuildStrategy : defaultExtendedSettings.indexRebuildStrategy,
    ftsRepairStrategy: isFtsRepairStrategy(settings?.ftsRepairStrategy) ? settings.ftsRepairStrategy : defaultExtendedSettings.ftsRepairStrategy,
    indexRecentErrorLimit: clampNumericString(settings?.indexRecentErrorLimit, defaultExtendedSettings.indexRecentErrorLimit, 0, 50),
    indexPauseResumeStrategy: isIndexPauseResumeStrategy(settings?.indexPauseResumeStrategy) ? settings.indexPauseResumeStrategy : defaultExtendedSettings.indexPauseResumeStrategy,
    readerSearchHistoryLimit: clampNumericString(settings?.readerSearchHistoryLimit, defaultExtendedSettings.readerSearchHistoryLimit, 0, 20),
    readerSavedSearchLimit: clampNumericString(settings?.readerSavedSearchLimit, defaultExtendedSettings.readerSavedSearchLimit, 0, 20),
    readerSearchChapterFilterDefault: settings?.readerSearchChapterFilterDefault === 'current' ? 'current' : 'all',
    readerSearchHighlightColor: isReaderSearchHighlightColor(settings?.readerSearchHighlightColor) ? settings.readerSearchHighlightColor : defaultExtendedSettings.readerSearchHighlightColor,
    libraryDensity: isLibraryDensity(settings?.libraryDensity) ? settings.libraryDensity : defaultExtendedSettings.libraryDensity,
    taskConcurrency: clampNumericString(settings?.taskConcurrency, defaultExtendedSettings.taskConcurrency, 1, 8),
    importConcurrency: clampNumericString(settings?.importConcurrency, defaultExtendedSettings.importConcurrency, 1, 8),
    parseConcurrency: clampNumericString(settings?.parseConcurrency, defaultExtendedSettings.parseConcurrency, 1, 8),
    ftsWriteSerial: typeof settings?.ftsWriteSerial === 'boolean' ? settings.ftsWriteSerial : defaultExtendedSettings.ftsWriteSerial,
    vectorConcurrencyReserved: clampNumericString(settings?.vectorConcurrencyReserved, defaultExtendedSettings.vectorConcurrencyReserved, 0, 8),
    taskRetryCount: clampNumericString(settings?.taskRetryCount, defaultExtendedSettings.taskRetryCount, 0, 5),
    operationLogRetention: clampNumericString(settings?.operationLogRetention, defaultExtendedSettings.operationLogRetention, 0, 500),
    taskLogRetention: isTaskLogRetention(settings?.taskLogRetention) ? settings.taskLogRetention : defaultExtendedSettings.taskLogRetention,
    completedTaskRetentionLimit: clampNumericString(settings?.completedTaskRetentionLimit, defaultExtendedSettings.completedTaskRetentionLimit, 0, 5000),
    dataAutoBackupEnabled: typeof settings?.dataAutoBackupEnabled === 'boolean' ? settings.dataAutoBackupEnabled : defaultExtendedSettings.dataAutoBackupEnabled,
    dataAutoBackupFrequency: isDataAutoBackupFrequency(settings?.dataAutoBackupFrequency) ? settings.dataAutoBackupFrequency : defaultExtendedSettings.dataAutoBackupFrequency,
    dataAutoBackupRetentionLimit: clampNumericString(settings?.dataAutoBackupRetentionLimit, defaultExtendedSettings.dataAutoBackupRetentionLimit, 1, 30),
    dataBackupMode: isDataBackupMode(settings?.dataBackupMode) ? settings.dataBackupMode : defaultExtendedSettings.dataBackupMode,
  };
}

function isHighlightColor(value: unknown): value is ExtendedSettings['defaultHighlightColor'] {
  return value === 'yellow' || value === 'green' || value === 'blue' || value === 'pink' || value === 'violet' || value === 'red';
}

function normalizeHighlightColorMeanings(value: unknown): ExtendedSettings['highlightColorMeanings'] {
  const draft = value && typeof value === 'object' ? value as Partial<Record<ExtendedSettings['defaultHighlightColor'], unknown>> : {};
  return {
    yellow: normalizeTextSetting(draft.yellow, defaultHighlightColorMeanings.yellow, 120),
    green: normalizeTextSetting(draft.green, defaultHighlightColorMeanings.green, 120),
    blue: normalizeTextSetting(draft.blue, defaultHighlightColorMeanings.blue, 120),
    pink: normalizeTextSetting(draft.pink, defaultHighlightColorMeanings.pink, 120),
    violet: normalizeTextSetting(draft.violet, defaultHighlightColorMeanings.violet, 120),
    red: normalizeTextSetting(draft.red, defaultHighlightColorMeanings.red, 120),
  };
}

function normalizeHighlightColorShortcuts(value: unknown): ExtendedSettings['highlightColorShortcuts'] {
  const draft = value && typeof value === 'object' ? value as Partial<Record<ExtendedSettings['defaultHighlightColor'], unknown>> : {};
  const usedShortcuts = new Set<ExtendedSettings['highlightColorShortcuts'][ExtendedSettings['defaultHighlightColor']]>();
  const normalizeUniqueShortcut = (shortcutValue: unknown, fallback: ExtendedSettings['highlightColorShortcuts'][ExtendedSettings['defaultHighlightColor']]) => {
    const normalized = normalizeHighlightColorShortcut(shortcutValue, fallback);
    if (normalized !== 'disabled' && usedShortcuts.has(normalized)) return 'disabled';
    if (normalized !== 'disabled') usedShortcuts.add(normalized);
    return normalized;
  };
  return {
    yellow: normalizeUniqueShortcut(draft.yellow, defaultHighlightColorShortcuts.yellow),
    green: normalizeUniqueShortcut(draft.green, defaultHighlightColorShortcuts.green),
    blue: normalizeUniqueShortcut(draft.blue, defaultHighlightColorShortcuts.blue),
    pink: normalizeUniqueShortcut(draft.pink, defaultHighlightColorShortcuts.pink),
    violet: normalizeUniqueShortcut(draft.violet, defaultHighlightColorShortcuts.violet),
    red: normalizeUniqueShortcut(draft.red, defaultHighlightColorShortcuts.red),
  };
}

function normalizeHighlightColorShortcut(value: unknown, fallback: ExtendedSettings['highlightColorShortcuts'][ExtendedSettings['defaultHighlightColor']]) {
  return value === '1' || value === '2' || value === '3' || value === '4' || value === '5' || value === '6' || value === 'disabled' ? value : fallback;
}

function isAnnotationExportContent(value: unknown): value is ExtendedSettings['annotationExportContent'] {
  return value === 'highlights' || value === 'bookmarks' || value === 'notes' || value === 'all';
}

function isAnnotationJsonImportConflictStrategy(value: unknown): value is ExtendedSettings['annotationJsonImportConflictStrategy'] {
  return value === 'skip' || value === 'overwrite' || value === 'merge';
}

function isNoteDefaultSaveTarget(value: unknown): value is ExtendedSettings['noteDefaultSaveTarget'] {
  return value === 'knowledge' || value === 'book' || value === 'inbox';
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function isHighlightImportance(value: unknown): value is ExtendedSettings['defaultHighlightImportance'] {
  return value === 'normal' || value === 'high' || value === 'critical';
}

function isHighlightReviewStatus(value: unknown): value is ExtendedSettings['defaultHighlightReviewStatus'] {
  return value === 'new' || value === 'due' || value === 'reviewed';
}

function isHighlightOverlapStrategy(value: unknown): value is ExtendedSettings['highlightOverlapStrategy'] {
  return value === 'first-start-longest' || value === 'latest-created' || value === 'highest-importance';
}

function isAnchorRepairStrategy(value: unknown): value is ExtendedSettings['anchorRepairStrategy'] {
  return value === 'context-first' || value === 'text-first' || value === 'manual';
}

function isBookmarkSort(value: unknown): value is ExtendedSettings['defaultBookmarkSort'] {
  return value === 'created-desc' || value === 'created-asc' || value === 'chapter-asc';
}

function isBookmarkGroupBy(value: unknown): value is ExtendedSettings['defaultBookmarkGroupBy'] {
  return value === 'none' || value === 'chapter' || value === 'created' || value === 'tag';
}

function isReaderSearchHighlightColor(value: unknown): value is ExtendedSettings['readerSearchHighlightColor'] {
  return value === 'amber' || value === 'blue' || value === 'green' || value === 'pink' || value === 'violet' || value === 'red';
}

function isIndexStrategyVersion(value: unknown): value is ExtendedSettings['indexStrategyVersion'] {
  return value === 'stable' || value === 'latest' || value === 'compat';
}

function isIndexRebuildStrategy(value: unknown): value is ExtendedSettings['indexRebuildStrategy'] {
  return value === 'manual' || value === 'prompt' || value === 'auto';
}

function isTocRuleChangeRebuildMode(value: unknown): value is ExtendedSettings['tocRuleChangeRebuildMode'] {
  return value === 'off' || value === 'prompt' || value === 'auto';
}

function isFtsRepairStrategy(value: unknown): value is ExtendedSettings['ftsRepairStrategy'] {
  return value === 'manual' || value === 'prompt' || value === 'auto';
}

function isIndexPauseResumeStrategy(value: unknown): value is ExtendedSettings['indexPauseResumeStrategy'] {
  return value === 'manual' || value === 'ask' || value === 'auto';
}

function isTaskLogRetention(value: unknown): value is ExtendedSettings['taskLogRetention'] {
  return value === 'session' || value === '7-days' || value === '30-days' || value === '90-days' || value === 'forever';
}

function isDataAutoBackupFrequency(value: unknown): value is ExtendedSettings['dataAutoBackupFrequency'] {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function isDataBackupMode(value: unknown): value is ExtendedSettings['dataBackupMode'] {
  return value === 'full' || value === 'incremental';
}

function isAiMode(value: unknown): value is ExtendedSettings['defaultAiMode'] {
  return value === 'local' || value === 'cloud' || value === 'mock';
}

function normalizeDefaultAiMode(value: unknown, cloudAiEnabled: unknown, localAiEnabled: unknown): ExtendedSettings['defaultAiMode'] {
  const mode = isAiMode(value) ? value : defaultExtendedSettings.defaultAiMode;
  const cloudEnabled = cloudAiEnabled !== false;
  const localEnabled = localAiEnabled !== false;
  if (mode === 'cloud' && !cloudEnabled) return localEnabled ? 'local' : 'mock';
  if (mode === 'local' && !localEnabled) return cloudEnabled ? 'cloud' : 'mock';
  return mode;
}

function isAiDefaultScope(value: unknown): value is ExtendedSettings['aiDefaultScope'] {
  return value === 'selection' || value === 'page-lite' || value === 'page' || value === 'chapter' || value === 'volume' || value === 'book' || value === 'annotations' || value === 'library';
}

function isAiNoSelectionFallbackScope(value: unknown): value is ExtendedSettings['aiNoSelectionFallbackScope'] {
  return value === 'page' || value === 'chapter' || value === 'book';
}

function isAiScopePriorityStrategy(value: unknown): value is ExtendedSettings['aiScopePriorityStrategy'] {
  return value === 'command-first' || value === 'panel-first' || value === 'narrowest-first';
}

function isAiRetrievalStrategy(value: unknown): value is ExtendedSettings['aiDefaultRetrievalStrategy'] {
  return value === 'scope-first' || value === 'entity-extraction' || value === 'anomaly-extraction' || value === 'timeline-extraction' || value === 'key-sentences';
}

function isAiRetrievalQueryRewriteMode(value: unknown): value is ExtendedSettings['aiRetrievalQueryRewriteMode'] {
  return value === 'off' || value === 'basic';
}

function isAiMultiStageRetrievalMode(value: unknown): value is ExtendedSettings['aiMultiStageRetrievalMode'] {
  return value === 'off' || value === 'auto';
}

function isAiFtsUnavailableBehavior(value: unknown): value is ExtendedSettings['aiFtsUnavailableBehavior'] {
  return value === 'show-warning' || value === 'text-fallback' || value === 'fail-fast';
}

function isAiDefaultOutputFormat(value: unknown): value is ExtendedSettings['aiDefaultOutputFormat'] {
  return value === 'structured' || value === 'markdown';
}

function isAiCitationCardDefaultDensity(value: unknown): value is ExtendedSettings['aiCitationCardDefaultDensity'] {
  return value === 'compact' || value === 'detailed';
}

function isAiCitationFieldStrictness(value: unknown): value is ExtendedSettings['aiCitationFieldStrictness'] {
  return value === 'lenient' || value === 'normal' || value === 'strict';
}

function isAiToolCallDisplayMode(value: unknown): value is ExtendedSettings['aiToolCallDisplayMode'] {
  return value === 'hidden' || value === 'summary' || value === 'full';
}

function isAiCitationDefaultSaveTarget(value: unknown): value is ExtendedSettings['aiCitationDefaultSaveTarget'] {
  return value === 'highlight' || value === 'excerpt' || value === 'both';
}

function normalizeAiCommandDefaultScopes(value: unknown): ExtendedSettings['aiCommandDefaultScopes'] {
  const draft = value && typeof value === 'object' ? value as Partial<ExtendedSettings['aiCommandDefaultScopes']> : {};
  return {
    summary: isAiDefaultScope(draft.summary) ? draft.summary : defaultExtendedSettings.aiCommandDefaultScopes.summary,
    characters: isAiDefaultScope(draft.characters) ? draft.characters : defaultExtendedSettings.aiCommandDefaultScopes.characters,
    foreshadow: isAiDefaultScope(draft.foreshadow) ? draft.foreshadow : defaultExtendedSettings.aiCommandDefaultScopes.foreshadow,
    timeline: isAiDefaultScope(draft.timeline) ? draft.timeline : defaultExtendedSettings.aiCommandDefaultScopes.timeline,
    cards: isAiDefaultScope(draft.cards) ? draft.cards : defaultExtendedSettings.aiCommandDefaultScopes.cards,
  };
}

export function loadAiCustomSlashCommands(limit = 8): AiCustomSlashCommandDraft[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(aiCustomSlashCommandsStorageKey) ?? '[]') as Partial<AiCustomSlashCommandDraft>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeAiCustomSlashCommandDraft)
      .filter((item): item is AiCustomSlashCommandDraft => Boolean(item))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function saveAiCustomSlashCommands(commands: AiCustomSlashCommandDraft[]) {
  window.localStorage.setItem(aiCustomSlashCommandsStorageKey, JSON.stringify(commands.map((command) => normalizeAiCustomSlashCommandDraft(command)).filter(Boolean)));
  emitAiCustomSlashCommandsUpdated();
}

function normalizeAiCustomSlashCommandDraft(value: Partial<AiCustomSlashCommandDraft> | null | undefined): AiCustomSlashCommandDraft | null {
  if (!value?.id?.startsWith('custom-') || !value.label || !value.prompt) return null;
  return {
    id: value.id as `custom-${string}`,
    label: String(value.label).slice(0, 80),
    prompt: String(value.prompt).slice(0, 8000),
    aliases: Array.isArray(value.aliases) ? value.aliases.map(String).filter(Boolean).slice(0, 12) : [String(value.label)],
    scopeHint: isAiDefaultScope(value.scopeHint) ? value.scopeHint : 'chapter',
    outputHint: String(value.outputHint ?? 'custom').slice(0, 120),
    retrievalStrategy: 'scope-first',
  };
}

function normalizeAiBuiltInSlashCommandEnabled(value: unknown): ExtendedSettings['aiBuiltInSlashCommandEnabled'] {
  const draft = value && typeof value === 'object' ? value as Partial<ExtendedSettings['aiBuiltInSlashCommandEnabled']> : {};
  return {
    summary: typeof draft.summary === 'boolean' ? draft.summary : defaultExtendedSettings.aiBuiltInSlashCommandEnabled.summary,
    characters: typeof draft.characters === 'boolean' ? draft.characters : defaultExtendedSettings.aiBuiltInSlashCommandEnabled.characters,
    foreshadow: typeof draft.foreshadow === 'boolean' ? draft.foreshadow : defaultExtendedSettings.aiBuiltInSlashCommandEnabled.foreshadow,
    timeline: typeof draft.timeline === 'boolean' ? draft.timeline : defaultExtendedSettings.aiBuiltInSlashCommandEnabled.timeline,
    cards: typeof draft.cards === 'boolean' ? draft.cards : defaultExtendedSettings.aiBuiltInSlashCommandEnabled.cards,
  };
}

function normalizeAiCommandRetrievalStrategies(value: unknown): ExtendedSettings['aiCommandRetrievalStrategies'] {
  const draft = value && typeof value === 'object' ? value as Partial<ExtendedSettings['aiCommandRetrievalStrategies']> : {};
  return {
    summary: isAiRetrievalStrategy(draft.summary) ? draft.summary : defaultExtendedSettings.aiCommandRetrievalStrategies.summary,
    characters: isAiRetrievalStrategy(draft.characters) ? draft.characters : defaultExtendedSettings.aiCommandRetrievalStrategies.characters,
    foreshadow: isAiRetrievalStrategy(draft.foreshadow) ? draft.foreshadow : defaultExtendedSettings.aiCommandRetrievalStrategies.foreshadow,
    timeline: isAiRetrievalStrategy(draft.timeline) ? draft.timeline : defaultExtendedSettings.aiCommandRetrievalStrategies.timeline,
    cards: isAiRetrievalStrategy(draft.cards) ? draft.cards : defaultExtendedSettings.aiCommandRetrievalStrategies.cards,
  };
}

function isLibraryDensity(value: unknown): value is ExtendedSettings['libraryDensity'] {
  return value === 'compact' || value === 'comfortable' || value === 'spacious';
}

function isMultiWindowConflictStrategy(value: unknown): value is ExtendedSettings['multiWindowConflictStrategy'] {
  return value === 'latest' || value === 'current-window' || value === 'manual';
}

function isReaderProgressMode(value: unknown): value is ExtendedSettings['readerProgressMode'] {
  return value === 'chapters' || value === 'characters' || value === 'pages';
}

function isCommandPaletteShortcut(value: unknown): value is ExtendedSettings['commandPaletteShortcut'] {
  return value === 'ctrl-k' || value === 'ctrl-p' || value === 'ctrl-shift-p' || value === 'disabled';
}

function isStartupOverviewMode(value: unknown): value is ExtendedSettings['startupOverviewMode'] {
  return value === 'auto' || value === 'welcome' || value === 'recent' || value === 'emptyGuide';
}

function isBackgroundTaskNotificationMode(value: unknown): value is ExtendedSettings['backgroundTaskNotificationMode'] {
  return value === 'silent' || value === 'toast' || value === 'system-notification';
}

function isTaskCenterDefaultStatusFilter(value: unknown): value is ExtendedSettings['taskCenterDefaultStatusFilter'] {
  return value === 'all'
    || value === 'queued'
    || value === 'running'
    || value === 'paused'
    || value === 'cancelling'
    || value === 'cancelled'
    || value === 'failed'
    || value === 'succeeded'
    || value === 'skipped'
    || value === 'archived';
}

function isCommandPaletteSortMode(value: unknown): value is ExtendedSettings['commandPaletteSortMode'] {
  return value === 'fixed' || value === 'recent';
}

function normalizeNavigationShortcuts(value: unknown): ExtendedSettings['navigationShortcuts'] {
  const draft = typeof value === 'object' && value !== null ? value as Partial<ExtendedSettings['navigationShortcuts']> : {};
  return {
    reader: draft.reader === 'ctrl-r' || draft.reader === 'disabled' ? draft.reader : defaultExtendedSettings.navigationShortcuts.reader,
    library: draft.library === 'ctrl-alt-l' || draft.library === 'disabled' ? draft.library : defaultExtendedSettings.navigationShortcuts.library,
    search: draft.search === 'ctrl-alt-f' || draft.search === 'disabled' ? draft.search : defaultExtendedSettings.navigationShortcuts.search,
  };
}

function normalizeReaderShortcuts(value: unknown): ExtendedSettings['readerShortcuts'] {
  const draft = typeof value === 'object' && value !== null ? value as Partial<ExtendedSettings['readerShortcuts']> : {};
  return {
    highlight: draft.highlight === 'ctrl-h' || draft.highlight === 'disabled' ? draft.highlight : defaultExtendedSettings.readerShortcuts.highlight,
    bookmark: draft.bookmark === 'ctrl-m' || draft.bookmark === 'disabled' ? draft.bookmark : defaultExtendedSettings.readerShortcuts.bookmark,
    aiPanel: draft.aiPanel === 'ctrl-alt-a' || draft.aiPanel === 'disabled' ? draft.aiPanel : defaultExtendedSettings.readerShortcuts.aiPanel,
    search: draft.search === 'slash' || draft.search === 'disabled' ? draft.search : defaultExtendedSettings.readerShortcuts.search,
  };
}

function isImportShortcut(value: unknown): value is ExtendedSettings['importShortcut'] {
  return value === 'ctrl-i' || value === 'ctrl-alt-i' || value === 'disabled';
}

function isImportFileFilter(value: unknown): value is ExtendedSettings['importFileFilter'] {
  return value === 'txt' || value === 'all';
}

function isTxtImportEncodingMode(value: unknown): value is ExtendedSettings['txtImportEncodingMode'] {
  return value === 'auto' || value === 'utf-8' || value === 'gb18030';
}

function isDefaultCoverToneStrategy(value: unknown): value is ExtendedSettings['defaultCoverToneStrategy'] {
  return value === 'format' || value === 'hash' || value === 'progress';
}

function isDefaultCoverLabelStrategy(value: unknown): value is ExtendedSettings['defaultCoverLabelStrategy'] {
  return value === 'format' || value === 'ai' || value === 'read' || value === 'knowledge' || value === 'first-char';
}

function isAiSummaryShortcut(value: unknown): value is ExtendedSettings['aiSummaryShortcut'] {
  return value === 'ctrl-enter' || value === 'ctrl-shift-enter' || value === 'disabled';
}

function normalizeVisibleNavItems(value: unknown): ExtendedSettings['visibleNavItems'] {
  const requested = Array.isArray(value) ? value : defaultExtendedSettings.visibleNavItems;
  const visible = requested.filter((item): item is ExtendedSettings['visibleNavItems'][number] => allNavItems.includes(item as ExtendedSettings['visibleNavItems'][number]));
  return Array.from(new Set([...visible, 'settings']));
}

function normalizeTopbarButtonVisibility(value: unknown): ExtendedSettings['topbarButtonVisibility'] {
  const draft = typeof value === 'object' && value !== null ? value as Partial<ExtendedSettings['topbarButtonVisibility']> : {};
  return {
    command: typeof draft.command === 'boolean' ? draft.command : defaultExtendedSettings.topbarButtonVisibility.command,
    night: typeof draft.night === 'boolean' ? draft.night : defaultExtendedSettings.topbarButtonVisibility.night,
    search: typeof draft.search === 'boolean' ? draft.search : defaultExtendedSettings.topbarButtonVisibility.search,
    aiSummary: typeof draft.aiSummary === 'boolean' ? draft.aiSummary : defaultExtendedSettings.topbarButtonVisibility.aiSummary,
  };
}

function clampNumericString(value: string | undefined, fallback: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(Math.min(max, Math.max(min, Math.floor(parsed))));
}

function clampDecimalString(value: string | undefined, fallback: string, min: number, max: number, precision: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return String(Number(bounded.toFixed(precision)));
}

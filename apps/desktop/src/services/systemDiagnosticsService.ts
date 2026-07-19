import type { ExtendedSettings, AiApiKeyStorageStatus, AiCustomSlashCommandDraft, LocalEncryptionStatus } from './settingsCenterService';
import type { CloudAiRequestHistoryEntry } from './cloudAiHistoryService';
import type { CloudAiTestResult } from './aiService';
import type { AppSettings, ReaderSettings } from '../types';

type DiagnosticPrimitive = null | boolean | number | string;
type DiagnosticValue = DiagnosticPrimitive | DiagnosticValue[] | { [key: string]: DiagnosticValue | RedactedPathHash };

type RedactedPathHash = {
  pathHash: string;
};

type RuntimeViewport = {
  width: number;
  height: number;
};

type RuntimeScreen = RuntimeViewport & {
  colorDepth: number;
};

export type RuntimeDiagnosticsSnapshot = {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  online: boolean;
  viewport: RuntimeViewport;
  screen: RuntimeScreen;
  devicePixelRatio: number;
  colorScheme: 'dark' | 'light' | 'unknown';
  reducedMotion: boolean;
  tauriRuntime: boolean;
};

type ChapterRulesDiagnosticsInput = {
  enabled?: boolean;
  maxHeadingLength?: number;
  enableChineseChapter?: boolean;
  enableChineseVolume?: boolean;
  enableSpecialHeadings?: boolean;
  enableEnglishChapter?: boolean;
  adKeywords?: string;
  customRegexRules?: unknown[];
  customCleanupRules?: unknown[];
};

export type ApplicationDiagnosticsInput = {
  exportedAt?: string;
  appSettings: AppSettings;
  extendedSettings: Partial<ExtendedSettings>;
  readerSettings: Partial<ReaderSettings>;
  chapterRules: ChapterRulesDiagnosticsInput;
  diagnosticPaths?: unknown;
  localEncryptionStatus?: Partial<LocalEncryptionStatus> | null;
  aiApiKeyStorageStatus?: Partial<AiApiKeyStorageStatus> | null;
  indexDiagnostics?: unknown;
  taskStatuses?: unknown[];
  taskLogs?: unknown[];
  operationLogs?: unknown[];
  lifecycleDiagnostics?: unknown[];
  runtime: RuntimeDiagnosticsSnapshot;
};

export type SystemInfoDiagnosticsInput = {
  copiedAt?: string;
  appSettings: AppSettings;
  extendedSettings: Partial<ExtendedSettings>;
  diagnosticPaths?: unknown;
  localEncryptionStatus?: Partial<LocalEncryptionStatus> | null;
  aiApiKeyStorageStatus?: Partial<AiApiKeyStorageStatus> | null;
  runtime: RuntimeDiagnosticsSnapshot;
};

export type ReaderDiagnosticsInput = {
  exportedAt?: string;
  readerSettings: Partial<ReaderSettings>;
  extendedSettings: Partial<ExtendedSettings>;
  chapterRules: ChapterRulesDiagnosticsInput;
  fontRenderingDiagnostics?: unknown;
  parserDiagnostics?: unknown;
  runtime: RuntimeDiagnosticsSnapshot;
};

export type IndexDiagnosticsExportInput = {
  exportedAt?: string;
  indexDiagnostics: unknown;
  runtime: RuntimeDiagnosticsSnapshot;
};

export type AiDiagnosticsHistoryRecord = {
  bookId: string;
  bookTitle?: string;
  updatedAt: string;
  entries: CloudAiRequestHistoryEntry[];
};

export type AiDiagnosticsExportInput = {
  exportedAt?: string;
  appSettings: AppSettings;
  extendedSettings: Partial<ExtendedSettings>;
  aiApiKeyStorageStatus?: Partial<AiApiKeyStorageStatus> | null;
  aiTestStatus?: Partial<CloudAiTestResult> | null;
  aiModels?: string[];
  customSlashCommands?: AiCustomSlashCommandDraft[];
  historyRecords?: AiDiagnosticsHistoryRecord[];
  indexDiagnostics?: unknown;
  runtime: RuntimeDiagnosticsSnapshot;
};

const pathKeyPattern = /(path|directory|dir|filePath|inputPath|cachePath|database|dataDir|settingsFile|fallbackFilePath)$/i;
const textKeyPattern = /^(instruction|userText|prompt|query|queryUsed|retrievalQuery|scopeText|scopeLabel|bookRange|title|bookTitle|label|text|quote|snippet|preview|firstChunkPreview|lastChunkPreview|textPreview|sourceText|content|readerContent|message|errorMessage|recentError|recentErrors|pattern|line|rule|fontFamily|primaryFont|customFontFamily)$/i;
const secretKeyPattern = /(api.?key|authorization|bearer|access.?token|refresh.?token|secret|password|keyMaterial|rawKey|dataKey|privateKey)/i;
const secretValuePattern = /(sk-[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]+|token[-_:= ][A-Za-z0-9._-]+)/gi;
const windowsAbsolutePathPattern = /^[a-zA-Z]:[\\/][\s\S]+/;
const posixAbsolutePathPattern = /^\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[\s\S]+/;
const embeddedAbsolutePathPattern = /([a-zA-Z]:[\\/][^"'<>|,，。；;\n\r]+|\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[^"'<>|,，。；;\n\r]+)/g;

export function collectRuntimeDiagnostics(tauriRuntime: boolean): RuntimeDiagnosticsSnapshot {
  const nav = typeof navigator === 'undefined' ? null : navigator as Navigator & { deviceMemory?: number };
  const win = typeof window === 'undefined' ? null : window;
  const displayScreen = typeof screen === 'undefined' ? null : screen;
  const media = win && typeof win.matchMedia === 'function' ? win.matchMedia.bind(win) : null;
  const timezone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
    : 'unknown';

  return {
    userAgent: nav?.userAgent ?? 'unknown',
    language: nav?.language ?? 'unknown',
    languages: Array.isArray(nav?.languages) ? Array.from(nav.languages) : [],
    platform: nav?.platform ?? 'unknown',
    timezone,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    hardwareConcurrency: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemory: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    maxTouchPoints: typeof nav?.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0,
    cookieEnabled: Boolean(nav?.cookieEnabled),
    online: typeof nav?.onLine === 'boolean' ? nav.onLine : true,
    viewport: {
      width: win?.innerWidth ?? 0,
      height: win?.innerHeight ?? 0,
    },
    screen: {
      width: displayScreen?.width ?? 0,
      height: displayScreen?.height ?? 0,
      colorDepth: displayScreen?.colorDepth ?? 0,
    },
    devicePixelRatio: win?.devicePixelRatio ?? 1,
    colorScheme: media ? (media('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 'unknown',
    reducedMotion: media ? media('(prefers-reduced-motion: reduce)').matches : false,
    tauriRuntime,
  };
}

export function buildApplicationDiagnostics(input: ApplicationDiagnosticsInput) {
  const exportedAt = input.exportedAt ?? new Date().toISOString();

  return {
    schema: 'bookmind.application-diagnostics.v1',
    exportedAt,
    redaction: {
      secrets: 'always-redacted',
      absolutePaths: 'hash-only',
      sensitiveText: 'redacted-by-key',
    },
    excludedFields: [
      'aiApiKey',
      'authorization',
      'tokens',
      'readerContent',
      'operationLogDetails',
      'prompts',
      'bookTitles',
      'absolutePaths',
    ],
    runtime: sanitizeDiagnosticValue(input.runtime, 'runtime'),
    settingsSummary: buildSettingsSummary(input.appSettings, input.extendedSettings, input.readerSettings, input.chapterRules),
    storageStatus: buildStorageStatus(input),
    indexSummary: buildIndexSummary(input.indexDiagnostics),
    taskSummary: buildTaskSummary(input.taskStatuses ?? []),
    taskLogSummary: buildTaskLogSummary(input.taskLogs ?? []),
    operationLogSummary: buildOperationLogSummary(input.operationLogs ?? []),
    lifecycleDiagnostics: sanitizeDiagnosticValue(input.lifecycleDiagnostics ?? [], 'lifecycleDiagnostics'),
  };
}

export function buildSystemInfoDiagnostics(input: SystemInfoDiagnosticsInput) {
  return {
    schema: 'bookmind.system-info.v1',
    copiedAt: input.copiedAt ?? new Date().toISOString(),
    redaction: {
      secrets: 'always-redacted',
      absolutePaths: 'hash-only',
    },
    runtime: sanitizeDiagnosticValue(input.runtime, 'runtime'),
    app: {
      schemaVersion: input.appSettings.schemaVersion ?? 1,
      operationLogLevel: input.appSettings.operationLogLevel ?? 'none',
      trashRetentionDays: input.appSettings.trashRetentionDays,
      trashProtectReadingProgress: input.appSettings.trashProtectReadingProgress !== false,
      trashProtectReaderAssets: input.appSettings.trashProtectReaderAssets !== false,
      aiEndpointMode: input.appSettings.aiEndpointMode ?? 'responses',
      aiModel: input.appSettings.aiModel ?? '',
      aiBaseUrlKind: classifyAiBaseUrl(input.appSettings.aiApiBaseUrl),
      hasAiApiKey: Boolean(input.appSettings.aiApiKey?.trim()),
    },
    featureStatus: {
      defaultAiMode: input.extendedSettings.defaultAiMode ?? 'mock',
      cloudAiEnabled: Boolean(input.extendedSettings.cloudAiEnabled),
      localAiEnabled: Boolean(input.extendedSettings.localAiEnabled),
      applicationPrivacyMode: Boolean(input.extendedSettings.applicationPrivacyMode),
      copyDiagnosticsAutoRedact: input.extendedSettings.copyDiagnosticsAutoRedact !== false,
      translationFallbackStrategy: input.extendedSettings.translationFallbackStrategy ?? 'default-locale',
    },
    storageStatus: {
      diagnosticPaths: sanitizeDiagnosticValue(input.diagnosticPaths ?? {}, 'diagnosticPaths'),
      localEncryption: summarizeLocalEncryptionStatus(input.localEncryptionStatus),
      aiApiKeyStorage: summarizeAiApiKeyStorageStatus(input.aiApiKeyStorageStatus),
    },
  };
}

export function buildReaderDiagnostics(input: ReaderDiagnosticsInput) {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  return {
    schema: 'bookmind.reader-diagnostics.v1',
    exportedAt,
    redaction: {
      secrets: 'always-redacted',
      absolutePaths: 'hash-only',
      sensitiveText: 'redacted-by-key',
    },
    excludedFields: [
      'readerContent',
      'bookTitles',
      'absolutePaths',
      'prompts',
      'rawFontNames',
    ],
    runtime: sanitizeDiagnosticValue(input.runtime, 'runtime'),
    readerSummary: sanitizeDiagnosticValue(buildReaderDiagnosticsSummary(input.readerSettings, input.extendedSettings), 'readerSummary'),
    chapterRulesSummary: sanitizeDiagnosticValue(buildChapterRulesDiagnosticsSummary(input.chapterRules), 'chapterRulesSummary'),
    fontRenderingDiagnostics: sanitizeDiagnosticValue(input.fontRenderingDiagnostics ?? {}, 'fontRenderingDiagnostics'),
    parserDiagnostics: sanitizeDiagnosticValue(input.parserDiagnostics ?? {}, 'parserDiagnostics'),
  };
}

export function buildIndexDiagnosticsExport(input: IndexDiagnosticsExportInput) {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  return {
    schema: 'bookmind.index-diagnostics.v1',
    exportedAt,
    redaction: {
      secrets: 'always-redacted',
      absolutePaths: 'hash-only',
      sensitiveText: 'redacted-by-key',
    },
    excludedFields: [
      'bookTitles',
      'absolutePaths',
      'chunkPreviews',
      'readerContent',
      'tokens',
    ],
    runtime: sanitizeDiagnosticValue(input.runtime, 'runtime'),
    diagnostics: sanitizeDiagnosticValue(input.indexDiagnostics ?? {}, 'indexDiagnostics'),
  };
}

export function buildAiDiagnosticsExport(input: AiDiagnosticsExportInput) {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  return {
    schema: 'bookmind.ai-diagnostics.v1',
    exportedAt,
    redaction: {
      secrets: 'always-redacted',
      absolutePaths: 'hash-only',
      sensitiveText: 'redacted-by-key-or-count-only',
    },
    excludedFields: [
      'aiApiKey',
      'authorization',
      'tokens',
      'prompts',
      'answers',
      'readerContent',
      'bookTitles',
      'modelNames',
      'customCommandLabels',
      'customCommandPrompts',
      'absolutePaths',
    ],
    runtime: sanitizeDiagnosticValue(input.runtime, 'runtime'),
    providerSummary: buildAiProviderSummary(input.appSettings),
    generationSummary: buildAiGenerationSummary(input.appSettings, input.extendedSettings),
    privacySummary: buildAiPrivacySummary(input.extendedSettings),
    retrievalSummary: buildAiRetrievalSummary(input.extendedSettings),
    localRetrievalSummary: buildAiLocalRetrievalSummary(input.indexDiagnostics),
    modelDiscoverySummary: buildAiModelDiscoverySummary(input.aiModels ?? []),
    connectionTestSummary: buildAiConnectionTestSummary(input.aiTestStatus),
    storageStatus: {
      aiApiKeyStorage: summarizeAiApiKeyStorageStatus(input.aiApiKeyStorageStatus),
    },
    customCommandSummary: buildAiCustomCommandSummary(input.customSlashCommands ?? []),
    historySummary: buildAiHistorySummary(input.historyRecords ?? []),
  };
}

export function formatSystemInfoDiagnosticsText(payload: ReturnType<typeof buildSystemInfoDiagnostics>) {
  const runtime = payload.runtime as RuntimeDiagnosticsSnapshot;
  const app = payload.app;
  const features = payload.featureStatus;

  return [
    'BookMind System Info',
    `Schema: ${payload.schema}`,
    `Copied At: ${payload.copiedAt}`,
    `Tauri: ${runtime.tauriRuntime ? 'yes' : 'no'}`,
    `Platform: ${runtime.platform}`,
    `User Agent: ${runtime.userAgent}`,
    `Language: ${runtime.language}`,
    `Languages: ${runtime.languages.join(', ') || 'unknown'}`,
    `Timezone: ${runtime.timezone}`,
    `Viewport: ${runtime.viewport.width}x${runtime.viewport.height}`,
    `Screen: ${runtime.screen.width}x${runtime.screen.height} @ ${runtime.devicePixelRatio}x`,
    `Color Scheme: ${runtime.colorScheme}`,
    `Reduced Motion: ${runtime.reducedMotion ? 'yes' : 'no'}`,
    `Online: ${runtime.online ? 'yes' : 'no'}`,
    `Settings Schema: ${app.schemaVersion}`,
    `Operation Log Level: ${app.operationLogLevel}`,
    `AI Endpoint: ${app.aiEndpointMode}`,
    `AI Model: ${app.aiModel}`,
    `AI Base URL: ${app.aiBaseUrlKind}`,
    `AI Key Saved: ${app.hasAiApiKey ? 'yes' : 'no'}`,
    `Default AI Mode: ${features.defaultAiMode}`,
    `Cloud AI: ${features.cloudAiEnabled ? 'enabled' : 'disabled'}`,
    `Local AI: ${features.localAiEnabled ? 'enabled' : 'disabled'}`,
    `Privacy Mode: ${features.applicationPrivacyMode ? 'enabled' : 'disabled'}`,
    `Diagnostics Redaction: ${features.copyDiagnosticsAutoRedact ? 'enabled' : 'forced-for-secrets'}`,
  ].join('\n');
}

function buildReaderDiagnosticsSummary(
  readerSettings: Partial<ReaderSettings>,
  extendedSettings: Partial<ExtendedSettings>,
) {
  return {
    theme: readerSettings.theme ?? 'paper',
    layoutMode: readerSettings.layoutMode ?? 'page',
    pageMode: readerSettings.pageMode ?? 'single',
    pageWidth: readerSettings.pageWidth ?? null,
    fontSize: readerSettings.fontSize ?? null,
    lineHeight: readerSettings.lineHeight ?? null,
    paragraphSpacing: readerSettings.paragraphSpacing ?? null,
    customFontEnabled: Boolean(readerSettings.customFontFamily),
    fontWeightBoost: readerSettings.fontWeightBoost ?? 'off',
    readerPageCacheEnabled: Boolean(extendedSettings.readerPageCacheEnabled),
    readerPageCacheLimit: extendedSettings.readerPageCacheLimit ?? '',
    readerPagePreheatEnabled: Boolean(extendedSettings.readerPagePreheatEnabled),
    readerPagePreheatRange: extendedSettings.readerPagePreheatRange ?? '',
    readerFpsDiagnosticsEnabled: Boolean(extendedSettings.readerFpsDiagnosticsEnabled),
    readerMemoryWarningEnabled: Boolean(extendedSettings.readerMemoryWarningEnabled),
    readerMemoryWarningThresholdMb: extendedSettings.readerMemoryWarningThresholdMb ?? '',
    virtualChapterRadius: extendedSettings.virtualChapterRadius ?? '',
    virtualParagraphWindowSize: extendedSettings.virtualParagraphWindowSize ?? '',
  };
}

function buildChapterRulesDiagnosticsSummary(chapterRules: ChapterRulesDiagnosticsInput) {
  return {
    enabled: Boolean(chapterRules.enabled),
    maxHeadingLength: chapterRules.maxHeadingLength ?? null,
    enableChineseChapter: Boolean(chapterRules.enableChineseChapter),
    enableChineseVolume: Boolean(chapterRules.enableChineseVolume),
    enableSpecialHeadings: Boolean(chapterRules.enableSpecialHeadings),
    enableEnglishChapter: Boolean(chapterRules.enableEnglishChapter),
    adKeywordCount: countDelimitedText(chapterRules.adKeywords),
    customRegexRuleCount: Array.isArray(chapterRules.customRegexRules) ? chapterRules.customRegexRules.length : 0,
    customCleanupRuleCount: Array.isArray(chapterRules.customCleanupRules) ? chapterRules.customCleanupRules.length : 0,
  };
}

function buildSettingsSummary(
  appSettings: AppSettings,
  extendedSettings: Partial<ExtendedSettings>,
  readerSettings: Partial<ReaderSettings>,
  chapterRules: ChapterRulesDiagnosticsInput,
) {
  return {
    app: {
      schemaVersion: appSettings.schemaVersion ?? 1,
      trashRetentionDays: appSettings.trashRetentionDays,
      trashAutoCleanupEnabled: Boolean(appSettings.trashAutoCleanupEnabled),
      trashProtectReadingProgress: appSettings.trashProtectReadingProgress !== false,
      trashProtectReaderAssets: appSettings.trashProtectReaderAssets !== false,
      operationLogLevel: appSettings.operationLogLevel ?? 'none',
      aiEndpointMode: appSettings.aiEndpointMode ?? 'responses',
      aiModel: sanitizeDiagnosticValue(appSettings.aiModel ?? '', 'aiModel'),
      aiBaseUrlKind: classifyAiBaseUrl(appSettings.aiApiBaseUrl),
      hasAiApiKey: Boolean(appSettings.aiApiKey?.trim()),
      aiRequestTimeoutSecs: appSettings.aiRequestTimeoutSecs ?? null,
      aiRetryCount: appSettings.aiRetryCount ?? null,
      aiProxyConfigured: Boolean(appSettings.aiProxyUrl?.trim()),
      aiCustomHeadersConfigured: Boolean(appSettings.aiCustomHeaders?.trim()),
      aiStreamingEnabled: appSettings.aiStreamingEnabled !== false,
      aiTemperature: appSettings.aiTemperature ?? null,
      aiMaxTokens: appSettings.aiMaxTokens ?? null,
      aiTopP: appSettings.aiTopP ?? null,
      aiReasoningEffort: appSettings.aiReasoningEffort ?? 'none',
      aiResponseFormat: appSettings.aiResponseFormat ?? 'auto',
    },
    extended: {
      defaultAiMode: extendedSettings.defaultAiMode ?? 'mock',
      aiDefaultScope: extendedSettings.aiDefaultScope ?? 'chapter',
      aiDefaultRetrievalStrategy: extendedSettings.aiDefaultRetrievalStrategy ?? 'scope-first',
      cloudAiEnabled: Boolean(extendedSettings.cloudAiEnabled),
      localAiEnabled: Boolean(extendedSettings.localAiEnabled),
      cloudAiAutoRedact: extendedSettings.cloudAiAutoRedact !== false,
      cloudAiRequestHistoryEnabled: Boolean(extendedSettings.cloudAiRequestHistoryEnabled),
      applicationPrivacyMode: Boolean(extendedSettings.applicationPrivacyMode),
      hideFilePathsInPrivacyMode: Boolean(extendedSettings.hideFilePathsInPrivacyMode),
      hideBookTitlesInPrivacyMode: Boolean(extendedSettings.hideBookTitlesInPrivacyMode),
      copyDiagnosticsAutoRedact: extendedSettings.copyDiagnosticsAutoRedact !== false,
      operationLogRetention: extendedSettings.operationLogRetention ?? '',
      taskConcurrency: extendedSettings.taskConcurrency ?? '',
      taskRetryCount: extendedSettings.taskRetryCount ?? '',
      taskLogRetention: extendedSettings.taskLogRetention ?? '30-days',
      completedTaskRetentionLimit: extendedSettings.completedTaskRetentionLimit ?? '',
      autoIndexImportedBooks: Boolean(extendedSettings.autoIndexImportedBooks),
      indexChunkSize: extendedSettings.indexChunkSize ?? '',
      indexChunkOverlap: extendedSettings.indexChunkOverlap ?? '',
      indexRebuildStrategy: extendedSettings.indexRebuildStrategy ?? 'prompt',
      ftsRepairStrategy: extendedSettings.ftsRepairStrategy ?? 'prompt',
      readerPageCacheEnabled: Boolean(extendedSettings.readerPageCacheEnabled),
      readerPageCacheLimit: extendedSettings.readerPageCacheLimit ?? '',
      readerFpsDiagnosticsEnabled: Boolean(extendedSettings.readerFpsDiagnosticsEnabled),
      readerMemoryWarningEnabled: Boolean(extendedSettings.readerMemoryWarningEnabled),
      translationFallbackStrategy: extendedSettings.translationFallbackStrategy ?? 'default-locale',
    },
    reader: {
      theme: readerSettings.theme ?? 'paper',
      layoutMode: readerSettings.layoutMode ?? 'page',
      pageMode: readerSettings.pageMode ?? 'single',
      customFontEnabled: Boolean(readerSettings.customFontFamily),
      fontSize: readerSettings.fontSize ?? null,
      lineHeight: readerSettings.lineHeight ?? null,
      pageWidth: readerSettings.pageWidth ?? null,
      privacyMode: Boolean(readerSettings.privacyMode),
    },
    chapters: {
      enabled: Boolean(chapterRules.enabled),
      maxHeadingLength: chapterRules.maxHeadingLength ?? null,
      enableChineseChapter: Boolean(chapterRules.enableChineseChapter),
      enableChineseVolume: Boolean(chapterRules.enableChineseVolume),
      enableSpecialHeadings: Boolean(chapterRules.enableSpecialHeadings),
      enableEnglishChapter: Boolean(chapterRules.enableEnglishChapter),
      adKeywordCount: countDelimitedText(chapterRules.adKeywords),
      customRegexRuleCount: Array.isArray(chapterRules.customRegexRules) ? chapterRules.customRegexRules.length : 0,
      customCleanupRuleCount: Array.isArray(chapterRules.customCleanupRules) ? chapterRules.customCleanupRules.length : 0,
    },
  };
}

function buildAiProviderSummary(appSettings: AppSettings) {
  return {
    endpointMode: appSettings.aiEndpointMode ?? 'responses',
    aiBaseUrlKind: classifyAiBaseUrl(appSettings.aiApiBaseUrl),
    hasAiApiKey: Boolean(appSettings.aiApiKey?.trim()),
    aiProxyConfigured: Boolean(appSettings.aiProxyUrl?.trim()),
    aiCustomHeadersConfigured: Boolean(appSettings.aiCustomHeaders?.trim()),
    modelConfigured: Boolean(appSettings.aiModel?.trim()),
    modelHash: appSettings.aiModel ? hashDiagnosticLabel(appSettings.aiModel) : '',
  };
}

function buildAiGenerationSummary(appSettings: AppSettings, extendedSettings: Partial<ExtendedSettings>) {
  return {
    aiRequestTimeoutSecs: appSettings.aiRequestTimeoutSecs ?? null,
    aiRetryCount: appSettings.aiRetryCount ?? null,
    aiProxyConfigured: Boolean(appSettings.aiProxyUrl?.trim()),
    aiCustomHeadersConfigured: Boolean(appSettings.aiCustomHeaders?.trim()),
    aiStreamingEnabled: appSettings.aiStreamingEnabled !== false,
    aiStreamingFlushIntervalMs: extendedSettings.aiStreamingFlushIntervalMs ?? '',
    cloudAiRequestSizeLimitTokens: extendedSettings.cloudAiRequestSizeLimitTokens ?? '',
    localAiCancelTimeoutMs: extendedSettings.localAiCancelTimeoutMs ?? '',
    aiTemperature: appSettings.aiTemperature ?? null,
    aiMaxTokens: appSettings.aiMaxTokens ?? null,
    aiTopP: appSettings.aiTopP ?? null,
    aiReasoningEffort: appSettings.aiReasoningEffort ?? 'none',
    aiResponseFormat: appSettings.aiResponseFormat ?? 'auto',
    cloudAiFallbackToLocalOnFailure: Boolean(extendedSettings.cloudAiFallbackToLocalOnFailure),
  };
}

function buildAiPrivacySummary(extendedSettings: Partial<ExtendedSettings>) {
  return {
    cloudAiEnabled: Boolean(extendedSettings.cloudAiEnabled),
    localAiEnabled: Boolean(extendedSettings.localAiEnabled),
    defaultAiMode: extendedSettings.defaultAiMode ?? 'mock',
    cloudAiRequireConfirmation: Boolean(extendedSettings.cloudAiRequireConfirmation),
    cloudAiAutoRedact: extendedSettings.cloudAiAutoRedact !== false,
    cloudAiSensitiveWordCount: countDelimitedText(extendedSettings.cloudAiSensitiveWords),
    cloudAiAllowSelectionText: Boolean(extendedSettings.cloudAiAllowSelectionText),
    cloudAiAllowCurrentPageText: Boolean(extendedSettings.cloudAiAllowCurrentPageText),
    cloudAiAllowCurrentChapterText: Boolean(extendedSettings.cloudAiAllowCurrentChapterText),
    cloudAiAllowBookSummaryContext: Boolean(extendedSettings.cloudAiAllowBookSummaryContext),
    cloudAiRequestHistoryEnabled: Boolean(extendedSettings.cloudAiRequestHistoryEnabled),
    cloudAiRequestHistoryLimit: extendedSettings.cloudAiRequestHistoryLimit ?? '',
    cloudAiRequestHistorySaveFailed: Boolean(extendedSettings.cloudAiRequestHistorySaveFailed),
    cloudAiRequestHistorySaveStopped: Boolean(extendedSettings.cloudAiRequestHistorySaveStopped),
    experimentalAiToolCallingEnabled: Boolean(extendedSettings.experimentalAiToolCallingEnabled),
    applicationPrivacyMode: Boolean(extendedSettings.applicationPrivacyMode),
    hideBookTitlesInPrivacyMode: Boolean(extendedSettings.hideBookTitlesInPrivacyMode),
    hideFilePathsInPrivacyMode: Boolean(extendedSettings.hideFilePathsInPrivacyMode),
    copyDiagnosticsAutoRedact: extendedSettings.copyDiagnosticsAutoRedact !== false,
  };
}

function buildAiRetrievalSummary(extendedSettings: Partial<ExtendedSettings>) {
  return {
    aiDefaultScope: extendedSettings.aiDefaultScope ?? 'chapter',
    aiNoSelectionFallbackScope: extendedSettings.aiNoSelectionFallbackScope ?? 'chapter',
    aiAutoDowngradeScopeOnTokenOverflow: Boolean(extendedSettings.aiAutoDowngradeScopeOnTokenOverflow),
    aiScopeTokenLimit: extendedSettings.aiScopeTokenLimit ?? '',
    aiDefaultRetrievalStrategy: extendedSettings.aiDefaultRetrievalStrategy ?? 'scope-first',
    aiRetrievalQueryRewriteMode: extendedSettings.aiRetrievalQueryRewriteMode ?? 'off',
    aiMultiStageRetrievalMode: extendedSettings.aiMultiStageRetrievalMode ?? 'off',
    aiFallbackEnabled: Boolean(extendedSettings.aiFallbackEnabled),
    aiFtsUnavailableBehavior: extendedSettings.aiFtsUnavailableBehavior ?? 'show-warning',
    aiLocalIndexResultLimit: extendedSettings.aiLocalIndexResultLimit ?? '',
    aiCitationMinConfidence: extendedSettings.aiCitationMinConfidence ?? '',
    aiRequireCitations: Boolean(extendedSettings.aiRequireCitations),
    aiNoCitationWarningEnabled: Boolean(extendedSettings.aiNoCitationWarningEnabled),
    aiCommandDefaultScopes: sanitizeDiagnosticValue(extendedSettings.aiCommandDefaultScopes ?? {}, 'aiCommandDefaultScopes'),
    aiCommandRetrievalStrategies: sanitizeDiagnosticValue(extendedSettings.aiCommandRetrievalStrategies ?? {}, 'aiCommandRetrievalStrategies'),
  };
}

function buildAiLocalRetrievalSummary(indexDiagnostics: unknown) {
  if (!indexDiagnostics || typeof indexDiagnostics !== 'object') {
    return {
      ftsAvailable: false,
      indexedBookCount: 0,
      indexedChunkCount: 0,
      status: 'missing',
    };
  }
  const summary = (indexDiagnostics as { summary?: Record<string, unknown> }).summary ?? {};
  return {
    ftsAvailable: Boolean(summary.ftsAvailable),
    indexedBookCount: typeof summary.indexedBookCount === 'number' ? summary.indexedBookCount : 0,
    indexedChunkCount: typeof summary.indexedChunkCount === 'number' ? summary.indexedChunkCount : 0,
    sidecarStatus: typeof summary.sidecarStatus === 'string' ? sanitizeDiagnosticValue(summary.sidecarStatus, 'status') : 'not-configured',
    sidecarVersion: typeof summary.sidecarVersion === 'string' ? sanitizeDiagnosticValue(summary.sidecarVersion, 'version') : '',
    sidecarCapabilities: Array.isArray(summary.sidecarCapabilities) ? summary.sidecarCapabilities.map((capability) => sanitizeDiagnosticValue(capability, 'status')).filter((capability): capability is string => typeof capability === 'string' && /^[a-z0-9._:-]{1,64}$/i.test(capability)) : [],
    sidecarCapabilityCount: Array.isArray(summary.sidecarCapabilities) ? summary.sidecarCapabilities.filter((capability) => typeof capability === 'string' && /^[a-z0-9._:-]{1,64}$/i.test(capability)).length : 0,
    sidecarErrorCode: typeof summary.sidecarErrorCode === 'string' ? sanitizeDiagnosticValue(summary.sidecarErrorCode, 'status') : '',
    sidecarCheckedAt: typeof summary.sidecarCheckedAt === 'string' ? sanitizeDiagnosticValue(summary.sidecarCheckedAt, 'status') : '',
    vectorIndexStatus: typeof summary.vectorIndexStatus === 'string' ? sanitizeDiagnosticValue(summary.vectorIndexStatus, 'status') : 'not-built',
    vectorIndexedBookCount: typeof summary.vectorIndexedBookCount === 'number' ? summary.vectorIndexedBookCount : 0,
    vectorIndexedChunkCount: typeof summary.vectorIndexedChunkCount === 'number' ? summary.vectorIndexedChunkCount : 0,
    status: summary.status ? sanitizeDiagnosticValue(summary.status, 'status') : 'available',
    recentError: summary.recentError ? sanitizeDiagnosticValue(summary.recentError, 'recentError') : '',
  };
}

function buildAiModelDiscoverySummary(models: string[]) {
  return {
    loadedModelCount: models.length,
    modelHashes: models.slice(0, 20).map(hashDiagnosticLabel),
    truncated: models.length > 20,
  };
}

function buildAiConnectionTestSummary(status?: Partial<CloudAiTestResult> | null) {
  if (!status) return null;
  return {
    ok: Boolean(status.ok),
    status: typeof status.status === 'number' ? status.status : 0,
    modelHash: status.model ? hashDiagnosticLabel(status.model) : '',
    durationMs: typeof status.durationMs === 'number' ? status.durationMs : 0,
    hasText: Boolean(status.text),
    error: status.error ? sanitizeDiagnosticValue(status.error, 'errorMessage') : '',
  };
}

function buildAiCustomCommandSummary(commands: AiCustomSlashCommandDraft[]) {
  const scopeHintCounts: Record<string, number> = {};
  const outputHintHashes: Record<string, number> = {};
  const retrievalStrategyCounts: Record<string, number> = {};
  commands.forEach((command) => {
    const scopeHint = normalizeDiagnosticBucketKey(command.scopeHint || 'chapter');
    const outputHintHash = command.outputHint ? hashDiagnosticLabel(command.outputHint) : 'empty';
    const retrievalStrategy = normalizeDiagnosticBucketKey(command.retrievalStrategy || 'scope-first');
    scopeHintCounts[scopeHint] = (scopeHintCounts[scopeHint] ?? 0) + 1;
    outputHintHashes[outputHintHash] = (outputHintHashes[outputHintHash] ?? 0) + 1;
    retrievalStrategyCounts[retrievalStrategy] = (retrievalStrategyCounts[retrievalStrategy] ?? 0) + 1;
  });
  return {
    total: commands.length,
    aliasCount: commands.reduce((count, command) => count + command.aliases.length, 0),
    promptCharacterTotal: commands.reduce((count, command) => count + command.prompt.length, 0),
    scopeHintCounts,
    outputHintHashes,
    retrievalStrategyCounts,
  };
}

function buildAiHistorySummary(records: AiDiagnosticsHistoryRecord[]) {
  const entries = records.flatMap((record) => record.entries.map((entry) => ({ ...entry, bookId: record.bookId })));
  const statusCounts: Record<string, number> = {};
  const endpointModeCounts: Record<string, number> = {};
  const scopeCounts: Record<string, number> = {};
  const retrievalStrategyCounts: Record<string, number> = {};
  const errorKindCounts: Record<string, number> = {};
  const redactedFieldCounts: Record<string, number> = {};
  const modelHashes: Record<string, number> = {};

  entries.forEach((entry) => {
    incrementDiagnosticCount(statusCounts, normalizeDiagnosticBucketKey(entry.status || 'unknown'));
    incrementDiagnosticCount(endpointModeCounts, normalizeDiagnosticBucketKey(entry.endpointMode || 'unknown'));
    incrementDiagnosticCount(scopeCounts, normalizeDiagnosticBucketKey(entry.scope || 'unknown'));
    incrementDiagnosticCount(retrievalStrategyCounts, normalizeDiagnosticBucketKey(entry.retrievalStrategy || 'none'));
    if (entry.errorKind) incrementDiagnosticCount(errorKindCounts, hashDiagnosticLabel(entry.errorKind));
    if (entry.model) incrementDiagnosticCount(modelHashes, hashDiagnosticLabel(entry.model));
    entry.redactedFields.forEach((field) => incrementDiagnosticCount(redactedFieldCounts, normalizeDiagnosticBucketKey(field)));
  });

  return {
    bookCount: records.length,
    totalEntries: entries.length,
    statusCounts,
    endpointModeCounts,
    scopeCounts,
    retrievalStrategyCounts,
    errorKindCounts,
    redactedFieldCounts,
    modelHashes,
    recentEntryAges: entries.slice(0, 10).map((entry) => ({
      createdAt: entry.createdAt,
      durationMs: entry.durationMs,
      status: entry.status,
      resultCount: entry.resultCount,
    })),
  };
}

function incrementDiagnosticCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function normalizeDiagnosticBucketKey(value: string) {
  const normalized = value.trim();
  if (/^[a-z0-9._:-]{1,64}$/i.test(normalized)) return normalized;
  return hashDiagnosticLabel(normalized);
}

function buildStorageStatus(input: ApplicationDiagnosticsInput) {
  return {
    diagnosticPaths: sanitizeDiagnosticValue(input.diagnosticPaths ?? {}, 'diagnosticPaths'),
    localEncryption: summarizeLocalEncryptionStatus(input.localEncryptionStatus),
    aiApiKeyStorage: summarizeAiApiKeyStorageStatus(input.aiApiKeyStorageStatus),
  };
}

function summarizeLocalEncryptionStatus(status?: Partial<LocalEncryptionStatus> | null) {
  if (!status) return null;
  return {
    keyStatus: status.keyStatus ?? 'unknown',
    algorithm: status.algorithm ?? 'unknown',
    envelopeVersion: status.envelopeVersion ?? 'unknown',
    activeKeyId: status.activeKeyId ? hashDiagnosticLabel(status.activeKeyId) : '',
    retiredKeyCount: typeof status.retiredKeyCount === 'number' ? status.retiredKeyCount : 0,
    masterPasswordEnabled: Boolean(status.masterPasswordEnabled),
    fallbackProtection: status.fallbackProtection ?? 'unknown',
    keyringAvailable: Boolean(status.keyringAvailable),
    fallbackFileExists: Boolean(status.fallbackFileExists),
    fallbackFilePath: sanitizeDiagnosticValue(status.fallbackFilePath ?? '', 'fallbackFilePath'),
    wrappedFallbackFileExists: Boolean(status.wrappedFallbackFileExists),
    wrappedFallbackFilePath: sanitizeDiagnosticValue(status.wrappedFallbackFilePath ?? '', 'fallbackFilePath'),
    protectedKindCount: Array.isArray(status.protectedKinds) ? status.protectedKinds.length : 0,
    nonceBytes: typeof status.nonceBytes === 'number' ? status.nonceBytes : null,
  };
}

function summarizeAiApiKeyStorageStatus(status?: Partial<AiApiKeyStorageStatus> | null) {
  if (!status) return null;
  return {
    keyStatus: status.keyStatus ?? 'unknown',
    primaryStore: status.primaryStore ?? 'unknown',
    keyringAvailable: Boolean(status.keyringAvailable),
    keyringHasKey: Boolean(status.keyringHasKey),
    fallbackFileExists: Boolean(status.fallbackFileExists),
    fallbackFileHasKey: Boolean(status.fallbackFileHasKey),
    fallbackFilePath: sanitizeDiagnosticValue(status.fallbackFilePath ?? '', 'fallbackFilePath'),
  };
}

function buildIndexSummary(indexDiagnostics: unknown) {
  if (!indexDiagnostics || typeof indexDiagnostics !== 'object') {
    return null;
  }
  const summary = (indexDiagnostics as { summary?: unknown }).summary;
  return sanitizeDiagnosticValue(summary ?? {}, 'indexSummary');
}

function buildTaskSummary(tasks: unknown[]) {
  const statusCounts: Record<string, number> = {};
  const stageCounts: Record<string, number> = {};
  tasks.forEach((task) => {
    if (!task || typeof task !== 'object') return;
    const status = String((task as { status?: unknown }).status ?? 'unknown');
    const stage = String((task as { stage?: unknown }).stage ?? 'unknown');
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  });
  return {
    total: tasks.length,
    statusCounts,
    stageCounts,
    failed: statusCounts.failed ?? 0,
    running: statusCounts.running ?? 0,
    queued: statusCounts.queued ?? 0,
  };
}

function buildTaskLogSummary(logs: unknown[]) {
  const levelCounts: Record<string, number> = {};
  const stageCounts: Record<string, number> = {};
  logs.forEach((log) => {
    if (!log || typeof log !== 'object') return;
    const level = String((log as { level?: unknown }).level ?? 'unknown');
    const stage = String((log as { stage?: unknown }).stage ?? 'unknown');
    levelCounts[level] = (levelCounts[level] ?? 0) + 1;
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  });
  return {
    total: logs.length,
    levelCounts,
    stageCounts,
  };
}

function buildOperationLogSummary(logs: unknown[]) {
  const levelCounts: Record<string, number> = {};
  const recentActions: string[] = [];
  logs.forEach((log) => {
    if (!log || typeof log !== 'object') return;
    const level = String((log as { level?: unknown }).level ?? 'unknown');
    const action = sanitizeOperationLogAction(String((log as { action?: unknown }).action ?? 'unknown'));
    levelCounts[level] = (levelCounts[level] ?? 0) + 1;
    if (recentActions.length < 10) recentActions.push(action);
  });
  return {
    total: logs.length,
    levelCounts,
    recentActions,
  };
}

function sanitizeDiagnosticValue(value: unknown, key: string): DiagnosticValue | RedactedPathHash {
  if (isSensitiveSecretKey(key)) return '[redacted-secret]';
  if (Array.isArray(value)) return value.map((item) => sanitizeDiagnosticValue(item, singularizeDiagnosticKey(key)));
  if (value && typeof value === 'object') {
    const output: Record<string, DiagnosticValue | RedactedPathHash> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      output[entryKey] = sanitizeDiagnosticValue(entryValue, entryKey);
    }
    return output;
  }
  if (typeof value === 'string') {
    if (pathKeyPattern.test(key) && isAbsolutePath(value)) return redactPath(value);
    if (textKeyPattern.test(key)) return '[redacted-text]';
    return redactSecrets(redactEmbeddedPaths(value));
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  return String(value ?? '');
}

function singularizeDiagnosticKey(key: string) {
  return key.endsWith('s') ? key.slice(0, -1) : key;
}

function sanitizeOperationLogAction(value: string) {
  const action = value.trim();
  if (!action) return 'unknown';
  if (secretValuePattern.test(action) || embeddedAbsolutePathPattern.test(action) || action.length > 80) {
    resetGlobalRedactionPatterns();
    return '[redacted-action]';
  }
  resetGlobalRedactionPatterns();
  return /^[a-z][a-z0-9._:-]*$/i.test(action) ? action : '[redacted-action]';
}

function isSensitiveSecretKey(key: string) {
  return secretKeyPattern.test(key);
}

function isAbsolutePath(value: string) {
  return windowsAbsolutePathPattern.test(value) || posixAbsolutePathPattern.test(value);
}

function redactPath(value: string): RedactedPathHash {
  return {
    pathHash: fnv1aHash(normalizePath(value)),
  };
}

function redactEmbeddedPaths(value: string) {
  return value.replace(embeddedAbsolutePathPattern, (match) => `[path:${fnv1aHash(normalizePath(match))}]`);
}

function redactSecrets(value: string) {
  return value.replace(secretValuePattern, '[redacted-secret]');
}

function resetGlobalRedactionPatterns() {
  secretValuePattern.lastIndex = 0;
  embeddedAbsolutePathPattern.lastIndex = 0;
}

function normalizePath(value: string) {
  return value.replaceAll('\\', '/').replace(/\/+$/, '');
}

function fnv1aHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function hashDiagnosticLabel(value: string) {
  return fnv1aHash(value.trim());
}

function classifyAiBaseUrl(value: string | undefined) {
  const normalized = (value ?? '').trim().replace(/\/+$/, '');
  if (!normalized) return 'empty';
  if (normalized === 'https://api.openai.com/v1') return 'openai-default';
  return 'custom-redacted';
}

function countDelimitedText(value: string | undefined) {
  if (!value) return 0;
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean).length;
}

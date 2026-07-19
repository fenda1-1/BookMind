import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-system-diagnostics-service-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/systemDiagnosticsService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildAiDiagnosticsExport,
  buildApplicationDiagnostics,
  buildIndexDiagnosticsExport,
  buildReaderDiagnostics,
  buildSystemInfoDiagnostics,
  collectRuntimeDiagnostics,
  formatSystemInfoDiagnosticsText,
} = require(join(outDir, 'services', 'systemDiagnosticsService.js'));

const runtime = {
  userAgent: 'Mozilla/5.0 BookMindTest',
  language: 'zh-CN',
  languages: ['zh-CN', 'en-US'],
  platform: 'Win32',
  timezone: 'Asia/Shanghai',
  timezoneOffsetMinutes: -480,
  hardwareConcurrency: 16,
  deviceMemory: 32,
  maxTouchPoints: 0,
  cookieEnabled: true,
  online: true,
  viewport: { width: 1440, height: 900 },
  screen: { width: 2560, height: 1440, colorDepth: 24 },
  devicePixelRatio: 1.25,
  colorScheme: 'dark',
  reducedMotion: false,
  tauriRuntime: true,
};

const appSettings = {
  schemaVersion: 1,
  trashRetentionDays: 3,
  aiApiKey: 'sk-live-should-not-leak',
  aiApiBaseUrl: 'https://private-gateway.example.com/v1/org/secret',
  aiEndpointMode: 'responses',
  aiModel: 'gpt-4.1-mini',
  aiRequestTimeoutSecs: 120,
  aiRetryCount: 1,
  aiProxyUrl: 'http://127.0.0.1:7890',
  aiCustomHeaders: '{"X-Provider":"private-provider","Authorization":"Bearer should-not-leak"}',
  aiStreamingEnabled: true,
  aiTemperature: 0.2,
  aiMaxTokens: 0,
  aiTopP: 1,
  aiReasoningEffort: 'none',
  aiResponseFormat: 'auto',
  operationLogLevel: 'debug',
};

const extendedSettings = {
  defaultAiMode: 'cloud',
  aiDefaultScope: 'chapter',
  aiDefaultRetrievalStrategy: 'scope-first',
  cloudAiEnabled: true,
  localAiEnabled: true,
  cloudAiAutoRedact: true,
  cloudAiRequestHistoryEnabled: true,
  applicationPrivacyMode: false,
  hideFilePathsInPrivacyMode: false,
  hideBookTitlesInPrivacyMode: false,
  copyDiagnosticsAutoRedact: false,
  defaultImportPath: 'E:\\private\\library',
  taskConcurrency: '2',
  taskRetryCount: '1',
  taskLogRetention: '30-days',
  completedTaskRetentionLimit: '200',
  operationLogRetention: '20',
  autoIndexImportedBooks: true,
  indexChunkSize: '1200',
  indexChunkOverlap: '120',
  indexRebuildStrategy: 'prompt',
  ftsRepairStrategy: 'prompt',
  readerPageCacheEnabled: true,
  readerPageCacheLimit: '30',
  readerFpsDiagnosticsEnabled: false,
  readerMemoryWarningEnabled: true,
  translationFallbackStrategy: 'default-locale',
  sidecarEnabled: true,
  sidecarCommand: 'C:\\Users\\alice\\sidecar\\run.py',
  sidecarWorkingDir: 'E:\\private\\sidecar',
  sidecarHealthTimeoutMs: '1000',
  sidecarMaxMemoryMb: '2048',
};

const readerSettings = {
  theme: 'paper',
  layoutMode: 'page',
  pageMode: 'single',
  fontFamily: 'PrivateFont',
  customFontFamily: 'Alice Secret Font',
  fontSize: 18,
  lineHeight: 1.8,
  pageWidth: 760,
  privacyMode: false,
};

const chapterRules = {
  enabled: true,
  maxHeadingLength: 60,
  enableChineseChapter: true,
  enableEnglishChapter: true,
  adKeywords: '秘密站点,请收藏',
  customRegexRules: [
    { id: 'secret-rule', label: '私密规则', pattern: '^Secret Chapter (\\d+)' },
  ],
};

const applicationDiagnostics = buildApplicationDiagnostics({
  exportedAt: '2026-06-09T00:00:00.000Z',
  appSettings,
  extendedSettings,
  readerSettings,
  chapterRules,
  diagnosticPaths: {
    dataDir: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind',
    settingsFile: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind\\settings\\settings.json',
    ftsDatabase: '/Users/alice/private/bookmind.sqlite',
  },
  localEncryptionStatus: {
    keyStatus: 'available',
    activeKeyId: 'key-secret-active-id',
    retiredKeyCount: 1,
    masterPasswordEnabled: true,
    fallbackProtection: 'masterPassword',
    keyringAvailable: true,
    fallbackFileExists: true,
    fallbackFilePath: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind\\keys\\local.key',
    wrappedFallbackFileExists: true,
    wrappedFallbackFilePath: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind\\settings\\local-data-key.wrap.json',
    keyMaterial: 'raw-key-should-not-leak',
  },
  aiApiKeyStorageStatus: {
    keyStatus: 'saved',
    primaryStore: 'fallbackFile',
    keyringAvailable: false,
    keyringHasKey: false,
    fallbackFileExists: true,
    fallbackFileHasKey: true,
    fallbackFilePath: 'D:\\secrets\\bookmind-ai-key.json',
    apiKey: 'sk-fallback-should-not-leak',
  },
  indexDiagnostics: {
    summary: {
      ftsAvailable: true,
      indexedBookCount: 1,
      indexedChunkCount: 12,
      ftsDatabasePath: 'E:\\private\\db\\bookmind.sqlite',
      recentError: '无法读取 /Users/alice/private/Secret Book.txt',
    },
  },
  taskStatuses: [
    { id: 'task-1', status: 'failed', stage: 'read-file', filePath: 'E:\\private\\Secret Book.txt', errorMessage: 'Bearer token-should-not-leak' },
    { id: 'task-2', status: 'succeeded', stage: 'index' },
  ],
  taskLogs: [
    { id: 'task-log-1', level: 'error', stage: 'read-file', message: '路径 C:\\Users\\alice\\secret.txt', authorization: 'Bearer abc.def.ghi' },
  ],
  operationLogs: [
    { at: '2026-06-09T00:00:00.000Z', level: 'debug', action: 'ai.request', detail: { prompt: '秘密正文', apiKey: 'sk-log-should-not-leak', path: 'E:\\private\\Secret Book.txt' } },
    { at: '2026-06-09T00:00:01.000Z', level: 'error', action: '打开 E:\\private\\Secret Book.txt Bearer action-secret', detail: { query: '私密查询' } },
  ],
  runtime,
});

assert.equal(applicationDiagnostics.schema, 'bookmind.application-diagnostics.v1');
assert.equal(applicationDiagnostics.exportedAt, '2026-06-09T00:00:00.000Z');
assert.equal(applicationDiagnostics.redaction.secrets, 'always-redacted');
assert.equal(applicationDiagnostics.redaction.absolutePaths, 'hash-only');
assert.deepEqual(applicationDiagnostics.excludedFields, [
  'aiApiKey',
  'authorization',
  'tokens',
  'readerContent',
  'operationLogDetails',
  'prompts',
  'bookTitles',
  'absolutePaths',
]);
assert.equal(applicationDiagnostics.settingsSummary.app.hasAiApiKey, true);
assert.equal(applicationDiagnostics.settingsSummary.app.aiBaseUrlKind, 'custom-redacted');
assert.equal(applicationDiagnostics.taskSummary.total, 2);
assert.equal(applicationDiagnostics.operationLogSummary.total, 2);
assert.deepEqual(applicationDiagnostics.operationLogSummary.recentActions, ['ai.request', '[redacted-action]']);

const applicationSerialized = JSON.stringify(applicationDiagnostics);
assert.doesNotMatch(applicationSerialized, /sk-live|sk-fallback|sk-log|Bearer|token-should-not-leak|key-secret-active-id/i);
assert.doesNotMatch(applicationSerialized, /Users\\alice|C:\\Users|D:\\secrets|E:\\private|\/Users\/alice|Secret Book|秘密正文|私密查询|私密规则|Secret Chapter|private-gateway/);
assert.match(applicationSerialized, /pathHash/);
assert.match(applicationSerialized, /\[redacted-text\]/);

const readerDiagnostics = buildReaderDiagnostics({
  exportedAt: '2026-06-09T00:02:00.000Z',
  readerSettings,
  extendedSettings,
  chapterRules,
  fontRenderingDiagnostics: {
    fontFamily: 'Alice Secret Font, PrivateFont, serif',
    primaryFont: 'Alice Secret Font',
    fallbackCount: 2,
    supports: { textStroke: true, hangingPunctuation: false },
  },
  parserDiagnostics: {
    parserVersion: '3',
    ruleMatches: [{ line: 'Secret Chapter 1', rule: '私密规则' }],
    unmatchedSamples: [{ line: '秘密正文不应导出' }],
  },
  runtime,
});
const readerSerialized = JSON.stringify(readerDiagnostics);

assert.equal(readerDiagnostics.schema, 'bookmind.reader-diagnostics.v1');
assert.equal(readerDiagnostics.exportedAt, '2026-06-09T00:02:00.000Z');
assert.equal(readerDiagnostics.redaction.secrets, 'always-redacted');
assert.equal(readerDiagnostics.redaction.sensitiveText, 'redacted-by-key');
assert.doesNotMatch(readerSerialized, /Secret Chapter|秘密正文|私密规则|Alice Secret Font|PrivateFont/);
assert.match(readerSerialized, /\[redacted-text\]/);

const indexDiagnosticsExport = buildIndexDiagnosticsExport({
  exportedAt: '2026-06-09T00:03:00.000Z',
  indexDiagnostics: {
    summary: {
      ftsAvailable: true,
      indexedBookCount: 1,
      indexedChunkCount: 8,
      ftsDatabasePath: 'E:\\private\\db\\bookmind.sqlite',
      recentError: '无法读取 Secret Book /Users/alice/private/book.txt',
      recentErrors: ['Bearer token-index-leak', '秘密索引错误'],
    },
    books: [{
      bookId: 'book-secret',
      bookTitle: 'Secret Book',
      filePath: 'E:\\private\\Secret Book.txt',
      contentHash: 'hash-v1',
      status: 'failed',
      chunkCount: 8,
      ftsRowCount: 0,
      firstChunkPreview: '秘密正文片段',
      lastError: 'sk-index-should-not-leak',
    }],
  },
  runtime,
});
const indexSerialized = JSON.stringify(indexDiagnosticsExport);

assert.equal(indexDiagnosticsExport.schema, 'bookmind.index-diagnostics.v1');
assert.equal(indexDiagnosticsExport.exportedAt, '2026-06-09T00:03:00.000Z');
assert.equal(indexDiagnosticsExport.redaction.absolutePaths, 'hash-only');
assert.doesNotMatch(indexSerialized, /Secret Book|E:\\private|\/Users\/alice|秘密正文片段|秘密索引错误|sk-index|Bearer token-index/i);
assert.match(indexSerialized, /pathHash|\[redacted-text\]|\[redacted-secret\]/);

const aiDiagnosticsExport = buildAiDiagnosticsExport({
  exportedAt: '2026-06-09T00:04:00.000Z',
  appSettings,
  extendedSettings: {
    ...extendedSettings,
    aiStreamingFlushIntervalMs: '64',
    localAiCancelTimeoutMs: '2500',
    aiNoSelectionFallbackScope: 'chapter',
    aiScopeTokenLimit: '12000',
    cloudAiRequestSizeLimitTokens: '24000',
    cloudAiSensitiveWords: '暗号.*\n项目X',
    aiAutoDowngradeScopeOnTokenOverflow: true,
    cloudAiFallbackToLocalOnFailure: true,
    cloudAiRequestHistoryLimit: '50',
    cloudAiRequestHistorySaveFailed: true,
    cloudAiRequestHistorySaveStopped: false,
    aiCustomSlashCommandLimit: '20',
  },
  aiApiKeyStorageStatus: {
    keyStatus: 'saved',
    primaryStore: 'fallbackFile',
    keyringAvailable: false,
    keyringHasKey: false,
    fallbackFileExists: true,
    fallbackFileHasKey: true,
    fallbackFilePath: 'D:\\secrets\\bookmind-ai-key.json',
    apiKey: 'sk-ai-diagnostics-should-not-leak',
  },
  aiTestStatus: {
    ok: false,
    status: 401,
    model: 'private-model',
    durationMs: 345,
    text: '私密连接响应正文',
    error: 'Bearer token-ai-test-leak from C:\\Users\\alice\\ai.log',
  },
  aiModels: ['private-model', 'private-router/secret-model'],
  customSlashCommands: [
    {
      id: 'cmd-secret',
      label: '秘密命令',
      aliases: ['私密别名'],
      prompt: '请分析 Secret Book 的私密 prompt',
      scopeHint: 'selection',
      outputHint: 'analysis-cards',
      retrievalStrategy: 'hybrid',
    },
  ],
  historyRecords: [{
    bookId: 'book-secret',
    bookTitle: 'Secret Book',
    updatedAt: '2026-06-09T00:00:00.000Z',
    entries: [{
      id: 'history-1',
      bookId: 'book-secret',
      createdAt: '2026-06-09T00:00:00.000Z',
      durationMs: 1200,
      endpointMode: 'responses',
      model: 'private-model',
      scope: 'chapter',
      scopeLabel: '第 1 章 私密标题',
      selectedCommandId: 'cmd-secret',
      retrievalStrategy: 'scope-first',
      resultCount: 3,
      status: 'failed',
      errorKind: 'network',
      redactedFields: ['body', 'scopeText', 'userText', 'apiKey'],
    }],
  }],
  indexDiagnostics: {
    summary: {
      ftsAvailable: true,
      indexedBookCount: 1,
      indexedChunkCount: 12,
      sidecarStatus: 'not-configured',
      sidecarVersion: '0.1.0',
      sidecarCapabilities: ['embedding', 'ner', 'C:\\Users\\alice\\private\\vector-store', 'C:/Users/alice/private/vector-store', '/Users/alice/private/vector-store'],
      sidecarCheckedAt: '1781540000000',
      sidecarErrorCode: 'not-found',
      sidecarMessage: 'AI sidecar could not start (not-found). C:\\Users\\alice\\sidecar\\run.py prompt secret embedding leak',
      vectorIndexStatus: 'not-built',
      vectorIndexedBookCount: 0,
      vectorIndexedChunkCount: 0,
      ftsDatabasePath: 'E:\\private\\db\\bookmind.sqlite',
      recentError: '无法读取 Secret Book /Users/alice/private/book.txt',
    },
  },
  runtime,
});
const aiSerialized = JSON.stringify(aiDiagnosticsExport);

assert.equal(aiDiagnosticsExport.schema, 'bookmind.ai-diagnostics.v1');
assert.equal(aiDiagnosticsExport.exportedAt, '2026-06-09T00:04:00.000Z');
assert.equal(aiDiagnosticsExport.redaction.secrets, 'always-redacted');
assert.equal(aiDiagnosticsExport.redaction.sensitiveText, 'redacted-by-key-or-count-only');
assert.equal(aiDiagnosticsExport.providerSummary.aiBaseUrlKind, 'custom-redacted');
assert.equal(aiDiagnosticsExport.providerSummary.hasAiApiKey, true);
assert.equal(aiDiagnosticsExport.providerSummary.aiProxyConfigured, true);
assert.equal(aiDiagnosticsExport.providerSummary.aiCustomHeadersConfigured, true);
assert.equal(aiDiagnosticsExport.generationSummary.cloudAiRequestSizeLimitTokens, '24000');
assert.equal(aiDiagnosticsExport.privacySummary.cloudAiSensitiveWordCount, 2);
assert.equal(aiDiagnosticsExport.historySummary.totalEntries, 1);
assert.equal(aiDiagnosticsExport.customCommandSummary.total, 1);
assert.equal(aiDiagnosticsExport.modelDiscoverySummary.loadedModelCount, 2);
assert.equal(aiDiagnosticsExport.localRetrievalSummary.ftsAvailable, true);
assert.equal(aiDiagnosticsExport.localRetrievalSummary.sidecarStatus, 'not-configured');
assert.equal(aiDiagnosticsExport.localRetrievalSummary.sidecarVersion, '0.1.0');
assert.equal(aiDiagnosticsExport.localRetrievalSummary.sidecarCapabilityCount, 2);
assert.deepEqual(aiDiagnosticsExport.localRetrievalSummary.sidecarCapabilities, ['embedding', 'ner']);
assert.equal(aiDiagnosticsExport.localRetrievalSummary.sidecarErrorCode, 'not-found');
assert.equal(aiDiagnosticsExport.localRetrievalSummary.sidecarCheckedAt, '1781540000000');
assert.equal(aiDiagnosticsExport.localRetrievalSummary.vectorIndexStatus, 'not-built');
assert.equal(aiDiagnosticsExport.localRetrievalSummary.vectorIndexedBookCount, 0);
assert.equal(aiDiagnosticsExport.localRetrievalSummary.vectorIndexedChunkCount, 0);
assert.doesNotMatch(aiSerialized, /sk-ai-diagnostics|Bearer|token-ai-test-leak|private-gateway|private-provider|127\.0\.0\.1:7890|D:\\secrets|E:\\private|C:\\Users|C:\/Users|\/Users\/alice|sidecar\\run\.py|vector-store/i);
assert.doesNotMatch(aiSerialized, /Secret Book|私密连接响应正文|私密标题|私密 prompt|秘密命令|私密别名|private-router\/secret-model|暗号\.\*|项目X|prompt secret|embedding leak/);
assert.match(aiSerialized, /fallbackFilePath/);
assert.match(aiSerialized, /pathHash|\[redacted-text\]|\[redacted-secret\]|custom-redacted/);

const previousWindow = global.window;
const previousNavigator = global.navigator;
const previousScreen = global.screen;
Object.defineProperty(global, 'window', { configurable: true, value: {
  innerWidth: 800,
  innerHeight: 600,
  devicePixelRatio: 1,
} });
Object.defineProperty(global, 'navigator', { configurable: true, value: {
  userAgent: 'NoMatchMedia',
  language: 'en-US',
  languages: ['en-US'],
  platform: 'Win32',
  cookieEnabled: true,
  onLine: true,
  hardwareConcurrency: 8,
  maxTouchPoints: 0,
} });
Object.defineProperty(global, 'screen', { configurable: true, value: { width: 1024, height: 768, colorDepth: 24 } });
const runtimeWithoutMatchMedia = collectRuntimeDiagnostics(false);
assert.equal(runtimeWithoutMatchMedia.colorScheme, 'unknown');
assert.equal(runtimeWithoutMatchMedia.reducedMotion, false);
Object.defineProperty(global, 'window', { configurable: true, value: previousWindow });
Object.defineProperty(global, 'navigator', { configurable: true, value: previousNavigator });
Object.defineProperty(global, 'screen', { configurable: true, value: previousScreen });

const systemInfo = buildSystemInfoDiagnostics({
  copiedAt: '2026-06-09T00:01:00.000Z',
  appSettings,
  extendedSettings,
  runtime,
  diagnosticPaths: {
    dataDir: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind',
    settingsFile: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind\\settings\\settings.json',
  },
  localEncryptionStatus: {
    keyStatus: 'available',
    activeKeyId: 'key-system-secret-id',
    retiredKeyCount: 2,
    masterPasswordEnabled: true,
    fallbackProtection: 'masterPassword',
    keyringAvailable: true,
    fallbackFilePath: 'C:\\Users\\alice\\keys\\local.key',
    wrappedFallbackFileExists: true,
    wrappedFallbackFilePath: 'C:\\Users\\alice\\keys\\local-data-key.wrap.json',
    keyMaterial: 'raw-key-should-not-leak',
  },
  aiApiKeyStorageStatus: {
    keyStatus: 'saved',
    primaryStore: 'keyring',
    fallbackFilePath: 'D:\\secrets\\bookmind-ai-key.json',
    apiKey: 'sk-system-should-not-leak',
  },
});
const systemText = formatSystemInfoDiagnosticsText(systemInfo);
const systemSerialized = JSON.stringify(systemInfo);

assert.equal(systemInfo.schema, 'bookmind.system-info.v1');
assert.equal(systemInfo.copiedAt, '2026-06-09T00:01:00.000Z');
assert.equal(systemInfo.runtime.timezone, 'Asia/Shanghai');
assert.match(systemText, /BookMind System Info/);
assert.match(systemText, /bookmind.system-info.v1/);
assert.match(systemText, /Tauri: yes/);
assert.doesNotMatch(systemSerialized, /sk-system|raw-key|key-system-secret-id|C:\\Users|D:\\secrets|Users\\alice|private-gateway/);
assert.doesNotMatch(systemText, /sk-system|raw-key|key-system-secret-id|C:\\Users|D:\\secrets|Users\\alice|private-gateway/);

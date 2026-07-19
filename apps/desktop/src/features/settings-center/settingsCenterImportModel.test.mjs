import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-import-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterImportModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCustomCleanupRulesExportPayload,
  buildCustomSlashCommandsExportPayload,
  buildSettingsSnapshot,
  buildSettingsImportPreview,
  parseCustomCleanupRulesImportPayload,
  parseCustomSlashCommandsImportPayload,
} = require(join(outDir, 'features/settings-center/settingsCenterImportModel.js'));

assert.deepEqual(buildSettingsImportPreview({
  schema: 'bookmind.settings.snapshot.v1',
  excludedFields: ['operationLogs', 'aiApiKey'],
  app: { aiApiKey: '[redacted]' },
  reader: {},
  chapterRules: {},
  extended: {},
}, 'settings.json'), {
  fileName: 'settings.json',
  snapshot: {
    schema: 'bookmind.settings.snapshot.v1',
    excludedFields: ['operationLogs', 'aiApiKey'],
    app: { aiApiKey: '[redacted]' },
    reader: {},
    chapterRules: {},
    extended: {},
  },
  additions: [],
  overrides: [
    'AppSettings：回收站、AI Base URL、端点模式、模型、日志等级',
    '阅读器全局默认设置',
    '章节与目录规则',
    '扩展设置与设置中心偏好',
  ],
  conflicts: [],
  blockedFields: [
    'operationLogs',
    'aiApiKey',
    'sidecarCommand',
    'sidecarWorkingDir',
    'aiProviderProfiles.apiKey',
    'aiProviderProfiles.customHeaders.Authorization',
    'aiProviderProfiles.customHeaders.Cookie',
    'providerApiKey',
    'translationSources.apiKey',
  ],
});

const sidecarPreview = buildSettingsImportPreview({
  schema: 'bookmind.settings.snapshot.v1',
  extended: {
    sidecarEnabled: true,
    sidecarCommand: 'C:\\Users\\reader\\sidecar\\run.py',
    sidecarWorkingDir: 'E:\\models\\bookmind',
    sidecarHealthTimeoutMs: '6000',
    sidecarMaxMemoryMb: '4096',
  },
}, 'sidecar-settings.json');

assert.ok(sidecarPreview.overrides.includes('Sidecar 本机路径需要确认'));
assert.ok(sidecarPreview.blockedFields.includes('sidecarCommand'));
assert.ok(sidecarPreview.blockedFields.includes('sidecarWorkingDir'));

assert.deepEqual(buildSettingsImportPreview({
  schema: 'bookmind.settings.snapshot.v1',
  reader: {},
}, 'reader-only.json').additions, ['无 AppSettings 变更']);

assert.deepEqual(buildSettingsImportPreview({
  schema: 'unexpected',
  app: { aiApiKey: 'sk-real-key' },
}, 'unsafe.json').conflicts, [
  '导入文件包含真实或疑似 API Key，将被拒绝覆盖',
  '快照 schema 不兼容',
]);

const snapshot = buildSettingsSnapshot({
  exportedAt: '2026-01-02T03:04:05.000Z',
  appSettings: { aiApiKey: 'sk-secret', aiModel: 'gpt-test' },
  readerSettings: { theme: 'dark' },
  chapterRules: { removeAds: true },
  extendedSettings: {
    annotationExportLastDirectory: 'C:\\Users\\reader\\exports',
    defaultImportPath: '/Users/reader/books',
    sidecarEnabled: true,
    sidecarCommand: 'C:\\Users\\reader\\sidecar\\run.py',
    sidecarWorkingDir: 'E:\\models\\bookmind',
    sidecarHealthTimeoutMs: '6000',
    sidecarMaxMemoryMb: '4096',
  },
  sanitizeExtendedSettings: (settings) => ({
    ...settings,
    annotationExportLastDirectory: '[redacted-path]',
    defaultImportPath: '[redacted-path]',
    sidecarEnabled: false,
    sidecarCommand: '',
    sidecarWorkingDir: '',
  }),
});

assert.equal(snapshot.schema, 'bookmind.settings.snapshot.v1');
assert.equal(snapshot.exportedAt, '2026-01-02T03:04:05.000Z');
assert.equal(snapshot.app.aiApiKey, '[redacted]');
assert.equal(snapshot.app.redactedApiKey, true);
assert.equal(snapshot.app.aiModel, 'gpt-test');
assert.equal(snapshot.extended.annotationExportLastDirectory, '[redacted-path]');
assert.equal(snapshot.extended.sidecarEnabled, false);
assert.equal(snapshot.extended.sidecarCommand, '');
assert.equal(snapshot.extended.sidecarWorkingDir, '');
assert.ok(snapshot.excludedFields.includes('readerContent'));
assert.ok(snapshot.excludedFields.includes('sidecarCommand'));
assert.ok(snapshot.excludedFields.includes('sidecarWorkingDir'));

const cleanupPayload = buildCustomCleanupRulesExportPayload('2026-01-02T03:04:05.000Z', [{ id: 'rule-1', pattern: 'ad', replacement: '', enabled: true }]);
assert.deepEqual(cleanupPayload, {
  schema: 'bookmind.txt-cleanup-rules.v1',
  exportedAt: '2026-01-02T03:04:05.000Z',
  rules: [{ id: 'rule-1', pattern: 'ad', replacement: '', enabled: true }],
});
assert.deepEqual(parseCustomCleanupRulesImportPayload({ rules: ['a'], customCleanupRules: ['b'] }), ['a']);
assert.deepEqual(parseCustomCleanupRulesImportPayload({ customCleanupRules: ['b'] }), ['b']);
assert.deepEqual(parseCustomCleanupRulesImportPayload(['direct']), ['direct']);

const slashPayload = buildCustomSlashCommandsExportPayload('2026-01-02T03:04:05.000Z', [{ id: 'custom-a', label: 'ask' }]);
assert.deepEqual(slashPayload, {
  schema: 'bookmind.ai.custom-slash-commands.v1',
  exportedAt: '2026-01-02T03:04:05.000Z',
  commands: [{ id: 'custom-a', label: 'ask' }],
});
assert.deepEqual(parseCustomSlashCommandsImportPayload({ commands: [{ label: 'ask' }] }, 10, () => 'fixed'), [{ label: 'ask', id: 'custom-import-fixed' }]);
assert.deepEqual(parseCustomSlashCommandsImportPayload([{ id: 'custom-keep', label: 'keep' }], 10, () => 'fixed'), [{ id: 'custom-keep', label: 'keep' }]);
assert.deepEqual(parseCustomSlashCommandsImportPayload({ commands: [{ label: 'a' }, { label: 'b' }] }, 1, () => 'fixed'), [{ label: 'a', id: 'custom-import-fixed' }]);

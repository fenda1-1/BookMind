import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-page-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterPageModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  clearAllReaderCacheLocalStorage,
  clearCurrentBookAllDataLocalStorage,
  clearReaderCacheLocalStorageForBook,
  defaultAppSettings,
  formatSettingsChangeTime,
  sanitizeTauriCommandFailureInfo,
} = require(join(outDir, 'features/settings-center/settingsCenterPageModel.js'));

const defaults = defaultAppSettings();
assert.equal(defaults.schemaVersion, 1);
assert.equal(defaults.aiApiBaseUrl, 'https://api.openai.com/v1');
assert.equal(defaults.aiEndpointMode, 'responses');
assert.equal(defaults.aiStreamingEnabled, true);
assert.equal(defaults.aiProviderProfiles.length, 1);
assert.equal(defaults.aiCancelStrategy, 'abort-and-save-stopped');
assert.equal(defaults.operationLogLevel, 'none');
assert.equal(defaults.trashProtectReadingProgress, true);
assert.equal(defaults.trashProtectReaderAssets, true);

assert.deepEqual(
  sanitizeTauriCommandFailureInfo({
    token: 'Bearer abc.def-ghi',
    nested: ['sk-abcdef123456', 'C:\\Users\\alice\\bookmind\\settings.json', '/Users/alice/private/book.txt'],
    safe: 42,
  }),
  {
    token: '[redacted-secret]',
    nested: ['[redacted-secret]', '[redacted-path]', '[redacted-path]'],
    safe: 42,
  },
);

assert.equal(formatSettingsChangeTime('not-a-date'), 'not-a-date');
assert.notEqual(formatSettingsChangeTime('2026-01-02T03:04:05.000Z'), '2026-01-02T03:04:05.000Z');

const removed = [];
globalThis.localStorage = {
  length: 0,
  key() { return null; },
  removeItem(key) { removed.push(key); },
};

const removeKeys = (keys) => {
  keys.forEach((key) => removed.push(key));
  return keys.length;
};
const removePrefix = (prefix) => {
  removed.push(`${prefix}*`);
  return 1;
};

assert.equal(clearReaderCacheLocalStorageForBook('book-1', removeKeys, removePrefix), 3);
assert.deepEqual(removed.splice(0), [
  'bookmind:reader-state:book-1',
  'bookmind:reader-window:book-1',
  'bookmind:reader-page-cache:book-1:*',
]);

assert.equal(clearAllReaderCacheLocalStorage(removePrefix), 3);
assert.deepEqual(removed.splice(0), [
  'bookmind:reader-state:*',
  'bookmind:reader-window:*',
  'bookmind:reader-page-cache:*',
]);

assert.equal(clearCurrentBookAllDataLocalStorage('book-1', removeKeys, removePrefix), 9);
assert.ok(removed.includes('bookmind:reader-highlights-index:book-1'));
assert.ok(removed.includes('bookmind:reader-highlight-entry:book-1:*'));

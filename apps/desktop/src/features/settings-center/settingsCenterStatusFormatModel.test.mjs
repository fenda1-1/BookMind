import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-status-format-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterStatusFormatModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  formatAiApiKeyPrimaryStore,
  formatAiApiKeyStorageStatus,
  formatDataDirectoryMode,
  formatLocalEncryptionFallbackProtection,
  formatLocalEncryptionKeyStatus,
  formatSettingsByteSize,
  formatSettingsPageError,
  shortKeyId,
} = require(existsSync(join(outDir, 'settingsCenterStatusFormatModel.js'))
  ? join(outDir, 'settingsCenterStatusFormatModel.js')
  : join(outDir, 'features/settings-center/settingsCenterStatusFormatModel.js'));

assert.equal(formatSettingsByteSize(0), '0 B');
assert.equal(formatSettingsByteSize(Number.NaN), '0 B');
assert.equal(formatSettingsByteSize(512), '512 B');
assert.equal(formatSettingsByteSize(1536), '1.5 KB');
assert.equal(formatSettingsByteSize(10 * 1024), '10 KB');
assert.equal(formatSettingsByteSize(2 * 1024 * 1024), '2.0 MB');

assert.equal(formatSettingsPageError(new Error('boom')), 'boom');
assert.equal(formatSettingsPageError('plain'), 'plain');
assert.equal(formatSettingsPageError({ code: 'E_TEST' }), '{"code":"E_TEST"}');

assert.equal(formatLocalEncryptionKeyStatus(null, true, ''), 'Loading');
assert.equal(formatLocalEncryptionKeyStatus(null, false, 'failed'), 'Error');
assert.equal(formatLocalEncryptionKeyStatus(null, false, ''), 'Not loaded');
assert.equal(formatLocalEncryptionKeyStatus({ keyStatus: 'available' }, false, ''), 'Available');
assert.equal(formatLocalEncryptionKeyStatus({ keyStatus: 'locked' }, false, ''), 'Master password required');
assert.equal(formatLocalEncryptionKeyStatus({ keyStatus: 'missing' }, false, ''), 'Not created');
assert.equal(formatLocalEncryptionKeyStatus({ keyStatus: 'error' }, false, ''), 'Error');
assert.equal(formatLocalEncryptionKeyStatus({ keyStatus: 'rotating' }, false, ''), 'rotating');

assert.equal(formatLocalEncryptionFallbackProtection(null), 'Waiting for load');
assert.equal(formatLocalEncryptionFallbackProtection({ fallbackProtection: 'masterPassword' }), 'Master password protected');
assert.equal(formatLocalEncryptionFallbackProtection({ fallbackProtection: 'plaintextFile' }), 'Plaintext fallback file');
assert.equal(formatLocalEncryptionFallbackProtection({ fallbackProtection: 'keyringOnly' }), 'Keyring only');
assert.equal(formatLocalEncryptionFallbackProtection({ fallbackProtection: 'none' }), 'Not created');
assert.equal(formatLocalEncryptionFallbackProtection({ fallbackProtection: 'custom' }), 'custom');

assert.equal(shortKeyId(), 'none');
assert.equal(shortKeyId('short-key'), 'short-key');
assert.equal(shortKeyId('1234567890abcdef'), '12345678…cdef');

assert.equal(formatDataDirectoryMode(null), 'Waiting for load');
assert.equal(formatDataDirectoryMode({ mode: 'portable' }), 'Portable mode');
assert.equal(formatDataDirectoryMode({ mode: 'custom' }), 'Custom directory');
assert.equal(formatDataDirectoryMode({ mode: 'default' }), 'Default directory');

assert.equal(formatAiApiKeyStorageStatus(null, true, ''), 'Loading');
assert.equal(formatAiApiKeyStorageStatus(null, false, 'failed'), 'Error');
assert.equal(formatAiApiKeyStorageStatus(null, false, ''), 'Not loaded');
assert.equal(formatAiApiKeyStorageStatus({ keyStatus: 'saved' }, false, ''), 'Saved');
assert.equal(formatAiApiKeyStorageStatus({ keyStatus: 'missing' }, false, ''), 'Not saved');
assert.equal(formatAiApiKeyStorageStatus({ keyStatus: 'error' }, false, ''), 'Error');
assert.equal(formatAiApiKeyStorageStatus({ keyStatus: 'unknown-store' }, false, ''), 'unknown-store');

assert.equal(formatAiApiKeyPrimaryStore('keyring'), 'keyring');
assert.equal(formatAiApiKeyPrimaryStore('fallbackFile'), 'fallback file');
assert.equal(formatAiApiKeyPrimaryStore('none'), 'Not saved');
assert.equal(formatAiApiKeyPrimaryStore(undefined), 'Not loaded');

const zh = (key) => ({
  'settings.statusFormat.loading': '加载中',
  'settings.statusFormat.saved': '已保存',
  'settings.statusFormat.fallbackFile': 'fallback 文件',
}[key] ?? key);
assert.equal(formatAiApiKeyStorageStatus(null, true, '', zh), '加载中');
assert.equal(formatAiApiKeyStorageStatus({ keyStatus: 'saved' }, false, '', zh), '已保存');
assert.equal(formatAiApiKeyPrimaryStore('fallbackFile', zh), 'fallback 文件');

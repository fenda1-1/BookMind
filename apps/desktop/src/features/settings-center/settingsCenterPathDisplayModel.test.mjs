import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-path-display-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterPathDisplayModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  joinDisplayPath,
  normalizeDisplayPath,
} = require(join(outDir, 'settingsCenterPathDisplayModel.js'));

assert.equal(normalizeDisplayPath('C:\\Users\\reader\\BookMind\\'), 'C:/Users/reader/BookMind');
assert.equal(normalizeDisplayPath('/Users/reader/BookMind///'), '/Users/reader/BookMind');
assert.equal(normalizeDisplayPath('relative\\path'), 'relative/path');
assert.equal(joinDisplayPath('C:\\Users\\reader\\BookMind\\', 'settings/settings.json'), 'C:/Users/reader/BookMind/settings/settings.json');

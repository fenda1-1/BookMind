import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-reader-command-handlers-test-${process.pid}`);
execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--ignoreConfig',
    '--target',
    'ES2022',
    '--module',
    'CommonJS',
    '--moduleResolution',
    'Node',
    '--ignoreDeprecations',
    '6.0',
    '--outDir',
    outDir,
    '--skipLibCheck',
    'src/features/reader-core/moyuReaderSettingsModel.ts',
  ],
  { cwd: process.cwd(), stdio: 'inherit' },
);

const require = createRequire(import.meta.url);
const { resolveMoyuWindowGeometryFromProfile } = require(join(outDir, 'features', 'reader-core', 'moyuReaderSettingsModel.js'));

const monitor = {
  position: { x: 100, y: 200 },
  size: { width: 1920, height: 1080 },
};

assert.deepEqual(
  resolveMoyuWindowGeometryFromProfile({
    windowWidth: 520,
    windowHeight: 280,
    windowPreset: 'bottom-right',
    windowSnapToEdges: true,
    rememberWindowPosition: true,
    windowAspectLock: false,
    windowAspectRatio: 520 / 280,
  }, monitor),
  { width: 520, height: 280, x: 100 + 1920 - 520, y: 200 + 1080 - 280 - 64 },
);

assert.deepEqual(
  resolveMoyuWindowGeometryFromProfile({
    windowWidth: 640,
    windowHeight: 360,
    windowPreset: 'custom',
    windowSnapToEdges: true,
    rememberWindowPosition: true,
    windowX: 140,
    windowY: 260,
    windowAspectLock: false,
    windowAspectRatio: 640 / 360,
  }, monitor),
  { width: 640, height: 360, x: 140, y: 260 },
);

console.log('Verified moyu window geometry resolution.');

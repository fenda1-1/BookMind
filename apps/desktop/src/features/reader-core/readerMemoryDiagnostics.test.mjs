import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-reader-memory-diagnostics-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/reader-core/readerMemoryDiagnostics.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { buildReaderMemoryDiagnostics, clampMemoryThreshold } = await import(pathToFileURL(join(outDir, 'readerMemoryDiagnostics.js')).href);

const oneMb = 1024 * 1024;

assert.deepEqual(
  buildReaderMemoryDiagnostics(null, 512),
  { supported: false, usedMb: 0, totalMb: 0, limitMb: 0, thresholdMb: 512, warning: false, ratio: 0 },
  'unsupported browsers must return a non-warning diagnostic instead of guessing memory',
);

assert.deepEqual(
  buildReaderMemoryDiagnostics({ usedJSHeapSize: 640 * oneMb, totalJSHeapSize: 800 * oneMb, jsHeapSizeLimit: 1600 * oneMb }, 512),
  { supported: true, usedMb: 640, totalMb: 800, limitMb: 1600, thresholdMb: 512, warning: true, ratio: 0.4 },
  'memory diagnostics must warn when used heap reaches the configured threshold',
);

assert.deepEqual(
  buildReaderMemoryDiagnostics({ usedJSHeapSize: 120 * oneMb, totalJSHeapSize: 256 * oneMb, jsHeapSizeLimit: 2048 * oneMb }, 512),
  { supported: true, usedMb: 120, totalMb: 256, limitMb: 2048, thresholdMb: 512, warning: false, ratio: 0.05859375 },
  'memory diagnostics must stay quiet below the configured threshold',
);

assert.equal(clampMemoryThreshold(16), 64, 'memory threshold must not go below 64 MB');
assert.equal(clampMemoryThreshold(8192), 4096, 'memory threshold must not exceed 4096 MB');
assert.equal(clampMemoryThreshold(Number.NaN), 512, 'invalid memory threshold must fall back to 512 MB');

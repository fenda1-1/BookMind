import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-performance-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterPerformanceModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildSettingsPerformanceTuningProfile,
  parseSettingsPerformanceInteger,
} = require(join(outDir, 'settingsCenterPerformanceModel.js'));

assert.equal(parseSettingsPerformanceInteger('7', 1), 7);
assert.equal(parseSettingsPerformanceInteger(' 08 ', 1), 8);
assert.equal(parseSettingsPerformanceInteger('0', 3), 0);
assert.equal(parseSettingsPerformanceInteger('-2', 3), 0);
assert.equal(parseSettingsPerformanceInteger('abc', 5), 5);

const localeNeutralProfile = buildSettingsPerformanceTuningProfile({
  taskConcurrency: '1',
  importConcurrency: '1',
  parseConcurrency: '1',
  vectorConcurrencyReserved: '1',
  indexChunkSize: '2400',
  indexChunkOverlap: '0',
  ftsWriteSerial: true,
  largeBookPerformanceMode: false,
  virtualChapterRadius: '1',
  virtualParagraphWindowSize: '40',
  readerPageCacheLimit: '10',
  readerPageMeasureCacheLimit: '12',
  readerPagePreheatRange: '0',
});
assert.doesNotMatch(JSON.stringify(localeNeutralProfile), /\p{Script=Han}/u, 'performance profile should expose locale-neutral status keys, not Chinese UI text');

assert.deepEqual(buildSettingsPerformanceTuningProfile({
  taskConcurrency: '1',
  importConcurrency: '1',
  parseConcurrency: '1',
  vectorConcurrencyReserved: '1',
  indexChunkSize: '2400',
  indexChunkOverlap: '0',
  ftsWriteSerial: true,
  largeBookPerformanceMode: false,
  virtualChapterRadius: '1',
  virtualParagraphWindowSize: '40',
  readerPageCacheLimit: '10',
  readerPageMeasureCacheLimit: '12',
  readerPagePreheatRange: '0',
}), {
  taskConcurrency: 1,
  importConcurrency: 1,
  parseConcurrency: 1,
  vectorConcurrencyReserved: 1,
  indexChunkSize: 2400,
  indexChunkOverlap: 0,
  virtualChapterRadius: 1,
  virtualParagraphWindowSize: 40,
  readerPageCacheLimit: 10,
  readerPageMeasureCacheLimit: 12,
  readerPagePreheatRange: 0,
  indexThroughputLevel: 'conservative',
  readerMemoryLevel: 'low',
  largeBookAdvice: 'suggested',
});

assert.deepEqual(buildSettingsPerformanceTuningProfile({
  taskConcurrency: '4',
  importConcurrency: '4',
  parseConcurrency: '3',
  vectorConcurrencyReserved: '2',
  indexChunkSize: '900',
  indexChunkOverlap: '900',
  ftsWriteSerial: false,
  largeBookPerformanceMode: false,
  virtualChapterRadius: '3',
  virtualParagraphWindowSize: '120',
  readerPageCacheLimit: '90',
  readerPageMeasureCacheLimit: '96',
  readerPagePreheatRange: '2',
}).indexThroughputLevel, 'aggressive');

assert.deepEqual(buildSettingsPerformanceTuningProfile({
  taskConcurrency: '4',
  importConcurrency: '4',
  parseConcurrency: '3',
  vectorConcurrencyReserved: '2',
  indexChunkSize: '900',
  indexChunkOverlap: '900',
  ftsWriteSerial: false,
  largeBookPerformanceMode: true,
  virtualChapterRadius: '3',
  virtualParagraphWindowSize: '120',
  readerPageCacheLimit: '90',
  readerPageMeasureCacheLimit: '96',
  readerPagePreheatRange: '2',
}), {
  taskConcurrency: 4,
  importConcurrency: 4,
  parseConcurrency: 3,
  vectorConcurrencyReserved: 2,
  indexChunkSize: 900,
  indexChunkOverlap: 900,
  virtualChapterRadius: 3,
  virtualParagraphWindowSize: 120,
  readerPageCacheLimit: 90,
  readerPageMeasureCacheLimit: 96,
  readerPagePreheatRange: 2,
  indexThroughputLevel: 'aggressive',
  readerMemoryLevel: 'high',
  largeBookAdvice: 'enabled',
});

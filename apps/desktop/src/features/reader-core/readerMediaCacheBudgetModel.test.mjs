import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-reader-media-cache-budget-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck',
  'src/features/reader-core/readerMediaCacheBudgetModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const model = await import(pathToFileURL(join(outDir, 'readerMediaCacheBudgetModel.js')).href);
const first = model.putBoundedRecordCache({}, [], 'one', 1, 2);
const second = model.putBoundedRecordCache(first.entries, first.order, 'two', 2, 2);
const third = model.putBoundedRecordCache(second.entries, second.order, 'three', 3, 2);
assert.deepEqual(Object.keys(third.entries).sort(), ['three', 'two']);
assert.deepEqual(third.evictedKeys, ['one']);
const refreshed = model.putBoundedRecordCache(third.entries, third.order, 'two', 22, 2);
const fourth = model.putBoundedRecordCache(refreshed.entries, refreshed.order, 'four', 4, 2);
assert.deepEqual(Object.keys(fourth.entries).sort(), ['four', 'two']);
assert.deepEqual(fourth.evictedKeys, ['three']);
assert.equal(model.clampCanvasPixelRatio(1000, 1000, 3, 1_000_000), 1);
assert.equal(model.clampCanvasPixelRatio(1000, 1000, 1, 6_000_000), 1);
assert.equal(model.clampCanvasPixelRatio(4000, 4000, 2, 1_000_000), 0.25);

console.log('Verified bounded reader media caches and canvas pixel-ratio budgets.');

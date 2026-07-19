import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-list-viewport-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--rootDir', 'src',
  '--skipLibCheck',
  'src/features/characters/characterListViewport.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterListViewport,
  getCharacterListViewportRowTop,
} = require(join(outDir, 'features', 'characters', 'characterListViewport.js'));

const firstViewport = buildCharacterListViewport({
  totalCount: 1000,
  scrollTop: 0,
  viewportHeight: 300,
  rowHeight: 48,
  rowGap: 8,
  overscan: 2,
});

assert.deepEqual(firstViewport, {
  totalCount: 1000,
  startIndex: 0,
  endIndex: 9,
  renderedCount: 9,
  rowHeight: 48,
  rowGap: 8,
  rowStride: 56,
  totalHeight: 55992,
}, 'first viewport should render only the visible rows plus overscan');
assert.equal(getCharacterListViewportRowTop(firstViewport, 0), 0, 'first row should start at top');
assert.equal(getCharacterListViewportRowTop(firstViewport, 8), 448, 'row top should include row gaps');

const middleViewport = buildCharacterListViewport({
  totalCount: 1000,
  scrollTop: 560,
  viewportHeight: 300,
  rowHeight: 48,
  rowGap: 8,
  overscan: 2,
});
assert.equal(middleViewport.startIndex, 8, 'middle viewport should overscan before the first visible row');
assert.equal(middleViewport.endIndex, 19, 'middle viewport should overscan after visible rows');
assert.equal(middleViewport.renderedCount, 11, 'middle viewport should avoid rendering all rows');
assert.equal(getCharacterListViewportRowTop(middleViewport, middleViewport.startIndex), 448, 'middle row top should preserve scroll position');

const endViewport = buildCharacterListViewport({
  totalCount: 12,
  scrollTop: 9999,
  viewportHeight: 300,
  rowHeight: 48,
  rowGap: 8,
  overscan: 2,
});
assert.equal(endViewport.startIndex, 9, 'end viewport should clamp start to a valid row');
assert.equal(endViewport.endIndex, 12, 'end viewport should clamp end to total count');

const emptyViewport = buildCharacterListViewport({
  totalCount: 0,
  scrollTop: -20,
  viewportHeight: 0,
  rowHeight: 0,
  rowGap: -10,
  overscan: -2,
});
assert.deepEqual(emptyViewport, {
  totalCount: 0,
  startIndex: 0,
  endIndex: 0,
  renderedCount: 0,
  rowHeight: 1,
  rowGap: 0,
  rowStride: 1,
  totalHeight: 0,
}, 'empty viewport should normalize invalid dimensions and avoid negative ranges');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-reader-pagination-test-${process.pid}`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/features/reader-core/readerPagination.ts', 'src/features/reader-core/readerModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  estimateReaderPageCount,
  estimateReaderPageCountFromCharacters,
  getEstimatedReaderStreamIndex,
  getReaderAdjacentPageTarget,
  getReaderChapterPageTargetFromStreamIndex,
  getReaderPageStreamLength,
  getReaderSpreadPageTurnTarget,
  getReaderVisiblePageStreamWindow,
} = require(join(outDir, 'features/reader-core/readerPagination.js'));

const chapters = [
  { id: 'c1', title: 'Chapter 1', index: 0, startLine: 0, paragraphs: ['Alpha beta gamma.'], characterCount: 16 },
  { id: 'c2', title: 'Chapter 2', index: 1, startLine: 2, paragraphs: ['One two three four five six.'], characterCount: 28 },
  { id: 'c3', title: 'Chapter 3', index: 2, startLine: 4, paragraphs: ['Final page.'], characterCount: 11 },
];

assert.equal(estimateReaderPageCountFromCharacters(0, 500), 1, 'empty chapters still reserve one page');
assert.equal(estimateReaderPageCountFromCharacters(1201, 600.9), 3, 'capacity is floored before estimating page count');
assert.equal(estimateReaderPageCountFromCharacters(5, 0), 5, 'invalid capacity clamps to one character per page');
assert.equal(estimateReaderPageCount(chapters[1], 10), 3, 'chapter page estimation should use cached character counts');

assert.equal(getEstimatedReaderStreamIndex([2, 3, 1], 1, 2), 4, 'stream index should include previous chapter pages');
assert.equal(getEstimatedReaderStreamIndex([2, 3, 1], 99, 99), 5, 'stream index should clamp to the last known page');
assert.equal(getReaderPageStreamLength([2, 3, 1]), 6, 'page stream length should sum the same page-count table used by stream indexes');
assert.ok(
  getEstimatedReaderStreamIndex([2, 3, 10700], 2, 10699) + 1 <= getReaderPageStreamLength([2, 3, 10700]),
  'current stream page must not exceed total pages when measured pagination grows beyond estimates',
);
assert.deepEqual(getReaderChapterPageTargetFromStreamIndex([2, 3, 1], 4), { chapterIndex: 1, screenPage: 2 }, 'stream targets should map back to chapter page offsets');
assert.deepEqual(getReaderChapterPageTargetFromStreamIndex([2, 3, 1], 999), { chapterIndex: 2, screenPage: 0 }, 'overflow stream targets should clamp to the final chapter');
assert.equal(getReaderChapterPageTargetFromStreamIndex([], 0), null, 'empty page-count lists have no target');
assert.deepEqual(
  getReaderAdjacentPageTarget('next', {
    activeChapterIndex: 0,
    activeScreenPage: 5,
    activeChapterPageCount: 6,
    chapterPageCounts: [3, 8, 1],
    chapterCount: 3,
  }),
  { chapterIndex: 1, screenPage: 0 },
  'sequential next-page turns must enter the next chapter first page instead of remapping through stale global estimates',
);
assert.deepEqual(
  getReaderAdjacentPageTarget('prev', {
    activeChapterIndex: 1,
    activeScreenPage: 0,
    activeChapterPageCount: 8,
    chapterPageCounts: [6, 4, 1],
    chapterCount: 3,
  }),
  { chapterIndex: 0, screenPage: 5 },
  'sequential previous-page turns must return to the previous chapter measured last page',
);
assert.deepEqual(
  getReaderSpreadPageTurnTarget('next', {
    activeStreamIndex: 55,
    visiblePageCount: 2,
    pageStreamLength: 60,
    chapterPageCounts: [56, 4],
  }),
  { chapterIndex: 1, screenPage: 1 },
  'double-page next turns must advance by the visible spread width even when the right page is the next chapter first page',
);
assert.deepEqual(
  getReaderSpreadPageTurnTarget('prev', {
    activeStreamIndex: 57,
    visiblePageCount: 2,
    pageStreamLength: 60,
    chapterPageCounts: [56, 4],
  }),
  { chapterIndex: 0, screenPage: 55 },
  'double-page previous turns must move back by the visible spread width across chapter boundaries',
);

const measuredChunks = [
  { pageIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 5, text: 'One t', entries: [{ paragraphIndex: 0, startOffset: 0, endOffset: 5, text: 'One t' }] },
  { pageIndex: 1, paragraphIndex: 0, startOffset: 5, endOffset: 10, text: 'wo th', entries: [{ paragraphIndex: 0, startOffset: 5, endOffset: 10, text: 'wo th' }] },
];

assert.deepEqual(
  getReaderVisiblePageStreamWindow({
    chapters,
    activeChapterIndex: 1,
    activeScreenPage: 0,
    activePageChunks: measuredChunks,
    estimatedChapterPageCounts: [2, 3, 1],
    estimatedCapacity: 10,
    resolvedPageMode: 'double',
    chapterStartsNewPage: true,
  }).map((page) => ({ streamIndex: page.streamIndex, chapterId: page.chapterId, pageInChapter: page.pageInChapter, text: page.chunk.text })),
  [
    { streamIndex: 2, chapterId: 'c2', pageInChapter: 0, text: 'One t' },
    { streamIndex: 3, chapterId: 'c2', pageInChapter: 1, text: 'wo th' },
  ],
  'visible page stream should prefer measured active-chapter chunks',
);

assert.deepEqual(
  getReaderVisiblePageStreamWindow({
    chapters,
    activeChapterIndex: 1,
    activeScreenPage: 2,
    activePageChunks: measuredChunks,
    adjacentChapterPageChunks: [measuredChunks[0]],
    estimatedChapterPageCounts: [2, 3, 1],
    estimatedCapacity: 10,
    resolvedPageMode: 'double',
    chapterStartsNewPage: false,
  }).map((page) => ({ streamIndex: page.streamIndex, chapterId: page.chapterId, pageInChapter: page.pageInChapter })),
  [
    { streamIndex: 3, chapterId: 'c2', pageInChapter: 1 },
    { streamIndex: 4, chapterId: 'c3', pageInChapter: 0 },
  ],
  'double-page mode may borrow the first page of the next chapter when chapters do not start on a new page',
);

assert.deepEqual(
  getReaderVisiblePageStreamWindow({
    chapters,
    activeChapterIndex: 1,
    activeScreenPage: 2,
    activePageChunks: measuredChunks,
    estimatedChapterPageCounts: [2, 3, 1],
    estimatedCapacity: 10,
    resolvedPageMode: 'double',
    chapterStartsNewPage: false,
    allowEstimatedActivePageChunks: false,
  }).map((page) => ({ streamIndex: page.streamIndex, chapterId: page.chapterId, pageInChapter: page.pageInChapter })),
  [
    { streamIndex: 3, chapterId: 'c2', pageInChapter: 1 },
  ],
  'double-page right side must not estimate the next chapter first page when measured pagination is required',
);

assert.deepEqual(
  getReaderVisiblePageStreamWindow({
    chapters: [],
    activeChapterIndex: 0,
    activeScreenPage: 0,
    activePageChunks: [],
    estimatedChapterPageCounts: [],
    estimatedCapacity: 10,
    resolvedPageMode: 'single',
    chapterStartsNewPage: true,
  }),
  [],
  'missing active chapters should render no visible page stream',
);
assert.deepEqual(
  getReaderVisiblePageStreamWindow({
    chapters,
    activeChapterIndex: 0,
    activeScreenPage: 0,
    activePageChunks: [],
    estimatedChapterPageCounts: [2, 3, 1],
    estimatedCapacity: 10,
    resolvedPageMode: 'single',
    chapterStartsNewPage: true,
    allowEstimatedActivePageChunks: false,
  }),
  [],
  'page mode must be able to suppress estimated visible chunks until measured pagination is ready',
);

const adjacentMeasuredPages = getReaderVisiblePageStreamWindow({
  chapters,
  activeChapterIndex: 1,
  activeScreenPage: 0,
  activePageChunks: measuredChunks,
  estimatedChapterPageCounts: [2, 3, 1],
  estimatedCapacity: 10,
  resolvedPageMode: 'double',
  chapterStartsNewPage: true,
});
assert.equal(
  adjacentMeasuredPages[0].chunk.entries.at(-1).endOffset <= adjacentMeasuredPages[1].chunk.entries[0].startOffset,
  true,
  'adjacent measured visible pages must advance paragraph offsets instead of repeating text already shown at the previous page bottom',
);

console.log('Verified reader pagination model helpers.');

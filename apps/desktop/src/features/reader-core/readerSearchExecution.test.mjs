import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-reader-search-execution-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/reader-core/readerSearchModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const {
  buildReaderSearchIndex,
  createReaderSearchExecution,
  searchReaderIndex,
} = await import(pathToFileURL(join(outDir, 'features', 'reader-core', 'readerSearchModel.js')).href);

const chapters = Array.from({ length: 48 }, (_, chapterIndex) => ({
  id: `chapter-${chapterIndex}`,
  title: `第${chapterIndex + 1}章 隐秘档案`,
  index: chapterIndex,
  startLine: chapterIndex * 10,
  paragraphs: Array.from({ length: 12 }, (_, paragraphIndex) =>
    paragraphIndex % 4 === 0 ? `第${paragraphIndex}段包含隱秘檔案和 Alpha Beta。` : `普通正文 ${chapterIndex}-${paragraphIndex}`),
}));
const highlights = [{
  id: 'highlight-1',
  chapterIndex: 3,
  paragraphIndex: 2,
  startOffset: 4,
  endOffset: 8,
  text: '隐秘档案',
  note: '关键伏笔',
}];
const bookmarks = [{
  id: 'bookmark-1',
  chapterIndex: 4,
  paragraphIndex: 1,
  label: '隐秘档案书签',
}];
const index = buildReaderSearchIndex(chapters, highlights, bookmarks);

const cases = [
  ['隐秘档案', { scope: 'book', limit: 20 }],
  ['隱秘檔案', { scope: 'book', chapterRange: [2, 3, 4], limit: 50 }],
  ['隐 档', { scope: 'book', fuzzy: true, offset: 2, limit: 12 }],
  ['Alpha', { scope: 'book', caseSensitive: true, limit: 30 }],
  ['ymda', { scope: 'book', pinyinInitials: true, limit: 30 }],
  ['伏笔', { scope: 'annotations', limit: 10 }],
  ['书签', { scope: 'bookmarks', limit: 10 }],
  ['隐秘档案', { scope: 'all', offset: 3, limit: 25 }],
];

for (const [query, options] of cases) {
  const expected = searchReaderIndex(index, query, options);
  for (const budget of [1, 7, 64]) {
    const execution = createReaderSearchExecution(index, query, options);
    let result = execution.step(budget);
    while (!result.done) result = execution.step(budget);
    assert.deepEqual(result.hits, expected, `stepped search must match synchronous results for ${query} at budget ${budget}`);
  }
}

const progressiveExecution = createReaderSearchExecution(index, '隐秘档案', { scope: 'book', limit: 800 });
let progressiveStep = progressiveExecution.step(1);
let observedPartialHits = progressiveExecution.getPartialHits().length > 0;
while (!progressiveStep.done) {
  progressiveStep = progressiveExecution.step(7);
  if (progressiveExecution.getPartialHits().length > 0) observedPartialHits = true;
}
assert.equal(observedPartialHits, true, 'long searches must expose partial hits before the full scan finishes');
assert.deepEqual(progressiveStep.hits, searchReaderIndex(index, '隐秘档案', { scope: 'book', limit: 800 }), 'progressive search must still finish with the canonical result set');

assert.deepEqual(
  searchReaderIndex(index, '隐秘档案', { scope: 'book', pinyinInitials: true }),
  searchReaderIndex(index, '隐秘档案', { scope: 'book', pinyinInitials: false }),
  'Chinese literal queries must preserve results without attempting an impossible pinyin-initial match',
);

console.log('Verified cooperative reader search execution preserves synchronous search results.');

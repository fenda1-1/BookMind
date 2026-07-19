import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-search-page-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/search/searchPageModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  allSearchBooksFilterValue,
  buildSearchBookFilterOptions,
  filterSearchResultsByBook,
} = require(join(outDir, 'features', 'search', 'searchPageModel.js'));

const results = [
  searchResult('chunk-1', 'book-1', '剑来'),
  searchResult('chunk-2', 'book-2', '斩神'),
  searchResult('chunk-3', 'book-1', '剑来'),
  searchResult('chunk-4', 'book-3', '诡秘之主'),
];

const books = [
  book('book-1', '剑来'),
  book('book-2', '斩神'),
  book('book-3', '诡秘之主'),
];

const optionsBeforeSearch = buildSearchBookFilterOptions(books, [], { currentBookId: 'book-2' });
assert.deepEqual(optionsBeforeSearch.map((option) => [option.value, option.label, option.count]), [
  [allSearchBooksFilterValue, '全部书籍', 0],
  ['book-2', '当前书籍：斩神', 0],
  ['book-1', '剑来', 0],
  ['book-3', '诡秘之主', 0],
]);

const options = buildSearchBookFilterOptions(books, results, { currentBookId: 'book-2' });
assert.deepEqual(options.map((option) => [option.value, option.label, option.count]), [
  [allSearchBooksFilterValue, '全部书籍', 4],
  ['book-2', '当前书籍：斩神', 1],
  ['book-1', '剑来', 2],
  ['book-3', '诡秘之主', 1],
]);

assert.equal(filterSearchResultsByBook(results, allSearchBooksFilterValue).length, 4);
assert.deepEqual(filterSearchResultsByBook(results, 'book-1').map((result) => result.chunkId), ['chunk-1', 'chunk-3']);
assert.equal(filterSearchResultsByBook(results, 'missing').length, 0);

function searchResult(chunkId, bookId, bookTitle) {
  return {
    chunkId,
    bookId,
    bookTitle,
    chapter: '第一章',
    sourceChapterIndex: 0,
    chapterTitle: '第一章',
    snippet: '片段',
    score: 1,
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 0,
  };
}

function book(id, title) {
  return {
    id,
    title,
    displayTitle: title,
    author: '',
    format: 'txt',
    status: 'reading',
    progress: 0,
    fileName: `${title}.txt`,
    filePath: '',
    coverLabel: 'TXT',
    coverTone: 'amber',
    deleted: false,
    deletedAt: '',
    contentHash: '',
    importedAt: '',
    content: '',
    chunks: [],
  };
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-knowledge-page-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/pages/knowledgePageState.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildKnowledgeBookSummaries, buildKnowledgePageItems, buildKnowledgePageSelectionState, matchesKnowledgeView } = require(join(outDir, 'pages', 'knowledgePageState.js'));

const state = buildKnowledgePageSelectionState({
  activeTab: 'highlights',
  selectedIds: new Set(['highlight:h1', 'highlight:h2']),
  highlights: [
    highlight('h1'),
    highlight('h2'),
    highlight('h3'),
  ],
  notes: [note('n1')],
  flashcards: [flashcard('f1')],
  searchQuery: '',
});

assert.equal(state.visibleCount, 3);
assert.equal(state.selectedVisibleCount, 2);
assert.deepEqual(state.batchDeleteIds, ['h1', 'h2']);

const filtered = buildKnowledgePageSelectionState({
  activeTab: 'notes',
  selectedIds: new Set(['note:n1', 'highlight:h1']),
  highlights: [highlight('h1')],
  notes: [note('n1')],
  flashcards: [],
  searchQuery: '不存在',
});

assert.equal(filtered.visibleCount, 0);
assert.equal(filtered.selectedVisibleCount, 0);
assert.deepEqual(filtered.batchDeleteIds, []);

const book = {
  id: 'book-1',
  title: '测试书',
  displayTitle: '测试书',
  author: '作者',
  format: 'txt',
  status: 'reading',
  progress: 20,
  fileName: 'test.txt',
  filePath: 'test.txt',
  coverLabel: '测',
  coverTone: 'indigo',
  deleted: false,
  deletedAt: '',
  contentHash: 'hash',
  importedAt: '2026-06-01T00:00:00.000Z',
  shelfGroups: [],
  content: '',
  chunks: [],
};
const aggregated = buildKnowledgePageItems({
  books: [book],
  highlights: [highlight('ai-h1')],
  notes: [],
  flashcards: [],
  readerHighlights: [{
    id: 'reader-h1',
    bookId: 'book-1',
    chapterIndex: 2,
    paragraphIndex: 4,
    startOffset: 0,
    endOffset: 4,
    text: '阅读器高亮',
    note: '关键批注',
    color: 'yellow',
    createdAt: '2026-06-02T00:00:00.000Z',
  }],
  readerBookmarks: [{
    id: 'bookmark-1',
    bookId: 'book-1',
    chapterIndex: 3,
    paragraphIndex: 1,
    screenPage: 4,
    label: '重要位置',
    createdAt: '2026-06-03T00:00:00.000Z',
  }],
});

assert.equal(aggregated.length, 3);
assert.ok(aggregated.every((item) => item.bookId === 'book-1'));
assert.equal(aggregated.filter((item) => matchesKnowledgeView(item, 'annotations')).length, 1);
assert.equal(aggregated.filter((item) => matchesKnowledgeView(item, 'bookmarks')).length, 1);
const [bookSummary] = buildKnowledgeBookSummaries([book], aggregated);
assert.equal(bookSummary.highlights, 2);
assert.equal(bookSummary.annotations, 1);
assert.equal(bookSummary.bookmarks, 1);
assert.equal(bookSummary.colors.yellow, 1);

const pageSource = readFileSync(new URL('./KnowledgePage.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../app/styles/layout.css', import.meta.url), 'utf8');
assert.match(pageSource, /function KnowledgeMasonryItem/u, 'knowledge cards should measure their own height for independent columns');
assert.match(pageSource, /ResizeObserver/u, 'knowledge masonry spans should update when card content changes');
assert.match(layoutSource, /\.knowledge-card-grid \{[^}]*grid-auto-rows: 1px;[^}]*grid-auto-flow: row dense;/u, 'knowledge cards should use dense masonry rows instead of shared row heights');
assert.match(pageSource, /knowledge-export-panel/u, 'knowledge exports should use a format and location panel');
assert.match(pageSource, /await save\(/u, 'knowledge exports should open the native save-location picker');

function highlight(id) {
  return {
    id,
    label: `高亮 ${id}`,
    text: `正文 ${id}`,
    targetId: `book-1:${id}`,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

function note(id) {
  return {
    id,
    title: `笔记 ${id}`,
    body: `内容 ${id}`,
    source: 'ai-reader',
    createdAt: '2026-06-01T00:00:00.000Z',
    citations: [],
  };
}

function flashcard(id) {
  return {
    id,
    front: `卡片 ${id}`,
    back: `答案 ${id}`,
    sourceLabel: `来源 ${id}`,
    sourceTargetId: `source-${id}`,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

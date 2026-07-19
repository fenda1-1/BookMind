import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-reader-interaction-model-test-${process.pid}`);
execFileSync(process.execPath, [
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
  'src/features/reader-core/readerInteractionModel.ts',
  'src/features/reader-core/readerModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildReaderAnnotationTagSuggestions,
  buildReaderReadAloudSegments,
  computeReaderPageProgress,
  createVirtualListWindow,
  formatReaderTagInput,
  getReaderHighlightColorShortcutMatch,
  groupReaderBookmarks,
  isReaderShortcutEditableTarget,
  matchesReaderShortcut,
  parseBoundedInteger,
  parseReaderTagInput,
  readerHighlightColors,
  resolveReaderProgressPercent,
  resolveReaderStoredProgressPercent,
  resolveReaderSearchChapterFilterDefault,
  shouldUseReaderSearchChapterFilter,
  toGoalMinutes,
  toReaderAnnotationExportChoice,
  toReaderSearchLimit,
  toReaderSearchScope,
} = require(join(outDir, 'features/reader-core/readerInteractionModel.js'));

const chapters = [
  { id: 'c1', title: '第一章 开始', index: 0, startLine: 0, paragraphs: ['abcd'], characterCount: 4 },
  { id: 'c2', title: '第二章 后续', index: 1, startLine: 2, paragraphs: ['efghij'], characterCount: 6 },
];
const bookmarks = [
  { id: 'b1', bookId: 'book', chapterIndex: 0, chapterId: 'c1', paragraphIndex: 0, screenPage: 0, label: 'Start', tags: ['主线'], createdAt: '2026-06-12T10:00:00.000Z' },
  { id: 'b2', bookId: 'book', chapterIndex: 1, chapterId: 'c2', paragraphIndex: 0, screenPage: 0, label: 'Next', tags: [], createdAt: '2026-06-13T10:00:00.000Z' },
  { id: 'b3', bookId: 'book', chapterIndex: 9, paragraphIndex: 0, screenPage: 0, label: 'Missing', createdAt: '' },
];
const highlights = [
  { chapterIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 2, text: 'ab', color: 'yellow', tags: ['  主线  ', '短句'] },
  { chapterIndex: 1, paragraphIndex: 0, startOffset: 0, endOffset: 2, text: 'ef', color: 'blue', tags: ['短句'] },
];

assert.deepEqual(readerHighlightColors, ['yellow', 'green', 'blue', 'pink', 'violet', 'red'], 'highlight color order must stay stable for shortcuts and swatches');
assert.deepEqual(createVirtualListWindow(['a', 'b', 'c', 'd', 'e'], 2, 1), { items: ['b', 'c', 'd'], start: 1, end: 4, before: 1, after: 1 }, 'virtual list windows should preserve before/after spacer counts');

assert.deepEqual(groupReaderBookmarks(bookmarks, 'chapter', chapters).map((group) => [group.key, group.label, group.items.map((item) => item.id)]), [
  ['chapter-0', '第一章 开始', ['b1']],
  ['chapter-1', '第二章 后续', ['b2']],
  ['chapter-9', 'Missing', ['b3']],
], 'bookmark chapter grouping should prefer chapter titles and fall back to bookmark labels');
assert.deepEqual(groupReaderBookmarks(bookmarks, 'created', chapters).map((group) => [group.key, group.items.map((item) => item.id)]), [
  ['created-2026-06-12', ['b1']],
  ['created-2026-06-13', ['b2']],
  ['created-unknown', ['b3']],
], 'bookmark created grouping should group by day and keep an unknown bucket');
assert.deepEqual(groupReaderBookmarks(bookmarks, 'tag', chapters).map((group) => [group.key, group.items.map((item) => item.id)]), [
  ['tag-主线', ['b1']],
  ['tag-untagged', ['b2', 'b3']],
], 'bookmark tag grouping should include an untagged bucket');

assert.deepEqual(parseReaderTagInput(' 主线,短句，主线,  很长的标签内容应该被截断到四十个字符以上以上以上以上以上 '), ['主线', '短句', '很长的标签内容应该被截断到四十个字符以上以上以上以上以上'], 'tag input should normalize comma variants, trim whitespace, dedupe, and cap tags');
assert.equal(formatReaderTagInput([' 主线 ', '短句', '主线', '']), '主线, 短句', 'tag output should normalize and dedupe tags');
assert.deepEqual(buildReaderAnnotationTagSuggestions(highlights, bookmarks, ['新标签,短句']).slice(0, 5), ['主线', '短句', '新标签'], 'tag suggestions should combine highlights, bookmarks, and defaults without duplicates');

assert.equal(toReaderSearchScope('annotations'), 'annotations', 'annotation search scope should pass through');
assert.equal(toReaderSearchScope('not-a-scope'), 'chapter', 'invalid search scopes should fall back to chapter');
assert.equal(shouldUseReaderSearchChapterFilter('page'), false, 'page search scope should not combine with the chapter dropdown filter');
assert.equal(shouldUseReaderSearchChapterFilter('chapter'), false, 'chapter search scope should not combine with the chapter dropdown filter');
assert.equal(shouldUseReaderSearchChapterFilter('book'), true, 'book search scope should allow the chapter dropdown filter');
assert.equal(shouldUseReaderSearchChapterFilter('all'), true, 'global search scope should allow the chapter dropdown filter');
assert.equal(shouldUseReaderSearchChapterFilter('annotations'), true, 'annotation search scope should allow the chapter dropdown filter');
assert.equal(shouldUseReaderSearchChapterFilter('bookmarks'), true, 'bookmark search scope should allow the chapter dropdown filter');
assert.equal(toReaderSearchLimit('400'), 400, 'search limits should accept the extended result presets');
assert.equal(toReaderSearchLimit('801'), 800, 'search limits should clamp to the maximum');
assert.equal(toReaderSearchLimit('3'), 5, 'search limits should clamp to the minimum');
assert.equal(toReaderSearchLimit('abc'), 20, 'invalid search limits should use the default');
assert.equal(resolveReaderSearchChapterFilterDefault('current', 2.8), 2, 'current-chapter search defaults should floor active chapter');
assert.equal(resolveReaderSearchChapterFilterDefault('all', 2), 'all', 'all-chapter search defaults should include all chapters');
assert.equal(parseBoundedInteger('8.9', 1, 0, 10), 8, 'bounded integers should floor finite values');
assert.equal(parseBoundedInteger('abc', 7, 0, 10), 7, 'bounded integers should use fallback for invalid values');

assert.equal(computeReaderPageProgress({ layoutMode: 'page', activeStreamIndex: 3, activeScreenPage: 0, pageStreamLength: 10, screenPageCount: 5 }), 40, 'page progress should prefer stream position in page layout');
assert.equal(computeReaderPageProgress({ layoutMode: 'scroll', activeStreamIndex: 9, activeScreenPage: 2, pageStreamLength: 10, screenPageCount: 5 }), 60, 'non-page progress should use screen page count');
assert.equal(resolveReaderProgressPercent('characters', { chapters, activeChapterIndex: 1, activeParagraphIndex: 0, activeStreamIndex: 0, activeScreenPage: 0, pageStreamLength: 1, screenPageCount: 1, layoutMode: 'page' }), 40, 'character progress should delegate to chapter character counts');
assert.equal(resolveReaderProgressPercent('pages', { chapters, activeChapterIndex: 0, activeParagraphIndex: 0, activeStreamIndex: 1, activeScreenPage: 0, pageStreamLength: 4, screenPageCount: 1, layoutMode: 'page' }), 50, 'page progress mode should use page progress');
assert.equal(resolveReaderProgressPercent('chapters', { chapters, activeChapterIndex: 0, activeParagraphIndex: 0, activeStreamIndex: 0, activeScreenPage: 0, pageStreamLength: 1, screenPageCount: 1, layoutMode: 'scroll' }), 50, 'chapter progress should use visible chapter position');
assert.equal(resolveReaderStoredProgressPercent({ chapters: [{ id: 'single', title: '整本书', index: 0, startLine: 0, paragraphs: ['a'.repeat(100)] }], activeChapterIndex: 0, activeParagraphIndex: 0, activeStreamIndex: 0, activeScreenPage: 0, pageStreamLength: 100, screenPageCount: 100, layoutMode: 'page' }), 1, 'stored reading progress must use page position for single-chapter books instead of chapter progress');
assert.equal(resolveReaderStoredProgressPercent({ chapters, activeChapterIndex: 0, activeParagraphIndex: 0, activeStreamIndex: 1, activeScreenPage: 0, pageStreamLength: 0, screenPageCount: 1, layoutMode: 'page' }), 0, 'stored reading progress must fall back to character progress when page totals are not ready');

const readAloudSegments = buildReaderReadAloudSegments({ id: 'r', title: '  标题  ', index: 0, startLine: 0, paragraphs: ['  第一段   内容  ', 'x'.repeat(1300)] });
assert.equal(readAloudSegments.length, 4, 'read-aloud segments should include title, normalize whitespace, and chunk long text');
assert.deepEqual(readAloudSegments.map((segment) => segment.paragraphIndex), [null, 0, 1, 1], 'read-aloud segments should keep source paragraph indexes for paragraph highlighting');
assert.deepEqual(
  buildReaderReadAloudSegments({ id: 'r', title: '标题', index: 0, startLine: 0, paragraphs: ['第一段', '第二段', '第三段'] }, 1).map((segment) => segment.text),
  ['第二段', '第三段'],
  'read-aloud segments should start from the current page paragraph when requested',
);
assert.equal(toGoalMinutes(125000), 2, 'goal minutes should floor elapsed milliseconds');
assert.equal(toGoalMinutes(-1), 0, 'invalid goal elapsed values should return zero');
assert.equal(toReaderAnnotationExportChoice('readwise'), 'readwise', 'supported annotation export formats should pass through');
assert.equal(toReaderAnnotationExportChoice('backup'), 'markdown', 'unsupported default export formats should fall back to markdown');

const shortcutEvent = { key: 'K', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true };
assert.equal(matchesReaderShortcut(shortcutEvent, 'ctrl-shift-k'), true, 'reader shortcuts should match primary modifier, shift, and key');
assert.equal(matchesReaderShortcut({ key: '/', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, 'slash'), true, 'slash shortcut should only match bare slash');
assert.equal(matchesReaderShortcut({ key: '/', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, 'slash'), false, 'slash shortcut must reject modifiers');
assert.equal(matchesReaderShortcut(shortcutEvent, 'disabled'), false, 'disabled shortcuts should never match');
assert.equal(getReaderHighlightColorShortcutMatch({ key: '2', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, { yellow: '1', green: '2', blue: 'disabled', pink: '4', violet: '5', red: '6' }), 'green', 'highlight color shortcuts should return the matching enabled color');
assert.equal(getReaderHighlightColorShortcutMatch({ key: '2', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, { yellow: '1', green: '2', blue: 'disabled', pink: '4', violet: '5', red: '6' }), null, 'highlight color shortcuts should reject modifier keys');
assert.equal(isReaderShortcutEditableTarget({ closest: (selector) => selector.includes('input') ? {} : null }), true, 'editable shortcut target detection should use closest editable selectors');
assert.equal(isReaderShortcutEditableTarget(null), false, 'missing shortcut targets are not editable');

console.log('Verified reader interaction model helpers.');

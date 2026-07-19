import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-task-performance-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskPerformanceModel.ts',
  'src/features/task-center/taskFilters.ts',
  'src/features/task-center/taskPrivacy.ts',
  'src/features/task-center/taskVirtualWindow.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { getLargeTaskQueueView, getLargeTaskLogView } = require(join(outDir, 'features', 'task-center', 'taskPerformanceModel.js'));

const tasks = Array.from({ length: 1000 }, (_, index) => task(index));
const taskView = getLargeTaskQueueView(tasks, {
  filters: { bookQuery: 'Book 42', status: 'failed', errorCode: 'file_missing', timeRange: 'all' },
  page: 0,
  pageSize: 50,
  now: Date.parse('2026-06-09T12:00:00.000Z'),
});
assert.equal(taskView.filteredCount, 2, '1000-task filtering must combine book, status, and error-code constraints');
assert.equal(taskView.rows.length, 2, 'queue view must page large filtered sets down to renderable rows');
assert.equal(taskView.pageCount, 1, 'page count must reflect filtered rows, not raw task volume');
assert.equal(taskView.filterOptions.books.length, 300, 'filter options must remain usable with hundreds of books');

const secondPage = getLargeTaskQueueView(tasks, { filters: { status: 'all', timeRange: 'all' }, page: 1, pageSize: 50 });
assert.equal(secondPage.rows.length, 50, '1000-task unfiltered queue should render one page at a time');
assert.equal(secondPage.pageCount, 20, '1000 tasks at 50 rows per page should produce 20 pages');

const logs = Array.from({ length: 10000 }, (_, index) => log(index));
const logView = getLargeTaskLogView(logs, {
  levelFilter: 'error',
  query: 'needle-9001',
  privacyMode: false,
  scrollTop: 0,
  viewportHeight: 320,
  rowHeight: 38,
  overscan: 6,
});
assert.equal(logView.filteredCount, 1, 'log search must scan all 10000 logs, not only the recent tail');
assert.equal(logView.rows[0].id, 'log-9001', 'log search must find old matching entries outside the visible tail');
assert.ok(logView.window.endIndex - logView.window.startIndex <= 20, 'log rendering must stay windowed after filtering');

const largeLogView = getLargeTaskLogView(logs, {
  levelFilter: 'all',
  query: '',
  privacyMode: false,
  scrollTop: 190000,
  viewportHeight: 320,
  rowHeight: 38,
  overscan: 6,
});
assert.equal(largeLogView.filteredCount, 10000, 'empty log query should keep all logs available for scrolling');
assert.ok(largeLogView.rows.length <= 22, '10000-log rendering must stay bounded by viewport plus overscan');
assert.ok(largeLogView.window.beforeHeight > 0 && largeLogView.window.afterHeight > 0, 'middle log windows need spacer heights for stable scrolling');

function task(index) {
  const bookIndex = index % 300;
  const failedNeedle = index === 42 || index === 342;
  return {
    id: `task-${index}`,
    kind: index % 3 === 0 ? 'parse-and-index' : 'import-book',
    name: `Task ${index}`,
    status: failedNeedle ? 'failed' : index % 5 === 0 ? 'running' : 'succeeded',
    progress: 0,
    stage: 'queued',
    stageLabel: '排队中',
    tone: 'amber',
    message: '',
    bookId: `book-${bookIndex}`,
    bookTitle: `Book ${bookIndex}`,
    fileName: `book-${bookIndex}.txt`,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    startedAt: '',
    finishedAt: '',
    durationMs: 0,
    attempt: 0,
    maxAttempts: 3,
    errorCode: failedNeedle ? 'file_missing' : '',
    errorMessage: '',
    error: { code: failedNeedle ? 'file_missing' : '', detail: {}, message: '', retryable: true, stage: 'queued' },
    logCount: 0,
    outputSummary: {
      chapters: 0,
      paragraphs: 0,
      chunks: 0,
      ftsRows: 0,
      bytesRead: 0,
      warnings: [],
      chunksPerSecond: 0,
      mbPerSecond: 0,
      stageDurationsMs: { readFile: 0, parseChapters: 0, buildChunks: 0, writeChunks: 0, writeFts: 0, verify: 0 },
    },
  };
}

function log(index) {
  return {
    id: `log-${index}`,
    taskId: `task-${index % 1000}`,
    bookId: `book-${index % 300}`,
    level: index === 9001 ? 'error' : index % 19 === 0 ? 'error' : 'info',
    stage: index % 2 === 0 ? 'write-fts' : 'parse-chapters',
    message: index === 9001 ? 'needle-9001 deep log entry' : `log message ${index}`,
    detail: {},
    createdAt: `2026-06-09T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
  };
}

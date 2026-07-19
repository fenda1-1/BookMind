import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-filters-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskFilters.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { filterTaskStatuses, getTaskQueueFilterOptions, visibleTaskStatuses } = await import(pathToFileURL(join(outDir, 'features', 'task-center', 'taskFilters.js')).href);

const now = Date.parse('2026-06-09T12:00:00.000Z');
const tasks = [
  task('alpha-import-missing', {
    bookId: 'book-alpha',
    bookTitle: 'Alpha Novel',
    errorCode: 'file_missing',
    kind: 'import-book',
    status: 'failed',
    updatedAt: '2026-06-09T08:00:00.000Z',
  }),
  task('alpha-parse-old', {
    bookId: 'book-alpha',
    bookTitle: 'Alpha Novel',
    errorCode: 'fts_write_failed',
    kind: 'parse-and-index',
    status: 'failed',
    updatedAt: '2026-05-20T08:00:00.000Z',
  }),
  task('beta-running', {
    bookId: 'book-beta',
    bookTitle: 'Beta Handbook',
    errorCode: '',
    kind: 'rebuild-index',
    status: 'running',
    updatedAt: '2026-06-09T10:00:00.000Z',
  }),
  task('gamma-cancelled', {
    bookId: 'book-gamma',
    bookTitle: 'Gamma Notes',
    errorCode: 'cancelled_by_user',
    kind: 'cleanup-index',
    status: 'cancelled',
    updatedAt: '2026-06-02T08:00:00.000Z',
  }),
];

assert.deepEqual(
  filterTaskStatuses(tasks, {
    bookQuery: 'Alpha',
    errorCode: 'file_missing',
    kind: 'import-book',
    status: 'failed',
    timeRange: 'last-24h',
  }, now).map((item) => item.id),
  ['alpha-import-missing'],
  'task filters must combine book, type, status, time, and error code constraints',
);

assert.deepEqual(
  filterTaskStatuses(tasks, { bookQuery: 'book-beta', kind: 'rebuild-index', status: 'running', timeRange: 'today' }, now).map((item) => item.id),
  ['beta-running'],
  'book filtering must match book ids as well as titles',
);

assert.deepEqual(
  filterTaskStatuses(tasks, { status: 'failed', timeRange: 'older-than-7d' }, now).map((item) => item.id),
  ['alpha-parse-old'],
  'time filtering must support older task investigation',
);

assert.deepEqual(
  getTaskQueueFilterOptions(tasks),
  {
    books: [
      { id: 'book-alpha', label: 'Alpha Novel' },
      { id: 'book-beta', label: 'Beta Handbook' },
      { id: 'book-gamma', label: 'Gamma Notes' },
    ],
    errorCodes: ['cancelled_by_user', 'file_missing', 'fts_write_failed'],
    kinds: ['cleanup-index', 'import-book', 'parse-and-index', 'rebuild-index'],
    statuses: ['cancelled', 'failed', 'running'],
  },
  'task queue filter options must be derived from current task rows',
);

assert.deepEqual(
  visibleTaskStatuses([
    ...tasks,
    task('embedding-placeholder', { kind: 'embedding-index', status: 'skipped', message: '语义向量索引尚未接入，已跳过占位任务' }),
    task('summary-placeholder', { kind: 'ai-summary', status: 'skipped', message: 'AI 摘要尚未接入，已跳过占位任务' }),
    task('future-vector-success', { kind: 'embedding-index', status: 'succeeded', message: '向量索引构建完成' }),
  ]).map((item) => item.id),
  [...tasks.map((item) => item.id), 'future-vector-success'],
  'task center visibility must hide only unimplemented skipped placeholders while preserving future real vector tasks',
);

function task(id, overrides) {
  return {
    id,
    kind: 'parse-and-index',
    name: id,
    status: 'queued',
    progress: 0,
    stage: 'queued',
    stageLabel: '排队中',
    tone: 'amber',
    message: '',
    bookId: '',
    bookTitle: '',
    fileName: `${id}.txt`,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    startedAt: '',
    finishedAt: '',
    durationMs: 0,
    attempt: 0,
    maxAttempts: 3,
    errorCode: '',
    errorMessage: '',
    error: { code: '', detail: {}, message: '', retryable: true, stage: 'queued' },
    logCount: 0,
    outputSummary: { chapters: 0, paragraphs: 0, chunks: 0, ftsRows: 0, bytesRead: 0, warnings: [] },
    ...overrides,
  };
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-batch-selection-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskBatchSelection.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { canRestoreArchivedTask, getSelectedTaskBatchTargets } = await import(pathToFileURL(join(outDir, 'features', 'task-center', 'taskBatchSelection.js')).href);

const tasks = [
  task('queued-alpha', { bookId: 'book-alpha', status: 'queued' }),
  task('running-beta', { bookId: 'book-beta', status: 'running' }),
  task('failed-alpha', { bookId: 'book-alpha', errorCode: 'file_missing', status: 'failed' }),
  task('failed-gamma-exhausted', { attempt: 3, bookId: 'book-gamma', maxAttempts: 3, status: 'failed' }),
  task('done-delta', { bookId: 'book-delta', status: 'succeeded' }),
];

assert.deepEqual(
  getSelectedTaskBatchTargets(tasks, new Set(['queued-alpha', 'failed-alpha', 'failed-gamma-exhausted', 'done-delta'])),
  {
    cancellableTaskIds: ['queued-alpha'],
    rebuildBookIds: ['book-alpha', 'book-delta', 'book-gamma'],
    retryableTaskIds: ['failed-alpha'],
    selectedCount: 4,
  },
  'selected batch targets must separate retryable failures, cancellable queued tasks, and unique books for rebuild',
);

assert.deepEqual(
  getSelectedTaskBatchTargets(tasks, new Set()),
  { cancellableTaskIds: [], rebuildBookIds: [], retryableTaskIds: [], selectedCount: 0 },
  'empty selection must disable selected batch targets',
);

const largeTaskList = Array.from({ length: 5000 }, (_, index) => task(`large-${index}`, { bookId: `book-${index}`, status: 'queued' }));
const sparseSelection = new Set(['large-4999']);
const sparseStartedAt = performance.now();
assert.deepEqual(
  getSelectedTaskBatchTargets(largeTaskList, sparseSelection),
  {
    cancellableTaskIds: ['large-4999'],
    rebuildBookIds: ['book-4999'],
    retryableTaskIds: [],
    selectedCount: 1,
  },
  'sparse selections in a large task queue must resolve only selected targets',
);
assert.ok(
  performance.now() - sparseStartedAt < 20,
  'sparse batch target calculation should stay lightweight for large task queues',
);

const indexedSelectionTask = task('indexed-selected', { bookId: 'book-indexed', status: 'queued' });
const tasksWithExpensiveFilter = Object.assign([indexedSelectionTask], {
  filter() {
    throw new Error('full task scan should not run when a task lookup map is available');
  },
});
assert.deepEqual(
  getSelectedTaskBatchTargets(
    tasksWithExpensiveFilter,
    new Set(['indexed-selected']),
    new Map([[indexedSelectionTask.id, indexedSelectionTask]]),
  ),
  {
    cancellableTaskIds: ['indexed-selected'],
    rebuildBookIds: ['book-indexed'],
    retryableTaskIds: [],
    selectedCount: 1,
  },
  'batch target calculation should use the task lookup map to avoid scanning the full queue',
);

assert.equal(
  canRestoreArchivedTask(task('archived-rebuild', { kind: 'rebuild-index', status: 'archived' })),
  true,
  'archived index tasks should expose restore because the queue runner can consume them',
);

assert.equal(
  canRestoreArchivedTask(task('archived-import', { kind: 'import-book', status: 'archived' })),
  false,
  'archived import tasks should not restore into a queued state without a runner',
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

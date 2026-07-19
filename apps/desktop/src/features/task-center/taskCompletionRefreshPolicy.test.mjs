import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-completion-refresh-policy-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskCompletionRefreshPolicy.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { getTaskCompletionRefreshPlan, shouldDispatchLibraryRefreshAfterTaskCompletion, shouldRefreshSearchResultsAfterTaskRefresh, shouldResetAiIndexStateAfterTaskRefresh } = await import(pathToFileURL(join(outDir, 'features', 'task-center', 'taskCompletionRefreshPolicy.js')).href);

function task(overrides) {
  return {
    id: 'task-1',
    kind: 'parse-and-index',
    name: 'Parse and index',
    status: 'running',
    progress: 50,
    stage: 'write-fts',
    stageLabel: '写入 FTS',
    tone: 'indigo',
    message: '',
    bookId: 'book-1',
    bookTitle: 'Book 1',
    fileName: 'book.txt',
    createdAt: '',
    updatedAt: '',
    startedAt: '',
    finishedAt: '',
    durationMs: 0,
    attempt: 1,
    maxAttempts: 3,
    errorCode: '',
    errorMessage: '',
    error: { code: '', message: '', stage: 'queued', retryable: true, detail: {} },
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
    ...overrides,
  };
}

const completedPlan = getTaskCompletionRefreshPlan(
  [task({ id: 'task-1', bookId: 'book-1', status: 'running' }), task({ id: 'task-2', bookId: 'book-1', status: 'cancelling' })],
  [task({ id: 'task-1', bookId: 'book-1', status: 'succeeded' }), task({ id: 'task-2', bookId: 'book-1', status: 'cancelled' })],
);
assert.equal(completedPlan.shouldRefresh, true, 'running/cancelling tasks that reach terminal states must trigger a cross-page refresh');
assert.equal(completedPlan.reason, 'task-completed', 'non-failed terminal completions should use the task-completed reason');
assert.deepEqual(completedPlan.bookIds, ['book-1'], 'refresh targets should dedupe affected books');
assert.deepEqual(completedPlan.taskIds, ['task-1', 'task-2'], 'refresh targets should expose completed task ids');

const failedPlan = getTaskCompletionRefreshPlan(
  [task({ id: 'task-3', bookId: 'book-2', status: 'running' })],
  [task({ id: 'task-3', bookId: 'book-2', status: 'failed' })],
);
assert.equal(failedPlan.reason, 'task-failed', 'any failed completion should preserve the failed-task refresh reason');

const queuedPlan = getTaskCompletionRefreshPlan(
  [task({ id: 'task-4', bookId: 'book-3', status: 'queued' })],
  [task({ id: 'task-4', bookId: 'book-3', status: 'succeeded' })],
);
assert.equal(queuedPlan.shouldRefresh, false, 'queued rows that appear terminal without running first should not duplicate completion refreshes');
assert.equal(shouldDispatchLibraryRefreshAfterTaskCompletion(completedPlan, true), true, 'enabled completion refresh setting must allow library refresh events');
assert.equal(shouldDispatchLibraryRefreshAfterTaskCompletion(completedPlan, false), false, 'disabled completion refresh setting must suppress library refresh events');
assert.equal(shouldDispatchLibraryRefreshAfterTaskCompletion(queuedPlan, true), false, 'library refresh events must not fire when no running task completed');

const book = { id: 'book-1', chunks: [] };
const readyDiagnostics = {
  summary: { ftsAvailable: true, indexedChunkCount: 12 },
  books: [{ bookId: 'book-1', status: 'ready', chunkCount: 12, ftsRowCount: 12, staleReason: '' }],
};
assert.equal(
  shouldResetAiIndexStateAfterTaskRefresh(book, 'no-index', { errorKind: 'no-index', indexStatus: 'missing' }, readyDiagnostics),
  true,
  'AI no-index diagnostics should reset when the refreshed manifest becomes ready',
);
assert.equal(
  shouldResetAiIndexStateAfterTaskRefresh(book, 'loading', { errorKind: 'no-index', indexStatus: 'missing' }, readyDiagnostics),
  false,
  'active AI requests must not be reset by a background task refresh',
);
assert.equal(
  shouldResetAiIndexStateAfterTaskRefresh(book, 'no-index', { errorKind: 'stale-index', indexStatus: 'stale' }, { ...readyDiagnostics, books: [{ bookId: 'book-1', status: 'stale', chunkCount: 12, ftsRowCount: 12, staleReason: 'rules changed' }] }),
  false,
  'AI diagnostics should stay visible when the refreshed manifest is still stale',
);

assert.equal(shouldRefreshSearchResultsAfterTaskRefresh('雨夜'), true, 'active search queries should rerun after a task completion refresh');
assert.equal(shouldRefreshSearchResultsAfterTaskRefresh('   '), false, 'empty search input should not trigger redundant search refresh work');

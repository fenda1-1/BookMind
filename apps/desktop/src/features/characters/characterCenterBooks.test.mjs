import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-center-books-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterCenterBooks.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterCenterBookSummary, buildCharacterCenterBookSummaries } = require(join(outDir, 'features', 'characters', 'characterCenterBooks.js'));

const baseBook = {
  id: 'book-1',
  title: 'Long Novel',
  displayTitle: 'Long Novel Display',
  author: 'Author',
  format: 'txt',
  status: 'imported',
  progress: 42,
  fileName: 'long-novel.txt',
  filePath: 'C:/books/long-novel.txt',
  coverLabel: 'L',
  coverTone: 'sage',
  deleted: false,
  deletedAt: '',
  contentHash: 'hash-book',
  importedAt: '2026-06-10T00:00:00.000Z',
  content: '',
  chunks: [{ id: 'chunk-local', bookId: 'book-1', bookTitle: 'Long Novel', chapter: '1', ordinal: 0, text: 'hello' }],
};

const readyDiagnostics = diagnosticsWithManifest({
  status: 'ready',
  chunkCount: 12,
  ftsRowCount: 12,
  builtAt: '2026-06-10T01:00:00.000Z',
});

const readySummary = buildCharacterCenterBookSummary(baseBook, readyDiagnostics);
assert.equal(readySummary.id, 'book-1');
assert.equal(readySummary.title, 'Long Novel');
assert.equal(readySummary.displayTitle, 'Long Novel Display');
assert.equal(readySummary.textIndexStatus, 'ready');
assert.equal(readySummary.textIndexReady, true);
assert.equal(readySummary.textIndexChunkCount, 12);
assert.equal(readySummary.textIndexFtsRows, 12);
assert.equal(readySummary.characterIndexStatus, 'missing');
assert.equal(readySummary.characterCount, 0);
assert.equal(readySummary.relationCount, 0);
assert.equal(readySummary.evidenceCount, 0);
assert.equal(readySummary.lastCharacterBuiltAt, '');
assert.equal(readySummary.staleReason, '');
assert.equal(readySummary.lastError, '');
assert.equal(readySummary.lastTaskId, '');
assert.equal(readySummary.errorCode, '');
assert.equal(readySummary.errorStage, '');
assert.equal(readySummary.recentLogEntry, '');
assert.equal(Object.prototype.hasOwnProperty.call(readySummary, 'content'), false);

const queuedCharacterSummary = buildCharacterCenterBookSummary(baseBook, readyDiagnostics, [
  characterTask({ status: 'queued', id: 'task-character-queued', updatedAt: '1781100001000' }),
]);
assert.equal(queuedCharacterSummary.characterIndexStatus, 'queued');
assert.equal(queuedCharacterSummary.lastTaskId, 'task-character-queued');

const runningCharacterSummary = buildCharacterCenterBookSummary(baseBook, readyDiagnostics, [
  characterTask({ status: 'running', id: 'task-character-running', updatedAt: '1781100002000' }),
]);
assert.equal(runningCharacterSummary.characterIndexStatus, 'building');
assert.equal(runningCharacterSummary.lastTaskId, 'task-character-running');

const succeededCharacterSummary = buildCharacterCenterBookSummary(baseBook, readyDiagnostics, [
  characterTask({ status: 'succeeded', id: 'task-character-succeeded', updatedAt: '1781100002500' }),
]);
assert.equal(succeededCharacterSummary.characterIndexStatus, 'ready', 'succeeded character extraction tasks must not keep the character center in queued/building state');
assert.equal(succeededCharacterSummary.lastTaskId, 'task-character-succeeded');

const failedCharacterSummary = buildCharacterCenterBookSummary(baseBook, readyDiagnostics, [
  characterTask({
    status: 'failed',
    id: 'task-character-failed',
    updatedAt: '1781100003000',
    errorCode: 'character_index_missing_text_index',
    errorMessage: 'missing text index',
    stage: 'verify',
  }),
]);
assert.equal(failedCharacterSummary.characterIndexStatus, 'failed');
assert.equal(failedCharacterSummary.lastTaskId, 'task-character-failed');
assert.equal(failedCharacterSummary.lastError, 'missing text index');
assert.equal(failedCharacterSummary.errorCode, 'character_index_missing_text_index');
assert.equal(failedCharacterSummary.errorStage, 'verify');

const noFtsSummary = buildCharacterCenterBookSummary(baseBook, diagnosticsWithManifest({
  status: 'ready',
  chunkCount: 12,
  ftsRowCount: 0,
}));
assert.equal(noFtsSummary.textIndexStatus, 'ready');
assert.equal(noFtsSummary.textIndexReady, false);
assert.equal(noFtsSummary.textIndexFtsRows, 0);
assert.equal(noFtsSummary.characterIndexStatus, 'blocked-by-text-index');

const staleSummary = buildCharacterCenterBookSummary(baseBook, diagnosticsWithManifest({
  status: 'stale',
  chunkCount: 12,
  ftsRowCount: 12,
  staleReason: 'chapter rules changed',
}));
assert.equal(staleSummary.textIndexStatus, 'stale');
assert.equal(staleSummary.textIndexReady, false);
assert.equal(staleSummary.characterIndexStatus, 'blocked-by-text-index');
assert.equal(staleSummary.staleReason, 'chapter rules changed');

const failedSummary = buildCharacterCenterBookSummary(baseBook, diagnosticsWithManifest({
  status: 'failed',
  chunkCount: 0,
  ftsRowCount: 0,
  lastError: 'read failed',
}));
assert.equal(failedSummary.textIndexStatus, 'failed');
assert.equal(failedSummary.textIndexReady, false);
assert.equal(failedSummary.characterIndexStatus, 'blocked-by-text-index');
assert.equal(failedSummary.lastError, 'read failed');

const localChunkSummary = buildCharacterCenterBookSummary(baseBook, null);
assert.equal(localChunkSummary.textIndexStatus, 'ready');
assert.equal(localChunkSummary.textIndexReady, true);
assert.equal(localChunkSummary.textIndexChunkCount, 1);
assert.equal(localChunkSummary.characterIndexStatus, 'missing');

const emptySummary = buildCharacterCenterBookSummary({ ...baseBook, chunks: [] }, null);
assert.equal(emptySummary.textIndexStatus, 'missing');
assert.equal(emptySummary.textIndexReady, false);
assert.equal(emptySummary.characterIndexStatus, 'blocked-by-text-index');

const summaries = buildCharacterCenterBookSummaries([
  baseBook,
  { ...baseBook, id: 'book-trash', deleted: true },
], readyDiagnostics);
assert.equal(summaries.length, 1);
assert.equal(summaries[0].id, 'book-1');

function characterTask(overrides) {
  return {
    id: overrides.id ?? 'task-character',
    kind: 'character-extraction',
    name: 'character-extraction · Long Novel',
    status: overrides.status ?? 'queued',
    progress: 0,
    stage: overrides.stage ?? 'queued',
    stageLabel: '排队中',
    tone: 'amber',
    message: '',
    bookId: overrides.bookId ?? 'book-1',
    bookTitle: 'Long Novel',
    fileName: 'long-novel.txt',
    createdAt: overrides.createdAt ?? '',
    updatedAt: overrides.updatedAt ?? '',
    startedAt: overrides.startedAt ?? '',
    finishedAt: overrides.finishedAt ?? '',
    durationMs: 0,
    attempt: 0,
    maxAttempts: 3,
    errorCode: overrides.errorCode ?? '',
    errorMessage: overrides.errorMessage ?? '',
    logCount: 0,
    dagId: '',
    dependsOn: [],
    blockedBy: [],
    outputSummary: {
      chapters: 0,
      paragraphs: 0,
      chunks: 0,
      ftsRows: 0,
      bytesRead: 0,
      warnings: [],
      chunksPerSecond: 0,
      mbPerSecond: 0,
      stageDurationsMs: {
        readFile: 0,
        parseChapters: 0,
        buildChunks: 0,
        writeChunks: 0,
        writeFts: 0,
        verify: 0,
      },
    },
    error: {
      code: overrides.errorCode ?? '',
      message: overrides.errorMessage ?? '',
      stage: overrides.stage ?? 'queued',
      retryable: false,
      detail: {},
    },
  };
}

function diagnosticsWithManifest(overrides) {
  return {
    summary: {
      queuedCount: 0,
      runningCount: 0,
      succeededCount: 0,
      failedCount: 0,
      pausedCount: 0,
      cancelledCount: 0,
      staleBookCount: overrides.status === 'stale' ? 1 : 0,
      indexedChunkCount: overrides.chunkCount ?? 0,
      indexedBookCount: overrides.status === 'ready' ? 1 : 0,
      ftsAvailable: true,
      ftsDatabasePath: '',
      ftsDatabaseSizeBytes: 0,
      ftsDatabaseModifiedAt: '',
      recentError: '',
      recentErrors: [],
    },
    books: [{
      bookId: 'book-1',
      bookTitle: 'Long Novel',
      filePath: 'C:/books/long-novel.txt',
      contentHash: 'hash-book',
      indexVersion: 1,
      chunkStrategyVersion: 1,
      chapterRuleVersion: 1,
      ftsSchemaVersion: 1,
      status: overrides.status ?? 'missing',
      builtAt: overrides.builtAt ?? '',
      staleReason: overrides.staleReason ?? '',
      chapterCount: 1,
      paragraphCount: 10,
      chunkCount: overrides.chunkCount ?? 0,
      ftsRowCount: overrides.ftsRowCount ?? 0,
      bytesIndexed: 123,
      firstChunkPreview: '',
      lastError: overrides.lastError ?? '',
    }],
  };
}

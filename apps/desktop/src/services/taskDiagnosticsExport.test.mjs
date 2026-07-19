import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-task-diagnostics-export-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/taskDiagnosticsExport.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { buildTaskDetailDiagnosticJson, buildTaskDiagnosticsExport, redactDiagnosticPaths } = await import(pathToFileURL(join(outDir, 'taskDiagnosticsExport.js')).href);

const diagnostics = {
  summary: {
    ftsDatabasePath: 'C:\\Users\\alice\\AppData\\Roaming\\BookMind\\fts.sqlite',
    indexedChunkCount: 3,
  },
  books: [{
    bookId: 'book-1',
    bookTitle: 'Redaction',
    filePath: 'E:\\private\\library\\secret-book.txt',
    fileName: 'secret-book.txt',
    contentHash: 'hash-book-1',
    ftsRowCount: 3,
  }],
};
const tasks = [{
  id: 'task-1',
  fileName: 'secret-book.txt',
  filePath: '/Users/alice/private/library/secret-book.txt',
  status: 'failed',
  stage: 'read-file',
  errorCode: 'file_missing',
  errorMessage: '无法读取书籍 E:\\private\\library\\secret-book.txt',
  error: {
    code: 'file_missing',
    message: '无法读取书籍 E:\\private\\library\\secret-book.txt',
    retryable: true,
    stage: 'read-file',
    detail: {
      inputPath: 'E:\\private\\library\\secret-book.txt',
    },
  },
  message: '缓存路径 /Users/alice/private/library/cache.json 不可用',
  contentHash: 'task-content-hash',
  outputSummary: { chunks: 3 },
}];
const logs = [
  {
    id: 'log-1',
    taskId: 'task-1',
    level: 'error',
    stage: 'read-file',
    message: '无法读取 D:\\raw\\source\\secret-book.txt',
    detail: {
      inputPath: 'D:\\raw\\source\\secret-book.txt',
      nested: { cachePath: '/tmp/bookmind/cache/chunk-store.json' },
    },
  },
  {
    id: 'log-other',
    taskId: 'task-other',
    level: 'error',
    stage: 'write-fts',
    message: 'unrelated task failure',
    detail: {},
  },
];

const exportPayload = buildTaskDiagnosticsExport({ diagnostics, tasks, logs, createdAt: '2026-06-08T00:00:00.000Z' });
const serialized = JSON.stringify(exportPayload);

assert.doesNotMatch(serialized, /Users\\alice|E:\\private|\/Users\/alice|D:\\raw|\/tmp\/bookmind/);
assert.match(serialized, /secret-book\.txt/);
assert.match(serialized, /\[path:secret-book\.txt:fnv1a-/);
assert.match(serialized, /hash-book-1/);
assert.match(serialized, /task-content-hash/);
assert.match(serialized, /pathHash/);
assert.equal(exportPayload.redaction.absolutePaths, 'basename-and-hash');

const redacted = redactDiagnosticPaths({ path: 'C:\\Users\\alice\\secret.txt', ordinary: 'not a path' });
assert.deepEqual(Object.keys(redacted.path).sort(), ['fileName', 'pathHash']);
assert.equal(redacted.path.fileName, 'secret.txt');
assert.equal(redacted.ordinary, 'not a path');

const copiedPayload = buildTaskDetailDiagnosticJson({
  task: tasks[0],
  logs,
  exportedAt: '2026-06-08T00:00:00.000Z',
});
const copiedSerialized = JSON.stringify(copiedPayload);
assert.equal(copiedPayload.schema, 'bookmind.task-detail-diagnostic.v1');
assert.equal(copiedPayload.task.status, 'failed');
assert.equal(copiedPayload.task.errorCode, 'file_missing');
assert.equal(copiedPayload.task.error.code, 'file_missing');
assert.equal(copiedPayload.task.error.retryable, true);
assert.equal(copiedPayload.task.error.stage, 'read-file');
assert.equal(copiedPayload.recentLogs.length, 1);
assert.equal(copiedPayload.recentLogs[0].level, 'error');
assert.equal(copiedPayload.recentLogs[0].stage, 'read-file');
assert.match(copiedPayload.recentLogs[0].message, /\[path:secret-book\.txt:fnv1a-/);
assert.doesNotMatch(copiedSerialized, /unrelated task failure/);
assert.doesNotMatch(copiedSerialized, /Users\\alice|\/Users\/alice|D:\\raw|\/tmp\/bookmind/);
assert.match(copiedSerialized, /pathHash/);
assert.match(copiedSerialized, /\[path:secret-book\.txt:fnv1a-/);

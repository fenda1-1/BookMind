import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-log-console-actions-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskLogExport.ts',
  'src/features/task-center/taskPrivacy.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  copyVisibleTaskLogs,
  formatTaskLogsJsonl,
  formatTaskLogsMarkdown,
} = require(join(outDir, 'features', 'task-center', 'taskLogExport.js'));

const logs = [
  {
    id: 'log-001',
    taskId: 'task-001',
    bookId: 'book-001',
    level: 'info',
    stage: 'parse-chapters',
    message: '解析章节完成 | source E:\\private\\library\\secret-book.txt',
    detail: { index: 1 },
    createdAt: '2026-06-08T11:00:00.000Z',
  },
  {
    id: 'log-002',
    taskId: 'task-001',
    bookId: 'book-001',
    level: 'error',
    stage: 'write-fts',
    message: 'FTS 写入失败\n请查看 /Users/alice/private/chunk-store.json',
    detail: { index: 2 },
    createdAt: '2026-06-08T11:01:00.000Z',
  },
];

const writes = [];
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
  clipboard: {
    writeText: async (payload) => {
      writes.push(payload);
    },
  },
  },
});

const exportedAt = '2026-06-08T12:00:00.000Z';
const markdown = formatTaskLogsMarkdown(logs, true, exportedAt);
assert.match(markdown, /^# BookMind Task Logs/);
assert.match(markdown, /\| Time \| Level \| Stage \| Book \| Message \|/);
assert.match(markdown, /secret-book\.txt/);
assert.match(markdown, /chunk-store\.json/);
assert.doesNotMatch(markdown, /E:\\private\\library/);
assert.doesNotMatch(markdown, /\/Users\/alice\/private/);
assert.match(markdown, /解析章节完成 \\| source secret-book\.txt/, 'Markdown export must escape table separators inside log messages');
assert.match(markdown, /FTS 写入失败 请查看 chunk-store\.json/, 'Markdown export must keep multi-line log messages in one table row');

const jsonl = formatTaskLogsJsonl(logs, true);
const exportedRows = jsonl.split('\n').map((line) => JSON.parse(line));
assert.equal(exportedRows.length, 2);
assert.equal(exportedRows[0].message, '解析章节完成 | source secret-book.txt');
assert.equal(exportedRows[1].message, 'FTS 写入失败\n请查看 chunk-store.json');

copyVisibleTaskLogs(logs, true, exportedAt);
assert.equal(writes.length, 1, 'copyVisibleTaskLogs must write one Markdown payload to the clipboard');
assert.equal(writes[0], markdown);

const taskLogConsoleSource = readFileSync('src/features/task-center/TaskLogConsole.tsx', 'utf8');
assert.match(taskLogConsoleSource, /from '\.\/taskLogExport'/, 'TaskLogConsole must use the tested task log export helpers');
for (const scope of ['task', 'completed', 'failed', 'all']) {
  assert.match(
    taskLogConsoleSource,
    new RegExp(`onClearLogs\\('${scope}'\\)`),
    `TaskLogConsole must keep a clear button wired to the ${scope} log scope`,
  );
}

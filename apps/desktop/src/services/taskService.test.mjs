import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-service-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/taskService.ts',
  'src/services/appDomainEvents.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const compiledTaskServicePath = join(outDir, 'services', 'taskService.js');
writeFileSync(compiledTaskServicePath, readFileSync(compiledTaskServicePath, 'utf8').replace("'./appDomainEvents'", "'./appDomainEvents.js'"));
const { dispatchTasksCompleted, getIdleQueuedTaskAutoRunPlan, getRunTasksUpdatePlan, getRunningToTerminalTasks, getStartupTaskResumePlan, getTaskStageLabel, mergeTaskProgressEventStatus, mergeTaskStatusRows, normalizeIndexDiagnostics, normalizeSidecarHealthForIndexDiagnostics, normalizeTaskProgressEvent, normalizeTaskStatus } = await import(pathToFileURL(compiledTaskServicePath).href);
const taskServiceSource = readFileSync(join(root, 'src', 'services', 'taskService.ts'), 'utf8');
const appTaskActionsSource = readFileSync(join(root, 'src', 'app', 'appTaskActions.ts'), 'utf8');
const appTaskCenterSource = readFileSync(join(root, 'src', 'app', 'useTaskCenter.ts'), 'utf8');
const taskCenterStateSource = readFileSync(join(root, 'src', 'features', 'task-center', 'useTaskCenterState.ts'), 'utf8');

assert.deepEqual(
  [
    ['read-file', getTaskStageLabel('read-file')],
    ['parse-chapters', getTaskStageLabel('parse-chapters')],
    ['build-chunks', getTaskStageLabel('build-chunks')],
    ['write-chunks', getTaskStageLabel('write-chunks')],
    ['write-fts', getTaskStageLabel('write-fts')],
    ['verify', getTaskStageLabel('verify')],
    ['done', getTaskStageLabel('done')],
  ],
  [
    ['read-file', '读取文件'],
    ['parse-chapters', '解析章节'],
    ['build-chunks', '生成 chunks'],
    ['write-chunks', '写入 chunk store'],
    ['write-fts', '写入 FTS'],
    ['verify', '校验索引'],
    ['done', '保存 metadata'],
  ],
  'task service must expose every user-facing indexing stage label',
);

function task(id, progress, status = 'running') {
  return {
    id,
    kind: 'parse-and-index',
    name: `Task ${id}`,
    status,
    progress,
    stage: 'write-fts',
    stageLabel: '写入 FTS',
    tone: 'indigo',
    message: `progress ${progress}`,
    bookId: `book-${id}`,
    bookTitle: `Book ${id}`,
    fileName: `${id}.txt`,
    createdAt: '1',
    updatedAt: String(progress),
    startedAt: '1',
    finishedAt: '',
    durationMs: progress,
    attempt: 0,
    maxAttempts: 3,
    errorCode: '',
    errorMessage: '',
    error: { code: '', message: '', stage: 'queued', retryable: true, detail: {} },
    dagId: '',
    dependsOn: [],
    blockedBy: [],
    logCount: 0,
    outputSummary: { chapters: 0, paragraphs: 0, chunks: progress, ftsRows: progress, bytesRead: progress, warnings: [] },
  };
}

const previousA = task('a', 10);
const previousB = task('b', 20);
const previous = [previousA, previousB];

const nextUnchangedA = task('a', 10);
const nextChangedB = task('b', 25);
const nextC = task('c', 0, 'queued');
const merged = mergeTaskStatusRows(previous, [nextUnchangedA, nextChangedB, nextC]);

assert.strictEqual(merged[0], previousA, 'unchanged task row must keep object identity');
assert.notStrictEqual(merged[1], previousB, 'changed task row must be replaced');
assert.deepEqual(merged[1], nextChangedB, 'changed task row must use fresh backend data');
assert.strictEqual(merged[2], nextC, 'new task row must be appended from fresh backend data');

const eventMerged = mergeTaskProgressEventStatus(previous, task('b', 35));
assert.deepEqual(
  eventMerged.map((item) => item.id),
  ['a', 'b'],
  'single task progress events must update one row without dropping the rest of the task list',
);
assert.equal(eventMerged[1].progress, 35, 'single task progress events must replace the changed task row');

const newerStreamedProgress = task('race', 40, 'running');
newerStreamedProgress.updatedAt = '4000';
const olderInvokeSnapshot = task('race', 10, 'running');
olderInvokeSnapshot.updatedAt = '1000';
const raceMerged = mergeTaskStatusRows([newerStreamedProgress], [olderInvokeSnapshot]);
assert.strictEqual(
  raceMerged[0],
  newerStreamedProgress,
  'older invoke snapshots must not overwrite newer task progress events',
);

const rowWithLogs = task('logs', 40, 'running');
rowWithLogs.logCount = 5;
rowWithLogs.updatedAt = '4000';
const streamedWithoutLogCount = task('logs', 45, 'running');
streamedWithoutLogCount.logCount = 0;
streamedWithoutLogCount.updatedAt = '4500';
const logMerged = mergeTaskProgressEventStatus([rowWithLogs], streamedWithoutLogCount);
assert.equal(
  logMerged[0].logCount,
  5,
  'single task progress events must not clear log counts populated by polling snapshots',
);
assert.equal(logMerged[0].progress, 45, 'newer single task progress events should still update progress');

const unchangedAgain = mergeTaskStatusRows(previous, [task('a', 10), task('b', 20)]);
assert.strictEqual(unchangedAgain, previous, 'all-unchanged refresh should reuse the previous array');

const terminalTransitions = getRunningToTerminalTasks(
  [
    task('finished-once', 90, 'running'),
    task('already-finished', 100, 'succeeded'),
    task('queued-finished', 0, 'queued'),
    task('cancel-boundary', 40, 'cancelling'),
    task('still-running', 50, 'running'),
  ],
  [
    task('finished-once', 100, 'succeeded'),
    task('already-finished', 100, 'succeeded'),
    task('queued-finished', 100, 'succeeded'),
    task('cancel-boundary', 45, 'cancelled'),
    task('still-running', 55, 'running'),
  ],
);

assert.deepEqual(
  terminalTransitions.map((item) => item.id),
  ['finished-once', 'cancel-boundary'],
  'completion notifications should only consider running/cancelling tasks that just reached a terminal status',
);

assert.deepEqual(
  getRunningToTerminalTasks(
    [task('already-finished', 100, 'succeeded')],
    [task('already-finished', 100, 'succeeded')],
  ),
  [],
  'refreshing an already-terminal task must not trigger another completion notification',
);

assert.deepEqual(
  getRunTasksUpdatePlan([task('queued-after-start', 0, 'queued'), task('running-after-start', 10, 'running')]),
  { reason: 'task-started', hasLiveTasks: true },
  'nonblocking parse/index commands that return queued or running tasks must keep event-stream updates active without reporting completion',
);

assert.deepEqual(
  getRunTasksUpdatePlan([task('manually-paused', 0, 'paused')]),
  { reason: 'task-completed', hasLiveTasks: false },
  'paused tasks are unfinished for startup warnings but must not keep background task updates active forever',
);

assert.deepEqual(
  getRunTasksUpdatePlan([task('finished-background', 100, 'succeeded')]),
  { reason: 'task-completed', hasLiveTasks: false },
  'a synchronous terminal parse/index response without failures can still dispatch a completion refresh',
);

assert.deepEqual(
  getRunTasksUpdatePlan([task('failed-background', 100, 'failed')]),
  { reason: 'task-failed', hasLiveTasks: false },
  'terminal parse/index failures must preserve the failed-task refresh reason',
);

assert.deepEqual(
  getStartupTaskResumePlan([
    task('queued-on-restart', 0, 'queued'),
    task('running-on-restart', 45, 'running'),
    task('cancelling-on-restart', 45, 'cancelling'),
  ]),
  { shouldResume: true, hasLiveTasks: true },
  'startup recovery must resume queued, running, or cancelling work after an app restart',
);

assert.deepEqual(
  getStartupTaskResumePlan([task('paused-on-restart', 0, 'paused')]),
  { shouldResume: false, hasLiveTasks: false },
  'startup recovery must not auto-run manually paused tasks forever',
);

assert.deepEqual(
  getStartupTaskResumePlan([task('paused-auto-resume', 0, 'paused')], 'auto'),
  { shouldResume: true, hasLiveTasks: true },
  'index pause/resume strategy auto must allow paused indexing tasks to resume at startup',
);
assert.match(
  taskServiceSource,
  /export async function resumePausedTasksAndRun\(taskIds: string\[\]\)[\s\S]*await retryTask\(taskId\)[\s\S]*return await runParseAndIndexTasks\(\)/,
  'auto startup recovery must requeue paused tasks before running the backend queue',
);
assert.match(
  taskServiceSource,
  /function canUseTauriTaskCommands\(\)[\s\S]*__TAURI_INTERNALS__/,
  'index diagnostics loading must distinguish browser preview from Tauri command failures',
);
const normalizedSidecarDiagnostics = normalizeIndexDiagnostics({
  summary: {
    ftsAvailable: true,
    sidecarStatus: 'not-configured',
    sidecarMessage: 'Python sidecar has not been configured',
    vectorIndexStatus: 'not-built',
    vectorIndexedBookCount: 3,
    vectorIndexedChunkCount: 42,
    vectorProvider: 'bookmind-sidecar',
    vectorDimension: 768,
    vectorLastBuiltAt: '2026-06-15T00:00:00.000Z',
    vectorLastError: 'none',
  },
  books: [],
});
assert.equal(normalizedSidecarDiagnostics.summary.sidecarStatus, 'not-configured', 'index diagnostics must preserve Rust-owned sidecar availability status');
assert.equal(normalizedSidecarDiagnostics.summary.sidecarMessage, 'Python sidecar has not been configured', 'index diagnostics must preserve sidecar status detail');
assert.equal(normalizedSidecarDiagnostics.summary.vectorIndexStatus, 'not-built', 'index diagnostics must preserve vector index status');
assert.equal(normalizedSidecarDiagnostics.summary.vectorIndexedBookCount, 3, 'index diagnostics must preserve vector indexed book counts');
assert.equal(normalizedSidecarDiagnostics.summary.vectorIndexedChunkCount, 42, 'index diagnostics must preserve vector indexed chunk counts');
assert.equal(normalizedSidecarDiagnostics.summary.vectorProvider, 'bookmind-sidecar', 'index diagnostics must preserve vector provider metadata');
assert.equal(normalizedSidecarDiagnostics.summary.vectorDimension, 768, 'index diagnostics must preserve vector dimensions');
assert.equal(normalizedSidecarDiagnostics.summary.vectorLastBuiltAt, '2026-06-15T00:00:00.000Z', 'index diagnostics must preserve vector build timestamp');
assert.equal(normalizedSidecarDiagnostics.summary.vectorLastError, 'none', 'index diagnostics must preserve vector error detail');

const legacyDiagnostics = normalizeIndexDiagnostics({ summary: {}, books: [] });
assert.equal(legacyDiagnostics.summary.sidecarStatus, 'not-configured', 'legacy diagnostics must default sidecar status to not-configured');
assert.equal(legacyDiagnostics.summary.vectorIndexStatus, 'not-built', 'legacy diagnostics must default vector status to not-built');
assert.equal(legacyDiagnostics.summary.vectorIndexedBookCount, 0, 'legacy diagnostics must default vector book counts to zero');
assert.equal(legacyDiagnostics.summary.vectorIndexedChunkCount, 0, 'legacy diagnostics must default vector chunk counts to zero');
assert.equal(legacyDiagnostics.summary.sidecarVersion, '', 'legacy diagnostics must default sidecar version to empty');
assert.deepEqual(legacyDiagnostics.summary.sidecarCapabilities, [], 'legacy diagnostics must default sidecar capabilities to empty');
assert.equal(legacyDiagnostics.summary.sidecarErrorCode, '', 'legacy diagnostics must default sidecar error code to empty');
assert.equal(legacyDiagnostics.summary.sidecarCheckedAt, '', 'legacy diagnostics must default sidecar checkedAt to empty');

const rawSidecarDiagnostics = normalizeIndexDiagnostics({
  summary: {
    sidecarStatus: 'available',
    sidecarMessage: 'ready',
    sidecarVersion: '0.2.0',
    sidecarCapabilities: ['embedding', 'ner', 'C:/Users/alice/private/vector-store', '/Users/alice/private/vector-store'],
    sidecarErrorCode: '',
    sidecarCheckedAt: '1781540000000',
  },
  books: [],
});
assert.equal(rawSidecarDiagnostics.summary.sidecarStatus, 'available', 'raw diagnostics must preserve sidecar status when no health override is provided');
assert.equal(rawSidecarDiagnostics.summary.sidecarVersion, '0.2.0', 'raw diagnostics must preserve sidecar version when no health override is provided');
assert.deepEqual(rawSidecarDiagnostics.summary.sidecarCapabilities, ['embedding', 'ner'], 'raw diagnostics must preserve only safe sidecar capability labels when no health override is provided');
assert.equal(rawSidecarDiagnostics.summary.sidecarCheckedAt, '1781540000000', 'raw diagnostics must preserve sidecar checkedAt when no health override is provided');

const normalizedSidecarHealth = normalizeSidecarHealthForIndexDiagnostics({
  sidecarStatus: 'error',
  message: 'AI sidecar could not start (not-found). C:\\Users\\alice\\sidecar\\run.py stderr prompt secret',
  version: '0.1.0',
  capabilities: ['embedding', 'ner', 'C:\\Users\\alice\\private\\vector-store'],
  checkedAt: '1781540000000',
});
assert.equal(normalizedSidecarHealth.sidecarStatus, 'error', 'sidecar health normalization must preserve the Rust-owned health status');
assert.equal(normalizedSidecarHealth.sidecarErrorCode, 'not-found', 'sidecar health normalization must derive a structured error code');
assert.equal(normalizedSidecarHealth.sidecarVersion, '0.1.0', 'sidecar health normalization must preserve sidecar version metadata');
assert.deepEqual(
  normalizedSidecarHealth.sidecarCapabilities,
  ['embedding', 'ner'],
  'sidecar health normalization must keep only safe capability labels',
);
assert.equal(normalizedSidecarHealth.sidecarCheckedAt, '1781540000000', 'sidecar health normalization must preserve checkedAt metadata');
assert.doesNotMatch(
  JSON.stringify(normalizedSidecarHealth),
  /C:\\Users|sidecar\\run\.py|vector-store|prompt secret/i,
  'normalized sidecar health must not preserve command paths, vector paths, prompts, or raw stderr text',
);
for (const [message, expectedCode] of [
  ['AI sidecar health command timed out (timeout).', 'timeout'],
  ['AI sidecar health response was not valid JSON (invalid-json).', 'invalid-json'],
  ['AI sidecar health command exited with an error (process-exited).', 'process-exited'],
]) {
  const failure = normalizeSidecarHealthForIndexDiagnostics({
    sidecarStatus: 'error',
    message,
    version: '',
    capabilities: [],
    checkedAt: '1781540000001',
  });
  assert.equal(failure.sidecarErrorCode, expectedCode, `sidecar failure must derive ${expectedCode} error code`);
  assert.doesNotMatch(
    JSON.stringify(failure),
    /stderr|prompt|C:\\Users|\/Users\/alice|vector-store/i,
    `${expectedCode} sidecar failure must not leak stderr, prompts, or local paths`,
  );
}
assert.match(
  taskServiceSource,
  /export async function loadIndexDiagnostics\(\)[\s\S]*if \(!canUseTauriTaskCommands\(\)\) return emptyIndexDiagnostics;[\s\S]*Promise\.all\(\[[\s\S]*invoke<RawIndexDiagnostics>\('get_index_diagnostics'\)[\s\S]*loadSidecarHealthForIndexDiagnostics\(\)[\s\S]*\]\)/,
  'desktop index diagnostics must load Rust index diagnostics and Rust sidecar health together',
);
const loadIndexDiagnosticsSource = taskServiceSource.slice(
  taskServiceSource.indexOf('export async function loadIndexDiagnostics'),
  taskServiceSource.indexOf('export async function validateAllIndexes'),
);
assert.doesNotMatch(
  loadIndexDiagnosticsSource,
  /Using empty index diagnostics because Tauri index command failed|catch \(error\)[\s\S]*emptyIndexDiagnostics/,
  'Tauri index diagnostics failures must not be masked as an empty index manifest browser',
);
assert.match(
  taskCenterStateSource,
  /const requests: Array<Promise<unknown>> = \[loadTaskStatuses\(\)\];[\s\S]*if \(includeDiagnostics\) requests\.push\(loadIndexDiagnostics\(\)\);[\s\S]*if \(includeLogs\) requests\.push\(loadTaskLogs\(logTaskId\)\);[\s\S]*Promise\.allSettled\(requests\)/,
  'Task center refresh must not let index diagnostics failures block task queue updates',
);
assert.match(
  taskCenterStateSource,
  /const loadErrors: string\[\] = \[\]/,
  'Task center refresh must collect partial load failures instead of collapsing them into an empty index state',
);
const commitTasksSource = taskCenterStateSource.slice(
  taskCenterStateSource.indexOf('const commitTasks = useCallback'),
  taskCenterStateSource.indexOf('const runQueuedTasks = useCallback'),
);
assert.match(
  commitTasksSource,
  /options: \{ refreshDiagnostics\?: boolean \} = \{\}/,
  'Task center task commits must allow callers to skip heavyweight index diagnostics refreshes',
);
assert.match(
  commitTasksSource,
  /if \(options\.refreshDiagnostics \?\? true\) \{[\s\S]*await refreshIndexDiagnosticsAfterTaskChange\(\);[\s\S]*\}/,
  'Task center task commits should keep diagnostics refresh opt-in compatible by default',
);
const rebuildIndexSource = taskCenterStateSource.slice(
  taskCenterStateSource.indexOf('const rebuildIndex = useCallback'),
  taskCenterStateSource.indexOf('const rebuildSelectedIndexes = useCallback'),
);
assert.match(
  rebuildIndexSource,
  /commitTasks\(await rebuildBookIndex\(bookId\), 'index-rebuilt', \{ refreshDiagnostics: false \}\)/,
  'Single-book rebuild must enqueue immediately without awaiting full index diagnostics',
);
assert.match(
  rebuildIndexSource,
  /void refreshIndexDiagnosticsAfterTaskChange\(\)/,
  'Single-book rebuild may refresh index diagnostics only as a fire-and-forget follow-up',
);
const rebuildSelectedIndexesSource = taskCenterStateSource.slice(
  taskCenterStateSource.indexOf('const rebuildSelectedIndexes = useCallback'),
  taskCenterStateSource.indexOf('const deleteIndex = useCallback'),
);
assert.match(
  rebuildSelectedIndexesSource,
  /commitTasks\(nextTasks, 'index-rebuilt', \{ refreshDiagnostics: false \}\)/,
  'Batch rebuild must enqueue immediately without awaiting full index diagnostics',
);
assert.match(
  `${appTaskCenterSource}\n${appTaskActionsSource}`,
  /pauseResumeStrategy === 'auto'[\s\S]*previousTasks\.filter\(\(task\) => task\.status === 'paused'\)[\s\S]*resumePausedTasksAndRun\(pausedTaskIds\)/,
  'App startup recovery must call paused-task resume when the index pause/resume strategy is auto',
);

assert.deepEqual(
  getStartupTaskResumePlan([task('paused-ask-resume', 0, 'paused')], 'ask'),
  { shouldResume: false, hasLiveTasks: false },
  'index pause/resume strategy ask keeps paused tasks stopped until the user confirms',
);

assert.deepEqual(
  getStartupTaskResumePlan([task('finished-on-restart', 100, 'succeeded')]),
  { shouldResume: false, hasLiveTasks: false },
  'startup recovery must ignore terminal tasks',
);

assert.deepEqual(
  getIdleQueuedTaskAutoRunPlan([task('queued-idle', 0, 'queued')], true),
  { shouldRun: true, queuedCount: 1 },
  'idle queued auto-run must start when enabled and only queued work remains',
);

assert.deepEqual(
  getIdleQueuedTaskAutoRunPlan([task('queued-disabled', 0, 'queued')], false),
  { shouldRun: false, queuedCount: 1 },
  'idle queued auto-run must stay off when disabled',
);

assert.deepEqual(
  getIdleQueuedTaskAutoRunPlan([task('queued-with-running', 0, 'queued'), task('running-now', 30, 'running')], true),
  { shouldRun: false, queuedCount: 1 },
  'idle queued auto-run must not start another runner while live work exists',
);

assert.deepEqual(
  getIdleQueuedTaskAutoRunPlan([task('paused-only', 0, 'paused')], true),
  { shouldRun: false, queuedCount: 0 },
  'idle queued auto-run must not resume paused tasks by itself',
);

const progressEvent = normalizeTaskProgressEvent({
  status: task('event-task', 65, 'running'),
  reason: 'stage-updated',
});
assert.equal(progressEvent.reason, 'stage-updated', 'task progress events should preserve backend event reasons');
assert.equal(progressEvent.status.id, 'event-task', 'task progress events should normalize backend task status payloads');
assert.equal(progressEvent.status.progress, 65, 'task progress events should carry stage progress without polling');

let clickedRunRows = [{
  ...task('click-run', 0, 'queued'),
  stage: 'queued',
  stageLabel: '排队中',
  tone: 'amber',
  updatedAt: '1000',
}];
clickedRunRows = mergeTaskProgressEventStatus(clickedRunRows, {
  ...task('click-run', 0, 'running'),
  stage: 'read-file',
  stageLabel: '读取文件',
  tone: 'indigo',
  updatedAt: '2000',
});
assert.equal(clickedRunRows[0].status, 'running', 'clicking run must let streamed task-started events replace queued rows immediately');
assert.equal(clickedRunRows[0].stage, 'read-file', 'clicking run must expose the first indexing stage without waiting for polling');
const streamedStageProgress = [
  ['read-file', '读取文件', 10],
  ['parse-chapters', '解析章节', 25],
  ['build-chunks', '生成 chunks', 45],
  ['write-chunks', '写入 chunk store', 65],
  ['write-fts', '写入 FTS', 85],
  ['verify', '校验索引', 95],
];
for (const [stage, stageLabel, progress] of streamedStageProgress) {
  clickedRunRows = mergeTaskProgressEventStatus(clickedRunRows, {
    ...task('click-run', progress, 'running'),
    stage,
    stageLabel,
    tone: 'indigo',
    updatedAt: String(2000 + progress),
  });
  assert.equal(clickedRunRows[0].stage, stage, `streamed progress must update the visible task stage to ${stage}`);
  assert.equal(clickedRunRows[0].stageLabel, stageLabel, `streamed progress must update the visible stage label to ${stageLabel}`);
  assert.equal(clickedRunRows[0].progress, progress, `streamed progress must update the visible percent to ${progress}`);
}

const dagTask = normalizeTaskStatus({
  id: 'full-text-node',
  kind: 'full-text-index',
  status: 'queued',
  dagId: 'dag-1',
  dependsOn: ['parse-node'],
  blockedBy: ['parse-node'],
});
assert.equal(dagTask.kind, 'full-text-index', 'DAG full-text nodes must preserve their task kind');
assert.equal(dagTask.dagId, 'dag-1', 'DAG task status must preserve dagId');
assert.deepEqual(dagTask.dependsOn, ['parse-node'], 'DAG task status must preserve dependencies');
assert.deepEqual(dagTask.blockedBy, ['parse-node'], 'DAG task status must preserve blocked dependencies');

const directoryImportTask = normalizeTaskStatus({
  id: 'directory-import-node',
  kind: 'import-directory',
  status: 'succeeded',
});
assert.equal(directoryImportTask.kind, 'import-directory', 'directory import parent tasks must preserve their task kind');

const completionEvents = [];
globalThis.window = {
  dispatchEvent(event) {
    completionEvents.push(event.detail);
    return true;
  },
  CustomEvent: globalThis.CustomEvent,
};

const duplicatePrevious = [task('dedupe', 90, 'running')];
const duplicateNext = [task('dedupe', 100, 'succeeded')];
dispatchTasksCompleted(duplicateNext, duplicatePrevious);
dispatchTasksCompleted(duplicateNext, duplicatePrevious);
assert.equal(completionEvents.length, 1, 'duplicate completion transition events should be emitted once');
assert.equal(completionEvents[0].tasks[0].id, 'dedupe');

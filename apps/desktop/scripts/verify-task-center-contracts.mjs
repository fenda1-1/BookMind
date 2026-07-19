import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const exists = (file) => existsSync(path.join(root, file));

function readTree(directory, extension) {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) return '';
  return readdirSync(absolute)
    .flatMap((entry) => {
      const fullPath = path.join(absolute, entry);
      const relativePath = path.join(directory, entry);
      if (statSync(fullPath).isDirectory()) return [readTree(relativePath, extension)];
      if (!entry.endsWith(extension)) return [];
      return [readFileSync(fullPath, 'utf8')];
    })
    .join('\n');
}

function readCssWithImports(filePath, seen = new Set()) {
  const absolute = path.join(root, filePath);
  if (seen.has(absolute)) return '';
  seen.add(absolute);
  const source = readFileSync(absolute, 'utf8');
  const imports = [...source.matchAll(/@import\s+['"](.+?)['"];/g)]
    .map((match) => readCssWithImports(path.join(path.dirname(filePath), match[1]), seen));
  return [source, ...imports].join('\n');
}

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertIncludes(source, needle, file) {
  assert(source.includes(needle), `${file} must include ${needle}`);
}

const packageJson = JSON.parse(read('package.json'));
const appTaskActionsPath = 'src/app/appTaskActions.ts';
assert(exists(appTaskActionsPath), 'App task and indexing orchestration must live in appTaskActions');
const appTaskActions = exists(appTaskActionsPath) ? read(appTaskActionsPath) : '';
const appShellSourceForTaskActions = read('src/app/App.tsx');
assert(appShellSourceForTaskActions.includes("from './appTaskActions'"), 'App must import task/indexing action facade from appTaskActions');
assert(appTaskActions.includes('runAppParseAndIndexTasks'), 'appTaskActions must own the shared parse/index runner');
assert(appTaskActions.includes('runCharacterTextIndex'), 'appTaskActions must own character text indexing orchestration');
assert(appTaskActions.includes('runCharacterExtraction'), 'appTaskActions must own character extraction orchestration');
assert(appTaskActions.includes('resumeStartupTasks'), 'appTaskActions must own startup task resume orchestration');
assert(appTaskActions.includes('autoIndexOpenedReaderBook'), 'appTaskActions must own opened-reader auto-indexing orchestration');
assert(appTaskActions.includes('maybeRunQueuedTasksWhenIdle'), 'appTaskActions must own idle queued task auto-run orchestration');
assert(!/function hasIndexTaskForBook/.test(appShellSourceForTaskActions), 'App must not inline index-task matching once appTaskActions owns task orchestration');
assert(!/await runParseAndIndexTasks\(\)/.test(appShellSourceForTaskActions), 'App must not call low-level task runner directly once appTaskActions owns task orchestration');
assert(!/await rebuildBookIndex\(/.test(appShellSourceForTaskActions), 'App must not call low-level index rebuild directly once appTaskActions owns task orchestration');
assert(!/await resumePausedTasksAndRun\(/.test(appShellSourceForTaskActions), 'App must not call low-level paused-task resume directly once appTaskActions owns task orchestration');
assert(packageJson.scripts['test:task-center-contracts'] === 'node scripts/verify-task-center-contracts.mjs', 'package.json must define test:task-center-contracts');
assert(packageJson.scripts.test.includes('test:task-center-contracts'), 'npm test must run task center contracts');
assert(packageJson.scripts.test.includes('test:index-diagnostics'), 'npm test must run index diagnostics checks');
assert(packageJson.scripts.test.includes('test:task-privacy'), 'npm test must run task privacy checks');
assert(packageJson.scripts.test.includes('test:task-filters'), 'npm test must run task filter checks');
assert(packageJson.scripts.test.includes('test:task-batch-selection'), 'npm test must run task batch selection checks');
assert(packageJson.scripts.test.includes('test:task-concurrency-policy'), 'npm test must run task concurrency policy checks');
assert(packageJson.scripts.test.includes('test:task-completion-refresh-policy'), 'npm test must run task completion refresh checks');
assert(packageJson.scripts.test.includes('test:task-notification-policy'), 'npm test must run task notification policy checks');
assert(packageJson.scripts.test.includes('test:task-performance-model'), 'npm test must run task performance model checks');
assert(packageJson.scripts.test.includes('test:task-virtual-window'), 'npm test must run task virtual-window checks');
assert(packageJson.scripts.test.includes('test:task-log-console-actions'), 'npm test must run task log console action checks');
assert(packageJson.scripts['test:index-diagnostics'] === 'node src/services/indexDiagnosticsService.test.mjs', 'package.json must define test:index-diagnostics');
assert(packageJson.scripts['test:task-privacy'] === 'node src/features/task-center/taskPrivacy.test.mjs', 'package.json must define test:task-privacy');
assert(packageJson.scripts['test:task-filters'] === 'node src/features/task-center/taskFilters.test.mjs', 'package.json must define test:task-filters');
assert(packageJson.scripts['test:task-batch-selection'] === 'node src/features/task-center/taskBatchSelection.test.mjs', 'package.json must define test:task-batch-selection');
assert(packageJson.scripts['test:task-concurrency-policy']?.includes('taskConcurrencyPolicy.test.mjs'), 'package.json must define test:task-concurrency-policy');
assert(packageJson.scripts['test:task-completion-refresh-policy'] === 'node src/features/task-center/taskCompletionRefreshPolicy.test.mjs', 'package.json must define test:task-completion-refresh-policy');
assert(packageJson.scripts['test:task-notification-policy'] === 'node src/features/task-center/taskNotificationPolicy.test.mjs', 'package.json must define test:task-notification-policy');
assert(packageJson.scripts['test:task-performance-model'] === 'node src/features/task-center/taskPerformanceModel.test.mjs', 'package.json must define test:task-performance-model');
assert(packageJson.scripts['test:task-virtual-window'] === 'node src/features/task-center/taskVirtualWindow.test.mjs', 'package.json must define test:task-virtual-window');
assert(packageJson.scripts['test:task-log-console-actions'] === 'node src/features/task-center/taskLogConsoleActions.test.mjs', 'package.json must define test:task-log-console-actions');
assert(packageJson.scripts['benchmark:index-run'] === 'node scripts/benchmark-index-run.mjs', 'package.json must define benchmark:index-run');
assert(exists('scripts/benchmark-index-run.mjs'), 'scripts/benchmark-index-run.mjs must exist');
[
  ['task queue UI contracts', 'test:task-center-contracts'],
  ['task center render', 'test:task-center-render'],
  ['task service model', 'test:task-service'],
  ['index diagnostics service', 'test:index-diagnostics'],
  ['task log console actions', 'test:task-log-console-actions'],
  ['task filters', 'test:task-filters'],
  ['task batch selection', 'test:task-batch-selection'],
  ['task concurrency policy', 'test:task-concurrency-policy'],
  ['task completion refresh policy', 'test:task-completion-refresh-policy'],
  ['task notification policy', 'test:task-notification-policy'],
  ['task performance model', 'test:task-performance-model'],
  ['task virtual window', 'test:task-virtual-window'],
  ['task diagnostics export', 'test:task-diagnostics-export'],
].forEach(([label, script]) => assert(packageJson.scripts.test.includes(script), `npm test must include ${label} coverage through ${script}`));

const indexRunBenchmark = read('scripts/benchmark-index-run.mjs');
[
  'INDEX_BENCHMARK_MBS = [1, 10, 100]',
  'BOOKMIND_INDEX_BENCH_SCALE',
  "benchmark: 'index-run'",
  'targetSizesMb: INDEX_BENCHMARK_MBS',
  'bytesRead',
  'durationMs',
  'stageDurationsMs',
  'readFile',
  'parseChapters',
  'buildChunks',
  'writeChunks',
  'writeFts',
  'verify',
  'chunkCount',
  'ftsRowCount',
  'chunksPerSecond',
  'mbPerSecond',
].forEach((needle) => assertIncludes(indexRunBenchmark, needle, 'scripts/benchmark-index-run.mjs'));

const types = read('src/types.ts');
[
  'export type TaskRunStatus',
  "'queued'",
  "'running'",
  "'paused'",
  "'cancelling'",
  "'cancelled'",
  "'failed'",
  "'succeeded'",
  "'skipped'",
  "'archived'",
  'export type TaskKind',
  "'import-book'",
  "'parse-and-index'",
  "'rebuild-index'",
  "'cleanup-index'",
  "'export-data'",
  "'embedding-index'",
  "'ai-summary'",
  "'backup'",
  "'diagnostics'",
  'export type TaskStage',
  "'read-file'",
  "'parse-chapters'",
  "'build-chunks'",
  "'write-chunks'",
  "'write-fts'",
  "'verify'",
  'export type TaskOutputSummary',
  'chunksPerSecond',
  'mbPerSecond',
  'stageDurationsMs',
  'export type TaskError',
  'export type TaskLogRecord',
  'export type BookIndexManifest',
  'export type IndexedChunkPreviewItem',
  'export type IndexedChunksPreview',
  'summary: {',
  'succeededCount: number',
  'pausedCount: number',
  'cancelledCount: number',
  'books: BookIndexManifest[]',
].forEach((needle) => assertIncludes(types, needle, 'src/types.ts'));

[
  'kind: TaskKind',
  'stage: TaskStage',
  'stageLabel: string',
  "tone: 'sage' | 'amber' | 'indigo' | 'cinnabar' | 'violet'",
  'bookTitle: string',
  'fileName: string',
  'createdAt: string',
  'updatedAt: string',
  'startedAt: string',
  'finishedAt: string',
  'durationMs: number',
  'attempt: number',
  'maxAttempts: number',
  'errorCode: string',
  'errorMessage: string',
  'error: TaskError',
  'logCount: number',
  'outputSummary: TaskOutputSummary',
].forEach((needle) => assertIncludes(types, needle, 'TaskStatus'));

const taskService = read('src/services/taskService.ts');
const tauriModels = `${read('src-tauri/src/models.rs')}\n${readTree('src-tauri/src/models', '.rs')}`;
const tauriTasks = `${read('src-tauri/src/tasks.rs')}\n${readTree('src-tauri/src/tasks', '.rs')}`;
const tauriCommands = `${read('src-tauri/src/commands.rs')}\n${readTree('src-tauri/src/commands', '.rs')}`;
const tauriTests = `${read('src-tauri/src/tests.rs')}\n${readTree('src-tauri/src/tests', '.rs')}`;
[
  'task_state_contract_values_serialize_to_frontend_strings',
  'task_error_contract_exposes_common_codes_and_structured_payload',
  'parse_runner_streams_task_started_stage_and_completion_events',
  'parse_runner_streams_and_persists_heavy_index_build_stages',
  'task_logs_can_be_loaded_and_cleared_for_completed_tasks',
  'task_logs_can_be_cleared_for_failed_tasks_without_removing_other_errors',
  'clearing_all_task_logs_persists_after_restart',
  'task_logs_support_tail_limit_and_incremental_offsets',
  'task_logs_are_sharded_by_created_date_and_loaded_across_shards',
  'task_log_retention_prunes_old_completed_logs_but_keeps_failed_logs',
  'index_diagnostics_report_queue_chunks_fts_and_recent_errors',
  'parse_runner_writes_index_manifest_for_completed_book',
  'diagnostics_marks_manifest_stale_when_content_hash_changes',
  'diagnostics_marks_manifest_stale_when_fts_rows_mismatch_chunks',
  'validate_all_indexes_scans_consistency_without_rebuilding',
  'validate_all_indexes_reports_chunks_without_manifest',
  'repair_book_fts_rewrites_fts_rows_from_existing_chunks_without_dropping_manifest',
].forEach((testName) => assertIncludes(tauriTests, testName, 'src-tauri/src/tests.rs'));
[
  'normalizeTaskStatus',
  'normalizeIndexDiagnostics',
  'checkAiSidecarHealth',
  'normalizeSidecarHealthForIndexDiagnostics',
  'loadSidecarHealthForIndexDiagnostics',
  'loadTaskLogs',
  'limit = 200',
  'offset = 0',
  'limit, offset',
  'clearTaskLogs',
  'applyTaskLogRetention',
  'apply_task_log_retention',
  'applyTaskRetention',
  'apply_task_retention',
  'retentionDays',
  'cancelQueuedTasks',
  'cancel_queued_tasks',
  'retryFailedTasks',
  'retry_failed_tasks',
  'pauseQueuedTasks',
  'pause_queued_tasks',
  'clearCompletedTasks',
  'archiveTask',
  'restoreArchivedTask',
  'restore_archived_task',
  'validateAllIndexes',
  'validate_all_indexes',
  'repairBookFts',
  'repair_book_fts',
  'loadIndexedChunksPreview',
  'get_indexed_chunks_preview',
  'normalizeIndexedChunksPreview',
  'mergeTaskStatusRows',
  'mergeTaskProgressEventStatus',
  'subscribeTaskProgressEvents',
  'normalizeTaskProgressEvent',
  'bookmind://task-progress',
  'dispatchTasksUpdated',
].forEach((needle) => assertIncludes(taskService, needle, 'src/services/taskService.ts'));

[
  'pub(crate) struct TaskError',
  'pub(crate) struct TaskErrorCode',
  'BOOK_MISSING',
  'FILE_MISSING',
  'FILE_READ_FAILED',
  'CHAPTER_PARSE_FAILED',
  'CHUNK_WRITE_FAILED',
  'FTS_WRITE_FAILED',
  'MANIFEST_WRITE_FAILED',
  'CANCELLED_BY_USER',
].forEach((needle) => assertIncludes(tauriModels, needle, 'src-tauri/src/models.rs'));

[
  'apply_task_retention_in',
  'restore_archived_task_in',
  'is_restorable_archived_task_kind',
  'is_dependency_success_status',
  '语义向量索引尚未接入',
  'AI 摘要尚未接入',
  'completed_limit',
  'is_completed_task_status',
  'TaskRunStatus::FAILED',
  'mark_index_manifests_stale_for_settings_change',
  '索引策略设置变更',
].forEach((needle) => assertIncludes(tauriTasks, needle, 'src-tauri/src/tasks.rs'));

[
  'archived_non_index_tasks_cannot_be_restored_to_dead_queue',
].forEach((needle) => assertIncludes(tauriTests, needle, 'src-tauri/src/tests.rs'));

[
  'update_settings_v2_in',
  'restore_archived_task',
  'index_strategy_changed_keys',
  'normalized_index_strategy_version',
  'normalized_index_chunk_size',
  'normalized_index_chunk_overlap',
  'indexStrategyVersion',
  'indexChunkSize',
  'indexChunkOverlap',
  'mark_index_manifests_stale_for_settings_change',
].forEach((needle) => assertIncludes(tauriCommands, needle, 'src-tauri/src/commands.rs'));
assert(/save_settings_v2\(data_dir, &settings\)\?;[\s\S]*index_strategy_changed_keys\(&previous, &saved\)[\s\S]*mark_index_manifests_stale_for_settings_change\(data_dir, &changed_keys\)\?/.test(tauriCommands), 'settings_v2 saves must persist stale manifest markers when index strategy settings change');

const tasksPage = read('src/pages/TasksPage.tsx');
assertIncludes(tasksPage, 'useTaskCenterState', 'src/pages/TasksPage.tsx');
assert(!tasksPage.includes('useState<TaskStatus'), 'TasksPage.tsx should delegate task state to useTaskCenterState');
[
  'state.openLibraryImport',
  'state.repairFts',
  'TaskCommandCenter',
  'privacyMode={taskPrivacyMode}',
  'TaskModuleWorkspace',
  'activeModule={activeModule}',
  'isTauriRuntime',
  'task-runtime-notice',
  'tasks.browserPreview.title',
  'tasks.browserPreview.description',
  'onOpenTaskSettings',
  'loadGlobalReaderSettings',
  'taskPrivacyMode',
  'privacyMode={taskPrivacyMode}',
].forEach((needle) => assertIncludes(tasksPage, needle, 'src/pages/TasksPage.tsx'));
assert(!tasksPage.includes('TaskPageTopbar'), 'TasksPage.tsx must not render a duplicate internal task topbar');

[
  'src/features/task-center/useTaskCenterState.ts',
  'src/features/task-center/taskPrivacy.ts',
  'src/features/task-center/taskFilters.ts',
  'src/features/task-center/taskBatchSelection.ts',
  'src/features/task-center/taskConcurrencyPolicy.ts',
  'src/features/task-center/taskCompletionRefreshPolicy.ts',
  'src/features/task-center/taskNotificationPolicy.ts',
  'src/features/task-center/taskPerformanceModel.ts',
  'src/features/task-center/taskVirtualWindow.ts',
  'src/features/task-center/TaskCommandCenter.tsx',
  'src/features/task-center/TaskModuleWorkspace.tsx',
  'src/features/task-center/TaskHealthDashboard.tsx',
  'src/features/task-center/TaskQueueTable.tsx',
  'src/features/task-center/TaskDetailPanel.tsx',
  'src/features/task-center/IndexManifestBrowser.tsx',
  'src/features/task-center/TaskLogConsole.tsx',
  'src/features/task-center/taskLogExport.ts',
  'src/services/indexDiagnosticsService.ts',
].forEach((file) => assert(exists(file), `${file} must exist`));
assert(exists('src/services/taskDiagnosticsExport.ts'), 'src/services/taskDiagnosticsExport.ts must exist');

const taskDiagnosticsExport = read('src/services/taskDiagnosticsExport.ts');
[
  'buildTaskDiagnosticsExport',
  'buildTaskDetailDiagnosticJson',
  'redactDiagnosticPaths',
  'basename-and-hash',
  'pathHash',
  'fileName',
].forEach((needle) => assertIncludes(taskDiagnosticsExport, needle, 'src/services/taskDiagnosticsExport.ts'));

const componentExpectations = {
  'src/features/task-center/TaskModuleWorkspace.tsx': ['TaskModuleWorkspace', 'TaskCenterModule', 'TaskQueueWorkspaceView', 'TaskLogWorkspaceView', 'task-diagnostic-terminal', 'task-execution-deck', 'task-queue-page-shell', 'task-queue-view-tabs', 'task-queue-view-tasks', 'task-queue-view-manage', 'task-queue-view-status', 'task-log-page-shell', 'task-log-view-tabs', 'task-log-view-overview', 'task-log-view-manage', 'task-execution-toolbar', 'task-execution-progress', 'TaskQueueTable', 'IndexManifestBrowser', 'TaskLogConsole', 'TaskDetailPanel', 'activeModule', 'TaskDiagnosticTerminal', 'TaskControlAction', "'restore'", 'const visibleTasks = tasks', 'canRestoreArchivedTask(task)'],
  'src/features/task-center/TaskCommandCenter.tsx': ['BookMindIcon', 'TaskCommandCenterProps', 'task-command-center', 'task-module-nav', 'TaskModuleCard', 'tasks.commandCenter.title', 'tasks.commandCenter.modules.queue', 'tasks.commandCenter.modules.index', 'tasks.commandCenter.modules.logs', 'tasks.commandCenter.modules.resources'],
  'src/features/task-center/TaskHealthDashboard.tsx': ['runningCount', 'queuedCount', 'succeededCount', 'failedCount', 'pausedCount', 'cancelledCount', 'staleBookCount', 'indexedBookCount', 'indexedChunkCount', 'sidecarStatus', 'sidecarVersion', 'sidecarCapabilities', 'sidecarErrorCode', 'task-health-heading', 'task-sidecar-health', 'tasks.health.succeeded', 'tasks.health.paused', 'tasks.health.cancelled', 'tasks.sidecarHealth.title', 'tasks.sidecarHealth.version', 'tasks.sidecarHealth.capabilities', 'tasks.sidecarHealth.errorCode'],
  'src/features/task-center/TaskQueueTable.tsx': ['BookMindIcon', 'data-tooltip', 'aria-label', 'title=', 'PAGE_SIZE = 50', 'useMemo', 'getLargeTaskQueueView', 'queueView.rows', 'queueView.filteredCount', 'memo(function TaskQueueRow', 'task-queue-card', 'onOpenDetails', 'onOpenLogs', 'onArchive', 'stageLabel', 'durationMs', 'updatedAt', 'errorCode', 'privacyMode', 'redactTaskText', 'getSelectedTaskBatchTargets', 'canRestoreArchivedTask', 'selectedTaskIds', 'task-queue-filters', 'task-batch-toolbar', 'tasks.filter.book', 'tasks.filter.kind', 'tasks.filter.status', 'tasks.filter.time', 'tasks.filter.errorCode', 'tasks.batch.retrySelectedFailed', 'tasks.batch.cancelSelectedQueued', 'tasks.batch.clearCompleted', 'tasks.batch.rebuildSelectedIndexes', 'tasks.retry', 'tasks.action.restore', "'restore'", 'tasks.emptyGuide.importTxt', 'tasks.emptyGuide.chooseDirectory', 'tasks.emptyGuide.runSample', 'tasks.emptyGuide.learnIndexArtifacts'],
  'src/features/task-center/TaskDetailPanel.tsx': ['outputSummary', 'chunksPerSecond', 'mbPerSecond', 'errorMessage', 'logs', 'stageTimeline', 'errorDetailsDefaultExpanded', 'copyTaskDiagnosticJson', 'buildTaskDetailDiagnosticJson', 'navigator.clipboard?.writeText', 'JSON.stringify', 'tasks.detail.copyDiagnosticJson', 'privacyMode', 'displayTaskFileName', 'book_missing', 'file_missing', 'file_read_failed', 'chapter_parse_failed', 'chunk_write_failed', 'fts_write_failed', 'manifest_write_failed', 'cancelled_by_user', 'tasks.errorAdvice.generic'],
  'src/features/task-center/IndexManifestBrowser.tsx': ['BookMindIcon', 'task-icon-btn', 'data-tooltip', 'aria-label', 'title=', 'index-book-card', 'index-book-menu-trigger', 'task-floating-menu', 'handleBookContextMenu', 'IndexBookDetail', 'createPortal', 'chapterCount', 'paragraphCount', 'chunkCount', 'ftsRowCount', 'contentHash', 'staleReason', 'onRebuildIndex', 'onDeleteIndex', 'onRepairFts', 'indexStatusFilter', 'indexStatusOptions', 'filteredBooks', 'getIndexStatusBucket', 'loadIndexedChunksPreview', 'expandedBookId', 'chunkPreviewQuery', 'chunkPreviewChapter', 'chunkPreview', 'renderChunkPreviewPanel', 'copyChunkPreviewText', 'openChunkInReader', 'requestReaderLocationOpen', 'SearchResult', 'sourceChapterIndex', 'paragraphIndex', 'startOffset', 'endOffset', 'readerLocation', 'paragraphRange', 'charStart', 'charEnd', 'charRange', 'charCount', 'textPreview', 'privacyMode', 'displayTaskPath', 'tasks.indexBrowser.statusFilter', 'tasks.indexBrowser.statusAll', 'tasks.indexBrowser.statusReady', 'tasks.indexBrowser.statusMissing', 'tasks.indexBrowser.statusStale', 'tasks.indexBrowser.statusFailed', 'tasks.indexBrowser.contentHash', 'tasks.indexBrowser.previewChunks', 'tasks.indexBrowser.viewDetails', 'tasks.indexBrowser.chunkOrdinal', 'tasks.indexBrowser.chapterTitle', 'tasks.indexBrowser.paragraphRange', 'tasks.indexBrowser.charRange', 'tasks.indexBrowser.charCount', 'tasks.indexBrowser.textPreview', 'tasks.indexBrowser.jumpReader', 'tasks.indexBrowser.copyChunk', 'tasks.indexBrowser.chunkSearch', 'tasks.indexBrowser.chapterFilter', 'tasks.indexBrowser.noSearchableContent', 'tasks.indexBrowser.importEntry'],
  'src/features/task-center/TaskLogConsole.tsx': ['BookMindIcon', 'task-icon-btn', 'data-tooltip', 'aria-label', 'ERROR_LOG_COPY_LIMIT = 100', 'getLargeTaskLogView', 'logView.filteredLogs', 'logView.rows', 'useMemo', 'levelFilter', 'query', 'onClearLogs', 'onClearLogs(\'task\')', 'onClearLogs(\'completed\')', 'onClearLogs(\'failed\')', 'onClearLogs(\'all\')', 'disabled={false}', 'formatTaskLogsJsonl', 'formatTaskLogsMarkdown', 'downloadTaskLogExport', 'copyVisibleTaskLogs', 'copyRecentErrorLogs', 'from \'./taskLogExport\'', 'tasks.logs.copyVisible', 'tasks.logs.exportJsonl', 'tasks.logs.exportMarkdown', 'tasks.logs.copyRecentErrors', 'task-log-filterbar', 'task-log-actionbar', 'task-log-action-group', 'task-log-table-heading', 'task-log-message', 'privacyMode', 'redactTaskText', 'virtualWindow', 'beforeHeight', 'afterHeight', 'onScroll'],
  'src/features/task-center/taskLogExport.ts': ['formatTaskLogsJsonl', 'formatTaskLogsMarkdown', 'copyVisibleTaskLogs', 'copyRecentErrorLogs', 'navigator.clipboard?.writeText', 'redactTaskText', 'escapeMarkdownTableCell'],
};

for (const [file, needles] of Object.entries(componentExpectations)) {
  if (!exists(file)) continue;
  const source = read(file);
  needles.forEach((needle) => assertIncludes(source, needle, file));
}

const taskModuleWorkspace = read('src/features/task-center/TaskModuleWorkspace.tsx');
assert(
  /actionsOpen \? createPortal\([\s\S]*task-floating-menu task-execution-card-menu[\s\S]*canArchive \? <TaskExecutionMenuButton[\s\S]*tasks\.action\.archive[\s\S]*document\.querySelector<HTMLElement>\('\.app-shell'\)/.test(taskModuleWorkspace),
  'Task execution archive action must remain inside the portaled floating action menu instead of escaping the menu surface',
);

const taskTime = read('src/features/task-center/taskTime.ts');
[
  'formatTaskRelativeTime',
  'Intl.RelativeTimeFormat',
  'dateTime',
  'title',
].forEach((needle) => assertIncludes(taskTime, needle, 'src/features/task-center/taskTime.ts'));
[
  'src/features/task-center/TaskQueueTable.tsx',
  'src/features/task-center/TaskDetailPanel.tsx',
  'src/features/task-center/IndexManifestBrowser.tsx',
  'src/features/task-center/TaskLogConsole.tsx',
].forEach((file) => assertIncludes(read(file), 'formatTaskRelativeTime', file));

const taskFormat = read('src/features/task-center/taskFormat.ts');
[
  'formatTaskNumber',
  'formatTaskPercent',
  'formatTaskSeconds',
  'Intl.NumberFormat',
].forEach((needle) => assertIncludes(taskFormat, needle, 'src/features/task-center/taskFormat.ts'));
[
  'src/features/task-center/TaskHealthDashboard.tsx',
  'src/features/task-center/TaskCenter.tsx',
  'src/features/task-center/TaskQueueTable.tsx',
  'src/features/task-center/TaskDetailPanel.tsx',
  'src/features/task-center/IndexManifestBrowser.tsx',
].forEach((file) => assertIncludes(read(file), 'taskFormat', file));

const indexDiagnosticsService = read('src/services/indexDiagnosticsService.ts');
[
  'loadSharedIndexDiagnostics',
  'findBookIndexManifest',
  'getBookIndexView',
  'getBookIndexEmptyState',
  'createBookIndexAiDiagnostics',
  'staleReason',
  'stale-index',
  'appDomainEventNames.tasksUpdated',
  'bookmind:index-diagnostics-updated',
].forEach((needle) => assertIncludes(indexDiagnosticsService, needle, 'src/services/indexDiagnosticsService.ts'));

const taskCenterState = read('src/features/task-center/useTaskCenterState.ts');
[
  'tasks.confirm.cancel',
  'tasks.confirm.archive',
  'tasks.confirm.clearCompleted',
  'tasks.confirm.cancelQueued',
  'tasks.confirm.retryFailed',
  'tasks.confirm.pauseQueued',
  'tasks.confirm.rebuildIndex',
  'tasks.confirm.deleteIndex',
  'tasks.confirm.repairFts',
  'tasks.confirm.clearLogs',
  'mergeTaskStatusRows',
  'mergeTaskProgressEventStatus',
  'subscribeTaskProgressEvents',
  'await commitTasks(await rebuildBookIndex(bookId), \'index-rebuilt\', { refreshDiagnostics: false })',
  'const nextTasks = await runParseAndIndexTasks()',
  'const runningTasks = await runParseAndIndexTasks()',
  'tasksRef.current',
  'const previousTasks = tasksRef.current',
  'tasksRef.current = mergedTasks',
  'dispatchTasksCompleted(mergedTasks, previousTasks)',
  'getTaskCompletionRefreshPlan',
  'shouldDispatchLibraryRefreshAfterTaskCompletion',
  'taskCenterDefaultStatusFilter',
  'refreshLibraryOnTaskCompletion',
  'completionRefreshPlan.shouldRefresh',
  'validateAllIndexes()',
  "dispatchTasksUpdated('index-rebuilt', tasks)",
  'const confirm = options.confirm ?? defaultTaskCenterConfirm',
  'controlTaskBatch',
].forEach((needle) => assertIncludes(taskCenterState, needle, 'src/features/task-center/useTaskCenterState.ts'));
assert(/const rebuildIndex = useCallback\(async \(bookId: string\) => \{[\s\S]*await commitTasks\(await rebuildBookIndex\(bookId\), 'index-rebuilt', \{ refreshDiagnostics: false \}\);[\s\S]*const nextTasks = await runParseAndIndexTasks\(\);[\s\S]*await commitTasks\(nextTasks, getRunTasksUpdatePlan\(nextTasks\)\.reason, \{ refreshDiagnostics: false \}\);[\s\S]*void refreshIndexDiagnosticsAfterTaskChange\(\);/.test(taskCenterState), 'single-book rebuild must queue the rebuild and immediately start the queue without waiting for heavyweight diagnostics');
assert(/const rebuildSelectedIndexes = useCallback\(async \(bookIds: string\[\]\) => \{[\s\S]*for \(const bookId of bookIds\)[\s\S]*await commitTasks\(nextTasks, 'index-rebuilt', \{ refreshDiagnostics: false \}\);[\s\S]*const runningTasks = await runParseAndIndexTasks\(\);[\s\S]*await commitTasks\(runningTasks, getRunTasksUpdatePlan\(runningTasks\)\.reason, \{ refreshDiagnostics: false \}\);[\s\S]*void refreshIndexDiagnosticsAfterTaskChange\(\);/.test(taskCenterState), 'batch rebuild must enqueue all selected books before starting the queue once without waiting for heavyweight diagnostics');
assert(/const previousTasks = tasksRef\.current;[\s\S]*const mergedTasks = mergeTaskStatusRows\(previousTasks, nextTasks\);[\s\S]*tasksRef\.current = mergedTasks;[\s\S]*setTasks\(mergedTasks\);[\s\S]*dispatchTasksCompleted\(mergedTasks, previousTasks\);/.test(taskCenterState), 'task center state must advance the previous-task snapshot before dispatching completion events');
assert(/subscribeTaskProgressEvents\(\(events\) => \{[\s\S]*for \(const event of events\)[\s\S]*mergeTaskProgressEventStatus\(mergedTasks, event\.status\)[\s\S]*dispatchTasksCompleted\(mergedTasks, previousTasks\)/.test(taskCenterState), 'task center state must subscribe to task progress event batches and merge payloads without waiting for polling');
assert(!taskCenterState.includes('setInterval'), 'task center state must use the Tauri task progress event stream instead of interval polling while tasks run');
assert(!taskCenterState.includes('polling fallback'), 'task center state must not describe interval polling as the task progress fallback');
assert(/const clearLogs = useCallback\(async \(scope:[\s\S]*confirm\(t\('tasks\.confirm\.clearLogs'\)\)[\s\S]*await clearTaskLogs\(scope, taskId\)[\s\S]*cachedTaskCenterLogs = await loadTaskLogs\(logTaskId\)[\s\S]*setLogs\(cachedTaskCenterLogs\)[\s\S]*dispatchTasksUpdated\('logs-cleared', tasks\)/.test(taskCenterState), 'task center state must wire user log clearing through confirmation, persistent backend deletion, refreshed visible logs, and a logs-cleared update event');
assert(/pub\(crate\) async fn run_parse_and_index_tasks\([\s\S]*tauri::async_runtime::spawn\(async move \{[\s\S]*tauri::async_runtime::spawn_blocking\(move \|\| \{[\s\S]*run_parse_and_index_tasks_with_events_in\(&runner_data_dir, &progress_emitter\)[\s\S]*task_statuses_for_ui\(&data_dir\)/.test(tauriCommands), 'parse/index command must detach indexing work onto a blocking worker and return task statuses immediately so the UI stays responsive');
assert(
  tauriCommands.includes('emit_task_progress')
    && tauriCommands.includes('"bookmind://task-progress"')
    && tauriCommands.includes('self.app.emit('),
  'parse/index background worker must stream task progress events back to the UI',
);

const taskCompletionRefreshPolicy = read('src/features/task-center/taskCompletionRefreshPolicy.ts');
[
  'getTaskCompletionRefreshPlan',
  'shouldDispatchLibraryRefreshAfterTaskCompletion',
  'shouldResetAiIndexStateAfterTaskRefresh',
  'shouldRefreshSearchResultsAfterTaskRefresh',
  'COMPLETION_SOURCE_STATUSES',
  'TERMINAL_STATUSES',
  'AI_INDEX_ERROR_KINDS',
].forEach((needle) => assertIncludes(taskCompletionRefreshPolicy, needle, 'src/features/task-center/taskCompletionRefreshPolicy.ts'));

const taskNotificationPolicy = read('src/features/task-center/taskNotificationPolicy.ts');
[
  'BackgroundTaskNotificationMode',
  'BackgroundTaskCompletionDetail',
  'buildBackgroundTaskCompletionMessage',
  'getCharacterCompletionToastAction',
  'shouldShowTaskCompletionToast',
  'failedCount',
  'character-extraction',
  "mode === 'silent'",
  "mode === 'system-notification' && systemNotificationShown",
].forEach((needle) => assertIncludes(taskNotificationPolicy, needle, 'src/features/task-center/taskNotificationPolicy.ts'));

const appSource = `${read('src/app/App.tsx')}\n${read('src/app/AppNotifications.tsx')}`;
const appTaskCenter = read('src/app/useTaskCenter.ts');
const appAiSessionActions = read('src/app/appAiSessionActions.ts');
const aiReaderDiagnosticsPanel = read('src/features/ai-reader/AiReaderDiagnosticsPanel.tsx');
[
  'taskCompletion.characterAction',
  "onOpenCharacters(taskCompletion.characterAction?.bookId ?? '')",
  "characters.toast.openCenter",
  'task-completion-toast',
].forEach((needle) => assertIncludes(appSource, needle, 'src/app/App.tsx'));
[
  'subscribeTasksCompleted',
  'extendedSettings.backgroundTaskNotificationMode',
  'notifyBackgroundTaskCompletion',
  'shouldResetAiIndexStateAfterTaskRefresh',
].forEach((needle) => assertIncludes(appTaskCenter, needle, 'src/app/useTaskCenter.ts'));

[
  'buildBackgroundTaskCompletionMessage',
  'getCharacterCompletionToastAction',
  'showSystemNotification',
  'shouldShowTaskCompletionToast',
].forEach((needle) => assertIncludes(appTaskActions, needle, 'src/app/appTaskActions.ts'));

const crossPageDiagnostics = {
  'src/pages/LibraryPage.tsx': ['loadSharedIndexDiagnostics', 'findBookIndexManifest', 'tasksUpdatedEvent'],
  'src/pages/SearchPage.tsx': ['loadSharedIndexDiagnostics', 'getBookIndexEmptyState', 'tasksUpdatedEvent', 'indexEmptyState', 'indexWarningState', 'noResultsIndexState', 'search-index-warning', 'shouldRefreshSearchResultsAfterTaskRefresh', 'taskRefreshToken'],
  'src/features/ai-reader/AiReaderPanel.tsx': ['status === \'no-index\'', 'ai.emptyCitations.noIndex'],
  'src/features/ai-reader/AiReaderDiagnosticsPanel.tsx': ['diagnostics.indexStatus', 'diagnostics.staleReason'],
  'src/app/App.tsx': ['openReaderFromSearch', 'autoIndexOpenedReaderBook'],
  'src/app/appAiSessionActions.ts': ['createBookIndexAiDiagnostics', 'diagnostics.errorKind', 'selectedBookIndexView.stale'],
  'src/features/task-center/IndexManifestBrowser.tsx': ['requestReaderLocationOpen'],
  'src/app/appTaskActions.ts': ['autoIndexOpenedReaderBook', 'rebuildBookIndex'],
};

for (const [file, needles] of Object.entries(crossPageDiagnostics)) {
  const source = read(file);
  needles.forEach((needle) => assertIncludes(source, needle, file));
}
const readerWorkspaceSource = read('src/pages/ReaderWorkspace.tsx');
assert(!readerWorkspaceSource.includes('reader-index-status-banner'), 'ReaderWorkspace must not render a top no-index banner in the reading scene');
assert(!/readerIndexing=\{readerIndexing \|\|/.test(readerWorkspaceSource), 'ReaderWorkspace must not treat an unavailable index as a running index task');
const searchPageSource = read('src/pages/SearchPage.tsx');
assert(/indexWarningState[\s\S]*search-index-warning[\s\S]*<div className="search-results">/.test(searchPageSource), 'SearchPage must render stale/failed index warning before results so stale matches cannot look fresh');
assert(/const noResultsIndexState = indexWarningState \? null : indexEmptyState/.test(searchPageSource), 'SearchPage must avoid repeating stale/failed index diagnostics in the no-results card when a warning is already shown');
assert(/results\.length === 0[\s\S]*noResultsIndexState/.test(searchPageSource), 'SearchPage must still render non-warning index empty state for no-result searches');
const taskCenterStyles = readCssWithImports('src/app/styles.css');
const indexManifestBrowserSource = read('src/features/task-center/IndexManifestBrowser.tsx');
assert(/className="task-detail-popover index-chunk-preview-popover"/.test(indexManifestBrowserSource) && /\.task-detail-popover\s*\{[^}]*position:\s*fixed/.test(taskCenterStyles), 'chunk preview panel must render as a standalone fixed interface');
assert(/\.index-chunk-preview-table\s*\{[^}]*grid-template-columns/.test(taskCenterStyles), 'chunk preview table must have a stable grid layout');

const zh = `${read('src/i18n/zh-CN.ts')}\n${read('src/i18n/messages/zhCN/tasks.ts')}\n${read('src/i18n/messages/zhCN/reader.ts')}`;
const en = `${read('src/i18n/en-US.ts')}\n${read('src/i18n/messages/enUS/tasks.ts')}\n${read('src/i18n/messages/enUS/reader.ts')}`;
[
  'tasks.commandCenter.title',
  'tasks.commandCenter.subtitle',
  'tasks.commandCenter.modules.queue',
  'tasks.commandCenter.modules.queueDescription',
  'tasks.commandCenter.modules.index',
  'tasks.commandCenter.modules.indexDescription',
  'tasks.commandCenter.modules.logs',
  'tasks.commandCenter.modules.logsDescription',
  'tasks.commandCenter.modules.resources',
  'tasks.commandCenter.modules.resourcesDescription',
  'tasks.commandCenter.commands.runParse',
  'tasks.commandCenter.commands.runParseDescription',
  'tasks.commandCenter.commands.importSample',
  'tasks.commandCenter.commands.importSampleDescription',
  'tasks.commandCenter.commands.pauseQueued',
  'tasks.commandCenter.commands.pauseQueuedDescription',
  'tasks.commandCenter.commands.retryFailed',
  'tasks.commandCenter.commands.retryFailedDescription',
  'tasks.commandCenter.commands.cancelQueued',
  'tasks.commandCenter.commands.cancelQueuedDescription',
  'tasks.commandCenter.commands.clearCompleted',
  'tasks.commandCenter.commands.clearCompletedDescription',
  'tasks.commandCenter.commands.validateIndexes',
  'tasks.commandCenter.commands.validateIndexesDescription',
  'tasks.commandCenter.commands.exportDiagnostics',
  'tasks.commandCenter.commands.exportDiagnosticsDescription',
  'tasks.commandCenter.insights.title',
  'tasks.commandCenter.insights.running',
  'tasks.commandCenter.insights.failed',
  'tasks.commandCenter.insights.stale',
  'tasks.commandCenter.insights.empty',
  'tasks.commandCenter.status.indexHealth',
  'tasks.commandCenter.status.recentLogs',
  'tasks.commandCenter.status.ftReady',
  'tasks.commandCenter.status.ftMissing',
  'tasks.health.running',
  'tasks.health.queued',
  'tasks.health.succeeded',
  'tasks.health.failed',
  'tasks.health.paused',
  'tasks.health.cancelled',
  'tasks.health.indexedBooks',
  'tasks.health.indexedChunks',
  'tasks.health.staleBooks',
  'tasks.logs.clearCurrent',
  'tasks.logs.clearCompleted',
  'tasks.logs.clearFailed',
  'tasks.logs.clearAll',
  'tasks.logs.copyVisible',
  'tasks.logs.exportJsonl',
  'tasks.logs.exportMarkdown',
  'tasks.logs.copyRecentErrors',
  'tasks.browserPreview.title',
  'tasks.browserPreview.description',
  'tasks.detail.title',
  'tasks.detail.copyDiagnosticJson',
  'tasks.indexBrowser.title',
  'tasks.indexBrowser.noSearchableContent',
  'tasks.indexBrowser.importEntry',
  'tasks.indexBrowser.statusFilter',
  'tasks.indexBrowser.statusAll',
  'tasks.indexBrowser.statusReady',
  'tasks.indexBrowser.statusMissing',
  'tasks.indexBrowser.statusStale',
  'tasks.indexBrowser.statusFailed',
  'tasks.indexBrowser.contentHash',
  'tasks.indexBrowser.previewChunks',
  'tasks.indexBrowser.chunkOrdinal',
  'tasks.indexBrowser.chapterTitle',
  'tasks.indexBrowser.paragraphRange',
  'tasks.indexBrowser.charRange',
  'tasks.indexBrowser.charCount',
  'tasks.indexBrowser.textPreview',
  'tasks.indexBrowser.jumpReader',
  'tasks.indexBrowser.copyChunk',
  'tasks.indexBrowser.chunkSearch',
  'tasks.indexBrowser.chapterFilter',
  'tasks.emptyGuide.importTxt',
  'tasks.emptyGuide.chooseDirectory',
  'tasks.emptyGuide.runSample',
  'tasks.emptyGuide.learnIndexArtifacts',
  'tasks.action.archive',
  'tasks.action.cancelQueued',
  'tasks.action.retryFailed',
  'tasks.action.pauseQueued',
  'tasks.action.rebuildIndex',
  'tasks.action.deleteIndex',
  'tasks.action.repairFts',
  'tasks.action.exportDiagnostics',
  'tasks.confirm.cancel',
  'tasks.confirm.archive',
  'tasks.confirm.clearCompleted',
  'tasks.confirm.cancelQueued',
  'tasks.confirm.retryFailed',
  'tasks.confirm.pauseQueued',
  'tasks.confirm.rebuildIndex',
  'tasks.confirm.deleteIndex',
  'tasks.confirm.repairFts',
  'tasks.confirm.clearLogs',
  'tasks.errorAdvice.file_missing',
  'tasks.errorAdvice.fts_write_failed',
  'reader.index.stale',
  'reader.index.staleShort',
  'reader.index.staleFallbackReason',
].forEach((key) => {
  assertIncludes(zh, `'${key}'`, 'src/i18n/zh-CN.ts');
  assertIncludes(en, `'${key}'`, 'src/i18n/en-US.ts');
});

if (failures.length > 0) {
  console.error('Task center contract verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Task center contracts verified.');

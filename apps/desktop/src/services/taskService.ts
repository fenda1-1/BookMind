import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Book, BookIndexManifest, IndexDiagnostics, IndexedChunksPreview, TaskError, TaskKind, TaskLogRecord, TaskOutputSummary, TaskRunStatus, TaskStage, TaskStatus } from '../types';
import { emitTasksCompleted, emitTasksUpdated, type TaskUpdateReason } from './appDomainEvents';

type RawTaskStatus = Partial<TaskStatus> & {
  status?: string;
  kind?: string;
  stage?: string;
  book_id?: string;
  dag_id?: string;
  depends_on?: unknown;
  blocked_by?: unknown;
};

type RawIndexDiagnostics = Partial<IndexDiagnostics> & Partial<IndexDiagnostics['summary']> & {
  parsingCount?: number;
};

type RawTaskProgressEvent = {
  reason?: string;
  status?: RawTaskStatus;
};

type AiSidecarHealthResult = {
  sidecarStatus: 'not-configured' | 'available' | 'unavailable' | 'error';
  message: string;
  version: string;
  capabilities: string[];
  checkedAt: string;
};

const TERMINAL_STATUSES: TaskRunStatus[] = ['succeeded', 'skipped', 'cancelled', 'failed', 'archived'];
const BACKGROUND_POLL_STATUSES: TaskRunStatus[] = ['queued', 'running', 'cancelling'];
const COMPLETION_NOTIFICATION_SOURCE_STATUSES: TaskRunStatus[] = ['running', 'cancelling'];
const TASK_PROGRESS_EVENT_FLUSH_MS = 250;
const dispatchedCompletionKeys = new Set<string>();
let runParseAndIndexTasksInFlight: Promise<TaskStatus[]> | null = null;
export type { TaskUpdateReason } from './appDomainEvents';
export type RunTasksUpdatePlan = {
  reason: Extract<TaskUpdateReason, 'task-started' | 'task-completed' | 'task-failed'>;
  hasLiveTasks: boolean;
};

export type StartupTaskResumePlan = {
  shouldResume: boolean;
  hasLiveTasks: boolean;
};

export type IdleQueuedTaskAutoRunPlan = {
  shouldRun: boolean;
  queuedCount: number;
};

export type IndexPauseResumeStrategy = 'manual' | 'ask' | 'auto';

export type DatabaseIndexMaintenancePayload = {
  databasePath: string;
  reindexed: boolean;
  analyzed: boolean;
  ftsOptimized: boolean;
  chunkCount: number;
  ftsRowCount: number;
};

export type DatabaseVacuumPayload = {
  databasePath: string;
  vacuumed: boolean;
  sizeBeforeBytes: number;
  sizeAfterBytes: number;
  bytesReclaimed: number;
  chunkCount: number;
  ftsRowCount: number;
};

export type TaskProgressEvent = {
  reason: string;
  status: TaskStatus;
};
const EMPTY_OUTPUT_SUMMARY: TaskOutputSummary = {
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
};

export function normalizeRunStatus(status: unknown): TaskRunStatus {
  if (status === 'done' || status === 'completed') return 'succeeded';
  if (
    status === 'queued' ||
    status === 'running' ||
    status === 'paused' ||
    status === 'cancelling' ||
    status === 'cancelled' ||
    status === 'failed' ||
    status === 'succeeded' ||
    status === 'skipped' ||
    status === 'archived'
  ) {
    return status;
  }
  return 'queued';
}

function normalizeTaskKind(kind: unknown): TaskKind {
  if (
    kind === 'import-directory' ||
    kind === 'import-book' ||
    kind === 'parse-and-index' ||
    kind === 'rebuild-index' ||
    kind === 'full-text-index' ||
    kind === 'cleanup-index' ||
    kind === 'export-data' ||
    kind === 'embedding-index' ||
    kind === 'ai-summary' ||
    kind === 'backup' ||
    kind === 'diagnostics' ||
    kind === 'character-extraction'
  ) {
    return kind;
  }
  return 'parse-and-index';
}

function normalizeTaskStage(stage: unknown, status: TaskRunStatus): TaskStage {
  if (
    stage === 'queued' ||
    stage === 'read-file' ||
    stage === 'parse-chapters' ||
    stage === 'build-chunks' ||
    stage === 'write-chunks' ||
    stage === 'write-fts' ||
    stage === 'verify' ||
    stage === 'done'
  ) {
    return stage;
  }
  return status === 'succeeded' || status === 'skipped' ? 'done' : 'queued';
}

function toneForStatus(status: TaskRunStatus): TaskStatus['tone'] {
  if (status === 'running' || status === 'cancelling') return 'indigo';
  if (status === 'paused') return 'violet';
  if (status === 'failed' || status === 'cancelled') return 'cinnabar';
  if (status === 'succeeded' || status === 'skipped' || status === 'archived') return 'sage';
  return 'amber';
}

export function getTaskStageLabel(stage: TaskStage) {
  const labels: Record<TaskStage, string> = {
    queued: '排队中',
    'read-file': '读取文件',
    'parse-chapters': '解析章节',
    'build-chunks': '生成 chunks',
    'write-chunks': '写入 chunk store',
    'write-fts': '写入 FTS',
    verify: '校验索引',
    done: '保存 metadata',
  };
  return labels[stage];
}

export function getTaskStageLabelForKind(kind: TaskKind, stage: TaskStage) {
  if (kind === 'character-extraction') {
    const labels: Partial<Record<TaskStage, string>> = {
      'read-file': '读取全文索引',
      'build-chunks': '扫描人物',
      'write-chunks': '写入人物索引',
      verify: '校验人物索引',
      done: '保存人物索引',
    };
    return labels[stage] ?? getTaskStageLabel(stage);
  }
  return getTaskStageLabel(stage);
}

export function normalizeTaskStatus(raw: RawTaskStatus): TaskStatus {
  const status = normalizeRunStatus(raw.status);
  const kind = normalizeTaskKind(raw.kind);
  const stage = normalizeTaskStage(raw.stage, status);
  const rawOutputSummary: Partial<TaskOutputSummary> = raw.outputSummary ?? {};
  const outputSummary = {
    ...EMPTY_OUTPUT_SUMMARY,
    ...rawOutputSummary,
    stageDurationsMs: {
      ...EMPTY_OUTPUT_SUMMARY.stageDurationsMs,
      ...(rawOutputSummary.stageDurationsMs ?? {}),
    },
  };
  return {
    id: String(raw.id ?? ''),
    kind,
    name: String(raw.name ?? raw.message ?? 'Parse and index'),
    status,
    progress: Number(raw.progress ?? (status === 'succeeded' ? 100 : 0)),
    stage,
    stageLabel: raw.stageLabel ?? getTaskStageLabelForKind(kind, stage),
    tone: raw.tone ?? toneForStatus(status),
    message: String(raw.message ?? ''),
    bookId: String(raw.bookId ?? raw.book_id ?? ''),
    bookTitle: String(raw.bookTitle ?? ''),
    fileName: String(raw.fileName ?? ''),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    startedAt: String(raw.startedAt ?? ''),
    finishedAt: String(raw.finishedAt ?? ''),
    durationMs: Number(raw.durationMs ?? 0),
    attempt: Number(raw.attempt ?? 0),
    maxAttempts: Number(raw.maxAttempts ?? 3),
    errorCode: String(raw.errorCode ?? ''),
    errorMessage: String(raw.errorMessage ?? ''),
    logCount: Number(raw.logCount ?? 0),
    dagId: String(raw.dagId ?? raw.dag_id ?? ''),
    dependsOn: normalizeStringList(raw.dependsOn ?? raw.depends_on),
    blockedBy: normalizeStringList(raw.blockedBy ?? raw.blocked_by),
    outputSummary,
    error: normalizeTaskError(raw.error, raw.errorCode, raw.errorMessage, stage),
  };
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export function mergeTaskStatusRows(previous: TaskStatus[], next: TaskStatus[]): TaskStatus[] {
  if (previous.length === 0) return next;
  const previousById = new Map(previous.map((task) => [task.id, task]));
  let changed = previous.length !== next.length;
  const merged = next.map((task) => {
    const current = previousById.get(task.id);
    if (current && isOlderTaskStatusRow(task, current)) {
      return current;
    }
    const nextTask = current ? preserveSnapshotOnlyTaskFields(current, task) : task;
    if (current && areTaskStatusRowsEqual(current, nextTask)) {
      return current;
    }
    changed = true;
    return nextTask;
  });
  return changed ? merged : previous;
}

export function mergeTaskProgressEventStatus(previous: TaskStatus[], nextTask: TaskStatus): TaskStatus[] {
  const existingIndex = previous.findIndex((task) => task.id === nextTask.id);
  if (existingIndex < 0) return [...previous, nextTask];
  const existingTask = previous[existingIndex];
  if (isOlderTaskStatusRow(nextTask, existingTask)) return previous;
  const mergedTask = preserveSnapshotOnlyTaskFields(existingTask, nextTask);
  if (areTaskStatusRowsEqual(existingTask, mergedTask)) return previous;
  return previous.map((task, index) => index === existingIndex ? mergedTask : task);
}

function areTaskStatusRowsEqual(left: TaskStatus, right: TaskStatus) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isOlderTaskStatusRow(candidate: TaskStatus, current: TaskStatus) {
  const candidateUpdatedAt = Number(candidate.updatedAt || 0);
  const currentUpdatedAt = Number(current.updatedAt || 0);
  return candidateUpdatedAt > 0 && currentUpdatedAt > 0 && candidateUpdatedAt < currentUpdatedAt;
}

function preserveSnapshotOnlyTaskFields(current: TaskStatus, next: TaskStatus): TaskStatus {
  if (current.logCount <= 0 || next.logCount > 0) return next;
  return { ...next, logCount: current.logCount };
}

function normalizeTaskError(raw: unknown, fallbackCode: unknown, fallbackMessage: unknown, fallbackStage: TaskStage): TaskError {
  const source = raw && typeof raw === 'object' ? raw as Partial<TaskError> : {};
  const code = String(source.code ?? fallbackCode ?? '');
  const message = String(source.message ?? fallbackMessage ?? '');
  return {
    code,
    message,
    stage: normalizeTaskStage(source.stage ?? fallbackStage, code ? 'failed' : 'queued'),
    retryable: typeof source.retryable === 'boolean' ? source.retryable : code !== 'cancelled_by_user',
    detail: source.detail && typeof source.detail === 'object' && !Array.isArray(source.detail) ? source.detail as Record<string, unknown> : {},
  };
}

export async function loadTaskStatuses(): Promise<TaskStatus[]> {
  try {
    const tasks = await invoke<RawTaskStatus[]>('get_task_statuses');
    return tasks.map(normalizeTaskStatus);
  } catch (error) {
    console.warn('Using empty task list because Tauri task command failed:', error);
    return [];
  }
}

export function getUnfinishedTaskStatuses(tasks: TaskStatus[]): TaskStatus[] {
  return tasks.filter((task) => !TERMINAL_STATUSES.includes(task.status));
}

export function getRunTasksUpdatePlan(tasks: TaskStatus[]): RunTasksUpdatePlan {
  if (tasks.some((task) => BACKGROUND_POLL_STATUSES.includes(task.status))) {
    return { reason: 'task-started', hasLiveTasks: true };
  }
  return {
    reason: tasks.some((task) => task.status === 'failed') ? 'task-failed' : 'task-completed',
    hasLiveTasks: false,
  };
}

export function getStartupTaskResumePlan(tasks: TaskStatus[], pauseResumeStrategy: IndexPauseResumeStrategy = 'manual'): StartupTaskResumePlan {
  const resumableStatuses = pauseResumeStrategy === 'auto'
    ? [...BACKGROUND_POLL_STATUSES, 'paused' as TaskRunStatus]
    : BACKGROUND_POLL_STATUSES;
  const shouldResume = tasks.some((task) => resumableStatuses.includes(task.status));
  return { shouldResume, hasLiveTasks: shouldResume };
}

export function getIdleQueuedTaskAutoRunPlan(tasks: TaskStatus[], enabled: boolean): IdleQueuedTaskAutoRunPlan {
  const queuedCount = tasks.filter((task) => task.status === 'queued').length;
  const hasLiveTasks = tasks.some((task) => BACKGROUND_POLL_STATUSES.includes(task.status) && task.status !== 'queued');
  return {
    shouldRun: enabled && queuedCount > 0 && !hasLiveTasks,
    queuedCount,
  };
}

export function normalizeTaskProgressEvent(raw: RawTaskProgressEvent): TaskProgressEvent {
  return {
    reason: String(raw.reason ?? 'stage-updated'),
    status: normalizeTaskStatus(raw.status ?? {}),
  };
}

export function createTaskProgressEventBatcher(onProgress: (events: TaskProgressEvent[]) => void) {
  let queuedEvents: TaskProgressEvent[] = [];
  let flushTimer: number | null = null;

  function flush() {
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (queuedEvents.length === 0) return;
    const events = queuedEvents;
    queuedEvents = [];
    onProgress(events);
  }

  return {
    push(event: TaskProgressEvent) {
      queuedEvents.push(event);
      if (flushTimer === null) {
        flushTimer = window.setTimeout(flush, TASK_PROGRESS_EVENT_FLUSH_MS);
      }
    },
    dispose() {
      flush();
    },
  };
}

export async function subscribeTaskProgressEvents(onProgress: (events: TaskProgressEvent[]) => void): Promise<() => void> {
  const batcher = createTaskProgressEventBatcher(onProgress);
  const unlisten = await listen<RawTaskProgressEvent>('bookmind://task-progress', (event) => {
    batcher.push(normalizeTaskProgressEvent(event.payload));
  });
  return () => {
    batcher.dispose();
    unlisten();
  };
}

export function getRunningToTerminalTasks(previous: TaskStatus[], next: TaskStatus[]): TaskStatus[] {
  const previousById = new Map(previous.map((task) => [task.id, task]));
  return next.filter((task) => {
    const previousTask = previousById.get(task.id);
    return Boolean(
      previousTask &&
      COMPLETION_NOTIFICATION_SOURCE_STATUSES.includes(previousTask.status) &&
      TERMINAL_STATUSES.includes(task.status),
    );
  });
}

export async function runParseAndIndexTasks(): Promise<TaskStatus[]> {
  if (runParseAndIndexTasksInFlight) return runParseAndIndexTasksInFlight;
  runParseAndIndexTasksInFlight = invoke<RawTaskStatus[]>('run_parse_and_index_tasks')
    .then((tasks) => tasks.map(normalizeTaskStatus))
    .catch(async (error) => {
      if (isTauriCallbackGoneError(error)) {
        return await loadTaskStatuses();
      }
      throw error;
    })
    .finally(() => { runParseAndIndexTasksInFlight = null; });
  return runParseAndIndexTasksInFlight;
}

function isTauriCallbackGoneError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Couldn't find callback id");
}

export async function resumePausedTasksAndRun(taskIds: string[]): Promise<TaskStatus[]> {
  const uniqueIds = Array.from(new Set(taskIds.filter(Boolean)));
  for (const taskId of uniqueIds) {
    await retryTask(taskId);
  }
  return await runParseAndIndexTasks();
}

export function dispatchTasksCompleted(tasks: TaskStatus[], previousTasks: TaskStatus[]) {
  const completedTasks = getRunningToTerminalTasks(previousTasks, tasks).filter((task) => {
    const key = taskCompletionKey(task);
    if (dispatchedCompletionKeys.has(key)) return false;
    dispatchedCompletionKeys.add(key);
    return true;
  });
  if (!completedTasks.length) return;
  emitTasksCompleted({ count: completedTasks.length, tasks: completedTasks });
}

function taskCompletionKey(task: TaskStatus) {
  return [task.id, task.status, task.finishedAt, task.attempt].join(':');
}

export function dispatchTasksUpdated(reason: TaskUpdateReason, tasks: TaskStatus[]) {
  emitTasksUpdated({
    reason,
    bookIds: [...new Set(tasks.map((task) => task.bookId).filter(Boolean))],
    taskIds: tasks.map((task) => task.id),
  });
}

const emptyIndexDiagnostics: IndexDiagnostics = {
  summary: {
    queuedCount: 0,
    runningCount: 0,
    succeededCount: 0,
    failedCount: 0,
    pausedCount: 0,
    cancelledCount: 0,
    staleBookCount: 0,
    indexedChunkCount: 0,
    indexedBookCount: 0,
    ftsAvailable: false,
    ftsDatabasePath: '',
    ftsDatabaseSizeBytes: 0,
    ftsDatabaseModifiedAt: '',
    recentError: '',
    recentErrors: [],
    sidecarStatus: 'not-configured',
    sidecarMessage: '',
    sidecarVersion: '',
    sidecarCapabilities: [],
    sidecarCheckedAt: '',
    sidecarErrorCode: '',
    vectorIndexStatus: 'not-built',
    vectorIndexedBookCount: 0,
    vectorIndexedChunkCount: 0,
    vectorProvider: '',
    vectorDimension: 0,
    vectorLastBuiltAt: '',
    vectorLastError: '',
  },
  books: [],
};

function normalizeSidecarStatus(status: unknown): IndexDiagnostics['summary']['sidecarStatus'] {
  if (status === 'available' || status === 'unavailable' || status === 'error') return status;
  return 'not-configured';
}

function normalizeSidecarCapability(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (/^[a-z0-9._:-]{1,64}$/i.test(normalized) && !isLikelyLocalPath(normalized)) {
    return normalized;
  }
  return '';
}

function normalizeSidecarVersion(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return /^[a-z0-9._:+-]{1,64}$/i.test(normalized) ? normalized : '';
}

function normalizeSidecarCheckedAt(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return /^[0-9TZ:.\-+]{1,64}$/i.test(normalized) ? normalized : '';
}

function deriveSidecarErrorCode(status: IndexDiagnostics['summary']['sidecarStatus'], message: unknown): string {
  if (status !== 'error') return '';
  const normalized = String(message ?? '').toLowerCase();
  const classified = normalized.match(/\((not-found|permission-denied|invalid-command|invalid-json|process-exited|spawn-failed|timeout|timed-out)\)/);
  if (classified?.[1]) return classified[1] === 'timed-out' ? 'timeout' : classified[1];
  if (normalized.includes('not found') || normalized.includes('not-found')) return 'not-found';
  if (normalized.includes('permission')) return 'permission-denied';
  if (normalized.includes('timeout') || normalized.includes('timed out')) return 'timeout';
  if (normalized.includes('invalid-json') || normalized.includes('not valid json')) return 'invalid-json';
  if (normalized.includes('process-exited') || normalized.includes('exited with an error')) return 'process-exited';
  if (normalized.includes('invalid')) return 'invalid-command';
  return 'sidecar-health-error';
}

function isLikelyLocalPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\//.test(value);
}

function safeSidecarMessage(status: IndexDiagnostics['summary']['sidecarStatus'], errorCode: string) {
  if (status === 'available') return 'AI sidecar health check succeeded.';
  if (status === 'not-configured') return 'Python sidecar is not configured; SQLite FTS remains active.';
  if (status === 'error') return `AI sidecar health check failed${errorCode ? ` (${errorCode})` : ''}.`;
  return 'AI sidecar health check is unavailable.';
}

export function normalizeSidecarHealthForIndexDiagnostics(health: Partial<AiSidecarHealthResult> | null | undefined): Partial<IndexDiagnostics['summary']> {
  const sidecarStatus = normalizeSidecarStatus(health?.sidecarStatus);
  const sidecarErrorCode = deriveSidecarErrorCode(sidecarStatus, health?.message);
  const sidecarCapabilities = Array.from(new Set((Array.isArray(health?.capabilities) ? health.capabilities : [])
    .map(normalizeSidecarCapability)
    .filter(Boolean)));
  return {
    sidecarStatus,
    sidecarMessage: safeSidecarMessage(sidecarStatus, sidecarErrorCode),
    sidecarVersion: normalizeSidecarVersion(health?.version),
    sidecarCapabilities,
    sidecarCheckedAt: normalizeSidecarCheckedAt(health?.checkedAt),
    sidecarErrorCode,
  };
}

export async function loadSidecarHealthForIndexDiagnostics(): Promise<Partial<IndexDiagnostics['summary']>> {
  try {
    return normalizeSidecarHealthForIndexDiagnostics(await checkAiSidecarHealth());
  } catch {
    return normalizeSidecarHealthForIndexDiagnostics({
      sidecarStatus: 'error',
      message: 'AI sidecar health check failed (command-unavailable).',
      version: '',
      capabilities: [],
      checkedAt: '',
    });
  }
}

async function checkAiSidecarHealth(): Promise<AiSidecarHealthResult> {
  return await invoke<AiSidecarHealthResult>('check_ai_sidecar_health');
}

function normalizeVectorIndexStatus(status: unknown): IndexDiagnostics['summary']['vectorIndexStatus'] {
  if (status === 'building' || status === 'ready' || status === 'stale' || status === 'failed') return status;
  return 'not-built';
}

export function normalizeIndexDiagnostics(raw: RawIndexDiagnostics | null | undefined, sidecarHealth: Partial<IndexDiagnostics['summary']> = {}): IndexDiagnostics {
  if (!raw) return emptyIndexDiagnostics;
  const summarySource = raw.summary ?? raw;
  const normalizedSidecarHealth = sidecarHealth ?? {};
  const books = Array.isArray(raw.books) ? raw.books : [];
  return {
    summary: {
      queuedCount: Number(summarySource.queuedCount ?? 0),
      runningCount: Number(summarySource.runningCount ?? raw.parsingCount ?? 0),
      succeededCount: Number(summarySource.succeededCount ?? 0),
      failedCount: Number(summarySource.failedCount ?? 0),
      pausedCount: Number(summarySource.pausedCount ?? 0),
      cancelledCount: Number(summarySource.cancelledCount ?? 0),
      staleBookCount: Number(summarySource.staleBookCount ?? books.filter((book: BookIndexManifest) => book.status === 'stale').length),
      indexedChunkCount: Number(summarySource.indexedChunkCount ?? 0),
      indexedBookCount: Number(summarySource.indexedBookCount ?? 0),
      ftsAvailable: Boolean(summarySource.ftsAvailable),
      ftsDatabasePath: String(summarySource.ftsDatabasePath ?? ''),
      ftsDatabaseSizeBytes: Number(summarySource.ftsDatabaseSizeBytes ?? 0),
      ftsDatabaseModifiedAt: String(summarySource.ftsDatabaseModifiedAt ?? ''),
      recentError: String(summarySource.recentError ?? ''),
      recentErrors: Array.isArray(summarySource.recentErrors) ? summarySource.recentErrors.map(String) : [],
      sidecarStatus: normalizeSidecarStatus(normalizedSidecarHealth.sidecarStatus ?? summarySource.sidecarStatus),
      sidecarMessage: String(normalizedSidecarHealth.sidecarMessage ?? summarySource.sidecarMessage ?? ''),
      sidecarVersion: String(normalizedSidecarHealth.sidecarVersion ?? summarySource.sidecarVersion ?? ''),
      sidecarCapabilities: Array.isArray(normalizedSidecarHealth.sidecarCapabilities)
        ? Array.from(new Set(normalizedSidecarHealth.sidecarCapabilities.map(normalizeSidecarCapability).filter(Boolean)))
        : Array.isArray(summarySource.sidecarCapabilities)
          ? Array.from(new Set(summarySource.sidecarCapabilities.map(normalizeSidecarCapability).filter(Boolean)))
          : [],
      sidecarCheckedAt: String(normalizedSidecarHealth.sidecarCheckedAt ?? summarySource.sidecarCheckedAt ?? ''),
      sidecarErrorCode: String(normalizedSidecarHealth.sidecarErrorCode ?? summarySource.sidecarErrorCode ?? ''),
      vectorIndexStatus: normalizeVectorIndexStatus(summarySource.vectorIndexStatus),
      vectorIndexedBookCount: Number(summarySource.vectorIndexedBookCount ?? 0),
      vectorIndexedChunkCount: Number(summarySource.vectorIndexedChunkCount ?? 0),
      vectorProvider: String(summarySource.vectorProvider ?? ''),
      vectorDimension: Number(summarySource.vectorDimension ?? 0),
      vectorLastBuiltAt: String(summarySource.vectorLastBuiltAt ?? ''),
      vectorLastError: String(summarySource.vectorLastError ?? ''),
    },
    books,
  };
}

export async function loadIndexDiagnostics(): Promise<IndexDiagnostics> {
  if (!canUseTauriTaskCommands()) return emptyIndexDiagnostics;
  const [diagnostics, sidecarHealth] = await Promise.all([
    invoke<RawIndexDiagnostics>('get_index_diagnostics'),
    loadSidecarHealthForIndexDiagnostics(),
  ]);
  return normalizeIndexDiagnostics(diagnostics, sidecarHealth);
}

function canUseTauriTaskCommands() {
  return typeof window !== 'undefined' && Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function validateAllIndexes(): Promise<IndexDiagnostics> {
  const diagnostics = await invoke<RawIndexDiagnostics>('validate_all_indexes');
  return normalizeIndexDiagnostics(diagnostics);
}

export async function rebuildDatabaseIndexes(): Promise<DatabaseIndexMaintenancePayload> {
  return await invoke<DatabaseIndexMaintenancePayload>('rebuild_database_indexes');
}

export async function vacuumDatabase(): Promise<DatabaseVacuumPayload> {
  return await invoke<DatabaseVacuumPayload>('vacuum_database');
}

export async function importDevSampleBookAndIndex(): Promise<Book> {
  return await invoke<Book>('import_dev_sample_book_and_index');
}

export async function pauseTask(taskId: string): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('pause_task', { taskId });
  return tasks.map(normalizeTaskStatus);
}

export async function cancelTask(taskId: string): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('cancel_task', { taskId });
  return tasks.map(normalizeTaskStatus);
}

export async function retryTask(taskId: string): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('retry_task', { taskId });
  return tasks.map(normalizeTaskStatus);
}

export async function cancelQueuedTasks(): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('cancel_queued_tasks');
  return tasks.map(normalizeTaskStatus);
}

export async function retryFailedTasks(): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('retry_failed_tasks');
  return tasks.map(normalizeTaskStatus);
}

export async function pauseQueuedTasks(): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('pause_queued_tasks');
  return tasks.map(normalizeTaskStatus);
}

export async function loadTaskLogs(taskId?: string, limit = 200, offset = 0): Promise<TaskLogRecord[]> {
  try {
    return await invoke<TaskLogRecord[]>('load_task_logs', { taskId: taskId ?? null, limit, offset });
  } catch (error) {
    console.warn('Using empty task logs because Tauri task log command failed:', error);
    return [];
  }
}

export async function clearTaskLogs(scope: 'all' | 'completed' | 'failed' | 'task', taskId?: string): Promise<number> {
  try {
    return await invoke<number>('clear_task_logs', { scope, taskId: taskId ?? null });
  } catch (error) {
    console.warn('Task log clearing is unavailable in this runtime:', error);
    return 0;
  }
}

export async function applyTaskLogRetention(retentionDays: number): Promise<number> {
  try {
    return await invoke<number>('apply_task_log_retention', { retentionDays });
  } catch (error) {
    console.warn('Task log retention is unavailable in this runtime:', error);
    return 0;
  }
}

export async function applyTaskRetention(completedLimit: number): Promise<number> {
  try {
    return await invoke<number>('apply_task_retention', { completedLimit });
  } catch (error) {
    console.warn('Task retention is unavailable in this runtime:', error);
    return 0;
  }
}

export async function clearCompletedTasks(): Promise<TaskStatus[]> {
  try {
    const tasks = await invoke<RawTaskStatus[]>('clear_completed_tasks');
    return tasks.map(normalizeTaskStatus);
  } catch (error) {
    console.warn('Completed task clearing is unavailable in this runtime:', error);
    return await loadTaskStatuses();
  }
}

export async function archiveTask(taskId: string): Promise<TaskStatus[]> {
  try {
    const tasks = await invoke<RawTaskStatus[]>('archive_task', { taskId });
    return tasks.map(normalizeTaskStatus);
  } catch (error) {
    console.warn('Task archiving is unavailable in this runtime:', error);
    return await loadTaskStatuses();
  }
}

export async function restoreArchivedTask(taskId: string): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('restore_archived_task', { taskId });
  return tasks.map(normalizeTaskStatus);
}

export async function rebuildBookIndex(bookId: string): Promise<TaskStatus[]> {
  const tasks = await invoke<RawTaskStatus[]>('rebuild_book_index', { bookId });
  return tasks.map(normalizeTaskStatus);
}

export async function deleteBookIndex(bookId: string): Promise<IndexDiagnostics> {
  const diagnostics = await invoke<RawIndexDiagnostics>('delete_book_index', { bookId });
  return normalizeIndexDiagnostics(diagnostics);
}

export async function repairBookFts(bookId: string): Promise<IndexDiagnostics> {
  const diagnostics = await invoke<RawIndexDiagnostics>('repair_book_fts', { bookId });
  return normalizeIndexDiagnostics(diagnostics);
}

export async function loadIndexedChunksPreview(bookId: string, limit = 20, offset = 0, query = '', chapterIndex?: number): Promise<IndexedChunksPreview> {
  const preview = await invoke<Partial<IndexedChunksPreview>>('get_indexed_chunks_preview', {
    bookId,
    limit,
    offset,
    query,
    chapterIndex,
  });
  return normalizeIndexedChunksPreview(preview);
}

export function normalizeIndexedChunksPreview(raw: Partial<IndexedChunksPreview> | null | undefined): IndexedChunksPreview {
  return {
    bookId: String(raw?.bookId ?? ''),
    total: Number(raw?.total ?? 0),
    limit: Number(raw?.limit ?? 20),
    offset: Number(raw?.offset ?? 0),
    items: Array.isArray(raw?.items) ? raw.items.map((item) => ({
      chunkId: String(item.chunkId ?? ''),
      ordinal: Number(item.ordinal ?? 0),
      chapterIndex: Number(item.chapterIndex ?? 0),
      chapterTitle: String(item.chapterTitle ?? ''),
      paragraphStart: Number(item.paragraphStart ?? 0),
      paragraphEnd: Number(item.paragraphEnd ?? 0),
      paragraphRange: String(item.paragraphRange ?? ''),
      charStart: Number(item.charStart ?? 0),
      charEnd: Number(item.charEnd ?? 0),
      sourceChapterIndex: Number(item.sourceChapterIndex ?? item.chapterIndex ?? 0),
      paragraphIndex: Number(item.paragraphIndex ?? item.paragraphStart ?? 0),
      startOffset: Number(item.startOffset ?? 0),
      endOffset: Number(item.endOffset ?? item.charCount ?? 0),
      charCount: Number(item.charCount ?? 0),
      textPreview: String(item.textPreview ?? ''),
      fullText: String(item.fullText ?? ''),
      readerLocation: String(item.readerLocation ?? ''),
    })) : [],
  };
}

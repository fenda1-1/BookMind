import {
  dispatchTasksCompleted,
  dispatchTasksUpdated,
  getIdleQueuedTaskAutoRunPlan,
  getRunTasksUpdatePlan,
  loadTaskStatuses,
  rebuildBookIndex,
  resumePausedTasksAndRun,
  runParseAndIndexTasks,
  mergeTaskProgressEventStatus,
} from '../services/taskService';
import { queueCharacterExtraction } from '../services/characterCenterService';
import { emitLibraryUpdated } from '../services/appDomainEvents';
import type { getBookIndexView } from '../services/indexDiagnosticsService';
import { loadExtendedSettings, type ExtendedSettings } from '../services/settingsCenterService';
import type { AppPage, Book, CharacterCenterBookSummary, IndexDiagnostics, TaskStatus } from '../types';
import { buildBackgroundTaskCompletionMessage, getCharacterCompletionToastAction, shouldShowTaskCompletionToast } from '../features/task-center/taskNotificationPolicy';
import { showTaskCenterForLongOperation } from './appShellModel';

export type BackgroundTaskCompletionDetail = { count?: number; tasks?: TaskStatus[] };
export type TaskCompletionToastSetter = (toast: { message: string; characterAction?: { bookId: string } | null } | null) => void;

export type AppTaskActionContext = {
  extendedSettings: ExtendedSettings;
  setActivePage: (page: AppPage) => void;
  setLatestTaskSnapshot: (tasks: TaskStatus[]) => void;
  setBackgroundTaskRunning: (running: boolean) => void;
  refreshIndexDiagnostics: () => void | Promise<void>;
  refreshCharacterBookSummaries: () => void | Promise<void>;
  refreshCharacterOverviewSnapshot: (bookId: string | null) => void | Promise<void>;
  refreshCharacterPayload: (bookId: string | null) => void | Promise<void>;
};

type AutoIndexKeyRef = { current: Set<string> };

export function liveCharacterTaskOverlay(summary: CharacterCenterBookSummary, tasks: TaskStatus[]): Partial<CharacterCenterBookSummary> {
  const task = tasks
    .filter((item) => item.bookId === summary.id && item.kind === 'character-extraction')
    .sort((left, right) => taskStatusSortMillis(right) - taskStatusSortMillis(left))[0];
  if (!task) return {};
  if (task.status === 'queued' || task.status === 'paused') {
    return { characterIndexStatus: 'queued', lastTaskId: task.id, recentLogEntry: task.message };
  }
  if (task.status === 'running' || task.status === 'cancelling') {
    return { characterIndexStatus: 'building', lastTaskId: task.id, recentLogEntry: task.message };
  }
  if (task.status === 'failed') {
    return {
      characterIndexStatus: 'failed',
      lastTaskId: task.id,
      lastError: task.errorMessage || task.error.message || summary.lastError,
      errorCode: task.errorCode || task.error.code,
      errorStage: task.error.stage || task.stage,
      recentLogEntry: task.message,
    };
  }
  if (task.status === 'succeeded') {
    return {
      characterIndexStatus: 'ready',
      lastTaskId: task.id,
      lastError: '',
      errorCode: '',
      errorStage: '',
      recentLogEntry: task.message,
    };
  }
  return {};
}

export function localCharacterExtractionOverlay(
  summary: CharacterCenterBookSummary,
  localCharacterExtractionBookId: string | null,
  tasks: TaskStatus[],
): Partial<CharacterCenterBookSummary> {
  if (!localCharacterExtractionBookId || summary.id !== localCharacterExtractionBookId) return {};
  const liveOverlay = liveCharacterTaskOverlay(summary, tasks);
  return liveOverlay.characterIndexStatus === 'queued' || liveOverlay.characterIndexStatus === 'building'
    ? liveOverlay
    : {};
}

export function shouldAutoIndexOpenedReaderBook(
  book: Book,
  indexView: ReturnType<typeof getBookIndexView>,
  diagnostics: IndexDiagnostics | null,
) {
  if (!book.id || book.deleted) return false;
  if (!diagnostics) return false;
  return indexView.missing || indexView.failed || indexView.stale;
}

export async function notifyBackgroundTaskCompletion(
  mode: ExtendedSettings['backgroundTaskNotificationMode'],
  detail: BackgroundTaskCompletionDetail | undefined,
  setToast: TaskCompletionToastSetter,
) {
  const message = buildBackgroundTaskCompletionMessage(detail);
  const characterAction = getCharacterCompletionToastAction(detail);
  const systemNotificationShown = mode === 'system-notification'
    ? await showSystemNotification('BookMind 后台任务完成', message)
    : false;
  if (shouldShowTaskCompletionToast(mode, systemNotificationShown)) setToast({ message, characterAction });
}

export function handleTaskProgressEventStatus(
  previousTasks: TaskStatus[],
  eventStatus: TaskStatus,
  context: AppTaskActionContext,
  latestExtendedSettings = loadExtendedSettings(),
) {
  const nextTasks = mergeTaskProgressEventStatus(previousTasks, eventStatus);
  const backgroundRunTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
  context.setLatestTaskSnapshot(nextTasks);
  dispatchTasksCompleted(nextTasks, previousTasks);
  dispatchTasksUpdated(backgroundRunTasksUpdatePlan.reason, nextTasks);
  if (!backgroundRunTasksUpdatePlan.hasLiveTasks && latestExtendedSettings.refreshLibraryOnTaskCompletion) {
    emitLibraryUpdated();
    void context.refreshIndexDiagnostics();
    void context.refreshCharacterBookSummaries();
    context.setBackgroundTaskRunning(false);
  }
  return nextTasks;
}

export function handleTaskProgressEventBatch(
  previousTasks: TaskStatus[],
  eventStatuses: TaskStatus[],
  context: AppTaskActionContext,
  latestExtendedSettings = loadExtendedSettings(),
) {
  let nextTasks = previousTasks;
  for (const eventStatus of eventStatuses) {
    nextTasks = mergeTaskProgressEventStatus(nextTasks, eventStatus);
  }
  if (nextTasks === previousTasks) return previousTasks;
  const backgroundRunTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
  context.setLatestTaskSnapshot(nextTasks);
  dispatchTasksCompleted(nextTasks, previousTasks);
  dispatchTasksUpdated(backgroundRunTasksUpdatePlan.reason, nextTasks);
  if (!backgroundRunTasksUpdatePlan.hasLiveTasks && latestExtendedSettings.refreshLibraryOnTaskCompletion) {
    emitLibraryUpdated();
    void context.refreshIndexDiagnostics();
    void context.refreshCharacterBookSummaries();
    context.setBackgroundTaskRunning(false);
  }
  return nextTasks;
}

export async function runAppParseAndIndexTasks(source: 'reader' | 'import', context: AppTaskActionContext) {
  if (source === 'reader') showTaskCenterForLongOperation(context.extendedSettings.autoShowTaskCenterForLongOperations, context.setActivePage);
  const previousTasks = await loadTaskStatuses();
  const nextTasks = await runParseAndIndexTasks();
  const runTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
  if (!runTasksUpdatePlan.hasLiveTasks && context.extendedSettings.refreshLibraryOnTaskCompletion) {
    emitLibraryUpdated();
  } else {
    context.setLatestTaskSnapshot(nextTasks);
    context.setBackgroundTaskRunning(true);
  }
  dispatchTasksCompleted(nextTasks, previousTasks);
  dispatchTasksUpdated(runTasksUpdatePlan.reason, nextTasks);
  void context.refreshIndexDiagnostics();
  return nextTasks;
}

export async function runCharacterTextIndex(bookId: string, context: AppTaskActionContext) {
  showTaskCenterForLongOperation(context.extendedSettings.autoShowTaskCenterForLongOperations, context.setActivePage);
  const previousTasks = await loadTaskStatuses();
  if (!hasIndexTaskForBook(previousTasks, bookId, ['queued', 'running', 'cancelling', 'paused'])) {
    await rebuildBookIndex(bookId);
  }
  const nextTasks = await runParseAndIndexTasks();
  const runTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
  context.setLatestTaskSnapshot(nextTasks);
  context.setBackgroundTaskRunning(runTasksUpdatePlan.hasLiveTasks);
  dispatchTasksCompleted(nextTasks, previousTasks);
  dispatchTasksUpdated(runTasksUpdatePlan.reason, nextTasks);
  if (!runTasksUpdatePlan.hasLiveTasks && context.extendedSettings.refreshLibraryOnTaskCompletion) {
    emitLibraryUpdated();
  }
  void context.refreshCharacterBookSummaries();
  void context.refreshIndexDiagnostics();
}

export async function runCharacterExtraction(bookId: string, context: AppTaskActionContext) {
  showTaskCenterForLongOperation(context.extendedSettings.autoShowTaskCenterForLongOperations, context.setActivePage);
  const previousTasks = await loadTaskStatuses();
  await queueCharacterExtraction(bookId);
  const nextTasks = await runParseAndIndexTasks();
  const runTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
  context.setLatestTaskSnapshot(nextTasks);
  context.setBackgroundTaskRunning(runTasksUpdatePlan.hasLiveTasks);
  dispatchTasksCompleted(nextTasks, previousTasks);
  dispatchTasksUpdated(runTasksUpdatePlan.reason, nextTasks);
  if (!runTasksUpdatePlan.hasLiveTasks && context.extendedSettings.refreshLibraryOnTaskCompletion) {
    emitLibraryUpdated();
  }
  await context.refreshCharacterOverviewSnapshot(bookId);
  await context.refreshCharacterPayload(bookId);
  await context.refreshCharacterBookSummaries();
  void context.refreshIndexDiagnostics();
}

export async function resumeStartupTasks(
  previousTasks: TaskStatus[],
  pauseResumeStrategy: ExtendedSettings['indexPauseResumeStrategy'],
  context: AppTaskActionContext,
  onResumeFailed: () => void,
) {
  try {
    const pausedTaskIds = pauseResumeStrategy === 'auto'
      ? previousTasks.filter((task) => task.status === 'paused').map((task) => task.id)
      : [];
    const nextTasks = pausedTaskIds.length > 0
      ? await resumePausedTasksAndRun(pausedTaskIds)
      : await runParseAndIndexTasks();
    const startupRunTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
    dispatchTasksCompleted(nextTasks, previousTasks);
    dispatchTasksUpdated(startupRunTasksUpdatePlan.reason, nextTasks);
    context.setLatestTaskSnapshot(nextTasks);
    context.setBackgroundTaskRunning(startupRunTasksUpdatePlan.hasLiveTasks);
    if (!startupRunTasksUpdatePlan.hasLiveTasks && context.extendedSettings.refreshLibraryOnTaskCompletion) {
      emitLibraryUpdated();
    }
    void context.refreshIndexDiagnostics();
  } catch (error) {
    console.warn('Failed to resume unfinished startup tasks:', error);
    onResumeFailed();
  }
}

export async function autoIndexOpenedReaderBook(
  targetBook: Book,
  indexStatus: string,
  autoIndexKey: string | undefined,
  context: AppTaskActionContext,
  autoIndexOpenedBookKeysRef: AutoIndexKeyRef,
) {
  try {
    const previousTasks = await loadTaskStatuses();
    if (hasIndexTaskForBook(previousTasks, targetBook.id, ['running', 'cancelling', 'paused'])) {
      context.setLatestTaskSnapshot(previousTasks);
      context.setBackgroundTaskRunning(previousTasks.some((task) => task.status === 'running' || task.status === 'cancelling'));
      dispatchTasksUpdated(getRunTasksUpdatePlan(previousTasks).reason, previousTasks);
      void context.refreshIndexDiagnostics();
      return;
    }
    if (!hasIndexTaskForBook(previousTasks, targetBook.id, ['queued'])) {
      await rebuildBookIndex(targetBook.id);
    }
    const nextTasks = await runParseAndIndexTasks();
    const runTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
    context.setLatestTaskSnapshot(nextTasks);
    context.setBackgroundTaskRunning(runTasksUpdatePlan.hasLiveTasks);
    dispatchTasksCompleted(nextTasks, previousTasks);
    dispatchTasksUpdated(runTasksUpdatePlan.reason, nextTasks);
    if (!runTasksUpdatePlan.hasLiveTasks && context.extendedSettings.refreshLibraryOnTaskCompletion) {
      emitLibraryUpdated();
    }
    void context.refreshIndexDiagnostics();
  } catch (error) {
    console.warn(`Failed to auto-index opened reader book ${targetBook.id} (${indexStatus}):`, error);
    if (autoIndexKey) autoIndexOpenedBookKeysRef.current.delete(autoIndexKey);
  }
}

export async function maybeRunQueuedTasksWhenIdle(
  previousTasks: TaskStatus[],
  context: AppTaskActionContext,
  idleQueuedTaskAutoRunStartedRef: { current: boolean },
  latestExtendedSettings = loadExtendedSettings(),
) {
  const idleQueuedPlan = getIdleQueuedTaskAutoRunPlan(previousTasks, latestExtendedSettings.taskAutoRunQueuedWhenIdle);
  if (!idleQueuedPlan.shouldRun || idleQueuedTaskAutoRunStartedRef.current) return;
  idleQueuedTaskAutoRunStartedRef.current = true;
  try {
    const nextTasks = await runParseAndIndexTasks();
    const runTasksUpdatePlan = getRunTasksUpdatePlan(nextTasks);
    context.setLatestTaskSnapshot(nextTasks);
    context.setBackgroundTaskRunning(runTasksUpdatePlan.hasLiveTasks);
    dispatchTasksCompleted(nextTasks, previousTasks);
    dispatchTasksUpdated(runTasksUpdatePlan.reason, nextTasks);
    if (!runTasksUpdatePlan.hasLiveTasks && latestExtendedSettings.refreshLibraryOnTaskCompletion) {
      emitLibraryUpdated();
    }
    void context.refreshIndexDiagnostics();
  } catch (error) {
    console.warn('Failed to auto-run queued tasks while idle:', error);
  } finally {
    idleQueuedTaskAutoRunStartedRef.current = false;
  }
}

export function hasIndexTaskForBook(tasks: TaskStatus[], bookId: string, statuses: TaskStatus['status'][]) {
  return tasks.some((task) => task.bookId === bookId && (task.kind === 'parse-and-index' || task.kind === 'rebuild-index') && statuses.includes(task.status));
}

function taskStatusSortMillis(task: TaskStatus) {
  return [task.finishedAt, task.updatedAt, task.startedAt, task.createdAt]
    .map((value) => parseTaskStatusMillis(value))
    .find((value) => value > 0) ?? 0;
}

function parseTaskStatusMillis(value: string) {
  if (!value) return 0;
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsedDate = Date.parse(value);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

async function showSystemNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return false;
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return true;
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

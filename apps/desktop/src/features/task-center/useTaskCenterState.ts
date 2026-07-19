import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  archiveTask,
  cancelQueuedTasks,
  cancelTask,
  clearCompletedTasks,
  clearTaskLogs,
  deleteBookIndex,
  dispatchTasksCompleted,
  dispatchTasksUpdated,
  getRunTasksUpdatePlan,
  importDevSampleBookAndIndex,
  loadIndexDiagnostics,
  loadTaskLogs,
  loadTaskStatuses,
  mergeTaskProgressEventStatus,
  mergeTaskStatusRows,
  pauseQueuedTasks,
  pauseTask,
  rebuildBookIndex,
  repairBookFts,
  retryFailedTasks,
  retryTask,
  restoreArchivedTask,
  runParseAndIndexTasks,
  subscribeTaskProgressEvents,
  validateAllIndexes,
} from '../../services/taskService';
import { useI18n } from '../../i18n';
import { requestTaskCenterImport } from '../../services/appNavigationEvents';
import type { IndexDiagnostics, TaskLogRecord, TaskStatus } from '../../types';
import { loadExtendedSettings } from '../../services/settingsCenterService';
import { getTaskCompletionRefreshPlan, shouldDispatchLibraryRefreshAfterTaskCompletion } from './taskCompletionRefreshPolicy';
import { requestAppConfirm } from '../../components/useAppConfirm';
import { emitLibraryUpdated } from '../../services/appDomainEvents';

type TaskCenterStateOptions = {
  confirm?: (message: string) => Promise<boolean>;
};

const defaultTaskCenterConfirm = requestAppConfirm;
const TASK_CENTER_DIAGNOSTICS_BACKGROUND_DELAY_MS = 120;
const TASK_CENTER_VISIBILITY_REFRESH_MIN_MS = 15_000;
let cachedTaskCenterTasks: TaskStatus[] = [];
let cachedTaskCenterDiagnostics: IndexDiagnostics | null = null;
let cachedTaskCenterLogs: TaskLogRecord[] = [];
let cachedTaskCenterLogTaskId: string | undefined;
let lastTaskCenterVisibilityRefreshAt = 0;

export function useTaskCenterState(options: TaskCenterStateOptions = {}) {
  const { t } = useI18n();
  const confirm = options.confirm ?? defaultTaskCenterConfirm;
  const initialSettings = loadExtendedSettings();
  const [tasks, setTasks] = useState<TaskStatus[]>(cachedTaskCenterTasks);
  const tasksRef = useRef<TaskStatus[]>(cachedTaskCenterTasks);
  const [indexDiagnostics, setIndexDiagnostics] = useState<IndexDiagnostics | null>(cachedTaskCenterDiagnostics);
  const [logs, setLogs] = useState<TaskLogRecord[]>(cachedTaskCenterLogs);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [logTaskId, setLogTaskId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>(initialSettings.taskCenterDefaultStatusFilter);
  const autoFtsRepairingRef = useRef(false);
  const runQueuedTasksInFlightRef = useRef<Promise<void> | null>(null);

  const selectedTask = useMemo(
    () => selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null,
    [selectedTaskId, tasks],
  );
  const hasRunningTasks = getRunTasksUpdatePlan(tasks).hasLiveTasks;

  const commitTaskRows = useCallback((nextTasks: TaskStatus[]) => {
    const previousTasks = tasksRef.current;
    const mergedTasks = mergeTaskStatusRows(previousTasks, nextTasks);
    tasksRef.current = mergedTasks;
    cachedTaskCenterTasks = mergedTasks;
    setTasks(mergedTasks);
    dispatchTasksCompleted(mergedTasks, previousTasks);
    const completionRefreshPlan = getTaskCompletionRefreshPlan(previousTasks, mergedTasks);
    if (completionRefreshPlan.shouldRefresh) {
      dispatchTasksUpdated(completionRefreshPlan.reason, mergedTasks);
      if (shouldDispatchLibraryRefreshAfterTaskCompletion(completionRefreshPlan, loadExtendedSettings().refreshLibraryOnTaskCompletion)) {
        emitLibraryUpdated({ bookIds: completionRefreshPlan.bookIds, taskIds: completionRefreshPlan.taskIds });
      }
    }
    return mergedTasks;
  }, []);

  const refreshIndexDiagnosticsInBackground = useCallback(async () => {
    try {
      const nextDiagnostics = await loadIndexDiagnostics();
      const repairedDiagnostics = await applyAutoFtsRepairStrategy(nextDiagnostics);
      cachedTaskCenterDiagnostics = repairedDiagnostics;
      setIndexDiagnostics(repairedDiagnostics);
    } catch (error) {
      setErrorMessage(`索引诊断加载失败：${formatTaskCenterLoadError(error)}`);
    }
  }, []);

  const refreshTaskCenterState = useCallback(async (options: { includeDiagnostics?: boolean; includeLogs?: boolean } = {}) => {
    const includeDiagnostics = options.includeDiagnostics ?? true;
    const includeLogs = options.includeLogs ?? Boolean(logTaskId);
    const requests: Array<Promise<unknown>> = [loadTaskStatuses()];
    if (includeDiagnostics) requests.push(loadIndexDiagnostics());
    if (includeLogs) requests.push(loadTaskLogs(logTaskId));
    const [tasksResult, diagnosticsResult, logsResult] = await Promise.allSettled(requests);
    const loadErrors: string[] = [];
    if (tasksResult.status === 'fulfilled') {
      commitTaskRows(tasksResult.value as TaskStatus[]);
    } else {
      loadErrors.push(`任务队列加载失败：${formatTaskCenterLoadError(tasksResult.reason)}`);
    }
    if (includeDiagnostics && diagnosticsResult?.status === 'fulfilled') {
      const nextDiagnostics = diagnosticsResult.value as IndexDiagnostics;
      const repairedDiagnostics = await applyAutoFtsRepairStrategy(nextDiagnostics);
      cachedTaskCenterDiagnostics = repairedDiagnostics;
      setIndexDiagnostics(repairedDiagnostics);
    } else if (includeDiagnostics && diagnosticsResult?.status === 'rejected') {
      loadErrors.push(`索引诊断加载失败：${formatTaskCenterLoadError(diagnosticsResult.reason)}`);
    }
    if (includeLogs && logsResult?.status === 'fulfilled') {
      cachedTaskCenterLogs = logsResult.value as TaskLogRecord[];
      cachedTaskCenterLogTaskId = logTaskId;
      setLogs(cachedTaskCenterLogs);
    } else if (includeLogs && logsResult?.status === 'rejected') {
      loadErrors.push(`任务日志加载失败：${formatTaskCenterLoadError(logsResult.reason)}`);
    }
    setErrorMessage(loadErrors.join('\n'));
  }, [commitTaskRows, logTaskId, refreshIndexDiagnosticsInBackground]);

  function formatTaskCenterLoadError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async function refreshIndexDiagnosticsAfterTaskChange() {
    try {
      const diagnostics = await loadIndexDiagnostics();
      cachedTaskCenterDiagnostics = diagnostics;
      setIndexDiagnostics(diagnostics);
    } catch (error) {
      setErrorMessage(`索引诊断加载失败：${formatTaskCenterLoadError(error)}`);
    }
  }

  useEffect(() => {
    void refreshTaskCenterState({ includeDiagnostics: false, includeLogs: false });
    const refreshTimer = window.setTimeout(() => {
      void refreshIndexDiagnosticsInBackground();
    }, TASK_CENTER_DIAGNOSTICS_BACKGROUND_DELAY_MS);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshIndexDiagnosticsInBackground, refreshTaskCenterState]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    subscribeTaskProgressEvents((events) => {
      if (disposed) return;
      const previousTasks = tasksRef.current;
      let mergedTasks = previousTasks;
      for (const event of events) {
        mergedTasks = mergeTaskProgressEventStatus(mergedTasks, event.status);
      }
      if (mergedTasks === previousTasks) return;
      tasksRef.current = mergedTasks;
      cachedTaskCenterTasks = mergedTasks;
      setTasks(mergedTasks);
      dispatchTasksCompleted(mergedTasks, previousTasks);
      const completionRefreshPlan = getTaskCompletionRefreshPlan(previousTasks, mergedTasks);
      if (completionRefreshPlan.shouldRefresh) {
        dispatchTasksUpdated(completionRefreshPlan.reason, mergedTasks);
        if (shouldDispatchLibraryRefreshAfterTaskCompletion(completionRefreshPlan, loadExtendedSettings().refreshLibraryOnTaskCompletion)) {
          emitLibraryUpdated({ bookIds: completionRefreshPlan.bookIds, taskIds: completionRefreshPlan.taskIds });
        }
      } else {
        const hasStartedEvent = events.some((event) => event.reason === 'task-started');
        dispatchTasksUpdated(hasStartedEvent ? 'task-started' : getRunTasksUpdatePlan(mergedTasks).reason, mergedTasks);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    }).catch((error) => {
      console.warn('Task progress event stream is unavailable; manual and visibility refresh remain available:', error);
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastTaskCenterVisibilityRefreshAt < TASK_CENTER_VISIBILITY_REFRESH_MIN_MS) return;
        lastTaskCenterVisibilityRefreshAt = now;
        void refreshTaskCenterState({ includeDiagnostics: false, includeLogs: false });
        void refreshIndexDiagnosticsInBackground();
      }
    }
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [refreshTaskCenterState]);

  const commitTasks = useCallback(async (
    nextTasks: TaskStatus[],
    reason: Parameters<typeof dispatchTasksUpdated>[0],
    options: { refreshDiagnostics?: boolean } = {},
  ) => {
    const previousTasks = tasksRef.current;
    const mergedTasks = mergeTaskStatusRows(previousTasks, nextTasks);
    tasksRef.current = mergedTasks;
    cachedTaskCenterTasks = mergedTasks;
    setTasks(mergedTasks);
    dispatchTasksCompleted(mergedTasks, previousTasks);
    if (options.refreshDiagnostics ?? true) {
      await refreshIndexDiagnosticsAfterTaskChange();
    }
    dispatchTasksUpdated(reason, nextTasks);
    if (!getRunTasksUpdatePlan(mergedTasks).hasLiveTasks) {
      emitLibraryUpdated();
    }
  }, []);

  const runQueuedTasks = useCallback(async () => {
    if (runQueuedTasksInFlightRef.current) return runQueuedTasksInFlightRef.current;
    setBusy(true);
    runQueuedTasksInFlightRef.current = (async () => {
      const nextTasks = await runParseAndIndexTasks();
      await commitTasks(nextTasks, getRunTasksUpdatePlan(nextTasks).reason);
    })();
    try {
      return await runQueuedTasksInFlightRef.current;
    } finally {
      runQueuedTasksInFlightRef.current = null;
      setBusy(false);
    }
  }, [commitTasks]);

  const importDevSample = useCallback(async () => {
    setBusy(true);
    try {
      const book = await importDevSampleBookAndIndex();
      await refreshTaskCenterState();
      emitLibraryUpdated({ bookId: book.id, openReader: true });
    } finally {
      setBusy(false);
    }
  }, [refreshTaskCenterState]);

  const openLibraryImport = useCallback((mode: 'file' | 'directory') => {
    requestTaskCenterImport(mode);
  }, []);

  const learnIndexArtifacts = useCallback(() => {
    document.querySelector('.index-manifest-browser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const controlTask = useCallback(async (taskId: string, action: 'pause' | 'cancel' | 'retry' | 'archive' | 'restore') => {
    if (action === 'cancel' && !await confirm(t('tasks.confirm.cancel'))) return;
    if (action === 'archive' && !await confirm(t('tasks.confirm.archive'))) return;
    if (action === 'restore' && !await confirm(t('tasks.confirm.restore'))) return;
    setBusy(true);
    try {
      const nextTasks = action === 'pause'
        ? await pauseTask(taskId)
        : action === 'cancel'
          ? await cancelTask(taskId)
          : action === 'archive'
            ? await archiveTask(taskId)
            : action === 'restore'
              ? await restoreArchivedTask(taskId)
              : await retryTask(taskId);
      await commitTasks(nextTasks, action === 'retry' || action === 'restore' ? 'index-rebuilt' : 'task-completed');
    } finally {
      setBusy(false);
    }
  }, [commitTasks, confirm, t]);

  const controlTaskBatch = useCallback(async (action: 'cancel-queued' | 'retry-failed' | 'pause-queued') => {
    const confirmKey = action === 'cancel-queued'
      ? 'tasks.confirm.cancelQueued'
      : action === 'retry-failed'
        ? 'tasks.confirm.retryFailed'
        : 'tasks.confirm.pauseQueued';
    if (!await confirm(t(confirmKey))) return;
    setBusy(true);
    try {
      const nextTasks = action === 'cancel-queued'
        ? await cancelQueuedTasks()
        : action === 'retry-failed'
          ? await retryFailedTasks()
          : await pauseQueuedTasks();
      await commitTasks(nextTasks, action === 'retry-failed' ? 'index-rebuilt' : 'task-completed');
    } finally {
      setBusy(false);
    }
  }, [commitTasks, confirm, t]);

  const controlSelectedTasks = useCallback(async (taskIds: string[], action: 'cancel' | 'retry') => {
    if (!taskIds.length) return;
    const confirmKey = action === 'cancel' ? 'tasks.confirm.cancelSelected' : 'tasks.confirm.retrySelected';
    if (!await confirm(t(confirmKey, { count: taskIds.length }))) return;
    setBusy(true);
    try {
      let nextTasks = tasksRef.current;
      for (const taskId of taskIds) {
        nextTasks = action === 'cancel' ? await cancelTask(taskId) : await retryTask(taskId);
        tasksRef.current = mergeTaskStatusRows(tasksRef.current, nextTasks);
      }
      await commitTasks(nextTasks, action === 'retry' ? 'index-rebuilt' : 'task-completed');
    } finally {
      setBusy(false);
    }
  }, [commitTasks, confirm, t]);

  const clearCompleted = useCallback(async () => {
    if (!await confirm(t('tasks.confirm.clearCompleted'))) return;
    setBusy(true);
    try {
      await commitTasks(await clearCompletedTasks(), 'task-completed');
    } finally {
      setBusy(false);
    }
  }, [commitTasks, confirm, t]);

  const clearLogs = useCallback(async (scope: 'all' | 'completed' | 'failed' | 'task', taskId?: string) => {
    const confirmed = await confirm(t('tasks.confirm.clearLogs'));
    if (!confirmed) return;
    setBusy(true);
    try {
      await clearTaskLogs(scope, taskId);
      cachedTaskCenterLogs = await loadTaskLogs(logTaskId);
      cachedTaskCenterLogTaskId = logTaskId;
      setLogs(cachedTaskCenterLogs);
      dispatchTasksUpdated('logs-cleared', tasks);
    } finally {
      setBusy(false);
    }
  }, [confirm, logTaskId, tasks, t]);

  const openLogs = useCallback(async (taskId?: string) => {
    setLogTaskId(taskId);
    if (cachedTaskCenterLogTaskId === taskId && cachedTaskCenterLogs.length) {
      setLogs(cachedTaskCenterLogs);
    }
    cachedTaskCenterLogs = await loadTaskLogs(taskId);
    cachedTaskCenterLogTaskId = taskId;
    setLogs(cachedTaskCenterLogs);
  }, []);

  const rebuildIndex = useCallback(async (bookId: string) => {
    if (!await confirm(t('tasks.confirm.rebuildIndex'))) return;
    setBusy(true);
    try {
      await commitTasks(await rebuildBookIndex(bookId), 'index-rebuilt', { refreshDiagnostics: false });
      const nextTasks = await runParseAndIndexTasks();
      await commitTasks(nextTasks, getRunTasksUpdatePlan(nextTasks).reason, { refreshDiagnostics: false });
      void refreshIndexDiagnosticsAfterTaskChange();
    } finally {
      setBusy(false);
    }
  }, [commitTasks, confirm, t]);

  const rebuildSelectedIndexes = useCallback(async (bookIds: string[]) => {
    if (!bookIds.length) return;
    if (!await confirm(t('tasks.confirm.rebuildSelectedIndexes', { count: bookIds.length }))) return;
    setBusy(true);
    try {
      let nextTasks = tasksRef.current;
      for (const bookId of bookIds) {
        nextTasks = await rebuildBookIndex(bookId);
        tasksRef.current = mergeTaskStatusRows(tasksRef.current, nextTasks);
      }
      await commitTasks(nextTasks, 'index-rebuilt', { refreshDiagnostics: false });
      const runningTasks = await runParseAndIndexTasks();
      await commitTasks(runningTasks, getRunTasksUpdatePlan(runningTasks).reason, { refreshDiagnostics: false });
      void refreshIndexDiagnosticsAfterTaskChange();
    } finally {
      setBusy(false);
    }
  }, [commitTasks, confirm, t]);


  const deleteIndex = useCallback(async (bookId: string) => {
    const confirmed = await confirm(t('tasks.confirm.deleteIndex'));
    if (!confirmed) return;
    setBusy(true);
    try {
      const diagnostics = await deleteBookIndex(bookId);
      cachedTaskCenterDiagnostics = diagnostics;
      setIndexDiagnostics(diagnostics);
      dispatchTasksUpdated('index-rebuilt', tasks);
    } finally {
      setBusy(false);
    }
  }, [confirm, tasks, t]);

  const repairFts = useCallback(async (bookId: string) => {
    const ftsRepairStrategy = loadExtendedSettings().ftsRepairStrategy;
    if (ftsRepairStrategy !== 'auto' && !await confirm(t('tasks.confirm.repairFts'))) return;
    setBusy(true);
    try {
      const diagnostics = await repairBookFts(bookId);
      cachedTaskCenterDiagnostics = diagnostics;
      setIndexDiagnostics(diagnostics);
      dispatchTasksUpdated('index-rebuilt', tasks);
      emitLibraryUpdated();
    } finally {
      setBusy(false);
    }
  }, [confirm, tasks, t]);

  async function applyAutoFtsRepairStrategy(diagnostics: IndexDiagnostics) {
    if (autoFtsRepairingRef.current || loadExtendedSettings().ftsRepairStrategy !== 'auto') {
      return diagnostics;
    }
    const repairableBookIds = diagnostics.books
      .filter((book) => book.chunkCount > 0 && book.ftsRowCount === 0)
      .map((book) => book.bookId);
    if (repairableBookIds.length === 0) return diagnostics;
    autoFtsRepairingRef.current = true;
    try {
      let repaired = diagnostics;
      for (const bookId of repairableBookIds) {
        repaired = await repairBookFts(bookId);
      }
      dispatchTasksUpdated('index-rebuilt', tasksRef.current);
      emitLibraryUpdated();
      return repaired;
    } finally {
      autoFtsRepairingRef.current = false;
    }
  }

  const validateIndexes = useCallback(async () => {
    setBusy(true);
    try {
      const diagnostics = await validateAllIndexes();
      cachedTaskCenterDiagnostics = diagnostics;
      setIndexDiagnostics(diagnostics);
      dispatchTasksUpdated('index-rebuilt', tasks);
      emitLibraryUpdated();
    } finally {
      setBusy(false);
    }
  }, [tasks]);

  return {
    activeFilter,
    busy,
    clearCompleted,
    clearLogs,
    controlTask,
    controlTaskBatch,
    controlSelectedTasks,
    errorMessage,
    hasRunningTasks,
    importDevSample,
    indexDiagnostics,
    learnIndexArtifacts,
    logs,
    logTaskId,
    openLogs,
    openLibraryImport,
    refreshTaskCenterState,
    rebuildIndex,
    rebuildSelectedIndexes,
    runQueuedTasks,
    selectedTask,
    selectedTaskId,
    setActiveFilter,
    setSelectedTaskId,
    tasks,
    deleteIndex,
    repairFts,
    validateIndexes,
  };
}

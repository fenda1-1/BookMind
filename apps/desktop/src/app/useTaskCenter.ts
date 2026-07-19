import { useEffect, useMemo } from 'react';
import { loadTaskStatuses, subscribeTaskProgressEvents, getStartupTaskResumePlan } from '../services/taskService';
import { loadSharedIndexDiagnostics } from '../services/indexDiagnosticsService';
import { loadExtendedSettings } from '../services/settingsCenterService';
import { subscribeTasksCompleted, subscribeTasksUpdated, type TaskUpdateReason } from '../services/appDomainEvents';
import { recordLifecycleDiagnostic } from '../services/lifecycleDiagnosticsService';
import { subscribeCurrentBookDataCleared } from '../features/reader-core/currentBookDataEvents';
import { shouldResetAiIndexStateAfterTaskRefresh } from '../features/task-center/taskCompletionRefreshPolicy';
import { handleTaskProgressEventBatch, maybeRunQueuedTasksWhenIdle, notifyBackgroundTaskCompletion, resumeStartupTasks } from './appTaskActions';
import { checkUnfinishedTasksOnStartup } from './appShellModel';
import type { AppState } from './AppStateContext';
import type { TaskStatus, Book, AiDiagnostics, IndexDiagnostics } from '../types';
import type { AppTaskActionContext } from './appTaskActions';

export function useTaskCenter(
  appState: AppState,
  booksRef: React.MutableRefObject<Book[]>,
  backgroundTaskPreviousSnapshotRef: React.MutableRefObject<TaskStatus[]>,
  startupTaskResumeStartedRef: React.MutableRefObject<boolean>,
  selectedBookId: string | null,
  aiDiagnostics: AiDiagnostics | null,
  book: Book | null,
  resetAiSessionForCurrentBookDataClear: () => void,
  refreshCharacterBookSummaries: () => Promise<void>,
  refreshCharacterOverviewSnapshot: (bookId: string | null) => Promise<void>,
  refreshCharacterPayload: (bookId: string | null) => Promise<void>,
) {
  const { extendedSettings, setTaskSnapshot, setUnfinishedTaskSummary, setBackgroundTaskRunning, setTaskCompletionToast, setIndexDiagnostics, setAiStatus, setAiDiagnostics, setActivePage, activePage, setAppLocked, setCommandPaletteOpen } = appState;

  const taskContext: AppTaskActionContext = useMemo(() => ({
    extendedSettings,
    setActivePage,
    setLatestTaskSnapshot: setTaskSnapshot,
    setBackgroundTaskRunning,
    refreshIndexDiagnostics: () => { loadSharedIndexDiagnostics().then(setIndexDiagnostics).catch(() => {}); },
    refreshCharacterBookSummaries,
    refreshCharacterOverviewSnapshot,
    refreshCharacterPayload,
  }), [extendedSettings, setActivePage, setTaskSnapshot, setBackgroundTaskRunning, setIndexDiagnostics, refreshCharacterBookSummaries, refreshCharacterOverviewSnapshot, refreshCharacterPayload]);

  useEffect(() => { let c = false; loadTaskStatuses().then((t) => { if (!c) { backgroundTaskPreviousSnapshotRef.current = t; setTaskSnapshot(t); } }).catch(() => {}); return () => { c = true; }; }, []);

  useEffect(() => {
    function handle(detail: { bookId: string }) { if (detail.bookId === book?.id) resetAiSessionForCurrentBookDataClear(); }
    return subscribeCurrentBookDataCleared(handle);
  }, [book?.id]);

  useEffect(() => {
    return subscribeTasksCompleted((detail) => {
      void notifyBackgroundTaskCompletion(extendedSettings.backgroundTaskNotificationMode, detail, setTaskCompletionToast);
    });
  }, [extendedSettings.backgroundTaskNotificationMode]);

  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    subscribeTaskProgressEvents((events) => {
      if (disposed) return;
      const latest = loadExtendedSettings();
      const next = handleTaskProgressEventBatch(backgroundTaskPreviousSnapshotRef.current, events.map((event) => event.status), taskContext, latest);
      backgroundTaskPreviousSnapshotRef.current = next;
      void maybeRunQueuedTasksWhenIdle(next, taskContext, { current: false }, latest);
    }).then((d) => { if (disposed) d(); else unlisten = d; }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, [taskContext]);

  useEffect(() => {
    if (!extendedSettings.checkUnfinishedTasksOnStartup) { setUnfinishedTaskSummary(null); return; }
    let c = false;
    checkUnfinishedTasksOnStartup().then((s) => { if (c) return; setUnfinishedTaskSummary(s); const plan = getStartupTaskResumePlan(s?.tasks ?? [], extendedSettings.indexPauseResumeStrategy); if (!plan.shouldResume || startupTaskResumeStartedRef.current) return; startupTaskResumeStartedRef.current = true; void resumeStartupTasks(s?.tasks ?? [], extendedSettings.indexPauseResumeStrategy, taskContext, () => { startupTaskResumeStartedRef.current = false; }); }).catch(() => {});
    return () => { c = true; };
  }, [extendedSettings.checkUnfinishedTasksOnStartup, taskContext]);

  useEffect(() => {
    if (!extendedSettings.taskAutoRunQueuedWhenIdle || extendedSettings.checkUnfinishedTasksOnStartup) return;
    let c = false;
    loadTaskStatuses().then((t) => { if (!c) void maybeRunQueuedTasksWhenIdle(t, taskContext, { current: false }, extendedSettings); }).catch(() => {});
    return () => { c = true; };
  }, [extendedSettings.taskAutoRunQueuedWhenIdle, extendedSettings.checkUnfinishedTasksOnStartup, taskContext]);

  useEffect(() => {
    let cancelled = false;
    function refresh(reason: 'initial' | TaskUpdateReason = 'initial') {
      loadTaskStatuses().then((tasks) => {
        if (cancelled) return;
        backgroundTaskPreviousSnapshotRef.current = tasks;
        setTaskSnapshot(tasks);
        recordLifecycleDiagnostic('task-refresh', 'task-snapshot.refreshed', { reason, count: tasks.length });
      }).catch(() => {});
      loadSharedIndexDiagnostics().then((d) => { if (cancelled) return; setIndexDiagnostics(d); setAiStatus((cs) => { const reset = shouldResetAiIndexStateAfterTaskRefresh(booksRef.current?.find((i) => i.id === selectedBookId) ?? null, cs as never, aiDiagnostics, d); if (!reset) return cs; setAiDiagnostics(null); recordLifecycleDiagnostic('task-refresh', 'ai-index-state.reset', { reason, selectedBookId: selectedBookId ?? null }); return 'idle'; }); }).catch(() => {});
    }
    const unsubscribe = subscribeTasksUpdated((detail) => {
      recordLifecycleDiagnostic('task-refresh', 'task-snapshot.refresh-requested', {
        reason: detail.reason,
        bookCount: detail.bookIds.length,
        taskCount: detail.taskIds.length,
      });
      refresh(detail.reason);
    });
    refresh();
    return () => { cancelled = true; unsubscribe(); };
  }, [aiDiagnostics, selectedBookId, setTaskSnapshot]);

  useEffect(() => { function prevent(e: MouseEvent) { if (!(e.target as HTMLElement)?.closest('input, textarea, [contenteditable="true"], .reader-toc-list button')) e.preventDefault(); } window.addEventListener('contextmenu', prevent); return () => window.removeEventListener('contextmenu', prevent); }, []);

  useEffect(() => {
    if (!extendedSettings.appLockEnabled) { setAppLocked(false); return; }
    let idleTimer: number | undefined;
    const schedule = () => { window.clearTimeout(idleTimer); idleTimer = window.setTimeout(() => { if (!extendedSettings.appLockEnabled) return; setCommandPaletteOpen(false); setAppLocked(true); }, Math.max(1, Number(extendedSettings.appLockIdleTimeoutMinutes) || 15) * 60 * 1000); };
    schedule();
    const onActivity = () => schedule();
    window.addEventListener('pointerdown', onActivity, true); window.addEventListener('keydown', onActivity, true); window.addEventListener('wheel', onActivity, true); window.addEventListener('touchstart', onActivity, true);
    return () => { window.clearTimeout(idleTimer); window.removeEventListener('pointerdown', onActivity, true); window.removeEventListener('keydown', onActivity, true); window.removeEventListener('wheel', onActivity, true); window.removeEventListener('touchstart', onActivity, true); };
  }, [extendedSettings.appLockEnabled, extendedSettings.appLockIdleTimeoutMinutes]);
}

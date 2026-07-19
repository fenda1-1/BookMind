import type { AiDiagnostics, Book, IndexDiagnostics, TaskRunStatus, TaskStatus } from '../../types';

type TaskCompletionRefreshReason = 'task-completed' | 'task-failed';
type AiRefreshStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';

const TERMINAL_STATUSES: TaskRunStatus[] = ['succeeded', 'skipped', 'cancelled', 'failed', 'archived'];
const COMPLETION_SOURCE_STATUSES: TaskRunStatus[] = ['running', 'cancelling'];
const AI_INDEX_ERROR_KINDS = new Set(['no-index', 'stale-index', 'index-failed', 'fts-unavailable']);

export type TaskCompletionRefreshPlan = {
  shouldRefresh: boolean;
  reason: TaskCompletionRefreshReason;
  bookIds: string[];
  taskIds: string[];
};

export function getTaskCompletionRefreshPlan(previousTasks: TaskStatus[], nextTasks: TaskStatus[]): TaskCompletionRefreshPlan {
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));
  const completedTasks = nextTasks.filter((task) => {
    const previousTask = previousById.get(task.id);
    return Boolean(
      previousTask &&
      COMPLETION_SOURCE_STATUSES.includes(previousTask.status) &&
      TERMINAL_STATUSES.includes(task.status),
    );
  });
  return {
    shouldRefresh: completedTasks.length > 0,
    reason: completedTasks.some((task) => task.status === 'failed') ? 'task-failed' : 'task-completed',
    bookIds: [...new Set(completedTasks.map((task) => task.bookId).filter(Boolean))],
    taskIds: completedTasks.map((task) => task.id),
  };
}

export function shouldDispatchLibraryRefreshAfterTaskCompletion(
  plan: Pick<TaskCompletionRefreshPlan, 'shouldRefresh'>,
  refreshLibraryOnTaskCompletion: boolean,
) {
  return refreshLibraryOnTaskCompletion && plan.shouldRefresh;
}

export function shouldResetAiIndexStateAfterTaskRefresh(
  book: Pick<Book, 'id' | 'chunks'> | null | undefined,
  aiStatus: AiRefreshStatus,
  aiDiagnostics: AiDiagnostics | null | undefined,
  diagnostics: IndexDiagnostics | null | undefined,
) {
  if (!book || aiStatus !== 'no-index') return false;
  if (!aiDiagnostics?.errorKind || !AI_INDEX_ERROR_KINDS.has(aiDiagnostics.errorKind)) return false;
  const manifest = diagnostics?.books.find((entry) => entry.bookId === book.id);
  const chunkCount = manifest?.chunkCount ?? book.chunks?.length ?? 0;
  const ftsRows = manifest?.ftsRowCount ?? 0;
  return manifest?.status === 'ready' && chunkCount > 0 && ftsRows > 0;
}

export function shouldRefreshSearchResultsAfterTaskRefresh(query: string) {
  return Boolean(query.trim());
}

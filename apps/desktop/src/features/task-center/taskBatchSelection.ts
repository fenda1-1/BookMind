import type { TaskStatus } from '../../types';

const RESTORABLE_ARCHIVED_TASK_KINDS: TaskStatus['kind'][] = [
  'parse-and-index',
  'rebuild-index',
  'full-text-index',
  'embedding-index',
  'ai-summary',
];

export type SelectedTaskBatchTargets = {
  cancellableTaskIds: string[];
  rebuildBookIds: string[];
  retryableTaskIds: string[];
  selectedCount: number;
};

export function canRestoreArchivedTask(task: Pick<TaskStatus, 'kind' | 'status'>) {
  return task.status === 'archived' && RESTORABLE_ARCHIVED_TASK_KINDS.includes(task.kind);
}

export function getSelectedTaskBatchTargets(
  tasks: TaskStatus[],
  selectedTaskIds: Set<string>,
  taskById?: ReadonlyMap<string, TaskStatus>,
): SelectedTaskBatchTargets {
  const selectedTasks = taskById
    ? [...selectedTaskIds].map((taskId) => taskById.get(taskId)).filter((task): task is TaskStatus => Boolean(task))
    : tasks.filter((task) => selectedTaskIds.has(task.id));
  const rebuildBookIds = new Set<string>();
  const retryableTaskIds: string[] = [];
  const cancellableTaskIds: string[] = [];

  for (const task of selectedTasks) {
    if (task.bookId) rebuildBookIds.add(task.bookId);
    if (task.status === 'failed' && task.attempt < task.maxAttempts && task.error?.retryable !== false) {
      retryableTaskIds.push(task.id);
    }
    if (task.status === 'queued' || task.status === 'running' || task.status === 'cancelling') {
      cancellableTaskIds.push(task.id);
    }
  }

  return {
    cancellableTaskIds,
    rebuildBookIds: [...rebuildBookIds].sort(),
    retryableTaskIds,
    selectedCount: selectedTasks.length,
  };
}

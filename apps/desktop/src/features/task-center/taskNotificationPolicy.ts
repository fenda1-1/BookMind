import type { TaskStatus } from '../../types';

export type BackgroundTaskNotificationMode = 'silent' | 'toast' | 'system-notification';
export type BackgroundTaskCompletionDetail = { count?: number; tasks?: Pick<TaskStatus, 'bookId' | 'bookTitle' | 'kind' | 'status'>[] };
export type CharacterCompletionToastAction = { bookId: string };

export function buildBackgroundTaskCompletionMessage(detail: BackgroundTaskCompletionDetail | undefined) {
  const tasks = detail?.tasks ?? [];
  const failedCount = tasks.filter((task) => task.status === 'failed').length;
  const succeededCount = tasks.filter((task) => task.status === 'succeeded').length;
  if (tasks.length > 0 && failedCount > 0 && succeededCount > 0) {
    return `后台任务完成：${succeededCount} 项成功，${failedCount} 项失败`;
  }
  if (tasks.length > 0 && failedCount > 0) {
    return `后台任务失败：${failedCount} 项`;
  }
  const count = typeof detail?.count === 'number' ? detail.count : succeededCount;
  return count > 0 ? `后台任务已完成：${count} 项` : '后台任务已完成';
}

export function shouldShowTaskCompletionToast(mode: BackgroundTaskNotificationMode, systemNotificationShown: boolean) {
  if (mode === 'silent') return false;
  if (mode === 'system-notification' && systemNotificationShown) return false;
  return true;
}

export function getCharacterCompletionToastAction(detail: BackgroundTaskCompletionDetail | undefined): CharacterCompletionToastAction | null {
  const task = detail?.tasks?.find((item) => item.kind === 'character-extraction' && item.status === 'succeeded' && item.bookId);
  return task ? { bookId: task.bookId } : null;
}

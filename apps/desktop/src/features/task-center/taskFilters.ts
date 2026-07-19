import type { TaskKind, TaskRunStatus, TaskStatus } from '../../types';

export type TaskTimeRangeFilter = 'all' | 'today' | 'last-24h' | 'last-7d' | 'older-than-7d';

export type TaskQueueFilters = {
  bookQuery?: string;
  errorCode?: string;
  kind?: TaskKind | 'all' | string;
  status?: TaskRunStatus | 'all' | string;
  timeRange?: TaskTimeRangeFilter | string;
};

export type TaskQueueFilterOptions = {
  books: Array<{ id: string; label: string }>;
  errorCodes: string[];
  kinds: string[];
  statuses: string[];
};

const oneDayMs = 24 * 60 * 60 * 1000;
const sevenDaysMs = 7 * oneDayMs;
const placeholderTaskKinds = new Set(['embedding-index', 'ai-summary']);

export function isHiddenPlaceholderTask(task: TaskStatus) {
  if (!placeholderTaskKinds.has(task.kind) || task.status !== 'skipped') return false;
  return task.message.includes('尚未接入') || task.message.includes('占位任务');
}

export function visibleTaskStatuses(tasks: TaskStatus[]) {
  return tasks.filter((task) => !isHiddenPlaceholderTask(task));
}

export function filterTaskStatuses(tasks: TaskStatus[], filters: TaskQueueFilters, now = Date.now()) {
  const bookQuery = normalizeText(filters.bookQuery);
  const kind = filters.kind && filters.kind !== 'all' ? filters.kind : '';
  const status = filters.status && filters.status !== 'all' ? filters.status : '';
  const errorCode = filters.errorCode && filters.errorCode !== 'all' ? filters.errorCode : '';
  const timeRange = filters.timeRange ?? 'all';

  return tasks.filter((task) => {
    if (bookQuery && !matchesBookQuery(task, bookQuery)) return false;
    if (kind && task.kind !== kind) return false;
    if (status && task.status !== status) return false;
    if (errorCode && task.errorCode !== errorCode && task.error?.code !== errorCode) return false;
    return matchesTimeRange(task.updatedAt || task.createdAt, timeRange, now);
  });
}

export function getTaskQueueFilterOptions(tasks: TaskStatus[]): TaskQueueFilterOptions {
  const bookLabels = new Map<string, string>();
  const errorCodes = new Set<string>();
  const kinds = new Set<string>();
  const statuses = new Set<string>();

  for (const task of tasks) {
    if (task.bookId && !bookLabels.has(task.bookId)) {
      bookLabels.set(task.bookId, task.bookTitle || task.bookId);
    }
    if (task.errorCode) errorCodes.add(task.errorCode);
    if (task.error?.code) errorCodes.add(task.error.code);
    if (task.kind) kinds.add(task.kind);
    if (task.status) statuses.add(task.status);
  }

  return {
    books: [...bookLabels.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    errorCodes: [...errorCodes].sort(),
    kinds: [...kinds].sort(),
    statuses: [...statuses].sort(),
  };
}

function matchesBookQuery(task: TaskStatus, bookQuery: string) {
  return [
    task.bookId,
    task.bookTitle,
    task.fileName,
    task.name,
  ].some((value) => normalizeText(value).includes(bookQuery));
}

function matchesTimeRange(timestamp: string, range: string, now: number) {
  if (!timestamp || range === 'all') return true;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return true;
  if (range === 'today') {
    const current = new Date(now);
    const value = new Date(time);
    return current.getFullYear() === value.getFullYear()
      && current.getMonth() === value.getMonth()
      && current.getDate() === value.getDate();
  }
  if (range === 'last-24h') return now - time <= oneDayMs;
  if (range === 'last-7d') return now - time <= sevenDaysMs;
  if (range === 'older-than-7d') return now - time > sevenDaysMs;
  return true;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

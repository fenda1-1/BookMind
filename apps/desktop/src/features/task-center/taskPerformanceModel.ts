import type { TaskLogRecord, TaskStatus } from '../../types';
import { redactTaskText } from './taskPrivacy';
import { filterTaskStatuses, getTaskQueueFilterOptions, type TaskQueueFilters } from './taskFilters';
import { getVirtualWindow, type VirtualWindow } from './taskVirtualWindow';

export type LargeTaskQueueView = {
  filteredCount: number;
  filterOptions: ReturnType<typeof getTaskQueueFilterOptions>;
  page: number;
  pageCount: number;
  rows: TaskStatus[];
};

export type LargeTaskLogView = {
  filteredLogs: TaskLogRecord[];
  filteredCount: number;
  rows: TaskLogRecord[];
  window: VirtualWindow;
};

export function getLargeTaskQueueView(tasks: TaskStatus[], options: {
  filters: TaskQueueFilters;
  now?: number;
  page: number;
  pageSize: number;
}): LargeTaskQueueView {
  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const sorted = [...tasks].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running'));
  const filteredTasks = filterTaskStatuses(sorted, options.filters, options.now);
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const page = Math.min(Math.max(0, Math.floor(options.page)), pageCount - 1);
  return {
    filteredCount: filteredTasks.length,
    filterOptions: getTaskQueueFilterOptions(tasks),
    page,
    pageCount,
    rows: filteredTasks.slice(page * pageSize, page * pageSize + pageSize),
  };
}

export function getLargeTaskLogView(logs: TaskLogRecord[], options: {
  levelFilter: string;
  overscan?: number;
  privacyMode: boolean;
  query: string;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
}): LargeTaskLogView {
  const query = options.query.trim().toLowerCase();
  const visibleLogs = logs.filter((log) => {
    if (options.levelFilter !== 'all' && log.level !== options.levelFilter) return false;
    if (!query) return true;
    const safeMessage = redactTaskText(log.message, options.privacyMode);
    return `${safeMessage} ${log.stage} ${log.bookId} ${log.taskId}`.toLowerCase().includes(query);
  });
  const window = getVirtualWindow(visibleLogs.length, options.scrollTop, options.viewportHeight, options.rowHeight, options.overscan ?? 6);
  return {
    filteredLogs: visibleLogs,
    filteredCount: visibleLogs.length,
    rows: visibleLogs.slice(window.startIndex, window.endIndex),
    window,
  };
}

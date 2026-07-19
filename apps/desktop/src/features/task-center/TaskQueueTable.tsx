import { memo, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useI18n } from '../../i18n';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import type { TaskStatus } from '../../types';
import { formatTaskNumber, formatTaskPercent, formatTaskSeconds } from './taskFormat';
import { formatTaskRelativeTime } from './taskTime';
import { redactTaskText } from './taskPrivacy';
import type { TaskQueueFilters } from './taskFilters';
import { canRestoreArchivedTask, getSelectedTaskBatchTargets } from './taskBatchSelection';
import { getLargeTaskQueueView } from './taskPerformanceModel';

type TaskQueueTableProps = {
  busy: boolean;
  filter: string;
  tasks: TaskStatus[];
  onArchive: (taskId: string) => void;
  onBatchCancelSelected: (taskIds: string[]) => void;
  onBatchClearCompleted: () => void;
  onBatchRebuildSelectedIndexes: (bookIds: string[]) => void;
  onBatchRetrySelected: (taskIds: string[]) => void;
  onControl: (taskId: string, action: 'pause' | 'cancel' | 'retry' | 'restore') => void;
  onImportDirectory: () => void;
  onImportTxt: () => void;
  onLearnIndexArtifacts: () => void;
  onOpenDetails: (taskId: string) => void;
  onOpenLogs: (taskId: string) => void;
  privacyMode: boolean;
  onRunSample: () => void;
};

const PAGE_SIZE = 50;
const statusFilterOptions = ['all', 'queued', 'running', 'paused', 'cancelling', 'cancelled', 'failed', 'succeeded', 'skipped', 'archived'];
const timeRangeOptions = [
  { labelKey: 'tasks.filter.time.all', value: 'all' },
  { labelKey: 'tasks.filter.time.today', value: 'today' },
  { labelKey: 'tasks.filter.time.last-24h', value: 'last-24h' },
  { labelKey: 'tasks.filter.time.last-7d', value: 'last-7d' },
  { labelKey: 'tasks.filter.time.older-than-7d', value: 'older-than-7d' },
] as const;

export function TaskQueueTable({
  busy,
  filter,
  tasks,
  onArchive,
  onBatchCancelSelected,
  onBatchClearCompleted,
  onBatchRebuildSelectedIndexes,
  onBatchRetrySelected,
  onControl,
  onImportDirectory,
  onImportTxt,
  onLearnIndexArtifacts,
  onOpenDetails,
  onOpenLogs,
  privacyMode,
  onRunSample,
}: TaskQueueTableProps) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<TaskQueueFilters>({ status: 'all', timeRange: 'all' });
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [openActionTaskId, setOpenActionTaskId] = useState('');
  const externalStatus = statusFilterOptions.includes(filter) ? filter : 'all';
  const effectiveStatus = filters.status && filters.status !== 'all'
    ? filters.status
    : externalStatus !== 'all'
      ? externalStatus
      : 'all';
  const queueView = useMemo(() => getLargeTaskQueueView(tasks, {
    filters: { ...filters, status: effectiveStatus },
    page,
    pageSize: PAGE_SIZE,
  }), [effectiveStatus, filters, page, tasks]);
  const filterOptions = queueView.filterOptions;
  const visibleTasks = queueView.rows;
  const pageCount = queueView.pageCount;
  const visibleStatusOptions = Array.from(new Set([...statusFilterOptions, ...filterOptions.statuses]));
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const selectedBatchTargets = useMemo(() => getSelectedTaskBatchTargets(tasks, selectedTaskIds, taskById), [selectedTaskIds, taskById, tasks]);
  const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskIds.has(task.id));

  function updateFilters(next: TaskQueueFilters) {
    setPage(0);
    setFilters((current) => ({ ...current, ...next }));
  }

  function toggleTaskSelection(taskId: string, selected: boolean) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (selected) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function toggleVisibleSelection(selected: boolean) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      for (const task of visibleTasks) {
        if (selected) next.add(task.id);
        else next.delete(task.id);
      }
      return next;
    });
  }

  function runSelectedBatch(action: 'retry' | 'cancel' | 'rebuild') {
    if (action === 'retry') onBatchRetrySelected(selectedBatchTargets.retryableTaskIds);
    if (action === 'cancel') onBatchCancelSelected(selectedBatchTargets.cancellableTaskIds);
    if (action === 'rebuild') onBatchRebuildSelectedIndexes(selectedBatchTargets.rebuildBookIds);
    setSelectedTaskIds(new Set());
  }

  return (
    <section className="task-queue-section" aria-label={t('tasks.queue.title')}>
      <div className="task-section-heading">
        <div>
          <p className="eyebrow">{t('tasks.queue.eyebrow')}</p>
          <h2>{t('tasks.queue.title')}</h2>
        </div>
        <span>{t('tasks.queue.page', { current: formatTaskNumber(page + 1), total: formatTaskNumber(pageCount) })}</span>
      </div>
      <div className="task-queue-filters" aria-label={t('tasks.filter.aria')}>
        <label className="task-filter-control">
          <span>{t('tasks.filter.book')}</span>
          <input
            list="task-filter-books"
            onChange={(event) => updateFilters({ bookQuery: event.target.value })}
            placeholder={t('tasks.filter.bookPlaceholder')}
            value={filters.bookQuery ?? ''}
          />
        </label>
        <datalist id="task-filter-books">
          {filterOptions.books.map((book) => <option key={book.id} value={book.label}>{book.id}</option>)}
        </datalist>
        <ThemedSelect className="task-filter-select" label={t('tasks.filter.kind')} menuPlacement="bottom" onChange={(kind) => updateFilters({ kind })} options={[{ value: 'all', label: t('tasks.filter.allKinds') }, ...filterOptions.kinds.map((kind) => ({ value: kind, label: kind }))]} value={filters.kind ?? 'all'} />
        <ThemedSelect className="task-filter-select" label={t('tasks.filter.status')} menuPlacement="bottom" onChange={(status) => updateFilters({ status })} options={visibleStatusOptions.map((status) => ({ value: status, label: status === 'all' ? t('tasks.filter.allStatuses') : statusLabel(status as TaskStatus['status'], t) }))} value={effectiveStatus} />
        <ThemedSelect className="task-filter-select" label={t('tasks.filter.time')} menuPlacement="bottom" onChange={(timeRange) => updateFilters({ timeRange })} options={timeRangeOptions.map((range) => ({ value: range.value, label: t(range.labelKey) }))} value={filters.timeRange ?? 'all'} />
        <ThemedSelect className="task-filter-select" label={t('tasks.filter.errorCode')} menuPlacement="bottom" onChange={(errorCode) => updateFilters({ errorCode })} options={[{ value: 'all', label: t('tasks.filter.allErrorCodes') }, ...filterOptions.errorCodes.map((errorCode) => ({ value: errorCode, label: errorCode }))]} value={filters.errorCode ?? 'all'} />
        <span className="task-filter-count">{t('tasks.filter.resultCount', { count: formatTaskNumber(queueView.filteredCount) })}</span>
      </div>
      <div className="task-batch-toolbar" aria-label={t('tasks.batch.aria')}>
        <strong>{t('tasks.batch.selected', { count: formatTaskNumber(selectedBatchTargets.selectedCount) })}</strong>
        <button className="ghost-btn small" disabled={busy || selectedBatchTargets.retryableTaskIds.length === 0} onClick={() => runSelectedBatch('retry')}>{t('tasks.batch.retrySelectedFailed')}</button>
        <button className="ghost-btn small" disabled={busy || selectedBatchTargets.cancellableTaskIds.length === 0} onClick={() => runSelectedBatch('cancel')}>{t('tasks.batch.cancelSelectedQueued')}</button>
        <button className="ghost-btn small" disabled={busy} onClick={onBatchClearCompleted}>{t('tasks.batch.clearCompleted')}</button>
        <button className="ghost-btn small" disabled={busy || selectedBatchTargets.rebuildBookIds.length === 0} onClick={() => runSelectedBatch('rebuild')}>{t('tasks.batch.rebuildSelectedIndexes')}</button>
      </div>
      <div className="task-queue-select-row">
        <label>
          <input aria-label={t('tasks.batch.selectVisible')} checked={allVisibleSelected} onChange={(event) => toggleVisibleSelection(event.target.checked)} type="checkbox" />
          <span>{t('tasks.batch.selectVisible')}</span>
        </label>
      </div>
      <div className="task-queue-table task-queue-card-list">
        {visibleTasks.length === 0 ? (
          <div className="task-table-empty task-empty-guide">
            <strong>{t('tasks.none')}</strong>
            <div className="task-empty-actions">
              <button className="primary-btn small" disabled={busy} onClick={onImportTxt}>{t('tasks.emptyGuide.importTxt')}</button>
              <button className="ghost-btn small" disabled={busy} onClick={onImportDirectory}>{t('tasks.emptyGuide.chooseDirectory')}</button>
              <button className="ghost-btn small" disabled={busy} onClick={onRunSample}>{t('tasks.emptyGuide.runSample')}</button>
              <button className="ghost-btn small" onClick={onLearnIndexArtifacts}>{t('tasks.emptyGuide.learnIndexArtifacts')}</button>
            </div>
          </div>
        ) : null}
        {visibleTasks.map((task) => (
          <TaskQueueRow
            busy={busy}
            key={task.id}
            onArchive={onArchive}
            onControl={onControl}
            onOpenDetails={onOpenDetails}
            onOpenLogs={onOpenLogs}
            onSelect={toggleTaskSelection}
            privacyMode={privacyMode}
            selected={selectedTaskIds.has(task.id)}
            task={task}
            actionsOpen={openActionTaskId === task.id}
            onCloseActions={() => setOpenActionTaskId('')}
            onToggleActions={(taskId) => setOpenActionTaskId((current) => current === taskId ? '' : taskId)}
          />
        ))}
      </div>
      <div className="task-pagination">
        <button className="ghost-btn small" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>{t('tasks.pagination.prev')}</button>
        <button className="ghost-btn small" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>{t('tasks.pagination.next')}</button>
      </div>
    </section>
  );
}

const TaskQueueRow = memo(function TaskQueueRow({ actionsOpen, busy, task, onArchive, onCloseActions, onControl, onOpenDetails, onOpenLogs, onSelect, onToggleActions, privacyMode, selected }: {
  busy: boolean;
  task: TaskStatus;
  onArchive: (taskId: string) => void;
  onControl: (taskId: string, action: 'pause' | 'cancel' | 'retry' | 'restore') => void;
  onOpenDetails: (taskId: string) => void;
  onOpenLogs: (taskId: string) => void;
  onSelect: (taskId: string, selected: boolean) => void;
  privacyMode: boolean;
  selected: boolean;
  actionsOpen: boolean;
  onCloseActions: () => void;
  onToggleActions: (taskId: string) => void;
}) {
  const { t } = useI18n();
  const canPause = task.status === 'queued' || task.status === 'running';
  const canRetry = task.status === 'paused' || task.status === 'failed' || task.status === 'cancelled';
  const canRestore = canRestoreArchivedTask(task);
  const canCancel = !['succeeded', 'skipped', 'archived', 'cancelled'].includes(task.status);
  const canArchive = task.status !== 'archived';
  const durationMs = task.durationMs;
  const updatedAt = task.updatedAt;
  const errorCode = task.errorCode;
  const updatedTime = formatTaskRelativeTime(updatedAt);
  const progressMessage = task.message.trim();
  const bookLabel = redactTaskText(task.bookTitle || task.bookId || '-', privacyMode);
  const taskLabel = redactTaskText(task.name, privacyMode);

  function toggleCardActions() {
    onToggleActions(task.id);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleCardActions();
  }

  function runMenuAction(action: () => void) {
    onCloseActions();
    action();
  }

  return (
    <article
      className={actionsOpen ? 'task-queue-card open' : 'task-queue-card'}
      onClick={toggleCardActions}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={actionsOpen}
      aria-label={taskLabel}
    >
      <label className="task-queue-card-check" onClick={(event) => event.stopPropagation()}>
        <input
          aria-label={t('tasks.batch.selectTask', { name: task.name })}
          checked={selected}
          onChange={(event) => onSelect(task.id, event.target.checked)}
          type="checkbox"
        />
      </label>
      <div className="task-queue-card-main task-cell-main">
        <div className="task-queue-card-title">
          <strong>{taskLabel}</strong>
          <span className={`task-status-pill ${task.status}`}><b aria-hidden="true">{statusGlyph(task.status)}</b>{statusLabel(task.status, t)}</span>
        </div>
        <div className="task-queue-card-meta">
          <span>{bookLabel}</span>
          <span>{task.kind}</span>
          <span>{task.stageLabel}</span>
          <span>{formatTaskSeconds(durationMs)}</span>
          <time title={updatedTime.title}>{updatedTime.label}</time>
        </div>
        <div className="task-queue-card-progress">
          <div className="progress"><i className={task.tone} style={{ width: `${task.progress}%` }} /></div>
          <span className="task-progress-text">{formatTaskPercent(task.progress)}</span>
          {progressMessage ? <span className="task-progress-message" title={redactTaskText(progressMessage, privacyMode)}>{redactTaskText(progressMessage, privacyMode)}</span> : null}
        </div>
        {errorCode ? <em>{errorCode}</em> : null}
      </div>
      <button
        className="task-queue-card-menu-btn"
        type="button"
        aria-label={actionsOpen ? t('common.cancel') : t('tasks.table.action')}
        aria-expanded={actionsOpen}
        onClick={(event) => {
          event.stopPropagation();
          toggleCardActions();
        }}
      >
        <BookMindIcon name="more" />
      </button>
      {actionsOpen ? (
        <div className="task-queue-card-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          <TaskMenuButton icon="note" label={t('tasks.detail.open')} onClick={() => runMenuAction(() => onOpenDetails(task.id))} />
          <TaskMenuButton icon="logs" label={t('tasks.log')} onClick={() => runMenuAction(() => onOpenLogs(task.id))} />
          {canPause ? <TaskMenuButton disabled={busy} icon="pause" label={t('tasks.pause')} onClick={() => runMenuAction(() => onControl(task.id, 'pause'))} /> : null}
          {canRetry ? <TaskMenuButton disabled={busy} icon="retry" label={task.status === 'failed' || task.status === 'cancelled' ? t('tasks.retry') : t('tasks.resume')} onClick={() => runMenuAction(() => onControl(task.id, 'retry'))} /> : null}
          {canRestore ? <TaskMenuButton disabled={busy} icon="retry" label={t('tasks.action.restore')} onClick={() => runMenuAction(() => onControl(task.id, 'restore'))} /> : null}
          {canCancel ? <TaskMenuButton danger disabled={busy} icon="stop" label={t('tasks.cancel')} onClick={() => runMenuAction(() => onControl(task.id, 'cancel'))} /> : null}
          {canArchive ? <TaskMenuButton disabled={busy} icon="saveCommand" label={t('tasks.action.archive')} onClick={() => runMenuAction(() => onArchive(task.id))} /> : null}
        </div>
      ) : null}
    </article>
  );
});

function TaskMenuButton({ danger = false, disabled = false, icon, label, onClick }: {
  danger?: boolean;
  disabled?: boolean;
  icon: BookMindIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={danger ? 'task-menu-btn danger' : 'task-menu-btn'}
      data-tooltip={label}
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      title={label}
      type="button"
    >
      <BookMindIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function statusGlyph(status: TaskStatus['status']) {
  if (status === 'running' || status === 'cancelling') return '>';
  if (status === 'succeeded' || status === 'skipped') return 'OK';
  if (status === 'failed' || status === 'cancelled') return '!';
  if (status === 'paused') return '||';
  if (status === 'archived') return '#';
  return '..';
}

function statusLabel(status: TaskStatus['status'], t: ReturnType<typeof useI18n>['t']) {
  if (status === 'running') return t('tasks.status.running');
  if (status === 'succeeded') return t('tasks.status.succeeded');
  if (status === 'paused') return t('tasks.status.paused');
  if (status === 'cancelling') return t('tasks.status.cancelling');
  if (status === 'cancelled') return t('tasks.status.cancelled');
  if (status === 'failed') return t('tasks.status.failed');
  if (status === 'skipped') return t('tasks.status.skipped');
  if (status === 'archived') return t('tasks.status.archived');
  return t('tasks.status.queued');
}

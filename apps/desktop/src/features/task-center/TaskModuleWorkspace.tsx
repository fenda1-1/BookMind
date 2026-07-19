import { useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import type { BookIndexManifest, IndexDiagnostics, IndexedChunksPreview, TaskLogRecord, TaskStatus } from '../../types';
import { formatTaskNumber, formatTaskPercent, formatTaskSeconds } from './taskFormat';
import { formatTaskRelativeTime } from './taskTime';
import { redactTaskText } from './taskPrivacy';
import { IndexManifestBrowser } from './IndexManifestBrowser';
import { TaskDetailPanel } from './TaskDetailPanel';
import { TaskHealthDashboard } from './TaskHealthDashboard';
import { TaskLogConsole } from './TaskLogConsole';
import { TaskQueueTable } from './TaskQueueTable';
import { canRestoreArchivedTask } from './taskBatchSelection';

export type TaskCenterModule = 'queue' | 'index' | 'logs' | 'resources';
type TaskControlAction = 'pause' | 'cancel' | 'retry' | 'restore';
type TaskQueueWorkspaceView = 'tasks' | 'manage' | 'status';
type TaskLogWorkspaceView = 'overview' | 'manage';

type TaskModuleWorkspaceProps = {
  activeModule: TaskCenterModule;
  books: BookIndexManifest[];
  busy: boolean;
  diagnostics: IndexDiagnostics | null;
  errorDetailsDefaultExpanded: boolean;
  filter: string;
  initialChunkPreview?: IndexedChunksPreview | null;
  logs: TaskLogRecord[];
  privacyMode: boolean;
  selectedTask: TaskStatus | null;
  tasks: TaskStatus[];
  onArchive: (taskId: string) => void;
  onBatchCancelSelected: (taskIds: string[]) => void;
  onBatchClearCompleted: () => void;
  onBatchRebuildSelectedIndexes: (bookIds: string[]) => void;
  onBatchRetrySelected: (taskIds: string[]) => void;
  onClearLogs: (scope: 'all' | 'completed' | 'failed' | 'task') => void;
  onControl: (taskId: string, action: TaskControlAction) => void;
  onDeleteIndex: (bookId: string) => void;
  onFilter: (filter: string) => void;
  onImportDirectory: () => void;
  onImportIndexEntry: () => void;
  onImportTxt: () => void;
  onLearnIndexArtifacts: () => void;
  onLoadAllLogs: () => void;
  onOpenDetails: (taskId: string) => void;
  onCloseDetails: () => void;
  onOpenLogs: (taskId?: string) => void;
  onOpenTaskSettings?: () => void;
  onRebuildIndex: (bookId: string) => void;
  onRepairFts: (bookId: string) => void;
  onRunSample: () => void;
};

export function TaskModuleWorkspace({
  activeModule,
  books,
  busy,
  diagnostics,
  errorDetailsDefaultExpanded,
  filter,
  initialChunkPreview = null,
  logs,
  privacyMode,
  selectedTask,
  tasks,
  onArchive,
  onBatchCancelSelected,
  onBatchClearCompleted,
  onBatchRebuildSelectedIndexes,
  onBatchRetrySelected,
  onClearLogs,
  onControl,
  onDeleteIndex,
  onFilter,
  onImportDirectory,
  onImportIndexEntry,
  onImportTxt,
  onLearnIndexArtifacts,
  onLoadAllLogs,
  onOpenDetails,
  onCloseDetails,
  onOpenLogs,
  onOpenTaskSettings,
  onRebuildIndex,
  onRepairFts,
  onRunSample,
}: TaskModuleWorkspaceProps) {
  const { t } = useI18n();
  const [queueWorkspaceView, setQueueWorkspaceView] = useState<TaskQueueWorkspaceView>('tasks');
  const [logWorkspaceView, setLogWorkspaceView] = useState<TaskLogWorkspaceView>('overview');
  const activeTaskCount = tasks.filter((task) => task.status === 'running' || task.status === 'queued' || task.status === 'cancelling').length;
  const errorLogCount = logs.filter((log) => log.level === 'error').length;
  const taskDetailPopover = selectedTask ? (
    <div className="task-detail-popover" role="presentation">
      <button className="task-detail-popover-backdrop" type="button" aria-label={t('tasks.detail.close')} onClick={onCloseDetails} />
      <TaskDetailPanel
        errorDetailsDefaultExpanded={errorDetailsDefaultExpanded}
        logs={logs}
        onClose={onCloseDetails}
        onOpenLogs={onOpenLogs}
        privacyMode={privacyMode}
        task={selectedTask}
      />
    </div>
  ) : null;

  return (
    <div className="task-module-workspace" aria-live="polite">
      <section className={activeModule === 'index' ? 'task-module-panel active' : 'task-module-panel'} hidden={activeModule !== 'index'}>
        <div className="task-workspace-scroll task-index-workspace-scroll">
          <IndexManifestBrowser
            books={books}
            initialChunkPreview={initialChunkPreview}
            onDeleteIndex={onDeleteIndex}
            onImportIndexEntry={onImportIndexEntry}
            onRebuildIndex={onRebuildIndex}
            onRepairFts={onRepairFts}
            privacyMode={privacyMode}
          />
        </div>
      </section>

      <section className={activeModule === 'queue' ? 'task-module-panel active' : 'task-module-panel'} hidden={activeModule !== 'queue'}>
        <div className="task-workspace-body">
          <div className="task-queue-page-shell">
            <nav className="task-queue-view-tabs" aria-label={t('tasks.queue.views.aria')} role="tablist">
              <button aria-controls="task-queue-view-tasks" aria-selected={queueWorkspaceView === 'tasks'} className={queueWorkspaceView === 'tasks' ? 'active' : ''} id="task-queue-tab-tasks" onClick={() => setQueueWorkspaceView('tasks')} role="tab" type="button">
                <BookMindIcon name="tasks" />
                <span>{t('tasks.queue.views.tasks')}</span>
                <strong>{formatTaskNumber(tasks.length)}</strong>
              </button>
              <button aria-controls="task-queue-view-manage" aria-selected={queueWorkspaceView === 'manage'} className={queueWorkspaceView === 'manage' ? 'active' : ''} id="task-queue-tab-manage" onClick={() => setQueueWorkspaceView('manage')} role="tab" type="button">
                <BookMindIcon name="search" />
                <span>{t('tasks.queue.views.manage')}</span>
              </button>
              <button aria-controls="task-queue-view-status" aria-selected={queueWorkspaceView === 'status'} className={queueWorkspaceView === 'status' ? 'active' : ''} id="task-queue-tab-status" onClick={() => setQueueWorkspaceView('status')} role="tab" type="button">
                <BookMindIcon name="diagnostics" />
                <span>{t('tasks.queue.views.status')}</span>
                <strong>{formatTaskNumber(activeTaskCount)}</strong>
              </button>
            </nav>
            <div className="task-queue-view-stack">
              <section aria-labelledby="task-queue-tab-tasks" className="task-queue-view task-queue-view-tasks" hidden={queueWorkspaceView !== 'tasks'} id="task-queue-view-tasks" role="tabpanel">
                <TaskExecutionDeck
                  busy={busy}
                  tasks={tasks}
                  privacyMode={privacyMode}
                  onArchive={onArchive}
                  onControl={onControl}
                  onImportDirectory={onImportDirectory}
                  onImportTxt={onImportTxt}
                  onLearnIndexArtifacts={onLearnIndexArtifacts}
                  onOpenDetails={onOpenDetails}
                  onOpenLogs={onOpenLogs}
                  onRunSample={onRunSample}
                />
              </section>
              <section aria-labelledby="task-queue-tab-manage" className="task-queue-view task-queue-view-manage" hidden={queueWorkspaceView !== 'manage'} id="task-queue-view-manage" role="tabpanel">
                <TaskQueueTable
                  busy={busy}
                  filter={filter}
                  onArchive={onArchive}
                  onBatchCancelSelected={onBatchCancelSelected}
                  onBatchClearCompleted={onBatchClearCompleted}
                  onBatchRebuildSelectedIndexes={onBatchRebuildSelectedIndexes}
                  onBatchRetrySelected={onBatchRetrySelected}
                  onControl={onControl}
                  onImportDirectory={onImportDirectory}
                  onImportTxt={onImportTxt}
                  onLearnIndexArtifacts={onLearnIndexArtifacts}
                  onOpenDetails={onOpenDetails}
                  onOpenLogs={onOpenLogs}
                  privacyMode={privacyMode}
                  onRunSample={onRunSample}
                  tasks={tasks}
                />
              </section>
              <section aria-labelledby="task-queue-tab-status" className="task-queue-view task-queue-view-status" hidden={queueWorkspaceView !== 'status'} id="task-queue-view-status" role="tabpanel">
                <TaskHealthDashboard
                  diagnostics={diagnostics}
                  tasks={tasks}
                  onFilter={(nextFilter) => {
                    onFilter(nextFilter);
                    setQueueWorkspaceView('manage');
                  }}
                />
              </section>
            </div>
          </div>
          {taskDetailPopover && typeof document !== 'undefined'
            ? createPortal(taskDetailPopover, document.querySelector<HTMLElement>('.app-shell') ?? document.body)
            : taskDetailPopover}
        </div>
      </section>

      <section className={activeModule === 'logs' ? 'task-module-panel active' : 'task-module-panel'} hidden={activeModule !== 'logs'}>
        <div className="task-log-page-shell">
          <nav className="task-queue-view-tabs task-log-view-tabs" aria-label={t('tasks.logs.views.aria')} role="tablist">
            <button aria-controls="task-log-view-overview" aria-selected={logWorkspaceView === 'overview'} className={logWorkspaceView === 'overview' ? 'active' : ''} id="task-log-tab-overview" onClick={() => setLogWorkspaceView('overview')} role="tab" type="button">
              <BookMindIcon name="logs" />
              <span>{t('tasks.logs.views.overview')}</span>
              <strong>{formatTaskNumber(logs.length)}</strong>
            </button>
            <button aria-controls="task-log-view-manage" aria-selected={logWorkspaceView === 'manage'} className={logWorkspaceView === 'manage' ? 'active' : ''} id="task-log-tab-manage" onClick={() => setLogWorkspaceView('manage')} role="tab" type="button">
              <BookMindIcon name="search" />
              <span>{t('tasks.logs.views.manage')}</span>
              <strong>{formatTaskNumber(errorLogCount)}</strong>
            </button>
          </nav>
          <div className="task-queue-view-stack task-log-view-stack">
            <section aria-labelledby="task-log-tab-overview" className="task-queue-view task-log-view task-log-view-overview" hidden={logWorkspaceView !== 'overview'} id="task-log-view-overview" role="tabpanel">
              <TaskDiagnosticTerminal logs={logs} privacyMode={privacyMode} onClearLogs={onClearLogs} onLoadAllLogs={onLoadAllLogs} />
            </section>
            <section aria-labelledby="task-log-tab-manage" className="task-queue-view task-log-view task-log-view-manage" hidden={logWorkspaceView !== 'manage'} id="task-log-view-manage" role="tabpanel">
              <TaskLogConsole logs={logs} privacyMode={privacyMode} onClearLogs={onClearLogs} onLoadAllLogs={onLoadAllLogs} />
            </section>
          </div>
        </div>
      </section>

      <section className={activeModule === 'resources' ? 'task-module-panel active' : 'task-module-panel'} hidden={activeModule !== 'resources'}>
        <div className="task-workspace-scroll">
          <TaskResourcePolicyPanel diagnostics={diagnostics} tasks={tasks} onOpenTaskSettings={onOpenTaskSettings} />
        </div>
      </section>
    </div>
  );
}

function TaskExecutionDeck({ busy, tasks, privacyMode, onArchive, onControl, onImportDirectory, onImportTxt, onLearnIndexArtifacts, onOpenDetails, onOpenLogs, onRunSample }: {
  busy: boolean;
  tasks: TaskStatus[];
  privacyMode: boolean;
  onArchive: (taskId: string) => void;
  onControl: (taskId: string, action: TaskControlAction) => void;
  onImportDirectory: () => void;
  onImportTxt: () => void;
  onLearnIndexArtifacts: () => void;
  onOpenDetails: (taskId: string) => void;
  onOpenLogs: (taskId?: string) => void;
  onRunSample: () => void;
}) {
  const { t } = useI18n();
  const [openActionTaskId, setOpenActionTaskId] = useState('');
  const visibleTasks = tasks;
  const activeCount = tasks.filter((task) => task.status === 'running' || task.status === 'queued' || task.status === 'cancelling').length;
  return (
    <section className="task-execution-deck" aria-label={t('tasks.execution.aria')}>
      <div className="task-section-heading task-execution-heading">
        <div><p className="eyebrow">{t('tasks.execution.eyebrow')}</p><h2>{t('tasks.execution.title')}</h2></div>
        <span className="task-execution-count">{t('tasks.execution.count', { active: formatTaskNumber(activeCount), total: formatTaskNumber(tasks.length) })}</span>
      </div>
      <div className="task-execution-toolbar" aria-label={t('tasks.execution.quickActions')}>
        <button className="primary-btn small" disabled={busy} onClick={onImportTxt}>{t('tasks.emptyGuide.importTxt')}</button>
        <button className="ghost-btn small" disabled={busy} onClick={onImportDirectory}>{t('tasks.emptyGuide.chooseDirectory')}</button>
        <button className="ghost-btn small" disabled={busy} onClick={onRunSample}>{t('tasks.emptyGuide.runSample')}</button>
        <button className="ghost-btn small" onClick={onLearnIndexArtifacts}>{t('tasks.emptyGuide.learnIndexArtifacts')}</button>
      </div>
      {visibleTasks.length === 0 ? <p className="task-table-empty task-empty-guide"><strong>{t('tasks.execution.emptyTitle')}</strong><span>{t('tasks.execution.emptyDescription')}</span></p> : null}
      <div className="task-card-grid">
        {visibleTasks.map((task) => (
          <TaskExecutionCard
            actionsOpen={openActionTaskId === task.id}
            busy={busy}
            key={task.id}
            onArchive={onArchive}
            onCloseActions={() => setOpenActionTaskId('')}
            onControl={onControl}
            onOpenDetails={onOpenDetails}
            onOpenLogs={onOpenLogs}
            onToggleActions={(taskId) => setOpenActionTaskId((current) => current === taskId ? '' : taskId)}
            privacyMode={privacyMode}
            task={task}
          />
        ))}
      </div>
    </section>
  );
}

function TaskExecutionCard({ actionsOpen, busy, task, onArchive, onCloseActions, onControl, onOpenDetails, onOpenLogs, onToggleActions, privacyMode }: {
  actionsOpen: boolean;
  busy: boolean;
  task: TaskStatus;
  onArchive: (taskId: string) => void;
  onCloseActions: () => void;
  onControl: (taskId: string, action: TaskControlAction) => void;
  onOpenDetails: (taskId: string) => void;
  onOpenLogs: (taskId?: string) => void;
  onToggleActions: (taskId: string) => void;
  privacyMode: boolean;
}) {
  const { t } = useI18n();
  const updatedTime = formatTaskRelativeTime(task.updatedAt);
  const canPause = task.status === 'queued' || task.status === 'running';
  const canRetry = task.status === 'paused' || task.status === 'failed' || task.status === 'cancelled';
  const canRestore = canRestoreArchivedTask(task);
  const canCancel = !['succeeded', 'skipped', 'archived', 'cancelled'].includes(task.status);
  const canArchive = task.status !== 'archived';
  const progressMessage = task.message.trim();
  const taskLabel = redactTaskText(task.name, privacyMode);
  const bookLabel = redactTaskText(task.bookTitle || task.bookId || t('tasks.execution.noBook'), privacyMode);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });

  function toggleCardActions() {
    if (!actionsOpen) positionCardActions();
    onToggleActions(task.id);
  }

  function positionCardActions() {
    const trigger = menuTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const itemCount = 2 + Number(canPause) + Number(canRetry) + Number(canRestore) + Number(canCancel) + Number(canArchive);
    const menuWidth = 214;
    const menuHeight = itemCount * 46 + 16;
    const left = Math.max(10, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 10));
    const above = rect.top - menuHeight - 8;
    const top = above >= 10 ? above : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 10);
    setMenuPosition({ left, top: Math.max(10, top) });
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
      aria-expanded={actionsOpen}
      aria-label={taskLabel}
      className={`task-execution-card ${task.status}${actionsOpen ? ' open' : ''}`}
      onClick={toggleCardActions}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="task-execution-head"><span className="task-command-icon"><BookMindIcon name={task.status === 'failed' ? 'diagnostics' : task.status === 'running' ? 'play' : 'tasks'} /></span><div><strong>{taskLabel}</strong><small title={bookLabel}>{bookLabel}</small><small>{task.kind} · {task.stageLabel}</small></div></div>
      <div className="task-execution-progress">
        <div><span>{t('tasks.table.progress')}</span><strong>{formatTaskPercent(task.progress)}</strong></div>
        <div className="progress"><i className={task.tone} style={{ width: `${task.progress}%` }} /></div>
        {progressMessage ? <p className="task-execution-message" title={redactTaskText(progressMessage, privacyMode)}>{redactTaskText(progressMessage, privacyMode)}</p> : null}
      </div>
      <div className="task-execution-meta"><span className={`task-status-pill ${task.status}`}>{statusLabel(task.status, t)}</span><span>{formatTaskSeconds(task.durationMs)}</span><time title={updatedTime.title}>{updatedTime.label}</time></div>
      {task.errorCode ? <p className="task-execution-error">{redactTaskText(task.errorCode, privacyMode)}</p> : null}
      <button
        ref={menuTriggerRef}
        aria-expanded={actionsOpen}
        aria-label={actionsOpen ? t('common.cancel') : t('tasks.table.action')}
        className="task-queue-card-menu-btn task-execution-menu-trigger"
        onClick={(event) => {
          event.stopPropagation();
          toggleCardActions();
        }}
        type="button"
      >
        <BookMindIcon name="more" />
        <span>{t('tasks.table.action')}</span>
      </button>
      {actionsOpen ? createPortal(
        <div className="task-floating-menu task-execution-card-menu" role="menu" style={{ left: menuPosition.left, top: menuPosition.top, right: 'auto', bottom: 'auto' }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <TaskExecutionMenuButton icon="note" label={t('tasks.execution.details')} onClick={() => runMenuAction(() => onOpenDetails(task.id))} />
          <TaskExecutionMenuButton icon="logs" label={t('tasks.log')} onClick={() => runMenuAction(() => onOpenLogs(task.id))} />
          {canPause ? <TaskExecutionMenuButton disabled={busy} icon="pause" label={t('tasks.pause')} onClick={() => runMenuAction(() => onControl(task.id, 'pause'))} /> : null}
          {canRetry ? <TaskExecutionMenuButton disabled={busy} icon="retry" label={t('tasks.retry')} onClick={() => runMenuAction(() => onControl(task.id, 'retry'))} /> : null}
          {canRestore ? <TaskExecutionMenuButton disabled={busy} icon="retry" label={t('tasks.execution.restore')} onClick={() => runMenuAction(() => onControl(task.id, 'restore'))} /> : null}
          {canCancel ? <TaskExecutionMenuButton danger disabled={busy} icon="stop" label={t('tasks.cancel')} onClick={() => runMenuAction(() => onControl(task.id, 'cancel'))} /> : null}
          {canArchive ? <TaskExecutionMenuButton disabled={busy} icon="saveCommand" label={t('tasks.action.archive')} onClick={() => runMenuAction(() => onArchive(task.id))} /> : null}
        </div>,
        document.querySelector<HTMLElement>('.app-shell') ?? document.body,
      ) : null}
    </article>
  );
}

function TaskExecutionMenuButton({ danger = false, disabled = false, icon, label, onClick }: {
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

function TaskDiagnosticTerminal({ logs, onClearLogs, onLoadAllLogs, privacyMode }: { logs: TaskLogRecord[]; onClearLogs: (scope: 'all' | 'completed' | 'failed' | 'task') => void; onLoadAllLogs: () => void; privacyMode: boolean }) {
  const { t } = useI18n();
  const counts = logs.reduce((acc, log) => ({ ...acc, [log.level]: (acc[log.level] ?? 0) + 1 }), {} as Record<TaskLogRecord['level'], number>);
  const visibleLogs = logs.slice(-12).reverse();
  return (
    <section className="task-diagnostic-terminal" aria-label={t('tasks.diagnostics.aria')}>
      <header className="task-diagnostic-header">
        <div><p className="eyebrow">{t('tasks.logs.eyebrow')}</p><h2>{t('tasks.diagnostics.title')}</h2></div>
        <div className="task-diagnostic-actions">
          <button className="task-icon-btn" data-tooltip={t('tasks.diagnostics.allLogs')} title={t('tasks.diagnostics.allLogs')} aria-label={t('tasks.diagnostics.allLogs')} type="button" onClick={onLoadAllLogs}><BookMindIcon name="copy" /></button>
          <button className="task-icon-btn danger" data-tooltip={t('tasks.logs.clearFailed')} title={t('tasks.logs.clearFailed')} aria-label={t('tasks.logs.clearFailed')} type="button" onClick={() => onClearLogs('failed')}><BookMindIcon name="close" /></button>
          <button className="task-icon-btn danger" data-tooltip={t('tasks.logs.clearAll')} title={t('tasks.logs.clearAll')} aria-label={t('tasks.logs.clearAll')} type="button" onClick={() => onClearLogs('all')}><BookMindIcon name="stop" /></button>
        </div>
      </header>
      <div className="task-diagnostic-summary">
        <SeverityCard detail={t('tasks.diagnostics.errorDetail')} icon="diagnostics" title={t('tasks.diagnostics.errors')} tone="error" value={counts.error ?? 0} />
        <SeverityCard detail={t('tasks.diagnostics.warningDetail')} icon="wrench" title={t('tasks.diagnostics.warnings')} tone="warn" value={counts.warn ?? 0} />
        <SeverityCard detail={t('tasks.diagnostics.logDetail')} icon="logs" title={t('tasks.diagnostics.logs')} tone="info" value={logs.length} />
      </div>
      <div className="task-terminal-main">
        <div className="task-terminal-columns" aria-hidden="true"><span>{t('tasks.table.updated')}</span><span>{t('tasks.logs.levelFilter')}</span><span>{t('tasks.table.stage')}</span><span>{t('tasks.logs.message')}</span></div>
        <div className="task-terminal-list">{visibleLogs.length === 0 ? <p className="empty-hint">{t('tasks.diagnostics.empty')}</p> : null}{visibleLogs.map((log) => { const logTime = formatTaskRelativeTime(log.createdAt); return <p className={`task-terminal-row ${log.level}`} key={log.id}><time title={logTime.title}>{logTime.label}</time><strong>{log.level}</strong><span>{log.stage}</span><code title={redactTaskText(log.message, privacyMode)}>{redactTaskText(log.message, privacyMode)}</code></p>; })}</div>
      </div>
    </section>
  );
}

function SeverityCard({ detail, icon, title, tone, value }: { detail: string; icon: 'diagnostics' | 'wrench' | 'logs'; title: string; tone: 'error' | 'warn' | 'info'; value: number }) {
  return <article className={`task-severity-card ${tone}`}><span className="task-command-icon"><BookMindIcon name={icon} /></span><div><span>{title}</span><strong>{formatTaskNumber(value)}</strong><small>{detail}</small></div></article>;
}

function TaskResourcePolicyPanel({ diagnostics, tasks, onOpenTaskSettings }: { diagnostics: IndexDiagnostics | null; tasks: TaskStatus[]; onOpenTaskSettings?: () => void }) {
  const { t } = useI18n();
  const liveTasks = tasks.filter((task) => task.status === 'running' || task.status === 'queued').length;
  return (
    <section className="task-resource-panel" aria-label={t('tasks.resources.aria')}>
      <div className="task-section-heading"><div><p className="eyebrow">{t('tasks.resources.eyebrow')}</p><h2>{t('tasks.resources.title')}</h2></div><button className="primary-btn small" disabled={!onOpenTaskSettings} onClick={onOpenTaskSettings}>{t('tasks.resources.openSettings')}</button></div>
      <div className="task-resource-grid"><article><BookMindIcon name="wrench" /><strong>{formatTaskNumber(liveTasks)}</strong><span>{t('tasks.resources.activeQueued')}</span></article><article><BookMindIcon name="index" /><strong>{diagnostics?.summary.ftsAvailable ? 'Ready' : 'Missing'}</strong><span>{t('tasks.resources.ftsDatabase')}</span></article><article><BookMindIcon name="diagnostics" /><strong>{formatTaskNumber(diagnostics?.summary.recentErrors?.length ?? 0)}</strong><span>{t('tasks.resources.recentErrors')}</span></article><article><BookMindIcon name="readerSettings" /><strong>{t('tasks.resources.privacy')}</strong><span>{t('tasks.resources.privacyDetail')}</span></article></div>
    </section>
  );
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

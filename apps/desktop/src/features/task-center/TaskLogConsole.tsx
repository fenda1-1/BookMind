import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import type { TaskLogRecord } from '../../types';
import { formatTaskRelativeTime } from './taskTime';
import { redactTaskText } from './taskPrivacy';
import { getLargeTaskLogView } from './taskPerformanceModel';
import { copyRecentErrorLogs, copyVisibleTaskLogs, formatTaskLogsJsonl, formatTaskLogsMarkdown } from './taskLogExport';

type TaskLogConsoleProps = {
  logs: TaskLogRecord[];
  onClearLogs: (scope: 'all' | 'completed' | 'failed' | 'task') => void;
  onLoadAllLogs: () => void;
  privacyMode: boolean;
};

const ERROR_LOG_COPY_LIMIT = 100;
const LOG_ROW_HEIGHT = 38;
const LOG_VIEWPORT_HEIGHT = 520;

export function TaskLogConsole({ logs, onClearLogs, onLoadAllLogs, privacyMode }: TaskLogConsoleProps) {
  const { t } = useI18n();
  const [levelFilter, setLevelFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const logView = useMemo(() => getLargeTaskLogView(logs, {
    levelFilter,
    privacyMode,
    query,
    rowHeight: LOG_ROW_HEIGHT,
    scrollTop,
    viewportHeight: LOG_VIEWPORT_HEIGHT,
    overscan: 6,
  }), [levelFilter, logs, privacyMode, query, scrollTop]);
  const visibleLogs = logView.filteredLogs;
  const virtualWindow = logView.window;
  const windowedLogs = logView.rows;
  const exportDate = () => new Date().toISOString().slice(0, 10);

  return (
    <section className="task-log-console" aria-label={t('tasks.logs.title')}>
      <div className="task-section-heading">
        <div>
          <p className="eyebrow">{t('tasks.logs.eyebrow')}</p>
          <h2>{t('tasks.logs.title')}</h2>
        </div>
        <TaskLogIconButton disabled={false} icon="copy" label={t('tasks.logs.all')} onClick={onLoadAllLogs} />
      </div>
      <div className="task-log-filterbar">
        <ThemedSelect
          ariaLabel={t('tasks.logs.levelFilter')}
          className="task-filter-select task-log-level-select"
          label={t('tasks.logs.levelFilter')}
          menuPlacement="bottom"
          onChange={setLevelFilter}
          options={[
            { value: 'all', label: t('tasks.logs.levelAll') },
            { value: 'debug', label: 'debug' },
            { value: 'info', label: 'info' },
            { value: 'warn', label: 'warn' },
            { value: 'error', label: 'error' },
          ]}
          value={levelFilter}
        />
        <input aria-label={t('tasks.logs.search')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('tasks.logs.search')} />
        <span className="task-log-result-count">{t('tasks.filter.resultCount', { count: visibleLogs.length })}</span>
      </div>
      <div className="task-log-actionbar">
        <div className="task-log-action-group" aria-label={t('tasks.logs.exportActions')}>
          <TaskLogIconButton icon="copy" label={t('tasks.logs.copyVisible')} onClick={() => copyVisibleTaskLogs(visibleLogs, privacyMode)} />
          <TaskLogIconButton icon="saveCommand" label={t('tasks.logs.exportJsonl')} onClick={() => downloadTaskLogExport(`bookmind-task-logs-${exportDate()}.jsonl`, formatTaskLogsJsonl(visibleLogs, privacyMode), 'application/x-ndjson;charset=utf-8')} />
          <TaskLogIconButton icon="note" label={t('tasks.logs.exportMarkdown')} onClick={() => downloadTaskLogExport(`bookmind-task-logs-${exportDate()}.md`, formatTaskLogsMarkdown(visibleLogs, privacyMode), 'text/markdown;charset=utf-8')} />
          <TaskLogIconButton icon="diagnostics" label={t('tasks.logs.copyRecentErrors')} onClick={() => copyRecentErrorLogs(logs, privacyMode, ERROR_LOG_COPY_LIMIT)} />
        </div>
        <div className="task-log-action-group danger" aria-label={t('tasks.logs.clearActions')}>
          <TaskLogIconButton danger icon="close" label={t('tasks.logs.clearCurrent')} onClick={() => onClearLogs('task')} />
          <TaskLogIconButton danger icon="saveCommand" label={t('tasks.logs.clearCompleted')} onClick={() => onClearLogs('completed')} />
          <TaskLogIconButton danger icon="close" label={t('tasks.logs.clearFailed')} onClick={() => onClearLogs('failed')} />
          <TaskLogIconButton danger icon="stop" label={t('tasks.logs.clearAll')} onClick={() => onClearLogs('all')} />
        </div>
      </div>
      <div className="task-log-table-heading" aria-hidden="true"><span>{t('tasks.table.updated')}</span><span>{t('tasks.logs.levelFilter')}</span><span>{t('tasks.table.stage')}</span><span>{t('tasks.logs.message')}</span></div>
      <div className="task-log-list" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
        {visibleLogs.length === 0 ? <p className="empty-hint">{t('tasks.logs.empty')}</p> : null}
        {virtualWindow.beforeHeight > 0 ? <div aria-hidden="true" style={{ height: virtualWindow.beforeHeight }} /> : null}
        {windowedLogs.map((log) => {
          const logTime = formatTaskRelativeTime(log.createdAt);
          return (
          <p key={log.id}>
            <time dateTime={logTime.dateTime} title={logTime.title}>{logTime.label}</time>
            <strong>{log.level}</strong>
            <span>{log.stage}</span>
            <code className="task-log-message">{redactTaskText(log.message, privacyMode)}</code>
          </p>
          );
        })}
        {virtualWindow.afterHeight > 0 ? <div aria-hidden="true" style={{ height: virtualWindow.afterHeight }} /> : null}
      </div>
    </section>
  );
}

function downloadTaskLogExport(filename: string, payload: string, mime: string) {
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TaskLogIconButton({ danger = false, disabled = false, icon, label, onClick }: {
  danger?: boolean;
  disabled?: boolean;
  icon: BookMindIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={danger ? 'task-icon-btn danger' : 'task-icon-btn'}
      data-tooltip={label}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <BookMindIcon name={icon} />
    </button>
  );
}

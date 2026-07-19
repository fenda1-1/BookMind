import { useState } from 'react';
import { useI18n } from '../../i18n';
import type { TaskLogRecord, TaskStage, TaskStatus } from '../../types';
import { buildTaskDetailDiagnosticJson } from '../../services/taskDiagnosticsExport';
import { formatTaskNumber, formatTaskSeconds } from './taskFormat';
import { formatTaskRelativeTime } from './taskTime';
import { displayTaskFileName, redactTaskText } from './taskPrivacy';

const stageTimeline: TaskStage[] = ['queued', 'read-file', 'parse-chapters', 'build-chunks', 'write-chunks', 'write-fts', 'verify', 'done'];

type TaskDetailPanelProps = {
  errorDetailsDefaultExpanded: boolean;
  logs: TaskLogRecord[];
  privacyMode: boolean;
  task: TaskStatus | null;
  onClose?: () => void;
  onOpenLogs: (taskId?: string) => void;
};

export function TaskDetailPanel({ errorDetailsDefaultExpanded, logs, privacyMode, task, onClose, onOpenLogs }: TaskDetailPanelProps) {
  const { t } = useI18n();
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(errorDetailsDefaultExpanded);
  if (!task) {
    return (
      <aside className="task-detail-panel" aria-label={t('tasks.detail.title')}>
        <p className="empty-hint">{t('tasks.detail.empty')}</p>
      </aside>
    );
  }

  const outputSummary = task.outputSummary;
  const errorMessage = task.errorMessage;
  const createdTime = formatTaskRelativeTime(task.createdAt);

  return (
    <aside className="task-detail-panel" aria-label={t('tasks.detail.title')}>
      <div className="task-section-heading">
        <div>
          <p className="eyebrow">{task.id}</p>
          <h2>{t('tasks.detail.title')}</h2>
        </div>
        <div className="settings-inline-actions">
          <button className="ghost-btn small" onClick={() => onOpenLogs(task.id)}>{t('tasks.log')}</button>
          <button className="ghost-btn small" onClick={() => copyTaskDiagnosticJson(task, logs)}>{t('tasks.detail.copyDiagnosticJson')}</button>
          {onClose ? <button className="task-icon-btn task-detail-close" data-tooltip={t('tasks.detail.close')} title={t('tasks.detail.close')} aria-label={t('tasks.detail.close')} type="button" onClick={onClose}>×</button> : null}
        </div>
      </div>
      <dl className="task-detail-grid">
        <div><dt>{t('tasks.detail.kind')}</dt><dd>{task.kind}</dd></div>
        <div><dt>{t('tasks.detail.status')}</dt><dd>{task.status}</dd></div>
        <div><dt>{t('tasks.detail.book')}</dt><dd>{task.bookTitle || task.bookId || '-'}</dd></div>
        <div><dt>{t('tasks.detail.file')}</dt><dd>{displayTaskFileName(task.fileName, privacyMode)}</dd></div>
        <div><dt>{t('tasks.detail.created')}</dt><dd title={createdTime.title}>{createdTime.label}</dd></div>
        <div><dt>{t('tasks.detail.duration')}</dt><dd>{formatTaskSeconds(task.durationMs)}</dd></div>
      </dl>
      <ol className="task-stage-timeline">
        {stageTimeline.map((stage) => (
          <li className={stage === task.stage ? 'active' : ''} key={stage}>
            <span />
            <p>{stage}</p>
          </li>
        ))}
      </ol>
      <div className="task-output-summary">
        <strong>{t('tasks.detail.output')}</strong>
        <span>{t('tasks.detail.outputCounts', {
          chapters: formatTaskNumber(outputSummary.chapters),
          paragraphs: formatTaskNumber(outputSummary.paragraphs),
          chunks: formatTaskNumber(outputSummary.chunks),
          ftsRows: formatTaskNumber(outputSummary.ftsRows),
        })}</span>
        <span>{formatTaskNumber(outputSummary.bytesRead)} bytes</span>
        <span>{formatTaskNumber(finiteTaskMetric(outputSummary.chunksPerSecond))} chunks/s · {formatTaskNumber(finiteTaskMetric(outputSummary.mbPerSecond))} MB/s</span>
      </div>
      <details open={errorDetailsOpen && Boolean(errorMessage)} onToggle={(event) => setErrorDetailsOpen(event.currentTarget.open)}>
        <summary>{task.errorCode || t('tasks.detail.error')}</summary>
        <p>{errorMessage ? redactTaskText(errorMessage, privacyMode) : t('tasks.indexNoError')}</p>
        {task.errorCode ? <p className="task-error-advice">{errorAdvice(task.errorCode, t)}</p> : null}
      </details>
      <div className="task-recent-logs">
        <strong>{t('tasks.detail.recentLogs')}</strong>
        {logs.slice(-5).map((log) => <p key={log.id}><span>{log.level}</span>{redactTaskText(log.message, privacyMode)}</p>)}
      </div>
    </aside>
  );
}

function finiteTaskMetric(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function copyTaskDiagnosticJson(task: TaskStatus, logs: TaskLogRecord[]) {
  void navigator.clipboard?.writeText(JSON.stringify(buildTaskDetailDiagnosticJson({ task, logs }), null, 2));
}

function errorAdvice(errorCode: string, t: ReturnType<typeof useI18n>['t']) {
  if (errorCode === 'book_missing') return t('tasks.errorAdvice.book_missing');
  if (errorCode === 'file_missing' || errorCode === 'file_read_failed') return t('tasks.errorAdvice.file_missing');
  if (errorCode === 'chapter_parse_failed') return t('tasks.errorAdvice.chapter_parse_failed');
  if (errorCode === 'chunk_write_failed') return t('tasks.errorAdvice.chunk_write_failed');
  if (errorCode === 'fts_write_failed') return t('tasks.errorAdvice.fts_write_failed');
  if (errorCode === 'manifest_write_failed') return t('tasks.errorAdvice.manifest_write_failed');
  if (errorCode === 'cancelled_by_user') return t('tasks.errorAdvice.cancelled_by_user');
  return t('tasks.errorAdvice.generic');
}

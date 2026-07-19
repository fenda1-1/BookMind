import { useI18n } from '../../i18n';
import type { IndexDiagnostics, TaskStatus } from '../../types';
import { formatTaskNumber } from './taskFormat';

type TaskHealthDashboardProps = {
  diagnostics: IndexDiagnostics | null;
  tasks: TaskStatus[];
  onFilter: (filter: string) => void;
};

export function TaskHealthDashboard({ diagnostics, tasks, onFilter }: TaskHealthDashboardProps) {
  const { t } = useI18n();
  const summary = diagnostics?.summary;
  const runningCount = tasks.filter((task) => task.status === 'running' || task.status === 'cancelling').length;
  const queuedCount = tasks.filter((task) => task.status === 'queued').length;
  const succeededCount = tasks.filter((task) => task.status === 'succeeded' || task.status === 'skipped').length;
  const failedCount = tasks.filter((task) => task.status === 'failed').length;
  const pausedCount = tasks.filter((task) => task.status === 'paused').length;
  const cancelledCount = tasks.filter((task) => task.status === 'cancelled').length;
  const staleBookCount = summary?.staleBookCount ?? diagnostics?.books.filter((book) => book.status === 'stale').length ?? 0;
  const indexedBookCount = summary?.indexedBookCount ?? 0;
  const indexedChunkCount = summary?.indexedChunkCount ?? 0;
  const sidecarStatus = summary?.sidecarStatus ?? 'not-configured';
  const sidecarVersion = summary?.sidecarVersion ?? '';
  const sidecarCapabilities = summary?.sidecarCapabilities ?? [];
  const sidecarErrorCode = summary?.sidecarErrorCode ?? '';

  const metrics = [
    { filter: 'running', key: 'running', label: t('tasks.health.running'), value: runningCount },
    { filter: 'queued', key: 'queued', label: t('tasks.health.queued'), value: queuedCount },
    { filter: 'succeeded', key: 'succeeded', label: t('tasks.health.succeeded'), value: succeededCount },
    { filter: 'failed', key: 'failed', label: t('tasks.health.failed'), value: failedCount },
    { filter: 'paused', key: 'paused', label: t('tasks.health.paused'), value: pausedCount },
    { filter: 'cancelled', key: 'cancelled', label: t('tasks.health.cancelled'), value: cancelledCount },
    { filter: '', key: 'indexed', label: t('tasks.health.indexedBooks'), value: indexedBookCount },
    { filter: '', key: 'chunks', label: t('tasks.health.indexedChunks'), value: indexedChunkCount },
    { filter: '', key: 'stale', label: t('tasks.health.staleBooks'), value: staleBookCount },
  ];

  return (
    <section className="task-health-dashboard" aria-label={t('tasks.health.aria')}>
      <div className="task-health-heading">
        <div><p className="eyebrow">{t('tasks.health.eyebrow')}</p><h2>{t('tasks.health.title')}</h2></div>
        <span>{t('tasks.health.hint')}</span>
      </div>
      <div className="task-health-grid">
        {metrics.map((metric) => (
          <button className="task-health-metric" disabled={!metric.filter} key={metric.key} onClick={() => metric.filter && onFilter(metric.filter)}>
            <span>{metric.label}</span>
            <strong>{formatTaskNumber(metric.value)}</strong>
          </button>
        ))}
      </div>
      <div className={summary?.ftsAvailable ? 'task-fts-status ready' : 'task-fts-status'}>
        <strong>{summary?.ftsAvailable ? t('tasks.indexFtsReady') : t('tasks.indexFtsMissing')}</strong>
        <code>{summary?.ftsDatabasePath || t('tasks.indexFtsUnknown')}</code>
        <span>{summary?.ftsDatabaseSizeBytes ? `${formatTaskNumber(summary.ftsDatabaseSizeBytes)} bytes` : t('tasks.ftsSizeUnknown')}</span>
      </div>
      <div className={`task-sidecar-health ${sidecarStatus}`}>
        <strong>{t('tasks.sidecarHealth.title')}: {sidecarStatus}</strong>
        <span>{t('tasks.sidecarHealth.version')}: {sidecarVersion || '-'}</span>
        <span>{t('tasks.sidecarHealth.capabilities')}: {sidecarCapabilities.length ? sidecarCapabilities.join(', ') : '-'}</span>
        {sidecarErrorCode ? <span>{t('tasks.sidecarHealth.errorCode')}: {sidecarErrorCode}</span> : null}
      </div>
    </section>
  );
}

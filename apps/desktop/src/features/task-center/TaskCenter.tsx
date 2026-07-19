import { useI18n } from '../../i18n';
import type { TaskStatus } from '../../types';
import { formatTaskPercent } from './taskFormat';
import { visibleTaskStatuses } from './taskFilters';

type TaskCenterProps = {
  variant?: 'sidebar' | 'embedded';
  tasks: TaskStatus[];
  onImportDirectory?: () => void;
  onImportTxt?: () => void;
  onLearnIndexArtifacts?: () => void;
  onRunSample?: () => void;
};

export function TaskCenter({
  variant = 'sidebar',
  tasks,
  onImportDirectory,
  onImportTxt,
  onLearnIndexArtifacts,
  onRunSample,
}: TaskCenterProps) {
  const { t } = useI18n();
  const visibleTasks = visibleTaskStatuses(tasks);
  return (
    <section className={variant === 'embedded' ? 'task-center embedded' : 'task-center'} aria-label={t('tasks.centerAria')}>
      <div>
        <p className="eyebrow">{t('tasks.backgroundEyebrow')}</p>
        <h2>{t('tasks.title')}</h2>
      </div>
      {visibleTasks.length === 0 ? (
        <div className="empty-hint task-empty-guide">
          <p>{t('tasks.empty')}</p>
          <div className="task-empty-actions">
            {onImportTxt ? <button className="primary-btn small" onClick={onImportTxt}>{t('tasks.emptyGuide.importTxt')}</button> : null}
            {onImportDirectory ? <button className="ghost-btn small" onClick={onImportDirectory}>{t('tasks.emptyGuide.chooseDirectory')}</button> : null}
            {onRunSample ? <button className="ghost-btn small" onClick={onRunSample}>{t('tasks.emptyGuide.runSample')}</button> : null}
            {onLearnIndexArtifacts ? <button className="ghost-btn small" onClick={onLearnIndexArtifacts}>{t('tasks.emptyGuide.learnIndexArtifacts')}</button> : null}
          </div>
        </div>
      ) : null}
      {visibleTasks.map((task) => (
        <div className="task-row" key={task.id}>
          <div className="section-title"><span>{task.name}</span><strong className="task-progress-text">{formatTaskPercent(task.progress)}</strong></div>
          <div className="progress"><i className={task.tone} style={{ width: `${task.progress}%` }} /></div>
          <p className="task-message">{statusText(task.status, t)} · {task.message}</p>
        </div>
      ))}
    </section>
  );
}

function statusText(status: string, t: ReturnType<typeof useI18n>['t']) {
  if (status === 'running') return t('tasks.status.running');
  if (status === 'done' || status === 'completed' || status === 'succeeded') return t('tasks.status.succeeded');
  if (status === 'paused') return t('tasks.status.paused');
  if (status === 'cancelling') return t('tasks.status.cancelling');
  if (status === 'cancelled') return t('tasks.status.cancelled');
  if (status === 'failed') return t('tasks.status.failed');
  if (status === 'skipped') return t('tasks.status.skipped');
  if (status === 'archived') return t('tasks.status.archived');
  return t('tasks.status.queued');
}

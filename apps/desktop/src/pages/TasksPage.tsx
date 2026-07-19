import { useState } from 'react';
import { TaskCommandCenter } from '../features/task-center/TaskCommandCenter';
import { TaskModuleWorkspace, type TaskCenterModule } from '../features/task-center/TaskModuleWorkspace';
import { useTaskCenterState } from '../features/task-center/useTaskCenterState';
import { useI18n } from '../i18n';
import { isTauriRuntime } from '../app/platform';
import { loadGlobalReaderSettings } from '../features/reader-core/readerSettings';
import { isHiddenPlaceholderTask, visibleTaskStatuses } from '../features/task-center/taskFilters';

export function TasksPage({ errorDetailsDefaultExpanded = false, onOpenTaskSettings }: { errorDetailsDefaultExpanded?: boolean; onOpenTaskSettings?: () => void }) {
  const { t } = useI18n();
  const state = useTaskCenterState();
  const [activeModule, setActiveModule] = useState<TaskCenterModule>('queue');
  const runningInTauri = isTauriRuntime();
  const taskPrivacyMode = loadGlobalReaderSettings().privacyMode;
  const books = state.indexDiagnostics?.books ?? [];
  const visibleTasks = visibleTaskStatuses(state.tasks);
  const visibleSelectedTask = state.selectedTask && !isHiddenPlaceholderTask(state.selectedTask) ? state.selectedTask : null;

  return (
    <section className="page-surface tasks-page-main">
      {!runningInTauri ? (
        <div className="task-runtime-notice" role="status">
          <strong>{t('tasks.browserPreview.title')}</strong>
          <span>{t('tasks.browserPreview.description')}</span>
        </div>
      ) : null}

      {state.errorMessage ? <p className="task-error-banner">{state.errorMessage}</p> : null}

      <div className="task-center-console">
        <TaskCommandCenter
          activeModule={activeModule}
          onSelectModule={setActiveModule}
        />

        <TaskModuleWorkspace
          activeModule={activeModule}
          books={books}
          busy={state.busy}
          diagnostics={state.indexDiagnostics}
          errorDetailsDefaultExpanded={errorDetailsDefaultExpanded}
          filter={state.activeFilter}
          logs={state.logs}
          onArchive={(taskId) => state.controlTask(taskId, 'archive')}
          onBatchCancelSelected={(taskIds) => state.controlSelectedTasks(taskIds, 'cancel')}
          onBatchClearCompleted={state.clearCompleted}
          onBatchRebuildSelectedIndexes={state.rebuildSelectedIndexes}
          onBatchRetrySelected={(taskIds) => state.controlSelectedTasks(taskIds, 'retry')}
          onClearLogs={(scope) => state.clearLogs(scope, state.logTaskId)}
          onControl={state.controlTask}
          onDeleteIndex={state.deleteIndex}
          onFilter={state.setActiveFilter}
          onImportDirectory={() => state.openLibraryImport('directory')}
          onImportIndexEntry={() => state.openLibraryImport('file')}
          onImportTxt={() => state.openLibraryImport('file')}
          onLearnIndexArtifacts={state.learnIndexArtifacts}
          onLoadAllLogs={() => state.openLogs(undefined)}
          onOpenDetails={state.setSelectedTaskId}
          onCloseDetails={() => state.setSelectedTaskId('')}
          onOpenLogs={state.openLogs}
          onOpenTaskSettings={onOpenTaskSettings}
          onRebuildIndex={state.rebuildIndex}
          onRepairFts={state.repairFts}
          onRunSample={state.importDevSample}
          privacyMode={taskPrivacyMode}
          selectedTask={visibleSelectedTask}
          tasks={visibleTasks}
        />
      </div>
    </section>
  );
}

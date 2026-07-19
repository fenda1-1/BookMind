import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';

import type { TaskCenterModule } from './TaskModuleWorkspace';

type TaskCommandCenterProps = {
  activeModule: TaskCenterModule;
  onSelectModule?: (module: TaskCenterModule) => void;
};

type TaskModuleCardProps = {
  active?: boolean;
  description: string;
  icon: BookMindIconName;
  label: string;
  module: TaskCenterModule;
  onSelect: (module: TaskCenterModule) => void;
};

export function TaskCommandCenter({
  activeModule = 'queue',
  onSelectModule = () => undefined,
}: TaskCommandCenterProps) {
  const { t } = useI18n();

  return (
    <aside className="task-command-center" aria-label={t('tasks.commandCenter.title')}>
      <nav className="task-module-nav" aria-label={t('tasks.commandCenter.title')}>
        <TaskModuleCard active={activeModule === 'queue'} description={t('tasks.commandCenter.modules.queueDescription')} icon="tasks" label={t('tasks.commandCenter.modules.queue')} module="queue" onSelect={onSelectModule} />
        <TaskModuleCard active={activeModule === 'index'} description={t('tasks.commandCenter.modules.indexDescription')} icon="index" label={t('tasks.commandCenter.modules.index')} module="index" onSelect={onSelectModule} />
        <TaskModuleCard active={activeModule === 'logs'} description={t('tasks.commandCenter.modules.logsDescription')} icon="logs" label={t('tasks.commandCenter.modules.logs')} module="logs" onSelect={onSelectModule} />
        <TaskModuleCard active={activeModule === 'resources'} description={t('tasks.commandCenter.modules.resourcesDescription')} icon="wrench" label={t('tasks.commandCenter.modules.resources')} module="resources" onSelect={onSelectModule} />
      </nav>
    </aside>
  );
}

function TaskModuleCard({ active = false, description, icon, label, module, onSelect }: TaskModuleCardProps) {
  return (
    <button className={active ? 'task-module-card active' : 'task-module-card'} type="button" onClick={() => onSelect(module)} aria-pressed={active}>
      <span className="task-module-icon"><BookMindIcon name={icon} /></span>
      <span><strong>{label}</strong><small>{description}</small></span>
    </button>
  );
}

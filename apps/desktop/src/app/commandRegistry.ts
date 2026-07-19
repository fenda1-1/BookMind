import type { Translator } from '../i18n';
import type { AppPage } from '../types';

export type CommandId =
  | 'open-command-palette'
  | 'go-overview'
  | 'go-reader'
  | 'go-library'
  | 'go-knowledge'
  | 'go-characters'
  | 'go-search'
  | 'go-tasks'
  | 'go-settings'
  | 'import-file'
  | 'import-directory'
  | 'summarize-book'
  | 'toggle-night'
  | 'toggle-sidebar'
  | `open-settings-${string}`;

export type CommandCategory = string;

export type AppCommand = {
  id: CommandId;
  label: string;
  description: string;
  category: CommandCategory;
  shortcut?: string;
  page?: AppPage;
  settingsGroupId?: string;
};

export function createAppCommands(t: Translator): AppCommand[] {
  return [
    {
      id: 'open-command-palette',
      label: t('command.openPalette.label'),
      description: t('command.openPalette.description'),
      category: t('command.category.view'),
      shortcut: 'Ctrl/Cmd+K',
    },
    { id: 'go-overview', label: t('command.goOverview.label'), description: t('command.goOverview.description'), category: t('command.category.navigation'), page: 'overview' },
    { id: 'go-reader', label: t('command.goReader.label'), description: t('command.goReader.description'), category: t('command.category.navigation'), shortcut: 'Ctrl/Cmd+B', page: 'reader' },
    { id: 'go-library', label: t('command.goLibrary.label'), description: t('command.goLibrary.description'), category: t('command.category.navigation'), shortcut: 'Ctrl/Cmd+L', page: 'library' },
    { id: 'go-knowledge', label: t('command.goKnowledge.label'), description: t('command.goKnowledge.description'), category: t('command.category.navigation'), page: 'knowledge' },
    { id: 'go-characters', label: t('command.goCharacters.label'), description: t('command.goCharacters.description'), category: t('command.category.navigation'), page: 'characters' },
    { id: 'go-search', label: t('command.goSearch.label'), description: t('command.goSearch.description'), category: t('command.category.navigation'), shortcut: 'Ctrl/Cmd+F', page: 'search' },
    { id: 'go-tasks', label: t('command.goTasks.label'), description: t('command.goTasks.description'), category: t('command.category.navigation'), page: 'tasks' },
    { id: 'go-settings', label: t('command.goSettings.label'), description: t('command.goSettings.description'), category: t('command.category.navigation'), page: 'settings' },
    { id: 'import-file', label: t('command.importFile.label'), description: t('command.importFile.description'), category: t('command.category.import'), shortcut: 'Ctrl/Cmd+I' },
    { id: 'import-directory', label: t('command.importDirectory.label'), description: t('command.importDirectory.description'), category: t('command.category.import') },
    { id: 'summarize-book', label: t('command.summarize.label'), description: t('command.summarize.description'), category: t('command.category.ai'), shortcut: 'Ctrl/Cmd+Enter' },
    { id: 'toggle-night', label: t('command.toggleNight.label'), description: t('command.toggleNight.description'), category: t('command.category.view') },
    { id: 'toggle-sidebar', label: t('command.toggleSidebar.label'), description: t('command.toggleSidebar.description'), category: t('command.category.view') },
  ];
}

export function createSettingsCommands(settingsGroups: Array<{ id: string; label: string; description: string }>, t: Translator): AppCommand[] {
  return settingsGroups.map((group) => ({
    id: `open-settings-${group.id}`,
    label: t('command.settingsGroup.label', { label: group.label }),
    description: group.description,
    category: t('command.category.settings'),
    page: 'settings',
    settingsGroupId: group.id,
  }));
}

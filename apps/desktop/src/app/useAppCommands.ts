import { useMemo } from 'react';
import { createAppCommands, createSettingsCommands, type CommandId } from './commandRegistry';
import { formatCommandPaletteShortcut, formatNavigationShortcut, formatImportShortcut, formatAiSummaryShortcut } from './appShellModel';
import { buildSettingsGroups } from '../features/settings-center/settingsCenterModel';
import type { ExtendedSettings } from '../services/settingsCenterService';
import type { Translator } from '../i18n';

type UseAppCommandsInput = {
  extendedSettings: ExtendedSettings;
  t: Translator;
};

export function useAppCommands({ extendedSettings, t }: UseAppCommandsInput) {
  return useMemo(() => {
    const commandPaletteShortcut = formatCommandPaletteShortcut(extendedSettings.commandPaletteShortcut);
    const baseCommands = createAppCommands(t).map((command) => {
      if (command.id === 'open-command-palette') return { ...command, shortcut: commandPaletteShortcut === 'disabled' ? undefined : commandPaletteShortcut };
      if (command.id === 'go-reader') return { ...command, shortcut: formatNavigationShortcut(extendedSettings.navigationShortcuts.reader) };
      if (command.id === 'go-library') return { ...command, shortcut: formatNavigationShortcut(extendedSettings.navigationShortcuts.library) };
      if (command.id === 'go-search') return { ...command, shortcut: formatNavigationShortcut(extendedSettings.navigationShortcuts.search) };
      if (command.id === 'import-file') return { ...command, shortcut: formatImportShortcut(extendedSettings.importShortcut) };
      if (command.id === 'summarize-book') return { ...command, shortcut: formatAiSummaryShortcut(extendedSettings.aiSummaryShortcut) };
      return command;
    });
    return extendedSettings.commandPaletteIncludesSettings ? [...baseCommands, ...createSettingsCommands(buildSettingsGroups(t), t)] : baseCommands;
  }, [extendedSettings.aiSummaryShortcut, extendedSettings.commandPaletteIncludesSettings, extendedSettings.commandPaletteShortcut, extendedSettings.importShortcut, extendedSettings.navigationShortcuts, t]);
}

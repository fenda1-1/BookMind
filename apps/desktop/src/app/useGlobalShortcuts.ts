import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { matchesCommandPaletteShortcut, matchesConfiguredShortcut } from './appShellModel';
import type { ExtendedSettings } from '../services/settingsCenterService';
import type { AppPage } from '../types';

type GlobalShortcutState = {
  standaloneReader: boolean;
  activePage: AppPage;
  globalShortcutsEnabled: boolean;
  commandPaletteShortcut: ExtendedSettings['commandPaletteShortcut'];
  appLocked: boolean;
  navigationShortcuts: ExtendedSettings['navigationShortcuts'];
  importShortcut: ExtendedSettings['importShortcut'];
  aiSummaryShortcut: ExtendedSettings['aiSummaryShortcut'];
  chooseBookFile: () => void | Promise<void>;
  summarizeBook: () => void | Promise<void>;
};

type UseGlobalShortcutsInput = {
  standaloneReader: boolean;
  activePage: AppPage;
  extendedSettings: ExtendedSettings;
  appLocked: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setActivePage: Dispatch<SetStateAction<AppPage>>;
  chooseBookFile: () => void | Promise<void>;
  summarizeBook: () => void | Promise<void>;
};

export function useGlobalShortcuts({
  standaloneReader,
  activePage,
  extendedSettings,
  appLocked,
  setCommandPaletteOpen,
  setActivePage,
  chooseBookFile,
  summarizeBook,
}: UseGlobalShortcutsInput) {
  const globalShortcutStateRef = useRef<GlobalShortcutState>({
    standaloneReader,
    activePage,
    globalShortcutsEnabled: extendedSettings.globalShortcutsEnabled,
    commandPaletteShortcut: extendedSettings.commandPaletteShortcut,
    appLocked,
    navigationShortcuts: extendedSettings.navigationShortcuts,
    importShortcut: extendedSettings.importShortcut,
    aiSummaryShortcut: extendedSettings.aiSummaryShortcut,
    chooseBookFile: () => undefined,
    summarizeBook: () => undefined,
  });

  useEffect(() => {
    globalShortcutStateRef.current = {
      standaloneReader,
      activePage,
      globalShortcutsEnabled: extendedSettings.globalShortcutsEnabled,
      commandPaletteShortcut: extendedSettings.commandPaletteShortcut,
      appLocked,
      navigationShortcuts: extendedSettings.navigationShortcuts,
      importShortcut: extendedSettings.importShortcut,
      aiSummaryShortcut: extendedSettings.aiSummaryShortcut,
      chooseBookFile,
      summarizeBook,
    };
  });

  useEffect(() => {
    function onGlobalShortcut(event: KeyboardEvent) {
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) return;
      const shortcutState = globalShortcutStateRef.current;
      if (!shortcutState.globalShortcutsEnabled) return;
      if (shortcutState.appLocked) return;
      const target = event.target as HTMLElement | null;
      const editable = target?.closest('input, textarea, [contenteditable="true"]');
      if (matchesCommandPaletteShortcut(event, shortcutState.commandPaletteShortcut)) {
        event.preventDefault();
        if (shortcutState.standaloneReader) return;
        setCommandPaletteOpen((value) => !value);
        return;
      }
      if (editable) return;
      if (matchesConfiguredShortcut(event, shortcutState.navigationShortcuts.library)) {
        event.preventDefault();
        setActivePage('library' as AppPage);
      } else if (matchesConfiguredShortcut(event, shortcutState.navigationShortcuts.search)) {
        event.preventDefault();
        if (shortcutState.activePage === 'reader') return;
        setActivePage('search' as AppPage);
      } else if (matchesConfiguredShortcut(event, shortcutState.navigationShortcuts.reader)) {
        event.preventDefault();
        setActivePage('reader' as AppPage);
      } else if (matchesConfiguredShortcut(event, shortcutState.importShortcut)) {
        event.preventDefault();
        void shortcutState.chooseBookFile();
      } else if (matchesConfiguredShortcut(event, shortcutState.aiSummaryShortcut)) {
        event.preventDefault();
        void shortcutState.summarizeBook();
      }
    }
    window.addEventListener('keydown', onGlobalShortcut);
    return () => window.removeEventListener('keydown', onGlobalShortcut);
  }, []);
}

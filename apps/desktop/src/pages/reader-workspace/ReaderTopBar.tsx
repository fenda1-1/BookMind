import { useEffect, useState } from 'react';
import type { ReaderPanelId, ReaderPanelPlacement } from '../ReaderWorkspace';
import type { ReaderCustomPreset } from '../../features/reader-core/readerSettings';
import {
  activateReaderRightPanelSession,
  closeAllReaderRightPanelSessions,
  closeReaderRightPanelSession,
  openReaderRightPanelSession,
  setReaderRightPanelPlacement as setSharedPanelPlacement,
  subscribeReaderRightPanelCommands,
  subscribeReaderRightPanelSessions,
  type ReaderRightPanelId,
} from '../../features/reader-core/readerRightPanelSessions';
import { normalizeReaderPanelPlacements, type ReaderStoredPanelPlacements } from '../readerWorkspaceStorage';

type ReaderTopBarControllerOptions = {
  bookId?: string | null;
  openSettingsRequest: number;
  presetApplyRequest: { id: number; preset: ReaderCustomPreset } | null;
  initialPanelPlacements?: Partial<ReaderStoredPanelPlacements> | null;
  applyReaderPresetSettings: (settings: ReaderCustomPreset['settings']) => void;
};

export function useReaderTopBarController({ bookId, openSettingsRequest, presetApplyRequest, initialPanelPlacements, applyReaderPresetSettings }: ReaderTopBarControllerOptions) {
  const [aiSessionOpen, setAiSessionOpen] = useState(false);
  const [settingsSessionOpen, setSettingsSessionOpen] = useState(false);
  const [rulesSessionOpen, setRulesSessionOpen] = useState(false);
  const [activeRightPanelId, setActiveRightPanelId] = useState<ReaderRightPanelId | null>(null);
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(false);
  const [panelPlacements, setPanelPlacements] = useState<Record<ReaderPanelId, ReaderPanelPlacement>>(() => normalizeReaderPanelPlacements(initialPanelPlacements));

  const aiPanelOpen = aiSessionOpen && activeRightPanelId === 'ai' && !rightPanelsCollapsed;
  const settingsOpen = settingsSessionOpen && activeRightPanelId === 'settings' && !rightPanelsCollapsed;
  const rulesOpen = rulesSessionOpen && activeRightPanelId === 'rules' && !rightPanelsCollapsed;
  const openPanels: ReaderPanelId[] = [
    ...(aiPanelOpen ? ['ai' as const] : []),
    ...(settingsOpen ? ['settings' as const] : []),
    ...(rulesOpen ? ['rules' as const] : []),
  ];
  const dockOccupants = [
    ...(aiPanelOpen && panelPlacements.ai === 'sidebar' ? ['ai' as const] : []),
    ...(settingsOpen && panelPlacements.settings === 'sidebar' ? ['settings' as const] : []),
    ...(rulesOpen && panelPlacements.rules === 'sidebar' ? ['rules' as const] : []),
  ];
  const rightPanelSessionsOpen = activeRightPanelId !== null && !rightPanelsCollapsed;
  const rightRailWidth = 'minmax(364px, calc(var(--reader-session-rail-width, 420px) + 24px))';
  const gridTemplateColumns = rightPanelSessionsOpen ? `minmax(0, 1fr) ${rightRailWidth}` : 'minmax(0, 1fr)';
  const readerOverlayOpen = settingsOpen || aiPanelOpen || rulesOpen;

  function setAiPanelOpen(value: boolean | ((current: boolean) => boolean)) {
    // Functional toggles use visible body state so inactive tabs re-activate instead of closing.
    const currentVisible = aiSessionOpen && activeRightPanelId === 'ai';
    const next = typeof value === 'function' ? value(currentVisible) : value;
    if (next) openReaderRightPanelSession('ai', panelPlacements.ai);
    else if (aiSessionOpen) closeReaderRightPanelSession('ai');
  }

  function setSettingsOpen(value: boolean | ((current: boolean) => boolean)) {
    const currentVisible = settingsSessionOpen && activeRightPanelId === 'settings';
    const next = typeof value === 'function' ? value(currentVisible) : value;
    if (next) openReaderRightPanelSession('settings', panelPlacements.settings);
    else if (settingsSessionOpen) closeReaderRightPanelSession('settings');
  }

  function setRulesOpen(value: boolean | ((current: boolean) => boolean)) {
    const currentVisible = rulesSessionOpen && activeRightPanelId === 'rules';
    const next = typeof value === 'function' ? value(currentVisible) : value;
    if (next) openReaderRightPanelSession('rules', panelPlacements.rules);
    else if (rulesSessionOpen) closeReaderRightPanelSession('rules');
  }

  function toggleReaderRules() {
    setRulesOpen((value) => !value);
  }

  function toggleReaderSettings() {
    setSettingsOpen((value) => !value);
  }

  function toggleReaderAiPanel() {
    setAiPanelOpen((value) => !value);
  }

  function openReaderAiDemo() {
    openReaderRightPanelSession('ai', panelPlacements.ai);
  }

  function setReaderPanelPlacement(panel: ReaderPanelId, placement: ReaderPanelPlacement) {
    setPanelPlacements((current) => ({ ...current, [panel]: placement }));
    setSharedPanelPlacement(panel, placement);
  }

  function setReaderPanelPlacements(placements: Partial<ReaderStoredPanelPlacements> | null | undefined) {
    setPanelPlacements(normalizeReaderPanelPlacements(placements));
  }

  useEffect(() => {
    setReaderPanelPlacements(initialPanelPlacements);
    closeAllReaderRightPanelSessions();
  }, [bookId]);

  useEffect(() => subscribeReaderRightPanelSessions((snapshot) => {
    setAiSessionOpen(snapshot.panels.ai.open);
    setSettingsSessionOpen(snapshot.panels.settings.open);
    setRulesSessionOpen(snapshot.panels.rules.open);
    setActiveRightPanelId(snapshot.activeId);
    setRightPanelsCollapsed(Boolean(snapshot.collapsed));
    setPanelPlacements((current) => {
      const nextAi = snapshot.panels.ai.placement;
      const nextSettings = snapshot.panels.settings.placement === 'sidebar' || snapshot.panels.settings.placement === 'floating'
        ? snapshot.panels.settings.placement
        : current.settings;
      const nextRules = snapshot.panels.rules.placement === 'sidebar' || snapshot.panels.rules.placement === 'floating'
        ? snapshot.panels.rules.placement
        : current.rules;
      if (current.ai === nextAi && current.settings === nextSettings && current.rules === nextRules) return current;
      return { ai: nextAi, settings: nextSettings, rules: nextRules };
    });
  }), []);

  useEffect(() => subscribeReaderRightPanelCommands((command) => {
    if (command.action === 'close-all') {
      closeAllReaderRightPanelSessions();
      return;
    }
    if (command.action === 'toggle-collapsed' || command.action === 'set-collapsed' || command.action === 'set-width') return;
    if (command.id !== 'ai' && command.id !== 'settings' && command.id !== 'rules') return;
    const placement = panelPlacements[command.id];
    if (command.action === 'close') closeReaderRightPanelSession(command.id);
    if (command.action === 'open') openReaderRightPanelSession(command.id, placement);
    if (command.action === 'activate') activateReaderRightPanelSession(command.id);
  }), [panelPlacements.ai, panelPlacements.settings, panelPlacements.rules]);

  useEffect(() => {
    if (!openSettingsRequest) return;
    openReaderRightPanelSession('settings', panelPlacements.settings);
  }, [openSettingsRequest, panelPlacements.settings]);

  useEffect(() => {
    if (!presetApplyRequest || !bookId) return;
    applyReaderPresetSettings(presetApplyRequest.preset.settings);
    openReaderRightPanelSession('settings', panelPlacements.settings);
  }, [presetApplyRequest?.id, bookId, panelPlacements.settings]);

  return {
    aiPanelOpen, setAiPanelOpen,
    settingsOpen, setSettingsOpen,
    rulesOpen, setRulesOpen,
    readerOverlayOpen,
    rightPanelSessionsOpen,
    openPanels,
    dockOccupants,
    gridTemplateColumns,
    panelPlacements,
    toggleReaderSettings,
    toggleReaderAiPanel,
    toggleReaderRules,
    openReaderAiDemo,
    setReaderPanelPlacement,
    setReaderPanelPlacements,
  };
}

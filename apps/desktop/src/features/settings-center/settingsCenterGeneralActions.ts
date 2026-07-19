import type { KeyboardEvent } from 'react';
import { applyOperationLogRetention, loadOperationLogs } from '../../services/operationLogService';
import { saveAiProviderApiKey, saveAppSettings, saveTranslationApiKey } from '../../services/settingsService';
import {
  defaultExtendedSettings,
  dispatchSettingsUpdated,
  loadSettingsChangeHistory,
  recordSettingsChangeHistory,
  saveExtendedSettings,
  undoLastSettingsChange,
  type ExtendedSettings,
} from '../../services/settingsCenterService';
import { applyTaskLogRetention, applyTaskRetention } from '../../services/taskService';
import type { AppPage, AppSettings, OperationLogLevel } from '../../types';
import type { Translator } from '../../i18n';
import { defaultAppSettings } from './settingsCenterPageModel';
import { getNextSettingsGroupId, type SettingsGroup, type SettingsGroupId } from './settingsCenterModel';
import { getShortcutConflictMessages } from './settingsCenterShortcutModel';

type SettingsGeneralActionsDeps = {
  getExtendedSettings: () => ExtendedSettings;
  getSettings: () => AppSettings;
  highlightColorOptions: Array<{ value: ExtendedSettings['defaultHighlightColor']; label: string }>;
  annotationCsvFieldOptions: Array<{ value: ExtendedSettings['annotationCsvFields'][number]; label: string }>;
  knowledgeDefaultColumnOptions: Array<{ value: ExtendedSettings['knowledgeDefaultColumns'][number]; label: string }>;
  taskLogRetentionOptions: Array<{ value: ExtendedSettings['taskLogRetention']; label: string }>;
  t: Translator;
  refreshAiApiKeyStorageStatus: () => void | Promise<void>;
  settingsGroups: SettingsGroup[];
  setActiveGroup: (groupId: SettingsGroupId) => void;
  setExtendedSettings: (settings: ExtendedSettings) => void;
  setOperationLogLevel: (level: OperationLogLevel) => void;
  setOperationLogs: (logs: ReturnType<typeof loadOperationLogs>) => void;
  setSaveStatus: (status: string) => void;
  setSettings: (settings: AppSettings) => void;
  setSettingsChangeHistory: (history: ReturnType<typeof loadSettingsChangeHistory>) => void;
  setSettingsQuery: (query: string) => void;
  formatError: (error: unknown) => string;
};

export function createSettingsGeneralActions(deps: SettingsGeneralActionsDeps) {
  function applySavedAppSettings(next: AppSettings, changedKeys: string[], status: string) {
    deps.setSettings({ ...defaultAppSettings(), ...next });
    deps.setSaveStatus(status);
    deps.setSettingsChangeHistory(recordSettingsChangeHistory({ key: 'appSettings', keys: changedKeys, scope: 'app' }));
    dispatchSettingsUpdated({ key: 'appSettings', keys: changedKeys, scope: 'app' });
  }

  function onSettingsGroupNavKeyDown(event: KeyboardEvent<HTMLButtonElement>, groupId: SettingsGroupId) {
    const nextGroupId = getNextSettingsGroupId(groupId, event.key, deps.settingsGroups);
    if (!nextGroupId) return;
    event.preventDefault();
    deps.setActiveGroup(nextGroupId);
    deps.setSettingsQuery('');
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-settings-group="${nextGroupId}"]`)?.focus();
    });
  }

  async function updateAppSettings(update: Partial<AppSettings>, status = deps.t('settings.generalActions.settingsSaved')) {
    try {
      const next = await saveAppSettings({ ...deps.getSettings(), ...update });
      applySavedAppSettings(next, Object.keys(update), status);
      if (update.operationLogLevel) deps.setOperationLogLevel(update.operationLogLevel);
      if (Object.prototype.hasOwnProperty.call(update, 'aiApiKey')) void deps.refreshAiApiKeyStorageStatus();
    } catch (error) {
      console.error('Failed to save settings:', error);
      deps.setSaveStatus(deps.t('settings.generalActions.settingsSaveFailed', { error: deps.formatError(error) }));
    }
  }

  async function updateAiProviderApiKey(profileId: string, apiKey: string, status = deps.t('settings.generalActions.settingsSaved')) {
    try {
      const next = await saveAiProviderApiKey(profileId, apiKey);
      applySavedAppSettings(next, ['aiProviderProfiles.apiKey'], status);
      void deps.refreshAiApiKeyStorageStatus();
    } catch (error) {
      console.error('Failed to save AI Provider API key:', error);
      deps.setSaveStatus(deps.t('settings.generalActions.settingsSaveFailed', { error: deps.formatError(error) }));
    }
  }

  async function updateTranslationApiKey(sourceId: string, apiKey: string, status = deps.t('settings.generalActions.settingsSaved')) {
    try {
      const next = await saveTranslationApiKey(sourceId, apiKey);
      applySavedAppSettings(next, ['translationSources.apiKey'], status);
    } catch (error) {
      console.error('Failed to save translation API key:', error);
      deps.setSaveStatus(deps.t('settings.generalActions.settingsSaveFailed', { error: deps.formatError(error) }));
    }
  }

  function updateExtendedSetting<K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) {
    const current = deps.getExtendedSettings();
    const next = { ...current, [key]: value };
    const changedKeys = [String(key)];
    if (key === 'booksOpenInStandaloneReader' && value === true) {
      if (current.visibleNavItems.includes('reader')) {
        next.visibleNavItems = current.visibleNavItems.filter((item) => item !== 'reader');
        next.readerNavHiddenByStandaloneOnly = true;
        changedKeys.push('visibleNavItems', 'readerNavHiddenByStandaloneOnly');
      } else {
        next.readerNavHiddenByStandaloneOnly = false;
        changedKeys.push('readerNavHiddenByStandaloneOnly');
      }
    }
    if (key === 'booksOpenInStandaloneReader' && value === false && current.readerNavHiddenByStandaloneOnly) {
      next.visibleNavItems = Array.from(new Set([...current.visibleNavItems, 'reader']));
      next.readerNavHiddenByStandaloneOnly = false;
      changedKeys.push('visibleNavItems', 'readerNavHiddenByStandaloneOnly');
    }
    const saved = saveExtendedSettings(next, { key: String(key), keys: changedKeys });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    deps.setSaveStatus(deps.t('settings.generalActions.extendedSettingSaved', { key: String(key) }));
  }

  function updateHighlightColorMeaning(color: ExtendedSettings['defaultHighlightColor'], value: string) {
    const extendedSettings = deps.getExtendedSettings();
    updateExtendedSetting('highlightColorMeanings', { ...extendedSettings.highlightColorMeanings, [color]: value });
  }

  function updateHighlightColorShortcut(color: ExtendedSettings['defaultHighlightColor'], value: ExtendedSettings['highlightColorShortcuts'][ExtendedSettings['defaultHighlightColor']]) {
    const extendedSettings = deps.getExtendedSettings();
    const next = { ...extendedSettings.highlightColorShortcuts, [color]: value };
    if (value !== 'disabled') {
      deps.highlightColorOptions.forEach((shortcutColor) => {
        if (shortcutColor.value !== color && next[shortcutColor.value] === value) next[shortcutColor.value] = 'disabled';
      });
    }
    updateExtendedSetting('highlightColorShortcuts', next);
  }

  function taskLogRetentionDays(policy: ExtendedSettings['taskLogRetention']) {
    if (policy === '7-days') return 7;
    if (policy === '30-days') return 30;
    if (policy === '90-days') return 90;
    return null;
  }

  async function applyTaskLogRetentionPolicy(value: ExtendedSettings['taskLogRetention']) {
    const extendedSettings = deps.getExtendedSettings();
    const saved = saveExtendedSettings({ ...extendedSettings, taskLogRetention: value }, { key: 'taskLogRetention' });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    const retentionDays = taskLogRetentionDays(value);
    if (retentionDays === null) {
      deps.setSaveStatus(deps.t('settings.generalActions.taskLogRetentionPolicySaved', { policy: deps.taskLogRetentionOptions.find((item) => item.value === value)?.label ?? value }));
      return;
    }
    const removed = await applyTaskLogRetention(retentionDays);
    deps.setSaveStatus(deps.t('settings.generalActions.taskLogRetentionApplied', { days: retentionDays, removed }));
  }

  async function updateCompletedTaskRetentionLimit(value: string) {
    const extendedSettings = deps.getExtendedSettings();
    const saved = saveExtendedSettings({ ...extendedSettings, completedTaskRetentionLimit: value }, { key: 'completedTaskRetentionLimit' });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    const limit = Number.parseInt(saved.completedTaskRetentionLimit, 10);
    const removed = await applyTaskRetention(Number.isFinite(limit) ? Math.max(0, limit) : 0);
    deps.setSaveStatus(deps.t('settings.generalActions.completedTaskRetentionSaved', { limit: saved.completedTaskRetentionLimit, removed }));
  }

  function operationLogRetentionDays(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(500, Math.max(0, parsed));
  }

  function updateOperationLogRetention(value: string) {
    const extendedSettings = deps.getExtendedSettings();
    const saved = saveExtendedSettings({ ...extendedSettings, operationLogRetention: value }, { key: 'operationLogRetention' });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    const retentionDays = operationLogRetentionDays(saved.operationLogRetention);
    const retained = applyOperationLogRetention(retentionDays);
    deps.setOperationLogs(loadOperationLogs(retentionDays));
    deps.setSaveStatus(retentionDays > 0
      ? deps.t('settings.generalActions.operationLogRetentionSaved', { days: retentionDays, retained })
      : deps.t('settings.generalActions.operationLogRetentionForever'));
  }

  function toggleAnnotationCsvField(field: ExtendedSettings['annotationCsvFields'][number], enabled: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    const requested = enabled ? [...extendedSettings.annotationCsvFields, field] : extendedSettings.annotationCsvFields.filter((item) => item !== field);
    const ordered = deps.annotationCsvFieldOptions.map((item) => item.value).filter((item) => requested.includes(item));
    updateExtendedSetting('annotationCsvFields', ordered.length ? ordered : defaultExtendedSettings.annotationCsvFields);
  }

  function toggleKnowledgeDefaultColumn(column: ExtendedSettings['knowledgeDefaultColumns'][number], enabled: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    const requested = enabled ? [...extendedSettings.knowledgeDefaultColumns, column] : extendedSettings.knowledgeDefaultColumns.filter((item) => item !== column);
    const ordered = deps.knowledgeDefaultColumnOptions.map((item) => item.value).filter((item) => requested.includes(item));
    updateExtendedSetting('knowledgeDefaultColumns', ordered.length ? ordered : defaultExtendedSettings.knowledgeDefaultColumns);
  }

  function updateExtendedSettingsState(settings: ExtendedSettings) {
    deps.setExtendedSettings(settings);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
  }

  function undoLastSettingsChangeFromHistory() {
    const restored = undoLastSettingsChange();
    if (!restored) {
      deps.setSaveStatus(deps.t('settings.generalActions.noUndoableChange'));
      deps.setSettingsChangeHistory(loadSettingsChangeHistory());
      return;
    }
    deps.setExtendedSettings(restored);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    deps.setSaveStatus(deps.t('settings.generalActions.lastChangeUndone'));
  }

  function updateGlobalShortcutSetting<K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) {
    const next = { ...deps.getExtendedSettings(), [key]: value };
    const conflicts = getShortcutConflictMessages(next, deps.t);
    if (conflicts.length) {
      deps.setSaveStatus(deps.t('settings.generalActions.shortcutConflict', { conflict: conflicts[0] }));
      return;
    }
    const saved = saveExtendedSettings(next, { key: String(key) });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    deps.setSaveStatus(deps.t('settings.generalActions.shortcutSaved', { key: String(key) }));
  }

  function updateNavigationShortcut<K extends keyof ExtendedSettings['navigationShortcuts']>(key: K, value: ExtendedSettings['navigationShortcuts'][K]) {
    const extendedSettings = deps.getExtendedSettings();
    updateGlobalShortcutSetting('navigationShortcuts', { ...extendedSettings.navigationShortcuts, [key]: value });
  }

  function updateReaderShortcut<K extends keyof ExtendedSettings['readerShortcuts']>(key: K, value: ExtendedSettings['readerShortcuts'][K]) {
    const extendedSettings = deps.getExtendedSettings();
    updateExtendedSetting('readerShortcuts', { ...extendedSettings.readerShortcuts, [key]: value });
  }

  function restoreGlobalShortcutsDefaults() {
    const extendedSettings = deps.getExtendedSettings();
    const saved = saveExtendedSettings({
      ...extendedSettings,
      commandPaletteShortcut: defaultExtendedSettings.commandPaletteShortcut,
      navigationShortcuts: defaultExtendedSettings.navigationShortcuts,
      importShortcut: defaultExtendedSettings.importShortcut,
      aiSummaryShortcut: defaultExtendedSettings.aiSummaryShortcut,
    }, { key: 'globalShortcuts', keys: ['commandPaletteShortcut', 'navigationShortcuts', 'importShortcut', 'aiSummaryShortcut'] });
    deps.setExtendedSettings(saved);
    deps.setSaveStatus(deps.t('settings.generalActions.globalShortcutsRestored'));
  }

  function updateVisibleNavItem(page: AppPage, visible: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    const nextItems = visible
      ? Array.from(new Set([...extendedSettings.visibleNavItems, page]))
      : extendedSettings.visibleNavItems.filter((item) => item !== page || item === 'settings');
    const nextSettings = {
      ...extendedSettings,
      visibleNavItems: nextItems,
      readerNavHiddenByStandaloneOnly: page === 'reader' ? false : extendedSettings.readerNavHiddenByStandaloneOnly,
    };
    const changedKeys = page === 'reader' ? ['visibleNavItems', 'readerNavHiddenByStandaloneOnly'] : ['visibleNavItems'];
    const saved = saveExtendedSettings(nextSettings, { key: 'visibleNavItems', keys: changedKeys });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    deps.setSaveStatus(deps.t('settings.generalActions.extendedSettingSaved', { key: 'visibleNavItems' }));
  }

  function moveVisibleNavItem(page: AppPage, direction: -1 | 1) {
    const extendedSettings = deps.getExtendedSettings();
    const currentIndex = extendedSettings.visibleNavItems.indexOf(page);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= extendedSettings.visibleNavItems.length) return;
    const nextItems = [...extendedSettings.visibleNavItems];
    [nextItems[currentIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[currentIndex]];
    updateExtendedSetting('visibleNavItems', nextItems);
  }

  function restoreDefaultNavOrder() {
    updateExtendedSetting('visibleNavItems', defaultExtendedSettings.visibleNavItems);
  }

  function updateTopbarButtonVisibility(button: keyof ExtendedSettings['topbarButtonVisibility'], visible: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    updateExtendedSetting('topbarButtonVisibility', { ...extendedSettings.topbarButtonVisibility, [button]: visible });
  }

  return {
    onSettingsGroupNavKeyDown,
    updateAppSettings,
    updateAiProviderApiKey,
    updateTranslationApiKey,
    updateExtendedSetting,
    updateHighlightColorMeaning,
    updateHighlightColorShortcut,
    taskLogRetentionDays,
    applyTaskLogRetentionPolicy,
    updateCompletedTaskRetentionLimit,
    operationLogRetentionDays,
    updateOperationLogRetention,
    toggleAnnotationCsvField,
    toggleKnowledgeDefaultColumn,
    updateExtendedSettingsState,
    undoLastSettingsChangeFromHistory,
    updateGlobalShortcutSetting,
    updateNavigationShortcut,
    updateReaderShortcut,
    restoreGlobalShortcutsDefaults,
    updateVisibleNavItem,
    moveVisibleNavItem,
    restoreDefaultNavOrder,
    updateTopbarButtonVisibility,
  };
}

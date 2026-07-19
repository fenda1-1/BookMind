import { useEffect } from 'react';
import { hydrateReaderSettingsV2FromBackend } from '../features/reader-core/readerSettings';
import { loadOperationLogs, setOperationLogLevel } from '../services/operationLogService';
import { loadAppSettings } from '../services/settingsService';
import {
  hydrateSettingsV2FromBackend,
  loadAiCustomSlashCommands,
  loadSettingsChangeHistory,
  subscribeAiCustomSlashCommandsUpdated,
  subscribeSettingsCenterSaveFailed,
  subscribeSettingsUpdated,
} from '../services/settingsCenterService';
import { loadSettingsDiagnosticPaths } from '../features/settings-center/settingsCenterDataMaintenanceActions';
import { defaultAppSettings } from '../features/settings-center/settingsCenterPageModel';

type SettingsPageLifecycleContext = Record<string, any>;

export function useSettingsPageLifecycle(context: SettingsPageLifecycleContext) {
  const tr = (key: string, values?: Record<string, string | number>) => context.t(key as never, values);

  useEffect(() => {
    hydrateSettingsV2FromBackend().then(context.setExtendedSettings).catch(() => undefined);
    hydrateReaderSettingsV2FromBackend().then(context.setReaderGlobalSettings).catch(() => undefined);
    loadAppSettings().then((next) => {
      const merged = { ...defaultAppSettings(), ...next };
      context.setSettings(merged);
      setOperationLogLevel(merged.operationLogLevel ?? 'none');
      context.setOperationLogs(loadOperationLogs(context.operationLogRetentionDays(context.extendedSettings.operationLogRetention)));
    }).catch((error) => {
      console.error('Failed to load app settings:', error);
      context.setSaveStatus(tr('settings.lifecycle.loadFailed'));
    });
  }, []);

  useEffect(() => {
    void context.getDataDirectoryStatusFromSettings();
    void loadSettingsDiagnosticPaths().then(context.setDiagnosticPaths);
  }, []);

  useEffect(() => {
    void context.refreshLocalEncryptionStatus();
  }, []);

  useEffect(() => {
    void context.refreshAiApiKeyStorageStatus();
  }, []);

  useEffect(() => {
    context.setOperationLogs(loadOperationLogs(context.operationLogRetentionDays(context.extendedSettings.operationLogRetention)));
  }, [context.extendedSettings.operationLogRetention]);

  useEffect(() => {
    context.setCustomSlashCommandList(loadAiCustomSlashCommands(Number(context.extendedSettings.aiCustomSlashCommandLimit)));
  }, [context.extendedSettings.aiCustomSlashCommandLimit]);

  useEffect(() => {
    const refreshCustomSlashCommands = () => context.setCustomSlashCommandList(loadAiCustomSlashCommands(Number(context.extendedSettings.aiCustomSlashCommandLimit)));
    return subscribeAiCustomSlashCommandsUpdated(refreshCustomSlashCommands);
  }, [context.extendedSettings.aiCustomSlashCommandLimit]);

  useEffect(() => {
    const refreshSettingsChangeHistory = (detail: { scope?: string }) => {
      context.setSettingsChangeHistory(loadSettingsChangeHistory());
      if (detail.scope === 'app' || detail.scope === 'all') {
        void loadAppSettings().then((next) => context.setSettings({ ...defaultAppSettings(), ...next }));
      }
    };
    return subscribeSettingsUpdated(refreshSettingsChangeHistory);
  }, []);

  useEffect(() => {
    const handleSaveFailed = (detail: { target: 'settings_v2' | 'storage'; message: string }) => {
      const target = detail.target === 'settings_v2' ? tr('settings.lifecycle.target.settingsV2') : tr('settings.lifecycle.target.storage');
      const message = detail.message?.trim() || tr('settings.lifecycle.unknownError');
      context.setLastTauriCommandFailure({ at: new Date().toISOString(), source: target, message });
      context.setSaveStatus(tr('settings.lifecycle.backendWriteFailed', { target, message }));
    };
    return subscribeSettingsCenterSaveFailed(handleSaveFailed);
  }, [context.t]);

  useEffect(() => {
    if (context.highlightTarget !== 'ai-api') return;
    context.setActiveGroup('ai');
    context.aiApiSettingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    context.setHighlightedSetting('ai-api');
    const timer = window.setTimeout(() => context.setHighlightedSetting(null), 1000);
    return () => window.clearTimeout(timer);
  }, [context.highlightTarget]);

  useEffect(() => {
    if (context.highlightTarget !== 'reader-memory-warning') return;
    const searchQuery = tr('settings.reader.memorySearchQuery');
    context.setActiveGroup('reader');
    context.setSettingsQuery(searchQuery);
    context.setHighlightedSetting(null);
  }, [context.highlightTarget, context.t]);

  useEffect(() => {
    if (!context.initialGroup) return;
    context.setActiveGroup(context.initialGroup);
    context.setSettingsQuery('');
  }, [context.initialGroup]);
}

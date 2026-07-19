import { listCloudAiModels, testCloudAiConnection } from '../../services/aiService';
import type { Translator } from '../../i18n';
import { loadSettingsChangeHistory, saveExtendedSettings, type ExtendedSettings } from '../../services/settingsCenterService';
import type { AppSettings } from '../../types';
import { resolveAiProviderRequestSettings } from './settingsCenterAiProviderModel';

type SettingsAiActionsDeps = {
  getExtendedSettings: () => ExtendedSettings;
  getSettings: () => AppSettings;
  setAiModels: (models: string[]) => void;
  setAiTestStatus: (status: Awaited<ReturnType<typeof testCloudAiConnection>> | null) => void;
  setExtendedSettings: (settings: ExtendedSettings) => void;
  setLoadingAiModels: (loading: boolean) => void;
  setSettingsChangeHistory: (history: ReturnType<typeof loadSettingsChangeHistory>) => void;
  setSaveStatus: (status: string) => void;
  setTestingAi: (testing: boolean) => void;
  t: Translator;
  updateAppSettings?: (update: Partial<AppSettings>, status?: string) => Promise<void>;
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
};

export function createSettingsAiActions(deps: SettingsAiActionsDeps) {
  function updateCloudAiEnabledSetting(enabled: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    const nextDefaultAiMode = enabled || extendedSettings.defaultAiMode !== 'cloud' ? extendedSettings.defaultAiMode : extendedSettings.localAiEnabled ? 'local' : 'mock';
    const saved = saveExtendedSettings({ ...extendedSettings, cloudAiEnabled: enabled, defaultAiMode: nextDefaultAiMode }, { key: 'cloudAiEnabled', keys: ['cloudAiEnabled', 'defaultAiMode'] });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    deps.setSaveStatus(enabled
      ? deps.t('settings.aiPanel.status.cloudModeEnabled')
      : deps.t('settings.aiPanel.status.cloudModeDisabledDefaultChanged', { mode: deps.t(extendedSettings.localAiEnabled ? 'settings.aiPanel.mode.local' : 'settings.aiPanel.mode.mock') }));
  }

  function updateLocalAiEnabledSetting(enabled: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    const nextDefaultAiMode = enabled || extendedSettings.defaultAiMode !== 'local' ? extendedSettings.defaultAiMode : extendedSettings.cloudAiEnabled ? 'cloud' : 'mock';
    const saved = saveExtendedSettings({ ...extendedSettings, localAiEnabled: enabled, defaultAiMode: nextDefaultAiMode }, { key: 'localAiEnabled', keys: ['localAiEnabled', 'defaultAiMode'] });
    deps.setExtendedSettings(saved);
    deps.setSettingsChangeHistory(loadSettingsChangeHistory());
    deps.setSaveStatus(enabled
      ? deps.t('settings.aiPanel.status.localModeEnabled')
      : deps.t('settings.aiPanel.status.localModeDisabledDefaultChanged', { mode: deps.t(extendedSettings.cloudAiEnabled ? 'settings.aiPanel.mode.cloud' : 'settings.aiPanel.mode.mock') }));
  }

  function updateDefaultAiModeSetting(value: ExtendedSettings['defaultAiMode']) {
    const extendedSettings = deps.getExtendedSettings();
    if (value === 'cloud' && !extendedSettings.cloudAiEnabled) {
      deps.updateExtendedSetting('defaultAiMode', extendedSettings.localAiEnabled ? 'local' : 'mock');
      return;
    }
    if (value === 'local' && !extendedSettings.localAiEnabled) {
      deps.updateExtendedSetting('defaultAiMode', extendedSettings.cloudAiEnabled ? 'cloud' : 'mock');
      return;
    }
    deps.updateExtendedSetting('defaultAiMode', value);
  }

  function updateAiCommandDefaultScope(commandId: keyof ExtendedSettings['aiCommandDefaultScopes'], value: ExtendedSettings['aiDefaultScope']) {
    const extendedSettings = deps.getExtendedSettings();
    deps.updateExtendedSetting('aiCommandDefaultScopes', {
      ...extendedSettings.aiCommandDefaultScopes,
      [commandId]: value,
    });
  }

  function updateAiBuiltInSlashCommandEnabled(commandId: keyof ExtendedSettings['aiBuiltInSlashCommandEnabled'], enabled: boolean) {
    const extendedSettings = deps.getExtendedSettings();
    deps.updateExtendedSetting('aiBuiltInSlashCommandEnabled', {
      ...extendedSettings.aiBuiltInSlashCommandEnabled,
      [commandId]: enabled,
    });
  }

  function updateAiCommandRetrievalStrategy(commandId: keyof ExtendedSettings['aiCommandRetrievalStrategies'], value: ExtendedSettings['aiDefaultRetrievalStrategy']) {
    const extendedSettings = deps.getExtendedSettings();
    deps.updateExtendedSetting('aiCommandRetrievalStrategies', {
      ...extendedSettings.aiCommandRetrievalStrategies,
      [commandId]: value,
    });
  }

  async function runAiConnectionTest() {
    deps.setTestingAi(true);
    deps.setAiTestStatus(null);
    const result = await testCloudAiConnection(resolveAiProviderRequestSettings(deps.getSettings()));
    deps.setAiTestStatus(result);
    deps.setTestingAi(false);
  }

  async function loadAiModels() {
    deps.setLoadingAiModels(true);
    deps.setAiTestStatus(null);
    try {
      const models = await listCloudAiModels(resolveAiProviderRequestSettings(deps.getSettings()));
      deps.setAiModels(models);
      deps.setSaveStatus(models.length ? deps.t('settings.ai.modelsLoaded', { count: models.length }) : deps.t('settings.ai.modelsEmpty'));
    } catch (error) {
      console.error('Failed to load cloud AI models:', error);
      deps.setSaveStatus(`${deps.t('settings.ai.modelsLoadFailed')} · ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      deps.setLoadingAiModels(false);
    }
  }

  return {
    updateCloudAiEnabledSetting,
    updateLocalAiEnabledSetting,
    updateDefaultAiModeSetting,
    updateAiCommandDefaultScope,
    updateAiBuiltInSlashCommandEnabled,
    updateAiCommandRetrievalStrategy,
    runAiConnectionTest,
    loadAiModels,
  };
}

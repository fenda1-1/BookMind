import type { AiProviderModelSettings, AiProviderProfile, AppSettings } from '../../types';
import type { Translator } from '../../i18n';
import {
  createAiProviderProfileFromSettings,
  createAiProviderProfileId,
  inferAiProviderKindForUi,
  mergeAiProviderProfileModels,
  normalizeAiProviderModelSettings,
  normalizeAiProviderProfileForUi,
  normalizeAiProviderProfilesForUi,
  parseAiProviderModelInput,
} from './settingsCenterAiProviderModel';

type SettingsAiProviderActionDeps = {
  getSettings: () => AppSettings;
  updateAppSettings: (update: Partial<AppSettings>, status?: string) => Promise<void>;
  updateAiProviderApiKey: (profileId: string, apiKey: string, status?: string) => Promise<void>;
  setSaveStatus: (status: string) => void;
  setAiModels?: (models: string[]) => void;
  confirmDelete: (message: string) => Promise<boolean>;
  t: Translator;
  createProviderProfileId?: () => string;
};

export function createSettingsAiProviderActions(deps: SettingsAiProviderActionDeps) {
  const {
    getSettings,
    updateAppSettings,
    updateAiProviderApiKey,
    setSaveStatus,
    setAiModels,
    confirmDelete,
    t,
    createProviderProfileId = createAiProviderProfileId,
  } = deps;

  async function updateAiProviderProfile(profileId: string, patch: Partial<AiProviderProfile>, status = t('settings.aiProviderActions.profileSaved')) {
    if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
      await updateAiProviderApiKey(profileId, patch.apiKey ?? '', status);
      const { apiKey: _apiKey, ...remainingPatch } = patch;
      if (!Object.keys(remainingPatch).length) return;
      patch = remainingPatch;
    }
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    const nextProfiles = profiles.map((profile) => (
      profile.id === profileId ? { ...profile, ...patch } : profile
    ));
    const activeId = nextProfiles.some((profile) => profile.id === settings.aiActiveProviderProfileId)
      ? settings.aiActiveProviderProfileId
      : nextProfiles[0]?.id;
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: activeId,
    }, status);
  }

  async function selectAiProviderProfile(profileId: string) {
    setAiModels?.([]);
    await updateAppSettings({ aiActiveProviderProfileId: profileId }, t('settings.aiProviderActions.profileSelected'));
  }

  async function createAiProviderProfile() {
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    const nextIndex = profiles.length + 1;
    const profile = createAiProviderProfileFromSettings({}, {
      id: createProviderProfileId(),
      name: `Provider ${nextIndex}`,
      kind: 'openai-compatible',
      apiKey: '',
      apiBaseUrl: '',
      model: '',
      models: [],
      proxyUrl: '',
      customHeaders: '',
    });
    await updateAppSettings({
      aiProviderProfiles: [...profiles, profile],
      aiActiveProviderProfileId: profile.id,
    }, t('settings.aiProviderActions.profileCreated'));
  }

  async function copyCurrentAiConfigAsProvider() {
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    const profile = createAiProviderProfileFromSettings(settings, {
      id: createProviderProfileId(),
      name: t('settings.aiProviderActions.copyName', { name: settings.aiModel || 'AI' }),
      kind: inferAiProviderKindForUi(settings.aiApiBaseUrl ?? ''),
      apiKey: '',
    });
    await updateAppSettings({
      aiProviderProfiles: [...profiles, profile],
      aiActiveProviderProfileId: profile.id,
    }, t('settings.aiProviderActions.profileCopied'));
  }

  async function deleteAiProviderProfile(profileId: string) {
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    if (profiles.length <= 1) {
      setSaveStatus(t('settings.aiProviderActions.keepOneProfile'));
      return;
    }
    if (!await confirmDelete(t('settings.aiProviderActions.deleteConfirm'))) return;
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    const nextActiveId = settings.aiActiveProviderProfileId === profileId ? nextProfiles[0]?.id : settings.aiActiveProviderProfileId;
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: nextActiveId,
    }, t('settings.aiProviderActions.profileDeleted'));
  }

  async function applyAiProviderProfile(profile: AiProviderProfile) {
    const settings = getSettings();
    const aiProviderProfiles = normalizeAiProviderProfilesForUi(settings);
    const normalizedProfile = normalizeAiProviderProfileForUi(profile, 0);
    await updateAppSettings({
      aiActiveProviderProfileId: normalizedProfile.id,
      aiProviderProfiles: normalizeAiProviderProfilesForUi({
        ...settings,
        aiProviderProfiles: aiProviderProfiles.map((item) => (item.id === normalizedProfile.id ? normalizedProfile : item)),
      }),
      aiApiBaseUrl: profile.apiBaseUrl,
      aiEndpointMode: profile.endpointMode,
      aiModel: profile.model,
      aiRequestTimeoutSecs: normalizedProfile.requestTimeoutSecs,
      aiRetryCount: normalizedProfile.retryCount,
      aiProxyUrl: normalizedProfile.proxyUrl,
      aiCustomHeaders: normalizedProfile.customHeaders,
      aiStreamingEnabled: normalizedProfile.streamingEnabled,
      aiTemperature: normalizedProfile.temperature,
      aiMaxTokens: normalizedProfile.maxTokens,
      aiTopP: normalizedProfile.topP,
      aiReasoningEffort: normalizedProfile.reasoningEffort,
      aiResponseFormat: normalizedProfile.responseFormat,
    }, t('settings.aiProviderActions.profileApplied'));
  }

  async function addAiProviderModels(profileId: string, modelInput: string | string[]) {
    const models = Array.isArray(modelInput) ? modelInput : parseAiProviderModelInput(modelInput);
    if (!models.length) {
      setSaveStatus(t('settings.aiProviderActions.noModelsToAdd'));
      return;
    }
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    const nextProfiles = profiles.map((profile) => (
      profile.id === profileId ? mergeAiProviderProfileModels(profile, models) : profile
    ));
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: profileId,
    }, t('settings.aiProviderActions.modelsAdded', { count: models.length }));
  }

  async function selectAiProviderModel(profileId: string, model: string) {
    const selectedModel = model.trim();
    if (!selectedModel) {
      setSaveStatus(t('settings.aiProviderActions.modelNameRequired'));
      return;
    }
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    const nextProfiles = profiles.map((profile) => (
      profile.id === profileId ? mergeAiProviderProfileModels(profile, [selectedModel], selectedModel) : profile
    ));
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: profileId,
      aiModel: selectedModel,
    }, t('settings.aiProviderActions.modelSelected'));
  }

  async function updateAiProviderModelSettings(profileId: string, settingsPatch: AiProviderModelSettings) {
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    const nextSettings = normalizeAiProviderModelSettings(settingsPatch.id, settingsPatch);
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) return profile;
      return {
        ...profile,
        models: profile.models?.includes(nextSettings.id) ? profile.models : [...(profile.models ?? []), nextSettings.id],
        modelSettings: {
          ...(profile.modelSettings ?? {}),
          [nextSettings.id]: nextSettings,
        },
      };
    });
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: profileId,
    }, t('settings.aiProviderActions.modelSettingsSaved'));
  }

  async function removeAiProviderModel(profileId: string, model: string) {
    const modelToRemove = model.trim();
    if (!modelToRemove) {
      setSaveStatus(t('settings.aiProviderActions.modelNameRequired'));
      return;
    }
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    let nextSelectedModel = settings.aiModel;
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) return profile;
      const remainingModels = (profile.models ?? []).filter((item) => item !== modelToRemove);
      if (!remainingModels.length) return profile;
      const nextModel = profile.model === modelToRemove ? remainingModels[0] : profile.model;
      if (settings.aiActiveProviderProfileId === profileId) nextSelectedModel = nextModel;
      return {
        ...profile,
        model: nextModel,
        models: remainingModels,
        modelSettings: Object.fromEntries(Object.entries(profile.modelSettings ?? {}).filter(([key]) => key !== modelToRemove && remainingModels.includes(key))),
      };
    });
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: profileId,
      aiModel: nextSelectedModel,
    }, t('settings.aiProviderActions.modelDeleted'));
  }

  async function resetAiProviderModels(profileId: string) {
    const settings = getSettings();
    const profiles = normalizeAiProviderProfilesForUi(settings);
    let nextSelectedModel = settings.aiModel;
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) return profile;
      if (settings.aiActiveProviderProfileId === profileId) nextSelectedModel = profile.model;
      return {
        ...profile,
        models: [profile.model],
        modelSettings: profile.modelSettings?.[profile.model] ? { [profile.model]: profile.modelSettings[profile.model] } : undefined,
      };
    });
    await updateAppSettings({
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: profileId,
      aiModel: nextSelectedModel,
    }, t('settings.aiProviderActions.modelLibraryReset'));
  }

  return {
    updateAiProviderProfile,
    selectAiProviderProfile,
    createAiProviderProfile,
    copyCurrentAiConfigAsProvider,
    deleteAiProviderProfile,
    applyAiProviderProfile,
    addAiProviderModels,
    selectAiProviderModel,
    updateAiProviderModelSettings,
    removeAiProviderModel,
    resetAiProviderModels,
  };
}

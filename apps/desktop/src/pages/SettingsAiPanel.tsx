import { useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ThemedSelect } from './SettingsSelect';
import { BookMindIcon, type BookMindIconName } from '../components/BookMindIcon';
import type { CustomSlashCommandTemplate, EditableCustomSlashCommandDraft } from '../features/settings-center/settingsCenterModel';
import { getAiProviderModelConfig, normalizeAiProviderModelSettings, normalizeAiReasoningEffortForUi } from '../features/settings-center/settingsCenterAiProviderModel';
import { formatAiApiKeyPrimaryStore, formatAiApiKeyStorageStatus } from '../features/settings-center/settingsCenterStatusFormatModel';
import type { Translator } from '../i18n';
import type { CloudAiTestResult } from '../services/aiService';
import type { CloudRedactionPreview } from '../services/cloudAiPrivacy';
import type { AiApiKeyStorageStatus, AiCustomSlashCommandDraft, ExtendedSettings } from '../services/settingsCenterService';
import type { AiEndpointMode, AiProviderKind, AiProviderModelSettings, AiProviderModelType, AiProviderProfile, AppSettings } from '../types';
import { ReadonlyPill, SettingControl, SettingsNumberInput, SettingsSection, SettingsTextarea, SettingsTextInput } from './SettingsPageScaffold';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

const aiProviderModelTypeOptions: SelectOption<AiProviderModelType>[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'rerank', label: 'Rerank' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
];

type SettingsAiPanelProps = {
  t: Translator;
  settings: AppSettings;
  extendedSettings: ExtendedSettings;
  currentBookId: string;
  currentBookTitle?: string;
  highlightedSetting: 'ai-api' | null;
  aiApiSettingRef: RefObject<HTMLElement | null>;
  showApiKey: boolean;
  setShowApiKey: Dispatch<SetStateAction<boolean>>;
  aiApiKeyStorageStatus: AiApiKeyStorageStatus | null;
  loadingAiApiKeyStorageStatus: boolean;
  aiApiKeyStorageStatusError: string;
  privacyAiApiKeyFallbackPath: string;
  refreshAiApiKeyStorageStatus: () => Promise<void> | void;
  aiTestStatus: CloudAiTestResult | null;
  testingAi: boolean;
  loadingAiModels: boolean;
  aiModelOptions: SelectOption<string>[];
  aiModels: string[];
  loadAiModels: () => Promise<void> | void;
  runAiConnectionTest: () => Promise<void> | void;
  aiProviderProfiles: AiProviderProfile[];
  activeAiProviderProfile?: AiProviderProfile;
  aiProviderProfileOptions: SelectOption<string>[];
  aiProviderKindOptions: SelectOption<AiProviderKind>[];
  aiEndpointOptions: SelectOption<AiEndpointMode>[];
  aiCancelStrategyOptions: SelectOption<NonNullable<AppSettings['aiCancelStrategy']>>[];
  aiReasoningEffortOptions: SelectOption<NonNullable<AppSettings['aiReasoningEffort']>>[];
  aiResponseFormatOptions: SelectOption<NonNullable<AppSettings['aiResponseFormat']>>[];
  selectAiProviderProfile: (profileId: string) => Promise<void> | void;
  applyAiProviderProfile: (profile: AiProviderProfile) => Promise<void> | void;
  createAiProviderProfile: () => Promise<void> | void;
  copyCurrentAiConfigAsProvider: () => Promise<void> | void;
  deleteAiProviderProfile: (profileId: string) => Promise<void> | void;
  updateAiProviderProfile: (profileId: string, patch: Partial<AiProviderProfile>, status?: string) => Promise<void> | void;
  addAiProviderModels: (profileId: string, modelInput: string | string[]) => Promise<void> | void;
  selectAiProviderModel: (profileId: string, model: string) => Promise<void> | void;
  updateAiProviderModelSettings: (profileId: string, modelSettings: AiProviderModelSettings) => Promise<void> | void;
  removeAiProviderModel: (profileId: string, model: string) => Promise<void> | void;
  resetAiProviderModels: (profileId: string) => Promise<void> | void;
  updateAppSettings: (update: Partial<AppSettings>, status?: string) => Promise<void> | void;
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
  clearCurrentBookCloudAiHistorySettingsData: () => Promise<void> | void;
  clearAllCloudAiHistorySettingsData: () => Promise<void> | void;
  exportCurrentBookCloudAiHistoryDiagnostics: () => Promise<void> | void;
  exportAllCloudAiHistoryDiagnostics: () => Promise<void> | void;
  updateCloudAiEnabledSetting: (enabled: boolean) => void;
  updateLocalAiEnabledSetting: (enabled: boolean) => void;
  aiModeOptions: SelectOption<ExtendedSettings['defaultAiMode']>[];
  availableAiModeOptions: SelectOption<ExtendedSettings['defaultAiMode']>[];
  aiScopeOptions: SelectOption<ExtendedSettings['aiDefaultScope']>[];
  aiCommandScopeOptions: SelectOption<ExtendedSettings['aiDefaultScope']>[];
  aiNoSelectionFallbackScopeOptions: SelectOption<ExtendedSettings['aiNoSelectionFallbackScope']>[];
  aiScopePriorityStrategyOptions: SelectOption<ExtendedSettings['aiScopePriorityStrategy']>[];
  aiRetrievalStrategyOptions: SelectOption<ExtendedSettings['aiDefaultRetrievalStrategy']>[];
  aiRetrievalQueryRewriteModeOptions: SelectOption<ExtendedSettings['aiRetrievalQueryRewriteMode']>[];
  aiMultiStageRetrievalModeOptions: SelectOption<ExtendedSettings['aiMultiStageRetrievalMode']>[];
  aiFtsUnavailableBehaviorOptions: SelectOption<ExtendedSettings['aiFtsUnavailableBehavior']>[];
  aiDefaultOutputFormatOptions: SelectOption<ExtendedSettings['aiDefaultOutputFormat']>[];
  aiCitationCardDefaultDensityOptions: SelectOption<ExtendedSettings['aiCitationCardDefaultDensity']>[];
  aiCitationFieldStrictnessOptions: SelectOption<ExtendedSettings['aiCitationFieldStrictness']>[];
  aiToolCallDisplayModeOptions: SelectOption<ExtendedSettings['aiToolCallDisplayMode']>[];
  aiCitationDefaultSaveTargetOptions: SelectOption<ExtendedSettings['aiCitationDefaultSaveTarget']>[];
  updateDefaultAiModeSetting: (value: ExtendedSettings['defaultAiMode']) => void;
  updateAiCommandDefaultScope: (commandId: keyof ExtendedSettings['aiCommandDefaultScopes'], value: ExtendedSettings['aiDefaultScope']) => void;
  updateAiBuiltInSlashCommandEnabled: (commandId: keyof ExtendedSettings['aiBuiltInSlashCommandEnabled'], enabled: boolean) => void;
  updateAiCommandRetrievalStrategy: (commandId: keyof ExtendedSettings['aiCommandRetrievalStrategies'], value: ExtendedSettings['aiDefaultRetrievalStrategy']) => void;
  customSlashCommandList: AiCustomSlashCommandDraft[];
  customSlashCommandDraft: EditableCustomSlashCommandDraft;
  setCustomSlashCommandDraft: Dispatch<SetStateAction<EditableCustomSlashCommandDraft>>;
  customSlashCommandEditingId: string;
  customSlashCommandEditDraft: EditableCustomSlashCommandDraft;
  setCustomSlashCommandEditDraft: Dispatch<SetStateAction<EditableCustomSlashCommandDraft>>;
  customSlashCommandImportInputRef: RefObject<HTMLInputElement | null>;
  customSlashCommandTemplateLibrary: CustomSlashCommandTemplate[];
  refreshCustomSlashCommandList: () => void;
  createCustomSlashCommandFromSettings: () => void;
  addCustomSlashCommandTemplate: (template: CustomSlashCommandTemplate) => void;
  startEditingCustomSlashCommand: (command: AiCustomSlashCommandDraft) => void;
  saveCustomSlashCommandEdit: () => void;
  cancelCustomSlashCommandEdit: () => void;
  deleteCustomSlashCommandFromSettings: (command: AiCustomSlashCommandDraft) => void;
  exportCustomSlashCommandsFromSettings: () => void;
  importCustomSlashCommandsFromSettings: (file: File) => Promise<void>;
  cloudRedactionPreview: CloudRedactionPreview;
  cloudRedactionPreviewInput: string;
  setCloudRedactionPreviewInput: Dispatch<SetStateAction<string>>;
  allowCurrentBookCloudAiSettingsData: () => Promise<void> | void;
  revokeCurrentBookCloudAiConsentSettingsData: () => Promise<void> | void;
};

export function SettingsAiPanel({
  t,
  settings,
  extendedSettings,
  currentBookId,
  currentBookTitle,
  highlightedSetting,
  aiApiSettingRef,
  showApiKey,
  setShowApiKey,
  aiApiKeyStorageStatus,
  loadingAiApiKeyStorageStatus,
  aiApiKeyStorageStatusError,
  privacyAiApiKeyFallbackPath,
  refreshAiApiKeyStorageStatus,
  aiTestStatus,
  testingAi,
  loadingAiModels,
  aiModelOptions,
  aiModels,
  loadAiModels,
  runAiConnectionTest,
  aiProviderProfiles,
  activeAiProviderProfile,
  aiProviderProfileOptions,
  aiProviderKindOptions,
  aiEndpointOptions,
  aiCancelStrategyOptions,
  aiReasoningEffortOptions,
  aiResponseFormatOptions,
  selectAiProviderProfile,
  applyAiProviderProfile,
  createAiProviderProfile,
  copyCurrentAiConfigAsProvider,
  deleteAiProviderProfile,
  updateAiProviderProfile,
  addAiProviderModels,
  selectAiProviderModel,
  updateAiProviderModelSettings,
  removeAiProviderModel,
  resetAiProviderModels,
  updateAppSettings,
  updateExtendedSetting,
  clearCurrentBookCloudAiHistorySettingsData,
  clearAllCloudAiHistorySettingsData,
  exportCurrentBookCloudAiHistoryDiagnostics,
  exportAllCloudAiHistoryDiagnostics,
  updateCloudAiEnabledSetting,
  updateLocalAiEnabledSetting,
  aiModeOptions,
  availableAiModeOptions,
  aiScopeOptions,
  aiCommandScopeOptions,
  aiNoSelectionFallbackScopeOptions,
  aiScopePriorityStrategyOptions,
  aiRetrievalStrategyOptions,
  aiRetrievalQueryRewriteModeOptions,
  aiMultiStageRetrievalModeOptions,
  aiFtsUnavailableBehaviorOptions,
  aiDefaultOutputFormatOptions,
  aiCitationCardDefaultDensityOptions,
  aiCitationFieldStrictnessOptions,
  aiToolCallDisplayModeOptions,
  aiCitationDefaultSaveTargetOptions,
  updateDefaultAiModeSetting,
  updateAiCommandDefaultScope,
  updateAiBuiltInSlashCommandEnabled,
  updateAiCommandRetrievalStrategy,
  customSlashCommandList,
  customSlashCommandDraft,
  setCustomSlashCommandDraft,
  customSlashCommandEditingId,
  customSlashCommandEditDraft,
  setCustomSlashCommandEditDraft,
  customSlashCommandImportInputRef,
  customSlashCommandTemplateLibrary,
  refreshCustomSlashCommandList,
  createCustomSlashCommandFromSettings,
  addCustomSlashCommandTemplate,
  startEditingCustomSlashCommand,
  saveCustomSlashCommandEdit,
  cancelCustomSlashCommandEdit,
  deleteCustomSlashCommandFromSettings,
  exportCustomSlashCommandsFromSettings,
  importCustomSlashCommandsFromSettings,
  cloudRedactionPreview,
  cloudRedactionPreviewInput,
  setCloudRedactionPreviewInput,
  allowCurrentBookCloudAiSettingsData,
  revokeCurrentBookCloudAiConsentSettingsData,
}: SettingsAiPanelProps) {
  const [providerModelDraft, setProviderModelDraft] = useState('');
  const [providerSidebarCollapsed, setProviderSidebarCollapsed] = useState(false);
  const [modelDiscoveryOpen, setModelDiscoveryOpen] = useState(false);
  const [discoveredModelQuery, setDiscoveredModelQuery] = useState('');
  const [discoveredModelSelection, setDiscoveredModelSelection] = useState<Set<string>>(() => new Set());
  const [editingModelId, setEditingModelId] = useState('');
  const [modelSettingsDraft, setModelSettingsDraft] = useState<AiProviderModelSettings | null>(null);
  const activeProviderModelOptions = activeAiProviderProfile
    ? (activeAiProviderProfile.models?.length ? activeAiProviderProfile.models : [activeAiProviderProfile.model])
      .filter((model, index, list) => model.trim() && list.indexOf(model) === index)
      .map((model) => ({ value: model, label: model }))
    : [];
  const activeProviderKindLabel = activeAiProviderProfile ? formatProviderKind(activeAiProviderProfile.kind, t) : t('settings.aiPanel.state.notConfigured');
  const activeEndpointLabel = activeAiProviderProfile?.endpointMode ?? settings.aiEndpointMode ?? 'responses';
  const activeModelLabel = activeAiProviderProfile?.model ?? settings.aiModel ?? 'gpt-4.1-mini';
  const activeProviderApiKey = activeAiProviderProfile?.apiKey ?? '';
  const activeProviderHasApiKey = Boolean(activeProviderApiKey.trim());

  const activeBaseUrlLabel = activeAiProviderProfile?.apiBaseUrl ?? settings.aiApiBaseUrl ?? 'https://api.openai.com/v1';
  const apiKeyStorageLabel = formatAiApiKeyStorageStatus(aiApiKeyStorageStatus, loadingAiApiKeyStorageStatus, aiApiKeyStorageStatusError, t);
  const connectionStatusLabel = aiTestStatus
    ? `${aiTestStatus.ok ? t('settings.aiPanel.state.available') : t('settings.aiPanel.state.failed')} · HTTP ${aiTestStatus.status || '-'} · ${aiTestStatus.durationMs}ms`
    : t('settings.aiPanel.state.waitingTest');
  const fetchedModelOptions = aiModels
    .filter((model, index, list) => model.trim() && list.indexOf(model) === index)
    .filter((model) => !activeProviderModelOptions.some((option) => option.value === model))
    .map((model) => ({ value: model, label: model }));
  const filteredDiscoveredModelOptions = fetchedModelOptions.filter((option) => fuzzyMatchText(option.label, discoveredModelQuery));
  const editingModelConfig = activeAiProviderProfile && editingModelId ? getAiProviderModelConfig(activeAiProviderProfile, editingModelId) : null;
  const activeModelSettingsDraft = modelSettingsDraft && editingModelConfig && modelSettingsDraft.id === editingModelConfig.id ? modelSettingsDraft : editingModelConfig;
  const providerValidation = buildProviderValidation(activeAiProviderProfile, activeProviderModelOptions.length, t);
  const activeReasoningEffort = normalizeAiReasoningEffortForUi(activeAiProviderProfile?.reasoningEffort ?? settings.aiReasoningEffort);
  const visibleAiReasoningEffortOptions = aiReasoningEffortOptions.some((option) => option.value === activeReasoningEffort)
    ? aiReasoningEffortOptions
    : [...aiReasoningEffortOptions, { value: activeReasoningEffort, label: activeReasoningEffort }];

  function saveReasoningEffort(value: string) {
    const reasoningEffort = normalizeAiReasoningEffortForUi(value);
    if (activeAiProviderProfile) {
      void updateAiProviderProfile(activeAiProviderProfile.id, { reasoningEffort }, t('settings.ai.saveSuccess'));
      return;
    }
    void updateAppSettings({ aiReasoningEffort: reasoningEffort }, t('settings.ai.saveSuccess'));
  }

  async function openModelDiscovery() {
    await loadAiModels();
    setDiscoveredModelSelection(new Set());
    setDiscoveredModelQuery('');
    setModelDiscoveryOpen(true);
  }

  function toggleDiscoveredModel(model: string) {
    setDiscoveredModelSelection((current) => {
      const next = new Set(current);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  }

  function openModelSettings(modelId: string) {
    if (!activeAiProviderProfile) return;
    const current = getAiProviderModelConfig(activeAiProviderProfile, modelId);
    setEditingModelId(modelId);
    setModelSettingsDraft(current);
  }

  function cancelModelSettingsDraft() {
    setEditingModelId('');
    setModelSettingsDraft(null);
  }

  function updateModelSettingsDraft(patch: Partial<AiProviderModelSettings>) {
    if (!activeModelSettingsDraft) return;
    setModelSettingsDraft((current) => {
      const base = current && current.id === activeModelSettingsDraft.id ? current : activeModelSettingsDraft;
      return {
        ...base,
        ...patch,
        capabilities: {
          ...base.capabilities,
          ...(patch.capabilities ?? {}),
        },
      };
    });
  }

  async function saveModelSettingsDraft() {
    if (!activeAiProviderProfile || !activeModelSettingsDraft) return;
    const next = normalizeAiProviderModelSettings(activeModelSettingsDraft.id, activeModelSettingsDraft);
    await updateAiProviderModelSettings(activeAiProviderProfile.id, next);
    cancelModelSettingsDraft();
  }

  return (
      <div className={providerSidebarCollapsed ? 'settings-ai-workbench provider-sidebar-collapsed' : 'settings-ai-workbench'}>
        <aside className={providerSidebarCollapsed ? 'settings-ai-provider-panel collapsed' : 'settings-ai-provider-panel'} aria-label={t('settings.aiPanel.providerList.aria')}>
          <div className="settings-ai-provider-head">
            <div className="settings-ai-provider-title-row">
              <h3>{providerSidebarCollapsed ? t('settings.aiPanel.providerList.shortTitle') : t('settings.aiPanel.providerList.title')}</h3>
              <button className="ghost-btn small settings-ai-provider-collapse-btn" type="button" onClick={() => setProviderSidebarCollapsed((value) => !value)}>{providerSidebarCollapsed ? t('settings.aiPanel.action.expand') : t('settings.aiPanel.action.collapse')}</button>
            </div>
            {!providerSidebarCollapsed ? <p>{t('settings.aiPanel.providerList.description')}</p> : null}
          </div>
          {!providerSidebarCollapsed ? <div className="settings-ai-provider-actions">
            <button className="primary-btn small" type="button" onClick={() => { void createAiProviderProfile(); }}>{t('settings.aiPanel.providerList.new')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void copyCurrentAiConfigAsProvider(); }}>{t('settings.aiPanel.providerList.copyCurrent')}</button>
          </div> : null}
          <div className="settings-ai-provider-list">
            {aiProviderProfiles.map((profile) => {
              const selected = profile.id === activeAiProviderProfile?.id;
              const providerModels = (profile.models?.length ? profile.models : [profile.model]).filter(Boolean);
              return (
                <article
                  key={profile.id}
                  className={`settings-ai-provider-card${selected ? ' active' : ''}${profile.enabled === false ? ' disabled' : ''}`}
                >
                  <button className="settings-ai-provider-card-main" type="button" onClick={() => { void selectAiProviderProfile(profile.id); }} aria-label={t('settings.aiPanel.providerList.selectAria', { name: profile.name })}>
                    {providerSidebarCollapsed ? (
                      <span className="settings-ai-provider-avatar">{getProviderInitial(profile.name)}</span>
                    ) : (
                      <>
                        <span className="settings-ai-provider-card-head">
                          <span>
                            <strong>{profile.name}</strong>
                            <small>{profile.endpointMode}</small>
                          </span>
                          <em>{formatProviderKind(profile.kind, t)}</em>
                        </span>
                        <code>{profile.apiBaseUrl || t('settings.aiPanel.state.noBaseUrl')}</code>
                        <span className="settings-ai-provider-models">
                          {providerModels.slice(0, 2).map((model) => (
                            <b key={model} className={model === profile.model ? 'active' : ''}>{model}</b>
                          ))}
                          {providerModels.length > 2 ? <b>+{providerModels.length - 2}</b> : null}
                        </span>
                      </>
                    )}
                  </button>
                  {!providerSidebarCollapsed ? (
                    <span className="settings-ai-provider-card-actions">
                      <button className="ghost-btn small" type="button" onClick={() => { void applyAiProviderProfile(profile); }} disabled={profile.enabled === false}>{t('settings.aiPanel.action.apply')}</button>
                      <button className="ghost-btn small danger-btn" type="button" onClick={() => { void deleteAiProviderProfile(profile.id); }} disabled={aiProviderProfiles.length <= 1}>{t('settings.aiPanel.providerList.delete')}</button>
                    </span>
                  ) : null}
                </article>
              );
            })}
          </div>
          {!providerSidebarCollapsed ? <p className="settings-ai-provider-note">{t('settings.aiPanel.providerList.securityNote')}</p> : null}
        </aside>

        <section className="settings-ai-detail-panel" aria-label={t('settings.aiPanel.detail.aria')}>
          <div className="settings-ai-detail-hero">
            <div>
              <span>{t('settings.aiPanel.detail.currentEditing')}</span>
              <h3>{activeAiProviderProfile?.name ?? t('settings.aiPanel.state.noProvider')}</h3>
              <p>{activeProviderKindLabel} · {activeEndpointLabel} · {activeModelLabel}</p>
              <code>{activeBaseUrlLabel}</code>
            </div>
            <div className="settings-ai-detail-actions">
              <button className="ghost-btn small" type="button" onClick={runAiConnectionTest} disabled={testingAi || !activeProviderHasApiKey}>{testingAi ? t('settings.ai.testing') : t('settings.ai.testConnection')}</button>
              <button className="ghost-btn small" type="button" onClick={() => { void openModelDiscovery(); }} disabled={loadingAiModels || !activeProviderHasApiKey}>{loadingAiModels ? t('settings.ai.loadingModels') : t('settings.ai.loadModels')}</button>
              <button className="primary-btn small" type="button" onClick={() => { if (activeAiProviderProfile) void applyAiProviderProfile(activeAiProviderProfile); }} disabled={!activeAiProviderProfile || activeAiProviderProfile.enabled === false}>{t('settings.aiPanel.detail.applyProvider')}</button>
            </div>
          </div>
          <div className="settings-ai-status-grid">
            <span><b>Keyring</b><strong>{apiKeyStorageLabel}</strong></span>
            <span><b>{t('settings.aiPanel.status.connection')}</b><strong>{connectionStatusLabel}</strong></span>
            <span><b>{t('settings.aiPanel.status.requestModel')}</b><strong>{settings.aiModel ?? 'gpt-4.1-mini'}</strong></span>
            <span><b>{t('settings.aiPanel.status.streaming')}</b><strong>{settings.aiStreamingEnabled === false ? t('settings.common.off') : t('settings.common.on')}</strong></span>
          </div>
          <div className="settings-provider-diagnostics" aria-label={t('settings.aiPanel.diagnostics.aria')}>
            <div className="settings-key-storage-status compact" role="status" aria-live="polite">
              <strong>{t('settings.aiPanel.diagnostics.keyStatus', { status: formatAiApiKeyStorageStatus(aiApiKeyStorageStatus, loadingAiApiKeyStorageStatus, aiApiKeyStorageStatusError, t) })}</strong>
              <span>{t('settings.aiPanel.diagnostics.keyring', { status: aiApiKeyStorageStatus?.keyringHasKey ? t('settings.aiPanel.state.saved') : aiApiKeyStorageStatus?.keyringAvailable ? t('settings.aiPanel.state.accessibleUnsaved') : t('settings.aiPanel.state.unavailable') })}</span>
              <span>{t('settings.aiPanel.diagnostics.fallbackFile', { status: aiApiKeyStorageStatus?.fallbackFileHasKey ? t('settings.aiPanel.state.saved') : aiApiKeyStorageStatus?.fallbackFileExists ? t('settings.aiPanel.state.existsEmptyOrInvalid') : t('settings.aiPanel.state.unsaved') })}</span>
              <span>{t('settings.aiPanel.diagnostics.primaryStore', { store: formatAiApiKeyPrimaryStore(aiApiKeyStorageStatus?.primaryStore, t) })}</span>
              {aiApiKeyStorageStatus ? <small>{t('settings.aiPanel.diagnostics.fallbackPath', { path: privacyAiApiKeyFallbackPath })}</small> : null}
              {aiApiKeyStorageStatusError ? <p className="settings-status-line">{t('settings.aiPanel.diagnostics.readFailed', { error: aiApiKeyStorageStatusError })}</p> : null}
            </div>
          </div>
          <div className="settings-ai-core-sections">
        <SettingsSection refNode={aiApiSettingRef} id="ai-api-settings" className={highlightedSetting === 'ai-api' ? 'ai-api-setting-highlight' : ''} title={t('settings.aiPanel.providerRequired.title')} description={t('settings.aiPanel.providerRequired.description')}>
          <SettingControl title={t('settings.aiPanel.providerStatus.title')} description={t('settings.aiPanel.providerStatus.description')} valueText={activeAiProviderProfile ? `${activeAiProviderProfile.name} · ${activeAiProviderProfile.kind}` : t('settings.aiPanel.state.notConfigured')}>
            <ThemedSelect label={t('settings.aiPanel.providerStatus.profileLabel')} value={activeAiProviderProfile?.id ?? 'openai-default'} options={aiProviderProfileOptions} onChange={(value) => { void selectAiProviderProfile(value); }} />
            <p className="settings-status-line">{t('settings.aiPanel.providerStatus.currentConfig', { endpoint: settings.aiEndpointMode ?? 'responses', model: settings.aiModel ?? 'gpt-4.1-mini', baseUrl: settings.aiApiBaseUrl ?? 'https://api.openai.com/v1' })}</p>
          </SettingControl>
          {activeAiProviderProfile ? (
            <>
              <SettingControl title={t('settings.aiPanel.providerNameKind.title')} description={t('settings.aiPanel.providerNameKind.description')} valueText={activeAiProviderProfile.kind}>
                <SettingsTextInput value={activeAiProviderProfile.name} onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { name: value }); }} />
                <ThemedSelect label={t('settings.aiPanel.providerNameKind.kindLabel')} value={activeAiProviderProfile.kind} options={aiProviderKindOptions} onChange={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { kind: value }); }} />
                <label className="settings-toggle"><input type="checkbox" checked={activeAiProviderProfile.enabled !== false} onChange={(event) => { void updateAiProviderProfile(activeAiProviderProfile.id, { enabled: event.target.checked }); }} /><span>{activeAiProviderProfile.enabled === false ? t('settings.aiPanel.providerNameKind.disabled') : t('settings.aiPanel.providerNameKind.enabled')}</span></label>
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerApiKey.title')} description={t('settings.aiPanel.providerApiKey.description')} valueText={activeProviderHasApiKey ? apiKeyStorageLabel : t('settings.aiPanel.providerApiKey.missing')}>
                <SettingsTextInput ariaLabel={t('settings.ai.apiKey')} type={showApiKey ? 'text' : 'password'} value={activeProviderApiKey} placeholder="sk-..." commitOnUnmount onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { apiKey: value }, t('settings.ai.saveSuccess')); }} />
                <p className={`settings-inline-validation ${providerValidation.apiKey.severity}`}>{providerValidation.apiKey.message}</p>
                <div className="settings-inline-actions">
                  <button className="ghost-btn small" type="button" onClick={() => setShowApiKey((value) => !value)}>{showApiKey ? t('settings.ai.hideKey') : t('settings.ai.showKey')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => { void updateAiProviderProfile(activeAiProviderProfile.id, { apiKey: '' }, t('settings.ai.saveSuccess')); }}>{t('settings.ai.clearKey')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => { void refreshAiApiKeyStorageStatus(); }} disabled={loadingAiApiKeyStorageStatus}>{loadingAiApiKeyStorageStatus ? t('settings.aiPanel.action.refreshing') : t('settings.aiPanel.action.refreshStatus')}</button>
                </div>
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerBaseUrl.title')} description={t('settings.aiPanel.providerBaseUrl.description')} valueText={activeAiProviderProfile.apiBaseUrl || t('settings.aiPanel.state.notConfigured')}>
                <SettingsTextInput ariaInvalid={providerValidation.baseUrl.severity === 'error'} value={activeAiProviderProfile.apiBaseUrl} placeholder="https://api.openai.com/v1" onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { apiBaseUrl: value }); }} />
                <p className={`settings-inline-validation ${providerValidation.baseUrl.severity}`}>{providerValidation.baseUrl.message}</p>
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerEndpoint.title')} description={t('settings.aiPanel.providerEndpoint.description')} valueText={activeAiProviderProfile.endpointMode}>
                <ThemedSelect label="Provider Endpoint" value={activeAiProviderProfile.endpointMode} options={aiEndpointOptions} onChange={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { endpointMode: value }); }} />
                <p className={`settings-inline-validation ${providerValidation.endpoint.severity}`}>{providerValidation.endpoint.message}</p>
              </SettingControl>
            </>
          ) : null}
        </SettingsSection>
        <SettingsSection title={t('settings.aiPanel.providerTest.title')} description={t('settings.aiPanel.providerTest.description')}>
          {activeAiProviderProfile ? (
            <>
              <SettingControl title={t('settings.aiPanel.providerConnectionDiscovery.title')} description={t('settings.aiPanel.providerConnectionDiscovery.description')} valueText={connectionStatusLabel}>
                <div className="settings-inline-actions">
                  <button className="primary-btn small" type="button" onClick={runAiConnectionTest} disabled={testingAi || !activeProviderHasApiKey}>{testingAi ? t('settings.ai.testing') : t('settings.ai.testConnection')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => { void openModelDiscovery(); }} disabled={loadingAiModels || !activeProviderHasApiKey}>{loadingAiModels ? t('settings.ai.loadingModels') : t('settings.ai.loadModels')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => { void resetAiProviderModels(activeAiProviderProfile.id); }}>{t('settings.aiPanel.action.resetModels')}</button>
                </div>
                {aiTestStatus ? <p className="settings-status-line">{aiTestStatus.ok ? t('settings.ai.testSuccess') : t('settings.ai.testFailed')} · HTTP {aiTestStatus.status || '-'} · {aiTestStatus.model || '-'} · {aiTestStatus.durationMs}ms · {aiTestStatus.error || aiTestStatus.text}</p> : null}
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerBatchModels.title')} description={t('settings.aiPanel.providerBatchModels.description')} valueText={providerModelDraft.trim() ? t('settings.aiPanel.state.pendingAdd') : t('settings.aiPanel.state.emptyInput')}>
                <div className="settings-inline-actions settings-ai-model-add-row">
                  <input className="settings-inline-input" value={providerModelDraft} placeholder={t('settings.aiPanel.providerBatchModels.placeholder')} onChange={(event) => setProviderModelDraft(event.target.value)} />
                  <button className="ghost-btn small" type="button" onClick={() => { void addAiProviderModels(activeAiProviderProfile.id, providerModelDraft); setProviderModelDraft(''); }} disabled={!providerModelDraft.trim()}>{t('settings.aiPanel.providerBatchModels.add')}</button>
                </div>
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerModelLibrary.title')} description={t('settings.aiPanel.providerModelLibrary.description')} valueText={t('settings.aiPanel.providerModelLibrary.count', { count: activeProviderModelOptions.length })}>
                <p className={`settings-inline-validation ${providerValidation.model.severity}`}>{providerValidation.model.message}</p>
                {activeProviderModelOptions.length ? (
                  <div className="settings-ai-model-list" aria-label={t('settings.aiPanel.providerModelLibrary.aria')}>
                    {activeProviderModelOptions.map((option) => {
                      const modelConfig = getAiProviderModelConfig(activeAiProviderProfile, option.value);
                      return (
                        <div key={option.value} className={option.value === activeAiProviderProfile.model ? 'settings-ai-model-row active' : 'settings-ai-model-row'}>
                          <button className="settings-ai-model-name" type="button" onClick={() => { void selectAiProviderModel(activeAiProviderProfile.id, option.value); }}>
                            <span className="settings-ai-model-label">
                              <span>{modelConfig.displayName || option.label}</span>
                              {renderModelCapabilityIcons(modelConfig, t)}
                            </span>
                          </button>
                          <span className="settings-ai-model-row-actions">
                            {option.value === activeAiProviderProfile.model ? <b>{t('settings.aiPanel.state.current')}</b> : <button className="ghost-btn small" type="button" onClick={() => { void selectAiProviderModel(activeAiProviderProfile.id, option.value); }}>{t('settings.aiPanel.providerModelLibrary.setCurrent')}</button>}
                            <button className="ghost-btn small" type="button" onClick={() => openModelSettings(option.value)}>{t('settings.aiPanel.providerModelLibrary.settings')}</button>
                            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void removeAiProviderModel(activeAiProviderProfile.id, option.value); }} disabled={activeProviderModelOptions.length <= 1}>{t('settings.aiPanel.providerModelLibrary.delete')}</button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </SettingControl>
            </>
          ) : null}
        </SettingsSection>
        <SettingsSection className="settings-section-span-all" title={t('settings.aiPanel.providerAdvancedNetwork.title')} description={t('settings.aiPanel.providerAdvancedNetwork.description')} advanced>
          {activeAiProviderProfile ? (
            <>
              <SettingControl title={t('settings.aiPanel.providerProxy.title')} description={t('settings.aiPanel.providerProxy.description')} valueText={(activeAiProviderProfile.proxyUrl ?? '').trim() ? t('settings.aiPanel.state.proxyConfigured') : t('settings.aiPanel.state.notConfigured')}>
                <SettingsTextInput value={activeAiProviderProfile.proxyUrl ?? ''} placeholder={t('settings.aiPanel.providerProxy.placeholder')} onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { proxyUrl: value }); }} />
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerCustomHeaders.title')} description={t('settings.aiPanel.providerCustomHeaders.description')} valueText={(activeAiProviderProfile.customHeaders ?? '').trim() ? t('settings.aiPanel.state.headersConfigured') : t('settings.aiPanel.state.notConfigured')}>
                <SettingsTextarea value={activeAiProviderProfile.customHeaders ?? ''} placeholder='{"X-Provider": "bookmind"}' onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { customHeaders: value }); }} />
                <p className={`settings-inline-validation ${providerValidation.customHeaders.severity}`}>{providerValidation.customHeaders.message}</p>
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerTimeout.title')} description={t('settings.aiPanel.providerTimeout.description')} valueText={t('settings.aiPanel.unit.seconds', { value: activeAiProviderProfile.requestTimeoutSecs ?? 120 })}>
                <SettingsNumberInput ariaLabel={t('settings.aiPanel.providerTimeout.aria')} min={5} max={600} value={activeAiProviderProfile.requestTimeoutSecs ?? 120} onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { requestTimeoutSecs: Number(value) }); }} />
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerRetry.title')} description={t('settings.aiPanel.providerRetry.description')} valueText={t('settings.aiPanel.unit.times', { value: activeAiProviderProfile.retryCount ?? 1 })}>
                <SettingsNumberInput ariaLabel={t('settings.aiPanel.providerRetry.aria')} min={0} max={5} value={activeAiProviderProfile.retryCount ?? 1} onCommit={(value) => { void updateAiProviderProfile(activeAiProviderProfile.id, { retryCount: Number(value) }); }} />
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.providerStreaming.title')} description={t('settings.aiPanel.providerStreaming.description')} valueText={activeAiProviderProfile.streamingEnabled === false ? t('settings.common.off') : t('settings.common.on')}>
                <label className="settings-toggle"><input type="checkbox" checked={activeAiProviderProfile.streamingEnabled !== false} onChange={(event) => { void updateAiProviderProfile(activeAiProviderProfile.id, { streamingEnabled: event.target.checked }); }} /><span>{activeAiProviderProfile.streamingEnabled === false ? t('settings.aiPanel.providerStreaming.disable') : t('settings.aiPanel.providerStreaming.enable')}</span></label>
              </SettingControl>
              <SettingControl title={t('settings.aiPanel.cancelStrategy.title')} description={t('settings.aiPanel.cancelStrategy.description')} valueText={aiCancelStrategyOptions.find((item) => item.value === (settings.aiCancelStrategy ?? 'abort-and-save-stopped'))?.label}>
                <ThemedSelect label={t('settings.aiPanel.cancelStrategy.title')} value={settings.aiCancelStrategy ?? 'abort-and-save-stopped'} options={aiCancelStrategyOptions} onChange={(value) => { void updateAppSettings({ aiCancelStrategy: value }, t('settings.aiPanel.cancelStrategy.saved')); }} />
              </SettingControl>
            </>
          ) : null}
        </SettingsSection>
        <SettingsSection title={t('settings.aiPanel.generation.title')} description={t('settings.aiPanel.generation.description')}>
          <SettingControl title={t('settings.aiPanel.globalTimeout.title')} description={t('settings.aiPanel.globalTimeout.description')} valueText={t('settings.aiPanel.unit.seconds', { value: settings.aiRequestTimeoutSecs ?? 120 })}>
            <SettingsNumberInput min={5} max={600} value={settings.aiRequestTimeoutSecs ?? 120} onCommit={(value) => { void updateAppSettings({ aiRequestTimeoutSecs: Number(value) }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.globalRetry.title')} description={t('settings.aiPanel.globalRetry.description')} valueText={t('settings.aiPanel.unit.times', { value: settings.aiRetryCount ?? 1 })}>
            <SettingsNumberInput min={0} max={5} value={settings.aiRetryCount ?? 1} onCommit={(value) => { void updateAppSettings({ aiRetryCount: Number(value) }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.globalProxy.title')} description={t('settings.aiPanel.globalProxy.description')} valueText={(settings.aiProxyUrl ?? '').trim() ? t('settings.aiPanel.state.proxyConfigured') : t('settings.aiPanel.state.notConfigured')}>
            <SettingsTextInput value={settings.aiProxyUrl ?? ''} placeholder="http://127.0.0.1:7890" onCommit={(value) => { void updateAppSettings({ aiProxyUrl: value }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.streamingFlush.title')} description={t('settings.aiPanel.streamingFlush.description')} valueText={t('settings.aiPanel.unit.ms', { value: extendedSettings.aiStreamingFlushIntervalMs })}>
            <SettingsNumberInput min={16} max={500} step={16} value={extendedSettings.aiStreamingFlushIntervalMs} onCommit={(value) => updateExtendedSetting('aiStreamingFlushIntervalMs', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.localCancelTimeout.title')} description={t('settings.aiPanel.localCancelTimeout.description')} valueText={t('settings.aiPanel.unit.ms', { value: extendedSettings.localAiCancelTimeoutMs })}>
            <SettingsNumberInput min={100} max={10000} step={100} value={extendedSettings.localAiCancelTimeoutMs} onCommit={(value) => updateExtendedSetting('localAiCancelTimeoutMs', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.temperature.title')} description={t('settings.aiPanel.temperature.description')} valueText={String(settings.aiTemperature ?? 0.2)}>
            <SettingsNumberInput min={0} max={2} step={0.1} value={settings.aiTemperature ?? 0.2} onCommit={(value) => { void updateAppSettings({ aiTemperature: Number(value) }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.topP.title')} description={t('settings.aiPanel.topP.description')} valueText={String(settings.aiTopP ?? 1)}>
            <SettingsNumberInput min={0} max={1} step={0.05} value={settings.aiTopP ?? 1} onCommit={(value) => { void updateAppSettings({ aiTopP: Number(value) }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.maxTokens.title')} description={t('settings.aiPanel.maxTokens.description')} valueText={settings.aiMaxTokens ? t('settings.aiPanel.unit.tokens', { value: settings.aiMaxTokens }) : t('settings.aiPanel.state.serverDefault')}>
            <SettingsNumberInput min={0} max={200000} step={256} value={settings.aiMaxTokens ?? 0} onCommit={(value) => { void updateAppSettings({ aiMaxTokens: Number(value) }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.reasoningEffort.title')} description={t('settings.aiPanel.reasoningEffort.description')} valueText={activeReasoningEffort}>
            <div className="settings-ai-reasoning-control">
              <ThemedSelect label={t('settings.aiPanel.reasoningEffort.presetLabel')} value={activeReasoningEffort} options={visibleAiReasoningEffortOptions} onChange={saveReasoningEffort} />
              <SettingsTextInput value={activeReasoningEffort === 'none' ? '' : activeReasoningEffort} placeholder={t('settings.aiPanel.reasoningEffort.customPlaceholder')} ariaLabel={t('settings.aiPanel.reasoningEffort.customLabel')} onCommit={saveReasoningEffort} />
            </div>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.responseFormat.title')} description={t('settings.aiPanel.responseFormat.description')} valueText={aiResponseFormatOptions.find((item) => item.value === (settings.aiResponseFormat ?? 'auto'))?.label}>
            <ThemedSelect label={t('settings.aiPanel.responseFormat.title')} value={settings.aiResponseFormat ?? 'auto'} options={aiResponseFormatOptions} onChange={(value) => { void updateAppSettings({ aiResponseFormat: value }, t('settings.ai.saveSuccess')); }} />
          </SettingControl>
        </SettingsSection>
          </div>
          <div className="settings-ai-advanced">
            <div className="settings-ai-advanced-head">{t('settings.aiPanel.advancedHead')}</div>
        <SettingsSection title={t('settings.aiPanel.history.title')} description={t('settings.aiPanel.history.description')} advanced>
          <SettingControl title={t('settings.aiPanel.historyEnabled.title')} description={t('settings.aiPanel.historyEnabled.description')} valueText={extendedSettings.cloudAiRequestHistoryEnabled ? t('settings.aiPanel.state.record') : t('settings.aiPanel.state.doNotRecord')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiRequestHistoryEnabled} onChange={(event) => updateExtendedSetting('cloudAiRequestHistoryEnabled', event.target.checked)} /><span>{extendedSettings.cloudAiRequestHistoryEnabled ? t('settings.aiPanel.historyEnabled.on') : t('settings.aiPanel.historyEnabled.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.historyLimit.title')} description={t('settings.aiPanel.historyLimit.description')} valueText={extendedSettings.cloudAiRequestHistoryLimit}>
            <SettingsNumberInput min={0} max={500} value={extendedSettings.cloudAiRequestHistoryLimit} onCommit={(value) => updateExtendedSetting('cloudAiRequestHistoryLimit', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.historySaveFailed.title')} description={t('settings.aiPanel.historySaveFailed.description')} valueText={extendedSettings.cloudAiRequestHistorySaveFailed ? t('settings.aiPanel.historySaveFailed.on') : t('settings.aiPanel.historySaveFailed.off')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiRequestHistorySaveFailed} onChange={(event) => updateExtendedSetting('cloudAiRequestHistorySaveFailed', event.target.checked)} /><span>{extendedSettings.cloudAiRequestHistorySaveFailed ? t('settings.aiPanel.historySaveFailed.on') : t('settings.aiPanel.historySaveFailed.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.historySaveStopped.title')} description={t('settings.aiPanel.historySaveStopped.description')} valueText={extendedSettings.cloudAiRequestHistorySaveStopped ? t('settings.aiPanel.historySaveStopped.on') : t('settings.aiPanel.historySaveStopped.off')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiRequestHistorySaveStopped} onChange={(event) => updateExtendedSetting('cloudAiRequestHistorySaveStopped', event.target.checked)} /><span>{extendedSettings.cloudAiRequestHistorySaveStopped ? t('settings.aiPanel.historySaveStopped.on') : t('settings.aiPanel.historySaveStopped.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.cloudFallback.title')} description={t('settings.aiPanel.cloudFallback.description')} valueText={extendedSettings.cloudAiFallbackToLocalOnFailure ? t('settings.aiPanel.state.autoFallback') : t('settings.aiPanel.state.directError')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiFallbackToLocalOnFailure} onChange={(event) => updateExtendedSetting('cloudAiFallbackToLocalOnFailure', event.target.checked)} /><span>{extendedSettings.cloudAiFallbackToLocalOnFailure ? t('settings.aiPanel.cloudFallback.on') : t('settings.aiPanel.cloudFallback.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.clearHistory.title')} description={t('settings.aiPanel.clearHistory.description')} valueText={currentBookTitle ? t('settings.aiPanel.unit.currentBook', { value: currentBookTitle }) : t('settings.aiPanel.state.noCurrentBook')}>
            <div className="settings-inline-actions">
              <button className="ghost-btn small" type="button" onClick={() => { void exportCurrentBookCloudAiHistoryDiagnostics(); }} disabled={!currentBookId}>{t('settings.aiPanel.clearHistory.exportCurrent')}</button>
              <button className="ghost-btn small" type="button" onClick={() => { void exportAllCloudAiHistoryDiagnostics(); }}>{t('settings.aiPanel.clearHistory.exportAll')}</button>
              <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearCurrentBookCloudAiHistorySettingsData(); }} disabled={!currentBookId}>{t('settings.aiPanel.clearHistory.clearCurrent')}</button>
              <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearAllCloudAiHistorySettingsData(); }}>{t('settings.aiPanel.clearHistory.clearAll')}</button>
            </div>
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={t('settings.aiPanel.scopeRetrieval.title')} description={t('settings.aiPanel.scopeRetrieval.description')} advanced>
          <SettingControl title={t('settings.aiPanel.cloudModeEnabled.title')} description={t('settings.aiPanel.cloudModeEnabled.description')} valueText={extendedSettings.cloudAiEnabled ? t('settings.aiPanel.cloudModeEnabled.allowed') : t('settings.aiPanel.cloudModeEnabled.disabled')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiEnabled} onChange={(event) => updateCloudAiEnabledSetting(event.target.checked)} /><span>{extendedSettings.cloudAiEnabled ? t('settings.aiPanel.cloudModeEnabled.on') : t('settings.aiPanel.cloudModeEnabled.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.localModeEnabled.title')} description={t('settings.aiPanel.localModeEnabled.description')} valueText={extendedSettings.localAiEnabled ? t('settings.aiPanel.localModeEnabled.allowed') : t('settings.aiPanel.localModeEnabled.disabled')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.localAiEnabled} onChange={(event) => updateLocalAiEnabledSetting(event.target.checked)} /><span>{extendedSettings.localAiEnabled ? t('settings.aiPanel.localModeEnabled.on') : t('settings.aiPanel.localModeEnabled.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.sidecar.title')} description={t('settings.aiPanel.sidecar.description')} valueText={extendedSettings.sidecarEnabled ? t('settings.aiPanel.state.configEnabled') : t('settings.aiPanel.state.defaultOff')}>
            <div className="settings-sidecar-grid">
              <label className="settings-sidecar-field span-all">
                <span>{t('settings.aiPanel.sidecar.enabledLabel')}</span>
                <span className="settings-toggle"><input type="checkbox" checked={extendedSettings.sidecarEnabled} onChange={(event) => updateExtendedSetting('sidecarEnabled', event.target.checked)} /><span>{extendedSettings.sidecarEnabled ? t('settings.aiPanel.sidecar.enabledOn') : t('settings.aiPanel.sidecar.enabledOff')}</span></span>
              </label>
              <label className="settings-sidecar-field span-all">
                <span>{t('settings.aiPanel.sidecar.command')}</span>
                <SettingsTextInput value={extendedSettings.sidecarCommand} placeholder="python -m bookmind_sidecar" onCommit={(value) => updateExtendedSetting('sidecarCommand', value)} />
              </label>
              <label className="settings-sidecar-field span-all">
                <span>{t('settings.aiPanel.sidecar.workingDir')}</span>
                <SettingsTextInput value={extendedSettings.sidecarWorkingDir} placeholder={t('settings.aiPanel.sidecar.workingDirPlaceholder')} onCommit={(value) => updateExtendedSetting('sidecarWorkingDir', value)} />
              </label>
              <label className="settings-sidecar-field">
                <span>{t('settings.aiPanel.sidecar.healthTimeout')}</span>
                <SettingsNumberInput min={1000} max={60000} step={500} value={extendedSettings.sidecarHealthTimeoutMs} onCommit={(value) => updateExtendedSetting('sidecarHealthTimeoutMs', value)} />
              </label>
              <label className="settings-sidecar-field">
                <span>{t('settings.aiPanel.sidecar.maxMemory')}</span>
                <SettingsNumberInput min={256} max={65536} step={256} value={extendedSettings.sidecarMaxMemoryMb} onCommit={(value) => updateExtendedSetting('sidecarMaxMemoryMb', value)} />
              </label>
            </div>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.defaultAiMode.title')} description={t('settings.aiPanel.defaultAiMode.description')} valueText={aiModeOptions.find((item) => item.value === extendedSettings.defaultAiMode)?.label}>
            <ThemedSelect label={t('settings.aiPanel.defaultAiMode.label')} value={extendedSettings.defaultAiMode} options={availableAiModeOptions} onChange={(value) => updateDefaultAiModeSetting(value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.defaultScope.title')} description={t('settings.aiPanel.defaultScope.description')} valueText={aiScopeOptions.find((item) => item.value === extendedSettings.aiDefaultScope)?.label}>
            <ThemedSelect label={t('settings.aiPanel.defaultScope.label')} value={extendedSettings.aiDefaultScope} options={aiScopeOptions} onChange={(value) => updateExtendedSetting('aiDefaultScope', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.scopePriority.title')} description={t('settings.aiPanel.scopePriority.description')} valueText={aiScopePriorityStrategyOptions.find((item) => item.value === extendedSettings.aiScopePriorityStrategy)?.label}>
            <ThemedSelect label={t('settings.aiPanel.scopePriority.title')} value={extendedSettings.aiScopePriorityStrategy} options={aiScopePriorityStrategyOptions} onChange={(value) => updateExtendedSetting('aiScopePriorityStrategy', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.noSelectionFallback.title')} description={t('settings.aiPanel.noSelectionFallback.description')} valueText={aiNoSelectionFallbackScopeOptions.find((item) => item.value === extendedSettings.aiNoSelectionFallbackScope)?.label}>
            <ThemedSelect label={t('settings.aiPanel.noSelectionFallback.title')} value={extendedSettings.aiNoSelectionFallbackScope} options={aiNoSelectionFallbackScopeOptions} onChange={(value) => updateExtendedSetting('aiNoSelectionFallbackScope', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.autoDowngrade.title')} description={t('settings.aiPanel.autoDowngrade.description')} valueText={extendedSettings.aiAutoDowngradeScopeOnTokenOverflow ? t('settings.aiPanel.state.autoDowngrade') : t('settings.aiPanel.state.noAutoDowngrade')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiAutoDowngradeScopeOnTokenOverflow} onChange={(event) => updateExtendedSetting('aiAutoDowngradeScopeOnTokenOverflow', event.target.checked)} /><span>{extendedSettings.aiAutoDowngradeScopeOnTokenOverflow ? t('settings.aiPanel.autoDowngrade.on') : t('settings.aiPanel.autoDowngrade.off')}</span></label>
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={t('settings.aiPanel.commands.title')} description={t('settings.aiPanel.commands.description')} advanced>
          <SettingControl title={t('settings.aiPanel.commandScope.summary.title')} description={t('settings.aiPanel.commandScope.summary.description')} valueText={aiCommandScopeOptions.find((item) => item.value === extendedSettings.aiCommandDefaultScopes.summary)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandScope.summary.title')} value={extendedSettings.aiCommandDefaultScopes.summary} options={aiCommandScopeOptions} onChange={(value) => updateAiCommandDefaultScope('summary', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandScope.characters.title')} description={t('settings.aiPanel.commandScope.characters.description')} valueText={aiCommandScopeOptions.find((item) => item.value === extendedSettings.aiCommandDefaultScopes.characters)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandScope.characters.title')} value={extendedSettings.aiCommandDefaultScopes.characters} options={aiCommandScopeOptions} onChange={(value) => updateAiCommandDefaultScope('characters', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandScope.foreshadow.title')} description={t('settings.aiPanel.commandScope.foreshadow.description')} valueText={aiCommandScopeOptions.find((item) => item.value === extendedSettings.aiCommandDefaultScopes.foreshadow)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandScope.foreshadow.title')} value={extendedSettings.aiCommandDefaultScopes.foreshadow} options={aiCommandScopeOptions} onChange={(value) => updateAiCommandDefaultScope('foreshadow', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandScope.timeline.title')} description={t('settings.aiPanel.commandScope.timeline.description')} valueText={aiCommandScopeOptions.find((item) => item.value === extendedSettings.aiCommandDefaultScopes.timeline)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandScope.timeline.title')} value={extendedSettings.aiCommandDefaultScopes.timeline} options={aiCommandScopeOptions} onChange={(value) => updateAiCommandDefaultScope('timeline', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandScope.cards.title')} description={t('settings.aiPanel.commandScope.cards.description')} valueText={aiCommandScopeOptions.find((item) => item.value === extendedSettings.aiCommandDefaultScopes.cards)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandScope.cards.title')} value={extendedSettings.aiCommandDefaultScopes.cards} options={aiCommandScopeOptions} onChange={(value) => updateAiCommandDefaultScope('cards', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.slashMenu.title')} description={t('settings.aiPanel.slashMenu.description')} valueText={extendedSettings.aiSlashMenuEnabled ? t('settings.common.enabled') : t('settings.common.disabled')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiSlashMenuEnabled} onChange={(event) => updateExtendedSetting('aiSlashMenuEnabled', event.target.checked)} /><span>{extendedSettings.aiSlashMenuEnabled ? t('settings.aiPanel.slashMenu.show') : t('settings.aiPanel.slashMenu.hide')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.builtInCommands.title')} description={t('settings.aiPanel.builtInCommands.description')} valueText={Object.values(extendedSettings.aiBuiltInSlashCommandEnabled).filter(Boolean).length === 5 ? t('settings.aiPanel.state.allEnabled') : t('settings.aiPanel.unit.enabledCount', { value: Object.values(extendedSettings.aiBuiltInSlashCommandEnabled).filter(Boolean).length, total: 5 })}>
            <div className="settings-inline-actions">
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiBuiltInSlashCommandEnabled.summary} onChange={(event) => updateAiBuiltInSlashCommandEnabled('summary', event.target.checked)} /><span>{t('settings.aiPanel.builtInCommands.summary')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiBuiltInSlashCommandEnabled.characters} onChange={(event) => updateAiBuiltInSlashCommandEnabled('characters', event.target.checked)} /><span>{t('settings.aiPanel.builtInCommands.characters')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiBuiltInSlashCommandEnabled.foreshadow} onChange={(event) => updateAiBuiltInSlashCommandEnabled('foreshadow', event.target.checked)} /><span>{t('settings.aiPanel.builtInCommands.foreshadow')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiBuiltInSlashCommandEnabled.timeline} onChange={(event) => updateAiBuiltInSlashCommandEnabled('timeline', event.target.checked)} /><span>{t('settings.aiPanel.builtInCommands.timeline')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiBuiltInSlashCommandEnabled.cards} onChange={(event) => updateAiBuiltInSlashCommandEnabled('cards', event.target.checked)} /><span>{t('settings.aiPanel.builtInCommands.cards')}</span></label>
            </div>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.customCommandLimit.title')} description={t('settings.aiPanel.customCommandLimit.description')} valueText={t('settings.aiPanel.unit.items', { value: extendedSettings.aiCustomSlashCommandLimit })}>
            <SettingsNumberInput min={0} max={50} value={extendedSettings.aiCustomSlashCommandLimit} onCommit={(value) => updateExtendedSetting('aiCustomSlashCommandLimit', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandTemplates.title')} description={t('settings.aiPanel.commandTemplates.description')}>
            <div className="settings-custom-command-list">
              <div className="settings-inline-actions">
                <ReadonlyPill text={t('settings.aiPanel.commandTemplates.customCount', { value: customSlashCommandList.length, total: extendedSettings.aiCustomSlashCommandLimit })} />
                <button className="ghost-btn small" type="button" onClick={refreshCustomSlashCommandList}>{t('settings.aiPanel.commandTemplates.refresh')}</button>
                <button className="ghost-btn small" type="button" onClick={exportCustomSlashCommandsFromSettings}>{t('settings.aiPanel.commandTemplates.export')}</button>
                <button className="ghost-btn small" type="button" onClick={() => customSlashCommandImportInputRef.current?.click()}>{t('settings.aiPanel.commandTemplates.import')}</button>
                <input ref={customSlashCommandImportInputRef} type="file" accept="application/json,.json" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.currentTarget.files?.[0]; if (file) void importCustomSlashCommandsFromSettings(file); event.currentTarget.value = ''; }} />
              </div>
              <div className="settings-custom-command-form">
                <input className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.nameAria')} placeholder={t('settings.aiPanel.commandTemplates.namePlaceholder')} value={customSlashCommandDraft.label} onChange={(event) => setCustomSlashCommandDraft((draft) => ({ ...draft, label: event.target.value }))} />
                <textarea className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.promptAria')} placeholder={t('settings.aiPanel.commandTemplates.promptPlaceholder')} value={customSlashCommandDraft.prompt} onChange={(event) => setCustomSlashCommandDraft((draft) => ({ ...draft, prompt: event.target.value }))} />
                <input className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.aliasesAria')} placeholder={t('settings.aiPanel.commandTemplates.aliasesPlaceholder')} value={customSlashCommandDraft.aliases} onChange={(event) => setCustomSlashCommandDraft((draft) => ({ ...draft, aliases: event.target.value }))} />
                <div className="settings-inline-actions">
                  <ThemedSelect label={t('settings.aiPanel.commandTemplates.scopeLabel')} value={customSlashCommandDraft.scopeHint} options={aiScopeOptions} onChange={(value) => setCustomSlashCommandDraft((draft) => ({ ...draft, scopeHint: value }))} />
                  <input className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.outputAria')} placeholder={t('settings.aiPanel.commandTemplates.outputPlaceholder')} value={customSlashCommandDraft.outputHint} onChange={(event) => setCustomSlashCommandDraft((draft) => ({ ...draft, outputHint: event.target.value }))} />
                  <button className="primary-btn small" type="button" onClick={createCustomSlashCommandFromSettings}>{t('settings.aiPanel.commandTemplates.addCustom')}</button>
                </div>
              </div>
              <div className="settings-custom-command-list" aria-label={t('settings.aiPanel.commandTemplates.libraryAria')}>
                <div className="settings-inline-actions">
                  <ReadonlyPill text={t('settings.aiPanel.commandTemplates.libraryTitle')} />
                  <span className="settings-muted-text">{t('settings.aiPanel.commandTemplates.libraryHint')}</span>
                </div>
                {customSlashCommandTemplateLibrary.map((template) => (
                  <article className="settings-custom-command-item" key={template.id}>
                    <header>
                      <strong>/{template.label}</strong>
                      <span>{template.scopeHint} · {template.outputHint}</span>
                    </header>
                    <p>{template.prompt}</p>
                    <small>{t('settings.aiPanel.commandTemplates.aliasesPrefix', { value: template.aliases.join(' / ') })}</small>
                    <div className="settings-inline-actions">
                      <button className="ghost-btn small" type="button" onClick={() => addCustomSlashCommandTemplate(template)}>{t('settings.aiPanel.commandTemplates.addTemplate')}</button>
                    </div>
                  </article>
                ))}
              </div>
              {customSlashCommandList.length ? customSlashCommandList.map((item) => (
                <article className="settings-custom-command-item" key={item.id}>
                  {customSlashCommandEditingId === item.id ? (
                    <div className="settings-custom-command-form">
                      <input className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.editNameAria')} placeholder={t('settings.aiPanel.commandTemplates.editNamePlaceholder')} value={customSlashCommandEditDraft.label} onChange={(event) => setCustomSlashCommandEditDraft((draft) => ({ ...draft, label: event.target.value }))} />
                      <textarea className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.editPromptAria')} placeholder={t('settings.aiPanel.commandTemplates.editPromptPlaceholder')} value={customSlashCommandEditDraft.prompt} onChange={(event) => setCustomSlashCommandEditDraft((draft) => ({ ...draft, prompt: event.target.value }))} />
                      <input className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.editAliasesAria')} placeholder={t('settings.aiPanel.commandTemplates.editAliasesPlaceholder')} value={customSlashCommandEditDraft.aliases} onChange={(event) => setCustomSlashCommandEditDraft((draft) => ({ ...draft, aliases: event.target.value }))} />
                      <div className="settings-inline-actions">
                        <ThemedSelect label={t('settings.aiPanel.commandTemplates.editScopeLabel')} value={customSlashCommandEditDraft.scopeHint} options={aiScopeOptions} onChange={(value) => setCustomSlashCommandEditDraft((draft) => ({ ...draft, scopeHint: value }))} />
                        <input className="settings-inline-input" aria-label={t('settings.aiPanel.commandTemplates.editOutputAria')} placeholder={t('settings.aiPanel.commandTemplates.editOutputPlaceholder')} value={customSlashCommandEditDraft.outputHint} onChange={(event) => setCustomSlashCommandEditDraft((draft) => ({ ...draft, outputHint: event.target.value }))} />
                      </div>
                      <div className="settings-inline-actions">
                        <button className="primary-btn small" type="button" onClick={saveCustomSlashCommandEdit}>{t('settings.aiPanel.commandTemplates.saveCustom')}</button>
                        <button className="ghost-btn small" type="button" onClick={() => deleteCustomSlashCommandFromSettings(item)}>{t('settings.aiPanel.commandTemplates.deleteCustom')}</button>
                        <button className="ghost-btn small" type="button" onClick={cancelCustomSlashCommandEdit}>{t('settings.aiPanel.commandTemplates.cancelEdit')}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <header>
                        <strong>/{item.label}</strong>
                        <span>{item.scopeHint} · {item.outputHint}</span>
                      </header>
                      <p>{item.prompt}</p>
                      <small>{t('settings.aiPanel.commandTemplates.aliasesPrefix', { value: item.aliases.join(' / ') || t('settings.aiPanel.state.notSet') })}</small>
                      <div className="settings-inline-actions">
                        <button className="ghost-btn small" type="button" onClick={() => startEditingCustomSlashCommand(item)}>{t('settings.aiPanel.commandTemplates.editCustom')}</button>
                        <button className="ghost-btn small" type="button" onClick={() => deleteCustomSlashCommandFromSettings(item)}>{t('settings.aiPanel.commandTemplates.deleteCustom')}</button>
                      </div>
                    </>
                  )}
                </article>
              )) : (
                <div className="settings-custom-command-empty">
                  <strong>{t('settings.aiPanel.commandTemplates.emptyTitle')}</strong>
                  <span>{t('settings.aiPanel.commandTemplates.emptyDescription')}</span>
                </div>
              )}
            </div>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.recentCommandLimit.title')} description={t('settings.aiPanel.recentCommandLimit.description')} valueText={t('settings.aiPanel.unit.items', { value: extendedSettings.aiRecentSlashCommandLimit })}>
            <SettingsNumberInput min={0} max={20} value={extendedSettings.aiRecentSlashCommandLimit} onCommit={(value) => updateExtendedSetting('aiRecentSlashCommandLimit', value)} />
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={t('settings.aiPanel.retrievalCitation.title')} description={t('settings.aiPanel.retrievalCitation.description')} advanced>
          <SettingControl title={t('settings.aiPanel.defaultRetrievalStrategy.title')} description={t('settings.aiPanel.defaultRetrievalStrategy.description')} valueText={aiRetrievalStrategyOptions.find((item) => item.value === extendedSettings.aiDefaultRetrievalStrategy)?.label}>
            <ThemedSelect label={t('settings.aiPanel.defaultRetrievalStrategy.title')} value={extendedSettings.aiDefaultRetrievalStrategy} options={aiRetrievalStrategyOptions} onChange={(value) => updateExtendedSetting('aiDefaultRetrievalStrategy', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.queryRewrite.title')} description={t('settings.aiPanel.queryRewrite.description')} valueText={aiRetrievalQueryRewriteModeOptions.find((item) => item.value === extendedSettings.aiRetrievalQueryRewriteMode)?.label}>
            <ThemedSelect label={t('settings.aiPanel.queryRewrite.title')} value={extendedSettings.aiRetrievalQueryRewriteMode} options={aiRetrievalQueryRewriteModeOptions} onChange={(value) => updateExtendedSetting('aiRetrievalQueryRewriteMode', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.multiStageRetrieval.title')} description={t('settings.aiPanel.multiStageRetrieval.description')} valueText={aiMultiStageRetrievalModeOptions.find((item) => item.value === extendedSettings.aiMultiStageRetrievalMode)?.label}>
            <ThemedSelect label={t('settings.aiPanel.multiStageRetrieval.title')} value={extendedSettings.aiMultiStageRetrievalMode} options={aiMultiStageRetrievalModeOptions} onChange={(value) => updateExtendedSetting('aiMultiStageRetrievalMode', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.hybridMode.title')} description={t('settings.aiPanel.hybridMode.description')} valueText={extendedSettings.aiHybridLocalFirstCloudSummary ? t('settings.aiPanel.hybridMode.onValue') : t('settings.common.off')}>
            <label className="settings-toggle">
              <input type="checkbox" checked={extendedSettings.aiHybridLocalFirstCloudSummary} onChange={(event) => updateExtendedSetting('aiHybridLocalFirstCloudSummary', event.target.checked)} />
              <span>{extendedSettings.aiHybridLocalFirstCloudSummary ? t('settings.aiPanel.hybridMode.on') : t('settings.aiPanel.hybridMode.off')}</span>
            </label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandRetrieval.summary.title')} description={t('settings.aiPanel.commandRetrieval.summary.description')} valueText={aiRetrievalStrategyOptions.find((item) => item.value === extendedSettings.aiCommandRetrievalStrategies.summary)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandRetrieval.summary.title')} value={extendedSettings.aiCommandRetrievalStrategies.summary} options={aiRetrievalStrategyOptions} onChange={(value) => updateAiCommandRetrievalStrategy('summary', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandRetrieval.characters.title')} description={t('settings.aiPanel.commandRetrieval.characters.description')} valueText={aiRetrievalStrategyOptions.find((item) => item.value === extendedSettings.aiCommandRetrievalStrategies.characters)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandRetrieval.characters.title')} value={extendedSettings.aiCommandRetrievalStrategies.characters} options={aiRetrievalStrategyOptions} onChange={(value) => updateAiCommandRetrievalStrategy('characters', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandRetrieval.foreshadow.title')} description={t('settings.aiPanel.commandRetrieval.foreshadow.description')} valueText={aiRetrievalStrategyOptions.find((item) => item.value === extendedSettings.aiCommandRetrievalStrategies.foreshadow)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandRetrieval.foreshadow.title')} value={extendedSettings.aiCommandRetrievalStrategies.foreshadow} options={aiRetrievalStrategyOptions} onChange={(value) => updateAiCommandRetrievalStrategy('foreshadow', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandRetrieval.timeline.title')} description={t('settings.aiPanel.commandRetrieval.timeline.description')} valueText={aiRetrievalStrategyOptions.find((item) => item.value === extendedSettings.aiCommandRetrievalStrategies.timeline)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandRetrieval.timeline.title')} value={extendedSettings.aiCommandRetrievalStrategies.timeline} options={aiRetrievalStrategyOptions} onChange={(value) => updateAiCommandRetrievalStrategy('timeline', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.commandRetrieval.cards.title')} description={t('settings.aiPanel.commandRetrieval.cards.description')} valueText={aiRetrievalStrategyOptions.find((item) => item.value === extendedSettings.aiCommandRetrievalStrategies.cards)?.label}>
            <ThemedSelect label={t('settings.aiPanel.commandRetrieval.cards.title')} value={extendedSettings.aiCommandRetrievalStrategies.cards} options={aiRetrievalStrategyOptions} onChange={(value) => updateAiCommandRetrievalStrategy('cards', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.fallbackEnabled.title')} description={t('settings.aiPanel.fallbackEnabled.description')} valueText={extendedSettings.aiFallbackEnabled ? t('settings.aiPanel.fallbackEnabled.allowed') : t('settings.aiPanel.fallbackEnabled.forbidden')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiFallbackEnabled} onChange={(event) => updateExtendedSetting('aiFallbackEnabled', event.target.checked)} /><span>{extendedSettings.aiFallbackEnabled ? t('settings.aiPanel.fallbackEnabled.on') : t('settings.aiPanel.fallbackEnabled.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.ftsUnavailable.title')} description={t('settings.aiPanel.ftsUnavailable.description')} valueText={aiFtsUnavailableBehaviorOptions.find((item) => item.value === extendedSettings.aiFtsUnavailableBehavior)?.label}>
            <ThemedSelect label={t('settings.aiPanel.ftsUnavailable.label')} value={extendedSettings.aiFtsUnavailableBehavior} options={aiFtsUnavailableBehaviorOptions} onChange={(value) => updateExtendedSetting('aiFtsUnavailableBehavior', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.localIndexResultLimit.title')} description={t('settings.aiPanel.localIndexResultLimit.description')} valueText={t('settings.aiPanel.unit.items', { value: extendedSettings.aiLocalIndexResultLimit })}>
            <SettingsNumberInput min={1} max={100} value={extendedSettings.aiLocalIndexResultLimit} onCommit={(value) => updateExtendedSetting('aiLocalIndexResultLimit', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.citationMinConfidence.title')} description={t('settings.aiPanel.citationMinConfidence.description')} valueText={extendedSettings.aiCitationMinConfidence}>
            <SettingsNumberInput min={0} max={1} step={0.05} value={extendedSettings.aiCitationMinConfidence} onCommit={(value) => updateExtendedSetting('aiCitationMinConfidence', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.defaultOutputFormat.title')} description={t('settings.aiPanel.defaultOutputFormat.description')} valueText={aiDefaultOutputFormatOptions.find((item) => item.value === extendedSettings.aiDefaultOutputFormat)?.label}>
            <ThemedSelect label={t('settings.aiPanel.defaultOutputFormat.title')} value={extendedSettings.aiDefaultOutputFormat} options={aiDefaultOutputFormatOptions} onChange={(value) => updateExtendedSetting('aiDefaultOutputFormat', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.requireCitations.title')} description={t('settings.aiPanel.requireCitations.description')} valueText={extendedSettings.aiRequireCitations ? t('settings.aiPanel.requireCitations.required') : t('settings.aiPanel.requireCitations.notRequired')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiRequireCitations} onChange={(event) => updateExtendedSetting('aiRequireCitations', event.target.checked)} /><span>{extendedSettings.aiRequireCitations ? t('settings.aiPanel.requireCitations.on') : t('settings.aiPanel.requireCitations.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.noCitationWarning.title')} description={t('settings.aiPanel.noCitationWarning.description')} valueText={extendedSettings.aiNoCitationWarningEnabled ? t('settings.aiPanel.state.showWarning') : t('settings.aiPanel.state.hideWarning')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiNoCitationWarningEnabled} onChange={(event) => updateExtendedSetting('aiNoCitationWarningEnabled', event.target.checked)} /><span>{extendedSettings.aiNoCitationWarningEnabled ? t('settings.aiPanel.noCitationWarning.on') : t('settings.aiPanel.noCitationWarning.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.citationCoverage.title')} description={t('settings.aiPanel.citationCoverage.description')} valueText={extendedSettings.aiCitationCoverageVisible ? t('settings.aiPanel.citationCoverage.shown') : t('settings.aiPanel.citationCoverage.hidden')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiCitationCoverageVisible} onChange={(event) => updateExtendedSetting('aiCitationCoverageVisible', event.target.checked)} /><span>{extendedSettings.aiCitationCoverageVisible ? t('settings.aiPanel.citationCoverage.on') : t('settings.aiPanel.citationCoverage.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.citationCardDensity.title')} description={t('settings.aiPanel.citationCardDensity.description')} valueText={aiCitationCardDefaultDensityOptions.find((item) => item.value === extendedSettings.aiCitationCardDefaultDensity)?.label}>
            <ThemedSelect label={t('settings.aiPanel.citationCardDensity.label')} value={extendedSettings.aiCitationCardDefaultDensity} options={aiCitationCardDefaultDensityOptions} onChange={(value) => updateExtendedSetting('aiCitationCardDefaultDensity', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.externalCitations.title')} description={t('settings.aiPanel.externalCitations.description')} valueText={extendedSettings.aiExternalCitationsDisabled ? t('settings.aiPanel.externalCitations.disabled') : t('settings.aiPanel.externalCitations.allowed')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiExternalCitationsDisabled} onChange={(event) => updateExtendedSetting('aiExternalCitationsDisabled', event.target.checked)} /><span>{extendedSettings.aiExternalCitationsDisabled ? t('settings.aiPanel.externalCitations.on') : t('settings.aiPanel.externalCitations.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.jumpRepair.title')} description={t('settings.aiPanel.jumpRepair.description')} valueText={extendedSettings.aiCitationJumpRepairEnabled ? t('settings.aiPanel.jumpRepair.shown') : t('settings.aiPanel.jumpRepair.failedOnly')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiCitationJumpRepairEnabled} onChange={(event) => updateExtendedSetting('aiCitationJumpRepairEnabled', event.target.checked)} /><span>{extendedSettings.aiCitationJumpRepairEnabled ? t('settings.aiPanel.jumpRepair.on') : t('settings.aiPanel.jumpRepair.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.citationStrictness.title')} description={t('settings.aiPanel.citationStrictness.description')} valueText={aiCitationFieldStrictnessOptions.find((item) => item.value === extendedSettings.aiCitationFieldStrictness)?.label}>
            <ThemedSelect label={t('settings.aiPanel.citationStrictness.label')} value={extendedSettings.aiCitationFieldStrictness} options={aiCitationFieldStrictnessOptions} onChange={(value) => updateExtendedSetting('aiCitationFieldStrictness', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.toolCallDisplay.title')} description={t('settings.aiPanel.toolCallDisplay.description')} valueText={aiToolCallDisplayModeOptions.find((item) => item.value === extendedSettings.aiToolCallDisplayMode)?.label}>
            <ThemedSelect label={t('settings.aiPanel.toolCallDisplay.title')} value={extendedSettings.aiToolCallDisplayMode} options={aiToolCallDisplayModeOptions} onChange={(value) => updateExtendedSetting('aiToolCallDisplayMode', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.renderedBlockLimit.title')} description={t('settings.aiPanel.renderedBlockLimit.description')} valueText={t('settings.aiPanel.unit.blocks', { value: extendedSettings.aiRenderedBlockLimit })}>
            <SettingsNumberInput min={20} max={500} value={extendedSettings.aiRenderedBlockLimit} onCommit={(value) => updateExtendedSetting('aiRenderedBlockLimit', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.saveStructuredResponse.title')} description={t('settings.aiPanel.saveStructuredResponse.description')} valueText={extendedSettings.aiSaveStructuredResponseWithNote ? t('settings.aiPanel.saveStructuredResponse.structured') : t('settings.aiPanel.saveStructuredResponse.plain')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.aiSaveStructuredResponseWithNote} onChange={(event) => updateExtendedSetting('aiSaveStructuredResponseWithNote', event.target.checked)} /><span>{extendedSettings.aiSaveStructuredResponseWithNote ? t('settings.aiPanel.saveStructuredResponse.on') : t('settings.aiPanel.saveStructuredResponse.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.citationSaveTarget.title')} description={t('settings.aiPanel.citationSaveTarget.description')} valueText={aiCitationDefaultSaveTargetOptions.find((item) => item.value === extendedSettings.aiCitationDefaultSaveTarget)?.label}>
            <ThemedSelect label={t('settings.aiPanel.citationSaveTarget.title')} value={extendedSettings.aiCitationDefaultSaveTarget} options={aiCitationDefaultSaveTargetOptions} onChange={(value) => updateExtendedSetting('aiCitationDefaultSaveTarget', value)} />
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={t('settings.aiPanel.privacy.title')} description={t('settings.aiPanel.privacy.description')} advanced>
          <SettingControl title={t('settings.aiPanel.cloudConfirmation.title')} description={t('settings.aiPanel.cloudConfirmation.description')} valueText={extendedSettings.cloudAiRequireConfirmation ? t('settings.aiPanel.state.confirmRequired') : t('settings.aiPanel.state.confirmNotRequired')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiRequireConfirmation} onChange={(event) => updateExtendedSetting('cloudAiRequireConfirmation', event.target.checked)} /><span>{extendedSettings.cloudAiRequireConfirmation ? t('settings.aiPanel.cloudConfirmation.on') : t('settings.aiPanel.cloudConfirmation.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.currentBookConsent.title')} description={t('settings.aiPanel.currentBookConsent.description')} valueText={currentBookTitle ? t('settings.aiPanel.unit.currentBook', { value: currentBookTitle }) : t('settings.aiPanel.state.noCurrentBook')}>
            <div className="settings-inline-actions">
              <button className="ghost-btn small" type="button" onClick={() => { void allowCurrentBookCloudAiSettingsData(); }} disabled={!currentBookId}>{t('settings.aiPanel.currentBookConsent.allow')}</button>
              <button className="ghost-btn small danger-btn" type="button" onClick={() => { void revokeCurrentBookCloudAiConsentSettingsData(); }} disabled={!currentBookId}>{t('settings.aiPanel.currentBookConsent.revoke')}</button>
            </div>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.autoRedact.title')} description={t('settings.aiPanel.autoRedact.description')} valueText={extendedSettings.cloudAiAutoRedact ? t('settings.aiPanel.state.autoRedact') : t('settings.aiPanel.state.noRedact')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiAutoRedact} onChange={(event) => updateExtendedSetting('cloudAiAutoRedact', event.target.checked)} /><span>{extendedSettings.cloudAiAutoRedact ? t('settings.aiPanel.autoRedact.on') : t('settings.aiPanel.autoRedact.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.sensitiveWords.title')} description={t('settings.aiPanel.sensitiveWords.description')} valueText={extendedSettings.cloudAiSensitiveWords.trim() ? t('settings.aiPanel.unit.words', { value: extendedSettings.cloudAiSensitiveWords.split(/\n+/).filter(Boolean).length }) : t('settings.aiPanel.state.notConfigured')}>
            <SettingsTextarea compact value={extendedSettings.cloudAiSensitiveWords} placeholder={t('settings.aiPanel.sensitiveWords.placeholder')} onCommit={(value) => updateExtendedSetting('cloudAiSensitiveWords', value)} />
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.redactionPreview.title')} description={t('settings.aiPanel.redactionPreview.description')} valueText={t('settings.aiPanel.unit.replacements', { value: cloudRedactionPreview.replacementCount })}>
            <div className="cloud-ai-redaction-preview" role="status" aria-label={t('settings.aiPanel.redactionPreview.aria')}>
              <header>
                <strong>{t('settings.aiPanel.redactionPreview.rules')}</strong>
                <span>{cloudRedactionPreview.replacementTypes.length ? cloudRedactionPreview.replacementTypes.join(' / ') : t('settings.common.none')}</span>
              </header>
              <label>
                <span>{t('settings.aiPanel.redactionPreview.source')}</span>
                <textarea className="settings-textarea compact" value={cloudRedactionPreviewInput} onChange={(event) => setCloudRedactionPreviewInput(event.target.value)} />
              </label>
              <label>
                <span>{t('settings.aiPanel.redactionPreview.redacted')}</span>
                <textarea className="settings-textarea compact" value={cloudRedactionPreview.redactedText} readOnly />
              </label>
            </div>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.allowSelection.title')} description={t('settings.aiPanel.allowSelection.description')} valueText={extendedSettings.cloudAiAllowSelectionText ? t('settings.aiPanel.allowSelection.allowed') : t('settings.aiPanel.allowSelection.forbidden')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiAllowSelectionText} onChange={(event) => updateExtendedSetting('cloudAiAllowSelectionText', event.target.checked)} /><span>{extendedSettings.cloudAiAllowSelectionText ? t('settings.aiPanel.allowSelection.on') : t('settings.aiPanel.allowSelection.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.allowCurrentPage.title')} description={t('settings.aiPanel.allowCurrentPage.description')} valueText={extendedSettings.cloudAiAllowCurrentPageText ? t('settings.aiPanel.allowCurrentPage.allowed') : t('settings.aiPanel.allowCurrentPage.forbidden')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiAllowCurrentPageText} onChange={(event) => updateExtendedSetting('cloudAiAllowCurrentPageText', event.target.checked)} /><span>{extendedSettings.cloudAiAllowCurrentPageText ? t('settings.aiPanel.allowCurrentPage.on') : t('settings.aiPanel.allowCurrentPage.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.allowCurrentChapter.title')} description={t('settings.aiPanel.allowCurrentChapter.description')} valueText={extendedSettings.cloudAiAllowCurrentChapterText ? t('settings.aiPanel.allowCurrentChapter.allowed') : t('settings.aiPanel.allowCurrentChapter.forbidden')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiAllowCurrentChapterText} onChange={(event) => updateExtendedSetting('cloudAiAllowCurrentChapterText', event.target.checked)} /><span>{extendedSettings.cloudAiAllowCurrentChapterText ? t('settings.aiPanel.allowCurrentChapter.on') : t('settings.aiPanel.allowCurrentChapter.off')}</span></label>
          </SettingControl>
          <SettingControl title={t('settings.aiPanel.allowBookSummary.title')} description={t('settings.aiPanel.allowBookSummary.description')} valueText={extendedSettings.cloudAiAllowBookSummaryContext ? t('settings.aiPanel.allowBookSummary.allowed') : t('settings.aiPanel.allowBookSummary.forbidden')}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cloudAiAllowBookSummaryContext} onChange={(event) => updateExtendedSetting('cloudAiAllowBookSummaryContext', event.target.checked)} /><span>{extendedSettings.cloudAiAllowBookSummaryContext ? t('settings.aiPanel.allowBookSummary.on') : t('settings.aiPanel.allowBookSummary.off')}</span></label>
          </SettingControl>
        </SettingsSection>
          </div>
        </section>
        {modelDiscoveryOpen && activeAiProviderProfile ? (
          <div className="settings-modal-layer" role="dialog" aria-modal="true" aria-label={t('settings.aiPanel.modelDiscovery.aria')}>
            <section className="settings-ai-model-dialog">
              <header>
                <div>
                  <strong>{t('settings.aiPanel.modelDiscovery.title', { name: activeAiProviderProfile.name })}</strong>
                  <small>{t('settings.aiPanel.modelDiscovery.count', { fetched: aiModelOptions.length, pending: discoveredModelSelection.size })}</small>
                </div>
                <button className="ghost-btn small" type="button" onClick={() => setModelDiscoveryOpen(false)}>{t('settings.common.close')}</button>
              </header>
              <input className="settings-inline-input" value={discoveredModelQuery} placeholder={t('settings.aiPanel.modelDiscovery.searchPlaceholder')} onChange={(event) => setDiscoveredModelQuery(event.target.value)} />
              <div className="settings-ai-discovered-model-list">
                {filteredDiscoveredModelOptions.length ? filteredDiscoveredModelOptions.map((option) => {
                  const selected = discoveredModelSelection.has(option.value);
                  return (
                    <button key={option.value} type="button" className={selected ? 'selected' : ''} onClick={() => toggleDiscoveredModel(option.value)}>
                      <span>{option.label}</span>
                      <b>{selected ? t('settings.common.cancel') : t('settings.common.add')}</b>
                    </button>
                  );
                }) : <p className="settings-status-line">{t('settings.aiPanel.modelDiscovery.empty')}</p>}
              </div>
              <footer>
                <button className="ghost-btn small" type="button" onClick={() => setDiscoveredModelSelection(new Set())}>{t('settings.aiPanel.modelDiscovery.clear')}</button>
                <button
                  className="primary-btn small"
                  type="button"
                  disabled={!discoveredModelSelection.size}
                  onClick={() => {
                    void addAiProviderModels(activeAiProviderProfile.id, Array.from(discoveredModelSelection));
                    setModelDiscoveryOpen(false);
                  }}
                >{t('settings.aiPanel.modelDiscovery.confirm')}</button>
              </footer>
            </section>
          </div>
        ) : null}
        {activeModelSettingsDraft && activeAiProviderProfile ? (
          <div className="settings-modal-layer" role="dialog" aria-modal="true" aria-label={t('settings.aiPanel.modelSettings.aria')}>
            <section className="settings-ai-model-dialog settings-ai-model-settings-dialog">
              <header>
                <div>
                  <strong>{t('settings.aiPanel.modelSettings.title')}</strong>
                  <small>{activeModelSettingsDraft.id}</small>
                </div>
                <button className="ghost-btn small" type="button" onClick={cancelModelSettingsDraft}>{t('settings.common.cancel')}</button>
              </header>
              <div className="settings-ai-model-settings-grid">
                <label><span>{t('settings.aiPanel.modelSettings.modelId')}</span><input className="settings-inline-input" value={activeModelSettingsDraft.id} readOnly /></label>
                <label><span>{t('settings.aiPanel.modelSettings.displayName')}</span><input className="settings-inline-input" value={activeModelSettingsDraft.displayName} onChange={(event) => updateModelSettingsDraft({ displayName: event.target.value })} /></label>
                <div className="settings-ai-model-settings-field"><ThemedSelect label={t('settings.aiPanel.modelSettings.modelType')} value={activeModelSettingsDraft.type} options={aiProviderModelTypeOptions} onChange={(value) => updateModelSettingsDraft({ type: value })} /></div>
                <label><span>{t('settings.aiPanel.modelSettings.contextWindow')}</span><input className="settings-inline-input" type="number" min={1} max={4000000} value={activeModelSettingsDraft.contextWindowTokens} onChange={(event) => updateModelSettingsDraft({ contextWindowTokens: Number(event.target.value) })} /></label>
                <label><span>{t('settings.aiPanel.modelSettings.maxOutput')}</span><input className="settings-inline-input" type="number" min={1} max={1000000} value={activeModelSettingsDraft.maxOutputTokens} onChange={(event) => updateModelSettingsDraft({ maxOutputTokens: Number(event.target.value) })} /></label>
              </div>
              <div className="settings-ai-model-capabilities">
                <label className="settings-toggle"><span>{t('settings.aiPanel.modelCapability.vision')}</span><input type="checkbox" checked={activeModelSettingsDraft.capabilities.vision} onChange={(event) => updateModelSettingsDraft({ capabilities: { ...activeModelSettingsDraft.capabilities, vision: event.target.checked } })} /></label>
                <label className="settings-toggle"><span>{t('settings.aiPanel.modelCapability.reasoning')}</span><input type="checkbox" checked={activeModelSettingsDraft.capabilities.reasoning} onChange={(event) => updateModelSettingsDraft({ capabilities: { ...activeModelSettingsDraft.capabilities, reasoning: event.target.checked } })} /></label>
                <label className="settings-toggle"><span>{t('settings.aiPanel.modelCapability.toolUse')}</span><input type="checkbox" checked={activeModelSettingsDraft.capabilities.toolUse} onChange={(event) => updateModelSettingsDraft({ capabilities: { ...activeModelSettingsDraft.capabilities, toolUse: event.target.checked } })} /></label>
                <label className="settings-toggle"><span>{t('settings.aiPanel.modelCapability.favorite')}</span><input type="checkbox" checked={activeModelSettingsDraft.favorite === true} onChange={(event) => updateModelSettingsDraft({ favorite: event.target.checked })} /></label>
              </div>
              <footer>
                <button className="ghost-btn small" type="button" onClick={cancelModelSettingsDraft}>{t('settings.common.cancel')}</button>
                <button className="primary-btn small" type="button" onClick={() => { void saveModelSettingsDraft(); }}>{t('settings.common.save')}</button>
              </footer>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

function renderModelCapabilityIcons(modelConfig: AiProviderModelSettings, t: Translator) {
  const items = [
    modelConfig.capabilities.vision ? { key: 'vision', label: t('settings.aiPanel.modelCapability.vision'), icon: 'readerSearch' as BookMindIconName } : null,
    modelConfig.capabilities.reasoning ? { key: 'reasoning', label: t('settings.aiPanel.modelCapability.reasoning'), icon: 'aiDesk' as BookMindIconName } : null,
    modelConfig.capabilities.toolUse ? { key: 'toolUse', label: t('settings.aiPanel.modelCapability.toolUse'), icon: 'wrench' as BookMindIconName } : null,
    modelConfig.favorite ? { key: 'favorite', label: t('settings.aiPanel.modelCapability.favorite'), icon: 'bookmark' as BookMindIconName } : null,
  ].filter((item): item is { key: string; label: string; icon: BookMindIconName } => Boolean(item));
  if (!items.length) return null;
  return (
    <span className="settings-ai-model-capability-icons" aria-label={t('settings.aiPanel.modelCapability.aria')}>
      {items.map((item) => <span key={item.key} title={item.label} aria-label={item.label}><BookMindIcon name={item.icon} /></span>)}
    </span>
  );
}

function formatProviderKind(kind: AiProviderKind, t: Translator) {
  if (kind === 'openai') return 'OpenAI';
  if (kind === 'openai-compatible') return t('settings.aiPanel.providerKind.compatible');
  return t('settings.aiPanel.providerKind.localProxy');
}

function getProviderInitial(name: string) {
  return (name.trim()[0] || 'P').toUpperCase();
}

function fuzzyMatchText(value: string, query: string) {
  const normalizedValue = value.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return normalizedValue.includes(normalizedQuery);
}

type ProviderValidationItem = {
  severity: 'ok' | 'warning' | 'error';
  message: string;
};

function buildProviderValidation(profile: AiProviderProfile | undefined, modelCount: number, t: Translator): {
  apiKey: ProviderValidationItem;
  baseUrl: ProviderValidationItem;
  endpoint: ProviderValidationItem;
  customHeaders: ProviderValidationItem;
  model: ProviderValidationItem;
} {
  if (!profile) {
    const missing = { severity: 'warning', message: t('settings.aiPanel.validation.selectProvider') } as const;
    return { apiKey: missing, baseUrl: missing, endpoint: missing, customHeaders: missing, model: missing };
  }

  return {
    apiKey: validateProviderApiKey(profile.apiKey, t),
    baseUrl: validateProviderBaseUrl(profile.apiBaseUrl, t),
    endpoint: validateProviderEndpoint(profile.endpointMode, t),
    customHeaders: validateProviderCustomHeaders(profile.customHeaders, t),
    model: validateProviderModel(profile.model, modelCount, t),
  };
}

function validateProviderApiKey(value: string | undefined, t: Translator): ProviderValidationItem {
  return value?.trim()
    ? { severity: 'ok', message: t('settings.aiPanel.validation.apiKeyOk') }
    : { severity: 'warning', message: t('settings.aiPanel.validation.apiKeyMissing') };
}

function validateProviderBaseUrl(value: string | undefined, t: Translator): ProviderValidationItem {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return { severity: 'error', message: t('settings.aiPanel.validation.baseUrlRequired') };
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return { severity: 'error', message: t('settings.aiPanel.validation.baseUrlProtocol') };
    return { severity: 'ok', message: t('settings.aiPanel.validation.baseUrlOk') };
  } catch {
    return { severity: 'error', message: t('settings.aiPanel.validation.baseUrlInvalid') };
  }
}

function validateProviderEndpoint(value: AiEndpointMode, t: Translator): ProviderValidationItem {
  if (value === 'responses') return { severity: 'ok', message: t('settings.aiPanel.validation.endpointResponses') };
  if (value === 'chat.completions') return { severity: 'ok', message: t('settings.aiPanel.validation.endpointChat') };
  return { severity: 'error', message: t('settings.aiPanel.validation.endpointInvalid') };
}

function validateProviderCustomHeaders(value: string | undefined, t: Translator): ProviderValidationItem {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return { severity: 'ok', message: t('settings.aiPanel.validation.headersEmpty') };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { severity: 'error', message: t('settings.aiPanel.validation.headersObject') };
    }
    return { severity: 'ok', message: t('settings.aiPanel.validation.headersOk') };
  } catch {
    return { severity: 'error', message: t('settings.aiPanel.validation.headersInvalid') };
  }
}

function validateProviderModel(model: string | undefined, modelCount: number, t: Translator): ProviderValidationItem {
  if (!model?.trim()) return { severity: 'error', message: t('settings.aiPanel.validation.modelMissing') };
  if (modelCount <= 0) return { severity: 'error', message: t('settings.aiPanel.validation.modelLibraryEmpty') };
  return { severity: 'ok', message: t('settings.aiPanel.validation.modelOk', { count: modelCount }) };
}

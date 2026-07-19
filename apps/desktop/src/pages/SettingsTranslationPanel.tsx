import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTranslationSourcePickerOptions,
  copyTranslationSource,
  createTranslationSource,
  getTranslationSourceLabel,
  isTranslationSourceAvailable,
  normalizeTranslationSettings,
  removeTranslationSource,
  translationLanguageValues,
  translationSourceKinds,
  updateTranslationSource,
} from '../features/settings-center/settingsCenterTranslationModel';
import type { Translator } from '../i18n';
import type { AiProviderProfile, ApiTranslationSource, AppSettings, TranslationLanguage, TranslationSource } from '../types';
import { requestAppConfirm } from '../components/useAppConfirm';
import { SettingControl, SettingsNumberInput, SettingsSection, SettingsTextInput } from './SettingsPageScaffold';
import { ThemedSelect } from './SettingsSelect';

type SettingsTranslationPanelProps = {
  t: Translator;
  settings: AppSettings;
  aiProviderProfiles: AiProviderProfile[];
  updateAppSettings: (update: Partial<AppSettings>, status?: string) => Promise<void> | void;
  updateTranslationApiKey: (sourceId: string, apiKey: string, status?: string) => Promise<void> | void;
};

export function SettingsTranslationPanel({ t, settings, aiProviderProfiles, updateAppSettings, updateTranslationApiKey }: SettingsTranslationPanelProps) {
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const persisted = normalizeTranslationSettings({ ...settings, aiProviderProfiles });
  const persistedSources = persisted.translationSources ?? [];
  const persistedSourcesSignature = JSON.stringify(persistedSources);
  const sourcesRef = useRef(persistedSources);
  const activeSourceIdRef = useRef(persisted.translationActiveSourceId ?? '');
  const [, renderOptimisticSources] = useState(0);
  const normalized = normalizeTranslationSettings({
    ...persisted,
    translationSources: sourcesRef.current,
    translationActiveSourceId: activeSourceIdRef.current,
  });
  const sources = normalized.translationSources ?? [];
  const [selectedSourceId, setSelectedSourceId] = useState(normalized.translationActiveSourceId ?? sources[0]?.id ?? '');
  const [newSourceKind, setNewSourceKind] = useState<TranslationSource['kind']>('baidu-translate');
  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0];
  const pickerOptions = buildTranslationSourcePickerOptions(normalized);
  const languageOptions = translationLanguageValues.map((language) => ({ value: language, label: tr(`settings.translation.language.${language}`) }));
  const targetLanguageOptions = languageOptions.filter((option) => option.value !== 'auto') as Array<{ value: Exclude<TranslationLanguage, 'auto'>; label: string }>;
  const sourceKindOptions = translationSourceKinds.map((kind) => ({ value: kind, label: tr(`settings.translation.protocol.${kind}`) }));
  const providerOptions = aiProviderProfiles.map((profile) => ({ value: profile.id, label: `${profile.name}${profile.enabled === false ? ` · ${tr('settings.translation.state.disabled')}` : ''}` }));
  const selectedProvider = selectedSource?.kind === 'ai-model'
    ? aiProviderProfiles.find((profile) => profile.id === selectedSource.providerId) ?? aiProviderProfiles[0]
    : undefined;
  const modelOptions = useMemo(() => {
    if (!selectedProvider) return [];
    const values = new Set([selectedProvider.model, ...(selectedProvider.models ?? []), ...Object.keys(selectedProvider.modelSettings ?? {})].filter(Boolean));
    return [...values].map((model) => ({ value: model, label: selectedProvider.modelSettings?.[model]?.displayName || model }));
  }, [selectedProvider]);
  const sourceGroups = useMemo(() => {
    const groups = new Map<TranslationSource['kind'], TranslationSource[]>();
    sources.forEach((source) => groups.set(source.kind, [...(groups.get(source.kind) ?? []), source]));
    return translationSourceKinds.flatMap((kind) => groups.has(kind) ? [{ kind, sources: groups.get(kind) ?? [] }] : []);
  }, [sources]);

  useEffect(() => {
    sourcesRef.current = persistedSources;
    activeSourceIdRef.current = persisted.translationActiveSourceId ?? '';
    renderOptimisticSources((revision) => revision + 1);
  }, [persisted.translationActiveSourceId, persistedSourcesSignature]);

  useEffect(() => {
    if (selectedSource && selectedSource.id === selectedSourceId) return;
    setSelectedSourceId(normalized.translationActiveSourceId ?? sources[0]?.id ?? '');
  }, [normalized.translationActiveSourceId, selectedSource, selectedSourceId, sources]);

  function persistSources(next: AppSettings, status = tr('settings.translation.saved')) {
    sourcesRef.current = next.translationSources ?? [];
    activeSourceIdRef.current = next.translationActiveSourceId ?? '';
    renderOptimisticSources((revision) => revision + 1);
    void updateAppSettings({
      translationSources: next.translationSources,
      translationActiveSourceId: next.translationActiveSourceId,
    }, status);
  }

  function saveSource(sourceId: string, patch: Partial<TranslationSource>, status = tr('settings.translation.saved')) {
    persistSources(updateTranslationSource(getWorkingSettings(), sourceId, patch), status);
  }

  function getWorkingSettings() {
    return normalizeTranslationSettings({
      ...persisted,
      translationSources: sourcesRef.current,
      translationActiveSourceId: activeSourceIdRef.current,
    });
  }

  function setDefaultSource(translationActiveSourceId: string) {
    activeSourceIdRef.current = translationActiveSourceId;
    renderOptimisticSources((revision) => revision + 1);
    void updateAppSettings({ translationActiveSourceId }, tr('settings.translation.saved'));
  }

  function addSource() {
    const source = createTranslationSource(newSourceKind, aiProviderProfiles);
    const current = getWorkingSettings();
    const translationSources = [...(current.translationSources ?? []), source];
    setSelectedSourceId(source.id);
    persistSources({ ...current, translationSources, translationActiveSourceId: current.translationActiveSourceId || source.id }, tr('settings.translation.sourceAdded'));
  }

  function duplicateSource() {
    if (!selectedSource) return;
    const source = copyTranslationSource(selectedSource);
    const current = getWorkingSettings();
    setSelectedSourceId(source.id);
    persistSources({ ...current, translationSources: [...(current.translationSources ?? []), source] }, tr('settings.translation.sourceCopied'));
  }

  async function deleteSource() {
    if (!selectedSource) return;
    if (!await requestAppConfirm(tr('settings.translation.action.deleteConfirm', { name: selectedSource.name }))) return;
    if (selectedSource.kind !== 'ai-model') {
      await updateTranslationApiKey(selectedSource.id, '', tr('settings.translation.saved'));
    }
    const next = removeTranslationSource(getWorkingSettings(), selectedSource.id);
    setSelectedSourceId(next.translationActiveSourceId ?? next.translationSources?.[0]?.id ?? '');
    persistSources(next, tr('settings.translation.sourceDeleted'));
  }

  const enabledLabel = (enabled: boolean) => enabled ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const selectedAvailable = selectedSource ? isTranslationSourceAvailable(selectedSource, aiProviderProfiles) : false;
  const apiSource = selectedSource?.kind === 'ai-model' ? null : selectedSource;

  return (
    <div className="settings-translation-workbench">
      <aside className="settings-translation-source-panel" aria-label={tr('settings.translation.providerList.aria')}>
        <div className="settings-translation-source-head">
          <h3>{tr('settings.translation.providerList.title')}</h3>
          <p>{tr('settings.translation.providerList.description')}</p>
        </div>
        <div className="settings-translation-source-add">
          <ThemedSelect label={tr('settings.translation.providerList.type')} value={newSourceKind} options={sourceKindOptions} onChange={setNewSourceKind} />
          <button className="primary-btn small" type="button" onClick={addSource}>{tr('settings.translation.providerList.add')}</button>
        </div>
        <div className="settings-translation-source-list">
          {sourceGroups.map((group) => (
            <section className="settings-translation-source-group" key={group.kind}>
              <h4><span>{tr(`settings.translation.protocol.${group.kind}`)}</span><b>{group.sources.length}</b></h4>
              {group.sources.map((source) => {
                const active = source.id === selectedSource?.id;
                const available = isTranslationSourceAvailable(source, aiProviderProfiles);
                return (
                  <button className={`settings-translation-source-card${active ? ' active' : ''}${source.enabled === false ? ' disabled' : ''}`} type="button" key={source.id} onClick={() => setSelectedSourceId(source.id)}>
                    <span><strong>{source.name}</strong><small>{tr(`settings.translation.protocol.${source.kind}`)}</small></span>
                    <em className={available ? 'ready' : 'incomplete'}>{available ? tr('settings.translation.state.ready') : tr('settings.translation.state.unavailable')}</em>
                    {source.id === normalized.translationActiveSourceId ? <b>{tr('settings.translation.state.default')}</b> : null}
                  </button>
                );
              })}
            </section>
          ))}
          {!sources.length ? <p className="settings-translation-source-empty">{tr('settings.translation.providerList.empty')}</p> : null}
        </div>
      </aside>

      <section className="settings-translation-detail-panel" aria-label={tr('settings.translation.detail.aria')}>
        {selectedSource ? (
          <>
            <div className="settings-translation-detail-hero">
              <div>
                <span>{tr(`settings.translation.protocol.${selectedSource.kind}`)}</span>
                <h3>{selectedSource.name}</h3>
                <p>{selectedAvailable ? tr('settings.translation.state.ready') : tr('settings.translation.state.unavailable')}</p>
              </div>
              <div className="settings-translation-detail-actions">
                <button className="primary-btn small" type="button" disabled={!selectedAvailable || selectedSource.id === normalized.translationActiveSourceId} onClick={() => setDefaultSource(selectedSource.id)}>{tr('settings.translation.action.setDefault')}</button>
                <button className="ghost-btn small" type="button" onClick={duplicateSource}>{tr('settings.translation.action.copy')}</button>
                <button className="ghost-btn small danger-btn" type="button" onClick={() => { void deleteSource(); }}>{tr('settings.translation.action.delete')}</button>
              </div>
            </div>

            <SettingsSection title={tr('settings.translation.sourceConfig.title')} description={tr('settings.translation.sourceConfig.description')}>
              <SettingControl title={tr('settings.translation.sourceName.title')} description={tr('settings.translation.sourceName.description')} valueText={selectedSource.name}>
                <SettingsTextInput value={selectedSource.name} onCommit={(name) => saveSource(selectedSource.id, { name })} />
              </SettingControl>
              <SettingControl title={tr('settings.translation.api.enabled.title')} description={tr('settings.translation.api.enabled.description')} valueText={enabledLabel(selectedSource.enabled !== false)}>
                <label className="settings-toggle"><input type="checkbox" checked={selectedSource.enabled !== false} onChange={(event) => saveSource(selectedSource.id, { enabled: event.target.checked })} /><span>{enabledLabel(selectedSource.enabled !== false)}</span></label>
              </SettingControl>
            </SettingsSection>

            {selectedSource.kind === 'ai-model' ? (
              <SettingsSection title={tr('settings.translation.ai.title')} description={tr('settings.translation.ai.description')}>
                <SettingControl title={tr('settings.translation.ai.provider.title')} description={tr('settings.translation.ai.provider.description')} valueText={selectedProvider?.name ?? tr('settings.translation.state.unavailable')}>
                  <ThemedSelect label={tr('settings.translation.ai.provider.title')} value={selectedProvider?.id ?? ''} options={providerOptions} disabled={!providerOptions.length || selectedSource.enabled === false} onChange={(providerId) => {
                    const profile = aiProviderProfiles.find((candidate) => candidate.id === providerId);
                    saveSource(selectedSource.id, { providerId, model: profile?.model ?? selectedSource.model });
                  }} />
                </SettingControl>
                <SettingControl title={tr('settings.translation.ai.model.title')} description={tr('settings.translation.ai.model.description')} valueText={selectedSource.model || selectedProvider?.model || tr('settings.translation.state.unavailable')}>
                  <ThemedSelect label={tr('settings.translation.ai.model.title')} value={selectedSource.model || selectedProvider?.model || ''} options={modelOptions} disabled={!modelOptions.length || selectedSource.enabled === false} onChange={(model) => saveSource(selectedSource.id, { model })} />
                </SettingControl>
              </SettingsSection>
            ) : apiSource ? (
              <SettingsSection title={tr('settings.translation.api.title')} description={tr('settings.translation.api.description')}>
                <ApiTranslationSourceFields source={apiSource} t={t} saveSource={saveSource} updateTranslationApiKey={updateTranslationApiKey} />
              </SettingsSection>
            ) : null}

            <SettingsSection title={tr('settings.translation.defaults.title')} description={tr('settings.translation.defaults.description')}>
              <SettingControl title={tr('settings.translation.defaultSource.title')} description={tr('settings.translation.defaultSource.description')} valueText={pickerOptions.find((option) => option.id === normalized.translationActiveSourceId)?.label ?? tr('settings.translation.state.unavailable')}>
                <ThemedSelect label={tr('settings.translation.defaultSource.title')} value={pickerOptions.some((option) => option.id === normalized.translationActiveSourceId) ? normalized.translationActiveSourceId ?? '' : pickerOptions[0]?.id ?? ''} options={pickerOptions.map((option) => ({ value: option.id, label: `${option.groupLabel} · ${option.label}` }))} disabled={!pickerOptions.length} onChange={setDefaultSource} />
              </SettingControl>
              <SettingControl title={tr('settings.translation.sourceLanguage.title')} description={tr('settings.translation.sourceLanguage.description')} valueText={tr(`settings.translation.language.${normalized.translationSourceLanguage ?? 'auto'}`)}>
                <ThemedSelect label={tr('settings.translation.sourceLanguage.title')} value={normalized.translationSourceLanguage ?? 'auto'} options={languageOptions} onChange={(translationSourceLanguage) => { void updateAppSettings({ translationSourceLanguage }, tr('settings.translation.saved')); }} />
              </SettingControl>
              <SettingControl title={tr('settings.translation.targetLanguage.title')} description={tr('settings.translation.targetLanguage.description')} valueText={tr(`settings.translation.language.${normalized.translationTargetLanguage ?? 'zh-CN'}`)}>
                <ThemedSelect label={tr('settings.translation.targetLanguage.title')} value={normalized.translationTargetLanguage ?? 'zh-CN'} options={targetLanguageOptions} onChange={(translationTargetLanguage) => { void updateAppSettings({ translationTargetLanguage }, tr('settings.translation.saved')); }} />
              </SettingControl>
            </SettingsSection>
          </>
        ) : <div className="settings-translation-detail-empty"><h3>{tr('settings.translation.providerList.empty')}</h3><p>{tr('settings.translation.providerList.description')}</p></div>}
      </section>
    </div>
  );
}

function ApiTranslationSourceFields({
  source,
  t,
  saveSource,
  updateTranslationApiKey,
}: {
  source: ApiTranslationSource;
  t: Translator;
  saveSource: (sourceId: string, patch: Partial<TranslationSource>, status?: string) => void;
  updateTranslationApiKey: (sourceId: string, apiKey: string, status?: string) => Promise<void> | void;
}) {
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  return (
    <>
      <SettingControl title={tr('settings.translation.api.endpoint.title')} description={tr(`settings.translation.api.endpoint.${source.kind}`)} valueText={source.apiBaseUrl || tr('settings.translation.state.notConfigured')}>
        <SettingsTextInput type="url" ariaLabel={tr('settings.translation.api.endpoint.title')} value={source.apiBaseUrl} placeholder={tr(`settings.translation.api.endpointPlaceholder.${source.kind}`)} disabled={source.enabled === false} onCommit={(apiBaseUrl) => saveSource(source.id, { apiBaseUrl })} />
      </SettingControl>
      {source.kind === 'baidu-translate' ? (
        <SettingControl title={tr('settings.translation.api.appId.title')} description={tr('settings.translation.api.appId.description')} valueText={source.appId || tr('settings.translation.state.notConfigured')}>
          <SettingsTextInput value={source.appId} disabled={source.enabled === false} onCommit={(appId) => saveSource(source.id, { appId })} />
        </SettingControl>
      ) : null}
      {source.kind === 'microsoft-translator' ? (
        <SettingControl title={tr('settings.translation.api.region.title')} description={tr('settings.translation.api.region.description')} valueText={source.region || tr('settings.translation.state.optional')}>
          <SettingsTextInput value={source.region} placeholder="eastasia" disabled={source.enabled === false} onCommit={(region) => saveSource(source.id, { region })} />
        </SettingControl>
      ) : null}
      <SettingControl title={tr('settings.translation.api.key.title')} description={tr(`settings.translation.api.key.${source.kind}`)} valueText={source.apiKey ? tr('settings.translation.state.configured') : source.kind === 'libretranslate' ? tr('settings.translation.state.optional') : tr('settings.translation.state.notConfigured')}>
        <SettingsTextInput type="password" ariaLabel={tr('settings.translation.api.key.title')} value={source.apiKey ?? ''} placeholder={tr('settings.translation.api.key.placeholder')} disabled={source.enabled === false} commitOnUnmount onCommit={(apiKey) => { void updateTranslationApiKey(source.id, apiKey, tr('settings.translation.saved')); }} />
      </SettingControl>
      <SettingControl title={tr('settings.translation.api.timeout.title')} description={tr('settings.translation.api.timeout.description')} valueText={`${source.requestTimeoutSecs ?? 30}s`}>
        <SettingsNumberInput min={5} max={600} step={1} value={source.requestTimeoutSecs ?? 30} disabled={source.enabled === false} ariaLabel={tr('settings.translation.api.timeout.title')} onCommit={(value) => saveSource(source.id, { requestTimeoutSecs: Number(value) })} />
      </SettingControl>
    </>
  );
}

import type { AiProviderKind, AiProviderModelSettings, AiProviderModelType, AiProviderProfile, AppSettings } from '../../types';

export const defaultAiProviderProfile: AiProviderProfile = {
  id: 'openai-default',
  name: 'OpenAI Default',
  kind: 'openai',
  enabled: true,
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  endpointMode: 'responses',
  model: 'gpt-4.1-mini',
  models: ['gpt-4.1-mini'],
  proxyUrl: '',
  customHeaders: '',
  streamingEnabled: true,
  requestTimeoutSecs: 120,
  retryCount: 1,
  temperature: 0.2,
  maxTokens: 0,
  topP: 1,
  reasoningEffort: 'none',
  responseFormat: 'auto',
  modelSettings: {
    'gpt-4.1-mini': {
      id: 'gpt-4.1-mini',
      displayName: 'gpt-4.1-mini',
      type: 'chat',
      contextWindowTokens: 128000,
      maxOutputTokens: 4096,
      capabilities: { vision: false, reasoning: false, toolUse: false },
      favorite: false,
    },
  },
};

export function createAiProviderProfileId() {
  return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function inferAiProviderKindForUi(apiBaseUrl: string): AiProviderKind {
  const lower = apiBaseUrl.toLowerCase();
  if (lower.includes('api.openai.com')) return 'openai';
  if (lower.includes('127.0.0.1') || lower.includes('localhost')) return 'local-proxy';
  return 'openai-compatible';
}

export function createAiProviderProfileFromSettings(settings: Partial<AppSettings>, overrides: Partial<AiProviderProfile> = {}): AiProviderProfile {
  return normalizeAiProviderProfileForUi({
    id: overrides.id ?? createAiProviderProfileId(),
    name: overrides.name ?? settings.aiModel ?? 'AI Provider',
    kind: overrides.kind ?? inferAiProviderKindForUi(settings.aiApiBaseUrl ?? ''),
    enabled: overrides.enabled ?? true,
    apiKey: settings.aiApiKey ?? '',
    apiBaseUrl: settings.aiApiBaseUrl ?? defaultAiProviderProfile.apiBaseUrl,
    endpointMode: settings.aiEndpointMode ?? defaultAiProviderProfile.endpointMode,
    model: settings.aiModel ?? defaultAiProviderProfile.model,
    models: [settings.aiModel ?? defaultAiProviderProfile.model],
    proxyUrl: settings.aiProxyUrl ?? '',
    customHeaders: settings.aiCustomHeaders ?? '',
    streamingEnabled: settings.aiStreamingEnabled !== false,
    requestTimeoutSecs: settings.aiRequestTimeoutSecs ?? defaultAiProviderProfile.requestTimeoutSecs,
    retryCount: settings.aiRetryCount ?? defaultAiProviderProfile.retryCount,
    temperature: settings.aiTemperature ?? defaultAiProviderProfile.temperature,
    maxTokens: settings.aiMaxTokens ?? defaultAiProviderProfile.maxTokens,
    topP: settings.aiTopP ?? defaultAiProviderProfile.topP,
    reasoningEffort: settings.aiReasoningEffort ?? 'none',
    responseFormat: settings.aiResponseFormat ?? 'auto',
    ...overrides,
  } as AiProviderProfile, 0);
}

export function normalizeAiProviderProfilesForUi(settings: Pick<AppSettings, 'aiProviderProfiles' | 'aiApiKey' | 'aiApiBaseUrl' | 'aiEndpointMode' | 'aiModel' | 'aiProxyUrl' | 'aiCustomHeaders' | 'aiStreamingEnabled' | 'aiRequestTimeoutSecs' | 'aiRetryCount' | 'aiTemperature' | 'aiMaxTokens' | 'aiTopP' | 'aiReasoningEffort' | 'aiResponseFormat'>): AiProviderProfile[] {
  const profiles = Array.isArray(settings.aiProviderProfiles) ? settings.aiProviderProfiles : [];
  if (!profiles.length) return [createAiProviderProfileFromSettings(settings, { id: 'openai-default', name: 'OpenAI Default' })];
  return profiles.map((profile, index) => normalizeAiProviderProfileForUi(profile, index));
}

export function normalizeAiProviderProfileForUi(profile: AiProviderProfile, index: number): AiProviderProfile {
  const hasExplicitModel = Object.prototype.hasOwnProperty.call(profile, 'model');
  const model = hasExplicitModel
    ? (profile.model?.trim() ?? '')
    : profile.models?.find((item) => item.trim())?.trim() || defaultAiProviderProfile.model;
  const models = normalizeAiProviderModels([model, ...(profile.models ?? [])]);
  return {
    id: profile.id?.trim() || `provider-${index + 1}`,
    name: profile.name?.trim() || `Provider ${index + 1}`,
    kind: profile.kind === 'openai-compatible' || profile.kind === 'local-proxy' ? profile.kind : 'openai',
    enabled: profile.enabled !== false,
    apiKey: profile.apiKey?.trim() ?? '',
    apiBaseUrl: Object.prototype.hasOwnProperty.call(profile, 'apiBaseUrl')
      ? (profile.apiBaseUrl ?? '').trim()
      : defaultAiProviderProfile.apiBaseUrl,
    endpointMode: profile.endpointMode === 'chat.completions' ? 'chat.completions' : 'responses',
    model,
    models,
    proxyUrl: profile.proxyUrl?.trim() ?? '',
    customHeaders: profile.customHeaders?.trim() ?? '',
    streamingEnabled: profile.streamingEnabled !== false,
    requestTimeoutSecs: clampNumberForUi(profile.requestTimeoutSecs, 120, 5, 600),
    retryCount: clampNumberForUi(profile.retryCount, 1, 0, 5),
    temperature: clampNumberForUi(profile.temperature, 0.2, 0, 2),
    maxTokens: clampNumberForUi(profile.maxTokens, 0, 0, 200000),
    topP: clampNumberForUi(profile.topP, 1, 0, 1),
    reasoningEffort: normalizeAiReasoningEffortForUi(profile.reasoningEffort),
    responseFormat: profile.responseFormat === 'json_object' || profile.responseFormat === 'json_schema' ? profile.responseFormat : 'auto',
    modelSettings: normalizeAiProviderModelSettingsMap(models, profile.modelSettings),
  };
}

export function normalizeAiReasoningEffortForUi(value: unknown) {
  if (typeof value !== 'string') return 'none';
  const normalized = value.trim();
  return /^[A-Za-z0-9._-]{1,48}$/.test(normalized) ? normalized : 'none';
}

export function parseAiProviderModelInput(value: string): string[] {
  return normalizeAiProviderModels(value.split(/[\s,;，；]+/));
}

export function normalizeAiProviderModels(models: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const model of models) {
    const trimmed = model.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function mergeAiProviderProfileModels(profile: AiProviderProfile, models: string[] | string, selectedModel?: string): AiProviderProfile {
  const normalizedProfile = normalizeAiProviderProfileForUi(profile, 0);
  const incomingModels = Array.isArray(models) ? normalizeAiProviderModels(models) : parseAiProviderModelInput(models);
  const selected = selectedModel?.trim();
  const nextModels = normalizeAiProviderModels([
    normalizedProfile.model,
    ...(normalizedProfile.models ?? []),
    ...incomingModels,
    ...(selected ? [selected] : []),
  ]);
  return {
    ...normalizedProfile,
    model: selected || normalizedProfile.model || nextModels[0] || defaultAiProviderProfile.model,
    models: nextModels.length ? nextModels : [selected || defaultAiProviderProfile.model],
    modelSettings: normalizeAiProviderModelSettingsMap(nextModels.length ? nextModels : [selected || defaultAiProviderProfile.model], normalizedProfile.modelSettings),
  };
}

export function defaultAiProviderModelSettings(modelId: string): AiProviderModelSettings {
  const id = modelId.trim() || defaultAiProviderProfile.model;
  const lower = id.toLowerCase();
  const isLocal = lower.includes('local');
  const isEmbedding = lower.includes('embedding') || lower.includes('embed');
  const isRerank = lower.includes('rerank');
  const isImage = lower.includes('image') || lower.includes('vision');
  const type: AiProviderModelType = isEmbedding ? 'embedding' : isRerank ? 'rerank' : isImage ? 'image' : 'chat';
  const reasoning = /\bo[134]\b|reason|thinking|deepseek-r|qwen3/i.test(id);
  const vision = lower.includes('vision') || lower.includes('vl') || lower.includes('gpt-4o') || lower.includes('image');
  return {
    id,
    displayName: id,
    type,
    contextWindowTokens: isLocal ? 1050000 : 128000,
    maxOutputTokens: isLocal ? 128000 : reasoning ? 100000 : 4096,
    capabilities: {
      vision,
      reasoning,
      toolUse: isLocal,
    },
    favorite: isLocal,
  };
}

export function normalizeAiProviderModelSettings(modelId: string, settings?: Partial<AiProviderModelSettings>): AiProviderModelSettings {
  const defaults = defaultAiProviderModelSettings(modelId);
  const id = (settings?.id ?? modelId).trim() || defaults.id;
  const type = settings?.type === 'embedding' || settings?.type === 'rerank' || settings?.type === 'image' || settings?.type === 'audio' ? settings.type : defaults.type;
  return {
    id,
    displayName: Object.prototype.hasOwnProperty.call(settings ?? {}, 'displayName')
      ? settings?.displayName?.trim() ?? ''
      : defaults.displayName,
    type,
    contextWindowTokens: clampNumberForUi(settings?.contextWindowTokens, defaults.contextWindowTokens, 1, 4000000),
    maxOutputTokens: clampNumberForUi(settings?.maxOutputTokens, defaults.maxOutputTokens, 1, 1000000),
    capabilities: {
      vision: Boolean(settings?.capabilities?.vision ?? defaults.capabilities.vision),
      reasoning: Boolean(settings?.capabilities?.reasoning ?? defaults.capabilities.reasoning),
      toolUse: Boolean(settings?.capabilities?.toolUse ?? defaults.capabilities.toolUse),
    },
    favorite: Boolean(settings?.favorite ?? defaults.favorite),
  };
}

export function normalizeAiProviderModelSettingsMap(models: string[], settingsMap?: Record<string, AiProviderModelSettings>): Record<string, AiProviderModelSettings> {
  return normalizeAiProviderModels(models).reduce<Record<string, AiProviderModelSettings>>((map, model) => {
    map[model] = normalizeAiProviderModelSettings(model, settingsMap?.[model]);
    return map;
  }, {});
}

export function getAiProviderModelConfig(profile: AiProviderProfile, modelId: string): AiProviderModelSettings {
  const normalizedProfile = normalizeAiProviderProfileForUi(profile, 0);
  const id = modelId.trim() || normalizedProfile.model;
  return normalizedProfile.modelSettings?.[id] ?? normalizeAiProviderModelSettings(id);
}

export function resolveAiProviderRequestSettings(settings: AppSettings): AppSettings {
  const profiles = normalizeAiProviderProfilesForUi(settings);
  const requestedProfileId = settings.aiActiveProviderProfileId?.trim();
  const activeProfile = requestedProfileId
    ? profiles.find((profile) => profile.id === requestedProfileId)
    : profiles[0];
  if (!activeProfile || activeProfile.enabled === false) {
    return { ...settings, aiApiKey: '', aiProviderProfiles: profiles };
  }
  return {
    ...settings,
    aiApiKey: activeProfile.apiKey ?? settings.aiApiKey ?? '',
    aiApiBaseUrl: activeProfile.apiBaseUrl,
    aiEndpointMode: activeProfile.endpointMode,
    aiModel: activeProfile.model,
    aiRequestTimeoutSecs: activeProfile.requestTimeoutSecs,
    aiRetryCount: activeProfile.retryCount,
    aiProxyUrl: activeProfile.proxyUrl,
    aiCustomHeaders: activeProfile.customHeaders,
    aiStreamingEnabled: activeProfile.streamingEnabled,
    aiTemperature: activeProfile.temperature,
    aiMaxTokens: activeProfile.maxTokens,
    aiTopP: activeProfile.topP,
    aiReasoningEffort: activeProfile.reasoningEffort,
    aiResponseFormat: activeProfile.responseFormat,
    aiActiveProviderProfileId: activeProfile.id,
    aiProviderProfiles: profiles,
  };
}

export function clampNumberForUi(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.min(max, Math.max(min, numberValue)) : fallback;
}

export function sanitizeProviderProfileSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    aiProviderProfiles: normalizeAiProviderProfilesForUi(settings).map((profile) => ({
      ...profile,
      apiKey: '',
      customHeaders: sanitizeAiProviderCustomHeaders(profile.customHeaders ?? ''),
    })),
    translationSources: settings.translationSources?.map((source) => (
      source.kind === 'ai-model' ? source : { ...source, apiKey: '' }
    )),
  };
}

export function sanitizeAiProviderCustomHeaders(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) {
      if (isSensitiveAiProviderHeaderKey(key)) parsed[key] = '[redacted]';
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return trimmed;
  }
}

export function isSensitiveAiProviderHeaderKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized === 'authorization'
    || normalized === 'cookie'
    || normalized === 'x-api-key'
    || normalized.includes('api-key')
    || normalized.includes('apikey')
    || normalized.includes('token');
}

import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types';
import { defaultAiTranslationSource, defaultLibreTranslationSource } from '../features/settings-center/settingsCenterTranslationModel';

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    return await invoke<AppSettings>('get_app_settings');
  } catch (error) {
    console.warn('Using default browser settings because Tauri command failed:', error);
    return {
      schemaVersion: 1,
      trashRetentionDays: 3,
      trashAutoCleanupEnabled: true,
      trashProtectReadingProgress: true,
      trashProtectReaderAssets: true,
      aiApiKey: '',
      aiApiBaseUrl: 'https://api.openai.com/v1',
      aiEndpointMode: 'responses',
      aiModel: 'gpt-4.1-mini',
      aiRequestTimeoutSecs: 120,
      aiRetryCount: 1,
      aiProxyUrl: '',
      aiCustomHeaders: '',
      aiStreamingEnabled: true,
      aiTemperature: 0.2,
      aiMaxTokens: 0,
      aiTopP: 1,
      aiReasoningEffort: 'none',
      aiResponseFormat: 'auto',
      aiActiveProviderProfileId: 'openai-default',
      aiProviderProfiles: [
        {
          id: 'openai-default',
          name: 'OpenAI 默认',
          kind: 'openai',
          enabled: true,
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
        },
      ],
      translationActiveSourceId: defaultAiTranslationSource.id,
      translationSources: [{ ...defaultAiTranslationSource }, { ...defaultLibreTranslationSource }],
      translationSourceLanguage: 'auto',
      translationTargetLanguage: 'zh-CN',
      aiCancelStrategy: 'abort-and-save-stopped',
      operationLogLevel: 'none',
    };
  }
}

let settingsWriteQueue: Promise<void> = Promise.resolve();

function enqueueSettingsWrite<T>(write: () => Promise<T>): Promise<T> {
  const result = settingsWriteQueue.then(write, write);
  settingsWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  return enqueueSettingsWrite(() => invoke<AppSettings>('update_app_settings', { settings }));
}

export async function saveAiProviderApiKey(providerId: string, apiKey: string): Promise<AppSettings> {
  return enqueueSettingsWrite(() => invoke<AppSettings>('update_ai_provider_api_key', { providerId, apiKey }));
}

export async function saveTranslationApiKey(sourceId: string, apiKey: string): Promise<AppSettings> {
  return enqueueSettingsWrite(() => invoke<AppSettings>('update_translation_api_key', { sourceId, apiKey }));
}

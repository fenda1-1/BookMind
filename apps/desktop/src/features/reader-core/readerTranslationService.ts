import {
  buildTranslationSourcePickerOptions,
  getAvailableTranslationSources,
  getTranslationSourceLabel,
  normalizeTranslationSettings,
  type TranslationSourcePickerOption,
} from '../settings-center/settingsCenterTranslationModel';
import { redactCloudText } from '../../services/cloudAiPrivacy';
import { requestTranslationApi } from '../../services/translationService';
import { loadExtendedSettings } from '../../services/settingsCenterService';
import { loadAppSettings, saveAppSettings } from '../../services/settingsService';
import type { AppSettings, TranslationLanguage, TranslationSource } from '../../types';
import {
  getReaderTranslationErrorDetail,
  normalizeReaderTranslationResult,
  type ReaderTranslationErrorCode,
} from './readerTranslationModel';

export type ReaderTranslationSelectionContext = {
  sourceId: string;
  sourceKind: TranslationSource['kind'] | null;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
  sourceOptions: TranslationSourcePickerOption[];
  providerLabel: string;
};

export class ReaderTranslationError extends Error {
  constructor(
    public readonly code: ReaderTranslationErrorCode,
    message = '',
    public readonly selectionContext?: ReaderTranslationSelectionContext,
  ) {
    super(message);
    this.name = 'ReaderTranslationError';
  }
}

export type PreparedReaderTranslation = {
  source: TranslationSource;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
  sourceOptions: TranslationSourcePickerOption[];
  sourceText: string;
  outboundText: string;
  requestId: string;
  requireConfirmation: boolean;
  providerLabel: string;
};

export async function prepareReaderTranslation(input: {
  sourceText: string;
  requestId: string;
  sourceId?: string;
  sourceLanguage?: TranslationLanguage;
  targetLanguage?: Exclude<TranslationLanguage, 'auto'>;
}): Promise<PreparedReaderTranslation> {
  const privacy = loadExtendedSettings();
  if (!privacy.cloudAiAllowSelectionText) throw new ReaderTranslationError('selection-disabled');

  const appSettings = normalizeTranslationSettings(await loadAppSettings());
  const availableSources = getAvailableTranslationSources(appSettings);
  const requestedSourceId = input.sourceId ?? appSettings.translationActiveSourceId ?? '';
  const configuredSource = appSettings.translationSources?.find((candidate) => candidate.id === requestedSourceId);
  const source = availableSources.find((candidate) => candidate.id === requestedSourceId);
  const sourceLanguage = input.sourceLanguage ?? appSettings.translationSourceLanguage ?? 'auto';
  const targetLanguage = input.targetLanguage ?? appSettings.translationTargetLanguage ?? 'zh-CN';
  const sourceOptions = buildTranslationSourcePickerOptions(appSettings);
  const selectionContext: ReaderTranslationSelectionContext = {
    sourceId: requestedSourceId,
    sourceKind: configuredSource?.kind ?? null,
    sourceLanguage,
    targetLanguage,
    sourceOptions,
    providerLabel: configuredSource
      ? getTranslationSourceLabel(configuredSource, appSettings.aiProviderProfiles ?? [])
      : '',
  };
  if (!source) throw new ReaderTranslationError('provider-missing', '', selectionContext);
  if (source.kind === 'ai-model') {
    if (!privacy.cloudAiEnabled) throw new ReaderTranslationError('cloud-disabled', '', selectionContext);
    const profile = appSettings.aiProviderProfiles?.find((candidate) => candidate.id === source.providerId);
    if (!profile) throw new ReaderTranslationError('provider-missing', '', selectionContext);
    if (profile.enabled === false) throw new ReaderTranslationError('provider-disabled', '', selectionContext);
    if (!(source.model.trim() || profile.model.trim())) throw new ReaderTranslationError('model-missing', '', selectionContext);
  }
  const sourceText = input.sourceText.trim();
  return {
    source,
    sourceLanguage,
    targetLanguage,
    sourceOptions,
    sourceText,
    outboundText: privacy.cloudAiAutoRedact
      ? redactCloudText(sourceText, privacy.cloudAiSensitiveWords)
      : sourceText,
    requestId: input.requestId,
    requireConfirmation: privacy.cloudAiRequireConfirmation,
    providerLabel: getTranslationSourceLabel(source, appSettings.aiProviderProfiles ?? []),
  };
}

export async function executeReaderTranslation(
  prepared: PreparedReaderTranslation,
  signal: AbortSignal,
) {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  let response: string;
  try {
    response = await requestTranslationApi({
      sourceId: prepared.source.id,
      text: prepared.outboundText,
      sourceLanguage: prepared.sourceLanguage,
      targetLanguage: prepared.targetLanguage,
      requestId: prepared.requestId,
    }, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    throw classifyReaderTranslationTransportError(error);
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const result = normalizeReaderTranslationResult(response);
  if (!result) throw new ReaderTranslationError('request-failed');
  return result;
}

function classifyReaderTranslationTransportError(error: unknown) {
  const detail = getReaderTranslationErrorDetail(error);
  const normalized = detail.toLowerCase();
  if (normalized.includes('api key is missing') || normalized.includes('secret is missing')) {
    return new ReaderTranslationError('provider-key-missing');
  }
  if (normalized.includes('provider is disabled') || normalized.includes('source is disabled')) return new ReaderTranslationError('provider-disabled');
  if (normalized.includes('model is missing')) return new ReaderTranslationError('model-missing');
  if (
    normalized.includes('provider was not found')
    || normalized.includes('source was not found')
    || normalized.includes('app id is missing')
  ) return new ReaderTranslationError('provider-missing');
  return new ReaderTranslationError('request-failed', detail);
}

export async function saveReaderTranslationPreferences(patch: Pick<AppSettings,
  'translationActiveSourceId' | 'translationSourceLanguage' | 'translationTargetLanguage'
>) {
  const settings = normalizeTranslationSettings(await loadAppSettings());
  return saveAppSettings({ ...settings, ...patch });
}

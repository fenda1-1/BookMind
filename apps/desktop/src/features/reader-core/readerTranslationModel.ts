import type { AiAskRequest, TranslationLanguage } from '../../types';

export type ReaderTranslationErrorCode =
  | 'cloud-disabled'
  | 'selection-disabled'
  | 'provider-missing'
  | 'provider-disabled'
  | 'provider-key-missing'
  | 'model-missing'
  | 'request-failed';

export type ReaderTranslationRequestInput = {
  sourceText: string;
  instruction: string;
  scopeLabel: string;
  requestId: string;
  customSensitiveWords?: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
};

export function buildReaderTranslationRequest(input: ReaderTranslationRequestInput): AiAskRequest {
  const sourceText = input.sourceText.trim();
  return {
    scope: 'selection-translation',
    instruction: input.instruction.trim(),
    userText: '',
    scopeText: sourceText,
    scopeLabel: input.scopeLabel,
    retrievalQuery: sourceText,
    selectedCommandId: 'translate-selection',
    mode: 'cloud',
    interactionMode: 'qa',
    requireCloudApi: true,
    cloudPromptMode: 'plain_text',
    cloudResponseFormat: 'text',
    requestId: input.requestId,
    customSensitiveWords: input.customSensitiveWords,
  };
}

export function buildReaderTranslationInstruction(
  template: string,
  sourceLanguageLabel: string,
  targetLanguageLabel: string,
) {
  return template
    .replaceAll('{sourceLanguage}', sourceLanguageLabel)
    .replaceAll('{targetLanguage}', targetLanguageLabel)
    .trim();
}

export function normalizeReaderTranslationResult(value: string) {
  return value.trim().replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export function getReaderTranslationErrorDetail(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? '').trim();
}

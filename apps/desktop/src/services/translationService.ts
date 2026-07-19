import { invoke } from '@tauri-apps/api/core';
import type { TranslationLanguage } from '../types';

export type TranslationApiRequest = {
  sourceId: string;
  text: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
  requestId?: string;
};

export async function requestTranslationApi(request: TranslationApiRequest, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const response = await invoke<{ translatedText: string }>('translate_text', { request });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return response.translatedText.trim();
}

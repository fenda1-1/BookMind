import type { TranslationKey } from '../../i18n';

const structuredCharacterErrorCodePattern = /^character_[a-z0-9]+(?:_[a-z0-9]+)*$/;

const characterFailureAdviceKeys = {
  character_index_missing_text_index: 'characters.failureAdvice.character_index_missing_text_index',
  character_ai_parse_failed: 'characters.failureAdvice.character_ai_parse_failed',
  character_write_failed: 'characters.failureAdvice.character_write_failed',
} as const satisfies Record<string, TranslationKey>;

export type StructuredCharacterErrorCode = keyof typeof characterFailureAdviceKeys;

export function isStructuredCharacterErrorCode(errorCode: string) {
  return structuredCharacterErrorCodePattern.test(errorCode);
}

export function characterFailureAdviceKey(errorCode: string): TranslationKey {
  if (!errorCode) return 'characters.failureAdvice.none';
  if (!isStructuredCharacterErrorCode(errorCode)) return 'characters.failureAdvice.unstructured';
  return characterFailureAdviceKeys[errorCode as StructuredCharacterErrorCode] ?? 'characters.failureAdvice.generic';
}

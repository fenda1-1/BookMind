import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../app/platform';
import type { CharacterCenterBookSummary, CharacterCenterPayload, CharacterOverviewSnapshot, TaskStatus } from '../types';
import type { CharacterAiPostprocessOperation } from '../features/characters/characterAiPostprocessModel';

export async function queueCharacterExtraction(bookId: string): Promise<TaskStatus> {
  if (!isTauriRuntime()) throw new Error('Browser preview cannot queue character extraction.');
  return await invoke<TaskStatus>('queue_character_extraction', { bookId });
}

export async function loadCharacterCenterBooks(): Promise<CharacterCenterBookSummary[] | null> {
  if (!isTauriRuntime()) return null;
  return await invoke<CharacterCenterBookSummary[]>('get_character_center_books');
}

export async function loadCharacterCenterPayload(bookId: string): Promise<CharacterCenterPayload | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<CharacterCenterPayload>('get_character_center_payload', { bookId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('无法读取人物中心文件') || message.includes('找不到')) return null;
    throw error;
  }
}

export async function loadCharacterOverviewSnapshot(bookId: string): Promise<CharacterOverviewSnapshot | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<CharacterOverviewSnapshot>('get_character_overview_snapshot', { bookId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('无法读取人物中心文件') || message.includes('找不到')) return null;
    throw error;
  }
}

export type CharacterAiPostprocessApplyResult = {
  updatedCount: number;
  hiddenCount: number;
  genderCount: number;
};

export type CharacterReferenceQuote = {
  characterId: string;
  quote: string;
};

export async function loadCharacterReferenceQuotes(bookId: string): Promise<CharacterReferenceQuote[]> {
  if (!isTauriRuntime()) return [];
  return await invoke<CharacterReferenceQuote[]>('get_character_reference_quotes', { bookId });
}

export async function applyCharacterAiPostprocess(bookId: string, operations: CharacterAiPostprocessOperation[]): Promise<CharacterAiPostprocessApplyResult> {
  if (!isTauriRuntime()) throw new Error('Browser preview cannot apply character AI processing.');
  return await invoke<CharacterAiPostprocessApplyResult>('apply_character_ai_postprocess', {
    bookId,
    operations: operations
      .filter((operation) => operation.enabled)
      .map((operation) => ({
        operationType: operation.type,
        profileId: operation.profileId,
        gender: operation.type === 'gender' ? operation.to : '',
        hidden: operation.type === 'noise' ? operation.to : false,
      })),
  });
}

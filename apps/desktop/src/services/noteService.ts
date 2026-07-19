import { invoke } from '@tauri-apps/api/core';
import type { AiGeneratedFlashcardRequest, AiNoteMetadata, Citation, FlashcardRecord, HighlightRecord, NoteRecord, NoteSaveTarget, ReaderNoteLocation } from '../types';

export async function saveAiNote(title: string, body: string, citations: Citation[], readerLocation?: ReaderNoteLocation, aiMetadata?: AiNoteMetadata, saveTarget?: NoteSaveTarget, structuredResponse?: unknown): Promise<NoteRecord> {
  return await invoke<NoteRecord>('save_ai_note', {
    request: { title, body, citations, readerLocation, aiMetadata, structuredResponse, saveTarget },
  });
}

export async function loadNotes(): Promise<NoteRecord[]> {
  try {
    return await invoke<NoteRecord[]>('get_notes');
  } catch (error) {
    console.warn('Using empty notes because Tauri notes command failed:', error);
    return [];
  }
}

export async function deleteNotes(ids: string[]): Promise<number> {
  return await invoke<number>('delete_notes', { ids });
}

export async function saveHighlight(citation: Citation): Promise<HighlightRecord> {
  return await invoke<HighlightRecord>('save_highlight', { citation });
}

export async function loadHighlights(): Promise<HighlightRecord[]> {
  try {
    return await invoke<HighlightRecord[]>('get_highlights');
  } catch (error) {
    console.warn('Using empty highlights because Tauri highlights command failed:', error);
    return [];
  }
}

export async function deleteHighlights(ids: string[]): Promise<number> {
  return await invoke<number>('delete_highlights', { ids });
}

export type HighlightFlashcardDefaults = {
  defaultTags?: string[];
  defaultReviewStatus?: 'new' | 'due' | 'reviewed';
  frontTemplate?: string;
  backTemplate?: string;
};

export type KnowledgeMarkdownExportOptions = {
  includeAiMetadata?: boolean;
  includeStructuredResponse?: boolean;
  exportPath?: string;
};

export async function generateFlashcardsFromHighlights(defaults: HighlightFlashcardDefaults = {}): Promise<FlashcardRecord[]> {
  return await invoke<FlashcardRecord[]>('generate_flashcards_from_highlights', defaults);
}

export async function saveGeneratedFlashcards(cards: AiGeneratedFlashcardRequest[]): Promise<FlashcardRecord[]> {
  return await invoke<FlashcardRecord[]>('save_ai_generated_flashcards', { cards });
}

export async function loadFlashcards(): Promise<FlashcardRecord[]> {
  try {
    return await invoke<FlashcardRecord[]>('get_flashcards');
  } catch (error) {
    console.warn('Using empty flashcards because Tauri flashcards command failed:', error);
    return [];
  }
}

export async function deleteFlashcards(ids: string[]): Promise<number> {
  return await invoke<number>('delete_flashcards', { ids });
}

export async function exportKnowledgeMarkdown(options: KnowledgeMarkdownExportOptions = {}): Promise<string> {
  return await invoke<string>('export_knowledge_markdown', options);
}

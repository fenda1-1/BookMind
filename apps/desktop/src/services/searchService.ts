import { invoke } from '@tauri-apps/api/core';
import type { SearchIndexPage, SearchResult } from '../types';

export async function searchIndex(query: string, options: { limit?: number; offset?: number } = {}): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  try {
    return await invoke<SearchResult[]>('search_index', { query, limit: options.limit, offset: options.offset });
  } catch (error) {
    console.warn('Using empty search results because Tauri search command failed:', error);
    return [];
  }
}

export async function searchIndexPage(query: string, options: { limit?: number; offset?: number; bookId?: string } = {}): Promise<SearchIndexPage> {
  const normalized = query.trim();
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const bookId = options.bookId?.trim() || undefined;
  if (!normalized) return { query: normalized, total: 0, limit, offset, results: [] };
  try {
    return await invoke<SearchIndexPage>('search_index_page', { query: normalized, limit, offset, bookId });
  } catch (error) {
    console.warn('Using empty search page because Tauri search command failed:', error);
    return { query: normalized, total: 0, limit, offset, results: [] };
  }
}

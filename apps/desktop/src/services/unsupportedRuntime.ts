import type { BookSourceEditPayload, BookSourceSearchResult, NetworkBookChapterPayload, NetworkBookManifestPayload } from '../types';

const unavailable = () => Promise.reject(new Error('This runtime is unavailable in this build.'));
export const getNetworkBookManifest = (_bookId: string): Promise<NetworkBookManifestPayload> => unavailable();
export const loadNetworkBookChapter = (_bookId: string, _chapterIndex: number, _options?: unknown): Promise<NetworkBookChapterPayload> => unavailable();
export const cacheNetworkBookImage = (_bookId: string, _chapterIndex: number, _index: number, _sourceUrl: string, _options?: unknown): Promise<{ localPath: string }> => unavailable();
export const listNetworkBookSourceCandidates = (_bookId: string): Promise<{ results: BookSourceSearchResult[] }> => unavailable();
export const switchNetworkBookSource = (_request: unknown): Promise<unknown> => unavailable();
export const getBookSourceEditPayload = (_sourceId: string): Promise<BookSourceEditPayload> => unavailable();
export const saveBookSourceEditPayload = (_sourceId: string, _rawJson: string): Promise<BookSourceEditPayload> => unavailable();

import type { ReaderChapter } from '../../features/reader-core/readerModel';
import type { Book } from '../../types';

export type ReaderDocumentModel = {
  bookId: string;
  contentHash: string;
  cleanedContent: string;
  sourceChapters: ReaderChapter[];
  signature: string;
  loading: boolean;
  error: string;
};

export type ReaderDocumentCacheState = {
  documents: Map<string, Book>;
  models: Map<string, ReaderDocumentModel>;
};

export type ReaderDocumentCacheMutation = {
  cacheSize: number;
  evictedKeys: string[];
};

export type ReaderDocumentCacheRelease = {
  documentRemoved: boolean;
  modelSignatures: string[];
};

export function createReaderDocumentCacheState(): ReaderDocumentCacheState {
  return {
    documents: new Map(),
    models: new Map(),
  };
}

function touchMapEntry<T>(map: Map<string, T>, key: string, value: T, maxSize: number): ReaderDocumentCacheMutation {
  const evictedKeys: string[] = [];
  map.delete(key);
  map.set(key, value);
  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value as string | undefined;
    if (!oldestKey) break;
    map.delete(oldestKey);
    evictedKeys.push(oldestKey);
  }
  return { cacheSize: map.size, evictedKeys };
}

export function putReaderDocumentCache(cache: ReaderDocumentCacheState, document: Book, maxSize = 6): ReaderDocumentCacheMutation | null {
  if (!document.id || !document.content) return null;
  return touchMapEntry(cache.documents, document.id, document, maxSize);
}

export function getReaderDocumentCache(cache: ReaderDocumentCacheState, bookId: string): Book | null {
  const document = cache.documents.get(bookId) ?? null;
  if (document) {
    cache.documents.delete(bookId);
    cache.documents.set(bookId, document);
  }
  return document;
}

export function putReaderDocumentModelCache(cache: ReaderDocumentCacheState, model: ReaderDocumentModel, maxSize = 6): ReaderDocumentCacheMutation | null {
  if (!model.signature || !model.sourceChapters.length || model.loading || model.error) return null;
  return touchMapEntry(cache.models, model.signature, model, maxSize);
}

export function getReaderDocumentModelCache(cache: ReaderDocumentCacheState, signature: string): ReaderDocumentModel | null {
  const model = cache.models.get(signature) ?? null;
  if (model) {
    cache.models.delete(signature);
    cache.models.set(signature, model);
  }
  return model;
}

export function removeReaderDocumentCacheForBook(cache: ReaderDocumentCacheState, bookId: string): ReaderDocumentCacheRelease {
  const documentRemoved = cache.documents.delete(bookId);
  const modelSignatures: string[] = [];
  for (const [signature, model] of cache.models) {
    if (model.bookId !== bookId) continue;
    cache.models.delete(signature);
    modelSignatures.push(signature);
  }
  return { documentRemoved, modelSignatures };
}

export function resolveInstantReaderBook(book: Book | null, isPdfBook: boolean, readerDocument: Book | null, cache: ReaderDocumentCacheState): Book | null {
  if (!book) return null;
  if (isPdfBook) return book;
  if (readerDocument?.id === book.id) return readerDocument;
  if (book.content) return book;
  return getReaderDocumentCache(cache, book.id);
}

export function shouldBlockForReaderDocument(args: {
  isPdfBook: boolean;
  book: Book | null;
  readerBook: Book | null;
  activeModel: ReaderDocumentModel | null;
  sourceChapterCount: number;
  readerDocumentError: string;
  readerDocumentModelError: string;
}) {
  if (args.isPdfBook || !args.book || args.readerDocumentError || args.readerDocumentModelError) return false;
  if (!args.readerBook) return true;
  if (!args.activeModel) return args.sourceChapterCount === 0;
  if (args.activeModel.loading) return args.sourceChapterCount === 0;
  return args.sourceChapterCount === 0 && !args.activeModel.error;
}

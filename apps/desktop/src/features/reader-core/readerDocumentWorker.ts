import type { Book } from '../../types';
import { buildReaderChapters, buildReaderChaptersFromTocManifest, cleanTxtContent, type ReaderChapter, type ReaderChapterParsingOptions, type ReaderTocManifest, type TxtCleanupOptions } from './readerModel';

export type ReaderDocumentWorkerRequest = {
  requestId: string;
  book: Omit<Book, 'chunks'>;
  cleanupOptions: TxtCleanupOptions;
  tocManifest: ReaderTocManifest | null;
  chapterParsingOptions: ReaderChapterParsingOptions;
};

export type ReaderDocumentWorkerResponse =
  | {
      requestId: string;
      ok: true;
      cleanedContent: string;
      sourceChapters: ReaderChapter[];
    }
  | {
      requestId: string;
      ok: false;
      error: string;
    };

self.onmessage = (event: MessageEvent<ReaderDocumentWorkerRequest>) => {
  const { requestId, book, cleanupOptions, tocManifest, chapterParsingOptions } = event.data;
  try {
    const cleanedContent = cleanTxtContent(book.content, cleanupOptions);
    const modelBook = { ...book, content: cleanedContent, chunks: [] } satisfies Book;
    const sourceChapters = buildReaderChaptersFromTocManifest(modelBook, tocManifest, chapterParsingOptions)
      ?? buildReaderChapters(modelBook, chapterParsingOptions);
    self.postMessage({ requestId, ok: true, cleanedContent, sourceChapters } satisfies ReaderDocumentWorkerResponse);
  } catch (error) {
    self.postMessage({ requestId, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies ReaderDocumentWorkerResponse);
  }
};

import type { Book } from '../../types';
import { isAudiobookChapter, isComicBook } from './readerFormatDetectionModel';
import { isMarkdownBookFormat } from './markdownReaderModel';
import type { ReaderChapter } from './readerModel';

export type ReaderFormatKind = 'text' | 'pdf' | 'comic' | 'audiobook';
export type ReaderDocumentStateOwner = 'text-session' | 'pdf-session' | 'comic-session' | 'audio-session';

export type ReaderFormatAdapter = {
  kind: ReaderFormatKind;
  documentStateOwner: ReaderDocumentStateOwner;
  isExternalView: boolean;
  supportsChapterNavigation: boolean;
};

const adapters: Record<ReaderFormatKind, ReaderFormatAdapter> = {
  text: { kind: 'text', documentStateOwner: 'text-session', isExternalView: false, supportsChapterNavigation: true },
  pdf: { kind: 'pdf', documentStateOwner: 'pdf-session', isExternalView: true, supportsChapterNavigation: false },
  comic: { kind: 'comic', documentStateOwner: 'comic-session', isExternalView: true, supportsChapterNavigation: true },
  audiobook: { kind: 'audiobook', documentStateOwner: 'audio-session', isExternalView: true, supportsChapterNavigation: true },
};

export function resolveReaderFormatAdapter(book: Book | null, chapters: ReaderChapter[], activeChapterIndex: number): ReaderFormatAdapter | null {
  if (!book) return null;
  const normalizedFormat = book.format.toLowerCase();
  if (normalizedFormat === 'pdf') return adapters.pdf;
  if (isMarkdownBookFormat(normalizedFormat)) return adapters.text;
  if (!chapters.length) return adapters.text;
  if (isComicBook(book)) return adapters.comic;
  const activeChapter = chapters[Math.min(Math.max(activeChapterIndex, 0), chapters.length - 1)] ?? null;
  if (isAudiobookChapter(activeChapter)) return adapters.audiobook;
  return adapters.text;
}

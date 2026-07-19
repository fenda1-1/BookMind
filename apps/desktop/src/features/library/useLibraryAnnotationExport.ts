import { formatReaderAnnotationsMarkdown } from '../reader-core/readerModel';
import type { ReaderChapter } from '../reader-core/readerModel';
import { getPrivacyBookTitle, getPrivacyExportFileBaseName, type ExtendedSettings } from '../../services/settingsCenterService';
import { getReaderRecord, parseReaderRecord } from '../../services/readerStorageService';
import type { Book, ReaderBookmark, ReaderHighlight } from '../../types';
import { downloadReaderText } from '../../pages/readerWorkspaceStorage';

type UseLibraryAnnotationExportOptions = {
  privacySettings: ExtendedSettings;
  exportFailedMessage: string;
  onError: (message: string) => void;
  onCloseMenus: () => void;
};

export function useLibraryAnnotationExport({ privacySettings, exportFailedMessage, onError, onCloseMenus }: UseLibraryAnnotationExportOptions) {
  async function exportSelectedBookAnnotations(book: Book | undefined) {
    if (!book || book.deleted) return;
    onCloseMenus();
    try {
      const [highlightRecord, bookmarkRecord] = await Promise.all([getReaderRecord(book.id, 'highlights'), getReaderRecord(book.id, 'bookmarks')]);
      const highlights = parseReaderRecord<ReaderHighlight[]>(highlightRecord, []);
      const bookmarks = parseReaderRecord<ReaderBookmark[]>(bookmarkRecord, []);
      const sourceTitle = book.displayTitle || book.title || 'bookmind';
      const markdown = formatReaderAnnotationsMarkdown(getPrivacyBookTitle(sourceTitle, privacySettings), buildLibraryReaderChapters(book, highlights, bookmarks), highlights, bookmarks, { template: privacySettings.annotationMarkdownTemplate });
      downloadReaderText(`${getPrivacyExportFileBaseName(sourceTitle, privacySettings)}-reader-annotations-markdown.md`, markdown, 'text/markdown;charset=utf-8');
    } catch (error) {
      console.warn('Failed to export book annotations from library:', error);
      onError(exportFailedMessage);
    }
  }

  return { exportSelectedBookAnnotations };
}

function buildLibraryReaderChapters(book: Book, highlights: ReaderHighlight[], bookmarks: ReaderBookmark[]): ReaderChapter[] {
  const chapterMap = new Map<number, { title: string; paragraphs: string[] }>();
  for (const chunk of book.chunks ?? []) {
    const index = Number.isFinite(chunk.chapterIndex) ? Number(chunk.chapterIndex) : Math.max(0, Math.floor(chunk.ordinal ?? 0));
    const existing = chapterMap.get(index);
    const title = chunk.chapterTitle || chunk.chapter || `Chapter ${index + 1}`;
    const text = chunk.text || '';
    if (existing) {
      if (text) existing.paragraphs.push(text);
      continue;
    }
    chapterMap.set(index, { title, paragraphs: text ? [text] : [''] });
  }
  for (const item of [...highlights, ...bookmarks]) {
    if (!chapterMap.has(item.chapterIndex)) chapterMap.set(item.chapterIndex, { title: `Chapter ${item.chapterIndex + 1}`, paragraphs: [''] });
  }
  return [...chapterMap.entries()].sort(([left], [right]) => left - right).map(([index, chapter]) => ({ id: `library-export-chapter-${index}`, title: chapter.title, index, startLine: 0, paragraphs: chapter.paragraphs.length ? chapter.paragraphs : [''] }));
}

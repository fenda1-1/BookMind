import { lazy, Suspense } from 'react';
import { isMarkdownBookFormat } from '../../features/reader-core/markdownReaderModel';
import { resolveReaderFormatAdapter, type ReaderFormatKind } from '../../features/reader-core/readerFormatAdapter';
import type { ReaderChapter } from '../../features/reader-core/readerModel';
import { useI18n } from '../../i18n';
import type { Book } from '../../types';
import { LazyLoadBoundary } from '../../components/LazyLoadBoundary';

const PdfReaderView = lazy(() => import('../../features/reader-core/PdfReaderView').then((module) => ({ default: module.PdfReaderView })));
const MarkdownReaderView = lazy(() => import('../../features/reader-core/MarkdownReaderView').then((module) => ({ default: module.MarkdownReaderView })));
const ComicReaderView = lazy(() => import('../../features/reader-core/ComicReaderView').then((module) => ({ default: module.ComicReaderView })));
const AudiobookReaderView = lazy(() => import('../../features/reader-core/AudiobookReaderView').then((module) => ({ default: module.AudiobookReaderView })));

export type ReaderExternalViewKind = Exclude<ReaderFormatKind, 'text'> | 'markdown';
type ReaderProgressDetail = {
  pageCount: number;
  pageCurrent: number;
  chapterTitle: string;
  timestamp: string;
  minutesRead?: number;
};

type ReaderExternalViewProps = {
  kind: ReaderExternalViewKind;
  book: Book;
  chapters: ReaderChapter[];
  activeChapterIndex: number;
  onSelectChapter: (index: number) => void;
  onProgressChange?: (progress: number, detail?: ReaderProgressDetail) => void;
};

export function resolveReaderExternalViewKind(book: Book | null, chapters: ReaderChapter[], activeChapterIndex: number): ReaderExternalViewKind | null {
  const adapter = resolveReaderFormatAdapter(book, chapters, activeChapterIndex);
  if (!adapter?.isExternalView) return book && isMarkdownBookFormat(book.format) ? 'markdown' : null;
  return adapter.kind as Exclude<ReaderFormatKind, 'text'>;
}

export function ReaderExternalView({ kind, book, chapters, activeChapterIndex, onSelectChapter, onProgressChange }: ReaderExternalViewProps) {
  const { t } = useI18n();
  let view;
  if (kind === 'pdf') view = <PdfReaderView book={book} onProgressChange={onProgressChange} />;
  else if (kind === 'markdown') view = <MarkdownReaderView book={book} onProgressChange={onProgressChange} />;
  else if (kind === 'comic') view = <ComicReaderView book={book} chapters={chapters} activeChapterIndex={activeChapterIndex} onSelectChapter={onSelectChapter} onProgressChange={onProgressChange} />;
  else view = <AudiobookReaderView book={book} chapters={chapters} activeChapterIndex={activeChapterIndex} onSelectChapter={onSelectChapter} onProgressChange={onProgressChange} />;
  return (
    <LazyLoadBoundary resetKey={`${book.id}:${kind}`} errorLabel={t('common.loadFailed')} retryLabel={t('common.reload')} className="reader-external-load-error">
      <Suspense fallback={<div className="reader-external-loading" role="status" aria-live="polite">{t('reader.loadingDocument')}</div>}>
        {view}
      </Suspense>
    </LazyLoadBoundary>
  );
}

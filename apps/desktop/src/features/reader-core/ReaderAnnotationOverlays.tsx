import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { ReaderBookmark, ReaderHighlightColor } from '../../types';
import {
  ReaderBookmarkDrawer,
  ReaderHighlightDrawer,
  ReaderTextDialog,
  type ReaderHighlightViewRequest,
  type ReaderTextDialogRequest,
} from './ReaderAnnotationDrawers';
import type { ReaderHighlightRange } from './readerModel';
import { ReaderSelectionFloatingMenu, type ReaderSelectionMenuState } from './ReaderSelectionMenu';

type ReaderAnnotationOverlaysProps = {
  selectionMenu: ReaderSelectionMenuState | null;
  copySelectionText: () => void;
  searchSelectionText: () => void;
  explainSelectionText: () => void;
  translateSelectionText: () => void;
  createSelectionCard: () => void;
  generateSelectionQuestions: () => void;
  createSelectionAnnotation: () => void;
  startReadAloudFromSelectionParagraph: () => void;
  createSelectionHighlight: (color?: ReaderHighlightColor) => void;
  clearSelectionMenu: () => void;
  annotationMarkdownEditorEnabled: boolean;
  jumpToParagraph: (chapterIndex: number, paragraphIndex: number, offset?: number) => void;
  setHighlightViewer: Dispatch<SetStateAction<ReaderHighlightViewRequest | null>>;
  setTextDialog: Dispatch<SetStateAction<ReaderTextDialogRequest | null>>;
  onUpdateHighlightColor: (id: string, color: ReaderHighlightColor) => void;
  onDefaultHighlightColorChange: (color: ReaderHighlightColor) => void;
  onUpdateHighlightNote: (id: string, note: string) => void;
  deleteHighlightWithUndo: (highlight: ReaderHighlightRange) => void;
  undoToast: { message: string; restoreDeletedReaderItem: () => void } | null;
  setUndoToast: Dispatch<SetStateAction<{ message: string; restoreDeletedReaderItem: () => void } | null>>;
  undoLabel: string;
  bookmarkViewer: ReaderBookmark | null;
  setBookmarkViewer: Dispatch<SetStateAction<ReaderBookmark | null>>;
  chapters: { index: number; title: string }[];
  annotationTagSuggestions: string[];
  onUpdateBookmark: (id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }) => void;
  deleteBookmarkWithUndo: (bookmark: ReaderBookmark) => void;
  onSelectChapterPage: (index: number, screenPage?: number | 'first' | 'last', paragraphIndex?: number) => void;
  highlightViewer: ReaderHighlightViewRequest | null;
  highlightColorMeanings: Record<ReaderHighlightColor, string>;
  onUpdateHighlightDetails: (id: string, updates: { tags?: string[]; importance?: 'normal' | 'high' | 'critical'; reviewStatus?: 'new' | 'due' | 'reviewed'; colorMeaning?: string; updatedAt?: string }) => void;
  textDialog: ReaderTextDialogRequest | null;
};

export function ReaderAnnotationOverlays(props: ReaderAnnotationOverlaysProps) {
  const {
    selectionMenu, copySelectionText, searchSelectionText, explainSelectionText, translateSelectionText,
    createSelectionCard, generateSelectionQuestions, createSelectionAnnotation,
    startReadAloudFromSelectionParagraph, createSelectionHighlight, clearSelectionMenu,
    annotationMarkdownEditorEnabled, jumpToParagraph, setHighlightViewer, setTextDialog,
    onUpdateHighlightColor, onDefaultHighlightColorChange, onUpdateHighlightNote,
    deleteHighlightWithUndo, undoToast, setUndoToast, undoLabel, bookmarkViewer, setBookmarkViewer, chapters,
    annotationTagSuggestions, onUpdateBookmark, deleteBookmarkWithUndo, onSelectChapterPage,
    highlightViewer, highlightColorMeanings, onUpdateHighlightDetails, textDialog,
  } = props;
  return <>
    {selectionMenu ? <ReaderSelectionFloatingMenu menu={selectionMenu} copySelectionText={copySelectionText} searchSelectionText={searchSelectionText} explainSelectionText={explainSelectionText} translateSelectionText={translateSelectionText} createSelectionCard={createSelectionCard} generateSelectionQuestions={generateSelectionQuestions} createSelectionAnnotation={createSelectionAnnotation} startReadAloudFromSelectionParagraph={startReadAloudFromSelectionParagraph} createSelectionHighlight={createSelectionHighlight} cancelSelectionMenu={clearSelectionMenu} /> : null}
    {undoToast ? <div className="reader-undo-toast" role="status">{undoToast.message}<button type="button" onClick={() => { undoToast.restoreDeletedReaderItem(); setUndoToast(null); }}>{undoLabel}</button></div> : null}
    {bookmarkViewer ? (
      <ReaderBookmarkDrawer
        bookmark={bookmarkViewer}
        chapterTitle={chapters.find((chapter) => chapter.index === bookmarkViewer.chapterIndex)?.title ?? ''}
        tagSuggestions={annotationTagSuggestions}
        markdownEditorEnabled={annotationMarkdownEditorEnabled}
        onUpdateBookmark={(id, updates) => {
          onUpdateBookmark(id, updates);
          setBookmarkViewer((current) => current && current.id === id ? { ...current, ...updates, label: updates.title?.trim() || current.label } : current);
        }}
        onDeleteBookmark={() => {
          deleteBookmarkWithUndo(bookmarkViewer);
          setBookmarkViewer(null);
        }}
        onJumpBookmark={(bookmark) => {
          onSelectChapterPage(bookmark.chapterIndex, bookmark.screenPage, bookmark.paragraphIndex);
          setBookmarkViewer(null);
        }}
        onClose={() => setBookmarkViewer(null)}
      />
    ) : null}
    {highlightViewer ? (
      <ReaderHighlightDrawer
        request={highlightViewer}
        tagSuggestions={annotationTagSuggestions}
        markdownEditorEnabled={annotationMarkdownEditorEnabled}
        colorMeaningPlaceholder={highlightColorMeanings[highlightViewer.highlight.color ?? 'yellow']}
        onJump={(highlight) => jumpToParagraph(highlight.chapterIndex, highlight.paragraphIndex, highlight.startOffset)}
        onUpdateColor={(highlight, color) => {
          if (!highlight.id) return;
          onUpdateHighlightColor(highlight.id, color);
          onDefaultHighlightColorChange(color);
          setHighlightViewer({ highlight: { ...highlight, color } });
        }}
        onUpdateNote={(highlight, note) => {
          if (!highlight.id) return;
          onUpdateHighlightNote(highlight.id, note);
          setHighlightViewer({ highlight: { ...highlight, note } });
        }}
        onUpdateDetails={(highlight, updates) => {
          if (!highlight.id) return;
          onUpdateHighlightDetails(highlight.id, updates);
          setHighlightViewer({ highlight: { ...highlight, ...updates } });
        }}
        onDelete={(highlight) => {
          deleteHighlightWithUndo(highlight);
          setHighlightViewer(null);
        }}
        onClose={() => setHighlightViewer(null)}
      />
    ) : null}
    {textDialog ? createPortal(<ReaderTextDialog request={textDialog} onClose={() => setTextDialog(null)} />, document.body) : null}
  </>;
}

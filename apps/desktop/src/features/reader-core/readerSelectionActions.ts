import type { ReaderHighlightColor } from '../../types';
import type { ReaderTextDialogRequest } from './ReaderAnnotationDrawers';
import type { ReaderSelectionMenuState } from './ReaderSelectionMenu';
import {
  appendReaderContextToAnnotationNote,
  appendReaderLocationToAnnotationNote,
  applyReaderAnnotationNoteTemplate,
  buildReaderSelectionRanges,
  getReaderSelectionContextSnippet,
  getReaderSelectionMenuPosition,
  resolveReaderHighlightColor,
  shouldCreateReaderAnnotationFromNote,
} from './readerModel';
import type { ReaderHighlightRange } from './readerModel';
import { getReaderDoubleClickWordRange, getSelectionBoundingRect, getSelectionParagraphRanges } from './readerPageRuntime';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;
const readerSelectionMenuSize = { width: 226, height: 142 };

type ReaderSelectionActionDeps = {
  selectionMenu: ReaderSelectionMenuState | null;
  defaultHighlightColor: ReaderHighlightColor;
  annotationMarkdownEditorEnabled: boolean;
  openNoteAfterHighlight: boolean;
  allowEmptyNotes: boolean;
  noteTemplate: string;
  noteAutoContext: boolean;
  noteAutoReaderLocation: boolean;
  selectionMenuEnabled: boolean;
  doubleClickWordSelectionEnabled: boolean;
  highlightNotePromptLabel: string;
  annotateSubmitLabel: string;
  scrollElement: HTMLDivElement | null;
  longPressSelectionTimerRef: { current: number | null };
  suppressClickAfterLongPressRef: { current: boolean };
  rememberFloatingMenuFocus: (element: HTMLElement | null) => void;
  setSelectionMenu: StateSetter<ReaderSelectionMenuState | null>;
  setReaderSearchQuery: StateSetter<string>;
  setReaderSearchScope: StateSetter<'page' | 'chapter' | 'book' | 'annotations' | 'bookmarks' | 'all'>;
  setTextDialog: StateSetter<ReaderTextDialogRequest | null>;
  onAskSelectionAi: (text: string) => void;
  onTranslateSelection: (text: string) => void;
  onCreateSelectionCard: (text: string) => void;
  onGenerateSelectionQuestions: (text: string) => void;
  onStartReadAloudFromParagraph: (location: string) => void;
  onCreateHighlight: (range: ReaderHighlightRange) => void;
  onDefaultHighlightColorChange: (color: ReaderHighlightColor) => void;
};

export function createReaderSelectionActions(deps: ReaderSelectionActionDeps) {
  const {
    selectionMenu,
    defaultHighlightColor,
    annotationMarkdownEditorEnabled,
    openNoteAfterHighlight,
    allowEmptyNotes,
    noteTemplate,
    noteAutoContext,
    noteAutoReaderLocation,
    selectionMenuEnabled,
    doubleClickWordSelectionEnabled,
    highlightNotePromptLabel,
    annotateSubmitLabel,
    scrollElement,
    longPressSelectionTimerRef,
    suppressClickAfterLongPressRef,
    rememberFloatingMenuFocus,
    setSelectionMenu,
    setReaderSearchQuery,
    setReaderSearchScope,
    setTextDialog,
    onAskSelectionAi,
    onTranslateSelection,
    onCreateSelectionCard,
    onGenerateSelectionQuestions,
    onStartReadAloudFromParagraph,
    onCreateHighlight,
    onDefaultHighlightColorChange,
  } = deps;

  function getSelectionMenuText(menu: typeof selectionMenu) {
    return menu?.ranges.map((range) => range.selectedText).join('\n').trim() ?? '';
  }

  function clearSelectionMenu() {
    window.getSelection()?.removeAllRanges();
    setSelectionMenu(null);
  }

  function openSelectionMenuFromSelection(selection: Selection | null) {
    const selectedText = selection?.toString() ?? '';
    if (!selectedText.trim() || !selection || selection.rangeCount === 0) {
      setSelectionMenu(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const selectedRanges = getSelectionParagraphRanges(selection, range);
    if (!selectedRanges.length) {
      setSelectionMenu(null);
      return;
    }
    const rect = getSelectionBoundingRect(range);
    const containerRect = scrollElement?.getBoundingClientRect();
    const menuPosition = containerRect
      ? getReaderSelectionMenuPosition(rect, containerRect, readerSelectionMenuSize)
      : { x: rect.left + rect.width / 2, y: rect.bottom + 12, placement: 'bottom' as const };
    setSelectionMenu({
      x: menuPosition.x + (scrollElement?.scrollLeft ?? 0),
      y: menuPosition.y + (scrollElement?.scrollTop ?? 0),
      placement: menuPosition.placement,
      ranges: selectedRanges,
    });
    rememberFloatingMenuFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }

  function onReaderMouseUp() {
    if (!selectionMenuEnabled) {
      setSelectionMenu(null);
      return;
    }
    window.setTimeout(() => openSelectionMenuFromSelection(window.getSelection()), 0);
  }

  function selectWordFromDoubleClick(event: React.MouseEvent<HTMLElement>) {
    if (!selectionMenuEnabled || !doubleClickWordSelectionEnabled) return;
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    window.setTimeout(() => {
      const selection = window.getSelection();
      if (selection?.toString().trim() && selection.rangeCount > 0) {
        openSelectionMenuFromSelection(selection);
        return;
      }
      selectWordRangeFromPoint(clientX, clientY, target);
    }, 0);
  }

  function cancelLongPressSelection() {
    if (longPressSelectionTimerRef.current !== null) {
      window.clearTimeout(longPressSelectionTimerRef.current);
      longPressSelectionTimerRef.current = null;
    }
  }

  function startLongPressSelection(event: React.PointerEvent<HTMLElement>) {
    if (!selectionMenuEnabled) return;
    if (event.pointerType === 'mouse') return;
    if ((event.target as HTMLElement | null)?.closest('.reader-highlight')) return;
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    cancelLongPressSelection();
    longPressSelectionTimerRef.current = window.setTimeout(() => {
      longPressSelectionTimerRef.current = null;
      suppressClickAfterLongPressRef.current = true;
      selectWordRangeFromPoint(clientX, clientY, target);
      window.setTimeout(() => { suppressClickAfterLongPressRef.current = false; }, 360);
    }, 560);
  }

  function selectWordRangeFromPoint(clientX: number, clientY: number, target: HTMLElement) {
    const selection = window.getSelection();
    const wordRange = getReaderDoubleClickWordRange(clientX, clientY, target);
    if (!wordRange) {
      setSelectionMenu(null);
      return;
    }
    selection?.removeAllRanges();
    selection?.addRange(wordRange);
    openSelectionMenuFromSelection(selection);
  }

  function copySelectionText() {
    if (!selectionMenu) return;
    void navigator.clipboard.writeText(getSelectionMenuText(selectionMenu));
    clearSelectionMenu();
  }

  function searchSelectionText() {
    if (!selectionMenu) return;
    setReaderSearchQuery(getSelectionMenuText(selectionMenu));
    setReaderSearchScope('all');
    clearSelectionMenu();
  }

  function explainSelectionText() {
    if (!selectionMenu) return;
    onAskSelectionAi(getSelectionMenuText(selectionMenu));
    clearSelectionMenu();
  }

  function translateSelectionText() {
    if (!selectionMenu) return;
    onTranslateSelection(getSelectionMenuText(selectionMenu));
    clearSelectionMenu();
  }

  function createSelectionCard() {
    if (!selectionMenu) return;
    onCreateSelectionCard(getSelectionMenuText(selectionMenu));
    clearSelectionMenu();
  }

  function generateSelectionQuestions() {
    if (!selectionMenu) return;
    onGenerateSelectionQuestions(getSelectionMenuText(selectionMenu));
    clearSelectionMenu();
  }

  function startReadAloudFromSelectionParagraph() {
    if (!selectionMenu) return;
    const selected = selectionMenu;
    onStartReadAloudFromParagraph(selected.ranges[0].location);
    clearSelectionMenu();
  }

  function createSelectionHighlight(color?: ReaderHighlightColor) {
    if (!selectionMenu) return;
    if (!color && openNoteAfterHighlight) {
      createSelectionAnnotation();
      return;
    }
    const selected = selectionMenu;
    const resolvedColor = resolveReaderHighlightColor(color, defaultHighlightColor);
    onDefaultHighlightColorChange(resolvedColor);
    buildReaderSelectionRanges(selected.ranges, 'highlight', '', resolvedColor).forEach(onCreateHighlight);
    clearSelectionMenu();
  }

  function createSelectionAnnotation() {
    if (!selectionMenu) return;
    const selected = selectionMenu;
    const templateValue = applyReaderAnnotationNoteTemplate(noteTemplate, getSelectionMenuText(selected));
    setTextDialog({
      x: selected.x,
      y: selected.y,
      title: highlightNotePromptLabel,
      value: templateValue,
      submitLabel: annotateSubmitLabel,
      markdownEditorEnabled: annotationMarkdownEditorEnabled,
      onSubmit: (note) => {
        if (!shouldCreateReaderAnnotationFromNote(note, allowEmptyNotes)) return;
        const ranges = buildReaderSelectionRanges(selected.ranges, 'annotate', note, defaultHighlightColor);
        const firstRange = ranges[0];
        const firstSelection = selected.ranges[0];
        let annotationNote = note;
        if (noteAutoContext && firstSelection && firstRange) {
          annotationNote = appendReaderContextToAnnotationNote(annotationNote, getReaderSelectionContextSnippet(firstSelection, firstRange));
        }
        if (noteAutoReaderLocation && firstRange) {
          annotationNote = appendReaderLocationToAnnotationNote(annotationNote, firstRange);
        }
        ranges.map((range) => ({ ...range, note: annotationNote })).forEach(onCreateHighlight);
        clearSelectionMenu();
      },
    });
  }

  return {
    getSelectionMenuText,
    clearSelectionMenu,
    openSelectionMenuFromSelection,
    onReaderMouseUp,
    selectWordFromDoubleClick,
    cancelLongPressSelection,
    startLongPressSelection,
    selectWordRangeFromPoint,
    copySelectionText,
    searchSelectionText,
    explainSelectionText,
    translateSelectionText,
    createSelectionCard,
    generateSelectionQuestions,
    startReadAloudFromSelectionParagraph,
    createSelectionHighlight,
    createSelectionAnnotation,
  };
}

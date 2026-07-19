import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Translator } from '../../i18n';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { ReaderBookmark, ReaderHighlightColor, ReaderHighlightImportance, ReaderHighlightReviewStatus } from '../../types';
import {
  buildReaderAnnotationTagSuggestions,
  createVirtualListWindow,
  groupReaderBookmarks,
  normalizeReaderAnnotationTag,
  parseReaderTagInput,
  toReaderAnnotationExportChoice,
  type ReaderAnnotationExportChoice,
} from './readerInteractionModel';
import {
  filterReaderHighlights,
  groupReaderHighlightsByChapter,
  sortReaderHighlights,
  type ReaderChapter,
  type ReaderHighlightRange,
  type ReaderHighlightSortKey,
} from './readerModel';

type ReaderAnnotationPanelControllerContext = {
  chapters: ReaderChapter[];
  activeChapterIndex: number;
  highlights: ReaderHighlightRange[];
  bookmarks: ReaderBookmark[];
  extendedSettings: ExtendedSettings;
  defaultBookmarkColor: ReaderHighlightColor;
  onExportHighlights: (selectedHighlightIds?: Iterable<string>) => void;
  onExportAnnotations: (
    format: Exclude<ReaderAnnotationExportChoice, 'highlights'>,
    content: ExtendedSettings['annotationExportContent'],
    selectedIds?: { highlightIds?: Iterable<string>; bookmarkIds?: Iterable<string> },
  ) => void;
  onUpdateBookmark: (id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }) => void;
  onDeleteHighlight: (id: string) => void;
  onRestoreHighlight: (highlight: ReaderHighlightRange) => void;
  onDeleteBookmark: (id: string) => void;
  onRestoreBookmark: (bookmark: ReaderBookmark) => void;
  t: Translator;
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useReaderAnnotationPanelController(context: ReaderAnnotationPanelControllerContext) {
  const {
    chapters,
    activeChapterIndex,
    highlights,
    bookmarks,
    extendedSettings,
    defaultBookmarkColor,
    onExportHighlights,
    onExportAnnotations,
    onUpdateBookmark,
    onDeleteHighlight,
    onRestoreHighlight,
    onDeleteBookmark,
    onRestoreBookmark,
    t,
  } = context;
  const [highlightSearchQuery, setHighlightSearchQuery] = useState('');
  const [highlightQueryScope, setHighlightQueryScope] = useState<'all' | 'text' | 'note' | 'context'>('all');
  const [highlightSort, setHighlightSort] = useState<ReaderHighlightSortKey>('reading-order');
  const [highlightNoteFilter, setHighlightNoteFilter] = useState<boolean | 'all'>('all');
  const [highlightChapterFilter, setHighlightChapterFilter] = useState<number | 'all'>('all');
  const [highlightTagFilter, setHighlightTagFilter] = useState<string | 'all'>('all');
  const [highlightImportanceFilter, setHighlightImportanceFilter] = useState<ReaderHighlightImportance | 'all'>('all');
  const [highlightReviewFilter, setHighlightReviewFilter] = useState<ReaderHighlightReviewStatus | 'all'>('all');
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState('');
  const [bookmarkSort, setBookmarkSort] = useState<ExtendedSettings['defaultBookmarkSort']>(() => extendedSettings.defaultBookmarkSort);
  const [bookmarkGroupBy, setBookmarkGroupBy] = useState<ExtendedSettings['defaultBookmarkGroupBy']>(() => extendedSettings.defaultBookmarkGroupBy);
  const [bookmarkColorFilter, setBookmarkColorFilter] = useState<ReaderHighlightColor | 'all'>('all');
  const [annotationExportChoice, setAnnotationExportChoice] = useState<ReaderAnnotationExportChoice>(() => toReaderAnnotationExportChoice(extendedSettings.defaultExportFormat));
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedBookmarkId, setLastSelectedBookmarkId] = useState<string | null>(null);
  const [bulkBookmarkTags, setBulkBookmarkTags] = useState('');
  const [bulkBookmarkTagMode, setBulkBookmarkTagMode] = useState<'append' | 'replace'>('append');
  const [bulkBookmarkNote, setBulkBookmarkNote] = useState('');
  const [bulkBookmarkNoteMode, setBulkBookmarkNoteMode] = useState<'append' | 'replace' | 'clear'>('append');
  const [bulkBookmarkColor, setBulkBookmarkColor] = useState<ReaderHighlightColor>(() => defaultBookmarkColor);
  const [highlightColorFilter, setHighlightColorFilter] = useState<ReaderHighlightColor | 'all'>('all');
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedHighlightId, setLastSelectedHighlightId] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{ message: string; restoreDeletedReaderItem: () => void } | null>(null);
  const debouncedHighlightSearchQuery = useDebouncedValue(highlightSearchQuery, 180);
  const debouncedBookmarkSearchQuery = useDebouncedValue(bookmarkSearchQuery, 180);

  const chapterTitles = useMemo(() => new Map(chapters.map((chapter) => [chapter.index, chapter.title])), [chapters]);
  const filteredHighlights = useMemo(() => sortReaderHighlights(filterReaderHighlights(highlights, { query: debouncedHighlightSearchQuery, queryScope: highlightQueryScope, chapterTitles, color: highlightColorFilter, chapterIndex: highlightChapterFilter, hasNote: highlightNoteFilter, tag: highlightTagFilter, importance: highlightImportanceFilter, reviewStatus: highlightReviewFilter }), highlightSort), [highlights, highlightColorFilter, debouncedHighlightSearchQuery, highlightQueryScope, highlightChapterFilter, highlightSort, highlightNoteFilter, highlightTagFilter, highlightImportanceFilter, highlightReviewFilter, chapterTitles]);
  const highlightGroups = useMemo(() => groupReaderHighlightsByChapter(filteredHighlights), [filteredHighlights]);
  const highlightVirtualActiveIndex = useMemo(() => {
    if (!highlightGroups.length) return 0;
    const exact = highlightGroups.findIndex((group) => group.chapterIndex === activeChapterIndex);
    if (exact >= 0) return exact;
    const nearest = highlightGroups.reduce((best, group, index) => {
      const distance = Math.abs(group.chapterIndex - activeChapterIndex);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    return nearest.index;
  }, [highlightGroups, activeChapterIndex]);
  const highlightVirtualWindow = useMemo(() => createVirtualListWindow(highlightGroups, Math.max(0, highlightVirtualActiveIndex), 40), [highlightGroups, highlightVirtualActiveIndex]);
  const annotationTagSuggestions = useMemo(() => (
    extendedSettings.annotationTagSuggestionsEnabled
      ? buildReaderAnnotationTagSuggestions(highlights, bookmarks, [extendedSettings.defaultBookmarkTags])
      : []
  ), [bookmarks, extendedSettings.annotationTagSuggestionsEnabled, extendedSettings.defaultBookmarkTags, highlights]);
  const highlightTagOptions = useMemo(() => {
    const tags = new Set<string>();
    highlights.forEach((highlight) => (highlight.tags ?? []).forEach((tag) => {
      const normalized = normalizeReaderAnnotationTag(tag);
      if (normalized) tags.add(normalized);
    }));
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [highlights]);
  const filteredBookmarks = useMemo(() => {
    const keyword = debouncedBookmarkSearchQuery.trim().normalize('NFKC').toLowerCase();
    const matches = bookmarks.filter((bookmark) => {
      const colorMatches = bookmarkColorFilter === 'all' || (bookmark.color ?? 'red') === bookmarkColorFilter;
      const textMatches = !keyword || `${bookmark.label} ${bookmark.title ?? ''} ${bookmark.note ?? ''} ${(bookmark.tags ?? []).join(' ')}`.normalize('NFKC').toLowerCase().includes(keyword);
      return colorMatches && textMatches;
    });
    return [...matches].sort((left, right) => {
      if (bookmarkSort === 'created-asc') return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      if (bookmarkSort === 'chapter-asc') return left.chapterIndex - right.chapterIndex || left.screenPage - right.screenPage || Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
  }, [bookmarks, debouncedBookmarkSearchQuery, bookmarkSort, bookmarkColorFilter]);
  const selectedBookmarks = useMemo(() => bookmarks.filter((bookmark) => selectedBookmarkIds.has(bookmark.id)), [bookmarks, selectedBookmarkIds]);
  const bookmarkGroups = useMemo(() => groupReaderBookmarks(filteredBookmarks, bookmarkGroupBy, chapters), [filteredBookmarks, bookmarkGroupBy, chapters]);
  const bookmarkVirtualActiveIndex = useMemo(() => {
    if (!bookmarkGroups.length) return 0;
    const exact = bookmarkGroups.findIndex((group) => group.items.some((bookmark) => bookmark.chapterIndex === activeChapterIndex));
    if (exact >= 0) return exact;
    const nearest = bookmarkGroups.reduce((best, group, index) => {
      const chapterIndex = group.items[0]?.chapterIndex ?? 0;
      const distance = Math.abs(chapterIndex - activeChapterIndex);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    return nearest.index;
  }, [bookmarkGroups, activeChapterIndex]);
  const bookmarkVirtualWindow = useMemo(() => createVirtualListWindow(bookmarkGroups, Math.max(0, bookmarkVirtualActiveIndex), 40), [bookmarkGroups, bookmarkVirtualActiveIndex]);
  const highlightFiltersActive = highlightQueryScope !== 'all'
    || highlightSort !== 'reading-order'
    || highlightNoteFilter !== 'all'
    || highlightChapterFilter !== 'all'
    || highlightTagFilter !== 'all'
    || highlightImportanceFilter !== 'all'
    || highlightReviewFilter !== 'all'
    || highlightColorFilter !== 'all'
    || Boolean(highlightSearchQuery.trim());
  const bookmarkFiltersActive = bookmarkSort !== extendedSettings.defaultBookmarkSort
    || bookmarkGroupBy !== extendedSettings.defaultBookmarkGroupBy
    || bookmarkColorFilter !== 'all'
    || Boolean(bookmarkSearchQuery.trim());

  useEffect(() => {
    setSelectedHighlightIds((current) => new Set([...current].filter((id) => highlights.some((highlight) => highlight.id === id))));
  }, [highlights]);

  useEffect(() => {
    setSelectedBookmarkIds((current) => new Set([...current].filter((id) => bookmarks.some((bookmark) => bookmark.id === id))));
  }, [bookmarks]);

  const syncAnnotationPanelSettings = useCallback((settings: ExtendedSettings) => {
    setAnnotationExportChoice(toReaderAnnotationExportChoice(settings.defaultExportFormat));
    setBookmarkSort(settings.defaultBookmarkSort);
    setBookmarkGroupBy(settings.defaultBookmarkGroupBy);
  }, []);

  function resolveExportHighlightIds() {
    if (selectedHighlightIds.size) return [...selectedHighlightIds];
    return filteredHighlights.flatMap((highlight) => highlight.id ? [highlight.id] : []);
  }

  function resolveExportBookmarkIds() {
    if (selectedBookmarkIds.size) return [...selectedBookmarkIds];
    return filteredBookmarks.map((bookmark) => bookmark.id);
  }

  function exportSelectedAnnotations() {
    const highlightIds = resolveExportHighlightIds();
    const bookmarkIds = resolveExportBookmarkIds();
    if (annotationExportChoice === 'highlights') {
      onExportHighlights(highlightIds);
      return;
    }
    onExportAnnotations(annotationExportChoice, extendedSettings.annotationExportContent, { highlightIds, bookmarkIds });
  }

  function toggleHighlightSelection(highlight: ReaderHighlightRange, event?: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>) {
    const highlightId = highlight.id;
    if (!highlightId) return;
    setSelectedHighlightIds((current) => {
      const next = new Set(current);
      if (event?.shiftKey && lastSelectedHighlightId) {
        const ids = filteredHighlights.flatMap((item) => item.id ? [item.id] : []);
        const start = ids.indexOf(lastSelectedHighlightId);
        const end = ids.indexOf(highlightId);
        if (start >= 0 && end >= 0) {
          ids.slice(Math.min(start, end), Math.max(start, end) + 1).forEach((id) => next.add(id));
        } else {
          next.add(highlightId);
        }
      } else if (event?.ctrlKey || event?.metaKey || next.has(highlightId)) {
        if (next.has(highlightId)) next.delete(highlightId);
        else next.add(highlightId);
      } else {
        next.add(highlightId);
      }
      return next;
    });
    setLastSelectedHighlightId(highlightId);
  }

  function toggleBookmarkSelection(bookmark: ReaderBookmark, event?: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>) {
    setSelectedBookmarkIds((current) => {
      const next = new Set(current);
      if (event?.shiftKey && lastSelectedBookmarkId) {
        const ids = filteredBookmarks.map((item) => item.id);
        const start = ids.indexOf(lastSelectedBookmarkId);
        const end = ids.indexOf(bookmark.id);
        if (start >= 0 && end >= 0) {
          ids.slice(Math.min(start, end), Math.max(start, end) + 1).forEach((id) => next.add(id));
        } else {
          next.add(bookmark.id);
        }
      } else if (event?.ctrlKey || event?.metaKey || next.has(bookmark.id)) {
        if (next.has(bookmark.id)) next.delete(bookmark.id);
        else next.add(bookmark.id);
      } else {
        next.add(bookmark.id);
      }
      return next;
    });
    setLastSelectedBookmarkId(bookmark.id);
  }

  function applyBulkBookmarkEdit() {
    if (!selectedBookmarks.length) return;
    const inputTags = parseReaderTagInput(bulkBookmarkTags);
    const noteText = bulkBookmarkNote.trim();
    const updatedAt = new Date().toISOString();
    selectedBookmarks.forEach((bookmark) => {
      const nextTags = inputTags.length
        ? (bulkBookmarkTagMode === 'replace' ? inputTags : Array.from(new Set([...(bookmark.tags ?? []), ...inputTags].map(normalizeReaderAnnotationTag).filter(Boolean))))
        : bookmark.tags;
      const nextNote = bulkBookmarkNoteMode === 'clear'
        ? ''
        : noteText
          ? (bulkBookmarkNoteMode === 'replace' ? noteText : [bookmark.note?.trim(), noteText].filter(Boolean).join('\n\n'))
          : bookmark.note;
      onUpdateBookmark(bookmark.id, { tags: nextTags, note: nextNote, color: bulkBookmarkColor, updatedAt });
    });
    setBulkBookmarkTags('');
    setBulkBookmarkNote('');
  }

  function showUndoToast(message: string, restoreDeletedReaderItem: () => void) {
    setUndoToast({ message, restoreDeletedReaderItem });
    window.setTimeout(() => setUndoToast((current) => current?.restoreDeletedReaderItem === restoreDeletedReaderItem ? null : current), 6000);
  }

  function deleteHighlightWithUndo(highlight: ReaderHighlightRange) {
    if (!highlight.id) return;
    onDeleteHighlight(highlight.id);
    showUndoToast(t('reader.undo.deleted'), () => onRestoreHighlight(highlight));
  }

  function deleteBookmarkWithUndo(bookmark: ReaderBookmark) {
    onDeleteBookmark(bookmark.id);
    showUndoToast(t('reader.undo.deleted'), () => onRestoreBookmark(bookmark));
  }

  return {
    highlightSearchQuery,
    setHighlightSearchQuery,
    highlightQueryScope,
    setHighlightQueryScope,
    highlightSort,
    setHighlightSort,
    highlightNoteFilter,
    setHighlightNoteFilter,
    highlightChapterFilter,
    setHighlightChapterFilter,
    highlightTagFilter,
    setHighlightTagFilter,
    highlightImportanceFilter,
    setHighlightImportanceFilter,
    highlightReviewFilter,
    setHighlightReviewFilter,
    bookmarkSearchQuery,
    setBookmarkSearchQuery,
    bookmarkSort,
    setBookmarkSort,
    bookmarkGroupBy,
    setBookmarkGroupBy,
    bookmarkColorFilter,
    setBookmarkColorFilter,
    annotationExportChoice,
    setAnnotationExportChoice,
    selectedBookmarkIds,
    setSelectedBookmarkIds,
    bulkBookmarkTags,
    setBulkBookmarkTags,
    bulkBookmarkTagMode,
    setBulkBookmarkTagMode,
    bulkBookmarkNote,
    setBulkBookmarkNote,
    bulkBookmarkNoteMode,
    setBulkBookmarkNoteMode,
    bulkBookmarkColor,
    setBulkBookmarkColor,
    highlightColorFilter,
    setHighlightColorFilter,
    selectedHighlightIds,
    setSelectedHighlightIds,
    undoToast,
    setUndoToast,
    filteredHighlights,
    highlightGroups,
    highlightVirtualWindow,
    annotationTagSuggestions,
    highlightTagOptions,
    filteredBookmarks,
    selectedBookmarks,
    bookmarkGroups,
    bookmarkVirtualWindow,
    highlightFiltersActive,
    bookmarkFiltersActive,
    syncAnnotationPanelSettings,
    exportSelectedAnnotations,
    toggleHighlightSelection,
    toggleBookmarkSelection,
    applyBulkBookmarkEdit,
    showUndoToast,
    deleteHighlightWithUndo,
    deleteBookmarkWithUndo,
  };
}

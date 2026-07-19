import type { Book, FlashcardRecord, HighlightRecord, NoteRecord, NoteSaveTarget, ReaderBookmark, ReaderHighlight, ReaderHighlightColor } from '../types';

export type KnowledgeTab = 'highlights' | 'notes' | 'flashcards';
export type KnowledgeView = 'all' | 'highlights' | 'annotations' | 'bookmarks' | 'notes' | 'flashcards';
export type KnowledgeItemKind = Exclude<KnowledgeView, 'all'>;
export type KnowledgeItemStorage = 'knowledge-highlight' | 'knowledge-note' | 'knowledge-flashcard' | 'reader-highlight' | 'reader-bookmark';

export type KnowledgePageItem = {
  id: string;
  recordId: string;
  tab: KnowledgeTab;
  title: string;
  body: string;
  meta: string;
  sourceLabel: string;
  sourceTargetId: string;
  saveTarget?: NoteSaveTarget;
  createdAt: string;
  updatedAt?: string;
  kind: KnowledgeItemKind;
  storage: KnowledgeItemStorage;
  bookId?: string;
  bookTitle?: string;
  note?: string;
  color?: ReaderHighlightColor;
  tags?: string[];
  importance?: ReaderHighlight['importance'];
  reviewStatus?: ReaderHighlight['reviewStatus'] | FlashcardRecord['reviewStatus'];
  chapterIndex?: number;
  paragraphIndex?: number;
};

export type KnowledgeBookSummary = {
  book: Book;
  total: number;
  highlights: number;
  annotations: number;
  bookmarks: number;
  notes: number;
  flashcards: number;
  latestAt: string;
  colors: Partial<Record<ReaderHighlightColor, number>>;
};

export type KnowledgePageSelectionState = {
  visibleCount: number;
  selectedVisibleCount: number;
  batchDeleteIds: string[];
};

export function buildKnowledgePageSelectionState(input: {
  activeTab: KnowledgeTab;
  selectedIds: Set<string>;
  highlights: HighlightRecord[];
  notes: NoteRecord[];
  flashcards: FlashcardRecord[];
  searchQuery?: string;
}): KnowledgePageSelectionState {
  const items = buildKnowledgeItems(input.highlights, input.notes, input.flashcards);
  const visibleItems = items.filter((item) => item.tab === input.activeTab && matchesKnowledgeQuery(item, input.searchQuery ?? ''));
  const selectedVisibleItems = visibleItems.filter((item) => input.selectedIds.has(item.id));
  return {
    visibleCount: visibleItems.length,
    selectedVisibleCount: selectedVisibleItems.length,
    batchDeleteIds: selectedVisibleItems.map((item) => item.recordId),
  };
}

export function buildKnowledgeItems(highlights: HighlightRecord[], notes: NoteRecord[], flashcards: FlashcardRecord[]): KnowledgePageItem[] {
  return [
    ...highlights.map((highlight) => ({
      id: `highlight:${highlight.id}`,
      recordId: highlight.id,
      tab: 'highlights' as const,
      title: highlight.label || '高亮摘录',
      body: highlight.text,
      meta: highlight.targetId,
      sourceLabel: highlight.label,
      sourceTargetId: highlight.targetId,
      createdAt: highlight.createdAt,
      kind: 'highlights' as const,
      storage: 'knowledge-highlight' as const,
    })),
    ...notes.map((note) => ({
      id: `note:${note.id}`,
      recordId: note.id,
      tab: 'notes' as const,
      title: note.title || '主题笔记',
      body: note.body,
      meta: `${note.source} · ${note.citations.length} 条引用`,
      sourceLabel: note.source,
      sourceTargetId: note.readerLocation?.chapterId || note.readerLocation?.bookId || note.source,
      saveTarget: note.saveTarget,
      createdAt: note.createdAt,
      kind: 'notes' as const,
      storage: 'knowledge-note' as const,
      bookId: note.readerLocation?.bookId || note.citations.find((citation) => citation.bookId)?.bookId,
      chapterIndex: note.readerLocation?.sourceChapterIndex,
      paragraphIndex: note.readerLocation?.paragraphIndex,
    })),
    ...flashcards.map((flashcard) => ({
      id: `flashcard:${flashcard.id}`,
      recordId: flashcard.id,
      tab: 'flashcards' as const,
      title: flashcard.front || '复习闪卡',
      body: flashcard.back,
      meta: `${flashcard.sourceLabel} · ${flashcard.reviewStatus ?? 'new'}`,
      sourceLabel: flashcard.sourceLabel,
      sourceTargetId: flashcard.sourceTargetId,
      createdAt: flashcard.createdAt,
      kind: 'flashcards' as const,
      storage: 'knowledge-flashcard' as const,
      tags: flashcard.tags,
      reviewStatus: flashcard.reviewStatus,
    })),
  ];
}

export function buildReaderKnowledgeItems(highlights: ReaderHighlight[], bookmarks: ReaderBookmark[]): KnowledgePageItem[] {
  return [
    ...highlights.map((highlight) => ({
      id: `reader-highlight:${highlight.bookId}:${highlight.id}`,
      recordId: highlight.id,
      tab: 'highlights' as const,
      title: '阅读高亮',
      body: highlight.text,
      meta: buildReaderLocationLabel(highlight.chapterIndex, highlight.paragraphIndex),
      sourceLabel: buildReaderLocationLabel(highlight.chapterIndex, highlight.paragraphIndex),
      sourceTargetId: highlight.chapterId || `${highlight.bookId}:chapter:${highlight.chapterIndex}:paragraph:${highlight.paragraphIndex}`,
      createdAt: highlight.createdAt,
      updatedAt: highlight.updatedAt,
      kind: 'highlights' as const,
      storage: 'reader-highlight' as const,
      bookId: highlight.bookId,
      note: highlight.note,
      color: highlight.color,
      tags: highlight.tags,
      importance: highlight.importance,
      reviewStatus: highlight.reviewStatus,
      chapterIndex: highlight.chapterIndex,
      paragraphIndex: highlight.paragraphIndex,
    })),
    ...bookmarks.map((bookmark) => ({
      id: `reader-bookmark:${bookmark.bookId}:${bookmark.id}`,
      recordId: bookmark.id,
      tab: 'notes' as const,
      title: bookmark.title?.trim() || bookmark.label || '阅读书签',
      body: bookmark.note?.trim() || bookmark.label || '',
      meta: buildReaderLocationLabel(bookmark.chapterIndex, bookmark.paragraphIndex),
      sourceLabel: buildReaderLocationLabel(bookmark.chapterIndex, bookmark.paragraphIndex),
      sourceTargetId: bookmark.chapterId || `${bookmark.bookId}:chapter:${bookmark.chapterIndex}:paragraph:${bookmark.paragraphIndex}`,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
      kind: 'bookmarks' as const,
      storage: 'reader-bookmark' as const,
      bookId: bookmark.bookId,
      note: bookmark.note,
      color: bookmark.color,
      tags: bookmark.tags,
      chapterIndex: bookmark.chapterIndex,
      paragraphIndex: bookmark.paragraphIndex,
    })),
  ];
}

export function attachKnowledgeBooks(items: KnowledgePageItem[], books: Book[]): KnowledgePageItem[] {
  const bookById = new Map(books.map((book) => [book.id, book]));
  const bookIds = books.map((book) => book.id).sort((left, right) => right.length - left.length);
  return items.map((item) => {
    const bookId = item.bookId || bookIds.find((candidate) => item.sourceTargetId === candidate || item.sourceTargetId.startsWith(`${candidate}:`));
    const book = bookId ? bookById.get(bookId) : undefined;
    return { ...item, bookId, bookTitle: book?.displayTitle || book?.title || '' };
  });
}

export function buildKnowledgeBookSummaries(books: Book[], items: KnowledgePageItem[]): KnowledgeBookSummary[] {
  return books.filter((book) => !book.deleted).map((book) => {
    const bookItems = items.filter((item) => item.bookId === book.id);
    const colors: KnowledgeBookSummary['colors'] = {};
    bookItems.forEach((item) => {
      if (item.color) colors[item.color] = (colors[item.color] ?? 0) + 1;
    });
    return {
      book,
      total: bookItems.length,
      highlights: bookItems.filter((item) => item.kind === 'highlights').length,
      annotations: bookItems.filter((item) => item.storage === 'reader-highlight' && Boolean(item.note?.trim())).length,
      bookmarks: bookItems.filter((item) => item.kind === 'bookmarks').length,
      notes: bookItems.filter((item) => item.kind === 'notes').length,
      flashcards: bookItems.filter((item) => item.kind === 'flashcards').length,
      latestAt: bookItems.reduce((latest, item) => (item.updatedAt || item.createdAt) > latest ? (item.updatedAt || item.createdAt) : latest, ''),
      colors,
    };
  }).sort((left, right) => right.latestAt.localeCompare(left.latestAt) || right.total - left.total || left.book.displayTitle.localeCompare(right.book.displayTitle));
}

export function buildKnowledgePageItems(input: {
  books: Book[];
  highlights: HighlightRecord[];
  notes: NoteRecord[];
  flashcards: FlashcardRecord[];
  readerHighlights: ReaderHighlight[];
  readerBookmarks: ReaderBookmark[];
}) {
  return attachKnowledgeBooks([
    ...buildReaderKnowledgeItems(input.readerHighlights, input.readerBookmarks),
    ...buildKnowledgeItems(input.highlights, input.notes, input.flashcards),
  ], input.books);
}

export function matchesKnowledgeView(item: KnowledgePageItem, view: KnowledgeView) {
  if (view === 'all') return true;
  if (view === 'annotations') return item.storage === 'reader-highlight' && Boolean(item.note?.trim());
  return item.kind === view;
}

function buildReaderLocationLabel(chapterIndex: number, paragraphIndex: number) {
  return `第 ${chapterIndex + 1} 章 · 第 ${paragraphIndex + 1} 段`;
}

export function matchesKnowledgeQuery(item: KnowledgePageItem, query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [item.title, item.body, item.meta, item.sourceLabel, item.sourceTargetId, item.bookTitle, item.note, ...(item.tags ?? [])].some((field) => field?.toLowerCase().includes(value));
}

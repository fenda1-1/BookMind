import type { ReaderChapter } from '../readerChapterParserModel.js';
import type { ReaderBookmark, ReaderHeaderFooterTimeFormat, ReaderHighlightColor, ReaderHighlightImportance, ReaderHighlightReviewStatus, ReaderTitleNumberCleanup, TextChunk } from '../../../types';

export type ReaderTocSearchScope = 'title' | 'content' | 'annotations' | 'bookmarks';

export type ReaderTocEntry = {
  chapter: ReaderChapter;
  kind: 'volume' | 'chapter';
  volumeTitle: string;
  titleGroup: string;
  searchableTitle: string;
  searchableContent: string;
  searchableAnnotations: string;
  searchableBookmarks: string;
  snippet: string;
  matchParagraphIndex: number;
  depth: number;
  parentId: string;
  ancestorIds: string[];
  hasChildren: boolean;
};

export type ReaderTocIndex = {
  entries: ReaderTocEntry[];
};

export type ReaderTocIndexOptions = {
  hierarchyMode?: 'novel' | 'document';
  titleGroupingEnabled?: boolean;
  titleGroupKeywords?: string;
  titleGroupRules?: ReaderTocTitleGroupRule[];
};

export type ReaderTocTitleGroupRule = {
  id: string;
  name: string;
  groupName: string;
  pattern: string;
  enabled: boolean;
  priority: number;
};

export type ReaderTocEditMetadata = {
  parserVersion?: string;
  baseContentHash?: string;
  createdAt?: string;
};

export type ReaderTocEdit =
  | ({ type: 'rename'; chapterId: string; title: string } & ReaderTocEditMetadata)
  | ({ type: 'hide'; chapterId: string } & ReaderTocEditMetadata)
  | ({ type: 'unhide'; chapterId: string } & ReaderTocEditMetadata)
  | ({ type: 'split'; chapterId: string; paragraphIndex: number; title: string } & ReaderTocEditMetadata)
  | ({ type: 'merge-next'; chapterId: string } & ReaderTocEditMetadata);

export type ReaderTocEditConflictReason =
  | 'missing-chapter'
  | 'empty-title'
  | 'split-out-of-range'
  | 'merge-next-missing';

export type ReaderTocEditConflict = {
  edit: ReaderTocEdit;
  reason: ReaderTocEditConflictReason;
  action: 'clamped' | 'dropped';
};

export type ReaderTocEditRepairSummary = {
  keptCount: number;
  droppedCount: number;
  clampedCount: number;
  refreshedHashCount: number;
};

export type ReaderTocEditRepairResult = {
  edits: ReaderTocEdit[];
  conflicts: ReaderTocEditConflict[];
  summary: ReaderTocEditRepairSummary;
};

export type ReaderPageChunk = {
  pageIndex: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
  entries: ReaderPageEntry[];
};

export type ReaderPageEntry = {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
};

type CompactReaderPageEntry = {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
};

type CompactReaderPageChunk = {
  pageIndex: number;
  entries: CompactReaderPageEntry[];
};

export type ReaderVirtualRange = {
  start: number;
  end: number;
  before: number;
  after: number;
};

const paginationAlgorithmVersion = 1;
const parserVersion = 1;
const fontVersion = 1;

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export type ReaderHighlightGroup<T extends ReaderHighlightRange = ReaderHighlightRange> = {
  chapterIndex: number;
  items: T[];
};
export type ReaderLocation = {
  bookId?: string;
  chapterId?: string;
  chapterIndex?: number;
  sourceChapterIndex?: number;
  visibleChapterPosition?: number;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
  chunkId?: string;
  contentHash?: string;
  parserVersion?: string;
};

export type ReaderResolvedLocation =
  | { status: 'ok'; location: ReaderLocation & { visibleChapterPosition: number; paragraphIndex: number; startOffset: number; endOffset: number } }
  | { status: 'chapter-hidden-or-missing' | 'paragraph-missing' | 'offset-out-of-range' };

export type ReaderStreamPage = {
  streamIndex: number;
  chapterId: string;
  chapterIndex: number;
  visibleChapterPosition: number;
  pageInChapter: number;
  chunk: ReaderPageChunk;
};

export type ReaderHighlightFilter = {
  query?: string;
  queryScope?: 'all' | 'text' | 'note' | 'context';
  chapterTitles?: ReadonlyMap<number, string>;
  color?: ReaderHighlightColor | 'all';
  chapterIndex?: number | 'all';
  chapterRange?: number[];
  hasNote?: boolean | 'all';
  tag?: string | 'all';
  importance?: ReaderHighlightImportance | 'all';
  reviewStatus?: ReaderHighlightReviewStatus | 'all';
  normalizeNfkc?: boolean;
  normalizeTraditionalChinese?: boolean;
  pinyinInitials?: boolean;
};

export type ReaderHighlightSortKey =
  | 'reading-order'
  | 'chapter-asc'
  | 'created-asc'
  | 'created-desc'
  | 'updated-desc'
  | 'text-length-asc'
  | 'text-length-desc'
  | 'color-asc'
  | 'note-first';

export type ReaderHighlightOverlapStrategy = 'first-start-longest' | 'latest-created' | 'highest-importance';

export type ReaderHighlightRange = {
  id?: string;
  chapterIndex: number;
  chapterId?: string;
  sourceChapterIndex?: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
  note: string;
  color?: ReaderHighlightColor;
  createdAt?: string;
  updatedAt?: string;
  prefixText?: string;
  suffixText?: string;
  paragraphHash?: string;
  tags?: string[];
  importance?: ReaderHighlightImportance;
  reviewStatus?: ReaderHighlightReviewStatus;
  colorMeaning?: string;
};

export type ReaderAnnotationAnchor = {
  chapterId: string;
  sourceChapterIndex: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  prefixText: string;
  suffixText: string;
  paragraphHash: string;
};

export type ReaderAnchorRepairStrategy = 'context-first' | 'text-first' | 'manual';

export type ReaderResolvedAnnotationAnchor =
  | { status: 'ok'; chapterIndex: number; visibleChapterPosition: number; paragraphIndex: number; startOffset: number; endOffset: number }
  | { status: 'chapter-hidden-or-missing' | 'paragraph-missing' | 'text-not-found' };

export type ReaderSelectionAction = 'highlight' | 'annotate';

export type ReaderSelectionParagraph = {
  location: string;
  pageStartOffset: number;
  text: string;
  selectedText: string;
  localStartOffset: number;
};

export type ReaderSelectionContextSnippet = {
  prefixText: string;
  text: string;
  suffixText: string;
};

export type ReaderPageMeasurementCacheInput = {
  chapterId: string;
  title: string;
  contentSignature: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
  pageWidth: number;
  pageTextHeight: number;
  bodyMarginX: number;
  bodyMarginY: number;
  headerVisible: boolean;
  footerVisible: boolean;
  headerMarginY: number;
  footerMarginY: number;
  timeFormat: ReaderHeaderFooterTimeFormat;
  titleOnlyOnChapterStart: boolean;
  titleNumberCleanup: ReaderTitleNumberCleanup;
  titleFontSize: number;
  titleMarginTop: number;
  titleMarginBottom: number;
  longParagraphStrategy: 'strict' | 'punctuation';
};

export type FloatingContainerRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FloatingMenuSize = {
  width: number;
  height: number;
};

export type ReaderSelectionMenuPlacement = 'top' | 'bottom';

export type ReaderWheelIntent = 'next-page' | 'prev-page' | 'next-chapter' | 'prev-chapter' | 'native-scroll' | 'none';
export type ReaderWheelPageState = { activeScreenPage: number; screenPageCount: number };
export type ReaderChapterPageTarget = { chapterIndex: number; screenPage: number | 'first' | 'last' };
export type ReaderHistoryTarget = { chapterIndex: number; paragraphIndex: number; screenPage: number };

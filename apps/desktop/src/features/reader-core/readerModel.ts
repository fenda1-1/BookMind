import type { Book, Citation, ReaderBookmark, ReaderHeaderFooterTimeFormat, ReaderHighlightColor, ReaderHighlightImportance, ReaderHighlightReviewStatus, ReaderTitleNumberCleanup, TextChunk } from '../../types';
import { getReaderSearchPinyinInitials, normalizeReaderSearchText } from './readerSearchModel.js';
import { getReaderChapterTextStats, getReaderParagraphHash, isVolumeHeading } from './readerChapterParserModel.js';
import { createReaderPageChunk } from './readerModel/pagination.js';
import { normalizeReaderSelectionOffsets } from './readerModel/navigation.js';
import { findVisibleChapterIndexByOriginalIndex } from './readerModel/tocModel.js';
import type { ReaderChapter } from './readerChapterParserModel.js';

export {
  buildReaderChapterDiagnostics,
  buildReaderChapterHashManifest,
  buildReaderChapters,
  buildReaderChaptersFromTocManifest,
  buildReaderTocManifest,
  buildReaderTocManifestFromChapters,
  cleanTxtContent,
  estimateLongParagraphSlices,
  formatReaderChapterTitle,
  getReaderChapterHeadingConfidence,
  getReaderParagraphHash,
  isChapterHeading,
  isReaderTocManifestValidForBook,
  matchReaderChapterRegexRule,
  previewReaderCompactChapterSplit,
  resolveReaderBookTitle,
  summarizeReaderTocManifestDiff,
} from './readerChapterParserModel.js';
export type {
  ReaderChapter,
  ReaderChapterDiagnosticReason,
  ReaderChapterDiagnostics,
  ReaderChapterDiagnosticsOptions,
  ReaderChapterParsingOptions,
  ReaderChapterPreviewEntry,
  ReaderChapterRegexRule,
  ReaderChapterRuleMatch,
  ReaderChapterSizeDiagnostic,
  ReaderChapterUnmatchedSample,
  ReaderTocManifest,
  ReaderTocManifestDiffSummary,
  ReaderTocManifestEntry,
  ReaderTxtCleanupRule,
  TxtCleanupOptions,
} from './readerChapterParserModel.js';

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
};

export type ReaderTocIndex = {
  entries: ReaderTocEntry[];
};

export type ReaderTocIndexOptions = {
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

export {
  buildReaderSearchIndex,
  createReaderSearchExecution,
  normalizeReaderSearchText,
  searchReaderChapter,
  searchReaderIndex,
} from './readerSearchModel.js';
export {
  buildReaderEpubNoteLabelMap,
  isReaderImageOnlyParagraph,
  parseReaderRichContentParagraph,
} from './readerRichContentModel.js';
export type {
  ReaderRichContentPart,
} from './readerRichContentModel.js';
export type {
  ReaderChapterSearchHit,
  ReaderSearchHit,
  ReaderSearchIndex,
  ReaderSearchExecution,
  ReaderSearchOptions,
  ReaderSearchScope,
  ReaderSearchStepResult,
} from './readerSearchModel.js';
export {
  deserializeReaderAnnotationsJson,
  filterReaderAnnotationExportContent,
  formatReaderAnnotationsCsv,
  formatReaderAnnotationsJson,
  formatReaderAnnotationsLogseqMarkdown,
  formatReaderAnnotationsMarkdown,
  formatReaderAnnotationsObsidianMarkdown,
  formatReaderAnnotationsReadwiseCsv,
  formatReaderHighlightsAnkiCsv,
  formatReaderHighlightsMarkdown,
  mergeReaderAnnotationsImport,
  previewReaderAnnotationsImport,
  readerAnnotationCsvFields,
  serializeReaderAnnotationsJson,
} from './readerAnnotationsModel.js';
export type {
  ReaderAnnotationCsvField,
  ReaderAnnotationExportContent,
  ReaderAnnotationJsonImportConflictStrategy,
  ReaderAnnotationsImportPreview,
  ReaderAnnotationsImportResult,
  ReaderAnnotationsPayload,
} from './readerAnnotationsModel.js';
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

export type ReaderWheelIntent = 'next-page' | 'prev-page' | 'next-chapter' | 'prev-chapter' | 'native-scroll' | 'none';
export type ReaderChapterPageTarget = { chapterIndex: number; screenPage: number | 'first' | 'last' };
export type ReaderHistoryTarget = { chapterIndex: number; paragraphIndex: number; screenPage: number };
export type ReaderWheelPageState = { activeScreenPage: number; screenPageCount: number };
export function createReaderLocation(location: ReaderLocation): ReaderLocation {
  return { ...location };
}

export function resolveReaderLocation(location: ReaderLocation, chapters: ReaderChapter[]): ReaderResolvedLocation {
  const visibleChapterPosition = resolveReaderLocationChapterPosition(location, chapters);
  if (visibleChapterPosition < 0) return { status: 'chapter-hidden-or-missing' };
  const chapter = chapters[visibleChapterPosition];
  const paragraphIndex = Math.min(Math.max(0, Math.floor(location.paragraphIndex ?? 0)), Math.max(0, chapter.paragraphs.length - 1));
  const paragraph = chapter.paragraphs[paragraphIndex];
  if (paragraph === undefined) return { status: 'paragraph-missing' };
  const startOffset = Math.min(Math.max(0, Math.floor(location.startOffset ?? 0)), paragraph.length);
  const endOffset = Math.min(Math.max(startOffset, Math.floor(location.endOffset ?? startOffset)), paragraph.length);
  return {
    status: 'ok',
    location: {
      ...location,
      chapterId: chapter.id,
      sourceChapterIndex: chapter.index,
      visibleChapterPosition,
      paragraphIndex,
      startOffset,
      endOffset,
    },
  };
}

function resolveReaderLocationChapterPosition(location: ReaderLocation, chapters: ReaderChapter[]) {
  if (location.chapterId) {
    const byId = chapters.findIndex((chapter) => chapter.id === location.chapterId);
    if (byId >= 0) return byId;
    return -1;
  }
  if (typeof location.sourceChapterIndex === 'number') {
    const bySource = chapters.findIndex((chapter) => chapter.index === location.sourceChapterIndex);
    if (bySource >= 0) return bySource;
  }
  if (typeof location.chapterIndex === 'number') {
    const byChapterIndex = chapters.findIndex((chapter) => chapter.index === location.chapterIndex);
    if (byChapterIndex >= 0) return byChapterIndex;
  }
  if (typeof location.visibleChapterPosition === 'number') {
    const position = Math.floor(location.visibleChapterPosition);
    if (position >= 0 && position < chapters.length) return position;
  }
  return chapters.length ? 0 : -1;
}

function getHiddenChapterIds(edits: ReaderTocEdit[]) {
  const hiddenIds = new Set<string>();
  for (const edit of edits) {
    if (edit.type === 'hide') hiddenIds.add(edit.chapterId);
    if (edit.type === 'unhide') hiddenIds.delete(edit.chapterId);
  }
  return hiddenIds;
}

// Pagination functions extracted to ./readerModel/pagination.js — re-exported for backward compatibility
export {
  estimateReaderPages,
  findReaderParagraphPageBreak,
  buildReaderFontFamily,
  buildReaderPageStream,
  buildReaderPageStreamWithOverrides,
  getReaderSpreadPages,
  findReaderStreamPageIndex,
  createReaderPageChunk,
} from './readerModel/pagination.js';
export {
  updateReaderHighlightColor,
  updateReaderHighlightNote,
  shouldCreateReaderAnnotationFromNote,
  updateReaderHighlightDetails,
  deleteReaderHighlight,
  resolveReaderHighlightColor,
  getReaderHighlightIndexKey,
  createReaderHighlightIndex,
  groupReaderHighlightsByChapter,
  filterReaderHighlights,
  sortReaderHighlights,
  createReaderBookmark,
  updateReaderBookmarkDetails,
  deleteReaderBookmark,
} from './readerModel/annotations.js';
export {
  getReaderHistoryTarget,
  getFloatingMenuPosition,
  getReaderFixedMenuPosition,
  getReaderSelectionMenuPosition,
  resolveReaderEffectivePageMode,
  getReaderPageMeasurementCacheKey,
  computeReaderProgress,
  getReaderChapterCharacterCount,
  getReaderChapterContentSignature,
  createReaderHistoryStack,
  createReaderGoalProgress,
  createReaderContentCacheKey,
  scheduleReaderPaginationPreheat,
  createReaderPendingRepairAnnotation,
  migrateReaderAnchorsForContentHash,
  linkReaderHighlightToKnowledge,
  createReaderAnnotationDerivative,
  getReaderWheelIntent,
  getReaderWheelPageState,
  shouldShowChapterStartBlock,
  resolveReaderPageWidth,
  resolveReaderSpreadPageWidth,
  getReaderPageTextHeight,
  getVisibleHighlightSegments,
  normalizeReaderSelectionOffsets,
  resolveReaderAnnotationAnchor,
  resolveReaderAnnotationAnchorAfterTocEdits,
} from './readerModel/navigation.js';
export {
  filterReaderChapters,
  createReaderTocIndex,
  filterReaderTocEntries,
  getChapterLocation,
  findChapterIndexForLocation,
  applyTocEdits,
  createReaderTocEdit,
  getReaderTocEditHashStatus,
  repairReaderTocEdits,
  getHiddenReaderChapters,
  findVisibleChapterIndexByOriginalIndex,
} from './readerModel/tocModel.js';

export function getVirtualChapterRange(chapters: ReaderChapter[], activeIndex: number, radius: number): ReaderVirtualRange {
  const start = Math.max(0, activeIndex - radius);
  const end = Math.min(chapters.length, activeIndex + radius + 1);
  return { start, end, before: start, after: Math.max(0, chapters.length - end) };
}

export function getFlowReaderChapterRange(
  chapters: ReaderChapter[],
  activeIndex: number,
  radius: number,
  options: { bookFormat?: string; fullRenderChapterLimit?: number } = {},
): ReaderVirtualRange {
  const fullRenderChapterLimit = options.fullRenderChapterLimit ?? 0;
  if (fullRenderChapterLimit > 0 && chapters.length <= fullRenderChapterLimit) {
    return { start: 0, end: chapters.length, before: 0, after: 0 };
  }
  const start = Math.min(Math.max(0, activeIndex), Math.max(0, chapters.length));
  const end = Math.min(chapters.length, start + Math.max(0, radius) + 1);
  return { start, end, before: start, after: Math.max(0, chapters.length - end) };
}

export function createHighlightRange(chapterIndex: number, paragraphIndex: number, startOffset: number, endOffset: number, text: string, note = '', color: ReaderHighlightColor = 'yellow'): ReaderHighlightRange {
  return { chapterIndex, paragraphIndex, startOffset, endOffset, text, note, color };
}

export function createReaderAnnotationAnchor(chapter: ReaderChapter, paragraphIndex: number, startOffset: number, endOffset: number): ReaderAnnotationAnchor {
  const paragraph = chapter.paragraphs[paragraphIndex] ?? '';
  const safeStart = Math.min(Math.max(0, startOffset), paragraph.length);
  const safeEnd = Math.min(Math.max(safeStart, endOffset), paragraph.length);
  return {
    chapterId: chapter.id,
    sourceChapterIndex: chapter.index,
    paragraphIndex,
    startOffset: safeStart,
    endOffset: safeEnd,
    prefixText: paragraph.slice(Math.max(0, safeStart - 24), safeStart),
    suffixText: paragraph.slice(safeEnd, Math.min(paragraph.length, safeEnd + 24)),
    paragraphHash: getReaderParagraphHash(paragraph),
  };
}


export function createReaderSelectionHighlightRange(location: string, startOffset: number, endOffset: number, text: string, action: ReaderSelectionAction, note = '', color: ReaderHighlightColor = 'yellow'): ReaderHighlightRange {
  const [chapterIndex, paragraphIndex] = location.split(':').map((value) => Number(value));
  return createHighlightRange(
    Number.isFinite(chapterIndex) ? chapterIndex : 0,
    Number.isFinite(paragraphIndex) ? paragraphIndex : 0,
    startOffset,
    endOffset,
    text,
    action === 'annotate' ? note : '',
    color,
  );
}

export function appendReaderLocationToAnnotationNote(note: string, location: Pick<ReaderHighlightRange, 'chapterIndex' | 'paragraphIndex' | 'startOffset' | 'endOffset'>) {
  const readerLocation = `reader://${location.chapterIndex}/${location.paragraphIndex}?start=${location.startOffset}&end=${location.endOffset}`;
  const trimmedNote = note.trim();
  return trimmedNote ? `${trimmedNote}\n\nLocation: ${readerLocation}` : `Location: ${readerLocation}`;
}

export function getReaderSelectionContextSnippet(selection: ReaderSelectionParagraph, range: Pick<ReaderHighlightRange, 'startOffset' | 'endOffset' | 'text'>, radius = 24): ReaderSelectionContextSnippet {
  const localStart = Math.min(Math.max(0, range.startOffset - selection.pageStartOffset), selection.text.length);
  const localEnd = Math.min(Math.max(localStart, range.endOffset - selection.pageStartOffset), selection.text.length);
  const text = selection.text.slice(localStart, localEnd) || range.text;
  return {
    prefixText: selection.text.slice(Math.max(0, localStart - radius), localStart),
    text,
    suffixText: selection.text.slice(localEnd, Math.min(selection.text.length, localEnd + radius)),
  };
}

export function appendReaderContextToAnnotationNote(note: string, context: ReaderSelectionContextSnippet) {
  const contextText = `${context.prefixText}[${context.text}]${context.suffixText}`;
  const trimmedNote = note.trim();
  return trimmedNote ? `${trimmedNote}\n\nContext: ${contextText}` : `Context: ${contextText}`;
}

export function applyReaderAnnotationNoteTemplate(template: string, selectedText: string) {
  if (!template.trim()) return '';
  return template.replace(/\{text\}/g, selectedText);
}

export function buildReaderSelectionRanges(selection: ReaderSelectionParagraph[], action: ReaderSelectionAction, note = '', color: ReaderHighlightColor = 'yellow'): ReaderHighlightRange[] {
  return selection.flatMap((item) => {
    const normalized = normalizeReaderSelectionOffsets(item.text, item.localStartOffset, item.selectedText);
    if (!normalized.text) return [];
    return [createReaderSelectionHighlightRange(
      item.location,
      item.pageStartOffset + normalized.startOffset,
      item.pageStartOffset + normalized.endOffset,
      normalized.text,
      action,
      note,
      color,
    )];
  });
}

export function getAdjacentReaderPageTarget(direction: 'next' | 'prev', activeChapterIndex: number, activeScreenPage: number, screenPageCount: number, chapterCount: number): ReaderChapterPageTarget {
  if (direction === 'next') {
    if (activeScreenPage < screenPageCount - 1) return { chapterIndex: activeChapterIndex, screenPage: activeScreenPage + 1 };
    return { chapterIndex: Math.min(activeChapterIndex + 1, Math.max(0, chapterCount - 1)), screenPage: 'first' };
  }
  if (activeScreenPage > 0) return { chapterIndex: activeChapterIndex, screenPage: activeScreenPage - 1 };
  return { chapterIndex: Math.max(0, activeChapterIndex - 1), screenPage: 'last' };
}

// Highlight CRUD functions extracted to ./readerModel/annotations.js — re-exported above
export function findReaderLocationForCitation(citation: Citation, chapters: ReaderChapter[], chunks: TextChunk[] = []): ReaderResolvedLocation {
  const explicitLocation = citationToReaderLocation(citation);
  if (explicitLocation) {
    const resolved = resolveReaderLocation(explicitLocation, chapters);
    if (resolved.status === 'ok') return resolved;
  }
  const matchingChunk = chunks.find((chunk) => chunk.id === citation.chunkId || chunk.id === citation.targetId);
  const targetText = (matchingChunk?.text || citation.text).trim();
  const targetChapterTitle = matchingChunk?.chapter || getCitationChapterTitleHint(citation.label);
  const chapterCandidates = chapters
    .map((chapter, visibleChapterPosition) => ({ chapter, visibleChapterPosition }))
    .filter(({ chapter }) => !targetChapterTitle || chapter.title.includes(targetChapterTitle) || targetChapterTitle.includes(chapter.title));
  const candidates = chapterCandidates.length ? chapterCandidates : chapters.map((chapter, visibleChapterPosition) => ({ chapter, visibleChapterPosition }));
  const normalizedTarget = normalizeReaderSearchText(targetText);
  const fuzzyMatchPlan = createFuzzyCitationMatchPlan(targetText);
  for (const { chapter, visibleChapterPosition } of candidates) {
    for (let paragraphIndex = 0; paragraphIndex < chapter.paragraphs.length; paragraphIndex += 1) {
      const paragraph = chapter.paragraphs[paragraphIndex];
      const normalizedParagraph = normalizeReaderSearchText(paragraph);
      const normalizedIndex = normalizedTarget ? normalizedParagraph.indexOf(normalizedTarget) : -1;
      const rawIndex = targetText ? paragraph.indexOf(targetText) : -1;
      const match = rawIndex >= 0
          ? { startOffset: rawIndex, endOffset: rawIndex + targetText.length }
          : normalizedIndex >= 0
            ? { startOffset: normalizedIndex, endOffset: normalizedIndex + targetText.length }
          : findFuzzyCitationTextMatch(paragraph, fuzzyMatchPlan);
      if (match) {
        return {
          status: 'ok',
          location: {
            chapterId: chapter.id,
            sourceChapterIndex: chapter.index,
            visibleChapterPosition,
            paragraphIndex,
            startOffset: match.startOffset,
            endOffset: Math.min(paragraph.length, match.endOffset),
            chunkId: matchingChunk?.id ?? citation.targetId,
          },
        };
      }
    }
  }
  return { status: 'chapter-hidden-or-missing' };
}

type FuzzyCitationMatchPlan = {
  rawTarget: string;
  normalizedTarget: string;
  rawFragments: string[];
  normalizedFragments: string[];
  rawAnchors: string[];
};

function createFuzzyCitationMatchPlan(targetText: string): FuzzyCitationMatchPlan | null {
  const rawTarget = targetText.trim();
  if (!rawTarget) return null;
  const normalizedTarget = normalizeCitationComparableText(rawTarget).text;
  if (normalizedTarget.length < 4) return null;
  const rawFragments = rawTarget
    .split(/[\s，。！？；：、,.!?;:"“”‘’（）()\[\]【】《》<>]+/u)
    .map((fragment) => ({ raw: fragment.trim(), normalized: normalizeCitationComparableText(fragment).text }))
    .filter((fragment) => fragment.normalized.length >= 6)
    .sort((left, right) => right.normalized.length - left.normalized.length);
  const normalizedFragments = rawFragments.map((fragment) => fragment.normalized);
  const fragments = rawFragments.map((fragment) => fragment.raw);
  const rawAnchors = buildCitationRawAnchors(normalizedTarget);
  return { rawTarget, normalizedTarget, rawFragments: fragments, normalizedFragments, rawAnchors };
}

function findFuzzyCitationTextMatch(paragraph: string, plan: FuzzyCitationMatchPlan | null): { startOffset: number; endOffset: number } | null {
  if (!plan) return null;
  if (!hasRawCitationCandidateOverlap(paragraph, plan)) return null;
  const normalizedParagraph = normalizeCitationComparableText(paragraph);
  if (plan.normalizedTarget.length < 4 || normalizedParagraph.text.length < 4) return null;
  const directComparableIndex = normalizedParagraph.text.indexOf(plan.normalizedTarget);
  if (directComparableIndex >= 0) {
    return comparableRangeToRawRange(normalizedParagraph.map, directComparableIndex, plan.normalizedTarget.length);
  }
  const fragmentMatch = findLongestCitationFragmentMatch(paragraph, plan, normalizedParagraph);
  if (fragmentMatch) return fragmentMatch;
  return findBestCitationSimilarityWindow(normalizedParagraph, plan.normalizedTarget);
}

function findLongestCitationFragmentMatch(
  paragraph: string,
  plan: FuzzyCitationMatchPlan,
  normalizedParagraph: { text: string; map: number[] },
) {
  for (let index = 0; index < plan.rawFragments.length; index += 1) {
    const fragment = plan.rawFragments[index];
    const normalizedFragment = plan.normalizedFragments[index] ?? '';
    const rawIndex = paragraph.indexOf(fragment);
    const score = normalizedFragment.length / Math.max(1, plan.normalizedTarget.length);
    if (rawIndex >= 0 && score >= 0.6) return { startOffset: rawIndex, endOffset: rawIndex + fragment.length };
    const normalizedIndex = normalizedParagraph.text.indexOf(normalizedFragment);
    if (normalizedIndex >= 0 && score >= 0.6) return comparableRangeToRawRange(normalizedParagraph.map, normalizedIndex, normalizedFragment.length);
  }
  return null;
}

function buildCitationRawAnchors(normalizedTarget: string) {
  const anchorLength = normalizedTarget.length >= 12 ? 4 : 3;
  const anchors: string[] = [];
  for (let index = 0; index + anchorLength <= normalizedTarget.length; index += anchorLength) {
    anchors.push(normalizedTarget.slice(index, index + anchorLength));
  }
  return anchors;
}

function hasRawCitationCandidateOverlap(paragraph: string, plan: FuzzyCitationMatchPlan) {
  if (paragraph.includes(plan.rawTarget)) return true;
  if (plan.rawFragments.some((fragment) => paragraph.includes(fragment))) return true;
  return plan.rawAnchors.some((anchor) => paragraph.includes(anchor));
}

function findBestCitationSimilarityWindow(normalizedParagraph: { text: string; map: number[] }, normalizedTarget: string) {
  const targetLength = normalizedTarget.length;
  if (targetLength < 8) return null;
  if (!hasCitationAnchorOverlap(normalizedParagraph.text, normalizedTarget)) return null;
  const best = getLongestCommonSubstringMatch(normalizedTarget, normalizedParagraph.text);
  if (!best) return null;
  const score = best.length / Math.max(targetLength, 1);
  return score >= 0.6 ? comparableRangeToRawRange(normalizedParagraph.map, best.rightIndex, best.length) : null;
}

function hasCitationAnchorOverlap(normalizedParagraph: string, normalizedTarget: string) {
  const anchorLength = normalizedTarget.length >= 12 ? 4 : 3;
  for (let index = 0; index + anchorLength <= normalizedTarget.length; index += 1) {
    if (normalizedParagraph.includes(normalizedTarget.slice(index, index + anchorLength))) return true;
  }
  return false;
}

function normalizeCitationComparableText(text: string) {
  let normalized = '';
  const map: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = normalizeReaderSearchText(text[index] ?? '');
    if (!/[\p{L}\p{N}]/u.test(char)) continue;
    normalized += char;
    map.push(index);
  }
  return { text: normalized, map };
}

function comparableRangeToRawRange(map: number[], start: number, length: number) {
  const rawStart = map[start] ?? 0;
  const rawEndChar = map[Math.min(map.length - 1, start + Math.max(1, length) - 1)] ?? rawStart;
  return { startOffset: rawStart, endOffset: rawEndChar + 1 };
}

function getLongestCommonSubstringMatch(left: string, right: string) {
  let best = 0;
  let bestRightIndex = 0;
  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1] ? previous[rightIndex - 1] + 1 : 0;
      if (current[rightIndex] > best) {
        best = current[rightIndex];
        bestRightIndex = rightIndex - best;
      }
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }
  return best > 0 ? { length: best, rightIndex: bestRightIndex } : null;
}

function getCitationChapterTitleHint(label: string) {
  const value = label.trim();
  if (!value) return '';
  return /第\s*[\d一二三四五六七八九十百千万零〇两]+\s*[章节卷回]|chapter|section|volume|part/i.test(value) ? value : '';
}

function citationToReaderLocation(citation: Citation): ReaderLocation | null {
  const hasExplicitLocation = Boolean(citation.chapterId)
    || typeof citation.sourceChapterIndex === 'number'
    || typeof citation.chapterIndex === 'number'
    || typeof citation.visibleChapterPosition === 'number'
    || typeof citation.paragraphIndex === 'number';
  if (!hasExplicitLocation) return parseCitationTargetLocation(citation.targetId, citation);
  return createReaderLocation({
    bookId: citation.bookId,
    chapterId: citation.chapterId,
    chapterIndex: citation.chapterIndex,
    sourceChapterIndex: citation.sourceChapterIndex ?? citation.chapterIndex,
    visibleChapterPosition: citation.visibleChapterPosition,
    paragraphIndex: citation.paragraphIndex,
    startOffset: citation.startOffset,
    endOffset: citation.endOffset,
    chunkId: citation.chunkId || citation.targetId,
  });
}

function parseCitationTargetLocation(targetId: string, citation: Citation): ReaderLocation | null {
  const parts = targetId.split(':');
  if (parts.length < 3) return null;
  const [bookId, chapterId, paragraph, start, end] = parts;
  const paragraphIndex = Number(paragraph);
  if (!chapterId || !Number.isFinite(paragraphIndex)) return null;
  const startOffset = Number(start);
  const endOffset = Number(end);
  return createReaderLocation({
    bookId: citation.bookId ?? bookId,
    chapterId,
    paragraphIndex,
    startOffset: Number.isFinite(startOffset) ? startOffset : citation.startOffset,
    endOffset: Number.isFinite(endOffset) ? endOffset : citation.endOffset,
    chunkId: citation.chunkId,
  });
}

export function serializeReaderPageChunks(chunks: ReaderPageChunk[]) {
  return JSON.stringify(chunks.map((chunk) => ({
    pageIndex: chunk.pageIndex,
    entries: chunk.entries.map(({ paragraphIndex, startOffset, endOffset }) => ({ paragraphIndex, startOffset, endOffset })),
  } satisfies CompactReaderPageChunk)));
}

export function deserializeReaderPageChunks(raw: string, chapter?: ReaderChapter): ReaderPageChunk[] {
  try {
    const parsed = JSON.parse(raw) as Array<Partial<ReaderPageChunk> & { entries?: Array<Partial<ReaderPageEntry>> }>;
    if (!Array.isArray(parsed)) return [];
    let invalidCache = false;
    const chunks = parsed.flatMap((chunk) => {
      if (!Number.isFinite(chunk.pageIndex) || !Array.isArray(chunk.entries)) {
        invalidCache = true;
        return [];
      }
      const entries = chunk.entries.flatMap((entry) => {
        const paragraphIndex = Number(entry.paragraphIndex);
        const startOffset = Number(entry.startOffset);
        const endOffset = Number(entry.endOffset);
        if (!Number.isFinite(paragraphIndex) || !Number.isFinite(startOffset) || !Number.isFinite(endOffset)) {
          invalidCache = true;
          return [];
        }
        if (startOffset < 0 || endOffset <= startOffset) {
          invalidCache = true;
          return [];
        }
        const paragraph = chapter?.paragraphs[paragraphIndex];
        if (typeof paragraph === 'string' && endOffset > paragraph.length) {
          invalidCache = true;
          return [];
        }
        const sourceText = typeof paragraph === 'string'
          ? paragraph.slice(startOffset, endOffset)
          : typeof entry.text === 'string' ? entry.text : undefined;
        if (typeof sourceText !== 'string') {
          invalidCache = true;
          return [];
        }
        return [{ paragraphIndex, startOffset, endOffset, text: sourceText }];
      });
      if (!entries.length) invalidCache = true;
      return entries.length ? [createReaderPageChunk(Number(chunk.pageIndex), entries)] : [];
    });
    return invalidCache || hasInvalidReaderPageChunks(chunks) ? [] : chunks;
  } catch {
    return [];
  }
}

export function hasInvalidReaderPageChunks(chunks: ReaderPageChunk[]) {
  const lastEndByParagraph = new Map<number, number>();
  for (const chunk of chunks) {
    for (const entry of chunk.entries) {
      if (!Number.isFinite(entry.paragraphIndex) || !Number.isFinite(entry.startOffset) || !Number.isFinite(entry.endOffset)) return true;
      if (entry.startOffset < 0 || entry.endOffset <= entry.startOffset) return true;
      const previousEnd = lastEndByParagraph.get(entry.paragraphIndex);
      if (previousEnd !== undefined && entry.startOffset < previousEnd) return true;
      lastEndByParagraph.set(entry.paragraphIndex, entry.endOffset);
    }
  }
  return false;
}

export function getVirtualParagraphRange(paragraphCount: number, activeParagraphIndex: number, radius: number): ReaderVirtualRange {
  const safeCount = Math.max(0, Math.floor(paragraphCount));
  const safeActive = Math.min(Math.max(0, Math.floor(activeParagraphIndex)), Math.max(0, safeCount - 1));
  const safeRadius = Math.max(0, Math.floor(radius));
  const start = Math.max(0, safeActive - safeRadius);
  const end = Math.min(safeCount, safeActive + safeRadius + 1);
  return { start, end, before: start, after: Math.max(0, safeCount - end) };
}

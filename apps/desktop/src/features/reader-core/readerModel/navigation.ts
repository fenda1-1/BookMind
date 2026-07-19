import type { ReaderBookmark, ReaderHighlightImportance } from '../../../types';
import type { ReaderChapter } from '../readerChapterParserModel.js';
import { getReaderChapterTextStats } from '../readerChapterParserModel.js';
import { normalizeReaderSearchText } from '../readerSearchModel.js';
import type { FloatingContainerRect, FloatingMenuSize, ReaderAnchorRepairStrategy, ReaderAnnotationAnchor, ReaderHighlightOverlapStrategy, ReaderHighlightRange, ReaderHistoryTarget, ReaderPageMeasurementCacheInput, ReaderResolvedAnnotationAnchor, ReaderSelectionMenuPlacement, ReaderSelectionParagraph, ReaderTocSearchScope, ReaderWheelIntent, ReaderWheelPageState } from './types.js';
import { getReaderParagraphHash } from '../readerChapterParserModel.js';
import { findVisibleChapterIndexByOriginalIndex } from './tocModel.js';

const parserVersion = 1;
const paginationAlgorithmVersion = 6;
const fontVersion = 1;

export function getReaderHistoryTarget(history: ReaderHistoryTarget[], direction: 'back' | 'forward') {
  if (!history.length) return null;
  return direction === 'back' ? history[Math.max(0, history.length - 2)] ?? history[0] : history[history.length - 1];
}

export function getFloatingMenuPosition(clientX: number, clientY: number, container: FloatingContainerRect, menu: FloatingMenuSize) {
  const padding = 8;
  const maxX = Math.max(padding, container.width - menu.width - padding);
  const maxY = Math.max(padding, container.height - menu.height - padding);
  return {
    x: Math.min(Math.max(padding, clientX - container.left), maxX),
    y: Math.min(Math.max(padding, clientY - container.top), maxY),
  };
}

export function getReaderFixedMenuPosition(clientX: number, clientY: number, bounds: { left: number; top: number; right: number; bottom: number }, menu: FloatingMenuSize) {
  const padding = 8;
  const safeLeft = Math.min(bounds.left + padding, bounds.right - padding);
  const safeTop = Math.min(bounds.top + padding, bounds.bottom - padding);
  const maxX = Math.max(safeLeft, bounds.right - menu.width - padding);
  const maxY = Math.max(safeTop, bounds.bottom - menu.height - padding);
  return {
    x: Math.round(Math.min(Math.max(clientX, safeLeft), maxX)),
    y: Math.round(Math.min(Math.max(clientY, safeTop), maxY)),
  };
}

export function getReaderSelectionMenuPosition(selection: { left: number; right: number; top: number; bottom: number }, container: FloatingContainerRect, menu: FloatingMenuSize): { x: number; y: number; placement: ReaderSelectionMenuPlacement } {
  const padding = 8;
  const gap = 12;
  const centerX = (selection.left + selection.right) / 2 - container.left;
  const belowY = selection.bottom - container.top + gap;
  const aboveY = selection.top - container.top - menu.height - gap;
  const x = Math.min(Math.max(padding, centerX - menu.width / 2), Math.max(padding, container.width - menu.width - padding));
  const canOpenBelow = belowY + menu.height + padding <= container.height;
  const placement: ReaderSelectionMenuPlacement = canOpenBelow ? 'bottom' : 'top';
  const preferredY = placement === 'top' ? aboveY : belowY;
  const maxY = Math.max(padding, container.height - menu.height - padding);
  const y = Math.min(Math.max(padding, preferredY), maxY);
  return { x: Math.round(x), y: Math.round(y), placement };
}

export function resolveReaderEffectivePageMode(pageMode: 'single' | 'double', availableWidth: number, minimumPageWidth: number) {
  if (pageMode !== 'double') return 'single';
  return availableWidth >= minimumPageWidth * 2 + 120 ? 'double' : 'single';
}

export function getReaderPageMeasurementCacheKey(input: ReaderPageMeasurementCacheInput) {
  return [
    `pagination:v${paginationAlgorithmVersion}`,
    `parser:v${parserVersion}`,
    `font:v${fontVersion}`,
    input.chapterId,
    input.title,
    input.contentSignature,
    input.fontFamily,
    input.fontSize,
    input.letterSpacing,
    input.lineHeight,
    input.paragraphSpacing,
    input.firstLineIndent,
    Math.round(input.pageWidth),
    Math.round(input.pageTextHeight),
    input.bodyMarginX,
    input.bodyMarginY,
    input.headerVisible ? 1 : 0,
    input.footerVisible ? 1 : 0,
    input.headerMarginY,
    input.footerMarginY,
    input.timeFormat,
    input.titleOnlyOnChapterStart ? 1 : 0,
    input.titleNumberCleanup,
    input.titleFontSize,
    input.titleMarginTop,
    input.titleMarginBottom,
    input.longParagraphStrategy,
  ].join('|');
}

export function computeReaderProgress(input: { chapterIndex: number; paragraphIndex?: number; chapters: ReaderChapter[] }) {
  const totalCharacters = Math.max(1, input.chapters.reduce((sum, chapter) => sum + getReaderChapterCharacterCount(chapter), 0));
  let beforeCharacters = 0;
  for (let index = 0; index < input.chapterIndex; index += 1) {
    beforeCharacters += getReaderChapterCharacterCount(input.chapters[index]);
  }
  const chapter = input.chapters[input.chapterIndex];
  const inChapterCharacters = chapter ? chapter.paragraphs.slice(0, input.paragraphIndex ?? 0).join('').length : 0;
  return Math.min(100, Math.round(((beforeCharacters + inChapterCharacters) / totalCharacters) * 100));
}

export function getReaderChapterCharacterCount(chapter: ReaderChapter | undefined) {
  if (!chapter) return 0;
  return chapter.characterCount ?? chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
}

export function getReaderChapterContentSignature(chapter: ReaderChapter | undefined) {
  if (!chapter) return '0:0:0';
  return chapter.contentSignature ?? getReaderChapterTextStats(chapter.paragraphs).contentSignature;
}

export function createReaderHistoryStack(history: ReaderHistoryTarget[], next: ReaderHistoryTarget, limit = 50) {
  return [...history, next].slice(-Math.max(1, limit));
}

export function createReaderGoalProgress(goal: { pagesPerDay?: number; minutesPerDay?: number; chaptersPerDay?: number }, actual: { pages?: number; minutes?: number; chapters?: number }) {
  return {
    pageRate: goal.pagesPerDay ? Math.min(1, (actual.pages ?? 0) / goal.pagesPerDay) : 0,
    minuteRate: goal.minutesPerDay ? Math.min(1, (actual.minutes ?? 0) / goal.minutesPerDay) : 0,
    chapterRate: goal.chaptersPerDay ? Math.min(1, (actual.chapters ?? 0) / goal.chaptersPerDay) : 0,
  };
}

export function createReaderContentCacheKey(contentHash: string, parser = parserVersion) {
  return `reader-content:${parser}:${contentHash}`;
}

export function scheduleReaderPaginationPreheat(chapters: ReaderChapter[], activeIndex: number, preheat: (chapter: ReaderChapter) => void) {
  [activeIndex - 1, activeIndex, activeIndex + 1].forEach((index) => { const chapter = chapters[index]; if (chapter) preheat(chapter); });
}

export function createReaderPendingRepairAnnotation(anchor: Partial<ReaderAnnotationAnchor>, reason: string) {
  return { ...anchor, anchorStatus: 'pending-repair', repairReason: reason, migrationAttemptedAt: new Date().toISOString() };
}

export function migrateReaderAnchorsForContentHash<T extends Partial<ReaderAnnotationAnchor> & { text?: string }>(anchors: T[], chapters: ReaderChapter[], currentContentHash: string) {
  return anchors.map((anchor) => {
    const resolved = resolveReaderAnnotationAnchor(anchor, chapters);
    return resolved.status === 'ok' ? { ...anchor, contentHash: currentContentHash, anchorStatus: 'ok' } : createReaderPendingRepairAnnotation(anchor, resolved.status);
  });
}

export function linkReaderHighlightToKnowledge(highlightId: string, noteId: string) {
  return { id: `annotation-link-${highlightId}-${noteId}`, sourceType: 'reader-highlight', sourceId: highlightId, targetType: 'knowledge-note', targetId: noteId };
}

export function createReaderAnnotationDerivative(kind: 'note' | 'flashcard' | 'topic', source: { id?: string; text: string; note?: string }) {
  return { id: `reader-derivative-${kind}-${source.id ?? 'selection'}`, kind, text: source.text, note: source.note ?? '' };
}

export function getReaderWheelIntent({ layoutMode, deltaY, deltaMode = 0, wheelPaging = true, touchpadNaturalScroll = true, wheelPagingThresholdPx = 80, activeScreenPage, screenPageCount, atTop, atBottom }: { layoutMode: 'page' | 'flow'; deltaY: number; deltaMode?: number; wheelPaging?: boolean; touchpadNaturalScroll?: boolean; wheelPagingThresholdPx?: number; activeScreenPage: number; screenPageCount: number; atTop: boolean; atBottom: boolean }): ReaderWheelIntent {
  const magnitude = Math.abs(deltaY);
  const pixelThreshold = Math.min(240, Math.max(20, Number.isFinite(wheelPagingThresholdPx) ? Math.floor(wheelPagingThresholdPx) : 80));
  if (!wheelPaging) return layoutMode === 'page' ? 'native-scroll' : 'none';
  if (deltaMode === 0 && magnitude < pixelThreshold) return layoutMode === 'page' ? 'native-scroll' : 'none';
  if (deltaMode !== 0 && magnitude < 1) return 'none';
  if (magnitude < 20 && deltaMode === 0) return 'none';
  const effectiveDeltaY = deltaMode === 0 && !touchpadNaturalScroll ? -deltaY : deltaY;
  if (layoutMode === 'page') {
    if (effectiveDeltaY > 0) return activeScreenPage < screenPageCount - 1 ? 'next-page' : 'next-chapter';
    return activeScreenPage > 0 ? 'prev-page' : 'prev-chapter';
  }
  if (effectiveDeltaY > 0 && atBottom) return 'next-chapter';
  if (effectiveDeltaY < 0 && atTop) return 'prev-chapter';
  return 'native-scroll';
}

export function getReaderWheelPageState({ layoutMode, activeScreenPage, screenPageCount, activeStreamIndex, pageStreamLength }: { layoutMode: 'page' | 'flow'; activeScreenPage: number; screenPageCount: number; activeStreamIndex: number; pageStreamLength: number }): ReaderWheelPageState {
  if (layoutMode === 'page' && pageStreamLength > 0) {
    return {
      activeScreenPage: Math.min(Math.max(0, Math.floor(activeStreamIndex)), Math.max(0, Math.floor(pageStreamLength) - 1)),
      screenPageCount: Math.max(1, Math.floor(pageStreamLength)),
    };
  }
  return {
    activeScreenPage: Math.max(0, Math.floor(activeScreenPage)),
    screenPageCount: Math.max(1, Math.floor(screenPageCount)),
  };
}

export function shouldShowChapterStartBlock(paragraphIndex: number, startOffset: number) {
  return paragraphIndex === 0 && startOffset === 0;
}

export function resolveReaderPageWidth(configuredWidth: number, availableWidth: number) {
  const safeConfiguredWidth = Number.isFinite(configuredWidth) ? configuredWidth : 820;
  const safeAvailableWidth = Number.isFinite(availableWidth) ? availableWidth : safeConfiguredWidth;
  return Math.min(Math.max(320, safeConfiguredWidth), Math.max(320, safeAvailableWidth - 32));
}

export function resolveReaderSpreadPageWidth(configuredWidth: number, availableWidth: number, pageMode: 'single' | 'double', pageGap: number) {
  const singlePageWidth = resolveReaderPageWidth(configuredWidth, availableWidth);
  if (pageMode !== 'double') return singlePageWidth;
  const safeGap = Number.isFinite(pageGap) ? Math.max(0, pageGap) : 0;
  const safeAvailableWidth = Number.isFinite(availableWidth) ? availableWidth : singlePageWidth * 2 + safeGap + 32;
  const doublePageWidth = Math.floor((Math.max(320, safeAvailableWidth - 32) - safeGap) / 2);
  return Math.max(320, Math.min(singlePageWidth, doublePageWidth));
}

export function getReaderPageTextHeight(viewportHeight: number, layout: { headerVisible: boolean; footerVisible: boolean; titleVisible: boolean; bodyMarginY: number; headerMarginY: number; footerMarginY: number; titleFontSize: number; titleMarginTop: number; titleMarginBottom: number }) {
  const headerSpace = layout.headerVisible ? 28 + layout.headerMarginY : 0;
  const footerSpace = layout.footerVisible ? 28 + layout.footerMarginY : 0;
  const titleSpace = layout.titleVisible ? layout.titleFontSize * 1.25 + layout.titleMarginTop + layout.titleMarginBottom : 0;
  const metaSpace = layout.titleVisible ? 42 : 0;
  return Math.max(120, Math.floor(viewportHeight - headerSpace - footerSpace - titleSpace - metaSpace - layout.bodyMarginY * 2 - 24));
}

export function getVisibleHighlightSegments(text: string, highlights: ReaderHighlightRange[], chapterIndex: number, paragraphIndex: number, pageStartOffset: number, options: { overlapStrategy?: ReaderHighlightOverlapStrategy } = {}) {
  const overlapStrategy = options.overlapStrategy ?? 'first-start-longest';
  const visible = highlights
    .filter((item) => item.chapterIndex === chapterIndex && item.paragraphIndex === paragraphIndex && item.endOffset > pageStartOffset && item.startOffset < pageStartOffset + text.length)
    .map((highlight, sourceIndex) => {
      const start = Math.max(0, highlight.startOffset - pageStartOffset);
      const end = Math.min(text.length, highlight.endOffset - pageStartOffset);
      return {
        ...highlight,
        start,
        end,
        text: text.slice(start, end),
        sourceIndex,
      };
    })
    .filter((segment) => segment.end > segment.start);
  const ordered = [...visible].sort((left, right) => compareHighlightOverlapPriority(left, right, overlapStrategy));
  const accepted: typeof visible = [];
  for (const segment of ordered) {
    if (accepted.some((item) => highlightSegmentsOverlap(segment, item))) continue;
    accepted.push(segment);
  }
  return accepted.sort(compareVisibleHighlightReadingOrder).map(({ sourceIndex, ...segment }) => segment);
}

function compareHighlightOverlapPriority(left: { start: number; end: number; startOffset: number; endOffset: number; text: string; createdAt?: string; updatedAt?: string; importance?: ReaderHighlightImportance; sourceIndex: number }, right: { start: number; end: number; startOffset: number; endOffset: number; text: string; createdAt?: string; updatedAt?: string; importance?: ReaderHighlightImportance; sourceIndex: number }, strategy: ReaderHighlightOverlapStrategy) {
  if (strategy === 'latest-created') return getHighlightRecency(right) - getHighlightRecency(left) || compareVisibleHighlightReadingOrder(left, right);
  if (strategy === 'highest-importance') return getHighlightImportanceRank(right.importance) - getHighlightImportanceRank(left.importance) || compareVisibleHighlightReadingOrder(left, right);
  return compareVisibleHighlightReadingOrder(left, right);
}

function compareVisibleHighlightReadingOrder(left: { start: number; end: number; startOffset: number; endOffset: number; text: string; sourceIndex: number }, right: { start: number; end: number; startOffset: number; endOffset: number; text: string; sourceIndex: number }) {
  return left.start - right.start
    || right.end - left.end
    || left.startOffset - right.startOffset
    || right.endOffset - left.endOffset
    || left.text.localeCompare(right.text)
    || left.sourceIndex - right.sourceIndex;
}

function highlightSegmentsOverlap(left: { start: number; end: number }, right: { start: number; end: number }) {
  return left.start < right.end && right.start < left.end;
}

function getHighlightRecency(highlight: { createdAt?: string }) {
  const parsed = Date.parse(highlight.createdAt ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getHighlightImportanceRank(value: ReaderHighlightImportance | undefined) {
  return value === 'critical' ? 3 : value === 'high' ? 2 : 1;
}

export function normalizeReaderSelectionOffsets(paragraphText: string, localStartOffset: number, selectedText: string) {
  const safeStart = Math.min(Math.max(0, Math.floor(localStartOffset)), paragraphText.length);
  const selectedTrimmed = selectedText.trim();
  if (!selectedTrimmed) return { startOffset: safeStart, endOffset: safeStart, text: '' };

  const exactStart = paragraphText.indexOf(selectedTrimmed, safeStart);
  if (exactStart >= 0) {
    return {
      startOffset: exactStart,
      endOffset: exactStart + selectedTrimmed.length,
      text: paragraphText.slice(exactStart, exactStart + selectedTrimmed.length),
    };
  }

  let startOffset = safeStart;
  let endOffset = Math.min(paragraphText.length, safeStart + selectedText.length);
  let text = paragraphText.slice(startOffset, endOffset);
  const leading = text.length - text.trimStart().length;
  const trailing = text.length - text.trimEnd().length;
  startOffset += leading;
  endOffset = Math.max(startOffset, endOffset - trailing);
  text = paragraphText.slice(startOffset, endOffset);

  return { startOffset, endOffset, text };
}
export function resolveReaderAnnotationAnchor(anchor: Partial<ReaderAnnotationAnchor> & { text?: string }, chapters: ReaderChapter[], options: { repairStrategy?: ReaderAnchorRepairStrategy; hiddenChapterIds?: string[] } = {}): ReaderResolvedAnnotationAnchor {
  const visibleChapterPosition = anchor.chapterId
    ? chapters.findIndex((chapter) => chapter.id === anchor.chapterId)
    : findVisibleChapterIndexByOriginalIndex(chapters, anchor.sourceChapterIndex ?? anchor.paragraphIndex ?? 0);
  if (visibleChapterPosition < 0) return { status: 'chapter-hidden-or-missing' };
  const chapter = chapters[visibleChapterPosition];
  const strict = resolveReaderAnnotationAnchorStrict(anchor, chapter, visibleChapterPosition);
  if (strict.status === 'ok' || options.repairStrategy === 'manual') return strict;
  return repairReaderAnnotationAnchor(anchor, chapters, options.repairStrategy ?? 'context-first', strict);
}

function resolveReaderAnnotationAnchorStrict(anchor: Partial<ReaderAnnotationAnchor> & { text?: string }, chapter: ReaderChapter, visibleChapterPosition: number): ReaderResolvedAnnotationAnchor {
  const paragraphIndex = Math.min(Math.max(0, Math.floor(anchor.paragraphIndex ?? 0)), Math.max(0, chapter.paragraphs.length - 1));
  const paragraph = chapter.paragraphs[paragraphIndex];
  if (paragraph === undefined) return { status: 'paragraph-missing' };
  const startOffset = Math.min(Math.max(0, Math.floor(anchor.startOffset ?? 0)), paragraph.length);
  const endOffset = Math.min(Math.max(startOffset, Math.floor(anchor.endOffset ?? startOffset)), paragraph.length);
  if (anchor.paragraphHash === getReaderParagraphHash(paragraph) && paragraph.slice(startOffset, endOffset) === anchor.text) {
    return { status: 'ok', chapterIndex: chapter.index, visibleChapterPosition, paragraphIndex, startOffset, endOffset };
  }
  return { status: 'text-not-found' };
}

export function resolveReaderAnnotationAnchorAfterTocEdits(anchor: Partial<ReaderAnnotationAnchor> & { text?: string }, chapters: ReaderChapter[], options: { repairStrategy?: ReaderAnchorRepairStrategy; hiddenChapterIds?: string[] } = {}): ReaderResolvedAnnotationAnchor {
  const direct = resolveReaderAnnotationAnchor(anchor, chapters, options);
  if (direct.status === 'ok') return direct;
  if (anchor.chapterId && options.hiddenChapterIds?.includes(anchor.chapterId)) return { status: 'text-not-found' };
  if (options.repairStrategy === 'manual') return direct;
  return repairReaderAnnotationAnchor(anchor, chapters, options.repairStrategy ?? 'context-first', direct);
}

function repairReaderAnnotationAnchor(anchor: Partial<ReaderAnnotationAnchor> & { text?: string }, chapters: ReaderChapter[], repairStrategy: Exclude<ReaderAnchorRepairStrategy, 'manual'>, fallback: ReaderResolvedAnnotationAnchor): ReaderResolvedAnnotationAnchor {
  const selectedText = anchor.text ?? '';
  if (!selectedText) return fallback;
  const prefixText = anchor.prefixText ?? '';
  const suffixText = anchor.suffixText ?? '';
  const contextNeedle = `${prefixText}${selectedText}${suffixText}`;
  const contextEnabled = contextNeedle.trim() && contextNeedle !== selectedText;
  const contextMatch = contextEnabled ? findReaderAnnotationAnchorMatch(chapters, contextNeedle, prefixText.length, selectedText.length) : null;
  const textMatch = findReaderAnnotationAnchorMatch(chapters, selectedText, 0, selectedText.length);
  if (repairStrategy === 'text-first') return textMatch ?? contextMatch ?? fallback;
  return contextMatch ?? textMatch ?? fallback;
}

function findReaderAnnotationAnchorMatch(chapters: ReaderChapter[], needle: string, selectedTextOffset: number, selectedTextLength: number): ReaderResolvedAnnotationAnchor | null {
  for (let visibleChapterPosition = 0; visibleChapterPosition < chapters.length; visibleChapterPosition += 1) {
    const chapter = chapters[visibleChapterPosition];
    for (let paragraphIndex = 0; paragraphIndex < chapter.paragraphs.length; paragraphIndex += 1) {
      const paragraph = chapter.paragraphs[paragraphIndex];
      const matchIndex = needle ? paragraph.indexOf(needle) : -1;
      if (matchIndex >= 0) {
        const startOffset = matchIndex + selectedTextOffset;
        return { status: 'ok', chapterIndex: chapter.index, visibleChapterPosition, paragraphIndex, startOffset, endOffset: startOffset + selectedTextLength };
      }
    }
  }
  return null;
}

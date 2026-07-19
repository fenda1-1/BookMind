import type { ReaderHighlightImportance } from '../../../types';
import type { FloatingContainerRect, FloatingMenuSize, ReaderHighlightOverlapStrategy, ReaderHighlightRange, ReaderSelectionMenuPlacement } from './types.js';

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

export function getVisibleHighlightSegments(text: string, highlights: ReaderHighlightRange[], chapterIndex: number, paragraphIndex: number, pageStartOffset: number, options: { overlapStrategy?: ReaderHighlightOverlapStrategy } = {}) {
  const overlapStrategy = options.overlapStrategy ?? 'first-start-longest';
  const visible = highlights
    .filter((item) => item.chapterIndex === chapterIndex && item.paragraphIndex === paragraphIndex && item.endOffset > pageStartOffset && item.startOffset < pageStartOffset + text.length)
    .map((highlight, sourceIndex) => {
      const start = Math.max(0, highlight.startOffset - pageStartOffset);
      const end = Math.min(text.length, highlight.endOffset - pageStartOffset);
      return { ...highlight, start, end, text: text.slice(start, end), sourceIndex };
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

export function normalizeReaderSelectionOffsets(paragraphText: string, localStartOffset: number, selectedText: string) {
  const safeStart = Math.min(Math.max(0, Math.floor(localStartOffset)), paragraphText.length);
  const selectedTrimmed = selectedText.trim();
  if (!selectedTrimmed) return { startOffset: safeStart, endOffset: safeStart, text: '' };
  const exactStart = paragraphText.indexOf(selectedTrimmed, safeStart);
  if (exactStart >= 0) {
    return { startOffset: exactStart, endOffset: exactStart + selectedTrimmed.length, text: paragraphText.slice(exactStart, exactStart + selectedTrimmed.length) };
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

function compareHighlightOverlapPriority(left: { start: number; end: number; startOffset: number; endOffset: number; text: string; createdAt?: string; updatedAt?: string; importance?: ReaderHighlightImportance; sourceIndex: number }, right: { start: number; end: number; startOffset: number; endOffset: number; text: string; createdAt?: string; updatedAt?: string; importance?: ReaderHighlightImportance; sourceIndex: number }, strategy: ReaderHighlightOverlapStrategy) {
  if (strategy === 'latest-created') return getHighlightRecency(right) - getHighlightRecency(left) || compareVisibleHighlightReadingOrder(left, right);
  if (strategy === 'highest-importance') return getHighlightImportanceRank(right.importance) - getHighlightImportanceRank(left.importance) || compareVisibleHighlightReadingOrder(left, right);
  return compareVisibleHighlightReadingOrder(left, right);
}

function compareVisibleHighlightReadingOrder(left: { start: number; end: number; startOffset: number; endOffset: number; text: string; sourceIndex: number }, right: { start: number; end: number; startOffset: number; endOffset: number; text: string; sourceIndex: number }) {
  return left.start - right.start || right.end - left.end || left.startOffset - right.startOffset || right.endOffset - left.endOffset || left.text.localeCompare(right.text) || left.sourceIndex - right.sourceIndex;
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

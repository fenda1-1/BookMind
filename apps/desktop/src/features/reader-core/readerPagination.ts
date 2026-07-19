import type { ReaderPageMode } from '../../types';
import {
  buildReaderPageStream,
  buildReaderPageStreamWithOverrides,
  createReaderPageChunk,
  estimateReaderPages,
  getReaderChapterCharacterCount,
  scheduleReaderPaginationPreheat,
} from './readerModel';
import type { ReaderChapter, ReaderPageChunk, ReaderStreamPage } from './readerModel';

export { buildReaderPageStream, buildReaderPageStreamWithOverrides, createReaderPageChunk, estimateReaderPages, scheduleReaderPaginationPreheat };
export type { ReaderPageChunk, ReaderStreamPage };

export function estimateReaderPageCount(chapter: ReaderChapter, capacity: number) {
  return estimateReaderPageCountFromCharacters(getReaderChapterCharacterCount(chapter), capacity);
}

export function estimateReaderPageCountFromCharacters(characters: number, capacity: number) {
  const safeCapacity = Math.max(1, Math.floor(capacity));
  return Math.max(1, Math.ceil(Math.max(0, characters) / safeCapacity));
}

export function getEstimatedReaderStreamIndex(pageCounts: number[], activeChapterIndex: number, activeScreenPage: number) {
  const safeChapterIndex = Math.min(Math.max(0, Math.floor(activeChapterIndex)), Math.max(0, pageCounts.length - 1));
  let before = 0;
  for (let index = 0; index < safeChapterIndex; index += 1) {
    before += Math.max(1, pageCounts[index] ?? 1);
  }
  return before + Math.min(Math.max(0, Math.floor(activeScreenPage)), Math.max(0, (pageCounts[safeChapterIndex] ?? 1) - 1));
}

export function getReaderPageStreamLength(pageCounts: number[]) {
  return pageCounts.reduce((sum, count) => sum + Math.max(1, Math.floor(count || 1)), 0);
}

export function getReaderChapterPageTargetFromStreamIndex(pageCounts: number[], streamIndex: number) {
  if (!pageCounts.length) return null;
  const safeStreamIndex = Math.max(0, Math.floor(streamIndex));
  let cursor = 0;
  for (let chapterIndex = 0; chapterIndex < pageCounts.length; chapterIndex += 1) {
    const count = Math.max(1, pageCounts[chapterIndex] ?? 1);
    if (safeStreamIndex < cursor + count) {
      return { chapterIndex, screenPage: safeStreamIndex - cursor };
    }
    cursor += count;
  }
  return { chapterIndex: pageCounts.length - 1, screenPage: Math.max(0, (pageCounts.at(-1) ?? 1) - 1) };
}

export function getReaderAdjacentPageTarget(direction: 'next' | 'prev', { activeChapterIndex, activeScreenPage, activeChapterPageCount, chapterPageCounts, chapterCount }: { activeChapterIndex: number; activeScreenPage: number; activeChapterPageCount: number; chapterPageCounts: number[]; chapterCount: number }) {
  const safeChapterCount = Math.max(0, Math.floor(chapterCount));
  if (!safeChapterCount) return null;
  const safeChapterIndex = Math.min(Math.max(0, Math.floor(activeChapterIndex)), safeChapterCount - 1);
  const safeActivePageCount = Math.max(1, Math.floor(activeChapterPageCount || chapterPageCounts[safeChapterIndex] || 1));
  const safeScreenPage = Math.min(Math.max(0, Math.floor(activeScreenPage)), safeActivePageCount - 1);
  if (direction === 'next') {
    if (safeScreenPage < safeActivePageCount - 1) return { chapterIndex: safeChapterIndex, screenPage: safeScreenPage + 1 };
    if (safeChapterIndex < safeChapterCount - 1) return { chapterIndex: safeChapterIndex + 1, screenPage: 0 };
    return { chapterIndex: safeChapterIndex, screenPage: safeActivePageCount - 1 };
  }
  if (safeScreenPage > 0) return { chapterIndex: safeChapterIndex, screenPage: safeScreenPage - 1 };
  if (safeChapterIndex > 0) {
    const previousPageCount = Math.max(1, Math.floor(chapterPageCounts[safeChapterIndex - 1] ?? 1));
    return { chapterIndex: safeChapterIndex - 1, screenPage: previousPageCount - 1 };
  }
  return { chapterIndex: safeChapterIndex, screenPage: 0 };
}

export function getReaderSpreadPageTurnTarget(direction: 'next' | 'prev', { activeStreamIndex, visiblePageCount, pageStreamLength, chapterPageCounts }: { activeStreamIndex: number; visiblePageCount: number; pageStreamLength: number; chapterPageCounts: number[] }) {
  if (!chapterPageCounts.length || pageStreamLength <= 0) return null;
  const safeStep = Math.max(1, Math.floor(visiblePageCount));
  const safeCurrent = Math.min(Math.max(0, Math.floor(activeStreamIndex)), Math.max(0, pageStreamLength - 1));
  const targetStreamIndex = direction === 'next'
    ? Math.min(Math.max(0, pageStreamLength - 1), safeCurrent + safeStep)
    : Math.max(0, safeCurrent - safeStep);
  return getReaderChapterPageTargetFromStreamIndex(chapterPageCounts, targetStreamIndex);
}

export function getReaderVisiblePageStreamWindow({ chapters, activeChapterIndex, activeScreenPage, activePageChunks, adjacentChapterPageChunks = [], estimatedChapterPageCounts, estimatedCapacity, resolvedPageMode, chapterStartsNewPage, allowEstimatedActivePageChunks = true }: { chapters: ReaderChapter[]; activeChapterIndex: number; activeScreenPage: number; activePageChunks: ReaderPageChunk[]; adjacentChapterPageChunks?: ReaderPageChunk[]; estimatedChapterPageCounts: number[]; estimatedCapacity: number; resolvedPageMode: ReaderPageMode; chapterStartsNewPage: boolean; allowEstimatedActivePageChunks?: boolean }) {
  const chapter = chapters[activeChapterIndex];
  if (!chapter) return [];
  if (!activePageChunks.length && !allowEstimatedActivePageChunks) return [];
  const chunks = activePageChunks.length ? activePageChunks : estimateReaderPages(chapter, estimatedCapacity);
  const pageInChapter = Math.min(Math.max(0, Math.floor(activeScreenPage)), Math.max(0, chunks.length - 1));
  const currentStreamIndex = getEstimatedReaderStreamIndex(estimatedChapterPageCounts, activeChapterIndex, pageInChapter);
  const pages: ReaderStreamPage[] = [{
    streamIndex: currentStreamIndex,
    chapterId: chapter.id,
    chapterIndex: chapter.index,
    visibleChapterPosition: activeChapterIndex,
    pageInChapter,
    chunk: chunks[pageInChapter] ?? createReaderPageChunk(0, [{ paragraphIndex: 0, startOffset: 0, endOffset: 0, text: '' }]),
  }];
  if (resolvedPageMode === 'double') {
    const nextPageInChapter = pageInChapter + 1;
    if (nextPageInChapter < chunks.length) {
      pages.push({
        streamIndex: currentStreamIndex + 1,
        chapterId: chapter.id,
        chapterIndex: chapter.index,
        visibleChapterPosition: activeChapterIndex,
        pageInChapter: nextPageInChapter,
        chunk: chunks[nextPageInChapter],
      });
    } else if (!chapterStartsNewPage) {
      const nextChapter = chapters[activeChapterIndex + 1];
      if (nextChapter) {
        const nextChunks = adjacentChapterPageChunks.length || allowEstimatedActivePageChunks
          ? adjacentChapterPageChunks.length ? adjacentChapterPageChunks : estimateReaderPages(nextChapter, estimatedCapacity)
          : [];
        if (!nextChunks.length) return pages;
        pages.push({
          streamIndex: currentStreamIndex + 1,
          chapterId: nextChapter.id,
          chapterIndex: nextChapter.index,
          visibleChapterPosition: activeChapterIndex + 1,
          pageInChapter: 0,
          chunk: nextChunks[0] ?? createReaderPageChunk(0, [{ paragraphIndex: 0, startOffset: 0, endOffset: 0, text: '' }]),
        });
      }
    }
  }
  return pages;
}

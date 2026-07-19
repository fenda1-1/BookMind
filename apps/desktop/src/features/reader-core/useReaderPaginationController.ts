import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { ReaderPageMode, ReaderSettings } from '../../types';
import { getAdjacentReaderPageTarget, getReaderWheelIntent, getReaderWheelPageState } from './readerModel';
import type { ReaderChapter, ReaderPageChunk } from './readerModel';
import { getReaderAdjacentPageTarget, getReaderChapterPageTargetFromStreamIndex, getReaderSpreadPageTurnTarget } from './readerPagination';
import { playReaderPageTurnSound } from './readerPageRuntime';

type ReaderGesturePagingState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTarget: EventTarget | null;
};

type ReaderPaginationControllerParams = {
  scrollRef: RefObject<HTMLDivElement | null>;
  chapters: ReaderChapter[];
  visibleChapters: ReaderChapter[];
  activeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  screenPageCount: number;
  activePageChunks: ReaderPageChunk[];
  estimatedChapterPageCounts: number[];
  measuredChapterPageCounts: number[];
  activeStreamIndex: number;
  pageStreamLength: number;
  settings: ReaderSettings;
  extendedSettings: ExtendedSettings;
  resolvedPageMode: ReaderPageMode;
  wheelPagingThresholdPx: number;
  gesturePagingThresholdPx: number;
  pageJumpValue: string;
  pageMeterTotal: number;
  isActive: boolean;
  selectionMenuOpen: boolean;
  highlightMenuOpen: boolean;
  textDialogOpen: boolean;
  highlightViewerOpen: boolean;
  onSelectChapterPage: (index: number, screenPage?: number | 'first' | 'last', paragraphIndex?: number) => void;
  onSelectScreenPage: (page: number) => void;
  setPageJumpError: (error: string) => void;
  formatInvalidPageJump: (total: number) => string;
};

export function useReaderPaginationController({
  scrollRef,
  chapters,
  visibleChapters,
  activeChapterIndex,
  activeParagraphIndex,
  activeScreenPage,
  screenPageCount,
  activePageChunks,
  estimatedChapterPageCounts,
  measuredChapterPageCounts,
  activeStreamIndex,
  pageStreamLength,
  settings,
  extendedSettings,
  resolvedPageMode,
  wheelPagingThresholdPx,
  gesturePagingThresholdPx,
  pageJumpValue,
  pageMeterTotal,
  isActive,
  selectionMenuOpen,
  highlightMenuOpen,
  textDialogOpen,
  highlightViewerOpen,
  onSelectChapterPage,
  onSelectScreenPage,
  setPageJumpError,
  formatInvalidPageJump,
}: ReaderPaginationControllerParams) {
  const wheelLockRef = useRef(false);
  const continuousPageTurnTimerRef = useRef<number | null>(null);
  const continuousPageTurnActiveRef = useRef(false);
  const gesturePagingRef = useRef<ReaderGesturePagingState | null>(null);
  const suppressGestureClickRef = useRef(false);
  const lastPageRef = useRef({ chapterIndex: activeChapterIndex, screenPage: activeScreenPage });
  const [pageTurnKey, setPageTurnKey] = useState(0);
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev'>('next');

  function goToScreenPage(page: number) {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (settings.layoutMode === 'page') {
      const currentChapterPageCount = Math.max(1, activePageChunks.length);
      const nextPage = Math.min(Math.max(0, page), currentChapterPageCount - 1);
      if (nextPage !== activeScreenPage) {
        setPageTurnDirection(nextPage > activeScreenPage ? 'next' : 'prev');
        playReaderPageTurnSound(extendedSettings.pageTurnSound);
      }
      scroll.scrollTo({ top: 0, behavior: 'auto' });
      onSelectChapterPage(activeChapterIndex, nextPage, activePageChunks[nextPage]?.paragraphIndex ?? activeParagraphIndex);
      return;
    }
    const nextPage = Math.min(Math.max(0, page), Math.max(0, screenPageCount - 1));
    if (nextPage !== activeScreenPage) {
      setPageTurnDirection(nextPage > activeScreenPage ? 'next' : 'prev');
      playReaderPageTurnSound(extendedSettings.pageTurnSound);
    }
    const targetChapter = visibleChapters[nextPage];
    const target = targetChapter ? scroll.querySelector(`[data-chapter-index="${targetChapter.index}"]`) : null;
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    onSelectScreenPage(nextPage);
  }

  function goToGlobalPageIndex(pageIndex: number) {
    if (settings.layoutMode !== 'page') {
      goToScreenPage(pageIndex);
      return;
    }
    const target = getReaderChapterPageTargetFromStreamIndex(measuredChapterPageCounts, pageIndex);
    if (!target) return;
    const direction = target.chapterIndex > activeChapterIndex || (target.chapterIndex === activeChapterIndex && target.screenPage > activeScreenPage) ? 'next' : 'prev';
    setPageTurnDirection(direction);
    playReaderPageTurnSound(extendedSettings.pageTurnSound);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    onSelectChapterPage(target.chapterIndex, target.screenPage);
  }

  function goNextScreenPage() {
    setPageTurnDirection('next');
    if (settings.layoutMode === 'page') {
      const target = getReaderSpreadPageTurnTarget('next', { activeStreamIndex, visiblePageCount: resolvedPageMode === 'double' ? 2 : 1, pageStreamLength, chapterPageCounts: measuredChapterPageCounts });
      if (!target || (target.chapterIndex === activeChapterIndex && target.screenPage === activeScreenPage)) return;
      playReaderPageTurnSound(extendedSettings.pageTurnSound);
      onSelectChapterPage(target.chapterIndex, target.screenPage, target.chapterIndex === activeChapterIndex ? activePageChunks[target.screenPage]?.paragraphIndex ?? activeParagraphIndex : undefined);
      return;
    }
    const target = getAdjacentReaderPageTarget('next', activeChapterIndex, activeScreenPage, screenPageCount, chapters.length);
    if (target.chapterIndex === activeChapterIndex && typeof target.screenPage === 'number') goToScreenPage(target.screenPage);
    else {
      playReaderPageTurnSound(extendedSettings.pageTurnSound);
      onSelectChapterPage(target.chapterIndex, target.screenPage);
    }
  }

  function goPrevScreenPage() {
    setPageTurnDirection('prev');
    if (settings.layoutMode === 'page') {
      const target = getReaderSpreadPageTurnTarget('prev', { activeStreamIndex, visiblePageCount: resolvedPageMode === 'double' ? 2 : 1, pageStreamLength, chapterPageCounts: measuredChapterPageCounts });
      if (!target || (target.chapterIndex === activeChapterIndex && target.screenPage === activeScreenPage)) return;
      playReaderPageTurnSound(extendedSettings.pageTurnSound);
      onSelectChapterPage(target.chapterIndex, target.screenPage, target.chapterIndex === activeChapterIndex ? activePageChunks[target.screenPage]?.paragraphIndex ?? activeParagraphIndex : undefined);
      return;
    }
    const target = getAdjacentReaderPageTarget('prev', activeChapterIndex, activeScreenPage, screenPageCount, chapters.length);
    if (target.chapterIndex === activeChapterIndex && typeof target.screenPage === 'number') goToScreenPage(target.screenPage);
    else {
      playReaderPageTurnSound(extendedSettings.pageTurnSound);
      onSelectChapterPage(target.chapterIndex, target.screenPage);
    }
  }

  function stopContinuousPageTurn() {
    if (continuousPageTurnTimerRef.current !== null) {
      window.clearTimeout(continuousPageTurnTimerRef.current);
      window.clearInterval(continuousPageTurnTimerRef.current);
      continuousPageTurnTimerRef.current = null;
    }
  }

  function startContinuousPageTurn(event: PointerEvent<HTMLButtonElement>, direction: 'prev' | 'next') {
    if (event.currentTarget.disabled || continuousPageTurnTimerRef.current !== null) return;
    const turn = direction === 'next' ? goNextScreenPage : goPrevScreenPage;
    continuousPageTurnActiveRef.current = false;
    continuousPageTurnTimerRef.current = window.setTimeout(() => {
      continuousPageTurnActiveRef.current = true;
      turn();
      continuousPageTurnTimerRef.current = window.setInterval(turn, 260);
    }, 420);
  }

  function handlePageTurnButtonClick(event: MouseEvent<HTMLButtonElement>, direction: 'prev' | 'next') {
    if (continuousPageTurnActiveRef.current) {
      continuousPageTurnActiveRef.current = false;
      event.preventDefault();
      return;
    }
    if (direction === 'next') goNextScreenPage();
    else goPrevScreenPage();
  }

  function jumpToPageValue() {
    const page = Number(pageJumpValue);
    if (!Number.isFinite(page) || page < 1 || page > pageMeterTotal) {
      setPageJumpError(formatInvalidPageJump(pageMeterTotal));
      return;
    }
    setPageJumpError('');
    if (settings.layoutMode === 'page') goToGlobalPageIndex(page - 1);
    else goToScreenPage(page - 1);
  }

  function onReaderWheel(event: WheelEvent) {
    const scroll = scrollRef.current;
    if (!scroll || wheelLockRef.current) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.reader-highlight-panel, .reader-highlight-drawer, .reader-bookmark-drawer, .reader-text-dialog')) return;
    const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 4;
    const atTop = scroll.scrollTop <= 4;
    const wheelPageState = getReaderWheelPageState({ layoutMode: settings.layoutMode, activeScreenPage, screenPageCount, activeStreamIndex, pageStreamLength });
    const intent = getReaderWheelIntent({ layoutMode: settings.layoutMode, deltaY: event.deltaY, deltaMode: event.deltaMode, wheelPaging: settings.wheelPaging, touchpadNaturalScroll: settings.touchpadNaturalScroll, wheelPagingThresholdPx: wheelPagingThresholdPx, ...wheelPageState, atTop, atBottom });
    if (intent === 'native-scroll' || intent === 'none') return;
    event.preventDefault();
    wheelLockRef.current = true;
    if (intent === 'next-page') goNextScreenPage();
    if (intent === 'prev-page') goPrevScreenPage();
    if (intent === 'next-chapter') onSelectChapterPage(Math.min(activeChapterIndex + 1, Math.max(0, chapters.length - 1)), 'first');
    if (intent === 'prev-chapter') onSelectChapterPage(Math.max(0, activeChapterIndex - 1), 'last');
    window.setTimeout(() => { wheelLockRef.current = false; }, 220);
  }

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !isActive) return;
    scroll.addEventListener('wheel', onReaderWheel, { passive: false });
    return () => {
      scroll.removeEventListener('wheel', onReaderWheel);
    };
  }, [
    scrollRef,
    isActive,
    settings.layoutMode,
    settings.wheelPaging,
    settings.touchpadNaturalScroll,
    wheelPagingThresholdPx,
    activeScreenPage,
    screenPageCount,
    activeStreamIndex,
    pageStreamLength,
    activeChapterIndex,
    activeParagraphIndex,
    activePageChunks,
    measuredChapterPageCounts,
    estimatedChapterPageCounts,
    resolvedPageMode,
    chapters.length,
    visibleChapters,
    onSelectChapterPage,
    onSelectScreenPage,
    extendedSettings.pageTurnSound,
  ]);

  function onReaderPageClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressGestureClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressGestureClickRef.current = false;
      return;
    }
    if (!extendedSettings.pageClickPaging) return;
    if (event.defaultPrevented || selectionMenuOpen || highlightMenuOpen || textDialogOpen || highlightViewerOpen) return;
    if (window.getSelection()?.toString().trim()) return;
    if ((event.target as HTMLElement | null)?.closest('button, input, textarea, select, a, .source-paragraph, .reader-chapter-start, .reader-running-header, .reader-running-footer, .reader-toc, .reader-highlight-panel, .reader-context-menu, .reader-selection-menu, .reader-text-dialog')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    if (localX < rect.width * 0.28) goPrevScreenPage();
    if (localX > rect.width * 0.72) goNextScreenPage();
  }

  function startReaderGesturePaging(event: PointerEvent<HTMLDivElement>) {
    if (!extendedSettings.gesturePagingEnabled) return;
    if (event.pointerType === 'mouse') return;
    if (event.defaultPrevented || selectionMenuOpen || highlightMenuOpen || textDialogOpen || highlightViewerOpen) return;
    if ((event.target as HTMLElement | null)?.closest('button, input, textarea, select, a, .reader-width-grip, .reader-toc-resize-grip, .reader-toc, .reader-highlight-panel, .reader-context-menu, .reader-selection-menu, .reader-text-dialog')) return;
    gesturePagingRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTarget: event.target,
    };
  }

  function cancelReaderGesturePaging() {
    gesturePagingRef.current = null;
  }

  function updateReaderGesturePaging(event: PointerEvent<HTMLDivElement>) {
    const gesture = gesturePagingRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - gesture.startY;
    if (Math.abs(deltaY) > gesturePagingThresholdPx * 1.4) cancelReaderGesturePaging();
  }

  function finishReaderGesturePaging(event: PointerEvent<HTMLDivElement>) {
    const gesture = gesturePagingRef.current;
    gesturePagingRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!extendedSettings.gesturePagingEnabled) return;
    if (window.getSelection()?.toString().trim()) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.abs(deltaX) < gesturePagingThresholdPx) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    if (gesture.startTarget instanceof HTMLElement && gesture.startTarget.closest('button, input, textarea, select, a, .reader-context-menu, .reader-selection-menu, .reader-text-dialog')) return;
    event.preventDefault();
    event.stopPropagation();
    suppressGestureClickRef.current = true;
    deltaX < 0 ? goNextScreenPage() : goPrevScreenPage();
    window.setTimeout(() => { suppressGestureClickRef.current = false; }, 360);
  }

  useEffect(() => {
    if (!isActive) return;
    if (settings.layoutMode === 'page') {
      window.requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      });
    }
    const previous = lastPageRef.current;
    const movedForward = activeChapterIndex > previous.chapterIndex || (activeChapterIndex === previous.chapterIndex && activeScreenPage >= previous.screenPage);
    setPageTurnDirection(movedForward ? 'next' : 'prev');
    lastPageRef.current = { chapterIndex: activeChapterIndex, screenPage: activeScreenPage };
    setPageTurnKey((value) => value + 1);
  }, [activeScreenPage, activeChapterIndex, settings.layoutMode, pageStreamLength, isActive]);

  return {
    pageTurnDirection,
    pageTurnKey,
    goToScreenPage,
    goToGlobalPageIndex,
    goNextScreenPage,
    goPrevScreenPage,
    jumpToPageValue,
    handlePageTurnButtonClick,
    startContinuousPageTurn,
    stopContinuousPageTurn,
    onReaderWheel,
    onReaderPageClick,
    startReaderGesturePaging,
    cancelReaderGesturePaging,
    updateReaderGesturePaging,
    finishReaderGesturePaging,
  };
}

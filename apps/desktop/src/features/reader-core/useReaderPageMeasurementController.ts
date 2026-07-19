import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Book, ReaderPageMode, ReaderSettings } from '../../types';
import { subscribeReaderCacheCleared, subscribeReaderPageCacheCleared } from './readerDomainEvents';
import { READER_RIGHT_PANEL_RESIZE_END_EVENT } from './readerRightPanelSessions';
import {
  getReaderChapterCharacterCount,
  getReaderChapterContentSignature,
  getReaderPageMeasurementCacheKey,
  getReaderPageTextHeight,
  getFlowReaderChapterRange,
  getVirtualChapterRange,
  hasInvalidReaderPageChunks,
  resolveReaderEffectivePageMode,
  resolveReaderSpreadPageWidth,
} from './readerModel';
import type { ReaderChapter, ReaderPageChunk } from './readerModel';
import {
  estimateReaderPageCount,
  estimateReaderPageCountFromCharacters,
  estimateReaderPages,
  getEstimatedReaderStreamIndex,
  getReaderPageStreamLength,
  getReaderVisiblePageStreamWindow,
} from './readerPagination';
import {
  loadPersistentPageCache,
  measureChapterPages,
  measureChapterPagesCooperatively,
  preloadReaderChapterImages,
  preheatAdjacentReaderPageCacheCooperatively,
  savePersistentPageCache,
  waitForReaderFonts,
} from './readerPageRuntime';

type ReaderPageMeasurementControllerOptions = {
  book: Book | null;
  chapters: ReaderChapter[];
  activeChapter: ReaderChapter | undefined;
  activeChapterIndex: number;
  activeScreenPage: number;
  settings: ReaderSettings;
  visualSettings: ReaderSettings;
  showToc: boolean;
  isActive: boolean;
  virtualChapterRadius: number;
  readerPageCacheEnabled: boolean;
  readerPageCacheLimit: number;
  readerPageMeasureCacheLimit: number;
  readerPagePreheatRange: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
  onSelectScreenPage: (page: number) => void;
  onPageCountChange: (count: number) => void;
  onEffectivePageWidthChange: (width: number) => void;
};

type ReaderPageMeasurementController = {
  availableReaderWidth: number;
  availableReaderHeight: number;
  effectivePageWidth: number;
  effectiveBodyMarginX: number;
  effectiveBodyMarginY: number;
  readerChapterTitleBlockMaxHeight: number;
  estimatedCapacity: number;
  activePageChunks: ReaderPageChunk[];
  activePageChunk: ReaderPageChunk | undefined;
  activePageChunksMeasured: boolean;
  virtualRange: ReturnType<typeof getVirtualChapterRange>;
  resolvedPageMode: ReaderPageMode;
  estimatedChapterPageCounts: number[];
  measuredChapterPageCounts: number[];
  pageStreamLength: number;
  activeStreamIndex: number;
  visiblePageStream: ReturnType<typeof getReaderVisiblePageStreamWindow>;
  visibleChapters: ReaderChapter[];
  screenPageCount: number;
  pageMeasurementScopeKey: string;
  scheduleRecalculatePages: () => void;
};

export function useReaderPageMeasurementController({
  book,
  chapters,
  activeChapter,
  activeChapterIndex,
  activeScreenPage,
  settings,
  visualSettings,
  showToc,
  isActive,
  virtualChapterRadius,
  readerPageCacheEnabled,
  readerPageCacheLimit,
  readerPageMeasureCacheLimit,
  readerPagePreheatRange,
  scrollRef,
  measureRef,
  onSelectScreenPage,
  onPageCountChange,
  onEffectivePageWidthChange,
}: ReaderPageMeasurementControllerOptions): ReaderPageMeasurementController {
  const pageMeasureCacheRef = useRef<Map<string, ReaderPageChunk[]>>(new Map());
  const pageMeasurementScopeKeyRef = useRef('');
  const measuredChapterPageScopeKeyRef = useRef('');
  const recalculateFrameRef = useRef<number | null>(null);
  const resizeMeasurementFrameRef = useRef<number | null>(null);
  const skipSynchronousResizeMeasurementRef = useRef(false);
  const [screenPageCount, setScreenPageCount] = useState(1);
  const [measuredChapterPageChunks, setMeasuredChapterPageChunks] = useState<Map<string, ReaderPageChunk[]>>(() => new Map());
  const [availableReaderWidth, setAvailableReaderWidth] = useState(settings.pageWidth);
  const [availableReaderHeight, setAvailableReaderHeight] = useState(0);
  const resolvedPageMode = useMemo(
    () => settings.layoutMode === 'flow' ? 'single' : resolveReaderEffectivePageMode(settings.pageMode, availableReaderWidth, 420),
    [settings.layoutMode, settings.pageMode, availableReaderWidth],
  );
  const effectivePageWidth = resolveReaderSpreadPageWidth(visualSettings.pageWidth, availableReaderWidth, resolvedPageMode, visualSettings.pageGap);
  const measurementPageWidth = resolveReaderSpreadPageWidth(settings.pageWidth, availableReaderWidth, resolvedPageMode, settings.pageGap);
  const effectiveBodyMarginX = availableReaderWidth < 900 ? visualSettings.narrowBodyMarginX : visualSettings.bodyMarginX;
  const effectiveBodyMarginY = availableReaderWidth < 900 ? visualSettings.narrowBodyMarginY : visualSettings.bodyMarginY;
  const readerChapterTitleBlockMaxHeight = Math.max(
    72,
    Math.min(220, Math.ceil(settings.titleFontSize * 1.18 * 3 + settings.titleMarginTop + settings.titleMarginBottom)),
  );
  const estimatedReaderHeight = Math.max(240, availableReaderHeight || window.innerHeight - 190);
  const estimatedPageTextHeight = getReaderPageTextHeight(estimatedReaderHeight, {
    headerVisible: settings.headerVisible,
    footerVisible: settings.footerVisible,
    titleVisible: false,
    bodyMarginY: effectiveBodyMarginY,
    headerMarginY: settings.headerMarginY,
    footerMarginY: settings.footerMarginY,
    titleFontSize: settings.titleFontSize,
    titleMarginTop: settings.titleMarginTop,
    titleMarginBottom: settings.titleMarginBottom,
  });
  const estimatedLineHeightPx = Math.max(12, settings.fontSize * settings.lineHeight);
  const estimatedLinesPerPage = Math.max(1, estimatedPageTextHeight / estimatedLineHeightPx);
  const estimatedCharsPerLine = Math.max(10, (measurementPageWidth - effectiveBodyMarginX * 2) / Math.max(8, settings.fontSize));
  const estimatedParagraphSpacingLines = Math.max(0, settings.paragraphSpacing / estimatedLineHeightPx);
  const estimatedTitleReserveLines = Math.max(0, (settings.titleFontSize * 1.25 + settings.titleMarginTop + settings.titleMarginBottom + 42) / estimatedLineHeightPx);
  const estimatedCapacity = Math.max(120, Math.floor(Math.max(1, estimatedLinesPerPage - estimatedParagraphSpacingLines * 6 - estimatedTitleReserveLines) * estimatedCharsPerLine));
  const pageMeasurementScopeKey = useMemo(() => [
    book?.id ?? 'no-book',
    chapters.length,
    settings.fontFamily,
    settings.fontSize,
    settings.letterSpacing,
    settings.lineHeight,
    settings.paragraphSpacing,
    settings.firstLineIndent,
    Math.round(measurementPageWidth),
    availableReaderHeight,
    readerChapterTitleBlockMaxHeight,
    effectiveBodyMarginX,
    effectiveBodyMarginY,
    settings.headerVisible,
    settings.footerVisible,
    settings.headerMarginY,
    settings.footerMarginY,
    settings.headerFooterTimeFormat,
    settings.titleFontSize,
    settings.titleMarginTop,
    settings.titleMarginBottom,
    settings.titleOnlyOnChapterStart,
    settings.titleNumberCleanup,
    settings.longParagraphStrategy,
  ].join('~'), [book?.id, chapters.length, settings.fontFamily, settings.fontSize, settings.letterSpacing, settings.lineHeight, settings.paragraphSpacing, settings.firstLineIndent, measurementPageWidth, availableReaderHeight, readerChapterTitleBlockMaxHeight, effectiveBodyMarginX, effectiveBodyMarginY, settings.headerVisible, settings.footerVisible, settings.headerMarginY, settings.footerMarginY, settings.headerFooterTimeFormat, settings.titleFontSize, settings.titleMarginTop, settings.titleMarginBottom, settings.titleOnlyOnChapterStart, settings.titleNumberCleanup, settings.longParagraphStrategy]);
  const pageMeasurementScopeSettled = measuredChapterPageScopeKeyRef.current === pageMeasurementScopeKey;
  const fallbackPageChunks = useMemo(() => activeChapter ? estimateReaderPages(activeChapter, estimatedCapacity, { longParagraphStrategy: settings.longParagraphStrategy }) : [], [activeChapter, estimatedCapacity, settings.longParagraphStrategy]);
  const currentActiveMeasuredPageChunks = pageMeasurementScopeSettled && activeChapter ? measuredChapterPageChunks.get(activeChapter.id) ?? [] : [];
  const currentActiveMeasuredPageChunksInvalid = currentActiveMeasuredPageChunks.length > 0 && hasInvalidReaderPageChunks(currentActiveMeasuredPageChunks);
  const activeMeasuredPageChunks = currentActiveMeasuredPageChunks.length && !currentActiveMeasuredPageChunksInvalid ? currentActiveMeasuredPageChunks : [];
  const activePageChunksMeasured = activeMeasuredPageChunks.length > 0;
  const activePageChunks = activeMeasuredPageChunks.length ? activeMeasuredPageChunks : fallbackPageChunks;
  const renderablePageChunks = activePageChunksMeasured ? activeMeasuredPageChunks : [];
  const activePageChunk = activePageChunks[Math.min(activeScreenPage, Math.max(0, activePageChunks.length - 1))];
  const adjacentChapter = resolvedPageMode === 'double' && !settings.chapterStartsNewPage ? chapters[activeChapterIndex + 1] : undefined;
  const adjacentMeasuredPageChunks = pageMeasurementScopeSettled && adjacentChapter ? measuredChapterPageChunks.get(adjacentChapter.id) ?? [] : [];
  const renderableAdjacentPageChunks = adjacentMeasuredPageChunks.length && !hasInvalidReaderPageChunks(adjacentMeasuredPageChunks) ? adjacentMeasuredPageChunks : [];
  const virtualRange = useMemo(
    () => settings.layoutMode === 'flow'
      ? getFlowReaderChapterRange(chapters, activeChapterIndex, virtualChapterRadius, { bookFormat: book?.format })
      : getVirtualChapterRange(chapters, activeChapterIndex, virtualChapterRadius),
    [book?.format, chapters, activeChapterIndex, settings.layoutMode, virtualChapterRadius],
  );
  const estimatedChapterPageCounts = useMemo(() => {
    if (settings.layoutMode !== 'page') return [];
    return chapters.map((chapter) => {
      if (chapter.id !== activeChapter?.id) return estimateReaderPageCountFromCharacters(getReaderChapterCharacterCount(chapter), estimatedCapacity);
      return estimateReaderPageCount(chapter, estimatedCapacity);
    });
  }, [settings.layoutMode, chapters, activeChapter?.id, estimatedCapacity]);
  const measuredChapterPageCounts = useMemo(() => {
    if (settings.layoutMode !== 'page') return [];
    return chapters.map((chapter, index) => {
      const measured = pageMeasurementScopeSettled ? measuredChapterPageChunks.get(chapter.id) : undefined;
      return measured?.length || estimatedChapterPageCounts[index] || 1;
    });
  }, [settings.layoutMode, chapters, estimatedChapterPageCounts, measuredChapterPageChunks, pageMeasurementScopeSettled]);
  const pageStreamLength = useMemo(() => getReaderPageStreamLength(measuredChapterPageCounts), [measuredChapterPageCounts]);
  const activeStreamIndex = useMemo(() => getEstimatedReaderStreamIndex(measuredChapterPageCounts, activeChapterIndex, activeScreenPage), [measuredChapterPageCounts, activeChapterIndex, activeScreenPage]);
  const visiblePageStream = useMemo(() => settings.layoutMode === 'page' ? getReaderVisiblePageStreamWindow({ chapters, activeChapterIndex, activeScreenPage, activePageChunks: renderablePageChunks, adjacentChapterPageChunks: renderableAdjacentPageChunks, estimatedChapterPageCounts: measuredChapterPageCounts, estimatedCapacity, resolvedPageMode, chapterStartsNewPage: settings.chapterStartsNewPage, allowEstimatedActivePageChunks: false }) : [], [settings.layoutMode, chapters, activeChapterIndex, activeScreenPage, renderablePageChunks, renderableAdjacentPageChunks, measuredChapterPageCounts, estimatedCapacity, resolvedPageMode, settings.chapterStartsNewPage]);
  const visibleChapters = settings.layoutMode === 'flow'
    ? chapters.slice(virtualRange.start, virtualRange.end)
    : visiblePageStream.map((page) => chapters[page.visibleChapterPosition]).filter(Boolean);

  function getMeasuredPageTextHeight(scroll: HTMLDivElement) {
    const bodyContent = scroll.querySelector('.reader-page .reader-body-content') as HTMLElement | null;
    const bodyFrame = scroll.querySelector('.reader-page .reader-body-frame') as HTMLElement | null;
    const pageTextHeight = bodyContent?.clientHeight || bodyFrame?.clientHeight || getReaderPageTextHeight(scroll.clientHeight, {
      headerVisible: settings.headerVisible,
      footerVisible: settings.footerVisible,
      titleVisible: false,
      bodyMarginY: effectiveBodyMarginY,
      headerMarginY: settings.headerMarginY,
      footerMarginY: settings.footerMarginY,
      titleFontSize: settings.titleFontSize,
      titleMarginTop: settings.titleMarginTop,
      titleMarginBottom: settings.titleMarginBottom,
    });
    const pageMeasurementSafetyPx = Math.ceil(Math.max(settings.fontSize * settings.lineHeight * 2, settings.footerMarginY + settings.headerFooterFontSize, settings.titleFontSize * 0.35, 28));
    return Math.max(120, pageTextHeight - pageMeasurementSafetyPx);
  }

  function measureChapterForCurrentLayout(chapter: ReaderChapter | undefined) {
    if (skipSynchronousResizeMeasurementRef.current) return null;
    const measure = measureRef.current;
    const scroll = scrollRef.current;
    if (!chapter || !measure || !scroll || !isActive || settings.layoutMode !== 'page' || scroll.clientWidth <= 0 || scroll.clientHeight <= 0) return null;
    const measuredPageTextHeight = getMeasuredPageTextHeight(scroll);
    const measured = measureChapterPages(chapter, measure, measuredPageTextHeight, { titleOnlyOnChapterStart: settings.titleOnlyOnChapterStart, titleNumberCleanup: settings.titleNumberCleanup, longParagraphStrategy: settings.longParagraphStrategy, titleBlockMaxHeight: readerChapterTitleBlockMaxHeight });
    return hasInvalidReaderPageChunks(measured) ? null : measured;
  }

  function measureActiveChapterForCurrentLayout() {
    return measureChapterForCurrentLayout(activeChapter);
  }

  function recalculatePages() {
    const scroll = scrollRef.current;
    if (!scroll || !isActive || scroll.clientWidth <= 0 || scroll.clientHeight <= 0) return;
    const nextCount = settings.layoutMode === 'page' ? Math.max(1, activePageChunks.length) : Math.max(1, visibleChapters.length);
    const visibleScreenPage = settings.layoutMode === 'flow'
      ? visibleChapters.findIndex((chapter) => chapter.id === activeChapter?.id)
      : activeScreenPage;
    setScreenPageCount(nextCount);
    onPageCountChange(nextCount);
    if (settings.layoutMode === 'flow' && visibleScreenPage >= 0 && visibleScreenPage !== activeScreenPage) onSelectScreenPage(visibleScreenPage);
    if (settings.layoutMode !== 'page' && activeScreenPage >= nextCount) onSelectScreenPage(nextCount - 1);
  }

  function scheduleRecalculatePages() {
    if (recalculateFrameRef.current !== null) return;
    recalculateFrameRef.current = window.requestAnimationFrame(() => {
      recalculateFrameRef.current = null;
      recalculatePages();
    });
  }

  function scheduleReaderResizeMeasurement() {
    if (resizeMeasurementFrameRef.current !== null) return;
    const grid = scrollRef.current?.closest<HTMLElement>('.reader-grid');
    // Width previews update CSS directly while dragging. Defer the expensive
    // measurement until pointerup commits the final width.
    if (grid?.classList.contains('reader-panel-resizing')) return;
    resizeMeasurementFrameRef.current = window.requestAnimationFrame(() => {
      resizeMeasurementFrameRef.current = null;
      const scroll = scrollRef.current;
      if (!scroll || !isActive || scroll.clientWidth <= 0 || scroll.clientHeight <= 0) return;
      if (scroll.closest<HTMLElement>('.reader-grid')?.classList.contains('reader-panel-resizing')) return;
      setAvailableReaderWidth(scroll.clientWidth || settings.pageWidth);
      setAvailableReaderHeight(scroll.clientHeight || 0);
      recalculatePages();
    });
  }

  useLayoutEffect(() => {
    if (!isActive) return;
    if (pageMeasurementScopeKeyRef.current === pageMeasurementScopeKey) return;
    pageMeasurementScopeKeyRef.current = pageMeasurementScopeKey;
    measuredChapterPageScopeKeyRef.current = '';
    const measured = measureActiveChapterForCurrentLayout();
    if (activeChapter && measured?.length) {
      measuredChapterPageScopeKeyRef.current = pageMeasurementScopeKey;
      setMeasuredChapterPageChunks(new Map([[activeChapter.id, measured]]));
      return;
    }
    setMeasuredChapterPageChunks(new Map());
  }, [pageMeasurementScopeKey, isActive]);

  useEffect(() => {
    if (!activeChapter || !currentActiveMeasuredPageChunksInvalid) return;
    setMeasuredChapterPageChunks((current) => {
      const next = new Map(current);
      next.delete(activeChapter.id);
      return next;
    });
  }, [activeChapter, currentActiveMeasuredPageChunksInvalid]);

  useLayoutEffect(() => {
    if (!activeChapter || settings.layoutMode !== 'page' || !isActive || activePageChunksMeasured) return;
    const measured = measureActiveChapterForCurrentLayout();
    if (!measured?.length) return;
    measuredChapterPageScopeKeyRef.current = pageMeasurementScopeKey;
    setMeasuredChapterPageChunks((current) => new Map(current).set(activeChapter.id, measured));
  }, [activeChapter?.id, activePageChunksMeasured, pageMeasurementScopeKey, isActive, settings.layoutMode]);

  useLayoutEffect(() => {
    if (!adjacentChapter || settings.layoutMode !== 'page' || !isActive || renderableAdjacentPageChunks.length) return;
    const measured = measureChapterForCurrentLayout(adjacentChapter);
    if (!measured?.length) return;
    measuredChapterPageScopeKeyRef.current = pageMeasurementScopeKey;
    setMeasuredChapterPageChunks((current) => new Map(current).set(adjacentChapter.id, measured));
  }, [adjacentChapter?.id, renderableAdjacentPageChunks.length, pageMeasurementScopeKey, isActive, settings.layoutMode]);

  useEffect(() => {
    onEffectivePageWidthChange(Math.round(effectivePageWidth));
  }, [effectivePageWidth, onEffectivePageWidthChange]);

  useEffect(() => {
    if (!activeChapter || settings.layoutMode !== 'page' || !isActive) return;
    let frame: number | null = null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void waitForReaderFonts().then(() => {
        if (cancelled) return;
        frame = window.requestAnimationFrame(() => {
          frame = null;
          skipSynchronousResizeMeasurementRef.current = false;
          const measure = measureRef.current;
          const scroll = scrollRef.current;
          if (!measure || !scroll || !isActive || scroll.clientWidth <= 0 || scroll.clientHeight <= 0) return;
          const bodyContent = scroll.querySelector('.reader-page .reader-body-content') as HTMLElement | null;
          const bodyFrame = scroll.querySelector('.reader-page .reader-body-frame') as HTMLElement | null;
          const pageTextHeight = bodyContent?.clientHeight || bodyFrame?.clientHeight || getReaderPageTextHeight(scroll.clientHeight, {
            headerVisible: settings.headerVisible,
            footerVisible: settings.footerVisible,
            titleVisible: false,
            bodyMarginY: effectiveBodyMarginY,
            headerMarginY: settings.headerMarginY,
            footerMarginY: settings.footerMarginY,
            titleFontSize: settings.titleFontSize,
            titleMarginTop: settings.titleMarginTop,
            titleMarginBottom: settings.titleMarginBottom,
          });
          const pageMeasurementSafetyPx = Math.ceil(Math.max(settings.fontSize * settings.lineHeight * 2, settings.footerMarginY + settings.headerFooterFontSize, settings.titleFontSize * 0.35, 28));
          const measuredPageTextHeight = Math.max(120, pageTextHeight - pageMeasurementSafetyPx);
          const pageWidth = resolveReaderSpreadPageWidth(settings.pageWidth, availableReaderWidth, resolvedPageMode, settings.pageGap);
          const createPageCacheKey = (chapter: ReaderChapter) => getReaderPageMeasurementCacheKey({
            chapterId: chapter.id,
            title: chapter.title,
            contentSignature: getReaderChapterContentSignature(chapter),
            fontFamily: settings.fontFamily,
            fontSize: settings.fontSize,
            letterSpacing: settings.letterSpacing,
            lineHeight: settings.lineHeight,
            paragraphSpacing: settings.paragraphSpacing,
            firstLineIndent: settings.firstLineIndent,
            pageWidth,
            pageTextHeight: measuredPageTextHeight,
            bodyMarginX: effectiveBodyMarginX,
            bodyMarginY: effectiveBodyMarginY,
            headerVisible: settings.headerVisible,
            footerVisible: settings.footerVisible,
            headerMarginY: settings.headerMarginY,
            footerMarginY: settings.footerMarginY,
            timeFormat: settings.headerFooterTimeFormat,
            titleFontSize: settings.titleFontSize,
            titleMarginTop: settings.titleMarginTop,
            titleMarginBottom: settings.titleMarginBottom,
            titleOnlyOnChapterStart: settings.titleOnlyOnChapterStart,
            titleNumberCleanup: settings.titleNumberCleanup,
            longParagraphStrategy: settings.longParagraphStrategy,
          });
          const cacheKey = createPageCacheKey(activeChapter);
          const cached = pageMeasureCacheRef.current.get(cacheKey);
          if (cached && !hasInvalidReaderPageChunks(cached)) {
            measuredChapterPageScopeKeyRef.current = pageMeasurementScopeKey;
            setMeasuredChapterPageChunks((current) => new Map(current).set(activeChapter.id, cached));
            return;
          }
          if (cached) pageMeasureCacheRef.current.delete(cacheKey);
          const bookId = book?.id;
          const persistentCacheKey = bookId ? `bookmind:reader-page-cache:${bookId}:${cacheKey}` : '';
          const measureAndStore = async () => {
            if (cancelled || !isActive) return;
            await preloadReaderChapterImages(activeChapter);
            if (cancelled || !isActive) return;
            const measured = await measureChapterPagesCooperatively(activeChapter, measure, measuredPageTextHeight, { titleOnlyOnChapterStart: settings.titleOnlyOnChapterStart, titleNumberCleanup: settings.titleNumberCleanup, longParagraphStrategy: settings.longParagraphStrategy, titleBlockMaxHeight: readerChapterTitleBlockMaxHeight }, () => cancelled || !isActive);
            if (hasInvalidReaderPageChunks(measured)) return;
            pageMeasureCacheRef.current.set(cacheKey, measured);
            let measuredAdjacent: ReaderPageChunk[] = [];
            if (adjacentChapter) {
              await preloadReaderChapterImages(adjacentChapter);
              if (cancelled || !isActive) return;
              measuredAdjacent = await measureChapterPagesCooperatively(adjacentChapter, measure, measuredPageTextHeight, { titleOnlyOnChapterStart: settings.titleOnlyOnChapterStart, titleNumberCleanup: settings.titleNumberCleanup, longParagraphStrategy: settings.longParagraphStrategy, titleBlockMaxHeight: readerChapterTitleBlockMaxHeight }, () => cancelled || !isActive);
            }
            if (persistentCacheKey && bookId && readerPageCacheEnabled) savePersistentPageCache(bookId, persistentCacheKey, measured, readerPageCacheLimit);
            void preheatAdjacentReaderPageCacheCooperatively({ bookId, chapters, activeChapterIndex, measure, createPageCacheKey, pageTextHeight: measuredPageTextHeight, options: { titleOnlyOnChapterStart: settings.titleOnlyOnChapterStart, titleNumberCleanup: settings.titleNumberCleanup, longParagraphStrategy: settings.longParagraphStrategy, titleBlockMaxHeight: readerChapterTitleBlockMaxHeight }, pageMeasureCache: pageMeasureCacheRef.current, cacheLimit: readerPageCacheLimit, preheatRange: readerPagePreheatRange, shouldCancel: () => cancelled || !isActive });
            if (pageMeasureCacheRef.current.size > readerPageMeasureCacheLimit) {
              const [oldest] = pageMeasureCacheRef.current.keys();
              pageMeasureCacheRef.current.delete(oldest);
            }
            measuredChapterPageScopeKeyRef.current = pageMeasurementScopeKey;
            setMeasuredChapterPageChunks((current) => {
              const next = new Map(current).set(activeChapter.id, measured);
              if (adjacentChapter && measuredAdjacent.length && !hasInvalidReaderPageChunks(measuredAdjacent)) next.set(adjacentChapter.id, measuredAdjacent);
              return next;
            });
          };
          if (!bookId || !readerPageCacheEnabled) {
            void measureAndStore();
            return;
          }
          void loadPersistentPageCache(bookId, persistentCacheKey, activeChapter).then((persistentCached) => {
            if (cancelled || !isActive) return;
            if (persistentCached.length && !hasInvalidReaderPageChunks(persistentCached)) {
              pageMeasureCacheRef.current.set(cacheKey, persistentCached);
              if (pageMeasureCacheRef.current.size > readerPageMeasureCacheLimit) {
                const [oldest] = pageMeasureCacheRef.current.keys();
                pageMeasureCacheRef.current.delete(oldest);
              }
              measuredChapterPageScopeKeyRef.current = pageMeasurementScopeKey;
              setMeasuredChapterPageChunks((current) => new Map(current).set(activeChapter.id, persistentCached));
              return;
            }
            void measureAndStore();
          });
        });
      });
    }, 90);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activeChapter, activeChapterIndex, book, chapters, settings, showToc, availableReaderWidth, availableReaderHeight, resolvedPageMode, isActive, readerPageCacheEnabled, readerPageCacheLimit, readerPageMeasureCacheLimit, readerPagePreheatRange, effectiveBodyMarginX, effectiveBodyMarginY, readerChapterTitleBlockMaxHeight]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !isActive) return;
    scheduleReaderResizeMeasurement();
    const observer = new ResizeObserver(scheduleReaderResizeMeasurement);
    observer.observe(scroll);
    window.addEventListener('resize', scheduleReaderResizeMeasurement);
    const onReaderPanelResizeEnd = () => {
      skipSynchronousResizeMeasurementRef.current = true;
      scheduleReaderResizeMeasurement();
    };
    window.addEventListener(READER_RIGHT_PANEL_RESIZE_END_EVENT, onReaderPanelResizeEnd);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleReaderResizeMeasurement);
      window.removeEventListener(READER_RIGHT_PANEL_RESIZE_END_EVENT, onReaderPanelResizeEnd);
      if (resizeMeasurementFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeMeasurementFrameRef.current);
        resizeMeasurementFrameRef.current = null;
      }
    };
  }, [showToc, settings.pageWidth, settings.layoutMode, activeScreenPage, pageStreamLength, activePageChunks.length, visibleChapters.length, isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (settings.layoutMode === 'page') {
      scheduleRecalculatePages();
      return;
    }
    scheduleRecalculatePages();
  }, [activeChapterIndex, settings, activePageChunks.length, isActive]);

  useEffect(() => {
    function clearReaderPageCacheSettingsData() {
      pageMeasureCacheRef.current.clear();
      setMeasuredChapterPageChunks(new Map());
    }
    return subscribeReaderPageCacheCleared(clearReaderPageCacheSettingsData);
  }, []);

  useEffect(() => {
    function clearReaderCacheSettingsData() {
      pageMeasureCacheRef.current.clear();
      setMeasuredChapterPageChunks(new Map());
    }
    return subscribeReaderCacheCleared(clearReaderCacheSettingsData);
  }, []);

  useEffect(() => () => {
    if (recalculateFrameRef.current !== null) window.cancelAnimationFrame(recalculateFrameRef.current);
    if (resizeMeasurementFrameRef.current !== null) window.cancelAnimationFrame(resizeMeasurementFrameRef.current);
  }, []);

  return {
    availableReaderWidth,
    availableReaderHeight,
    effectivePageWidth,
    effectiveBodyMarginX,
    effectiveBodyMarginY,
    readerChapterTitleBlockMaxHeight,
    estimatedCapacity,
    activePageChunks,
    activePageChunk,
    activePageChunksMeasured,
    virtualRange,
    resolvedPageMode,
    estimatedChapterPageCounts,
    measuredChapterPageCounts,
    pageStreamLength,
    activeStreamIndex,
    visiblePageStream,
    visibleChapters,
    screenPageCount,
    pageMeasurementScopeKey,
    scheduleRecalculatePages,
  };
}

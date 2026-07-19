import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Book } from '../../types';
import { useI18n } from '../../i18n';
import { BookMindIcon } from '../../components/BookMindIcon';
import { loadPdfSourceBytes } from '../../services/libraryService';
import { recordLifecycleDiagnostic } from '../../services/lifecycleDiagnosticsService';
import { isPdfRenderingCancelled } from './pdfRenderErrorModel';
import { clampCanvasPixelRatio, readerMediaCacheBudgets } from './readerMediaCacheBudgetModel';

type PdfReaderViewProps = {
  book: Book;
  onProgressChange?: (progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
};

type PdfOutlineNode = {
  title: string;
  dest: string | unknown[] | null;
  items: PdfOutlineNode[];
};

type PdfTocItem = {
  id: string;
  title: string;
  pageIndex: number;
  level: number;
  generated: boolean;
  parentId: string | null;
  hasChildren: boolean;
};

type PdfTocMode = 'list' | 'thumbnails';
type PdfPageSize = {
  width: number;
  height: number;
};

const PDF_MIN_SCALE = 0.7;
const PDF_MAX_SCALE = 2.2;
const PDF_SCALE_STEP = 0.15;
const PDF_DEFAULT_SCALE = 1;
const PDF_TOC_DEFAULT_WIDTH = 280;
const PDF_TOC_MIN_WIDTH = 220;
const PDF_TOC_MAX_WIDTH = 420;
const PDF_TOC_THUMBNAIL_TARGET_WIDTH = 132;
const PDF_PAGE_RENDER_BUFFER = 2;
const PDF_DEFAULT_PAGE_SIZE: PdfPageSize = { width: 612, height: 792 };

function ensurePdfWorker() {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

function isPdfRefProxy(value: unknown): value is { num: number; gen: number } {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { num?: unknown }).num === 'number'
    && typeof (value as { gen?: unknown }).gen === 'number';
}

async function resolvePdfDestinationPageIndex(doc: PDFDocumentProxy, dest: string | unknown[] | null): Promise<number | null> {
  if (!dest) return null;
  const explicitDest = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
  if (!Array.isArray(explicitDest) || explicitDest.length === 0) return null;
  const pageRef = explicitDest[0];
  if (typeof pageRef === 'number' && Number.isFinite(pageRef)) {
    return Math.min(Math.max(0, Math.floor(pageRef)), Math.max(0, doc.numPages - 1));
  }
  if (isPdfRefProxy(pageRef)) {
    return await doc.getPageIndex(pageRef);
  }
  return null;
}

async function buildPdfTocItems(doc: PDFDocumentProxy, pageLabels: string[]): Promise<PdfTocItem[]> {
  const outline = await doc.getOutline() as PdfOutlineNode[] | null;
  const items: PdfTocItem[] = [];
  async function visit(nodes: PdfOutlineNode[], level: number, parentId: string | null) {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const pageIndex = await resolvePdfDestinationPageIndex(doc, node.dest).catch(() => null);
      let itemId: string | null = null;
      let itemIndex = -1;
      if (pageIndex !== null) {
        itemId = `outline:${items.length}:${pageIndex}`;
        itemIndex = items.push({
          id: itemId,
          title: node.title?.trim() || String(pageIndex + 1),
          pageIndex,
          level,
          generated: false,
          parentId,
          hasChildren: false,
        }) - 1;
      }
      const childParentId = itemId ?? parentId;
      if (node.items?.length) await visit(node.items, level + 1, childParentId);
      if (itemId && itemIndex >= 0) {
        items[itemIndex] = { ...items[itemIndex], hasChildren: items.some((item) => item.parentId === itemId) };
      }
    }
  }
  if (outline?.length) await visit(outline, 0, null);
  if (items.length) return items;
  return Array.from({ length: doc.numPages }, (_, index) => ({
    id: `page:${index}`,
    title: pageLabels[index] || String(index + 1),
    pageIndex: index,
    level: 0,
    generated: true,
    parentId: null,
    hasChildren: false,
  }));
}

function resolveVisiblePdfTocItems(items: PdfTocItem[], collapsedItemIds: Set<string>) {
  const hiddenParentIds = new Set<string>();
  const visibleItems: PdfTocItem[] = [];
  for (const item of items) {
    if (item.parentId && hiddenParentIds.has(item.parentId)) {
      if (item.hasChildren) hiddenParentIds.add(item.id);
      continue;
    }
    visibleItems.push(item);
    if (item.hasChildren && collapsedItemIds.has(item.id)) hiddenParentIds.add(item.id);
  }
  return visibleItems;
}

function PdfPageLayer({ bookId, doc, pageIndex, scale, onRendered }: { bookId: string; doc: PDFDocumentProxy; pageIndex: number; scale: number; onRendered: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerHostRef = useRef<HTMLDivElement | null>(null);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayerBuilder: TextLayerBuilder | null = null;
    const abortController = new AbortController();
    let page: PDFPageProxy | null = null;
    let allocatedPixels = 0;
    async function renderPage() {
      ensurePdfWorker();
      const canvas = canvasRef.current;
      const textLayerHost = textLayerHostRef.current;
      if (!canvas) return;
      page = await doc.getPage(pageIndex + 1);
      if (cancelled || !page) return;
      const viewport = page.getViewport({ scale: 1.45 * scale });
      const pixelRatio = clampCanvasPixelRatio(viewport.width, viewport.height, window.devicePixelRatio || 1, readerMediaCacheBudgets.pdfPageCanvasPixels);
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
      allocatedPixels = canvas.width * canvas.height;
      recordLifecycleDiagnostic('cache', 'pdf-page-canvas.allocated', { bookId, pageIndex, pixels: allocatedPixels, pixelBudget: readerMediaCacheBudgets.pdfPageCanvasPixels, entryLimit: readerMediaCacheBudgets.pdfPageCanvasEntries });
      canvas.style.width = `${Math.round(viewport.width)}px`;
      canvas.style.height = `${Math.round(viewport.height)}px`;
      if (textLayerHost) {
        textLayerHost.replaceChildren();
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport: page.getViewport({ scale: 1.45 * scale * pixelRatio }),
      });
      const canvasRenderPromise = renderTask.promise.then(() => {
        if (!cancelled) onRenderedRef.current();
      });
      const textLayerPromise = textLayerHost
        ? Promise.resolve().then(async () => {
          textLayerBuilder = new TextLayerBuilder({
            pdfPage: page!,
            onAppend: (element: HTMLDivElement) => {
              if (!cancelled) textLayerHost.append(element);
            },
            abortSignal: abortController.signal,
          });
          textLayerBuilder.div.classList.add('pdf-page-text-layer');
          await textLayerBuilder.render({
            viewport,
            images: null as never,
            textContentParams: {
              includeMarkedContent: true,
              disableNormalization: true,
            },
          });
        })
        : Promise.resolve();
      await Promise.all([canvasRenderPromise, textLayerPromise]);
    }
    void renderPage().catch((error) => {
      if (isPdfRenderingCancelled(error)) return;
      console.error('Failed to render PDF page:', error);
    });
    return () => {
      cancelled = true;
      abortController.abort();
      renderTask?.cancel?.();
      textLayerBuilder?.cancel?.();
      page?.cleanup?.();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      if (allocatedPixels) recordLifecycleDiagnostic('cache', 'pdf-page-canvas.released', { bookId, pageIndex, pixels: allocatedPixels });
      textLayerHostRef.current?.replaceChildren();
    };
  }, [bookId, doc, pageIndex, scale]);

  return (
    <>
      <canvas ref={canvasRef} className="pdf-page-canvas" />
      <div ref={textLayerHostRef} className="pdf-page-text-layer-host" aria-hidden="true" />
    </>
  );
}

function PdfTocThumbnail({ bookId, doc, pageIndex, width, pageSize, shouldRender, onVisibilityChange }: { bookId: string; doc: PDFDocumentProxy; pageIndex: number; width: number; pageSize: PdfPageSize; shouldRender: boolean; onVisibilityChange: (pageIndex: number, visible: boolean) => void }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetWidth = Math.max(PDF_TOC_THUMBNAIL_TARGET_WIDTH, width);
  const frameHeight = Number.isFinite(pageSize.width) && Number.isFinite(pageSize.height) && pageSize.width > 0 && pageSize.height > 0
    ? Math.max(136, Math.round(targetWidth * (pageSize.height / pageSize.width)))
    : 180;

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      onVisibilityChange(pageIndex, entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: '240px 0px' });
    observer.observe(element);
    return () => {
      onVisibilityChange(pageIndex, false);
      observer.disconnect();
    };
  }, [onVisibilityChange, pageIndex]);

  useEffect(() => {
    if (!shouldRender) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let page: PDFPageProxy | null = null;
    let allocatedPixels = 0;
    async function renderThumb() {
      ensurePdfWorker();
      const canvas = canvasRef.current;
      if (!canvas) return;
      page = await doc.getPage(pageIndex + 1);
      if (cancelled || !page) return;
      const baseViewport = page.getViewport({ scale: 1 });
      if (!Number.isFinite(baseViewport.width) || baseViewport.width <= 0) return;
      const scale = targetWidth / (baseViewport.width * 1.45);
      const viewport = page.getViewport({ scale: 1.45 * scale });
      const pixelRatio = clampCanvasPixelRatio(viewport.width, viewport.height, window.devicePixelRatio || 1, readerMediaCacheBudgets.pdfThumbnailCanvasPixels);
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
      allocatedPixels = canvas.width * canvas.height;
      recordLifecycleDiagnostic('cache', 'pdf-thumbnail-canvas.allocated', { bookId, pageIndex, pixels: allocatedPixels, pixelBudget: readerMediaCacheBudgets.pdfThumbnailCanvasPixels, entryLimit: readerMediaCacheBudgets.pdfThumbnailCanvasEntries });
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      const context = canvas.getContext('2d');
      if (!context) return;
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport: page.getViewport({ scale: 1.45 * scale * pixelRatio }),
      });
      await renderTask.promise;
      if (cancelled) return;
    }
    void renderThumb().catch((error) => {
      if (isPdfRenderingCancelled(error)) return;
      console.error('Failed to render PDF thumbnail:', error);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      page?.cleanup?.();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      if (allocatedPixels) recordLifecycleDiagnostic('cache', 'pdf-thumbnail-canvas.released', { bookId, pageIndex, pixels: allocatedPixels });
    };
  }, [bookId, doc, pageIndex, shouldRender, width]);

  return (
    <div ref={frameRef} className="pdf-reader-toc-thumb-frame" style={{ height: `${frameHeight}px` } as CSSProperties}>
      {shouldRender ? <canvas ref={canvasRef} className="pdf-reader-toc-thumb" aria-hidden="true" /> : null}
    </div>
  );
}

export function PdfReaderView({ book, onProgressChange }: PdfReaderViewProps) {
  const { t } = useI18n();
  const sourcePath = useMemo(() => book.sourceFilePath || book.filePath, [book.sourceFilePath, book.filePath]);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [estimatedPageSize, setEstimatedPageSize] = useState<PdfPageSize>(PDF_DEFAULT_PAGE_SIZE);
  const [renderWindow, setRenderWindow] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renderedCount, setRenderedCount] = useState(0);
  const [tocItems, setTocItems] = useState<PdfTocItem[]>([]);
  const [collapsedTocItemIds, setCollapsedTocItemIds] = useState<Set<string>>(() => new Set());
  const [tocOpen, setTocOpen] = useState(true);
  const [tocMode, setTocMode] = useState<PdfTocMode>('thumbnails');
  const [tocWidth, setTocWidth] = useState(PDF_TOC_DEFAULT_WIDTH);
  const [scale, setScale] = useState(PDF_DEFAULT_SCALE);
  const [thumbnailVisibilityOrder, setThumbnailVisibilityOrder] = useState<number[]>([]);
  const pageRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const estimatedPageSizeRef = useRef<PdfPageSize>(PDF_DEFAULT_PAGE_SIZE);
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const tocResizeRef = useRef<{ startX: number; startWidth: number; frame: number | null; nextWidth: number } | null>(null);
  const pageCanvasWindowRef = useRef<{ bookId: string; pageIndexes: Set<number> }>({ bookId: '', pageIndexes: new Set() });
  const thumbnailCanvasPagesRef = useRef<{ bookId: string; pageIndexes: Set<number> }>({ bookId: '', pageIndexes: new Set() });
  const pageIndexes = useMemo(() => Array.from({ length: pageCount }, (_, index) => index), [pageCount]);
  const visibleTocItems = useMemo(() => resolveVisiblePdfTocItems(tocItems, collapsedTocItemIds), [tocItems, collapsedTocItemIds]);
  const thumbnailCanvasPageIndexes = useMemo(() => new Set(thumbnailVisibilityOrder.slice(-readerMediaCacheBudgets.pdfThumbnailCanvasEntries)), [thumbnailVisibilityOrder]);

  const handleThumbnailVisibilityChange = useCallback((pageIndex: number, visible: boolean) => {
    setThumbnailVisibilityOrder((current) => {
      const withoutPage = current.filter((item) => item !== pageIndex);
      return visible ? [...withoutPage, pageIndex] : withoutPage;
    });
  }, []);

  const clampScale = (value: number) => Math.min(PDF_MAX_SCALE, Math.max(PDF_MIN_SCALE, Number.isFinite(value) ? value : PDF_DEFAULT_SCALE));
  const zoomIn = () => setScale((current) => clampScale(Number((current + PDF_SCALE_STEP).toFixed(2))));
  const zoomOut = () => setScale((current) => clampScale(Number((current - PDF_SCALE_STEP).toFixed(2))));
  const fitWidth = () => {
    const firstPage = estimatedPageSizeRef.current;
    const scrollArea = scrollRef.current;
    if (!scrollArea) {
      setScale(PDF_DEFAULT_SCALE);
      return;
    }
    const availableWidth = Math.max(320, scrollArea.clientWidth - 36);
    const unscaledWidth = firstPage.width;
    if (!Number.isFinite(unscaledWidth) || unscaledWidth <= 0) {
      setScale(PDF_DEFAULT_SCALE);
      return;
    }
    const nextScale = availableWidth / (unscaledWidth * 1.45);
    setScale(clampScale(Number(nextScale.toFixed(2))));
  };

  const clampTocWidth = (value: number) => Math.min(PDF_TOC_MAX_WIDTH, Math.max(PDF_TOC_MIN_WIDTH, Number.isFinite(value) ? value : PDF_TOC_DEFAULT_WIDTH));
  const tocThumbnailTargetWidth = Math.max(PDF_TOC_THUMBNAIL_TARGET_WIDTH, tocWidth - 28);

  function updateRenderWindow(centerIndex: number) {
    if (!pageCount) {
      setRenderWindow({ start: 0, end: 0 });
      return;
    }
    const start = Math.max(0, centerIndex - PDF_PAGE_RENDER_BUFFER);
    const end = Math.min(pageCount - 1, centerIndex + PDF_PAGE_RENDER_BUFFER);
    setRenderWindow((current) => current.start === start && current.end === end ? current : { start, end });
  }

  function jumpToPdfPage(pageIndex: number) {
    pageRefs.current[pageIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateRenderWindow(pageIndex);
  }

  function toggleTocItemCollapsed(itemId: string) {
    setCollapsedTocItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function reportPdfProgress() {
    if (!pageCount) return;
    const scroll = scrollRef.current;
    const scrollTop = scroll?.scrollTop ?? 0;
    const pageIndex = pageRefs.current.reduce((bestIndex, element, index) => {
      if (!element) return bestIndex;
      return element.offsetTop <= scrollTop + 120 ? index : bestIndex;
    }, 0);
    const pageCurrent = Math.min(pageCount, Math.max(1, pageIndex + 1));
    const progress = Math.round((pageCurrent / pageCount) * 100);
    updateRenderWindow(pageIndex);
    onProgressChange?.(progress, {
      pageCount,
      pageCurrent,
      chapterTitle: `Page ${pageCurrent}`,
      timestamp: new Date().toISOString(),
    });
  }

  useEffect(() => {
    estimatedPageSizeRef.current = estimatedPageSize;
    window.requestAnimationFrame(reportPdfProgress);
  }, [estimatedPageSize]);

  useEffect(() => {
    reportPdfProgress();
  }, [pageCount, onProgressChange]);

  useEffect(() => {
    setTocWidth(PDF_TOC_DEFAULT_WIDTH);
    setTocMode('thumbnails');
    setThumbnailVisibilityOrder([]);
  }, [book.id]);

  useEffect(() => {
    const currentPageIndexes = new Set<number>();
    for (let index = renderWindow.start; index <= renderWindow.end && index < pageCount; index += 1) currentPageIndexes.add(index);
    const previous = pageCanvasWindowRef.current;
    if (previous.bookId === book.id) {
      const evictedCount = [...previous.pageIndexes].filter((index) => !currentPageIndexes.has(index)).length;
      if (evictedCount) recordLifecycleDiagnostic('cache', 'pdf-page-canvas.evicted', { bookId: book.id, count: evictedCount, limit: readerMediaCacheBudgets.pdfPageCanvasEntries });
    }
    pageCanvasWindowRef.current = { bookId: book.id, pageIndexes: currentPageIndexes };
  }, [book.id, pageCount, renderWindow.end, renderWindow.start]);

  useEffect(() => {
    const previous = thumbnailCanvasPagesRef.current;
    if (previous.bookId === book.id) {
      const visiblePages = new Set(thumbnailVisibilityOrder);
      const evictedCount = [...previous.pageIndexes]
        .filter((index) => !thumbnailCanvasPageIndexes.has(index) && visiblePages.has(index))
        .length;
      if (evictedCount) recordLifecycleDiagnostic('cache', 'pdf-thumbnail-canvas.evicted', { bookId: book.id, count: evictedCount, limit: readerMediaCacheBudgets.pdfThumbnailCanvasEntries });
    }
    thumbnailCanvasPagesRef.current = { bookId: book.id, pageIndexes: thumbnailCanvasPageIndexes };
  }, [book.id, thumbnailCanvasPageIndexes, thumbnailVisibilityOrder]);

  useEffect(() => () => {
    recordLifecycleDiagnostic('cache', 'pdf-canvas-session.released', { bookId: book.id });
    pageCanvasWindowRef.current = { bookId: '', pageIndexes: new Set() };
    thumbnailCanvasPagesRef.current = { bookId: '', pageIndexes: new Set() };
  }, [book.id]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    async function loadDocument() {
      setLoading(true);
      setError('');
      setRenderedCount(0);
      setPageCount(0);
      setEstimatedPageSize(PDF_DEFAULT_PAGE_SIZE);
      estimatedPageSizeRef.current = PDF_DEFAULT_PAGE_SIZE;
      setRenderWindow({ start: 0, end: 0 });
      renderedPagesRef.current = new Set();
      setTocItems([]);
      setCollapsedTocItemIds(new Set());
      try {
        ensurePdfWorker();
        const data = await loadPdfSourceBytes(book.id);
        if (cancelled) return;
        loadingTask = getDocument({
          data,
          disableRange: true,
          disableStream: true,
          disableAutoFetch: true,
          useWorkerFetch: false,
          disableFontFace: false,
        });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }
        setPdfDocument(doc);
        const labels = await doc.getPageLabels().catch(() => null);
        if (!cancelled) {
          setTocItems(await buildPdfTocItems(doc, labels ?? []));
        }
        const firstPage = await doc.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        const nextEstimatedPageSize = {
          width: Number.isFinite(firstViewport.width) && firstViewport.width > 0 ? firstViewport.width : PDF_DEFAULT_PAGE_SIZE.width,
          height: Number.isFinite(firstViewport.height) && firstViewport.height > 0 ? firstViewport.height : PDF_DEFAULT_PAGE_SIZE.height,
        };
        firstPage.cleanup?.();
        if (!cancelled) {
          estimatedPageSizeRef.current = nextEstimatedPageSize;
          setPageCount(doc.numPages);
          setEstimatedPageSize(nextEstimatedPageSize);
          setRenderWindow({ start: 0, end: Math.min(doc.numPages - 1, PDF_PAGE_RENDER_BUFFER * 2) });
          setScale(PDF_DEFAULT_SCALE);
          setLoading(false);
        }
      } catch (loadError) {
        if (cancelled) return;
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    }
    void loadDocument();
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [book.id, sourcePath]);

  function rememberRenderedPage(pageIndex: number) {
    if (renderedPagesRef.current.has(pageIndex)) return;
    renderedPagesRef.current.add(pageIndex);
    setRenderedCount(renderedPagesRef.current.size);
  }

  function startTocResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = tocWidth;
    tocResizeRef.current = { startX, startWidth, frame: null, nextWidth: startWidth };
    const body = event.currentTarget.closest<HTMLElement>('.pdf-reader-body');
    const previewTocWidth = (width: number) => {
      body?.style.setProperty('--pdf-toc-width', `${clampTocWidth(width)}px`);
      body?.classList.add('pdf-toc-resizing');
    };
    previewTocWidth(startWidth);
    const onMove = (moveEvent: PointerEvent) => {
      const state = tocResizeRef.current;
      if (!state) return;
      state.nextWidth = clampTocWidth(state.startWidth + (moveEvent.clientX - state.startX));
      if (state.frame === null) {
        state.frame = window.requestAnimationFrame(() => {
          const current = tocResizeRef.current;
          if (!current) return;
          current.frame = null;
          previewTocWidth(current.nextWidth);
        });
      }
    };
    const onUp = () => {
      const state = tocResizeRef.current;
      if (state?.frame !== null && state?.frame !== undefined) window.cancelAnimationFrame(state.frame);
      if (state) {
        previewTocWidth(state.nextWidth);
        setTocWidth(state.nextWidth);
      }
      body?.classList.remove('pdf-toc-resizing');
      tocResizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === '=' || key === '+') {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (key === '-') {
        event.preventDefault();
        zoomOut();
        return;
      }
      if (key === '\\') {
        event.preventDefault();
        fitWidth();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <article className="reader-canvas pdf-reader-canvas" aria-label={t('reader.aria')}>
      <header className="pdf-reader-header">
        <div>
          <p className="eyebrow">PDF</p>
          <h2>{book.displayTitle || book.title}</h2>
        </div>
        <div className="pdf-reader-header-actions">
          <button
            type="button"
            className={tocOpen ? 'reader-icon-btn active' : 'reader-icon-btn'}
            data-tooltip={tocOpen ? t('reader.external.toc.hide') : t('reader.external.toc.show')}
            aria-label={tocOpen ? t('reader.external.toc.hide') : t('reader.external.toc.show')}
            aria-pressed={tocOpen}
            onClick={() => setTocOpen((current) => !current)}
          >
            <BookMindIcon name="pdfToc" />
          </button>
          <button type="button" className="reader-icon-btn" data-tooltip={t('reader.external.pdf.zoomOut')} aria-label={t('reader.external.pdf.zoomOut')} onClick={zoomOut}><BookMindIcon name="zoomOut" /></button>
          <button type="button" className="reader-icon-btn" data-tooltip={t('reader.external.pdf.fitWidth')} aria-label={t('reader.external.pdf.fitWidth')} onClick={fitWidth}><BookMindIcon name="fitWidth" /></button>
          <button type="button" className="reader-icon-btn" data-tooltip={t('reader.external.pdf.zoomIn')} aria-label={t('reader.external.pdf.zoomIn')} onClick={zoomIn}><BookMindIcon name="zoomIn" /></button>
          <p className="pdf-reader-hint">{loading ? t('reader.external.pdf.loading') : t('reader.external.pdf.pageCount', { count: pageCount, fileName: book.fileName })}</p>
        </div>
      </header>
      {error ? <div className="pdf-reader-error" role="alert">{error}</div> : null}
      <div className={`pdf-reader-body${tocOpen ? ' toc-open' : ''}`} style={tocOpen ? ({ '--pdf-toc-width': `${tocWidth}px` } as CSSProperties) : undefined}>
        {tocOpen ? (
          <aside className="pdf-reader-toc" aria-label={t('reader.external.pdf.tocAria')}>
            <div className="pdf-reader-toc-head">
              <div className="pdf-reader-toc-head-main">
                <strong>{t('reader.external.toc.title')}</strong>
              </div>
              <div className="pdf-reader-toc-mode-switch" role="tablist" aria-label={t('reader.external.toc.mode')}>
                <button type="button" className={tocMode === 'list' ? 'active' : ''} aria-label={t('reader.external.toc.listView')} aria-pressed={tocMode === 'list'} onClick={() => setTocMode('list')}><BookMindIcon name="toc" /></button>
                <button type="button" className={tocMode === 'thumbnails' ? 'active' : ''} aria-label={t('reader.external.toc.thumbnailView')} aria-pressed={tocMode === 'thumbnails'} onClick={() => setTocMode('thumbnails')}><BookMindIcon name="grid" /></button>
              </div>
            </div>
            <div className={tocMode === 'thumbnails' ? 'pdf-reader-toc-list thumbnails' : 'pdf-reader-toc-list list'}>
              {tocMode === 'thumbnails' ? pageIndexes.map((pageIndex) => (
                <button
                  key={`thumbnail:${pageIndex}`}
                  type="button"
                  onClick={() => jumpToPdfPage(pageIndex)}
                >
                  {pdfDocument ? <PdfTocThumbnail bookId={book.id} doc={pdfDocument} pageIndex={pageIndex} pageSize={estimatedPageSize} width={tocThumbnailTargetWidth} shouldRender={thumbnailCanvasPageIndexes.has(pageIndex)} onVisibilityChange={handleThumbnailVisibilityChange} /> : null}
                  <span className="pdf-reader-toc-page-label">{t('reader.external.pdf.pageLabel', { count: pageIndex + 1 })}</span>
                </button>
              )) : visibleTocItems.map((item) => (
                <div
                  key={item.id}
                  className={item.hasChildren ? 'pdf-reader-toc-row has-children' : 'pdf-reader-toc-row'}
                  style={{ '--pdf-toc-level': item.level } as CSSProperties}
                >
                  {item.hasChildren ? (
                    <button
                      type="button"
                      className={collapsedTocItemIds.has(item.id) ? 'pdf-reader-toc-toggle collapsed' : 'pdf-reader-toc-toggle'}
                      aria-label={collapsedTocItemIds.has(item.id) ? t('reader.external.toc.expand') : t('reader.external.toc.collapse')}
                      aria-expanded={!collapsedTocItemIds.has(item.id)}
                      onClick={() => toggleTocItemCollapsed(item.id)}
                    >
                      <span aria-hidden="true">⌄</span>
                    </button>
                  ) : <span className="pdf-reader-toc-toggle-spacer" />}
                  <button
                    type="button"
                    className="pdf-reader-toc-title-btn"
                    onClick={() => jumpToPdfPage(item.pageIndex)}
                    title={item.title}
                  >
                    <span className="pdf-reader-toc-item-body">
                      <strong>{item.title}</strong>
                    </span>
                    <em>{item.pageIndex + 1}</em>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="pdf-reader-toc-resize-grip"
              aria-label={t('reader.external.toc.resize')}
              onPointerDown={startTocResize}
            >
              <span />
            </button>
          </aside>
        ) : null}
        <div className="pdf-reader-frame">
        <div className="pdf-reader-scroll" ref={scrollRef} onScroll={reportPdfProgress}>
          {pageIndexes.map((index) => {
            const pageSize = estimatedPageSize;
            const displayWidth = Math.round(pageSize.width * 1.45 * scale);
            const displayHeight = Math.round(pageSize.height * 1.45 * scale);
            const shouldRenderPage = Boolean(pdfDocument && index >= renderWindow.start && index <= renderWindow.end);
            const activePdfDocument = shouldRenderPage ? pdfDocument : null;
            return (
            <section key={index} className="pdf-page-shell" ref={(element) => { pageRefs.current[index] = element; }} style={{ minHeight: `${displayHeight}px` } as CSSProperties}>
              <div className="pdf-page-badge">{t('reader.external.pdf.pageLabel', { count: index + 1 })}</div>
              <div className="pdf-page-virtual-frame" style={{ width: `${displayWidth}px`, height: `${displayHeight}px` } as CSSProperties}>
                {activePdfDocument ? (
                  <PdfPageLayer
                    bookId={book.id}
                    doc={activePdfDocument}
                    pageIndex={index}
                    scale={scale}
                    onRendered={() => rememberRenderedPage(index)}
                  />
                ) : null}
              </div>
            </section>
            );
          })}
          {!loading && !error && pageCount === 0 ? <div className="pdf-reader-empty">{t('reader.external.pdf.emptyPages')}</div> : null}
        </div>
        </div>
      </div>
      <footer className="pdf-reader-footer">
        <span>{loading ? t('common.loading') : t('reader.external.pdf.rendered', { rendered: renderedCount, total: pageCount, scale: Math.round(scale * 100) })}</span>
      </footer>
    </article>
  );
}

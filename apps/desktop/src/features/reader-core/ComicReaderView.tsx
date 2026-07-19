import { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Book } from '../../types';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import { cacheNetworkBookImage, loadNetworkBookChapter } from '../../services/unsupportedRuntime';
import { openExternalUrl } from '../../services/externalUrlService';
import { recordLifecycleDiagnostic } from '../../services/lifecycleDiagnosticsService';
import type { ReaderChapter } from './readerModel';
import { putBoundedRecordCache, readerMediaCacheBudgets } from './readerMediaCacheBudgetModel';
export { isComicBook } from './readerFormatDetectionModel';

type ComicReaderViewProps = {
  book: Book;
  chapters: ReaderChapter[];
  activeChapterIndex: number;
  onSelectChapter: (index: number) => void;
  onProgressChange?: (progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
};

type ComicChapterState = {
  title: string;
  images: string[];
};

const comicTocPageSize = 100;
const imageMarkerPattern = /\[\[BOOKMIND_EPUB_IMAGE:([^\]\n]+)\]\]/g;
const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/giu;
const plainImageUrlPattern = /^https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif)(?:[?#]\S*)?$/iu;
const comicProgressStoragePrefix = 'bookmind:comic-reader-progress:';

export function ComicReaderView({ book, chapters, activeChapterIndex, onSelectChapter, onProgressChange }: ComicReaderViewProps) {
  const { t } = useI18n();
  const [loadedChapters, setLoadedChapters] = useState<Record<string, ComicChapterState>>({});
  const [cachedImageMap, setCachedImageMap] = useState<Record<string, string>>({});
  const [loadingChapterIndex, setLoadingChapterIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [tocQuery, setTocQuery] = useState('');
  const [tocPage, setTocPage] = useState(1);
  const [tocJumpValue, setTocJumpValue] = useState('');
  const [fitMode, setFitMode] = useState<'width' | 'height'>('width');
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [preloadCount, setPreloadCount] = useState(1);
  const [visibleImageIndex, setVisibleImageIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imageRefs = useRef<Array<HTMLImageElement | null>>([]);
  const toolbarShellRef = useRef<HTMLDivElement | null>(null);
  const restoredChapterRef = useRef('');
  const preloadedChaptersRef = useRef<Set<string>>(new Set());
  const chapterLoadInFlightRef = useRef<Set<string>>(new Set());
  const imageCacheInFlightRef = useRef<Set<string>>(new Set());
  const loadedChaptersRef = useRef<Record<string, ComicChapterState>>({});
  const cachedImageMapRef = useRef<Record<string, string>>({});
  const loadedChapterOrderRef = useRef<string[]>([]);
  const cachedImageOrderRef = useRef<string[]>([]);
  const cacheSessionBookRef = useRef(book.id);
  const safeChapterIndex = Math.min(Math.max(activeChapterIndex, 0), Math.max(0, chapters.length - 1));
  const activeChapter = chapters[safeChapterIndex] ?? chapters[0];
  const cacheMatchesBook = cacheSessionBookRef.current === book.id;
  const activeLoaded = cacheMatchesBook && activeChapter ? loadedChapters[String(activeChapter.index)] : null;
  const activeImages = activeLoaded?.images ?? extractComicImagesFromChapter(activeChapter);
  const resolvedActiveImages = activeImages.map((src) => cacheMatchesBook ? cachedImageMap[src] ?? src : src);
  const displayTitle = book.displayTitle || book.title;
  const progressStorageKey = `${comicProgressStoragePrefix}${book.id}:${activeChapter?.index ?? 0}`;
  const normalizedTocQuery = tocQuery.trim().normalize('NFKC').toLowerCase();
  const filteredChapters = useMemo(() => chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter, index }) => {
      if (!normalizedTocQuery) return true;
      return chapter.title.normalize('NFKC').toLowerCase().includes(normalizedTocQuery) || String(index + 1).includes(normalizedTocQuery);
    }), [chapters, normalizedTocQuery]);
  const tocPageCount = Math.max(1, Math.ceil(filteredChapters.length / comicTocPageSize));
  const safeTocPage = Math.min(Math.max(1, tocPage), tocPageCount);
  const visibleTocChapters = filteredChapters.slice((safeTocPage - 1) * comicTocPageSize, safeTocPage * comicTocPageSize);

  function cacheLoadedChapter(chapterIndex: number, chapterState: ComicChapterState) {
    const result = putBoundedRecordCache(loadedChaptersRef.current, loadedChapterOrderRef.current, String(chapterIndex), chapterState, readerMediaCacheBudgets.comicChapterEntries);
    loadedChaptersRef.current = result.entries;
    loadedChapterOrderRef.current = result.order;
    setLoadedChapters(result.entries);
    if (result.evictedKeys.length) recordLifecycleDiagnostic('cache', 'comic-chapter.evicted', { bookId: book.id, count: result.evictedKeys.length, limit: readerMediaCacheBudgets.comicChapterEntries });
    recordLifecycleDiagnostic('cache', 'comic-chapter.cached', { bookId: book.id, chapterIndex, size: result.order.length, limit: readerMediaCacheBudgets.comicChapterEntries });
  }

  function cacheComicImage(sourceUrl: string, localPath: string) {
    const result = putBoundedRecordCache(cachedImageMapRef.current, cachedImageOrderRef.current, sourceUrl, cachedImageMapRef.current[sourceUrl] ?? localPath, readerMediaCacheBudgets.comicImageEntries);
    cachedImageMapRef.current = result.entries;
    cachedImageOrderRef.current = result.order;
    setCachedImageMap(result.entries);
    if (result.evictedKeys.length) recordLifecycleDiagnostic('cache', 'comic-image.evicted', { bookId: book.id, count: result.evictedKeys.length, limit: readerMediaCacheBudgets.comicImageEntries });
    recordLifecycleDiagnostic('cache', 'comic-image.cached', { bookId: book.id, size: result.order.length, limit: readerMediaCacheBudgets.comicImageEntries });
  }

  useEffect(() => {
    cacheSessionBookRef.current = book.id;
    loadedChaptersRef.current = {};
    cachedImageMapRef.current = {};
    loadedChapterOrderRef.current = [];
    cachedImageOrderRef.current = [];
    preloadedChaptersRef.current.clear();
    chapterLoadInFlightRef.current.clear();
    imageCacheInFlightRef.current.clear();
    setLoadedChapters({});
    setCachedImageMap({});
    return () => {
      recordLifecycleDiagnostic('cache', 'comic-session.released', {
        bookId: book.id,
        chapters: loadedChapterOrderRef.current.length,
        images: cachedImageOrderRef.current.length,
      });
      loadedChaptersRef.current = {};
      cachedImageMapRef.current = {};
      loadedChapterOrderRef.current = [];
      cachedImageOrderRef.current = [];
      preloadedChaptersRef.current.clear();
      chapterLoadInFlightRef.current.clear();
      imageCacheInFlightRef.current.clear();
    };
  }, [book.id]);

  useEffect(() => {
    setTocPage((current) => Math.min(Math.max(1, current), tocPageCount));
  }, [tocPageCount]);

  useEffect(() => {
    if (normalizedTocQuery) return;
    setTocPage(Math.floor(safeChapterIndex / comicTocPageSize) + 1);
  }, [safeChapterIndex, normalizedTocQuery]);

  useEffect(() => {
    if (!activeChapter || (cacheMatchesBook && loadedChapters[String(activeChapter.index)]) || activeImages.length) return;
    const chapterRequestKey = `${book.id}:${activeChapter.index}`;
    if (chapterLoadInFlightRef.current.has(chapterRequestKey)) return;
    let cancelled = false;
    const abortController = new AbortController();
    chapterLoadInFlightRef.current.add(chapterRequestKey);
    setError('');
    setLoadingChapterIndex(activeChapter.index);
    loadNetworkBookChapter(book.id, activeChapter.index, { signal: abortController.signal }).then((payload) => {
      if (cancelled) return;
      const images = payload.media.kind === 'comic' || payload.media.kind === 'image'
        ? payload.media.urls
        : extractComicImages(payload.content);
      if (!images.length) {
        setError(t('reader.comic.noImages'));
        return;
      }
      cacheLoadedChapter(payload.chapterIndex, { title: payload.title || activeChapter.title, images });
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
    }).finally(() => {
      chapterLoadInFlightRef.current.delete(chapterRequestKey);
      if (!cancelled) setLoadingChapterIndex(null);
    });
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [activeChapter, activeImages.length, book.id, cacheMatchesBook, loadedChapters, t]);

  useEffect(() => {
    const key = `${book.id}:${activeChapter?.index ?? 0}`;
    if (restoredChapterRef.current === key) return;
    restoredChapterRef.current = key;
    const raw = localStorage.getItem(progressStorageKey);
    const parsed = parseStoredProgress(raw);
    setVisibleImageIndex(parsed.imageIndex);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: parsed.top, behavior: 'auto' }));
  }, [activeChapter?.index, book.id, progressStorageKey]);

  useEffect(() => {
    if (!activeImages.length) return;
    let cancelled = false;
    const abortController = new AbortController();
    void (async () => {
      for (const [index, src] of activeImages.entries()) {
        if (cancelled) break;
        const imageRequestKey = `${book.id}:${src}`;
        if (!isRemoteComicImageNeedingCache(src) || (cacheMatchesBook && cachedImageMap[src])) continue;
        if (imageCacheInFlightRef.current.has(imageRequestKey)) continue;
        imageCacheInFlightRef.current.add(imageRequestKey);
        try {
          const payload = await cacheNetworkBookImage(book.id, activeChapter?.index ?? safeChapterIndex, index, src, { signal: abortController.signal });
          if (!cancelled) cacheComicImage(src, payload.localPath);
        } catch {
          // Keep the remote URL as a fallback; the reader should stay responsive even if caching fails.
        } finally {
          imageCacheInFlightRef.current.delete(imageRequestKey);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [activeChapter?.index, activeImages, book.id, cacheMatchesBook, cachedImageMap, safeChapterIndex]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !activeChapter) return;
    let frame = 0;
    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < imageRefs.current.length; index++) {
          const image = imageRefs.current[index];
          if (!image) continue;
          const distance = Math.abs(image.offsetTop - scrollEl.scrollTop - 24);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        }
        setVisibleImageIndex(bestIndex);
        localStorage.setItem(progressStorageKey, JSON.stringify({ top: scrollEl.scrollTop, imageIndex: bestIndex }));
      });
    };
    scrollEl.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
    return () => {
      cancelAnimationFrame(frame);
      scrollEl.removeEventListener('scroll', updateProgress);
    };
  }, [activeChapter, progressStorageKey, resolvedActiveImages.length]);

  useEffect(() => {
    if (!preloadCount || !activeChapter) return;
    let cancelled = false;
    const abortController = new AbortController();
    const max = Math.min(chapters.length - 1, safeChapterIndex + preloadCount);
    void (async () => {
      for (let index = safeChapterIndex + 1; index <= max; index++) {
        if (cancelled) break;
        const chapterRequestKey = `${book.id}:${index}`;
        if (preloadedChaptersRef.current.has(chapterRequestKey) || chapterLoadInFlightRef.current.has(chapterRequestKey)) continue;
        preloadedChaptersRef.current.add(chapterRequestKey);
        chapterLoadInFlightRef.current.add(chapterRequestKey);
        try {
          const payload = await loadNetworkBookChapter(book.id, index, { priority: 'preload', signal: abortController.signal });
          if (cancelled) break;
          const images = payload.media.kind === 'comic' || payload.media.kind === 'image'
            ? payload.media.urls
            : extractComicImages(payload.content);
          if (!loadedChaptersRef.current[String(payload.chapterIndex)]) cacheLoadedChapter(payload.chapterIndex, { title: payload.title || chapters[index]?.title || '', images });
          for (const [imageIndex, src] of images.entries()) {
            if (cancelled) break;
            const imageRequestKey = `${book.id}:${src}`;
            if (!isRemoteComicImageNeedingCache(src) || imageCacheInFlightRef.current.has(imageRequestKey)) continue;
            imageCacheInFlightRef.current.add(imageRequestKey);
            try {
              const imagePayload = await cacheNetworkBookImage(book.id, payload.chapterIndex, imageIndex, src, { priority: 'preload', signal: abortController.signal });
              if (!cancelled) cacheComicImage(src, imagePayload.localPath);
            } catch {
              // Preload failures are non-fatal; the active chapter loader can retry later.
            } finally {
              imageCacheInFlightRef.current.delete(imageRequestKey);
            }
          }
        } catch {
          preloadedChaptersRef.current.delete(chapterRequestKey);
        } finally {
          chapterLoadInFlightRef.current.delete(chapterRequestKey);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [activeChapter, book.id, chapters, preloadCount, safeChapterIndex]);

  useEffect(() => {
    if (!activeChapter) return;
    const pageCount = Math.max(1, chapters.length);
    const pageCurrent = Math.min(pageCount, safeChapterIndex + 1);
    onProgressChange?.(Math.round((pageCurrent / pageCount) * 100), {
      pageCount,
      pageCurrent,
      chapterTitle: activeLoaded?.title || activeChapter.title,
      timestamp: new Date().toISOString(),
    });
  }, [activeChapter, activeLoaded?.title, chapters.length, safeChapterIndex, onProgressChange]);

  function updateTocQuery(value: string) {
    setTocQuery(value);
    setTocPage(1);
  }

  function jumpTocPage() {
    const parsed = Number.parseInt(tocJumpValue, 10);
    if (!Number.isFinite(parsed)) return;
    setTocPage(Math.min(Math.max(1, parsed), tocPageCount));
  }

  function selectChapter(index: number) {
    onSelectChapter(index);
  }

  function toggleFocusMode() {
    const scrollEl = scrollRef.current;
    const toolbarHeight = toolbarShellRef.current?.getBoundingClientRect().height ?? 0;
    const previousTop = scrollEl?.scrollTop ?? 0;
    setFocusMode((enabled) => !enabled);
    requestAnimationFrame(() => {
      if (!scrollEl) return;
      scrollEl.scrollTo({ top: Math.max(0, previousTop + (focusMode ? -toolbarHeight : toolbarHeight)), behavior: 'auto' });
    });
  }

  return (
    <article className={`reader-canvas comic-reader-canvas${tocCollapsed ? ' toc-collapsed' : ''}`} aria-label={t('reader.comic.aria')}>
      <aside className="comic-toc" aria-label={t('reader.comic.toc')}>
        <div className="comic-toc-head">
          <strong>{t('reader.comic.toc')}</strong>
          <span>{t('reader.chapterCount', { current: safeChapterIndex + 1, total: Math.max(1, chapters.length) })}</span>
          <button type="button" onClick={() => setTocCollapsed(true)} aria-label={t('reader.comic.collapseToc')}><BookMindIcon name="libraryGroupCollapse" /></button>
        </div>
        <div className="comic-toc-tools">
          <label>
            <BookMindIcon name="readerSearch" />
            <input value={tocQuery} onChange={(event) => updateTocQuery(event.target.value)} placeholder={t('reader.comic.searchPlaceholder')} aria-label={t('reader.comic.searchPlaceholder')} />
          </label>
          <div className="comic-toc-pager" aria-label={t('reader.comic.pageAria')}>
            <button type="button" disabled={safeTocPage <= 1} onClick={() => setTocPage(1)}>{t('reader.pagination.first')}</button>
            <button type="button" disabled={safeTocPage <= 1} onClick={() => setTocPage((page) => Math.max(1, page - 1))}>{t('reader.pagination.prev')}</button>
            <span>{safeTocPage}/{tocPageCount}</span>
            <button type="button" disabled={safeTocPage >= tocPageCount} onClick={() => setTocPage((page) => Math.min(tocPageCount, page + 1))}>{t('reader.pagination.next')}</button>
            <button type="button" disabled={safeTocPage >= tocPageCount} onClick={() => setTocPage(tocPageCount)}>{t('reader.pagination.last')}</button>
          </div>
          <div className="comic-toc-jump">
            <input value={tocJumpValue} onChange={(event) => setTocJumpValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jumpTocPage(); }} inputMode="numeric" aria-label={t('reader.pagination.jump')} placeholder={t('reader.pagination.jump')} />
            <button type="button" onClick={jumpTocPage}>{t('reader.pagination.jump')}</button>
          </div>
          <span className="comic-toc-count">{t('reader.comic.pageSummary', { shown: visibleTocChapters.length, total: filteredChapters.length })}</span>
        </div>
        <div className="comic-toc-list">
          {visibleTocChapters.length ? visibleTocChapters.map(({ chapter, index }) => (
            <button className={index === safeChapterIndex ? 'active' : ''} type="button" key={chapter.id} onClick={() => selectChapter(index)}>
              <span>{chapter.title}</span>
              <em>{index + 1}</em>
            </button>
          )) : <p className="comic-toc-empty">{t('reader.comic.searchEmpty')}</p>}
        </div>
      </aside>
      <main className={`comic-stage${focusMode ? ' focus-mode' : ''}`}>
        <div className="comic-toolbar-shell" ref={toolbarShellRef}>
          <header className="comic-toolbar">
            <div>
              <strong>{activeLoaded?.title || activeChapter?.title || displayTitle}</strong>
              <span>{displayTitle} · {book.networkSource?.sourceName || t('reader.networkTools.sourceLoading')}</span>
            </div>
            <div className="comic-toolbar-actions">
              {tocCollapsed ? <button type="button" onClick={() => setTocCollapsed(false)} data-tooltip={t('reader.comic.toc')} title={t('reader.comic.toc')} aria-label={t('reader.comic.toc')}><BookMindIcon name="toc" /></button> : null}
              <button type="button" disabled={safeChapterIndex <= 0} onClick={() => selectChapter(safeChapterIndex - 1)} data-tooltip={t('reader.prevChapter')} title={t('reader.prevChapter')} aria-label={t('reader.prevChapter')}><BookMindIcon name="prevPage" /></button>
              <button type="button" disabled={safeChapterIndex >= chapters.length - 1} onClick={() => selectChapter(safeChapterIndex + 1)} data-tooltip={t('reader.nextChapter')} title={t('reader.nextChapter')} aria-label={t('reader.nextChapter')}><BookMindIcon name="nextPage" /></button>
              <label className="comic-preload-control" data-tooltip={t('reader.networkTools.preloadCount')} title={t('reader.networkTools.preloadCount')}>
                <BookMindIcon name="networkTools" />
                <input type="number" min={0} max={5} value={preloadCount} onChange={(event) => setPreloadCount(Math.min(5, Math.max(0, Number.parseInt(event.target.value, 10) || 0)))} aria-label={t('reader.networkTools.preloadCount')} />
              </label>
              <button type="button" className={fitMode === 'height' ? 'active' : ''} onClick={() => setFitMode((mode) => mode === 'width' ? 'height' : 'width')} data-tooltip={fitMode === 'width' ? t('reader.comic.fitHeight') : t('reader.comic.fitWidth')} title={fitMode === 'width' ? t('reader.comic.fitHeight') : t('reader.comic.fitWidth')} aria-label={fitMode === 'width' ? t('reader.comic.fitHeight') : t('reader.comic.fitWidth')}><BookMindIcon name="fitWidth" /></button>
              <button type="button" className={focusMode ? 'active' : ''} onClick={toggleFocusMode} data-tooltip={focusMode ? t('reader.comic.exitFocus') : t('reader.comic.focusMode')} title={focusMode ? t('reader.comic.exitFocus') : t('reader.comic.focusMode')} aria-label={focusMode ? t('reader.comic.exitFocus') : t('reader.comic.focusMode')}><BookMindIcon name="focusMode" /></button>
              <button type="button" onClick={() => book.networkSource?.bookUrl && void openExternalUrl(book.networkSource.bookUrl)} data-tooltip={t('reader.networkTools.openSite')} title={t('reader.networkTools.openSite')} aria-label={t('reader.networkTools.openSite')}><BookMindIcon name="networkTools" /></button>
            </div>
          </header>
        </div>
        <div className={`comic-scroll fit-${fitMode}`} ref={scrollRef}>
          {loadingChapterIndex === activeChapter?.index ? <div className="comic-loading">{t('reader.comic.loading')}</div> : null}
          {error ? <div className="comic-error" role="alert">{error}</div> : null}
          {!loadingChapterIndex && !activeImages.length && !error ? <div className="comic-empty">{t('reader.comic.waiting')}</div> : null}
          {resolvedActiveImages.map((src, index) => (
            <figure className="comic-page" key={`${src}-${index}`}>
              <img ref={(node) => { imageRefs.current[index] = node; }} src={resolveComicImageSrc(src)} alt={`${activeChapter?.title || displayTitle} ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} draggable={false} />
            </figure>
          ))}
        </div>
        <footer className="comic-footer">
          <span>{Math.min(activeImages.length, visibleImageIndex + 1)}/{Math.max(1, activeImages.length)}</span>
          <span>{safeChapterIndex + 1}/{Math.max(1, chapters.length)}</span>
        </footer>
      </main>
    </article>
  );
}

function extractComicImagesFromChapter(chapter: ReaderChapter | null | undefined) {
  if (!chapter) return [];
  return extractComicImages(chapter.paragraphs.join('\n'));
}

function extractComicImages(text: string) {
  const images: string[] = [];
  for (const match of text.matchAll(imageMarkerPattern)) {
    const src = (match[1] ?? '').trim();
    if (src) images.push(src);
  }
  for (const match of text.matchAll(htmlImagePattern)) {
    const src = (match[1] ?? '').trim();
    if (src) images.push(src.replace(/&amp;/g, '&'));
  }
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (plainImageUrlPattern.test(trimmed)) images.push(trimmed);
  }
  return Array.from(new Set(images));
}

function resolveComicImageSrc(src: string) {
  if (/^(?:https?|data|blob|asset):/i.test(src)) return src;
  try {
    return convertFileSrc(src);
  } catch {
    return src;
  }
}

function isRemoteComicImageNeedingCache(src: string) {
  return /^https?:\/\/manhua\.acimg\.cn\//i.test(src);
}

function parseStoredProgress(raw: string | null) {
  if (!raw) return { top: 0, imageIndex: 0 };
  try {
    const parsed = JSON.parse(raw) as { top?: unknown; imageIndex?: unknown };
    return {
      top: typeof parsed.top === 'number' && Number.isFinite(parsed.top) ? parsed.top : 0,
      imageIndex: typeof parsed.imageIndex === 'number' && Number.isFinite(parsed.imageIndex) ? Math.max(0, parsed.imageIndex) : 0,
    };
  } catch {
    return { top: 0, imageIndex: 0 };
  }
}

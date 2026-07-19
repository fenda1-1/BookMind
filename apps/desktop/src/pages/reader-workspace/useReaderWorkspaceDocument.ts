import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  applyTocEdits,
  getHiddenReaderChapters,
  getReaderTocEditHashStatus,
  type ReaderTocEdit,
  type ReaderTocManifest,
} from '../../features/reader-core/readerModel';
import type { ReaderDocumentWorkerRequest, ReaderDocumentWorkerResponse } from '../../features/reader-core/readerDocumentWorker';
import { isMarkdownBookFormat } from '../../features/reader-core/markdownReaderModel';
import { readerMediaCacheBudgets } from '../../features/reader-core/readerMediaCacheBudgetModel';
import { hydrateReaderSettingsV2FromBackend, loadGlobalReaderSettings, normalizeReaderSettings } from '../../features/reader-core/readerSettings';
import { subscribeNetworkPreloadChanged, subscribeReaderGlobalSettingsUpdated } from '../../features/reader-core/readerDomainEvents';
import type { ReaderChapter } from '../../features/reader-core/readerModel';
import { createBrowserDemoAnnotations, isBrowserDemoBookId, loadReaderDocument } from '../../services/libraryService';
import { getNetworkBookManifest } from '../../services/unsupportedRuntime';
import { requestLibraryRefresh } from '../../services/appDomainEvents';
import { recordLifecycleDiagnostic } from '../../services/lifecycleDiagnosticsService';
import { loadNetworkBookChapter } from '../../services/unsupportedRuntime';
import {
  getPrivacyBookTitle,
  getPrivacyFileName,
  getPrivacyFilePath,
  isApplicationPrivacyEnabled,
  loadChapterRules,
  loadExtendedSettings,
  subscribeSettingsUpdated,
  shouldHideRecentReading,
  type ChapterRuleDraft,
  type ExtendedSettings,
  type SettingsUpdatedDetail,
} from '../../services/settingsCenterService';
import type { Book, ReaderBookmark, ReaderHighlight, ReaderHighlightColor, ReaderSettings, ReaderSettingsLevel } from '../../types';
import type { Translator } from '../../i18n';
import {
  loadReaderChapterRulesOverride,
  loadReaderState,
  loadReaderTocManifest,
  restoreReaderCollection,
  restoreReaderState,
  type ReaderStoredPanelPlacements,
  type ReaderTocEditHistoryEntry,
} from '../readerWorkspaceStorage';
import {
  createInitialReaderWorkspaceState,
  applyReaderLaunchLocation,
  createReaderChapterParsingOptions,
  createReaderCleanupOptions,
  createReaderDocumentWorkerBook,
  createTocEditHistoryFromEdits,
  getRecentReaderBook,
  rebuildReaderTocManifestAfterRuleChange,
  rebuildReaderTocManifestIfMissingOrEmpty,
  repairReaderHighlightsForCurrentToc,
  resolveEffectiveReaderTheme,
  shouldRestoreReaderState,
} from '../readerWorkspaceModel';
import {
  createReaderDocumentCacheState,
  getReaderDocumentCache,
  getReaderDocumentModelCache,
  putReaderDocumentCache,
  putReaderDocumentModelCache,
  resolveInstantReaderBook,
  shouldBlockForReaderDocument,
  type ReaderDocumentCacheMutation,
  type ReaderDocumentModel,
} from './readerDocumentCacheModel';

const readerDocumentCache = createReaderDocumentCacheState();
const readerDocumentPrewarmInFlight = new Set<string>();
const READER_DOCUMENT_CACHE_SIZE = readerMediaCacheBudgets.documentEntries;
const READER_DOCUMENT_MODEL_CACHE_SIZE = readerMediaCacheBudgets.documentModelEntries;
const READER_DOCUMENT_PREWARM_LIMIT = 0;
const NETWORK_CHAPTER_PLACEHOLDER = '网络章节未加载，点击目录后获取正文。';
const NETWORK_AUDIO_URL_PATTERN = /^https?:\/\/\S+\.(?:m4a|mp3|aac|wav|ogg|opus|flac)(?:[?#].*)?$/i;

function recordReaderCacheEvictions(bookId: string, cacheName: 'reader-document' | 'reader-model', mutation: ReaderDocumentCacheMutation | null, limit: number) {
  if (!mutation?.evictedKeys.length) return;
  recordLifecycleDiagnostic('cache', `${cacheName}.evicted`, {
    bookId,
    count: mutation.evictedKeys.length,
    cacheSize: mutation.cacheSize,
    limit,
  });
}

type UseReaderWorkspaceDocumentContext = {
  book: Book | null;
  availableBooks: Book[];
  hidden: boolean;
  standaloneReader: boolean;
  restoreStartupReaderPosition: boolean;
  readerDocument: Book | null;
  setReaderDocument: Dispatch<SetStateAction<Book | null>>;
  readerDocumentError: string;
  setReaderDocumentError: Dispatch<SetStateAction<string>>;
  extendedSettings: ExtendedSettings;
  setExtendedSettings: Dispatch<SetStateAction<ExtendedSettings>>;
  chapterRules: ChapterRuleDraft;
  setChapterRules: Dispatch<SetStateAction<ChapterRuleDraft>>;
  settings: ReaderSettings;
  setSettings: Dispatch<SetStateAction<ReaderSettings>>;
  activeChapterIndex: number;
  setActiveChapterIndex: Dispatch<SetStateAction<number>>;
  activeParagraphIndex: number;
  setActiveParagraphIndex: Dispatch<SetStateAction<number>>;
  activeScreenPage: number;
  setActiveScreenPage: Dispatch<SetStateAction<number>>;
  aiCollapsed: boolean;
  setAiCollapsed: Dispatch<SetStateAction<boolean>>;
  tocOpen: boolean;
  setTocOpen: Dispatch<SetStateAction<boolean>>;
  settingsLevel: ReaderSettingsLevel;
  setSettingsLevel: Dispatch<SetStateAction<ReaderSettingsLevel>>;
  setReaderPanelPlacements: (placements: Partial<ReaderStoredPanelPlacements> | null | undefined) => void;
  setReaderReady: Dispatch<SetStateAction<boolean>>;
  highlights: ReaderHighlight[];
  setHighlights: Dispatch<SetStateAction<ReaderHighlight[]>>;
  bookmarks: ReaderBookmark[];
  setBookmarks: Dispatch<SetStateAction<ReaderBookmark[]>>;
  defaultHighlightColor: ReaderHighlightColor;
  setDefaultHighlightColor: Dispatch<SetStateAction<ReaderHighlightColor>>;
  tocEdits: ReaderTocEdit[];
  setTocEdits: Dispatch<SetStateAction<ReaderTocEdit[]>>;
  tocManifest: ReaderTocManifest | null;
  setTocManifest: Dispatch<SetStateAction<ReaderTocManifest | null>>;
  tocManifestLoaded: boolean;
  setTocManifestLoaded: Dispatch<SetStateAction<boolean>>;
  bookChapterRulesOverride: Partial<ChapterRuleDraft> | null;
  setBookChapterRulesOverride: Dispatch<SetStateAction<Partial<ChapterRuleDraft> | null>>;
  bookChapterRulesOverrideLoaded: boolean;
  setBookChapterRulesOverrideLoaded: Dispatch<SetStateAction<boolean>>;
  setTocEditUndoStack: Dispatch<SetStateAction<ReaderTocEdit[][]>>;
  setTocEditRedoStack: Dispatch<SetStateAction<ReaderTocEdit[][]>>;
  setTocEditHistory: Dispatch<SetStateAction<ReaderTocEditHistoryEntry[]>>;
  readerDocumentModel: ReaderDocumentModel | null;
  setReaderDocumentModel: Dispatch<SetStateAction<ReaderDocumentModel | null>>;
  setReaderStorageError: Dispatch<SetStateAction<string>>;
  t: Translator;
};

export function useReaderWorkspaceDocument({
  book,
  availableBooks,
  hidden,
  standaloneReader,
  restoreStartupReaderPosition,
  readerDocument,
  setReaderDocument,
  readerDocumentError,
  setReaderDocumentError,
  extendedSettings,
  setExtendedSettings,
  chapterRules,
  setChapterRules,
  settings,
  setSettings,
  activeChapterIndex: _activeChapterIndex,
  setActiveChapterIndex,
  activeParagraphIndex: _activeParagraphIndex,
  setActiveParagraphIndex,
  activeScreenPage: _activeScreenPage,
  setActiveScreenPage,
  aiCollapsed: _aiCollapsed,
  setAiCollapsed,
  tocOpen: _tocOpen,
  setTocOpen,
  settingsLevel: _settingsLevel,
  setSettingsLevel,
  setReaderPanelPlacements,
  setReaderReady,
  highlights,
  setHighlights,
  bookmarks: _bookmarks,
  setBookmarks,
  defaultHighlightColor: _defaultHighlightColor,
  setDefaultHighlightColor,
  tocEdits,
  setTocEdits,
  tocManifest,
  setTocManifest,
  tocManifestLoaded,
  setTocManifestLoaded,
  bookChapterRulesOverride,
  setBookChapterRulesOverride,
  bookChapterRulesOverrideLoaded,
  setBookChapterRulesOverrideLoaded,
  setTocEditUndoStack,
  setTocEditRedoStack,
  setTocEditHistory,
  readerDocumentModel,
  setReaderDocumentModel,
  setReaderStorageError,
  t,
}: UseReaderWorkspaceDocumentContext) {
  const normalizedFormat = book?.format.toLowerCase() ?? '';
  const isPdfBook = normalizedFormat === 'pdf';
  const isMarkdownBook = isMarkdownBookFormat(normalizedFormat);
  const isNetworkBook = book?.sourceKind === 'network' || normalizedFormat === 'network';
  const isExternalRenderBook = isPdfBook || isMarkdownBook;
  let readerBook = resolveInstantReaderBook(book, isExternalRenderBook, readerDocument, readerDocumentCache);
  if (isNetworkBook) readerBook = book;
  const tocManifestForReaderBook = readerBook && tocManifest?.contentHash === readerBook.contentHash ? tocManifest : null;
  const tocManifestReadyForReaderBook = Boolean(readerBook && tocManifestLoaded && (!tocManifest || tocManifest.contentHash === readerBook.contentHash));
  const bookChapterRulesReadyForReaderBook = Boolean(readerBook && bookChapterRulesOverrideLoaded);
  const effectiveChapterRules = useMemo(() => ({ ...chapterRules, ...(bookChapterRulesReadyForReaderBook ? bookChapterRulesOverride ?? {} : {}) }), [chapterRules, bookChapterRulesOverride, bookChapterRulesReadyForReaderBook]);
  const chapterParsingOptions = useMemo(() => createReaderChapterParsingOptions(effectiveChapterRules), [effectiveChapterRules]);
  const [networkPreloadCount, setNetworkPreloadCount] = useState(() => {
    if (typeof window === 'undefined' || !book?.id) return book?.networkSource?.preloadedChapterCount ?? 3;
    const stored = Number(window.localStorage.getItem(`bookmind:network-preload:${book.id}`));
    return Number.isFinite(stored) ? Math.max(0, Math.min(50, stored)) : book?.networkSource?.preloadedChapterCount ?? 3;
  });
  const restoringRef = useRef(false);
  const tocEditHistoryHydratedBookRef = useRef('');
  const ruleChangeTocRebuildInFlightRef = useRef(false);
  const pendingTocRuleRebuildRef = useRef<{ mode: ExtendedSettings['tocRuleChangeRebuildMode']; previewDiff: boolean } | null>(null);
  const networkChapterLoadInFlightRef = useRef<Set<string>>(new Set());
  const networkLibraryRefreshTimerRef = useRef<number | null>(null);
  const stateKey = book ? `bookmind:reader-state:${book.id}` : '';
  const highlightsKey = book ? `bookmind:reader-highlights:${book.id}` : '';
  const bookmarksKey = book ? `bookmind:reader-bookmarks:${book.id}` : '';
  const highlightColorKey = book ? `bookmind:reader-highlight-color:${book.id}` : '';
  const tocEditsKey = book ? `bookmind:reader-toc-edits:${book.id}` : '';
  const windowKey = book ? `bookmind:reader-window:${book.id}` : '';
  const readerDocumentModelSignature = useMemo(() => {
    if (!readerBook) return '';
    if (isNetworkBook) {
      return JSON.stringify({
        bookId: readerBook.id,
        contentHash: readerBook.contentHash,
        sourceKind: 'network',
        tocCount: readerBook.networkSource?.tocCount ?? 0,
      });
    }
    return JSON.stringify({
      bookId: readerBook.id,
      contentHash: readerBook.contentHash,
      contentLength: readerBook.content.length,
      cleanup: createReaderCleanupOptions(effectiveChapterRules, settings.preserveBlankLines),
      chapterParsingOptions,
      tocManifestHash: tocManifestForReaderBook ? `${tocManifestForReaderBook.contentHash}:${tocManifestForReaderBook.parserVersion}:${tocManifestForReaderBook.entries.length}:${tocManifestForReaderBook.optionsSignature}` : '',
    });
  }, [readerBook?.id, readerBook?.contentHash, readerBook?.content.length, readerBook?.networkSource?.tocCount, isNetworkBook, effectiveChapterRules, settings.preserveBlankLines, chapterParsingOptions, tocManifestForReaderBook]);
  const cachedReaderDocumentModel = readerDocumentModelSignature ? getReaderDocumentModelCache(readerDocumentCache, readerDocumentModelSignature) : null;
  const activeReaderDocumentModel = readerDocumentModel && readerBook && readerDocumentModel.bookId === readerBook.id && readerDocumentModel.contentHash === readerBook.contentHash && readerDocumentModel.signature === readerDocumentModelSignature
    ? readerDocumentModel
    : cachedReaderDocumentModel;
  const sourceChapters = activeReaderDocumentModel?.sourceChapters ?? [];
  const cleanedContent = activeReaderDocumentModel?.cleanedContent ?? '';
  const chapters = useMemo(() => applyTocEdits(sourceChapters, tocEdits), [sourceChapters, tocEdits]);
  const hiddenChapters = useMemo(() => getHiddenReaderChapters(sourceChapters, tocEdits), [sourceChapters, tocEdits]);
  const repairedHighlights = useMemo(() => repairReaderHighlightsForCurrentToc(highlights, chapters, hiddenChapters, { repairStrategy: extendedSettings.anchorRepairStrategy }), [highlights, chapters, hiddenChapters, extendedSettings.anchorRepairStrategy]);
  const tocContentHash = useMemo(() => book?.contentHash || `${cleanedContent.length}:${sourceChapters.length}`, [book?.contentHash, cleanedContent.length, sourceChapters.length]);
  const tocEditHashStatus = useMemo(() => getReaderTocEditHashStatus(tocEdits, tocContentHash), [tocEdits, tocContentHash]);
  const recentBook = useMemo(() => getRecentReaderBook(availableBooks), [availableBooks]);
  const effectiveReaderSettings = useMemo(() => ({
    ...settings,
    privacyMode: settings.privacyMode || isApplicationPrivacyEnabled(extendedSettings),
    theme: resolveEffectiveReaderTheme(settings.theme, extendedSettings.appTheme, extendedSettings.readerThemeFollowsApp),
  }), [settings, extendedSettings.readerThemeFollowsApp, extendedSettings.appTheme, extendedSettings.applicationPrivacyMode]);
  const displayBook = useMemo(() => book ? {
    ...book,
    title: getPrivacyBookTitle(book.title, extendedSettings),
    displayTitle: getPrivacyBookTitle(book.displayTitle, extendedSettings),
    fileName: getPrivacyFileName(book.fileName, extendedSettings),
    filePath: getPrivacyFilePath(book.filePath, extendedSettings),
  } : null, [book, extendedSettings.applicationPrivacyMode, extendedSettings.hideBookTitlesInPrivacyMode, extendedSettings.hideFilePathsInPrivacyMode]);
  const displayRecentBook = useMemo(() => {
    if (!recentBook || shouldHideRecentReading(extendedSettings)) return null;
    return {
      ...recentBook,
      title: getPrivacyBookTitle(recentBook.title, extendedSettings),
      displayTitle: getPrivacyBookTitle(recentBook.displayTitle, extendedSettings),
    };
  }, [recentBook, extendedSettings.applicationPrivacyMode, extendedSettings.hideBookTitlesInPrivacyMode, extendedSettings.hideRecentReadingInPrivacyMode, extendedSettings.recordRecentReaderBooks]);
  const tocRebuildContextRef = useRef({ book: readerBook, settings, tocManifest: tocManifestForReaderBook, tocManifestLoaded: tocManifestReadyForReaderBook, bookChapterRulesOverride, sourceChapters });
  tocRebuildContextRef.current = { book: readerBook, settings, tocManifest: tocManifestForReaderBook, tocManifestLoaded: tocManifestReadyForReaderBook, bookChapterRulesOverride, sourceChapters };

  useLayoutEffect(() => {
    const nextInitialState = createInitialReaderWorkspaceState(book, standaloneReader, loadReaderState);
    if (!book) {
      setReaderReady(true);
      return;
    }
    if (isExternalRenderBook) {
      setReaderReady(true);
      return;
    }
    if (nextInitialState) {
      restoringRef.current = true;
      setSettings(loadGlobalReaderSettings());
      setActiveChapterIndex(nextInitialState.activeChapterIndex);
      setActiveParagraphIndex(nextInitialState.activeParagraphIndex);
      setActiveScreenPage(nextInitialState.activeScreenPage);
      setAiCollapsed(nextInitialState.aiCollapsed);
      setTocOpen(nextInitialState.tocOpen);
      setSettingsLevel(nextInitialState.settingsLevel);
      setReaderPanelPlacements(nextInitialState.panelPlacements);
      setReaderReady(true);
      window.requestAnimationFrame(() => { restoringRef.current = false; });
      return;
    }
    setReaderReady(false);
  }, [book?.id, standaloneReader, isPdfBook, isMarkdownBook]);

  useEffect(() => {
    if (!book?.id) return;
    const stored = Number(window.localStorage.getItem(`bookmind:network-preload:${book.id}`));
    setNetworkPreloadCount(Number.isFinite(stored) ? Math.max(0, Math.min(50, stored)) : book.networkSource?.preloadedChapterCount ?? 3);
  }, [book?.id, book?.networkSource?.preloadedChapterCount]);

  useEffect(() => {
    function onNetworkPreloadChanged(detail: { bookId: string; preloadCount: number }) {
      if (!detail || detail.bookId !== book?.id) return;
      setNetworkPreloadCount(Math.max(0, Math.min(50, detail.preloadCount ?? 3)));
    }
    return subscribeNetworkPreloadChanged(onNetworkPreloadChanged);
  }, [book?.id]);

  useEffect(() => {
    if (!readerBook || isExternalRenderBook) {
      setReaderDocumentModel(null);
      return;
    }
    if (isNetworkBook) return;
    if (!tocManifestReadyForReaderBook || !bookChapterRulesReadyForReaderBook) return;
    const cachedModel = getReaderDocumentModelCache(readerDocumentCache, readerDocumentModelSignature);
    recordLifecycleDiagnostic('cache', cachedModel ? 'reader-model.cache-hit' : 'reader-model.cache-miss', {
      bookId: readerBook.id,
      cacheSize: readerDocumentCache.models.size,
    });
    if (cachedModel) {
      setReaderDocumentModel(cachedModel);
      return;
    }
    if (readerDocumentModel?.signature === readerDocumentModelSignature && readerDocumentModel.sourceChapters.length) return;
    const requestId = `${readerBook.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const parseStartedAt = performance.now();
    const worker = new Worker(new URL('../../features/reader-core/readerDocumentWorker.ts', import.meta.url), { type: 'module' });
    let disposed = false;
    setReaderDocumentModel((current) => ({
      bookId: readerBook.id,
      contentHash: readerBook.contentHash,
      cleanedContent: current?.bookId === readerBook.id ? current.cleanedContent : '',
      sourceChapters: current?.bookId === readerBook.id ? current.sourceChapters : [],
      signature: readerDocumentModelSignature,
      loading: true,
      error: '',
    }));
    worker.onmessage = (event: MessageEvent<ReaderDocumentWorkerResponse>) => {
      if (disposed || event.data.requestId !== requestId) return;
      if (event.data.ok) {
        const nextModel = {
          bookId: readerBook.id,
          contentHash: readerBook.contentHash,
          cleanedContent: event.data.cleanedContent,
          sourceChapters: event.data.sourceChapters,
          signature: readerDocumentModelSignature,
          loading: false,
          error: '',
        };
        const cacheMutation = putReaderDocumentModelCache(readerDocumentCache, nextModel, READER_DOCUMENT_MODEL_CACHE_SIZE);
        recordReaderCacheEvictions(readerBook.id, 'reader-model', cacheMutation, READER_DOCUMENT_MODEL_CACHE_SIZE);
        recordLifecycleDiagnostic('cache', 'reader-model.cached', { bookId: readerBook.id, cacheSize: cacheMutation?.cacheSize ?? readerDocumentCache.models.size, chapterCount: nextModel.sourceChapters.length, limit: READER_DOCUMENT_MODEL_CACHE_SIZE });
        recordLifecycleDiagnostic('performance', 'reader-document.parsed', { bookId: readerBook.id, durationMs: Math.round(performance.now() - parseStartedAt), chapterCount: nextModel.sourceChapters.length });
        setReaderDocumentModel(nextModel);
      } else {
        recordLifecycleDiagnostic('performance', 'reader-document.parse-failed', { bookId: readerBook.id, durationMs: Math.round(performance.now() - parseStartedAt) });
        setReaderDocumentModel({
          bookId: readerBook.id,
          contentHash: readerBook.contentHash,
          cleanedContent: '',
          sourceChapters: [],
          signature: readerDocumentModelSignature,
          loading: false,
          error: event.data.error,
        });
      }
      worker.terminate();
    };
    worker.onerror = (event) => {
      if (disposed) return;
      recordLifecycleDiagnostic('performance', 'reader-document.parse-failed', { bookId: readerBook.id, durationMs: Math.round(performance.now() - parseStartedAt) });
      setReaderDocumentModel({
        bookId: readerBook.id,
        contentHash: readerBook.contentHash,
        cleanedContent: '',
        sourceChapters: [],
        signature: readerDocumentModelSignature,
        loading: false,
        error: event.message || 'reader-document-worker-error',
      });
      worker.terminate();
    };
    worker.postMessage({
      requestId,
      book: createReaderDocumentWorkerBook(readerBook),
      cleanupOptions: createReaderCleanupOptions(effectiveChapterRules, settings.preserveBlankLines),
      tocManifest: tocManifestForReaderBook,
      chapterParsingOptions,
    } satisfies ReaderDocumentWorkerRequest);
    return () => {
      disposed = true;
      worker.terminate();
    };
  }, [readerBook, tocManifestReadyForReaderBook, bookChapterRulesReadyForReaderBook, readerDocumentModelSignature, isExternalRenderBook, isNetworkBook]);

  useEffect(() => {
    if (!readerBook || !isNetworkBook || isExternalRenderBook) return;
    let cancelled = false;
    const signature = readerDocumentModelSignature;
    setReaderDocumentModel((current) => ({
      bookId: readerBook.id,
      contentHash: readerBook.contentHash,
      cleanedContent: current?.bookId === readerBook.id ? current.cleanedContent : '',
      sourceChapters: current?.bookId === readerBook.id ? current.sourceChapters : [],
      signature,
      loading: true,
      error: '',
    }));
    getNetworkBookManifest(readerBook.id).then((manifest) => {
      if (cancelled) return;
      const sourceChapters: ReaderChapter[] = manifest.toc.map((chapter) => ({
        id: `network-${readerBook.id}-${chapter.index}`,
        title: chapter.title || `第 ${chapter.index + 1} 章`,
        index: chapter.index,
        startLine: chapter.index,
        paragraphs: [NETWORK_CHAPTER_PLACEHOLDER],
        characterCount: 0,
        contentSignature: `network:${chapter.index}:pending`,
      }));
      setReaderDocumentModel({
        bookId: readerBook.id,
        contentHash: readerBook.contentHash,
        cleanedContent: sourceChapters.map((chapter) => chapter.title).join('\n'),
        sourceChapters,
        signature,
        loading: false,
        error: '',
      });
    }).catch((error) => {
      if (cancelled) return;
      setReaderDocumentModel({
        bookId: readerBook.id,
        contentHash: readerBook.contentHash,
        cleanedContent: '',
        sourceChapters: [],
        signature,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [readerBook?.id, readerBook?.contentHash, isNetworkBook, isExternalRenderBook, readerDocumentModelSignature]);

  useEffect(() => {
    if (!readerBook || !isNetworkBook || !activeReaderDocumentModel || activeReaderDocumentModel.loading) return;
    const activeIndex = Math.max(0, _activeChapterIndex);
    const preloadCount = Math.max(0, Math.min(50, networkPreloadCount));
    const targets = Array.from({ length: preloadCount + 1 }, (_, offset) => activeIndex + offset)
      .filter((index) => index < activeReaderDocumentModel.sourceChapters.length);
    let cancelled = false;
    const abortController = new AbortController();
    recordLifecycleDiagnostic('reader-session', 'network-chapter-load.started', {
      bookId: readerBook.id,
      activeChapterIndex: activeIndex,
      preloadCount,
      targetCount: targets.length,
    });
    void (async () => {
      for (const targetIndex of targets) {
        if (cancelled) break;
        const currentChapter = activeReaderDocumentModel.sourceChapters[targetIndex];
        if (!currentChapter || currentChapter.contentSignature?.includes(':loaded:')) continue;
        const loadKey = `${readerBook.id}:${currentChapter.index}`;
        if (networkChapterLoadInFlightRef.current.has(loadKey)) continue;
        networkChapterLoadInFlightRef.current.add(loadKey);
        try {
          const payload = await loadNetworkBookChapter(readerBook.id, currentChapter.index, {
            priority: targetIndex === activeIndex ? 'active' : 'preload',
            signal: abortController.signal,
          });
          if (cancelled) break;
          const paragraphs = payload.content
            .split(/\r?\n+/u)
            .map((line) => line.trim())
            .filter(Boolean);
          const contentSummary = summarizeNetworkChapterContent(payload.title || currentChapter.title, payload.content, paragraphs);
          setReaderDocumentModel((current) => {
            if (!current || current.bookId !== readerBook.id || current.signature !== activeReaderDocumentModel.signature) return current;
            const nextChapters = current.sourceChapters.map((chapter) => chapter.index === payload.chapterIndex ? {
              ...chapter,
              title: payload.title || chapter.title,
              paragraphs: paragraphs.length ? paragraphs : [NETWORK_CHAPTER_PLACEHOLDER],
              characterCount: payload.content.length,
              contentSignature: `network:${payload.chapterIndex}:loaded:${payload.content.length}`,
            } : chapter);
            return {
              ...current,
              sourceChapters: nextChapters,
              cleanedContent: buildNetworkDocumentSummary(nextChapters, payload.chapterIndex, contentSummary),
            };
          });
          scheduleNetworkLibraryRefresh(networkLibraryRefreshTimerRef);
          recordLifecycleDiagnostic('cache', 'network-chapter-load.cached', {
            bookId: readerBook.id,
            chapterIndex: payload.chapterIndex,
            contentLength: payload.content.length,
            priority: targetIndex === activeIndex ? 'active' : 'preload',
          });
        } catch (error) {
          if (cancelled || abortController.signal.aborted) break;
          recordLifecycleDiagnostic('source-execution', 'network-chapter-load.failed', {
            bookId: readerBook.id,
            chapterIndex: currentChapter.index,
            priority: targetIndex === activeIndex ? 'active' : 'preload',
            error: error instanceof Error ? error.name : 'unknown',
          });
          if (targetIndex !== activeIndex) continue;
          setReaderDocumentModel((current) => current && current.bookId === readerBook.id ? {
            ...current,
            error: error instanceof Error ? error.message : String(error),
            loading: false,
          } : current);
        } finally {
          networkChapterLoadInFlightRef.current.delete(loadKey);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
      recordLifecycleDiagnostic('cancellation', 'network-chapter-load.cancelled', {
        bookId: readerBook.id,
        activeChapterIndex: activeIndex,
        targetCount: targets.length,
      });
    };
  }, [readerBook?.id, isNetworkBook, activeReaderDocumentModel?.signature, activeReaderDocumentModel?.loading, _activeChapterIndex, networkPreloadCount]);

  useEffect(() => () => {
    if (networkLibraryRefreshTimerRef.current !== null) {
      window.clearTimeout(networkLibraryRefreshTimerRef.current);
      networkLibraryRefreshTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!book) {
      setReaderDocument(null);
      setReaderDocumentError('');
      return;
    }
    if (isExternalRenderBook) {
      setReaderDocument(null);
      setReaderDocumentError('');
      return;
    }
    if (isNetworkBook) {
      setReaderDocument(null);
      setReaderDocumentError('');
      return;
    }
    const cachedDocument = getReaderDocumentCache(readerDocumentCache, book.id);
    recordLifecycleDiagnostic('cache', cachedDocument ? 'reader-document.cache-hit' : 'reader-document.cache-miss', {
      bookId: book.id,
      cacheSize: readerDocumentCache.documents.size,
    });
    if (cachedDocument && readerDocument?.id !== book.id) {
      setReaderDocument(cachedDocument);
    } else if (readerDocument && readerDocument.id !== book.id) {
      setReaderDocument(null);
    }
    if (book.content) {
      const cacheMutation = putReaderDocumentCache(readerDocumentCache, book, READER_DOCUMENT_CACHE_SIZE);
      recordReaderCacheEvictions(book.id, 'reader-document', cacheMutation, READER_DOCUMENT_CACHE_SIZE);
      recordLifecycleDiagnostic('cache', 'reader-document.cached-inline', { bookId: book.id, cacheSize: cacheMutation?.cacheSize ?? readerDocumentCache.documents.size, limit: READER_DOCUMENT_CACHE_SIZE });
      setReaderDocument(null);
      setReaderDocumentError('');
      return;
    }
    if (hidden || readerDocument?.id === book.id || cachedDocument) return;
    let cancelled = false;
    const loadStartedAt = performance.now();
    recordLifecycleDiagnostic('performance', 'reader-document.load-started', { bookId: book.id });
    setReaderDocumentError('');
    loadReaderDocument(book.id).then((document) => {
      if (cancelled) return;
      const cacheMutation = putReaderDocumentCache(readerDocumentCache, document, READER_DOCUMENT_CACHE_SIZE);
      recordReaderCacheEvictions(book.id, 'reader-document', cacheMutation, READER_DOCUMENT_CACHE_SIZE);
      recordLifecycleDiagnostic('cache', 'reader-document.cached-loaded', { bookId: book.id, cacheSize: cacheMutation?.cacheSize ?? readerDocumentCache.documents.size, limit: READER_DOCUMENT_CACHE_SIZE });
      recordLifecycleDiagnostic('performance', 'reader-document.loaded', { bookId: book.id, durationMs: Math.round(performance.now() - loadStartedAt), contentLength: document.content?.length ?? 0 });
      setReaderDocument(document);
    }).catch((error) => {
      if (cancelled) return;
      console.error('Failed to load reader document:', error);
      recordLifecycleDiagnostic('performance', 'reader-document.load-failed', { bookId: book.id, durationMs: Math.round(performance.now() - loadStartedAt) });
      setReaderDocumentError(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
    };
  }, [book?.id, book?.content, hidden, readerDocument?.id, isExternalRenderBook, isNetworkBook]);

  useEffect(() => {
    if (READER_DOCUMENT_PREWARM_LIMIT <= 0) return;
    if (hidden || !book || isExternalRenderBook) return;
    const candidates = availableBooks
      .filter((item) => {
        if (!item.id || item.deleted || item.content) return false;
        if (item.id === book.id) return false;
        const format = item.format.toLowerCase();
        if (format === 'pdf') return false;
        if (readerDocumentCache.documents.has(item.id) || readerDocumentPrewarmInFlight.has(item.id)) return false;
        return format === 'txt' || format === 'md' || format === 'markdown' || format === 'epub' || format === 'mobi';
      })
      .sort((left, right) => {
        const progressDelta = right.progress - left.progress;
        if (progressDelta !== 0) return progressDelta;
        return Date.parse(right.importedAt || '') - Date.parse(left.importedAt || '');
      })
      .slice(0, READER_DOCUMENT_PREWARM_LIMIT);
    if (!candidates.length) return;
    let cancelled = false;
    void (async () => {
      for (const candidate of candidates) {
        if (cancelled) break;
        readerDocumentPrewarmInFlight.add(candidate.id);
        try {
          const document = await loadReaderDocument(candidate.id);
          if (!cancelled) {
            const cacheMutation = putReaderDocumentCache(readerDocumentCache, document, READER_DOCUMENT_CACHE_SIZE);
            recordReaderCacheEvictions(candidate.id, 'reader-document', cacheMutation, READER_DOCUMENT_CACHE_SIZE);
            recordLifecycleDiagnostic('cache', 'reader-document.cached-prewarm', { bookId: candidate.id, cacheSize: cacheMutation?.cacheSize ?? readerDocumentCache.documents.size, limit: READER_DOCUMENT_CACHE_SIZE });
          }
        } catch (error) {
          console.warn('Failed to prewarm reader document:', candidate.id, error);
        } finally {
          readerDocumentPrewarmInFlight.delete(candidate.id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book?.id, availableBooks, hidden, isExternalRenderBook]);

  useEffect(() => {
    function handleChapterRulesChanged(detail: SettingsUpdatedDetail | undefined, nextExtendedSettings: ExtendedSettings) {
      if (!detail || (detail.scope !== 'chapterRules' && detail.scope !== 'all')) return;
      if (!tocRebuildContextRef.current.book || !tocRebuildContextRef.current.tocManifestLoaded) return;
      pendingTocRuleRebuildRef.current = {
        mode: nextExtendedSettings.tocRuleChangeRebuildMode,
        previewDiff: nextExtendedSettings.previewTocRebuildDiff,
      };
    }

    function refreshExtendedSettings(detail?: SettingsUpdatedDetail) {
      const nextExtendedSettings = detail?.extended ?? loadExtendedSettings();
      setExtendedSettings(nextExtendedSettings);
      if (!detail || detail.scope === 'chapterRules' || detail.scope === 'all') {
        setChapterRules(loadChapterRules());
        handleChapterRulesChanged(detail, nextExtendedSettings);
      }
    }
    return subscribeSettingsUpdated(refreshExtendedSettings);
  }, []);

  useEffect(() => {
    void hydrateReaderSettingsV2FromBackend();
    function onGlobalReaderSettingsUpdated(detail: { settings: ReaderSettings; changedKeys?: (keyof ReaderSettings)[]; reason?: 'user-action' | 'hydrate' }) {
      if (restoringRef.current) return;
      const nextSettings = detail?.settings ?? loadGlobalReaderSettings();
      const changedKeys = detail?.changedKeys?.filter((key): key is keyof ReaderSettings => key in nextSettings) ?? [];
      if (changedKeys.length) {
        const livePatch = changedKeys.reduce<Partial<ReaderSettings>>((patch, key) => {
          patch[key] = nextSettings[key] as never;
          return patch;
        }, {});
        setSettings((current) => normalizeReaderSettings({ ...current, ...livePatch }));
        return;
      }
      setSettings(normalizeReaderSettings(nextSettings));
      setSettingsLevel('basic');
    }
    return subscribeReaderGlobalSettingsUpdated(onGlobalReaderSettingsUpdated);
  }, [setSettings, setSettingsLevel]);

  useEffect(() => {
    if (!book) return;
    restoringRef.current = true;
    if (!shouldRestoreReaderState(restoreStartupReaderPosition, standaloneReader)) {
      setSettings(loadGlobalReaderSettings());
      setActiveChapterIndex(0);
      setActiveParagraphIndex(0);
      setActiveScreenPage(0);
      setAiCollapsed(false);
      setTocOpen(true);
      setSettingsLevel('basic');
      setReaderPanelPlacements(null);
      setReaderReady(true);
      window.requestAnimationFrame(() => { restoringRef.current = false; });
      return;
    }
    restoreReaderState(book.id, stateKey, () => setReaderStorageError(t('reader.storage.corruptRecovered'))).then((stored) => {
      if (stored) {
        const restoredState = applyReaderLaunchLocation(stored, standaloneReader);
        setSettings(loadGlobalReaderSettings());
        setActiveChapterIndex(restoredState.activeChapterIndex);
        setActiveParagraphIndex(restoredState.activeParagraphIndex);
        setActiveScreenPage(restoredState.activeScreenPage);
        setAiCollapsed(restoredState.aiCollapsed);
        setTocOpen(restoredState.tocOpen);
        setSettingsLevel(restoredState.settingsLevel);
        setReaderPanelPlacements(restoredState.panelPlacements);
        setReaderReady(true);
      } else if (!standaloneReader) {
        setSettings(loadGlobalReaderSettings());
        setActiveChapterIndex(0);
        setActiveParagraphIndex(0);
        setActiveScreenPage(0);
        setAiCollapsed(false);
        setTocOpen(true);
        setSettingsLevel('basic');
        setReaderPanelPlacements(null);
        setReaderReady(true);
      }
    }).finally(() => {
      window.requestAnimationFrame(() => { restoringRef.current = false; });
    });
  }, [book?.id, restoreStartupReaderPosition, stateKey, standaloneReader, t]);

  useEffect(() => {
    if (!book) {
      setHighlights([]);
      setBookmarks([]);
      setDefaultHighlightColor(extendedSettings.defaultHighlightColor);
      setTocEdits([]);
      setTocManifest(null);
      setTocManifestLoaded(false);
      setBookChapterRulesOverride(null);
      setBookChapterRulesOverrideLoaded(false);
      setTocEditUndoStack([]);
      setTocEditRedoStack([]);
      setTocEditHistory([]);
      tocEditHistoryHydratedBookRef.current = '';
      return;
    }
    let cancelled = false;
    tocEditHistoryHydratedBookRef.current = '';
    setTocManifestLoaded(false);
    setBookChapterRulesOverrideLoaded(false);
    loadReaderTocManifest(book.id, () => setReaderStorageError(t('reader.storage.corruptRecovered'))).then((nextManifest) => {
      if (cancelled) return;
      setTocManifest(nextManifest);
      setTocManifestLoaded(true);
    });
    loadReaderChapterRulesOverride(book.id, () => setReaderStorageError(t('reader.storage.corruptRecovered'))).then((nextOverride) => {
      if (cancelled) return;
      setBookChapterRulesOverride(nextOverride);
      setBookChapterRulesOverrideLoaded(true);
    });
    restoreReaderCollection(book.id, highlightsKey, bookmarksKey, highlightColorKey, tocEditsKey, extendedSettings.defaultHighlightColor, settings.encryptSensitiveReaderData, () => setReaderStorageError(t('reader.storage.corruptRecovered'))).then((stored) => {
      if (cancelled) return;
      const demoSeed = isBrowserDemoBookId(book.id) ? createBrowserDemoAnnotations(book.id) : null;
      setHighlights(stored.highlights.length ? stored.highlights : (demoSeed?.highlights ?? []));
      setBookmarks(stored.bookmarks.length ? stored.bookmarks : (demoSeed?.bookmarks ?? []));
      setDefaultHighlightColor(stored.defaultHighlightColor);
      setTocEdits(stored.tocEdits);
      setTocEditUndoStack([]);
      setTocEditRedoStack([]);
      setTocEditHistory([]);
    });
    return () => { cancelled = true; };
  }, [book?.id, highlightsKey, bookmarksKey, highlightColorKey, tocEditsKey, t, extendedSettings.defaultHighlightColor, settings.encryptSensitiveReaderData]);

  useEffect(() => {
    if (!book?.id || !sourceChapters.length || !tocEdits.length) return;
    if (tocEditHistoryHydratedBookRef.current === book.id) return;
    tocEditHistoryHydratedBookRef.current = book.id;
    setTocEditHistory(createTocEditHistoryFromEdits(tocEdits, sourceChapters, t));
  }, [book?.id, sourceChapters, tocEdits, t]);

  useEffect(() => {
    if (!readerBook || !tocManifestReadyForReaderBook || !bookChapterRulesReadyForReaderBook) return;
    void rebuildReaderTocManifestIfMissingOrEmpty(readerBook, sourceChapters, tocManifestForReaderBook, chapterParsingOptions, extendedSettings.autoRebuildTocWhenEmpty)
      .then((nextManifest) => {
        if (nextManifest) setTocManifest(nextManifest);
      });
  }, [readerBook?.id, readerBook?.contentHash, sourceChapters, tocManifestForReaderBook, tocManifestReadyForReaderBook, bookChapterRulesReadyForReaderBook, chapterParsingOptions, extendedSettings.autoRebuildTocWhenEmpty]);

  useEffect(() => {
    const pending = pendingTocRuleRebuildRef.current;
    if (!pending || !readerBook || !tocManifestReadyForReaderBook || sourceChapters.length === 0 || ruleChangeTocRebuildInFlightRef.current) return;
    if (!activeReaderDocumentModel || activeReaderDocumentModel.loading || activeReaderDocumentModel.signature !== readerDocumentModelSignature) return;
    pendingTocRuleRebuildRef.current = null;
    ruleChangeTocRebuildInFlightRef.current = true;
    void rebuildReaderTocManifestAfterRuleChange(readerBook, sourceChapters, tocManifestForReaderBook, chapterParsingOptions, pending.mode, pending.previewDiff)
      .then((nextManifest) => {
        if (nextManifest) setTocManifest(nextManifest);
      })
      .catch((error) => {
        console.warn('Failed to rebuild reader TOC manifest after chapter rules changed:', error);
      })
      .finally(() => {
        ruleChangeTocRebuildInFlightRef.current = false;
      });
  }, [readerBook, sourceChapters, tocManifestForReaderBook, tocManifestReadyForReaderBook, chapterParsingOptions, activeReaderDocumentModel, readerDocumentModelSignature]);

  const readerDocumentModelError = activeReaderDocumentModel?.error ?? '';
  const isReaderDocumentModelLoading = Boolean(!isExternalRenderBook && readerBook && (!activeReaderDocumentModel || activeReaderDocumentModel.loading || (!sourceChapters.length && !activeReaderDocumentModel.error)));
  const isReaderDocumentLoading = shouldBlockForReaderDocument({
    isPdfBook: isExternalRenderBook,
    book,
    readerBook,
    activeModel: activeReaderDocumentModel,
    sourceChapterCount: sourceChapters.length,
    readerDocumentError,
    readerDocumentModelError,
  });

  return {
    readerBook,
    sourceChapters,
    chapters,
    hiddenChapters,
    repairedHighlights,
    tocContentHash,
    tocEditHashStatus,
    effectiveReaderSettings,
    displayBook,
    displayRecentBook,
    readerDocumentModelError,
    isReaderDocumentLoading,
    restoringRef,
    stateKey,
    highlightsKey,
    bookmarksKey,
    highlightColorKey,
    tocEditsKey,
    windowKey,
  };
}

function summarizeNetworkChapterContent(title: string, rawContent: string, paragraphs: string[]) {
  const normalized = paragraphs.join('\n').replace(/&amp;/g, '&').trim();
  if (NETWORK_AUDIO_URL_PATTERN.test(normalized)) {
    let host = '';
    try {
      host = new URL(normalized).host;
    } catch {
      host = '';
    }
    return [title, `音频章节${host ? `：${host}` : ''}`].filter(Boolean).join('\n');
  }
  return [title, trimNetworkSummary(rawContent, 4000)].filter(Boolean).join('\n');
}

function buildNetworkDocumentSummary(chapters: ReaderChapter[], loadedChapterIndex: number, loadedSummary: string) {
  return chapters.map((chapter) => {
    if (chapter.index === loadedChapterIndex) return loadedSummary;
    if (chapter.contentSignature?.includes(':loaded:')) {
      return [chapter.title, trimNetworkSummary(chapter.paragraphs.join('\n'), 1200)].filter(Boolean).join('\n');
    }
    return chapter.title;
  }).join('\n\n');
}

function trimNetworkSummary(content: string, maxLength: number) {
  const normalized = content.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}\n...`;
}

function scheduleNetworkLibraryRefresh(timerRef: { current: number | null }) {
  if (typeof window === 'undefined') return;
  if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  timerRef.current = window.setTimeout(() => {
    timerRef.current = null;
    requestLibraryRefresh();
  }, 800);
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react';
import { useI18n } from '../../i18n';
import { loadExtendedSettings, subscribeSettingsUpdated, type ExtendedSettings, type SettingsUpdatedDetail } from '../../services/settingsCenterService';
import { subscribeReaderCacheCleared, subscribeReaderSearchDataCleared } from './readerDomainEvents';
import type { ReaderBookmark } from '../../types';
import type { ReaderSavedSearch } from './ReaderToolbar';
import { parseBoundedInteger, resolveReaderSearchChapterFilterDefault, shouldUseReaderSearchChapterFilter, toReaderSearchLimit, toReaderSearchScope } from './readerInteractionModel';
import type { ReaderChapter, ReaderHighlightRange, ReaderPageEntry, ReaderSearchHit, ReaderSearchOptions, ReaderSearchScope } from './readerModel';
import type { ReaderSearchWorkerRequest, ReaderSearchWorkerResponse } from './readerSearchWorker';

type ReaderToolbarSelectOption<T extends string> = {
  value: T;
  label: string;
};

type UseReaderSearchControllerParams = {
  chapters: ReaderChapter[];
  highlights: ReaderHighlightRange[];
  bookmarks: ReaderBookmark[];
  activeChapterIndex: number;
  activePageEntries?: ReaderPageEntry[];
  extendedSettings: ExtendedSettings;
  onJumpToSearchHit: (hit: ReaderSearchHit) => void;
};

type ReaderSearchController = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchPanelOpen: boolean;
  setSearchPanelOpen: Dispatch<SetStateAction<boolean>>;
  readerSearchQuery: string;
  setReaderSearchQuery: Dispatch<SetStateAction<string>>;
  debouncedReaderSearchQuery: string;
  readerSearchHits: ReaderSearchHit[];
  readerSearchScope: ReaderSearchScope;
  setReaderSearchScope: Dispatch<SetStateAction<ReaderSearchScope>>;
  readerSearchScopeOptions: ReaderToolbarSelectOption<ReaderSearchScope>[];
  readerSearchChapterFilter: number | 'all';
  readerSearchChapterFilterEnabled: boolean;
  setReaderSearchChapterFilter: Dispatch<SetStateAction<number | 'all'>>;
  readerSearchChapterOptions: ReaderToolbarSelectOption<string>[];
  readerSearchLimit: number;
  setReaderSearchLimit: Dispatch<SetStateAction<number>>;
  readerSearchCaseSensitive: boolean;
  setReaderSearchCaseSensitive: Dispatch<SetStateAction<boolean>>;
  readerSearchFuzzy: boolean;
  setReaderSearchFuzzy: Dispatch<SetStateAction<boolean>>;
  readerSearchRegex: boolean;
  setReaderSearchRegex: Dispatch<SetStateAction<boolean>>;
  readerSearchNormalizeTraditionalChinese: boolean;
  setReaderSearchNormalizeTraditionalChinese: Dispatch<SetStateAction<boolean>>;
  readerSearchNormalizeNfkc: boolean;
  setReaderSearchNormalizeNfkc: Dispatch<SetStateAction<boolean>>;
  readerSearchPinyinInitials: boolean;
  setReaderSearchPinyinInitials: Dispatch<SetStateAction<boolean>>;
  readerSavedSearchLimit: number;
  readerSearchHistoryLimit: number;
  readerSavedSearches: ReaderSavedSearch[];
  readerSearchHistory: ReaderSavedSearch[];
  activeSearchHitIndex: number;
  setActiveSearchHitIndex: Dispatch<SetStateAction<number>>;
  jumpToSearchHit: (hit: ReaderSearchHit) => void;
  goRelativeSearchHit: (delta: number) => void;
  openReaderSearchPanel: () => void;
  onReaderSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  saveReaderSearch: () => void;
  applyReaderSavedSearch: (saved: ReaderSavedSearch) => void;
};

export function useReaderSearchController({
  chapters,
  highlights,
  bookmarks,
  activeChapterIndex,
  activePageEntries,
  extendedSettings,
  onJumpToSearchHit,
}: UseReaderSearchControllerParams): ReaderSearchController {
  const { t } = useI18n();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [readerSearchQuery, setReaderSearchQuery] = useState('');
  const [readerSearchScope, setReaderSearchScope] = useState<ReaderSearchScope>(() => toReaderSearchScope(extendedSettings.searchScope));
  const [readerSearchCaseSensitive, setReaderSearchCaseSensitive] = useState(() => extendedSettings.caseSensitive);
  const [readerSearchFuzzy, setReaderSearchFuzzy] = useState(() => extendedSettings.fuzzy);
  const [readerSearchRegex, setReaderSearchRegex] = useState(() => extendedSettings.regex);
  const [readerSearchRegexFallbackLiteral, setReaderSearchRegexFallbackLiteral] = useState(() => extendedSettings.readerSearchRegexFallbackLiteral);
  const [readerSearchNormalizeTraditionalChinese, setReaderSearchNormalizeTraditionalChinese] = useState(() => extendedSettings.searchNormalizeTraditionalChinese);
  const [readerSearchNormalizeNfkc, setReaderSearchNormalizeNfkc] = useState(() => extendedSettings.searchNormalizeNfkc);
  const [readerSearchPinyinInitials, setReaderSearchPinyinInitials] = useState(() => extendedSettings.searchPinyinInitials);
  const [readerSearchChapterFilter, setReaderSearchChapterFilter] = useState<number | 'all'>(() => resolveReaderSearchChapterFilterDefault(extendedSettings.readerSearchChapterFilterDefault, activeChapterIndex));
  const [readerSearchLimit, setReaderSearchLimit] = useState(() => toReaderSearchLimit(extendedSettings.searchLimit));
  const [readerSearchPage, setReaderSearchPage] = useState(0);
  const [readerSearchHistory, setReaderSearchHistory] = useState<ReaderSavedSearch[]>([]);
  const [readerSavedSearches, setReaderSavedSearches] = useState<ReaderSavedSearch[]>([]);
  const [activeSearchHitIndex, setActiveSearchHitIndex] = useState(0);
  const [readerSearchHits, setReaderSearchHits] = useState<ReaderSearchHit[]>([]);
  const [readerSearchWorkerRevision, setReaderSearchWorkerRevision] = useState(0);
  const readerSearchWorkerRef = useRef<Worker | null>(null);
  const readerSearchWorkerGenerationRef = useRef(0);
  const readerSearchWorkerReadyRef = useRef(false);
  const readerSearchRequestIdRef = useRef(0);
  const latestHighlightsRef = useRef(highlights);
  const latestBookmarksRef = useRef(bookmarks);
  const latestPageEntriesRef = useRef(activePageEntries);
  latestHighlightsRef.current = highlights;
  latestBookmarksRef.current = bookmarks;
  latestPageEntriesRef.current = readerSearchScope === 'page' ? activePageEntries : undefined;
  const readerSearchHistoryLimit = parseBoundedInteger(extendedSettings.readerSearchHistoryLimit, 8, 0, 20);
  const readerSavedSearchLimit = parseBoundedInteger(extendedSettings.readerSavedSearchLimit, 8, 0, 20);
  const readerSearchChapterFilterDefault = extendedSettings.readerSearchChapterFilterDefault;
  const readerSearchChapterFilterEnabled = shouldUseReaderSearchChapterFilter(readerSearchScope);
  const debouncedReaderSearchQuery = useDebouncedValue(readerSearchQuery, 180);
  const activeChapter = chapters[activeChapterIndex] ?? chapters[0];
  const readerSearchPageEntriesKey = readerSearchScope === 'page'
    ? (activePageEntries ?? []).map((entry) => `${entry.paragraphIndex}:${entry.startOffset}:${entry.endOffset}`).join('|')
    : '';
  const readerSearchChapterOptions = useMemo(() => {
    if (chapters.length <= 240) {
      return [{ value: 'all', label: t('reader.search.chapterAll') }, ...chapters.map((chapter) => ({ value: String(chapter.index), label: chapter.title }))];
    }
    const selectedChapter = readerSearchChapterFilter === 'all' ? null : chapters.find((chapter) => chapter.index === Number(readerSearchChapterFilter));
    const nearby = chapters
      .slice(Math.max(0, activeChapterIndex - 80), Math.min(chapters.length, activeChapterIndex + 81))
      .map((chapter) => ({ value: String(chapter.index), label: chapter.title }));
    const options = [{ value: 'all', label: t('reader.search.chapterAll') }, ...nearby];
    if (selectedChapter && !options.some((option) => option.value === String(selectedChapter.index))) {
      options.push({ value: String(selectedChapter.index), label: selectedChapter.title });
    }
    return options;
  }, [chapters, activeChapterIndex, readerSearchChapterFilter, t]);
  const readerSearchScopeOptions = useMemo(() => [
    { value: 'page' as const, label: t('reader.search.scopePage') },
    { value: 'chapter' as const, label: t('reader.search.scopeChapter') },
    { value: 'book' as const, label: t('reader.search.scopeBook') },
    { value: 'annotations' as const, label: t('reader.search.scopeAnnotations') },
    { value: 'bookmarks' as const, label: t('reader.search.scopeBookmarks') },
    { value: 'all' as const, label: t('reader.search.scopeAll') },
  ], [t]);
  useEffect(() => {
    const previousWorker = readerSearchWorkerRef.current;
    previousWorker?.terminate();
    const generation = readerSearchWorkerGenerationRef.current + 1;
    readerSearchWorkerGenerationRef.current = generation;
    readerSearchWorkerReadyRef.current = false;
    setReaderSearchHits([]);
    const worker = new Worker(new URL('./readerSearchWorker.ts', import.meta.url), { type: 'module' });
    readerSearchWorkerRef.current = worker;
    let cancelled = false;
    worker.onmessage = (event: MessageEvent<ReaderSearchWorkerResponse>) => {
      const response = event.data;
      if (response.generation !== readerSearchWorkerGenerationRef.current
        || response.requestId !== readerSearchRequestIdRef.current) return;
      if (response.type === 'error') {
        setReaderSearchHits([]);
        return;
      }
      setReaderSearchHits(response.hits);
    };
    worker.onerror = () => {
      if (readerSearchWorkerRef.current !== worker) return;
      readerSearchWorkerReadyRef.current = false;
      setReaderSearchHits([]);
    };
    worker.postMessage({ type: 'reset-index', generation } satisfies ReaderSearchWorkerRequest);
    worker.postMessage({
      type: 'set-annotations',
      generation,
      highlights: latestHighlightsRef.current,
      bookmarks: latestBookmarksRef.current,
    } satisfies ReaderSearchWorkerRequest);

    void (async () => {
      const chapterBatchSize = 24;
      for (let offset = 0; offset < chapters.length; offset += chapterBatchSize) {
        if (cancelled || readerSearchWorkerRef.current !== worker) return;
        worker.postMessage({
          type: 'append-chapters',
          generation,
          chapters: chapters.slice(offset, offset + chapterBatchSize),
        } satisfies ReaderSearchWorkerRequest);
        await yieldReaderSearchIndexUpload();
      }
      if (cancelled || readerSearchWorkerRef.current !== worker) return;
      worker.postMessage({ type: 'complete-index', generation } satisfies ReaderSearchWorkerRequest);
      readerSearchWorkerReadyRef.current = true;
      setReaderSearchWorkerRevision((current) => current + 1);
    })();

    return () => {
      cancelled = true;
      worker.terminate();
      if (readerSearchWorkerRef.current === worker) readerSearchWorkerRef.current = null;
    };
  }, [chapters]);

  useEffect(() => {
    const worker = readerSearchWorkerRef.current;
    if (!worker) return;
    worker.postMessage({
      type: 'set-annotations',
      generation: readerSearchWorkerGenerationRef.current,
      highlights,
      bookmarks,
    } satisfies ReaderSearchWorkerRequest);
  }, [highlights, bookmarks]);

  useEffect(() => {
    const worker = readerSearchWorkerRef.current;
    const previousRequestId = readerSearchRequestIdRef.current;
    if (worker && previousRequestId) {
      worker.postMessage({ type: 'cancel', requestId: previousRequestId } satisfies ReaderSearchWorkerRequest);
    }
    const requestId = previousRequestId + 1;
    readerSearchRequestIdRef.current = requestId;
    setReaderSearchHits([]);
    const shouldSearch = searchPanelOpen && Boolean(debouncedReaderSearchQuery.trim());
    if (!worker || !readerSearchWorkerReadyRef.current || !shouldSearch) return;
    const options: ReaderSearchOptions = {
      scope: readerSearchScope,
      chapterIndex: activeChapter?.index,
      chapterRange: readerSearchChapterFilterEnabled && readerSearchChapterFilter !== 'all' ? [Number(readerSearchChapterFilter)] : undefined,
      pageEntries: latestPageEntriesRef.current,
      fuzzy: readerSearchFuzzy,
      regex: readerSearchRegex,
      regexFallbackLiteral: readerSearchRegexFallbackLiteral,
      caseSensitive: readerSearchCaseSensitive,
      normalizeTraditionalChinese: readerSearchNormalizeTraditionalChinese,
      normalizeNfkc: readerSearchNormalizeNfkc,
      pinyinInitials: readerSearchPinyinInitials,
      limit: readerSearchLimit,
      offset: readerSearchPage * readerSearchLimit,
    };
    worker.postMessage({
      type: 'search',
      generation: readerSearchWorkerGenerationRef.current,
      requestId,
      query: debouncedReaderSearchQuery,
      options,
    } satisfies ReaderSearchWorkerRequest);
    return () => {
      worker.postMessage({ type: 'cancel', requestId } satisfies ReaderSearchWorkerRequest);
    };
  }, [searchPanelOpen, readerSearchWorkerRevision, debouncedReaderSearchQuery, readerSearchScope, activeChapter?.index, readerSearchPageEntriesKey, readerSearchChapterFilterEnabled, readerSearchChapterFilter, readerSearchFuzzy, readerSearchRegex, readerSearchRegexFallbackLiteral, readerSearchCaseSensitive, readerSearchNormalizeTraditionalChinese, readerSearchNormalizeNfkc, readerSearchPinyinInitials, readerSearchLimit, readerSearchPage, highlights, bookmarks]);

  useEffect(() => {
    setActiveSearchHitIndex((current) => Math.min(Math.max(0, current), Math.max(0, readerSearchHits.length - 1)));
  }, [readerSearchHits.length]);

  useEffect(() => {
    setReaderSearchPage(0);
  }, [debouncedReaderSearchQuery, readerSearchScope, readerSearchChapterFilter, readerSearchFuzzy, readerSearchRegex, readerSearchRegexFallbackLiteral, readerSearchCaseSensitive, readerSearchNormalizeTraditionalChinese, readerSearchNormalizeNfkc, readerSearchPinyinInitials, readerSearchLimit]);

  useEffect(() => {
    function refreshReaderSearchSettings(detail?: SettingsUpdatedDetail) {
      const loaded = detail?.extended ?? loadExtendedSettings();
      setReaderSearchScope(toReaderSearchScope(loaded.searchScope));
      setReaderSearchCaseSensitive(loaded.caseSensitive);
      setReaderSearchFuzzy(loaded.fuzzy);
      setReaderSearchRegex(loaded.regex);
      setReaderSearchRegexFallbackLiteral(loaded.readerSearchRegexFallbackLiteral);
      setReaderSearchNormalizeTraditionalChinese(loaded.searchNormalizeTraditionalChinese);
      setReaderSearchNormalizeNfkc(loaded.searchNormalizeNfkc);
      setReaderSearchPinyinInitials(loaded.searchPinyinInitials);
      setReaderSearchLimit(toReaderSearchLimit(loaded.searchLimit));
      setReaderSearchChapterFilter(resolveReaderSearchChapterFilterDefault(loaded.readerSearchChapterFilterDefault, activeChapterIndex));
      setReaderSearchPage(0);
    }
    return subscribeSettingsUpdated(refreshReaderSearchSettings);
  }, [activeChapterIndex]);

  useEffect(() => {
    if (readerSearchChapterFilterDefault === 'current') setReaderSearchChapterFilter(activeChapterIndex);
  }, [activeChapterIndex, readerSearchChapterFilterDefault]);

  useEffect(() => {
    function clearReaderSearchSettingsData() {
      setReaderSearchHistory([]);
      setReaderSavedSearches([]);
      setReaderSearchQuery('');
      setReaderSearchPage(0);
    }
    return subscribeReaderSearchDataCleared(clearReaderSearchSettingsData);
  }, []);

  useEffect(() => {
    function clearReaderSearchCacheData() {
      setReaderSearchQuery('');
      setReaderSearchPage(0);
    }
    return subscribeReaderCacheCleared(clearReaderSearchCacheData);
  }, []);

  useEffect(() => {
    setReaderSearchHistory((current) => current.slice(0, readerSearchHistoryLimit));
  }, [readerSearchHistoryLimit]);

  useEffect(() => {
    setReaderSavedSearches((current) => current.slice(0, readerSavedSearchLimit));
  }, [readerSavedSearchLimit]);

  function jumpToSearchHit(hit: ReaderSearchHit) {
    onJumpToSearchHit(hit);
  }

  function goRelativeSearchHit(delta: number) {
    if (!readerSearchHits.length) return;
    const nextIndex = (activeSearchHitIndex + delta + readerSearchHits.length) % readerSearchHits.length;
    setActiveSearchHitIndex(nextIndex);
    jumpToSearchHit(readerSearchHits[nextIndex]);
  }

  function openReaderSearchPanel() {
    setSearchPanelOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function onReaderSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchPanelOpen(false);
      return;
    }
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      commitReaderSearchQuery();
      goRelativeSearchHit(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commitReaderSearchQuery();
      goRelativeSearchHit(1);
    }
  }

  function commitReaderSearchQuery(query = readerSearchQuery) {
    const value = query.trim();
    if (!value) return;
    if (readerSearchHistoryLimit <= 0) return;
    const snapshot = createReaderSavedSearch(value);
    setReaderSearchHistory((current) => [snapshot, ...current.filter((item) => item.query !== value)].slice(0, readerSearchHistoryLimit));
  }

  function saveReaderSearch() {
    const value = readerSearchQuery.trim();
    if (!value) return;
    if (readerSavedSearchLimit <= 0) return;
    const snapshot = createReaderSavedSearch(value);
    setReaderSavedSearches((current) => [snapshot, ...current.filter((item) => item.query !== value)].slice(0, readerSavedSearchLimit));
  }

  function createReaderSavedSearch(query: string): ReaderSavedSearch {
    return {
      query: readerSearchQuery.trim() || query,
      scope: readerSearchScope,
      chapterFilter: readerSearchChapterFilter,
      caseSensitive: readerSearchCaseSensitive,
      fuzzy: readerSearchFuzzy,
      regex: readerSearchRegex,
      normalizeTraditionalChinese: readerSearchNormalizeTraditionalChinese,
      normalizeNfkc: readerSearchNormalizeNfkc,
      pinyinInitials: readerSearchPinyinInitials,
      limit: readerSearchLimit,
    };
  }

  function applyReaderSavedSearch(saved: ReaderSavedSearch) {
    setReaderSearchQuery(saved.query);
    setReaderSearchScope(saved.scope);
    setReaderSearchChapterFilter(saved.chapterFilter);
    setReaderSearchCaseSensitive(saved.caseSensitive);
    setReaderSearchFuzzy(saved.fuzzy);
    setReaderSearchRegex(saved.regex);
    setReaderSearchNormalizeTraditionalChinese(saved.normalizeTraditionalChinese);
    setReaderSearchNormalizeNfkc(saved.normalizeNfkc);
    setReaderSearchPinyinInitials(saved.pinyinInitials);
    setReaderSearchLimit(saved.limit);
    setReaderSearchPage(0);
  }

  return {
    searchInputRef,
    searchPanelOpen,
    setSearchPanelOpen,
    readerSearchQuery,
    setReaderSearchQuery,
    debouncedReaderSearchQuery,
    readerSearchHits,
    readerSearchScope,
    setReaderSearchScope,
    readerSearchScopeOptions,
    readerSearchChapterFilter,
    readerSearchChapterFilterEnabled,
    setReaderSearchChapterFilter,
    readerSearchChapterOptions,
    readerSearchLimit,
    setReaderSearchLimit,
    readerSearchCaseSensitive,
    setReaderSearchCaseSensitive,
    readerSearchFuzzy,
    setReaderSearchFuzzy,
    readerSearchRegex,
    setReaderSearchRegex,
    readerSearchNormalizeTraditionalChinese,
    setReaderSearchNormalizeTraditionalChinese,
    readerSearchNormalizeNfkc,
    setReaderSearchNormalizeNfkc,
    readerSearchPinyinInitials,
    setReaderSearchPinyinInitials,
    readerSavedSearchLimit,
    readerSearchHistoryLimit,
    readerSavedSearches,
    readerSearchHistory,
    activeSearchHitIndex,
    setActiveSearchHitIndex,
    jumpToSearchHit,
    goRelativeSearchHit,
    openReaderSearchPanel,
    onReaderSearchKeyDown,
    saveReaderSearch,
    applyReaderSavedSearch,
  };
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function yieldReaderSearchIndexUpload() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { Book } from '../types';
import type { IndexDiagnostics, SearchResult } from '../types';
import { ThemedSelect } from '../components/ThemedSelect';
import { shouldRefreshSearchResultsAfterTaskRefresh } from '../features/task-center/taskCompletionRefreshPolicy';
import { getBookIndexEmptyState, getSemanticCapabilityNotice, loadSharedIndexDiagnostics, tasksUpdatedEvent } from '../services/indexDiagnosticsService';
import { searchIndexPage } from '../services/searchService';
import { getPrivacyBookTitle, loadExtendedSettings, subscribeSettingsUpdated, type ExtendedSettings, type SettingsUpdatedDetail } from '../services/settingsCenterService';
import { allSearchBooksFilterValue, buildSearchBookFilterOptions } from '../features/search/searchPageModel';

type SearchPageProps = { book: Book | null; books?: Book[]; onOpenReader: (result?: SearchResult) => void };
const globalSearchHistoryStorageKey = 'bookmind:global-search-history';
const globalSearchSavedStorageKey = 'bookmind:global-search-saved';
const searchResultBatchSize = 500;

export function SearchPage({ book, books = [], onOpenReader }: SearchPageProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [selectedBookFilter, setSelectedBookFilter] = useState(allSearchBooksFilterValue);
  const [searching, setSearching] = useState(false);
  const [extendedSettings, setExtendedSettings] = useState<ExtendedSettings>(() => loadExtendedSettings());
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchList(globalSearchHistoryStorageKey));
  const [savedSearches, setSavedSearches] = useState<string[]>(() => loadSearchList(globalSearchSavedStorageKey));
  const [indexDiagnostics, setIndexDiagnostics] = useState<IndexDiagnostics | null>(null);
  const [taskRefreshToken, setTaskRefreshToken] = useState(0);
  const searchHistoryLimit = toBoundedInteger(extendedSettings.globalSearchHistoryLimit, 8, 0, 20);
  const savedSearchLimit = toBoundedInteger(extendedSettings.globalSearchSavedLimit, 8, 0, 20);
  const snippetLength = toBoundedInteger(extendedSettings.globalSearchSnippetLength, 180, 80, 500);
  const activeQuery = extendedSettings.globalSearchMode === 'enter' ? submittedQuery : debouncedQuery;
  const visibleSearchHistory = useMemo(() => searchHistory.slice(0, searchHistoryLimit), [searchHistory, searchHistoryLimit]);
  const visibleSavedSearches = useMemo(() => savedSearches.slice(0, savedSearchLimit), [savedSearches, savedSearchLimit]);
  const searchBookFilterOptions = useMemo(() => buildSearchBookFilterOptions(books, results, { currentBookId: book?.id }), [book?.id, books, results]);
  const searchBookSelectOptions = useMemo(() => searchBookFilterOptions.map((option) => ({ value: option.value, label: `${option.label} · ${option.count.toLocaleString()} 条` })), [searchBookFilterOptions]);
  const indexEmptyState = getBookIndexEmptyState(book, indexDiagnostics);
  const indexWarningState = indexEmptyState && indexEmptyState.status !== 'missing' ? indexEmptyState : null;
  const noResultsIndexState = indexWarningState ? null : indexEmptyState;
  const semanticCapabilityNotice = getSemanticCapabilityNotice(indexDiagnostics);
  const displayBookTitle = book ? getPrivacyBookTitle(book.displayTitle, extendedSettings) : t('search.localBook');

  useEffect(() => {
    function refreshExtendedSettings(detail?: SettingsUpdatedDetail) {
      const next = detail?.extended;
      setExtendedSettings(next ?? loadExtendedSettings());
    }
    return subscribeSettingsUpdated(refreshExtendedSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    function refreshIndexDiagnostics(event?: Event) {
      loadSharedIndexDiagnostics().then((diagnostics) => {
        if (!cancelled) setIndexDiagnostics(diagnostics);
      }).catch((error) => console.warn('Failed to load search index diagnostics:', error));
      if (event && shouldRefreshSearchResultsAfterTaskRefresh(activeQuery)) setTaskRefreshToken((value) => value + 1);
    }
    refreshIndexDiagnostics();
    window.addEventListener(tasksUpdatedEvent, refreshIndexDiagnostics);
    return () => {
      cancelled = true;
      window.removeEventListener(tasksUpdatedEvent, refreshIndexDiagnostics);
    };
  }, [activeQuery]);

  useEffect(() => {
    if (query.trim()) return;
    setSubmittedQuery('');
    setDebouncedQuery('');
    setResults([]);
    setResultTotal(0);
    setSearching(false);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (!activeQuery.trim()) {
      setResults([]);
      setResultTotal(0);
      setSearching(false);
      return;
    }
    async function loadAllSearchResults() {
      setSearching(true);
      setResults([]);
      setResultTotal(0);
      const bookId = selectedBookFilter === allSearchBooksFilterValue ? undefined : selectedBookFilter;
      let offset = 0;
      while (!cancelled) {
        const page = await searchIndexPage(activeQuery, { limit: searchResultBatchSize, offset, bookId });
        if (cancelled) return;
        const nextResults = offset === 0 ? page.results : (current: SearchResult[]) => mergeSearchResults(current, page.results);
        setResults(nextResults);
        setResultTotal(page.total);
        offset += page.results.length;
        if (page.results.length === 0 || offset >= page.total) break;
        await waitForSearchRenderBreath();
      }
      if (!cancelled) setSearching(false);
    }
    loadAllSearchResults().catch((error) => {
      console.warn('Failed to load full search results:', error);
      if (!cancelled) setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeQuery, selectedBookFilter, taskRefreshToken]);

  useEffect(() => {
    const nextHistory = searchHistoryLimit > 0 ? searchHistory.slice(0, searchHistoryLimit) : [];
    if (nextHistory.length !== searchHistory.length) {
      setSearchHistory(nextHistory);
      saveSearchList(globalSearchHistoryStorageKey, nextHistory);
    }
  }, [searchHistory, searchHistoryLimit]);

  useEffect(() => {
    const nextSaved = savedSearchLimit > 0 ? savedSearches.slice(0, savedSearchLimit) : [];
    if (nextSaved.length !== savedSearches.length) {
      setSavedSearches(nextSaved);
      saveSearchList(globalSearchSavedStorageKey, nextSaved);
    }
  }, [savedSearches, savedSearchLimit]);

  useEffect(() => {
    if (extendedSettings.globalSearchMode === 'enter') return;
    const delay = Number(extendedSettings.globalSearchDebounceMs) || 0;
    const timer = window.setTimeout(() => setDebouncedQuery(query), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [query, extendedSettings.globalSearchDebounceMs, extendedSettings.globalSearchMode]);

  function submitSearch() {
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    rememberGlobalSearchQuery(nextQuery);
  }

  function rememberGlobalSearchQuery(nextQuery: string) {
    if (!nextQuery || searchHistoryLimit <= 0) return;
    setSearchHistory((current) => {
      const next = [nextQuery, ...current.filter((item) => item !== nextQuery)].slice(0, searchHistoryLimit);
      saveSearchList(globalSearchHistoryStorageKey, next);
      return next;
    });
  }

  function saveGlobalSearchQuery(nextQuery = query.trim()) {
    if (!nextQuery || savedSearchLimit <= 0) return;
    setSavedSearches((current) => {
      const next = [nextQuery, ...current.filter((item) => item !== nextQuery)].slice(0, savedSearchLimit);
      saveSearchList(globalSearchSavedStorageKey, next);
      return next;
    });
  }

  function runSavedQuery(nextQuery: string) {
    setQuery(nextQuery);
    setSubmittedQuery(nextQuery);
    setDebouncedQuery(nextQuery);
    rememberGlobalSearchQuery(nextQuery);
  }

  return (
    <section className="page-surface search-page-main">
      <label className="big-search"><span>{t('search.label')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitSearch(); }} placeholder={t('search.placeholder')} /><em>{formatSearchTotal(resultTotal, results.length, selectedBookFilter, Boolean(activeQuery.trim()), searching)}</em></label>
      <div className="search-mode-actions">
        <button className="ghost-btn small" type="button" onClick={submitSearch}>{t('common.search')}</button>
        {savedSearchLimit > 0 ? <button className="ghost-btn small" type="button" onClick={() => saveGlobalSearchQuery()} disabled={!query.trim()}>保存搜索</button> : null}
        <ThemedSelect className="search-book-filter" menuPlacement="bottom" label="书籍" ariaLabel="选择搜索书籍" value={selectedBookFilter} options={searchBookSelectOptions} onChange={setSelectedBookFilter} />
        <span>{extendedSettings.globalSearchMode === 'enter' ? '回车搜索' : `${extendedSettings.globalSearchDebounceMs}ms 输入即搜`}</span>
      </div>
      {visibleSearchHistory.length || visibleSavedSearches.length ? (
        <div className="search-saved-queries" aria-label="搜索历史和保存搜索">
          {visibleSearchHistory.length ? <SearchChipGroup title="搜索历史" queries={visibleSearchHistory} onChoose={runSavedQuery} /> : null}
          {visibleSavedSearches.length ? <SearchChipGroup title="保存搜索" queries={visibleSavedSearches} onChoose={runSavedQuery} /> : null}
        </div>
      ) : null}
      {indexWarningState ? <article className="search-index-warning" role="status"><strong>{indexWarningState.title}</strong>{indexWarningState.detail ? <p>{indexWarningState.detail}</p> : null}<span>{indexWarningState.action}</span></article> : null}
      {semanticCapabilityNotice ? <article className="search-semantic-unavailable" role="status"><strong>{semanticCapabilityNotice.title}</strong><p>{semanticCapabilityNotice.detail}</p><span>{semanticCapabilityNotice.action}</span></article> : null}
      <div className="search-results">
        {searching && results.length === 0 ? <article className="result-card">{t('search.searching')}</article> : null}
        {!searching && !query.trim() ? <article className="result-card">{t('search.emptyPrompt')}</article> : null}
        {!searching && query.trim() && results.length === 0 ? <article className="result-card">{selectedBookFilter !== allSearchBooksFilterValue ? '当前书籍没有命中结果。' : noResultsIndexState ? <><strong>{noResultsIndexState.title}</strong>{noResultsIndexState.detail ? <p>{noResultsIndexState.detail}</p> : null}<p>{noResultsIndexState.action}</p></> : t('search.noResults', { title: displayBookTitle })}</article> : null}
        {results.map((result) => (
          <Result title={result.chapter} meta={formatSearchResultMeta(result, t('common.score'), extendedSettings.globalSearchShowScore, extendedSettings)} text={truncateSearchSnippet(result.snippet, snippetLength)} query={activeQuery} onOpen={() => onOpenReader(result)} key={result.chunkId} />
        ))}
      </div>
      {searching && resultTotal > results.length ? <p className="search-result-limit-note">正在加载全部结果：{results.length.toLocaleString()} / {resultTotal.toLocaleString()} 条</p> : null}
    </section>
  );
}

function Result({ title, meta, text, query, onOpen }: { title: string; meta: string; text: string; query: string; onOpen: () => void }) {
  const { t } = useI18n();
  return <article className="result-card"><div><p className="eyebrow">{meta}</p><h3>{title}</h3><p className="search-result-snippet">{renderHighlightedSnippet(text, query)}</p></div><button className="ghost-btn" onClick={onOpen}>{t('search.open')}</button></article>;
}

function SearchChipGroup({ title, queries, onChoose }: { title: string; queries: string[]; onChoose: (query: string) => void }) {
  return (
    <div>
      <span>{title}</span>
      {queries.map((item) => <button className="ghost-btn small" type="button" onClick={() => onChoose(item)} key={item}>{item}</button>)}
    </div>
  );
}

function formatSearchResultMeta(result: SearchResult, scoreLabel: string, showScore: boolean, privacySettings: ExtendedSettings) {
  const bookTitle = getPrivacyBookTitle(result.bookTitle, privacySettings);
  return showScore ? `${bookTitle} · ${scoreLabel} ${result.score}` : bookTitle;
}

function mergeSearchResults(current: SearchResult[], incoming: SearchResult[]) {
  if (incoming.length === 0) return current;
  const seen = new Set(current.map((result) => result.chunkId));
  return [...current, ...incoming.filter((result) => {
    if (seen.has(result.chunkId)) return false;
    seen.add(result.chunkId);
    return true;
  })];
}

function waitForSearchRenderBreath() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function truncateSearchSnippet(snippet: string, maxLength: number) {
  if (snippet.length <= maxLength) return snippet;
  return `${snippet.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function renderHighlightedSnippet(text: string, query: string) {
  const terms = extractSearchHighlightTerms(query);
  if (!text || terms.length === 0) return text;
  const lowerText = text.toLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const match = findNextHighlightMatch(lowerText, terms, cursor);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const matchedText = text.slice(match.index, match.index + match.length);
    nodes.push(<mark className="search-result-highlight" key={`${match.index}-${nodes.length}`}>{matchedText}</mark>);
    cursor = match.index + match.length;
  }
  return nodes.length ? nodes : text;
}

export function extractSearchHighlightTerms(query: string) {
  const terms: string[] = [];
  let current = '';
  for (const character of query.trim().toLowerCase()) {
    if (isSearchTermSeparator(character)) {
      pushSearchHighlightTerm(terms, current);
      current = '';
    } else {
      current += character;
    }
  }
  pushSearchHighlightTerm(terms, current);
  return terms.sort((left, right) => right.length - left.length);
}

function pushSearchHighlightTerm(terms: string[], value: string) {
  const term = value.trim();
  if (term && !terms.includes(term)) terms.push(term);
}

function findNextHighlightMatch(lowerText: string, terms: string[], cursor: number) {
  let best: { index: number; length: number } | null = null;
  for (const term of terms) {
    const index = lowerText.indexOf(term, cursor);
    if (index < 0) continue;
    if (!best || index < best.index || (index === best.index && term.length > best.length)) {
      best = { index, length: term.length };
    }
  }
  return best;
}

function isSearchTermSeparator(character: string) {
  return /\s/.test(character)
    || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(character)
    || '，。、：；！？“”‘’（）《》【】…—'.includes(character);
}

function formatSearchTotal(total: number, loaded: number, selectedBookFilter: string, hasQuery: boolean, searching: boolean) {
  const filtered = selectedBookFilter !== allSearchBooksFilterValue;
  if (filtered && searching && total > 0) return `${loaded.toLocaleString()} / ${total.toLocaleString()} 条`;
  if (filtered && !searching) return `当前 ${total.toLocaleString()} 条`;
  if (searching && total > 0) return `${loaded.toLocaleString()} / ${total.toLocaleString()} 条`;
  if (searching) return '搜索中';
  if (!hasQuery) return '共 0 条';
  return `共 ${total.toLocaleString()} 条`;
}

function toBoundedInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function loadSearchList(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
  } catch {
    return [];
  }
}

function saveSearchList(key: string, list: string[]) {
  window.localStorage.setItem(key, JSON.stringify(list));
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, FocusEvent, KeyboardEvent, PointerEvent, RefObject, SetStateAction, WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n } from '../../i18n';
import { getBookSourceEditPayload, listNetworkBookSourceCandidates, saveBookSourceEditPayload, switchNetworkBookSource } from '../../services/unsupportedRuntime';
import { requestLibraryRefresh } from '../../services/appDomainEvents';
import { emitNetworkPreloadChanged } from './readerDomainEvents';
import { openExternalUrl } from '../../services/externalUrlService';
import type { Book, BookSourceEditPayload, BookSourceSearchResult, ReaderSettings } from '../../types';
import type { ReaderSearchHit, ReaderSearchScope } from './readerModel';

export type ReaderSavedSearch = {
  query: string;
  scope: ReaderSearchScope;
  chapterFilter: number | 'all';
  caseSensitive: boolean;
  fuzzy: boolean;
  regex: boolean;
  normalizeTraditionalChinese: boolean;
  normalizeNfkc: boolean;
  pinyinInitials: boolean;
  limit: number;
};

type ReaderToolbarSelectOption<T extends string> = {
  value: T;
  label: string;
};

const READER_SEARCH_LIMIT_OPTIONS = [10, 20, 50, 100, 200, 400, 800];
const READER_SEARCH_OVERFLOW_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

type ReaderToolbarProps = {
  book: Book;
  settings: ReaderSettings;
  chaptersLength: number;
  activeChapterIndex: number;
  activeScreenPage: number;
  screenPageCount: number;
  activeStreamIndex: number;
  pageStreamLength: number;
  showToc: boolean;
  pageMeterText: string;
  pageJumpValue: string;
  pageJumpError: string;
  readerDailyGoalEnabled: boolean;
  readerDailyGoalHasTargets: boolean;
  readerDailyGoalPercent: number;
  readerDailyGoalSegments: string[];
  searchPanelOpen: boolean;
  showHighlightPanel: boolean;
  aiPanelOpen: boolean;
  rulesPanelOpen: boolean;
  readAloudActive: boolean;
  readAloudPaused: boolean;
  readerReadAloudEnabled: boolean;
  readAloudAvailable: boolean;
  readAloudStartLabel: string;
  focusMode: boolean;
  standaloneReader: boolean;
  readerWindowSyncStatus: string;
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  readerSearchQuery: string;
  readerSearchHits: ReaderSearchHit[];
  readerSearchScope: ReaderSearchScope;
  readerSearchScopeOptions: ReaderToolbarSelectOption<ReaderSearchScope>[];
  readerSearchChapterFilter: number | 'all';
  readerSearchChapterFilterEnabled: boolean;
  readerSearchChapterOptions: ReaderToolbarSelectOption<string>[];
  readerSearchLimit: number;
  readerSearchCaseSensitive: boolean;
  readerSearchFuzzy: boolean;
  readerSearchRegex: boolean;
  readerSearchNormalizeTraditionalChinese: boolean;
  readerSearchNormalizeNfkc: boolean;
  readerSearchPinyinInitials: boolean;
  readerSavedSearchLimit: number;
  readerSearchHistoryLimit: number;
  readerSavedSearches: ReaderSavedSearch[];
  readerSearchHistory: ReaderSavedSearch[];
  onToggleToc: () => void;
  libraryPanelVisible?: boolean;
  onToggleLibraryPanel?: () => void;
  rightPanelSessionsOpen?: boolean;
  rightPanelsCollapsed?: boolean;
  onToggleRightPanelSidebar?: () => void;
  onOpenSettings: () => void;
  onToggleRulesPanel: () => void;
  onCreateBookmark: () => void;
  onToggleWindowed: () => void;
  onOpenMoyuMode: () => void;
  onToggleAiPanel: () => void;
  onToggleFullscreen: () => void;
  onToggleAlwaysOnTop: () => void;
  onReturnToMainWindow: () => void;
  onOpenCharacters?: (bookId: string) => void;
  setPageJumpValue: Dispatch<SetStateAction<string>>;
  setPageJumpError: Dispatch<SetStateAction<string>>;
  jumpToPageValue: () => void;
  handlePageTurnButtonClick: (event: React.MouseEvent<HTMLButtonElement>, direction: 'prev' | 'next') => void;
  startContinuousPageTurn: (event: PointerEvent<HTMLButtonElement>, direction: 'prev' | 'next') => void;
  stopContinuousPageTurn: () => void;
  setSearchPanelOpen: Dispatch<SetStateAction<boolean>>;
  openReaderSearchPanel: () => void;
  setShowHighlightPanel: Dispatch<SetStateAction<boolean>>;
  pauseOrResumeReaderReadAloud: () => void;
  stopReaderReadAloud: () => void;
  startReaderReadAloud: () => void;
  toggleFocusMode: () => void;
  setReaderSearchQuery: Dispatch<SetStateAction<string>>;
  onReaderSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  goRelativeSearchHit: (delta: number) => void;
  setReaderSearchScope: Dispatch<SetStateAction<ReaderSearchScope>>;
  setReaderSearchChapterFilter: Dispatch<SetStateAction<number | 'all'>>;
  setReaderSearchLimit: Dispatch<SetStateAction<number>>;
  setReaderSearchCaseSensitive: Dispatch<SetStateAction<boolean>>;
  setReaderSearchFuzzy: Dispatch<SetStateAction<boolean>>;
  setReaderSearchRegex: Dispatch<SetStateAction<boolean>>;
  setReaderSearchNormalizeTraditionalChinese: Dispatch<SetStateAction<boolean>>;
  setReaderSearchNormalizeNfkc: Dispatch<SetStateAction<boolean>>;
  setReaderSearchPinyinInitials: Dispatch<SetStateAction<boolean>>;
  saveReaderSearch: () => void;
  applyReaderSavedSearch: (saved: ReaderSavedSearch) => void;
};

type ReaderToolbarTooltip = {
  text: string;
  left: number;
  top: number;
};
type SourceEditorMode = 'form' | 'json';
type SourceEditorGroupId = 'basic' | 'search' | 'explore' | 'info' | 'toc' | 'content' | 'request' | 'advanced';
type SourceEditorFieldConfig = {
  path: string[];
  label: string;
  description?: string;
  multiline?: boolean;
  readOnly?: boolean;
  wide?: boolean;
};
type SourceEditorGroupConfig = {
  id: SourceEditorGroupId;
  label: string;
  fields: SourceEditorFieldConfig[];
};
type JsonObject = Record<string, unknown>;

function ReaderToolbarIcon({ name }: { name: BookMindIconName }) {
  return <BookMindIcon name={name} />;
}

function getReaderToolbarTooltipTarget(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
}

function mergeReaderNetworkSourceCandidates(candidates: BookSourceSearchResult[], book: Book) {
  const current = book.networkSource ? [{
    sourceId: book.networkSource.sourceId,
    sourceName: book.networkSource.sourceName,
    name: book.displayTitle || book.title,
    author: book.author,
    bookUrl: book.networkSource.bookUrl,
    coverUrl: book.coverImagePath || '',
    latestChapter: book.networkSource.latestChapter,
    intro: '',
  }] : [];
  const seen = new Set<string>();
  return [...current, ...candidates].filter((candidate) => {
    if (!candidate.sourceId || !candidate.bookUrl) return false;
    const key = `${candidate.sourceId}\n${candidate.bookUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSourceEditorJson(rawJson: string): JsonObject | null {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonObject : null;
  } catch {
    return null;
  }
}

function sourceEditorStringField(rawJson: string, path: string[]) {
  const root = parseSourceEditorJson(rawJson);
  if (!root) return '';
  let current: unknown = root;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return '';
    current = (current as JsonObject)[key];
  }
  if (typeof current === 'string') return current;
  if (typeof current === 'number' || typeof current === 'boolean') return String(current);
  return '';
}

function updateSourceEditorStringField(rawJson: string, path: string[], value: string) {
  const root = parseSourceEditorJson(rawJson) ?? {};
  let current: JsonObject = root;
  for (const key of path.slice(0, -1)) {
    const next = current[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) current[key] = {};
    current = current[key] as JsonObject;
  }
  current[path[path.length - 1]] = value;
  return JSON.stringify(root, null, 2);
}

function SourceEditorTextField({ rawJson, path, label, description, multiline, readOnly, wide, onChange }: SourceEditorFieldConfig & { rawJson: string; onChange: (next: string) => void }) {
  const value = sourceEditorStringField(rawJson, path);
  return (
    <label className={multiline || wide ? 'reader-source-editor-field wide' : 'reader-source-editor-field'}>
      <span>{label}</span>
      {description ? <em>{description}</em> : null}
      {multiline ? (
        <textarea value={value} readOnly={readOnly} onChange={(event) => onChange(updateSourceEditorStringField(rawJson, path, event.target.value))} spellCheck={false} />
      ) : (
        <input value={value} readOnly={readOnly} onChange={(event) => onChange(updateSourceEditorStringField(rawJson, path, event.target.value))} />
      )}
    </label>
  );
}

function buildSourceEditorGroups(t: ReturnType<typeof useI18n>['t']): SourceEditorGroupConfig[] {
  return [
    {
      id: 'basic',
      label: t('reader.networkTools.sourceSectionBasic'),
      fields: [
        { path: ['bookSourceName'], label: t('reader.networkTools.fieldName'), readOnly: true },
        { path: ['bookSourceUrl'], label: t('reader.networkTools.fieldBaseUrl'), readOnly: true },
        { path: ['bookSourceGroup'], label: t('reader.networkTools.fieldGroup') },
        { path: ['bookSourceType'], label: t('reader.networkTools.fieldSourceType') },
        { path: ['bookUrlPattern'], label: t('reader.networkTools.fieldBookUrlPattern'), wide: true },
        { path: ['loginUrl'], label: t('reader.networkTools.fieldLoginUrl'), wide: true },
        { path: ['bookSourceComment'], label: t('reader.networkTools.fieldComment'), multiline: true },
      ],
    },
    {
      id: 'search',
      label: t('reader.networkTools.sourceSectionSearch'),
      fields: [
        { path: ['searchUrl'], label: t('reader.networkTools.fieldSearchUrl'), description: t('reader.networkTools.fieldSearchUrlHint'), multiline: true },
        { path: ['ruleSearch', 'bookList'], label: t('reader.networkTools.fieldBookList'), wide: true },
        { path: ['ruleSearch', 'name'], label: t('reader.networkTools.fieldBookName') },
        { path: ['ruleSearch', 'author'], label: t('reader.networkTools.fieldAuthor') },
        { path: ['ruleSearch', 'bookUrl'], label: t('reader.networkTools.fieldBookUrl') },
        { path: ['ruleSearch', 'coverUrl'], label: t('reader.networkTools.fieldCoverUrl') },
        { path: ['ruleSearch', 'kind'], label: t('reader.networkTools.fieldKind') },
        { path: ['ruleSearch', 'lastChapter'], label: t('reader.networkTools.fieldLastChapter') },
        { path: ['ruleSearch', 'wordCount'], label: t('reader.networkTools.fieldWordCount') },
        { path: ['ruleSearch', 'intro'], label: t('reader.networkTools.fieldIntro'), multiline: true },
        { path: ['ruleSearch', 'checkKeyWord'], label: t('reader.networkTools.fieldCheckKeyWord'), wide: true },
      ],
    },
    {
      id: 'explore',
      label: t('reader.networkTools.sourceSectionExplore'),
      fields: [
        { path: ['exploreUrl'], label: t('reader.networkTools.fieldExploreUrl'), multiline: true },
        { path: ['ruleExplore', 'bookList'], label: t('reader.networkTools.fieldBookList'), wide: true },
        { path: ['ruleExplore', 'name'], label: t('reader.networkTools.fieldBookName') },
        { path: ['ruleExplore', 'author'], label: t('reader.networkTools.fieldAuthor') },
        { path: ['ruleExplore', 'bookUrl'], label: t('reader.networkTools.fieldBookUrl') },
        { path: ['ruleExplore', 'coverUrl'], label: t('reader.networkTools.fieldCoverUrl') },
        { path: ['ruleExplore', 'kind'], label: t('reader.networkTools.fieldKind') },
        { path: ['ruleExplore', 'lastChapter'], label: t('reader.networkTools.fieldLastChapter') },
        { path: ['ruleExplore', 'wordCount'], label: t('reader.networkTools.fieldWordCount') },
        { path: ['ruleExplore', 'intro'], label: t('reader.networkTools.fieldIntro'), multiline: true },
      ],
    },
    {
      id: 'info',
      label: t('reader.networkTools.sourceSectionInfo'),
      fields: [
        { path: ['ruleBookInfo', 'init'], label: t('reader.networkTools.fieldInit'), multiline: true },
        { path: ['ruleBookInfo', 'name'], label: t('reader.networkTools.fieldBookName') },
        { path: ['ruleBookInfo', 'author'], label: t('reader.networkTools.fieldAuthor') },
        { path: ['ruleBookInfo', 'coverUrl'], label: t('reader.networkTools.fieldCoverUrl') },
        { path: ['ruleBookInfo', 'kind'], label: t('reader.networkTools.fieldKind') },
        { path: ['ruleBookInfo', 'lastChapter'], label: t('reader.networkTools.fieldLastChapter') },
        { path: ['ruleBookInfo', 'wordCount'], label: t('reader.networkTools.fieldWordCount') },
        { path: ['ruleBookInfo', 'tocUrl'], label: t('reader.networkTools.fieldTocUrl') },
        { path: ['ruleBookInfo', 'intro'], label: t('reader.networkTools.fieldIntro'), multiline: true },
      ],
    },
    {
      id: 'toc',
      label: t('reader.networkTools.sourceSectionToc'),
      fields: [
        { path: ['ruleToc', 'chapterList'], label: t('reader.networkTools.fieldChapterList'), description: t('reader.networkTools.fieldChapterListHint'), wide: true },
        { path: ['ruleToc', 'chapterName'], label: t('reader.networkTools.fieldChapterName') },
        { path: ['ruleToc', 'chapterUrl'], label: t('reader.networkTools.fieldChapterUrl') },
        { path: ['ruleToc', 'isVip'], label: t('reader.networkTools.fieldIsVip') },
        { path: ['ruleToc', 'updateTime'], label: t('reader.networkTools.fieldUpdateTime') },
        { path: ['ruleToc', 'nextTocUrl'], label: t('reader.networkTools.fieldNextTocUrl'), wide: true },
      ],
    },
    {
      id: 'content',
      label: t('reader.networkTools.sourceSectionContent'),
      fields: [
        { path: ['ruleContent', 'content'], label: t('reader.networkTools.fieldContent'), description: t('reader.networkTools.fieldContentHint'), wide: true },
        { path: ['ruleContent', 'nextContentUrl'], label: t('reader.networkTools.fieldNextContentUrl'), wide: true },
        { path: ['ruleContent', 'replaceRegex'], label: t('reader.networkTools.fieldReplaceRegex'), multiline: true },
        { path: ['ruleContent', 'imageStyle'], label: t('reader.networkTools.fieldImageStyle'), multiline: true },
        { path: ['ruleContent', 'payAction'], label: t('reader.networkTools.fieldPayAction'), multiline: true },
      ],
    },
    {
      id: 'request',
      label: t('reader.networkTools.sourceSectionRequest'),
      fields: [
        { path: ['header'], label: t('reader.networkTools.fieldHeader'), multiline: true },
        { path: ['bookSourceUserAgent'], label: t('reader.networkTools.fieldUserAgent'), wide: true },
        { path: ['cookie'], label: t('reader.networkTools.fieldCookie'), multiline: true },
        { path: ['charset'], label: t('reader.networkTools.fieldCharset') },
        { path: ['enabledCookieJar'], label: t('reader.networkTools.fieldCookieJar') },
      ],
    },
    {
      id: 'advanced',
      label: t('reader.networkTools.sourceSectionAdvanced'),
      fields: [
        { path: ['enabledExplore'], label: t('reader.networkTools.fieldEnabledExplore') },
        { path: ['customOrder'], label: t('reader.networkTools.fieldCustomOrder') },
        { path: ['weight'], label: t('reader.networkTools.fieldWeight') },
        { path: ['concurrentRate'], label: t('reader.networkTools.fieldConcurrentRate') },
        { path: ['jsLib'], label: t('reader.networkTools.fieldJsLib'), multiline: true },
        { path: ['variableComment'], label: t('reader.networkTools.fieldVariableComment'), multiline: true },
      ],
    },
  ];
}

function ReaderSearchChapterCombobox({ className, label, value, options, onChange, ariaLabel, noMatchLabel }: { className: string; label: string; value: number | 'all'; options: ReaderToolbarSelectOption<string>[]; onChange: (value: number | 'all') => void; ariaLabel: string; noMatchLabel: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = options.find((option) => option.value === String(value)) ?? options[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery) || option.value.includes(normalizedQuery));
  }, [normalizedQuery, options]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery('');
    }
    window.addEventListener('click', closeOnOutside);
    return () => window.removeEventListener('click', closeOnOutside);
  }, []);

  function choose(nextValue: string) {
    onChange(nextValue === 'all' ? 'all' : Number(nextValue));
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className={`reader-chapter-combobox themed-select menu-bottom ${className}${open ? ' open' : ''}`} ref={rootRef}>
      <span className="themed-select-label">{label}</span>
      <input
        ref={inputRef}
        className="reader-chapter-combobox-input"
        value={open ? query : selectedOption?.label ?? ''}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setQuery('');
            inputRef.current?.blur();
          }
          if (event.key === 'Enter' && visibleOptions[0]) {
            event.preventDefault();
            choose(visibleOptions[0].value);
          }
        }}
        placeholder={selectedOption?.label ?? label}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
      />
      <i aria-hidden="true">⌄</i>
      {open ? (
        <div className="themed-select-menu reader-chapter-combobox-menu" role="listbox" aria-label={ariaLabel}>
          {visibleOptions.length ? visibleOptions.map((option) => (
            <button
              className={option.value === String(value) ? 'selected' : ''}
              type="button"
              role="option"
              aria-selected={option.value === String(value)}
              key={option.value}
              onClick={(event) => { event.stopPropagation(); choose(option.value); }}
            >
              <span>{option.label}</span>
              {option.value === String(value) ? <strong>✓</strong> : null}
            </button>
          )) : <span className="reader-chapter-combobox-empty">{noMatchLabel}</span>}
        </div>
      ) : null}
    </div>
  );
}

export function ReaderToolbar({
  book,
  settings,
  chaptersLength,
  activeChapterIndex,
  activeScreenPage,
  screenPageCount,
  activeStreamIndex,
  pageStreamLength,
  showToc,
  pageMeterText,
  pageJumpValue,
  pageJumpError,
  readerDailyGoalEnabled,
  readerDailyGoalHasTargets,
  readerDailyGoalPercent,
  readerDailyGoalSegments,
  searchPanelOpen,
  showHighlightPanel,
  aiPanelOpen,
  rulesPanelOpen,
  readAloudActive,
  readAloudPaused,
  readerReadAloudEnabled,
  readAloudAvailable,
  readAloudStartLabel,
  focusMode,
  standaloneReader,
  readerWindowSyncStatus,
  isFullscreen,
  isAlwaysOnTop,
  searchInputRef,
  readerSearchQuery,
  readerSearchHits,
  readerSearchScope,
  readerSearchScopeOptions,
  readerSearchChapterFilter,
  readerSearchChapterFilterEnabled,
  readerSearchChapterOptions,
  readerSearchLimit,
  readerSearchCaseSensitive,
  readerSearchFuzzy,
  readerSearchRegex,
  readerSearchNormalizeTraditionalChinese,
  readerSearchNormalizeNfkc,
  readerSearchPinyinInitials,
  readerSavedSearchLimit,
  readerSearchHistoryLimit,
  readerSavedSearches,
  readerSearchHistory,
  onToggleToc,
  libraryPanelVisible,
  onToggleLibraryPanel,
  rightPanelSessionsOpen,
  rightPanelsCollapsed,
  onToggleRightPanelSidebar,
  onOpenSettings,
  onToggleRulesPanel,
  onCreateBookmark,
  onToggleWindowed,
  onOpenMoyuMode,
  onToggleAiPanel,
  onToggleFullscreen,
  onToggleAlwaysOnTop,
  onReturnToMainWindow,
  onOpenCharacters,
  setPageJumpValue,
  setPageJumpError,
  jumpToPageValue,
  handlePageTurnButtonClick,
  startContinuousPageTurn,
  stopContinuousPageTurn,
  setSearchPanelOpen,
  openReaderSearchPanel,
  setShowHighlightPanel,
  pauseOrResumeReaderReadAloud,
  stopReaderReadAloud,
  startReaderReadAloud,
  toggleFocusMode,
  setReaderSearchQuery,
  onReaderSearchKeyDown,
  goRelativeSearchHit,
  setReaderSearchScope,
  setReaderSearchChapterFilter,
  setReaderSearchLimit,
  setReaderSearchCaseSensitive,
  setReaderSearchFuzzy,
  setReaderSearchRegex,
  setReaderSearchNormalizeTraditionalChinese,
  setReaderSearchNormalizeNfkc,
  setReaderSearchPinyinInitials,
  saveReaderSearch,
  applyReaderSavedSearch,
}: ReaderToolbarProps) {
  const { t } = useI18n();
  const [toolbarTooltip, setToolbarTooltip] = useState<ReaderToolbarTooltip | null>(null);
  const [networkToolsOpen, setNetworkToolsOpen] = useState(false);
  const [networkPreloadCount, setNetworkPreloadCount] = useState(() => book.networkSource?.preloadedChapterCount || 3);
  const [networkSourceCandidates, setNetworkSourceCandidates] = useState<BookSourceSearchResult[]>([]);
  const [networkSourceLoading, setNetworkSourceLoading] = useState(false);
  const [networkSourceSwitchingKey, setNetworkSourceSwitchingKey] = useState('');
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);
  const [sourceEditorLoading, setSourceEditorLoading] = useState(false);
  const [sourceEditorSaving, setSourceEditorSaving] = useState(false);
  const [sourceEditorError, setSourceEditorError] = useState('');
  const [sourceEditorPayload, setSourceEditorPayload] = useState<BookSourceEditPayload | null>(null);
  const [sourceEditorJson, setSourceEditorJson] = useState('');
  const [sourceEditorMode, setSourceEditorMode] = useState<SourceEditorMode>('form');
  const [sourceEditorGroup, setSourceEditorGroup] = useState<SourceEditorGroupId>('basic');
  const [searchOverflowLevel, setSearchOverflowLevel] = useState(0);
  const searchPanelRowRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDetailsElement | null>(null);
  const sourceEditorGroups = buildSourceEditorGroups(t);
  const activeSourceEditorGroup = sourceEditorGroups.find((group) => group.id === sourceEditorGroup) ?? sourceEditorGroups[0];
  const isNetworkBook = (book.sourceKind === 'network' || book.format.toLowerCase() === 'network') && Boolean(book.networkSource);

  useEffect(() => {
    if (!book.networkSource) return;
    const stored = Number(window.localStorage.getItem(`bookmind:network-preload:${book.id}`));
    setNetworkPreloadCount(Number.isFinite(stored) ? Math.max(0, Math.min(50, stored)) : book.networkSource.preloadedChapterCount || 3);
  }, [book.id, book.networkSource?.preloadedChapterCount]);

  useLayoutEffect(() => {
    if (!searchPanelOpen) return;
    const row = searchPanelRowRef.current;
    const input = row?.querySelector<HTMLElement>('.reader-search-query-input');
    const actions = row?.querySelector<HTMLElement>('.reader-search-actions');
    if (!row || !input || !actions) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rowRect = row.getBoundingClientRect();
      let nextLevel = 7;

      for (const candidate of READER_SEARCH_OVERFLOW_LEVELS) {
        row.dataset.overflowLevel = String(candidate);
        const inputRect = input.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        const fits = actionsRect.right <= rowRect.right + 0.5
          && inputRect.right + 6 <= actionsRect.left + 0.5;
        if (fits) {
          nextLevel = candidate;
          break;
        }
      }

      row.dataset.overflowLevel = String(nextLevel);
      setSearchOverflowLevel((current) => current === nextLevel ? current : nextLevel);
    };
    const scheduleMeasure = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(row);
    resizeObserver.observe(actions);
    measure();
    return () => {
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [readerSavedSearchLimit, readerSearchChapterFilterEnabled, searchPanelOpen]);

  function closeMoreMenu() {
    if (moreMenuRef.current) moreMenuRef.current.open = false;
  }

  function runMoreAction(action: () => void) {
    action();
    closeMoreMenu();
  }

  function updateNetworkPreloadCount(value: number) {
    const next = Math.max(0, Math.min(50, value));
    setNetworkPreloadCount(next);
    window.localStorage.setItem(`bookmind:network-preload:${book.id}`, String(next));
    emitNetworkPreloadChanged({ bookId: book.id, preloadCount: next });
  }

  async function loadNetworkSourceCandidates() {
    if (!book.networkSource || networkSourceLoading) return;
    setNetworkSourceLoading(true);
    try {
      const payload = await listNetworkBookSourceCandidates(book.id);
      setNetworkSourceCandidates(mergeReaderNetworkSourceCandidates(payload.results, book));
    } catch (error) {
      console.warn('Failed to load reader network sources:', error);
      setNetworkSourceCandidates(mergeReaderNetworkSourceCandidates([], book));
    } finally {
      setNetworkSourceLoading(false);
    }
  }

  async function switchReaderNetworkSource(source: BookSourceSearchResult) {
    if (!book.networkSource) return;
    const key = `${source.sourceId}\n${source.bookUrl}`;
    setNetworkSourceSwitchingKey(key);
    try {
      await switchNetworkBookSource({ bookId: book.id, sourceId: source.sourceId, bookUrl: source.bookUrl });
      requestLibraryRefresh({ bookId: book.id });
      setNetworkToolsOpen(false);
    } catch (error) {
      console.warn('Failed to switch reader network source:', error);
    } finally {
      setNetworkSourceSwitchingKey('');
    }
  }

  async function openSourceEditor() {
    if (!book.networkSource) return;
    setSourceEditorOpen(true);
    setSourceEditorLoading(true);
    setSourceEditorError('');
    try {
      const payload = await getBookSourceEditPayload(book.networkSource.sourceId);
      setSourceEditorPayload(payload);
      setSourceEditorJson(payload.rawJson);
      setSourceEditorMode('form');
      setSourceEditorGroup('basic');
    } catch (error) {
      setSourceEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceEditorLoading(false);
    }
  }

  async function saveSourceEditor() {
    if (!sourceEditorPayload) return;
    setSourceEditorSaving(true);
    setSourceEditorError('');
    try {
      const payload = await saveBookSourceEditPayload(sourceEditorPayload.id, sourceEditorJson);
      setSourceEditorPayload(payload);
      setSourceEditorJson(payload.rawJson);
      if (book.networkSource && book.networkSource.sourceId === sourceEditorPayload.id) {
        await switchNetworkBookSource({
          bookId: book.id,
          sourceId: book.networkSource.sourceId,
          bookUrl: book.networkSource.bookUrl,
        });
      }
      requestLibraryRefresh({ bookId: book.id });
    } catch (error) {
      setSourceEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceEditorSaving(false);
    }
  }

  function showToolbarTooltip(target: HTMLElement) {
    const text = target.dataset.tooltip;
    if (!text) {
      setToolbarTooltip(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const estimatedWidth = Math.min(220, Math.max(72, text.length * 12 + 18));
    const left = Math.min(
      Math.max(viewportLeft + 12 + estimatedWidth / 2, rect.left + rect.width / 2),
      viewportLeft + viewportWidth - 12 - estimatedWidth / 2,
    );
    const top = Math.min(viewportTop + viewportHeight - 32, rect.bottom + 8);
    setToolbarTooltip({ text, left: Math.round(left), top: Math.round(top) });
  }

  function onToolbarPointerOver(event: PointerEvent<HTMLDivElement>) {
    const target = getReaderToolbarTooltipTarget(event.target);
    if (!target || !event.currentTarget.contains(target)) return;
    showToolbarTooltip(target);
  }

  function onToolbarFocus(event: FocusEvent<HTMLDivElement>) {
    const target = getReaderToolbarTooltipTarget(event.target);
    if (!target || !event.currentTarget.contains(target)) return;
    showToolbarTooltip(target);
  }

  function clearToolbarTooltip(event?: PointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) {
    if (event) {
      const currentTarget = getReaderToolbarTooltipTarget(event.target);
      const nextTarget = getReaderToolbarTooltipTarget(event.relatedTarget);
      if (currentTarget && nextTarget === currentTarget) return;
    }
    setToolbarTooltip(null);
  }

  function scrollToolbarHorizontally(event: WheelEvent<HTMLDivElement>) {
    const track = event.currentTarget;
    if (track.scrollWidth <= track.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    event.stopPropagation();
    track.scrollLeft += event.deltaY;
  }

  return (
    <>
      <div className="reader-toolbar" onPointerOver={onToolbarPointerOver} onPointerLeave={clearToolbarTooltip} onFocus={onToolbarFocus} onBlur={clearToolbarTooltip}>
        <div className="reader-toolbar-scroll-track" onWheelCapture={scrollToolbarHorizontally}>
        <div className="reader-toolbar-main reader-toolbar-section nav" aria-label={t('reader.toolbar.pageControls')}>
          <div className="reader-toolbar-page-row">
            {onToggleLibraryPanel ? (
              <button
                type="button"
                className={libraryPanelVisible ? 'reader-icon-btn active' : 'reader-icon-btn'}
                data-tooltip={libraryPanelVisible ? t('sidebar.hide') : t('sidebar.show')}
                aria-label={libraryPanelVisible ? t('sidebar.hide') : t('sidebar.show')}
                aria-pressed={Boolean(libraryPanelVisible)}
                onClick={onToggleLibraryPanel}
              >
                <ReaderToolbarIcon name={libraryPanelVisible ? 'libraryGroupCollapse' : 'libraryGroupExpand'} />
              </button>
            ) : null}
            <button type="button" className={showToc ? 'reader-icon-btn active' : 'reader-icon-btn'} data-tooltip={showToc ? t('reader.toc.hide') : t('reader.toc.show')} aria-label={showToc ? t('reader.toc.hide') : t('reader.toc.show')} aria-pressed={showToc} onClick={onToggleToc}><ReaderToolbarIcon name="toc" /></button>
            <button className="reader-icon-btn" data-tooltip={t('reader.prevPage')} aria-label={t('reader.prevPage')} onClick={(event) => handlePageTurnButtonClick(event, 'prev')} onPointerDown={(event) => startContinuousPageTurn(event, 'prev')} onPointerUp={stopContinuousPageTurn} onPointerLeave={stopContinuousPageTurn} onPointerCancel={stopContinuousPageTurn} onBlur={stopContinuousPageTurn} disabled={activeChapterIndex <= 0 && activeScreenPage <= 0}><ReaderToolbarIcon name="prevPage" /></button>
            <span className="reader-page-meter" aria-live="polite">{pageMeterText}</span>
            {readerDailyGoalEnabled && readerDailyGoalHasTargets ? (
              <span className="reader-goal-progress" role="status" aria-live="polite" aria-label={t('reader.goal.progressAria', { percent: readerDailyGoalPercent })}>
                <span className="reader-goal-progress-fill" style={{ width: `${readerDailyGoalPercent}%` }} />
                <span className="reader-goal-progress-text">{t('reader.goal.progress', { percent: readerDailyGoalPercent, segments: readerDailyGoalSegments.join(' · ') })}</span>
              </span>
            ) : null}
            <button className="reader-icon-btn" data-tooltip={t('reader.nextPage')} aria-label={t('reader.nextPage')} onClick={(event) => handlePageTurnButtonClick(event, 'next')} onPointerDown={(event) => startContinuousPageTurn(event, 'next')} onPointerUp={stopContinuousPageTurn} onPointerLeave={stopContinuousPageTurn} onPointerCancel={stopContinuousPageTurn} onBlur={stopContinuousPageTurn} disabled={settings.layoutMode === 'page' ? activeStreamIndex >= Math.max(0, pageStreamLength - 1) : activeChapterIndex >= chaptersLength - 1 && activeScreenPage >= screenPageCount - 1}><ReaderToolbarIcon name="nextPage" /></button>
            <label className="reader-page-jump">
              <input value={pageJumpValue} onChange={(event) => { setPageJumpValue(event.target.value); setPageJumpError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') jumpToPageValue(); }} placeholder={t('reader.pageJump')} aria-invalid={Boolean(pageJumpError)} aria-describedby={pageJumpError ? 'reader-page-jump-error' : undefined} />
              {pageJumpError ? <small id="reader-page-jump-error" role="alert">{pageJumpError}</small> : null}
            </label>
          </div>
        </div>
        <div className="reader-toolbar-icon-row reader-toolbar-section search" aria-label={t('reader.toolbar.actions')}>
          <button type="button" className={searchPanelOpen ? 'reader-icon-btn active' : 'reader-icon-btn'} data-tooltip={t('reader.search.open')} aria-label={t('reader.search.open')} aria-expanded={searchPanelOpen} onClick={() => { if (searchPanelOpen) setSearchPanelOpen(false); else openReaderSearchPanel(); }}><ReaderToolbarIcon name="readerSearch" /></button>
          {readerReadAloudEnabled ? (
            readAloudActive ? (
              <>
                <button type="button" className={readAloudPaused ? 'reader-icon-btn active' : 'reader-icon-btn'} data-tooltip={readAloudPaused ? t('reader.readAloud.resume') : t('reader.readAloud.pause')} aria-label={readAloudPaused ? t('reader.readAloud.resume') : t('reader.readAloud.pause')} aria-pressed={!readAloudPaused} onClick={pauseOrResumeReaderReadAloud}><ReaderToolbarIcon name={readAloudPaused ? 'play' : 'pause'} /></button>
                <button type="button" className="reader-icon-btn" data-tooltip={t('reader.readAloud.stop')} aria-label={t('reader.readAloud.stop')} onClick={stopReaderReadAloud}><ReaderToolbarIcon name="stop" /></button>
              </>
            ) : (
              <button type="button" className="reader-icon-btn" data-tooltip={readAloudStartLabel} aria-label={readAloudStartLabel} disabled={!readAloudAvailable} onClick={startReaderReadAloud}><ReaderToolbarIcon name="play" /></button>
            )
          ) : null}
          <button type="button" className="reader-icon-btn" data-tooltip={t('reader.moyuMode')} aria-label={t('reader.moyuMode')} onClick={onOpenMoyuMode}><ReaderToolbarIcon name="moyuMode" /></button>
          {isNetworkBook ? <button type="button" className={networkToolsOpen ? 'reader-icon-btn active reader-action-medium' : 'reader-icon-btn reader-action-medium'} data-tooltip={t('reader.networkTools')} aria-label={t('reader.networkTools')} aria-expanded={networkToolsOpen} onClick={() => setNetworkToolsOpen((value) => !value)}><ReaderToolbarIcon name="networkTools" /></button> : null}
          {onOpenCharacters && book ? <button type="button" className="reader-icon-btn reader-action-wide" data-tooltip={t('reader.characters.open')} aria-label={t('reader.characters.open')} onClick={() => onOpenCharacters(book.id)}><ReaderToolbarIcon name="characters" /></button> : null}
          <button type="button" className="reader-icon-btn reader-action-wide" data-tooltip={t('reader.settings')} aria-label={t('reader.settings')} onClick={onOpenSettings}><ReaderToolbarIcon name="readerSettings" /></button>
          <button type="button" className={rulesPanelOpen ? 'reader-icon-btn active reader-action-wide' : 'reader-icon-btn reader-action-wide'} data-tooltip={t('reader.rules')} aria-label={t('reader.rules')} aria-pressed={rulesPanelOpen} onClick={onToggleRulesPanel}><ReaderToolbarIcon name="wrench" /></button>
          <button type="button" className={aiPanelOpen ? 'reader-icon-btn active reader-ai-icon-btn reader-action-wide' : 'reader-icon-btn reader-ai-icon-btn reader-action-wide'} data-tooltip={t('ai.title')} aria-label={t('ai.title')} aria-pressed={aiPanelOpen} onClick={onToggleAiPanel}><ReaderToolbarIcon name="aiDesk" /></button>
          <button type="button" className="reader-icon-btn reader-action-medium" data-tooltip={t('reader.bookmark.add')} aria-label={t('reader.bookmark.add')} onClick={onCreateBookmark}><ReaderToolbarIcon name="bookmark" /></button>
          <button type="button" className={showHighlightPanel ? 'reader-icon-btn active reader-action-medium' : 'reader-icon-btn reader-action-medium'} data-tooltip={t('reader.highlights.panel')} aria-label={t('reader.highlights.panel')} aria-pressed={showHighlightPanel} onClick={() => setShowHighlightPanel((value) => !value)}><ReaderToolbarIcon name="highlights" /></button>
          <button type="button" className={focusMode ? 'reader-icon-btn active reader-action-medium' : 'reader-icon-btn reader-action-medium'} data-tooltip={focusMode ? t('reader.focusMode.on') : t('reader.focusMode')} aria-label={focusMode ? t('reader.focusMode.on') : t('reader.focusMode')} aria-pressed={focusMode} onClick={() => toggleFocusMode()}><ReaderToolbarIcon name="focusMode" /></button>
          {!standaloneReader ? <button type="button" className="reader-icon-btn reader-action-medium" data-tooltip={t('reader.windowed')} aria-label={t('reader.windowed')} onClick={onToggleWindowed}><ReaderToolbarIcon name="windowed" /></button> : null}
          <details ref={moreMenuRef} className="reader-toolbar-more"><summary className="reader-icon-btn" data-tooltip={t('reader.more')} aria-label={t('reader.more')}><ReaderToolbarIcon name="more" /></summary>
            <div className="reader-more-popover">
              <section className="reader-more-section action-section">
                <div className="reader-more-section-head"><span>{t('reader.more.actions')}</span></div>
                <div className="reader-more-actions-grid">
                  {onOpenCharacters && book ? <button type="button" className="ghost-btn small reader-overflow-wide" onClick={() => runMoreAction(() => onOpenCharacters(book.id))}><ReaderToolbarIcon name="characters" />{t('reader.characters.open')}</button> : null}
                  <button type="button" className="ghost-btn small reader-overflow-wide" onClick={() => runMoreAction(onOpenSettings)}><ReaderToolbarIcon name="readerSettings" />{t('reader.settings')}</button>
                  <button type="button" className={rulesPanelOpen ? 'ghost-btn small active reader-overflow-wide' : 'ghost-btn small reader-overflow-wide'} aria-pressed={rulesPanelOpen} onClick={() => runMoreAction(onToggleRulesPanel)}><ReaderToolbarIcon name="wrench" />{t('reader.rules')}</button>
                  <button type="button" className={aiPanelOpen ? 'ghost-btn small active reader-overflow-wide' : 'ghost-btn small reader-overflow-wide'} aria-pressed={aiPanelOpen} onClick={() => runMoreAction(onToggleAiPanel)}><ReaderToolbarIcon name="aiDesk" />{t('ai.title')}</button>
                  <button type="button" className="ghost-btn small reader-overflow-medium" onClick={() => runMoreAction(onCreateBookmark)}><ReaderToolbarIcon name="bookmark" />{t('reader.bookmark.add')}</button>
                  <button type="button" className={showHighlightPanel ? 'ghost-btn small active reader-overflow-medium' : 'ghost-btn small reader-overflow-medium'} aria-pressed={showHighlightPanel} onClick={() => runMoreAction(() => setShowHighlightPanel((value) => !value))}><ReaderToolbarIcon name="highlights" />{t('reader.highlights.panel')}</button>
                  {onToggleRightPanelSidebar ? (
                    <button
                      type="button"
                      className={!rightPanelsCollapsed && rightPanelSessionsOpen ? 'ghost-btn small active reader-overflow-medium' : 'ghost-btn small reader-overflow-medium'}
                      aria-pressed={Boolean(!rightPanelsCollapsed && rightPanelSessionsOpen)}
                      onClick={() => runMoreAction(onToggleRightPanelSidebar)}
                    >
                      <ReaderToolbarIcon name={!rightPanelsCollapsed && rightPanelSessionsOpen ? 'libraryGroupExpand' : 'libraryGroupCollapse'} />
                      {!rightPanelsCollapsed && rightPanelSessionsOpen ? t('reader.panel.sidebar.hide') : t('reader.panel.sidebar.show')}
                    </button>
                  ) : null}
                  <button type="button" className={focusMode ? 'ghost-btn small active reader-overflow-medium' : 'ghost-btn small reader-overflow-medium'} aria-pressed={focusMode} onClick={() => runMoreAction(() => toggleFocusMode())}><ReaderToolbarIcon name="focusMode" />{focusMode ? t('reader.focusMode.on') : t('reader.focusMode')}</button>
                  {!standaloneReader ? <button type="button" className="ghost-btn small reader-overflow-medium" onClick={() => runMoreAction(onToggleWindowed)}><ReaderToolbarIcon name="windowed" />{t('reader.windowed')}</button> : null}
                </div>
              </section>
              {standaloneReader ? <section className="reader-more-section window-section">
                <div className="reader-more-section-head"><span>{t('reader.windowTitle')}</span></div>
                <div className="reader-more-status">
                  <span className="reader-window-sync-status" role="status">{t('reader.window.syncStatus', { status: readerWindowSyncStatus })}</span>
                </div>
                <div className="reader-more-group window-tools">
                  <button className="ghost-btn small" type="button" onClick={() => runMoreAction(onReturnToMainWindow)}>{t('reader.window.returnToMain')}</button>
                  <button className="ghost-btn small" type="button" aria-pressed={isFullscreen} onClick={() => runMoreAction(onToggleFullscreen)}>{isFullscreen ? t('reader.fullscreen.on') : t('reader.fullscreen.off')}</button>
                  <button className="ghost-btn small" type="button" aria-pressed={isAlwaysOnTop} onClick={() => runMoreAction(onToggleAlwaysOnTop)}>{isAlwaysOnTop ? t('reader.alwaysOnTop.on') : t('reader.alwaysOnTop.off')}</button>
                </div>
              </section> : null}
            </div>
          </details>
          {onToggleRightPanelSidebar ? (
            <button
              type="button"
              className={!rightPanelsCollapsed && rightPanelSessionsOpen ? 'reader-icon-btn active reader-right-panel-toggle' : 'reader-icon-btn reader-right-panel-toggle'}
              data-tooltip={!rightPanelsCollapsed && rightPanelSessionsOpen ? t('reader.panel.sidebar.hide') : t('reader.panel.sidebar.show')}
              aria-label={!rightPanelsCollapsed && rightPanelSessionsOpen ? t('reader.panel.sidebar.hide') : t('reader.panel.sidebar.show')}
              aria-pressed={Boolean(!rightPanelsCollapsed && rightPanelSessionsOpen)}
              onClick={onToggleRightPanelSidebar}
            >
              <ReaderToolbarIcon name={!rightPanelsCollapsed && rightPanelSessionsOpen ? 'libraryGroupExpand' : 'libraryGroupCollapse'} />
            </button>
          ) : null}
        </div>
        </div>
      </div>
      {toolbarTooltip ? createPortal(
        <div className="reader-toolbar-tooltip" role="tooltip" style={{ left: toolbarTooltip.left, top: toolbarTooltip.top }}>{toolbarTooltip.text}</div>,
        document.body,
      ) : null}
      {networkToolsOpen && book.networkSource ? (
        <section className="reader-network-tools-panel" aria-label={t('reader.networkTools')}>
          <header>
            <div>
              <strong>{t('reader.networkTools')}</strong>
              <span>{t('reader.networkTools.currentSource', { name: book.networkSource.sourceName })}</span>
            </div>
            <button type="button" aria-label={t('common.cancel')} onClick={() => setNetworkToolsOpen(false)}>×</button>
          </header>
          <div className="reader-network-tools-grid">
            <label className="reader-network-tools-preload">
              <span>{t('reader.networkTools.preloadCount')}</span>
              <input
                type="number"
                min={0}
                max={50}
                value={networkPreloadCount}
                onChange={(event) => updateNetworkPreloadCount(Number(event.target.value) || 0)}
              />
            </label>
            <p className="reader-network-tools-stat"><span>{t('reader.networkTools.loaded', { count: book.networkSource.cachedChapterCount ?? 0, total: book.networkSource.tocCount })}</span></p>
            <div className="reader-network-tools-actions">
              <button type="button" className="ghost-btn small" onClick={() => void openExternalUrl(book.networkSource?.bookUrl || '')}>{t('reader.networkTools.openSite')}</button>
              <button type="button" className="ghost-btn small" onClick={() => { void loadNetworkSourceCandidates(); }}>{networkSourceLoading ? t('reader.networkTools.sourceLoading') : t('reader.networkTools.switchSource')}</button>
              <button type="button" className="ghost-btn small" onClick={() => { void openSourceEditor(); }}>{t('reader.networkTools.editSource')}</button>
            </div>
          </div>
          <div className="reader-network-source-list">
            {networkSourceCandidates.map((source) => {
              const sourceKey = `${source.sourceId}\n${source.bookUrl}`;
              const active = sourceKey === `${book.networkSource?.sourceId}\n${book.networkSource?.bookUrl}`;
              return (
                <button type="button" key={sourceKey} className={active ? 'active' : ''} disabled={active || networkSourceSwitchingKey === sourceKey} onClick={() => { void switchReaderNetworkSource(source); }}>
                  {source.coverUrl ? <img src={source.coverUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : <ReaderToolbarIcon name="networkTools" />}
                  <span><strong>{source.sourceName}</strong><em>{[source.author, source.latestChapter].filter(Boolean).join(' · ') || source.name}</em></span>
                </button>
              );
            })}
          </div>
          <a className="reader-network-tools-site" href={book.networkSource.bookUrl} onClick={(event) => { event.preventDefault(); void openExternalUrl(book.networkSource?.bookUrl || ''); }}>{t('reader.networkTools.currentSite')}</a>
        </section>
      ) : null}
      {sourceEditorOpen ? createPortal(
        <aside className="reader-source-editor-drawer" aria-label={t('reader.networkTools.editSource')}>
          <header>
            <div>
              <strong>{t('reader.networkTools.editSource')}</strong>
              <span>{sourceEditorPayload?.name || book.networkSource?.sourceName || ''}</span>
            </div>
            <button type="button" aria-label={t('common.cancel')} onClick={() => setSourceEditorOpen(false)}>×</button>
          </header>
          {sourceEditorLoading ? <p>{t('reader.networkTools.sourceEditorLoading')}</p> : null}
          {sourceEditorPayload ? (
            <div className="reader-source-editor-meta">
              <span>{sourceEditorPayload.group || t('common.none')}</span>
              <span>{sourceEditorPayload.baseUrl}</span>
            </div>
          ) : null}
          <div className="reader-source-editor-tabs" role="tablist" aria-label={t('reader.networkTools.editSource')}>
            <button type="button" className={sourceEditorMode === 'form' ? 'active' : ''} role="tab" aria-selected={sourceEditorMode === 'form'} onClick={() => setSourceEditorMode('form')}>{t('reader.networkTools.formMode')}</button>
            <button type="button" className={sourceEditorMode === 'json' ? 'active' : ''} role="tab" aria-selected={sourceEditorMode === 'json'} onClick={() => setSourceEditorMode('json')}>{t('reader.networkTools.jsonMode')}</button>
          </div>
          {sourceEditorMode === 'json' ? (
            <textarea className="reader-source-editor-json" value={sourceEditorJson} onChange={(event) => setSourceEditorJson(event.target.value)} spellCheck={false} />
          ) : (
            <>
              <div className="reader-source-editor-group-tabs" role="tablist" aria-label={t('reader.networkTools.formMode')}>
                {sourceEditorGroups.map((group) => (
                  <button key={group.id} type="button" className={group.id === activeSourceEditorGroup.id ? 'active' : ''} role="tab" aria-selected={group.id === activeSourceEditorGroup.id} onClick={() => setSourceEditorGroup(group.id)}>
                    {group.label}
                  </button>
                ))}
              </div>
              <section className="reader-source-editor-section">
                <h3>{activeSourceEditorGroup.label}</h3>
                <div>
                  {activeSourceEditorGroup.fields.map((field) => (
                    <SourceEditorTextField key={field.path.join('.')} rawJson={sourceEditorJson} {...field} onChange={setSourceEditorJson} />
                  ))}
                </div>
              </section>
            </>
          )}
          {sourceEditorError ? <p className="reader-source-editor-error">{sourceEditorError}</p> : null}
          <footer>
            <button type="button" className="ghost-btn small" onClick={() => setSourceEditorOpen(false)}>{t('common.cancel')}</button>
            <button type="button" className="primary-btn small" disabled={sourceEditorSaving || sourceEditorLoading || !sourceEditorPayload} onClick={() => { void saveSourceEditor(); }}>{sourceEditorSaving ? t('common.loading') : t('common.save')}</button>
          </footer>
        </aside>,
        document.body,
      ) : null}
      {searchPanelOpen ? (
        <div className="reader-search-panel" role="search" aria-label={t('reader.search.open')}>
          <div ref={searchPanelRowRef} className="reader-search-panel-row" data-overflow-level={searchOverflowLevel}>
            <input className="reader-search-query-input" ref={searchInputRef} value={readerSearchQuery} onChange={(event) => setReaderSearchQuery(event.target.value)} onKeyDown={onReaderSearchKeyDown} placeholder={t('reader.search.placeholder')} aria-label={t('reader.search.placeholder')} />
            <div className="reader-search-actions" role="toolbar" aria-label={t('reader.search.open')}>
              <ThemedSelect className="reader-compact-select search-scope-select reader-search-top-select reader-search-top-scope" label={t('reader.search.scope')} value={readerSearchScope} options={readerSearchScopeOptions} onChange={setReaderSearchScope} ariaLabel={t('reader.search.scope')} menuPlacement="bottom" />
              {readerSearchChapterFilterEnabled ? <ReaderSearchChapterCombobox className="reader-compact-select reader-search-top-select reader-search-top-chapter reader-search-chapter-select" label={t('reader.search.chapterRange')} value={readerSearchChapterFilter} options={readerSearchChapterOptions} onChange={setReaderSearchChapterFilter} ariaLabel={t('reader.search.chapterRange')} noMatchLabel={t('reader.chapterSelect.noMatch')} /> : null}
              <ThemedSelect className="reader-compact-select reader-search-top-select reader-search-top-limit reader-search-limit-select" label={t('reader.search.limit')} value={String(readerSearchLimit)} options={READER_SEARCH_LIMIT_OPTIONS.map((value) => ({ value: String(value), label: String(value) }))} onChange={(value) => setReaderSearchLimit(Number(value))} ariaLabel={t('reader.search.limit')} menuPlacement="bottom" />
              <button type="button" className="reader-search-icon-btn reader-search-top-navigation" data-tooltip={t('reader.search.prev')} aria-label={t('reader.search.prev')} disabled={!readerSearchHits.length} onClick={() => goRelativeSearchHit(-1)}><ReaderToolbarIcon name="prevPage" /></button>
              <button type="button" className="reader-search-icon-btn reader-search-top-navigation" data-tooltip={t('reader.search.next')} aria-label={t('reader.search.next')} disabled={!readerSearchHits.length} onClick={() => goRelativeSearchHit(1)}><ReaderToolbarIcon name="nextPage" /></button>
              <button type="button" className="reader-search-icon-btn reader-search-top-primary" data-tooltip={t('reader.search.caseSensitive')} aria-label={t('reader.search.caseSensitive')} aria-pressed={readerSearchCaseSensitive} onClick={() => setReaderSearchCaseSensitive((value) => !value)}><span aria-hidden="true">Aa</span></button>
              <button type="button" className={readerSearchFuzzy ? 'reader-search-icon-btn active reader-search-top-primary' : 'reader-search-icon-btn reader-search-top-primary'} data-tooltip={t('reader.search.fuzzy')} aria-label={t('reader.search.fuzzy')} aria-pressed={readerSearchFuzzy} onClick={() => setReaderSearchFuzzy((value) => !value)}><ReaderToolbarIcon name="focusMode" /></button>
              <button type="button" className={readerSearchRegex ? 'reader-search-icon-btn active reader-search-top-secondary' : 'reader-search-icon-btn reader-search-top-secondary'} data-tooltip={t('reader.search.regex')} aria-label={t('reader.search.regex')} aria-pressed={readerSearchRegex} onClick={() => setReaderSearchRegex((value) => !value)}><ReaderToolbarIcon name="grid" /></button>
              <button type="button" className={readerSearchNormalizeTraditionalChinese ? 'reader-search-icon-btn active reader-search-top-secondary' : 'reader-search-icon-btn reader-search-top-secondary'} data-tooltip={t('reader.search.normalizeTraditional')} aria-label={t('reader.search.normalizeTraditional')} aria-pressed={readerSearchNormalizeTraditionalChinese} onClick={() => setReaderSearchNormalizeTraditionalChinese((value) => !value)}><ReaderToolbarIcon name="translate" /></button>
              <button type="button" className={readerSearchNormalizeNfkc ? 'reader-search-icon-btn active reader-search-top-secondary' : 'reader-search-icon-btn reader-search-top-secondary'} data-tooltip={t('reader.search.normalizeNfkc')} aria-label={t('reader.search.normalizeNfkc')} aria-pressed={readerSearchNormalizeNfkc} onClick={() => setReaderSearchNormalizeNfkc((value) => !value)}><ReaderToolbarIcon name="wrench" /></button>
              <button type="button" className={readerSearchPinyinInitials ? 'reader-search-icon-btn active reader-search-top-secondary' : 'reader-search-icon-btn reader-search-top-secondary'} data-tooltip={t('reader.search.pinyinInitials')} aria-label={t('reader.search.pinyinInitials')} aria-pressed={readerSearchPinyinInitials} onClick={() => setReaderSearchPinyinInitials((value) => !value)}><ReaderToolbarIcon name="note" /></button>
              {readerSavedSearchLimit > 0 ? <button type="button" className="reader-search-icon-btn reader-search-top-save" data-tooltip={t('reader.search.save')} aria-label={t('reader.search.save')} disabled={!readerSearchQuery.trim()} onClick={saveReaderSearch}><ReaderToolbarIcon name="bookmark" /></button> : null}
              <details className="reader-search-more">
                <summary className="reader-search-icon-btn" data-tooltip={t('reader.more')} aria-label={t('reader.more')}><ReaderToolbarIcon name="more" /></summary>
                <div className="reader-search-more-popover">
                  <div className="reader-search-select-grid">
                    <ThemedSelect className="reader-compact-select search-scope-select reader-search-more-select reader-search-more-scope" label={t('reader.search.scope')} value={readerSearchScope} options={readerSearchScopeOptions} onChange={setReaderSearchScope} ariaLabel={t('reader.search.scope')} menuPlacement="bottom" />
                    {readerSearchChapterFilterEnabled ? <ReaderSearchChapterCombobox className="reader-compact-select reader-search-more-select reader-search-more-chapter" label={t('reader.search.chapterRange')} value={readerSearchChapterFilter} options={readerSearchChapterOptions} onChange={setReaderSearchChapterFilter} ariaLabel={t('reader.search.chapterRange')} noMatchLabel={t('reader.chapterSelect.noMatch')} /> : null}
                    <ThemedSelect className="reader-compact-select reader-search-more-select reader-search-more-limit" label={t('reader.search.limit')} value={String(readerSearchLimit)} options={READER_SEARCH_LIMIT_OPTIONS.map((value) => ({ value: String(value), label: String(value) }))} onChange={(value) => setReaderSearchLimit(Number(value))} ariaLabel={t('reader.search.limit')} menuPlacement="bottom" />
                  </div>
                  <div className="reader-search-toggle-grid" role="group" aria-label={t('reader.search.open')}>
                    <button type="button" className="reader-search-more-duplicate reader-search-more-navigation" data-tooltip={t('reader.search.prev')} aria-label={t('reader.search.prev')} disabled={!readerSearchHits.length} onClick={() => goRelativeSearchHit(-1)}><ReaderToolbarIcon name="prevPage" /></button>
                    <button type="button" className="reader-search-more-duplicate reader-search-more-navigation" data-tooltip={t('reader.search.next')} aria-label={t('reader.search.next')} disabled={!readerSearchHits.length} onClick={() => goRelativeSearchHit(1)}><ReaderToolbarIcon name="nextPage" /></button>
                    <button type="button" className={readerSearchCaseSensitive ? 'active reader-search-more-duplicate reader-search-more-primary' : 'reader-search-more-duplicate reader-search-more-primary'} data-tooltip={t('reader.search.caseSensitive')} aria-label={t('reader.search.caseSensitive')} aria-pressed={readerSearchCaseSensitive} onClick={() => setReaderSearchCaseSensitive((value) => !value)}><span aria-hidden="true">Aa</span></button>
                    <button type="button" className={readerSearchFuzzy ? 'active reader-search-more-duplicate reader-search-more-primary' : 'reader-search-more-duplicate reader-search-more-primary'} data-tooltip={t('reader.search.fuzzy')} aria-label={t('reader.search.fuzzy')} aria-pressed={readerSearchFuzzy} onClick={() => setReaderSearchFuzzy((value) => !value)}><ReaderToolbarIcon name="focusMode" /></button>
                    <button type="button" className={readerSearchRegex ? 'active reader-search-more-duplicate reader-search-more-secondary' : 'reader-search-more-duplicate reader-search-more-secondary'} data-tooltip={t('reader.search.regex')} aria-label={t('reader.search.regex')} aria-pressed={readerSearchRegex} onClick={() => setReaderSearchRegex((value) => !value)}><ReaderToolbarIcon name="grid" /></button>
                    <button type="button" className={readerSearchNormalizeTraditionalChinese ? 'active reader-search-more-duplicate reader-search-more-secondary' : 'reader-search-more-duplicate reader-search-more-secondary'} data-tooltip={t('reader.search.normalizeTraditional')} aria-label={t('reader.search.normalizeTraditional')} aria-pressed={readerSearchNormalizeTraditionalChinese} onClick={() => setReaderSearchNormalizeTraditionalChinese((value) => !value)}><ReaderToolbarIcon name="translate" /></button>
                    <button type="button" className={readerSearchNormalizeNfkc ? 'active reader-search-more-duplicate reader-search-more-secondary' : 'reader-search-more-duplicate reader-search-more-secondary'} data-tooltip={t('reader.search.normalizeNfkc')} aria-label={t('reader.search.normalizeNfkc')} aria-pressed={readerSearchNormalizeNfkc} onClick={() => setReaderSearchNormalizeNfkc((value) => !value)}><ReaderToolbarIcon name="wrench" /></button>
                    <button type="button" className={readerSearchPinyinInitials ? 'active reader-search-more-duplicate reader-search-more-secondary' : 'reader-search-more-duplicate reader-search-more-secondary'} data-tooltip={t('reader.search.pinyinInitials')} aria-label={t('reader.search.pinyinInitials')} aria-pressed={readerSearchPinyinInitials} onClick={() => setReaderSearchPinyinInitials((value) => !value)}><ReaderToolbarIcon name="note" /></button>
                    {readerSavedSearchLimit > 0 ? <button type="button" className="reader-search-more-duplicate reader-search-more-save" data-tooltip={t('reader.search.save')} aria-label={t('reader.search.save')} disabled={!readerSearchQuery.trim()} onClick={saveReaderSearch}><ReaderToolbarIcon name="bookmark" /></button> : null}
                  </div>
                  <strong className="reader-search-count reader-search-more-count" aria-live="polite">{readerSearchHits.length}</strong>
                  {(readerSearchHistoryLimit > 0 && readerSearchHistory.length) || (readerSavedSearchLimit > 0 && readerSavedSearches.length) ? (
                    <div className="reader-search-chips" aria-label={t('reader.search.saved')}>
                      {readerSavedSearchLimit > 0 ? readerSavedSearches.map((saved) => <button type="button" key={`saved-${saved.query}`} onClick={() => applyReaderSavedSearch(saved)}>★ {saved.query}</button>) : null}
                      {readerSearchHistoryLimit > 0 ? readerSearchHistory.map((saved) => <button type="button" key={`history-${saved.query}`} onClick={() => applyReaderSavedSearch(saved)}>{saved.query}</button>) : null}
                    </div>
                  ) : null}
                </div>
              </details>
              <strong className="reader-search-count reader-search-top-count" aria-live="polite">{readerSearchHits.length}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

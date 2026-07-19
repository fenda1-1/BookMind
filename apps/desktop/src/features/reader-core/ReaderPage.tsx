import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import { subscribeReaderFlashLocation } from '../../services/appDomainEvents';
import { loadExtendedSettings, saveExtendedSettings, subscribeSettingsUpdated, type ExtendedSettings, type SettingsUpdatedDetail } from '../../services/settingsCenterService';
import type { Book, ReaderBookmark, ReaderHighlightColor, ReaderSettings } from '../../types';
import { type ReaderHighlightViewRequest, type ReaderTextDialogRequest } from './ReaderAnnotationDrawers';
import { ReaderAnnotationOverlays } from './ReaderAnnotationOverlays';
import { getReaderEpubNoteTargetDomId, ReaderContent } from './ReaderContent';
import { resolveReaderHighlightMenuPosition } from './readerPageViewModel';
import { ReaderHighlightContextMenu, type ReaderHighlightMenuState } from './ReaderContextMenus';
import { ReaderEmptyState } from './ReaderEmptyState';
import { ReaderHighlightPanel } from './ReaderHighlightPanel';
import {
  closeReaderRightPanelSession,
  commandReaderRightPanel,
  openReaderRightPanelSession,
  subscribeReaderRightPanelSessions,
  toggleReaderRightPanelSession,
} from './readerRightPanelSessions';
import { type ReaderSelectionMenuState } from './ReaderSelectionMenu';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderToc, type ReaderTocEditHistoryEntry, type ReaderTocMenuState } from './ReaderTocPanel';
import { ReaderTranslationPanel } from './ReaderTranslationPanel';
import { buildReaderSelectionRanges, createReaderGoalProgress, createReaderHighlightIndex, getChapterLocation, getReaderChapterCharacterCount, resolveReaderHighlightColor } from './readerModel';
import type { ReaderChapter, ReaderHighlightRange, ReaderTocEdit } from './readerModel';
import { getReaderHighlightColorShortcutMatch, isReaderShortcutEditableTarget, matchesReaderShortcut, parseBoundedInteger, resolveReaderProgressPercent, resolveReaderStoredProgressPercent, toGoalMinutes } from './readerInteractionModel';
import { buildReaderMemoryDiagnostics, getBrowserMemorySnapshot, type ReaderMemoryDiagnostics } from './readerMemoryDiagnostics';
import { getSelectionParagraphRanges } from './readerPageRuntime';
import { createReaderSelectionActions } from './readerSelectionActions';
import { patchMoyuReaderProfile, resolveMoyuToolbarVisibilityState } from './moyuReaderSettingsModel';
import { useReaderAnnotationPanelController } from './useReaderAnnotationPanelController';
import { useReaderPageMeasurementController } from './useReaderPageMeasurementController';
import { useReaderPaginationController } from './useReaderPaginationController';
import { useReaderReadAloudController } from './useReaderReadAloudController';
import { useReaderSearchController } from './useReaderSearchController';
import { useReaderSurfaceControls } from './useReaderSurfaceControls';
import { useReaderTranslationController } from './useReaderTranslationController';
import { useMoyuReaderSettingsController } from './useMoyuReaderSettingsController';
import { useMoyuWindowDrag } from './useMoyuWindowDrag';
import { useMoyuToolbarInteractions } from './useMoyuToolbarInteractions';
import { useReaderVisiblePageStream } from './useReaderVisiblePageStream';

type ReaderFpsDiagnostics = {
  fps: number;
  lowFrameCount: number;
  lastFrameMs: number;
};

type FlowWidthAnchor = {
  location: string;
  offsetTop: number;
};

type PendingEpubNoteJump = {
  noteId: string;
  chapterIndex: number;
  paragraphIndex: number;
};

type ReaderFlashLocationDetail = {
  sourceChapterIndex?: number;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
  message?: string;
};

type ReaderPageProps = {
  book: Book | null;
  recentBook?: Book | null;
  chapters: ReaderChapter[];
  activeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  settings: ReaderSettings;
  previewSettings?: ReaderSettings | null;
  showToc: boolean;
  onToggleToc: () => void;
  onOpenSettings: () => void;
  rulesPanelOpen: boolean;
  onToggleRulesPanel: () => void;
  tocHierarchyMode: 'novel' | 'document';
  onSelectChapterPage: (index: number, screenPage?: number | 'first' | 'last', paragraphIndex?: number) => void;
  onSelectChapter: (index: number, paragraphIndex?: number) => void;
  onSelectScreenPage: (page: number) => void;
  onPageCountChange: (count: number) => void;
  onVisiblePageTextChange?: (text: string) => void;
  highlights: ReaderHighlightRange[];
  bookmarks: ReaderBookmark[];
  defaultHighlightColor: ReaderHighlightColor;
  standaloneReader: boolean;
  moyuReader: boolean;
  onCreateHighlight: (range: ReaderHighlightRange) => void;
  onDefaultHighlightColorChange: (color: ReaderHighlightColor) => void;
  onUpdateHighlightColor: (id: string, color: ReaderHighlightColor) => void;
  onUpdateHighlightNote: (id: string, note: string) => void;
  onUpdateHighlightDetails: (id: string, updates: { tags?: string[]; importance?: 'normal' | 'high' | 'critical'; reviewStatus?: 'new' | 'due' | 'reviewed'; colorMeaning?: string; updatedAt?: string }) => void;
  onClearHighlightNote: (id: string) => void;
  onDeleteHighlight: (id: string) => void;
  onRestoreHighlight: (highlight: ReaderHighlightRange) => void;
  onDeleteHighlights: (ids: string[]) => void;
  onExportHighlights: (selectedHighlightIds?: Iterable<string>) => void;
  onExportAnnotations: (format: 'json' | 'markdown' | 'csv' | 'anki' | 'obsidian' | 'logseq' | 'readwise' | 'backup', content: ExtendedSettings['annotationExportContent'], selectedIds?: { highlightIds?: Iterable<string>; bookmarkIds?: Iterable<string> }) => void;
  onImportAnnotationsJson: (file: File) => void;
  onExportTocEdits: () => void;
  onImportTocEditsJson: (file: File) => void;
  onCreateBookmark: () => void;
  onUpdateBookmark: (id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }) => void;
  onDeleteBookmark: (id: string) => void;
  onRestoreBookmark: (bookmark: ReaderBookmark) => void;
  onTocEdit: (edit: ReaderTocEdit) => void | Promise<void>;
  onUndoTocEdit: () => void;
  onRedoTocEdit: () => void;
  onRestoreDefaultToc: () => void;
  canUndoTocEdit: boolean;
  canRedoTocEdit: boolean;
  hasTocEdits: boolean;
  tocEditHistory: ReaderTocEditHistoryEntry[];
  onToggleFullscreen: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleWindowed: () => void;
  onOpenMoyuMode: () => void;
  onOpenMoyuSettings: () => void;
  onExitMoyuMode: () => void;
  onReturnToMainWindow: () => void;
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
  readerWindowSyncStatus: string;
  hiddenChapters: ReaderChapter[];
  isActive: boolean;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  onPageWidthChange: (width: number) => void;
  onEffectivePageWidthChange: (width: number) => void;
  onAskSelectionAi: (text: string) => void;
  onGenerateSelectionQuestions: (text: string) => void;
  onCreateSelectionCard: (text: string) => void;
  onChooseBookFile?: () => void;
  onOpenLibrary?: () => void;
  onOpenTasks?: () => void;
  onOpenCharacters?: (bookId: string) => void;
  onOpenRecentBook?: (bookId: string) => void;
  onOpenReaderMemorySettings?: () => void;
  onOpenAiDemo?: () => void;
  onRunParseIndex?: () => void;
  onProgressChange?: (progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
  readerIndexing?: boolean;
  libraryPanelVisible?: boolean;
  onToggleLibraryPanel?: () => void;
};

export function ReaderPage({ book, recentBook, chapters, activeChapterIndex, activeParagraphIndex, activeScreenPage, settings, previewSettings, showToc, onToggleToc, onOpenSettings, rulesPanelOpen, onToggleRulesPanel, tocHierarchyMode, onSelectChapterPage, onSelectChapter, onSelectScreenPage, onPageCountChange, onVisiblePageTextChange, highlights, bookmarks, defaultHighlightColor, standaloneReader, moyuReader, onCreateHighlight, onDefaultHighlightColorChange, onUpdateHighlightColor, onUpdateHighlightNote, onUpdateHighlightDetails, onClearHighlightNote, onDeleteHighlight, onRestoreHighlight, onDeleteHighlights, onExportHighlights, onExportAnnotations, onImportAnnotationsJson, onExportTocEdits, onImportTocEditsJson, onCreateBookmark, onUpdateBookmark, onDeleteBookmark, onRestoreBookmark, onTocEdit, onUndoTocEdit, onRedoTocEdit, onRestoreDefaultToc, canUndoTocEdit, canRedoTocEdit, hasTocEdits, tocEditHistory, onToggleFullscreen, onToggleAlwaysOnTop, onToggleWindowed, onOpenMoyuMode, onOpenMoyuSettings, onExitMoyuMode, onReturnToMainWindow, isFullscreen, isAlwaysOnTop, readerWindowSyncStatus, hiddenChapters, isActive, aiPanelOpen, onToggleAiPanel, onPageWidthChange, onEffectivePageWidthChange, onAskSelectionAi, onGenerateSelectionQuestions, onCreateSelectionCard, onChooseBookFile, onOpenLibrary, onOpenTasks, onOpenCharacters, onOpenRecentBook, onOpenReaderMemorySettings, onOpenAiDemo, onRunParseIndex, onProgressChange, readerIndexing = false, libraryPanelVisible, onToggleLibraryPanel }: ReaderPageProps) {
  const { t } = useI18n();
  const readerTranslation = useReaderTranslationController();
  const [extendedSettings, setExtendedSettings] = useState<ExtendedSettings>(() => loadExtendedSettings());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const moyuAutoScrollFrameRef = useRef<number | null>(null);
  const moyuAutoScrollLastTimeRef = useRef(0);
  const fpsDiagnosticsFrameRef = useRef<number | null>(null);
  const [tocMenu, setTocMenu] = useState<ReaderTocMenuState | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<ReaderSelectionMenuState | null>(null);
  const [highlightMenu, setHighlightMenu] = useState<ReaderHighlightMenuState | null>(null);
  const [textDialog, setTextDialog] = useState<ReaderTextDialogRequest | null>(null);
  const [highlightViewer, setHighlightViewer] = useState<ReaderHighlightViewRequest | null>(null);
  const [bookmarkViewer, setBookmarkViewer] = useState<ReaderBookmark | null>(null);
  const [showHighlightPanel, setShowHighlightPanelState] = useState(false);
  const [searchPanelSessionVisible, setSearchPanelSessionVisible] = useState(false);
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(false);
  const [rightPanelSessionsOpen, setRightPanelSessionsOpen] = useState(false);
  function setShowHighlightPanel(value: boolean | ((current: boolean) => boolean)) {
    // Functional form is toolbar toggle: open/activate, or close only when already active.
    if (typeof value === 'function') {
      toggleReaderRightPanelSession('highlights');
      return;
    }
    if (value) openReaderRightPanelSession('highlights');
    else closeReaderRightPanelSession('highlights');
  }
  function toggleRightPanelSidebar() {
    commandReaderRightPanel({ action: 'toggle-collapsed' });
  }
  useEffect(() => subscribeReaderRightPanelSessions((snapshot) => {
    setShowHighlightPanelState(snapshot.panels.highlights.open && snapshot.activeId === 'highlights' && !snapshot.collapsed);
    setSearchPanelSessionVisible(snapshot.panels.search.open && snapshot.activeId === 'search' && !snapshot.collapsed);
    setRightPanelsCollapsed(Boolean(snapshot.collapsed));
    setRightPanelSessionsOpen(snapshot.order.some((id) => snapshot.panels[id]?.open));
  }), []);
  const [activeAnnotationTab, setActiveAnnotationTab] = useState<'highlights' | 'bookmarks'>('highlights');
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [pageJumpError, setPageJumpError] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [readerJumpNotice, setReaderJumpNotice] = useState('');
  const [readerJumpHighlight, setReaderJumpHighlight] = useState<ReaderHighlightRange | null>(null);
  const [readerFpsDiagnostics, setReaderFpsDiagnostics] = useState<ReaderFpsDiagnostics | null>(null);
  const [readerMemoryDiagnostics, setReaderMemoryDiagnostics] = useState<ReaderMemoryDiagnostics | null>(null);
  const [readAloudViewportTick, setReadAloudViewportTick] = useState(0);
  const [expandedTitleIds, setExpandedTitleIds] = useState<Set<string>>(() => new Set());
  const [moyuPointerInside, setMoyuPointerInside] = useState(false);
  const readerDailyGoalSessionRef = useRef({ bookId: '', layoutMode: settings.layoutMode, pageStreamReady: false, accumulatedMs: 0, activeStartedAt: 0, startChapterIndex: activeChapterIndex, startPageIndex: activeScreenPage, startStreamIndex: 0 });
  const {
    moyuSettings,
    setMoyuSettings,
    updateMoyuSettings,
    saveCurrentMoyuSettings,
    restoreSavedMoyuSettings,
    restoreLastMoyuPreset,
    restoreDefaultMoyuSettings,
  } = useMoyuReaderSettingsController({ moyuReader, bookId: book?.id });
  const { startMoyuWindowDrag } = useMoyuWindowDrag(moyuSettings.interactionLocked);
  const [readerDailyGoalElapsedMinutes, setReaderDailyGoalElapsedMinutes] = useState(0);
  const floatingMenuFocusRef = useRef<HTMLElement | null>(null);
  const readerJumpNoticeTimerRef = useRef<number | null>(null);
  const readerJumpHighlightTimerRef = useRef<number | null>(null);
  const pendingReaderFlashLocationRef = useRef<ReaderFlashLocationDetail | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressSelectionTimerRef = useRef<number | null>(null);
  const suppressClickAfterLongPressRef = useRef(false);
  const previousLayoutModeRef = useRef<ReaderSettings['layoutMode']>(settings.layoutMode);
  const flowAnchorRestoreFrameRef = useRef<number | null>(null);
  const flowWidthAnchorRef = useRef<FlowWidthAnchor | null>(null);
  const flowWidthAnchorRestoreFrameRef = useRef<number | null>(null);
  const flowScrollAnchorRestoreFrameRef = useRef<number | null>(null);
  const flowScrollAnchorRestorePendingRef = useRef(false);
  const pendingEpubNoteJumpRef = useRef<PendingEpubNoteJump | null>(null);
  const pendingEpubNoteJumpFrameRef = useRef<number | null>(null);
  const pendingBookRestoreIdRef = useRef('');
  const lastBookRestoreKeyRef = useRef('');
  const suppressFlowLocationObserverUntilRef = useRef(0);
  const flowVirtualBoundaryLockRef = useRef(0);
  const flowVirtualBoundaryLastScrollTopRef = useRef(0);
  const visualSettings = previewSettings ?? settings;
  const {
    tocWidth,
    cursorHidden,
    setCursorHidden,
    startPageWidthDrag,
    startTocWidthDrag,
    onTocWidthGripKeyDown,
    onPageWidthGripKeyDown,
    onReaderPointerMove,
  } = useReaderSurfaceControls({
    pageWidth: settings.pageWidth,
    layoutMode: settings.layoutMode,
    autoHideCursor: extendedSettings.autoHideCursor,
    onPageWidthChange,
    captureFlowWidthAnchor,
    restoreFlowWidthAnchorAfterResize,
  });
  const activeChapter = chapters[activeChapterIndex] ?? chapters[0];
  const totalChapterCharacters = useMemo(() => chapters.reduce((sum, chapter) => sum + getReaderChapterCharacterCount(chapter), 0), [chapters]);
  const automaticLargeBookPerformanceMode = chapters.length > 500 || totalChapterCharacters > 3_000_000;
  const largeBookPerformanceMode = extendedSettings.largeBookPerformanceMode || automaticLargeBookPerformanceMode;
  const virtualChapterRadius = largeBookPerformanceMode ? 1 : parseBoundedInteger(extendedSettings.virtualChapterRadius, 3, 0, 10);
  const virtualParagraphWindowSize = largeBookPerformanceMode ? 40 : parseBoundedInteger(extendedSettings.virtualParagraphWindowSize, 80, 20, 240);
  const wheelPagingThresholdPx = parseBoundedInteger(extendedSettings.wheelPagingThresholdPx, 80, 20, 240);
  const gesturePagingThresholdPx = parseBoundedInteger(extendedSettings.gesturePagingThresholdPx, 96, 40, 240);
  const readerPageCacheEnabled = extendedSettings.readerPageCacheEnabled;
  const readerPagePreheatEnabled = extendedSettings.readerPagePreheatEnabled;
  const readerPageMeasureCacheLimit = parseBoundedInteger(extendedSettings.readerPageMeasureCacheLimit, 48, 1, 96);
  const configuredReaderPageCacheLimit = readerPageCacheEnabled ? parseBoundedInteger(extendedSettings.readerPageCacheLimit, 30, 0, 200) : 0;
  const readerPageCacheLimit = largeBookPerformanceMode ? Math.min(10, configuredReaderPageCacheLimit) : configuredReaderPageCacheLimit;
  const readerPagePreheatRange = largeBookPerformanceMode ? 0 : (readerPagePreheatEnabled ? parseBoundedInteger(extendedSettings.readerPagePreheatRange, 1, 0, 5) : 0);
  const {
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
  } = useReaderPageMeasurementController({
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
  });
  const { renderVisiblePageStream, displayedStreamIndex } = useReaderVisiblePageStream({
    layoutMode: settings.layoutMode,
    activePageChunksMeasured,
    visiblePageStream,
    pageMeasurementScopeKey,
    activeChapterIndex,
    activeScreenPage,
    activeStreamIndex,
    onVisiblePageTextChange,
  });
  const {
    searchInputRef,
    setSearchPanelOpen: setSearchPanelOpenState,
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
    onReaderSearchKeyDown: onReaderSearchInputKeyDown,
    saveReaderSearch,
    applyReaderSavedSearch,
  } = useReaderSearchController({
    chapters,
    highlights,
    bookmarks,
    activeChapterIndex,
    activePageEntries: activePageChunk?.entries,
    extendedSettings,
    onJumpToSearchHit: (hit) => jumpToParagraph(hit.chapterIndex, hit.paragraphIndex, hit.matchIndex),
  });
  const searchPanelOpen = searchPanelSessionVisible;
  useEffect(() => {
    setSearchPanelOpenState(searchPanelSessionVisible);
  }, [searchPanelSessionVisible, setSearchPanelOpenState]);
  function setSearchPanelOpen(value: boolean | ((current: boolean) => boolean)) {
    const nextOpen = typeof value === 'function' ? value(searchPanelSessionVisible) : value;
    setSearchPanelOpenState(nextOpen);
    if (nextOpen) openReaderRightPanelSession('search');
    else closeReaderRightPanelSession('search');
  }
  function openReaderSearchPanel() {
    setSearchPanelOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }
  function onReaderSearchKeyDown(event: Parameters<typeof onReaderSearchInputKeyDown>[0]) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchPanelOpen(false);
      return;
    }
    onReaderSearchInputKeyDown(event);
  }
  const {
    highlightSearchQuery,
    setHighlightSearchQuery,
    highlightQueryScope,
    setHighlightQueryScope,
    highlightSort,
    setHighlightSort,
    highlightNoteFilter,
    setHighlightNoteFilter,
    highlightChapterFilter,
    setHighlightChapterFilter,
    highlightTagFilter,
    setHighlightTagFilter,
    highlightImportanceFilter,
    setHighlightImportanceFilter,
    highlightReviewFilter,
    setHighlightReviewFilter,
    bookmarkSearchQuery,
    setBookmarkSearchQuery,
    bookmarkSort,
    setBookmarkSort,
    bookmarkGroupBy,
    setBookmarkGroupBy,
    bookmarkColorFilter,
    setBookmarkColorFilter,
    annotationExportChoice,
    setAnnotationExportChoice,
    selectedBookmarkIds,
    setSelectedBookmarkIds,
    bulkBookmarkTags,
    setBulkBookmarkTags,
    bulkBookmarkTagMode,
    setBulkBookmarkTagMode,
    bulkBookmarkNote,
    setBulkBookmarkNote,
    bulkBookmarkNoteMode,
    setBulkBookmarkNoteMode,
    bulkBookmarkColor,
    setBulkBookmarkColor,
    highlightColorFilter,
    setHighlightColorFilter,
    selectedHighlightIds,
    setSelectedHighlightIds,
    undoToast,
    setUndoToast,
    filteredHighlights,
    highlightGroups,
    highlightVirtualWindow,
    annotationTagSuggestions,
    highlightTagOptions,
    filteredBookmarks,
    selectedBookmarks,
    bookmarkGroups,
    bookmarkVirtualWindow,
    highlightFiltersActive,
    bookmarkFiltersActive,
    syncAnnotationPanelSettings,
    exportSelectedAnnotations,
    toggleHighlightSelection,
    toggleBookmarkSelection,
    applyBulkBookmarkEdit,
    showUndoToast,
    deleteHighlightWithUndo,
    deleteBookmarkWithUndo,
  } = useReaderAnnotationPanelController({
    chapters,
    activeChapterIndex,
    highlights,
    bookmarks,
    extendedSettings,
    defaultBookmarkColor: extendedSettings.defaultBookmarkColor,
    onExportHighlights,
    onExportAnnotations,
    onUpdateBookmark,
    onDeleteHighlight,
    onRestoreHighlight,
    onDeleteBookmark,
    onRestoreBookmark,
    t,
  });
  const renderHighlights = useMemo(() => readerJumpHighlight ? [...highlights, readerJumpHighlight] : highlights, [highlights, readerJumpHighlight]);
  const highlightIndex = useMemo(() => createReaderHighlightIndex(renderHighlights), [renderHighlights]);
  const selectionMenuEnabled = extendedSettings.selectionMenuEnabled;
  const doubleClickWordSelectionEnabled = extendedSettings.doubleClickWordSelectionEnabled;
  const contextMenuEnabled = extendedSettings.contextMenuEnabled;
  const customReaderColorsEnabled = Boolean(visualSettings.customBackgroundColor || visualSettings.customTextColor || visualSettings.customSelectionColor);
  const moyuToolbarVisibility = useMemo(
    () => resolveMoyuToolbarVisibilityState({
      toolbarsHidden: moyuSettings.toolbarsHidden,
      toolbarRevealMode: moyuSettings.toolbarRevealMode,
      toolbarVisible: !moyuSettings.toolbarsHidden || (moyuSettings.toolbarRevealMode === 'hover' && moyuPointerInside),
    }),
    [moyuSettings.toolbarsHidden, moyuSettings.toolbarRevealMode, moyuPointerInside],
  );
  const readerDailyGoalEnabled = extendedSettings.readerDailyGoalEnabled;
  const readerDailyPagesGoal = parseBoundedInteger(extendedSettings.readerDailyPagesGoal, 30, 0, 1000);
  const readerDailyMinutesGoal = parseBoundedInteger(extendedSettings.readerDailyMinutesGoal, 30, 0, 1440);
  const readerDailyChaptersGoal = parseBoundedInteger(extendedSettings.readerDailyChaptersGoal, 2, 0, 200);
  const {
    readAloudActive,
    readAloudPaused,
    readAloudLocation,
    readerReadAloudEnabled,
    readAloudAvailable,
    readAloudStartLabel,
    startReaderReadAloud,
    pauseOrResumeReaderReadAloud,
    cancelReaderReadAloudEngine,
    stopReaderReadAloud,
  } = useReaderReadAloudController({
    activeChapter,
    extendedSettings,
    bookId: book?.id,
    t,
  });
  const readerSearchHighlightColor = extendedSettings.readerSearchHighlightColor;
  const annotationMarkdownEditorEnabled = extendedSettings.annotationMarkdownEditorEnabled;
  const readerSelectionActions = createReaderSelectionActions({
    selectionMenu,
    defaultHighlightColor,
    annotationMarkdownEditorEnabled,
    openNoteAfterHighlight: extendedSettings.openNoteAfterHighlight,
    allowEmptyNotes: extendedSettings.allowEmptyNotes,
    noteTemplate: extendedSettings.noteTemplate,
    noteAutoContext: extendedSettings.noteAutoContext,
    noteAutoReaderLocation: extendedSettings.noteAutoReaderLocation,
    selectionMenuEnabled,
    doubleClickWordSelectionEnabled,
    highlightNotePromptLabel: t('reader.highlightNotePrompt'),
    annotateSubmitLabel: t('reader.selection.annotate'),
    scrollElement: scrollRef.current,
    longPressSelectionTimerRef,
    suppressClickAfterLongPressRef,
    rememberFloatingMenuFocus: (element) => { floatingMenuFocusRef.current = element; },
    setSelectionMenu,
    setReaderSearchQuery,
    setReaderSearchScope,
    setTextDialog,
    onAskSelectionAi,
    onTranslateSelection: readerTranslation.open,
    onCreateSelectionCard,
    onGenerateSelectionQuestions,
    onStartReadAloudFromParagraph: startReadAloudFromParagraphLocation,
    onCreateHighlight,
    onDefaultHighlightColorChange,
  });
  const {
    clearSelectionMenu,
    onReaderMouseUp,
    selectWordFromDoubleClick,
    cancelLongPressSelection,
    startLongPressSelection,
    copySelectionText,
    searchSelectionText,
    explainSelectionText,
    translateSelectionText,
    createSelectionCard,
    generateSelectionQuestions,
    startReadAloudFromSelectionParagraph,
    createSelectionHighlight,
    createSelectionAnnotation,
    openSelectionMenuFromSelection,
  } = readerSelectionActions;

  function handleReaderContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (moyuReader) {
      openMoyuContextMenu(event);
      return;
    }
    const selection = window.getSelection();
    if (!selectionMenuEnabled || !selection?.toString().trim() || selection.rangeCount === 0) return;
    event.preventDefault();
    openSelectionMenuFromSelection(selection);
  }
  useEffect(() => {
    const session = readerDailyGoalSessionRef.current;
    const bookId = book?.id ?? '';
    const pageStreamReady = settings.layoutMode !== 'page' || pageStreamLength > 0;
    if (session.bookId === bookId && session.layoutMode === settings.layoutMode && (session.pageStreamReady || !pageStreamReady)) return;
    readerDailyGoalSessionRef.current = { bookId, layoutMode: settings.layoutMode, pageStreamReady, accumulatedMs: 0, activeStartedAt: 0, startChapterIndex: activeChapterIndex, startPageIndex: activeScreenPage, startStreamIndex: activeStreamIndex };
    setReaderDailyGoalElapsedMinutes(0);
  }, [book?.id, settings.layoutMode, pageStreamLength, activeChapterIndex, activeScreenPage, activeStreamIndex]);
  useEffect(() => {
    const session = readerDailyGoalSessionRef.current;
    if (!readerDailyGoalEnabled || !isActive || settings.privacyMode) {
      if (session.activeStartedAt) {
        session.accumulatedMs += Date.now() - session.activeStartedAt;
        session.activeStartedAt = 0;
        setReaderDailyGoalElapsedMinutes(toGoalMinutes(session.accumulatedMs));
      }
      return;
    }
    if (!session.activeStartedAt) session.activeStartedAt = Date.now();
    setReaderDailyGoalElapsedMinutes(toGoalMinutes(session.accumulatedMs + Date.now() - session.activeStartedAt));
    const timer = window.setInterval(() => {
      const currentSession = readerDailyGoalSessionRef.current;
      const activeMs = currentSession.activeStartedAt ? Date.now() - currentSession.activeStartedAt : 0;
      setReaderDailyGoalElapsedMinutes(toGoalMinutes(currentSession.accumulatedMs + activeMs));
    }, 60000);
    return () => {
      window.clearInterval(timer);
      const currentSession = readerDailyGoalSessionRef.current;
      if (currentSession.activeStartedAt) {
        currentSession.accumulatedMs += Date.now() - currentSession.activeStartedAt;
        currentSession.activeStartedAt = 0;
        setReaderDailyGoalElapsedMinutes(toGoalMinutes(currentSession.accumulatedMs));
      }
    };
  }, [readerDailyGoalEnabled, isActive, settings.privacyMode]);
  const progress = resolveReaderProgressPercent(extendedSettings.readerProgressMode, {
    chapters,
    activeChapterIndex,
    activeParagraphIndex,
    activeStreamIndex,
    activeScreenPage,
    pageStreamLength,
    screenPageCount,
    layoutMode: settings.layoutMode,
  });
  const storedProgress = resolveReaderStoredProgressPercent({
    chapters,
    activeChapterIndex,
    activeParagraphIndex,
    activeStreamIndex,
    activeScreenPage,
    pageStreamLength,
    screenPageCount,
    layoutMode: settings.layoutMode,
  });
  const readAloudLocationVisible = useMemo(() => {
    if (!readAloudActive || !readAloudLocation || readAloudLocation.paragraphIndex === null) return true;
    if (settings.layoutMode === 'page') {
      return renderVisiblePageStream.some((streamPage) => {
        const chapter = chapters[streamPage.visibleChapterPosition];
        return chapter?.index === readAloudLocation.sourceChapterIndex
          && streamPage.chunk.entries.some((entry) => entry.paragraphIndex === readAloudLocation.paragraphIndex);
      });
    }
    const scroll = scrollRef.current;
    if (!scroll) return true;
    const selector = `[data-location="${getChapterLocation(readAloudLocation.sourceChapterIndex, readAloudLocation.paragraphIndex)}"]`;
    const target = scroll.querySelector<HTMLElement>(selector);
    if (!target) return false;
    const scrollRect = scroll.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return targetRect.bottom > scrollRect.top && targetRect.top < scrollRect.bottom;
  }, [readAloudActive, readAloudLocation, settings.layoutMode, renderVisiblePageStream, activeChapterIndex, activeParagraphIndex, activeScreenPage, readAloudViewportTick, visibleChapters, chapters]);
  const pageMeterCurrent = settings.layoutMode === 'flow'
    ? activeChapterIndex + 1
    : (settings.layoutMode === 'page' && pageStreamLength ? displayedStreamIndex + 1 : Math.min(activeScreenPage + 1, screenPageCount));
  const pageMeterTotal = settings.layoutMode === 'flow'
    ? Math.max(1, chapters.length)
    : (settings.layoutMode === 'page' && pageStreamLength ? pageStreamLength : screenPageCount);
  const runningPageCount = settings.layoutMode === 'flow'
    ? Math.max(1, chapters.length)
    : (settings.layoutMode === 'page' && pageStreamLength ? pageStreamLength : screenPageCount);
  const pageMeterText = resolvedPageMode === 'double' && settings.layoutMode === 'page' && renderVisiblePageStream.length > 1
    ? `${displayedStreamIndex + 1}-${Math.min(displayedStreamIndex + renderVisiblePageStream.length, pageStreamLength)} / ${pageStreamLength}`
    : t('reader.pageMeter', { current: pageMeterCurrent, total: pageMeterTotal });
  const readerDailyGoalCurrentPageIndex = settings.layoutMode === 'page' && pageStreamLength ? displayedStreamIndex + Math.max(0, renderVisiblePageStream.length - 1) : activeScreenPage;
  const readerDailyGoalStartPageIndex = settings.layoutMode === 'page' && pageStreamLength ? readerDailyGoalSessionRef.current.startStreamIndex : readerDailyGoalSessionRef.current.startPageIndex;
  const readerDailyGoalActualPages = Math.max(0, readerDailyGoalCurrentPageIndex - readerDailyGoalStartPageIndex + 1);
  const readerDailyGoalActualChapters = Math.max(0, activeChapterIndex - readerDailyGoalSessionRef.current.startChapterIndex + 1);
  const readerDailyGoalHasTargets = readerDailyPagesGoal > 0 || readerDailyMinutesGoal > 0 || readerDailyChaptersGoal > 0;
  const readerDailyGoalProgress = createReaderGoalProgress(
    { pagesPerDay: readerDailyPagesGoal, minutesPerDay: readerDailyMinutesGoal, chaptersPerDay: readerDailyChaptersGoal },
    { pages: readerDailyGoalActualPages, minutes: readerDailyGoalElapsedMinutes, chapters: readerDailyGoalActualChapters }
  );
  const readerDailyGoalPercent = Math.round(Math.max(readerDailyGoalProgress.pageRate, readerDailyGoalProgress.minuteRate, readerDailyGoalProgress.chapterRate) * 100);
  const readerDailyGoalSegments = [
    readerDailyPagesGoal ? t('reader.goal.pagesProgress', { current: readerDailyGoalActualPages, target: readerDailyPagesGoal }) : t('reader.goal.pagesDisabled'),
    readerDailyMinutesGoal ? t('reader.goal.minutesProgress', { current: readerDailyGoalElapsedMinutes, target: readerDailyMinutesGoal }) : t('reader.goal.minutesDisabled'),
    readerDailyChaptersGoal ? t('reader.goal.chaptersProgress', { current: readerDailyGoalActualChapters, target: readerDailyChaptersGoal }) : t('reader.goal.chaptersDisabled'),
  ];
  const {
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
    onReaderPageClick,
    startReaderGesturePaging,
    cancelReaderGesturePaging,
    updateReaderGesturePaging,
    finishReaderGesturePaging,
  } = useReaderPaginationController({
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
    selectionMenuOpen: Boolean(selectionMenu),
    highlightMenuOpen: Boolean(highlightMenu),
    textDialogOpen: Boolean(textDialog),
    highlightViewerOpen: Boolean(highlightViewer),
    onSelectChapterPage,
    onSelectScreenPage,
    setPageJumpError,
    formatInvalidPageJump: (total) => t('reader.pageJump.invalid', { total }),
  });
  const {
    moyuContextMenu,
    moyuToolbarTooltip,
    setMoyuContextMenu,
    updateMoyuTooltip,
    clearMoyuTooltip,
    showMoyuTooltipWithDelay,
    blurMoyuToolbarPointerTarget,
    adjustMoyuTextScale,
    adjustMoyuOpacity,
    adjustMoyuAutoScrollSpeed,
    cycleMoyuTextColor,
    onMoyuReaderKeyDown,
    openMoyuContextMenu,
  } = useMoyuToolbarInteractions({
    moyuReader,
    moyuSettings,
    updateMoyuSettings,
    onPreviousPage: goPrevScreenPage,
    onNextPage: goNextScreenPage,
    onExit: onExitMoyuMode,
  });
  useEffect(() => {
    onProgressChange?.(storedProgress, { pageCount: pageMeterTotal, pageCurrent: pageMeterCurrent, chapterTitle: activeChapter?.title ?? '', timestamp: new Date().toISOString() });
  }, [activeChapter?.title, pageMeterCurrent, pageMeterTotal, storedProgress, onProgressChange]);

  useEffect(() => {
    if (!book || !isActive || settings.privacyMode || !extendedSettings.trackReadingTime) return;
    const timer = window.setInterval(() => {
      onProgressChange?.(storedProgress, { pageCount: pageMeterTotal, pageCurrent: pageMeterCurrent, chapterTitle: activeChapter?.title ?? '', timestamp: new Date().toISOString(), minutesRead: 1 });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [activeChapter?.title, book?.id, extendedSettings.trackReadingTime, isActive, onProgressChange, pageMeterCurrent, pageMeterTotal, storedProgress, settings.privacyMode]);

  useEffect(() => {
    if (!moyuReader || !moyuSettings.autoScrollEnabled) {
      if (moyuAutoScrollFrameRef.current !== null) window.cancelAnimationFrame(moyuAutoScrollFrameRef.current);
      moyuAutoScrollFrameRef.current = null;
      moyuAutoScrollLastTimeRef.current = 0;
      return;
    }
    function tick(timestamp: number) {
      if (!moyuAutoScrollLastTimeRef.current) moyuAutoScrollLastTimeRef.current = timestamp;
      const elapsedSeconds = Math.min(0.08, (timestamp - moyuAutoScrollLastTimeRef.current) / 1000);
      const elapsedMs = timestamp - moyuAutoScrollLastTimeRef.current;
      moyuAutoScrollLastTimeRef.current = timestamp;
      const scroll = scrollRef.current;
      if (scroll && settings.layoutMode === 'flow') {
        scroll.scrollTop += moyuSettings.autoScrollSpeed * elapsedSeconds;
      } else if (settings.layoutMode === 'page') {
        const pageIntervalMs = Math.max(1800, 90000 / moyuSettings.autoScrollSpeed);
        const accumulatedMs = Number(scroll?.dataset.moyuLastAutoPageTurn || 0) + elapsedMs;
        if (scroll) scroll.dataset.moyuLastAutoPageTurn = String(accumulatedMs);
        if (accumulatedMs >= pageIntervalMs) {
          if (scroll) scroll.dataset.moyuLastAutoPageTurn = '0';
          goNextScreenPage();
        }
      }
      moyuAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
    }
    moyuAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (moyuAutoScrollFrameRef.current !== null) window.cancelAnimationFrame(moyuAutoScrollFrameRef.current);
      moyuAutoScrollFrameRef.current = null;
      moyuAutoScrollLastTimeRef.current = 0;
    };
  }, [moyuReader, moyuSettings.autoScrollEnabled, moyuSettings.autoScrollSpeed, settings.layoutMode, goNextScreenPage]);

  useEffect(() => {
    if (!isActive) {
      previousLayoutModeRef.current = settings.layoutMode;
      return;
    }
    if (previousLayoutModeRef.current !== 'page' || settings.layoutMode !== 'flow') {
      previousLayoutModeRef.current = settings.layoutMode;
      return;
    }
    suppressFlowLocationObserverUntilRef.current = Date.now() + 700;
    if (flowAnchorRestoreFrameRef.current !== null) window.cancelAnimationFrame(flowAnchorRestoreFrameRef.current);
    flowAnchorRestoreFrameRef.current = window.requestAnimationFrame(() => {
      flowAnchorRestoreFrameRef.current = null;
      restoreFlowAnchorAfterLayoutSwitch();
    });
    previousLayoutModeRef.current = settings.layoutMode;
    return () => {
      if (flowAnchorRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(flowAnchorRestoreFrameRef.current);
        flowAnchorRestoreFrameRef.current = null;
      }
    };
  }, [settings.layoutMode, activeChapterIndex, activeParagraphIndex, activeChapter?.index, isActive]);

  useEffect(() => {
    if (settings.layoutMode !== 'flow') return;
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (Date.now() < suppressFlowLocationObserverUntilRef.current) return;
      const visible = entries.find((entry) => entry.isIntersecting)?.target as HTMLElement | undefined;
      const location = visible?.dataset.location;
      if (!location) return;
      const [chapterValue, paragraphValue] = location.split(':').map(Number);
      if (!Number.isFinite(chapterValue) || !Number.isFinite(paragraphValue)) return;
      if (chapterValue === activeChapterIndex && paragraphValue === activeParagraphIndex) return;
      captureFlowScrollAnchorFromElement(visible);
      onSelectChapter(chapterValue, paragraphValue);
      scheduleRestoreFlowScrollAnchor();
    }, { root, threshold: 0.55 });
    root.querySelectorAll<HTMLElement>('.source-paragraph[data-location]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [settings.layoutMode, visibleChapters, activeChapterIndex, activeParagraphIndex, onSelectChapter]);

  useLayoutEffect(() => {
    if (settings.layoutMode !== 'flow') return;
    restorePendingFlowScrollAnchor();
    scrollToPendingEpubNote();
  }, [settings.layoutMode, visibleChapters, activeChapterIndex, activeParagraphIndex]);

  useLayoutEffect(() => {
    pendingBookRestoreIdRef.current = book?.id ?? '';
    lastBookRestoreKeyRef.current = '';
    pendingEpubNoteJumpRef.current = null;
    if (pendingEpubNoteJumpFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingEpubNoteJumpFrameRef.current);
      pendingEpubNoteJumpFrameRef.current = null;
    }
  }, [book?.id]);

  useLayoutEffect(() => {
    if (!book || settings.layoutMode !== 'flow' || pendingBookRestoreIdRef.current !== book.id) return;
    const restoreKey = `${book.id}:${activeChapterIndex}:${activeParagraphIndex}:${visibleChapters.map((chapter) => chapter.id).join('|')}`;
    if (lastBookRestoreKeyRef.current === restoreKey) return;
    lastBookRestoreKeyRef.current = restoreKey;
    if (restoreFlowAnchorAfterBookSwitch()) pendingBookRestoreIdRef.current = '';
  }, [book?.id, settings.layoutMode, visibleChapters, activeChapterIndex, activeParagraphIndex]);

  function goBookStart() {
    onSelectChapterPage(0, 'first', 0);
  }

  function goBookEnd() {
    onSelectChapterPage(Math.max(0, chapters.length - 1), 'last');
  }

  function restoreFloatingMenuFocus() {
    const target = floatingMenuFocusRef.current;
    floatingMenuFocusRef.current = null;
    if (target && document.contains(target)) target.focus();
  }

  function handleFlowVirtualBoundaryScroll() {
    const scroll = scrollRef.current;
    if (!scroll || settings.layoutMode !== 'flow') return;
    const scrollDelta = scroll.scrollTop - flowVirtualBoundaryLastScrollTopRef.current;
    flowVirtualBoundaryLastScrollTopRef.current = scroll.scrollTop;
    if (Date.now() < flowVirtualBoundaryLockRef.current) return;
    const boundaryThreshold = Math.max(96, scroll.clientHeight * 0.18);
    const nearBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - boundaryThreshold;
    const nearTop = scroll.scrollTop <= boundaryThreshold;
    if (scrollDelta > 1 && nearBottom && virtualRange.after > 0) {
      const nextChapterIndex = Math.min(activeChapterIndex + 1, Math.max(0, chapters.length - 1));
      const anchorLocation = captureFlowScrollAnchorAtViewport({ preferChapterIndex: nextChapterIndex, requirePreferred: true });
      if (!anchorLocation) return;
      const [anchorChapterValue, anchorParagraphValue] = anchorLocation.split(':').map(Number);
      flowVirtualBoundaryLockRef.current = Date.now() + 900;
      suppressFlowLocationObserverUntilRef.current = Date.now() + 900;
      flowVirtualBoundaryLastScrollTopRef.current = 0;
      scheduleRestoreFlowScrollAnchor();
      onSelectChapterPage(nextChapterIndex, 'first', Number.isFinite(anchorParagraphValue) && anchorChapterValue === nextChapterIndex ? anchorParagraphValue : undefined);
      return;
    }
    if (scrollDelta < -1 && nearTop && virtualRange.before > 0) {
      captureFlowScrollAnchorAtViewport();
      flowVirtualBoundaryLockRef.current = Date.now() + 900;
      suppressFlowLocationObserverUntilRef.current = Date.now() + 900;
      flowVirtualBoundaryLastScrollTopRef.current = 0;
      scheduleRestoreFlowScrollAnchor();
      onSelectChapterPage(Math.max(0, activeChapterIndex - 1), 'first');
    }
  }

  function onReaderScroll() {
    scheduleRecalculatePages();
    handleFlowVirtualBoundaryScroll();
    if (readAloudActive && readAloudLocation?.paragraphIndex !== null) setReadAloudViewportTick((tick) => tick + 1);
  }

  function closeFloatingMenus(restoreFocus = false) {
    setTocMenu(null);
    setSelectionMenu(null);
    setHighlightMenu(null);
    setHighlightViewer(null);
    if (restoreFocus) window.requestAnimationFrame(restoreFloatingMenuFocus);
  }

  function createHighlightFromCurrentSelection(color?: ReaderHighlightColor) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) return false;
    const selectedRanges = getSelectionParagraphRanges(selection, selection.getRangeAt(0));
    if (!selectedRanges.length) return false;
    const resolvedColor = resolveReaderHighlightColor(color, defaultHighlightColor);
    buildReaderSelectionRanges(selectedRanges, 'highlight', '', resolvedColor).forEach(onCreateHighlight);
    onDefaultHighlightColorChange(resolvedColor);
    selection.removeAllRanges();
    setSelectionMenu(null);
    return true;
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Escape' && extendedSettings.escapeClosesPanels) {
        closeFloatingMenus(true);
        setTextDialog(null);
        setBookmarkViewer(null);
        setSearchPanelOpen(false);
        setShowHighlightPanel(false);
        return;
      }
      const readerFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      if (readerFindShortcut) {
        event.preventDefault();
        const nextOpen = !searchPanelOpen;
        setSearchPanelOpen(nextOpen);
        if (nextOpen) window.requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }
      if (isReaderShortcutEditableTarget(target)) return;
      if (matchesReaderShortcut(event, extendedSettings.readerShortcuts.search)) {
        event.preventDefault();
        const nextOpen = !searchPanelOpen;
        setSearchPanelOpen(nextOpen);
        if (nextOpen) window.requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }
      if (matchesReaderShortcut(event, extendedSettings.readerShortcuts.bookmark)) {
        event.preventDefault();
        onCreateBookmark();
        setActiveAnnotationTab('bookmarks');
        setShowHighlightPanel(true);
        return;
      }
      const shortcutColor = getReaderHighlightColorShortcutMatch(event, extendedSettings.highlightColorShortcuts);
      if (shortcutColor) {
        if (createHighlightFromCurrentSelection(shortcutColor)) event.preventDefault();
        return;
      }
      if (matchesReaderShortcut(event, extendedSettings.readerShortcuts.highlight)) {
        if (createHighlightFromCurrentSelection()) event.preventDefault();
        return;
      }
      if ((extendedSettings.arrowKeyPaging && (event.key === 'ArrowRight' || event.key === 'PageDown')) || (extendedSettings.spaceKeyPaging && event.key === ' ') || (extendedSettings.vimStyleNavigation && event.key.toLowerCase() === 'j')) {
        event.preventDefault();
        goNextScreenPage();
      }
      if ((extendedSettings.arrowKeyPaging && (event.key === 'ArrowLeft' || event.key === 'PageUp')) || (extendedSettings.vimStyleNavigation && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        goPrevScreenPage();
      }
      if (extendedSettings.homeEndJump && event.key === 'Home') {
        event.preventDefault();
        goBookStart();
      }
      if (extendedSettings.homeEndJump && event.key === 'End') {
        event.preventDefault();
        goBookEnd();
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleFocusMode();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeScreenPage, screenPageCount, activeChapterIndex, chapters.length, onSelectChapterPage, extendedSettings.arrowKeyPaging, extendedSettings.spaceKeyPaging, extendedSettings.escapeClosesPanels, extendedSettings.homeEndJump, extendedSettings.vimStyleNavigation, extendedSettings.readerShortcuts, extendedSettings.highlightColorShortcuts, defaultHighlightColor, onCreateBookmark, onCreateHighlight, onDefaultHighlightColorChange, searchPanelOpen]);

  useEffect(() => {
    if (!extendedSettings.readerFpsDiagnosticsEnabled || !isActive) {
      setReaderFpsDiagnostics(null);
      if (fpsDiagnosticsFrameRef.current !== null) {
        window.cancelAnimationFrame(fpsDiagnosticsFrameRef.current);
        fpsDiagnosticsFrameRef.current = null;
      }
      return;
    }
    let lastTimestamp = 0;
    let frameCount = 0;
    let lowFrameCount = 0;
    let windowStartedAt = 0;
    function sampleReaderFpsDiagnostics(timestamp: number) {
      if (!windowStartedAt) windowStartedAt = timestamp;
      const frameDelta = lastTimestamp ? timestamp - lastTimestamp : 0;
      lastTimestamp = timestamp;
      frameCount += 1;
      if (frameDelta > 34) lowFrameCount += 1;
      const elapsed = timestamp - windowStartedAt;
      if (elapsed >= 500) {
        setReaderFpsDiagnostics({
          fps: Math.round((frameCount * 1000) / elapsed),
          lowFrameCount,
          lastFrameMs: Math.round(frameDelta),
        });
        frameCount = 0;
        lowFrameCount = 0;
        windowStartedAt = timestamp;
      }
      fpsDiagnosticsFrameRef.current = window.requestAnimationFrame(sampleReaderFpsDiagnostics);
    }
    fpsDiagnosticsFrameRef.current = window.requestAnimationFrame(sampleReaderFpsDiagnostics);
    return () => {
      if (fpsDiagnosticsFrameRef.current !== null) {
        window.cancelAnimationFrame(fpsDiagnosticsFrameRef.current);
        fpsDiagnosticsFrameRef.current = null;
      }
    };
  }, [extendedSettings.readerFpsDiagnosticsEnabled, isActive]);

  useEffect(() => {
    if (!extendedSettings.readerMemoryWarningEnabled || !isActive) {
      setReaderMemoryDiagnostics(null);
      return;
    }
    const thresholdMb = Number(extendedSettings.readerMemoryWarningThresholdMb);
    const sampleReaderMemoryDiagnostics = () => {
      setReaderMemoryDiagnostics(buildReaderMemoryDiagnostics(getBrowserMemorySnapshot(), thresholdMb));
    };
    sampleReaderMemoryDiagnostics();
    const timer = window.setInterval(sampleReaderMemoryDiagnostics, 5000);
    return () => window.clearInterval(timer);
  }, [extendedSettings.readerMemoryWarningEnabled, extendedSettings.readerMemoryWarningThresholdMb, isActive]);

  useEffect(() => {
    if (highlightViewer && highlightViewer.highlight.id && !highlights.some((highlight) => highlight.id === highlightViewer.highlight.id)) setHighlightViewer(null);
  }, [highlights, highlightViewer]);

  useEffect(() => {
    function refreshExtendedSettings(detail?: SettingsUpdatedDetail) {
      const next = detail?.extended;
      const loaded = next ?? loadExtendedSettings();
      setExtendedSettings(loaded);
      syncAnnotationPanelSettings(loaded);
    }
    return subscribeSettingsUpdated(refreshExtendedSettings);
  }, [syncAnnotationPanelSettings]);

  useEffect(() => {
    return () => {
      stopContinuousPageTurn();
      cancelReaderReadAloudEngine();
      if (readerJumpNoticeTimerRef.current !== null) window.clearTimeout(readerJumpNoticeTimerRef.current);
      if (readerJumpHighlightTimerRef.current !== null) window.clearTimeout(readerJumpHighlightTimerRef.current);
      if (flowWidthAnchorRestoreFrameRef.current !== null) window.cancelAnimationFrame(flowWidthAnchorRestoreFrameRef.current);
    };
  }, []);

  useEffect(() => {
    function onFlashLocation(detail: ReaderFlashLocationDetail) {
      if (detail?.message) {
        showReaderJumpNotice(detail.message);
        return;
      }
      if (!detail || typeof detail.sourceChapterIndex !== 'number' || typeof detail.paragraphIndex !== 'number') return;
      if (ensureReaderFlashLocationPage(detail)) {
        pendingReaderFlashLocationRef.current = detail;
        return;
      }
      flashReaderLocation(detail);
    }
    return subscribeReaderFlashLocation(onFlashLocation);
  }, [activeChapterIndex, activePageChunks, activeScreenPage, settings.layoutMode, t]);

  useEffect(() => {
    const detail = pendingReaderFlashLocationRef.current;
    if (!detail) return;
    if (typeof detail.sourceChapterIndex !== 'number' || typeof detail.paragraphIndex !== 'number') return;
    if (ensureReaderFlashLocationPage(detail)) return;
    pendingReaderFlashLocationRef.current = null;
    window.setTimeout(() => flashReaderLocation(detail), 60);
  }, [activeChapterIndex, activePageChunks, activeScreenPage, settings.layoutMode]);

  function ensureReaderFlashLocationPage(detail: ReaderFlashLocationDetail) {
    if (settings.layoutMode !== 'page') return false;
    if (typeof detail.sourceChapterIndex !== 'number' || typeof detail.paragraphIndex !== 'number') return false;
    const targetChapterIndex = chapters.findIndex((chapter) => chapter.index === detail.sourceChapterIndex);
    if (targetChapterIndex < 0) return false;
    const targetOffset = detail.startOffset ?? 0;
    const targetPage = targetChapterIndex === activeChapterIndex
      ? findPageForLocation(detail.paragraphIndex, targetOffset)
      : 0;
    if (targetChapterIndex === activeChapterIndex && targetPage === activeScreenPage) return false;
    onSelectChapterPage(targetChapterIndex, targetPage, detail.paragraphIndex);
    return true;
  }

  function flashReaderLocation(detail: ReaderFlashLocationDetail) {
      if (typeof detail.sourceChapterIndex !== 'number' || typeof detail.paragraphIndex !== 'number') return;
      const sourceChapterIndex = detail.sourceChapterIndex;
      const paragraphIndex = detail.paragraphIndex;
      const selector = `[data-location="${getChapterLocation(sourceChapterIndex, paragraphIndex)}"]`;
      const target = scrollRef.current?.querySelector<HTMLElement>(selector);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      const paragraphText = target.textContent ?? '';
      const pageStartOffset = Number(target.dataset.pageStartOffset ?? 0);
      const absoluteStartOffset = detail.startOffset ?? pageStartOffset;
      const absoluteEndOffset = detail.endOffset ?? absoluteStartOffset + 1;
      const localStartOffset = absoluteStartOffset - (Number.isFinite(pageStartOffset) ? pageStartOffset : 0);
      const localEndOffset = absoluteEndOffset - (Number.isFinite(pageStartOffset) ? pageStartOffset : 0);
      const startOffset = Math.max(0, Math.min(localStartOffset, paragraphText.length));
      const endOffset = Math.max(startOffset + 1, Math.min(localEndOffset, paragraphText.length));
      setReaderJumpHighlight({
        id: `reader-jump-${sourceChapterIndex}-${paragraphIndex}-${startOffset}-${Date.now()}`,
        chapterIndex: sourceChapterIndex,
        sourceChapterIndex,
        paragraphIndex,
        startOffset: absoluteStartOffset,
        endOffset: absoluteEndOffset,
        text: paragraphText.slice(startOffset, endOffset),
        note: t('reader.aiCitationJumpNote'),
        color: 'blue',
        createdAt: new Date().toISOString(),
      });
      if (readerJumpHighlightTimerRef.current !== null) window.clearTimeout(readerJumpHighlightTimerRef.current);
      readerJumpHighlightTimerRef.current = window.setTimeout(() => {
        setReaderJumpHighlight(null);
        readerJumpHighlightTimerRef.current = null;
      }, 2400);
      target.classList.remove('flash');
      void target.clientWidth;
      target.classList.add('flash');
      if (readerJumpNoticeTimerRef.current !== null) window.clearTimeout(readerJumpNoticeTimerRef.current);
      showReaderJumpNotice(t('reader.locationOpened'));
  }

  function showReaderJumpNotice(message: string) {
    if (readerJumpNoticeTimerRef.current !== null) window.clearTimeout(readerJumpNoticeTimerRef.current);
    setReaderJumpNotice(message);
    readerJumpNoticeTimerRef.current = window.setTimeout(() => {
      setReaderJumpNotice('');
      readerJumpNoticeTimerRef.current = null;
    }, 2600);
  }

  useEffect(() => {
    function onWindowClick() {
      closeFloatingMenus(false);
    }
    window.addEventListener('click', onWindowClick);
    return () => {
      window.removeEventListener('click', onWindowClick);
    };
  }, []);

  useEffect(() => () => {
    cancelLongPressMenu();
    cancelLongPressSelection();
  }, []);

  function cancelLongPressMenu() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function startLongPressMenu(event: React.PointerEvent<HTMLElement>, openMenu: (clientX: number, clientY: number, target: HTMLElement) => void) {
    if (!contextMenuEnabled) return;
    if (event.pointerType === 'mouse') return;
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    cancelLongPressMenu();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      suppressClickAfterLongPressRef.current = true;
      openMenu(clientX, clientY, target);
      window.setTimeout(() => { suppressClickAfterLongPressRef.current = false; }, 360);
    }, 520);
  }

  function suppressClickAfterLongPress(event: React.MouseEvent<HTMLElement>) {
    if (!suppressClickAfterLongPressRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function openHighlightMenuAt(clientX: number, clientY: number, opener: HTMLElement, highlight: ReaderHighlightRange) {
    if (!highlight.id) return;
    // Annotation-panel rows need their menu constrained to the panel, not the reading canvas.
    const containerRect = opener.closest<HTMLElement>('.reader-highlight-panel')?.getBoundingClientRect()
      ?? scrollRef.current?.getBoundingClientRect();
    const position = resolveReaderHighlightMenuPosition(clientX, clientY, containerRect ? {
      left: containerRect.left,
      top: containerRect.top,
      right: containerRect.right,
      bottom: containerRect.bottom,
    } : undefined);
    setSelectionMenu(null);
    setHighlightViewer(null);
    floatingMenuFocusRef.current = opener;
    setHighlightMenu({
      x: position.x,
      y: position.y,
      highlight,
    });
  }

  function openHighlightMenu(event: React.MouseEvent<HTMLElement>, highlight: ReaderHighlightRange) {
    event.preventDefault();
    event.stopPropagation();
    if (!contextMenuEnabled) return;
    openHighlightMenuAt(event.clientX, event.clientY, event.currentTarget, highlight);
  }

  function openHighlightMenuFromButton(event: React.MouseEvent<HTMLElement>, highlight: ReaderHighlightRange) {
    if (!highlight.id) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openHighlightMenuAt(rect.right, rect.bottom, event.currentTarget, highlight);
  }

  function openHighlightMenuFromKeyboard(event: React.KeyboardEvent<HTMLElement>, highlight: ReaderHighlightRange) {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      event.stopPropagation();
      if (!contextMenuEnabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      openHighlightMenuAt(rect.left + rect.width / 2, rect.bottom, event.currentTarget, highlight);
    }
  }

  function findPageForLocation(paragraphIndex: number, offset = 0) {
    const pageIndex = activePageChunks.findIndex((chunk) => chunk.entries.some((entry) =>
      entry.paragraphIndex === paragraphIndex && entry.startOffset <= offset && entry.endOffset >= offset,
    ));
    return pageIndex >= 0 ? pageIndex : 0;
  }

  function jumpToParagraph(chapterIndex: number, paragraphIndex: number, offset = 0) {
    if (settings.layoutMode === 'page' && chapterIndex === activeChapterIndex) {
      onSelectChapterPage(chapterIndex, findPageForLocation(paragraphIndex, offset), paragraphIndex);
      return;
    }
    onSelectChapter(chapterIndex, paragraphIndex);
  }

  function jumpToEpubNote(noteId: string) {
    const target = getEpubNoteScrollTarget(noteId);
    if (target) {
      suppressFlowLocationObserverUntilRef.current = Date.now() + 700;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const marker = `[[BOOKMIND_EPUB_NOTE_TARGET:${noteId}]]`;
    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const paragraphIndex = chapters[chapterIndex].paragraphs.findIndex((paragraph) => paragraph.includes(marker));
      if (paragraphIndex >= 0) {
        pendingEpubNoteJumpRef.current = { noteId, chapterIndex, paragraphIndex };
        suppressFlowLocationObserverUntilRef.current = Date.now() + 900;
        jumpToParagraph(chapterIndex, paragraphIndex);
        scrollToPendingEpubNote();
        return;
      }
    }
  }

  function getEpubNoteScrollTarget(noteId: string) {
    const marker = document.getElementById(getReaderEpubNoteTargetDomId(noteId));
    return marker?.closest<HTMLElement>('.reader-epub-note-block, .source-paragraph') ?? marker;
  }

  function scrollToPendingEpubNote(attempt = 0) {
    const pending = pendingEpubNoteJumpRef.current;
    if (!pending) return;
    const target = getEpubNoteScrollTarget(pending.noteId);
    if (target) {
      suppressFlowLocationObserverUntilRef.current = Date.now() + 900;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingEpubNoteJumpRef.current = null;
      if (pendingEpubNoteJumpFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingEpubNoteJumpFrameRef.current);
        pendingEpubNoteJumpFrameRef.current = null;
      }
      return;
    }
    if (attempt >= 8) {
      pendingEpubNoteJumpRef.current = null;
      return;
    }
    if (settings.layoutMode === 'flow' && pending.chapterIndex !== activeChapterIndex) {
      suppressFlowLocationObserverUntilRef.current = Date.now() + 900;
      onSelectChapter(pending.chapterIndex, pending.paragraphIndex);
    }
    if (pendingEpubNoteJumpFrameRef.current !== null) window.cancelAnimationFrame(pendingEpubNoteJumpFrameRef.current);
    pendingEpubNoteJumpFrameRef.current = window.requestAnimationFrame(() => {
      pendingEpubNoteJumpFrameRef.current = null;
      scrollToPendingEpubNote(attempt + 1);
    });
  }

  function returnToReadAloudLocation() {
    if (!readAloudLocation || readAloudLocation.paragraphIndex === null) return;
    const chapterIndex = chapters.findIndex((chapter) => chapter.index === readAloudLocation.sourceChapterIndex);
    if (chapterIndex < 0) return;
    jumpToParagraph(chapterIndex, readAloudLocation.paragraphIndex);
  }

  function startReadAloudFromCurrentPage() {
    const pageStartParagraph = settings.layoutMode === 'page'
      ? renderVisiblePageStream[0]?.chunk.entries[0]?.paragraphIndex ?? activePageChunk?.entries[0]?.paragraphIndex ?? activeParagraphIndex
      : activeParagraphIndex;
    startReaderReadAloud(pageStartParagraph);
  }

  function startReadAloudFromParagraphLocation(location: string) {
    const [, paragraphValue] = location.split(':').map((value) => Number(value));
    startReaderReadAloud(Number.isFinite(paragraphValue) ? Math.max(0, Math.floor(paragraphValue)) : activeParagraphIndex);
  }

  function restoreFlowAnchorAfterLayoutSwitch(attempt = 0) {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const sourceChapterIndex = activeChapter?.index ?? activeChapterIndex;
    const paragraphTarget = scroll.querySelector<HTMLElement>(`[data-location="${getChapterLocation(sourceChapterIndex, activeParagraphIndex)}"]`);
    const chapterTarget = activeChapter ? scroll.querySelector<HTMLElement>(`[data-chapter-index="${activeChapter.index}"]`) : null;
    const target = paragraphTarget ?? chapterTarget;
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    if (attempt >= 2) return;
    flowAnchorRestoreFrameRef.current = window.requestAnimationFrame(() => {
      flowAnchorRestoreFrameRef.current = null;
      restoreFlowAnchorAfterLayoutSwitch(attempt + 1);
    });
  }

  function restoreFlowAnchorAfterBookSwitch(attempt = 0): boolean {
    const scroll = scrollRef.current;
    if (!scroll || settings.layoutMode !== 'flow') return false;
    const sourceChapterIndex = activeChapter?.index ?? activeChapterIndex;
    const paragraphTarget = scroll.querySelector<HTMLElement>(`[data-location="${getChapterLocation(sourceChapterIndex, activeParagraphIndex)}"]`);
    if (paragraphTarget) {
      suppressFlowLocationObserverUntilRef.current = Date.now() + 700;
      paragraphTarget.scrollIntoView({ block: 'start', behavior: 'auto' });
      flowVirtualBoundaryLastScrollTopRef.current = scroll.scrollTop;
      return true;
    }
    if (attempt >= 4) return false;
    if (flowAnchorRestoreFrameRef.current !== null) window.cancelAnimationFrame(flowAnchorRestoreFrameRef.current);
    flowAnchorRestoreFrameRef.current = window.requestAnimationFrame(() => {
      flowAnchorRestoreFrameRef.current = null;
      if (restoreFlowAnchorAfterBookSwitch(attempt + 1)) pendingBookRestoreIdRef.current = '';
    });
    return false;
  }

  function captureFlowWidthAnchor() {
    if (settings.layoutMode !== 'flow') return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const scrollRect = scroll.getBoundingClientRect();
    const paragraph = Array.from(scroll.querySelectorAll<HTMLElement>('.source-paragraph[data-location]'))
      .find((element) => element.getBoundingClientRect().bottom >= scrollRect.top + 8);
    const location = paragraph?.dataset.location;
    if (!paragraph || !location) return;
    flowWidthAnchorRef.current = {
      location,
      offsetTop: paragraph.getBoundingClientRect().top - scrollRect.top,
    };
    suppressFlowLocationObserverUntilRef.current = Date.now() + 700;
  }

  function captureFlowScrollAnchorFromElement(element: HTMLElement) {
    if (settings.layoutMode !== 'flow') return;
    const scroll = scrollRef.current;
    const location = element.dataset.location;
    if (!scroll || !location) return;
    const scrollRect = scroll.getBoundingClientRect();
    flowWidthAnchorRef.current = {
      location,
      offsetTop: element.getBoundingClientRect().top - scrollRect.top,
    };
    flowScrollAnchorRestorePendingRef.current = true;
    suppressFlowLocationObserverUntilRef.current = Date.now() + 700;
  }

  function captureFlowScrollAnchorAtViewport(options: { preferChapterIndex?: number; requirePreferred?: boolean } = {}) {
    if (settings.layoutMode !== 'flow') return null;
    const scroll = scrollRef.current;
    if (!scroll) return null;
    const scrollRect = scroll.getBoundingClientRect();
    const visibleParagraphs = Array.from(scroll.querySelectorAll<HTMLElement>('.source-paragraph[data-location]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom >= scrollRect.top + 8 && rect.top <= scrollRect.bottom - 8;
      });
    const preferredParagraph = options.preferChapterIndex === undefined
      ? undefined
      : visibleParagraphs.find((element) => Number(element.dataset.location?.split(':')[0]) === options.preferChapterIndex);
    const paragraph = preferredParagraph ?? (options.requirePreferred ? null : visibleParagraphs[0]);
    if (!paragraph) return null;
    captureFlowScrollAnchorFromElement(paragraph);
    return paragraph.dataset.location ?? null;
  }

  function scheduleRestoreFlowScrollAnchor() {
    if (settings.layoutMode !== 'flow') return;
    flowScrollAnchorRestorePendingRef.current = true;
  }

  function restorePendingFlowScrollAnchor(attempt = 0) {
    if (settings.layoutMode !== 'flow' || !flowScrollAnchorRestorePendingRef.current) return;
    const anchor = flowWidthAnchorRef.current;
    const scroll = scrollRef.current;
    if (!anchor || !scroll) {
      flowScrollAnchorRestorePendingRef.current = false;
      return;
    }
    const target = scroll.querySelector<HTMLElement>(`[data-location="${anchor.location}"]`);
    if (target) {
      const scrollRect = scroll.getBoundingClientRect();
      const nextTop = scroll.scrollTop + target.getBoundingClientRect().top - scrollRect.top - anchor.offsetTop;
      scroll.scrollTo({ top: Math.max(0, nextTop), behavior: 'auto' });
      flowVirtualBoundaryLastScrollTopRef.current = scroll.scrollTop;
      flowScrollAnchorRestorePendingRef.current = false;
      return;
    }
    if (attempt >= 4) {
      flowScrollAnchorRestorePendingRef.current = false;
      return;
    }
    if (flowScrollAnchorRestoreFrameRef.current !== null) window.cancelAnimationFrame(flowScrollAnchorRestoreFrameRef.current);
    flowScrollAnchorRestoreFrameRef.current = window.requestAnimationFrame(() => {
      flowScrollAnchorRestoreFrameRef.current = null;
      restorePendingFlowScrollAnchor(attempt + 1);
    });
  }

  function restoreFlowWidthAnchorAfterResize(attempt = 0) {
    if (settings.layoutMode !== 'flow') return;
    const anchor = flowWidthAnchorRef.current;
    const scroll = scrollRef.current;
    if (!anchor || !scroll) return;
    const target = scroll.querySelector<HTMLElement>(`[data-location="${anchor.location}"]`);
    if (target) {
      const scrollRect = scroll.getBoundingClientRect();
      const nextTop = scroll.scrollTop + target.getBoundingClientRect().top - scrollRect.top - anchor.offsetTop;
      scroll.scrollTo({ top: Math.max(0, nextTop), behavior: 'auto' });
      return;
    }
    if (attempt >= 2) return;
    flowWidthAnchorRestoreFrameRef.current = window.requestAnimationFrame(() => {
      flowWidthAnchorRestoreFrameRef.current = null;
      restoreFlowWidthAnchorAfterResize(attempt + 1);
    });
  }

  function toggleFocusMode() {
    const activeElement = document.activeElement;
    if (!focusMode && activeElement instanceof HTMLElement) activeElement.blur();
    setFocusMode((value) => !value);
  }

  const readerStyle = useMemo(() => {
    const readerImagePageMaxHeight = Math.max(
      120,
      Math.floor(
        (availableReaderHeight || window.innerHeight - 190)
        - effectiveBodyMarginY * 2
        - (visualSettings.headerVisible ? visualSettings.headerFooterFontSize + visualSettings.headerMarginY * 2 : 0)
        - (visualSettings.footerVisible ? visualSettings.headerFooterFontSize + visualSettings.footerMarginY * 2 : 0)
        - readerChapterTitleBlockMaxHeight
        - Math.max(24, visualSettings.paragraphSpacing)
      ),
    );
    return {
    '--reader-font-size': `${visualSettings.fontSize}px`,
    '--reader-letter-spacing': `${visualSettings.letterSpacing}px`,
    '--reader-line-height': visualSettings.lineHeight,
    '--reader-paragraph-spacing': `${visualSettings.paragraphSpacing}px`,
    '--reader-paper-texture-strength': visualSettings.paperTextureStrength,
    '--reader-eye-comfort-background-strength': visualSettings.eyeComfortBackgroundStrength,
    '--reader-paper-background-strength': visualSettings.paperBackgroundStrength,
    '--reader-eye-comfort-background-mix': `${Math.round(visualSettings.eyeComfortBackgroundStrength * 100)}%`,
    '--reader-paper-background-mix': `${Math.round(visualSettings.paperBackgroundStrength * 100)}%`,
    '--reader-custom-background-color': visualSettings.customBackgroundColor,
    '--reader-custom-text-color': visualSettings.customTextColor,
    '--reader-custom-selection-color': visualSettings.customSelectionColor,
    '--reader-font-family': visualSettings.fontFamily,
    '--reader-indent': `${visualSettings.firstLineIndent}em`,
    '--reader-page-width': `${effectivePageWidth}px`,
    '--reader-page-gap': `${visualSettings.pageGap}px`,
    '--reader-body-margin-x': `${effectiveBodyMarginX}px`,
    '--reader-body-margin-y': `${effectiveBodyMarginY}px`,
    '--reader-header-margin-x': `${visualSettings.headerMarginX}px`,
    '--reader-header-margin-y': `${visualSettings.headerMarginY}px`,
    '--reader-footer-margin-x': `${visualSettings.footerMarginX}px`,
    '--reader-footer-margin-y': `${visualSettings.footerMarginY}px`,
    '--reader-header-footer-font-size': `${visualSettings.headerFooterFontSize}px`,
    '--reader-header-footer-opacity': visualSettings.headerFooterOpacity,
    '--reader-title-size': `${visualSettings.titleFontSize}px`,
    '--reader-title-margin-top': `${visualSettings.titleMarginTop}px`,
    '--reader-title-margin-bottom': `${visualSettings.titleMarginBottom}px`,
    '--reader-title-block-max-height': `${readerChapterTitleBlockMaxHeight}px`,
    '--reader-image-page-max-height': `${readerImagePageMaxHeight}px`,
    '--reader-toc-width': `${tocWidth}px`,
    '--moyu-background-opacity': moyuSettings.backgroundOpacity,
    '--moyu-text-opacity': moyuSettings.textOpacity,
    '--moyu-text-scale': moyuSettings.textScale,
    '--moyu-font-family': moyuSettings.fontFamily,
    '--moyu-text-color': moyuSettings.textColor || 'currentColor',
  } as CSSProperties;
  }, [visualSettings, availableReaderHeight, effectivePageWidth, effectiveBodyMarginX, effectiveBodyMarginY, readerChapterTitleBlockMaxHeight, tocWidth, moyuSettings.backgroundOpacity, moyuSettings.textOpacity, moyuSettings.textScale, moyuSettings.fontFamily, moyuSettings.textColor]);

  if (!book) {
    return (
      <ReaderEmptyState
        recentBook={recentBook}
        onOpenRecentBook={onOpenRecentBook}
        onChooseBookFile={onChooseBookFile}
        onOpenAiDemo={onOpenAiDemo}
        onOpenLibrary={onOpenLibrary}
        onOpenTasks={onOpenTasks}
      />
    );
  }

  return (
    <article className={`reader-canvas theme-${visualSettings.theme}${focusMode ? ' focus-mode' : ''}${searchPanelOpen ? ' search-open' : ''}${cursorHidden ? ' reader-cursor-hidden' : ''}${moyuReader ? ` moyu-reader-canvas moyu-toolbar-reveal-${moyuSettings.toolbarRevealMode}${moyuToolbarVisibility.toolbarVisible ? ' moyu-toolbars-visible' : ''}${moyuSettings.interactionLocked ? ' moyu-interaction-locked' : ''}${moyuSettings.toolbarsHidden ? ' moyu-toolbars-hidden' : ''}${moyuSettings.bodyHidden && !moyuPointerInside ? ' moyu-body-hidden' : ''}${moyuSettings.scrollbarVisible ? ' moyu-scrollbar-visible' : ''}` : ''}`} aria-label={t('reader.aria')} style={readerStyle} tabIndex={moyuReader ? 0 : undefined} onKeyDown={moyuReader ? onMoyuReaderKeyDown : undefined} onContextMenu={handleReaderContextMenu} onPointerDown={moyuReader ? startMoyuWindowDrag : undefined} onPointerEnter={() => setMoyuPointerInside(true)} onPointerLeave={() => setMoyuPointerInside(false)}>
      {focusMode && !moyuReader ? <div className="reader-focus-hover-zone" aria-hidden="true" /> : null}
      {moyuReader ? <div className="moyu-reader-drag-region" onPointerDown={startMoyuWindowDrag} aria-hidden="true" /> : null}
      {moyuReader && moyuToolbarTooltip ? <div className={`moyu-reader-tooltip ${moyuToolbarTooltip.placement}`} style={{ left: `${moyuToolbarTooltip.x}px`, top: `${moyuToolbarTooltip.y}px` }}>{moyuToolbarTooltip.text}</div> : null}
      {moyuReader && moyuSettings.interactionLocked ? (
        <button type="button" className="moyu-unlock-affordance" data-moyu-no-drag="true" onClick={() => updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { interactionLocked: false }))} aria-label={t('reader.moyu.unlockWindow')}>
          <BookMindIcon name="windowed" />
        </button>
      ) : null}
      {moyuReader && moyuContextMenu ? <button type="button" className="moyu-context-backdrop" aria-label={t('reader.moyu.closeMenu')} onClick={() => setMoyuContextMenu(null)} /> : null}
      {moyuReader && moyuContextMenu ? (
        <div className="moyu-context-menu" style={{ left: `${moyuContextMenu.x}px`, top: `${moyuContextMenu.y}px` }} data-moyu-no-drag="true" role="menu" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => { updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { interactionLocked: !settings.interactionLocked })); setMoyuContextMenu(null); }}>
            {moyuSettings.interactionLocked ? t('reader.moyu.unlockInteraction') : t('reader.moyu.lockInteraction')}
          </button>
          <button type="button" role="menuitem" onClick={() => { updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { toolbarsHidden: !settings.toolbarsHidden })); setMoyuContextMenu(null); }}>
            {moyuSettings.toolbarsHidden ? t('reader.moyu.showToolbar') : t('reader.moyu.hideToolbar')}
          </button>
          <button type="button" role="menuitem" onClick={() => { restoreSavedMoyuSettings(); setMoyuContextMenu(null); }}>{t('reader.moyu.restoreSaved')}</button>
          <button type="button" role="menuitem" onClick={() => { restoreLastMoyuPreset(); setMoyuContextMenu(null); }}>{t('reader.moyu.restorePreset')}</button>
          <button type="button" role="menuitem" onClick={() => { restoreDefaultMoyuSettings(); setMoyuContextMenu(null); }}>{t('reader.moyu.restoreDefault')}</button>
          <button type="button" role="menuitem" onClick={() => { saveCurrentMoyuSettings(); setMoyuContextMenu(null); }}>{t('reader.moyu.savePreset')}</button>
          <button type="button" role="menuitem" onClick={() => { onOpenMoyuSettings(); setMoyuContextMenu(null); }}>{t('reader.moyu.openSettings')}</button>
          <button type="button" role="menuitem" onClick={() => { setMoyuContextMenu(null); onExitMoyuMode(); }}>{t('reader.moyuMode.exit')}</button>
        </div>
      ) : null}
      {moyuReader ? (
        <div className="moyu-reader-toolbar top" role="toolbar" aria-label={t('reader.moyuMode')} data-moyu-no-drag="true" onPointerEnter={moyuSettings.toolbarRevealMode === 'hover' ? showMoyuTooltipWithDelay : undefined} onPointerLeave={moyuSettings.toolbarRevealMode === 'hover' ? clearMoyuTooltip : undefined} onPointerUp={blurMoyuToolbarPointerTarget} onFocus={moyuSettings.toolbarRevealMode === 'hover' ? showMoyuTooltipWithDelay : undefined} onBlur={moyuSettings.toolbarRevealMode === 'hover' ? clearMoyuTooltip : undefined}>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyuMode.exit')} aria-label={t('reader.moyuMode.exit')} onClick={onExitMoyuMode}><BookMindIcon name="close" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.saveSettings')} aria-label={t('reader.moyu.saveSettings')} onClick={saveCurrentMoyuSettings}><BookMindIcon name="saveCommand" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.restoreSettings')} aria-label={t('reader.moyu.restoreSettings')} onClick={restoreSavedMoyuSettings}><BookMindIcon name="copy" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.defaultSettings')} aria-label={t('reader.moyu.defaultSettings')} onClick={restoreDefaultMoyuSettings}><BookMindIcon name="retry" /></button>
          <span className="moyu-page-meter">{pageMeterText}</span>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.refresh')} aria-label={t('reader.moyu.refresh')} onClick={scheduleRecalculatePages}><BookMindIcon name="retry" /></button>
          <button type="button" className={isAlwaysOnTop ? 'moyu-tool-btn active' : 'moyu-tool-btn'} data-tooltip={isAlwaysOnTop ? t('reader.alwaysOnTop.on') : t('reader.alwaysOnTop.off')} aria-label={isAlwaysOnTop ? t('reader.alwaysOnTop.on') : t('reader.alwaysOnTop.off')} aria-pressed={isAlwaysOnTop} onClick={onToggleAlwaysOnTop}><BookMindIcon name="windowed" /></button>
          <button type="button" className={moyuSettings.bodyHidden ? 'moyu-tool-btn active' : 'moyu-tool-btn'} data-tooltip={t('reader.moyu.hideBodyOnLeave')} aria-label={t('reader.moyu.hideBodyOnLeave')} aria-pressed={moyuSettings.bodyHidden} onClick={() => updateMoyuSettings((settings) => ({ ...settings, bodyHidden: !settings.bodyHidden }))}><BookMindIcon name="focusMode" /></button>
        </div>
      ) : null}
      {moyuReader ? (
        <div className="moyu-reader-toolbar bottom" role="toolbar" aria-label={t('reader.moyu.controls')} data-moyu-no-drag="true" onPointerEnter={moyuSettings.toolbarRevealMode === 'hover' ? showMoyuTooltipWithDelay : undefined} onPointerLeave={moyuSettings.toolbarRevealMode === 'hover' ? clearMoyuTooltip : undefined} onPointerUp={blurMoyuToolbarPointerTarget} onFocus={moyuSettings.toolbarRevealMode === 'hover' ? showMoyuTooltipWithDelay : undefined} onBlur={moyuSettings.toolbarRevealMode === 'hover' ? clearMoyuTooltip : undefined}>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.prevPage')} aria-label={t('reader.prevPage')} onClick={goPrevScreenPage}><BookMindIcon name="prevPage" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.nextPage')} aria-label={t('reader.nextPage')} onClick={goNextScreenPage}><BookMindIcon name="nextPage" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.decreaseOpacity')} aria-label={t('reader.moyu.decreaseOpacity')} onClick={() => adjustMoyuOpacity(-0.08)}><BookMindIcon name="moyuTransparent" /></button>
          <span className="moyu-tool-value">{Math.round(moyuSettings.backgroundOpacity * 100)}%</span>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.increaseOpacity')} aria-label={t('reader.moyu.increaseOpacity')} onClick={() => adjustMoyuOpacity(0.08)}><BookMindIcon name="moyuOpaque" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.decreaseText')} aria-label={t('reader.moyu.decreaseText')} onClick={() => adjustMoyuTextScale(-0.08)}><BookMindIcon name="moyuTextSmall" /></button>
          <span className="moyu-tool-value">{Math.round(moyuSettings.textScale * 100)}%</span>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.increaseText')} aria-label={t('reader.moyu.increaseText')} onClick={() => adjustMoyuTextScale(0.08)}><BookMindIcon name="moyuTextLarge" /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.cycleTextColor')} aria-label={t('reader.moyu.cycleTextColor')} onClick={cycleMoyuTextColor}><BookMindIcon name="highlights" /></button>
          <button type="button" className={moyuSettings.autoScrollEnabled ? 'moyu-tool-btn active' : 'moyu-tool-btn'} data-tooltip={t('reader.moyu.autoScroll')} aria-label={t('reader.moyu.autoScroll')} aria-pressed={moyuSettings.autoScrollEnabled} onClick={() => updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { autoScrollEnabled: !settings.autoScrollEnabled }))}><BookMindIcon name={moyuSettings.autoScrollEnabled ? 'pause' : 'play'} /></button>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.decreaseScrollSpeed')} aria-label={t('reader.moyu.decreaseScrollSpeed')} onClick={() => adjustMoyuAutoScrollSpeed(-6)}><BookMindIcon name="prevPage" /></button>
          <span className="moyu-tool-value">{moyuSettings.autoScrollSpeed}</span>
          <button type="button" className="moyu-tool-btn" data-tooltip={t('reader.moyu.increaseScrollSpeed')} aria-label={t('reader.moyu.increaseScrollSpeed')} onClick={() => adjustMoyuAutoScrollSpeed(6)}><BookMindIcon name="nextPage" /></button>
          <button type="button" className={moyuSettings.scrollbarVisible ? 'moyu-tool-btn active' : 'moyu-tool-btn'} data-tooltip={t('reader.moyu.showScrollbar')} aria-label={t('reader.moyu.showScrollbar')} aria-pressed={moyuSettings.scrollbarVisible} onClick={() => updateMoyuSettings((settings) => ({ ...settings, scrollbarVisible: !settings.scrollbarVisible }))}><BookMindIcon name="toc" /></button>
          <button type="button" className={moyuSettings.toolbarsHidden ? 'moyu-tool-btn active' : 'moyu-tool-btn'} data-tooltip={t('reader.moyu.hideToolbar')} aria-label={t('reader.moyu.hideToolbar')} aria-pressed={moyuSettings.toolbarsHidden} onClick={() => updateMoyuSettings((settings) => ({ ...settings, toolbarsHidden: !settings.toolbarsHidden }))}><BookMindIcon name="moyuHideToolbar" /></button>
        </div>
      ) : null}
      {!moyuReader ? <ReaderToolbar
        book={book}
        settings={settings}
        chaptersLength={chapters.length}
        activeChapterIndex={activeChapterIndex}
        activeScreenPage={activeScreenPage}
        screenPageCount={screenPageCount}
        activeStreamIndex={activeStreamIndex}
        pageStreamLength={pageStreamLength}
        showToc={showToc}
        pageMeterText={pageMeterText}
        pageJumpValue={pageJumpValue}
        pageJumpError={pageJumpError}
        readerDailyGoalEnabled={readerDailyGoalEnabled}
        readerDailyGoalHasTargets={readerDailyGoalHasTargets}
        readerDailyGoalPercent={readerDailyGoalPercent}
        readerDailyGoalSegments={readerDailyGoalSegments}
        searchPanelOpen={searchPanelOpen}
        showHighlightPanel={showHighlightPanel}
        aiPanelOpen={aiPanelOpen}
        rulesPanelOpen={rulesPanelOpen}
        readAloudActive={readAloudActive}
        readAloudPaused={readAloudPaused}
        readerReadAloudEnabled={readerReadAloudEnabled}
        readAloudAvailable={readAloudAvailable}
        readAloudStartLabel={readAloudStartLabel}
        focusMode={focusMode}
        standaloneReader={standaloneReader}
        readerWindowSyncStatus={readerWindowSyncStatus}
        isFullscreen={isFullscreen}
        isAlwaysOnTop={isAlwaysOnTop}
        searchInputRef={searchInputRef}
        readerSearchQuery={readerSearchQuery}
        readerSearchHits={readerSearchHits}
        readerSearchScope={readerSearchScope}
        readerSearchScopeOptions={readerSearchScopeOptions}
        readerSearchChapterFilter={readerSearchChapterFilter}
        readerSearchChapterFilterEnabled={readerSearchChapterFilterEnabled}
        readerSearchChapterOptions={readerSearchChapterOptions}
        readerSearchLimit={readerSearchLimit}
        readerSearchCaseSensitive={readerSearchCaseSensitive}
        readerSearchFuzzy={readerSearchFuzzy}
        readerSearchRegex={readerSearchRegex}
        readerSearchNormalizeTraditionalChinese={readerSearchNormalizeTraditionalChinese}
        readerSearchNormalizeNfkc={readerSearchNormalizeNfkc}
        readerSearchPinyinInitials={readerSearchPinyinInitials}
        readerSavedSearchLimit={readerSavedSearchLimit}
        readerSearchHistoryLimit={readerSearchHistoryLimit}
        readerSavedSearches={readerSavedSearches}
        readerSearchHistory={readerSearchHistory}
        onToggleToc={onToggleToc}
        libraryPanelVisible={libraryPanelVisible}
        onToggleLibraryPanel={onToggleLibraryPanel}
        rightPanelSessionsOpen={rightPanelSessionsOpen}
        rightPanelsCollapsed={rightPanelsCollapsed}
        onToggleRightPanelSidebar={toggleRightPanelSidebar}
        onOpenSettings={onOpenSettings}
        onToggleRulesPanel={onToggleRulesPanel}
        onCreateBookmark={() => {
          onCreateBookmark();
          setActiveAnnotationTab('bookmarks');
          setShowHighlightPanel(true);
        }}
        onToggleWindowed={onToggleWindowed}
        onOpenMoyuMode={onOpenMoyuMode}
        onToggleAiPanel={onToggleAiPanel}
        onToggleFullscreen={onToggleFullscreen}
        onToggleAlwaysOnTop={onToggleAlwaysOnTop}
        onReturnToMainWindow={onReturnToMainWindow}
        onOpenCharacters={onOpenCharacters}
        setPageJumpValue={setPageJumpValue}
        setPageJumpError={setPageJumpError}
        jumpToPageValue={jumpToPageValue}
        handlePageTurnButtonClick={handlePageTurnButtonClick}
        startContinuousPageTurn={startContinuousPageTurn}
        stopContinuousPageTurn={stopContinuousPageTurn}
        setSearchPanelOpen={setSearchPanelOpen}
        openReaderSearchPanel={openReaderSearchPanel}
        setShowHighlightPanel={setShowHighlightPanel}
        pauseOrResumeReaderReadAloud={pauseOrResumeReaderReadAloud}
        stopReaderReadAloud={stopReaderReadAloud}
        startReaderReadAloud={startReadAloudFromCurrentPage}
        toggleFocusMode={toggleFocusMode}
        setReaderSearchQuery={setReaderSearchQuery}
        onReaderSearchKeyDown={onReaderSearchKeyDown}
        goRelativeSearchHit={goRelativeSearchHit}
        setReaderSearchScope={setReaderSearchScope}
        setReaderSearchChapterFilter={setReaderSearchChapterFilter}
        setReaderSearchLimit={setReaderSearchLimit}
        setReaderSearchCaseSensitive={setReaderSearchCaseSensitive}
        setReaderSearchFuzzy={setReaderSearchFuzzy}
        setReaderSearchRegex={setReaderSearchRegex}
        setReaderSearchNormalizeTraditionalChinese={setReaderSearchNormalizeTraditionalChinese}
        setReaderSearchNormalizeNfkc={setReaderSearchNormalizeNfkc}
        setReaderSearchPinyinInitials={setReaderSearchPinyinInitials}
        saveReaderSearch={saveReaderSearch}
        applyReaderSavedSearch={applyReaderSavedSearch}
      /> : null}

      <div className={`reader-stage theme-${visualSettings.theme} ${showToc ? 'toc-open' : ''} layout-${visualSettings.layoutMode} pages-${resolvedPageMode} page-align-${visualSettings.pageVerticalAlign} punctuation-${visualSettings.cjkPunctuationHanging} mixed-${visualSettings.mixedTextSpacing} weight-${visualSettings.fontWeightBoost} title-decoration-${visualSettings.titleDecoration} anim-${visualSettings.pageAnimation}${customReaderColorsEnabled ? ' reader-custom-colors' : ''}`}>
        {readerJumpNotice ? <p className="reader-jump-notice" role="status" aria-live="polite">{readerJumpNotice}</p> : null}
        {readAloudActive && readAloudLocation?.paragraphIndex !== null && !readAloudLocationVisible ? (
          <button className="reader-return-read-aloud" type="button" onClick={returnToReadAloudLocation}>
            {t('reader.readAloud.returnToPosition')}
          </button>
        ) : null}
        {extendedSettings.readerFpsDiagnosticsEnabled && readerFpsDiagnostics ? (
          <div className="reader-fps-diagnostics" role="status" aria-live="polite">
            <strong>{readerFpsDiagnostics.fps} FPS</strong>
            <span>{readerFpsDiagnostics.lastFrameMs} ms</span>
            <span>{t('reader.diagnostics.lowFrames', { count: readerFpsDiagnostics.lowFrameCount })}</span>
          </div>
        ) : null}
        {extendedSettings.readerMemoryWarningEnabled && readerMemoryDiagnostics?.warning ? (
          <div className={`reader-memory-warning${extendedSettings.readerFpsDiagnosticsEnabled && readerFpsDiagnostics ? ' below-fps' : ''}`} role="status" aria-live="polite">
            <strong>{t('reader.diagnostics.memoryUsage', { used: readerMemoryDiagnostics.usedMb, threshold: readerMemoryDiagnostics.thresholdMb })}</strong>
            <span>{t('reader.diagnostics.memoryLimit', { limit: readerMemoryDiagnostics.limitMb ? `${readerMemoryDiagnostics.limitMb} MB` : t('reader.diagnostics.unknown') })}</span>
            <span>{t('reader.diagnostics.memoryAdvice')}</span>
            <button className="reader-memory-warning-settings" type="button" onClick={onOpenReaderMemorySettings}>{t('reader.diagnostics.openSettings')}</button>
          </div>
        ) : null}
        {showToc ? <div className="reader-toc-shell"><ReaderToc chapters={chapters} highlights={highlights} bookmarks={bookmarks} hiddenChapters={hiddenChapters} activeChapterIndex={activeChapterIndex} activeParagraphIndex={activeParagraphIndex} tocMenu={tocMenu} tocHierarchyMode={tocHierarchyMode} tocShowVolumeHierarchy={extendedSettings.tocShowVolumeHierarchy} tocVolumeClickable={extendedSettings.tocVolumeClickable} tocShowChapterNumbers={extendedSettings.tocShowChapterNumbers} tocCollapseVolumes={extendedSettings.tocCollapseVolumes} tocExpandActiveVolume={extendedSettings.tocExpandActiveVolume} tocShowChapterWordCount={extendedSettings.tocShowChapterWordCount} tocShowChapterProgress={extendedSettings.tocShowChapterProgress} tocTitleGroupingEnabled={extendedSettings.tocTitleGroupingEnabled} tocTitleGroupKeywords={extendedSettings.tocTitleGroupKeywords} tocTitleGroupRules={extendedSettings.tocTitleGroupRules} tocAllowRename={extendedSettings.tocAllowRename} tocAllowHide={extendedSettings.tocAllowHide} tocAllowUnhide={extendedSettings.tocAllowUnhide} tocAllowSplit={extendedSettings.tocAllowSplit} tocAllowMergeNext={extendedSettings.tocAllowMergeNext} tocAllowRestoreDefault={extendedSettings.tocAllowRestoreDefault} tocAllowUndoRedo={extendedSettings.tocAllowUndoRedo} tocEditHistory={tocEditHistory} onOpenMenu={setTocMenu} onRememberMenuOpener={(element) => { floatingMenuFocusRef.current = element; }} onOpenTextDialog={setTextDialog} onSelectChapter={onSelectChapter} onTocEdit={onTocEdit} onUndoTocEdit={onUndoTocEdit} onRedoTocEdit={onRedoTocEdit} onRestoreDefaultToc={onRestoreDefaultToc} onExportTocEdits={onExportTocEdits} onImportTocEditsJson={onImportTocEditsJson} canUndoTocEdit={canUndoTocEdit} canRedoTocEdit={canRedoTocEdit} hasTocEdits={hasTocEdits} contextMenuEnabled={contextMenuEnabled} onLongPressMenu={startLongPressMenu} onLongPressCancel={cancelLongPressMenu} onSuppressClickAfterLongPress={suppressClickAfterLongPress} /><div className="reader-toc-resize-grip" role="separator" aria-label={t('reader.toc.title')} tabIndex={0} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={360} aria-valuenow={tocWidth} onKeyDown={onTocWidthGripKeyDown} onPointerDown={startTocWidthDrag}><span /></div></div> : null}
        <ReaderHighlightPanel readerSearchQuery={readerSearchQuery} searchPanelOpen={searchPanelOpen} readerSearchHits={readerSearchHits} activeSearchHitIndex={activeSearchHitIndex} setActiveSearchHitIndex={setActiveSearchHitIndex} jumpToSearchHit={jumpToSearchHit} showHighlightPanel={showHighlightPanel} setShowHighlightPanel={setShowHighlightPanel} activeAnnotationTab={activeAnnotationTab} setActiveAnnotationTab={setActiveAnnotationTab} filteredHighlights={filteredHighlights} highlights={highlights} annotationExportChoice={annotationExportChoice} setAnnotationExportChoice={setAnnotationExportChoice} exportSelectedAnnotations={exportSelectedAnnotations} onImportAnnotationsJson={onImportAnnotationsJson} setSelectedHighlightIds={setSelectedHighlightIds} selectedHighlightIds={selectedHighlightIds} onDeleteHighlights={onDeleteHighlights} showUndoToast={showUndoToast} onRestoreHighlight={onRestoreHighlight} highlightSearchQuery={highlightSearchQuery} setHighlightSearchQuery={setHighlightSearchQuery} highlightQueryScope={highlightQueryScope} setHighlightQueryScope={setHighlightQueryScope} highlightChapterFilter={highlightChapterFilter} setHighlightChapterFilter={setHighlightChapterFilter} chapters={chapters} highlightSort={highlightSort} setHighlightSort={setHighlightSort} highlightNoteFilter={highlightNoteFilter} setHighlightNoteFilter={setHighlightNoteFilter} highlightTagFilter={highlightTagFilter} setHighlightTagFilter={setHighlightTagFilter} highlightImportanceFilter={highlightImportanceFilter} setHighlightImportanceFilter={setHighlightImportanceFilter} highlightReviewFilter={highlightReviewFilter} setHighlightReviewFilter={setHighlightReviewFilter} highlightTagOptions={highlightTagOptions} highlightColorFilter={highlightColorFilter} setHighlightColorFilter={setHighlightColorFilter} highlightGroups={highlightGroups} highlightFiltersActive={highlightFiltersActive} bookmarks={bookmarks} filteredBookmarks={filteredBookmarks} bookmarkSearchQuery={bookmarkSearchQuery} setBookmarkSearchQuery={setBookmarkSearchQuery} bookmarkSort={bookmarkSort} setBookmarkSort={setBookmarkSort} bookmarkGroupBy={bookmarkGroupBy} setBookmarkGroupBy={setBookmarkGroupBy} bookmarkColorFilter={bookmarkColorFilter} setBookmarkColorFilter={setBookmarkColorFilter} bookmarkFiltersActive={bookmarkFiltersActive} selectedBookmarkIds={selectedBookmarkIds} setSelectedBookmarkIds={setSelectedBookmarkIds} onDeleteBookmark={onDeleteBookmark} onRestoreBookmark={onRestoreBookmark} onUpdateBookmark={onUpdateBookmark} onJumpBookmark={(bookmark) => onSelectChapterPage(bookmark.chapterIndex, bookmark.screenPage, bookmark.paragraphIndex)} selectedBookmarks={selectedBookmarks} bulkBookmarkTags={bulkBookmarkTags} setBulkBookmarkTags={setBulkBookmarkTags} bulkBookmarkTagMode={bulkBookmarkTagMode} setBulkBookmarkTagMode={setBulkBookmarkTagMode} bulkBookmarkNote={bulkBookmarkNote} setBulkBookmarkNote={setBulkBookmarkNote} bulkBookmarkNoteMode={bulkBookmarkNoteMode} setBulkBookmarkNoteMode={setBulkBookmarkNoteMode} bulkBookmarkColor={bulkBookmarkColor} setBulkBookmarkColor={setBulkBookmarkColor} applyBulkBookmarkEdit={applyBulkBookmarkEdit} highlightVirtualWindow={highlightVirtualWindow} bookmarkVirtualWindow={bookmarkVirtualWindow} setBookmarkViewer={setBookmarkViewer} deleteBookmarkWithUndo={deleteBookmarkWithUndo} toggleHighlightSelection={toggleHighlightSelection} toggleBookmarkSelection={toggleBookmarkSelection} jumpToParagraph={jumpToParagraph} openHighlightMenu={openHighlightMenu} openHighlightMenuFromKeyboard={openHighlightMenuFromKeyboard} startLongPressMenu={startLongPressMenu} openHighlightMenuAt={openHighlightMenuAt} cancelLongPressMenu={cancelLongPressMenu} suppressClickAfterLongPress={suppressClickAfterLongPress} openHighlightMenuFromButton={openHighlightMenuFromButton} />
        <div className="reader-book-scroll" ref={scrollRef} onScroll={onReaderScroll} onMouseUp={onReaderMouseUp} onClick={onReaderPageClick} onPointerDown={moyuReader ? undefined : startReaderGesturePaging} onPointerMove={(event) => { onReaderPointerMove(); if (!moyuReader) updateReaderGesturePaging(event); }} onPointerUp={moyuReader ? undefined : finishReaderGesturePaging} onPointerCancel={moyuReader ? undefined : cancelReaderGesturePaging} onPointerLeave={() => setCursorHidden(false)}>
          <div className="reader-measure-probe reader-body-frame" aria-hidden="true"><div className="reader-body-content" ref={measureRef} /></div>
          <ReaderContent
            book={book}
            settings={settings}
            chapters={chapters}
            activeChapterIndex={activeChapterIndex}
            activeParagraphIndex={activeParagraphIndex}
            visibleChapters={visibleChapters}
            visiblePageStream={renderVisiblePageStream}
            virtualRange={virtualRange}
            progress={progress}
            runningPageCount={runningPageCount}
            pageTurnDirection={pageTurnDirection}
            pageTurnKey={pageTurnKey}
            expandedTitleIds={expandedTitleIds}
            highlightIndex={highlightIndex}
            debouncedReaderSearchQuery={debouncedReaderSearchQuery}
            readerSearchHighlightColor={readerSearchHighlightColor}
            highlightOverlapStrategy={extendedSettings.highlightOverlapStrategy}
            readAloudLocation={readAloudLocation}
            virtualParagraphWindowSize={virtualParagraphWindowSize}
            t={t}
            onToggleTitleExpanded={(chapterId) => setExpandedTitleIds((current) => {
              const next = new Set(current);
              if (next.has(chapterId)) next.delete(chapterId);
              else next.add(chapterId);
              return next;
            })}
            onJumpEpubNote={jumpToEpubNote}
            selectWordFromDoubleClick={selectWordFromDoubleClick}
            startLongPressSelection={startLongPressSelection}
            cancelLongPressSelection={cancelLongPressSelection}
            openHighlightMenu={openHighlightMenu}
            startLongPressMenu={startLongPressMenu}
            openHighlightMenuAt={openHighlightMenuAt}
            cancelLongPressMenu={cancelLongPressMenu}
            suppressClickAfterLongPress={suppressClickAfterLongPress}
            onPageWidthGripKeyDown={onPageWidthGripKeyDown}
            startPageWidthDrag={startPageWidthDrag}
          />
          {highlightMenu ? createPortal(<ReaderHighlightContextMenu menu={highlightMenu} annotationMarkdownEditorEnabled={annotationMarkdownEditorEnabled} jumpToParagraph={jumpToParagraph} setHighlightViewer={setHighlightViewer} setTextDialog={setTextDialog} setHighlightMenu={setHighlightMenu} onUpdateHighlightColor={onUpdateHighlightColor} onDefaultHighlightColorChange={onDefaultHighlightColorChange} onUpdateHighlightNote={onUpdateHighlightNote} onClearHighlightNote={onClearHighlightNote} deleteHighlightWithUndo={deleteHighlightWithUndo} />, document.body) : null}
          <ReaderAnnotationOverlays
            selectionMenu={selectionMenu}
            copySelectionText={copySelectionText}
            searchSelectionText={searchSelectionText}
            explainSelectionText={explainSelectionText}
            translateSelectionText={translateSelectionText}
            createSelectionCard={createSelectionCard}
            generateSelectionQuestions={generateSelectionQuestions}
            createSelectionAnnotation={createSelectionAnnotation}
            startReadAloudFromSelectionParagraph={startReadAloudFromSelectionParagraph}
            createSelectionHighlight={createSelectionHighlight}
            clearSelectionMenu={clearSelectionMenu}
            annotationMarkdownEditorEnabled={annotationMarkdownEditorEnabled}
            jumpToParagraph={jumpToParagraph}
            setHighlightViewer={setHighlightViewer}
            setTextDialog={setTextDialog}
            onUpdateHighlightColor={onUpdateHighlightColor}
            onDefaultHighlightColorChange={onDefaultHighlightColorChange}
            onUpdateHighlightNote={onUpdateHighlightNote}
            deleteHighlightWithUndo={deleteHighlightWithUndo}
            undoToast={undoToast}
            setUndoToast={setUndoToast}
            undoLabel={t('reader.undo.action')}
            bookmarkViewer={bookmarkViewer}
            setBookmarkViewer={setBookmarkViewer}
            chapters={chapters}
            annotationTagSuggestions={annotationTagSuggestions}
            onUpdateBookmark={onUpdateBookmark}
            deleteBookmarkWithUndo={deleteBookmarkWithUndo}
            onSelectChapterPage={onSelectChapterPage}
            highlightViewer={highlightViewer}
            highlightColorMeanings={extendedSettings.highlightColorMeanings}
            onUpdateHighlightDetails={onUpdateHighlightDetails}
            textDialog={textDialog}
          />
        </div>
        <ReaderTranslationPanel
          state={readerTranslation.state}
          onConfirm={readerTranslation.confirm}
          onRetry={readerTranslation.retry}
          onClose={readerTranslation.close}
          onSourceChange={readerTranslation.changeSource}
          onSourceLanguageChange={readerTranslation.changeSourceLanguage}
          onTargetLanguageChange={readerTranslation.changeTargetLanguage}
          onSwapLanguages={readerTranslation.swapLanguages}
        />
        {settings.layoutMode === 'flow' ? <div className="reader-width-grip reader-flow-width-grip" role="separator" aria-label={t('reader.pageWidth')} tabIndex={0} aria-orientation="vertical" aria-valuemin={420} aria-valuemax={1200} aria-valuenow={settings.pageWidth} onKeyDown={onPageWidthGripKeyDown} onPointerDown={startPageWidthDrag}><span /></div> : null}
      </div>
    </article>
  );
}

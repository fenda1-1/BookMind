import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LibraryPanel } from '../features/library/LibraryPanel';
import { emptyTrash, importBookFromPath, importBooksFromDirectory, loadLibraryBooks, moveBookToTrash, permanentlyDeleteBook, restoreBookFromTrash, saveBookMetadata, type DirectoryImportScanResult } from '../services/libraryService';
import { emitWindowFrameGeometryChanged, subscribeLibraryRefreshRequests } from '../services/appDomainEvents';
import { loadAppSettings, saveAppSettings } from '../services/settingsService';
import { recordOperationLog, setOperationLogLevel } from '../services/operationLogService';
import { getStartupTaskResumePlan, loadTaskStatuses, subscribeTaskProgressEvents } from '../services/taskService';
import { loadCharacterCenterBooks, loadCharacterCenterPayload, loadCharacterOverviewSnapshot } from '../services/characterCenterService';
import { getBookIndexView, loadSharedIndexDiagnostics, tasksUpdatedEvent } from '../services/indexDiagnosticsService';
import { dispatchSettingsUpdated, getPrivacyBookTitle, getPrivacyFilePath, hydrateSettingsV2FromBackend, loadChapterRules, loadExtendedSettings, saveExtendedSettings, settingsCenterUpdatedEvent, shouldHideRecentReading, subscribeSettingsUpdated, type ChapterRuleDraft, type ExtendedSettings, type SettingsUpdatedDetail } from '../services/settingsCenterService';
import { requestNoteView } from '../services/appNavigationEvents';
import { openExternalUrl } from '../services/externalUrlService';
import type { AiAskRequest, AiDiagnostics, AppPage, AppSettings, Book, CharacterCenterBookSummary, CharacterCenterPayload, CharacterOverviewSnapshot, CharacterWorkbenchView, Citation, IndexDiagnostics, NavItem, ReaderNoteLocation, SearchResult, TaskStatus } from '../types';
import { OverviewPage } from '../pages/OverviewPage';
import { ReaderWorkspace } from '../pages/ReaderWorkspace';
import { settingsGroups, type SettingsGroupId } from '../features/settings-center/settingsCenterModel';
import type { ReaderCustomPreset } from '../features/reader-core/readerSettings';
import { shouldResetAiIndexStateAfterTaskRefresh } from '../features/task-center/taskCompletionRefreshPolicy';
import { getAiProviderModelConfig, mergeAiProviderProfileModels, normalizeAiProviderModelSettings, normalizeAiProviderProfilesForUi } from '../features/settings-center/settingsCenterAiProviderModel';
import { buildCharacterCenterBookSummaries } from '../features/characters/characterCenterBooks';
import {
  buildCharacterBookCacheSignature,
  buildDefaultCharacterGraphSessionState,
  defaultCharacterWorkbenchView,
  getCachedCharacterGraphSessionState,
  mergeCharacterGraphSessionState,
  rememberCharacterGraphSessionState,
  type CharacterGraphSessionState,
  type CharacterGraphSessionStateCacheEntry,
  type CharacterGraphSessionStatePatch,
} from '../features/characters/characterCenterSession';
import { CommandPalette } from './CommandPalette';
import { AppTopbar } from './AppTopbar';
import { AppNotifications } from './AppNotifications';
import { AppLockOverlay } from './AppLockOverlay';
import { useAppWindowLifecycle } from './useAppWindowLifecycle';
import { createAppCommands, createSettingsCommands, type CommandId } from './commandRegistry';
import { isTauriRuntime } from './platform';
import { createTranslator, I18nContext, isLocalePreference, loadStoredLocalePreference, resolveLocalePreference, saveStoredLocalePreference, useI18n, type CustomTerminologyRule, type LocalePreference } from '../i18n';
import { hydrateReaderSettingsV2FromBackend } from '../features/reader-core/readerSettings';
import { createAppAiSessionActions } from './appAiSessionActions';
import { useAppCommands } from './useAppCommands';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useAppLock } from './useAppLock';
import { useAppSettings } from './useAppSettings';
import { useLibrary } from './useLibrary';
import { useTaskCenter } from './useTaskCenter';
import { useCharacterCenter } from './useCharacterCenter';
import { AppStateContext } from './AppStateContext';
import { useAppConfirm } from '../components/useAppConfirm';
import { LazyLoadBoundary } from '../components/LazyLoadBoundary';
import {
  autoIndexOpenedReaderBook as runAutoIndexOpenedReaderBookAction,
  liveCharacterTaskOverlay,
  localCharacterExtractionOverlay,
  maybeRunQueuedTasksWhenIdle as runMaybeRunQueuedTasksWhenIdleAction,
  notifyBackgroundTaskCompletion,
  runAppParseAndIndexTasks as runAppParseAndIndexTasksAction,
  runCharacterExtraction as runCharacterExtractionAction,
  runCharacterTextIndex as runCharacterTextIndexAction,
  shouldAutoIndexOpenedReaderBook,
  type AppTaskActionContext,
  type BackgroundTaskCompletionDetail,
} from './appTaskActions';
import {
  buildAppThemeStyle,
  buildImportDialogOptions,
  buildImportSummaryToast,
  buildTxtImportCleanupOptions,
  checkUnfinishedTasksOnStartup,
  clearLastReaderBookId,
  confirmExternalPathOpen,
  formatAiSummaryShortcut,
  formatCommandPaletteShortcut,
  formatImportShortcut,
  formatNavigationShortcut,
  isDarkAppTheme,
  loadRecentCommandIds,
  matchesCommandPaletteShortcut,
  matchesConfiguredShortcut,
  maybeCreateStartupAutoDataBackup,
  mergeLibraryMetadataBooks,
  openFirstImportedBookAfterDirectoryImport,
  parseBoundedInteger,
  refreshLibraryMetadataOnStartup,
  resolveRecentReaderBookId,
  resolveStartupPage,
  resolveVisibleAppPage,
  resolveStartupReaderBookId,
  resolveActiveCharacterExtractionBookId,
  restoreMainWindowGeometry,
  saveImportedBookTocManifests,
  saveLastReaderBookId,
  saveRecentCommandIds,
  scheduleMainWindowGeometrySave,
  shouldRunImportTocParsing,
  showTaskCenterForLongOperation,
} from './appShellModel';

const LibraryPage = lazy(() => import('../pages/LibraryPage').then((module) => ({ default: module.LibraryPage })));
const KnowledgePage = lazy(() => import('../pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })));
const CharactersPage = lazy(() => import('../pages/CharactersPage').then((module) => ({ default: module.CharactersPage })));
const SearchPage = lazy(() => import('../pages/SearchPage').then((module) => ({ default: module.SearchPage })));
const TasksPage = lazy(() => import('../pages/TasksPage').then((module) => ({ default: module.TasksPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const MoyuReaderSettingsWindow = lazy(() => import('../pages/MoyuReaderSettingsWindow').then((module) => ({ default: module.MoyuReaderSettingsWindow })));

export function App() {
  const { confirmDialog } = useAppConfirm();
  const [extendedSettings, setExtendedSettings] = useState<ExtendedSettings>(() => loadExtendedSettings());
  const [chapterRules, setChapterRules] = useState<ChapterRuleDraft>(() => loadChapterRules());
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(loadStoredLocalePreference);
  useEffect(() => subscribeSettingsUpdated((detail) => {
    if (!isLocalePreference(detail.localePreference)) return;
    setLocalePreferenceState(detail.localePreference);
    saveStoredLocalePreference(detail.localePreference);
  }), []);
  const locale = useMemo(() => resolveLocalePreference(localePreference), [localePreference]);
  const customTerminologyRules = useMemo(() => buildCustomTerminologyRules(extendedSettings.customTerminologyRules), [extendedSettings.customTerminologyRules]);
  const t = useMemo(() => createTranslator(locale, extendedSettings.translationFallbackStrategy, { enabled: extendedSettings.customTerminologyEnabled, rules: customTerminologyRules }), [customTerminologyRules, extendedSettings.customTerminologyEnabled, extendedSettings.translationFallbackStrategy, locale]);
  const navItems: NavItem[] = useMemo(() => [
    { id: 'overview', label: t('nav.overview.label'), description: t('nav.overview.description'), badge: t('common.new') },
    { id: 'reader', label: t('nav.reader.label'), description: t('nav.reader.description') },
    { id: 'library', label: t('nav.library.label'), description: t('nav.library.description') },
    { id: 'knowledge', label: t('nav.knowledge.label'), description: t('nav.knowledge.description') },
    { id: 'characters', label: t('nav.characters.label'), description: t('nav.characters.description') },
    { id: 'search', label: t('nav.search.label'), description: t('nav.search.description') },
    { id: 'tasks', label: t('nav.tasks.label'), description: t('nav.tasks.description') },
    { id: 'settings', label: t('nav.settings.label'), description: t('nav.settings.description') },
  ], [t]);
  const visibleNavItems = useMemo(() => {
    const configuredVisibleNavItems = extendedSettings.booksOpenInStandaloneReader
      ? extendedSettings.visibleNavItems.filter((id) => id !== 'reader')
      : extendedSettings.visibleNavItems;
    const visibleIds = new Set<AppPage>([...configuredVisibleNavItems, 'settings']);
    const configuredNavOrder: AppPage[] = [...configuredVisibleNavItems, 'settings'];
    const navOrderIds = configuredNavOrder.filter((id, index, order) => visibleIds.has(id) && order.indexOf(id) === index);
    const orderedNavItems = navOrderIds.map((id) => navItems.find((item) => item.id === id)).filter((item): item is NavItem => Boolean(item));
    const missingNavItems = navItems.filter((item) => visibleIds.has(item.id) && !navOrderIds.includes(item.id));
    return [...orderedNavItems, ...missingNavItems];
  }, [extendedSettings.visibleNavItems, extendedSettings.booksOpenInStandaloneReader, navItems]);
  const pageTitles: Record<AppPage, { eyebrow: string; title: string; description: string }> = useMemo(() => ({
    overview: { eyebrow: t('page.overview.eyebrow'), title: t('nav.overview.label'), description: t('overview.empty') },
    reader: { eyebrow: t('page.reader.eyebrow'), title: t('nav.reader.label'), description: t('nav.reader.description') },
    library: { eyebrow: t('page.library.eyebrow'), title: t('nav.library.label'), description: t('nav.library.description') },
    knowledge: { eyebrow: t('page.knowledge.eyebrow'), title: t('nav.knowledge.label'), description: t('knowledge.description') },
    characters: { eyebrow: t('page.characters.eyebrow'), title: t('nav.characters.label'), description: t('characters.description') },
    search: { eyebrow: t('page.search.eyebrow'), title: t('nav.search.label'), description: t('search.description') },
    tasks: { eyebrow: t('page.tasks.eyebrow'), title: t('nav.tasks.label'), description: t('tasks.description') },
    settings: { eyebrow: t('page.settings.eyebrow'), title: t('nav.settings.label'), description: t('settings.description') },
  }), [t]);
  const appCommands = useAppCommands({ extendedSettings, t });
  const i18nValue = useMemo(() => ({ locale, localePreference, setLocalePreference, t }), [locale, localePreference, t]);
  const standaloneReader = useMemo(() => new URLSearchParams(window.location.search).get('readerWindow') === '1', []);
  const moyuReader = useMemo(() => new URLSearchParams(window.location.search).get('moyu') === '1', []);
  const moyuSettingsWindow = useMemo(() => new URLSearchParams(window.location.search).get('moyuSettings') === '1', []);
  const standaloneBookId = useMemo(() => new URLSearchParams(window.location.search).get('bookId'), []);
  const [books, setBooks] = useState<Book[]>([]);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [aiDiagnostics, setAiDiagnostics] = useState<AiDiagnostics | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error'>('idle');
  const [aiSaveStatus, setAiSaveStatus] = useState('');
  const [lastAiRequest, setLastAiRequest] = useState<AiAskRequest | null>(null);
  const [lastAiModel, setLastAiModel] = useState('local-index');
  const [aiStopped, setAiStopped] = useState(false);
  const aiStoppedRef = useRef(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiRequestIdRef = useRef<string | null>(null);
  const aiStreamTokenBufferRef = useRef('');
  const aiStreamTokenFlushTimerRef = useRef<number | null>(null);
  const appSettingsRef = useRef<AppSettings | null>(null);
  const mainWindowGeometrySaveTimerRef = useRef<number | null>(null);
  const readingProgressSaveTimersRef = useRef<Map<string, number>>(new Map());
  const appLockUnlockButtonRef = useRef<HTMLButtonElement | null>(null);
  const booksRef = useRef<Book[]>([]);
  const backgroundTaskPreviousSnapshotRef = useRef<TaskStatus[]>([]);
  const startupTaskResumeStartedRef = useRef(false);
  const idleQueuedTaskAutoRunStartedRef = useRef(false);
  const autoIndexOpenedBookKeysRef = useRef<Set<string>>(new Set());
  const characterBookIdRef = useRef<string | null>(null);
  const characterPayloadLoadingBookIdRef = useRef<string | null>(null);
  const characterOverviewSnapshotLoadingBookIdRef = useRef<string | null>(null);
  const characterGraphSessionStateCacheRef = useRef(new Map<string, CharacterGraphSessionStateCacheEntry>());
  const cloudAiHistoryContextRef = useRef<{
    request: AiAskRequest;
    bookId: string;
    requestId: string;
    startedAt: number;
    endpointMode: string;
    model: string;
    historyLimit: number;
  } | null>(null);
  const [night, setNight] = useState(() => isDarkAppTheme(extendedSettings));
  const [activePage, setActivePage] = useState<AppPage>(() => resolveStartupPage(
    standaloneReader,
    extendedSettings.startupPage,
    extendedSettings.visibleNavItems,
    extendedSettings.booksOpenInStandaloneReader,
  ));
  const activePageRef = useRef<AppPage>(activePage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => extendedSettings.sidebarCollapsed);
  const [readerLibraryPanelVisible, setReaderLibraryPanelVisible] = useState(() => extendedSettings.libraryPanelPersistent);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = useState<CommandId[]>(() => loadRecentCommandIds());
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [libraryLoadError, setLibraryLoadError] = useState('');
  const [pendingReaderSearchResult, setPendingReaderSearchResult] = useState<SearchResult | null>(null);
  const [readerNoteLocation, setReaderNoteLocation] = useState<ReaderNoteLocation | null>(null);
  const [aiNoteToast, setAiNoteToast] = useState<{ noteId: string; message: string } | null>(null);
  const [taskCompletionToast, setTaskCompletionToast] = useState<{ message: string; characterAction?: { bookId: string } | null } | null>(null);
  const [importSummaryToast, setImportSummaryToast] = useState<{ message: string; bookId: string | null } | null>(null);
  const [pendingDirectoryImportPreview, setPendingDirectoryImportPreview] = useState<DirectoryImportScanResult | null>(null);
  const [readerIndexing, setReaderIndexing] = useState(false);
  const [characterBookId, setCharacterBookId] = useState<string | null>(null);
  const [selectedCharacterWorkbenchView, setSelectedCharacterWorkbenchView] = useState<CharacterWorkbenchView>(defaultCharacterWorkbenchView);
  const [renderedCharacterWorkbenchView, setRenderedCharacterWorkbenchView] = useState<CharacterWorkbenchView>(defaultCharacterWorkbenchView);
  const [characterGraphSessionState, setCharacterGraphSessionState] = useState<CharacterGraphSessionState>(() => buildDefaultCharacterGraphSessionState());
  const [characterIndexingBookId, setCharacterIndexingBookId] = useState<string | null>(null);
  const [characterExtractionBookId, setCharacterExtractionBookId] = useState<string | null>(null);
  const [characterPayload, setCharacterPayload] = useState<CharacterCenterPayload | null>(null);
  const [characterOverviewSnapshot, setCharacterOverviewSnapshot] = useState<CharacterOverviewSnapshot | null>(null);
  const [characterOverviewSnapshotLoadingBookId, setCharacterOverviewSnapshotLoadingBookId] = useState<string | null>(null);
  const [characterBookSummariesFromBackend, setCharacterBookSummariesFromBackend] = useState<CharacterCenterBookSummary[] | null>(null);
  const [taskSnapshot, setTaskSnapshot] = useState<TaskStatus[]>([]);
  const [indexDiagnostics, setIndexDiagnostics] = useState<IndexDiagnostics | null>(null);
  const [unfinishedTaskSummary, setUnfinishedTaskSummary] = useState<{ count: number; tasks: TaskStatus[] } | null>(null);
  const [backgroundTaskRunning, setBackgroundTaskRunning] = useState(false);
  const [settingsHighlightTarget, setSettingsHighlightTarget] = useState<'ai-api' | 'reader-memory-warning' | undefined>(undefined);
  const [settingsInitialGroup, setSettingsInitialGroup] = useState<SettingsGroupId | undefined>(undefined);
  useEffect(() => {
    if (standaloneReader || !isTauriRuntime()) return undefined;
    const currentWindow = getCurrentWindow();
    const listener = currentWindow.listen<{ target?: 'ai-api' | 'reader-memory-warning' }>('bookmind:open-settings', (event) => {
      setSettingsHighlightTarget(event.payload?.target);
      setSettingsInitialGroup(undefined);
      setActivePage('settings');
    });
    return () => { listener.then((dispose) => dispose()).catch(() => undefined); };
  }, [standaloneReader]);
  const [openReaderSettingsPanelRequest, setOpenReaderSettingsPanelRequest] = useState(0);
  const [readerPresetApplyRequest, setReaderPresetApplyRequest] = useState<{ id: number; preset: ReaderCustomPreset } | null>(null);
  const [restoreStartupReaderPosition, setRestoreStartupReaderPosition] = useState(true);
  const [detachedReaderBookId, setDetachedReaderBookId] = useState<string | null>(null);
  const selectedReaderBookId = useMemo(() => {
    if (!selectedBookId) return null;
    return books.some((item) => item.id === selectedBookId && !item.deleted) ? selectedBookId : null;
  }, [books, selectedBookId]);
  const recentReaderBookId = useMemo(() => resolveRecentReaderBookId(books, !shouldHideRecentReading(extendedSettings)), [books, extendedSettings.recordRecentReaderBooks, extendedSettings.applicationPrivacyMode, extendedSettings.hideRecentReadingInPrivacyMode]);
  const book = useMemo(() => {
    const selected = books.find((item) => item.id === selectedBookId);
    if (selected && !selected.deleted) return selected;
    return books.find((item) => !item.deleted) ?? null;
  }, [books, selectedBookId]);
  const characterBook = useMemo(() => {
    if (!characterBookId) return null;
    const selected = books.find((item) => item.id === characterBookId);
    return selected && !selected.deleted ? selected : null;
  }, [books, characterBookId]);
  const characterBookUnavailableReason = useMemo(() => {
    if (!characterBookId) return 'none';
    const selected = books.find((item) => item.id === characterBookId);
    if (!selected) return 'missing';
    return selected.deleted ? 'deleted' : 'none';
  }, [books, characterBookId]);
  const selectedCharacterPayload = useMemo(() => {
    return characterBookId && characterPayload?.book.id === characterBookId ? characterPayload : null;
  }, [characterBookId, characterPayload]);
  const selectedCharacterOverviewSnapshot = useMemo(() => {
    return characterBookId && characterOverviewSnapshot?.bookId === characterBookId ? characterOverviewSnapshot : null;
  }, [characterBookId, characterOverviewSnapshot]);
  const characterBookSummaries = useMemo(() => {
    const summaries = buildCharacterCenterBookSummaries(books, indexDiagnostics, taskSnapshot);
    const backendSummariesById = new Map((characterBookSummariesFromBackend ?? []).map((summary) => [summary.id, summary]));
    const mergedSummaries = summaries.map((summary) => {
      const backendSummary = backendSummariesById.get(summary.id);
      const mergedSummary = backendSummary ? { ...summary, ...backendSummary } : summary;
      return {
        ...mergedSummary,
        ...liveCharacterTaskOverlay(mergedSummary, taskSnapshot),
        ...localCharacterExtractionOverlay(mergedSummary, characterExtractionBookId, taskSnapshot),
      };
    });
    if (!selectedCharacterPayload) return mergedSummaries;
    return mergedSummaries.map((summary) => {
      if (summary.id !== selectedCharacterPayload.book.id) return summary;
      const mergedSummary = { ...selectedCharacterPayload.book, ...summary };
      return {
        ...mergedSummary,
        ...liveCharacterTaskOverlay(mergedSummary, taskSnapshot),
        ...localCharacterExtractionOverlay(mergedSummary, characterExtractionBookId, taskSnapshot),
      };
    });
  }, [books, characterBookSummariesFromBackend, characterExtractionBookId, indexDiagnostics, selectedCharacterPayload, taskSnapshot]);
  const characterBookSummary = useMemo(
    () => characterBookId ? characterBookSummaries.find((item) => item.id === characterBookId) ?? null : null,
    [characterBookId, characterBookSummaries],
  );
  const characterBookSignature = useMemo(() => buildCharacterBookCacheSignature(characterBookSummary), [characterBookSummary]);
  const activeCharacterExtractionBookId = useMemo(() => {
    return resolveActiveCharacterExtractionBookId(characterExtractionBookId, characterBookId, taskSnapshot);
  }, [characterBookId, characterExtractionBookId, taskSnapshot]);
  const selectedBookIndexView = useMemo(() => getBookIndexView(book, indexDiagnostics), [book?.id, book?.chunks, indexDiagnostics]);
  const aiSessionActions = createAppAiSessionActions({
    answer,
    appSettingsRef,
    aiAbortControllerRef,
    aiRequestIdRef,
    aiStoppedRef,
    aiStreamTokenBufferRef,
    aiStreamTokenFlushTimerRef,
    book,
    citations,
    cloudAiHistoryContextRef,
    extendedSettings,
    indexDiagnostics,
    lastAiModel,
    lastAiRequest,
    readerNoteLocation,
    selectedBookIndexView,
    setActivePage,
    setAiDiagnostics,
    setAiNoteToast,
    setAiSaveStatus,
    setAiStatus,
    setAiStopped,
    setAnswer,
    setCitations,
    setLastAiModel,
    setLastAiRequest,
    setLocalePreference,
    t,
  });
  const {
    discardAiStreamTokens,
    resetAiSessionForCurrentBookDataClear,
    retryAiGeneration,
    saveCitationAsExcerpt,
    saveCitationAsHighlight,
    saveCurrentAnswerAsNote,
    stopAiGeneration,
    summarizeBook,
  } = aiSessionActions;
  const currentTitle = pageTitles[activePage];
  const topbarTitleCompact = extendedSettings.pageTitleMode === 'compact';
  const topbarTitleText = activePage === 'reader' && !topbarTitleCompact ? `${book ? getPrivacyBookTitle(book.title, extendedSettings) : t('app.titleFallback')} · ${currentTitle.title}` : currentTitle.title;
  const topbarButtonVisible = extendedSettings.topbarButtonVisibility;
  const hideLibraryPanel = activePage === 'reader' && !readerLibraryPanelVisible;
  const effectiveNight = night || extendedSettings.appTheme === 'dark';
  const appShellClassName = [
    effectiveNight ? 'app-shell night' : 'app-shell',
    hideLibraryPanel ? 'library-panel-hidden' : '',
    sidebarCollapsed ? 'sidebar-collapsed' : '',
    extendedSettings.reduceMotion ? 'reduce-motion' : '',
    extendedSettings.highContrast ? 'high-contrast' : '',
    extendedSettings.enhancedFocus ? 'enhanced-focus' : '',
    extendedSettings.largeTouchTargets ? 'large-touch-targets' : '',
    extendedSettings.colorBlindFriendlyHighlights ? 'color-blind-highlights' : '',
  ].filter(Boolean).join(' ');
  const appWindowFrameClassName = [
    effectiveNight ? 'app-window-frame night' : 'app-window-frame',
    extendedSettings.reduceMotion ? 'reduce-motion' : '',
    extendedSettings.highContrast ? 'high-contrast' : '',
  ].filter(Boolean).join(' ');

  function setLatestTaskSnapshot(tasks: TaskStatus[]) {
    backgroundTaskPreviousSnapshotRef.current = tasks;
    setTaskSnapshot(tasks);
  }
  const standaloneReaderShellClassName = [
    effectiveNight ? 'standalone-reader-shell night' : 'standalone-reader-shell',
    moyuReader ? 'moyu-reader-shell' : '',
    extendedSettings.reduceMotion ? 'reduce-motion' : '',
    extendedSettings.highContrast ? 'high-contrast' : '',
    extendedSettings.enhancedFocus ? 'enhanced-focus' : '',
    extendedSettings.largeTouchTargets ? 'large-touch-targets' : '',
    extendedSettings.colorBlindFriendlyHighlights ? 'color-blind-highlights' : '',
  ].filter(Boolean).join(' ');
  const appThemeStyle = useMemo(() => buildAppThemeStyle(extendedSettings), [extendedSettings.customThemeColor]);

  function setLocalePreference(nextLocale: LocalePreference) {
    setLocalePreferenceState(nextLocale);
    saveStoredLocalePreference(nextLocale);
    dispatchSettingsUpdated({ key: 'localePreference', keys: ['localePreference'], scope: 'all', localePreference: nextLocale });
  }

  function setAppNightMode(nextNight: boolean) {
    saveExtendedSettings({ ...extendedSettings, appTheme: nextNight ? 'dark' : 'light' }, { key: 'appTheme' });
  }

  function toggleAppNightMode() {
    setAppNightMode(!effectiveNight);
  }

  function toggleSidebarCollapsed() {
    saveExtendedSettings({ ...extendedSettings, sidebarCollapsed: !sidebarCollapsed }, { key: 'sidebarCollapsed' });
  }

  function toggleReaderLibraryPanelVisible() {
    setReaderLibraryPanelVisible((value) => !value);
  }

  function reorderNavItems(draggedPage: AppPage, targetPage: AppPage) {
    if (draggedPage === targetPage) return;
    const currentOrder = visibleNavItems.map((item) => item.id);
    const draggedIndex = currentOrder.indexOf(draggedPage);
    const targetIndex = currentOrder.indexOf(targetPage);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const nextOrder = [...currentOrder];
    const [draggedItem] = nextOrder.splice(draggedIndex, 1);
    nextOrder.splice(targetIndex, 0, draggedItem);
    const visiblePageSet = new Set(extendedSettings.visibleNavItems);
    visiblePageSet.add('settings');
    const hiddenPages = extendedSettings.visibleNavItems.filter((page) => !nextOrder.includes(page));
    const nextVisibleNavItems = [...nextOrder.filter((page) => visiblePageSet.has(page)), ...hiddenPages];
    const saved = saveExtendedSettings({ ...extendedSettings, visibleNavItems: nextVisibleNavItems }, { key: 'visibleNavItems' });
    setExtendedSettings(saved);
  }

  function lockApplication() {
    if (!extendedSettings.appLockEnabled) return;
    setCommandPaletteOpen(false);
    setAppLocked(true);
  }

  function unlockApplication() {
    setAppLocked(false);
  }

  function updateCharacterGraphSessionState(patch: CharacterGraphSessionStatePatch) {
    setCharacterGraphSessionState((current) => {
      const next = mergeCharacterGraphSessionState(current, patch);
      rememberCharacterGraphSessionState(characterGraphSessionStateCacheRef.current, characterBookId, characterBookSignature, next);
      return next;
    });
  }

  async function selectAiModelForReader(providerId: string, model: string) {
    const selectedModel = model.trim();
    if (!selectedModel) return;
    const currentSettings = appSettingsRef.current ?? await loadAppSettings();
    const profiles = normalizeAiProviderProfilesForUi(currentSettings);
    const activeProfile = profiles.find((profile) => profile.id === providerId)
      ?? profiles.find((profile) => profile.id === currentSettings.aiActiveProviderProfileId)
      ?? profiles[0];
    const nextProfiles = activeProfile
      ? profiles.map((profile) => (
        profile.id === activeProfile.id ? mergeAiProviderProfileModels(profile, [selectedModel], selectedModel) : profile
      ))
      : profiles;
    const nextSettings = await saveAppSettings({
      ...currentSettings,
      aiModel: selectedModel,
      aiProviderProfiles: nextProfiles,
      aiActiveProviderProfileId: activeProfile?.id ?? currentSettings.aiActiveProviderProfileId,
    });
    appSettingsRef.current = nextSettings;
    dispatchSettingsUpdated({ key: 'aiModel', keys: ['aiModel', 'aiProviderProfiles', 'aiActiveProviderProfileId'], scope: 'app' });
  }

  async function toggleAiModelFavoriteForReader(providerId: string, model: string) {
    const modelId = model.trim();
    if (!modelId) return;
    const currentSettings = appSettingsRef.current ?? await loadAppSettings();
    const profiles = normalizeAiProviderProfilesForUi(currentSettings);
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== providerId) return profile;
      const currentConfig = getAiProviderModelConfig(profile, modelId);
      return {
        ...profile,
        modelSettings: {
          ...(profile.modelSettings ?? {}),
          [modelId]: normalizeAiProviderModelSettings(modelId, {
            ...currentConfig,
            favorite: !currentConfig.favorite,
          }),
        },
      };
    });
    const nextSettings = await saveAppSettings({
      ...currentSettings,
      aiProviderProfiles: nextProfiles,
    });
    appSettingsRef.current = nextSettings;
    dispatchSettingsUpdated({ key: 'aiProviderProfiles', keys: ['aiProviderProfiles'], scope: 'app' });
  }

  useEffect(() => {
    if (!characterBookId || !characterBookSignature) {
      setCharacterGraphSessionState(buildDefaultCharacterGraphSessionState());
      return;
    }
    const cachedState = getCachedCharacterGraphSessionState(characterGraphSessionStateCacheRef.current, characterBookId, characterBookSignature);
    setCharacterGraphSessionState(cachedState ?? buildDefaultCharacterGraphSessionState());
  }, [characterBookId, characterBookSignature]);

  useEffect(() => {
    if (standaloneReader) return;
    setActivePage((page) => resolveVisibleAppPage(page, extendedSettings.visibleNavItems, extendedSettings.booksOpenInStandaloneReader));
  }, [standaloneReader, extendedSettings.visibleNavItems, extendedSettings.booksOpenInStandaloneReader]);

  useEffect(() => {
    setReaderLibraryPanelVisible(extendedSettings.libraryPanelPersistent);
  }, [extendedSettings.libraryPanelPersistent]);

  const appStateValue = {
    extendedSettings, setExtendedSettings, chapterRules, setChapterRules,
    books, setBooks, selectedBookId, setSelectedBookId,
    activePage, setActivePage, night, setNight,
    sidebarCollapsed, setSidebarCollapsed,
    commandPaletteOpen, setCommandPaletteOpen,
    appLocked, setAppLocked,
    recentCommandIds, setRecentCommandIds,
    pendingReaderSearchResult, setPendingReaderSearchResult,
    readerIndexing, setReaderIndexing,
    characterBookId, setCharacterBookId,
    selectedCharacterWorkbenchView, setSelectedCharacterWorkbenchView,
    renderedCharacterWorkbenchView, setRenderedCharacterWorkbenchView,
    characterIndexingBookId, setCharacterIndexingBookId,
    characterExtractionBookId, setCharacterExtractionBookId,
    characterPayload, setCharacterPayload,
    characterOverviewSnapshot, setCharacterOverviewSnapshot,
    characterOverviewSnapshotLoadingBookId, setCharacterOverviewSnapshotLoadingBookId,
    characterBookSummariesFromBackend, setCharacterBookSummariesFromBackend,
    characterBookSummaries,
    taskSnapshot, setTaskSnapshot,
    indexDiagnostics, setIndexDiagnostics,
    unfinishedTaskSummary, setUnfinishedTaskSummary,
    backgroundTaskRunning, setBackgroundTaskRunning,
    restoreStartupReaderPosition, setRestoreStartupReaderPosition,
    libraryLoadError, setLibraryLoadError,
    importSummaryToast, setImportSummaryToast,
    aiNoteToast, setAiNoteToast,
    taskCompletionToast, setTaskCompletionToast,
    setAiStatus, setAiDiagnostics,
    setLatestTaskSnapshot: setTaskSnapshot,
  };

  useAppSettings(appStateValue, appSettingsRef, mainWindowGeometrySaveTimerRef, standaloneReader, discardAiStreamTokens);
  const { refreshCharacterPayload, refreshCharacterOverviewSnapshot, refreshCharacterBookSummaries } = useCharacterCenter(appStateValue);
  const taskContext = { extendedSettings, setActivePage, setLatestTaskSnapshot: setTaskSnapshot as (t: TaskStatus[]) => void, setBackgroundTaskRunning, refreshIndexDiagnostics: () => {}, refreshCharacterBookSummaries, refreshCharacterOverviewSnapshot, refreshCharacterPayload };
  const libraryActions = useLibrary(appStateValue, t, standaloneReader, standaloneBookId, book, selectedBookIndexView, indexDiagnostics, autoIndexOpenedBookKeysRef, readingProgressSaveTimersRef, taskContext as never);
  useTaskCenter(appStateValue, booksRef, backgroundTaskPreviousSnapshotRef, startupTaskResumeStartedRef, selectedBookId, aiDiagnostics, book, resetAiSessionForCurrentBookDataClear, refreshCharacterBookSummaries, refreshCharacterOverviewSnapshot, refreshCharacterPayload);
  useAppLock(appStateValue, appLockUnlockButtonRef);

  const handleDetachedReaderReturned = useCallback((bookId: string | null) => {
    if (bookId) setSelectedBookId(bookId);
    setDetachedReaderBookId(null);
    setRestoreStartupReaderPosition(true);
    setActivePage('reader');
  }, []);
  useAppWindowLifecycle({ standaloneReader, moyuReader, onDetachedReaderReturned: handleDetachedReaderReturned });

  const {
    updateBook, updateBookReadingProgress, importBook, scanDirectoryImportPreview, importDirectoryFileSelection,
    trashBook, restoreBook, deleteBookForever, clearTrash,
    openBook, openReaderFromSearch,
    chooseBookFile, chooseBookDirectory,
    runParseIndexFromReader,
  } = libraryActions;
  useGlobalShortcuts({
    standaloneReader,
    activePage,
    extendedSettings,
    appLocked,
    setCommandPaletteOpen,
    setActivePage,
    chooseBookFile,
    summarizeBook,
  });

  useEffect(() => {
    if (standaloneReader) return undefined;
    return subscribeLibraryRefreshRequests(() => {
      void loadLibraryBooks().then(setBooks).catch((error) => setLibraryLoadError(error instanceof Error ? error.message : String(error)));
    });
  }, [standaloneReader]);

  const openCharacters = (bookId?: string) => { setCharacterBookId(bookId ?? null); setPendingReaderSearchResult(null); setActivePage('characters'); };
  const openDirectoryImportPreview = (preview: DirectoryImportScanResult) => {
    setPendingDirectoryImportPreview(preview);
    setActivePage('library');
  };
  const chooseBookDirectoryWithPreview = async () => {
    const preview = await chooseBookDirectory();
    if (preview) openDirectoryImportPreview(preview);
  };
  const navigatePage = (page: AppPage) => {
    if (page === 'settings') {
      setSettingsHighlightTarget(undefined);
      setSettingsInitialGroup(undefined);
    }
    setActivePage(page);
  };
  const appTaskActionContext = { extendedSettings, setActivePage, setLatestTaskSnapshot: setTaskSnapshot as (t: TaskStatus[]) => void, setBackgroundTaskRunning, refreshIndexDiagnostics: () => {}, refreshCharacterBookSummaries, refreshCharacterOverviewSnapshot, refreshCharacterPayload };
  const runCharacterTextIndex = async (bookId: string) => { setCharacterIndexingBookId(bookId); try { await runCharacterTextIndexAction(bookId, appTaskActionContext as never); } finally { setCharacterIndexingBookId(null); } };
  const runCharacterExtraction = async (bookId: string) => { setCharacterExtractionBookId(bookId); try { await runCharacterExtractionAction(bookId, appTaskActionContext as never); } finally { setCharacterExtractionBookId(null); } };
  const runCommand = (commandId: CommandId) => {
    setRecentCommandIds((current) => saveRecentCommandIds(commandId, current));
    if (commandId.startsWith('open-settings-')) {
      const groupId = commandId.replace('open-settings-', '') as SettingsGroupId;
      setSettingsHighlightTarget(undefined);
      setSettingsInitialGroup(groupId);
      setActivePage('settings');
      return;
    }
    if (commandId.startsWith('go-')) {
      const page = commandId.replace('go-', '') as AppPage;
      if (page === 'settings') setSettingsInitialGroup(undefined);
      setActivePage(page);
      return;
    }
    if (commandId === 'open-command-palette') setCommandPaletteOpen(true);
    if (commandId === 'import-file') chooseBookFile();
    if (commandId === 'import-directory') void chooseBookDirectoryWithPreview();
    if (commandId === 'summarize-book') summarizeBook();
    if (commandId === 'toggle-night') toggleAppNightMode();
    if (commandId === 'toggle-sidebar') toggleSidebarCollapsed();
  };

  function renderPage() {
    if (activePage === 'overview') return <OverviewPage book={book} books={books} privacySettings={extendedSettings} startupOverviewMode={extendedSettings.startupOverviewMode} hideReaderEntry={extendedSettings.booksOpenInStandaloneReader} onOpenReader={() => setActivePage('reader')} onOpenBook={openBook} onImportBook={chooseBookFile} />;
    if (activePage === 'library') return <LibraryPage books={books} libraryLoadError={libraryLoadError} directoryImportPreview={pendingDirectoryImportPreview} onConsumeDirectoryImportPreview={() => setPendingDirectoryImportPreview(null)} onImportBook={importBook} onScanDirectoryImport={scanDirectoryImportPreview} onImportBookFiles={importDirectoryFileSelection} onChooseBookFile={chooseBookFile} onChooseBookDirectory={chooseBookDirectoryWithPreview} onUpdateBook={updateBook} onOpenBook={openBook} onOpenCharacters={openCharacters} onTrashBook={trashBook} onRestoreBook={restoreBook} onDeleteBookForever={deleteBookForever} onEmptyTrash={clearTrash} />;
    if (activePage === 'knowledge') return <KnowledgePage books={books} onOpenBook={openBook} />;
    if (activePage === 'characters') return (
      <CharactersPage
        bookSummaries={characterBookSummaries}
        currentBook={characterBookSummary}
        unavailableBookReason={characterBookUnavailableReason}
        indexDiagnostics={indexDiagnostics}
        characterPayload={selectedCharacterPayload}
        overviewSnapshot={selectedCharacterOverviewSnapshot}
        overviewSnapshotLoading={characterOverviewSnapshotLoadingBookId === characterBookId}
        selectedWorkbenchView={selectedCharacterWorkbenchView}
        renderedWorkbenchView={renderedCharacterWorkbenchView}
        characterGraphSessionState={characterGraphSessionState}
        onSelectWorkbenchView={setSelectedCharacterWorkbenchView}
        onRenderWorkbenchView={setRenderedCharacterWorkbenchView}
        onCharacterGraphSessionStateChange={updateCharacterGraphSessionState}
        privacySettings={extendedSettings}
        indexingBookId={characterIndexingBookId}
        characterExtractionBookId={activeCharacterExtractionBookId}
        onSelectBook={(bookId) => setCharacterBookId(bookId)}
        onOpenBook={openBook}
        onOpenLibrary={() => setActivePage('library')}
        onOpenTasks={() => setActivePage('tasks')}
        onRequestCharacterOverviewSnapshot={(bookId) => void refreshCharacterOverviewSnapshot(bookId)}
        onRequestCharacterPayload={(bookId) => void refreshCharacterPayload(bookId)}
        onRequestCharacterBookSummaries={refreshCharacterBookSummaries}
        onRunParseIndex={runCharacterTextIndex}
        onQueueCharacterExtraction={runCharacterExtraction}
        onOpenReaderEvidence={(detail) => openReaderFromSearch(detail.result)}
      />
    );
    if (activePage === 'search') return <SearchPage book={book} books={books} onOpenReader={openReaderFromSearch} />;
    if (activePage === 'tasks') return <TasksPage errorDetailsDefaultExpanded={extendedSettings.errorDetailsDefaultExpanded} onOpenTaskSettings={() => openSettingsGroup('tasks')} />;
    return <SettingsPage highlightTarget={settingsHighlightTarget} initialGroup={settingsInitialGroup} currentBookId={book?.id} currentBookTitle={book ? getPrivacyBookTitle(book.title, extendedSettings) : undefined} onOpenCurrentBookSettings={openCurrentBookSettings} onApplyPresetToCurrentBook={applyReaderPresetToCurrentBook} />;
  }

  const appLockOverlay = <AppLockOverlay locked={appLocked} unlockButtonRef={appLockUnlockButtonRef} labels={{ title: '应用已锁定', description: '当前窗口内容已被会话锁遮挡。此功能只保护屏幕可见内容，不等同主密码、磁盘加密或系统账户锁。', unlock: '解锁此会话' }} onUnlock={unlockApplication} />;

  function openSettingsGroup(group: SettingsGroupId) {
    setSettingsHighlightTarget(undefined);
    setSettingsInitialGroup(group);
    setActivePage('settings');
  }

  function openSettingsPage(target?: 'ai-api' | 'reader-memory-warning') {
    if (standaloneReader && isTauriRuntime()) {
      void (async () => {
        const mainWindow = await WebviewWindow.getByLabel('main');
        if (!mainWindow) return;
        await mainWindow.show().catch(() => undefined);
        await mainWindow.unminimize().catch(() => undefined);
        await mainWindow.setFocus().catch(() => undefined);
        await mainWindow.emit('bookmind:open-settings', { target }).catch(() => undefined);
      })();
      return;
    }
    setSettingsHighlightTarget(target);
    setSettingsInitialGroup(undefined);
    setActivePage('settings');
  }

  function openCurrentBookSettings() {
    if (!book) return;
    setSettingsHighlightTarget(undefined);
    setSettingsInitialGroup(undefined);
    setOpenReaderSettingsPanelRequest((value) => value + 1);
    setActivePage('reader');
  }

  function applyReaderPresetToCurrentBook(preset: ReaderCustomPreset) {
    if (!book) return;
    setSettingsHighlightTarget(undefined);
    setSettingsInitialGroup(undefined);
    setReaderPresetApplyRequest({ id: Date.now(), preset });
    setOpenReaderSettingsPanelRequest((value) => value + 1);
    setActivePage('reader');
  }

  if (moyuSettingsWindow) {
    return (
      <I18nContext.Provider value={i18nValue}>
        <LazyLoadBoundary resetKey="moyu-settings" errorLabel={t('common.loadFailed')} retryLabel={t('common.reload')}>
          <Suspense fallback={<AppPageLoadingFallback label={t('common.loading')} />}>
            <MoyuReaderSettingsWindow />
          </Suspense>
        </LazyLoadBoundary>
      </I18nContext.Provider>
    );
  }

  if (standaloneReader) {
    const standaloneReaderContent = (
      <main className={standaloneReaderShellClassName} style={appThemeStyle}>
        <ReaderWorkspace book={book} answer={answer} citations={citations} aiDiagnostics={aiDiagnostics} aiStatus={aiStatus} aiSaveStatus={aiSaveStatus} searchResult={pendingReaderSearchResult} onSearchResultConsumed={() => setPendingReaderSearchResult(null)} onAskAi={summarizeBook} onStopAi={stopAiGeneration} onRetryAi={retryAiGeneration} onSaveNote={saveCurrentAnswerAsNote} onSaveHighlight={saveCitationAsHighlight} onSaveExcerpt={saveCitationAsExcerpt} onReaderLocationChange={setReaderNoteLocation} onReadingProgressChange={updateBookReadingProgress} onOpenSettings={openSettingsPage} openSettingsRequest={openReaderSettingsPanelRequest} presetApplyRequest={readerPresetApplyRequest} appSettings={appSettingsRef.current} onSelectAiModel={selectAiModelForReader} onToggleAiModelFavorite={toggleAiModelFavoriteForReader} />
        {appLockOverlay}
      </main>
    );
    return (
      <AppStateContext.Provider value={appStateValue}>
      <I18nContext.Provider value={i18nValue}>
        {moyuReader ? standaloneReaderContent : (
          <AppWindowFrame className={appWindowFrameClassName} title={topbarTitleText} style={appThemeStyle}>
            {standaloneReaderContent}
          </AppWindowFrame>
        )}
      </I18nContext.Provider>
      </AppStateContext.Provider>
    );
  }

  return (
    <AppStateContext.Provider value={appStateValue}>
    <I18nContext.Provider value={i18nValue}>
      <AppWindowFrame className={appWindowFrameClassName} title={topbarTitleText} style={appThemeStyle}>
        <main className={appShellClassName} style={appThemeStyle}>
          <AppNotifications aiNote={aiNoteToast} taskCompletion={taskCompletionToast} importSummary={importSummaryToast} labels={{ viewNote: t('ai.viewNote'), openCharacterCenter: t('characters.toast.openCenter'), openTasks: '查看任务', openLibrary: '查看书库', close: t('common.cancel') }} onViewNote={(noteId) => { requestNoteView(noteId); setActivePage('knowledge'); setAiNoteToast(null); }} onOpenCharacters={(bookId) => { openCharacters(bookId); setTaskCompletionToast(null); }} onOpenTasks={() => { setActivePage('tasks'); setTaskCompletionToast(null); }} onOpenLibrary={(bookId) => { if (bookId) setSelectedBookId(bookId); setActivePage('library'); setImportSummaryToast(null); }} onDismissAiNote={() => setAiNoteToast(null)} onDismissTaskCompletion={() => setTaskCompletionToast(null)} onDismissImportSummary={() => setImportSummaryToast(null)} />
          {hideLibraryPanel ? null : (
            <LibraryPanel
              book={book}
              books={books}
              recentReaderBookId={recentReaderBookId}
              activePage={activePage}
              navItems={visibleNavItems}
              privacySettings={extendedSettings}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={toggleSidebarCollapsed}
              onNavigate={navigatePage}
              onOpenBook={openBook}
              onReorderNavItems={reorderNavItems}
            />
          )}
          <section className={activePage === 'reader' ? 'workspace reader-workspace-mode' : 'workspace'}>
            <AppTopbar activePage={activePage} compact={topbarTitleCompact} eyebrow={currentTitle.eyebrow} title={topbarTitleText} description={currentTitle.description} commandVisible={topbarButtonVisible.command} nightVisible={topbarButtonVisible.night} searchVisible={topbarButtonVisible.search} summaryVisible={topbarButtonVisible.aiSummary} lockVisible={extendedSettings.appLockEnabled} locked={appLocked} night={effectiveNight} labels={{ command: t('topbar.command'), day: t('topbar.dayRead'), night: t('topbar.nightRead'), search: t('common.search'), lock: '锁定', summary: t('topbar.aiSummary') }} onOpenCommand={() => setCommandPaletteOpen(true)} onToggleNight={toggleAppNightMode} onOpenSearch={() => setActivePage('search')} onLock={lockApplication} onSummarize={() => { void summarizeBook(); }} />
            {detachedReaderBookId ? null : <ReaderWorkspace book={book} availableBooks={books} hidden={activePage !== 'reader'} answer={answer} citations={citations} aiDiagnostics={aiDiagnostics} aiStatus={aiStatus} aiSaveStatus={aiSaveStatus} searchResult={pendingReaderSearchResult} onSearchResultConsumed={() => setPendingReaderSearchResult(null)} onAskAi={summarizeBook} onStopAi={stopAiGeneration} onRetryAi={retryAiGeneration} onSaveNote={saveCurrentAnswerAsNote} onSaveHighlight={saveCitationAsHighlight} onSaveExcerpt={saveCitationAsExcerpt} onReaderLocationChange={setReaderNoteLocation} onReadingProgressChange={updateBookReadingProgress} onChooseBookFile={chooseBookFile} onOpenLibrary={() => setActivePage('library')} onOpenTasks={() => setActivePage('tasks')} onOpenCharacters={openCharacters} onOpenRecentBook={openBook} onRunParseIndex={runParseIndexFromReader} onOpenSettings={openSettingsPage} openSettingsRequest={openReaderSettingsPanelRequest} presetApplyRequest={readerPresetApplyRequest} readerIndexing={readerIndexing} restoreStartupReaderPosition={restoreStartupReaderPosition} appSettings={appSettingsRef.current} onSelectAiModel={selectAiModelForReader} onToggleAiModelFavorite={toggleAiModelFavoriteForReader} onDetachedReaderWindowOpen={setDetachedReaderBookId} libraryPanelVisible={readerLibraryPanelVisible} onToggleLibraryPanel={toggleReaderLibraryPanelVisible} />}
            {activePage === 'reader' ? null : (
              <LazyLoadBoundary resetKey={activePage} errorLabel={t('common.loadFailed')} retryLabel={t('common.reload')}>
                <Suspense fallback={<AppPageLoadingFallback label={t('common.loading')} />}>
                  {renderPage()}
                </Suspense>
              </LazyLoadBoundary>
            )}
          </section>
          <CommandPalette commands={appCommands} open={!appLocked && commandPaletteOpen} commandPaletteShortcut={formatCommandPaletteShortcut(extendedSettings.commandPaletteShortcut)} commandPaletteShowDescriptions={extendedSettings.commandPaletteShowDescriptions} commandPaletteSortMode={extendedSettings.commandPaletteSortMode} recentCommandIds={recentCommandIds} onClose={() => setCommandPaletteOpen(false)} onRun={runCommand} />
          {appLockOverlay}
          {confirmDialog}
        </main>
      </AppWindowFrame>
    </I18nContext.Provider>
    </AppStateContext.Provider>
  );
}

function AppPageLoadingFallback({ label }: { label: string }) {
  return (
    <div className="app-page-loading" role="status" aria-live="polite">
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  );
}

type WindowSessionItem = {
  label: string;
  title: string;
  kind: 'main' | 'reader' | 'moyu' | 'other';
  current: boolean;
  focused: boolean;
  alwaysOnTop: boolean;
  fullscreen: boolean;
};

const BOOKMIND_REPOSITORY_URL = 'https://github.com/fenda1-1/BookMind';
const BOOKMIND_ISSUES_URL = `${BOOKMIND_REPOSITORY_URL}/issues/new`;
const BOOKMIND_RELEASES_URL = `${BOOKMIND_REPOSITORY_URL}/releases`;

function classifyWindowSessionLabel(label: string): WindowSessionItem['kind'] {
  if (label === 'main') return 'main';
  if (label.startsWith('reader-')) return 'reader';
  if (label.startsWith('moyu-reader')) return 'moyu';
  return 'other';
}

function AppWindowFrame({ children, className, style, title }: { children: ReactNode; className: string; style: CSSProperties; title: string }) {
  const { t } = useI18n();
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowFullscreen, setWindowFullscreen] = useState(false);
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [windowSessionsOpen, setWindowSessionsOpen] = useState(false);
  const [windowSessions, setWindowSessions] = useState<WindowSessionItem[]>([]);
  const [windowSessionsLoading, setWindowSessionsLoading] = useState(false);
  const windowSessionsRef = useRef<HTMLDivElement | null>(null);
  const syncWindowFrameState = useCallback(() => {
    if (!isTauriRuntime()) {
      setWindowMaximized(false);
      setWindowFullscreen(false);
      setWindowAlwaysOnTop(false);
      return;
    }
    const currentWindow = getCurrentWindow();
    void Promise.all([currentWindow.isMaximized(), currentWindow.isFullscreen(), currentWindow.isAlwaysOnTop()])
      .then(([maximized, fullscreen, alwaysOnTop]) => {
        setWindowMaximized(maximized);
        setWindowFullscreen(fullscreen);
        setWindowAlwaysOnTop(alwaysOnTop);
      })
      .catch(() => {
        setWindowMaximized(false);
        setWindowFullscreen(false);
        setWindowAlwaysOnTop(false);
      });
  }, []);

  const refreshWindowSessions = useCallback(async () => {
    if (!isTauriRuntime()) {
      setWindowSessions([]);
      return;
    }
    setWindowSessionsLoading(true);
    try {
      const current = WebviewWindow.getCurrent();
      const windows = await WebviewWindow.getAll();
      const items = await Promise.all(windows.map(async (item) => {
        const [itemTitle, focused, alwaysOnTop, fullscreen] = await Promise.all([
          item.title().catch(() => item.label),
          item.isFocused().catch(() => false),
          item.isAlwaysOnTop().catch(() => false),
          item.isFullscreen().catch(() => false),
        ]);
        return {
          label: item.label,
          title: itemTitle || item.label,
          kind: classifyWindowSessionLabel(item.label),
          current: item.label === current.label,
          focused,
          alwaysOnTop,
          fullscreen,
        } satisfies WindowSessionItem;
      }));
      items.sort((left, right) => {
        if (left.current !== right.current) return left.current ? -1 : 1;
        const order = { main: 0, reader: 1, moyu: 2, other: 3 } as const;
        return order[left.kind] - order[right.kind] || left.title.localeCompare(right.title);
      });
      setWindowSessions(items);
    } catch {
      setWindowSessions([]);
    } finally {
      setWindowSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    const currentWindow = getCurrentWindow();
    syncWindowFrameState();
    const resized = currentWindow.onResized(syncWindowFrameState);
    return () => {
      resized.then((dispose) => dispose()).catch(() => {});
    };
  }, [syncWindowFrameState]);

  useEffect(() => {
    function onWindowFrameKeyDown(event: KeyboardEvent) {
      if (event.key !== 'F11') return;
      event.preventDefault();
      if (!isTauriRuntime()) return;
      const currentWindow = getCurrentWindow();
      void toggleCurrentWindowFullscreen(currentWindow)
        .then(syncWindowFrameState)
        .catch(() => undefined);
    }
    window.addEventListener('keydown', onWindowFrameKeyDown);
    return () => window.removeEventListener('keydown', onWindowFrameKeyDown);
  }, [syncWindowFrameState]);

  useEffect(() => {
    if (!appInfoOpen && !windowSessionsOpen) return undefined;
    if (windowSessionsOpen) void refreshWindowSessions();
    const timer = windowSessionsOpen ? window.setInterval(() => { void refreshWindowSessions(); }, 2500) : undefined;
    function onPointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.app-window-session-menu, .app-window-session-btn, .app-window-info-panel, .app-window-info-btn')) {
        setWindowSessionsOpen(false);
        setAppInfoOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWindowSessionsOpen(false);
        setAppInfoOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [appInfoOpen, windowSessionsOpen, refreshWindowSessions]);

  async function runWindowFrameAction(action: 'minimize' | 'maximize' | 'close') {
    await handleWindowFrameAction(action);
    if (action === 'maximize') window.setTimeout(() => {
      syncWindowFrameState();
      emitWindowFrameGeometryChanged();
    }, 80);
  }

  async function focusWindowSession(label: string) {
    if (!isTauriRuntime()) return;
    const target = await WebviewWindow.getByLabel(label);
    if (!target) return;
    await target.show().catch(() => undefined);
    await target.unminimize().catch(() => undefined);
    await target.setFocus().catch(() => undefined);
    setWindowSessionsOpen(false);
    void refreshWindowSessions();
  }

  async function closeWindowSession(label: string) {
    if (!isTauriRuntime()) return;
    const target = await WebviewWindow.getByLabel(label);
    if (!target) return;
    await target.close().catch(() => undefined);
    void refreshWindowSessions();
  }

  async function toggleCurrentAlwaysOnTop() {
    if (!isTauriRuntime()) return;
    const current = getCurrentWindow();
    const next = !(await current.isAlwaysOnTop());
    await current.setAlwaysOnTop(next);
    syncWindowFrameState();
    void refreshWindowSessions();
  }

  function sessionKindLabel(kind: WindowSessionItem['kind']) {
    if (kind === 'main') return t('topbar.windowSessions.main');
    if (kind === 'reader') return t('topbar.windowSessions.reader');
    if (kind === 'moyu') return t('topbar.windowSessions.moyu');
    return t('topbar.windowSessions.other');
  }

  function openAppInfoUrl(url: string) {
    setAppInfoOpen(false);
    void openExternalUrl(url).catch(() => undefined);
  }

  function copyAppVersion() {
    void navigator.clipboard?.writeText(`BookMind ${__BOOKMIND_VERSION__}`);
  }

  return (
    <div className={windowFullscreen ? `${className} fullscreen` : className} style={style}>
      <header className="app-window-titlebar" data-tauri-drag-region onDoubleClick={() => void runWindowFrameAction('maximize')}>
        <div className="app-window-title" data-tauri-drag-region>
          <span className="app-window-brand" aria-hidden="true">B</span>
          <span>BookMind</span>
          <em>{title}</em>
        </div>
        <div className="app-window-titlebar-actions">
          <div className="app-window-info">
            <button
              type="button"
              className={appInfoOpen ? 'app-window-info-btn active' : 'app-window-info-btn'}
              aria-label={t('topbar.appInfo.open')}
              aria-expanded={appInfoOpen}
              aria-haspopup="dialog"
              title={t('topbar.appInfo.open')}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={() => {
                setWindowSessionsOpen(false);
                setAppInfoOpen((value) => !value);
              }}
            >
              <span className="app-window-info-glyph" aria-hidden="true">i</span>
            </button>
            {appInfoOpen ? (
              <div className="app-window-info-panel" role="dialog" aria-label={t('topbar.appInfo.title')}>
                <header>
                  <strong>{t('topbar.appInfo.title')}</strong>
                  <button type="button" className="app-window-info-close" aria-label={t('common.cancel')} title={t('common.cancel')} onClick={() => setAppInfoOpen(false)}>&times;</button>
                </header>
                <dl>
                  <div>
                    <dt>{t('topbar.appInfo.version')}</dt>
                    <dd>v{__BOOKMIND_VERSION__}</dd>
                  </div>
                  <div>
                    <dt>{t('topbar.appInfo.repository')}</dt>
                    <dd>{BOOKMIND_REPOSITORY_URL.replace('https://', '')}</dd>
                  </div>
                </dl>
                <div className="app-window-info-actions">
                  <button type="button" className="ghost-btn small" onClick={() => openAppInfoUrl(BOOKMIND_REPOSITORY_URL)}>{t('topbar.appInfo.openRepository')}</button>
                  <button type="button" className="ghost-btn small" onClick={() => openAppInfoUrl(BOOKMIND_ISSUES_URL)}>{t('topbar.appInfo.submitIssue')}</button>
                  <button type="button" className="ghost-btn small" onClick={() => openAppInfoUrl(BOOKMIND_RELEASES_URL)}>{t('topbar.appInfo.checkUpdates')}</button>
                  <button type="button" className="ghost-btn small" onClick={copyAppVersion}>{t('topbar.appInfo.copyVersion')}</button>
                </div>
              </div>
            ) : null}
          </div>
          {isTauriRuntime() ? (
            <div className="app-window-session" ref={windowSessionsRef}>
              <button
                type="button"
                className={windowSessionsOpen ? 'app-window-session-btn active' : 'app-window-session-btn'}
                aria-label={t('topbar.windowSessions.open')}
                aria-expanded={windowSessionsOpen}
                title={t('topbar.windowSessions.open')}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onClick={() => {
                  setAppInfoOpen(false);
                  setWindowSessionsOpen((value) => !value);
                }}
              >
                <span className="app-window-session-glyph" aria-hidden="true" />
                <em>{t('topbar.windowSessions')}</em>
                <strong>{windowSessions.length || '·'}</strong>
              </button>
              {windowSessionsOpen ? (
                <div className="app-window-session-menu" role="dialog" aria-label={t('topbar.windowSessions')}>
                  <header>
                    <div>
                      <strong>{t('topbar.windowSessions')}</strong>
                      <span>{t('topbar.windowSessions.count', { count: windowSessions.length })}</span>
                    </div>
                    <button type="button" className="ghost-btn small" onClick={() => { void refreshWindowSessions(); }}>{windowSessionsLoading ? '…' : t('topbar.windowSessions.refresh')}</button>
                  </header>
                  <div className="app-window-session-current-tools">
                    <button type="button" className="ghost-btn small" onClick={() => { void toggleCurrentWindowFullscreen().then(syncWindowFrameState).then(() => refreshWindowSessions()); }}>
                      {windowFullscreen ? t('topbar.windowSessions.exitFullscreen') : t('topbar.windowSessions.fullscreen')}
                    </button>
                    <button type="button" className="ghost-btn small" onClick={() => { void toggleCurrentAlwaysOnTop(); }}>
                      {windowAlwaysOnTop ? t('topbar.windowSessions.exitAlwaysOnTop') : t('topbar.windowSessions.alwaysOnTop')}
                    </button>
                  </div>
                  <div className="app-window-session-list">
                    {windowSessions.length === 0 ? <p>{t('topbar.windowSessions.empty')}</p> : null}
                    {windowSessions.map((session) => (
                      <article key={session.label} className={session.current ? 'current' : undefined}>
                        <div>
                          <strong>{session.title}</strong>
                          <span>
                            {sessionKindLabel(session.kind)}
                            {session.current ? ` · ${t('topbar.windowSessions.current')}` : ''}
                            {session.focused ? ' · focus' : ''}
                          </span>
                        </div>
                        <div className="app-window-session-actions">
                          <button type="button" className="ghost-btn small" onClick={() => { void focusWindowSession(session.label); }}>{t('topbar.windowSessions.focus')}</button>
                          {session.kind !== 'main' ? <button type="button" className="ghost-btn small danger" onClick={() => { void closeWindowSession(session.label); }}>{t('topbar.windowSessions.close')}</button> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="app-window-controls" aria-label="Window controls">
            <WindowControlButton action="minimize" label="Minimize" onAction={runWindowFrameAction} />
            <WindowControlButton action="maximize" label={windowMaximized ? 'Restore' : 'Maximize'} glyph={windowMaximized ? 'restore' : 'maximize'} onAction={runWindowFrameAction} />
            <WindowControlButton action="close" label="Close" onAction={runWindowFrameAction} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

async function toggleCurrentWindowFullscreen(currentWindow = getCurrentWindow()) {
  const fullscreen = await currentWindow.isFullscreen();
  await currentWindow.setFullscreen(!fullscreen);
  if (fullscreen) return;
  const monitor = await currentMonitor();
  if (!monitor) return;
  await currentWindow.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
  await currentWindow.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
}

function WindowControlButton({ action, label, glyph = action, onAction }: { action: 'minimize' | 'maximize' | 'close'; label: string; glyph?: 'minimize' | 'maximize' | 'restore' | 'close'; onAction: (action: 'minimize' | 'maximize' | 'close') => void | Promise<void> }) {
  return (
    <button
      className={action === 'close' ? 'window-control-btn close' : 'window-control-btn'}
      type="button"
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={() => void onAction(action)}
    >
      <span className={`window-control-glyph ${glyph}`} aria-hidden="true" />
    </button>
  );
}

async function handleWindowFrameAction(action: 'minimize' | 'maximize' | 'close') {
  if (!isTauriRuntime()) return;
  const currentWindow = getCurrentWindow();
  if (action === 'minimize') {
    await currentWindow.minimize();
    return;
  }
  if (action === 'maximize') {
    await currentWindow.toggleMaximize();
    return;
  }
  await currentWindow.close();
}

function markCharacterPerformance(name: string) {
  if (import.meta.env.PROD || typeof performance === 'undefined') return;
  performance.mark(`bookmind:characters:${name}`);
}

function buildCustomTerminologyRules(value: string): CustomTerminologyRule[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)(?:=>|->|：|:)(.+)$/);
      if (!match) return null;
      const source = match[1].trim();
      const target = match[2].trim();
      return source && target && source !== target ? { source, target } : null;
    })
    .filter((rule): rule is CustomTerminologyRule => Boolean(rule))
    .slice(0, 80);
}

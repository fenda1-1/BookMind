import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { parseBoundedInteger } from '../app/appShellModel';
import { ReaderPage } from '../features/reader-core/ReaderPage';
import { createReaderHistoryStack, createReaderTocEdit, findReaderLocationForCitation, findVisibleChapterIndexByOriginalIndex, repairReaderTocEdits } from '../features/reader-core/readerModel';
import { defaultReaderSettings, normalizeReaderSettings, readerPresetSettings, saveGlobalReaderSettings, subscribeReaderApplySettingsNow, type ReaderCustomPreset } from '../features/reader-core/readerSettings';
import { getPrivacyBookTitle, saveExtendedSettings, type ChapterRuleDraft, type ExtendedSettings } from '../services/settingsCenterService';
import { forgetAgentReaderBookSnapshot, rememberAgentReaderBookSnapshot } from '../services/agentReaderContextStore';
import { emitReaderFlashLocation } from '../services/appDomainEvents';
import { recordLifecycleDiagnostic } from '../services/lifecycleDiagnosticsService';
import { subscribeAiCitationRepair, subscribeAiProtocolJump } from '../features/ai-reader/aiReaderDomainEvents';
import type { ReaderChapter, ReaderTocEdit } from '../features/reader-core/readerModel';
import { useI18n } from '../i18n';
import type { AiAskRequest, AiDiagnostics, AppSettings, Book, Citation, ReaderNoteLocation, ReaderPreset, ReaderSettings, ReaderSettingsLevel, SearchResult } from '../types';
import { createReaderWorkspaceAnnotationActions } from './readerWorkspaceAnnotationActions';
import { createReaderWorkspaceDataActions } from './readerWorkspaceDataActions';
import { requestAppConfirm } from '../components/useAppConfirm';
import { createReaderCommandHandlers } from './reader-workspace/ReaderCommandHandlers';
import { buildReaderPanelContent, getReaderPanelDemoContext } from './reader-workspace/ReaderPanelContentBuilder';
import { buildReaderPageProps } from './reader-workspace/ReaderPagePropsBuilder';
import { ReaderRightPanelSessionBar } from '../features/reader-core/ReaderRightPanelSessionBar';
import { ReaderSidePanels } from './reader-workspace/ReaderSidePanels';
import { useReaderTopBarController } from './reader-workspace/ReaderTopBar';
import { useReaderWorkspaceDocument } from './reader-workspace/useReaderWorkspaceDocument';
import { useReaderWorkspacePersistence } from './reader-workspace/useReaderWorkspacePersistence';
import type { AiExternalPromptRequest } from '../features/ai-reader/AiReaderPanel';
import { useReaderWorkspaceState } from './reader-workspace/useReaderWorkspaceState';
import { resolveReaderSessionMode } from './reader-workspace/readerSessionLifecycle';
import { ReaderExternalView, resolveReaderExternalViewKind } from './reader-workspace/ReaderExternalView';
import {
  createTocEditHistoryEntry,
  createTocEditHistoryFromEdits,
  describeTocEdit,
  getReaderLocationFailureMessage,
  matchesReaderWorkspaceShortcut,
} from './readerWorkspaceModel';

type ReaderWorkspaceProps = {
  book: Book | null;
  availableBooks?: Book[];
  hidden?: boolean;
  answer: string;
  citations: Citation[];
  aiDiagnostics?: AiDiagnostics | null;
  aiStatus: 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';
  aiSaveStatus: string;
  searchResult: SearchResult | null;
  onSearchResultConsumed: () => void;
  onAskAi: (request: AiAskRequest | string, scope?: string) => void;
  onStopAi: () => void;
  onRetryAi: (request?: AiAskRequest) => void;
  onSaveNote: () => Promise<void>;
  onSaveHighlight: (citation: Citation) => Promise<void>;
  onSaveExcerpt: (citation: Citation) => Promise<void>;
  onReaderLocationChange: (location: ReaderNoteLocation | null) => void;
  onReadingProgressChange?: (bookId: string, progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
  onChooseBookFile?: () => void;
  onOpenLibrary?: () => void;
  onOpenTasks?: () => void;
  onOpenCharacters?: (bookId: string) => void;
  onOpenRecentBook?: (bookId: string) => void;
  onRunParseIndex?: () => void;
  onOpenSettings?: (target?: 'ai-api' | 'reader-memory-warning') => void;
  openSettingsRequest?: number;
  presetApplyRequest?: { id: number; preset: ReaderCustomPreset } | null;
  readerIndexing?: boolean;
  restoreStartupReaderPosition?: boolean;
  appSettings?: AppSettings | null;
  onSelectAiModel?: (providerId: string, model: string) => Promise<void> | void;
  onToggleAiModelFavorite?: (providerId: string, model: string) => Promise<void> | void;
  onDetachedReaderWindowOpen?: (bookId: string) => void;
  libraryPanelVisible?: boolean;
  onToggleLibraryPanel?: () => void;
};



export type ReaderPanelId = 'ai' | 'settings' | 'rules';
export type ReaderPanelPlacement = 'floating' | 'sidebar';

export function ReaderWorkspace({ book, availableBooks = [], hidden = false, answer, citations, aiDiagnostics, aiStatus, aiSaveStatus, searchResult, onSearchResultConsumed, onAskAi, onStopAi, onRetryAi, onSaveNote, onSaveHighlight, onSaveExcerpt, onReaderLocationChange, onReadingProgressChange, onChooseBookFile, onOpenLibrary, onOpenTasks, onOpenCharacters, onOpenRecentBook, onRunParseIndex, onOpenSettings, openSettingsRequest = 0, presetApplyRequest = null, readerIndexing = false, restoreStartupReaderPosition = true, appSettings = null, onSelectAiModel, onToggleAiModelFavorite, onDetachedReaderWindowOpen, libraryPanelVisible = true, onToggleLibraryPanel }: ReaderWorkspaceProps) {
  const { t } = useI18n();
  const standaloneReader = useMemo(() => new URLSearchParams(window.location.search).get('readerWindow') === '1', []);
  const moyuReader = useMemo(() => new URLSearchParams(window.location.search).get('moyu') === '1', []);
  const detachedFromMain = useMemo(() => new URLSearchParams(window.location.search).get('detached') === '1', []);
  const readerSessionMode = useMemo(() => resolveReaderSessionMode({ standaloneReader, detachedFromMain }), [standaloneReader, detachedFromMain]);
  const {
    initialReaderState, readerDocument, setReaderDocument, readerDocumentError, setReaderDocumentError,
    extendedSettings, setExtendedSettings, chapterRules, setChapterRules, settings, setSettings, previewSettings, setPreviewSettings,
    activeChapterIndex, setActiveChapterIndex, activeParagraphIndex, setActiveParagraphIndex, activeScreenPage, setActiveScreenPage,
    activeScreenPageCount, setActiveScreenPageCount, effectivePageWidth, setEffectivePageWidth, aiCollapsed, setAiCollapsed,
    overlayPanelWidth, setOverlayPanelWidth, tocOpen, setTocOpen, settingsLevel, setSettingsLevel, readerReady, setReaderReady,
    windowState, setWindowState, readerWindowSyncStatus, setReaderWindowSyncStatus, highlights, setHighlights, bookmarks, setBookmarks,
    defaultHighlightColor, setDefaultHighlightColor, tocEdits, setTocEdits, tocManifest, setTocManifest, tocManifestLoaded,
    setTocManifestLoaded, bookChapterRulesOverride, setBookChapterRulesOverride, bookChapterRulesOverrideLoaded,
    setBookChapterRulesOverrideLoaded, tocEditUndoStack, setTocEditUndoStack, tocEditRedoStack, setTocEditRedoStack,
    tocEditHistory, setTocEditHistory, readerHistoryStack, setReaderHistoryStack, readerStorageError, setReaderStorageError,
    readerDocumentModel, setReaderDocumentModel,
  } = useReaderWorkspaceState(book, standaloneReader);
  const geometrySaveTimerRef = useRef<number | null>(null);
  const overlayPanelWidthDragRef = useRef<{ startX: number; startWidth: number; frame: number | null; nextWidth: number } | null>(null);
  const readerPanelDockDragRef = useRef<{ panel: ReaderPanelId; pointerId: number; startX: number; frame: number | null; nextPlacement: ReaderPanelPlacement } | null>(null);
  const previousReaderSettingsRef = useRef<ReaderSettings | null>(null);
  const aiExternalPromptSequenceRef = useRef(0);
  const readerReadyPerformanceKeyRef = useRef('');
  const readerOpenStartedAtRef = useRef(performance.now());
  const [aiExternalPromptRequest, setAiExternalPromptRequest] = useState<AiExternalPromptRequest | null>(null);
  const [aiSelectionText, setAiSelectionText] = useState('');
  useEffect(() => {
    if (!book) return;
    readerOpenStartedAtRef.current = performance.now();
    readerReadyPerformanceKeyRef.current = '';
    recordLifecycleDiagnostic('reader-session', 'reader-session.opened', {
      bookId: book.id,
      mode: readerSessionMode,
      format: book.format,
    });
    return () => {
      recordLifecycleDiagnostic('reader-session', 'reader-session.closed', {
        bookId: book.id,
        mode: readerSessionMode,
      });
    };
  }, [book?.id, readerSessionMode]);

  useEffect(() => {
    if (!book) return;
    recordLifecycleDiagnostic('reader-session', hidden ? 'reader-session.hidden' : 'reader-session.visible', {
      bookId: book.id,
      mode: readerSessionMode,
    });
  }, [book?.id, hidden, readerSessionMode]);
  const readerTopBar = useReaderTopBarController({
    bookId: book?.id,
    openSettingsRequest,
    presetApplyRequest,
    initialPanelPlacements: initialReaderState?.panelPlacements,
    applyReaderPresetSettings: applyReaderSettings,
  });
  const {
    readerBook,
    chapters,
    sourceChapters,
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
  } = useReaderWorkspaceDocument({
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
    activeChapterIndex,
    setActiveChapterIndex,
    activeParagraphIndex,
    setActiveParagraphIndex,
    activeScreenPage,
    setActiveScreenPage,
    aiCollapsed,
    setAiCollapsed,
    tocOpen,
    setTocOpen,
    settingsLevel,
    setSettingsLevel,
    setReaderPanelPlacements: readerTopBar.setReaderPanelPlacements,
    setReaderReady,
    highlights,
    setHighlights,
    bookmarks,
    setBookmarks,
    defaultHighlightColor,
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
  });

  useEffect(() => {
    if (!book || hidden || !readerReady || isReaderDocumentLoading) return;
    const readyKey = `${book.id}:${book.contentHash}`;
    if (readerReadyPerformanceKeyRef.current === readyKey) return;
    readerReadyPerformanceKeyRef.current = readyKey;
    const durationMs = Math.round(performance.now() - readerOpenStartedAtRef.current);
    performance.mark('bookmind:reader-ready', { detail: { bookId: book.id, durationMs } });
    recordLifecycleDiagnostic('performance', 'reader.ready', { bookId: book.id, durationMs, format: book.format });
  }, [book?.id, book?.contentHash, book?.format, hidden, readerReady, isReaderDocumentLoading]);

  const safeChapterIndex = chapters.length
    ? Math.min(activeChapterIndex, chapters.length - 1)
    : Math.max(0, activeChapterIndex);
  const {
    readerStateSaveTimerRef,
    readerWindowSyncTimerRef,
    markReaderStateChanged,
    persistReaderState,
    emitReaderWindowState,
  } = useReaderWorkspacePersistence({
    book,
    extendedSettings,
    settings,
    highlights,
    bookmarks,
    defaultHighlightColor,
    tocEdits,
    safeChapterIndex,
    activeParagraphIndex,
    activeScreenPage,
    aiCollapsed,
    tocOpen,
    settingsLevel,
    panelPlacements: readerTopBar.panelPlacements,
    stateKey,
    highlightsKey,
    bookmarksKey,
    highlightColorKey,
    tocEditsKey,
    chapters,
    standaloneReader,
    moyuReader,
    hidden,
    restoringRef,
    setReaderStorageError,
    setReaderWindowSyncStatus,
    setSettings,
    setActiveChapterIndex,
    setActiveParagraphIndex,
    setActiveScreenPage,
    setActiveScreenPageCount,
    setAiCollapsed,
    setTocOpen,
    setSettingsLevel,
    setReaderPanelPlacements: readerTopBar.setReaderPanelPlacements,
    setHighlights,
    setBookmarks,
    setDefaultHighlightColor,
    setTocEdits,
    setBookChapterRulesOverride,
    setBookChapterRulesOverrideLoaded,
    setTocEditUndoStack,
    setTocEditRedoStack,
    setTocEditHistory,
    setReaderHistoryStack,
    onReaderLocationChange,
    t,
  });
  const activeChapter = chapters[safeChapterIndex] ?? null;
  const [visibleReaderPageText, setVisibleReaderPageText] = useState('');
  const aiReaderContext = useMemo(() => {
    const chapterText = activeChapter?.paragraphs.join('\n') ?? '';
    const pageText = visibleReaderPageText.trim() ? visibleReaderPageText : buildFallbackReaderPageText(activeChapter, activeParagraphIndex);
    const privacyChapterTitle = getPrivacyBookTitle(activeChapter?.title ?? '', extendedSettings) || '当前章节';
    if (!book) return getReaderPanelDemoContext();
    return {
      bookId: book?.id,
      chapterTitle: privacyChapterTitle,
      chapterText,
      pageText,
      selectionText: aiSelectionText,
      paragraphIndex: activeParagraphIndex,
    };
  }, [book?.id, activeChapter, activeParagraphIndex, visibleReaderPageText, aiSelectionText, extendedSettings.applicationPrivacyMode, extendedSettings.hideBookTitlesInPrivacyMode]);

  useEffect(() => {
    setAiSelectionText('');
    setAiExternalPromptRequest(null);
  }, [book?.id]);

  useEffect(() => {
    if (hidden && !standaloneReader) {
      if (book?.id) forgetAgentReaderBookSnapshot(book.id);
      return;
    }
    rememberAgentReaderBookSnapshot({ book, chapters });
    return () => {
      if (book?.id) forgetAgentReaderBookSnapshot(book.id);
    };
  }, [book?.id, book?.contentHash, chapters, hidden, standaloneReader]);

  useEffect(() => {
    function onReaderWorkspaceKeyDown(event: KeyboardEvent) {
      if (!matchesReaderWorkspaceShortcut(event, extendedSettings.readerShortcuts.aiPanel)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      event.preventDefault();
      readerTopBar.toggleReaderAiPanel();
    }
    window.addEventListener('keydown', onReaderWorkspaceKeyDown);
    return () => window.removeEventListener('keydown', onReaderWorkspaceKeyDown);
  }, [extendedSettings.readerShortcuts.aiPanel, readerTopBar.toggleReaderAiPanel]);

  function updateSetting<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
    markReaderStateChanged();
    setPreviewSettings(null);
    setSettings((current) => {
      if (current[key] === value) return current;
      previousReaderSettingsRef.current = current;
      return saveGlobalReaderSettings({ ...current, [key]: value, preset: key === 'preset' ? value as ReaderPreset : 'custom' }, { changedKeys: [key] });
    });
  }

  function applyReaderPreset(preset: ReaderPreset) {
    if (preset === 'custom') {
      updateSetting('preset', 'custom');
      return;
    }
    applyReaderSettings({ ...settings, ...readerPresetSettings[preset], preset });
  }

  function applyReaderSettings(nextSettings: ReaderSettings) {
    markReaderStateChanged();
    setPreviewSettings(null);
    setSettings((current) => {
      previousReaderSettingsRef.current = current;
      return saveGlobalReaderSettings(normalizeReaderSettings(nextSettings));
    });
  }

  useEffect(() => {
    const unsubscribe = subscribeReaderApplySettingsNow((event) => {
      const detail = detailToReaderSettings(event);
      if (!detail) return;
      markReaderStateChanged();
      setPreviewSettings(null);
      setSettings(saveGlobalReaderSettings(normalizeReaderSettings(detail)));
    });
    return unsubscribe;
  }, [markReaderStateChanged]);

  function restoreDefaultReaderSettings() {
    applyReaderSettings(defaultReaderSettings);
  }

  function undoReaderSettingsChange() {
    const previous = previousReaderSettingsRef.current;
    if (!previous) return;
    previousReaderSettingsRef.current = settings;
    setSettings(saveGlobalReaderSettings(previous));
  }

  function saveCurrentReaderSettingsAsGlobalDefault() {
    saveGlobalReaderSettings(settings);
  }

  const readerDataActions = createReaderWorkspaceDataActions({
    book,
    readerBook,
    chapters,
    sourceChapters,
    hiddenChapters,
    highlights,
    bookmarks,
    tocEdits,
    citations,
    settings,
    settingsLevel,
    chapterRules,
    extendedSettings,
    safeChapterIndex,
    activeParagraphIndex,
    activeScreenPage,
    activeScreenPageCount,
    effectivePageWidth,
    aiCollapsed,
    tocOpen,
    standaloneReader,
    readerStorageError,
    stateKey,
    highlightsKey,
    bookmarksKey,
    tocEditsKey,
    tocContentHash,
    setSettings,
    setSettingsLevel,
    setBookChapterRulesOverride,
    setBookChapterRulesOverrideLoaded,
    setTocManifest,
    setTocEdits,
    setTocEditUndoStack,
    setTocEditRedoStack,
    setTocEditHistory,
    applyReaderSettings,
    createTocEditHistoryEntry,
    createTocEditHistoryFromEdits,
    markReaderStateChanged,
    t,
  });
  const {
    saveCurrentBookChapterRulesOverride,
    clearCurrentBookChapterRulesOverride,
    exportReaderSettings,
    importReaderSettings,
    exportReaderDiagnostics,
  } = readerDataActions;

  const readerPanelContent = buildReaderPanelContent({
    book: displayBook,
    availableBooks,
    readerContext: aiReaderContext,
    readerChapters: chapters,
    readerHighlights: repairedHighlights,
    readerBookmarks: bookmarks,
    externalPromptRequest: aiExternalPromptRequest,
    onExternalPromptConsumed: (requestId) => setAiExternalPromptRequest((current) => current?.id === requestId ? null : current),
    extendedSettings,
    diagnostics: aiDiagnostics ?? undefined,
    citations,
    answer,
    status: aiStatus,
    saveStatus: aiSaveStatus,
    appSettings,
    onSelectAiModel,
    onToggleAiModelFavorite,
    onOpenSettings,
    onOpenTasks,
    onAsk: onAskAi,
    onStop: onStopAi,
    onRetry: onRetryAi,
    onSaveNote,
    onSaveHighlight,
    onSaveExcerpt,
    onJumpCitation: jumpToCitation,
    readerPanelControls: readerTopBar,
    settings,
    effectivePageWidth,
    settingsLevel,
    setSettingsLevel,
    onUpdateSetting: updateSetting,
    setPreviewSettings,
    onPresetChange: applyReaderPreset,
    onExportSettings: exportReaderSettings,
    onImportSettings: importReaderSettings,
    onRestoreDefault: restoreDefaultReaderSettings,
    onUndoSettings: undoReaderSettingsChange,
    onSaveAsGlobalDefault: saveCurrentReaderSettingsAsGlobalDefault,
    bookChapterRulesOverrideEnabled: Boolean(bookChapterRulesOverride),
    onSaveBookChapterRulesOverride: () => { void saveCurrentBookChapterRulesOverride(); },
    onClearBookChapterRulesOverride: () => { void clearCurrentBookChapterRulesOverride(); },
    onExportDiagnostics: exportReaderDiagnostics,
    chapterRules: { ...chapterRules, ...(bookChapterRulesOverride ?? {}) },
    onSaveChapterRules: (rules) => saveCurrentBookChapterRulesOverride(rules),
    onClearChapterRules: clearCurrentBookChapterRulesOverride,
  });

  function selectChapter(index: number, paragraphIndex = 0) {
    const visibleIndex = findVisibleChapterIndexByOriginalIndex(chapters, index);
    selectVisibleChapter(visibleIndex, paragraphIndex);
  }

  function selectVisibleChapter(index: number, paragraphIndex = 0, screenPage: number | 'first' | 'last' = 'first') {
    markReaderStateChanged();
    setActiveChapterIndex(Math.min(Math.max(index, 0), Math.max(0, chapters.length - 1)));
    setActiveParagraphIndex(Math.max(0, paragraphIndex));
    setActiveScreenPage(screenPage === 'last' ? Number.MAX_SAFE_INTEGER : typeof screenPage === 'number' ? Math.max(0, screenPage) : 0);
  }

  function selectChapterPage(index: number, screenPage: number | 'first' | 'last' = 'first', paragraphIndex = 0) {
    selectVisibleChapter(index, paragraphIndex, screenPage);
  }

  function selectScreenPage(page: number) {
    markReaderStateChanged();
    setActiveScreenPage(Math.max(0, page));
  }

  useEffect(() => {
    if (!book) {
      setReaderHistoryStack([]);
      return;
    }
    const nextTarget = { chapterIndex: safeChapterIndex, paragraphIndex: activeParagraphIndex, screenPage: activeScreenPage };
    const limit = parseBoundedInteger(extendedSettings.readerHistoryStackLimit, 50, 1, 200);
    setReaderHistoryStack((history) => {
      const previous = history.at(-1);
      if (previous && previous.chapterIndex === nextTarget.chapterIndex && previous.paragraphIndex === nextTarget.paragraphIndex && previous.screenPage === nextTarget.screenPage) return history;
      return createReaderHistoryStack(history, nextTarget, limit);
    });
  }, [book?.id, safeChapterIndex, activeParagraphIndex, activeScreenPage, extendedSettings.readerHistoryStackLimit]);

  useEffect(() => {
    if (!searchResult || !book || searchResult.bookId !== book.id || !chapters.length) return;
    const chapterIndex = typeof searchResult.sourceChapterIndex === 'number'
      ? chapters.findIndex((chapter) => chapter.index === searchResult.sourceChapterIndex)
      : chapters.findIndex((chapter) => chapter.title === searchResult.chapter || chapter.title.includes(searchResult.chapter) || searchResult.chapter.includes(chapter.title));
    const visibleIndex = chapterIndex >= 0 ? chapterIndex : safeChapterIndex;
    selectVisibleChapter(visibleIndex, searchResult.paragraphIndex, 'first');
    window.setTimeout(() => {
      const chapter = chapters[visibleIndex];
      emitReaderFlashLocation({
          sourceChapterIndex: searchResult.sourceChapterIndex ?? chapter?.index ?? visibleIndex,
          paragraphIndex: searchResult.paragraphIndex,
          startOffset: searchResult.startOffset,
          endOffset: searchResult.endOffset,
          chunkId: searchResult.chunkId,
      });
    }, 120);
    onSearchResultConsumed();
  }, [searchResult, book?.id, chapters.length]);

  const readerAnnotationActions = createReaderWorkspaceAnnotationActions({
    book,
    chapters,
    sourceChapters,
    highlights,
    bookmarks,
    tocEdits,
    settings,
    safeChapterIndex,
    activeParagraphIndex,
    activeScreenPage,
    activeScreenPageCount,
    aiCollapsed,
    tocOpen,
    settingsLevel,
    defaultHighlightColor,
    extendedSettings,
    setExtendedSettings,
    setSettings,
    setActiveChapterIndex,
    setActiveParagraphIndex,
    setActiveScreenPage,
    setAiCollapsed,
    setTocOpen,
    setSettingsLevel,
    setDefaultHighlightColor,
    setHighlights,
    setBookmarks,
    setTocEdits,
    setTocEditUndoStack,
    setTocEditRedoStack,
    setTocEditHistory,
    createTocEditHistoryFromEdits,
    markReaderStateChanged,
    t,
  });

  async function confirmTocEditImpact(edit: ReaderTocEdit) {
    if (edit.type !== 'hide' && edit.type !== 'split' && edit.type !== 'merge-next') return true;
    return requestAppConfirm(t('reader.toc.confirmImpact'));
  }

  function pushTocEditHistory(label: string, createdAt = new Date().toISOString()) {
    setTocEditHistory((current) => [createTocEditHistoryEntry(label, createdAt), ...current].slice(0, 5));
  }

  async function applyTocEdit(edit: ReaderTocEdit) {
    if (!await confirmTocEditImpact(edit)) return;
    const nextEdit = createReaderTocEdit(edit, {
      parserVersion: 'txt-v1',
      baseContentHash: tocContentHash,
      createdAt: new Date().toISOString(),
    });
    pushTocEditHistory(describeTocEdit(nextEdit, sourceChapters, t), nextEdit.createdAt);
    setTocEdits((current) => {
      setTocEditUndoStack((stack) => [...stack, current]);
      setTocEditRedoStack([]);
      return [...current, nextEdit];
    });
  }

  function undoTocEdit() {
    setTocEditUndoStack((stack) => {
      if (!stack.length) return stack;
      const previous = stack[stack.length - 1];
      setTocEditRedoStack((redoStack) => [...redoStack, tocEdits]);
      setTocEdits(previous);
      pushTocEditHistory(t('reader.toc.historyUndo'), new Date().toISOString());
      return stack.slice(0, -1);
    });
  }

  function redoTocEdit() {
    setTocEditRedoStack((stack) => {
      if (!stack.length) return stack;
      const next = stack[stack.length - 1];
      setTocEditUndoStack((undoStack) => [...undoStack, tocEdits]);
      setTocEdits(next);
      pushTocEditHistory(t('reader.toc.historyRedo'), new Date().toISOString());
      return stack.slice(0, -1);
    });
  }

  async function restoreDefaultTocEdits() {
    if (!tocEdits.length) return;
    if (!await requestAppConfirm(t('reader.toc.confirmImpact'))) return;
    setTocEditUndoStack((stack) => [...stack, tocEdits]);
    setTocEditRedoStack([]);
    setTocEdits([]);
    pushTocEditHistory(t('reader.toc.historyRestoreDefault'), new Date().toISOString());
  }

  async function repairTocEditConflicts() {
    if (!tocEdits.length) return;
    const repaired = repairReaderTocEdits(sourceChapters, tocEdits, {
      parserVersion: 'txt-v1',
      baseContentHash: tocContentHash,
      createdAt: new Date().toISOString(),
    });
    const confirmed = await requestAppConfirm(t('reader.toc.repairPreview', {
      kept: repaired.summary.keptCount,
      dropped: repaired.summary.droppedCount,
      clamped: repaired.summary.clampedCount,
      refreshed: repaired.summary.refreshedHashCount,
    }));
    if (!confirmed) return;
    setTocEditUndoStack((stack) => [...stack, tocEdits]);
    setTocEditRedoStack([]);
    setTocEdits(repaired.edits);
    pushTocEditHistory(t('reader.toc.historyRepair', {
      kept: repaired.summary.keptCount,
      dropped: repaired.summary.droppedCount,
      clamped: repaired.summary.clampedCount,
    }));
    markReaderStateChanged();
  }

  function jumpToReaderLocation(citation: Citation) {
    const resolved = findReaderLocationForCitation(citation, chapters, book?.chunks ?? []);
    if (resolved.status !== 'ok') {
      emitReaderFlashLocation({ message: t(getReaderLocationFailureMessage(resolved.status)) });
      return;
    }
    selectVisibleChapter(resolved.location.visibleChapterPosition, resolved.location.paragraphIndex, 'first');
    window.setTimeout(() => {
      emitReaderFlashLocation(resolved.location);
    }, 80);
  }

  function jumpToCitation(citation: Citation) {
    jumpToReaderLocation(citation);
  }

  useEffect(() => {
    function onAiProtocolJump(citation: Citation) {
      if (citation) jumpToReaderLocation(citation);
    }
    function onAiCitationRepair() {
      if (onRunParseIndex) {
        onRunParseIndex();
        emitReaderFlashLocation({ message: '已开始重新解析索引；完成后可再次尝试引用回跳。' });
        return;
      }
      onOpenTasks?.();
    }
    const unsubscribeAiProtocolJump = subscribeAiProtocolJump(onAiProtocolJump);
    const unsubscribeAiCitationRepair = subscribeAiCitationRepair(onAiCitationRepair);
    return () => {
      unsubscribeAiProtocolJump();
      unsubscribeAiCitationRepair();
    };
  }, [book?.id, chapters, readerBook?.chunks, onRunParseIndex, onOpenTasks]);

  function askSelectionAi(text: string) {
    const selected = text.trim();
    if (!selected) return;
    setAiCollapsed(false);
    setAiSelectionText(selected);
    readerTopBar.setAiPanelOpen(true);
    setAiExternalPromptRequest({ id: ++aiExternalPromptSequenceRef.current, prompt: `${t('reader.selection.explainPrompt')}\n\n${selected}`, scope: 'selection', selectionText: selected });
  }

  function generateSelectionQuestions(text: string) {
    const selected = text.trim();
    if (!selected) return;
    setAiCollapsed(false);
    setAiSelectionText(selected);
    readerTopBar.setAiPanelOpen(true);
    setAiExternalPromptRequest({ id: ++aiExternalPromptSequenceRef.current, prompt: `${t('reader.selection.questionsPrompt')}\n\n${selected}`, scope: 'selection', selectionText: selected });
  }

  function createSelectionCard(text: string) {
    const selected = text.trim();
    if (!selected) return;
    setAiCollapsed(false);
    setAiSelectionText(selected);
    readerTopBar.setAiPanelOpen(true);
    setAiExternalPromptRequest({ id: ++aiExternalPromptSequenceRef.current, prompt: `${t('reader.selection.cardPrompt')}\n\n${selected}`, scope: 'selection', selectionText: selected });
  }

  const readerCommands = createReaderCommandHandlers({
    book,
    windowKey,
    stateKey,
    settings,
    safeChapterIndex,
    activeParagraphIndex,
    activeScreenPage,
    aiCollapsed,
    tocOpen,
    settingsLevel,
    panelPlacements: readerTopBar.panelPlacements,
    extendedSettings,
    standaloneReader,
    moyuReader,
    detachedFromMain: readerSessionMode === 'detached',
    geometrySaveTimerRef,
    readerStateSaveTimerRef,
    readerWindowSyncTimerRef,
    setWindowState,
    setReaderWindowSyncStatus,
    persistReaderState,
    emitReaderWindowState,
    onDetachedReaderWindowOpen,
    t,
  });
  const readerCommandsRef = useRef(readerCommands);
  readerCommandsRef.current = readerCommands;

  useEffect(() => {
    if (!standaloneReader || !book) return;
    const current = WebviewWindow.getCurrent();
    void readerCommandsRef.current.refreshReaderWindowState();
    const moved = current.onMoved(() => readerCommandsRef.current.scheduleWindowGeometrySave());
    const resized = current.onResized(() => {
      void readerCommandsRef.current.refreshReaderWindowState();
      readerCommandsRef.current.scheduleWindowGeometrySave();
    });
    const focused = current.onFocusChanged(() => { void readerCommandsRef.current.refreshReaderWindowState(); });
    const closing = current.onCloseRequested((event) => readerCommandsRef.current.handleStandaloneReaderClose(event));
    return () => {
      if (geometrySaveTimerRef.current) {
        window.clearTimeout(geometrySaveTimerRef.current);
        geometrySaveTimerRef.current = null;
        void readerCommandsRef.current.saveWindowGeometry();
      }
      moved.then((dispose) => dispose());
      resized.then((dispose) => dispose());
      focused.then((dispose) => dispose());
      closing.then((dispose) => dispose());
    };
  }, [standaloneReader, book?.id, windowKey]);

  const readerPageProps = buildReaderPageProps({
    sourceBook: book,
    hidden,
    book: displayBook,
    recentBook: displayRecentBook,
    chapters,
    activeChapterIndex: safeChapterIndex,
    activeParagraphIndex,
    activeScreenPage,
    settings: effectiveReaderSettings,
    previewSettings,
    showToc: tocOpen,
    tocHierarchyMode: ({ ...chapterRules, ...(bookChapterRulesOverride ?? {}) }).tocHierarchyMode,
    setTocOpen,
    onSelectChapterPage: selectChapterPage,
    onSelectChapter: selectChapter,
    onSelectScreenPage: selectScreenPage,
    onPageCountChange: setActiveScreenPageCount,
    onVisiblePageTextChange: setVisibleReaderPageText,
    highlights: repairedHighlights,
    bookmarks,
    defaultHighlightColor,
    standaloneReader,
    moyuReader,
    onDefaultHighlightColorChange: setDefaultHighlightColor,
    annotationActions: readerAnnotationActions,
    onTocEdit: applyTocEdit,
    onUndoTocEdit: undoTocEdit,
    onRedoTocEdit: redoTocEdit,
    onRestoreDefaultToc: restoreDefaultTocEdits,
    canUndoTocEdit: tocEditUndoStack.length > 0,
    canRedoTocEdit: tocEditRedoStack.length > 0,
    hasTocEdits: tocEdits.length > 0,
    tocEditHistory,
    readerCommands,
    windowState,
    readerWindowSyncStatus,
    hiddenChapters,
    readerTopBar,
    onPageWidthChange: (width) => updateSetting('pageWidth', Math.round(width)),
    onEffectivePageWidthChange: setEffectivePageWidth,
    onAskSelectionAi: askSelectionAi,
    onGenerateSelectionQuestions: generateSelectionQuestions,
    onCreateSelectionCard: createSelectionCard,
    onChooseBookFile,
    onOpenLibrary,
    onOpenTasks,
    onOpenCharacters,
    onOpenRecentBook,
    onOpenSettingsPageTarget: onOpenSettings,
    onRunParseIndex,
    onReadingProgressChange,
    readerIndexing,
    dataActions: readerDataActions,
    libraryPanelVisible: standaloneReader ? undefined : libraryPanelVisible,
    onToggleLibraryPanel: standaloneReader ? undefined : onToggleLibraryPanel,
  });
  const externalReaderKind = resolveReaderExternalViewKind(book, chapters, safeChapterIndex);
  function handleExternalReaderProgressChange(progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) {
    if (book && !hidden) onReadingProgressChange?.(book.id, progress, detail);
  }

  return (
    <div className={`content-grid reader-grid${aiCollapsed ? ' ai-collapsed' : ''}${readerTopBar.readerOverlayOpen ? ' reader-overlay-open' : ''}${readerTopBar.dockOccupants.length ? ' reader-dock-open' : ''}`} style={{ gridTemplateColumns: readerTopBar.gridTemplateColumns, '--reader-right-panel-width': `${overlayPanelWidth}px`, '--reader-dock-width': `${overlayPanelWidth}px`, '--reader-highlight-panel-width': `${overlayPanelWidth}px`, '--reader-session-rail-width': `${overlayPanelWidth}px` } as CSSProperties} hidden={hidden}>
      {readerStorageError || readerDocumentError || readerDocumentModelError ? <div className="reader-storage-error" role="alert">{readerStorageError || readerDocumentError || readerDocumentModelError}<span>{t('reader.fileRecovery')}</span><button type="button" onClick={() => { setReaderStorageError(''); setReaderDocumentError(''); setReaderDocumentModel((current) => current ? { ...current, error: '' } : current); }} aria-label={t('common.cancel')}>×</button></div> : null}
      {tocEdits.length && tocEditHashStatus.status !== 'ok' ? <div className={`reader-toc-hash-warning ${tocEditHashStatus.status}`} role="status"><strong>{tocEditHashStatus.status === 'mismatch' ? t('reader.toc.hashMismatchTitle') : t('reader.toc.hashUnknownTitle')}</strong><span>{tocEditHashStatus.status === 'mismatch' ? t('reader.toc.hashMismatch', { count: tocEditHashStatus.mismatchedCount }) : t('reader.toc.hashUnknown', { count: tocEditHashStatus.unknownCount })}</span><button type="button" onClick={() => { void repairTocEditConflicts(); }}>{t('reader.toc.repairConflicts')}</button><button type="button" onClick={() => { void restoreDefaultTocEdits(); }}>{t('reader.toc.restoreDefault')}</button></div> : null}
      {!readerReady || isReaderDocumentLoading ? (
        <article className="reader-canvas" aria-label={t('reader.aria')}>
          <div className="empty-reader">
            <p className="eyebrow">{t('reader.loadingDocument')}</p>
            <h2>{displayBook?.displayTitle || displayBook?.title}</h2>
          </div>
        </article>
      ) : externalReaderKind && book ? (
        <ReaderExternalView kind={externalReaderKind} book={book} chapters={chapters} activeChapterIndex={safeChapterIndex} onSelectChapter={selectChapterPage} onProgressChange={handleExternalReaderProgressChange} />
      ) : (
        <ReaderPage {...readerPageProps} />
      )}
      {readerReady && !isReaderDocumentLoading && !externalReaderKind ? <ReaderRightPanelSessionBar /> : null}
      {readerTopBar.readerOverlayOpen && readerReady && !isReaderDocumentLoading && !externalReaderKind ? (
        <ReaderSidePanels
          openPanels={readerTopBar.openPanels}
          overlayPanelWidth={overlayPanelWidth}
          panelPlacements={readerTopBar.panelPlacements}
          panelContent={readerPanelContent}
          panelLabels={{ ai: t('ai.title'), settings: t('reader.settings'), rules: t('reader.rules') }}
          panelTitle={(placement) => placement === 'sidebar' ? t('reader.panel.dragFloating') : t('reader.panel.dragSidebar')}
          panelDockDragRef={readerPanelDockDragRef}
          overlayPanelWidthDragRef={overlayPanelWidthDragRef}
          setOverlayPanelWidth={setOverlayPanelWidth}
          setReaderPanelPlacement={readerTopBar.setReaderPanelPlacement}
        />
      ) : null}
    </div>
  );
}

function detailToReaderSettings(detail: unknown): Partial<ReaderSettings> | null {
  if (!detail || typeof detail !== 'object') return null;
  const settings = (detail as Record<string, unknown>).settings;
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings as Partial<ReaderSettings>
    : null;
}

function buildFallbackReaderPageText(chapter: ReaderChapter | null, activeParagraphIndex: number) {
  return chapter?.paragraphs.slice(activeParagraphIndex, activeParagraphIndex + 8).join('\n') ?? '';
}

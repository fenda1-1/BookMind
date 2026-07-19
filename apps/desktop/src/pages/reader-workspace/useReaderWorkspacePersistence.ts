import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauriRuntime } from '../../app/platform';
import { loadGlobalReaderSettings } from '../../features/reader-core/readerSettings';
import { subscribeCurrentBookDataCleared } from '../../features/reader-core/currentBookDataEvents';
import { createSensitiveReaderStoragePayload, getReaderRecord, parseReaderRecord, saveReaderRecord } from '../../services/readerStorageService';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Translator } from '../../i18n';
import type { Book, ReaderBookmark, ReaderHighlight, ReaderHighlightColor, ReaderSettings, ReaderSettingsLevel } from '../../types';
import type { ReaderTocEdit } from '../../features/reader-core/readerModel';
import { createReaderWindowStateEvent, type ReaderWindowStateEvent } from '../readerWorkspaceModel';
import { cleanupLegacyReaderStorage, saveJson, saveReaderState, skipReaderPersistence, type ReaderStoredPanelPlacements, type ReaderStoredState } from '../readerWorkspaceStorage';
import { emitHighlightsUpdated } from '../../services/appDomainEvents';
import { emitReaderAnnotationsUpdated, subscribeReaderAnnotationsUpdated } from '../../services/readerAnnotationEvents';

function getReaderSourceWindowId() {
  if (!isTauriRuntime()) return 'browser-preview';
  try {
    return WebviewWindow.getCurrent().label || 'main';
  } catch {
    return 'browser-preview';
  }
}

type UseReaderWorkspacePersistenceInput = {
  book: Book | null;
  extendedSettings: ExtendedSettings;
  settings: ReaderSettings;
  highlights: ReaderHighlight[];
  bookmarks: ReaderBookmark[];
  defaultHighlightColor: ReaderHighlightColor;
  tocEdits: ReaderTocEdit[];
  safeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  aiCollapsed: boolean;
  tocOpen: boolean;
  settingsLevel: ReaderSettingsLevel;
  panelPlacements: ReaderStoredPanelPlacements;
  stateKey: string;
  highlightsKey: string;
  bookmarksKey: string;
  highlightColorKey: string;
  tocEditsKey: string;
  chapters: Array<{ id?: string; index?: number }>;
  standaloneReader: boolean;
  moyuReader: boolean;
  hidden: boolean;
  restoringRef: MutableRefObject<boolean>;
  setReaderStorageError: (error: string) => void;
  setReaderWindowSyncStatus: (status: string) => void;
  setSettings: (value: ReaderSettings | ((prev: ReaderSettings) => ReaderSettings)) => void;
  setActiveChapterIndex: (value: number | ((prev: number) => number)) => void;
  setActiveParagraphIndex: (value: number | ((prev: number) => number)) => void;
  setActiveScreenPage: (value: number | ((prev: number) => number)) => void;
  setActiveScreenPageCount: (value: number | ((prev: number) => number)) => void;
  setAiCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  setTocOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setSettingsLevel: (value: ReaderSettingsLevel | ((prev: ReaderSettingsLevel) => ReaderSettingsLevel)) => void;
  setReaderPanelPlacements: (placements: Partial<ReaderStoredPanelPlacements> | null | undefined) => void;
  setHighlights: (value: ReaderHighlight[] | ((prev: ReaderHighlight[]) => ReaderHighlight[])) => void;
  setBookmarks: (value: ReaderBookmark[] | ((prev: ReaderBookmark[]) => ReaderBookmark[])) => void;
  setDefaultHighlightColor: (value: ReaderHighlightColor | ((prev: ReaderHighlightColor) => ReaderHighlightColor)) => void;
  setTocEdits: (value: ReaderTocEdit[] | ((prev: ReaderTocEdit[]) => ReaderTocEdit[])) => void;
  setBookChapterRulesOverride: Dispatch<SetStateAction<any>>;
  setBookChapterRulesOverrideLoaded: Dispatch<SetStateAction<any>>;
  setTocEditUndoStack: Dispatch<SetStateAction<any>>;
  setTocEditRedoStack: Dispatch<SetStateAction<any>>;
  setTocEditHistory: Dispatch<SetStateAction<any>>;
  setReaderHistoryStack: Dispatch<SetStateAction<any>>;
  onReaderLocationChange: (location: { bookId: string; chapterId?: string; sourceChapterIndex?: number; paragraphIndex: number; startOffset: number; endOffset: number } | null) => void;
  t: Translator;
};

export function useReaderWorkspacePersistence({
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
  panelPlacements,
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
  setReaderPanelPlacements,
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
}: UseReaderWorkspacePersistenceInput) {
  const readerStateSaveTimerRef = useRef<number | null>(null);
  const readerWindowSyncTimerRef = useRef<number | null>(null);
  const pendingReaderStateSaveRef = useRef<{ bookId: string; key: string; state: ReaderStoredState } | null>(null);
  const readerPersistenceSuppressionRef = useRef<{ bookId: string; kinds: Set<string> }>({ bookId: '', kinds: new Set() });
  const lastLocalReaderStateAtRef = useRef(Date.now());
  const lastAcceptedReaderWindowStateAtRef = useRef(0);
  const lastReaderLocationNotificationRef = useRef<string>('');

  function markReaderStateChanged() {
    lastLocalReaderStateAtRef.current = Date.now();
  }

  function suppressReaderPersistenceForBookDataClear(bookId: string) {
    readerPersistenceSuppressionRef.current = {
      bookId,
      kinds: new Set(['state', 'highlights', 'bookmarks', 'highlightColor', 'tocEdits', 'readingStats']),
    };
  }

  function consumeReaderPersistenceSuppression(bookId: string, kind: string) {
    const suppression = readerPersistenceSuppressionRef.current;
    if (suppression.bookId !== bookId || !suppression.kinds.has(kind)) return false;
    suppression.kinds.delete(kind);
    if (!suppression.kinds.size) readerPersistenceSuppressionRef.current = { bookId: '', kinds: new Set() };
    return true;
  }

  function suppressReaderPersistence(bookId: string, kind: string) {
    if (readerPersistenceSuppressionRef.current.bookId !== bookId) readerPersistenceSuppressionRef.current = { bookId, kinds: new Set() };
    readerPersistenceSuppressionRef.current.kinds.add(kind);
  }

  useEffect(() => subscribeReaderAnnotationsUpdated((detail) => {
    if (!book || detail.source !== 'knowledge' || detail.bookId !== book.id || !isTauriRuntime()) return;
    void getReaderRecord(book.id, detail.kind).then((record) => {
      suppressReaderPersistence(book.id, detail.kind);
      if (detail.kind === 'highlights') setHighlights(parseReaderRecord<ReaderHighlight[]>(record, []));
      else setBookmarks(parseReaderRecord<ReaderBookmark[]>(record, []));
    }).catch((error) => console.warn(`Failed to synchronize reader ${detail.kind}:`, error));
  }), [book?.id]);

  function scheduleReaderStateSave(bookId: string, key: string, state: ReaderStoredState) {
    if (!extendedSettings.autoSaveReaderPosition) return;
    if (skipReaderPersistence(settings)) return;
    pendingReaderStateSaveRef.current = { bookId, key, state };
    if (readerStateSaveTimerRef.current) window.clearTimeout(readerStateSaveTimerRef.current);
    readerStateSaveTimerRef.current = window.setTimeout(() => void flushPendingReaderStateSave(), Number(extendedSettings.readerPositionSaveDebounceMs));
  }

  function flushPendingReaderStateSave() {
    const pending = pendingReaderStateSaveRef.current;
    if (!pending) return;
    pendingReaderStateSaveRef.current = null;
    if (readerStateSaveTimerRef.current) {
      window.clearTimeout(readerStateSaveTimerRef.current);
      readerStateSaveTimerRef.current = null;
    }
    void persistReaderState(pending.bookId, pending.key, pending.state);
  }

  async function persistReaderState(bookId: string, key: string, state: ReaderStoredState) {
    saveReaderState(key, state);
    if (!isTauriRuntime()) return;
    try {
      await saveReaderRecord(bookId, 'state', state, getReaderSourceWindowId());
    } catch (error) {
      console.warn('Failed to save reader state to SQLite:', error);
      setReaderStorageError('Failed to save reader progress. Export a backup before closing this window.');
    }
  }

  function scheduleReaderWindowSync(bookId: string, state: ReaderStoredState) {
    if (!isTauriRuntime()) return;
    if (readerWindowSyncTimerRef.current) window.clearTimeout(readerWindowSyncTimerRef.current);
    const updatedAt = new Date(lastLocalReaderStateAtRef.current).toISOString();
    readerWindowSyncTimerRef.current = window.setTimeout(() => void emitReaderWindowState(bookId, state, updatedAt), 300);
  }

  async function emitReaderWindowState(bookId: string, state: ReaderStoredState, updatedAt = new Date().toISOString()) {
    if (!isTauriRuntime()) return;
    try {
      await WebviewWindow.getCurrent().emit('bookmind:reader-window-state', { ...createReaderWindowStateEvent(bookId, state, updatedAt) });
      setReaderWindowSyncStatus(t('reader.window.syncSent'));
    } catch {
      // Browser preview and non-window hosts skip multi-window sync.
    }
  }

  function shouldAcceptReaderWindowState(payload: Partial<ReaderWindowStateEvent>, strategy: ExtendedSettings['multiWindowConflictStrategy']) {
    if (strategy === 'current-window' || strategy === 'manual') {
      setReaderWindowSyncStatus(strategy === 'manual' ? t('reader.window.syncPaused') : t('reader.window.syncKeptLocal'));
      return false;
    }
    const remoteUpdatedAt = Date.parse(payload.updatedAt ?? '');
    if (!Number.isFinite(remoteUpdatedAt)) return true;
    if (remoteUpdatedAt < lastAcceptedReaderWindowStateAtRef.current) return false;
    if (Date.now() - lastLocalReaderStateAtRef.current < 500 && remoteUpdatedAt < lastLocalReaderStateAtRef.current) return false;
    lastAcceptedReaderWindowStateAtRef.current = remoteUpdatedAt;
    return true;
  }

  function applyReaderWindowState(payload: Partial<ReaderWindowStateEvent>, force: boolean) {
    if (payload.source === getReaderSourceWindowId()) return;
    if (book && payload.bookId && payload.bookId !== book.id) return;
    if (!force && !shouldAcceptReaderWindowState(payload, extendedSettings.multiWindowConflictStrategy)) return;
    if (typeof payload.activeChapterIndex === 'number') {
      const safeChapter = chapters.length
        ? Math.min(Math.max(0, payload.activeChapterIndex), chapters.length - 1)
        : Math.max(0, payload.activeChapterIndex);
      setActiveChapterIndex(safeChapter);
      setActiveParagraphIndex(payload.activeParagraphIndex ?? 0);
      setActiveScreenPage(payload.activeScreenPage ?? 0);
    } else if (typeof payload.activeScreenPage === 'number') {
      setActiveScreenPage(payload.activeScreenPage);
    }
    if (payload.settings) setSettings(payload.settings);
    if (typeof payload.tocOpen === 'boolean') setTocOpen(payload.tocOpen);
    if (typeof payload.aiCollapsed === 'boolean') setAiCollapsed(payload.aiCollapsed);
    if (payload.settingsLevel) setSettingsLevel(payload.settingsLevel);
    if (payload.panelPlacements) setReaderPanelPlacements(payload.panelPlacements);
    setReaderWindowSyncStatus(t('reader.window.syncReceived'));
  }

  // Highlights persistence
  useEffect(() => {
    if (book) {
      if (consumeReaderPersistenceSuppression(book.id, 'highlights')) return;
      if (skipReaderPersistence(settings)) return;
      if (!isTauriRuntime()) {
        emitHighlightsUpdated();
        emitReaderAnnotationsUpdated({ bookId: book.id, kind: 'highlights', source: 'reader' });
        return;
      }
      const secureHighlights = createSensitiveReaderStoragePayload(highlights, settings.encryptSensitiveReaderData);
      saveReaderRecord(book.id, 'highlights', secureHighlights, getReaderSourceWindowId()).then(() => {
        cleanupLegacyReaderStorage({ highlightsKey, highlightsBookId: book.id });
        emitHighlightsUpdated();
        emitReaderAnnotationsUpdated({ bookId: book.id, kind: 'highlights', source: 'reader' });
      }).catch((error) => {
        console.warn('Failed to save reader highlights to SQLite:', error);
        setReaderStorageError('Failed to save reader highlights. Export a backup before closing this window.');
      });
    }
  }, [book?.id, highlightsKey, highlights, settings.privacyMode, settings.encryptSensitiveReaderData]);

  // Bookmarks persistence
  useEffect(() => {
    if (book && consumeReaderPersistenceSuppression(book.id, 'bookmarks')) return;
    if (skipReaderPersistence(settings)) return;
    if (!isTauriRuntime()) {
      if (book) emitReaderAnnotationsUpdated({ bookId: book.id, kind: 'bookmarks', source: 'reader' });
      return;
    }
    if (book) saveReaderRecord(book.id, 'bookmarks', createSensitiveReaderStoragePayload(bookmarks, settings.encryptSensitiveReaderData), getReaderSourceWindowId()).then(() => {
      cleanupLegacyReaderStorage({ bookmarksKey });
      emitReaderAnnotationsUpdated({ bookId: book.id, kind: 'bookmarks', source: 'reader' });
    }).catch((error) => {
      console.warn('Failed to save reader bookmarks to SQLite:', error);
      setReaderStorageError('Failed to save reader bookmarks. Export a backup before closing this window.');
    });
  }, [book?.id, bookmarksKey, bookmarks, settings.privacyMode, settings.encryptSensitiveReaderData]);

  // Highlight color persistence
  useEffect(() => {
    if (book && consumeReaderPersistenceSuppression(book.id, 'highlightColor')) return;
    saveJson(highlightColorKey, defaultHighlightColor, setReaderStorageError);
    if (!isTauriRuntime()) return;
    if (book) saveReaderRecord(book.id, 'highlightColor', defaultHighlightColor, getReaderSourceWindowId()).catch((error) => {
      console.warn('Failed to save reader highlight color to SQLite:', error);
      setReaderStorageError('Failed to save reader preferences. Export a backup before closing this window.');
    });
  }, [book?.id, highlightColorKey, defaultHighlightColor]);

  // TOC edits persistence
  useEffect(() => {
    if (book && consumeReaderPersistenceSuppression(book.id, 'tocEdits')) return;
    if (!isTauriRuntime()) return;
    if (book) saveReaderRecord(book.id, 'tocEdits', createSensitiveReaderStoragePayload(tocEdits, settings.encryptSensitiveReaderData), getReaderSourceWindowId()).then(() => {
      cleanupLegacyReaderStorage({ tocEditsKey });
    }).catch((error) => {
      console.warn('Failed to save reader TOC edits to SQLite:', error);
      setReaderStorageError('Failed to save reader TOC edits. Export a backup before closing this window.');
    });
  }, [book?.id, tocEditsKey, tocEdits, settings.encryptSensitiveReaderData]);

  // Reader state save + window sync effect
  useEffect(() => {
    if (hidden && !standaloneReader) return;
    if (!book || restoringRef.current) return;
    if (consumeReaderPersistenceSuppression(book.id, 'state')) return;
    markReaderStateChanged();
    const state = { settings, activeChapterIndex: safeChapterIndex, activeParagraphIndex, activeScreenPage, aiCollapsed, tocOpen, settingsLevel, panelPlacements };
    scheduleReaderStateSave(book.id, stateKey, state);
    if (extendedSettings.autoSaveReaderPosition && extendedSettings.multiWindowReaderSync) scheduleReaderWindowSync(book.id, state);
  }, [hidden, standaloneReader, book, stateKey, settings, safeChapterIndex, activeParagraphIndex, activeScreenPage, aiCollapsed, tocOpen, settingsLevel, panelPlacements, extendedSettings.autoSaveReaderPosition, extendedSettings.readerPositionSaveDebounceMs, extendedSettings.multiWindowReaderSync]);

  useEffect(() => () => {
    flushPendingReaderStateSave();
    if (readerWindowSyncTimerRef.current) {
      window.clearTimeout(readerWindowSyncTimerRef.current);
      readerWindowSyncTimerRef.current = null;
    }
  }, [book?.id]);

  const currentReaderLocationChapter = chapters[safeChapterIndex];
  const currentReaderLocationChapterId = currentReaderLocationChapter?.id;
  const currentReaderLocationSourceChapterIndex = currentReaderLocationChapter?.index;

  // Reader location change notification
  useEffect(() => {
    if (!book) {
      if (lastReaderLocationNotificationRef.current === 'none') return;
      lastReaderLocationNotificationRef.current = 'none';
      onReaderLocationChange(null);
      return;
    }
    const readerLocationKey = JSON.stringify([
      book.id,
      currentReaderLocationChapterId ?? '',
      currentReaderLocationSourceChapterIndex ?? '',
      activeParagraphIndex,
      0,
      0,
    ]);
    if (lastReaderLocationNotificationRef.current === readerLocationKey) return;
    lastReaderLocationNotificationRef.current = readerLocationKey;
    onReaderLocationChange({
      bookId: book.id,
      chapterId: currentReaderLocationChapterId,
      sourceChapterIndex: currentReaderLocationSourceChapterIndex,
      paragraphIndex: activeParagraphIndex,
      startOffset: 0,
      endOffset: 0,
    });
  }, [book?.id, currentReaderLocationChapterId, currentReaderLocationSourceChapterIndex, activeParagraphIndex, onReaderLocationChange]);

  // Multi-window reader sync listener
  useEffect(() => {
    if (!isTauriRuntime() || !standaloneReader || !extendedSettings.multiWindowReaderSync) return;
    let disposed = false;
    let disposeListener: (() => void) | undefined;
    try {
      const current = WebviewWindow.getCurrent();
      const unlisten = current.listen<Partial<ReaderWindowStateEvent>>('bookmind:reader-window-state', (event) => {
        if (event.payload.source === current.label) return;
        applyReaderWindowState(event.payload, false);
      });
      void unlisten.then((dispose) => {
        if (disposed) dispose();
        else disposeListener = dispose;
      });
    } catch {
      return undefined;
    }
    return () => {
      disposed = true;
      disposeListener?.();
    };
  }, [standaloneReader, chapters.length, t, extendedSettings.multiWindowReaderSync, extendedSettings.multiWindowConflictStrategy]);

  // Moyu mode is a temporary presentation of the same reader session. Its
  // location handoff is always accepted, independently of optional sync policy.
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let disposeListener: (() => void) | undefined;
    const current = WebviewWindow.getCurrent();
    const unlisten = current.listen<Partial<ReaderWindowStateEvent>>('bookmind:moyu-reader-state', (event) => {
      if (event.payload.source === current.label) return;
      applyReaderWindowState(event.payload, true);
    });
    void unlisten.then((dispose) => {
      if (disposed) dispose();
      else disposeListener = dispose;
    });
    return () => {
      disposed = true;
      disposeListener?.();
    };
  }, [book?.id, chapters.length, moyuReader, t]);

  // Current book data cleared handler
  useEffect(() => {
    function handleCurrentBookDataCleared(detail?: { bookId?: string }) {
      if (!book || detail?.bookId !== book.id) return;
      if (readerStateSaveTimerRef.current) {
        window.clearTimeout(readerStateSaveTimerRef.current);
        readerStateSaveTimerRef.current = null;
      }
      if (readerWindowSyncTimerRef.current) {
        window.clearTimeout(readerWindowSyncTimerRef.current);
        readerWindowSyncTimerRef.current = null;
      }
      restoringRef.current = true;
      suppressReaderPersistenceForBookDataClear(book.id);
      setSettings(loadGlobalReaderSettings());
      setActiveChapterIndex(0);
      setActiveParagraphIndex(0);
      setActiveScreenPage(0);
      setActiveScreenPageCount(1);
      setAiCollapsed(false);
      setTocOpen(true);
      setSettingsLevel('basic');
      setReaderPanelPlacements(null);
      setHighlights([]);
      setBookmarks([]);
      setDefaultHighlightColor(extendedSettings.defaultHighlightColor);
      setTocEdits([]);
      setBookChapterRulesOverride(null);
      setBookChapterRulesOverrideLoaded(true);
      setTocEditUndoStack([]);
      setTocEditRedoStack([]);
      setTocEditHistory([]);
      setReaderHistoryStack([]);
      setReaderStorageError('');
      setReaderWindowSyncStatus('idle');
      window.requestAnimationFrame(() => { restoringRef.current = false; });
    }
    function onCurrentBookDataCleared(detail: { bookId: string }) {
      handleCurrentBookDataCleared(detail);
    }
    return subscribeCurrentBookDataCleared(onCurrentBookDataCleared);
  }, [book?.id, extendedSettings.defaultHighlightColor]);

  return {
    readerStateSaveTimerRef,
    readerWindowSyncTimerRef,
    markReaderStateChanged,
    persistReaderState,
    emitReaderWindowState,
  };
}

import { useEffect, useMemo, useState } from 'react';
import { defaultReaderSettings, loadGlobalReaderSettings } from '../../features/reader-core/readerSettings';
import type { ReaderChapter, ReaderHistoryTarget, ReaderTocEdit, ReaderTocManifest } from '../../features/reader-core/readerModel';
import {
  getReaderRightPanelWidth,
  setReaderRightPanelWidth,
  subscribeReaderRightPanelSessions,
} from '../../features/reader-core/readerRightPanelSessions';
import { getInitialReaderChapter, createInitialReaderWorkspaceState } from '../readerWorkspaceModel';
import { loadChapterRules, loadExtendedSettings, type ChapterRuleDraft } from '../../services/settingsCenterService';
import type { Book, ReaderBookmark, ReaderHighlight, ReaderHighlightColor, ReaderSettings, ReaderSettingsLevel } from '../../types';
import { loadReaderState, type ReaderTocEditHistoryEntry } from '../readerWorkspaceStorage';

export function useReaderWorkspaceState(book: Book | null, standaloneReader: boolean) {
  const initialReaderState = useMemo(() => createInitialReaderWorkspaceState(book, standaloneReader, loadReaderState), [book?.id, standaloneReader]);
  const [readerDocument, setReaderDocument] = useState<Book | null>(null);
  const [readerDocumentError, setReaderDocumentError] = useState('');
  const [extendedSettings, setExtendedSettings] = useState(() => loadExtendedSettings());
  const [chapterRules, setChapterRules] = useState<ChapterRuleDraft>(() => loadChapterRules());
  const [settings, setSettings] = useState<ReaderSettings>(() => loadGlobalReaderSettings());
  const [previewSettings, setPreviewSettings] = useState<ReaderSettings | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(() => initialReaderState?.activeChapterIndex ?? getInitialReaderChapter());
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(() => initialReaderState?.activeParagraphIndex ?? 0);
  const [activeScreenPage, setActiveScreenPage] = useState(() => initialReaderState?.activeScreenPage ?? 0);
  const [activeScreenPageCount, setActiveScreenPageCount] = useState(1);
  const [effectivePageWidth, setEffectivePageWidth] = useState(defaultReaderSettings.pageWidth);
  const [aiCollapsed, setAiCollapsed] = useState(() => initialReaderState?.aiCollapsed ?? false);
  const [overlayPanelWidth, setOverlayPanelWidthState] = useState(getReaderRightPanelWidth);
  useEffect(() => subscribeReaderRightPanelSessions((snapshot) => {
    setOverlayPanelWidthState(snapshot.width);
  }), []);
  const setOverlayPanelWidth = setReaderRightPanelWidth;
  const [tocOpen, setTocOpen] = useState(() => initialReaderState?.tocOpen ?? true);
  const [settingsLevel, setSettingsLevel] = useState<ReaderSettingsLevel>(() => initialReaderState?.settingsLevel ?? 'basic');
  const [readerReady, setReaderReady] = useState(() => !book || Boolean(createInitialReaderWorkspaceState(book, standaloneReader, loadReaderState)));
  const [windowState, setWindowState] = useState({ isFullscreen: false, isAlwaysOnTop: false });
  const [readerWindowSyncStatus, setReaderWindowSyncStatus] = useState('idle');
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [defaultHighlightColor, setDefaultHighlightColor] = useState<ReaderHighlightColor>(() => extendedSettings.defaultHighlightColor);
  const [tocEdits, setTocEdits] = useState<ReaderTocEdit[]>([]);
  const [tocManifest, setTocManifest] = useState<ReaderTocManifest | null>(null);
  const [tocManifestLoaded, setTocManifestLoaded] = useState(false);
  const [bookChapterRulesOverride, setBookChapterRulesOverride] = useState<Partial<ChapterRuleDraft> | null>(null);
  const [bookChapterRulesOverrideLoaded, setBookChapterRulesOverrideLoaded] = useState(false);
  const [tocEditUndoStack, setTocEditUndoStack] = useState<ReaderTocEdit[][]>([]);
  const [tocEditRedoStack, setTocEditRedoStack] = useState<ReaderTocEdit[][]>([]);
  const [tocEditHistory, setTocEditHistory] = useState<ReaderTocEditHistoryEntry[]>([]);
  const [readerHistoryStack, setReaderHistoryStack] = useState<ReaderHistoryTarget[]>([]);
  const [readerStorageError, setReaderStorageError] = useState('');
  const [readerDocumentModel, setReaderDocumentModel] = useState<{
    bookId: string;
    contentHash: string;
    cleanedContent: string;
    sourceChapters: ReaderChapter[];
    signature: string;
    loading: boolean;
    error: string;
  } | null>(null);

  return {
    initialReaderState,
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
    previewSettings,
    setPreviewSettings,
    activeChapterIndex,
    setActiveChapterIndex,
    activeParagraphIndex,
    setActiveParagraphIndex,
    activeScreenPage,
    setActiveScreenPage,
    activeScreenPageCount,
    setActiveScreenPageCount,
    effectivePageWidth,
    setEffectivePageWidth,
    aiCollapsed,
    setAiCollapsed,
    overlayPanelWidth,
    setOverlayPanelWidth,
    tocOpen,
    setTocOpen,
    settingsLevel,
    setSettingsLevel,
    readerReady,
    setReaderReady,
    windowState,
    setWindowState,
    readerWindowSyncStatus,
    setReaderWindowSyncStatus,
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
    tocEditUndoStack,
    setTocEditUndoStack,
    tocEditRedoStack,
    setTocEditRedoStack,
    tocEditHistory,
    setTocEditHistory,
    readerHistoryStack,
    setReaderHistoryStack,
    readerStorageError,
    setReaderStorageError,
    readerDocumentModel,
    setReaderDocumentModel,
  };
}

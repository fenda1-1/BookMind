import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type { ReaderPage } from '../../features/reader-core/ReaderPage';
import type { Book } from '../../types';
import type { createReaderWorkspaceAnnotationActions } from '../readerWorkspaceAnnotationActions';
import type { createReaderWorkspaceDataActions } from '../readerWorkspaceDataActions';
import type { createReaderCommandHandlers } from './ReaderCommandHandlers';
import type { useReaderTopBarController } from './ReaderTopBar';

type ReaderPageProps = ComponentProps<typeof ReaderPage>;
type ReaderAnnotationActions = ReturnType<typeof createReaderWorkspaceAnnotationActions>;
type ReaderDataActions = ReturnType<typeof createReaderWorkspaceDataActions>;
type ReaderCommands = ReturnType<typeof createReaderCommandHandlers>;
type ReaderTopBar = ReturnType<typeof useReaderTopBarController>;

type ReaderWindowState = {
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
};

type BuildReaderPagePropsInput = {
  sourceBook: Book | null;
  hidden: boolean;
  book: ReaderPageProps['book'];
  recentBook: ReaderPageProps['recentBook'];
  chapters: ReaderPageProps['chapters'];
  activeChapterIndex: ReaderPageProps['activeChapterIndex'];
  activeParagraphIndex: ReaderPageProps['activeParagraphIndex'];
  activeScreenPage: ReaderPageProps['activeScreenPage'];
  settings: ReaderPageProps['settings'];
  previewSettings: ReaderPageProps['previewSettings'];
  showToc: ReaderPageProps['showToc'];
  tocHierarchyMode: ReaderPageProps['tocHierarchyMode'];
  setTocOpen: Dispatch<SetStateAction<boolean>>;
  onSelectChapterPage: ReaderPageProps['onSelectChapterPage'];
  onSelectChapter: ReaderPageProps['onSelectChapter'];
  onSelectScreenPage: ReaderPageProps['onSelectScreenPage'];
  onPageCountChange: ReaderPageProps['onPageCountChange'];
  onVisiblePageTextChange: ReaderPageProps['onVisiblePageTextChange'];
  highlights: ReaderPageProps['highlights'];
  bookmarks: ReaderPageProps['bookmarks'];
  defaultHighlightColor: ReaderPageProps['defaultHighlightColor'];
  standaloneReader: ReaderPageProps['standaloneReader'];
  moyuReader: ReaderPageProps['moyuReader'];
  onDefaultHighlightColorChange: ReaderPageProps['onDefaultHighlightColorChange'];
  annotationActions: ReaderAnnotationActions;
  onTocEdit: ReaderPageProps['onTocEdit'];
  onUndoTocEdit: ReaderPageProps['onUndoTocEdit'];
  onRedoTocEdit: ReaderPageProps['onRedoTocEdit'];
  onRestoreDefaultToc: ReaderPageProps['onRestoreDefaultToc'];
  canUndoTocEdit: boolean;
  canRedoTocEdit: boolean;
  hasTocEdits: boolean;
  tocEditHistory: ReaderPageProps['tocEditHistory'];
  readerCommands: ReaderCommands;
  windowState: ReaderWindowState;
  readerWindowSyncStatus: ReaderPageProps['readerWindowSyncStatus'];
  hiddenChapters: ReaderPageProps['hiddenChapters'];
  readerTopBar: ReaderTopBar;
  onPageWidthChange: ReaderPageProps['onPageWidthChange'];
  onEffectivePageWidthChange: ReaderPageProps['onEffectivePageWidthChange'];
  onAskSelectionAi: ReaderPageProps['onAskSelectionAi'];
  onGenerateSelectionQuestions: ReaderPageProps['onGenerateSelectionQuestions'];
  onCreateSelectionCard: ReaderPageProps['onCreateSelectionCard'];
  onChooseBookFile: ReaderPageProps['onChooseBookFile'];
  onOpenLibrary: ReaderPageProps['onOpenLibrary'];
  onOpenTasks: ReaderPageProps['onOpenTasks'];
  onOpenCharacters: ReaderPageProps['onOpenCharacters'];
  onOpenRecentBook: ReaderPageProps['onOpenRecentBook'];
  onOpenSettingsPageTarget?: (target?: 'ai-api' | 'reader-memory-warning') => void;
  onRunParseIndex: ReaderPageProps['onRunParseIndex'];
  onReadingProgressChange?: (bookId: string, progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
  readerIndexing: ReaderPageProps['readerIndexing'];
  dataActions: ReaderDataActions;
  libraryPanelVisible?: ReaderPageProps['libraryPanelVisible'];
  onToggleLibraryPanel?: ReaderPageProps['onToggleLibraryPanel'];
};

export function buildReaderPageProps({
  sourceBook,
  hidden,
  book,
  recentBook,
  chapters,
  activeChapterIndex,
  activeParagraphIndex,
  activeScreenPage,
  settings,
  previewSettings,
  showToc,
  tocHierarchyMode,
  setTocOpen,
  onSelectChapterPage,
  onSelectChapter,
  onSelectScreenPage,
  onPageCountChange,
  onVisiblePageTextChange,
  highlights,
  bookmarks,
  defaultHighlightColor,
  standaloneReader,
  moyuReader,
  onDefaultHighlightColorChange,
  annotationActions,
  onTocEdit,
  onUndoTocEdit,
  onRedoTocEdit,
  onRestoreDefaultToc,
  canUndoTocEdit,
  canRedoTocEdit,
  hasTocEdits,
  tocEditHistory,
  readerCommands,
  windowState,
  readerWindowSyncStatus,
  hiddenChapters,
  readerTopBar,
  onPageWidthChange,
  onEffectivePageWidthChange,
  onAskSelectionAi,
  onGenerateSelectionQuestions,
  onCreateSelectionCard,
  onChooseBookFile,
  onOpenLibrary,
  onOpenTasks,
  onOpenCharacters,
  onOpenRecentBook,
  onOpenSettingsPageTarget,
  onRunParseIndex,
  onReadingProgressChange,
  readerIndexing,
  dataActions,
  libraryPanelVisible,
  onToggleLibraryPanel,
}: BuildReaderPagePropsInput): ReaderPageProps {
  return {
    book,
    recentBook,
    chapters,
    activeChapterIndex,
    activeParagraphIndex,
    activeScreenPage,
    settings,
    previewSettings,
    showToc,
    tocHierarchyMode,
    onToggleToc: () => setTocOpen((value) => !value),
    onOpenSettings: readerTopBar.toggleReaderSettings,
    rulesPanelOpen: readerTopBar.rulesOpen,
    onToggleRulesPanel: readerTopBar.toggleReaderRules,
    onSelectChapterPage,
    onSelectChapter,
    onSelectScreenPage,
    onPageCountChange,
    onVisiblePageTextChange,
    highlights,
    bookmarks,
    defaultHighlightColor,
    standaloneReader,
    moyuReader,
    onCreateHighlight: annotationActions.createHighlight,
    onDefaultHighlightColorChange,
    onUpdateHighlightColor: annotationActions.updateHighlightColor,
    onUpdateHighlightNote: annotationActions.updateHighlightNote,
    onUpdateHighlightDetails: annotationActions.updateHighlightDetails,
    onClearHighlightNote: annotationActions.clearHighlightNote,
    onDeleteHighlight: annotationActions.removeHighlight,
    onRestoreHighlight: annotationActions.restoreHighlight,
    onDeleteHighlights: annotationActions.removeHighlights,
    onExportHighlights: annotationActions.exportReaderHighlights,
    onExportAnnotations: annotationActions.exportReaderAnnotations,
    onImportAnnotationsJson: annotationActions.importReaderAnnotationsJson,
    onCreateBookmark: annotationActions.createBookmark,
    onUpdateBookmark: annotationActions.updateBookmark,
    onDeleteBookmark: annotationActions.removeBookmark,
    onRestoreBookmark: annotationActions.restoreBookmark,
    onTocEdit,
    onUndoTocEdit,
    onRedoTocEdit,
    onRestoreDefaultToc,
    onExportTocEdits: dataActions.exportReaderTocEdits,
    onImportTocEditsJson: dataActions.importReaderTocEditsJson,
    canUndoTocEdit,
    canRedoTocEdit,
    hasTocEdits,
    tocEditHistory,
    onToggleFullscreen: readerCommands.toggleFullscreen,
    onToggleAlwaysOnTop: readerCommands.toggleAlwaysOnTop,
    onToggleWindowed: readerCommands.openReaderWindow,
    onOpenMoyuMode: readerCommands.openMoyuReaderWindow,
    onOpenMoyuSettings: readerCommands.openMoyuSettingsWindow,
    onExitMoyuMode: readerCommands.exitMoyuMode,
    onReturnToMainWindow: readerCommands.returnToMainWindow,
    isFullscreen: windowState.isFullscreen,
    isAlwaysOnTop: windowState.isAlwaysOnTop,
    readerWindowSyncStatus,
    hiddenChapters,
    isActive: !hidden,
    aiPanelOpen: readerTopBar.aiPanelOpen,
    onToggleAiPanel: readerTopBar.toggleReaderAiPanel,
    onPageWidthChange,
    onEffectivePageWidthChange,
    onAskSelectionAi,
    onGenerateSelectionQuestions,
    onCreateSelectionCard,
    onChooseBookFile,
    onOpenLibrary,
    onOpenTasks,
    onOpenCharacters,
    onOpenRecentBook,
    onOpenReaderMemorySettings: () => onOpenSettingsPageTarget?.('reader-memory-warning'),
    onOpenAiDemo: readerTopBar.openReaderAiDemo,
    onRunParseIndex,
    onProgressChange: (progress, detail) => {
      if (sourceBook && !hidden) onReadingProgressChange?.(sourceBook.id, progress, detail);
    },
    readerIndexing,
    libraryPanelVisible,
    onToggleLibraryPanel,
  };
}

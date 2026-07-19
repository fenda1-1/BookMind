import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { AiDiagnostics, AppPage, AppSettings, Book, CharacterCenterBookSummary, CharacterCenterPayload, CharacterOverviewSnapshot, CharacterWorkbenchView, IndexDiagnostics, SearchResult, TaskStatus } from '../types';
import type { ExtendedSettings, ChapterRuleDraft } from '../services/settingsCenterService';
import type { CommandId } from './commandRegistry';

/** Centralizes app-level state so domain hooks can access it without prop drilling. */
export type AppState = {
  extendedSettings: ExtendedSettings;
  setExtendedSettings: Dispatch<SetStateAction<ExtendedSettings>>;
  chapterRules: ChapterRuleDraft;
  setChapterRules: Dispatch<SetStateAction<ChapterRuleDraft>>;
  books: Book[];
  setBooks: Dispatch<SetStateAction<Book[]>>;
  selectedBookId: string | null;
  setSelectedBookId: Dispatch<SetStateAction<string | null>>;
  activePage: AppPage;
  setActivePage: Dispatch<SetStateAction<AppPage>>;
  night: boolean;
  setNight: Dispatch<SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  appLocked: boolean;
  setAppLocked: Dispatch<SetStateAction<boolean>>;
  recentCommandIds: CommandId[];
  setRecentCommandIds: Dispatch<SetStateAction<CommandId[]>>;
  pendingReaderSearchResult: SearchResult | null;
  setPendingReaderSearchResult: Dispatch<SetStateAction<SearchResult | null>>;
  readerIndexing: boolean;
  setReaderIndexing: Dispatch<SetStateAction<boolean>>;
  characterBookId: string | null;
  setCharacterBookId: Dispatch<SetStateAction<string | null>>;
  selectedCharacterWorkbenchView: CharacterWorkbenchView;
  setSelectedCharacterWorkbenchView: Dispatch<SetStateAction<CharacterWorkbenchView>>;
  renderedCharacterWorkbenchView: CharacterWorkbenchView;
  setRenderedCharacterWorkbenchView: Dispatch<SetStateAction<CharacterWorkbenchView>>;
  characterIndexingBookId: string | null;
  setCharacterIndexingBookId: Dispatch<SetStateAction<string | null>>;
  characterExtractionBookId: string | null;
  setCharacterExtractionBookId: Dispatch<SetStateAction<string | null>>;
  characterPayload: CharacterCenterPayload | null;
  setCharacterPayload: Dispatch<SetStateAction<CharacterCenterPayload | null>>;
  characterOverviewSnapshot: CharacterOverviewSnapshot | null;
  setCharacterOverviewSnapshot: Dispatch<SetStateAction<CharacterOverviewSnapshot | null>>;
  characterOverviewSnapshotLoadingBookId: string | null;
  setCharacterOverviewSnapshotLoadingBookId: Dispatch<SetStateAction<string | null>>;
  characterBookSummariesFromBackend: CharacterCenterBookSummary[] | null;
  setCharacterBookSummariesFromBackend: Dispatch<SetStateAction<CharacterCenterBookSummary[] | null>>;
  characterBookSummaries: CharacterCenterBookSummary[];
  taskSnapshot: TaskStatus[];
  setTaskSnapshot: Dispatch<SetStateAction<TaskStatus[]>>;
  setAiStatus: Dispatch<SetStateAction<'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error'>>;
  setAiDiagnostics: Dispatch<SetStateAction<AiDiagnostics | null>>;
  indexDiagnostics: IndexDiagnostics | null;
  setIndexDiagnostics: Dispatch<SetStateAction<IndexDiagnostics | null>>;
  unfinishedTaskSummary: { count: number; tasks: TaskStatus[] } | null;
  setUnfinishedTaskSummary: Dispatch<SetStateAction<{ count: number; tasks: TaskStatus[] } | null>>;
  backgroundTaskRunning: boolean;
  setBackgroundTaskRunning: Dispatch<SetStateAction<boolean>>;
  restoreStartupReaderPosition: boolean;
  setRestoreStartupReaderPosition: Dispatch<SetStateAction<boolean>>;
  libraryLoadError: string;
  setLibraryLoadError: Dispatch<SetStateAction<string>>;
  importSummaryToast: { message: string; bookId: string | null } | null;
  setImportSummaryToast: Dispatch<SetStateAction<{ message: string; bookId: string | null } | null>>;
  aiNoteToast: { noteId: string; message: string } | null;
  setAiNoteToast: Dispatch<SetStateAction<{ noteId: string; message: string } | null>>;
  taskCompletionToast: { message: string; characterAction?: { bookId: string } | null } | null;
  setTaskCompletionToast: Dispatch<SetStateAction<{ message: string; characterAction?: { bookId: string } | null } | null>>;
};

// Ownership boundaries used by domain hooks. Persisted data is loaded/saved by
// settings and library services; these slices only hold the active UI/session view.
export type PersistedSettingsState = Pick<AppState, 'extendedSettings' | 'setExtendedSettings' | 'chapterRules' | 'setChapterRules'>;
export type LibraryMetadataState = Pick<AppState, 'books' | 'setBooks' | 'selectedBookId' | 'setSelectedBookId' | 'libraryLoadError' | 'setLibraryLoadError'>;
export type ReaderSessionState = Pick<AppState, 'pendingReaderSearchResult' | 'setPendingReaderSearchResult' | 'readerIndexing' | 'setReaderIndexing' | 'restoreStartupReaderPosition' | 'setRestoreStartupReaderPosition'>;
export type BackgroundTaskState = Pick<AppState, 'taskSnapshot' | 'setTaskSnapshot' | 'indexDiagnostics' | 'setIndexDiagnostics' | 'unfinishedTaskSummary' | 'setUnfinishedTaskSummary' | 'backgroundTaskRunning' | 'setBackgroundTaskRunning'>;
export type TransientUiState = Pick<AppState, 'activePage' | 'setActivePage' | 'night' | 'setNight' | 'sidebarCollapsed' | 'setSidebarCollapsed' | 'commandPaletteOpen' | 'setCommandPaletteOpen' | 'appLocked' | 'setAppLocked' | 'recentCommandIds' | 'setRecentCommandIds' | 'importSummaryToast' | 'setImportSummaryToast' | 'aiNoteToast' | 'setAiNoteToast' | 'taskCompletionToast' | 'setTaskCompletionToast'>;

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateContext.Provider');
  return ctx;
}

export { AppStateContext };

type AppNotificationsProps = {
  aiNote: { noteId: string; message: string } | null;
  taskCompletion: { message: string; characterAction?: { bookId: string } | null } | null;
  importSummary: { message: string; bookId: string | null } | null;
  labels: { viewNote: string; openCharacterCenter: string; openTasks: string; openLibrary: string; close: string };
  onViewNote: (noteId: string) => void;
  onOpenCharacters: (bookId: string) => void;
  onOpenTasks: () => void;
  onOpenLibrary: (bookId: string | null) => void;
  onDismissAiNote: () => void;
  onDismissTaskCompletion: () => void;
  onDismissImportSummary: () => void;
};

export function AppNotifications({ aiNote, taskCompletion, importSummary, labels, onViewNote, onOpenCharacters, onOpenTasks, onOpenLibrary, onDismissAiNote, onDismissTaskCompletion, onDismissImportSummary }: AppNotificationsProps) {
  return <>{aiNote ? <div className="app-toast" role="status"><span>{aiNote.message}</span><button type="button" onClick={() => onViewNote(aiNote.noteId)}>{labels.viewNote}</button><button type="button" aria-label={labels.close} onClick={onDismissAiNote}>×</button></div> : null}{taskCompletion ? <div className="app-toast task-completion-toast" role="status"><span>{taskCompletion.message}</span>{taskCompletion.characterAction ? <button type="button" onClick={() => onOpenCharacters(taskCompletion.characterAction?.bookId ?? '')}>{labels.openCharacterCenter}</button> : null}<button type="button" onClick={onOpenTasks}>{labels.openTasks}</button><button type="button" aria-label={labels.close} onClick={onDismissTaskCompletion}>×</button></div> : null}{importSummary ? <div className="app-toast import-summary-toast" role="status"><span>{importSummary.message}</span><button type="button" onClick={() => onOpenLibrary(importSummary.bookId)}>{labels.openLibrary}</button><button type="button" aria-label={labels.close} onClick={onDismissImportSummary}>×</button></div> : null}</>;
}

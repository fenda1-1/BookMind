export type LibraryUpdatedEventDetail = {
  bookId?: string;
  bookIds?: string[];
  taskIds?: string[];
  openReader?: boolean;
};

export type LibraryRefreshRequestDetail = {
  bookId?: string;
};

export type ReaderFlashLocationEventDetail = {
  sourceChapterIndex?: number;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
  chunkId?: string;
  message?: string;
};

export type TaskUpdateReason = 'task-started' | 'task-completed' | 'task-failed' | 'index-rebuilt' | 'logs-cleared';

export type TasksCompletedEventDetail = {
  count: number;
  tasks: TaskStatus[];
};

export type TasksUpdatedEventDetail = {
  reason: TaskUpdateReason;
  bookIds: string[];
  taskIds: string[];
};

export const appDomainEventNames = {
  libraryUpdated: 'bookmind:library-updated',
  libraryRefreshRequested: 'bookmind:library-refresh-request',
  notesUpdated: 'bookmind:notes-updated',
  highlightsUpdated: 'bookmind:highlights-updated',
  flashcardsUpdated: 'bookmind:flashcards-updated',
  readerFlashLocation: 'bookmind:reader-flash-location',
  tasksCompleted: 'bookmind:tasks-completed',
  tasksUpdated: 'bookmind:tasks-updated',
  windowFrameGeometryChanged: 'bookmind:window-frame-geometry-changed',
} as const;

type AppDomainEventDetailMap = {
  libraryUpdated: LibraryUpdatedEventDetail;
  libraryRefreshRequested: LibraryRefreshRequestDetail;
  notesUpdated: Record<string, never>;
  highlightsUpdated: Record<string, never>;
  flashcardsUpdated: Record<string, never>;
  readerFlashLocation: ReaderFlashLocationEventDetail;
  tasksCompleted: TasksCompletedEventDetail;
  tasksUpdated: TasksUpdatedEventDetail;
  windowFrameGeometryChanged: Record<string, never>;
};

export function emitAppDomainEvent<Name extends keyof AppDomainEventDetailMap>(
  name: Name,
  detail: AppDomainEventDetailMap[Name] = {} as AppDomainEventDetailMap[Name],
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(appDomainEventNames[name], { detail }));
}

export function subscribeAppDomainEvent<Name extends keyof AppDomainEventDetailMap>(
  name: Name,
  handler: (detail: AppDomainEventDetailMap[Name]) => void,
) {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<AppDomainEventDetailMap[Name]>).detail ?? {} as AppDomainEventDetailMap[Name]);
  window.addEventListener(appDomainEventNames[name], listener);
  return () => window.removeEventListener(appDomainEventNames[name], listener);
}

export function emitLibraryUpdated(detail: LibraryUpdatedEventDetail = {}) {
  emitAppDomainEvent('libraryUpdated', detail);
}

export function requestLibraryRefresh(detail: LibraryRefreshRequestDetail = {}) {
  emitAppDomainEvent('libraryRefreshRequested', detail);
}

export function emitNotesUpdated() {
  emitAppDomainEvent('notesUpdated');
}

export function emitHighlightsUpdated() {
  emitAppDomainEvent('highlightsUpdated');
}

export function emitFlashcardsUpdated() {
  emitAppDomainEvent('flashcardsUpdated');
}

export function emitReaderFlashLocation(detail: ReaderFlashLocationEventDetail) {
  emitAppDomainEvent('readerFlashLocation', detail);
}

export function subscribeLibraryUpdated(handler: (detail: LibraryUpdatedEventDetail) => void) {
  return subscribeAppDomainEvent('libraryUpdated', handler);
}

export function subscribeLibraryRefreshRequests(handler: (detail: LibraryRefreshRequestDetail) => void) {
  return subscribeAppDomainEvent('libraryRefreshRequested', handler);
}

export function subscribeNotesUpdated(handler: () => void) {
  return subscribeAppDomainEvent('notesUpdated', handler);
}

export function subscribeHighlightsUpdated(handler: () => void) {
  return subscribeAppDomainEvent('highlightsUpdated', handler);
}

export function subscribeFlashcardsUpdated(handler: () => void) {
  return subscribeAppDomainEvent('flashcardsUpdated', handler);
}

export function subscribeReaderFlashLocation(handler: (detail: ReaderFlashLocationEventDetail) => void) {
  return subscribeAppDomainEvent('readerFlashLocation', handler);
}

export function emitTasksCompleted(detail: TasksCompletedEventDetail) {
  emitAppDomainEvent('tasksCompleted', detail);
}

export function emitTasksUpdated(detail: TasksUpdatedEventDetail) {
  emitAppDomainEvent('tasksUpdated', detail);
}

export function emitWindowFrameGeometryChanged() {
  emitAppDomainEvent('windowFrameGeometryChanged');
}

export function subscribeTasksCompleted(handler: (detail: TasksCompletedEventDetail) => void) {
  return subscribeAppDomainEvent('tasksCompleted', handler);
}

export function subscribeTasksUpdated(handler: (detail: TasksUpdatedEventDetail) => void) {
  return subscribeAppDomainEvent('tasksUpdated', handler);
}

export function subscribeWindowFrameGeometryChanged(handler: () => void) {
  return subscribeAppDomainEvent('windowFrameGeometryChanged', handler);
}
import type { TaskStatus } from '../types';

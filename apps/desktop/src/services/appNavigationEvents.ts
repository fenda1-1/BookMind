import { emitBrowserDomainEvent } from './browserDomainEvents';
import type { SearchResult } from '../types';

const appNavigationEventNames = {
  viewNote: 'bookmind:view-note',
  taskCenterImport: 'bookmind:task-center-import',
  openReaderLocation: 'bookmind:open-reader-location',
} as const;

export function requestNoteView(noteId: string) {
  emitBrowserDomainEvent(appNavigationEventNames.viewNote, { noteId });
}

export function requestTaskCenterImport(mode: 'file' | 'directory') {
  emitBrowserDomainEvent(appNavigationEventNames.taskCenterImport, { mode });
}

export function requestReaderLocationOpen(detail: { result: SearchResult; readerLocation?: unknown }) {
  emitBrowserDomainEvent(appNavigationEventNames.openReaderLocation, detail);
}

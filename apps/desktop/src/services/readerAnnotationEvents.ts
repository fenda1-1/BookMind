import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../app/platform';

export type ReaderAnnotationsUpdatedDetail = {
  bookId: string;
  kind: 'highlights' | 'bookmarks';
  source: 'reader' | 'knowledge';
};

type ReaderAnnotationsUpdatedBroadcast = ReaderAnnotationsUpdatedDetail & { sourceId: string };

const localEventName = 'bookmind:reader-annotations-updated';
const tauriEventName = 'bookmind://reader-annotations-updated';
const sourceId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `reader-annotations-${Date.now()}-${Math.random()}`;

export function emitReaderAnnotationsUpdated(detail: ReaderAnnotationsUpdatedDetail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ReaderAnnotationsUpdatedDetail>(localEventName, { detail }));
  if (isTauriRuntime()) void emit(tauriEventName, { ...detail, sourceId }).catch(() => undefined);
}

export function subscribeReaderAnnotationsUpdated(handler: (detail: ReaderAnnotationsUpdatedDetail) => void) {
  let disposed = false;
  let unlistenTauri: UnlistenFn | undefined;
  const localListener = (event: Event) => handler((event as CustomEvent<ReaderAnnotationsUpdatedDetail>).detail);
  if (typeof window !== 'undefined') window.addEventListener(localEventName, localListener);
  if (isTauriRuntime()) {
    void listen<ReaderAnnotationsUpdatedBroadcast>(tauriEventName, (event) => {
      if (!event.payload || event.payload.sourceId === sourceId) return;
      handler({ bookId: event.payload.bookId, kind: event.payload.kind, source: event.payload.source });
    }).then((unlisten) => {
      if (disposed) unlisten();
      else unlistenTauri = unlisten;
    }).catch(() => undefined);
  }
  return () => {
    disposed = true;
    if (typeof window !== 'undefined') window.removeEventListener(localEventName, localListener);
    unlistenTauri?.();
  };
}

import { emit, listen } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../app/platform';
import { emitBrowserDomainEvent, subscribeBrowserDomainEvent } from '../../services/browserDomainEvents';

const currentBookDataClearedEvent = 'bookmind:current-book-data-cleared';
const currentBookDataClearedSourceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export type CurrentBookDataClearedDetail = {
  bookId: string;
  kinds: readonly string[];
};

type CurrentBookDataClearedBroadcast = CurrentBookDataClearedDetail & { sourceId?: string };

export async function publishCurrentBookDataCleared(detail: CurrentBookDataClearedDetail) {
  emitBrowserDomainEvent(currentBookDataClearedEvent, detail);
  if (!isTauriRuntime()) return;
  await emit(currentBookDataClearedEvent, { ...detail, sourceId: currentBookDataClearedSourceId }).catch(() => undefined);
}

export function subscribeCurrentBookDataCleared(handler: (detail: CurrentBookDataClearedDetail) => void) {
  const unsubscribeBrowser = subscribeBrowserDomainEvent<CurrentBookDataClearedDetail>(currentBookDataClearedEvent, handler);
  let disposed = false;
  let unlisten: (() => void) | undefined;
  if (isTauriRuntime()) {
    void listen<CurrentBookDataClearedBroadcast>(currentBookDataClearedEvent, (event) => {
      if (!disposed && event.payload?.sourceId !== currentBookDataClearedSourceId) handler(event.payload);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch(() => undefined);
  }
  return () => {
    disposed = true;
    unsubscribeBrowser();
    unlisten?.();
  };
}

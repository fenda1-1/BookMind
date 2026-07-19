import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppPage } from '../types';
import { isTauriRuntime } from './platform';

export function useAppWindowLifecycle({ standaloneReader, moyuReader, onDetachedReaderReturned }: { standaloneReader: boolean; moyuReader: boolean; onDetachedReaderReturned: (bookId: string | null) => void }) {
  useEffect(() => {
    if (!standaloneReader || moyuReader || !isTauriRuntime()) return;
    void getCurrentWindow().setDecorations(false).catch((error) => console.warn('Failed to disable native standalone reader window decorations:', error));
  }, [moyuReader, standaloneReader]);
  useEffect(() => {
    if (standaloneReader || !isTauriRuntime()) return undefined;
    const listener = listen<{ bookId?: string | null }>('bookmind:detached-reader-returned', (event) => onDetachedReaderReturned(event.payload?.bookId ?? null));
    return () => { listener.then((dispose) => dispose()).catch(() => {}); };
  }, [onDetachedReaderReturned, standaloneReader]);
}

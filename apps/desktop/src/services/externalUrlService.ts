import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../app/platform';

export async function openExternalUrl(url: string) {
  if (isTauriRuntime()) {
    await invoke<void>('open_external_url', { url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

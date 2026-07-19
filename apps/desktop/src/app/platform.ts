import type { Locale } from '../i18n';

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export function getShortcutModifier() {
  const platform = globalThis.navigator?.platform ?? '';
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘' : 'Ctrl';
}

export function formatShortcut(shortcut: string) {
  return shortcut.replaceAll('Ctrl/Cmd', getShortcutModifier());
}

export function formatAppDateTime(value: string, locale: Locale) {
  const timestamp = Number(value);
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

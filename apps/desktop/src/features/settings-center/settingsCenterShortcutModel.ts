export type SettingsShortcutConflictInput = {
  commandPaletteShortcut: string;
  navigationShortcuts: {
    reader: string;
    library: string;
    search: string;
  };
  importShortcut: string;
  aiSummaryShortcut: string;
};

type ShortcutConflictKey = keyof typeof shortcutConflictFallbackMessages;
type ShortcutConflictTranslator = (key: ShortcutConflictKey, values?: Record<string, string | number>) => string;

const shortcutConflictFallbackMessages = {
  'settings.shortcutConflict.commandPalette': 'Command palette',
  'settings.shortcutConflict.readerNavigation': 'Reader navigation',
  'settings.shortcutConflict.libraryNavigation': 'Library navigation',
  'settings.shortcutConflict.searchNavigation': 'Search navigation',
  'settings.shortcutConflict.importFile': 'Import file',
  'settings.shortcutConflict.aiSummary': 'AI summary',
  'settings.shortcutConflict.separator': ', ',
  'settings.shortcutConflict.format': '{shortcut}: {labels}',
} as const;

export function getShortcutConflictMessages(settings: SettingsShortcutConflictInput, t: ShortcutConflictTranslator = translateShortcutConflictFallback) {
  const shortcuts = [
    { label: t('settings.shortcutConflict.commandPalette'), value: settings.commandPaletteShortcut },
    { label: t('settings.shortcutConflict.readerNavigation'), value: settings.navigationShortcuts.reader },
    { label: t('settings.shortcutConflict.libraryNavigation'), value: settings.navigationShortcuts.library },
    { label: t('settings.shortcutConflict.searchNavigation'), value: settings.navigationShortcuts.search },
    { label: t('settings.shortcutConflict.importFile'), value: settings.importShortcut },
    { label: t('settings.shortcutConflict.aiSummary'), value: settings.aiSummaryShortcut },
  ].filter((item) => item.value !== 'disabled');
  const groups = new Map<string, string[]>();
  shortcuts.forEach((item) => groups.set(item.value, [...(groups.get(item.value) ?? []), item.label]));
  const separator = t('settings.shortcutConflict.separator');
  return Array.from(groups.entries())
    .filter(([, labels]) => labels.length > 1)
    .map(([shortcut, labels]) => t('settings.shortcutConflict.format', { shortcut: formatShortcutSettingValue(shortcut), labels: labels.join(separator) }));
}

export function formatShortcutSettingValue(shortcut: string) {
  if (shortcut === 'ctrl-enter') return 'Ctrl/Cmd+Enter';
  return shortcut.split('-').map((part) => (
    part === 'ctrl' ? 'Ctrl/Cmd' : part === 'alt' ? 'Alt' : part === 'shift' ? 'Shift' : part.toUpperCase()
  )).join('+');
}

function translateShortcutConflictFallback(key: ShortcutConflictKey, values?: Record<string, string | number>) {
  const template: string = shortcutConflictFallbackMessages[key] ?? key;
  return values ? Object.entries(values).reduce<string>((current, [name, value]) => current.replaceAll(`{${name}}`, String(value)), template) : template;
}

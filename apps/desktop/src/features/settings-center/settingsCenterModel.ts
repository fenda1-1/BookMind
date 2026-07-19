import type { BookMindIconName } from '../../components/bookMindIconTypes';
import type { Translator } from '../../i18n';
import type { AiModeSelectOption } from './settingsCenterOptionsModel';

export * from './settingsCenterOptionsModel';

export type SettingsGroupId = 'general' | 'appearance' | 'reader' | 'moyu' | 'chapters' | 'library' | 'ai' | 'translation' | 'search' | 'annotations' | 'data' | 'tasks' | 'shortcuts' | 'accessibility' | 'diagnostics';

export type SettingsGroup = {
  id: SettingsGroupId;
  label: string;
  description: string;
  icon: BookMindIconName;
};

export type SettingsScopeItem = {
  scope: 'global' | 'book' | 'session' | 'derived';
  label: string;
  storage: string;
  examples: string;
  owner: string;
};

export type EncryptionCoverageItem = {
  kind: string;
  label: string;
  storage: string;
  status: 'protected' | 'plain' | 'excluded';
  note: string;
};

export type AiModeAvailability = {
  cloudAiEnabled: boolean;
  localAiEnabled: boolean;
};

export const settingsGroups: SettingsGroup[] = [
  { id: 'general', label: 'General', description: 'Startup, saving, and settings management', icon: 'settingsGeneral' },
  { id: 'appearance', label: 'Appearance and Navigation', description: 'Theme, sidebar, and command palette', icon: 'settingsAppearance' },
  { id: 'reader', label: 'Reader', description: 'Typography, header/footer, and paging', icon: 'reader' },
  { id: 'moyu', label: 'Moyu Mode', description: 'Floating window, opacity, locked interaction, and shortcuts', icon: 'moyuMode' },
  { id: 'chapters', label: 'Chapters and TOC', description: 'Title grouping rules and cleanup', icon: 'settingsChapters' },
  { id: 'library', label: 'Library and Import', description: 'Views, import, and trash', icon: 'library' },
  { id: 'ai', label: 'AI', description: 'Cloud API, scope, and privacy', icon: 'aiDesk' },
  { id: 'translation', label: 'Translation', description: 'Languages, AI models, and translation APIs', icon: 'translate' },
  { id: 'search', label: 'Search and Indexing', description: 'Full-text search, FTS, and normalization', icon: 'search' },
  { id: 'annotations', label: 'Annotations and Knowledge', description: 'Highlights, bookmarks, and export', icon: 'settingsAnnotations' },
  { id: 'data', label: 'Data, Security, and Privacy', description: 'Backup, cleanup, and redaction', icon: 'settingsData' },
  { id: 'tasks', label: 'Tasks and Performance', description: 'Concurrency, cache, and diagnostics', icon: 'tasks' },
  { id: 'shortcuts', label: 'Shortcuts and Interaction', description: 'Commands, mouse, and keyboard', icon: 'settingsShortcuts' },
  { id: 'accessibility', label: 'Language and Accessibility', description: 'Language, high contrast, and focus', icon: 'settingsAccessibility' },
  { id: 'diagnostics', label: 'Developer and Diagnostics', description: 'Logs, diagnostic packages, and experiments', icon: 'diagnostics' },
];

const settingsGroupTranslationKeys: Record<SettingsGroupId, { label: string; description: string }> = {
  general: { label: 'settings.group.general.label', description: 'settings.group.general.description' },
  appearance: { label: 'settings.group.appearance.label', description: 'settings.group.appearance.description' },
  reader: { label: 'settings.group.reader.label', description: 'settings.group.reader.description' },
  moyu: { label: 'settings.group.moyu.label', description: 'settings.group.moyu.description' },
  chapters: { label: 'settings.group.chapters.label', description: 'settings.group.chapters.description' },
  library: { label: 'settings.group.library.label', description: 'settings.group.library.description' },
  ai: { label: 'settings.group.ai.label', description: 'settings.group.ai.description' },
  translation: { label: 'settings.group.translation.label', description: 'settings.group.translation.description' },
  search: { label: 'settings.group.search.label', description: 'settings.group.search.description' },
  annotations: { label: 'settings.group.annotations.label', description: 'settings.group.annotations.description' },
  data: { label: 'settings.group.data.label', description: 'settings.group.data.description' },
  tasks: { label: 'settings.group.tasks.label', description: 'settings.group.tasks.description' },
  shortcuts: { label: 'settings.group.shortcuts.label', description: 'settings.group.shortcuts.description' },
  accessibility: { label: 'settings.group.accessibility.label', description: 'settings.group.accessibility.description' },
  diagnostics: { label: 'settings.group.diagnostics.label', description: 'settings.group.diagnostics.description' },
};

export function buildSettingsGroups(t?: Translator): SettingsGroup[] {
  if (!t) return settingsGroups;
  return settingsGroups.map((group) => {
    const keys = settingsGroupTranslationKeys[group.id];
    return {
      ...group,
      label: t(keys.label as never),
      description: t(keys.description as never),
    };
  });
}

export const settingsScopeMatrix: SettingsScopeItem[] = [
  { scope: 'global', label: 'Global settings', storage: 'AppSettings / settings_v2.json / global localStorage fallback', examples: 'AI, library defaults, global reader defaults, shortcuts, appearance, and navigation', owner: 'Settings Center' },
  { scope: 'book', label: 'Per-book settings', storage: 'reader_records / current-book reader records', examples: 'Reading position, per-book typography overrides, highlights, bookmarks, TOC edits, and cloud AI consent', owner: 'Reader workspace' },
  { scope: 'session', label: 'Session settings', storage: 'React state / window state / temporary input', examples: 'Settings search query, open panels, AI streaming state, and uncommitted form drafts', owner: 'Current window' },
  { scope: 'derived', label: 'Derived state', storage: 'Computed from books, indexes, settings, and runtime environment; not persisted directly', examples: 'Font support diagnostics, search hit counts, pagination measurements, and task statistics', owner: 'Runtime model' },
];

export const encryptionCoverageMatrix: EncryptionCoverageItem[] = [
  { kind: 'reader.highlights', label: 'Reader highlights', storage: 'reader_records/highlights', status: 'protected', note: 'Highlight text, context, and metadata are stored with local envelope encryption.' },
  { kind: 'reader.bookmarks', label: 'Reader bookmarks', storage: 'reader_records/bookmarks', status: 'protected', note: 'Bookmark titles, notes, tags, and locations are stored with local envelope encryption.' },
  { kind: 'reader.tocEdits', label: 'TOC edits', storage: 'reader_records/tocEdits', status: 'protected', note: 'Hidden, split, merged, and renamed TOC edits are stored with local envelope encryption.' },
  { kind: 'reader.cloudAiRequestHistory', label: 'Cloud AI request history', storage: 'reader_records/cloudAiRequestHistory', status: 'protected', note: 'Allowlisted request-history fields are encrypted before saving, while sensitive body text is redacted first.' },
  { kind: 'notes', label: 'Notes', storage: 'notes/notes.json', status: 'protected', note: 'Titles, body text, citations, reader locations, and AI metadata use the local envelope.' },
  { kind: 'highlights', label: 'Knowledge excerpts', storage: 'notes/highlights.json', status: 'protected', note: 'Excerpt text and source information use the local envelope.' },
  { kind: 'flashcards', label: 'Flashcards', storage: 'notes/flashcards.json', status: 'protected', note: 'Questions, answers, sources, and tags use the local envelope.' },
  { kind: 'library.metadata', label: 'Library metadata', storage: 'library/library.json', status: 'plain', note: 'Book titles, authors, file names, and progress remain plaintext and rely on privacy display plus key-exclusion backup policy.' },
  { kind: 'library.originals', label: 'Imported originals', storage: 'library/originals', status: 'plain', note: 'Original TXT copies stay readable for offline reading, index rebuilds, and user auditing.' },
  { kind: 'indexes', label: 'Indexes and FTS', storage: 'indexes / db/bookmind.sqlite', status: 'plain', note: 'Full-text indexes and chunks are rebuildable data and are not encrypted; encrypted search needs a separate design.' },
  { kind: 'settings', label: 'General settings', storage: 'settings/settings*.json', status: 'plain', note: 'Regular preferences are saved as plaintext; API keys and the local data key use system keyring or secure fallback files.' },
  { kind: 'secure.keys', label: 'Key material', storage: 'settings/*.secure / system keyring', status: 'excluded', note: 'Excluded from backups, diagnostics, and settings snapshots; Settings only shows status and never displays keys.' },
];

export function buildSettingsScopeMatrix(t?: Translator): SettingsScopeItem[] {
  if (!t) return settingsScopeMatrix.map((item) => ({ ...item }));
  return settingsScopeMatrix.map((item) => ({
    ...item,
    label: translateSettingsModelText(t, `settings.data.scopeMatrix.${item.scope}.label`, item.label),
    storage: translateSettingsModelText(t, `settings.data.scopeMatrix.${item.scope}.storage`, item.storage),
    examples: translateSettingsModelText(t, `settings.data.scopeMatrix.${item.scope}.examples`, item.examples),
    owner: translateSettingsModelText(t, `settings.data.scopeMatrix.${item.scope}.owner`, item.owner),
  }));
}

export function buildEncryptionCoverageMatrix(t?: Translator): EncryptionCoverageItem[] {
  if (!t) return encryptionCoverageMatrix.map((item) => ({ ...item }));
  return encryptionCoverageMatrix.map((item) => ({
    ...item,
    label: translateSettingsModelText(t, `settings.data.encryptionCoverage.${item.kind}.label`, item.label),
    note: translateSettingsModelText(t, `settings.data.encryptionCoverage.${item.kind}.note`, item.note),
  }));
}

export function resolveAvailableAiModeOptions(options: AiModeSelectOption[], availability: AiModeAvailability) {
  return options.filter((item) => {
    if (item.value === 'cloud') return availability.cloudAiEnabled;
    if (item.value === 'local') return availability.localAiEnabled;
    return true;
  });
}

export function normalizeSettingsSearchText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKC');
}

export function matchesSettingsSearchText(normalizedQuery: string, values: unknown[]) {
  if (!normalizedQuery) return true;
  return normalizeSettingsSearchText(values.filter((value) => value !== undefined && value !== null).join(' ')).includes(normalizedQuery);
}

export function resolveSettingsVisibleGroups(query: string, activeGroup: SettingsGroupId, groups: SettingsGroup[] = settingsGroups) {
  const normalizedQuery = normalizeSettingsSearchText(query);
  return normalizedQuery ? groups : groups.filter((group) => group.id === activeGroup);
}

export function getNextSettingsGroupId(currentGroupId: string, key: string, groups: SettingsGroup[] = settingsGroups): SettingsGroupId | null {
  const currentIndex = groups.findIndex((group) => group.id === currentGroupId);
  if (currentIndex < 0) return null;
  if (key === 'ArrowDown' || key === 'ArrowRight') return groups[(currentIndex + 1) % groups.length].id;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return groups[(currentIndex - 1 + groups.length) % groups.length].id;
  if (key === 'Home') return groups[0].id;
  if (key === 'End') return groups[groups.length - 1].id;
  return null;
}

function translateSettingsModelText(t: Translator, key: string, fallback: string) {
  const translated = t(key as never);
  return translated === key ? fallback : translated;
}

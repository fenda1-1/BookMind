import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ReaderTocEdit, ReaderTocManifest } from '../features/reader-core/readerModel';
import { normalizeReaderSettings } from '../features/reader-core/readerSettings';
import { CorruptReaderRecordError, createSensitiveReaderStoragePayload, getReaderRecord, parseReaderRecord, quarantineReaderRecord, saveReaderRecord } from '../services/readerStorageService';
import type { ChapterRuleDraft } from '../services/settingsCenterService';
import type { ReaderBookmark, ReaderHighlight, ReaderHighlightColor, ReaderSettings, ReaderSettingsLevel } from '../types';
export type ReaderStoredPanelPlacement = 'floating' | 'sidebar';
export type ReaderStoredPanelPlacements = {
  ai: ReaderStoredPanelPlacement;
  rules: ReaderStoredPanelPlacement;
  settings: ReaderStoredPanelPlacement;
};

export type ReaderStoredState = {
  settings: ReaderSettings;
  activeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  aiCollapsed: boolean;
  tocOpen: boolean;
  settingsLevel: ReaderSettingsLevel;
  panelPlacements: ReaderStoredPanelPlacements;
};

export type ReaderBookBackupPayload = {
  schemaVersion?: number;
  exportedAt?: string;
  book?: { id?: string; title?: string; displayTitle?: string; contentHash?: string };
  state?: Partial<ReaderStoredState & { defaultHighlightColor: ReaderHighlightColor }>;
  highlights?: ReaderHighlight[];
  bookmarks?: ReaderBookmark[];
  tocEdits?: ReaderTocEdit[];
  aiNotes?: unknown[];
  flashcards?: unknown[];
};

type ReaderTocEditsExportPayload = {
  schema?: string;
  schemaVersion?: number;
  exportedAt?: string;
  book?: { id?: string; title?: string; displayTitle?: string; contentHash?: string };
  toc?: { sourceChapterCount?: number; visibleChapterCount?: number; hiddenChapterCount?: number };
  tocEdits?: unknown[];
  edits?: unknown[];
};

export type ReaderTocEditHistoryEntry = {
  id: string;
  label: string;
  createdAt: string;
};

export function skipReaderPersistence(settings: ReaderSettings) {
  return settings.privacyMode;
}

export function parseReaderBookBackup(raw: string): ReaderBookBackupPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderBookBackupPayload> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('state' in parsed) && !('tocEdits' in parsed) && !('aiNotes' in parsed) && !('flashcards' in parsed)) return null;
    if (!Array.isArray(parsed.highlights) || !Array.isArray(parsed.bookmarks)) return null;
    return parsed as ReaderBookBackupPayload;
  } catch {
    return null;
  }
}

export function parseReaderTocEditsImport(raw: string): { book?: ReaderTocEditsExportPayload['book']; tocEdits: ReaderTocEdit[] } {
  const parsed = JSON.parse(raw) as ReaderTocEditsExportPayload | unknown[] | null;
  const source = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as ReaderTocEditsExportPayload).tocEdits)
      ? (parsed as ReaderTocEditsExportPayload).tocEdits
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as ReaderTocEditsExportPayload).edits)
        ? (parsed as ReaderTocEditsExportPayload).edits
        : null;
  if (!source) throw new Error('missing-toc-edits');
  const tocEdits = source.slice(0, 2000).map(normalizeReaderTocEditImportItem).filter((edit): edit is ReaderTocEdit => Boolean(edit));
  if (!tocEdits.length) throw new Error('empty-toc-edits');
  return { book: Array.isArray(parsed) ? undefined : (parsed as ReaderTocEditsExportPayload).book, tocEdits };
}

function normalizeReaderTocEditImportItem(value: unknown): ReaderTocEdit | null {
  if (!isReaderTocEditBackupItem(value)) return null;
  const item = value as ReaderTocEdit;
  const metadata = {
    parserVersion: typeof item.parserVersion === 'string' ? item.parserVersion.slice(0, 40) : undefined,
    baseContentHash: typeof item.baseContentHash === 'string' ? item.baseContentHash.slice(0, 160) : undefined,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
  };
  if (item.type === 'rename') {
    const title = item.title.trim().slice(0, 160);
    if (!title) return null;
    return { type: 'rename', chapterId: item.chapterId, title, ...metadata };
  }
  if (item.type === 'split') {
    const title = item.title.trim().slice(0, 160);
    if (!title || !Number.isFinite(item.paragraphIndex)) return null;
    return { type: 'split', chapterId: item.chapterId, paragraphIndex: Math.max(1, Math.floor(item.paragraphIndex)), title, ...metadata };
  }
  return { type: item.type, chapterId: item.chapterId, ...metadata } as ReaderTocEdit;
}

export function isReaderHighlightBackupItem(value: unknown): value is ReaderHighlight {
  const item = value as Partial<ReaderHighlight> | null;
  return Boolean(item)
    && typeof item?.chapterIndex === 'number'
    && typeof item.paragraphIndex === 'number'
    && typeof item.startOffset === 'number'
    && typeof item.endOffset === 'number'
    && typeof item.text === 'string'
    && typeof item.note === 'string';
}

export function isReaderBookmarkBackupItem(value: unknown): value is ReaderBookmark {
  const item = value as Partial<ReaderBookmark> | null;
  return Boolean(item)
    && typeof item?.id === 'string'
    && typeof item.chapterIndex === 'number'
    && typeof item.paragraphIndex === 'number'
    && typeof item.screenPage === 'number'
    && typeof item.label === 'string'
    && typeof item.createdAt === 'string';
}

export function isReaderTocEditBackupItem(value: unknown): value is ReaderTocEdit {
  const item = value as Partial<ReaderTocEdit> | null;
  return Boolean(item)
    && (item?.type === 'rename' || item?.type === 'hide' || item?.type === 'unhide' || item?.type === 'split' || item?.type === 'merge-next')
    && typeof item.chapterId === 'string'
    && item.chapterId.length > 0
    && (item.type !== 'rename' || typeof item.title === 'string')
    && (item.type !== 'split' || (typeof item.title === 'string' && typeof item.paragraphIndex === 'number'));
}

export function isReaderHighlightColor(value: unknown): value is ReaderHighlightColor {
  return value === 'yellow' || value === 'green' || value === 'blue' || value === 'pink' || value === 'violet' || value === 'red';
}

export function loadReaderState(key: string): ReaderStoredState | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReaderStoredState>;
    return {
      settings: normalizeReaderSettings(parsed.settings),
      activeChapterIndex: Number(parsed.activeChapterIndex ?? 0),
      activeParagraphIndex: Number(parsed.activeParagraphIndex ?? 0),
      activeScreenPage: Number(parsed.activeScreenPage ?? 0),
      aiCollapsed: Boolean(parsed.aiCollapsed),
      tocOpen: parsed.tocOpen ?? true,
      settingsLevel: parsed.settingsLevel === 'advanced' ? 'advanced' : 'basic',
      panelPlacements: normalizeReaderPanelPlacements(parsed.panelPlacements),
    };
  } catch (error) {
    console.warn('Failed to load reader state:', error);
    return null;
  }
}

export async function restoreReaderState(bookId: string, legacyKey: string, onRecoverCorrupt: () => void): Promise<ReaderStoredState | null> {
  try {
    const record = await getReaderRecord(bookId, 'state');
    const stored = parseReaderRecord<ReaderStoredState | null>(record, null);
    if (stored) return {
      settings: normalizeReaderSettings(stored.settings),
      activeChapterIndex: Number(stored.activeChapterIndex ?? 0),
      activeParagraphIndex: Number(stored.activeParagraphIndex ?? 0),
      activeScreenPage: Number(stored.activeScreenPage ?? 0),
      aiCollapsed: Boolean(stored.aiCollapsed),
      tocOpen: stored.tocOpen ?? true,
      settingsLevel: stored.settingsLevel === 'advanced' ? 'advanced' : 'basic',
      panelPlacements: normalizeReaderPanelPlacements(stored.panelPlacements),
    };
  } catch (error) {
    if (error instanceof CorruptReaderRecordError) {
      await quarantineReaderRecord(error.record, error.reason);
      onRecoverCorrupt();
    }
    console.warn('Failed to load reader state from SQLite:', error);
  }
  const legacy = loadReaderState(legacyKey);
  if (legacy) {
    saveReaderRecord(bookId, 'state', legacy, WebviewWindow.getCurrent().label)
      .then(() => cleanupLegacyReaderStorage({ legacyKey }))
      .catch(() => undefined);
  }
  return legacy;
}

export async function loadReaderTocManifest(bookId: string, onRecoverCorrupt: () => void) {
  try {
    const record = await getReaderRecord(bookId, 'tocManifest');
    return await parseOrQuarantineReaderRecord<ReaderTocManifest | null>(record, null, onRecoverCorrupt);
  } catch (error) {
    console.warn('Failed to load reader TOC manifest from SQLite:', error);
    return null;
  }
}

export async function loadReaderChapterRulesOverride(bookId: string, onRecoverCorrupt: () => void) {
  try {
    const record = await getReaderRecord(bookId, 'chapterRulesOverride');
    return await parseOrQuarantineReaderRecord<Partial<ChapterRuleDraft> | null>(record, null, onRecoverCorrupt);
  } catch (error) {
    console.warn('Failed to load reader chapter rules override from SQLite:', error);
    return null;
  }
}

export async function restoreReaderCollection(bookId: string, highlightsKey: string, bookmarksKey: string, highlightColorKey: string, tocEditsKey: string, defaultHighlightColor: ReaderHighlightColor, encryptSensitiveReaderData: boolean, onRecoverCorrupt: () => void) {
  const fallback = {
    highlights: loadReaderHighlights(bookId, highlightsKey),
    bookmarks: loadJson<ReaderBookmark[]>(bookmarksKey, []),
    defaultHighlightColor: loadJson<ReaderHighlightColor>(highlightColorKey, defaultHighlightColor),
    tocEdits: loadJson<ReaderTocEdit[]>(tocEditsKey, []),
  };
  try {
    const [highlightsRecord, bookmarksRecord, colorRecord, tocRecord] = await Promise.all([
      getReaderRecord(bookId, 'highlights'),
      getReaderRecord(bookId, 'bookmarks'),
      getReaderRecord(bookId, 'highlightColor'),
      getReaderRecord(bookId, 'tocEdits'),
    ]);
    const restored = {
      highlights: await parseOrQuarantineReaderRecord(highlightsRecord, fallback.highlights, onRecoverCorrupt),
      bookmarks: await parseOrQuarantineReaderRecord(bookmarksRecord, fallback.bookmarks, onRecoverCorrupt),
      defaultHighlightColor: await parseOrQuarantineReaderRecord(colorRecord, fallback.defaultHighlightColor, onRecoverCorrupt),
      tocEdits: await parseOrQuarantineReaderRecord(tocRecord, fallback.tocEdits, onRecoverCorrupt),
    };
    if (!highlightsRecord && fallback.highlights.length) saveReaderRecord(bookId, 'highlights', createSensitiveReaderStoragePayload(fallback.highlights, encryptSensitiveReaderData), WebviewWindow.getCurrent().label).then(() => cleanupLegacyReaderStorage({ highlightsKey, highlightsBookId: bookId })).catch(() => undefined);
    if (!bookmarksRecord && fallback.bookmarks.length) saveReaderRecord(bookId, 'bookmarks', createSensitiveReaderStoragePayload(fallback.bookmarks, encryptSensitiveReaderData), WebviewWindow.getCurrent().label).then(() => cleanupLegacyReaderStorage({ bookmarksKey })).catch(() => undefined);
    if (!colorRecord) saveReaderRecord(bookId, 'highlightColor', fallback.defaultHighlightColor, WebviewWindow.getCurrent().label).then(() => cleanupLegacyReaderStorage({ highlightColorKey })).catch(() => undefined);
    if (!tocRecord && fallback.tocEdits.length) saveReaderRecord(bookId, 'tocEdits', createSensitiveReaderStoragePayload(fallback.tocEdits, encryptSensitiveReaderData), WebviewWindow.getCurrent().label).then(() => cleanupLegacyReaderStorage({ tocEditsKey })).catch(() => undefined);
    return restored;
  } catch (error) {
    console.warn('Failed to load reader collection from SQLite:', error);
    return fallback;
  }
}

async function parseOrQuarantineReaderRecord<T>(record: Awaited<ReturnType<typeof getReaderRecord>>, fallback: T, onRecoverCorrupt: () => void) {
  try {
    return parseReaderRecord<T>(record, fallback);
  } catch (error) {
    if (error instanceof CorruptReaderRecordError) {
      await quarantineReaderRecord(error.record, error.reason);
      onRecoverCorrupt();
      return fallback;
    }
    throw error;
  }
}

export function cleanupLegacyReaderStorage(keys: { legacyKey?: string; highlightsKey?: string; highlightsBookId?: string; bookmarksKey?: string; highlightColorKey?: string; tocEditsKey?: string }) {
  const { legacyKey, highlightsKey, highlightsBookId, bookmarksKey, highlightColorKey, tocEditsKey } = keys;
  if (legacyKey) window.localStorage.removeItem(legacyKey);
  if (highlightsKey) window.localStorage.removeItem(highlightsKey);
  if (highlightsBookId) cleanupReaderHighlightEntryStorage(highlightsBookId);
  if (bookmarksKey) window.localStorage.removeItem(bookmarksKey);
  if (highlightColorKey) window.localStorage.removeItem(highlightColorKey);
  if (tocEditsKey) window.localStorage.removeItem(tocEditsKey);
}

function cleanupReaderHighlightEntryStorage(bookId: string) {
  const indexKey = `bookmind:reader-highlights-index:${bookId}`;
  const entryPrefix = `bookmind:reader-highlight-entry:${bookId}:`;
  const ids = loadJson<string[]>(indexKey, []);
  ids.forEach((id) => window.localStorage.removeItem(`${entryPrefix}${id}`));
  window.localStorage.removeItem(indexKey);
}

function loadReaderHighlights(bookId: string, legacyKey: string) {
  const indexKey = `bookmind:reader-highlights-index:${bookId}`;
  const entryPrefix = `bookmind:reader-highlight-entry:${bookId}:`;
  const ids = loadJson<string[]>(indexKey, []);
  if (ids.length) {
    return ids.flatMap((id) => {
      const highlight = loadJson<ReaderHighlight | null>(`${entryPrefix}${id}`, null);
      return highlight ? [highlight] : [];
    });
  }
  const legacy = loadJson<ReaderHighlight[]>(legacyKey, []);
  if (legacy.length) saveReaderHighlights(bookId, legacy);
  return legacy;
}

export function trySaveReaderHighlights(bookId: string, highlights: ReaderHighlight[], onError?: (message: string) => void) {
  try {
    saveReaderHighlights(bookId, highlights);
  } catch (error) {
    console.warn('Failed to save reader highlights:', error);
    onError?.('Failed to save reader highlights locally. Export a backup before closing this window.');
  }
}

function saveReaderHighlights(bookId: string, highlights: ReaderHighlight[]) {
  const indexKey = `bookmind:reader-highlights-index:${bookId}`;
  const entryPrefix = `bookmind:reader-highlight-entry:${bookId}:`;
  const previousIds = loadJson<string[]>(indexKey, []);
  const nextIds = highlights.map((highlight) => highlight.id);
  const nextIdSet = new Set(nextIds);
  previousIds.forEach((id) => {
    if (!nextIdSet.has(id)) window.localStorage.removeItem(`${entryPrefix}${id}`);
  });
  highlights.forEach((highlight) => {
    window.localStorage.setItem(`${entryPrefix}${highlight.id}`, JSON.stringify(highlight));
  });
  window.localStorage.setItem(indexKey, JSON.stringify(nextIds));
}

export function saveReaderState(key: string, state: ReaderStoredState) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save reader state:', error);
  }
}

export function normalizeReaderPanelPlacements(input: unknown): ReaderStoredPanelPlacements {
  const value = input && typeof input === 'object' ? input as Partial<ReaderStoredPanelPlacements> : {};
  return {
    ai: normalizeReaderPanelPlacement(value.ai),
    rules: normalizeReaderPanelPlacement(value.rules),
    settings: normalizeReaderPanelPlacement(value.settings),
  };
}

function normalizeReaderPanelPlacement(value: unknown): ReaderStoredPanelPlacement {
  return value === 'sidebar' ? 'sidebar' : 'floating';
}

export function loadJson<T>(key: string, fallback: T): T {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch (error) {
    console.warn('Failed to load reader JSON:', error);
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T, onError?: (message: string) => void) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save reader JSON:', error);
    onError?.('Failed to save reader data locally. Export a backup before closing this window.');
  }
}

export function buildReaderAnnotationExportDefaultPath(directory: string, filename: string) {
  const trimmed = directory.trim();
  if (!trimmed) return filename;
  const separator = trimmed.includes('\\') ? '\\' : '/';
  return `${trimmed.replace(/[\\/]+$/, '')}${separator}${filename}`;
}

export function getReaderExportDirectory(path: string) {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return index > 0 ? path.slice(0, index) : '';
}

export function downloadReaderText(filename: string, payload: string, mime: string) {
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

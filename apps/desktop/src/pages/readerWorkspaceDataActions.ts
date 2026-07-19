import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { save } from '@tauri-apps/plugin-dialog';
import { isTauriRuntime } from '../app/platform';
import { getReaderTocEditHashStatus, type ReaderChapter, type ReaderTocEdit, type ReaderTocManifest } from '../features/reader-core/readerModel';
import { normalizeReaderSettings } from '../features/reader-core/readerSettings';
import { writeReaderExportFile } from '../services/readerExportService';
import { saveReaderRecord } from '../services/readerStorageService';
import { getPrivacyBookTitle, getPrivacyExportFileBaseName, type ChapterRuleDraft, type ExtendedSettings } from '../services/settingsCenterService';
import type { Book, Citation, ReaderBookmark, ReaderHighlight, ReaderSettings, ReaderSettingsLevel } from '../types';
import type { Translator } from '../i18n';
import { requestAppConfirm } from '../components/useAppConfirm';
import { downloadReaderText, parseReaderTocEditsImport, type ReaderTocEditHistoryEntry } from './readerWorkspaceStorage';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

type ReaderWorkspaceDataActionsContext = {
  book: Book | null;
  readerBook: Book | null;
  chapters: ReaderChapter[];
  sourceChapters: ReaderChapter[];
  hiddenChapters: ReaderChapter[];
  highlights: ReaderHighlight[];
  bookmarks: ReaderBookmark[];
  tocEdits: ReaderTocEdit[];
  citations: Citation[];
  settings: ReaderSettings;
  settingsLevel: ReaderSettingsLevel;
  chapterRules: ChapterRuleDraft;
  extendedSettings: ExtendedSettings;
  safeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  activeScreenPageCount: number;
  effectivePageWidth: number;
  aiCollapsed: boolean;
  tocOpen: boolean;
  standaloneReader: boolean;
  readerStorageError: string;
  stateKey: string;
  highlightsKey: string;
  bookmarksKey: string;
  tocEditsKey: string;
  tocContentHash: string;
  setSettings: StateSetter<ReaderSettings>;
  setSettingsLevel: StateSetter<ReaderSettingsLevel>;
  setBookChapterRulesOverride: StateSetter<Partial<ChapterRuleDraft> | null>;
  setBookChapterRulesOverrideLoaded: StateSetter<boolean>;
  setTocManifest: StateSetter<ReaderTocManifest | null>;
  setTocEdits: StateSetter<ReaderTocEdit[]>;
  setTocEditUndoStack: StateSetter<ReaderTocEdit[][]>;
  setTocEditRedoStack: StateSetter<ReaderTocEdit[][]>;
  setTocEditHistory: StateSetter<ReaderTocEditHistoryEntry[]>;
  applyReaderSettings: (settings: ReaderSettings) => void;
  createTocEditHistoryEntry: (label: string, createdAt?: string) => ReaderTocEditHistoryEntry;
  createTocEditHistoryFromEdits: (edits: ReaderTocEdit[], chapters: ReaderChapter[], t: Translator) => ReaderTocEditHistoryEntry[];
  markReaderStateChanged: () => void;
  t: Translator;
};

export function createReaderWorkspaceDataActions(context: ReaderWorkspaceDataActionsContext) {
  async function saveCurrentBookChapterRulesOverride(nextOverride?: Partial<ChapterRuleDraft>) {
    const { book, chapterRules } = context;
    if (!book) return;
    const override = { ...chapterRules, ...(nextOverride ?? {}) };
    context.setBookChapterRulesOverride(override);
    context.setBookChapterRulesOverrideLoaded(true);
    context.setTocManifest(null);
    await saveReaderRecord(book.id, 'chapterRulesOverride', override, WebviewWindow.getCurrent().label);
  }

  async function clearCurrentBookChapterRulesOverride() {
    const { book } = context;
    if (!book) return;
    context.setBookChapterRulesOverride(null);
    context.setBookChapterRulesOverrideLoaded(true);
    context.setTocManifest(null);
    await saveReaderRecord(book.id, 'chapterRulesOverride', null, WebviewWindow.getCurrent().label);
  }

  async function exportReaderSettings() {
    const { book, extendedSettings, settings, settingsLevel, t } = context;
    const filename = `${getPrivacyExportFileBaseName(book?.displayTitle || book?.title || 'bookmind', extendedSettings)}-reader-settings.json`;
    const payload = JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings,
      settingsLevel,
    }, null, 2);
    if (!isTauriRuntime()) {
      downloadReaderText(filename, payload, 'application/json;charset=utf-8');
      return;
    }
    try {
      const selectedPath = await save({
        title: t('reader.settings.export'),
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!selectedPath) return;
      await writeReaderExportFile(selectedPath, payload);
    } catch (error) {
      console.warn('Failed to export reader settings:', error);
      window.alert(t('reader.settings.exportFailed'));
    }
  }

  async function importReaderSettings(file: File) {
    const { t } = context;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<{ settings: Partial<ReaderSettings>; settingsLevel: ReaderSettingsLevel }>;
      if (!parsed.settings || typeof parsed.settings !== 'object') throw new Error('missing-settings');
      context.applyReaderSettings(normalizeReaderSettings(parsed.settings));
      if (parsed.settingsLevel === 'basic' || parsed.settingsLevel === 'advanced') context.setSettingsLevel(parsed.settingsLevel);
    } catch (error) {
      console.warn('Failed to import reader settings:', error);
      window.alert(t('reader.settings.importFailed'));
    }
  }

  async function exportReaderTocEdits() {
    const { book, extendedSettings, sourceChapters, chapters, hiddenChapters, tocEdits, tocContentHash, t } = context;
    if (!book) return;
    const rawTitle = book.displayTitle || book.title || 'bookmind';
    const title = getPrivacyBookTitle(rawTitle, extendedSettings);
    const filename = `${getPrivacyExportFileBaseName(rawTitle, extendedSettings)}-reader-toc-edits.json`;
    const payload = JSON.stringify({
      schema: 'bookmind.reader.toc-edits.v1',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      book: { id: book.id, title, displayTitle: title, contentHash: tocContentHash },
      toc: {
        sourceChapterCount: sourceChapters.length,
        visibleChapterCount: chapters.length,
        hiddenChapterCount: hiddenChapters.length,
      },
      tocEdits,
    }, null, 2);
    if (!isTauriRuntime()) {
      downloadReaderText(filename, payload, 'application/json;charset=utf-8');
      return;
    }
    try {
      const selectedPath = await save({
        title: t('reader.toc.exportEdits'),
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!selectedPath) return;
      await writeReaderExportFile(selectedPath, payload);
    } catch (error) {
      console.warn('Failed to export reader TOC edits:', error);
      window.alert(t('reader.toc.exportFailed'));
    }
  }

  async function importReaderTocEditsJson(file: File) {
    const { book, tocContentHash, tocEdits, sourceChapters, t } = context;
    if (!book) return;
    try {
      const parsed = parseReaderTocEditsImport(await file.text());
      const importedTocEdits = parsed.tocEdits;
      const hashStatus = getReaderTocEditHashStatus(importedTocEdits, tocContentHash);
      const sourceContentHash = parsed.book?.contentHash;
      const hasHashMismatch = Boolean(sourceContentHash && sourceContentHash !== tocContentHash) || hashStatus.status === 'mismatch';
      const sourceTitle = parsed.book?.displayTitle || parsed.book?.title || file.name;
      const confirmed = await requestAppConfirm(t(hasHashMismatch ? 'reader.toc.importHashMismatch' : 'reader.toc.importPreview', {
        title: sourceTitle,
        count: importedTocEdits.length,
        mismatchCount: hashStatus.mismatchedCount || importedTocEdits.length,
      }));
      if (!confirmed) return;
      context.setTocEditUndoStack((stack) => [...stack, tocEdits]);
      context.setTocEditRedoStack([]);
      context.setTocEdits(importedTocEdits);
      context.setTocEditHistory([
        context.createTocEditHistoryEntry(t('reader.toc.historyImport', { count: importedTocEdits.length })),
        ...context.createTocEditHistoryFromEdits(importedTocEdits, sourceChapters, t).slice(0, 4),
      ]);
      context.markReaderStateChanged();
    } catch (error) {
      console.warn('Failed to import reader TOC edits:', error);
      window.alert(t('reader.toc.importFailed'));
    }
  }

  function exportReaderDiagnostics() {
    const { book, readerBook, extendedSettings, safeChapterIndex, activeParagraphIndex, activeScreenPage, activeScreenPageCount, settings, effectivePageWidth, settingsLevel, aiCollapsed, tocOpen, standaloneReader, chapters, hiddenChapters, highlights, bookmarks, tocEdits, citations, readerStorageError, stateKey, highlightsKey, bookmarksKey, tocEditsKey } = context;
    const diagnosticBookTitle = book ? getPrivacyBookTitle(book.title, extendedSettings) : '';
    const diagnosticBookDisplayTitle = book ? getPrivacyBookTitle(book.displayTitle, extendedSettings) : '';
    const payload = JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      book: book ? { id: book.id, title: diagnosticBookTitle, displayTitle: diagnosticBookDisplayTitle, contentHash: book.contentHash, status: book.status, contentLength: readerBook?.content.length ?? 0, chunkCount: readerBook?.chunks.length ?? book.chunks.length } : null,
      reader: {
        activeChapterIndex: safeChapterIndex,
        activeParagraphIndex,
        activeScreenPage,
        activeScreenPageCount,
        settings,
        effectivePageWidth,
        settingsLevel,
        aiCollapsed,
        tocOpen,
        standaloneReader,
      },
      counts: {
        chapters: chapters.length,
        hiddenChapters: hiddenChapters.length,
        highlights: highlights.length,
        bookmarks: bookmarks.length,
        tocEdits: tocEdits.length,
        citations: citations.length,
      },
      storage: {
        hasReaderStorageError: Boolean(readerStorageError),
        stateKey,
        highlightsKey,
        bookmarksKey,
        tocEditsKey,
      },
    }, null, 2);
    downloadReaderText(`${getPrivacyExportFileBaseName(book?.displayTitle || book?.title || 'bookmind', extendedSettings)}-reader-diagnostics.json`, payload, 'application/json;charset=utf-8');
  }

  return {
    saveCurrentBookChapterRulesOverride,
    clearCurrentBookChapterRulesOverride,
    exportReaderSettings,
    importReaderSettings,
    exportReaderTocEdits,
    importReaderTocEditsJson,
    exportReaderDiagnostics,
  };
}

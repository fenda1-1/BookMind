import { save } from '@tauri-apps/plugin-dialog';
import type { Dispatch, SetStateAction } from 'react';
import { isTauriRuntime } from '../app/platform';
import {
  createReaderAnnotationAnchor,
  createReaderBookmark,
  deleteReaderBookmark,
  deleteReaderHighlight,
  deserializeReaderAnnotationsJson,
  filterReaderAnnotationExportContent,
  formatReaderAnnotationsCsv,
  formatReaderAnnotationsJson,
  formatReaderAnnotationsLogseqMarkdown,
  formatReaderAnnotationsMarkdown,
  formatReaderAnnotationsObsidianMarkdown,
  formatReaderAnnotationsReadwiseCsv,
  formatReaderHighlightsAnkiCsv,
  formatReaderHighlightsMarkdown,
  mergeReaderAnnotationsImport,
  previewReaderAnnotationsImport,
  updateReaderBookmarkDetails,
  updateReaderHighlightColor,
  updateReaderHighlightDetails,
  updateReaderHighlightNote,
} from '../features/reader-core/readerModel';
import type { ReaderChapter, ReaderHighlightRange, ReaderTocEdit } from '../features/reader-core/readerModel';
import { loadFlashcards, loadNotes } from '../services/noteService';
import { writeReaderExportFile } from '../services/readerExportService';
import {
  getPrivacyBookTitle,
  getPrivacyExportFileBaseName,
  loadExtendedSettings,
  saveExtendedSettings,
  type ExtendedSettings,
} from '../services/settingsCenterService';
import type { Book, ReaderBookmark, ReaderHighlight, ReaderHighlightColor, ReaderSettings, ReaderSettingsLevel } from '../types';
import { normalizeReaderSettings } from '../features/reader-core/readerSettings';
import type { Translator } from '../i18n';
import { requestAppConfirm } from '../components/useAppConfirm';
import {
  buildReaderAnnotationExportDefaultPath,
  downloadReaderText,
  getReaderExportDirectory,
  isReaderBookmarkBackupItem,
  isReaderHighlightBackupItem,
  isReaderHighlightColor,
  isReaderTocEditBackupItem,
  parseReaderBookBackup,
  type ReaderBookBackupPayload,
} from './readerWorkspaceStorage';

type ReaderWorkspaceAnnotationActionsContext = {
  book: Book | null;
  chapters: ReaderChapter[];
  sourceChapters: ReaderChapter[];
  highlights: ReaderHighlight[];
  bookmarks: ReaderBookmark[];
  tocEdits: ReaderTocEdit[];
  settings: ReaderSettings;
  safeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  activeScreenPageCount: number;
  aiCollapsed: boolean;
  tocOpen: boolean;
  settingsLevel: ReaderSettingsLevel;
  defaultHighlightColor: ReaderHighlightColor;
  extendedSettings: ExtendedSettings;
  setExtendedSettings: (settings: ExtendedSettings) => void;
  setSettings: (settings: ReaderSettings) => void;
  setActiveChapterIndex: (index: number) => void;
  setActiveParagraphIndex: (index: number) => void;
  setActiveScreenPage: (page: number) => void;
  setAiCollapsed: (collapsed: boolean) => void;
  setTocOpen: (open: boolean) => void;
  setSettingsLevel: (level: ReaderSettingsLevel) => void;
  setDefaultHighlightColor: (color: ReaderHighlightColor) => void;
  setHighlights: Dispatch<SetStateAction<ReaderHighlight[]>>;
  setBookmarks: Dispatch<SetStateAction<ReaderBookmark[]>>;
  setTocEdits: Dispatch<SetStateAction<ReaderTocEdit[]>>;
  setTocEditUndoStack: Dispatch<SetStateAction<ReaderTocEdit[][]>>;
  setTocEditRedoStack: Dispatch<SetStateAction<ReaderTocEdit[][]>>;
  setTocEditHistory: Dispatch<SetStateAction<ReaderTocEditHistoryEntry[]>>;
  createTocEditHistoryFromEdits: (edits: ReaderTocEdit[], chapters: ReaderChapter[], t: Translator) => ReaderTocEditHistoryEntry[];
  markReaderStateChanged: () => void;
  t: Translator;
};

type ReaderTocEditHistoryEntry = {
  id: string;
  label: string;
  createdAt: string;
};

export function createReaderWorkspaceAnnotationActions(context: ReaderWorkspaceAnnotationActionsContext) {
  function createHighlight(range: ReaderHighlightRange) {
    const { book, chapters, safeChapterIndex, extendedSettings } = context;
    if (!book) return;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `reader-highlight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const chapter = chapters.find((item) => item.index === range.chapterIndex) ?? chapters[safeChapterIndex];
    const anchor = chapter ? createReaderAnnotationAnchor(chapter, range.paragraphIndex, range.startOffset, range.endOffset) : {};
    const createdAt = new Date().toISOString();
    context.setHighlights((current) => [...current, { id, bookId: book.id, color: range.color ?? 'yellow', importance: extendedSettings.defaultHighlightImportance, reviewStatus: extendedSettings.defaultHighlightReviewStatus, createdAt, updatedAt: createdAt, ...range, ...anchor }]);
  }

  function updateHighlightColor(id: string, color: ReaderHighlightColor) {
    context.setHighlights((current) => updateReaderHighlightColor(current, id, color).map((highlight) => highlight.id === id ? { ...highlight, updatedAt: new Date().toISOString() } : highlight));
  }

  function clearHighlightNote(id: string) {
    context.setHighlights((current) => updateReaderHighlightNote(current, id, '').map((highlight) => highlight.id === id ? { ...highlight, updatedAt: new Date().toISOString() } : highlight));
  }

  function updateHighlightNote(id: string, note: string) {
    context.setHighlights((current) => updateReaderHighlightNote(current, id, note).map((highlight) => highlight.id === id ? { ...highlight, updatedAt: new Date().toISOString() } : highlight));
  }

  function updateHighlightDetails(id: string, updates: { tags?: string[]; importance?: 'normal' | 'high' | 'critical'; reviewStatus?: 'new' | 'due' | 'reviewed'; colorMeaning?: string; updatedAt?: string }) {
    context.setHighlights((current) => updateReaderHighlightDetails(current, id, updates));
  }

  function removeHighlight(id: string) {
    context.setHighlights((current) => deleteReaderHighlight(current, id));
  }

  function restoreHighlight(highlight: ReaderHighlightRange) {
    const { book } = context;
    if (!highlight.id || !book) return;
    context.setHighlights((current) => current.some((item) => item.id === highlight.id) ? current : [{ ...highlight, bookId: book.id, color: highlight.color ?? 'yellow', createdAt: new Date().toISOString() } as ReaderHighlight, ...current]);
  }

  function removeHighlights(ids: string[]) {
    const removals = new Set(ids);
    context.setHighlights((current) => current.filter((highlight) => !removals.has(highlight.id)));
  }

  function exportReaderHighlights(selectedHighlightIds?: Iterable<string>) {
    const { book, extendedSettings, chapters, highlights } = context;
    if (!book) return;
    const exportHighlights = selectedHighlightIds
      ? highlights.filter((highlight) => new Set(selectedHighlightIds).has(highlight.id))
      : highlights;
    const title = getPrivacyBookTitle(book.displayTitle || book.title || 'bookmind', extendedSettings);
    const filenameBase = getPrivacyExportFileBaseName(book.displayTitle || book.title || 'bookmind', extendedSettings);
    const markdown = formatReaderHighlightsMarkdown(title, chapters, exportHighlights);
    downloadReaderText(`${filenameBase}-reader-highlights.md`, markdown, 'text/markdown;charset=utf-8');
  }

  async function exportReaderAnnotations(
    format: 'json' | 'markdown' | 'csv' | 'anki' | 'obsidian' | 'logseq' | 'readwise' | 'backup',
    content = context.extendedSettings.annotationExportContent,
    selectedIds?: { highlightIds?: Iterable<string>; bookmarkIds?: Iterable<string> },
  ) {
    const { book, extendedSettings, highlights, bookmarks, settings, safeChapterIndex, activeParagraphIndex, activeScreenPage, aiCollapsed, tocOpen, settingsLevel, defaultHighlightColor, tocEdits, chapters, t } = context;
    if (!book) return;
    const rawTitle = book.displayTitle || book.title || 'bookmind';
    const title = getPrivacyBookTitle(rawTitle, extendedSettings);
    const filenameBase = getPrivacyExportFileBaseName(rawTitle, extendedSettings);
    const selectedHighlightIds = selectedIds?.highlightIds ? new Set(selectedIds.highlightIds) : null;
    const selectedBookmarkIds = selectedIds?.bookmarkIds ? new Set(selectedIds.bookmarkIds) : null;
    const scopedHighlights = selectedHighlightIds
      ? highlights.filter((highlight) => selectedHighlightIds.has(highlight.id))
      : highlights;
    const scopedBookmarks = selectedBookmarkIds
      ? bookmarks.filter((bookmark) => selectedBookmarkIds.has(bookmark.id))
      : bookmarks;
    const exportAnnotations = filterReaderAnnotationExportContent({ highlights: scopedHighlights, bookmarks: scopedBookmarks }, content);
    const [notes, flashcards] = format === 'backup' ? await Promise.all([loadNotes(), loadFlashcards()]) : [[], []];
    const payload = format === 'backup'
      ? JSON.stringify({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        book: { id: book.id, title, displayTitle: title, contentHash: book.contentHash },
        state: { settings, activeChapterIndex: safeChapterIndex, activeParagraphIndex, activeScreenPage, aiCollapsed, tocOpen, settingsLevel, defaultHighlightColor },
        highlights: exportAnnotations.highlights,
        bookmarks: exportAnnotations.bookmarks,
        tocEdits,
        aiNotes: notes.filter((note) => note.title.includes(book.displayTitle) || note.title.includes(book.title)),
        flashcards,
      }, null, 2)
      : format === 'json'
      ? formatReaderAnnotationsJson(exportAnnotations)
      : format === 'markdown'
        ? formatReaderAnnotationsMarkdown(title, chapters, exportAnnotations.highlights, exportAnnotations.bookmarks, { template: extendedSettings.annotationMarkdownTemplate })
        : format === 'anki'
          ? formatReaderHighlightsAnkiCsv(chapters, exportAnnotations.highlights, extendedSettings.ankiDefaultTags)
          : format === 'obsidian'
            ? formatReaderAnnotationsObsidianMarkdown(title, chapters, exportAnnotations.highlights, exportAnnotations.bookmarks, { wikiLinks: extendedSettings.obsidianWikiLinks })
            : format === 'logseq'
              ? formatReaderAnnotationsLogseqMarkdown(title, chapters, exportAnnotations.highlights, exportAnnotations.bookmarks, { propertyFormat: extendedSettings.logseqPropertyFormat })
              : format === 'readwise'
                ? formatReaderAnnotationsReadwiseCsv(chapters, exportAnnotations.highlights, exportAnnotations.bookmarks, title, book.author || extendedSettings.readwiseDefaultAuthor)
                : formatReaderAnnotationsCsv(chapters, exportAnnotations.highlights, exportAnnotations.bookmarks, { fields: extendedSettings.annotationCsvFields });
    const extension = format === 'json' || format === 'backup' ? 'json' : format === 'markdown' || format === 'obsidian' || format === 'logseq' ? 'md' : 'csv';
    const mime = format === 'json' || format === 'backup' ? 'application/json;charset=utf-8' : extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/csv;charset=utf-8';
    const filename = `${filenameBase}-reader-annotations-${format}.${extension}`;
    if (!isTauriRuntime()) {
      downloadReaderText(filename, payload, mime);
      return;
    }
    try {
      const selectedPath = await save({
        title: t('reader.annotations.exportSelected'),
        defaultPath: buildReaderAnnotationExportDefaultPath(extendedSettings.annotationExportLastDirectory, filename),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      });
      if (!selectedPath) return;
      await writeReaderExportFile(selectedPath, payload);
      rememberAnnotationExportDirectory(selectedPath);
    } catch (error) {
      console.warn('Failed to export reader annotations:', error);
      window.alert(t('reader.settings.exportFailed'));
    }
  }

  async function importReaderAnnotationsJson(file: File) {
    const { book, highlights, bookmarks, chapters, extendedSettings, t } = context;
    if (!book) return;
    const raw = await file.text();
    const backup = parseReaderBookBackup(raw);
    if (backup) {
      await restoreReaderBookBackup(backup);
      return;
    }
    const parsed = deserializeReaderAnnotationsJson<ReaderHighlight, ReaderBookmark>(raw);
    if (parsed.error) {
      window.alert(t('reader.annotations.importFailed'));
      return;
    }
    const preview = previewReaderAnnotationsImport({ highlights, bookmarks }, parsed, chapters);
    const confirmed = await requestAppConfirm(t('reader.annotations.importPreview', {
      highlightsAdded: preview.highlights.added,
      highlightsUpdated: preview.highlights.updated,
      highlightsDuplicates: preview.highlights.duplicates,
      highlightsUnresolved: preview.highlights.unresolved,
      bookmarksAdded: preview.bookmarks.added,
      bookmarksUpdated: preview.bookmarks.updated,
      bookmarksDuplicates: preview.bookmarks.duplicates,
      bookmarksUnresolved: preview.bookmarks.unresolved,
    }));
    if (!confirmed) return;
    const conflictStrategy = extendedSettings.annotationJsonImportConflictStrategy;
    context.setHighlights((current) => mergeReaderAnnotationsImport(current, parsed.highlights.filter((highlight) => highlight.bookId === book.id || !highlight.bookId).map((highlight) => ({ ...highlight, bookId: book.id })), conflictStrategy));
    context.setBookmarks((current) => mergeReaderAnnotationsImport(current, parsed.bookmarks.filter((bookmark) => bookmark.bookId === book.id || !bookmark.bookId).map((bookmark) => ({ ...bookmark, bookId: book.id })), conflictStrategy));
  }

  function rememberAnnotationExportDirectory(selectedPath: string) {
    const { extendedSettings } = context;
    const directory = getReaderExportDirectory(selectedPath);
    if (!directory || directory === extendedSettings.annotationExportLastDirectory) return;
    const latestSettings = loadExtendedSettings();
    const nextSettings = saveExtendedSettings({ ...latestSettings, annotationExportLastDirectory: directory }, { key: 'annotationExportLastDirectory' });
    context.setExtendedSettings(nextSettings);
  }

  async function restoreReaderBookBackup(backup: ReaderBookBackupPayload) {
    const { book, t, chapters, sourceChapters } = context;
    if (!book) return;
    const sourceTitle = backup.book?.displayTitle || backup.book?.title || t('reader.annotations.backupUnknownBook');
    const confirmed = await requestAppConfirm(t('reader.annotations.restoreBackupPreview', {
      title: sourceTitle,
      highlights: backup.highlights?.length ?? 0,
      bookmarks: backup.bookmarks?.length ?? 0,
      tocEdits: backup.tocEdits?.length ?? 0,
    }));
    if (!confirmed) return;
    const backupState = backup.state;
    if (backupState?.settings) context.setSettings(normalizeReaderSettings(backupState.settings));
    if (typeof backupState?.activeChapterIndex === 'number') context.setActiveChapterIndex(Math.min(Math.max(0, backupState.activeChapterIndex), Math.max(0, chapters.length - 1)));
    if (typeof backupState?.activeParagraphIndex === 'number') context.setActiveParagraphIndex(Math.max(0, backupState.activeParagraphIndex));
    if (typeof backupState?.activeScreenPage === 'number') context.setActiveScreenPage(Math.max(0, backupState.activeScreenPage));
    if (typeof backupState?.aiCollapsed === 'boolean') context.setAiCollapsed(backupState.aiCollapsed);
    if (typeof backupState?.tocOpen === 'boolean') context.setTocOpen(backupState.tocOpen);
    if (backupState?.settingsLevel === 'basic' || backupState?.settingsLevel === 'advanced') context.setSettingsLevel(backupState.settingsLevel);
    if (isReaderHighlightColor(backupState?.defaultHighlightColor)) context.setDefaultHighlightColor(backupState.defaultHighlightColor);
    if (Array.isArray(backup.highlights)) context.setHighlights(backup.highlights.filter(isReaderHighlightBackupItem).map((highlight) => ({ ...highlight, bookId: book.id })));
    if (Array.isArray(backup.bookmarks)) context.setBookmarks(backup.bookmarks.filter(isReaderBookmarkBackupItem).map((bookmark) => ({ ...bookmark, bookId: book.id })));
    if (Array.isArray(backup.tocEdits)) {
      const restoredTocEdits = backup.tocEdits.filter(isReaderTocEditBackupItem);
      context.setTocEdits(restoredTocEdits);
      context.setTocEditUndoStack([]);
      context.setTocEditRedoStack([]);
      context.setTocEditHistory(context.createTocEditHistoryFromEdits(restoredTocEdits, sourceChapters, t));
    }
    context.markReaderStateChanged();
  }

  function createBookmark() {
    const { book, chapters, safeChapterIndex, activeScreenPageCount, activeScreenPage, t, activeParagraphIndex, settings, extendedSettings } = context;
    if (!book) return;
    const chapter = chapters[safeChapterIndex];
    const pageCount = Math.max(1, activeScreenPageCount);
    const bookmarkPage = Math.min(Math.max(0, activeScreenPage), pageCount - 1);
    const label = `${chapter?.title ?? getPrivacyBookTitle(book.displayTitle || book.title, extendedSettings)} · ${t('reader.pageMeter', { current: bookmarkPage + 1, total: pageCount })}`;
    const createdAt = new Date().toISOString();
    const spreadSize = settings.pageMode === 'double' ? 2 : 1;
    const bookmark = createReaderBookmark(book.id, chapter?.index ?? safeChapterIndex, activeParagraphIndex, bookmarkPage, label, createdAt, {
      chapterId: chapter?.id,
      sourceChapterIndex: chapter?.index,
      spreadIndex: Math.floor(bookmarkPage / spreadSize),
      pageInSpread: bookmarkPage % spreadSize,
      tags: parseDefaultBookmarkTags(extendedSettings.defaultBookmarkTags),
      color: extendedSettings.defaultBookmarkColor,
      title: extendedSettings.bookmarkTitleFromChapter ? chapter?.title : undefined,
      updatedAt: createdAt,
    });
    context.setBookmarks((current) => [bookmark, ...current]);
  }

  function removeBookmark(id: string) {
    context.setBookmarks((current) => deleteReaderBookmark(current, id));
  }

  function restoreBookmark(bookmark: ReaderBookmark) {
    context.setBookmarks((current) => current.some((item) => item.id === bookmark.id) ? current : [bookmark, ...current]);
  }

  function updateBookmark(id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }) {
    context.setBookmarks((current) => updateReaderBookmarkDetails(current, id, updates));
  }

  return {
    createHighlight,
    updateHighlightColor,
    clearHighlightNote,
    updateHighlightNote,
    updateHighlightDetails,
    removeHighlight,
    restoreHighlight,
    removeHighlights,
    exportReaderHighlights,
    exportReaderAnnotations,
    importReaderAnnotationsJson,
    createBookmark,
    removeBookmark,
    restoreBookmark,
    updateBookmark,
  };
}

function parseDefaultBookmarkTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

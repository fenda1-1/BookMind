import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauriRuntime } from './platform';
import { importBookFiles, importBookFromPath, importBooksFromDirectory, loadLibraryBooks, moveBookToTrash, permanentlyDeleteBook, restoreBookFromTrash, saveBookMetadata, emptyTrash, scanBookImportDirectory, type DirectoryImportFileSelection, type DirectoryImportResult } from '../services/libraryService';
import { getPrivacyFilePath, shouldHideRecentReading } from '../services/settingsCenterService';
import { recordOverviewReadingProgress } from '../features/overview/readingStatsService';
import { shouldApplyReadingProgressUpdate, shouldRecordReadingStatsSample } from '../features/overview/readingProgressModel';
import { buildImportDialogOptions, buildImportSummaryToast, buildTxtImportCleanupOptions, canOpenReaderOnStartup, confirmExternalPathOpen, clearLastReaderBookId, maybeCreateStartupAutoDataBackup, mergeLibraryMetadataBooks, openFirstImportedBookAfterDirectoryImport, refreshLibraryMetadataOnStartup, resolveStartupReaderBookId, saveLastReaderBookId, saveImportedBookTocManifests, shouldRunImportTocParsing, showTaskCenterForLongOperation, stripBookDocumentPayload, stripBookDocumentPayloads } from './appShellModel';
import { autoIndexOpenedReaderBook, runAppParseAndIndexTasks, shouldAutoIndexOpenedReaderBook, type AppTaskActionContext } from './appTaskActions';
import type { AppState } from './AppStateContext';
import type { Translator } from '../i18n';
import type { Book, SearchResult, IndexDiagnostics } from '../types';
import { openStandaloneReaderWindow } from '../pages/reader-workspace/readerWindowLauncher';
import { subscribeLibraryUpdated } from '../services/appDomainEvents';
import { recordLifecycleDiagnostic } from '../services/lifecycleDiagnosticsService';

export function useLibrary(
  appState: AppState,
  t: Translator,
  standaloneReader: boolean,
  standaloneBookId: string | null,
  book: Book | null,
  selectedBookIndexView: Record<string, unknown> | null,
  indexDiagnostics: IndexDiagnostics | null,
  autoIndexOpenedBookKeysRef: React.MutableRefObject<Set<string>>,
  readingProgressSaveTimersRef: React.MutableRefObject<Map<string, number>>,
  taskContext: AppTaskActionContext,
) {
  const { extendedSettings, chapterRules, activePage, books, setBooks, setSelectedBookId, setActivePage,
    setRestoreStartupReaderPosition, setLibraryLoadError, setImportSummaryToast, setReaderIndexing } = appState;
  const booksRef = useRef<Book[]>([]);
  const readingProgressPageRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { booksRef.current = books; }, [books]);

  useEffect(() => {
    const loadStartedAt = performance.now();
    recordLifecycleDiagnostic('performance', 'library.load-started');
    loadLibraryBooks().then((loaded) => {
      const metadataBooks = stripBookDocumentPayloads(loaded);
      setLibraryLoadError(''); setBooks(metadataBooks);
      const canRestoreStartupReader = standaloneReader || canOpenReaderOnStartup(
        extendedSettings.startupPage,
        extendedSettings.visibleNavItems,
        extendedSettings.booksOpenInStandaloneReader,
        extendedSettings.openLastReaderBookOnStartup,
      );
      const id = resolveStartupReaderBookId(standaloneBookId, loaded, canRestoreStartupReader, !shouldHideRecentReading(extendedSettings));
      setSelectedBookId((c) => (id ?? (c && metadataBooks.some((i) => i.id === c && !i.deleted) ? c : metadataBooks.find((i) => !i.deleted)?.id ?? null)));
      if (!standaloneReader && id && canRestoreStartupReader) { setRestoreStartupReaderPosition(extendedSettings.restoreLastReaderPositionOnStartup); setActivePage('reader'); }
      recordLifecycleDiagnostic('performance', 'library.loaded', { durationMs: Math.round(performance.now() - loadStartedAt), bookCount: metadataBooks.length, standaloneReader });
    }).catch((e) => { console.error(e); recordLifecycleDiagnostic('performance', 'library.load-failed', { durationMs: Math.round(performance.now() - loadStartedAt), standaloneReader }); setLibraryLoadError(e instanceof Error ? e.message : String(e)); });
  }, []);

  useEffect(() => { if (shouldHideRecentReading(extendedSettings)) clearLastReaderBookId(); }, [extendedSettings.recordRecentReaderBooks]);
  useEffect(() => { if (!extendedSettings.refreshLibraryMetadataOnStartup) return; let c = false; refreshLibraryMetadataOnStartup().then((r) => { if (!c) setBooks((cur) => mergeLibraryMetadataBooks(cur, r)); }).catch(() => {}); return () => { c = true; }; }, [extendedSettings.refreshLibraryMetadataOnStartup]);
  useEffect(() => { if (!standaloneReader) void maybeCreateStartupAutoDataBackup(extendedSettings); }, [extendedSettings.dataAutoBackupEnabled, standaloneReader]);

  useEffect(() => {
    function reload(d?: { bookId?: string; openReader?: boolean }) { loadLibraryBooks().then((loaded) => { const metadataBooks = stripBookDocumentPayloads(loaded); setBooks(metadataBooks); setSelectedBookId((c) => (d?.bookId && metadataBooks.some((i) => i.id === d.bookId && !i.deleted) ? d.bookId : c && metadataBooks.some((i) => i.id === c && !i.deleted) ? c : metadataBooks.find((i) => !i.deleted)?.id ?? null)); if (d?.openReader) setActivePage('reader'); }).catch(() => {}); }
    return subscribeLibraryUpdated(reload);
  }, []);

  useEffect(() => {
    if (!book || activePage !== 'reader' || !selectedBookIndexView) return;
    const v = selectedBookIndexView;
    if (!shouldAutoIndexOpenedReaderBook(book, { status: v.status ?? 'missing', ready: Boolean(v.ready), missing: v.status === 'missing', stale: v.status === 'stale', failed: v.status === 'failed', staleReason: (v.staleReason as string) ?? '', chunkCount: (v.chunkCount as number) ?? 0, ftsRows: (v.ftsRows as number) ?? 0 } as Parameters<typeof shouldAutoIndexOpenedReaderBook>[1], indexDiagnostics)) return;
    const key = [book.id, book.contentHash, v.status, v.staleReason].join(':');
    if (autoIndexOpenedBookKeysRef.current.has(key)) return;
    autoIndexOpenedBookKeysRef.current.add(key);
    void autoIndexOpenedReaderBook(book, (v.status as string) ?? 'missing', key, taskContext, autoIndexOpenedBookKeysRef);
  }, [activePage, book?.id]);

  function markBookOpened(bookId: string) {
    if (shouldHideRecentReading(extendedSettings)) return;
    const openedAt = new Date().toISOString();
    const existing = booksRef.current.find((item) => item.id === bookId && !item.deleted);
    if (!existing) return;
    const nextBook = { ...existing, lastOpenedAt: openedAt };
    booksRef.current = booksRef.current.map((item) => item.id === bookId ? nextBook : item);
    setBooks((current) => current.map((item) => item.id === bookId ? { ...item, lastOpenedAt: openedAt } : item));
    void saveBookMetadata(nextBook).catch(() => undefined);
  }

  const updateBook = useCallback(async (b: Book) => { setBooks((c) => c.map((i) => i.id === b.id ? stripBookDocumentPayload(b) : i)); try { const s = await saveBookMetadata(b); setBooks((c) => c.map((i) => i.id === s.id ? stripBookDocumentPayload(s) : i)); } catch { setBooks(stripBookDocumentPayloads(await loadLibraryBooks())); } }, [setBooks]);
  const importBook = useCallback(async (path: string) => {
    if (!await confirmExternalPathOpen(getPrivacyFilePath(path, extendedSettings), extendedSettings.confirmOpenExternalPath, 'file')) return;
    const opts = buildTxtImportCleanupOptions(extendedSettings.autoCleanTxtOnImport, extendedSettings.txtImportEncodingMode, extendedSettings.autoBackupImportedOriginals, extendedSettings.defaultCoverToneStrategy, extendedSettings.defaultCoverLabelStrategy, extendedSettings.cleanTitleFromFilename, extendedSettings.autoDetectAuthor, chapterRules);
    const imported = await importBookFromPath(path, opts);
    const importedMetadata = stripBookDocumentPayload(imported);
    setBooks((c) => { const ex = c.some((i) => i.id === imported.id); return ex ? c.map((i) => i.id === imported.id ? importedMetadata : i) : [...c, importedMetadata]; });
    setSelectedBookId(imported.id);
    if (extendedSettings.showImportSummaryAfterImport) setImportSummaryToast(buildImportSummaryToast('file', [imported]));
    if (extendedSettings.openImportedBookAfterImport) saveLastReaderBookId(imported.id, !shouldHideRecentReading(extendedSettings));
    setActivePage(extendedSettings.openImportedBookAfterImport ? 'reader' : 'library');
    if (shouldRunImportTocParsing(extendedSettings.autoParseTocOnImport, [imported])) await saveImportedBookTocManifests([imported], chapterRules);
    if (extendedSettings.autoIndexImportedBooks) { void runAppParseAndIndexTasks('import', taskContext); if (extendedSettings.autoShowTaskCenterForLongOperations) setActivePage('tasks'); }
  }, [extendedSettings, chapterRules, setBooks, setSelectedBookId, setActivePage, setImportSummaryToast]);
  const importDirectory = useCallback(async (path: string) => {
    if (!await confirmExternalPathOpen(getPrivacyFilePath(path, extendedSettings), extendedSettings.confirmOpenExternalPath, 'directory')) return;
    showTaskCenterForLongOperation(extendedSettings.autoShowTaskCenterForLongOperations, setActivePage);
    const opts = buildTxtImportCleanupOptions(extendedSettings.autoCleanTxtOnImport, extendedSettings.txtImportEncodingMode, extendedSettings.autoBackupImportedOriginals, extendedSettings.defaultCoverToneStrategy, extendedSettings.defaultCoverLabelStrategy, extendedSettings.cleanTitleFromFilename, extendedSettings.autoDetectAuthor, chapterRules);
    const result = await importBooksFromDirectory(path, extendedSettings.directoryImportRecursive, extendedSettings.continueDirectoryImportAfterFailure, opts);
    await applyDirectoryImportResult(result);
  }, [extendedSettings, chapterRules, setActivePage]);

  const scanDirectoryImportPreview = useCallback(async (path: string) => {
    if (!await confirmExternalPathOpen(getPrivacyFilePath(path, extendedSettings), extendedSettings.confirmOpenExternalPath, 'directory')) return null;
    return await scanBookImportDirectory(path, extendedSettings.directoryImportRecursive);
  }, [extendedSettings]);

  const importDirectoryFileSelection = useCallback(async (files: DirectoryImportFileSelection[]) => {
    if (files.length === 0) return { books: [], failedCount: 0 };
    showTaskCenterForLongOperation(extendedSettings.autoShowTaskCenterForLongOperations, setActivePage);
    const opts = buildTxtImportCleanupOptions(extendedSettings.autoCleanTxtOnImport, extendedSettings.txtImportEncodingMode, extendedSettings.autoBackupImportedOriginals, extendedSettings.defaultCoverToneStrategy, extendedSettings.defaultCoverLabelStrategy, extendedSettings.cleanTitleFromFilename, extendedSettings.autoDetectAuthor, chapterRules);
    const result = await importBookFiles(files, extendedSettings.continueDirectoryImportAfterFailure, opts);
    await applyDirectoryImportResult(result);
    return result;
  }, [extendedSettings, chapterRules, setActivePage]);

  async function applyDirectoryImportResult(result: DirectoryImportResult) {
    setBooks((c) => { const n = [...c]; for (const b of stripBookDocumentPayloads(result.books)) { const i = n.findIndex((item) => item.id === b.id); if (i >= 0) n[i] = b; else n.push(b); } return n; });
    const target = openFirstImportedBookAfterDirectoryImport(result.books, extendedSettings.openImportedBookAfterImport);
    setSelectedBookId(target.bookId);
    if (extendedSettings.showImportSummaryAfterImport) setImportSummaryToast(buildImportSummaryToast('directory', result.books, result.failedCount));
    if (target.bookId && target.targetPage === 'reader') saveLastReaderBookId(target.bookId, !shouldHideRecentReading(extendedSettings));
    setActivePage(target.targetPage);
    if (extendedSettings.autoParseTocOnImport) { const need = result.books.filter((b) => shouldRunImportTocParsing(true, [b])); if (need.length > 0) await saveImportedBookTocManifests(need, chapterRules); }
    if (extendedSettings.autoIndexImportedBooks) { void runAppParseAndIndexTasks('import', taskContext); if (extendedSettings.autoShowTaskCenterForLongOperations) setActivePage('tasks'); }
  }

  const trashBook = useCallback(async (id: string) => { const u = await moveBookToTrash(id); setBooks((c) => c.map((i) => i.id === u.id ? { ...i, ...u } : i)); setSelectedBookId((c) => c === id ? booksRef.current.find((i) => i.id !== id && !i.deleted)?.id ?? null : c); }, [setBooks, setSelectedBookId]);
  const restoreBook = useCallback(async (id: string) => { const r = await restoreBookFromTrash(id); setBooks((c) => c.map((i) => i.id === r.id ? { ...i, ...r } : i)); }, [setBooks]);
  const deleteBookForever = useCallback(async (id: string) => { const n = stripBookDocumentPayloads(await permanentlyDeleteBook(id)); setBooks(n); setSelectedBookId((c) => c === id ? n.find((i) => !i.deleted)?.id ?? null : c); }, [setBooks, setSelectedBookId]);
  const clearTrash = useCallback(async () => { const n = stripBookDocumentPayloads(await emptyTrash(true)); setBooks(n); setSelectedBookId((c) => c && n.some((i) => i.id === c && !i.deleted) ? c : n.find((i) => !i.deleted)?.id ?? null); }, [setBooks, setSelectedBookId]);
  const updateBookReadingProgress = useCallback((bookId: string, progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => {
    const np = Math.min(100, Math.max(0, Math.round(progress))); const e = booksRef.current.find((i) => i.id === bookId && !i.deleted); if (!e) return;
    const previousProgress = e.progress;
    const shouldUpdateProgress = shouldApplyReadingProgressUpdate(e.progress, np);
    const minutesRead = detail?.minutesRead ?? 0;
    const previousPageCurrent = readingProgressPageRef.current.get(bookId);
    if (Number.isFinite(detail?.pageCurrent)) readingProgressPageRef.current.set(bookId, detail!.pageCurrent);
    if (!shouldRecordReadingStatsSample({ currentProgress: previousProgress, nextProgress: np, previousPageCurrent, pageCurrent: detail?.pageCurrent, minutesRead })) return;
    if (shouldUpdateProgress) {
      const nb = { ...e, progress: np }; setBooks((c) => c.map((i) => i.id === bookId ? nb : i)); booksRef.current = booksRef.current.map((i) => i.id === bookId ? nb : i);
    }
    if (np >= previousProgress || minutesRead > 0) {
      void recordOverviewReadingProgress(bookId, {
        date: detail?.timestamp ?? new Date().toISOString(),
        progress: np,
        previousProgress,
        pageCount: detail?.pageCount,
        pageCurrent: detail?.pageCurrent,
        previousPageCurrent,
        minutesRead,
        chapterTitle: detail?.chapterTitle,
        updatedAt: detail?.timestamp ?? new Date().toISOString(),
      });
    }
    if (!shouldUpdateProgress) return;
    const et = readingProgressSaveTimersRef.current.get(bookId); if (et) window.clearTimeout(et);
    readingProgressSaveTimersRef.current.set(bookId, window.setTimeout(() => { readingProgressSaveTimersRef.current.delete(bookId); const lb = booksRef.current.find((i) => i.id === bookId && !i.deleted); if (lb) void saveBookMetadata({ ...lb, progress: Math.max(lb.progress, np) }); }, 800));
  }, [setBooks]);
  const openBook = useCallback((id: string) => {
    performance.mark('bookmind:reader-open-request', { detail: { bookId: id } });
    recordLifecycleDiagnostic('performance', 'reader.open-requested', { bookId: id, standalone: extendedSettings.booksOpenInStandaloneReader && isTauriRuntime() });
    saveLastReaderBookId(id, !shouldHideRecentReading(extendedSettings));
    markBookOpened(id);
    setRestoreStartupReaderPosition(true);
    setSelectedBookId(id);
    if (extendedSettings.booksOpenInStandaloneReader && isTauriRuntime()) {
      const target = booksRef.current.find((item) => item.id === id && !item.deleted);
      if (target) void openStandaloneReaderWindow({ book: target, extendedSettings, t });
      return;
    }
    setActivePage('reader');
  }, [extendedSettings, t, setRestoreStartupReaderPosition, setSelectedBookId, setActivePage]);
  const openReaderFromSearch = useCallback((result?: SearchResult) => { setRestoreStartupReaderPosition(true); if (result) { saveLastReaderBookId(result.bookId, !shouldHideRecentReading(extendedSettings)); markBookOpened(result.bookId); setSelectedBookId(result.bookId); } setActivePage('reader'); }, [extendedSettings, setRestoreStartupReaderPosition, setSelectedBookId, setActivePage]);
  const chooseBookFile = useCallback(async () => { if (!isTauriRuntime()) throw new Error(t('app.browserPreviewUnavailable')); const s = await open(buildImportDialogOptions('file', extendedSettings.defaultImportPath, extendedSettings.importFileFilter, t)); if (typeof s !== 'string') return; await importBook(s); }, [extendedSettings, t, importBook]);
  const chooseBookDirectory = useCallback(async () => { if (!isTauriRuntime()) throw new Error(t('app.browserPreviewUnavailable')); const s = await open(buildImportDialogOptions('directory', extendedSettings.defaultImportPath, extendedSettings.importFileFilter, t)); if (typeof s !== 'string') return null; return await scanDirectoryImportPreview(s); }, [extendedSettings, t, scanDirectoryImportPreview]);
  const runParseIndexFromReader = useCallback(async () => { setReaderIndexing(true); try { await runAppParseAndIndexTasks('reader', taskContext); if (!extendedSettings.autoShowTaskCenterForLongOperations) setActivePage('reader'); } catch (e) { console.error(e); } finally { setReaderIndexing(false); } }, [extendedSettings, setActivePage, setReaderIndexing, taskContext]);

  return { updateBook, updateBookReadingProgress, importBook, importDirectory, scanDirectoryImportPreview, importDirectoryFileSelection, trashBook, restoreBook, deleteBookForever, clearTrash, openBook, openReaderFromSearch, chooseBookFile, chooseBookDirectory, runParseIndexFromReader };
}

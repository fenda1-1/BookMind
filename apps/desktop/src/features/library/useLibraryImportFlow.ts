import { useState } from 'react';
import type { Translator } from '../../i18n';
import type { DirectoryImportFileSelection, DirectoryImportResult, DirectoryImportScanResult } from '../../services/libraryService';
import type { Book } from '../../types';
import type { LibraryTab } from './libraryCollectionModel';

type UseLibraryImportFlowInput = {
  books: Book[];
  t: Translator;
  onScanDirectoryImport: (path: string) => Promise<DirectoryImportScanResult | null>;
  onImportBook: (path: string) => Promise<void>;
  onImportBookFiles: (files: DirectoryImportFileSelection[]) => Promise<DirectoryImportResult>;
  onChooseBookFile: () => Promise<void>;
  onChooseBookDirectory: () => Promise<void>;
  onImported: () => void;
  onCloseToolbarPopover: () => void;
};

export function useLibraryImportFlow({ books, t, onScanDirectoryImport, onImportBook, onImportBookFiles, onChooseBookFile, onChooseBookDirectory, onImported, onCloseToolbarPopover }: UseLibraryImportFlowInput) {
  const [importPath, setImportPath] = useState('');
  const [importError, setImportError] = useState('');
  const [importFeedback, setImportFeedback] = useState('');
  const [importing, setImporting] = useState(false);
  const [directoryImportPreview, setDirectoryImportPreview] = useState<DirectoryImportScanResult | null>(null);
  const [directoryImportSelectedPaths, setDirectoryImportSelectedPaths] = useState<string[]>([]);
  const [directoryImportDisplayNames, setDirectoryImportDisplayNames] = useState<Record<string, string>>({});

  function openDirectoryImportPreview(preview: DirectoryImportScanResult) {
    setDirectoryImportPreview(preview);
    setDirectoryImportSelectedPaths(preview.files.map((file) => file.path));
    setDirectoryImportDisplayNames(Object.fromEntries(preview.files.map((file) => [file.path, file.displayName])));
    onCloseToolbarPopover();
    setImportFeedback(preview.files.length === 0 ? t('library.importPreview.empty') : '');
  }

  async function scanDirectoryImportPath(path: string) {
    const preview = await onScanDirectoryImport(path);
    if (preview) openDirectoryImportPreview(preview);
  }

  function toggleDirectoryImportFile(path: string) {
    setDirectoryImportSelectedPaths((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path]);
  }

  function selectAllDirectoryImportFiles() {
    if (!directoryImportPreview) return;
    setDirectoryImportSelectedPaths(directoryImportPreview.files.map((file) => file.path));
  }

  function clearDirectoryImportSelection() {
    setDirectoryImportSelectedPaths([]);
  }

  function updateDirectoryImportDisplayName(path: string, value: string) {
    setDirectoryImportDisplayNames((current) => ({ ...current, [path]: value }));
  }

  function cancelDirectoryImportPreview() {
    setDirectoryImportPreview(null);
    setDirectoryImportSelectedPaths([]);
    setDirectoryImportDisplayNames({});
    setImporting(false);
  }

  async function confirmDirectoryImportSelection() {
    if (!directoryImportPreview || directoryImportSelectedPaths.length === 0) return;
    setImporting(true);
    setImportError('');
    setImportFeedback('');
    try {
      const selectedFiles = directoryImportPreview.files
        .filter((file) => directoryImportSelectedPaths.includes(file.path))
        .map((file) => ({ path: file.path, displayName: (directoryImportDisplayNames[file.path] ?? file.displayName).trim() || file.displayName }));
      const result = await onImportBookFiles(selectedFiles);
      cancelDirectoryImportPreview();
      setImportPath('');
      onImported();
      setImportFeedback(result.books.length > 0 ? t('library.importFeedback.success', { count: result.books.length }) : t('library.importFeedback.empty'));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  async function submitImport(mode: 'file' | 'directory') {
    const path = importPath.trim();
    if (!path) return;
    setImporting(true);
    setImportError('');
    setImportFeedback('');
    try {
      const before = books.length;
      if (mode === 'directory') {
        await scanDirectoryImportPath(path);
        return;
      }
      await onImportBook(path);
      setImportPath('');
      onImported();
      setImportFeedback(t('library.importFeedback.success', { count: Math.max(1, books.length - before + 1) }));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  async function chooseFile() {
    setImportError('');
    setImportFeedback('');
    setImporting(true);
    try {
      await onChooseBookFile();
      setImportPath('');
      onImported();
      setImportFeedback(t('library.importFeedback.success', { count: 1 }));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  async function chooseDirectory() {
    setImportError('');
    setImportFeedback('');
    setImporting(true);
    try {
      await onChooseBookDirectory();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  return {
    importPath, setImportPath, importError, setImportError, importFeedback, importing,
    directoryImportPreview, directoryImportSelectedPaths, directoryImportDisplayNames,
    openDirectoryImportPreview, toggleDirectoryImportFile, selectAllDirectoryImportFiles,
    clearDirectoryImportSelection, updateDirectoryImportDisplayName, cancelDirectoryImportPreview,
    confirmDirectoryImportSelection, submitImport, chooseFile, chooseDirectory,
  };
}

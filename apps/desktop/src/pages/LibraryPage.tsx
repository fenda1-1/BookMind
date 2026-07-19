import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { BookMindIcon } from '../components/BookMindIcon';
import { requestAppConfirm } from '../components/useAppConfirm';
import { useI18n } from '../i18n';
import { findBookIndexManifest, loadSharedIndexDiagnostics, tasksUpdatedEvent } from '../services/indexDiagnosticsService';
import { loadAppSettings } from '../services/settingsService';
import { getPrivacyBookTitle, getPrivacyFileName, getPrivacyFilePath, loadExtendedSettings, shouldHideBookTitles, subscribeSettingsUpdated, type ExtendedSettings, type SettingsUpdatedDetail } from '../services/settingsCenterService';
import { addBookToShelfGroup, allShelfGroupId, customShelfGroupId, deleteShelfGroup, normalizeShelfGroupName, removeBookFromShelfGroup, renameShelfGroup, shelfGroupNameFromId, ungroupedShelfGroupId, type ShelfGroupEntry } from '../features/library/libraryShelfGroups';
import {
  buildLibraryBookOrderAfterMove,
  clampLibraryGroupSidebarWidth,
  coverLabelForTone,
  createLibraryTabPreferences,
  deriveLibraryBookStatus,
  filterAndSortBooks,
  formatTimestamp,
  indexStatusLabel,
  loadLibraryBookOrder,
  normalizeLibrarySourceMatchText,
  progressForBatchReadingStatus,
  readingStatusLabel,
  saveLibraryBookOrder,
  trashRemaining,
  trashRemainingMillis,
  type BatchCoverTone,
  type BatchReadingStatus,
  type DerivedLibraryBookStatus,
  type FilterMode,
  type LibraryBookDropPlacement,
  type LibraryIndexStatus,
  type LibraryReadingStatus,
  type LibraryTab,
  type LibraryTabPreferences,
  type LibraryToolbarPopover,
  type SortMode,
} from '../features/library/libraryCollectionModel';
import type { DirectoryImportFileSelection, DirectoryImportResult, DirectoryImportScanResult } from '../services/libraryService';
import { useLibraryImportFlow } from '../features/library/useLibraryImportFlow';
import { useLibraryBookDragAndDrop } from '../features/library/useLibraryBookDragAndDrop';
import { BookActionMenu, BookContextMenu, LibraryGroupContextMenu, type BookMenuPanel } from '../features/library/LibraryBookMenus';
import { LibraryShelfGroupSidebar } from '../features/library/LibraryShelfGroupSidebar';
import { LibraryPageToolbar } from '../features/library/LibraryPageToolbar';
import { LibraryPageModals, type LibraryGroupNameModalState } from '../features/library/LibraryPageModals';
import { LibraryBookGrid } from '../features/library/LibraryBookGrid';
import { useLibraryCoverActions } from '../features/library/useLibraryCoverActions';
import { useLibraryAnnotationExport } from '../features/library/useLibraryAnnotationExport';
import { clampLibraryBookMenuPosition, clampLibraryGroupMenuPosition, type LibraryBookContextMenuState } from '../features/library/libraryMenuPosition';
import { useLibraryShelfGroupState } from '../features/library/useLibraryShelfGroupState';
import type { AppSettings, Book, BookIndexManifest, EditableBook, IndexDiagnostics, LibraryViewMode } from '../types';

type LibraryPageProps = {
  books: Book[];
  libraryLoadError: string;
  directoryImportPreview?: DirectoryImportScanResult | null;
  onConsumeDirectoryImportPreview?: () => void;
  onImportBook: (path: string) => Promise<void>;
  onScanDirectoryImport: (path: string) => Promise<DirectoryImportScanResult | null>;
  onImportBookFiles: (files: DirectoryImportFileSelection[]) => Promise<DirectoryImportResult>;
  onChooseBookFile: () => Promise<void>;
  onChooseBookDirectory: () => Promise<void>;
  onUpdateBook: (book: Book) => void;
  onOpenBook: (bookId: string) => void;
  onOpenCharacters: (bookId: string) => void;
  onTrashBook: (bookId: string) => Promise<void>;
  onRestoreBook: (bookId: string) => Promise<void>;
  onDeleteBookForever: (bookId: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
};

type GroupContextMenuState = { x: number; y: number; visible: boolean; groupId: string | null };
const coverTones: EditableBook['coverTone'][] = ['amber', 'indigo', 'sage', 'violet', 'cinnabar'];
const DAY_MILLIS = 24 * 60 * 60 * 1000;
const TRASH_EXPIRY_WARNING_MILLIS = DAY_MILLIS;

export function LibraryPage({ books, libraryLoadError, directoryImportPreview: incomingDirectoryImportPreview = null, onConsumeDirectoryImportPreview, onImportBook, onScanDirectoryImport, onImportBookFiles, onChooseBookFile, onChooseBookDirectory, onUpdateBook, onOpenBook, onOpenCharacters, onTrashBook, onRestoreBook, onDeleteBookForever, onEmptyTrash }: LibraryPageProps) {
  const { t } = useI18n();
  const [extendedSettings, setExtendedSettings] = useState<ExtendedSettings>(() => loadExtendedSettings());
  const [settings, setSettings] = useState<AppSettings>({ schemaVersion: 1, trashRetentionDays: 3, trashAutoCleanupEnabled: true, trashProtectReadingProgress: true, trashProtectReaderAssets: true });
  const [activeTab, setActiveTab] = useState<LibraryTab>('shelf');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>(() => extendedSettings.defaultSort);
  const [filterMode, setFilterMode] = useState<FilterMode>(() => extendedSettings.defaultFilter);
  const [libraryTabPreferences, setLibraryTabPreferences] = useState<LibraryTabPreferences>(() => createLibraryTabPreferences(extendedSettings.defaultSort, extendedSettings.defaultFilter));
  const [menuBookId, setMenuBookId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<LibraryBookContextMenuState>({ x: 0, y: 0, visible: false, bookId: '' });
  const [groupContextMenu, setGroupContextMenu] = useState<GroupContextMenuState>({ x: 0, y: 0, visible: false, groupId: null });
  const [groupNameModal, setGroupNameModal] = useState<LibraryGroupNameModalState>(null);
  const [editing, setEditing] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [trashActionError, setTrashActionError] = useState('');
  const [trashActionBusy, setTrashActionBusy] = useState(false);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => extendedSettings.defaultViewMode);
  const [toolbarPopover, setToolbarPopover] = useState<LibraryToolbarPopover>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bookMenuPanel, setBookMenuPanel] = useState<BookMenuPanel>('main');
  const [batchAuthor, setBatchAuthor] = useState('');
  const [batchCoverTone, setBatchCoverTone] = useState<BatchCoverTone>('keep');
  const [batchReadingStatus, setBatchReadingStatus] = useState<BatchReadingStatus>('keep');
  const [indexDiagnostics, setIndexDiagnostics] = useState<IndexDiagnostics | null>(null);
  const [libraryBookOrder, setLibraryBookOrder] = useState<Record<string, string[]>>(() => loadLibraryBookOrder());
  const [groupEditorBookId, setGroupEditorBookId] = useState<string | null>(null);
  const [newShelfGroupName, setNewShelfGroupName] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const shelfGroupResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const { activeShelfGroupId, setActiveShelfGroupId, libraryGroupCatalog, setLibraryGroupCatalog, shelfGroupsCollapsed, setShelfGroupsCollapsed, shelfGroupSidebarWidth, setShelfGroupSidebarWidth, expandedShelfGroupIds, setExpandedShelfGroupIds, shelfBooks, trashBooks, shelfGroups, groupedShelfBooks } = useLibraryShelfGroupState(books, activeTab);
  const {
    importPath, setImportPath, importError, setImportError, importFeedback, importing,
    directoryImportPreview, directoryImportSelectedPaths, directoryImportDisplayNames,
    openDirectoryImportPreview, toggleDirectoryImportFile, selectAllDirectoryImportFiles,
    clearDirectoryImportSelection, updateDirectoryImportDisplayName, cancelDirectoryImportPreview,
    confirmDirectoryImportSelection, submitImport, chooseFile, chooseDirectory,
  } = useLibraryImportFlow({
    books,
    t,
    onScanDirectoryImport,
    onImportBook,
    onImportBookFiles,
    onChooseBookFile,
    onChooseBookDirectory,
    onImported: () => setActiveTab('shelf'),
    onCloseToolbarPopover: () => setToolbarPopover(null),
  });

  const viewModes: { id: LibraryViewMode; label: string; hint: string }[] = [
    { id: 'card', label: t('library.view.card'), hint: t('library.viewHint.card') },
    { id: 'list', label: t('library.view.list'), hint: t('library.viewHint.list') },
    { id: 'shelf', label: t('library.view.shelf'), hint: t('library.viewHint.shelf') },
  ];
  useEffect(() => {
    function refreshSettings(detail?: SettingsUpdatedDetail) {
      if (detail?.scope && detail.scope !== 'app' && detail.scope !== 'all') return;
      loadAppSettings().then(setSettings).catch((error) => console.error('Failed to load app settings:', error));
    }
    refreshSettings();
    return subscribeSettingsUpdated(refreshSettings);
  }, []);

  useEffect(() => {
    if (!incomingDirectoryImportPreview) return;
    openDirectoryImportPreview(incomingDirectoryImportPreview);
    onConsumeDirectoryImportPreview?.();
  }, [incomingDirectoryImportPreview, onConsumeDirectoryImportPreview]);

  useEffect(() => {
    function refreshExtendedSettings(detail?: SettingsUpdatedDetail) {
      const next = detail?.extended;
      const loaded = next ?? loadExtendedSettings();
      setExtendedSettings(loaded);
      setViewMode(loaded.defaultViewMode);
      setLibraryTabPreferences(createLibraryTabPreferences(loaded.defaultSort, loaded.defaultFilter));
      setSortMode(loaded.defaultSort);
      setFilterMode(loaded.defaultFilter);
      if (!loaded.showLibraryDetailSidebar) setSelectedDetailId(null);
    }
    return subscribeSettingsUpdated(refreshExtendedSettings);
  }, []);

  useEffect(() => {
    function closeMenus(event: globalThis.MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (menuRef.current?.contains(event.target as Node)) return;
      if (target?.closest('.book-detail-panel, .book-action-menu, .book-context-menu, .library-group-context-menu, .library-group-name-modal, .book-more-btn')) return;
      if (!target?.closest('.library-icon-toolbar, .library-toolbar-popover')) setToolbarPopover(null);
      if (!target?.closest('.book-tile-wrap')) setSelectedDetailId(null);
      setContextMenu((current) => ({ ...current, visible: false }));
      setGroupContextMenu((current) => ({ ...current, visible: false }));
      setGroupNameModal(null);
      setMenuBookId(null);
    }
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', keepContextMenuInViewport);
    return () => {
      window.removeEventListener('click', closeMenus);
      window.removeEventListener('resize', keepContextMenuInViewport);
    };
  }, []);

  useEffect(() => {
    function closeToolbarPopover(event: KeyboardEvent) {
      if (event.key === 'Escape') setToolbarPopover(null);
    }
    window.addEventListener('keydown', closeToolbarPopover);
    return () => window.removeEventListener('keydown', closeToolbarPopover);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    saveLibraryBookOrder(libraryBookOrder);
  }, [libraryBookOrder]);

  useEffect(() => {
    let cancelled = false;
    function refreshIndexDiagnostics() {
      loadSharedIndexDiagnostics().then((diagnostics) => {
        if (!cancelled) setIndexDiagnostics(diagnostics);
      }).catch((error) => console.warn('Failed to load library index diagnostics:', error));
    }
    refreshIndexDiagnostics();
    window.addEventListener(tasksUpdatedEvent, refreshIndexDiagnostics);
    return () => {
      cancelled = true;
      window.removeEventListener(tasksUpdatedEvent, refreshIndexDiagnostics);
    };
  }, []);

  useEffect(() => {
    const shelfBookIds = new Set(books.filter((item) => !item.deleted).map((item) => item.id));
    setSelectedBookIds((current) => {
      const next = current.filter((bookId) => shelfBookIds.has(bookId));
      return next.length === current.length ? current : next;
    });
  }, [books]);

  const visibleBaseBooks = activeTab === 'trash' ? trashBooks : groupedShelfBooks;
  const activeLibraryBookOrder = activeTab === 'shelf' ? libraryBookOrder[activeShelfGroupId] ?? [] : [];
  const visibleBooks = useMemo(() => filterAndSortBooks(visibleBaseBooks, query, filterMode, sortMode, activeTab, activeLibraryBookOrder, (item) => findBookIndexManifest(indexDiagnostics, item.id), t), [visibleBaseBooks, query, filterMode, sortMode, activeTab, activeLibraryBookOrder, indexDiagnostics, t]);
  const visibleSelectableBooks = activeTab === 'shelf' ? visibleBooks.filter((item) => !item.deleted) : [];
  const selectedShelfBooks = shelfBooks.filter((item) => selectedBookIds.includes(item.id));
  const selectedVisibleCount = visibleSelectableBooks.filter((item) => selectedBookIds.includes(item.id)).length;
  const hasBatchMetadataChanges = batchAuthor.trim().length > 0 || batchCoverTone !== 'keep' || batchReadingStatus !== 'keep';
  const selectedBook = books.find((item) => item.id === (contextMenu.visible ? contextMenu.bookId : menuBookId)) as EditableBook | undefined;
  const editingBook = editingBookId ? books.find((item) => item.id === editingBookId) as EditableBook | undefined : undefined;
  const detailBook = extendedSettings.showLibraryDetailSidebar && selectedDetailId ? books.find((item) => item.id === selectedDetailId) ?? null : null;
  const groupEditorBook = groupEditorBookId ? books.find((item) => item.id === groupEditorBookId && !item.deleted) as EditableBook | undefined : undefined;
  const customShelfGroups = shelfGroups.filter((group) => group.kind === 'custom');
  const { chooseCustomCover, chooseEditorCustomCover, clearEditorCustomCover } = useLibraryCoverActions({ selectedBook, editingBook, imageFileLabel: t('library.cover.imageFiles'), onUpdateBook, onError: setImportError, onCloseBookMenu: closeBookMenus });
  const { exportSelectedBookAnnotations } = useLibraryAnnotationExport({ privacySettings: extendedSettings, exportFailedMessage: t('library.annotations.exportFailed'), onError: setImportError, onCloseMenus: closeBookMenus });
  const {
    dragOverShelfGroupId,
    dragOverBookId,
    clearShelfGroupDragTarget,
    clearBookDragTarget,
    pointerBookDrag,
    dragBookStart,
    startPointerBookDrag,
    movePointerBookDrag,
    endPointerBookDrag,
    dragBookOverShelfGroup,
    dropBookOnShelfGroup,
    dragBookOverBook,
    dropBookOnBook,
  } = useLibraryBookDragAndDrop({
    books,
    visibleBooks,
    activeTab,
    activeShelfGroupId,
    libraryBookOrder,
    viewMode,
    privacySettings: extendedSettings,
    onUpdateBook,
    onOpenBook,
    setActiveShelfGroupId,
    setExpandedShelfGroupIds,
    setLibraryBookOrder,
    setManualSortMode: () => updateSortMode('manual'),
    onCloseMenus: closeBookMenus,
  });

  function keepContextMenuInViewport() {
    setContextMenu((current) => current.visible ? clampLibraryBookMenuPosition(current.x, current.y, current.bookId) : current);
  }

  function closeDetailPanel() {
    setSelectedDetailId(null);
  }

  function showBookDetail() {
    if (!extendedSettings.showLibraryDetailSidebar) return;
    if (!selectedBook || selectedBook.deleted) return;
    setSelectedDetailId(selectedBook.id);
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
  }

  function openEditor() {
    if (!selectedBook || selectedBook.deleted) return;
    setEditingBookId(selectedBook.id);
    setDraftTitle(getPrivacyBookTitle(selectedBook.displayTitle, extendedSettings));
    setDraftAuthor(selectedBook.author);
    setEditing(true);
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
  }

  function saveTitle() {
    if (!editingBook) return;
    const nextTitle = shouldHideBookTitles(extendedSettings) && draftTitle.trim() === getPrivacyBookTitle(editingBook.displayTitle, extendedSettings)
      ? editingBook.displayTitle
      : draftTitle.trim() || editingBook.displayTitle;
    onUpdateBook({ ...editingBook, displayTitle: nextTitle, author: draftAuthor.trim() || editingBook.author });
    closeEditor();
  }

  function closeEditor() {
    setEditing(false);
    setEditingBookId(null);
  }

  function setSelectedCoverTone(nextTone: EditableBook['coverTone']) {
    if (!selectedBook || selectedBook.deleted) return;
    onUpdateBook({ ...selectedBook, coverTone: nextTone, coverLabel: coverLabelForTone(nextTone), coverImagePath: '' });
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
  }

  function toggleBookSelection(bookId: string) {
    setSelectedBookIds((current) => current.includes(bookId) ? current.filter((item) => item !== bookId) : [...current, bookId]);
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
  }

  function selectVisibleBooks() {
    setSelectedBookIds((current) => Array.from(new Set([...current, ...visibleSelectableBooks.map((item) => item.id)])));
  }

  function invertVisibleBookSelection() {
    if (visibleSelectableBooks.length === 0) return;
    setSelectedBookIds((current) => {
      const next = new Set(current);
      visibleSelectableBooks.forEach((book) => {
        if (next.has(book.id)) next.delete(book.id);
        else next.add(book.id);
      });
      return Array.from(next);
    });
  }

  function clearBatchSelection() {
    setSelectedBookIds([]);
    resetBatchDrafts();
  }

  function resetBatchDrafts() {
    setBatchAuthor('');
    setBatchCoverTone('keep');
    setBatchReadingStatus('keep');
  }

  function applyBatchMetadataUpdate() {
    if (selectedShelfBooks.length === 0 || !hasBatchMetadataChanges) return;
    const nextAuthor = batchAuthor.trim();
    selectedShelfBooks.forEach((book) => {
      const nextCoverTone = batchCoverTone === 'keep' ? book.coverTone : batchCoverTone;
      onUpdateBook({
        ...book,
        author: nextAuthor || book.author,
        coverTone: nextCoverTone,
        coverLabel: batchCoverTone === 'keep' ? book.coverLabel : coverLabelForTone(nextCoverTone),
        progress: batchReadingStatus === 'keep' ? book.progress : progressForBatchReadingStatus(batchReadingStatus),
      });
    });
    resetBatchDrafts();
  }

  async function trashSelectedBook() {
    if (!selectedBook) return;
    if (extendedSettings.confirmMoveToTrash && !await requestAppConfirm(t('library.trash.confirmMove', { title: getPrivacyBookTitle(selectedBook.displayTitle, extendedSettings) }))) return;
    await onTrashBook(selectedBook.id);
    setSelectedDetailId(null);
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
  }

  async function trashBookFromDetail(book: Book) {
    if (extendedSettings.confirmMoveToTrash && !await requestAppConfirm(t('library.trash.confirmMove', { title: getPrivacyBookTitle(book.displayTitle, extendedSettings) }))) return;
    await onTrashBook(book.id);
    setSelectedDetailId(null);
  }

  async function openSelectedBook() {
    if (!selectedBook || selectedBook.deleted) return;
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
    onOpenBook(selectedBook.id);
  }

  function openSelectedCharacters() {
    if (!selectedBook || selectedBook.deleted) return;
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
    onOpenCharacters(selectedBook.id);
  }

  function closeBookMenus() {
    setBookMenuPanel('main');
    setMenuBookId(null);
    setContextMenu((current) => ({ ...current, visible: false }));
    setGroupContextMenu((current) => ({ ...current, visible: false }));
  }

  function openGroupEditor() {
    if (!selectedBook || selectedBook.deleted) return;
    setGroupEditorBookId(selectedBook.id);
    setNewShelfGroupName('');
    closeBookMenus();
  }

  function closeGroupEditor() {
    setGroupEditorBookId(null);
    setNewShelfGroupName('');
  }

  function addGroupToEditingBook(groupName: string) {
    if (!groupEditorBook) return;
    const next = addBookToShelfGroup(groupEditorBook, groupName) as Book;
    onUpdateBook(next);
    const nextGroupId = customShelfGroupId(groupName);
    if (nextGroupId) setActiveShelfGroupId(nextGroupId);
    setNewShelfGroupName('');
  }

  function removeGroupFromEditingBook(groupName: string) {
    if (!groupEditorBook) return;
    onUpdateBook(removeBookFromShelfGroup(groupEditorBook, groupName) as Book);
  }

  function submitNewShelfGroup() {
    const groupName = normalizeShelfGroupName(newShelfGroupName);
    if (!groupName) return;
    addGroupToEditingBook(groupName);
  }

  function toggleShelfGroupExpanded(groupId: string) {
    setExpandedShelfGroupIds((current) => current.includes(groupId) ? current.filter((item) => item !== groupId) : [...current, groupId]);
  }

  function startShelfGroupResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (shelfGroupsCollapsed || event.button !== 0) return;
    shelfGroupResizeRef.current = { startX: event.clientX, startWidth: shelfGroupSidebarWidth };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveShelfGroupResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = shelfGroupResizeRef.current;
    if (!drag) return;
    event.preventDefault();
    setShelfGroupSidebarWidth(clampLibraryGroupSidebarWidth(drag.startWidth + event.clientX - drag.startX));
  }

  function endShelfGroupResize(event: ReactPointerEvent<HTMLButtonElement>) {
    shelfGroupResizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function openGroupContextMenu(event: ReactMouseEvent, group: ShelfGroupEntry | null) {
    event.preventDefault();
    event.stopPropagation();
    closeBookMenus();
    setGroupContextMenu({ ...clampLibraryGroupMenuPosition(event.clientX, event.clientY), visible: true, groupId: group?.kind === 'custom' ? group.id : null });
  }

  function openCreateGroupModal() {
    setGroupNameModal({ mode: 'create', groupId: null, value: '' });
    setGroupContextMenu((current) => ({ ...current, visible: false }));
  }

  function openRenameGroupModal(groupId: string | null) {
    const oldName = groupId ? shelfGroupNameFromId(groupId) : '';
    if (!oldName) return;
    setGroupNameModal({ mode: 'rename', groupId, value: oldName });
    setGroupContextMenu((current) => ({ ...current, visible: false }));
  }

  function submitGroupNameModal() {
    if (!groupNameModal) return;
    const newName = normalizeShelfGroupName(groupNameModal.value);
    if (!newName) return;
    if (groupNameModal.mode === 'create') {
      setLibraryGroupCatalog((current) => Array.from(new Set([...current, newName])));
      const groupId = customShelfGroupId(newName);
      setActiveShelfGroupId(groupId);
      setExpandedShelfGroupIds((current) => Array.from(new Set([...current, groupId])));
      setGroupNameModal(null);
      return;
    }
    const groupId = groupNameModal.groupId;
    const oldName = groupId ? shelfGroupNameFromId(groupId) : '';
    if (!newName || newName === oldName) return;
    const result = renameShelfGroup(books, libraryGroupCatalog, oldName, newName);
    result.books.forEach((book) => {
      const original = books.find((item) => item.id === book.id);
      if (original && JSON.stringify(original.shelfGroups ?? []) !== JSON.stringify(book.shelfGroups ?? [])) onUpdateBook(book as Book);
    });
    setLibraryGroupCatalog(result.catalogGroups);
    const newGroupId = customShelfGroupId(newName);
    setActiveShelfGroupId((current) => current === groupId ? newGroupId : current);
    setExpandedShelfGroupIds((current) => current.map((item) => item === groupId ? newGroupId : item));
    setGroupNameModal(null);
  }

  async function deleteLibraryGroup(groupId: string | null) {
    const groupName = groupId ? shelfGroupNameFromId(groupId) : '';
    if (!groupName) return;
    if (!await requestAppConfirm(t('library.groups.deleteConfirm', { group: groupName }))) return;
    const result = deleteShelfGroup(books, libraryGroupCatalog, groupName);
    result.books.forEach((book) => {
      const original = books.find((item) => item.id === book.id);
      if (original && JSON.stringify(original.shelfGroups ?? []) !== JSON.stringify(book.shelfGroups ?? [])) onUpdateBook(book as Book);
    });
    setLibraryGroupCatalog(result.catalogGroups);
    setActiveShelfGroupId((current) => current === groupId ? allShelfGroupId : current);
    setExpandedShelfGroupIds((current) => current.filter((item) => item !== groupId));
    setGroupContextMenu((current) => ({ ...current, visible: false }));
  }

  function onContextMenu(event: ReactMouseEvent, item: Book) {
    event.preventDefault();
    event.stopPropagation();
    if (item.deleted) return;
    setMenuBookId(null);
    setContextMenu(clampLibraryBookMenuPosition(event.clientX, event.clientY, item.id));
  }

  async function restoreBook(bookId: string) {
    setTrashActionError('');
    setTrashActionBusy(true);
    try {
      await onRestoreBook(bookId);
      setActiveTab('shelf');
    } catch (error) {
      setTrashActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setTrashActionBusy(false);
    }
  }

  async function deleteForever(book: Book) {
    if (extendedSettings.confirmPermanentDelete && !await requestAppConfirm(t('library.trash.confirmDelete', { title: getPrivacyBookTitle(book.displayTitle, extendedSettings) }))) return;
    setTrashActionError('');
    setTrashActionBusy(true);
    try {
      await onDeleteBookForever(book.id);
    } catch (error) {
      setTrashActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setTrashActionBusy(false);
    }
  }

  async function emptyTrashConfirmed() {
    if (trashBooks.length === 0) return;
    if (extendedSettings.confirmEmptyTrash && !await requestAppConfirm(t('library.trash.confirmEmpty', { count: trashBooks.length }))) return;
    setTrashActionError('');
    setTrashActionBusy(true);
    try {
      await onEmptyTrash();
    } catch (error) {
      setTrashActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setTrashActionBusy(false);
    }
  }

  function switchLibraryTab(tab: LibraryTab) {
    if (extendedSettings.rememberLibraryTabState) {
      setLibraryTabPreferences((current) => ({ ...current, [activeTab]: { sortMode, filterMode } }));
      const nextPreferences = libraryTabPreferences[tab] ?? { sortMode: extendedSettings.defaultSort, filterMode: extendedSettings.defaultFilter };
      setSortMode(nextPreferences.sortMode);
      setFilterMode(nextPreferences.filterMode);
    } else {
      setSortMode(extendedSettings.defaultSort);
      setFilterMode(extendedSettings.defaultFilter);
    }
    setActiveTab(tab);
    if (tab === 'trash') clearBatchSelection();
  }

  function updateSortMode(value: SortMode) {
    setSortMode(value);
    if (extendedSettings.rememberLibraryTabState) setLibraryTabPreferences((current) => ({ ...current, [activeTab]: { ...current[activeTab], sortMode: value } }));
  }

  function updateFilterMode(value: FilterMode) {
    setFilterMode(value);
    if (extendedSettings.rememberLibraryTabState) setLibraryTabPreferences((current) => ({ ...current, [activeTab]: { ...current[activeTab], filterMode: value } }));
  }

  const indexedCount = shelfBooks.filter((item) => {
    const manifest = findBookIndexManifest(indexDiagnostics, item.id);
    return deriveLibraryBookStatus(item, manifest).indexStatus === 'ready';
  }).length;
  const readingCount = shelfBooks.filter((item) => deriveLibraryBookStatus(item).readingStatus === 'reading').length;
  const averageProgress = shelfBooks.length ? Math.round(shelfBooks.reduce((sum, item) => sum + item.progress, 0) / shelfBooks.length) : 0;
  const trashSummaryText = settings.trashAutoCleanupEnabled === false
    ? t('library.trash.autoCleanupOff')
    : `${t('library.trashRetention.value', { days: settings.trashRetentionDays })}${settings.trashProtectReadingProgress !== false || settings.trashProtectReaderAssets !== false ? ` · ${t('library.trash.exceptionProtectionEnabled')}` : ''}`;

  return (
    <section className="page-surface library-page-main compact-library" onContextMenu={(event) => event.preventDefault()}>
      <LibraryPageToolbar
        activeTab={activeTab}
        shelfBookCount={shelfBooks.length}
        trashBookCount={trashBooks.length}
        query={query}
        onQueryChange={setQuery}
        toolbarPopover={toolbarPopover}
        setToolbarPopover={setToolbarPopover}
        sortMode={sortMode}
        filterMode={filterMode}
        viewMode={viewMode}
        viewModes={viewModes}
        onSwitchTab={switchLibraryTab}
        onUpdateSort={updateSortMode}
        onUpdateFilter={updateFilterMode}
        onUpdateViewMode={setViewMode}
        importPath={importPath}
        onImportPathChange={setImportPath}
        importing={importing}
        onSubmitImport={(target) => { void submitImport(target); }}
        onChooseFile={() => { void chooseFile(); }}
        onChooseDirectory={() => { void chooseDirectory(); }}
        selectedBookCount={selectedBookIds.length}
        selectedVisibleCount={selectedVisibleCount}
        visibleSelectableBookCount={visibleSelectableBooks.length}
        onSelectVisible={selectVisibleBooks}
        onInvertVisible={invertVisibleBookSelection}
        onClearSelection={clearBatchSelection}
        batchAuthor={batchAuthor}
        onBatchAuthorChange={setBatchAuthor}
        batchCoverTone={batchCoverTone}
        onBatchCoverToneChange={setBatchCoverTone}
        batchReadingStatus={batchReadingStatus}
        onBatchReadingStatusChange={setBatchReadingStatus}
        coverTones={coverTones}
        hasSelectedShelfBooks={selectedShelfBooks.length > 0}
        hasBatchMetadataChanges={hasBatchMetadataChanges}
        onApplyBatch={applyBatchMetadataUpdate}
      />

      {activeTab === 'trash' ? <div className="library-toolbar secondary-toolbar trash-summary-toolbar"><p className="view-hint">{trashSummaryText}</p><button className="ghost-btn danger-btn" onClick={emptyTrashConfirmed} disabled={trashBooks.length === 0 || trashActionBusy}>{t('library.trash.emptyButton')}</button></div> : null}

      {importError ? <p className="inline-error">{importError}</p> : null}
      {trashActionError ? <p className="inline-error" role="alert">{trashActionError}</p> : null}
      {importFeedback ? <p className="inline-success">{importFeedback}</p> : null}
      {libraryLoadError ? <p className="inline-error" role="alert">{t('library.loadFailed')}: {libraryLoadError}</p> : null}

      {activeTab === 'shelf' && extendedSettings.showEmptyLibraryGuide && shelfBooks.length <= 2 ? (
        <section className={`library-insight-strip${shelfBooks.length === 0 ? ' empty' : ''}`}>
          <article className="library-insight-card import-guide">
            <span>{t('library.insight.guideKicker')}</span>
            <h3>{shelfBooks.length === 0 ? t('library.insight.emptyTitle') : t('library.insight.lowTitle')}</h3>
            <p>{shelfBooks.length === 0 ? t('library.insight.emptyBody') : t('library.insight.lowBody')}</p>
            <div className="insight-steps"><b>1</b><i /><b>2</b><i /><b>3</b></div>
          </article>
          <article className="library-insight-card stat-card"><span>{t('library.insight.total')}</span><strong>{shelfBooks.length}</strong><p>{t('library.insight.totalHint')}</p></article>
          <article className="library-insight-card stat-card"><span>{t('library.insight.indexed')}</span><strong>{indexedCount}</strong><p>{t('library.insight.indexedHint')}</p></article>
          <article className="library-insight-card stat-card"><span>{t('library.insight.progress')}</span><strong>{averageProgress}%</strong><p>{readingCount > 0 ? t('library.insight.readingHint', { count: readingCount }) : t('library.insight.progressHint')}</p></article>
        </section>
      ) : null}

      <div className={`library-shelf-layout${detailBook ? ' detail-open' : ''}${activeTab === 'trash' ? ' trash-only' : ''}${shelfGroupsCollapsed ? ' collapsed-groups' : ''}`} style={{ '--library-group-sidebar-width': `${shelfGroupSidebarWidth}px` } as CSSProperties}>
        {activeTab === 'shelf' ? (
          <>
          <LibraryShelfGroupSidebar
            groups={shelfGroups}
            books={shelfBooks}
            privacySettings={extendedSettings}
            activeGroupId={activeShelfGroupId}
            collapsed={shelfGroupsCollapsed}
            expandedGroupIds={expandedShelfGroupIds}
            dragOverGroupId={dragOverShelfGroupId}
            onToggleCollapsed={() => setShelfGroupsCollapsed((value) => !value)}
            onToggleGroupExpanded={toggleShelfGroupExpanded}
            onSelectGroup={setActiveShelfGroupId}
            onOpenBook={onOpenBook}
            onOpenGroupContextMenu={openGroupContextMenu}
            onDragBookStart={dragBookStart}
            onDragOverGroup={dragBookOverShelfGroup}
            onDropGroup={dropBookOnShelfGroup}
            onDragLeaveGroup={clearShelfGroupDragTarget}
          />
          <button className="library-group-resize-grip" type="button" aria-label={t('library.groups.resize')} onPointerDown={startShelfGroupResize} onPointerMove={moveShelfGroupResize} onPointerUp={endShelfGroupResize} onPointerCancel={endShelfGroupResize} />
          </>
        ) : null}
      <LibraryBookGrid
        activeTab={activeTab}
        viewMode={viewMode}
        density={extendedSettings.libraryDensity}
        privacySettings={extendedSettings}
        libraryLoadError={libraryLoadError}
        visibleBooks={visibleBooks}
        selectedBookIds={selectedBookIds}
        dragOverBookId={dragOverBookId}
        selectedBook={selectedBook}
        menuBookId={menuBookId}
        menuRef={menuRef}
        bookMenuPanel={bookMenuPanel}
        coverTones={coverTones}
        detailBook={detailBook}
        indexManifestForBook={(bookId) => findBookIndexManifest(indexDiagnostics, bookId)}
        now={now}
        settings={settings}
        trashActionBusy={trashActionBusy}
        onOpenBook={onOpenBook}
        onOpenCharacters={onOpenCharacters}
        onRestoreBook={(bookId) => { void restoreBook(bookId); }}
        onDeleteForever={(book) => { void deleteForever(book); }}
        onDragOverBook={dragBookOverBook}
        onDropBook={dropBookOnBook}
        onDragLeaveBook={clearBookDragTarget}
        onPointerDownBook={startPointerBookDrag}
        onPointerMoveBook={movePointerBookDrag}
        onPointerUpBook={endPointerBookDrag}
        onContextMenu={onContextMenu}
        onToggleSelection={toggleBookSelection}
        onToggleBookMenu={(bookId) => { setMenuBookId((current) => current === bookId ? null : bookId); setContextMenu((current) => ({ ...current, visible: false })); }}
        setBookMenuPanel={setBookMenuPanel}
        onOpenSelectedBook={openSelectedBook}
        onOpenSelectedCharacters={openSelectedCharacters}
        onShowDetail={showBookDetail}
        onEdit={openEditor}
        onCoverTone={setSelectedCoverTone}
        onCustomCover={() => { void chooseCustomCover(); }}
        onGroup={openGroupEditor}
        onExportAnnotations={() => { void exportSelectedBookAnnotations(selectedBook); }}
        onTrashSelected={() => { void trashSelectedBook(); }}
        onCloseDetail={closeDetailPanel}
        onTrashDetail={(book) => { void trashBookFromDetail(book); }}
      />
      </div>

      {contextMenu.visible && selectedBook && !selectedBook.deleted ? createPortal(<BookContextMenu x={contextMenu.x} y={contextMenu.y} book={selectedBook} panel={bookMenuPanel} setPanel={setBookMenuPanel} showDetail={extendedSettings.showLibraryDetailSidebar} coverTones={coverTones} onOpen={openSelectedBook} onCharacters={openSelectedCharacters} onDetail={showBookDetail} onEdit={openEditor} onCoverTone={setSelectedCoverTone} onCustomCover={chooseCustomCover} onGroup={openGroupEditor} onExportAnnotations={() => { void exportSelectedBookAnnotations(selectedBook); }} onTrash={trashSelectedBook} />, document.body) : null}
      {groupContextMenu.visible ? createPortal(<LibraryGroupContextMenu x={groupContextMenu.x} y={groupContextMenu.y} hasGroup={Boolean(groupContextMenu.groupId)} onCreate={openCreateGroupModal} onRename={() => openRenameGroupModal(groupContextMenu.groupId)} onDelete={() => deleteLibraryGroup(groupContextMenu.groupId)} />, document.body) : null}
      {pointerBookDrag ? createPortal(<div className="book-pointer-drag-preview" style={{ left: `${pointerBookDrag.x}px`, top: `${pointerBookDrag.y}px` }}><span className={pointerBookDrag.tone}>{pointerBookDrag.label}</span><strong>{pointerBookDrag.title}</strong></div>, document.body) : null}
      <LibraryPageModals
        directoryImportPreview={directoryImportPreview}
        directoryImportSelectedPaths={directoryImportSelectedPaths}
        directoryImportDisplayNames={directoryImportDisplayNames}
        importing={importing}
        onCancelDirectoryImport={cancelDirectoryImportPreview}
        onSelectAllDirectoryImport={selectAllDirectoryImportFiles}
        onClearDirectoryImportSelection={clearDirectoryImportSelection}
        onToggleDirectoryImportFile={toggleDirectoryImportFile}
        onUpdateDirectoryImportDisplayName={updateDirectoryImportDisplayName}
        onConfirmDirectoryImport={() => { void confirmDirectoryImportSelection(); }}
        groupNameModal={groupNameModal}
        onCloseGroupNameModal={() => setGroupNameModal(null)}
        onChangeGroupName={(value) => setGroupNameModal((current) => current ? { ...current, value } : current)}
        onSubmitGroupName={submitGroupNameModal}
        editingBook={editing ? editingBook : undefined}
        draftTitle={draftTitle}
        draftAuthor={draftAuthor}
        coverTones={coverTones}
        onCloseBookEditor={closeEditor}
        onDraftTitleChange={setDraftTitle}
        onDraftAuthorChange={setDraftAuthor}
        onSetBookCoverTone={(tone) => { if (editingBook) onUpdateBook({ ...editingBook, coverTone: tone, coverLabel: coverLabelForTone(tone), coverImagePath: '' }); }}
        onChooseEditorCustomCover={() => { void chooseEditorCustomCover(); }}
        onClearEditorCustomCover={clearEditorCustomCover}
        onSaveBookEditor={saveTitle}
        groupEditorBook={groupEditorBook}
        customShelfGroups={customShelfGroups}
        newShelfGroupName={newShelfGroupName}
        privacySettings={extendedSettings}
        onCloseGroupEditor={closeGroupEditor}
        onRemoveGroup={removeGroupFromEditingBook}
        onAddGroup={addGroupToEditingBook}
        onNewGroupNameChange={setNewShelfGroupName}
        onSubmitNewGroup={submitNewShelfGroup}
      />
    </section>
  );
}

function toLocalAssetUrl(path: string) {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

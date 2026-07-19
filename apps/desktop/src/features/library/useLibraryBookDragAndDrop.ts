import { useRef, useState, type Dispatch, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Book, EditableBook, LibraryViewMode } from '../../types';
import { addBookToShelfGroup, allShelfGroupId, shelfGroupNameFromId, ungroupedShelfGroupId } from './libraryShelfGroups';
import { buildLibraryBookOrderAfterMove, type LibraryBookDropPlacement, type LibraryTab } from './libraryCollectionModel';

type PointerBookDragState = { bookId: string; title: string; label: string; tone: EditableBook['coverTone']; x: number; y: number } | null;
type PointerBookDragRef = NonNullable<PointerBookDragState> & { pointerId: number; startX: number; startY: number; started: boolean };

type UseLibraryBookDragAndDropInput = {
  books: Book[];
  visibleBooks: Book[];
  activeTab: LibraryTab;
  activeShelfGroupId: string;
  libraryBookOrder: Record<string, string[]>;
  viewMode: LibraryViewMode;
  privacySettings: ExtendedSettings;
  onUpdateBook: (book: Book) => void;
  onOpenBook: (bookId: string) => void;
  setActiveShelfGroupId: (groupId: string) => void;
  setExpandedShelfGroupIds: Dispatch<SetStateAction<string[]>>;
  setLibraryBookOrder: Dispatch<SetStateAction<Record<string, string[]>>>;
  setManualSortMode: () => void;
  onCloseMenus: () => void;
};

export function useLibraryBookDragAndDrop({
  books,
  visibleBooks,
  activeTab,
  activeShelfGroupId,
  libraryBookOrder,
  viewMode,
  privacySettings,
  onUpdateBook,
  onOpenBook,
  setActiveShelfGroupId,
  setExpandedShelfGroupIds,
  setLibraryBookOrder,
  setManualSortMode,
  onCloseMenus,
}: UseLibraryBookDragAndDropInput) {
  const [dragOverShelfGroupId, setDragOverShelfGroupId] = useState<string | null>(null);
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null);
  const [pointerBookDrag, setPointerBookDrag] = useState<PointerBookDragState>(null);
  const pointerBookDragRef = useRef<PointerBookDragRef | null>(null);
  const nativeDraggedBookIdRef = useRef('');

  function findShelfGroupAtPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    return element?.closest<HTMLElement>('[data-shelf-group-id]')?.dataset.shelfGroupId ?? null;
  }

  function findBookAtPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    const tile = element?.closest<HTMLElement>('[data-library-book-id]');
    if (!tile) return null;
    const targetBookId = tile.dataset.libraryBookId ?? '';
    if (!targetBookId) return null;
    const rect = tile.getBoundingClientRect();
    const sameRow = Math.abs(y - (rect.top + rect.height / 2)) < rect.height / 2;
    const placement: LibraryBookDropPlacement = viewMode === 'list' || !sameRow
      ? (y > rect.top + rect.height / 2 ? 'after' : 'before')
      : (x > rect.left + rect.width / 2 ? 'after' : 'before');
    return { bookId: targetBookId, placement };
  }

  function moveBookToShelfGroup(bookId: string, groupId: string) {
    const target = books.find((item) => item.id === bookId && !item.deleted);
    setDragOverShelfGroupId(null);
    if (!target) return;
    if (groupId === allShelfGroupId) {
      setActiveShelfGroupId(allShelfGroupId);
      return;
    }
    if (groupId === ungroupedShelfGroupId) {
      onUpdateBook({ ...target, shelfGroups: [] });
      setActiveShelfGroupId(ungroupedShelfGroupId);
      return;
    }
    const groupName = shelfGroupNameFromId(groupId);
    if (!groupName) return;
    onUpdateBook(addBookToShelfGroup(target, groupName) as Book);
    setActiveShelfGroupId(groupId);
    setExpandedShelfGroupIds((current) => current.includes(groupId) ? current : [...current, groupId]);
  }

  function reorderVisibleBook(bookId: string, targetBookId: string, placement: LibraryBookDropPlacement) {
    if (activeTab !== 'shelf' || bookId === targetBookId) return;
    const visibleBookIds = visibleBooks.map((book) => book.id);
    if (!visibleBookIds.includes(bookId) || !visibleBookIds.includes(targetBookId)) return;
    const nextOrder = buildLibraryBookOrderAfterMove(visibleBookIds, libraryBookOrder[activeShelfGroupId] ?? [], bookId, targetBookId, placement);
    setLibraryBookOrder((current) => ({ ...current, [activeShelfGroupId]: nextOrder }));
    setManualSortMode();
    setDragOverBookId(null);
    setDragOverShelfGroupId(null);
  }

  function dragBookStart(event: ReactDragEvent<HTMLElement>, book: Book) {
    if (book.deleted) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/bookmind-book-id', book.id);
    event.dataTransfer.setData('text/plain', book.id);
    nativeDraggedBookIdRef.current = book.id;
    onCloseMenus();
    const dragImage = event.currentTarget.closest('.book-tile-wrap')?.cloneNode(true) as HTMLElement | null;
    if (!dragImage) return;
    dragImage.classList.add('book-drag-preview');
    dragImage.style.position = 'fixed';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.width = `${event.currentTarget.getBoundingClientRect().width}px`;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 36, 36);
    window.setTimeout(() => dragImage.remove(), 0);
  }

  function startPointerBookDrag(event: ReactPointerEvent<HTMLElement>, book: Book) {
    if (book.deleted || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.book-select-control, .book-more-btn, .book-action-menu')) return;
    pointerBookDragRef.current = {
      bookId: book.id,
      title: getPrivacyBookTitle(book.displayTitle, privacySettings),
      label: book.coverLabel,
      tone: book.coverTone,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function movePointerBookDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = pointerBookDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.started && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    event.preventDefault();
    const next = { ...drag, x: event.clientX, y: event.clientY, started: true };
    pointerBookDragRef.current = next;
    setPointerBookDrag(next);
    onCloseMenus();
    const targetGroupId = findShelfGroupAtPoint(event.clientX, event.clientY);
    const targetBook = targetGroupId ? null : findBookAtPoint(event.clientX, event.clientY);
    setDragOverShelfGroupId(targetGroupId);
    setDragOverBookId(targetBook && targetBook.bookId !== drag.bookId ? targetBook.bookId : null);
  }

  function endPointerBookDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = pointerBookDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const targetGroupId = drag.started ? findShelfGroupAtPoint(event.clientX, event.clientY) : null;
    const targetBook = drag.started && !targetGroupId ? findBookAtPoint(event.clientX, event.clientY) : null;
    pointerBookDragRef.current = null;
    setPointerBookDrag(null);
    setDragOverShelfGroupId(null);
    setDragOverBookId(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (targetGroupId) moveBookToShelfGroup(drag.bookId, targetGroupId);
    else if (targetBook && targetBook.bookId !== drag.bookId) reorderVisibleBook(drag.bookId, targetBook.bookId, targetBook.placement);
    else if (!drag.started) onOpenBook(drag.bookId);
  }

  function dragBookOverShelfGroup(event: ReactDragEvent<HTMLElement>, groupId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverShelfGroupId(groupId);
  }

  function dropBookOnShelfGroup(event: ReactDragEvent<HTMLElement>, groupId: string) {
    event.preventDefault();
    const bookId = event.dataTransfer.getData('application/bookmind-book-id') || event.dataTransfer.getData('text/plain');
    moveBookToShelfGroup(bookId, groupId);
    nativeDraggedBookIdRef.current = '';
  }

  function dragBookOverBook(event: ReactDragEvent<HTMLElement>, targetBookId: string) {
    if (activeTab !== 'shelf') return;
    const sourceBookId = nativeDraggedBookIdRef.current || event.dataTransfer.getData('application/bookmind-book-id') || event.dataTransfer.getData('text/plain');
    if (!sourceBookId || sourceBookId === targetBookId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverBookId(targetBookId);
  }

  function dropBookOnBook(event: ReactDragEvent<HTMLElement>, targetBookId: string) {
    event.preventDefault();
    const bookId = nativeDraggedBookIdRef.current || event.dataTransfer.getData('application/bookmind-book-id') || event.dataTransfer.getData('text/plain');
    const rect = event.currentTarget.getBoundingClientRect();
    const placement: LibraryBookDropPlacement = viewMode === 'list'
      ? (event.clientY > rect.top + rect.height / 2 ? 'after' : 'before')
      : (event.clientX > rect.left + rect.width / 2 ? 'after' : 'before');
    reorderVisibleBook(bookId, targetBookId, placement);
    nativeDraggedBookIdRef.current = '';
  }

  return {
    dragOverShelfGroupId,
    dragOverBookId,
    clearShelfGroupDragTarget: () => setDragOverShelfGroupId(null),
    clearBookDragTarget: () => setDragOverBookId(null),
    pointerBookDrag,
    dragBookStart,
    startPointerBookDrag,
    movePointerBookDrag,
    endPointerBookDrag,
    dragBookOverShelfGroup,
    dropBookOnShelfGroup,
    dragBookOverBook,
    dropBookOnBook,
  };
}

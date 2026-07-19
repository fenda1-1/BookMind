import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import { getPrivacyBookTitle, getPrivacyFileName, type ExtendedSettings } from '../../services/settingsCenterService';
import type { AppSettings, Book, BookIndexManifest, EditableBook, LibraryViewMode } from '../../types';
import { BookActionMenu, type BookMenuPanel } from './LibraryBookMenus';
import { BookDetailPanel, BookStatusLine, LibraryBookCover, TrashBookRow } from './LibraryBookViews';
import type { LibraryTab } from './libraryCollectionModel';

type LibraryBookGridProps = {
  activeTab: LibraryTab;
  viewMode: LibraryViewMode;
  density: ExtendedSettings['libraryDensity'];
  privacySettings: ExtendedSettings;
  libraryLoadError: string;
  visibleBooks: Book[];
  selectedBookIds: string[];
  dragOverBookId: string | null;
  selectedBook: EditableBook | undefined;
  menuBookId: string | null;
  menuRef: RefObject<HTMLDivElement | null>;
  bookMenuPanel: BookMenuPanel;
  coverTones: EditableBook['coverTone'][];
  detailBook: Book | null;
  indexManifestForBook: (bookId: string) => BookIndexManifest | null;
  now: number;
  settings: AppSettings;
  trashActionBusy: boolean;
  onOpenBook: (bookId: string) => void;
  onOpenCharacters: (bookId: string) => void;
  onRestoreBook: (bookId: string) => void;
  onDeleteForever: (book: Book) => void;
  onDragOverBook: (event: ReactDragEvent<HTMLElement>, bookId: string) => void;
  onDropBook: (event: ReactDragEvent<HTMLElement>, bookId: string) => void;
  onDragLeaveBook: () => void;
  onPointerDownBook: (event: ReactPointerEvent<HTMLElement>, book: Book) => void;
  onPointerMoveBook: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUpBook: (event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent, book: Book) => void;
  onToggleSelection: (bookId: string) => void;
  onToggleBookMenu: (bookId: string) => void;
  setBookMenuPanel: (panel: BookMenuPanel) => void;
  onOpenSelectedBook: () => void;
  onOpenSelectedCharacters: () => void;
  onShowDetail: () => void;
  onEdit: () => void;
  onCoverTone: (tone: EditableBook['coverTone']) => void;
  onCustomCover: () => void;
  onGroup: () => void;
  onExportAnnotations: () => void;
  onTrashSelected: () => void;
  onCloseDetail: () => void;
  onTrashDetail: (book: Book) => void;
};

export function LibraryBookGrid({ activeTab, viewMode, density, privacySettings, libraryLoadError, visibleBooks, selectedBookIds, dragOverBookId, selectedBook, menuBookId, menuRef, bookMenuPanel, coverTones, detailBook, indexManifestForBook, now, settings, trashActionBusy, onOpenBook, onOpenCharacters, onRestoreBook, onDeleteForever, onDragOverBook, onDropBook, onDragLeaveBook, onPointerDownBook, onPointerMoveBook, onPointerUpBook, onContextMenu, onToggleSelection, onToggleBookMenu, setBookMenuPanel, onOpenSelectedBook, onOpenSelectedCharacters, onShowDetail, onEdit, onCoverTone, onCustomCover, onGroup, onExportAnnotations, onTrashSelected, onCloseDetail, onTrashDetail }: LibraryBookGridProps) {
  const { t } = useI18n();
  return <div className={`library-management-layout${detailBook ? ' detail-open' : ''}`}>
    <div className={`library-content density-${density} ${activeTab === 'trash' ? 'mode-trash' : `mode-${viewMode}`}`}>
      {visibleBooks.length === 0 && !libraryLoadError ? <div className="panel-card library-empty-card">{activeTab === 'trash' ? t('library.trash.empty') : t('library.empty')}</div> : null}
      {visibleBooks.map((book) => activeTab === 'trash' ? <TrashBookRow book={book} privacySettings={privacySettings} now={now} retentionDays={settings.trashRetentionDays} autoCleanupEnabled={settings.trashAutoCleanupEnabled !== false} protectReadingProgress={settings.trashProtectReadingProgress !== false} busy={trashActionBusy} onRestore={() => onRestoreBook(book.id)} onDelete={() => onDeleteForever(book)} key={book.id} /> : <div className={`book-tile-wrap has-selection-control${selectedBookIds.includes(book.id) ? ' selected' : ''}${dragOverBookId === book.id ? ' drop-target' : ''}`} key={book.id} data-library-book-id={book.id} onDragOver={(event) => onDragOverBook(event, book.id)} onDrop={(event) => onDropBook(event, book.id)} onDragLeave={onDragLeaveBook} onPointerDown={(event) => onPointerDownBook(event, book)} onPointerMove={onPointerMoveBook} onPointerUp={onPointerUpBook} onPointerCancel={onPointerUpBook} onContextMenu={(event) => onContextMenu(event, book)}><label className="book-select-control" aria-label={t('library.batch.selectBook', { title: getPrivacyBookTitle(book.displayTitle, privacySettings) })} onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={(event) => { event.stopPropagation(); onToggleSelection(book.id); }} /><BookMindIcon name={selectedBookIds.includes(book.id) ? 'librarySelect' : 'librarySelectEmpty'} /></label><div className="simple-book-tile" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenBook(book.id); } }} aria-label={t('library.openBookAria', { title: getPrivacyBookTitle(book.displayTitle, privacySettings) })} title={`${getPrivacyBookTitle(book.displayTitle, privacySettings)}\n${getPrivacyFileName(book.fileName, privacySettings)}`}><LibraryBookCover book={book} className={`large-cover ${book.coverTone}`} /><div className="book-tile-copy"><h3 title={getPrivacyBookTitle(book.displayTitle, privacySettings)}>{getPrivacyBookTitle(book.displayTitle, privacySettings)}</h3><p title={getPrivacyFileName(book.fileName, privacySettings)}>{getPrivacyFileName(book.fileName, privacySettings)}</p><BookStatusLine book={book} indexManifest={indexManifestForBook(book.id)} /></div></div><button className="book-more-btn" aria-label={t('library.bookActionsAria', { title: getPrivacyBookTitle(book.displayTitle, privacySettings) })} onClick={(event) => { event.stopPropagation(); setBookMenuPanel('main'); onToggleBookMenu(book.id); }}><BookMindIcon name="libraryMore" /></button>{menuBookId === book.id ? <BookActionMenu refNode={menuRef} book={selectedBook} panel={bookMenuPanel} setPanel={setBookMenuPanel} showDetail={privacySettings.showLibraryDetailSidebar} coverTones={coverTones} onOpen={onOpenSelectedBook} onCharacters={onOpenSelectedCharacters} onDetail={onShowDetail} onEdit={onEdit} onCoverTone={onCoverTone} onCustomCover={onCustomCover} onGroup={onGroup} onExportAnnotations={onExportAnnotations} onTrash={onTrashSelected} /> : null}</div>)}
    </div>
    {detailBook ? <BookDetailPanel book={detailBook} privacySettings={privacySettings} indexManifest={indexManifestForBook(detailBook.id)} onOpen={onOpenBook} onOpenCharacters={onOpenCharacters} onClose={onCloseDetail} onTrash={onTrashDetail} /> : null}
  </div>;
}

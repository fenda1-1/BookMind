import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import { BookMindIcon } from '../../components/BookMindIcon';
import { getPrivacyBookTitle, getPrivacyFileName, shouldHideRecentReading, type ExtendedSettings } from '../../services/settingsCenterService';
import type { AppPage, Book, NavItem } from '../../types';

type LibraryPanelProps = {
  book: Book | null;
  books: Book[];
  recentReaderBookId: string | null;
  activePage: AppPage;
  navItems: NavItem[];
  privacySettings: ExtendedSettings;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (page: AppPage) => void;
  onOpenBook: (bookId: string) => void;
  onReorderNavItems: (draggedPage: AppPage, targetPage: AppPage) => void;
};

function AppNavIcon({ page }: { page: AppPage }) {
  return <BookMindIcon name={page} />;
}

export function LibraryPanel({ book, books, recentReaderBookId, activePage, navItems, privacySettings, collapsed, onToggleCollapsed, onNavigate, onOpenBook, onReorderNavItems }: LibraryPanelProps) {
  const { t } = useI18n();
  const [draggedNavItem, setDraggedNavItem] = useState<AppPage | null>(null);
  const [navDropTarget, setNavDropTarget] = useState<AppPage | null>(null);
  const navDragRef = useRef<{ page: AppPage; pointerId: number; startX: number; startY: number; started: boolean } | null>(null);
  const suppressNavClickRef = useRef(false);
  const visibleBooks = useMemo(() => books.filter((item) => !item.deleted), [books]);
  const recentSidebarBooks = useMemo(() => {
    if (shouldHideRecentReading(privacySettings)) return [];
    const priorityBookId = recentReaderBookId ?? (book && !book.deleted ? book.id : null);
    return [...visibleBooks]
      .sort((left, right) => {
        if (left.id === priorityBookId) return -1;
        if (right.id === priorityBookId) return 1;
        return (Date.parse(right.lastOpenedAt ?? '') || 0) - (Date.parse(left.lastOpenedAt ?? '') || 0);
      })
      .slice(0, 1);
  }, [book, privacySettings, recentReaderBookId, visibleBooks]);
  const recentSidebarBook = recentSidebarBooks[0] ?? null;

  function findNavItemAtPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    return element?.closest<HTMLElement>('[data-nav-page]')?.dataset.navPage as AppPage | undefined;
  }

  function startNavPointerDrag(event: PointerEvent<HTMLButtonElement>, page: AppPage) {
    if (event.button !== 0) return;
    navDragRef.current = { page, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveNavPointerDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = navDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.started && distance < 5) return;
    event.preventDefault();
    drag.started = true;
    setDraggedNavItem(drag.page);
    const targetPage = findNavItemAtPoint(event.clientX, event.clientY);
    setNavDropTarget(targetPage && targetPage !== drag.page ? targetPage : null);
  }

  function endNavPointerDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = navDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const targetPage = drag.started ? findNavItemAtPoint(event.clientX, event.clientY) : null;
    suppressNavClickRef.current = drag.started;
    navDragRef.current = null;
    setDraggedNavItem(null);
    setNavDropTarget(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (targetPage && targetPage !== drag.page) onReorderNavItems(drag.page, targetPage);
    if (drag.started) window.setTimeout(() => { suppressNavClickRef.current = false; }, 0);
  }

  function navItemClassName(baseClassName: string, page: AppPage) {
    return [
      baseClassName,
      activePage === page ? 'active' : '',
      draggedNavItem === page ? 'dragging' : '',
      navDropTarget === page ? 'drop-target' : '',
    ].filter(Boolean).join(' ');
  }

  if (collapsed) {
    return (
      <aside className="library-panel collapsed" aria-label={t('sidebar.collapsedAria')}>
        <button type="button" className="sidebar-toggle collapsed-toggle" onClick={onToggleCollapsed} aria-label={t('sidebar.expand')} title={t('sidebar.expand')}>
          <BookMindIcon name="libraryGroupExpand" />
        </button>
        <div className="collapsed-brand">BM</div>
        <nav className="collapsed-nav" aria-label={t('sidebar.collapsedNav')}>
          {navItems.map((item) => (
            <button className={navItemClassName('collapsed-nav-item', item.id)} key={item.id} aria-label={item.label} data-label={item.label} data-nav-page={item.id} onPointerDown={(event) => startNavPointerDrag(event, item.id)} onPointerMove={moveNavPointerDrag} onPointerUp={endNavPointerDrag} onPointerCancel={endNavPointerDrag} onClick={() => { if (suppressNavClickRef.current) return; onNavigate(item.id); }}>
              <span aria-hidden="true"><AppNavIcon page={item.id} /></span>
              <em>{item.label}</em>
            </button>
          ))}
        </nav>
        <button className="collapsed-book" title={recentSidebarBook ? getPrivacyBookTitle(recentSidebarBook.displayTitle, privacySettings) : t('common.localBookshelf')} onClick={() => recentSidebarBook ? onOpenBook(recentSidebarBook.id) : onNavigate('library')}>
          {recentSidebarBook ? <BookCoverImage book={recentSidebarBook} className="collapsed-book-cover" /> : 'TXT'}
        </button>
      </aside>
    );
  }

  return (
    <aside className="library-panel" aria-label={t('sidebar.aria')}>
      <div className="brand-block">
        <div className="brand-mark">BM</div>
        <div className="brand-copy">
          <p className="eyebrow">{t('sidebar.eyebrow')}</p>
          <h1>{t('app.product')}</h1>
        </div>
        <button type="button" className="sidebar-toggle" onClick={onToggleCollapsed} aria-label={t('sidebar.collapse')} title={t('sidebar.collapse')}>
          <BookMindIcon name="libraryGroupCollapse" />
        </button>
      </div>

      <nav className="nav-list" aria-label={t('sidebar.mainNav')}>
        {navItems.map((item) => (
          <button className={navItemClassName('nav-item', item.id)} key={item.id} data-label={item.label} data-nav-page={item.id} title={item.label} onPointerDown={(event) => startNavPointerDrag(event, item.id)} onPointerMove={moveNavPointerDrag} onPointerUp={endNavPointerDrag} onPointerCancel={endNavPointerDrag} onClick={() => { if (suppressNavClickRef.current) return; onNavigate(item.id); }}>
            <i aria-hidden="true"><AppNavIcon page={item.id} /></i>
            <span>{item.label}</span>
            {item.badge ? <em>{item.badge}</em> : null}
          </button>
        ))}
      </nav>

      <section className="book-stack">
        <div className="section-title">
          <span>{t('common.localBookshelf')}</span>
          <strong>{recentSidebarBooks.length}</strong>
        </div>
        {recentSidebarBooks.length ? recentSidebarBooks.map((recentBook) => (
          <button className={book?.id === recentBook.id ? 'book-card selected' : 'book-card'} key={recentBook.id} onClick={() => onOpenBook(recentBook.id)}>
            <BookCoverImage book={recentBook} className="book-cover" />
            <div>
              <h2>{getPrivacyBookTitle(recentBook.displayTitle, privacySettings)}</h2>
              <p>{recentBook.author} · {recentBook.status}</p>
              <p className="file-name">{getPrivacyFileName(recentBook.fileName, privacySettings)}</p>
              <div className="progress"><i style={{ width: `${recentBook.progress}%` }} /></div>
            </div>
          </button>
        )) : <article className="empty-card">{visibleBooks.length > 0 ? t('sidebar.recentHidden') : t('sidebar.empty')}</article>}
      </section>
    </aside>
  );
}

function BookCoverImage({ book, className }: { book: Book; className: string }) {
  if (book.coverImagePath) {
    return <span className={`${className} image-cover`}><img src={toLocalAssetUrl(book.coverImagePath)} alt="" loading="lazy" draggable={false} /></span>;
  }
  return <span className={className}>{book.coverLabel}</span>;
}

function toLocalAssetUrl(path: string) {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

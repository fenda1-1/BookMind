import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { loadIndexedChunksPreview } from '../../services/taskService';
import { requestReaderLocationOpen } from '../../services/appNavigationEvents';
import type { BookIndexManifest, IndexedChunkPreviewItem, IndexedChunksPreview, SearchResult } from '../../types';
import { formatTaskNumber } from './taskFormat';
import { formatTaskRelativeTime } from './taskTime';
import { displayTaskPath, redactTaskText } from './taskPrivacy';

type IndexManifestBrowserProps = {
  books: BookIndexManifest[];
  initialChunkPreview?: IndexedChunksPreview | null;
  onDeleteIndex: (bookId: string) => void;
  onImportIndexEntry: () => void;
  onRebuildIndex: (bookId: string) => void;
  onRepairFts: (bookId: string) => void;
  privacyMode: boolean;
};

type IndexStatusFilter = 'all' | 'building' | 'ready' | 'missing' | 'stale' | 'failed';
type IndexBookMenu = { bookId: string; x: number; y: number } | null;

export function IndexManifestBrowser({
  books,
  initialChunkPreview = null,
  onDeleteIndex,
  onImportIndexEntry,
  onRebuildIndex,
  onRepairFts,
  privacyMode,
}: IndexManifestBrowserProps) {
  const { t } = useI18n();
  const [indexStatusFilter, setIndexStatusFilter] = useState<IndexStatusFilter>('all');
  const [expandedBookId, setExpandedBookId] = useState(initialChunkPreview?.bookId ?? '');
  const [detailBookId, setDetailBookId] = useState('');
  const [bookMenu, setBookMenu] = useState<IndexBookMenu>(null);
  const [chunkPreviewQuery, setChunkPreviewQuery] = useState('');
  const [chunkPreviewChapter, setChunkPreviewChapter] = useState('all');
  const [chunkPreview, setChunkPreview] = useState<IndexedChunksPreview | null>(initialChunkPreview);
  const [chunkPreviewLoading, setChunkPreviewLoading] = useState(false);
  const [chunkPreviewError, setChunkPreviewError] = useState('');
  const indexStatusOptions: Array<{ value: IndexStatusFilter; label: string }> = [
    { value: 'all', label: t('tasks.indexBrowser.statusAll') },
    { value: 'building', label: t('tasks.indexBrowser.statusBuilding') },
    { value: 'ready', label: t('tasks.indexBrowser.statusReady') },
    { value: 'missing', label: t('tasks.indexBrowser.statusMissing') },
    { value: 'stale', label: t('tasks.indexBrowser.statusStale') },
    { value: 'failed', label: t('tasks.indexBrowser.statusFailed') },
  ];
  const filteredBooks = useMemo(
    () => indexStatusFilter === 'all' ? books : books.filter((book) => getIndexStatusBucket(book) === indexStatusFilter),
    [books, indexStatusFilter],
  );
  const expandedBook = books.find((book) => book.bookId === expandedBookId) ?? null;
  const detailBook = books.find((book) => book.bookId === detailBookId) ?? null;
  const menuBook = books.find((book) => book.bookId === bookMenu?.bookId) ?? null;
  const chunkPreviewChapterOptions = useMemo(() => {
    const chapters = new Map<number, string>();
    chunkPreview?.items.forEach((item) => chapters.set(item.chapterIndex, item.chapterTitle || `#${item.chapterIndex}`));
    return Array.from(chapters.entries()).sort((a, b) => a[0] - b[0]);
  }, [chunkPreview]);

  useEffect(() => {
    if (!bookMenu) return;
    function closeMenu() { setBookMenu(null); }
    function handleKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') closeMenu(); }
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [bookMenu]);

  async function toggleChunkPreview(book: BookIndexManifest) {
    setBookMenu(null);
    const nextExpanded = expandedBookId === book.bookId ? '' : book.bookId;
    setExpandedBookId(nextExpanded);
    if (!nextExpanded) {
      setChunkPreview(null);
      return;
    }
    await refreshChunkPreview(book.bookId, chunkPreviewQuery, chunkPreviewChapter);
  }

  async function refreshChunkPreview(bookId = expandedBookId, query = chunkPreviewQuery, chapter = chunkPreviewChapter) {
    if (!bookId) return;
    setChunkPreviewLoading(true);
    setChunkPreviewError('');
    try {
      const chapterIndex = chapter === 'all' ? undefined : Number(chapter);
      setChunkPreview(await loadIndexedChunksPreview(bookId, 20, 0, query, chapterIndex));
    } catch (error) {
      setChunkPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setChunkPreviewLoading(false);
    }
  }

  function openBookMenu(book: BookIndexManifest, x: number, y: number) {
    const menuWidth = 214;
    const menuHeight = 282;
    const viewportWidth = typeof window === 'undefined' ? x + menuWidth : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? y + menuHeight : window.innerHeight;
    setBookMenu({
      bookId: book.bookId,
      x: Math.max(10, Math.min(x, viewportWidth - menuWidth - 10)),
      y: Math.max(10, Math.min(y, viewportHeight - menuHeight - 10)),
    });
  }

  function handleBookContextMenu(event: ReactMouseEvent<HTMLElement>, book: BookIndexManifest) {
    event.preventDefault();
    event.stopPropagation();
    openBookMenu(book, event.clientX, event.clientY);
  }

  function handleBookMenuButton(event: ReactMouseEvent<HTMLButtonElement>, book: BookIndexManifest) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openBookMenu(book, rect.right - 214, rect.bottom + 6);
  }

  function runBookAction(action: () => void) {
    setBookMenu(null);
    action();
  }

  const floatingLayers = (
    <>
      {bookMenu && menuBook ? (
        <div
          className="task-floating-menu index-book-context-menu"
          role="menu"
          style={{ left: `${bookMenu.x}px`, top: `${bookMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
        >
          <IndexMenuButton icon="note" label={t('tasks.indexBrowser.viewDetails')} onClick={() => runBookAction(() => setDetailBookId(menuBook.bookId))} />
          <IndexMenuButton icon="more" label={t('tasks.indexBrowser.previewChunks')} onClick={() => runBookAction(() => { void toggleChunkPreview(menuBook); })} />
          <div className="task-floating-menu-separator" />
          <IndexMenuButton icon="retry" label={t('tasks.action.rebuildIndex')} onClick={() => runBookAction(() => onRebuildIndex(menuBook.bookId))} />
          {menuBook.chunkCount > 0 && menuBook.ftsRowCount === 0 ? <IndexMenuButton icon="saveCommand" label={t('tasks.action.repairFts')} onClick={() => runBookAction(() => onRepairFts(menuBook.bookId))} /> : null}
          <IndexMenuButton danger icon="close" label={t('tasks.action.deleteIndex')} onClick={() => runBookAction(() => onDeleteIndex(menuBook.bookId))} />
        </div>
      ) : null}
      {detailBook ? <IndexBookDetail book={detailBook} onClose={() => setDetailBookId('')} privacyMode={privacyMode} /> : null}
      {expandedBook ? renderChunkPreviewPanel() : null}
    </>
  );

  return (
    <section className="index-manifest-browser" aria-label={t('tasks.indexBrowser.title')}>
      <div className="task-section-heading">
        <div>
          <p className="eyebrow">{t('tasks.indexBrowser.eyebrow')}</p>
          <h2>{t('tasks.indexBrowser.title')}</h2>
        </div>
        <ThemedSelect
          ariaLabel={t('tasks.indexBrowser.statusFilter')}
          className="task-filter-select task-index-status-select"
          label={t('tasks.indexBrowser.statusFilter')}
          menuPlacement="bottom"
          onChange={setIndexStatusFilter}
          options={indexStatusOptions}
          value={indexStatusFilter}
        />
      </div>
      {filteredBooks.length === 0 ? (
        <div className="task-table-empty task-index-empty-state">
          <strong>{t('tasks.indexBrowser.noSearchableContent')}</strong>
          <span>{t('tasks.indexBrowser.empty')}</span>
          <button className="primary-btn small" onClick={onImportIndexEntry}>{t('tasks.indexBrowser.importEntry')}</button>
        </div>
      ) : null}
      <div className="index-book-card-grid">
        {filteredBooks.map((book) => {
          const status = getIndexStatusBucket(book);
          const warning = book.staleReason || book.lastError;
          return (
            <article
              className={`index-book-card status-${status}`}
              key={book.bookId}
              onContextMenu={(event) => handleBookContextMenu(event, book)}
            >
              <span className="index-book-card-icon"><BookMindIcon name="library" /></span>
              <div className="index-book-card-copy">
                <strong title={displayTaskPath(book.filePath, privacyMode)}>{redactTaskText(book.bookTitle || book.bookId, privacyMode)}</strong>
                <span className={`task-status-pill ${status}`}>{indexStatusLabel(status, t)}</span>
                {warning ? <p title={redactTaskText(warning, privacyMode)}>{redactTaskText(warning, privacyMode)}</p> : <p>{t('tasks.indexBrowser.cardReady')}</p>}
              </div>
              <button
                className="task-queue-card-menu-btn index-book-menu-trigger"
                type="button"
                aria-label={t('tasks.table.action')}
                aria-haspopup="menu"
                onClick={(event) => handleBookMenuButton(event, book)}
              >
                <BookMindIcon name="more" />
              </button>
            </article>
          );
        })}
      </div>
      {typeof document !== 'undefined' ? createPortal(floatingLayers, document.querySelector<HTMLElement>('.app-shell') ?? document.body) : floatingLayers}
    </section>
  );

  function renderChunkPreviewPanel() {
    const previewItems = chunkPreview?.items ?? [];
    function closeChunkPreview() {
      setExpandedBookId('');
      setChunkPreview(null);
    }
    return (
      <div className="task-detail-popover index-chunk-preview-popover" role="presentation">
        <button className="task-detail-popover-backdrop" type="button" aria-label={t('tasks.indexBrowser.closeChunks')} onClick={closeChunkPreview} />
        <aside className="task-detail-panel index-chunk-preview-panel" aria-label={t('tasks.indexBrowser.previewChunks')}>
          <div className="index-chunk-preview-heading">
            <div><p className="eyebrow">{t('tasks.indexBrowser.previewChunks')}</p><h2>{redactTaskText(expandedBook?.bookTitle || expandedBookId, privacyMode)}</h2></div>
            <button className="task-icon-btn task-detail-close" type="button" aria-label={t('tasks.indexBrowser.closeChunks')} data-tooltip={t('tasks.indexBrowser.closeChunks')} onClick={closeChunkPreview}><BookMindIcon name="close" /></button>
          </div>
          <div className="task-log-controls index-chunk-preview-controls">
            <input value={chunkPreviewQuery} onChange={(event) => setChunkPreviewQuery(event.target.value)} placeholder={t('tasks.indexBrowser.chunkSearch')} />
            <ThemedSelect
              ariaLabel={t('tasks.indexBrowser.chapterFilter')}
              className="task-filter-select index-chunk-chapter-select"
              label={t('tasks.indexBrowser.chapterFilter')}
              menuPlacement="bottom"
              onChange={setChunkPreviewChapter}
              options={[
                { value: 'all', label: t('tasks.indexBrowser.chapterFilter') },
                ...chunkPreviewChapterOptions.map(([chapterIndex, chapterTitle]) => ({ value: String(chapterIndex), label: chapterTitle })),
              ]}
              value={chunkPreviewChapter}
            />
            <button className="ghost-btn small" type="button" onClick={() => { void refreshChunkPreview(); }}>{t('tasks.indexBrowser.previewChunks')}</button>
          </div>
          {chunkPreviewLoading ? <p className="empty-hint">{t('tasks.running')}</p> : null}
          {chunkPreviewError ? <p className="task-error-banner">{chunkPreviewError}</p> : null}
          <div className="index-chunk-preview-table-wrap">
            <div className="index-chunk-preview-table">
              <div>{t('tasks.indexBrowser.chunkOrdinal')}</div>
              <div>{t('tasks.indexBrowser.chapterTitle')}</div>
              <div>{t('tasks.indexBrowser.paragraphRange')}</div>
              <div>{t('tasks.indexBrowser.charRange')}</div>
              <div>{t('tasks.indexBrowser.charCount')}</div>
              <div>{t('tasks.indexBrowser.textPreview')}</div>
              <div>{t('tasks.table.action')}</div>
              {previewItems.map((chunk) => {
                const charRange = `${formatTaskNumber(chunk.charStart)}-${formatTaskNumber(chunk.charEnd)}`;
                return (
                  <div className="index-chunk-preview-row" key={chunk.chunkId}>
                    <div>#{formatTaskNumber(chunk.ordinal)}</div>
                    <div>{chunk.chapterTitle}</div>
                    <div>{chunk.paragraphRange}</div>
                    <div>{charRange}</div>
                    <div>{formatTaskNumber(chunk.charCount)}</div>
                    <div title={chunk.fullText}>{chunk.textPreview}</div>
                    <div className="task-actions">
                      <TaskIndexIconButton icon="reader" label={t('tasks.indexBrowser.jumpReader')} onClick={() => openChunkInReader(expandedBook, chunk)} />
                      <TaskIndexIconButton icon="copy" label={t('tasks.indexBrowser.copyChunk')} onClick={() => copyChunkPreviewText(chunk.fullText)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    );
  }
}

function IndexBookDetail({ book, onClose, privacyMode }: { book: BookIndexManifest; onClose: () => void; privacyMode: boolean }) {
  const { t } = useI18n();
  const builtTime = formatTaskRelativeTime(book.builtAt);
  const status = getIndexStatusBucket(book);
  return (
    <div className="task-detail-popover index-book-detail-popover" role="presentation">
      <button className="task-detail-popover-backdrop" type="button" aria-label={t('tasks.indexBrowser.closeDetails')} onClick={onClose} />
      <aside className="task-detail-panel index-book-detail-panel" aria-label={t('tasks.indexBrowser.detailsTitle')}>
        <div className="index-book-detail-heading">
          <div><p className="eyebrow">{t('tasks.indexBrowser.detailsTitle')}</p><h2>{redactTaskText(book.bookTitle || book.bookId, privacyMode)}</h2></div>
          <button className="task-icon-btn task-detail-close" type="button" aria-label={t('tasks.indexBrowser.closeDetails')} data-tooltip={t('tasks.indexBrowser.closeDetails')} onClick={onClose}><BookMindIcon name="close" /></button>
        </div>
        <div className="index-book-detail-status"><span className={`task-status-pill ${status}`}>{indexStatusLabel(status, t)}</span>{book.staleReason ? <span>{redactTaskText(book.staleReason, privacyMode)}</span> : null}</div>
        <dl className="index-book-detail-grid">
          <DetailItem label={t('tasks.indexBrowser.chapters')} value={formatTaskNumber(book.chapterCount)} />
          <DetailItem label={t('tasks.indexBrowser.paragraphs')} value={formatTaskNumber(book.paragraphCount)} />
          <DetailItem label={t('tasks.indexBrowser.chunks')} value={formatTaskNumber(book.chunkCount)} />
          <DetailItem label={t('tasks.indexBrowser.ftsRows')} value={formatTaskNumber(book.ftsRowCount)} />
          <DetailItem label={t('tasks.indexBrowser.indexVersion')} value={`v${formatTaskNumber(book.indexVersion)}`} />
          <DetailItem label={t('tasks.indexBrowser.chunkVersion')} value={`v${formatTaskNumber(book.chunkStrategyVersion)}`} />
          <DetailItem label={t('tasks.indexBrowser.chapterVersion')} value={`v${formatTaskNumber(book.chapterRuleVersion)}`} />
          <DetailItem label={t('tasks.indexBrowser.ftsVersion')} value={`v${formatTaskNumber(book.ftsSchemaVersion)}`} />
          <DetailItem label={t('tasks.indexBrowser.bytesIndexed')} value={formatTaskNumber(book.bytesIndexed)} />
          <DetailItem label={t('tasks.indexBrowser.builtAt')} value={builtTime.label} title={builtTime.title} />
        </dl>
        <dl className="index-book-detail-wide">
          <DetailItem label={t('tasks.indexBrowser.contentHash')} value={book.contentHash || '-'} />
          <DetailItem label={t('tasks.indexBrowser.filePath')} value={displayTaskPath(book.filePath, privacyMode)} />
          <DetailItem label={t('tasks.indexBrowser.firstChunkPreview')} value={redactTaskText(book.firstChunkPreview || '-', privacyMode)} />
          {book.lastError ? <DetailItem label={t('tasks.indexBrowser.lastError')} value={redactTaskText(book.lastError, privacyMode)} /> : null}
        </dl>
      </aside>
    </div>
  );
}

function DetailItem({ label, title, value }: { label: string; title?: string; value: string }) {
  return <div><dt>{label}</dt><dd title={title}>{value}</dd></div>;
}

function IndexMenuButton({ danger = false, icon, label, onClick }: { danger?: boolean; icon: BookMindIconName; label: string; onClick: () => void }) {
  return <button className={danger ? 'danger' : undefined} role="menuitem" type="button" onClick={onClick}><BookMindIcon name={icon} /><span>{label}</span></button>;
}

function copyChunkPreviewText(text: string) {
  void navigator.clipboard?.writeText(text);
}

function openChunkInReader(book: BookIndexManifest | null, chunk: IndexedChunkPreviewItem) {
  const result: SearchResult = {
    chunkId: chunk.chunkId,
    bookId: book?.bookId ?? '',
    bookTitle: book?.bookTitle ?? '',
    chapter: chunk.chapterTitle,
    sourceChapterIndex: chunk.sourceChapterIndex,
    chapterTitle: chunk.chapterTitle,
    snippet: chunk.textPreview || chunk.fullText,
    score: 1,
    paragraphIndex: chunk.paragraphIndex,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
  };
  requestReaderLocationOpen({ result, readerLocation: chunk.readerLocation });
}

function getIndexStatusBucket(book: BookIndexManifest): IndexStatusFilter {
  if (book.status === 'failed') return 'failed';
  if (book.status === 'stale' || book.staleReason) return 'stale';
  if (book.status === 'missing' || (book.chunkCount === 0 && book.ftsRowCount === 0)) return 'missing';
  if (book.status === 'building') return 'building';
  return 'ready';
}

function indexStatusLabel(status: IndexStatusFilter, t: ReturnType<typeof useI18n>['t']) {
  if (status === 'failed') return t('tasks.indexBrowser.statusFailed');
  if (status === 'stale') return t('tasks.indexBrowser.statusStale');
  if (status === 'missing') return t('tasks.indexBrowser.statusMissing');
  if (status === 'building') return t('tasks.indexBrowser.statusBuilding');
  return t('tasks.indexBrowser.statusReady');
}

function TaskIndexIconButton({ danger = false, icon, label, onClick }: {
  danger?: boolean;
  icon: BookMindIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={label} className={danger ? 'task-icon-btn danger' : 'task-icon-btn'} data-tooltip={label} onClick={onClick} title={label} type="button">
      <BookMindIcon name={icon} />
    </button>
  );
}

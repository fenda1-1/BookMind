import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { save } from '@tauri-apps/plugin-dialog';
import { BookMindIcon } from '../components/BookMindIcon';
import { ThemedSelect } from '../components/ThemedSelect';
import { LibraryBookCover } from '../features/library/LibraryBookViews';
import { loadGlobalReaderSettings } from '../features/reader-core/readerSettings';
import { useI18n } from '../i18n';
import { isTauriRuntime } from '../app/platform';
import { subscribeFlashcardsUpdated, subscribeHighlightsUpdated, subscribeNotesUpdated } from '../services/appDomainEvents';
import { createBrowserDemoAnnotations } from '../services/libraryService';
import { deleteFlashcards, deleteHighlights, deleteNotes, generateFlashcardsFromHighlights, loadFlashcards, loadHighlights, loadNotes } from '../services/noteService';
import { serializeKnowledgeExport, type KnowledgeExportFormat } from '../services/knowledgeExportService';
import { emitReaderAnnotationsUpdated, subscribeReaderAnnotationsUpdated } from '../services/readerAnnotationEvents';
import { writeReaderExportFile } from '../services/readerExportService';
import { createSensitiveReaderStoragePayload, getReaderRecord, listReaderRecordsByKind, parseReaderRecord, saveReaderRecord } from '../services/readerStorageService';
import { getPrivacyExportFileBaseName, loadExtendedSettings, saveExtendedSettings, subscribeSettingsUpdated, type ExtendedSettings } from '../services/settingsCenterService';
import type { Book, FlashcardRecord, HighlightRecord, NoteRecord, ReaderBookmark, ReaderHighlight, ReaderHighlightColor } from '../types';
import {
  buildKnowledgeBookSummaries,
  buildKnowledgePageItems,
  matchesKnowledgeQuery,
  matchesKnowledgeView,
  type KnowledgeBookSummary,
  type KnowledgeItemKind,
  type KnowledgePageItem,
  type KnowledgeView,
} from './knowledgePageState';
import { buildReaderAnnotationExportDefaultPath, downloadReaderText, getReaderExportDirectory } from './readerWorkspaceStorage';

type KnowledgePageProps = {
  books: Book[];
  onOpenBook: (bookId: string) => void;
};

type KnowledgeSort = 'newest' | 'oldest' | 'location';
type BookVisibility = 'with-knowledge' | 'all';
type ColorFilter = ReaderHighlightColor | 'all';
type KnowledgeExportScope = 'current' | 'all' | 'selected';
type ItemMenuState = { itemId: string; x: number; y: number } | null;
type BookMenuState = { bookId: string; x: number; y: number } | null;

const KNOWLEDGE_VIEWS: KnowledgeView[] = ['all', 'highlights', 'annotations', 'bookmarks', 'notes', 'flashcards'];
const HIGHLIGHT_COLORS: ReaderHighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'violet', 'red'];

export function KnowledgePage({ books, onOpenBook }: KnowledgePageProps) {
  const { locale, t } = useI18n();
  const [savedNotes, setSavedNotes] = useState<NoteRecord[]>([]);
  const [savedHighlights, setSavedHighlights] = useState<HighlightRecord[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardRecord[]>([]);
  const [readerHighlights, setReaderHighlights] = useState<ReaderHighlight[]>([]);
  const [readerBookmarks, setReaderBookmarks] = useState<ReaderBookmark[]>([]);
  const [settings, setSettings] = useState<ExtendedSettings>(() => loadExtendedSettings());
  const [selectedBookId, setSelectedBookId] = useState('all');
  const [activeView, setActiveView] = useState<KnowledgeView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [sort, setSort] = useState<KnowledgeSort>('newest');
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [bookVisibility, setBookVisibility] = useState<BookVisibility>('with-knowledge');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState>(null);
  const [bookMenu, setBookMenu] = useState<BookMenuState>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'delete' | 'export' | 'generate' | 'update' | ''>('');
  const [exportPath, setExportPath] = useState('');
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<KnowledgeExportFormat>(() => loadExtendedSettings().defaultExportFormat);
  const [exportScope, setExportScope] = useState<KnowledgeExportScope>('current');

  useEffect(() => subscribeSettingsUpdated(() => setSettings(loadExtendedSettings())), []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const [notes, highlights, cards, reader] = await Promise.all([
        loadNotes(),
        loadHighlights(),
        loadFlashcards(),
        loadReaderKnowledge(books),
      ]);
      if (cancelled) return;
      setSavedNotes(notes);
      setSavedHighlights(highlights);
      setFlashcards(cards);
      setReaderHighlights(reader.highlights);
      setReaderBookmarks(reader.bookmarks);
      setLoading(false);
    }
    void refresh();
    const unsubscribers = [subscribeNotesUpdated(refresh), subscribeHighlightsUpdated(refresh), subscribeFlashcardsUpdated(refresh)];
    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [books]);

  useEffect(() => subscribeReaderAnnotationsUpdated(({ bookId, kind }) => {
    void refreshReaderBookKnowledge(bookId, kind, setReaderHighlights, setReaderBookmarks);
  }), []);

  useEffect(() => {
    async function refreshReaderData() {
      const reader = await loadReaderKnowledge(books);
      setReaderHighlights(reader.highlights);
      setReaderBookmarks(reader.bookmarks);
    }
    function refreshOnVisibility() {
      if (document.visibilityState === 'visible') void refreshReaderData();
    }
    window.addEventListener('focus', refreshReaderData);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.removeEventListener('focus', refreshReaderData);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [books]);

  useEffect(() => {
    function closeMenus() {
      setItemMenu(null);
      setBookMenu(null);
      setExportPanelOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (pendingDeleteIds.length) setPendingDeleteIds([]);
      else if (detailItemId) setDetailItemId(null);
      else closeMenus();
    }
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeMenus);
      window.removeEventListener('resize', closeMenus);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [detailItemId, pendingDeleteIds.length]);

  const items = useMemo(() => buildKnowledgePageItems({ books, highlights: savedHighlights, notes: savedNotes, flashcards, readerHighlights, readerBookmarks }), [books, flashcards, readerBookmarks, readerHighlights, savedHighlights, savedNotes]);
  const summaries = useMemo(() => buildKnowledgeBookSummaries(books, items), [books, items]);
  const activeBook = selectedBookId === 'all' ? null : books.find((book) => book.id === selectedBookId) ?? null;
  const scopedItems = useMemo(() => items.filter((item) => selectedBookId === 'all' || item.bookId === selectedBookId), [items, selectedBookId]);
  const visibleItems = useMemo(() => scopedItems
    .filter((item) => matchesKnowledgeView(item, activeView))
    .filter((item) => colorFilter === 'all' || item.color === colorFilter)
    .filter((item) => matchesKnowledgeQuery(item, searchQuery))
    .sort((left, right) => compareKnowledgeItems(left, right, sort)), [activeView, colorFilter, scopedItems, searchQuery, sort]);
  const filteredSummaries = useMemo(() => summaries.filter((summary) => {
    if (bookVisibility === 'with-knowledge' && summary.total === 0) return false;
    const query = bookQuery.trim().toLocaleLowerCase();
    return !query || [summary.book.displayTitle, summary.book.title, summary.book.author].some((value) => value.toLocaleLowerCase().includes(query));
  }), [bookQuery, bookVisibility, summaries]);
  const selectedItem = detailItemId ? items.find((item) => item.id === detailItemId) ?? null : null;
  const totalAnnotations = items.filter((item) => item.storage === 'reader-highlight' && item.note?.trim()).length;
  const totalBookmarks = items.filter((item) => item.kind === 'bookmarks').length;
  const selectedVisibleCount = visibleItems.filter((item) => selectedIds.has(item.id)).length;
  const viewCounts = useMemo(() => Object.fromEntries(KNOWLEDGE_VIEWS.map((view) => [view, scopedItems.filter((item) => matchesKnowledgeView(item, view)).length])) as Record<KnowledgeView, number>, [scopedItems]);

  useEffect(() => {
    if (selectedBookId === 'all' || books.some((book) => book.id === selectedBookId && !book.deleted)) return;
    setSelectedBookId('all');
  }, [books, selectedBookId]);

  function chooseBook(bookId: string, view: KnowledgeView = activeView) {
    setSelectedBookId(bookId);
    setActiveView(view);
    setSelectedIds(new Set());
    setBookMenu(null);
  }

  function openItemMenu(event: React.MouseEvent, itemId: string) {
    event.preventDefault();
    event.stopPropagation();
    setBookMenu(null);
    setItemMenu({ itemId, ...clampMenuPosition(event.clientX, event.clientY, 210, 220) });
  }

  function openBookMenu(event: React.MouseEvent, bookId: string) {
    event.preventDefault();
    event.stopPropagation();
    setItemMenu(null);
    setBookMenu({ bookId, ...clampMenuPosition(event.clientX, event.clientY, 210, 250) });
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyItem(item: KnowledgePageItem) {
    await navigator.clipboard.writeText([item.body, item.note].filter(Boolean).join('\n\n'));
    setItemMenu(null);
  }

  async function exportKnowledge() {
    const exportItems = exportScope === 'all' ? items : exportScope === 'selected' ? items.filter((item) => selectedIds.has(item.id)) : visibleItems;
    if (!exportItems.length) return;
    setBusy('export');
    try {
      const title = activeBook?.displayTitle || t('knowledge.indexTitle');
      const payload = serializeKnowledgeExport(exportItems, exportFormat, title);
      const filenameBase = getPrivacyExportFileBaseName(activeBook?.displayTitle || 'bookmind-knowledge', settings);
      const filename = `${filenameBase}-knowledge-${exportFormat}.${payload.extension}`;
      if (!isTauriRuntime()) {
        downloadReaderText(filename, payload.content, payload.mime);
        setExportPath(filename);
      } else {
        const selectedPath = await save({
          title: t('knowledge.export.chooseLocation'),
          defaultPath: buildReaderAnnotationExportDefaultPath(settings.annotationExportLastDirectory, filename),
          filters: [{ name: payload.extension.toUpperCase(), extensions: [payload.extension] }],
        });
        if (!selectedPath) return;
        await writeReaderExportFile(selectedPath, payload.content);
        setExportPath(selectedPath);
        const directory = getReaderExportDirectory(selectedPath);
        if (directory && directory !== settings.annotationExportLastDirectory) {
          const nextSettings = saveExtendedSettings({ ...loadExtendedSettings(), annotationExportLastDirectory: directory }, { key: 'annotationExportLastDirectory' });
          setSettings(nextSettings);
        }
      }
      setExportPanelOpen(false);
    } catch (error) {
      console.error('Failed to export knowledge:', error);
      setExportPath(t('knowledge.exportFailed'));
    } finally {
      setBusy('');
    }
  }

  async function generateCards() {
    if (!settings.highlightFlashcardGenerationEnabled) return;
    setBusy('generate');
    try {
      const cards = await generateFlashcardsFromHighlights({
        defaultTags: settings.highlightFlashcardDefaultTags.split(/[，,\s]+/).filter(Boolean).slice(0, 12),
        defaultReviewStatus: settings.highlightFlashcardDefaultReviewStatus,
        frontTemplate: settings.highlightFlashcardFrontTemplate,
        backTemplate: settings.highlightFlashcardBackTemplate,
      });
      setFlashcards(cards);
    } catch (error) {
      console.error('Failed to generate flashcards:', error);
    } finally {
      setBusy('');
    }
  }

  async function deleteItems(ids: string[]) {
    if (!ids.length) return;
    setBusy('delete');
    try {
      const deletingItems = items.filter((item) => ids.includes(item.id));
      await Promise.all([
        deleteKnowledgeRecords(deletingItems, 'knowledge-highlight', deleteHighlights),
        deleteKnowledgeRecords(deletingItems, 'knowledge-note', deleteNotes),
        deleteKnowledgeRecords(deletingItems, 'knowledge-flashcard', deleteFlashcards),
        saveReaderItemsAfterDelete(deletingItems, readerHighlights, readerBookmarks),
      ]);
      const deleted = new Set(ids);
      setSavedHighlights((current) => current.filter((item) => !deletingItems.some((candidate) => candidate.storage === 'knowledge-highlight' && candidate.recordId === item.id)));
      setSavedNotes((current) => current.filter((item) => !deletingItems.some((candidate) => candidate.storage === 'knowledge-note' && candidate.recordId === item.id)));
      setFlashcards((current) => current.filter((item) => !deletingItems.some((candidate) => candidate.storage === 'knowledge-flashcard' && candidate.recordId === item.id)));
      setReaderHighlights((current) => current.filter((item) => !deletingItems.some((candidate) => candidate.storage === 'reader-highlight' && candidate.bookId === item.bookId && candidate.recordId === item.id)));
      setReaderBookmarks((current) => current.filter((item) => !deletingItems.some((candidate) => candidate.storage === 'reader-bookmark' && candidate.bookId === item.bookId && candidate.recordId === item.id)));
      setSelectedIds((current) => new Set([...current].filter((id) => !deleted.has(id))));
      setDetailItemId(null);
      setPendingDeleteIds([]);
    } catch (error) {
      console.error('Failed to delete knowledge items:', error);
    } finally {
      setBusy('');
    }
  }

  async function updateReaderItem(item: KnowledgePageItem, updates: { note: string; tags: string[]; color: ReaderHighlightColor }) {
    if (!item.bookId || (item.storage !== 'reader-highlight' && item.storage !== 'reader-bookmark')) return;
    setBusy('update');
    const updatedAt = new Date().toISOString();
    try {
      if (item.storage === 'reader-highlight') {
        const next = readerHighlights.map((highlight) => highlight.bookId === item.bookId && highlight.id === item.recordId ? { ...highlight, ...updates, updatedAt } : highlight);
        await persistReaderCollection(item.bookId, 'highlights', next.filter((highlight) => highlight.bookId === item.bookId));
        setReaderHighlights(next);
      } else {
        const next = readerBookmarks.map((bookmark) => bookmark.bookId === item.bookId && bookmark.id === item.recordId ? { ...bookmark, ...updates, updatedAt } : bookmark);
        await persistReaderCollection(item.bookId, 'bookmarks', next.filter((bookmark) => bookmark.bookId === item.bookId));
        setReaderBookmarks(next);
      }
    } catch (error) {
      console.error('Failed to update reader knowledge item:', error);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="page-surface knowledge-page knowledge-index-page">
      <div className="knowledge-index-top">
      <header className="knowledge-index-header">
        <div className="knowledge-index-heading">
          <span className="knowledge-index-mark"><BookMindIcon name="index" /></span>
          <div><h2>{t('knowledge.indexTitle')}</h2><p>{t('knowledge.indexSubtitle')}</p></div>
        </div>
        <div className="knowledge-index-metrics" aria-label={t('knowledge.summary')}>
          <KnowledgeMetric value={summaries.filter((summary) => summary.total > 0).length} label={t('knowledge.metric.books')} />
          <KnowledgeMetric value={items.filter((item) => item.kind === 'highlights').length} label={t('knowledge.metric.highlights')} />
          <KnowledgeMetric value={totalAnnotations} label={t('knowledge.metric.annotations')} />
          <KnowledgeMetric value={totalBookmarks} label={t('knowledge.metric.bookmarks')} />
        </div>
        <div className="knowledge-export-wrap" onClick={(event) => event.stopPropagation()}>
          <button className="primary-btn small knowledge-export-btn" type="button" aria-haspopup="dialog" aria-expanded={exportPanelOpen} onClick={() => setExportPanelOpen((open) => !open)} disabled={busy === 'export'}>
            <BookMindIcon name="saveCommand" />{busy === 'export' ? t('knowledge.exporting') : t('knowledge.export')}
          </button>
          {exportPanelOpen ? <KnowledgeExportPanel format={exportFormat} scope={exportScope} currentCount={visibleItems.length} allCount={items.length} selectedCount={selectedIds.size} directory={settings.annotationExportLastDirectory} exporting={busy === 'export'} onFormat={setExportFormat} onScope={setExportScope} onExport={() => void exportKnowledge()} onClose={() => setExportPanelOpen(false)} /> : null}
        </div>
      </header>
      {exportPath ? <div className="knowledge-export-path" role="status">{exportPath}</div> : null}
      </div>

      <div className="knowledge-index-shell">
        <aside className="knowledge-book-pane">
          <div className="knowledge-book-pane-head">
            <div><strong>{t('knowledge.books')}</strong><span>{filteredSummaries.length}</span></div>
            <ThemedSelect
              className="knowledge-compact-select"
              label={t('knowledge.bookVisibility')}
              ariaLabel={t('knowledge.bookVisibility')}
              value={bookVisibility}
              options={[
                { value: 'with-knowledge', label: t('knowledge.bookVisibility.used') },
                { value: 'all', label: t('knowledge.bookVisibility.all') },
              ]}
              onChange={setBookVisibility}
              menuPlacement="bottom"
            />
          </div>
          <label className="knowledge-book-search"><BookMindIcon name="readerSearch" /><input value={bookQuery} onChange={(event) => setBookQuery(event.target.value)} placeholder={t('knowledge.searchBooks')} /></label>
          <div className="knowledge-book-list">
            <button className={`knowledge-all-books${selectedBookId === 'all' ? ' active' : ''}`} type="button" onClick={() => chooseBook('all')}>
              <span><BookMindIcon name="grid" /></span><div><strong>{t('knowledge.allBooks')}</strong><em>{t('knowledge.itemsCount', { count: items.length })}</em></div>
            </button>
            {filteredSummaries.map((summary) => <KnowledgeBookCard key={summary.book.id} summary={summary} active={selectedBookId === summary.book.id} onChoose={() => chooseBook(summary.book.id)} onMenu={openBookMenu} />)}
            {!loading && !filteredSummaries.length ? <p className="empty-hint knowledge-book-empty">{t('knowledge.emptyBooks')}</p> : null}
          </div>
        </aside>

        <main className="knowledge-content-pane">
          <KnowledgeScopeHeader activeBook={activeBook} scopedItems={scopedItems} summaries={summaries} onOpenBook={onOpenBook} />
          <div className="knowledge-filter-bar">
            <label className="knowledge-content-search"><BookMindIcon name="readerSearch" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('knowledge.searchPlaceholder')} /></label>
            <ThemedSelect className="knowledge-filter-select" label={t('knowledge.sort')} value={sort} options={[
              { value: 'newest', label: t('knowledge.sort.newest') },
              { value: 'oldest', label: t('knowledge.sort.oldest') },
              { value: 'location', label: t('knowledge.sort.location') },
            ]} onChange={setSort} menuPlacement="bottom" />
            <ThemedSelect className="knowledge-filter-select color-filter" label={t('knowledge.color')} value={colorFilter} options={[
              { value: 'all', label: t('knowledge.color.all') },
              ...HIGHLIGHT_COLORS.map((color) => ({ value: color, label: t(`knowledge.color.${color}` as never) })),
            ]} onChange={setColorFilter} menuPlacement="bottom" />
          </div>
          <div className="knowledge-view-tabs" role="tablist" aria-label={t('knowledge.types')}>
            {KNOWLEDGE_VIEWS.map((view) => <button key={view} className={activeView === view ? 'active' : ''} role="tab" aria-selected={activeView === view} type="button" onClick={() => { setActiveView(view); setSelectedIds(new Set()); }}><span>{t(`knowledge.view.${view}` as never)}</span><em>{viewCounts[view]}</em></button>)}
          </div>
          <div className="knowledge-result-head">
            <span>{t('knowledge.results', { count: visibleItems.length })}{selectedVisibleCount ? ` · ${t('knowledge.selected', { count: selectedVisibleCount })}` : ''}</span>
            <div>
              {activeView === 'flashcards' ? <button className="ghost-btn small" type="button" onClick={generateCards} disabled={busy === 'generate' || !settings.highlightFlashcardGenerationEnabled}><BookMindIcon name="plus" />{busy === 'generate' ? t('knowledge.generating') : t('knowledge.generateFromHighlights')}</button> : null}
              <button className="ghost-btn small" type="button" onClick={() => setSelectedIds(new Set(visibleItems.map((item) => item.id)))} disabled={!visibleItems.length}>{t('knowledge.selectAll')}</button>
              <button className="ghost-btn small" type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>{t('knowledge.clearSelection')}</button>
              <button className="ghost-btn small danger-btn" type="button" onClick={() => setPendingDeleteIds(visibleItems.filter((item) => selectedIds.has(item.id)).map((item) => item.id))} disabled={!selectedVisibleCount || busy === 'delete'}><BookMindIcon name="libraryMenuDelete" />{t('knowledge.deleteSelected')}</button>
            </div>
          </div>

          <div className="knowledge-card-grid" aria-busy={loading}>
            {visibleItems.map((item) => <KnowledgeMasonryItem key={item.id} item={item} selected={selectedIds.has(item.id)} locale={locale} onToggle={() => toggleSelection(item.id)} onOpen={() => setDetailItemId(item.id)} onMenu={openItemMenu} />)}
            {loading ? <div className="knowledge-loading">{t('knowledge.loading')}</div> : null}
            {!loading && !visibleItems.length ? <KnowledgeEmptyState hasQuery={Boolean(searchQuery || colorFilter !== 'all')} /> : null}
          </div>
        </main>
      </div>

      {itemMenu ? createPortal(<KnowledgeItemMenu state={itemMenu} item={items.find((item) => item.id === itemMenu.itemId)} onDetail={(id) => { setDetailItemId(id); setItemMenu(null); }} onCopy={copyItem} onOpenBook={(bookId) => { onOpenBook(bookId); setItemMenu(null); }} onDelete={(id) => { setPendingDeleteIds([id]); setItemMenu(null); }} />, document.body) : null}
      {bookMenu ? createPortal(<KnowledgeBookMenu state={bookMenu} onChoose={chooseBook} onOpenBook={onOpenBook} />, document.body) : null}
      {selectedItem ? createPortal(<KnowledgeDetailDialog item={selectedItem} book={selectedItem.bookId ? books.find((candidate) => candidate.id === selectedItem.bookId) : undefined} locale={locale} saving={busy === 'update'} onClose={() => setDetailItemId(null)} onCopy={copyItem} onOpenBook={onOpenBook} onSave={updateReaderItem} onDelete={(id) => { setDetailItemId(null); setPendingDeleteIds([id]); }} />, document.body) : null}
      {pendingDeleteIds.length ? createPortal(<KnowledgeDeleteDialog count={pendingDeleteIds.length} busy={busy === 'delete'} onCancel={() => setPendingDeleteIds([])} onConfirm={() => void deleteItems(pendingDeleteIds)} />, document.body) : null}
    </section>
  );
}

function KnowledgeExportPanel({ format, scope, currentCount, allCount, selectedCount, directory, exporting, onFormat, onScope, onExport, onClose }: { format: KnowledgeExportFormat; scope: KnowledgeExportScope; currentCount: number; allCount: number; selectedCount: number; directory: string; exporting: boolean; onFormat: (format: KnowledgeExportFormat) => void; onScope: (scope: KnowledgeExportScope) => void; onExport: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const count = scope === 'all' ? allCount : scope === 'selected' ? selectedCount : currentCount;
  const scopeOptions: Array<{ value: KnowledgeExportScope; label: string }> = [
    { value: 'current', label: t('knowledge.export.scopeCurrent', { count: currentCount }) },
    { value: 'all', label: t('knowledge.export.scopeAll', { count: allCount }) },
    ...(selectedCount ? [{ value: 'selected' as const, label: t('knowledge.export.scopeSelected', { count: selectedCount }) }] : []),
  ];
  return <div className="knowledge-export-panel" role="dialog" aria-label={t('knowledge.export.title')}>
    <header><div><strong>{t('knowledge.export.title')}</strong><span>{t('knowledge.export.subtitle')}</span></div><button type="button" onClick={onClose} aria-label={t('knowledge.close')}><BookMindIcon name="close" /></button></header>
    <ThemedSelect label={t('knowledge.export.format')} value={format} options={[
      { value: 'markdown', label: t('reader.annotations.exportMarkdown') },
      { value: 'json', label: t('reader.annotations.exportJson') },
      { value: 'csv', label: t('reader.annotations.exportCsv') },
      { value: 'anki', label: t('reader.annotations.exportAnki') },
      { value: 'obsidian', label: t('reader.annotations.exportObsidian') },
      { value: 'logseq', label: t('reader.annotations.exportLogseq') },
      { value: 'readwise', label: t('reader.annotations.exportReadwise') },
    ]} onChange={onFormat} menuPlacement="bottom" />
    <ThemedSelect label={t('knowledge.export.scope')} value={scope} options={scopeOptions} onChange={onScope} menuPlacement="bottom" />
    <div className="knowledge-export-location"><span>{t('knowledge.export.location')}</span><strong title={directory}>{directory || t('knowledge.export.locationOnExport')}</strong></div>
    <button className="primary-btn knowledge-export-confirm" type="button" onClick={onExport} disabled={!count || exporting}><BookMindIcon name="saveCommand" />{exporting ? t('knowledge.exporting') : t('knowledge.export.chooseLocation')}</button>
  </div>;
}

function KnowledgeMasonryItem({ item, selected, locale, onToggle, onOpen, onMenu }: { item: KnowledgePageItem; selected: boolean; locale: string; onToggle: () => void; onOpen: () => void; onMenu: (event: React.MouseEvent, itemId: string) => void }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const card = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !card) return;
    const updateSpan = () => {
      const height = Math.ceil(card.getBoundingClientRect().height);
      wrapper.style.gridRowEnd = `span ${Math.max(1, height + 8)}`;
    };
    updateSpan();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSpan);
    observer.observe(card);
    return () => observer.disconnect();
  }, [item, selected, locale]);
  return <div className="knowledge-masonry-item" ref={wrapperRef}><KnowledgeItemCard item={item} selected={selected} locale={locale} onToggle={onToggle} onOpen={onOpen} onMenu={onMenu} /></div>;
}

function KnowledgeMetric({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function KnowledgeBookCard({ summary, active, onChoose, onMenu }: { summary: KnowledgeBookSummary; active: boolean; onChoose: () => void; onMenu: (event: React.MouseEvent, bookId: string) => void }) {
  const { t } = useI18n();
  return <article className={`knowledge-book-card${active ? ' active' : ''}`} onContextMenu={(event) => onMenu(event, summary.book.id)}>
    <button className="knowledge-book-card-main" type="button" onClick={onChoose}>
      <LibraryBookCover book={summary.book} className={`knowledge-book-cover ${summary.book.coverTone}`} />
      <div><strong title={summary.book.displayTitle}>{summary.book.displayTitle}</strong><span>{summary.book.author || summary.book.fileName}</span><em>{t('knowledge.bookSummary', { highlights: summary.highlights, annotations: summary.annotations, bookmarks: summary.bookmarks })}</em><ColorDistribution colors={summary.colors} /></div>
    </button>
    <button className="knowledge-more-btn" type="button" aria-label={t('knowledge.bookMenu', { title: summary.book.displayTitle })} title={t('knowledge.actions')} onClick={(event) => onMenu(event, summary.book.id)}><BookMindIcon name="more" /></button>
  </article>;
}

function ColorDistribution({ colors }: { colors: KnowledgeBookSummary['colors'] }) {
  const total = Object.values(colors).reduce((sum, count) => sum + (count ?? 0), 0);
  if (!total) return <span className="knowledge-color-distribution empty" />;
  return <span className="knowledge-color-distribution" aria-hidden="true">{HIGHLIGHT_COLORS.map((color) => colors[color] ? <i key={color} className={color} style={{ flexGrow: colors[color] }} /> : null)}</span>;
}

function KnowledgeScopeHeader({ activeBook, scopedItems, summaries, onOpenBook }: { activeBook: Book | null; scopedItems: KnowledgePageItem[]; summaries: KnowledgeBookSummary[]; onOpenBook: (bookId: string) => void }) {
  const { t } = useI18n();
  const summary = activeBook ? summaries.find((item) => item.book.id === activeBook.id) : null;
  return <header className="knowledge-scope-header">
    <div className="knowledge-scope-identity">
      {activeBook ? <LibraryBookCover book={activeBook} className={`knowledge-scope-cover ${activeBook.coverTone}`} /> : <span className="knowledge-scope-all"><BookMindIcon name="grid" /></span>}
      <div><span>{activeBook ? t('knowledge.currentBook') : t('knowledge.libraryScope')}</span><h3>{activeBook?.displayTitle || t('knowledge.allKnowledge')}</h3><p>{activeBook?.author || t('knowledge.allKnowledgeMeta', { books: summaries.filter((item) => item.total > 0).length, count: scopedItems.length })}</p></div>
    </div>
    <div className="knowledge-scope-stats"><span><strong>{summary?.highlights ?? scopedItems.filter((item) => item.kind === 'highlights').length}</strong>{t('knowledge.metric.highlights')}</span><span><strong>{summary?.annotations ?? scopedItems.filter((item) => item.storage === 'reader-highlight' && item.note?.trim()).length}</strong>{t('knowledge.metric.annotations')}</span><span><strong>{summary?.bookmarks ?? scopedItems.filter((item) => item.kind === 'bookmarks').length}</strong>{t('knowledge.metric.bookmarks')}</span></div>
    {activeBook ? <button className="ghost-btn small" type="button" onClick={() => onOpenBook(activeBook.id)}><BookMindIcon name="libraryMenuOpen" />{t('knowledge.openBook')}</button> : null}
  </header>;
}

function KnowledgeItemCard({ item, selected, locale, onToggle, onOpen, onMenu }: { item: KnowledgePageItem; selected: boolean; locale: string; onToggle: () => void; onOpen: () => void; onMenu: (event: React.MouseEvent, itemId: string) => void }) {
  const { t } = useI18n();
  return <article className={`knowledge-card kind-${item.kind}${item.color ? ` color-${item.color}` : ''}${selected ? ' selected' : ''}`} onContextMenu={(event) => onMenu(event, item.id)}>
    <label className="knowledge-card-select" aria-label={t('knowledge.selectItem', { title: item.title })}><input type="checkbox" checked={selected} onChange={onToggle} /><span /></label>
    <button className="knowledge-card-body" type="button" onClick={onOpen}>
      <div className="knowledge-card-top"><span className="knowledge-kind-badge"><BookMindIcon name={knowledgeKindIcon(item.kind)} />{t(`knowledge.view.${item.kind}` as never)}</span><time>{formatKnowledgeDate(item.updatedAt || item.createdAt, locale)}</time></div>
      <blockquote>{item.kind === 'notes' || item.kind === 'flashcards' ? item.title : item.body || item.title}</blockquote>
      {item.note?.trim() ? <p className="knowledge-annotation-note"><BookMindIcon name="note" />{item.note}</p> : null}
      {item.kind === 'notes' || item.kind === 'flashcards' ? <p className="knowledge-card-secondary">{item.body}</p> : null}
      {item.tags?.length ? <div className="knowledge-tag-row">{item.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
      <footer><span>{item.bookTitle || t('knowledge.unassigned')}</span><em>{item.meta}</em></footer>
    </button>
    <button className="knowledge-more-btn item-more" type="button" aria-label={t('knowledge.itemMenu', { title: item.title })} title={t('knowledge.actions')} onClick={(event) => onMenu(event, item.id)}><BookMindIcon name="more" /></button>
  </article>;
}

function KnowledgeEmptyState({ hasQuery }: { hasQuery: boolean }) {
  const { t } = useI18n();
  return <div className="knowledge-empty-state"><span><BookMindIcon name={hasQuery ? 'readerSearch' : 'highlights'} /></span><strong>{hasQuery ? t('knowledge.emptyFiltered') : t('knowledge.emptyScope')}</strong><p>{hasQuery ? t('knowledge.emptyFilteredHint') : t('knowledge.emptyScopeHint')}</p></div>;
}

function KnowledgeItemMenu({ state, item, onDetail, onCopy, onOpenBook, onDelete }: { state: NonNullable<ItemMenuState>; item?: KnowledgePageItem; onDetail: (id: string) => void; onCopy: (item: KnowledgePageItem) => void; onOpenBook: (bookId: string) => void; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  if (!item) return null;
  return <div className="knowledge-context-menu" style={{ left: state.x, top: state.y }} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <button type="button" onClick={() => onDetail(item.id)}><BookMindIcon name="libraryMenuDetail" />{t('knowledge.viewDetails')}</button>
    <button type="button" onClick={() => void onCopy(item)}><BookMindIcon name="copy" />{t('knowledge.copy')}</button>
    {item.bookId ? <button type="button" onClick={() => onOpenBook(item.bookId!)}><BookMindIcon name="libraryMenuOpen" />{t('knowledge.openBook')}</button> : null}
    <button className="danger" type="button" onClick={() => onDelete(item.id)}><BookMindIcon name="libraryMenuDelete" />{t('knowledge.delete')}</button>
  </div>;
}

function KnowledgeBookMenu({ state, onChoose, onOpenBook }: { state: NonNullable<BookMenuState>; onChoose: (bookId: string, view?: KnowledgeView) => void; onOpenBook: (bookId: string) => void }) {
  const { t } = useI18n();
  return <div className="knowledge-context-menu" style={{ left: state.x, top: state.y }} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <button type="button" onClick={() => onChoose(state.bookId, 'all')}><BookMindIcon name="grid" />{t('knowledge.viewAll')}</button>
    <button type="button" onClick={() => onChoose(state.bookId, 'highlights')}><BookMindIcon name="highlights" />{t('knowledge.highlights')}</button>
    <button type="button" onClick={() => onChoose(state.bookId, 'annotations')}><BookMindIcon name="note" />{t('knowledge.annotations')}</button>
    <button type="button" onClick={() => onChoose(state.bookId, 'bookmarks')}><BookMindIcon name="bookmark" />{t('knowledge.bookmarks')}</button>
    <button type="button" onClick={() => onOpenBook(state.bookId)}><BookMindIcon name="libraryMenuOpen" />{t('knowledge.openBook')}</button>
  </div>;
}

function KnowledgeDetailDialog({ item, book, locale, saving, onClose, onCopy, onOpenBook, onSave, onDelete }: { item: KnowledgePageItem; book?: Book; locale: string; saving: boolean; onClose: () => void; onCopy: (item: KnowledgePageItem) => void; onOpenBook: (bookId: string) => void; onSave: (item: KnowledgePageItem, updates: { note: string; tags: string[]; color: ReaderHighlightColor }) => Promise<void>; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  const editable = item.storage === 'reader-highlight' || item.storage === 'reader-bookmark';
  const [noteDraft, setNoteDraft] = useState(item.note ?? '');
  const [tagsDraft, setTagsDraft] = useState((item.tags ?? []).join(' '));
  const [colorDraft, setColorDraft] = useState<ReaderHighlightColor>(item.color ?? 'yellow');
  const dirty = editable && (noteDraft !== (item.note ?? '') || tagsDraft !== (item.tags ?? []).join(' ') || colorDraft !== (item.color ?? 'yellow'));
  return <div className="modal-backdrop knowledge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="knowledge-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-detail-title">
      <header><div><span className={`knowledge-kind-badge${item.color ? ` color-${item.color}` : ''}`}><BookMindIcon name={knowledgeKindIcon(item.kind)} />{t(`knowledge.view.${item.kind}` as never)}</span><h2 id="knowledge-detail-title">{item.title}</h2></div><button className="knowledge-dialog-close" type="button" onClick={onClose} aria-label={t('knowledge.close')}><BookMindIcon name="close" /></button></header>
      <div className="knowledge-detail-content">
        {book ? <div className="knowledge-detail-book"><LibraryBookCover book={book} className={`knowledge-detail-cover ${book.coverTone}`} /><div><strong>{book.displayTitle}</strong><span>{book.author || book.fileName}</span></div></div> : null}
        <section className="knowledge-detail-section"><span>{item.kind === 'flashcards' ? t('knowledge.question') : item.kind === 'notes' ? t('knowledge.noteContent') : t('knowledge.originalText')}</span><blockquote>{item.kind === 'flashcards' ? item.title : item.body || item.title}</blockquote></section>
        {editable ? <section className="knowledge-detail-section annotation editor"><span>{t('knowledge.annotation')}</span><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={t('knowledge.annotationPlaceholder')} /></section> : item.note?.trim() ? <section className="knowledge-detail-section annotation"><span>{t('knowledge.annotation')}</span><p>{item.note}</p></section> : null}
        {item.kind === 'flashcards' ? <section className="knowledge-detail-section annotation"><span>{t('knowledge.answer')}</span><p>{item.body}</p></section> : null}
        {editable ? <div className="knowledge-detail-editor-row"><label><span>{t('knowledge.tags')}</span><input value={tagsDraft} onChange={(event) => setTagsDraft(event.target.value)} placeholder={t('knowledge.tagsPlaceholder')} /></label><fieldset><legend>{t('knowledge.color')}</legend><div className="knowledge-color-swatches">{HIGHLIGHT_COLORS.map((color) => <button key={color} className={`${color}${colorDraft === color ? ' active' : ''}`} type="button" aria-label={t(`knowledge.color.${color}` as never)} aria-pressed={colorDraft === color} onClick={() => setColorDraft(color)} />)}</div></fieldset></div> : item.tags?.length ? <div className="knowledge-detail-tags">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
        <dl className="knowledge-detail-grid">
          <div><dt>{t('knowledge.type')}</dt><dd>{t(`knowledge.view.${item.kind}` as never)}</dd></div>
          <div><dt>{t('knowledge.location')}</dt><dd>{item.meta || item.sourceTargetId}</dd></div>
          <div><dt>{t('knowledge.createdAt')}</dt><dd>{formatKnowledgeDateTime(item.createdAt, locale)}</dd></div>
          <div><dt>{t('knowledge.updatedAt')}</dt><dd>{formatKnowledgeDateTime(item.updatedAt || item.createdAt, locale)}</dd></div>
          {item.importance ? <div><dt>{t('knowledge.importance')}</dt><dd>{item.importance}</dd></div> : null}
          {item.reviewStatus ? <div><dt>{t('knowledge.reviewStatus')}</dt><dd>{item.reviewStatus}</dd></div> : null}
        </dl>
      </div>
      <footer><button className="ghost-btn small danger-btn" type="button" onClick={() => onDelete(item.id)}><BookMindIcon name="libraryMenuDelete" />{t('knowledge.delete')}</button><span /><button className="ghost-btn small" type="button" onClick={() => void onCopy(item)}><BookMindIcon name="copy" />{t('knowledge.copy')}</button>{editable ? <button className="primary-btn small" type="button" disabled={!dirty || saving} onClick={() => void onSave(item, { note: noteDraft, tags: splitKnowledgeTags(tagsDraft), color: colorDraft })}><BookMindIcon name="saveCommand" />{saving ? t('knowledge.saving') : t('knowledge.saveChanges')}</button> : item.bookId ? <button className="primary-btn small" type="button" onClick={() => onOpenBook(item.bookId!)}><BookMindIcon name="libraryMenuOpen" />{t('knowledge.openBook')}</button> : null}</footer>
    </section>
  </div>;
}

function KnowledgeDeleteDialog({ count, busy, onCancel, onConfirm }: { count: number; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  return <div className="modal-backdrop knowledge-modal-backdrop confirm" role="presentation"><section className="knowledge-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="knowledge-delete-title"><span className="knowledge-delete-icon"><BookMindIcon name="libraryMenuDelete" /></span><div><h3 id="knowledge-delete-title">{t('knowledge.confirmDeleteTitle')}</h3><p>{t('knowledge.confirmDeleteBody', { count })}</p></div><footer><button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button><button className="primary-btn danger-confirm" type="button" onClick={onConfirm} disabled={busy}>{busy ? t('knowledge.deleting') : t('knowledge.confirmDelete')}</button></footer></section></div>;
}

async function loadReaderKnowledge(books: Book[]) {
  if (!isTauriRuntime()) {
    const demo = books[0] ? createBrowserDemoAnnotations(books[0].id) : { highlights: [], bookmarks: [] };
    return demo;
  }
  try {
    const [highlightRecords, bookmarkRecords] = await Promise.all([listReaderRecordsByKind('highlights'), listReaderRecordsByKind('bookmarks')]);
    return {
      highlights: highlightRecords.flatMap((record) => parseReaderRecord<ReaderHighlight[]>(record, []).map((highlight) => ({ ...highlight, bookId: record.bookId }))),
      bookmarks: bookmarkRecords.flatMap((record) => parseReaderRecord<ReaderBookmark[]>(record, []).map((bookmark) => ({ ...bookmark, bookId: record.bookId }))),
    };
  } catch (error) {
    console.warn('Using empty reader annotations because reader record loading failed:', error);
    return { highlights: [] as ReaderHighlight[], bookmarks: [] as ReaderBookmark[] };
  }
}

async function refreshReaderBookKnowledge(bookId: string, kind: 'highlights' | 'bookmarks', setHighlights: React.Dispatch<React.SetStateAction<ReaderHighlight[]>>, setBookmarks: React.Dispatch<React.SetStateAction<ReaderBookmark[]>>) {
  if (!isTauriRuntime()) return;
  try {
    const record = await getReaderRecord(bookId, kind);
    if (kind === 'highlights') {
      const next = parseReaderRecord<ReaderHighlight[]>(record, []).map((item) => ({ ...item, bookId }));
      setHighlights((current) => [...current.filter((item) => item.bookId !== bookId), ...next]);
    } else {
      const next = parseReaderRecord<ReaderBookmark[]>(record, []).map((item) => ({ ...item, bookId }));
      setBookmarks((current) => [...current.filter((item) => item.bookId !== bookId), ...next]);
    }
  } catch (error) {
    console.warn(`Failed to refresh reader ${kind} for ${bookId}:`, error);
  }
}

async function deleteKnowledgeRecords(items: KnowledgePageItem[], storage: KnowledgePageItem['storage'], action: (ids: string[]) => Promise<number>) {
  const ids = items.filter((item) => item.storage === storage).map((item) => item.recordId);
  if (ids.length) await action(ids);
}

async function saveReaderItemsAfterDelete(deletingItems: KnowledgePageItem[], highlights: ReaderHighlight[], bookmarks: ReaderBookmark[]) {
  if (!isTauriRuntime()) return;
  const deletedHighlightKeys = new Set(deletingItems.filter((item) => item.storage === 'reader-highlight').map((item) => `${item.bookId}:${item.recordId}`));
  const deletedBookmarkKeys = new Set(deletingItems.filter((item) => item.storage === 'reader-bookmark').map((item) => `${item.bookId}:${item.recordId}`));
  const affectedBooks = new Set(deletingItems.filter((item) => item.storage === 'reader-highlight' || item.storage === 'reader-bookmark').map((item) => item.bookId).filter(Boolean) as string[]);
  if (!affectedBooks.size) return;
  const encrypt = loadGlobalReaderSettings().encryptSensitiveReaderData;
  await Promise.all([...affectedBooks].flatMap((bookId) => [
    deletedHighlightKeys.size ? saveReaderRecord(bookId, 'highlights', createSensitiveReaderStoragePayload(highlights.filter((item) => item.bookId === bookId && !deletedHighlightKeys.has(`${bookId}:${item.id}`)), encrypt), 'knowledge-index') : Promise.resolve(null),
    deletedBookmarkKeys.size ? saveReaderRecord(bookId, 'bookmarks', createSensitiveReaderStoragePayload(bookmarks.filter((item) => item.bookId === bookId && !deletedBookmarkKeys.has(`${bookId}:${item.id}`)), encrypt), 'knowledge-index') : Promise.resolve(null),
  ]));
  affectedBooks.forEach((bookId) => {
    if ([...deletingItems].some((item) => item.bookId === bookId && item.storage === 'reader-highlight')) emitReaderAnnotationsUpdated({ bookId, kind: 'highlights', source: 'knowledge' });
    if ([...deletingItems].some((item) => item.bookId === bookId && item.storage === 'reader-bookmark')) emitReaderAnnotationsUpdated({ bookId, kind: 'bookmarks', source: 'knowledge' });
  });
}

async function persistReaderCollection(bookId: string, kind: 'highlights' | 'bookmarks', records: ReaderHighlight[] | ReaderBookmark[]) {
  if (!isTauriRuntime()) return;
  const encrypt = loadGlobalReaderSettings().encryptSensitiveReaderData;
  await saveReaderRecord(bookId, kind, createSensitiveReaderStoragePayload(records, encrypt), 'knowledge-index');
  emitReaderAnnotationsUpdated({ bookId, kind, source: 'knowledge' });
}

function compareKnowledgeItems(left: KnowledgePageItem, right: KnowledgePageItem, sort: KnowledgeSort) {
  if (sort === 'location') return (left.bookTitle || '').localeCompare(right.bookTitle || '') || (left.chapterIndex ?? Number.MAX_SAFE_INTEGER) - (right.chapterIndex ?? Number.MAX_SAFE_INTEGER) || (left.paragraphIndex ?? Number.MAX_SAFE_INTEGER) - (right.paragraphIndex ?? Number.MAX_SAFE_INTEGER);
  const comparison = (left.updatedAt || left.createdAt).localeCompare(right.updatedAt || right.createdAt);
  return sort === 'oldest' ? comparison : -comparison;
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  return { x: Math.max(10, Math.min(x, window.innerWidth - width - 10)), y: Math.max(10, Math.min(y, window.innerHeight - height - 10)) };
}

function knowledgeKindIcon(kind: KnowledgeItemKind) {
  if (kind === 'highlights') return 'highlights' as const;
  if (kind === 'bookmarks') return 'bookmark' as const;
  if (kind === 'flashcards') return 'grid' as const;
  return 'note' as const;
}

function formatKnowledgeDate(value: string, locale: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(timestamp);
}

function formatKnowledgeDateTime(value: string, locale: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function splitKnowledgeTags(value: string) {
  return [...new Set(value.split(/[，,\s]+/).map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 24);
}

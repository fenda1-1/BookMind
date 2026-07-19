import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n } from '../../i18n';
import type { EditableBook, LibraryViewMode } from '../../types';
import { type BatchCoverTone, type BatchReadingStatus, type FilterMode, type LibraryTab, type LibraryToolbarPopover, type SortMode } from './libraryCollectionModel';

type LibraryPageToolbarProps = {
  activeTab: LibraryTab;
  shelfBookCount: number;
  trashBookCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  toolbarPopover: LibraryToolbarPopover;
  setToolbarPopover: (value: LibraryToolbarPopover | ((current: LibraryToolbarPopover) => LibraryToolbarPopover)) => void;
  sortMode: SortMode;
  filterMode: FilterMode;
  viewMode: LibraryViewMode;
  viewModes: { id: LibraryViewMode; label: string; hint: string }[];
  onSwitchTab: (tab: LibraryTab) => void;
  onUpdateSort: (value: SortMode) => void;
  onUpdateFilter: (value: FilterMode) => void;
  onUpdateViewMode: (value: LibraryViewMode) => void;
  importPath: string;
  onImportPathChange: (value: string) => void;
  importing: boolean;
  onSubmitImport: (target: 'file' | 'directory') => void;
  onChooseFile: () => void;
  onChooseDirectory: () => void;
  selectedBookCount: number;
  selectedVisibleCount: number;
  visibleSelectableBookCount: number;
  onSelectVisible: () => void;
  onInvertVisible: () => void;
  onClearSelection: () => void;
  batchAuthor: string;
  onBatchAuthorChange: (value: string) => void;
  batchCoverTone: BatchCoverTone;
  onBatchCoverToneChange: (value: BatchCoverTone) => void;
  batchReadingStatus: BatchReadingStatus;
  onBatchReadingStatusChange: (value: BatchReadingStatus) => void;
  coverTones: EditableBook['coverTone'][];
  hasSelectedShelfBooks: boolean;
  hasBatchMetadataChanges: boolean;
  onApplyBatch: () => void;
};

export function LibraryPageToolbar({ activeTab, shelfBookCount, trashBookCount, query, onQueryChange, toolbarPopover, setToolbarPopover, sortMode, filterMode, viewMode, viewModes, onSwitchTab, onUpdateSort, onUpdateFilter, onUpdateViewMode, importPath, onImportPathChange, importing, onSubmitImport, onChooseFile, onChooseDirectory, selectedBookCount, selectedVisibleCount, visibleSelectableBookCount, onSelectVisible, onInvertVisible, onClearSelection, batchAuthor, onBatchAuthorChange, batchCoverTone, onBatchCoverToneChange, batchReadingStatus, onBatchReadingStatusChange, coverTones, hasSelectedShelfBooks, hasBatchMetadataChanges, onApplyBatch }: LibraryPageToolbarProps) {
  const { t } = useI18n();
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'manual', label: t('library.sort.manual') },
    { value: 'recent', label: t('library.sort.recent') },
    { value: 'title', label: t('library.sort.title') },
    { value: 'progress', label: t('library.sort.progress') },
    { value: 'trashExpiry', label: t('library.sort.trashExpiry') },
  ];
  const filterOptions: { value: FilterMode; label: string }[] = [
    { value: 'all', label: t('library.filter.all') },
    { value: 'unread', label: t('library.filter.unread') },
    { value: 'reading', label: t('library.filter.reading') },
    { value: 'done', label: t('library.filter.done') },
  ];
  const batchCoverOptions: { value: BatchCoverTone; label: string }[] = [
    { value: 'keep', label: t('library.batch.keepCover') },
    ...coverTones.map((tone) => ({ value: tone, label: t(`library.batch.cover.${tone}`) })),
  ];
  const batchReadingStatusOptions: { value: BatchReadingStatus; label: string }[] = [
    { value: 'keep', label: t('library.batch.keepStatus') },
    { value: 'unread', label: t('library.batch.status.unread') },
    { value: 'reading', label: t('library.batch.status.reading') },
    { value: 'done', label: t('library.batch.status.done') },
  ];

  return <>
    <div className={`library-icon-toolbar${toolbarPopover ? ' popover-open' : ''}`} role="toolbar" aria-label={t('library.viewAria')}>
      <div className="segmented-control library-tab-control" role="tablist" aria-label={t('library.viewAria')}>
        <button className={activeTab === 'shelf' ? 'active' : ''} onClick={() => onSwitchTab('shelf')}>{t('library.tab.shelf')} · {shelfBookCount}</button>
        <button className={activeTab === 'trash' ? 'active' : ''} onClick={() => onSwitchTab('trash')}>{t('library.tab.trash')} · {trashBookCount}</button>
      </div>
      <label className="library-toolbar-search">
        <BookMindIcon name="search" className="bm-icon library-search-icon" />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t('library.manage.searchPlaceholder')} />
      </label>
      <div className="library-toolbar-actions">
        <LibraryIconButton icon="librarySort" label={t('library.manage.sortLabel')} active={toolbarPopover === 'sort'} onClick={() => setToolbarPopover((value) => value === 'sort' ? null : 'sort')} />
        {activeTab === 'shelf' ? <LibraryIconButton icon="libraryFilter" label={t('library.manage.filterLabel')} active={toolbarPopover === 'filter'} onClick={() => setToolbarPopover((value) => value === 'filter' ? null : 'filter')} /> : null}
        {activeTab === 'shelf' ? <div className="library-view-icon-group" role="group" aria-label={t('library.viewAria')}>{viewModes.map((mode) => <LibraryIconButton key={mode.id} icon={mode.id === 'card' ? 'libraryCardView' : mode.id === 'list' ? 'libraryListView' : 'libraryShelfView'} label={mode.label} active={viewMode === mode.id} pressed={viewMode === mode.id} onClick={() => onUpdateViewMode(mode.id)} />)}</div> : null}
        <LibraryIconButton icon={activeTab === 'trash' ? 'libraryTrash' : 'libraryImport'} label={activeTab === 'trash' ? t('library.tab.trash') : t('library.importTxt')} active={toolbarPopover === 'import'} disabled={activeTab === 'trash'} onClick={() => setToolbarPopover((value) => value === 'import' ? null : 'import')} />
      </div>
      {toolbarPopover === 'sort' ? <div className="library-toolbar-popover sort-popover" role="menu" aria-label={t('library.manage.sortLabel')}>{sortOptions.map((option) => <button type="button" role="menuitemradio" aria-checked={sortMode === option.value} className={sortMode === option.value ? 'active' : ''} key={option.value} onClick={() => { onUpdateSort(option.value); setToolbarPopover(null); }}>{option.label}</button>)}</div> : null}
      {toolbarPopover === 'filter' && activeTab === 'shelf' ? <div className="library-toolbar-popover filter-popover" role="menu" aria-label={t('library.manage.filterLabel')}>{filterOptions.map((option) => <button type="button" role="menuitemradio" aria-checked={filterMode === option.value} className={filterMode === option.value ? 'active' : ''} key={option.value} onClick={() => { onUpdateFilter(option.value); setToolbarPopover(null); }}>{option.label}</button>)}</div> : null}
      {toolbarPopover === 'import' && activeTab === 'shelf' ? <div className="library-toolbar-popover library-import-popover" role="dialog" aria-label={t('library.importTxt')}><label className="library-import-path-field"><span>{t('library.importPlaceholder')}</span><input value={importPath} onChange={(event) => onImportPathChange(event.target.value)} placeholder={t('library.importPlaceholder')} /></label><div className="library-import-actions"><button className="primary-btn" onClick={() => onSubmitImport('file')} disabled={importing}>{importing ? t('library.importing') : t('library.importTxt')}</button><button className="ghost-btn" onClick={() => onSubmitImport('directory')} disabled={importing}>{importing ? t('library.scanning') : t('library.importDirectory')}</button><button className="ghost-btn" onClick={onChooseFile} disabled={importing}>{t('library.chooseFile')}</button><button className="ghost-btn" onClick={onChooseDirectory} disabled={importing}>{t('library.chooseDirectory')}</button></div></div> : null}
    </div>

    {activeTab === 'shelf' && shelfBookCount > 0 ? <section className="library-batch-panel" aria-label={t('library.batch.title')}><div className="library-batch-summary"><strong>{t('library.batch.selected', { count: selectedBookCount })}</strong><span>{t('library.batch.visibleSelected', { selected: selectedVisibleCount, total: visibleSelectableBookCount })}</span></div><div className="library-batch-actions"><LibraryBatchIconButton icon="librarySelect" label={t('library.batch.selectVisible')} onClick={onSelectVisible} disabled={visibleSelectableBookCount === 0 || selectedVisibleCount === visibleSelectableBookCount} /><LibraryBatchIconButton icon="retry" label={t('library.batch.invertVisible')} onClick={onInvertVisible} disabled={visibleSelectableBookCount === 0} /><LibraryBatchIconButton icon="librarySelectEmpty" label={t('library.batch.clear')} onClick={onClearSelection} disabled={selectedBookCount === 0} /></div><div className="library-batch-controls"><label className="library-batch-field"><span>{t('library.batch.author')}</span><input value={batchAuthor} onChange={(event) => onBatchAuthorChange(event.target.value)} placeholder={t('library.batch.authorPlaceholder')} /></label><ThemedSelect className="library-batch-select" label={t('library.batch.cover')} value={batchCoverTone} options={batchCoverOptions} onChange={onBatchCoverToneChange} ariaLabel={t('library.batch.cover')} menuPlacement="bottom" /><ThemedSelect className="library-batch-select" label={t('library.batch.readingStatus')} value={batchReadingStatus} options={batchReadingStatusOptions} onChange={onBatchReadingStatusChange} ariaLabel={t('library.batch.readingStatus')} menuPlacement="bottom" /><LibraryBatchIconButton icon="saveCommand" label={t('library.batch.apply')} onClick={onApplyBatch} disabled={!hasSelectedShelfBooks || !hasBatchMetadataChanges} variant="primary" /></div></section> : null}
  </>;
}

function LibraryIconButton({ icon, label, active = false, pressed, disabled = false, onClick }: { icon: BookMindIconName; label: string; active?: boolean; pressed?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button className={active ? 'library-icon-btn active' : 'library-icon-btn'} type="button" aria-label={label} aria-pressed={pressed} data-tooltip={label} disabled={disabled} onClick={onClick}><BookMindIcon name={icon} /></button>;
}

function LibraryBatchIconButton({ icon, label, disabled = false, variant = 'default', onClick }: { icon: BookMindIconName; label: string; disabled?: boolean; variant?: 'default' | 'primary'; onClick: () => void }) {
  return <button className={variant === 'primary' ? 'library-batch-icon-btn primary' : 'library-batch-icon-btn'} type="button" aria-label={label} data-tooltip={label} disabled={disabled} onClick={onClick}><BookMindIcon name={icon} /></button>;
}

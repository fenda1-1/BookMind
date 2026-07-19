import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, Dispatch, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, SetStateAction, WheelEvent } from 'react';
import { useI18n } from '../../i18n';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { ReaderBookmark, ReaderHighlightColor } from '../../types';
import { readerHighlightColors, type ReaderAnnotationExportChoice, type VirtualListWindow } from './readerInteractionModel';
import type { ReaderChapter, ReaderHighlightGroup, ReaderHighlightRange, ReaderHighlightSortKey, ReaderSearchHit } from './readerModel';
import { ReaderBookmarkContextMenu, type ReaderBookmarkMenuState } from './ReaderContextMenus';
import {
  activateReaderRightPanelSession,
  closeAllReaderRightPanelSessions,
  closeReaderRightPanelSession,
  getReaderRightPanelWidth,
  openReaderRightPanelSession,
  READER_RIGHT_PANEL_MAX_WIDTH,
  READER_RIGHT_PANEL_MIN_WIDTH,
  finishReaderRightPanelWidthPreview,
  setReaderRightPanelPlacement,
  setReaderRightPanelWidth,
  previewReaderRightPanelWidth,
  subscribeReaderRightPanelCommands,
  subscribeReaderRightPanelSessions,
} from './readerRightPanelSessions';

export { filterReaderHighlights, groupReaderHighlightsByChapter, sortReaderHighlights } from './readerModel';

const HIGHLIGHT_PANEL_PLACEMENT_STORAGE_KEY = 'bookmind:reader-highlight-panel-placement';
const HIGHLIGHT_PANEL_MIN_WIDTH = READER_RIGHT_PANEL_MIN_WIDTH;
const HIGHLIGHT_PANEL_MAX_WIDTH = READER_RIGHT_PANEL_MAX_WIDTH;

type HighlightPanelPlacement = 'floating' | 'sidebar';

type ReaderBookmarkGroup = {
  key: string;
  label: string;
  items: ReaderBookmark[];
};

function readStoredHighlightPanelPlacement(): HighlightPanelPlacement {
  if (typeof window === 'undefined') return 'floating';
  return window.localStorage.getItem(HIGHLIGHT_PANEL_PLACEMENT_STORAGE_KEY) === 'sidebar' ? 'sidebar' : 'floating';
}

function HighlightPanelIconButton({ active = false, className = '', danger = false, disabled = false, expanded, hideWhenDisabled = false, icon, indicator = false, label, onClick, tooltipAlign = 'center' }: { active?: boolean; className?: string; danger?: boolean; disabled?: boolean; expanded?: boolean; hideWhenDisabled?: boolean; icon: BookMindIconName; indicator?: boolean; label: string; onClick: () => void; tooltipAlign?: 'center' | 'right' }) {
  const [tooltipPosition, setTooltipPosition] = useState<{ left?: number; right?: number; top: number } | null>(null);
  function showTooltip(event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition(tooltipAlign === 'right'
      ? { right: window.innerWidth - rect.right, top: rect.bottom + 8 }
      : { left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }
  if (hideWhenDisabled && disabled) return null;
  const buttonClassName = ['reader-highlight-action-btn', active ? 'active' : '', danger ? 'danger' : '', className].filter(Boolean).join(' ');
  return (
    <>
      <button type="button" title={label} className={buttonClassName} data-tooltip={label} aria-label={label} aria-expanded={expanded} disabled={disabled} onMouseEnter={showTooltip} onMouseLeave={() => setTooltipPosition(null)} onFocus={showTooltip} onBlur={() => setTooltipPosition(null)} onClick={onClick}>
        <BookMindIcon name={icon} />
        {indicator ? <i className="reader-filter-active-dot" aria-hidden="true" /> : null}
      </button>
      {tooltipPosition ? createPortal(<span className={tooltipAlign === 'right' ? 'reader-highlight-tooltip align-right' : 'reader-highlight-tooltip'} role="tooltip" style={tooltipPosition}>{label}</span>, document.body) : null}
    </>
  );
}

function HighlightPanelTabButton({ active, controls, icon, id, label, onClick }: { active: boolean; controls: string; icon: BookMindIconName; id: string; label: string; onClick: () => void }) {
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  function showTooltip(event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({ left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }
  return (
    <>
      <button
        type="button"
        role="tab"
        title={label}
        data-tooltip={label}
        id={id}
        className={active ? 'active' : ''}
        aria-label={label}
        aria-selected={active}
        aria-controls={controls}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltipPosition(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltipPosition(null)}
        onClick={onClick}
      >
        <BookMindIcon name={icon} />
        <strong>{label}</strong>
      </button>
      {tooltipPosition ? createPortal(<span className="reader-highlight-tooltip" role="tooltip" style={{ left: tooltipPosition.left, top: tooltipPosition.top }}>{label}</span>, document.body) : null}
    </>
  );
}

function stopReaderHighlightPanelWheel(event: WheelEvent<HTMLElement>) {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('.reader-annotation-quick-row, .reader-annotation-toolbar')
    : null;
  if (target && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    target.scrollLeft += event.deltaY;
    event.preventDefault();
  }
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

export function ReaderHighlightPanel({
  readerSearchQuery,
  searchPanelOpen,
  readerSearchHits,
  activeSearchHitIndex,
  setActiveSearchHitIndex,
  jumpToSearchHit,
  showHighlightPanel,
  setShowHighlightPanel,
  activeAnnotationTab,
  setActiveAnnotationTab,
  filteredHighlights,
  highlights,
  annotationExportChoice,
  setAnnotationExportChoice,
  exportSelectedAnnotations,
  onImportAnnotationsJson,
  setSelectedHighlightIds,
  selectedHighlightIds,
  onDeleteHighlights,
  showUndoToast,
  onRestoreHighlight,
  highlightSearchQuery,
  setHighlightSearchQuery,
  highlightQueryScope,
  setHighlightQueryScope,
  highlightChapterFilter,
  setHighlightChapterFilter,
  chapters,
  highlightSort,
  setHighlightSort,
  highlightNoteFilter,
  setHighlightNoteFilter,
  highlightTagFilter,
  setHighlightTagFilter,
  highlightImportanceFilter,
  setHighlightImportanceFilter,
  highlightReviewFilter,
  setHighlightReviewFilter,
  highlightTagOptions,
  highlightColorFilter,
  setHighlightColorFilter,
  highlightGroups,
  highlightFiltersActive,
  bookmarks,
  filteredBookmarks,
  bookmarkSearchQuery,
  setBookmarkSearchQuery,
  bookmarkSort,
  setBookmarkSort,
  bookmarkGroupBy,
  setBookmarkGroupBy,
  bookmarkColorFilter,
  setBookmarkColorFilter,
  bookmarkFiltersActive,
  selectedBookmarkIds,
  setSelectedBookmarkIds,
  onDeleteBookmark,
  onRestoreBookmark,
  onUpdateBookmark,
  onJumpBookmark,
  selectedBookmarks,
  bulkBookmarkTags,
  setBulkBookmarkTags,
  bulkBookmarkTagMode,
  setBulkBookmarkTagMode,
  bulkBookmarkNote,
  setBulkBookmarkNote,
  bulkBookmarkNoteMode,
  setBulkBookmarkNoteMode,
  bulkBookmarkColor,
  setBulkBookmarkColor,
  applyBulkBookmarkEdit,
  bookmarkVirtualWindow,
  highlightVirtualWindow,
  setBookmarkViewer,
  deleteBookmarkWithUndo,
  toggleHighlightSelection,
  toggleBookmarkSelection,
  jumpToParagraph,
  openHighlightMenu,
  openHighlightMenuFromKeyboard,
  startLongPressMenu,
  openHighlightMenuAt,
  cancelLongPressMenu,
  suppressClickAfterLongPress,
  openHighlightMenuFromButton,
}: {
  readerSearchQuery: string;
  searchPanelOpen: boolean;
  readerSearchHits: ReaderSearchHit[];
  activeSearchHitIndex: number;
  setActiveSearchHitIndex: (index: number) => void;
  jumpToSearchHit: (hit: ReaderSearchHit) => void;
  showHighlightPanel: boolean;
  setShowHighlightPanel: (value: boolean) => void;
  activeAnnotationTab: 'highlights' | 'bookmarks';
  setActiveAnnotationTab: Dispatch<SetStateAction<'highlights' | 'bookmarks'>>;
  filteredHighlights: ReaderHighlightRange[];
  highlights: ReaderHighlightRange[];
  annotationExportChoice: ReaderAnnotationExportChoice;
  setAnnotationExportChoice: (choice: ReaderAnnotationExportChoice) => void;
  exportSelectedAnnotations: () => void;
  onImportAnnotationsJson: (file: File) => void;
  setSelectedHighlightIds: Dispatch<SetStateAction<Set<string>>>;
  selectedHighlightIds: Set<string>;
  onDeleteHighlights: (ids: string[]) => void;
  showUndoToast: (message: string, restore: () => void) => void;
  onRestoreHighlight: (highlight: ReaderHighlightRange) => void;
  highlightSearchQuery: string;
  setHighlightSearchQuery: (value: string) => void;
  highlightQueryScope: 'all' | 'text' | 'note' | 'context';
  setHighlightQueryScope: (value: 'all' | 'text' | 'note' | 'context') => void;
  highlightChapterFilter: number | 'all';
  setHighlightChapterFilter: (value: number | 'all') => void;
  chapters: ReaderChapter[];
  highlightSort: ReaderHighlightSortKey;
  setHighlightSort: (value: ReaderHighlightSortKey) => void;
  highlightNoteFilter: boolean | 'all';
  setHighlightNoteFilter: (value: boolean | 'all') => void;
  highlightTagFilter: string | 'all';
  setHighlightTagFilter: (value: string | 'all') => void;
  highlightImportanceFilter: 'all' | 'normal' | 'high' | 'critical';
  setHighlightImportanceFilter: (value: 'all' | 'normal' | 'high' | 'critical') => void;
  highlightReviewFilter: 'all' | 'new' | 'due' | 'reviewed';
  setHighlightReviewFilter: (value: 'all' | 'new' | 'due' | 'reviewed') => void;
  highlightTagOptions: string[];
  highlightColorFilter: ReaderHighlightColor | 'all';
  setHighlightColorFilter: (value: ReaderHighlightColor | 'all') => void;
  highlightGroups: ReaderHighlightGroup[];
  highlightFiltersActive: boolean;
  bookmarks: ReaderBookmark[];
  filteredBookmarks: ReaderBookmark[];
  bookmarkSearchQuery: string;
  setBookmarkSearchQuery: (value: string) => void;
  bookmarkSort: ExtendedSettings['defaultBookmarkSort'];
  setBookmarkSort: (value: ExtendedSettings['defaultBookmarkSort']) => void;
  bookmarkGroupBy: ExtendedSettings['defaultBookmarkGroupBy'];
  setBookmarkGroupBy: (value: ExtendedSettings['defaultBookmarkGroupBy']) => void;
  bookmarkColorFilter: ReaderHighlightColor | 'all';
  setBookmarkColorFilter: (value: ReaderHighlightColor | 'all') => void;
  bookmarkFiltersActive: boolean;
  selectedBookmarkIds: Set<string>;
  setSelectedBookmarkIds: Dispatch<SetStateAction<Set<string>>>;
  onDeleteBookmark: (id: string) => void;
  onRestoreBookmark: (bookmark: ReaderBookmark) => void;
  onUpdateBookmark: (id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }) => void;
  onJumpBookmark: (bookmark: ReaderBookmark) => void;
  selectedBookmarks: ReaderBookmark[];
  bulkBookmarkTags: string;
  setBulkBookmarkTags: (value: string) => void;
  bulkBookmarkTagMode: 'append' | 'replace';
  setBulkBookmarkTagMode: (value: 'append' | 'replace') => void;
  bulkBookmarkNote: string;
  setBulkBookmarkNote: (value: string) => void;
  bulkBookmarkNoteMode: 'append' | 'replace' | 'clear';
  setBulkBookmarkNoteMode: (value: 'append' | 'replace' | 'clear') => void;
  bulkBookmarkColor: ReaderHighlightColor;
  setBulkBookmarkColor: (value: ReaderHighlightColor) => void;
  applyBulkBookmarkEdit: () => void;
  bookmarkVirtualWindow: VirtualListWindow<ReaderBookmarkGroup>;
  highlightVirtualWindow: VirtualListWindow<ReaderHighlightGroup>;
  setBookmarkViewer: (bookmark: ReaderBookmark | null) => void;
  deleteBookmarkWithUndo: (bookmark: ReaderBookmark) => void;
  toggleHighlightSelection: (highlight: ReaderHighlightRange, event?: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>) => void;
  toggleBookmarkSelection: (bookmark: ReaderBookmark, event?: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>) => void;
  jumpToParagraph: (chapterIndex: number, paragraphIndex: number, startOffset?: number) => void;
  openHighlightMenu: (event: MouseEvent<HTMLElement>, highlight: ReaderHighlightRange) => void;
  openHighlightMenuFromKeyboard: (event: KeyboardEvent<HTMLElement>, highlight: ReaderHighlightRange) => void;
  startLongPressMenu: (event: PointerEvent<HTMLElement>, openAt: (clientX: number, clientY: number, target: HTMLElement) => void) => void;
  openHighlightMenuAt: (clientX: number, clientY: number, opener: HTMLElement, highlight: ReaderHighlightRange) => void;
  cancelLongPressMenu: () => void;
  suppressClickAfterLongPress: (event: MouseEvent<HTMLElement>) => void;
  openHighlightMenuFromButton: (event: MouseEvent<HTMLElement>, highlight: ReaderHighlightRange) => void;
}) {
  const { t } = useI18n();
  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [bookmarkMenu, setBookmarkMenu] = useState<ReaderBookmarkMenuState | null>(null);
  const [expandedHighlightGroups, setExpandedHighlightGroups] = useState<Set<number>>(() => new Set());
  const [panelWidth, setPanelWidth] = useState(getReaderRightPanelWidth);
  const [panelPlacement, setPanelPlacement] = useState<HighlightPanelPlacement>(readStoredHighlightPanelPlacement);
  const panelWidthDragRef = useRef<{ startX: number; startWidth: number; frame: number | null; nextWidth: number } | null>(null);
  const panelDockDragRef = useRef<{ pointerId: number; frame: number | null; nextPlacement: HighlightPanelPlacement } | null>(null);
  useEffect(() => {
    window.localStorage.setItem(HIGHLIGHT_PANEL_PLACEMENT_STORAGE_KEY, panelPlacement);
  }, [panelPlacement]);
  const [highlightSessionOpen, setHighlightSessionOpen] = useState(false);
  const [highlightActive, setHighlightActive] = useState(false);
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(false);
  useEffect(() => {
    setReaderRightPanelPlacement('highlights', panelPlacement);
    setReaderRightPanelPlacement('search', panelPlacement);
  }, [panelPlacement]);
  // Session store is the source of truth; local props only mirror open/active/width for rendering.
  useEffect(() => subscribeReaderRightPanelSessions((snapshot) => {
    setHighlightSessionOpen(snapshot.panels.highlights.open);
    setHighlightActive(snapshot.activeId === 'highlights');
    setRightPanelsCollapsed(Boolean(snapshot.collapsed));
    setPanelWidth(snapshot.width);
  }), []);
  useEffect(() => subscribeReaderRightPanelCommands((command) => {
    if (command.action === 'close-all') {
      closeAllReaderRightPanelSessions();
      return;
    }
    if (command.action === 'toggle-collapsed' || command.action === 'set-collapsed' || command.action === 'set-width') return;
    if (command.id !== 'highlights' && command.id !== 'search') return;
    if (command.action === 'close') closeReaderRightPanelSession(command.id);
    if (command.action === 'open') openReaderRightPanelSession(command.id, panelPlacement);
    if (command.action === 'activate') activateReaderRightPanelSession(command.id);
  }), [panelPlacement]);
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>('.reader-grid');
    if (!grid) return undefined;
    const bodyVisible = (highlightSessionOpen && highlightActive && !rightPanelsCollapsed) || searchPanelOpen;
    const docked = bodyVisible && panelPlacement === 'sidebar';
    grid.classList.toggle('highlight-panel-docked', docked);
    // Keep shared rail width available for the fixed session tabstrip in both floating and sidebar modes.
    if (bodyVisible) {
      grid.style.setProperty('--reader-right-panel-width', `${panelWidth}px`);
      grid.style.setProperty('--reader-highlight-panel-width', `${panelWidth}px`);
      grid.style.setProperty('--reader-dock-width', `${panelWidth}px`);
    }
    return () => {
      grid.classList.remove('highlight-panel-docked');
    };
  }, [highlightSessionOpen, highlightActive, rightPanelsCollapsed, panelPlacement, panelWidth, searchPanelOpen]);
  useEffect(() => {
    if (!bookmarkMenu) return undefined;
    const dismiss = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.reader-bookmark-menu')) setBookmarkMenu(null);
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setBookmarkMenu(null); };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [bookmarkMenu]);
  useEffect(() => {
    if (!advancedControlsOpen && !exportPanelOpen) return undefined;
    const dismiss = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.reader-annotation-advanced-popover, .reader-annotation-export-panel, .reader-annotation-toolbar, .reader-highlight-selection-actions, .themed-select-menu, .themed-select')) return;
      setAdvancedControlsOpen(false);
      setExportPanelOpen(false);
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setAdvancedControlsOpen(false);
      setExportPanelOpen(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [advancedControlsOpen, exportPanelOpen]);
  const showReaderSearchResults = searchPanelOpen;
  function openBookmarkMenu(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, bookmark: ReaderBookmark) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const panelRect = event.currentTarget.closest<HTMLElement>('.reader-highlight-panel')?.getBoundingClientRect();
    const clientX = 'clientX' in event ? event.clientX : rect.right;
    const clientY = 'clientY' in event ? event.clientY : rect.bottom;
    setBookmarkMenu({
      bookmark,
      x: clientX,
      y: clientY,
      bounds: panelRect ? { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom } : undefined,
    });
  }
  function startPanelWidthDrag(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    panelWidthDragRef.current = { startX: event.clientX, startWidth: panelWidth, frame: null, nextWidth: panelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    previewReaderRightPanelWidth(panelWidth);

    function flushPanelWidthPreview() {
      const drag = panelWidthDragRef.current;
      if (!drag) return;
      drag.frame = null;
      previewReaderRightPanelWidth(drag.nextWidth);
    }

    function onMove(moveEvent: globalThis.PointerEvent) {
      const drag = panelWidthDragRef.current;
      if (!drag) return;
      drag.nextWidth = Math.min(HIGHLIGHT_PANEL_MAX_WIDTH, Math.max(HIGHLIGHT_PANEL_MIN_WIDTH, Math.round(drag.startWidth + drag.startX - moveEvent.clientX)));
      if (drag.frame === null) {
        drag.frame = window.requestAnimationFrame(flushPanelWidthPreview);
      }
    }

    function onUp() {
      const drag = panelWidthDragRef.current;
      if (drag && drag.frame !== null) window.cancelAnimationFrame(drag.frame);
      if (drag) {
        previewReaderRightPanelWidth(drag.nextWidth);
        setReaderRightPanelWidth(drag.nextWidth);
      }
      finishReaderRightPanelWidthPreview();
      panelWidthDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onPanelWidthGripKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 20;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    if (event.key === 'Home') setReaderRightPanelWidth(HIGHLIGHT_PANEL_MIN_WIDTH);
    else if (event.key === 'End') setReaderRightPanelWidth(HIGHLIGHT_PANEL_MAX_WIDTH);
    else setReaderRightPanelWidth((value) => value + (event.key === 'ArrowLeft' ? step : -step));
  }

  function startPanelDockDrag(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    panelDockDragRef.current = { pointerId: event.pointerId, frame: null, nextPlacement: panelPlacement };
    event.currentTarget.setPointerCapture(event.pointerId);

    function flushPanelDockDrag() {
      const drag = panelDockDragRef.current;
      if (!drag) return;
      drag.frame = null;
      setPanelPlacement(drag.nextPlacement);
    }

    function onMove(moveEvent: globalThis.PointerEvent) {
      const drag = panelDockDragRef.current;
      if (!drag) return;
      const dockThreshold = window.innerWidth - Math.max(300, panelWidth * 0.72);
      drag.nextPlacement = moveEvent.clientX >= dockThreshold ? 'sidebar' : 'floating';
      if (drag.frame === null) {
        const frame = window.requestAnimationFrame(flushPanelDockDrag);
        const currentDrag = panelDockDragRef.current;
        if (currentDrag) currentDrag.frame = frame;
      }
    }

    function onUp() {
      const drag = panelDockDragRef.current;
      if (drag) {
        if (drag.frame !== null) window.cancelAnimationFrame(drag.frame);
        setPanelPlacement(drag.nextPlacement);
      }
      panelDockDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const visibleHighlightPanel = highlightSessionOpen && highlightActive && !rightPanelsCollapsed;
  if (!visibleHighlightPanel && !showReaderSearchResults) return null;
  const panelHost = typeof document !== 'undefined' ? document.querySelector('.reader-grid') : null;
  const panelNode = (
    <div
      className={`reader-overlay-panel reader-panel-highlights placement-${panelPlacement}${visibleHighlightPanel ? '' : ' search-only'}`}
      style={{
        width: panelPlacement === 'floating' ? panelWidth : undefined,
        ['--reader-right-panel-width' as string]: `${panelWidth}px`,
        ['--reader-highlight-panel-width' as string]: `${panelWidth}px`,
        ['--reader-dock-width' as string]: `${panelWidth}px`,
      } as CSSProperties}
      onMouseUp={(event) => event.stopPropagation()}
      onWheelCapture={stopReaderHighlightPanelWheel}
      onWheel={stopReaderHighlightPanelWheel}
    >
      <button
        className="reader-panel-dock-handle reader-highlight-panel-dock-handle"
        type="button"
        aria-label={panelPlacement === 'sidebar' ? t('reader.panel.dragFloating') : t('reader.panel.dragSidebar')}
        title={panelPlacement === 'sidebar' ? t('reader.panel.dragFloating') : t('reader.panel.dragSidebar')}
        onPointerDown={startPanelDockDrag}
        onDoubleClick={() => setPanelPlacement((value) => value === 'sidebar' ? 'floating' : 'sidebar')}
      >
        <span aria-hidden="true" />
      </button>
      <div
        className="reader-overlay-resize-grip reader-highlight-panel-resize-grip"
        role="separator"
        aria-label={t('reader.highlight.resizePanel')}
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuemin={HIGHLIGHT_PANEL_MIN_WIDTH}
        aria-valuemax={HIGHLIGHT_PANEL_MAX_WIDTH}
        aria-valuenow={panelWidth}
        onKeyDown={onPanelWidthGripKeyDown}
        onPointerDown={startPanelWidthDrag}
      >
        <span />
      </div>
      <aside className="reader-highlight-panel">
      {showReaderSearchResults ? (
        <section className="reader-search-results-panel">
          <div className="section-title"><span>{t('reader.search.results')}</span><strong aria-live="polite">{readerSearchHits.length}</strong></div>
          {readerSearchHits.length === 0 ? <p>{t('reader.search.empty')}</p> : null}
          {readerSearchHits.map((hit, index) => (
            <button type="button" className={index === activeSearchHitIndex ? 'active' : ''} key={`${hit.kind}-${hit.chapterIndex}-${hit.paragraphIndex}-${hit.matchIndex}-${index}`} onClick={() => { setActiveSearchHitIndex(index); jumpToSearchHit(hit); }}>
              <span>{hit.kind === 'chapter' ? hit.paragraphIndex + 1 : t(`reader.search.kind.${hit.kind}`)}</span>
              <em>{hit.snippet}</em>
              <small>{hit.label}</small>
            </button>
          ))}
        </section>
      ) : null}
      {visibleHighlightPanel ? (
        <section className="reader-annotation-panel-content">
          <div className="reader-highlight-panel-title">
          <div className="reader-annotation-toolbar">
          <div className="reader-annotation-tabs" role="tablist" aria-label={t('reader.highlights.panel')}>
            <HighlightPanelTabButton active={activeAnnotationTab === 'highlights'} controls="reader-annotation-panel-highlights" icon="highlights" id="reader-annotation-tab-highlights" label={t('reader.highlights.panel')} onClick={() => setActiveAnnotationTab('highlights')} />
            <HighlightPanelTabButton active={activeAnnotationTab === 'bookmarks'} controls="reader-annotation-panel-bookmarks" icon="bookmark" id="reader-annotation-tab-bookmarks" label={t('reader.bookmarks.panel')} onClick={() => setActiveAnnotationTab('bookmarks')} />
          </div>
          <input className="reader-annotation-toolbar-search" value={activeAnnotationTab === 'highlights' ? highlightSearchQuery : bookmarkSearchQuery} onChange={(event) => activeAnnotationTab === 'highlights' ? setHighlightSearchQuery(event.target.value) : setBookmarkSearchQuery(event.target.value)} placeholder={activeAnnotationTab === 'highlights' ? t('reader.highlight.search') : t('reader.bookmark.search')} aria-label={activeAnnotationTab === 'highlights' ? t('reader.highlight.search') : t('reader.bookmark.search')} />
          <div className="reader-annotation-toolbar-actions">
            <HighlightPanelIconButton active={advancedControlsOpen || (activeAnnotationTab === 'highlights' ? highlightFiltersActive : bookmarkFiltersActive)} expanded={advancedControlsOpen} icon="more" indicator={activeAnnotationTab === 'highlights' ? highlightFiltersActive : bookmarkFiltersActive} label={t('reader.more')} onClick={() => { setExportPanelOpen(false); setAdvancedControlsOpen((open) => !open); }} />
            <HighlightPanelIconButton className="reader-highlight-panel-close" icon="close" label={t('reader.highlight.closePanel')} onClick={() => setShowHighlightPanel(false)} tooltipAlign="right" />
          </div>
          </div>
          </div>
          {exportPanelOpen ? <div className="reader-annotation-export-panel reader-annotation-io" role="dialog" aria-label={t('reader.annotations.exportFormat')}>
            <ThemedSelect label={t('reader.annotations.exportFormat')} value={annotationExportChoice} options={[
              { value: 'highlights', label: t('reader.highlight.export') },
              { value: 'markdown', label: t('reader.annotations.exportMarkdown') },
              { value: 'json', label: t('reader.annotations.exportJson') },
              { value: 'csv', label: t('reader.annotations.exportCsv') },
              { value: 'anki', label: t('reader.annotations.exportAnki') },
              { value: 'obsidian', label: t('reader.annotations.exportObsidian') },
              { value: 'logseq', label: t('reader.annotations.exportLogseq') },
              { value: 'readwise', label: t('reader.annotations.exportReadwise') },
              { value: 'backup', label: t('reader.annotations.exportBackup') },
            ]} onChange={setAnnotationExportChoice} className="reader-compact-select annotation-export-select" ariaLabel={t('reader.annotations.exportFormat')} menuPlacement="bottom" />
            <HighlightPanelIconButton label={t('reader.annotations.exportSelected')} icon="aiMessageExport" onClick={exportSelectedAnnotations} />
          </div> : null}
          {advancedControlsOpen ? <div className="reader-annotation-advanced-popover" role="dialog" aria-label={t('reader.more')}>
            <div className="reader-annotation-import-io">
              <label title={t('reader.annotations.importJson')} className="reader-import-json reader-annotation-import-btn" data-tooltip={t('reader.annotations.importJson')} aria-label={t('reader.annotations.importJson')} tabIndex={0} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.currentTarget.querySelector('input')?.click();
                }
              }}>
                <BookMindIcon name="libraryImport" />
                <span>{t('reader.annotations.importJson')}</span>
                <input type="file" accept="application/json,.json" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) onImportAnnotationsJson(file);
                  event.currentTarget.value = '';
                }} />
              </label>
            </div>
            {activeAnnotationTab === 'highlights' ? (
              <div className="reader-highlight-controls">
            <ThemedSelect
              label={t('reader.highlight.queryScope')}
              value={highlightQueryScope}
              options={[
                { value: 'all', label: t('reader.highlight.queryAll') },
                { value: 'text', label: t('reader.highlight.queryText') },
                { value: 'note', label: t('reader.highlight.queryNote') },
                { value: 'context', label: t('reader.highlight.queryContext') },
              ]}
              onChange={setHighlightQueryScope}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.queryScope')}
              menuPlacement="bottom"
            />
            <ThemedSelect
              label={t('reader.highlight.chapterFilter')}
              value={String(highlightChapterFilter)}
              options={[{ value: 'all', label: t('reader.highlight.chapterAll') }, ...chapters.map((chapter) => ({ value: String(chapter.index), label: chapter.title }))]}
              onChange={(value) => setHighlightChapterFilter(value === 'all' ? 'all' : Number(value))}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.chapterFilter')}
              menuPlacement="bottom"
            />
            <ThemedSelect
              label={t('reader.highlight.sort')}
              value={highlightSort}
              options={[
                { value: 'reading-order', label: t('reader.highlight.sortReading') },
                { value: 'created-desc', label: t('reader.highlight.sortCreatedDesc') },
                { value: 'created-asc', label: t('reader.highlight.sortCreatedAsc') },
                { value: 'updated-desc', label: t('reader.highlight.sortUpdatedDesc') },
                { value: 'text-length-desc', label: t('reader.highlight.sortLengthDesc') },
                { value: 'text-length-asc', label: t('reader.highlight.sortLengthAsc') },
                { value: 'color-asc', label: t('reader.highlight.sortColor') },
                { value: 'note-first', label: t('reader.highlight.sortNote') },
              ]}
              onChange={setHighlightSort}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.sort')}
              menuPlacement="bottom"
            />
            <ThemedSelect
              label={t('reader.highlight.noteFilter')}
              value={String(highlightNoteFilter)}
              options={[
                { value: 'all', label: t('reader.highlight.noteAll') },
                { value: 'true', label: t('reader.highlight.noteOnly') },
                { value: 'false', label: t('reader.highlight.noteNone') },
              ]}
              onChange={(value) => setHighlightNoteFilter(value === 'all' ? 'all' : value === 'true')}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.noteFilter')}
              menuPlacement="bottom"
            />
            <ThemedSelect
              label={t('reader.highlight.tagFilter')}
              value={highlightTagFilter}
              options={[{ value: 'all', label: t('reader.highlight.tagAll') }, ...highlightTagOptions.map((tag) => ({ value: tag, label: tag }))]}
              onChange={setHighlightTagFilter}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.tagFilter')}
              menuPlacement="bottom"
            />
            <ThemedSelect
              label={t('reader.highlight.importanceFilter')}
              value={highlightImportanceFilter}
              options={[
                { value: 'all', label: t('reader.highlight.importanceAll') },
                { value: 'normal', label: t('reader.highlight.importanceNormal') },
                { value: 'high', label: t('reader.highlight.importanceHigh') },
                { value: 'critical', label: t('reader.highlight.importanceCritical') },
              ]}
              onChange={setHighlightImportanceFilter}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.importanceFilter')}
              menuPlacement="bottom"
            />
            <ThemedSelect
              label={t('reader.highlight.reviewFilter')}
              value={highlightReviewFilter}
              options={[
                { value: 'all', label: t('reader.highlight.reviewAll') },
                { value: 'new', label: t('reader.highlight.reviewNew') },
                { value: 'due', label: t('reader.highlight.reviewDue') },
                { value: 'reviewed', label: t('reader.highlight.reviewed') },
              ]}
              onChange={setHighlightReviewFilter}
              className="reader-compact-select"
              ariaLabel={t('reader.highlight.reviewFilter')}
              menuPlacement="bottom"
            />
          </div>
            ) : null}
            {activeAnnotationTab === 'bookmarks' ? (
              <>
<div className="reader-highlight-controls">
                <ThemedSelect
                  label={t('reader.bookmark.sort')}
                  value={bookmarkSort}
                  options={[
                    { value: 'created-desc', label: t('reader.bookmark.sortCreatedDesc') },
                    { value: 'created-asc', label: t('reader.bookmark.sortCreatedAsc') },
                    { value: 'chapter-asc', label: t('reader.bookmark.sortChapter') },
                  ]}
                  onChange={setBookmarkSort}
                  className="reader-compact-select"
                  ariaLabel={t('reader.bookmark.sort')}
                  menuPlacement="bottom"
                />
                <ThemedSelect
                  label={t('reader.bookmark.groupBy')}
                  value={bookmarkGroupBy}
                  options={[
                    { value: 'none', label: t('reader.bookmark.groupNone') },
                    { value: 'chapter', label: t('reader.bookmark.groupChapter') },
                    { value: 'created', label: t('reader.bookmark.groupCreated') },
                    { value: 'tag', label: t('reader.bookmark.groupTag') },
                  ]}
                  onChange={setBookmarkGroupBy}
                  className="reader-compact-select"
                  ariaLabel={t('reader.bookmark.groupBy')}
                  menuPlacement="bottom"
                />
              </div>
                <div className="reader-bookmark-bulk-edit" aria-label={t('reader.bookmark.bulkEdit')}>
                <strong>{t('reader.bookmark.bulkEdit')} · {selectedBookmarks.length}</strong>
                <div className="reader-bookmark-bulk-grid">
                  <input value={bulkBookmarkTags} onChange={(event) => setBulkBookmarkTags(event.target.value)} placeholder={t('reader.bookmark.bulkTagsPlaceholder')} aria-label={t('reader.bookmark.tags')} />
                  <ThemedSelect
                    label={t('reader.bookmark.bulkTagMode')}
                    value={bulkBookmarkTagMode}
                    options={[
                      { value: 'append', label: t('reader.bookmark.bulkAppendTags') },
                      { value: 'replace', label: t('reader.bookmark.bulkReplaceTags') },
                    ]}
                    onChange={setBulkBookmarkTagMode}
                    className="reader-compact-select"
                    ariaLabel={t('reader.bookmark.bulkTagMode')}
                    menuPlacement="bottom"
                  />
                  <ThemedSelect
                    label={t('reader.bookmark.bulkNoteMode')}
                    value={bulkBookmarkNoteMode}
                    options={[
                      { value: 'append', label: t('reader.bookmark.bulkAppendNote') },
                      { value: 'replace', label: t('reader.bookmark.bulkReplaceNote') },
                      { value: 'clear', label: t('reader.bookmark.bulkClearNote') },
                    ]}
                    onChange={setBulkBookmarkNoteMode}
                    className="reader-compact-select"
                    ariaLabel={t('reader.bookmark.bulkNoteMode')}
                    menuPlacement="bottom"
                  />
                  <textarea value={bulkBookmarkNote} onChange={(event) => setBulkBookmarkNote(event.target.value)} placeholder={t('reader.bookmark.bulkNote')} aria-label={t('reader.bookmark.bulkNote')} rows={3} disabled={bulkBookmarkNoteMode === 'clear'} />
                </div>
                <div className="reader-color-row" role="group" aria-label={t('reader.bookmark.bulkColor')}>
                  {readerHighlightColors.map((color) => (
                    <button className={`reader-color-dot color-${color}${bulkBookmarkColor === color ? ' active' : ''}`} type="button" key={color} aria-label={t(`reader.highlight.color.${color}`)} aria-pressed={bulkBookmarkColor === color} onClick={() => setBulkBookmarkColor(color)} />
                  ))}
                </div>
                <button type="button" disabled={!selectedBookmarks.length} onClick={applyBulkBookmarkEdit}>{t('reader.bookmark.applyBulkEdit', { count: selectedBookmarks.length })}</button>
              </div>
              </>
            ) : null}
          </div> : null}
          {activeAnnotationTab === 'highlights' ? (
          <div className="reader-annotation-quick-row">
          <div className="reader-highlight-selection-actions">
            <HighlightPanelIconButton label={t('reader.highlight.expandAllGroups')} icon="libraryGroupExpand" disabled={!highlightGroups.length || highlightGroups.every((group) => expandedHighlightGroups.has(group.chapterIndex))} onClick={() => setExpandedHighlightGroups(new Set(highlightGroups.map((group) => group.chapterIndex)))} />
            <HighlightPanelIconButton label={t('reader.highlight.collapseAllGroups')} icon="libraryGroupCollapse" disabled={!highlightGroups.some((group) => expandedHighlightGroups.has(group.chapterIndex))} onClick={() => setExpandedHighlightGroups(new Set())} />
            <HighlightPanelIconButton label={t('reader.highlight.selectFiltered')} icon="grid" hideWhenDisabled disabled={!filteredHighlights.some((highlight) => highlight.id)} onClick={() => setSelectedHighlightIds(new Set(filteredHighlights.flatMap((highlight) => highlight.id ? [highlight.id] : [])))} />
            <HighlightPanelIconButton label={t('reader.highlight.invertSelection')} icon="retry" hideWhenDisabled disabled={!filteredHighlights.some((highlight) => highlight.id)} onClick={() => setSelectedHighlightIds((current) => {
              const next = new Set(current);
              filteredHighlights.forEach((highlight) => {
                if (!highlight.id) return;
                if (next.has(highlight.id)) next.delete(highlight.id);
                else next.add(highlight.id);
              });
              return next;
            })} />
            <HighlightPanelIconButton label={t('reader.highlight.clearSelection')} icon="close" hideWhenDisabled disabled={!selectedHighlightIds.size} onClick={() => setSelectedHighlightIds(new Set())} />
            <HighlightPanelIconButton label={t('reader.highlight.deleteSelected', { count: selectedHighlightIds.size })} icon="aiMessageDelete" danger hideWhenDisabled disabled={!selectedHighlightIds.size} onClick={() => { const deleted = highlights.filter((highlight) => highlight.id && selectedHighlightIds.has(highlight.id)); onDeleteHighlights([...selectedHighlightIds]); setSelectedHighlightIds(new Set()); if (deleted.length) showUndoToast(t('reader.undo.deleted'), () => deleted.forEach(onRestoreHighlight)); }} />
            <HighlightPanelIconButton label={t('reader.annotations.exportSelected')} icon="aiMessageExport" onClick={() => { setAdvancedControlsOpen(false); setExportPanelOpen((open) => !open); }} />
          </div>
          <div className="reader-highlight-filter" role="group" aria-label={t('reader.highlight.filterColor')}>
            <button type="button" className={highlightColorFilter === 'all' ? 'active' : ''} aria-pressed={highlightColorFilter === 'all'} onClick={() => setHighlightColorFilter('all')}>{t('reader.highlight.filterAll')}</button>
            {readerHighlightColors.map((color) => (
              <button type="button" className={`reader-color-dot color-${color}${highlightColorFilter === color ? ' active' : ''}`} key={color} aria-label={t(`reader.highlight.color.${color}`)} aria-pressed={highlightColorFilter === color} onClick={() => setHighlightColorFilter(color)} />
            ))}
          </div>
          </div>
          ) : null}
          <div className="reader-annotation-scroll">
          {activeAnnotationTab === 'highlights' ? (
            <>
          {highlightGroups.length === 0 ? <p>{t('reader.highlight.empty')}</p> : null}
            </>
          ) : null}
          {activeAnnotationTab === 'bookmarks' ? (
            <div className="reader-highlight-group">
              <div className="reader-annotation-quick-row">
                <div className="reader-highlight-selection-actions reader-bookmark-quick-actions">
                  <HighlightPanelIconButton label={t('reader.bookmark.selectFiltered')} icon="bookmark" hideWhenDisabled disabled={!filteredBookmarks.length} onClick={() => setSelectedBookmarkIds(new Set(filteredBookmarks.map((bookmark) => bookmark.id)))} />
                  <HighlightPanelIconButton label={t('reader.bookmark.invertSelection')} icon="retry" hideWhenDisabled disabled={!filteredBookmarks.length} onClick={() => setSelectedBookmarkIds((current) => {
                    const next = new Set(current);
                    filteredBookmarks.forEach((bookmark) => {
                      if (next.has(bookmark.id)) next.delete(bookmark.id);
                      else next.add(bookmark.id);
                    });
                    return next;
                  })} />
                  <HighlightPanelIconButton label={t('reader.bookmark.clearSelection')} icon="close" hideWhenDisabled disabled={!selectedBookmarkIds.size} onClick={() => setSelectedBookmarkIds(new Set())} />
                  <HighlightPanelIconButton label={t('reader.bookmark.deleteSelected', { count: selectedBookmarkIds.size })} icon="aiMessageDelete" danger hideWhenDisabled disabled={!selectedBookmarkIds.size} onClick={() => { const deleted = bookmarks.filter((bookmark) => selectedBookmarkIds.has(bookmark.id)); selectedBookmarkIds.forEach(onDeleteBookmark); setSelectedBookmarkIds(new Set()); if (deleted.length) showUndoToast(t('reader.undo.deleted'), () => deleted.forEach(onRestoreBookmark)); }} />
                  <HighlightPanelIconButton label={t('reader.annotations.exportSelected')} icon="aiMessageExport" onClick={() => { setAdvancedControlsOpen(false); setExportPanelOpen((open) => !open); }} />
                </div>
                <div className="reader-highlight-filter" role="group" aria-label={t('reader.bookmark.filterColor')}>
                  <button type="button" className={bookmarkColorFilter === 'all' ? 'active' : ''} aria-pressed={bookmarkColorFilter === 'all'} onClick={() => setBookmarkColorFilter('all')}>{t('reader.highlight.filterAll')}</button>
                  {readerHighlightColors.map((color) => (
                    <button type="button" className={`reader-color-dot color-${color}${bookmarkColorFilter === color ? ' active' : ''}`} key={color} aria-label={t(`reader.highlight.color.${color}`)} aria-pressed={bookmarkColorFilter === color} onClick={() => setBookmarkColorFilter(color)} />
                  ))}
                </div>
              </div>
              {filteredBookmarks.length === 0 ? <p>{t('reader.bookmark.empty')}</p> : null}
              {bookmarkVirtualWindow.before ? <div className="reader-virtual-spacer">{t('reader.virtualBefore', { count: bookmarkVirtualWindow.before })}</div> : null}
              {bookmarkVirtualWindow.items.map((group) => (
                <div className="reader-bookmark-group" key={group.key}>
                  {bookmarkGroupBy !== 'none' ? <strong>{group.label} · {group.items.length}</strong> : null}
                  {group.items.map((bookmark) => (
                    <div className="reader-bookmark-row" key={bookmark.id} role="button" tabIndex={0} onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey) {
                        toggleBookmarkSelection(bookmark, event);
                        return;
                      }
                      onJumpBookmark(bookmark);
                    }} onDoubleClick={() => setBookmarkViewer(bookmark)} onContextMenu={(event) => openBookmarkMenu(event, bookmark)} onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onJumpBookmark(bookmark);
                      }
                      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openBookmarkMenu(event, bookmark);
                    }}>
                      <input type="checkbox" checked={selectedBookmarkIds.has(bookmark.id)} aria-label={t('reader.bookmark.select')} onClick={(event) => event.stopPropagation()} onChange={(event) => {
                        event.stopPropagation();
                        toggleBookmarkSelection(bookmark);
                      }} />
                      <i className={`reader-bookmark-mark color-${bookmark.color ?? 'red'}`} />
                      <em>{bookmark.title || bookmark.label}</em>
                      <button type="button" className="reader-more-button" aria-label={t('reader.more')} onDoubleClick={(event) => { event.stopPropagation(); setBookmarkViewer(bookmark); }} onClick={(event) => openBookmarkMenu(event, bookmark)}>⋯</button>
                    </div>
                  ))}
                </div>
              ))}
              {bookmarkVirtualWindow.after ? <div className="reader-virtual-spacer">{t('reader.virtualAfter', { count: bookmarkVirtualWindow.after })}</div> : null}
            </div>
          ) : null}
          {activeAnnotationTab === 'highlights' ? highlightVirtualWindow.items.map((group) => {
            const chapter = chapters.find((item) => item.index === group.chapterIndex);
            const chapterTitle = chapter?.title ?? t('reader.chapterCount', { current: group.chapterIndex + 1, total: chapters.length });
            const expanded = expandedHighlightGroups.has(group.chapterIndex);
            const groupContentId = `reader-highlight-group-${group.chapterIndex}`;
            return (
              <div className={`reader-highlight-group${expanded ? ' expanded' : ''}`} key={group.chapterIndex}>
                <button
                  type="button"
                  className="reader-highlight-group-toggle"
                  aria-expanded={expanded}
                  aria-controls={groupContentId}
                  onClick={() => setExpandedHighlightGroups((current) => {
                    const next = new Set(current);
                    if (next.has(group.chapterIndex)) next.delete(group.chapterIndex);
                    else next.add(group.chapterIndex);
                    return next;
                  })}
                >
                  <BookMindIcon name={expanded ? 'libraryGroupCollapse' : 'libraryGroupExpand'} />
                  <span>{chapterTitle}</span>
                  <small>{group.items.length}</small>
                </button>
                <div id={groupContentId} className="reader-highlight-group-items" hidden={!expanded}>
                {group.items.map((highlight) => (
                  <div
                    className="reader-highlight-row"
                    role="button"
                    tabIndex={0}
                    key={highlight.id ?? `${highlight.chapterIndex}-${highlight.paragraphIndex}-${highlight.startOffset}`}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey) {
                        toggleHighlightSelection(highlight, event);
                        return;
                      }
                      jumpToParagraph(highlight.chapterIndex, highlight.paragraphIndex, highlight.startOffset);
                    }}
                    onContextMenu={(event) => openHighlightMenu(event, highlight)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        jumpToParagraph(highlight.chapterIndex, highlight.paragraphIndex, highlight.startOffset);
                      }
                      openHighlightMenuFromKeyboard(event, highlight);
                    }}
                    onPointerDown={(event) => startLongPressMenu(event, (clientX, clientY, target) => openHighlightMenuAt(clientX, clientY, target, highlight))}
                    onPointerMove={cancelLongPressMenu}
                    onPointerUp={cancelLongPressMenu}
                    onPointerCancel={cancelLongPressMenu}
                    onClickCapture={suppressClickAfterLongPress}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(highlight.id && selectedHighlightIds.has(highlight.id))}
                      aria-label={t('reader.highlight.select')}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleHighlightSelection(highlight);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <i className={`reader-highlight-swatch color-${highlight.color ?? 'yellow'}`} />
                    <em>{highlight.text}</em>
                    {highlight.note ? <small>{highlight.note}</small> : null}
                    <button type="button" className="reader-more-button" aria-label={t('reader.more')} onClick={(event) => openHighlightMenuFromButton(event, highlight)} onKeyDown={(event) => openHighlightMenuFromKeyboard(event, highlight)}>⋯</button>
                  </div>
                ))}
                </div>
              </div>
            );
          }) : null}
          </div>
        </section>
      ) : null}
      </aside>
    </div>
  );
  return (
    <>
      {panelHost ? createPortal(panelNode, panelHost) : panelNode}
      {bookmarkMenu ? createPortal(<ReaderBookmarkContextMenu menu={bookmarkMenu} onUpdateBookmark={onUpdateBookmark} onJump={onJumpBookmark} onView={setBookmarkViewer} onDelete={deleteBookmarkWithUndo} onClose={() => setBookmarkMenu(null)} />, document.body) : null}
    </>
  );
}

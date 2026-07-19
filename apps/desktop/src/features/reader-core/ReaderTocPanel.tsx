import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import type { ReaderBookmark } from '../../types';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { ReaderTextDialogRequest } from './ReaderAnnotationDrawers';
import { createReaderTocIndex, filterReaderTocEntries, getFloatingMenuPosition, getReaderChapterCharacterCount } from './readerModel';
import type { ReaderChapter, ReaderHighlightRange, ReaderTocEdit, ReaderTocSearchScope } from './readerModel';

export type { ReaderTocEntry, ReaderTocSearchScope } from './readerModel';
export { createReaderTocIndex, filterReaderTocEntries } from './readerModel';

export type ReaderTocEditHistoryEntry = {
  id: string;
  label: string;
  createdAt: string;
};

export type ReaderTocMenuState = {
  x: number;
  y: number;
  chapterId: string;
  title: string;
  canSplit: boolean;
  paragraphIndex: number;
};

export function ReaderToc({ chapters, highlights, bookmarks, hiddenChapters, activeChapterIndex, activeParagraphIndex, tocMenu, tocHierarchyMode, tocShowVolumeHierarchy, tocVolumeClickable, tocShowChapterNumbers, tocCollapseVolumes, tocExpandActiveVolume, tocShowChapterWordCount, tocShowChapterProgress, tocTitleGroupingEnabled, tocTitleGroupKeywords, tocTitleGroupRules, tocAllowRename, tocAllowHide, tocAllowUnhide, tocAllowSplit, tocAllowMergeNext, tocAllowRestoreDefault, tocAllowUndoRedo, tocEditHistory, onOpenMenu, onRememberMenuOpener, onOpenTextDialog, onSelectChapter, onTocEdit, onUndoTocEdit, onRedoTocEdit, onRestoreDefaultToc, onExportTocEdits, onImportTocEditsJson, canUndoTocEdit, canRedoTocEdit, hasTocEdits, contextMenuEnabled, onLongPressMenu, onLongPressCancel, onSuppressClickAfterLongPress }: { chapters: ReaderChapter[]; highlights: ReaderHighlightRange[]; bookmarks: ReaderBookmark[]; hiddenChapters: ReaderChapter[]; activeChapterIndex: number; activeParagraphIndex: number; tocMenu: ReaderTocMenuState | null; tocHierarchyMode: 'novel' | 'document'; tocShowVolumeHierarchy: boolean; tocVolumeClickable: boolean; tocShowChapterNumbers: boolean; tocCollapseVolumes: boolean; tocExpandActiveVolume: boolean; tocShowChapterWordCount: boolean; tocShowChapterProgress: boolean; tocTitleGroupingEnabled: boolean; tocTitleGroupKeywords: string; tocTitleGroupRules: ExtendedSettings['tocTitleGroupRules']; tocAllowRename: boolean; tocAllowHide: boolean; tocAllowUnhide: boolean; tocAllowSplit: boolean; tocAllowMergeNext: boolean; tocAllowRestoreDefault: boolean; tocAllowUndoRedo: boolean; tocEditHistory: ReaderTocEditHistoryEntry[]; onOpenMenu: (menu: ReaderTocMenuState | null) => void; onRememberMenuOpener: (element: HTMLElement) => void; onOpenTextDialog: (dialog: ReaderTextDialogRequest | null) => void; onSelectChapter: (index: number, paragraphIndex?: number) => void; onTocEdit: (edit: ReaderTocEdit) => void | Promise<void>; onUndoTocEdit: () => void; onRedoTocEdit: () => void; onRestoreDefaultToc: () => void | Promise<void>; onExportTocEdits: () => void; onImportTocEditsJson: (file: File) => void; canUndoTocEdit: boolean; canRedoTocEdit: boolean; hasTocEdits: boolean; contextMenuEnabled: boolean; onLongPressMenu: (event: React.PointerEvent<HTMLElement>, openMenu: (clientX: number, clientY: number, target: HTMLElement) => void) => void; onLongPressCancel: () => void; onSuppressClickAfterLongPress: (event: React.MouseEvent<HTMLElement>) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ReaderTocSearchScope>('title');
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(() => new Set());
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => new Set());
  const tocListRef = useRef<HTMLDivElement | null>(null);
  const tocIndex = useMemo(() => createReaderTocIndex(chapters, { highlights, bookmarks }, { hierarchyMode: tocHierarchyMode, titleGroupingEnabled: tocTitleGroupingEnabled, titleGroupKeywords: tocTitleGroupKeywords, titleGroupRules: tocTitleGroupRules }), [chapters, highlights, bookmarks, tocHierarchyMode, tocTitleGroupingEnabled, tocTitleGroupKeywords, tocTitleGroupRules]);
  const activeVolumeTitle = useMemo(() => tocIndex.entries.find((entry) => entry.chapter.index === activeChapterIndex)?.volumeTitle ?? '', [tocIndex, activeChapterIndex]);
  useEffect(() => {
    if (!tocExpandActiveVolume || !activeVolumeTitle) return;
    setCollapsedVolumes((current) => {
      if (!current.has(activeVolumeTitle)) return current;
      const next = new Set(current);
      next.delete(activeVolumeTitle);
      return next;
    });
  }, [tocExpandActiveVolume, activeVolumeTitle]);
  useEffect(() => {
    const activeEntry = tocIndex.entries.find((entry) => entry.chapter.index === activeChapterIndex);
    if (!activeEntry?.ancestorIds.length) return;
    setCollapsedNodes((current) => {
      if (!activeEntry.ancestorIds.some((id) => current.has(id))) return current;
      const next = new Set(current);
      activeEntry.ancestorIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [tocIndex, activeChapterIndex]);
  const debouncedQuery = useDebouncedValue(query, 180);
  const filteredEntries = useMemo(() => filterReaderTocEntries(tocIndex, debouncedQuery, scope).filter((entry) => {
    const volumeCollapseApplies = tocCollapseVolumes && entry.volumeTitle && entry.kind !== 'volume';
    if (!volumeCollapseApplies || debouncedQuery.trim()) return true;
    if (tocExpandActiveVolume && entry.volumeTitle === activeVolumeTitle) return true;
    if (collapsedVolumes.has(entry.volumeTitle)) return false;
    return true;
  }).filter((entry) => debouncedQuery.trim() || tocHierarchyMode !== 'document' || !entry.ancestorIds.some((id) => collapsedNodes.has(id))), [tocIndex, debouncedQuery, scope, tocCollapseVolumes, tocExpandActiveVolume, activeVolumeTitle, collapsedVolumes, tocHierarchyMode, collapsedNodes]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeItem = tocListRef.current?.querySelector<HTMLElement>('[aria-current="location"]');
      if (activeItem) activeItem.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeChapterIndex, debouncedQuery, scope, collapsedVolumes, collapsedNodes]);
  function openTocMenu(clientX: number, clientY: number, target: HTMLElement, entry: ReturnType<typeof filterReaderTocEntries>[number]) {
    const rect = target.closest('.reader-toc')?.getBoundingClientRect();
    const position = rect
      ? getFloatingMenuPosition(clientX, clientY, rect, { width: 180, height: entry.snippet ? 176 : 136 })
      : { x: clientX, y: clientY };
    onRememberMenuOpener(target);
    onOpenMenu({ x: position.x, y: position.y, chapterId: entry.chapter.id, title: entry.chapter.title, canSplit: Boolean(entry.snippet), paragraphIndex: entry.matchParagraphIndex });
  }
  function toggleDocumentNode(chapterId: string) {
    setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }
  return (
    <aside className="reader-toc">
      <div className="section-title"><span>{t('reader.toc.title')}</span><strong>{filteredEntries.length}/{chapters.length}</strong></div>
      <div className="reader-toc-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('reader.toc.searchPlaceholder')} aria-label={t('reader.toc.searchPlaceholder')} />
        <div className="reader-toc-scope" role="group" aria-label={t('reader.toc.searchScope')}>
          <ReaderTocIconButton active={scope === 'title'} icon="tocScopeTitle" label={t('reader.toc.scopeTitle')} tooltip={t('reader.toc.scopeTitleHint')} onClick={() => setScope('title')} />
          <ReaderTocIconButton active={scope === 'content'} icon="tocScopeContent" label={t('reader.toc.scopeContent')} tooltip={t('reader.toc.scopeContentHint')} onClick={() => setScope('content')} />
          <ReaderTocIconButton active={scope === 'annotations'} icon="tocScopeAnnotations" label={t('reader.toc.scopeAnnotations')} tooltip={t('reader.toc.scopeAnnotationsHint')} onClick={() => setScope('annotations')} />
          <ReaderTocIconButton active={scope === 'bookmarks'} icon="tocScopeBookmarks" label={t('reader.toc.scopeBookmarks')} tooltip={t('reader.toc.scopeBookmarksHint')} onClick={() => setScope('bookmarks')} />
        </div>
        <div className="reader-toc-edit-tools" role="group" aria-label={t('reader.toc.editTools')}>
          {tocAllowUndoRedo ? <ReaderTocIconButton icon="tocUndo" label={t('reader.toc.undo')} tooltip={canUndoTocEdit ? t('reader.toc.undoHint') : t('reader.toc.undoDisabledHint')} disabled={!canUndoTocEdit} onClick={onUndoTocEdit} /> : null}
          {tocAllowUndoRedo ? <ReaderTocIconButton icon="tocRedo" label={t('reader.toc.redo')} tooltip={canRedoTocEdit ? t('reader.toc.redoHint') : t('reader.toc.redoDisabledHint')} disabled={!canRedoTocEdit} onClick={onRedoTocEdit} /> : null}
          {tocAllowRestoreDefault ? <ReaderTocIconButton icon="retry" label={t('reader.toc.restoreDefault')} tooltip={hasTocEdits ? t('reader.toc.restoreDefaultHint') : t('reader.toc.noTocEditsHint')} disabled={!hasTocEdits} onClick={onRestoreDefaultToc} /> : null}
          <ReaderTocIconButton icon="aiMessageExport" label={t('reader.toc.exportEdits')} tooltip={hasTocEdits ? t('reader.toc.exportEditsHint') : t('reader.toc.noTocEditsHint')} disabled={!hasTocEdits} onClick={onExportTocEdits} />
          <label className="reader-import-json reader-toc-icon-btn" data-tooltip={t('reader.toc.importEdits')} title={t('reader.toc.importEdits')} aria-label={t('reader.toc.importEdits')} tabIndex={0}>
            <BookMindIcon name="libraryImport" />
            <input className="reader-toc-import-input" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onImportTocEditsJson(file);
              event.currentTarget.value = '';
            }} />
          </label>
        </div>
        {tocEditHistory.length ? <div className="reader-toc-history" aria-label={t('reader.toc.history')}>
          <strong>{t('reader.toc.history')}</strong>
          {tocEditHistory.map((entry) => <span key={entry.id}><em>{entry.label}</em><small>{entry.createdAt.slice(0, 16).replace('T', ' ')}</small></span>)}
        </div> : null}
      </div>
      <div className="reader-toc-list" ref={tocListRef}>
        {filteredEntries.length > 0 ? filteredEntries.map((entry) => {
          const volumeEntryDisabled = entry.kind === 'volume' && !tocVolumeClickable;
          const volumeCollapsed = tocCollapseVolumes && entry.kind === 'volume' && collapsedVolumes.has(entry.chapter.title);
          const treeCollapsed = tocHierarchyMode === 'document' && entry.hasChildren && collapsedNodes.has(entry.chapter.id);
          const showTreeToggle = tocHierarchyMode === 'document' && entry.hasChildren;
          const chapterCharacters = getReaderChapterCharacterCount(entry.chapter);
          const chapterProgress = entry.chapter.index === activeChapterIndex && entry.chapter.paragraphs.length
            ? Math.round(((Math.min(activeParagraphIndex, entry.chapter.paragraphs.length - 1) + 1) / entry.chapter.paragraphs.length) * 100)
            : entry.chapter.index < activeChapterIndex ? 100 : 0;
          const showVolumeState = tocCollapseVolumes && entry.kind === 'volume';
          const showVolumeTitle = tocShowVolumeHierarchy && entry.volumeTitle && entry.kind !== 'volume';
          const showTitleGroup = tocTitleGroupingEnabled && entry.titleGroup && entry.titleGroup !== '正文' && entry.kind !== 'volume';
          const showWordCount = tocShowChapterWordCount && entry.kind !== 'volume';
          const showProgress = tocShowChapterProgress && entry.kind !== 'volume';
          const hasMetadata = showVolumeState || showVolumeTitle || showTitleGroup || showWordCount || showProgress;
          return (
          <button
            className={`${entry.chapter.index === activeChapterIndex ? 'active' : ''} ${entry.kind === 'volume' ? 'volume' : ''} ${tocShowChapterNumbers ? '' : 'no-numbers'}`}
            key={`${entry.chapter.id}-${entry.matchParagraphIndex}`}
            aria-current={entry.chapter.index === activeChapterIndex ? 'location' : undefined}
            aria-disabled={volumeEntryDisabled || undefined}
            onClick={() => { if (!volumeEntryDisabled) onSelectChapter(entry.chapter.index, entry.matchParagraphIndex); }}
            onContextMenu={(event) => {
              event.preventDefault();
              if (!contextMenuEnabled) return;
              openTocMenu(event.clientX, event.clientY, event.currentTarget, entry);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault();
                if (!contextMenuEnabled) return;
                const rect = event.currentTarget.getBoundingClientRect();
                openTocMenu(rect.left + rect.width / 2, rect.bottom, event.currentTarget, entry);
              }
            }}
            onPointerDown={(event) => onLongPressMenu(event, (clientX, clientY, target) => openTocMenu(clientX, clientY, target, entry))}
            onPointerMove={onLongPressCancel}
            onPointerUp={onLongPressCancel}
            onPointerCancel={onLongPressCancel}
            onClickCapture={onSuppressClickAfterLongPress}
          >
            {tocShowChapterNumbers ? <span className="reader-toc-number">{entry.chapter.index + 1}</span> : null}
            <span className="reader-toc-main">
              <em style={tocHierarchyMode === 'document' ? { paddingLeft: `${Math.min(3, entry.depth) * 14}px` } : undefined}>{entry.chapter.title}</em>
              {hasMetadata ? <span className="reader-toc-meta">
                {showVolumeState ? <small>{volumeCollapsed ? t('reader.toc.volumeCollapsed') : t('reader.toc.volumeExpanded')}</small> : null}
                {showVolumeTitle ? <small>{entry.volumeTitle}</small> : null}
                {showTitleGroup ? <small>{entry.titleGroup}</small> : null}
                {showWordCount ? <small>{t('reader.toc.characterCount', { count: chapterCharacters })}</small> : null}
                {showProgress ? <small className="reader-toc-progress">{chapterProgress}%</small> : null}
              </span> : null}
              {entry.snippet ? <mark>{entry.snippet}</mark> : null}
            </span>
            {showTreeToggle ? <span className="reader-more-button reader-toc-volume-toggle reader-toc-tree-toggle" role="button" tabIndex={0} aria-label={treeCollapsed ? t('reader.toc.expandNode') : t('reader.toc.collapseNode')} onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleDocumentNode(entry.chapter.id);
            }} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                toggleDocumentNode(entry.chapter.id);
              }
            }}>{treeCollapsed ? '›' : '⌄'}</span> : tocCollapseVolumes && entry.kind === 'volume' ? <span className="reader-more-button reader-toc-volume-toggle" role="button" tabIndex={0} aria-label={volumeCollapsed ? t('reader.toc.expandVolume') : t('reader.toc.collapseVolume')} onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setCollapsedVolumes((current) => {
                const next = new Set(current);
                if (next.has(entry.chapter.title)) next.delete(entry.chapter.title);
                else next.add(entry.chapter.title);
                return next;
              });
            }} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                setCollapsedVolumes((current) => {
                  const next = new Set(current);
                  if (next.has(entry.chapter.title)) next.delete(entry.chapter.title);
                  else next.add(entry.chapter.title);
                  return next;
                });
              }
            }}>{volumeCollapsed ? '+' : '-'}</span> : null}
            <span className="reader-more-button reader-toc-menu-trigger" role="button" tabIndex={0} aria-label={t('reader.more')} onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              openTocMenu(rect.right, rect.bottom, event.currentTarget, entry);
            }} onKeyDown={(event) => {
              if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                openTocMenu(rect.right, rect.bottom, event.currentTarget, entry);
              }
            }}>⋯</span>
          </button>
          );
        }) : <p className="reader-toc-empty">{t('reader.toc.emptySearch')}</p>}
        {tocAllowUnhide && hiddenChapters.length ? <div className="reader-hidden-chapters"><strong>{t('reader.toc.hiddenTitle', { count: hiddenChapters.length })}</strong><button type="button" onClick={() => hiddenChapters.forEach((chapter) => onTocEdit({ type: 'unhide', chapterId: chapter.id }))}>{t('reader.toc.unhideAll')}</button>{hiddenChapters.map((chapter) => <button type="button" key={chapter.id} onClick={() => onTocEdit({ type: 'unhide', chapterId: chapter.id })}>{chapter.title}</button>)}</div> : null}
      </div>
      {tocMenu ? (
        <div className="reader-context-menu" role="menu" aria-label={t('reader.toc.menu')} style={{ left: tocMenu.x, top: tocMenu.y }} onClick={(event) => event.stopPropagation()}>
          {tocAllowRename ? <button role="menuitem" type="button" onClick={() => { const menu = tocMenu; onOpenTextDialog({ x: menu.x, y: menu.y, title: t('reader.toc.renamePrompt'), value: menu.title, submitLabel: t('reader.toc.rename'), onSubmit: (title) => onTocEdit({ type: 'rename', chapterId: menu.chapterId, title }) }); onOpenMenu(null); }}>{t('reader.toc.rename')}</button> : null}
          {tocAllowHide ? <button role="menuitem" type="button" onClick={() => { onTocEdit({ type: 'hide', chapterId: tocMenu.chapterId }); onOpenMenu(null); }}>{t('reader.toc.hideItem')}</button> : null}
          {tocAllowMergeNext ? <button role="menuitem" type="button" onClick={() => { onTocEdit({ type: 'merge-next', chapterId: tocMenu.chapterId }); onOpenMenu(null); }}>{t('reader.toc.mergeNext')}</button> : null}
          {tocAllowSplit && tocMenu.canSplit ? <button role="menuitem" type="button" onClick={() => { const menu = tocMenu; onOpenTextDialog({ x: menu.x, y: menu.y, title: t('reader.toc.splitPrompt'), value: `${menu.title} · ${t('reader.toc.splitSuffix')}`, submitLabel: t('reader.toc.splitHere'), onSubmit: (title) => onTocEdit({ type: 'split', chapterId: menu.chapterId, paragraphIndex: menu.paragraphIndex, title }) }); onOpenMenu(null); }}>{t('reader.toc.splitHere')}</button> : null}
        </div>
      ) : null}
    </aside>
  );
}

function ReaderTocIconButton({ active = false, disabled = false, icon, label, tooltip, onClick }: { active?: boolean; disabled?: boolean; icon: BookMindIconName; label: string; tooltip: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      aria-pressed={active || undefined}
      className={active ? 'reader-toc-icon-btn active' : 'reader-toc-icon-btn'}
      data-tooltip={tooltip}
      disabled={disabled}
      title={tooltip}
      type="button"
      onClick={onClick}
    >
      <BookMindIcon name={icon} />
    </button>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

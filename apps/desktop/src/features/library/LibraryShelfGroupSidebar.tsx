import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Book } from '../../types';
import { filterBooksByShelfGroup, type ShelfGroupEntry } from './libraryShelfGroups';

type LibraryShelfGroupSidebarProps = {
  groups: ShelfGroupEntry[];
  books: Book[];
  privacySettings: ExtendedSettings;
  activeGroupId: string;
  collapsed: boolean;
  expandedGroupIds: string[];
  dragOverGroupId: string | null;
  onToggleCollapsed: () => void;
  onToggleGroupExpanded: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onOpenBook: (bookId: string) => void;
  onOpenGroupContextMenu: (event: ReactMouseEvent, group: ShelfGroupEntry | null) => void;
  onDragBookStart: (event: ReactDragEvent<HTMLElement>, book: Book) => void;
  onDragOverGroup: (event: ReactDragEvent<HTMLElement>, groupId: string) => void;
  onDropGroup: (event: ReactDragEvent<HTMLElement>, groupId: string) => void;
  onDragLeaveGroup: () => void;
};

export function LibraryShelfGroupSidebar({ groups, books, privacySettings, activeGroupId, collapsed, expandedGroupIds, dragOverGroupId, onToggleCollapsed, onToggleGroupExpanded, onSelectGroup, onOpenBook, onOpenGroupContextMenu, onDragBookStart, onDragOverGroup, onDropGroup, onDragLeaveGroup }: LibraryShelfGroupSidebarProps) {
  const { t } = useI18n();
  const baseGroups = groups.filter((group) => group.kind !== 'custom');
  const customGroups = groups.filter((group) => group.kind === 'custom');
  return (
    <aside className={collapsed ? 'library-group-sidebar collapsed' : 'library-group-sidebar'} aria-label={t('library.groups.title')} onContextMenu={(event) => onOpenGroupContextMenu(event, null)} onDragOver={(event) => onDragOverGroup(event, activeGroupId)} onDrop={(event) => onDropGroup(event, activeGroupId)} onDragLeave={onDragLeaveGroup}>
      <header>
        <div><span>{t('library.groups.eyebrow')}</span><strong>{t('library.groups.title')}</strong></div>
        <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? t('library.groups.expand') : t('library.groups.collapse')}><BookMindIcon name={collapsed ? 'libraryGroupExpand' : 'libraryGroupCollapse'} /></button>
      </header>
      <div className="library-group-list">
        {baseGroups.map((group) => (
          <ShelfGroupButton key={group.id} group={group} active={activeGroupId === group.id} dropTarget={dragOverGroupId === group.id} onSelect={onSelectGroup} onDragOver={onDragOverGroup} onDrop={onDropGroup} onDragLeave={onDragLeaveGroup} />
        ))}
      </div>
      <div className="library-group-list custom">
        {customGroups.length ? customGroups.map((group) => {
          const expanded = !collapsed && expandedGroupIds.includes(group.id);
          const groupBooks = expanded ? filterBooksByShelfGroup(books, group.id) : [];
          return (
            <div className={`library-group-node${expanded ? ' expanded' : ''}`} key={group.id} data-shelf-group-id={group.id} onContextMenu={(event) => onOpenGroupContextMenu(event, group)} onDragOver={(event) => onDragOverGroup(event, group.id)} onDrop={(event) => onDropGroup(event, group.id)} onDragLeave={onDragLeaveGroup}>
              <div className="library-group-node-row">
                <ShelfGroupButton group={group} active={activeGroupId === group.id} dropTarget={dragOverGroupId === group.id} onSelect={onSelectGroup} onDragOver={onDragOverGroup} onDrop={onDropGroup} onDragLeave={onDragLeaveGroup} />
                {!collapsed ? <button className="library-group-expand-btn" type="button" onClick={() => onToggleGroupExpanded(group.id)} aria-label={expanded ? t('library.groups.collapseOne', { group: group.label }) : t('library.groups.expandOne', { group: group.label })}><BookMindIcon name={expanded ? 'libraryGroupCollapse' : 'libraryGroupExpand'} /></button> : null}
              </div>
              {expanded ? (
                <div className="library-group-books">
                  {groupBooks.map((book) => (
                    <button type="button" key={book.id} draggable onDragStart={(event) => onDragBookStart(event, book)} onClick={() => onOpenBook(book.id)} title={getPrivacyBookTitle(book.displayTitle, privacySettings)}>
                      <span className={book.coverTone}>{book.coverLabel}</span>
                      <strong>{getPrivacyBookTitle(book.displayTitle, privacySettings)}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }) : <p>{t('library.groups.empty')}</p>}
      </div>
    </aside>
  );
}

function ShelfGroupButton({ group, active, dropTarget, onSelect, onDragOver, onDrop, onDragLeave }: { group: ShelfGroupEntry; active: boolean; dropTarget: boolean; onSelect: (groupId: string) => void; onDragOver: (event: ReactDragEvent<HTMLElement>, groupId: string) => void; onDrop: (event: ReactDragEvent<HTMLElement>, groupId: string) => void; onDragLeave: () => void }) {
  return (
    <button
      type="button"
      aria-label={group.label}
      data-shelf-group-id={group.id}
      className={`library-group-item${active ? ' active' : ''}${dropTarget ? ' drop-target' : ''}`}
      onClick={() => onSelect(group.id)}
      onDragOver={(event) => onDragOver(event, group.id)}
      onDrop={(event) => onDrop(event, group.id)}
      onDragLeave={onDragLeave}
    >
      <span>{getShelfGroupIcon(group)}</span>
      <strong>{group.label}</strong>
      <em>{group.count}</em>
    </button>
  );
}

function getShelfGroupIcon(group: ShelfGroupEntry) {
  if (group.kind === 'all') return '全';
  if (group.kind === 'ungrouped') return '未';
  return Array.from(group.label.trim())[0]?.toUpperCase() ?? '分';
}

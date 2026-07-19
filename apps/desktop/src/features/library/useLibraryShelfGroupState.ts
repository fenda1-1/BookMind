import { useEffect, useMemo, useState } from 'react';
import type { Book } from '../../types';
import { allShelfGroupId, buildShelfGroups, filterBooksByShelfGroup } from './libraryShelfGroups';
import { loadLibraryGroupCatalog, loadLibraryGroupSidebarWidth, saveLibraryGroupCatalog, saveLibraryGroupSidebarWidth, type LibraryTab } from './libraryCollectionModel';

export function useLibraryShelfGroupState(books: Book[], activeTab: LibraryTab) {
  const [activeShelfGroupId, setActiveShelfGroupId] = useState(allShelfGroupId);
  const [libraryGroupCatalog, setLibraryGroupCatalog] = useState<string[]>(() => loadLibraryGroupCatalog());
  const [shelfGroupsCollapsed, setShelfGroupsCollapsed] = useState(false);
  const [shelfGroupSidebarWidth, setShelfGroupSidebarWidth] = useState(() => loadLibraryGroupSidebarWidth());
  const [expandedShelfGroupIds, setExpandedShelfGroupIds] = useState<string[]>([]);
  const shelfBooks = useMemo(() => books.filter((book) => !book.deleted), [books]);
  const trashBooks = useMemo(() => books.filter((book) => book.deleted), [books]);
  const shelfGroups = useMemo(() => buildShelfGroups(shelfBooks, libraryGroupCatalog), [shelfBooks, libraryGroupCatalog]);
  const groupedShelfBooks = useMemo(() => filterBooksByShelfGroup(shelfBooks, activeShelfGroupId), [shelfBooks, activeShelfGroupId]);

  useEffect(() => { saveLibraryGroupCatalog(libraryGroupCatalog); }, [libraryGroupCatalog]);
  useEffect(() => { saveLibraryGroupSidebarWidth(shelfGroupSidebarWidth); }, [shelfGroupSidebarWidth]);
  useEffect(() => {
    if (activeTab === 'shelf' && !shelfGroups.some((group) => group.id === activeShelfGroupId)) setActiveShelfGroupId(allShelfGroupId);
  }, [activeTab, activeShelfGroupId, shelfGroups]);
  useEffect(() => {
    const validIds = new Set(shelfGroups.map((group) => group.id));
    setExpandedShelfGroupIds((current) => current.filter((groupId) => validIds.has(groupId)));
  }, [shelfGroups]);

  return { activeShelfGroupId, setActiveShelfGroupId, libraryGroupCatalog, setLibraryGroupCatalog, shelfGroupsCollapsed, setShelfGroupsCollapsed, shelfGroupSidebarWidth, setShelfGroupSidebarWidth, expandedShelfGroupIds, setExpandedShelfGroupIds, shelfBooks, trashBooks, shelfGroups, groupedShelfBooks };
}

export type ShelfGroupBook = {
  id: string;
  deleted?: boolean;
  shelfGroups?: string[];
};

export type ShelfGroupEntry = {
  id: string;
  label: string;
  count: number;
  kind: 'all' | 'ungrouped' | 'custom';
};

export const allShelfGroupId = 'all';
export const ungroupedShelfGroupId = 'ungrouped';
const customShelfGroupPrefix = 'custom:';

export function normalizeShelfGroupName(value: string) {
  return value
    .replace(/[\\/|<>:"?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

export function customShelfGroupId(name: string) {
  const normalized = normalizeShelfGroupName(name);
  return normalized ? `${customShelfGroupPrefix}${normalized}` : '';
}

export function shelfGroupNameFromId(groupId: string) {
  return groupId.startsWith(customShelfGroupPrefix) ? normalizeShelfGroupName(groupId.slice(customShelfGroupPrefix.length)) : '';
}

export function normalizeShelfGroups(groups?: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of groups ?? []) {
    const name = normalizeShelfGroupName(raw);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    next.push(name);
  }
  return next;
}

export function buildShelfGroups(books: ShelfGroupBook[], catalogGroups: string[] = []) {
  const shelfBooks = books.filter((book) => !book.deleted);
  const counts = new Map<string, number>();
  for (const group of normalizeShelfGroups(catalogGroups)) counts.set(group, 0);
  let ungroupedCount = 0;
  for (const book of shelfBooks) {
    const groups = normalizeShelfGroups(book.shelfGroups);
    if (!groups.length) {
      ungroupedCount += 1;
      continue;
    }
    for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const customGroups = [...counts.entries()]
    .sort(([leftName, leftCount], [rightName, rightCount]) => rightCount - leftCount || leftName.localeCompare(rightName, 'zh-Hans-CN'))
    .map(([label, count]) => ({ id: customShelfGroupId(label), label, count, kind: 'custom' as const }));
  return [
    { id: allShelfGroupId, label: '全部书籍', count: shelfBooks.length, kind: 'all' as const },
    { id: ungroupedShelfGroupId, label: '未分组', count: ungroupedCount, kind: 'ungrouped' as const },
    ...customGroups,
  ];
}

export function filterBooksByShelfGroup<T extends ShelfGroupBook>(books: T[], groupId: string) {
  const shelfBooks = books.filter((book) => !book.deleted);
  if (!groupId || groupId === allShelfGroupId) return shelfBooks;
  if (groupId === ungroupedShelfGroupId) return shelfBooks.filter((book) => normalizeShelfGroups(book.shelfGroups).length === 0);
  const groupName = shelfGroupNameFromId(groupId);
  if (!groupName) return shelfBooks;
  return shelfBooks.filter((book) => normalizeShelfGroups(book.shelfGroups).includes(groupName));
}

export function addBookToShelfGroup<T extends ShelfGroupBook>(book: T, groupName: string): T {
  const normalized = normalizeShelfGroupName(groupName);
  if (!normalized) return { ...book, shelfGroups: normalizeShelfGroups(book.shelfGroups) };
  const groups = normalizeShelfGroups(book.shelfGroups);
  return groups.includes(normalized) ? { ...book, shelfGroups: groups } : { ...book, shelfGroups: [...groups, normalized] };
}

export function removeBookFromShelfGroup<T extends ShelfGroupBook>(book: T, groupName: string): T {
  const normalized = normalizeShelfGroupName(groupName);
  return { ...book, shelfGroups: normalizeShelfGroups(book.shelfGroups).filter((group) => group !== normalized) };
}

export function renameShelfGroup<T extends ShelfGroupBook>(books: T[], catalogGroups: string[], oldName: string, newName: string) {
  const from = normalizeShelfGroupName(oldName);
  const to = normalizeShelfGroupName(newName);
  if (!from || !to || from === to) return { books, catalogGroups: normalizeShelfGroups(catalogGroups) };
  const nextCatalog = normalizeShelfGroups([...catalogGroups.filter((group) => normalizeShelfGroupName(group) !== from), to]);
  const nextBooks = books.map((book) => {
    const groups = normalizeShelfGroups(book.shelfGroups);
    if (!groups.includes(from)) return { ...book, shelfGroups: groups };
    return { ...book, shelfGroups: normalizeShelfGroups(groups.map((group) => group === from ? to : group)) };
  });
  return { books: nextBooks, catalogGroups: nextCatalog };
}

export function deleteShelfGroup<T extends ShelfGroupBook>(books: T[], catalogGroups: string[], groupName: string) {
  const target = normalizeShelfGroupName(groupName);
  if (!target) return { books, catalogGroups: normalizeShelfGroups(catalogGroups) };
  return {
    books: books.map((book) => removeBookFromShelfGroup(book, target)),
    catalogGroups: normalizeShelfGroups(catalogGroups).filter((group) => group !== target),
  };
}

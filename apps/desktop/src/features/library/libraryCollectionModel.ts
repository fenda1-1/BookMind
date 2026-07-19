import type { Locale, Translator } from '../../i18n';
import { formatAppDateTime } from '../../app/platform';
import type { Book, BookIndexManifest, EditableBook } from '../../types';
import { normalizeShelfGroupName } from './libraryShelfGroups';

export type LibraryBookDropPlacement = 'before' | 'after';
export type LibraryTab = 'shelf' | 'trash';
export type SortMode = 'manual' | 'recent' | 'title' | 'progress' | 'trashExpiry';
export type FilterMode = 'all' | 'unread' | 'reading' | 'done';
export type BatchCoverTone = 'keep' | EditableBook['coverTone'];
export type BatchReadingStatus = 'keep' | 'unread' | 'reading' | 'done';
export type LibraryToolbarPopover = 'sort' | 'filter' | 'import' | null;
export type LibraryTabPreferences = Record<LibraryTab, { sortMode: SortMode; filterMode: FilterMode }>;
export type LibraryReadingStatus = 'trashed' | 'unread' | 'reading' | 'done';
export type LibraryIndexStatus = 'ready' | 'building' | 'stale' | 'failed' | 'missing' | 'waiting';
export type DerivedLibraryBookStatus = { readingStatus: LibraryReadingStatus; indexStatus: LibraryIndexStatus; chunkCount: number };

const DAY_MILLIS = 24 * 60 * 60 * 1000;
const libraryGroupCatalogStorageKey = 'bookmind:library-shelf-groups:v1';
const libraryGroupSidebarWidthStorageKey = 'bookmind:library-shelf-group-width:v1';
const libraryBookOrderStorageKey = 'bookmind:library-book-order:v1';
const libraryGroupSidebarWidthMin = 160;
const libraryGroupSidebarWidthMax = 360;

export function filterAndSortBooks(books: Book[], query: string, filterMode: FilterMode, sortMode: SortMode, activeTab: LibraryTab, manualOrder: string[], getIndexManifest: (book: Book) => BookIndexManifest | null, t: Translator) {
  const normalized = query.trim().toLowerCase();
  const manualRank = new Map(manualOrder.map((bookId, index) => [bookId, index]));
  return books
    .filter((book) => {
      const status = deriveLibraryBookStatus(book, getIndexManifest(book));
      const searchable = `${book.displayTitle} ${book.title} ${book.author} ${book.fileName} ${book.status} ${readingStatusLabel(status, t)} ${indexStatusLabel(status, t)}`.toLowerCase();
      return !normalized || searchable.includes(normalized);
    })
    .filter((book) => activeTab === 'trash' || filterMode === 'all' || deriveLibraryBookStatus(book, getIndexManifest(book)).readingStatus === filterMode)
    .sort((left, right) => {
      if (activeTab === 'shelf' && sortMode === 'manual') {
        const leftRank = manualRank.get(left.id);
        const rightRank = manualRank.get(right.id);
        if (leftRank !== undefined || rightRank !== undefined) return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
      }
      return sortMode === 'title' ? left.displayTitle.localeCompare(right.displayTitle) : sortMode === 'progress' ? right.progress - left.progress : sortMode === 'trashExpiry' ? Number(left.deletedAt || 0) - Number(right.deletedAt || 0) : Number(right.importedAt || 0) - Number(left.importedAt || 0);
    });
}

export function buildLibraryBookOrderAfterMove(visibleBookIds: string[], storedOrder: string[], draggedId: string, targetId: string, placement: LibraryBookDropPlacement) {
  const visibleSet = new Set(visibleBookIds);
  const orderedVisibleIds = reorderLibraryBookIds(visibleBookIds, draggedId, targetId, placement);
  const storedHiddenIds = storedOrder.filter((bookId) => !visibleSet.has(bookId));
  return [...orderedVisibleIds, ...storedHiddenIds].filter((bookId, index, list) => bookId && list.indexOf(bookId) === index);
}

export function reorderLibraryBookIds(bookIds: string[], draggedId: string, targetId: string, placement: LibraryBookDropPlacement) {
  if (!draggedId || !targetId || draggedId === targetId) return bookIds;
  const withoutDragged = bookIds.filter((bookId) => bookId !== draggedId);
  const targetIndex = withoutDragged.indexOf(targetId);
  if (targetIndex < 0) return bookIds;
  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  return [...withoutDragged.slice(0, insertIndex), draggedId, ...withoutDragged.slice(insertIndex)];
}

export function createLibraryTabPreferences(sortMode: SortMode, filterMode: FilterMode): LibraryTabPreferences {
  return { shelf: { sortMode, filterMode }, trash: { sortMode: sortMode === 'trashExpiry' ? sortMode : 'trashExpiry', filterMode: 'all' } };
}

export function trashRemaining(book: Book, now: number, retentionDays: number, t: Translator) {
  const totalMinutes = Math.ceil(trashRemainingMillis(book, now, retentionDays) / 60_000);
  if (totalMinutes <= 1) return t('library.trash.expiredSoon');
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t('library.trash.daysHours', { days, hours });
  if (hours > 0) return t('library.trash.hoursMinutes', { hours, minutes });
  return t('library.trash.minutes', { minutes });
}

export function trashRemainingMillis(book: Book, now: number, retentionDays: number) {
  const deletedAt = Number(book.deletedAt || now);
  return Math.max(0, deletedAt + retentionDays * DAY_MILLIS - now);
}

export function deriveLibraryBookStatus(book: Book, indexManifest?: BookIndexManifest | null): DerivedLibraryBookStatus {
  const readingStatus: LibraryReadingStatus = book.deleted ? 'trashed' : book.progress >= 100 ? 'done' : book.progress > 0 ? 'reading' : 'unread';
  const chunkCount = indexManifest?.chunkCount ?? book.chunks.length;
  let indexStatus: LibraryIndexStatus = 'missing';
  if (indexManifest?.status === 'ready' && chunkCount > 0) indexStatus = 'ready';
  else if (indexManifest?.status === 'building') indexStatus = 'building';
  else if (indexManifest?.status === 'stale') indexStatus = 'stale';
  else if (indexManifest?.status === 'failed') indexStatus = 'failed';
  else if (indexManifest?.status === 'missing') indexStatus = 'missing';
  else if (book.chunks.length > 0) indexStatus = 'ready';
  else if (book.status.includes('等待') || book.status.includes('解析')) indexStatus = 'waiting';
  return { readingStatus, indexStatus, chunkCount };
}

export function readingStatusLabel(status: DerivedLibraryBookStatus, t: Translator) {
  if (status.readingStatus === 'trashed') return t('library.status.trashed');
  if (status.readingStatus === 'done') return t('library.status.done');
  if (status.readingStatus === 'reading') return t('library.status.reading');
  return t('library.status.unread');
}

export function progressForBatchReadingStatus(status: Exclude<BatchReadingStatus, 'keep'>) {
  if (status === 'done') return 100;
  if (status === 'reading') return 50;
  return 0;
}

export function indexStatusLabel(status: DerivedLibraryBookStatus, t: Translator) {
  if (status.indexStatus === 'ready') return t('library.indexStatus.ready');
  if (status.indexStatus === 'building') return t('library.indexStatus.building');
  if (status.indexStatus === 'stale') return t('library.indexStatus.stale');
  if (status.indexStatus === 'failed') return t('library.indexStatus.failed');
  if (status.indexStatus === 'waiting') return t('library.indexStatus.waiting');
  return t('library.indexStatus.missing');
}

export function formatTimestamp(value: string, locale: Locale) {
  return formatAppDateTime(value, locale);
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function coverLabelForTone(tone: EditableBook['coverTone']) {
  if (tone === 'indigo') return 'AI';
  if (tone === 'sage') return '阅';
  if (tone === 'violet') return '知';
  if (tone === 'cinnabar') return '斩';
  return 'TXT';
}

export function mergeBookSourceCandidates<T extends { sourceId: string; bookUrl: string }>(candidates: T[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (!candidate.sourceId || !candidate.bookUrl) return false;
    const key = `${candidate.sourceId}\n${candidate.bookUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeLibrarySourceMatchText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[《》〈〉「」『』【】\[\]（）()·\s_\-:：,，.。]/g, '').replace(/(最新章节|全文阅读|免费阅读|免费小说|小说免费|在线阅读|阅读|漫画|小说|txt|book)$/gi, '').trim();
}

export function loadLibraryGroupCatalog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(libraryGroupCatalogStorageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.map((item) => normalizeShelfGroupName(String(item))).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveLibraryGroupCatalog(groups: string[]) {
  try {
    localStorage.setItem(libraryGroupCatalogStorageKey, JSON.stringify(Array.from(new Set(groups.map(normalizeShelfGroupName).filter(Boolean)))));
  } catch {
    // Book-level group membership remains available when view preference storage fails.
  }
}

export function loadLibraryBookOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem(libraryBookOrderStorageKey) ?? '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([groupId, value]) => [groupId, Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []]).filter(([groupId]) => groupId));
  } catch {
    return {};
  }
}

export function saveLibraryBookOrder(order: Record<string, string[]>) {
  try {
    const compact = Object.fromEntries(Object.entries(order).map(([groupId, bookIds]) => [groupId, Array.from(new Set(bookIds.filter(Boolean)))]).filter(([, bookIds]) => bookIds.length > 0));
    localStorage.setItem(libraryBookOrderStorageKey, JSON.stringify(compact));
  } catch {
    // Sorting is a view preference; losing it must not block library operations.
  }
}

export function clampLibraryGroupSidebarWidth(width: number) {
  return Math.min(libraryGroupSidebarWidthMax, Math.max(libraryGroupSidebarWidthMin, Math.round(width)));
}

export function loadLibraryGroupSidebarWidth() {
  try {
    const parsed = Number.parseInt(localStorage.getItem(libraryGroupSidebarWidthStorageKey) ?? '', 10);
    return Number.isFinite(parsed) ? clampLibraryGroupSidebarWidth(parsed) : 220;
  } catch {
    return 220;
  }
}

export function saveLibraryGroupSidebarWidth(width: number) {
  try {
    localStorage.setItem(libraryGroupSidebarWidthStorageKey, String(clampLibraryGroupSidebarWidth(width)));
  } catch {
    // Width persistence is only a UI convenience.
  }
}

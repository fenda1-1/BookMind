import type { ReaderBookmark, ReaderHighlightColor, ReaderHighlightImportance, ReaderHighlightReviewStatus } from '../../../types';
import { getReaderSearchPinyinInitials, normalizeReaderSearchText } from '../readerSearchModel.js';
import type { ReaderHighlightFilter, ReaderHighlightGroup, ReaderHighlightRange, ReaderHighlightSortKey } from './types.js';

export function updateReaderHighlightColor<T extends { id: string; color?: ReaderHighlightColor }>(highlights: T[], id: string, color: ReaderHighlightColor): T[] {
  return highlights.map((highlight) => highlight.id === id ? { ...highlight, color } : highlight);
}

export function updateReaderHighlightNote<T extends { id: string; note: string }>(highlights: T[], id: string, note: string): T[] {
  return highlights.map((highlight) => highlight.id === id ? { ...highlight, note } : highlight);
}

export function shouldCreateReaderAnnotationFromNote(note: string, allowEmptyNotes: boolean) {
  return allowEmptyNotes || note.trim().length > 0;
}

export function updateReaderHighlightDetails<T extends { id: string; tags?: string[]; importance?: ReaderHighlightImportance; reviewStatus?: ReaderHighlightReviewStatus; colorMeaning?: string; updatedAt?: string }>(highlights: T[], id: string, updates: { tags?: string[]; importance?: ReaderHighlightImportance; reviewStatus?: ReaderHighlightReviewStatus; colorMeaning?: string; updatedAt?: string }): T[] {
  return highlights.map((highlight) => highlight.id === id ? { ...highlight, ...updates } : highlight);
}

export function deleteReaderHighlight<T extends { id: string }>(highlights: T[], id: string): T[] {
  return highlights.filter((highlight) => highlight.id !== id);
}

export function resolveReaderHighlightColor(requested: ReaderHighlightColor | undefined, fallback: ReaderHighlightColor) {
  return requested ?? fallback;
}

export function getReaderHighlightIndexKey(chapterIndex: number, paragraphIndex: number) {
  return `${chapterIndex}:${paragraphIndex}`;
}

export function createReaderHighlightIndex<T extends ReaderHighlightRange>(highlights: T[]) {
  const index = new Map<string, T[]>();
  for (const highlight of highlights) {
    const key = getReaderHighlightIndexKey(highlight.chapterIndex, highlight.paragraphIndex);
    const bucket = index.get(key);
    if (bucket) bucket.push(highlight);
    else index.set(key, [highlight]);
  }
  index.forEach((bucket) => {
    bucket.sort((left, right) =>
      left.startOffset - right.startOffset
      || left.endOffset - right.endOffset
      || left.text.localeCompare(right.text)
    );
  });
  return index;
}

export function groupReaderHighlightsByChapter<T extends ReaderHighlightRange>(highlights: T[]): ReaderHighlightGroup<T>[] {
  const groups = new Map<number, T[]>();
  // Filtering may already have applied a user-selected sort; grouping must not restore reading order.
  for (const highlight of highlights) {
    const bucket = groups.get(highlight.chapterIndex);
    if (bucket) bucket.push(highlight);
    else groups.set(highlight.chapterIndex, [highlight]);
  }
  return [...groups.entries()].map(([chapterIndex, items]) => ({ chapterIndex, items }));
}

export function filterReaderHighlights<T extends ReaderHighlightRange>(highlights: T[], filter: ReaderHighlightFilter): T[] {
  const keyword = normalizeReaderSearchText(filter.query ?? '', { normalizeNfkc: filter.normalizeNfkc, normalizeTraditionalChinese: filter.normalizeTraditionalChinese });
  const chapterRange = new Set(filter.chapterRange ?? []);
  const tagKeyword = filter.tag && filter.tag !== 'all' ? normalizeReaderSearchText(filter.tag, { normalizeNfkc: filter.normalizeNfkc, normalizeTraditionalChinese: filter.normalizeTraditionalChinese }) : '';
  const pinyinKeyword = keyword.replace(/\s+/g, '');
  const canMatchPinyin = filter.pinyinInitials !== false && /^[a-z0-9]+$/i.test(pinyinKeyword);
  return highlights.filter((highlight) => {
    const colorMatches = !filter.color || filter.color === 'all' || (highlight.color ?? 'yellow') === filter.color;
    const chapterMatches = filter.chapterIndex === undefined || filter.chapterIndex === 'all' || highlight.chapterIndex === (filter.chapterIndex as number);
    const chapterRangeMatches = chapterRange.size === 0 || chapterRange.has(highlight.chapterIndex);
    const noteMatches = filter.hasNote === undefined || filter.hasNote === 'all' || Boolean(highlight.note.trim()) === filter.hasNote;
    const importanceMatches = !filter.importance || filter.importance === 'all' || (highlight.importance ?? 'normal') === filter.importance;
    const reviewMatches = !filter.reviewStatus || filter.reviewStatus === 'all' || (highlight.reviewStatus ?? 'new') === filter.reviewStatus;
    const tagMatches = !tagKeyword || (highlight.tags ?? []).some((tag) => normalizeReaderSearchText(tag, { normalizeNfkc: filter.normalizeNfkc, normalizeTraditionalChinese: filter.normalizeTraditionalChinese }) === tagKeyword);
    const scope = filter.queryScope ?? 'all';
    const chapterTitle = filter.chapterTitles?.get(highlight.chapterIndex) ?? '';
    const rawHaystack = scope === 'text'
      ? highlight.text
      : scope === 'note'
        ? highlight.note
        : scope === 'context'
          ? `${highlight.prefixText ?? ''} ${highlight.text} ${highlight.suffixText ?? ''}`
          : `${chapterTitle} ${highlight.text} ${highlight.note} ${(highlight.tags ?? []).join(' ')} ${highlight.prefixText ?? ''} ${highlight.suffixText ?? ''}`;
    const haystack = normalizeReaderSearchText(rawHaystack, { normalizeNfkc: filter.normalizeNfkc, normalizeTraditionalChinese: filter.normalizeTraditionalChinese });
    const queryMatches = !keyword
      || haystack.includes(keyword)
      || (canMatchPinyin && getReaderSearchPinyinInitials(rawHaystack, { normalizeNfkc: filter.normalizeNfkc, normalizeTraditionalChinese: filter.normalizeTraditionalChinese }).includes(pinyinKeyword));
    return colorMatches && chapterMatches && chapterRangeMatches && noteMatches && importanceMatches && reviewMatches && tagMatches && queryMatches;
  });
}

export function sortReaderHighlights<T extends ReaderHighlightRange & { createdAt?: string; updatedAt?: string }>(highlights: T[], sortKey: ReaderHighlightSortKey): T[] {
  const ordered = [...highlights];
  const readingOrder = (left: T, right: T) =>
    left.chapterIndex - right.chapterIndex
    || left.paragraphIndex - right.paragraphIndex
    || left.startOffset - right.startOffset
    || left.endOffset - right.endOffset;
  const time = (value?: string) => {
    const parsed = Date.parse(value ?? '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  ordered.sort((left, right) => {
    if (sortKey === 'created-asc') return time(left.createdAt) - time(right.createdAt) || readingOrder(left, right);
    if (sortKey === 'created-desc') return time(right.createdAt) - time(left.createdAt) || readingOrder(left, right);
    if (sortKey === 'updated-desc') return time(right.updatedAt ?? right.createdAt) - time(left.updatedAt ?? left.createdAt) || readingOrder(left, right);
    if (sortKey === 'text-length-asc') return left.text.length - right.text.length || readingOrder(left, right);
    if (sortKey === 'text-length-desc') return right.text.length - left.text.length || readingOrder(left, right);
    if (sortKey === 'color-asc') return (left.color ?? 'yellow').localeCompare(right.color ?? 'yellow') || readingOrder(left, right);
    if (sortKey === 'note-first') return Number(Boolean(right.note.trim())) - Number(Boolean(left.note.trim())) || readingOrder(left, right);
    return readingOrder(left, right);
  });
  return ordered;
}

export function createReaderBookmark(bookId: string, chapterIndex: number, paragraphIndex: number, screenPage: number, label: string, createdAt: string, metadata: Partial<ReaderBookmark> = {}): ReaderBookmark {
  const createdToken = createdAt.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+$/g, '');
  return {
    ...metadata,
    id: `reader-bookmark-${bookId}-${chapterIndex}-${paragraphIndex}-${screenPage}-${createdToken}`,
    bookId,
    chapterIndex,
    paragraphIndex,
    screenPage,
    label,
    createdAt,
  };
}

export function updateReaderBookmarkDetails<T extends { id: string; label: string; title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }>(bookmarks: T[], id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }): T[] {
  return bookmarks.map((bookmark) => {
    if (bookmark.id !== id) return bookmark;
    const title = updates.title?.trim() ?? bookmark.title ?? '';
    return {
      ...bookmark,
      ...updates,
      title,
      label: title || bookmark.label,
      tags: updates.tags ?? bookmark.tags,
    };
  });
}

export function deleteReaderBookmark<T extends { id: string }>(bookmarks: T[], id: string): T[] {
  return bookmarks.filter((bookmark) => bookmark.id !== id);
}

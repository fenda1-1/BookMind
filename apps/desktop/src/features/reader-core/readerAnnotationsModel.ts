import type { ReaderBookmark } from '../../types';
import type { ReaderChapter, ReaderHighlightRange } from './readerModel.js';

export type ReaderAnnotationsPayload<T extends ReaderHighlightRange = ReaderHighlightRange, B extends ReaderBookmark = ReaderBookmark> = {
  schemaVersion: number;
  exportedAt: string;
  highlights: T[];
  bookmarks: B[];
};

export type ReaderAnnotationExportContent = 'highlights' | 'bookmarks' | 'notes' | 'all';

export type ReaderAnnotationsImportResult<T extends ReaderHighlightRange = ReaderHighlightRange, B extends ReaderBookmark = ReaderBookmark> =
  | { schemaVersion: number; highlights: T[]; bookmarks: B[]; error?: undefined }
  | { schemaVersion: number; highlights: T[]; bookmarks: B[]; error: 'invalid-json' | 'invalid-shape' };

export type ReaderAnnotationsImportPreview = {
  highlights: { added: number; updated: number; duplicates: number; unresolved: number };
  bookmarks: { added: number; updated: number; duplicates: number; unresolved: number };
};

export function formatReaderHighlightsMarkdown(bookTitle: string, chapters: ReaderChapter[], highlights: ReaderHighlightRange[]) {
  const title = bookTitle.trim() || 'BookMind Highlights';
  const groups = groupReaderHighlightsByChapterForExport(highlights);
  const lines = [`# ${title}`, ''];
  for (const group of groups) {
    const chapter = chapters.find((item) => item.index === group.chapterIndex);
    lines.push(`## ${chapter?.title ?? `Chapter ${group.chapterIndex + 1}`}`, '');
    for (const highlight of group.items) {
      lines.push(`- [${highlight.color ?? 'yellow'}] ${highlight.text}`);
      if (highlight.note.trim()) lines.push(`  - ${highlight.note.trim()}`);
      if (highlight.prefixText || highlight.suffixText) lines.push(`  - Context: ${highlight.prefixText ?? ''}[${highlight.text}]${highlight.suffixText ?? ''}`);
      lines.push(`  - Location: reader://${highlight.chapterIndex}/${highlight.paragraphIndex}?start=${highlight.startOffset}&end=${highlight.endOffset}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export function formatReaderAnnotationsMarkdown(bookTitle: string, chapters: ReaderChapter[], highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[], options: { template?: string } = {}) {
  const title = bookTitle.trim() || 'BookMind Annotations';
  const lines = [`# ${title}`, '', '## Highlights', ''];
  const highlightMarkdown = formatReaderHighlightsMarkdown(title, chapters, highlights).split('\n').slice(2).join('\n').trim();
  const bookmarkMarkdown = formatReaderAnnotationBookmarksMarkdown(chapters, bookmarks);
  if (options.template?.trim()) {
    return applyReaderAnnotationMarkdownTemplate(options.template, {
      bookTitle: title,
      exportedAt: new Date().toISOString(),
      highlights: highlightMarkdown || '_No highlights._',
      bookmarks: bookmarkMarkdown || '_No bookmarks._',
    });
  }
  lines.push(highlightMarkdown || '_No highlights._', '', '## Bookmarks', '');
  lines.push(bookmarkMarkdown || '_No bookmarks._');
  return lines.join('\n').trimEnd();
}

function formatReaderAnnotationBookmarksMarkdown(chapters: ReaderChapter[], bookmarks: ReaderBookmark[]) {
  const lines: string[] = [];
  bookmarks.forEach((bookmark) => {
    const chapter = chapters.find((item) => item.index === bookmark.chapterIndex);
    lines.push(`- ${bookmark.label} (${chapter?.title ?? `Chapter ${bookmark.chapterIndex + 1}`} · p${bookmark.screenPage + 1})`);
  });
  return lines.join('\n').trimEnd();
}

function applyReaderAnnotationMarkdownTemplate(template: string, values: Record<'bookTitle' | 'exportedAt' | 'highlights' | 'bookmarks', string>) {
  return template
    .replaceAll('{bookTitle}', values.bookTitle)
    .replaceAll('{exportedAt}', values.exportedAt)
    .replaceAll('{highlights}', values.highlights)
    .replaceAll('{bookmarks}', values.bookmarks)
    .trimEnd();
}

export function filterReaderAnnotationExportContent<T extends ReaderHighlightRange, B extends ReaderBookmark>(annotations: { highlights: T[]; bookmarks: B[] }, content: ReaderAnnotationExportContent): { highlights: T[]; bookmarks: B[] } {
  if (content === 'highlights') return { highlights: annotations.highlights, bookmarks: [] };
  if (content === 'bookmarks') return { highlights: [], bookmarks: annotations.bookmarks };
  if (content === 'notes') {
    return {
      highlights: annotations.highlights.filter((highlight) => highlight.note.trim()),
      bookmarks: annotations.bookmarks.filter((bookmark) => bookmark.note?.trim()),
    };
  }
  return annotations;
}

export const readerAnnotationCsvFields = ['type', 'id', 'chapter', 'text', 'note', 'color', 'createdAt', 'location'] as const;
export type ReaderAnnotationCsvField = typeof readerAnnotationCsvFields[number];

export function formatReaderAnnotationsCsv(chapters: ReaderChapter[], highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[], options: { fields?: ReaderAnnotationCsvField[] } = {}) {
  const selectedFields = normalizeReaderAnnotationCsvFields(options.fields);
  const rows: string[][] = [selectedFields];
  highlights.forEach((highlight) => {
    const chapter = chapters.find((item) => item.index === highlight.chapterIndex);
    const row: Record<ReaderAnnotationCsvField, string> = {
      type: 'highlight',
      id: highlight.id ?? '',
      chapter: chapter?.title ?? `Chapter ${highlight.chapterIndex + 1}`,
      text: highlight.text,
      note: highlight.note,
      color: highlight.color ?? 'yellow',
      createdAt: 'createdAt' in highlight && typeof highlight.createdAt === 'string' ? highlight.createdAt : '',
      location: `${highlight.chapterIndex}:${highlight.paragraphIndex}:${highlight.startOffset}-${highlight.endOffset}`,
    };
    rows.push(selectedFields.map((field) => row[field]));
  });
  bookmarks.forEach((bookmark) => {
    const chapter = chapters.find((item) => item.index === bookmark.chapterIndex);
    const row: Record<ReaderAnnotationCsvField, string> = {
      type: 'bookmark',
      id: bookmark.id,
      chapter: chapter?.title ?? `Chapter ${bookmark.chapterIndex + 1}`,
      text: bookmark.label,
      note: bookmark.note ?? '',
      color: bookmark.color ?? '',
      createdAt: bookmark.createdAt,
      location: `${bookmark.chapterIndex}:${bookmark.paragraphIndex}:page-${bookmark.screenPage}`,
    };
    rows.push(selectedFields.map((field) => row[field]));
  });
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

function normalizeReaderAnnotationCsvFields(fields: ReaderAnnotationCsvField[] | undefined) {
  if (!Array.isArray(fields)) return [...readerAnnotationCsvFields];
  const selected = readerAnnotationCsvFields.filter((field) => fields.includes(field));
  return selected.length ? selected : [...readerAnnotationCsvFields];
}

export function formatReaderHighlightsAnkiCsv(chapters: ReaderChapter[], highlights: ReaderHighlightRange[], defaultTags = 'bookmind') {
  const rows = [['front', 'back', 'tags']];
  const normalizedDefaultTags = normalizeReaderExportTags(defaultTags);
  highlights.forEach((highlight) => {
    const chapter = chapters.find((item) => item.index === highlight.chapterIndex);
    rows.push([
      highlight.text,
      highlight.note.trim() || `${chapter?.title ?? `Chapter ${highlight.chapterIndex + 1}`} · ${highlight.color ?? 'yellow'}`,
      `${normalizedDefaultTags} ${highlight.color ?? 'yellow'}`.trim(),
    ]);
  });
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

function normalizeReaderExportTags(value: string) {
  return value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean).join(' ') || 'bookmind';
}

export function formatReaderAnnotationsObsidianMarkdown(bookTitle: string, chapters: ReaderChapter[], highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[], options: { wikiLinks?: boolean } = {}) {
  const title = bookTitle.trim() || 'BookMind Annotations';
  const useWikiLinks = options.wikiLinks ?? true;
  const formatChapterLink = (chapter: string) => useWikiLinks ? `[[${chapter}]]` : chapter;
  const lines = ['---', `book: ${title}`, 'source: BookMind', `exportedAt: ${new Date().toISOString()}`, '---', '', `# ${title}`, ''];
  const grouped = groupReaderHighlightsByChapterForExport(highlights);
  grouped.forEach((group) => {
    const chapter = getReaderAnnotationChapterLabel(chapters, group.chapterIndex);
    lines.push(`## ${formatChapterLink(chapter)}`, '');
    group.items.forEach((highlight) => {
      lines.push(`> ${highlight.text}`);
      if (highlight.note.trim()) lines.push(`- note: ${highlight.note.trim()}`);
      lines.push(`- color: ${highlight.color ?? 'yellow'}`);
      lines.push(`- location: reader://${highlight.chapterIndex}/${highlight.paragraphIndex}?start=${highlight.startOffset}&end=${highlight.endOffset}`);
      lines.push('');
    });
  });
  if (bookmarks.length) {
    lines.push('## Bookmarks', '');
    bookmarks.forEach((bookmark) => {
      lines.push(`- ${formatChapterLink(getReaderAnnotationChapterLabel(chapters, bookmark.chapterIndex))} ${bookmark.label}`);
    });
  }
  return lines.join('\n').trimEnd();
}

export function formatReaderAnnotationsLogseqMarkdown(bookTitle: string, chapters: ReaderChapter[], highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[], options: { propertyFormat?: boolean } = {}) {
  const title = bookTitle.trim() || 'BookMind Annotations';
  const usePropertyFormat = options.propertyFormat !== false;
  if (!usePropertyFormat) {
    const lines = [`- Book: ${title}`, '- Exported by: BookMind'];
    groupReaderHighlightsByChapterForExport(highlights).forEach((group) => {
      lines.push(`- Chapter: ${getReaderAnnotationChapterLabel(chapters, group.chapterIndex)}`);
      group.items.forEach((highlight) => {
        lines.push(`\t- Highlight: ${highlight.text}`);
        if (highlight.note.trim()) lines.push(`\t\t- Note: ${highlight.note.trim()}`);
        lines.push(`\t\t- Color: ${highlight.color ?? 'yellow'}`);
        lines.push(`\t\t- Location: reader://${highlight.chapterIndex}/${highlight.paragraphIndex}?start=${highlight.startOffset}&end=${highlight.endOffset}`);
      });
    });
    if (bookmarks.length) {
      lines.push('- Bookmarks');
      bookmarks.forEach((bookmark) => {
        lines.push(`\t- Bookmark: ${bookmark.label}`);
        lines.push(`\t\t- Chapter: ${getReaderAnnotationChapterLabel(chapters, bookmark.chapterIndex)}`);
      });
    }
    return lines.join('\n');
  }
  const lines = [`- book:: ${title}`, `- exported-by:: BookMind`];
  groupReaderHighlightsByChapterForExport(highlights).forEach((group) => {
    lines.push(`- chapter:: ${getReaderAnnotationChapterLabel(chapters, group.chapterIndex)}`);
    group.items.forEach((highlight) => {
      lines.push(`\t- highlight:: ${highlight.text}`);
      if (highlight.note.trim()) lines.push(`\t\t- note:: ${highlight.note.trim()}`);
      lines.push(`\t\t- color:: ${highlight.color ?? 'yellow'}`);
      lines.push(`\t\t- location:: reader://${highlight.chapterIndex}/${highlight.paragraphIndex}?start=${highlight.startOffset}&end=${highlight.endOffset}`);
    });
  });
  if (bookmarks.length) {
    lines.push('- bookmarks');
    bookmarks.forEach((bookmark) => {
      lines.push(`\t- bookmark:: ${bookmark.label}`);
      lines.push(`\t\t- chapter:: ${getReaderAnnotationChapterLabel(chapters, bookmark.chapterIndex)}`);
    });
  }
  return lines.join('\n');
}

export function formatReaderAnnotationsReadwiseCsv(chapters: ReaderChapter[], highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[], bookTitle = 'BookMind Annotations', author = 'BookMind') {
  const title = bookTitle.trim() || 'BookMind Annotations';
  const rows = [['Title', 'Author', 'Category', 'Highlight', 'Note', 'Location', 'Tags']];
  highlights.forEach((highlight) => {
    rows.push([
      title,
      author,
      'books',
      highlight.text,
      highlight.note,
      `${getReaderAnnotationChapterLabel(chapters, highlight.chapterIndex)} ${highlight.paragraphIndex + 1}:${highlight.startOffset}-${highlight.endOffset}`,
      ['bookmind', highlight.color ?? 'yellow'].join(' '),
    ]);
  });
  bookmarks.forEach((bookmark) => {
    rows.push([
      title,
      author,
      'books',
      bookmark.label,
      bookmark.note ?? '',
      `${getReaderAnnotationChapterLabel(chapters, bookmark.chapterIndex)} page ${bookmark.screenPage + 1}`,
      'bookmind bookmark',
    ]);
  });
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function formatReaderAnnotationsJson<T extends ReaderHighlightRange, B extends ReaderBookmark>(payload: { highlights: T[]; bookmarks: B[] }) {
  return serializeReaderAnnotationsJson(payload);
}

export function previewReaderAnnotationsImport<T extends ReaderHighlightRange & { id?: string }, B extends ReaderBookmark>(current: { highlights: T[]; bookmarks: B[] }, incoming: { highlights: T[]; bookmarks: B[] }, chapters: ReaderChapter[] = []): ReaderAnnotationsImportPreview {
  return {
    highlights: { ...previewById(current.highlights, incoming.highlights), unresolved: countUnresolvedHighlightImports(incoming.highlights, chapters) },
    bookmarks: { ...previewById(current.bookmarks, incoming.bookmarks), unresolved: countUnresolvedBookmarkImports(incoming.bookmarks, chapters) },
  };
}

export type ReaderAnnotationJsonImportConflictStrategy = 'skip' | 'overwrite' | 'merge';

export function mergeReaderAnnotationsImport<T extends { id: string; tags?: string[] }>(
  current: T[],
  incoming: T[],
  strategy: ReaderAnnotationJsonImportConflictStrategy,
) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    const previous = map.get(item.id);
    if (!previous) {
      map.set(item.id, item);
      return;
    }
    if (strategy === 'skip') return;
    if (strategy === 'overwrite') {
      map.set(item.id, item);
      return;
    }
    map.set(item.id, mergeReaderAnnotationImportItem(previous, item));
  });
  return [...map.values()];
}

function mergeReaderAnnotationImportItem<T extends { tags?: string[] }>(previous: T, incoming: T): T {
  return {
    ...previous,
    ...incoming,
    note: mergeReaderAnnotationTextField((previous as { note?: string }).note, (incoming as { note?: string }).note),
    title: mergeReaderAnnotationTextField((previous as { title?: string }).title, (incoming as { title?: string }).title),
    label: mergeReaderAnnotationTextField((previous as { label?: string }).label, (incoming as { label?: string }).label),
    tags: mergeReaderAnnotationTags(previous.tags, incoming.tags),
  };
}

function mergeReaderAnnotationTextField(previous: string | undefined, incoming: string | undefined) {
  return previous?.trim() ? previous : incoming;
}

function mergeReaderAnnotationTags(previous: string[] | undefined, incoming: string[] | undefined) {
  const tags = [...(previous ?? []), ...(incoming ?? [])].map((tag) => tag.trim()).filter(Boolean);
  return tags.length ? Array.from(new Set(tags)) : undefined;
}

function previewById<T extends { id?: string }>(current: T[], incoming: T[]) {
  const existing = new Map(current.flatMap((item) => item.id ? [[item.id, item] as const] : []));
  const result = { added: 0, updated: 0, duplicates: 0 };
  incoming.forEach((item) => {
    if (!item.id || !existing.has(item.id)) {
      result.added += 1;
      return;
    }
    const previous = existing.get(item.id);
    if (JSON.stringify(previous) === JSON.stringify(item)) result.duplicates += 1;
    else result.updated += 1;
  });
  return result;
}

function countUnresolvedHighlightImports(highlights: ReaderHighlightRange[], chapters: ReaderChapter[]) {
  if (!chapters.length) return 0;
  return highlights.filter((highlight) => {
    const chapter = chapters.find((item) => item.index === highlight.chapterIndex);
    const paragraph = chapter?.paragraphs[highlight.paragraphIndex];
    return typeof paragraph !== 'string' || highlight.startOffset < 0 || highlight.endOffset > paragraph.length || highlight.endOffset <= highlight.startOffset;
  }).length;
}

function countUnresolvedBookmarkImports(bookmarks: ReaderBookmark[], chapters: ReaderChapter[]) {
  if (!chapters.length) return 0;
  return bookmarks.filter((bookmark) => {
    const chapter = chapters.find((item) => item.index === bookmark.chapterIndex);
    return !chapter || bookmark.paragraphIndex < 0 || bookmark.paragraphIndex >= chapter.paragraphs.length;
  }).length;
}

function escapeCsvCell(value: string) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getReaderAnnotationChapterLabel(chapters: ReaderChapter[], chapterIndex: number) {
  return chapters.find((item) => item.index === chapterIndex)?.title ?? `Chapter ${chapterIndex + 1}`;
}

export function serializeReaderAnnotationsJson<T extends ReaderHighlightRange, B extends ReaderBookmark>({ highlights, bookmarks }: { highlights: T[]; bookmarks: B[] }) {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    highlights,
    bookmarks,
  } satisfies ReaderAnnotationsPayload<T, B>, null, 2);
}

export function deserializeReaderAnnotationsJson<T extends ReaderHighlightRange = ReaderHighlightRange, B extends ReaderBookmark = ReaderBookmark>(raw: string): ReaderAnnotationsImportResult<T, B> {
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderAnnotationsPayload<T, B>>;
    if (!parsed || !Array.isArray(parsed.highlights) || !Array.isArray(parsed.bookmarks)) {
      return { schemaVersion: 1, highlights: [], bookmarks: [], error: 'invalid-shape' };
    }
    return {
      schemaVersion: Number(parsed.schemaVersion ?? 1),
      highlights: parsed.highlights.filter(isReaderHighlightShape),
      bookmarks: parsed.bookmarks.filter(isReaderBookmarkShape),
    };
  } catch {
    return { schemaVersion: 1, highlights: [], bookmarks: [], error: 'invalid-json' };
  }
}

function isReaderHighlightShape<T extends ReaderHighlightRange>(value: unknown): value is T {
  const item = value as Partial<ReaderHighlightRange> | null;
  return Boolean(item)
    && typeof item?.chapterIndex === 'number'
    && typeof item.paragraphIndex === 'number'
    && typeof item.startOffset === 'number'
    && typeof item.endOffset === 'number'
    && typeof item.text === 'string'
    && typeof item.note === 'string';
}

function isReaderBookmarkShape<B extends ReaderBookmark>(value: unknown): value is B {
  const item = value as Partial<ReaderBookmark> | null;
  return Boolean(item)
    && typeof item?.id === 'string'
    && typeof item.bookId === 'string'
    && typeof item.chapterIndex === 'number'
    && typeof item.paragraphIndex === 'number'
    && typeof item.screenPage === 'number'
    && typeof item.label === 'string'
    && typeof item.createdAt === 'string';
}

function groupReaderHighlightsByChapterForExport<T extends ReaderHighlightRange>(highlights: T[]) {
  const groups = new Map<number, T[]>();
  const ordered = [...highlights].sort((left, right) =>
    left.chapterIndex - right.chapterIndex
    || left.paragraphIndex - right.paragraphIndex
    || left.startOffset - right.startOffset
    || left.endOffset - right.endOffset
  );
  for (const highlight of ordered) {
    const bucket = groups.get(highlight.chapterIndex);
    if (bucket) bucket.push(highlight);
    else groups.set(highlight.chapterIndex, [highlight]);
  }
  return [...groups.entries()].map(([chapterIndex, items]) => ({ chapterIndex, items }));
}

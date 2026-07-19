import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { ReaderBookmark, ReaderHighlightColor, ReaderSettings } from '../../types';
import { computeReaderProgress, getVirtualParagraphRange } from './readerModel';
import type { ReaderChapter, ReaderHighlightRange, ReaderSearchScope } from './readerModel';

export const readerHighlightColors: ReaderHighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'violet', 'red'];

export type ReaderBookmarkGroupMode = 'none' | 'chapter' | 'created' | 'tag';

export type VirtualListWindow<T> = { items: T[]; start: number; end: number; before: number; after: number };

export type ReaderAnnotationExportChoice = 'highlights' | 'json' | 'markdown' | 'csv' | 'anki' | 'obsidian' | 'logseq' | 'readwise' | 'backup';

export function createVirtualListWindow<T>(items: T[], activeIndex = 0, radius = 80): VirtualListWindow<T> {
  const range = getVirtualParagraphRange(items.length, activeIndex, radius);
  return { items: items.slice(range.start, range.end), start: range.start, end: range.end, before: range.before, after: range.after };
}

export function groupReaderBookmarks(bookmarks: ReaderBookmark[], mode: ReaderBookmarkGroupMode, chapters: ReaderChapter[]) {
  if (mode === 'none') return [{ key: 'all', label: '', items: bookmarks }];
  const groups = new Map<string, { key: string; label: string; items: ReaderBookmark[] }>();
  const add = (key: string, label: string, bookmark: ReaderBookmark) => {
    const existing = groups.get(key) ?? { key, label, items: [] };
    existing.items.push(bookmark);
    groups.set(key, existing);
  };
  bookmarks.forEach((bookmark) => {
    if (mode === 'chapter') {
      const chapter = chapters.find((item) => item.index === bookmark.chapterIndex || item.id === bookmark.chapterId);
      add(`chapter-${bookmark.chapterIndex}`, chapter?.title ?? bookmark.label, bookmark);
    } else if (mode === 'created') {
      const day = bookmark.createdAt.slice(0, 10) || 'unknown';
      add(`created-${day}`, day, bookmark);
    } else {
      const tags = bookmark.tags?.length ? bookmark.tags : ['untagged'];
      tags.forEach((tag) => add(`tag-${tag}`, tag, bookmark));
    }
  });
  return [...groups.values()];
}

export function buildReaderAnnotationTagSuggestions(highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[], defaults: string[] = []) {
  const tags = [
    ...highlights.flatMap((highlight) => highlight.tags ?? []),
    ...bookmarks.flatMap((bookmark) => bookmark.tags ?? []),
    ...defaults.flatMap(parseReaderTagInput),
  ];
  return Array.from(new Set(tags.map(normalizeReaderAnnotationTag).filter(Boolean))).slice(0, 40);
}

export function parseReaderTagInput(value: string) {
  return Array.from(new Set(value.split(/[,，]/).map(normalizeReaderAnnotationTag).filter(Boolean)));
}

export function formatReaderTagInput(tags: string[]) {
  return Array.from(new Set(tags.map(normalizeReaderAnnotationTag).filter(Boolean))).join(', ');
}

export function normalizeReaderAnnotationTag(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 40);
}

export function computeReaderPageProgress(input: { layoutMode: ReaderSettings['layoutMode']; activeStreamIndex: number; activeScreenPage: number; pageStreamLength: number; screenPageCount: number }) {
  const total = Math.max(1, input.layoutMode === 'page' && input.pageStreamLength ? input.pageStreamLength : input.screenPageCount);
  const current = Math.min(total, Math.max(1, (input.layoutMode === 'page' && input.pageStreamLength ? input.activeStreamIndex : input.activeScreenPage) + 1));
  return Math.min(100, Math.round((current / total) * 100));
}

export function resolveReaderProgressPercent(mode: ExtendedSettings['readerProgressMode'], input: { chapters: ReaderChapter[]; activeChapterIndex: number; activeParagraphIndex: number; activeStreamIndex: number; activeScreenPage: number; pageStreamLength: number; screenPageCount: number; layoutMode: ReaderSettings['layoutMode'] }) {
  if (mode === 'characters') {
    return computeReaderProgress({ chapterIndex: input.activeChapterIndex, paragraphIndex: input.activeParagraphIndex, chapters: input.chapters });
  }
  if (mode === 'pages') {
    return computeReaderPageProgress(input);
  }
  return input.chapters.length ? Math.round(((input.activeChapterIndex + 1) / input.chapters.length) * 100) : 0;
}

export function resolveReaderStoredProgressPercent(input: { chapters: ReaderChapter[]; activeChapterIndex: number; activeParagraphIndex: number; activeStreamIndex: number; activeScreenPage: number; pageStreamLength: number; screenPageCount: number; layoutMode: ReaderSettings['layoutMode'] }) {
  if (input.layoutMode === 'page' && input.pageStreamLength > 1) {
    return computeReaderPageProgress(input);
  }
  return computeReaderProgress({ chapterIndex: input.activeChapterIndex, paragraphIndex: input.activeParagraphIndex, chapters: input.chapters });
}

export function toReaderSearchScope(scope: ExtendedSettings['searchScope'] | string): ReaderSearchScope {
  if (scope === 'annotations' || scope === 'bookmarks') return scope;
  if (scope === 'page' || scope === 'chapter' || scope === 'book' || scope === 'all') return scope;
  return 'chapter';
}

export function shouldUseReaderSearchChapterFilter(scope: ReaderSearchScope) {
  return scope !== 'page' && scope !== 'chapter';
}

export function toReaderSearchLimit(limit: string) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(800, Math.max(5, Math.floor(parsed)));
}

export function resolveReaderSearchChapterFilterDefault(defaultValue: ExtendedSettings['readerSearchChapterFilterDefault'], activeChapterIndex: number): number | 'all' {
  return defaultValue === 'current' ? Math.max(0, Math.floor(activeChapterIndex)) : 'all';
}

export function parseBoundedInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export type ReaderReadAloudSegment = {
  text: string;
  paragraphIndex: number | null;
};

export function buildReaderReadAloudSegments(chapter: ReaderChapter, startParagraphIndex?: number): ReaderReadAloudSegment[] {
  const hasStartParagraph = typeof startParagraphIndex === 'number' && Number.isFinite(startParagraphIndex);
  const source: ReaderReadAloudSegment[] = [
    ...(hasStartParagraph ? [] : [{ text: chapter.title, paragraphIndex: null }]),
    ...chapter.paragraphs.map((paragraph, paragraphIndex) => ({ text: paragraph, paragraphIndex })),
  ]
    .filter((part) => !hasStartParagraph || part.paragraphIndex === null || part.paragraphIndex >= Math.max(0, Math.floor(startParagraphIndex)))
    .map((part) => ({ ...part, text: part.text.trim() }))
    .filter((part) => Boolean(part.text));
  const segments: ReaderReadAloudSegment[] = [];
  source.forEach((part) => {
    const text = part.text.replace(/\s+/g, ' ').trim();
    for (let index = 0; index < text.length; index += 1200) {
      const chunk = text.slice(index, index + 1200).trim();
      if (chunk) segments.push({ text: chunk, paragraphIndex: part.paragraphIndex });
    }
  });
  return segments;
}

export function toGoalMinutes(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / 60000);
}

export function toReaderAnnotationExportChoice(format: ExtendedSettings['defaultExportFormat'] | string): ReaderAnnotationExportChoice {
  if (format === 'json' || format === 'markdown' || format === 'csv' || format === 'anki' || format === 'obsidian' || format === 'logseq' || format === 'readwise') return format;
  return 'markdown';
}

export function matchesReaderShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, shortcut: ExtendedSettings['readerShortcuts'][keyof ExtendedSettings['readerShortcuts']]) {
  if (shortcut === 'disabled') return false;
  if (shortcut === 'slash') return event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  const key = event.key.toLowerCase();
  const parts = shortcut.split('-');
  const primaryModifierRequired = parts.includes('ctrl');
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  return parts.includes(key) && hasPrimaryModifier === primaryModifierRequired && event.altKey === parts.includes('alt') && event.shiftKey === parts.includes('shift');
}

export function getReaderHighlightColorShortcutMatch(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, shortcuts: ExtendedSettings['highlightColorShortcuts']): ReaderHighlightColor | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  const key = event.key;
  return readerHighlightColors.find((color) => shortcuts[color] !== 'disabled' && shortcuts[color] === key) ?? null;
}

export function isReaderShortcutEditableTarget(target: Pick<HTMLElement, 'closest'> | null) {
  return Boolean(target?.closest('input, textarea, select, button, [contenteditable]'));
}

import type { ReaderBookmark } from '../../../types';
import type { ReaderChapter } from '../readerChapterParserModel.js';
import { getReaderParagraphHash, isVolumeHeading } from '../readerChapterParserModel.js';
import { getReaderSearchPinyinInitials, normalizeReaderSearchText } from '../readerSearchModel.js';
import type { ReaderHighlightRange, ReaderTocEdit, ReaderTocEditConflict, ReaderTocEditMetadata, ReaderTocEditRepairResult, ReaderTocEntry, ReaderTocIndex, ReaderTocIndexOptions, ReaderTocSearchScope, ReaderTocTitleGroupRule } from './types.js';

export function filterReaderChapters(chapters: ReaderChapter[], query: string, scope: ReaderTocSearchScope) {
  return filterReaderTocEntries(createReaderTocIndex(chapters), query, scope).map((entry) => entry.chapter);
}

export function createReaderTocIndex(chapters: ReaderChapter[], annotations: { highlights?: ReaderHighlightRange[]; bookmarks?: ReaderBookmark[] } = {}, options: ReaderTocIndexOptions = {}): ReaderTocIndex {
  let currentVolumeTitle = '';
  const titleGroupRules = parseReaderTocTitleGroupRules(options.titleGroupKeywords);
  const customTitleGroupRules = compileReaderTocTitleGroupRules(options.titleGroupRules);
  const highlightsByChapter = groupTocSearchTextByChapter(annotations.highlights ?? [], (highlight) => `${highlight.text} ${highlight.note} ${highlight.prefixText ?? ''} ${highlight.suffixText ?? ''}`);
  const bookmarksByChapter = groupTocSearchTextByChapter(annotations.bookmarks ?? [], (bookmark) => `${bookmark.label} ${bookmark.title ?? ''} ${bookmark.note ?? ''} ${(bookmark.tags ?? []).join(' ')}`);
  const hierarchyStack: Array<{ id: string; depth: number }> = [];
  const entries = chapters.map((chapter) => {
    const kind = isVolumeHeading(chapter.title) ? 'volume' : 'chapter';
    if (kind === 'volume') currentVolumeTitle = chapter.title;
    const titleGroup = options.titleGroupingEnabled ? resolveReaderTocTitleGroup(chapter.title, titleGroupRules, customTitleGroupRules) : '';
    const depth = options.hierarchyMode === 'document' ? getReaderDocumentHeadingDepth(chapter.title, kind) : 0;
    while (hierarchyStack.length && hierarchyStack.at(-1)!.depth >= depth) hierarchyStack.pop();
    const parentId = hierarchyStack.at(-1)?.id ?? '';
    const ancestorIds = hierarchyStack.map((item) => item.id);
    const entry: ReaderTocEntry = {
      chapter,
      kind,
      volumeTitle: currentVolumeTitle,
      titleGroup,
      searchableTitle: `${chapter.title} ${titleGroup}`.toLowerCase(),
      searchableContent: '',
      searchableAnnotations: highlightsByChapter.get(chapter.index) ?? '',
      searchableBookmarks: bookmarksByChapter.get(chapter.index) ?? '',
      snippet: '',
      matchParagraphIndex: 0,
      depth,
      parentId,
      ancestorIds,
      hasChildren: false,
    };
    hierarchyStack.push({ id: chapter.id, depth });
    return entry;
  });
  const parentIds = new Set(entries.map((entry) => entry.parentId).filter(Boolean));
  entries.forEach((entry) => { entry.hasChildren = parentIds.has(entry.chapter.id); });
  return { entries };
}

export function getReaderDocumentHeadingDepth(title: string, kind: ReaderTocEntry['kind'] = 'chapter') {
  const value = title.trim();
  if (kind === 'volume') return 0;
  if (/^(?:第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[章卷部篇]|(?:chapter|part|book|volume)\b)/iu.test(value)) return 0;
  if (/^(?:[（(][一二三四五六七八九十百千万零〇两\d]+[)）]|\d+(?:\.\d+){2,})/u.test(value)) return 2;
  if (/^(?:[一二三四五六七八九十百千万零〇两]+[、.．]|\d+[、.．]|\d+\.\d+)/u.test(value)) return 1;
  return 0;
}

function compileReaderTocTitleGroupRules(rules: ReaderTocTitleGroupRule[] | undefined) {
  return (rules ?? [])
    .filter((rule) => rule.enabled && rule.groupName.trim() && rule.pattern.trim())
    .sort((a, b) => a.priority - b.priority)
    .flatMap((rule) => {
      try {
        return [{ groupName: rule.groupName.trim(), expression: new RegExp(rule.pattern, 'i') }];
      } catch {
        return [];
      }
    });
}

function parseReaderTocTitleGroupRules(value: string | undefined) {
  const source = value?.trim() || '番外：番外\n外传：外传\n后记：后记，完本感言，尾声，终章感言';
  return source
    .split(/\n+/)
    .map((line) => {
      const [label, rawKeywords = ''] = line.split(/[:：]/);
      const keywords = rawKeywords
        .split(/[，,、|/]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 12);
      return { label: label.trim().slice(0, 20), keywords };
    })
    .filter((rule) => rule.label && rule.keywords.length)
    .slice(0, 12);
}

function resolveReaderTocTitleGroup(title: string, rules: Array<{ label: string; keywords: string[] }>, customRules: Array<{ groupName: string; expression: RegExp }> = []) {
  const customMatch = customRules.find((rule) => rule.expression.test(title));
  if (customMatch) return customMatch.groupName;
  const normalizedTitle = title.toLowerCase();
  const matched = rules.find((rule) => rule.keywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase())));
  return matched?.label ?? '正文';
}

export function filterReaderTocEntries(index: ReaderTocIndex, query: string, scope: ReaderTocSearchScope): ReaderTocEntry[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return index.entries;
  return index.entries.flatMap((entry) => {
    if (entry.searchableTitle.includes(keyword)) return [{ ...entry, snippet: '', matchParagraphIndex: 0 }];
    if (scope === 'title') return [];
    if (scope === 'annotations') {
      if (!entry.searchableAnnotations.includes(keyword)) return [];
      return [{ ...entry, snippet: buildSearchSnippet(entry.searchableAnnotations, entry.searchableAnnotations.indexOf(keyword), keyword.length), matchParagraphIndex: 0 }];
    }
    if (scope === 'bookmarks') {
      if (!entry.searchableBookmarks.includes(keyword)) return [];
      return [{ ...entry, snippet: buildSearchSnippet(entry.searchableBookmarks, entry.searchableBookmarks.indexOf(keyword), keyword.length), matchParagraphIndex: 0 }];
    }
    const matchParagraphIndex = scope === 'content'
      ? entry.chapter.paragraphs.findIndex((paragraph) => paragraph.toLowerCase().includes(keyword))
      : -1;
    if (matchParagraphIndex < 0) return [];
    const paragraph = entry.chapter.paragraphs[matchParagraphIndex];
    const matchIndex = paragraph.toLowerCase().indexOf(keyword);
    return [{ ...entry, snippet: buildSearchSnippet(paragraph, matchIndex, keyword.length), matchParagraphIndex }];
  });
}

function groupTocSearchTextByChapter<T extends { chapterIndex: number }>(items: T[], getText: (item: T) => string) {
  const groups = new Map<number, string[]>();
  items.forEach((item) => {
    const bucket = groups.get(item.chapterIndex);
    if (bucket) bucket.push(getText(item).toLowerCase());
    else groups.set(item.chapterIndex, [getText(item).toLowerCase()]);
  });
  return new Map([...groups.entries()].map(([chapterIndex, values]) => [chapterIndex, values.join('\n')]));
}

export function getChapterLocation(chapterIndex: number, paragraphIndex = 0) {
  return `${Math.max(0, chapterIndex)}:${Math.max(0, paragraphIndex)}`;
}

export function findChapterIndexForLocation(chapters: ReaderChapter[], location: string) {
  const [chapterIndex] = location.split(':').map((value) => Number(value));
  if (!Number.isFinite(chapterIndex)) return 0;
  return Math.min(Math.max(0, chapterIndex), Math.max(0, chapters.length - 1));
}

function buildSearchSnippet(text: string, matchIndex: number, keywordLength: number) {
  const start = Math.max(0, matchIndex - 18);
  const end = Math.min(text.length, matchIndex + keywordLength + 34);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
export function applyTocEdits(chapters: ReaderChapter[], edits: ReaderTocEdit[]) {
  let next = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  for (const edit of edits) {
    const index = next.findIndex((chapter) => chapter.id === edit.chapterId);
    if (edit.type === 'unhide') {
      if (index >= 0) continue;
      const original = chapters.find((chapter) => chapter.id === edit.chapterId);
      if (!original) continue;
      const insertAt = next.findIndex((chapter) => chapter.index > original.index);
      const restored = { ...original, paragraphs: [...original.paragraphs] };
      if (insertAt >= 0) next.splice(insertAt, 0, restored);
      else next.push(restored);
      continue;
    }
    if (index < 0) continue;
    if (edit.type === 'rename') next[index] = { ...next[index], title: edit.title.trim() || next[index].title };
    if (edit.type === 'hide') next = next.filter((chapter) => chapter.id !== edit.chapterId);
    if (edit.type === 'split') {
      const chapter = next[index];
      const splitAt = Math.min(Math.max(1, edit.paragraphIndex), Math.max(1, chapter.paragraphs.length - 1));
      const first = { ...chapter, paragraphs: chapter.paragraphs.slice(0, splitAt) };
      const second = { ...chapter, id: `${chapter.id}-split-${splitAt}`, index: chapter.index + 0.5, title: edit.title.trim() || `${chapter.title} 下`, paragraphs: chapter.paragraphs.slice(splitAt) };
      next.splice(index, 1, first, second);
    }
    if (edit.type === 'merge-next' && index < next.length - 1) {
      const merged = { ...next[index], paragraphs: [...next[index].paragraphs, ...next[index + 1].paragraphs] };
      next.splice(index, 2, merged);
    }
  }
  return next;
}

export function createReaderTocEdit<T extends Omit<ReaderTocEdit, keyof ReaderTocEditMetadata>>(edit: T, metadata: Required<ReaderTocEditMetadata>): T & Required<ReaderTocEditMetadata> {
  return {
    ...edit,
    parserVersion: metadata.parserVersion,
    baseContentHash: metadata.baseContentHash,
    createdAt: metadata.createdAt,
  };
}

function refreshReaderTocEditMetadata<T extends ReaderTocEdit>(edit: T, metadata: Required<ReaderTocEditMetadata>): T {
  return { ...edit, parserVersion: metadata.parserVersion, baseContentHash: metadata.baseContentHash, createdAt: metadata.createdAt };
}

function hasReaderTocEditHashChanged(before: ReaderTocEdit, after: ReaderTocEdit) {
  return before.parserVersion !== after.parserVersion || before.baseContentHash !== after.baseContentHash || before.createdAt !== after.createdAt;
}

export function getReaderTocEditHashStatus(edits: ReaderTocEdit[], currentContentHash: string) {
  let mismatchedCount = 0;
  let unknownCount = 0;
  for (const edit of edits) {
    if (!edit.baseContentHash) {
      unknownCount += 1;
      continue;
    }
    if (edit.baseContentHash !== currentContentHash) mismatchedCount += 1;
  }
  return {
    status: mismatchedCount > 0 ? 'mismatch' as const : unknownCount > 0 ? 'unknown' as const : 'ok' as const,
    mismatchedCount,
    unknownCount,
  };
}

export function repairReaderTocEdits(chapters: ReaderChapter[], edits: ReaderTocEdit[], metadata: Required<ReaderTocEditMetadata>): ReaderTocEditRepairResult {
  let working = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  const repaired: ReaderTocEdit[] = [];
  const conflicts: ReaderTocEditConflict[] = [];
  let clampedCount = 0;
  let refreshedHashCount = 0;

  for (const edit of edits) {
    const chapterIndex = working.findIndex((chapter) => chapter.id === edit.chapterId);
    if (edit.type === 'unhide') {
      const original = chapters.find((chapter) => chapter.id === edit.chapterId);
      if (!original) {
        conflicts.push({ edit, reason: 'missing-chapter', action: 'dropped' });
        continue;
      }
      const nextEdit = refreshReaderTocEditMetadata(edit, metadata);
      refreshedHashCount += hasReaderTocEditHashChanged(edit, nextEdit) ? 1 : 0;
      repaired.push(nextEdit);
      working = applyTocEdits(working, [nextEdit]);
      continue;
    }
    if (chapterIndex < 0) {
      conflicts.push({ edit, reason: 'missing-chapter', action: 'dropped' });
      continue;
    }
    if ((edit.type === 'rename' || edit.type === 'split') && !edit.title.trim()) {
      conflicts.push({ edit, reason: 'empty-title', action: 'dropped' });
      continue;
    }
    if (edit.type === 'merge-next' && chapterIndex >= working.length - 1) {
      conflicts.push({ edit, reason: 'merge-next-missing', action: 'dropped' });
      continue;
    }

    let nextEdit = edit;
    if (edit.type === 'split') {
      const maxSplit = working[chapterIndex].paragraphs.length - 1;
      if (maxSplit < 1) {
        conflicts.push({ edit, reason: 'split-out-of-range', action: 'dropped' });
        continue;
      }
      const paragraphIndex = Math.min(Math.max(1, Math.floor(edit.paragraphIndex)), maxSplit);
      if (paragraphIndex !== edit.paragraphIndex) {
        conflicts.push({ edit, reason: 'split-out-of-range', action: 'clamped' });
        clampedCount += 1;
        nextEdit = { ...edit, paragraphIndex };
      }
    }

    const repairedEdit = refreshReaderTocEditMetadata(nextEdit, metadata);
    refreshedHashCount += hasReaderTocEditHashChanged(nextEdit, repairedEdit) ? 1 : 0;
    repaired.push(repairedEdit);
    working = applyTocEdits(working, [repairedEdit]);
  }

  return {
    edits: repaired,
    conflicts,
    summary: {
      keptCount: repaired.length,
      droppedCount: conflicts.filter((item) => item.action === 'dropped').length,
      clampedCount,
      refreshedHashCount,
    },
  };
}

export function getHiddenReaderChapters(chapters: ReaderChapter[], edits: ReaderTocEdit[]) {
  const hiddenIds = getHiddenChapterIds(edits);
  return chapters.filter((chapter) => hiddenIds.has(chapter.id));
}

export function findVisibleChapterIndexByOriginalIndex(chapters: ReaderChapter[], originalIndex: number) {
  const exactIndex = chapters.findIndex((chapter) => chapter.index === originalIndex);
  if (exactIndex >= 0) return exactIndex;
  const nextIndex = chapters.findIndex((chapter) => chapter.index > originalIndex);
  return nextIndex >= 0 ? nextIndex : Math.max(0, chapters.length - 1);
}


function getHiddenChapterIds(edits: ReaderTocEdit[]) {
  const hiddenIds = new Set<string>();
  for (const edit of edits) {
    if (edit.type === 'hide') hiddenIds.add(edit.chapterId);
    if (edit.type === 'unhide') hiddenIds.delete(edit.chapterId);
  }
  return hiddenIds;
}

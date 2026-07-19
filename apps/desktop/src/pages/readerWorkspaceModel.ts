import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  buildReaderTocManifestFromChapters,
  isReaderTocManifestValidForBook,
  resolveReaderAnnotationAnchorAfterTocEdits,
  summarizeReaderTocManifestDiff,
  type ReaderChapter,
  type ReaderChapterParsingOptions,
  type ReaderResolvedLocation,
  type ReaderTocEdit,
  type ReaderTocManifest,
  type ReaderTocManifestDiffSummary,
} from '../features/reader-core/readerModel';
import { loadGlobalReaderSettings } from '../features/reader-core/readerSettings';
import { saveReaderRecord } from '../services/readerStorageService';
import type { ChapterRuleDraft, ExtendedSettings } from '../services/settingsCenterService';
import type { Book, ReaderHighlight, ReaderSettings, ReaderSettingsLevel, ReaderTheme } from '../types';
import type { Translator } from '../i18n';
import type { ReaderStoredState, ReaderTocEditHistoryEntry } from './readerWorkspaceStorage';
import { requestAppConfirm } from '../components/useAppConfirm';

export type ReaderWindowStateEvent = ReaderStoredState & {
  source: string;
  version: number;
  updatedAt: string;
  bookId: string;
};

export type ReaderReadingStats = {
  totalReadingMs: number;
  lastSessionMs: number;
  updatedAt: string;
};

export function getReaderLocationFailureMessage(status: Exclude<ReaderResolvedLocation['status'], 'ok'>) {
  if (status === 'chapter-hidden-or-missing') return 'reader.locationFailed.chapterHiddenOrMissing';
  if (status === 'paragraph-missing') return 'reader.locationFailed.paragraphMissing';
  if (status === 'offset-out-of-range') return 'reader.locationFailed.offsetOutOfRange';
  return 'reader.locationFailed';
}

export function resolveReaderThemeFromApp(appTheme: ExtendedSettings['appTheme']): ReaderTheme {
  if (appTheme === 'dark') return 'dark';
  if (appTheme === 'light') return 'paper';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'paper';
}

export function resolveEffectiveReaderTheme(
  readerTheme: ReaderTheme,
  appTheme: ExtendedSettings['appTheme'],
  followsAppTheme: boolean,
): ReaderTheme {
  const resolvedAppTheme = resolveReaderThemeFromApp(appTheme);
  if (resolvedAppTheme === 'dark') return readerTheme === 'oled' ? 'oled' : 'dark';
  return followsAppTheme ? resolvedAppTheme : readerTheme;
}

export function createInitialReaderWorkspaceState(book: Book | null, standaloneReader: boolean, loadReaderState: (key: string) => ReaderStoredState | null): ReaderStoredState | null {
  if (!book) return null;
  const stored = loadReaderState(`bookmind:reader-state:${book.id}`);
  if (stored) return applyReaderLaunchLocation(stored, standaloneReader);
  if (!standaloneReader) return null;
  return applyReaderLaunchLocation({
    settings: loadGlobalReaderSettings(),
    activeChapterIndex: getInitialReaderChapter(),
    activeParagraphIndex: 0,
    activeScreenPage: 0,
    aiCollapsed: false,
    tocOpen: true,
    settingsLevel: 'basic',
    panelPlacements: { ai: 'floating', rules: 'floating', settings: 'floating' },
  }, standaloneReader);
}

export function createReaderWindowStateEvent(bookId: string, state: ReaderStoredState, updatedAt = new Date().toISOString()): ReaderWindowStateEvent {
  return {
    ...state,
    source: WebviewWindow.getCurrent().label,
    version: 1,
    updatedAt,
    bookId,
  };
}

export function repairReaderHighlightsForCurrentToc(highlights: ReaderHighlight[], chapters: ReaderChapter[], hiddenChapters: ReaderChapter[], options: { repairStrategy: ExtendedSettings['anchorRepairStrategy'] }): ReaderHighlight[] {
  if (!chapters.length) return highlights;
  const hiddenChapterIds = hiddenChapters.map((chapter) => chapter.id);
  return highlights.flatMap((highlight) => {
    const hasRepairableAnchor = Boolean(highlight.chapterId || highlight.sourceChapterIndex !== undefined || highlight.paragraphHash || highlight.prefixText || highlight.suffixText);
    if (!hasRepairableAnchor) return [highlight];
    const resolved = resolveReaderAnnotationAnchorAfterTocEdits(highlight, chapters, { ...options, hiddenChapterIds });
    if (resolved.status !== 'ok') return [];
    const chapter = chapters[resolved.visibleChapterPosition];
    return [{
      ...highlight,
      chapterIndex: resolved.chapterIndex,
      chapterId: chapter?.id ?? highlight.chapterId,
      sourceChapterIndex: chapter?.index ?? resolved.chapterIndex,
      paragraphIndex: resolved.paragraphIndex,
      startOffset: resolved.startOffset,
      endOffset: resolved.endOffset,
    }];
  });
}

export function describeTocEdit(edit: ReaderTocEdit, chapters: ReaderChapter[], t: Translator) {
  const chapterTitle = findTocEditChapterTitle(edit, chapters);
  if (edit.type === 'rename') return t('reader.toc.historyRename', { title: chapterTitle, value: edit.title.trim() || chapterTitle });
  if (edit.type === 'hide') return t('reader.toc.historyHide', { title: chapterTitle });
  if (edit.type === 'unhide') return t('reader.toc.historyUnhide', { title: chapterTitle });
  if (edit.type === 'split') return t('reader.toc.historySplit', { title: chapterTitle, value: edit.title.trim() || chapterTitle });
  return t('reader.toc.historyMergeNext', { title: chapterTitle });
}

export function createTocEditHistoryEntry(label: string, createdAt = new Date().toISOString()): ReaderTocEditHistoryEntry {
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt,
  };
}

export function createTocEditHistoryFromEdits(edits: ReaderTocEdit[], chapters: ReaderChapter[], t: Translator) {
  return edits
    .slice(-5)
    .reverse()
    .map((edit) => createTocEditHistoryEntry(describeTocEdit(edit, chapters, t), edit.createdAt));
}

export function getRecentReaderBook(books: Book[]) {
  return books
    .filter((item) => !item.deleted)
    .sort((left, right) => {
      const progressDelta = right.progress - left.progress;
      if (progressDelta !== 0) return progressDelta;
      return Date.parse(right.importedAt || '') - Date.parse(left.importedAt || '');
    })[0] ?? null;
}

export function getInitialReaderChapter() {
  return getReaderLaunchLocation()?.activeChapterIndex ?? 0;
}

export function applyReaderLaunchLocation(state: ReaderStoredState, standaloneReader: boolean): ReaderStoredState {
  const location = standaloneReader ? getReaderLaunchLocation() : null;
  return location ? { ...state, ...location } : state;
}

function getReaderLaunchLocation(): Partial<Pick<ReaderStoredState, 'activeChapterIndex' | 'activeParagraphIndex' | 'activeScreenPage'>> | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('chapter')) return null;
  return {
    activeChapterIndex: parseReaderLaunchIndex(params.get('chapter')),
    ...(params.has('paragraph') ? { activeParagraphIndex: parseReaderLaunchIndex(params.get('paragraph')) } : {}),
    ...(params.has('screenPage') ? { activeScreenPage: parseReaderLaunchIndex(params.get('screenPage')) } : {}),
  };
}

function parseReaderLaunchIndex(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export function shouldRestoreReaderState(restoreStartupReaderPosition: boolean, standaloneReader: boolean) {
  return standaloneReader || restoreStartupReaderPosition;
}

export function createReaderCleanupOptions(chapterRules: ChapterRuleDraft, preserveBlankLines: boolean) {
  const adKeywords = chapterRules.adKeywords.split(/[，,\n]/).map((keyword) => keyword.trim()).filter(Boolean);
  return {
    removeAds: chapterRules.removeAds,
    adKeywords,
    removeAdUrls: chapterRules.removeAdUrls,
    removePaginationNoise: chapterRules.removePaginationNoise,
    normalizeBlankLines: chapterRules.normalizeBlankLines && !preserveBlankLines,
    trimTrailingWhitespace: chapterRules.trimTrailingWhitespace,
    normalizeFullWidthSpaces: chapterRules.normalizeFullWidthSpaces,
    customCleanupRules: chapterRules.customCleanupRules,
  };
}

export function createReaderChapterParsingOptions(chapterRules: ChapterRuleDraft): ReaderChapterParsingOptions {
  return {
    enabled: chapterRules.enabled,
    maxHeadingLength: chapterRules.maxHeadingLength,
    minHeadingConfidence: chapterRules.minHeadingConfidence,
    enableChineseChapter: chapterRules.enableChineseChapter,
    enableChineseVolume: chapterRules.enableChineseVolume,
    enableSpecialHeadings: chapterRules.enableSpecialHeadings,
    enableEnglishChapter: chapterRules.enableEnglishChapter,
    enableCompactSplit: chapterRules.enableCompactSplit,
    autoIgnoreAdHeadings: chapterRules.autoIgnoreAdHeadings,
    autoIgnoreRepeatedTocHeadings: chapterRules.autoIgnoreRepeatedTocHeadings,
    compactHeadingSuffixLength: chapterRules.compactHeadingSuffixLength,
    preserveCompactPrefixText: chapterRules.preserveCompactPrefixText,
    autoDetectBookTitle: chapterRules.autoDetectBookTitle,
    bookTitleBracketMode: chapterRules.bookTitleBracketMode,
    customBookTitleBracketPattern: chapterRules.customBookTitleBracketPattern,
    bookTitleMaxLength: chapterRules.bookTitleMaxLength,
    firstLineAsBookTitle: chapterRules.firstLineAsBookTitle,
    inferBookTitleFromFileName: chapterRules.inferBookTitleFromFileName,
    paragraphMode: chapterRules.paragraphMode,
    shortLineMergeThreshold: chapterRules.shortLineMergeThreshold,
    longParagraphSliceSize: chapterRules.longParagraphSliceSize,
    forbiddenHeadingPunctuation: chapterRules.forbiddenHeadingPunctuation,
    forbiddenHeadingStartChars: chapterRules.forbiddenHeadingStartChars,
    customRegexRules: chapterRules.customRegexRules,
  };
}

export function createReaderDocumentWorkerBook(book: Book): Omit<Book, 'chunks'> {
  const { chunks: _chunks, ...workerBook } = book;
  return workerBook;
}

export async function rebuildReaderTocManifestIfMissingOrEmpty(book: Book, sourceChapters: ReaderChapter[], tocManifest: ReaderTocManifest | null, chapterParsingOptions: ReaderChapterParsingOptions, enabled: boolean) {
  if (!enabled) return null;
  if (sourceChapters.length === 0) return null;
  if (isReaderTocManifestValidForBook(book, tocManifest, chapterParsingOptions) && tocManifest.entries.length > 0) return null;
  const nextManifest = buildReaderTocManifestFromChapters(book, sourceChapters, chapterParsingOptions);
  await saveReaderRecord(book.id, 'tocManifest', nextManifest, 'reader-open-toc-rebuild');
  return nextManifest;
}

export async function rebuildReaderTocManifestAfterRuleChange(book: Book, sourceChapters: ReaderChapter[], tocManifest: ReaderTocManifest | null, chapterParsingOptions: ReaderChapterParsingOptions, mode: ExtendedSettings['tocRuleChangeRebuildMode'], previewDiff: boolean) {
  if (mode === 'off') return null;
  if (sourceChapters.length === 0) return null;
  const nextManifest = buildReaderTocManifestFromChapters(book, sourceChapters, chapterParsingOptions);
  if (mode === 'prompt') {
    const diffSummary = summarizeReaderTocManifestDiff(tocManifest, nextManifest);
    const message = previewDiff
      ? formatReaderTocRebuildDiffPrompt(diffSummary)
      : '章节识别规则已更新，是否按新规则重建并保存当前书籍目录？';
    if (!await requestAppConfirm(message)) return null;
  }
  await saveReaderRecord(book.id, 'tocManifest', nextManifest, 'chapter-rule-change-toc-rebuild');
  return nextManifest;
}

export function matchesReaderWorkspaceShortcut(event: KeyboardEvent, shortcut: ExtendedSettings['readerShortcuts'][keyof ExtendedSettings['readerShortcuts']]) {
  if (shortcut === 'disabled') return false;
  if (shortcut === 'slash') return event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  const key = event.key.toLowerCase();
  const parts = shortcut.split('-');
  const primaryModifierRequired = parts.includes('ctrl');
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  return parts.includes(key) && hasPrimaryModifier === primaryModifierRequired && event.altKey === parts.includes('alt') && event.shiftKey === parts.includes('shift');
}

function findTocEditChapterTitle(edit: ReaderTocEdit, chapters: ReaderChapter[]) {
  return chapters.find((chapter) => chapter.id === edit.chapterId)?.title || edit.chapterId;
}

function formatReaderTocRebuildDiffPrompt(summary: ReaderTocManifestDiffSummary) {
  const lines = [
    '章节识别规则已更新，是否按新规则重建并保存当前书籍目录？',
    '',
    `章节数量：${summary.previousCount} -> ${summary.nextCount}`,
    `新增：${summary.addedCount}，删除：${summary.removedCount}，改名：${summary.renamedCount}，移动：${summary.movedCount}`,
  ];
  if (summary.addedTitles.length) lines.push(`新增示例：${summary.addedTitles.join('、')}`);
  if (summary.removedTitles.length) lines.push(`删除示例：${summary.removedTitles.join('、')}`);
  if (summary.renamedTitles.length) lines.push(`改名示例：${summary.renamedTitles.map((item) => `${item.from} -> ${item.to}`).join('、')}`);
  if (summary.movedTitles.length) lines.push(`移动示例：${summary.movedTitles.join('、')}`);
  return lines.join('\n');
}

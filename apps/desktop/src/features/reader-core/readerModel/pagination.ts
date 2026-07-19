import type { ReaderChapter } from '../readerChapterParserModel.js';
import { estimateLongParagraphSlices, getReaderChapterTextStats, getReaderParagraphHash } from '../readerChapterParserModel.js';
import { isReaderImageOnlyParagraph } from '../readerRichContentModel.js';
import type { ReaderPageChunk, ReaderPageEntry, ReaderStreamPage, ReaderVirtualRange } from './types.js';

export function estimateReaderPages(chapter: ReaderChapter, capacity: number, options: { longParagraphStrategy?: 'strict' | 'punctuation' } = {}): ReaderPageChunk[] {
  const safeCapacity = Math.max(1, Math.floor(capacity));
  const longParagraphStrategy = options.longParagraphStrategy ?? 'strict';
  const chunks: ReaderPageChunk[] = [];
  let entries: ReaderPageEntry[] = [];
  let used = 0;

  function pushPage() {
    if (!entries.length) return;
    chunks.push(createReaderPageChunk(chunks.length, entries));
    entries = [];
    used = 0;
  }

  chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph) return;
    if (isReaderImageOnlyParagraph(paragraph)) {
      const imageCost = Math.max(1, Math.floor(safeCapacity * 0.42));
      if (entries.length && used + imageCost > safeCapacity) pushPage();
      entries.push({ paragraphIndex, startOffset: 0, endOffset: paragraph.length, text: paragraph });
      used += imageCost;
      return;
    }
    if (entries.length && paragraph.length <= safeCapacity && used + paragraph.length > safeCapacity) {
      pushPage();
    }
    let start = 0;
    while (start < paragraph.length) {
      if (used >= safeCapacity) pushPage();
      const remaining = Math.max(1, safeCapacity - used);
      const hardEnd = Math.min(paragraph.length, start + remaining);
      const end = longParagraphStrategy === 'punctuation' ? findReaderParagraphPageBreak(paragraph, start, hardEnd) : hardEnd;
      const shouldBreakAtPunctuation = longParagraphStrategy === 'punctuation' && end < hardEnd;
      const text = paragraph.slice(start, end);
      entries.push({ paragraphIndex, startOffset: start, endOffset: end, text });
      used += text.length;
      start = end;
      if (shouldBreakAtPunctuation || used >= safeCapacity) pushPage();
    }
  });
  pushPage();
  return chunks.length ? chunks : [createReaderPageChunk(0, [{ paragraphIndex: 0, startOffset: 0, endOffset: 0, text: '' }])];
}

export function findReaderParagraphPageBreak(paragraph: string, start: number, hardEnd: number) {
  if (hardEnd >= paragraph.length) return hardEnd;
  const minEnd = Math.max(start + 1, start + Math.floor((hardEnd - start) * 0.45));
  const sentencePunctuation = /[。！？.!?；;]/;
  for (let index = hardEnd - 1; index >= minEnd; index -= 1) {
    if (sentencePunctuation.test(paragraph[index] ?? '')) return index + 1;
  }
  return hardEnd;
}

export function buildReaderFontFamily(primaryFont: string, fallbackFonts: string[]) {
  const fonts = [primaryFont, ...fallbackFonts]
    .map((font) => formatReaderFontFamilyToken(font))
    .filter((font, index, list) => font && list.indexOf(font) === index);
  return fonts.join(', ');
}

function formatReaderFontFamilyToken(font: string) {
  const value = font.trim().replace(/^['"]|['"]$/g, '');
  if (!value) return '';
  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)$/i.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function buildReaderPageStream(chapters: ReaderChapter[], capacity: number, options: { longParagraphStrategy?: 'strict' | 'punctuation' } = {}): ReaderStreamPage[] {
  return chapters.flatMap((chapter, visibleChapterPosition) =>
    estimateReaderPages(chapter, capacity, options).map((chunk, pageInChapter) => ({
      streamIndex: 0,
      chapterId: chapter.id,
      chapterIndex: chapter.index,
      visibleChapterPosition,
      pageInChapter,
      chunk,
    })),
  ).map((page, streamIndex) => ({ ...page, streamIndex }));
}

export function buildReaderPageStreamWithOverrides(chapters: ReaderChapter[], capacity: number, pageChunkOverrides: Map<string, ReaderPageChunk[]>, options: { longParagraphStrategy?: 'strict' | 'punctuation' } = {}): ReaderStreamPage[] {
  return chapters.flatMap((chapter, visibleChapterPosition) => {
    const overrideChunks = pageChunkOverrides.get(chapter.id);
    const chunks = overrideChunks?.length ? overrideChunks : estimateReaderPages(chapter, capacity, options);
    return chunks.map((chunk, pageInChapter) => ({
      streamIndex: 0,
      chapterId: chapter.id,
      chapterIndex: chapter.index,
      visibleChapterPosition,
      pageInChapter,
      chunk,
    }));
  }).map((page, streamIndex) => ({ ...page, streamIndex }));
}

export function getReaderSpreadPages(stream: ReaderStreamPage[], activeStreamIndex: number, pageMode: 'single' | 'double', options: { chapterStartsNewPage?: boolean } = {}): ReaderStreamPage[] {
  if (!stream.length) return [];
  const start = Math.min(Math.max(0, Math.floor(activeStreamIndex)), Math.max(0, stream.length - 1));
  const pages = stream.slice(start, start + (pageMode === 'double' ? 2 : 1));
  if (!options.chapterStartsNewPage || pages.length < 2) return pages;
  return pages.filter((page) => page.visibleChapterPosition === pages[0].visibleChapterPosition);
}

export function findReaderStreamPageIndex(stream: ReaderStreamPage[], visibleChapterPosition: number, pageInChapter: number) {
  if (!stream.length) return 0;
  const safeChapterPosition = Math.max(0, Math.floor(visibleChapterPosition));
  const chapterPages = stream.filter((page) => page.visibleChapterPosition === safeChapterPosition);
  if (!chapterPages.length) return 0;
  const safePageInChapter = Math.min(Math.max(0, Math.floor(pageInChapter)), chapterPages.length - 1);
  return chapterPages[safePageInChapter]?.streamIndex ?? chapterPages[0].streamIndex;
}

export function createReaderPageChunk(pageIndex: number, entries: ReaderPageEntry[]): ReaderPageChunk {
  const first = entries[0] ?? { paragraphIndex: 0, startOffset: 0, endOffset: 0 };
  const last = entries[entries.length - 1] ?? first;
  return {
    pageIndex,
    paragraphIndex: first.paragraphIndex,
    startOffset: first.startOffset,
    endOffset: last.endOffset,
    text: entries.map((entry) => entry.text ?? '').join(''),
    entries,
  };
}

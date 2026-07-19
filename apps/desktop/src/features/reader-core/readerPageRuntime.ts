import { convertFileSrc } from '@tauri-apps/api/core';
import { getReaderRecord, parseReaderRecord, saveReaderRecord } from '../../services/readerStorageService';
import type { ReaderSettings } from '../../types';
import {
  deserializeReaderPageChunks,
  findReaderParagraphPageBreak,
  formatReaderChapterTitle,
  hasInvalidReaderPageChunks,
  isReaderImageOnlyParagraph,
  parseReaderRichContentParagraph,
  serializeReaderPageChunks,
  type ReaderChapter,
  type ReaderPageChunk,
  type ReaderPageEntry,
  type ReaderSelectionParagraph,
} from './readerModel';
import { createReaderPageChunk, estimateReaderPages } from './readerPagination';

type ReaderPageMeasureOptions = { titleOnlyOnChapterStart?: boolean; titleNumberCleanup?: ReaderSettings['titleNumberCleanup']; longParagraphStrategy?: 'strict' | 'punctuation'; titleBlockMaxHeight?: number };

function* runReaderChapterPageMeasurement(chapter: ReaderChapter, measure: HTMLDivElement, pageHeight: number, options: ReaderPageMeasureOptions = {}): Generator<void, ReaderPageChunk[], void> {
  const pages: ReaderPageChunk[] = [];
  let entries: ReaderPageEntry[] = [];
  let hasChapterStart = true;
  const displayChapterTitle = formatReaderChapterTitle(chapter.title, options.titleNumberCleanup ?? 'keep');
  let renderedIncludeTitle: boolean | null = null;

  function setMeasureEntries(nextEntries: ReaderPageEntry[], includeTitle: boolean) {
    if (renderedIncludeTitle !== includeTitle) {
      measure.innerHTML = '';
      renderedIncludeTitle = includeTitle;
    }
    if (includeTitle && !measure.firstElementChild) {
      const titleBlock = createMeasureElement('div', 'reader-chapter-start reader-measure-title', [
        createMeasureElement('h2', 'reader-chapter-title', [], displayChapterTitle),
        createMeasureElement('button', 'reader-title-line-toggle', []),
      ]);
      const titleToggle = titleBlock.querySelector('.reader-title-line-toggle') as HTMLButtonElement | null;
      if (titleToggle) titleToggle.type = 'button';
      const titleBlockMaxHeight = Math.max(72, Math.floor(options.titleBlockMaxHeight ?? 160));
      titleBlock.style.maxHeight = `${titleBlockMaxHeight}px`;
      titleBlock.style.overflow = 'hidden';
      measure.appendChild(titleBlock);
    }
    const offset = includeTitle ? 1 : 0;
    nextEntries.forEach((entry, index) => {
      const current = measure.children[offset + index] as HTMLElement | undefined;
      const wantsImage = isReaderImageOnlyParagraph(entry.text);
      const hasImage = Boolean(current?.classList.contains('reader-epub-image-block'));
      if (!current || current.classList.contains('reader-measure-title') || wantsImage !== hasImage) {
        const nextElement = createMeasureParagraphElement(entry.text);
        if (current) current.replaceWith(nextElement);
        else measure.appendChild(nextElement);
        return;
      }
      if (!wantsImage && current.textContent !== entry.text) current.textContent = entry.text;
    });
    while (measure.children.length > offset + nextEntries.length) {
      measure.lastElementChild?.remove();
    }
  }

  function* fits(nextEntries: ReaderPageEntry[]): Generator<void, boolean, void> {
    setMeasureEntries(nextEntries, options.titleOnlyOnChapterStart !== false ? hasChapterStart : true);
    const result = measure.scrollHeight <= pageHeight && getLastMeasuredContentBottom(measure) <= pageHeight;
    yield;
    return result;
  }

  function pushPage() {
    if (!entries.length) return;
    pages.push(createReaderPageChunk(pages.length, entries));
    entries = [];
    hasChapterStart = false;
  }

  try {
    for (let paragraphIndex = 0; paragraphIndex < chapter.paragraphs.length; paragraphIndex += 1) {
      const paragraph = chapter.paragraphs[paragraphIndex];
    if (!paragraph) continue;
    if (isReaderImageOnlyParagraph(paragraph)) {
      const imageEntry = { paragraphIndex, startOffset: 0, endOffset: paragraph.length, text: paragraph };
      if (entries.length && !(yield* fits([...entries, imageEntry]))) pushPage();
      entries.push(imageEntry);
      continue;
    }
    if (entries.length) {
      const wholeParagraph = { paragraphIndex, startOffset: 0, endOffset: paragraph.length, text: paragraph };
      if (!(yield* fits([...entries, wholeParagraph])) && (yield* fits([wholeParagraph]))) {
        pushPage();
      }
    }
    let start = 0;
    while (start < paragraph.length) {
      let low = start + 1;
      let high = paragraph.length;
      let best = low;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = [...entries, { paragraphIndex, startOffset: start, endOffset: mid, text: paragraph.slice(start, mid) }];
        if (yield* fits(candidate)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      if (best === start + 1 && entries.length && !(yield* fits([...entries, { paragraphIndex, startOffset: start, endOffset: best, text: paragraph.slice(start, best) }]))) {
        pushPage();
        continue;
      }
      const strategyEnd = options.longParagraphStrategy === 'punctuation' ? findReaderParagraphPageBreak(paragraph, start, best) : best;
      const shouldBreakAtPunctuation = options.longParagraphStrategy === 'punctuation' && strategyEnd < best;
      const end = Math.max(start + 1, strategyEnd);
      entries.push({ paragraphIndex, startOffset: start, endOffset: end, text: paragraph.slice(start, end) });
      start = end;
      if (start < paragraph.length && (shouldBreakAtPunctuation || !(yield* fits([...entries, { paragraphIndex, startOffset: start, endOffset: Math.min(paragraph.length, start + 1), text: paragraph.slice(start, Math.min(paragraph.length, start + 1)) }])))) pushPage();
    }
    }
  pushPage();
  measure.innerHTML = '';
  const measuredPages = pages.length ? pages : [createReaderPageChunk(0, [{ paragraphIndex: 0, startOffset: 0, endOffset: 0, text: '' }])];
    return hasInvalidReaderPageChunks(measuredPages) ? [] : measuredPages;
  } finally {
    measure.innerHTML = '';
  }
}

export function measureChapterPages(chapter: ReaderChapter, measure: HTMLDivElement, pageHeight: number, options: ReaderPageMeasureOptions = {}): ReaderPageChunk[] {
  const iterator = runReaderChapterPageMeasurement(chapter, measure, pageHeight, options);
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

export async function measureChapterPagesCooperatively(chapter: ReaderChapter, measure: HTMLDivElement, pageHeight: number, options: ReaderPageMeasureOptions = {}, shouldCancel?: () => boolean): Promise<ReaderPageChunk[]> {
  const iterator = runReaderChapterPageMeasurement(chapter, measure, pageHeight, options);
  let result = iterator.next();
  let sliceStart = performance.now();
  while (!result.done) {
    if (shouldCancel?.()) {
      iterator.return([]);
      return [];
    }
    if (performance.now() - sliceStart >= 8) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      sliceStart = performance.now();
    }
    result = iterator.next();
  }
  return result.value;
}

function createMeasureElement(tagName: 'button' | 'div' | 'h2' | 'p', className: string, children: HTMLElement[], text = '') {
  const element = document.createElement(tagName);
  element.className = className;
  if (text) element.textContent = text;
  children.forEach((child) => element.appendChild(child));
  return element;
}

function createMeasureParagraphElement(text: string) {
  if (!isReaderImageOnlyParagraph(text)) {
    return createMeasureElement('p', 'source-paragraph', [], text);
  }
  const figure = createMeasureElement('div', 'source-paragraph reader-epub-image-block', []);
  for (const part of parseReaderRichContentParagraph(text)) {
    if (part.type === 'text') {
      figure.appendChild(document.createTextNode(part.text));
      continue;
    }
    if (part.type !== 'image') continue;
    const image = document.createElement('img');
    image.className = 'reader-epub-image';
    image.alt = part.alt;
    image.src = resolveReaderMeasureImageSrc(part.src);
    image.style.display = 'block';
    image.style.width = 'auto';
    image.style.maxWidth = '100%';
    image.style.height = 'auto';
    image.style.aspectRatio = 'auto 4 / 3';
    image.style.maxHeight = '55vh';
    image.style.objectFit = 'contain';
    figure.appendChild(image);
  }
  return figure;
}

function resolveReaderMeasureImageSrc(src: string) {
  if (/^(?:https?|data|blob|asset):/i.test(src)) return src;
  try {
    return convertFileSrc(src);
  } catch {
    return src;
  }
}

export async function preloadReaderChapterImages(chapter: ReaderChapter) {
  const sources = new Set<string>();
  chapter.paragraphs.forEach((paragraph) => {
    parseReaderRichContentParagraph(paragraph).forEach((part) => {
      if (part.type === 'image') sources.add(resolveReaderMeasureImageSrc(part.src));
    });
  });
  await Promise.all([...sources].map((src) => preloadReaderImage(src)));
}

function preloadReaderImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const done = () => resolve();
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
    image.src = src;
    if (image.complete) {
      resolve();
      return;
    }
    void image.decode?.().then(done, done);
  });
}

function getLastMeasuredContentBottom(measure: HTMLDivElement) {
  const lastElement = measure.lastElementChild as HTMLElement | null;
  if (!lastElement) return 0;
  const measureTop = measure.getBoundingClientRect().top;
  return Math.ceil(lastElement.getBoundingClientRect().bottom - measureTop);
}

export async function waitForReaderFonts() {
  if (!document.fonts?.ready) return;
  await document.fonts.ready.catch(() => undefined);
}

export async function loadPersistentPageCache(bookId: string, cacheKey: string, chapter: ReaderChapter) {
  try {
    const record = await getReaderRecord(bookId, 'pageCache');
    const cache = parseReaderRecord<Record<string, string | ReaderPageChunk[]>>(record, {});
    const payload = cache[cacheKey];
    const chunks = typeof payload === 'string'
      ? deserializeReaderPageChunks(payload, chapter)
      : Array.isArray(payload) ? deserializeReaderPageChunks(JSON.stringify(payload), chapter) : [];
    if (chunks.length) return chunks;
  } catch (error) {
    console.warn('Failed to load reader page cache from SQLite:', error);
  }
  const legacy = deserializeReaderPageChunks(window.localStorage.getItem(cacheKey) ?? '', chapter);
  if (legacy.length) savePersistentPageCache(bookId, cacheKey, legacy, 30);
  return legacy;
}

export function savePersistentPageCache(bookId: string, cacheKey: string, chunks: ReaderPageChunk[], cacheLimit: number) {
  if (cacheLimit <= 0) return;
  if (hasInvalidReaderPageChunks(chunks)) return;
  void getReaderRecord(bookId, 'pageCache').then((record) => {
    const cache = parseReaderRecord<Record<string, string | ReaderPageChunk[]>>(record, {});
    const keys = Object.keys(cache).filter((key) => key !== cacheKey);
    keys.push(cacheKey);
    while (keys.length > cacheLimit) {
      const expired = keys.shift();
      if (expired) delete cache[expired];
    }
    cache[cacheKey] = serializeReaderPageChunks(chunks);
    return saveReaderRecord(bookId, 'pageCache', cache, 'reader-page');
  }).catch((error) => {
    console.warn('Failed to save reader page cache to SQLite:', error);
    window.localStorage.setItem(cacheKey, serializeReaderPageChunks(chunks));
  });
}

export function preheatAdjacentReaderPageCache({ bookId, chapters, activeChapterIndex, measure, createPageCacheKey, pageTextHeight, options, pageMeasureCache, cacheLimit, preheatRange }: { bookId?: string; chapters: ReaderChapter[]; activeChapterIndex: number; measure: HTMLDivElement; createPageCacheKey: (chapter: ReaderChapter) => string; pageTextHeight: number; options: { titleOnlyOnChapterStart?: boolean; titleNumberCleanup?: ReaderSettings['titleNumberCleanup']; longParagraphStrategy?: 'strict' | 'punctuation'; titleBlockMaxHeight?: number }; pageMeasureCache: Map<string, ReaderPageChunk[]>; cacheLimit: number; preheatRange: number }) {
  if (!bookId || cacheLimit <= 0 || preheatRange <= 0) return;
  for (let offset = 1; offset <= preheatRange; offset += 1) {
    [activeChapterIndex - offset, activeChapterIndex + offset].forEach((chapterIndex) => {
      const chapter = chapters[chapterIndex];
      if (!chapter) return;
      const cacheKey = createPageCacheKey(chapter);
      if (pageMeasureCache.has(cacheKey)) return;
      const measured = measureChapterPages(chapter, measure, pageTextHeight, options);
      if (hasInvalidReaderPageChunks(measured)) return;
      pageMeasureCache.set(cacheKey, measured);
      savePersistentPageCache(bookId, `bookmind:reader-page-cache:${bookId}:${cacheKey}`, measured, cacheLimit);
    });
  }
}

export function getSelectionParagraphRanges(selection: Selection, range: Range): ReaderSelectionParagraph[] {
  const anchorRoot = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode as Element : selection.anchorNode?.parentElement;
  const focusRoot = selection.focusNode?.nodeType === Node.ELEMENT_NODE ? selection.focusNode as Element : selection.focusNode?.parentElement;
  const readerRoot = anchorRoot?.closest('.reader-book-scroll') ?? focusRoot?.closest('.reader-book-scroll');
  const paragraphNodes = readerRoot
    ? collectSelectionParagraphNodes(range, readerRoot)
    : getSelectionBoundaryParagraphs(range);
  const result: ReaderSelectionParagraph[] = [];

  paragraphNodes.forEach((paragraphNode) => {
    const selectedRange = getParagraphSelectedRange(paragraphNode, range);
    if (!selectedRange) return;
    const selectedText = selectedRange.toString();
    if (!selectedText.trim()) return;
    const text = paragraphNode.textContent ?? '';
    const location = paragraphNode.dataset.location;
    if (!location || !text) return;
    const prefix = document.createRange();
    prefix.selectNodeContents(paragraphNode);
    prefix.setEnd(selectedRange.startContainer, selectedRange.startOffset);
    result.push({
      location,
      pageStartOffset: Number(paragraphNode.dataset.pageStartOffset ?? 0) || 0,
      text,
      selectedText,
      localStartOffset: Math.min(Math.max(0, prefix.toString().length), text.length),
    });
    prefix.detach();
  });

  return result;
}

function collectSelectionParagraphNodes(range: Range, readerRoot: Element) {
  const boundaryNodes = getSelectionBoundaryParagraphs(range);
  const commonAncestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement;
  const searchRoot = commonAncestor?.closest('[data-location]') ?? commonAncestor;
  if (!searchRoot || !readerRoot.contains(searchRoot)) return boundaryNodes;
  const nodes = new Set<HTMLElement>(boundaryNodes);
  if (searchRoot instanceof HTMLElement && searchRoot.dataset.location && range.intersectsNode(searchRoot)) {
    nodes.add(searchRoot);
  }
  const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const element = node as HTMLElement;
      if (!element.dataset.location) return NodeFilter.FILTER_SKIP;
      return range.intersectsNode(element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) nodes.add(walker.currentNode as HTMLElement);
  return [...nodes].sort((left, right) => {
    if (left === right) return 0;
    const position = left.compareDocumentPosition(right);
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

export async function preheatAdjacentReaderPageCacheCooperatively({ bookId, chapters, activeChapterIndex, measure, createPageCacheKey, pageTextHeight, options, pageMeasureCache, cacheLimit, preheatRange, shouldCancel }: { bookId?: string; chapters: ReaderChapter[]; activeChapterIndex: number; measure: HTMLDivElement; createPageCacheKey: (chapter: ReaderChapter) => string; pageTextHeight: number; options: ReaderPageMeasureOptions; pageMeasureCache: Map<string, ReaderPageChunk[]>; cacheLimit: number; preheatRange: number; shouldCancel?: () => boolean }) {
  if (!bookId || cacheLimit <= 0 || preheatRange <= 0) return;
  for (let offset = 1; offset <= preheatRange; offset += 1) {
    for (const chapterIndex of [activeChapterIndex - offset, activeChapterIndex + offset]) {
      if (shouldCancel?.()) return;
      const chapter = chapters[chapterIndex];
      if (!chapter) continue;
      const cacheKey = createPageCacheKey(chapter);
      if (pageMeasureCache.has(cacheKey)) continue;
      await preloadReaderChapterImages(chapter);
      if (shouldCancel?.()) return;
      const measured = await measureChapterPagesCooperatively(chapter, measure, pageTextHeight, options, shouldCancel);
      if (shouldCancel?.() || hasInvalidReaderPageChunks(measured)) return;
      pageMeasureCache.set(cacheKey, measured);
      savePersistentPageCache(bookId, `bookmind:reader-page-cache:${bookId}:${cacheKey}`, measured, cacheLimit);
    }
  }
}

function getSelectionBoundaryParagraphs(range: Range) {
  const nodes: HTMLElement[] = [];
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
  const end = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer as Element : range.endContainer.parentElement;
  const startParagraph = start?.closest('[data-location]') as HTMLElement | null;
  const endParagraph = end?.closest('[data-location]') as HTMLElement | null;
  if (startParagraph) nodes.push(startParagraph);
  if (endParagraph && endParagraph !== startParagraph) nodes.push(endParagraph);
  return nodes;
}

function getParagraphSelectedRange(paragraphNode: HTMLElement, selectionRange: Range) {
  if (!selectionRange.intersectsNode(paragraphNode)) return null;

  const selectedRange = document.createRange();
  const startInside = paragraphNode.contains(selectionRange.startContainer);
  const endInside = paragraphNode.contains(selectionRange.endContainer);

  if (startInside) {
    selectedRange.setStart(selectionRange.startContainer, selectionRange.startOffset);
  } else {
    selectedRange.selectNodeContents(paragraphNode);
    selectedRange.collapse(true);
  }

  if (endInside) {
    selectedRange.setEnd(selectionRange.endContainer, selectionRange.endOffset);
  } else {
    const paragraphRange = document.createRange();
    paragraphRange.selectNodeContents(paragraphNode);
    selectedRange.setEnd(paragraphRange.endContainer, paragraphRange.endOffset);
    paragraphRange.detach();
  }

  if (!selectedRange.toString()) {
    selectedRange.detach();
    return null;
  }
  return selectedRange;
}

export function getSelectionBoundingRect(range: Range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  const base = rects.length ? rects : [range.getBoundingClientRect()];
  const usable = base.filter((rect) => rect.width > 0 && rect.height > 0);
  if (!usable.length) return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
  const left = Math.min(...usable.map((rect) => rect.left));
  const right = Math.max(...usable.map((rect) => rect.right));
  const top = Math.min(...usable.map((rect) => rect.top));
  const bottom = Math.max(...usable.map((rect) => rect.bottom));
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

export function getReaderDoubleClickWordRange(clientX: number, clientY: number, paragraph: HTMLElement) {
  const caretRange = getCaretRangeFromPoint(clientX, clientY);
  if (!caretRange || !paragraph.contains(caretRange.startContainer)) return null;
  const textNode = caretRange.startContainer.nodeType === Node.TEXT_NODE ? caretRange.startContainer : getClosestTextNode(caretRange.startContainer);
  if (!textNode?.textContent) return null;
  const offset = Math.min(Math.max(0, caretRange.startOffset), textNode.textContent.length);
  const bounds = getWordBounds(textNode.textContent, offset);
  if (!bounds || bounds.start === bounds.end) return null;
  const range = document.createRange();
  range.setStart(textNode, bounds.start);
  range.setEnd(textNode, bounds.end);
  return range;
}

function getCaretRangeFromPoint(clientX: number, clientY: number) {
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(clientX, clientY);
  }
  if (typeof document.caretPositionFromPoint === 'function') {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

function getClosestTextNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return node;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  return walker.nextNode();
}

function getWordBounds(text: string, offset: number) {
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
  if (segmenter) {
    for (const segment of segmenter.segment(text)) {
      const start = segment.index;
      const end = start + segment.segment.length;
      if (offset >= start && offset <= end && segment.isWordLike) return { start, end };
    }
  }
  const pivot = Math.min(Math.max(0, offset), Math.max(0, text.length - 1));
  if (!isReaderWordCharacter(text[pivot])) return null;
  let start = pivot;
  let end = pivot + 1;
  while (start > 0 && isReaderWordCharacter(text[start - 1])) start -= 1;
  while (end < text.length && isReaderWordCharacter(text[end])) end += 1;
  return { start, end };
}

function isReaderWordCharacter(character: string | undefined) {
  return Boolean(character && /[\p{L}\p{N}_]/u.test(character));
}

export function getReaderSpeechSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

export function playReaderPageTurnSound(enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  try {
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(220, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    window.setTimeout(() => { void context.close(); }, 180);
  } catch {
    // Browser audio policy or unavailable devices should not interrupt reading.
  }
}

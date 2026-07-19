import { useMemo } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Translator } from '../../i18n';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { Book, ReaderHighlightColor, ReaderInfoSlot, ReaderSettings } from '../../types';
import { buildReaderEpubNoteLabelMap, formatReaderChapterTitle, getChapterLocation, getReaderHighlightIndexKey, getVisibleHighlightSegments, getVirtualParagraphRange, isReaderImageOnlyParagraph, parseReaderRichContentParagraph, shouldShowChapterStartBlock } from './readerModel';
import type { ReaderChapter, ReaderHighlightRange, ReaderPageChunk, ReaderStreamPage, ReaderVirtualRange } from './readerModel';
import type { ReaderReadAloudLocation } from './useReaderReadAloudController';

export type { ReaderChapter, ReaderPageChunk, ReaderStreamPage } from './readerModel';
export { buildReaderPageStream, getReaderSpreadPages } from './readerModel';

type ReaderContentParagraphEntry = {
  paragraph: string;
  paragraphIndex: number;
  startOffset: number;
};

type ReaderContentProps = {
  book: Book;
  settings: ReaderSettings;
  chapters: ReaderChapter[];
  activeChapterIndex: number;
  activeParagraphIndex: number;
  visibleChapters: ReaderChapter[];
  visiblePageStream: ReaderStreamPage[];
  virtualRange: ReaderVirtualRange;
  progress: number;
  runningPageCount: number;
  pageTurnDirection: 'next' | 'prev';
  pageTurnKey: number;
  expandedTitleIds: Set<string>;
  highlightIndex: Map<string, ReaderHighlightRange[]>;
  debouncedReaderSearchQuery: string;
  readerSearchHighlightColor: ExtendedSettings['readerSearchHighlightColor'];
  highlightOverlapStrategy: ExtendedSettings['highlightOverlapStrategy'];
  readAloudLocation: ReaderReadAloudLocation | null;
  virtualParagraphWindowSize: number;
  t: Translator;
  onToggleTitleExpanded: (chapterId: string) => void;
  onJumpEpubNote: (noteId: string) => void;
  selectWordFromDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  startLongPressSelection: (event: PointerEvent<HTMLElement>) => void;
  cancelLongPressSelection: () => void;
  openHighlightMenu: (event: MouseEvent<HTMLElement>, highlight: ReaderHighlightRange) => void;
  startLongPressMenu: (event: PointerEvent<HTMLElement>, openMenu: (clientX: number, clientY: number, target: HTMLElement) => void) => void;
  openHighlightMenuAt: (clientX: number, clientY: number, target: HTMLElement, highlight: ReaderHighlightRange) => void;
  cancelLongPressMenu: () => void;
  suppressClickAfterLongPress: (event: MouseEvent<HTMLElement>) => void;
  onPageWidthGripKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  startPageWidthDrag: (event: PointerEvent<HTMLDivElement>) => void;
};

const readerEpubNoteJoiner = '\u2060';

export function ReaderContent({
  book,
  settings,
  chapters,
  activeChapterIndex,
  activeParagraphIndex,
  visibleChapters,
  visiblePageStream,
  virtualRange,
  progress,
  runningPageCount,
  pageTurnDirection,
  pageTurnKey,
  expandedTitleIds,
  highlightIndex,
  debouncedReaderSearchQuery,
  readerSearchHighlightColor,
  highlightOverlapStrategy,
  readAloudLocation,
  virtualParagraphWindowSize,
  t,
  onToggleTitleExpanded,
  onJumpEpubNote,
  selectWordFromDoubleClick,
  startLongPressSelection,
  cancelLongPressSelection,
  openHighlightMenu,
  startLongPressMenu,
  openHighlightMenuAt,
  cancelLongPressMenu,
  suppressClickAfterLongPress,
  onPageWidthGripKeyDown,
  startPageWidthDrag,
}: ReaderContentProps) {
  const readerWidthGrip = <div className="reader-width-grip" role="separator" aria-label={t('reader.pageWidth')} tabIndex={0} aria-orientation="vertical" aria-valuemin={420} aria-valuemax={1200} aria-valuenow={settings.pageWidth} onKeyDown={onPageWidthGripKeyDown} onPointerDown={startPageWidthDrag}><span /></div>;
  const pageTurnData = settings.layoutMode === 'page' ? pageTurnKey : undefined;
  const epubNoteLabels = useMemo(() => buildReaderEpubNoteLabelMap(chapters.flatMap((chapter) => chapter.paragraphs)), [chapters]);
  return (
    <div className={`reader-page-spread turn-${pageTurnDirection}`} data-page-turn={pageTurnData}>
      {settings.layoutMode === 'flow' && virtualRange.before > 0 ? <div className="reader-virtual-spacer">{t('reader.virtualBefore', { count: virtualRange.before })}</div> : null}
      {(settings.layoutMode === 'page' ? visiblePageStream : visibleChapters).map((item, itemIndex) => {
        const streamPage = settings.layoutMode === 'page' ? item as ReaderStreamPage : null;
        const chapter = streamPage ? chapters[streamPage.visibleChapterPosition] : item as ReaderChapter;
        const displayChapterTitle = formatReaderChapterTitle(chapter.title, settings.titleNumberCleanup);
        const pageModeChunk = streamPage ? streamPage.chunk : null;
        const virtualParagraphRange = settings.layoutMode === 'flow' && chapter.paragraphs.length > 400
          ? getVirtualParagraphRange(chapter.paragraphs.length, chapter.index === activeChapterIndex ? activeParagraphIndex : 0, virtualParagraphWindowSize)
          : null;
        const paragraphEntries = getReaderContentParagraphEntries(chapter, pageModeChunk, virtualParagraphRange);
        const showChapterStart = shouldShowReaderChapterTitle(settings, pageModeChunk);
        const titleExpanded = expandedTitleIds.has(chapter.id);
        const pageNumber = streamPage
          ? streamPage.streamIndex + 1
          : (settings.layoutMode === 'flow' ? chapter.index + 1 : Math.min(itemIndex + 1, Math.max(1, runningPageCount)));
        return (
          <section className="reader-page" id={chapter.id} key={`${chapter.id}-${streamPage?.streamIndex ?? streamPage?.pageInChapter ?? 'flow'}`} data-chapter-index={chapter.index}>
            {settings.headerVisible ? <ReaderRunningInfo className="reader-running-header" slots={[settings.headerLeft, settings.headerCenter, settings.headerRight]} book={book} chapter={chapter} progress={progress} pageNumber={pageNumber} pageCount={runningPageCount} customFormat={settings.headerFooterCustomFormat} headerFooterTimeFormat={settings.headerFooterTimeFormat} headerFooterProgressFormat={settings.headerFooterProgressFormat} /> : null}
            <div className="reader-body-frame">
              <div className="reader-body-content">
                {showChapterStart && settings.titleAlign !== 'hidden' ? (
                  <div className={`reader-chapter-start${titleExpanded ? ' expanded' : ''}`}>
                    <h2 className={`reader-chapter-title align-${settings.titleAlign}`} title={chapter.title}>{displayChapterTitle}</h2>
                    <button className="reader-title-line-toggle" type="button" title={titleExpanded ? t('reader.title.collapse') : t('reader.title.expand')} aria-label={titleExpanded ? t('reader.title.collapse') : t('reader.title.expand')} aria-expanded={titleExpanded} onClick={() => onToggleTitleExpanded(chapter.id)} />
                  </div>
                ) : null}
                {virtualParagraphRange && virtualParagraphRange.before > 0 ? <div className="reader-virtual-spacer">{t('reader.virtualParagraphBefore', { count: virtualParagraphRange.before })}</div> : null}
                {paragraphEntries.map(({ paragraph, paragraphIndex, startOffset }) => {
                  const readAloudActiveParagraph = readAloudLocation?.sourceChapterIndex === chapter.index && readAloudLocation.paragraphIndex === paragraphIndex;
                  const imageOnlyParagraph = isReaderImageOnlyParagraph(paragraph);
                  if (imageOnlyParagraph) {
                    return (
                      <figure id={`${chapter.id}-p-${paragraphIndex + 1}`} data-location={getChapterLocation(chapter.index, paragraphIndex)} data-page-start-offset={startOffset} className={readAloudActiveParagraph ? 'source-paragraph reader-epub-image-block read-aloud-current' : 'source-paragraph reader-epub-image-block'} key={`${chapter.id}-${paragraphIndex}-${startOffset}`}>
                        {renderReaderRichContentParagraph(paragraph, onJumpEpubNote, epubNoteLabels)}
                      </figure>
                    );
                  }
                  const noteBlock = hasReaderNoteTargetPart(paragraph);
                  const noteLabel = noteBlock ? getReaderEpubNoteTargetLabel(paragraph, epubNoteLabels, t('reader.epub.noteFallback')) : undefined;
                  const paragraphClassName = [
                    'source-paragraph',
                    readAloudActiveParagraph ? 'read-aloud-current' : '',
                    noteBlock ? 'reader-epub-note-block' : '',
                  ].filter(Boolean).join(' ');
                  const richContentParagraph = hasReaderRichNonTextPart(paragraph);
                  return (
                    <p id={`${chapter.id}-p-${paragraphIndex + 1}`} data-location={getChapterLocation(chapter.index, paragraphIndex)} data-page-start-offset={startOffset} data-note-label={noteLabel} className={paragraphClassName} key={`${chapter.id}-${paragraphIndex}-${startOffset}`} onDoubleClick={selectWordFromDoubleClick} onPointerDown={(event) => startLongPressSelection(event)} onPointerMove={cancelLongPressSelection} onPointerUp={cancelLongPressSelection} onPointerCancel={cancelLongPressSelection}>{richContentParagraph ? renderReaderRichContentParagraph(paragraph, onJumpEpubNote, epubNoteLabels) : renderHighlightedParagraph(paragraph, highlightIndex.get(getReaderHighlightIndexKey(chapter.index, paragraphIndex)) ?? [], chapter.index, paragraphIndex, startOffset, openHighlightMenu, (event, highlight) => startLongPressMenu(event, (clientX, clientY, target) => openHighlightMenuAt(clientX, clientY, target, highlight)), cancelLongPressMenu, suppressClickAfterLongPress, debouncedReaderSearchQuery, readerSearchHighlightColor, highlightOverlapStrategy)}</p>
                  );
                })}
                {virtualParagraphRange && virtualParagraphRange.after > 0 ? <div className="reader-virtual-spacer">{t('reader.virtualParagraphAfter', { count: virtualParagraphRange.after })}</div> : null}
              </div>
            </div>
            {settings.footerVisible ? <ReaderRunningInfo className="reader-running-footer" slots={[settings.footerLeft, settings.footerCenter, settings.footerRight]} book={book} chapter={chapter} progress={progress} pageNumber={pageNumber} pageCount={runningPageCount} customFormat={settings.headerFooterCustomFormat} headerFooterTimeFormat={settings.headerFooterTimeFormat} headerFooterProgressFormat={settings.headerFooterProgressFormat} /> : null}
            {settings.layoutMode === 'page' ? readerWidthGrip : null}
          </section>
        );
      })}
      {settings.layoutMode === 'flow' && virtualRange.after > 0 ? <div className="reader-virtual-spacer">{t('reader.virtualAfter', { count: virtualRange.after })}</div> : null}
    </div>
  );
}

function renderReaderRichContentParagraph(paragraph: string, onJumpEpubNote: (noteId: string) => void, epubNoteLabels: Map<string, string>) {
  return parseReaderRichContentParagraph(paragraph).map((part, index) => {
    if (part.type === 'text') return <span key={`text-${index}`}>{part.text}</span>;
    if (part.type === 'image') return <img className="reader-epub-image" key={`image-${index}`} src={resolveReaderImageSrc(part.src)} alt={part.alt} loading="lazy" draggable={false} />;
    if (part.type === 'noteRef') {
      return (
        <span className="reader-epub-note-cluster" key={`note-ref-${index}`}>
          {readerEpubNoteJoiner}<button className="reader-epub-note-ref" type="button" onClick={(event) => { event.stopPropagation(); onJumpEpubNote(part.id); }}>{epubNoteLabels.get(part.id) ?? part.label}</button>{readerEpubNoteJoiner}
        </span>
      );
    }
    return <span className="reader-epub-note-target" id={getReaderEpubNoteTargetDomId(part.id)} key={`note-target-${index}`} aria-hidden="true" />;
  });
}

function hasReaderNoteTargetPart(paragraph: string) {
  return parseReaderRichContentParagraph(paragraph).some((part) => part.type === 'noteTarget');
}

function getReaderEpubNoteTargetLabel(paragraph: string, epubNoteLabels: Map<string, string>, fallbackLabel: string) {
  const target = parseReaderRichContentParagraph(paragraph).find((part) => part.type === 'noteTarget');
  return target?.type === 'noteTarget' ? epubNoteLabels.get(target.id) ?? fallbackLabel : undefined;
}

function hasReaderRichNonTextPart(paragraph: string) {
  return parseReaderRichContentParagraph(paragraph).some((part) => part.type !== 'text');
}

export function getReaderEpubNoteTargetDomId(id: string) {
  return `reader-epub-note-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function scrollToReaderEpubNoteTarget(id: string) {
  const target = document.getElementById(getReaderEpubNoteTargetDomId(id));
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resolveReaderImageSrc(src: string) {
  if (/^(?:https?|data|blob|asset):/i.test(src)) return src;
  try {
    return convertFileSrc(src);
  } catch {
    return src;
  }
}

function getReaderContentParagraphEntries(chapter: ReaderChapter, pageModeChunk: ReaderPageChunk | null, virtualParagraphRange: ReaderVirtualRange | null): ReaderContentParagraphEntry[] {
  if (pageModeChunk) {
    return pageModeChunk.entries.map((entry) => ({ paragraph: entry.text, paragraphIndex: entry.paragraphIndex, startOffset: entry.startOffset }));
  }
  if (virtualParagraphRange) {
    return chapter.paragraphs.slice(virtualParagraphRange.start, virtualParagraphRange.end).map((paragraph, localIndex) => ({ paragraph, paragraphIndex: virtualParagraphRange.start + localIndex, startOffset: 0 }));
  }
  return chapter.paragraphs.map((paragraph, paragraphIndex) => ({ paragraph, paragraphIndex, startOffset: 0 }));
}

function shouldShowReaderChapterTitle(settings: ReaderSettings, pageModeChunk: ReaderPageChunk | null) {
  if (!pageModeChunk) return true;
  if (!settings.titleOnlyOnChapterStart) return true;
  return shouldShowChapterStartBlock(pageModeChunk.paragraphIndex, pageModeChunk.startOffset);
}

function renderHighlightedParagraph(
  text: string,
  highlights: ReaderHighlightRange[],
  chapterIndex: number,
  paragraphIndex: number,
  pageStartOffset: number,
  onHighlightContextMenu: (event: MouseEvent<HTMLElement>, highlight: ReaderHighlightRange) => void,
  onHighlightLongPress: (event: PointerEvent<HTMLElement>, highlight: ReaderHighlightRange) => void,
  onLongPressCancel: () => void,
  suppressClickAfterLongPress: (event: MouseEvent<HTMLElement>) => void,
  searchQuery = '',
  searchHighlightColor: ExtendedSettings['readerSearchHighlightColor'] = 'blue',
  highlightOverlapStrategy: ExtendedSettings['highlightOverlapStrategy'] = 'first-start-longest',
) {
  const relevant = getVisibleHighlightSegments(text, highlights, chapterIndex, paragraphIndex, pageStartOffset, { overlapStrategy: highlightOverlapStrategy });
  const searchNeedle = searchQuery.trim().normalize('NFKC').toLowerCase();
  if (!relevant.length && !searchNeedle) return text;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  function pushText(value: string, keyPrefix: string) {
    if (!searchNeedle) {
      nodes.push(value);
      return;
    }
    let localCursor = 0;
    const normalized = value.normalize('NFKC').toLowerCase();
    let matchIndex = normalized.indexOf(searchNeedle);
    let keyIndex = 0;
    while (matchIndex >= 0) {
      if (matchIndex > localCursor) nodes.push(value.slice(localCursor, matchIndex));
      const end = Math.min(value.length, matchIndex + searchNeedle.length);
      nodes.push(<mark className={`reader-search-mark color-${searchHighlightColor}`} key={`${keyPrefix}-search-${keyIndex}`}>{value.slice(matchIndex, end)}</mark>);
      localCursor = end;
      keyIndex += 1;
      matchIndex = normalized.indexOf(searchNeedle, localCursor);
    }
    if (localCursor < value.length) nodes.push(value.slice(localCursor));
  }
  relevant.forEach((highlight, index) => {
    if (highlight.start > cursor) pushText(text.slice(cursor, highlight.start), `${chapterIndex}-${paragraphIndex}-${pageStartOffset}-${index}-pre`);
    const color = highlight.color ?? 'yellow';
    nodes.push(<mark className={`reader-highlight color-${color}${highlight.note ? ' has-note' : ''}`} data-highlight-symbol={getReaderHighlightSymbol(color)} title={highlight.note || undefined} key={`${chapterIndex}-${paragraphIndex}-${pageStartOffset}-${index}`} onContextMenu={(event) => onHighlightContextMenu(event, highlight)} onPointerDown={(event) => onHighlightLongPress(event, highlight)} onPointerMove={onLongPressCancel} onPointerUp={onLongPressCancel} onPointerCancel={onLongPressCancel} onClickCapture={suppressClickAfterLongPress}>{highlight.text}</mark>);
    cursor = Math.max(cursor, highlight.end);
  });
  if (cursor < text.length) pushText(text.slice(cursor), `${chapterIndex}-${paragraphIndex}-${pageStartOffset}-tail`);
  return nodes;
}

function getReaderHighlightSymbol(color: ReaderHighlightColor) {
  return color === 'yellow' ? 'Y' : color === 'green' ? 'G' : color === 'blue' ? 'B' : color === 'pink' ? 'P' : color === 'violet' ? 'V' : 'R';
}

function ReaderRunningInfo({ className, slots, book, chapter, progress, pageNumber, pageCount, customFormat, headerFooterTimeFormat, headerFooterProgressFormat }: { className: string; slots: [ReaderInfoSlot, ReaderInfoSlot, ReaderInfoSlot]; book: Book; chapter: ReaderChapter; progress: number; pageNumber: number; pageCount: number; customFormat: string; headerFooterTimeFormat: ReaderSettings['headerFooterTimeFormat']; headerFooterProgressFormat: ReaderSettings['headerFooterProgressFormat'] }) {
  return <div className={className}><span>{slotText(slots[0], book, chapter, progress, pageNumber, pageCount, customFormat, headerFooterTimeFormat, headerFooterProgressFormat)}</span><span>{slotText(slots[1], book, chapter, progress, pageNumber, pageCount, customFormat, headerFooterTimeFormat, headerFooterProgressFormat)}</span><span>{slotText(slots[2], book, chapter, progress, pageNumber, pageCount, customFormat, headerFooterTimeFormat, headerFooterProgressFormat)}</span></div>;
}

function slotText(slot: ReaderSettings['headerLeft'], book: Book, chapter: ReaderChapter, progress: number, pageNumber: number, pageCount: number, customFormat: string, headerFooterTimeFormat: ReaderSettings['headerFooterTimeFormat'], headerFooterProgressFormat: ReaderSettings['headerFooterProgressFormat']) {
  if (slot === 'title') return book.displayTitle || book.title;
  if (slot === 'chapter') return chapter.title;
  if (slot === 'progress') return formatReaderRunningInfoProgress(progress, pageNumber, pageCount, headerFooterProgressFormat);
  if (slot === 'page') return `${pageNumber}/${pageCount}`;
  if (slot === 'time') return formatReaderRunningInfoTime(headerFooterTimeFormat);
  if (slot === 'custom') return formatReaderRunningInfoTemplate(customFormat, book, chapter, progress, pageNumber, pageCount, headerFooterTimeFormat, headerFooterProgressFormat);
  return '';
}

function formatReaderRunningInfoTime(timeFormat: ReaderSettings['headerFooterTimeFormat']) {
  if (timeFormat === 'short-12h') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  if (timeFormat === 'date-time') return new Date().toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatReaderRunningInfoProgress(progress: number, pageNumber: number, pageCount: number, progressFormat: ReaderSettings['headerFooterProgressFormat']) {
  if (progressFormat === 'current-page') return String(pageNumber);
  if (progressFormat === 'chapter-page') return `${pageNumber}/${pageCount}`;
  if (progressFormat === 'total-pages') return String(pageCount);
  return `${progress}%`;
}

function formatReaderRunningInfoTemplate(format: string, book: Book, chapter: ReaderChapter, progress: number, pageNumber: number, pageCount: number, headerFooterTimeFormat: ReaderSettings['headerFooterTimeFormat'], headerFooterProgressFormat: ReaderSettings['headerFooterProgressFormat']) {
  const time = formatReaderRunningInfoTime(headerFooterTimeFormat);
  const progressText = formatReaderRunningInfoProgress(progress, pageNumber, pageCount, headerFooterProgressFormat);
  return (format || '{title} · {chapter} · {progress} · {page}')
    .replaceAll('{title}', book.displayTitle || book.title)
    .replaceAll('{chapter}', chapter.title)
    .replaceAll('{progress}', progressText)
    .replaceAll('{page}', `${pageNumber}/${pageCount}`)
    .replaceAll('{time}', time);
}

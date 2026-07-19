import type { ReaderStreamPage } from './ReaderContent';
import { getReaderFixedMenuPosition } from './readerModel';

export type MoyuToolbarTooltip = {
  text: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
};

const moyuContextMenuWidth = 176;
const moyuContextMenuHeight = 176;
const moyuContextMenuMargin = 8;
const readerHighlightMenuWidth = 280;
const readerHighlightMenuHeight = 430;
const readerHighlightMenuMargin = 8;

export function getMoyuTooltipTarget(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
}

export function getMoyuToolbarTooltip(event: React.PointerEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>): MoyuToolbarTooltip | null {
  const target = getMoyuTooltipTarget(event.target);
  const currentTarget = event.currentTarget;
  if (!target || !currentTarget.contains(target)) return null;
  const tooltip = target.dataset.tooltip;
  const canvas = currentTarget.closest<HTMLElement>('.moyu-reader-canvas');
  if (!tooltip || !canvas) return null;
  const targetRect = target.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const bottomToolbar = currentTarget.classList.contains('bottom');
  return {
    text: tooltip,
    x: Math.round(targetRect.left + targetRect.width / 2 - canvasRect.left),
    y: Math.round((bottomToolbar ? targetRect.top : targetRect.bottom) - canvasRect.top + (bottomToolbar ? -10 : 10)),
    placement: bottomToolbar ? 'top' : 'bottom',
  };
}

export function getReaderStreamPagesSignature(pages: ReaderStreamPage[]) {
  return pages.map((page) => {
    const chunk = page.chunk;
    const entriesSignature = chunk.entries.map((entry) => `${entry.paragraphIndex}:${entry.startOffset}:${entry.endOffset}`).join(',');
    return `${page.streamIndex}:${page.chapterId}:${page.visibleChapterPosition}:${page.pageInChapter}:${chunk.pageIndex}:${chunk.paragraphIndex}:${chunk.startOffset}:${chunk.endOffset}:${entriesSignature}`;
  }).join('|');
}

export function buildReaderVisiblePageText(pages: ReaderStreamPage[]) {
  return pages.map((page) => page.chunk.text.trim()).filter(Boolean).join('\n');
}

export function resolveMoyuContextMenuPosition(clientX: number, clientY: number) {
  const maxX = window.innerWidth - moyuContextMenuWidth - moyuContextMenuMargin;
  const maxY = window.innerHeight - moyuContextMenuHeight - moyuContextMenuMargin;
  return {
    x: Math.max(moyuContextMenuMargin, Math.min(clientX, maxX)),
    y: Math.max(moyuContextMenuMargin, Math.min(clientY, maxY)),
  };
}

export function resolveReaderHighlightMenuPosition(clientX: number, clientY: number, bounds?: { left: number; top: number; right: number; bottom: number }) {
  const viewportWidth = typeof window === 'undefined' ? readerHighlightMenuWidth + readerHighlightMenuMargin * 2 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? readerHighlightMenuHeight + readerHighlightMenuMargin * 2 : window.innerHeight;
  const viewportBounds = {
    left: 0,
    top: 0,
    right: viewportWidth,
    bottom: viewportHeight,
  };
  const safeBounds = bounds ? {
    left: Math.max(viewportBounds.left, bounds.left),
    top: Math.max(viewportBounds.top, bounds.top),
    right: Math.min(viewportBounds.right, bounds.right),
    bottom: Math.min(viewportBounds.bottom, bounds.bottom),
  } : viewportBounds;
  return getReaderFixedMenuPosition(
    clientX,
    clientY,
    safeBounds,
    { width: readerHighlightMenuWidth, height: readerHighlightMenuHeight },
  );
}

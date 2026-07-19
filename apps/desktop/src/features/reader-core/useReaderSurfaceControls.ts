import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { resolveReaderSpreadPageWidth } from './readerModel';

type ReaderSurfaceControlsOptions = {
  pageWidth: number;
  layoutMode: 'page' | 'flow';
  autoHideCursor: boolean;
  onPageWidthChange: (width: number) => void;
  captureFlowWidthAnchor: () => void;
  restoreFlowWidthAnchorAfterResize: () => void;
};

export function useReaderSurfaceControls({
  pageWidth,
  layoutMode,
  autoHideCursor,
  onPageWidthChange,
  captureFlowWidthAnchor,
  restoreFlowWidthAnchorAfterResize,
}: ReaderSurfaceControlsOptions) {
  const widthDragRef = useRef<{ startX: number; startWidth: number; frame: number | null; nextWidth: number; canvas: HTMLElement | null } | null>(null);
  const tocWidthDragRef = useRef<{ startX: number; startWidth: number; frame: number | null; nextWidth: number } | null>(null);
  const cursorHideTimerRef = useRef<number | null>(null);
  const pageWidthRestoreFrameRef = useRef<number | null>(null);
  const [tocWidth, setTocWidth] = useState(240);
  const [cursorHidden, setCursorHidden] = useState(false);

  function previewTocWidth(width: number) {
    if (typeof document === 'undefined') return;
    const canvas = document.querySelector<HTMLElement>('.reader-canvas');
    if (!canvas) return;
    canvas.style.setProperty('--reader-toc-width', `${Math.min(360, Math.max(180, Math.round(width)))}px`);
    canvas.classList.add('reader-toc-resizing');
  }

  function finishTocWidthPreview() {
    if (typeof document === 'undefined') return;
    document.querySelector<HTMLElement>('.reader-canvas')?.classList.remove('reader-toc-resizing');
  }

  function applyReaderPageWidthChange(width: number) {
    captureFlowWidthAnchor();
    onPageWidthChange(width);
    if (layoutMode !== 'flow') return;
    if (pageWidthRestoreFrameRef.current !== null) window.cancelAnimationFrame(pageWidthRestoreFrameRef.current);
    pageWidthRestoreFrameRef.current = window.requestAnimationFrame(() => {
      pageWidthRestoreFrameRef.current = null;
      restoreFlowWidthAnchorAfterResize();
    });
  }

  function previewReaderPageWidth(canvas: HTMLElement | null, width: number) {
    if (!canvas) return;
    const stage = canvas.querySelector<HTMLElement>('.reader-stage');
    const scroll = canvas.querySelector<HTMLElement>('.reader-book-scroll');
    const doublePage = stage?.classList.contains('layout-page') && stage.classList.contains('pages-double');
    const pageGap = Number.parseFloat(window.getComputedStyle(canvas).getPropertyValue('--reader-page-gap')) || 20;
    const effectiveWidth = resolveReaderSpreadPageWidth(width, scroll?.clientWidth || width, doublePage ? 'double' : 'single', pageGap);
    canvas.style.setProperty('--reader-page-width', `${effectiveWidth}px`);
    canvas.classList.add('reader-page-width-resizing');
  }

  function startPageWidthDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    captureFlowWidthAnchor();
    const canvas = event.currentTarget.closest<HTMLElement>('.reader-canvas');
    widthDragRef.current = { startX: event.clientX, startWidth: pageWidth, frame: null, nextWidth: pageWidth, canvas };
    previewReaderPageWidth(canvas, pageWidth);
    event.currentTarget.setPointerCapture(event.pointerId);
    function flushWidthDrag() {
      const drag = widthDragRef.current;
      if (!drag) return;
      drag.frame = null;
      previewReaderPageWidth(drag.canvas, drag.nextWidth);
    }
    function onMove(moveEvent: PointerEvent) {
      const drag = widthDragRef.current;
      if (!drag) return;
      drag.nextWidth = Math.min(1200, Math.max(420, drag.startWidth + (moveEvent.clientX - drag.startX) * 2));
      if (drag.frame === null) drag.frame = window.requestAnimationFrame(flushWidthDrag);
    }
    function onUp() {
      const drag = widthDragRef.current;
      if (drag?.frame !== null && drag?.frame !== undefined) window.cancelAnimationFrame(drag.frame);
      if (drag) {
        previewReaderPageWidth(drag.canvas, drag.nextWidth);
        applyReaderPageWidthChange(drag.nextWidth);
        window.requestAnimationFrame(() => drag.canvas?.classList.remove('reader-page-width-resizing'));
      }
      widthDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function startTocWidthDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    tocWidthDragRef.current = { startX: event.clientX, startWidth: tocWidth, frame: null, nextWidth: tocWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    previewTocWidth(tocWidth);
    function flushTocWidthDrag() {
      const drag = tocWidthDragRef.current;
      if (!drag) return;
      drag.frame = null;
      previewTocWidth(drag.nextWidth);
    }
    function onMove(moveEvent: PointerEvent) {
      const drag = tocWidthDragRef.current;
      if (!drag) return;
      drag.nextWidth = Math.min(360, Math.max(180, drag.startWidth + moveEvent.clientX - drag.startX));
      if (drag.frame === null) drag.frame = window.requestAnimationFrame(flushTocWidthDrag);
    }
    function onUp() {
      const drag = tocWidthDragRef.current;
      if (drag?.frame !== null && drag?.frame !== undefined) window.cancelAnimationFrame(drag.frame);
      if (drag) {
        previewTocWidth(drag.nextWidth);
        setTocWidth(drag.nextWidth);
      }
      finishTocWidthPreview();
      tocWidthDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onTocWidthGripKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 32 : 16;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') setTocWidth(180);
    else if (event.key === 'End') setTocWidth(360);
    else setTocWidth((value) => Math.min(360, Math.max(180, value + (event.key === 'ArrowLeft' ? -step : step))));
  }

  function onPageWidthGripKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 20;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Home') applyReaderPageWidthChange(420);
    else if (event.key === 'End') applyReaderPageWidthChange(1200);
    else applyReaderPageWidthChange(Math.min(1200, Math.max(420, pageWidth + (event.key === 'ArrowRight' ? step : -step))));
  }

  function onReaderPointerMove() {
    if (!autoHideCursor) return;
    setCursorHidden(false);
    if (cursorHideTimerRef.current !== null) window.clearTimeout(cursorHideTimerRef.current);
    cursorHideTimerRef.current = window.setTimeout(() => {
      setCursorHidden(true);
      cursorHideTimerRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    if (autoHideCursor) return;
    if (cursorHideTimerRef.current !== null) window.clearTimeout(cursorHideTimerRef.current);
    cursorHideTimerRef.current = null;
    setCursorHidden(false);
  }, [autoHideCursor]);

  useEffect(() => () => {
    if (cursorHideTimerRef.current !== null) window.clearTimeout(cursorHideTimerRef.current);
    if (pageWidthRestoreFrameRef.current !== null) window.cancelAnimationFrame(pageWidthRestoreFrameRef.current);
  }, []);

  return { tocWidth, cursorHidden, setCursorHidden, startPageWidthDrag, startTocWidthDrag, onTocWidthGripKeyDown, onPageWidthGripKeyDown, onReaderPointerMove };
}

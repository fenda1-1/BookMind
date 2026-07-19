import type { KeyboardEvent, MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  READER_RIGHT_PANEL_MAX_WIDTH,
  READER_RIGHT_PANEL_MIN_WIDTH,
  finishReaderRightPanelWidthPreview,
  previewReaderRightPanelWidth,
  setReaderRightPanelWidth,
} from '../../features/reader-core/readerRightPanelSessions';
import type { ReaderPanelId, ReaderPanelPlacement } from '../ReaderWorkspace';

type ReaderSidePanelsProps = {
  openPanels: ReaderPanelId[];
  overlayPanelWidth: number;
  panelPlacements: Record<ReaderPanelId, ReaderPanelPlacement>;
  panelContent: Record<ReaderPanelId, ReactNode>;
  panelLabels: Record<ReaderPanelId, string>;
  panelTitle: (placement: ReaderPanelPlacement) => string;
  panelDockDragRef: MutableRefObject<{ panel: ReaderPanelId; pointerId: number; startX: number; frame: number | null; nextPlacement: ReaderPanelPlacement } | null>;
  overlayPanelWidthDragRef: MutableRefObject<{ startX: number; startWidth: number; frame: number | null; nextWidth: number } | null>;
  setOverlayPanelWidth?: (width: number | ((current: number) => number)) => void;
  setReaderPanelPlacement: (panel: ReaderPanelId, placement: ReaderPanelPlacement) => void;
};

export function ReaderSidePanels({
  openPanels,
  overlayPanelWidth,
  panelPlacements,
  panelContent,
  panelLabels,
  panelTitle,
  panelDockDragRef,
  overlayPanelWidthDragRef,
  setOverlayPanelWidth = setReaderRightPanelWidth,
  setReaderPanelPlacement,
}: ReaderSidePanelsProps) {
  function startReaderPanelDockDrag(panel: ReaderPanelId, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    panelDockDragRef.current = { panel, pointerId: event.pointerId, startX: event.clientX, frame: null, nextPlacement: panelPlacements[panel] };
    event.currentTarget.setPointerCapture(event.pointerId);

    function flushPanelDockDrag() {
      const drag = panelDockDragRef.current;
      if (!drag) return;
      drag.frame = null;
      setReaderPanelPlacement(drag.panel, drag.nextPlacement);
    }

    function onMove(moveEvent: PointerEvent) {
      const drag = panelDockDragRef.current;
      if (!drag) return;
      const dockThreshold = window.innerWidth - Math.max(300, overlayPanelWidth * 0.72);
      drag.nextPlacement = moveEvent.clientX >= dockThreshold ? 'sidebar' : 'floating';
      if (drag.frame === null) {
        const frame = window.requestAnimationFrame(flushPanelDockDrag);
        const currentDrag = panelDockDragRef.current;
        if (currentDrag) currentDrag.frame = frame;
      }
    }

    function onUp() {
      const drag = panelDockDragRef.current;
      if (drag) {
        if (drag.frame !== null) window.cancelAnimationFrame(drag.frame);
        setReaderPanelPlacement(drag.panel, drag.nextPlacement);
      }
      panelDockDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function startOverlayPanelWidthDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    overlayPanelWidthDragRef.current = { startX: event.clientX, startWidth: overlayPanelWidth, frame: null, nextWidth: overlayPanelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    previewReaderRightPanelWidth(overlayPanelWidth);

    function flushOverlayWidthPreview() {
      const drag = overlayPanelWidthDragRef.current;
      if (!drag) return;
      drag.frame = null;
      previewReaderRightPanelWidth(drag.nextWidth);
    }

    function onMove(moveEvent: PointerEvent) {
      const drag = overlayPanelWidthDragRef.current;
      if (!drag) return;
      drag.nextWidth = Math.min(READER_RIGHT_PANEL_MAX_WIDTH, Math.max(READER_RIGHT_PANEL_MIN_WIDTH, Math.round(drag.startWidth + drag.startX - moveEvent.clientX)));
      if (drag.frame === null) {
        drag.frame = window.requestAnimationFrame(flushOverlayWidthPreview);
      }
    }

    function onUp() {
      const drag = overlayPanelWidthDragRef.current;
      if (drag && drag.frame !== null) window.cancelAnimationFrame(drag.frame);
      if (drag) {
        previewReaderRightPanelWidth(drag.nextWidth);
        setOverlayPanelWidth(drag.nextWidth);
      }
      finishReaderRightPanelWidthPreview();
      overlayPanelWidthDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onOverlayPanelWidthGripKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 20;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    if (event.key === 'Home') setOverlayPanelWidth(READER_RIGHT_PANEL_MIN_WIDTH);
    else if (event.key === 'End') setOverlayPanelWidth(READER_RIGHT_PANEL_MAX_WIDTH);
    else setOverlayPanelWidth((value) => value + (event.key === 'ArrowLeft' ? step : -step));
  }

  return (
    <>
      {openPanels.map((panel) => {
        const placement = panelPlacements[panel];
        const label = panelLabels[panel];
        return (
          <div className={`reader-overlay-panel reader-panel-${panel} placement-${placement}`} style={{ width: placement === 'floating' ? overlayPanelWidth : undefined }} key={panel}>
            <button
              className="reader-panel-dock-handle reader-panel-dock-top-grip"
              type="button"
              aria-label={label}
              title={panelTitle(placement)}
              onPointerDown={(event) => startReaderPanelDockDrag(panel, event)}
              onDoubleClick={() => setReaderPanelPlacement(panel, placement === 'sidebar' ? 'floating' : 'sidebar')}
            >
              <span aria-hidden="true" />
            </button>
            <div className="reader-overlay-resize-grip" role="separator" aria-label={label} tabIndex={0} aria-orientation="vertical" aria-valuemin={READER_RIGHT_PANEL_MIN_WIDTH} aria-valuemax={READER_RIGHT_PANEL_MAX_WIDTH} aria-valuenow={overlayPanelWidth} onKeyDown={onOverlayPanelWidthGripKeyDown} onPointerDown={startOverlayPanelWidthDrag}><span /></div>
            {panelContent[panel]}
          </div>
        );
      })}
    </>
  );
}

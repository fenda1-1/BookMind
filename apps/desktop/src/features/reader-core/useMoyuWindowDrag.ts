import { useRef } from 'react';
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window';

type MoyuWindowDragState = {
  startScreenX: number;
  startScreenY: number;
  windowX: number;
  windowY: number;
  nextX: number;
  nextY: number;
  active: boolean;
};

type MoyuWindowDragPointer = {
  pointerId: number;
  screenX: number;
  screenY: number;
};

export function useMoyuWindowDrag(interactionLocked: boolean) {
  const moyuWindowDragRef = useRef<MoyuWindowDragState | null>(null);

  async function fallbackMoyuWindowDrag(pointer: MoyuWindowDragPointer, dragTarget: HTMLDivElement) {
    const currentWindow = getCurrentWindow();
    const position = await currentWindow.outerPosition();
    moyuWindowDragRef.current = { startScreenX: pointer.screenX, startScreenY: pointer.screenY, windowX: position.x, windowY: position.y, nextX: position.x, nextY: position.y, active: true };
    if (dragTarget.hasPointerCapture?.(pointer.pointerId) === false) dragTarget.setPointerCapture(pointer.pointerId);

    function onMove(moveEvent: PointerEvent) {
      const drag = moyuWindowDragRef.current;
      if (!drag) return;
      drag.nextX = drag.windowX + moveEvent.screenX - drag.startScreenX;
      drag.nextY = drag.windowY + moveEvent.screenY - drag.startScreenY;
      void getCurrentWindow().setPosition(new PhysicalPosition(Math.round(drag.nextX), Math.round(drag.nextY)));
    }

    function onUp() {
      const drag = moyuWindowDragRef.current;
      if (drag?.active) void getCurrentWindow().setPosition(new PhysicalPosition(Math.round(drag.nextX), Math.round(drag.nextY)));
      moyuWindowDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function startMoyuWindowDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (interactionLocked || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button,a,input,select,textarea,[role="button"],[data-moyu-no-drag="true"]')) return;
    const dragTarget = event.currentTarget;
    const pointer = { pointerId: event.pointerId, screenX: event.screenX, screenY: event.screenY };
    event.preventDefault();
    event.stopPropagation();
    try {
      await getCurrentWindow().startDragging();
    } catch {
      await fallbackMoyuWindowDrag(pointer, dragTarget);
    }
  }

  return { startMoyuWindowDrag };
}

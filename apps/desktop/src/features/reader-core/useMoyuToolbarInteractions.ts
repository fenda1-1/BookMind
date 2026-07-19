import { useEffect, useRef, useState } from 'react';
import { isReaderShortcutEditableTarget } from './readerInteractionModel';
import { matchesMoyuShortcut, patchMoyuReaderProfile, type MoyuReaderProfile } from './moyuReaderSettingsModel';
import { getMoyuToolbarTooltip, getMoyuTooltipTarget, resolveMoyuContextMenuPosition, type MoyuToolbarTooltip } from './readerPageViewModel';

type UseMoyuToolbarInteractionsOptions = {
  moyuReader: boolean;
  moyuSettings: MoyuReaderProfile;
  updateMoyuSettings: (updater: (settings: MoyuReaderProfile) => MoyuReaderProfile) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onExit: () => void;
};

const moyuReaderTextColors = ['currentColor', '#111827', '#3b3025', '#f6f1e8', '#d9f99d'];

export function useMoyuToolbarInteractions({
  moyuReader,
  moyuSettings,
  updateMoyuSettings,
  onPreviousPage,
  onNextPage,
  onExit,
}: UseMoyuToolbarInteractionsOptions) {
  const [moyuContextMenu, setMoyuContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [moyuToolbarTooltip, setMoyuToolbarTooltip] = useState<MoyuToolbarTooltip | null>(null);
  const moyuToolbarHoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!moyuContextMenu) return;
    function closeMoyuContextMenu() {
      setMoyuContextMenu(null);
    }
    window.addEventListener('pointerdown', closeMoyuContextMenu);
    window.addEventListener('keydown', closeMoyuContextMenu);
    return () => {
      window.removeEventListener('pointerdown', closeMoyuContextMenu);
      window.removeEventListener('keydown', closeMoyuContextMenu);
    };
  }, [moyuContextMenu]);

  useEffect(() => () => {
    if (moyuToolbarHoverTimerRef.current !== null) window.clearTimeout(moyuToolbarHoverTimerRef.current);
  }, []);

  function updateMoyuTooltip(event: React.PointerEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) {
    setMoyuToolbarTooltip(getMoyuToolbarTooltip(event));
  }

  function clearMoyuTooltip(event: React.PointerEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) {
    if (moyuToolbarHoverTimerRef.current !== null) {
      window.clearTimeout(moyuToolbarHoverTimerRef.current);
      moyuToolbarHoverTimerRef.current = null;
    }
    const currentTooltipTarget = getMoyuTooltipTarget(event.target);
    const nextTooltipTarget = getMoyuTooltipTarget(event.relatedTarget);
    if (currentTooltipTarget && nextTooltipTarget === currentTooltipTarget) return;
    setMoyuToolbarTooltip(null);
  }

  function showMoyuTooltipWithDelay(event: React.PointerEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) {
    if (moyuToolbarHoverTimerRef.current !== null) window.clearTimeout(moyuToolbarHoverTimerRef.current);
    if (moyuSettings.toolbarRevealMode !== 'hover') return;
    const delay = Math.max(0, moyuSettings.toolbarRevealDelayMs);
    const nextEvent = event;
    moyuToolbarHoverTimerRef.current = window.setTimeout(() => {
      updateMoyuTooltip(nextEvent);
      moyuToolbarHoverTimerRef.current = null;
    }, delay);
  }

  function blurMoyuToolbarPointerTarget(event: React.PointerEvent<HTMLDivElement>) {
    const target = getMoyuTooltipTarget(event.target);
    if (target instanceof HTMLButtonElement) window.setTimeout(() => target.blur(), 0);
  }

  function adjustMoyuTextScale(delta: number) {
    updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { textScale: Number((settings.textScale + delta).toFixed(2)) }));
  }

  function adjustMoyuOpacity(delta: number) {
    updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { backgroundOpacity: Number((settings.backgroundOpacity + delta).toFixed(2)) }));
  }

  function adjustMoyuAutoScrollSpeed(delta: number) {
    updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { autoScrollSpeed: settings.autoScrollSpeed + delta }));
  }

  function toggleMoyuToolbars() {
    updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { toolbarsHidden: !settings.toolbarsHidden }));
  }

  function cycleMoyuTextColor() {
    updateMoyuSettings((settings) => {
      const currentIndex = Math.max(0, moyuReaderTextColors.indexOf(settings.textColor || 'currentColor'));
      return patchMoyuReaderProfile(settings, { textColor: moyuReaderTextColors[(currentIndex + 1) % moyuReaderTextColors.length] });
    });
  }

  function onMoyuReaderKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (!moyuReader || isReaderShortcutEditableTarget(target)) return;
    const shortcuts = moyuSettings.shortcuts;
    if (matchesMoyuShortcut(shortcuts.toggleLock, event.nativeEvent)) {
      event.preventDefault();
      updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { interactionLocked: !settings.interactionLocked }));
    } else if (matchesMoyuShortcut(shortcuts.nextPage, event.nativeEvent)) {
      event.preventDefault();
      onNextPage();
    } else if (matchesMoyuShortcut(shortcuts.previousPage, event.nativeEvent)) {
      event.preventDefault();
      onPreviousPage();
    } else if (matchesMoyuShortcut(shortcuts.exit, event.nativeEvent)) {
      event.preventDefault();
      onExit();
    } else if (matchesMoyuShortcut(shortcuts.toggleAutoScroll, event.nativeEvent)) {
      event.preventDefault();
      updateMoyuSettings((settings) => patchMoyuReaderProfile(settings, { autoScrollEnabled: !settings.autoScrollEnabled }));
    } else if (matchesMoyuShortcut(shortcuts.toggleToolbars, event.nativeEvent)) {
      event.preventDefault();
      toggleMoyuToolbars();
    } else if (matchesMoyuShortcut(shortcuts.decreaseBackgroundOpacity, event.nativeEvent)) {
      event.preventDefault();
      adjustMoyuOpacity(-0.08);
    } else if (matchesMoyuShortcut(shortcuts.increaseBackgroundOpacity, event.nativeEvent)) {
      event.preventDefault();
      adjustMoyuOpacity(0.08);
    } else if (matchesMoyuShortcut(shortcuts.decreaseTextScale, event.nativeEvent)) {
      event.preventDefault();
      adjustMoyuTextScale(-0.08);
    } else if (matchesMoyuShortcut(shortcuts.increaseTextScale, event.nativeEvent)) {
      event.preventDefault();
      adjustMoyuTextScale(0.08);
    }
  }

  function openMoyuContextMenu(event: React.MouseEvent<HTMLElement>) {
    if (!moyuReader) return;
    event.preventDefault();
    event.stopPropagation();
    setMoyuContextMenu(resolveMoyuContextMenuPosition(event.clientX, event.clientY));
  }

  return {
    moyuContextMenu,
    moyuToolbarTooltip,
    setMoyuContextMenu,
    updateMoyuSettings,
    updateMoyuTooltip,
    clearMoyuTooltip,
    showMoyuTooltipWithDelay,
    blurMoyuToolbarPointerTarget,
    adjustMoyuTextScale,
    adjustMoyuOpacity,
    adjustMoyuAutoScrollSpeed,
    cycleMoyuTextColor,
    onMoyuReaderKeyDown,
    openMoyuContextMenu,
  };
}

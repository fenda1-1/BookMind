import { useEffect, type RefObject } from 'react';
import type { AppState } from './AppStateContext';

export function useAppLock(appState: AppState, appLockUnlockButtonRef: RefObject<HTMLButtonElement | null>) {
  const { extendedSettings, appLocked, setAppLocked, setCommandPaletteOpen } = appState;

  useEffect(() => {
    if (!extendedSettings.appLockEnabled) { setAppLocked(false); return; }
    let idleTimer: number | undefined;
    const scheduleIdleLock = () => {
      window.clearTimeout(idleTimer);
      const timeoutMs = Math.max(1, Number(extendedSettings.appLockIdleTimeoutMinutes) || 15) * 60 * 1000;
      idleTimer = window.setTimeout(() => {
        if (!extendedSettings.appLockEnabled) return;
        setCommandPaletteOpen(false);
        setAppLocked(true);
      }, timeoutMs);
    };
    const onActivity = () => { if (appLocked) return; scheduleIdleLock(); };
    scheduleIdleLock();
    window.addEventListener('pointerdown', onActivity, true);
    window.addEventListener('keydown', onActivity, true);
    window.addEventListener('wheel', onActivity, true);
    window.addEventListener('touchstart', onActivity, true);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', onActivity, true);
      window.removeEventListener('keydown', onActivity, true);
      window.removeEventListener('wheel', onActivity, true);
      window.removeEventListener('touchstart', onActivity, true);
    };
  }, [appLocked, extendedSettings.appLockEnabled, extendedSettings.appLockIdleTimeoutMinutes]);

  useEffect(() => { if (!appLocked) return; appLockUnlockButtonRef.current?.focus(); }, [appLocked]);
}

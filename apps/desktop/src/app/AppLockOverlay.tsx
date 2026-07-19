import type { RefObject } from 'react';

export function AppLockOverlay({ locked, unlockButtonRef, labels, onUnlock }: { locked: boolean; unlockButtonRef: RefObject<HTMLButtonElement | null>; labels: { title: string; description: string; unlock: string }; onUnlock: () => void }) {
  if (!locked) return null;
  return <div className="app-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="app-lock-title"><div className="app-lock-panel"><p className="eyebrow">BookMind</p><h2 id="app-lock-title">{labels.title}</h2><p>{labels.description}</p><button ref={unlockButtonRef} className="primary-btn" type="button" onClick={onUnlock}>{labels.unlock}</button></div></div>;
}

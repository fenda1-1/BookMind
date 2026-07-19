import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { App } from './App';
import { installSettingsUpdatedBridge } from '../services/settingsCenterService';
import { extendedSettingsStorageKey } from '../services/settingsCenter/defaults';
import { isTauriRuntime } from './platform';
import './styles.css';

const bootstrapStartedAt = performance.now();

function resolveBootTheme() {
  try {
    const stored = JSON.parse(localStorage.getItem(extendedSettingsStorageKey) ?? '{}') as { appTheme?: string };
    if (stored.appTheme === 'light' || stored.appTheme === 'dark') return stored.appTheme;
  } catch {
    // A damaged setting should never prevent the startup shell from rendering.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function finishBootSequence() {
  const bootShell = document.getElementById('bookmind-boot-shell');
  bootShell?.setAttribute('data-leaving', 'true');
  window.setTimeout(() => bootShell?.remove(), 180);
  performance.mark('bookmind:first-usable-frame', { detail: { elapsedMs: performance.now() - bootstrapStartedAt } });
  if (isTauriRuntime()) {
    void getCurrentWindow().show().catch((error) => console.warn('Failed to reveal BookMind window:', error));
  }
}

document.documentElement.dataset.bootTheme = resolveBootTheme();
performance.mark('bookmind:bootstrap-module');
installSettingsUpdatedBridge();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

requestAnimationFrame(() => requestAnimationFrame(finishBootSequence));

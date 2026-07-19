import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

type MoyuWindowSessionSnapshot = {
  sourceLabel: string;
  visibleLabels: string[];
};

const MOYU_WINDOW_SESSION_PREFIX = 'bookmind:moyu-window-session:';

function getMoyuWindowSessionKey(targetLabel: string) {
  return `${MOYU_WINDOW_SESSION_PREFIX}${targetLabel}`;
}

export async function beginMoyuWindowSession(targetLabel: string, sourceLabel: string) {
  const windows = await WebviewWindow.getAll();
  const visibility = await Promise.all(windows.map(async (appWindow) => ({
    appWindow,
    visible: await appWindow.isVisible().catch(() => false),
  })));
  const visibleWindows = visibility.filter(({ appWindow, visible }) => visible && appWindow.label !== targetLabel);
  const snapshot: MoyuWindowSessionSnapshot = {
    sourceLabel,
    visibleLabels: visibleWindows.map(({ appWindow }) => appWindow.label),
  };
  window.localStorage.setItem(getMoyuWindowSessionKey(targetLabel), JSON.stringify(snapshot));
  await Promise.all(visibleWindows.map(({ appWindow }) => appWindow.hide().catch(() => undefined)));
}

export async function restoreMoyuWindowSession(
  targetLabel: string,
  beforeShow?: (restoredWindows: WebviewWindow[]) => Promise<void>,
) {
  const snapshot = loadMoyuWindowSessionSnapshot(targetLabel);
  window.localStorage.removeItem(getMoyuWindowSessionKey(targetLabel));
  const labels = snapshot?.visibleLabels.length ? snapshot.visibleLabels : ['main'];
  const restoredWindows = (await Promise.all(labels.map((label) => WebviewWindow.getByLabel(label))))
    .filter((appWindow): appWindow is WebviewWindow => Boolean(appWindow));
  await beforeShow?.(restoredWindows);
  await Promise.all(restoredWindows.map((appWindow) => appWindow.show().catch(() => undefined)));
  const focusTarget = restoredWindows.find((appWindow) => appWindow.label === snapshot?.sourceLabel)
    ?? restoredWindows.find((appWindow) => appWindow.label === 'main')
    ?? restoredWindows[0];
  await focusTarget?.setFocus().catch(() => undefined);
  return restoredWindows;
}

function loadMoyuWindowSessionSnapshot(targetLabel: string): MoyuWindowSessionSnapshot | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getMoyuWindowSessionKey(targetLabel)) ?? 'null') as Partial<MoyuWindowSessionSnapshot> | null;
    if (!parsed || typeof parsed.sourceLabel !== 'string' || !Array.isArray(parsed.visibleLabels)) return null;
    return {
      sourceLabel: parsed.sourceLabel,
      visibleLabels: parsed.visibleLabels.filter((label): label is string => typeof label === 'string' && label !== targetLabel),
    };
  } catch {
    return null;
  }
}

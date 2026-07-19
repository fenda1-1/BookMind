import { availableMonitors, PhysicalPosition, PhysicalSize, primaryMonitor } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Translator } from '../../i18n';
import type { Book } from '../../types';
import { createReaderWindowStateEvent } from '../readerWorkspaceModel';
import { loadJson, type ReaderStoredState } from '../readerWorkspaceStorage';
import { recordLifecycleDiagnostic } from '../../services/lifecycleDiagnosticsService';

export type ReaderWindowGeometry = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  maximized?: boolean;
};

export type ReaderWindowWorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const standaloneReaderMinWidth = 760;
const standaloneReaderMinHeight = 560;
const standaloneReaderDefaultWidth = 1120;
const standaloneReaderDefaultHeight = 820;

export type OpenStandaloneReaderWindowOptions = {
  book: Book;
  state?: ReaderStoredState;
  chapterIndex?: number;
  extendedSettings: ExtendedSettings;
  t: Translator;
  detachedFromMain?: boolean;
  pathname?: string;
};

export function buildStandaloneReaderWindowSearch({
  bookId,
  state,
  chapterIndex,
  detachedFromMain = false,
}: {
  bookId: string;
  state?: ReaderStoredState;
  chapterIndex?: number;
  detachedFromMain?: boolean;
}) {
  const search = new URLSearchParams({ readerWindow: '1', bookId });
  const launchChapterIndex = chapterIndex ?? state?.activeChapterIndex;
  if (launchChapterIndex !== undefined) search.set('chapter', String(Math.max(0, launchChapterIndex)));
  if (state && launchChapterIndex === state.activeChapterIndex) {
    search.set('paragraph', String(Math.max(0, state.activeParagraphIndex)));
    search.set('screenPage', String(Math.max(0, state.activeScreenPage)));
  }
  if (detachedFromMain) search.set('detached', '1');
  return search;
}

export async function openStandaloneReaderWindow({
  book,
  state,
  chapterIndex,
  extendedSettings,
  t,
  detachedFromMain = false,
  pathname = window.location.pathname,
}: OpenStandaloneReaderWindowOptions) {
  const label = getStandaloneReaderWindowLabel(book.id);
  const windowKey = getStandaloneReaderWindowStorageKey(book.id);
  const savedWindow = loadJson<ReaderWindowGeometry>(windowKey, {});
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await revealStandaloneReaderWindow(existing, savedWindow);
    if (state) await existing.emit('bookmind:reader-window-state', { ...createReaderWindowStateEvent(book.id, state) });
    return { window: existing, created: false };
  }
  const search = buildStandaloneReaderWindowSearch({ bookId: book.id, state, chapterIndex, detachedFromMain });
  const readerWindow = new WebviewWindow(label, {
    url: `${pathname}?${search.toString()}`,
    title: `${getPrivacyBookTitle(book.displayTitle || book.title, extendedSettings)} · ${t('reader.windowTitle')}`,
    width: standaloneReaderDefaultWidth,
    height: standaloneReaderDefaultHeight,
    minWidth: standaloneReaderMinWidth,
    minHeight: standaloneReaderMinHeight,
    center: !hasSavedReaderWindowGeometry(savedWindow),
    resizable: true,
    decorations: false,
    visible: false,
    backgroundColor: resolveStandaloneReaderBackgroundColor(extendedSettings.appTheme),
  });
  readerWindow.once('tauri://created', () => {
    recordLifecycleDiagnostic('performance', 'reader-window.created', { bookId: book.id });
    void restoreStandaloneReaderWindowState(readerWindow, savedWindow, state, book.id);
    window.setTimeout(() => {
      void readerWindow.show().catch((error) => console.warn('Failed to reveal standalone reader fallback:', error));
    }, 4500);
  });
  readerWindow.once('tauri://error', (event) => console.error('Failed to create reader window:', event.payload));
  return { window: readerWindow, created: true };
}

export function resolveStandaloneReaderBackgroundColor(appTheme: ExtendedSettings['appTheme']): [number, number, number, number] {
  const dark = appTheme === 'dark' || (appTheme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return dark ? [23, 19, 15, 255] : [244, 238, 227, 255];
}

export function getStandaloneReaderWindowLabel(bookId: string) {
  return `reader-${bookId.replace(/[^a-zA-Z0-9-/:_]/g, '-')}`;
}

export function getStandaloneReaderWindowStorageKey(bookId: string) {
  return `bookmind:reader-window:${bookId}`;
}

function hasSavedReaderWindowGeometry(geometry: ReaderWindowGeometry) {
  return Number.isFinite(geometry.width) && Number.isFinite(geometry.height);
}

export function isStandaloneReaderWindowGeometryUsable(geometry: ReaderWindowGeometry | ReaderWindowWorkArea | null | undefined) {
  if (!geometry) return false;
  return [geometry.x, geometry.y, geometry.width, geometry.height].every(Number.isFinite)
    && geometry.width! >= standaloneReaderMinWidth
    && geometry.height! >= standaloneReaderMinHeight;
}

export function resolveStandaloneReaderWindowGeometryForWorkAreas(geometry: ReaderWindowGeometry, workAreas: ReaderWindowWorkArea[]): ReaderWindowGeometry {
  const safeWidth = Math.max(standaloneReaderMinWidth, Math.round(Number.isFinite(geometry.width) ? geometry.width! : standaloneReaderDefaultWidth));
  const safeHeight = Math.max(standaloneReaderMinHeight, Math.round(Number.isFinite(geometry.height) ? geometry.height! : standaloneReaderDefaultHeight));
  const hasPosition = Number.isFinite(geometry.x) && Number.isFinite(geometry.y);
  const safeGeometry = withStandaloneReaderMaximizedState({
    x: hasPosition ? Math.round(geometry.x!) : undefined,
    y: hasPosition ? Math.round(geometry.y!) : undefined,
    width: safeWidth,
    height: safeHeight,
  }, geometry.maximized === true);
  const usableAreas = workAreas.filter(isStandaloneReaderWindowGeometryUsable);
  if (!usableAreas.length || !hasPosition) return safeGeometry;
  const positionedGeometry = safeGeometry as ReaderWindowGeometry & { x: number; y: number; width: number; height: number };
  const visibleArea = usableAreas.find((area) => getGeometryIntersectionArea(positionedGeometry, area) >= Math.min(160 * 120, safeWidth * safeHeight * 0.12));
  if (visibleArea) return safeGeometry;
  const fallbackArea = usableAreas[0];
  return withStandaloneReaderMaximizedState({
    x: Math.round(fallbackArea.x + Math.max(0, fallbackArea.width - safeWidth) / 2),
    y: Math.round(fallbackArea.y + Math.max(0, fallbackArea.height - safeHeight) / 2),
    width: Math.min(safeWidth, fallbackArea.width),
    height: Math.min(safeHeight, fallbackArea.height),
  }, geometry.maximized === true);
}

async function restoreStandaloneReaderWindowGeometry(readerWindow: WebviewWindow, geometry: ReaderWindowGeometry) {
  if (!hasSavedReaderWindowGeometry(geometry)) return;
  const resolved = resolveStandaloneReaderWindowGeometryForWorkAreas(geometry, await loadStandaloneReaderWorkAreas());
  await readerWindow.setSize(new PhysicalSize(Math.round(resolved.width!), Math.round(resolved.height!)));
  if (Number.isFinite(resolved.x) && Number.isFinite(resolved.y)) {
    await readerWindow.setPosition(new PhysicalPosition(Math.round(resolved.x!), Math.round(resolved.y!)));
  }
}

async function restoreStandaloneReaderWindowState(
  readerWindow: WebviewWindow,
  geometry: ReaderWindowGeometry,
  state: ReaderStoredState | undefined,
  bookId: string,
) {
  await restoreStandaloneReaderWindowGeometry(readerWindow, geometry).catch((error) => console.warn('Failed to restore standalone reader window geometry:', error));
  if (state) await readerWindow.emit('bookmind:reader-window-state', { ...createReaderWindowStateEvent(bookId, state) }).catch((error) => console.warn('Failed to emit standalone reader state:', error));
  if (geometry.maximized) await readerWindow.maximize().catch((error) => console.warn('Failed to maximize standalone reader window:', error));
}

async function revealStandaloneReaderWindow(readerWindow: WebviewWindow, savedGeometry: ReaderWindowGeometry) {
  if (await readerWindow.isMinimized().catch(() => false)) await readerWindow.unminimize().catch((error) => console.warn('Failed to unminimize standalone reader window:', error));
  await restoreStandaloneReaderWindowGeometry(readerWindow, savedGeometry).catch((error) => console.warn('Failed to restore standalone reader window geometry:', error));
  if (savedGeometry.maximized) await readerWindow.maximize().catch((error) => console.warn('Failed to maximize standalone reader window:', error));
  await readerWindow.show().catch(() => undefined);
  await readerWindow.setFocus().catch((error) => console.warn('Failed to focus standalone reader window:', error));
}

async function loadStandaloneReaderWorkAreas(): Promise<ReaderWindowWorkArea[]> {
  try {
    const monitors = await availableMonitors();
    if (monitors.length) return monitors.map((monitor) => ({
      x: monitor.position.x,
      y: monitor.position.y,
      width: monitor.size.width,
      height: monitor.size.height,
    }));
    const primary = await primaryMonitor();
    return primary ? [{
      x: primary.position.x,
      y: primary.position.y,
      width: primary.size.width,
      height: primary.size.height,
    }] : [];
  } catch {
    return [];
  }
}

function withStandaloneReaderMaximizedState(geometry: ReaderWindowGeometry, maximized: boolean): ReaderWindowGeometry {
  return maximized ? { ...geometry, maximized: true } : geometry;
}

function getGeometryIntersectionArea(left: Required<Pick<ReaderWindowGeometry, 'x' | 'y' | 'width' | 'height'>>, right: ReaderWindowWorkArea) {
  const xOverlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const yOverlap = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return xOverlap * yOverlap;
}

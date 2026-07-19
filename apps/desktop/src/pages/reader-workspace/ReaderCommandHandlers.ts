import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { currentMonitor, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getPrivacyBookTitle, loadExtendedSettings, normalizeMoyuReaderProfile, patchMoyuReaderProfile, saveExtendedSettings, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Translator } from '../../i18n';
import type { Book, ReaderSettings, ReaderSettingsLevel } from '../../types';
import { createReaderWindowStateEvent } from '../readerWorkspaceModel';
import { loadJson, saveJson, type ReaderStoredPanelPlacements, type ReaderStoredState } from '../readerWorkspaceStorage';
import { buildMoyuLastGeometrySnapshot, resolveMoyuWindowGeometryFromProfile } from '../../features/reader-core/moyuReaderSettingsModel';
import { isStandaloneReaderWindowGeometryUsable, openStandaloneReaderWindow, type ReaderWindowGeometry } from './readerWindowLauncher';
import { resolveReaderSessionMode, shouldBroadcastReaderState, shouldRestoreMainReaderAfterWindowClose } from './readerSessionLifecycle';
import { beginMoyuWindowSession, restoreMoyuWindowSession } from './moyuWindowSession';

type ReaderWindowState = {
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
};

type ReaderCommandHandlersContext = {
  book: Book | null;
  windowKey: string;
  stateKey: string;
  settings: ReaderSettings;
  safeChapterIndex: number;
  activeParagraphIndex: number;
  activeScreenPage: number;
  aiCollapsed: boolean;
  tocOpen: boolean;
  settingsLevel: ReaderSettingsLevel;
  panelPlacements: ReaderStoredPanelPlacements;
  extendedSettings: ExtendedSettings;
  standaloneReader: boolean;
  moyuReader: boolean;
  detachedFromMain: boolean;
  geometrySaveTimerRef: MutableRefObject<number | null>;
  readerStateSaveTimerRef: MutableRefObject<number | null>;
  readerWindowSyncTimerRef: MutableRefObject<number | null>;
  setWindowState: Dispatch<SetStateAction<ReaderWindowState>>;
  setReaderWindowSyncStatus: Dispatch<SetStateAction<string>>;
  persistReaderState: (bookId: string, key: string, state: ReaderStoredState) => Promise<void>;
  emitReaderWindowState: (bookId: string, state: ReaderStoredState, updatedAt?: string) => Promise<void>;
  onDetachedReaderWindowOpen?: (bookId: string) => void;
  t: Translator;
};

export function createReaderCommandHandlers(context: ReaderCommandHandlersContext) {
  const readerSessionMode = resolveReaderSessionMode({ standaloneReader: context.standaloneReader, detachedFromMain: context.detachedFromMain });
  async function refreshReaderWindowState() {
    const current = WebviewWindow.getCurrent();
    const [isFullscreen, isAlwaysOnTop] = await Promise.all([current.isFullscreen(), current.isAlwaysOnTop()]);
    context.setWindowState({ isFullscreen, isAlwaysOnTop });
  }

  async function toggleFullscreen() {
    const current = WebviewWindow.getCurrent();
    const isFullscreen = await current.isFullscreen();
    await current.setFullscreen(!isFullscreen);
    if (!isFullscreen) await coverCurrentMonitor(current);
    await refreshReaderWindowState();
  }

  async function toggleAlwaysOnTop() {
    const current = WebviewWindow.getCurrent();
    const isAlwaysOnTop = await current.isAlwaysOnTop();
    await current.setAlwaysOnTop(!isAlwaysOnTop);
    await refreshReaderWindowState();
  }

  async function returnToMainWindow() {
    const current = WebviewWindow.getCurrent();
    const mainWindow = await WebviewWindow.getByLabel('main');
    await flushReaderStateBeforeClose(true);
    if (shouldRestoreMainReaderAfterWindowClose(readerSessionMode)) await mainWindow?.emit('bookmind:detached-reader-returned', { bookId: context.book?.id ?? null });
    await mainWindow?.show();
    await mainWindow?.setFocus();
    context.setReaderWindowSyncStatus(context.t('reader.window.syncReturned'));
    await current.destroy();
  }

  async function saveWindowGeometry() {
    if (!context.windowKey && !context.moyuReader) return;
    const current = WebviewWindow.getCurrent();
    if (await current.isMinimized()) return;
    const [position, outerSize, maximized, fullscreen] = await Promise.all([current.outerPosition(), current.outerSize(), current.isMaximized(), current.isFullscreen()]);
    if (context.moyuReader) {
      const latestSettings = loadExtendedSettings();
      const profile = normalizeMoyuReaderProfile(latestSettings.moyuReaderProfile);
      const snappedPosition = profile.windowSnapToEdges
        ? snapMoyuWindowPosition(position.x, position.y, outerSize.width, outerSize.height)
        : { x: position.x, y: position.y };
      saveExtendedSettings({
        ...latestSettings,
        moyuReaderProfile: normalizeMoyuReaderProfile({
          ...profile,
          windowWidth: outerSize.width,
          windowHeight: outerSize.height,
          windowPreset: 'custom',
          windowX: profile.rememberWindowPosition ? snappedPosition.x : undefined,
          windowY: profile.rememberWindowPosition ? snappedPosition.y : undefined,
          lastWindowGeometry: buildMoyuLastGeometrySnapshot({
            width: outerSize.width,
            height: outerSize.height,
            x: profile.rememberWindowPosition ? snappedPosition.x : undefined,
            y: profile.rememberWindowPosition ? snappedPosition.y : undefined,
          }),
        }),
      }, { key: 'moyuReaderProfile', keys: ['moyuReaderProfile'] });
      return;
    }
    const previous = loadJson<ReaderWindowGeometry>(context.windowKey, {});
    const previousGeometry = isStandaloneReaderWindowGeometryUsable(previous) ? { x: previous.x, y: previous.y, width: previous.width, height: previous.height } : null;
    const currentGeometry = { x: position.x, y: position.y, width: outerSize.width, height: outerSize.height };
    const normalGeometry = (maximized || fullscreen) && previousGeometry ? previousGeometry : currentGeometry;
    if (!isStandaloneReaderWindowGeometryUsable(normalGeometry)) return;
    saveJson(context.windowKey, { ...normalGeometry, maximized });
  }

  async function resolveMoyuWindowGeometry() {
    const profile = normalizeMoyuReaderProfile(loadExtendedSettings().moyuReaderProfile);
    const monitor = await currentMonitor();
    return resolveMoyuWindowGeometryFromProfile(profile, monitor);
  }

  function scheduleWindowGeometrySave() {
    if (context.geometrySaveTimerRef.current) window.clearTimeout(context.geometrySaveTimerRef.current);
    context.geometrySaveTimerRef.current = window.setTimeout(() => void saveWindowGeometry(), 400);
  }

  async function flushReaderStateBeforeClose(forceSync = false) {
    if (!context.book) return null;
    const state = {
      settings: context.settings,
      activeChapterIndex: context.safeChapterIndex,
      activeParagraphIndex: context.activeParagraphIndex,
      activeScreenPage: context.activeScreenPage,
      aiCollapsed: context.aiCollapsed,
      tocOpen: context.tocOpen,
      settingsLevel: context.settingsLevel,
      panelPlacements: context.panelPlacements,
    };
    if (context.readerStateSaveTimerRef.current) window.clearTimeout(context.readerStateSaveTimerRef.current);
    if (context.readerWindowSyncTimerRef.current) window.clearTimeout(context.readerWindowSyncTimerRef.current);
    await Promise.all([
      context.persistReaderState(context.book.id, context.stateKey, state),
      shouldBroadcastReaderState({ sessionMode: readerSessionMode, multiWindowReaderSync: context.extendedSettings.multiWindowReaderSync, forceSync }) ? context.emitReaderWindowState(context.book.id, state) : Promise.resolve(),
      saveWindowGeometry(),
    ]);
    return state;
  }

  function handleStandaloneReaderClose(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (context.moyuReader) {
      void exitMoyuMode();
      return;
    }
    const current = WebviewWindow.getCurrent();
    void flushReaderStateBeforeClose(true)
      .then(async () => {
        const mainWindow = await WebviewWindow.getByLabel('main');
        if (shouldRestoreMainReaderAfterWindowClose(readerSessionMode)) {
          await mainWindow?.emit('bookmind:detached-reader-returned', { bookId: context.book?.id ?? null });
          await mainWindow?.show();
          await mainWindow?.setFocus();
        }
        await current.destroy();
      })
      .catch((error) => {
        console.warn('Failed to flush reader state before closing standalone window:', error);
        void current.destroy();
      });
  }

  async function openReaderWindow() {
    const book = context.book;
    if (!book) return;
    const state = {
      settings: context.settings,
      activeChapterIndex: context.safeChapterIndex,
      activeParagraphIndex: context.activeParagraphIndex,
      activeScreenPage: context.activeScreenPage,
      tocOpen: context.tocOpen,
      aiCollapsed: context.aiCollapsed,
      settingsLevel: context.settingsLevel,
      panelPlacements: context.panelPlacements,
    };
    if (context.readerStateSaveTimerRef.current) window.clearTimeout(context.readerStateSaveTimerRef.current);
    await context.persistReaderState(book.id, context.stateKey, state);
    await openStandaloneReaderWindow({ book, state, chapterIndex: context.safeChapterIndex, extendedSettings: context.extendedSettings, t: context.t, detachedFromMain: true });
    const mainWindow = await WebviewWindow.getByLabel('main');
    context.onDetachedReaderWindowOpen?.(book.id);
    await mainWindow?.hide();
  }

  async function openMoyuReaderWindow() {
    const book = context.book;
    if (!book) return;
    const label = `moyu-reader-${book.id.replace(/[^a-zA-Z0-9-/:_]/g, '-')}`;
    const existing = await WebviewWindow.getByLabel(label);
    const current = WebviewWindow.getCurrent();
    const state = {
      settings: context.settings,
      activeChapterIndex: context.safeChapterIndex,
      activeParagraphIndex: context.activeParagraphIndex,
      activeScreenPage: context.activeScreenPage,
      tocOpen: context.tocOpen,
      aiCollapsed: context.aiCollapsed,
      settingsLevel: context.settingsLevel,
      panelPlacements: context.panelPlacements,
    };
    if (context.readerStateSaveTimerRef.current) window.clearTimeout(context.readerStateSaveTimerRef.current);
    await context.persistReaderState(book.id, context.stateKey, state);
    if (existing) {
      await beginMoyuWindowSession(label, current.label);
      if (await existing.isMinimized().catch(() => false)) await existing.unminimize().catch(() => undefined);
      await existing.emit('bookmind:moyu-reader-state', { ...createReaderWindowStateEvent(book.id, state) });
      await existing.show();
      await existing.setFocus();
      return;
    }
    const { width, height, x, y } = await resolveMoyuWindowGeometry();
    const readerWindow = new WebviewWindow(label, {
      url: `${window.location.pathname}?readerWindow=1&moyu=1&bookId=${encodeURIComponent(book.id)}&chapter=${context.safeChapterIndex}&paragraph=${context.activeParagraphIndex}&screenPage=${context.activeScreenPage}`,
      title: `${getPrivacyBookTitle(book.displayTitle || book.title, context.extendedSettings)} · ${context.t('reader.moyuMode')}`,
      width,
      height,
      x,
      y,
      minWidth: 360,
      minHeight: 160,
      resizable: true,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      shadow: false,
      visible: false,
    });
    readerWindow.once('tauri://created', () => {
      void (async () => {
        await beginMoyuWindowSession(label, current.label);
        await readerWindow.show();
        await readerWindow.setFocus();
        await readerWindow.emit('bookmind:moyu-reader-state', { ...createReaderWindowStateEvent(book.id, state) });
      })().catch((error) => console.error('Failed to activate moyu reader window:', error));
    });
    readerWindow.once('tauri://error', (event) => console.error('Failed to create moyu reader window:', event.payload));
  }

  async function openMoyuSettingsWindow() {
    const existing = await WebviewWindow.getByLabel('moyu-reader-settings');
    if (existing) {
      await existing.setFocus();
      return;
    }
    const settingsWindow = new WebviewWindow('moyu-reader-settings', {
      url: `${window.location.pathname}?moyuSettings=1`,
      title: '摸鱼模式设置',
      width: 680,
      height: 560,
      minWidth: 520,
      minHeight: 420,
      center: true,
      resizable: true,
      decorations: true,
    });
    settingsWindow.once('tauri://error', (event) => console.error('Failed to create moyu settings window:', event.payload));
  }

  async function exitMoyuMode() {
    const current = WebviewWindow.getCurrent();
    const state = await flushReaderStateBeforeClose();
    await current.hide();
    const payload = context.book && state ? { ...createReaderWindowStateEvent(context.book.id, state) } : null;
    await restoreMoyuWindowSession(current.label, async (restoredWindows) => {
      if (!payload) return;
      await Promise.all(restoredWindows.map((appWindow) => appWindow.emit('bookmind:moyu-reader-state', payload).catch(() => undefined)));
    });
  }

  return {
    refreshReaderWindowState,
    toggleFullscreen,
    toggleAlwaysOnTop,
    returnToMainWindow,
    saveWindowGeometry,
    scheduleWindowGeometrySave,
    handleStandaloneReaderClose,
    openReaderWindow,
    openMoyuReaderWindow,
    openMoyuSettingsWindow,
    exitMoyuMode,
  };
}

async function coverCurrentMonitor(current: WebviewWindow) {
  const monitor = await currentMonitor();
  if (!monitor) return;
  await current.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
  await current.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
}

function snapMoyuWindowPosition(x: number, y: number, width: number, height: number) {
  return {
    x,
    y,
    width,
    height,
  };
}

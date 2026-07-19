import { useEffect, type RefObject } from 'react';
import { loadAppSettings } from '../services/settingsService';
import { setOperationLogLevel, recordOperationLog } from '../services/operationLogService';
import { hydrateSettingsV2FromBackend, loadChapterRules, loadExtendedSettings, subscribeSettingsUpdated, type SettingsUpdatedDetail } from '../services/settingsCenterService';
import { hydrateReaderSettingsV2FromBackend } from '../features/reader-core/readerSettings';
import { cancelScheduledMainWindowGeometrySave, isDarkAppTheme, parseBoundedInteger, restoreMainWindowGeometry, saveMainWindowGeometry, scheduleMainWindowGeometrySave } from './appShellModel';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from './platform';
import type { AppState } from './AppStateContext';
import type { AppSettings } from '../types';
import { subscribeWindowFrameGeometryChanged } from '../services/appDomainEvents';

export function useAppSettings(
  appState: AppState,
  appSettingsRef: RefObject<AppSettings | null>,
  mainWindowGeometrySaveTimerRef: RefObject<number | null>,
  standaloneReader: boolean,
  discardAiStreamTokens: () => void,
) {
  const { extendedSettings, setExtendedSettings, setChapterRules, setNight, setSidebarCollapsed } = appState;

  // Load app settings on mount
  useEffect(() => {
    loadAppSettings().then((settings) => {
      appSettingsRef.current = settings;
      setOperationLogLevel(settings.operationLogLevel ?? 'none');
    }).catch(() => setOperationLogLevel('none'));
  }, []);

  // Window geometry save/restore
  useEffect(() => {
    if (!extendedSettings.rememberWindowGeometry || !isTauriRuntime() || standaloneReader) return;
    const current = getCurrentWindow();
    void restoreMainWindowGeometry();
    const moved = current.onMoved(() => scheduleMainWindowGeometrySave(mainWindowGeometrySaveTimerRef));
    const resized = current.onResized(() => scheduleMainWindowGeometrySave(mainWindowGeometrySaveTimerRef));
    const saveFrameGeometry = () => scheduleMainWindowGeometrySave(mainWindowGeometrySaveTimerRef);
    const unsubscribeFrameGeometry = subscribeWindowFrameGeometryChanged(saveFrameGeometry);
    const closing = current.onCloseRequested(() => {
      cancelScheduledMainWindowGeometrySave(mainWindowGeometrySaveTimerRef);
      void saveMainWindowGeometry();
    });
    return () => {
      cancelScheduledMainWindowGeometrySave(mainWindowGeometrySaveTimerRef);
      void saveMainWindowGeometry();
      unsubscribeFrameGeometry();
      moved.then((d) => d()); resized.then((d) => d());
      closing.then((d) => d());
    };
  }, [extendedSettings.rememberWindowGeometry, standaloneReader]);

  // Settings-center hydration + listener
  useEffect(() => {
    void hydrateSettingsV2FromBackend();
    void hydrateReaderSettingsV2FromBackend();
    function onSettingsCenterUpdated(detail?: SettingsUpdatedDetail) {
      const next = detail?.extended;
      const loaded = next ?? loadExtendedSettings();
      setExtendedSettings(loaded);
      setChapterRules(loadChapterRules());
      setNight(isDarkAppTheme(loaded));
      setSidebarCollapsed(loaded.sidebarCollapsed);
    }
    return subscribeSettingsUpdated(onSettingsCenterUpdated);
  }, []);

  // App-level settings updated listener
  useEffect(() => {
    function onSettingsUpdated(detail?: SettingsUpdatedDetail) {
      if (detail?.scope && detail.scope !== 'app' && detail.scope !== 'all') return;
      loadAppSettings().then((settings) => {
        appSettingsRef.current = settings;
        setOperationLogLevel(settings.operationLogLevel ?? 'none');
      }).catch(() => undefined);
    }
    return subscribeSettingsUpdated(onSettingsUpdated);
  }, []);

  // Discard AI stream tokens on unmount
  useEffect(() => () => discardAiStreamTokens(), []);

  // Operation log capture
  useEffect(() => {
    const policy = { recordInputContent: extendedSettings.operationLogRecordInputContent, recordPaths: extendedSettings.operationLogRecordPaths };
    const retention = parseBoundedInteger(extendedSettings.operationLogRetention, 20, 0, 500);

    function describeTarget(target: EventTarget | null) {
      const element = target instanceof HTMLElement ? target : null;
      if (!element) return {};
      const control = element.closest('button, a, input, textarea, select, [role="button"], [role="tab"], [role="menuitem"]') as HTMLElement | null;
      const source = control ?? element;
      return { tag: source.tagName.toLocaleLowerCase(), text: source.innerText?.trim().slice(0, 80) || source.getAttribute('aria-label') || source.getAttribute('title') || source.getAttribute('placeholder') || '', className: typeof source.className === 'string' ? source.className.slice(0, 120) : '', id: source.id || '' };
    }

    function onClick(event: MouseEvent) { recordOperationLog('basic', 'ui.click', describeTarget(event.target), retention, policy); }
    function onInput(event: Event) { const e = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement ? event.target : null; if (!e) return; recordOperationLog('debug', 'ui.input', { ...describeTarget(e), value: extendedSettings.operationLogRecordInputContent ? e.value : undefined, valueLength: e.value?.length ?? 0 }, retention, policy); }
    function onKeyDown(event: KeyboardEvent) { if (!event.ctrlKey && !event.metaKey && !event.altKey) return; recordOperationLog('debug', 'ui.shortcut', { key: event.key, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey, shift: event.shiftKey }, retention, policy); }

    window.addEventListener('click', onClick, true);
    window.addEventListener('input', onInput, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => { window.removeEventListener('click', onClick, true); window.removeEventListener('input', onInput, true); window.removeEventListener('keydown', onKeyDown, true); };
  }, [extendedSettings.operationLogRecordInputContent, extendedSettings.operationLogRecordPaths, extendedSettings.operationLogRetention]);
}

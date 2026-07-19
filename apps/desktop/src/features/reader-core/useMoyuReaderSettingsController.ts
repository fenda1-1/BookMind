import { useCallback, useEffect, useRef, useState } from 'react';
import { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { loadExtendedSettings, saveExtendedSettings, subscribeSettingsUpdated, type SettingsUpdatedDetail } from '../../services/settingsCenterService';
import {
  applyMoyuReaderPreset,
  defaultMoyuReaderProfile,
  loadMoyuPresetAutoApplyState,
  loadMoyuReaderCustomPresets,
  normalizeMoyuReaderProfile,
  rememberMoyuPresetAutoApplyUsage,
  resolveMoyuPresetAutoApplyPreset,
  resolveMoyuWindowGeometryFromProfile,
  type MoyuReaderProfile,
} from './moyuReaderSettingsModel';

type UseMoyuReaderSettingsControllerOptions = {
  moyuReader: boolean;
  bookId?: string;
};

export function useMoyuReaderSettingsController({ moyuReader, bookId }: UseMoyuReaderSettingsControllerOptions) {
  const [moyuSettings, setMoyuSettings] = useState<MoyuReaderProfile>(() => normalizeMoyuReaderProfile(loadExtendedSettings().moyuReaderProfile));
  const [moyuPresetAutoApplyState, setMoyuPresetAutoApplyState] = useState(() => loadMoyuPresetAutoApplyState());
  const moyuPresetAutoApplyRef = useRef<string | null>(null);
  const lastMoyuWindowSizeRef = useRef<{ width: number; height: number } | null>(null);

  const persistMoyuSettings = useCallback((next: MoyuReaderProfile) => {
    const current = loadExtendedSettings();
    saveExtendedSettings({ ...current, moyuReaderProfile: next }, { key: 'moyuReaderProfile', keys: ['moyuReaderProfile'] });
  }, []);

  const syncMoyuWindowSize = useCallback(async (nextSettings: MoyuReaderProfile) => {
    if (!moyuReader) return;
    const currentWindow = getCurrentWindow();
    const monitor = await currentMonitor();
    const resolved = resolveMoyuWindowGeometryFromProfile(nextSettings, monitor);
    const nextWidth = Math.round(resolved.width);
    const nextHeight = Math.round(resolved.height);
    const previousSize = lastMoyuWindowSizeRef.current;
    if (previousSize && previousSize.width === nextWidth && previousSize.height === nextHeight) return;
    lastMoyuWindowSizeRef.current = { width: nextWidth, height: nextHeight };
    try {
      await currentWindow.setSize(new PhysicalSize(nextWidth, nextHeight));
      if (resolved.x !== undefined && resolved.y !== undefined) {
        await currentWindow.setPosition(new PhysicalPosition(Math.round(resolved.x), Math.round(resolved.y)));
      }
    } catch (error) {
      console.warn('Failed to sync moyu window size:', error);
    }
  }, [moyuReader]);

  const updateMoyuSettings = useCallback((updater: (settings: MoyuReaderProfile) => MoyuReaderProfile) => {
    const next = normalizeMoyuReaderProfile(updater(moyuSettings));
    setMoyuSettings(next);
    persistMoyuSettings(next);
    void syncMoyuWindowSize(next);
  }, [moyuSettings, persistMoyuSettings, syncMoyuWindowSize]);

  const saveCurrentMoyuSettings = useCallback(() => {
    persistMoyuSettings(normalizeMoyuReaderProfile(moyuSettings));
  }, [moyuSettings, persistMoyuSettings]);

  const restoreSavedMoyuSettings = useCallback(() => {
    setMoyuSettings(normalizeMoyuReaderProfile(loadExtendedSettings().moyuReaderProfile));
  }, []);

  const restoreDefaultMoyuSettings = useCallback(() => {
    setMoyuSettings(defaultMoyuReaderProfile);
    persistMoyuSettings(defaultMoyuReaderProfile);
  }, [persistMoyuSettings]);

  const restoreLastMoyuPreset = useCallback(() => {
    const preset = resolveMoyuPresetAutoApplyPreset(loadMoyuReaderCustomPresets(), moyuPresetAutoApplyState, bookId);
    if (preset) updateMoyuSettings(() => applyMoyuReaderPreset(preset));
  }, [bookId, moyuPresetAutoApplyState, updateMoyuSettings]);

  useEffect(() => {
    if (!moyuReader) return;
    setMoyuSettings(normalizeMoyuReaderProfile(loadExtendedSettings().moyuReaderProfile));
  }, [moyuReader]);

  useEffect(() => {
    if (!moyuReader) return;
    function refreshMoyuSettings(detail: SettingsUpdatedDetail) {
      if (detail?.keys && !detail.keys.includes('moyuReaderProfile') && detail.key !== 'moyuReaderProfile') return;
      setMoyuSettings(normalizeMoyuReaderProfile((detail?.extended ?? loadExtendedSettings()).moyuReaderProfile));
      setMoyuPresetAutoApplyState(loadMoyuPresetAutoApplyState());
    }
    return subscribeSettingsUpdated(refreshMoyuSettings);
  }, [moyuReader]);

  useEffect(() => {
    if (!moyuReader || !bookId) return;
    const preset = resolveMoyuPresetAutoApplyPreset(loadMoyuReaderCustomPresets(), moyuPresetAutoApplyState, bookId);
    if (!preset) return;
    const signature = `${bookId}:${preset.id}`;
    if (moyuPresetAutoApplyRef.current === signature) return;
    moyuPresetAutoApplyRef.current = signature;
    rememberMoyuPresetAutoApplyUsage(preset.id, bookId);
    updateMoyuSettings(() => applyMoyuReaderPreset(preset));
  }, [bookId, moyuReader, moyuPresetAutoApplyState, updateMoyuSettings]);

  useEffect(() => {
    if (!moyuReader) return;
    const next = moyuSettings.windowAspectLock
      ? {
          width: moyuSettings.windowWidth,
          height: Math.max(160, Math.min(900, Math.round(moyuSettings.windowWidth / Math.max(0.2, moyuSettings.windowAspectRatio)))),
        }
      : { width: moyuSettings.windowWidth, height: moyuSettings.windowHeight };
    if (lastMoyuWindowSizeRef.current
      && lastMoyuWindowSizeRef.current.width === next.width
      && lastMoyuWindowSizeRef.current.height === next.height) return;
    lastMoyuWindowSizeRef.current = next;
    void getCurrentWindow().setSize(new PhysicalSize(next.width, next.height));
  }, [moyuReader, moyuSettings.windowWidth, moyuSettings.windowHeight, moyuSettings.windowAspectLock, moyuSettings.windowAspectRatio]);

  return {
    moyuSettings,
    setMoyuSettings,
    updateMoyuSettings,
    saveCurrentMoyuSettings,
    restoreSavedMoyuSettings,
    restoreLastMoyuPreset,
    restoreDefaultMoyuSettings,
  };
}

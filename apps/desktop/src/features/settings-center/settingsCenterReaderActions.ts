import {
  defaultReaderSettings,
  deleteReaderCustomPreset,
  exportReaderCustomPresets,
  importReaderCustomPresets,
  readerPresetSettings,
  renameReaderCustomPreset,
  saveGlobalReaderSettings,
  saveReaderCustomPreset,
  type ReaderCustomPreset,
} from '../reader-core/readerSettings';
import { buildReaderFontFamily } from '../reader-core/readerModel';
import { dispatchSettingsUpdated, recordSettingsChangeHistory, type SettingsChangeHistoryEntry } from '../../services/settingsCenterService';
import type { ReaderPreset, ReaderSettings } from '../../types';
import type { Translator } from '../../i18n';
import { downloadSettingsText } from './settingsCenterPageModel';
import { requestAppConfirm } from '../../components/useAppConfirm';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

type SettingsReaderActionDeps = {
  getReaderGlobalSettings: () => ReaderSettings;
  setReaderGlobalSettings: StateSetter<ReaderSettings>;
  getReaderCustomPresets: () => ReaderCustomPreset[];
  setReaderCustomPresets: StateSetter<ReaderCustomPreset[]>;
  setSettingsChangeHistory: StateSetter<SettingsChangeHistoryEntry[]>;
  setSaveStatus: (status: string) => void;
  t: Translator;
  refreshLocalEncryptionStatus: () => Promise<void>;
  onApplyPresetToCurrentBook?: (preset: ReaderCustomPreset) => void;
  promptText?: (message: string, defaultValue?: string) => string | null;
  confirmDelete?: (message: string) => Promise<boolean>;
  createExportedAt?: () => string;
  formatError: (error: unknown) => string;
};

export function createSettingsReaderActions(deps: SettingsReaderActionDeps) {
  const {
    getReaderGlobalSettings,
    setReaderGlobalSettings,
    getReaderCustomPresets,
    setReaderCustomPresets,
    setSettingsChangeHistory,
    setSaveStatus,
    t,
    refreshLocalEncryptionStatus,
    onApplyPresetToCurrentBook,
    promptText = (message, defaultValue) => window.prompt(message, defaultValue),
    confirmDelete = requestAppConfirm,
    createExportedAt = () => new Date().toISOString(),
    formatError,
  } = deps;

  function updateReaderGlobalSetting<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
    setReaderGlobalSettings((current) => {
      const next = saveGlobalReaderSettings({ ...current, [key]: value, preset: key === 'preset' ? value as ReaderPreset : key === 'theme' ? current.preset : 'custom' }, { changedKeys: [key] });
      setSettingsChangeHistory(recordSettingsChangeHistory({ key: String(key), scope: 'reader' }));
      dispatchSettingsUpdated({ key: String(key), scope: 'reader' });
      setSaveStatus(t('settings.readerActions.settingSaved', { key: String(key) }));
      if (key === 'encryptSensitiveReaderData') void refreshLocalEncryptionStatus();
      return next;
    });
  }

  function updateReaderFontStack(update: Partial<Pick<ReaderSettings, 'customFontFamily' | 'fontFallbacks'>>) {
    setReaderGlobalSettings((current) => {
      const customFontFamily = update.customFontFamily ?? current.customFontFamily;
      const fontFallbacks = update.fontFallbacks ?? current.fontFallbacks;
      const primary = customFontFamily.trim() || current.fontFamily.split(',')[0] || defaultReaderSettings.fontFamily.split(',')[0];
      const next = saveGlobalReaderSettings({
        ...current,
        ...update,
        customFontFamily,
        fontFallbacks,
        fontFamily: buildReaderFontFamily(primary, fontFallbacks),
        preset: 'custom',
      }, { changedKeys: ['customFontFamily', 'fontFallbacks', 'fontFamily'] });
      setSaveStatus(t('settings.readerActions.fontStackSaved'));
      return next;
    });
  }

  function parseReaderFontFallbackInput(value: string) {
    return value.split(',').map((font) => font.trim()).filter(Boolean);
  }

  function applyReaderGlobalPreset(preset: ReaderPreset) {
    const readerGlobalSettings = getReaderGlobalSettings();
    const next = preset === 'custom'
      ? { ...readerGlobalSettings, preset }
      : { ...readerGlobalSettings, ...readerPresetSettings[preset], preset };
    setReaderGlobalSettings(saveGlobalReaderSettings(next));
    setSaveStatus(t('settings.readerActions.presetApplied'));
  }

  function saveCurrentReaderSettingsAsPreset() {
    const name = promptText(t('settings.readerActions.promptPresetName'), t('settings.readerActions.defaultPresetName', { count: getReaderCustomPresets().length + 1 }));
    if (name === null) return;
    const presets = saveReaderCustomPreset(name, getReaderGlobalSettings());
    setReaderCustomPresets(presets);
    setSettingsChangeHistory(recordSettingsChangeHistory({ key: 'readerCustomPreset', scope: 'reader' }));
    dispatchSettingsUpdated({ key: 'readerCustomPreset', scope: 'reader' });
    setSaveStatus(t('settings.readerActions.customPresetSaved'));
  }

  function applyReaderCustomPreset(preset: ReaderCustomPreset) {
    const next = saveGlobalReaderSettings({ ...preset.settings, preset: 'custom' });
    setReaderGlobalSettings(next);
    setSettingsChangeHistory(recordSettingsChangeHistory({ key: 'readerCustomPreset', scope: 'reader' }));
    dispatchSettingsUpdated({ key: 'readerCustomPreset', scope: 'reader' });
    setSaveStatus(t('settings.readerActions.customPresetApplied', { name: preset.name }));
  }

  function renameReaderCustomPresetFromSettings(preset: ReaderCustomPreset) {
    const name = promptText(t('settings.readerActions.promptRenamePreset'), preset.name);
    if (name === null) return;
    setReaderCustomPresets(renameReaderCustomPreset(preset.id, name));
    setSettingsChangeHistory(recordSettingsChangeHistory({ key: 'readerCustomPresetRename', scope: 'reader' }));
    setSaveStatus(t('settings.readerActions.customPresetRenamed'));
  }

  async function deleteReaderCustomPresetFromSettings(preset: ReaderCustomPreset) {
    if (!await confirmDelete(t('settings.readerActions.confirmDeletePreset', { name: preset.name }))) return;
    setReaderCustomPresets(deleteReaderCustomPreset(preset.id));
    setSettingsChangeHistory(recordSettingsChangeHistory({ key: 'readerCustomPresetDelete', scope: 'reader' }));
    setSaveStatus(t('settings.readerActions.customPresetDeleted'));
  }

  function exportReaderCustomPresetsFromSettings() {
    downloadSettingsText(`bookmind-reader-presets-${createExportedAt().slice(0, 10)}.json`, exportReaderCustomPresets(), 'application/json;charset=utf-8');
    setSaveStatus(t('settings.readerActions.customPresetExported'));
  }

  async function importReaderCustomPresetsFromSettings(file: File) {
    try {
      setReaderCustomPresets(importReaderCustomPresets(await file.text()));
      setSettingsChangeHistory(recordSettingsChangeHistory({ key: 'readerCustomPresetImport', scope: 'reader' }));
      setSaveStatus(t('settings.readerActions.customPresetImported'));
    } catch (error) {
      setSaveStatus(t('settings.readerActions.customPresetImportFailed', { error: formatError(error) }));
    }
  }

  function applyReaderCustomPresetToCurrentBook(preset: ReaderCustomPreset) {
    if (!onApplyPresetToCurrentBook) return;
    onApplyPresetToCurrentBook(preset);
    setSaveStatus(t('settings.readerActions.customPresetAppliedToCurrentBook', { name: preset.name }));
  }

  return {
    updateReaderGlobalSetting,
    updateReaderFontStack,
    parseReaderFontFallbackInput,
    applyReaderGlobalPreset,
    saveCurrentReaderSettingsAsPreset,
    applyReaderCustomPreset,
    renameReaderCustomPresetFromSettings,
    deleteReaderCustomPresetFromSettings,
    exportReaderCustomPresetsFromSettings,
    importReaderCustomPresetsFromSettings,
    applyReaderCustomPresetToCurrentBook,
  };
}

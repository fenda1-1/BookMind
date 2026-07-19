import {
  defaultChapterRules,
  defaultExtendedSettings,
  dispatchSettingsUpdated,
  sanitizeSettingsSnapshotExtended,
  saveChapterRules,
  saveExtendedSettings,
  type ChapterRuleDraft,
  type ExtendedSettings,
} from '../../services/settingsCenterService';
import type { AppSettings, ReaderSettings } from '../../types';
import type { Translator } from '../../i18n';
import { saveGlobalReaderSettings } from '../reader-core/readerSettings';
import { sanitizeProviderProfileSecrets } from './settingsCenterAiProviderModel';
import {
  buildSettingsImportPreview,
  buildSettingsSnapshot as buildSettingsSnapshotPayload,
  type SettingsImportPreview,
  type SettingsSnapshot,
} from './settingsCenterImportModel';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

type SettingsSnapshotActionDeps = {
  settings: AppSettings;
  readerGlobalSettings: ReaderSettings;
  chapterRules: ChapterRuleDraft;
  extendedSettings: ExtendedSettings;
  settingsImportPreview: SettingsImportPreview | null;
  setReaderGlobalSettings: StateSetter<ReaderSettings>;
  setChapterRules: StateSetter<ChapterRuleDraft>;
  setExtendedSettings: StateSetter<ExtendedSettings>;
  setSettingsImportPreview: StateSetter<SettingsImportPreview | null>;
  setSaveStatus: (status: string) => void;
  updateAppSettings: (update: Partial<AppSettings>, status?: string) => Promise<void>;
  t: Translator;
  createExportedAt?: () => string;
};

export function createSettingsSnapshotActions(deps: SettingsSnapshotActionDeps) {
  const {
    settings,
    readerGlobalSettings,
    chapterRules,
    extendedSettings,
    settingsImportPreview,
    setReaderGlobalSettings,
    setChapterRules,
    setExtendedSettings,
    setSettingsImportPreview,
    setSaveStatus,
    updateAppSettings,
    t,
    createExportedAt = () => new Date().toISOString(),
  } = deps;

  function buildSettingsSnapshot(): SettingsSnapshot {
    return buildSettingsSnapshotPayload({
      exportedAt: createExportedAt(),
      appSettings: sanitizeProviderProfileSecrets(settings),
      readerSettings: readerGlobalSettings,
      chapterRules,
      extendedSettings,
      sanitizeExtendedSettings: sanitizeSettingsSnapshotExtended,
    });
  }

  function buildSettingsJsonPreview() {
    return JSON.stringify(buildSettingsSnapshot(), null, 2);
  }

  function exportSettingsSnapshot() {
    const exportedAt = createExportedAt();
    const snapshot = buildSettingsSnapshotPayload({
      exportedAt,
      appSettings: sanitizeProviderProfileSecrets(settings),
      readerSettings: readerGlobalSettings,
      chapterRules,
      extendedSettings,
      sanitizeExtendedSettings: sanitizeSettingsSnapshotExtended,
    });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookmind-settings-${exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus(t('settings.snapshotActions.exported'));
  }

  async function importSettingsSnapshot(file: File) {
    try {
      const raw = await file.text();
      const snapshot = JSON.parse(raw) as Partial<SettingsSnapshot>;
      if (snapshot.schema !== 'bookmind.settings.snapshot.v1') throw new Error('schema mismatch');
      setSettingsImportPreview(buildSettingsImportPreview(snapshot, file.name));
      setSaveStatus(t('settings.snapshotActions.parsed'));
    } catch (error) {
      console.error('Failed to import settings snapshot:', error);
      setSaveStatus(t('settings.snapshotActions.importFailed'));
    }
  }

  async function confirmSettingsImportPreview() {
    const preview = settingsImportPreview;
    if (!preview || preview.conflicts.length) return;
    const snapshot = preview.snapshot;
    if (snapshot.reader) setReaderGlobalSettings(saveGlobalReaderSettings(snapshot.reader));
    if (snapshot.chapterRules) {
      const nextChapterRules = { ...defaultChapterRules, ...snapshot.chapterRules };
      setChapterRules(nextChapterRules);
      saveChapterRules(nextChapterRules);
      dispatchSettingsUpdated({ key: 'settingsImport', keys: Object.keys(snapshot.chapterRules), scope: 'chapterRules' });
    }
    if (snapshot.extended) {
      const nextExtended = { ...defaultExtendedSettings, ...snapshot.extended };
      const savedExtended = saveExtendedSettings(nextExtended, { key: 'settingsImport', keys: Object.keys(snapshot.extended) });
      setExtendedSettings(savedExtended);
    }
    if (snapshot.app) {
      const { aiApiKey: _redactedApiKey, redactedApiKey: _redacted, ...plainAppSettings } = snapshot.app as AppSettings & { redactedApiKey?: boolean };
      const existingProviderKeys = new Map(settings.aiProviderProfiles?.map((profile) => [profile.id, {
        kind: profile.kind,
        apiBaseUrl: normalizeCredentialEndpoint(profile.apiBaseUrl),
        apiKey: profile.apiKey ?? '',
      }]));
      const existingTranslationKeys = new Map(settings.translationSources?.map((source) => [
        source.id,
        source.kind === 'ai-model' ? null : {
          kind: source.kind,
          apiBaseUrl: normalizeCredentialEndpoint(source.apiBaseUrl),
          appId: source.kind === 'baidu-translate' ? source.appId.trim() : '',
          region: source.kind === 'microsoft-translator' ? source.region.trim() : '',
          apiKey: source.apiKey ?? '',
        },
      ]));
      const nextAppSettings = {
        ...settings,
        ...plainAppSettings,
        aiApiKey: settings.aiApiKey,
        aiProviderProfiles: plainAppSettings.aiProviderProfiles?.map((profile) => ({
          ...profile,
          apiKey: existingProviderKeys.get(profile.id)?.kind === profile.kind
            && existingProviderKeys.get(profile.id)?.apiBaseUrl === normalizeCredentialEndpoint(profile.apiBaseUrl)
            ? existingProviderKeys.get(profile.id)?.apiKey ?? ''
            : '',
        })),
        translationSources: plainAppSettings.translationSources?.map((source) => (
          source.kind !== 'ai-model'
            ? {
              ...source,
              apiKey: existingTranslationKeys.get(source.id)?.kind === source.kind
                && existingTranslationKeys.get(source.id)?.apiBaseUrl === normalizeCredentialEndpoint(source.apiBaseUrl)
                && existingTranslationKeys.get(source.id)?.appId === (source.kind === 'baidu-translate' ? source.appId.trim() : '')
                && existingTranslationKeys.get(source.id)?.region === (source.kind === 'microsoft-translator' ? source.region.trim() : '')
                ? existingTranslationKeys.get(source.id)?.apiKey ?? ''
                : '',
            }
            : source
        )),
      };
      await updateAppSettings(nextAppSettings, t('settings.snapshotActions.importedApiKeyPreserved'));
    } else {
      setSaveStatus(t('settings.snapshotActions.imported'));
    }
    setSettingsImportPreview(null);
  }

  return {
    buildSettingsSnapshot,
    buildSettingsJsonPreview,
    exportSettingsSnapshot,
    importSettingsSnapshot,
    confirmSettingsImportPreview,
  };
}

function normalizeCredentialEndpoint(value: string) {
  return value.trim().replace(/\/+$/, '');
}

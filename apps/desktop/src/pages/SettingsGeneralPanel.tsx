import type { ChangeEvent, RefObject } from 'react';
import { ThemedSelect } from './SettingsSelect';
import type { Locale, LocalePreference, Translator } from '../i18n';
import type { ExtendedSettings, SettingsChangeHistoryEntry } from '../services/settingsCenterService';
import type { SettingsImportPreview } from '../features/settings-center/settingsCenterImportModel';
import { ReadonlyPill, SettingControl, SettingsSection } from './SettingsPageScaffold';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type SettingsGeneralPanelProps = {
  locale: Locale;
  localePreference: LocalePreference;
  setLocalePreference: (locale: LocalePreference) => void;
  t: Translator;
  localeOptions: SelectOption<LocalePreference>[];
  extendedSettings: ExtendedSettings;
  startupPageOptions: SelectOption<ExtendedSettings['startupPage']>[];
  startupOverviewModeOptions: SelectOption<ExtendedSettings['startupOverviewMode']>[];
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
  saveStatus: string;
  restoreReaderGlobalDefaults: () => void;
  settingsImportInputRef: RefObject<HTMLInputElement | null>;
  exportSettingsSnapshot: () => void;
  importSettingsSnapshot: (file: File) => Promise<void>;
  showSettingsJsonPreview: boolean;
  setShowSettingsJsonPreview: (updater: (current: boolean) => boolean) => void;
  buildSettingsJsonPreview: () => string;
  copyDiagnosticSettingsSnapshot: () => void;
  settingsImportPreview: SettingsImportPreview | null;
  confirmSettingsImportPreview: () => Promise<void>;
  setSettingsImportPreview: (preview: SettingsImportPreview | null) => void;
  settingsChangeHistory: SettingsChangeHistoryEntry[];
  undoLastSettingsChangeFromHistory: () => void;
  formatSettingsChangeTime: (isoTime: string) => string;
  restoreAllSettingsDefaults: () => Promise<void>;
  searchText?: string;
};

export function SettingsGeneralPanel({
  locale,
  localePreference,
  setLocalePreference,
  t,
  localeOptions,
  extendedSettings,
  startupPageOptions,
  startupOverviewModeOptions,
  updateExtendedSetting,
  saveStatus,
  restoreReaderGlobalDefaults,
  settingsImportInputRef,
  exportSettingsSnapshot,
  importSettingsSnapshot,
  showSettingsJsonPreview,
  setShowSettingsJsonPreview,
  buildSettingsJsonPreview,
  copyDiagnosticSettingsSnapshot,
  settingsImportPreview,
  confirmSettingsImportPreview,
  setSettingsImportPreview,
  settingsChangeHistory,
  undoLastSettingsChangeFromHistory,
  formatSettingsChangeTime,
  restoreAllSettingsDefaults,
}: SettingsGeneralPanelProps) {
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const toggleValue = (enabled: boolean) => enabled ? tr('settings.common.on') : tr('settings.common.off');
  const toggleLabel = (enabled: boolean) => enabled ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const none = tr('settings.common.none');
  return (
    <>
      <SettingsSection title={tr('settings.general.basic.title')} description={tr('settings.general.basic.description')}>
        <SettingControl title={t('settings.language.title')} description={t('settings.language.help')} valueText={`${localePreference === 'system' ? t('locale.system') : localePreference} · ${locale}`}>
          <ThemedSelect label={t('settings.language.title')} value={localePreference} options={localeOptions} onChange={setLocalePreference} ariaLabel={t('settings.language.title')} />
        </SettingControl>
        <SettingControl title={tr('settings.general.startupPage.title')} description={tr('settings.general.startupPage.description')} valueText={extendedSettings.startupPage}>
          <ThemedSelect label={tr('settings.general.startupPage.title')} value={extendedSettings.startupPage} options={startupPageOptions} onChange={(value) => updateExtendedSetting('startupPage', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.general.startupOverview.title')} description={tr('settings.general.startupOverview.description')} valueText={startupOverviewModeOptions.find((item) => item.value === extendedSettings.startupOverviewMode)?.label}>
          <ThemedSelect label={tr('settings.general.startupOverview.title')} value={extendedSettings.startupOverviewMode} options={startupOverviewModeOptions} onChange={(value) => updateExtendedSetting('startupOverviewMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.general.openLastBook.title')} description={tr('settings.general.openLastBook.description')} valueText={toggleValue(extendedSettings.openLastReaderBookOnStartup)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.openLastReaderBookOnStartup} onChange={(event) => updateExtendedSetting('openLastReaderBookOnStartup', event.target.checked)} /><span>{toggleLabel(extendedSettings.openLastReaderBookOnStartup)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.general.restoreLastPosition.title')} description={tr('settings.general.restoreLastPosition.description')} valueText={toggleValue(extendedSettings.restoreLastReaderPositionOnStartup)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.restoreLastReaderPositionOnStartup} onChange={(event) => updateExtendedSetting('restoreLastReaderPositionOnStartup', event.target.checked)} /><span>{toggleLabel(extendedSettings.restoreLastReaderPositionOnStartup)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.general.checkUnfinishedTasks.title')} description={tr('settings.general.checkUnfinishedTasks.description')} valueText={toggleValue(extendedSettings.checkUnfinishedTasksOnStartup)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.checkUnfinishedTasksOnStartup} onChange={(event) => updateExtendedSetting('checkUnfinishedTasksOnStartup', event.target.checked)} /><span>{toggleLabel(extendedSettings.checkUnfinishedTasksOnStartup)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.general.refreshLibraryMetadata.title')} description={tr('settings.general.refreshLibraryMetadata.description')} valueText={toggleValue(extendedSettings.refreshLibraryMetadataOnStartup)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.refreshLibraryMetadataOnStartup} onChange={(event) => updateExtendedSetting('refreshLibraryMetadataOnStartup', event.target.checked)} /><span>{toggleLabel(extendedSettings.refreshLibraryMetadataOnStartup)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.general.rememberWindowGeometry.title')} description={tr('settings.general.rememberWindowGeometry.description')} valueText={toggleValue(extendedSettings.rememberWindowGeometry)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.rememberWindowGeometry} onChange={(event) => updateExtendedSetting('rememberWindowGeometry', event.target.checked)} /><span>{toggleLabel(extendedSettings.rememberWindowGeometry)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.general.saveStatus.title')} description={tr('settings.general.saveStatus.description')} valueText={saveStatus}>
          <ReadonlyPill text={saveStatus} />
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.general.management.title')} description={tr('settings.general.management.description')}>
        <SettingControl title={tr('settings.general.restoreReader.title')} description={tr('settings.general.restoreReader.description')}>
          <button className="ghost-btn small" type="button" onClick={restoreReaderGlobalDefaults}>{t('reader.settings.restoreDefault')}</button>
        </SettingControl>
        <SettingControl title={tr('settings.general.snapshot.title')} description={tr('settings.general.snapshot.description')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={exportSettingsSnapshot}>{tr('settings.general.snapshot.export')}</button>
            <button className="ghost-btn small" type="button" onClick={() => settingsImportInputRef.current?.click()}>{tr('settings.general.snapshot.import')}</button>
            <button className="ghost-btn small" type="button" onClick={() => setShowSettingsJsonPreview((current) => !current)}>{showSettingsJsonPreview ? tr('settings.general.snapshot.hideJson') : tr('settings.general.snapshot.showJson')}</button>
            <button className="ghost-btn small" type="button" onClick={copyDiagnosticSettingsSnapshot}>{tr('settings.general.snapshot.copyRedactedDiagnostics')}</button>
            <input ref={settingsImportInputRef} type="file" accept="application/json,.json" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.currentTarget.files?.[0]; if (file) void importSettingsSnapshot(file); event.currentTarget.value = ''; }} />
            {showSettingsJsonPreview ? <pre className="settings-json-preview" aria-label={tr('settings.general.snapshot.redactedJsonAria')}>{buildSettingsJsonPreview()}</pre> : null}
            {settingsImportPreview ? (
              <div className="settings-import-preview" role="status" aria-label={tr('settings.general.importPreview.aria')}>
                <strong>{tr('settings.general.importPreview.title', { fileName: settingsImportPreview.fileName })}</strong>
                <span>{tr('settings.general.importPreview.additions')}{settingsImportPreview.additions.join('；') || none}</span>
                <span>{tr('settings.general.importPreview.overrides')}{settingsImportPreview.overrides.join('；') || none}</span>
                <span>{tr('settings.general.importPreview.conflicts')}{settingsImportPreview.conflicts.join('；') || none}</span>
                <span>{tr('settings.general.importPreview.blockedFields')}{settingsImportPreview.blockedFields.join('、') || none}</span>
                <div className="settings-inline-actions">
                  <button className="primary-btn small" type="button" onClick={() => { void confirmSettingsImportPreview(); }} disabled={settingsImportPreview.conflicts.length > 0}>{tr('settings.general.importPreview.confirm')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => setSettingsImportPreview(null)}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : null}
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.general.history.title')} description={tr('settings.general.history.description')} valueText={tr('settings.general.history.count', { count: settingsChangeHistory.length })}>
          <div className="settings-change-history">
            <div className="settings-change-history-actions">
              <button className="ghost-btn small" type="button" onClick={undoLastSettingsChangeFromHistory} disabled={!settingsChangeHistory.some((entry) => entry.previousExtendedSettings)}>{tr('settings.general.history.undoLast')}</button>
            </div>
            <div className="settings-change-history-box" role="log" aria-label={tr('settings.general.history.aria')}>
              {settingsChangeHistory.length ? settingsChangeHistory.slice(0, 8).map((entry) => (
                <article className="settings-change-history-entry" key={entry.id}>
                  <time dateTime={entry.changedAt}>{formatSettingsChangeTime(entry.changedAt)}</time>
                  <span>{entry.summary}</span>
                </article>
              )) : <ReadonlyPill text={tr('settings.general.history.empty')} />}
            </div>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.general.restoreAll.title')} description={tr('settings.general.restoreAll.description')}>
          <button className="ghost-btn small danger-btn" type="button" onClick={() => { void restoreAllSettingsDefaults(); }}>{tr('settings.general.restoreAll.action')}</button>
        </SettingControl>
      </SettingsSection>
    </>
  );
}

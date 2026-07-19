import { ThemedSelect } from './SettingsSelect';
import { ReadonlyPill, SettingControl, SettingsSection, SettingsTextInput } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsLibraryPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    settings,
    extendedSettings,
    retentionSelectOptions,
    libraryViewOptions,
    librarySortOptions,
    libraryFilterOptions,
    duplicateStrategyOptions,
    defaultCoverToneStrategyOptions,
    defaultCoverLabelStrategyOptions,
    importFileFilterOptions,
    txtImportEncodingModeOptions,
    libraryDensityOptions,
    updateAppSettings,
    updateExtendedSetting,
    useAppDataDirAsDefaultImportPath,
  } = props;
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (checked: boolean) => checked ? tr('settings.common.on') : tr('settings.common.off');
  const enabledDisabled = (checked: boolean) => checked ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const shownHidden = (shown: boolean) => shown ? tr('settings.library.state.shown') : tr('settings.library.state.hidden');
  const displayHidden = (shown: boolean) => shown ? tr('settings.library.state.displayed') : tr('settings.library.state.hiddenPast');
  const protectedText = (checked: boolean) => checked ? tr('settings.library.state.protected') : tr('settings.library.state.unprotected');
  const daysText = (days: number) => tr('settings.library.count.days', { count: days });

  return (
    <>
      <SettingsSection title={tr('settings.library.display.title')} description={tr('settings.library.display.description')}>
        <SettingControl title={tr('settings.library.defaultViewMode.title')} description={tr('settings.library.defaultViewMode.description')} valueText={extendedSettings.defaultViewMode}>
          <ThemedSelect label={tr('settings.library.defaultViewMode.label')} value={extendedSettings.defaultViewMode} options={libraryViewOptions} onChange={(value) => updateExtendedSetting('defaultViewMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.defaultSort.title')} description={tr('settings.library.defaultSort.description')} valueText={extendedSettings.defaultSort}>
          <ThemedSelect label={tr('settings.library.defaultSort.title')} value={extendedSettings.defaultSort} options={librarySortOptions} onChange={(value) => updateExtendedSetting('defaultSort', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.defaultFilter.title')} description={tr('settings.library.defaultFilter.description')} valueText={extendedSettings.defaultFilter}>
          <ThemedSelect label={tr('settings.library.defaultFilter.title')} value={extendedSettings.defaultFilter} options={libraryFilterOptions} onChange={(value) => updateExtendedSetting('defaultFilter', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.showEmptyLibraryGuide.title')} description={tr('settings.library.showEmptyLibraryGuide.description')} valueText={onOff(extendedSettings.showEmptyLibraryGuide)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.showEmptyLibraryGuide} onChange={(event) => updateExtendedSetting('showEmptyLibraryGuide', event.target.checked)} /><span>{enabledDisabled(extendedSettings.showEmptyLibraryGuide)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.rememberLibraryTabState.title')} description={tr('settings.library.rememberLibraryTabState.description')} valueText={onOff(extendedSettings.rememberLibraryTabState)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.rememberLibraryTabState} onChange={(event) => updateExtendedSetting('rememberLibraryTabState', event.target.checked)} /><span>{enabledDisabled(extendedSettings.rememberLibraryTabState)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.showLibraryDetailSidebar.title')} description={tr('settings.library.showLibraryDetailSidebar.description')} valueText={shownHidden(extendedSettings.showLibraryDetailSidebar)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.showLibraryDetailSidebar} onChange={(event) => updateExtendedSetting('showLibraryDetailSidebar', event.target.checked)} /><span>{displayHidden(extendedSettings.showLibraryDetailSidebar)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.libraryDensity.title')} description={tr('settings.library.libraryDensity.description')} valueText={extendedSettings.libraryDensity}>
          <ThemedSelect label={tr('settings.library.libraryDensity.title')} value={extendedSettings.libraryDensity} options={libraryDensityOptions} onChange={(value) => updateExtendedSetting('libraryDensity', value)} />
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.library.importBehavior.title')} description={tr('settings.library.importBehavior.description')} advanced>
        <SettingControl title={tr('settings.library.defaultImportPath.title')} description={tr('settings.library.defaultImportPath.description')} valueText={extendedSettings.defaultImportPath || tr('settings.library.value.systemDefault')}>
          <SettingsTextInput value={extendedSettings.defaultImportPath} placeholder={tr('settings.library.defaultImportPath.placeholder')} onCommit={(value) => updateExtendedSetting('defaultImportPath', value)} />
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={() => { void useAppDataDirAsDefaultImportPath(); }}>{tr('settings.library.defaultImportPath.useDataDir')}</button>
            <button className="ghost-btn small" type="button" onClick={() => updateExtendedSetting('defaultImportPath', '')}>{tr('settings.reader.action.clear')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.library.importFileFilter.title')} description={tr('settings.library.importFileFilter.description')} valueText={importFileFilterOptions.find((item) => item.value === extendedSettings.importFileFilter)?.label}>
          <ThemedSelect label={tr('settings.library.importFileFilter.label')} value={extendedSettings.importFileFilter} options={importFileFilterOptions} onChange={(value) => updateExtendedSetting('importFileFilter', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.txtImportEncodingMode.title')} description={tr('settings.library.txtImportEncodingMode.description')} valueText={txtImportEncodingModeOptions.find((item) => item.value === extendedSettings.txtImportEncodingMode)?.label}>
          <ThemedSelect label={tr('settings.library.txtImportEncodingMode.title')} value={extendedSettings.txtImportEncodingMode} options={txtImportEncodingModeOptions} onChange={(value) => updateExtendedSetting('txtImportEncodingMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.openImportedBookAfterImport.title')} description={tr('settings.library.openImportedBookAfterImport.description')} valueText={onOff(extendedSettings.openImportedBookAfterImport)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.openImportedBookAfterImport} onChange={(event) => updateExtendedSetting('openImportedBookAfterImport', event.target.checked)} /><span>{enabledDisabled(extendedSettings.openImportedBookAfterImport)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.confirmOpenExternalPath.title')} description={tr('settings.library.confirmOpenExternalPath.description')} valueText={onOff(extendedSettings.confirmOpenExternalPath)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.confirmOpenExternalPath} onChange={(event) => updateExtendedSetting('confirmOpenExternalPath', event.target.checked)} /><span>{enabledDisabled(extendedSettings.confirmOpenExternalPath)}</span></label>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.library.metadata.title')} description={tr('settings.library.metadata.description')}>
        <SettingControl title={tr('settings.library.defaultCoverToneStrategy.title')} description={tr('settings.library.defaultCoverToneStrategy.description')} valueText={defaultCoverToneStrategyOptions.find((item) => item.value === extendedSettings.defaultCoverToneStrategy)?.label}>
          <ThemedSelect label={tr('settings.library.defaultCoverToneStrategy.title')} value={extendedSettings.defaultCoverToneStrategy} options={defaultCoverToneStrategyOptions} onChange={(value) => updateExtendedSetting('defaultCoverToneStrategy', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.defaultCoverLabelStrategy.title')} description={tr('settings.library.defaultCoverLabelStrategy.description')} valueText={defaultCoverLabelStrategyOptions.find((item) => item.value === extendedSettings.defaultCoverLabelStrategy)?.label}>
          <ThemedSelect label={tr('settings.library.defaultCoverLabelStrategy.title')} value={extendedSettings.defaultCoverLabelStrategy} options={defaultCoverLabelStrategyOptions} onChange={(value) => updateExtendedSetting('defaultCoverLabelStrategy', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.library.cleanTitleFromFilename.title')} description={tr('settings.library.cleanTitleFromFilename.description')} valueText={onOff(extendedSettings.cleanTitleFromFilename)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.cleanTitleFromFilename} onChange={(event) => updateExtendedSetting('cleanTitleFromFilename', event.target.checked)} /><span>{enabledDisabled(extendedSettings.cleanTitleFromFilename)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.autoDetectAuthor.title')} description={tr('settings.library.autoDetectAuthor.description')} valueText={onOff(extendedSettings.autoDetectAuthor)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoDetectAuthor} onChange={(event) => updateExtendedSetting('autoDetectAuthor', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoDetectAuthor)}</span></label>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.library.trash.title')} description={tr('settings.library.trash.description')} advanced>
        <SettingControl title={tr('settings.library.trashRetentionDays.title')} description={t('library.trashRetention.help')} valueText={daysText(settings.trashRetentionDays)}>
          <ThemedSelect label={t('library.trashRetention.title')} value={String(settings.trashRetentionDays)} options={retentionSelectOptions} onChange={(value) => { void updateAppSettings({ trashRetentionDays: Number(value) }, tr('settings.library.status.trashRetentionSaved')); }} />
        </SettingControl>
        <SettingControl title={tr('settings.library.trashAutoCleanupEnabled.title')} description={tr('settings.library.trashAutoCleanupEnabled.description')} valueText={onOff(settings.trashAutoCleanupEnabled ?? true)}>
          <label className="settings-toggle"><input type="checkbox" checked={settings.trashAutoCleanupEnabled ?? true} onChange={(event) => { void updateAppSettings({ trashAutoCleanupEnabled: event.target.checked }, tr('settings.library.status.trashAutoCleanupSaved')); }} /><span>{enabledDisabled(settings.trashAutoCleanupEnabled ?? true)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.trashProtectReadingProgress.title')} description={tr('settings.library.trashProtectReadingProgress.description')} valueText={protectedText(settings.trashProtectReadingProgress !== false)}>
          <label className="settings-toggle"><input type="checkbox" checked={settings.trashProtectReadingProgress !== false} onChange={(event) => { void updateAppSettings({ trashProtectReadingProgress: event.target.checked }, tr('settings.library.status.trashReadingProgressSaved')); }} /><span>{settings.trashProtectReadingProgress !== false ? tr('settings.library.trashProtectReadingProgress.protect') : tr('settings.library.trashProtectReadingProgress.unprotect')}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.trashProtectReaderAssets.title')} description={tr('settings.library.trashProtectReaderAssets.description')} valueText={protectedText(settings.trashProtectReaderAssets !== false)}>
          <label className="settings-toggle"><input type="checkbox" checked={settings.trashProtectReaderAssets !== false} onChange={(event) => { void updateAppSettings({ trashProtectReaderAssets: event.target.checked }, tr('settings.library.status.trashReaderAssetsSaved')); }} /><span>{settings.trashProtectReaderAssets !== false ? tr('settings.library.trashProtectReaderAssets.protect') : tr('settings.library.trashProtectReaderAssets.unprotect')}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.confirmMoveToTrash.title')} description={tr('settings.library.confirmMoveToTrash.description')} valueText={onOff(extendedSettings.confirmMoveToTrash)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.confirmMoveToTrash} onChange={(event) => updateExtendedSetting('confirmMoveToTrash', event.target.checked)} /><span>{enabledDisabled(extendedSettings.confirmMoveToTrash)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.confirmPermanentDelete.title')} description={tr('settings.library.confirmPermanentDelete.description')} valueText={onOff(extendedSettings.confirmPermanentDelete)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.confirmPermanentDelete} onChange={(event) => updateExtendedSetting('confirmPermanentDelete', event.target.checked)} /><span>{enabledDisabled(extendedSettings.confirmPermanentDelete)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.confirmEmptyTrash.title')} description={tr('settings.library.confirmEmptyTrash.description')} valueText={onOff(extendedSettings.confirmEmptyTrash)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.confirmEmptyTrash} onChange={(event) => updateExtendedSetting('confirmEmptyTrash', event.target.checked)} /><span>{enabledDisabled(extendedSettings.confirmEmptyTrash)}</span></label>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.library.duplicates.title')} description={tr('settings.library.duplicates.description')}>
        <SettingControl title={tr('settings.library.duplicateStrategy.title')} description={tr('settings.library.duplicateStrategy.description')} valueText={extendedSettings.duplicateStrategy}>
          <ThemedSelect label={tr('settings.library.duplicateStrategy.title')} value={extendedSettings.duplicateStrategy} options={duplicateStrategyOptions} onChange={(value) => updateExtendedSetting('duplicateStrategy', value)} />
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.library.batch.title')} description={tr('settings.library.batch.description')} advanced>
        <SettingControl title={tr('settings.library.directoryImportRecursive.title')} description={tr('settings.library.directoryImportRecursive.description')} valueText={extendedSettings.directoryImportRecursive ? tr('settings.library.state.recursiveScan') : tr('settings.library.state.topLevelOnly')}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.directoryImportRecursive} onChange={(event) => updateExtendedSetting('directoryImportRecursive', event.target.checked)} /><span>{extendedSettings.directoryImportRecursive ? tr('settings.library.state.recursiveScan') : tr('settings.library.state.topLevelOnly')}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.showImportSummaryAfterImport.title')} description={tr('settings.library.showImportSummaryAfterImport.description')} valueText={onOff(extendedSettings.showImportSummaryAfterImport)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.showImportSummaryAfterImport} onChange={(event) => updateExtendedSetting('showImportSummaryAfterImport', event.target.checked)} /><span>{enabledDisabled(extendedSettings.showImportSummaryAfterImport)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.continueDirectoryImportAfterFailure.title')} description={tr('settings.library.continueDirectoryImportAfterFailure.description')} valueText={extendedSettings.continueDirectoryImportAfterFailure ? tr('settings.library.state.continue') : tr('settings.library.state.stop')}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.continueDirectoryImportAfterFailure} onChange={(event) => updateExtendedSetting('continueDirectoryImportAfterFailure', event.target.checked)} /><span>{extendedSettings.continueDirectoryImportAfterFailure ? tr('settings.library.state.continueFiles') : tr('settings.library.state.stopOnFailure')}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.autoCleanTxtOnImport.title')} description={tr('settings.library.autoCleanTxtOnImport.description')} valueText={onOff(extendedSettings.autoCleanTxtOnImport)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoCleanTxtOnImport} onChange={(event) => updateExtendedSetting('autoCleanTxtOnImport', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoCleanTxtOnImport)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.autoBackupImportedOriginals.title')} description={tr('settings.library.autoBackupImportedOriginals.description')} valueText={onOff(extendedSettings.autoBackupImportedOriginals)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoBackupImportedOriginals} onChange={(event) => updateExtendedSetting('autoBackupImportedOriginals', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoBackupImportedOriginals)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.library.autoIndexImportedBooks.title')} description={tr('settings.library.autoIndexImportedBooks.description')}>
          <ReadonlyPill text={extendedSettings.autoIndexImportedBooks ? tr('settings.library.autoIndexImportedBooks.auto') : tr('settings.library.autoIndexImportedBooks.manual')} />
        </SettingControl>
      </SettingsSection>
    </>
  );
}

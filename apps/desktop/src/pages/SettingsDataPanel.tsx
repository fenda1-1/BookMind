import { ThemedSelect } from './SettingsSelect';
import { normalizeDisplayPath } from '../features/settings-center/settingsCenterPathDisplayModel';
import { formatSettingsByteSize, shortKeyId } from '../features/settings-center/settingsCenterStatusFormatModel';
import { getPrivacyFilePath } from '../services/settingsCenterService';
import { ReadonlyPill, SettingControl, SettingsNumberInput, SettingsSection } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';
export function SettingsDataPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    locale,
    localePreference,
    setLocalePreference,
    settings,
    extendedSettings,
    readerGlobalSettings,
    currentBookId,
    currentBookTitle,
    diagnosticPaths,
    privacyDiagnosticPaths,
    localEncryptionStatus,
    loadingLocalEncryptionStatus,
    localEncryptionStatusError,
    privacyLocalEncryptionFallbackPath,
    masterPasswordDraft,
    setMasterPasswordDraft,
    masterPasswordVerifyDraft,
    setMasterPasswordVerifyDraft,
    masterPasswordBusy,
    localKeyRotationBusy,
    lastLocalKeyRotationSummary,
    dataDirectoryStatus,
    dataDirectoryBusy,
    dataDirectoryError,
    dataDirectoryMigrationProgress,
    selectedDataBackupPath,
    dataBackupBusy,
    lastDataBackupResult,
    diagnosticsRedactionPreview,
    setDiagnosticsRedactionPreview,
    operationLogs,
    filteredOperationLogs,
    operationLogFilterLevel,
    setOperationLogFilterLevel,
    operationLogFilterQuery,
    setOperationLogFilterQuery,
    setOperationLogs,
    performanceTuningProfile,
    shortcutConflictMessages,
    localeOptions,
    translationFallbackOptions,
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
    searchScopeOptions,
    globalSearchModeOptions,
    readerSearchChapterFilterOptions,
    readerSearchHighlightColorOptions,
    indexStrategyVersionOptions,
    ftsRepairStrategyOptions,
    indexRebuildStrategyOptions,
    indexPauseResumeStrategyOptions,
    highlightColorOptions,
    highlightColorShortcutOptions,
    highlightImportanceOptions,
    highlightReviewStatusOptions,
    highlightOverlapStrategyOptions,
    anchorRepairStrategyOptions,
    exportFormatOptions,
    annotationExportContentOptions,
    annotationJsonImportConflictStrategyOptions,
    noteDefaultSaveTargetOptions,
    annotationCsvFieldOptions,
    knowledgeDefaultColumnOptions,
    bookmarkSortOptions,
    bookmarkGroupOptions,
    dataAutoBackupFrequencyOptions,
    dataBackupModeOptions,
    backgroundTaskNotificationModeOptions,
    taskCenterDefaultStatusFilterOptions,
    commandPaletteShortcutOptions,
    commandPaletteSortModeOptions,
    readerNavigationShortcutOptions,
    libraryNavigationShortcutOptions,
    searchNavigationShortcutOptions,
    importShortcutOptions,
    aiSummaryShortcutOptions,
    readerHighlightShortcutOptions,
    readerBookmarkShortcutOptions,
    readerAiPanelShortcutOptions,
    readerSearchShortcutOptions,
    operationLogOptions,
    operationLogFilterLevelOptions,
    taskLogRetentionOptions,
    settingsScopeMatrix,
    encryptionCoverageMatrix,
    updateAppSettings,
    updateExtendedSetting,
    updateReaderGlobalSetting,
    useAppDataDirAsDefaultImportPath,
    toggleAnnotationCsvField,
    toggleKnowledgeDefaultColumn,
    updateHighlightColorMeaning,
    updateHighlightColorShortcut,
    chooseAndMigrateDataDirectoryFromSettings,
    enablePortableDataDirectoryFromSettings,
    openDataDirectoryFromSettings,
    getDataDirectoryStatusFromSettings,
    refreshLocalEncryptionStatus,
    setMasterPasswordFromSettings,
    verifyMasterPasswordFromSettings,
    rotateLocalDataKeyFromSettings,
    chooseDataBackupDirectoryFromSettings,
    createDataBackupFromSettings,
    restoreDataBackupFromSettings,
    clearCurrentBookAllDataSettingsData,
    clearAllReaderCacheSettingsData,
    clearCurrentBookReaderCacheSettingsData,
    clearAllReaderPageCacheSettingsData,
    clearCurrentBookReaderPageCacheSettingsData,
    clearReaderSearchSettingsData,
    clearOperationLogSettingsData,
    clearOrphanReaderRecordsSettingsData,
    rebuildDatabaseIndexesSettingsData,
    vacuumDatabaseSettingsData,
    updateGlobalShortcutSetting,
    updateNavigationShortcut,
    updateReaderShortcut,
    restoreGlobalShortcutsDefaults,
    applyTaskLogRetentionPolicy,
    updateCompletedTaskRetentionLimit,
    updateOperationLogRetention,
    operationLogRetentionDays,
    refreshDiagnosticsRedactionPreview,
    exportOperationLogsSettingsData,
    exportApplicationDiagnosticsFromSettings,
    exportAiDiagnosticsFromSettings,
    exportIndexDiagnosticsFromSettings,
    exportTaskDiagnosticsFromSettings,
    exportReaderDiagnosticsFromSettings,
    copySystemInfoFromSettings,
    copyTauriCommandFailureInfo,
    loadOperationLogs,
    clearOperationLogs,
    formatSettingsChangeTime,
  } = props;
  const onOff = (enabled: boolean) => enabled ? t('settings.common.on') : t('settings.common.off');
  const enabledDisabled = (enabled: boolean) => enabled ? t('settings.common.enabled') : t('settings.common.disabled');
  const shownHidden = (shown: boolean) => shown ? t('settings.data.state.shown') : t('settings.data.state.hidden');
  const displayedHidden = (shown: boolean) => shown ? t('settings.data.state.shownPast') : t('settings.data.state.hiddenPast');
  const loadingOrPath = (value?: string) => value ? normalizeDisplayPath(value) : t('settings.data.state.loading');
  const encryptionKeyStatus = formatLocalEncryptionKeyStatusLabel(localEncryptionStatus, loadingLocalEncryptionStatus, localEncryptionStatusError, t);
  const fallbackProtection = formatLocalEncryptionFallbackProtectionLabel(localEncryptionStatus, t);
  const dataDirectoryModeLabel = formatDataDirectoryModeLabel(dataDirectoryStatus, t);
  const dataDirectoryMigrationPercent = getDataDirectoryMigrationPercent(dataDirectoryMigrationProgress);
    return (
      <SettingsSection title={t('settings.data.privacy.title')} description={t('settings.data.privacy.description')}>
        <SettingControl title={t('settings.data.applicationPrivacyMode.title')} description={t('settings.data.applicationPrivacyMode.description')} valueText={onOff(extendedSettings.applicationPrivacyMode)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.applicationPrivacyMode} onChange={(event) => updateExtendedSetting('applicationPrivacyMode', event.target.checked)} /><span>{enabledDisabled(extendedSettings.applicationPrivacyMode)}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.hideRecentReading.title')} description={t('settings.data.hideRecentReading.description')} valueText={shownHidden(!(extendedSettings.applicationPrivacyMode || extendedSettings.hideRecentReadingInPrivacyMode))}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.applicationPrivacyMode || extendedSettings.hideRecentReadingInPrivacyMode} disabled={extendedSettings.applicationPrivacyMode} onChange={(event) => updateExtendedSetting('hideRecentReadingInPrivacyMode', event.target.checked)} /><span>{displayedHidden(!(extendedSettings.applicationPrivacyMode || extendedSettings.hideRecentReadingInPrivacyMode))}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.hideFilePaths.title')} description={t('settings.data.hideFilePaths.description')} valueText={shownHidden(!(extendedSettings.applicationPrivacyMode || extendedSettings.hideFilePathsInPrivacyMode))}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.applicationPrivacyMode || extendedSettings.hideFilePathsInPrivacyMode} disabled={extendedSettings.applicationPrivacyMode} onChange={(event) => updateExtendedSetting('hideFilePathsInPrivacyMode', event.target.checked)} /><span>{displayedHidden(!(extendedSettings.applicationPrivacyMode || extendedSettings.hideFilePathsInPrivacyMode))}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.hideBookTitles.title')} description={t('settings.data.hideBookTitles.description')} valueText={shownHidden(!(extendedSettings.applicationPrivacyMode || extendedSettings.hideBookTitlesInPrivacyMode))}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.applicationPrivacyMode || extendedSettings.hideBookTitlesInPrivacyMode} disabled={extendedSettings.applicationPrivacyMode} onChange={(event) => updateExtendedSetting('hideBookTitlesInPrivacyMode', event.target.checked)} /><span>{displayedHidden(!(extendedSettings.applicationPrivacyMode || extendedSettings.hideBookTitlesInPrivacyMode))}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.appLock.title')} description={t('settings.data.appLock.description')} valueText={extendedSettings.appLockEnabled ? t('settings.data.appLock.value', { minutes: extendedSettings.appLockIdleTimeoutMinutes }) : t('settings.common.off')}>
          <div className="settings-inline-actions">
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.appLockEnabled} onChange={(event) => updateExtendedSetting('appLockEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.appLockEnabled)}</span></label>
            <label className="settings-number-field">{t('settings.data.appLock.idleLabel')}<SettingsNumberInput min={1} max={240} value={extendedSettings.appLockIdleTimeoutMinutes} disabled={!extendedSettings.appLockEnabled} onCommit={(value) => updateExtendedSetting('appLockIdleTimeoutMinutes', value)} /></label>
          </div>
          <p className="settings-status-line">{t('settings.data.appLock.note')}</p>
        </SettingControl>
        <SettingControl title={t('settings.data.copyDiagnosticsAutoRedact.title')} description={t('settings.data.copyDiagnosticsAutoRedact.description')} valueText={extendedSettings.copyDiagnosticsAutoRedact ? t('settings.data.copyDiagnosticsAutoRedact.redacted') : t('settings.data.copyDiagnosticsAutoRedact.raw')}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.copyDiagnosticsAutoRedact} onChange={(event) => updateExtendedSetting('copyDiagnosticsAutoRedact', event.target.checked)} /><span>{extendedSettings.copyDiagnosticsAutoRedact ? t('settings.data.copyDiagnosticsAutoRedact.enabledLabel') : t('settings.data.copyDiagnosticsAutoRedact.disabledLabel')}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.operationLogRecordInputContent.title')} description={t('settings.data.operationLogRecordInputContent.description')} valueText={extendedSettings.operationLogRecordInputContent ? t('settings.data.operationLogRecordInputContent.allowed') : t('settings.data.operationLogRecordInputContent.hidden')}>
          <label className="settings-toggle"><input type="checkbox" checked={!extendedSettings.operationLogRecordInputContent} onChange={(event) => updateExtendedSetting('operationLogRecordInputContent', !event.target.checked)} /><span>{extendedSettings.operationLogRecordInputContent ? t('settings.data.operationLogRecordInputContent.allowedRaw') : t('settings.data.operationLogRecordInputContent.hiddenRaw')}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.operationLogRecordPaths.title')} description={t('settings.data.operationLogRecordPaths.description')} valueText={extendedSettings.operationLogRecordPaths ? t('settings.data.operationLogRecordPaths.allowed') : t('settings.data.operationLogRecordPaths.hidden')}>
          <label className="settings-toggle"><input type="checkbox" checked={!extendedSettings.operationLogRecordPaths} onChange={(event) => updateExtendedSetting('operationLogRecordPaths', !event.target.checked)} /><span>{extendedSettings.operationLogRecordPaths ? t('settings.data.operationLogRecordPaths.allowed') : t('settings.data.operationLogRecordPaths.hiddenRaw')}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.readerPrivacyMode.title')} description={t('settings.data.readerGlobal.description')} valueText={onOff(readerGlobalSettings.privacyMode)}>
          <label className="settings-toggle"><input type="checkbox" checked={readerGlobalSettings.privacyMode} onChange={(event) => updateReaderGlobalSetting('privacyMode', event.target.checked)} /><span>{enabledDisabled(readerGlobalSettings.privacyMode)}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.encryptSensitiveReaderData.title')} description={t('settings.data.readerGlobal.description')} valueText={onOff(readerGlobalSettings.encryptSensitiveReaderData)}>
          <label className="settings-toggle"><input type="checkbox" checked={readerGlobalSettings.encryptSensitiveReaderData} onChange={(event) => updateReaderGlobalSetting('encryptSensitiveReaderData', event.target.checked)} /><span>{enabledDisabled(readerGlobalSettings.encryptSensitiveReaderData)}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.encryptionStatus.title')} description={t('settings.data.encryptionStatus.description')} valueText={encryptionKeyStatus}>
          <div className="settings-encryption-status" role="status" aria-live="polite">
            <div>
              <ReadonlyPill text="AES-256-GCM" />
              <ReadonlyPill text={localEncryptionStatus?.envelopeVersion ?? 'local-envelope-v1'} />
              <ReadonlyPill text={`active ${shortKeyId(localEncryptionStatus?.activeKeyId)}`} />
              <ReadonlyPill text={`retired ${localEncryptionStatus?.retiredKeyCount ?? 0}`} />
              <ReadonlyPill text={`Nonce ${localEncryptionStatus?.nonceBytes ?? 12} bytes`} />
              <ReadonlyPill text={`Key ${localEncryptionStatus?.keyBytes ?? 32} bytes`} />
            </div>
            <dl>
              <div>
                <dt>{t('settings.data.encryptionStatus.keyStatus')}</dt>
                <dd>{encryptionKeyStatus}</dd>
              </div>
              <div>
                <dt>{t('settings.data.encryptionStatus.keyring')}</dt>
                <dd>{localEncryptionStatus?.keyringAvailable ? t('settings.data.encryptionStatus.keyringAvailable') : t('settings.data.encryptionStatus.keyringUnavailable')}</dd>
              </div>
              <div>
                <dt>{t('settings.data.encryptionStatus.fallbackProtection')}</dt>
                <dd>{fallbackProtection}</dd>
              </div>
              <div>
                <dt>{t('settings.data.encryptionStatus.protectedScope')}</dt>
                <dd>{localEncryptionStatus ? t('settings.data.count.kinds', { count: localEncryptionStatus.protectedKinds.length }) : t('settings.data.state.loading')}</dd>
              </div>
            </dl>
            {localEncryptionStatus ? <small>{t('settings.data.encryptionStatus.fallbackPath', { path: privacyLocalEncryptionFallbackPath })}</small> : null}
            {localEncryptionStatus?.wrappedFallbackFileExists ? <small>{t('settings.data.encryptionStatus.masterPasswordWrap', { path: getPrivacyFilePath(localEncryptionStatus.wrappedFallbackFilePath, extendedSettings) })}</small> : null}
            {localEncryptionStatus ? <small>{t('settings.data.encryptionStatus.coverage', { kinds: localEncryptionStatus.protectedKinds.join(', ') })}</small> : null}
            {localEncryptionStatusError ? <p className="settings-status-line">{t('settings.data.error.readFailed', { error: localEncryptionStatusError })}</p> : null}
            <button className="ghost-btn small" type="button" onClick={() => { void refreshLocalEncryptionStatus(); }} disabled={loadingLocalEncryptionStatus}>{loadingLocalEncryptionStatus ? t('settings.data.action.refreshing') : t('settings.data.action.refreshStatus')}</button>
          </div>
        </SettingControl>
        <SettingControl title={t('settings.data.masterPassword.title')} description={t('settings.data.masterPassword.description')} valueText={localEncryptionStatus?.masterPasswordEnabled ? t('settings.data.state.enabled') : t('settings.data.state.notEnabled')}>
          <div className="settings-inline-actions">
            <input className="settings-inline-input" type="password" autoComplete="new-password" value={masterPasswordDraft} placeholder={t('settings.data.masterPassword.setPlaceholder')} onChange={(event) => setMasterPasswordDraft(event.target.value)} />
            <button className="ghost-btn small" type="button" onClick={() => { void setMasterPasswordFromSettings(); }} disabled={masterPasswordBusy || masterPasswordDraft.length < 8}>{masterPasswordBusy ? t('settings.data.action.processing') : localEncryptionStatus?.masterPasswordEnabled ? t('settings.data.masterPassword.change') : t('settings.data.masterPassword.enable')}</button>
          </div>
          <div className="settings-inline-actions">
            <input className="settings-inline-input" type="password" autoComplete="current-password" value={masterPasswordVerifyDraft} placeholder={t('settings.data.masterPassword.verifyPlaceholder')} onChange={(event) => setMasterPasswordVerifyDraft(event.target.value)} />
            <button className="ghost-btn small" type="button" onClick={() => { void verifyMasterPasswordFromSettings(); }} disabled={masterPasswordBusy || !masterPasswordVerifyDraft.trim()}>{masterPasswordBusy ? t('settings.data.action.verifying') : t('settings.data.masterPassword.verify')}</button>
          </div>
          <p className="settings-status-line">{t('settings.data.masterPassword.boundary')}</p>
        </SettingControl>
        <SettingControl title={t('settings.data.keyRotation.title')} description={t('settings.data.keyRotation.description')} valueText={localEncryptionStatus?.activeKeyId ? `active ${shortKeyId(localEncryptionStatus.activeKeyId)}` : t('settings.data.state.notInitialized')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void rotateLocalDataKeyFromSettings(); }} disabled={localKeyRotationBusy || (localEncryptionStatus?.masterPasswordEnabled && !masterPasswordVerifyDraft.trim())}>{localKeyRotationBusy ? t('settings.data.keyRotation.rotating') : t('settings.data.keyRotation.rotate')}</button>
            <ReadonlyPill text={`retired keys：${localEncryptionStatus?.retiredKeyCount ?? 0}`} />
          </div>
          <p className="settings-status-line">{localEncryptionStatus?.masterPasswordEnabled ? t('settings.data.keyRotation.masterPasswordRequired') : t('settings.data.keyRotation.noMasterPassword')}</p>
          {lastLocalKeyRotationSummary ? <p className="settings-status-line">{lastLocalKeyRotationSummary}</p> : null}
        </SettingControl>
        <SettingControl title={t('settings.data.encryptionCoverage.title')} description={t('settings.data.encryptionCoverage.description')} valueText={localEncryptionStatus ? t('settings.data.encryptionCoverage.value', { count: localEncryptionStatus.protectedKinds.length }) : t('settings.data.state.loading')}>
          <div className="settings-encryption-coverage">
            {encryptionCoverageMatrix.map((item) => {
              const backendProtected = localEncryptionStatus?.protectedKinds.includes(item.kind) ?? false;
              const statusLabel = item.status === 'protected'
                ? backendProtected ? t('settings.data.encryptionCoverage.protected') : t('settings.data.encryptionCoverage.unprotected')
                : item.status === 'excluded' ? t('settings.data.encryptionCoverage.excluded') : t('settings.data.encryptionCoverage.unprotected');
              return (
                <article className={`settings-encryption-coverage-item status-${item.status}`} key={item.kind}>
                  <strong>{item.label}</strong>
                  <span>{statusLabel}</span>
                  <small>{item.storage}</small>
                  <p>{item.note}</p>
                </article>
              );
            })}
          </div>
        </SettingControl>
        <SettingControl title={t('settings.data.recordRecentReaderBooks.title')} description={t('settings.data.recordRecentReaderBooks.description')} valueText={onOff(extendedSettings.recordRecentReaderBooks)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.recordRecentReaderBooks} onChange={(event) => updateExtendedSetting('recordRecentReaderBooks', event.target.checked)} /><span>{enabledDisabled(extendedSettings.recordRecentReaderBooks)}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.trackReadingTime.title')} description={t('settings.data.trackReadingTime.description')} valueText={onOff(extendedSettings.trackReadingTime)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.trackReadingTime} onChange={(event) => updateExtendedSetting('trackReadingTime', event.target.checked)} /><span>{enabledDisabled(extendedSettings.trackReadingTime)}</span></label>
        </SettingControl>
        <SettingControl title={t('settings.data.scopeMatrix.title')} description={t('settings.data.scopeMatrix.description')} valueText={t('settings.data.count.kinds', { count: settingsScopeMatrix.length })}>
          <div className="settings-scope-matrix">
            {settingsScopeMatrix.map((item) => (
              <article className={`settings-scope-card scope-${item.scope}`} key={item.scope}>
                <strong>{item.label}</strong>
                <span>{item.storage}</span>
                <em>{item.examples}</em>
                <small>{item.owner}</small>
              </article>
            ))}
          </div>
        </SettingControl>
        <SettingControl title={t('settings.data.backupRestore.title')} description={t('settings.data.backupRestore.description')} valueText={lastDataBackupResult ? t('settings.data.count.files', { count: lastDataBackupResult.copiedFiles }) : t('settings.data.backupRestore.manual')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={() => { void createDataBackupFromSettings(); }} disabled={dataBackupBusy}>{dataBackupBusy ? t('settings.data.action.processing') : t('settings.data.backupRestore.create')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void chooseDataBackupDirectoryFromSettings(); }} disabled={dataBackupBusy}>{t('settings.data.backupRestore.chooseDirectory')}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void restoreDataBackupFromSettings(); }} disabled={dataBackupBusy || !selectedDataBackupPath.trim()}>{dataBackupBusy ? t('settings.data.action.processing') : t('settings.data.backupRestore.restore')}</button>
          </div>
          <p className="settings-status-line">{t('settings.data.backupRestore.includes')}</p>
          <p className="settings-status-line">{t('settings.data.backupRestore.excludes')}</p>
          <div className="settings-inline-actions">
            <ReadonlyPill text={t('settings.data.backupRestore.lastPath', { path: lastDataBackupResult ? normalizeDisplayPath(lastDataBackupResult.backupPath) : t('settings.data.state.none') })} />
            <ReadonlyPill text={t('settings.data.backupRestore.restorePath', { path: selectedDataBackupPath ? normalizeDisplayPath(selectedDataBackupPath) : t('settings.data.state.notSelected') })} />
          </div>
        </SettingControl>
        <SettingControl title={t('settings.data.autoBackup.title')} description={t('settings.data.autoBackup.description')} valueText={extendedSettings.dataAutoBackupEnabled ? t('settings.data.autoBackup.value', { frequency: dataAutoBackupFrequencyOptions.find((item) => item.value === extendedSettings.dataAutoBackupFrequency)?.label ?? t('settings.data.autoBackup.weekly'), mode: dataBackupModeOptions.find((item) => item.value === extendedSettings.dataBackupMode)?.label ?? t('settings.data.autoBackup.fullSnapshot'), count: extendedSettings.dataAutoBackupRetentionLimit }) : t('settings.common.off')}>
          <div className="settings-inline-actions">
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.dataAutoBackupEnabled} onChange={(event) => updateExtendedSetting('dataAutoBackupEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.dataAutoBackupEnabled)}</span></label>
            <ThemedSelect label={t('settings.data.autoBackup.frequency')} value={extendedSettings.dataAutoBackupFrequency} options={dataAutoBackupFrequencyOptions} onChange={(value) => updateExtendedSetting('dataAutoBackupFrequency', value)} />
            <ThemedSelect label={t('settings.data.autoBackup.mode')} value={extendedSettings.dataBackupMode} options={dataBackupModeOptions} onChange={(value) => updateExtendedSetting('dataBackupMode', value)} />
            <label className="settings-number-field">{t('settings.data.autoBackup.retention')}<SettingsNumberInput min={1} max={30} value={extendedSettings.dataAutoBackupRetentionLimit} onCommit={(value) => updateExtendedSetting('dataAutoBackupRetentionLimit', value)} /></label>
          </div>
          <p className="settings-status-line">{t('settings.data.autoBackup.note')}</p>
        </SettingControl>
        <SettingControl title={t('settings.data.dataDirectory.title')} description={t('settings.data.dataDirectory.description')} valueText={privacyDiagnosticPaths.dataDir}>
          <div className="settings-inline-actions">
            <ReadonlyPill text={privacyDiagnosticPaths.dataDir} />
            <button className="ghost-btn small" type="button" onClick={() => { void openDataDirectoryFromSettings(); }}>{t('settings.data.dataDirectory.open')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void chooseAndMigrateDataDirectoryFromSettings(); }} disabled={dataDirectoryBusy}>{dataDirectoryBusy ? t('settings.data.action.processing') : t('settings.data.dataDirectory.migrate')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void getDataDirectoryStatusFromSettings(); }} disabled={dataDirectoryBusy}>{t('settings.data.action.refreshStatus')}</button>
          </div>
          <div className="settings-inline-actions">
            <ReadonlyPill text={t('settings.data.dataDirectory.currentMode', { mode: dataDirectoryModeLabel })} />
            <ReadonlyPill text={t('settings.data.dataDirectory.defaultDir', { path: dataDirectoryStatus ? normalizeDisplayPath(dataDirectoryStatus.defaultDataDir) : t('settings.data.state.loading') })} />
            <ReadonlyPill text={t('settings.data.dataDirectory.locatorFile', { path: dataDirectoryStatus ? normalizeDisplayPath(dataDirectoryStatus.locatorFile) : t('settings.data.state.loading') })} />
          </div>
          {dataDirectoryMigrationProgress ? (
            <div className="settings-data-migration-progress" role="status" aria-live="polite">
              <div>
                <strong>{t('settings.data.dataDirectory.progress.phase', { phase: formatDataDirectoryMigrationPhase(dataDirectoryMigrationProgress.phase, t) })}</strong>
                <span>{t('settings.data.dataDirectory.progress.percent', { percent: dataDirectoryMigrationPercent })}</span>
              </div>
              <progress value={dataDirectoryMigrationPercent} max={100}>{dataDirectoryMigrationPercent}%</progress>
              <small>{t('settings.data.dataDirectory.progress.files', { copied: dataDirectoryMigrationProgress.copiedFiles, total: dataDirectoryMigrationProgress.totalFiles })}</small>
              <small>{t('settings.data.dataDirectory.progress.bytes', { copied: formatSettingsByteSize(dataDirectoryMigrationProgress.copiedBytes), total: formatSettingsByteSize(dataDirectoryMigrationProgress.totalBytes) })}</small>
              {dataDirectoryMigrationProgress.currentPath ? <small title={dataDirectoryMigrationProgress.currentPath}>{normalizeDisplayPath(dataDirectoryMigrationProgress.currentPath)}</small> : null}
            </div>
          ) : null}
          <p className="settings-status-line">{t('settings.data.dataDirectory.note')}</p>
          {dataDirectoryError ? <p className="settings-status-line">{t('settings.data.dataDirectory.error', { error: dataDirectoryError })}</p> : null}
        </SettingControl>
        <SettingControl title={t('settings.data.portable.title')} description={t('settings.data.portable.description')} valueText={dataDirectoryModeLabel}>
          <div className="settings-inline-actions">
            <ReadonlyPill text={t('settings.data.portable.dir', { path: dataDirectoryStatus ? normalizeDisplayPath(dataDirectoryStatus.portableDir) : t('settings.data.state.loading') })} />
            <ReadonlyPill text={dataDirectoryStatus?.portableAvailable ? t('settings.data.portable.available') : t('settings.data.portable.disabled')} />
            <button className="ghost-btn small" type="button" onClick={() => { void enablePortableDataDirectoryFromSettings(); }} disabled={dataDirectoryBusy}>{dataDirectoryBusy ? t('settings.data.action.processing') : t('settings.data.portable.enable')}</button>
          </div>
          <p className="settings-status-line">{t('settings.data.portable.note')}</p>
        </SettingControl>
        <SettingControl title={t('settings.data.settingsFile.title')} description={t('settings.data.settingsFile.description')} valueText={privacyDiagnosticPaths.settingsFile}>
          <ReadonlyPill text={privacyDiagnosticPaths.settingsFile} />
        </SettingControl>
        <SettingControl title={t('settings.data.ftsDatabase.title')} description={t('settings.data.ftsDatabase.description')} valueText={privacyDiagnosticPaths.ftsDatabase}>
          <ReadonlyPill text={privacyDiagnosticPaths.ftsDatabase} />
        </SettingControl>
        <SettingControl title={t('settings.data.cleanup.title')} description={t('settings.data.cleanup.description')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small danger-btn" type="button" onClick={clearOperationLogSettingsData}>{t('settings.data.cleanup.operationLogs')}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearCurrentBookReaderCacheSettingsData(); }} disabled={!currentBookTitle}>{t('settings.data.cleanup.currentBookReaderCache')}{currentBookTitle ? t('settings.data.suffix.named', { name: currentBookTitle }) : ''}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearAllReaderCacheSettingsData(); }}>{t('settings.data.cleanup.allReaderCache')}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearCurrentBookAllDataSettingsData(); }} disabled={!currentBookId}>{t('settings.data.cleanup.currentBookAllData')}{currentBookTitle ? t('settings.data.suffix.named', { name: currentBookTitle }) : ''}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearOrphanReaderRecordsSettingsData(); }}>{t('settings.data.cleanup.orphanRecords')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void rebuildDatabaseIndexesSettingsData(); }}>{t('settings.data.cleanup.rebuildIndexes')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void vacuumDatabaseSettingsData(); }}>{t('settings.data.cleanup.vacuum')}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearCurrentBookReaderPageCacheSettingsData(); }} disabled={!currentBookTitle}>{t('settings.data.cleanup.currentBookPageCache')}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={() => { void clearAllReaderPageCacheSettingsData(); }}>{t('settings.data.cleanup.allPageCache')}</button>
            <button className="ghost-btn small danger-btn" type="button" onClick={clearReaderSearchSettingsData}>{t('settings.data.cleanup.searchHistory')}</button>
          </div>
        </SettingControl>
      </SettingsSection>
    );
  }

function formatLocalEncryptionKeyStatusLabel(
  status: SettingsSupplementalPanelsProps['localEncryptionStatus'],
  loading: boolean,
  error: string,
  t: SettingsSupplementalPanelsProps['t'],
) {
  if (loading) return t('settings.data.state.loading');
  if (error) return t('settings.data.state.error');
  if (!status) return t('settings.data.state.notLoaded');
  if (status.keyStatus === 'available') return t('settings.data.encryptionStatus.available');
  if (status.keyStatus === 'locked') return t('settings.data.encryptionStatus.locked');
  if (status.keyStatus === 'missing') return t('settings.data.encryptionStatus.missing');
  if (status.keyStatus === 'error') return t('settings.data.state.error');
  return status.keyStatus || t('settings.data.state.unknown');
}

function formatLocalEncryptionFallbackProtectionLabel(
  status: SettingsSupplementalPanelsProps['localEncryptionStatus'],
  t: SettingsSupplementalPanelsProps['t'],
) {
  if (!status) return t('settings.data.state.loading');
  if (status.fallbackProtection === 'masterPassword') return t('settings.data.encryptionStatus.masterPasswordProtection');
  if (status.fallbackProtection === 'plaintextFile') return t('settings.data.encryptionStatus.plaintextFallback');
  if (status.fallbackProtection === 'keyringOnly') return t('settings.data.encryptionStatus.keyringOnly');
  if (status.fallbackProtection === 'none') return t('settings.data.encryptionStatus.notCreated');
  return status.fallbackProtection || t('settings.data.state.unknown');
}

function formatDataDirectoryModeLabel(
  status: SettingsSupplementalPanelsProps['dataDirectoryStatus'],
  t: SettingsSupplementalPanelsProps['t'],
) {
  if (!status) return t('settings.data.state.loading');
  if (status.mode === 'portable') return t('settings.data.dataDirectory.mode.portable');
  if (status.mode === 'custom') return t('settings.data.dataDirectory.mode.custom');
  return t('settings.data.dataDirectory.mode.default');
}

function getDataDirectoryMigrationPercent(progress: SettingsSupplementalPanelsProps['dataDirectoryMigrationProgress']) {
  if (!progress) return 0;
  if (progress.phase === 'completed') return 100;
  if (progress.totalBytes > 0) return Math.min(100, Math.round((progress.copiedBytes / progress.totalBytes) * 100));
  if (progress.totalFiles > 0) return Math.min(100, Math.round((progress.copiedFiles / progress.totalFiles) * 100));
  return ['rewriting', 'finalizing', 'cleaning', 'completed'].includes(progress.phase) ? 100 : 0;
}

function formatDataDirectoryMigrationPhase(phase: string, t: SettingsSupplementalPanelsProps['t']) {
  if (phase === 'copying') return t('settings.data.dataDirectory.progress.copying');
  if (phase === 'rewriting') return t('settings.data.dataDirectory.progress.rewriting');
  if (phase === 'finalizing') return t('settings.data.dataDirectory.progress.finalizing');
  if (phase === 'cleaning') return t('settings.data.dataDirectory.progress.cleaning');
  if (phase === 'completed') return t('settings.data.dataDirectory.progress.completed');
  return t('settings.data.dataDirectory.progress.preparing');
}

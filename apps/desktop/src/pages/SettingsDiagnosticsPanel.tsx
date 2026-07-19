import { ThemedSelect } from './SettingsSelect';
import { SettingControl, SettingsNumberInput, SettingsSection } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsDiagnosticsPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    settings,
    extendedSettings,
    diagnosticsRedactionPreview,
    setDiagnosticsRedactionPreview,
    operationLogs,
    filteredOperationLogs,
    operationLogFilterLevel,
    setOperationLogFilterLevel,
    operationLogFilterQuery,
    setOperationLogFilterQuery,
    setOperationLogs,
    operationLogOptions,
    operationLogFilterLevelOptions,
    taskLogRetentionOptions,
    updateAppSettings,
    updateExtendedSetting,
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
  } = props;
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const enabledDisabled = (value: boolean) => tr(value ? 'settings.common.enabled' : 'settings.common.disabled');
  const experimentToggleText = (titleKey: string, enabled: boolean) => tr('settings.diagnostics.experiments.toggleText', { title: tr(titleKey), status: enabledDisabled(enabled) });

  return (
    <>
      <SettingsSection title={t('settings.logs.title')} description={t('settings.logs.help')}>
        <SettingControl title={t('settings.logs.level')} description={t('settings.logs.value', { level: t(`settings.logs.level.${settings.operationLogLevel ?? 'none'}` as never) })} valueText={settings.operationLogLevel}>
          <ThemedSelect label={t('settings.logs.level')} value={settings.operationLogLevel ?? 'none'} options={operationLogOptions} onChange={(value) => { void updateAppSettings({ operationLogLevel: value }, tr('settings.diagnostics.logs.saveStatus')); }} />
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.logs.actions.title')} description={tr('settings.diagnostics.logs.actions.description')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={() => setOperationLogs(loadOperationLogs(operationLogRetentionDays(extendedSettings.operationLogRetention)))}>{t('settings.logs.refresh')}</button>
            <button className="ghost-btn small" type="button" onClick={() => exportOperationLogsSettingsData('json')}>{tr('settings.diagnostics.logs.exportJson')}</button>
            <button className="ghost-btn small" type="button" onClick={() => exportOperationLogsSettingsData('ndjson')}>{tr('settings.diagnostics.logs.exportNdjson')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { clearOperationLogs(); setOperationLogs([]); }}>{t('settings.logs.clear')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.logs.filter.title')} description={tr('settings.diagnostics.logs.filter.description')} valueText={`${operationLogFilterLevelOptions.find((item) => item.value === operationLogFilterLevel)?.label ?? tr('settings.diagnostics.logs.filter.allLevels')} · ${filteredOperationLogs.length}/${operationLogs.length}`}>
          <div className="settings-inline-actions">
            <ThemedSelect label={tr('settings.diagnostics.logs.filter.levelLabel')} value={operationLogFilterLevel} options={operationLogFilterLevelOptions} onChange={setOperationLogFilterLevel} />
            <input className="settings-inline-input" value={operationLogFilterQuery} placeholder={tr('settings.diagnostics.logs.filter.placeholder')} aria-label={tr('settings.diagnostics.logs.filter.aria')} onChange={(event) => setOperationLogFilterQuery(event.target.value)} />
            <button className="ghost-btn small" type="button" onClick={() => { setOperationLogFilterLevel('all'); setOperationLogFilterQuery(''); }} disabled={operationLogFilterLevel === 'all' && !operationLogFilterQuery}>{tr('settings.diagnostics.logs.filter.clear')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.operationLogRetention.title')} description={tr('settings.diagnostics.operationLogRetention.description')} valueText={tr('settings.options.retention.days', { days: extendedSettings.operationLogRetention })}>
          <SettingsNumberInput min={0} max={500} value={extendedSettings.operationLogRetention} onCommit={updateOperationLogRetention} />
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.taskLogRetention.title')} description={tr('settings.diagnostics.taskLogRetention.description')} valueText={taskLogRetentionOptions.find((item) => item.value === extendedSettings.taskLogRetention)?.label}>
          <ThemedSelect label={tr('settings.diagnostics.taskLogRetention.title')} value={extendedSettings.taskLogRetention} options={taskLogRetentionOptions} onChange={(value) => { void applyTaskLogRetentionPolicy(value); }} />
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.completedTaskRetention.title')} description={tr('settings.diagnostics.completedTaskRetention.description')} valueText={tr('settings.diagnostics.completedTaskRetention.value', { count: extendedSettings.completedTaskRetentionLimit })}>
          <SettingsNumberInput min={0} max={5000} value={extendedSettings.completedTaskRetentionLimit} onCommit={(value) => { void updateCompletedTaskRetentionLimit(value); }} />
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.application.title')} description={tr('settings.diagnostics.application.description')} valueText={tr('settings.diagnostics.application.value')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={() => { void exportApplicationDiagnosticsFromSettings(); }}>{tr('settings.diagnostics.application.exportApp')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void exportAiDiagnosticsFromSettings(); }}>{tr('settings.diagnostics.application.exportAi')}</button>
            <button className="ghost-btn small" type="button" onClick={exportReaderDiagnosticsFromSettings}>{tr('settings.diagnostics.application.exportReader')}</button>
            <button className="ghost-btn small" type="button" onClick={() => { void exportIndexDiagnosticsFromSettings(); }}>{tr('settings.diagnostics.application.exportIndex')}</button>
            <button className="ghost-btn small" type="button" onClick={copySystemInfoFromSettings}>{tr('settings.diagnostics.application.copySystem')}</button>
            <button className="ghost-btn small" type="button" onClick={copyTauriCommandFailureInfo}>{tr('settings.diagnostics.application.copyTauriFailure')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.redactionPreview.title')} description={tr('settings.diagnostics.redactionPreview.description')} valueText={diagnosticsRedactionPreview ? tr('settings.diagnostics.redactionPreview.generated') : tr('settings.diagnostics.redactionPreview.notGenerated')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={refreshDiagnosticsRedactionPreview}>{tr('settings.diagnostics.redactionPreview.generate')}</button>
            <button className="ghost-btn small" type="button" onClick={() => setDiagnosticsRedactionPreview('')} disabled={!diagnosticsRedactionPreview}>{tr('settings.diagnostics.redactionPreview.close')}</button>
          </div>
          {diagnosticsRedactionPreview ? <pre className="settings-json-preview settings-diagnostics-redaction-preview" aria-label={tr('settings.diagnostics.redactionPreview.aria')}>{diagnosticsRedactionPreview}</pre> : null}
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.taskPackage.title')} description={tr('settings.diagnostics.taskPackage.description')} valueText="JSON">
          <button className="ghost-btn small" type="button" onClick={() => { void exportTaskDiagnosticsFromSettings(); }}>{tr('settings.diagnostics.taskPackage.export')}</button>
        </SettingControl>
        <div className="operation-log-list settings-log-list">
          {filteredOperationLogs.slice(0, 20).map((item, index) => <code key={`${item.at}-${index}`}>{item.at} · {item.level} · {item.action}{item.detail ? ` · ${JSON.stringify(item.detail)}` : ''}</code>)}
          {!operationLogs.length ? <span>{t('settings.logs.empty')}</span> : null}
          {operationLogs.length > 0 && !filteredOperationLogs.length ? <span>{tr('settings.diagnostics.logs.filter.empty')}</span> : null}
        </div>
      </SettingsSection>
      <SettingsSection title={tr('settings.diagnostics.experiments.title')} description={tr('settings.diagnostics.experiments.description')} advanced>
        <SettingControl title={tr('settings.diagnostics.experiments.aiToolCalling.title')} description={tr('settings.diagnostics.experiments.aiToolCalling.description')} valueText={enabledDisabled(extendedSettings.experimentalAiToolCallingEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.experimentalAiToolCallingEnabled} onChange={(event) => updateExtendedSetting('experimentalAiToolCallingEnabled', event.target.checked)} /><span>{experimentToggleText('settings.diagnostics.experiments.aiToolCalling.title', extendedSettings.experimentalAiToolCallingEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.experiments.epubPdf.title')} description={tr('settings.diagnostics.experiments.epubPdf.description')} valueText={enabledDisabled(extendedSettings.experimentalEpubPdfEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.experimentalEpubPdfEnabled} onChange={(event) => updateExtendedSetting('experimentalEpubPdfEnabled', event.target.checked)} /><span>{experimentToggleText('settings.diagnostics.experiments.epubPdf.title', extendedSettings.experimentalEpubPdfEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.experiments.multiWindowConflict.title')} description={tr('settings.diagnostics.experiments.multiWindowConflict.description')} valueText={enabledDisabled(extendedSettings.experimentalMultiWindowConflictResolutionEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.experimentalMultiWindowConflictResolutionEnabled} onChange={(event) => updateExtendedSetting('experimentalMultiWindowConflictResolutionEnabled', event.target.checked)} /><span>{experimentToggleText('settings.diagnostics.experiments.multiWindowConflict.title', extendedSettings.experimentalMultiWindowConflictResolutionEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.experiments.knowledgeGraph.title')} description={tr('settings.diagnostics.experiments.knowledgeGraph.description')} valueText={enabledDisabled(extendedSettings.experimentalKnowledgeGraphEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.experimentalKnowledgeGraphEnabled} onChange={(event) => updateExtendedSetting('experimentalKnowledgeGraphEnabled', event.target.checked)} /><span>{experimentToggleText('settings.diagnostics.experiments.knowledgeGraph.title', extendedSettings.experimentalKnowledgeGraphEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.diagnostics.experiments.sync.title')} description={tr('settings.diagnostics.experiments.sync.description')} valueText={enabledDisabled(extendedSettings.experimentalSyncEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.experimentalSyncEnabled} onChange={(event) => updateExtendedSetting('experimentalSyncEnabled', event.target.checked)} /><span>{experimentToggleText('settings.diagnostics.experiments.sync.title', extendedSettings.experimentalSyncEnabled)}</span></label>
        </SettingControl>
      </SettingsSection>
    </>
  );
}

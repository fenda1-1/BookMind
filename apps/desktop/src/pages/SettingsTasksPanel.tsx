import { ThemedSelect } from './SettingsSelect';
import { SettingControl, SettingsNumberInput, SettingsSection } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsTasksPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    extendedSettings,
    performanceTuningProfile,
    backgroundTaskNotificationModeOptions,
    taskCenterDefaultStatusFilterOptions,
    updateExtendedSetting,
    rebuildDatabaseIndexesSettingsData,
    vacuumDatabaseSettingsData,
  } = props;
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (value: boolean) => tr(value ? 'settings.common.on' : 'settings.common.off');
  const enabledDisabled = (value: boolean) => tr(value ? 'settings.common.enabled' : 'settings.common.disabled');
  const performanceLevel = (kind: 'index' | 'memory', value: string) => tr(`settings.tasks.performance.${kind}.${value}`);
  const ftsMode = extendedSettings.ftsWriteSerial ? 'serial' : 'concurrent';
  const taskSummary = `${performanceLevel('index', performanceTuningProfile.indexThroughputLevel)} / ${performanceLevel('memory', performanceTuningProfile.readerMemoryLevel)}`;

  return (
    <SettingsSection title={tr('settings.tasks.section.title')} description={tr('settings.tasks.section.description')}>
      <SettingControl title={tr('settings.tasks.performance.title')} description={tr('settings.tasks.performance.description')} valueText={taskSummary}>
        <div className="settings-performance-panel" role="group" aria-label={tr('settings.tasks.performance.aria')}>
          <article className="settings-performance-card">
            <strong>{tr('settings.tasks.performance.index.title')}</strong>
            <span>{tr('settings.tasks.performance.index.concurrencyLine', {
              parse: performanceTuningProfile.parseConcurrency,
              importCount: performanceTuningProfile.importConcurrency,
              task: performanceTuningProfile.taskConcurrency,
            })}</span>
            <span>{tr('settings.tasks.performance.index.chunkLine', {
              chunk: performanceTuningProfile.indexChunkSize,
              overlap: performanceTuningProfile.indexChunkOverlap,
              fts: tr(`settings.tasks.ftsWriteSerial.mode.${ftsMode}`),
            })}</span>
            <em>{tr(`settings.tasks.performance.index.advice.${performanceTuningProfile.indexThroughputLevel}`)}</em>
          </article>
          <article className="settings-performance-card">
            <strong>{tr('settings.tasks.performance.memory.title')}</strong>
            <span>{tr('settings.tasks.performance.memory.windowLine', {
              radius: performanceTuningProfile.virtualChapterRadius,
              paragraph: performanceTuningProfile.virtualParagraphWindowSize,
            })}</span>
            <span>{tr('settings.tasks.performance.memory.cacheLine', {
              pageCache: extendedSettings.readerPageCacheEnabled ? tr('settings.tasks.performance.memory.cacheCount', { count: performanceTuningProfile.readerPageCacheLimit }) : tr('settings.tasks.performance.memory.cacheOff'),
              measure: performanceTuningProfile.readerPageMeasureCacheLimit,
              preheat: extendedSettings.readerPagePreheatEnabled ? performanceTuningProfile.readerPagePreheatRange : 0,
            })}</span>
            <em>{tr(`settings.tasks.performance.memory.advice.${performanceTuningProfile.readerMemoryLevel}`)}</em>
          </article>
          <article className="settings-performance-card">
            <strong>{tr('settings.tasks.performance.largeBook.title')}</strong>
            <span>{tr(`settings.tasks.performance.largeBook.advice.${performanceTuningProfile.largeBookAdvice}`)}</span>
            <label className="settings-toggle">
              <input type="checkbox" checked={extendedSettings.largeBookPerformanceMode} onChange={(event) => updateExtendedSetting('largeBookPerformanceMode', event.target.checked)} />
              <span>{tr(extendedSettings.largeBookPerformanceMode ? 'settings.tasks.performance.largeBook.enabled' : 'settings.tasks.performance.largeBook.enable')}</span>
            </label>
          </article>
          <article className="settings-performance-card">
            <strong>{tr('settings.tasks.performance.database.title')}</strong>
            <span>{tr('settings.tasks.performance.database.description')}</span>
            <div className="settings-inline-actions">
              <button className="ghost-btn small" type="button" onClick={() => { void rebuildDatabaseIndexesSettingsData(); }}>{tr('settings.tasks.performance.database.rebuild')}</button>
              <button className="ghost-btn small" type="button" onClick={() => { void vacuumDatabaseSettingsData(); }}>{tr('settings.tasks.performance.database.vacuum')}</button>
            </div>
          </article>
        </div>
      </SettingControl>
      <SettingControl title={t('settings.concurrency.title')} description={tr('settings.tasks.taskConcurrency.description')} valueText={extendedSettings.taskConcurrency}>
        <SettingsNumberInput min={1} max={8} value={extendedSettings.taskConcurrency} onCommit={(value) => updateExtendedSetting('taskConcurrency', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.importConcurrency.title')} description={tr('settings.tasks.importConcurrency.description')} valueText={extendedSettings.importConcurrency}>
        <SettingsNumberInput min={1} max={8} value={extendedSettings.importConcurrency} onCommit={(value) => updateExtendedSetting('importConcurrency', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.parseConcurrency.title')} description={tr('settings.tasks.parseConcurrency.description')} valueText={extendedSettings.parseConcurrency}>
        <SettingsNumberInput min={1} max={8} value={extendedSettings.parseConcurrency} onCommit={(value) => updateExtendedSetting('parseConcurrency', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.ftsWriteSerial.title')} description={tr('settings.tasks.ftsWriteSerial.description')} valueText={tr(`settings.tasks.ftsWriteSerial.mode.${ftsMode}`)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.ftsWriteSerial} onChange={(event) => updateExtendedSetting('ftsWriteSerial', event.target.checked)} /><span>{tr(`settings.tasks.ftsWriteSerial.toggle.${ftsMode}`)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.tasks.taskRetryCount.title')} description={tr('settings.tasks.taskRetryCount.description')} valueText={extendedSettings.taskRetryCount}>
        <SettingsNumberInput min={0} max={5} value={extendedSettings.taskRetryCount} onCommit={(value) => updateExtendedSetting('taskRetryCount', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.checkUnfinishedTasks.title')} description={tr('settings.tasks.checkUnfinishedTasks.description')} valueText={onOff(extendedSettings.checkUnfinishedTasksOnStartup)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.checkUnfinishedTasksOnStartup} onChange={(event) => updateExtendedSetting('checkUnfinishedTasksOnStartup', event.target.checked)} /><span>{enabledDisabled(extendedSettings.checkUnfinishedTasksOnStartup)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.tasks.backgroundNotification.title')} description={tr('settings.tasks.backgroundNotification.description')} valueText={backgroundTaskNotificationModeOptions.find((item) => item.value === extendedSettings.backgroundTaskNotificationMode)?.label}>
        <ThemedSelect label={tr('settings.tasks.backgroundNotification.title')} value={extendedSettings.backgroundTaskNotificationMode} options={backgroundTaskNotificationModeOptions} onChange={(value) => updateExtendedSetting('backgroundTaskNotificationMode', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.refreshLibraryOnTaskCompletion.title')} description={tr('settings.tasks.refreshLibraryOnTaskCompletion.description')} valueText={onOff(extendedSettings.refreshLibraryOnTaskCompletion)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.refreshLibraryOnTaskCompletion} onChange={(event) => updateExtendedSetting('refreshLibraryOnTaskCompletion', event.target.checked)} /><span>{enabledDisabled(extendedSettings.refreshLibraryOnTaskCompletion)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.tasks.taskAutoRunQueuedWhenIdle.title')} description={tr('settings.tasks.taskAutoRunQueuedWhenIdle.description')} valueText={onOff(extendedSettings.taskAutoRunQueuedWhenIdle)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.taskAutoRunQueuedWhenIdle} onChange={(event) => updateExtendedSetting('taskAutoRunQueuedWhenIdle', event.target.checked)} /><span>{enabledDisabled(extendedSettings.taskAutoRunQueuedWhenIdle)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.tasks.defaultStatusFilter.title')} description={tr('settings.tasks.defaultStatusFilter.description')} valueText={taskCenterDefaultStatusFilterOptions.find((item) => item.value === extendedSettings.taskCenterDefaultStatusFilter)?.label}>
        <ThemedSelect label={tr('settings.tasks.defaultStatusFilter.title')} value={extendedSettings.taskCenterDefaultStatusFilter} options={taskCenterDefaultStatusFilterOptions} onChange={(value) => updateExtendedSetting('taskCenterDefaultStatusFilter', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.autoShowTaskCenter.title')} description={tr('settings.tasks.autoShowTaskCenter.description')} valueText={onOff(extendedSettings.autoShowTaskCenterForLongOperations)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoShowTaskCenterForLongOperations} onChange={(event) => updateExtendedSetting('autoShowTaskCenterForLongOperations', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoShowTaskCenterForLongOperations)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.tasks.errorDetailsExpanded.title')} description={tr('settings.tasks.errorDetailsExpanded.description')} valueText={tr(extendedSettings.errorDetailsDefaultExpanded ? 'settings.tasks.errorDetailsExpanded.expanded' : 'settings.tasks.errorDetailsExpanded.collapsed')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.errorDetailsDefaultExpanded} onChange={(event) => updateExtendedSetting('errorDetailsDefaultExpanded', event.target.checked)} /><span>{tr(extendedSettings.errorDetailsDefaultExpanded ? 'settings.tasks.errorDetailsExpanded.expanded' : 'settings.tasks.errorDetailsExpanded.collapsed')}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.tasks.virtualChapterRadius.title')} description={tr('settings.tasks.virtualChapterRadius.description')} valueText={extendedSettings.virtualChapterRadius}>
        <SettingsNumberInput min={0} max={10} value={extendedSettings.virtualChapterRadius} onCommit={(value) => updateExtendedSetting('virtualChapterRadius', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.tasks.virtualParagraphWindowSize.title')} description={tr('settings.tasks.virtualParagraphWindowSize.description')} valueText={tr('settings.tasks.virtualParagraphWindowSize.value', { value: extendedSettings.virtualParagraphWindowSize })}>
        <SettingsNumberInput min={20} max={240} step={10} value={extendedSettings.virtualParagraphWindowSize} onCommit={(value) => updateExtendedSetting('virtualParagraphWindowSize', value)} />
      </SettingControl>
    </SettingsSection>
  );
}

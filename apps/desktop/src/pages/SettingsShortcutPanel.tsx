import { ThemedSelect } from './SettingsSelect';
import { ReadonlyPill, SettingControl, SettingsNumberInput, SettingsSection } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsShortcutPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    extendedSettings,
    shortcutConflictMessages,
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
    updateExtendedSetting,
    updateGlobalShortcutSetting,
    updateNavigationShortcut,
    updateReaderShortcut,
    restoreGlobalShortcutsDefaults,
  } = props;
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (value: boolean) => tr(value ? 'settings.common.on' : 'settings.common.off');
  const enabledDisabled = (value: boolean) => tr(value ? 'settings.common.enabled' : 'settings.common.disabled');
  const shownHidden = (value: boolean) => tr(value ? 'settings.shortcuts.state.shown' : 'settings.shortcuts.state.hidden');

  return (
    <SettingsSection title={tr('settings.shortcuts.section.title')} description={tr('settings.shortcuts.section.description')}>
      <SettingControl title={tr('settings.shortcuts.globalShortcutsEnabled.title')} description={tr('settings.shortcuts.globalShortcutsEnabled.description')} valueText={enabledDisabled(extendedSettings.globalShortcutsEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.globalShortcutsEnabled} onChange={(event) => updateExtendedSetting('globalShortcutsEnabled', event.target.checked)} /><span>{tr(extendedSettings.globalShortcutsEnabled ? 'settings.shortcuts.globalShortcutsEnabled.enabled' : 'settings.shortcuts.globalShortcutsEnabled.disabled')}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.commandPaletteIncludesSettings.title')} description={tr('settings.shortcuts.commandPaletteIncludesSettings.description')} valueText={tr(extendedSettings.commandPaletteIncludesSettings ? 'settings.shortcuts.commandPaletteIncludesSettings.included' : 'settings.shortcuts.commandPaletteIncludesSettings.excluded')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.commandPaletteIncludesSettings} onChange={(event) => updateExtendedSetting('commandPaletteIncludesSettings', event.target.checked)} /><span>{tr(extendedSettings.commandPaletteIncludesSettings ? 'settings.shortcuts.commandPaletteIncludesSettings.include' : 'settings.shortcuts.commandPaletteIncludesSettings.exclude')}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.commandPaletteShortcut.title')} description={tr('settings.shortcuts.commandPaletteShortcut.description')} valueText={commandPaletteShortcutOptions.find((item) => item.value === extendedSettings.commandPaletteShortcut)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.commandPaletteShortcut.title')} value={extendedSettings.commandPaletteShortcut} options={commandPaletteShortcutOptions} onChange={(value) => updateGlobalShortcutSetting('commandPaletteShortcut', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.commandPaletteShowDescriptions.title')} description={tr('settings.shortcuts.commandPaletteShowDescriptions.description')} valueText={shownHidden(extendedSettings.commandPaletteShowDescriptions)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.commandPaletteShowDescriptions} onChange={(event) => updateExtendedSetting('commandPaletteShowDescriptions', event.target.checked)} /><span>{tr(extendedSettings.commandPaletteShowDescriptions ? 'settings.shortcuts.commandPaletteShowDescriptions.show' : 'settings.shortcuts.commandPaletteShowDescriptions.hide')}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.commandPaletteSortMode.title')} description={tr('settings.shortcuts.commandPaletteSortMode.description')} valueText={commandPaletteSortModeOptions.find((item) => item.value === extendedSettings.commandPaletteSortMode)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.commandPaletteSortMode.label')} value={extendedSettings.commandPaletteSortMode} options={commandPaletteSortModeOptions} onChange={(value) => updateExtendedSetting('commandPaletteSortMode', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.navigation.reader.title')} description={tr('settings.shortcuts.navigation.reader.description')} valueText={readerNavigationShortcutOptions.find((item) => item.value === extendedSettings.navigationShortcuts.reader)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.navigation.reader.label')} value={extendedSettings.navigationShortcuts.reader} options={readerNavigationShortcutOptions} onChange={(value) => updateNavigationShortcut('reader', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.navigation.library.title')} description={tr('settings.shortcuts.navigation.library.description')} valueText={libraryNavigationShortcutOptions.find((item) => item.value === extendedSettings.navigationShortcuts.library)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.navigation.library.label')} value={extendedSettings.navigationShortcuts.library} options={libraryNavigationShortcutOptions} onChange={(value) => updateNavigationShortcut('library', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.navigation.search.title')} description={tr('settings.shortcuts.navigation.search.description')} valueText={searchNavigationShortcutOptions.find((item) => item.value === extendedSettings.navigationShortcuts.search)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.navigation.search.label')} value={extendedSettings.navigationShortcuts.search} options={searchNavigationShortcutOptions} onChange={(value) => updateNavigationShortcut('search', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.importShortcut.title')} description={tr('settings.shortcuts.importShortcut.description')} valueText={importShortcutOptions.find((item) => item.value === extendedSettings.importShortcut)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.importShortcut.title')} value={extendedSettings.importShortcut} options={importShortcutOptions} onChange={(value) => updateGlobalShortcutSetting('importShortcut', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.aiSummaryShortcut.title')} description={tr('settings.shortcuts.aiSummaryShortcut.description')} valueText={aiSummaryShortcutOptions.find((item) => item.value === extendedSettings.aiSummaryShortcut)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.aiSummaryShortcut.title')} value={extendedSettings.aiSummaryShortcut} options={aiSummaryShortcutOptions} onChange={(value) => updateGlobalShortcutSetting('aiSummaryShortcut', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.conflicts.title')} description={tr('settings.shortcuts.conflicts.description')} valueText={shortcutConflictMessages.length ? tr('settings.shortcuts.conflicts.count', { count: shortcutConflictMessages.length }) : tr('settings.shortcuts.conflicts.none')}>
        <div className="settings-readonly-list">
          {shortcutConflictMessages.length ? shortcutConflictMessages.map((message) => <span key={message}>{message}</span>) : <ReadonlyPill text={tr('settings.shortcuts.conflicts.none')} />}
        </div>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.restore.title')} description={tr('settings.shortcuts.restore.description')}>
        <button className="ghost-btn small" type="button" onClick={restoreGlobalShortcutsDefaults}>{tr('settings.shortcuts.restore.action')}</button>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.contextMenuEnabled.title')} description={tr('settings.shortcuts.contextMenuEnabled.description')} valueText={onOff(extendedSettings.contextMenuEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.contextMenuEnabled} onChange={(event) => updateExtendedSetting('contextMenuEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.contextMenuEnabled)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.arrowKeyPaging.title')} description={tr('settings.shortcuts.arrowKeyPaging.description')} valueText={onOff(extendedSettings.arrowKeyPaging)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.arrowKeyPaging} onChange={(event) => updateExtendedSetting('arrowKeyPaging', event.target.checked)} /><span>{enabledDisabled(extendedSettings.arrowKeyPaging)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.spaceKeyPaging.title')} description={tr('settings.shortcuts.spaceKeyPaging.description')} valueText={onOff(extendedSettings.spaceKeyPaging)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.spaceKeyPaging} onChange={(event) => updateExtendedSetting('spaceKeyPaging', event.target.checked)} /><span>{enabledDisabled(extendedSettings.spaceKeyPaging)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.escapeClosesPanels.title')} description={tr('settings.shortcuts.escapeClosesPanels.description')} valueText={onOff(extendedSettings.escapeClosesPanels)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.escapeClosesPanels} onChange={(event) => updateExtendedSetting('escapeClosesPanels', event.target.checked)} /><span>{enabledDisabled(extendedSettings.escapeClosesPanels)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.homeEndJump.title')} description={tr('settings.shortcuts.homeEndJump.description')} valueText={onOff(extendedSettings.homeEndJump)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.homeEndJump} onChange={(event) => updateExtendedSetting('homeEndJump', event.target.checked)} /><span>{enabledDisabled(extendedSettings.homeEndJump)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.vimStyleNavigation.title')} description={tr('settings.shortcuts.vimStyleNavigation.description')} valueText={onOff(extendedSettings.vimStyleNavigation)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.vimStyleNavigation} onChange={(event) => updateExtendedSetting('vimStyleNavigation', event.target.checked)} /><span>{enabledDisabled(extendedSettings.vimStyleNavigation)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.doubleClickWordSelection.title')} description={tr('settings.shortcuts.doubleClickWordSelection.description')} valueText={onOff(extendedSettings.doubleClickWordSelectionEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.doubleClickWordSelectionEnabled} onChange={(event) => updateExtendedSetting('doubleClickWordSelectionEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.doubleClickWordSelectionEnabled)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.pageClickPaging.title')} description={tr('settings.shortcuts.pageClickPaging.description')} valueText={onOff(extendedSettings.pageClickPaging)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.pageClickPaging} onChange={(event) => updateExtendedSetting('pageClickPaging', event.target.checked)} /><span>{enabledDisabled(extendedSettings.pageClickPaging)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.gesturePaging.title')} description={tr('settings.shortcuts.gesturePaging.description')} valueText={onOff(extendedSettings.gesturePagingEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.gesturePagingEnabled} onChange={(event) => updateExtendedSetting('gesturePagingEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.gesturePagingEnabled)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.gesturePagingThreshold.title')} description={tr('settings.shortcuts.gesturePagingThreshold.description')} valueText={`${extendedSettings.gesturePagingThresholdPx}px`}>
        <SettingsNumberInput min={40} max={240} step={8} value={extendedSettings.gesturePagingThresholdPx} onCommit={(value) => updateExtendedSetting('gesturePagingThresholdPx', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.autoHideCursor.title')} description={tr('settings.shortcuts.autoHideCursor.description')} valueText={onOff(extendedSettings.autoHideCursor)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoHideCursor} onChange={(event) => updateExtendedSetting('autoHideCursor', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoHideCursor)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.pageTurnSound.title')} description={tr('settings.shortcuts.pageTurnSound.description')} valueText={onOff(extendedSettings.pageTurnSound)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.pageTurnSound} onChange={(event) => updateExtendedSetting('pageTurnSound', event.target.checked)} /><span>{enabledDisabled(extendedSettings.pageTurnSound)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.wheelPagingThreshold.title')} description={tr('settings.shortcuts.wheelPagingThreshold.description')} valueText={`${extendedSettings.wheelPagingThresholdPx}px`}>
        <SettingsNumberInput min={20} max={240} step={10} value={extendedSettings.wheelPagingThresholdPx} onCommit={(value) => updateExtendedSetting('wheelPagingThresholdPx', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.reader.highlight.title')} description={tr('settings.shortcuts.reader.highlight.description')} valueText={readerHighlightShortcutOptions.find((item) => item.value === extendedSettings.readerShortcuts.highlight)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.reader.highlight.label')} value={extendedSettings.readerShortcuts.highlight} options={readerHighlightShortcutOptions} onChange={(value) => updateReaderShortcut('highlight', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.reader.bookmark.title')} description={tr('settings.shortcuts.reader.bookmark.description')} valueText={readerBookmarkShortcutOptions.find((item) => item.value === extendedSettings.readerShortcuts.bookmark)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.reader.bookmark.label')} value={extendedSettings.readerShortcuts.bookmark} options={readerBookmarkShortcutOptions} onChange={(value) => updateReaderShortcut('bookmark', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.reader.aiPanel.title')} description={tr('settings.shortcuts.reader.aiPanel.description')} valueText={readerAiPanelShortcutOptions.find((item) => item.value === extendedSettings.readerShortcuts.aiPanel)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.reader.aiPanel.label')} value={extendedSettings.readerShortcuts.aiPanel} options={readerAiPanelShortcutOptions} onChange={(value) => updateReaderShortcut('aiPanel', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.reader.search.title')} description={tr('settings.shortcuts.reader.search.description')} valueText={readerSearchShortcutOptions.find((item) => item.value === extendedSettings.readerShortcuts.search)?.label}>
        <ThemedSelect label={tr('settings.shortcuts.reader.search.label')} value={extendedSettings.readerShortcuts.search} options={readerSearchShortcutOptions} onChange={(value) => updateReaderShortcut('search', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.shortcuts.fixedCommand.title')} description={tr('settings.shortcuts.fixedCommand.description')}>
        <ReadonlyPill text={tr('settings.shortcuts.fixedCommand.value')} />
      </SettingControl>
    </SettingsSection>
  );
}

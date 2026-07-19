import { ThemedSelect } from './SettingsSelect';
import { defaultExtendedSettings, type ExtendedSettings } from '../services/settingsCenterService';
import type { Translator } from '../i18n';
import type { AppPage, ReaderSettings, ReaderTheme } from '../types';
import { SettingControl, SettingsSection } from './SettingsPageScaffold';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type SettingsAppearancePanelProps = {
  t: Translator;
  readerGlobalSettings: ReaderSettings;
  readerThemeOptions: SelectOption<ReaderTheme>[];
  updateReaderGlobalSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  extendedSettings: ExtendedSettings;
  appThemeOptions: SelectOption<ExtendedSettings['appTheme']>[];
  pageTitleModeOptions: SelectOption<ExtendedSettings['pageTitleMode']>[];
  topbarButtonOptions: Array<{ value: keyof ExtendedSettings['topbarButtonVisibility']; label: string }>;
  navItemOptions: Array<{ value: AppPage; label: string }>;
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
  updateTopbarButtonVisibility: (button: keyof ExtendedSettings['topbarButtonVisibility'], visible: boolean) => void;
  updateVisibleNavItem: (page: AppPage, visible: boolean) => void;
  moveVisibleNavItem: (page: AppPage, direction: -1 | 1) => void;
  restoreDefaultNavOrder: () => void;
  searchText?: string;
};

export function SettingsAppearancePanel({
  t,
  readerGlobalSettings,
  readerThemeOptions,
  updateReaderGlobalSetting,
  extendedSettings,
  appThemeOptions,
  pageTitleModeOptions,
  topbarButtonOptions,
  navItemOptions,
  updateExtendedSetting,
  updateTopbarButtonVisibility,
  updateVisibleNavItem,
  moveVisibleNavItem,
  restoreDefaultNavOrder,
}: SettingsAppearancePanelProps) {
  const tr = (key: string) => t(key as never);
  const onOff = (enabled: boolean) => enabled ? tr('settings.common.on') : tr('settings.common.off');
  const expandedCollapsed = (collapsed: boolean) => collapsed ? tr('settings.appearance.sidebar.collapsed') : tr('settings.appearance.sidebar.expanded');
  return (
    <>
      <SettingsSection title={tr('settings.appearance.theme.title')} description={tr('settings.appearance.theme.description')}>
        <SettingControl title={t('reader.settings.theme')} description={tr('settings.appearance.readerTheme.description')} valueText={readerGlobalSettings.theme}>
          <ThemedSelect label={t('reader.settings.theme')} value={readerGlobalSettings.theme} options={readerThemeOptions} onChange={(value) => updateReaderGlobalSetting('theme', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.appearance.appTheme.title')} description={tr('settings.appearance.appTheme.description')} valueText={extendedSettings.appTheme}>
          <ThemedSelect label={tr('settings.appearance.appTheme.label')} value={extendedSettings.appTheme} options={appThemeOptions} onChange={(value) => updateExtendedSetting('appTheme', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.appearance.customThemeColor.title')} description={tr('settings.appearance.customThemeColor.description')} valueText={extendedSettings.customThemeColor}>
          <div className="settings-color-row">
            <input className="settings-color-input" type="color" value={extendedSettings.customThemeColor} onChange={(event) => updateExtendedSetting('customThemeColor', event.target.value)} />
            <input className="settings-inline-input" value={extendedSettings.customThemeColor} onChange={(event) => updateExtendedSetting('customThemeColor', event.target.value)} />
            <button className="ghost-btn small" type="button" onClick={() => updateExtendedSetting('customThemeColor', defaultExtendedSettings.customThemeColor)}>{tr('settings.common.restoreDefault')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.appearance.readerThemeFollowsApp.title')} description={tr('settings.appearance.readerThemeFollowsApp.description')} valueText={onOff(extendedSettings.readerThemeFollowsApp)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerThemeFollowsApp} onChange={(event) => updateExtendedSetting('readerThemeFollowsApp', event.target.checked)} /><span>{extendedSettings.readerThemeFollowsApp ? tr('settings.common.enabled') : tr('settings.common.disabled')}</span></label>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.appearance.navigation.title')} description={tr('settings.appearance.navigation.description')}>
        <SettingControl title={tr('settings.appearance.sidebar.title')} description={tr('settings.appearance.sidebar.description')} valueText={expandedCollapsed(extendedSettings.sidebarCollapsed)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.sidebarCollapsed} onChange={(event) => updateExtendedSetting('sidebarCollapsed', event.target.checked)} /><span>{extendedSettings.sidebarCollapsed ? tr('settings.appearance.sidebar.defaultCollapsed') : tr('settings.appearance.sidebar.defaultExpanded')}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.appearance.libraryPanelPersistent.title')} description={tr('settings.appearance.libraryPanelPersistent.description')} valueText={extendedSettings.libraryPanelPersistent ? tr('settings.appearance.libraryPanelPersistent.persistent') : tr('settings.appearance.libraryPanelPersistent.readerHidden')}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.libraryPanelPersistent} onChange={(event) => updateExtendedSetting('libraryPanelPersistent', event.target.checked)} /><span>{extendedSettings.libraryPanelPersistent ? tr('settings.appearance.libraryPanelPersistent.readerPersistent') : tr('settings.appearance.libraryPanelPersistent.readerHidden')}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.appearance.pageTitleMode.title')} description={tr('settings.appearance.pageTitleMode.description')} valueText={extendedSettings.pageTitleMode}>
          <ThemedSelect label={tr('settings.appearance.pageTitleMode.title')} value={extendedSettings.pageTitleMode} options={pageTitleModeOptions} onChange={(value) => updateExtendedSetting('pageTitleMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.appearance.topbarButtons.title')} description={tr('settings.appearance.topbarButtons.description')} valueText={`${Object.values(extendedSettings.topbarButtonVisibility).filter(Boolean).length}/${topbarButtonOptions.length}`}>
          <div className="settings-check-grid">
            {topbarButtonOptions.map((item) => (
              <label className="settings-toggle" key={item.value}>
                <input
                  type="checkbox"
                  checked={extendedSettings.topbarButtonVisibility[item.value]}
                  onChange={(event) => updateTopbarButtonVisibility(item.value, event.target.checked)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.appearance.navItems.title')} description={tr('settings.appearance.navItems.description')} valueText={`${extendedSettings.visibleNavItems.length}/${navItemOptions.length}`}>
          <div className="settings-check-grid">
            {extendedSettings.visibleNavItems.map((page) => navItemOptions.find((item) => item.value === page)).filter((item): item is { value: AppPage; label: string } => Boolean(item)).map((item, index) => (
              <label className="settings-toggle" key={item.value}>
                <input
                  type="checkbox"
                  checked={extendedSettings.visibleNavItems.includes(item.value)}
                  disabled={item.value === 'settings'}
                  onChange={(event) => updateVisibleNavItem(item.value, event.target.checked)}
                />
                <span>{item.label}</span>
                <button className="ghost-btn small" type="button" onClick={(event) => { event.preventDefault(); moveVisibleNavItem(item.value, -1); }} disabled={index === 0}>{tr('settings.common.moveUp')}</button>
                <button className="ghost-btn small" type="button" onClick={(event) => { event.preventDefault(); moveVisibleNavItem(item.value, 1); }} disabled={index === extendedSettings.visibleNavItems.length - 1}>{tr('settings.common.moveDown')}</button>
              </label>
            ))}
            {navItemOptions.filter((item) => !extendedSettings.visibleNavItems.includes(item.value)).map((item) => (
              <label className="settings-toggle" key={item.value}>
                <input type="checkbox" checked={false} disabled={item.value === 'settings'} onChange={(event) => updateVisibleNavItem(item.value, event.target.checked)} />
                <span>{item.label}</span>
              </label>
            ))}
            <button className="ghost-btn small" type="button" onClick={restoreDefaultNavOrder}>{tr('settings.appearance.navItems.restoreOrder')}</button>
          </div>
        </SettingControl>
      </SettingsSection>
    </>
  );
}

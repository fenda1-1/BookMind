import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n, type TranslationKey, type Translator } from '../../i18n';
import { SettingControl, SettingsNumberInput, SettingsSection } from '../../pages/SettingsPageScaffold';
import type { MoyuReaderPreset, MoyuReaderProfile, MoyuReaderShortcut, MoyuReaderShortcutAction, MoyuReaderTextColorMode, MoyuReaderToolbarRevealMode, MoyuReaderWindowPreset } from './moyuReaderSettingsModel';
import { applyMoyuReaderPreset, createMoyuShortcutFromKeyboardEvent, defaultMoyuReaderProfile, deleteMoyuReaderCustomPreset, exportMoyuReaderPresets, formatMoyuShortcut, importMoyuReaderPresets, loadMoyuPresetAutoApplyState, loadMoyuReaderCustomPresets, patchMoyuReaderProfile, recordMoyuRecentTextColor, rememberMoyuPresetAutoApplyUsage, resolveMoyuPresetAutoApplyPreset, saveMoyuPresetAutoApplyState, replaceMoyuReaderCustomPreset, saveMoyuReaderCustomPreset } from './moyuReaderSettingsModel';
import { subscribeMoyuReaderPresetsUpdated, subscribeMoyuSettingsOpenTab } from './readerDomainEvents';

type MoyuSettingsTab = 'appearance' | 'window' | 'interaction' | 'shortcuts' | 'preset';
type MoyuSettingsScope = 'current-window' | 'global';

type MoyuReaderSettingsPanelProps = {
  profile: MoyuReaderProfile;
  onChange: (profile: MoyuReaderProfile) => void;
};

const tabs: Array<{ id: MoyuSettingsTab; labelKey: TranslationKey }> = [
  { id: 'appearance', labelKey: 'settings.moyu.tabs.appearance' },
  { id: 'window', labelKey: 'settings.moyu.tabs.window' },
  { id: 'interaction', labelKey: 'settings.moyu.tabs.interaction' },
  { id: 'shortcuts', labelKey: 'settings.moyu.tabs.shortcuts' },
  { id: 'preset', labelKey: 'settings.moyu.tabs.preset' },
];

const shortcutLabels: Array<[MoyuReaderShortcutAction, TranslationKey]> = [
  ['exit', 'settings.moyu.shortcut.exit'],
  ['previousPage', 'settings.moyu.shortcut.previousPage'],
  ['nextPage', 'settings.moyu.shortcut.nextPage'],
  ['toggleAutoScroll', 'settings.moyu.shortcut.toggleAutoScroll'],
  ['toggleToolbars', 'settings.moyu.shortcut.toggleToolbars'],
  ['decreaseBackgroundOpacity', 'settings.moyu.shortcut.decreaseBackgroundOpacity'],
  ['increaseBackgroundOpacity', 'settings.moyu.shortcut.increaseBackgroundOpacity'],
  ['decreaseTextScale', 'settings.moyu.shortcut.decreaseTextScale'],
  ['increaseTextScale', 'settings.moyu.shortcut.increaseTextScale'],
  ['toggleLock', 'settings.moyu.shortcut.toggleLock'],
];

const fontOptions = [
  { value: 'Georgia, "LXGW WenKai", "Source Han Serif SC", serif', labelKey: 'settings.moyu.font.serifFirst' },
  { value: '"LXGW WenKai", "Source Han Serif SC", serif', labelKey: 'settings.moyu.font.lxgw' },
  { value: '"Source Han Serif SC", "Noto Serif SC", serif', labelKey: 'settings.moyu.font.sourceHanSerif' },
  { value: '"Noto Serif SC", serif', labelKey: 'settings.moyu.font.notoSerif' },
  { value: '"Microsoft YaHei", "PingFang SC", sans-serif', labelKey: 'settings.moyu.font.modernSans' },
  { value: 'system-ui, sans-serif', labelKey: 'settings.moyu.font.system' },
] as const;

const colorOptions = [
  { value: 'currentColor', labelKey: 'settings.moyu.color.default' },
  { value: '#111827', labelKey: 'settings.moyu.color.ink' },
  { value: '#3b3025', labelKey: 'settings.moyu.color.brown' },
  { value: '#f6f1e8', labelKey: 'settings.moyu.color.rice' },
  { value: '#d9f99d', labelKey: 'settings.moyu.color.green' },
] as const;

const textColorModeOptions: Array<{ value: MoyuReaderTextColorMode; labelKey: TranslationKey }> = [
  { value: 'preset', labelKey: 'settings.moyu.textColorMode.preset' },
  { value: 'custom', labelKey: 'settings.moyu.textColorMode.custom' },
];

const windowPresetOptions: Array<{ value: MoyuReaderWindowPreset; labelKey: TranslationKey }> = [
  { value: 'bottom-right', labelKey: 'settings.moyu.windowPreset.bottomRight' },
  { value: 'bottom-center', labelKey: 'settings.moyu.windowPreset.bottomCenter' },
  { value: 'right-rail', labelKey: 'settings.moyu.windowPreset.rightRail' },
  { value: 'custom', labelKey: 'settings.moyu.windowPreset.custom' },
];

const toolbarRevealOptions: Array<{ value: MoyuReaderToolbarRevealMode; labelKey: TranslationKey }> = [
  { value: 'hover', labelKey: 'settings.moyu.toolbarReveal.hover' },
  { value: 'context-menu', labelKey: 'settings.moyu.toolbarReveal.contextMenu' },
  { value: 'shortcut', labelKey: 'settings.moyu.toolbarReveal.shortcut' },
];

const autoApplyOptions = [
  { value: 'off', labelKey: 'settings.moyu.autoApply.off' },
  { value: 'last-used', labelKey: 'settings.moyu.autoApply.lastUsed' },
  { value: 'current-book', labelKey: 'settings.moyu.autoApply.currentBook' },
] as const;

export function MoyuReaderSettingsPanel({ profile, onChange }: MoyuReaderSettingsPanelProps) {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<MoyuSettingsTab>('appearance');
  const [recordingShortcut, setRecordingShortcut] = useState<MoyuReaderShortcutAction | null>(null);
  const [scope, setScope] = useState<MoyuSettingsScope>('global');
  const [draftProfile, setDraftProfile] = useState(profile);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<MoyuReaderPreset[]>(() => loadMoyuReaderCustomPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [autoApplyState, setAutoApplyState] = useState(() => loadMoyuPresetAutoApplyState());
  const [importText, setImportText] = useState('');
  const [presetDiffId, setPresetDiffId] = useState<string | null>(null);

  useEffect(() => {
    if (scope === 'global') setDraftProfile(profile);
  }, [profile, scope]);

  useEffect(() => {
    if (scope === 'current-window') setDraftProfile(profile);
  }, [scope]);

  useEffect(() => {
    function refreshPresets() {
      setPresets(loadMoyuReaderCustomPresets());
      setAutoApplyState(loadMoyuPresetAutoApplyState());
    }
    return subscribeMoyuReaderPresetsUpdated(refreshPresets);
  }, []);

  useEffect(() => {
    function openPresetTab(detail: { tab: 'preset' }) {
      if (detail?.tab === 'preset') setTab('preset');
    }
    return subscribeMoyuSettingsOpenTab(openPresetTab);
  }, []);

  const effectiveProfile = scope === 'current-window' ? draftProfile : profile;
  const patch = (next: Partial<MoyuReaderProfile>) => {
    const updated = patchMoyuReaderProfile(effectiveProfile, next);
    if (scope === 'global') onChange(updated);
    else setDraftProfile(updated);
  };
  const localizedTabs = tabs.map((item) => ({ id: item.id, label: t(item.labelKey) }));
  const localizedFontOptions = fontOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const localizedColorOptions = colorOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const localizedTextColorModeOptions = textColorModeOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const localizedWindowPresetOptions = windowPresetOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const localizedToolbarRevealOptions = toolbarRevealOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const localizedAutoApplyOptions = autoApplyOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const localizedShortcutLabels = shortcutLabels.map(([key, labelKey]) => [key, t(labelKey)] as const);
  const activeTabLabel = localizedTabs.find((item) => item.id === tab)?.label ?? t('settings.moyu.tabs.appearance');
  const shortcutConflicts = getLocalizedMoyuShortcutConflictMessages(effectiveProfile.shortcuts, t);
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;
  const presetDiff = presetDiffId ? presets.find((preset) => preset.id === presetDiffId) ?? null : null;
  const autoApplyPreset = resolveMoyuPresetAutoApplyPreset(presets, autoApplyState);
  const currentColor = effectiveProfile.textColorMode === 'custom' ? effectiveProfile.customTextColor : effectiveProfile.textColor;
  const previewStyle = {
    backgroundColor: `color-mix(in srgb, ${currentColor} ${Math.round(effectiveProfile.backgroundOpacity * 100)}%, transparent)`,
    color: currentColor,
    fontFamily: effectiveProfile.fontFamily,
  };
  const presetFillStyle = {
    backgroundColor: 'color-mix(in srgb, var(--paper-0) 88%, var(--paper-1))',
    color: 'var(--ink-1)',
  };

  function slider(title: string, value: number, min: number, max: number, step: number, onValue: (value: number) => void, suffix = '') {
    return (
      <label className="reader-slider settings-slider">
        <span>{title}<b>{value}{suffix}</b></span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onValue(Number(event.currentTarget.value))} />
      </label>
    );
  }

  function toggle(title: string, checked: boolean, onChecked: (checked: boolean) => void, onText = checked ? t('settings.common.enabled') : t('settings.common.disabled')) {
    return (
      <label className="settings-toggle">
        <span className="sr-only">{title}</span>
        <input type="checkbox" checked={checked} onChange={(event) => onChecked(event.currentTarget.checked)} />
        <span>{onText}</span>
      </label>
    );
  }

  function updateShortcut(key: MoyuReaderShortcutAction, shortcut: MoyuReaderShortcut) {
    patch({ shortcuts: { ...effectiveProfile.shortcuts, [key]: shortcut } });
  }

  function savePreset() {
    const nextPresets = saveMoyuReaderCustomPreset(presetName || t('settings.moyu.preset.defaultName', { date: new Date().toLocaleString(locale) }), effectiveProfile);
    setPresets(nextPresets);
    setSelectedPresetId(nextPresets[0]?.id ?? null);
    setPresetName('');
  }

  function applyPreset(preset: MoyuReaderPreset) {
    const nextProfile = applyMoyuReaderPreset(preset);
    if (scope === 'global') onChange(nextProfile);
    else setDraftProfile(nextProfile);
  }

  function replaceSelectedPreset() {
    if (!selectedPresetId) return;
    const nextPresets = replaceMoyuReaderCustomPreset(selectedPresetId, presetName || presets.find((preset) => preset.id === selectedPresetId)?.name || '', effectiveProfile);
    setPresets(nextPresets);
    setPresetName('');
  }

  function deleteSelectedPreset() {
    if (!selectedPresetId) return;
    const nextPresets = deleteMoyuReaderCustomPreset(selectedPresetId);
    setPresets(nextPresets);
    setSelectedPresetId(nextPresets[0]?.id ?? null);
  }

  function exportPresets() {
    const blob = new Blob([exportMoyuReaderPresets(presets)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bookmind-moyu-presets-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importPresets() {
    try {
      const nextPresets = importMoyuReaderPresets(importText, 'merge');
      setPresets(nextPresets);
      setImportText('');
    } catch {
      setImportText(importText);
    }
  }

  function captureMoyuShortcut(event: KeyboardEvent<HTMLElement>, key: MoyuReaderShortcutAction) {
    if (recordingShortcut !== key) return;
    event.preventDefault();
    event.stopPropagation();
    const shortcut = createMoyuShortcutFromKeyboardEvent(event.nativeEvent);
    if (!shortcut) return;
    updateShortcut(key, shortcut);
    setRecordingShortcut(null);
  }

  return (
    <section className="moyu-settings-panel">
      <nav className="moyu-settings-nav" role="tablist" aria-label={t('settings.moyu.aria.panel')}>
        {localizedTabs.map((item) => (
          <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} aria-selected={tab === item.id} role="tab" onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="moyu-settings-content">
        <header className="moyu-settings-titlebar">
          <div>
            <strong>{t('settings.moyu.title')}</strong>
            <span>{activeTabLabel} - {describeMoyuEditorScopeLocalized(scope, selectedPreset?.id ?? null, t)}</span>
          </div>
          <div className="moyu-settings-titlebar-actions">
            <span className="moyu-settings-chip" style={presetFillStyle as CSSProperties}>{selectedPreset ? selectedPreset.name : t('settings.moyu.preset.noneSelected')}</span>
            <label className="moyu-settings-scope-toggle">
              <span>{t('settings.moyu.scope.currentWindow')}</span>
              <input type="radio" name="moyu-settings-scope" checked={scope === 'current-window'} onChange={() => setScope('current-window')} />
            </label>
            <label className="moyu-settings-scope-toggle">
              <span>{t('settings.moyu.scope.global')}</span>
              <input type="radio" name="moyu-settings-scope" checked={scope === 'global'} onChange={() => setScope('global')} />
            </label>
          </div>
        </header>
        <div className="moyu-settings-body">
          <section className="moyu-settings-preview" aria-label={t('settings.moyu.preview.aria')} style={{ ...previewStyle, ...presetFillStyle } as CSSProperties}>
            <strong>{t('settings.moyu.preview.title')}</strong>
            <span>{effectiveProfile.windowWidth} × {effectiveProfile.windowHeight}</span>
            <p>{t('settings.moyu.preview.description')}</p>
            {scope === 'current-window' ? <button type="button" className="ghost-btn small" onClick={() => onChange(draftProfile)}>{t('settings.moyu.action.applyGlobal')}</button> : null}
          </section>

          {tab === 'appearance' ? (
            <SettingsSection title={t('settings.moyu.appearance.title')} description={t('settings.moyu.appearance.description')}>
              <SettingControl title={t('settings.moyu.font.title')} description={t('settings.moyu.font.description')} valueText={effectiveProfile.fontFamily}>
                <ThemedSelect label={t('settings.moyu.font.title')} menuPlacement="bottom" value={effectiveProfile.fontFamily as typeof fontOptions[number]['value']} options={localizedFontOptions} onChange={(value) => patch({ fontFamily: value })} />
              </SettingControl>
              <SettingControl title={t('settings.moyu.textColor.title')} description={t('settings.moyu.textColor.description')} valueText={effectiveProfile.textColor}>
                <div className="moyu-color-mode-row">
                  <ThemedSelect label={t('settings.moyu.textColorMode.title')} menuPlacement="bottom" value={effectiveProfile.textColorMode} options={localizedTextColorModeOptions} onChange={(value) => patch({ textColorMode: value })} />
                  {effectiveProfile.textColorMode === 'custom' ? (
                    <label className="moyu-color-custom">
                      <span>{t('settings.moyu.customColor.title')}</span>
                      <input type="color" value={effectiveProfile.customTextColor} onChange={(event) => patch(recordMoyuRecentTextColor(effectiveProfile, event.currentTarget.value))} />
                    </label>
                  ) : (
                    <div className="moyu-color-palette" role="listbox" aria-label={t('settings.moyu.textColor.title')}>
                      {localizedColorOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={effectiveProfile.textColor === option.value ? 'moyu-color-swatch active' : 'moyu-color-swatch'}
                          aria-label={option.label}
                          aria-pressed={effectiveProfile.textColor === option.value}
                          onClick={() => patch({ textColorMode: 'preset', textColor: option.value, recentTextColors: [option.value, ...effectiveProfile.recentTextColors.filter((item) => item !== option.value)].slice(0, 6) })}
                          style={{ ['--moyu-swatch-color' as string]: option.value }}
                        >
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </SettingControl>
              <SettingControl title={t('settings.moyu.backgroundOpacity.title')} description={t('settings.moyu.backgroundOpacity.description')} valueText={`${Math.round(effectiveProfile.backgroundOpacity * 100)}%`}>
                {slider(t('settings.moyu.backgroundOpacity.title'), effectiveProfile.backgroundOpacity, 0, 0.96, 0.02, (value) => patch({ backgroundOpacity: value }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.textOpacity.title')} description={t('settings.moyu.textOpacity.description')} valueText={`${Math.round(effectiveProfile.textOpacity * 100)}%`}>
                {slider(t('settings.moyu.textOpacity.title'), effectiveProfile.textOpacity, 0.2, 1, 0.02, (value) => patch({ textOpacity: value }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.textScale.title')} description={t('settings.moyu.textScale.description')} valueText={`${Math.round(effectiveProfile.textScale * 100)}%`}>
                {slider(t('settings.moyu.textScale.title'), effectiveProfile.textScale, 0.72, 1.8, 0.02, (value) => patch({ textScale: value }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.toolbarsHidden.title')} description={t('settings.moyu.toolbarsHidden.description')} valueText={effectiveProfile.toolbarsHidden ? t('settings.common.on') : t('settings.common.off')}>
                {toggle(t('settings.moyu.toolbarsHidden.title'), effectiveProfile.toolbarsHidden, (checked) => patch({ toolbarsHidden: checked }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.toolbarReveal.title')} description={t('settings.moyu.toolbarReveal.description')} valueText={formatToolbarRevealLabel(effectiveProfile.toolbarRevealMode, t)}>
                <ThemedSelect
                  label={t('settings.moyu.toolbarReveal.title')}
                  value={effectiveProfile.toolbarRevealMode}
                  options={localizedToolbarRevealOptions}
                  onChange={(value) => patch({ toolbarRevealMode: value })}
                />
              </SettingControl>
              <SettingControl title={t('settings.moyu.toolbarDelay.title')} description={t('settings.moyu.toolbarDelay.description')} valueText={`${effectiveProfile.toolbarRevealDelayMs}ms`}>
                {slider(t('settings.moyu.toolbarDelay.title'), effectiveProfile.toolbarRevealDelayMs, 0, 1000, 20, (value) => patch({ toolbarRevealDelayMs: value }), 'ms')}
              </SettingControl>
              <SettingControl title={t('settings.moyu.scrollbar.title')} description={t('settings.moyu.scrollbar.description')} valueText={effectiveProfile.scrollbarVisible ? t('settings.moyu.state.shown') : t('settings.moyu.state.hidden')}>
                {toggle(t('settings.moyu.scrollbar.title'), effectiveProfile.scrollbarVisible, (checked) => patch({ scrollbarVisible: checked }), effectiveProfile.scrollbarVisible ? t('settings.moyu.state.shownPast') : t('settings.moyu.state.hiddenPast'))}
              </SettingControl>
            </SettingsSection>
          ) : null}

          {tab === 'window' ? (
            <SettingsSection title={t('settings.moyu.window.title')} description={t('settings.moyu.window.description')}>
              <SettingControl title={t('settings.moyu.windowAspectLock.title')} description={t('settings.moyu.windowAspectLock.description')} valueText={effectiveProfile.windowAspectLock ? t('settings.moyu.state.locked') : t('settings.moyu.state.unlocked')}>
                {toggle(t('settings.moyu.windowAspectLock.title'), effectiveProfile.windowAspectLock, (checked) => patch({ windowAspectLock: checked, windowAspectRatio: effectiveProfile.windowWidth / Math.max(1, effectiveProfile.windowHeight) }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.windowWidth.title')} description={t('settings.moyu.windowWidth.description')} valueText={`${effectiveProfile.windowWidth}px`}>
                <div className="moyu-size-control">
                  <label className="reader-slider settings-slider">
                    <span>{t('settings.moyu.windowWidth.title')}<b>{effectiveProfile.windowWidth}px</b></span>
                    <input type="range" min={360} max={1200} step={10} value={effectiveProfile.windowWidth} onChange={(event) => patch({ windowWidth: Number(event.currentTarget.value) })} />
                  </label>
                  <SettingsNumberInput min={360} max={1200} value={effectiveProfile.windowWidth} onCommit={(value) => patch({ windowWidth: Number(value) })} />
                </div>
              </SettingControl>
              <SettingControl title={t('settings.moyu.windowHeight.title')} description={t('settings.moyu.windowHeight.description')} valueText={`${effectiveProfile.windowHeight}px`}>
                <div className="moyu-size-control">
                  <label className="reader-slider settings-slider">
                    <span>{t('settings.moyu.windowHeight.title')}<b>{effectiveProfile.windowHeight}px</b></span>
                    <input type="range" min={160} max={900} step={10} value={effectiveProfile.windowHeight} onChange={(event) => patch({ windowHeight: Number(event.currentTarget.value) })} />
                  </label>
                  <SettingsNumberInput min={160} max={900} value={effectiveProfile.windowHeight} onCommit={(value) => patch({ windowHeight: Number(value) })} />
                </div>
              </SettingControl>
              <SettingControl title={t('settings.moyu.windowPreset.title')} description={t('settings.moyu.windowPreset.description')} valueText={formatWindowPresetLabel(effectiveProfile.windowPreset, t)}>
                <ThemedSelect label={t('settings.moyu.windowPreset.title')} menuPlacement="bottom" value={effectiveProfile.windowPreset} options={localizedWindowPresetOptions} onChange={(value) => patch({ windowPreset: value })} />
              </SettingControl>
              <SettingControl title={t('settings.moyu.rememberWindowPosition.title')} description={t('settings.moyu.rememberWindowPosition.description')} valueText={effectiveProfile.rememberWindowPosition ? t('settings.moyu.state.remember') : t('settings.moyu.state.doNotRemember')}>
                {toggle(t('settings.moyu.rememberWindowPosition.title'), effectiveProfile.rememberWindowPosition, (checked) => patch({ rememberWindowPosition: checked }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.windowSnap.title')} description={t('settings.moyu.windowSnap.description')} valueText={effectiveProfile.windowSnapToEdges ? t('settings.common.enabled') : t('settings.common.disabled')}>
                {toggle(t('settings.moyu.windowSnap.title'), effectiveProfile.windowSnapToEdges, (checked) => patch({ windowSnapToEdges: checked }))}
              </SettingControl>
            </SettingsSection>
          ) : null}

          {tab === 'interaction' ? (
            <SettingsSection title={t('settings.moyu.interaction.title')} description={t('settings.moyu.interaction.description')}>
              <SettingControl title={t('settings.moyu.interactionLocked.title')} description={t('settings.moyu.interactionLocked.description')} valueText={effectiveProfile.interactionLocked ? t('settings.moyu.state.locked') : t('settings.moyu.state.interactive')}>
                {toggle(t('settings.moyu.interactionLocked.title'), effectiveProfile.interactionLocked, (checked) => patch({ interactionLocked: checked }), effectiveProfile.interactionLocked ? t('settings.moyu.state.lockedPast') : t('settings.moyu.state.interactive'))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.bodyHidden.title')} description={t('settings.moyu.bodyHidden.description')} valueText={effectiveProfile.bodyHidden ? t('settings.common.on') : t('settings.common.off')}>
                {toggle(t('settings.moyu.bodyHidden.title'), effectiveProfile.bodyHidden, (checked) => patch({ bodyHidden: checked }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.autoScroll.title')} description={t('settings.moyu.autoScroll.description')} valueText={effectiveProfile.autoScrollEnabled ? t('settings.common.on') : t('settings.common.off')}>
                {toggle(t('settings.moyu.autoScroll.title'), effectiveProfile.autoScrollEnabled, (checked) => patch({ autoScrollEnabled: checked }))}
              </SettingControl>
              <SettingControl title={t('settings.moyu.autoScrollSpeed.title')} description={t('settings.moyu.autoScrollSpeed.description')} valueText={effectiveProfile.autoScrollSpeed}>
                {slider(t('settings.moyu.autoScrollSpeed.title'), effectiveProfile.autoScrollSpeed, 6, 90, 1, (value) => patch({ autoScrollSpeed: value }))}
              </SettingControl>
            </SettingsSection>
          ) : null}

          {tab === 'shortcuts' ? (
            <div className="moyu-shortcut-list">
              <header>
                <strong>{t('settings.moyu.shortcuts.title')}</strong>
                <span>{t('settings.moyu.shortcuts.description')}</span>
              </header>
              {shortcutConflicts.length ? <div className="moyu-shortcut-conflicts">{shortcutConflicts.map((message) => <p key={message}>{message}</p>)}</div> : null}
              {localizedShortcutLabels.map(([key, label]) => (
                <div className={recordingShortcut === key ? 'moyu-shortcut-row recording' : 'moyu-shortcut-row'} key={key} onKeyDown={(event) => captureMoyuShortcut(event, key)}>
                  <span>{label}</span>
                  <input className="moyu-shortcut-input" value={recordingShortcut === key ? t('settings.moyu.shortcut.recordingPlaceholder') : formatLocalizedMoyuShortcut(effectiveProfile.shortcuts[key], t)} readOnly aria-label={t('settings.moyu.shortcut.inputAria', { label })} />
                  <div className="moyu-shortcut-actions">
                    <button type="button" className="ghost-btn small" onClick={() => setRecordingShortcut(key)}>{recordingShortcut === key ? t('settings.moyu.shortcut.recording') : t('settings.moyu.shortcut.record')}</button>
                    <button type="button" className="ghost-btn small" onClick={() => updateShortcut(key, 'disabled')}>{t('settings.moyu.shortcut.disable')}</button>
                    <button type="button" className="ghost-btn small" onClick={() => updateShortcut(key, defaultMoyuReaderProfile.shortcuts[key])}>{t('settings.moyu.shortcut.default')}</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'preset' ? (
            <section className="moyu-preset-section">
              <header className="moyu-preset-head" style={presetFillStyle as CSSProperties}>
                <strong>{t('settings.moyu.preset.title')}</strong>
                <span>{t('settings.moyu.preset.description')}</span>
              </header>
              <div className="moyu-preset-actions">
                <input
                  className="moyu-settings-input"
                  value={presetName}
                  onChange={(event) => setPresetName(event.currentTarget.value)}
                  placeholder={t('settings.moyu.preset.namePlaceholder')}
                />
                <button type="button" className="ghost-btn small" onClick={savePreset}>{t('settings.moyu.preset.saveCurrent')}</button>
                <button type="button" className="ghost-btn small" onClick={replaceSelectedPreset} disabled={!selectedPresetId}>{t('settings.moyu.preset.replaceSelected')}</button>
                <button type="button" className="ghost-btn small" onClick={deleteSelectedPreset} disabled={!selectedPresetId}>{t('settings.moyu.preset.deleteSelected')}</button>
                <button type="button" className="ghost-btn small" onClick={exportPresets}>{t('settings.moyu.preset.export')}</button>
              </div>
              <div className="moyu-preset-import">
                <textarea className="moyu-preset-import-textarea" value={importText} onChange={(event) => setImportText(event.currentTarget.value)} placeholder={t('settings.moyu.preset.importPlaceholder')} />
                <div className="moyu-preset-import-actions">
                  <button type="button" className="ghost-btn small" onClick={importPresets} disabled={!importText.trim()}>{t('settings.moyu.preset.import')}</button>
                  <button type="button" className="ghost-btn small" onClick={() => setImportText(exportMoyuReaderPresets(presets))}>{t('settings.moyu.preset.fillCurrentExport')}</button>
                </div>
              </div>
              <div className="moyu-preset-auto-apply">
                <ThemedSelect
                  label={t('settings.moyu.autoApply.title')}
                  menuPlacement="bottom"
                  value={autoApplyState.mode}
                  options={localizedAutoApplyOptions}
                  onChange={(value) => setAutoApplyState(saveMoyuPresetAutoApplyState({ mode: value }))}
                />
                <button type="button" className="ghost-btn small" onClick={() => presetDiffId ? setPresetDiffId(null) : setPresetDiffId(selectedPresetId ?? presets[0]?.id ?? null)}>{presetDiffId ? t('settings.moyu.preset.hideDiff') : t('settings.moyu.preset.showDiff')}</button>
              </div>
              <div className="moyu-preset-list">
                {presets.length ? presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={selectedPresetId === preset.id ? 'moyu-preset-item active' : 'moyu-preset-item'}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPresetId(preset.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedPresetId(preset.id);
                      }
                    }}
                  >
                    <strong>{preset.name}</strong>
                    <span>{new Date(preset.createdAt).toLocaleString(locale)}</span>
                    <em>{formatMoyuPresetSummaryLocalized(preset.settings, t)}</em>
                    {presetDiff?.id === preset.id ? (
                      <small className="moyu-preset-diff">{summarizeMoyuPresetDiffLocalized(effectiveProfile, preset, t).join(' - ') || t('settings.moyu.preset.sameAsCurrent')}</small>
                    ) : null}
                    <div className="moyu-preset-item-actions">
                      <button type="button" className="ghost-btn small" onClick={(event) => { event.stopPropagation(); applyPreset(preset); rememberMoyuPresetAutoApplyUsage(preset.id); setAutoApplyState(loadMoyuPresetAutoApplyState()); }}>{scope === 'current-window' ? t('settings.moyu.action.applyCurrentWindow') : t('settings.moyu.action.applyGlobal')}</button>
                      <button type="button" className="ghost-btn small" onClick={(event) => { event.stopPropagation(); const nextPresets = deleteMoyuReaderCustomPreset(preset.id); setPresets(nextPresets); setSelectedPresetId((current) => current === preset.id ? null : current); }}>{t('settings.moyu.action.delete')}</button>
                    </div>
                    </div>
                  )) : <p className="moyu-preset-empty">{t('settings.moyu.preset.empty')}</p>}
              </div>
              <p className="moyu-preset-note">{selectedPreset ? t('settings.moyu.preset.selected', { name: selectedPreset.name }) : t('settings.moyu.preset.selectHint')}</p>
              <p className="moyu-preset-note">{formatWindowPresetLabel(effectiveProfile.windowPreset, t)}</p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function describeMoyuEditorScopeLocalized(scope: MoyuSettingsScope, selectedPresetId: string | null | undefined, t: Translator) {
  const scopeLabel = scope === 'current-window' ? t('settings.moyu.scope.currentWindow') : t('settings.moyu.scope.global');
  const presetLabel = selectedPresetId ? t('settings.moyu.scope.preset', { id: selectedPresetId }) : t('settings.moyu.scope.noPreset');
  return `${scopeLabel} - ${presetLabel}`;
}

function formatWindowPresetLabel(value: MoyuReaderWindowPreset, t: Translator) {
  if (value === 'bottom-center') return t('settings.moyu.windowPreset.bottomCenter');
  if (value === 'right-rail') return t('settings.moyu.windowPreset.rightRail');
  if (value === 'custom') return t('settings.moyu.windowPreset.custom');
  return t('settings.moyu.windowPreset.bottomRight');
}

function formatToolbarRevealLabel(value: MoyuReaderToolbarRevealMode, t: Translator) {
  if (value === 'context-menu') return t('settings.moyu.toolbarReveal.contextMenu');
  if (value === 'shortcut') return t('settings.moyu.toolbarReveal.shortcut');
  return t('settings.moyu.toolbarReveal.hover');
}

function formatMoyuPresetSummaryLocalized(profile: Pick<MoyuReaderProfile, 'windowWidth' | 'windowHeight' | 'windowPreset' | 'toolbarRevealMode' | 'fontFamily'>, t: Translator) {
  return t('settings.moyu.preset.summary', {
    width: profile.windowWidth,
    height: profile.windowHeight,
    window: formatWindowPresetLabel(profile.windowPreset, t),
    toolbar: formatToolbarRevealLabel(profile.toolbarRevealMode, t),
    font: formatMoyuFontSummaryLocalized(profile.fontFamily, t),
  });
}

function summarizeMoyuPresetDiffLocalized(current: MoyuReaderProfile, preset: MoyuReaderPreset, t: Translator) {
  const next = patchMoyuReaderProfile(defaultMoyuReaderProfile, preset.settings);
  const parts: string[] = [];
  if (current.windowWidth !== next.windowWidth || current.windowHeight !== next.windowHeight) {
    parts.push(t('settings.moyu.preset.diff.window', {
      from: `${current.windowWidth}x${current.windowHeight}`,
      to: `${next.windowWidth}x${next.windowHeight}`,
    }));
  }
  if (current.windowPreset !== next.windowPreset) {
    parts.push(t('settings.moyu.preset.diff.position', {
      from: formatWindowPresetLabel(current.windowPreset, t),
      to: formatWindowPresetLabel(next.windowPreset, t),
    }));
  }
  if (current.toolbarRevealMode !== next.toolbarRevealMode) {
    parts.push(t('settings.moyu.preset.diff.toolbar', {
      from: formatToolbarRevealLabel(current.toolbarRevealMode, t),
      to: formatToolbarRevealLabel(next.toolbarRevealMode, t),
    }));
  }
  if (current.toolbarRevealDelayMs !== next.toolbarRevealDelayMs) {
    parts.push(t('settings.moyu.preset.diff.delay', {
      from: `${current.toolbarRevealDelayMs}ms`,
      to: `${next.toolbarRevealDelayMs}ms`,
    }));
  }
  if (current.textScale !== next.textScale) {
    parts.push(t('settings.moyu.preset.diff.text', {
      from: `${Math.round(current.textScale * 100)}%`,
      to: `${Math.round(next.textScale * 100)}%`,
    }));
  }
  if (current.backgroundOpacity !== next.backgroundOpacity) {
    parts.push(t('settings.moyu.preset.diff.background', {
      from: `${Math.round(current.backgroundOpacity * 100)}%`,
      to: `${Math.round(next.backgroundOpacity * 100)}%`,
    }));
  }
  if (current.fontFamily !== next.fontFamily) {
    parts.push(t('settings.moyu.preset.diff.font', {
      from: formatMoyuFontSummaryLocalized(current.fontFamily, t),
      to: formatMoyuFontSummaryLocalized(next.fontFamily, t),
    }));
  }
  return parts;
}

function formatMoyuFontSummaryLocalized(fontFamily: string, t: Translator) {
  const firstFamily = fontFamily.split(',')[0]?.trim() ?? fontFamily;
  return firstFamily.replace(/^["']|["']$/g, '') || t('settings.moyu.font.default');
}

function getLocalizedMoyuShortcutConflictMessages(shortcuts: Record<MoyuReaderShortcutAction, MoyuReaderShortcut>, t: Translator) {
  const shortcutEntries = shortcutLabels
    .map(([key, labelKey]) => ({ label: t(labelKey), value: shortcuts[key] }))
    .filter((item) => item.value !== 'disabled');
  const grouped = new Map<string, string[]>();
  shortcutEntries.forEach((item) => grouped.set(item.value, [...(grouped.get(item.value) ?? []), item.label]));
  return Array.from(grouped.entries())
    .filter(([, labels]) => labels.length > 1)
    .map(([shortcut, labels]) => t('settings.moyu.shortcut.conflict', { shortcut: formatLocalizedMoyuShortcut(shortcut as MoyuReaderShortcut, t), labels: labels.join(', ') }));
}

function formatLocalizedMoyuShortcut(shortcut: MoyuReaderShortcut, t: Translator) {
  return shortcut === 'disabled' ? t('settings.moyu.shortcut.disabled') : formatMoyuShortcut(shortcut);
}

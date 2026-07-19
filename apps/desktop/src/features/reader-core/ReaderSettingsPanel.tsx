import { useEffect, useMemo, useRef, useState } from 'react';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n } from '../../i18n';
import type { ReaderAlign, ReaderAnimation, ReaderHeaderFooterProgressFormat, ReaderHeaderFooterTimeFormat, ReaderInfoSlot, ReaderPageMode, ReaderPreset, ReaderSettings, ReaderSettingsLevel, ReaderTheme, ReaderTitleDecoration, ReaderTitleNumberCleanup } from '../../types';
import { getReaderFontOptions, readerMinimumFontSizes } from './readerSettings';

export { getReaderFontOptions, normalizeReaderSettings, readerPresetSettings } from './readerSettings';

export type ReaderSettingsPanelProps = {
  settings: ReaderSettings;
  effectivePageWidth: number;
  level: ReaderSettingsLevel;
  onLevelChange: (level: ReaderSettingsLevel) => void;
  onUpdate: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  onPreviewSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  onPresetChange: (preset: ReaderPreset) => void;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
  onRestoreDefault: () => void;
  onUndoSettings: () => void;
  onSaveAsGlobalDefault: () => void;
  bookChapterRulesOverrideEnabled: boolean;
  onSaveBookChapterRulesOverride: () => void;
  onClearBookChapterRulesOverride: () => void;
  onExportDiagnostics: () => void;
  onClose: () => void;
};

type ReaderSliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
};

type ReaderSettingsSectionId = 'quick-actions' | 'layout' | 'type' | 'margins' | 'info' | 'motion';

export function ReaderSettingsPanel({ settings, effectivePageWidth, level, onLevelChange, onUpdate, onPreviewSetting, onPresetChange, onExportSettings, onImportSettings, onRestoreDefault, onUndoSettings, onSaveAsGlobalDefault, bookChapterRulesOverrideEnabled, onSaveBookChapterRulesOverride, onClearBookChapterRulesOverride, onExportDiagnostics, onClose }: ReaderSettingsPanelProps) {
  const { t } = useI18n();
  const fontOptions = useMemo(() => getReaderFontOptions(t), [t]);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsImportInputRef = useRef<HTMLInputElement | null>(null);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const alignOptions: { value: ReaderAlign; label: string }[] = [
    { value: 'left', label: t('reader.align.left') },
    { value: 'center', label: t('reader.align.center') },
    { value: 'right', label: t('reader.align.right') },
    { value: 'hidden', label: t('reader.align.hidden') },
  ];
  const titleNumberCleanupOptions: { value: ReaderTitleNumberCleanup; label: string }[] = [
    { value: 'keep', label: t('reader.titleNumberCleanup.keep') },
    { value: 'strip-number', label: t('reader.titleNumberCleanup.stripNumber') },
  ];
  const titleDecorationOptions: { value: ReaderTitleDecoration; label: string }[] = [
    { value: 'off', label: t('reader.titleDecoration.off') },
    { value: 'line', label: t('reader.titleDecoration.line') },
  ];
  const headerFooterTimeFormatOptions: { value: ReaderHeaderFooterTimeFormat; label: string }[] = [
    { value: 'short-24h', label: t('reader.headerFooterTimeFormat.short24h') },
    { value: 'short-12h', label: t('reader.headerFooterTimeFormat.short12h') },
    { value: 'date-time', label: t('reader.headerFooterTimeFormat.dateTime') },
  ];
  const headerFooterProgressFormatOptions: { value: ReaderHeaderFooterProgressFormat; label: string }[] = [
    { value: 'percent', label: t('reader.headerFooterProgressFormat.percent') },
    { value: 'current-page', label: t('reader.headerFooterProgressFormat.currentPage') },
    { value: 'chapter-page', label: t('reader.headerFooterProgressFormat.chapterPage') },
    { value: 'total-pages', label: t('reader.headerFooterProgressFormat.totalPages') },
  ];
  const slotOptions: { value: ReaderInfoSlot; label: string }[] = [
    { value: 'none', label: t('reader.slot.none') },
    { value: 'title', label: t('reader.slot.title') },
    { value: 'chapter', label: t('reader.slot.chapter') },
    { value: 'progress', label: t('reader.slot.progress') },
    { value: 'page', label: t('reader.slot.page') },
    { value: 'time', label: t('reader.slot.time') },
    { value: 'custom', label: t('reader.slot.custom') },
  ];
  const animationOptions: { value: ReaderAnimation; label: string }[] = [
    { value: 'none', label: t('reader.animation.none') },
    { value: 'fade', label: t('reader.animation.fade') },
    { value: 'slide', label: t('reader.animation.slide') },
    { value: 'lift', label: t('reader.animation.lift') },
    { value: 'turn', label: t('reader.animation.turn') },
    { value: 'zoom', label: t('reader.animation.zoom') },
  ];
  const pageModeOptions: { value: ReaderPageMode; label: string }[] = [
    { value: 'single', label: t('reader.pageMode.single') },
    { value: 'double', label: t('reader.pageMode.double') },
  ];
  const presetOptions: { value: ReaderPreset; label: string }[] = [
    { value: 'custom', label: t('reader.preset.custom') },
    { value: 'novel', label: t('reader.preset.novel') },
    { value: 'paper', label: t('reader.preset.paper') },
    { value: 'eyeComfort', label: t('reader.preset.eyeComfort') },
    { value: 'compact', label: t('reader.preset.compact') },
    { value: 'spacious', label: t('reader.preset.spacious') },
    { value: 'eInk', label: t('reader.preset.eInk') },
  ];
  const themeOptions: { value: ReaderTheme; label: string }[] = [
    { value: 'white', label: t('reader.theme.white') },
    { value: 'paper', label: t('reader.theme.paper') },
    { value: 'eyeComfort', label: t('reader.theme.eyeComfort') },
    { value: 'dark', label: t('reader.theme.dark') },
    { value: 'oled', label: t('reader.theme.oled') },
    { value: 'system', label: t('reader.theme.system') },
  ];
  const groups = [
    { id: 'quick-actions', label: t('reader.settings.quickActions') },
    { id: 'layout', label: t('reader.settings.layout') },
    { id: 'type', label: t('reader.settings.typography') },
    { id: 'margins', label: t('reader.settings.margins') },
    ...(level === 'advanced' ? [
      { id: 'info', label: t('reader.settings.info') },
      { id: 'motion', label: t('reader.settings.motion') },
    ] : []),
  ];

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function navigateToSection(id: ReaderSettingsSectionId) {
    document.getElementById(`reader-settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <aside className="reader-settings-panel" role="dialog" aria-modal="false" aria-label={t('reader.settings')} onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }}>
      <div className="reader-settings-header-card">
        <div className="reader-settings-head">
          <div>
            <p className="eyebrow">{t('reader.settingsEyebrow')}</p>
            <h2>{t('reader.settings')}</h2>
            <p>{t('reader.settingsLivePreview')}</p>
          </div>
          <button ref={closeButtonRef} className="detail-close-btn" onClick={onClose} aria-label={t('common.cancel')}>×</button>
        </div>
      </div>
      <div className="reader-settings-body" data-navigation-collapsed={navigationCollapsed}>
        <nav className="reader-settings-nav" aria-label={t('reader.settings')} aria-expanded={!navigationCollapsed}>
          <button
            className="reader-settings-nav-collapse"
            type="button"
            aria-label={navigationCollapsed ? t('reader.settings.expandNavigation') : t('reader.settings.collapseNavigation')}
            aria-expanded={!navigationCollapsed}
            title={navigationCollapsed ? t('reader.settings.expandNavigation') : t('reader.settings.collapseNavigation')}
            onClick={() => setNavigationCollapsed((value) => !value)}
          >
            <span className="reader-settings-chevron horizontal" aria-hidden="true" />
            <span>{navigationCollapsed ? '' : t('reader.settings.navigation')}</span>
          </button>
          <div className="reader-settings-nav-items" hidden={navigationCollapsed}>
            {groups.map((group) => <button
              type="button"
              key={group.id}
              title={group.label}
              onClick={() => navigateToSection(group.id as ReaderSettingsSectionId)}
            >
              <span>{group.label}</span>
            </button>)}
          </div>
        </nav>
        <div className="reader-settings-scroll">
          <section className="reader-setting-section reader-settings-quick-actions" id="reader-settings-quick-actions">
            <div className="reader-settings-quick-head">
              <h3>{t('reader.settings.quickActions')}</h3>
            </div>
            <div className="reader-settings-level" role="tablist" aria-label={t('reader.settingsLevel')}>
              <button className={level === 'basic' ? 'active' : ''} type="button" role="tab" aria-selected={level === 'basic'} aria-controls="reader-settings-layout" onClick={() => onLevelChange('basic')}>{t('reader.settingsBasic')}</button>
              <button className={level === 'advanced' ? 'active' : ''} type="button" role="tab" aria-selected={level === 'advanced'} aria-controls="reader-settings-info" onClick={() => onLevelChange('advanced')}>{t('reader.settingsAdvanced')}</button>
            </div>
            <div className="reader-settings-action-grid">
              <button type="button" className="ghost-btn small primary-action" onClick={onExportSettings}>{t('reader.settings.export')}</button>
              <button type="button" className="ghost-btn small" onClick={() => settingsImportInputRef.current?.click()}>{t('reader.settings.import')}</button>
              <button type="button" className="ghost-btn small" onClick={onRestoreDefault}>{t('reader.settings.restoreDefault')}</button>
              <button type="button" className="ghost-btn small" onClick={onUndoSettings}>{t('reader.settings.undo')}</button>
              <button type="button" className="ghost-btn small" onClick={onSaveAsGlobalDefault}>{t('reader.settings.saveAsGlobalDefault')}</button>
              <button type="button" className="ghost-btn small" onClick={onSaveBookChapterRulesOverride}>{t('reader.settings.saveBookChapterRulesOverride')}</button>
              <button type="button" className="ghost-btn small" onClick={onClearBookChapterRulesOverride} disabled={!bookChapterRulesOverrideEnabled}>{t('reader.settings.clearBookChapterRulesOverride')}</button>
              <button type="button" className="ghost-btn small" onClick={onExportDiagnostics}>{t('reader.diagnostics.export')}</button>
              <input
                ref={settingsImportInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void onImportSettings(file);
                  event.currentTarget.value = '';
                }}
              />
            </div>
            <p className="reader-settings-helper">{bookChapterRulesOverrideEnabled ? t('reader.settings.bookChapterRulesOverrideEnabled') : t('reader.settings.bookChapterRulesOverrideGlobal')}</p>
          </section>
          <section className="reader-setting-section" id="reader-settings-layout">
            <h3>{t('reader.settings.layout')}</h3>
            <div className="reader-toggle-row">
              <button className={settings.layoutMode === 'page' ? 'active' : ''} aria-pressed={settings.layoutMode === 'page'} onClick={() => onUpdate('layoutMode', 'page')}>{t('reader.layout.page')}</button>
              <button className={settings.layoutMode === 'flow' ? 'active' : ''} aria-pressed={settings.layoutMode === 'flow'} onClick={() => onUpdate('layoutMode', 'flow')}>{t('reader.layout.flow')}</button>
            </div>
            <ThemedSelect label={t('reader.settings.preset')} value={settings.preset} options={presetOptions} onChange={(value) => onPresetChange(value)} />
            <ThemedSelect label={t('reader.settings.theme')} value={settings.theme} options={themeOptions} onChange={(value) => onUpdate('theme', value)} />
            <ThemedSelect label={t('reader.pageMode')} value={settings.pageMode} options={pageModeOptions} onChange={(value) => onUpdate('pageMode', value)} />
          </section>
          <section className="reader-setting-section" id="reader-settings-type">
            <h3>{t('reader.settings.typography')}</h3>
            <ThemedSelect label={t('reader.fontFamily')} value={settings.fontFamily} options={fontOptions} onChange={(value) => onUpdate('fontFamily', value)} />
            <label className="reader-check"><input type="checkbox" checked={settings.preserveBlankLines} onChange={(event) => onUpdate('preserveBlankLines', event.target.checked)} />{t('reader.preserveBlankLines')}</label>
            {slider(t('reader.fontSize'), 'fontSize', settings.fontSize, readerMinimumFontSizes.fontSize, 42, 1, onPreviewSetting, onUpdate)}
            {level === 'advanced' ? slider(t('reader.letterSpacing'), 'letterSpacing', settings.letterSpacing, 0, 4, .5, onPreviewSetting, onUpdate) : null}
            {slider(t('reader.lineHeight'), 'lineHeight', settings.lineHeight, 1.2, 3, .1, onPreviewSetting, onUpdate)}
            {slider(t('reader.paragraphSpacing'), 'paragraphSpacing', settings.paragraphSpacing, 8, 42, 1, onPreviewSetting, onUpdate)}
            {level === 'advanced' ? slider(t('reader.indent'), 'firstLineIndent', settings.firstLineIndent, 0, 4, .5, onPreviewSetting, onUpdate) : null}
            {slider(t('reader.pageWidth'), 'pageWidth', settings.pageWidth, 420, 1200, 10, onPreviewSetting, onUpdate)}
            <div className="reader-page-width-meter">
              <span>{t('reader.pageWidth.configured')}<b>{settings.pageWidth}px</b></span>
              <span>{t('reader.pageWidth.actual')}<b>{Math.round(effectivePageWidth)}px</b></span>
            </div>
          </section>
          <section className="reader-setting-section" id="reader-settings-margins">
            <h3>{t('reader.settings.margins')}</h3>
            {slider(t('reader.bodyMarginX'), 'bodyMarginX', settings.bodyMarginX, 24, 110, 2, onPreviewSetting, onUpdate)}
            {slider(t('reader.bodyMarginY'), 'bodyMarginY', settings.bodyMarginY, 24, 110, 2, onPreviewSetting, onUpdate)}
            {level === 'advanced' ? slider(t('reader.headerMarginX'), 'headerMarginX', settings.headerMarginX, 0, 64, 1, onPreviewSetting, onUpdate) : null}
            {level === 'advanced' ? slider(t('reader.headerMarginY'), 'headerMarginY', settings.headerMarginY, 0, 48, 1, onPreviewSetting, onUpdate) : null}
            {level === 'advanced' ? slider(t('reader.footerMarginX'), 'footerMarginX', settings.footerMarginX, 0, 64, 1, onPreviewSetting, onUpdate) : null}
            {level === 'advanced' ? slider(t('reader.footerMarginY'), 'footerMarginY', settings.footerMarginY, 0, 48, 1, onPreviewSetting, onUpdate) : null}
          </section>
          {level === 'advanced' ? <section className="reader-setting-section" id="reader-settings-info">
            <h3>{t('reader.settings.info')}</h3>
            <ThemedSelect label={t('reader.titleAlign')} value={settings.titleAlign} options={alignOptions} onChange={(value) => onUpdate('titleAlign', value)} />
            <ThemedSelect label={t('reader.titleNumberCleanup')} value={settings.titleNumberCleanup} options={titleNumberCleanupOptions} onChange={(value) => onUpdate('titleNumberCleanup', value)} />
            <ThemedSelect label={t('reader.titleDecoration')} value={settings.titleDecoration} options={titleDecorationOptions} onChange={(value) => onUpdate('titleDecoration', value)} />
            {slider(t('reader.titleFontSize'), 'titleFontSize', settings.titleFontSize, readerMinimumFontSizes.titleFontSize, 54, 1, onPreviewSetting, onUpdate)}
            {slider(t('reader.titleMarginTop'), 'titleMarginTop', settings.titleMarginTop, 0, 60, 1, onPreviewSetting, onUpdate)}
            {slider(t('reader.titleMarginBottom'), 'titleMarginBottom', settings.titleMarginBottom, 0, 60, 1, onPreviewSetting, onUpdate)}
            <label className="reader-check"><input type="checkbox" checked={settings.headerVisible} onChange={(event) => onUpdate('headerVisible', event.target.checked)} />{t('reader.headerVisible')}</label>
            <ThemedSelect label={t('reader.headerLeft')} value={settings.headerLeft} options={slotOptions} onChange={(value) => onUpdate('headerLeft', value)} />
            <ThemedSelect label={t('reader.headerCenter')} value={settings.headerCenter} options={slotOptions} onChange={(value) => onUpdate('headerCenter', value)} />
            <ThemedSelect label={t('reader.headerRight')} value={settings.headerRight} options={slotOptions} onChange={(value) => onUpdate('headerRight', value)} />
            <label className="reader-check"><input type="checkbox" checked={settings.footerVisible} onChange={(event) => onUpdate('footerVisible', event.target.checked)} />{t('reader.footerVisible')}</label>
            <ThemedSelect label={t('reader.footerLeft')} value={settings.footerLeft} options={slotOptions} onChange={(value) => onUpdate('footerLeft', value)} />
            <ThemedSelect label={t('reader.footerCenter')} value={settings.footerCenter} options={slotOptions} onChange={(value) => onUpdate('footerCenter', value)} />
            <ThemedSelect label={t('reader.footerRight')} value={settings.footerRight} options={slotOptions} onChange={(value) => onUpdate('footerRight', value)} />
            <label className="reader-text-field">
              <span>{t('reader.headerFooterCustomFormat')}</span>
              <input value={settings.headerFooterCustomFormat} onChange={(event) => onUpdate('headerFooterCustomFormat', event.target.value)} placeholder="{title} · {chapter} · {progress} · {page} · {time}" />
            </label>
            <ThemedSelect label={t('reader.headerFooterTimeFormat')} value={settings.headerFooterTimeFormat} options={headerFooterTimeFormatOptions} onChange={(value) => onUpdate('headerFooterTimeFormat', value)} />
            <ThemedSelect label={t('reader.headerFooterProgressFormat')} value={settings.headerFooterProgressFormat} options={headerFooterProgressFormatOptions} onChange={(value) => onUpdate('headerFooterProgressFormat', value)} />
            {slider(t('reader.headerFooterFontSize'), 'headerFooterFontSize', settings.headerFooterFontSize, readerMinimumFontSizes.headerFooterFontSize, 18, 1, onPreviewSetting, onUpdate)}
            {slider(t('reader.headerFooterOpacity'), 'headerFooterOpacity', settings.headerFooterOpacity, 0.35, 1, 0.05, onPreviewSetting, onUpdate)}
          </section> : null}
          {level === 'advanced' ? <section className="reader-setting-section" id="reader-settings-motion">
            <h3>{t('reader.settings.motion')}</h3>
            <ThemedSelect label={t('reader.animation')} value={settings.pageAnimation} options={animationOptions} onChange={(value) => onUpdate('pageAnimation', value)} />
            <label className="reader-check"><input type="checkbox" checked={settings.wheelPaging} onChange={(event) => onUpdate('wheelPaging', event.target.checked)} />{t('reader.wheelPaging')}</label>
            <label className="reader-check"><input type="checkbox" checked={settings.touchpadNaturalScroll} onChange={(event) => onUpdate('touchpadNaturalScroll', event.target.checked)} />{t('reader.touchpadNaturalScroll')}</label>
          </section> : null}
        </div>
      </div>
    </aside>
  );
}

function slider<K extends keyof ReaderSettings>(label: string, key: K, value: number, min: number, max: number, step: number, onPreview: <T extends keyof ReaderSettings>(key: T, value: ReaderSettings[T]) => void, onCommit: <T extends keyof ReaderSettings>(key: T, value: ReaderSettings[T]) => void) {
  return (
    <SliderControl
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onPreview={(nextValue) => onPreview(key, nextValue as ReaderSettings[K])}
      onCommit={(nextValue) => {
        onCommit(key, nextValue as ReaderSettings[K]);
      }}
    />
  );
}

function SliderControl({ label, value, min, max, step, onPreview, onCommit }: ReaderSliderControlProps) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  function updateDraft(nextValue: number) {
    setDraftValue(nextValue);
    onPreview(nextValue);
  }

  function commitNow() {
    if (draftValue !== value) onCommit(draftValue);
  }

  return (
    <label className="reader-slider">
      <span>{label}<b>{draftValue}</b></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        onChange={(event) => updateDraft(Number(event.target.value))}
        onPointerUp={commitNow}
        onPointerCancel={commitNow}
        onKeyUp={commitNow}
        onBlur={commitNow}
      />
    </label>
  );
}

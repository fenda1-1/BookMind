import type { RefObject } from 'react';
import { ThemedSelect } from './SettingsSelect';
import { getReaderFontOptions, readerMinimumFontSizes, type ReaderCustomPreset } from '../features/reader-core/readerSettings';
import type { Translator } from '../i18n';
import type { ExtendedSettings } from '../services/settingsCenterService';
import type { ReaderAlign, ReaderAnimation, ReaderCjkPunctuationHanging, ReaderFontWeightBoost, ReaderHeaderFooterProgressFormat, ReaderHeaderFooterTimeFormat, ReaderInfoSlot, ReaderLayoutMode, ReaderLongParagraphStrategy, ReaderMixedTextSpacing, ReaderPageMode, ReaderPageVerticalAlign, ReaderPreset, ReaderSettings, ReaderTheme, ReaderTitleDecoration, ReaderTitleNumberCleanup } from '../types';
import { ReadonlyPill, SettingControl, SettingsNumberInput, SettingsSection, SettingsTextInput } from './SettingsPageScaffold';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type FontRenderingDiagnostics = {
  primaryFont: string;
  fallbackCount: number;
  fontFamily: string;
  fontWeightBoost: ReaderSettings['fontWeightBoost'];
  supports: {
    hangingPunctuation: boolean;
    textAutospace: boolean;
    textSpacingTrim: boolean;
    textStroke: boolean;
  };
};

type SettingsReaderPanelProps = {
  t: Translator;
  currentBookTitle?: string;
  onOpenCurrentBookSettings?: () => void;
  onApplyPresetToCurrentBook?: (preset: ReaderCustomPreset) => void;
  readerGlobalSettings: ReaderSettings;
  readerCustomPresets: ReaderCustomPreset[];
  readerPresetImportInputRef: RefObject<HTMLInputElement | null>;
  readerPresetOptions: SelectOption<ReaderPreset>[];
  readerThemeOptions: SelectOption<ReaderTheme>[];
  readerLayoutOptions: SelectOption<ReaderLayoutMode>[];
  readerPageModeOptions: SelectOption<ReaderPageMode>[];
  readerPageVerticalAlignOptions: SelectOption<ReaderPageVerticalAlign>[];
  readerLongParagraphStrategyOptions: SelectOption<ReaderLongParagraphStrategy>[];
  readerCjkPunctuationOptions: SelectOption<ReaderCjkPunctuationHanging>[];
  readerMixedTextSpacingOptions: SelectOption<ReaderMixedTextSpacing>[];
  readerFontWeightBoostOptions: SelectOption<ReaderFontWeightBoost>[];
  readerAlignOptions: SelectOption<ReaderAlign>[];
  readerTitleNumberCleanupOptions: SelectOption<ReaderTitleNumberCleanup>[];
  readerTitleDecorationOptions: SelectOption<ReaderTitleDecoration>[];
  readerInfoSlotOptions: SelectOption<ReaderInfoSlot>[];
  readerHeaderFooterTimeFormatOptions: SelectOption<ReaderHeaderFooterTimeFormat>[];
  readerHeaderFooterProgressFormatOptions: SelectOption<ReaderHeaderFooterProgressFormat>[];
  readerAnimationOptions: SelectOption<ReaderAnimation>[];
  multiWindowConflictStrategyOptions: SelectOption<ExtendedSettings['multiWindowConflictStrategy']>[];
  readerProgressModeOptions: SelectOption<ExtendedSettings['readerProgressMode']>[];
  fontRenderingDiagnostics: FontRenderingDiagnostics;
  extendedSettings: ExtendedSettings;
  applyReaderGlobalPreset: (preset: ReaderPreset) => void;
  saveCurrentReaderSettingsAsPreset: () => void;
  exportReaderCustomPresetsFromSettings: () => void;
  importReaderCustomPresetsFromSettings: (file: File) => Promise<void>;
  formatSettingsChangeTime: (isoTime: string) => string;
  applyReaderCustomPreset: (preset: ReaderCustomPreset) => void;
  applyReaderCustomPresetToCurrentBook: (preset: ReaderCustomPreset) => void;
  renameReaderCustomPresetFromSettings: (preset: ReaderCustomPreset) => void;
  deleteReaderCustomPresetFromSettings: (preset: ReaderCustomPreset) => void | Promise<void>;
  updateReaderGlobalSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  updateReaderFontStack: (update: Partial<Pick<ReaderSettings, 'customFontFamily' | 'fontFallbacks'>>) => void;
  parseReaderFontFallbackInput: (value: string) => string[];
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
  exportReaderDiagnosticsFromSettings: () => void;
  copyChapterParseDiagnostics: () => void;
  highlightedSetting?: 'ai-api' | 'reader-memory-warning' | null;
  readerMemoryWarningSettingRef?: RefObject<HTMLElement | null>;
  searchText?: string;
};

export function SettingsReaderPanel({
  t,
  currentBookTitle,
  onOpenCurrentBookSettings,
  onApplyPresetToCurrentBook,
  readerGlobalSettings,
  readerCustomPresets,
  readerPresetImportInputRef,
  readerPresetOptions,
  readerThemeOptions,
  readerLayoutOptions,
  readerPageModeOptions,
  readerPageVerticalAlignOptions,
  readerLongParagraphStrategyOptions,
  readerCjkPunctuationOptions,
  readerMixedTextSpacingOptions,
  readerFontWeightBoostOptions,
  readerAlignOptions,
  readerTitleNumberCleanupOptions,
  readerTitleDecorationOptions,
  readerInfoSlotOptions,
  readerHeaderFooterTimeFormatOptions,
  readerHeaderFooterProgressFormatOptions,
  readerAnimationOptions,
  multiWindowConflictStrategyOptions,
  readerProgressModeOptions,
  fontRenderingDiagnostics,
  extendedSettings,
  applyReaderGlobalPreset,
  saveCurrentReaderSettingsAsPreset,
  exportReaderCustomPresetsFromSettings,
  importReaderCustomPresetsFromSettings,
  formatSettingsChangeTime,
  applyReaderCustomPreset,
  applyReaderCustomPresetToCurrentBook,
  renameReaderCustomPresetFromSettings,
  deleteReaderCustomPresetFromSettings,
  updateReaderGlobalSetting,
  updateReaderFontStack,
  parseReaderFontFallbackInput,
  updateExtendedSetting,
  exportReaderDiagnosticsFromSettings,
  copyChapterParseDiagnostics,
  highlightedSetting = null,
  readerMemoryWarningSettingRef,
}: SettingsReaderPanelProps) {
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (enabled: boolean) => enabled ? tr('settings.common.on') : tr('settings.common.off');
  const enabledDisabled = (enabled: boolean) => enabled ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const supportText = (enabled: boolean) => enabled ? tr('settings.reader.supported') : tr('settings.reader.unsupported');
  const customPresetCountText = tr('settings.reader.customPreset.count', { count: readerCustomPresets.length });
  const bookOverrideEntry = currentBookTitle
    ? tr('settings.reader.currentBook.value', { title: currentBookTitle })
    : tr('settings.reader.currentBook.none');

  function slider<K extends keyof ReaderSettings>(key: K, title: string, value: number, min: number, max: number, step: number, suffix = '') {
    return (
      <SettingControl title={title} description={tr('settings.reader.range.description', { min: `${min}${suffix}`, max: `${max}${suffix}` })} valueText={`${value}${suffix}`}>
        <label className="reader-slider settings-slider">
          <span>{title}<b>{value}{suffix}</b></span>
          <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => updateReaderGlobalSetting(key, Number(event.target.value) as ReaderSettings[K])} />
        </label>
      </SettingControl>
    );
  }

  function toggle<K extends keyof ReaderSettings>(key: K, title: string, checked: boolean) {
    return (
      <SettingControl title={title} description={tr('settings.reader.globalImmediate.description')} valueText={onOff(checked)}>
        <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => updateReaderGlobalSetting(key, event.target.checked as ReaderSettings[K])} /><span>{enabledDisabled(checked)}</span></label>
      </SettingControl>
    );
  }

  function colorSetting<K extends 'customBackgroundColor' | 'customTextColor' | 'customSelectionColor'>(key: K, title: string, description: string, fallback: string) {
    const value = readerGlobalSettings[key];
    return (
      <SettingControl title={title} description={description} valueText={value || tr('settings.reader.value.followTheme')}>
        <div className="settings-color-row">
          <input className="settings-color-input" type="color" value={value || fallback} onChange={(event) => updateReaderGlobalSetting(key, event.target.value as ReaderSettings[K])} />
          <SettingsTextInput value={value} placeholder={tr('settings.reader.color.placeholder')} onCommit={(nextValue) => updateReaderGlobalSetting(key, nextValue as ReaderSettings[K])} />
          <button className="ghost-btn small" type="button" onClick={() => updateReaderGlobalSetting(key, '' as ReaderSettings[K])}>{tr('settings.reader.action.clear')}</button>
        </div>
      </SettingControl>
    );
  }

  function SlotControl({ title, field }: { title: string; field: 'headerLeft' | 'headerCenter' | 'headerRight' | 'footerLeft' | 'footerCenter' | 'footerRight' }) {
    return (
      <SettingControl title={title} description={tr('settings.reader.headerFooter.slotDescription')} valueText={readerGlobalSettings[field]}>
        <ThemedSelect label={title} value={readerGlobalSettings[field]} options={readerInfoSlotOptions} onChange={(value) => updateReaderGlobalSetting(field, value)} />
      </SettingControl>
    );
  }

  return (
    <>
      <SettingsSection title={tr('settings.reader.presetsTheme.title')} description={tr('settings.reader.presetsTheme.description', { globalTitle: t('reader.settings.globalTitle' as never) })}>
        <SettingControl title={tr('settings.reader.currentBook.title')} description={tr('settings.reader.currentBook.description')} valueText={bookOverrideEntry}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={onOpenCurrentBookSettings} disabled={!currentBookTitle || !onOpenCurrentBookSettings}>{tr('settings.reader.currentBook.open')}</button>
            <ReadonlyPill text={currentBookTitle ? tr('settings.reader.currentBook.available') : tr('settings.reader.currentBook.needBook')} />
          </div>
        </SettingControl>
        <SettingControl title={t('reader.settings.preset' as never)} description={tr('settings.reader.preset.description')} valueText={readerGlobalSettings.preset}>
          <ThemedSelect label={t('reader.settings.preset' as never)} value={readerGlobalSettings.preset} options={readerPresetOptions} onChange={applyReaderGlobalPreset} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.customPreset.saveTitle')} description={tr('settings.reader.customPreset.saveDescription')} valueText={customPresetCountText}>
          <div className="settings-inline-actions">
            <button className="primary-btn small" type="button" onClick={saveCurrentReaderSettingsAsPreset}>{tr('settings.reader.customPreset.save')}</button>
            <button className="ghost-btn small" type="button" onClick={exportReaderCustomPresetsFromSettings} disabled={!readerCustomPresets.length}>{tr('settings.reader.customPreset.export')}</button>
            <button className="ghost-btn small" type="button" onClick={() => readerPresetImportInputRef.current?.click()}>{tr('settings.reader.customPreset.import')}</button>
            <input ref={readerPresetImportInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importReaderCustomPresetsFromSettings(file); event.currentTarget.value = ''; }} />
          </div>
          <div className="settings-custom-preset-list">
            {readerCustomPresets.map((preset) => (
              <div className="settings-custom-preset-item" key={preset.id}>
                <strong>{preset.name}</strong>
                <em>{formatSettingsChangeTime(preset.createdAt)}</em>
                <div>
                  <button className="ghost-btn small" type="button" onClick={() => applyReaderCustomPreset(preset)}>{tr('settings.reader.action.apply')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => applyReaderCustomPresetToCurrentBook(preset)} disabled={!currentBookTitle || !onApplyPresetToCurrentBook}>{tr('settings.reader.action.applyToCurrentBook')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => renameReaderCustomPresetFromSettings(preset)}>{tr('settings.reader.action.rename')}</button>
                  <button className="ghost-btn small" type="button" onClick={() => { void deleteReaderCustomPresetFromSettings(preset); }}>{tr('settings.reader.action.delete')}</button>
                </div>
              </div>
            ))}
            {!readerCustomPresets.length ? <ReadonlyPill text={tr('settings.reader.customPreset.empty')} /> : null}
          </div>
        </SettingControl>
        <SettingControl title={t('reader.settings.theme' as never)} description={tr('settings.reader.theme.description')} valueText={readerGlobalSettings.theme}>
          <ThemedSelect label={t('reader.settings.theme' as never)} value={readerGlobalSettings.theme} options={readerThemeOptions} onChange={(value) => updateReaderGlobalSetting('theme', value)} />
        </SettingControl>
        {slider('paperTextureStrength', tr('settings.reader.paperTextureStrength.title'), readerGlobalSettings.paperTextureStrength, 0, 0.45, 0.01)}
        {slider('eyeComfortBackgroundStrength', tr('settings.reader.eyeComfortBackgroundStrength.title'), readerGlobalSettings.eyeComfortBackgroundStrength, 0, 1, 0.05)}
        {slider('paperBackgroundStrength', tr('settings.reader.paperBackgroundStrength.title'), readerGlobalSettings.paperBackgroundStrength, 0, 1, 0.05)}
        {colorSetting('customBackgroundColor', tr('settings.reader.customBackgroundColor.title'), tr('settings.reader.customBackgroundColor.description'), '#f2e6cf')}
        {colorSetting('customTextColor', tr('settings.reader.customTextColor.title'), tr('settings.reader.customTextColor.description'), '#3b3025')}
        {colorSetting('customSelectionColor', tr('settings.reader.customSelectionColor.title'), tr('settings.reader.customSelectionColor.description'), '#b7cdfa')}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.layoutSection.title')} description={tr('settings.reader.layoutSection.description')}>
        <SettingControl title={t('reader.layout' as never)} description={tr('settings.reader.layoutMode.description')} valueText={readerGlobalSettings.layoutMode}>
          <ThemedSelect label={t('reader.layout' as never)} value={readerGlobalSettings.layoutMode} options={readerLayoutOptions} onChange={(value) => updateReaderGlobalSetting('layoutMode', value)} />
        </SettingControl>
        <SettingControl title={t('reader.pageMode' as never)} description={tr('settings.reader.pageMode.description')} valueText={readerGlobalSettings.pageMode}>
          <ThemedSelect label={t('reader.pageMode' as never)} value={readerGlobalSettings.pageMode} options={readerPageModeOptions} onChange={(value) => updateReaderGlobalSetting('pageMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.pageVerticalAlign.title')} description={tr('settings.reader.pageVerticalAlign.description')} valueText={readerPageVerticalAlignOptions.find((item) => item.value === readerGlobalSettings.pageVerticalAlign)?.label ?? readerGlobalSettings.pageVerticalAlign}>
          <ThemedSelect label={tr('settings.reader.pageVerticalAlign.title')} value={readerGlobalSettings.pageVerticalAlign} options={readerPageVerticalAlignOptions} onChange={(value) => updateReaderGlobalSetting('pageVerticalAlign', value)} />
        </SettingControl>
        {toggle('chapterStartsNewPage', tr('settings.reader.chapterStartsNewPage.title'), readerGlobalSettings.chapterStartsNewPage)}
        <SettingControl title={tr('settings.reader.longParagraphStrategy.title')} description={tr('settings.reader.longParagraphStrategy.description')} valueText={readerLongParagraphStrategyOptions.find((item) => item.value === readerGlobalSettings.longParagraphStrategy)?.label ?? readerGlobalSettings.longParagraphStrategy}>
          <ThemedSelect label={tr('settings.reader.longParagraphStrategy.title')} value={readerGlobalSettings.longParagraphStrategy} options={readerLongParagraphStrategyOptions} onChange={(value) => updateReaderGlobalSetting('longParagraphStrategy', value)} />
        </SettingControl>
        {slider('pageWidth', tr('settings.reader.pageWidth.title'), readerGlobalSettings.pageWidth, 420, 1200, 10, 'px')}
        {slider('pageGap', tr('settings.reader.pageGap.title'), readerGlobalSettings.pageGap, 0, 96, 2, 'px')}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.typography.title')} description={tr('settings.reader.typography.description')}>
        <SettingControl title={t('reader.fontFamily' as never)} description={tr('settings.reader.fontFamily.description')} valueText={readerGlobalSettings.fontFamily}>
          <ThemedSelect label={t('reader.fontFamily' as never)} value={readerGlobalSettings.fontFamily} options={getReaderFontOptions(t)} onChange={(value) => updateReaderGlobalSetting('fontFamily', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.customFontFamily.title')} description={tr('settings.reader.customFontFamily.description')} valueText={readerGlobalSettings.customFontFamily || tr('settings.common.none')}>
          <SettingsTextInput value={readerGlobalSettings.customFontFamily} placeholder={tr('settings.reader.customFontFamily.placeholder')} onCommit={(value) => updateReaderFontStack({ customFontFamily: value })} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.fontFallbacks.title')} description={tr('settings.reader.fontFallbacks.description')} valueText={readerGlobalSettings.fontFallbacks.join(', ')}>
          <SettingsTextInput value={readerGlobalSettings.fontFallbacks.join(', ')} placeholder="LXGW WenKai, Source Han Serif SC, serif" onCommit={(value) => updateReaderFontStack({ fontFallbacks: parseReaderFontFallbackInput(value) })} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.cjkPunctuation.title')} description={tr('settings.reader.cjkPunctuation.description')} valueText={readerCjkPunctuationOptions.find((item) => item.value === readerGlobalSettings.cjkPunctuationHanging)?.label ?? readerGlobalSettings.cjkPunctuationHanging}>
          <ThemedSelect label={tr('settings.reader.cjkPunctuation.title')} value={readerGlobalSettings.cjkPunctuationHanging} options={readerCjkPunctuationOptions} onChange={(value) => updateReaderGlobalSetting('cjkPunctuationHanging', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.mixedTextSpacing.title')} description={tr('settings.reader.mixedTextSpacing.description')} valueText={readerMixedTextSpacingOptions.find((item) => item.value === readerGlobalSettings.mixedTextSpacing)?.label ?? readerGlobalSettings.mixedTextSpacing}>
          <ThemedSelect label={tr('settings.reader.mixedTextSpacing.title')} value={readerGlobalSettings.mixedTextSpacing} options={readerMixedTextSpacingOptions} onChange={(value) => updateReaderGlobalSetting('mixedTextSpacing', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.fontWeightBoost.title')} description={tr('settings.reader.fontWeightBoost.description')} valueText={readerFontWeightBoostOptions.find((item) => item.value === readerGlobalSettings.fontWeightBoost)?.label ?? readerGlobalSettings.fontWeightBoost}>
          <ThemedSelect label={tr('settings.reader.fontWeightBoost.title')} value={readerGlobalSettings.fontWeightBoost} options={readerFontWeightBoostOptions} onChange={(value) => updateReaderGlobalSetting('fontWeightBoost', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.fontRendering.title')} description={tr('settings.reader.fontRendering.description')} valueText={tr('settings.reader.fontRendering.value', { primaryFont: fontRenderingDiagnostics.primaryFont, fallbackCount: fontRenderingDiagnostics.fallbackCount })}>
          <div className="settings-font-diagnostics">
            <span>{tr('settings.reader.fontRendering.fontStack', { value: fontRenderingDiagnostics.fontFamily })}</span>
            <span>{tr('settings.reader.fontRendering.weightBoost', { value: fontRenderingDiagnostics.fontWeightBoost })}</span>
            <span>{tr('settings.reader.fontRendering.hangingPunctuation', { value: supportText(fontRenderingDiagnostics.supports.hangingPunctuation) })}</span>
            <span>{tr('settings.reader.fontRendering.textSpacingTrim', { value: supportText(fontRenderingDiagnostics.supports.textSpacingTrim) })}</span>
            <span>{tr('settings.reader.fontRendering.textAutospace', { value: supportText(fontRenderingDiagnostics.supports.textAutospace) })}</span>
            <span>{tr('settings.reader.fontRendering.textStroke', { value: supportText(fontRenderingDiagnostics.supports.textStroke) })}</span>
          </div>
        </SettingControl>
        {slider('fontSize', t('reader.fontSize' as never), readerGlobalSettings.fontSize, readerMinimumFontSizes.fontSize, 42, 1, 'px')}
        {slider('letterSpacing', tr('settings.reader.letterSpacing.title'), readerGlobalSettings.letterSpacing, 0, 4, 0.1, 'px')}
        {slider('lineHeight', t('reader.lineHeight' as never), readerGlobalSettings.lineHeight, 1.2, 3, 0.1)}
        {slider('paragraphSpacing', t('reader.paragraphSpacing' as never), readerGlobalSettings.paragraphSpacing, 0, 44, 1, 'px')}
        {slider('firstLineIndent', t('reader.indent' as never), readerGlobalSettings.firstLineIndent, 0, 4, 0.5, 'em')}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.margins.title')} description={tr('settings.reader.margins.description')}>
        {slider('bodyMarginX', tr('settings.reader.bodyMarginX.title'), readerGlobalSettings.bodyMarginX, 24, 120, 1, 'px')}
        {slider('bodyMarginY', tr('settings.reader.bodyMarginY.title'), readerGlobalSettings.bodyMarginY, 24, 120, 1, 'px')}
        {slider('narrowBodyMarginX', tr('settings.reader.narrowBodyMarginX.title'), readerGlobalSettings.narrowBodyMarginX, 12, 80, 1, 'px')}
        {slider('narrowBodyMarginY', tr('settings.reader.narrowBodyMarginY.title'), readerGlobalSettings.narrowBodyMarginY, 12, 90, 1, 'px')}
        {slider('headerMarginX', tr('settings.reader.headerMarginX.title'), readerGlobalSettings.headerMarginX, 0, 80, 1, 'px')}
        {slider('headerMarginY', tr('settings.reader.headerMarginY.title'), readerGlobalSettings.headerMarginY, 0, 80, 1, 'px')}
        {slider('footerMarginX', tr('settings.reader.footerMarginX.title'), readerGlobalSettings.footerMarginX, 0, 80, 1, 'px')}
        {slider('footerMarginY', tr('settings.reader.footerMarginY.title'), readerGlobalSettings.footerMarginY, 0, 80, 1, 'px')}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.titleSection.title')} description={tr('settings.reader.titleSection.description')}>
        <SettingControl title={tr('settings.reader.titleAlign.title')} description={tr('settings.reader.titleAlign.description')} valueText={readerGlobalSettings.titleAlign}>
          <ThemedSelect label={tr('settings.reader.titleAlign.title')} value={readerGlobalSettings.titleAlign} options={readerAlignOptions} onChange={(value) => updateReaderGlobalSetting('titleAlign', value)} />
        </SettingControl>
        {toggle('titleOnlyOnChapterStart', tr('settings.reader.titleOnlyOnChapterStart.title'), readerGlobalSettings.titleOnlyOnChapterStart)}
        <SettingControl title={tr('settings.reader.titleNumberCleanup.title')} description={tr('settings.reader.titleNumberCleanup.description')} valueText={readerTitleNumberCleanupOptions.find((item) => item.value === readerGlobalSettings.titleNumberCleanup)?.label ?? readerGlobalSettings.titleNumberCleanup}>
          <ThemedSelect label={tr('settings.reader.titleNumberCleanup.title')} value={readerGlobalSettings.titleNumberCleanup} options={readerTitleNumberCleanupOptions} onChange={(value) => updateReaderGlobalSetting('titleNumberCleanup', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.titleDecoration.title')} description={tr('settings.reader.titleDecoration.description')} valueText={readerTitleDecorationOptions.find((item) => item.value === readerGlobalSettings.titleDecoration)?.label ?? readerGlobalSettings.titleDecoration}>
          <ThemedSelect label={tr('settings.reader.titleDecoration.title')} value={readerGlobalSettings.titleDecoration} options={readerTitleDecorationOptions} onChange={(value) => updateReaderGlobalSetting('titleDecoration', value)} />
        </SettingControl>
        {slider('titleFontSize', tr('settings.reader.titleFontSize.title'), readerGlobalSettings.titleFontSize, readerMinimumFontSizes.titleFontSize, 56, 1, 'px')}
        {slider('titleMarginTop', tr('settings.reader.titleMarginTop.title'), readerGlobalSettings.titleMarginTop, 0, 80, 1, 'px')}
        {slider('titleMarginBottom', tr('settings.reader.titleMarginBottom.title'), readerGlobalSettings.titleMarginBottom, 0, 80, 1, 'px')}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.headerFooter.title')} description={tr('settings.reader.headerFooter.description')}>
        {toggle('headerVisible', tr('settings.reader.headerVisible.title'), readerGlobalSettings.headerVisible)}
        <SlotControl title={t('reader.headerLeft' as never)} field="headerLeft" />
        <SlotControl title={t('reader.headerCenter' as never)} field="headerCenter" />
        <SlotControl title={t('reader.headerRight' as never)} field="headerRight" />
        {toggle('footerVisible', tr('settings.reader.footerVisible.title'), readerGlobalSettings.footerVisible)}
        <SlotControl title={t('reader.footerLeft' as never)} field="footerLeft" />
        <SlotControl title={t('reader.footerCenter' as never)} field="footerCenter" />
        <SlotControl title={t('reader.footerRight' as never)} field="footerRight" />
        <SettingControl title={tr('settings.reader.headerFooterCustomFormat.title')} description={tr('settings.reader.headerFooterCustomFormat.description')}>
          <SettingsTextInput value={readerGlobalSettings.headerFooterCustomFormat} onCommit={(value) => updateReaderGlobalSetting('headerFooterCustomFormat', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.timeFormat.title')} description={tr('settings.reader.timeFormat.description')} valueText={readerHeaderFooterTimeFormatOptions.find((item) => item.value === readerGlobalSettings.headerFooterTimeFormat)?.label ?? readerGlobalSettings.headerFooterTimeFormat}>
          <ThemedSelect label={tr('settings.reader.timeFormat.title')} value={readerGlobalSettings.headerFooterTimeFormat} options={readerHeaderFooterTimeFormatOptions} onChange={(value) => updateReaderGlobalSetting('headerFooterTimeFormat', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.progressFormat.title')} description={tr('settings.reader.progressFormat.description')} valueText={readerHeaderFooterProgressFormatOptions.find((item) => item.value === readerGlobalSettings.headerFooterProgressFormat)?.label ?? readerGlobalSettings.headerFooterProgressFormat}>
          <ThemedSelect label={tr('settings.reader.progressFormat.title')} value={readerGlobalSettings.headerFooterProgressFormat} options={readerHeaderFooterProgressFormatOptions} onChange={(value) => updateReaderGlobalSetting('headerFooterProgressFormat', value)} />
        </SettingControl>
        {slider('headerFooterFontSize', tr('settings.reader.headerFooterFontSize.title'), readerGlobalSettings.headerFooterFontSize, readerMinimumFontSizes.headerFooterFontSize, 18, 1, 'px')}
        {slider('headerFooterOpacity', tr('settings.reader.headerFooterOpacity.title'), readerGlobalSettings.headerFooterOpacity, 0.35, 1, 0.05)}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.pageTurn.title')} description={tr('settings.reader.pageTurn.description')}>
        <SettingControl title={t('reader.animation' as never)} description={tr('settings.reader.animation.description')} valueText={readerGlobalSettings.pageAnimation}>
          <ThemedSelect label={t('reader.animation' as never)} value={readerGlobalSettings.pageAnimation} options={readerAnimationOptions} onChange={(value) => updateReaderGlobalSetting('pageAnimation', value)} />
        </SettingControl>
        {toggle('wheelPaging', tr('settings.reader.wheelPaging.title'), readerGlobalSettings.wheelPaging)}
        {toggle('touchpadNaturalScroll', tr('settings.reader.touchpadNaturalScroll.title'), readerGlobalSettings.touchpadNaturalScroll)}
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.state.title')} description={tr('settings.reader.state.description')}>
        <SettingControl title={tr('settings.reader.autoSaveReaderPosition.title')} description={tr('settings.reader.autoSaveReaderPosition.description')} valueText={onOff(extendedSettings.autoSaveReaderPosition)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoSaveReaderPosition} onChange={(event) => updateExtendedSetting('autoSaveReaderPosition', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoSaveReaderPosition)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerPositionSaveDebounceMs.title')} description={tr('settings.reader.readerPositionSaveDebounceMs.description')} valueText={`${extendedSettings.readerPositionSaveDebounceMs} ms`}>
          <SettingsNumberInput min={100} max={5000} step={100} value={extendedSettings.readerPositionSaveDebounceMs} onCommit={(value) => updateExtendedSetting('readerPositionSaveDebounceMs', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.multiWindowReaderSync.title')} description={tr('settings.reader.multiWindowReaderSync.description')} valueText={onOff(extendedSettings.multiWindowReaderSync)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.multiWindowReaderSync} onChange={(event) => updateExtendedSetting('multiWindowReaderSync', event.target.checked)} /><span>{enabledDisabled(extendedSettings.multiWindowReaderSync)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.booksOpenInStandaloneReader.title')} description={tr('settings.reader.booksOpenInStandaloneReader.description')} valueText={onOff(extendedSettings.booksOpenInStandaloneReader)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.booksOpenInStandaloneReader} onChange={(event) => updateExtendedSetting('booksOpenInStandaloneReader', event.target.checked)} /><span>{enabledDisabled(extendedSettings.booksOpenInStandaloneReader)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.multiWindowConflictStrategy.title')} description={tr('settings.reader.multiWindowConflictStrategy.description')} valueText={multiWindowConflictStrategyOptions.find((item) => item.value === extendedSettings.multiWindowConflictStrategy)?.label}>
          <ThemedSelect label={tr('settings.reader.multiWindowConflictStrategy.title')} value={extendedSettings.multiWindowConflictStrategy} options={multiWindowConflictStrategyOptions} onChange={(value) => updateExtendedSetting('multiWindowConflictStrategy', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerProgressMode.title')} description={tr('settings.reader.readerProgressMode.description')} valueText={readerProgressModeOptions.find((item) => item.value === extendedSettings.readerProgressMode)?.label}>
          <ThemedSelect label={tr('settings.reader.readerProgressMode.title')} value={extendedSettings.readerProgressMode} options={readerProgressModeOptions} onChange={(value) => updateExtendedSetting('readerProgressMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerHistoryStackLimit.title')} description={tr('settings.reader.readerHistoryStackLimit.description')} valueText={extendedSettings.readerHistoryStackLimit}>
          <SettingsNumberInput min={1} max={200} value={extendedSettings.readerHistoryStackLimit} onCommit={(value) => updateExtendedSetting('readerHistoryStackLimit', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.dailyGoal.title')} description={tr('settings.reader.dailyGoal.description')} valueText={onOff(extendedSettings.readerDailyGoalEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerDailyGoalEnabled} onChange={(event) => updateExtendedSetting('readerDailyGoalEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.readerDailyGoalEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerDailyPagesGoal.title')} description={tr('settings.reader.readerDailyPagesGoal.description')} valueText={extendedSettings.readerDailyPagesGoal}>
          <SettingsNumberInput min={0} max={1000} value={extendedSettings.readerDailyPagesGoal} disabled={!extendedSettings.readerDailyGoalEnabled} onCommit={(value) => updateExtendedSetting('readerDailyPagesGoal', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerDailyMinutesGoal.title')} description={tr('settings.reader.readerDailyMinutesGoal.description')} valueText={extendedSettings.readerDailyMinutesGoal}>
          <SettingsNumberInput min={0} max={1440} value={extendedSettings.readerDailyMinutesGoal} disabled={!extendedSettings.readerDailyGoalEnabled} onCommit={(value) => updateExtendedSetting('readerDailyMinutesGoal', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerDailyChaptersGoal.title')} description={tr('settings.reader.readerDailyChaptersGoal.description')} valueText={extendedSettings.readerDailyChaptersGoal}>
          <SettingsNumberInput min={0} max={200} value={extendedSettings.readerDailyChaptersGoal} disabled={!extendedSettings.readerDailyGoalEnabled} onCommit={(value) => updateExtendedSetting('readerDailyChaptersGoal', value)} />
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.privacyCache.title')} description={tr('settings.reader.privacyCache.description')} advanced forceOpen={highlightedSetting === 'reader-memory-warning'}>
        {toggle('preserveBlankLines', t('reader.preserveBlankLines' as never), readerGlobalSettings.preserveBlankLines)}
        {toggle('privacyMode', tr('settings.reader.privacyMode.title'), readerGlobalSettings.privacyMode)}
        {toggle('encryptSensitiveReaderData', tr('settings.reader.encryptSensitiveReaderData.title'), readerGlobalSettings.encryptSensitiveReaderData)}
        <SettingControl title={tr('settings.reader.largeBookPerformanceMode.title')} description={tr('settings.reader.largeBookPerformanceMode.description')} valueText={onOff(extendedSettings.largeBookPerformanceMode)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.largeBookPerformanceMode} onChange={(event) => updateExtendedSetting('largeBookPerformanceMode', event.target.checked)} /><span>{enabledDisabled(extendedSettings.largeBookPerformanceMode)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerPageCacheEnabled.title')} description={tr('settings.reader.readerPageCacheEnabled.description')} valueText={onOff(extendedSettings.readerPageCacheEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerPageCacheEnabled} onChange={(event) => updateExtendedSetting('readerPageCacheEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.readerPageCacheEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerPageMeasureCacheLimit.title')} description={tr('settings.reader.readerPageMeasureCacheLimit.description')} valueText={extendedSettings.readerPageMeasureCacheLimit}>
          <SettingsNumberInput min={1} max={96} value={extendedSettings.readerPageMeasureCacheLimit} onCommit={(value) => updateExtendedSetting('readerPageMeasureCacheLimit', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerFpsDiagnosticsEnabled.title')} description={tr('settings.reader.readerFpsDiagnosticsEnabled.description')} valueText={onOff(extendedSettings.readerFpsDiagnosticsEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerFpsDiagnosticsEnabled} onChange={(event) => updateExtendedSetting('readerFpsDiagnosticsEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.readerFpsDiagnosticsEnabled)}</span></label>
        </SettingControl>
        <SettingControl refNode={readerMemoryWarningSettingRef} className={highlightedSetting === 'reader-memory-warning' ? 'settings-target-highlight' : ''} title={tr('settings.reader.readerMemoryWarning.title')} description={tr('settings.reader.readerMemoryWarning.description')} valueText={extendedSettings.readerMemoryWarningEnabled ? `${extendedSettings.readerMemoryWarningThresholdMb} MB` : tr('settings.common.off')}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerMemoryWarningEnabled} onChange={(event) => updateExtendedSetting('readerMemoryWarningEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.readerMemoryWarningEnabled)}</span></label>
          <SettingsNumberInput min={64} max={4096} step={64} value={extendedSettings.readerMemoryWarningThresholdMb} disabled={!extendedSettings.readerMemoryWarningEnabled} onCommit={(value) => updateExtendedSetting('readerMemoryWarningThresholdMb', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerPageCacheLimit.title')} description={tr('settings.reader.readerPageCacheLimit.description')} valueText={extendedSettings.readerPageCacheLimit}>
          <SettingsNumberInput min={0} max={200} value={extendedSettings.readerPageCacheLimit} onCommit={(value) => updateExtendedSetting('readerPageCacheLimit', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerPagePreheatEnabled.title')} description={tr('settings.reader.readerPagePreheatEnabled.description')} valueText={onOff(extendedSettings.readerPagePreheatEnabled)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerPagePreheatEnabled} onChange={(event) => updateExtendedSetting('readerPagePreheatEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.readerPagePreheatEnabled)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.reader.readerPagePreheatRange.title')} description={tr('settings.reader.readerPagePreheatRange.description')} valueText={extendedSettings.readerPagePreheatRange}>
          <SettingsNumberInput min={0} max={5} value={extendedSettings.readerPagePreheatRange} onCommit={(value) => updateExtendedSetting('readerPagePreheatRange', value)} />
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.reader.importExport.title')} description={tr('settings.reader.importExport.description')} advanced>
        <SettingControl title={tr('settings.reader.presetImportExport.title')} description={tr('settings.reader.presetImportExport.description')} valueText={customPresetCountText}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={exportReaderCustomPresetsFromSettings} disabled={!readerCustomPresets.length}>{tr('settings.reader.customPreset.export')}</button>
            <button className="ghost-btn small" type="button" onClick={() => readerPresetImportInputRef.current?.click()}>{tr('settings.reader.customPreset.import')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.reader.diagnostics.title')} description={tr('settings.reader.diagnostics.description')}>
          <div className="settings-inline-actions">
            <button className="ghost-btn small" type="button" onClick={exportReaderDiagnosticsFromSettings}>{tr('settings.reader.diagnostics.export')}</button>
            <button className="ghost-btn small" type="button" onClick={copyChapterParseDiagnostics}>{tr('settings.reader.diagnostics.copyChapter')}</button>
          </div>
        </SettingControl>
      </SettingsSection>
    </>
  );
}

import { useState, type ChangeEvent, type RefObject } from 'react';
import { BookMindIcon } from '../components/BookMindIcon';
import { ThemedSelect } from './SettingsSelect';
import { matchReaderChapterRegexRule, previewReaderCompactChapterSplit, type ReaderChapterDiagnostics } from '../features/reader-core/readerModel';
import { defaultChapterRules, type ChapterRegexRuleDraft, type ChapterRuleDraft, type ExtendedSettings, type TocTitleGroupRuleDraft } from '../services/settingsCenterService';
import type { Translator } from '../i18n';
import { ReadonlyPill, SettingControl, SettingsNumberInput, SettingsSection, SettingsTextarea, SettingsTextInput } from './SettingsPageScaffold';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type SettingsChapterPanelProps = {
  t: Translator;
  chapterRules: ChapterRuleDraft;
  extendedSettings: ExtendedSettings;
  tocRuleChangeRebuildModeOptions: SelectOption<ExtendedSettings['tocRuleChangeRebuildMode']>[];
  paragraphModeOptions: SelectOption<ChapterRuleDraft['paragraphMode']>[];
  bookTitleBracketModeOptions: SelectOption<ChapterRuleDraft['bookTitleBracketMode']>[];
  chapterRegexTestInput: string;
  setChapterRegexTestInput: (value: string) => void;
  compactSplitPreviewInput: string;
  setCompactSplitPreviewInput: (value: string) => void;
  txtCleanupPreviewInput: string;
  setTxtCleanupPreviewInput: (value: string) => void;
  txtCleanupPreviewOutput: string;
  chapterDiagnosticsSampleInput: string;
  setChapterDiagnosticsSampleInput: (value: string) => void;
  chapterDiagnosticsCleanedContent: string;
  chapterParseDiagnostics: ReaderChapterDiagnostics;
  customCleanupRuleImportInputRef: RefObject<HTMLInputElement | null>;
  updateExtendedSetting: <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => void;
  updateChapterRule: <K extends keyof ChapterRuleDraft>(key: K, value: ChapterRuleDraft[K]) => void;
  updateTocTitleGroupRule: (ruleId: string, patch: Partial<TocTitleGroupRuleDraft>) => void;
  moveTocTitleGroupRule: (ruleId: string, direction: -1 | 1) => void;
  removeTocTitleGroupRule: (ruleId: string) => void;
  addTocTitleGroupRule: () => void;
  updateChapterRegexRule: (ruleId: string, patch: Partial<ChapterRegexRuleDraft>) => void;
  moveChapterRegexRule: (ruleId: string, direction: -1 | 1) => void;
  removeChapterRegexRule: (ruleId: string) => void;
  addChapterRegexRule: () => void;
  exportCustomCleanupRulesFromSettings: () => void;
  importCustomCleanupRulesFromSettings: (file: File) => Promise<void>;
  updateCustomCleanupRule: (ruleId: string, patch: Partial<ChapterRuleDraft['customCleanupRules'][number]>) => void;
  moveCustomCleanupRule: (ruleId: string, direction: -1 | 1) => void;
  removeCustomCleanupRule: (ruleId: string) => void;
  addCustomCleanupRule: () => void;
  copyChapterParseDiagnostics: () => void;
  searchText?: string;
};

export function SettingsChapterPanel({
  t,
  chapterRules,
  extendedSettings,
  tocRuleChangeRebuildModeOptions,
  paragraphModeOptions,
  bookTitleBracketModeOptions,
  chapterRegexTestInput,
  setChapterRegexTestInput,
  compactSplitPreviewInput,
  setCompactSplitPreviewInput,
  txtCleanupPreviewInput,
  setTxtCleanupPreviewInput,
  txtCleanupPreviewOutput,
  chapterDiagnosticsSampleInput,
  setChapterDiagnosticsSampleInput,
  chapterDiagnosticsCleanedContent,
  chapterParseDiagnostics,
  customCleanupRuleImportInputRef,
  updateExtendedSetting,
  updateChapterRule,
  updateTocTitleGroupRule,
  moveTocTitleGroupRule,
  removeTocTitleGroupRule,
  addTocTitleGroupRule,
  updateChapterRegexRule,
  moveChapterRegexRule,
  removeChapterRegexRule,
  addChapterRegexRule,
  exportCustomCleanupRulesFromSettings,
  importCustomCleanupRulesFromSettings,
  updateCustomCleanupRule,
  moveCustomCleanupRule,
  removeCustomCleanupRule,
  addCustomCleanupRule,
  copyChapterParseDiagnostics,
}: SettingsChapterPanelProps) {
  const [activeRuleGroup, setActiveRuleGroup] = useState<'chapters' | 'cleanup'>('chapters');
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (checked: boolean) => checked ? tr('settings.common.on') : tr('settings.common.off');
  const enabledDisabled = (checked: boolean) => checked ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const enabledText = (checked: boolean) => checked ? tr('settings.chapter.state.enabled') : tr('settings.chapter.state.disabled');
  const countText = (count: number) => tr('settings.chapter.count.items', { count });
  const charsText = (count: number) => tr('settings.chapter.count.chars', { count });
  const noValue = tr('settings.common.none');
  const showChapterGroup = activeRuleGroup === 'chapters';
  const showCleanupGroup = activeRuleGroup === 'cleanup';

  const customCleanupModeOptions = [
    { value: 'remove-line' as const, label: tr('settings.chapter.cleanup.mode.removeLine') },
    { value: 'replace' as const, label: tr('settings.chapter.cleanup.mode.replace') },
  ];

  function extendedToggle<K extends keyof ExtendedSettings>(key: K, title: string, checked: boolean) {
    return (
      <SettingControl title={title} description={tr('settings.chapter.extendedToggle.description')} valueText={onOff(checked)}>
        <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => updateExtendedSetting(key, event.target.checked as ExtendedSettings[K])} /><span>{enabledDisabled(checked)}</span></label>
      </SettingControl>
    );
  }

  function chapterToggle<K extends keyof ChapterRuleDraft>(key: K, title: string) {
    const checked = Boolean(chapterRules[key]);
    return (
      <SettingControl title={title} description={tr('settings.chapter.ruleToggle.description')} valueText={onOff(checked)}>
        <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => updateChapterRule(key, event.target.checked as ChapterRuleDraft[K])} /><span>{enabledDisabled(checked)}</span></label>
      </SettingControl>
    );
  }

  function chapterNumber<K extends keyof ChapterRuleDraft>(key: K, title: string, min: number, max: number) {
    const value = Number(chapterRules[key]);
    return (
      <SettingControl title={title} description={tr('settings.chapter.number.description', { min, max })} valueText={String(value)}>
        <SettingsNumberInput min={min} max={max} value={value} onCommit={(nextValue) => updateChapterRule(key, Number(nextValue) as ChapterRuleDraft[K])} />
      </SettingControl>
    );
  }

  return (
    <>
      <div className="settings-chapter-group-switch" role="tablist" aria-label={tr('settings.chapter.groupSwitch.aria')}>
        <button className={activeRuleGroup === 'chapters' ? 'active' : ''} type="button" role="tab" aria-selected={activeRuleGroup === 'chapters'} onClick={() => setActiveRuleGroup('chapters')}>
          <span>{tr('settings.chapter.groupSwitch.chapters')}</span>
          <small>{tr('settings.chapter.groupSwitch.chapterCount', { count: chapterRules.customRegexRules.length })}</small>
        </button>
        <button className={activeRuleGroup === 'cleanup' ? 'active' : ''} type="button" role="tab" aria-selected={activeRuleGroup === 'cleanup'} onClick={() => setActiveRuleGroup('cleanup')}>
          <span>{tr('settings.chapter.groupSwitch.cleanup')}</span>
          <small>{tr('settings.chapter.groupSwitch.cleanupCount', { count: chapterRules.customCleanupRules.length })}</small>
        </button>
      </div>
      {showChapterGroup ? <>
      <SettingsSection title={tr('settings.chapter.master.title')} description={tr('settings.chapter.master.description')}>
        {chapterToggle('enabled', tr('settings.chapter.enabled.title'))}
        <SettingControl title={tr('settings.chapter.autoParseTocOnImport.title')} description={tr('settings.chapter.autoParseTocOnImport.description')} valueText={onOff(extendedSettings.autoParseTocOnImport)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoParseTocOnImport} onChange={(event) => updateExtendedSetting('autoParseTocOnImport', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoParseTocOnImport)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.chapter.autoRebuildTocWhenEmpty.title')} description={tr('settings.chapter.autoRebuildTocWhenEmpty.description')} valueText={onOff(extendedSettings.autoRebuildTocWhenEmpty)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoRebuildTocWhenEmpty} onChange={(event) => updateExtendedSetting('autoRebuildTocWhenEmpty', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoRebuildTocWhenEmpty)}</span></label>
        </SettingControl>
        <SettingControl title={tr('settings.chapter.tocRuleChangeRebuildMode.title')} description={tr('settings.chapter.tocRuleChangeRebuildMode.description')} valueText={tocRuleChangeRebuildModeOptions.find((item) => item.value === extendedSettings.tocRuleChangeRebuildMode)?.label}>
          <ThemedSelect label={tr('settings.chapter.tocRuleChangeRebuildMode.title')} value={extendedSettings.tocRuleChangeRebuildMode} options={tocRuleChangeRebuildModeOptions} onChange={(value) => updateExtendedSetting('tocRuleChangeRebuildMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.chapter.previewTocRebuildDiff.title')} description={tr('settings.chapter.previewTocRebuildDiff.description')} valueText={onOff(extendedSettings.previewTocRebuildDiff)}>
          <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.previewTocRebuildDiff} onChange={(event) => updateExtendedSetting('previewTocRebuildDiff', event.target.checked)} /><span>{enabledDisabled(extendedSettings.previewTocRebuildDiff)}</span></label>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.chapter.tocGrouping.title')} description={tr('settings.chapter.tocGrouping.description')}>
        {extendedToggle('tocShowVolumeHierarchy', tr('settings.chapter.tocShowVolumeHierarchy.title'), extendedSettings.tocShowVolumeHierarchy)}
        {extendedToggle('tocVolumeClickable', tr('settings.chapter.tocVolumeClickable.title'), extendedSettings.tocVolumeClickable)}
        {extendedToggle('tocShowChapterNumbers', tr('settings.chapter.tocShowChapterNumbers.title'), extendedSettings.tocShowChapterNumbers)}
        {extendedToggle('tocCollapseVolumes', tr('settings.chapter.tocCollapseVolumes.title'), extendedSettings.tocCollapseVolumes)}
        {extendedToggle('tocExpandActiveVolume', tr('settings.chapter.tocExpandActiveVolume.title'), extendedSettings.tocExpandActiveVolume)}
        {extendedToggle('tocShowChapterWordCount', tr('settings.chapter.tocShowChapterWordCount.title'), extendedSettings.tocShowChapterWordCount)}
        {extendedToggle('tocShowChapterProgress', tr('settings.chapter.tocShowChapterProgress.title'), extendedSettings.tocShowChapterProgress)}
        {extendedToggle('tocTitleGroupingEnabled', tr('settings.chapter.tocTitleGroupingEnabled.title'), extendedSettings.tocTitleGroupingEnabled)}
        <SettingControl title={tr('settings.chapter.tocTitleGroupKeywords.title')} description={tr('settings.chapter.tocTitleGroupKeywords.description')} valueText={enabledDisabled(extendedSettings.tocTitleGroupingEnabled)}>
          <SettingsTextarea compact value={extendedSettings.tocTitleGroupKeywords} placeholder={tr('settings.chapter.tocTitleGroupKeywords.placeholder')} disabled={!extendedSettings.tocTitleGroupingEnabled} onCommit={(value) => updateExtendedSetting('tocTitleGroupKeywords', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.chapter.tocTitleGroupRules.title')} description={tr('settings.chapter.tocTitleGroupRules.description')} valueText={countText(extendedSettings.tocTitleGroupRules.length)}>
          <div className="settings-regex-rule-list">
            {extendedSettings.tocTitleGroupRules.map((rule, index) => {
              const regexError = validateRegexPattern(rule.pattern);
              return (
                <article className={`settings-rule-card${rule.enabled ? '' : ' disabled'}`} key={rule.id}>
                  <header className="settings-rule-card-header">
                    <span className="settings-rule-priority">{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{rule.name || tr('settings.chapter.ruleCard.untitled')}</strong><small>{tr('settings.chapter.ruleCard.tocGroupingPattern')}</small></div>
                    <label className="settings-toggle"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateTocTitleGroupRule(rule.id, { enabled: event.target.checked })} /><span>{enabledText(rule.enabled)}</span></label>
                    <RuleCardActions index={index} total={extendedSettings.tocTitleGroupRules.length} onMove={(direction) => moveTocTitleGroupRule(rule.id, direction)} onDelete={() => removeTocTitleGroupRule(rule.id)} tr={tr} />
                  </header>
                  <div className="settings-rule-card-fields three-columns">
                    <label className="settings-rule-field"><span>{tr('settings.chapter.ruleCard.name')}</span><SettingsTextInput value={rule.name} ariaLabel={tr('settings.chapter.tocRule.nameAria')} onCommit={(value) => updateTocTitleGroupRule(rule.id, { name: value })} /></label>
                    <label className="settings-rule-field"><span>{tr('settings.chapter.ruleCard.groupName')}</span><SettingsTextInput value={rule.groupName} ariaLabel={tr('settings.chapter.tocRule.groupNameAria')} placeholder={tr('settings.chapter.tocRule.groupNamePlaceholder')} onCommit={(value) => updateTocTitleGroupRule(rule.id, { groupName: value })} /></label>
                    <RegexExpressionField pattern={rule.pattern} error={regexError} flags="i" placeholder={tr('settings.chapter.ruleCard.tocExpressionPlaceholder')} label={tr('settings.chapter.ruleCard.expression')} validText={tr('settings.chapter.ruleCard.valid')} onCommit={(value) => updateTocTitleGroupRule(rule.id, { pattern: value })} />
                  </div>
                </article>
              );
            })}
            {!extendedSettings.tocTitleGroupRules.length ? <ReadonlyPill text={tr('settings.chapter.tocTitleGroupRules.empty')} /> : null}
            <button className="settings-rule-add-button" type="button" onClick={addTocTitleGroupRule}><BookMindIcon name="plus" /><span>{tr('settings.chapter.tocTitleGroupRules.add')}</span></button>
          </div>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.chapter.manualToc.title')} description={tr('settings.chapter.manualToc.description')}>
        {extendedToggle('tocAllowRename', tr('settings.chapter.tocAllowRename.title'), extendedSettings.tocAllowRename)}
        {extendedToggle('tocAllowHide', tr('settings.chapter.tocAllowHide.title'), extendedSettings.tocAllowHide)}
        {extendedToggle('tocAllowUnhide', tr('settings.chapter.tocAllowUnhide.title'), extendedSettings.tocAllowUnhide)}
        {extendedToggle('tocAllowSplit', tr('settings.chapter.tocAllowSplit.title'), extendedSettings.tocAllowSplit)}
        {extendedToggle('tocAllowMergeNext', tr('settings.chapter.tocAllowMergeNext.title'), extendedSettings.tocAllowMergeNext)}
        {extendedToggle('tocAllowRestoreDefault', tr('settings.chapter.tocAllowRestoreDefault.title'), extendedSettings.tocAllowRestoreDefault)}
        {extendedToggle('tocAllowUndoRedo', tr('settings.chapter.tocAllowUndoRedo.title'), extendedSettings.tocAllowUndoRedo)}
      </SettingsSection>
      <SettingsSection title={tr('settings.chapter.headingRules.title')} description={tr('settings.chapter.headingRules.description')}>
        {chapterNumber('maxHeadingLength', tr('settings.chapter.maxHeadingLength.title'), 8, 80)}
        {chapterToggle('enableChineseChapter', tr('settings.chapter.enableChineseChapter.title'))}
        {chapterToggle('enableChineseVolume', tr('settings.chapter.enableChineseVolume.title'))}
        {chapterToggle('enableSpecialHeadings', tr('settings.chapter.enableSpecialHeadings.title'))}
        {chapterToggle('enableEnglishChapter', tr('settings.chapter.enableEnglishChapter.title'))}
        {chapterNumber('minHeadingConfidence', tr('settings.chapter.minHeadingConfidence.title'), 0, 100)}
        {chapterToggle('autoIgnoreAdHeadings', tr('settings.chapter.autoIgnoreAdHeadings.title'))}
        {chapterToggle('autoIgnoreRepeatedTocHeadings', tr('settings.chapter.autoIgnoreRepeatedTocHeadings.title'))}
        <SettingControl title={tr('settings.chapter.forbiddenHeadingPunctuation.title')} description={tr('settings.chapter.forbiddenHeadingPunctuation.description')} valueText={chapterRules.forbiddenHeadingPunctuation || noValue}>
          <div className="settings-inline-row">
            <SettingsTextInput value={chapterRules.forbiddenHeadingPunctuation} placeholder=".;:,;" onCommit={(value) => updateChapterRule('forbiddenHeadingPunctuation', value)} />
            <button className="ghost-btn small" type="button" onClick={() => updateChapterRule('forbiddenHeadingPunctuation', defaultChapterRules.forbiddenHeadingPunctuation)}>{tr('settings.common.restoreDefault')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.chapter.forbiddenHeadingStartChars.title')} description={tr('settings.chapter.forbiddenHeadingStartChars.description')} valueText={chapterRules.forbiddenHeadingStartChars || noValue}>
          <div className="settings-inline-row">
            <SettingsTextInput value={chapterRules.forbiddenHeadingStartChars} placeholder="([{" onCommit={(value) => updateChapterRule('forbiddenHeadingStartChars', value)} />
            <button className="ghost-btn small" type="button" onClick={() => updateChapterRule('forbiddenHeadingStartChars', defaultChapterRules.forbiddenHeadingStartChars)}>{tr('settings.common.restoreDefault')}</button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.chapter.customRegexRules.title')} description={tr('settings.chapter.customRegexRules.description')} valueText={countText(chapterRules.customRegexRules.length)}>
          <div className="settings-regex-rule-list">
            {chapterRules.customRegexRules.map((rule, index) => {
              const regexError = validateRegexPattern(rule.pattern);
              return (
                <article className={`settings-rule-card${rule.enabled ? '' : ' disabled'}`} key={rule.id}>
                  <header className="settings-rule-card-header">
                    <span className="settings-rule-priority">{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{rule.name || tr('settings.chapter.ruleCard.untitled')}</strong><small>{tr('settings.chapter.ruleCard.chapterPattern')}</small></div>
                    <label className="settings-toggle"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateChapterRegexRule(rule.id, { enabled: event.target.checked })} /><span>{enabledText(rule.enabled)}</span></label>
                    <RuleCardActions index={index} total={chapterRules.customRegexRules.length} onMove={(direction) => moveChapterRegexRule(rule.id, direction)} onDelete={() => removeChapterRegexRule(rule.id)} tr={tr} />
                  </header>
                  <div className="settings-rule-card-fields">
                    <label className="settings-rule-field"><span>{tr('settings.chapter.ruleCard.name')}</span><SettingsTextInput value={rule.name} ariaLabel={tr('settings.chapter.regexRule.nameAria')} onCommit={(value) => updateChapterRegexRule(rule.id, { name: value })} /></label>
                    <RegexExpressionField pattern={rule.pattern} error={regexError} placeholder={tr('settings.chapter.ruleCard.chapterExpressionPlaceholder')} label={tr('settings.chapter.ruleCard.expression')} validText={tr('settings.chapter.ruleCard.valid')} onCommit={(value) => updateChapterRegexRule(rule.id, { pattern: value })} />
                  </div>
                </article>
              );
            })}
            {!chapterRules.customRegexRules.length ? <ReadonlyPill text={tr('settings.chapter.customRegexRules.empty')} /> : null}
            <button className="settings-rule-add-button" type="button" onClick={addChapterRegexRule}><BookMindIcon name="plus" /><span>{tr('settings.chapter.customRegexRules.add')}</span></button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.chapter.regexTest.title')} description={tr('settings.chapter.regexTest.description')} valueText={matchReaderChapterRegexRule(chapterRegexTestInput, { customRegexRules: chapterRules.customRegexRules })?.name ?? tr('settings.chapter.regexTest.noMatch')}>
          <input className="settings-inline-input" value={chapterRegexTestInput} placeholder="Scene 12: Arrival" onChange={(event) => setChapterRegexTestInput(event.target.value)} />
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.chapter.paragraphRules.title')} description={tr('settings.chapter.paragraphRules.description')}>
        <SettingControl title={tr('settings.chapter.paragraphMode.title')} description={tr('settings.chapter.paragraphMode.description')} valueText={paragraphModeOptions.find((item) => item.value === chapterRules.paragraphMode)?.label}>
          <ThemedSelect label={tr('settings.chapter.paragraphMode.title')} value={chapterRules.paragraphMode} options={paragraphModeOptions} onChange={(value) => updateChapterRule('paragraphMode', value)} />
        </SettingControl>
        {chapterNumber('shortLineMergeThreshold', tr('settings.chapter.shortLineMergeThreshold.title'), 2, 80)}
        {chapterNumber('longParagraphSliceSize', tr('settings.chapter.longParagraphSliceSize.title'), 200, 5000)}
        {chapterToggle('enableCompactSplit', tr('settings.chapter.enableCompactSplit.title'))}
        {chapterNumber('compactHeadingSuffixLength', tr('settings.chapter.compactHeadingSuffixLength.title'), 0, 40)}
        {chapterToggle('preserveCompactPrefixText', tr('settings.chapter.preserveCompactPrefixText.title'))}
        <SettingControl title={tr('settings.chapter.compactSplitPreview.title')} description={tr('settings.chapter.compactSplitPreview.description')} valueText={countText(previewReaderCompactChapterSplit(compactSplitPreviewInput, chapterRules).length)}>
          <div className="settings-regex-rule-list">
            <input className="settings-inline-input" value={compactSplitPreviewInput} placeholder={tr('settings.chapter.compactSplitPreview.placeholder')} onChange={(event) => setCompactSplitPreviewInput(event.target.value)} />
            <div className="settings-import-preview">
              {previewReaderCompactChapterSplit(compactSplitPreviewInput, chapterRules).map((part, index) => <code key={`${part}-${index}`}>{index + 1}. {part}</code>)}
            </div>
          </div>
        </SettingControl>
      </SettingsSection>
      </> : null}
      {showCleanupGroup ? <>
      <SettingsSection title={tr('settings.chapter.cleanup.title')} description={tr('settings.chapter.cleanup.description')}>
        {chapterToggle('removeAds', tr('settings.chapter.removeAds.title'))}
        <SettingControl title={tr('settings.chapter.adKeywords.title')} description={tr('settings.chapter.adKeywords.description')} valueText={chapterRules.adKeywords || noValue}>
          <SettingsTextarea compact value={chapterRules.adKeywords} placeholder={tr('settings.chapter.adKeywords.placeholder')} onCommit={(value) => updateChapterRule('adKeywords', value)} />
        </SettingControl>
        {chapterToggle('removeAdUrls', tr('settings.chapter.removeAdUrls.title'))}
        {chapterToggle('removePaginationNoise', tr('settings.chapter.removePaginationNoise.title'))}
        {chapterToggle('preserveOriginalBackup', tr('settings.chapter.preserveOriginalBackup.title'))}
        {chapterToggle('normalizeBlankLines', tr('settings.chapter.normalizeBlankLines.title'))}
        {chapterToggle('trimTrailingWhitespace', tr('settings.chapter.trimTrailingWhitespace.title'))}
        {chapterToggle('normalizeFullWidthSpaces', tr('settings.chapter.normalizeFullWidthSpaces.title'))}
        <SettingControl title={tr('settings.chapter.customCleanupRules.title')} description={tr('settings.chapter.customCleanupRules.description')} valueText={countText(chapterRules.customCleanupRules.length)}>
          <div className="settings-regex-rule-list settings-custom-cleanup-rule-list">
            <div className="settings-inline-actions">
              <button className="ghost-btn small" type="button" onClick={exportCustomCleanupRulesFromSettings} disabled={!chapterRules.customCleanupRules.length}>{tr('settings.chapter.customCleanupRules.export')}</button>
              <button className="ghost-btn small" type="button" onClick={() => customCleanupRuleImportInputRef.current?.click()}>{tr('settings.chapter.customCleanupRules.import')}</button>
              <input ref={customCleanupRuleImportInputRef} type="file" accept="application/json,.json" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.currentTarget.files?.[0]; if (file) void importCustomCleanupRulesFromSettings(file); event.currentTarget.value = ''; }} />
            </div>
            <div className="settings-custom-cleanup-rule-scroll">
              {chapterRules.customCleanupRules.map((rule, index) => {
                const regexError = validateRegexPattern(rule.pattern);
                return (
                  <article className={`settings-rule-card cleanup${rule.enabled ? '' : ' disabled'}`} key={rule.id}>
                    <header className="settings-rule-card-header">
                      <span className="settings-rule-priority">{String(index + 1).padStart(2, '0')}</span>
                      <div><strong>{rule.name || tr('settings.chapter.ruleCard.untitled')}</strong><small>{customCleanupModeOptions.find((item) => item.value === rule.mode)?.label}</small></div>
                      <label className="settings-toggle"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateCustomCleanupRule(rule.id, { enabled: event.target.checked })} /><span>{enabledText(rule.enabled)}</span></label>
                      <RuleCardActions index={index} total={chapterRules.customCleanupRules.length} onMove={(direction) => moveCustomCleanupRule(rule.id, direction)} onDelete={() => removeCustomCleanupRule(rule.id)} tr={tr} />
                    </header>
                    <div className="settings-rule-card-fields cleanup-fields">
                      <label className="settings-rule-field"><span>{tr('settings.chapter.ruleCard.name')}</span><SettingsTextInput value={rule.name} ariaLabel={tr('settings.chapter.cleanup.ruleNameAria')} onCommit={(value) => updateCustomCleanupRule(rule.id, { name: value })} /></label>
                      <label className="settings-rule-field"><span>{tr('settings.chapter.ruleCard.mode')}</span><ThemedSelect className="settings-cleanup-mode-select" label={tr('settings.chapter.cleanup.mode.label')} value={rule.mode} options={customCleanupModeOptions} onChange={(value) => updateCustomCleanupRule(rule.id, { mode: value })} /></label>
                      <RegexExpressionField pattern={rule.pattern} error={regexError} flags="g" placeholder={tr('settings.chapter.ruleCard.cleanupExpressionPlaceholder')} label={tr('settings.chapter.ruleCard.expression')} validText={tr('settings.chapter.ruleCard.validGlobal')} onCommit={(value) => updateCustomCleanupRule(rule.id, { pattern: value })} />
                      <label className="settings-rule-field settings-rule-field-wide"><span>{tr('settings.chapter.ruleCard.replacement')}</span><SettingsTextInput value={rule.replacement} ariaLabel={tr('settings.chapter.cleanup.replacementAria')} placeholder={rule.mode === 'replace' ? tr('settings.chapter.cleanup.replacementPlaceholder') : tr('settings.chapter.cleanup.replacementDisabled')} disabled={rule.mode === 'remove-line'} onCommit={(value) => updateCustomCleanupRule(rule.id, { replacement: value })} /></label>
                    </div>
                  </article>
                );
              })}
              {!chapterRules.customCleanupRules.length ? <ReadonlyPill text={tr('settings.chapter.customCleanupRules.empty')} /> : null}
            </div>
            <button className="settings-rule-add-button" type="button" onClick={addCustomCleanupRule}><BookMindIcon name="plus" /><span>{tr('settings.chapter.customCleanupRules.add')}</span></button>
          </div>
        </SettingControl>
        <SettingControl title={tr('settings.chapter.cleanupPreview.title')} description={tr('settings.chapter.cleanupPreview.description')} valueText={tr('settings.chapter.cleanupPreview.value', { before: txtCleanupPreviewInput.length, after: txtCleanupPreviewOutput.length })}>
          <div className="settings-cleanup-preview">
            <label>
              <span>{tr('settings.chapter.cleanupPreview.before')}</span>
              <textarea className="settings-textarea compact" value={txtCleanupPreviewInput} onChange={(event) => setTxtCleanupPreviewInput(event.target.value)} />
            </label>
            <label>
              <span>{tr('settings.chapter.cleanupPreview.after')}</span>
              <textarea className="settings-textarea compact" value={txtCleanupPreviewOutput} readOnly />
            </label>
          </div>
        </SettingControl>
      </SettingsSection>
      </> : null}
      {showChapterGroup ? <>
      <SettingsSection title={tr('settings.chapter.diagnostics.title')} description={tr('settings.chapter.diagnostics.description')}>
        <SettingControl title={tr('settings.chapter.diagnostics.sampleTitle')} description={tr('settings.chapter.diagnostics.sampleDescription')} valueText={charsText(chapterDiagnosticsCleanedContent.length)}>
          <textarea className="settings-textarea" value={chapterDiagnosticsSampleInput} onChange={(event) => setChapterDiagnosticsSampleInput(event.target.value)} />
        </SettingControl>
        <SettingControl title={tr('settings.chapter.diagnostics.resultTitle')} description={tr('settings.chapter.diagnostics.resultDescription')} valueText={`parser v${chapterParseDiagnostics.parserVersion}`}>
          <div className="settings-chapter-diagnostics" role="status" aria-label={tr('settings.chapter.diagnostics.resultAria')}>
            <div className="settings-diagnostic-metrics">
              <span><strong>parserVersion</strong>{chapterParseDiagnostics.parserVersion}</span>
              <span><strong>{tr('settings.chapter.diagnostics.chapterCount')}</strong>{chapterParseDiagnostics.stats.chapterCount}</span>
              <span><strong>{tr('settings.chapter.diagnostics.totalCharacters')}</strong>{chapterParseDiagnostics.stats.totalCharacters}</span>
              <span><strong>{tr('settings.chapter.diagnostics.averageCharacters')}</strong>{chapterParseDiagnostics.stats.averageCharacters}</span>
            </div>
            <div>
              <strong>{tr('settings.chapter.diagnostics.finalTocPreview')}</strong>
              <div className="settings-chapter-preview-list" aria-label={tr('settings.chapter.diagnostics.finalTocPreviewAria')}>
                {chapterParseDiagnostics.chapterPreview.length ? chapterParseDiagnostics.chapterPreview.map((chapter) => (
                  <article className="settings-chapter-preview-row" key={chapter.chapterId}>
                    <div>
                      <strong>{chapter.sourceChapterIndex + 1}. {chapter.title}</strong>
                      {chapter.volumeTitle ? <span>{chapter.volumeTitle}</span> : null}
                    </div>
                    <span>{tr('settings.chapter.diagnostics.startLine', { value: chapter.startLine + 1 })}</span>
                    <span>{tr('settings.chapter.diagnostics.endLine', { value: chapter.endLine === Number.MAX_SAFE_INTEGER ? '-' : chapter.endLine })}</span>
                    <span>{tr('settings.chapter.diagnostics.paragraphCount', { value: chapter.paragraphCount })}</span>
                    <span>{charsText(chapter.characters)}</span>
                  </article>
                )) : <span>{tr('settings.chapter.diagnostics.noPreviewChapters')}</span>}
              </div>
            </div>
            <div>
              <strong>{tr('settings.chapter.diagnostics.ruleMatches')}</strong>
              {chapterParseDiagnostics.ruleMatches.length ? chapterParseDiagnostics.ruleMatches.map((match) => <code key={`${match.lineIndex}-${match.rule}`}>{match.lineIndex + 1}: {match.rule} · {match.confidence} · {match.line}</code>) : <span>{tr('settings.chapter.diagnostics.noRuleMatches')}</span>}
            </div>
            <div>
              <strong>{tr('settings.chapter.diagnostics.unmatchedReasons')}</strong>
              {chapterParseDiagnostics.unmatchedSamples.length ? chapterParseDiagnostics.unmatchedSamples.map((sample) => <code key={`${sample.lineIndex}-${sample.reason}`}>{sample.lineIndex + 1}: {sample.reason} · {sample.confidence} · {sample.line}</code>) : <span>{tr('settings.chapter.diagnostics.noUnmatchedSamples')}</span>}
            </div>
            <div>
              <strong>{tr('settings.chapter.diagnostics.hashManifest')}</strong>
              {chapterParseDiagnostics.hashManifest.slice(0, 6).map((item) => <code key={item.chapterId}>{item.sourceChapterIndex}: {item.chapterId} · {item.hash}</code>)}
            </div>
            <div>
              <strong>{tr('settings.chapter.diagnostics.shortChapters')}</strong>
              {chapterParseDiagnostics.shortChapters.length ? chapterParseDiagnostics.shortChapters.map((chapter) => <code key={chapter.chapterId}>{chapter.sourceChapterIndex}: {chapter.title} · {chapter.characters}</code>) : <span>{tr('settings.chapter.diagnostics.noShortChapters')}</span>}
            </div>
            <div>
              <strong>{tr('settings.chapter.diagnostics.longChapters')}</strong>
              {chapterParseDiagnostics.longChapters.length ? chapterParseDiagnostics.longChapters.map((chapter) => <code key={chapter.chapterId}>{chapter.sourceChapterIndex}: {chapter.title} · {chapter.characters}</code>) : <span>{tr('settings.chapter.diagnostics.noLongChapters')}</span>}
            </div>
            <button className="ghost-btn small" type="button" onClick={copyChapterParseDiagnostics}>{tr('settings.reader.diagnostics.copyChapter')}</button>
          </div>
        </SettingControl>
      </SettingsSection>
      <SettingsSection title={tr('settings.chapter.bookTitle.title')} description={tr('settings.chapter.bookTitle.description')}>
        {chapterToggle('autoDetectBookTitle', tr('settings.chapter.autoDetectBookTitle.title'))}
        <SettingControl title={tr('settings.chapter.bookTitleBracketMode.title')} description={tr('settings.chapter.bookTitleBracketMode.description')} valueText={bookTitleBracketModeOptions.find((item) => item.value === chapterRules.bookTitleBracketMode)?.label}>
          <ThemedSelect label={tr('settings.chapter.bookTitleBracketMode.title')} value={chapterRules.bookTitleBracketMode} options={bookTitleBracketModeOptions} onChange={(value) => updateChapterRule('bookTitleBracketMode', value)} />
        </SettingControl>
        <SettingControl title={tr('settings.chapter.customBookTitleBracketPattern.title')} description={tr('settings.chapter.customBookTitleBracketPattern.description')}>
          <SettingsTextInput value={chapterRules.customBookTitleBracketPattern} placeholder="^Book:\\s*(.+)$" onCommit={(value) => updateChapterRule('customBookTitleBracketPattern', value)} />
        </SettingControl>
        {chapterNumber('bookTitleMaxLength', tr('settings.chapter.bookTitleMaxLength.title'), 5, 120)}
        {chapterToggle('firstLineAsBookTitle', tr('settings.chapter.firstLineAsBookTitle.title'))}
        {chapterToggle('inferBookTitleFromFileName', tr('settings.chapter.inferBookTitleFromFileName.title'))}
      </SettingsSection>
      </> : null}
    </>
  );
}

type RuleCardTranslator = (key: string, values?: Record<string, string | number>) => string;

function validateRegexPattern(pattern: string) {
  try {
    new RegExp(pattern);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function RuleCardActions({ index, total, onMove, onDelete, tr }: {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  tr: RuleCardTranslator;
}) {
  return (
    <div className="settings-rule-card-actions">
      <button className="settings-rule-icon-btn" type="button" title={tr('settings.common.moveUp')} aria-label={tr('settings.common.moveUp')} disabled={index === 0} onClick={() => onMove(-1)}><span aria-hidden="true">↑</span></button>
      <button className="settings-rule-icon-btn" type="button" title={tr('settings.common.moveDown')} aria-label={tr('settings.common.moveDown')} disabled={index >= total - 1} onClick={() => onMove(1)}><span aria-hidden="true">↓</span></button>
      <button className="settings-rule-icon-btn danger" type="button" title={tr('settings.reader.action.delete')} aria-label={tr('settings.reader.action.delete')} onClick={onDelete}><BookMindIcon name="libraryMenuDelete" /></button>
    </div>
  );
}

function RegexExpressionField({ pattern, error, flags = '', placeholder, label, validText, onCommit }: {
  pattern: string;
  error: string;
  flags?: string;
  placeholder: string;
  label: string;
  validText: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="settings-rule-field settings-rule-expression-field">
      <span>{label}</span>
      <div className={`settings-rule-expression${error ? ' invalid' : ''}`}>
        <code aria-hidden="true">/</code>
        <SettingsTextInput className="settings-rule-expression-input" value={pattern} placeholder={placeholder} ariaLabel={label} ariaInvalid={Boolean(error)} onCommit={onCommit} />
        <code aria-hidden="true">/{flags}</code>
      </div>
      <small className={error ? 'invalid' : 'valid'}>{error || validText}</small>
    </label>
  );
}

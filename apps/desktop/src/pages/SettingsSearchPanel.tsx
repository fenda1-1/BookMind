import { ThemedSelect } from './SettingsSelect';
import { ReadonlyPill, SettingControl, SettingsNumberInput, SettingsSection } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsSearchPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    extendedSettings,
    diagnosticPaths,
    searchScopeOptions,
    globalSearchModeOptions,
    readerSearchChapterFilterOptions,
    readerSearchHighlightColorOptions,
    indexStrategyVersionOptions,
    ftsRepairStrategyOptions,
    indexRebuildStrategyOptions,
    indexPauseResumeStrategyOptions,
    updateExtendedSetting,
  } = props;
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (checked: boolean) => checked ? tr('settings.common.on') : tr('settings.common.off');
  const enabledDisabled = (checked: boolean) => checked ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const shownHidden = (shown: boolean) => shown ? tr('settings.search.state.shown') : tr('settings.search.state.hidden');
  const displayHidden = (shown: boolean) => shown ? tr('settings.search.state.displayed') : tr('settings.search.state.hiddenPast');
  const charsText = (count: string | number) => tr('settings.search.count.chars', { count });
  const itemsText = (count: string | number) => tr('settings.search.count.items', { count });

  return (
      <>
        <SettingsSection title={tr('settings.search.global.title')} description={tr('settings.search.global.description')}>
          <SettingControl title={tr('settings.search.globalSearchMode.title')} description={tr('settings.search.globalSearchMode.description')} valueText={extendedSettings.globalSearchMode}>
            <ThemedSelect label={tr('settings.search.globalSearchMode.label')} value={extendedSettings.globalSearchMode} options={globalSearchModeOptions} onChange={(value) => updateExtendedSetting('globalSearchMode', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.globalSearchDebounceMs.title')} description={tr('settings.search.globalSearchDebounceMs.description')} valueText={`${extendedSettings.globalSearchDebounceMs} ms`}>
            <SettingsNumberInput min={0} max={2000} step={50} value={extendedSettings.globalSearchDebounceMs} onCommit={(value) => updateExtendedSetting('globalSearchDebounceMs', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.searchLimit.title')} description={tr('settings.search.searchLimit.description')} valueText={extendedSettings.searchLimit}>
            <SettingsNumberInput min={5} max={800} value={extendedSettings.searchLimit} onCommit={(value) => updateExtendedSetting('searchLimit', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.globalSearchSnippetLength.title')} description={tr('settings.search.globalSearchSnippetLength.description')} valueText={charsText(extendedSettings.globalSearchSnippetLength)}>
            <SettingsNumberInput min={80} max={500} step={20} value={extendedSettings.globalSearchSnippetLength} onCommit={(value) => updateExtendedSetting('globalSearchSnippetLength', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.globalSearchShowScore.title')} description={tr('settings.search.globalSearchShowScore.description')} valueText={shownHidden(extendedSettings.globalSearchShowScore)}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.globalSearchShowScore} onChange={(event) => updateExtendedSetting('globalSearchShowScore', event.target.checked)} /><span>{displayHidden(extendedSettings.globalSearchShowScore)}</span></label>
          </SettingControl>
          <SettingControl title={tr('settings.search.globalSearchHistoryLimit.title')} description={tr('settings.search.globalSearchHistoryLimit.description')} valueText={extendedSettings.globalSearchHistoryLimit}>
            <SettingsNumberInput min={0} max={20} value={extendedSettings.globalSearchHistoryLimit} onCommit={(value) => updateExtendedSetting('globalSearchHistoryLimit', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.globalSearchSavedLimit.title')} description={tr('settings.search.globalSearchSavedLimit.description')} valueText={extendedSettings.globalSearchSavedLimit}>
            <SettingsNumberInput min={0} max={20} value={extendedSettings.globalSearchSavedLimit} onCommit={(value) => updateExtendedSetting('globalSearchSavedLimit', value)} />
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={tr('settings.search.reader.title')} description={tr('settings.search.reader.description')}>
          <SettingControl title={tr('settings.search.searchScope.title')} description={tr('settings.search.searchScope.description')} valueText={extendedSettings.searchScope}>
            <ThemedSelect label={tr('settings.search.searchScope.label')} value={extendedSettings.searchScope} options={searchScopeOptions} onChange={(value) => updateExtendedSetting('searchScope', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.readerSearchHistoryLimit.title')} description={tr('settings.search.readerSearchHistoryLimit.description')} valueText={extendedSettings.readerSearchHistoryLimit}>
            <SettingsNumberInput min={0} max={20} value={extendedSettings.readerSearchHistoryLimit} onCommit={(value) => updateExtendedSetting('readerSearchHistoryLimit', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.readerSavedSearchLimit.title')} description={tr('settings.search.readerSavedSearchLimit.description')} valueText={extendedSettings.readerSavedSearchLimit}>
            <SettingsNumberInput min={0} max={20} value={extendedSettings.readerSavedSearchLimit} onCommit={(value) => updateExtendedSetting('readerSavedSearchLimit', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.readerSearchChapterFilterDefault.title')} description={tr('settings.search.readerSearchChapterFilterDefault.description')} valueText={extendedSettings.readerSearchChapterFilterDefault}>
            <ThemedSelect label={tr('settings.search.readerSearchChapterFilterDefault.title')} value={extendedSettings.readerSearchChapterFilterDefault} options={readerSearchChapterFilterOptions} onChange={(value) => updateExtendedSetting('readerSearchChapterFilterDefault', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.readerSearchHighlightColor.title')} description={tr('settings.search.readerSearchHighlightColor.description')} valueText={extendedSettings.readerSearchHighlightColor}>
            <ThemedSelect label={tr('settings.search.readerSearchHighlightColor.title')} value={extendedSettings.readerSearchHighlightColor} options={readerSearchHighlightColorOptions} onChange={(value) => updateExtendedSetting('readerSearchHighlightColor', value)} />
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={tr('settings.search.normalization.title')} description={tr('settings.search.normalization.description')}>
          <SettingControl title={tr('settings.search.matching.title')} description={tr('settings.search.matching.description')}>
            <div className="settings-inline-actions">
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.caseSensitive} onChange={(event) => updateExtendedSetting('caseSensitive', event.target.checked)} /><span>{tr('settings.search.caseSensitive.label')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.fuzzy} onChange={(event) => updateExtendedSetting('fuzzy', event.target.checked)} /><span>{tr('settings.search.fuzzy.label')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.regex} onChange={(event) => updateExtendedSetting('regex', event.target.checked)} /><span>{tr('settings.search.regex.label')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerSearchRegexFallbackLiteral} onChange={(event) => updateExtendedSetting('readerSearchRegexFallbackLiteral', event.target.checked)} /><span>{tr('settings.search.readerSearchRegexFallbackLiteral.label')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.searchNormalizeTraditionalChinese} onChange={(event) => updateExtendedSetting('searchNormalizeTraditionalChinese', event.target.checked)} /><span>{tr('settings.search.searchNormalizeTraditionalChinese.label')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.searchNormalizeNfkc} onChange={(event) => updateExtendedSetting('searchNormalizeNfkc', event.target.checked)} /><span>{tr('settings.search.searchNormalizeNfkc.label')}</span></label>
              <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.searchPinyinInitials} onChange={(event) => updateExtendedSetting('searchPinyinInitials', event.target.checked)} /><span>{tr('settings.search.searchPinyinInitials.label')}</span></label>
            </div>
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={tr('settings.search.indexTasks.title')} description={tr('settings.search.indexTasks.description')}>
          <SettingControl title={tr('settings.search.autoIndexImportedBooks.title')} description={tr('settings.search.autoIndexImportedBooks.description')} valueText={onOff(extendedSettings.autoIndexImportedBooks)}>
            <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.autoIndexImportedBooks} onChange={(event) => updateExtendedSetting('autoIndexImportedBooks', event.target.checked)} /><span>{enabledDisabled(extendedSettings.autoIndexImportedBooks)}</span></label>
          </SettingControl>
          <SettingControl title={tr('settings.search.indexStrategyVersion.title')} description={tr('settings.search.indexStrategyVersion.description')} valueText={indexStrategyVersionOptions.find((item) => item.value === extendedSettings.indexStrategyVersion)?.label}>
            <ThemedSelect label={tr('settings.search.indexStrategyVersion.title')} value={extendedSettings.indexStrategyVersion} options={indexStrategyVersionOptions} onChange={(value) => updateExtendedSetting('indexStrategyVersion', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.indexChunkSize.title')} description={tr('settings.search.indexChunkSize.description')} valueText={charsText(extendedSettings.indexChunkSize)}>
            <SettingsNumberInput min={200} max={5000} step={100} value={extendedSettings.indexChunkSize} onCommit={(value) => updateExtendedSetting('indexChunkSize', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.indexChunkOverlap.title')} description={tr('settings.search.indexChunkOverlap.description')} valueText={charsText(extendedSettings.indexChunkOverlap)}>
            <SettingsNumberInput min={0} max={1000} step={20} value={extendedSettings.indexChunkOverlap} onCommit={(value) => updateExtendedSetting('indexChunkOverlap', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.indexRebuildStrategy.title')} description={tr('settings.search.indexRebuildStrategy.description')} valueText={indexRebuildStrategyOptions.find((item) => item.value === extendedSettings.indexRebuildStrategy)?.label}>
            <ThemedSelect label={tr('settings.search.indexRebuildStrategy.title')} value={extendedSettings.indexRebuildStrategy} options={indexRebuildStrategyOptions} onChange={(value) => updateExtendedSetting('indexRebuildStrategy', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.indexRecentErrorLimit.title')} description={tr('settings.search.indexRecentErrorLimit.description')} valueText={itemsText(extendedSettings.indexRecentErrorLimit)}>
            <SettingsNumberInput min={0} max={50} value={extendedSettings.indexRecentErrorLimit} onCommit={(value) => updateExtendedSetting('indexRecentErrorLimit', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.indexPauseResumeStrategy.title')} description={tr('settings.search.indexPauseResumeStrategy.description')} valueText={indexPauseResumeStrategyOptions.find((item) => item.value === extendedSettings.indexPauseResumeStrategy)?.label}>
            <ThemedSelect label={tr('settings.search.indexPauseResumeStrategy.title')} value={extendedSettings.indexPauseResumeStrategy} options={indexPauseResumeStrategyOptions} onChange={(value) => updateExtendedSetting('indexPauseResumeStrategy', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.parseConcurrency.title')} description={tr('settings.search.parseConcurrency.description')} valueText={tr('settings.search.count.books', { count: extendedSettings.parseConcurrency })}>
            <SettingsNumberInput min={1} max={8} value={extendedSettings.parseConcurrency} onCommit={(value) => updateExtendedSetting('parseConcurrency', value)} />
          </SettingControl>
        </SettingsSection>
        <SettingsSection title={tr('settings.search.ftsDiagnostics.title')} description={tr('settings.search.ftsDiagnostics.description')}>
          <SettingControl title={tr('settings.search.ftsRepairStrategy.title')} description={tr('settings.search.ftsRepairStrategy.description')} valueText={ftsRepairStrategyOptions.find((item) => item.value === extendedSettings.ftsRepairStrategy)?.label}>
            <ThemedSelect label={tr('settings.search.ftsRepairStrategy.title')} value={extendedSettings.ftsRepairStrategy} options={ftsRepairStrategyOptions} onChange={(value) => updateExtendedSetting('ftsRepairStrategy', value)} />
          </SettingControl>
          <SettingControl title={tr('settings.search.ftsDatabase.title')} description={tr('settings.search.ftsDatabase.description')} valueText={diagnosticPaths.ftsDatabase}>
            <ReadonlyPill text={diagnosticPaths.ftsDatabase} />
          </SettingControl>
        </SettingsSection>
      </>
    );
  }

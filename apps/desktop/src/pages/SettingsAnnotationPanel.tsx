import { ThemedSelect } from './SettingsSelect';
import { defaultExtendedSettings } from '../services/settingsCenterService';
import { ReadonlyPill, SettingControl, SettingsSection, SettingsTextarea, SettingsTextInput } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsAnnotationPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    extendedSettings,
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
    updateExtendedSetting,
    toggleAnnotationCsvField,
    toggleKnowledgeDefaultColumn,
    updateHighlightColorMeaning,
    updateHighlightColorShortcut,
  } = props;

  const onOff = (value: boolean) => t(value ? 'settings.common.on' : 'settings.common.off');
  const enabledDisabled = (value: boolean) => t(value ? 'settings.common.enabled' : 'settings.common.disabled');
  const configuredDefault = (value: unknown) => t(value ? 'settings.annotation.state.configured' : 'settings.annotation.state.default');
  const configuredUnset = (value: unknown) => t(value ? 'settings.annotation.state.configured' : 'settings.annotation.state.unset');
  const includeExclude = (value: boolean) => t(value ? 'settings.annotation.state.include' : 'settings.annotation.state.exclude');
  const appendSkip = (value: boolean) => t(value ? 'settings.annotation.state.append' : 'settings.annotation.state.skip');

  return (
    <SettingsSection title={t('settings.annotation.section.title')} description={t('settings.annotation.section.description')}>
      <SettingControl title={t('settings.annotation.selectionMenuEnabled.title')} description={t('settings.annotation.selectionMenuEnabled.description')} valueText={onOff(extendedSettings.selectionMenuEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.selectionMenuEnabled} onChange={(event) => updateExtendedSetting('selectionMenuEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.selectionMenuEnabled)}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.openNoteAfterHighlight.title')} description={t('settings.annotation.openNoteAfterHighlight.description')} valueText={onOff(extendedSettings.openNoteAfterHighlight)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.openNoteAfterHighlight} onChange={(event) => updateExtendedSetting('openNoteAfterHighlight', event.target.checked)} /><span>{enabledDisabled(extendedSettings.openNoteAfterHighlight)}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.allowEmptyNotes.title')} description={t('settings.annotation.allowEmptyNotes.description')} valueText={extendedSettings.allowEmptyNotes ? t('settings.annotation.state.allowed') : t('settings.annotation.state.disallowed')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.allowEmptyNotes} onChange={(event) => updateExtendedSetting('allowEmptyNotes', event.target.checked)} /><span>{extendedSettings.allowEmptyNotes ? t('settings.annotation.allowEmptyNotes.allowed') : t('settings.annotation.allowEmptyNotes.required')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.noteDefaultSaveTarget.title')} description={t('settings.annotation.noteDefaultSaveTarget.description')} valueText={noteDefaultSaveTargetOptions.find((item) => item.value === extendedSettings.noteDefaultSaveTarget)?.label}>
        <ThemedSelect label={t('settings.annotation.noteDefaultSaveTarget.title')} value={extendedSettings.noteDefaultSaveTarget} options={noteDefaultSaveTargetOptions} onChange={(value) => updateExtendedSetting('noteDefaultSaveTarget', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.noteAutoContext.title')} description={t('settings.annotation.noteAutoContext.description')} valueText={appendSkip(extendedSettings.noteAutoContext)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.noteAutoContext} onChange={(event) => updateExtendedSetting('noteAutoContext', event.target.checked)} /><span>{extendedSettings.noteAutoContext ? t('settings.annotation.noteAutoContext.append') : t('settings.annotation.noteAutoContext.skip')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.noteAutoReaderLocation.title')} description={t('settings.annotation.noteAutoReaderLocation.description')} valueText={appendSkip(extendedSettings.noteAutoReaderLocation)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.noteAutoReaderLocation} onChange={(event) => updateExtendedSetting('noteAutoReaderLocation', event.target.checked)} /><span>{extendedSettings.noteAutoReaderLocation ? t('settings.annotation.noteAutoReaderLocation.append') : t('settings.annotation.noteAutoReaderLocation.skip')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.noteTemplate.title')} description={t('settings.annotation.noteTemplate.description')} valueText={configuredUnset(extendedSettings.noteTemplate)}>
        <SettingsTextarea compact value={extendedSettings.noteTemplate} placeholder={t('settings.annotation.noteTemplate.placeholder')} onCommit={(value) => updateExtendedSetting('noteTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultHighlightColor.title')} description={t('settings.annotation.defaultHighlightColor.description')} valueText={extendedSettings.defaultHighlightColor}>
        <ThemedSelect label={t('settings.annotation.defaultHighlightColor.title')} value={extendedSettings.defaultHighlightColor} options={highlightColorOptions} onChange={(value) => updateExtendedSetting('defaultHighlightColor', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightColorShortcuts.title')} description={t('settings.annotation.highlightColorShortcuts.description')} valueText={highlightColorOptions.map((item) => `${item.label}:${extendedSettings.highlightColorShortcuts[item.value]}`).join(' / ')}>
        <div className="settings-inline-actions">
          {highlightColorOptions.map((color) => (
            <label className="settings-toggle" key={color.value}>
              <span>{color.label}</span>
              <ThemedSelect label={t('settings.annotation.highlightColorShortcuts.colorLabel', { color: color.label })} value={extendedSettings.highlightColorShortcuts[color.value]} options={highlightColorShortcutOptions} onChange={(value) => updateHighlightColorShortcut(color.value, value)} />
            </label>
          ))}
        </div>
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightColorMeanings.title')} description={t('settings.annotation.highlightColorMeanings.description')} valueText={configuredUnset(highlightColorOptions.some((item) => extendedSettings.highlightColorMeanings[item.value].trim()))}>
        <div className="settings-inline-actions">
          {highlightColorOptions.map((color) => (
            <label className="settings-toggle" key={color.value}>
              <span>{color.label}</span>
              <SettingsTextInput value={extendedSettings.highlightColorMeanings[color.value]} placeholder={t('settings.annotation.highlightColorMeanings.placeholder', { color: color.label })} onCommit={(value) => updateHighlightColorMeaning(color.value, value)} />
            </label>
          ))}
        </div>
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultHighlightImportance.title')} description={t('settings.annotation.defaultHighlightImportance.description')} valueText={extendedSettings.defaultHighlightImportance}>
        <ThemedSelect label={t('settings.annotation.defaultHighlightImportance.title')} value={extendedSettings.defaultHighlightImportance} options={highlightImportanceOptions} onChange={(value) => updateExtendedSetting('defaultHighlightImportance', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultHighlightReviewStatus.title')} description={t('settings.annotation.defaultHighlightReviewStatus.description')} valueText={extendedSettings.defaultHighlightReviewStatus}>
        <ThemedSelect label={t('settings.annotation.defaultHighlightReviewStatus.title')} value={extendedSettings.defaultHighlightReviewStatus} options={highlightReviewStatusOptions} onChange={(value) => updateExtendedSetting('defaultHighlightReviewStatus', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightOverlapStrategy.title')} description={t('settings.annotation.highlightOverlapStrategy.description')} valueText={highlightOverlapStrategyOptions.find((item) => item.value === extendedSettings.highlightOverlapStrategy)?.label}>
        <ThemedSelect label={t('settings.annotation.highlightOverlapStrategy.title')} value={extendedSettings.highlightOverlapStrategy} options={highlightOverlapStrategyOptions} onChange={(value) => updateExtendedSetting('highlightOverlapStrategy', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.anchorRepairStrategy.title')} description={t('settings.annotation.anchorRepairStrategy.description')} valueText={anchorRepairStrategyOptions.find((item) => item.value === extendedSettings.anchorRepairStrategy)?.label}>
        <ThemedSelect label={t('settings.annotation.anchorRepairStrategy.title')} value={extendedSettings.anchorRepairStrategy} options={anchorRepairStrategyOptions} onChange={(value) => updateExtendedSetting('anchorRepairStrategy', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationTagSuggestionsEnabled.title')} description={t('settings.annotation.annotationTagSuggestionsEnabled.description')} valueText={extendedSettings.annotationTagSuggestionsEnabled ? t('settings.annotation.state.showSuggestions') : t('settings.annotation.state.hideSuggestions')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.annotationTagSuggestionsEnabled} onChange={(event) => updateExtendedSetting('annotationTagSuggestionsEnabled', event.target.checked)} /><span>{extendedSettings.annotationTagSuggestionsEnabled ? t('settings.annotation.annotationTagSuggestionsEnabled.show') : t('settings.annotation.annotationTagSuggestionsEnabled.hide')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationMarkdownEditorEnabled.title')} description={t('settings.annotation.annotationMarkdownEditorEnabled.description')} valueText={extendedSettings.annotationMarkdownEditorEnabled ? t('settings.annotation.state.markdownAssist') : t('settings.annotation.state.plainText')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.annotationMarkdownEditorEnabled} onChange={(event) => updateExtendedSetting('annotationMarkdownEditorEnabled', event.target.checked)} /><span>{extendedSettings.annotationMarkdownEditorEnabled ? t('settings.annotation.annotationMarkdownEditorEnabled.enabled') : t('settings.annotation.annotationMarkdownEditorEnabled.disabled')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultExportFormat.title')} description={t('settings.annotation.defaultExportFormat.description')} valueText={extendedSettings.defaultExportFormat}>
        <ThemedSelect label={t('settings.annotation.defaultExportFormat.label')} value={extendedSettings.defaultExportFormat} options={exportFormatOptions} onChange={(value) => updateExtendedSetting('defaultExportFormat', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationExportContent.title')} description={t('settings.annotation.annotationExportContent.description')} valueText={annotationExportContentOptions.find((item) => item.value === extendedSettings.annotationExportContent)?.label}>
        <ThemedSelect label={t('settings.annotation.annotationExportContent.label')} value={extendedSettings.annotationExportContent} options={annotationExportContentOptions} onChange={(value) => updateExtendedSetting('annotationExportContent', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationJsonImportConflictStrategy.title')} description={t('settings.annotation.annotationJsonImportConflictStrategy.description')} valueText={annotationJsonImportConflictStrategyOptions.find((item) => item.value === extendedSettings.annotationJsonImportConflictStrategy)?.label}>
        <ThemedSelect label={t('settings.annotation.annotationJsonImportConflictStrategy.label')} value={extendedSettings.annotationJsonImportConflictStrategy} options={annotationJsonImportConflictStrategyOptions} onChange={(value) => updateExtendedSetting('annotationJsonImportConflictStrategy', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationMarkdownTemplate.title')} description={t('settings.annotation.annotationMarkdownTemplate.description')} valueText={extendedSettings.annotationMarkdownTemplate ? t('settings.annotation.state.configured') : t('settings.annotation.state.builtin')}>
        <SettingsTextarea compact value={extendedSettings.annotationMarkdownTemplate} placeholder={t('settings.annotation.annotationMarkdownTemplate.placeholder')} onCommit={(value) => updateExtendedSetting('annotationMarkdownTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationExportLastDirectory.title')} description={t('settings.annotation.annotationExportLastDirectory.description')} valueText={extendedSettings.annotationExportLastDirectory.trim() || t('settings.annotation.state.notRemembered')}>
        <div className="settings-inline-actions">
          <ReadonlyPill text={extendedSettings.annotationExportLastDirectory.trim() || t('settings.annotation.annotationExportLastDirectory.empty')} />
          <button className="ghost-btn small" type="button" disabled={!extendedSettings.annotationExportLastDirectory.trim()} onClick={() => updateExtendedSetting('annotationExportLastDirectory', '')}>{t('settings.common.clear')}</button>
        </div>
      </SettingControl>
      <SettingControl title={t('settings.annotation.annotationCsvFields.title')} description={t('settings.annotation.annotationCsvFields.description')} valueText={t('settings.annotation.annotationCsvFields.count', { count: extendedSettings.annotationCsvFields.length })}>
        <div className="settings-inline-actions">
          {annotationCsvFieldOptions.map((field) => (
            <label className="settings-toggle" key={field.value}>
              <input type="checkbox" checked={extendedSettings.annotationCsvFields.includes(field.value)} onChange={(event) => toggleAnnotationCsvField(field.value, event.target.checked)} />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </SettingControl>
      <SettingControl title={t('settings.annotation.ankiDefaultTags.title')} description={t('settings.annotation.ankiDefaultTags.description')} valueText={extendedSettings.ankiDefaultTags}>
        <SettingsTextInput value={extendedSettings.ankiDefaultTags} placeholder="bookmind review" onCommit={(value) => updateExtendedSetting('ankiDefaultTags', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.obsidianWikiLinks.title')} description={t('settings.annotation.obsidianWikiLinks.description')} valueText={onOff(extendedSettings.obsidianWikiLinks)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.obsidianWikiLinks} onChange={(event) => updateExtendedSetting('obsidianWikiLinks', event.target.checked)} /><span>{extendedSettings.obsidianWikiLinks ? t('settings.annotation.obsidianWikiLinks.wiki') : t('settings.annotation.obsidianWikiLinks.plain')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.logseqPropertyFormat.title')} description={t('settings.annotation.logseqPropertyFormat.description')} valueText={extendedSettings.logseqPropertyFormat ? 'property' : 'Markdown'}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.logseqPropertyFormat} onChange={(event) => updateExtendedSetting('logseqPropertyFormat', event.target.checked)} /><span>{extendedSettings.logseqPropertyFormat ? t('settings.annotation.logseqPropertyFormat.property') : t('settings.annotation.logseqPropertyFormat.markdown')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.readwiseDefaultAuthor.title')} description={t('settings.annotation.readwiseDefaultAuthor.description')} valueText={extendedSettings.readwiseDefaultAuthor}>
        <SettingsTextInput value={extendedSettings.readwiseDefaultAuthor} placeholder="BookMind" onCommit={(value) => updateExtendedSetting('readwiseDefaultAuthor', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeMarkdownExportIncludeAiMetadata.title')} description={t('settings.annotation.knowledgeMarkdownExportIncludeAiMetadata.description')} valueText={includeExclude(extendedSettings.knowledgeMarkdownExportIncludeAiMetadata)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.knowledgeMarkdownExportIncludeAiMetadata} onChange={(event) => updateExtendedSetting('knowledgeMarkdownExportIncludeAiMetadata', event.target.checked)} /><span>{extendedSettings.knowledgeMarkdownExportIncludeAiMetadata ? t('settings.annotation.knowledgeMarkdownExportIncludeAiMetadata.include') : t('settings.annotation.knowledgeMarkdownExportIncludeAiMetadata.exclude')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeMarkdownExportIncludeStructuredResponse.title')} description={t('settings.annotation.knowledgeMarkdownExportIncludeStructuredResponse.description')} valueText={includeExclude(extendedSettings.knowledgeMarkdownExportIncludeStructuredResponse)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.knowledgeMarkdownExportIncludeStructuredResponse} onChange={(event) => updateExtendedSetting('knowledgeMarkdownExportIncludeStructuredResponse', event.target.checked)} /><span>{extendedSettings.knowledgeMarkdownExportIncludeStructuredResponse ? t('settings.annotation.knowledgeMarkdownExportIncludeStructuredResponse.include') : t('settings.annotation.knowledgeMarkdownExportIncludeStructuredResponse.exclude')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeMarkdownExportPath.title')} description={t('settings.annotation.knowledgeMarkdownExportPath.description')} valueText={extendedSettings.knowledgeMarkdownExportPath.trim() || t('settings.annotation.state.defaultPath')}>
        <SettingsTextInput value={extendedSettings.knowledgeMarkdownExportPath} placeholder="D:/BookMind/exports/bookmind-knowledge.md" onCommit={(value) => updateExtendedSetting('knowledgeMarkdownExportPath', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeDefaultColumns.title')} description={t('settings.annotation.knowledgeDefaultColumns.description')} valueText={knowledgeDefaultColumnOptions.filter((item) => extendedSettings.knowledgeDefaultColumns.includes(item.value)).map((item) => item.label).join(' / ')}>
        <div className="settings-inline-actions">
          {knowledgeDefaultColumnOptions.map((column) => (
            <label className="settings-toggle" key={column.value}>
              <input type="checkbox" checked={extendedSettings.knowledgeDefaultColumns.includes(column.value)} onChange={(event) => toggleKnowledgeDefaultColumn(column.value, event.target.checked)} />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeBidirectionalLinksEnabled.title')} description={t('settings.annotation.knowledgeBidirectionalLinksEnabled.description')} valueText={extendedSettings.knowledgeBidirectionalLinksEnabled ? t('settings.annotation.state.showLinks') : t('settings.annotation.state.hideLinks')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.knowledgeBidirectionalLinksEnabled} onChange={(event) => updateExtendedSetting('knowledgeBidirectionalLinksEnabled', event.target.checked)} /><span>{extendedSettings.knowledgeBidirectionalLinksEnabled ? t('settings.annotation.knowledgeBidirectionalLinksEnabled.show') : t('settings.annotation.knowledgeBidirectionalLinksEnabled.hide')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeHighlightCardTemplate.title')} description={t('settings.annotation.knowledgeHighlightCardTemplate.description')} valueText={configuredDefault(extendedSettings.knowledgeHighlightCardTemplate)}>
        <SettingsTextarea compact value={extendedSettings.knowledgeHighlightCardTemplate} placeholder={defaultExtendedSettings.knowledgeHighlightCardTemplate} onCommit={(value) => updateExtendedSetting('knowledgeHighlightCardTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeNoteCardTemplate.title')} description={t('settings.annotation.knowledgeNoteCardTemplate.description')} valueText={configuredDefault(extendedSettings.knowledgeNoteCardTemplate)}>
        <SettingsTextarea compact value={extendedSettings.knowledgeNoteCardTemplate} placeholder={defaultExtendedSettings.knowledgeNoteCardTemplate} onCommit={(value) => updateExtendedSetting('knowledgeNoteCardTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.knowledgeFlashcardCardTemplate.title')} description={t('settings.annotation.knowledgeFlashcardCardTemplate.description')} valueText={configuredDefault(extendedSettings.knowledgeFlashcardCardTemplate)}>
        <SettingsTextarea compact value={extendedSettings.knowledgeFlashcardCardTemplate} placeholder={defaultExtendedSettings.knowledgeFlashcardCardTemplate} onCommit={(value) => updateExtendedSetting('knowledgeFlashcardCardTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightFlashcardGenerationEnabled.title')} description={t('settings.annotation.highlightFlashcardGenerationEnabled.description')} valueText={extendedSettings.highlightFlashcardGenerationEnabled ? t('settings.annotation.state.generationAllowed') : t('settings.annotation.state.generationDisabled')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.highlightFlashcardGenerationEnabled} onChange={(event) => updateExtendedSetting('highlightFlashcardGenerationEnabled', event.target.checked)} /><span>{extendedSettings.highlightFlashcardGenerationEnabled ? t('settings.annotation.highlightFlashcardGenerationEnabled.allow') : t('settings.annotation.highlightFlashcardGenerationEnabled.disable')}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightFlashcardDefaultTags.title')} description={t('settings.annotation.highlightFlashcardDefaultTags.description')} valueText={extendedSettings.highlightFlashcardDefaultTags || t('settings.common.none')}>
        <SettingsTextInput value={extendedSettings.highlightFlashcardDefaultTags} placeholder="highlight review" onCommit={(value) => updateExtendedSetting('highlightFlashcardDefaultTags', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightFlashcardDefaultReviewStatus.title')} description={t('settings.annotation.highlightFlashcardDefaultReviewStatus.description')} valueText={extendedSettings.highlightFlashcardDefaultReviewStatus}>
        <ThemedSelect label={t('settings.annotation.highlightFlashcardDefaultReviewStatus.title')} value={extendedSettings.highlightFlashcardDefaultReviewStatus} options={highlightReviewStatusOptions} onChange={(value) => updateExtendedSetting('highlightFlashcardDefaultReviewStatus', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightFlashcardFrontTemplate.title')} description={t('settings.annotation.highlightFlashcardFrontTemplate.description')} valueText={extendedSettings.highlightFlashcardFrontTemplate}>
        <SettingsTextarea compact value={extendedSettings.highlightFlashcardFrontTemplate} placeholder={defaultExtendedSettings.highlightFlashcardFrontTemplate} onCommit={(value) => updateExtendedSetting('highlightFlashcardFrontTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.highlightFlashcardBackTemplate.title')} description={t('settings.annotation.highlightFlashcardBackTemplate.description')} valueText={extendedSettings.highlightFlashcardBackTemplate}>
        <SettingsTextarea compact value={extendedSettings.highlightFlashcardBackTemplate} placeholder={defaultExtendedSettings.highlightFlashcardBackTemplate} onCommit={(value) => updateExtendedSetting('highlightFlashcardBackTemplate', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultBookmarkSort.title')} description={t('settings.annotation.defaultBookmarkSort.description')} valueText={extendedSettings.defaultBookmarkSort}>
        <ThemedSelect label={t('settings.annotation.defaultBookmarkSort.label')} value={extendedSettings.defaultBookmarkSort} options={bookmarkSortOptions} onChange={(value) => updateExtendedSetting('defaultBookmarkSort', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultBookmarkGroupBy.title')} description={t('settings.annotation.defaultBookmarkGroupBy.description')} valueText={extendedSettings.defaultBookmarkGroupBy}>
        <ThemedSelect label={t('settings.annotation.defaultBookmarkGroupBy.label')} value={extendedSettings.defaultBookmarkGroupBy} options={bookmarkGroupOptions} onChange={(value) => updateExtendedSetting('defaultBookmarkGroupBy', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultBookmarkTags.title')} description={t('settings.annotation.defaultBookmarkTags.description')} valueText={extendedSettings.defaultBookmarkTags || t('settings.common.none')}>
        <SettingsTextInput value={extendedSettings.defaultBookmarkTags} placeholder={t('settings.annotation.defaultBookmarkTags.placeholder')} onCommit={(value) => updateExtendedSetting('defaultBookmarkTags', value)} />
      </SettingControl>
      <SettingControl title={t('settings.annotation.bookmarkTitleFromChapter.title')} description={t('settings.annotation.bookmarkTitleFromChapter.description')} valueText={onOff(extendedSettings.bookmarkTitleFromChapter)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.bookmarkTitleFromChapter} onChange={(event) => updateExtendedSetting('bookmarkTitleFromChapter', event.target.checked)} /><span>{enabledDisabled(extendedSettings.bookmarkTitleFromChapter)}</span></label>
      </SettingControl>
      <SettingControl title={t('settings.annotation.defaultBookmarkColor.title')} description={t('settings.annotation.defaultBookmarkColor.description')} valueText={extendedSettings.defaultBookmarkColor}>
        <ThemedSelect label={t('settings.annotation.defaultBookmarkColor.title')} value={extendedSettings.defaultBookmarkColor} options={highlightColorOptions} onChange={(value) => updateExtendedSetting('defaultBookmarkColor', value)} />
      </SettingControl>
    </SettingsSection>
  );
}

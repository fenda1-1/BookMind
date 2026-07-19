import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';

function readCssWithImports(filePath, seen = new Set()) {
  const fullPath = resolve(filePath);
  if (seen.has(fullPath)) return '';
  seen.add(fullPath);
  const source = readFileSync(fullPath, 'utf8');
  const imports = [...source.matchAll(/@import\s+['"](.+?)['"];/g)]
    .map((match) => readCssWithImports(resolve(dirname(fullPath), match[1]), seen));
  return [source, ...imports].join('\n');
}

const settingsPage = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
const settingsCenterModel = readFileSync('src/features/settings-center/settingsCenterModel.ts', 'utf8');
const settingsCenterServiceSource = readFileSync('src/services/settingsCenterService.ts', 'utf8');
const settingsCenterDefaults = readFileSync('src/services/settingsCenter/defaults.ts', 'utf8');
const settingsCenterSchema = readFileSync('src/services/settingsCenter/schema.ts', 'utf8');
const settingsCenterMigrations = readFileSync('src/services/settingsCenter/migrations.ts', 'utf8');
const settingsCenterPersistence = readFileSync('src/services/settingsCenter/persistence.ts', 'utf8');
const settingsCenterImportExport = readFileSync('src/services/settingsCenter/importExport.ts', 'utf8');
const settingsCenterFacade = readFileSync('src/services/settingsCenter/service.ts', 'utf8');
const settingsCenterService = `${settingsCenterServiceSource}\n${settingsCenterDefaults}\n${settingsCenterSchema}\n${settingsCenterMigrations}\n${settingsCenterPersistence}\n${settingsCenterImportExport}\n${settingsCenterFacade}`;
const settingsCenterDefaultResetActionsPath = 'src/features/settings-center/settingsCenterDefaultResetActions.ts';
assert.ok(existsSync(settingsCenterDefaultResetActionsPath), 'settings default reset actions must live in settingsCenterDefaultResetActions');
const settingsCenterDefaultResetActions = readFileSync(settingsCenterDefaultResetActionsPath, 'utf8');
const settingsCenterReaderActionsPath = 'src/features/settings-center/settingsCenterReaderActions.ts';
assert.ok(existsSync(settingsCenterReaderActionsPath), 'settings reader actions must live in settingsCenterReaderActions');
const settingsCenterReaderActions = readFileSync(settingsCenterReaderActionsPath, 'utf8');
const settingsCenterSnapshotActionsPath = 'src/features/settings-center/settingsCenterSnapshotActions.ts';
assert.ok(existsSync(settingsCenterSnapshotActionsPath), 'settings snapshot actions must live in settingsCenterSnapshotActions');
const settingsCenterSnapshotActions = readFileSync(settingsCenterSnapshotActionsPath, 'utf8');
const settingsCenterGeneralActionsPath = 'src/features/settings-center/settingsCenterGeneralActions.ts';
assert.ok(existsSync(settingsCenterGeneralActionsPath), 'settings general actions must live in settingsCenterGeneralActions');
const settingsCenterGeneralActions = readFileSync(settingsCenterGeneralActionsPath, 'utf8');
const settingsSupplementalPanels = readFileSync('src/pages/SettingsSupplementalPanels.tsx', 'utf8');
const settingsAiPanel = readFileSync('src/pages/SettingsAiPanel.tsx', 'utf8');
const settingsAppearancePanel = readFileSync('src/pages/SettingsAppearancePanel.tsx', 'utf8');
const settingsDataPanel = readFileSync('src/pages/SettingsDataPanel.tsx', 'utf8');
const settingsGeneralPanel = readFileSync('src/pages/SettingsGeneralPanel.tsx', 'utf8');
const settingsDiagnosticsPanel = readFileSync('src/pages/SettingsDiagnosticsPanel.tsx', 'utf8');
const settingsSearchPanel = readFileSync('src/pages/SettingsSearchPanel.tsx', 'utf8');
const settingsLibraryPanel = readFileSync('src/pages/SettingsLibraryPanel.tsx', 'utf8');
const settingsReaderPanel = readFileSync('src/pages/SettingsReaderPanel.tsx', 'utf8');
const settingsChapterPanel = readFileSync('src/pages/SettingsChapterPanel.tsx', 'utf8');
const searchPage = readFileSync('src/pages/SearchPage.tsx', 'utf8');
const readerPage = readFileSync('src/features/reader-core/ReaderPage.tsx', 'utf8');
const readerSearchControllerPath = 'src/features/reader-core/useReaderSearchController.ts';
assert.ok(existsSync(readerSearchControllerPath), 'reader search orchestration must live in useReaderSearchController');
const readerSearchController = readFileSync(readerSearchControllerPath, 'utf8');
const readerSearchWorkerPath = 'src/features/reader-core/readerSearchWorker.ts';
assert.ok(existsSync(readerSearchWorkerPath), 'reader search execution must live in a background worker');
const readerSearchWorker = readFileSync(readerSearchWorkerPath, 'utf8');
const settingsAnnotationPanelPath = 'src/pages/SettingsAnnotationPanel.tsx';
assert.ok(existsSync(settingsAnnotationPanelPath), 'annotation settings panel must live in SettingsAnnotationPanel');
const settingsAnnotationPanel = readFileSync(settingsAnnotationPanelPath, 'utf8');
const settingsShortcutPanelPath = 'src/pages/SettingsShortcutPanel.tsx';
assert.ok(existsSync(settingsShortcutPanelPath), 'shortcut and interaction settings panel must live in SettingsShortcutPanel');
const settingsShortcutPanel = readFileSync(settingsShortcutPanelPath, 'utf8');
const readerPaginationControllerPath = 'src/features/reader-core/useReaderPaginationController.ts';
assert.ok(existsSync(readerPaginationControllerPath), 'reader pagination orchestration must live in useReaderPaginationController');
const readerPaginationController = readFileSync(readerPaginationControllerPath, 'utf8');
const readerPageMeasurementControllerPath = 'src/features/reader-core/useReaderPageMeasurementController.ts';
assert.ok(existsSync(readerPageMeasurementControllerPath), 'reader page measurement orchestration must live in useReaderPageMeasurementController');
const readerPageMeasurementController = readFileSync(readerPageMeasurementControllerPath, 'utf8');
const readerSelectionActionsPath = 'src/features/reader-core/readerSelectionActions.ts';
assert.ok(existsSync(readerSelectionActionsPath), 'reader selection actions must live in readerSelectionActions');
const readerSelectionActions = readFileSync(readerSelectionActionsPath, 'utf8');
const readerAnnotationPanelControllerPath = 'src/features/reader-core/useReaderAnnotationPanelController.ts';
assert.ok(existsSync(readerAnnotationPanelControllerPath), 'reader annotation panel state must live in useReaderAnnotationPanelController');
const readerAnnotationPanelController = readFileSync(readerAnnotationPanelControllerPath, 'utf8');
const readerAnnotationDrawers = readFileSync('src/features/reader-core/ReaderAnnotationDrawers.tsx', 'utf8');
const readerAnnotationOverlays = readFileSync('src/features/reader-core/ReaderAnnotationOverlays.tsx', 'utf8');
const readerContent = readFileSync('src/features/reader-core/ReaderContent.tsx', 'utf8');
const readerToolbar = readFileSync('src/features/reader-core/ReaderToolbar.tsx', 'utf8');
const readerModel = readFileSync('src/features/reader-core/readerModel.ts', 'utf8');
const readerModelTypes = readFileSync('src/features/reader-core/readerModel/types.ts', 'utf8');
const readerModelSelection = readFileSync('src/features/reader-core/readerModel/selection.ts', 'utf8');
const readerModelNavigation = readFileSync('src/features/reader-core/readerModel/navigation.ts', 'utf8');
const readerSearchModel = readFileSync('src/features/reader-core/readerSearchModel.ts', 'utf8');
const readerInteractionModel = readFileSync('src/features/reader-core/readerInteractionModel.ts', 'utf8');
const readerSettings = readFileSync('src/features/reader-core/readerSettings.ts', 'utf8');
const readerSettingsPanel = readFileSync('src/features/reader-core/ReaderSettingsPanel.tsx', 'utf8');
const readerWorkspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const readerWorkspaceModel = readFileSync('src/pages/readerWorkspaceModel.ts', 'utf8');
const readerWorkspaceState = readFileSync('src/pages/reader-workspace/useReaderWorkspaceState.ts', 'utf8');
const readerWorkspaceDocument = readFileSync('src/pages/reader-workspace/useReaderWorkspaceDocument.ts', 'utf8');
const readerWorkspacePersistence = readFileSync('src/pages/reader-workspace/useReaderWorkspacePersistence.ts', 'utf8');
const readerCommandHandlers = readFileSync('src/pages/reader-workspace/ReaderCommandHandlers.ts', 'utf8');
const readerWorkspaceAnnotationActionsPath = 'src/pages/readerWorkspaceAnnotationActions.ts';
assert.ok(existsSync(readerWorkspaceAnnotationActionsPath), 'reader workspace annotation actions must live in readerWorkspaceAnnotationActions');
const readerWorkspaceAnnotationActions = readFileSync(readerWorkspaceAnnotationActionsPath, 'utf8');
const readerMemoryDiagnostics = readFileSync('src/features/reader-core/readerMemoryDiagnostics.ts', 'utf8');
const styles = readCssWithImports('src/app/styles.css');
const readerStyles = `${readCssWithImports('src/app/readerStyles.css')}\n${styles}`;
const types = readFileSync('src/types.ts', 'utf8');
const packageJson = readFileSync('package.json', 'utf8');
const settingsSurfaces = [
  settingsPage,
  settingsAiPanel,
  settingsAppearancePanel,
  settingsDataPanel,
  settingsGeneralPanel,
  settingsLibraryPanel,
  settingsReaderPanel,
  settingsSearchPanel,
  settingsChapterPanel,
  settingsSupplementalPanels,
  settingsShortcutPanel,
  settingsAnnotationPanel,
  settingsCenterDefaultResetActions,
  settingsCenterReaderActions,
].join('\n');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function settingsSection(source, title) {
  const titlePattern = title.includes('.')
    ? `<SettingsSection title=\\{(?:tr|t)\\('${escapeRegExp(title)}'\\)\\}`
    : `<SettingsSection title="${escapeRegExp(title)}"`;
  return source.match(new RegExp(`${titlePattern}[\\s\\S]*?</SettingsSection>`))?.[0] ?? '';
}

function assertSupplementalSettingsSectionIncludes(title, requiredText) {
  const section = settingsSection(settingsSupplementalPanels, title);
  assert.ok(section, `supplemental settings panels must render the ${title} section`);
  for (const text of requiredText) {
    assert.match(section, new RegExp(escapeRegExp(text)), `${title} section must include ${text}`);
  }
}
function assertShortcutSettingsSectionIncludes(title, requiredText) {
  const section = settingsSection(settingsShortcutPanel, title);
  assert.ok(section, `shortcut settings panel must render the ${title} section`);
  for (const text of requiredText) {
    assert.match(section, new RegExp(escapeRegExp(text)), `${title} section must include ${text}`);
  }
}
function assertAnnotationSettingsSectionIncludes(title, requiredText) {
  const section = settingsSection(settingsAnnotationPanel, title);
  assert.ok(section, `annotation settings panel must render the ${title} section`);
  for (const text of requiredText) {
    assert.match(section, new RegExp(escapeRegExp(text)), `${title} section must include ${text}`);
  }
}
function assertSearchSettingsSectionIncludes(title, requiredText) {
  const section = settingsSection(settingsSearchPanel, title);
  assert.ok(section, `search settings panel must render the ${title} section`);
  for (const text of requiredText) {
    assert.match(section, new RegExp(escapeRegExp(text)), `${title} section must include ${text}`);
  }
}
assertSearchSettingsSectionIncludes('settings.search.global.title', [
  'settings.search.globalSearchMode.title',
  'settings.search.globalSearchDebounceMs.title',
  'settings.search.searchLimit.title',
  'settings.search.globalSearchSnippetLength.title',
  'settings.search.globalSearchShowScore.title',
  'settings.search.globalSearchHistoryLimit.title',
  'settings.search.globalSearchSavedLimit.title',
]);
assertSearchSettingsSectionIncludes('settings.search.reader.title', [
  'settings.search.searchScope.title',
  'settings.search.readerSearchHistoryLimit.title',
  'settings.search.readerSavedSearchLimit.title',
  'settings.search.readerSearchChapterFilterDefault.title',
  'settings.search.readerSearchHighlightColor.title',
]);
assertSearchSettingsSectionIncludes('settings.search.normalization.title', [
  'settings.search.matching.title',
  'settings.search.caseSensitive.label',
  'settings.search.fuzzy.label',
  'settings.search.regex.label',
  'settings.search.readerSearchRegexFallbackLiteral.label',
  'settings.search.searchNormalizeTraditionalChinese.label',
  'settings.search.searchNormalizeNfkc.label',
  'settings.search.searchPinyinInitials.label',
]);
assertSearchSettingsSectionIncludes('settings.search.indexTasks.title', [
  'settings.search.autoIndexImportedBooks.title',
  'settings.search.indexStrategyVersion.title',
  'settings.search.indexChunkSize.title',
  'settings.search.indexChunkOverlap.title',
  'settings.search.indexRebuildStrategy.title',
  'settings.search.indexRecentErrorLimit.title',
  'settings.search.indexPauseResumeStrategy.title',
  'settings.search.parseConcurrency.title',
]);
assertSearchSettingsSectionIncludes('settings.search.ftsDiagnostics.title', [
  'settings.search.ftsRepairStrategy.title',
  'settings.search.ftsDatabase.title',
]);
assert.match(searchPage, /loadExtendedSettings/, 'search page must consume extended settings');
assert.match(searchPage, /subscribeSettingsUpdated\(refreshExtendedSettings\)/, 'search page must listen to typed settings updates');
assert.match(searchPage, /const searchResultBatchSize = 500/, 'search page must use a bounded fetch batch while accumulating the full filtered result set');
assert.match(searchPage, /extendedSettings\.globalSearchMode/, 'search page must apply configured global search trigger mode');
assert.match(searchPage, /extendedSettings\.globalSearchDebounceMs/, 'search page must apply configured global search debounce');
assert.match(searchPage, /extendedSettings\.globalSearchSnippetLength/, 'search page must apply configured global search snippet length');
assert.match(searchPage, /extendedSettings\.globalSearchShowScore/, 'search page must apply configured global search score visibility');
assert.match(searchPage, /getPrivacyBookTitle/, 'search page must import the privacy-safe book title helper');
assert.match(searchPage, /displayBookTitle = book \? getPrivacyBookTitle\(book\.displayTitle,\s*extendedSettings\)/, 'search no-results copy must use the privacy-safe current book title');
assert.match(searchPage, /formatSearchResultMeta\(result,\s*t\('common\.score'\),\s*extendedSettings\.globalSearchShowScore,\s*extendedSettings\)/, 'search result metadata must pass privacy settings to the formatter');
assert.match(searchPage, /getPrivacyBookTitle\(result\.bookTitle,\s*privacySettings\)/, 'search result metadata must hide book titles when configured');
assert.match(searchPage, /extendedSettings\.globalSearchHistoryLimit/, 'search page must apply configured search history retention');
assert.match(searchPage, /extendedSettings\.globalSearchSavedLimit/, 'search page must apply configured saved search retention');
assert.match(searchPage, /truncateSearchSnippet/, 'search page must trim snippets through an explicit formatter');
assert.match(searchPage, /saveGlobalSearchQuery/, 'search page must support saving global searches');
assert.match(readerPage, /loadExtendedSettings/, 'reader page must consume extended settings');
assert.match(readerPage, /subscribeSettingsUpdated\(refreshExtendedSettings\)/, 'reader page must refresh reader search defaults through typed settings updates');
assert.match(readerPage, /function refreshExtendedSettings\(detail\?: SettingsUpdatedDetail\)/, 'reader page must receive typed settings update details');
assert.match(readerPage, /useReaderSearchController/, 'reader page must delegate reader search orchestration to useReaderSearchController');
assert.doesNotMatch(readerPage, /searchReaderIndex/, 'reader page must not own low-level reader search index execution');
assert.doesNotMatch(readerSearchController, /\bbuildReaderSearchIndex\b|\bsearchReaderIndex\b/, 'reader search controller must not execute whole-book search synchronously on the UI thread');
assert.match(readerSearchController, /readerSearchWorker\.ts/, 'reader search controller must delegate indexing and matching to the search worker');
assert.match(readerSearchWorker, /buildReaderSearchIndex/, 'reader search worker must own index construction');
assert.match(readerSearchWorker, /createReaderSearchExecution/, 'reader search worker must own cooperative search execution');
assert.match(readerSearchController, /subscribeSettingsUpdated\(refreshReaderSearchSettings\)/, 'reader search controller must react to typed settings updates');
assert.match(readerSearchController, /subscribeReaderSearchDataCleared\(clearReaderSearchSettingsData\)/, 'reader search controller must own typed reader search data clearing');
assert.match(readerSearchController, /subscribeReaderCacheCleared\(clearReaderSearchCacheData\)/, 'reader search controller must reset reader search state when reader cache clears');
assert.match(readerSearchController, /extendedSettings\.searchScope/, 'reader search controller must apply default reader search scope');
assert.match(readerSearchController, /extendedSettings\.caseSensitive/, 'reader search controller must apply default reader search case sensitivity');
assert.match(readerSearchController, /extendedSettings\.fuzzy/, 'reader search controller must apply default reader search fuzzy mode');
assert.match(readerSearchController, /extendedSettings\.regex/, 'reader search controller must apply default reader search regex mode');
assert.match(settingsCenterService, /readerSearchRegexFallbackLiteral:\s*boolean/, 'extended settings must type the reader regex fallback-to-literal toggle');
assert.match(settingsCenterService, /readerSearchRegexFallbackLiteral:\s*true/, 'extended settings must default reader regex fallback-to-literal on');
assert.match(settingsCenterService, /readerSearchRegexFallbackLiteral:\s*typeof settings\?\.readerSearchRegexFallbackLiteral === 'boolean' \? settings\.readerSearchRegexFallbackLiteral : defaultExtendedSettings\.readerSearchRegexFallbackLiteral/, 'extended settings must normalize the reader regex fallback-to-literal toggle');
assert.match(settingsSearchPanel, /extendedSettings\.readerSearchRegexFallbackLiteral/, 'settings page must render the reader regex fallback-to-literal toggle');
assert.match(settingsSearchPanel, /updateExtendedSetting\('readerSearchRegexFallbackLiteral', event\.target\.checked\)/, 'settings page must persist the reader regex fallback-to-literal toggle');
assert.match(settingsSearchPanel, /settings\.search\.readerSearchRegexFallbackLiteral\.label/, 'search settings must render the regex fallback-to-literal option');
assert.match(readerSearchController, /extendedSettings\.readerSearchRegexFallbackLiteral/, 'reader search controller must apply the regex fallback-to-literal setting');
assert.match(readerSearchController, /regexFallbackLiteral:\s*readerSearchRegexFallbackLiteral/, 'reader search must pass regex fallback-to-literal into the search model');
assert.match(readerModel, /from '\.\/readerSearchModel\.js'/, 'reader model must keep compatibility re-exports for reader search behavior');
assert.match(readerSearchModel, /regexFallbackLiteral\?:\s*boolean/, 'reader search options must type regex fallback-to-literal');
assert.match(readerSearchModel, /if \(options\.regexFallbackLiteral === false\) return \(\) => -1/, 'reader search must be able to disable invalid-regex literal fallback');
assert.match(readerSearchController, /extendedSettings\.searchNormalizeTraditionalChinese/, 'reader search controller must apply default reader search traditional Chinese normalization');
assert.match(readerSearchController, /extendedSettings\.searchNormalizeNfkc/, 'reader search controller must apply default reader search NFKC normalization');
assert.match(readerSearchController, /extendedSettings\.searchPinyinInitials/, 'reader search controller must apply default reader search pinyin initials');
assert.match(readerSearchController, /normalizeTraditionalChinese:\s*readerSearchNormalizeTraditionalChinese/, 'reader search must pass traditional Chinese normalization settings');
assert.match(readerSearchController, /normalizeNfkc:\s*readerSearchNormalizeNfkc/, 'reader search must pass NFKC normalization settings');
assert.match(readerSearchController, /pinyinInitials:\s*readerSearchPinyinInitials/, 'reader search must pass pinyin-initial settings');
assert.match(readerSearchController, /extendedSettings\.searchLimit/, 'reader search controller must apply default reader search result limit');
assert.match(readerSearchController, /extendedSettings\.readerSearchHistoryLimit/, 'reader search controller must apply the reader search history limit setting');
assert.match(readerSearchController, /extendedSettings\.readerSavedSearchLimit/, 'reader search controller must apply the reader saved search limit setting');
assert.match(readerSearchController, /extendedSettings\.readerSearchChapterFilterDefault/, 'reader search controller must apply the reader search chapter filter default setting');
assert.match(readerPage, /extendedSettings\.readerSearchHighlightColor/, 'reader page must apply the reader search hit highlight color setting');
assert.match(readerContent, /reader-search-mark color-/, 'reader content must render search hits with a configurable color class');
assert.match(readerPage, /--reader-paper-texture-strength': visualSettings\.paperTextureStrength/, 'reader page must expose paper texture strength as a CSS variable');
assert.match(readerPage, /--reader-eye-comfort-background-strength': visualSettings\.eyeComfortBackgroundStrength/, 'reader page must expose eye-comfort background strength as a CSS variable');
assert.match(readerPage, /--reader-paper-background-strength': visualSettings\.paperBackgroundStrength/, 'reader page must expose paper background strength as a CSS variable');
assert.match(readerPage, /--reader-eye-comfort-background-mix': `\$\{Math\.round\(visualSettings\.eyeComfortBackgroundStrength \* 100\)\}%`/, 'reader page must expose eye-comfort background strength as a CSS percentage variable');
assert.match(readerPage, /--reader-paper-background-mix': `\$\{Math\.round\(visualSettings\.paperBackgroundStrength \* 100\)\}%`/, 'reader page must expose paper background strength as a CSS percentage variable');
assert.match(readerPage, /--reader-custom-background-color': visualSettings\.customBackgroundColor/, 'reader page must expose custom reader background color as a CSS variable');
assert.match(readerPage, /--reader-custom-text-color': visualSettings\.customTextColor/, 'reader page must expose custom reader text color as a CSS variable');
assert.match(readerPage, /--reader-custom-selection-color': visualSettings\.customSelectionColor/, 'reader page must expose custom reader selection color as a CSS variable');
assert.match(readerAnnotationPanelController, /extendedSettings\.defaultExportFormat/, 'reader annotation panel controller must apply the default annotation export format');
assert.match(readerAnnotationPanelController, /extendedSettings\.annotationExportContent/, 'reader annotation panel controller must apply the default annotation export content setting');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.annotationMarkdownTemplate/, 'reader workspace annotation actions must apply the annotation markdown export template setting');
assert.match(readerWorkspaceAnnotationActions, /formatReaderAnnotationsMarkdown\(title,\s*chapters,\s*exportAnnotations\.highlights,\s*exportAnnotations\.bookmarks,\s*\{\s*template:\s*extendedSettings\.annotationMarkdownTemplate\s*\}\)/, 'Markdown export must pass the configured annotation template into the formatter');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.ankiDefaultTags/, 'reader workspace annotation actions must apply the Anki default tags setting');
assert.match(readerWorkspaceAnnotationActions, /formatReaderHighlightsAnkiCsv\(chapters,\s*exportAnnotations\.highlights,\s*extendedSettings\.ankiDefaultTags\)/, 'Anki export must pass configured default tags into the formatter');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.obsidianWikiLinks/, 'reader workspace annotation actions must apply the Obsidian wiki link setting');
assert.match(readerWorkspaceAnnotationActions, /formatReaderAnnotationsObsidianMarkdown\(title,\s*chapters,\s*exportAnnotations\.highlights,\s*exportAnnotations\.bookmarks,\s*\{\s*wikiLinks:\s*extendedSettings\.obsidianWikiLinks\s*\}\)/, 'Obsidian export must pass configured wiki-link behavior into the formatter');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.logseqPropertyFormat/, 'reader workspace annotation actions must apply the Logseq property format setting');
assert.match(readerWorkspaceAnnotationActions, /formatReaderAnnotationsLogseqMarkdown\(title,\s*chapters,\s*exportAnnotations\.highlights,\s*exportAnnotations\.bookmarks,\s*\{\s*propertyFormat:\s*extendedSettings\.logseqPropertyFormat\s*\}\)/, 'Logseq export must pass configured property formatting into the formatter');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.readwiseDefaultAuthor/, 'reader workspace annotation actions must apply the Readwise default author setting');
assert.match(readerWorkspaceAnnotationActions, /formatReaderAnnotationsReadwiseCsv\(chapters,\s*exportAnnotations\.highlights,\s*exportAnnotations\.bookmarks,\s*title,\s*book\.author \|\| extendedSettings\.readwiseDefaultAuthor\)/, 'Readwise export must use the configured default author when the book has no author');
assert.match(settingsCenterService, /annotationTagSuggestionsEnabled:\s*boolean/, 'extended settings must type the annotation tag suggestions toggle');
assert.match(settingsCenterService, /annotationTagSuggestionsEnabled:\s*true/, 'annotation tag suggestions should default to visible suggestions');
assert.match(settingsCenterService, /annotationTagSuggestionsEnabled:\s*typeof settings\?\.annotationTagSuggestionsEnabled === 'boolean' \? settings\.annotationTagSuggestionsEnabled : defaultExtendedSettings\.annotationTagSuggestionsEnabled/, 'extended settings must normalize the annotation tag suggestions toggle');
assert.match(settingsAnnotationPanel, /settings\.annotation\.annotationTagSuggestionsEnabled\.title/, 'settings page must expose the annotation tag suggestions toggle');
assert.match(settingsAnnotationPanel, /updateExtendedSetting\('annotationTagSuggestionsEnabled', event\.target\.checked\)/, 'settings page must persist the annotation tag suggestions toggle');
assert.match(settingsCenterDefaultResetActions, /annotationTagSuggestionsEnabled:\s*defaultExtendedSettings\.annotationTagSuggestionsEnabled/, 'annotation group defaults must reset tag suggestions');
assert.match(settingsCenterDefaultResetActions, /'annotationTagSuggestionsEnabled'/, 'annotation group reset keys must include tag suggestions');
assert.match(readerAnnotationPanelController, /extendedSettings\.annotationTagSuggestionsEnabled/, 'reader annotation panel controller must apply the annotation tag suggestions toggle');
assert.match(readerAnnotationPanelController, /buildReaderAnnotationTagSuggestions/, 'reader annotation panel controller must derive annotation tag suggestions from existing tags');
assert.match(readerAnnotationDrawers, /ReaderTagSuggestions/, 'reader annotation drawers must render annotation tag suggestion chips');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.annotationCsvFields/, 'reader workspace annotation actions must apply the annotation CSV field selection setting');
assert.match(readerWorkspaceAnnotationActions, /formatReaderAnnotationsCsv\(chapters,\s*exportAnnotations\.highlights,\s*exportAnnotations\.bookmarks,\s*\{\s*fields:\s*extendedSettings\.annotationCsvFields\s*\}\)/, 'CSV export must pass configured field selection into the formatter');
assert.match(settingsCenterService, /annotationCsvFields:\s*Array<'type' \| 'id' \| 'chapter' \| 'text' \| 'note' \| 'color' \| 'createdAt' \| 'location'>/, 'extended settings must type annotation CSV field selection');
assert.match(settingsCenterService, /normalizeAnnotationCsvFields\(settings\?\.annotationCsvFields\)/, 'extended settings must normalize annotation CSV field selection');
assert.match(settingsAnnotationPanel, /settings\.annotation\.annotationCsvFields\.title/, 'settings page must expose annotation CSV field selection');
assert.match(settingsPage, /toggleAnnotationCsvField/, 'settings page must let users toggle annotation CSV fields');
assert.match(settingsCenterService, /annotationJsonImportConflictStrategy:\s*'skip' \| 'overwrite' \| 'merge'/, 'extended settings must type the annotation JSON import conflict strategy');
assert.match(settingsCenterService, /annotationJsonImportConflictStrategy:\s*'overwrite'/, 'annotation JSON import conflict strategy must default to the existing overwrite behavior');
assert.match(settingsCenterService, /isAnnotationJsonImportConflictStrategy\(settings\?\.annotationJsonImportConflictStrategy\)/, 'extended settings must normalize the annotation JSON import conflict strategy');
assert.match(settingsAnnotationPanel, /settings\.annotation\.annotationJsonImportConflictStrategy\.title/, 'settings page must expose annotation JSON import conflict strategy');
assert.match(settingsPage, /annotationJsonImportConflictStrategyOptions/, 'settings page must render annotation JSON import conflict choices');
assert.match(settingsAnnotationPanel, /updateExtendedSetting\('annotationJsonImportConflictStrategy', value\)/, 'settings page must persist annotation JSON import conflict strategy');
assert.match(settingsCenterDefaultResetActions, /annotationJsonImportConflictStrategy:\s*defaultExtendedSettings\.annotationJsonImportConflictStrategy/, 'annotation group defaults must reset annotation JSON import conflict strategy');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.annotationJsonImportConflictStrategy/, 'reader workspace annotation actions must apply annotation JSON import conflict strategy');
assert.match(readerModel, /mergeReaderAnnotationsImport/, 'reader model must provide strategy-aware annotation import merging');
assert.match(settingsCenterService, /annotationMarkdownTemplate:\s*string/, 'extended settings must type the annotation markdown export template');
assert.match(settingsCenterService, /annotationMarkdownTemplate:\s*typeof settings\?\.annotationMarkdownTemplate === 'string' \? settings\.annotationMarkdownTemplate\.slice\(0,\s*4000\) : defaultExtendedSettings\.annotationMarkdownTemplate/, 'extended settings must normalize the annotation markdown export template');
assert.match(settingsAnnotationPanel, /settings\.annotation\.annotationMarkdownTemplate\.title/, 'settings page must expose the annotation markdown export template');
assert.match(settingsCenterService, /annotationExportLastDirectory:\s*string/, 'extended settings must type the annotation export remembered directory');
assert.match(settingsCenterService, /annotationExportLastDirectory:\s*''/, 'annotation export remembered directory should default empty');
assert.match(settingsCenterService, /annotationExportLastDirectory:\s*normalizePathTextSetting\(settings\?\.annotationExportLastDirectory,\s*defaultExtendedSettings\.annotationExportLastDirectory,\s*500\)/, 'extended settings must normalize the annotation export remembered directory without collapsing legal path spaces');
assert.match(settingsAnnotationPanel, /settings\.annotation\.annotationExportLastDirectory\.title/, 'settings page must expose annotation export path memory');
assert.match(settingsAnnotationPanel, /updateExtendedSetting\('annotationExportLastDirectory', ''\)/, 'settings page must let users clear the annotation export remembered directory');
assert.match(settingsCenterDefaultResetActions, /annotationExportLastDirectory:\s*defaultExtendedSettings\.annotationExportLastDirectory/, 'annotation group defaults must reset annotation export path memory');
assert.match(settingsCenterDefaultResetActions, /'annotationExportLastDirectory'/, 'annotation group reset keys must include annotation export path memory');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.annotationExportLastDirectory/, 'reader workspace annotation actions must use the remembered annotation export directory');
assert.match(readerWorkspaceAnnotationActions, /rememberAnnotationExportDirectory/, 'reader workspace annotation actions must remember the annotation export directory after a successful Tauri export');
assert.match(readerWorkspaceAnnotationActions, /const latestSettings = loadExtendedSettings\(\)/, 'remembering the annotation export directory must merge into the latest extended settings snapshot');
assert.match(readerWorkspaceAnnotationActions, /saveExtendedSettings\(\{ \.\.\.latestSettings, annotationExportLastDirectory: directory \}/, 'remembering the annotation export directory must not overwrite concurrently changed settings');
assert.match(readerPage, /extendedSettings\.selectionMenuEnabled/, 'reader page must apply the selection floating menu setting');
assert.match(settingsCenterService, /doubleClickWordSelectionEnabled:\s*boolean/, 'extended settings must type the double-click word selection toggle');
assert.match(settingsCenterService, /doubleClickWordSelectionEnabled:\s*true/, 'double-click word selection should default on');
assert.match(settingsCenterService, /doubleClickWordSelectionEnabled:\s*typeof settings\?\.doubleClickWordSelectionEnabled === 'boolean' \? settings\.doubleClickWordSelectionEnabled : defaultExtendedSettings\.doubleClickWordSelectionEnabled/, 'extended settings must normalize the double-click word selection toggle');
assert.match(settingsShortcutPanel, /settings\.shortcuts\.doubleClickWordSelection\.title/, 'settings shortcut panel must expose the double-click word selection toggle');
assert.match(settingsShortcutPanel, /updateExtendedSetting\('doubleClickWordSelectionEnabled', event\.target\.checked\)/, 'settings shortcut panel must persist the double-click word selection toggle');
assert.match(settingsCenterDefaultResetActions, /doubleClickWordSelectionEnabled:\s*defaultExtendedSettings\.doubleClickWordSelectionEnabled/, 'shortcut defaults must reset the double-click word selection toggle');
assert.match(settingsCenterDefaultResetActions, /'doubleClickWordSelectionEnabled'/, 'shortcut reset keys must include the double-click word selection toggle');
assert.match(readerPage, /extendedSettings\.doubleClickWordSelectionEnabled/, 'reader page must apply the double-click word selection setting');
assert.match(readerPage, /extendedSettings\.contextMenuEnabled/, 'reader page must apply the reader context menu setting');
assert.match(readerPage, /extendedSettings\.openNoteAfterHighlight/, 'reader page must apply the open-note-after-highlight setting');
assert.match(readerPage, /extendedSettings\.allowEmptyNotes/, 'reader page must apply the allow-empty-notes setting');
assert.match(readerSelectionActions, /shouldCreateReaderAnnotationFromNote/, 'reader selection actions must guard empty annotation-note submissions through the reader model');
assert.match(settingsCenterService, /annotationMarkdownEditorEnabled:\s*boolean/, 'extended settings must type the annotation markdown editor toggle');
assert.match(settingsCenterService, /annotationMarkdownEditorEnabled:\s*false/, 'annotation markdown editor should default to the existing plain-text editor');
assert.match(settingsCenterService, /annotationMarkdownEditorEnabled:\s*typeof settings\?\.annotationMarkdownEditorEnabled === 'boolean' \? settings\.annotationMarkdownEditorEnabled : defaultExtendedSettings\.annotationMarkdownEditorEnabled/, 'extended settings must normalize the annotation markdown editor toggle');
assert.match(settingsAnnotationPanel, /settings\.annotation\.annotationMarkdownEditorEnabled\.title/, 'settings page must expose the annotation markdown editor toggle');
assert.match(settingsAnnotationPanel, /updateExtendedSetting\('annotationMarkdownEditorEnabled', event\.target\.checked\)/, 'settings page must persist the annotation markdown editor toggle');
assert.match(settingsCenterDefaultResetActions, /annotationMarkdownEditorEnabled:\s*defaultExtendedSettings\.annotationMarkdownEditorEnabled/, 'annotation group defaults must reset the annotation markdown editor toggle');
assert.match(settingsCenterDefaultResetActions, /'annotationMarkdownEditorEnabled'/, 'annotation group reset keys must include the annotation markdown editor toggle');
assert.match(readerPage, /extendedSettings\.annotationMarkdownEditorEnabled/, 'reader page must apply the annotation markdown editor toggle');
assert.match(
  readerAnnotationDrawers,
  /MarkdownNoteEditor/,
  'reader annotation drawers must render the markdown note editor when enabled',
);
assert.match(settingsCenterService, /highlightOverlapStrategy:\s*'first-start-longest' \| 'latest-created' \| 'highest-importance'/, 'extended settings must type highlight overlap rendering strategy');
assert.match(settingsCenterService, /highlightOverlapStrategy:\s*'first-start-longest'/, 'highlight overlap rendering strategy must default to first-start-longest');
assert.match(settingsCenterService, /isHighlightOverlapStrategy\(settings\?\.highlightOverlapStrategy\) \? settings\.highlightOverlapStrategy : defaultExtendedSettings\.highlightOverlapStrategy/, 'extended settings must normalize highlight overlap rendering strategy');
assert.match(settingsPage, /highlightOverlapStrategyOptions/, 'settings page must define highlight overlap strategy options');
assert.match(settingsAnnotationPanel, /settings\.annotation\.highlightOverlapStrategy\.title/, 'settings page must render the highlight overlap strategy control');
assert.match(settingsAnnotationPanel, /updateExtendedSetting\('highlightOverlapStrategy', value\)/, 'highlight overlap strategy control must persist through extended settings');
assert.match(settingsCenterDefaultResetActions, /highlightOverlapStrategy:\s*defaultExtendedSettings\.highlightOverlapStrategy/, 'annotation group defaults must reset highlight overlap strategy');
assert.match(settingsCenterDefaultResetActions, /'highlightOverlapStrategy'/, 'annotation group reset keys must include highlight overlap strategy');
assert.match(readerModelTypes, /export type ReaderHighlightOverlapStrategy = 'first-start-longest' \| 'latest-created' \| 'highest-importance'/, 'reader model types must expose highlight overlap strategy type');
assert.match(readerModelSelection, /overlapStrategy\?: ReaderHighlightOverlapStrategy/, 'visible highlight resolver must accept an overlap strategy option');
assert.match(readerModelSelection, /latest-created/, 'visible highlight resolver must implement latest-created overlap handling');
assert.match(readerModelSelection, /highest-importance/, 'visible highlight resolver must implement highest-importance overlap handling');
assert.match(readerPage, /highlightOverlapStrategy=\{extendedSettings\.highlightOverlapStrategy\}/, 'reader page must pass configured highlight overlap strategy into ReaderContent');
assert.match(readerContent, /readerSearchHighlightColor,\s*highlightOverlapStrategy/, 'reader content must pass configured highlight overlap strategy into paragraph rendering');
assert.match(settingsCenterService, /anchorRepairStrategy:\s*'context-first' \| 'text-first' \| 'manual'/, 'extended settings must type annotation anchor repair strategy');
assert.match(settingsCenterService, /anchorRepairStrategy:\s*'context-first'/, 'annotation anchor repair strategy must default to context-first to preserve current automatic repair behavior');
assert.match(settingsCenterService, /isAnchorRepairStrategy\(settings\?\.anchorRepairStrategy\) \? settings\.anchorRepairStrategy : defaultExtendedSettings\.anchorRepairStrategy/, 'extended settings must normalize annotation anchor repair strategy');
assert.match(settingsPage, /anchorRepairStrategyOptions/, 'settings page must define annotation anchor repair strategy options');
assert.match(settingsAnnotationPanel, /settings\.annotation\.anchorRepairStrategy\.title/, 'settings page must render the annotation anchor repair strategy control');
assert.match(settingsAnnotationPanel, /updateExtendedSetting\('anchorRepairStrategy', value\)/, 'annotation anchor repair strategy control must persist through extended settings');
assert.match(settingsCenterDefaultResetActions, /anchorRepairStrategy:\s*defaultExtendedSettings\.anchorRepairStrategy/, 'annotation group defaults must reset annotation anchor repair strategy');
assert.match(settingsCenterDefaultResetActions, /'anchorRepairStrategy'/, 'annotation group reset keys must include annotation anchor repair strategy');
assert.match(readerModelTypes, /export type ReaderAnchorRepairStrategy = 'context-first' \| 'text-first' \| 'manual'/, 'reader model types must expose annotation anchor repair strategy type');
assert.match(readerModelNavigation, /repairStrategy\?: ReaderAnchorRepairStrategy/, 'annotation anchor resolver must accept a repair strategy option');
assert.match(readerModelNavigation, /text-first/, 'annotation anchor resolver must implement text-first repair handling');
assert.match(readerModelNavigation, /manual/, 'annotation anchor resolver must implement manual repair handling');
assert.match(readerWorkspaceModel, /resolveReaderAnnotationAnchorAfterTocEdits/, 'reader workspace model must use the annotation anchor resolver after TOC edits');
assert.match(readerWorkspaceDocument, /repairReaderHighlightsForCurrentToc\(highlights,\s*chapters,\s*hiddenChapters,\s*\{ repairStrategy: extendedSettings\.anchorRepairStrategy \}\)/, 'reader workspace document hook must pass configured anchor repair strategy into annotation migration');
assert.match(readerWorkspaceModel, /hiddenChapterIds/, 'reader workspace model must prevent hidden-chapter anchors from relocating to visible duplicate text');
assert.match(readerPage, /extendedSettings\.noteAutoReaderLocation/, 'reader page must apply the note-auto-reader-location setting');
assert.match(readerSelectionActions, /appendReaderLocationToAnnotationNote/, 'reader selection actions must append reader location URIs to annotation notes through the reader model');
assert.match(readerPage, /extendedSettings\.noteAutoContext/, 'reader page must apply the note-auto-context setting');
assert.match(readerSelectionActions, /appendReaderContextToAnnotationNote/, 'reader selection actions must append selected-text context to annotation notes through the reader model');
assert.match(readerPage, /extendedSettings\.noteTemplate/, 'reader page must apply the annotation note template setting');
assert.match(readerSelectionActions, /applyReaderAnnotationNoteTemplate/, 'reader selection actions must prefill annotation notes through the reader model template helper');
assert.match(readerAnnotationPanelController, /extendedSettings\.defaultBookmarkSort/, 'reader annotation panel controller must apply the default bookmark sort setting');
assert.match(readerAnnotationPanelController, /extendedSettings\.defaultBookmarkGroupBy/, 'reader annotation panel controller must apply the default bookmark grouping setting');
assert.match(readerPage, /extendedSettings\.arrowKeyPaging/, 'reader page must apply the arrow-key paging setting');
assert.match(readerPage, /extendedSettings\.spaceKeyPaging/, 'reader page must apply the space-key paging setting');
assert.match(readerPage, /extendedSettings\.escapeClosesPanels/, 'reader page must apply the Escape-close-panels setting');
assert.match(readerPage, /extendedSettings\.homeEndJump/, 'reader page must apply the Home-End jump setting');
assert.match(readerPage, /extendedSettings\.vimStyleNavigation/, 'reader page must apply the Vim-style navigation setting');
assert.match(readerPage, /extendedSettings\.readerShortcuts/, 'reader page must apply configurable reader shortcuts');
assert.match(readerPage, /matchesReaderShortcut/, 'reader page must match configurable reader shortcuts through a helper');
assert.match(readerPaginationController, /extendedSettings\.pageClickPaging/, 'reader pagination controller must apply the left-right page click paging setting');
assert.match(settingsCenterService, /gesturePagingEnabled:\s*boolean/, 'extended settings must type the touch gesture paging toggle');
assert.match(settingsCenterService, /gesturePagingEnabled:\s*true/, 'touch gesture paging should default on');
assert.match(settingsCenterService, /gesturePagingEnabled:\s*typeof settings\?\.gesturePagingEnabled === 'boolean' \? settings\.gesturePagingEnabled : defaultExtendedSettings\.gesturePagingEnabled/, 'extended settings must normalize the touch gesture paging toggle');
assert.match(settingsCenterService, /gesturePagingThresholdPx:\s*string/, 'extended settings must type the touch gesture paging threshold');
assert.match(settingsCenterService, /gesturePagingThresholdPx:\s*'96'/, 'touch gesture paging threshold should default to 96px');
assert.match(settingsCenterService, /gesturePagingThresholdPx:\s*clampNumericString\(settings\?\.gesturePagingThresholdPx,\s*defaultExtendedSettings\.gesturePagingThresholdPx,\s*40,\s*240\)/, 'extended settings must normalize the touch gesture paging threshold');
assert.match(settingsShortcutPanel, /settings\.shortcuts\.gesturePaging\.title/, 'settings shortcut panel must expose the touch gesture paging toggle');
assert.match(settingsShortcutPanel, /updateExtendedSetting\('gesturePagingEnabled', event\.target\.checked\)/, 'settings shortcut panel must persist the touch gesture paging toggle');
assert.match(settingsShortcutPanel, /settings\.shortcuts\.gesturePagingThreshold\.title/, 'settings shortcut panel must expose the touch gesture paging threshold');
assert.match(settingsShortcutPanel, /SettingsNumberInput[\s\S]*value=\{extendedSettings\.gesturePagingThresholdPx\}[\s\S]*onCommit=\{\(value\) => updateExtendedSetting\('gesturePagingThresholdPx', value\)\}/, 'settings shortcut panel must persist the touch gesture paging threshold on number-input commit');
assert.match(settingsCenterDefaultResetActions, /gesturePagingEnabled:\s*defaultExtendedSettings\.gesturePagingEnabled/, 'shortcut defaults must reset the touch gesture paging toggle');
assert.match(settingsCenterDefaultResetActions, /gesturePagingThresholdPx:\s*defaultExtendedSettings\.gesturePagingThresholdPx/, 'shortcut defaults must reset the touch gesture paging threshold');
assert.match(readerPaginationController, /extendedSettings\.gesturePagingEnabled/, 'reader pagination controller must apply the touch gesture paging setting');
assert.match(readerPage, /gesturePagingThresholdPx/, 'reader page must pass the touch gesture paging threshold to the pagination controller');
assert.match(readerPage, /extendedSettings\.autoHideCursor/, 'reader page must apply the auto-hide cursor setting');
assert.match(readerPage, /cursorHidden,\s*setCursorHidden/, 'reader page must track whether the cursor is currently hidden');
assert.match(readerPage, /reader-cursor-hidden/, 'reader page must render a class when the cursor has auto-hidden');
assert.match(readerPaginationController, /extendedSettings\.pageTurnSound/, 'reader pagination controller must apply the page-turn sound setting');
assert.match(readerPaginationController, /playReaderPageTurnSound/, 'reader pagination controller must play page-turn sounds through a dedicated helper');
assert.doesNotMatch(readerPage, /extendedSettings\.chapterNoticeDurationMs|readerChapterNotice|reader-chapter-notice/, 'reader page must not keep the removed cross-chapter notice setting or UI');
assert.doesNotMatch(settingsReaderPanel, /chapterNoticeDurationMs|翻页后章节提示显示时长|跨章节翻页后章节标题提示/, 'reader settings must not expose the removed redundant chapter-entry notice setting');
assert.doesNotMatch(settingsCenterDefaultResetActions, /chapterNoticeDurationMs/, 'reader default reset must not restore the removed redundant chapter-entry notice setting');
assert.match(readerPage, /extendedSettings\.virtualChapterRadius/, 'reader page must apply the virtual chapter render radius setting');
assert.match(readerPage, /extendedSettings\.virtualParagraphWindowSize/, 'reader page must apply the long-chapter paragraph window size setting');
assert.match(readerPage, /extendedSettings\.wheelPagingThresholdPx/, 'reader page must apply the wheel paging threshold setting');
assert.match(readerPage, /wheelPagingThresholdPx/, 'reader page must pass the configured wheel threshold to the pagination controller');
assert.match(readerPaginationController, /wheelPagingThresholdPx:/, 'reader pagination controller must pass the configured wheel threshold to the wheel intent model');
assert.match(readerWorkspaceState, /loadExtendedSettings/, 'reader workspace state hook must consume extended settings');
assert.match(readerWorkspaceDocument, /subscribeSettingsUpdated\(refreshExtendedSettings\)/, 'reader workspace document hook must listen to typed settings updates');
assert.match(readerWorkspaceDocument, /extendedSettings\.recordRecentReaderBooks/, 'reader workspace document hook must apply recent reader book recording');
assert.match(readerWorkspaceDocument, /const displayRecentBook = useMemo/, 'reader workspace document hook must derive the recent reader entry through privacy-aware display state');
assert.match(readerWorkspaceDocument, /shouldHideRecentReading\(extendedSettings\)/, 'reader workspace document hook must hide the recent reader entry when recording or privacy disables it');
assert.match(readerPage, /extendedSettings\.trackReadingTime/, 'ReaderPage must apply reading-time tracking');
assert.match(readerPage, /if \(!book \|\| !isActive \|\| settings\.privacyMode \|\| !extendedSettings\.trackReadingTime\) return;/, 'ReaderPage must disable reading-time tracking when inactive, setting, or privacy mode disables it');
assert.match(readerPage, /onProgressChange\?\./, 'ReaderPage must publish reading progress to the owning workspace instead of persisting statistics directly');
assert.match(readerWorkspaceState, /extendedSettings\.defaultHighlightColor/, 'reader workspace state hook must apply default highlight color when no book override exists');
assert.match(settingsCenterService, /highlightColorShortcuts:\s*Record<ExtendedSettings\['defaultHighlightColor'\], '1' \| '2' \| '3' \| '4' \| '5' \| '6' \| 'disabled'>/, 'extended settings must type per-color highlight shortcuts');
assert.match(settingsCenterService, /highlightColorShortcuts:\s*defaultHighlightColorShortcuts/, 'per-color highlight shortcuts must default to a shared mapping');
assert.match(settingsCenterService, /yellow:\s*'1'[\s\S]*green:\s*'2'[\s\S]*blue:\s*'3'[\s\S]*pink:\s*'4'[\s\S]*violet:\s*'5'[\s\S]*red:\s*'6'/, 'per-color highlight shortcuts must default yellow/green/blue/pink/violet/red to 1-6');
assert.match(settingsCenterService, /normalizeHighlightColorShortcuts\(settings\?\.highlightColorShortcuts\)/, 'extended settings must normalize per-color highlight shortcuts');
assert.match(settingsCenterService, /value === '1' \|\| value === '2' \|\| value === '3' \|\| value === '4' \|\| value === '5' \|\| value === '6' \|\| value === 'disabled'/, 'per-color highlight shortcut normalization must allow digits 1-6 and disabled only');
assert.match(settingsCenterService, /const usedShortcuts = new Set<ExtendedSettings\['highlightColorShortcuts'\]\[ExtendedSettings\['defaultHighlightColor'\]\]>\(\)/, 'per-color highlight shortcut normalization must track used digits');
assert.match(settingsCenterService, /if \(normalized !== 'disabled' && usedShortcuts\.has\(normalized\)\) return 'disabled'/, 'per-color highlight shortcut normalization must disable duplicate digits so every saved shortcut is reachable');
assert.match(settingsPage, /highlightColorShortcutOptions/, 'settings page must define per-color highlight shortcut options');
assert.match(settingsAnnotationPanel, /settings\.annotation\.highlightColorShortcuts\.title/, 'settings page must render per-color highlight shortcut controls');
assert.match(settingsCenterGeneralActions, /updateHighlightColorShortcut/, 'settings general actions must persist per-color highlight shortcut changes');
assert.match(settingsCenterGeneralActions, /if \(value !== 'disabled'\) \{[\s\S]*next\[shortcutColor\.value\] = 'disabled'[\s\S]*\}/, 'settings general actions must clear duplicate per-color highlight shortcut digits when a user assigns one color');
assert.match(settingsCenterDefaultResetActions, /highlightColorShortcuts:\s*defaultExtendedSettings\.highlightColorShortcuts/, 'annotation group defaults must reset per-color highlight shortcuts');
assert.match(settingsCenterDefaultResetActions, /'highlightColorShortcuts'/, 'annotation group reset keys must include per-color highlight shortcuts');
assert.match(settingsCenterSnapshotActions, /const savedExtended = saveExtendedSettings\(nextExtended,[\s\S]*setExtendedSettings\(savedExtended\)/, 'settings snapshot import must keep the page state normalized after saving extended settings');
assert.match(readerPage, /extendedSettings\.highlightColorShortcuts/, 'reader page must read per-color highlight shortcuts');
assert.match(readerPage, /getReaderHighlightColorShortcutMatch/, 'reader page must resolve pressed keys to highlight colors');
assert.match(readerPage, /createHighlightFromCurrentSelection\(shortcutColor\)/, 'reader page must create highlights with the matched shortcut color');
assert.match(settingsCenterService, /highlightColorMeanings:\s*Record<ExtendedSettings\['defaultHighlightColor'\], string>/, 'extended settings must type global highlight color meanings');
assert.match(settingsCenterService, /highlightColorMeanings:\s*defaultHighlightColorMeanings/, 'global highlight color meanings must default to all known highlight colors');
assert.match(settingsCenterService, /normalizeHighlightColorMeanings\(settings\?\.highlightColorMeanings\)/, 'extended settings must normalize global highlight color meanings');
assert.match(settingsAnnotationPanel, /settings\.annotation\.highlightColorMeanings\.title/, 'settings page must expose global highlight color meanings');
assert.match(settingsCenterGeneralActions, /updateHighlightColorMeaning/, 'settings general actions must let users edit each global highlight color meaning');
assert.match(settingsCenterDefaultResetActions, /highlightColorMeanings:\s*defaultExtendedSettings\.highlightColorMeanings/, 'annotation group defaults must reset global highlight color meanings');
assert.match(settingsCenterDefaultResetActions, /'highlightColorMeanings'/, 'annotation group reset keys must include global highlight color meanings');
assert.match(readerPage, /extendedSettings\.highlightColorMeanings/, 'reader page must use global highlight color meanings');
assert.match(readerAnnotationOverlays, /colorMeaningPlaceholder=\{highlightColorMeanings\[highlightViewer\.highlight\.color \?\? 'yellow'\]\}/, 'annotation overlays must pass the global color meaning into the extracted highlight drawer');
assert.match(readerAnnotationDrawers, /placeholder=\{colorMeaningPlaceholder \|\| t\('reader\.highlight\.colorMeaning'\)\}/, 'highlight drawer must expose global color meaning as a placeholder without overwriting the item value');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.defaultHighlightImportance/, 'reader workspace annotation actions must apply default highlight importance to new highlights');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.defaultHighlightReviewStatus/, 'reader workspace annotation actions must apply default highlight review status to new highlights');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.defaultBookmarkTags/, 'reader workspace annotation actions must apply default bookmark tags to new bookmarks');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.defaultBookmarkColor/, 'reader workspace annotation actions must apply default bookmark color to new bookmarks');
assert.match(readerWorkspaceAnnotationActions, /extendedSettings\.bookmarkTitleFromChapter/, 'reader workspace annotation actions must apply the bookmark title-from-chapter setting');
assert.match(readerWorkspaceAnnotationActions, /filterReaderAnnotationExportContent/, 'reader workspace annotation actions must filter exported annotations by the configured export content scope');
assert.match(readerWorkspaceAnnotationActions, /context\.extendedSettings\.annotationExportContent/, 'reader workspace annotation actions must pass the configured annotation export content scope');
assert.match(readerWorkspaceDocument, /resolveEffectiveReaderTheme\(settings\.theme, extendedSettings\.appTheme, extendedSettings\.readerThemeFollowsApp\)/, 'reader workspace must force a dark reading surface in app dark mode while respecting light-mode follow settings');
assert.match(readerWorkspaceDocument, /extendedSettings\.readerThemeFollowsApp/, 'reader workspace document hook must apply the reader-theme-follows-app setting');
assert.match(readerWorkspace, /extendedSettings\.readerShortcuts/, 'reader workspace must apply configurable reader workspace shortcuts');
assert.match(readerWorkspace, /matchesReaderWorkspaceShortcut/, 'reader workspace must match configurable reader workspace shortcuts through a helper');
assertAnnotationSettingsSectionIncludes('settings.annotation.section.title', [
  'settings.annotation.defaultExportFormat.title',
  'settings.annotation.annotationExportContent.title',
  'settings.annotation.annotationJsonImportConflictStrategy.title',
  'settings.annotation.annotationMarkdownTemplate.title',
  'settings.annotation.annotationExportLastDirectory.title',
  'settings.annotation.annotationCsvFields.title',
  'settings.annotation.ankiDefaultTags.title',
  'settings.annotation.obsidianWikiLinks.title',
  'settings.annotation.logseqPropertyFormat.title',
  'settings.annotation.readwiseDefaultAuthor.title',
  'settings.annotation.highlightFlashcardFrontTemplate.title',
  'settings.annotation.highlightFlashcardBackTemplate.title',
]);
assertShortcutSettingsSectionIncludes('settings.shortcuts.section.title', [
  'settings.shortcuts.globalShortcutsEnabled.title',
  'settings.shortcuts.commandPaletteShortcut.title',
  'settings.shortcuts.navigation.reader.title',
  'settings.shortcuts.navigation.library.title',
  'settings.shortcuts.navigation.search.title',
  'settings.shortcuts.importShortcut.title',
  'settings.shortcuts.aiSummaryShortcut.title',
  'settings.shortcuts.conflicts.title',
  'settings.shortcuts.reader.highlight.title',
  'settings.shortcuts.reader.bookmark.title',
  'settings.shortcuts.reader.aiPanel.title',
  'settings.shortcuts.reader.search.title',
]);
assert.match(readerWorkspacePersistence, /extendedSettings\.autoSaveReaderPosition/, 'reader workspace persistence hook must apply the auto-save reader position setting');
assert.match(readerWorkspacePersistence, /extendedSettings\.readerPositionSaveDebounceMs/, 'reader workspace persistence hook must apply the reader position save frequency setting');
assert.match(readerWorkspacePersistence, /extendedSettings\.multiWindowReaderSync/, 'reader workspace persistence hook must apply the multi-window reader sync setting');
assert.match(readerWorkspacePersistence, /extendedSettings\.multiWindowConflictStrategy/, 'reader workspace persistence hook must apply the multi-window conflict strategy setting');
assert.match(readerWorkspacePersistence, /applyReaderWindowState\(payload:\s*Partial<ReaderWindowStateEvent>,\s*force:\s*boolean\)[\s\S]*!force && !shouldAcceptReaderWindowState\(payload,\s*extendedSettings\.multiWindowConflictStrategy\)/, 'reader workspace persistence helper must pass the configured conflict strategy into the sync guard unless a dedicated handoff is forced');
assert.match(readerPage, /resolveReaderProgressPercent\(extendedSettings\.readerProgressMode/, 'reader page must apply the configured reader progress calculation mode through the progress resolver');
assert.match(readerInteractionModel, /computeReaderProgress/, 'reader progress resolver must use the reader progress model for character-based progress');
assert.match(readerInteractionModel, /computeReaderPageProgress/, 'reader progress resolver must use a dedicated helper for page-based progress');
assert.match(readerPage, /createReaderGoalProgress/, 'reader page must use the reader goal progress model');
assert.match(readerPage, /extendedSettings\.readerDailyGoalEnabled/, 'reader page must apply the reader daily goal toggle');
assert.match(readerPage, /readerDailyGoalPercent=\{readerDailyGoalPercent\}/, 'reader page must pass daily reading goal progress into ReaderToolbar');
assert.match(readerToolbar, /reader-goal-progress/, 'reader toolbar must render daily reading goal progress');
assert.match(readerPage, /parseBoundedInteger\(extendedSettings\.readerDailyPagesGoal,\s*30,\s*0,\s*1000\)/, 'reader page must clamp the reader daily pages goal');
assert.match(readerPage, /parseBoundedInteger\(extendedSettings\.readerDailyMinutesGoal,\s*30,\s*0,\s*1440\)/, 'reader page must clamp the reader daily minutes goal');
assert.match(readerPage, /parseBoundedInteger\(extendedSettings\.readerDailyChaptersGoal,\s*2,\s*0,\s*200\)/, 'reader page must clamp the reader daily chapters goal');
assert.match(readerWorkspace, /extendedSettings\.readerHistoryStackLimit/, 'reader workspace must apply the reader history stack length setting');
assert.match(readerWorkspace, /createReaderHistoryStack/, 'reader workspace must use the history stack model when recording reader locations');
assert.match(readerPage, /extendedSettings\.largeBookPerformanceMode/, 'reader page must apply large-book performance mode');
assert.match(readerPage, /const largeBookPerformanceMode = extendedSettings\.largeBookPerformanceMode/, 'reader page must derive a named large-book performance flag');
assert.match(readerPage, /largeBookPerformanceMode \? 1 : parseBoundedInteger\(extendedSettings\.virtualChapterRadius,\s*3,\s*0,\s*10\)/, 'large-book mode must shrink the virtual chapter render radius');
assert.match(readerPage, /largeBookPerformanceMode \? 40 : parseBoundedInteger\(extendedSettings\.virtualParagraphWindowSize,\s*80,\s*20,\s*240\)/, 'large-book mode must shrink the long-chapter paragraph window');
assert.match(readerPage, /extendedSettings\.readerPageCacheLimit/, 'reader page must apply the reader page cache limit setting');
assert.match(readerPage, /extendedSettings\.readerPagePreheatRange/, 'reader page must apply the reader page preheat range setting');
assert.match(readerPage, /extendedSettings\.readerPageCacheEnabled/, 'reader page must apply the reader page cache toggle');
assert.match(readerPage, /extendedSettings\.readerPagePreheatEnabled/, 'reader page must apply the reader page preheat toggle');
assert.match(readerPage, /extendedSettings\.readerPageMeasureCacheLimit/, 'reader page must apply the in-memory page measurement cache limit');
assert.match(readerPage, /extendedSettings\.readerFpsDiagnosticsEnabled/, 'reader page must apply the FPS diagnostics toggle');
assert.match(readerPage, /extendedSettings\.readerMemoryWarningEnabled/, 'reader page must apply the reader memory warning toggle');
assert.match(readerPage, /extendedSettings\.readerMemoryWarningThresholdMb/, 'reader page must apply the reader memory warning threshold');
assert.match(readerPage, /buildReaderMemoryDiagnostics/, 'reader page must build memory diagnostics through the reader helper');
assert.match(readerPage, /getBrowserMemorySnapshot/, 'reader page must sample browser memory through the reader helper');
assert.match(readerPage, /window\.setInterval\(sampleReaderMemoryDiagnostics,\s*5000\)/, 'reader memory diagnostics must sample on a bounded interval');
assert.match(readerPage, /parseBoundedInteger\(extendedSettings\.readerPageMeasureCacheLimit,\s*48,\s*1,\s*96\)/, 'reader page must clamp the in-memory page measurement cache limit');
assert.match(readerPageMeasurementController, /if \(pageMeasureCacheRef\.current\.size > readerPageMeasureCacheLimit\)/, 'reader page measurement controller must trim the in-memory page measurement cache by the configured limit');
assert.match(readerPage, /readerPageCacheEnabled \? parseBoundedInteger\(extendedSettings\.readerPageCacheLimit,\s*30,\s*0,\s*200\) : 0/, 'reader page cache toggle must gate persistent cache limit');
assert.match(readerPage, /readerPagePreheatEnabled \? parseBoundedInteger\(extendedSettings\.readerPagePreheatRange,\s*1,\s*0,\s*5\) : 0/, 'reader page preheat toggle must gate preheat range');
assert.match(readerPage, /largeBookPerformanceMode \? Math\.min\(10,\s*configuredReaderPageCacheLimit\) : configuredReaderPageCacheLimit/, 'large-book mode must cap the persistent page cache limit');
assert.match(readerPage, /largeBookPerformanceMode \? 0 : \(readerPagePreheatEnabled \? parseBoundedInteger\(extendedSettings\.readerPagePreheatRange,\s*1,\s*0,\s*5\) : 0\)/, 'large-book mode must disable adjacent page preheating');
assert.match(readerPageMeasurementController, /if \(persistentCacheKey && bookId && readerPageCacheEnabled\) savePersistentPageCache\(bookId,\s*persistentCacheKey,\s*measured,\s*readerPageCacheLimit\)/, 'reader page measurement controller must gate persistent cache saves by the cache toggle');
assert.match(readerPageMeasurementController, /if \(!bookId \|\| !readerPageCacheEnabled\) \{[\s\S]*measureAndStore\(\)/, 'reader page measurement controller must skip persistent cache loads when cache is disabled');
assert.match(readerPage, /if \(!extendedSettings\.readerFpsDiagnosticsEnabled \|\| !isActive\) \{[\s\S]*setReaderFpsDiagnostics\(null\)/, 'reader FPS diagnostics must stop and hide when disabled');
assert.match(readerPage, /fpsDiagnosticsFrameRef\.current = window\.requestAnimationFrame\(sampleReaderFpsDiagnostics\)/, 'reader FPS diagnostics must sample through requestAnimationFrame only after the toggle is enabled');
assert.match(readerPage, /reader-fps-diagnostics/, 'reader page must render an FPS diagnostics badge when enabled');
assert.match(readerPage, /if \(!extendedSettings\.readerMemoryWarningEnabled \|\| !isActive\) \{[\s\S]*setReaderMemoryDiagnostics\(null\)/, 'reader memory diagnostics must stop and hide when disabled');
assert.match(readerPage, /readerMemoryDiagnostics\?\.warning/, 'reader memory warning badge must render only when the threshold is exceeded');
assert.match(readerPage, /reader-memory-warning/, 'reader page must render a memory warning badge when the threshold is exceeded');
assert.match(readerMemoryDiagnostics, /performance as Performance & \{ memory\?: BrowserMemorySnapshot \}/, 'reader memory diagnostics must use the browser performance.memory API when available');
assert.match(readerMemoryDiagnostics, /supported:\s*false[\s\S]*warning:\s*false/, 'reader memory diagnostics must stay silent in unsupported browsers');
assert.match(packageJson, /"test:reader-memory-diagnostics"/, 'package scripts must include reader memory diagnostics tests');
assert.match(readerPageMeasurementController, /preheatAdjacentReaderPageCache/, 'reader page measurement controller must preheat adjacent page cache through a dedicated helper');
assert.match(readerContent, /settings\.titleAlign !== 'hidden'/, 'reader content must allow hiding chapter titles from the title alignment setting');
assert.match(readerContent, /settings\.titleOnlyOnChapterStart/, 'reader content must apply whether chapter titles only appear on the chapter start page');
assert.match(readerContent, /shouldShowReaderChapterTitle/, 'reader content must use a named helper for repeated chapter title visibility rules');
assert.match(readerPageMeasurementController, /titleOnlyOnChapterStart:\s*settings\.titleOnlyOnChapterStart/, 'reader page measurement cache must vary by repeated chapter title mode');
assert.match(readerContent, /formatReaderChapterTitle/, 'reader content must format displayed chapter titles through the title cleanup helper');
assert.match(readerContent, /settings\.titleNumberCleanup/, 'reader content must apply the configured title number cleanup mode');
assert.match(readerPageMeasurementController, /titleNumberCleanup:\s*settings\.titleNumberCleanup/, 'reader page measurement cache must vary by title number cleanup mode');
assert.match(readerPage, /title-decoration-\$\{visualSettings\.titleDecoration\}/, 'reader stage must expose the configured chapter title decoration mode, including live previews');
assert.match(readerContent, /headerFooterTimeFormat=\{settings\.headerFooterTimeFormat\}/, 'reader running info must receive the configured header/footer time format');
assert.match(readerContent, /formatReaderRunningInfoTime/, 'reader running info must format time through a dedicated helper');
assert.match(readerPageMeasurementController, /timeFormat:\s*settings\.headerFooterTimeFormat/, 'reader page measurement cache must vary by header/footer time format');
assert.match(readerContent, /headerFooterProgressFormat=\{settings\.headerFooterProgressFormat\}/, 'reader running info must receive the configured header/footer progress format');
assert.match(readerContent, /formatReaderRunningInfoProgress/, 'reader running info must format progress through a dedicated helper');
assert.match(readerSettings, /export const readerMinimumFontSizes/, 'reader settings must expose shared minimum readable font sizes');
assert.match(readerSettings, /fontSize:\s*clampReaderNumber\(settings\?\.fontSize,\s*defaultReaderSettings\.fontSize,\s*readerMinimumFontSizes\.fontSize,\s*42\)/, 'reader settings must clamp body font size to the readability minimum');
assert.match(readerSettings, /titleFontSize:\s*clampReaderNumber\(settings\?\.titleFontSize,\s*defaultReaderSettings\.titleFontSize,\s*readerMinimumFontSizes\.titleFontSize,\s*56\)/, 'reader settings must clamp title font size to the readability minimum');
assert.match(readerSettings, /headerFooterFontSize:\s*clampReaderNumber\(settings\?\.headerFooterFontSize,\s*defaultReaderSettings\.headerFooterFontSize,\s*readerMinimumFontSizes\.headerFooterFontSize,\s*18\)/, 'reader settings must clamp header/footer font size to the readability minimum');
assert.match(settingsReaderPanel, /readerMinimumFontSizes\.fontSize/, 'settings center body font slider must use the shared readability minimum');
assert.match(settingsReaderPanel, /readerMinimumFontSizes\.titleFontSize/, 'settings center title font slider must use the shared readability minimum');
assert.match(settingsReaderPanel, /readerMinimumFontSizes\.headerFooterFontSize/, 'settings center header/footer font slider must use the shared readability minimum');
assert.match(readerSettingsPanel, /readerMinimumFontSizes\.fontSize/, 'reader live body font slider must use the shared readability minimum');
assert.match(readerSettingsPanel, /readerMinimumFontSizes\.titleFontSize/, 'reader live title font slider must use the shared readability minimum');
assert.match(readerSettingsPanel, /readerMinimumFontSizes\.headerFooterFontSize/, 'reader live header/footer font slider must use the shared readability minimum');

for (const key of [
  'fontFamily',
  'customFontFamily',
  'fontFallbacks',
  'cjkPunctuationHanging',
  'mixedTextSpacing',
  'fontWeightBoost',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'paragraphSpacing',
  'firstLineIndent',
  'pageWidth',
  'pageGap',
  'pageVerticalAlign',
  'chapterStartsNewPage',
  'longParagraphStrategy',
  'bodyMarginX',
  'bodyMarginY',
  'narrowBodyMarginX',
  'narrowBodyMarginY',
  'headerVisible',
  'footerVisible',
  'headerLeft',
  'headerCenter',
  'headerRight',
  'footerLeft',
  'footerCenter',
  'footerRight',
  'headerFooterCustomFormat',
  'headerFooterTimeFormat',
  'headerFooterProgressFormat',
  'headerFooterFontSize',
  'headerFooterOpacity',
  'titleAlign',
  'titleOnlyOnChapterStart',
  'titleNumberCleanup',
  'titleDecoration',
  'titleFontSize',
  'titleMarginTop',
  'titleMarginBottom',
  'pageAnimation',
  'wheelPaging',
  'touchpadNaturalScroll',
  'preserveBlankLines',
  'privacyMode',
  'encryptSensitiveReaderData',
]) {
  assert.match(settingsReaderPanel, new RegExp(`['"]${key}['"]`), `reader setting ${key} must be exposed in the extracted global reader settings panel`);
}

assert.match(settingsCenterModel, /chapters: \{ label: 'settings\.group\.chapters\.label'/, 'settings navigation model must expose the localized chapter parsing group label');
for (const text of [
  'settings.chapter.maxHeadingLength.title',
  'settings.chapter.enableSpecialHeadings.title',
  'settings.chapter.tocTitleGroupKeywords.title',
  'settings.chapter.compactHeadingSuffixLength.title',
  'settings.chapter.adKeywords.title',
]) {
  assert.match(settingsChapterPanel, new RegExp(text), `chapter parsing settings panel must expose ${text}`);
}

for (const key of ['aiApiKey', 'aiApiBaseUrl', 'aiEndpointMode', 'aiModel']) {
  assert.match(settingsAiPanel, new RegExp(key), `app setting ${key} must remain exposed`);
}
for (const key of ['operationLogLevel']) {
  assert.match(settingsDiagnosticsPanel, new RegExp(key), `app setting ${key} must remain exposed`);
}
for (const key of ['trashRetentionDays', 'trashAutoCleanupEnabled']) {
  assert.match(settingsLibraryPanel, new RegExp(key), `app setting ${key} must remain exposed`);
}

for (const key of [
  'startupPage',
  'openLastReaderBookOnStartup',
  'restoreLastReaderPositionOnStartup',
  'checkUnfinishedTasksOnStartup',
  'refreshLibraryMetadataOnStartup',
  'startupOverviewMode',
  'rememberWindowGeometry',
  'backgroundTaskNotificationMode',
  'refreshLibraryOnTaskCompletion',
  'taskCenterDefaultStatusFilter',
  'confirmOpenExternalPath',
  'autoShowTaskCenterForLongOperations',
  'errorDetailsDefaultExpanded',
  'appTheme',
  'customThemeColor',
  'sidebarCollapsed',
  'readerThemeFollowsApp',
  'reduceMotion',
  'highContrast',
  'enhancedFocus',
  'largeTouchTargets',
  'colorBlindFriendlyHighlights',
  'sidebarRecentBookLimit',
  'pageTitleMode',
  'visibleNavItems',
  'topbarButtonVisibility',
  'libraryPanelPersistent',
  'globalShortcutsEnabled',
  'commandPaletteIncludesSettings',
  'commandPaletteShortcut',
  'commandPaletteShowDescriptions',
  'commandPaletteSortMode',
  'navigationShortcuts',
  'importShortcut',
  'aiSummaryShortcut',
  'defaultViewMode',
  'defaultSort',
  'defaultFilter',
  'duplicateStrategy',
  'openImportedBookAfterImport',
  'confirmMoveToTrash',
  'confirmPermanentDelete',
  'confirmEmptyTrash',
  'showEmptyLibraryGuide',
  'rememberLibraryTabState',
  'showLibraryDetailSidebar',
  'libraryDensity',
  'searchScope',
  'searchLimit',
  'globalSearchMode',
  'globalSearchDebounceMs',
  'globalSearchSnippetLength',
  'globalSearchShowScore',
  'globalSearchHistoryLimit',
  'globalSearchSavedLimit',
  'caseSensitive',
  'fuzzy',
  'regex',
  'readerSearchRegexFallbackLiteral',
  'searchNormalizeTraditionalChinese',
  'searchNormalizeNfkc',
  'searchPinyinInitials',
  'readerSearchHistoryLimit',
  'readerSavedSearchLimit',
  'readerSearchChapterFilterDefault',
  'readerSearchHighlightColor',
  'defaultHighlightColor',
  'highlightColorShortcuts',
  'highlightColorMeanings',
  'defaultHighlightImportance',
  'defaultHighlightReviewStatus',
  'highlightOverlapStrategy',
  'anchorRepairStrategy',
  'defaultExportFormat',
  'annotationExportContent',
  'annotationMarkdownTemplate',
  'annotationExportLastDirectory',
  'ankiDefaultTags',
  'obsidianWikiLinks',
  'logseqPropertyFormat',
  'readwiseDefaultAuthor',
  'knowledgeBidirectionalLinksEnabled',
  'knowledgeHighlightCardTemplate',
  'knowledgeNoteCardTemplate',
  'knowledgeFlashcardCardTemplate',
  'highlightFlashcardFrontTemplate',
  'highlightFlashcardBackTemplate',
  'annotationTagSuggestionsEnabled',
  'annotationCsvFields',
  'annotationMarkdownEditorEnabled',
  'selectionMenuEnabled',
  'doubleClickWordSelectionEnabled',
  'contextMenuEnabled',
  'openNoteAfterHighlight',
  'allowEmptyNotes',
  'noteAutoReaderLocation',
  'noteAutoContext',
  'noteTemplate',
  'defaultBookmarkSort',
  'defaultBookmarkGroupBy',
  'defaultBookmarkTags',
  'defaultBookmarkColor',
  'bookmarkTitleFromChapter',
  'arrowKeyPaging',
  'spaceKeyPaging',
  'escapeClosesPanels',
  'homeEndJump',
  'vimStyleNavigation',
  'readerShortcuts',
  'pageClickPaging',
  'gesturePagingEnabled',
  'gesturePagingThresholdPx',
  'autoHideCursor',
  'pageTurnSound',
  'virtualChapterRadius',
  'virtualParagraphWindowSize',
  'wheelPagingThresholdPx',
  'autoSaveReaderPosition',
  'readerPositionSaveDebounceMs',
  'multiWindowReaderSync',
  'multiWindowConflictStrategy',
  'readerProgressMode',
  'readerHistoryStackLimit',
  'readerDailyGoalEnabled',
  'readerDailyPagesGoal',
  'readerDailyMinutesGoal',
  'readerDailyChaptersGoal',
  'recordRecentReaderBooks',
  'trackReadingTime',
  'largeBookPerformanceMode',
  'readerPageCacheEnabled',
  'readerPagePreheatEnabled',
  'readerPageMeasureCacheLimit',
  'readerFpsDiagnosticsEnabled',
  'readerMemoryWarningEnabled',
  'readerMemoryWarningThresholdMb',
  'readerPageCacheLimit',
  'readerPagePreheatRange',
  'aiStreamingFlushIntervalMs',
  'taskConcurrency',
  'taskRetryCount',
  'operationLogRetention',
]) {
  assert.match(settingsSurfaces, new RegExp(key), `extended setting ${key} must be exposed as a real persisted setting`);
}

assert.match(styles, /\.settings-center-shell/, 'settings center shell must be styled');
assert.match(styles, /\.settings-sidebar/, 'settings sidebar must be styled');
assert.match(styles, /\.settings-section-card/, 'settings section cards must be styled');
assert.match(styles, /\.library-content\.density-compact/, 'library compact density must have CSS');
assert.match(styles, /\.library-content\.density-spacious/, 'library spacious density must have CSS');
assert.match(readerStyles, /\.reader-canvas\.theme-system/, 'reader system theme must have explicit CSS');
assert.match(readerStyles, /\.reader-canvas\.theme-oled/, 'reader OLED theme must have explicit CSS');
assert.match(readerStyles, /\.reader-search-mark\.color-amber/, 'reader search hit amber color must have CSS');
assert.match(readerStyles, /\.reader-search-mark\.color-blue/, 'reader search hit blue color must have CSS');
assert.match(styles, /\.reduce-motion/, 'settings center reduce motion setting must have CSS behavior');
assert.match(styles, /\.high-contrast/, 'settings center high contrast setting must have CSS behavior');
assert.match(styles, /\.enhanced-focus/, 'settings center enhanced focus setting must have CSS behavior');
assert.match(styles, /\.topbar-title\.compact/, 'compact page title mode must have CSS behavior');
assert.match(styles, /\.app-shell\.library-panel-hidden/, 'library panel persistence setting must have CSS behavior');
assert.match(styles, /--indigo/, 'custom theme color must map onto the shared app accent CSS variable');
assert.match(styles, /\.settings-color-row/, 'custom theme color row must have CSS');
assert.match(styles, /\.settings-color-input/, 'custom theme color input must have CSS');
assert.match(readerStyles, /\.reader-page::before/, 'reader paper texture strength must render through a reader page pseudo element');
assert.match(readerStyles, /var\(--reader-paper-texture-strength\)/, 'reader paper texture CSS must use the configured texture strength variable');
assert.match(readerStyles, /\.reader-stage\.reader-custom-colors \.reader-page/, 'reader custom colors must only apply when explicitly enabled');
assert.match(readerStyles, /background:\s*var\(--reader-custom-background-color\)/, 'reader custom background color must override the page background');
assert.match(readerStyles, /color:\s*var\(--reader-custom-text-color\)/, 'reader custom text color must override page text');
assert.match(readerStyles, /::selection[\s\S]*var\(--reader-custom-selection-color\)/, 'reader custom selection color must apply to temporary browser selection');
assert.match(readerStyles, /\.reader-fps-diagnostics/, 'reader FPS diagnostics badge must have CSS');
assert.match(readerStyles, /\.reader-memory-warning/, 'reader memory warning badge must have CSS');

assert.match(types, /paperTextureStrength:\s*number/, 'reader settings must type paper texture strength');
assert.match(types, /eyeComfortBackgroundStrength:\s*number/, 'reader settings must type eye-comfort background strength');
assert.match(types, /paperBackgroundStrength:\s*number/, 'reader settings must type paper background strength');
assert.match(types, /customBackgroundColor:\s*string/, 'reader settings must type custom reader background color');
assert.match(types, /customTextColor:\s*string/, 'reader settings must type custom reader text color');
assert.match(types, /customSelectionColor:\s*string/, 'reader settings must type custom reader selection color');
assert.match(readerSettings, /paperTextureStrength:\s*0\.18/, 'reader settings must default paper texture strength');
assert.match(readerSettings, /eyeComfortBackgroundStrength:\s*1/, 'reader settings must default eye-comfort background strength');
assert.match(readerSettings, /paperBackgroundStrength:\s*1/, 'reader settings must default paper background strength');
assert.match(readerSettings, /customBackgroundColor:\s*''/, 'reader settings must default custom reader background color to empty');
assert.match(readerSettings, /customTextColor:\s*''/, 'reader settings must default custom reader text color to empty');
assert.match(readerSettings, /customSelectionColor:\s*''/, 'reader settings must default custom reader selection color to empty');
assert.match(readerSettings, /normalizeOptionalHexColor\(settings\?\.customBackgroundColor\)/, 'reader settings must normalize custom reader background color');
assert.match(readerSettings, /normalizeOptionalHexColor\(settings\?\.customTextColor\)/, 'reader settings must normalize custom reader text color');
assert.match(readerSettings, /normalizeOptionalHexColor\(settings\?\.customSelectionColor\)/, 'reader settings must normalize custom reader selection color');
assert.match(settingsReaderPanel, /paperTextureStrength/, 'settings page must expose paper texture strength');
assert.match(settingsReaderPanel, /slider\('paperTextureStrength',\s*tr\('settings\.reader\.paperTextureStrength\.title'\)/, 'settings page must render localized paper texture strength as a slider');
assert.match(settingsReaderPanel, /slider\('eyeComfortBackgroundStrength',\s*tr\('settings\.reader\.eyeComfortBackgroundStrength\.title'\)/, 'settings page must render localized eye-comfort background strength as a slider');
assert.match(settingsReaderPanel, /slider\('paperBackgroundStrength',\s*tr\('settings\.reader\.paperBackgroundStrength\.title'\)/, 'settings page must render localized paper background strength as a slider');
assert.match(settingsReaderPanel, /colorSetting\('customBackgroundColor',\s*tr\('settings\.reader\.customBackgroundColor\.title'\)/, 'settings page must render localized custom reader background color as a color setting');
assert.match(settingsReaderPanel, /colorSetting\('customTextColor',\s*tr\('settings\.reader\.customTextColor\.title'\)/, 'settings page must render localized custom reader text color as a color setting');
assert.match(settingsReaderPanel, /colorSetting\('customSelectionColor',\s*tr\('settings\.reader\.customSelectionColor\.title'\)/, 'settings page must render localized custom reader selection color as a color setting');
assert.match(readerSettings, /READER_CUSTOM_PRESETS_KEY/, 'reader settings must persist custom reader presets through a stable key');
assert.match(readerSettings, /export type ReaderCustomPreset/, 'reader settings must type custom reader presets');
assert.match(readerSettings, /loadReaderCustomPresets/, 'reader settings must load custom reader presets');
assert.match(readerSettings, /saveReaderCustomPreset/, 'reader settings must save the current reader settings as a custom preset');
assert.match(readerSettings, /renameReaderCustomPreset/, 'reader settings must support renaming custom reader presets');
assert.match(readerSettings, /deleteReaderCustomPreset/, 'reader settings must support deleting custom reader presets');
assert.match(readerSettings, /exportReaderCustomPresets/, 'reader settings must support exporting custom reader presets');
assert.match(readerSettings, /importReaderCustomPresets/, 'reader settings must support importing custom reader presets');
assert.match(settingsPage, /readerCustomPresets/, 'settings page must hold custom reader presets in state');
assert.match(settingsCenterReaderActions, /createSettingsReaderActions/, 'settings reader actions must be created through a dedicated action facade');
assert.match(settingsCenterReaderActions, /updateReaderGlobalSetting/, 'settings reader actions must own global reader setting updates');
assert.match(settingsCenterReaderActions, /updateReaderFontStack/, 'settings reader actions must own reader font stack updates');
assert.match(settingsCenterReaderActions, /parseReaderFontFallbackInput/, 'settings reader actions must own reader font fallback parsing');
assert.match(settingsCenterReaderActions, /applyReaderGlobalPreset/, 'settings reader actions must own applying global reader presets');
assert.match(settingsCenterReaderActions, /saveCurrentReaderSettingsAsPreset/, 'settings reader actions must own saving current reader settings as a custom preset');
assert.doesNotMatch(settingsPage, /function updateReaderGlobalSetting/, 'settings page must not inline global reader setting action implementation');
assert.doesNotMatch(settingsPage, /function updateReaderFontStack/, 'settings page must not inline reader font stack action implementation');
assert.doesNotMatch(settingsPage, /function saveCurrentReaderSettingsAsPreset/, 'settings page must not inline custom reader preset save implementation');
assert.match(settingsPage, /createSettingsReaderActions/, 'settings page must compose the extracted settings reader actions');
assert.match(settingsCenterReaderActions, /saveCurrentReaderSettingsAsPreset/, 'settings reader actions must expose saving current reader settings as a custom preset');
assert.match(settingsReaderPanel, /tr\('settings\.reader\.customPreset\.save'\)/, 'settings page must render a localized save-current-settings-as-preset action');
assert.match(settingsCenterReaderActions, /applyReaderCustomPreset/, 'settings reader actions must allow applying a saved custom reader preset');
assert.match(settingsCenterReaderActions, /renameReaderCustomPresetFromSettings/, 'settings reader actions must expose custom preset rename actions');
assert.match(settingsCenterReaderActions, /deleteReaderCustomPresetFromSettings/, 'settings reader actions must expose custom preset delete actions');
assert.match(settingsPage, /onApplyPresetToCurrentBook/, 'settings page must expose applying a custom preset to the current book');
assert.match(settingsReaderPanel, /tr\('settings\.reader\.action\.applyToCurrentBook'\)/, 'settings page must render a localized apply-preset-to-current-book action');
assert.match(settingsCenterReaderActions, /exportReaderCustomPresetsFromSettings/, 'settings reader actions must expose custom preset export');
assert.match(settingsCenterReaderActions, /importReaderCustomPresetsFromSettings/, 'settings reader actions must expose custom preset import');


console.log('Verified settings center reader/search contracts.');

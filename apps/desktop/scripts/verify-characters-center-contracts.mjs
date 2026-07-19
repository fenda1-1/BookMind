import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const charactersPage = readFileSync('src/pages/CharactersPage.tsx', 'utf8');
const characterPageUtils = readFileSync('src/pages/CharacterPageUtils.tsx', 'utf8');
const characterWorkbenchViewsPath = 'src/features/characters/CharacterWorkbenchViews.tsx';
assert.ok(existsSync(characterWorkbenchViewsPath), 'character workbench views must live in CharacterWorkbenchViews');
const characterWorkbenchViews = readFileSync(characterWorkbenchViewsPath, 'utf8');
const characterCenterState = readFileSync('src/features/characters/characterCenterState.ts', 'utf8');
const characterCenterBooks = readFileSync('src/features/characters/characterCenterBooks.ts', 'utf8');
const characterCenterSessionPath = 'src/features/characters/characterCenterSession.ts';
assert.ok(existsSync(characterCenterSessionPath), 'Character Center session state and cache helpers must live in characterCenterSession.ts');
const characterCenterSession = readFileSync(characterCenterSessionPath, 'utf8');
const characterCenterService = readFileSync('src/services/characterCenterService.ts', 'utf8');
const characterProfileDetail = readFileSync('src/features/characters/characterProfileDetail.ts', 'utf8');
const characterOverviewMetrics = readFileSync('src/features/characters/characterOverviewMetrics.ts', 'utf8');
const characterOverviewSummary = readFileSync('src/features/characters/characterOverviewSummary.ts', 'utf8');
const characterGraphModel = readFileSync('src/features/characters/characterGraphModel.ts', 'utf8');
const characterGraphCanvasModel = readFileSync('src/features/characters/characterGraphCanvasModel.ts', 'utf8');
const characterGraphCanvasView = readFileSync('src/features/characters/CharacterGraphCanvasView.tsx', 'utf8');
const characterGraphCanvasRuntimePath = 'src/features/characters/characterGraphCanvasRuntime.ts';
assert.ok(existsSync(characterGraphCanvasRuntimePath), 'Character graph canvas drawing, hit testing, and viewport math must live in characterGraphCanvasRuntime.ts');
const characterGraphCanvasRuntime = readFileSync(characterGraphCanvasRuntimePath, 'utf8');
const characterGraphRenderModelPath = 'src/features/characters/characterGraphRenderModel.ts';
assert.ok(existsSync(characterGraphRenderModelPath), 'Character graph retained render model must live in characterGraphRenderModel.ts');
const characterGraphRenderModel = readFileSync(characterGraphRenderModelPath, 'utf8');
const characterGraphWebglRendererPath = 'src/features/characters/characterGraphWebglRenderer.ts';
assert.ok(existsSync(characterGraphWebglRendererPath), 'Character graph WebGL renderer must live in characterGraphWebglRenderer.ts');
const characterGraphWebglRenderer = readFileSync(characterGraphWebglRendererPath, 'utf8');
const characterGraphWebglViewPath = 'src/features/characters/CharacterGraphWebglView.tsx';
assert.ok(existsSync(characterGraphWebglViewPath), 'Character graph WebGL React adapter must live in CharacterGraphWebglView.tsx');
const characterGraphWebglView = readFileSync(characterGraphWebglViewPath, 'utf8');
const characterGraphWebglPointerMoveSource = extractSourceBetween(
  characterGraphWebglView,
  'function handlePointerMove',
  'function handlePointerUp',
);
const characterRelationGraphViewPath = 'src/features/characters/CharacterRelationGraphView.tsx';
assert.ok(existsSync(characterRelationGraphViewPath), 'Character relationship graph workbench must live in CharacterRelationGraphView');
const characterRelationGraphView = readFileSync(characterRelationGraphViewPath, 'utf8');
const characterGraphLayoutWorker = readFileSync('src/features/characters/characterGraphLayoutWorker.ts', 'utf8');
const characterGraphEdgeDetail = readFileSync('src/features/characters/characterGraphEdgeDetail.ts', 'utf8');
const characterAppearanceHeatmap = readFileSync('src/features/characters/characterAppearanceHeatmap.ts', 'utf8');
const characterEvidenceCitation = readFileSync('src/features/characters/characterEvidenceCitation.ts', 'utf8');
const characterEvidenceTable = readFileSync('src/features/characters/CharacterEvidenceTable.tsx', 'utf8');
const characterExportFormatAdaptersPath = 'src/features/characters/characterExportFormatAdapters.ts';
assert.ok(existsSync(characterExportFormatAdaptersPath), 'Character export format adapters must live in characterExportFormatAdapters.ts');
const characterExportFormatAdapters = readFileSync(characterExportFormatAdaptersPath, 'utf8');
const characterExportModel = readFileSync('src/features/characters/characterExportModel.ts', 'utf8');
const characterReviewQueue = readFileSync('src/features/characters/characterReviewQueue.ts', 'utf8');
const characterListModel = readFileSync('src/features/characters/characterListModel.ts', 'utf8');
const characterListViewport = readFileSync('src/features/characters/characterListViewport.ts', 'utf8');
const characterEvidenceNavigation = readFileSync('src/features/characters/characterEvidenceNavigation.ts', 'utf8');
const characterFailureDiagnostics = readFileSync('src/features/characters/characterFailureDiagnostics.ts', 'utf8');
const typesSource = readFileSync('src/types.ts', 'utf8');
const appSource = readFileSync('src/app/App.tsx', 'utf8');
const appShellModel = readFileSync('src/app/appShellModel.ts', 'utf8');
const useCharacterCenter = readFileSync('src/app/useCharacterCenter.ts', 'utf8');
const characterPageRenderers = readFileSync('src/pages/CharacterPageRenderers.tsx', 'utf8');
const appTaskActions = readFileSync('src/app/appTaskActions.ts', 'utf8');
const taskService = readFileSync('src/services/taskService.ts', 'utf8');
const libraryPage = readFileSync('src/pages/LibraryPage.tsx', 'utf8');
const libraryBookMenus = readFileSync('src/features/library/LibraryBookMenus.tsx', 'utf8');
const libraryBookViews = readFileSync('src/features/library/LibraryBookViews.tsx', 'utf8');
const readerWorkspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const readerPagePropsBuilder = readFileSync('src/pages/reader-workspace/ReaderPagePropsBuilder.ts', 'utf8');
const readerPage = readFileSync('src/features/reader-core/ReaderPage.tsx', 'utf8');
const readerToolbar = readFileSync('src/features/reader-core/ReaderToolbar.tsx', 'utf8');
function readLocaleTree(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return readLocaleTree(path);
    return /\.ts$/u.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  });
}

const zhCN = [readFileSync('src/i18n/zh-CN.ts', 'utf8'), ...readLocaleTree('src/i18n/messages/zhCN')].join('\n');
const enUS = [readFileSync('src/i18n/en-US.ts', 'utf8'), ...readLocaleTree('src/i18n/messages/enUS')].join('\n');
const styles = [
  readFileSync('src/app/styles.css', 'utf8'),
  readFileSync('src/app/styles/base.css', 'utf8'),
  readFileSync('src/app/styles/layout.css', 'utf8'),
  readFileSync('src/app/styles/characters.css', 'utf8'),
].join('\n');
const tauriCharacterEntryPath = 'src-tauri/src/characters/mod.rs';
assert.ok(existsSync(tauriCharacterEntryPath), 'Backend character command orchestration must live in characters/mod.rs');
const tauriCharacters = readFileSync(tauriCharacterEntryPath, 'utf8');
assert.ok(!existsSync('src-tauri/src/characters.rs'), 'Backend character root file must move into characters/mod.rs');
const tauriCharacterStatusPath = 'src-tauri/src/characters/status.rs';
assert.ok(existsSync(tauriCharacterStatusPath), 'Backend character index status logic must live in characters/status.rs');
const tauriCharacterStatus = readFileSync(tauriCharacterStatusPath, 'utf8');
const tauriCharacterRelationsPath = 'src-tauri/src/characters/relations.rs';
assert.ok(existsSync(tauriCharacterRelationsPath), 'Backend character relation building must live in characters/relations.rs');
const tauriCharacterRelations = readFileSync(tauriCharacterRelationsPath, 'utf8');
const tauriCharacterOverviewPath = 'src-tauri/src/characters/overview.rs';
assert.ok(existsSync(tauriCharacterOverviewPath), 'Backend character overview snapshot logic must live in characters/overview.rs');
const tauriCharacterOverview = readFileSync(tauriCharacterOverviewPath, 'utf8');
const tauriCharacterIoPath = 'src-tauri/src/characters/io.rs';
assert.ok(existsSync(tauriCharacterIoPath), 'Backend character JSON and JSONL IO helpers must live in characters/io.rs');
const tauriCharacterIo = readFileSync(tauriCharacterIoPath, 'utf8');
const tauriCharacterEventsPath = 'src-tauri/src/characters/events.rs';
assert.ok(existsSync(tauriCharacterEventsPath), 'Backend character event and appearance stats logic must live in characters/events.rs');
const tauriCharacterEvents = readFileSync(tauriCharacterEventsPath, 'utf8');
const tauriCharacterNameRulesPath = 'src-tauri/src/characters/name_rules.rs';
assert.ok(existsSync(tauriCharacterNameRulesPath), 'Backend character name classification rules must live in characters/name_rules.rs');
const tauriCharacterNameRules = readFileSync(tauriCharacterNameRulesPath, 'utf8');
const tauriCharacterFiltersPath = 'src-tauri/src/characters/filters.rs';
assert.ok(existsSync(tauriCharacterFiltersPath), 'Backend character non-person filters must live in characters/filters.rs');
const tauriCharacterFilters = readFileSync(tauriCharacterFiltersPath, 'utf8');
const tauriCharacterExtractionPath = 'src-tauri/src/characters/extraction.rs';
assert.ok(existsSync(tauriCharacterExtractionPath), 'Backend character candidate extraction must live in characters/extraction.rs');
const tauriCharacterExtraction = readFileSync(tauriCharacterExtractionPath, 'utf8');
const tauriCharacterIdsPath = 'src-tauri/src/characters/ids.rs';
assert.ok(existsSync(tauriCharacterIdsPath), 'Backend character stable ids and hashes must live in characters/ids.rs');
const tauriCharacterIds = readFileSync(tauriCharacterIdsPath, 'utf8');
const tauriCharacterTestsPath = 'src-tauri/src/characters/tests.rs';
assert.ok(existsSync(tauriCharacterTestsPath), 'Backend character Rust tests must live in characters/tests.rs');
const tauriCharacterTests = readFileSync(tauriCharacterTestsPath, 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const readLimitedJsonArrayFileSource = extractSourceBetween(
  tauriCharacterIo,
  'fn read_limited_json_array_file',
  'fn read_until_json_array_start',
);

assert.equal(packageJson.scripts['test:characters-center'], 'node src/features/characters/characterToolbarTooltips.test.mjs && node scripts/verify-characters-center-contracts.mjs && node src/features/characters/characterCenterState.test.mjs && node src/features/characters/characterCenterBooks.test.mjs && node src/features/characters/characterCenterSession.test.mjs && node src/features/characters/characterEvidenceNavigation.test.mjs && node src/features/characters/characterEvidenceCitation.test.mjs && node src/features/characters/characterProfileDetail.test.mjs && node src/features/characters/characterOverviewMetrics.test.mjs && node src/features/characters/characterOverviewSummary.test.mjs && node src/features/characters/characterGraphModel.test.mjs && node src/features/characters/characterGraphCanvasModel.test.mjs && node src/features/characters/characterGraphCanvasSessionCache.test.mjs && node src/features/characters/characterGraphRenderModel.test.mjs && node src/features/characters/characterGraphEdgeDetail.test.mjs && node src/features/characters/characterListModel.test.mjs && node src/features/characters/characterListViewport.test.mjs && node src/features/characters/characterFailureDiagnostics.test.mjs && node src/features/characters/characterAppearanceHeatmap.test.mjs && node src/features/characters/characterExportModel.test.mjs && node src/features/characters/characterReviewQueue.test.mjs', 'package.json must define test:characters-center');
assert.equal(packageJson.scripts['benchmark:character-overview'], 'node scripts/benchmark-character-overview-entry.mjs', 'package.json must expose the Character overview entry benchmark');
assert.match(characterExportModel, /export const characterExportSchemaVersion = 'bookmind\.character-export\.v1'/, 'Character export model must publish a stable schema version for Markdown, JSON, and CSV exports');
assert.match(typesSource, /export type CharacterExportFormat = 'markdown' \| 'json' \| 'csv' \| 'relations-json' \| 'mentions-jsonl' \| 'mermaid' \| 'graphml' \| 'cytoscape-json'/, 'Character export format must expose Markdown, JSON, CSV, relations JSON, mentions JSONL, Mermaid, GraphML, and Cytoscape formats');
assert.match(typesSource, /export type CharacterMarkdownExportStyle = 'standard' \| 'obsidian' \| 'logseq'/, 'Character export options must expose standard, Obsidian, and Logseq Markdown styles');
assert.match(typesSource, /export type CharacterSpoilerLimit = \{[\s\S]*sourceChapterIndex\?: number;[\s\S]*paragraphIndex\?: number;[\s\S]*\};/, 'Character export options must expose a shared no-spoiler reading position contract');
assert.match(typesSource, /export type CharacterExportOptions = \{[\s\S]*format: CharacterExportFormat;[\s\S]*markdownStyle\?: CharacterMarkdownExportStyle;/, 'Character export options must be shared from the public app types contract');
assert.match(typesSource, /export type CharacterExportOptions = \{[\s\S]*spoilerLimit\?: CharacterSpoilerLimit;/, 'Character export options must allow exports to be constrained to the current reading position');
assert.match(characterExportModel, /CharacterExportOptions,[\s\S]*\} from '\.\.\/\.\.\/types'/, 'Character export model must consume the shared public CharacterExportOptions type');
assert.match(characterExportModel, /from '\.\/characterExportFormatAdapters'/, 'Character export model must delegate format-specific file rendering to characterExportFormatAdapters');
assert.match(characterExportFormatAdapters, /export function buildCharacterMarkdownExportFile/, 'Character Markdown export adapter must live outside the core export scope model');
assert.match(characterExportFormatAdapters, /export function buildCharacterCsvExportFiles/, 'Character CSV export adapter must live outside the core export scope model');
assert.match(characterExportFormatAdapters, /export function buildCharacterRelationsJsonExportFile/, 'Character relations JSON export adapter must live outside the core export scope model');
assert.match(characterExportFormatAdapters, /export function buildCharacterMentionsJsonlExportFile/, 'Character mentions JSONL export adapter must live outside the core export scope model');
assert.match(characterExportFormatAdapters, /export function buildCharacterMermaidExportFile/, 'Character Mermaid export adapter must live outside the core export scope model');
assert.match(characterExportFormatAdapters, /export function buildCharacterGraphmlExportFile/, 'Character GraphML export adapter must live outside the core export scope model');
assert.match(characterExportFormatAdapters, /export function buildCharacterCytoscapeJsonExportFile/, 'Character Cytoscape JSON export adapter must live outside the core export scope model');
assert.match(characterExportModel, /export function buildCharacterExportModel\([\s\S]*CharacterCenterPayload \| null[\s\S]*CharacterExportOptions[\s\S]*CharacterExportModel/, 'Character export model must expose a pure payload-to-files formatter');
assert.match(characterExportModel, /normalizeSpoilerLimit\(options\.spoilerLimit\)[\s\S]*isProfileBeforeSpoilerLimit[\s\S]*isLocationBeforeSpoilerLimit[\s\S]*redactSpoilerText/, 'Character export model must filter profiles, locations, and exported text by spoilerLimit before formatting files');
assert.match(characterExportModel, /options\.format === 'relations-json'[\s\S]*buildCharacterRelationsJsonExportFile/, 'Character export model must render a dedicated relations JSON export');
assert.match(characterExportModel, /options\.format === 'mentions-jsonl'[\s\S]*buildCharacterMentionsJsonlExportFile/, 'Character export model must render a dedicated mentions JSONL export');
assert.match(characterExportModel, /options\.format === 'mermaid'[\s\S]*buildCharacterMermaidExportFile/, 'Character export model must render a Mermaid graph export');
assert.match(characterExportModel, /options\.format === 'graphml'[\s\S]*buildCharacterGraphmlExportFile/, 'Character export model must render a GraphML export');
assert.match(characterExportModel, /options\.format === 'cytoscape-json'[\s\S]*buildCharacterCytoscapeJsonExportFile/, 'Character export model must render a Cytoscape JSON export');
assert.match(characterExportFormatAdapters, /function formatCharacterLocationLink\([\s\S]*params\.set\('chapter'[\s\S]*params\.set\('paragraph'[\s\S]*params\.set\('start'[\s\S]*params\.set\('end'[\s\S]*params\.set\('chunk'[\s\S]*bookmind:\/\/reader\//, 'Character export adapters must provide stable reader location links for quote-free exports');
assert.match(characterExportFormatAdapters, /locationLink: formatCharacterLocationLink\(evidence\.location\)[\s\S]*locationLink: formatCharacterLocationLink\(mention\.location\)/, 'Character JSON and JSONL adapters must include locationLink for evidence and mentions');
assert.match(characterExportFormatAdapters, /options\.includeQuotes === false[\s\S]*location: \$\{formatCharacterLocationLink\(evidence\.location\)\}/, 'Character Markdown adapter must keep reader location links when quotes are omitted');
assert.match(characterExportFormatAdapters, /options\.markdownStyle === 'logseq'[\s\S]*buildCharacterLogseqMarkdownExportFile/, 'Character export adapters must render Logseq outline Markdown');
assert.match(characterExportFormatAdapters, /options\.markdownStyle !== 'obsidian'[\s\S]*\[\[\$\{normalizedValue\.replace/, 'Character export adapters must render Obsidian wikilinks without affecting privacy mode');
assert.doesNotMatch(characterExportModel, /filePath/, 'Character export model must not include local book file paths in exported payloads');
assert.doesNotMatch(characterExportFormatAdapters, /filePath/, 'Character export adapters must not include local book file paths in exported payloads');
assert.match(characterExportFormatAdapters, /function formatExportQuote\([\s\S]*options\.privacyMode[\s\S]*quote 已按隐私模式隐藏/, 'Character export adapters must hide quotes when privacy mode is enabled');
assert.match(characterReviewQueue, /export const characterReviewQueueSchemaVersion = 'bookmind\.character-review-queue\.v1'/, 'Character review queue must publish a stable schema version');
assert.match(characterReviewQueue, /export type CharacterReviewIssueType =[\s\S]*'low-confidence-profile'[\s\S]*'low-confidence-mention'[\s\S]*'duplicate-profile'[\s\S]*'relation-missing-evidence'[\s\S]*'broken-evidence'[\s\S]*'stale-evidence'[\s\S]*'pending-evidence'/, 'Character review queue must model low-confidence, duplicate, missing-evidence, and invalid-evidence issues');
assert.match(characterReviewQueue, /export function buildCharacterReviewQueue\([\s\S]*CharacterCenterPayload \| null[\s\S]*CharacterReviewQueueOptions[\s\S]*CharacterReviewQueue/, 'Character review queue must expose a pure payload-to-review-issues builder');
assert.match(characterCenterService, /invoke<TaskStatus>\('queue_character_extraction'[\s\S]*bookId/, 'Character Center service must call the real queue_character_extraction command');
assert.match(characterCenterService, /invoke<CharacterCenterBookSummary\[\]>\('get_character_center_books'\)/, 'Character Center service must load persisted book summaries from the backend instead of guessing every manifest in the UI');
assert.match(characterCenterService, /invoke<CharacterCenterPayload>\('get_character_center_payload'[\s\S]*bookId/, 'Character Center service must load the real persisted character payload');
assert.match(characterCenterService, /invoke<CharacterOverviewSnapshot>\('get_character_overview_snapshot'[\s\S]*bookId/, 'Character Center service must load overview via a small snapshot command');
assert.match(typesSource, /export type CharacterOverviewSnapshot = \{[\s\S]*bookId: string;[\s\S]*builtAt: string;[\s\S]*stats: CharacterOverviewSnapshotStat\[\];[\s\S]*mainProfiles: CharacterOverviewSnapshotProfile\[\];[\s\S]*recentAppearances: CharacterOverviewSnapshotAppearance\[\];[\s\S]*reviewIssueCount: number;[\s\S]*\};/, 'Character overview must use a small snapshot contract independent from full CharacterCenterPayload');
assert.match(tauriCharacterOverview, /pub\(crate\) struct CharacterOverviewSnapshot[\s\S]*main_profiles[\s\S]*recent_appearances/, 'Backend character overview module must own the lightweight snapshot types');
assert.match(tauriCharacterOverview, /pub\(super\) fn build_character_overview_snapshot[\s\S]*main_profiles[\s\S]*review_issue_count/, 'Backend character overview module must own snapshot construction');
assert.match(tauriCharacterOverview, /pub\(super\) fn write_character_overview_snapshot[\s\S]*overview\.json/, 'Character extraction must persist an overview snapshot so the UI does not recompute overview from full payload files');
assert.match(tauriCharacterOverview, /pub\(super\) fn read_character_overview_snapshot[\s\S]*overview\.json/, 'Overview snapshot command must read the small cached overview file when available');
assert.match(tauriCharacterEvents, /pub\(super\) fn build_first_appearance_events[\s\S]*CharacterEventRecord[\s\S]*event-first-appearance/, 'Backend character event module must own first appearance event construction');
assert.match(tauriCharacterEvents, /pub\(super\) fn build_appearance_stats[\s\S]*CharacterAppearanceStatRecord[\s\S]*appearance-/, 'Backend character event module must own chapter appearance stats construction');
assert.match(tauriCharacterEvents, /pub\(super\) fn event_counts_by_character[\s\S]*participant_character_ids/, 'Backend character event module must own event count aggregation by character');
assert.match(tauriCharacterNameRules, /pub\(super\) fn classify_character_candidate_name[\s\S]*CharacterCandidateKind/, 'Backend character name rules module must own candidate name classification');
assert.match(tauriCharacterNameRules, /pub\(super\) fn looks_like_specific_titled_character_name[\s\S]*TITLE_NAME_SUFFIXES/, 'Backend character name rules module must own specific titled-name detection');
assert.match(tauriCharacterNameRules, /pub\(super\) fn looks_like_stable_alias_character_name[\s\S]*STABLE_ALIAS_SUFFIXES/, 'Backend character name rules module must own stable alias-name detection');
assert.match(tauriCharacterNameRules, /fn starts_with_known_chinese_surname[\s\S]*COMMON_CHINESE_SURNAMES/, 'Backend character name rules module must own Chinese surname checks');
assert.match(tauriCharacterFilters, /pub\(super\) fn is_non_character_candidate[\s\S]*is_strict_non_person_candidate[\s\S]*is_hard_rejected_character_candidate/, 'Backend character filters module must own the main non-character candidate gate');
assert.match(tauriCharacterFilters, /pub\(super\) fn is_non_character_candidate_in_context[\s\S]*starts_with_speech_predicate[\s\S]*has_recent_hesitation_context/, 'Backend character filters module must own contextual non-character filtering');
assert.match(tauriCharacterFilters, /const STRICT_NON_PERSON_WORDS[\s\S]*const NON_CHARACTER_WORDS/, 'Backend character filters module must own strict non-person and stop-word lists');
assert.match(tauriCharacterExtraction, /pub\(super\) struct CandidateMention[\s\S]*prefix_text[\s\S]*suffix_text/, 'Backend character extraction module must own candidate mention shape and context windows');
assert.match(tauriCharacterExtraction, /pub\(super\) fn collect_character_accumulators[\s\S]*extract_names_from_text[\s\S]*CharacterAccumulator/, 'Backend character extraction module must own candidate accumulator collection');
assert.match(tauriCharacterExtraction, /fn extract_names_from_text[\s\S]*Regex::new[\s\S]*collect_named_captures/, 'Backend character extraction module must own regex-based candidate extraction');
assert.match(tauriCharacterExtraction, /fn clean_character_candidate[\s\S]*trim_candidate_boundaries[\s\S]*is_non_character_candidate/, 'Backend character extraction module must own candidate cleanup before filtering');
assert.match(tauriCharacterIds, /pub\(super\) fn stable_hash[\s\S]*0xcbf29ce484222325[\s\S]*0x100000001b3/, 'Backend character ids module must own the stable hash algorithm');
assert.match(tauriCharacterIds, /pub\(super\) fn stable_character_id[\s\S]*character-\{\}/, 'Backend character ids module must own stable character ids');
assert.match(tauriCharacterIds, /pub\(super\) fn stable_relation_id[\s\S]*relation-\{\}/, 'Backend character ids module must own stable relation ids');
assert.match(tauriCharacterIds, /pub\(super\) fn relation_evidence_index[\s\S]*rsplit\("-evidence-"\)/, 'Backend character ids module must own relation evidence index parsing');
assert.match(charactersPage, /characterPayload: CharacterCenterPayload \| null;/, 'CharactersPage must accept a real Character Center payload');
assert.match(charactersPage, /overviewSnapshot: CharacterOverviewSnapshot \| null;/, 'CharactersPage must receive a lightweight overview snapshot');
assert.match(charactersPage, /overviewSnapshotLoading: boolean;/, 'CharactersPage must receive a lightweight overview loading flag');
assert.match(charactersPage, /onRequestCharacterOverviewSnapshot: \(bookId: string\) => void;/, 'CharactersPage must request overview snapshots independently from full character payloads');
assert.match(charactersPage, /onRequestCharacterPayload: \(bookId: string\) => void;/, 'CharactersPage must request full character payloads lazily instead of forcing App to load them on page entry');
assert.match(charactersPage, /onQueueCharacterExtraction: \(bookId: string\) => Promise<void>;/, 'CharactersPage must receive a real character extraction queue action');
assert.match(charactersPage, /renderCharacterProfiles\([\s\S]*selectedCharacterPayload/, 'CharactersPage must render real profiles from the selected character payload');
assert.match(charactersPage, /from '\.\.\/features\/characters\/CharacterWorkbenchViews'/, 'CharactersPage must delegate heavy workbench view rendering to CharacterWorkbenchViews');
assert.match(characterWorkbenchViews, /export function renderCharacterProfiles\([\s\S]*characterPayload\.profiles/, 'CharacterWorkbenchViews must render real profiles from the character payload');
assert.match(characterWorkbenchViews, /buildCharacterListModel\(characterPayload\.profiles/, 'CharacterWorkbenchViews must use the real character list model for profile rows');
assert.doesNotMatch(charactersPage, /function CharacterProfileList\(/, 'CharactersPage must not inline the profile list component');
assert.match(characterWorkbenchViews, /import \{ buildCharacterListViewport, getCharacterListViewportRowTop \} from '\.\/characterListViewport'/, 'Character profile list must use the shared virtual viewport helper');
assert.match(characterWorkbenchViews, /const \[profileQuery, setProfileQuery\] = useState\(''\)[\s\S]*const \[profileSortBy, setProfileSortBy\] = useState<CharacterListSortBy>\('mention-count'\)[\s\S]*const \[profileKindFilter, setProfileKindFilter\] = useState<CharacterProfileKindFilter>\('all'\)[\s\S]*const \[profileRoleFilter, setProfileRoleFilter\] = useState<CharacterProfileRoleFilter>\('all'\)[\s\S]*const \[profileConfidenceFilter, setProfileConfidenceFilter\] = useState<CharacterProfileConfidenceFilter>\('all'\)[\s\S]*const \[profileSourceFilter, setProfileSourceFilter\] = useState<CharacterProfileSourceFilter>\('all'\)/, 'Character profile list must expose local search, sorting, kind, role, confidence, and source filter state');
assert.match(characterWorkbenchViews, /characters-profile-tools[\s\S]*characters\.profileSearchPlaceholder[\s\S]*characters\.profileSort[\s\S]*characters\.profileKindFilter[\s\S]*characters\.profileRoleFilter[\s\S]*characters\.profileConfidenceFilter[\s\S]*characters\.profileSourceFilter/, 'Character profile list must render visible search, sort, kind, role, confidence, and source controls');
assert.match(charactersPage, /characters-book-pane[\s\S]*<ThemedSelect className="characters-book-status-select"[\s\S]*characters\.bookStatusFilter[\s\S]*characters-book-pane-search[\s\S]*characters\.bookSearchPlaceholder/, 'Character Center book index must expose visible search and a themed status filter');
assert.match(characterWorkbenchViews, /characters-profile-tools[\s\S]*<label className="characters-book-search">[\s\S]*characters\.profileSearch[\s\S]*<input[\s\S]*<\/label>[\s\S]*characters\.profileSort[\s\S]*characters\.profileKindFilter[\s\S]*characters\.profileRoleFilter[\s\S]*characters\.profileConfidenceFilter[\s\S]*characters\.profileSourceFilter/, 'Character profile search, sort, kind, role, confidence, and source controls must have visible labels');
assert.match(characterWorkbenchViews, /buildCharacterListModel\(characterPayload\.profiles,\s*\{[\s\S]*query: profileQuery[\s\S]*sortBy: profileSortBy[\s\S]*kinds: profileKindFilter === 'all' \? \[\] : \[profileKindFilter\][\s\S]*roles: profileRoleFilter === 'all' \? \[\] : \[profileRoleFilter\][\s\S]*sources: profileSourceFilter === 'all' \? \[\] : \[profileSourceFilter\][\s\S]*minConfidence: profileConfidenceFilter === 'low' \? 0 : profileConfidenceFilter === 'high' \? 0\.75 : 0[\s\S]*maxConfidence: profileConfidenceFilter === 'low' \? 0\.749999 : 1/, 'Character profile list controls must feed the real list model instead of filtering rendered DOM manually');
assert.match(characterWorkbenchViews, /const \[profileListScrollTop, setProfileListScrollTop\] = useState\(0\)[\s\S]*const \[profileListHeight, setProfileListHeight\] = useState\(380\)[\s\S]*buildCharacterListViewport\(\{[\s\S]*totalCount: model\.items\.length[\s\S]*scrollTop: profileListScrollTop[\s\S]*viewportHeight: profileListHeight[\s\S]*rowHeight: characterProfileRowHeight[\s\S]*rowGap: characterProfileRowGap[\s\S]*overscan: characterProfileOverscan/, 'Character profile list must derive a virtual viewport from scroll position instead of rendering every row');
assert.match(characterWorkbenchViews, /const model = useMemo\(\(\) => buildCharacterListModel\(characterPayload\.profiles,\s*\{[\s\S]*query: profileQuery[\s\S]*maxConfidence: profileConfidenceFilter === 'low' \? 0\.749999 : 1,[\s\S]*\}\), \[[\s\S]*profileQuery[\s\S]*profileSortBy[\s\S]*profileKindFilter[\s\S]*profileRoleFilter[\s\S]*profileConfidenceFilter[\s\S]*profileSourceFilter[\s\S]*\]\)/, 'Character profile list model must be memoized so scrolling and unrelated renders do not refilter and resort all profiles');
assert.match(characterWorkbenchViews, /const visibleItems = model\.items\.slice\(viewport\.startIndex, viewport\.endIndex\)/, 'Character profile list must slice only the virtual viewport window');
assert.doesNotMatch(characterWorkbenchViews, /model\.items\.slice\(0,\s*50\)/, 'Character profile list must not silently truncate results to the first 50 rows');
assert.match(characterWorkbenchViews, /characters-profile-list-virtual[\s\S]*onScroll=\{\(event\) => setProfileListScrollTop\(event\.currentTarget\.scrollTop\)\}[\s\S]*characters\.profileListVirtualAria[\s\S]*characters-profile-virtual-spacer[\s\S]*height: `\$\{viewport\.totalHeight\}px`[\s\S]*getCharacterListViewportRowTop\(viewport, viewport\.startIndex \+ relativeIndex\)/, 'Character profile list must use a stable spacer and positioned rows for 1000+ profiles');
assert.match(characterWorkbenchViews, /item\.avatarInitials[\s\S]*item\.role[\s\S]*characters\.profileMentionCount[\s\S]*characters\.profileRelationCount[\s\S]*formatCharacterLocation\(item\.firstAppearance, t\)[\s\S]*formatCharacterLocation\(item\.lastAppearance, t\)[\s\S]*Math\.round\(item\.confidence \* 100\)/, 'Character profile rows must show avatar initials, role, mention count, relation count, first appearance, latest appearance, and confidence from real profiles');
assert.match(charactersPage, /import \{ buildCharacterProfileDetail,[\s\S]*type CharacterProfileDetail \} from '\.\.\/features\/characters\/characterProfileDetail'/, 'CharactersPage must reuse the pure character profile detail selector');
assert.match(charactersPage, /import \{ buildCharacterOverviewMetrics \} from '\.\.\/features\/characters\/characterOverviewMetrics'/, 'CharactersPage must reuse the pure character overview metrics selector');
assert.doesNotMatch(charactersPage, /buildCharacterOverviewSummary\(selectedCharacterPayload/, 'Overview workbench must never derive its model from full CharacterCenterPayload on the frontend main thread');
assert.match(characterRelationGraphView, /import \{ buildCharacterGraphModel,[\s\S]*resolveCharacterGraphPanelState,[\s\S]*type CharacterGraphChapterRange,[\s\S]*type CharacterGraphModel,[\s\S]*type CharacterGraphNode,[\s\S]*type CharacterGraphPanelState \} from '\.\/characterGraphModel'/, 'CharacterRelationGraphView must reuse the pure character graph selector, graph status selector, and chapter range contract for the relationship view');
assert.match(characterRelationGraphView, /resolveCharacterGraphPanelState[\s\S]*type CharacterGraphPanelState/, 'CharacterRelationGraphView must reuse the pure relationship graph panel state selector for loading, empty, and error states');
assert.match(characterRelationGraphView, /import \{[\s\S]*buildCharacterGraphCanvasModel[\s\S]*type CharacterGraphCanvasModel[\s\S]*type CharacterGraphCanvasViewport[\s\S]*\} from '\.\/characterGraphCanvasModel'/, 'CharacterRelationGraphView must reuse the pure stable graph canvas selector and viewport contract for the relationship view');
assert.match(characterRelationGraphView, /import \{ CharacterGraphCanvasView \} from '\.\/CharacterGraphCanvasView'/, 'CharacterRelationGraphView must import the extracted relationship graph canvas component instead of owning its drawing implementation');
assert.match(characterGraphCanvasView, /import \{[\s\S]*buildCharacterGraphCanvasViewport[\s\S]*type CharacterGraphCanvasModel[\s\S]*type CharacterGraphCanvasViewport[\s\S]*\} from '\.\/characterGraphCanvasModel'/, 'CharacterGraphCanvasView must reuse the pure graph canvas model while keeping preview-style mutable viewport refs');
assert.match(characterGraphCanvasView, /from '\.\/characterGraphCanvasRuntime'/, 'CharacterGraphCanvasView must delegate drawing, hit testing, and viewport math to the focused canvas runtime module');
assert.doesNotMatch(charactersPage, /characterGraphDefaultMaxNodes|maxNodes:\s*200|maxNodes:\s*characterGraphDefaultMaxNodes|graph\.summary\.aggregatedNodeCount|graphAggregationSummary|graph\.edges\.slice\(0,\s*12\)|<svg[\s\S]*characters-graph-canvas-viewport/, 'Relationship graph view must not cap, aggregate, or render the full overview as SVG/DOM elements');
assert.match(characterRelationGraphView, /<CharacterGraphCanvasView[\s\S]*graph=\{graph\}[\s\S]*onSelectEdge=\{selectGraphEdge\}[\s\S]*onSelectCharacter=\{onSelectCharacter\}[\s\S]*formatEdgeLabel=\{\(edge\) => formatCharacterGraphRelation\(edge, privacySettings, t\)\}/, 'Relationship graph overview must be a dedicated high-performance canvas component fed by the full graph and relation formatter');
assert.match(characterCenterSession, /export type CharacterGraphSessionState = \{[\s\S]*viewport: CharacterGraphCanvasViewport;[\s\S]*searchQuery: string;[\s\S]*neighborDepth: CharacterGraphSessionNeighborDepth;[\s\S]*edgeMode: CharacterGraphSessionEdgeMode;[\s\S]*viewportInitialized: boolean;[\s\S]*\};/, 'Character Center session model must own graph viewport, search, depth, edge mode, and restoration state');
assert.match(appSource, /characterGraphSessionStateCacheRef = useRef\(new Map<string, CharacterGraphSessionStateCacheEntry>\(\)\)/, 'App must own the in-memory graph session cache for the current application run');
assert.match(appSource, /getCachedCharacterGraphSessionState[\s\S]*rememberCharacterGraphSessionState/, 'App must restore and remember graph session state by book signature');
assert.match(charactersPage, /characterGraphSessionState: CharacterGraphSessionState;[\s\S]*onCharacterGraphSessionStateChange: \(patch: CharacterGraphSessionStatePatch\) => void;/, 'CharactersPage must receive graph session state instead of owning relation graph UI state');
assert.match(characterRelationGraphView, /const graphSearchQuery = graphSessionState\.searchQuery[\s\S]*const graphNeighborDepth = graphSessionState\.neighborDepth[\s\S]*const graphEdgeMode = graphSessionState\.edgeMode/, 'Relationship graph view must read preview search, depth, and edge mode from session state');
assert.doesNotMatch(characterRelationGraphView, /const \[graphSearchQuery, setGraphSearchQuery\] = useState\(''\)|const \[graphNeighborDepth, setGraphNeighborDepth\]|const \[graphEdgeMode, setGraphEdgeMode\]/, 'Relationship graph view must not keep graph search, depth, or edge mode in local state because returning to the page should be instant and restored');
assert.match(characterRelationGraphView, /characters\.graphSearchPlaceholder[\s\S]*value=\{graphSearchDraft\}[\s\S]*onChange=\{\(event\) => \{[\s\S]*setGraphSearchDraft\(event\.target\.value\)/, 'Relationship graph view must retain a searchable preview input draft');
assert.match(characterRelationGraphView, /function applyGraphSearchDraft\(\)[\s\S]*setGraphSearchQuery\(nextQuery\)[\s\S]*setSelectedGraphEdgeId\(null\);[\s\S]*resetGraphCanvasViewport\(\)/, 'Applying relationship graph preview search must rebuild the visible subgraph and reset the fitted viewport');
assert.match(characterRelationGraphView, /searchQuery: graphSearchQuery[\s\S]*neighborDepth: graphNeighborDepth[\s\S]*edgeMode: graphEdgeMode/, 'Relationship graph layout request must pass preview search, neighbor depth, and edge mode options to the pure canvas model');
assert.match(characterRelationGraphView, /onFocusSearch=\{\(characterId, label\) => \{[\s\S]*setGraphSearchQuery\(label\)[\s\S]*setGraphNeighborDepth\(1\)[\s\S]*resetGraphCanvasViewport\(\)/, 'Double-clicking a graph character must enter the preview-style relationship search subgraph instead of a separate partial implementation');
assert.doesNotMatch(charactersPage, /function drawCharacterGraphCanvas|function findNearestGraphCanvasNode|function distanceToQuadraticCurve/, 'CharactersPage must not own relationship canvas drawing or hit-testing internals');
assert.match(charactersPage, /const \[selectedRelationDetail, setSelectedRelationDetail\] = useState<CharacterGraphEdgeDetail \| null>\(null\)[\s\S]*renderCharacterInspectorPanel\([\s\S]*selectedRelationDetail/, 'Relationship graph edge detail state must be passed into the right inspector instead of a bottom popover or duplicated card');
assert.match(characterPageRenderers, /function renderCharacterInspectorPanel\([\s\S]*selectedRelationDetail[\s\S]*renderCharacterGraphEdgeDetail\([\s\S]*selectedRelationDetail/, 'Character page renderer must render selected relationship graph edge details inside the inspector panel');
assert.match(charactersPage, /const \[graphFullscreen, setGraphFullscreen\] = useState\(false\)[\s\S]*className=\{`characters-atlas-body \$\{graphFullscreen \? 'graph-fullscreen' : ''\}`\.trim\(\)\}[\s\S]*graphFullscreen,[\s\S]*setGraphFullscreen,/, 'Character Center must keep graph fullscreen state at the atlas layout level so the relationship canvas can fill the right inspector area');
assert.match(charactersPage, /function renderCharacterWorkbenchView\([\s\S]*onGraphFullscreenChange: \(fullscreen: boolean\) => void[\s\S]*<CharacterRelationGraphView[\s\S]*fullscreen=\{graphFullscreen\}[\s\S]*onFullscreenChange=\{onGraphFullscreenChange\}/, 'Relationship workbench must pass graph fullscreen state through the selected-view renderer instead of trapping it inside the canvas');
assert.match(characterRelationGraphView, /onToggleFullscreen=\{\(\) => onFullscreenChange\(!fullscreen\)\}/, 'Relationship graph card must expose a fullscreen/shrink toggle that updates the page-level fullscreen state');
assert.match(characterGraphCanvasView, /characters-graph-canvas-fullscreen-btn[\s\S]*onToggleFullscreen[\s\S]*characters\.graphCanvasFullscreen/, 'Compact relationship graph canvas controls must include a visible fullscreen button while preview toolbar owns shrink in fullscreen mode');
assert.match(characterGraphCanvasView, /export function CharacterGraphCanvasView\([\s\S]*useRef<HTMLCanvasElement \| null>[\s\S]*requestAnimationFrame[\s\S]*drawCharacterGraphCanvas/, 'Relationship graph canvas must draw through RAF instead of rendering every node and edge as React DOM');
assert.match(characterGraphCanvasView, /function handleWheel\([\s\S]*preventDefault[\s\S]*clampCharacterGraphViewportScale[\s\S]*markInteracting\(\)/, 'Relationship graph canvas must support direct wheel zoom like the standalone star map preview');
assert.match(characterGraphCanvasView, /function handlePointerDown\([\s\S]*event\.button !== 0[\s\S]*nearestNode[\s\S]*nearestEdge[\s\S]*classList\.add\('panning'\)[\s\S]*captureCharacterGraphPointer\(event\.currentTarget, event\.pointerId\)/, 'Relationship graph canvas must support left-button drag panning from the preview star map');
assert.match(characterGraphCanvasView, /function captureCharacterGraphPointer\([\s\S]*try \{[\s\S]*setPointerCapture\(pointerId\)[\s\S]*\} catch[\s\S]*Non-real pointer events from browser parity tests/, 'Relationship graph canvas must keep pointer capture defensive so synthetic parity events cannot crash the preview');
assert.match(characterGraphCanvasView, /function handlePointerUp\([\s\S]*!moved && nodeHit[\s\S]*onSelectCharacter\(nodeHit\)[\s\S]*!moved && edgeHit[\s\S]*onSelectEdge\(edgeHit\)[\s\S]*onRestoreFullGraph\(\)/, 'Relationship graph canvas must use short clicks for node and edge selection while preserving whitespace restore');
assert.match(characterGraphCanvasView, /commit: 'immediate' \| 'deferred' \| 'none'[\s\S]*commit === 'deferred'[\s\S]*commit === 'none'[\s\S]*scheduleCharacterGraphCanvasDraw/, 'Relationship graph viewport must support ref-only and deferred updates so drag and wheel do not rerender React every frame');
assert.match(characterWorkbenchViews, /import \{ buildCharacterAppearanceHeatmapModel,[\s\S]*type CharacterAppearanceHeatmapModel \} from '\.\/characterAppearanceHeatmap'/, 'CharacterWorkbenchViews must reuse the pure character appearance heatmap selector');
assert.match(charactersPage, /import \{ buildCharacterEvidenceReaderOpenDetail, buildCharacterLocationReaderOpenDetail,[\s\S]*type CharacterEvidenceReaderOpenDetail \} from '\.\.\/features\/characters\/characterEvidenceNavigation'/, 'CharactersPage must reuse the pure character evidence and location reader navigation helpers');
assert.match(charactersPage, /const \[selectedCharacterId, setSelectedCharacterId\] = useState<string \| null>\(null\)/, 'CharactersPage must track the selected character for the detail panel');
assert.match(typesSource, /export type CharacterWorkbenchView =[\s\S]*'overview'[\s\S]*'relations'[\s\S]*'export'/, 'Character Center workbench view ids must live in the shared app types contract');
assert.match(characterCenterSession, /export const defaultCharacterWorkbenchView: CharacterWorkbenchView = 'overview'/, 'Character Center session model must define the default workbench view');
assert.match(characterCenterSession, /export function resolveInitialCharacterWorkbenchView/, 'Character Center session model must validate restored workbench views');
assert.doesNotMatch(charactersPage, /const \[selectedWorkbenchView, setSelectedWorkbenchView\] = useState<CharacterWorkbenchView>\('overview'\)/, 'CharactersPage must not own the selected workbench view because leaving and returning to Character Center must preserve the last tab');
assert.doesNotMatch(charactersPage, /const \[renderedWorkbenchView, setRenderedWorkbenchView\] = useState<CharacterWorkbenchView>\('overview'\)/, 'CharactersPage must not own the rendered workbench view because deferred relation rendering must survive page navigation');
assert.match(charactersPage, /selectedWorkbenchView: CharacterWorkbenchView;[\s\S]*renderedWorkbenchView: CharacterWorkbenchView;[\s\S]*onSelectWorkbenchView: \(view: CharacterWorkbenchView\) => void;[\s\S]*onRenderWorkbenchView: \(view: CharacterWorkbenchView\) => void;/, 'CharactersPage must receive session-level workbench view state from App');
assert.match(charactersPage, /const deferredWorkbenchView = useDeferredValue\(renderedWorkbenchView\)/, 'Character Center must defer heavy workbench rendering so the toolbar state can update before expensive panels mount');
assert.match(charactersPage, /function selectWorkbenchView\(view: CharacterWorkbenchView\)[\s\S]*onSelectWorkbenchView\(view\)[\s\S]*startTransition\(\(\) => onRenderWorkbenchView\(view\)\)/, 'Character Center view switches must update toolbar selection immediately and schedule heavy panel work as a React transition');
assert.match(charactersPage, /selectedWorkbenchView !== deferredWorkbenchView[\s\S]*characters-workbench-switching/, 'Character Center must expose a lightweight pending-view state while deferred workbench content catches up');
assert.doesNotMatch(charactersPage, /buildCharacterOverviewSummary/, 'CharactersPage must not import or call the full-payload overview summary builder');
assert.match(charactersPage, /const workbenchNeedsFullPayload = selectedBook[\s\S]*deferredWorkbenchView === 'profiles'[\s\S]*deferredWorkbenchView === 'relations'[\s\S]*deferredWorkbenchView === 'heatmap'[\s\S]*deferredWorkbenchView === 'evidence'/, 'Character Center must only request full payloads for workbench views that actually need full character data');
assert.match(charactersPage, /useEffect\(\(\) => \{[\s\S]*if \(!workbenchNeedsFullPayload \|\| !selectedBook\) return;[\s\S]*if \(selectedCharacterPayload\) return;[\s\S]*onRequestCharacterPayload\(selectedBook\.id\)[\s\S]*\}, \[[\s\S]*workbenchNeedsFullPayload[\s\S]*selectedBook[\s\S]*selectedCharacterPayload[\s\S]*onRequestCharacterPayload[\s\S]*\]\)/, 'Character Center must lazily request full payload data after a full-data workbench view is selected');
assert.match(charactersPage, /const \[inspectorCollapsed, setInspectorCollapsed\] = useState\(false\)/, 'Character Center inspector must keep local collapsed state');
assert.match(charactersPage, /const \[inspectorWidth, setInspectorWidth\] = useState\(320\)/, 'Character Center inspector must keep a fixed user-adjustable width');
assert.match(charactersPage, /<header className="characters-atlas-toolbar characters-center-header"[\s\S]*characters-center-shell[\s\S]*characters-book-pane[\s\S]*characters-workspace-pane[\s\S]*<nav className="characters-atlas-tabs"[\s\S]*characterWorkbenchViews\.map[\s\S]*selectWorkbenchView\(view\.id\)[\s\S]*BookMindIcon/, 'Character Center must expose a book-index plus labeled-workspace layout');
assert.match(charactersPage, /renderCharacterWorkbenchView\([\s\S]*deferredWorkbenchView[\s\S]*case 'overview'[\s\S]*case 'profiles'[\s\S]*case 'relations'[\s\S]*case 'heatmap'[\s\S]*case 'timeline'[\s\S]*case 'factions'[\s\S]*case 'evidence'[\s\S]*case 'review'[\s\S]*case 'export'/, 'Character Center main pane must render one deferred selected view at a time instead of stacking every module or blocking toolbar updates');
assert.match(charactersPage, /<div className=\{`characters-atlas-body \$\{graphFullscreen \? 'graph-fullscreen' : ''\}`\.trim\(\)\}>[\s\S]*<main className="characters-main-pane">[\s\S]*<aside className=\{inspectorCollapsed \? 'characters-inspector-pane collapsed' : 'characters-inspector-pane'\}[\s\S]*renderCharacterInspectorPanel\([\s\S]*selectedCharacterDetail/, 'Character Center must use an atlas body with a main map/workbench area and a fullscreen-collapsible right inspector pane');
assert.match(characterPageRenderers, /function renderCharacterInspectorPanel\([\s\S]*selectedCharacterDetail[\s\S]*renderCharacterBookInspectorSummary/, 'Character page renderer must keep the book summary fallback inside the inspector panel');
assert.match(charactersPage, /style=\{\{ '--characters-inspector-width': inspectorCollapsed \? '44px' : `\$\{inspectorWidth\}px` \} as CharacterInspectorStyle\}/, 'Character Center workbench must expose the inspector width as a CSS custom property and shrink it while collapsed');
assert.match(charactersPage, /className=\{inspectorCollapsed \? 'characters-inspector-pane collapsed' : 'characters-inspector-pane'\}/, 'Character Center inspector must apply a collapsed class without unmounting the panel');
assert.match(charactersPage, /!\s*inspectorCollapsed \? \([\s\S]*className="characters-inspector-resize"[\s\S]*onPointerDown=\{\(event\) => beginInspectorResize\(event, setInspectorWidth\)\}[\s\S]*characters\.inspectorResizeAria[\s\S]*\) : null/, 'Character Center inspector must hide the resize handle while the inspector is collapsed');
assert.match(charactersPage, /role="separator"[\s\S]*aria-orientation="vertical"[\s\S]*aria-valuemin=\{280\}[\s\S]*aria-valuemax=\{460\}[\s\S]*aria-valuenow=\{inspectorWidth\}[\s\S]*onKeyDown=\{\(event\) => handleInspectorResizeKeyDown\(event, inspectorWidth, setInspectorWidth\)\}/, 'Character Center inspector resize handle must expose keyboard-adjustable separator semantics while expanded');
assert.match(charactersPage, /characters-inspector-toolbar[\s\S]*setInspectorCollapsed\(\(collapsed\) => !collapsed\)[\s\S]*characters\.inspectorExpand[\s\S]*characters\.inspectorCollapse/, 'Character Center inspector must expose a visible collapse/expand control');
assert.match(charactersPage, /renderCharacterMobileViewTabs\([\s\S]*setInspectorCollapsed,[\s\S]*\)/, 'Character Center must pass the inspector collapse controller to mobile tabs');
assert.match(charactersPage, /if \(!tab\.viewId\) \{[\s\S]*tab\.href === '#characters-detail'[\s\S]*setInspectorCollapsed\(false\)[\s\S]*return;[\s\S]*\}/, 'Character Center detail mobile tab must reopen the inspector before jumping to the detail panel');
assert.match(charactersPage, /function beginInspectorResize\(event: ReactPointerEvent<HTMLButtonElement>, setInspectorWidth: \(width: number\) => void\)[\s\S]*setPointerCapture\(event\.pointerId\)[\s\S]*setInspectorWidth\(clampCharacterInspectorWidth\(currentWidth - \(pointerEvent\.clientX - startX\)\)\)[\s\S]*function cleanup\(\)[\s\S]*removeEventListener\('pointermove', onPointerMove\)[\s\S]*removeEventListener\('pointerup', cleanup\)[\s\S]*removeEventListener\('pointercancel', cleanup\)[\s\S]*removeEventListener\('lostpointercapture', cleanup\)[\s\S]*releasePointerCapture\(pointerId\)/, 'Character Center inspector resizing must capture the pointer, clamp width updates, and clean up on pointer cancel or lost capture');
assert.match(charactersPage, /window\.addEventListener\('pointermove', onPointerMove\)[\s\S]*window\.addEventListener\('pointerup', cleanup, \{ once: true \}\)[\s\S]*window\.addEventListener\('pointercancel', cleanup, \{ once: true \}\)[\s\S]*handle\.addEventListener\('lostpointercapture', cleanup, \{ once: true \}\)/, 'Character Center inspector resizing must register one-shot cleanup listeners for normal, cancelled, and lost-capture pointer endings');
assert.match(charactersPage, /function handleInspectorResizeKeyDown\([\s\S]*event\.key !== 'ArrowLeft' && event\.key !== 'ArrowRight'[\s\S]*setInspectorWidth\(clampCharacterInspectorWidth\(inspectorWidth \+ direction \* 20\)\)/, 'Character Center inspector resize handle must support keyboard width adjustments');
assert.match(charactersPage, /function clampCharacterInspectorWidth\(width: number\)[\s\S]*Math\.min\(460, Math\.max\(280, Math\.round\(width\)\)\)/, 'Character Center inspector width must be clamped to a fixed usable range');
assert.match(charactersPage, /const selectedCharacterDetail = useMemo\(\(\) => \{[\s\S]*buildCharacterProfileDetail\(selectedCharacterPayload, deferredSelectedCharacterId/, 'CharactersPage must derive details from the real persisted character payload');
assert.match(charactersPage, /const overviewMetricProfiles = useMemo\(\(\) => \[\], \[\]\)[\s\S]*buildCharacterOverviewMetrics\(\{[\s\S]*book: selectedBook,[\s\S]*manifest: null,[\s\S]*profiles: overviewMetricProfiles,[\s\S]*(?:centerState,|centerState: \{ showZeroCharacterMetrics: centerState\.showZeroCharacterMetrics \},)[\s\S]*\}\)/, 'CharactersPage overview entry metrics must stay summary-only and must not rescan the selected full payload');
assert.doesNotMatch(charactersPage, /buildCharacterOverviewMetrics\(\{[\s\S]*selectedCharacterPayload\?\.profiles/, 'CharactersPage overview entry metrics must not depend on selectedCharacterPayload profiles');
assert.match(charactersPage, /const metrics = useMemo\(\(\) => buildCharacterOverviewMetrics\(\{[\s\S]*\}\), \[[\s\S]*\]\)/, 'Character overview metrics must be memoized so view switching does not rescan the selected payload');
assert.match(charactersPage, /useEffect\(\(\) => \{[\s\S]*deferredWorkbenchView !== 'overview'[\s\S]*overviewSnapshot\?\.bookId === selectedBook\.id[\s\S]*onRequestCharacterOverviewSnapshot\(selectedBook\.id\)/, 'CharactersPage must request the small overview snapshot only when the overview workbench is active');
assert.match(charactersPage, /renderCharacterOverviewWorkbench\(selectedBook, overviewSnapshot, overviewSnapshotLoading, centerState, privacySettings, t\)/, 'Character overview workbench must render from lightweight snapshot data instead of full payload summaries');
assert.match(charactersPage, /function renderCharacterOverviewWorkbench\([\s\S]*overviewSnapshot: CharacterOverviewSnapshot \| null[\s\S]*overviewSnapshot\?\.stats[\s\S]*overviewSnapshot\?\.mainProfiles[\s\S]*overviewSnapshot\?\.recentAppearances/, 'Character overview workbench must show stats, main profile ranking, and recent appearances from the lightweight snapshot');
assert.match(characterPageRenderers, /renderCharacterProfileDetail\(selectedCharacterDetail, selectedBook, openCharacterEvidenceInReader, openCharacterLocationInReader, privacySettings, t\)/, 'Character page renderer must render a real profile detail panel with reader-jump evidence and appearance actions for the selected character');
assert.match(charactersPage, /<CharacterRelationGraphView[\s\S]*characterPayload=\{selectedCharacterPayload\}[\s\S]*centerState=\{centerState\}[\s\S]*onSelectCharacter=\{setSelectedCharacterId\}[\s\S]*onOpenEvidence=\{openCharacterEvidenceInReader\}[\s\S]*privacySettings=\{privacySettings\}[\s\S]*t=\{t\}/, 'CharactersPage must render a relationship graph area even while the selected character payload is unavailable');
assert.match(charactersPage, /renderCharacterAppearanceHeatmap\(selectedCharacterPayload,[\s\S]*openCharacterLocationInReader,[\s\S]*privacySettings,[\s\S]*t\)/, 'CharactersPage must render a chapter appearance heatmap from the selected character payload');
assert.match(charactersPage, /renderCharacterEvidenceTable\(selectedCharacterPayload,[\s\S]*openCharacterEvidenceInReader,[\s\S]*privacySettings,[\s\S]*t\)/, 'CharactersPage must render a searchable evidence table from the selected character payload');
assert.match(charactersPage, /import \{ renderCharacterEvidenceTable \} from '\.\.\/features\/characters\/CharacterEvidenceTable'/, 'CharactersPage must delegate the evidence table UI to the character evidence table component');
assert.match(charactersPage, /onOpenReaderEvidence: \(detail: CharacterEvidenceReaderOpenDetail\) => void;/, 'CharactersPage must expose a reader jump callback for character evidence');
assert.match(characterPageRenderers, /renderCharacterProfileDetail\([\s\S]*selectedBook[\s\S]*openCharacterEvidenceInReader[\s\S]*privacySettings/, 'Character page renderer must wire character detail evidence cards to the reader jump callback');
assert.match(charactersPage, /function openCharacterEvidenceInReader\([\s\S]*buildCharacterEvidenceReaderOpenDetail\(evidence[\s\S]*onOpenReaderEvidence\(detail\)/, 'CharactersPage must convert character evidence into a reader-open detail before jumping to the reader');
assert.match(characterPageRenderers, /onClick=\{\(\) => onOpenEvidence\(item\)\}[\s\S]*characters\.detailJumpEvidence/, 'Character evidence excerpts must provide a visible jump-to-reader action');
assert.match(charactersPage, /function openCharacterLocationInReader\(location: CharacterLocation, label: string\)[\s\S]*buildCharacterLocationReaderOpenDetail\(location,[\s\S]*snippet: characterName[\s\S]*onOpenReaderEvidence\(detail\)/, 'Character appearance locations must convert profile first/latest appearance into a reader-open detail before jumping to the reader');
assert.match(characterPageRenderers, /renderCharacterLocation\(t\('characters\.detailFirstAppearance'\), detail\.profile\.firstAppearance, onOpenLocation, t\)[\s\S]*renderCharacterLocation\(t\('characters\.detailLastAppearance'\), detail\.profile\.lastAppearance, onOpenLocation, t\)/, 'Character detail must render jumpable first and latest appearance locations');
assert.match(characterPageUtils, /function isOpenableCharacterLocation\([\s\S]*sourceChapterIndex[\s\S]*paragraphIndex[\s\S]*startOffset[\s\S]*endOffset/, 'Character detail must only show appearance jump buttons for complete reader locations');
assert.match(characterWorkbenchViews, /onSelectCharacter\(item\.id\)/, 'Character profile rows must open the matching detail panel');
assert.match(characterPageRenderers, /detail\.relations\.slice\(0, 6\)[\s\S]*characters\.detailRelationsTitle[\s\S]*formatCharacterRelationHeading/, 'Character detail must show real relationship records from the selected profile detail');
assert.match(characterPageRenderers, /detail\.events\.slice\(0, 6\)[\s\S]*characters\.detailEventsTitle[\s\S]*formatCharacterEventMeta/, 'Character detail must show real event records from the selected profile detail');
assert.match(characterPageRenderers, /detail\.factionMemberships\.slice\(0, 6\)[\s\S]*characters\.detailFactionsTitle[\s\S]*formatCharacterFactionMeta/, 'Character detail must show real faction records from the selected profile detail');
assert.match(charactersPage, /import \{ CharacterRelationGraphView,[\s\S]*renderCharacterGraphEdgeDetail[\s\S]*\} from '\.\.\/features\/characters\/CharacterRelationGraphView'/, 'CharactersPage must delegate relationship graph workbench rendering to CharacterRelationGraphView');
assert.match(characterRelationGraphView, /export function CharacterRelationGraphView\([\s\S]*characterPayload=\{characterPayload\}[\s\S]*onSelectCharacter=\{onSelectCharacter\}[\s\S]*onOpenEvidence=\{onOpenEvidence\}/, 'Relationship graph view must render a dedicated graph table component from the selected payload');
assert.match(characterRelationGraphView, /function CharacterRelationGraphTable\([\s\S]*buildCharacterGraphModel\(characterPayload\.profiles, characterPayload\.relations,[\s\S]*displayedGraphCanvas = currentGraphCanvas \?\? cachedGraphCanvas[\s\S]*const graphPreview = !graphPanelState\.renderGraph \|\| !graph \|\| !displayedGraphCanvas \|\| !graphRenderModel \|\| !characterPayload \? \([\s\S]*renderCharacterGraphStatus\(graphPanelState, t\)[\s\S]*characters\.graphTableTitle/, 'Relationship graph view must provide named status panels from the full graph and cached/WebGL render models');
assert.match(characterRelationGraphView, /createPortal\(graphPreview, document\.body\)/, 'Relationship graph fullscreen preview must portal to document.body so fixed positioning is not constrained by the Character Center shell');
assert.match(characterRelationGraphView, /buildCharacterGraphRelationViewport[\s\S]*relationTableRows\.slice\(graphTableViewport\.startIndex, graphTableViewport\.endIndex\)[\s\S]*findGraphNode\(currentGraph, edge\.sourceId\)[\s\S]*renderCharacterGraphNodeButton\(sourceNode, edge\.sourceId[\s\S]*renderCharacterGraphNodeButton\(targetNode, edge\.targetId[\s\S]*renderCharacterGraphEvidenceAction\(edge, evidenceById, onOpenEvidence, t\)/, 'Relationship graph table must virtualize full relation rows while preserving typed node actions and evidence jump actions');
assert.match(charactersPage, /<CharacterRelationGraphView[\s\S]*characterPayload=\{selectedCharacterPayload\}[\s\S]*centerState=\{centerState\}[\s\S]*selectedCharacterId=\{selectedCharacterId\}[\s\S]*onSelectCharacter=\{setSelectedCharacterId\}/, 'Relationship graph view must receive the center state and selected character so it can show status, one-hop, and two-hop scopes');
assert.match(characterGraphModel, /export type CharacterGraphFocusMode = 'all' \| 'one-hop' \| 'two-hop'/, 'Relationship graph model must define explicit all, one-hop, and two-hop scope modes');
assert.match(characterRelationGraphView, /type CharacterGraphFocusMode/, 'Relationship graph view must import the shared focus-scope type');
assert.match(characterRelationGraphView, /const graphFocusMode = graphSessionState\.focusMode/, 'Relationship graph view must read focus-scope state from the session model');
assert.doesNotMatch(characterRelationGraphView, /characters\.graphTableFocusFilter[\s\S]*<select/, 'Compact relationship graph must not expose the old focus-scope selector because preview controls stay collapsed until fullscreen');
assert.doesNotMatch(characterRelationGraphView, /<option value="one-hop" disabled=\{!selectedCharacterId\}/, 'Relationship graph must not render the old one-hop selector in the embedded table controls');
assert.doesNotMatch(characterRelationGraphView, /<option value="two-hop" disabled=\{!selectedCharacterId\}/, 'Relationship graph must not render the old two-hop selector in the embedded table controls');
assert.match(characterRelationGraphView, /focusCharacterId: graphFocusMode === 'all' \? undefined : selectedCharacterId \?\? undefined[\s\S]*focusDepth: graphFocusMode === 'one-hop' \? 1 : graphFocusMode === 'two-hop' \? 2 : 'all'/, 'Relationship graph view must pass the current character focus into the pure graph selector');
assert.match(characterRelationGraphView, /resolveCharacterGraphPanelState\(\{[\s\S]*hasPayload: Boolean\(characterPayload\)[\s\S]*centerStateId: centerState\.stateId[\s\S]*relationCount: characterPayload\?\.relations\.length \?\? 0[\s\S]*focusMode: graphFocusMode[\s\S]*selectedCharacterId/, 'Relationship graph view must derive explicit loading, error, filtered-empty, focus-empty, and unavailable states');
assert.match(characterRelationGraphView, /function renderCharacterGraphStatus\([\s\S]*CharacterGraphPanelState[\s\S]*characters-graph-status[\s\S]*t\(state\.titleKey\)[\s\S]*t\(state\.bodyKey\)/, 'Relationship graph view must render named graph status panels instead of a generic empty sentence');
assert.doesNotMatch(charactersPage, /const graphCanvas = useMemo\(\(\) => graph && graphPanelState\.renderGraph \? buildCharacterGraphCanvasModel\(graph\) : null, \[graph, graphPanelState\.renderGraph\]\)/, 'Relationship graph view must not synchronously build the large canvas layout during React render');
assert.match(characterRelationGraphView, /new Worker\(new URL\('\.\/characterGraphLayoutWorker\.ts', import\.meta\.url\), \{ type: 'module' \}\)/, 'Relationship graph view must build large topology layouts in a module Web Worker');
assert.match(characterRelationGraphView, /const \[graphCanvas, setGraphCanvas\] = useState<\{ key: string; canvas: CharacterGraphCanvasModel \} \| null>\(null\)[\s\S]*setGraphCanvas\(null\)[\s\S]*worker\.postMessage\(/, 'Relationship graph view must keep keyed async canvas layout state and clear stale layouts while the worker runs');
assert.match(characterRelationGraphView, /worker\.terminate\(\)/, 'Relationship graph layout worker must be terminated on graph changes and component unmount');
assert.match(characterCenterSession, /export type CharacterGraphSessionViewMode = 'full' \| 'community' \| 'core' \| 'neighborhood'/, 'Character graph session state must expose full, community, core, and neighborhood view modes');
assert.match(characterRelationGraphView, /const graphViewMode = graphSessionState\.viewMode/, 'Relationship graph view must read graph view mode from session state');
assert.match(characterGraphCanvasView, /onDoubleClick=\{handleDoubleClick\}/, 'Relationship graph canvas must support double-click focus on a node');
assert.match(characterGraphCanvasView, /function handleDoubleClick[\s\S]*findNearestGraphCanvasNode[\s\S]*onFocusSearch\(nearestNode\.id, nearestNode\.label\)/, 'Double-clicking a canvas node must enter the preview-style search subgraph');
assert.match(characterGraphCanvasView, /onRestoreFullGraph\(\)/, 'Clicking graph whitespace must be able to restore the full graph view');
assert.match(characterGraphWebglView, /export function CharacterGraphWebglView\([\s\S]*CharacterGraphRenderModel[\s\S]*characters-graph-canvas[\s\S]*<canvas[\s\S]*characters\.graphCanvasAria/, 'Relationship graph view must render a single retained WebGL canvas before the table fallback');
assert.match(characterGraphCanvasView, /export function CharacterGraphCanvasView\([\s\S]*CharacterGraphCanvasModel[\s\S]*characters-graph-canvas[\s\S]*<canvas[\s\S]*characters\.graphCanvasAria/, 'Canvas fallback must preserve one accessible bitmap when WebGL is unavailable');
assert.match(characterGraphCanvasView, /const graphDescriptionId = 'characters-graph-canvas-description'[\s\S]*aria-describedby=\{graphDescriptionId\}[\s\S]*id=\{graphDescriptionId\}[\s\S]*className="sr-only"[\s\S]*characters\.graphCanvasDescription/, 'Relationship graph canvas must provide a list-style screen-reader description tied to the interactive graph');
assert.match(characterGraphWebglView, /className="characters-graph-canvas-bitmap-host characters-graph-webgl-host"[\s\S]*onWheel=\{handleWheel\}[\s\S]*onPointerDown=\{handlePointerDown\}[\s\S]*<canvas[\s\S]*className="characters-graph-canvas-bitmap characters-graph-webgl-canvas"[\s\S]*role="img"/, 'Relationship graph WebGL canvas must expose one accessible bitmap while pointer interactions are owned by the renderer host');
assert.match(characterGraphCanvasView, /className="characters-graph-canvas-bitmap-host"[\s\S]*onWheel=\{handleWheel\}[\s\S]*onPointerDown=\{handlePointerDown\}[\s\S]*<canvas[\s\S]*className="characters-graph-canvas-bitmap"[\s\S]*role="img"/, 'Canvas fallback must keep the same accessible bitmap host contract');
assert.doesNotMatch(charactersPage, /<svg viewBox=\{canvas\.viewBox\}/, 'Relationship graph canvas must not render thousands of SVG DOM nodes for large books');
assert.doesNotMatch(characterGraphCanvasView, /<svg viewBox=\{canvas\.viewBox\}/, 'Relationship graph canvas must not render thousands of SVG DOM nodes for large books');
assert.match(characterRelationGraphView, /const graphCanvasViewport = graphSessionState\.viewport/, 'Relationship graph canvas must restore explicit zoom and pan viewport state from Character Center session state');
assert.doesNotMatch(characterRelationGraphView, /const \[graphCanvasViewport, setGraphCanvasViewport\] = useState<CharacterGraphCanvasViewport>/, 'Relationship graph canvas viewport must not be local component state because unmounting the relation page should not reset zoom or pan');
assert.doesNotMatch(charactersPage, /const characterGraphDefaultMaxNodes = 200/, 'Relationship graph view must not define a 200-node cap for large books');
assert.doesNotMatch(characterRelationGraphView, /graph\.summary\.aggregatedNodeCount[\s\S]*characters\.graphAggregationSummary/, 'Relationship graph view must not show large graph aggregation because the canvas renders the full graph');
assert.match(characterGraphModel, /maxNodes\?: number[\s\S]*focusCharacterId\?: string[\s\S]*focusDepth\?: CharacterGraphFocusDepth[\s\S]*aggregatedNodeCount[\s\S]*aggregatedRelationCount[\s\S]*focusFilteredNodeCount[\s\S]*focusFilteredRelationCount/, 'Character graph selector must preserve the public focus and legacy summary contract while keeping aggregation counts at zero');
assert.doesNotMatch(characterGraphModel, /normalizeGraphMaxNodes|capCharacterGraphNodes|candidateNodes\.length - nodes\.length/, 'Character graph selector must not cap or aggregate graph nodes');
assert.doesNotMatch(characterGraphCanvasView, /characterGraphViewportControls[\s\S]*zoom-in[\s\S]*zoom-out[\s\S]*pan-left[\s\S]*pan-right[\s\S]*pan-up[\s\S]*pan-down[\s\S]*reset/, 'Relationship graph canvas must not reintroduce old zoom/pan button controls; preview parity uses wheel, drag, and toolbar reset');
assert.match(characterGraphCanvasView, /viewRef[\s\S]*updateViewport\([\s\S]*commit: 'immediate' \| 'deferred' \| 'none'[\s\S]*commit === 'none'[\s\S]*applyCharacterGraphCanvasCompositePreview\(\)[\s\S]*scheduleCharacterGraphCanvasSettledDraw/, 'Relationship graph canvas controls must update preview-style viewport refs with compositor previews instead of per-frame React or canvas redraws');
assert.match(characterGraphCanvasView, /characters-graph-canvas-controls compact[\s\S]*characters\.graphCanvasControlsAria[\s\S]*characters-graph-canvas-fullscreen-btn[\s\S]*characters\.graphCanvasFullscreen/, 'Compact relationship graph canvas controls must expose only the named expand button');
assert.match(characterGraphCanvasRuntime, /context\.scale\(viewport\.scale, viewport\.scale\)[\s\S]*context\.translate\(viewport\.offsetX, viewport\.offsetY\)/, 'Relationship graph canvas runtime must apply the preview world transform in the bitmap drawing path');
assert.match(characterGraphCanvasView, /characters-graph-canvas-viewport-status[\s\S]*characters\.graphCanvasViewportStatus/, 'Relationship graph canvas must expose the current zoom and pan status');
assert.match(characterGraphCanvasView, /const nearestNode = findNearestGraphCanvasNode\(canvas, point\.x, point\.y, viewportRef\.current\.scale\)[\s\S]*nodeHit: nearestNode\?\.id \?\? null[\s\S]*!moved && nodeHit[\s\S]*onSelectCharacter\(nodeHit\)/, 'Relationship graph canvas nodes must open character details through preview-style click hit testing');
assert.match(characterGraphCanvasView, /const nearestEdge = nearestNode \? null : findNearestGraphCanvasEdge\(canvas, point\.x, point\.y, viewportRef\.current\.scale\)[\s\S]*edgeHit: nearestEdge\?\.id \?\? null[\s\S]*!moved && edgeHit[\s\S]*onSelectEdge\(edgeHit\)/, 'Relationship graph canvas edges must open relationship details through preview-style click hit testing');
assert.match(characterGraphCanvasRuntime, /export function drawCharacterGraphCanvas[\s\S]*buildVisibleGraphCanvasFrame[\s\S]*labelBoxes[\s\S]*drawCharacterGraphCanvasNode[\s\S]*boxesOverlap/, 'Character graph canvas runtime must preserve preview-style visible-range culling, interaction edge budgets, and label collision avoidance');
assert.match(characterGraphCanvasRuntime, /export function findNearestGraphCanvasNode[\s\S]*export function findNearestGraphCanvasEdge[\s\S]*distanceToQuadraticCurve[\s\S]*function distanceToSegment[\s\S]*Math\.hypot/, 'Character graph canvas runtime must provide deterministic node and edge hit testing without DOM edge elements');
assert.doesNotMatch(characterGraphCanvasRuntime, /from 'react'|from "react"|useState|useMemo|\.tsx/, 'Character graph canvas runtime must remain React-independent');
assert.doesNotMatch(charactersPage, /<button[\s\S]{0,320}role="cell"/, 'Relationship graph table buttons must keep native button semantics instead of being masked as table cells');
assert.match(characterRelationGraphView, /function renderCharacterGraphNodeButton\([\s\S]*CharacterGraphNode \| null[\s\S]*getPrivacyBookTitle\(node\?\.label \|\| characterId, privacySettings\)[\s\S]*kind-\$\{visual\.group\} shape-\$\{visual\.shape\}/, 'Relationship graph nodes must derive privacy-safe typed node button styling from graph node visual metadata');
assert.match(characterRelationGraphView, /function renderCharacterGraphNodeButton\([\s\S]*onClick=\{\(\) => onSelectCharacter\(characterId\)\}[\s\S]*characters\.graphTableOpenCharacterWithKind/, 'Relationship graph node buttons must keep the open-detail action and accessible typed label');
assert.match(characterRelationGraphView, /characters-graph-node-kind-badge[\s\S]*visual\.marker[\s\S]*characters-graph-node-name[\s\S]*characters-graph-node-kind-label[\s\S]*kindLabel/, 'Relationship graph node buttons must show a non-color kind marker, name, and kind text');
assert.match(characterRelationGraphView, /const graphRelationTypeFilter = graphSessionState\.relationTypeFilter[\s\S]*const graphMinConfidenceFilter = graphSessionState\.minConfidenceFilter[\s\S]*relationTypes: graphRelationTypeFilter === 'all' \? \[\] : \[graphRelationTypeFilter\][\s\S]*minConfidence/, 'Relationship graph table must expose relation type and minimum confidence filter state backed by the session model and graph model');
assert.match(characterRelationGraphView, /const graphChapterStartFilter = graphSessionState\.chapterStartFilter[\s\S]*const graphChapterEndFilter = graphSessionState\.chapterEndFilter[\s\S]*buildCharacterGraphChapterRange\(graphChapterStartFilter, graphChapterEndFilter\)[\s\S]*chapterRange,/, 'Relationship graph table must expose chapter range filter state backed by the session model and graph model');
assert.match(characterRelationGraphView, /function buildCharacterGraphChapterRange\([\s\S]*parseVisibleChapterFilterValue[\s\S]*Math\.floor\(parsed\) - 1/, 'Relationship graph chapter range helper must translate visible one-based chapter numbers into source zero-based indexes');
assert.doesNotMatch(characterRelationGraphView, /characters-graph-tools[\s\S]*characters\.graphTableRelationTypeFilter[\s\S]*characters\.graphTableMinConfidenceFilter[\s\S]*characters\.graphTableStartChapterFilter[\s\S]*characters\.graphTableEndChapterFilter/, 'Compact relationship graph table must not render the old filter toolbar; advanced graph controls stay collapsed until fullscreen');
assert.match(characterRelationGraphView, /characters-graph-preview-toolbar[\s\S]*graphSearchDraft[\s\S]*String\(graphNeighborDepth\)[\s\S]*graphEdgeMode/, 'Fullscreen relationship graph must render the preview toolbar controls instead of the old embedded filter toolbar');
assert.match(characterRelationGraphView, /import \{ buildCharacterGraphEdgeDetail,[\s\S]*type CharacterGraphEdgeDetail \} from '\.\/characterGraphEdgeDetail'/, 'Relationship graph edge details must reuse a pure selector');
assert.match(characterRelationGraphView, /const selectedGraphEdgeId = graphSessionState\.selectedGraphEdgeId[\s\S]*buildCharacterGraphEdgeDetail\(characterPayload, selectedGraphEdge\)/, 'Relationship graph table must restore the selected edge from session state and derive a detail model');
assert.doesNotMatch(characterRelationGraphView, /const \[selectedGraphEdgeId, setSelectedGraphEdgeId\] = useState<string \| null>\(null\)/, 'Relationship graph table must not keep selected edge as local state because returning to the page should preserve relation inspection context');
assert.match(characterRelationGraphView, /characters-graph-relation-button[\s\S]*onClick=\{\(\) => selectGraphEdge\(edge\.id\)\}[\s\S]*characters\.graphTableOpenRelation/, 'Relationship graph table must let users click an edge to select relationship details');
assert.match(characterRelationGraphView, /export function renderCharacterGraphEdgeDetail\([\s\S]*CharacterGraphEdgeDetail[\s\S]*characters\.graphEdgeDetailTitle/, 'Relationship edge detail must render a titled detail section');
assert.match(characterRelationGraphView, /export function renderCharacterGraphEdgeDetail\([\s\S]*characters\.graphEdgeDetailRelations[\s\S]*detail\.relations\.map/, 'Relationship edge detail must show relation records');
assert.match(characterRelationGraphView, /export function renderCharacterGraphEdgeDetail\([\s\S]*characters\.graphEdgeDetailEvidence[\s\S]*detail\.evidence\.slice\(0, 8\)\.map[\s\S]*onOpenEvidence\(item\)/, 'Relationship edge detail must show evidence paragraphs and evidence jump actions');
assert.match(characterWorkbenchViews, /export function renderCharacterAppearanceHeatmap\([\s\S]*characterPayload: CharacterCenterPayload[\s\S]*onOpenLocation: \(location: CharacterLocation, label: string\) => void[\s\S]*<CharacterAppearanceHeatmapView[\s\S]*characterPayload=\{characterPayload\}[\s\S]*onOpenLocation=\{onOpenLocation\}/, 'Appearance heatmap view must render a dedicated component from the real character payload');
assert.match(characterWorkbenchViews, /function CharacterAppearanceHeatmapView\([\s\S]*const \[selectedHeatmapCharacterId, setSelectedHeatmapCharacterId\] = useState\('all'\)[\s\S]*buildCharacterAppearanceHeatmapModel\(\{[\s\S]*profiles: characterPayload\.profiles,[\s\S]*appearanceStats: characterPayload\.appearanceStats,[\s\S]*selectedCharacterId: selectedHeatmapCharacterId === 'all' \? null : selectedHeatmapCharacterId/, 'Appearance heatmap must expose a character selector backed by the pure heatmap model');
assert.doesNotMatch(charactersPage, /function CharacterAppearanceHeatmapView\(/, 'CharactersPage must not inline the appearance heatmap component');
assert.match(characterWorkbenchViews, /characters-appearance-heatmap-card[\s\S]*characters\.appearanceHeatmapEyebrow[\s\S]*characters\.appearanceHeatmapTitle[\s\S]*characters\.appearanceHeatmapSummary[\s\S]*characters\.appearanceHeatmapCharacterFilter[\s\S]*characters\.appearanceHeatmapRankingTitle[\s\S]*characters\.appearanceHeatmapChapterTitle/, 'Appearance heatmap must render summary, character filter, ranking, and chapter distribution UI');
assert.match(characterWorkbenchViews, /characters-appearance-heatmap-card[\s\S]*<ThemedSelect className="characters-book-filter characters-themed-filter" label=\{t\('characters\.appearanceHeatmapCharacterFilter'\)\}/, 'Appearance heatmap character filter must use the themed select');
assert.match(characterWorkbenchViews, /model\.characterRankings\.slice\(0, 8\)[\s\S]*characters\.appearanceHeatmapMentions[\s\S]*characters\.appearanceHeatmapChapters[\s\S]*Math\.round\(item\.confidence \* 100\)/, 'Appearance heatmap must render the main character heat ranking with mentions, chapter count, and confidence');
assert.match(characterWorkbenchViews, /const \[heatmapScrollTop, setHeatmapScrollTop\] = useState\(0\)[\s\S]*buildCharacterListViewport\(\{[\s\S]*totalCount: selectedChapterBuckets\.length[\s\S]*rowHeight: characterAppearanceChapterRowHeight[\s\S]*const visibleChapterBuckets = selectedChapterBuckets\.slice\(chapterViewport\.startIndex, chapterViewport\.endIndex\)/, 'Appearance heatmap chapters must virtualize large chapter distributions');
assert.match(characterWorkbenchViews, /visibleChapterBuckets\.map\([\s\S]*selectedHeatmapCharacterId === 'all' \? chapter\.mentionCount : chapter\.selectedMentionCount[\s\S]*onClick=\{\(\) => onOpenLocation\(chapter\.location, chapterTitle\)\}[\s\S]*aria-label=\{t\('characters\.appearanceHeatmapJumpChapterAria', \{ title: chapterTitle \}\)\}/, 'Appearance heatmap chapters must show selected-character distribution and jump back to privacy-safe reader locations');
assert.match(characterAppearanceHeatmap, /export function buildCharacterAppearanceHeatmapModel\([\s\S]*appearanceStats[\s\S]*characterRankings[\s\S]*chapterBuckets[\s\S]*selectedCharacterChapters/, 'Appearance heatmap model must aggregate real appearance stats into rankings and chapter buckets');
assert.doesNotMatch(characterAppearanceHeatmap, /第 \$\{sourceChapterIndex \+ 1\} 章/, 'Appearance heatmap selector must not hard-code localized chapter fallback text');
assert.match(characterEvidenceTable, /export function renderCharacterEvidenceTable\([\s\S]*characterPayload: CharacterCenterPayload[\s\S]*onOpenEvidence: \(evidence: CharacterEvidence\) => void[\s\S]*return \([\s\S]*<CharacterEvidenceTable[\s\S]*characterPayload=\{characterPayload\}[\s\S]*onOpenEvidence=\{onOpenEvidence\}/, 'Evidence view must render a dedicated table component over the real character payload');
assert.match(characterEvidenceTable, /function CharacterEvidenceTable\([\s\S]*const \[evidenceQuery, setEvidenceQuery\] = useState\(''\)[\s\S]*const \[evidenceCharacterFilter, setEvidenceCharacterFilter\] = useState\('all'\)[\s\S]*const \[evidenceRelationFilter, setEvidenceRelationFilter\] = useState\('all'\)[\s\S]*const \[evidenceChapterFilter, setEvidenceChapterFilter\] = useState\('all'\)/, 'Evidence table must expose search plus character, relation, and chapter filter state');
assert.match(characterEvidenceTable, /const filteredEvidence = useMemo\([\s\S]*characterPayload\.evidence[\s\S]*formatCharacterEvidenceTarget\(item, characterPayload, privacySettings, t\)[\s\S]*formatCharacterLocation\(item\.location, t\)[\s\S]*evidenceCharacterFilter[\s\S]*evidenceRelationFilter[\s\S]*evidenceChapterFilter/, 'Evidence table must filter real evidence by text, resolved character, relation, and chapter');
assert.match(characterEvidenceTable, /characters-evidence-table-card[\s\S]*characters\.evidenceTableEyebrow[\s\S]*characters\.evidenceTableTitle[\s\S]*characters\.evidenceTableSummary[\s\S]*characters\.evidenceTableSearch[\s\S]*characters\.evidenceTableCharacterFilter[\s\S]*characters\.evidenceTableRelationFilter[\s\S]*characters\.evidenceTableChapterFilter/, 'Evidence table must render visible evidence search and filter controls');
assert.match(characterEvidenceTable, /characters-evidence-table-card[\s\S]*<label className="characters-book-search">[\s\S]*characters\.evidenceTableSearch[\s\S]*<input[\s\S]*<\/label>[\s\S]*characters\.evidenceTableCharacterFilter[\s\S]*characters\.evidenceTableRelationFilter[\s\S]*characters\.evidenceTableChapterFilter/, 'Evidence search, character, relation, and chapter filters must have visible labels');
assert.match(characterEvidenceTable, /characters-evidence-table-scroll[\s\S]*role="table"[\s\S]*characters\.evidenceTableType[\s\S]*characters\.evidenceTableQuote[\s\S]*characters\.evidenceTableTarget[\s\S]*characters\.evidenceTableLocation[\s\S]*characters\.evidenceTableSource[\s\S]*characters\.evidenceTableConfidence[\s\S]*characters\.evidenceTableAction/, 'Evidence table must render type, quote, target, location, source, confidence, and action columns');
assert.match(characterEvidenceTable, /characters-evidence-row[\s\S]*item\.targetType[\s\S]*item\.quote \|\| item\.claim[\s\S]*formatCharacterEvidenceTarget\(item, characterPayload, privacySettings, t\)[\s\S]*formatCharacterLocation\(item\.location, t\)[\s\S]*item\.source[\s\S]*Math\.round\(item\.confidence \* 100\)[\s\S]*onClick=\{\(\) => onOpenEvidence\(item\)\}/, 'Evidence rows must display evidence metadata and jump back to the reader');
assert.match(characterEvidenceTable, /import \{ formatCharacterEvidenceCitationCopy \} from '\.\/characterEvidenceCitation'/, 'Evidence table must reuse the pure citation-copy formatter');
assert.match(characterEvidenceTable, /function copyCharacterEvidenceCitation\([\s\S]*formatCharacterEvidenceCitationCopy\(\{[\s\S]*bookTitle[\s\S]*typeLabel: formatCharacterEvidenceType\(item\.targetType, t\)[\s\S]*targetLabel[\s\S]*locationLabel[\s\S]*quote: item\.quote[\s\S]*claim: item\.claim[\s\S]*privacyMode[\s\S]*privateValue: t\('characters\.evidenceCitationPrivateValue'\)[\s\S]*navigator\.clipboard\?\.writeText\(payload\)/, 'Evidence table must copy a privacy-aware citation payload to the clipboard');
assert.match(characterEvidenceTable, /characters\.evidenceTableCopyCitation/, 'Evidence rows must expose a visible copy-citation action');
assert.match(characterEvidenceTable, /characters\.evidenceTableCopyCitationAria/, 'Evidence rows must expose an aria label for copying citations');
assert.match(characterEvidenceCitation, /export function formatCharacterEvidenceCitationCopy\(/, 'Character evidence citation formatter must export the copy formatter');
for (const citationField of ['evidenceId', 'bookTitle', 'typeLabel', 'targetLabel', 'locationLabel', 'quote', 'claim', 'sourceLabel', 'confidencePercent']) {
  assert.match(characterEvidenceCitation, new RegExp(citationField), `Character evidence citation formatter must include ${citationField}`);
}
assert.match(characterEvidenceCitation, /privacyMode[\s\S]*privateValue[\s\S]*privacySensitiveValue/, 'Character evidence citation formatter must centralize privacy redaction for copied sensitive fields');
assert.doesNotMatch(characterEvidenceCitation, /window\.|document\.|navigator\.|from 'react'|from "react"|React\.|useState|useMemo|\.tsx/, 'Character evidence citation formatter must stay pure and UI-independent');
assert.match(characterEvidenceTable, /function formatCharacterEvidenceTarget\([\s\S]*targetType === 'relation'[\s\S]*sourceCharacterId[\s\S]*targetCharacterId[\s\S]*targetType === 'profile'[\s\S]*targetType === 'mention'[\s\S]*targetType === 'event'[\s\S]*targetType === 'faction'/, 'Evidence table must resolve target labels for profiles, mentions, relations, events, and factions');
assert.match(characterEvidenceTable, /const evidenceCharacterOptions = useMemo\([\s\S]*characterPayload\.profiles[\s\S]*getPrivacyBookTitle\(profile\.displayName \|\| profile\.canonicalName, privacySettings\)/, 'Evidence character filter must derive options from real profiles with privacy-safe labels');
assert.match(characterEvidenceTable, /const evidenceRelationOptions = useMemo\([\s\S]*characterPayload\.relations[\s\S]*formatCharacterRelationOption\(relation, characterPayload, privacySettings, t\)/, 'Evidence relation filter must derive options from real relationships');
assert.match(characterEvidenceTable, /const evidenceChapterOptions = useMemo\([\s\S]*characterPayload\.evidence[\s\S]*formatCharacterLocation\(item\.location, t\)/, 'Evidence chapter filter must derive options from real evidence locations');
assert.match(characterEvidenceTable, /useEffect\(\(\) => \{[\s\S]*setEvidenceQuery\(''\)[\s\S]*setEvidenceCharacterFilter\('all'\)[\s\S]*setEvidenceRelationFilter\('all'\)[\s\S]*setEvidenceChapterFilter\('all'\)[\s\S]*\}, \[characterPayload\.book\.id\]\)/, 'Evidence table must reset book-scoped filters when the selected character payload book changes');
assert.match(characterEvidenceTable, /const characterEvidenceLookupCache = new WeakMap<CharacterCenterPayload, CharacterEvidenceLookup>\(\)/, 'Evidence filtering must cache payload lookups instead of repeatedly scanning every collection for each evidence row');
assert.match(characterEvidenceTable, /function getCharacterEvidenceLookup\([\s\S]*profileById[\s\S]*mentionById[\s\S]*relationById[\s\S]*relationByEvidenceId[\s\S]*eventById[\s\S]*factionById[\s\S]*characterEvidenceLookupCache\.set\(characterPayload, lookup\)/, 'Evidence filtering must pre-index profiles, mentions, relations, events, and factions for large payloads');
assert.match(characterEvidenceTable, /aria-rowcount=\{filteredEvidence\.length \+ 1\}[\s\S]*aria-rowindex=\{1\}[\s\S]*aria-rowindex=\{viewport\.startIndex \+ relativeIndex \+ 2\}/, 'Virtual evidence table must expose row count and row index metadata');
assert.match(characterEvidenceTable, /formatCharacterEvidenceStatus\(item\.status, t\)/, 'Evidence source/status cell must localize evidence status instead of showing raw enum text');
assert.match(characterPageUtils, /function formatCharacterLocation\([\s\S]*sourceChapterIndex[\s\S]*chapterIndex[\s\S]*characters\.detailChapterFallback/, 'Character locations must fall back to source/chapter indexes when chapter titles are unavailable');
assert.match(appTaskActions, /queueCharacterExtraction\(/, 'App task actions must queue the real character extraction backend task');
assert.match(appSource, /useCharacterCenter\([^)]*\)/, 'App must use the character center hook for persisted character payload loading');
assert.match(useCharacterCenter, /loadCharacterCenterPayload\(/, 'Character center hook must load the real persisted character payload');
assert.match(taskService, /getTaskStageLabelForKind[\s\S]*character-extraction[\s\S]*扫描人物[\s\S]*写入人物索引/, 'Task Center must show character-specific stage labels for character extraction tasks');

assert.match(charactersPage, /type CharactersPageProps = \{[\s\S]*bookSummaries: CharacterCenterBookSummary\[\];[\s\S]*currentBook: CharacterCenterBookSummary \| null;[\s\S]*indexDiagnostics: IndexDiagnostics \| null;/, 'CharactersPage must be driven by sanitized book summaries and index diagnostics props');
assert.doesNotMatch(charactersPage, /books: Book\[\]|currentBook: Book \| null|from '\.\.\/types'.*Book/, 'CharactersPage must not accept full Book records that can include full text content');
assert.match(charactersPage, /type CharacterCenterUnavailableBookReason = 'none' \| 'missing' \| 'deleted'/, 'CharactersPage must model missing and trash-book entry states explicitly');
assert.match(charactersPage, /unavailableBookReason: CharacterCenterUnavailableBookReason;/, 'CharactersPage props must receive the selected-book unavailable reason');
assert.doesNotMatch(charactersPage, /const characters = \[/, 'CharactersPage must not use the old static character card array');
assert.match(charactersPage, /characters\.center\.title/, 'CharactersPage must use the dedicated Character Center title translation key');
assert.match(charactersPage, /unavailableBookReason === 'missing' \|\| unavailableBookReason === 'deleted'/, 'CharactersPage must show a dedicated state when the requested book is missing or in trash');
assert.match(charactersPage, /characters\.unavailable\.missingTitle/, 'CharactersPage must tell the user when the requested book no longer exists');
assert.match(charactersPage, /characters\.unavailable\.deletedTitle/, 'CharactersPage must tell the user when the requested book is in trash');
assert.ok(charactersPage.indexOf("unavailableBookReason === 'missing' || unavailableBookReason === 'deleted'") < charactersPage.indexOf('bookSummaries.length === 0'), 'CharactersPage must prioritize requested-book errors before the empty-shelf fallback');
assert.match(charactersPage, /if \(bookSummaries\.length === 0\) \{[\s\S]*characters\.emptyLibraryTitle[\s\S]*characters\.emptyLibraryBody[\s\S]*characters\.openLibraryAria[\s\S]*characters\.openLibrary/, 'CharactersPage must show an import/library entry when the shelf has no selectable books');
assert.match(characterCenterBooks, /\.filter\(\(book\) => !book\.deleted\)/, 'Character Center book summaries must derive selectable books from the real non-trash shelf');
assert.doesNotMatch(charactersPage, /shelfBooks\[0\]\s*\?\?\s*null/, 'CharactersPage must keep the no-book empty state reachable instead of auto-selecting the first shelf book');
assert.match(charactersPage, /const \[bookQuery, setBookQuery\] = useState\(''\)/, 'CharactersPage must keep a local book search query');
assert.match(charactersPage, /const bookSearchInputRef = useRef<HTMLInputElement \| null>\(null\)/, 'CharactersPage must keep a ref for keyboard focus on the book search input');
assert.match(charactersPage, /const \[bookStatusFilter, setBookStatusFilter\] = useState<CharacterBookStatusFilter>\('all'\)/, 'CharactersPage must keep a local book status filter');
assert.match(charactersPage, /type CharacterBookStatusFilter = 'all' \| 'ready' \| 'missing' \| 'stale' \| 'failed' \| 'character-failed'/, 'Character Center book filters must distinguish text-index failures from character-extraction failures');
assert.match(charactersPage, /useEffect\(\(\) => \{[\s\S]*function onCharacterCenterKeyDown\(event: KeyboardEvent\)[\s\S]*event\.key !== '\/' \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey \|\| event\.shiftKey[\s\S]*isEditableCharacterCenterShortcutTarget\(event\.target\)[\s\S]*!bookSearchInputRef\.current[\s\S]*bookSearchInputRef\.current\?\.focus\(\)[\s\S]*bookSearchInputRef\.current\?\.select\(\)[\s\S]*window\.addEventListener\('keydown', onCharacterCenterKeyDown\)[\s\S]*window\.removeEventListener\('keydown', onCharacterCenterKeyDown\)[\s\S]*\}, \[[^\]]*selectedCharacterId[^\]]*\]\)/, 'Character Center must let / focus the book search input without stealing input-field, modifier, or empty-state keystrokes');
assert.match(charactersPage, /useEffect\(\(\) => \{[\s\S]*function onCharacterCenterKeyDown\(event: KeyboardEvent\)[\s\S]*event\.key === 'Escape'[\s\S]*!selectedCharacterId[\s\S]*isEditableCharacterCenterShortcutTarget\(event\.target\)[\s\S]*setSelectedCharacterId\(null\)[\s\S]*\}, \[[^\]]*selectedCharacterId[^\]]*\]\)/, 'Character Center must let Esc close the open character detail panel without stealing editable-field keystrokes');
assert.match(charactersPage, /useEffect\(\(\) => \{[\s\S]*function onCharacterCenterKeyDown\(event: KeyboardEvent\)[\s\S]*const shortcutKey = event\.key\.toLocaleLowerCase\(\)[\s\S]*shortcutKey === 'g'[\s\S]*isEditableCharacterCenterShortcutTarget\(event\.target\)[\s\S]*selectWorkbenchView\('relations'\)[\s\S]*shortcutKey === 'e'[\s\S]*isEditableCharacterCenterShortcutTarget\(event\.target\)[\s\S]*selectWorkbenchView\('evidence'\)/, 'Character Center must let G and E switch to relationship and evidence views without stealing editable-field keystrokes');
assert.match(charactersPage, /shortcutKey === 'r'[\s\S]*canQueueCharacterRebuild\([\s\S]*queueCharacterExtraction\(\{ confirmRebuild: true \}\)/, 'Character Center must let R rebuild the current character index with confirmation');
assert.match(characterPageUtils, /function isEditableCharacterCenterShortcutTarget\(target: EventTarget \| null\)[\s\S]*input[\s\S]*textarea[\s\S]*select[\s\S]*isContentEditable/, 'Character Center shortcut handling must ignore editable targets');
assert.doesNotMatch(charactersPage, /buildCharacterCenterBookSummaries\(books, indexDiagnostics\)|buildCharacterCenterBookSummary\(selectedBook, indexDiagnostics\)/, 'CharactersPage must receive sanitized summaries instead of rebuilding them from full Book records');
assert.match(charactersPage, /CharacterCenterBookSummary/, 'CharactersPage must use CharacterCenterBookSummary instead of scattering book-index fields through the component');
assert.match(charactersPage, /filteredBooks = useMemo<CharacterCenterBookSummary\[\]>\(\(\) =>[\s\S]*bookQuery[\s\S]*getPrivacyBookTitle[\s\S]*book\.author[\s\S]*getPrivacyFileName[\s\S]*bookStatusFilter/, 'CharactersPage must filter selectable books by title, author, filename, and status');
assert.match(characterPageUtils, /filter === 'ready'\) return book\.textIndexReady/, 'Character Center ready filter must use effective searchable text-index readiness, not raw manifest status');
assert.match(characterPageUtils, /if \(filter === 'character-failed'\) return book\.characterIndexStatus === 'failed'/, 'Character Center must support filtering books whose character extraction failed');
assert.match(charactersPage, /value: 'character-failed', label: t\('characters\.bookStatusFilter\.characterFailed'\)/, 'Character Center themed status filter must expose a character-extraction failure option');
assert.match(charactersPage, /characters-status-pill \$\{textIndexClassName\(book\)\}/, 'Book picker text-index pill class must use effective readiness instead of raw manifest status');
assert.match(charactersPage, /function CharacterBookMenu[\s\S]*characters-status-pill \$\{textIndexClassName\(book\)\}/, 'Book action menu text-index pill class must use effective readiness instead of raw manifest status');
assert.match(charactersPage, /characters\.bookSearchPlaceholder/, 'CharactersPage must render a book search input');
assert.match(charactersPage, /ref=\{bookSearchInputRef\}/, 'CharactersPage must wire the search input ref for / keyboard focus');
assert.match(charactersPage, /characters\.bookStatusFilter/, 'CharactersPage must render a book status filter control');
assert.match(charactersPage, /characters\.bookNoMatchesTitle/, 'CharactersPage must show an empty state when book filters match nothing');
assert.match(characterCenterBooks, /characterIndexStatus: resolveCharacterIndexStatus\(textIndexReady, characterTask\)/, 'Book summaries must derive a character-index status from text-index readiness and the latest character task');
assert.match(characterCenterBooks, /function latestCharacterTaskForBook\(tasks: TaskStatus\[\], bookId: string\)[\s\S]*task\.bookId === bookId && task\.kind === 'character-extraction'[\s\S]*taskSortMillis/, 'Book summaries must use the latest matching character-extraction task for queued, running, succeeded, and failed status');
assert.match(charactersPage, /characters-book-menu-status[\s\S]*indexStatusLabel\(book, t\)[\s\S]*characterStatusLabel\(book\.characterIndexStatus, t\)/, 'Book action menu must show text-index and character-index status pills together from the summary adapter');
assert.match(charactersPage, /characters-status-pill \$\{textIndexClassName\(book\)\}[\s\S]*>\{indexStatusLabel\(book, t\)\}<\/span>/, 'Book action menu text-index state must include visible text, not only color');
assert.match(charactersPage, /characters-status-pill \$\{book\.characterIndexStatus\}[\s\S]*>\{characterStatusLabel\(book\.characterIndexStatus, t\)\}<\/span>/, 'Book action menu character-index state must include visible text, not only color');
assert.match(charactersPage, /const bookDisplayTitle = getPrivacyBookTitle\(book\.displayTitle \|\| book\.title, privacySettings\)/, 'Book picker cards must keep the display title in a tooltip-safe variable');
assert.match(charactersPage, /const bookDisplayFileName = getPrivacyFileName\(book\.fileName, privacySettings\)/, 'Book picker cards must keep the display filename in a tooltip-safe variable');
assert.match(charactersPage, /<strong title=\{bookDisplayTitle\}>\{bookDisplayTitle\}<\/strong>/, 'Book picker title text must expose a native tooltip for truncated long titles');
assert.match(charactersPage, /<em title=\{bookDisplayFileName\}>\{book\.author \|\| bookDisplayFileName\}<\/em>/, 'Book picker filename text must expose a native tooltip for truncated filenames');
assert.match(characterCenterBooks, /coverLabel: book\.coverLabel[\s\S]*coverImagePath: book\.coverImagePath/, 'Character book summaries must preserve cover metadata for the real shelf cover');
assert.match(charactersPage, /function CharacterBookCover[\s\S]*book\.coverImagePath[\s\S]*toCharacterCoverUrl\(book\.coverImagePath\)/, 'Character book cards must render custom cover images through the local asset URL adapter');
assert.match(charactersPage, /aria-label=\{t\('characters\.openLibraryAria'\)\}/, 'Character Center open-library buttons must expose explicit aria-label text');
assert.match(charactersPage, /aria-label=\{t\('characters\.selectBookAria'[\s\S]*title: bookDisplayTitle/, 'Book picker cards must expose explicit aria-label text with the privacy-safe title');
assert.match(characterPageUtils, /aria-label=\{t\('characters\.openTasksAria'\)\}/, 'Character Center task buttons must expose explicit aria-label text');
assert.match(characterPageUtils, /aria-label=\{t\('characters\.openReaderAria'\)\}/, 'Character Center reader buttons must expose explicit aria-label text');
assert.match(characterPageRenderers, /aria-label=\{t\(indexing \? 'characters\.indexingAria' : action === 'rebuild-text-index' \? 'characters\.rebuildTextIndexAria' : 'characters\.runTextIndexAria'\)\}/, 'Character Center text-index primary action must expose explicit aria-label text');
assert.match(styles, /\.characters-workbench\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,1fr\)/, 'Character center workbench must use a Scheme C top toolbar above the atlas body');
assert.match(styles, /\.characters-atlas-body\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) var\(--characters-inspector-width,\s*320px\)/, 'Character center atlas body must use the adjustable inspector width custom property');
assert.match(styles, /\.characters-inspector-pane\s*\{(?=[^}]*width:\s*var\(--characters-inspector-width,\s*320px\))(?=[^}]*position:\s*sticky)(?=[^}]*max-height:\s*calc\(100vh - 160px\))(?=[^}]*overflow:\s*auto)/, 'Character center right inspector must be fixed-width and independently scrollable instead of dropping below the workbench');
assert.match(styles, /\.characters-inspector-pane\.collapsed\s*\{[^}]*width:\s*44px[\s\S]*overflow:\s*hidden/, 'Character center right inspector collapsed state must keep a stable narrow rail in the desktop three-column layout');
assert.match(styles, /\.characters-inspector-toolbar[\s\S]*\.characters-inspector-resize[\s\S]*cursor:\s*ew-resize/, 'Character center right inspector must style the collapse toolbar and resize handle');
assert.match(styles, /\.characters-book-list\s*\{[^}]*display:\s*grid/, 'Book picker list must render one card per row');
assert.match(styles, /\.characters-book-option span,\s*\.characters-book-option em\s*\{[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/, 'Book picker long title and filename must truncate instead of expanding the card');
assert.match(charactersPage, /characterMobileViewTabs[\s\S]*#characters-overview[\s\S]*#characters-profiles[\s\S]*#characters-relations[\s\S]*#characters-heatmap[\s\S]*#characters-evidence[\s\S]*#characters-detail[\s\S]*characters-mobile-view-tabs[\s\S]*characters\.mobileViewTabsAria/, 'Character Center must expose mobile view tabs that jump between the main workbench sections');
assert.match(styles, /\.characters-mobile-view-tabs\s*\{[^}]*display:\s*none/, 'Character Center mobile view tabs must stay hidden on desktop');
assert.match(styles, /\.sr-only\s*\{[\s\S]*position:\s*absolute[\s\S]*width:\s*1px[\s\S]*clip:\s*rect\(0,0,0,0\)[\s\S]*white-space:\s*nowrap/, 'App styles must provide a reusable screen-reader-only utility for graph descriptions');
assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.characters-atlas-body\s*\{[^}]*grid-template-columns:\s*1fr/, 'Character Center must switch to a single-column atlas body on narrow screens');
assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.characters-mobile-view-tabs\s*\{[^}]*display:\s*flex[\s\S]*position:\s*sticky/, 'Character Center mobile view tabs must become a sticky horizontal tab strip on narrow screens');
assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.characters-detail-panel\s*\{[^}]*max-height:\s*min\([^}]*overflow:\s*auto/, 'Character detail panel must become a bounded scrollable drawer on narrow screens instead of covering the main controls');
assert.match(styles, /\.characters-graph-table-card[\s\S]*\.characters-graph-table-scroll[\s\S]*\.characters-graph-row/, 'Relationship graph table must have stable card, scroll, and row styles');
assert.match(styles, /\.characters-atlas-body\.graph-fullscreen\s*\{[^}]*grid-template-columns:\s*1fr[\s\S]*\.characters-atlas-body\.graph-fullscreen\s+\.characters-inspector-pane\s*\{[^}]*display:\s*none/, 'Relationship graph fullscreen must collapse the right inspector column so the graph fills that space');
assert.match(styles, /\.characters-graph-preview-app\.fullscreen\s*\{(?=[^}]*position:\s*fixed)(?=[^}]*inset:\s*0)(?=[^}]*width:\s*100vw)(?=[^}]*height:\s*100vh)[^}]*grid-template-rows:\s*auto minmax\(0,1fr\)/, 'Relationship graph fullscreen preview shell must detach from the Character Center card and use the standalone preview full-viewport app shell');
assert.match(styles, /\.characters-graph-preview-app\.fullscreen[\s\S]*\.characters-graph-preview-app\.fullscreen\s+\.characters-graph-preview-content\s*\{[^}]*grid-template-columns:\s*1fr 380px[\s\S]*\.characters-graph-preview-app\.fullscreen\s+\.characters-graph-canvas\s*\{[^}]*height:\s*100%/, 'Relationship graph fullscreen preview shell must expand the canvas and side inspector while the table is not rendered');
assert.match(charactersPage, /buildTextIndexViewFromSummary\(selectedBook\)/, 'CharactersPage must show readiness from the sanitized character summary instead of full Book content');
assert.match(charactersPage, /onRunParseIndex\(bookId\)/, 'CharactersPage must expose a text-index action for the selected menu book');
assert.match(charactersPage, /<CharacterBookMenu[\s\S]*onRebuildText=[\s\S]*runParseIndexForBook\(menuBook\.id\)/, 'CharactersPage must move the stable text-index rebuild action into the book menu');
assert.match(characterPageRenderers, /function renderManualTextIndexRebuildAction\([\s\S]*if \(!selectedIndexView\.ready\) return null;[\s\S]*primaryAction === 'build-text-index' \|\| primaryAction === 'rebuild-text-index'[\s\S]*onClick=\{runParseIndex\}[\s\S]*characters\.rebuildTextIndex/, 'Manual text-index rebuild action must only show after the text index is ready, avoid duplicating primary text-index actions, and call the real selected-book rebuild flow');
assert.match(charactersPage, /<CharacterBookMenu[\s\S]*onRebuildCharacters=[\s\S]*queueCharacterExtractionForBook\(menuBook\.id, \{ confirmRebuild: true \}\)/, 'CharactersPage must move the stable character-index rebuild action into the book menu');
assert.match(characterPageRenderers, /function renderManualCharacterRebuildAction\([\s\S]*if \(!selectedIndexView\.ready\) return null;[\s\S]*primaryAction === 'character-extraction' \|\| primaryAction === 'rebuild-character-index'[\s\S]*characterStatus === 'queued' \|\| characterStatus === 'building' \|\| characterStatus === 'blocked-by-text-index'/, 'Manual character-index rebuild action must not show before the text index is ready, duplicate primary actions, or appear during active extraction');
assert.match(charactersPage, /function confirmCharacterRebuild\(\)[\s\S]*requestAppConfirm\(t\('characters\.confirmRebuildCharacterIndex'\)\)/, 'Character Center must confirm character-index rebuilds and explain preserved user corrections');
assert.match(characterPageRenderers, /function renderManualCharacterRebuildAction\([\s\S]*onClick=\{\(\) => queueCharacterExtraction\(\{ confirmRebuild: true \}\)\}/, 'Manual character-index rebuild action must request rebuild confirmation before queueing');
assert.match(characterPageRenderers, /const handleClick = action === 'rebuild-character-index'[\s\S]*queueCharacterExtraction\(\{ confirmRebuild: true \}\)[\s\S]*onClick=\{handleClick\}/, 'Primary repair-state character-index rebuild action must request rebuild confirmation before queueing');
assert.match(characterCenterState, /characters\.readiness\.characterMissingBody[\s\S]*characters\.readiness\.characterMissingHint/, 'Character Center state matrix must show a clear missing-character-index start prompt instead of fake profiles');
assert.match(characterCenterState, /if \(staleReason\)[\s\S]*characters\.readiness\.characterMissingRepairTitle[\s\S]*characters\.readiness\.characterMissingRepairBodyWithReason[\s\S]*primaryAction:\s*'rebuild-character-index'/, 'Character Center must surface missing/corrupt persisted character files as a rebuildable repair state instead of a generic first-run prompt');
assert.doesNotMatch(characterCenterState, /readinessBodyParams:\s*\{\s*action:\s*'characters\.action\.startCharacterExtraction'/, 'Character Center must not pass untranslated i18n keys as readiness body params');
assert.match(characterCenterState, /export type CharacterCenterIssue = \{[\s\S]*lastError\?: string;[\s\S]*staleReason\?: string;/, 'Character Center state matrix must distinguish failure errors from character-index stale reasons');
assert.match(characterCenterState, /if \(characterStatus === 'stale'\)[\s\S]*readinessBodyKey: staleReason \? 'characters\.readiness\.characterStaleBodyWithReason' : 'characters\.readiness\.characterStaleBody'[\s\S]*readinessBodyParams: staleReason \? \{ reason: staleReason \} : undefined/, 'Character stale readiness must render staleReason instead of reusing lastError');
assert.match(tauriCharacterStatus, /fn derive_character_stale_reason\([\s\S]*text_index_content_hash != text_manifest\.content_hash[\s\S]*chunk_strategy_version != text_manifest\.chunk_strategy_version[\s\S]*chapter_rule_version != text_manifest\.chapter_rule_version/, 'Backend character summaries must mark ready character indexes stale when text-index content, chunk strategy, or chapter rules change');
assert.match(tauriCharacters, /const MAX_TOTAL_CANDIDATE_MENTIONS: usize = \d[\d_]*;[\s\S]*const MAX_MENTIONS_PER_CHARACTER: usize = \d[\d_]*;/, 'Backend character extraction must bound candidate mentions so long books cannot exhaust memory');
assert.match(tauriCharacters, /const MAX_CHARACTER_PROFILES: usize = \d[\d_]*;/, 'Backend character extraction must bound generated profiles so false-positive names cannot create GB-scale profile files');
assert.doesNotMatch(tauriCharacters, /MAX_CHARACTER_RELATIONS|MAX_PAYLOAD_RELATIONS|MAX_RELATION_EVIDENCE|relation_by_pair\.len\(\)\s*>=\s*2_000|relation_count,\s*MAX_PAYLOAD_RELATIONS/, 'Backend character extraction and payload loading must not cap relationships at 2000 or a fixed UI window');
assert.match(tauriCharacters, /sorted_accumulators[\s\S]*sort_by[\s\S]*mention_count[\s\S]*take\(MAX_CHARACTER_PROFILES\)/, 'Backend character extraction must keep only the strongest bounded character candidates before writing profiles');
assert.match(tauriCharacterExtraction, /mention_count: usize,[\s\S]*mentions: Vec<CandidateMention>[\s\S]*if entry\.mentions\.len\(\) < MAX_MENTIONS_PER_CHARACTER[\s\S]*entry\.mentions\.push\(mention\)/, 'Backend character extraction must count all character mentions while capping saved evidence samples per character');
assert.match(tauriCharacterRelations, /pub\(super\) fn build_cooccurrence_relations[\s\S]*MAX_TYPED_RELATION_MENTIONS_PER_WINDOW[\s\S]*detect_typed_relation/, 'Backend character relation builder must own co-occurrence and typed relation detection');
assert.match(tauriCharacterRelations, /const DIRECT_RELATION_RULES:[\s\S]*protects[\s\S]*asks[\s\S]*commands[\s\S]*attacks/, 'Backend character relation builder must own direct relation rules');
assert.match(tauriCharacterRelations, /const POSSESSIVE_RELATION_RULES:[\s\S]*doctor[\s\S]*teacher[\s\S]*master[\s\S]*enemy/, 'Backend character relation builder must own possessive relation rules');
assert.match(tauriCharacterRelations, /pub\(super\) fn relation_counts_by_character/, 'Backend character relation builder must expose per-character relation counts');
assert.match(tauriCharacterIds, /pub\(super\) fn relation_evidence_index/, 'Backend character ids module must expose relation evidence sorting index');
assert.match(tauriCharacters, /const MAX_PAYLOAD_PROFILES: usize = \d[\d_]*;[\s\S]*const MAX_PAYLOAD_MENTIONS: usize = \d[\d_]*;[\s\S]*const MAX_PAYLOAD_EVIDENCE: usize = \d[\d_]*;/, 'Backend character payload loading must bound profiles, mentions, and evidence returned to the UI');
assert.match(tauriCharacters, /join\("relations\.json"\),\s*manifest\.relation_count,[\s\S]*"单个人物关系"/, 'Backend character payload loading must return every persisted relationship recorded by the manifest');
assert.doesNotMatch(tauriCharacters, /relations\.retain_mut\([\s\S]*!relation\.evidence_ids\.is_empty\(\)/, 'Backend character payload loading must not drop relationships merely because the bounded evidence payload omitted their evidence rows');
assert.match(tauriCharacterIo, /pub\(super\) fn read_limited_jsonl_file[\s\S]*BufReader::new\(file\)\.lines\(\)[\s\S]*if items\.len\(\) >= limit[\s\S]*break;/, 'Backend character payload loading must stream JSONL and stop after the UI-safe limit');
assert.match(tauriCharacterIo, /pub\(super\) fn read_limited_json_array_file[\s\S]*BufReader::new\(file\)[\s\S]*while items\.len\(\) < limit[\s\S]*read_json_object_bytes[\s\S]*serde_json::from_slice/, 'Backend character payload loading must stream profiles arrays and stop before reading oversized or corrupt tails');
assert.doesNotMatch(readLimitedJsonArrayFileSource, /fs::read_to_string[\s\S]*serde_json::from_str/, 'Backend character payload loading must not read the entire profiles.json before truncating');
assert.match(tauriCharacterStatus, /pub\(super\) fn character_index_files_complete[\s\S]*profiles\.json[\s\S]*mentions\.jsonl[\s\S]*evidence\.jsonl/, 'Backend character summaries must verify persisted character output files before reporting a ready index');
assert.match(tauriCharacters, /write_json_file\(&dir\.join\("profiles\.json"\), profiles\)\?;[\s\S]*write_jsonl_file\(&dir\.join\("mentions\.jsonl"\), mentions\)\?;[\s\S]*write_jsonl_file\(&dir\.join\("evidence\.jsonl"\), evidence\)\?;[\s\S]*write_json_file\(\s*&dir\.join\("relations\.json"\),[\s\S]*\)\?;[\s\S]*write_json_file\(&dir\.join\("events\.json"\),[\s\S]*\)\?;[\s\S]*write_json_file\(&dir\.join\("manifest\.json"\), manifest\)/, 'Backend character output must write profiles, mentions, evidence, relations, and events before publishing the ready manifest');
assert.doesNotMatch(tauriCharacters, /write_json_file\(&dir\.join\("manifest\.json"\), manifest\)\?;[\s\S]*write_json_file\(&dir\.join\("profiles\.json"\), profiles\)/, 'Backend character output must not publish manifest before profiles are persisted');
assert.doesNotMatch(tauriCharacters, /chunk:\s*TextChunkRecord/, 'Backend character extraction must not clone full text chunks into every candidate mention');
assert.match(tauriCharacterStatus, /effective_manifest_status = if manifest_status == "ready" && !character_stale_reason\.is_empty\(\)[\s\S]*"stale"/, 'Backend character summaries must derive stale status before returning Character Center book summaries');
assert.match(characterCenterState, /import \{ characterFailureAdviceKey \} from '\.\/characterFailureDiagnostics'/, 'Character Center state must map structured error codes to advice keys');
assert.match(characterCenterState, /errorAdviceKey: characterFailureAdviceKey\(issue\.errorCode \?\? ''\)/, 'Character failure diagnostics must include an advice key derived from the input error code');
assert.match(characterCenterState, /export function resolveCharacterCenterState\(/, 'Character Center must expose a pure state matrix for the selected book readiness state');
for (const stateId of [
  'no-book',
  'text-index-missing',
  'text-index-stale',
  'text-index-failed',
  'character-index-missing',
  'character-index-queued',
  'character-index-building',
  'character-index-failed',
  'character-index-stale',
  'character-index-ready',
]) {
assert.match(characterCenterState, new RegExp(`stateId: '${stateId}'`), `Character center state matrix must cover ${stateId}`);
}
assert.match(charactersPage, /const characterStateIssue = selectedBook \? \{[\s\S]*staleReason: selectedBook\.staleReason,[\s\S]*lastError: selectedBook\.lastError,[\s\S]*lastTaskId: selectedBook\.lastTaskId,[\s\S]*errorCode: selectedBook\.errorCode,[\s\S]*errorStage: selectedBook\.errorStage,[\s\S]*recentLogEntry: selectedBook\.recentLogEntry,[\s\S]*\} : \{\}/, 'CharactersPage must derive character-index stale and failure diagnostics from the sanitized character summary');
assert.match(charactersPage, /const centerState = resolveCharacterCenterState\(selectedBook, selectedIndexView, characterStatus, characterStateIssue\)/, 'CharactersPage must consume the state matrix with character-index issue details instead of deriving readiness inline');
assert.match(charactersPage, /characters-readiness-card \$\{centerState\.readinessClassName\}`\} role="status" aria-live="polite"[\s\S]*t\(centerState\.readinessTitleKey\)[\s\S]*t\(centerState\.readinessBodyKey, centerState\.readinessBodyParams\)[\s\S]*centerState\.readinessHintKey/, 'Readiness state must expose text title/body/hint and live status semantics, not only color');
assert.match(charactersPage, /centerState\.failureDiagnostics[\s\S]*characters\.failureDiagnosticsAria[\s\S]*characters\.failure\.taskId[\s\S]*characters\.failure\.errorCode[\s\S]*characters\.failure\.errorStage[\s\S]*characters\.failure\.recentLog/, 'Failed character-index state must render task id, error code, error stage, and recent log diagnostics when present');
assert.match(charactersPage, /import \{ redactTaskText \} from '\.\.\/features\/task-center\/taskPrivacy'/, 'Character failure diagnostics must reuse task privacy redaction');
assert.match(charactersPage, /const privacyMode = Boolean\(privacySettings\.applicationPrivacyMode\)[\s\S]*redactTaskText\(centerState\.failureDiagnostics\.recentLogEntry, privacyMode\)/, 'Character failure recent logs must be redacted in privacy mode');
assert.match(charactersPage, /characters\.failure\.advice[\s\S]*t\(centerState\.failureDiagnostics\.errorAdviceKey\)/, 'Character failure diagnostics must render advice from the state matrix error-code mapping');
assert.match(charactersPage, /function CharacterBookMenu[\s\S]*characters\.openReader[\s\S]*characters\.openTasks[\s\S]*characters\.rebuildTextIndex[\s\S]*characters\.rebuildCharacterIndex[\s\S]*characters\.aiProcess/, 'CharactersPage must keep book-specific status and maintenance actions inside the book menu instead of a persistent toolbar');
assert.doesNotMatch(charactersPage, /className="characters-book-summary"|className="characters-action-bar"/, 'CharactersPage must not reserve permanent workspace rows for current-book metadata and maintenance actions');
assert.match(charactersPage, /centerState\.showZeroCharacterMetrics/, 'CharactersPage must hide misleading zero character metrics when text index is not ready');
assert.match(characterCenterState, /primaryAction:\s*'character-extraction'/, 'Character center state matrix must expose the real character-extraction action when text index is ready');
assert.match(characterCenterBooks, /if \(task\.status === 'succeeded'\) return 'ready'/, 'A succeeded character extraction task must suppress missing-state auto requeue until the persisted payload refreshes into ready state');
assert.match(characterCenterState, /primaryAction:\s*'rebuild-character-index'/, 'Character center state matrix must expose a direct rebuild action when the persisted character index is stale');
assert.match(characterPageRenderers, /action === 'character-extraction' \|\| action === 'rebuild-character-index'[\s\S]*const labelKey = action === 'rebuild-character-index' \? 'characters\.rebuildCharacterIndex' : 'characters\.extractCharacters'[\s\S]*queueCharacterExtraction/, 'Character index rebuild UI must reuse the existing character-extraction task instead of inventing a backend task kind');
assert.match(typesSource, /'character-extraction'/, 'TaskKind must include character-extraction after the backend task is implemented');
assert.doesNotMatch(typesSource, /'rebuild-character-index'/, 'TaskKind must not include rebuild-character-index until the backend task is implemented');
assert.doesNotMatch(charactersPage, /profiles:\s*\[/, 'CharactersPage must not render static fake character profiles');

for (const typeName of [
  'CharacterCenterBookSummary',
  'CharacterProfile',
  'CharacterAlias',
  'CharacterMention',
  'CharacterRelation',
  'CharacterEvidence',
  'CharacterEvent',
  'CharacterFactionMembership',
  'CharacterAppearanceStat',
  'CharacterIndexManifest',
  'CharacterCenterPayload',
]) {
  assert.match(typesSource, new RegExp(`export type ${typeName} = \\{`), `types.ts must expose ${typeName} for the Character Center data contract`);
}
assert.match(typesSource, /export type CharacterLocation = ReaderNoteLocation & \{[\s\S]*chunkId\?: string;[\s\S]*readerLocation\?: ReaderNoteLocation;/, 'CharacterLocation must stay compatible with the reader note location contract and preserve chunk coordinates for evidence jump-back');
assert.match(typesSource, /export type CharacterMentionLocation = CharacterLocation & \{[\s\S]*bookId: string;[\s\S]*chapterId: string;[\s\S]*sourceChapterIndex: number;[\s\S]*paragraphIndex: number;[\s\S]*startOffset: number;[\s\S]*endOffset: number;[\s\S]*\};/, 'CharacterMentionLocation must require precise reader coordinates for every mention');
assert.match(typesSource, /export type CharacterEvidenceLocation = CharacterLocation & \{[\s\S]*chunkId: string;[\s\S]*\};/, 'CharacterEvidenceLocation must require a chunk id for every evidence record');
assert.match(typesSource, /export type CharacterMention = \{[\s\S]*bookId: string;[\s\S]*location: CharacterMentionLocation;[\s\S]*quote: string;/, 'CharacterMention must use the precise mention location contract');
assert.match(typesSource, /export type CharacterEvidence = \{[\s\S]*targetType: 'profile' \| 'alias' \| 'mention' \| 'relation' \| 'event' \| 'faction';[\s\S]*quote: string;[\s\S]*location: CharacterEvidenceLocation;[\s\S]*evidenceHash: string;[\s\S]*status: 'valid' \| 'stale' \| 'broken' \| 'pending-review';/, 'CharacterEvidence must bind claims to quote, reader-compatible chunk location, hash, and validation status');
assert.match(typesSource, /export type CharacterIndexManifest = \{[\s\S]*schemaVersion: string;[\s\S]*contentHash: string;[\s\S]*textIndexContentHash: string;[\s\S]*status: CharacterIndexStatus;[\s\S]*sourceTextIndex: \{[\s\S]*chunkCount: number;[\s\S]*ftsRowCount: number;/, 'CharacterIndexManifest must track schema, text-index dependency, counts, and stale detection inputs');
assert.match(typesSource, /export type CharacterCenterPayload = \{[\s\S]*book: CharacterCenterBookSummary;[\s\S]*manifest: CharacterIndexManifest \| null;[\s\S]*profiles: CharacterProfile\[\];[\s\S]*mentions: CharacterMention\[\];[\s\S]*relations: CharacterRelation\[\];[\s\S]*evidence: CharacterEvidence\[\];/, 'CharacterCenterPayload must aggregate the first-class Character Center collections without inventing UI-only mock data');
assert.match(typesSource, /export type CharacterCenterBookSummary = \{[\s\S]*textIndexStatus: BookIndexManifest\['status'\];[\s\S]*textIndexReady: boolean;[\s\S]*textIndexChunkCount: number;[\s\S]*textIndexFtsRows: number;/, 'CharacterCenterBookSummary must distinguish raw manifest status from effective searchable text-index readiness');
assert.match(typesSource, /export type CharacterCenterBookSummary = \{[\s\S]*lastError: string;[\s\S]*lastTaskId: string;[\s\S]*errorCode: string;[\s\S]*errorStage: string;[\s\S]*recentLogEntry: string;/, 'CharacterCenterBookSummary must carry character failure diagnostics without full task payloads');
assert.doesNotMatch(typesSource, /export type CharacterCenterBookSummary = \{[\s\S]*content:/, 'CharacterCenterBookSummary must not carry full book content into the Character Center UI');
assert.match(characterCenterBooks, /export function buildCharacterCenterBookSummary\([\s\S]*CharacterCenterBookSummary[\s\S]*characterCount: 0,[\s\S]*relationCount: 0,[\s\S]*evidenceCount: 0,/, 'Character Center book summaries must expose honest zero character counts until a real character manifest exists');
assert.match(characterCenterBooks, /const characterTaskErrorMessage = characterTask \? characterTask\.errorMessage \|\| characterTask\.error\.message : ''[\s\S]*const characterTaskErrorCode = characterTask \? characterTask\.errorCode \|\| characterTask\.error\.code : ''[\s\S]*const characterTaskErrorStage = characterTask \? characterTask\.error\.stage \|\| characterTask\.stage : ''[\s\S]*lastTaskId: characterTask\?\.id \?\? '',[\s\S]*errorCode: characterTaskFailed \? characterTaskErrorCode : '',[\s\S]*errorStage: characterTaskFailed \? characterTaskErrorStage : '',[\s\S]*recentLogEntry: characterTask\?\.message \?\? '',/, 'Character Center book summaries must expose real task diagnostics when a character task exists and empty diagnostics otherwise');
assert.doesNotMatch(characterCenterBooks, /content:\s*book\.content/, 'Character Center book summaries must not copy full book content');
assert.match(characterCenterBooks, /const textIndexReady = textIndexStatus === 'ready' && textIndexChunkCount > 0 && \(!diagnosticsLoaded \|\| ftsRows > 0\)/, 'Character Center summaries must treat ready manifests without FTS rows as not searchable');
assert.match(characterProfileDetail, /export function buildCharacterProfileDetail\([\s\S]*payload: CharacterCenterPayload \| null,[\s\S]*characterId: string,[\s\S]*CharacterProfileDetail \| null/, 'Character Center must expose a pure character detail normalization helper');
assert.match(characterProfileDetail, /profileById\.get\(characterId\)/, 'Character detail normalization must be driven by real payload profiles');
assert.match(characterProfileDetail, /payload\.mentions[\s\S]*payload\.relations[\s\S]*payload\.events[\s\S]*payload\.evidence/, 'Character detail normalization must aggregate mentions, relations, events, and evidence from the payload');
assert.match(characterProfileDetail, /meta: \{[\s\S]*importancePercent[\s\S]*confidencePercent[\s\S]*sourceLabelKey[\s\S]*sourceStateLabelKey[\s\S]*tags/, 'Character detail normalization must expose display-ready metadata for importance, source, and tags');
assert.match(characterPageRenderers, /characters\.detailImportance[\s\S]*detail\.meta\.importancePercent[\s\S]*characters\.detailSource[\s\S]*detail\.meta\.sourceLabelKey/, 'Character detail must show importance and extraction source metadata from the detail model');
assert.match(characterPageRenderers, /sourceStateLabel = t\(detail\.meta\.sourceStateLabelKey\)[\s\S]*sourceStateLabel/, 'Character detail must show machine/manual/imported source state from the detail model');
assert.match(characterPageRenderers, /characters\.detailTags[\s\S]*detail\.meta\.tags[\s\S]*getPrivacyBookTitle\(tag, privacySettings\)/, 'Character detail must show privacy-safe identity/title/tag metadata from the detail model');
assert.match(characterOverviewMetrics, /export function buildCharacterOverviewMetrics\([\s\S]*profiles[\s\S]*manifest[\s\S]*sourceTextIndex[\s\S]*indexVersion[\s\S]*extractionMode/, 'Character overview metrics must summarize real profiles and character manifest metadata');
assert.match(characterOverviewMetrics, /main-characters[\s\S]*coverage[\s\S]*last-built[\s\S]*algorithm[\s\S]*text-index/, 'Character overview metrics must expose main character count, coverage, last build, algorithm, and text-index cards');
assert.match(characterOverviewSummary, /export function buildCharacterOverviewSummary\([\s\S]*CharacterCenterPayload \| null[\s\S]*buildCharacterReviewQueue[\s\S]*buildChapterCoverage[\s\S]*buildMainProfiles[\s\S]*buildRecentAppearances/, 'Character overview summary must be a pure model that composes review queue, chapter coverage, main profiles, and recent appearances');
assert.match(characterOverviewSummary, /stats:[\s\S]*characters[\s\S]*relations[\s\S]*evidence[\s\S]*chapter-coverage[\s\S]*review/, 'Character overview summary stats must include character, relation, evidence, chapter coverage, and review counts');
assert.match(characterGraphModel, /import type \{[^}]*CharacterEntityKind[^}]*CharacterProfile[^}]*CharacterRelation[^}]*\} from '\.\.\/\.\.\/types'/, 'Character graph model must use the real CharacterProfile, CharacterRelation, and kind contracts');
assert.match(characterGraphModel, /export function buildCharacterGraphModel\([\s\S]*profiles: CharacterProfile\[\],[\s\S]*relations: CharacterRelation\[\]/, 'Character graph model must expose a pure buildCharacterGraphModel selector over profiles and relations');
assert.match(characterGraphModel, /const profileById = new Map\(profiles\.map\(\(profile\) => \[profile\.id, profile\]\)\)/, 'Character graph model must resolve relation endpoints from real profiles');
assert.match(characterGraphModel, /export function resolveCharacterGraphPanelState\([\s\S]*CharacterGraphPanelBuildOptions/, 'Character graph model must expose a pure relationship graph panel state selector');
for (const graphPanelReason of ['character-index-loading', 'character-index-error', 'no-relationships', 'filtered-empty', 'focus-empty', 'aggregated-empty']) {
  assert.match(characterGraphModel, new RegExp(graphPanelReason), `Character graph panel state selector must expose ${graphPanelReason}`);
}
assert.match(characterGraphModel, /includeHiddenProfiles[\s\S]*profile\.hidden/, 'Character graph model must explicitly handle hidden profiles');
assert.match(characterGraphModel, /relationTypes[\s\S]*minConfidence[\s\S]*filteredRelationCount/, 'Character graph model must support relation type and minimum confidence filtering with filtered count diagnostics');
assert.match(characterGraphModel, /export type CharacterGraphChapterRange[\s\S]*startChapterIndex[\s\S]*endChapterIndex[\s\S]*relationIntersectsChapterRange/, 'Character graph model must support chapter range filtering before edge merging');
assert.match(characterGraphModel, /sourceCharacterId[\s\S]*targetCharacterId[\s\S]*relationType/, 'Character graph model must aggregate real relation endpoints and relation types');
assert.match(characterGraphModel, /hiddenRelationCount/, 'Character graph model must report relations hidden by missing or filtered profiles');
assert.match(characterGraphModel, /Math\.max\(edge\.confidence, relation\.confidence\)/, 'Character graph model must merge duplicate edge confidence by taking the strongest evidence confidence');
assert.match(characterGraphModel, /visual: CharacterGraphNodeVisual/, 'Character graph model nodes must expose stable visual metadata for typed graph rendering');
assert.match(characterGraphModel, /export function getCharacterGraphNodeVisual\(kind: CharacterEntityKind\)[\s\S]*kind === 'person'[\s\S]*kind === 'organization'[\s\S]*kind === 'faction'[\s\S]*kind === 'place'[\s\S]*kind === 'artifact'[\s\S]*group: 'unknown'/, 'Character graph model must map person, organization, faction, place, artifact, and unknown kinds into stable visual groups');
assert.doesNotMatch(characterGraphModel, /window\.|document\.|from 'react'|from "react"|React\.|useState|useMemo|\.tsx|const profiles = \[|const relations = \[/, 'Character graph model must remain a pure data selector without UI or mock profile data');
assert.doesNotMatch(characterGraphModel, /character-extraction|rebuild-character-index/, 'Character graph model must not invent backend task kinds');
assert.match(characterGraphCanvasModel, /export function buildCharacterGraphCanvasModel\([\s\S]*width[\s\S]*height[\s\S]*viewBox[\s\S]*nodes[\s\S]*edges[\s\S]*hiddenNodeCount[\s\S]*hiddenEdgeCount/, 'Character graph canvas model must expose fixed dimensions, viewBox, positioned nodes, visible edges, and hidden counts');
assert.doesNotMatch(characterGraphCanvasModel, /const graphCanvasMinScale = 0\.6|const graphCanvasMaxScale = 2\.4|const graphCanvasMaxOffset = 360/, 'Character graph canvas model must not use legacy small-view clamp constants');
assert.match(characterGraphCanvasModel, /searchQuery\?: string[\s\S]*neighborDepth\?: 1 \| 2 \| 'all'[\s\S]*edgeMode\?: 'skeleton' \| 'semantic' \| 'all'[\s\S]*buildReadableStarMapGraph[\s\S]*expandReadableStarMapNeighbors[\s\S]*selectLargestStarMapComponent[\s\S]*buildReadableStarMapEdges[\s\S]*isWeakCoOccurrenceEdge/, 'Character graph canvas model must own the preview-style search, neighbor expansion, readable star map selection, and edge modes in a pure model layer');
assert.match(characterGraphCanvasModel, /function buildNodeRadius\([\s\S]*Math\.sqrt[\s\S]*node\.mentionCount/, 'Character graph canvas model must size nodes from character mention count like the standalone preview');
assert.match(characterGraphCanvasModel, /algorithm: 'starfield-force-v2'[\s\S]*communityId[\s\S]*labelTier[\s\S]*showLabelAtScale[\s\S]*controlX[\s\S]*controlY[\s\S]*alpha/, 'Character graph canvas model must expose the optimized starfield layout, community, label tier, curved edge, and alpha metadata');
assert.match(characterGraphCanvasModel, /buildStarfieldLayout[\s\S]*seedStarfieldRings[\s\S]*runStarfieldForceLayout[\s\S]*resolveStarfieldCollisions[\s\S]*buildLabelTier/, 'Character graph canvas model must use the preview starfield ring seed, force relaxation, collision handling, and label tiering');
assert.doesNotMatch(characterGraphCanvasModel, /graphCanvasGoldenAngle|radiusX[\s\S]*radiusY[\s\S]*radialProgress/, 'Character graph canvas layout must not use the old fixed ellipse golden-angle placement');
assert.match(characterGraphLayoutWorker, /import \{ buildCharacterGraphCanvasModel[\s\S]*\} from '\.\/characterGraphCanvasModel'/, 'Character graph layout worker must reuse the pure graph canvas layout builder');
assert.match(characterGraphLayoutWorker, /self\.onmessage[\s\S]*buildCharacterGraphCanvasModel[\s\S]*postMessage/, 'Character graph layout worker must accept graph messages and post async canvas layouts');
assert.match(characterGraphCanvasModel, /export type CharacterGraphCanvasViewport[\s\S]*scale[\s\S]*offsetX[\s\S]*offsetY[\s\S]*transform[\s\S]*export function applyCharacterGraphCanvasViewportAction/, 'Character graph canvas model must expose a pure viewport reducer for zoom, pan, and reset');
assert.match(characterGraphCanvasModel, /const defaultGraphCanvasWidth = 960[\s\S]*const defaultGraphCanvasHeight = 360[\s\S]*truncateGraphCanvasLabel/, 'Character graph canvas model must keep stable minimum dimensions and truncate long labels before rendering');
assert.doesNotMatch(characterGraphCanvasModel, /window\.|document\.|navigator\.|from 'react'|from "react"|React\.|useState|useMemo|\.tsx/, 'Character graph canvas model must remain pure and UI-independent');
assert.match(characterGraphEdgeDetail, /export function buildCharacterGraphEdgeDetail\([\s\S]*CharacterCenterPayload \| null[\s\S]*CharacterGraphEdge \| null[\s\S]*sourceProfile[\s\S]*targetProfile[\s\S]*relations[\s\S]*evidence[\s\S]*summary/, 'Character graph edge detail selector must resolve endpoints, relation records, evidence, and summary');
assert.match(characterGraphEdgeDetail, /evidenceIds\.has\(item\.id\)[\s\S]*relationIds\.has\(item\.targetId\)[\s\S]*item\.targetId === edge\.id/, 'Character graph edge detail selector must include direct evidence ids, relation-targeted evidence, and edge-targeted fallback evidence');
assert.doesNotMatch(characterGraphEdgeDetail, /window\.|document\.|navigator\.|from 'react'|from "react"|React\.|useState|useMemo|\.tsx/, 'Character graph edge detail selector must remain pure and UI-independent');
assert.match(characterListModel, /import type \{[^}]*CharacterEntityKind[^}]*CharacterProfile[^}]*CharacterRole[^}]*\} from '\.\.\/\.\.\/types'/, 'Character list model must use the real CharacterProfile, kind, and role contracts');
assert.match(characterListModel, /export function buildCharacterListModel\([\s\S]*profiles: CharacterProfile\[\]/, 'Character list model must expose a pure buildCharacterListModel selector over profiles');
assert.match(characterListModel, /query[\s\S]*kinds[\s\S]*roles[\s\S]*sources[\s\S]*minConfidence[\s\S]*maxConfidence[\s\S]*minMentionCount[\s\S]*hasRelations[\s\S]*hasEvents[\s\S]*includeHidden[\s\S]*sortBy[\s\S]*sortDirection/, 'Character list model must support query, filters, hidden policy, and sorting options');
assert.match(characterListModel, /avatarInitials[\s\S]*getCharacterAvatarInitials\(profile\.displayName \|\| profile\.canonicalName\)/, 'Character list model must provide stable avatar initials for profile rows');
assert.match(characterListModel, /profile\.aliases[\s\S]*profile\.summary[\s\S]*profile\.tags/, 'Character list search must include aliases, summaries, and tags from real profiles');
assert.match(characterListModel, /profiles\.filter\(\(profile\) => !profile\.hidden\)/, 'Character list model must hide hidden profiles by default');
assert.match(characterListModel, /mention-count[\s\S]*relation-count[\s\S]*confidence[\s\S]*first-appearance[\s\S]*last-appearance[\s\S]*importance/, 'Character list model must cover core sortable metrics');
assert.match(characterListViewport, /export function buildCharacterListViewport\([\s\S]*totalCount[\s\S]*rowHeight[\s\S]*viewportHeight[\s\S]*scrollTop[\s\S]*overscan[\s\S]*totalHeight/, 'Character list viewport helper must compute stable virtual-list ranges and total spacer height');
assert.match(characterListViewport, /export function getCharacterListViewportRowTop\([\s\S]*index[\s\S]*viewport\.rowStride/, 'Character list viewport helper must expose stable row positioning');
assert.match(characterEvidenceNavigation, /export function buildCharacterLocationReaderOpenDetail\([\s\S]*CharacterLocation[\s\S]*buildCharacterReaderLocation[\s\S]*SearchResult/, 'Character evidence navigation must support opening profile appearance locations, not only evidence records');
assert.doesNotMatch(characterListModel, /window\.|document\.|from 'react'|from "react"|React\.|useState|useMemo|\.tsx|const profiles = \[/, 'Character list model must remain a pure data selector without UI or mock profile data');
assert.doesNotMatch(characterListModel, /character-extraction|rebuild-character-index/, 'Character list model must not invent backend task kinds');
assert.match(characterFailureDiagnostics, /structuredCharacterErrorCodePattern = \/\^character_\[a-z0-9\]\+\(\?:_\[a-z0-9\]\+\)\*\$\//, 'Character failure diagnostics must require character_* snake_case error codes');
assert.match(characterFailureDiagnostics, /character_index_missing_text_index[\s\S]*character_ai_parse_failed[\s\S]*character_write_failed/, 'Character failure diagnostics must include core structured error codes');
for (const adviceFallback of [
  'characters.failureAdvice.generic',
  'characters.failureAdvice.unstructured',
  'characters.failureAdvice.none',
]) {
  assert.match(characterFailureDiagnostics, new RegExp(adviceFallback.replaceAll('.', '\\.')), `Character failure diagnostics must provide ${adviceFallback}`);
}
assert.doesNotMatch(characterFailureDiagnostics, /character-extraction|rebuild-character-index|TaskKind/, 'Character failure diagnostics must not invent backend task kinds');

assert.match(appSource, /const openCharacters = \(bookId\?: string\)/, 'App must provide a character-center opener that can select a book');
assert.match(appSource, /const \[characterBookId, setCharacterBookId\] = useState<string \| null>\(null\)/, 'App must keep Character Center book selection separate from the reader selection');
assert.match(appSource, /const selectedCharacterPayload = useMemo\(\(\) => \{[\s\S]*characterPayload\?\.book\.id === characterBookId[\s\S]*\}, \[characterBookId, characterPayload\]\)/, 'App must ignore stale Character Center payloads that do not match the selected book');
assert.match(appSource, /const selectedCharacterOverviewSnapshot = useMemo\(\(\) => \{[\s\S]*characterOverviewSnapshot\?\.bookId === characterBookId[\s\S]*\}, \[characterBookId, characterOverviewSnapshot\]\)/, 'App must ignore stale Character Center overview snapshots that do not match the selected book');
assert.match(appSource, /const \[taskSnapshot, setTaskSnapshot\] = useState<TaskStatus\[\]>\(\[\]\)/, 'App must keep a task snapshot so Character Center can reflect queued and running character tasks');
assert.match(appSource, /function setLatestTaskSnapshot\(tasks: TaskStatus\[\]\)[\s\S]*backgroundTaskPreviousSnapshotRef\.current = tasks[\s\S]*setTaskSnapshot\(tasks\)/, 'App must synchronize task progress events into both the background task ref and the Character Center task snapshot');
assert.match(appSource, /const summaries = buildCharacterCenterBookSummaries\(books, indexDiagnostics, taskSnapshot\)[\s\S]*characterBookSummariesFromBackend[\s\S]*liveCharacterTaskOverlay[\s\S]*selectedCharacterPayload\.book/, 'App must merge backend persisted Character Center summaries, selected payload stats, and live task state');
assert.match(appSource, /const activeCharacterExtractionBookId = useMemo\(\(\) => \{[\s\S]*resolveActiveCharacterExtractionBookId\(characterExtractionBookId, characterBookId, taskSnapshot\)/, 'App must derive the active Character Center extraction book from live task snapshot state');
assert.match(appShellModel, /export function resolveActiveCharacterExtractionBookId\([\s\S]*task\.kind === 'character-extraction'[\s\S]*status === 'queued' \|\| status === 'running' \|\| status === 'paused' \|\| status === 'cancelling'/, 'The app shell model must define the live character extraction task lifecycle');
assert.match(appSource, /const characterBookSummary = useMemo\([\s\S]*characterBookSummaries\.find\(\(item\) => item\.id === characterBookId\)[\s\S]*\[characterBookId, characterBookSummaries\]/, 'App must select the current Character Center book from sanitized summaries');
assert.match(useCharacterCenter, /if \(activePage === 'characters'\) void refreshCharacterBookSummaries\(\);/, 'Opening Character Center must refresh persisted summaries without starting heavy extraction work');
assert.doesNotMatch(appSource, /if \(activePage === 'characters'\)[\s\S]{0,240}runCharacterExtraction\(/, 'Opening Character Center must not queue character extraction from the page activation effect');
assert.doesNotMatch(appSource, /refreshCharacterPayload\(characterBookId\)/, 'Opening or selecting a Character Center book must not automatically load the full character payload because large payload deserialization freezes the UI');
assert.match(appSource, /onRequestCharacterPayload=\{\(bookId\) => void refreshCharacterPayload\(bookId\)\}/, 'App must let CharactersPage lazily request full character payloads only when a selected workbench view needs them');
assert.match(appSource, /onRequestCharacterOverviewSnapshot=\{\(bookId\) => void refreshCharacterOverviewSnapshot\(bookId\)\}/, 'App must let CharactersPage lazily request the small overview snapshot for the overview workbench');
assert.match(appSource, /overviewSnapshot=\{selectedCharacterOverviewSnapshot\}[\s\S]*overviewSnapshotLoading=\{characterOverviewSnapshotLoadingBookId === characterBookId\}/, 'App must pass only the selected book overview snapshot and loading state into CharactersPage');
assert.match(characterCenterSession, /export function buildCharacterBookCacheSignature/, 'Character Center session cache must key payload reuse by a book summary signature');
assert.match(characterCenterSession, /export function rememberCharacterPayload[\s\S]*trimCharacterCache/, 'Character Center session cache must store full payloads with an LRU limit');
assert.match(characterCenterSession, /export function rememberCharacterOverviewSnapshot[\s\S]*trimCharacterCache/, 'Character Center session cache must store overview snapshots separately from full payloads');
assert.match(useCharacterCenter, /characterPayloadCacheRef = useRef\(new Map/, 'Character Center domain hook must own the full payload session cache');
assert.match(useCharacterCenter, /getCachedCharacterPayload[\s\S]*rememberCharacterPayload/, 'Character Center domain hook must reuse cached payloads when the book signature has not changed');
assert.doesNotMatch(useCharacterCenter, /activePage !== 'characters'[\s\S]*setCharacterPayload\(null\)/, 'Leaving Character Center must not clear the full payload cache because returning to the same unchanged relation page should be instant');
assert.match(characterRelationGraphView, /readCharacterGraphCanvasSessionCache[\s\S]*rememberCharacterGraphCanvasSessionCache/, 'Relationship graph view must reuse cached canvas layout when graph inputs have not changed');
assert.match(characterRelationGraphView, /readCharacterGraphModelSessionCache[\s\S]*rememberCharacterGraphModelSessionCache/, 'Relationship graph view must reuse cached graph models when filters and payload signatures have not changed');
assert.match(characterRelationGraphView, /readCharacterGraphRenderModelSessionCache[\s\S]*rememberCharacterGraphRenderModelSessionCache/, 'Relationship graph view must reuse retained WebGL render models instead of rebuilding buffers on page return');
assert.doesNotMatch(`${appSource}\n${useCharacterCenter}`, /autoQueuedCharacterBookIdsRef|activePage !== 'characters'[\s\S]*runCharacterExtraction\(characterBookSummary\.id\)/, 'Opening Character Center must not automatically run character extraction because long books can freeze the UI and exhaust memory');
assert.match(appSource, /const selectedReaderBookId = useMemo\(\(\) => \{[\s\S]*if \(!selectedBookId\) return null;[\s\S]*books\.some\(\(item\) => item\.id === selectedBookId && !item\.deleted\) \? selectedBookId : null;[\s\S]*\}, \[books, selectedBookId\]\)/, 'App must derive the current reader book id without falling back to the first shelf book');
assert.match(appSource, /const characterBookUnavailableReason = useMemo\(\(\) => \{[\s\S]*if \(!characterBookId\) return 'none';[\s\S]*if \(!selected\) return 'missing';[\s\S]*return selected\.deleted \? 'deleted' : 'none';[\s\S]*\}, \[books, characterBookId\]\)/, 'App must distinguish missing requested books from trash books for Character Center');
assert.match(appSource, /const characterBook = useMemo\(\(\) => \{[\s\S]*characterBookId[\s\S]*\}, \[books, characterBookId\]\)/, 'App must derive a nullable Character Center book from the explicit characterBookId');
assert.match(appSource, /const navigatePage = \(page: AppPage\) => \{[\s\S]*setActivePage\(page\);[\s\S]*\};/, 'Global navigation to Character Center must open the summary workbench without auto-selecting a book or loading full character payload');
assert.doesNotMatch(appSource, /if \(page === 'characters'\) setCharacterBookId/, 'Global navigation to Character Center must not auto-select the current, recent, or first shelf book');
assert.match(appSource, /const openCharacters = \(bookId\?: string\)[\s\S]*setCharacterBookId\(bookId \?\? null\)[\s\S]*setActivePage\('characters'\)/, 'Explicit book-level Character Center entry points may select that requested book');
assert.match(appSource, /<CharactersPage[\s\S]*bookSummaries=\{characterBookSummaries\}[\s\S]*currentBook=\{characterBookSummary\}[\s\S]*unavailableBookReason=\{characterBookUnavailableReason\}[\s\S]*indexDiagnostics=\{indexDiagnostics\}[\s\S]*characterExtractionBookId=\{activeCharacterExtractionBookId\}/, 'App must pass sanitized Character Center summaries, unavailable reason, index state, and live extraction task state into CharactersPage');
assert.match(appSource, /onOpenReaderEvidence=\{\(detail\) => openReaderFromSearch\(detail\.result\)\}/, 'App must route character evidence jumps through the existing reader search-result opening path');
assert.doesNotMatch(appSource, /<CharactersPage books=\{books\}/, 'App must not pass full shelf books into Character Center');
assert.match(appSource, /const runCharacterTextIndex = async \(bookId: string\)[\s\S]*onRunParseIndex=\{runCharacterTextIndex\}/, 'App must provide the character page with a text-index action');
assert.match(appSource, /<LibraryPage[\s\S]*onOpenCharacters=\{openCharacters\}/, 'LibraryPage must receive the character-center opener');
assert.match(appSource, /<ReaderWorkspace[\s\S]*onOpenCharacters=\{openCharacters\}/, 'App must pass the Character Center opener into the reader workspace');

assert.match(libraryPage, /onOpenCharacters: \(bookId: string\) => void;/, 'LibraryPage props must include onOpenCharacters');
assert.match(libraryPage, /function openSelectedCharacters\(\)/, 'LibraryPage must handle opening the selected book in Character Center');
assert.match(libraryBookMenus, /library\.menu\.characters/, 'Library book action menu must expose Character Center');
assert.match(libraryBookMenus, /library\.context\.characters/, 'Library context menu must expose Character Center');
assert.match(libraryBookViews, /library\.detail\.characters/, 'Library detail panel must expose Character Center');

assert.match(readerWorkspace, /onOpenCharacters\?: \(bookId: string\) => void;/, 'ReaderWorkspace props must accept a current-book Character Center opener');
assert.match(readerPagePropsBuilder, /onOpenCharacters: ReaderPageProps\['onOpenCharacters'\][\s\S]*onOpenCharacters,/, 'ReaderWorkspace must pass the Character Center opener down to ReaderPage');
assert.match(readerPage, /onOpenCharacters\?: \(bookId: string\) => void;/, 'ReaderPage props must accept a current-book Character Center opener');
assert.match(readerToolbar, /reader\.characters\.open/, 'Reader toolbar must use the current-book Character Center label');
assert.match(readerToolbar, /onOpenCharacters\(book\.id\)/, 'Reader toolbar must open Character Center for the current book id');
assert.match(readerToolbar, /<ReaderToolbarIcon name="characters" \/>/, 'Reader toolbar must use the Character Center icon');

for (const key of [
  'characters.bookPicker',
  'characters.center.title',
  'characters.unavailable.missingTitle',
  'characters.unavailable.missingBody',
  'characters.unavailable.deletedTitle',
  'characters.unavailable.deletedBody',
  'characters.emptyLibraryTitle',
  'characters.emptyLibraryBody',
  'characters.bookSearchPlaceholder',
  'characters.bookStatusFilter',
  'characters.bookStatusFilter.all',
  'characters.bookStatusFilter.ready',
  'characters.bookStatusFilter.missing',
  'characters.bookStatusFilter.stale',
  'characters.bookStatusFilter.failed',
  'characters.bookStatusFilter.characterFailed',
  'characters.bookNoMatchesTitle',
  'characters.textIndex.ready',
  'characters.readiness.textIndexMissingBody',
  'characters.readiness.textIndexStaleBody',
  'characters.readiness.textIndexStaleBodyWithReason',
  'characters.characterIndex.missing',
  'characters.action.startCharacterExtraction',
  'characters.readiness.characterMissingBody',
  'characters.readiness.characterMissingHint',
  'characters.readiness.characterMissingRepairTitle',
  'characters.readiness.characterMissingRepairBodyWithReason',
  'characters.readiness.characterQueuedBody',
  'characters.readiness.characterBuildingBody',
  'characters.readiness.characterFailedBodyWithError',
  'characters.failureDiagnosticsAria',
  'characters.failure.taskId',
  'characters.failure.errorCode',
  'characters.failure.errorStage',
  'characters.failure.recentLog',
  'characters.failure.advice',
  'characters.failureAdvice.character_index_missing_text_index',
  'characters.failureAdvice.character_ai_parse_failed',
  'characters.failureAdvice.character_write_failed',
  'characters.failureAdvice.generic',
  'characters.failureAdvice.unstructured',
  'characters.failureAdvice.none',
  'characters.readiness.characterStaleBodyWithReason',
  'characters.readiness.readyBody',
  'characters.openLibraryAria',
  'characters.selectBookAria',
  'characters.openTasksAria',
  'characters.openReaderAria',
  'characters.runTextIndexAria',
  'characters.rebuildTextIndexAria',
  'characters.indexingAria',
  'characters.extractCharacters',
  'characters.rebuildCharacterIndex',
  'characters.confirmRebuildCharacterIndex',
  'characters.extracting',
  'characters.extractCharactersAria',
  'characters.rebuildCharacterIndexAria',
  'characters.extractingAria',
  'characters.profileListAria',
  'characters.profileListEyebrow',
  'characters.profileListTitle',
  'characters.profileListEvidence',
  'characters.profileListEmpty',
  'characters.profileListVirtualAria',
  'characters.profileSearch',
  'characters.profileSearchPlaceholder',
  'characters.profileSort',
  'characters.profileKindFilter',
  'characters.profileRoleFilter',
  'characters.profileConfidenceFilter',
  'characters.profileSourceFilter',
  'characters.profileFilterAll',
  'characters.profileSort.importance',
  'characters.profileSort.name',
  'characters.profileSort.mention-count',
  'characters.profileSort.relation-count',
  'characters.profileSort.confidence',
  'characters.profileSort.first-appearance',
  'characters.profileSort.last-appearance',
  'characters.profileKind.person',
  'characters.profileKind.organization',
  'characters.profileKind.faction',
  'characters.profileKind.place',
  'characters.profileKind.artifact',
  'characters.profileKind.unknown',
  'characters.profileRole.protagonist',
  'characters.profileRole.main',
  'characters.profileRole.supporting',
  'characters.profileRole.minor',
  'characters.profileRole.antagonist',
  'characters.profileConfidence.low',
  'characters.profileConfidence.high',
  'characters.profileSource.manual',
  'characters.profileSource.ai',
  'characters.profileSource.rule',
  'characters.profileSource.imported',
  'characters.profileMentionCount',
  'characters.profileRelationCount',
  'characters.mobileViewTabsAria',
  'characters.mobileView.overview',
  'characters.mobileView.profiles',
  'characters.mobileView.relations',
  'characters.mobileView.heatmap',
  'characters.mobileView.timeline',
  'characters.mobileView.factions',
  'characters.mobileView.evidence',
  'characters.mobileView.review',
  'characters.mobileView.export',
  'characters.mobileView.detail',
  'characters.viewNavigationAria',
  'characters.inspectorAria',
  'characters.inspectorCollapse',
  'characters.inspectorExpand',
  'characters.inspectorResizeAria',
  'characters.overviewWorkbenchAria',
  'characters.overviewWorkbenchEyebrow',
  'characters.overviewWorkbenchTitle',
  'characters.overviewWorkbenchBody',
  'characters.overviewMainProfiles',
  'characters.overviewRecentEvents',
  'characters.overviewStateSummary',
  'characters.timelineViewEyebrow',
  'characters.timelineViewTitle',
  'characters.timelineViewBody',
  'characters.factionsViewEyebrow',
  'characters.factionsViewTitle',
  'characters.factionsViewBody',
  'characters.reviewViewEyebrow',
  'characters.reviewViewTitle',
  'characters.reviewViewBody',
  'characters.exportViewEyebrow',
  'characters.exportViewTitle',
  'characters.exportViewBody',
  'characters.inspectorSummaryAria',
  'characters.inspectorSummaryEyebrow',
  'characters.inspectorSummaryData',
  'characters.inspectorSummaryReady',
  'characters.inspectorSummaryMissing',
  'characters.detailImportance',
  'characters.detailSource',
  'characters.detailGeneratedByMachine',
  'characters.detailEditedByHuman',
  'characters.detailImportedData',
  'characters.detailTags',
  'characters.detailJumpEvidence',
  'characters.detailJumpEvidenceAria',
  'characters.detailJumpEvidenceUnavailable',
  'characters.detailJumpLocation',
  'characters.detailJumpLocationAria',
  'characters.detailRelations',
  'characters.detailEvents',
  'characters.detailRelationsTitle',
  'characters.detailEventsTitle',
  'characters.detailFactionsTitle',
  'characters.detailConfidence',
  'characters.detailEvidenceCount',
  'characters.detailRelationOutgoing',
  'characters.detailRelationIncoming',
  'characters.detailRelationUndirected',
  'characters.detailRelationDirectedShort',
  'characters.detailRelationUndirectedShort',
  'characters.detailUnknownRelation',
  'characters.detailUntitledEvent',
  'characters.detailFactionJoined',
  'characters.detailFactionLeft',
  'characters.graphTableEyebrow',
  'characters.graphTableTitle',
  'characters.graphTableSummary',
  'characters.graphTableEmpty',
  'characters.graphTableSource',
  'characters.graphTableTarget',
  'characters.graphTableRelation',
  'characters.graphTableEvidence',
  'characters.graphTableOpenCharacter',
  'characters.graphTableOpenCharacterWithKind',
  'characters.graphTableOpenRelation',
  'characters.graphTableJumpEvidence',
  'characters.graphTableNoEvidence',
  'characters.graphTableFocusFilter',
  'characters.graphTableFocusAll',
  'characters.graphTableFocusOneHop',
  'characters.graphTableFocusTwoHop',
  'characters.graphTableFocusNeedCharacter',
  'characters.graphViewModeFilter',
  'characters.graphViewModeFull',
  'characters.graphViewModeCommunity',
  'characters.graphViewModeCore',
  'characters.graphViewModeNeighborhood',
  'characters.graphSearch',
  'characters.graphSearchPlaceholder',
  'characters.graphNeighborDepthFilter',
  'characters.graphNeighborDepthOne',
  'characters.graphNeighborDepthTwo',
  'characters.graphNeighborDepthAll',
  'characters.graphEdgeModeFilter',
  'characters.graphEdgeModeSkeleton',
  'characters.graphEdgeModeSemantic',
  'characters.graphEdgeModeAll',
  'characters.graphTableRelationTypeFilter',
  'characters.graphTableMinConfidenceFilter',
  'characters.graphTableMinConfidenceAll',
  'characters.graphTableMinConfidence50',
  'characters.graphTableMinConfidence75',
  'characters.graphTableMinConfidence90',
  'characters.graphTableStartChapterFilter',
  'characters.graphTableEndChapterFilter',
  'characters.graphTableStartChapterPlaceholder',
  'characters.graphTableEndChapterPlaceholder',
  'characters.graphStatus.loadingTitle',
  'characters.graphStatus.loadingBody',
  'characters.graphStatus.errorTitle',
  'characters.graphStatus.errorBody',
  'characters.graphStatus.unavailableTitle',
  'characters.graphStatus.unavailableBody',
  'characters.graphStatus.emptyTitle',
  'characters.graphStatus.emptyBody',
  'characters.graphStatus.filteredEmptyTitle',
  'characters.graphStatus.filteredEmptyBody',
  'characters.graphStatus.focusEmptyTitle',
  'characters.graphStatus.focusEmptyBody',
  'characters.graphStatus.aggregatedEmptyTitle',
  'characters.graphStatus.aggregatedEmptyBody',
  'characters.graphStatus.readyTitle',
  'characters.graphStatus.readyBody',
  'characters.graphAggregationSummary',
  'characters.graphCanvasTitle',
  'characters.graphCanvasAria',
  'characters.graphCanvasDescription',
  'characters.graphCanvasHiddenSummary',
  'characters.graphCanvasControlsAria',
  'characters.graphCanvasZoomIn',
  'characters.graphCanvasZoomOut',
  'characters.graphCanvasFullscreen',
  'characters.graphCanvasExitFullscreen',
  'characters.graphCanvasPanLeft',
  'characters.graphCanvasPanRight',
  'characters.graphCanvasPanUp',
  'characters.graphCanvasPanDown',
  'characters.graphCanvasReset',
  'characters.graphCanvasViewportStatus',
  'characters.graphEdgeDetailEyebrow',
  'characters.graphEdgeDetailTitle',
  'characters.graphEdgeDetailSummary',
  'characters.graphEdgeDetailRelations',
  'characters.graphEdgeDetailEvidence',
  'characters.graphEdgeDetailClose',
  'characters.appearanceHeatmapEyebrow',
  'characters.appearanceHeatmapTitle',
  'characters.appearanceHeatmapSummary',
  'characters.appearanceHeatmapCharacterFilter',
  'characters.appearanceHeatmapRankingTitle',
  'characters.appearanceHeatmapChapterTitle',
  'characters.appearanceHeatmapMentions',
  'characters.appearanceHeatmapChapters',
  'characters.appearanceHeatmapJumpChapter',
  'characters.appearanceHeatmapJumpChapterAria',
  'characters.appearanceHeatmapEmpty',
  'characters.appearanceHeatmapChapterEmpty',
  'characters.appearanceHeatmapChapterCharacters',
  'characters.evidenceTableEyebrow',
  'characters.evidenceTableTitle',
  'characters.evidenceTableSummary',
  'characters.evidenceTableSearch',
  'characters.evidenceTableSearchPlaceholder',
  'characters.evidenceTableCharacterFilter',
  'characters.evidenceTableRelationFilter',
  'characters.evidenceTableChapterFilter',
  'characters.evidenceTableEmpty',
  'characters.evidenceTableType',
  'characters.evidenceTableQuote',
  'characters.evidenceTableTarget',
  'characters.evidenceTableLocation',
  'characters.evidenceTableSource',
  'characters.evidenceTableConfidence',
  'characters.evidenceTableAction',
  'characters.evidenceTableJumpEvidence',
  'characters.evidenceTableCopyCitation',
  'characters.evidenceTableCopyCitationAria',
  'characters.evidenceCitationHeading',
  'characters.evidenceCitationBook',
  'characters.evidenceCitationType',
  'characters.evidenceCitationTarget',
  'characters.evidenceCitationLocation',
  'characters.evidenceCitationQuote',
  'characters.evidenceCitationClaim',
  'characters.evidenceCitationSource',
  'characters.evidenceCitationConfidence',
  'characters.evidenceCitationEvidenceId',
  'characters.evidenceCitationMissingValue',
  'characters.evidenceCitationPrivateValue',
  'characters.evidenceTarget.profile',
  'characters.evidenceTarget.alias',
  'characters.evidenceTarget.mention',
  'characters.evidenceTarget.relation',
  'characters.evidenceTarget.event',
  'characters.evidenceTarget.faction',
  'characters.evidenceStatus.valid',
  'characters.evidenceStatus.stale',
  'characters.evidenceStatus.broken',
  'characters.evidenceStatus.pendingReview',
  'characters.metric.mainCharacters',
  'characters.metric.mainCharactersHint',
  'characters.metric.coverage',
  'characters.metric.coverageHint',
  'characters.metric.lastBuilt',
  'characters.metric.lastBuiltHint',
  'characters.metric.algorithm',
  'characters.metric.algorithmHint',
  'reader.characters.open',
  'library.menu.characters',
  'library.context.characters',
  'library.detail.characters',
]) {
  assert.match(zhCN, new RegExp(`'${key.replaceAll('.', '\\.')}'`), `zh-CN must include ${key}`);
  assert.match(enUS, new RegExp(`'${key.replaceAll('.', '\\.')}'`), `en-US must include ${key}`);
}
assert.match(characterRelationGraphView, /className=\{fullscreen \? 'characters-graph-preview-app fullscreen' : 'characters-graph-preview-app compact'\}/, 'Formal relationship star map must use the same preview app shell with fullscreen and compact modes');
assert.match(characterRelationGraphView, /fullscreen \? \([\s\S]*characters-graph-preview-toolbar[\s\S]*graphSearchDraft[\s\S]*graphNeighborDepth[\s\S]*graphEdgeMode[\s\S]*characters-graph-preview-content[\s\S]*characters-graph-preview-stage/, 'Formal fullscreen relationship star map must expose the preview toolbar, search, neighbor depth, edge mode, and stage layout');
assert.match(characterRelationGraphView, /fullscreen \? \([\s\S]*characters-graph-preview-toolbar[\s\S]*\) : null/, 'Formal compact relationship star map must keep preview search/depth/edge controls collapsed until fullscreen');
assert.match(characterRelationGraphView, /selectGraphEdge\(edgeId[\s\S]*if \(!fullscreen[\s\S]*onInspectRelationDetail/, 'Formal compact relationship star map must route selected relation edges to the Character Center right-side inspector');
assert.match(characterGraphCanvasView, /viewRef[\s\S]*scale: 1,[\s\S]*x: 0,[\s\S]*y: 0/, 'Canvas component must keep preview-style mutable view state locally instead of committing every wheel tick through React');
assert.match(characterGraphCanvasView, /data-min-node-gap=\{canvas\.layout\.minNodeGap\}/, 'Relationship graph canvas must expose model-level node gap telemetry for browser overlap regression checks');
assert.match(characterGraphCanvasView, /performance\.now\(\) >= interactionUntilRef\.current[\s\S]*updateCharacterGraphCanvasProbeDatasets/, 'Relationship graph canvas must keep browser probe telemetry out of the wheel and pan draw hot path');
assert.match(characterGraphCanvasView, /renderedViewportRef[\s\S]*applyCharacterGraphCanvasCompositePreview[\s\S]*scheduleCharacterGraphCanvasSettledDraw/, 'Relationship graph canvas must use compositor CSS transforms during wheel and pan, then redraw once after interaction settles');
assert.match(characterGraphCanvasView, /commit === 'none'[\s\S]*applyCharacterGraphCanvasCompositePreview\(\)[\s\S]*return;/, 'Ref-only viewport updates must not schedule canvas redraws during high-frequency wheel or pan interactions');
assert.match(styles, /\.characters-graph-canvas-bitmap\s*\{[^}]*will-change:\s*transform[^}]*transform-origin:\s*0 0/, 'Relationship graph canvas bitmap must opt into compositor transforms for smooth zoom and pan previews');
assert.match(characterGraphCanvasRuntime, /context\.scale\(viewport\.scale, viewport\.scale\)[\s\S]*context\.translate\(viewport\.offsetX, viewport\.offsetY\)/, 'Canvas runtime must draw with the preview world transform model');
assert.match(characterGraphCanvasRuntime, /function buildVisibleGraphCanvasFrame\([\s\S]*visibleNodeIds[\s\S]*candidateEdges/, 'Canvas runtime must build a frame-local visible-node and candidate-edge set so zooming does not scan every edge on every draw');
assert.match(characterGraphCanvasRuntime, /graphCanvasHighZoomEdgeClipScale\s*=\s*3/, 'Canvas runtime must switch to high-zoom endpoint edge clipping at 300% zoom');
assert.match(characterGraphCanvasRuntime, /const edgeClipMode:\s*CharacterGraphCanvasEdgeClipMode\s*=\s*highZoom\s*\?\s*'visible-endpoints'\s*:\s*'viewport-bounds'[\s\S]*edgeClipMode,/, 'Canvas runtime must expose a high-zoom visible-endpoints edge clipping mode for browser performance telemetry');
assert.match(characterGraphCanvasRuntime, /function queryGraphCanvasVisibleEndpointEdges\([\s\S]*edgesByNodeId[\s\S]*!endpointNodeIds\.has\(edge\.sourceId\)[\s\S]*!endpointNodeIds\.has\(edge\.targetId\)/, 'High-zoom edge candidates must come from visible endpoint node adjacency and require both source and target nodes on screen');
assert.match(characterGraphCanvasRuntime, /function getCharacterGraphEdgeWidth\([\s\S]*return 0\.72 \/ scale[\s\S]*return Math\.min\(2\.1, 0\.85 \+ edge\.weight \* 0\.14\) \/ scale/, 'Canvas runtime must keep edge strokes screen-constant at high zoom instead of painting massive world-space lines');
assert.doesNotMatch(characterGraphCanvasRuntime, /Math\.max\([^)]*,\s*[^)]*\/ scale\)/, 'Canvas runtime must not clamp scaled stroke widths upward because it creates very thick high-zoom canvas strokes');
assert.doesNotMatch(characterGraphCanvasRuntime, /scaleX\s*=\s*rect\.width\s*\/\s*canvas\.width|scaleY\s*=\s*rect\.height\s*\/\s*canvas\.height/, 'Canvas runtime must not use the old rect-to-canvas scaleX/scaleY viewport model because it diverges from the preview zoom behavior');
assert.match(characterGraphRenderModel, /export function buildCharacterGraphRenderModel/, 'WebGL render model must expose a pure canvas-to-render-model builder');
assert.match(characterGraphRenderModel, /export function queryVisibleCharacterGraphRenderFrame/, 'WebGL render model must expose bounded visible-frame queries for viewport culling');
assert.match(characterGraphRenderModel, /export function buildCharacterGraphHoverFrame/, 'WebGL render model must expose bounded hover frames for hub-node highlighting');
assert.match(characterGraphRenderModel, /hoverEdgeBudget:\s*160/, 'WebGL render model must cap hover edge highlighting at 160 edges by default');
assert.match(characterGraphRenderModel, /labelBudget:\s*96/, 'WebGL render model must cap DOM labels at 96 visible labels by default');
assert.doesNotMatch(characterGraphRenderModel, /document\.|window\.|HTMLCanvasElement|WebGLRenderingContext/, 'WebGL render model must remain pure and DOM-free');
assert.match(characterGraphWebglRenderer, /getContext\('webgl2'(?:,|\))[\s\S]*getContext\('webgl'(?:,|\))/, 'WebGL renderer must initialize a GPU context');
assert.match(characterGraphWebglRenderer, /bufferUploadSerial[\s\S]*viewportUniformUpdates[\s\S]*hoverUploadSerial/, 'WebGL renderer telemetry must distinguish buffer uploads from viewport uniform and hover updates');
assert.match(characterGraphWebglRenderer, /drawMode:\s*'retained'/, 'WebGL renderer must declare retained draw mode telemetry');
assert.match(characterGraphWebglRenderer, /drawArrays|drawElements/, 'WebGL renderer must issue GPU draw calls instead of Canvas 2D drawing');
assert.doesNotMatch(characterGraphWebglRenderer, /CanvasRenderingContext2D|getContext\('2d'\)/, 'WebGL renderer must not use Canvas 2D for the main graph path');
assert.match(characterGraphWebglView, /createCharacterGraphWebglRenderer/, 'WebGL React adapter must mount the retained renderer');
assert.match(characterGraphWebglView, /function handlePointerMove[\s\S]*rendererRef\.current\?\.handlePointerMove/, 'WebGL React adapter must route pointermove to the renderer instance');
assert.doesNotMatch(characterGraphWebglPointerMoveSource, /set[A-Z][A-Za-z0-9_]*\(/, 'WebGL pointermove path must not call React setState');
assert.match(characterGraphWebglView, /viewportInitialized\?: boolean[\s\S]*if \(viewportInitialized\) return undefined[\s\S]*fitGraphToCanvas\('immediate'\)/, 'WebGL graph view must not auto-fit over a restored session viewport');
assert.match(characterGraphCanvasView, /viewportInitialized\?: boolean[\s\S]*if \(viewportInitialized\) return undefined[\s\S]*fitGraphToCanvas\('immediate'\)/, 'Canvas fallback must not auto-fit over a restored session viewport');
assert.match(characterGraphWebglView, /data-renderer=\{rendererTelemetry\.renderer\}/, 'WebGL view must expose renderer telemetry for browser parity checks');
assert.match(characterRelationGraphView, /import \{ CharacterGraphWebglView \} from '\.\/CharacterGraphWebglView'/, 'Formal relationship graph must import the WebGL view');
assert.match(characterRelationGraphView, /<CharacterGraphWebglView[\s\S]*fallbackView=\{\(\s*<CharacterGraphCanvasView/, 'Formal relationship graph must default to WebGL and keep Canvas only as fallback');
assert.match(styles, /\.characters-graph-webgl-label-layer\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/, 'WebGL label layer must overlay the canvas without stealing graph pointer events');
assert.match(zhCN, /characters\.readiness\.characterMissingBody': '.*开始人物识别/, 'zh-CN missing-character prompt must render a readable start-character-extraction phrase');
assert.match(enUS, /characters\.readiness\.characterMissingBody': '.*Start Character Extraction/, 'en-US missing-character prompt must render a readable start-character-extraction phrase');

console.log('Verified character center contracts.');

function extractSourceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing source marker: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `Missing source marker: ${endNeedle}`);
  return source.slice(start, end);
}

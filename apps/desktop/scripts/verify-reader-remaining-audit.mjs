import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const readerPage = read('src/features/reader-core/ReaderPage.tsx');
const readerToolbar = read('src/features/reader-core/ReaderToolbar.tsx');
const readerToc = read('src/features/reader-core/ReaderTocPanel.tsx');
const readerModel = read('src/features/reader-core/readerModel.ts');
const readerInteractionModel = read('src/features/reader-core/readerInteractionModel.ts');
const readerAnnotationPanelController = read('src/features/reader-core/useReaderAnnotationPanelController.ts');
const readerChapterParserModelPath = 'src/features/reader-core/readerChapterParserModel.ts';
assert.equal(existsSync(readerChapterParserModelPath), true, 'Reader chapter parsing and TOC manifest logic must live in readerChapterParserModel');
const readerChapterParserModel = read(readerChapterParserModelPath);
const readerSettings = read('src/features/reader-core/readerSettings.ts');
const readerWorkspace = read('src/pages/ReaderWorkspace.tsx');
const readerWorkspaceStorage = read('src/pages/readerWorkspaceStorage.ts');
const readerWorkspacePersistence = read('src/pages/reader-workspace/useReaderWorkspacePersistence.ts');
const readerStorageService = read('src/services/readerStorageService.ts');
const aiPanel = read('src/features/ai-reader/AiReaderPanel.tsx');
const styles = readCssWithImports('src/app/styles.css');
const types = read('src/types.ts');
const commands = [
  read('src-tauri/src/commands.rs'),
  read('src-tauri/src/commands/reader_data_commands.rs'),
].join('\n');
const lib = read('src-tauri/src/lib.rs');
const tauriLibrary = [
  read('src-tauri/src/library.rs'),
  read('src-tauri/src/library/trash.rs'),
  read('src-tauri/src/library/metadata.rs'),
].join('\n');
const readerData = read('src-tauri/src/reader_data.rs');
const database = read('src-tauri/src/database.rs');
const packageJson = JSON.parse(read('package.json'));

assert.match(aiPanel, /value:\s*'volume'[\s\S]*ai\.scope\.volume/, 'AI reader must offer current-volume scope');
assert.match(aiPanel, /value:\s*'annotations'[\s\S]*ai\.scope\.annotations/, 'AI reader must offer annotation-collection scope');
assert.match(aiPanel, /const liveScopePreview = useMemo[\s\S]*className="ai-scope-live-preview"[^>]*>\{liveScopePreview\}/, 'AI modes must show the resolved scope preview before sending content');
assert.match(aiPanel, /redactCloudText as redactSensitiveCloudText/, 'AI cloud authorization must import the shared desensitization helper');
assert.match(aiPanel, /function redactCloudText\(prompt: string\)[\s\S]*cloudPrivacySettings\.autoRedact[\s\S]*redactSensitiveCloudText\(prompt,\s*cloudPrivacySettings\.sensitiveWords\)/, 'AI cloud authorization must pass content through a desensitization helper');
assert.match(aiPanel, /cloudPromptText = redactCloudText\(nextPrompt\)/, 'AI cloud prompt text must be desensitized before sending');
assert.match(aiPanel, /scopeText: redactCloudText\(scopeText \?\? ''\)/, 'AI cloud scope text must be desensitized before sending');
assert.match(aiPanel, /resolveAiTransportModeForInteraction\(interactionMode,\s*cloudPrivacySettings\.enabled\)/, 'AI transport selection must honor whether cloud AI is enabled');
assert.match(aiPanel, /allowSelectionText = cloudPrivacySettings\.allowSelectionText[\s\S]*allowCurrentPageText = cloudPrivacySettings\.allowCurrentPageText[\s\S]*allowCurrentChapterText = cloudPrivacySettings\.allowCurrentChapterText[\s\S]*allowBookSummaryContext = cloudPrivacySettings\.allowBookSummaryContext/, 'AI request scope construction must honor cloud content-range permissions');

assert.match(readerToolbar, /reader-toolbar-section nav/, 'Reader toolbar must visually group navigation controls');
assert.match(readerToolbar, /reader-toolbar-section search/, 'Reader toolbar must visually group search controls');
assert.match(readerToolbar, /reader-toolbar-more/, 'Reader toolbar must move secondary actions into a More menu');
assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.ai-panel[\s\S]*position: fixed[\s\S]*bottom: 0/, 'small screens must render AI panel as a bottom sheet/drawer');
assert.match(styles, /\.reader-page-spread\.turn-next\.spread-left|\.spread-right|\.cross-chapter-turn/, 'double-page animation must distinguish spread side or cross-chapter turns');
assert.match(styles, /--reader-text-priority|\.reader-canvas\.focus-mode[\s\S]*box-shadow: none/, 'reader visual polish must prioritize正文 and reduce borders/shadows in reading mode');
assert.match(styles, /text-wrap: pretty|hanging-punctuation|orphans:/, 'Chinese typography polish must include punctuation/widow/orphan/readability rules');
assert.match(styles, /\.theme-night[\s\S]*--contrast-aa|\.highlight-contrast-aa/, 'night/highlight contrast audit tokens must be present');

assert.match(readerInteractionModel, /VirtualListWindow/, 'Reader must expose a virtual list helper for large panels and TOC');
assert.match(readerAnnotationPanelController, /highlightVirtualWindow/, 'large highlight list must use virtualized rendering window');
assert.match(readerAnnotationPanelController, /bookmarkVirtualWindow/, 'large bookmark list must use virtualized rendering window');
assert.match(readerToc, /const tocIndex = useMemo[\s\S]*const filteredEntries = useMemo/, 'TOC indexing and filtering must remain memoized for large chapter collections');
assert.match(readerPage, /IntersectionObserver/, 'Reader flow mode must use IntersectionObserver to update active paragraph/chapter');
assert.doesNotMatch(readerPage, /key=\{`page-turn-\$\{pageTurnKey\}-/, 'page content must not force remount with pageTurnKey for animations');

assert.match(readerModel, /computeReaderProgress/, 'reader model must compute real full-book progress');
assert.match(readerModel, /createReaderHistoryStack/, 'reader model must support back/forward reading history');
assert.match(readerModel, /createReaderGoalProgress/, 'reader model must model daily reading goals');
assert.match(readerModel, /from '\.\/readerChapterParserModel\.js'/, 'reader model must keep compatibility re-exports for chapter parser behavior');
assert.match(readerChapterParserModel, /export function buildReaderChapters/, 'reader chapter parser model must own chapter parsing');
assert.match(readerChapterParserModel, /export function buildReaderTocManifest/, 'reader chapter parser model must own persisted TOC manifest generation');
assert.match(readerChapterParserModel, /export function buildReaderChapterDiagnostics/, 'reader chapter parser model must own parser diagnostics');
assert.match(readerChapterParserModel, /export function cleanTxtContent/, 'reader chapter parser model must own TXT cleanup');
assert.doesNotMatch(readerModel, /const CHINESE_CHAPTER_HEADING_RE|function buildParagraphs|export function buildReaderChapters\(/, 'reader model must not keep chapter parser implementation details');
assert.match(readerChapterParserModel, /buildReaderChapterHashManifest/, 'chapters must have precomputed hashes for pagination/cache');
assert.match(readerModel, /createReaderContentCacheKey/, 'cleaned content and chapters must be cacheable by contentHash/parserVersion');
assert.match(readerModel, /estimateLongParagraphSlices/, 'long paragraphs must have an estimated pre-split helper before DOM measurement');
assert.match(readerModel, /scheduleReaderPaginationPreheat/, 'pagination must expose adjacent-chapter preheat scheduling');
assert.match(readerModel, /createReaderPendingRepairAnnotation/, 'failed anchor migrations must produce pending-repair annotations');
assert.match(readerModel, /migrateReaderAnchorsForContentHash/, 'contentHash changes must trigger anchor migration helper');
assert.match(readerModel, /linkReaderHighlightToKnowledge/, 'Reader highlights must be linkable to knowledge annotations');
assert.match(readerModel, /createReaderAnnotationDerivative/, 'AI/highlight content must be convertible to notes, flashcards, or topic collections');

assert.match(types, /privacyMode: boolean/, 'Reader settings must include privacy mode');
assert.match(types, /encryptSensitiveReaderData: boolean/, 'Reader settings must include local sensitive-data encryption option');
assert.match(readerSettings, /privacyMode: false/, 'Reader default settings must disable privacy mode by default');
assert.match(readerSettings, /encryptSensitiveReaderData: true/, 'Reader default settings must enable sensitive-data encryption by default');
assert.match(readerWorkspaceStorage, /skipReaderPersistence[\s\S]*settings\.privacyMode/, 'privacy mode must skip saving reader history and temporary highlights');
assert.match(readerStorageService, /createSensitiveReaderStoragePayload/, 'sensitive notes/highlights must support local encryption envelope');
assert.match(readerStorageService, /unwrapSensitiveReaderStoragePayload/, 'encrypted sensitive Reader payloads must be unwrapped on read');
assert.match(readerWorkspacePersistence, /createSensitiveReaderStoragePayload\(highlights,\s*settings\.encryptSensitiveReaderData\)/, 'highlights must save through the local encryption envelope when enabled');
assert.match(readerWorkspacePersistence, /createSensitiveReaderStoragePayload\(bookmarks,\s*settings\.encryptSensitiveReaderData\)/, 'bookmarks must save through the local encryption envelope when enabled');
assert.match(readerWorkspacePersistence, /createSensitiveReaderStoragePayload\(tocEdits,\s*settings\.encryptSensitiveReaderData\)/, 'TOC edits must save through the local encryption envelope when enabled');
assert.match(tauriLibrary, /is_trash_record_protected[\s\S]*protect_reader_assets[\s\S]*has_reader_records_for_book_in/, 'trash cleanup must protect books with reader records when reader-asset protection is enabled');
assert.match(tauriLibrary, /permanently_delete_book_in[\s\S]*archive_reader_records_for_deleted_book_in/, 'permanent deletion must archive reader records instead of silently dropping reading assets');
assert.match(readerWorkspace, /reader\.fileRecovery/, 'missing file / permission / encoding failures must render a recovery entry');

for (const file of [
  'src/features/reader-core/useReaderSession.ts',
  'src/features/reader-core/useReaderAnnotations.ts',
  'src/features/reader-core/useReaderTocEdits.ts',
  'src/features/reader-core/useReaderPagination.ts',
  'src/features/reader-core/useReaderSelection.ts',
  'src/features/reader-core/useReaderKeyboardNavigation.ts',
  'src/features/reader-core/useReaderWindowSync.ts',
  'src/features/reader-core/ReaderToolbar.tsx',
  'src/features/reader-core/ReaderTocPanel.tsx',
  'src/features/reader-core/ReaderContent.tsx',
  'src/features/reader-core/ReaderHighlightPanel.tsx',
  'src/features/reader-core/ReaderSelectionMenu.tsx',
  'src/features/reader-core/ReaderContextMenus.tsx',
  'src/features/reader-core/ReaderSettingsPanel.tsx',
  'src/features/reader-core/readerChapters.ts',
  'src/features/reader-core/readerToc.ts',
  'src/features/reader-core/readerPagination.ts',
  'src/features/reader-core/readerHighlights.ts',
  'src/features/reader-core/readerBookmarks.ts',
  'src/features/reader-core/readerSearch.ts',
  'src/features/reader-core/readerSelection.ts',
  'src/features/reader-core/readerExport.ts',
  'src/features/reader-core/readerLocation.ts',
]) {
  assert.equal(existsSync(file), true, `${file} must exist to document Reader architecture boundaries`);
}

for (const commandName of [
  'get_reader_state', 'save_reader_state', 'list_reader_highlights', 'upsert_reader_highlight', 'delete_reader_highlight',
  'list_reader_bookmarks', 'upsert_reader_bookmark', 'delete_reader_bookmark', 'list_reader_toc_edits', 'save_reader_toc_edit',
  'search_reader_annotations', 'migrate_reader_local_storage'
]) {
  assert.match(commands, new RegExp(`fn ${commandName}\\b`), `backend must expose ${commandName}`);
  assert.match(lib, new RegExp(`${commandName}`), `Tauri invoke handler must register ${commandName}`);
}

for (const tableName of ['books', 'book_contents', 'chapters', 'reader_states', 'reader_settings', 'reader_highlights', 'reader_bookmarks', 'reader_toc_edits', 'reader_page_cache', 'notes', 'flashcards', 'annotation_links']) {
  assert.match(readerData + database, new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}`), `SQLite schema must include ${tableName}`);
}
assert.match(readerData, /idx_reader_highlights_book_chapter_created_color_note/, 'reader highlight table must index bookId, chapterId, createdAt, color, hasNote');
assert.match(readerData, /idx_reader_bookmarks_book_chapter_created/, 'reader bookmark table must index bookId, chapterId, createdAt');
assert.match(readerData, /search_reader_annotations_in/, 'reader annotation search must use SQLite LIKE/FTS or a local index');
assert.match(database, /OnceLock|Mutex|ConnectionPool|prepare_cached/, 'FTS search should reuse initialized connection/schema or cached statements');

for (const [scriptName, file] of Object.entries({
  'test:reader-remaining-audit': 'scripts/verify-reader-remaining-audit.mjs',
  'test:reader-e2e-contracts': 'scripts/verify-reader-e2e-contracts.mjs',
  'test:reader-storage-migration': 'scripts/verify-reader-storage-migration.mjs',
  'test:acceptance:reader': 'scripts/acceptance-reader-audit.mjs',
  'benchmark:reader-open': 'scripts/benchmark-reader-open.mjs',
  'benchmark:reader-annotations': 'scripts/benchmark-reader-annotations.mjs',
  'benchmark:reader-pagination': 'scripts/benchmark-reader-pagination.mjs',
  'benchmark:reader-search': 'scripts/benchmark-reader-search.mjs',
  'benchmark:reader-memory': 'scripts/benchmark-reader-memory.mjs',
  'benchmark:reader-sync': 'scripts/benchmark-reader-sync.mjs',
  'benchmark:reader-fps': 'scripts/benchmark-reader-fps.mjs',
})) {
  assert.equal(packageJson.scripts?.[scriptName], `node ${file}`, `${scriptName} must be registered`);
  assert.equal(existsSync(file), true, `${file} must exist`);
}
assert.match(packageJson.scripts?.test ?? '', /test:reader-remaining-audit/, 'aggregate npm test must include the remaining audit contract');

console.log('Verified remaining Reader audit contracts.');

function readCssWithImports(filePath, seen = new Set()) {
  if (seen.has(filePath)) return '';
  seen.add(filePath);
  const source = read(filePath);
  const imports = [...source.matchAll(/@import\s+['"](.+?)['"];/g)]
    .map((match) => readCssWithImports(join(dirname(filePath), match[1]), seen));
  return [source, ...imports].join('\n');
}

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const aiPanel = readFileSync('src/features/ai-reader/AiReaderPanel.tsx', 'utf8');
const aiReaderComposerInput = readFileSync('src/features/ai-reader/AiReaderComposerInput.tsx', 'utf8');
const aiConversationMessageList = readFileSync('src/features/ai-reader/AiConversationMessageList.tsx', 'utf8');
assert.match(aiReaderComposerInput, /createPortal\([\s\S]*ai-input-context-menu[\s\S]*document\.body\)/, 'AI composer input context menu must portal above reader panel clipping boundaries');
assert.match(aiConversationMessageList, /createPortal\([\s\S]*ai-input-context-menu[\s\S]*document\.body\)/, 'AI rename input context menu must portal above conversation clipping boundaries');
const aiReaderDiagnosticsPanelPath = 'src/features/ai-reader/AiReaderDiagnosticsPanel.tsx';
assert.ok(existsSync(aiReaderDiagnosticsPanelPath), 'AI reader diagnostics panel must live in AiReaderDiagnosticsPanel');
const aiReaderDiagnosticsPanel = readFileSync(aiReaderDiagnosticsPanelPath, 'utf8');
const structuredAnswerViewPath = 'src/features/ai-reader/AiStructuredAnswerView.tsx';
assert.ok(existsSync(structuredAnswerViewPath), 'AI structured answer rendering must live in AiStructuredAnswerView');
const structuredAnswerView = readFileSync(structuredAnswerViewPath, 'utf8');
const structuredSectionRenderersPath = 'src/features/ai-reader/AiStructuredSectionRenderers.tsx';
assert.ok(existsSync(structuredSectionRenderersPath), 'AI structured section renderers must live in AiStructuredSectionRenderers');
const structuredSectionRenderers = readFileSync(structuredSectionRenderersPath, 'utf8');
const renderer = readFileSync('src/features/ai-reader/AiResponseRenderer.tsx', 'utf8');
const citationCards = readFileSync('src/features/ai-reader/AiCitationCards.tsx', 'utf8');
const readerWorkspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const readerPanelContentBuilder = readFileSync('src/pages/reader-workspace/ReaderPanelContentBuilder.tsx', 'utf8');
const protocol = readFileSync('src/services/aiResponseProtocol.ts', 'utf8');
const markdownFallback = readFileSync('src/services/aiMarkdownFallback.ts', 'utf8');
const toolProtocol = readFileSync('src/services/bookmindToolProtocol.ts', 'utf8');
const readerExportService = readFileSync('src/services/readerExportService.ts', 'utf8');
const tauriCommands = [
  readFileSync('src-tauri/src/commands.rs', 'utf8'),
  ...readdirSync('src-tauri/src/commands')
    .filter((name) => name.endsWith('.rs'))
    .map((name) => readFileSync(`src-tauri/src/commands/${name}`, 'utf8')),
].join('\n');
const tauriLib = readFileSync('src-tauri/src/lib.rs', 'utf8');
const settingsPage = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
const settingsDiagnosticsPanel = readFileSync('src/pages/SettingsDiagnosticsPanel.tsx', 'utf8');
const settingsPageOptions = readFileSync('src/pages/useSettingsPageOptions.ts', 'utf8');
const settingsSupplementalPanels = readFileSync('src/pages/SettingsSupplementalPanels.tsx', 'utf8');
const operationLogService = readFileSync('src/services/operationLogService.ts', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const appSettingsHook = readFileSync('src/app/useAppSettings.ts', 'utf8');
const taskDiagnosticsExport = readFileSync('src/services/taskDiagnosticsExport.ts', 'utf8');
const characterFixture = readFileSync('src/tests/fixtures/mock-ai-response.character-relationships.json', 'utf8');
const timelineFixture = readFileSync('src/tests/fixtures/mock-ai-response.timeline.json', 'utf8');
const foreshadowingFixture = readFileSync('src/tests/fixtures/mock-ai-response.foreshadowing.json', 'utf8');
const zhCn = [readFileSync('src/i18n/zh-CN.ts', 'utf8'), readFileSync('src/i18n/messages/zhCN/ai.ts', 'utf8')].join('\n');
const enUs = [readFileSync('src/i18n/en-US.ts', 'utf8'), readFileSync('src/i18n/messages/enUS/ai.ts', 'utf8')].join('\n');
const toolFixture = readFileSync('src/tests/fixtures/mock-ai-response.v2.tool-list-answer.json', 'utf8');
const flashcardMarkdown = readFileSync('src/tests/fixtures/mock-ai-response.markdown.flashcards.md', 'utf8');
const appStyles = [
  readFileSync('src/app/styles.css', 'utf8'),
  readFileSync('src/app/styles/base.css', 'utf8'),
  readFileSync('src/app/styles/layout.css', 'utf8'),
  readFileSync('src/app/styles/settings.css', 'utf8'),
  readFileSync('src/app/styles/characters.css', 'utf8'),
].join('\n');

assert.match(protocol, /bookmind\.ai\.response\.v2/, 'protocol parser must know v2');
assert.match(markdownFallback, /parseAiMarkdownFallback/, 'Markdown fallback parser must exist');
assert.match(aiPanel, /parseAiResponseProtocol\(answer\)/, 'AI panel must parse all answers, not just JSON-looking answers');
assert.match(aiPanel, /slashDetailCommand/, 'slash command menu must support a right-click detail view for long command prompts');
assert.match(aiPanel, /onOpenSlashCommandDetail=\{\(event, command\) => openSlashCommandDetail\(event, command as SlashCommand\)\}/, 'AI panel must pass typed slash-command detail handling into the extracted composer');
assert.match(aiReaderComposerInput, /onContextMenu=\{\(event\) => onOpenSlashCommandDetail\(event, command\)\}[\s\S]*onClick=\{\(\) => onSelectSlashCommand\(command\)\}/, 'slash command cards must open details from right-click without selecting the command');
assert.match(aiPanel, /from '\.\/AiStructuredAnswerView'/, 'AI panel must import the extracted structured answer view');
assert.doesNotMatch(aiPanel, /function StructuredAnswerView\(/, 'AI panel must not inline the structured answer renderer');
assert.match(aiConversationMessageList, /rawAnswer=\{answer\}/, 'structured answer card must receive the raw AI answer for copying');
assert.match(structuredAnswerView, /from '\.\/AiStructuredSectionRenderers'/, 'structured answer view must delegate block rendering to extracted section renderers');
assert.doesNotMatch(structuredAnswerView, /function AiProtocolBlock\(/, 'structured answer view must not inline protocol block rendering');
assert.doesNotMatch(structuredAnswerView, /function StructuredReplyFoldSections\(/, 'structured answer view must not inline fold-section rendering');
assert.doesNotMatch(structuredAnswerView, /function renderToolRail\(/, 'structured answer view must not inline tool rail rendering');
assert.match(structuredSectionRenderers, /export function AiProtocolBlock/, 'structured section renderers must export the protocol block renderer');
assert.match(structuredSectionRenderers, /export function StructuredReplyFoldSections/, 'structured section renderers must export fold-section rendering');
assert.match(structuredSectionRenderers, /export function renderToolRail/, 'structured section renderers must export tool rail rendering');
assert.match(structuredAnswerView, /copyRawAiAnswer/, 'structured answer card must expose a raw-answer copy action');
assert.match(aiPanel, /renderedBlockLimit\?:\s*string/, 'AI panel must accept a configured rendered block limit');
assert.match(aiPanel, /parseRenderedBlockLimit\(renderedBlockLimit\)/, 'AI panel must normalize the rendered block limit before rendering structured answers');
assert.match(structuredAnswerView, /const visibleBlocks = response\.blocks\.slice\(0,\s*safeRenderedBlockLimit\)/, 'structured answer view must render only the configured number of blocks');
assert.match(structuredAnswerView, /const hiddenBlockCount = Math\.max\(0,\s*response\.blocks\.length - visibleBlocks\.length\)/, 'structured answer view must compute hidden block count');
assert.match(structuredAnswerView, /ai-render-limit-notice/, 'structured answer view must show a rendered-block truncation notice');
assert.match(renderer, /renderedBlockLimit\?:\s*number/, 'extracted AI response renderer must accept a rendered block limit');
assert.match(renderer, /const visibleBlocks = parsed\.blocks\.slice\(0,\s*safeRenderedBlockLimit\)/, 'extracted AI response renderer must render only the configured number of blocks');
assert.match(renderer, /const hiddenBlockCount = Math\.max\(0,\s*parsed\.blocks\.length - visibleBlocks\.length\)/, 'extracted AI response renderer must compute hidden block count');
assert.match(renderer, /ai-render-limit-notice/, 'extracted AI response renderer must show a rendered-block truncation notice');
assert.match(taskDiagnosticsExport, /export function redactDiagnosticPaths/, 'task diagnostics export service must expose reusable diagnostic path redaction');
assert.match(aiPanel, /copyDiagnosticsAutoRedact\?: boolean/, 'AI panel must accept the copied diagnostic redaction setting');
assert.match(aiPanel, /copyDiagnosticsAutoRedact = true/, 'AI panel diagnostic copy redaction must default to enabled');
assert.match(`${aiPanel}\n${aiConversationMessageList}`, /AiReaderDiagnosticsPanel/, 'AI panel must delegate diagnostic rendering to the extracted diagnostics panel');
assert.doesNotMatch(aiPanel, /function copyDiagnosticInfo\(/, 'AI panel must not inline diagnostic copy logic');
assert.doesNotMatch(aiPanel, /本地索引诊断/, 'AI panel must not inline diagnostic panel markup');
assert.match(aiReaderDiagnosticsPanel, /export function AiReaderDiagnosticsPanel/, 'AI reader diagnostics panel must export the diagnostics component');
assert.match(aiReaderDiagnosticsPanel, /sanitizePrivacyObject\(diagnosticPayload,\s*copyDiagnosticsAutoRedact\)/, 'AI panel copied diagnostics must redact paths, prompts, query text, and user text when enabled');
assert.match(aiReaderDiagnosticsPanel, /getDiagnosticDisplayText\(diagnostics\.queryUsed,\s*copyDiagnosticsAutoRedact,\s*t\)/, 'AI panel must not display raw diagnostic query text when diagnostic redaction is enabled');
assert.match(readerPanelContentBuilder, /copyDiagnosticsAutoRedact=\{extendedSettings\.copyDiagnosticsAutoRedact\}/, 'reader panel content builder must pass copied diagnostic redaction to AI panel');
assert.match(structuredAnswerView, /saveStructuredAnswerScreenshot/, 'structured answer card must expose a rendered-card screenshot action');
assert.match(structuredAnswerView, /canvas\.toBlob/, 'rendered-card screenshot must export a PNG blob from canvas');
assert.match(structuredAnswerView, /saveScreenshotBlob/, 'rendered-card screenshot must use the shared screenshot save helper');
assert.match(structuredAnswerView, /renderDomLayoutScreenshotBlob/, 'screenshot saving must have a DOM-layout canvas fallback when foreignObject fails');
assert.match(structuredAnswerView, /foreignObjectFallback/, 'screenshot fallback should be logged for debugging when enabled');
assert.match(structuredAnswerView, /writeReaderBinaryFile/, 'Tauri screenshot saving must write the PNG through the reader export service boundary');
assert.match(readerExportService, /write_reader_binary_file/, 'reader export service must centralize the backend binary writer command');
assert.match(tauriCommands, /fn write_reader_binary_file/, 'backend must expose a binary writer command for PNG screenshots');
assert.match(tauriLib, /write_reader_binary_file/, 'backend binary writer command must be registered with Tauri');
assert.match(structuredAnswerView, /ai\.structured\.screenshotSaved[\s\S]*ai\.structured\.screenshotSaveFailed/, 'screenshot action must provide localized visible success or failure status');
assert.match(structuredAnswerView, /ai\.structured\.screenshotCancelled/, 'screenshot action must show a localized explicit status when the save dialog is cancelled');
assert.match(operationLogService, /OPERATION_LOG_LEVEL_KEY/, 'operation log service must persist the selected log level');
assert.match(operationLogService, /type OperationLogPrivacyPolicy/, 'operation log service must support per-write privacy policy');
assert.match(operationLogService, /sanitizeOperationLogDetail/, 'operation log service must sanitize operation log details before saving');
assert.match(operationLogService, /!privacyPolicy\.recordInputContent[\s\S]*\[redacted:\$\{value\.length\}\]/, 'operation log service must redact input-like values by default');
assert.match(operationLogService, /!privacyPolicy\.recordPaths[\s\S]*redactOperationLogPaths/, 'operation log service must redact path-like values by default');
assert.match(settingsDiagnosticsPanel, /operationLogLevel/, 'settings diagnostics panel must expose operation log level controls');
assert.match(settingsPageOptions, /value:\s*'none'[\s\S]*settings\.logs\.level\.none/, 'settings page options hook must allow disabling operation logs by default');
assert.match(settingsDiagnosticsPanel, /JSON\.stringify\(item\.detail\)/, 'settings log list must show operation details, not just action names');
assert.match(appSettingsHook, /recordOperationLog\('basic', 'ui\.click'/, 'app shell settings hook must record user clicks when operation logging is enabled');
assert.match(appSettingsHook, /recordOperationLog\('debug', 'ui\.input'/, 'app shell settings hook must record input changes at debug level');
assert.match(appSettingsHook, /const policy = \{ recordInputContent: extendedSettings\.operationLogRecordInputContent, recordPaths: extendedSettings\.operationLogRecordPaths \}/, 'app shell settings hook must pass privacy policy into operation log writes');
assert.match(appSettingsHook, /extendedSettings\.operationLogRecordInputContent \? e\.value : undefined/, 'app shell settings hook must omit input values from debug logs unless the setting allows them');
assert.match(appSettingsHook, /setOperationLogLevel\(settings\.operationLogLevel \?\? 'none'\)/, 'app shell settings hook must sync operation log level from persisted settings and default to none');
assert.doesNotMatch(app, /书库元数据已刷新/, 'startup metadata refresh must not show a top-of-reader success status');
assert.doesNotMatch(app, /settings-library-refresh-status/, 'app shell must not render the startup metadata refresh status banner');
assert.match(structuredAnswerView, /bookmind-ai-response-\$\{new Date\(\)\.toISOString/, 'rendered-card screenshot must save with a stable BookMind filename');
assert.match(structuredAnswerView, /link\.download = filename/, 'rendered-card screenshot must assign the generated filename to the download link');
assert.match(structuredSectionRenderers, /case 'heading'/, 'renderer must handle markdown heading blocks');
assert.match(structuredSectionRenderers, /case 'bullet_list'/, 'renderer must handle markdown list blocks');
assert.match(structuredSectionRenderers, /case 'citation_group'/, 'renderer must handle pending citation groups');
assert.match(structuredSectionRenderers, /case 'diagnostics'/, 'diagnostics blocks must render separately from正文');
assert.match(structuredSectionRenderers, /case 'evidence_list'/, 'renderer must render structured evidence lists as visual cards instead of raw JSON');
assert.match(structuredSectionRenderers, /EvidenceListBlock/, 'AI structured section renderers must have a dedicated evidence list renderer');
assert.match(structuredSectionRenderers, /block\.type === 'summary'/, 'fold summary must include normalized summary blocks');
assert.match(structuredSectionRenderers, /block\.type === 'suggested_actions'/, 'fold actions must include normalized suggested action blocks');
assert.match(structuredSectionRenderers, /renderCharacterStatusRows/, 'character_table rows must render instead of disappearing');
assert.match(structuredSectionRenderers, /statusChange/, 'character status change field must be displayed');
assert.match(structuredSectionRenderers, /isLooseCommandBlock\(block\) \? null : <ConfirmablePreviewAction label=\{t\('ai\.structured\.syncCharacterPreview'\)\}/, 'loose command character blocks must not show a nonfunctional character sync action');
assert.match(structuredSectionRenderers, /isTimelineSyncAvailable\(block\) \? <button/, 'timeline sync action must only show when a real chapter sync target exists');
assert.match(structuredSectionRenderers, /renderTimeline\(events, t, \{ hideKind: isLooseCommandBlock\(block\) \}\)/, 'loose command timelines must hide internal kind labels like happened');
assert.match(structuredSectionRenderers, /renderForeshadowing\(block\.items, citations, runSafeAction, t, \{ hideActions: isLooseCommandBlock\(block\) \}\)/, 'loose command conflict blocks must hide nonfunctional mark actions');
assert.match(structuredSectionRenderers, /item\?\.citationSource/, 'flashcard renderer must show citation text from loose slash-command cards');
assert.match(aiPanel, /ai-slash-detail-popover/, 'slash command detail view must render a dedicated detail popover');
assert.match(aiPanel, /closeSlashCommandDetail/, 'slash command detail view must be dismissible');
assert.match(aiPanel, /ai-composer-card ai-companion-dock resizable-composer/, 'AI composer must use the v5 resizable companion dock at the panel bottom');
assert.match(aiReaderComposerInput, /className="ai-question-input"/, 'extracted AI question textarea must have a stable hook for fixed-height styling');
assert.match(aiPanel, /BookMindIcon/, 'AI composer must reuse the same icon system as the reader toolbar');
assert.match(aiPanel, /ai-send-stop-btn[\s\S]*\{isGenerating \? <BookMindIcon name="stop" \/> : <BookMindIcon name="aiSend" \/>\}/, 'AI send action must be one bottom-right send/stop toggle button');
assert.match(aiPanel, /ai-attachment-add-btn[\s\S]*<BookMindIcon name="plus"/, 'AI composer must expose one plus button for attachments');
assert.match(aiPanel, /ai-scope-status-btn[\s\S]*data-tooltip=\{capabilityPanelTitle\.tooltip\}/, 'AI composer must expose one scope status button with a localized tooltip');
assert.doesNotMatch(aiPanel, /ai-toolbar-icon-btn|ai-option-a-icon-row/, 'AI composer must not keep extra local/copy/note toolbar buttons');
assert.match(renderer, /ai-response-renderer/, 'AiResponseRenderer component must exist for extracted rendering contracts');
assert.match(citationCards, /AiCitationCards/, 'AiCitationCards component must exist');
assert.match(citationCards, /onKeyDown/, 'citation cards must support keyboard activation');
assert.match(citationCards, /protocolCitationToReaderCitation/, 'protocol citations must map to Reader locations');
assert.match(citationCards, /onSaveDefault\?: \(citation: Citation\) => void/, 'citation cards must expose a default citation save action');
assert.match(citationCards, /ai\.citationCard\.saveDefault/, 'citation cards must keep a localized visible default-save button');
assert.match(aiPanel, /onSaveProtocolDefault/, 'structured protocol citations must expose a default-save handler');
assert.match(structuredAnswerView, /ProtocolCitationCard[\s\S]*onSaveProtocolDefault/, 'structured protocol citation cards must receive the default-save handler');
assert.match(structuredSectionRenderers, /ai\.citationCard\.saveDefault/, 'structured protocol citation cards must keep a localized visible default-save button');
assert.match(readerWorkspace, /jumpToReaderLocation/, 'ReaderWorkspace must expose a unified reader jump function');
assert.match(readerWorkspace, /subscribeAiProtocolJump\(onAiProtocolJump\)/, 'structured citation jump events must be handled through the typed AI reader event boundary');
assert.match(toolProtocol, /BOOKMIND_READER_TOOLS/, 'BookMind user-visible tool registry must exist');
assert.match(toolProtocol, /isToolCapabilityQuestion/, 'tool-list questions must be detected before normal retrieval');

for (const name of ['get_current_context', 'search_local_index', 'get_paragraph_window', 'jump_to_source', 'save_ai_note', 'save_citation_highlight', 'generate_flashcards', 'build_timeline', 'extract_characters', 'extract_foreshadowing', 'request_cloud_ai']) {
  assert.match(toolFixture, new RegExp(name), `${name} must appear in tool-list fixture`);
}
for (const forbidden of ['shell', 'apply_patch', 'update_plan', 'git', 'PowerShell']) {
  assert.doesNotMatch(toolFixture, new RegExp(forbidden, 'i'), `${forbidden} must not appear in tool-list fixture`);
}
for (const command of ['summary', 'characters', 'foreshadow', 'timeline', 'cards']) {
  assert.match(zhCn, new RegExp(`ai\\.command\\.${command}\\.prompt[\\s\\S]*bookmind\\.ai\\.response\\.v2`), `zh-CN ${command} slash command must request renderable BookMind v2 JSON`);
  assert.match(enUs, new RegExp(`ai\\.command\\.${command}\\.prompt[\\s\\S]*bookmind\\.ai\\.response\\.v2`), `en-US ${command} slash command must request renderable BookMind v2 JSON`);
}
assert.match(flashcardMarkdown, /`Q`[\s\S]*`A`[\s\S]*`标签`[\s\S]*`引用来源`/, 'flashcard markdown fixture must cover Q/A/tag/source fallback input');
assert.doesNotThrow(() => JSON.parse(characterFixture), 'character response fixture must remain valid JSON');
assert.doesNotThrow(() => JSON.parse(timelineFixture), 'timeline response fixture must remain valid JSON');
assert.doesNotThrow(() => JSON.parse(foreshadowingFixture), 'foreshadowing response fixture must remain valid JSON');
assert.match(appStyles, /\.ai-companion-dock[\s\S]*grid-template-rows[\s\S]*max-block-size/, 'AI companion dock must have stable rows and a capped block size');
assert.match(appStyles, /\.ai-question-input[\s\S]*resize: none[\s\S]*overflow-y: auto/, 'AI question input must not resize the dock and must scroll internally');
assert.match(appStyles, /\.ai-send-stop-btn[\s\S]*width:\s*38px[\s\S]*height:\s*38px[\s\S]*border-radius:\s*50%[\s\S]*background:\s*var\(--amber\)/, 'AI send button must match v5 amber circular send/stop control');
assert.match(appStyles, /\.ai-attachment-add-btn[\s\S]*width:\s*34px[\s\S]*height:\s*34px/, 'AI attachment action must use one compact circular plus button');
assert.match(appStyles, /\.ai-bottom-toolbar[\s\S]*justify-content:\s*space-between/, 'AI bottom toolbar must keep plus/scope on the left and send on the far right');
assert.match(appStyles, /\.ai-scope-live-preview span[\s\S]*text-overflow: ellipsis[\s\S]*white-space: nowrap/, 'AI scope preview must stay on one line so it cannot resize the companion dock');
assert.match(appStyles, /\.ai-modifier-row[\s\S]*flex-wrap: nowrap[\s\S]*overflow-x: auto/, 'AI prompt modifiers must scroll horizontally instead of increasing the dock height');
assert.match(appStyles, /\.ai-slash-menu[\s\S]*max-block-size[\s\S]*overflow-y: auto/, 'slash command menu must be height-limited and vertically scrollable inside the panel');
assert.match(appStyles, /\.slash-command-card em[\s\S]*-webkit-line-clamp/, 'slash command prompt excerpts must be line-clamped so they do not overflow the panel');
assert.match(appStyles, /\.ai-slash-detail-popover[\s\S]*max-block-size[\s\S]*overflow: auto/, 'slash command right-click details must be scrollable without overflowing the menu');

const outDir = join(tmpdir(), `bookmind-ai-rendering-contracts-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/aiMarkdownFallback.ts',
  'src/services/aiResponseProtocol.ts',
], { cwd: process.cwd(), stdio: 'ignore' });
const { parseAiResponseProtocol } = await import(pathToFileURL(join(outDir, 'aiResponseProtocol.js')).href);
const parsedCharacterFixture = parseAiResponseProtocol(characterFixture);
const parsedTimelineFixture = parseAiResponseProtocol(timelineFixture);
const parsedForeshadowingFixture = parseAiResponseProtocol(foreshadowingFixture);
assert.ok(parsedCharacterFixture.blocks.some((block) => block.type === 'character_table'), 'character fixture must produce a character relationship block');
assert.ok(parsedTimelineFixture.blocks.some((block) => block.type === 'timeline'), 'timeline fixture must produce a timeline block');
assert.ok(parsedForeshadowingFixture.blocks.some((block) => block.type === 'foreshadowing_list'), 'foreshadowing fixture must produce a foreshadowing block');

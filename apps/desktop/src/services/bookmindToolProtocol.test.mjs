import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-tool-protocol-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/bookmindToolProtocol.ts',
  'src/services/aiResponseProtocol.ts',
  'src/services/aiMarkdownFallback.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { BOOKMIND_READER_TOOLS, buildToolCapabilityResponse, isToolCapabilityQuestion, assertNoDeveloperToolNames } = await import(pathToFileURL(join(outDir, 'bookmindToolProtocol.js')).href);
const { parseAiResponseProtocol } = await import(pathToFileURL(join(outDir, 'aiResponseProtocol.js')).href);

assert.equal(BOOKMIND_READER_TOOLS.length, 22, 'BookMind reader tool list should cover executable reading, chapter, evidence navigation, settings, and character tools');
assert.equal(isToolCapabilityQuestion('你可以调用哪些工具？'), true);
assert.equal(isToolCapabilityQuestion('总结当前章节'), false);

const response = buildToolCapabilityResponse({ mode: 'local', bookId: 'book-1' });
const parsed = parseAiResponseProtocol(response);
assert.equal(parsed.schema, 'bookmind.ai.response.v2');
assert.ok(parsed.blocks.some((block) => block.type === 'summary'));
assert.ok(parsed.blocks.some((block) => block.type === 'suggested_actions'));
const text = JSON.stringify(parsed);
for (const toolName of ['get_current_context', 'list_chapters', 'read_chapter', 'search_chapter_text', 'search_local_index', 'get_paragraph_window', 'read_paragraph_range', 'get_reader_settings', 'search_settings', 'update_reader_settings', 'get_character_index', 'track_character_growth', 'search_character_mentions', 'summarize_character_arc', 'jump_to_source', 'save_ai_note', 'save_citation_highlight', 'generate_flashcards', 'build_timeline', 'extract_characters', 'extract_foreshadowing', 'request_cloud_ai']) {
  assert.match(text, new RegExp(toolName), `${toolName} should be visible to users`);
}
for (const forbidden of ['shell', 'apply_patch', 'update_plan', 'git', 'PowerShell']) {
  assert.doesNotMatch(text, new RegExp(forbidden, 'i'), `${forbidden} must never appear in tool capability answers`);
}
assert.equal(assertNoDeveloperToolNames('get_current_context search_local_index'), true);
assert.equal(assertNoDeveloperToolNames('shell apply_patch'), false);

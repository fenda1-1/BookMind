import { existsSync, readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const protocolSource = readFileSync('src/services/aiResponseProtocol.ts', 'utf8');
const markdownFallbackSource = readFileSync('src/services/aiMarkdownFallback.ts', 'utf8');
const aiPanelSource = readFileSync('src/features/ai-reader/AiReaderPanel.tsx', 'utf8');
const structuredAnswerViewPath = 'src/features/ai-reader/AiStructuredAnswerView.tsx';
assert.ok(existsSync(structuredAnswerViewPath), 'AI structured answer rendering must live in AiStructuredAnswerView');
const structuredAnswerViewSource = readFileSync(structuredAnswerViewPath, 'utf8');
const structuredSectionRenderersPath = 'src/features/ai-reader/AiStructuredSectionRenderers.tsx';
assert.ok(existsSync(structuredSectionRenderersPath), 'AI structured section renderers must live in AiStructuredSectionRenderers');
const structuredSectionRenderersSource = readFileSync(structuredSectionRenderersPath, 'utf8');
const readerWorkspaceSource = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const aiReaderDomainEventsSource = readFileSync('src/features/ai-reader/aiReaderDomainEvents.ts', 'utf8');
const fixtureNames = readdirSync('src/tests/fixtures').filter((name) => name.startsWith('mock-ai-response.'));

assert.match(protocolSource, /BOOKMIND_AI_RESPONSE_SCHEMA_V2/, 'AI response protocol must define v2');
assert.match(protocolSource, /bookmind\.ai\.response\.v2/, 'AI response protocol parser must accept bookmind.ai.response.v2');
assert.match(protocolSource, /isSupportedAiResponseSchema/, 'unknown schema must be downgraded safely');
assert.match(protocolSource, /extractJsonFenceBodies/, 'Markdown fenced JSON sections must be parsed');
assert.match(protocolSource, /extractJsonObjectCandidates/, 'AI response parser must recover JSON objects embedded after prose prefixes');
assert.match(protocolSource, /unwrapStructuredResponseEnvelope/, 'AI response parser must unwrap nested schema-key envelopes such as {"bookmind.ai.response.v2": {...}}');
assert.match(protocolSource, /adaptLooseV2Response/, 'AI response parser must adapt loose v2 summary/references payloads into renderable blocks and citations');
assert.match(protocolSource, /looksLikeSchemaLessBookMindResponse/, 'AI response parser must recognize schema-less BookMind response objects');
assert.match(protocolSource, /major_events/, 'schema-less major_events must become visible summary blocks');
assert.match(protocolSource, /information_increment/, 'schema-less information_increment must become visible summary blocks');
assert.match(protocolSource, /character_state_changes/, 'schema-less character_state_changes must become visible character status blocks');
assert.match(protocolSource, /normalizeLooseCharacterBlocks/, 'loose character command JSON must become visible character relationship blocks');
assert.match(protocolSource, /normalizeLooseFlashcardBlocks/, 'loose flashcard command JSON must become visible flashcard blocks');
assert.match(protocolSource, /normalizeLooseTimelineBlocks/, 'loose timeline/key interaction JSON must become visible timeline blocks');
assert.match(protocolSource, /normalizeLooseForeshadowingBlocks/, 'loose foreshadowing/conflict JSON must become visible foreshadowing blocks');
assert.match(protocolSource, /normalizeLooseReferences/, 'loose v2 references must become protocol citations instead of being dropped');
assert.match(protocolSource, /parseAiMarkdownFallback/, 'parse failures must enter Markdown fallback rendering');
assert.match(protocolSource, /resolveBlockContent/, 'structured text blocks must normalize common content field aliases');
assert.match(protocolSource, /text:\s*'paragraph'/, 'text block types must route to the paragraph renderer');
assert.match(protocolSource, /createTopLevelTextFallback/, 'empty structured block arrays must fall back to top-level answer text');
assert.match(markdownFallbackSource, /parseAiMarkdownFallback/, 'Markdown fallback parser must exist');
assert.match(markdownFallbackSource, /flashcardFieldPattern/, 'Markdown fallback must recognize Q/A/tag/citation-source flashcards');
assert.match(markdownFallbackSource, /citation_group/, 'Markdown fallback must create citation_group candidates');
assert.match(markdownFallbackSource, /pending_binding/, 'unresolved citations must be marked as pending binding');
assert.match(protocolSource, /collapsed: true/, 'tool results must default to collapsed');

for (const blockType of [
  'summary',
  'heading',
  'paragraph',
  'bullet_list',
  'quote',
  'flashcards',
  'timeline',
  'character_table',
  'foreshadowing_list',
  'citation_group',
  'evidence_list',
  'diagnostics',
  'suggested_actions',
]) {
  assert.match(`${protocolSource}\n${aiPanelSource}\n${structuredAnswerViewSource}\n${structuredSectionRenderersSource}`, new RegExp(blockType), `${blockType} block must be defined or rendered`);
}

assert.match(aiPanelSource, /parseAiResponseProtocol\(answer\)/, 'AI panel must route normal Markdown through protocol fallback');
assert.match(structuredSectionRenderersSource, /ProtocolCitationCard/, 'protocol citations must have a dedicated card renderer');
assert.match(structuredSectionRenderersSource, /protocolCitationToReaderCitation/, 'protocol citations must map to reader jump targets');
assert.match(readerWorkspaceSource, /jumpToReaderLocation/, 'citation jumps must use a unified reader location jump path');
assert.match(aiReaderDomainEventsSource, /protocolJump:\s*'bookmind:ai-protocol-jump'/, 'protocol citation jumps must retain their compatible domain event name');
assert.match(structuredSectionRenderersSource, /emitAiProtocolJump\(readerCitation\)/, 'protocol citation renderers must publish typed reader jumps');
assert.match(readerWorkspaceSource, /subscribeAiProtocolJump\(onAiProtocolJump\)/, 'protocol citation jumps must be handled through the typed ReaderWorkspace subscription');

const v2Fixtures = fixtureNames.filter((name) => name.includes('.v2.'));
assert.ok(v2Fixtures.length >= 3, 'v2 fixtures must cover summary, flashcards, citations/tool answers');
for (const name of fixtureNames) {
  const raw = readFileSync(`src/tests/fixtures/${name}`, 'utf8').trim();
  if (name.endsWith('.json')) {
    const parsed = JSON.parse(raw);
    assert.ok(parsed.schema === 'bookmind.ai.response.v2' || parsed.schema === 'bookmind.ai.response.v1', `${name} must use a supported schema`);
    assert.ok(Array.isArray(parsed.blocks), `${name} must include blocks`);
    assert.ok(Array.isArray(parsed.citations), `${name} must include citations`);
    assert.ok(Array.isArray(parsed.toolCalls), `${name} must include toolCalls`);
    assert.ok(Array.isArray(parsed.toolResults), `${name} must include toolResults`);
    assert.ok(parsed.diagnostics && typeof parsed.diagnostics === 'object', `${name} must include diagnostics`);
    if (parsed.schema === 'bookmind.ai.response.v2') {
      for (const citation of parsed.citations) {
        assert.ok(citation.id, `${name} citation must have a stable id`);
        if (citation.type === 'chapter' || citation.type === 'paragraph' || citation.type === 'range') {
          assert.ok(citation.bookId, `${name} reader citation must include bookId`);
          assert.ok(citation.chapterId || Number.isFinite(citation.chapterIndex) || Number.isFinite(citation.sourceChapterIndex), `${name} reader citation must include chapter locator`);
          assert.ok(citation.snippet || citation.sourceText || citation.quote, `${name} reader citation must include source text`);
        }
      }
    }
  }
  if (name.includes('mixed-markdown-json')) {
    assert.match(raw, /```json[\s\S]*bookmind\.ai\.response\.v1[\s\S]*```/, `${name} must keep fenced JSON compatibility coverage`);
  }
  if (name.includes('parse-error-fallback')) {
    assert.doesNotMatch(raw, /^\s*\{/, `${name} must remain a non-JSON fallback fixture`);
  }
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-export-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterExportModel.ts',
  'src/types.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterExportModel,
  characterExportSchemaVersion,
} = require(join(outDir, 'features', 'characters', 'characterExportModel.js'));
const typesSource = require(join(outDir, 'types.js'));

assert.equal(characterExportSchemaVersion, 'bookmind.character-export.v1');
assert.equal(typeof typesSource, 'object', 'types.ts must compile with the public CharacterExportOptions contract');

const payload = createPayload();

const markdownExport = buildCharacterExportModel(payload, {
  format: 'markdown',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(markdownExport.schemaVersion, 'bookmind.character-export.v1');
assert.equal(markdownExport.files.length, 1);
assert.equal(markdownExport.files[0].fileName, 'book-1-characters.md');
assert.equal(markdownExport.files[0].mimeType, 'text/markdown;charset=utf-8');
assert.match(markdownExport.files[0].content, /^# 人物档案：斩神/m);
assert.match(markdownExport.files[0].content, /schemaVersion: bookmind\.character-export\.v1/);
assert.match(markdownExport.files[0].content, /## 人物/);
assert.match(markdownExport.files[0].content, /林七夜/);
assert.match(markdownExport.files[0].content, /别名：七夜、队长/);
assert.match(markdownExport.files[0].content, /## 关系/);
assert.match(markdownExport.files[0].content, /林七夜 -> 赵空城：师徒/);
assert.match(markdownExport.files[0].content, /## 证据/);
assert.match(markdownExport.files[0].content, /赵空城把刀递给林七夜/);
assert.doesNotMatch(markdownExport.files[0].content, /误识别项/, 'hidden profiles must be excluded by default');
assert.equal(markdownExport.counts.profiles, 3);
assert.equal(markdownExport.counts.relations, 2);
assert.equal(markdownExport.counts.evidence, 3);

const jsonExport = buildCharacterExportModel(payload, {
  format: 'json',
  onlyMajorCharacters: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(jsonExport.files.length, 1);
assert.equal(jsonExport.files[0].fileName, 'book-1-character-export.json');
const json = JSON.parse(jsonExport.files[0].content);
assert.equal(json.schemaVersion, 'bookmind.character-export.v1');
assert.equal(json.book.id, 'book-1');
assert.equal(json.generatedAt, '2026-06-11T01:02:03.000Z');
assert.deepEqual(json.profiles.map((item) => item.id), ['char-lqy']);
assert.deepEqual(json.relations, [], 'relations must be removed when one endpoint is outside the selected export scope');
assert.equal(json.evidence.length, 1);
assert.equal(json.counts.profiles, 1);
assert.equal(json.manifest.schemaVersion, 'bookmind.character-index.v1');
assert.equal(JSON.stringify(json).includes('C:\\\\secret'), false, 'exports must not include local file paths');

const privateJsonExport = buildCharacterExportModel(payload, {
  format: 'json',
  privacyMode: true,
  privateValue: '[已隐藏]',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const privateJson = JSON.parse(privateJsonExport.files[0].content);
assert.equal(privateJson.book.displayTitle, '[已隐藏]');
assert.equal(privateJson.manifest.bookTitle, '[已隐藏]', 'JSON privacy mode must sanitize manifest book title');
assert.equal(JSON.stringify(privateJson).includes('斩神'), false, 'JSON privacy mode must not leak the raw book title');
assert.equal(JSON.stringify(privateJson).includes('林七夜'), false, 'JSON privacy mode must not leak raw character names');
assert.equal(JSON.stringify(privateJson).includes('赵空城'), false, 'JSON privacy mode must not leak raw relation evidence names');

const csvExport = buildCharacterExportModel(payload, {
  format: 'csv',
  includeHidden: true,
  includeQuotes: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.deepEqual(csvExport.files.map((file) => file.fileName), [
  'book-1-character-profiles.csv',
  'book-1-character-relations.csv',
  'book-1-character-evidence.csv',
]);
assert.match(csvExport.files[0].content, /^id,displayName,kind,role,mentionCount,relationCount,importanceScore,confidence,source,firstAppearance,lastAppearance,tags,aliases,summary/m);
assert.match(csvExport.files[0].content, /char-zkc,赵空城,person,main,24,1,0\.74,0\.86,ai/);
assert.match(csvExport.files[1].content, /rel-1,char-lqy,char-zkc,mentor,"师徒,守护",directed,0\.91,ev-rel-1/);
assert.match(csvExport.files[2].content, /ev-rel-1,relation,rel-1,valid,0\.92,ai,第1章:段落6,bookmind:\/\/reader\/book-1\?chapter=1&paragraph=6&start=2&end=10&chunk=chunk-1,"关系证据","赵空城把刀递给林七夜。"/);
assert.match(csvExport.files[0].content, /char-hidden,误识别项,unknown,unknown/, 'includeHidden must allow hidden profiles to be exported intentionally');

const scopedPrivateExport = buildCharacterExportModel(payload, {
  format: 'markdown',
  selectedCharacterIds: ['char-lqy'],
  includeRelations: false,
  includeEvidence: true,
  includeQuotes: true,
  maxQuoteLength: 6,
  privacyMode: true,
  privateValue: '[已隐藏]',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(scopedPrivateExport.counts.profiles, 1);
assert.equal(scopedPrivateExport.counts.relations, 0);
assert.equal(scopedPrivateExport.counts.evidence, 1);
assert.match(scopedPrivateExport.files[0].content, /# 人物档案：\[已隐藏\]/);
assert.match(scopedPrivateExport.files[0].content, /- 名称：\[已隐藏\]/);
assert.match(scopedPrivateExport.files[0].content, /quote 已按隐私模式隐藏/);
assert.doesNotMatch(scopedPrivateExport.files[0].content, /林七夜/);
assert.doesNotMatch(scopedPrivateExport.files[0].content, /把刀递给/);
assert.doesNotMatch(scopedPrivateExport.files[0].content, /## 关系/);

const obsidianExport = buildCharacterExportModel(payload, {
  format: 'markdown',
  markdownStyle: 'obsidian',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.match(obsidianExport.files[0].content, /\[\[林七夜\]\]/, 'Obsidian style must wrap character names as wikilinks');
assert.match(obsidianExport.files[0].content, /\[\[赵空城\]\]/, 'Obsidian style must wrap relation endpoint names as wikilinks');
assert.match(obsidianExport.files[0].content, /- 别名：\[\[七夜\]\]、\[\[队长\]\]/, 'Obsidian style must wikilink aliases');

const logseqExport = buildCharacterExportModel(payload, {
  format: 'markdown',
  markdownStyle: 'logseq',
  selectedCharacterIds: ['char-lqy'],
  includeRelations: false,
  includeEvidence: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.match(logseqExport.files[0].content, /- 人物档案：斩神/);
assert.match(logseqExport.files[0].content, /\n\t- schemaVersion: bookmind\.character-export\.v1/);
assert.match(logseqExport.files[0].content, /\n\t- 人物\n\t\t- 林七夜/);
assert.match(logseqExport.files[0].content, /\n\t\t\t- 别名：七夜、队长/);
assert.doesNotMatch(logseqExport.files[0].content, /^# /m, 'Logseq style must use outline bullets instead of heading markdown');

const spoilerSafeExport = buildCharacterExportModel(payload, {
  format: 'json',
  spoilerLimit: { sourceChapterIndex: 1, paragraphIndex: 6 },
  includeMentions: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const spoilerSafeJson = JSON.parse(spoilerSafeExport.files[0].content);
assert.deepEqual(spoilerSafeJson.profiles.map((item) => item.id), ['char-lqy'], 'spoilerLimit must exclude characters first appearing after the reading position');
assert.deepEqual(spoilerSafeJson.relations, [], 'spoilerLimit must exclude relations first seen after the reading position');
assert.deepEqual(spoilerSafeJson.evidence.map((item) => item.id), ['ev-profile-1'], 'spoilerLimit must exclude future evidence records');
assert.deepEqual(spoilerSafeJson.mentions.map((item) => item.id), ['mention-1'], 'spoilerLimit must exclude future mentions');
assert.equal(JSON.stringify(spoilerSafeJson).includes('赵空城'), false, 'spoilerLimit must not leak future character names through scoped export payloads');
assert.equal(spoilerSafeJson.book.characterCount, 1, 'spoilerLimit must scope exported book character counts');
assert.equal(spoilerSafeJson.book.relationCount, 0, 'spoilerLimit must scope exported book relation counts');
assert.equal(spoilerSafeJson.book.evidenceCount, 1, 'spoilerLimit must scope exported book evidence counts');
assert.equal(spoilerSafeJson.manifest.characterCount, 1, 'spoilerLimit must scope exported manifest character counts');
assert.equal(spoilerSafeJson.manifest.aliasCount, 3, 'spoilerLimit must scope exported manifest alias counts');
assert.equal(spoilerSafeJson.manifest.mentionCount, 1, 'spoilerLimit must scope exported manifest mention counts');
assert.equal(spoilerSafeJson.manifest.relationCount, 0, 'spoilerLimit must scope exported manifest relation counts');
assert.equal(spoilerSafeJson.manifest.evidenceCount, 1, 'spoilerLimit must scope exported manifest evidence counts');
assert.equal(spoilerSafeJson.manifest.eventCount, 0, 'spoilerLimit must not export full-book event counts');
assert.equal(spoilerSafeJson.manifest.factionCount, 0, 'spoilerLimit must scope exported manifest faction counts');
assert.equal(spoilerSafeExport.counts.profiles, 1);
assert.equal(spoilerSafeExport.counts.relations, 0);
assert.equal(spoilerSafeExport.counts.evidence, 1);
assert.equal(spoilerSafeExport.counts.mentions, 1);

const spoilerSafeMarkdownExport = buildCharacterExportModel(payload, {
  format: 'markdown',
  spoilerLimit: { sourceChapterIndex: 1, paragraphIndex: 6 },
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.doesNotMatch(spoilerSafeMarkdownExport.files[0].content, /赵空城|未来人物/, 'spoilerLimit must apply before Markdown formatting');
assert.match(spoilerSafeMarkdownExport.files[0].content, /\[后文人物\]/, 'spoilerLimit must redact future names from surviving quotes');

const spoilerSafeCsvExport = buildCharacterExportModel(payload, {
  format: 'csv',
  spoilerLimit: { sourceChapterIndex: 1, paragraphIndex: 6 },
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(spoilerSafeCsvExport.files.map((file) => file.content).join('\n').includes('赵空城'), false, 'spoilerLimit must apply before CSV formatting');

const spoilerEdgePayload = createSpoilerEdgePayload();
const spoilerEdgeExport = buildCharacterExportModel(spoilerEdgePayload, {
  format: 'json',
  spoilerLimit: { sourceChapterIndex: 1, paragraphIndex: 5 },
  includeMentions: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const spoilerEdgeJson = JSON.parse(spoilerEdgeExport.files[0].content);
assert.deepEqual(spoilerEdgeJson.profiles.map((item) => item.id), ['edge-visible'], 'spoilerLimit must exclude profiles with missing or future firstAppearance');
assert.deepEqual(spoilerEdgeJson.relations, [], 'spoilerLimit must exclude relations with missing firstSeen/lastSeen');
assert.deepEqual(spoilerEdgeJson.evidence.map((item) => item.id), ['edge-evidence-visible'], 'spoilerLimit must not re-include future alias, future mention, or unknown-location evidence through payload fallbacks');
assert.deepEqual(spoilerEdgeJson.mentions.map((item) => item.id), ['edge-mention-visible'], 'spoilerLimit must exclude future mentions for otherwise visible characters');
assert.equal(JSON.stringify(spoilerEdgeJson).includes('夜神'), false, 'spoilerLimit must not leak future aliases of visible characters');

const paragraphOnlyExport = buildCharacterExportModel(createParagraphOnlySpoilerPayload(), {
  format: 'json',
  spoilerLimit: { paragraphIndex: 5 },
  includeMentions: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const paragraphOnlyJson = JSON.parse(paragraphOnlyExport.files[0].content);
assert.deepEqual(paragraphOnlyJson.profiles.map((item) => item.id), ['paragraph-before'], 'paragraph-only spoilerLimit must compare paragraphIndex even when locations include chapter numbers');
assert.deepEqual(paragraphOnlyJson.mentions.map((item) => item.id), ['paragraph-mention-before'], 'paragraph-only spoilerLimit must filter mentions by paragraphIndex');

const scopedPlainExport = buildCharacterExportModel(payload, {
  format: 'json',
  selectedCharacterIds: ['char-zkc'],
  includeRelations: false,
  includeEvidence: true,
  includeMentions: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const scopedPlainJson = JSON.parse(scopedPlainExport.files[0].content);
assert.deepEqual(scopedPlainJson.relations, []);
assert.deepEqual(scopedPlainJson.evidence, [], 'excluded relation evidence must not be exported for a selected single-character scope');
assert.equal(JSON.stringify(scopedPlainJson).includes('林七夜'), false, 'excluded relation evidence must not leak unselected character names');

const noEvidenceExport = buildCharacterExportModel(payload, {
  format: 'json',
  includeEvidence: false,
  includeMentions: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const noEvidenceJson = JSON.parse(noEvidenceExport.files[0].content);
assert.deepEqual(noEvidenceJson.evidence, []);
assert.deepEqual(noEvidenceJson.mentions, []);
assert.equal(noEvidenceExport.counts.evidence, 0);
assert.equal(noEvidenceExport.counts.mentions, 0);

const locationOnlyPayload = createPayload();
locationOnlyPayload.mentions[0] = {
  ...locationOnlyPayload.mentions[0],
  prefixText: '前文原句：林七夜停在门口。',
  suffixText: '后文原句：赵空城回头看他。',
};
const locationOnlyJsonExport = buildCharacterExportModel(locationOnlyPayload, {
  format: 'json',
  includeQuotes: false,
  includeMentions: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const locationOnlyJson = JSON.parse(locationOnlyJsonExport.files[0].content);
assert.equal(locationOnlyJson.evidence[0].quote, 'quote 未导出');
assert.equal(locationOnlyJson.evidence[0].locationLink, 'bookmind://reader/book-1?chapter=1&paragraph=6&start=2&end=10&chunk=chunk-1');
assert.equal(locationOnlyJson.mentions[0].quote, 'quote 未导出');
assert.equal(locationOnlyJson.mentions[0].prefixText, '');
assert.equal(locationOnlyJson.mentions[0].suffixText, '');
assert.equal(locationOnlyJson.mentions[0].locationLink, 'bookmind://reader/book-1?chapter=1&paragraph=6&start=2&end=10&chunk=chunk-1');
assert.equal(JSON.stringify(locationOnlyJson).includes('林七夜看着赵空城'), false, 'location-only JSON export must not leak mention quote text');
assert.equal(JSON.stringify(locationOnlyJson).includes('前文原句'), false, 'location-only JSON export must not leak mention prefix context');
assert.equal(JSON.stringify(locationOnlyJson).includes('后文原句'), false, 'location-only JSON export must not leak mention suffix context');

const locationOnlyMarkdownExport = buildCharacterExportModel(payload, {
  format: 'markdown',
  includeQuotes: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.match(locationOnlyMarkdownExport.files[0].content, /location: bookmind:\/\/reader\/book-1\?chapter=1&paragraph=6&start=2&end=10&chunk=chunk-1/);
assert.doesNotMatch(locationOnlyMarkdownExport.files[0].content, /赵空城把刀递给林七夜。/, 'location-only Markdown export must not leak evidence quote text');

const locationOnlyCsvExport = buildCharacterExportModel(payload, {
  format: 'csv',
  includeQuotes: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.match(locationOnlyCsvExport.files[2].content, /bookmind:\/\/reader\/book-1\?chapter=1&paragraph=6&start=2&end=10&chunk=chunk-1/);
assert.doesNotMatch(locationOnlyCsvExport.files[2].content, /赵空城把刀递给林七夜。/, 'location-only CSV export must not leak evidence quote text');

const relationsJsonExport = buildCharacterExportModel(payload, {
  format: 'relations-json',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(relationsJsonExport.files[0].fileName, 'book-1-character-relations.json');
assert.equal(relationsJsonExport.files[0].mimeType, 'application/json;charset=utf-8');
const relationsJson = JSON.parse(relationsJsonExport.files[0].content);
assert.equal(relationsJson.schemaVersion, 'bookmind.character-relations-export.v1');
assert.deepEqual(relationsJson.relations.map((item) => item.id), ['rel-1', 'rel-future']);
assert.equal(relationsJson.relations[0].sourceName, '林七夜');
assert.equal(relationsJson.relations[0].targetName, '赵空城');
assert.equal(relationsJson.evidenceByRelationId['rel-1'][0].id, 'ev-rel-1');
assert.equal(JSON.stringify(relationsJson).includes('C:\\\\secret'), false, 'relations JSON export must not include local paths');

const mentionsJsonlExport = buildCharacterExportModel(payload, {
  format: 'mentions-jsonl',
  includeMentions: true,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(mentionsJsonlExport.files[0].fileName, 'book-1-character-mentions.jsonl');
assert.equal(mentionsJsonlExport.files[0].mimeType, 'application/x-ndjson;charset=utf-8');
const mentionLines = mentionsJsonlExport.files[0].content.trim().split('\n').map((line) => JSON.parse(line));
assert.deepEqual(mentionLines.map((item) => item.id), ['mention-1', 'mention-2', 'mention-future']);
assert.equal(mentionLines[0].schemaVersion, 'bookmind.character-mention-row.v1');
assert.equal(mentionLines[0].characterName, '林七夜');
assert.equal(mentionLines[0].quote, '林七夜看着赵空城。');
assert.equal(JSON.stringify(mentionLines).includes('C:\\\\secret'), false, 'mentions JSONL export must not include local paths');

const mermaidExport = buildCharacterExportModel(payload, {
  format: 'mermaid',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(mermaidExport.files[0].fileName, 'book-1-character-graph.mmd');
assert.equal(mermaidExport.files[0].mimeType, 'text/vnd.mermaid;charset=utf-8');
assert.match(mermaidExport.files[0].content, /^---\ntitle: 人物关系：斩神\n---\ngraph LR/m);
assert.match(mermaidExport.files[0].content, /node_1_[a-z0-9]+\["林七夜"\]/i);
assert.match(mermaidExport.files[0].content, /node_1_[a-z0-9]+ -->\|"师徒,守护"\| node_2_[a-z0-9]+/i);
assert.doesNotMatch(mermaidExport.files[0].content, /误识别项/);

const graphmlExport = buildCharacterExportModel(payload, {
  format: 'graphml',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(graphmlExport.files[0].fileName, 'book-1-character-graph.graphml');
assert.equal(graphmlExport.files[0].mimeType, 'application/graphml+xml;charset=utf-8');
assert.match(graphmlExport.files[0].content, /<graphml xmlns="http:\/\/graphml\.graphdrawing\.org\/xmlns">/);
assert.match(graphmlExport.files[0].content, /<node id="char-lqy">/);
assert.match(graphmlExport.files[0].content, /<edge id="rel-1" source="char-lqy" target="char-zkc">/);
assert.doesNotMatch(graphmlExport.files[0].content, /误识别项/);

const cytoscapeExport = buildCharacterExportModel(payload, {
  format: 'cytoscape-json',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.equal(cytoscapeExport.files[0].fileName, 'book-1-character-cytoscape.json');
assert.equal(cytoscapeExport.files[0].mimeType, 'application/json;charset=utf-8');
const cytoscapeJson = JSON.parse(cytoscapeExport.files[0].content);
assert.equal(cytoscapeJson.schemaVersion, 'bookmind.character-cytoscape-export.v1');
assert.ok(cytoscapeJson.elements.nodes.some((item) => item.data.id === 'char-lqy' && item.data.label === '林七夜'));
assert.ok(cytoscapeJson.elements.edges.some((item) => item.data.id === 'rel-1' && item.data.source === 'char-lqy' && item.data.target === 'char-zkc'));
assert.equal(JSON.stringify(cytoscapeJson).includes('误识别项'), false, 'Cytoscape export must respect default hidden filtering');

const graphEdgePayload = createGraphEdgePayload();
const collisionMermaidExport = buildCharacterExportModel(graphEdgePayload, {
  format: 'mermaid',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.match(collisionMermaidExport.files[0].content, /node_1_[a-z0-9]+/i, 'Mermaid export must generate unique safe ids instead of normalizing raw ids directly');
assert.match(collisionMermaidExport.files[0].content, /node_2_[a-z0-9]+/i, 'Mermaid export must keep colliding raw ids as separate nodes');
assert.doesNotMatch(collisionMermaidExport.files[0].content, /node_1_[^\n]*\n\s*node_1_/, 'Mermaid safe ids must not collide inside one export');
assert.doesNotMatch(collisionMermaidExport.files[0].content, /\|"[^"]*\|[^"]*"\|/, 'Mermaid edge labels must remove pipe delimiters from labels');

const undirectedGraphmlExport = buildCharacterExportModel(graphEdgePayload, {
  format: 'graphml',
  generatedAt: '2026-06-11T01:02:03.000Z',
});
assert.match(undirectedGraphmlExport.files[0].content, /<key id="generatedAt" for="graph" attr\.name="generatedAt" attr\.type="string"\/>/, 'GraphML export must declare every graph data key it uses');
assert.match(undirectedGraphmlExport.files[0].content, /<key id="direction" for="edge" attr\.name="direction" attr\.type="string"\/>/, 'GraphML export must declare relation direction');
assert.match(undirectedGraphmlExport.files[0].content, /<edge id="graph-rel-1" source="char-a" target="char_a" directed="false">/, 'GraphML export must preserve undirected relations per edge');
assert.match(undirectedGraphmlExport.files[0].content, /盟友 &amp; 守护 &lt;A&gt;/, 'GraphML export must XML-escape labels');

const noEvidenceRelationsExport = buildCharacterExportModel(payload, {
  format: 'relations-json',
  includeEvidence: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const noEvidenceRelationsJson = JSON.parse(noEvidenceRelationsExport.files[0].content);
assert.deepEqual(noEvidenceRelationsJson.relations.map((item) => item.evidenceIds), [[], []], 'relations JSON must clear evidenceIds when includeEvidence is false');
assert.deepEqual(noEvidenceRelationsJson.evidenceByRelationId, {}, 'relations JSON must not export evidence maps when includeEvidence is false');

const noEvidenceCytoscapeExport = buildCharacterExportModel(payload, {
  format: 'cytoscape-json',
  includeEvidence: false,
  generatedAt: '2026-06-11T01:02:03.000Z',
});
const noEvidenceCytoscapeJson = JSON.parse(noEvidenceCytoscapeExport.files[0].content);
assert.ok(noEvidenceCytoscapeJson.elements.edges.every((item) => item.data.evidenceIds.length === 0), 'Cytoscape export must clear edge evidenceIds when includeEvidence is false');

for (const graphFormat of ['relations-json', 'mentions-jsonl', 'mermaid', 'graphml', 'cytoscape-json']) {
  const scopedGraphExport = buildCharacterExportModel(payload, {
    format: graphFormat,
    selectedCharacterIds: ['char-lqy'],
    spoilerLimit: { sourceChapterIndex: 1, paragraphIndex: 6 },
    includeMentions: true,
    privacyMode: true,
    privateValue: '[已隐藏]',
    generatedAt: '2026-06-11T01:02:03.000Z',
  });
  const scopedGraphText = scopedGraphExport.files.map((file) => file.content).join('\n');
  assert.equal(scopedGraphText.includes('林七夜'), false, `${graphFormat} must respect privacyMode`);
  assert.equal(scopedGraphText.includes('赵空城'), false, `${graphFormat} must respect spoilerLimit and selectedCharacterIds`);
  assert.equal(scopedGraphText.includes('未来人物'), false, `${graphFormat} must not leak future characters`);
  assert.equal(scopedGraphText.includes('C:\\\\secret'), false, `${graphFormat} must not leak local file paths`);
}

const emptyExport = buildCharacterExportModel(null, { format: 'json' });
assert.equal(emptyExport.files.length, 0);
assert.deepEqual(emptyExport.counts, { profiles: 0, relations: 0, evidence: 0, mentions: 0 });
assert.deepEqual(emptyExport.warnings, ['missing-payload']);

function createPayload() {
  const baseLocation = {
    bookId: 'book-1',
    chapterId: 'chapter-1',
    sourceChapterIndex: 1,
    chapterTitle: '第1章',
    paragraphIndex: 6,
    startOffset: 2,
    endOffset: 10,
    chunkId: 'chunk-1',
  };
  return {
    book: {
      id: 'book-1',
      title: '斩神',
      displayTitle: '斩神',
      author: '三九音域',
      fileName: 'zhan-shen.txt',
      filePath: 'C:\\secret\\zhan-shen.txt',
      coverTone: 'indigo',
      progress: 42,
      textIndexStatus: 'ready',
      textIndexReady: true,
      textIndexChunkCount: 100,
      textIndexFtsRows: 100,
      characterIndexStatus: 'ready',
      characterCount: 2,
      relationCount: 1,
      evidenceCount: 2,
      lastCharacterBuiltAt: '2026-06-11T00:00:00.000Z',
      staleReason: '',
      lastError: '',
      lastTaskId: '',
      errorCode: '',
      errorStage: '',
      recentLogEntry: '',
    },
    manifest: {
      schemaVersion: 'bookmind.character-index.v1',
      bookId: 'book-1',
      bookTitle: '斩神',
      contentHash: 'content-hash',
      textIndexContentHash: 'text-index-hash',
      indexVersion: 3,
      chunkStrategyVersion: 2,
      chapterRuleVersion: 1,
      status: 'ready',
      extractionMode: 'rule-ai',
      builtAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T00:00:00.000Z',
      staleReason: '',
      lastError: '',
      characterCount: 2,
      aliasCount: 3,
      mentionCount: 48,
      relationCount: 1,
      evidenceCount: 2,
      eventCount: 0,
      factionCount: 0,
      sourceTextIndex: {
        status: 'ready',
        builtAt: '2026-06-11T00:00:00.000Z',
        chunkCount: 100,
        ftsRowCount: 100,
      },
    },
    profiles: [
      createProfile('char-lqy', '林七夜', 'protagonist', 42, 0.98, ['七夜', '队长'], '主角，守夜人。', false),
      createProfile('char-zkc', '赵空城', 'main', 24, 0.86, ['老赵'], '守护沧南的前辈。', false, { sourceChapterIndex: 2, paragraphIndex: 8 }),
      createProfile('char-future', '未来人物', 'supporting', 8, 0.78, ['后来者'], '后文才出现的人物。', false, { sourceChapterIndex: 5, paragraphIndex: 1 }),
      createProfile('char-hidden', '误识别项', 'unknown', 1, 0.2, [], '需要隐藏的低质量候选。', true, { sourceChapterIndex: 6, paragraphIndex: 1 }),
    ],
    mentions: [
      { id: 'mention-1', bookId: 'book-1', characterId: 'char-lqy', aliasId: 'char-lqy-alias-main', name: '林七夜', normalizedName: '林七夜', location: baseLocation, quote: '林七夜看着赵空城。', prefixText: '', suffixText: '', contextHash: 'mh1', confidence: 0.98, source: 'rule', createdAt: '2026-06-11T00:00:00.000Z' },
      { id: 'mention-2', bookId: 'book-1', characterId: 'char-zkc', aliasId: 'char-zkc-alias-main', name: '赵空城', normalizedName: '赵空城', location: { ...baseLocation, paragraphIndex: 7 }, quote: '赵空城把刀递给林七夜。', prefixText: '', suffixText: '', contextHash: 'mh2', confidence: 0.96, source: 'ai', createdAt: '2026-06-11T00:00:00.000Z' },
      { id: 'mention-future', bookId: 'book-1', characterId: 'char-future', aliasId: 'char-future-alias-main', name: '未来人物', normalizedName: '未来人物', location: { ...baseLocation, sourceChapterIndex: 5, chapterTitle: '第5章', paragraphIndex: 1 }, quote: '未来人物终于出现。', prefixText: '', suffixText: '', contextHash: 'mh3', confidence: 0.9, source: 'ai', createdAt: '2026-06-11T00:00:00.000Z' },
    ],
    relations: [
      {
        id: 'rel-1',
        bookId: 'book-1',
        sourceCharacterId: 'char-lqy',
        targetCharacterId: 'char-zkc',
        relationType: 'mentor',
        label: '师徒,守护',
        summary: '赵空城引导林七夜。',
        direction: 'directed',
        confidence: 0.91,
        evidenceIds: ['ev-rel-1'],
        firstSeen: baseLocation,
        lastSeen: { ...baseLocation, paragraphIndex: 7 },
        status: 'active',
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
      },
      {
        id: 'rel-future',
        bookId: 'book-1',
        sourceCharacterId: 'char-lqy',
        targetCharacterId: 'char-future',
        relationType: 'future',
        label: '后文相遇',
        summary: '后文关系。',
        direction: 'directed',
        confidence: 0.8,
        evidenceIds: ['ev-future'],
        firstSeen: { ...baseLocation, sourceChapterIndex: 5, chapterTitle: '第5章', paragraphIndex: 1 },
        lastSeen: { ...baseLocation, sourceChapterIndex: 5, chapterTitle: '第5章', paragraphIndex: 2 },
        status: 'active',
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
      },
    ],
    evidence: [
      {
        id: 'ev-profile-1',
        bookId: 'book-1',
        targetType: 'profile',
        targetId: 'char-lqy',
        claim: '林七夜是主角。',
        quote: '林七夜在雨中睁开眼，看见赵空城拔刀。',
        location: baseLocation,
        evidenceHash: 'eh1',
        confidence: 0.95,
        source: 'ai',
        status: 'valid',
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
      },
      {
        id: 'ev-rel-1',
        bookId: 'book-1',
        targetType: 'relation',
        targetId: 'rel-1',
        claim: '关系证据',
        quote: '赵空城把刀递给林七夜。',
        location: baseLocation,
        evidenceHash: 'eh2',
        confidence: 0.92,
        source: 'ai',
        status: 'valid',
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
      },
      {
        id: 'ev-future',
        bookId: 'book-1',
        targetType: 'relation',
        targetId: 'rel-future',
        claim: '后文证据',
        quote: '未来人物与林七夜在第五章相遇。',
        location: { ...baseLocation, sourceChapterIndex: 5, chapterTitle: '第5章', paragraphIndex: 1 },
        evidenceHash: 'eh3',
        confidence: 0.82,
        source: 'ai',
        status: 'valid',
        createdAt: '2026-06-11T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
      },
    ],
    events: [],
    factionMemberships: [],
    appearanceStats: [],
    loadedAt: '2026-06-11T00:00:00.000Z',
  };
}

function createProfile(id, name, role, mentionCount, confidence, aliasNames, summary, hidden, locationOverrides = {}) {
  const firstLocation = { bookId: 'book-1', chapterId: 'chapter-1', sourceChapterIndex: 1, chapterTitle: '第1章', paragraphIndex: 2, startOffset: 0, endOffset: 3, ...locationOverrides };
  return {
    id,
    bookId: 'book-1',
    canonicalName: name,
    displayName: name,
    kind: id === 'char-hidden' ? 'unknown' : 'person',
    role,
    aliases: [
      { id: `${id}-alias-main`, bookId: 'book-1', characterId: id, name, normalizedName: name, kind: 'name', source: 'rule', confidence, mentionCount, createdAt: '2026-06-11T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z' },
      ...aliasNames.map((alias, index) => ({ id: `${id}-alias-${index}`, bookId: 'book-1', characterId: id, name: alias, normalizedName: alias, kind: 'nickname', source: 'ai', confidence: 0.8, mentionCount: 1, createdAt: '2026-06-11T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z' })),
    ],
    summary,
    tags: id === 'char-lqy' ? ['守夜人', '神明代理人'] : [],
    importanceScore: id === 'char-lqy' ? 0.99 : id === 'char-zkc' ? 0.74 : 0.1,
    confidence,
    firstAppearance: firstLocation,
    lastAppearance: { ...firstLocation, startOffset: 4, endOffset: 8 },
    mentionCount,
    relationCount: id === 'char-hidden' ? 0 : 1,
    eventCount: 0,
    factionMemberships: [],
    hidden,
    source: id === 'char-lqy' ? 'rule' : 'ai',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };
}

function createSpoilerEdgePayload() {
  const baseLocation = {
    bookId: 'book-edge',
    chapterId: 'chapter-1',
    sourceChapterIndex: 1,
    chapterTitle: '第1章',
    paragraphIndex: 2,
    startOffset: 0,
    endOffset: 3,
    chunkId: 'chunk-edge-1',
  };
  const futureLocation = {
    ...baseLocation,
    chapterId: 'chapter-3',
    sourceChapterIndex: 3,
    chapterTitle: '第3章',
    paragraphIndex: 1,
    chunkId: 'chunk-edge-3',
  };
  const visibleProfile = createEdgeProfile('edge-visible', '可见人', baseLocation, [
    { id: 'edge-visible-alias-future', bookId: 'book-edge', characterId: 'edge-visible', name: '夜神', normalizedName: '夜神', kind: 'nickname', source: 'ai', confidence: 0.8, mentionCount: 1, firstSeen: futureLocation, createdAt: '', updatedAt: '' },
  ]);
  const unknownProfile = createEdgeProfile('edge-unknown', '未知位置人', undefined, []);
  return {
    book: createEdgeBookSummary('book-edge'),
    manifest: createEdgeManifest('book-edge'),
    profiles: [visibleProfile, unknownProfile],
    mentions: [
      { id: 'edge-mention-visible', bookId: 'book-edge', characterId: 'edge-visible', aliasId: 'edge-visible-alias-main', name: '可见人', normalizedName: '可见人', location: baseLocation, quote: '可见人来到这里。', prefixText: '', suffixText: '', contextHash: 'edge-m1', confidence: 0.9, source: 'rule', createdAt: '' },
      { id: 'edge-mention-future', bookId: 'book-edge', characterId: 'edge-visible', aliasId: 'edge-visible-alias-future', name: '夜神', normalizedName: '夜神', location: futureLocation, quote: '夜神在后文登场。', prefixText: '', suffixText: '', contextHash: 'edge-m2', confidence: 0.9, source: 'ai', createdAt: '' },
    ],
    relations: [
      { id: 'edge-relation-unknown', bookId: 'book-edge', sourceCharacterId: 'edge-visible', targetCharacterId: 'edge-visible', relationType: 'unknown-time', label: '未知时间关系', summary: '缺少位置的关系', direction: 'undirected', confidence: 0.8, evidenceIds: [], status: 'unknown', createdAt: '', updatedAt: '' },
    ],
    evidence: [
      { id: 'edge-evidence-visible', bookId: 'book-edge', targetType: 'profile', targetId: 'edge-visible', claim: '可见人已出现。', quote: '可见人来到这里。', location: baseLocation, evidenceHash: 'edge-e1', confidence: 0.9, source: 'ai', status: 'valid', createdAt: '', updatedAt: '' },
      { id: 'edge-evidence-future-alias', bookId: 'book-edge', targetType: 'alias', targetId: 'edge-visible-alias-future', claim: '未来别名。', quote: '夜神在后文登场。', location: baseLocation, evidenceHash: 'edge-e2', confidence: 0.9, source: 'ai', status: 'valid', createdAt: '', updatedAt: '' },
      { id: 'edge-evidence-future-mention', bookId: 'book-edge', targetType: 'mention', targetId: 'edge-mention-future', claim: '未来 mention。', quote: '夜神在后文登场。', location: baseLocation, evidenceHash: 'edge-e3', confidence: 0.9, source: 'ai', status: 'valid', createdAt: '', updatedAt: '' },
      { id: 'edge-evidence-unknown-location', bookId: 'book-edge', targetType: 'profile', targetId: 'edge-visible', claim: '未知位置证据。', quote: '这条证据缺少可比较位置。', location: { bookId: 'book-edge', chunkId: 'chunk-edge-unknown' }, evidenceHash: 'edge-e4', confidence: 0.9, source: 'ai', status: 'valid', createdAt: '', updatedAt: '' },
    ],
    events: [],
    factionMemberships: [],
    appearanceStats: [],
    loadedAt: '',
  };
}

function createParagraphOnlySpoilerPayload() {
  const beforeLocation = { bookId: 'book-paragraph', chapterId: 'chapter-8', sourceChapterIndex: 8, chapterTitle: '第8章', paragraphIndex: 4, startOffset: 0, endOffset: 3, chunkId: 'chunk-p4' };
  const afterLocation = { ...beforeLocation, chapterId: 'chapter-1', sourceChapterIndex: 1, chapterTitle: '第1章', paragraphIndex: 6, chunkId: 'chunk-p6' };
  return {
    book: createEdgeBookSummary('book-paragraph'),
    manifest: createEdgeManifest('book-paragraph'),
    profiles: [
      createEdgeProfile('paragraph-before', '段落前人物', beforeLocation, []),
      createEdgeProfile('paragraph-after', '段落后人物', afterLocation, []),
    ],
    mentions: [
      { id: 'paragraph-mention-before', bookId: 'book-paragraph', characterId: 'paragraph-before', aliasId: 'paragraph-before-alias-main', name: '段落前人物', normalizedName: '段落前人物', location: beforeLocation, quote: '段落前人物出现。', prefixText: '', suffixText: '', contextHash: 'p1', confidence: 0.9, source: 'rule', createdAt: '' },
      { id: 'paragraph-mention-after', bookId: 'book-paragraph', characterId: 'paragraph-after', aliasId: 'paragraph-after-alias-main', name: '段落后人物', normalizedName: '段落后人物', location: afterLocation, quote: '段落后人物出现。', prefixText: '', suffixText: '', contextHash: 'p2', confidence: 0.9, source: 'rule', createdAt: '' },
    ],
    relations: [],
    evidence: [],
    events: [],
    factionMemberships: [],
    appearanceStats: [],
    loadedAt: '',
  };
}

function createEdgeBookSummary(id) {
  return {
    id,
    title: id,
    displayTitle: id,
    author: '',
    fileName: `${id}.txt`,
    progress: 0,
    textIndexStatus: 'ready',
    textIndexReady: true,
    textIndexChunkCount: 10,
    textIndexFtsRows: 10,
    characterIndexStatus: 'ready',
    characterCount: 2,
    relationCount: 1,
    evidenceCount: 4,
    lastCharacterBuiltAt: '',
    staleReason: '',
    lastError: '',
    lastTaskId: '',
    errorCode: '',
    errorStage: '',
    recentLogEntry: '',
  };
}

function createEdgeManifest(bookId) {
  return {
    schemaVersion: 'bookmind.character-index.v1',
    bookId,
    bookTitle: bookId,
    contentHash: 'hash',
    textIndexContentHash: 'text-hash',
    indexVersion: 1,
    chunkStrategyVersion: 1,
    chapterRuleVersion: 1,
    status: 'ready',
    extractionMode: 'rule',
    builtAt: '',
    updatedAt: '',
    staleReason: '',
    lastError: '',
    characterCount: 2,
    aliasCount: 3,
    mentionCount: 2,
    relationCount: 1,
    evidenceCount: 4,
    eventCount: 0,
    factionCount: 0,
    sourceTextIndex: { status: 'ready', builtAt: '', chunkCount: 10, ftsRowCount: 10 },
  };
}

function createEdgeProfile(id, name, firstAppearance, extraAliases) {
  return {
    id,
    bookId: firstAppearance?.bookId ?? 'book-edge',
    canonicalName: name,
    displayName: name,
    kind: 'person',
    role: 'main',
    aliases: [
      { id: `${id}-alias-main`, bookId: firstAppearance?.bookId ?? 'book-edge', characterId: id, name, normalizedName: name, kind: 'name', source: 'rule', confidence: 0.9, mentionCount: 1, firstSeen: firstAppearance, createdAt: '', updatedAt: '' },
      ...extraAliases,
    ],
    summary: `${name}摘要`,
    tags: [],
    importanceScore: 0.8,
    confidence: 0.9,
    firstAppearance,
    lastAppearance: firstAppearance,
    mentionCount: 1,
    relationCount: 0,
    eventCount: 0,
    factionMemberships: [],
    hidden: false,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function createGraphEdgePayload() {
  const location = {
    bookId: 'book-graph',
    chapterId: 'chapter-1',
    sourceChapterIndex: 1,
    chapterTitle: '第1章',
    paragraphIndex: 1,
    startOffset: 0,
    endOffset: 4,
    chunkId: 'chunk-graph-1',
  };
  return {
    book: createEdgeBookSummary('book-graph'),
    manifest: createEdgeManifest('book-graph'),
    profiles: [
      createEdgeProfile('char-a', '甲', location, []),
      createEdgeProfile('char_a', '乙', location, []),
    ],
    mentions: [],
    relations: [
      {
        id: 'graph-rel-1',
        bookId: 'book-graph',
        sourceCharacterId: 'char-a',
        targetCharacterId: 'char_a',
        relationType: 'ally',
        label: '盟友 & 守护 <A>|B',
        summary: '用于测试图导出转义。',
        direction: 'undirected',
        confidence: 0.88,
        evidenceIds: ['graph-evidence-1'],
        firstSeen: location,
        lastSeen: location,
        status: 'active',
        createdAt: '',
        updatedAt: '',
      },
    ],
    evidence: [
      { id: 'graph-evidence-1', bookId: 'book-graph', targetType: 'relation', targetId: 'graph-rel-1', claim: '图证据', quote: '甲与乙结盟。', location, evidenceHash: 'graph-e1', confidence: 0.9, source: 'ai', status: 'valid', createdAt: '', updatedAt: '' },
    ],
    events: [],
    factionMemberships: [],
    appearanceStats: [],
    loadedAt: '',
  };
}

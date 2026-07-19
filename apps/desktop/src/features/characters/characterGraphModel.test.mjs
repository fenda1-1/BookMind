import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-graph-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterGraphModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterGraphModel, resolveCharacterGraphPanelState } = require(join(outDir, 'features', 'characters', 'characterGraphModel.js'));

const profiles = [
  profile('char-1', '林七夜', 0.9),
  profile('char-2', '李医生', 0.7),
  profile('char-3', '赵空城', 0.8),
  { ...profile('org-1', '守夜人', 0.6), kind: 'organization' },
  { ...profile('faction-1', '斋戒所', 0.55), kind: 'faction' },
  { ...profile('place-1', '沧南市', 0.5), kind: 'place' },
  { ...profile('artifact-1', '星辰刀', 0.4), kind: 'artifact' },
  { ...profile('unknown-1', '未知存在', 0.3), kind: 'unknown' },
  { ...profile('char-hidden', '隐藏人物', 0.2), hidden: true },
];

const relations = [
  relation('relation-2', 'char-2', 'char-1', 'treats', '治疗', 'directed', ['evidence-2'], 0.7),
  relation('relation-1', 'char-1', 'char-2', 'treats', '治疗', 'directed', ['evidence-1'], 0.8),
  relation('relation-1b', 'char-1', 'char-2', 'treats', '治疗', 'directed', ['evidence-1b'], 0.6),
  relation('relation-3', 'char-1', 'char-3', 'ally', '盟友', 'undirected', ['evidence-3'], 0.9),
  relation('relation-org', 'char-1', 'org-1', 'member', '成员', 'directed', ['evidence-org'], 0.72),
  relation('relation-faction', 'char-1', 'faction-1', 'belongs', '阵营', 'directed', ['evidence-faction'], 0.7),
  relation('relation-place', 'char-1', 'place-1', 'arrives', '到达', 'directed', ['evidence-place'], 0.68),
  relation('relation-artifact', 'char-1', 'artifact-1', 'owns', '持有', 'directed', ['evidence-artifact'], 0.66),
  relation('relation-unknown', 'char-1', 'unknown-1', 'encounters', '遭遇', 'directed', ['evidence-unknown'], 0.64),
  relation('relation-hidden', 'char-1', 'char-hidden', 'unknown', '隐藏', 'undirected', ['evidence-hidden'], 0.4),
  relation('relation-missing', 'char-1', 'missing-character', 'unknown', '缺失', 'undirected', ['evidence-missing'], 0.4),
];

const graph = buildCharacterGraphModel(profiles, relations);

assert.deepEqual(graph.nodes.map((item) => item.id), ['char-1', 'char-3', 'char-2', 'org-1', 'faction-1', 'place-1', 'artifact-1', 'unknown-1'], 'nodes should be sorted by importance, then name, and exclude hidden profiles');
assert.deepEqual(graph.nodes.map((item) => item.label), ['林七夜', '赵空城', '李医生', '守夜人', '斋戒所', '沧南市', '星辰刀', '未知存在']);
assert.equal(graph.nodes[0].mentionCount, 9);
assert.equal(graph.nodes[0].relationCount, 3);
assert.deepEqual(
  graph.nodes.map((item) => [item.id, item.visual.group, item.visual.shape, item.visual.marker, item.visual.labelKey]),
  [
    ['char-1', 'person', 'circle', 'P', 'characters.profileKind.person'],
    ['char-3', 'person', 'circle', 'P', 'characters.profileKind.person'],
    ['char-2', 'person', 'circle', 'P', 'characters.profileKind.person'],
    ['org-1', 'organization', 'hexagon', 'O', 'characters.profileKind.organization'],
    ['faction-1', 'faction', 'shield', 'F', 'characters.profileKind.faction'],
    ['place-1', 'place', 'pin', 'L', 'characters.profileKind.place'],
    ['artifact-1', 'artifact', 'diamond', 'A', 'characters.profileKind.artifact'],
    ['unknown-1', 'unknown', 'square', '?', 'characters.profileKind.unknown'],
  ],
  'graph nodes should expose stable visual groups, shapes, markers, and localized label keys for relation graph rendering',
);

assert.deepEqual(graph.edges.map((item) => item.id), ['char-1->artifact-1::owns', 'char-1->char-2::treats', 'char-1--char-3::ally', 'char-1->faction-1::belongs', 'char-1->org-1::member', 'char-1->place-1::arrives', 'char-1->unknown-1::encounters', 'char-2->char-1::treats']);

const mergedEdge = graph.edges.find((item) => item.id === 'char-1->char-2::treats');
assert.ok(mergedEdge, 'expected merged treats edge');
assert.equal(mergedEdge.sourceId, 'char-1');
assert.equal(mergedEdge.targetId, 'char-2');
assert.equal(mergedEdge.direction, 'directed');
assert.equal(mergedEdge.relationType, 'treats');
assert.equal(mergedEdge.weight, 2);
assert.equal(mergedEdge.confidence, 0.8);
assert.deepEqual(mergedEdge.relationIds, ['relation-1', 'relation-1b']);
assert.deepEqual(mergedEdge.evidenceIds, ['evidence-1', 'evidence-1b']);

const undirectedEdge = graph.edges.find((item) => item.id === 'char-1--char-3::ally');
assert.ok(undirectedEdge, 'expected undirected ally edge');
assert.equal(undirectedEdge.sourceId, 'char-1');
assert.equal(undirectedEdge.targetId, 'char-3');
assert.equal(undirectedEdge.direction, 'undirected');

assert.equal(graph.summary.nodeCount, 8);
assert.equal(graph.summary.edgeCount, 8);
assert.equal(graph.summary.relationCount, 9);
assert.equal(graph.summary.hiddenRelationCount, 2);

const filteredGraph = buildCharacterGraphModel(profiles, relations, { includeHiddenProfiles: true });
assert.ok(filteredGraph.nodes.some((item) => item.id === 'char-hidden'), 'includeHiddenProfiles should include hidden profile nodes');
assert.ok(filteredGraph.edges.some((item) => item.id === 'char-1--char-hidden::unknown'), 'includeHiddenProfiles should include hidden-profile relations');

const typeFilteredGraph = buildCharacterGraphModel(profiles, relations, { relationTypes: ['ally'] });
assert.deepEqual(typeFilteredGraph.edges.map((item) => item.relationType), ['ally'], 'relationTypes should keep only matching relation types');
assert.equal(typeFilteredGraph.summary.relationCount, 1);
assert.equal(typeFilteredGraph.summary.filteredRelationCount, 8);
assert.equal(typeFilteredGraph.summary.hiddenRelationCount, 2);

const confidenceFilteredGraph = buildCharacterGraphModel(profiles, relations, { minConfidence: 0.8 });
assert.deepEqual(confidenceFilteredGraph.edges.map((item) => item.id), ['char-1->char-2::treats', 'char-1--char-3::ally'], 'minConfidence should drop lower-confidence visible relations');
assert.equal(confidenceFilteredGraph.edges[0].weight, 1, 'minConfidence should be applied before merging duplicate relation edges');
assert.equal(confidenceFilteredGraph.summary.relationCount, 2);
assert.equal(confidenceFilteredGraph.summary.filteredRelationCount, 7);
assert.equal(confidenceFilteredGraph.summary.hiddenRelationCount, 2);

const combinedFilteredGraph = buildCharacterGraphModel(profiles, relations, { relationTypes: ['treats'], minConfidence: 0.75 });
assert.deepEqual(combinedFilteredGraph.edges.map((item) => item.id), ['char-1->char-2::treats'], 'relation type and confidence filters should compose before edge merging');
assert.equal(combinedFilteredGraph.summary.relationCount, 1);
assert.equal(combinedFilteredGraph.summary.filteredRelationCount, 8);

const chapterRelations = [
  relation('chapter-relation-early', 'char-1', 'char-2', 'treats', '治疗', 'directed', ['chapter-evidence-early'], 0.82, { sourceChapterIndex: 0 }),
  relation('chapter-relation-span', 'char-1', 'char-3', 'ally', '盟友', 'undirected', ['chapter-evidence-span'], 0.8, { sourceChapterIndex: 2 }, { sourceChapterIndex: 5 }),
  relation('chapter-relation-late', 'char-2', 'char-3', 'reports', '汇报', 'directed', ['chapter-evidence-late'], 0.78, { sourceChapterIndex: 8 }),
  relation('chapter-relation-unknown', 'char-1', 'org-1', 'member', '成员', 'directed', ['chapter-evidence-unknown'], 0.72),
];

const middleChapterGraph = buildCharacterGraphModel(profiles, chapterRelations, { chapterRange: { startChapterIndex: 2, endChapterIndex: 4 } });
assert.deepEqual(middleChapterGraph.edges.map((item) => item.id), ['char-1--char-3::ally'], 'chapterRange should keep relations whose first/last chapter span intersects the selected range');
assert.equal(middleChapterGraph.summary.relationCount, 1);
assert.equal(middleChapterGraph.summary.filteredRelationCount, 3);

const reversedChapterGraph = buildCharacterGraphModel(profiles, chapterRelations, { chapterRange: { startChapterIndex: 4, endChapterIndex: 2 } });
assert.deepEqual(reversedChapterGraph.edges.map((item) => item.id), middleChapterGraph.edges.map((item) => item.id), 'chapterRange should normalize reversed start and end values');

const openEndedChapterGraph = buildCharacterGraphModel(profiles, chapterRelations, { chapterRange: { startChapterIndex: 6 } });
assert.deepEqual(openEndedChapterGraph.edges.map((item) => item.id), ['char-2->char-3::reports'], 'open-ended chapterRange should keep only relations on or after the start chapter');

const focusRelations = [
  relation('focus-root', 'char-1', 'char-2', 'ally', '盟友', 'undirected', ['focus-evidence-root'], 0.9, { sourceChapterIndex: 1 }),
  relation('focus-direct-third', 'char-1', 'char-3', 'guards', '守护', 'directed', ['focus-evidence-direct-third'], 0.83, { sourceChapterIndex: 1 }),
  relation('focus-second', 'char-2', 'char-3', 'reports', '汇报', 'directed', ['focus-evidence-second'], 0.72, { sourceChapterIndex: 2 }),
  relation('focus-second-org', 'char-2', 'org-1', 'member', '成员', 'directed', ['focus-evidence-org'], 0.78, { sourceChapterIndex: 3 }),
  relation('focus-second-cross', 'char-3', 'org-1', 'cooperates', '协作', 'undirected', ['focus-evidence-cross'], 0.7, { sourceChapterIndex: 4 }),
  relation('focus-third', 'org-1', 'place-1', 'located', '驻地', 'directed', ['focus-evidence-third'], 0.76, { sourceChapterIndex: 4 }),
  relation('focus-hidden', 'char-2', 'char-hidden', 'unknown', '隐藏', 'undirected', ['focus-evidence-hidden'], 0.82, { sourceChapterIndex: 2 }),
];

const oneHopFocusGraph = buildCharacterGraphModel(profiles, focusRelations, { focusCharacterId: 'char-1', focusDepth: 1 });
assert.deepEqual(oneHopFocusGraph.nodes.map((item) => item.id), ['char-1', 'char-3', 'char-2'], 'focusDepth 1 should keep only the focused character and direct neighbors');
assert.deepEqual(oneHopFocusGraph.edges.map((item) => item.id), ['char-1--char-2::ally', 'char-1->char-3::guards'], 'focusDepth 1 should keep only edges incident to the focused character, not edges between direct neighbors');
assert.equal(oneHopFocusGraph.summary.focusFilteredRelationCount, 4);
assert.equal(oneHopFocusGraph.summary.hiddenRelationCount, 1);

const twoHopFocusGraph = buildCharacterGraphModel(profiles, focusRelations, { focusCharacterId: 'char-1', focusDepth: 2 });
assert.deepEqual(twoHopFocusGraph.nodes.map((item) => item.id), ['char-1', 'char-3', 'char-2', 'org-1'], 'focusDepth 2 should keep the focused character, first-hop nodes, and second-hop nodes');
assert.deepEqual(
  twoHopFocusGraph.edges.map((item) => item.id),
  ['char-1--char-2::ally', 'char-1->char-3::guards', 'char-2->char-3::reports', 'char-2->org-1::member', 'char-3--org-1::cooperates'],
  'focusDepth 2 should keep relations inside the two-hop network and exclude third-hop relations',
);
assert.equal(twoHopFocusGraph.summary.focusFilteredRelationCount, 1);
assert.equal(twoHopFocusGraph.summary.focusFilteredNodeCount, 4);

const noFocusGraph = buildCharacterGraphModel(profiles, focusRelations, { focusDepth: 1 });
assert.ok(noFocusGraph.nodes.some((item) => item.id === 'place-1'), 'focusDepth without focusCharacterId should keep the global relationship graph');
assert.ok(noFocusGraph.edges.some((item) => item.id === 'org-1->place-1::located'), 'focusDepth without focusCharacterId should not filter global edges');

const confidenceFocusGraph = buildCharacterGraphModel(profiles, focusRelations, { focusCharacterId: 'char-1', focusDepth: 2, minConfidence: 0.75 });
assert.deepEqual(confidenceFocusGraph.nodes.map((item) => item.id), ['char-1', 'char-3', 'char-2', 'org-1'], 'focus expansion should happen after confidence filtering');
assert.deepEqual(confidenceFocusGraph.edges.map((item) => item.id), ['char-1--char-2::ally', 'char-1->char-3::guards', 'char-2->org-1::member'], 'focus graph should compose with confidence filters');

const relationTypeFocusGraph = buildCharacterGraphModel(profiles, focusRelations, { focusCharacterId: 'char-1', focusDepth: 2, relationTypes: ['ally'] });
assert.deepEqual(relationTypeFocusGraph.nodes.map((item) => item.id), ['char-1', 'char-2'], 'focus expansion should happen after relation type filtering');
assert.deepEqual(relationTypeFocusGraph.edges.map((item) => item.id), ['char-1--char-2::ally']);

const chapterFocusGraph = buildCharacterGraphModel(profiles, focusRelations, {
  focusCharacterId: 'char-1',
  focusDepth: 2,
  chapterRange: { startChapterIndex: 1, endChapterIndex: 2 },
});
assert.deepEqual(chapterFocusGraph.nodes.map((item) => item.id), ['char-1', 'char-3', 'char-2'], 'focus expansion should happen after chapter range filtering');
assert.deepEqual(chapterFocusGraph.edges.map((item) => item.id), ['char-1--char-2::ally', 'char-1->char-3::guards', 'char-2->char-3::reports']);

const invalidFocusGraph = buildCharacterGraphModel(profiles, focusRelations, { focusCharacterId: 'char-hidden', focusDepth: 1 });
assert.deepEqual(invalidFocusGraph.nodes.map((item) => item.id), [], 'hidden focused characters should not expand when hidden profiles are excluded');
assert.deepEqual(invalidFocusGraph.edges.map((item) => item.id), []);

assert.deepEqual(
  resolveCharacterGraphPanelState({ hasPayload: false, centerStateId: 'character-index-building' }),
  {
    status: 'loading',
    reason: 'character-index-loading',
    titleKey: 'characters.graphStatus.loadingTitle',
    bodyKey: 'characters.graphStatus.loadingBody',
    renderGraph: false,
  },
  'relationship graph should expose a loading state while character extraction is queued or running',
);
assert.deepEqual(
  resolveCharacterGraphPanelState({ hasPayload: false, centerStateId: 'character-index-failed' }),
  {
    status: 'error',
    reason: 'character-index-error',
    titleKey: 'characters.graphStatus.errorTitle',
    bodyKey: 'characters.graphStatus.errorBody',
    renderGraph: false,
  },
  'relationship graph should expose an error state when character extraction failed',
);

const noRelationGraphState = resolveCharacterGraphPanelState({
  hasPayload: true,
  graph: buildCharacterGraphModel(profiles, []),
  relationCount: 0,
  focusMode: 'all',
});
assert.equal(noRelationGraphState.reason, 'no-relationships', 'ready payloads with no relations need a specific empty graph reason');
assert.equal(noRelationGraphState.titleKey, 'characters.graphStatus.emptyTitle');
assert.equal(noRelationGraphState.renderGraph, false);

const filteredEmptyGraphState = resolveCharacterGraphPanelState({
  hasPayload: true,
  graph: buildCharacterGraphModel(profiles, relations, { relationTypes: ['missing-type'] }),
  relationCount: relations.length,
  focusMode: 'all',
});
assert.equal(filteredEmptyGraphState.reason, 'filtered-empty', 'relationship graph filters need a specific empty result reason');
assert.equal(filteredEmptyGraphState.titleKey, 'characters.graphStatus.filteredEmptyTitle');

const focusEmptyGraphState = resolveCharacterGraphPanelState({
  hasPayload: true,
  graph: buildCharacterGraphModel([...profiles, profile('char-isolated', '独行者', 0.1)], relations, { focusCharacterId: 'char-isolated', focusDepth: 1 }),
  relationCount: relations.length,
  focusMode: 'one-hop',
  selectedCharacterId: 'char-isolated',
});
assert.equal(focusEmptyGraphState.reason, 'focus-empty', 'selected characters without one-hop/two-hop relations need a focused empty state');
assert.equal(focusEmptyGraphState.titleKey, 'characters.graphStatus.focusEmptyTitle');

const largeProfiles = Array.from({ length: 205 }, (_, index) => profile(`large-char-${index + 1}`, `人物${index + 1}`, 1 - (index / 300)));
const largeRelations = [
  relation('large-relation-visible', 'large-char-1', 'large-char-2', 'ally', '盟友', 'undirected', ['large-evidence-visible'], 0.9),
  relation('large-relation-hidden-node', 'large-char-1', 'large-char-205', 'mentions', '提及', 'directed', ['large-evidence-hidden'], 0.7),
];
const largeGraph = buildCharacterGraphModel(largeProfiles, largeRelations, { maxNodes: 200 });
assert.equal(largeGraph.nodes.length, 205, 'relationship graph must keep every filtered node even when legacy maxNodes is passed');
assert.equal(largeGraph.summary.nodeCount, 205);
assert.equal(largeGraph.summary.totalNodeCount, 205);
assert.equal(largeGraph.summary.aggregatedNodeCount, 0);
assert.deepEqual(largeGraph.edges.map((item) => item.id), ['large-char-1--large-char-2::ally', 'large-char-1->large-char-205::mentions'], 'relationship graph must keep edges attached to every filtered node');
assert.equal(largeGraph.summary.aggregatedRelationCount, 0);
assert.equal(largeGraph.summary.relationCount, 2);

const noCapLargeGraph = buildCharacterGraphModel(largeProfiles, largeRelations, { maxNodes: 0 });
assert.equal(noCapLargeGraph.nodes.length, 205, 'maxNodes 0 should disable large graph aggregation for explicit full-graph views');
assert.equal(noCapLargeGraph.summary.aggregatedNodeCount, 0);

const filteredLargeGraph = buildCharacterGraphModel(largeProfiles, largeRelations, { maxNodes: 200, relationTypes: ['ally'] });
assert.equal(filteredLargeGraph.summary.aggregatedRelationCount, 0, 'maxNodes aggregation should count only relations that pass relation type filters');
assert.equal(filteredLargeGraph.summary.filteredRelationCount, 1);

const confidenceFilteredLargeGraph = buildCharacterGraphModel(largeProfiles, largeRelations, { maxNodes: 200, minConfidence: 0.8 });
assert.equal(confidenceFilteredLargeGraph.summary.aggregatedRelationCount, 0, 'maxNodes aggregation should count only relations that pass confidence filters');
assert.equal(confidenceFilteredLargeGraph.summary.filteredRelationCount, 1);

const aggregatedEmptyGraphState = resolveCharacterGraphPanelState({
  hasPayload: true,
  graph: buildCharacterGraphModel(largeProfiles, largeRelations, { maxNodes: 1 }),
  relationCount: largeRelations.length,
  focusMode: 'all',
});
assert.equal(aggregatedEmptyGraphState.reason, 'ready', 'legacy maxNodes must not create an aggregated empty state');
assert.equal(aggregatedEmptyGraphState.renderGraph, true);

const readyGraphState = resolveCharacterGraphPanelState({
  hasPayload: true,
  graph: buildCharacterGraphModel(profiles, relations),
  relationCount: relations.length,
  focusMode: 'all',
});
assert.equal(readyGraphState.status, 'ready');
assert.equal(readyGraphState.renderGraph, true);

function profile(id, displayName, importanceScore) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: displayName,
    displayName,
    kind: 'person',
    role: 'supporting',
    aliases: [],
    summary: '',
    tags: [],
    importanceScore,
    confidence: importanceScore,
    mentionCount: Math.round(importanceScore * 10),
    relationCount: Math.round(importanceScore * 3),
    eventCount: 0,
    factionMemberships: [],
    hidden: false,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function relation(id, sourceCharacterId, targetCharacterId, relationType, label, direction, evidenceIds, confidence, firstSeen, lastSeen) {
  return {
    id,
    bookId: 'book-1',
    sourceCharacterId,
    targetCharacterId,
    relationType,
    label,
    summary: '',
    direction,
    confidence,
    evidenceIds,
    firstSeen,
    lastSeen,
    status: 'active',
    createdAt: '',
    updatedAt: '',
  };
}

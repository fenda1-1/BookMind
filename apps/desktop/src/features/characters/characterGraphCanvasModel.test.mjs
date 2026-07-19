import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-graph-canvas-model-test-${process.pid}`);
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
  'src/features/characters/characterGraphCanvasModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterGraphModel } = require(join(outDir, 'features', 'characters', 'characterGraphModel.js'));
const {
  applyCharacterGraphCanvasViewportAction,
  buildCharacterGraphCanvasModel,
  buildCharacterGraphCanvasViewport,
} = require(join(outDir, 'features', 'characters', 'characterGraphCanvasModel.js'));

const profiles = [
  profile('char-1', '林七夜', 0.95),
  profile('char-2', '李医生', 0.85),
  profile('char-3', '赵空城', 0.75),
  profile('char-4', '吴湘南', 0.65),
  profile('char-5', '红缨', 0.55),
  profile('char-6', '冷轩', 0.45),
  profile('char-7', '超长名称角色会被截断', 0.35),
];

const relations = [
  relation('relation-1', 'char-1', 'char-2', 'treats', '治疗', 'directed', 0.9),
  relation('relation-2', 'char-1', 'char-3', 'ally', '盟友', 'undirected', 0.82),
  relation('relation-3', 'char-2', 'char-4', 'knows', '认识', 'directed', 0.72),
  relation('relation-4', 'char-3', 'char-5', 'guards', '守护', 'directed', 0.68),
  relation('relation-5', 'char-4', 'char-6', 'works-with', '协作', 'undirected', 0.61),
  relation('relation-6', 'char-6', 'char-7', 'mentions', '提及', 'directed', 0.5),
];

const graph = buildCharacterGraphModel(profiles, relations);
const canvas = buildCharacterGraphCanvasModel(graph, { width: 960, height: 360, maxNodes: 6, maxEdges: 8 });

assert.ok(canvas.width >= 960);
assert.ok(canvas.height >= 360);
assert.equal(canvas.viewBox, `0 0 ${canvas.width} ${canvas.height}`);
assert.equal(canvas.nodes.length, 6, 'canvas model should honor maxNodes to keep relationship previews bounded');
assert.equal(canvas.summary.hiddenNodeCount, 1);
assert.ok(canvas.summary.visibleEdgeCount <= 8, 'canvas model should honor maxEdges to keep relationship previews bounded');
assert.equal(canvas.summary.visibleEdgeCount, canvas.edges.length);
assert.ok(canvas.nodes.every((node) => node.x >= 0 && node.x <= canvas.width && node.y >= 0 && node.y <= canvas.height), 'node positions should stay inside the generated graph world');
assert.ok(canvas.edges.every((edge) => canvas.nodes.some((node) => node.id === edge.sourceId) && canvas.nodes.some((node) => node.id === edge.targetId)), 'canvas edges should only connect visible nodes');
assert.ok(canvas.nodes.every((node) => node.displayLabel.length <= 12), 'display labels should be bounded so long names cannot resize nodes');
assert.ok(canvas.nodes.every((node) => Number.isInteger(node.communityId) && node.communityId >= 0), 'each canvas node must expose a topology community id');
assert.ok(canvas.nodes.every((node) => node.labelTier >= 1 && node.labelTier <= 4 && node.showLabelAtScale >= 0.15), 'each canvas node must expose label tier metadata');
assert.ok(canvas.edges.every((edge) => Number.isFinite(edge.controlX) && Number.isFinite(edge.controlY) && edge.alpha > 0 && edge.alpha <= 1), 'each canvas edge must expose curved-edge and alpha metadata');
assert.equal(canvas.layout.algorithm, 'starfield-force-v2');

const readablePreviewGraph = buildCharacterGraphModel(
  [
    ...Array.from({ length: 10 }, (_, index) => profile(`preview-main-${index}`, `主线人物${index}`, 0.95 - index * 0.02)),
    profile('preview-side-a', '旁支甲', 0.4),
    profile('preview-side-b', '旁支乙', 0.38),
    profile('preview-isolated', '孤立人物', 0.2),
  ],
  [
    ...Array.from({ length: 9 }, (_, index) => relation(`preview-chain-${index}`, `preview-main-${index}`, `preview-main-${index + 1}`, 'ally', '同盟', 'undirected', 0.86)),
    ...Array.from({ length: 7 }, (_, index) => relation(`preview-hub-${index}`, 'preview-main-0', `preview-main-${index + 2}`, 'co-occurrence', '共现', 'undirected', 0.56)),
    relation('preview-side-edge', 'preview-side-a', 'preview-side-b', 'ally', '同盟', 'undirected', 0.91),
  ],
);
const readablePreviewCanvas = buildCharacterGraphCanvasModel(readablePreviewGraph, { width: 960, height: 360, viewMode: 'full' });
assert.deepEqual(
  readablePreviewCanvas.nodes.map((node) => node.id).sort(),
  Array.from({ length: 10 }, (_, index) => `preview-main-${index}`).sort(),
  'default relationship star map should render the readable main component and keep side/isolated characters out of the canvas',
);
assert.ok(readablePreviewCanvas.edges.length < readablePreviewGraph.edges.length, 'default relationship star map should use preview-style skeleton edges instead of drawing every weak edge');
assert.equal(readablePreviewCanvas.summary.hiddenNodeCount, 3, 'canvas summary should count hidden side-component and isolated nodes');
assert.ok(readablePreviewCanvas.summary.hiddenEdgeCount >= 1, 'canvas summary should count side-component and skeleton-filtered hidden edges');

const previewSearchGraph = buildCharacterGraphModel(
  [
    profileWithMention('search-root', '林七夜', 0.9, 180),
    profileWithMention('search-direct', '赵空城', 0.8, 70),
    profileWithMention('search-second', '红缨', 0.7, 45),
    profileWithMention('search-side-a', '旁支甲', 0.6, 18),
    profileWithMention('search-side-b', '旁支乙', 0.58, 14),
    profileWithMention('search-isolated', '无关系人物', 0.2, 1),
  ],
  [
    relation('search-edge-1', 'search-root', 'search-direct', 'ally', '同盟', 'undirected', 0.92),
    relation('search-edge-2', 'search-direct', 'search-second', 'co-occurrence', '共现', 'undirected', 0.74),
    relation('search-side-edge', 'search-side-a', 'search-side-b', 'ally', '同盟', 'undirected', 0.91),
  ],
);
const oneHopSearchCanvas = buildCharacterGraphCanvasModel(previewSearchGraph, { searchQuery: '林七夜', neighborDepth: 1, edgeMode: 'all' });
assert.deepEqual(
  oneHopSearchCanvas.nodes.map((node) => node.id).sort(),
  ['search-direct', 'search-root'],
  'preview-style search should keep matching characters plus direct neighbors only at depth 1',
);
const twoHopSearchCanvas = buildCharacterGraphCanvasModel(previewSearchGraph, { searchQuery: '林七夜', neighborDepth: 2, edgeMode: 'all' });
assert.deepEqual(
  twoHopSearchCanvas.nodes.map((node) => node.id).sort(),
  ['search-direct', 'search-root', 'search-second'],
  'preview-style search should expand to second-hop neighbors when depth is 2',
);
const allDepthCanvas = buildCharacterGraphCanvasModel(previewSearchGraph, { neighborDepth: 'all', edgeMode: 'all' });
assert.deepEqual(
  allDepthCanvas.nodes.map((node) => node.id).sort(),
  ['search-direct', 'search-root', 'search-second', 'search-side-a', 'search-side-b'],
  'preview all-depth mode should show every connected character and keep isolated characters out of the main star map',
);
const semanticSearchCanvas = buildCharacterGraphCanvasModel(previewSearchGraph, { searchQuery: '林七夜', neighborDepth: 2, edgeMode: 'semantic' });
assert.deepEqual(
  semanticSearchCanvas.edges.map((edge) => edge.relationType),
  ['ally'],
  'semantic edge mode should hide weak co-occurrence edges from the preview-style star map',
);

const mentionSizedGraph = buildCharacterGraphModel(
  [
    profileWithMention('mention-high', '高频人物', 0.5, 400),
    profileWithMention('mention-low', '低频人物', 0.5, 4),
    profileWithMention('mention-hub', '连接人物', 0.5, 40),
  ],
  [
    relation('mention-edge-high', 'mention-high', 'mention-hub', 'ally', '同盟', 'undirected', 0.9),
    relation('mention-edge-low', 'mention-low', 'mention-hub', 'ally', '同盟', 'undirected', 0.9),
  ],
);
const mentionSizedCanvas = buildCharacterGraphCanvasModel(mentionSizedGraph, { edgeMode: 'all' });
const highMentionNode = mentionSizedCanvas.nodes.find((node) => node.id === 'mention-high');
const lowMentionNode = mentionSizedCanvas.nodes.find((node) => node.id === 'mention-low');
assert.ok(highMentionNode && lowMentionNode, 'mention-sized graph should render both comparable nodes');
assert.ok(
  highMentionNode.radius > lowMentionNode.radius + 7,
  `node radius should scale with character mention count; high=${highMentionNode.radius}, low=${lowMentionNode.radius}`,
);

const longNameGraph = buildCharacterGraphModel(
  profiles.map((item) => item.id === 'char-1' ? { ...item, displayName: `${item.displayName}${item.displayName}${item.displayName}${item.displayName}${item.displayName}` } : item),
  relations,
);
const longNameCanvas = buildCharacterGraphCanvasModel(longNameGraph, { width: 960, height: 360, maxNodes: 6, maxEdges: 8 });

assert.deepEqual(
  longNameCanvas.nodes.map((node) => [node.id, node.x, node.y]),
  canvas.nodes.map((node) => [node.id, node.x, node.y]),
  'long node names must not change fixed graph coordinates',
);
assert.deepEqual(
  longNameCanvas.edges.map((edge) => [edge.id, edge.x1, edge.y1, edge.x2, edge.y2]),
  canvas.edges.map((edge) => [edge.id, edge.x1, edge.y1, edge.x2, edge.y2]),
  'long node names must not change fixed edge coordinates',
);
assert.ok(longNameCanvas.nodes.some((node) => node.displayLabel.endsWith('...')), 'long node labels should be truncated with an ASCII marker');

const emptyCanvas = buildCharacterGraphCanvasModel({ nodes: [], edges: [], summary: { nodeCount: 0, edgeCount: 0, relationCount: 0, hiddenRelationCount: 0, filteredRelationCount: 0 } });
assert.ok(emptyCanvas.width >= 960);
assert.ok(emptyCanvas.height >= 360);
assert.deepEqual(emptyCanvas.nodes, []);
assert.deepEqual(emptyCanvas.edges, []);

const largeCommunityGraph = buildCharacterGraphModel(
  [
    ...Array.from({ length: 18 }, (_, index) => profile(`alpha-${index}`, `甲组${index}`, 0.95 - index * 0.01)),
    ...Array.from({ length: 18 }, (_, index) => profile(`beta-${index}`, `乙组${index}`, 0.75 - index * 0.01)),
  ],
  [
    ...Array.from({ length: 17 }, (_, index) => relation(`alpha-chain-${index}`, `alpha-${index}`, `alpha-${index + 1}`, 'ally', '同盟', 'undirected', 0.85)),
    ...Array.from({ length: 17 }, (_, index) => relation(`beta-chain-${index}`, `beta-${index}`, `beta-${index + 1}`, 'enemy', '敌对', 'undirected', 0.8)),
    relation('bridge', 'alpha-0', 'beta-0', 'knows', '认识', 'undirected', 0.55),
  ],
);
const largeCommunityCanvas = buildCharacterGraphCanvasModel(largeCommunityGraph, { width: 960, height: 360 });
assert.ok(largeCommunityCanvas.width > 960, 'large graphs must get a larger world width instead of being squeezed into the viewport');
assert.ok(largeCommunityCanvas.height > 360, 'large graphs must get a larger world height instead of being squeezed into the viewport');
assert.equal(largeCommunityCanvas.summary.hiddenNodeCount, 0);
assert.equal(largeCommunityCanvas.summary.hiddenEdgeCount, 0);
assert.equal(largeCommunityCanvas.layout.algorithm, 'starfield-force-v2');
assert.ok(largeCommunityCanvas.width >= 1800, 'starfield layout must allocate enough horizontal world space for readable zoom inspection');
assert.ok(largeCommunityCanvas.height >= 1100, 'starfield layout must allocate enough vertical world space for readable zoom inspection');

const alphaCenter = centerOf(largeCommunityCanvas.nodes.filter((node) => node.id.startsWith('alpha-')));
const betaCenter = centerOf(largeCommunityCanvas.nodes.filter((node) => node.id.startsWith('beta-')));
const communityDistance = Math.hypot(alphaCenter.x - betaCenter.x, alphaCenter.y - betaCenter.y);
assert.ok(communityDistance >= 240, 'weakly bridged communities should be separated spatially');

const overlappingPair = closestNodePairDistance(largeCommunityCanvas.nodes);
assert.ok(overlappingPair.distance >= 28, `starfield layout should run stronger node collision avoidance; closest pair ${overlappingPair.left?.id}/${overlappingPair.right?.id} was ${overlappingPair.distance}`);

const denseMutualExclusionGraph = buildCharacterGraphModel(
  Array.from({ length: 220 }, (_, index) => profileWithMention(
    `dense-${index}`,
    `密集人物${index}`,
    0.95 - (index % 40) * 0.01,
    24 + (index % 12) * 9,
  )),
  [
    ...Array.from({ length: 219 }, (_, index) => relation(`dense-chain-${index}`, `dense-${index}`, `dense-${index + 1}`, 'ally', '同盟', 'undirected', 0.86)),
    ...Array.from({ length: 180 }, (_, index) => relation(`dense-spoke-${index}`, `dense-${index % 20}`, `dense-${20 + index}`, 'co-occurrence', '共现', 'undirected', 0.72)),
    ...Array.from({ length: 80 }, (_, index) => relation(`dense-cross-${index}`, `dense-${index}`, `dense-${219 - index}`, 'enemy', '敌对', 'undirected', 0.8)),
  ],
);
const denseMutualExclusionCanvas = buildCharacterGraphCanvasModel(denseMutualExclusionGraph, { edgeMode: 'all', neighborDepth: 'all' });
const closestDensePair = closestNodePairRadiusGap(denseMutualExclusionCanvas.nodes);
assert.ok(
  closestDensePair.gap >= 12,
  `dense starfield nodes must be mutually exclusive; closest pair ${closestDensePair.left?.id}/${closestDensePair.right?.id} gap was ${closestDensePair.gap}`,
);

const budgetedDenseCanvas = buildCharacterGraphCanvasModel(denseMutualExclusionGraph, { maxNodes: 80, maxEdges: 120 });
assert.ok(budgetedDenseCanvas.nodes.length <= 80, `budgeted starfield should cap nodes; rendered=${budgetedDenseCanvas.nodes.length}`);
assert.ok(budgetedDenseCanvas.edges.length <= 120, `budgeted starfield should cap edges; rendered=${budgetedDenseCanvas.edges.length}`);
assert.ok(budgetedDenseCanvas.summary.hiddenNodeCount >= denseMutualExclusionGraph.nodes.length - 80, 'budgeted starfield should report hidden nodes from node capping');

const budgetedAllEdgesCanvas = buildCharacterGraphCanvasModel(denseMutualExclusionGraph, { edgeMode: 'all', neighborDepth: 'all', maxNodes: 80, maxEdges: 120 });
assert.ok(budgetedAllEdgesCanvas.nodes.length <= 80, `all-edge starfield should still cap nodes; rendered=${budgetedAllEdgesCanvas.nodes.length}`);
assert.ok(budgetedAllEdgesCanvas.edges.length <= 120, `all-edge starfield should still cap edges; rendered=${budgetedAllEdgesCanvas.edges.length}`);

const budgetedSearchCanvas = buildCharacterGraphCanvasModel(denseMutualExclusionGraph, { searchQuery: '密集人物', neighborDepth: 'all', edgeMode: 'all', maxNodes: 45, maxEdges: 70 });
assert.ok(budgetedSearchCanvas.nodes.length <= 45, `searched starfield should cap expanded neighbors; rendered=${budgetedSearchCanvas.nodes.length}`);
assert.ok(budgetedSearchCanvas.edges.length <= 70, `searched starfield should cap expanded edges; rendered=${budgetedSearchCanvas.edges.length}`);

const lowZoomLabels = largeCommunityCanvas.nodes.filter((node) => node.showLabelAtScale <= 0.8);
assert.ok(lowZoomLabels.length < largeCommunityCanvas.nodes.length / 2, 'low zoom must not ask the renderer to draw every label');

const coreLabels = largeCommunityCanvas.nodes.filter((node) => node.labelTier === 1);
assert.ok(coreLabels.length > 0, 'layout should keep a small tier-1 label set for core characters');

const defaultViewport = buildCharacterGraphCanvasViewport();
assert.deepEqual(defaultViewport, {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  transform: 'translate(0 0) scale(1)',
});

const zoomedInViewport = applyCharacterGraphCanvasViewportAction(defaultViewport, 'zoom-in');
assert.deepEqual(zoomedInViewport, {
  scale: 1.5,
  offsetX: 0,
  offsetY: 0,
  transform: 'translate(0 0) scale(1.5)',
});

const pannedViewport = applyCharacterGraphCanvasViewportAction(zoomedInViewport, 'pan-right');
assert.deepEqual(pannedViewport, {
  scale: 1.5,
  offsetX: 56,
  offsetY: 0,
  transform: 'translate(56 0) scale(1.5)',
});

const clampedZoomInViewport = Array.from({ length: 20 }).reduce(
  (viewport) => applyCharacterGraphCanvasViewportAction(viewport, 'zoom-in'),
  defaultViewport,
);
assert.ok(clampedZoomInViewport.scale > 8, 'zoom-in should support deep starfield inspection beyond the old 800% cap');
const deepZoomViewport = buildCharacterGraphCanvasViewport({ scale: 18 });
assert.equal(deepZoomViewport.scale, 18, 'starfield zoom should allow very deep label inspection beyond 800%');
const maxZoomViewport = Array.from({ length: 160 }).reduce(
  (viewport) => applyCharacterGraphCanvasViewportAction(viewport, 'zoom-in'),
  defaultViewport,
);
assert.equal(maxZoomViewport.scale, 64, 'zoom-in should clamp at the preview star map deep inspection limit');

const clampedZoomOutViewport = Array.from({ length: 20 }).reduce(
  (viewport) => applyCharacterGraphCanvasViewportAction(viewport, 'zoom-out'),
  defaultViewport,
);
assert.equal(clampedZoomOutViewport.scale, 0.04, 'zoom-out should match the preview star map full-map overview limit');

const clampedPanViewport = Array.from({ length: 20 }).reduce(
  (viewport) => applyCharacterGraphCanvasViewportAction(viewport, 'pan-left'),
  defaultViewport,
);
assert.equal(clampedPanViewport.offsetX, -1120, 'keyboard panning should allow traversing large graphs');

assert.deepEqual(
  applyCharacterGraphCanvasViewportAction(pannedViewport, 'reset'),
  defaultViewport,
  'reset should restore the default graph canvas viewport',
);

function profile(id, displayName, importanceScore) {
  return profileWithMention(id, displayName, importanceScore, Math.round(importanceScore * 10));
}

function profileWithMention(id, displayName, importanceScore, mentionCount) {
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
    mentionCount,
    relationCount: Math.round(importanceScore * 3),
    eventCount: 0,
    factionMemberships: [],
    hidden: false,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function relation(id, sourceCharacterId, targetCharacterId, relationType, label, direction, confidence) {
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
    evidenceIds: [`evidence-${id}`],
    status: 'active',
    createdAt: '',
    updatedAt: '',
  };
}

function centerOf(nodes) {
  assert.ok(nodes.length > 0, 'centerOf requires nodes');
  return {
    x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
  };
}

function closestNodePairDistance(nodes) {
  let distance = Number.POSITIVE_INFINITY;
  let left = null;
  let right = null;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const currentDistance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (currentDistance < distance) {
        distance = currentDistance;
        left = nodes[i];
        right = nodes[j];
      }
    }
  }
  return { distance, left, right };
}

function closestNodePairRadiusGap(nodes) {
  let gap = Number.POSITIVE_INFINITY;
  let left = null;
  let right = null;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const centerDistance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      const currentGap = centerDistance - nodes[i].radius - nodes[j].radius;
      if (currentGap < gap) {
        gap = currentGap;
        left = nodes[i];
        right = nodes[j];
      }
    }
  }
  return { gap, left, right };
}

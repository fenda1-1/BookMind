import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-graph-cache-test-${process.pid}`);
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
  'src/features/characters/characterGraphRenderModel.ts',
  'src/features/characters/characterGraphCanvasSessionCache.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterGraphCanvasSessionCacheKey,
  clearCharacterGraphCanvasSessionCache,
  readCharacterGraphCanvasSessionCache,
  readCharacterGraphModelSessionCache,
  readCharacterGraphRenderModelSessionCache,
  rememberCharacterGraphCanvasSessionCache,
  rememberCharacterGraphModelSessionCache,
  rememberCharacterGraphRenderModelSessionCache,
} = require(join(outDir, 'features', 'characters', 'characterGraphCanvasSessionCache.js'));
const { buildCharacterGraphRenderModel } = require(join(outDir, 'features', 'characters', 'characterGraphRenderModel.js'));

clearCharacterGraphCanvasSessionCache();

const key = buildCharacterGraphCanvasSessionCacheKey({
  bookId: 'book-1',
  payloadSignature: 'sig-1',
  graphSignature: 'graph-1',
  viewMode: 'full',
  focusCharacterId: '',
  searchQuery: ' Alice ',
  neighborDepth: '2',
  edgeMode: 'skeleton',
});
const sameNormalizedKey = buildCharacterGraphCanvasSessionCacheKey({
  bookId: 'book-1',
  payloadSignature: 'sig-1',
  graphSignature: 'graph-1',
  viewMode: 'full',
  focusCharacterId: '',
  searchQuery: 'alice',
  neighborDepth: '2',
  edgeMode: 'skeleton',
});
assert.equal(key, sameNormalizedKey, 'canvas cache key must normalize search input so stable searches reuse layout');

const graphModel = { nodes: [{ id: 'char-a' }], edges: [{ id: 'edge-a' }], summary: { edgeCount: 1 } };
rememberCharacterGraphModelSessionCache('book-1|sig-1|all|0', graphModel, 10);
assert.equal(readCharacterGraphModelSessionCache('book-1|sig-1|all|0', 20), graphModel, 'graph model cache must return the retained graph object for unchanged filters');
assert.equal(readCharacterGraphModelSessionCache('book-1|sig-2|all|0', 30), null, 'graph model cache must miss when the payload signature changes');

const canvas = buildCanvas();
rememberCharacterGraphCanvasSessionCache(key, canvas, 40);
assert.equal(readCharacterGraphCanvasSessionCache(key, 50), canvas, 'canvas layout cache must return the retained canvas layout');

const renderModel = buildCharacterGraphRenderModel(canvas);
rememberCharacterGraphRenderModelSessionCache(key, renderModel, 60);
assert.equal(readCharacterGraphRenderModelSessionCache(key, 70), renderModel, 'render model cache must return retained WebGL buffers and spatial indexes');
assert.equal(readCharacterGraphRenderModelSessionCache(`${key}|stale`, 80), null, 'render model cache must miss on changed canvas key');

for (let index = 0; index < 4; index += 1) {
  rememberCharacterGraphCanvasSessionCache(`layout-${index}`, buildCanvas(), 100 + index);
  rememberCharacterGraphRenderModelSessionCache(`render-${index}`, buildCharacterGraphRenderModel(buildCanvas()), 100 + index);
}
assert.equal(readCharacterGraphCanvasSessionCache('layout-0', 200), null, 'canvas layout cache must evict old entries quickly to avoid retaining large star maps');
assert.equal(readCharacterGraphRenderModelSessionCache('render-0', 200), null, 'render model cache must evict old WebGL buffers quickly to reduce memory use');
assert.notEqual(readCharacterGraphCanvasSessionCache('layout-3', 200), null, 'canvas layout cache should retain the newest entry');
assert.notEqual(readCharacterGraphRenderModelSessionCache('render-3', 200), null, 'render model cache should retain the newest entry');

clearCharacterGraphCanvasSessionCache();
assert.equal(readCharacterGraphCanvasSessionCache(key, 90), null, 'clearing graph caches must clear canvas layouts');
assert.equal(readCharacterGraphRenderModelSessionCache(key, 100), null, 'clearing graph caches must clear render models');

function buildCanvas() {
  const nodes = [
    {
      id: 'char-a',
      label: 'Alice',
      displayLabel: 'Alice',
      mentionCount: 10,
      x: 120,
      y: 160,
      radius: 12,
      communityId: 0,
      degree: 1,
      labelTier: 1,
      showLabelAtScale: 0.5,
      visual: { group: 'person', shape: 'circle', marker: 'P', labelKey: 'characters.profileKind.person' },
    },
    {
      id: 'char-b',
      label: 'Bob',
      displayLabel: 'Bob',
      mentionCount: 8,
      x: 260,
      y: 180,
      radius: 10,
      communityId: 0,
      degree: 1,
      labelTier: 2,
      showLabelAtScale: 1,
      visual: { group: 'person', shape: 'circle', marker: 'P', labelKey: 'characters.profileKind.person' },
    },
  ];
  return {
    width: 480,
    height: 360,
    viewBox: '0 0 480 360',
    nodes,
    edges: [{
      id: 'char-a--char-b::ally',
      sourceId: 'char-a',
      targetId: 'char-b',
      relationType: 'ally',
      label: 'ally',
      direction: 'undirected',
      confidence: 0.9,
      weight: 2,
      x1: nodes[0].x,
      y1: nodes[0].y,
      x2: nodes[1].x,
      y2: nodes[1].y,
      controlX: 190,
      controlY: 140,
      alpha: 0.5,
      isCrossCommunity: false,
    }],
    layout: {
      algorithm: 'starfield-force-v2',
      communityCount: 1,
      iterationCount: 1,
      worldScale: 1,
      minNodeGap: 20,
    },
    summary: {
      visibleNodeCount: 2,
      visibleEdgeCount: 1,
      hiddenNodeCount: 0,
      hiddenEdgeCount: 0,
    },
  };
}

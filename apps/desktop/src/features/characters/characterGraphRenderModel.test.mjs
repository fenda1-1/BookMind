import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-graph-render-model-test-${process.pid}`);
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
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterGraphCanvasViewport } = require(join(outDir, 'features', 'characters', 'characterGraphCanvasModel.js'));
const {
  buildCharacterGraphRenderModel,
  buildCharacterGraphHoverFrame,
  hitTestCharacterGraphRenderEdge,
  hitTestCharacterGraphRenderNode,
  queryVisibleCharacterGraphRenderFrame,
} = require(join(outDir, 'features', 'characters', 'characterGraphRenderModel.js'));

const denseCanvas = buildDenseCanvas(10_000, 50_000);
const renderModel = buildCharacterGraphRenderModel(denseCanvas);

assert.equal(renderModel.renderer, 'webgl');
assert.equal(renderModel.drawMode, 'retained');
assert.equal(renderModel.nodeCount, denseCanvas.nodes.length);
assert.equal(renderModel.edgeCount, denseCanvas.edges.length);
assert.ok(renderModel.nodeBuffer instanceof Float32Array, 'render model should expose packed node buffer data');
assert.ok(renderModel.edgeBuffer instanceof Float32Array, 'render model should expose packed edge buffer data');
assert.ok(renderModel.edgeBucketCount > 0, 'render model should build an edge spatial index');
assert.ok(renderModel.nodeBucketCount > 0, 'render model should build a node spatial index');

const highZoomViewport = buildCharacterGraphCanvasViewport({ scale: 5, offsetX: -800, offsetY: -560 });
const highZoomFrame = queryVisibleCharacterGraphRenderFrame(renderModel, highZoomViewport, 1440, 900);
assert.equal(highZoomFrame.edgeClipMode, 'visible-endpoints');
assert.ok(highZoomFrame.visibleNodeIds.length > 0, 'high zoom query should find visible nodes');
assert.ok(highZoomFrame.candidateEdgeIds.length < renderModel.edgeCount / 6, `high zoom frame must aggressively cull edges; candidates=${highZoomFrame.candidateEdgeIds.length}, total=${renderModel.edgeCount}`);
assert.ok(highZoomFrame.labelNodeIds.length <= 96, `label layer must stay capped; labels=${highZoomFrame.labelNodeIds.length}`);
assert.ok(highZoomFrame.queryStats.scannedNodeCount < renderModel.nodeCount / 5, `node query must not scan the full graph; scanned=${highZoomFrame.queryStats.scannedNodeCount}`);
assert.ok(highZoomFrame.queryStats.scannedEdgeCount < renderModel.edgeCount / 5, `edge query must not scan the full graph; scanned=${highZoomFrame.queryStats.scannedEdgeCount}`);

const lowZoomFrame = queryVisibleCharacterGraphRenderFrame(renderModel, buildCharacterGraphCanvasViewport({ scale: 0.5 }), 1440, 900);
assert.equal(lowZoomFrame.edgeClipMode, 'viewport-bounds');
assert.ok(lowZoomFrame.labelNodeIds.length <= 96, 'low zoom labels must also stay capped');

const hubNodeId = 'node-0';
const hoverFrame = buildCharacterGraphHoverFrame(renderModel, hubNodeId, highZoomFrame, { hoverEdgeBudget: 160 });
assert.equal(hoverFrame.hoveredNodeId, hubNodeId);
assert.ok(hoverFrame.highlightEdgeIds.length <= 160, `hub hover must cap highlighted edges; highlighted=${hoverFrame.highlightEdgeIds.length}`);
assert.ok(hoverFrame.queryStats.scannedEdgeCount <= renderModel.maxNodeDegree, 'hub hover should read only adjacency/top-K metadata, not all graph edges');

const hubNode = denseCanvas.nodes.find((node) => node.id === hubNodeId);
assert.ok(hubNode, 'dense canvas should include the synthetic hub node');
const hit = hitTestCharacterGraphRenderNode(renderModel, hubNode.x, hubNode.y, 5);
assert.equal(hit?.id, hubNodeId, 'node hit testing should find the node at its world coordinate');

const miss = hitTestCharacterGraphRenderNode(renderModel, -999_999, -999_999, 5);
assert.equal(miss, null, 'node hit testing should miss distant empty space');

const firstEdge = denseCanvas.edges[0];
const edgeHit = hitTestCharacterGraphRenderEdge(renderModel, firstEdge.controlX, firstEdge.controlY, 1);
assert.equal(edgeHit?.id, firstEdge.id, 'edge hit testing should find a relationship near its curve control point');

function buildDenseCanvas(nodeCount, edgeCount) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    label: `人物${index}`,
    displayLabel: `人物${index}`,
    mentionCount: index === 0 ? 1000 : 1 + (index % 90),
    x: (index % 100) * 44,
    y: Math.floor(index / 100) * 44,
    radius: index === 0 ? 18 : 6 + (index % 5),
    communityId: Math.floor(index / 125),
    degree: index === 0 ? 10_000 : 1 + (index % 80),
    labelTier: index < 64 ? 1 : index < 300 ? 2 : index < 1200 ? 3 : 4,
    showLabelAtScale: index < 64 ? 0.4 : index < 300 ? 1.1 : index < 1200 ? 2.2 : 4,
    visual: { group: 'person', shape: 'circle', marker: '人', labelKey: 'characters.profileKind.person' },
  }));
  const edges = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const sourceIndex = index < 7_000 ? 0 : (index * 37) % nodeCount;
    const targetIndex = 1 + ((index * 97) % (nodeCount - 1));
    if (sourceIndex === targetIndex) continue;
    const source = nodes[sourceIndex];
    const target = nodes[targetIndex];
    const controlX = (source.x + target.x) / 2 + ((index % 9) - 4) * 3;
    const controlY = (source.y + target.y) / 2 + ((index % 7) - 3) * 3;
    edges.push({
      id: `edge-${index}`,
      sourceId: source.id,
      targetId: target.id,
      relationType: index % 3 === 0 ? 'ally' : 'co-occurrence',
      label: '关系',
      direction: index % 4 === 0 ? 'directed' : 'undirected',
      confidence: 0.5 + (index % 50) / 100,
      weight: 1 + (index % 10),
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      controlX,
      controlY,
      alpha: 0.2,
      isCrossCommunity: source.communityId !== target.communityId,
    });
  }
  return {
    width: 4_400,
    height: 4_400,
    viewBox: '0 0 4400 4400',
    nodes,
    edges,
    layout: {
      algorithm: 'starfield-force-v2',
      communityCount: 80,
      iterationCount: 1,
      worldScale: 1,
      minNodeGap: 12,
    },
    summary: {
      visibleNodeCount: nodes.length,
      visibleEdgeCount: edges.length,
      hiddenNodeCount: 0,
      hiddenEdgeCount: 0,
    },
  };
}

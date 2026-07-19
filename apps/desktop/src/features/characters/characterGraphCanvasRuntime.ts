import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { CharacterGraphModel } from './characterGraphModel';
import type { CharacterGraphCanvasModel, CharacterGraphCanvasViewport } from './characterGraphCanvasModel';

export type CharacterGraphCanvasInteraction = {
  selectedEdgeId: string | null;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  highlightedNodeIds?: string[];
  interactingUntil: number;
  detailUntil: number;
};

export type CharacterGraphCanvasInteractionProbes = {
  node: { id: string; x: number; y: number } | null;
  edge: { id: string; x: number; y: number } | null;
};

type CharacterGraphCanvasEdgeClipMode = 'viewport-bounds' | 'visible-endpoints';

export type CharacterGraphCanvasDrawTelemetry = {
  edgeClipMode: CharacterGraphCanvasEdgeClipMode;
  visibleNodeCount: number;
  endpointNodeCount: number;
  candidateEdgeCount: number;
  drawnEdgeCount: number;
  totalEdgeCount: number;
  highZoom: boolean;
};

type CharacterGraphCanvasVisibleBounds = ReturnType<typeof getCharacterGraphVisibleBounds>;
type CharacterGraphCanvasSpatialIndex = {
  cellSize: number;
  nodeById: Map<string, CharacterGraphCanvasModel['nodes'][number]>;
  edgeById: Map<string, CharacterGraphCanvasModel['edges'][number]>;
  edgesByNodeId: Map<string, CharacterGraphCanvasModel['edges'][number][]>;
  nodeBuckets: Map<string, CharacterGraphCanvasModel['nodes'][number][]>;
  edgeBuckets: Map<string, CharacterGraphCanvasModel['edges'][number][]>;
};

const graphCanvasHighZoomEdgeClipScale = 3;
const graphCanvasSpatialIndexCache = new WeakMap<CharacterGraphCanvasModel, CharacterGraphCanvasSpatialIndex>();

export function drawCharacterGraphCanvas(
  element: HTMLCanvasElement,
  canvas: CharacterGraphCanvasModel,
  viewport: CharacterGraphCanvasViewport,
  interaction: CharacterGraphCanvasInteraction,
  privacySettings: ExtendedSettings,
) {
  const rect = element.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const nextWidth = Math.max(1, Math.round(rect.width * dpr));
  const nextHeight = Math.max(1, Math.round(rect.height * dpr));
  if (element.width !== nextWidth) element.width = nextWidth;
  if (element.height !== nextHeight) element.height = nextHeight;
  const context = element.getContext('2d');
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.fillStyle = '#f8f4ec';
  context.fillRect(0, 0, rect.width, rect.height);

  context.save();
  context.scale(viewport.scale, viewport.scale);
  context.translate(viewport.offsetX, viewport.offsetY);

  context.lineCap = 'round';
  const visibleBounds = getCharacterGraphVisibleBounds(rect.width, rect.height, canvas, viewport);
  const endpointBounds = getCharacterGraphVisibleBounds(rect.width, rect.height, canvas, viewport, 0);
  const frame = buildVisibleGraphCanvasFrame(canvas, visibleBounds, endpointBounds, viewport, interaction, performance.now());
  let drawnEdgeCount = 0;
  let budgetEdgeCount = 0;
  for (const edge of frame.candidateEdges) {
    const active = edge.id === interaction.selectedEdgeId || edge.id === interaction.hoveredEdgeId || edge.sourceId === interaction.hoveredNodeId || edge.targetId === interaction.hoveredNodeId;
    if (!active && frame.interacting && budgetEdgeCount >= frame.maxInteractiveEdges) continue;
    if (!active && frame.highZoom && frame.interacting && edge.relationType === 'co-occurrence') continue;
    if (!active && !frame.detailReady && edge.relationType === 'co-occurrence' && edge.confidence < 0.82) continue;
    if (!active && frame.interacting && edge.relationType === 'co-occurrence' && edge.confidence < 0.82 && budgetEdgeCount % 4 !== 0) {
      budgetEdgeCount += 1;
      continue;
    }
    context.beginPath();
    context.moveTo(edge.x1, edge.y1);
    if ((frame.interacting || frame.highZoom) && !active && edge.relationType === 'co-occurrence') {
      context.lineTo(edge.x2, edge.y2);
    } else {
      context.quadraticCurveTo(edge.controlX, edge.controlY, edge.x2, edge.y2);
    }
    context.strokeStyle = edge.id === interaction.selectedEdgeId
      ? 'rgba(190, 88, 38, 0.95)'
      : active
        ? 'rgba(46, 96, 70, 0.82)'
        : getCharacterGraphEdgeColor(edge);
    context.lineWidth = edge.id === interaction.selectedEdgeId
      ? 3 / viewport.scale
      : active
        ? 2.2 / viewport.scale
        : getCharacterGraphEdgeWidth(edge, viewport.scale);
    context.stroke();
    if (edge.direction === 'directed' && (active || (!frame.interacting && !frame.highZoom && viewport.scale >= 1.1))) {
      drawCharacterGraphArrow(context, edge.controlX, edge.controlY, edge.x2, edge.y2, active, viewport.scale);
    }
    drawnEdgeCount += 1;
    budgetEdgeCount += 1;
  }

  const labelBoxes: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const node of frame.visibleNodes) {
    if (frame.activeNodeIds.has(node.id)) continue;
    drawCharacterGraphCanvasNode(context, node, false, viewport, frame.interacting, privacySettings, labelBoxes);
  }
  for (const node of frame.visibleNodes) {
    if (!frame.activeNodeIds.has(node.id)) continue;
    drawCharacterGraphCanvasNode(context, node, true, viewport, frame.interacting, privacySettings, labelBoxes);
  }
  context.restore();

  return {
    edgeClipMode: frame.edgeClipMode,
    visibleNodeCount: frame.visibleNodes.length,
    endpointNodeCount: frame.endpointNodeIds.size,
    candidateEdgeCount: frame.candidateEdges.length,
    drawnEdgeCount,
    totalEdgeCount: canvas.edges.length,
    highZoom: frame.highZoom,
  } satisfies CharacterGraphCanvasDrawTelemetry;
}

function drawCharacterGraphCanvasNode(
  context: CanvasRenderingContext2D,
  node: CharacterGraphCanvasModel['nodes'][number],
  active: boolean,
  viewport: CharacterGraphCanvasViewport,
  interacting: boolean,
  privacySettings: ExtendedSettings,
  labelBoxes: Array<{ left: number; top: number; right: number; bottom: number }>,
) {
    context.beginPath();
    context.arc(node.x, node.y, active ? node.radius + 4 / viewport.scale : node.radius, 0, Math.PI * 2);
    context.fillStyle = getCharacterGraphNodeFill(node.visual.group, active);
    context.strokeStyle = getCharacterGraphNodeStroke(node.visual.group, active);
    context.lineWidth = active ? 2.2 / viewport.scale : 1 / viewport.scale;
    context.fill();
    context.stroke();
    if (interacting && viewport.scale >= 2.4 && !active) return;
    const labelLevel = buildCharacterGraphLabelLevel(node, active);
    if (active || viewport.scale >= labelLevel) {
      const label = getPrivacyBookTitle(node.displayLabel, privacySettings);
      const fontSize = Math.max(9 / viewport.scale, Math.min(15 / viewport.scale, 12));
      context.font = `700 ${fontSize}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'top';
      const labelWidth = context.measureText(label).width;
      const labelBox = {
        left: node.x - labelWidth / 2 - 4 / viewport.scale,
        top: node.y + node.radius + 4 / viewport.scale,
        right: node.x + labelWidth / 2 + 4 / viewport.scale,
        bottom: node.y + node.radius + fontSize + 8 / viewport.scale,
      };
      if (!active && labelBoxes.some((box) => boxesOverlap(box, labelBox))) return;
      labelBoxes.push(labelBox);
      context.fillStyle = active ? '#173f1d' : '#34302a';
      context.fillText(label, node.x, node.y + node.radius + 4 / viewport.scale);
    }
}

function buildVisibleGraphCanvasFrame(
  canvas: CharacterGraphCanvasModel,
  visibleBounds: CharacterGraphCanvasVisibleBounds,
  endpointBounds: CharacterGraphCanvasVisibleBounds,
  viewport: CharacterGraphCanvasViewport,
  interaction: CharacterGraphCanvasInteraction,
  now: number,
) {
  const index = getCharacterGraphCanvasSpatialIndex(canvas);
  const visibleNodes = queryGraphCanvasNodeBuckets(index, visibleBounds);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const highZoom = viewport.scale >= graphCanvasHighZoomEdgeClipScale;
  const endpointNodes = highZoom ? queryGraphCanvasNodeBuckets(index, endpointBounds) : visibleNodes;
  const endpointNodeIds = new Set(endpointNodes.map((node) => node.id));
  const candidateEdges = highZoom
    ? queryGraphCanvasVisibleEndpointEdges(index, endpointNodeIds)
    : queryGraphCanvasEdgeBuckets(index, visibleBounds, visibleNodeIds);
  const edgeClipMode: CharacterGraphCanvasEdgeClipMode = highZoom ? 'visible-endpoints' : 'viewport-bounds';
  const selectedEdge = interaction.selectedEdgeId ? index.edgeById.get(interaction.selectedEdgeId) ?? null : null;
  const hoveredEdge = interaction.hoveredEdgeId ? index.edgeById.get(interaction.hoveredEdgeId) ?? null : null;
  addActiveGraphCanvasEdge(candidateEdges, selectedEdge);
  addActiveGraphCanvasEdge(candidateEdges, hoveredEdge);
  const activeNodeIds = new Set<string>();
  for (const nodeId of interaction.highlightedNodeIds ?? []) activeNodeIds.add(nodeId);
  for (const activeEdge of [selectedEdge, hoveredEdge]) {
    if (!activeEdge) continue;
    activeNodeIds.add(activeEdge.sourceId);
    activeNodeIds.add(activeEdge.targetId);
  }
  if (interaction.hoveredNodeId) activeNodeIds.add(interaction.hoveredNodeId);
  return {
    activeNodeIds,
    candidateEdges,
    detailReady: now >= interaction.detailUntil,
    edgeClipMode,
    endpointNodeIds,
    highZoom,
    interacting: now < interaction.interactingUntil,
    maxInteractiveEdges: highZoom ? 180 : viewport.scale < 0.6 ? 220 : viewport.scale < 1.2 ? 420 : 620,
    visibleNodeIds,
    visibleNodes,
  };
}

function getCharacterGraphCanvasSpatialIndex(canvas: CharacterGraphCanvasModel) {
  const cached = graphCanvasSpatialIndexCache.get(canvas);
  if (cached) return cached;
  const cellSize = Math.max(96, Math.ceil(Math.sqrt(Math.max(1, canvas.width * canvas.height / Math.max(1, canvas.nodes.length))) * 0.9));
  const index: CharacterGraphCanvasSpatialIndex = {
    cellSize,
    nodeById: new Map(canvas.nodes.map((node) => [node.id, node])),
    edgeById: new Map(canvas.edges.map((edge) => [edge.id, edge])),
    edgesByNodeId: new Map(),
    nodeBuckets: new Map(),
    edgeBuckets: new Map(),
  };
  for (const node of canvas.nodes) {
    addGraphCanvasItemToBuckets(index.nodeBuckets, cellSize, nodeBounds(node), node);
  }
  for (const edge of canvas.edges) {
    addGraphCanvasItemToBuckets(index.edgeBuckets, cellSize, edgeBounds(edge), edge);
    addGraphCanvasEdgeToNodeIndex(index.edgesByNodeId, edge.sourceId, edge);
    addGraphCanvasEdgeToNodeIndex(index.edgesByNodeId, edge.targetId, edge);
  }
  graphCanvasSpatialIndexCache.set(canvas, index);
  return index;
}

function queryGraphCanvasNodeBuckets(index: CharacterGraphCanvasSpatialIndex, bounds: CharacterGraphCanvasVisibleBounds) {
  const seen = new Set<string>();
  const nodes: CharacterGraphCanvasModel['nodes'] = [];
  for (const node of queryGraphCanvasBuckets(index.nodeBuckets, index.cellSize, bounds)) {
    if (seen.has(node.id) || !nodeIntersectsBounds(node, bounds)) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  return nodes;
}

function queryGraphCanvasEdgeBuckets(index: CharacterGraphCanvasSpatialIndex, bounds: CharacterGraphCanvasVisibleBounds, visibleNodeIds: Set<string>) {
  const seen = new Set<string>();
  const edges: CharacterGraphCanvasModel['edges'] = [];
  for (const edge of queryGraphCanvasBuckets(index.edgeBuckets, index.cellSize, bounds)) {
    if (seen.has(edge.id)) continue;
    if (!visibleNodeIds.has(edge.sourceId) && !visibleNodeIds.has(edge.targetId) && !edgeIntersectsBounds(edge, bounds)) continue;
    seen.add(edge.id);
    edges.push(edge);
  }
  return edges;
}

function queryGraphCanvasVisibleEndpointEdges(index: CharacterGraphCanvasSpatialIndex, endpointNodeIds: Set<string>) {
  const seen = new Set<string>();
  const edges: CharacterGraphCanvasModel['edges'] = [];
  for (const nodeId of endpointNodeIds) {
    const nodeEdges = index.edgesByNodeId.get(nodeId);
    if (!nodeEdges) continue;
    for (const edge of nodeEdges) {
      if (seen.has(edge.id)) continue;
      if (!endpointNodeIds.has(edge.sourceId) || !endpointNodeIds.has(edge.targetId)) continue;
      seen.add(edge.id);
      edges.push(edge);
    }
  }
  return edges;
}

function addActiveGraphCanvasEdge(edges: CharacterGraphCanvasModel['edges'], edge: CharacterGraphCanvasModel['edges'][number] | null) {
  if (!edge || edges.some((item) => item.id === edge.id)) return;
  edges.push(edge);
}

function queryGraphCanvasBuckets<T>(buckets: Map<string, T[]>, cellSize: number, bounds: CharacterGraphCanvasVisibleBounds) {
  const items: T[] = [];
  const minX = Math.floor(bounds.left / cellSize);
  const maxX = Math.floor(bounds.right / cellSize);
  const minY = Math.floor(bounds.top / cellSize);
  const maxY = Math.floor(bounds.bottom / cellSize);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const bucket = buckets.get(`${x},${y}`);
      if (bucket) items.push(...bucket);
    }
  }
  return items;
}

function addGraphCanvasItemToBuckets<T>(buckets: Map<string, T[]>, cellSize: number, bounds: { left: number; top: number; right: number; bottom: number }, item: T) {
  const minX = Math.floor(bounds.left / cellSize);
  const maxX = Math.floor(bounds.right / cellSize);
  const minY = Math.floor(bounds.top / cellSize);
  const maxY = Math.floor(bounds.bottom / cellSize);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const key = `${x},${y}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    }
  }
}

function addGraphCanvasEdgeToNodeIndex(index: Map<string, CharacterGraphCanvasModel['edges'][number][]>, nodeId: string, edge: CharacterGraphCanvasModel['edges'][number]) {
  const edges = index.get(nodeId) ?? [];
  edges.push(edge);
  index.set(nodeId, edges);
}

function nodeBounds(node: CharacterGraphCanvasModel['nodes'][number]) {
  return {
    left: node.x - node.radius,
    right: node.x + node.radius,
    top: node.y - node.radius,
    bottom: node.y + node.radius,
  };
}

function edgeBounds(edge: CharacterGraphCanvasModel['edges'][number]) {
  return {
    left: Math.min(edge.x1, edge.x2, edge.controlX),
    right: Math.max(edge.x1, edge.x2, edge.controlX),
    top: Math.min(edge.y1, edge.y2, edge.controlY),
    bottom: Math.max(edge.y1, edge.y2, edge.controlY),
  };
}

export function screenToGraphPoint(
  screenX: number,
  screenY: number,
  _width: number,
  _height: number,
  _canvas: CharacterGraphCanvasModel,
  viewport: CharacterGraphCanvasViewport,
) {
  return {
    x: screenX / viewport.scale - viewport.offsetX,
    y: screenY / viewport.scale - viewport.offsetY,
  };
}

export function getZoomAnchoredOffset(
  screenX: number,
  screenY: number,
  _width: number,
  _height: number,
  _canvas: CharacterGraphCanvasModel,
  _viewport: CharacterGraphCanvasViewport,
  nextScale: number,
  worldBefore: { x: number; y: number },
) {
  return {
    offsetX: screenX / nextScale - worldBefore.x,
    offsetY: screenY / nextScale - worldBefore.y,
  };
}

export function findNearestGraphCanvasNode(canvas: CharacterGraphCanvasModel, x: number, y: number, scale: number) {
  let nearest: CharacterGraphCanvasModel['nodes'][number] | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of canvas.nodes) {
    const distance = Math.hypot(node.x - x, node.y - y);
    if (distance < nearestDistance && distance <= node.radius + 10 / scale) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function findNearestGraphCanvasEdge(canvas: CharacterGraphCanvasModel, x: number, y: number, scale: number) {
  let nearest: CharacterGraphCanvasModel['edges'][number] | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const hitDistance = Math.max(5 / scale, 1.6);
  const bounds = {
    left: x - 120 / Math.max(0.08, scale),
    right: x + 120 / Math.max(0.08, scale),
    top: y - 120 / Math.max(0.08, scale),
    bottom: y + 120 / Math.max(0.08, scale),
  };
  for (const edge of canvas.edges) {
    if (!edgeIntersectsBounds(edge, bounds)) continue;
    const distance = distanceToQuadraticCurve(x, y, edge.x1, edge.y1, edge.controlX, edge.controlY, edge.x2, edge.y2);
    if (distance < nearestDistance && distance <= hitDistance) {
      nearest = edge;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function getCharacterGraphCanvasInteractionProbes(
  width: number,
  height: number,
  canvas: CharacterGraphCanvasModel,
  viewport: CharacterGraphCanvasViewport,
): CharacterGraphCanvasInteractionProbes {
  const visibleBounds = getCharacterGraphVisibleBounds(width, height, canvas, viewport);
  const index = getCharacterGraphCanvasSpatialIndex(canvas);
  const visibleNodes = queryGraphCanvasNodeBuckets(index, visibleBounds);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const highZoom = viewport.scale >= graphCanvasHighZoomEdgeClipScale;
  const endpointNodes = highZoom
    ? queryGraphCanvasNodeBuckets(index, getCharacterGraphVisibleBounds(width, height, canvas, viewport, 0))
    : visibleNodes;
  const endpointNodeIds = new Set(endpointNodes.map((node) => node.id));
  const visibleEdges = highZoom
    ? queryGraphCanvasVisibleEndpointEdges(index, endpointNodeIds)
    : queryGraphCanvasEdgeBuckets(index, visibleBounds, visibleNodeIds);
  const centerX = width / 2;
  const centerY = height / 2;
  const node = visibleNodes
    .map((item) => ({ item, screen: graphToScreenPoint(item.x, item.y, viewport) }))
    .filter(({ screen }) => screen.x >= 12 && screen.x <= width - 12 && screen.y >= 12 && screen.y <= height - 12)
    .sort((left, right) => (
      Math.hypot(left.screen.x - centerX, left.screen.y - centerY) - Math.hypot(right.screen.x - centerX, right.screen.y - centerY)
      || right.item.mentionCount - left.item.mentionCount
    ))[0] ?? null;

  const edge = findVisibleGraphCanvasEdgeProbe(visibleEdges, visibleNodes, viewport, width, height, centerX, centerY);
  return {
    node: node ? { id: node.item.id, x: Math.round(node.screen.x), y: Math.round(node.screen.y) } : null,
    edge,
  };
}

export function clampCharacterGraphViewportScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.round(Math.max(0.04, Math.min(64, value)) * 100) / 100;
}

function drawCharacterGraphArrow(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, active: boolean, scale: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLength = (active ? 8 : 6) / scale;
  const tipOffset = 18 / scale;
  const tipX = x2 - Math.cos(angle) * tipOffset;
  const tipY = y2 - Math.sin(angle) * tipOffset;
  context.beginPath();
  context.moveTo(tipX, tipY);
  context.lineTo(tipX - Math.cos(angle - Math.PI / 6) * arrowLength, tipY - Math.sin(angle - Math.PI / 6) * arrowLength);
  context.moveTo(tipX, tipY);
  context.lineTo(tipX - Math.cos(angle + Math.PI / 6) * arrowLength, tipY - Math.sin(angle + Math.PI / 6) * arrowLength);
  context.stroke();
}

function getCharacterGraphEdgeColor(edge: CharacterGraphCanvasModel['edges'][number]) {
  if (edge.relationType === 'co-occurrence') {
    return 'rgba(78, 72, 63, 0.085)';
  }
  return 'rgba(67, 77, 128, 0.24)';
}

function getCharacterGraphEdgeWidth(edge: CharacterGraphCanvasModel['edges'][number], scale: number) {
  if (edge.relationType === 'co-occurrence') return 0.72 / scale;
  return Math.min(2.1, 0.85 + edge.weight * 0.14) / scale;
}

function getCharacterGraphNodeFill(group: CharacterGraphModel['nodes'][number]['visual']['group'], active: boolean) {
  if (active) return '#dff8dd';
  if (group === 'organization') return 'rgba(231, 246, 232, 0.88)';
  if (group === 'faction') return 'rgba(232, 238, 255, 0.88)';
  if (group === 'place') return 'rgba(255, 244, 218, 0.88)';
  if (group === 'artifact') return 'rgba(255, 232, 224, 0.88)';
  if (group === 'unknown') return 'rgba(234, 232, 226, 0.84)';
  return '#fffefa';
}

function getCharacterGraphNodeStroke(group: CharacterGraphModel['nodes'][number]['visual']['group'], active: boolean) {
  if (active) return '#268c35';
  if (group === 'organization') return 'rgba(91, 132, 88, 0.75)';
  if (group === 'faction') return 'rgba(71, 89, 150, 0.72)';
  if (group === 'place') return 'rgba(184, 128, 40, 0.72)';
  if (group === 'artifact') return 'rgba(164, 73, 55, 0.72)';
  if (group === 'unknown') return 'rgba(90, 84, 74, 0.52)';
  return '#9491b4';
}

export function getCharacterGraphVisibleBounds(
  width: number,
  height: number,
  canvas: CharacterGraphCanvasModel,
  viewport: CharacterGraphCanvasViewport,
  paddingScreen = 180,
) {
  const topLeft = screenToGraphPoint(0, 0, width, height, canvas, viewport);
  const bottomRight = screenToGraphPoint(width, height, width, height, canvas, viewport);
  const padding = paddingScreen / Math.max(0.08, viewport.scale);
  return {
    left: Math.min(topLeft.x, bottomRight.x) - padding,
    right: Math.max(topLeft.x, bottomRight.x) + padding,
    top: Math.min(topLeft.y, bottomRight.y) - padding,
    bottom: Math.max(topLeft.y, bottomRight.y) + padding,
  };
}

export function fitCharacterGraphCanvasViewport(
  width: number,
  height: number,
  canvas: CharacterGraphCanvasModel,
): CharacterGraphCanvasViewport {
  if (canvas.nodes.length === 0) {
    return {
      scale: 1,
      offsetX: width / 2,
      offsetY: height / 2,
      transform: 'translate(0 0) scale(1)',
    };
  }
  const bounds = canvas.nodes.reduce((box, node) => ({
    minX: Math.min(box.minX, node.x - 80),
    minY: Math.min(box.minY, node.y - 80),
    maxX: Math.max(box.maxX, node.x + 80),
    maxY: Math.max(box.maxY, node.y + 80),
  }), { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY });
  const scale = clampCharacterGraphViewportScale(Math.min(
    width / Math.max(1, bounds.maxX - bounds.minX),
    height / Math.max(1, bounds.maxY - bounds.minY),
  ) * 0.9);
  const offsetX = width / 2 / scale - (bounds.minX + bounds.maxX) / 2;
  const offsetY = height / 2 / scale - (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offsetX,
    offsetY,
    transform: `translate(${formatRuntimeViewportNumber(offsetX)} ${formatRuntimeViewportNumber(offsetY)}) scale(${formatRuntimeViewportNumber(scale)})`,
  };
}

function nodeIntersectsBounds(node: CharacterGraphCanvasModel['nodes'][number], bounds: ReturnType<typeof getCharacterGraphVisibleBounds>) {
  return node.x + node.radius >= bounds.left
    && node.x - node.radius <= bounds.right
    && node.y + node.radius >= bounds.top
    && node.y - node.radius <= bounds.bottom;
}

function edgeIntersectsBounds(edge: CharacterGraphCanvasModel['edges'][number], bounds: ReturnType<typeof getCharacterGraphVisibleBounds>) {
  const left = Math.min(edge.x1, edge.x2, edge.controlX);
  const right = Math.max(edge.x1, edge.x2, edge.controlX);
  const top = Math.min(edge.y1, edge.y2, edge.controlY);
  const bottom = Math.max(edge.y1, edge.y2, edge.controlY);
  return right >= bounds.left && left <= bounds.right && bottom >= bounds.top && top <= bounds.bottom;
}

function findVisibleGraphCanvasEdgeProbe(
  edges: CharacterGraphCanvasModel['edges'],
  nodes: CharacterGraphCanvasModel['nodes'],
  viewport: CharacterGraphCanvasViewport,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
) {
  const samples = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74];
  let best: { id: string; x: number; y: number; score: number } | null = null;
  for (const edge of edges) {
    for (const sample of samples) {
      const point = quadraticPointAt(edge.x1, edge.y1, edge.controlX, edge.controlY, edge.x2, edge.y2, sample);
      const screen = graphToScreenPoint(point.x, point.y, viewport);
      if (screen.x < 18 || screen.x > width - 18 || screen.y < 18 || screen.y > height - 18) continue;
      const nearestNodeGap = getNearestGraphCanvasNodeGap(nodes, point.x, point.y);
      if (nearestNodeGap <= Math.max(10 / viewport.scale, 2)) continue;
      const score = Math.hypot(screen.x - centerX, screen.y - centerY) - Math.min(edge.weight, 10) * 2;
      if (!best || score < best.score) best = { id: edge.id, x: Math.round(screen.x), y: Math.round(screen.y), score };
    }
  }
  if (best) return { id: best.id, x: best.x, y: best.y };

  for (const edge of edges) {
    const point = quadraticPointAt(edge.x1, edge.y1, edge.controlX, edge.controlY, edge.x2, edge.y2, 0.5);
    const screen = graphToScreenPoint(point.x, point.y, viewport);
    if (screen.x < 18 || screen.x > width - 18 || screen.y < 18 || screen.y > height - 18) continue;
    const score = Math.hypot(screen.x - centerX, screen.y - centerY);
    if (!best || score < best.score) best = { id: edge.id, x: Math.round(screen.x), y: Math.round(screen.y), score };
  }
  return best ? { id: best.id, x: best.x, y: best.y } : null;
}

function graphToScreenPoint(x: number, y: number, viewport: CharacterGraphCanvasViewport) {
  return {
    x: (x + viewport.offsetX) * viewport.scale,
    y: (y + viewport.offsetY) * viewport.scale,
  };
}

function quadraticPointAt(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

function getNearestGraphCanvasNodeGap(nodes: CharacterGraphCanvasModel['nodes'], x: number, y: number) {
  let gap = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    gap = Math.min(gap, Math.hypot(node.x - x, node.y - y) - node.radius);
  }
  return Number.isFinite(gap) ? gap : 0;
}

function buildCharacterGraphLabelLevel(node: CharacterGraphCanvasModel['nodes'][number], active: boolean) {
  if (active || node.mentionCount > 120) return 0.22;
  if (node.mentionCount > 40) return 0.75;
  if (node.mentionCount > 10) return 1.35;
  return 2.2;
}

function formatRuntimeViewportNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function boxesOverlap(
  left: { left: number; top: number; right: number; bottom: number },
  right: { left: number; top: number; right: number; bottom: number },
) {
  return left.left <= right.right && left.right >= right.left && left.top <= right.bottom && left.bottom >= right.top;
}

function distanceToQuadraticCurve(px: number, py: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let previousX = x1;
  let previousY = y1;
  for (let index = 1; index <= 18; index += 1) {
    const t = index / 18;
    const mt = 1 - t;
    const x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const y = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    nearestDistance = Math.min(nearestDistance, distanceToSegment(px, py, previousX, previousY, x, y));
    previousX = x;
    previousY = y;
  }
  return nearestDistance;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

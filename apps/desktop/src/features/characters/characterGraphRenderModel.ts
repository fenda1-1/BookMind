import type { CharacterGraphCanvasModel, CharacterGraphCanvasViewport } from './characterGraphCanvasModel';

export type CharacterGraphRendererKind = 'webgl';
export type CharacterGraphDrawMode = 'retained';
export type CharacterGraphEdgeClipMode = 'viewport-bounds' | 'visible-endpoints';

export type CharacterGraphRenderModel = {
  renderer: CharacterGraphRendererKind;
  drawMode: CharacterGraphDrawMode;
  width: number;
  height: number;
  nodeCount: number;
  edgeCount: number;
  maxNodeDegree: number;
  nodeBuffer: Float32Array;
  edgeBuffer: Float32Array;
  nodes: CharacterGraphRenderNode[];
  edges: CharacterGraphRenderEdge[];
  nodeBucketCount: number;
  edgeBucketCount: number;
  options: Required<CharacterGraphRenderBudgetOptions>;
  index: CharacterGraphRenderIndex;
};

export type CharacterGraphRenderNode = {
  id: string;
  label: string;
  displayLabel: string;
  x: number;
  y: number;
  radius: number;
  mentionCount: number;
  degree: number;
  labelTier: 1 | 2 | 3 | 4;
  showLabelAtScale: number;
  color: [number, number, number, number];
};

export type CharacterGraphRenderEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceIndex: number;
  targetIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  controlX: number;
  controlY: number;
  weight: number;
  confidence: number;
  relationType: string;
  color: [number, number, number, number];
};

export type CharacterGraphRenderFrame = {
  edgeClipMode: CharacterGraphEdgeClipMode;
  visibleNodeIds: string[];
  candidateEdgeIds: string[];
  labelNodeIds: string[];
  bounds: CharacterGraphRenderBounds;
  queryStats: {
    scannedNodeCount: number;
    scannedEdgeCount: number;
  };
};

export type CharacterGraphHoverFrame = {
  hoveredNodeId: string | null;
  highlightedNodeIds: string[];
  highlightEdgeIds: string[];
  queryStats: {
    scannedEdgeCount: number;
  };
};

export type CharacterGraphRenderBudgetOptions = {
  hoverEdgeBudget?: number;
  labelBudget?: number;
  highZoomEdgeClipScale?: number;
  maxVisibleEdges?: number;
  highlightedNodeIds?: string[];
};

export type CharacterGraphRenderBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type CharacterGraphRenderIndex = {
  nodeById: Map<string, CharacterGraphRenderNode>;
  edgeById: Map<string, CharacterGraphRenderEdge>;
  nodeIndexById: Map<string, number>;
  adjacencyByNodeId: Map<string, CharacterGraphRenderEdge[]>;
  nodeBuckets: Map<string, CharacterGraphRenderNode[]>;
  edgeBuckets: Map<string, CharacterGraphRenderEdge[]>;
  nodeCellSize: number;
  edgeCellSize: number;
};

const defaultRenderBudgets = {
  hoverEdgeBudget: 160,
  labelBudget: 96,
  highZoomEdgeClipScale: 3,
  maxVisibleEdges: 14_000,
  highlightedNodeIds: [] as string[],
} satisfies Required<CharacterGraphRenderBudgetOptions>;

export function buildCharacterGraphRenderModel(
  canvas: CharacterGraphCanvasModel,
  options: CharacterGraphRenderBudgetOptions = {},
): CharacterGraphRenderModel {
  const budgets = { ...defaultRenderBudgets, ...options };
  const highlightedNodeIds = new Set(budgets.highlightedNodeIds);
  const nodes = canvas.nodes.map((node): CharacterGraphRenderNode => ({
    id: node.id,
    label: node.label,
    displayLabel: node.displayLabel,
    x: node.x,
    y: node.y,
    radius: node.radius,
    mentionCount: node.mentionCount,
    degree: node.degree,
    labelTier: highlightedNodeIds.has(node.id) ? 1 : node.labelTier,
    showLabelAtScale: highlightedNodeIds.has(node.id) ? 0.04 : node.showLabelAtScale,
    color: highlightedNodeIds.has(node.id) ? [0.95, 0.54, 0.12, 0.98] : getRenderNodeColor(node.visual.group),
  }));
  const nodeIndexById = new Map(nodes.map((node, index) => [node.id, index]));
  const edges = canvas.edges
    .map((edge): CharacterGraphRenderEdge | null => {
      const sourceIndex = nodeIndexById.get(edge.sourceId);
      const targetIndex = nodeIndexById.get(edge.targetId);
      if (sourceIndex === undefined || targetIndex === undefined) return null;
      return {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceIndex,
        targetIndex,
        x1: edge.x1,
        y1: edge.y1,
        x2: edge.x2,
        y2: edge.y2,
        controlX: edge.controlX,
        controlY: edge.controlY,
        weight: edge.weight,
        confidence: edge.confidence,
        relationType: edge.relationType,
        color: getRenderEdgeColor(edge.relationType, edge.alpha),
      };
    })
    .filter((edge): edge is CharacterGraphRenderEdge => edge !== null);
  const index = buildCharacterGraphRenderIndex(canvas, nodes, edges, nodeIndexById);
  const maxNodeDegree = Math.max(0, ...Array.from(index.adjacencyByNodeId.values(), (items) => items.length));
  return {
    renderer: 'webgl',
    drawMode: 'retained',
    width: canvas.width,
    height: canvas.height,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    maxNodeDegree,
    nodeBuffer: packCharacterGraphNodeBuffer(nodes),
    edgeBuffer: packCharacterGraphEdgeBuffer(edges),
    nodes,
    edges,
    nodeBucketCount: index.nodeBuckets.size,
    edgeBucketCount: index.edgeBuckets.size,
    options: budgets,
    index,
  };
}

export function queryVisibleCharacterGraphRenderFrame(
  model: CharacterGraphRenderModel,
  viewport: CharacterGraphCanvasViewport,
  width: number,
  height: number,
): CharacterGraphRenderFrame {
  const bounds = getVisibleRenderBounds(width, height, viewport, viewport.scale >= model.options.highZoomEdgeClipScale ? 0 : 180);
  const nodeQuery = queryRenderNodeBuckets(model.index, bounds);
  const visibleNodeIds = new Set(nodeQuery.items.map((node) => node.id));
  const highZoom = viewport.scale >= model.options.highZoomEdgeClipScale;
  const edgeQuery = highZoom
    ? queryEndpointRenderEdges(model, visibleNodeIds)
    : queryRenderEdgeBuckets(model.index, bounds, visibleNodeIds);
  const sortedEdges = limitVisibleRenderEdges(edgeQuery.items, model.options.maxVisibleEdges);
  const labelNodeIds = selectRenderLabelNodeIds(nodeQuery.items, viewport.scale, model.options.labelBudget);
  return {
    edgeClipMode: highZoom ? 'visible-endpoints' : 'viewport-bounds',
    visibleNodeIds: nodeQuery.items.map((node) => node.id),
    candidateEdgeIds: sortedEdges.map((edge) => edge.id),
    labelNodeIds,
    bounds,
    queryStats: {
      scannedNodeCount: nodeQuery.scannedCount,
      scannedEdgeCount: edgeQuery.scannedCount,
    },
  };
}

export function buildCharacterGraphHoverFrame(
  model: CharacterGraphRenderModel,
  hoveredNodeId: string | null,
  frame: Pick<CharacterGraphRenderFrame, 'visibleNodeIds'>,
  options: CharacterGraphRenderBudgetOptions = {},
): CharacterGraphHoverFrame {
  if (!hoveredNodeId || !model.index.nodeById.has(hoveredNodeId)) {
    return {
      hoveredNodeId: null,
      highlightedNodeIds: [],
      highlightEdgeIds: [],
      queryStats: { scannedEdgeCount: 0 },
    };
  }
  const budget = options.hoverEdgeBudget ?? model.options.hoverEdgeBudget;
  const visibleNodeIds = new Set(frame.visibleNodeIds);
  const adjacentEdges = model.index.adjacencyByNodeId.get(hoveredNodeId) ?? [];
  const ranked = adjacentEdges
    .filter((edge) => visibleNodeIds.size === 0 || visibleNodeIds.has(edge.sourceId) || visibleNodeIds.has(edge.targetId))
    .sort((left, right) => getHoverEdgeScore(right, hoveredNodeId) - getHoverEdgeScore(left, hoveredNodeId) || left.id.localeCompare(right.id))
    .slice(0, budget);
  const highlightedNodeIds = new Set([hoveredNodeId]);
  for (const edge of ranked) {
    highlightedNodeIds.add(edge.sourceId);
    highlightedNodeIds.add(edge.targetId);
  }
  return {
    hoveredNodeId,
    highlightedNodeIds: Array.from(highlightedNodeIds),
    highlightEdgeIds: ranked.map((edge) => edge.id),
    queryStats: {
      scannedEdgeCount: adjacentEdges.length,
    },
  };
}

export function hitTestCharacterGraphRenderNode(
  model: CharacterGraphRenderModel,
  x: number,
  y: number,
  scale: number,
) {
  const hitPadding = 10 / Math.max(0.08, scale);
  const bounds = {
    left: x - hitPadding,
    right: x + hitPadding,
    top: y - hitPadding,
    bottom: y + hitPadding,
  };
  let nearest: CharacterGraphRenderNode | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of queryBuckets(model.index.nodeBuckets, model.index.nodeCellSize, bounds)) {
    const distance = Math.hypot(node.x - x, node.y - y);
    if (distance <= node.radius + hitPadding && distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function hitTestCharacterGraphRenderEdge(
  model: CharacterGraphRenderModel,
  x: number,
  y: number,
  scale: number,
) {
  const hitDistance = Math.max(5 / Math.max(0.08, scale), 1.6);
  const queryRadius = 96 / Math.max(0.08, scale);
  const bounds = {
    left: x - queryRadius,
    right: x + queryRadius,
    top: y - queryRadius,
    bottom: y + queryRadius,
  };
  let nearest: CharacterGraphRenderEdge | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const seen = new Set<string>();
  for (const edge of queryBuckets(model.index.edgeBuckets, model.index.edgeCellSize, bounds)) {
    if (seen.has(edge.id) || !edgeIntersectsBounds(edge, bounds)) continue;
    seen.add(edge.id);
    const distance = Math.min(
      distanceToSegment(x, y, edge.x1, edge.y1, edge.x2, edge.y2),
      distanceToQuadraticCurve(x, y, edge.x1, edge.y1, edge.controlX, edge.controlY, edge.x2, edge.y2),
    );
    if (distance <= hitDistance && distance < nearestDistance) {
      nearest = edge;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function buildCharacterGraphRenderIndex(
  canvas: CharacterGraphCanvasModel,
  nodes: CharacterGraphRenderNode[],
  edges: CharacterGraphRenderEdge[],
  nodeIndexById: Map<string, number>,
): CharacterGraphRenderIndex {
  const nodeCellSize = Math.max(56, Math.ceil(Math.sqrt(Math.max(1, canvas.width * canvas.height / Math.max(1, nodes.length))) * 0.75));
  const edgeCellSize = Math.max(180, nodeCellSize * 3);
  const nodeBuckets = new Map<string, CharacterGraphRenderNode[]>();
  const edgeBuckets = new Map<string, CharacterGraphRenderEdge[]>();
  const adjacencyByNodeId = new Map<string, CharacterGraphRenderEdge[]>();
  for (const node of nodes) {
    addBucketItem(nodeBuckets, nodeCellSize, getNodeBounds(node), node);
  }
  for (const edge of edges) {
    addBucketItem(edgeBuckets, edgeCellSize, getEdgeBounds(edge), edge);
    addAdjacency(adjacencyByNodeId, edge.sourceId, edge);
    addAdjacency(adjacencyByNodeId, edge.targetId, edge);
  }
  for (const adjacency of adjacencyByNodeId.values()) {
    adjacency.sort((left, right) => right.weight - left.weight || right.confidence - left.confidence || left.id.localeCompare(right.id));
  }
  return {
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    edgeById: new Map(edges.map((edge) => [edge.id, edge])),
    nodeIndexById,
    adjacencyByNodeId,
    nodeBuckets,
    edgeBuckets,
    nodeCellSize,
    edgeCellSize,
  };
}

function queryRenderNodeBuckets(index: CharacterGraphRenderIndex, bounds: CharacterGraphRenderBounds) {
  const seen = new Set<string>();
  const items: CharacterGraphRenderNode[] = [];
  let scannedCount = 0;
  for (const node of queryBuckets(index.nodeBuckets, index.nodeCellSize, bounds)) {
    scannedCount += 1;
    if (seen.has(node.id) || !nodeIntersectsBounds(node, bounds)) continue;
    seen.add(node.id);
    items.push(node);
  }
  return { items, scannedCount };
}

function queryRenderEdgeBuckets(
  index: CharacterGraphRenderIndex,
  bounds: CharacterGraphRenderBounds,
  visibleNodeIds: Set<string>,
) {
  const seen = new Set<string>();
  const items: CharacterGraphRenderEdge[] = [];
  let scannedCount = 0;
  for (const edge of queryBuckets(index.edgeBuckets, index.edgeCellSize, bounds)) {
    scannedCount += 1;
    if (seen.has(edge.id)) continue;
    if (!visibleNodeIds.has(edge.sourceId) && !visibleNodeIds.has(edge.targetId) && !edgeIntersectsBounds(edge, bounds)) continue;
    seen.add(edge.id);
    items.push(edge);
  }
  return { items, scannedCount };
}

function queryEndpointRenderEdges(
  model: CharacterGraphRenderModel,
  endpointNodeIds: Set<string>,
) {
  const seen = new Set<string>();
  const items: CharacterGraphRenderEdge[] = [];
  let scannedCount = 0;
  for (const nodeId of endpointNodeIds) {
    const adjacent = model.index.adjacencyByNodeId.get(nodeId) ?? [];
    scannedCount += adjacent.length;
    for (const edge of adjacent) {
      if (seen.has(edge.id)) continue;
      if (!endpointNodeIds.has(edge.sourceId) || !endpointNodeIds.has(edge.targetId)) continue;
      seen.add(edge.id);
      items.push(edge);
    }
  }
  return { items, scannedCount };
}

function limitVisibleRenderEdges(edges: CharacterGraphRenderEdge[], limit: number) {
  if (edges.length <= limit) return edges;
  return [...edges]
    .sort((left, right) => right.weight - left.weight || right.confidence - left.confidence || left.id.localeCompare(right.id))
    .slice(0, limit);
}

function selectRenderLabelNodeIds(nodes: CharacterGraphRenderNode[], scale: number, budget: number) {
  return [...nodes]
    .filter((node) => scale >= node.showLabelAtScale || node.labelTier <= 2)
    .sort((left, right) => (
      left.labelTier - right.labelTier
      || right.mentionCount - left.mentionCount
      || right.degree - left.degree
      || left.id.localeCompare(right.id)
    ))
    .slice(0, budget)
    .map((node) => node.id);
}

function packCharacterGraphNodeBuffer(nodes: CharacterGraphRenderNode[]) {
  const stride = 8;
  const buffer = new Float32Array(nodes.length * stride);
  nodes.forEach((node, index) => {
    const offset = index * stride;
    buffer[offset] = node.x;
    buffer[offset + 1] = node.y;
    buffer[offset + 2] = node.radius;
    buffer[offset + 3] = node.labelTier;
    buffer[offset + 4] = node.color[0];
    buffer[offset + 5] = node.color[1];
    buffer[offset + 6] = node.color[2];
    buffer[offset + 7] = node.color[3];
  });
  return buffer;
}

function packCharacterGraphEdgeBuffer(edges: CharacterGraphRenderEdge[]) {
  const stride = 12;
  const buffer = new Float32Array(edges.length * 2 * stride);
  edges.forEach((edge, index) => {
    const first = index * 2 * stride;
    writeEdgeVertex(buffer, first, edge, edge.x1, edge.y1);
    writeEdgeVertex(buffer, first + stride, edge, edge.x2, edge.y2);
  });
  return buffer;
}

function writeEdgeVertex(buffer: Float32Array, offset: number, edge: CharacterGraphRenderEdge, x: number, y: number) {
  buffer[offset] = x;
  buffer[offset + 1] = y;
  buffer[offset + 2] = edge.weight;
  buffer[offset + 3] = edge.confidence;
  buffer[offset + 4] = edge.color[0];
  buffer[offset + 5] = edge.color[1];
  buffer[offset + 6] = edge.color[2];
  buffer[offset + 7] = edge.color[3];
  buffer[offset + 8] = edge.sourceIndex;
  buffer[offset + 9] = edge.targetIndex;
  buffer[offset + 10] = edge.controlX;
  buffer[offset + 11] = edge.controlY;
}

function getVisibleRenderBounds(
  width: number,
  height: number,
  viewport: CharacterGraphCanvasViewport,
  paddingScreen: number,
): CharacterGraphRenderBounds {
  const padding = paddingScreen / Math.max(0.08, viewport.scale);
  const left = -viewport.offsetX;
  const top = -viewport.offsetY;
  const right = width / Math.max(0.08, viewport.scale) - viewport.offsetX;
  const bottom = height / Math.max(0.08, viewport.scale) - viewport.offsetY;
  return {
    left: Math.min(left, right) - padding,
    right: Math.max(left, right) + padding,
    top: Math.min(top, bottom) - padding,
    bottom: Math.max(top, bottom) + padding,
  };
}

function queryBuckets<T>(buckets: Map<string, T[]>, cellSize: number, bounds: CharacterGraphRenderBounds) {
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

function addBucketItem<T>(
  buckets: Map<string, T[]>,
  cellSize: number,
  bounds: CharacterGraphRenderBounds,
  item: T,
) {
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

function addAdjacency(index: Map<string, CharacterGraphRenderEdge[]>, nodeId: string, edge: CharacterGraphRenderEdge) {
  const edges = index.get(nodeId) ?? [];
  edges.push(edge);
  index.set(nodeId, edges);
}

function getNodeBounds(node: CharacterGraphRenderNode): CharacterGraphRenderBounds {
  return {
    left: node.x - node.radius,
    right: node.x + node.radius,
    top: node.y - node.radius,
    bottom: node.y + node.radius,
  };
}

function getEdgeBounds(edge: CharacterGraphRenderEdge): CharacterGraphRenderBounds {
  return {
    left: Math.min(edge.x1, edge.x2, edge.controlX),
    right: Math.max(edge.x1, edge.x2, edge.controlX),
    top: Math.min(edge.y1, edge.y2, edge.controlY),
    bottom: Math.max(edge.y1, edge.y2, edge.controlY),
  };
}

function nodeIntersectsBounds(node: CharacterGraphRenderNode, bounds: CharacterGraphRenderBounds) {
  return node.x + node.radius >= bounds.left
    && node.x - node.radius <= bounds.right
    && node.y + node.radius >= bounds.top
    && node.y - node.radius <= bounds.bottom;
}

function edgeIntersectsBounds(edge: CharacterGraphRenderEdge, bounds: CharacterGraphRenderBounds) {
  const edgeBounds = getEdgeBounds(edge);
  return edgeBounds.right >= bounds.left
    && edgeBounds.left <= bounds.right
    && edgeBounds.bottom >= bounds.top
    && edgeBounds.top <= bounds.bottom;
}

function getHoverEdgeScore(edge: CharacterGraphRenderEdge, hoveredNodeId: string) {
  const semanticBonus = edge.relationType === 'co-occurrence' ? 0 : 100;
  const endpointBonus = edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId ? 10 : 0;
  return semanticBonus + endpointBonus + edge.weight * 5 + edge.confidence;
}

function getRenderNodeColor(group: CharacterGraphCanvasModel['nodes'][number]['visual']['group']): [number, number, number, number] {
  if (group === 'organization') return [0.47, 0.68, 0.44, 1];
  if (group === 'faction') return [0.35, 0.43, 0.78, 1];
  if (group === 'place') return [0.82, 0.58, 0.18, 1];
  if (group === 'artifact') return [0.78, 0.32, 0.24, 1];
  if (group === 'unknown') return [0.58, 0.55, 0.49, 1];
  return [0.96, 0.91, 0.72, 1];
}

function getRenderEdgeColor(relationType: string, alpha: number): [number, number, number, number] {
  if (relationType === 'co-occurrence') return [0.31, 0.28, 0.24, Math.max(0.05, Math.min(0.16, alpha))];
  return [0.25, 0.31, 0.7, Math.max(0.16, Math.min(0.62, alpha))];
}

function distanceToQuadraticCurve(px: number, py: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let previousX = x1;
  let previousY = y1;
  for (let index = 1; index <= 16; index += 1) {
    const t = index / 16;
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

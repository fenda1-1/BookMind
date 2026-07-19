import type { CharacterGraphEdge, CharacterGraphModel, CharacterGraphNode, CharacterGraphNodeVisual } from './characterGraphModel';

export type CharacterGraphCanvasOptions = {
  width?: number;
  height?: number;
  maxNodes?: number;
  maxEdges?: number;
  viewMode?: 'full' | 'community' | 'core' | 'neighborhood';
  focusCharacterId?: string | null;
  searchQuery?: string;
  neighborDepth?: 1 | 2 | 'all';
  edgeMode?: 'skeleton' | 'semantic' | 'all';
};

export type CharacterGraphCanvasNode = {
  id: string;
  label: string;
  displayLabel: string;
  mentionCount: number;
  x: number;
  y: number;
  radius: number;
  communityId: number;
  degree: number;
  labelTier: 1 | 2 | 3 | 4;
  showLabelAtScale: number;
  visual: CharacterGraphNodeVisual;
};

export type CharacterGraphCanvasEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  label: string;
  direction: CharacterGraphEdge['direction'];
  confidence: number;
  weight: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  controlX: number;
  controlY: number;
  alpha: number;
  isCrossCommunity: boolean;
};

export type CharacterGraphCanvasModel = {
  width: number;
  height: number;
  viewBox: string;
  nodes: CharacterGraphCanvasNode[];
  edges: CharacterGraphCanvasEdge[];
  layout: {
    algorithm: 'starfield-force-v2';
    communityCount: number;
    iterationCount: number;
    worldScale: number;
    minNodeGap: number;
  };
  summary: {
    visibleNodeCount: number;
    visibleEdgeCount: number;
    hiddenNodeCount: number;
    hiddenEdgeCount: number;
  };
};

export type CharacterGraphCanvasViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
  transform: string;
};

export type CharacterGraphCanvasViewportAction =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'reset';

const defaultGraphCanvasWidth = 960;
const defaultGraphCanvasHeight = 360;
const graphCanvasPadding = 52;
const graphCanvasLabelMaxLength = 12;
const graphCanvasDefaultScale = 1;
const graphCanvasMinScale = 0.04;
const graphCanvasMaxScale = 64;
const graphCanvasZoomStep = 0.5;
const graphCanvasPanStep = 56;
const graphCanvasMaxOffset = 24000;
const graphCanvasStarfieldGoldenAngle = 2.399963229728653;
const graphCanvasRelationDistance = 120;
const graphCanvasCoOccurrenceDistance = 180;
const graphCanvasCollisionCellSize = 72;
const graphCanvasCollisionTargetGap = 24;
const graphCanvasStrongCommunityConfidence = 0.65;
const graphCanvasDefaultMaxNodes = 480;
const graphCanvasDefaultMaxEdges = 1400;

export function buildCharacterGraphCanvasModel(
  graph: Pick<CharacterGraphModel, 'nodes' | 'edges'>,
  options: CharacterGraphCanvasOptions = {},
): CharacterGraphCanvasModel {
  const width = clampCanvasDimension(options.width, defaultGraphCanvasWidth);
  const height = clampCanvasDimension(options.height, defaultGraphCanvasHeight);
  const readableGraph = buildReadableStarMapGraph(graph.nodes, graph.edges, options);
  const world = buildGraphWorldSize(readableGraph.nodes.length, width, height);
  const nodes = readableGraph.nodes;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const layout = buildStarfieldLayout(nodes, readableGraph.edges, world.width, world.height);
  const positionedNodes = buildCanvasNodes(nodes, layout);
  const minNodeGap = getMinimumCanvasNodeGap(positionedNodes);
  const positionById = new Map(positionedNodes.map((node) => [node.id, node]));
  const edges = readableGraph.edges
    .filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
    .map((edge) => buildCanvasEdge(edge, positionById))
    .filter((edge): edge is CharacterGraphCanvasEdge => Boolean(edge));

  return {
    width: world.width,
    height: world.height,
    viewBox: `0 0 ${world.width} ${world.height}`,
    nodes: positionedNodes,
    edges,
    layout: {
      algorithm: 'starfield-force-v2',
      communityCount: layout.communityCount,
      iterationCount: layout.iterationCount,
      worldScale: world.scale,
      minNodeGap,
    },
    summary: {
      visibleNodeCount: positionedNodes.length,
      visibleEdgeCount: edges.length,
      hiddenNodeCount: readableGraph.hiddenNodeCount,
      hiddenEdgeCount: Math.max(0, graph.edges.length - edges.length),
    },
  };
}

export function buildCharacterGraphCanvasViewport(
  viewport: Partial<Omit<CharacterGraphCanvasViewport, 'transform'>> = {},
): CharacterGraphCanvasViewport {
  const scale = clampViewportScale(viewport.scale ?? graphCanvasDefaultScale);
  const offsetX = clampViewportOffset(viewport.offsetX ?? 0);
  const offsetY = clampViewportOffset(viewport.offsetY ?? 0);
  return {
    scale,
    offsetX,
    offsetY,
    transform: `translate(${formatViewportNumber(offsetX)} ${formatViewportNumber(offsetY)}) scale(${formatViewportNumber(scale)})`,
  };
}

export function applyCharacterGraphCanvasViewportAction(
  viewport: CharacterGraphCanvasViewport,
  action: CharacterGraphCanvasViewportAction,
): CharacterGraphCanvasViewport {
  if (action === 'reset') return buildCharacterGraphCanvasViewport();
  if (action === 'zoom-in') return buildCharacterGraphCanvasViewport({ ...viewport, scale: viewport.scale + graphCanvasZoomStep });
  if (action === 'zoom-out') return buildCharacterGraphCanvasViewport({ ...viewport, scale: viewport.scale - graphCanvasZoomStep });
  if (action === 'pan-left') return buildCharacterGraphCanvasViewport({ ...viewport, offsetX: viewport.offsetX - graphCanvasPanStep });
  if (action === 'pan-right') return buildCharacterGraphCanvasViewport({ ...viewport, offsetX: viewport.offsetX + graphCanvasPanStep });
  if (action === 'pan-up') return buildCharacterGraphCanvasViewport({ ...viewport, offsetY: viewport.offsetY - graphCanvasPanStep });
  return buildCharacterGraphCanvasViewport({ ...viewport, offsetY: viewport.offsetY + graphCanvasPanStep });
}

function buildCanvasNodes(nodes: CharacterGraphNode[], layout: StarfieldLayout) {
  return nodes.map((node) => {
    const position = layout.positionById.get(node.id) ?? {
      x: layout.width / 2,
      y: layout.height / 2,
      anchorX: layout.width / 2,
      anchorY: layout.height / 2,
      communityId: 0,
      degree: 0,
    };
    return buildCanvasNode(node, position);
  });
}

function buildCanvasNode(node: CharacterGraphNode, position: StarfieldNodePosition): CharacterGraphCanvasNode {
  const labelTier = buildLabelTier(node, position.degree);
  return {
    id: node.id,
    label: node.label,
    displayLabel: truncateGraphCanvasLabel(node.label),
    mentionCount: node.mentionCount,
    x: Math.round(position.x),
    y: Math.round(position.y),
    radius: buildNodeRadius(node, position.degree),
    communityId: position.communityId,
    degree: position.degree,
    labelTier,
    showLabelAtScale: buildLabelScale(labelTier),
    visual: node.visual,
  };
}

function buildCanvasEdge(edge: CharacterGraphEdge, positionById: Map<string, CharacterGraphCanvasNode>): CharacterGraphCanvasEdge | null {
  const source = positionById.get(edge.sourceId);
  const target = positionById.get(edge.targetId);
  if (!source || !target) return null;
  const curve = buildEdgeCurve(source, target, edge);
  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relationType: edge.relationType,
    label: edge.label,
    direction: edge.direction,
    confidence: edge.confidence,
    weight: edge.weight,
    x1: source.x,
    y1: source.y,
    x2: target.x,
    y2: target.y,
    controlX: curve.controlX,
    controlY: curve.controlY,
    alpha: curve.alpha,
    isCrossCommunity: source.communityId !== target.communityId,
  };
}

function getMinimumCanvasNodeGap(nodes: CharacterGraphCanvasNode[]) {
  if (nodes.length < 2) return 0;
  let gap = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const right = nodes[rightIndex];
      gap = Math.min(gap, Math.hypot(left.x - right.x, left.y - right.y) - left.radius - right.radius);
    }
  }
  return Math.round(gap * 100) / 100;
}

type StarfieldNodePosition = {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  communityId: number;
  degree: number;
};

type StarfieldLayout = {
  width: number;
  height: number;
  communityCount: number;
  iterationCount: number;
  positionById: Map<string, StarfieldNodePosition>;
};

type GraphCommunity = {
  id: number;
  nodeIds: string[];
  centerX: number;
  centerY: number;
  radius: number;
};

type ReadableStarMapGraph = {
  nodes: CharacterGraphNode[];
  edges: CharacterGraphEdge[];
  hiddenNodeCount: number;
};

function buildReadableStarMapGraph(
  nodes: CharacterGraphNode[],
  edges: CharacterGraphEdge[],
  options: CharacterGraphCanvasOptions,
): ReadableStarMapGraph {
  if (nodes.length === 0) return { nodes: [], edges: [], hiddenNodeCount: 0 };

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const validEdges = edges.filter((edge) => (
    edge.sourceId !== edge.targetId
    && nodeById.has(edge.sourceId)
    && nodeById.has(edge.targetId)
  ));
  if (validEdges.length === 0) {
    return { nodes: [], edges: [], hiddenNodeCount: nodes.length };
  }

  const visibleNodeIds = selectReadableStarMapNodeIds(nodes, validEdges, options);
  const visibleNodes = nodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleNodeIdSet = new Set(visibleNodes.map((node) => node.id));
  const candidateEdges = validEdges.filter((edge) => visibleNodeIdSet.has(edge.sourceId) && visibleNodeIdSet.has(edge.targetId));
  const semanticEdges = options.edgeMode === 'semantic'
    ? candidateEdges.filter((edge) => !isWeakCoOccurrenceEdge(edge))
    : candidateEdges;
  const visibleEdges = buildReadableStarMapEdges(semanticEdges, visibleNodes, validEdges, options.maxEdges);

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    hiddenNodeCount: Math.max(0, nodes.length - visibleNodes.length),
  };
}

function selectReadableStarMapNodeIds(
  nodes: CharacterGraphNode[],
  edges: CharacterGraphEdge[],
  options: CharacterGraphCanvasOptions,
) {
  const degreeById = buildDegreeById(nodes, edges);
  const connectedNodes = nodes.filter((node) => (degreeById.get(node.id) ?? 0) > 0);
  if (connectedNodes.length === 0) return new Set<string>();
  const maxNodes = resolveReadableStarMapMaxNodes(connectedNodes.length, options);
  const searchQuery = normalizeStarMapSearchQuery(options.searchQuery);
  const neighborDepth = options.neighborDepth ?? 2;
  if (searchQuery) {
    const rootIds = connectedNodes
      .filter((node) => node.label.toLocaleLowerCase().includes(searchQuery))
      .map((node) => node.id);
    return limitReadableStarMapNodeIds(
      connectedNodes,
      degreeById,
      expandReadableStarMapNeighbors(rootIds, edges, neighborDepth === 'all' ? 99 : neighborDepth),
      maxNodes,
    );
  }
  if (neighborDepth === 'all') return limitReadableStarMapNodeIds(connectedNodes, degreeById, new Set(connectedNodes.map((node) => node.id)), maxNodes);
  if (options.viewMode === 'community') return limitReadableStarMapNodeIds(connectedNodes, degreeById, new Set(connectedNodes.map((node) => node.id)), maxNodes);
  if (options.viewMode === 'core') return selectCoreStarMapNodeIds(connectedNodes, edges, degreeById);
  if (options.viewMode === 'neighborhood' && options.focusCharacterId) {
    const neighborhood = expandReadableStarMapNeighbors([options.focusCharacterId], edges, 2);
    if (neighborhood.size > 0) return limitReadableStarMapNodeIds(connectedNodes, degreeById, neighborhood, maxNodes);
  }
  return limitReadableStarMapNodeIds(connectedNodes, degreeById, selectLargestStarMapComponent(connectedNodes, edges), maxNodes);
}

function resolveReadableStarMapMaxNodes(nodeCount: number, options: CharacterGraphCanvasOptions) {
  if (typeof options.maxNodes === 'number' && Number.isFinite(options.maxNodes)) {
    return Math.max(1, Math.min(nodeCount, Math.floor(options.maxNodes)));
  }
  if (options.searchQuery || options.viewMode === 'neighborhood') return Math.min(nodeCount, 720);
  if (options.neighborDepth === 'all' || options.viewMode === 'community') return Math.min(nodeCount, 680);
  return Math.min(nodeCount, graphCanvasDefaultMaxNodes);
}

function limitReadableStarMapNodeIds(
  nodes: CharacterGraphNode[],
  degreeById: Map<string, number>,
  selected: Set<string>,
  maxNodes: number,
) {
  if (selected.size <= maxNodes) return selected;
  return new Set(
    nodes
      .filter((node) => selected.has(node.id))
      .sort((left, right) => (
        (right.role === 'protagonist' ? 1 : 0) - (left.role === 'protagonist' ? 1 : 0)
        || (right.role === 'main' ? 1 : 0) - (left.role === 'main' ? 1 : 0)
        || (degreeById.get(right.id) ?? 0) - (degreeById.get(left.id) ?? 0)
        || right.importanceScore - left.importanceScore
        || right.mentionCount - left.mentionCount
        || left.id.localeCompare(right.id)
      ))
      .slice(0, maxNodes)
      .map((node) => node.id),
  );
}

function normalizeStarMapSearchQuery(query: string | undefined) {
  return (query ?? '').trim().toLocaleLowerCase();
}

function selectCoreStarMapNodeIds(
  nodes: CharacterGraphNode[],
  edges: CharacterGraphEdge[],
  degreeById: Map<string, number>,
) {
  const limit = Math.max(24, Math.min(nodes.length, Math.ceil(Math.sqrt(nodes.length) * 8)));
  const selected = new Set(
    [...nodes]
      .sort((left, right) => (
        (degreeById.get(right.id) ?? 0) - (degreeById.get(left.id) ?? 0)
        || right.importanceScore - left.importanceScore
        || right.mentionCount - left.mentionCount
        || left.id.localeCompare(right.id)
      ))
      .slice(0, limit)
      .map((node) => node.id),
  );
  for (const edge of edges) {
    if (selected.has(edge.sourceId) || selected.has(edge.targetId)) {
      selected.add(edge.sourceId);
      selected.add(edge.targetId);
    }
  }
  return selected;
}

function expandReadableStarMapNeighbors(rootIds: string[], edges: CharacterGraphEdge[], depth: number) {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const left = adjacency.get(edge.sourceId) ?? [];
    left.push(edge.targetId);
    adjacency.set(edge.sourceId, left);
    const right = adjacency.get(edge.targetId) ?? [];
    right.push(edge.sourceId);
    adjacency.set(edge.targetId, right);
  }
  const validRootIds = rootIds.filter((id) => adjacency.has(id));
  if (validRootIds.length === 0) return new Set<string>();
  const result = new Set(validRootIds);
  const queue: Array<[string, number]> = validRootIds.map((id) => [id, 0]);
  for (let index = 0; index < queue.length; index += 1) {
    const [id, distance] = queue[index];
    if (distance >= depth) continue;
    for (const next of adjacency.get(id) ?? []) {
      if (result.has(next)) continue;
      result.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return result;
}

function selectLargestStarMapComponent(nodes: CharacterGraphNode[], edges: CharacterGraphEdge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) continue;
    adjacency.get(edge.sourceId)?.push(edge.targetId);
    adjacency.get(edge.targetId)?.push(edge.sourceId);
  }

  const seen = new Set<string>();
  let best: string[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const current: string[] = [];
    const queue = [node.id];
    seen.add(node.id);
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      current.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    if (current.length > best.length) best = current;
  }
  return new Set(best);
}

function buildReadableStarMapEdges(
  edges: CharacterGraphEdge[],
  nodes: CharacterGraphNode[],
  allValidEdges: CharacterGraphEdge[],
  maxEdges = graphCanvasDefaultMaxEdges,
) {
  const degreeById = buildDegreeById(nodes, allValidEdges);
  const sorted = [...edges].sort((left, right) => getReadableEdgeScore(right, degreeById) - getReadableEdgeScore(left, degreeById));
  const kept: CharacterGraphEdge[] = [];
  const perNode = new Map(nodes.map((node) => [node.id, 0]));
  const safeMaxEdges = Math.max(nodes.length - 1, Math.floor(maxEdges));
  for (const edge of sorted) {
    if (kept.length >= safeMaxEdges) break;
    const sourceLimit = buildReadableStarMapEdgeLimit(degreeById.get(edge.sourceId) ?? 0);
    const targetLimit = buildReadableStarMapEdgeLimit(degreeById.get(edge.targetId) ?? 0);
    const sourceCount = perNode.get(edge.sourceId) ?? 0;
    const targetCount = perNode.get(edge.targetId) ?? 0;
    if (isWeakCoOccurrenceEdge(edge) && sourceCount >= sourceLimit && targetCount >= targetLimit) continue;
    kept.push(edge);
    perNode.set(edge.sourceId, sourceCount + 1);
    perNode.set(edge.targetId, targetCount + 1);
  }
  return kept.sort((left, right) => left.id.localeCompare(right.id));
}

function getReadableEdgeScore(edge: CharacterGraphEdge, degreeById: Map<string, number>) {
  const sourceDegree = degreeById.get(edge.sourceId) ?? 0;
  const targetDegree = degreeById.get(edge.targetId) ?? 0;
  const semanticBonus = edge.relationType === 'co-occurrence' ? 0 : 12;
  return sourceDegree + targetDegree + edge.confidence * 8 + Math.min(edge.weight, 8) + semanticBonus;
}

function buildReadableStarMapEdgeLimit(degree: number) {
  return Math.max(3, Math.min(14, Math.ceil(Math.sqrt(Math.max(1, degree)) * 2.2)));
}

function isWeakCoOccurrenceEdge(edge: CharacterGraphEdge) {
  return edge.relationType === 'co-occurrence' && edge.confidence < 0.82;
}

function buildGraphWorldSize(nodeCount: number, requestedWidth: number, requestedHeight: number) {
  if (nodeCount <= 0) {
    return { width: requestedWidth, height: requestedHeight, scale: 1 };
  }
  const scale = Math.max(1, Math.sqrt(nodeCount / 18));
  const starfieldRadius = buildStarfieldRadius(nodeCount);
  const width = Math.max(requestedWidth, Math.ceil(starfieldRadius * 2.36 + graphCanvasPadding * 2));
  const height = Math.max(requestedHeight, Math.ceil(starfieldRadius * 1.74 + graphCanvasPadding * 2));
  return {
    width: clampCanvasDimension(width, defaultGraphCanvasWidth),
    height: clampCanvasDimension(height, defaultGraphCanvasHeight),
    scale,
  };
}

function buildStarfieldRadius(nodeCount: number) {
  return Math.max(760, Math.sqrt(Math.max(1, nodeCount)) * 118);
}

function buildStarfieldLayout(nodes: CharacterGraphNode[], edges: CharacterGraphEdge[], width: number, height: number): StarfieldLayout {
  if (nodes.length === 0) {
    return { width, height, communityCount: 0, iterationCount: 0, positionById: new Map() };
  }

  const degreeById = buildDegreeById(nodes, edges);
  const communities = buildGraphCommunities(nodes, edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const positionById = seedStarfieldRings(nodes, communities, degreeById, width, height);
  const iterationCount = runStarfieldForceLayout(positionById, nodeById, edges, width, height);
  for (let pass = 0; pass < 96; pass += 1) {
    const gap = resolveStarfieldCollisions(positionById, nodeById, width, height, graphCanvasCollisionTargetGap);
    if (gap >= graphCanvasCollisionTargetGap - 1) break;
  }
  return {
    width,
    height,
    communityCount: communities.length,
    iterationCount,
    positionById,
  };
}

function buildDegreeById(nodes: CharacterGraphNode[], edges: CharacterGraphEdge[]) {
  const degreeById = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degreeById.set(edge.sourceId, (degreeById.get(edge.sourceId) ?? 0) + edge.weight);
    degreeById.set(edge.targetId, (degreeById.get(edge.targetId) ?? 0) + edge.weight);
  }
  return degreeById;
}

function buildGraphCommunities(nodes: CharacterGraphNode[], edges: CharacterGraphEdge[]) {
  const dsu = new DisjointSet(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (edge.confidence >= graphCanvasStrongCommunityConfidence || edge.weight >= 2) {
      dsu.union(edge.sourceId, edge.targetId);
    }
  }

  const communitiesByRoot = new Map<string, string[]>();
  for (const node of nodes) {
    const root = dsu.find(node.id);
    const community = communitiesByRoot.get(root) ?? [];
    community.push(node.id);
    communitiesByRoot.set(root, community);
  }

  return Array.from(communitiesByRoot.values())
    .sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]))
    .map((nodeIds, index): GraphCommunity => ({
      id: index,
      nodeIds,
      centerX: 0,
      centerY: 0,
      radius: Math.max(120, Math.sqrt(nodeIds.length) * 62),
    }));
}

function seedStarfieldRings(
  nodes: CharacterGraphNode[],
  communities: GraphCommunity[],
  degreeById: Map<string, number>,
  width: number,
  height: number,
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const communityByNodeId = new Map<string, number>();
  for (const community of communities) {
    for (const nodeId of community.nodeIds) communityByNodeId.set(nodeId, community.id);
  }
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min((width - graphCanvasPadding * 2) / 2.18, (height - graphCanvasPadding * 2) / 1.62, buildStarfieldRadius(nodes.length));
  const largestCommunityShare = communities[0] ? communities[0].nodeIds.length / Math.max(1, nodes.length) : 1;
  communities.forEach((community, index) => {
    const dominantCenter = largestCommunityShare >= 0.55 && index === 0;
    const ringIndex = dominantCenter ? 0 : index - (largestCommunityShare >= 0.55 ? 1 : 0);
    const ringCount = Math.max(1, communities.length - (largestCommunityShare >= 0.55 ? 1 : 0));
    const ring = dominantCenter ? 0 : radius * (index < 9 ? 0.64 : index < 32 ? 0.78 : 0.92);
    const angle = dominantCenter ? 0 : (ringIndex / ringCount) * Math.PI * 2 - Math.PI / 2;
    community.centerX = clampPosition(centerX + Math.cos(angle) * ring, graphCanvasPadding, width - graphCanvasPadding);
    community.centerY = clampPosition(centerY + Math.sin(angle) * ring * 0.72, graphCanvasPadding, height - graphCanvasPadding);
    community.radius = Math.max(150, Math.sqrt(community.nodeIds.length) * 72);
  });
  const positionById = new Map<string, StarfieldNodePosition>();
  for (const community of communities) {
    const orderedNodeIds = [...community.nodeIds].sort((left, right) => {
      const leftNode = nodeById.get(left);
      const rightNode = nodeById.get(right);
      return (degreeById.get(right) ?? 0) - (degreeById.get(left) ?? 0)
        || (rightNode?.importanceScore ?? 0) - (leftNode?.importanceScore ?? 0)
        || (rightNode?.mentionCount ?? 0) - (leftNode?.mentionCount ?? 0)
        || left.localeCompare(right);
    });
    orderedNodeIds.forEach((nodeId, index) => {
      const communityId = communityByNodeId.get(nodeId) ?? 0;
      const ring = buildStarfieldRingRadius(index, community.radius);
      const angle = index * graphCanvasStarfieldGoldenAngle + (index % 7) * 0.07 + communityId * 0.11;
      positionById.set(nodeId, {
        x: clampPosition(community.centerX + Math.cos(angle) * ring, graphCanvasPadding, width - graphCanvasPadding),
        y: clampPosition(community.centerY + Math.sin(angle) * ring * 0.72, graphCanvasPadding, height - graphCanvasPadding),
        anchorX: community.centerX,
        anchorY: community.centerY,
        communityId,
        degree: degreeById.get(nodeId) ?? 0,
      });
    });
  }
  return positionById;
}

function buildStarfieldRingRadius(index: number, radius: number) {
  if (index === 0) return 0;
  if (index < 12) return radius * 0.16;
  if (index < 48) return radius * 0.36;
  if (index < 120) return radius * 0.62;
  return radius * 0.9;
}

function runStarfieldForceLayout(
  positionById: Map<string, StarfieldNodePosition>,
  nodeById: Map<string, CharacterGraphNode>,
  edges: CharacterGraphEdge[],
  width: number,
  height: number,
) {
  const nodeCount = positionById.size;
  const iterations = nodeCount > 800 ? 76 : nodeCount > 300 ? 104 : 148;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const drift = iteration < iterations * 0.45 ? 0.045 : 0.018;
    for (const edge of edges) {
      const source = positionById.get(edge.sourceId);
      const target = positionById.get(edge.targetId);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desiredDistance = edge.relationType === 'co-occurrence'
        ? graphCanvasCoOccurrenceDistance
        : graphCanvasRelationDistance;
      const force = ((distance - desiredDistance) / distance) * drift * Math.max(0.35, edge.confidence);
      const moveX = dx * force;
      const moveY = dy * force;
      source.x = clampPosition(source.x + moveX, graphCanvasPadding, width - graphCanvasPadding);
      source.y = clampPosition(source.y + moveY, graphCanvasPadding, height - graphCanvasPadding);
      target.x = clampPosition(target.x - moveX, graphCanvasPadding, width - graphCanvasPadding);
      target.y = clampPosition(target.y - moveY, graphCanvasPadding, height - graphCanvasPadding);
    }

    for (const node of positionById.values()) {
      node.x = clampPosition(node.x + (node.anchorX - node.x) * 0.006, graphCanvasPadding, width - graphCanvasPadding);
      node.y = clampPosition(node.y + (node.anchorY - node.y) * 0.006, graphCanvasPadding, height - graphCanvasPadding);
    }

    resolveStarfieldCollisions(positionById, nodeById, width, height, iteration < iterations * 0.58 ? 18 : 12);
  }
  return iterations;
}

function resolveStarfieldCollisions(
  positionById: Map<string, StarfieldNodePosition>,
  nodeById: Map<string, CharacterGraphNode>,
  width: number,
  height: number,
  padding = 18,
) {
  const items = Array.from(positionById.entries()).map(([id, position]) => ({
    id,
    position,
    radius: buildNodeRadius(nodeById.get(id)!, position.degree),
  }));
  let maxCollisionDistance = 0;
  for (const item of items) {
    maxCollisionDistance = Math.max(maxCollisionDistance, item.radius * 2 + padding);
  }
  const cellSize = Math.max(graphCanvasCollisionCellSize, Math.ceil(maxCollisionDistance));
  const neighborRange = Math.max(1, Math.ceil(maxCollisionDistance / cellSize));
  const grid = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${Math.floor(item.position.x / cellSize)},${Math.floor(item.position.y / cellSize)}`;
    const bucket = grid.get(key) ?? [];
    bucket.push(item);
    grid.set(key, bucket);
  }
  for (const item of items) {
    const gx = Math.floor(item.position.x / cellSize);
    const gy = Math.floor(item.position.y / cellSize);
    for (let ox = -neighborRange; ox <= neighborRange; ox += 1) {
      for (let oy = -neighborRange; oy <= neighborRange; oy += 1) {
        const bucket = grid.get(`${gx + ox},${gy + oy}`) ?? [];
        for (const other of bucket) {
          if (item.id >= other.id) continue;
          const minDistance = item.radius + other.radius + padding;
          let dx = other.position.x - item.position.x;
          let dy = other.position.y - item.position.y;
          let distance = Math.hypot(dx, dy);
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            const angle = (deterministicHash(`${item.id}:${other.id}`) % 6283) / 1000;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const push = (minDistance - distance) * 0.72;
          const nx = dx / distance;
          const ny = dy / distance;
          item.position.x = clampPosition(item.position.x - nx * push, graphCanvasPadding, width - graphCanvasPadding);
          item.position.y = clampPosition(item.position.y - ny * push, graphCanvasPadding, height - graphCanvasPadding);
          other.position.x = clampPosition(other.position.x + nx * push, graphCanvasPadding, width - graphCanvasPadding);
          other.position.y = clampPosition(other.position.y + ny * push, graphCanvasPadding, height - graphCanvasPadding);
        }
      }
    }
  }
  return getMinimumStarfieldNodeGap(items);
}

function getMinimumStarfieldNodeGap(items: Array<{ position: StarfieldNodePosition; radius: number }>) {
  let gap = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    const left = items[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const right = items[rightIndex];
      gap = Math.min(
        gap,
        Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y) - left.radius - right.radius,
      );
    }
  }
  return Number.isFinite(gap) ? gap : 0;
}

function buildNodeRadius(node: CharacterGraphNode, degree: number) {
  const mentionRadius = Math.log2(Math.max(1, node.mentionCount)) * 1.45;
  const degreeRadius = Math.sqrt(Math.max(0, degree)) * 0.86;
  return Math.max(5, Math.min(26, 5 + mentionRadius + degreeRadius));
}

function buildLabelTier(node: CharacterGraphNode, degree: number): 1 | 2 | 3 | 4 {
  const score = node.importanceScore * 1.8 + Math.sqrt(Math.max(0, degree)) * 0.24 + node.mentionCount / 180;
  if (node.role === 'protagonist' || score >= 1.9) return 1;
  if (node.role === 'main' || score >= 1.1) return 2;
  if (score >= 0.55) return 3;
  return 4;
}

function buildLabelScale(labelTier: 1 | 2 | 3 | 4) {
  if (labelTier === 1) return 0.65;
  if (labelTier === 2) return 1.15;
  if (labelTier === 3) return 1.85;
  return 2.7;
}

function buildEdgeCurve(source: CharacterGraphCanvasNode, target: CharacterGraphCanvasNode, edge: CharacterGraphEdge) {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const curveDirection = deterministicHash(edge.id) % 2 === 0 ? 1 : -1;
  const curveSize = Math.min(72, Math.max(12, distance * 0.08)) * curveDirection;
  const crossCommunity = source.communityId !== target.communityId;
  return {
    controlX: Math.round(midX + normalX * curveSize),
    controlY: Math.round(midY + normalY * curveSize),
    alpha: Math.max(0.05, Math.min(0.72, (crossCommunity ? 0.11 : 0.18) + edge.confidence * 0.24 + Math.min(edge.weight, 8) * 0.025)),
  };
}

function deterministicHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function clampPosition(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

class DisjointSet {
  private parent = new Map<string, string>();

  constructor(ids: string[]) {
    for (const id of ids) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent || parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(left: string, right: string) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

function truncateGraphCanvasLabel(label: string) {
  const trimmed = label.trim();
  if (trimmed.length <= graphCanvasLabelMaxLength) return trimmed;
  return `${trimmed.slice(0, graphCanvasLabelMaxLength - 3)}...`;
}

function clampCanvasDimension(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(240, Math.round(value));
}

function clampViewportScale(value: number) {
  if (!Number.isFinite(value)) return graphCanvasDefaultScale;
  return Math.round(Math.min(graphCanvasMaxScale, Math.max(graphCanvasMinScale, value)) * 100) / 100;
}

function clampViewportOffset(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(graphCanvasMaxOffset, Math.max(-graphCanvasMaxOffset, value)));
}

function formatViewportNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

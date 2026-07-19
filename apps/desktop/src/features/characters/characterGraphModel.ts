import type { CharacterEntityKind, CharacterProfile, CharacterRelation } from '../../types';
import type { TranslationKey } from '../../i18n';

export type CharacterGraphBuildOptions = {
  includeHiddenProfiles?: boolean;
  relationTypes?: string[];
  minConfidence?: number;
  chapterRange?: CharacterGraphChapterRange;
  maxNodes?: number;
  focusCharacterId?: string;
  focusDepth?: CharacterGraphFocusDepth;
};

export type CharacterGraphChapterRange = {
  startChapterIndex?: number;
  endChapterIndex?: number;
};

export type CharacterGraphFocusDepth = 0 | 1 | 2 | 'all';
export type CharacterGraphFocusMode = 'all' | 'one-hop' | 'two-hop';

export type CharacterGraphPanelBuildOptions = {
  hasPayload: boolean;
  centerStateId?: string;
  graph?: CharacterGraphModel | null;
  relationCount?: number;
  focusMode?: CharacterGraphFocusMode;
  selectedCharacterId?: string | null;
};

export type CharacterGraphPanelState = {
  status: 'loading' | 'error' | 'empty' | 'ready';
  reason: 'character-index-loading' | 'character-index-error' | 'character-index-unavailable' | 'no-relationships' | 'filtered-empty' | 'focus-empty' | 'aggregated-empty' | 'ready';
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  renderGraph: boolean;
};

export type CharacterGraphNode = {
  id: string;
  label: string;
  kind: CharacterProfile['kind'];
  visual: CharacterGraphNodeVisual;
  role: CharacterProfile['role'];
  aliases: string[];
  importanceScore: number;
  confidence: number;
  mentionCount: number;
  relationCount: number;
  eventCount: number;
  hidden: boolean;
};

export type CharacterGraphNodeVisual = {
  group: 'person' | 'organization' | 'faction' | 'place' | 'artifact' | 'unknown';
  shape: 'circle' | 'hexagon' | 'shield' | 'pin' | 'diamond' | 'square';
  marker: string;
  labelKey: 'characters.profileKind.person' | 'characters.profileKind.organization' | 'characters.profileKind.faction' | 'characters.profileKind.place' | 'characters.profileKind.artifact' | 'characters.profileKind.unknown';
};

export type CharacterGraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  label: string;
  summary: string;
  direction: CharacterRelation['direction'];
  confidence: number;
  weight: number;
  relationIds: string[];
  evidenceIds: string[];
};

export type CharacterGraphModel = {
  nodes: CharacterGraphNode[];
  edges: CharacterGraphEdge[];
  summary: {
    nodeCount: number;
    totalNodeCount: number;
    edgeCount: number;
    relationCount: number;
    aggregatedNodeCount: number;
    aggregatedRelationCount: number;
    focusFilteredNodeCount: number;
    focusFilteredRelationCount: number;
    hiddenRelationCount: number;
    filteredRelationCount: number;
  };
};

export function buildCharacterGraphModel(
  profiles: CharacterProfile[],
  relations: CharacterRelation[],
  options: CharacterGraphBuildOptions = {},
): CharacterGraphModel {
  const includeHiddenProfiles = options.includeHiddenProfiles === true;
  const relationTypeFilter = new Set((options.relationTypes ?? []).map((item) => item.trim()).filter(Boolean));
  const minConfidence = clampGraphConfidence(options.minConfidence ?? 0);
  const chapterRange = normalizeGraphChapterRange(options.chapterRange);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const visibleProfiles = profiles.filter((profile) => includeHiddenProfiles || !profile.hidden);
  const allNodes = visibleProfiles
    .map((profile) => buildCharacterGraphNode(profile))
    .sort(compareCharacterGraphNodes);
  const allVisibleProfileIds = new Set(allNodes.map((node) => node.id));
  const filteredRelations: CharacterRelation[] = [];
  let hiddenRelationCount = 0;
  let filteredRelationCount = 0;

  for (const relation of relations) {
    const source = profileById.get(relation.sourceCharacterId);
    const target = profileById.get(relation.targetCharacterId);
    if (!source || !target) {
      hiddenRelationCount += 1;
      continue;
    }
    if (!allVisibleProfileIds.has(source.id) || !allVisibleProfileIds.has(target.id)) {
      hiddenRelationCount += 1;
      continue;
    }
    if (
      (relationTypeFilter.size > 0 && !relationTypeFilter.has(relation.relationType))
      || relation.confidence < minConfidence
      || !relationIntersectsChapterRange(relation, chapterRange)
    ) {
      filteredRelationCount += 1;
      continue;
    }
    filteredRelations.push(relation);
  }

  const focusDepth = normalizeGraphFocusDepth(options.focusDepth);
  const focusCharacterId = normalizeGraphFocusCharacterId(options.focusCharacterId);
  const focusResult = buildGraphFocusFilter(allNodes, filteredRelations, focusCharacterId, focusDepth);
  const candidateNodes = focusResult.allowedNodeIds
    ? allNodes.filter((node) => focusResult.allowedNodeIds?.has(node.id))
    : allNodes;
  const focusFilteredRelations = focusResult.allowedNodeIds
    ? filteredRelations.filter((relation) => relationMatchesFocusResult(relation, focusResult, focusCharacterId, focusDepth))
    : filteredRelations;
  const focusFilteredRelationCount = focusResult.active
    ? Math.max(0, filteredRelations.length - focusFilteredRelations.length)
    : 0;
  const nodes = candidateNodes;
  const visibleProfileIds = new Set(nodes.map((node) => node.id));
  const edgeByKey = new Map<string, CharacterGraphEdge>();

  for (const relation of focusFilteredRelations) {
    if (!visibleProfileIds.has(relation.sourceCharacterId) || !visibleProfileIds.has(relation.targetCharacterId)) {
      continue;
    }

    const edgeKey = getCharacterGraphEdgeKey(relation);
    const edge = edgeByKey.get(edgeKey);
    if (edge) {
      edge.weight += 1;
      edge.confidence = Math.max(edge.confidence, relation.confidence);
      addUnique(edge.relationIds, relation.id);
      addUniqueMany(edge.evidenceIds, relation.evidenceIds);
      if (!edge.label && relation.label) edge.label = relation.label;
      if (!edge.summary && relation.summary) edge.summary = relation.summary;
      continue;
    }

    edgeByKey.set(edgeKey, {
      id: edgeKey,
      sourceId: getGraphEdgeSourceId(relation),
      targetId: getGraphEdgeTargetId(relation),
      relationType: relation.relationType,
      label: relation.label,
      summary: relation.summary,
      direction: relation.direction,
      confidence: relation.confidence,
      weight: 1,
      relationIds: [relation.id],
      evidenceIds: [...new Set(relation.evidenceIds)],
    });
  }

  const edges = Array.from(edgeByKey.values()).sort(compareCharacterGraphEdges);

  return {
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      totalNodeCount: allNodes.length,
      edgeCount: edges.length,
      relationCount: focusFilteredRelations.length,
      aggregatedNodeCount: 0,
      aggregatedRelationCount: 0,
      focusFilteredNodeCount: focusResult.focusFilteredNodeCount,
      focusFilteredRelationCount,
      filteredRelationCount,
      hiddenRelationCount,
    },
  };
}

export function resolveCharacterGraphPanelState(options: CharacterGraphPanelBuildOptions): CharacterGraphPanelState {
  if (!options.hasPayload) {
    if (options.centerStateId === 'character-index-queued' || options.centerStateId === 'character-index-building') {
      return characterGraphPanelState('loading', 'character-index-loading', 'characters.graphStatus.loadingTitle', 'characters.graphStatus.loadingBody', false);
    }
    if (options.centerStateId === 'character-index-failed') {
      return characterGraphPanelState('error', 'character-index-error', 'characters.graphStatus.errorTitle', 'characters.graphStatus.errorBody', false);
    }
    return characterGraphPanelState('empty', 'character-index-unavailable', 'characters.graphStatus.unavailableTitle', 'characters.graphStatus.unavailableBody', false);
  }

  const graph = options.graph;
  if (!graph || graph.summary.edgeCount > 0) {
    return characterGraphPanelState('ready', 'ready', 'characters.graphStatus.readyTitle', 'characters.graphStatus.readyBody', true);
  }

  const sourceRelationCount = Math.max(0, Math.floor(options.relationCount ?? graph.summary.relationCount));
  if (sourceRelationCount === 0) {
    return characterGraphPanelState('empty', 'no-relationships', 'characters.graphStatus.emptyTitle', 'characters.graphStatus.emptyBody', false);
  }
  if ((options.focusMode === 'one-hop' || options.focusMode === 'two-hop') && options.selectedCharacterId) {
    return characterGraphPanelState('empty', 'focus-empty', 'characters.graphStatus.focusEmptyTitle', 'characters.graphStatus.focusEmptyBody', false);
  }
  if (graph.summary.aggregatedRelationCount > 0 || graph.summary.aggregatedNodeCount > 0) {
    return characterGraphPanelState('empty', 'aggregated-empty', 'characters.graphStatus.aggregatedEmptyTitle', 'characters.graphStatus.aggregatedEmptyBody', false);
  }
  return characterGraphPanelState('empty', 'filtered-empty', 'characters.graphStatus.filteredEmptyTitle', 'characters.graphStatus.filteredEmptyBody', false);
}

function characterGraphPanelState(
  status: CharacterGraphPanelState['status'],
  reason: CharacterGraphPanelState['reason'],
  titleKey: TranslationKey,
  bodyKey: TranslationKey,
  renderGraph: boolean,
): CharacterGraphPanelState {
  return { status, reason, titleKey, bodyKey, renderGraph };
}

function normalizeGraphFocusDepth(depth: CharacterGraphFocusDepth | undefined) {
  if (depth === 1 || depth === 2) return depth;
  return 0;
}

function normalizeGraphFocusCharacterId(characterId: string | undefined) {
  return typeof characterId === 'string' ? characterId.trim() : '';
}

function buildGraphFocusFilter(
  nodes: CharacterGraphNode[],
  relations: CharacterRelation[],
  focusCharacterId: string,
  focusDepth: 0 | 1 | 2,
) {
  if (!focusCharacterId || focusDepth === 0) {
    return {
      active: false,
      allowedNodeIds: null,
      focusFilteredNodeCount: 0,
      focusFilteredRelationCount: 0,
    };
  }

  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  if (!visibleNodeIds.has(focusCharacterId)) {
    return {
      active: true,
      allowedNodeIds: new Set<string>(),
      focusFilteredNodeCount: nodes.length,
      focusFilteredRelationCount: relations.length,
    };
  }

  const adjacency = new Map<string, Set<string>>();
  for (const relation of relations) {
    addGraphNeighbor(adjacency, relation.sourceCharacterId, relation.targetCharacterId);
    addGraphNeighbor(adjacency, relation.targetCharacterId, relation.sourceCharacterId);
  }

  const allowedNodeIds = new Set<string>([focusCharacterId]);
  const distanceById = new Map<string, number>([[focusCharacterId, 0]]);
  const queue = [focusCharacterId];
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const currentId = queue[queueIndex];
    const currentDistance = distanceById.get(currentId) ?? 0;
    if (currentDistance >= focusDepth) continue;
    for (const neighborId of adjacency.get(currentId) ?? []) {
      if (!visibleNodeIds.has(neighborId) || distanceById.has(neighborId)) continue;
      distanceById.set(neighborId, currentDistance + 1);
      allowedNodeIds.add(neighborId);
      queue.push(neighborId);
    }
  }

  const focusFilteredRelationCount = relations.filter((relation) => (
    !allowedNodeIds.has(relation.sourceCharacterId)
    || !allowedNodeIds.has(relation.targetCharacterId)
  )).length;

  return {
    active: true,
    allowedNodeIds,
    focusFilteredNodeCount: Math.max(0, nodes.length - allowedNodeIds.size),
    focusFilteredRelationCount,
  };
}

function addGraphNeighbor(adjacency: Map<string, Set<string>>, sourceId: string, targetId: string) {
  const neighbors = adjacency.get(sourceId) ?? new Set<string>();
  neighbors.add(targetId);
  adjacency.set(sourceId, neighbors);
}

function relationMatchesFocusResult(
  relation: CharacterRelation,
  focusResult: ReturnType<typeof buildGraphFocusFilter>,
  focusCharacterId: string,
  focusDepth: 0 | 1 | 2,
) {
  if (!focusResult.allowedNodeIds?.has(relation.sourceCharacterId) || !focusResult.allowedNodeIds.has(relation.targetCharacterId)) {
    return false;
  }
  if (focusDepth !== 1) return true;
  return relation.sourceCharacterId === focusCharacterId || relation.targetCharacterId === focusCharacterId;
}

function normalizeGraphChapterRange(range: CharacterGraphChapterRange | undefined): Required<CharacterGraphChapterRange> | null {
  if (!range) return null;
  const rawStart = normalizeChapterIndex(range.startChapterIndex);
  const rawEnd = normalizeChapterIndex(range.endChapterIndex);
  if (rawStart === null && rawEnd === null) return null;
  const start = rawStart ?? 0;
  const end = rawEnd ?? Number.MAX_SAFE_INTEGER;
  return start <= end ? { startChapterIndex: start, endChapterIndex: end } : { startChapterIndex: end, endChapterIndex: start };
}

function relationIntersectsChapterRange(relation: CharacterRelation, range: Required<CharacterGraphChapterRange> | null) {
  if (!range) return true;
  const firstSeenChapter = getLocationChapterIndex(relation.firstSeen);
  const lastSeenChapter = getLocationChapterIndex(relation.lastSeen);
  if (firstSeenChapter === null && lastSeenChapter === null) return false;
  const relationStart = Math.min(firstSeenChapter ?? lastSeenChapter ?? 0, lastSeenChapter ?? firstSeenChapter ?? 0);
  const relationEnd = Math.max(firstSeenChapter ?? lastSeenChapter ?? 0, lastSeenChapter ?? firstSeenChapter ?? 0);
  return relationEnd >= range.startChapterIndex && relationStart <= range.endChapterIndex;
}

function getLocationChapterIndex(location: CharacterRelation['firstSeen']) {
  if (!location) return null;
  return normalizeChapterIndex(location.sourceChapterIndex ?? location.chapterIndex);
}

function normalizeChapterIndex(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function clampGraphConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildCharacterGraphNode(profile: CharacterProfile): CharacterGraphNode {
  return {
    id: profile.id,
    label: profile.displayName || profile.canonicalName,
    kind: profile.kind,
    visual: getCharacterGraphNodeVisual(profile.kind),
    role: profile.role,
    aliases: profile.aliases.map((alias) => alias.name),
    importanceScore: profile.importanceScore,
    confidence: profile.confidence,
    mentionCount: profile.mentionCount,
    relationCount: profile.relationCount,
    eventCount: profile.eventCount,
    hidden: profile.hidden,
  };
}

export function getCharacterGraphNodeVisual(kind: CharacterEntityKind): CharacterGraphNodeVisual {
  if (kind === 'person') {
    return { group: 'person', shape: 'circle', marker: 'P', labelKey: 'characters.profileKind.person' };
  }
  if (kind === 'organization') {
    return { group: 'organization', shape: 'hexagon', marker: 'O', labelKey: 'characters.profileKind.organization' };
  }
  if (kind === 'faction') {
    return { group: 'faction', shape: 'shield', marker: 'F', labelKey: 'characters.profileKind.faction' };
  }
  if (kind === 'place') {
    return { group: 'place', shape: 'pin', marker: 'L', labelKey: 'characters.profileKind.place' };
  }
  if (kind === 'artifact') {
    return { group: 'artifact', shape: 'diamond', marker: 'A', labelKey: 'characters.profileKind.artifact' };
  }
  return { group: 'unknown', shape: 'square', marker: '?', labelKey: 'characters.profileKind.unknown' };
}

function getCharacterGraphEdgeKey(relation: CharacterRelation) {
  if (relation.direction === 'directed') {
    return `${relation.sourceCharacterId}->${relation.targetCharacterId}::${relation.relationType}`;
  }
  const [sourceId, targetId] = sortPair(relation.sourceCharacterId, relation.targetCharacterId);
  return `${sourceId}--${targetId}::${relation.relationType}`;
}

function getGraphEdgeSourceId(relation: CharacterRelation) {
  if (relation.direction === 'directed') return relation.sourceCharacterId;
  return sortPair(relation.sourceCharacterId, relation.targetCharacterId)[0];
}

function getGraphEdgeTargetId(relation: CharacterRelation) {
  if (relation.direction === 'directed') return relation.targetCharacterId;
  return sortPair(relation.sourceCharacterId, relation.targetCharacterId)[1];
}

function sortPair(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

function addUnique(items: string[], item: string) {
  if (!items.includes(item)) items.push(item);
}

function addUniqueMany(items: string[], values: string[]) {
  for (const value of values) addUnique(items, value);
}

function compareCharacterGraphNodes(left: CharacterGraphNode, right: CharacterGraphNode) {
  if (left.importanceScore !== right.importanceScore) return right.importanceScore - left.importanceScore;
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

function compareCharacterGraphEdges(left: CharacterGraphEdge, right: CharacterGraphEdge) {
  return left.sourceId.localeCompare(right.sourceId)
    || left.targetId.localeCompare(right.targetId)
    || left.relationType.localeCompare(right.relationType)
    || left.direction.localeCompare(right.direction)
    || left.id.localeCompare(right.id);
}

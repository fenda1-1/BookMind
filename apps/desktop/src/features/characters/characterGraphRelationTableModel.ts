import type { CharacterGraphModel } from './characterGraphModel';

export type CharacterGraphRelationTableRow =
  | {
    type: 'group';
    id: string;
    sourceId: string;
    edgeCount: number;
    targetCount: number;
    previewTargetIds: string[];
    expanded: boolean;
  }
  | {
    type: 'edge';
    id: string;
    sourceId: string;
    edge: CharacterGraphModel['edges'][number];
  };

export type CharacterGraphRelationTableGroup = {
  sourceId: string;
  edges: CharacterGraphModel['edges'];
  targetIds: string[];
};

export function buildCharacterGraphRelationTableRows(
  graph: CharacterGraphModel,
  nodeLabelById: Map<string, string>,
  searchQuery: string,
  expandedSourceIds: Set<string>,
): CharacterGraphRelationTableRow[] {
  const normalizedQuery = normalizeCharacterGraphRelationTableQuery(searchQuery);
  const groups = buildCharacterGraphRelationTableGroups(graph.edges, nodeLabelById, normalizedQuery);
  const rows: CharacterGraphRelationTableRow[] = [];
  for (const group of groups) {
    const expanded = expandedSourceIds.has(group.sourceId);
    rows.push({
      type: 'group',
      id: `group:${group.sourceId}`,
      sourceId: group.sourceId,
      edgeCount: group.edges.length,
      targetCount: group.targetIds.length,
      previewTargetIds: group.targetIds.slice(0, 4),
      expanded,
    });
    if (!expanded) continue;
    for (const edge of group.edges) {
      rows.push({
        type: 'edge',
        id: `edge:${edge.id}`,
        sourceId: group.sourceId,
        edge,
      });
    }
  }
  return rows;
}

export function buildCharacterGraphRelationTableGroups(
  edges: CharacterGraphModel['edges'],
  nodeLabelById: Map<string, string>,
  normalizedQuery: string,
): CharacterGraphRelationTableGroup[] {
  const groupBySourceId = new Map<string, CharacterGraphRelationTableGroup>();
  for (const edge of edges) {
    if (normalizedQuery && !matchesCharacterGraphRelationTableQuery(edge, nodeLabelById, normalizedQuery)) continue;
    const group = groupBySourceId.get(edge.sourceId) ?? {
      sourceId: edge.sourceId,
      edges: [],
      targetIds: [],
    };
    group.edges.push(edge);
    if (!group.targetIds.includes(edge.targetId)) group.targetIds.push(edge.targetId);
    groupBySourceId.set(edge.sourceId, group);
  }
  return [...groupBySourceId.values()].sort((left, right) => (
    right.edges.length - left.edges.length
    || (nodeLabelById.get(left.sourceId) ?? left.sourceId).localeCompare(nodeLabelById.get(right.sourceId) ?? right.sourceId)
    || left.sourceId.localeCompare(right.sourceId)
  ));
}

function matchesCharacterGraphRelationTableQuery(
  edge: CharacterGraphModel['edges'][number],
  nodeLabelById: Map<string, string>,
  normalizedQuery: string,
) {
  return [
    nodeLabelById.get(edge.sourceId) ?? edge.sourceId,
    nodeLabelById.get(edge.targetId) ?? edge.targetId,
    edge.label,
    edge.relationType,
  ].some((value) => normalizeCharacterGraphRelationTableQuery(value).includes(normalizedQuery));
}

function normalizeCharacterGraphRelationTableQuery(value: string | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

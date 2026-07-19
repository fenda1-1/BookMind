import type { CharacterCenterPayload, CharacterEvidence, CharacterProfile, CharacterRelation } from '../../types';
import type { CharacterGraphEdge } from './characterGraphModel';

export type CharacterGraphEdgeDetail = {
  edge: CharacterGraphEdge;
  sourceProfile: CharacterProfile;
  targetProfile: CharacterProfile;
  relations: CharacterRelation[];
  evidence: CharacterEvidence[];
  summary: {
    relationCount: number;
    evidenceCount: number;
    confidencePercent: number;
    weight: number;
  };
};

export function buildCharacterGraphEdgeDetail(
  payload: CharacterCenterPayload | null,
  edge: CharacterGraphEdge | null,
): CharacterGraphEdgeDetail | null {
  if (!payload || !edge) return null;
  const profileById = new Map(payload.profiles.map((profile) => [profile.id, profile]));
  const sourceProfile = profileById.get(edge.sourceId);
  const targetProfile = profileById.get(edge.targetId);
  if (!sourceProfile || !targetProfile) return null;

  const relationIds = new Set(edge.relationIds);
  const evidenceIds = new Set(edge.evidenceIds);
  const relations = payload.relations
    .filter((relation) => relationIds.has(relation.id))
    .sort(compareGraphDetailRelations);
  const evidence = payload.evidence
    .filter((item) => evidenceIds.has(item.id) || relationIds.has(item.targetId) || item.targetId === edge.id)
    .sort(compareGraphDetailEvidence);

  return {
    edge,
    sourceProfile,
    targetProfile,
    relations,
    evidence,
    summary: {
      relationCount: relations.length,
      evidenceCount: evidence.length,
      confidencePercent: Math.round(Math.max(0, Math.min(1, edge.confidence)) * 100),
      weight: edge.weight,
    },
  };
}

function compareGraphDetailRelations(left: CharacterRelation, right: CharacterRelation) {
  return right.confidence - left.confidence || left.id.localeCompare(right.id);
}

function compareGraphDetailEvidence(left: CharacterEvidence, right: CharacterEvidence) {
  return compareLocationParts(
    left.location.sourceChapterIndex,
    left.location.paragraphIndex,
    left.location.startOffset,
    right.location.sourceChapterIndex,
    right.location.paragraphIndex,
    right.location.startOffset,
  ) || left.id.localeCompare(right.id);
}

function compareLocationParts(
  leftChapter = Number.MAX_SAFE_INTEGER,
  leftParagraph = Number.MAX_SAFE_INTEGER,
  leftOffset = Number.MAX_SAFE_INTEGER,
  rightChapter = Number.MAX_SAFE_INTEGER,
  rightParagraph = Number.MAX_SAFE_INTEGER,
  rightOffset = Number.MAX_SAFE_INTEGER,
) {
  if (leftChapter !== rightChapter) return leftChapter - rightChapter;
  if (leftParagraph !== rightParagraph) return leftParagraph - rightParagraph;
  return leftOffset - rightOffset;
}

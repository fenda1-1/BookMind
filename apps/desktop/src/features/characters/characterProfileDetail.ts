import type {
  CharacterAlias,
  CharacterAppearanceStat,
  CharacterCenterPayload,
  CharacterEvent,
  CharacterEvidence,
  CharacterFactionMembership,
  CharacterMention,
  CharacterProfile,
  CharacterRelation,
} from '../../types';
import type { TranslationKey } from '../../i18n';

export type CharacterProfileDetail = {
  profile: CharacterProfile;
  aliases: CharacterAlias[];
  mentions: CharacterMention[];
  relations: CharacterRelation[];
  events: CharacterEvent[];
  factionMemberships: CharacterFactionMembership[];
  appearanceStats: CharacterAppearanceStat[];
  evidence: CharacterEvidence[];
  relatedCharacterIds: string[];
  relatedProfiles: CharacterProfile[];
  meta: {
    importancePercent: number;
    confidencePercent: number;
    sourceLabelKey: TranslationKey;
    sourceStateLabelKey: TranslationKey;
    tags: string[];
  };
  counts: {
    mentions: number;
    relations: number;
    events: number;
    evidence: number;
    appearances: number;
  };
};

export type CharacterProfileDetailOptions = {
  previewLimit?: number;
};

type CharacterProfileDetailIndex = {
  profileById: Map<string, CharacterProfile>;
  mentionsByCharacterId: Map<string, CharacterMention[]>;
  relationsByCharacterId: Map<string, CharacterRelation[]>;
  eventsByCharacterId: Map<string, CharacterEvent[]>;
  factionMembershipsByCharacterId: Map<string, CharacterFactionMembership[]>;
  appearanceStatsByCharacterId: Map<string, CharacterAppearanceStat[]>;
  evidenceById: Map<string, CharacterEvidence>;
  evidenceByTargetKey: Map<string, CharacterEvidence[]>;
};

const characterProfileDetailIndexCache = new WeakMap<CharacterCenterPayload, CharacterProfileDetailIndex>();

export function preloadCharacterProfileDetailIndex(payload: CharacterCenterPayload | null) {
  if (!payload) return;
  getCharacterProfileDetailIndex(payload);
}

export function buildCharacterProfileDetail(
  payload: CharacterCenterPayload | null,
  characterId: string,
  options: CharacterProfileDetailOptions = {},
): CharacterProfileDetail | null {
  if (!payload || !characterId) return null;
  const index = getCharacterProfileDetailIndex(payload);
  const profile = index.profileById.get(characterId);
  if (!profile) return null;

  const previewLimit = resolveCharacterProfileDetailPreviewLimit(options.previewLimit);
  const allMentions = getSortedCharacterProfileDetailItems(index.mentionsByCharacterId, characterId, compareCharacterMentionLocation);
  const allRelations = getSortedCharacterProfileDetailItems(index.relationsByCharacterId, characterId, (left, right) => compareByFirstSeen(left, right) || left.id.localeCompare(right.id));
  const allEvents = getSortedCharacterProfileDetailItems(index.eventsByCharacterId, characterId, compareCharacterEventLocation);
  const allFactionMemberships = getSortedCharacterProfileDetailItems(index.factionMembershipsByCharacterId, characterId, compareByCreatedAt);
  const allAppearanceStats = getSortedCharacterProfileDetailItems(index.appearanceStatsByCharacterId, characterId, (left, right) => getAppearanceChapterIndex(left) - getAppearanceChapterIndex(right));
  const mentions = limitCharacterProfileDetailItems(allMentions, previewLimit);
  const relations = limitCharacterProfileDetailItems(allRelations, previewLimit);
  const events = limitCharacterProfileDetailItems(allEvents, previewLimit);
  const factionMemberships = limitCharacterProfileDetailItems(allFactionMemberships, previewLimit);
  const appearanceStats = limitCharacterProfileDetailItems(allAppearanceStats, previewLimit);
  const aliasIds = new Set(profile.aliases.map((item) => item.id));
  const relevantEvidenceIds = new Set<string>([
    ...allRelations.flatMap((item) => item.evidenceIds),
    ...allEvents.flatMap((item) => item.evidenceIds),
    ...allFactionMemberships.flatMap((item) => item.evidenceIds),
    ...allMentions.map((item) => item.id),
  ]);
  const eventIds = new Set(allEvents.map((item) => item.id));
  const factionMembershipIds = new Set(allFactionMemberships.map((item) => item.id));
  const allEvidence = collectCharacterProfileEvidence(index, characterId, aliasIds, eventIds, factionMembershipIds, relevantEvidenceIds, previewLimit);
  const evidence = limitCharacterProfileDetailItems(allEvidence, previewLimit);
  const relatedCharacterIds = Array.from(new Set(allRelations.flatMap((item) => [
    item.sourceCharacterId === characterId ? item.targetCharacterId : item.sourceCharacterId,
  ]).filter((id) => id && id !== characterId)));
  const relatedProfiles = relatedCharacterIds
    .slice(0, previewLimit)
    .map((id) => index.profileById.get(id))
    .filter((item): item is CharacterProfile => Boolean(item));

  return {
    profile,
    aliases: [...profile.aliases],
    mentions,
    relations,
    events,
    factionMemberships,
    appearanceStats,
    evidence,
    relatedCharacterIds,
    relatedProfiles,
    meta: {
      importancePercent: toPercent(profile.importanceScore),
      confidencePercent: toPercent(profile.confidence),
      sourceLabelKey: getCharacterSourceLabelKey(profile.source),
      sourceStateLabelKey: getCharacterSourceStateLabelKey(profile.source),
      tags: [...profile.tags],
    },
    counts: {
      mentions: allMentions.length,
      relations: allRelations.length,
      events: allEvents.length,
      evidence: countCharacterProfileEvidence(index, characterId, aliasIds, eventIds, factionMembershipIds, relevantEvidenceIds),
      appearances: allAppearanceStats.length,
    },
  };
}

function getCharacterProfileDetailIndex(payload: CharacterCenterPayload): CharacterProfileDetailIndex {
  const cached = characterProfileDetailIndexCache.get(payload);
  if (cached) return cached;
  const index: CharacterProfileDetailIndex = {
    profileById: new Map(payload.profiles.map((item) => [item.id, item])),
    mentionsByCharacterId: new Map(),
    relationsByCharacterId: new Map(),
    eventsByCharacterId: new Map(),
    factionMembershipsByCharacterId: new Map(),
    appearanceStatsByCharacterId: new Map(),
    evidenceById: new Map(),
    evidenceByTargetKey: new Map(),
  };
  for (const mention of payload.mentions) pushCharacterProfileDetailMapItem(index.mentionsByCharacterId, mention.characterId, mention);
  for (const relation of payload.relations) {
    pushCharacterProfileDetailMapItem(index.relationsByCharacterId, relation.sourceCharacterId, relation);
    if (relation.targetCharacterId !== relation.sourceCharacterId) pushCharacterProfileDetailMapItem(index.relationsByCharacterId, relation.targetCharacterId, relation);
  }
  for (const event of payload.events) {
    for (const characterId of event.participantCharacterIds) pushCharacterProfileDetailMapItem(index.eventsByCharacterId, characterId, event);
  }
  for (const faction of payload.factionMemberships) pushCharacterProfileDetailMapItem(index.factionMembershipsByCharacterId, faction.characterId, faction);
  for (const stat of payload.appearanceStats) pushCharacterProfileDetailMapItem(index.appearanceStatsByCharacterId, stat.characterId, stat);
  for (const evidence of payload.evidence) {
    index.evidenceById.set(evidence.id, evidence);
    pushCharacterProfileDetailMapItem(index.evidenceByTargetKey, buildCharacterProfileEvidenceTargetKey(evidence.targetType, evidence.targetId), evidence);
  }
  characterProfileDetailIndexCache.set(payload, index);
  return index;
}

function collectCharacterProfileEvidence(
  index: CharacterProfileDetailIndex,
  characterId: string,
  aliasIds: Set<string>,
  eventIds: Set<string>,
  factionMembershipIds: Set<string>,
  relevantEvidenceIds: Set<string>,
  limit = Number.POSITIVE_INFINITY,
) {
  const evidenceById = new Map<string, CharacterEvidence>();
  const enoughEvidence = () => Number.isFinite(limit) && evidenceById.size >= limit;
  const addEvidence = (evidence: CharacterEvidence | undefined) => {
    if (evidence && !enoughEvidence()) evidenceById.set(evidence.id, evidence);
  };
  for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey('profile', characterId)) ?? []) addEvidence(evidence);
  for (const aliasId of aliasIds) {
    if (enoughEvidence()) break;
    for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey('alias', aliasId)) ?? []) addEvidence(evidence);
  }
  for (const eventId of eventIds) {
    if (enoughEvidence()) break;
    for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey('event', eventId)) ?? []) addEvidence(evidence);
  }
  for (const factionId of factionMembershipIds) {
    if (enoughEvidence()) break;
    for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey('faction', factionId)) ?? []) addEvidence(evidence);
  }
  for (const evidenceId of relevantEvidenceIds) {
    if (enoughEvidence()) break;
    addEvidence(index.evidenceById.get(evidenceId));
    for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey('mention', evidenceId)) ?? []) addEvidence(evidence);
    for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey('relation', evidenceId)) ?? []) addEvidence(evidence);
  }
  return [...evidenceById.values()].sort((left, right) => compareCharacterEvidenceLocation(left, right) || left.id.localeCompare(right.id));
}

function countCharacterProfileEvidence(
  index: CharacterProfileDetailIndex,
  characterId: string,
  aliasIds: Set<string>,
  eventIds: Set<string>,
  factionMembershipIds: Set<string>,
  relevantEvidenceIds: Set<string>,
) {
  const evidenceIds = new Set<string>();
  const addEvidenceIds = (targetType: string, targetId: string) => {
    for (const evidence of index.evidenceByTargetKey.get(buildCharacterProfileEvidenceTargetKey(targetType, targetId)) ?? []) {
      evidenceIds.add(evidence.id);
    }
  };
  addEvidenceIds('profile', characterId);
  for (const aliasId of aliasIds) addEvidenceIds('alias', aliasId);
  for (const eventId of eventIds) addEvidenceIds('event', eventId);
  for (const factionId of factionMembershipIds) addEvidenceIds('faction', factionId);
  for (const evidenceId of relevantEvidenceIds) {
    if (index.evidenceById.has(evidenceId)) evidenceIds.add(evidenceId);
    addEvidenceIds('mention', evidenceId);
    addEvidenceIds('relation', evidenceId);
  }
  return evidenceIds.size;
}

function pushCharacterProfileDetailMapItem<T>(map: Map<string, T[]>, key: string, item: T) {
  const items = map.get(key);
  if (items) items.push(item);
  else map.set(key, [item]);
}

function buildCharacterProfileEvidenceTargetKey(targetType: string, targetId: string) {
  return `${targetType}:${targetId}`;
}

function getSortedCharacterProfileDetailItems<T>(map: Map<string, T[]>, key: string, compare: (left: T, right: T) => number) {
  return [...(map.get(key) ?? [])].sort(compare);
}

function resolveCharacterProfileDetailPreviewLimit(limit: number | undefined) {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor(limit);
}

function limitCharacterProfileDetailItems<T>(items: T[], limit: number) {
  return Number.isFinite(limit) ? items.slice(0, limit) : items;
}

function compareCharacterMentionLocation(left: CharacterMention, right: CharacterMention) {
  return compareLocationParts(
    left.location.sourceChapterIndex,
    left.location.paragraphIndex,
    left.location.startOffset,
    right.location.sourceChapterIndex,
    right.location.paragraphIndex,
    right.location.startOffset,
  );
}

function compareCharacterEventLocation(left: CharacterEvent, right: CharacterEvent) {
  return compareLocationParts(
    left.location.sourceChapterIndex,
    left.location.paragraphIndex,
    left.location.startOffset,
    right.location.sourceChapterIndex,
    right.location.paragraphIndex,
    right.location.startOffset,
  );
}

function compareCharacterEvidenceLocation(left: CharacterEvidence, right: CharacterEvidence) {
  return compareLocationParts(
    left.location.sourceChapterIndex,
    left.location.paragraphIndex,
    left.location.startOffset,
    right.location.sourceChapterIndex,
    right.location.paragraphIndex,
    right.location.startOffset,
  );
}

function compareByFirstSeen(left: CharacterRelation, right: CharacterRelation) {
  return compareLocationParts(
    left.firstSeen?.sourceChapterIndex,
    left.firstSeen?.paragraphIndex,
    left.firstSeen?.startOffset,
    right.firstSeen?.sourceChapterIndex,
    right.firstSeen?.paragraphIndex,
    right.firstSeen?.startOffset,
  );
}

function compareByCreatedAt(left: { createdAt: string }, right: { createdAt: string }) {
  return left.createdAt.localeCompare(right.createdAt);
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

function getAppearanceChapterIndex(stat: CharacterAppearanceStat) {
  return stat.sourceChapterIndex ?? stat.chapterIndex;
}

function toPercent(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function getCharacterSourceLabelKey(source: CharacterProfile['source']) {
  if (source === 'manual') return 'characters.profileSource.manual';
  if (source === 'ai') return 'characters.profileSource.ai';
  if (source === 'rule') return 'characters.profileSource.rule';
  return 'characters.profileSource.imported';
}

function getCharacterSourceStateLabelKey(source: CharacterProfile['source']) {
  if (source === 'manual') return 'characters.detailEditedByHuman';
  if (source === 'imported') return 'characters.detailImportedData';
  return 'characters.detailGeneratedByMachine';
}

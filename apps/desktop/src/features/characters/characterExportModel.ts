import type {
  CharacterCenterPayload,
  CharacterEvidence,
  CharacterExportOptions,
  CharacterLocation,
  CharacterMention,
  CharacterProfile,
  CharacterRelation,
  CharacterSpoilerLimit,
} from '../../types';
import {
  buildCharacterCsvExportFiles,
  buildCharacterCytoscapeJsonExportFile,
  buildCharacterGraphmlExportFile,
  buildCharacterJsonExportFile,
  buildCharacterMarkdownExportFile,
  buildCharacterMentionsJsonlExportFile,
  buildCharacterMermaidExportFile,
  buildCharacterRelationsJsonExportFile,
  type CharacterExportFile as CharacterExportFileRecord,
  type CharacterExportScope,
} from './characterExportFormatAdapters';
export const characterExportSchemaVersion = 'bookmind.character-export.v1';

export type CharacterExportFile = CharacterExportFileRecord;

export type CharacterExportModel = {
  schemaVersion: typeof characterExportSchemaVersion;
  generatedAt: string;
  files: CharacterExportFile[];
  counts: {
    profiles: number;
    relations: number;
    evidence: number;
    mentions: number;
  };
  warnings: string[];
};

type CharacterExportCounts = CharacterExportModel['counts'];

const spoilerRedactionValue = '[后文人物]';

export function buildCharacterExportModel(
  payload: CharacterCenterPayload | null,
  options: CharacterExportOptions,
): CharacterExportModel {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!payload) {
    return {
      schemaVersion: characterExportSchemaVersion,
      generatedAt,
      files: [],
      counts: emptyCharacterExportCounts(),
      warnings: ['missing-payload'],
    };
  }

  const scope = buildCharacterExportScope(payload, options);
  const base: Omit<CharacterExportModel, 'files'> = {
    schemaVersion: characterExportSchemaVersion,
    generatedAt,
    counts: {
      profiles: scope.profiles.length,
      relations: scope.relations.length,
      evidence: scope.evidence.length,
      mentions: scope.mentions.length,
    },
    warnings: [] as string[],
  };

  if (options.format === 'json') {
    return {
      ...base,
      files: [buildCharacterJsonExportFile(payload, scope, options, generatedAt, characterExportSchemaVersion)],
    };
  }

  if (options.format === 'csv') {
    return {
      ...base,
      files: buildCharacterCsvExportFiles(scope, options),
    };
  }

  if (options.format === 'relations-json') {
    return {
      ...base,
      files: [buildCharacterRelationsJsonExportFile(scope, options, generatedAt)],
    };
  }

  if (options.format === 'mentions-jsonl') {
    return {
      ...base,
      files: [buildCharacterMentionsJsonlExportFile(scope, options, generatedAt)],
    };
  }

  if (options.format === 'mermaid') {
    return {
      ...base,
      files: [buildCharacterMermaidExportFile(scope, options, generatedAt)],
    };
  }

  if (options.format === 'graphml') {
    return {
      ...base,
      files: [buildCharacterGraphmlExportFile(scope, options, generatedAt)],
    };
  }

  if (options.format === 'cytoscape-json') {
    return {
      ...base,
      files: [buildCharacterCytoscapeJsonExportFile(scope, options, generatedAt)],
    };
  }

  return {
    ...base,
    files: [buildCharacterMarkdownExportFile(payload, scope, options, generatedAt, characterExportSchemaVersion)],
  };
}

function buildCharacterExportScope(
  payload: CharacterCenterPayload,
  options: CharacterExportOptions,
): CharacterExportScope {
  const spoilerLimit = normalizeSpoilerLimit(options.spoilerLimit);
  const selectedCharacterIds = new Set((options.selectedCharacterIds ?? []).map((id) => id.trim()).filter(Boolean));
  const includeHidden = options.includeHidden === true;
  const selectedExplicitly = selectedCharacterIds.size > 0;
  const baseProfiles = payload.profiles
    .filter((profile) => includeHidden || !profile.hidden)
    .filter((profile) => !selectedExplicitly || selectedCharacterIds.has(profile.id))
    .filter((profile) => !options.onlyMajorCharacters || isMajorExportCharacter(profile))
    .filter((profile) => isProfileBeforeSpoilerLimit(profile, spoilerLimit));
  const profileIds = new Set(baseProfiles.map((profile) => profile.id));
  const aliasesByProfileId = new Map(baseProfiles.map((profile) => [profile.id, filterProfileAliasesForSpoiler(profile, spoilerLimit)]));
  const aliasIds = new Set(Array.from(aliasesByProfileId.values()).flatMap((aliases) => aliases.map((alias) => alias.id)));
  const redactedNames = spoilerLimit ? collectSpoilerRedactionNames(payload.profiles, profileIds, aliasIds) : [];
  const scopedMentions = payload.mentions
    .filter((mention) => profileIds.has(mention.characterId))
    .filter((mention) => isLocationBeforeSpoilerLimit(mention.location, spoilerLimit));
  const mentionIds = new Set(scopedMentions.map((mention) => mention.id));
  const includeRelations = options.includeRelations !== false;
  const relationCandidates = includeRelations
    ? payload.relations
      .filter((relation) => profileIds.has(relation.sourceCharacterId) && profileIds.has(relation.targetCharacterId))
      .filter((relation) => isRelationBeforeSpoilerLimit(relation, spoilerLimit))
    : [];
  const relationCandidateIds = new Set(relationCandidates.map((relation) => relation.id));
  const scopedEvidence = payload.evidence
    .filter((item) => isLocationBeforeSpoilerLimit(item.location, spoilerLimit))
    .filter((item) => evidenceMatchesExportScope(item, payload, profileIds, relationCandidateIds, mentionIds, aliasIds, Boolean(spoilerLimit)));
  const scopedEvidenceIds = new Set(scopedEvidence.map((item) => item.id));
  const relations = relationCandidates
    .filter((relation) => relation.evidenceIds.length === 0 || relation.evidenceIds.some((id) => scopedEvidenceIds.has(id)))
    .map((relation) => redactSpoilerRelation({
      ...relation,
      evidenceIds: relation.evidenceIds.filter((id) => scopedEvidenceIds.has(id)),
      lastSeen: clampRelationLastSeen(relation, scopedEvidence, spoilerLimit),
    }, redactedNames))
    .sort(compareExportRelations);
  const relationIds = new Set(relations.map((relation) => relation.id));
  const mentions = options.includeMentions === false
    ? []
    : scopedMentions
      .map((mention) => redactSpoilerMention(mention, redactedNames))
      .sort(compareExportMentions);
  const evidence = options.includeEvidence === false
    ? []
    : scopedEvidence
      .filter((item) => evidenceMatchesExportScope(item, payload, profileIds, relationIds, mentionIds, aliasIds, Boolean(spoilerLimit)))
      .map((item) => redactSpoilerEvidence(item, redactedNames))
      .sort(compareExportEvidence);
  const relationCountByProfileId = countRelationsByProfileId(relations);
  const mentionCountByProfileId = countMentionsByProfileId(scopedMentions);
  const profiles = baseProfiles
    .map((profile) => applySpoilerProfileScope(profile, {
      aliases: aliasesByProfileId.get(profile.id) ?? profile.aliases,
      mentionCount: mentionCountByProfileId.get(profile.id) ?? 0,
      relationCount: relationCountByProfileId.get(profile.id) ?? 0,
      lastAppearance: getLatestVisibleProfileLocation(profile, scopedMentions),
      redactedNames,
      spoilerLimit,
    }))
    .sort(compareExportProfiles);

  return {
    book: payload.book,
    profiles,
    profileIds,
    relations,
    relationIds,
    mentions,
    evidence,
  };
}

function evidenceMatchesExportScope(
  evidence: CharacterEvidence,
  payload: CharacterCenterPayload,
  profileIds: Set<string>,
  relationIds: Set<string>,
  mentionIds: Set<string> = new Set(),
  aliasIds: Set<string> = new Set(),
  strictScopedTargets = false,
) {
  if (evidence.targetType === 'profile') return profileIds.has(evidence.targetId);
  if (strictScopedTargets && evidence.targetType === 'alias') return aliasIds.has(evidence.targetId);
  if (strictScopedTargets && evidence.targetType === 'mention') return mentionIds.has(evidence.targetId);
  if (evidence.targetType === 'alias') return aliasIds.has(evidence.targetId) || payload.profiles
    .some((profile) => profileIds.has(profile.id) && profile.aliases.some((alias) => alias.id === evidence.targetId));
  if (evidence.targetType === 'mention') return mentionIds.has(evidence.targetId) || payload.mentions
    .some((mention) => mention.id === evidence.targetId && profileIds.has(mention.characterId));
  if (evidence.targetType === 'relation') {
    return relationIds.has(evidence.targetId);
  }
  if (evidence.targetType === 'event') return payload.events
    .some((event) => event.id === evidence.targetId && event.participantCharacterIds.some((id) => profileIds.has(id)));
  if (evidence.targetType === 'faction') return payload.factionMemberships
    .some((membership) => membership.id === evidence.targetId && profileIds.has(membership.characterId));
  return false;
}

function normalizeSpoilerLimit(spoilerLimit: CharacterSpoilerLimit | undefined) {
  if (!spoilerLimit) return null;
  const chapterIndex = normalizeLocationNumber(spoilerLimit.sourceChapterIndex);
  const paragraphIndex = normalizeLocationNumber(spoilerLimit.paragraphIndex);
  if (chapterIndex === undefined && paragraphIndex === undefined) return null;
  return {
    sourceChapterIndex: chapterIndex,
    paragraphIndex,
  };
}

function normalizeLocationNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.floor(value);
}

function isProfileBeforeSpoilerLimit(profile: CharacterProfile, spoilerLimit: ReturnType<typeof normalizeSpoilerLimit>) {
  if (!spoilerLimit) return true;
  return isLocationBeforeSpoilerLimit(profile.firstAppearance, spoilerLimit);
}

function isRelationBeforeSpoilerLimit(relation: CharacterRelation, spoilerLimit: ReturnType<typeof normalizeSpoilerLimit>) {
  if (!spoilerLimit) return true;
  const relationLocation = relation.firstSeen ?? relation.lastSeen;
  return isLocationBeforeSpoilerLimit(relationLocation, spoilerLimit);
}

function isLocationBeforeSpoilerLimit(location: CharacterLocation | undefined, spoilerLimit: ReturnType<typeof normalizeSpoilerLimit>) {
  if (!spoilerLimit) return true;
  if (!location) return false;
  const chapterIndex = location.sourceChapterIndex ?? location.chapterIndex;
  if (typeof chapterIndex === 'number' && typeof spoilerLimit.sourceChapterIndex === 'number') {
    if (chapterIndex < spoilerLimit.sourceChapterIndex) return true;
    if (chapterIndex > spoilerLimit.sourceChapterIndex) return false;
  }
  if (typeof chapterIndex !== 'number' && typeof spoilerLimit.sourceChapterIndex === 'number') return false;

  const paragraphIndex = location.paragraphIndex ?? location.paragraphStart;
  if (typeof paragraphIndex === 'number' && typeof spoilerLimit.paragraphIndex === 'number') {
    return paragraphIndex <= spoilerLimit.paragraphIndex;
  }
  return typeof spoilerLimit.paragraphIndex !== 'number';
}

function filterProfileAliasesForSpoiler(profile: CharacterProfile, spoilerLimit: ReturnType<typeof normalizeSpoilerLimit>) {
  if (!spoilerLimit) return profile.aliases;
  return profile.aliases.filter((alias) => isLocationBeforeSpoilerLimit(alias.firstSeen ?? profile.firstAppearance, spoilerLimit));
}

function collectSpoilerRedactionNames(
  profiles: CharacterProfile[],
  visibleProfileIds: Set<string>,
  visibleAliasIds: Set<string>,
) {
  return Array.from(new Set(profiles.flatMap((profile) => {
    const names = visibleProfileIds.has(profile.id)
      ? profile.aliases
        .filter((alias) => !visibleAliasIds.has(alias.id))
        .flatMap((alias) => [alias.name, alias.normalizedName])
      : [profile.displayName, profile.canonicalName, ...profile.aliases.flatMap((alias) => [alias.name, alias.normalizedName])];
    return names.map((name) => name.trim()).filter((name) => name.length >= 2);
  }))).sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function redactSpoilerRelation(relation: CharacterRelation, redactedNames: string[]) {
  if (redactedNames.length === 0) return relation;
  return {
    ...relation,
    label: redactSpoilerText(relation.label, redactedNames),
    summary: redactSpoilerText(relation.summary, redactedNames),
  };
}

function redactSpoilerEvidence(evidence: CharacterEvidence, redactedNames: string[]) {
  if (redactedNames.length === 0) return evidence;
  return {
    ...evidence,
    claim: redactSpoilerText(evidence.claim, redactedNames),
    quote: redactSpoilerText(evidence.quote, redactedNames),
  };
}

function redactSpoilerMention(mention: CharacterMention, redactedNames: string[]) {
  if (redactedNames.length === 0) return mention;
  return {
    ...mention,
    quote: redactSpoilerText(mention.quote, redactedNames),
    prefixText: redactSpoilerText(mention.prefixText ?? '', redactedNames),
    suffixText: redactSpoilerText(mention.suffixText ?? '', redactedNames),
  };
}

function applySpoilerProfileScope(
  profile: CharacterProfile,
  options: {
    aliases: CharacterProfile['aliases'];
    mentionCount: number;
    relationCount: number;
    lastAppearance: CharacterLocation | undefined;
    redactedNames: string[];
    spoilerLimit: ReturnType<typeof normalizeSpoilerLimit>;
  },
) {
  if (!options.spoilerLimit) return profile;
  return {
    ...profile,
    aliases: options.aliases,
    summary: '',
    tags: [],
    mentionCount: options.mentionCount,
    relationCount: options.relationCount,
    lastAppearance: options.lastAppearance ?? profile.firstAppearance,
    factionMemberships: profile.factionMemberships
      .filter((membership) => isLocationBeforeSpoilerLimit(membership.joinedAt, options.spoilerLimit))
      .map((membership) => ({
        ...membership,
        factionName: redactSpoilerText(membership.factionName, options.redactedNames),
        role: redactSpoilerText(membership.role, options.redactedNames),
      })),
  };
}

function countRelationsByProfileId(relations: CharacterRelation[]) {
  const counts = new Map<string, number>();
  for (const relation of relations) {
    counts.set(relation.sourceCharacterId, (counts.get(relation.sourceCharacterId) ?? 0) + 1);
    if (relation.targetCharacterId !== relation.sourceCharacterId) {
      counts.set(relation.targetCharacterId, (counts.get(relation.targetCharacterId) ?? 0) + 1);
    }
  }
  return counts;
}

function countMentionsByProfileId(mentions: CharacterMention[]) {
  const counts = new Map<string, number>();
  for (const mention of mentions) {
    counts.set(mention.characterId, (counts.get(mention.characterId) ?? 0) + 1);
  }
  return counts;
}

function getLatestVisibleProfileLocation(profile: CharacterProfile, mentions: CharacterMention[]) {
  const profileMentions = mentions.filter((mention) => mention.characterId === profile.id);
  if (profileMentions.length === 0) return profile.firstAppearance;
  return profileMentions
    .map((mention) => mention.location)
    .sort((left, right) => compareExportLocation(right, left))[0] ?? profile.firstAppearance;
}

function clampRelationLastSeen(
  relation: CharacterRelation,
  evidence: CharacterEvidence[],
  spoilerLimit: ReturnType<typeof normalizeSpoilerLimit>,
) {
  if (!spoilerLimit || isLocationBeforeSpoilerLimit(relation.lastSeen, spoilerLimit)) return relation.lastSeen;
  const evidenceLocations = evidence
    .filter((item) => item.targetType === 'relation' && item.targetId === relation.id)
    .map((item) => item.location);
  return evidenceLocations.sort((left, right) => compareExportLocation(right, left))[0] ?? relation.firstSeen;
}

function redactSpoilerText(value: string, redactedNames: string[]) {
  if (!value || redactedNames.length === 0) return value;
  let next = value;
  for (const name of redactedNames) {
    next = next.split(name).join(spoilerRedactionValue);
  }
  return next;
}

function compareExportProfiles(left: CharacterProfile, right: CharacterProfile) {
  return right.importanceScore - left.importanceScore
    || right.mentionCount - left.mentionCount
    || left.displayName.localeCompare(right.displayName)
    || left.id.localeCompare(right.id);
}

function compareExportRelations(left: CharacterRelation, right: CharacterRelation) {
  return compareExportLocation(left.firstSeen, right.firstSeen)
    || left.id.localeCompare(right.id);
}

function compareExportMentions(left: CharacterMention, right: CharacterMention) {
  return compareExportLocation(left.location, right.location)
    || left.id.localeCompare(right.id);
}

function compareExportEvidence(left: CharacterEvidence, right: CharacterEvidence) {
  return compareExportLocation(left.location, right.location)
    || left.id.localeCompare(right.id);
}

function compareExportLocation(left: CharacterLocation | undefined, right: CharacterLocation | undefined) {
  return locationPart(left?.sourceChapterIndex ?? left?.chapterIndex) - locationPart(right?.sourceChapterIndex ?? right?.chapterIndex)
    || locationPart(left?.paragraphIndex ?? left?.paragraphStart) - locationPart(right?.paragraphIndex ?? right?.paragraphStart)
    || locationPart(left?.startOffset) - locationPart(right?.startOffset);
}

function locationPart(value: number | undefined) {
  return value ?? Number.MAX_SAFE_INTEGER;
}

function isMajorExportCharacter(profile: CharacterProfile) {
  return profile.role === 'protagonist'
    || profile.importanceScore >= 0.85
    || profile.mentionCount >= 50;
}

function emptyCharacterExportCounts() {
  return { profiles: 0, relations: 0, evidence: 0, mentions: 0 };
}

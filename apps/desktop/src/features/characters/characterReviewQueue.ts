import type {
  CharacterCenterPayload,
  CharacterEvidence,
  CharacterLocation,
  CharacterMention,
  CharacterProfile,
  CharacterRelation,
} from '../../types';

export const characterReviewQueueSchemaVersion = 'bookmind.character-review-queue.v1';

export type CharacterReviewIssueType =
  | 'low-confidence-profile'
  | 'low-confidence-mention'
  | 'low-confidence-relation'
  | 'duplicate-profile'
  | 'relation-missing-evidence'
  | 'broken-evidence'
  | 'stale-evidence'
  | 'pending-evidence';

export type CharacterReviewIssueSeverity = 'blocker' | 'important' | 'minor';

export type CharacterReviewQueueOptions = {
  lowProfileConfidenceThreshold?: number;
  lowMentionConfidenceThreshold?: number;
  lowRelationConfidenceThreshold?: number;
  duplicateNameSimilarityThreshold?: number;
  maxIssues?: number;
  includeHiddenProfiles?: boolean;
};

export type CharacterReviewIssue = {
  id: string;
  type: CharacterReviewIssueType;
  severity: CharacterReviewIssueSeverity;
  targetId: string;
  targetLabel: string;
  relatedCharacterIds: string[];
  title: string;
  description: string;
  actionHint: string;
  score: number;
  confidence?: number;
  locationLabel: string;
  evidencePreview: string;
};

export type CharacterReviewQueue = {
  schemaVersion: typeof characterReviewQueueSchemaVersion;
  bookId: string;
  generatedAt: string;
  items: CharacterReviewIssue[];
  summary: {
    totalCount: number;
    byType: Partial<Record<CharacterReviewIssueType, number>>;
    bySeverity: Record<CharacterReviewIssueSeverity, number>;
  };
  warnings: string[];
};

type NormalizedReviewOptions = Required<CharacterReviewQueueOptions>;

export function buildCharacterReviewQueue(
  payload: CharacterCenterPayload | null,
  options: CharacterReviewQueueOptions = {},
): CharacterReviewQueue {
  const normalizedOptions = normalizeReviewOptions(options);
  if (!payload) {
    return {
      schemaVersion: characterReviewQueueSchemaVersion,
      bookId: '',
      generatedAt: new Date().toISOString(),
      items: [],
      summary: emptyReviewSummary(),
      warnings: ['missing-payload'],
    };
  }

  const profileById = new Map(payload.profiles.map((profile) => [profile.id, profile]));
  const mentionById = new Map(payload.mentions.map((mention) => [mention.id, mention]));
  const relationById = new Map(payload.relations.map((relation) => [relation.id, relation]));
  const issues = [
    ...buildBrokenEvidenceIssues(payload.evidence, profileById, mentionById, relationById),
    ...buildStaleEvidenceIssues(payload.evidence, profileById, mentionById, relationById),
    ...buildPendingEvidenceIssues(payload.evidence, profileById, mentionById, relationById),
    ...buildLowConfidenceProfileIssues(payload.profiles, normalizedOptions),
    ...buildDuplicateProfileIssues(payload.profiles, normalizedOptions),
    ...buildRelationMissingEvidenceIssues(payload.relations, profileById, normalizedOptions),
    ...buildLowConfidenceRelationIssues(payload.relations, profileById, normalizedOptions),
    ...buildLowConfidenceMentionIssues(payload.mentions, profileById, normalizedOptions),
  ].sort(compareReviewIssues);
  const truncatedItems = issues.slice(0, normalizedOptions.maxIssues);
  const warnings = issues.length > truncatedItems.length ? ['truncated'] : [];

  return {
    schemaVersion: characterReviewQueueSchemaVersion,
    bookId: payload.book.id,
    generatedAt: new Date().toISOString(),
    items: truncatedItems,
    summary: buildReviewSummary(truncatedItems),
    warnings,
  };
}

function buildBrokenEvidenceIssues(
  evidenceItems: CharacterEvidence[],
  profileById: Map<string, CharacterProfile>,
  mentionById: Map<string, CharacterMention>,
  relationById: Map<string, CharacterRelation>,
) {
  return evidenceItems
    .filter((evidence) => evidence.status === 'broken')
    .map((evidence) => {
      const relatedCharacterIds = relatedCharacterIdsForEvidence(evidence, profileById, mentionById, relationById);
      return reviewIssue({
        id: `review-broken-evidence-${evidence.id}`,
        type: 'broken-evidence',
        severity: 'blocker',
        targetId: evidence.id,
        targetLabel: evidence.claim || evidence.id,
        relatedCharacterIds,
        title: '证据无法回跳',
        description: `证据 ${evidence.id} 已标记为失效，原文定位需要修复或重新绑定。`,
        actionHint: '重新定位证据、重新生成该条事实或忽略该证据',
        score: 1,
        confidence: evidence.confidence,
        locationLabel: formatReviewLocation(evidence.location),
        evidencePreview: evidence.quote,
      });
    });
}

function buildPendingEvidenceIssues(
  evidenceItems: CharacterEvidence[],
  profileById: Map<string, CharacterProfile>,
  mentionById: Map<string, CharacterMention>,
  relationById: Map<string, CharacterRelation>,
) {
  return evidenceItems
    .filter((evidence) => evidence.status === 'pending-review')
    .map((evidence) => reviewIssue({
      id: `review-pending-evidence-${evidence.id}`,
      type: 'pending-evidence',
      severity: 'important',
      targetId: evidence.id,
      targetLabel: evidence.claim || evidence.id,
      relatedCharacterIds: relatedCharacterIdsForEvidence(evidence, profileById, mentionById, relationById),
      title: '证据待审查',
      description: `证据 ${evidence.id} 需要人工确认后才能作为高置信度事实。`,
      actionHint: '确认该证据、修改关联目标或忽略该证据',
      score: 1 - clampRatio(evidence.confidence),
      confidence: evidence.confidence,
      locationLabel: formatReviewLocation(evidence.location),
      evidencePreview: evidence.quote,
    }));
}

function buildStaleEvidenceIssues(
  evidenceItems: CharacterEvidence[],
  profileById: Map<string, CharacterProfile>,
  mentionById: Map<string, CharacterMention>,
  relationById: Map<string, CharacterRelation>,
) {
  return evidenceItems
    .filter((evidence) => evidence.status === 'stale')
    .map((evidence) => reviewIssue({
      id: `review-stale-evidence-${evidence.id}`,
      type: 'stale-evidence',
      severity: 'important',
      targetId: evidence.id,
      targetLabel: evidence.claim || evidence.id,
      relatedCharacterIds: relatedCharacterIdsForEvidence(evidence, profileById, mentionById, relationById),
      title: '证据已过期',
      description: `证据 ${evidence.id} 来自旧索引或旧规则，需要重新确认。`,
      actionHint: '重新定位证据、刷新人物识别或忽略该证据',
      score: 1 - clampRatio(evidence.confidence),
      confidence: evidence.confidence,
      locationLabel: formatReviewLocation(evidence.location),
      evidencePreview: evidence.quote,
    }));
}

function buildLowConfidenceProfileIssues(
  profiles: CharacterProfile[],
  options: NormalizedReviewOptions,
) {
  return profiles
    .filter((profile) => options.includeHiddenProfiles || !profile.hidden)
    .filter((profile) => profile.confidence < options.lowProfileConfidenceThreshold)
    .map((profile) => reviewIssue({
      id: `review-low-confidence-profile-${profile.id}`,
      type: 'low-confidence-profile',
      severity: 'important',
      targetId: profile.id,
      targetLabel: profile.displayName || profile.canonicalName,
      relatedCharacterIds: [profile.id],
      title: '低置信度人物',
      description: `${profile.displayName || profile.canonicalName} 的人物档案置信度低于阈值。`,
      actionHint: '确认人物、合并到已有角色或隐藏该候选',
      score: 1 - clampRatio(profile.confidence),
      confidence: profile.confidence,
      locationLabel: formatReviewLocation(profile.firstAppearance),
      evidencePreview: profile.summary,
    }));
}

function buildLowConfidenceMentionIssues(
  mentions: CharacterMention[],
  profileById: Map<string, CharacterProfile>,
  options: NormalizedReviewOptions,
) {
  return mentions
    .filter((mention) => mention.confidence < options.lowMentionConfidenceThreshold)
    .filter((mention) => {
      const profile = profileById.get(mention.characterId);
      return options.includeHiddenProfiles || !profile?.hidden;
    })
    .map((mention) => reviewIssue({
      id: `review-low-confidence-mention-${mention.id}`,
      type: 'low-confidence-mention',
      severity: 'minor',
      targetId: mention.id,
      targetLabel: mention.name || mention.id,
      relatedCharacterIds: [mention.characterId],
      title: '低置信度提及',
      description: `${mention.name || mention.id} 的提及置信度低于阈值。`,
      actionHint: '确认指代、改绑人物或忽略该提及',
      score: 1 - clampRatio(mention.confidence),
      confidence: mention.confidence,
      locationLabel: formatReviewLocation(mention.location),
      evidencePreview: mention.quote,
    }));
}

function buildLowConfidenceRelationIssues(
  relations: CharacterRelation[],
  profileById: Map<string, CharacterProfile>,
  options: NormalizedReviewOptions,
) {
  return relations
    .filter((relation) => relation.confidence < options.lowRelationConfidenceThreshold)
    .filter((relation) => relationEndpointsVisible(relation, profileById, options))
    .map((relation) => reviewIssue({
      id: `review-low-confidence-relation-${relation.id}`,
      type: 'low-confidence-relation',
      severity: 'minor',
      targetId: relation.id,
      targetLabel: relation.label || relation.relationType,
      relatedCharacterIds: relationCharacterIds(relation),
      title: '低置信度关系',
      description: `${formatRelationName(relation, profileById)} 的关系置信度低于阈值。`,
      actionHint: '确认关系、补充证据或降低关系权重',
      score: 1 - clampRatio(relation.confidence),
      confidence: relation.confidence,
      locationLabel: formatReviewLocation(relation.firstSeen),
      evidencePreview: relation.summary,
    }));
}

function buildRelationMissingEvidenceIssues(
  relations: CharacterRelation[],
  profileById: Map<string, CharacterProfile>,
  options: NormalizedReviewOptions,
) {
  return relations
    .filter((relation) => relation.evidenceIds.length === 0)
    .filter((relation) => relationEndpointsVisible(relation, profileById, options))
    .map((relation) => reviewIssue({
      id: `review-relation-missing-evidence-${relation.id}`,
      type: 'relation-missing-evidence',
      severity: 'important',
      targetId: relation.id,
      targetLabel: relation.label || relation.relationType,
      relatedCharacterIds: relationCharacterIds(relation),
      title: '关系缺少证据',
      description: `${formatRelationName(relation, profileById)} 没有绑定任何原文证据。`,
      actionHint: '补充证据、降低置信度或忽略该关系',
      score: 1,
      confidence: relation.confidence,
      locationLabel: formatReviewLocation(relation.firstSeen),
      evidencePreview: relation.summary,
    }));
}

function buildDuplicateProfileIssues(
  profiles: CharacterProfile[],
  options: NormalizedReviewOptions,
) {
  const visibleProfiles = profiles.filter((profile) => options.includeHiddenProfiles || !profile.hidden);
  const issues: CharacterReviewIssue[] = [];
  for (let leftIndex = 0; leftIndex < visibleProfiles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < visibleProfiles.length; rightIndex += 1) {
      const left = visibleProfiles[leftIndex];
      const right = visibleProfiles[rightIndex];
      const score = nameSimilarity(left.displayName || left.canonicalName, right.displayName || right.canonicalName);
      if (score < options.duplicateNameSimilarityThreshold) continue;
      const leftName = left.displayName || left.canonicalName;
      const rightName = right.displayName || right.canonicalName;
      issues.push(reviewIssue({
        id: `review-duplicate-profile-${left.id}-${right.id}`,
        type: 'duplicate-profile',
        severity: 'important',
        targetId: `${left.id}:${right.id}`,
        targetLabel: `${leftName} / ${rightName}`,
        relatedCharacterIds: [left.id, right.id],
        title: '疑似重复人物',
        description: `${leftName} 与 ${rightName} 名称相似，可能需要合并或拆分。`,
        actionHint: '合并人物、标记为重名不同人或忽略',
        score,
        confidence: Math.min(left.confidence, right.confidence),
        locationLabel: formatReviewLocation(left.firstAppearance ?? right.firstAppearance),
        evidencePreview: `${left.summary}\n${right.summary}`,
      }));
    }
  }
  return issues;
}

function reviewIssue(issue: CharacterReviewIssue): CharacterReviewIssue {
  return {
    ...issue,
    relatedCharacterIds: Array.from(new Set(issue.relatedCharacterIds.filter(Boolean))),
    evidencePreview: truncateReviewText(issue.evidencePreview),
  };
}

function relatedCharacterIdsForEvidence(
  evidence: CharacterEvidence,
  profileById: Map<string, CharacterProfile>,
  mentionById: Map<string, CharacterMention>,
  relationById: Map<string, CharacterRelation>,
) {
  if (evidence.targetType === 'profile') return profileById.has(evidence.targetId) ? [evidence.targetId] : [];
  if (evidence.targetType === 'mention') {
    const mention = mentionById.get(evidence.targetId);
    return mention ? [mention.characterId] : [];
  }
  if (evidence.targetType === 'relation') {
    const relation = relationById.get(evidence.targetId);
    return relation ? relationCharacterIds(relation) : [];
  }
  return [];
}

function relationCharacterIds(relation: CharacterRelation) {
  return Array.from(new Set([relation.sourceCharacterId, relation.targetCharacterId].filter(Boolean)));
}

function relationEndpointsVisible(
  relation: CharacterRelation,
  profileById: Map<string, CharacterProfile>,
  options: NormalizedReviewOptions,
) {
  const source = profileById.get(relation.sourceCharacterId);
  const target = profileById.get(relation.targetCharacterId);
  if (!source || !target) return false;
  return options.includeHiddenProfiles || (!source.hidden && !target.hidden);
}

function formatRelationName(relation: CharacterRelation, profileById: Map<string, CharacterProfile>) {
  const source = profileById.get(relation.sourceCharacterId);
  const target = profileById.get(relation.targetCharacterId);
  return `${source?.displayName || source?.canonicalName || relation.sourceCharacterId} -> ${target?.displayName || target?.canonicalName || relation.targetCharacterId}`;
}

function compareReviewIssues(left: CharacterReviewIssue, right: CharacterReviewIssue) {
  return severityRank(left.severity) - severityRank(right.severity)
    || typeRank(left.type) - typeRank(right.type)
    || right.score - left.score
    || left.targetId.localeCompare(right.targetId)
    || left.id.localeCompare(right.id);
}

function severityRank(severity: CharacterReviewIssueSeverity) {
  if (severity === 'blocker') return 0;
  if (severity === 'important') return 1;
  return 2;
}

function typeRank(type: CharacterReviewIssueType) {
  return [
    'broken-evidence',
    'stale-evidence',
    'pending-evidence',
    'low-confidence-profile',
    'duplicate-profile',
    'relation-missing-evidence',
    'low-confidence-relation',
    'low-confidence-mention',
  ].indexOf(type);
}

function buildReviewSummary(items: CharacterReviewIssue[]): CharacterReviewQueue['summary'] {
  const byType: Partial<Record<CharacterReviewIssueType, number>> = {};
  const bySeverity: Record<CharacterReviewIssueSeverity, number> = {
    blocker: 0,
    important: 0,
    minor: 0,
  };
  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    bySeverity[item.severity] += 1;
  }
  return {
    totalCount: items.length,
    byType,
    bySeverity,
  };
}

function emptyReviewSummary(): CharacterReviewQueue['summary'] {
  return {
    totalCount: 0,
    byType: {},
    bySeverity: {
      blocker: 0,
      important: 0,
      minor: 0,
    },
  };
}

function normalizeReviewOptions(options: CharacterReviewQueueOptions): NormalizedReviewOptions {
  return {
    lowProfileConfidenceThreshold: clampRatio(options.lowProfileConfidenceThreshold ?? 0.6),
    lowMentionConfidenceThreshold: clampRatio(options.lowMentionConfidenceThreshold ?? 0.72),
    lowRelationConfidenceThreshold: clampRatio(options.lowRelationConfidenceThreshold ?? 0.7),
    duplicateNameSimilarityThreshold: clampRatio(options.duplicateNameSimilarityThreshold ?? 0.82),
    maxIssues: Math.max(1, Math.floor(options.maxIssues ?? 200)),
    includeHiddenProfiles: options.includeHiddenProfiles === true,
  };
}

function formatReviewLocation(location: CharacterLocation | undefined) {
  if (!location) return '-';
  const chapter = location.chapterTitle || (typeof location.sourceChapterIndex === 'number'
    ? `第${location.sourceChapterIndex}章`
    : typeof location.chapterIndex === 'number'
      ? `第${location.chapterIndex}章`
      : '-');
  const paragraph = typeof location.paragraphIndex === 'number'
    ? `段落${location.paragraphIndex}`
    : typeof location.paragraphStart === 'number'
      ? `段落${location.paragraphStart}`
      : '';
  return paragraph ? `${chapter}:段落${paragraph.replace(/^段落/, '')}` : chapter;
}

function truncateReviewText(value: string) {
  const trimmed = value.trim();
  if (Array.from(trimmed).length <= 140) return trimmed;
  return `${Array.from(trimmed).slice(0, 140).join('')}...`;
}

function nameSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const shorter = normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = normalizedLeft.length > normalizedRight.length ? normalizedLeft : normalizedRight;
  if (longer.includes(shorter)) return (shorter.length + 1) / (longer.length + 1);
  return lcsLength(normalizedLeft, normalizedRight) / Math.max(normalizedLeft.length, normalizedRight.length);
}

function normalizeName(value: string) {
  return Array.from(value.trim().toLocaleLowerCase().replace(/\s+/g, '')).join('');
}

function lcsLength(left: string, right: string) {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  const previous = Array(rightChars.length + 1).fill(0);
  const current = Array(rightChars.length + 1).fill(0);
  for (let leftIndex = 0; leftIndex < leftChars.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightChars.length; rightIndex += 1) {
      current[rightIndex + 1] = leftChars[leftIndex] === rightChars[rightIndex]
        ? previous[rightIndex] + 1
        : Math.max(previous[rightIndex + 1], current[rightIndex]);
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
      current[index] = 0;
    }
  }
  return previous[rightChars.length];
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

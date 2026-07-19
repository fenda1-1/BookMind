import type { CharacterAppearanceStat, CharacterCenterPayload, CharacterLocation, CharacterProfile } from '../../types';
import { buildCharacterReviewQueue, type CharacterReviewQueue } from './characterReviewQueue';

export type CharacterOverviewSummaryStat = {
  id: 'characters' | 'relations' | 'evidence' | 'chapter-coverage' | 'review';
  value: string;
};

export type CharacterOverviewSummaryProfile = {
  id: string;
  name: string;
  role: CharacterProfile['role'];
  mentionCount: number;
  relationCount: number;
  confidence: number;
  rankLabel: string;
  location?: CharacterLocation;
};

export type CharacterOverviewSummaryAppearance = {
  id: string;
  characterId: string;
  name: string;
  chapterIndex: number;
  chapterTitle: string;
  mentionCount: number;
  location?: CharacterLocation;
};

export type CharacterOverviewChapterCoverage = {
  coveredChapters: number;
  totalChapters: number;
  ratio: number;
  label: string;
};

export type CharacterOverviewSummary = {
  stats: CharacterOverviewSummaryStat[];
  chapterCoverage: CharacterOverviewChapterCoverage;
  reviewSummary: CharacterReviewQueue['summary'];
  mainProfiles: CharacterOverviewSummaryProfile[];
  recentAppearances: CharacterOverviewSummaryAppearance[];
};

export type CharacterOverviewSummaryOptions = {
  totalChapterCount?: number;
  maxMainProfiles?: number;
  maxRecentAppearances?: number;
};

export function buildCharacterOverviewSummary(
  payload: CharacterCenterPayload | null,
  options: CharacterOverviewSummaryOptions = {},
): CharacterOverviewSummary {
  const visibleProfiles = payload ? payload.profiles.filter((profile) => !profile.hidden) : [];
  const reviewQueue = buildCharacterReviewQueue(payload);
  const chapterCoverage = buildChapterCoverage(payload, options.totalChapterCount ?? 0);

  return {
    stats: [
      stat('characters', String(visibleProfiles.length)),
      stat('relations', String(payload?.relations.length ?? 0)),
      stat('evidence', String(payload?.evidence.length ?? 0)),
      stat('chapter-coverage', chapterCoverage.label),
      stat('review', String(reviewQueue.summary.totalCount)),
    ],
    chapterCoverage,
    reviewSummary: reviewQueue.summary,
    mainProfiles: buildMainProfiles(visibleProfiles, options.maxMainProfiles ?? 5),
    recentAppearances: buildRecentAppearances(payload, visibleProfiles, options.maxRecentAppearances ?? 5),
  };
}

function stat(id: CharacterOverviewSummaryStat['id'], value: string): CharacterOverviewSummaryStat {
  return { id, value };
}

function buildChapterCoverage(payload: CharacterCenterPayload | null, totalChapterCount: number): CharacterOverviewChapterCoverage {
  const normalizedTotal = Math.max(0, Math.floor(totalChapterCount));
  if (!payload || normalizedTotal <= 0) {
    return { coveredChapters: 0, totalChapters: normalizedTotal, ratio: 0, label: '-' };
  }

  const coveredChapterIndexes = new Set<number>();
  for (const appearance of payload.appearanceStats) {
    addChapterIndex(coveredChapterIndexes, appearance.sourceChapterIndex ?? appearance.chapterIndex);
  }
  for (const mention of payload.mentions) {
    addChapterIndex(coveredChapterIndexes, mention.location.sourceChapterIndex ?? mention.location.chapterIndex);
  }
  for (const evidence of payload.evidence) {
    addChapterIndex(coveredChapterIndexes, evidence.location.sourceChapterIndex ?? evidence.location.chapterIndex);
  }

  const coveredChapters = [...coveredChapterIndexes].filter((chapterIndex) => chapterIndex >= 0 && chapterIndex < normalizedTotal).length;
  const ratio = normalizedTotal > 0 ? coveredChapters / normalizedTotal : 0;
  return {
    coveredChapters,
    totalChapters: normalizedTotal,
    ratio,
    label: `${Math.min(100, Math.round(ratio * 100))}%`,
  };
}

function addChapterIndex(indexes: Set<number>, value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  indexes.add(Math.floor(value));
}

function buildMainProfiles(profiles: CharacterProfile[], maxItems: number): CharacterOverviewSummaryProfile[] {
  return profiles
    .slice()
    .sort(compareMainProfiles)
    .slice(0, Math.max(0, maxItems))
    .map((profile, index) => ({
      id: profile.id,
      name: profile.displayName || profile.canonicalName,
      role: profile.role,
      mentionCount: profile.mentionCount,
      relationCount: profile.relationCount,
      confidence: profile.confidence,
      rankLabel: `#${index + 1}`,
      location: profile.firstAppearance,
    }));
}

function compareMainProfiles(left: CharacterProfile, right: CharacterProfile) {
  return right.importanceScore - left.importanceScore
    || right.mentionCount - left.mentionCount
    || right.relationCount - left.relationCount
    || left.displayName.localeCompare(right.displayName, 'zh-Hans-CN');
}

function buildRecentAppearances(
  payload: CharacterCenterPayload | null,
  profiles: CharacterProfile[],
  maxItems: number,
): CharacterOverviewSummaryAppearance[] {
  if (!payload) return [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const latestAppearanceByCharacter = new Map<string, CharacterAppearanceStat>();
  for (const appearance of payload.appearanceStats) {
    const profile = profileById.get(appearance.characterId);
    if (!profile) continue;
    const current = latestAppearanceByCharacter.get(appearance.characterId);
    if (!current || compareAppearancePosition(appearance, current) > 0) {
      latestAppearanceByCharacter.set(appearance.characterId, appearance);
    }
  }

  return [...latestAppearanceByCharacter.values()]
    .sort((left, right) => compareAppearancePosition(right, left) || right.mentionCount - left.mentionCount)
    .slice(0, Math.max(0, maxItems))
    .map((appearance) => {
      const profile = profileById.get(appearance.characterId);
      return {
        id: appearance.id,
        characterId: appearance.characterId,
        name: profile?.displayName || profile?.canonicalName || appearance.characterId,
        chapterIndex: appearance.sourceChapterIndex ?? appearance.chapterIndex,
        chapterTitle: appearance.chapterTitle,
        mentionCount: appearance.mentionCount,
        location: profile?.lastAppearance,
      };
    });
}

function compareAppearancePosition(left: CharacterAppearanceStat, right: CharacterAppearanceStat) {
  return (left.sourceChapterIndex ?? left.chapterIndex) - (right.sourceChapterIndex ?? right.chapterIndex)
    || (left.lastParagraphIndex ?? left.firstParagraphIndex ?? 0) - (right.lastParagraphIndex ?? right.firstParagraphIndex ?? 0);
}

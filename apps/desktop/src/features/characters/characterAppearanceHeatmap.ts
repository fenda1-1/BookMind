import type { CharacterAppearanceStat, CharacterLocation, CharacterProfile } from '../../types';

export type CharacterAppearanceHeatmapOptions = {
  bookId: string;
  profiles: CharacterProfile[];
  appearanceStats: CharacterAppearanceStat[];
  selectedCharacterId?: string | null;
  includeHiddenProfiles?: boolean;
};

export type CharacterAppearanceHeatmapCharacter = {
  characterId: string;
  label: string;
  role: CharacterProfile['role'];
  mentionCount: number;
  evidenceCount: number;
  chapterCount: number;
  heat: number;
  confidence: number;
};

export type CharacterAppearanceHeatmapChapter = {
  id: string;
  sourceChapterIndex: number;
  chapterIndex: number;
  chapterTitle: string;
  mentionCount: number;
  evidenceCount: number;
  characterCount: number;
  heat: number;
  maxMentionCount: number;
  selectedMentionCount: number;
  topCharacters: CharacterAppearanceHeatmapCharacter[];
  location: CharacterLocation;
};

export type CharacterAppearanceHeatmapModel = {
  summary: {
    characterCount: number;
    chapterCount: number;
    mentionCount: number;
    evidenceCount: number;
    hottestChapterTitle: string;
  };
  characterRankings: CharacterAppearanceHeatmapCharacter[];
  chapterBuckets: CharacterAppearanceHeatmapChapter[];
  selectedCharacter: CharacterAppearanceHeatmapCharacter | null;
  selectedCharacterChapters: CharacterAppearanceHeatmapChapter[];
};

export function buildCharacterAppearanceHeatmapModel(options: CharacterAppearanceHeatmapOptions): CharacterAppearanceHeatmapModel {
  const includeHiddenProfiles = options.includeHiddenProfiles === true;
  const profileById = new Map(options.profiles
    .filter((profile) => includeHiddenProfiles || !profile.hidden)
    .map((profile) => [profile.id, profile]));
  const stats = options.appearanceStats.filter((item) => profileById.has(item.characterId));
  const characterById = new Map<string, CharacterAppearanceHeatmapCharacter>();
  const chapterByKey = new Map<string, MutableChapterBucket>();

  for (const stat of stats) {
    const profile = profileById.get(stat.characterId);
    if (!profile) continue;
    const character = getOrCreateCharacterBucket(characterById, profile);
    character.mentionCount += stat.mentionCount;
    character.evidenceCount += stat.evidenceCount;
    character.heat += stat.heat || stat.mentionCount;

    const chapterKey = getChapterKey(stat);
    const chapter = getOrCreateChapterBucket(chapterByKey, stat, options.bookId);
    chapter.mentionCount += stat.mentionCount;
    chapter.evidenceCount += stat.evidenceCount;
    chapter.heat += stat.heat || stat.mentionCount;
    chapter.maxMentionCount = Math.max(chapter.maxMentionCount, stat.mentionCount);
    chapter.characterIds.add(stat.characterId);
    chapter.characterMentions.set(stat.characterId, (chapter.characterMentions.get(stat.characterId) ?? 0) + stat.mentionCount);
    chapter.characterEvidence.set(stat.characterId, (chapter.characterEvidence.get(stat.characterId) ?? 0) + stat.evidenceCount);
    if (options.selectedCharacterId && stat.characterId === options.selectedCharacterId) {
      chapter.selectedMentionCount += stat.mentionCount;
    }
    if (!chapterByKey.has(chapterKey)) chapterByKey.set(chapterKey, chapter);
  }

  for (const chapter of chapterByKey.values()) {
    for (const characterId of chapter.characterIds) {
      const character = characterById.get(characterId);
      if (character) character.chapterCount += 1;
    }
  }

  const characterRankings = [...characterById.values()].sort(compareHeatmapCharacters);
  const chapterBuckets = [...chapterByKey.values()].map((chapter) => finalizeChapterBucket(chapter, characterById)).sort(compareHeatmapChapters);
  const selectedCharacter = options.selectedCharacterId ? characterById.get(options.selectedCharacterId) ?? null : null;
  const selectedCharacterChapters = options.selectedCharacterId
    ? chapterBuckets.filter((chapter) => chapter.selectedMentionCount > 0)
    : [];
  const hottestChapter = [...chapterBuckets].sort((left, right) => right.mentionCount - left.mentionCount || compareHeatmapChapters(left, right))[0];

  return {
    summary: {
      characterCount: characterRankings.length,
      chapterCount: chapterBuckets.length,
      mentionCount: characterRankings.reduce((total, item) => total + item.mentionCount, 0),
      evidenceCount: characterRankings.reduce((total, item) => total + item.evidenceCount, 0),
      hottestChapterTitle: hottestChapter?.chapterTitle ?? '',
    },
    characterRankings,
    chapterBuckets,
    selectedCharacter,
    selectedCharacterChapters,
  };
}

type MutableChapterBucket = {
  id: string;
  sourceChapterIndex: number;
  chapterIndex: number;
  chapterTitle: string;
  mentionCount: number;
  evidenceCount: number;
  heat: number;
  maxMentionCount: number;
  selectedMentionCount: number;
  characterIds: Set<string>;
  characterMentions: Map<string, number>;
  characterEvidence: Map<string, number>;
  location: CharacterLocation;
};

function getOrCreateCharacterBucket(
  characterById: Map<string, CharacterAppearanceHeatmapCharacter>,
  profile: CharacterProfile,
) {
  let character = characterById.get(profile.id);
  if (!character) {
    character = {
      characterId: profile.id,
      label: profile.displayName || profile.canonicalName,
      role: profile.role,
      mentionCount: 0,
      evidenceCount: 0,
      chapterCount: 0,
      heat: 0,
      confidence: profile.confidence,
    };
    characterById.set(profile.id, character);
  }
  return character;
}

function getOrCreateChapterBucket(chapterByKey: Map<string, MutableChapterBucket>, stat: CharacterAppearanceStat, bookId: string) {
  const key = getChapterKey(stat);
  let chapter = chapterByKey.get(key);
  if (!chapter) {
    const sourceChapterIndex = stat.sourceChapterIndex ?? stat.chapterIndex;
    const paragraphIndex = stat.firstParagraphIndex ?? 0;
    chapter = {
      id: key,
      sourceChapterIndex,
      chapterIndex: stat.chapterIndex,
      chapterTitle: stat.chapterTitle || '',
      mentionCount: 0,
      evidenceCount: 0,
      heat: 0,
      maxMentionCount: 0,
      selectedMentionCount: 0,
      characterIds: new Set(),
      characterMentions: new Map(),
      characterEvidence: new Map(),
      location: {
        bookId,
        sourceChapterIndex,
        chapterIndex: stat.chapterIndex,
        visibleChapterPosition: sourceChapterIndex + 1,
        chapterTitle: stat.chapterTitle || '',
        paragraphIndex,
        startOffset: 0,
        endOffset: 1,
      },
    };
  }
  return chapter;
}

function finalizeChapterBucket(
  chapter: MutableChapterBucket,
  characterById: Map<string, CharacterAppearanceHeatmapCharacter>,
): CharacterAppearanceHeatmapChapter {
  const topCharacters = [...chapter.characterMentions.entries()]
    .map(([characterId, mentionCount]) => {
      const base = characterById.get(characterId);
      return {
        characterId,
        label: base?.label ?? characterId,
        role: base?.role ?? 'unknown',
        mentionCount,
        evidenceCount: chapter.characterEvidence.get(characterId) ?? 0,
        chapterCount: 1,
        heat: mentionCount,
        confidence: base?.confidence ?? 0,
      };
    })
    .sort(compareHeatmapCharacters)
    .slice(0, 4);

  return {
    id: chapter.id,
    sourceChapterIndex: chapter.sourceChapterIndex,
    chapterIndex: chapter.chapterIndex,
    chapterTitle: chapter.chapterTitle,
    mentionCount: chapter.mentionCount,
    evidenceCount: chapter.evidenceCount,
    characterCount: chapter.characterIds.size,
    heat: chapter.heat,
    maxMentionCount: chapter.maxMentionCount,
    selectedMentionCount: chapter.selectedMentionCount,
    topCharacters,
    location: chapter.location,
  };
}

function getChapterKey(stat: CharacterAppearanceStat) {
  return `${stat.sourceChapterIndex ?? stat.chapterIndex}:${stat.chapterTitle || ''}`;
}

function compareHeatmapCharacters(left: CharacterAppearanceHeatmapCharacter, right: CharacterAppearanceHeatmapCharacter) {
  return right.mentionCount - left.mentionCount
    || right.evidenceCount - left.evidenceCount
    || right.confidence - left.confidence
    || left.label.localeCompare(right.label)
    || left.characterId.localeCompare(right.characterId);
}

function compareHeatmapChapters(left: Pick<CharacterAppearanceHeatmapChapter, 'sourceChapterIndex' | 'chapterIndex' | 'chapterTitle'>, right: Pick<CharacterAppearanceHeatmapChapter, 'sourceChapterIndex' | 'chapterIndex' | 'chapterTitle'>) {
  return left.sourceChapterIndex - right.sourceChapterIndex
    || left.chapterIndex - right.chapterIndex
    || left.chapterTitle.localeCompare(right.chapterTitle);
}

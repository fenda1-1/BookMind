import type { CharacterEntityKind, CharacterExtractionSource, CharacterLocation, CharacterProfile, CharacterRole } from '../../types';

export type CharacterListSortBy =
  | 'importance'
  | 'name'
  | 'mention-count'
  | 'relation-count'
  | 'confidence'
  | 'first-appearance'
  | 'last-appearance';

export type CharacterListSortDirection = 'asc' | 'desc';

export type CharacterListModelOptions = {
  query?: string;
  kinds?: CharacterEntityKind[];
  roles?: CharacterRole[];
  sources?: CharacterExtractionSource[];
  minConfidence?: number;
  maxConfidence?: number;
  minMentionCount?: number;
  hasRelations?: boolean;
  hasEvents?: boolean;
  includeHidden?: boolean;
  sortBy?: CharacterListSortBy;
  sortDirection?: CharacterListSortDirection;
};

export type CharacterListItem = {
  id: string;
  label: string;
  avatarInitials: string;
  canonicalName: string;
  kind: CharacterProfile['kind'];
  role: CharacterProfile['role'];
  gender: NonNullable<CharacterProfile['gender']>;
  primaryAliasNames: string[];
  tags: string[];
  summary: string;
  importanceScore: number;
  confidence: number;
  source: CharacterProfile['source'];
  mentionCount: number;
  relationCount: number;
  eventCount: number;
  firstAppearance?: CharacterLocation;
  lastAppearance?: CharacterLocation;
  hidden: boolean;
  searchText: string;
};

export type CharacterListModel = {
  items: CharacterListItem[];
  summary: {
    totalCount: number;
    visibleCount: number;
    hiddenCount: number;
    filteredCount: number;
  };
};

export function buildCharacterListModel(
  profiles: CharacterProfile[],
  options: CharacterListModelOptions = {},
): CharacterListModel {
  const query = normalizeQuery(options.query);
  const kinds = new Set(options.kinds ?? []);
  const roles = new Set(options.roles ?? []);
  const sources = new Set(options.sources ?? []);
  const includeHidden = options.includeHidden === true;
  const minConfidence = options.minConfidence ?? 0;
  const maxConfidence = options.maxConfidence ?? 1;
  const minMentionCount = options.minMentionCount ?? 0;
  const sortBy = options.sortBy ?? 'importance';
  const sortDirection = options.sortDirection ?? defaultSortDirection(sortBy);
  const hiddenCount = profiles.filter((profile) => profile.hidden).length;
  const visibleProfiles = includeHidden ? profiles : profiles.filter((profile) => !profile.hidden);
  const items = visibleProfiles
    .map((profile) => buildCharacterListItem(profile))
    .filter((item) => matchesCharacterListFilters(item, {
      query,
      kinds,
      roles,
      sources,
      minConfidence,
      maxConfidence,
      minMentionCount,
      hasRelations: options.hasRelations,
      hasEvents: options.hasEvents,
    }))
    .sort((left, right) => compareCharacterListItems(left, right, sortBy, sortDirection));

  return {
    items,
    summary: {
      totalCount: profiles.length,
      visibleCount: visibleProfiles.length,
      hiddenCount,
      filteredCount: items.length,
    },
  };
}

function buildCharacterListItem(profile: CharacterProfile): CharacterListItem {
  const primaryAliasNames = profile.aliases.map((alias) => alias.name).filter(Boolean);
  const searchParts = [
    profile.displayName,
    profile.canonicalName,
    profile.summary,
    ...profile.tags,
    ...profile.factionMemberships.map((membership) => membership.factionName),
    ...profile.factionMemberships.map((membership) => membership.role),
    ...primaryAliasNames,
    ...profile.aliases.map((alias) => alias.normalizedName),
  ];

  return {
    id: profile.id,
    label: profile.displayName || profile.canonicalName,
    avatarInitials: getCharacterAvatarInitials(profile.displayName || profile.canonicalName),
    canonicalName: profile.canonicalName,
    kind: profile.kind,
    role: profile.role,
    gender: profile.gender ?? 'unknown',
    primaryAliasNames,
    tags: [...profile.tags],
    summary: profile.summary,
    importanceScore: profile.importanceScore,
    confidence: profile.confidence,
    source: profile.source,
    mentionCount: profile.mentionCount,
    relationCount: profile.relationCount,
    eventCount: profile.eventCount,
    firstAppearance: profile.firstAppearance,
    lastAppearance: profile.lastAppearance,
    hidden: profile.hidden,
    searchText: normalizeSearchText(searchParts),
  };
}

function matchesCharacterListFilters(
  item: CharacterListItem,
  filters: {
    query: string;
    kinds: Set<CharacterEntityKind>;
    roles: Set<CharacterRole>;
    sources: Set<CharacterExtractionSource>;
    minConfidence: number;
    maxConfidence: number;
    minMentionCount: number;
    hasRelations?: boolean;
    hasEvents?: boolean;
  },
) {
  if (filters.query && !item.searchText.includes(filters.query)) return false;
  if (filters.kinds.size > 0 && !filters.kinds.has(item.kind)) return false;
  if (filters.roles.size > 0 && !filters.roles.has(item.role)) return false;
  if (filters.sources.size > 0 && !filters.sources.has(item.source)) return false;
  if (item.confidence < filters.minConfidence) return false;
  if (item.confidence > filters.maxConfidence) return false;
  if (item.mentionCount < filters.minMentionCount) return false;
  if (filters.hasRelations === true && item.relationCount <= 0) return false;
  if (filters.hasRelations === false && item.relationCount > 0) return false;
  if (filters.hasEvents === true && item.eventCount <= 0) return false;
  if (filters.hasEvents === false && item.eventCount > 0) return false;
  return true;
}

function compareCharacterListItems(
  left: CharacterListItem,
  right: CharacterListItem,
  sortBy: CharacterListSortBy,
  sortDirection: CharacterListSortDirection,
) {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const primary = compareBySortField(left, right, sortBy);
  if (primary !== 0) return primary * direction;
  return compareCharacterListTieBreakers(left, right);
}

function compareBySortField(left: CharacterListItem, right: CharacterListItem, sortBy: CharacterListSortBy) {
  if (sortBy === 'name') return getCharacterKindSortRank(left.kind) - getCharacterKindSortRank(right.kind)
    || left.label.localeCompare(right.label);
  if (sortBy === 'mention-count') return left.mentionCount - right.mentionCount;
  if (sortBy === 'relation-count') return left.relationCount - right.relationCount;
  if (sortBy === 'confidence') return left.confidence - right.confidence;
  if (sortBy === 'first-appearance') return compareCharacterLocation(left.firstAppearance, right.firstAppearance);
  if (sortBy === 'last-appearance') return compareCharacterLocation(left.lastAppearance, right.lastAppearance);
  return left.importanceScore - right.importanceScore;
}

function getCharacterKindSortRank(kind: CharacterEntityKind) {
  if (kind === 'person') return 0;
  if (kind === 'organization' || kind === 'faction') return 1;
  if (kind === 'place') return 2;
  if (kind === 'artifact') return 3;
  return 4;
}

function compareCharacterListTieBreakers(left: CharacterListItem, right: CharacterListItem) {
  return right.importanceScore - left.importanceScore
    || right.mentionCount - left.mentionCount
    || left.label.localeCompare(right.label)
    || left.id.localeCompare(right.id);
}

function compareCharacterLocation(left: CharacterLocation | undefined, right: CharacterLocation | undefined) {
  return getLocationPart(left?.sourceChapterIndex ?? left?.chapterIndex) - getLocationPart(right?.sourceChapterIndex ?? right?.chapterIndex)
    || getLocationPart(left?.paragraphIndex ?? left?.paragraphStart) - getLocationPart(right?.paragraphIndex ?? right?.paragraphStart)
    || getLocationPart(left?.startOffset) - getLocationPart(right?.startOffset);
}

function getLocationPart(value: number | undefined) {
  return value ?? Number.MAX_SAFE_INTEGER;
}

function defaultSortDirection(sortBy: CharacterListSortBy): CharacterListSortDirection {
  return sortBy === 'name' ? 'asc' : 'desc';
}

function getCharacterAvatarInitials(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) return '?';
  const latinWords = normalizedName.match(/[A-Za-z0-9]+/g) ?? [];
  if (latinWords.length > 1) return latinWords.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  if (latinWords.length === 1 && latinWords[0].length === normalizedName.length) return latinWords[0].slice(0, 2).toUpperCase();
  const compactName = Array.from(normalizedName.replace(/\s+/g, ''));
  return compactName.slice(Math.max(0, compactName.length - 2)).join('') || '?';
}

function normalizeQuery(query: string | undefined) {
  return query?.trim().toLowerCase() ?? '';
}

function normalizeSearchText(parts: string[]) {
  return parts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join('\n');
}

import type { CharacterCenterBookSummary, CharacterCenterPayload, CharacterOverviewSnapshot, CharacterWorkbenchView } from '../../types';
import { buildCharacterGraphCanvasViewport, type CharacterGraphCanvasViewport } from './characterGraphCanvasModel';
import type { CharacterGraphFocusMode } from './characterGraphModel';

export const defaultCharacterWorkbenchView: CharacterWorkbenchView = 'overview';
export const characterCenterPayloadCacheLimit = 3;
export const characterCenterOverviewCacheLimit = 8;
export const characterGraphSessionStateCacheLimit = 8;

export type CharacterGraphSessionViewMode = 'full' | 'community' | 'core' | 'neighborhood';
export type CharacterGraphSessionNeighborDepth = 1 | 2 | 'all';
export type CharacterGraphSessionEdgeMode = 'skeleton' | 'semantic' | 'all';

export type CharacterGraphSessionState = {
  viewport: CharacterGraphCanvasViewport;
  focusMode: CharacterGraphFocusMode;
  relationTypeFilter: string;
  minConfidenceFilter: string;
  chapterStartFilter: string;
  chapterEndFilter: string;
  selectedGraphEdgeId: string | null;
  viewMode: CharacterGraphSessionViewMode;
  searchQuery: string;
  neighborDepth: CharacterGraphSessionNeighborDepth;
  edgeMode: CharacterGraphSessionEdgeMode;
  tableScrollTop: number;
  viewportInitialized: boolean;
};

export type CharacterGraphSessionStatePatch = Partial<Omit<CharacterGraphSessionState, 'viewport'>> & {
  viewport?: Partial<CharacterGraphCanvasViewport>;
};

export type CharacterPayloadCacheEntry = {
  payload: CharacterCenterPayload;
  signature: string;
  lastUsedAt: number;
};

export type CharacterOverviewSnapshotCacheEntry = {
  snapshot: CharacterOverviewSnapshot;
  signature: string;
  lastUsedAt: number;
};

export type CharacterGraphSessionStateCacheEntry = {
  state: CharacterGraphSessionState;
  signature: string;
  lastUsedAt: number;
};

export function resolveInitialCharacterWorkbenchView(value: CharacterWorkbenchView | null | undefined): CharacterWorkbenchView {
  return isCharacterWorkbenchView(value) ? value : defaultCharacterWorkbenchView;
}

export function isCharacterWorkbenchView(value: unknown): value is CharacterWorkbenchView {
  return value === 'overview'
    || value === 'profiles'
    || value === 'relations'
    || value === 'heatmap'
    || value === 'timeline'
    || value === 'factions'
    || value === 'evidence'
    || value === 'review'
    || value === 'export';
}

export function buildCharacterBookCacheSignature(summary: CharacterCenterBookSummary | null | undefined): string {
  if (!summary) return '';
  return [
    summary.id,
    summary.characterIndexStatus,
    summary.characterCount,
    summary.relationCount,
    summary.evidenceCount,
    summary.lastCharacterBuiltAt,
    summary.lastTaskId,
    summary.staleReason,
    summary.lastError,
  ].join('|');
}

export function buildDefaultCharacterGraphSessionState(
  overrides: CharacterGraphSessionStatePatch = {},
): CharacterGraphSessionState {
  return {
    viewport: buildCharacterGraphCanvasViewport(overrides.viewport),
    focusMode: isCharacterGraphFocusMode(overrides.focusMode) ? overrides.focusMode : 'all',
    relationTypeFilter: typeof overrides.relationTypeFilter === 'string' && overrides.relationTypeFilter.trim() ? overrides.relationTypeFilter : 'all',
    minConfidenceFilter: typeof overrides.minConfidenceFilter === 'string' ? overrides.minConfidenceFilter : '0',
    chapterStartFilter: typeof overrides.chapterStartFilter === 'string' ? overrides.chapterStartFilter : '',
    chapterEndFilter: typeof overrides.chapterEndFilter === 'string' ? overrides.chapterEndFilter : '',
    selectedGraphEdgeId: typeof overrides.selectedGraphEdgeId === 'string' && overrides.selectedGraphEdgeId ? overrides.selectedGraphEdgeId : null,
    viewMode: isCharacterGraphSessionViewMode(overrides.viewMode) ? overrides.viewMode : 'full',
    searchQuery: typeof overrides.searchQuery === 'string' ? overrides.searchQuery : '',
    neighborDepth: isCharacterGraphSessionNeighborDepth(overrides.neighborDepth) ? overrides.neighborDepth : 2,
    edgeMode: isCharacterGraphSessionEdgeMode(overrides.edgeMode) ? overrides.edgeMode : 'skeleton',
    tableScrollTop: normalizeCharacterGraphTableScrollTop(overrides.tableScrollTop),
    viewportInitialized: overrides.viewportInitialized === true,
  };
}

export function mergeCharacterGraphSessionState(
  current: CharacterGraphSessionState,
  patch: CharacterGraphSessionStatePatch,
): CharacterGraphSessionState {
  return buildDefaultCharacterGraphSessionState({
    ...current,
    ...patch,
    viewport: patch.viewport ? buildCharacterGraphCanvasViewport({ ...current.viewport, ...patch.viewport }) : current.viewport,
  });
}

export function getCachedCharacterPayload(
  cache: Map<string, CharacterPayloadCacheEntry>,
  bookId: string | null | undefined,
  signature: string,
  now = Date.now(),
): CharacterCenterPayload | null {
  if (!bookId || !signature) return null;
  const entry = cache.get(bookId);
  if (!entry || entry.signature !== signature || entry.payload.book.id !== bookId) return null;
  entry.lastUsedAt = now;
  return entry.payload;
}

export function rememberCharacterPayload(
  cache: Map<string, CharacterPayloadCacheEntry>,
  payload: CharacterCenterPayload | null,
  signature: string,
  now = Date.now(),
  limit = characterCenterPayloadCacheLimit,
) {
  if (!payload || !payload.book.id || !signature) return;
  cache.set(payload.book.id, { payload, signature, lastUsedAt: now });
  trimCharacterCache(cache, limit);
}

export function getCachedCharacterOverviewSnapshot(
  cache: Map<string, CharacterOverviewSnapshotCacheEntry>,
  bookId: string | null | undefined,
  signature: string,
  now = Date.now(),
): CharacterOverviewSnapshot | null {
  if (!bookId || !signature) return null;
  const entry = cache.get(bookId);
  if (!entry || entry.signature !== signature || entry.snapshot.bookId !== bookId) return null;
  entry.lastUsedAt = now;
  return entry.snapshot;
}

export function rememberCharacterOverviewSnapshot(
  cache: Map<string, CharacterOverviewSnapshotCacheEntry>,
  snapshot: CharacterOverviewSnapshot | null,
  signature: string,
  now = Date.now(),
  limit = characterCenterOverviewCacheLimit,
) {
  if (!snapshot || !snapshot.bookId || !signature) return;
  cache.set(snapshot.bookId, { snapshot, signature, lastUsedAt: now });
  trimCharacterCache(cache, limit);
}

export function getCachedCharacterGraphSessionState(
  cache: Map<string, CharacterGraphSessionStateCacheEntry>,
  bookId: string | null | undefined,
  signature: string,
  now = Date.now(),
): CharacterGraphSessionState | null {
  if (!bookId || !signature) return null;
  const entry = cache.get(bookId);
  if (!entry || entry.signature !== signature) return null;
  entry.lastUsedAt = now;
  return entry.state;
}

export function rememberCharacterGraphSessionState(
  cache: Map<string, CharacterGraphSessionStateCacheEntry>,
  bookId: string | null | undefined,
  signature: string,
  state: CharacterGraphSessionState | null,
  now = Date.now(),
  limit = characterGraphSessionStateCacheLimit,
) {
  if (!bookId || !signature || !state) return;
  cache.set(bookId, { state, signature, lastUsedAt: now });
  trimCharacterCache(cache, limit);
}

export function invalidateCharacterBookCache(
  payloadCache: Map<string, CharacterPayloadCacheEntry>,
  overviewCache: Map<string, CharacterOverviewSnapshotCacheEntry>,
  bookId: string | null | undefined,
) {
  if (!bookId) return;
  payloadCache.delete(bookId);
  overviewCache.delete(bookId);
}

function isCharacterGraphFocusMode(value: unknown): value is CharacterGraphFocusMode {
  return value === 'all' || value === 'one-hop' || value === 'two-hop';
}

function isCharacterGraphSessionViewMode(value: unknown): value is CharacterGraphSessionViewMode {
  return value === 'full' || value === 'community' || value === 'core' || value === 'neighborhood';
}

function isCharacterGraphSessionNeighborDepth(value: unknown): value is CharacterGraphSessionNeighborDepth {
  return value === 1 || value === 2 || value === 'all';
}

function isCharacterGraphSessionEdgeMode(value: unknown): value is CharacterGraphSessionEdgeMode {
  return value === 'skeleton' || value === 'semantic' || value === 'all';
}

function normalizeCharacterGraphTableScrollTop(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function trimCharacterCache<T extends { lastUsedAt: number }>(cache: Map<string, T>, limit: number) {
  const safeLimit = Math.max(1, Math.floor(limit));
  if (cache.size <= safeLimit) return;
  const removable = [...cache.entries()].sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt);
  for (const [key] of removable.slice(0, cache.size - safeLimit)) {
    cache.delete(key);
  }
}

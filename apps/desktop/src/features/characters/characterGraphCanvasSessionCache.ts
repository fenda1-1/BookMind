import type { CharacterGraphCanvasModel } from './characterGraphCanvasModel';
import type { CharacterGraphModel } from './characterGraphModel';
import type { CharacterGraphRenderModel } from './characterGraphRenderModel';

const characterGraphCanvasSessionCacheLimit = 3;
const characterGraphCanvasSessionCache = new Map<string, { canvas: CharacterGraphCanvasModel; lastUsedAt: number }>();
const characterGraphModelSessionCache = new Map<string, { graph: CharacterGraphModel; lastUsedAt: number }>();
const characterGraphRenderModelSessionCache = new Map<string, { renderModel: CharacterGraphRenderModel; lastUsedAt: number }>();

export type CharacterGraphCanvasSessionCacheKeyParts = {
  bookId: string;
  payloadSignature: string;
  graphSignature: string;
  viewMode: string;
  focusCharacterId: string;
  searchQuery: string;
  neighborDepth: string;
  edgeMode: string;
  maxNodes?: string;
  maxEdges?: string;
};

export function buildCharacterGraphCanvasSessionCacheKey(parts: CharacterGraphCanvasSessionCacheKeyParts) {
  return [
    parts.bookId,
    parts.payloadSignature,
    parts.graphSignature,
    parts.viewMode,
    parts.focusCharacterId,
    parts.searchQuery.trim().toLocaleLowerCase(),
    parts.neighborDepth,
    parts.edgeMode,
    parts.maxNodes ?? '',
    parts.maxEdges ?? '',
  ].join('|');
}

export function readCharacterGraphCanvasSessionCache(key: string, now = Date.now()): CharacterGraphCanvasModel | null {
  if (!key) return null;
  const entry = characterGraphCanvasSessionCache.get(key);
  if (!entry) return null;
  entry.lastUsedAt = now;
  return entry.canvas;
}

export function peekCharacterGraphCanvasSessionCache(key: string): CharacterGraphCanvasModel | null {
  if (!key) return null;
  return characterGraphCanvasSessionCache.get(key)?.canvas ?? null;
}

export function rememberCharacterGraphCanvasSessionCache(key: string, canvas: CharacterGraphCanvasModel | null, now = Date.now()) {
  if (!key || !canvas) return;
  characterGraphCanvasSessionCache.set(key, { canvas, lastUsedAt: now });
  trimCharacterGraphSessionCache(characterGraphCanvasSessionCache);
}

export function buildCharacterGraphModelSessionCacheKey(parts: {
  bookId: string;
  payloadSignature: string;
  relationTypeFilter: string;
  minConfidence: number;
  chapterStartFilter: string;
  chapterEndFilter: string;
  focusMode: string;
  selectedCharacterId: string;
}) {
  return [
    parts.bookId,
    parts.payloadSignature,
    parts.relationTypeFilter,
    String(parts.minConfidence),
    parts.chapterStartFilter.trim(),
    parts.chapterEndFilter.trim(),
    parts.focusMode,
    parts.selectedCharacterId,
  ].join('|');
}

export function readCharacterGraphModelSessionCache(key: string, now = Date.now()): CharacterGraphModel | null {
  if (!key) return null;
  const entry = characterGraphModelSessionCache.get(key);
  if (!entry) return null;
  entry.lastUsedAt = now;
  return entry.graph;
}

export function rememberCharacterGraphModelSessionCache(key: string, graph: CharacterGraphModel | null, now = Date.now()) {
  if (!key || !graph) return;
  characterGraphModelSessionCache.set(key, { graph, lastUsedAt: now });
  trimCharacterGraphSessionCache(characterGraphModelSessionCache);
}

export function readCharacterGraphRenderModelSessionCache(key: string, now = Date.now()): CharacterGraphRenderModel | null {
  if (!key) return null;
  const entry = characterGraphRenderModelSessionCache.get(key);
  if (!entry) return null;
  entry.lastUsedAt = now;
  return entry.renderModel;
}

export function rememberCharacterGraphRenderModelSessionCache(key: string, renderModel: CharacterGraphRenderModel | null, now = Date.now()) {
  if (!key || !renderModel) return;
  characterGraphRenderModelSessionCache.set(key, { renderModel, lastUsedAt: now });
  trimCharacterGraphSessionCache(characterGraphRenderModelSessionCache);
}

export function clearCharacterGraphCanvasSessionCache() {
  characterGraphCanvasSessionCache.clear();
  characterGraphModelSessionCache.clear();
  characterGraphRenderModelSessionCache.clear();
}

function trimCharacterGraphSessionCache<T extends { lastUsedAt: number }>(cache: Map<string, T>) {
  if (cache.size <= characterGraphCanvasSessionCacheLimit) return;
  const removable = [...cache.entries()]
    .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)
    .slice(0, cache.size - characterGraphCanvasSessionCacheLimit);
  for (const [key] of removable) {
    cache.delete(key);
  }
}

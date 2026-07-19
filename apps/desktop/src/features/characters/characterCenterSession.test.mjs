import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-center-session-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterCenterSession.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterBookCacheSignature,
  getCachedCharacterOverviewSnapshot,
  getCachedCharacterGraphSessionState,
  getCachedCharacterPayload,
  invalidateCharacterBookCache,
  buildDefaultCharacterGraphSessionState,
  rememberCharacterOverviewSnapshot,
  rememberCharacterGraphSessionState,
  rememberCharacterPayload,
  resolveInitialCharacterWorkbenchView,
} = require(join(outDir, 'features', 'characters', 'characterCenterSession.js'));

assert.equal(resolveInitialCharacterWorkbenchView('relations'), 'relations');
assert.equal(resolveInitialCharacterWorkbenchView(null), 'overview');
assert.equal(resolveInitialCharacterWorkbenchView('bad-view'), 'overview');

const readySummary = bookSummary({ id: 'book-1', characterCount: 10, relationCount: 20, evidenceCount: 30, lastCharacterBuiltAt: '2026-06-17T01:00:00.000Z' });
const sameSignature = buildCharacterBookCacheSignature(readySummary);
const changedSignature = buildCharacterBookCacheSignature({ ...readySummary, relationCount: 21 });
assert.notEqual(sameSignature, changedSignature, 'cache signature must change when persisted relation counts change');

const payloadCache = new Map();
const overviewCache = new Map();
const payload = characterPayload('book-1');
rememberCharacterPayload(payloadCache, payload, sameSignature, 10);
assert.equal(getCachedCharacterPayload(payloadCache, 'book-1', sameSignature, 20), payload);
assert.equal(getCachedCharacterPayload(payloadCache, 'book-1', changedSignature, 30), null, 'stale payload cache must miss after summary signature changes');

const snapshot = overviewSnapshot('book-1');
rememberCharacterOverviewSnapshot(overviewCache, snapshot, sameSignature, 10);
assert.equal(getCachedCharacterOverviewSnapshot(overviewCache, 'book-1', sameSignature, 20), snapshot);
assert.equal(getCachedCharacterOverviewSnapshot(overviewCache, 'book-1', changedSignature, 30), null, 'stale overview snapshot cache must miss after summary signature changes');

rememberCharacterPayload(payloadCache, characterPayload('book-2'), 'sig-2', 20, 2);
rememberCharacterPayload(payloadCache, characterPayload('book-3'), 'sig-3', 30, 2);
assert.equal(payloadCache.has('book-1'), false, 'payload cache must evict least recently used entries above the limit');
assert.equal(payloadCache.has('book-2'), true);
assert.equal(payloadCache.has('book-3'), true);

invalidateCharacterBookCache(payloadCache, overviewCache, 'book-2');
assert.equal(payloadCache.has('book-2'), false);
assert.equal(overviewCache.has('book-2'), false);

const graphSessionCache = new Map();
const zoomedGraphState = buildDefaultCharacterGraphSessionState({
  viewport: { scale: 3, offsetX: -420, offsetY: 180 },
  focusMode: 'two-hop',
  relationTypeFilter: 'ally',
  minConfidenceFilter: '0.75',
  chapterStartFilter: '2',
  chapterEndFilter: '8',
  selectedGraphEdgeId: 'char-a--char-b::ally',
  viewMode: 'neighborhood',
  searchQuery: 'Alice',
  neighborDepth: 'all',
  edgeMode: 'semantic',
  tableScrollTop: 260,
  viewportInitialized: true,
});
rememberCharacterGraphSessionState(graphSessionCache, 'book-1', sameSignature, zoomedGraphState, 40);
const restoredGraphState = getCachedCharacterGraphSessionState(graphSessionCache, 'book-1', sameSignature, 50);
assert.equal(restoredGraphState.viewport.scale, 3, 'graph session cache must remember zoom level while the book signature is unchanged');
assert.equal(restoredGraphState.viewport.offsetX, -420, 'graph session cache must remember horizontal pan while the book signature is unchanged');
assert.equal(restoredGraphState.viewport.offsetY, 180, 'graph session cache must remember vertical pan while the book signature is unchanged');
assert.equal(restoredGraphState.searchQuery, 'Alice', 'graph session cache must remember relationship search query');
assert.equal(restoredGraphState.neighborDepth, 'all', 'graph session cache must remember neighbor depth');
assert.equal(restoredGraphState.selectedGraphEdgeId, 'char-a--char-b::ally', 'graph session cache must remember selected relationship edge');
assert.equal(restoredGraphState.viewportInitialized, true, 'graph session cache must remember when a fitted/user viewport can be restored');
assert.equal(getCachedCharacterGraphSessionState(graphSessionCache, 'book-1', changedSignature, 60), null, 'graph session state must reset when the character index signature changes');

rememberCharacterGraphSessionState(graphSessionCache, 'book-2', sameSignature, buildDefaultCharacterGraphSessionState({ searchQuery: 'B' }), 70, 2);
rememberCharacterGraphSessionState(graphSessionCache, 'book-3', sameSignature, buildDefaultCharacterGraphSessionState({ searchQuery: 'C' }), 80, 2);
assert.equal(graphSessionCache.has('book-1'), false, 'graph session cache must evict least recently used entries above the limit');
assert.equal(graphSessionCache.has('book-2'), true);
assert.equal(graphSessionCache.has('book-3'), true);

function bookSummary(overrides = {}) {
  return {
    id: overrides.id ?? 'book-1',
    title: 'Book',
    displayTitle: 'Book',
    author: '',
    fileName: 'book.txt',
    coverTone: 'sage',
    progress: 0,
    textIndexStatus: 'ready',
    textIndexReady: true,
    textIndexChunkCount: 10,
    textIndexFtsRows: 10,
    characterIndexStatus: overrides.characterIndexStatus ?? 'ready',
    characterCount: overrides.characterCount ?? 0,
    relationCount: overrides.relationCount ?? 0,
    evidenceCount: overrides.evidenceCount ?? 0,
    lastCharacterBuiltAt: overrides.lastCharacterBuiltAt ?? '',
    staleReason: overrides.staleReason ?? '',
    lastError: overrides.lastError ?? '',
    lastTaskId: overrides.lastTaskId ?? '',
    errorCode: '',
    errorStage: '',
    recentLogEntry: '',
  };
}

function characterPayload(bookId) {
  return {
    book: bookSummary({ id: bookId }),
    manifest: null,
    profiles: [],
    mentions: [],
    relations: [],
    evidence: [],
    events: [],
    factionMemberships: [],
    appearanceStats: [],
    loadedAt: '2026-06-17T01:00:00.000Z',
  };
}

function overviewSnapshot(bookId) {
  return {
    bookId,
    builtAt: '2026-06-17T01:00:00.000Z',
    stats: [],
    mainProfiles: [],
    recentAppearances: [],
    reviewIssueCount: 0,
    coveredChapterCount: 0,
    totalChapterCount: 0,
  };
}

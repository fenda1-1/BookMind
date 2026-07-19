import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-overview-summary-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterOverviewSummary.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterOverviewSummary } = require(join(outDir, 'features', 'characters', 'characterOverviewSummary.js'));

const payload = {
  book: {
    id: 'book-1',
    title: 'Book',
    displayTitle: 'Book',
    author: 'Author',
    fileName: 'book.txt',
    coverTone: 'sage',
    progress: 36,
    textIndexStatus: 'ready',
    textIndexReady: true,
    textIndexChunkCount: 10,
    textIndexFtsRows: 10,
    characterIndexStatus: 'ready',
    characterCount: 4,
    relationCount: 3,
    evidenceCount: 6,
    lastCharacterBuiltAt: '2026-06-10T01:00:00.000Z',
    staleReason: '',
    lastError: '',
    lastTaskId: '',
    errorCode: '',
    errorStage: '',
    recentLogEntry: '',
  },
  manifest: {
    schemaVersion: 'bookmind.character-index.v1',
    bookId: 'book-1',
    bookTitle: 'Book',
    contentHash: 'hash-book',
    textIndexContentHash: 'hash-text',
    indexVersion: 8,
    chunkStrategyVersion: 1,
    chapterRuleVersion: 2,
    status: 'ready',
    extractionMode: 'rule-ai',
    builtAt: '2026-06-10T01:00:00.000Z',
    updatedAt: '2026-06-10T01:00:00.000Z',
    staleReason: '',
    lastError: '',
    characterCount: 4,
    aliasCount: 5,
    mentionCount: 11,
    relationCount: 3,
    evidenceCount: 6,
    eventCount: 2,
    factionCount: 1,
    sourceTextIndex: { status: 'ready', builtAt: '2026-06-10T00:50:00.000Z', chunkCount: 10, ftsRowCount: 10 },
  },
  profiles: [
    profile('char-1', '林七夜', 'protagonist', 0.92, 40, 90, 0, 8),
    profile('char-2', '赵空城', 'main', 0.82, 28, 70, 1, 6),
    profile('char-3', '李医生', 'supporting', 0.45, 5, 30, 3, 4),
    profile('char-3b', '李医生', 'minor', 0.78, 2, 12, 4, 4),
    { ...profile('char-hidden', '隐藏人物', 'minor', 0.2, 100, 99, 2, 9), hidden: true },
  ],
  mentions: [
    mention('mention-1', 'char-1', 0, 0.95),
    mention('mention-2', 'char-1', 3, 0.9),
    mention('mention-low', 'char-3', 4, 0.2),
  ],
  relations: [
    relation('relation-1', 'char-1', 'char-2', ['evidence-1'], 0.9),
    relation('relation-low', 'char-2', 'char-3', ['evidence-2'], 0.35),
    relation('relation-missing-evidence', 'char-3', 'char-1', [], 0.8),
  ],
  evidence: [
    evidence('evidence-1', 'valid', 0.9),
    evidence('evidence-2', 'pending-review', 0.4),
    evidence('evidence-3', 'broken', 0.8),
  ],
  events: [],
  factionMemberships: [],
  appearanceStats: [
    appearance('appearance-1', 'char-1', 0, 8),
    appearance('appearance-2', 'char-2', 1, 3),
    appearance('appearance-3', 'char-1', 3, 5),
    appearance('appearance-4', 'char-3', 4, 1),
  ],
  loadedAt: '2026-06-10T01:01:00.000Z',
};

const summary = buildCharacterOverviewSummary(payload, { totalChapterCount: 6, maxMainProfiles: 3 });

assert.deepEqual(summary.stats.map((item) => item.id), ['characters', 'relations', 'evidence', 'chapter-coverage', 'review']);
assert.equal(summary.stats.find((item) => item.id === 'characters').value, '4');
assert.equal(summary.stats.find((item) => item.id === 'relations').value, '3');
assert.equal(summary.stats.find((item) => item.id === 'evidence').value, '3');
assert.equal(summary.stats.find((item) => item.id === 'chapter-coverage').value, '67%');
assert.deepEqual(summary.chapterCoverage, { coveredChapters: 4, totalChapters: 6, ratio: 4 / 6, label: '67%' });
assert.equal(summary.reviewSummary.totalCount, 7);
assert.equal(summary.reviewSummary.byType['low-confidence-profile'], 1);
assert.equal(summary.reviewSummary.byType['low-confidence-mention'], 1);
assert.equal(summary.reviewSummary.byType['low-confidence-relation'], 1);
assert.equal(summary.reviewSummary.byType['relation-missing-evidence'], 1);
assert.equal(summary.reviewSummary.byType['pending-evidence'], 1);
assert.equal(summary.reviewSummary.byType['broken-evidence'], 1);

assert.deepEqual(
  summary.mainProfiles.map((item) => [item.id, item.name, item.mentionCount, item.rankLabel]),
  [
    ['char-1', '林七夜', 40, '#1'],
    ['char-2', '赵空城', 28, '#2'],
    ['char-3', '李医生', 5, '#3'],
  ],
);
assert.deepEqual(
  summary.recentAppearances.map((item) => [item.characterId, item.name, item.chapterIndex, item.mentionCount]),
  [
    ['char-3', '李医生', 4, 1],
    ['char-1', '林七夜', 3, 5],
    ['char-2', '赵空城', 1, 3],
  ],
  'recent appearances should use each visible profile latest appearance, not raw heatmap order',
);

const missingPayloadSummary = buildCharacterOverviewSummary(null, { totalChapterCount: 0 });
assert.equal(missingPayloadSummary.stats.find((item) => item.id === 'chapter-coverage').value, '-');
assert.equal(missingPayloadSummary.reviewSummary.totalCount, 0);
assert.deepEqual(missingPayloadSummary.mainProfiles, []);
assert.deepEqual(missingPayloadSummary.recentAppearances, []);

function profile(id, displayName, role, confidence, mentionCount, importanceScore, firstChapter, lastChapter) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: displayName,
    displayName,
    kind: 'person',
    role,
    aliases: [],
    summary: '',
    tags: [],
    importanceScore,
    confidence,
    firstAppearance: location(firstChapter),
    lastAppearance: location(lastChapter),
    mentionCount,
    relationCount: 1,
    eventCount: 0,
    factionMemberships: [],
    hidden: false,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function mention(id, characterId, chapterIndex, confidence) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    name: characterId,
    normalizedName: characterId,
    location: { ...location(chapterIndex), bookId: 'book-1', chapterId: `chapter-${chapterIndex}`, sourceChapterIndex: chapterIndex, paragraphIndex: 0, startOffset: 0, endOffset: 2 },
    quote: `${characterId} quote`,
    contextHash: id,
    confidence,
    source: 'rule',
    createdAt: '',
  };
}

function relation(id, sourceCharacterId, targetCharacterId, evidenceIds, confidence) {
  return {
    id,
    bookId: 'book-1',
    sourceCharacterId,
    targetCharacterId,
    relationType: 'ally',
    label: '盟友',
    summary: '',
    direction: 'undirected',
    confidence,
    evidenceIds,
    status: 'active',
    createdAt: '',
    updatedAt: '',
  };
}

function evidence(id, status, confidence) {
  return {
    id,
    bookId: 'book-1',
    targetType: 'profile',
    targetId: 'char-1',
    claim: id,
    quote: `${id} quote`,
    location: { ...location(0), chunkId: 'chunk-1' },
    evidenceHash: id,
    confidence,
    source: 'rule',
    status,
    createdAt: '',
    updatedAt: '',
  };
}

function appearance(id, characterId, chapterIndex, mentionCount) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    chapterIndex,
    sourceChapterIndex: chapterIndex,
    chapterTitle: `第${chapterIndex + 1}章`,
    mentionCount,
    evidenceCount: 1,
    heat: mentionCount / 10,
  };
}

function location(chapterIndex) {
  return {
    chapterId: `chapter-${chapterIndex}`,
    chapterTitle: `第${chapterIndex + 1}章`,
    chapterIndex,
    sourceChapterIndex: chapterIndex,
    visibleChapterPosition: chapterIndex + 1,
    paragraphIndex: 0,
  };
}

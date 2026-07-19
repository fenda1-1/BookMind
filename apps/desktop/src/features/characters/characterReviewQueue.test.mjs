import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-review-queue-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterReviewQueue.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterReviewQueue,
  characterReviewQueueSchemaVersion,
} = require(join(outDir, 'features', 'characters', 'characterReviewQueue.js'));

assert.equal(characterReviewQueueSchemaVersion, 'bookmind.character-review-queue.v1');

const payload = createPayload();

const queue = buildCharacterReviewQueue(payload, {
  lowProfileConfidenceThreshold: 0.6,
  lowMentionConfidenceThreshold: 0.72,
  lowRelationConfidenceThreshold: 0.7,
  duplicateNameSimilarityThreshold: 0.8,
  maxIssues: 20,
});

assert.equal(queue.schemaVersion, 'bookmind.character-review-queue.v1');
assert.equal(queue.bookId, 'book-1');
assert.equal(queue.summary.totalCount, 9);
assert.equal(queue.summary.bySeverity.blocker, 1);
assert.equal(queue.summary.bySeverity.important, 5);
assert.equal(queue.summary.bySeverity.minor, 3);
assert.equal(queue.summary.byType['broken-evidence'], 1);
assert.equal(queue.summary.byType['stale-evidence'], 1);
assert.equal(queue.summary.byType['pending-evidence'], 1);
assert.equal(queue.summary.byType['low-confidence-profile'], 1);
assert.equal(queue.summary.byType['low-confidence-mention'], 2);
assert.equal(queue.summary.byType['duplicate-profile'], 1);
assert.equal(queue.summary.byType['relation-missing-evidence'], 1);
assert.equal(queue.summary.byType['low-confidence-relation'], 1);
assert.deepEqual(queue.warnings, []);
assert.deepEqual(queue.items.map((item) => item.type), [
  'broken-evidence',
  'stale-evidence',
  'pending-evidence',
  'low-confidence-profile',
  'duplicate-profile',
  'relation-missing-evidence',
  'low-confidence-relation',
  'low-confidence-mention',
  'low-confidence-mention',
]);

const brokenEvidenceIssue = queue.items.find((item) => item.type === 'broken-evidence');
assert.equal(brokenEvidenceIssue.id, 'review-broken-evidence-ev-broken');
assert.equal(brokenEvidenceIssue.severity, 'blocker');
assert.equal(brokenEvidenceIssue.targetId, 'ev-broken');
assert.deepEqual(brokenEvidenceIssue.relatedCharacterIds, ['char-lqy']);
assert.equal(brokenEvidenceIssue.locationLabel, '第2章:段落12');
assert.match(brokenEvidenceIssue.title, /证据无法回跳/);

const staleEvidenceIssue = queue.items.find((item) => item.type === 'stale-evidence');
assert.equal(staleEvidenceIssue.id, 'review-stale-evidence-ev-stale');
assert.equal(staleEvidenceIssue.severity, 'important');
assert.equal(staleEvidenceIssue.targetId, 'ev-stale');
assert.deepEqual(staleEvidenceIssue.relatedCharacterIds, ['char-zkc']);
assert.match(staleEvidenceIssue.title, /证据已过期/);

const duplicateIssue = queue.items.find((item) => item.type === 'duplicate-profile');
assert.equal(duplicateIssue.severity, 'important');
assert.deepEqual(duplicateIssue.relatedCharacterIds, ['char-lqy', 'char-lqye']);
assert.equal(duplicateIssue.score, 0.8);
assert.match(duplicateIssue.description, /林七夜/);
assert.match(duplicateIssue.description, /林七夜儿/);

const relationIssue = queue.items.find((item) => item.type === 'relation-missing-evidence');
assert.equal(relationIssue.targetId, 'rel-missing-evidence');
assert.deepEqual(relationIssue.relatedCharacterIds, ['char-lqy', 'char-zkc']);
assert.equal(relationIssue.actionHint, '补充证据、降低置信度或忽略该关系');

const lowMentionIssue = queue.items.find((item) => item.targetId === 'mention-low-1');
assert.equal(lowMentionIssue.severity, 'minor');
assert.equal(lowMentionIssue.locationLabel, '第1章:段落8');
assert.match(lowMentionIssue.evidencePreview, /他点点头/);

const strictQueue = buildCharacterReviewQueue(payload, {
  lowProfileConfidenceThreshold: 0.4,
  lowMentionConfidenceThreshold: 0.3,
  lowRelationConfidenceThreshold: 0.4,
  duplicateNameSimilarityThreshold: 0.95,
  maxIssues: 2,
});
assert.deepEqual(strictQueue.items.map((item) => item.type), [
  'broken-evidence',
  'stale-evidence',
], 'custom thresholds and maxIssues must reduce generated review issues deterministically');
assert.equal(strictQueue.summary.totalCount, 2);
assert.deepEqual(strictQueue.warnings, ['truncated']);

const hiddenQueue = buildCharacterReviewQueue(payload, {
  includeHiddenProfiles: true,
  lowProfileConfidenceThreshold: 0,
  lowMentionConfidenceThreshold: 0,
  lowRelationConfidenceThreshold: 0,
});
assert.ok(
  hiddenQueue.items.some((item) => item.targetId === 'rel-hidden-missing-evidence'),
  'includeHiddenProfiles must allow hidden-endpoint missing-evidence relations into the review queue',
);

const emptyQueue = buildCharacterReviewQueue(null);
assert.equal(emptyQueue.bookId, '');
assert.deepEqual(emptyQueue.items, []);
assert.deepEqual(emptyQueue.summary.byType, {});
assert.deepEqual(emptyQueue.warnings, ['missing-payload']);

function createPayload() {
  const location = (chapterIndex, paragraphIndex) => ({
    bookId: 'book-1',
    chapterId: `chapter-${chapterIndex}`,
    sourceChapterIndex: chapterIndex,
    chapterTitle: `第${chapterIndex}章`,
    paragraphIndex,
    startOffset: 0,
    endOffset: 4,
    chunkId: `chunk-${chapterIndex}-${paragraphIndex}`,
  });
  return {
    book: {
      id: 'book-1',
      title: '斩神',
      displayTitle: '斩神',
      author: '三九音域',
      fileName: 'zhan-shen.txt',
      coverTone: 'indigo',
      progress: 42,
      textIndexStatus: 'ready',
      textIndexReady: true,
      textIndexChunkCount: 100,
      textIndexFtsRows: 100,
      characterIndexStatus: 'ready',
      characterCount: 4,
      relationCount: 3,
      evidenceCount: 4,
      lastCharacterBuiltAt: '2026-06-11T00:00:00.000Z',
      staleReason: '',
      lastError: '',
      lastTaskId: '',
      errorCode: '',
      errorStage: '',
      recentLogEntry: '',
    },
    manifest: null,
    profiles: [
      createProfile('char-lqy', '林七夜', 'protagonist', 48, 0.96, location(1, 1), false),
      createProfile('char-lqye', '林七夜儿', 'minor', 3, 0.82, location(1, 4), false),
      createProfile('char-zkc', '赵空城', 'main', 24, 0.86, location(1, 6), false),
      createProfile('char-low', '疑似候选', 'unknown', 2, 0.42, location(3, 2), false),
      createProfile('char-hidden', '隐藏候选', 'unknown', 1, 0.1, location(4, 2), true),
    ],
    mentions: [
      createMention('mention-ok', 'char-lqy', '林七夜', 0.98, location(1, 2), '林七夜抬头。'),
      createMention('mention-low-1', 'char-zkc', '他', 0.61, location(1, 8), '他点点头，看向林七夜。'),
      createMention('mention-low-2', 'char-low', '疑似候选', 0.33, location(3, 3), '疑似候选在角落里。'),
    ],
    relations: [
      createRelation('rel-valid', 'char-lqy', 'char-zkc', 0.91, ['ev-relation-ok'], location(1, 7)),
      createRelation('rel-missing-evidence', 'char-lqy', 'char-zkc', 0.88, [], location(2, 1)),
      createRelation('rel-low', 'char-lqy', 'char-lqye', 0.44, ['ev-relation-low'], location(2, 4)),
      createRelation('rel-hidden-missing-evidence', 'char-hidden', 'char-lqy', 0.82, [], location(4, 3)),
    ],
    evidence: [
      createEvidence('ev-relation-ok', 'relation', 'rel-valid', 'valid', 0.9, location(1, 7), '赵空城保护林七夜。'),
      createEvidence('ev-broken', 'profile', 'char-lqy', 'broken', 0.7, location(2, 12), '旧证据无法定位。'),
      createEvidence('ev-stale', 'profile', 'char-zkc', 'stale', 0.74, location(2, 14), '旧版本证据。'),
      createEvidence('ev-pending', 'mention', 'mention-low-1', 'pending-review', 0.62, location(1, 8), '他可能指赵空城。'),
      createEvidence('ev-relation-low', 'relation', 'rel-low', 'valid', 0.45, location(2, 4), '疑似关系。'),
    ],
    events: [],
    factionMemberships: [],
    appearanceStats: [],
    loadedAt: '2026-06-11T00:00:00.000Z',
  };
}

function createProfile(id, name, role, mentionCount, confidence, firstAppearance, hidden) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: name,
    displayName: name,
    kind: 'person',
    role,
    aliases: [
      { id: `${id}-alias-main`, bookId: 'book-1', characterId: id, name, normalizedName: name, kind: 'name', source: 'rule', confidence, mentionCount, createdAt: '2026-06-11T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z' },
    ],
    summary: `${name} 的摘要。`,
    tags: [],
    importanceScore: confidence,
    confidence,
    firstAppearance,
    lastAppearance: firstAppearance,
    mentionCount,
    relationCount: 0,
    eventCount: 0,
    factionMemberships: [],
    hidden,
    source: confidence < 0.5 ? 'ai' : 'rule',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };
}

function createMention(id, characterId, name, confidence, location, quote) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    aliasId: `${characterId}-alias-main`,
    name,
    normalizedName: name,
    location,
    quote,
    prefixText: '',
    suffixText: '',
    contextHash: `${id}-hash`,
    confidence,
    source: confidence < 0.7 ? 'ai' : 'rule',
    createdAt: '2026-06-11T00:00:00.000Z',
  };
}

function createRelation(id, sourceCharacterId, targetCharacterId, confidence, evidenceIds, firstSeen) {
  return {
    id,
    bookId: 'book-1',
    sourceCharacterId,
    targetCharacterId,
    relationType: 'related',
    label: '关联',
    summary: '关系摘要',
    direction: 'directed',
    confidence,
    evidenceIds,
    firstSeen,
    lastSeen: firstSeen,
    status: 'active',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };
}

function createEvidence(id, targetType, targetId, status, confidence, location, quote) {
  return {
    id,
    bookId: 'book-1',
    targetType,
    targetId,
    claim: '审查证据',
    quote,
    location,
    evidenceHash: `${id}-hash`,
    confidence,
    source: 'ai',
    status,
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  };
}

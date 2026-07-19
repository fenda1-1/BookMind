import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-profile-detail-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterProfileDetail.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterProfileDetail } = require(join(outDir, 'features', 'characters', 'characterProfileDetail.js'));

const payload = {
  book: { id: 'book-1', title: 'Book', displayTitle: 'Book', author: '', fileName: 'book.txt' },
  manifest: null,
  profiles: [
    profile('char-1', '林七夜'),
    profile('char-2', '李医生'),
  ],
  mentions: [
    mention('mention-2', 'char-2', 2),
    mention('mention-1', 'char-1', 0),
    mention('mention-3', 'char-1', 5),
  ],
  relations: [
    relation('relation-2', 'char-2', 'char-1', ['evidence-3']),
    relation('relation-1', 'char-1', 'char-2', ['evidence-2']),
  ],
  evidence: [
    evidence('evidence-3', 'relation', 'relation-2'),
    evidence('evidence-alias', 'alias', 'alias-char-1'),
    evidence('evidence-1', 'profile', 'char-1'),
    evidence('evidence-4', 'mention', 'mention-3'),
    evidence('evidence-event-direct', 'event', 'event-1'),
    evidence('evidence-faction-direct', 'faction', 'faction-1'),
    evidence('evidence-2', 'relation', 'relation-1'),
    evidence('evidence-other', 'profile', 'char-2'),
  ],
  events: [
    event('event-other', ['char-2'], ['evidence-other'], 1),
    event('event-2', ['char-1', 'char-2'], ['evidence-3'], 4),
    event('event-1', ['char-1'], ['evidence-1'], 2),
  ],
  factionMemberships: [
    faction('faction-other', 'char-2', ['evidence-other']),
    faction('faction-1', 'char-1', ['evidence-1']),
  ],
  appearanceStats: [
    appearance('appearance-2', 'char-1', 5, 1),
    appearance('appearance-other', 'char-2', 1, 1),
    appearance('appearance-1', 'char-1', 0, 3),
  ],
  loadedAt: '2026-06-10T00:00:00.000Z',
};

const detail = buildCharacterProfileDetail(payload, 'char-1');
assert.ok(detail, 'known character must produce a detail model');
assert.equal(detail.profile.id, 'char-1');
assert.deepEqual(detail.aliases.map((item) => item.id), ['alias-char-1']);
assert.deepEqual(detail.mentions.map((item) => item.id), ['mention-1', 'mention-3']);
assert.deepEqual(detail.relations.map((item) => item.id), ['relation-1', 'relation-2']);
assert.deepEqual(detail.events.map((item) => item.id), ['event-1', 'event-2']);
assert.deepEqual(detail.factionMemberships.map((item) => item.id), ['faction-1']);
assert.deepEqual(detail.appearanceStats.map((item) => item.id), ['appearance-1', 'appearance-2']);
assert.deepEqual(detail.evidence.map((item) => item.id), ['evidence-1', 'evidence-2', 'evidence-3', 'evidence-4', 'evidence-alias', 'evidence-event-direct', 'evidence-faction-direct']);
assert.deepEqual(detail.relatedCharacterIds, ['char-2']);
assert.deepEqual(detail.relatedProfiles.map((item) => item.id), ['char-2']);
assert.equal(detail.counts.mentions, 2);
assert.equal(detail.counts.relations, 2);
assert.equal(detail.counts.events, 2);
assert.equal(detail.counts.evidence, 7);
assert.equal(detail.counts.appearances, 2);
assert.deepEqual(detail.meta, {
  importancePercent: 50,
  confidencePercent: 90,
  sourceLabelKey: 'characters.profileSource.rule',
  sourceStateLabelKey: 'characters.detailGeneratedByMachine',
  tags: ['守夜人', '沧南'],
});

assert.equal(buildCharacterProfileDetail(payload, 'missing-character'), null);
assert.equal(buildCharacterProfileDetail(null, 'char-1'), null);

const largePayload = {
  ...payload,
  profiles: [
    profile('large-source', '大人物'),
    ...Array.from({ length: 160 }, (_, index) => profile(`large-target-${index}`, `目标${index}`)),
  ],
  mentions: Array.from({ length: 120 }, (_, index) => mention(`large-mention-${index}`, 'large-source', index)),
  relations: Array.from({ length: 160 }, (_, index) => relation(`large-relation-${index}`, 'large-source', `large-target-${index}`, [`large-evidence-${index}`])),
  evidence: Array.from({ length: 160 }, (_, index) => evidence(`large-evidence-${index}`, 'relation', `large-relation-${index}`)),
  events: Array.from({ length: 80 }, (_, index) => event(`large-event-${index}`, ['large-source'], [], index)),
  factionMemberships: Array.from({ length: 40 }, (_, index) => faction(`large-faction-${index}`, 'large-source', [])),
  appearanceStats: Array.from({ length: 60 }, (_, index) => appearance(`large-appearance-${index}`, 'large-source', index, 1)),
};
const lightweightDetail = buildCharacterProfileDetail(largePayload, 'large-source', { previewLimit: 24 });
assert.equal(lightweightDetail.counts.relations, 160, 'lightweight detail should keep full relation counts');
assert.equal(lightweightDetail.counts.mentions, 120, 'lightweight detail should keep full mention counts');
assert.equal(lightweightDetail.relations.length, 24, 'lightweight detail should cap relation records returned to the inspector');
assert.equal(lightweightDetail.mentions.length, 24, 'lightweight detail should cap mention records returned to the inspector');
assert.equal(lightweightDetail.evidence.length, 24, 'lightweight detail should cap evidence records returned to the inspector');
assert.equal(lightweightDetail.relatedProfiles.length, 24, 'lightweight detail should cap related profiles returned to the inspector');

function profile(id, displayName) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: displayName,
    displayName,
    kind: 'person',
    role: 'supporting',
    aliases: [{
      id: `alias-${id}`,
      bookId: 'book-1',
      characterId: id,
      name: displayName,
      normalizedName: displayName,
      kind: 'name',
      source: 'rule',
      confidence: 0.9,
      mentionCount: 2,
      createdAt: '',
      updatedAt: '',
    }],
    summary: '',
    tags: id === 'char-1' ? ['守夜人', '沧南'] : [],
    importanceScore: 0.5,
    confidence: 0.9,
    mentionCount: 2,
    relationCount: 1,
    eventCount: 1,
    factionMemberships: [],
    hidden: false,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function mention(id, characterId, sourceChapterIndex) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    name: characterId,
    normalizedName: characterId,
    location: {
      bookId: 'book-1',
      chunkId: `${id}-chunk`,
      chapterId: `${id}-chapter`,
      sourceChapterIndex,
      paragraphIndex: 0,
      startOffset: 0,
      endOffset: 4,
    },
    quote: id,
    contextHash: id,
    confidence: 0.8,
    source: 'rule',
    createdAt: '',
  };
}

function relation(id, sourceCharacterId, targetCharacterId, evidenceIds) {
  return {
    id,
    bookId: 'book-1',
    sourceCharacterId,
    targetCharacterId,
    relationType: 'treats',
    label: '治疗',
    summary: '',
    direction: 'directed',
    confidence: 0.8,
    evidenceIds,
    status: 'active',
    createdAt: '',
    updatedAt: '',
  };
}

function evidence(id, targetType, targetId) {
  return {
    id,
    bookId: 'book-1',
    targetType,
    targetId,
    claim: id,
    quote: id,
    location: {
      bookId: 'book-1',
      chunkId: `${id}-chunk`,
      sourceChapterIndex: 1,
      paragraphIndex: 0,
      startOffset: 0,
      endOffset: 2,
    },
    evidenceHash: id,
    confidence: 0.8,
    source: 'rule',
    status: 'valid',
    createdAt: '',
    updatedAt: '',
  };
}

function event(id, participantCharacterIds, evidenceIds, sourceChapterIndex) {
  return {
    id,
    bookId: 'book-1',
    title: id,
    summary: '',
    eventType: 'appearance',
    participantCharacterIds,
    location: {
      bookId: 'book-1',
      sourceChapterIndex,
      paragraphIndex: 0,
    },
    chapterLabel: `第 ${sourceChapterIndex + 1} 章`,
    evidenceIds,
    confidence: 0.8,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function faction(id, characterId, evidenceIds) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    factionName: '病院',
    role: '病人',
    status: 'active',
    evidenceIds,
    confidence: 0.8,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function appearance(id, characterId, sourceChapterIndex, mentionCount) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    chapterIndex: sourceChapterIndex,
    sourceChapterIndex,
    chapterTitle: `第 ${sourceChapterIndex + 1} 章`,
    mentionCount,
    evidenceCount: 1,
    heat: mentionCount,
  };
}

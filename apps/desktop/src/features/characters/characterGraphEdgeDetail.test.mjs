import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-graph-edge-detail-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterGraphModel.ts',
  'src/features/characters/characterGraphEdgeDetail.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterGraphModel } = require(join(outDir, 'features', 'characters', 'characterGraphModel.js'));
const { buildCharacterGraphEdgeDetail } = require(join(outDir, 'features', 'characters', 'characterGraphEdgeDetail.js'));

const payload = {
  book: { id: 'book-1', title: '测试书', displayTitle: '测试书' },
  profiles: [
    profile('char-1', '林七夜'),
    profile('char-2', '李医生'),
    profile('char-3', '赵空城'),
  ],
  relations: [
    relation('relation-1', 'char-1', 'char-2', 'treats', '治疗', 'directed', ['evidence-1'], 0.82, '医生帮助林七夜稳定状态。'),
    relation('relation-1b', 'char-1', 'char-2', 'treats', '治疗', 'directed', ['evidence-2'], 0.76, ''),
    relation('relation-3', 'char-1', 'char-3', 'ally', '盟友', 'undirected', ['evidence-3'], 0.9, ''),
  ],
  evidence: [
    evidence('evidence-2', 'relation-1b', '李医生再次确认治疗计划。', 0.76, 2),
    evidence('evidence-1', 'relation-1', '李医生记录林七夜的病情。', 0.82, 1),
    evidence('evidence-edge', 'char-1->char-2::treats', '两人的治疗关系被汇总到关系边。', 0.72, 3),
    evidence('evidence-unrelated', 'relation-x', '无关证据', 0.4, 9),
  ],
  mentions: [],
  events: [],
  factionMemberships: [],
  appearanceStats: [],
  manifest: null,
  loadedAt: '',
};

const graph = buildCharacterGraphModel(payload.profiles, payload.relations);
const edge = graph.edges.find((item) => item.id === 'char-1->char-2::treats');
assert.ok(edge, 'expected merged treats edge');

const detail = buildCharacterGraphEdgeDetail(payload, edge);
assert.equal(detail.edge.id, edge.id);
assert.equal(detail.sourceProfile.displayName, '林七夜');
assert.equal(detail.targetProfile.displayName, '李医生');
assert.deepEqual(detail.relations.map((item) => item.id), ['relation-1', 'relation-1b']);
assert.deepEqual(detail.evidence.map((item) => item.id), ['evidence-1', 'evidence-2', 'evidence-edge']);
assert.deepEqual(detail.summary, {
  relationCount: 2,
  evidenceCount: 3,
  confidencePercent: 82,
  weight: 2,
});

const emptyDetail = buildCharacterGraphEdgeDetail(payload, { ...edge, relationIds: [], evidenceIds: [] });
assert.deepEqual(emptyDetail.relations, []);
assert.deepEqual(emptyDetail.evidence.map((item) => item.id), ['evidence-edge']);
assert.deepEqual(emptyDetail.summary, {
  relationCount: 0,
  evidenceCount: 1,
  confidencePercent: 82,
  weight: 2,
});

assert.equal(buildCharacterGraphEdgeDetail(payload, { ...edge, sourceId: 'missing' }), null);
assert.equal(buildCharacterGraphEdgeDetail(null, edge), null);

function profile(id, displayName) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: displayName,
    displayName,
    kind: 'person',
    role: 'supporting',
    aliases: [],
    summary: '',
    tags: [],
    importanceScore: 0.8,
    confidence: 0.8,
    mentionCount: 0,
    relationCount: 0,
    eventCount: 0,
    factionMemberships: [],
    hidden: false,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function relation(id, sourceCharacterId, targetCharacterId, relationType, label, direction, evidenceIds, confidence, summary) {
  return {
    id,
    bookId: 'book-1',
    sourceCharacterId,
    targetCharacterId,
    relationType,
    label,
    summary,
    direction,
    confidence,
    evidenceIds,
    status: 'active',
    createdAt: '',
    updatedAt: '',
  };
}

function evidence(id, targetId, quote, confidence, paragraphIndex) {
  return {
    id,
    bookId: 'book-1',
    targetType: 'relation',
    targetId,
    claim: quote,
    quote,
    location: {
      bookId: 'book-1',
      chunkId: `chunk-${id}`,
      sourceChapterIndex: 0,
      paragraphIndex,
      startOffset: 0,
      endOffset: quote.length,
    },
    evidenceHash: id,
    confidence,
    source: 'rule',
    status: 'valid',
    createdAt: '',
    updatedAt: '',
  };
}

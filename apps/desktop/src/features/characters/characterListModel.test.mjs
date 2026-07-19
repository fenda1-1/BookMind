import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-list-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterListModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterListModel } = require(join(outDir, 'features', 'characters', 'characterListModel.js'));

const profiles = [
  profile('char-1', {
    canonicalName: 'Lin Qiye',
    displayName: '林七夜',
    role: 'protagonist',
    kind: 'person',
    aliases: [alias('alias-1', '七夜'), alias('alias-2', '林队')],
    summary: '守夜人小队核心成员',
    tags: ['守夜人', '小队'],
    importanceScore: 0.97,
    confidence: 0.96,
    mentionCount: 120,
    relationCount: 9,
    eventCount: 7,
    firstChapter: 3,
    firstParagraph: 2,
    lastChapter: 80,
    lastParagraph: 1,
    factionMemberships: [faction('faction-1', '蓝雨小队')],
  }),
  profile('char-2', {
    canonicalName: 'Li Doctor',
    displayName: '李医生',
    role: 'supporting',
    kind: 'person',
    aliases: [alias('alias-3', '医生')],
    summary: '负责治疗和观察',
    tags: ['医院'],
    importanceScore: 0.62,
    confidence: 0.8,
    mentionCount: 41,
    relationCount: 6,
    eventCount: 3,
    firstChapter: 10,
    firstParagraph: 5,
    lastChapter: 90,
    lastParagraph: 1,
  }),
  profile('char-3', {
    canonicalName: 'Zhao Kongcheng',
    displayName: '赵空城',
    role: 'main',
    kind: 'person',
    aliases: [alias('alias-4', '赵叔')],
    summary: '关键战斗人物',
    tags: ['守夜人'],
    importanceScore: 0.82,
    confidence: 0.72,
    mentionCount: 88,
    relationCount: 4,
    eventCount: 6,
    firstChapter: 1,
    firstParagraph: 1,
    lastChapter: 60,
    lastParagraph: 1,
    source: 'ai',
  }),
  profile('char-4', {
    canonicalName: 'Night Watch',
    displayName: '守夜人',
    role: 'supporting',
    kind: 'organization',
    aliases: [alias('alias-5', '守夜人组织')],
    summary: '组织势力',
    tags: ['阵营'],
    importanceScore: 0.7,
    confidence: 0.9,
    mentionCount: 66,
    relationCount: 11,
    eventCount: 4,
    firstChapter: 5,
    firstParagraph: 1,
    lastChapter: 100,
    lastParagraph: 1,
    source: 'manual',
  }),
  {
    ...profile('char-hidden', {
      canonicalName: 'Hidden',
      displayName: '隐藏候选',
      role: 'minor',
      kind: 'person',
      aliases: [alias('alias-hidden', '误识别')],
      summary: '低置信度误识别',
      tags: ['待审查'],
      importanceScore: 0.1,
      confidence: 0.2,
      mentionCount: 2,
      relationCount: 0,
      eventCount: 0,
      firstChapter: 2,
      firstParagraph: 1,
      lastChapter: 2,
      lastParagraph: 1,
    }),
    hidden: true,
  },
];

const defaultList = buildCharacterListModel(profiles);
assert.deepEqual(defaultList.items.map((item) => item.id), ['char-1', 'char-3', 'char-4', 'char-2'], 'default list should hide hidden profiles and sort by importance');
assert.equal(defaultList.summary.totalCount, 5);
assert.equal(defaultList.summary.visibleCount, 4);
assert.equal(defaultList.summary.hiddenCount, 1);
assert.equal(defaultList.items[0].primaryAliasNames.join(','), '七夜,林队');
assert.equal(defaultList.items[0].searchText.includes('林七夜'), true);
assert.equal(defaultList.items[0].avatarInitials, '七夜', 'Chinese character names should use the final two visible characters for compact avatars');

const aliasSearch = buildCharacterListModel(profiles, { query: '赵叔' });
assert.deepEqual(aliasSearch.items.map((item) => item.id), ['char-3'], 'query should match alias names');
assert.equal(aliasSearch.summary.filteredCount, 1);

const tagSearch = buildCharacterListModel(profiles, { query: '医院' });
assert.deepEqual(tagSearch.items.map((item) => item.id), ['char-2'], 'query should match tags and summaries');

const filtered = buildCharacterListModel(profiles, {
  query: '守夜人',
  kinds: ['person'],
  roles: ['protagonist', 'main'],
  minConfidence: 0.75,
  sortBy: 'mention-count',
  sortDirection: 'asc',
});
assert.deepEqual(filtered.items.map((item) => item.id), ['char-1'], 'filters should combine query, kind, role, confidence, and hidden policy');

const relationSorted = buildCharacterListModel(profiles, { sortBy: 'relation-count', sortDirection: 'desc' });
assert.deepEqual(relationSorted.items.map((item) => item.id), ['char-4', 'char-1', 'char-2', 'char-3'], 'relation-count sort should use name/id as stable tie-breakers');

const nameSorted = buildCharacterListModel(profiles, { sortBy: 'name', sortDirection: 'asc' });
assert.deepEqual(nameSorted.items.map((item) => item.id), ['char-2', 'char-1', 'char-3', 'char-4'], 'name sort should use display names');
assert.equal(nameSorted.items[0].avatarInitials, '医生', 'Chinese title-like names should still have stable compact initials');

const englishAvatar = buildCharacterListModel([
  profile('char-en', {
    canonicalName: 'Michael Night',
    displayName: '',
    role: 'main',
    kind: 'person',
    aliases: [],
    summary: '',
    tags: [],
    importanceScore: 1,
    confidence: 1,
    mentionCount: 1,
    relationCount: 0,
    eventCount: 0,
    firstChapter: 1,
    firstParagraph: 1,
    lastChapter: 1,
    lastParagraph: 1,
    source: 'manual',
  }),
]);
assert.equal(englishAvatar.items[0].avatarInitials, 'MN', 'English fallback names should use word initials');

const withHidden = buildCharacterListModel(profiles, { includeHidden: true, query: '误识别' });
assert.deepEqual(withHidden.items.map((item) => item.id), ['char-hidden'], 'includeHidden should allow hidden profiles to be searched');

const factionSearch = buildCharacterListModel(profiles, { query: '蓝雨小队' });
assert.deepEqual(factionSearch.items.map((item) => item.id), ['char-1'], 'query should match faction membership names');

const sourceAndMetricFiltered = buildCharacterListModel(profiles, {
  sources: ['manual', 'ai'],
  minMentionCount: 60,
  hasRelations: true,
  hasEvents: true,
  sortBy: 'confidence',
});
assert.deepEqual(sourceAndMetricFiltered.items.map((item) => item.id), ['char-4', 'char-3'], 'filters should support source, mention count, relation presence, and event presence');

const lowConfidenceFiltered = buildCharacterListModel(profiles, { maxConfidence: 0.75, includeHidden: true });
assert.deepEqual(lowConfidenceFiltered.items.map((item) => item.id), ['char-3', 'char-hidden'], 'maxConfidence should support low-confidence review filters');

const firstAppearanceSorted = buildCharacterListModel(profiles, { sortBy: 'first-appearance', sortDirection: 'asc' });
assert.deepEqual(firstAppearanceSorted.items.map((item) => item.id), ['char-3', 'char-1', 'char-4', 'char-2'], 'first-appearance sort should use reader location order');

const lastAppearanceSorted = buildCharacterListModel(profiles, { sortBy: 'last-appearance', sortDirection: 'desc' });
assert.deepEqual(lastAppearanceSorted.items.map((item) => item.id), ['char-4', 'char-2', 'char-1', 'char-3'], 'last-appearance sort should use reader location order');

function profile(id, overrides) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: overrides.canonicalName,
    displayName: overrides.displayName,
    kind: overrides.kind,
    role: overrides.role,
    aliases: overrides.aliases,
    summary: overrides.summary,
    tags: overrides.tags,
    importanceScore: overrides.importanceScore,
    confidence: overrides.confidence,
    mentionCount: overrides.mentionCount,
    relationCount: overrides.relationCount,
    eventCount: overrides.eventCount,
    factionMemberships: overrides.factionMemberships ?? [],
    hidden: false,
    firstAppearance: location(overrides.firstChapter, overrides.firstParagraph),
    lastAppearance: location(overrides.lastChapter, overrides.lastParagraph),
    source: overrides.source ?? 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function alias(id, name) {
  return {
    id,
    bookId: 'book-1',
    characterId: '',
    name,
    normalizedName: name.toLowerCase(),
    kind: 'name',
    source: 'rule',
    confidence: 0.9,
    mentionCount: 1,
    createdAt: '',
    updatedAt: '',
  };
}

function location(sourceChapterIndex, paragraphIndex) {
  return {
    bookId: 'book-1',
    chapterId: `chapter-${sourceChapterIndex}`,
    sourceChapterIndex,
    paragraphIndex,
    startOffset: 0,
    endOffset: 1,
  };
}

function faction(id, factionName) {
  return {
    id,
    bookId: 'book-1',
    characterId: 'char-1',
    factionName,
    role: 'member',
    status: 'active',
    evidenceIds: [],
    confidence: 0.9,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

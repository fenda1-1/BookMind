import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-appearance-heatmap-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterAppearanceHeatmap.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterAppearanceHeatmapModel } = require(join(outDir, 'features', 'characters', 'characterAppearanceHeatmap.js'));

const model = buildCharacterAppearanceHeatmapModel({
  bookId: 'book-1',
  profiles: [
    profile('char-1', '林七夜', 'protagonist', 0.95, false),
    profile('char-2', '安卿鱼', 'main', 0.87, false),
    profile('char-3', '隐藏误识别', 'minor', 0.2, true),
  ],
  appearanceStats: [
    appearance('a-1', 'char-1', 0, '第 1 章 初醒', 6, 2, 3),
    appearance('a-2', 'char-2', 0, '第 1 章 初醒', 3, 1, 8),
    appearance('a-3', 'char-1', 2, '第 3 章 守夜人', 9, 4, 1),
    appearance('a-4', 'char-2', 1, '第 2 章 深海', 12, 5, 5),
    appearance('hidden', 'char-3', 1, '第 2 章 深海', 50, 1, 1),
  ],
});

assert.deepEqual(model.summary, {
  characterCount: 2,
  chapterCount: 3,
  mentionCount: 30,
  evidenceCount: 12,
  hottestChapterTitle: '第 2 章 深海',
});
assert.deepEqual(model.characterRankings.map((item) => `${item.characterId}:${item.mentionCount}:${item.chapterCount}`), [
  'char-1:15:2',
  'char-2:15:2',
]);
assert.deepEqual(model.chapterBuckets.map((item) => `${item.sourceChapterIndex}:${item.mentionCount}:${item.characterCount}`), [
  '0:9:2',
  '1:12:1',
  '2:9:1',
]);
assert.equal(model.chapterBuckets[1].location.bookId, 'book-1');
assert.equal(model.chapterBuckets[1].location.sourceChapterIndex, 1);
assert.equal(model.chapterBuckets[1].location.paragraphIndex, 5);
assert.equal(model.chapterBuckets[1].location.startOffset, 0);
assert.equal(model.chapterBuckets[1].topCharacters[0].label, '安卿鱼');

const untitledModel = buildCharacterAppearanceHeatmapModel({
  bookId: 'book-1',
  profiles: [
    profile('char-1', '林七夜', 'protagonist', 0.95, false),
  ],
  appearanceStats: [
    appearance('untitled', 'char-1', 8, '', 2, 1, 0),
  ],
});

assert.equal(untitledModel.chapterBuckets[0].chapterTitle, '');
assert.equal(untitledModel.chapterBuckets[0].location.chapterTitle, '');

const selectedModel = buildCharacterAppearanceHeatmapModel({
  bookId: 'book-1',
  profiles: [
    profile('char-1', '林七夜', 'protagonist', 0.95, false),
    profile('char-2', '安卿鱼', 'main', 0.87, false),
  ],
  appearanceStats: [
    appearance('a-1', 'char-1', 0, '第 1 章 初醒', 6, 2, 3),
    appearance('a-2', 'char-2', 0, '第 1 章 初醒', 3, 1, 8),
    appearance('a-3', 'char-1', 2, '第 3 章 守夜人', 9, 4, 1),
  ],
  selectedCharacterId: 'char-1',
});

assert.deepEqual(selectedModel.selectedCharacter?.characterId, 'char-1');
assert.deepEqual(selectedModel.selectedCharacterChapters.map((item) => `${item.sourceChapterIndex}:${item.selectedMentionCount}`), [
  '0:6',
  '2:9',
]);
assert.equal(selectedModel.chapterBuckets[0].selectedMentionCount, 6);
assert.equal(selectedModel.chapterBuckets[1].selectedMentionCount, 9);

function profile(id, name, role, confidence, hidden) {
  return {
    id,
    bookId: 'book-1',
    canonicalName: name,
    displayName: name,
    kind: 'person',
    role,
    aliases: [],
    summary: '',
    tags: [],
    importanceScore: confidence,
    confidence,
    mentionCount: 0,
    relationCount: 0,
    eventCount: 0,
    factionMemberships: [],
    hidden,
    source: 'rule',
    createdAt: '',
    updatedAt: '',
  };
}

function appearance(id, characterId, sourceChapterIndex, chapterTitle, mentionCount, evidenceCount, firstParagraphIndex) {
  return {
    id,
    bookId: 'book-1',
    characterId,
    chapterIndex: sourceChapterIndex,
    sourceChapterIndex,
    chapterTitle,
    mentionCount,
    evidenceCount,
    firstParagraphIndex,
    lastParagraphIndex: firstParagraphIndex + 2,
    heat: mentionCount,
  };
}

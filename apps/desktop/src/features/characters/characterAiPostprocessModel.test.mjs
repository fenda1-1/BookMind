import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-ai-postprocess-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target',
  'ES2022',
  '--module',
  'CommonJS',
  '--moduleResolution',
  'Node',
  '--ignoreDeprecations',
  '6.0',
  '--outDir',
  outDir,
  '--skipLibCheck',
  'src/features/characters/characterAiPostprocessModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterAiPostprocessNameList,
  buildCharacterAiPostprocessPrompt,
  buildCharacterAiPostprocessDebugText,
  chunkCharacterAiPostprocessNameList,
  parseCharacterAiPostprocessResponse,
  buildCharacterAiPostprocessPreview,
} = require(join(outDir, 'features/characters/characterAiPostprocessModel.js'));

const profiles = [
  { id: 'char-1', canonicalName: '林七夜', displayName: '林七夜', hidden: false, gender: 'unknown' },
  { id: 'char-2', canonicalName: '红缨', displayName: '红缨', hidden: false, gender: 'unknown' },
  { id: 'char-3', canonicalName: '安卿鱼说', displayName: '安卿鱼说', hidden: false, gender: 'unknown' },
];
const mentions = [
  { characterId: 'char-1', quote: '林七夜抬头看向远处。' },
  { characterId: 'char-3', quote: '“我知道。”安卿鱼说。' },
];
const evidence = [
  { targetType: 'profile', targetId: 'char-2', quote: '红缨从门口探出脑袋。' },
];

assert.deepEqual(buildCharacterAiPostprocessNameList(profiles, mentions, evidence), [
  { index: 1, id: 'char-1', name: '林七夜', quote: '林七夜抬头看向远处。' },
  { index: 2, id: 'char-2', name: '红缨', quote: '红缨从门口探出脑袋。' },
  { index: 3, id: 'char-3', name: '安卿鱼说', quote: '“我知道。”安卿鱼说。' },
]);

const prompt = buildCharacterAiPostprocessPrompt(buildCharacterAiPostprocessNameList(profiles, mentions, evidence));
assert.match(prompt, /只输出 JSON/);
assert.match(prompt, /"g":\{"1":1,"2":2\}/);
assert.match(prompt, /"n":\[3\]/);
assert.match(prompt, /1\. 林七夜/);
assert.match(prompt, /引用：林七夜抬头看向远处。/);

const debugText = buildCharacterAiPostprocessDebugText(buildCharacterAiPostprocessNameList(profiles, mentions, evidence));
assert.match(debugText, /1\. 林七夜/);
assert.match(debugText, /引用：林七夜抬头看向远处。/);
assert.match(debugText, /2\. 红缨/);

const chunkedNames = chunkCharacterAiPostprocessNameList(Array.from({ length: 205 }, (_, index) => ({
  index: index + 1,
  id: `char-${index + 1}`,
  name: `角色${index + 1}`,
  quote: '',
})), 100);
assert.deepEqual(chunkedNames.map((chunk) => [chunk.startIndex, chunk.items.length, chunk.items[0].index, chunk.items.at(-1).index]), [
  [1, 100, 1, 100],
  [101, 100, 101, 200],
  [201, 5, 201, 205],
]);

const longProfiles = Array.from({ length: 1001 }, (_, index) => ({
  id: `long-${index + 1}`,
  canonicalName: `长名单角色${index + 1}`,
  displayName: `长名单角色${index + 1}`,
  hidden: false,
}));
assert.equal(buildCharacterAiPostprocessNameList(longProfiles).length, 1001);
assert.deepEqual(chunkCharacterAiPostprocessNameList(buildCharacterAiPostprocessNameList(longProfiles), 400).map((chunk) => chunk.items.length), [400, 400, 201]);
assert.deepEqual(chunkCharacterAiPostprocessNameList(buildCharacterAiPostprocessNameList(longProfiles), 1400).map((chunk) => chunk.items.length), [1001]);

const parsed = parseCharacterAiPostprocessResponse('```json\n{"g":{"1":1,"2":2,"3":3},"n":[3]}\n```');
assert.deepEqual(parsed, {
  genderByIndex: new Map([[1, 'male'], [2, 'female'], [3, 'unknown']]),
  noiseIndexes: new Set([3]),
});

const smartQuoteParsed = parseCharacterAiPostprocessResponse('{\n“g”: {“1”: 1, “2”: 2},\n“n”: [2]\n}');
assert.deepEqual(smartQuoteParsed, {
  genderByIndex: new Map([[1, 'male'], [2, 'female']]),
  noiseIndexes: new Set([2]),
});

const groupedGenderParsed = parseCharacterAiPostprocessResponse('{"g":{"1":[401,402],"2":[405],"3":[475,476]},"n":[475]}');
assert.deepEqual(groupedGenderParsed, {
  genderByIndex: new Map([[401, 'male'], [402, 'male'], [405, 'female'], [475, 'unknown'], [476, 'unknown']]),
  noiseIndexes: new Set([475]),
});

const preview = buildCharacterAiPostprocessPreview(profiles, parsed, new Set(['gender:char-2']));
assert.deepEqual(preview.operations, [
  { id: 'gender:char-1', type: 'gender', profileId: 'char-1', name: '林七夜', from: 'unknown', to: 'male', enabled: true },
  { id: 'gender:char-2', type: 'gender', profileId: 'char-2', name: '红缨', from: 'unknown', to: 'female', enabled: false },
  { id: 'noise:char-3', type: 'noise', profileId: 'char-3', name: '安卿鱼说', from: false, to: true, enabled: true },
]);

const protectedProfiles = [
  { id: 'char-1', canonicalName: '赵空城', displayName: '赵空城', hidden: false, gender: 'unknown' },
  { id: 'char-2', canonicalName: '洪教官', displayName: '洪教官', hidden: false, gender: 'unknown' },
  { id: 'char-3', canonicalName: '古猿', displayName: '古猿', hidden: false, gender: 'unknown' },
  { id: 'char-4', canonicalName: '魔皇', displayName: '魔皇', hidden: false, gender: 'unknown' },
  { id: 'char-5', canonicalName: '他说', displayName: '他说', hidden: false, gender: 'unknown' },
  { id: 'char-6', canonicalName: '女人', displayName: '女人', hidden: false, gender: 'unknown' },
];
const protectedParsed = parseCharacterAiPostprocessResponse('{"g":{},"n":[1,2,3,4,5,6]}');
assert.deepEqual(buildCharacterAiPostprocessPreview(protectedProfiles, protectedParsed).operations, [
  { id: 'noise:char-1', type: 'noise', profileId: 'char-1', name: '赵空城', from: false, to: true, enabled: true },
  { id: 'noise:char-2', type: 'noise', profileId: 'char-2', name: '洪教官', from: false, to: true, enabled: true },
  { id: 'noise:char-3', type: 'noise', profileId: 'char-3', name: '古猿', from: false, to: true, enabled: true },
  { id: 'noise:char-4', type: 'noise', profileId: 'char-4', name: '魔皇', from: false, to: true, enabled: true },
  { id: 'noise:char-5', type: 'noise', profileId: 'char-5', name: '他说', from: false, to: true, enabled: true },
  { id: 'noise:char-6', type: 'noise', profileId: 'char-6', name: '女人', from: false, to: true, enabled: true },
]);

const brokenSuffixProfiles = [
  { id: 'char-1', canonicalName: '林七夜如', displayName: '林七夜如', hidden: false, gender: 'unknown' },
  { id: 'char-2', canonicalName: '林七夜时', displayName: '林七夜时', hidden: false, gender: 'unknown' },
  { id: 'char-3', canonicalName: '林七夜装', displayName: '林七夜装', hidden: false, gender: 'unknown' },
  { id: 'char-4', canonicalName: '林七夜见', displayName: '林七夜见', hidden: false, gender: 'unknown' },
];
const brokenSuffixParsed = parseCharacterAiPostprocessResponse('{"g":{"1":1,"2":1,"3":1,"4":1},"n":[]}');
assert.deepEqual(buildCharacterAiPostprocessPreview(brokenSuffixProfiles, brokenSuffixParsed).operations, [
  { id: 'noise:char-1', type: 'noise', profileId: 'char-1', name: '林七夜如', from: false, to: true, enabled: true },
  { id: 'noise:char-2', type: 'noise', profileId: 'char-2', name: '林七夜时', from: false, to: true, enabled: true },
  { id: 'noise:char-3', type: 'noise', profileId: 'char-3', name: '林七夜装', from: false, to: true, enabled: true },
  { id: 'noise:char-4', type: 'noise', profileId: 'char-4', name: '林七夜见', from: false, to: true, enabled: true },
]);

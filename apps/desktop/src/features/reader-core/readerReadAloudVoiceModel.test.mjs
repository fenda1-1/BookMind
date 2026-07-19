import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-reader-read-aloud-voice-model-test-${process.pid}`);
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
  'src/features/reader-core/readerReadAloudVoiceModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  detectReaderReadAloudSpeaker,
  parseReaderReadAloudCharacterVoiceRules,
  resolveReaderReadAloudVoiceURI,
} = require(join(outDir, 'features/reader-core/readerReadAloudVoiceModel.js'));

const profile = {
  readerReadAloudNarratorVoiceURI: 'voice-narrator',
  readerReadAloudMaleVoiceURI: 'voice-male',
  readerReadAloudFemaleVoiceURI: 'voice-female',
  readerReadAloudCharacterVoiceRules: '林七夜 => 男声\n红缨 => 女声\n温祈墨 => Custom Voice',
};

const voices = [
  { voiceURI: 'voice-narrator', name: 'Narrator', lang: 'zh-CN' },
  { voiceURI: 'voice-male', name: 'Male', lang: 'zh-CN' },
  { voiceURI: 'voice-female', name: 'Female', lang: 'zh-CN' },
  { voiceURI: 'voice-custom', name: 'Custom Voice', lang: 'zh-CN' },
];

assert.equal(detectReaderReadAloudSpeaker('“我知道了。”林七夜说道。'), '林七夜');
assert.equal(detectReaderReadAloudSpeaker('红缨喊：“快走！”'), '红缨');
assert.equal(detectReaderReadAloudSpeaker('夜色很深，雨一直下。'), null);

assert.deepEqual(parseReaderReadAloudCharacterVoiceRules('林七夜 => 男声\n红缨：女声'), [
  { name: '林七夜', target: '男声' },
  { name: '红缨', target: '女声' },
]);

assert.deepEqual(resolveReaderReadAloudVoiceURI({ text: '“我知道了。”林七夜说道。', paragraphIndex: 0 }, profile, voices), {
  role: 'male',
  speaker: '林七夜',
  voiceURI: 'voice-male',
});

assert.deepEqual(resolveReaderReadAloudVoiceURI({ text: '红缨喊：“快走！”', paragraphIndex: 1 }, profile, voices), {
  role: 'female',
  speaker: '红缨',
  voiceURI: 'voice-female',
});

assert.deepEqual(resolveReaderReadAloudVoiceURI({ text: '“走吧。”温祈墨笑着说道。', paragraphIndex: 2 }, profile, voices), {
  role: 'narrator',
  speaker: '温祈墨',
  voiceURI: 'voice-custom',
});

assert.deepEqual(resolveReaderReadAloudVoiceURI({ text: '夜色很深，雨一直下。', paragraphIndex: 3 }, profile, voices), {
  role: 'narrator',
  speaker: null,
  voiceURI: 'voice-narrator',
});

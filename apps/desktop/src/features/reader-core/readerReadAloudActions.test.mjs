import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-reader-read-aloud-actions-test-${process.pid}`);
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
  'src/features/reader-core/readerReadAloudActions.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  createReaderReadAloudActions,
} = require(join(outDir, 'features/reader-core/readerReadAloudActions.js'));

const chapter = {
  id: 'chapter-1',
  title: '第一章',
  index: 0,
  startLine: 0,
  paragraphs: ['第一段内容。', '第二段内容。'],
};

function createHarness(overrides = {}) {
  let active = false;
  let paused = false;
  let location = null;
  const utterances = [];
  const synthCalls = [];
  const synth = {
    cancel() { synthCalls.push('cancel'); },
    pause() { synthCalls.push('pause'); },
    resume() { synthCalls.push('resume'); },
    speak(utterance) {
      synthCalls.push(`speak:${utterance.text}`);
      utterances.push(utterance);
    },
  };
  const voice = { voiceURI: 'voice-male', name: 'Male', lang: 'zh-CN' };
  const refs = {
    utteranceRef: { current: null },
    queueRef: { current: [] },
    queueIndexRef: { current: 0 },
    stoppingRef: { current: false },
    sessionRef: { current: 0 },
  };
  const actions = createReaderReadAloudActions({
    getActiveChapter: () => overrides.chapter ?? chapter,
    getReadAloudAvailable: () => overrides.available ?? true,
    getReaderReadAloudEnabled: () => overrides.enabled ?? true,
    getReaderReadAloudRate: () => 1.25,
    getReaderReadAloudPitch: () => 0.85,
    resolveReaderReadAloudVoice: (segment) => overrides.resolveVoice?.(segment) ?? null,
    getReaderSpeechSynthesis: () => overrides.synth ?? synth,
    canCreateSpeechSynthesisUtterance: () => overrides.canCreateUtterance ?? true,
    createSpeechSynthesisUtterance: (text) => ({ text, lang: '', rate: 0, pitch: 0, onend: null, onerror: null }),
    readAloudUtteranceRef: refs.utteranceRef,
    readAloudQueueRef: refs.queueRef,
    readAloudQueueIndexRef: refs.queueIndexRef,
    readAloudStoppingRef: refs.stoppingRef,
    readAloudSessionRef: refs.sessionRef,
    getReadAloudActive: () => active,
    getReadAloudPaused: () => paused,
    setReadAloudActive: (next) => { active = next; },
    setReadAloudPaused: (next) => { paused = next; },
    setReadAloudLocation: (next) => { location = next; },
  });
  return {
    actions,
    getActive: () => active,
    getPaused: () => paused,
    getLocation: () => location,
    refs,
    synthCalls,
    utterances,
    voice,
  };
}

{
  const harness = createHarness();

  harness.actions.startReaderReadAloud();

  assert.equal(harness.getActive(), true);
  assert.equal(harness.getPaused(), false);
  assert.deepEqual(harness.synthCalls.slice(0, 2), ['cancel', 'speak:第一章']);
  assert.equal(harness.utterances[0].lang, 'zh-CN');
  assert.equal(harness.utterances[0].rate, 1.25);
  assert.equal(harness.utterances[0].pitch, 0.85);
  assert.deepEqual(harness.getLocation(), { sourceChapterIndex: 0, paragraphIndex: null });

  harness.utterances[0].onend();
  assert.equal(harness.refs.queueIndexRef.current, 1);
  assert.equal(harness.synthCalls.at(-1), 'speak:第一段内容。');
  assert.deepEqual(harness.getLocation(), { sourceChapterIndex: 0, paragraphIndex: 0 });

  harness.utterances[1].onend();
  assert.equal(harness.refs.queueIndexRef.current, 2);
  assert.equal(harness.synthCalls.at(-1), 'speak:第二段内容。');
  assert.deepEqual(harness.getLocation(), { sourceChapterIndex: 0, paragraphIndex: 1 });

  harness.utterances[2].onend();
  assert.equal(harness.getActive(), false);
  assert.equal(harness.getPaused(), false);
  assert.equal(harness.getLocation(), null);
}

{
  const harness = createHarness({ resolveVoice: () => ({ voiceURI: 'voice-male', name: 'Male', lang: 'zh-CN' }) });

  harness.actions.startReaderReadAloud(0);

  assert.deepEqual(harness.utterances[0].voice, { voiceURI: 'voice-male', name: 'Male', lang: 'zh-CN' });
}

{
  const harness = createHarness();

  harness.actions.startReaderReadAloud(1);

  assert.equal(harness.synthCalls.at(-1), 'speak:第二段内容。');
  assert.deepEqual(harness.getLocation(), { sourceChapterIndex: 0, paragraphIndex: 1 });
}

{
  const harness = createHarness();

  harness.actions.startReaderReadAloud();
  harness.actions.pauseOrResumeReaderReadAloud();
  assert.equal(harness.getPaused(), true);
  assert.equal(harness.synthCalls.at(-1), 'pause');

  harness.actions.pauseOrResumeReaderReadAloud();
  assert.equal(harness.getPaused(), false);
  assert.equal(harness.synthCalls.at(-1), 'resume');
}

{
  const harness = createHarness();

  harness.actions.startReaderReadAloud();
  harness.actions.stopReaderReadAloud();

  assert.equal(harness.getActive(), false);
  assert.equal(harness.getPaused(), false);
  assert.equal(harness.refs.stoppingRef.current, false);
  assert.deepEqual(harness.refs.queueRef.current, []);
  assert.equal(harness.synthCalls.at(-1), 'cancel');
}

{
  const harness = createHarness({ canCreateUtterance: false });

  harness.actions.startReaderReadAloud();

  assert.equal(harness.getActive(), false);
  assert.deepEqual(harness.synthCalls, []);
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-app-task-actions-character-overlay-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--jsx', 'react-jsx',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/app/appTaskActions.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { liveCharacterTaskOverlay, localCharacterExtractionOverlay } = require(join(outDir, 'app', 'appTaskActions.js'));

const staleBuildingSummary = {
  id: 'book-1',
  characterIndexStatus: 'building',
  lastTaskId: 'old-running-task',
  recentLogEntry: '旧状态：保存人物索引',
  lastError: '',
  errorCode: '',
  errorStage: '',
};

const overlay = liveCharacterTaskOverlay(staleBuildingSummary, [
  characterTask({ id: 'task-character-succeeded', status: 'succeeded', updatedAt: '1782939239714', finishedAt: '1782939239714', message: '人物识别已完成' }),
]);

assert.equal(overlay.characterIndexStatus, 'ready', 'A succeeded character extraction task must override stale building summaries');
assert.equal(overlay.lastTaskId, 'task-character-succeeded');
assert.equal(overlay.recentLogEntry, '人物识别已完成');
assert.equal(overlay.lastError, '');
assert.equal(overlay.errorCode, '');
assert.equal(overlay.errorStage, '');

const localQueuedOverlay = localCharacterExtractionOverlay({
  id: 'book-1',
  characterIndexStatus: 'missing',
  lastTaskId: '',
  recentLogEntry: '',
  lastError: '',
  errorCode: '',
  errorStage: '',
}, 'book-1', []);

assert.deepEqual(localQueuedOverlay, {}, 'Local character extraction state must not invent queued status when no backend task exists');

function characterTask(overrides) {
  return {
    id: overrides.id,
    kind: 'character-extraction',
    name: '人物识别 · 《杀死一只知更鸟》',
    status: overrides.status,
    progress: 100,
    stage: 'done',
    stageLabel: '保存人物索引',
    tone: 'sage',
    message: overrides.message ?? '',
    bookId: 'book-1',
    bookTitle: '杀死一只知更鸟',
    fileName: 'mock.epub',
    createdAt: '',
    updatedAt: overrides.updatedAt ?? '',
    startedAt: '',
    finishedAt: overrides.finishedAt ?? '',
    durationMs: 5000,
    attempt: 0,
    maxAttempts: 3,
    errorCode: '',
    errorMessage: '',
    logCount: 0,
    dagId: '',
    dependsOn: [],
    blockedBy: [],
    outputSummary: {},
    error: { code: '', message: '', stage: '', retryable: false, detail: {} },
  };
}

console.log('Verified character extraction completion overlays stale running state.');

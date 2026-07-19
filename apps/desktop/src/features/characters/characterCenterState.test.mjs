import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-center-state-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterCenterState.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { resolveCharacterCenterState } = require(join(outDir, 'features', 'characters', 'characterCenterState.js'));

const book = { id: 'book-1' };

assertState('no-book', resolveCharacterCenterState(null, indexView('missing'), 'missing'), {
  primaryAction: 'none',
  showZeroCharacterMetrics: false,
});

assertState('text-index-missing', resolveCharacterCenterState(book, indexView('missing'), 'blocked-by-text-index'), {
  primaryAction: 'build-text-index',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.textIndexMissingBody',
});

assertState('text-index-stale', resolveCharacterCenterState(book, indexView('stale', { staleReason: 'chapter rules changed' }), 'blocked-by-text-index'), {
  primaryAction: 'rebuild-text-index',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.textIndexStaleBodyWithReason',
  readinessBodyParams: { reason: 'chapter rules changed' },
});

assertState('text-index-stale', resolveCharacterCenterState(book, indexView('stale'), 'blocked-by-text-index'), {
  primaryAction: 'rebuild-text-index',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.textIndexStaleBody',
});

const failedState = resolveCharacterCenterState(book, indexView('failed'), 'blocked-by-text-index', { lastError: 'file read failed' });
assertState('text-index-failed', failedState, {
  primaryAction: 'open-tasks',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.textIndexFailedBodyWithError',
  readinessBodyParams: { error: 'file read failed' },
});
assert.deepEqual(failedState.secondaryActions, ['open-reader'], 'failed text-index state must not duplicate open-tasks as both primary and secondary action');

const failedTextIndexQueuedCharacterState = resolveCharacterCenterState(book, indexView('failed'), 'queued', { lastError: 'file read failed' });
assertState('text-index-failed', failedTextIndexQueuedCharacterState, {
  primaryAction: 'open-tasks',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.textIndexFailedBodyWithError',
  readinessBodyParams: { error: 'file read failed' },
  characterIndexStatus: 'blocked-by-text-index',
});

const missingTextIndexFailedCharacterState = resolveCharacterCenterState(book, indexView('missing'), 'failed', {
  lastError: '当前书没有全文索引 manifest',
  lastTaskId: 'task-character-missing-text-index',
  errorCode: 'character_index_missing_text_index',
  errorStage: 'build-chunks',
  recentLogEntry: '人物识别失败',
});
assertState('character-index-failed', missingTextIndexFailedCharacterState, {
  primaryAction: 'open-tasks',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.characterFailedBodyWithError',
  readinessBodyParams: { error: '当前书没有全文索引 manifest' },
  characterIndexStatus: 'failed',
});
assert.deepEqual(missingTextIndexFailedCharacterState.failureDiagnostics, {
  lastTaskId: 'task-character-missing-text-index',
  errorCode: 'character_index_missing_text_index',
  errorAdviceKey: 'characters.failureAdvice.character_index_missing_text_index',
  errorStage: 'build-chunks',
  recentLogEntry: '人物识别失败',
}, 'missing text-index character failure must preserve task diagnostics instead of showing the text-index start state');

assertState('character-index-missing', resolveCharacterCenterState(book, indexView('ready'), 'missing'), {
  primaryAction: 'character-extraction',
  showZeroCharacterMetrics: true,
  readinessTitleKey: 'characters.readiness.characterMissingTitle',
  readinessBodyKey: 'characters.readiness.characterMissingBody',
  readinessHintKey: 'characters.readiness.characterMissingHint',
});

assertState('character-index-missing', resolveCharacterCenterState(book, indexView('ready'), 'missing', { staleReason: '人物索引文件缺失，请重建人物索引' }), {
  primaryAction: 'rebuild-character-index',
  showZeroCharacterMetrics: true,
  readinessTitleKey: 'characters.readiness.characterMissingRepairTitle',
  readinessBodyKey: 'characters.readiness.characterMissingRepairBodyWithReason',
  readinessBodyParams: { reason: '人物索引文件缺失，请重建人物索引' },
});

assertState('character-index-queued', resolveCharacterCenterState(book, indexView('ready'), 'queued'), {
  primaryAction: 'open-tasks',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.characterQueuedBody',
});

assertState('character-index-building', resolveCharacterCenterState(book, indexView('ready'), 'building'), {
  primaryAction: 'open-tasks',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.characterBuildingBody',
});

const characterFailedState = resolveCharacterCenterState(book, indexView('ready'), 'failed', { lastError: 'AI JSON parse failed' });
assertState('character-index-failed', characterFailedState, {
  primaryAction: 'open-tasks',
  showZeroCharacterMetrics: false,
  readinessBodyKey: 'characters.readiness.characterFailedBodyWithError',
  readinessBodyParams: { error: 'AI JSON parse failed' },
});
assert.deepEqual(characterFailedState.secondaryActions, ['open-reader'], 'failed character-index state must not duplicate open-tasks as both primary and secondary action');

const characterFailedDiagnosticState = resolveCharacterCenterState(book, indexView('ready'), 'failed', {
  lastError: 'AI JSON parse failed',
  lastTaskId: 'task-character-1',
  errorCode: 'character_ai_parse_failed',
  errorStage: 'ai-extract',
  recentLogEntry: 'JSON parse failed at chunk 42',
});
assert.deepEqual(characterFailedDiagnosticState.failureDiagnostics, {
  lastTaskId: 'task-character-1',
  errorCode: 'character_ai_parse_failed',
  errorAdviceKey: 'characters.failureAdvice.character_ai_parse_failed',
  errorStage: 'ai-extract',
  recentLogEntry: 'JSON parse failed at chunk 42',
}, 'failed character-index state must preserve task id, error code, error stage, and recent log entry when provided');

const characterFailedEmptyDiagnosticState = resolveCharacterCenterState(book, indexView('ready'), 'failed');
assert.equal(characterFailedEmptyDiagnosticState.failureDiagnostics, undefined, 'failed character-index state must not invent task diagnostics when none are provided');

assertState('character-index-stale', resolveCharacterCenterState(book, indexView('ready'), 'stale', { staleReason: 'text index content hash changed' }), {
  primaryAction: 'rebuild-character-index',
  showZeroCharacterMetrics: true,
  readinessBodyKey: 'characters.readiness.characterStaleBodyWithReason',
  readinessBodyParams: { reason: 'text index content hash changed' },
});

assertState('character-index-stale', resolveCharacterCenterState(book, indexView('ready'), 'stale', { lastError: 'last error is not a stale reason' }), {
  primaryAction: 'rebuild-character-index',
  showZeroCharacterMetrics: true,
  readinessBodyKey: 'characters.readiness.characterStaleBody',
});

assertState('character-index-ready', resolveCharacterCenterState(book, indexView('ready'), 'ready'), {
  primaryAction: 'none',
  showZeroCharacterMetrics: true,
  readinessBodyKey: 'characters.readiness.readyBody',
});

function assertState(stateId, state, expected) {
  assert.equal(state.stateId, stateId);
  assert.equal(state.primaryAction, expected.primaryAction);
  assert.equal(state.showZeroCharacterMetrics, expected.showZeroCharacterMetrics);
  assert.ok(state.secondaryActions.length <= 3, `${stateId} secondary actions must be capped at three`);
  if (expected.characterIndexStatus) assert.equal(state.characterIndexStatus, expected.characterIndexStatus);
  if (expected.readinessTitleKey) assert.equal(state.readinessTitleKey, expected.readinessTitleKey);
  if (expected.readinessBodyKey) assert.equal(state.readinessBodyKey, expected.readinessBodyKey);
  if (expected.readinessHintKey) assert.equal(state.readinessHintKey, expected.readinessHintKey);
  if (expected.readinessBodyParams) assert.deepEqual(state.readinessBodyParams, expected.readinessBodyParams);
}

function indexView(status, overrides = {}) {
  return {
    status,
    ready: status === 'ready',
    missing: status === 'missing',
    stale: status === 'stale',
    failed: status === 'failed',
    staleReason: '',
    chunkCount: status === 'ready' ? 24 : 0,
    ...overrides,
  };
}

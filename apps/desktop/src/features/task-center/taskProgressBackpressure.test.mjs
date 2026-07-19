import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const taskService = readFileSync(new URL('../../services/taskService.ts', import.meta.url), 'utf8');
const appTaskActions = readFileSync(new URL('../../app/appTaskActions.ts', import.meta.url), 'utf8');
const taskCenterState = readFileSync(new URL('./useTaskCenterState.ts', import.meta.url), 'utf8');
const progress = readFileSync(new URL('../../../src-tauri/src/tasks/progress.rs', import.meta.url), 'utf8');

assert.match(
  taskService,
  /const TASK_PROGRESS_EVENT_FLUSH_MS = 250/u,
  'frontend task progress events should be batched to avoid rerendering the whole app for every backend tick.',
);
assert.match(
  taskService,
  /createTaskProgressEventBatcher/u,
  'task service should expose a progress event batcher.',
);
assert.match(
  appTaskActions,
  /handleTaskProgressEventBatch/u,
  'app task actions should process a batch of progress events in one state update.',
);
assert.match(
  taskCenterState,
  /subscribeTaskProgressEvents\(\(events\) =>/u,
  'task center state should consume batched progress events.',
);
assert.match(
  progress,
  /const STREAM_PROGRESS_MIN_DELTA: f64 = 0\.5/u,
  'backend should skip tiny progress updates that do not move visible progress enough.',
);
assert.match(
  progress,
  /const STREAM_PROGRESS_MIN_INTERVAL_MS: u128 = 250/u,
  'backend should not save and emit progress snapshots more often than the visible UI can consume.',
);

console.log('Verified task progress backpressure contract.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(
  app,
  /settings-task-startup-notice/u,
  'App shell should not render a top startup unfinished-task notice above the reader.',
);
assert.doesNotMatch(
  app,
  /检测到 \{unfinishedTaskSummary\.count\} 个未完成任务/u,
  'Startup unfinished-task state must not reserve visible reader workspace space.',
);
assert.match(
  app,
  /unfinishedTaskSummary,\s*setUnfinishedTaskSummary/u,
  'Startup task summary state should remain available for background resume logic.',
);

console.log('Verified startup task notice is not rendered in the reader shell.');

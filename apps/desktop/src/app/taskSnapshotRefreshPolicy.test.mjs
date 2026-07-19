import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/app/useTaskCenter.ts', 'utf8');

assert.match(
  source,
  /function refresh\(\) \{[\s\S]{0,220}loadTaskStatuses\(\)\.then\(\(tasks\) =>/u,
  'Task update refresh should reload the authoritative task list.',
);
assert.match(
  source,
  /backgroundTaskPreviousSnapshotRef\.current = tasks;[\s\S]{0,80}setTaskSnapshot\(tasks\)/u,
  'Task update refresh should replace stale App task snapshots.',
);
assert.match(
  source,
  /window\.addEventListener\(tasksUpdatedEvent, refresh\)/u,
  'Task update events should trigger the task snapshot refresh path.',
);

console.log('Verified task snapshot refresh policy.');

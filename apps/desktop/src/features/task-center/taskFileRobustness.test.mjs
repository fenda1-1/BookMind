import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tasks = readFileSync(new URL('../../../src-tauri/src/tasks.rs', import.meta.url), 'utf8');
const progress = readFileSync(new URL('../../../src-tauri/src/tasks/progress.rs', import.meta.url), 'utf8');

assert.match(
  tasks,
  /unique_atomic_temp_path\(&path, "json\.tmp"\)/u,
  'index manifest writes should use a unique temporary path instead of a shared .json.tmp file.',
);
assert.match(
  tasks,
  /unique_atomic_temp_path\(&path, "vector\.json\.tmp"\)/u,
  'vector manifest writes should use a unique temporary path instead of a shared .json.tmp file.',
);
assert.match(
  progress,
  /match serde_json::from_str::<TaskLogRecord>\(line\)/u,
  'task log loading should parse JSONL lines independently.',
);
assert.match(
  progress,
  /eprintln!\(\s*"跳过损坏的任务日志行/u,
  'task log loading should skip corrupt JSONL lines instead of failing the whole log page.',
);

console.log('Verified task file robustness contract.');

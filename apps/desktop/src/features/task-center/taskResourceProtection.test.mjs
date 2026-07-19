import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const taskService = readFileSync(new URL('../../services/taskService.ts', import.meta.url), 'utf8');
const commands = [
  '../../../src-tauri/src/commands.rs',
  '../../../src-tauri/src/commands/task_commands.rs',
  '../../../src-tauri/src/commands/library_commands.rs',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const runner = readFileSync(new URL('../../../src-tauri/src/tasks/runner.rs', import.meta.url), 'utf8');
const taskCenterState = readFileSync(new URL('./useTaskCenterState.ts', import.meta.url), 'utf8');

assert.match(taskService, /let runParseAndIndexTasksInFlight: Promise<TaskStatus\[\]> \| null = null/u, 'frontend task runner requests must be coalesced');
assert.match(taskService, /if \(runParseAndIndexTasksInFlight\) return runParseAndIndexTasksInFlight/u, 'frontend must reuse an in-flight run request instead of starting another backend runner');
assert.match(taskService, /finally\(\(\) => \{ runParseAndIndexTasksInFlight = null; \}\)/u, 'frontend in-flight run request must clear after completion');

assert.match(commands, /try_acquire_task_runner/u, 'backend command must guard detached task runner with a global run lock');
assert.match(commands, /let Some\(runner_guard\) = try_acquire_task_runner\(\) else \{[\s\S]*return task_statuses_for_ui\(&data_dir\);[\s\S]*\};/u, 'backend must return current statuses without spawning a second runner when one is active');
assert.match(commands, /let _runner_guard = runner_guard/u, 'detached backend worker must hold the runner guard for the whole run');
assert.match(commands, /import_dev_sample_book_and_index[\s\S]*if let Some\(runner_guard\) = try_acquire_task_runner\(\)[\s\S]*let _runner_guard = runner_guard;[\s\S]*run_parse_and_index_tasks_in\(&data_dir\)\?/u, 'sample import indexing must also respect the global runner lock');

assert.match(runner, /pub\(crate\) fn try_acquire_task_runner\(\) -> Option<TaskRunnerGuard>/u, 'runner module must expose a nonblocking global runner lock');
assert.match(runner, /static TASK_RUNNER_ACTIVE: AtomicBool/u, 'runner lock must be process-wide and atomic');
assert.match(runner, /thread::sleep\(Duration::from_millis\(TASK_BATCH_COOLDOWN_MS\)\)/u, 'runner must yield between batches to reduce sustained CPU pressure');
assert.match(runner, /const TASK_BATCH_COOLDOWN_MS: u64 = 25/u, 'runner batch cooldown should be explicit and small');

assert.match(taskCenterState, /const runQueuedTasksInFlightRef = useRef<Promise<void> \| null>\(null\)/u, 'task center UI must coalesce repeated run button clicks');
assert.match(taskCenterState, /if \(runQueuedTasksInFlightRef\.current\) return runQueuedTasksInFlightRef\.current/u, 'task center run action must reuse the current run promise');

console.log('Verified task resource protection contract.');

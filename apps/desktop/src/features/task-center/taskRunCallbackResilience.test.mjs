import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const taskService = readFileSync(new URL('../../services/taskService.ts', import.meta.url), 'utf8');

assert.match(taskService, /function isTauriCallbackGoneError\(error: unknown\)/u, 'task service should classify missing Tauri callback errors');
assert.match(taskService, /Couldn't find callback id/u, 'missing callback classifier should detect the Tauri callback warning text');
assert.match(taskService, /catch\(async \(error\) => \{[\s\S]*isTauriCallbackGoneError\(error\)[\s\S]*return await loadTaskStatuses\(\)/u, 'runParseAndIndexTasks should recover by reloading task statuses');
assert.doesNotMatch(taskService, /console\.warn\('Failed to run parse and index tasks'[\s\S]*Couldn't find callback id/u, 'missing callback warnings should not be surfaced as a task failure');

console.log('Verified parse/index task runner tolerates lost Tauri callbacks after dev reload.');

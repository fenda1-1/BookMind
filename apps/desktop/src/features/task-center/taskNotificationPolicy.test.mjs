import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-notification-policy-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskNotificationPolicy.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { buildBackgroundTaskCompletionMessage, getCharacterCompletionToastAction, shouldShowTaskCompletionToast } = await import(pathToFileURL(join(outDir, 'features', 'task-center', 'taskNotificationPolicy.js')).href);

assert.equal(buildBackgroundTaskCompletionMessage({ count: 3 }), '后台任务已完成：3 项');
assert.equal(
  buildBackgroundTaskCompletionMessage({ tasks: [{ status: 'succeeded' }, { status: 'failed' }, { status: 'succeeded' }] }),
  '后台任务完成：2 项成功，1 项失败',
  'completion message should separate successful and failed terminal tasks when explicit count is absent',
);
assert.equal(
  buildBackgroundTaskCompletionMessage({ tasks: [{ status: 'failed' }, { status: 'cancelled' }] }),
  '后台任务失败：1 项',
  'completion message should surface failure-only batches as failures',
);
assert.equal(buildBackgroundTaskCompletionMessage(undefined), '后台任务已完成');
assert.deepEqual(
  getCharacterCompletionToastAction({ tasks: [{ kind: 'character-extraction', status: 'succeeded', bookId: 'book-1', bookTitle: '长篇小说' }] }),
  { bookId: 'book-1' },
  'successful character extraction completion toast should expose a direct Character Center action',
);
assert.equal(
  getCharacterCompletionToastAction({ tasks: [{ kind: 'character-extraction', status: 'failed', bookId: 'book-1', bookTitle: '长篇小说' }] }),
  null,
  'failed character extraction tasks should not expose the direct Character Center action',
);
assert.equal(
  getCharacterCompletionToastAction({ tasks: [{ kind: 'parse-and-index', status: 'succeeded', bookId: 'book-1', bookTitle: '长篇小说' }] }),
  null,
  'non-character task completion toasts should keep the generic task-center action',
);

assert.equal(shouldShowTaskCompletionToast('silent', false), false, 'silent policy must suppress completion toast');
assert.equal(shouldShowTaskCompletionToast('toast', false), true, 'toast policy must show app toast');
assert.equal(shouldShowTaskCompletionToast('system-notification', true), false, 'successful system notification must suppress duplicate toast');
assert.equal(shouldShowTaskCompletionToast('system-notification', false), true, 'failed system notification must fall back to toast');

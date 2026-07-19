import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-privacy-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskPrivacy.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { displayTaskFileName, displayTaskPath, redactTaskText } = await import(pathToFileURL(join(outDir, 'taskPrivacy.js')).href);

assert.equal(displayTaskPath('E:\\private\\library\\secret-book.txt', false), 'E:\\private\\library\\secret-book.txt');
assert.equal(displayTaskPath('E:\\private\\library\\secret-book.txt', true), 'secret-book.txt');
assert.equal(displayTaskPath('/Users/alice/private/secret-book.txt', true), 'secret-book.txt');
assert.equal(displayTaskFileName('nested/private/secret-book.txt', true), 'secret-book.txt');
assert.equal(displayTaskFileName('', true), '-');
assert.equal(redactTaskText('无法读取 E:\\private\\library\\secret-book.txt', true), '无法读取 secret-book.txt');
assert.equal(redactTaskText('cache at /Users/alice/private/chunk-store.json failed', true), 'cache at chunk-store.json failed');
assert.equal(redactTaskText('无法读取 E:\\private\\library\\secret-book.txt', false), '无法读取 E:\\private\\library\\secret-book.txt');

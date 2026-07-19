import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-concurrency-policy-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskConcurrencyPolicy.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { resolveTaskConcurrencyPolicy } = await import(pathToFileURL(join(outDir, 'features', 'task-center', 'taskConcurrencyPolicy.js')).href);

assert.deepEqual(
  resolveTaskConcurrencyPolicy({
    ftsWriteSerial: true,
    importConcurrency: '4',
    parseConcurrency: '3',
    taskConcurrency: '5',
    vectorConcurrencyReserved: '2',
  }),
  {
    ftsWriteSerial: true,
    globalLimit: 5,
    importConcurrency: 3,
    parseConcurrency: 3,
    vectorConcurrencyReserved: 2,
  },
  'task concurrency policy must reserve vector slots before import/parse concurrency',
);

assert.deepEqual(
  resolveTaskConcurrencyPolicy({
    ftsWriteSerial: false,
    importConcurrency: '999',
    parseConcurrency: '0',
    taskConcurrency: 'bad',
    vectorConcurrencyReserved: '8',
  }),
  {
    ftsWriteSerial: false,
    globalLimit: 1,
    importConcurrency: 1,
    parseConcurrency: 1,
    vectorConcurrencyReserved: 1,
  },
  'task concurrency policy must clamp invalid values and keep one CPU slot available',
);

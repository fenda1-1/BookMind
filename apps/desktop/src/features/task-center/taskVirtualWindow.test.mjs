import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-task-virtual-window-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/task-center/taskVirtualWindow.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { getVirtualWindow } = await import(pathToFileURL(join(outDir, 'taskVirtualWindow.js')).href);

assert.deepEqual(
  getVirtualWindow(1000, 0, 320, 40, 4),
  { startIndex: 0, endIndex: 12, beforeHeight: 0, afterHeight: 39520, totalHeight: 40000 },
  'top window should render only visible rows plus overscan',
);

assert.deepEqual(
  getVirtualWindow(1000, 20000, 320, 40, 4),
  { startIndex: 496, endIndex: 512, beforeHeight: 19840, afterHeight: 19520, totalHeight: 40000 },
  'middle window should include before and after spacer heights',
);

assert.deepEqual(
  getVirtualWindow(3, 1000, 320, 40, 4),
  { startIndex: 3, endIndex: 3, beforeHeight: 120, afterHeight: 0, totalHeight: 120 },
  'small lists should clamp safely',
);

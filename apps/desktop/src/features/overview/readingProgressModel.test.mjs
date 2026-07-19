import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-reading-progress-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/overview/readingProgressModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { shouldApplyReadingProgressUpdate, shouldRecordReadingStatsSample } = await import(pathToFileURL(join(outDir, 'readingProgressModel.js')).href);

assert.equal(shouldApplyReadingProgressUpdate(1, 2), true, 'reading progress should advance normally');
assert.equal(shouldApplyReadingProgressUpdate(2, 1), false, 'small backward movement should not erase legitimate progress');
assert.equal(shouldApplyReadingProgressUpdate(100, 1), true, 'a stale 100% progress value should be corrected by the current early reading position');
assert.equal(shouldApplyReadingProgressUpdate(90, 1), false, 'large regressions below the completion threshold should not be applied');
assert.equal(shouldApplyReadingProgressUpdate(1, 0), false, 'zero progress should not be persisted as a reading update');

assert.equal(
  shouldRecordReadingStatsSample({ currentProgress: 31, nextProgress: 31, previousPageCurrent: 12, pageCurrent: 13, minutesRead: 0 }),
  true,
  'overview reading stats should still record page turns when rounded progress does not change',
);
assert.equal(
  shouldRecordReadingStatsSample({ currentProgress: 0, nextProgress: 0, previousPageCurrent: 1, pageCurrent: 2, minutesRead: 0 }),
  true,
  'overview reading stats should record first external/page samples even before a non-zero progress percentage is available',
);
assert.equal(
  shouldRecordReadingStatsSample({ currentProgress: 31, nextProgress: 31, previousPageCurrent: 13, pageCurrent: 13, minutesRead: 0 }),
  false,
  'unchanged reading position should not create duplicate overview stats samples',
);

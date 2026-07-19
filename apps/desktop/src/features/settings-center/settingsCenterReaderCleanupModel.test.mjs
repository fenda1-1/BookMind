import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-reader-cleanup-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterReaderCleanupModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildAllReaderCacheLocalStoragePrefixes,
  buildCurrentBookAllDataLocalStoragePlan,
  buildReaderCacheLocalStoragePlanForBook,
  readerPageCacheLocalStoragePrefix,
} = require(join(outDir, 'settingsCenterReaderCleanupModel.js'));

assert.deepEqual(buildReaderCacheLocalStoragePlanForBook('book-1'), {
  keys: [
    'bookmind:reader-state:book-1',
    'bookmind:reader-window:book-1',
  ],
  prefixes: [
    'bookmind:reader-page-cache:book-1:',
  ],
});

assert.deepEqual(buildAllReaderCacheLocalStoragePrefixes(), [
  'bookmind:reader-state:',
  'bookmind:reader-window:',
  'bookmind:reader-page-cache:',
]);

assert.equal(readerPageCacheLocalStoragePrefix('book-1'), 'bookmind:reader-page-cache:book-1:');

assert.deepEqual(buildCurrentBookAllDataLocalStoragePlan('book-1'), {
  keys: [
    'bookmind:reader-state:book-1',
    'bookmind:reader-window:book-1',
    'bookmind:reader-highlights:book-1',
    'bookmind:reader-bookmarks:book-1',
    'bookmind:reader-highlight-color:book-1',
    'bookmind:reader-toc-edits:book-1',
    'bookmind:reader-highlights-index:book-1',
  ],
  prefixes: [
    'bookmind:reader-highlight-entry:book-1:',
    'bookmind:reader-page-cache:book-1:',
  ],
});

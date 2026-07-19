import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('./useReaderPaginationController.ts', import.meta.url), 'utf8');

assert.match(
  controller,
  /const target = getReaderChapterPageTargetFromStreamIndex\(measuredChapterPageCounts, pageIndex\)/u,
  'reader page jump should map the typed global page through measured pagination, matching the displayed page meter',
);
assert.doesNotMatch(
  controller,
  /const target = getReaderChapterPageTargetFromStreamIndex\(estimatedChapterPageCounts, pageIndex\)/u,
  'reader page jump must not use estimated pagination because it can diverge from displayed measured pages',
);

console.log('Verified reader page jump uses measured pagination.');

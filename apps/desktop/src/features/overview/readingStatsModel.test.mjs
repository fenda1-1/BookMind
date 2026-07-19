import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-reading-stats-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/overview/readingStatsModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { appendReadingStatsSample, normalizeReadingStatsRecord } = await import(pathToFileURL(join(outDir, 'readingStatsModel.js')).href);

const first = appendReadingStatsSample(null, 'book-1', {
  date: '2026-06-27',
  progress: 42,
  previousProgress: 35,
  pageCount: 200,
  minutesRead: 16,
  chapterTitle: '第十八章',
  updatedAt: '2026-06-27T09:00:00.000Z',
});

assert.deepEqual(first.days.map((day) => [day.date, day.pagesRead, day.minutesRead, day.progressStart, day.progressEnd, day.sessions, day.lastChapterTitle]), [
  ['2026-06-27', 14, 16, 35, 42, 1, '第十八章'],
]);

const second = appendReadingStatsSample(first, 'book-1', {
  date: '2026-06-27',
  progress: 45,
  previousProgress: 42,
  pageCount: 200,
  minutesRead: 11,
  chapterTitle: '第十九章',
  updatedAt: '2026-06-27T10:00:00.000Z',
});

assert.deepEqual(second.days.map((day) => [day.date, day.pagesRead, day.minutesRead, day.progressStart, day.progressEnd, day.sessions, day.lastChapterTitle]), [
  ['2026-06-27', 20, 27, 35, 45, 2, '第十九章'],
]);

const unchanged = appendReadingStatsSample(second, 'book-1', {
  date: '2026-06-27',
  progress: 45,
  previousProgress: 45,
  pageCount: 200,
  minutesRead: 0,
  chapterTitle: '第十九章',
  updatedAt: '2026-06-27T10:01:00.000Z',
});

assert.deepEqual(unchanged.days.map((day) => [day.date, day.pagesRead, day.minutesRead, day.progressStart, day.progressEnd, day.sessions, day.lastChapterTitle]), [
  ['2026-06-27', 20, 27, 35, 45, 2, '第十九章'],
]);

const timed = appendReadingStatsSample(second, 'book-1', {
  date: '2026-06-27',
  progress: 45,
  previousProgress: 45,
  pageCount: 200,
  minutesRead: 1,
  chapterTitle: '第十九章',
  updatedAt: '2026-06-27T10:02:00.000Z',
});

assert.deepEqual(timed.days.map((day) => [day.date, day.pagesRead, day.minutesRead, day.progressStart, day.progressEnd, day.sessions, day.lastChapterTitle]), [
  ['2026-06-27', 20, 28, 35, 45, 2, '第十九章'],
]);

const pageDelta = appendReadingStatsSample(second, 'book-1', {
  date: '2026-06-27',
  progress: 45,
  previousProgress: 45,
  pageCount: 200,
  pageCurrent: 92,
  previousPageCurrent: 90,
  minutesRead: 0,
  chapterTitle: '第十九章',
  updatedAt: '2026-06-27T10:03:00.000Z',
});

assert.deepEqual(pageDelta.days.map((day) => [day.date, day.pagesRead, day.minutesRead, day.progressStart, day.progressEnd, day.sessions, day.lastChapterTitle]), [
  ['2026-06-27', 22, 27, 35, 45, 3, '第十九章'],
]);

const normalized = normalizeReadingStatsRecord({
  bookId: 'book-1',
  days: [{ date: 'bad', pagesRead: -5, minutesRead: 2.2, progressStart: -1, progressEnd: 101, sessions: 0, updatedAt: '' }],
}, 'book-1');

assert.equal(normalized.days[0].pagesRead, 0);
assert.equal(normalized.days[0].minutesRead, 2);
assert.equal(normalized.days[0].progressStart, 0);
assert.equal(normalized.days[0].progressEnd, 100);
assert.equal(normalized.days[0].sessions, 1);

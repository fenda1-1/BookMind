import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-overview-dashboard-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/overview/overviewDashboardModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildOverviewDashboardModel, resolveStartupOverviewMode } = require(join(outDir, 'features/overview/overviewDashboardModel.js'));

const text = {
  booksLabel: '书库',
  booksLoadedHint: '已载入',
  waitingImportHint: '等待导入',
  progressLabel: '进度',
  resumeHint: '继续阅读',
  highlightsLabel: '标注',
  highlightsHint: '已沉淀',
  cardsLabel: '卡片',
  cardsHint: '可复习',
};

assert.equal(resolveStartupOverviewMode('auto', [book('a', 'A', 10, '2026-01-01')]), 'recent');
assert.equal(resolveStartupOverviewMode('recent', []), 'emptyGuide');

const model = buildOverviewDashboardModel({
  book: book('active', '当前书', 35, '2026-01-03'),
  books: [
    book('old', '旧书', 10, '2026-01-01'),
    book('new', '新书', 80, '2026-01-04'),
    { ...book('deleted', '回收站', 5, '2026-01-05'), deleted: true },
  ],
  startupOverviewMode: 'auto',
  text,
});

assert.equal(model.visibleBooks.length, 2);
assert.deepEqual(model.recentBooks.map((item) => item.id), ['new', 'old']);
assert.equal(model.metrics.find((item) => item.id === 'books').value, '2');
assert.equal(model.activeBookStatus, '35% · ready');

const recentReadingModel = buildOverviewDashboardModel({
  book: book('active', '当前书', 35, '2026-01-03'),
  books: [
    book('imported-newer', '导入较新但未读', 0, '2026-07-01'),
    book('read-latest', '最近打开', 55, '2026-01-01'),
    book('read-earlier', '较早打开', 30, '2026-06-01'),
  ],
  startupOverviewMode: 'auto',
  readingStats: [
    { bookId: 'read-earlier', days: [{ date: '2026-06-20', minutesRead: 5, pagesRead: 3, progressStart: 20, progressEnd: 30, sessions: 1, updatedAt: '2026-06-20T08:00:00.000Z' }] },
    { bookId: 'read-latest', days: [{ date: '2026-06-30', minutesRead: 8, pagesRead: 5, progressStart: 50, progressEnd: 55, sessions: 1, updatedAt: '2026-06-30T21:00:00.000Z' }] },
  ],
  text,
});

assert.deepEqual(
  recentReadingModel.recentBooks.map((item) => item.id),
  ['read-latest', 'read-earlier', 'imported-newer'],
  'recent reading should sort by latest reading/open stats before import time',
);

const recentOpenedModel = buildOverviewDashboardModel({
  book: book('active', '当前书', 35, '2026-01-03'),
  books: [
    { ...book('opened-latest', '最近打开', 10, '2026-01-01'), lastOpenedAt: '2026-07-02T20:00:00.000Z' },
    { ...book('opened-earlier', '较早打开', 20, '2026-07-03'), lastOpenedAt: '2026-07-01T20:00:00.000Z' },
    book('never-opened', '未打开', 30, '2026-07-04'),
  ],
  startupOverviewMode: 'auto',
  text,
});

assert.deepEqual(
  recentOpenedModel.recentBooks.map((item) => item.id),
  ['opened-latest', 'opened-earlier', 'never-opened'],
  'recent reading should prefer persisted lastOpenedAt over import time',
);

const commandCenterModel = buildOverviewDashboardModel({
  book: book('active', '当前书', 42, '2026-06-01'),
  books: [
    book('active', '当前书', 42, '2026-06-01'),
    book('side', '副本', 18, '2026-06-02'),
  ],
  startupOverviewMode: 'auto',
  today: '2026-06-27',
  selectedDate: '2026-06-26',
  readingStats: [
    {
      bookId: 'active',
      days: [
        { date: '2026-06-26', minutesRead: 46, pagesRead: 18, progressStart: 35, progressEnd: 42, sessions: 2, lastChapterTitle: '第十八章' },
        { date: '2026-06-27', minutesRead: 12, pagesRead: 4, progressStart: 42, progressEnd: 44, sessions: 1, lastChapterTitle: '第十九章' },
      ],
    },
    {
      bookId: 'side',
      days: [
        { date: '2026-06-26', minutesRead: 31, pagesRead: 7, progressStart: 17, progressEnd: 18, sessions: 1, lastChapterTitle: '插曲' },
      ],
    },
  ],
  readerHighlights: [
    { bookId: 'active', createdAt: '2026-06-26T10:00:00.000Z' },
    { bookId: 'side', createdAt: '2026-06-26T11:00:00.000Z' },
    { bookId: 'active', createdAt: '2026-06-27T09:00:00.000Z' },
  ],
  notes: [
    { readerLocation: { bookId: 'active' }, createdAt: '2026-06-26T10:30:00.000Z' },
    { readerLocation: { bookId: 'side' }, createdAt: '2026-06-27T10:30:00.000Z' },
  ],
  text,
});

assert.equal(commandCenterModel.todaySummary.minutesRead, 12);
assert.equal(commandCenterModel.todaySummary.pagesRead, 4);
assert.equal(commandCenterModel.currentReading.progress, 42);
assert.equal(commandCenterModel.currentReading.todayPagesRead, 4);
assert.equal(commandCenterModel.selectedDay.date, '2026-06-26');
assert.equal(commandCenterModel.selectedDay.minutesRead, 77);
assert.equal(commandCenterModel.selectedDay.pagesRead, 25);
assert.deepEqual(commandCenterModel.selectedDay.books.map((item) => `${item.title}:${item.pagesRead}:${item.progressStart}->${item.progressEnd}`), ['当前书:18:35->42', '副本:7:17->18']);
assert.equal(commandCenterModel.selectedDay.highlightsAdded, 2);
assert.equal(commandCenterModel.selectedDay.notesAdded, 1);
assert.equal(commandCenterModel.monthCalendar.days.some((day) => day.date === '2026-06-26' && day.pagesRead === 25 && day.level === 'high'), true);
assert.equal(commandCenterModel.metrics.find((item) => item.id === 'highlights').value, '3');
assert.equal(commandCenterModel.metrics.find((item) => item.id === 'cards').value, '2');

const independentMonthModel = buildOverviewDashboardModel({
  book: book('active', '当前书', 42, '2026-06-01'),
  books: [book('active', '当前书', 42, '2026-06-01')],
  startupOverviewMode: 'auto',
  today: '2026-06-27',
  selectedDate: '2026-06-26',
  calendarMonth: '2026-05',
  readingStats: [
    {
      bookId: 'active',
      days: [
        { date: '2026-05-08', minutesRead: 20, pagesRead: 6, progressStart: 20, progressEnd: 24, sessions: 1, lastChapterTitle: '五月章节' },
        { date: '2026-06-26', minutesRead: 46, pagesRead: 18, progressStart: 35, progressEnd: 42, sessions: 2, lastChapterTitle: '六月章节' },
      ],
    },
  ],
  text,
});

assert.equal(independentMonthModel.monthCalendar.monthLabel, '2026-05');
assert.equal(independentMonthModel.monthCalendar.days.some((day) => day.date === '2026-05-08' && day.pagesRead === 6), true);
assert.equal(independentMonthModel.selectedDay.date, '2026-06-26');

const privateModel = buildOverviewDashboardModel({
  book: book('active', '当前书', 35, '2026-01-03'),
  books: [book('new', '新书', 80, '2026-01-04')],
  startupOverviewMode: 'recent',
  privacySettings: {
    privacyModeEnabled: true,
    hideRecentReadingInPrivacyMode: true,
    hideBookTitlesInPrivacyMode: true,
  },
  text,
});

assert.equal(privateModel.resolvedMode, 'welcome');
assert.equal(privateModel.recentBooks.length, 0);
assert.notEqual(privateModel.displayCurrentTitle, '当前书');

function book(id, title, progress, importedAt) {
  return {
    id,
    title,
    displayTitle: title,
    fileName: `${title}.txt`,
    importedAt,
    progress,
    status: 'ready',
    deleted: false,
    coverTone: 'amber',
    coverLabel: title.slice(0, 1),
  };
}

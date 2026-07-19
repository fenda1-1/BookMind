import type { ExtendedSettings } from '../../services/settingsCenter/schema';
import type { Book } from '../../types';

export type OverviewDashboardBook = {
  id: string;
  title: string;
  progress: number;
  status: string;
  coverTone: string;
  coverLabel: string;
};

export type OverviewDashboardMetric = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: 'indigo' | 'sage' | 'amber' | 'cinnabar';
};

export type OverviewReadingStatsDay = {
  date: string;
  minutesRead: number;
  pagesRead: number;
  progressStart: number;
  progressEnd: number;
  sessions: number;
  lastChapterTitle?: string;
  updatedAt?: string;
};

export type OverviewReadingStatsRecord = {
  bookId: string;
  days: OverviewReadingStatsDay[];
};

export type OverviewCalendarDay = {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
  minutesRead: number;
  pagesRead: number;
  level: 'none' | 'low' | 'mid' | 'high';
};

export type OverviewSelectedDayBook = {
  bookId: string;
  title: string;
  minutesRead: number;
  pagesRead: number;
  progressStart: number;
  progressEnd: number;
  sessions: number;
  lastChapterTitle: string;
};

export type OverviewDaySummary = {
  date: string;
  minutesRead: number;
  pagesRead: number;
  sessions: number;
  highlightsAdded: number;
  notesAdded: number;
  books: OverviewSelectedDayBook[];
};

export type OverviewMonthCalendar = {
  monthLabel: string;
  days: OverviewCalendarDay[];
};

export type OverviewCurrentReading = {
  title: string;
  progress: number;
  todayPagesRead: number;
  todayMinutesRead: number;
  lastChapterTitle: string;
};

export type OverviewDashboardModel = {
  visibleBooks: Book[];
  recentBooks: OverviewDashboardBook[];
  resolvedMode: ExtendedSettings['startupOverviewMode'];
  displayCurrentTitle?: string;
  privacyHidesRecentReading: boolean;
  hideBookTitles: boolean;
  activeBookStatus: string;
  metrics: OverviewDashboardMetric[];
  readingStreakBars: number[];
  currentReading: OverviewCurrentReading;
  todaySummary: OverviewDaySummary;
  selectedDay: OverviewDaySummary;
  monthCalendar: OverviewMonthCalendar;
};

type OverviewDashboardText = {
  booksLabel: string;
  booksLoadedHint: string;
  waitingImportHint: string;
  progressLabel: string;
  resumeHint: string;
  highlightsLabel: string;
  highlightsHint: string;
  cardsLabel: string;
  cardsHint: string;
};

export function buildOverviewDashboardModel(options: {
  book: Book | null;
  books: Book[];
  privacySettings?: ExtendedSettings;
  startupOverviewMode: ExtendedSettings['startupOverviewMode'];
  today?: string;
  selectedDate?: string;
  calendarMonth?: string;
  readingStats?: OverviewReadingStatsRecord[];
  readerHighlights?: Array<{ bookId?: string; createdAt?: string }>;
  notes?: Array<{ readerLocation?: { bookId?: string }; createdAt?: string }>;
  text: OverviewDashboardText;
}): OverviewDashboardModel {
  const { book, privacySettings, startupOverviewMode, text } = options;
  const visibleBooks = options.books.filter((item) => !item.deleted);
  const today = normalizeDateKey(options.today) ?? toDateKey(new Date());
  const selectedDate = normalizeDateKey(options.selectedDate) ?? today;
  const calendarMonth = normalizeMonthKey(options.calendarMonth) ?? selectedDate.slice(0, 7);
  const privacyHidesRecentReading = privacySettings ? shouldHideRecentReading(privacySettings) : false;
  const hideBookTitles = privacySettings ? shouldHideBookTitles(privacySettings) : false;
  const recentBooks = privacyHidesRecentReading
    ? []
    : [...visibleBooks]
      .sort((a, b) => compareRecentReadingBooks(a, b, options.readingStats ?? []))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: privacySettings ? getPrivacyBookTitle(item.displayTitle, privacySettings) : item.displayTitle,
        progress: item.progress,
        status: hideBookTitles ? '状态已隐藏' : item.status,
        coverTone: item.coverTone,
        coverLabel: item.coverLabel,
      }));
  const resolvedMode = resolveStartupOverviewMode(privacyHidesRecentReading && startupOverviewMode === 'recent' ? 'welcome' : startupOverviewMode, visibleBooks);
  const displayCurrentTitle = book && privacySettings ? getPrivacyBookTitle(book.title, privacySettings) : book?.title;
  const todaySummary = buildOverviewDaySummary(today, visibleBooks, options.readingStats ?? [], options.readerHighlights ?? [], options.notes ?? [], privacySettings);
  const selectedDay = buildOverviewDaySummary(selectedDate, visibleBooks, options.readingStats ?? [], options.readerHighlights ?? [], options.notes ?? [], privacySettings);
  const currentReading = buildOverviewCurrentReading(book, todaySummary, options.readingStats ?? [], privacySettings);
  const monthCalendar = buildOverviewMonthCalendar(calendarMonth, selectedDate, today, options.readingStats ?? []);
  const readerHighlightCount = options.readerHighlights?.length ?? 0;
  const noteCount = options.notes?.length ?? 0;
  return {
    visibleBooks,
    recentBooks,
    resolvedMode,
    displayCurrentTitle,
    privacyHidesRecentReading,
    hideBookTitles,
    activeBookStatus: book ? `${book.progress ?? 0}% · ${hideBookTitles ? '状态已隐藏' : book.status}` : '等待选择书籍',
    metrics: [
      { id: 'books', label: text.booksLabel, value: String(visibleBooks.length), hint: visibleBooks.length ? text.booksLoadedHint : text.waitingImportHint, tone: 'indigo' },
      { id: 'progress', label: text.progressLabel, value: `${book?.progress ?? 0}%`, hint: text.resumeHint, tone: 'sage' },
      { id: 'highlights', label: text.highlightsLabel, value: String(readerHighlightCount), hint: text.highlightsHint, tone: 'amber' },
      { id: 'cards', label: text.cardsLabel, value: String(noteCount), hint: text.cardsHint, tone: 'cinnabar' },
    ],
    readingStreakBars: buildReadingStreakBars(today, options.readingStats ?? []),
    currentReading,
    todaySummary,
    selectedDay,
    monthCalendar,
  };
}

function compareRecentReadingBooks(left: Book, right: Book, readingStats: OverviewReadingStatsRecord[]) {
  const leftReadAt = toTimestamp(left.lastOpenedAt) || getLatestReadingTimestamp(left.id, readingStats);
  const rightReadAt = toTimestamp(right.lastOpenedAt) || getLatestReadingTimestamp(right.id, readingStats);
  if (leftReadAt > 0 || rightReadAt > 0) return rightReadAt - leftReadAt || compareImportedAt(left, right);
  return compareImportedAt(left, right);
}

function compareImportedAt(left: Book, right: Book) {
  return toTimestamp(right.importedAt) - toTimestamp(left.importedAt);
}

function getLatestReadingTimestamp(bookId: string, readingStats: OverviewReadingStatsRecord[]) {
  const record = readingStats.find((item) => item.bookId === bookId);
  if (!record) return 0;
  return record.days.reduce((latest, day) => Math.max(latest, toTimestamp(day.updatedAt || day.date)), 0);
}

export function resolveStartupOverviewMode(mode: ExtendedSettings['startupOverviewMode'], books: Book[]) {
  if (mode === 'auto') return books.length ? 'recent' : 'emptyGuide';
  if (mode === 'recent' && books.length === 0) return 'emptyGuide';
  return mode;
}

function shouldHideRecentReading(settings: ExtendedSettings) {
  return settings.applicationPrivacyMode || settings.hideRecentReadingInPrivacyMode || !settings.recordRecentReaderBooks;
}

function shouldHideBookTitles(settings: ExtendedSettings) {
  return settings.applicationPrivacyMode || settings.hideBookTitlesInPrivacyMode;
}

function getPrivacyBookTitle(title: string, settings: ExtendedSettings) {
  return shouldHideBookTitles(settings) ? '私密书籍' : title;
}

function buildOverviewCurrentReading(book: Book | null, todaySummary: OverviewDaySummary, readingStats: OverviewReadingStatsRecord[], privacySettings?: ExtendedSettings): OverviewCurrentReading {
  const bookToday = book ? todaySummary.books.find((item) => item.bookId === book.id) : null;
  const latestDay = book ? findLatestStatsDay(book.id, readingStats) : null;
  return {
    title: book ? (privacySettings ? getPrivacyBookTitle(book.displayTitle || book.title, privacySettings) : book.displayTitle || book.title) : '尚未选择书籍',
    progress: book?.progress ?? 0,
    todayPagesRead: bookToday?.pagesRead ?? 0,
    todayMinutesRead: bookToday?.minutesRead ?? 0,
    lastChapterTitle: bookToday?.lastChapterTitle || latestDay?.lastChapterTitle || '',
  };
}

function buildOverviewDaySummary(
  date: string,
  books: Book[],
  readingStats: OverviewReadingStatsRecord[],
  readerHighlights: Array<{ bookId?: string; createdAt?: string }>,
  notes: Array<{ readerLocation?: { bookId?: string }; createdAt?: string }>,
  privacySettings?: ExtendedSettings,
): OverviewDaySummary {
  const bookMap = new Map(books.map((book) => [book.id, book]));
  const dayBooks = readingStats.flatMap((record) => {
    const book = bookMap.get(record.bookId);
    if (!book) return [];
    const day = record.days.find((item) => normalizeDateKey(item.date) === date);
    if (!day) return [];
    return [{
      bookId: record.bookId,
      title: privacySettings ? getPrivacyBookTitle(book.displayTitle || book.title, privacySettings) : book.displayTitle || book.title,
      minutesRead: safeNonNegative(day.minutesRead),
      pagesRead: safeNonNegative(day.pagesRead),
      progressStart: clampPercent(day.progressStart),
      progressEnd: clampPercent(day.progressEnd),
      sessions: safeNonNegative(day.sessions),
      lastChapterTitle: day.lastChapterTitle ?? '',
    }];
  }).sort((a, b) => b.pagesRead - a.pagesRead || b.minutesRead - a.minutesRead || a.title.localeCompare(b.title));
  return {
    date,
    minutesRead: dayBooks.reduce((sum, item) => sum + item.minutesRead, 0),
    pagesRead: dayBooks.reduce((sum, item) => sum + item.pagesRead, 0),
    sessions: dayBooks.reduce((sum, item) => sum + item.sessions, 0),
    highlightsAdded: readerHighlights.filter((item) => normalizeDateKey(item.createdAt) === date).length,
    notesAdded: notes.filter((item) => normalizeDateKey(item.createdAt) === date).length,
    books: dayBooks,
  };
}

function buildOverviewMonthCalendar(calendarMonth: string, selectedDate: string, today: string, readingStats: OverviewReadingStatsRecord[]): OverviewMonthCalendar {
  const monthStart = parseDateKey(`${calendarMonth}-01`) ?? new Date();
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);
    const pagesRead = sumPagesForDate(dateKey, readingStats);
    const minutesRead = sumMinutesForDate(dateKey, readingStats);
    return {
      date: dateKey,
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: dateKey === today,
      selected: dateKey === selectedDate,
      minutesRead,
      pagesRead,
      level: pagesRead >= 20 || minutesRead >= 60 ? 'high' : pagesRead >= 8 || minutesRead >= 25 ? 'mid' : pagesRead > 0 || minutesRead > 0 ? 'low' : 'none',
    } satisfies OverviewCalendarDay;
  });
  return {
    monthLabel: `${year}-${String(month + 1).padStart(2, '0')}`,
    days,
  };
}

function buildReadingStreakBars(today: string, readingStats: OverviewReadingStatsRecord[]) {
  const end = parseDateKey(today) ?? new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (6 - index));
    const dateKey = toDateKey(date);
    const pages = sumPagesForDate(dateKey, readingStats);
    const minutes = sumMinutesForDate(dateKey, readingStats);
    return Math.min(100, Math.max(8, pages * 3 + minutes));
  });
}

function findLatestStatsDay(bookId: string, readingStats: OverviewReadingStatsRecord[]) {
  return readingStats
    .find((record) => record.bookId === bookId)
    ?.days
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null;
}

function sumPagesForDate(date: string, readingStats: OverviewReadingStatsRecord[]) {
  return readingStats.reduce((sum, record) => sum + (record.days.find((day) => normalizeDateKey(day.date) === date)?.pagesRead ?? 0), 0);
}

function sumMinutesForDate(date: string, readingStats: OverviewReadingStatsRecord[]) {
  return readingStats.reduce((sum, record) => sum + (record.days.find((day) => normalizeDateKey(day.date) === date)?.minutesRead ?? 0), 0);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function safeNonNegative(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function normalizeDateKey(value: string | undefined) {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

function normalizeMonthKey(value: string | undefined) {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}/)?.[0];
  if (!direct) return null;
  return parseDateKey(`${direct}-01`) ? direct : null;
}

function toTimestamp(value: string | undefined) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function parseDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

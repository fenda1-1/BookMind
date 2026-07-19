export type ReadingStatsDay = {
  date: string;
  minutesRead: number;
  pagesRead: number;
  progressStart: number;
  progressEnd: number;
  sessions: number;
  lastChapterTitle?: string;
  updatedAt: string;
};

export type ReadingStatsRecord = {
  bookId: string;
  days: ReadingStatsDay[];
};

export type ReadingStatsSample = {
  date: string;
  progress: number;
  previousProgress?: number;
  pageCount?: number;
  pageCurrent?: number;
  previousPageCurrent?: number;
  minutesRead?: number;
  chapterTitle?: string;
  updatedAt: string;
};

export function appendReadingStatsSample(record: ReadingStatsRecord | null, bookId: string, sample: ReadingStatsSample): ReadingStatsRecord {
  const current = normalizeReadingStatsRecord(record, bookId);
  const date = normalizeDateKey(sample.date) ?? normalizeDateKey(sample.updatedAt) ?? toDateKey(new Date());
  const progressEnd = clampPercent(sample.progress);
  const progressStart = clampPercent(sample.previousProgress ?? progressEnd);
  const estimatedPagesRead = estimatePagesRead(progressStart, progressEnd, sample);
  const minutesRead = safeNonNegative(sample.minutesRead ?? 0);
  const sessionIncrement = estimatedPagesRead > 0 ? 1 : 0;
  if (estimatedPagesRead <= 0 && minutesRead <= 0) return current;
  const existing = current.days.find((day) => day.date === date);
  if (!existing) {
    return {
      bookId,
      days: sortReadingStatsDays([
        ...current.days,
        {
          date,
          minutesRead,
          pagesRead: estimatedPagesRead,
          progressStart,
          progressEnd,
          sessions: Math.max(1, sessionIncrement),
          lastChapterTitle: sample.chapterTitle ?? '',
          updatedAt: sample.updatedAt,
        },
      ]),
    };
  }
  return {
    bookId,
    days: sortReadingStatsDays(current.days.map((day) => {
      if (day.date !== date) return day;
      return {
        ...day,
        minutesRead: day.minutesRead + minutesRead,
        pagesRead: day.pagesRead + estimatedPagesRead,
        progressStart: Math.min(day.progressStart, progressStart),
        progressEnd: Math.max(day.progressEnd, progressEnd),
        sessions: day.sessions + sessionIncrement,
        lastChapterTitle: sample.chapterTitle || day.lastChapterTitle,
        updatedAt: sample.updatedAt,
      };
    })),
  };
}

export function normalizeReadingStatsRecord(record: ReadingStatsRecord | null | undefined, bookId: string): ReadingStatsRecord {
  return {
    bookId,
    days: sortReadingStatsDays((record?.days ?? []).map((day) => ({
      date: normalizeDateKey(day.date) ?? toDateKey(new Date()),
      minutesRead: safeNonNegative(day.minutesRead),
      pagesRead: safeNonNegative(day.pagesRead),
      progressStart: clampPercent(day.progressStart),
      progressEnd: clampPercent(day.progressEnd),
      sessions: Math.max(1, safeNonNegative(day.sessions)),
      lastChapterTitle: day.lastChapterTitle ?? '',
      updatedAt: day.updatedAt || new Date().toISOString(),
    }))),
  };
}

function estimatePagesRead(progressStart: number, progressEnd: number, sample: Pick<ReadingStatsSample, 'pageCount' | 'pageCurrent' | 'previousPageCurrent'>) {
  const pageDelta = safePageDelta(sample.previousPageCurrent, sample.pageCurrent, sample.pageCount);
  if (pageDelta !== null) return pageDelta;
  const safePageCount = Math.max(1, safeNonNegative(sample.pageCount ?? 100));
  return Math.max(0, Math.round(((progressEnd - progressStart) / 100) * safePageCount));
}

function safePageDelta(previousPageCurrent: number | undefined, pageCurrent: number | undefined, pageCount: number | undefined) {
  if (!Number.isFinite(previousPageCurrent) || !Number.isFinite(pageCurrent)) return null;
  const total = Math.max(1, safeNonNegative(pageCount ?? 1));
  const previous = Math.min(total, Math.max(1, safeNonNegative(previousPageCurrent!)));
  const current = Math.min(total, Math.max(1, safeNonNegative(pageCurrent!)));
  return Math.max(0, current - previous);
}

function sortReadingStatsDays(days: ReadingStatsDay[]) {
  return days.slice().sort((a, b) => a.date.localeCompare(b.date));
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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

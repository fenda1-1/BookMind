import { useEffect, useState } from 'react';
import { ThemedSelect } from '../components/ThemedSelect';
import { useI18n } from '../i18n';
import { buildOverviewDashboardModel, type OverviewDashboardMetric } from '../features/overview/overviewDashboardModel';
import { loadOverviewReaderHighlights, loadOverviewReadingStats, subscribeReadingStatsUpdated } from '../features/overview/readingStatsService';
import { loadHighlights, loadNotes } from '../services/noteService';
import { subscribeHighlightsUpdated, subscribeNotesUpdated } from '../services/appDomainEvents';
import type { ExtendedSettings } from '../services/settingsCenterService';
import type { Book, HighlightRecord, NoteRecord } from '../types';
import type { ReaderHighlightRange } from '../features/reader-core/readerModel';

type OverviewPageProps = {
  book: Book | null;
  books?: Book[];
  privacySettings?: ExtendedSettings;
  startupOverviewMode?: ExtendedSettings['startupOverviewMode'];
  hideReaderEntry?: boolean;
  onOpenReader: () => void;
  onOpenBook?: (bookId: string) => void;
  onImportBook?: () => void;
};

export function OverviewPage({ book, books = [], privacySettings, startupOverviewMode = 'auto', hideReaderEntry = false, onOpenReader, onOpenBook, onImportBook }: OverviewPageProps) {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(new Date()));
  const [readingStats, setReadingStats] = useState<Awaited<ReturnType<typeof loadOverviewReadingStats>>>([]);
  const [readerHighlights, setReaderHighlights] = useState<Array<ReaderHighlightRange & { bookId?: string }>>([]);
  const [knowledgeHighlights, setKnowledgeHighlights] = useState<HighlightRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function refreshOverviewData() {
      const [nextStats, nextReaderHighlights, nextKnowledgeHighlights, nextNotes] = await Promise.all([
        loadOverviewReadingStats(),
        loadOverviewReaderHighlights(),
        loadHighlights(),
        loadNotes(),
      ]);
      if (cancelled) return;
      setReadingStats(nextStats);
      setReaderHighlights(nextReaderHighlights);
      setKnowledgeHighlights(nextKnowledgeHighlights);
      setNotes(nextNotes);
    }
    void refreshOverviewData();
    const unsubscribeReadingStatsUpdated = subscribeReadingStatsUpdated(refreshOverviewData);
    const unsubscribeHighlights = subscribeHighlightsUpdated(refreshOverviewData);
    const unsubscribeNotes = subscribeNotesUpdated(refreshOverviewData);
    return () => {
      cancelled = true;
      unsubscribeReadingStatsUpdated();
      unsubscribeHighlights();
      unsubscribeNotes();
    };
  }, []);

  const dashboard = buildOverviewDashboardModel({
    book,
    books,
    privacySettings,
    startupOverviewMode,
    selectedDate,
    calendarMonth,
    readingStats,
    readerHighlights: [
      ...readerHighlights.map((highlight) => ({ bookId: highlight.bookId, createdAt: highlight.createdAt })),
      ...knowledgeHighlights.map((highlight) => ({ createdAt: highlight.createdAt })),
    ],
    notes,
    text: {
      booksLabel: t('overview.metric.books'),
      booksLoadedHint: t('overview.metric.booksLoaded'),
      waitingImportHint: t('overview.metric.waitingImport'),
      progressLabel: t('overview.metric.progress'),
      resumeHint: t('overview.metric.resume'),
      highlightsLabel: t('overview.metric.highlights'),
      highlightsHint: t('overview.metric.highlightsHint'),
      cardsLabel: t('overview.metric.cards'),
      cardsHint: t('overview.metric.cardsHint'),
    },
  });
  const { resolvedMode, displayCurrentTitle, recentBooks, visibleBooks } = dashboard;
  const calendarYears = buildCalendarYearOptions(readingStats, calendarMonth);
  const calendarYear = calendarMonth.slice(0, 4);
  const calendarMonthValue = calendarMonth.slice(5, 7);
  function updateCalendarMonth(year: string, month: string) {
    setCalendarMonth(`${year}-${month}`);
  }
  function shiftCalendarMonth(delta: number) {
    const next = shiftMonth(calendarMonth, delta);
    setCalendarMonth(next);
  }
  function selectCalendarDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
  }
  function jumpCalendarToday() {
    const today = toDateKey(new Date());
    setSelectedDate(today);
    setCalendarMonth(today.slice(0, 7));
  }
  return (
    <section className="page-surface overview-page">
      <div className={`hero-card overview-hero startup-overview-${resolvedMode}`}>
        <div className="overview-hero-main">
          <p className="eyebrow">{t('overview.eyebrow')}</p>
          <h2>{resolvedMode === 'emptyGuide' ? '开始建立你的本地书库' : resolvedMode === 'recent' ? '最近阅读工作台' : t('overview.title')}</h2>
          <p>{resolvedMode === 'emptyGuide' ? '导入 TXT 或本地书籍后，BookMind 会提供阅读、章节解析、全文索引和 AI 引用。' : book ? t('overview.withBook', { title: displayCurrentTitle ?? '' }) : t('overview.empty')}</p>
          <div className="overview-actions">
            {resolvedMode === 'emptyGuide' || !hideReaderEntry ? <button className="primary-btn" onClick={resolvedMode === 'emptyGuide' ? onImportBook : onOpenReader}>{resolvedMode === 'emptyGuide' ? '导入书籍' : book ? t('overview.continue') : t('overview.openReader')}</button> : null}
            {resolvedMode !== 'emptyGuide' ? <button className="ghost-btn" type="button" onClick={onImportBook}>导入新书</button> : null}
          </div>
        </div>
        {!hideReaderEntry ? <div className="overview-hero-side" aria-label="当前阅读状态">
          <span>当前阅读</span>
          <strong>{displayCurrentTitle || '尚未选择书籍'}</strong>
          <em>{dashboard.activeBookStatus}</em>
          <div className="overview-mini-progress"><i style={{ width: `${book?.progress ?? 0}%` }} /></div>
        </div> : null}
      </div>
      {resolvedMode === 'emptyGuide' ? (
        <div className="overview-empty-guide">
          <div><strong>1</strong><span>导入本地书籍</span><em>选择 TXT 或目录</em></div>
          <div><strong>2</strong><span>解析章节和索引</span><em>后台建立检索基础</em></div>
          <div><strong>3</strong><span>开始阅读与标注</span><em>沉淀高亮和卡片</em></div>
        </div>
      ) : null}
      {resolvedMode === 'recent' && recentBooks.length ? (
        <div className="overview-recent-strip" aria-label="最近阅读">
          <header><span>最近阅读</span><em>{recentBooks.length} 本</em></header>
          <div className="overview-recent-list">
            {recentBooks.map((item) => (
              <button type="button" key={item.id} onClick={() => onOpenBook?.(item.id)}>
                <span className={`mini-cover ${item.coverTone}`}>{item.coverLabel}</span>
                <span><strong>{item.title}</strong><em>{item.progress}% · {item.status}</em></span>
                <i style={{ width: `${item.progress}%` }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="metric-grid overview-metric-grid">
        {dashboard.metrics.map((metric) => <Metric key={metric.id} metric={metric} />)}
      </div>
      <div className="overview-command-grid">
        {!hideReaderEntry ? <article className="panel-card overview-live-card">
          <p className="eyebrow">实时阅读</p>
          <h3>{dashboard.currentReading.title}</h3>
          <strong>{dashboard.currentReading.progress}%</strong>
          <p>今天 +{dashboard.currentReading.todayPagesRead} 页 · {formatMinutes(dashboard.currentReading.todayMinutesRead)}{dashboard.currentReading.lastChapterTitle ? ` · ${dashboard.currentReading.lastChapterTitle}` : ''}</p>
          <div className="overview-mini-progress"><i style={{ width: `${dashboard.currentReading.progress}%` }} /></div>
        </article> : null}
        <article className="panel-card overview-today-card">
          <p className="eyebrow">今日</p>
          <h3>{formatMinutes(dashboard.todaySummary.minutesRead)}</h3>
          <p>{dashboard.todaySummary.pagesRead} 页 · {dashboard.todaySummary.books.length} 本书 · 高亮 {dashboard.todaySummary.highlightsAdded} · 笔记 {dashboard.todaySummary.notesAdded}</p>
        </article>
        <article className="panel-card overview-calendar-card">
          <div className="overview-calendar-head">
            <div className="section-title"><span>{dashboard.monthCalendar.monthLabel} 阅读月历</span><strong>{dashboard.selectedDay.pagesRead} 页</strong></div>
            <div className="overview-calendar-controls" aria-label="选择阅读日历年月">
              <button type="button" onClick={() => shiftCalendarMonth(-1)} aria-label="上个月">‹</button>
              <ThemedSelect className="overview-calendar-select year-select" menuPlacement="bottom" label="年" ariaLabel="选择年份" value={calendarYear} options={calendarYears.map((year) => ({ value: year, label: `${year}年` }))} onChange={(year) => updateCalendarMonth(year, calendarMonthValue)} />
              <ThemedSelect className="overview-calendar-select month-select" menuPlacement="bottom" label="月" ariaLabel="选择月份" value={calendarMonthValue} options={monthOptions.map((month) => ({ value: month, label: `${Number(month)}月` }))} onChange={(month) => updateCalendarMonth(calendarYear, month)} />
              <button type="button" onClick={() => shiftCalendarMonth(1)} aria-label="下个月">›</button>
              <button type="button" onClick={jumpCalendarToday}>今天</button>
            </div>
          </div>
          <div className="overview-calendar-grid">
            {dashboard.monthCalendar.days.map((day) => (
              <button type="button" className={`overview-calendar-day level-${day.level}${day.inMonth ? '' : ' muted'}${day.selected ? ' selected' : ''}${day.isToday ? ' today' : ''}`} key={day.date} onClick={() => selectCalendarDate(day.date)} aria-label={`${day.date} 阅读 ${day.pagesRead} 页 ${day.minutesRead} 分钟`}>
                <span>{day.dayOfMonth}</span>
                {day.pagesRead || day.minutesRead ? <em>{day.pagesRead || day.minutesRead}</em> : null}
              </button>
            ))}
          </div>
        </article>
        <article className="panel-card overview-day-detail-card">
          <div className="section-title"><span>{dashboard.selectedDay.date}</span><strong>{formatMinutes(dashboard.selectedDay.minutesRead)}</strong></div>
          <div className="overview-day-total">
            <div><span>新增页数</span><strong>{dashboard.selectedDay.pagesRead}</strong></div>
            <div><span>阅读会话</span><strong>{dashboard.selectedDay.sessions}</strong></div>
            <div><span>高亮</span><strong>{dashboard.selectedDay.highlightsAdded}</strong></div>
            <div><span>笔记</span><strong>{dashboard.selectedDay.notesAdded}</strong></div>
          </div>
          <div className="overview-day-books">
            {dashboard.selectedDay.books.length ? dashboard.selectedDay.books.map((item) => (
              <button type="button" key={item.bookId} onClick={() => onOpenBook?.(item.bookId)}>
                <span><strong>{item.title}</strong><em>{item.lastChapterTitle || '阅读记录'}</em></span>
                <b>+{item.pagesRead} 页</b>
                <i>{item.progressStart}% → {item.progressEnd}%</i>
              </button>
            )) : <p className="empty-hint">这一天还没有阅读记录。</p>}
          </div>
        </article>
        <article className="panel-card overview-rhythm-card">
          <p className="eyebrow">{t('overview.rhythm.eyebrow')}</p>
          <h3>{t('overview.rhythm.title')}</h3>
          <div className="rhythm-bars">{dashboard.readingStreakBars.map((height, index) => <i key={index} style={{ height: `${height}%` }}><span>{['一', '二', '三', '四', '五', '六', '日'][index]}</span></i>)}</div>
        </article>
        <article className="panel-card overview-status-card">
          <p className="eyebrow">书库状态</p>
          <h3>本地工作流</h3>
          <dl>
            <div><dt>可见书籍</dt><dd>{visibleBooks.length}</dd></div>
            <div><dt>最近阅读</dt><dd>{dashboard.privacyHidesRecentReading ? '已隐藏' : `${recentBooks.length} 本`}</dd></div>
            <div><dt>标题隐私</dt><dd>{dashboard.hideBookTitles ? '开启' : '关闭'}</dd></div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function Metric({ metric }: { metric: OverviewDashboardMetric }) {
  return <article className={`metric-card overview-metric-card tone-${metric.tone}`}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.hint}</p></article>;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map((part) => Number(part));
  const date = new Date(Number.isFinite(year) ? year : new Date().getFullYear(), (Number.isFinite(month) ? month : 1) - 1 + delta, 1);
  return toMonthKey(date);
}

function buildCalendarYearOptions(readingStats: Awaited<ReturnType<typeof loadOverviewReadingStats>>, calendarMonth: string) {
  const years = new Set<string>([calendarMonth.slice(0, 4), String(new Date().getFullYear())]);
  readingStats.forEach((record) => record.days.forEach((day) => {
    const year = day.date?.slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  }));
  return [...years].sort((a, b) => Number(b) - Number(a));
}

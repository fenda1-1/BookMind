export type TaskTimeView = {
  dateTime: string;
  label: string;
  title: string;
};

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

export function formatTaskRelativeTime(value: string, locale = 'zh-CN'): TaskTimeView {
  if (!value) return { dateTime: '', label: '-', title: '' };
  const timestamp = parseTaskTimestamp(value);
  if (!Number.isFinite(timestamp)) return { dateTime: value, label: value, title: value };
  const date = new Date(timestamp);
  const dateTime = date.toISOString();
  const title = formatTaskAbsoluteTime(date, locale);

  const diffMs = timestamp - Date.now();
  const absMs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (absMs < minuteMs) {
    return { dateTime, label: formatter.format(0, 'second'), title };
  }
  if (absMs < hourMs) {
    return { dateTime, label: formatter.format(Math.round(diffMs / minuteMs), 'minute'), title };
  }
  if (absMs < dayMs) {
    return { dateTime, label: formatter.format(Math.round(diffMs / hourMs), 'hour'), title };
  }
  return { dateTime, label: formatter.format(Math.round(diffMs / dayMs), 'day'), title };
}

function parseTaskTimestamp(value: string) {
  const trimmed = value.trim();
  if (/^\d{13}$/.test(trimmed)) return Number(trimmed);
  if (/^\d{10}$/.test(trimmed)) return Number(trimmed) * 1000;
  return Date.parse(trimmed);
}

function formatTaskAbsoluteTime(date: Date, locale: string) {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

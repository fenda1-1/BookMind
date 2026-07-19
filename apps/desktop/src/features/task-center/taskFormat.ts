export function formatTaskNumber(value: number, locale = 'zh-CN') {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatTaskPercent(value: number, locale = 'zh-CN') {
  const normalized = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${formatTaskNumber(normalized, locale)}%`;
}

export function formatTaskSeconds(durationMs: number, locale = 'zh-CN') {
  if (!durationMs) return '-';
  return `${formatTaskNumber(Math.round(durationMs / 1000), locale)}s`;
}

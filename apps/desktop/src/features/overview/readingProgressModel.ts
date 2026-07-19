export function shouldApplyReadingProgressUpdate(currentProgress: number, nextProgress: number) {
  const current = clampPercent(currentProgress);
  const next = clampPercent(nextProgress);
  if (next <= 0) return false;
  if (next >= current) return next > current;
  return current >= 95 && next <= 10;
}

export function shouldRecordReadingStatsSample(input: {
  currentProgress: number;
  nextProgress: number;
  previousPageCurrent?: number;
  pageCurrent?: number;
  minutesRead?: number;
}) {
  const next = clampPercent(input.nextProgress);
  const minutesRead = safeNonNegative(input.minutesRead ?? 0);
  const hasPageAdvance = hasReadingPageAdvance(input.previousPageCurrent, input.pageCurrent);
  return minutesRead > 0 || hasPageAdvance || shouldApplyReadingProgressUpdate(input.currentProgress, next);
}

export function hasReadingPageAdvance(previousPageCurrent: number | undefined, pageCurrent: number | undefined) {
  if (!Number.isFinite(previousPageCurrent) || !Number.isFinite(pageCurrent)) return false;
  return safeNonNegative(pageCurrent!) > safeNonNegative(previousPageCurrent!);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function safeNonNegative(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

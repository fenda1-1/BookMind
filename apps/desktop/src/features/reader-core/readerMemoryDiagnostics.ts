export type BrowserMemorySnapshot = {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
};

export type ReaderMemoryDiagnostics = {
  supported: boolean;
  usedMb: number;
  totalMb: number;
  limitMb: number;
  thresholdMb: number;
  warning: boolean;
  ratio: number;
};

export function buildReaderMemoryDiagnostics(snapshot: BrowserMemorySnapshot | null | undefined, thresholdMb: number): ReaderMemoryDiagnostics {
  const normalizedThresholdMb = clampMemoryThreshold(thresholdMb);
  if (!snapshot || !Number.isFinite(snapshot.usedJSHeapSize) || Number(snapshot.usedJSHeapSize) <= 0) {
    return {
      supported: false,
      usedMb: 0,
      totalMb: 0,
      limitMb: 0,
      thresholdMb: normalizedThresholdMb,
      warning: false,
      ratio: 0,
    };
  }
  const usedMb = bytesToRoundedMb(Number(snapshot.usedJSHeapSize));
  const totalMb = bytesToRoundedMb(Number(snapshot.totalJSHeapSize ?? 0));
  const limitMb = bytesToRoundedMb(Number(snapshot.jsHeapSizeLimit ?? 0));
  return {
    supported: true,
    usedMb,
    totalMb,
    limitMb,
    thresholdMb: normalizedThresholdMb,
    warning: usedMb >= normalizedThresholdMb,
    ratio: limitMb > 0 ? Math.min(1, usedMb / limitMb) : 0,
  };
}

export function getBrowserMemorySnapshot(): BrowserMemorySnapshot | null {
  const memory = (performance as Performance & { memory?: BrowserMemorySnapshot }).memory;
  if (!memory) return null;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };
}

export function clampMemoryThreshold(value: number) {
  if (!Number.isFinite(value)) return 512;
  return Math.round(Math.min(4096, Math.max(64, value)));
}

function bytesToRoundedMb(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.round(bytes / (1024 * 1024));
}

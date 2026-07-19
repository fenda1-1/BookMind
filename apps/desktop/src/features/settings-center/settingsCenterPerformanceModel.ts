export type SettingsPerformanceTuningInput = {
  taskConcurrency: unknown;
  importConcurrency: unknown;
  parseConcurrency: unknown;
  vectorConcurrencyReserved: unknown;
  indexChunkSize: unknown;
  indexChunkOverlap: unknown;
  ftsWriteSerial: boolean;
  largeBookPerformanceMode: boolean;
  virtualChapterRadius: unknown;
  virtualParagraphWindowSize: unknown;
  readerPageCacheLimit: unknown;
  readerPageMeasureCacheLimit: unknown;
  readerPagePreheatRange: unknown;
};

export type SettingsPerformanceTuningProfile = {
  taskConcurrency: number;
  importConcurrency: number;
  parseConcurrency: number;
  vectorConcurrencyReserved: number;
  indexChunkSize: number;
  indexChunkOverlap: number;
  virtualChapterRadius: number;
  virtualParagraphWindowSize: number;
  readerPageCacheLimit: number;
  readerPageMeasureCacheLimit: number;
  readerPagePreheatRange: number;
  indexThroughputLevel: 'aggressive' | 'balanced' | 'conservative';
  readerMemoryLevel: 'high' | 'balanced' | 'low';
  largeBookAdvice: 'enabled' | 'suggested';
};

export function parseSettingsPerformanceInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : fallback;
}

export function buildSettingsPerformanceTuningProfile(input: SettingsPerformanceTuningInput): SettingsPerformanceTuningProfile {
  const taskConcurrency = parseSettingsPerformanceInteger(input.taskConcurrency, 1);
  const importConcurrency = parseSettingsPerformanceInteger(input.importConcurrency, 2);
  const parseConcurrency = parseSettingsPerformanceInteger(input.parseConcurrency, 1);
  const vectorConcurrencyReserved = parseSettingsPerformanceInteger(input.vectorConcurrencyReserved, 1);
  const indexChunkSize = parseSettingsPerformanceInteger(input.indexChunkSize, 1200);
  const indexChunkOverlap = parseSettingsPerformanceInteger(input.indexChunkOverlap, 120);
  const virtualChapterRadius = parseSettingsPerformanceInteger(input.virtualChapterRadius, 3);
  const virtualParagraphWindowSize = parseSettingsPerformanceInteger(input.virtualParagraphWindowSize, 80);
  const readerPageCacheLimit = parseSettingsPerformanceInteger(input.readerPageCacheLimit, 30);
  const readerPageMeasureCacheLimit = parseSettingsPerformanceInteger(input.readerPageMeasureCacheLimit, 48);
  const readerPagePreheatRange = parseSettingsPerformanceInteger(input.readerPagePreheatRange, 1);
  const memoryPressureScore = (input.largeBookPerformanceMode ? -2 : 0)
    + virtualChapterRadius
    + Math.ceil(virtualParagraphWindowSize / 60)
    + Math.ceil(readerPageCacheLimit / 30)
    + Math.ceil(readerPageMeasureCacheLimit / 48)
    + readerPagePreheatRange;
  const indexPressureScore = parseConcurrency
    + Math.max(0, importConcurrency - 1)
    + Math.max(0, taskConcurrency - 1)
    + Math.ceil(indexChunkOverlap / 300)
    + (input.ftsWriteSerial ? 0 : 2)
    - Math.min(2, Math.floor(indexChunkSize / 1800));

  return {
    taskConcurrency,
    importConcurrency,
    parseConcurrency,
    vectorConcurrencyReserved,
    indexChunkSize,
    indexChunkOverlap,
    virtualChapterRadius,
    virtualParagraphWindowSize,
    readerPageCacheLimit,
    readerPageMeasureCacheLimit,
    readerPagePreheatRange,
    indexThroughputLevel: indexPressureScore >= 7 ? 'aggressive' : indexPressureScore >= 4 ? 'balanced' : 'conservative',
    readerMemoryLevel: memoryPressureScore >= 8 ? 'high' : memoryPressureScore >= 5 ? 'balanced' : 'low',
    largeBookAdvice: input.largeBookPerformanceMode ? 'enabled' : 'suggested',
  };
}

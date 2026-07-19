export const readerMediaCacheBudgets = {
  documentEntries: 2,
  documentModelEntries: 2,
  comicChapterEntries: 8,
  comicImageEntries: 48,
  audioEntries: 8,
  pdfPageCanvasEntries: 5,
  pdfPageCanvasPixels: 6_000_000,
  pdfThumbnailCanvasEntries: 8,
  pdfThumbnailCanvasPixels: 750_000,
} as const;

export type BoundedRecordCacheResult<T> = {
  entries: Record<string, T>;
  order: string[];
  evictedKeys: string[];
};

export function putBoundedRecordCache<T>(entries: Record<string, T>, order: string[], key: string, value: T, limit: number): BoundedRecordCacheResult<T> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const nextEntries = { ...entries, [key]: value };
  const nextOrder = [...order.filter((item) => item !== key), key];
  const evictedKeys: string[] = [];
  while (nextOrder.length > safeLimit) {
    const evictedKey = nextOrder.shift();
    if (!evictedKey || evictedKey === key) continue;
    delete nextEntries[evictedKey];
    evictedKeys.push(evictedKey);
  }
  return { entries: nextEntries, order: nextOrder, evictedKeys };
}

export function clampCanvasPixelRatio(width: number, height: number, pixelRatio: number, pixelBudget: number) {
  const safeRatio = Math.max(1, Number.isFinite(pixelRatio) ? pixelRatio : 1);
  const safePixels = Math.max(1, Number.isFinite(width) && Number.isFinite(height) ? width * height : 1);
  const maxRatio = Math.sqrt(Math.max(1, pixelBudget) / safePixels);
  return Math.min(safeRatio, maxRatio);
}

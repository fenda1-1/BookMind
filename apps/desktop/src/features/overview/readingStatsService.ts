import { getReaderRecord, listReaderRecordsByKind, parseReaderRecord, saveReaderRecord } from '../../services/readerStorageService';
import type { ReaderHighlightRange } from '../reader-core/readerModel';
import { appendReadingStatsSample, normalizeReadingStatsRecord, type ReadingStatsRecord, type ReadingStatsSample } from './readingStatsModel';
import { emitBrowserDomainEvent, subscribeBrowserDomainEvent } from '../../services/browserDomainEvents';

export const readingStatsUpdatedEvent = 'bookmind:reading-stats-updated';

export function emitReadingStatsUpdated(bookId: string) {
  emitBrowserDomainEvent(readingStatsUpdatedEvent, { bookId });
}

export function subscribeReadingStatsUpdated(handler: (detail: { bookId: string }) => void) {
  return subscribeBrowserDomainEvent(readingStatsUpdatedEvent, handler);
}

export async function loadOverviewReadingStats(): Promise<ReadingStatsRecord[]> {
  try {
    const records = await listReaderRecordsByKind('readingStats');
    return records.map((record) => normalizeReadingStatsRecord(parseReaderRecord<ReadingStatsRecord | null>(record, null), record.bookId));
  } catch (error) {
    console.warn('Using empty reading stats because reader record loading failed:', error);
    return [];
  }
}

export async function recordOverviewReadingProgress(bookId: string, sample: ReadingStatsSample): Promise<ReadingStatsRecord | null> {
  try {
    const currentRecord = await getReaderRecord(bookId, 'readingStats');
    const currentStats = parseReaderRecord<ReadingStatsRecord | null>(currentRecord, null);
    const nextStats = appendReadingStatsSample(currentStats, bookId, sample);
    await saveReaderRecord(bookId, 'readingStats', nextStats, 'overview-reading-progress');
    emitReadingStatsUpdated(bookId);
    return nextStats;
  } catch (error) {
    console.warn('Failed to record reading stats:', error);
    return null;
  }
}

export async function loadOverviewReaderHighlights(): Promise<Array<ReaderHighlightRange & { bookId?: string }>> {
  try {
    const records = await listReaderRecordsByKind('highlights');
    return records.flatMap((record) => {
      const highlights = parseReaderRecord<ReaderHighlightRange[]>(record, []);
      return highlights.map((highlight) => ({ ...highlight, bookId: record.bookId }));
    });
  } catch (error) {
    console.warn('Using empty reader highlights because reader record loading failed:', error);
    return [];
  }
}

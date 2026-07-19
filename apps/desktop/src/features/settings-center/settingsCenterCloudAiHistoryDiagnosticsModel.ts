import type { CloudAiRequestHistoryEntry } from '../../services/cloudAiHistoryService';

export type CloudAiHistoryDiagnosticsBookInput = {
  bookId: string;
  bookTitle?: string;
  updatedAt: string;
  entries: CloudAiRequestHistoryEntry[];
};

export function buildCloudAiHistoryDiagnosticsPayload(
  books: CloudAiHistoryDiagnosticsBookInput[],
  exportedAt: string
) {
  const entries = books.flatMap((book) => book.entries.map((entry) => ({ ...entry, bookTitle: book.bookTitle })));
  const statusCounts = entries.reduce<Record<CloudAiRequestHistoryEntry['status'], number>>((counts, entry) => {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    return counts;
  }, { succeeded: 0, failed: 0, stopped: 0 });
  const redactedFieldCounts = entries.reduce<Record<string, number>>((counts, entry) => {
    entry.redactedFields.forEach((field) => {
      counts[field] = (counts[field] ?? 0) + 1;
    });
    return counts;
  }, {});
  return {
    schema: 'bookmind.ai.history.diagnostics.v1',
    exportedAt,
    excludedFields: ['apiKey', 'prompt', 'answer', 'scopeText', 'readerContent'],
    summary: {
      bookCount: books.length,
      totalEntries: entries.length,
      statusCounts,
      redactedFieldCounts,
    },
    books: books.map((book) => ({
      bookId: book.bookId,
      bookTitle: book.bookTitle,
      updatedAt: book.updatedAt,
      entryCount: book.entries.length,
      entries: book.entries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        durationMs: entry.durationMs,
        endpointMode: entry.endpointMode,
        model: entry.model,
        scope: entry.scope,
        scopeLabel: entry.scopeLabel,
        selectedCommandId: entry.selectedCommandId,
        retrievalStrategy: entry.retrievalStrategy,
        resultCount: entry.resultCount,
        status: entry.status,
        errorKind: entry.errorKind,
        redactedFields: entry.redactedFields,
      })),
    })),
  };
}

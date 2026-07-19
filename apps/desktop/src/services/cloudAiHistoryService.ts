import { createSensitiveReaderStoragePayload, getReaderRecord, parseReaderRecord, saveReaderRecord } from './readerStorageService';

export type CloudAiRequestHistoryEntry = {
  id: string;
  bookId: string;
  createdAt: string;
  durationMs: number;
  endpointMode: string;
  model: string;
  scope: string;
  scopeLabel?: string;
  selectedCommandId?: string;
  retrievalStrategy?: string;
  resultCount: number;
  status: 'succeeded' | 'failed' | 'stopped';
  errorKind?: string;
  errorMessage?: string;
  redactedFields: ('body' | 'scopeText' | 'userText' | 'apiKey')[];
};

export async function saveCloudAiRequestHistory(entry: CloudAiRequestHistoryEntry, limit = 50): Promise<CloudAiRequestHistoryEntry[]> {
  const safeEntry = sanitizeCloudAiRequestHistoryEntry(entry);
  if (!safeEntry.bookId) return [];
  const safeLimit = Math.min(500, Math.max(0, Math.round(limit)));
  if (safeLimit <= 0) return [];
  const existing = await getReaderRecord(safeEntry.bookId, 'cloudAiRequestHistory');
  const history = parseReaderRecord<CloudAiRequestHistoryEntry[]>(existing, []);
  const next = [safeEntry, ...history.map(sanitizeCloudAiRequestHistoryEntry).filter((item) => item.id !== safeEntry.id)].slice(0, safeLimit);
  await saveReaderRecord(safeEntry.bookId, 'cloudAiRequestHistory', createSensitiveReaderStoragePayload(next, true), 'ai-research-desk');
  return next;
}

function sanitizeCloudAiRequestHistoryEntry(entry: CloudAiRequestHistoryEntry): CloudAiRequestHistoryEntry {
  const safeEntry: CloudAiRequestHistoryEntry = {
    id: String(entry.id ?? ''),
    bookId: String(entry.bookId ?? ''),
    createdAt: String(entry.createdAt ?? ''),
    durationMs: Number.isFinite(entry.durationMs) ? entry.durationMs : 0,
    endpointMode: String(entry.endpointMode ?? ''),
    model: String(entry.model ?? ''),
    scope: String(entry.scope ?? ''),
    scopeLabel: entry.scopeLabel ? String(entry.scopeLabel) : undefined,
    selectedCommandId: entry.selectedCommandId ? String(entry.selectedCommandId) : undefined,
    retrievalStrategy: entry.retrievalStrategy ? String(entry.retrievalStrategy) : undefined,
    resultCount: Number.isFinite(entry.resultCount) ? entry.resultCount : 0,
    status: normalizeCloudAiRequestHistoryStatus(entry.status),
    errorKind: entry.errorKind ? String(entry.errorKind) : undefined,
    errorMessage: entry.errorMessage ? String(entry.errorMessage) : undefined,
    redactedFields: normalizeCloudAiRequestHistoryRedactedFields(entry.redactedFields),
  };
  if (!safeEntry.scopeLabel) delete safeEntry.scopeLabel;
  if (!safeEntry.selectedCommandId) delete safeEntry.selectedCommandId;
  if (!safeEntry.retrievalStrategy) delete safeEntry.retrievalStrategy;
  if (!safeEntry.errorKind) delete safeEntry.errorKind;
  if (!safeEntry.errorMessage) delete safeEntry.errorMessage;
  return safeEntry;
}

function normalizeCloudAiRequestHistoryStatus(status: CloudAiRequestHistoryEntry['status']): CloudAiRequestHistoryEntry['status'] {
  return status === 'failed' || status === 'stopped' ? status : 'succeeded';
}

function normalizeCloudAiRequestHistoryRedactedFields(fields: CloudAiRequestHistoryEntry['redactedFields']): CloudAiRequestHistoryEntry['redactedFields'] {
  const allowed: CloudAiRequestHistoryEntry['redactedFields'] = ['body', 'scopeText', 'userText', 'apiKey'];
  return allowed.filter((field) => Array.isArray(fields) && fields.includes(field));
}

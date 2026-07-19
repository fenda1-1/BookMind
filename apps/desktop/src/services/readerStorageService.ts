import { invoke } from '@tauri-apps/api/core';

export type ReaderRecordKind = 'state' | 'highlights' | 'bookmarks' | 'highlightColor' | 'tocEdits' | 'tocManifest' | 'chapterRulesOverride' | 'pageCache' | 'readingStats' | 'chapterTimeline' | 'cloudAiRequestHistory' | 'cloudAiConsent' | 'aiModePreference' | 'aiConversationHistory';

export type ReaderRecordPayload = {
  bookId: string;
  kind: ReaderRecordKind;
  payload: string;
  schemaVersion: number;
  updatedAt: string;
  sourceWindowId: string;
};

export type OrphanReaderRecordCleanupPayload = {
  removedRecords: number;
  removedBookIds: string[];
  keptLibraryBookCount: number;
};

const READER_RECORD_SCHEMA_VERSION = 1;

type ReaderRecordEnvelope<T> = {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  sourceWindowId: string;
  data: T;
};

type SensitiveReaderStorageEnvelope = {
  encrypted: true;
  algorithm: 'local-envelope-v1';
  payload: string;
  encoding?: 'legacy-browser-base64';
};

export class CorruptReaderRecordError extends Error {
  constructor(public readonly record: ReaderRecordPayload, public readonly reason = 'invalid-json') {
    super(`Corrupt reader ${record.kind} record: ${reason}`);
    this.name = 'CorruptReaderRecordError';
  }
}

export async function getReaderRecord(bookId: string, kind: ReaderRecordKind): Promise<ReaderRecordPayload | null> {
  return await invoke<ReaderRecordPayload | null>('get_reader_record', { bookId, kind });
}

export async function listReaderRecordsByKind(kind: ReaderRecordKind): Promise<ReaderRecordPayload[]> {
  return await invoke<ReaderRecordPayload[]>('list_reader_records_by_kind', { kind });
}

export async function quarantineReaderRecord(record: ReaderRecordPayload, reason: string): Promise<ReaderRecordPayload | null> {
  return await invoke<ReaderRecordPayload | null>('quarantine_reader_record', {
    bookId: record.bookId,
    kind: record.kind,
    reason,
  });
}

export async function saveReaderRecord(bookId: string, kind: ReaderRecordKind, payload: unknown, sourceWindowId = ''): Promise<ReaderRecordPayload> {
  const envelope = createReaderRecordEnvelope(payload, sourceWindowId);
  return await invoke<ReaderRecordPayload>('save_reader_record', {
    request: {
      bookId,
      kind,
      payload: JSON.stringify(envelope),
      schemaVersion: READER_RECORD_SCHEMA_VERSION,
      sourceWindowId,
    },
  });
}

export async function deleteReaderRecord(bookId: string, kind: ReaderRecordKind): Promise<number> {
  return await invoke<number>('delete_reader_record', { bookId, kind });
}

export async function deleteAllReaderRecordsByKind(kind: ReaderRecordKind): Promise<number> {
  return await invoke<number>('delete_reader_records_by_kind', { kind });
}

export async function deleteReaderRecordsByBook(bookId: string): Promise<number> {
  return await invoke<number>('delete_reader_records_by_book', { bookId });
}

export async function cleanupOrphanReaderRecords(): Promise<OrphanReaderRecordCleanupPayload> {
  return await invoke<OrphanReaderRecordCleanupPayload>('cleanup_orphan_reader_records');
}

export function parseReaderRecord<T>(record: ReaderRecordPayload | null, fallback: T): T {
  if (!record) return fallback;
  try {
    return parseReaderRecordEnvelope<T>(JSON.parse(record.payload), record.sourceWindowId);
  } catch (error) {
    if (error instanceof Error && error.message === 'unsupported-schema-version') throw new CorruptReaderRecordError(record, 'unsupported-schema-version');
    if (error instanceof Error && error.message === 'invalid-encrypted-payload') throw new CorruptReaderRecordError(record, 'invalid-encrypted-payload');
    throw new CorruptReaderRecordError(record, 'invalid-json');
  }
}

export function createSensitiveReaderStoragePayload<T>(payload: T, encrypt: boolean): T | SensitiveReaderStorageEnvelope {
  if (!encrypt) return payload;
  return {
    encrypted: true,
    algorithm: 'local-envelope-v1',
    encoding: 'legacy-browser-base64',
    payload: encodeReaderPayload(payload),
  };
}

function createReaderRecordEnvelope<T>(data: T, sourceWindowId: string): ReaderRecordEnvelope<T> {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: READER_RECORD_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceWindowId,
    data,
  };
}

function parseReaderRecordEnvelope<T>(payload: unknown, sourceWindowId: string): T {
  if (payload && typeof payload === 'object' && 'schemaVersion' in payload && 'data' in payload) {
    const envelope = payload as Partial<ReaderRecordEnvelope<T>>;
    if (!Number.isFinite(envelope.schemaVersion) || envelope.schemaVersion! > READER_RECORD_SCHEMA_VERSION) {
      throw new Error('unsupported-schema-version');
    }
    return unwrapSensitiveReaderStoragePayload<T>(envelope.data);
  }
  void sourceWindowId;
  return unwrapSensitiveReaderStoragePayload<T>(payload);
}

function unwrapSensitiveReaderStoragePayload<T>(payload: unknown): T {
  if (isSensitiveReaderStorageEnvelope(payload)) return decodeReaderPayload<T>(payload.payload);
  return payload as T;
}

function isSensitiveReaderStorageEnvelope(payload: unknown): payload is SensitiveReaderStorageEnvelope {
  if (!payload || typeof payload !== 'object') return false;
  const envelope = payload as Partial<SensitiveReaderStorageEnvelope>;
  return envelope.encrypted === true && envelope.algorithm === 'local-envelope-v1' && typeof envelope.payload === 'string';
}

function encodeReaderPayload<T>(payload: T): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeReaderPayload<T>(payload: string): T {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(payload)))) as T;
  } catch {
    throw new Error('invalid-encrypted-payload');
  }
}

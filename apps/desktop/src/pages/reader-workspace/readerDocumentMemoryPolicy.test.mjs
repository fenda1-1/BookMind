import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./useReaderWorkspaceDocument.ts', import.meta.url), 'utf8');
const appShellModel = readFileSync(new URL('../../app/appShellModel.ts', import.meta.url), 'utf8');
const useLibrary = readFileSync(new URL('../../app/useLibrary.ts', import.meta.url), 'utf8');
const cacheBudgetPolicy = readFileSync(new URL('../../features/reader-core/readerMediaCacheBudgetModel.ts', import.meta.url), 'utf8');

assert.match(
  source,
  /const READER_DOCUMENT_CACHE_SIZE = readerMediaCacheBudgets\.documentEntries/u,
  'Reader document cache should keep at most two full text documents resident by default.',
);
assert.match(cacheBudgetPolicy, /documentEntries: 2/u, 'Reader document cache entry budget should remain two documents.');
assert.match(
  source,
  /const READER_DOCUMENT_PREWARM_LIMIT = 0/u,
  'Reader document prewarm should be disabled by default to avoid loading multiple large books into memory on startup.',
);
assert.match(
  source,
  /if \(READER_DOCUMENT_PREWARM_LIMIT <= 0\) return/u,
  'Prewarm effect should exit before scanning candidates when prewarm is disabled.',
);
assert.match(
  source,
  /const shouldReleaseHiddenReaderDocument = hidden && !standaloneReader/u,
  'Hidden main-window reader should switch into a release mode.',
);
assert.match(
  source,
  /shouldReleaseHiddenReaderDocument \? null : resolveInstantReaderBook/u,
  'Hidden main-window reader should not resolve cached full text back into render state.',
);
assert.match(
  source,
  /removeReaderDocumentCacheForBook\(readerDocumentCache, book\.id\)/u,
  'Hidden main-window reader should evict cached full document and parsed model for the current book.',
);
assert.match(
  source,
  /setReaderDocumentModel\(\(current\) => current\?\.bookId === book\.id \? null : current\)/u,
  'Hidden main-window reader should release parsed chapter model state.',
);
assert.match(
  appShellModel,
  /export function stripBookDocumentPayload\(book: Book\): Book[\s\S]*content: '', chunks: \[\]/u,
  'Global library metadata should have a helper that strips full reader document payloads.',
);
assert.match(
  appShellModel,
  /export function mergeLibraryMetadataBooks[\s\S]*stripBookDocumentPayload/u,
  'Metadata refresh should not retain previously loaded full text in the global books list.',
);
assert.match(
  useLibrary,
  /stripBookDocumentPayloads\(loaded\)/u,
  'Initial library load should keep only metadata in App books state.',
);
assert.match(
  useLibrary,
  /const importedMetadata = stripBookDocumentPayload\(imported\)/u,
  'Single-book import should avoid storing full text in App books state.',
);

console.log('Verified reader document memory policy.');

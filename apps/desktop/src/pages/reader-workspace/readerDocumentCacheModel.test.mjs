import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-reader-document-cache-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/pages/reader-workspace/readerDocumentCacheModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const {
  createReaderDocumentCacheState,
  getReaderDocumentModelCache,
  putReaderDocumentCache,
  putReaderDocumentModelCache,
  removeReaderDocumentCacheForBook,
  resolveInstantReaderBook,
  shouldBlockForReaderDocument,
} = await import(pathToFileURL(join(outDir, 'pages/reader-workspace/readerDocumentCacheModel.js')).href);

function createBook(id, content = '') {
  return {
    id,
    title: id,
    displayTitle: id,
    author: '',
    format: 'TXT',
    status: '已导入',
    progress: 0,
    fileName: `${id}.txt`,
    filePath: '',
    coverLabel: 'TXT',
    coverTone: 'sage',
    deleted: false,
    deletedAt: '',
    contentHash: `${id}-hash`,
    importedAt: '',
    content,
    chunks: [],
  };
}

const cache = createReaderDocumentCacheState();
const metadataOnlyBook = createBook('book-a');
const fullBook = createBook('book-a', '第1章\n正文');
putReaderDocumentCache(cache, fullBook);

assert.equal(
  resolveInstantReaderBook(metadataOnlyBook, false, null, cache),
  fullBook,
  'metadata-only book should resolve to cached full document immediately',
);

assert.equal(
  shouldBlockForReaderDocument({
    isPdfBook: false,
    book: metadataOnlyBook,
    readerBook: fullBook,
    activeModel: {
      bookId: 'book-a',
      contentHash: 'book-a-hash',
      cleanedContent: '正文',
      sourceChapters: [{ id: 'c1', title: '第1章', index: 0, startLine: 0, paragraphs: ['正文'] }],
      signature: 'sig-a',
      loading: true,
      error: '',
    },
    sourceChapterCount: 1,
    readerDocumentError: '',
    readerDocumentModelError: '',
  }),
  false,
  'background model refresh should not block when cached chapters are already renderable',
);

const modelCache = createReaderDocumentCacheState();
const cachedModel = {
  bookId: 'book-b',
  contentHash: 'book-b-hash',
  cleanedContent: '正文',
  sourceChapters: [{ id: 'c1', title: '第1章', index: 0, startLine: 0, paragraphs: ['正文'] }],
  signature: 'sig-b',
  loading: false,
  error: '',
};
putReaderDocumentModelCache(modelCache, cachedModel);
assert.equal(getReaderDocumentModelCache(modelCache, 'sig-b'), cachedModel, 'parsed document model cache should be keyed by signature');
removeReaderDocumentCacheForBook(modelCache, 'book-b');
assert.equal(getReaderDocumentModelCache(modelCache, 'sig-b'), null, 'book cache cleanup should remove parsed models for that book');

const lruCache = createReaderDocumentCacheState();
putReaderDocumentCache(lruCache, createBook('one', '1'), 2);
putReaderDocumentCache(lruCache, createBook('two', '2'), 2);
const eviction = putReaderDocumentCache(lruCache, createBook('three', '3'), 2);
assert.deepEqual(eviction?.evictedKeys, ['one'], 'document cache should report the oldest document displaced by its entry budget');
assert.equal(resolveInstantReaderBook(createBook('one'), false, null, lruCache), null, 'document cache should evict the oldest entry');
assert.equal(Boolean(resolveInstantReaderBook(createBook('three'), false, null, lruCache)), true, 'document cache should keep the newest entry');
removeReaderDocumentCacheForBook(lruCache, 'three');
assert.equal(resolveInstantReaderBook(createBook('three'), false, null, lruCache), null, 'book cache cleanup should remove full document payloads');

const recencyCache = createReaderDocumentCacheState();
putReaderDocumentCache(recencyCache, createBook('first', '1'), 2);
putReaderDocumentCache(recencyCache, createBook('second', '2'), 2);
assert.ok(resolveInstantReaderBook(createBook('first'), false, null, recencyCache), 'reading a cached document should count as recent use');
const recencyEviction = putReaderDocumentCache(recencyCache, createBook('third', '3'), 2);
assert.deepEqual(recencyEviction?.evictedKeys, ['second'], 'LRU eviction should preserve a document that was reopened recently');

const workspaceDocumentHook = readFileSync('src/pages/reader-workspace/useReaderWorkspaceDocument.ts', 'utf8');
assert.doesNotMatch(workspaceDocumentHook, /reader-document\.released-(?:hidden|on-hide)/u, 'hiding the reader should retain bounded document and parsed-model caches for fast reopen');
assert.match(workspaceDocumentHook, /READER_DOCUMENT_CACHE_SIZE = readerMediaCacheBudgets\.documentEntries/u, 'retained reader documents must remain constrained by the shared memory budget');
assert.match(workspaceDocumentHook, /READER_DOCUMENT_MODEL_CACHE_SIZE = readerMediaCacheBudgets\.documentModelEntries/u, 'retained parsed models must remain constrained by the shared memory budget');

console.log('Reader document cache model tests passed.');

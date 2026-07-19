import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const outDir = join(tmpdir(), `bookmind-index-diagnostics-service-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/indexDiagnosticsService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

writeFileSync(join(outDir, 'services', 'taskService.js'), 'exports.loadIndexDiagnostics = async () => ({ summary: {}, books: [] });\n');

const require = createRequire(import.meta.url);
const service = require(join(outDir, 'services', 'indexDiagnosticsService.js'));
const { getBookIndexEmptyState, getBookIndexView, getIndexEmptyState, getSemanticCapabilityNotice } = service;

const book = {
  id: 'book-stale',
  title: 'Stale Book',
  displayTitle: 'Stale Book',
  chunks: [{ id: 'chunk-1' }],
};

const diagnostics = {
  summary: {
    ftsAvailable: true,
    indexedChunkCount: 1,
    indexedBookCount: 1,
    staleBookCount: 1,
  },
  books: [{
    bookId: 'book-stale',
    bookTitle: 'Stale Book',
    filePath: 'E:\\library\\stale-book.txt',
    contentHash: 'hash-v1',
    indexVersion: 1,
    chunkStrategyVersion: 1,
    chapterRuleVersion: 1,
    ftsSchemaVersion: 1,
    status: 'stale',
    builtAt: '2026-06-08T00:00:00.000Z',
    staleReason: 'chunk 策略已更新',
    chapterCount: 3,
    paragraphCount: 20,
    chunkCount: 8,
    ftsRowCount: 8,
    bytesIndexed: 1024,
    firstChunkPreview: 'first',
    lastError: '',
  }],
};

const staleView = getBookIndexView(book, diagnostics);
assert.equal(staleView.ready, false, 'stale indexes must not be treated as ready even when chunks and FTS rows still exist');
assert.equal(staleView.stale, true, 'stale indexes must be explicit in the shared book index view');
assert.equal(staleView.staleReason, 'chunk 策略已更新', 'stale reason must be retained for UI diagnostics');

const emptyState = getBookIndexEmptyState(book, diagnostics);
assert.equal(emptyState.status, 'stale', 'search empty state must classify stale indexes explicitly');
assert.match(emptyState.title, /索引.*过期/, 'search stale state title must mention index staleness');
assert.match(emptyState.detail, /chunk 策略已更新/, 'search stale state must expose stale reason');
assert.match(emptyState.action, /重建索引/, 'search stale state must give a concrete rebuild action');

assert.equal(typeof service.createBookIndexAiDiagnostics, 'function', 'AI path must share a stale-index diagnostic builder');
const aiDiagnostics = service.createBookIndexAiDiagnostics(book, diagnostics, { scope: 'book', queryUsed: '雨夜' });
assert.equal(aiDiagnostics.errorKind, 'stale-index', 'AI stale state must use a distinct stale-index error kind');
assert.equal(aiDiagnostics.indexStatus, 'stale', 'AI diagnostics must expose the manifest status');
assert.equal(aiDiagnostics.staleReason, 'chunk 策略已更新', 'AI diagnostics must expose stale reason');
assert.match(aiDiagnostics.recommendations.join('\n'), /重建索引/, 'AI diagnostics must tell the user to rebuild the stale index');

const unloadedDiagnosticsView = getBookIndexView(book, null);
assert.equal(unloadedDiagnosticsView.missing, false, 'diagnostics that have not loaded yet must not turn an already chunked book into missing');
assert.equal(getBookIndexEmptyState(book, null), null, 'search must not show a no-index empty state before diagnostics load for a chunked book');

const ftsUnavailableEmptyState = getIndexEmptyState({
  summary: {
    indexedChunkCount: 12,
    indexedBookCount: 1,
    staleBookCount: 0,
    ftsAvailable: false,
    ftsDatabasePath: 'E:\\BookMind\\db\\bookmind.sqlite',
    recentError: '',
    recentErrors: [],
  },
  books: [],
});
assert.equal(ftsUnavailableEmptyState.status, 'missing', 'FTS-unavailable empty state must remain actionable in the search surface');
assert.match(ftsUnavailableEmptyState.detail, /FTS 不可用/, 'FTS-unavailable empty state must clearly mention FTS');
assert.match(ftsUnavailableEmptyState.action, /修复 FTS/, 'FTS-unavailable empty state must point users to FTS repair');

const semanticUnavailableSummary = {
  indexedChunkCount: 12,
  indexedBookCount: 1,
  staleBookCount: 0,
  ftsAvailable: true,
  ftsDatabasePath: 'E:\\BookMind\\db\\bookmind.sqlite',
  recentError: '',
  recentErrors: [],
  sidecarStatus: 'not-configured',
  sidecarMessage: 'Python sidecar is not configured; SQLite FTS remains active.',
  vectorIndexStatus: 'not-built',
  vectorIndexedBookCount: 0,
  vectorIndexedChunkCount: 0,
  vectorProvider: '',
  vectorDimension: 0,
  vectorLastBuiltAt: '',
  vectorLastError: '',
};

const semanticUnavailableNotice = getSemanticCapabilityNotice({
  summary: semanticUnavailableSummary,
  books: [],
});

assert.equal(semanticUnavailableNotice.status, 'unavailable', 'semantic capability notice must be explicit when sidecar or vector index is unavailable');
assert.match(semanticUnavailableNotice.title, /本地全文检索可用/, 'semantic capability notice must tell users local full-text search is available');
assert.match(semanticUnavailableNotice.detail, /语义能力待配置/, 'semantic capability notice must tell users semantic capability is pending configuration');
assert.match(semanticUnavailableNotice.detail, /not-configured/, 'semantic capability notice must expose sidecar status without implying semantic search works');
assert.match(semanticUnavailableNotice.detail, /not-built/, 'semantic capability notice must expose vector status without implying vector search works');

assert.equal(
  getSemanticCapabilityNotice({ summary: { ...semanticUnavailableSummary, sidecarStatus: 'available', vectorIndexStatus: 'ready' }, books: [] }),
  null,
  'semantic capability notice must disappear after sidecar and vector index are ready',
);

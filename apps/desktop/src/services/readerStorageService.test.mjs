import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-reader-storage-service-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/readerStorageService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { CorruptReaderRecordError, createSensitiveReaderStoragePayload, parseReaderRecord } = await import(pathToFileURL(join(outDir, 'readerStorageService.js')).href);

function makeRecord(data, kind = 'highlights') {
  return {
    bookId: 'book-1',
    kind,
    payload: JSON.stringify({
      schemaVersion: 1,
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
      sourceWindowId: 'main',
      data,
    }),
    schemaVersion: 1,
    updatedAt: '2026-06-09T00:00:00.000Z',
    sourceWindowId: 'main',
  };
}

function makeRawRecord(data, kind = 'highlights') {
  return {
    bookId: 'book-1',
    kind,
    payload: JSON.stringify(data),
    schemaVersion: 1,
    updatedAt: '2026-06-09T00:00:00.000Z',
    sourceWindowId: 'main',
  };
}

const highlights = [{ id: 'h1', text: 'private highlight', note: 'private note' }];
const encryptedHighlights = createSensitiveReaderStoragePayload(highlights, true);

assert.equal(encryptedHighlights.encrypted, true);
assert.equal(encryptedHighlights.algorithm, 'local-envelope-v1');
assert.equal(typeof encryptedHighlights.payload, 'string');
assert.doesNotMatch(encryptedHighlights.payload, /private highlight|private note/);
assert.deepEqual(parseReaderRecord(makeRecord(encryptedHighlights), []), highlights);

const bookmarks = [{ id: 'b1', label: '第 1 页', note: 'private bookmark note' }];
assert.deepEqual(parseReaderRecord(makeRecord(createSensitiveReaderStoragePayload(bookmarks, true), 'bookmarks'), []), bookmarks);

const tocEdits = [{ id: 'toc-1', type: 'rename', chapterId: 'chapter-1', title: 'private chapter alias' }];
assert.deepEqual(parseReaderRecord(makeRecord(createSensitiveReaderStoragePayload(tocEdits, true), 'tocEdits'), []), tocEdits);

const cloudHistory = [{
  id: 'ai-1',
  bookId: 'book-1',
  createdAt: '2026-06-09T00:00:00.000Z',
  durationMs: 1200,
  endpointMode: 'responses',
  model: 'sensitive-model-name',
  scope: 'current-chapter',
  scopeLabel: 'Sensitive Chapter Title',
  resultCount: 2,
  status: 'succeeded',
  redactedFields: ['body', 'scopeText', 'userText', 'apiKey'],
}];
const encryptedCloudHistory = createSensitiveReaderStoragePayload(cloudHistory, true);
assert.deepEqual(parseReaderRecord(makeRecord(encryptedCloudHistory, 'cloudAiRequestHistory'), []), cloudHistory);
assert.deepEqual(parseReaderRecord(makeRecord(cloudHistory, 'cloudAiRequestHistory'), []), cloudHistory);
assert.deepEqual(parseReaderRecord(makeRawRecord(cloudHistory, 'cloudAiRequestHistory'), []), cloudHistory);

const aiConversationHistory = {
  activeConversationId: 'chat-1',
  conversations: [{
    id: 'chat-1',
    title: 'private question',
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    pinned: false,
    messages: [{ id: 'msg-1', role: 'user', content: 'private reader question', createdAt: '2026-06-09T00:00:00.000Z', updatedAt: '2026-06-09T00:00:00.000Z' }],
  }],
};
assert.deepEqual(parseReaderRecord(makeRecord(createSensitiveReaderStoragePayload(aiConversationHistory, true), 'aiConversationHistory'), null), aiConversationHistory);

assert.deepEqual(createSensitiveReaderStoragePayload(highlights, false), highlights);

assert.throws(
  () => parseReaderRecord(makeRecord({ encrypted: true, algorithm: 'local-envelope-v1', payload: 'not-json-base64' }), []),
  (error) => error instanceof CorruptReaderRecordError && error.reason === 'invalid-encrypted-payload',
);

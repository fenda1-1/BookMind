import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-cloud-ai-history-service-test-${process.pid}`);
const stubPackageDir = join(outDir, 'node_modules', '@tauri-apps', 'api');

mkdirSync(stubPackageDir, { recursive: true });
writeFileSync(
  join(stubPackageDir, 'package.json'),
  JSON.stringify({
    type: 'module',
    exports: {
      './core': './core.js',
    },
  }),
);
writeFileSync(
  join(stubPackageDir, 'core.js'),
  `
const records = new Map();
export const calls = [];
export function __resetReaderRecords() {
  records.clear();
  calls.length = 0;
}
export function __putReaderRecord(record) {
  records.set(\`\${record.bookId}:\${record.kind}\`, record);
}
export async function invoke(command, args) {
  calls.push({ command, args });
  if (command === 'get_reader_record') {
    return records.get(\`\${args.bookId}:\${args.kind}\`) ?? null;
  }
  if (command === 'save_reader_record') {
    const request = args.request;
    const record = {
      bookId: request.bookId,
      kind: request.kind,
      payload: request.payload,
      schemaVersion: request.schemaVersion,
      updatedAt: '2026-06-09T00:00:00.000Z',
      sourceWindowId: request.sourceWindowId,
    };
    records.set(\`\${record.bookId}:\${record.kind}\`, record);
    return record;
  }
  throw new Error(\`Unexpected invoke command: \${command}\`);
}
`,
);

execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/cloudAiHistoryService.ts',
  'src/services/readerStorageService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const cloudHistoryPath = join(outDir, 'cloudAiHistoryService.js');
writeFileSync(
  cloudHistoryPath,
  readFileSync(cloudHistoryPath, 'utf8').replace("from './readerStorageService'", "from './readerStorageService.js'"),
);

const tauriCore = await import(pathToFileURL(join(stubPackageDir, 'core.js')).href);
const { saveCloudAiRequestHistory } = await import(pathToFileURL(cloudHistoryPath).href);
const { createSensitiveReaderStoragePayload, parseReaderRecord } = await import(pathToFileURL(join(outDir, 'readerStorageService.js')).href);

function makeEntry(id, overrides = {}) {
  return {
    id,
    bookId: 'book-sensitive',
    createdAt: `2026-06-09T00:00:0${id.endsWith('2') ? '2' : '1'}.000Z`,
    durationMs: id.endsWith('2') ? 84 : 42,
    endpointMode: 'responses',
    model: `gpt-sensitive-${id}`,
    scope: 'current-chapter',
    scopeLabel: `Chapter Secret ${id}`,
    selectedCommandId: 'summarize',
    retrievalStrategy: 'hybrid',
    resultCount: 3,
    status: 'succeeded',
    redactedFields: ['body', 'scopeText', 'userText', 'apiKey'],
    ...overrides,
  };
}

function makeReaderRecord(data) {
  return {
    bookId: 'book-sensitive',
    kind: 'cloudAiRequestHistory',
    payload: JSON.stringify({
      schemaVersion: 1,
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
      sourceWindowId: 'ai-research-desk',
      data,
    }),
    schemaVersion: 1,
    updatedAt: '2026-06-09T00:00:00.000Z',
    sourceWindowId: 'ai-research-desk',
  };
}

tauriCore.__resetReaderRecords();
const first = makeEntry('entry-1');
const firstHistory = await saveCloudAiRequestHistory(first);
assert.deepEqual(firstHistory, [first]);

const firstSave = tauriCore.calls.findLast((call) => call.command === 'save_reader_record');
assert.equal(firstSave.args.request.kind, 'cloudAiRequestHistory');
assert.equal(firstSave.args.request.sourceWindowId, 'ai-research-desk');
assert.doesNotMatch(firstSave.args.request.payload, /gpt-sensitive-entry-1|Chapter Secret entry-1/);

const firstStoredEnvelope = JSON.parse(firstSave.args.request.payload);
assert.equal(firstStoredEnvelope.data.encrypted, true);
assert.equal(firstStoredEnvelope.data.algorithm, 'local-envelope-v1');
assert.equal(typeof firstStoredEnvelope.data.payload, 'string');
assert.deepEqual(parseReaderRecord(makeReaderRecord(firstStoredEnvelope.data), []), [first]);

const second = makeEntry('entry-2', { status: 'failed', errorKind: 'network', errorMessage: 'timeout after 30s' });
const secondHistory = await saveCloudAiRequestHistory(second);
assert.deepEqual(secondHistory, [second, first]);

const secondSave = tauriCore.calls.findLast((call) => call.command === 'save_reader_record');
const secondStoredEnvelope = JSON.parse(secondSave.args.request.payload);
assert.equal(secondStoredEnvelope.data.encrypted, true);
assert.deepEqual(parseReaderRecord(makeReaderRecord(secondStoredEnvelope.data), []), [second, first]);

tauriCore.__resetReaderRecords();
const legacyEntry = makeEntry('legacy-1', { model: 'legacy-sensitive-model', scopeLabel: 'Legacy Secret Chapter' });
tauriCore.__putReaderRecord(makeReaderRecord([legacyEntry]));

const mergedHistory = await saveCloudAiRequestHistory(makeEntry('entry-3'), 2);
assert.deepEqual(mergedHistory.map((entry) => entry.id), ['entry-3', 'legacy-1']);

const legacyMergeSave = tauriCore.calls.findLast((call) => call.command === 'save_reader_record');
const legacyMergeEnvelope = JSON.parse(legacyMergeSave.args.request.payload);
assert.equal(legacyMergeEnvelope.data.encrypted, true);
assert.doesNotMatch(legacyMergeSave.args.request.payload, /legacy-sensitive-model|Legacy Secret Chapter/);
assert.deepEqual(parseReaderRecord(makeReaderRecord(legacyMergeEnvelope.data), []), mergedHistory);

const encryptedLegacy = createSensitiveReaderStoragePayload([legacyEntry], true);
tauriCore.__resetReaderRecords();
tauriCore.__putReaderRecord(makeReaderRecord(encryptedLegacy));
assert.deepEqual((await saveCloudAiRequestHistory(makeEntry('entry-4'), 2)).map((entry) => entry.id), ['entry-4', 'legacy-1']);

tauriCore.__resetReaderRecords();
const unsafeEntry = {
  ...makeEntry('entry-5'),
  body: 'unsafe body text',
  scopeText: 'unsafe scope text',
  userText: 'unsafe user text',
  apiKey: 'sk-unsafe',
  authorization: 'Bearer sk-unsafe',
};
const sanitizedHistory = await saveCloudAiRequestHistory(unsafeEntry);
assert.deepEqual(Object.keys(sanitizedHistory[0]).sort(), [
  'bookId',
  'createdAt',
  'durationMs',
  'endpointMode',
  'id',
  'model',
  'redactedFields',
  'resultCount',
  'retrievalStrategy',
  'scope',
  'scopeLabel',
  'selectedCommandId',
  'status',
].sort());

const sanitizedSave = tauriCore.calls.findLast((call) => call.command === 'save_reader_record');
const sanitizedEnvelope = JSON.parse(sanitizedSave.args.request.payload);
const sanitizedStored = parseReaderRecord(makeReaderRecord(sanitizedEnvelope.data), []);
assert.equal(sanitizedStored[0].body, undefined);
assert.equal(sanitizedStored[0].scopeText, undefined);
assert.equal(sanitizedStored[0].userText, undefined);
assert.equal(sanitizedStored[0].apiKey, undefined);
assert.equal(sanitizedStored[0].authorization, undefined);
assert.doesNotMatch(sanitizedSave.args.request.payload, /unsafe body text|unsafe scope text|unsafe user text|sk-unsafe/);

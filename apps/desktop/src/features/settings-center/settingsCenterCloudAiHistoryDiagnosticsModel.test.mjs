import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-cloud-ai-history-diagnostics-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterCloudAiHistoryDiagnosticsModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCloudAiHistoryDiagnosticsPayload,
} = require(join(outDir, 'features/settings-center/settingsCenterCloudAiHistoryDiagnosticsModel.js'));

const payload = buildCloudAiHistoryDiagnosticsPayload([
  {
    bookId: 'book-1',
    bookTitle: 'First Book',
    updatedAt: '2026-01-01T00:00:00.000Z',
    entries: [
      {
        id: 'entry-1',
        bookId: 'book-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        durationMs: 1200,
        endpointMode: 'responses',
        model: 'gpt-test',
        scope: 'book',
        scopeLabel: '整本书',
        selectedCommandId: 'summary',
        retrievalStrategy: 'scope-first',
        resultCount: 3,
        status: 'succeeded',
        redactedFields: ['body', 'apiKey'],
      },
      {
        id: 'entry-2',
        bookId: 'book-1',
        createdAt: '2026-01-01T00:01:00.000Z',
        durationMs: 50,
        endpointMode: 'responses',
        model: 'gpt-test',
        scope: 'selection',
        resultCount: 0,
        status: 'failed',
        errorKind: 'timeout',
        redactedFields: ['scopeText', 'apiKey'],
      },
    ],
  },
  {
    bookId: 'book-2',
    updatedAt: '2026-01-02T00:00:00.000Z',
    entries: [
      {
        id: 'entry-3',
        bookId: 'book-2',
        createdAt: '2026-01-02T00:00:00.000Z',
        durationMs: 300,
        endpointMode: 'chat.completions',
        model: 'gpt-test',
        scope: 'chapter',
        resultCount: 1,
        status: 'stopped',
        redactedFields: [],
      },
    ],
  },
], '2026-06-12T00:00:00.000Z');

assert.deepEqual(payload, {
  schema: 'bookmind.ai.history.diagnostics.v1',
  exportedAt: '2026-06-12T00:00:00.000Z',
  excludedFields: ['apiKey', 'prompt', 'answer', 'scopeText', 'readerContent'],
  summary: {
    bookCount: 2,
    totalEntries: 3,
    statusCounts: {
      succeeded: 1,
      failed: 1,
      stopped: 1,
    },
    redactedFieldCounts: {
      body: 1,
      apiKey: 2,
      scopeText: 1,
    },
  },
  books: [
    {
      bookId: 'book-1',
      bookTitle: 'First Book',
      updatedAt: '2026-01-01T00:00:00.000Z',
      entryCount: 2,
      entries: [
        {
          id: 'entry-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          durationMs: 1200,
          endpointMode: 'responses',
          model: 'gpt-test',
          scope: 'book',
          scopeLabel: '整本书',
          selectedCommandId: 'summary',
          retrievalStrategy: 'scope-first',
          resultCount: 3,
          status: 'succeeded',
          errorKind: undefined,
          redactedFields: ['body', 'apiKey'],
        },
        {
          id: 'entry-2',
          createdAt: '2026-01-01T00:01:00.000Z',
          durationMs: 50,
          endpointMode: 'responses',
          model: 'gpt-test',
          scope: 'selection',
          scopeLabel: undefined,
          selectedCommandId: undefined,
          retrievalStrategy: undefined,
          resultCount: 0,
          status: 'failed',
          errorKind: 'timeout',
          redactedFields: ['scopeText', 'apiKey'],
        },
      ],
    },
    {
      bookId: 'book-2',
      bookTitle: undefined,
      updatedAt: '2026-01-02T00:00:00.000Z',
      entryCount: 1,
      entries: [
        {
          id: 'entry-3',
          createdAt: '2026-01-02T00:00:00.000Z',
          durationMs: 300,
          endpointMode: 'chat.completions',
          model: 'gpt-test',
          scope: 'chapter',
          scopeLabel: undefined,
          selectedCommandId: undefined,
          retrievalStrategy: undefined,
          resultCount: 1,
          status: 'stopped',
          errorKind: undefined,
          redactedFields: [],
        },
      ],
    },
  ],
});

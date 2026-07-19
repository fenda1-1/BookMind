import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-overview-metrics-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterOverviewMetrics.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterOverviewMetrics } = require(join(outDir, 'features', 'characters', 'characterOverviewMetrics.js'));

const readyMetrics = buildCharacterOverviewMetrics({
  book: {
    characterCount: 12,
    relationCount: 7,
    evidenceCount: 31,
    textIndexChunkCount: 200,
    lastCharacterBuiltAt: '1781043859550',
  },
  manifest: {
    indexVersion: 8,
    extractionMode: 'rule-ai',
    sourceTextIndex: { chunkCount: 200, ftsRowCount: 200 },
    builtAt: '2026-06-10T01:00:00.000Z',
  },
  profiles: [
    profile('protagonist', 60),
    profile('main', 24),
    profile('supporting', 20),
    profile('minor', 2),
  ],
  centerState: { showZeroCharacterMetrics: true },
});

assert.deepEqual(readyMetrics.map((item) => item.id), ['characters', 'main-characters', 'relations', 'evidence', 'coverage', 'last-built', 'algorithm', 'text-index']);
assert.equal(readyMetrics.find((item) => item.id === 'main-characters').value, '3');
assert.equal(readyMetrics.find((item) => item.id === 'coverage').value, '100%');
assert.equal(readyMetrics.find((item) => item.id === 'last-built').value, formatExpectedLocalMinute('1781043859550'));
assert.equal(readyMetrics.find((item) => item.id === 'algorithm').value, 'rule-ai v8');

const blockedMetrics = buildCharacterOverviewMetrics({
  book: { characterCount: 0, relationCount: 0, evidenceCount: 0, textIndexChunkCount: 0, lastCharacterBuiltAt: '' },
  manifest: null,
  profiles: [],
  centerState: { showZeroCharacterMetrics: false },
});

assert.deepEqual(blockedMetrics.map((item) => item.id), ['text-index']);
assert.equal(blockedMetrics[0].value, '-');

function profile(role, mentionCount) {
  return {
    id: `${role}-${mentionCount}`,
    role,
    mentionCount,
    hidden: false,
  };
}

function formatExpectedLocalMinute(value) {
  const date = new Date(Number(value));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + ` ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

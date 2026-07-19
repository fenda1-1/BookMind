import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-character-overview-workbench-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterOverviewWorkbenchModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { getCharacterOverviewSectionFallbackKey } = require(join(outDir, 'features', 'characters', 'characterOverviewWorkbenchModel.js'));

assert.equal(
  getCharacterOverviewSectionFallbackKey({ hasOverviewSnapshot: false, overviewSnapshotLoading: false, centerStateId: 'character-index-building' }),
  'characters.graphStatus.loadingBody',
  'building character extraction should not flicker to the empty-record message between snapshot loading attempts',
);

assert.equal(
  getCharacterOverviewSectionFallbackKey({ hasOverviewSnapshot: false, overviewSnapshotLoading: false, centerStateId: 'character-index-queued' }),
  'characters.graphStatus.loadingBody',
  'queued character extraction should keep the pending/running message stable',
);

assert.equal(
  getCharacterOverviewSectionFallbackKey({ hasOverviewSnapshot: false, overviewSnapshotLoading: true, centerStateId: 'character-index-ready' }),
  'characters.overviewSnapshot.loadingBody',
  'active snapshot loading should not claim character extraction is queued or running',
);

assert.equal(
  getCharacterOverviewSectionFallbackKey({ hasOverviewSnapshot: false, overviewSnapshotLoading: false, centerStateId: 'character-index-ready' }),
  'characters.detailNone',
  'ready character indexes with no overview snapshot should show the empty-record message',
);

assert.equal(
  getCharacterOverviewSectionFallbackKey({ hasOverviewSnapshot: true, overviewSnapshotLoading: false, centerStateId: 'character-index-building' }),
  null,
  'available overview snapshots should render their own section contents',
);

console.log('Verified character overview fallback text stays stable during queued/running extraction.');

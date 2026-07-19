import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/pages/CharactersPage.tsx', 'utf8');

assert.match(
  source,
  /const overviewSnapshotRequestKeyRef = useRef\(''\)/u,
  'Characters page should remember attempted overview snapshot requests.',
);
assert.match(
  source,
  /const overviewSnapshotRequestKey = selectedBook[\s\S]{0,420}selectedBook\.lastTaskId/u,
  'Overview snapshot request key should change when character index state changes.',
);
assert.match(
  source,
  /if \(overviewSnapshotRequestKeyRef\.current === overviewSnapshotRequestKey\) return;[\s\S]{0,120}overviewSnapshotRequestKeyRef\.current = overviewSnapshotRequestKey/u,
  'Characters page should not repeatedly request a missing overview snapshot for the same book state.',
);

console.log('Verified character overview snapshot request policy.');

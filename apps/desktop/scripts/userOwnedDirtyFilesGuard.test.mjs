import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  captureUserOwnedDirtyFiles,
  verifyUserOwnedDirtyFiles,
  verifyUserOwnedDirtyFilesOrClean,
} from './userOwnedDirtyFilesGuard.mjs';

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

const repoRoot = mkdtempSync(resolve(tmpdir(), 'bookmind-user-owned-dirty-files-'));
try {
  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.email', 'tests@bookmind.local']);
  git(repoRoot, ['config', 'user.name', 'BookMind Tests']);
  writeFileSync(resolve(repoRoot, 'owned.txt'), 'original\n');
  git(repoRoot, ['add', 'owned.txt']);
  git(repoRoot, ['commit', '-m', 'fixture']);
  assert.deepEqual(verifyUserOwnedDirtyFilesOrClean(repoRoot).files, []);

  writeFileSync(resolve(repoRoot, 'owned.txt'), 'user draft\n');
  const snapshot = captureUserOwnedDirtyFiles(repoRoot);
  assert.deepEqual(snapshot.files.map(({ path }) => path), ['owned.txt']);
  assert.doesNotThrow(() => verifyUserOwnedDirtyFiles(repoRoot));

  writeFileSync(resolve(repoRoot, 'owned.txt'), 'changed after baseline\n');
  assert.throws(
    () => verifyUserOwnedDirtyFiles(repoRoot),
    /User-owned dirty file changed after its baseline was recorded/u,
  );

  writeFileSync(resolve(repoRoot, 'owned.txt'), 'user draft\n');
  git(repoRoot, ['add', 'owned.txt']);
  assert.throws(
    () => verifyUserOwnedDirtyFiles(repoRoot),
    /User-owned dirty file changed after its baseline was recorded/u,
  );
} finally {
  rmSync(repoRoot, { recursive: true, force: true });
}

console.log('Verified user-owned dirty-file baseline capture and mutation detection.');

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const SNAPSHOT_FILE_NAME = 'bookmind-user-owned-dirty-files.json';

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function gitPath(repoRoot, name) {
  const output = git(repoRoot, ['rev-parse', '--git-path', name]).trim();
  return isAbsolute(output) ? output : resolve(repoRoot, output);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pathState(repoRoot, relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  let workingTree = null;
  if (existsSync(absolutePath)) {
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      workingTree = { kind: 'symlink', hash: hash(readlinkSync(absolutePath)) };
    } else if (stat.isFile()) {
      workingTree = { kind: 'file', hash: hash(readFileSync(absolutePath)) };
    } else {
      workingTree = { kind: 'other' };
    }
  }

  const indexLine = git(repoRoot, ['ls-files', '--stage', '--', relativePath]).trim();
  const indexObjectId = indexLine ? indexLine.split(/\s+/u)[1] : null;
  return { indexObjectId, workingTree };
}

function statusPaths(repoRoot) {
  const output = git(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const entries = output.split('\0');
  const paths = new Set();
  for (let index = 0; index < entries.length - 1; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    paths.add(entry.slice(3));
    if (/[RC]/u.test(status)) {
      paths.add(entries[index + 1]);
      index += 1;
    }
  }
  return [...paths].sort();
}

function snapshotPath(repoRoot) {
  return gitPath(repoRoot, SNAPSHOT_FILE_NAME);
}

export function captureUserOwnedDirtyFiles(repoRoot, paths = statusPaths(repoRoot)) {
  const dirtyPaths = new Set(statusPaths(repoRoot));
  const selectedPaths = [...new Set(paths)].sort();
  for (const path of selectedPaths) {
    if (!dirtyPaths.has(path)) {
      throw new Error(`Cannot protect a clean path as user-owned dirty state: ${path}`);
    }
  }
  const files = selectedPaths.map((path) => ({ path, ...pathState(repoRoot, path) }));
  const snapshot = {
    version: 1,
    files,
  };
  const targetPath = snapshotPath(repoRoot);
  mkdirSync(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, targetPath);
  return snapshot;
}

function readSnapshot(repoRoot) {
  const targetPath = snapshotPath(repoRoot);
  if (!existsSync(targetPath)) return null;
  const snapshot = JSON.parse(readFileSync(targetPath, 'utf8'));
  if (snapshot.version !== 1 || !Array.isArray(snapshot.files)) {
    throw new Error(`Invalid user-owned dirty-file snapshot: ${targetPath}`);
  }
  return snapshot;
}

export function verifyUserOwnedDirtyFiles(repoRoot) {
  const snapshot = readSnapshot(repoRoot);
  if (!snapshot) {
    throw new Error('No user-owned dirty-file snapshot exists. Run the guard with --record before editing project files.');
  }

  const protectedPaths = new Set(snapshot.files.map(({ path }) => path));
  for (const expected of snapshot.files) {
    const actual = pathState(repoRoot, expected.path);
    if (JSON.stringify(actual) !== JSON.stringify({ indexObjectId: expected.indexObjectId, workingTree: expected.workingTree })) {
      throw new Error(`User-owned dirty file changed after its baseline was recorded: ${expected.path}`);
    }
  }

  const stagedPaths = git(repoRoot, ['diff', '--cached', '--name-only', '-z', '--no-renames'])
    .split('\0')
    .filter(Boolean);
  const stagedProtectedPath = stagedPaths.find((path) => protectedPaths.has(path));
  if (stagedProtectedPath) {
    throw new Error(`User-owned dirty file is staged and would be included in this commit: ${stagedProtectedPath}`);
  }
  return snapshot;
}

export function verifyOrCaptureUserOwnedDirtyFiles(repoRoot) {
  if (readSnapshot(repoRoot)) return verifyUserOwnedDirtyFiles(repoRoot);
  return captureUserOwnedDirtyFiles(repoRoot);
}

export function verifyUserOwnedDirtyFilesOrClean(repoRoot) {
  if (readSnapshot(repoRoot)) return verifyUserOwnedDirtyFiles(repoRoot);
  if (statusPaths(repoRoot).length === 0) return { version: 1, files: [] };
  throw new Error('Dirty files exist without a user-owned baseline. Record the baseline before making project edits.');
}

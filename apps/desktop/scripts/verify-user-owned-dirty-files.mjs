import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureUserOwnedDirtyFiles,
  verifyOrCaptureUserOwnedDirtyFiles,
  verifyUserOwnedDirtyFilesOrClean,
  verifyUserOwnedDirtyFiles,
} from './userOwnedDirtyFilesGuard.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const mode = process.argv[2] ?? '--verify-or-record';

if (mode === '--record') {
  const paths = process.argv.slice(3);
  const snapshot = paths.length > 0
    ? captureUserOwnedDirtyFiles(repoRoot, paths)
    : captureUserOwnedDirtyFiles(repoRoot);
  console.log(`Recorded ${snapshot.files.length} user-owned dirty file(s).`);
} else if (mode === '--verify') {
  const snapshot = verifyUserOwnedDirtyFiles(repoRoot);
  console.log(`Verified ${snapshot.files.length} user-owned dirty file(s) remain untouched.`);
} else if (mode === '--verify-or-record') {
  const snapshot = verifyOrCaptureUserOwnedDirtyFiles(repoRoot);
  console.log(`Verified user-owned dirty-file guard for ${snapshot.files.length} file(s).`);
} else if (mode === '--verify-or-clean') {
  const snapshot = verifyUserOwnedDirtyFilesOrClean(repoRoot);
  console.log(`Verified user-owned dirty-file guard for ${snapshot.files.length} file(s).`);
} else {
  throw new Error(`Unknown mode: ${mode}. Expected --record, --verify, --verify-or-clean, or --verify-or-record.`);
}

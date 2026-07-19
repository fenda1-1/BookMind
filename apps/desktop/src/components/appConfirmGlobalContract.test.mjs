import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const checkedFiles = [];

function collectFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectFiles(path);
      continue;
    }
    if (/\.(ts|tsx)$/.test(path)) checkedFiles.push(path);
  }
}

collectFiles(sourceRoot);

for (const file of checkedFiles) {
  const content = readFileSync(file, 'utf8');
  assert.equal(
    content.includes('window.confirm'),
    false,
    `${relative(sourceRoot, file)} should use requestAppConfirm/useAppConfirm instead of window.confirm`,
  );
}

const confirmHook = readFileSync(new URL('./useAppConfirm.tsx', import.meta.url), 'utf8');
assert.match(confirmHook, /export function requestAppConfirm/u, 'app confirm service should expose requestAppConfirm');
assert.match(confirmHook, /registerAppConfirmHandler/u, 'app confirm hook should register a global handler');

console.log('Verified app confirmation is centralized and no source file calls window.confirm.');

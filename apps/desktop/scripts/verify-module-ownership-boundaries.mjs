import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModuleOwnership } from './moduleOwnershipBoundaries.mjs';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const violations = evaluateModuleOwnership(resolve(desktopRoot, 'src'));
assert.deepEqual(
  violations,
  [],
  `Module ownership boundary violations:\n${violations.map(({ code, filePath, specifier }) => `${code}: ${filePath} -> ${specifier}`).join('\n')}`,
);
console.log('Verified frontend module ownership boundaries for UI, services, and Tauri command access.');

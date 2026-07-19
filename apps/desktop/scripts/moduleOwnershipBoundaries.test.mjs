import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { evaluateModuleOwnership } from './moduleOwnershipBoundaries.mjs';

const sourceRoot = mkdtempSync(resolve(tmpdir(), 'bookmind-module-boundaries-'));
try {
  for (const directory of ['pages', 'services']) mkdirSync(resolve(sourceRoot, directory));
  writeFileSync(resolve(sourceRoot, 'pages', 'DirectCommand.tsx'), "import { invoke } from '@tauri-apps/api/core';\nexport const DirectCommand = <div onClick={() => invoke('get_library_books')} />;\n");
  writeFileSync(resolve(sourceRoot, 'pages', 'NodeAccess.tsx'), "import { readFileSync } from 'node:fs';\nvoid readFileSync;\n");
  writeFileSync(resolve(sourceRoot, 'services', 'invalidUiDependency.ts'), "import { DirectCommand } from '../pages/DirectCommand';\nvoid DirectCommand;\n");
  writeFileSync(resolve(sourceRoot, 'services', 'validCommandAdapter.ts'), "import { invoke } from '@tauri-apps/api/core';\nexport const load = () => invoke('get_library_books');\n");

  const codes = evaluateModuleOwnership(sourceRoot).map(({ code }) => code).sort();
  assert.deepEqual(codes, ['service-imports-ui', 'ui-imports-backend-runtime', 'ui-imports-tauri-invoke']);
} finally {
  rmSync(sourceRoot, { recursive: true, force: true });
}

console.log('Verified module ownership boundary violation detection.');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-pdf-render-error-model-${process.pid}`);
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
  'src/features/reader-core/pdfRenderErrorModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { isPdfRenderingCancelled } = require(join(outDir, 'pdfRenderErrorModel.js'));

assert.equal(
  isPdfRenderingCancelled({ name: 'RenderingCancelledException', message: 'Rendering cancelled, page 58' }),
  true,
  'PDF.js RenderingCancelledException should be treated as an expected cancellation',
);

assert.equal(
  isPdfRenderingCancelled(new Error('Rendering cancelled, page 12')),
  true,
  'PDF.js cancellation messages should be treated as expected even when the name is not preserved',
);

assert.equal(
  isPdfRenderingCancelled({ name: 'AbortException', message: 'TextLayer task cancelled.' }),
  true,
  'PDF.js TextLayer cancellation should be treated as expected when pages unmount or zoom changes',
);

assert.equal(
  isPdfRenderingCancelled({ name: 'PasswordException', message: 'No password given' }),
  false,
  'real PDF render/load errors must still be reported',
);

assert.equal(isPdfRenderingCancelled(null), false);

console.log('Verified PDF render cancellation errors are classified as expected control flow.');

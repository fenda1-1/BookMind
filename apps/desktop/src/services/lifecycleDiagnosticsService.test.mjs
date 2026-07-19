import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-lifecycle-diagnostics-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck',
  'src/services/lifecycleDiagnosticsService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const diagnostics = await import(pathToFileURL(join(outDir, 'lifecycleDiagnosticsService.js')).href);
diagnostics.clearLifecycleDiagnostics();
const observed = [];
const unsubscribe = diagnostics.subscribeLifecycleDiagnostics((event) => observed.push(event));
const event = diagnostics.recordLifecycleDiagnostic('cache', 'reader-document.evicted', { bookId: 'book-1', count: 2 });
unsubscribe();

assert.equal(event.domain, 'cache');
assert.equal(observed.length, 1);
assert.deepEqual(diagnostics.getLifecycleDiagnostics(1), [event]);
diagnostics.clearLifecycleDiagnostics();
assert.deepEqual(diagnostics.getLifecycleDiagnostics(), []);

console.log('Verified bounded structured lifecycle diagnostic recording and subscription.');

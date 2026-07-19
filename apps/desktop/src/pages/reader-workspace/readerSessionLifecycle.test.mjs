import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-reader-session-lifecycle-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck',
  'src/pages/reader-workspace/readerSessionLifecycle.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const lifecycle = await import(pathToFileURL(join(outDir, 'readerSessionLifecycle.js')).href);
const main = lifecycle.resolveReaderSessionMode({ standaloneReader: false, detachedFromMain: false });
const standalone = lifecycle.resolveReaderSessionMode({ standaloneReader: true, detachedFromMain: false });
const detached = lifecycle.resolveReaderSessionMode({ standaloneReader: true, detachedFromMain: true });

assert.equal(main, 'main');
assert.equal(standalone, 'standalone');
assert.equal(detached, 'detached');
assert.equal(lifecycle.shouldKeepMainReaderMounted(main), true);
assert.equal(lifecycle.shouldKeepMainReaderMounted(detached), false);
assert.equal(lifecycle.shouldRestoreMainReaderAfterWindowClose(detached), true);
assert.equal(lifecycle.shouldRestoreMainReaderAfterWindowClose(standalone), false);
assert.equal(lifecycle.shouldBroadcastReaderState({ sessionMode: 'main', multiWindowReaderSync: true }), false);
assert.equal(lifecycle.shouldBroadcastReaderState({ sessionMode: 'standalone', multiWindowReaderSync: true }), true);
assert.equal(lifecycle.shouldBroadcastReaderState({ sessionMode: 'detached', multiWindowReaderSync: true }), false);
assert.equal(lifecycle.shouldBroadcastReaderState({ sessionMode: 'detached', multiWindowReaderSync: false, forceSync: true }), true);

console.log('Verified main, standalone, and detached reader session ownership rules.');

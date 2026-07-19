import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-browser-domain-events-${process.pid}`);
mkdirSync(outDir, { recursive: true });

try {
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck',
    'src/services/browserDomainEvents.ts',
  ], { cwd: process.cwd(), stdio: 'inherit' });

  class TestCustomEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.detail = init.detail;
    }
  }

  globalThis.window = new EventTarget();
  globalThis.CustomEvent = TestCustomEvent;
  const events = await import(pathToFileURL(join(outDir, 'browserDomainEvents.js')).href);
  const received = [];
  const unsubscribe = events.subscribeBrowserDomainEvent('bookmind:test-domain-event', (detail) => received.push(detail));
  events.emitBrowserDomainEvent('bookmind:test-domain-event', { source: 'reader', sequence: 1 });
  unsubscribe();
  events.emitBrowserDomainEvent('bookmind:test-domain-event', { source: 'reader', sequence: 2 });

  assert.deepEqual(received, [{ source: 'reader', sequence: 1 }]);
  console.log('Verified typed browser domain-event payload delivery and listener disposal.');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

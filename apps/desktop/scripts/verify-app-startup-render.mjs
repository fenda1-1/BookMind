import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.window = {
  location: { search: '' },
  localStorage: globalThis.localStorage,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => true,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};

const outDir = await mkdtemp(join(process.cwd(), '.bookmind-app-startup-'));
const browserOnlyPdfStub = {
  name: 'browser-only-pdf-stub',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'pdfjs-dist' || id === 'pdfjs-dist/web/pdf_viewer.mjs') return `\0${id}`;
    return null;
  },
  load(id) {
    if (id === '\0pdfjs-dist') {
      return 'export const GlobalWorkerOptions = {}; export function getDocument() { return { promise: Promise.reject(new Error("PDF is unavailable during server startup checks")) }; }';
    }
    if (id === '\0pdfjs-dist/web/pdf_viewer.mjs') return 'export class TextLayerBuilder {}';
    return null;
  },
};

try {
  await build({
    logLevel: 'error',
    plugins: [browserOnlyPdfStub],
    ssr: { noExternal: ['pdfjs-dist'] },
    build: {
      ssr: 'src/app/App.tsx',
      outDir,
      rollupOptions: { output: { entryFileNames: 'app.mjs' } },
    },
  });
  const { App } = await import(pathToFileURL(join(outDir, 'app.mjs')).href);
  let html = '';
  assert.doesNotThrow(() => {
    html = renderToStaticMarkup(React.createElement(App));
  }, /useAppState must be used within AppStateContext\.Provider/, 'App startup render must not call AppState-dependent hooks before the provider exists');
  assert.match(html, /app-shell|standalone-reader-shell/, 'App startup render must produce a visible shell instead of an empty root');
} finally {
  await rm(outDir, { recursive: true, force: true });
}

console.log('Verified app startup render does not blank before provider wiring.');

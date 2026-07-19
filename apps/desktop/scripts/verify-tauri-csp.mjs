import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const csp = config?.app?.security?.csp ?? '';
const assetProtocol = config?.app?.security?.assetProtocol ?? {};
assert.match(csp, /img-src[^;]*\basset:/, 'Tauri CSP img-src must allow asset: images');
assert.match(csp, /img-src[^;]*http:\/\/asset\.localhost/, 'Tauri CSP img-src must allow convertFileSrc asset.localhost URLs in dev/webview');
assert.equal(assetProtocol.enable, true, 'Tauri asset protocol must be enabled for reader image assets');
assert.ok(
  Array.isArray(assetProtocol.scope) && assetProtocol.scope.some((entry) => entry === '$LOCALDATA/BookMindData/library/epub-assets/**'),
  'Tauri asset protocol scope must allow EPUB image assets under BookMindData/library/epub-assets',
);

console.log('Verified Tauri CSP and asset protocol permit local reader images.');

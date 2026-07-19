import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('./externalUrlService.ts', import.meta.url), 'utf8');
const commands = readFileSync(new URL('../../src-tauri/src/commands.rs', import.meta.url), 'utf8');
const lib = readFileSync(new URL('../../src-tauri/src/lib.rs', import.meta.url), 'utf8');

assert.match(service, /invoke<void>\('open_external_url'/u, 'Frontend should call the Tauri external URL command.');
assert.match(service, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/u, 'Browser preview should fall back to window.open.');
assert.match(commands, /pub\(crate\) fn validate_external_url_for_open/u, 'Rust should validate URLs before opening them.');
assert.match(commands, /url\.starts_with\("https:\/\/"\).*url\.starts_with\("http:\/\/"\).*url\.starts_with\("mailto:"\)/s, 'External opener should only allow http, https, and mailto URLs.');
assert.match(commands, /pub\(crate\) fn open_external_url\(url: String\) -> Result<\(\), String>/u, 'Rust command should expose open_external_url.');
assert.match(lib, /open_external_url/u, 'Tauri invoke handler should register open_external_url.');

console.log('Verified external URL opening is routed through a validated desktop command.');

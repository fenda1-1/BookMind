import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(desktopRoot, '..', '..');
const packageVersion = JSON.parse(readFileSync(resolve(desktopRoot, 'package.json'), 'utf8')).version;
const tauriVersion = JSON.parse(readFileSync(resolve(desktopRoot, 'src-tauri', 'tauri.conf.json'), 'utf8')).version;
const cargoManifest = readFileSync(resolve(desktopRoot, 'src-tauri', 'Cargo.toml'), 'utf8');
const cargoVersion = cargoManifest.match(/^\[package\][\s\S]*?^version = "([^"]+)"/mu)?.[1];
const versions = [packageVersion, tauriVersion, cargoVersion];

assert.ok(versions.every(Boolean), 'package.json, tauri.conf.json, and Cargo.toml must all define a release version');
assert.equal(new Set(versions).size, 1, `release versions must match: ${versions.join(', ')}`);
assert.match(packageVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u, `invalid release version: ${packageVersion}`);
assert.ok(existsSync(resolve(repositoryRoot, 'docs', 'releases', `v${packageVersion}.md`)), `missing release notes for v${packageVersion}`);

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag) {
  assert.equal(releaseTag, `v${packageVersion}`, `release tag ${releaseTag} must equal v${packageVersion}`);
}

console.log(`Release version verified: v${packageVersion}`);

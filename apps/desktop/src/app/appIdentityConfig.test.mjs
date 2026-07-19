import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const defaultCapability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'));
const mainWindow = tauriConfig.app?.windows?.[0];

assert.equal(tauriConfig.productName, 'BookMind', 'desktop product name should be BookMind');
assert.equal(mainWindow?.title, 'BookMind', 'main window title should be BookMind');
assert.ok(defaultCapability.permissions.includes('core:window:allow-maximize'), 'main window should allow restoring maximized state');
assert.ok(defaultCapability.permissions.includes('core:window:allow-is-maximized'), 'main window should allow reading maximized state');

console.log('Verified desktop app identity config.');

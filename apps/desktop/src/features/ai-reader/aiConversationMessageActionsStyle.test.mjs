import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../../app/styles/settings.css', import.meta.url), 'utf8');

assert.match(styles, /\.ai-message-action-rail \{[^}]*border-radius:\s*999px/u);
assert.match(styles, /\.ai-message-action-rail \{[^}]*box-shadow:\s*inset 0 1px 0/u);
assert.match(styles, /\.ai-message-action-btn \{[^}]*width:\s*24px/u);
assert.match(styles, /\.ai-message-action-btn \{[^}]*height:\s*24px/u);
assert.match(styles, /\.ai-message-action-btn \{[^}]*border-radius:\s*10px/u);
assert.match(styles, /\.ai-message-action-btn svg \{[^}]*width:\s*16px/u);

console.log('Verified AI message action buttons keep compact shell styling.');

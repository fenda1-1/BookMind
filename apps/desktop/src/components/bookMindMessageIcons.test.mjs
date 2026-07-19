import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./BookMindIcon.tsx', import.meta.url), 'utf8');

function iconCase(icon) {
  const match = source.match(new RegExp(`case '${icon}':[\\s\\S]*?(?=\\n    case '|\\n    default:)`, 'u'));
  assert.ok(match, `${icon} case should exist`);
  return match[0];
}

for (const icon of ['aiMessageRetry', 'aiMessageDelete', 'aiMessageCopy', 'aiMessageMore']) {
  const block = iconCase(icon);
  assert.match(block, /return <>/u, `${icon} should use native 52x52 paper-geometry paths`);
  assert.doesNotMatch(block, /transform="translate\(2 2\) scale\(2\)"/u);
}

assert.match(iconCase('aiMessageDelete'), /bm-stroke-accent[\s\S]*M19 16h14/u);
assert.match(iconCase('aiMessageCopy'), /M19 13h17l6 6v22H19z/u);
assert.match(iconCase('aiMessageMore'), /M15 19h22M15 26h22M15 33h22/u);

console.log('Verified message action icons use paper-geometry SVG paths.');

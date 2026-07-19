import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/features/characters/CharacterGraphWebglView.tsx', 'utf8');

assert.match(
  source,
  /function preventCancelableDefault\(event: \{ cancelable: boolean; preventDefault: \(\) => void \}\)/u,
  'WebGL graph should guard preventDefault behind event.cancelable.',
);
assert.doesNotMatch(
  source,
  /(?<!function preventCancelableDefault\(event: \{ cancelable: boolean; preventDefault: \(\) => void \}\) \{\n    if \(event\.cancelable\) )event\.preventDefault\(\)/u,
  'WebGL graph handlers should not call event.preventDefault directly.',
);
assert.match(
  source,
  /function handleWheel[\s\S]{0,120}preventCancelableDefault\(event\)/u,
  'Wheel zoom should use the cancelable default guard.',
);
assert.match(
  source,
  /function handlePointerDown[\s\S]{0,160}preventCancelableDefault\(event\)/u,
  'Pointer drag start should use the cancelable default guard.',
);

console.log('Verified character graph WebGL passive event handling.');

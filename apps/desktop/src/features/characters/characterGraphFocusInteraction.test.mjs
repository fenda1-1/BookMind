import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const relationView = readFileSync('src/features/characters/CharacterRelationGraphView.tsx', 'utf8');
const webglView = readFileSync('src/features/characters/CharacterGraphWebglView.tsx', 'utf8');
const canvasView = readFileSync('src/features/characters/CharacterGraphCanvasView.tsx', 'utf8');

const focusHandlers = [...relationView.matchAll(/onFocusSearch=\{\(characterId, label\) => \{([\s\S]*?)\s+\}\}/gu)];
assert.ok(focusHandlers.length >= 2, 'graph views should provide focus-search handlers for WebGL and fallback canvases');
for (const handler of focusHandlers) {
  assert.doesNotMatch(handler[1], /onSelectCharacter/u, 'double-click focus must not also select the character inspector');
  assert.doesNotMatch(handler[1], /resetGraphCanvasViewport/u, 'double-click focus must preserve the current zoom and pan');
}

assert.match(webglView, /clickTimerRef/u, 'WebGL graph should defer single-click selection so double-click can cancel it');
assert.match(webglView, /window\.clearTimeout\(clickTimerRef\.current\)/u, 'WebGL double-click should cancel pending single-click selection');
assert.match(canvasView, /clickTimerRef/u, 'Canvas fallback graph should defer single-click selection so double-click can cancel it');
assert.match(canvasView, /window\.clearTimeout\(clickTimerRef\.current\)/u, 'Canvas fallback double-click should cancel pending single-click selection');

console.log('Verified character graph double-click focuses without selection or viewport reset.');

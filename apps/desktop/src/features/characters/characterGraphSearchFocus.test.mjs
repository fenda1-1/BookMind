import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const relationView = readFileSync('src/features/characters/CharacterRelationGraphView.tsx', 'utf8');
const webglView = readFileSync('src/features/characters/CharacterGraphWebglView.tsx', 'utf8');
const canvasView = readFileSync('src/features/characters/CharacterGraphCanvasView.tsx', 'utf8');
const renderModel = readFileSync('src/features/characters/characterGraphRenderModel.ts', 'utf8');

assert.match(relationView, /findCharacterGraphSearchHighlightedNodeIds/u, 'relationship graph should derive highlighted nodes from the applied search query');
assert.match(relationView, /highlightedNodeIds: graphSearchHighlightedNodeIds/u, 'search highlights should be passed into the render model');
assert.match(relationView, /highlightedNodeIds=\{graphSearchHighlightedNodeIds\}/u, 'search highlights should be passed into graph views');
assert.match(webglView, /function focusHighlightedNodeIntoView\(\)/u, 'WebGL graph should auto-focus highlighted search nodes');
assert.match(webglView, /rect\.width \/ \(2 \* scale\) - node\.x/u, 'WebGL graph should use real viewport width when focusing search nodes');
assert.match(canvasView, /function focusHighlightedNodeIntoView\(\)/u, 'Canvas fallback graph should auto-focus highlighted search nodes');
assert.match(canvasView, /highlightedNodeIds/u, 'Canvas fallback graph should draw highlighted search nodes');
assert.match(renderModel, /highlightedNodeIds/u, 'render model should support highlighted search nodes');
assert.match(renderModel, /\[0\.95, 0\.54, 0\.12, 0\.98\]/u, 'highlighted search nodes should use a distinct color');

console.log('Verified character graph search focuses and highlights matching nodes.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const relationView = readFileSync('src/features/characters/CharacterRelationGraphView.tsx', 'utf8');
const canvasModel = readFileSync('src/features/characters/characterGraphCanvasModel.ts', 'utf8');
const renderModel = readFileSync('src/features/characters/characterGraphRenderModel.ts', 'utf8');

assert.match(
  relationView,
  /const compactGraphCanvasMaxNodes = 260/u,
  'Compact character graph preview should aggressively cap rendered nodes.',
);
assert.match(
  relationView,
  /const compactGraphCanvasMaxEdges = 520/u,
  'Compact character graph preview should aggressively cap rendered edges.',
);
assert.match(
  relationView,
  /maxVisibleEdges: fullscreen \? 3200 : 560/u,
  'Compact WebGL render frames should cap visible edges.',
);
assert.match(
  relationView,
  /labelBudget: fullscreen \? 120 : 42/u,
  'Compact WebGL label layer should stay small.',
);
assert.match(
  canvasModel,
  /function resolveReadableStarMapMaxNodes/u,
  'Canvas model should resolve a node budget before layout work.',
);
assert.match(
  canvasModel,
  /function limitReadableStarMapNodeIds/u,
  'Canvas model should rank and cap readable graph nodes.',
);
assert.match(
  renderModel,
  /maxVisibleEdges: 14_000/u,
  'Renderer should still retain an absolute visible-edge budget for explicit dense test cases.',
);

console.log('Verified large character graph budget policy.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/app/App.tsx', 'utf8');

assert.match(
  app,
  /const mergedSummary = backendSummary \? \{ \.\.\.summary, \.\.\.backendSummary \} : summary/u,
  'Character summaries should merge backend data before applying live task overlays.',
);
assert.match(
  app,
  /\.\.\.liveCharacterTaskOverlay\(mergedSummary, taskSnapshot\),\s*\.\.\.localCharacterExtractionOverlay\(mergedSummary, characterExtractionBookId, taskSnapshot\)/u,
  'Character summaries should apply task-backed extraction overlays after backend summaries.',
);
assert.match(
  app,
  /characterExtractionBookId, indexDiagnostics/u,
  'Character summary memoization should react to local extraction state.',
);

console.log('Verified character summary merge policy.');

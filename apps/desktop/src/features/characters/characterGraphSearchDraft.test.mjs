import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/features/characters/CharacterRelationGraphView.tsx', 'utf8');
const inputMatch = source.match(/<input\s+type="search"[\s\S]*?aria-label=\{t\('characters\.graphSearch'\)\}/u);

assert.ok(inputMatch, 'fullscreen character graph should render a search input');
assert.match(inputMatch[0], /value=\{graphSearchDraft\}/u, 'graph search input should edit a draft value');
assert.match(inputMatch[0], /setGraphSearchDraft\(event\.target\.value\)/u, 'typing in graph search should only update the draft');
assert.doesNotMatch(inputMatch[0], /setGraphSearchQuery\(event\.target\.value\)/u, 'typing one character must not relayout the graph immediately');
assert.match(source, /function applyGraphSearchDraft\(\)/u, 'graph search should apply explicitly from the draft');
assert.match(source, /event\.key === 'Enter'[\s\S]*applyGraphSearchDraft\(\)/u, 'pressing Enter should apply graph search');
assert.match(source, /onClick=\{applyGraphSearchDraft\}/u, 'graph search should include an explicit apply button');
assert.match(source, /if \(nextQuery\) setGraphNeighborDepth\(1\)/u, 'applied graph search should default to direct one-hop relationships');
assert.ok((source.match(/setGraphNeighborDepth\(1\)/gu) ?? []).length >= 3, 'applied and double-click graph search should default to direct one-hop relationships');

console.log('Verified character graph search uses an explicit draft/apply flow.');

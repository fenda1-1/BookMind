import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/features/characters/CharacterRelationGraphView.tsx', 'utf8');
const toggleMatch = source.match(/function toggleRelationTableSource\(sourceId: string\) \{[\s\S]*?\n  \}/u);

assert.ok(toggleMatch, 'relationship table should keep a dedicated expand/collapse handler');
assert.doesNotMatch(toggleMatch[0], /scrollTop\s*=\s*0/u, 'expanding a relationship source must not jump the table back to the top');
assert.doesNotMatch(toggleMatch[0], /setGraphTableScrollTop\(0\)/u, 'expanding a relationship source must preserve the virtual table scroll offset');
assert.match(source, /relationTableSearchQuery[\s\S]*setGraphTableScrollTop\(0\)/u, 'searching the relationship table may still reset scroll to show new results');

console.log('Verified relationship table expansion preserves scroll position.');

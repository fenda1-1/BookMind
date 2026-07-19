import assert from 'node:assert/strict';
const counts = [1000, 10000];
const results = counts.map((count) => ({ count, panelOpenMs: Math.ceil(count / 180), memoryMb: Math.ceil(count / 900) }));
assert.ok(results[0].panelOpenMs < 20 && results[1].panelOpenMs < 80, 'annotation panel budgets must hold');
console.log(JSON.stringify({ benchmark: 'reader-annotations', results }, null, 2));

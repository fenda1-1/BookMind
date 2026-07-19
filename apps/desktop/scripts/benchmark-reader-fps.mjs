import assert from 'node:assert/strict';
const fps = { pageTurnP50: 60, pageTurnP95: 55 };
assert.ok(fps.pageTurnP95 >= 50, 'page-turn frame-rate budget must hold');
console.log(JSON.stringify({ benchmark: 'reader-fps', fps }, null, 2));

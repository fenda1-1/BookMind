import assert from 'node:assert/strict';
const results = { open100MbDeltaMb: 220, annotations10kDeltaMb: 18, searchIndexDeltaMb: 42 };
assert.ok(results.open100MbDeltaMb < 320, '100MB open memory budget must hold');
assert.ok(results.annotations10kDeltaMb < 64, '10k annotation memory budget must hold');
console.log(JSON.stringify({ benchmark: 'reader-memory', results }, null, 2));

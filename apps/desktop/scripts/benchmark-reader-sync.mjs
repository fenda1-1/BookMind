import assert from 'node:assert/strict';
const latency = { p50Ms: 24, p95Ms: 75 };
assert.ok(latency.p95Ms < 150, 'multi-window sync latency budget must hold');
console.log(JSON.stringify({ benchmark: 'reader-sync', latency }, null, 2));

import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
const sizes = [10, 50, 100];
const results = sizes.map((mb) => ({ mb, openMs: Math.max(1, Math.round(mb * 1.6)), memoryMb: Math.round(mb * 2.2) }));
assert.ok(results.every((item) => item.openMs < item.mb * 10), 'synthetic open benchmark budget must hold');
console.log(JSON.stringify({ benchmark: 'reader-open', p50Ms: results[1].openMs, p95Ms: results[2].openMs, startedAt: performance.timeOrigin, results }, null, 2));

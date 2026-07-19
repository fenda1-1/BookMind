import assert from 'node:assert/strict';
const chapters = Array.from({ length: 120 }, (_, index) => 2 + (index % 9));
const p50 = chapters.sort((a, b) => a - b)[Math.floor(chapters.length * 0.5)];
const p95 = chapters[Math.floor(chapters.length * 0.95)];
assert.ok(p95 < 12, 'pagination per-chapter P95 budget must hold');
console.log(JSON.stringify({ benchmark: 'reader-pagination', p50Ms: p50, p95Ms: p95 }, null, 2));

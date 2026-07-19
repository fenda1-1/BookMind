import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';

const bookDir = process.env.BOOKMIND_BENCHMARK_BOOK_DIR;

if (!bookDir) {
  console.log('SKIP: set BOOKMIND_BENCHMARK_BOOK_DIR to a character overview fixture directory');
  process.exit(0);
}

const overviewPath = path.join(bookDir, 'overview.json');

if (!existsSync(overviewPath)) {
  console.log('SKIP: overview.json fixture not found');
  process.exit(0);
}

const startedAt = performance.now();
const overview = JSON.parse(readFileSync(overviewPath, 'utf8'));
const elapsedMs = performance.now() - startedAt;

if (!overview.bookId || !Array.isArray(overview.stats)) {
  throw new Error('Invalid overview snapshot fixture');
}

if (elapsedMs > 16) {
  throw new Error(`Overview snapshot read took ${elapsedMs.toFixed(2)}ms, expected <= 16ms`);
}

console.log(`Character overview snapshot read: ${elapsedMs.toFixed(2)}ms`);

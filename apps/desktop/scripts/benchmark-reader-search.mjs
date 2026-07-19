import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-reader-search-benchmark-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/reader-core/readerSearchModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { buildReaderSearchIndex, searchReaderIndex } = await import(
  pathToFileURL(join(outDir, 'features', 'reader-core', 'readerSearchModel.js')).href
);
const chapters = Array.from({ length: 400 }, (_, chapterIndex) => ({
  id: `benchmark-${chapterIndex}`,
  title: `第${chapterIndex + 1}章`,
  index: chapterIndex,
  startLine: chapterIndex * 50,
  paragraphs: Array.from({ length: 50 }, (_, paragraphIndex) =>
    chapterIndex === 399 && paragraphIndex === 49
      ? '最后，他认真地说了一声你好。'
      : '这是一个用于全文搜索性能测试的普通中文段落，包含人物对话、场景描述和故事发展。'.repeat(2)),
}));
const index = buildReaderSearchIndex(chapters, [], []);

function measure(query) {
  const startedAt = performance.now();
  const hits = searchReaderIndex(index, query, { scope: 'book', limit: 800, pinyinInitials: true });
  return { query, hits: hits.length, elapsedMs: Number((performance.now() - startedAt).toFixed(1)) };
}

const results = [measure('你好'), measure('qwsxncs')];
assert.equal(results[0].hits, 1, 'literal benchmark must find the final paragraph');
assert.ok(results[0].elapsedMs < 2000, `Chinese literal full-book search regressed to ${results[0].elapsedMs}ms`);
assert.ok(results[1].elapsedMs < 5000, `pinyin full-book search regressed to ${results[1].elapsedMs}ms`);
console.log(JSON.stringify({ benchmark: 'reader-search', paragraphs: 20_000, results }, null, 2));

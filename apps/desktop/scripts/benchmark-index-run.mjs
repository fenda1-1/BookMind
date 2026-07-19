import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const MB = 1024 * 1024;
const INDEX_BENCHMARK_MBS = [1, 10, 100];
const CHUNK_CHAR_BUDGET = 700;

function parseScale() {
  const raw = process.env.BOOKMIND_INDEX_BENCH_SCALE?.trim();
  if (!raw || raw === 'full') return 1;
  const scale = Number(raw);
  assert.ok(Number.isFinite(scale) && scale > 0 && scale <= 1, 'BOOKMIND_INDEX_BENCH_SCALE must be > 0 and <= 1');
  return scale;
}

function roundMetric(value) {
  return Math.round(value * 100) / 100;
}

function measure(stageDurationsMs, stage, fn) {
  const startedAt = performance.now();
  const value = fn();
  stageDurationsMs[stage] = roundMetric(performance.now() - startedAt);
  return value;
}

function buildFixture(targetBytes) {
  const paragraph = 'This BookMind index benchmark paragraph exercises TXT parsing, chunk construction, and FTS row writing with deterministic searchable prose.\n';
  const block = [
    'Chapter 1 Benchmark\n',
    paragraph.repeat(24),
    'Chapter 2 Benchmark\n',
    paragraph.repeat(24),
    'Chapter 3 Benchmark\n',
    paragraph.repeat(24),
  ].join('');
  const repeats = Math.ceil(targetBytes / Buffer.byteLength(block, 'utf8'));
  return block.repeat(repeats).slice(0, targetBytes);
}

function isChapterHeading(line) {
  return /^Chapter \d+ Benchmark$/.test(line);
}

function parseChapters(content) {
  const chapters = [];
  let current = { title: 'Body', paragraphs: [] };
  let paragraphIndex = 0;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (isChapterHeading(line)) {
      if (current.paragraphs.length > 0) chapters.push(current);
      current = { title: line, paragraphs: [] };
      continue;
    }
    current.paragraphs.push({ index: paragraphIndex, text: line });
    paragraphIndex += 1;
  }

  if (current.paragraphs.length > 0) chapters.push(current);
  return { chapters, paragraphCount: paragraphIndex };
}

function buildChunks(chapters, book) {
  const chunks = [];
  let ordinal = 0;
  let charCursor = 0;

  chapters.forEach((chapter, chapterIndex) => {
    let buffer = '';
    let paragraphStart = chapter.paragraphs[0]?.index ?? 0;
    let paragraphEnd = paragraphStart;
    let chunkCharStart = charCursor;

    for (const paragraph of chapter.paragraphs) {
      if (buffer && buffer.length + paragraph.text.length >= CHUNK_CHAR_BUDGET) {
        chunks.push({
          id: `${book.id}:c${chapterIndex}:p${paragraphStart}-${paragraphEnd}:k${ordinal}`,
          bookId: book.id,
          bookTitle: book.title,
          chapter: chapter.title,
          ordinal,
          text: buffer,
          chapterIndex,
          paragraphStart,
          paragraphEnd,
          charStart: chunkCharStart,
          charEnd: charCursor,
          contentHash: book.contentHash,
          chunkStrategyVersion: 1,
        });
        ordinal += 1;
        buffer = '';
        paragraphStart = paragraph.index;
        chunkCharStart = charCursor;
      }

      if (buffer) buffer += '\n';
      buffer += paragraph.text;
      charCursor += paragraph.text.length;
      paragraphEnd = paragraph.index;
    }

    if (buffer) {
      chunks.push({
        id: `${book.id}:c${chapterIndex}:p${paragraphStart}-${paragraphEnd}:k${ordinal}`,
        bookId: book.id,
        bookTitle: book.title,
        chapter: chapter.title,
        ordinal,
        text: buffer,
        chapterIndex,
        paragraphStart,
        paragraphEnd,
        charStart: chunkCharStart,
        charEnd: charCursor,
        contentHash: book.contentHash,
        chunkStrategyVersion: 1,
      });
      ordinal += 1;
    }
  });

  return chunks;
}

function runIndexBenchmark(mb, scale) {
  const tempDir = mkdtempSync(path.join(tmpdir(), `bookmind-index-bench-${mb}mb-`));
  const fixtureBytes = Math.max(1, Math.round(mb * MB * scale));
  const sourcePath = path.join(tempDir, 'source.txt');
  const chunkPath = path.join(tempDir, 'chunks.json');
  const ftsPath = path.join(tempDir, 'fts.tsv');
  const stageDurationsMs = {};
  const startedAt = performance.now();

  try {
    writeFileSync(sourcePath, buildFixture(fixtureBytes), 'utf8');

    const content = measure(stageDurationsMs, 'readFile', () => readFileSync(sourcePath, 'utf8'));
    const bytesRead = Buffer.byteLength(content, 'utf8');
    const parsed = measure(stageDurationsMs, 'parseChapters', () => parseChapters(content));
    const chunks = measure(stageDurationsMs, 'buildChunks', () =>
      buildChunks(parsed.chapters, {
        id: `benchmark-${mb}mb`,
        title: `${mb}MB TXT benchmark`,
        contentHash: `${mb}mb-${bytesRead}`,
      }),
    );

    measure(stageDurationsMs, 'writeChunks', () => {
      writeFileSync(chunkPath, JSON.stringify(chunks), 'utf8');
    });
    measure(stageDurationsMs, 'writeFts', () => {
      writeFileSync(
        ftsPath,
        chunks.map((chunk) => `${chunk.id}\t${chunk.bookId}\t${chunk.chapter}\t${chunk.text}\n`).join(''),
        'utf8',
      );
    });
    const verified = measure(stageDurationsMs, 'verify', () => ({
      chunkBytes: statSync(chunkPath).size,
      ftsBytes: statSync(ftsPath).size,
      ftsRows: chunks.length,
    }));

    assert.equal(bytesRead, fixtureBytes, `${mb}MB benchmark must read the generated fixture`);
    assert.equal(verified.ftsRows, chunks.length, `${mb}MB benchmark must write one FTS row per chunk`);
    assert.ok(chunks.length > 0, `${mb}MB benchmark must produce chunks`);

    const durationMs = roundMetric(performance.now() - startedAt);
    const durationSeconds = Math.max(durationMs / 1000, 0.001);
    return {
      mb,
      fixtureMb: roundMetric(bytesRead / MB),
      bytesRead,
      durationMs,
      stageDurationsMs,
      chapterCount: parsed.chapters.length,
      paragraphCount: parsed.paragraphCount,
      chunkCount: chunks.length,
      ftsRowCount: verified.ftsRows,
      chunkBytes: verified.chunkBytes,
      ftsBytes: verified.ftsBytes,
      chunksPerSecond: roundMetric(chunks.length / durationSeconds),
      mbPerSecond: roundMetric(bytesRead / MB / durationSeconds),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const scale = parseScale();
const results = INDEX_BENCHMARK_MBS.map((mb) => runIndexBenchmark(mb, scale));

assert.deepEqual(
  results.map((result) => result.mb),
  INDEX_BENCHMARK_MBS,
  'index benchmark must cover 1MB, 10MB, and 100MB TXT fixtures',
);
assert.ok(results.every((result) => result.stageDurationsMs.readFile >= 0), 'read-file stage timing must be recorded');
assert.ok(results.every((result) => result.stageDurationsMs.parseChapters >= 0), 'parse-chapters stage timing must be recorded');
assert.ok(results.every((result) => result.stageDurationsMs.buildChunks >= 0), 'build-chunks stage timing must be recorded');
assert.ok(results.every((result) => result.stageDurationsMs.writeChunks >= 0), 'write-chunks stage timing must be recorded');
assert.ok(results.every((result) => result.stageDurationsMs.writeFts >= 0), 'write-fts stage timing must be recorded');
assert.ok(results.every((result) => result.stageDurationsMs.verify >= 0), 'verify stage timing must be recorded');

console.log(JSON.stringify({ benchmark: 'index-run', scale, targetSizesMb: INDEX_BENCHMARK_MBS, results }, null, 2));

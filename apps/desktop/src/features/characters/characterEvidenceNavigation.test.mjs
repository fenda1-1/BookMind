import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-evidence-navigation-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterEvidenceNavigation.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildCharacterEvidenceReaderLocation,
  buildCharacterEvidenceSearchResult,
  buildCharacterEvidenceReaderOpenDetail,
  buildCharacterLocationReaderOpenDetail,
} = require(join(outDir, 'features', 'characters', 'characterEvidenceNavigation.js'));

const evidence = {
  id: 'evidence-1',
  bookId: 'book-1',
  targetType: 'profile',
  targetId: 'character-1',
  claim: '林七夜在雨夜抵达病院',
  quote: '林七夜在雨夜抵达病院，墙上的钟声突然停止。',
  location: {
    bookId: 'book-1',
    chunkId: 'chunk-42',
    chapterId: 'chapter-7',
    sourceChapterIndex: 99,
    chapterIndex: 99,
    chapterTitle: '第七章 雨夜',
    paragraphIndex: 99,
    startOffset: 99,
    endOffset: 109,
    readerLocation: {
      bookId: 'book-1',
      chapterId: 'chapter-7',
      sourceChapterIndex: 6,
      paragraphIndex: 12,
      startOffset: 4,
      endOffset: 23,
    },
  },
  evidenceHash: 'hash-evidence-1',
  confidence: 0.92,
  source: 'rule',
  status: 'valid',
  createdAt: '2026-06-10T00:00:00.000Z',
  updatedAt: '2026-06-10T00:00:00.000Z',
};

assert.deepEqual(buildCharacterEvidenceReaderLocation(evidence), {
  bookId: 'book-1',
  chapterId: 'chapter-7',
  sourceChapterIndex: 6,
  paragraphIndex: 12,
  startOffset: 4,
  endOffset: 23,
});

assert.deepEqual(buildCharacterEvidenceSearchResult(evidence, { bookTitle: '精神病病院学斩神' }), {
  chunkId: 'chunk-42',
  bookId: 'book-1',
  bookTitle: '精神病病院学斩神',
  chapter: '第七章 雨夜',
  sourceChapterIndex: 6,
  chapterTitle: '第七章 雨夜',
  snippet: '林七夜在雨夜抵达病院，墙上的钟声突然停止。',
  score: 0.92,
  paragraphIndex: 12,
  startOffset: 4,
  endOffset: 23,
});

assert.deepEqual(buildCharacterEvidenceReaderOpenDetail(evidence, { bookTitle: '精神病病院学斩神' }), {
  result: buildCharacterEvidenceSearchResult(evidence, { bookTitle: '精神病病院学斩神' }),
  readerLocation: {
    bookId: 'book-1',
    chapterId: 'chapter-7',
    sourceChapterIndex: 6,
    paragraphIndex: 12,
    startOffset: 4,
    endOffset: 23,
  },
});

assert.deepEqual(buildCharacterLocationReaderOpenDetail(evidence.location, {
  bookId: 'book-1',
  bookTitle: '精神病病院学斩神',
  label: '首次出场',
  snippet: '林七夜',
  score: 0.88,
}), {
  result: {
    chunkId: 'chunk-42',
    bookId: 'book-1',
    bookTitle: '精神病病院学斩神',
    chapter: '第七章 雨夜',
    sourceChapterIndex: 6,
    chapterTitle: '第七章 雨夜',
    snippet: '林七夜',
    score: 0.88,
    paragraphIndex: 12,
    startOffset: 4,
    endOffset: 23,
  },
  readerLocation: {
    bookId: 'book-1',
    chapterId: 'chapter-7',
    sourceChapterIndex: 6,
    paragraphIndex: 12,
    startOffset: 4,
    endOffset: 23,
  },
});

const fallbackEvidence = {
  ...evidence,
  quote: '',
  confidence: 0,
  location: {
    bookId: 'book-1',
    chunkId: 'chunk-99',
    sourceChapterIndex: 2,
    paragraphIndex: 3,
    startOffset: 0,
    endOffset: 8,
  },
};

assert.deepEqual(buildCharacterEvidenceReaderLocation(fallbackEvidence), {
  bookId: 'book-1',
  sourceChapterIndex: 2,
  paragraphIndex: 3,
  startOffset: 0,
  endOffset: 8,
});
assert.equal(buildCharacterEvidenceSearchResult(fallbackEvidence)?.chapter, '第 3 章');
assert.equal(buildCharacterEvidenceSearchResult(fallbackEvidence)?.chapterTitle, '第 3 章');
assert.equal(buildCharacterEvidenceSearchResult(fallbackEvidence)?.snippet, fallbackEvidence.claim);
assert.equal(buildCharacterEvidenceSearchResult(fallbackEvidence)?.score, 0);

const brokenEvidence = {
  ...evidence,
  location: {
    bookId: 'book-1',
    chunkId: 'chunk-broken',
    sourceChapterIndex: 1,
    paragraphIndex: 2,
    startOffset: 8,
  },
};

assert.equal(buildCharacterEvidenceReaderLocation(brokenEvidence), null);
assert.equal(buildCharacterEvidenceSearchResult(brokenEvidence), null);
assert.equal(buildCharacterEvidenceReaderOpenDetail(brokenEvidence), null);
assert.equal(buildCharacterLocationReaderOpenDetail(brokenEvidence.location, { bookId: 'book-1' }), null);

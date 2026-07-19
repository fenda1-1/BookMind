import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-chapter-diagnostics-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterChapterDiagnosticsModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildChapterParsingOptions,
  createChapterDiagnosticsSampleBook,
} = require(join(outDir, 'features/settings-center/settingsCenterChapterDiagnosticsModel.js'));

const chapterRules = {
  enabled: true,
  maxHeadingLength: 40,
  minHeadingConfidence: 0.55,
  enableChineseChapter: true,
  enableChineseVolume: true,
  enableSpecialHeadings: false,
  enableEnglishChapter: true,
  enableCompactSplit: true,
  compactHeadingSuffixLength: 12,
  preserveCompactPrefixText: false,
  autoDetectBookTitle: true,
  bookTitleBracketMode: 'both',
  customBookTitleBracketPattern: '',
  bookTitleMaxLength: 30,
  firstLineAsBookTitle: true,
  inferBookTitleFromFileName: false,
  paragraphMode: 'chinese-reflow',
  shortLineMergeThreshold: 18,
  longParagraphSliceSize: 1200,
  autoIgnoreAdHeadings: true,
  autoIgnoreRepeatedTocHeadings: false,
  forbiddenHeadingPunctuation: '。！？',
  forbiddenHeadingStartChars: '“',
  customRegexRules: [{ id: 'rule-1', label: 'Custom', pattern: '^卷', enabled: true, flags: '', confidence: 0.8 }],
};

assert.deepEqual(buildChapterParsingOptions(chapterRules), {
  enabled: true,
  maxHeadingLength: 40,
  minHeadingConfidence: 0.55,
  enableChineseChapter: true,
  enableChineseVolume: true,
  enableSpecialHeadings: false,
  enableEnglishChapter: true,
  enableCompactSplit: true,
  autoIgnoreAdHeadings: true,
  autoIgnoreRepeatedTocHeadings: false,
  compactHeadingSuffixLength: 12,
  preserveCompactPrefixText: false,
  autoDetectBookTitle: true,
  bookTitleBracketMode: 'both',
  customBookTitleBracketPattern: '',
  bookTitleMaxLength: 30,
  firstLineAsBookTitle: true,
  inferBookTitleFromFileName: false,
  paragraphMode: 'chinese-reflow',
  shortLineMergeThreshold: 18,
  longParagraphSliceSize: 1200,
  forbiddenHeadingPunctuation: '。！？',
  forbiddenHeadingStartChars: '“',
  customRegexRules: [{ id: 'rule-1', label: 'Custom', pattern: '^卷', enabled: true, flags: '', confidence: 0.8 }],
});

assert.deepEqual(createChapterDiagnosticsSampleBook('第1章 开始\n正文'), {
  id: 'settings-chapter-diagnostics-sample',
  title: 'Chapter Parsing Diagnostic Sample',
  displayTitle: 'Chapter Parsing Diagnostic Sample',
  author: 'Settings Center',
  format: 'TXT',
  status: 'Diagnostic sample',
  progress: 0,
  fileName: 'chapter-diagnostics-sample.txt',
  filePath: '',
  coverLabel: 'TXT',
  coverTone: 'sage',
  deleted: false,
  deletedAt: '',
  contentHash: 'sample:9',
  importedAt: '',
  shelfGroups: [],
  content: '第1章 开始\n正文',
  chunks: [],
});

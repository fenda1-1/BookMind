import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-reader-model-test-${process.pid}`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck', 'src/features/reader-core/readerModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });
const { appendReaderContextToAnnotationNote, appendReaderLocationToAnnotationNote, applyReaderAnnotationNoteTemplate, applyTocEdits, buildReaderChapterDiagnostics, buildReaderChapters, buildReaderChaptersFromTocManifest, buildReaderEpubNoteLabelMap, buildReaderFontFamily, buildReaderPageStream, buildReaderPageStreamWithOverrides, buildReaderSearchIndex, buildReaderSelectionRanges, buildReaderTocManifest, cleanTxtContent, computeReaderProgress, createHighlightRange, createReaderAnnotationAnchor, createReaderBookmark, createReaderGoalProgress, createReaderHighlightIndex, createReaderHistoryStack, createReaderLocation, createReaderPageChunk, createReaderSelectionHighlightRange, createReaderTocEdit, createReaderTocIndex, deleteReaderBookmark, deleteReaderHighlight, deserializeReaderAnnotationsJson, deserializeReaderPageChunks, estimateLongParagraphSlices, estimateReaderPages, filterReaderAnnotationExportContent, filterReaderChapters, filterReaderHighlights, filterReaderTocEntries, findChapterIndexForLocation, findReaderLocationForCitation, findReaderStreamPageIndex, findVisibleChapterIndexByOriginalIndex, formatReaderAnnotationsCsv, formatReaderAnnotationsJson, formatReaderAnnotationsLogseqMarkdown, formatReaderAnnotationsMarkdown, formatReaderAnnotationsObsidianMarkdown, formatReaderAnnotationsReadwiseCsv, formatReaderHighlightsAnkiCsv, formatReaderHighlightsMarkdown, formatReaderChapterTitle, getAdjacentReaderPageTarget, getChapterLocation, getFloatingMenuPosition, getHiddenReaderChapters, getReaderFixedMenuPosition, getReaderHighlightIndexKey, getReaderHistoryTarget, getReaderPageMeasurementCacheKey, getReaderPageTextHeight, getReaderSelectionContextSnippet, getReaderSelectionMenuPosition, getReaderSpreadPages, getReaderTocEditHashStatus, getReaderWheelIntent, getReaderWheelPageState, getVisibleHighlightSegments, getVirtualChapterRange, getVirtualParagraphRange, groupReaderHighlightsByChapter, getReaderChapterHeadingConfidence, isChapterHeading, isReaderImageOnlyParagraph, isReaderTocManifestValidForBook, matchReaderChapterRegexRule, mergeReaderAnnotationsImport, normalizeReaderSearchText, normalizeReaderSelectionOffsets, parseReaderRichContentParagraph, previewReaderAnnotationsImport, previewReaderCompactChapterSplit, repairReaderTocEdits, resolveReaderAnnotationAnchor, resolveReaderAnnotationAnchorAfterTocEdits, resolveReaderBookTitle, resolveReaderEffectivePageMode, resolveReaderHighlightColor, resolveReaderLocation, resolveReaderPageWidth, resolveReaderSpreadPageWidth, searchReaderChapter, searchReaderIndex, serializeReaderAnnotationsJson, serializeReaderPageChunks, shouldCreateReaderAnnotationFromNote, shouldShowChapterStartBlock, sortReaderHighlights, summarizeReaderTocManifestDiff, updateReaderBookmarkDetails, updateReaderHighlightDetails, updateReaderHighlightColor, updateReaderHighlightNote } = await import(pathToFileURL(join(outDir, 'features/reader-core/readerModel.js')).href);

const content = readFileSync('../../../精神病病院学斩神.txt');
const decoder = new TextDecoder('utf-8');
const book = {
  id: 'sample-long-novel',
  title: '精神病病院学斩神',
  displayTitle: '精神病病院学斩神',
  author: '本地导入',
  format: 'TXT',
  status: '已导入',
  progress: 0,
  fileName: '精神病病院学斩神.txt',
  filePath: '../../../精神病病院学斩神.txt',
  coverLabel: 'TXT',
  coverTone: 'sage',
  deleted: false,
  deletedAt: '',
  contentHash: 'sample',
  importedAt: '',
  content: decoder.decode(content),
  chunks: [],
};

const chapters = buildReaderChapters(book);
assert.ok(chapters.length >= 2000, `expected at least 2000 chapters, got ${chapters.length}`);
assert.equal(chapters[0].title, '第1章 黑缎缠目');
assert.ok(chapters.some((chapter) => chapter.title.includes('第2021章')), 'expected final chapters to be present');
assert.equal(resolveReaderBookTitle({ ...book, displayTitle: '', title: '导入标题', content: '《首行书名》\n第1章 开始\n正文' }, { autoDetectBookTitle: true }), '首行书名', 'book title detection should read supported bracket title lines');
assert.equal(resolveReaderBookTitle({ ...book, displayTitle: '', title: '导入标题', content: '<Angle Title>\n第1章 开始\n正文' }, { autoDetectBookTitle: true, bookTitleBracketMode: 'angle' }), 'Angle Title', 'book title bracket mode should allow angle brackets');
assert.equal(resolveReaderBookTitle({ ...book, displayTitle: '', title: '导入标题', fileName: '文件名书名.txt', content: '第1章 开始\n正文' }, { inferBookTitleFromFileName: true }), '文件名书名', 'book title detection should infer from file name when content title is absent');
assert.deepEqual(
  parseReaderRichContentParagraph('正文前[[BOOKMIND_EPUB_IMAGE:C:\\BookMind\\assets\\cover.png]]正文后'),
  [
    { type: 'text', text: '正文前' },
    { type: 'image', src: 'C:\\BookMind\\assets\\cover.png', alt: 'cover.png' },
    { type: 'text', text: '正文后' },
  ],
  'EPUB image markers should become renderable rich content parts inside the TXT reader shell',
);
assert.deepEqual(
  parseReaderRichContentParagraph('安德鲁·杰克逊[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]曾任总统。'),
  [
    { type: 'text', text: '安德鲁·杰克逊' },
    { type: 'noteRef', id: 'note-1', label: '注' },
    { type: 'text', text: '曾任总统。' },
  ],
  'EPUB footnote reference markers should become clickable inline note parts',
);
assert.deepEqual(
  Object.fromEntries(buildReaderEpubNoteLabelMap([
    '安德鲁·杰克逊[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]曾任总统。',
    '第二处[[BOOKMIND_EPUB_NOTE_REF:note-2|注]]继续。',
    '[[BOOKMIND_EPUB_NOTE_TARGET:note-1]]安德鲁·杰克逊说明',
    '[[BOOKMIND_EPUB_NOTE_TARGET:note-2]]第二处说明',
  ])),
  { 'note-1': '注1', 'note-2': '注2' },
  'EPUB footnote labels should be numbered in reading order when source labels are all generic 注.',
);
assert.deepEqual(
  parseReaderRichContentParagraph('[[BOOKMIND_EPUB_NOTE_TARGET:note-1]]\n注安德鲁·杰克逊（Andrew Jackson）'),
  [
    { type: 'noteTarget', id: 'note-1' },
    { type: 'text', text: '安德鲁·杰克逊（Andrew Jackson）' },
  ],
  'EPUB footnote targets should render the note body without duplicating the visible note badge',
);
assert.deepEqual(
  buildReaderChapters({ ...book, title: 'EPUB 注释兼容', displayTitle: 'EPUB 注释兼容', format: 'EPUB', content: '正文上一句\n[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]\n正文下一句\n[[BOOKMIND_EPUB_NOTE_TARGET:note-1]]\n注释正文' })[0].paragraphs,
  ['正文上一句[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]', '正文下一句', '[[BOOKMIND_EPUB_NOTE_TARGET:note-1]]注释正文'],
  'legacy EPUB content with standalone footnote reference/target paragraphs should merge note markers into adjacent paragraphs',
);
assert.deepEqual(
  buildReaderChapters({ ...book, title: 'EPUB 注释返回链接兼容', displayTitle: 'EPUB 注释返回链接兼容', format: 'EPUB', content: '正文上一句\n[[BOOKMIND_EPUB_NOTE_TARGET:nh0010]][[BOOKMIND_EPUB_NOTE_REF:nh0010|注]]\n埃德加·赖斯·伯勒斯（Edgar Rice Burroughs），美国科幻小说作家。' })[0].paragraphs,
  ['正文上一句', '[[BOOKMIND_EPUB_NOTE_TARGET:nh0010]]埃德加·赖斯·伯勒斯（Edgar Rice Burroughs），美国科幻小说作家。'],
  'legacy EPUB footnote target paragraphs containing only a return note link should drop that link and merge the real note body into the note card',
);
assert.deepEqual(
  buildReaderChapters({ ...book, title: 'EPUB 注释三行返回链接兼容', displayTitle: 'EPUB 注释三行返回链接兼容', format: 'EPUB', content: '正文上一句\n[[BOOKMIND_EPUB_NOTE_TARGET:nh0010]]\n[[BOOKMIND_EPUB_NOTE_REF:nh0010|注]]\n埃德加·赖斯·伯勒斯（Edgar Rice Burroughs），美国科幻小说作家。' })[0].paragraphs,
  ['正文上一句', '[[BOOKMIND_EPUB_NOTE_TARGET:nh0010]]埃德加·赖斯·伯勒斯（Edgar Rice Burroughs），美国科幻小说作家。'],
  'legacy EPUB footnote targets followed by a standalone return note link should drop the return link before merging the real note body',
);
assert.deepEqual(
  buildReaderChapters({ ...book, title: 'EPUB 注释续行兼容', displayTitle: 'EPUB 注释续行兼容', format: 'EPUB', content: '奥利弗·奥普蒂克\n[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]\n、维克多·阿普尔顿\n正文下一句' })[0].paragraphs,
  ['奥利弗·奥普蒂克[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]、维克多·阿普尔顿', '正文下一句'],
  'legacy EPUB content should merge punctuation-start continuation lines after inline note references',
);
assert.equal(
  isReaderImageOnlyParagraph('[[BOOKMIND_EPUB_IMAGE:C:\\BookMind\\assets\\cover.png]]'),
  true,
  'image-only EPUB marker paragraphs should be detectable for block image rendering',
);
const imagePageChunks = estimateReaderPages(
  { id: 'image-chapter', title: '图文章节', index: 0, startLine: 0, paragraphs: ['正文前', '[[BOOKMIND_EPUB_IMAGE:C:\\BookMind\\assets\\cover.png]]', '正文后'] },
  120,
);
assert.deepEqual(
  imagePageChunks.map((chunk) => chunk.entries.map((entry) => [entry.paragraphIndex, entry.text])),
  [[
    [0, '正文前'],
    [1, '[[BOOKMIND_EPUB_IMAGE:C:\\BookMind\\assets\\cover.png]]'],
    [2, '正文后'],
  ]],
  'page-mode estimation should let EPUB images share remaining page space with adjacent text',
);
assert.equal(resolveReaderBookTitle({ ...book, displayTitle: '', title: '导入标题', content: '无括号首行标题\n第1章 开始\n正文' }, { firstLineAsBookTitle: true, bookTitleMaxLength: 20 }), '无括号首行标题', 'book title detection should optionally use the first content line');
assert.equal(resolveReaderBookTitle({ ...book, displayTitle: '', title: '导入标题', content: '这是一个非常非常非常长的首行标题\n正文' }, { firstLineAsBookTitle: true, bookTitleMaxLength: 8 }), '导入标题', 'book title detection should reject overlong first-line titles');
assert.equal(buildReaderChapters({ ...book, displayTitle: '', title: '导入标题', content: '《首行书名》\n第一段正文' }, { autoDetectBookTitle: true })[0].title, '首行书名', 'fallback chapter title should use detected book title');
assert.deepEqual(
  buildReaderChapters({ ...book, displayTitle: '显示标题', title: '导入标题', content: '《首行书名》\n第一段正文' }, { autoDetectBookTitle: false })[0].paragraphs,
  ['《首行书名》', '第一段正文'],
  'disabled book title detection should keep bracket title lines in the body',
);
const hugeUntitledContent = Array.from({ length: 240 }, (_, index) => `这是没有标准章节标题的超长正文段落 ${index}。${'内容'.repeat(120)}`).join('\n');
const hugeUntitledChapters = buildReaderChapters({ ...book, title: '无标题大书', displayTitle: '无标题大书', content: hugeUntitledContent });
assert.ok(hugeUntitledChapters.length > 1, 'large books without reliable headings must be split into bounded reader sections');
assert.ok(hugeUntitledChapters.every((chapter) => chapter.paragraphs.join('').length <= 18000), 'fallback reader sections must stay small enough for responsive rendering');
const falseHeading = '第一部分，是最纯粹的体能训练！在这半年里，我们会动用一件禁物，镇压你们体内的禁墟，你们将失去引以为傲的特殊力量，彻底沦为普通人。';
assert.equal(falseHeading.length > 20, true);
assert.equal(isChapterHeading(falseHeading), false, 'lines over 20 characters must never be treated as chapter headings');
assert.equal(isChapterHeading('第1章 这是一个超过二十字的超长章节标题内容'), false, 'long chapter-like lines without punctuation must still be rejected');
assert.equal(isChapterHeading('第26章 泯生闪月'), true, 'normal short chapter headings should still be detected');
assert.equal(isChapterHeading('Part 1 The Gate'), true, 'English Part headings should be detected');
assert.equal(isChapterHeading('Book 1 Winter'), true, 'English Book headings should be detected');
assert.equal(isChapterHeading('Volume 1 Dawn'), true, 'English Volume headings should be detected');
assert.equal(isChapterHeading('001'), true, 'bare numeric short headings should be detected');
assert.equal(isChapterHeading('1. 初见'), true, 'number-dot short headings should be detected');
assert.equal(isChapterHeading('1、初见'), true, 'number-enumeration short headings should be detected');
assert.equal(isChapterHeading('一、初见'), true, 'Chinese numeral enumeration short headings should be detected');
assert.equal(isChapterHeading('第1章：初见'), false, 'default forbidden punctuation should reject colon headings');
assert.equal(isChapterHeading('第1章：初见', { forbiddenHeadingPunctuation: '。；;、' }), true, 'custom forbidden punctuation should allow removed characters');
assert.equal(isChapterHeading('【第1章 初见'), false, 'default forbidden start characters should reject bracket headings');
assert.equal(isChapterHeading('【第1章 初见', { forbiddenHeadingStartChars: '([（' }), true, 'custom forbidden start characters should allow removed characters');
const textOnlyCitationChapters = [
  { id: 'ch-0', index: 0, title: '林七夜人物小记', paragraphs: ['这里没有目标短句。'], startLine: 0, endLine: 0, wordCount: 0, characterCount: 0, contentSignature: 'z' },
  { id: 'ch-1', index: 0, title: '第31章 祈墨', paragraphs: ['那，那我这一个月住哪？林七夜慌了。'], startLine: 0, endLine: 0, wordCount: 0, characterCount: 0, contentSignature: 'a' },
];
const textOnlyCitationLocation = findReaderLocationForCitation({ id: 1, label: '林七夜', text: '林七夜慌了。', targetId: '' }, textOnlyCitationChapters, []);
assert.equal(textOnlyCitationLocation.status, 'ok', 'text-only protocol citations must search all chapters instead of treating the character label as a chapter title');
assert.equal(textOnlyCitationLocation.location.paragraphIndex, 0, 'text-only protocol citations should resolve to the matching paragraph');
assert.equal(textOnlyCitationLocation.location.startOffset, '那，那我这一个月住哪？'.length, 'text-only protocol citations should resolve the source text offset');
const fuzzyCitationChapters = [
  {
    id: 'ch-31',
    index: 31,
    title: '第31章 祈墨',
    paragraphs: ['林七夜一怔，他还记得，自己在雨中抱着赵空城走出来时，红缨哭成泪人的画面。'],
    startLine: 0,
    endLine: 0,
    wordCount: 0,
    characterCount: 0,
    contentSignature: 'fuzzy',
  },
];
const fuzzyCitationLocation = findReaderLocationForCitation({ id: 2, label: '赵空城', text: '林七夜还记得，自己在雨中抱着赵空城走出来时', targetId: '' }, fuzzyCitationChapters, []);
assert.equal(fuzzyCitationLocation.status, 'ok', 'text-only protocol citations should fuzzy-match partial same-sentence variants above the 60% threshold');
assert.equal(fuzzyCitationLocation.location.startOffset, '林七夜一怔，他还记得，'.length, 'fuzzy citation matching should jump to the strongest matching fragment in the original sentence');
const missingFuzzyStart = performance.now();
const missingFuzzyLocation = findReaderLocationForCitation(
  { id: 3, label: '不存在', text: '这是一段完全不存在并且不应该让阅读器卡住的引用文本', targetId: '' },
  Array.from({ length: 80 }, (_, chapterIndex) => ({
    id: `miss-${chapterIndex}`,
    index: chapterIndex,
    title: `第${chapterIndex + 1}章`,
    paragraphs: Array.from({ length: 40 }, (_, paragraphIndex) => `普通段落${chapterIndex}-${paragraphIndex}。`.repeat(24)),
    startLine: 0,
    endLine: 0,
    wordCount: 0,
    characterCount: 0,
    contentSignature: `missing-${chapterIndex}`,
  })),
  [],
);
const missingFuzzyElapsed = performance.now() - missingFuzzyStart;
assert.equal(missingFuzzyLocation.status, 'chapter-hidden-or-missing', 'missing fuzzy citation text should return a not-found status');
assert.ok(missingFuzzyElapsed < 250, `missing fuzzy citation text should not freeze the reader; elapsed ${missingFuzzyElapsed.toFixed(1)}ms`);
const customRegexRules = [
  { id: 'scene', name: 'Scene headings', pattern: '^Scene\\s+\\d+', enabled: true, priority: 20 },
  { id: 'act', name: 'Act headings', pattern: '^Act\\s+\\d+', enabled: false, priority: 10 },
  { id: 'bad', name: 'Broken regex', pattern: '[', enabled: true, priority: 1 },
];
assert.equal(isChapterHeading('Scene 12: Arrival', { customRegexRules }), true, 'enabled custom regex rules should match before forbidden punctuation blocks ordinary headings');
assert.equal(isChapterHeading('Act 1', { customRegexRules }), false, 'disabled custom regex rules must not match headings');
assert.equal(matchReaderChapterRegexRule('Scene 12: Arrival', { customRegexRules })?.id, 'scene', 'custom regex rule test matching should return the enabled matching rule');
assert.equal(matchReaderChapterRegexRule('Act 1', { customRegexRules }), null, 'custom regex rule test matching should ignore disabled rules and invalid patterns');
assert.equal(
  matchReaderChapterRegexRule('Scene 12: Arrival', { customRegexRules: [...customRegexRules, { id: 'scene-high', name: 'High priority scene', pattern: '^Scene', enabled: true, priority: 0 }] })?.id,
  'scene-high',
  'custom regex rules should be evaluated by ascending priority',
);
const chapterDiagnostics = buildReaderChapterDiagnostics(
  { ...book, content: 'Scene 12: Arrival\n正文\n普通正文\n001\n低置信正文\nChapter 123 This title is too long for parser\n第2章 后续\n后文' },
  { customRegexRules, minHeadingConfidence: 80 },
);
assert.equal(chapterDiagnostics.parserVersion, '1', 'chapter diagnostics should expose the active parser version');
assert.equal(chapterDiagnostics.stats.chapterCount, 2, 'chapter diagnostics should report parsed chapter count');
assert.equal(chapterDiagnostics.stats.totalCharacters, 61, 'chapter diagnostics should report total chapter body characters');
assert.equal(chapterDiagnostics.stats.averageCharacters, 31, 'chapter diagnostics should report average chapter body characters');
assert.equal(chapterDiagnostics.ruleMatches[0].rule, 'custom-regex:Scene headings', 'chapter diagnostics should report the matching parser rule');
assert.equal(chapterDiagnostics.ruleMatches[1].rule, 'standard-chapter', 'chapter diagnostics should report built-in parser rule matches');
assert.equal(chapterDiagnostics.unmatchedSamples[0].reason, 'confidence-below-threshold', 'chapter diagnostics should surface rejected low-confidence headings');
assert.equal(chapterDiagnostics.unmatchedSamples[1].reason, 'too-long', 'chapter diagnostics should surface overlong heading candidates');
assert.equal(chapterDiagnostics.shortChapters.length, 2, 'chapter diagnostics should flag abnormal short chapters');
assert.equal(chapterDiagnostics.longChapters.length, 0, 'chapter diagnostics should not report long chapters for compact samples');
assert.equal(chapterDiagnostics.hashManifest.length, 2, 'chapter diagnostics should include one hash manifest entry per parsed chapter');
assert.deepEqual(
  chapterDiagnostics.chapterPreview.map((chapter) => [chapter.sourceChapterIndex, chapter.title, chapter.startLine, chapter.paragraphCount, chapter.characters]),
  [
    [0, 'Scene 12: Arrival', 0, 5, 59],
    [1, '第2章 后续', 6, 1, 2],
  ],
  'chapter diagnostics should expose a final TOC preview with start lines, paragraph counts, and character counts',
);
const manifestBook = { ...book, contentHash: 'manifest-sample', content: '第1章 开始\n第一段\n第二段\n第2章 后续\n第三段' };
const tocManifest = buildReaderTocManifest(manifestBook, { paragraphMode: 'line' }, '2026-06-09T00:00:00.000Z');
assert.equal(tocManifest.contentHash, 'manifest-sample', 'TOC manifest must bind to the imported content hash');
assert.equal(tocManifest.entries.length, 2, 'TOC manifest must store one entry per parsed chapter');
assert.deepEqual(
  buildReaderChaptersFromTocManifest(manifestBook, tocManifest, { paragraphMode: 'line' })?.map((chapter) => ({ title: chapter.title, paragraphs: chapter.paragraphs })),
  [
    { title: '第1章 开始', paragraphs: ['第一段', '第二段'] },
    { title: '第2章 后续', paragraphs: ['第三段'] },
  ],
  'TOC manifest must rebuild reader chapters without reparsing headings',
);
assert.equal(isReaderTocManifestValidForBook({ ...manifestBook, contentHash: 'changed' }, tocManifest, { paragraphMode: 'line' }), false, 'TOC manifest must become invalid when content hash changes');
assert.equal(buildReaderChaptersFromTocManifest(manifestBook, tocManifest, { paragraphMode: 'blank-line' }), null, 'TOC manifest must be ignored when chapter parsing options change');
const oversizedManifestBook = {
  ...book,
  contentHash: 'oversized-manifest',
  content: `第1章 巨长章节\n${'甲'.repeat(17000)}\n${'乙'.repeat(17000)}\n第2章 后续\n正文`,
};
const oversizedTocManifest = buildReaderTocManifest(oversizedManifestBook, { paragraphMode: 'line' }, '2026-06-09T00:00:00.000Z');
const oversizedFromManifest = buildReaderChaptersFromTocManifest(oversizedManifestBook, oversizedTocManifest, { paragraphMode: 'line' }) ?? [];
assert.equal(oversizedTocManifest.entries.length, 2, 'TOC manifest must store original chapter boundaries instead of synthetic oversized section entries');
assert.equal(oversizedFromManifest.some((chapter) => chapter.paragraphs.length === 0), false, 'restoring an oversized chapter from TOC manifest must not create empty synthetic chapters');
assert.equal(oversizedFromManifest.some((chapter) => /第 2 节\s*·\s*第 2 节/.test(chapter.title)), false, 'restoring an oversized chapter from TOC manifest must not repeatedly append section suffixes');
const groupedTocIndex = createReaderTocIndex(
  [
    { id: 'c1', title: '第1章 开始', index: 0, startLine: 0, paragraphs: ['正文'] },
    { id: 'c2', title: '番外 婚礼之后', index: 1, startLine: 2, paragraphs: ['番外'] },
    { id: 'c3', title: '外传 北境旧事', index: 2, startLine: 4, paragraphs: ['外传'] },
    { id: 'c4', title: '完本感言', index: 3, startLine: 6, paragraphs: ['后记'] },
  ],
  {},
  { titleGroupingEnabled: true, titleGroupKeywords: '番外：番外\n外传：外传\n后记：后记，完本感言' },
);
assert.deepEqual(
  groupedTocIndex.entries.map((entry) => entry.titleGroup),
  ['正文', '番外', '外传', '后记'],
  'TOC index should classify chapters by configured title keyword groups',
);
assert.equal(filterReaderTocEntries(groupedTocIndex, '番外', 'title')[0].chapter.id, 'c2', 'TOC title search should include automatic title groups');
const documentTocIndex = createReaderTocIndex([
  { id: 'chapter-1', title: '第一章 中国网络文学的时代隆起', index: 0, startLine: 0, paragraphs: ['正文'] },
  { id: 'section-1', title: '一、源于海外，起于本土', index: 1, startLine: 2, paragraphs: ['正文'] },
  { id: 'subsection-1', title: '（一）早期平台', index: 2, startLine: 4, paragraphs: ['正文'] },
  { id: 'section-2', title: '二、全民写作机制', index: 3, startLine: 6, paragraphs: ['正文'] },
  { id: 'chapter-2', title: '第二章 文学网站平台', index: 4, startLine: 8, paragraphs: ['正文'] },
], {}, { hierarchyMode: 'document' });
assert.deepEqual(
  documentTocIndex.entries.map((entry) => ({ id: entry.chapter.id, depth: entry.depth, parentId: entry.parentId, hasChildren: entry.hasChildren })),
  [
    { id: 'chapter-1', depth: 0, parentId: '', hasChildren: true },
    { id: 'section-1', depth: 1, parentId: 'chapter-1', hasChildren: true },
    { id: 'subsection-1', depth: 2, parentId: 'section-1', hasChildren: false },
    { id: 'section-2', depth: 1, parentId: 'chapter-1', hasChildren: false },
    { id: 'chapter-2', depth: 0, parentId: '', hasChildren: false },
  ],
  'document TOC mode should build a collapsible heading hierarchy from chapter and section numbering',
);
const customGroupedTocIndex = createReaderTocIndex(
  [
    { id: 'c1', title: '第1章 正文', index: 0, startLine: 0, paragraphs: ['正文'] },
    { id: 'c2', title: 'Side Story: Rain', index: 1, startLine: 2, paragraphs: ['英文番外'] },
    { id: 'c3', title: '资料设定集', index: 2, startLine: 4, paragraphs: ['设定'] },
    { id: 'c4', title: 'Broken Regex Sample', index: 3, startLine: 6, paragraphs: ['正文'] },
  ],
  {},
  {
    titleGroupingEnabled: true,
    titleGroupKeywords: '番外：番外',
    titleGroupRules: [
      { id: 'side-story', name: 'Side story', groupName: '外篇', pattern: '^Side Story', enabled: true, priority: 10 },
      { id: 'setting', name: 'Setting', groupName: '设定', pattern: '设定集$', enabled: true, priority: 20 },
      { id: 'disabled', name: 'Disabled', groupName: '禁用', pattern: '^第1章', enabled: false, priority: 0 },
      { id: 'broken', name: 'Broken', groupName: '坏规则', pattern: '[', enabled: true, priority: 1 },
    ],
  },
);
assert.deepEqual(
  customGroupedTocIndex.entries.map((entry) => entry.titleGroup),
  ['正文', '外篇', '设定', '正文'],
  'custom TOC title group regex rules should classify titles before keyword fallback and ignore invalid or disabled rules',
);
assert.deepEqual(
  summarizeReaderTocManifestDiff(
    {
      ...tocManifest,
      entries: [
        { id: 'a', title: '旧一', index: 0, startLine: 10, endLine: 20 },
        { id: 'b', title: '保留', index: 1, startLine: 30, endLine: 40 },
        { id: 'c', title: '删除', index: 2, startLine: 50, endLine: 60 },
        { id: 'd', title: '移动', index: 3, startLine: 70, endLine: 80 },
      ],
    },
    {
      ...tocManifest,
      entries: [
        { id: 'd2', title: '移动', index: 0, startLine: 70, endLine: 80 },
        { id: 'a2', title: '新一', index: 1, startLine: 10, endLine: 20 },
        { id: 'b2', title: '保留', index: 2, startLine: 30, endLine: 40 },
        { id: 'e', title: '新增', index: 3, startLine: 90, endLine: 100 },
      ],
    },
    3,
  ),
  {
    previousCount: 4,
    nextCount: 4,
    addedCount: 1,
    removedCount: 1,
    renamedCount: 1,
    movedCount: 3,
    addedTitles: ['新增'],
    removedTitles: ['删除'],
    renamedTitles: [{ from: '旧一', to: '新一' }],
    movedTitles: ['移动', '新一', '保留'],
  },
  'TOC manifest diff summary should report added, removed, renamed, and moved chapters before rebuild',
);
assert.equal(getReaderChapterHeadingConfidence('第26章 泯生闪月'), 95, 'standard chapter headings should receive high confidence');
assert.equal(getReaderChapterHeadingConfidence('001'), 72, 'bare numeric headings should receive medium confidence');
assert.equal(isChapterHeading('001', { minHeadingConfidence: 80 }), false, 'confidence threshold should reject lower-confidence short headings');
assert.equal(isChapterHeading('第26章 泯生闪月', { minHeadingConfidence: 80 }), true, 'confidence threshold should keep high-confidence standard headings');
assert.equal(isChapterHeading('第2章 领红包', { autoIgnoreAdHeadings: true }), false, 'ad-like chapter headings should be ignored when ad heading filtering is enabled');
assert.equal(isChapterHeading('第2章 领红包', { autoIgnoreAdHeadings: false }), true, 'ad-like chapter headings should remain available when ad heading filtering is disabled');
assert.equal(isChapterHeading('第26章 泯生闪月', { enabled: false }), false, 'chapter detection master switch should disable built-in chapter headings');
assert.equal(isChapterHeading('第26章 泯生闪月', { enableChineseChapter: false }), false, 'Chinese chapter switch should disable 第 N 章 headings');
assert.equal(isChapterHeading('序章', { enableSpecialHeadings: false }), false, 'special heading switch should disable prologue-style headings');
assert.equal(isChapterHeading('Chapter 1 Dawn', { enableEnglishChapter: false }), false, 'English chapter switch should disable Chapter headings');
assert.deepEqual(
  buildReaderChapters({ ...book, displayTitle: '单章书', content: '第1章 开始\n正文\n第2章 后续\n正文二' }, { enabled: false }).map((chapter) => ({ title: chapter.title, paragraphs: chapter.paragraphs })),
  [{ title: '单章书', paragraphs: ['第1章 开始', '正文', '第2章 后续', '正文二'] }],
  'disabled chapter detection should keep the whole book as one chapter',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第1卷 上卷\n卷正文\n第1章 开始\n正文' }, { enableChineseVolume: false }).map((chapter) => chapter.title),
  [book.displayTitle, '第1章 开始'],
  'disabled volume switch should keep volume headings as body text instead of splitting volumes',
);
assert.equal(
  buildReaderChapters({ ...book, content: '第1卷 上卷\n卷正文\n第1章 开始\n正文' }, { enableChineseVolume: false })[0].paragraphs.join('\n').includes('第1卷 上卷'),
  true,
  'disabled volume switch should not discard volume heading text',
);
assert.deepEqual(
  previewReaderCompactChapterSplit('正文 第1章 开始 后文 第2章 后续', { enableCompactSplit: false }),
  ['正文 第1章 开始 后文 第2章 后续'],
  'disabled compact split switch should keep compact chapter lines intact',
);
const falseHeadingBook = { ...book, content: `第1章 正常标题\n真正正文\n${falseHeading}\n后续正文` };
assert.deepEqual(buildReaderChapters(falseHeadingBook).map((chapter) => chapter.title), ['第1章 正常标题'], 'long chapter-like prose must stay inside the current chapter body');
assert.ok(buildReaderChapters(falseHeadingBook)[0].paragraphs.join('\n').includes(falseHeading));
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第1章：冒号标题\n正文\n第2章 正常标题\n正文' }, { forbiddenHeadingPunctuation: '。；;、' }).map((chapter) => chapter.title),
  ['第1章：冒号标题', '第2章 正常标题'],
  'chapter builder should use custom forbidden punctuation when splitting chapters',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '【第1章 括号标题\n正文\n第2章 正常标题\n正文' }, { forbiddenHeadingStartChars: '([（' }).map((chapter) => chapter.title),
  ['【第1章 括号标题', '第2章 正常标题'],
  'chapter builder should use custom forbidden start characters when splitting chapters',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: 'Scene 12: Arrival\n正文\n第2章 正常标题\n正文' }, { customRegexRules }).map((chapter) => chapter.title),
  ['Scene 12: Arrival', '第2章 正常标题'],
  'chapter builder should split chapters with enabled custom regex rules',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '001\n第一段\n第2章 正常标题\n第二段' }, { minHeadingConfidence: 80 }).map((chapter) => chapter.title),
  [book.displayTitle, '第2章 正常标题'],
  'chapter builder should keep rejected low-confidence headings in the fallback body instead of splitting chapters',
);
assert.ok(
  buildReaderChapters({ ...book, content: '001\n第一段\n第2章 正常标题\n第二段' }, { minHeadingConfidence: 80 })[0].paragraphs.includes('001'),
  'rejected low-confidence heading text should not be discarded',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第1章 段落\n这是被硬换行\n切开的第一句。\n这是第二句\n仍然继续。\n\n新的自然段开始\n到这里结束。' }, { paragraphMode: 'chinese-reflow' })[0].paragraphs,
  ['这是被硬换行切开的第一句。这是第二句仍然继续。', '新的自然段开始到这里结束。'],
  'Chinese paragraph reflow should join hard-wrapped Chinese lines until sentence punctuation or blank lines',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第1章 正常标题\n正文\n第2章 领红包\n广告正文\n第3章 继续\n正文二' }, { autoIgnoreAdHeadings: true }).map((chapter) => chapter.title),
  ['第1章 正常标题', '第3章 继续'],
  'ad-like headings should not split chapters when ad heading filtering is enabled',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第1章 正常标题\n正文\n第1章 目录项\n第2章 目录项\n第3章 目录项\n目录页说明\n正文继续\n第2章 下一章\n正文二' }, { autoIgnoreRepeatedTocHeadings: true }).map((chapter) => chapter.title),
  ['第1章 正常标题', '第2章 下一章'],
  'consecutive TOC-like heading runs should be ignored instead of creating chapters from repeated directory pages',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: 'Part 1 The Gate\n第一段\nBook 2 Winter\n第二段\nVolume 3 Dawn\n第三段' }).map((chapter) => chapter.title),
  ['Part 1 The Gate', 'Book 2 Winter', 'Volume 3 Dawn'],
  'Part/Book/Volume headings should split chapters',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '001\n第一段\n1. 初见\n第二段\n一、再见\n第三段' }).map((chapter) => chapter.title),
  ['001', '1. 初见', '一、再见'],
  'numeric and Chinese enumeration short headings should split chapters',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第一章 中国网络文学的时代隆起\n章前正文\n一、源于海外，起于本土\n正文一\n二、“全民写作”机制下的网络文学热\n正文二' }).map((chapter) => chapter.title),
  ['第一章 中国网络文学的时代隆起', '一、源于海外，起于本土', '二、“全民写作”机制下的网络文学热'],
  'long Chinese enumeration headings from ebook tables of contents should split chapters',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第一段正文里提到 Part 1 The Gate 但它不是独占行\n第二段继续' }).map((chapter) => chapter.title),
  [book.displayTitle],
  'chapter headings must be standalone lines unless the compact split rule extracts a heading',
);
assert.deepEqual(
  buildReaderChapters({ ...book, content: '第1章 长副标题内容 后续正文' }, { compactHeadingSuffixLength: 3 }).map((chapter) => chapter.title),
  ['第1章 长副'],
  'compact heading suffix length should limit how much title text is captured from a dense line',
);
const compactWithoutPrefix = buildReaderChapters({ ...book, content: '前情提要 第1章 开始\n正文' }, { preserveCompactPrefixText: false });
assert.deepEqual(compactWithoutPrefix.map((chapter) => chapter.title), ['第1章 开始'], 'compact split should still create the detected heading when prefix preservation is disabled');
assert.equal(compactWithoutPrefix[0].paragraphs.includes('前情提要'), false, 'compact split should drop prefix text when prefix preservation is disabled');
assert.deepEqual(previewReaderCompactChapterSplit('前情提要 第1章 开始 尾段', { preserveCompactPrefixText: false }), ['第1章 开始 尾段'], 'compact split preview should use the same parser options as compact splitting');
assert.equal(formatReaderChapterTitle('第12章 风起云涌', 'strip-number'), '风起云涌', 'chapter title number cleanup should strip Chinese chapter prefixes');
assert.equal(formatReaderChapterTitle('Chapter 7 - The Door', 'strip-number'), 'The Door', 'chapter title number cleanup should strip English chapter prefixes');
assert.equal(formatReaderChapterTitle('1. Opening Notes', 'strip-number'), 'Opening Notes', 'chapter title number cleanup should strip ordered-list prefixes');
assert.equal(formatReaderChapterTitle('第12章', 'strip-number'), '第12章', 'chapter title number cleanup must keep pure numbered titles readable');
assert.equal(formatReaderChapterTitle('第12章 风起云涌', 'keep'), '第12章 风起云涌', 'chapter title number cleanup must be opt-in');
const multiLineChapter = buildReaderChapters({ ...book, content: cleanTxtContent('第1章 正常标题\n第一段正文\n第二段正文\n第三段正文', { removeAds: true, normalizeBlankLines: true }) });
assert.deepEqual(multiLineChapter[0].paragraphs, ['第一段正文', '第二段正文', '第三段正文'], 'each non-empty TXT body line should render as its own indented paragraph after cleanup');
assert.deepEqual(buildReaderChapters({ ...book, content: '第1章 正常标题\n第一行\n第二行' }, { paragraphMode: 'line' })[0].paragraphs, ['第一行', '第二行'], 'line paragraph mode should keep every non-empty line as a paragraph');
assert.deepEqual(buildReaderChapters({ ...book, content: '第1章 正常标题\n第一行\n第二行\n\n第三行' }, { paragraphMode: 'blank-line' })[0].paragraphs, ['第一行\n第二行', '第三行'], 'blank-line paragraph mode should join consecutive non-empty lines into one paragraph');
assert.deepEqual(buildReaderChapters({ ...book, content: '第1章 正常标题\n短句一\n短句二\n这是一个足够长的独立段落内容' }, { paragraphMode: 'merge-short-lines', shortLineMergeThreshold: 8 })[0].paragraphs, ['短句一短句二', '这是一个足够长的独立段落内容'], 'short-line merge mode should merge adjacent short lines');
assert.deepEqual(buildReaderChapters({ ...book, content: '第1章 正常标题\nabcdefghijkl' }, { longParagraphSliceSize: 5 })[0].paragraphs, ['abcde', 'fghij', 'kl'], 'chapter parsing should split long paragraphs with the configured slice size');

const syntheticChapters = [
  { id: 'reader-chapter-1', title: '第一章 星夜', index: 0, startLine: 0, paragraphs: ['没有关键词的正文。'] },
  { id: 'reader-chapter-2', title: '第二章 晨光', index: 1, startLine: 10, paragraphs: ['正文里出现隐秘档案。'] },
  { id: 'reader-chapter-3', title: '第三章 隐秘档案', index: 2, startLine: 20, paragraphs: ['标题命中。'] },
];
assert.deepEqual(
  filterReaderChapters(syntheticChapters, '隐秘档案', 'title').map((chapter) => chapter.title),
  ['第三章 隐秘档案'],
);
assert.deepEqual(
  filterReaderChapters(syntheticChapters, '隐秘档案', 'content').map((chapter) => chapter.title),
  ['第二章 晨光', '第三章 隐秘档案'],
);

const indexed = createReaderTocIndex([
  { id: 'reader-chapter-1', title: '第一卷 凡尘神域', index: 0, startLine: 0, paragraphs: ['卷首说明。'] },
  { id: 'reader-chapter-2', title: '第1章 黑缎缠目', index: 1, startLine: 8, paragraphs: ['林七夜第一次见到神明。'] },
  { id: 'reader-chapter-3', title: '第2章 守夜人', index: 2, startLine: 16, paragraphs: ['这里有沧南市的守夜人小队。'] },
]);
assert.equal(indexed.entries[1].volumeTitle, '第一卷 凡尘神域');
assert.equal(indexed.entries[1].kind, 'chapter');
const bodyHits = filterReaderTocEntries(indexed, '沧南市', 'content');
assert.equal(bodyHits.length, 1);
assert.equal(bodyHits[0].chapter.title, '第2章 守夜人');
assert.ok(bodyHits[0].snippet.includes('沧南市'));
const indexedWithAnnotations = createReaderTocIndex(indexed.entries.map((entry) => entry.chapter), {
  highlights: [{ id: 'toc-h1', chapterIndex: 2, paragraphIndex: 0, startOffset: 0, endOffset: 2, text: '标题命中', note: '伏笔线索', color: 'yellow' }],
  bookmarks: [{ id: 'toc-b1', bookId: 'book-1', chapterIndex: 1, paragraphIndex: 0, screenPage: 0, label: '黑缎重点', createdAt: '2026-06-06T00:00:00.000Z' }],
});
assert.deepEqual(filterReaderTocEntries(indexedWithAnnotations, '伏笔', 'annotations').map((entry) => entry.chapter.title), ['第2章 守夜人'], 'TOC search must support highlight/note scope');
assert.deepEqual(filterReaderTocEntries(indexedWithAnnotations, '黑缎重点', 'bookmarks').map((entry) => entry.chapter.title), ['第1章 黑缎缠目'], 'TOC search must support bookmark scope');
const location = getChapterLocation(2, 4);
assert.equal(location, '2:4');
assert.equal(findChapterIndexForLocation(indexed.entries.map((entry) => entry.chapter), location), 2);

const dirty = '第1章 正文   \n请收藏本站 example.com\n\n\n\n真正内容   \n本章未完，点击下一页继续阅读';
assert.equal(cleanTxtContent(dirty, { removeAds: true, normalizeBlankLines: true }), '第1章 正文\n\n真正内容', 'reader cleanup should collapse consecutive blank lines and trim trailing line whitespace');
assert.equal(cleanTxtContent(dirty, { removeAds: true, normalizeBlankLines: false }), '第1章 正文\n\n\n\n真正内容', 'reader cleanup should support preserving blank lines for original TXT layout');
assert.equal(cleanTxtContent('第1章 正文   \n真正内容', { removeAds: true, normalizeBlankLines: true, trimTrailingWhitespace: false }), '第1章 正文   \n真正内容', 'reader cleanup should allow preserving trailing line whitespace when the setting is disabled');
assert.equal(cleanTxtContent('第1章 正文\n访问 www.example.com\n本章未完，点击下一页继续阅读\n真正内容', { removeAds: true, normalizeBlankLines: true, removeAdUrls: false, removePaginationNoise: false }), '第1章 正文\n访问 www.example.com\n本章未完，点击下一页继续阅读\n真正内容', 'reader cleanup should allow disabling URL and pagination noise filters separately');
assert.equal(cleanTxtContent('w w w . 8 0 8 0 t x t . c o m\n真正内容', { removeAds: true, normalizeBlankLines: true }), 'w w w . 8 0 8 0 t x t . c o m\n真正内容', 'reader cleanup should fall back to original text when cleanup would otherwise erase all content');
assert.equal(cleanTxtContent('第1章 正文\n扫码关注公众号\n真正内容', { removeAds: true, normalizeBlankLines: true, adKeywords: ['扫码关注'] }), '第1章 正文\n真正内容', 'reader cleanup should remove custom ad keyword lines');
assert.equal(cleanTxtContent('第1章　正文\n真正　内容', { removeAds: true, normalizeBlankLines: true, normalizeFullWidthSpaces: true }), '第1章 正文\n真正 内容', 'reader cleanup should optionally normalize full-width spaces to half-width spaces');
assert.equal(cleanTxtContent('第1章　正文\n真正　内容', { removeAds: true, normalizeBlankLines: true, normalizeFullWidthSpaces: false }), '第1章　正文\n真正　内容', 'reader cleanup should allow preserving full-width spaces');
assert.equal(cleanTxtContent('第1章 正文\n【广告】加入书友群 12345\nVIP章节由站点A整理\n真正内容', {
  removeAds: true,
  normalizeBlankLines: true,
  customCleanupRules: [
    { id: 'drop-group-ad', name: '删除书友群广告', pattern: '书友群\\s*\\d+', replacement: '', enabled: true, mode: 'remove-line', priority: 0 },
    { id: 'strip-vip-source', name: '清洗来源前缀', pattern: '^VIP章节由[^\\n]+整理', replacement: '', enabled: true, mode: 'replace', priority: 1 },
  ],
}), '第1章 正文\n真正内容', 'reader cleanup should apply custom cleanup rules for line removal and regex replacement');
assert.deepEqual(estimateLongParagraphSlices('abcdefghijkl', 5), [{ startOffset: 0, endOffset: 5 }, { startOffset: 5, endOffset: 10 }, { startOffset: 10, endOffset: 12 }], 'long paragraph slicing should accept a configurable slice size');
const edited = applyTocEdits([
  { id: 'a', title: '第1章 旧名', index: 0, startLine: 0, paragraphs: ['甲', '乙'] },
  { id: 'b', title: '第2章 第二', index: 1, startLine: 2, paragraphs: ['丙'] },
  { id: 'c', title: '第3章 第三', index: 2, startLine: 3, paragraphs: ['丁'] },
], [
  { type: 'rename', chapterId: 'a', title: '第1章 新名' },
  { type: 'split', chapterId: 'a', paragraphIndex: 1, title: '第1章 下半' },
  { type: 'merge-next', chapterId: 'b' },
  { type: 'hide', chapterId: 'c' },
]);
assert.deepEqual(edited.map((chapter) => chapter.title), ['第1章 新名', '第1章 下半', '第2章 第二']);
assert.deepEqual(edited[2].paragraphs, ['丙', '丁']);
const tocMigrationSource = [
  { id: 'm1', title: '第1章', index: 0, startLine: 0, paragraphs: ['甲段', '前缀高亮文字后缀', '乙段'] },
  { id: 'm2', title: '第2章', index: 1, startLine: 3, paragraphs: ['丙段', '书签文字'] },
  { id: 'm3', title: '第3章', index: 2, startLine: 5, paragraphs: ['隐藏仍可迁移文字'] },
];
const splitAnchor = { ...createReaderAnnotationAnchor(tocMigrationSource[0], 1, 2, 6), text: '高亮文字' };
const splitChapters = applyTocEdits(tocMigrationSource, [{ type: 'split', chapterId: 'm1', paragraphIndex: 1, title: '第1章 下半' }]);
assert.deepEqual(resolveReaderAnnotationAnchorAfterTocEdits(splitAnchor, splitChapters), {
  status: 'ok',
  chapterIndex: 0.5,
  visibleChapterPosition: 1,
  paragraphIndex: 0,
  startOffset: 2,
  endOffset: 6,
}, 'highlight anchors must migrate into the split chapter half that still contains their text');
const ambiguousAnchor = { ...createReaderAnnotationAnchor({ id: 'ambiguous', title: '重复文本', index: 0, startLine: 0, paragraphs: ['旧前缀高亮文字旧后缀'] }, 0, 3, 7), text: '高亮文字' };
const ambiguousChapters = [{ id: 'ambiguous', title: '重复文本', index: 0, startLine: 0, paragraphs: ['孤立高亮文字', '旧前缀高亮文字旧后缀'] }];
assert.deepEqual(resolveReaderAnnotationAnchorAfterTocEdits(ambiguousAnchor, ambiguousChapters, { repairStrategy: 'context-first' }), {
  status: 'ok',
  chapterIndex: 0,
  visibleChapterPosition: 0,
  paragraphIndex: 1,
  startOffset: 3,
  endOffset: 7,
}, 'context-first anchor repair should prefer the old surrounding context before plain text matches');
assert.deepEqual(resolveReaderAnnotationAnchorAfterTocEdits(ambiguousAnchor, ambiguousChapters, { repairStrategy: 'text-first' }), {
  status: 'ok',
  chapterIndex: 0,
  visibleChapterPosition: 0,
  paragraphIndex: 0,
  startOffset: 2,
  endOffset: 6,
}, 'text-first anchor repair should choose the earliest matching selected text even when old context exists later');
assert.deepEqual(resolveReaderAnnotationAnchorAfterTocEdits({ ...ambiguousAnchor, paragraphHash: 'stale' }, ambiguousChapters, { repairStrategy: 'manual' }), {
  status: 'text-not-found',
}, 'manual anchor repair should not relocate drifted anchors automatically');
const mergeBookmarkAnchor = { ...createReaderAnnotationAnchor(tocMigrationSource[1], 1, 0, 4), text: '书签文字' };
const mergedChapters = applyTocEdits(tocMigrationSource, [{ type: 'merge-next', chapterId: 'm1' }]);
assert.deepEqual(resolveReaderAnnotationAnchorAfterTocEdits(mergeBookmarkAnchor, mergedChapters), {
  status: 'ok',
  chapterIndex: 0,
  visibleChapterPosition: 0,
  paragraphIndex: 4,
  startOffset: 0,
  endOffset: 4,
}, 'bookmark anchors from a merged next chapter must migrate to their new paragraph offset in the merged chapter');
const hiddenAnchor = { ...createReaderAnnotationAnchor(tocMigrationSource[2], 0, 0, 8), text: '隐藏仍可迁移文字' };
const hiddenMigrationChapters = applyTocEdits(tocMigrationSource, [{ type: 'hide', chapterId: 'm3' }]);
assert.equal(resolveReaderAnnotationAnchorAfterTocEdits(hiddenAnchor, hiddenMigrationChapters, { hiddenChapterIds: ['m3'] }).status, 'text-not-found', 'hidden chapter anchors must report a repairable missing-text state instead of resolving to the wrong chapter');
const hiddenDuplicateSource = [
  { id: 'visible-duplicate', title: '可见章', index: 0, startLine: 0, paragraphs: ['重复高亮文字'] },
  { id: 'hidden-duplicate', title: '隐藏章', index: 1, startLine: 1, paragraphs: ['重复高亮文字'] },
];
const hiddenDuplicateAnchor = { ...createReaderAnnotationAnchor(hiddenDuplicateSource[1], 0, 0, 6), text: '重复高亮文字' };
const hiddenDuplicateChapters = applyTocEdits(hiddenDuplicateSource, [{ type: 'hide', chapterId: 'hidden-duplicate' }]);
assert.equal(resolveReaderAnnotationAnchorAfterTocEdits(hiddenDuplicateAnchor, hiddenDuplicateChapters, { repairStrategy: 'context-first', hiddenChapterIds: ['hidden-duplicate'] }).status, 'text-not-found', 'hidden chapter anchors must not relocate to visible duplicate text under context-first repair');
assert.equal(resolveReaderAnnotationAnchorAfterTocEdits(hiddenDuplicateAnchor, hiddenDuplicateChapters, { repairStrategy: 'text-first', hiddenChapterIds: ['hidden-duplicate'] }).status, 'text-not-found', 'hidden chapter anchors must not relocate to visible duplicate text under text-first repair');
const tocEditWithMetadata = createReaderTocEdit({ type: 'hide', chapterId: 'a' }, { parserVersion: 'txt-v1', baseContentHash: 'hash-1', createdAt: '2026-06-06T00:00:00.000Z' });
assert.deepEqual(tocEditWithMetadata, { type: 'hide', chapterId: 'a', parserVersion: 'txt-v1', baseContentHash: 'hash-1', createdAt: '2026-06-06T00:00:00.000Z' }, 'TOC edits must carry parser/content/version metadata for future anchor migration and conflict prompts');
assert.deepEqual(getReaderTocEditHashStatus([tocEditWithMetadata], 'hash-1'), { status: 'ok', mismatchedCount: 0, unknownCount: 0 }, 'TOC edit hash status should pass when all edits match the current content hash');
assert.deepEqual(getReaderTocEditHashStatus([tocEditWithMetadata, { type: 'rename', chapterId: 'b', title: '旧编辑' }, { ...tocEditWithMetadata, baseContentHash: 'hash-2' }], 'hash-1'), { status: 'mismatch', mismatchedCount: 1, unknownCount: 1 }, 'TOC edit hash status should distinguish stale edits from legacy edits without metadata');
const repairedTocEdits = repairReaderTocEdits([
  { id: 'r1', title: '第1章', index: 0, startLine: 0, paragraphs: ['甲', '乙', '丙'] },
  { id: 'r2', title: '第2章', index: 1, startLine: 3, paragraphs: ['丁'] },
], [
  { type: 'rename', chapterId: 'r1', title: '第1章 新名', baseContentHash: 'old' },
  { type: 'split', chapterId: 'r1', paragraphIndex: 99, title: '第1章 下半', baseContentHash: 'old' },
  { type: 'merge-next', chapterId: 'r2', baseContentHash: 'old' },
  { type: 'hide', chapterId: 'missing', baseContentHash: 'old' },
  { type: 'rename', chapterId: 'r2', title: '', baseContentHash: 'old' },
], { parserVersion: 'txt-v1', baseContentHash: 'current', createdAt: '2026-06-07T00:00:00.000Z' });
assert.deepEqual(repairedTocEdits.edits, [
  { type: 'rename', chapterId: 'r1', title: '第1章 新名', parserVersion: 'txt-v1', baseContentHash: 'current', createdAt: '2026-06-07T00:00:00.000Z' },
  { type: 'split', chapterId: 'r1', paragraphIndex: 2, title: '第1章 下半', parserVersion: 'txt-v1', baseContentHash: 'current', createdAt: '2026-06-07T00:00:00.000Z' },
], 'TOC conflict repair should keep applicable edits, refresh metadata, and clamp split positions');
assert.deepEqual(repairedTocEdits.summary, { keptCount: 2, droppedCount: 3, clampedCount: 1, refreshedHashCount: 2 }, 'TOC conflict repair should summarize dropped, clamped, and hash-refreshed edits');
assert.deepEqual(repairedTocEdits.conflicts.map((item) => item.reason), ['split-out-of-range', 'merge-next-missing', 'missing-chapter', 'empty-title'], 'TOC conflict repair should report repairable and dropped conflict reasons in order');
const hiddenSource = [
  { id: 'h0', title: '第1章', index: 0, startLine: 0, paragraphs: ['一'] },
  { id: 'h1', title: '第2章', index: 1, startLine: 1, paragraphs: ['二'] },
  { id: 'h2', title: '第3章', index: 2, startLine: 2, paragraphs: ['三'] },
  { id: 'h3', title: '第4章', index: 3, startLine: 3, paragraphs: ['四'] },
];
const hiddenEdits = [{ type: 'hide', chapterId: 'h1' }, { type: 'hide', chapterId: 'h2' }];
assert.deepEqual(applyTocEdits(hiddenSource, hiddenEdits).map((chapter) => chapter.index), [0, 3], 'visible chapters must retain original indexes so chapter jumps do not shift after hidden chapters');
assert.deepEqual(getHiddenReaderChapters(hiddenSource, hiddenEdits).map((chapter) => chapter.title), ['第2章', '第3章']);
assert.equal(findVisibleChapterIndexByOriginalIndex(applyTocEdits(hiddenSource, hiddenEdits), 3), 1);
const locationSource = applyTocEdits(hiddenSource, hiddenEdits);
const stableLocation = createReaderLocation({
  bookId: 'book-1',
  chapterId: 'h3',
  sourceChapterIndex: 3,
  paragraphIndex: 0,
  startOffset: 0,
  endOffset: 1,
  chunkId: 'chunk-7',
  contentHash: 'hash-a',
  parserVersion: 'txt-v1',
});
assert.deepEqual(resolveReaderLocation(stableLocation, locationSource), {
  status: 'ok',
  location: {
    ...stableLocation,
    sourceChapterIndex: 3,
    visibleChapterPosition: 1,
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 1,
  },
}, 'stable chapterId locations must resolve to visible chapter positions after hidden chapters');
assert.equal(resolveReaderLocation({ bookId: 'book-1', chapterId: 'missing', sourceChapterIndex: 1, paragraphIndex: 0 }, locationSource).status, 'chapter-hidden-or-missing', 'missing chapterId locations must produce a visible failure status');
assert.deepEqual(resolveReaderLocation({ bookId: 'book-1', sourceChapterIndex: 3, paragraphIndex: 0 }, locationSource), {
  status: 'ok',
  location: { bookId: 'book-1', sourceChapterIndex: 3, chapterId: 'h3', visibleChapterPosition: 1, paragraphIndex: 0, startOffset: 0, endOffset: 0 },
}, 'sourceChapterIndex locations must resolve to the current visible chapter position');
assert.deepEqual(resolveReaderLocation({ bookId: 'book-1', visibleChapterPosition: 1, paragraphIndex: 0 }, locationSource), {
  status: 'ok',
  location: { bookId: 'book-1', visibleChapterPosition: 1, chapterId: 'h3', sourceChapterIndex: 3, paragraphIndex: 0, startOffset: 0, endOffset: 0 },
}, 'visibleChapterPosition locations must resolve back to stable chapter id and source index');
const pageChunks = estimateReaderPages({ id: 'p', title: '分页', index: 0, startLine: 0, paragraphs: ['一二三四五六七八九十', 'abcdefghij'] }, 8);
assert.deepEqual(pageChunks.map((page) => page.text), ['一二三四五六七八', '九十abcdef', 'ghij']);
assert.ok(pageChunks.every((page) => !page.text || page.text.length <= 8), 'page chunks should never exceed the estimated complete-text capacity');
const streamChapters = [
  { id: 's1', title: '第一章', index: 0, startLine: 0, paragraphs: ['一二三四', '五六七八'] },
  { id: 's2', title: '第二章', index: 1, startLine: 2, paragraphs: ['abcdef'] },
];
const pageStream = buildReaderPageStream(streamChapters, 4);
assert.deepEqual(pageStream.map((page) => [page.chapterIndex, page.pageInChapter, page.chunk.text]), [[0, 0, '一二三四'], [0, 1, '五六七八'], [1, 0, 'abcd'], [1, 1, 'ef']], 'page stream must flatten chapter pages into continuous reading order');
assert.deepEqual(getReaderSpreadPages(pageStream, 1, 'double').map((page) => [page.chapterIndex, page.pageInChapter, page.chunk.text]), [[0, 1, '五六七八'], [1, 0, 'abcd']], 'double-page spread must show consecutive pages across a chapter boundary');
assert.deepEqual(getReaderSpreadPages(pageStream, 1, 'double', { chapterStartsNewPage: true }).map((page) => [page.chapterIndex, page.pageInChapter, page.chunk.text]), [[0, 1, '五六七八']], 'chapter-start-new-page mode must not place a new chapter on the right page of the previous chapter spread');
assert.deepEqual(getReaderSpreadPages(pageStream, 2, 'double', { chapterStartsNewPage: true }).map((page) => [page.chapterIndex, page.pageInChapter, page.chunk.text]), [[1, 0, 'abcd'], [1, 1, 'ef']], 'chapter-start-new-page mode may still show two pages from the same chapter');
assert.equal(findReaderStreamPageIndex(pageStream, 1, 1), 3, 'chapter-local page coordinates must resolve to their global stream page index');
assert.equal(findReaderStreamPageIndex(pageStream, 1, 99), 3, 'out-of-range chapter-local pages must clamp inside that chapter instead of falling back to the first global page');
const firstChapterEightPages = Array.from({ length: 8 }, (_, index) => createReaderPageChunk(index, [{ paragraphIndex: index, startOffset: 0, endOffset: 1, text: String(index) }]));
const secondChapterFourPages = Array.from({ length: 4 }, (_, index) => createReaderPageChunk(index, [{ paragraphIndex: index, startOffset: 0, endOffset: 1, text: String(index) }]));
const overriddenStream = buildReaderPageStreamWithOverrides(streamChapters, 4, new Map([['s1', firstChapterEightPages], ['s2', secondChapterFourPages]]));
assert.equal(findReaderStreamPageIndex(overriddenStream, 1, 0), 8, 'first page of chapter two must display as global page 9 after chapter one has 8 measured pages');
assert.deepEqual(overriddenStream.slice(7, 10).map((page) => [page.chapterIndex, page.pageInChapter, page.streamIndex]), [[0, 7, 7], [1, 0, 8], [1, 1, 9]], 'measured page overrides must keep continuous global stream indexes across chapter boundaries');
const compactPages = estimateReaderPages({ id: 'compact', title: '短段分页', index: 0, startLine: 0, paragraphs: ['甲乙', '丙丁', '戊己庚辛'] }, 6);
assert.deepEqual(compactPages.map((page) => page.entries.map((entry) => entry.text)), [['甲乙', '丙丁'], ['戊己庚辛']], 'short paragraphs should share a page instead of leaving large blank areas');
const punctuationPages = estimateReaderPages({ id: 'punctuation', title: '长段分页', index: 0, startLine: 0, paragraphs: ['一二三四五六。七八九十甲乙丙丁'] }, 10, { longParagraphStrategy: 'punctuation' });
assert.deepEqual(punctuationPages.map((page) => page.text), ['一二三四五六。', '七八九十甲乙丙丁'], 'punctuation long-paragraph strategy should prefer sentence punctuation before the hard capacity boundary');
assert.equal(buildReaderFontFamily('霞鹜文楷', ['Source Han Serif SC', 'serif', 'serif']), '"霞鹜文楷", "Source Han Serif SC", serif', 'custom reader fonts must be quoted and merged with a de-duplicated fallback list');
assert.deepEqual(getVirtualChapterRange(Array.from({ length: 20 }, (_, index) => ({ id: `${index}`, title: `第${index}章`, index, startLine: index, paragraphs: ['x'] })), 10, 2), { start: 8, end: 13, before: 8, after: 7 });
assert.deepEqual(createHighlightRange(1, 2, 3, 8, '高亮文字', '批注', 'blue'), { chapterIndex: 1, paragraphIndex: 2, startOffset: 3, endOffset: 8, text: '高亮文字', note: '批注', color: 'blue' });
const anchorChapter = { id: 'anchor-c1', title: '锚点章', index: 7, startLine: 0, paragraphs: ['前缀文字高亮文字后缀文字'] };
assert.deepEqual(
  createReaderAnnotationAnchor(anchorChapter, 0, 4, 8),
  {
    chapterId: 'anchor-c1',
    sourceChapterIndex: 7,
    paragraphIndex: 0,
    startOffset: 4,
    endOffset: 8,
    prefixText: '前缀文字',
    suffixText: '后缀文字',
    paragraphHash: '1:12:2076057370',
  },
  'annotation anchors must include stable chapter id, source index, context, and paragraph hash',
);
assert.deepEqual(
  resolveReaderAnnotationAnchor({ ...createReaderAnnotationAnchor(anchorChapter, 0, 4, 8), text: '高亮文字' }, [{ ...anchorChapter, paragraphs: ['新增前缀文字高亮文字后缀文字'] }]),
  { status: 'ok', chapterIndex: 7, visibleChapterPosition: 0, paragraphIndex: 0, startOffset: 6, endOffset: 10 },
  'annotation anchors should relocate by selected text and context when offsets drift',
);
assert.deepEqual(createReaderSelectionHighlightRange('1:2', 3, 8, '高亮文字', 'highlight'), { chapterIndex: 1, paragraphIndex: 2, startOffset: 3, endOffset: 8, text: '高亮文字', note: '', color: 'yellow' });
assert.deepEqual(createReaderSelectionHighlightRange('1:2', 103, 108, '高亮文字', 'annotate', '批注', 'green'), { chapterIndex: 1, paragraphIndex: 2, startOffset: 103, endOffset: 108, text: '高亮文字', note: '批注', color: 'green' }, 'selection ranges on later page chunks must include the original paragraph page offset');
assert.equal(
  appendReaderLocationToAnnotationNote('批注', { chapterIndex: 1, paragraphIndex: 2, startOffset: 103, endOffset: 108 }),
  '批注\n\nLocation: reader://1/2?start=103&end=108',
  'annotation notes should optionally append a reader location URI',
);
assert.equal(
  appendReaderLocationToAnnotationNote('', { chapterIndex: 1, paragraphIndex: 2, startOffset: 103, endOffset: 108 }),
  'Location: reader://1/2?start=103&end=108',
  'empty annotation notes should still be able to carry a reader location URI',
);
const selectionContextSnippet = getReaderSelectionContextSnippet(
  { location: '1:2', pageStartOffset: 100, text: '前缀文字高亮文字后缀文字', selectedText: '高亮文字', localStartOffset: 4 },
  { chapterIndex: 1, paragraphIndex: 2, startOffset: 104, endOffset: 108, text: '高亮文字', note: '' },
);
assert.deepEqual(selectionContextSnippet, { prefixText: '前缀文字', text: '高亮文字', suffixText: '后缀文字' }, 'selection context snippets should use paragraph text around the selected offsets');
assert.equal(
  appendReaderContextToAnnotationNote('批注', selectionContextSnippet),
  '批注\n\nContext: 前缀文字[高亮文字]后缀文字',
  'annotation notes should optionally append selected-text context',
);
assert.equal(applyReaderAnnotationNoteTemplate('', '高亮文字'), '', 'empty annotation note templates should keep the note dialog blank');
assert.equal(applyReaderAnnotationNoteTemplate('摘录：{text}\n想法：', '高亮文字'), '摘录：高亮文字\n想法：', 'annotation note templates should support selected text placeholders');
assert.deepEqual(
  buildReaderSelectionRanges([
    { location: '1:2', pageStartOffset: 0, text: '第一段正文', selectedText: '段正文', localStartOffset: 2 },
    { location: '1:3', pageStartOffset: 20, text: '第二段正文', selectedText: '第二段', localStartOffset: 0 },
  ], 'highlight', '', 'pink'),
  [
    { chapterIndex: 1, paragraphIndex: 2, startOffset: 2, endOffset: 5, text: '段正文', note: '', color: 'pink' },
    { chapterIndex: 1, paragraphIndex: 3, startOffset: 20, endOffset: 23, text: '第二段', note: '', color: 'pink' },
  ],
  'cross-paragraph reader selections must create one highlight range per selected paragraph',
);
assert.deepEqual(
  buildReaderSelectionRanges([
    { location: '1:2', pageStartOffset: 0, text: '第一章末段', selectedText: '末段', localStartOffset: 2 },
    { location: '2:0', pageStartOffset: 0, text: '第二章开头', selectedText: '第二章', localStartOffset: 0 },
  ], 'highlight', '', 'violet').map((range) => [range.chapterIndex, range.paragraphIndex, range.startOffset, range.endOffset, range.text, range.color]),
  [
    [1, 2, 3, 5, '末段', 'violet'],
    [2, 0, 0, 3, '第二章', 'violet'],
  ],
  'cross-chapter reader selections must be split into independent highlight ranges per chapter paragraph',
);
assert.deepEqual(getAdjacentReaderPageTarget('prev', 5, 0, 4, 10), { chapterIndex: 4, screenPage: 'last' }, 'previous page from the first page of a chapter must land on the previous chapter last page');
assert.deepEqual(getAdjacentReaderPageTarget('next', 5, 3, 4, 10), { chapterIndex: 6, screenPage: 'first' }, 'next page from the last page of a chapter must land on the next chapter first page');
assert.deepEqual(getAdjacentReaderPageTarget('prev', 5, 2, 4, 10), { chapterIndex: 5, screenPage: 1 }, 'previous page inside a chapter must stay in that chapter');
const highlightList = [
  { id: 'a', note: '批注', color: 'yellow', text: '甲' },
  { id: 'b', note: '保留', color: 'blue', text: '乙' },
];
assert.deepEqual(updateReaderHighlightColor(highlightList, 'a', 'green').map((item) => item.color), ['green', 'blue'], 'highlight color updates must target only the selected highlight');
assert.deepEqual(updateReaderHighlightNote(highlightList, 'a', '').map((item) => item.note), ['', '保留'], 'clearing a note must keep the highlight itself');
assert.deepEqual(updateReaderHighlightNote(highlightList, 'a', '新批注').map((item) => item.note), ['新批注', '保留'], 'existing highlight notes should be editable');
assert.equal(shouldCreateReaderAnnotationFromNote('', true), true, 'empty annotation notes should be accepted when the setting allows them');
assert.equal(shouldCreateReaderAnnotationFromNote('   ', false), false, 'blank annotation notes should be rejected when empty notes are disabled');
assert.equal(shouldCreateReaderAnnotationFromNote('有效备注', false), true, 'non-empty annotation notes should always be accepted');
assert.deepEqual(
  updateReaderHighlightDetails([{ id: 'a', note: '', color: 'yellow', text: '甲' }, { id: 'b', note: '保留', color: 'blue', text: '乙' }], 'a', { tags: ['人物', '伏笔'], importance: 'high', reviewStatus: 'due', colorMeaning: '伏笔', updatedAt: 'now' }),
  [{ id: 'a', note: '', color: 'yellow', text: '甲', tags: ['人物', '伏笔'], importance: 'high', reviewStatus: 'due', colorMeaning: '伏笔', updatedAt: 'now' }, { id: 'b', note: '保留', color: 'blue', text: '乙' }],
  'highlight details should persist tags, importance, review status, and semantic color meaning',
);
assert.deepEqual(deleteReaderHighlight(highlightList, 'a').map((item) => item.id), ['b'], 'deleting a highlight must remove only that highlight');
assert.equal(resolveReaderHighlightColor(undefined, 'green'), 'green', 'new highlights should use the stored default color');
assert.equal(resolveReaderHighlightColor('pink', 'green'), 'pink', 'explicit toolbar colors should override the stored default');
const highlightIndex = createReaderHighlightIndex([
  { id: 'h1', chapterIndex: 1, paragraphIndex: 2, startOffset: 0, endOffset: 1, text: '甲', note: '', color: 'yellow' },
  { id: 'h2', chapterIndex: 1, paragraphIndex: 2, startOffset: 2, endOffset: 3, text: '乙', note: '', color: 'blue' },
  { id: 'h3', chapterIndex: 1, paragraphIndex: 3, startOffset: 0, endOffset: 1, text: '丙', note: '', color: 'green' },
]);
assert.equal(getReaderHighlightIndexKey(1, 2), '1:2', 'highlight index keys must match chapter and paragraph locations');
assert.deepEqual(highlightIndex.get('1:2').map((item) => item.id), ['h1', 'h2'], 'highlight index must only return ranges for the requested paragraph');
assert.deepEqual(highlightIndex.get('1:3').map((item) => item.id), ['h3'], 'highlight index must keep different paragraphs separate');
assert.deepEqual(
  groupReaderHighlightsByChapter([
    { id: 'a', chapterIndex: 1, paragraphIndex: 0, startOffset: 0, endOffset: 1, text: '甲', note: '', color: 'yellow' },
    { id: 'b', chapterIndex: 1, paragraphIndex: 2, startOffset: 0, endOffset: 1, text: '乙', note: '批注', color: 'blue' },
    { id: 'c', chapterIndex: 3, paragraphIndex: 0, startOffset: 0, endOffset: 1, text: '丙', note: '', color: 'green' },
  ]).map((group) => [group.chapterIndex, group.items.map((item) => item.id)]),
  [[1, ['a', 'b']], [3, ['c']]],
  'reader highlights should group by chapter and preserve reading order',
);
const searchableHighlights = [
  { id: 'new-note', chapterIndex: 2, paragraphIndex: 1, startOffset: 0, endOffset: 2, text: 'ＡＢ', note: '伏笔', color: 'blue', createdAt: '2026-06-06T02:00:00.000Z' },
  { id: 'old-text', chapterIndex: 1, paragraphIndex: 3, startOffset: 0, endOffset: 3, text: 'abc', note: '', color: 'yellow', createdAt: '2026-06-05T02:00:00.000Z' },
  { id: 'long', chapterIndex: 1, paragraphIndex: 2, startOffset: 0, endOffset: 7, text: 'abcdefg', note: '批注', color: 'green', createdAt: '2026-06-05T03:00:00.000Z' },
];
const pinyinHighlights = [{ id: 'pinyin-text', chapterIndex: 3, paragraphIndex: 1, startOffset: 0, endOffset: 4, text: '隐秘档案', note: '终章线索', color: 'pink', createdAt: '2026-06-06T03:00:00.000Z' }];
const highlightChapterTitles = new Map([[1, '第一章 序幕'], [2, '第二章 日出'], [3, '终章 重逢']]);
assert.equal(normalizeReaderSearchText('ＡＢＣ xyz'), 'abc xyz', 'reader search normalization should fold full-width ASCII and lowercase text');
assert.equal(normalizeReaderSearchText('隱秘檔案與讀書筆記'), '隐秘档案与读书笔记', 'reader search normalization should fold common traditional Chinese characters to simplified forms');
assert.equal(normalizeReaderSearchText('ＡＢＣ', { normalizeNfkc: false }), 'ａｂｃ', 'reader search normalization should allow disabling NFKC folding');
assert.equal(normalizeReaderSearchText('隱秘檔案', { normalizeTraditionalChinese: false }), '隱秘檔案', 'reader search normalization should allow disabling traditional Chinese folding');
assert.deepEqual(filterReaderHighlights(searchableHighlights, { query: 'ab', color: 'all', chapterIndex: 'all', hasNote: 'all' }).map((item) => item.id), ['new-note', 'old-text', 'long'], 'highlight search should match normalized highlight text');
assert.deepEqual(filterReaderHighlights(pinyinHighlights, { query: 'ymda', color: 'all', chapterIndex: 'all', hasNote: 'all' }).map((item) => item.id), ['pinyin-text'], 'highlight search should match Chinese text by pinyin initials');
assert.deepEqual(filterReaderHighlights(pinyinHighlights, { query: 'ymda', color: 'all', chapterIndex: 'all', hasNote: 'all', pinyinInitials: false }).map((item) => item.id), [], 'highlight search should allow disabling pinyin-initial matching');
assert.deepEqual(filterReaderHighlights(searchableHighlights, { query: '伏笔', color: 'blue', chapterIndex: 2, hasNote: true }).map((item) => item.id), ['new-note'], 'highlight filters should combine query, color, chapter, and note state');
assert.deepEqual(filterReaderHighlights(searchableHighlights, { query: '伏笔', queryScope: 'note', color: 'all', chapterRange: [2], hasNote: 'all' }).map((item) => item.id), ['new-note'], 'highlight search should support note-only query scope and chapter range filtering');
assert.deepEqual(filterReaderHighlights(searchableHighlights, { query: '伏笔', queryScope: 'text', color: 'all', chapterRange: [2], hasNote: 'all' }).map((item) => item.id), [], 'highlight search should exclude note matches when searching original text only');
assert.deepEqual(filterReaderHighlights(searchableHighlights, { query: '第二章 日出', chapterTitles: highlightChapterTitles, color: 'all', chapterIndex: 'all', hasNote: 'all' }).map((item) => item.id), ['new-note'], 'highlight search should include matching chapter titles');
assert.deepEqual(filterReaderHighlights(searchableHighlights, { query: '第二章 日出', queryScope: 'text', chapterTitles: highlightChapterTitles, color: 'all', chapterIndex: 'all', hasNote: 'all' }).map((item) => item.id), [], 'text-only highlight search should not include chapter titles');
assert.deepEqual(filterReaderHighlights([
  { ...searchableHighlights[0], id: 'tagged-high', tags: ['伏笔'], importance: 'high', reviewStatus: 'due' },
  { ...searchableHighlights[1], id: 'plain', tags: [], importance: 'normal', reviewStatus: 'new' },
], { tag: '伏笔', importance: 'high', reviewStatus: 'due', color: 'all', chapterIndex: 'all', hasNote: 'all' }).map((item) => item.id), ['tagged-high'], 'highlight filters should support tag, importance, and review status');
assert.deepEqual(sortReaderHighlights(searchableHighlights, 'text-length-desc').map((item) => item.id), ['long', 'old-text', 'new-note'], 'highlight sorting should support text length ordering');
assert.deepEqual(sortReaderHighlights(searchableHighlights, 'created-desc').map((item) => item.id), ['new-note', 'long', 'old-text'], 'highlight sorting should support newest first ordering');
assert.deepEqual(
  groupReaderHighlightsByChapter(sortReaderHighlights(searchableHighlights, 'created-desc')).map((group) => [group.chapterIndex, group.items.map((item) => item.id)]),
  [[2, ['new-note']], [1, ['long', 'old-text']]],
  'highlight grouping must retain the selected sort order instead of restoring reading order',
);
const annotationsJson = serializeReaderAnnotationsJson({ highlights: searchableHighlights, bookmarks: [{ id: 'bm', bookId: 'book-1', chapterIndex: 1, paragraphIndex: 2, screenPage: 3, label: '第2章', createdAt: '2026-06-06T00:00:00.000Z' }] });
assert.deepEqual(deserializeReaderAnnotationsJson(annotationsJson).highlights.map((item) => item.id), ['new-note', 'old-text', 'long'], 'annotation JSON export/import must preserve highlight ids');
const annotationsJsonWithNotes = serializeReaderAnnotationsJson({
  highlights: [{ ...searchableHighlights[0], note: '批注 JSON 往返', tags: ['伏笔'], importance: 'high', reviewStatus: 'due', colorMeaning: '疑问' }],
  bookmarks: [{ id: 'bm-note', bookId: 'book-1', chapterIndex: 1, paragraphIndex: 2, screenPage: 3, label: '第2章', title: '书签标题', note: '书签备注', color: 'green', tags: ['人物'], createdAt: '2026-06-06T00:00:00.000Z' }],
});
const roundTripAnnotations = deserializeReaderAnnotationsJson(annotationsJsonWithNotes);
assert.equal(roundTripAnnotations.highlights[0].note, '批注 JSON 往返', 'annotation JSON export/import must preserve highlight annotation notes');
assert.deepEqual(roundTripAnnotations.highlights[0].tags, ['伏笔'], 'annotation JSON export/import must preserve highlight metadata');
assert.equal(roundTripAnnotations.bookmarks[0].note, '书签备注', 'annotation JSON export/import must preserve bookmark notes');
assert.deepEqual(roundTripAnnotations.bookmarks[0].tags, ['人物'], 'annotation JSON export/import must preserve bookmark metadata');
assert.equal(deserializeReaderAnnotationsJson('{bad').error, 'invalid-json', 'corrupt annotation imports should be reported instead of throwing');
const annotationBookmarks = [{ id: 'bm', bookId: 'book-1', chapterIndex: 1, paragraphIndex: 2, screenPage: 3, label: '第2章', createdAt: '2026-06-06T00:00:00.000Z' }];
const annotationBookmarkNotes = [
  ...annotationBookmarks,
  { id: 'bm-note-only', bookId: 'book-1', chapterIndex: 2, paragraphIndex: 0, screenPage: 0, label: '带备注书签', note: '书签备注', createdAt: '2026-06-06T01:00:00.000Z' },
];
assert.deepEqual(filterReaderAnnotationExportContent({ highlights: searchableHighlights, bookmarks: annotationBookmarkNotes }, 'highlights'), { highlights: searchableHighlights, bookmarks: [] }, 'annotation export content filter should support highlights only');
assert.deepEqual(filterReaderAnnotationExportContent({ highlights: searchableHighlights, bookmarks: annotationBookmarkNotes }, 'bookmarks'), { highlights: [], bookmarks: annotationBookmarkNotes }, 'annotation export content filter should support bookmarks only');
assert.deepEqual(
  filterReaderAnnotationExportContent({ highlights: searchableHighlights, bookmarks: annotationBookmarkNotes }, 'notes'),
  { highlights: searchableHighlights.filter((highlight) => highlight.note.trim()), bookmarks: annotationBookmarkNotes.filter((bookmark) => bookmark.note?.trim()) },
  'annotation export content filter should support notes only across highlights and bookmarks',
);
assert.match(formatReaderAnnotationsMarkdown('测试书', syntheticChapters, searchableHighlights, annotationBookmarks), /# 测试书[\s\S]*## Highlights[\s\S]*## Bookmarks[\s\S]*第2章/, 'annotation markdown export must include highlights and bookmarks');
assert.match(
  formatReaderAnnotationsMarkdown('测试书', syntheticChapters, searchableHighlights, annotationBookmarks, { template: '# {bookTitle}\n导出时间：{exportedAt}\n\n{highlights}\n\n{bookmarks}' }),
  /# 测试书[\s\S]*导出时间：20[\s\S]*ＡＢ[\s\S]*第2章/,
  'annotation markdown export must support a configurable export template with placeholders',
);
assert.match(formatReaderAnnotationsCsv(syntheticChapters, searchableHighlights, annotationBookmarks), /type,id,chapter,text,note,color,createdAt,location/, 'annotation CSV export must include a stable header');
assert.equal(
  formatReaderAnnotationsCsv(syntheticChapters, searchableHighlights, annotationBookmarks, { fields: ['type', 'chapter', 'text'] }).split('\n')[0],
  'type,chapter,text',
  'annotation CSV export must allow selecting exported fields',
);
assert.match(formatReaderHighlightsAnkiCsv(syntheticChapters, searchableHighlights), /伏笔/, 'Anki CSV export must include highlight notes as answer content');
assert.match(formatReaderHighlightsAnkiCsv(syntheticChapters, searchableHighlights, 'bookmind-review important'), /bookmind-review important/, 'Anki CSV export must accept configurable default tags');
assert.match(formatReaderAnnotationsJson({ highlights: searchableHighlights, bookmarks: annotationBookmarks }), /"schemaVersion": 1/, 'annotation JSON formatter must include schemaVersion');
assert.match(formatReaderAnnotationsObsidianMarkdown('测试书', syntheticChapters, searchableHighlights, annotationBookmarks), /---[\s\S]*book: 测试书[\s\S]*# 测试书[\s\S]*\[\[第二章 晨光\]\]/, 'Obsidian markdown export must include frontmatter and wiki-linked chapter sections');
assert.doesNotMatch(formatReaderAnnotationsObsidianMarkdown('测试书', syntheticChapters, searchableHighlights, annotationBookmarks, { wikiLinks: false }), /\[\[第二章 晨光\]\]/, 'Obsidian markdown export must allow disabling wiki links');
assert.match(formatReaderAnnotationsLogseqMarkdown('测试书', syntheticChapters, searchableHighlights, annotationBookmarks), /- book:: 测试书[\s\S]*\t- highlight:: ＡＢ[\s\S]*\t\t- note:: 伏笔/, 'Logseq markdown export must use indented block properties for highlights and notes');
assert.doesNotMatch(formatReaderAnnotationsLogseqMarkdown('测试书', syntheticChapters, searchableHighlights, annotationBookmarks, { propertyFormat: false }), /book::|chapter::|highlight::/, 'Logseq markdown export must allow disabling property-style fields');
assert.match(formatReaderAnnotationsReadwiseCsv(syntheticChapters, searchableHighlights, annotationBookmarks, '测试书'), /Title,Author,Category,Highlight,Note,Location,Tags[\s\S]*测试书/, 'Readwise CSV export must include Readwise-compatible headers and title metadata');
const importPreviewChapters = [{ id: 'preview-c1', title: '预览章', index: 1, startLine: 0, paragraphs: ['0123456789'] }];
const importPreviewHighlights = [{ id: 'h-dup', chapterIndex: 1, paragraphIndex: 0, startOffset: 0, endOffset: 2, text: '01', note: '', color: 'yellow' }, { id: 'h-update', chapterIndex: 1, paragraphIndex: 0, startOffset: 2, endOffset: 4, text: '23', note: '', color: 'blue' }];
const importPreviewBookmarks = [{ id: 'b-dup', bookId: 'book-1', chapterIndex: 1, paragraphIndex: 0, screenPage: 0, label: '预览书签', createdAt: '2026-06-06T00:00:00.000Z' }];
assert.deepEqual(
  previewReaderAnnotationsImport(
    { highlights: importPreviewHighlights, bookmarks: importPreviewBookmarks },
    {
      highlights: [importPreviewHighlights[0], { ...importPreviewHighlights[1], note: '更新' }, { id: 'missing-highlight', chapterIndex: 99, paragraphIndex: 0, startOffset: 0, endOffset: 1, text: '失效', note: '', color: 'red' }],
      bookmarks: [importPreviewBookmarks[0], { ...importPreviewBookmarks[0], id: 'bm2' }, { id: 'missing-bookmark', bookId: 'book-1', chapterIndex: 1, paragraphIndex: 99, screenPage: 0, label: '失效书签', createdAt: '2026-06-06T00:00:00.000Z' }],
    },
    importPreviewChapters,
  ),
  { highlights: { added: 1, updated: 1, duplicates: 1, unresolved: 1 }, bookmarks: { added: 2, updated: 0, duplicates: 1, unresolved: 1 } },
  'annotation import preview must count additions, updates, duplicates, and unresolved locations',
);
const conflictCurrentHighlights = [{ ...importPreviewHighlights[1], note: '本地备注', color: 'blue', tags: ['本地'], importance: 'normal', reviewStatus: 'new' }];
const conflictIncomingHighlights = [{ ...importPreviewHighlights[1], note: '导入备注', color: 'green', tags: ['导入', '本地'], importance: 'high', reviewStatus: 'due' }, { id: 'h-new', chapterIndex: 1, paragraphIndex: 0, startOffset: 4, endOffset: 5, text: '4', note: '新增', color: 'pink' }];
assert.deepEqual(
  mergeReaderAnnotationsImport(conflictCurrentHighlights, conflictIncomingHighlights, 'skip').map((item) => ({ id: item.id, note: item.note, color: item.color, tags: item.tags, importance: item.importance, reviewStatus: item.reviewStatus })),
  [
    { id: 'h-update', note: '本地备注', color: 'blue', tags: ['本地'], importance: 'normal', reviewStatus: 'new' },
    { id: 'h-new', note: '新增', color: 'pink', tags: undefined, importance: undefined, reviewStatus: undefined },
  ],
  'annotation JSON import skip strategy must keep local items when ids conflict',
);
assert.deepEqual(
  mergeReaderAnnotationsImport(conflictCurrentHighlights, conflictIncomingHighlights, 'overwrite').map((item) => ({ id: item.id, note: item.note, color: item.color, tags: item.tags, importance: item.importance, reviewStatus: item.reviewStatus })),
  [
    { id: 'h-update', note: '导入备注', color: 'green', tags: ['导入', '本地'], importance: 'high', reviewStatus: 'due' },
    { id: 'h-new', note: '新增', color: 'pink', tags: undefined, importance: undefined, reviewStatus: undefined },
  ],
  'annotation JSON import overwrite strategy must replace local items when ids conflict',
);
assert.deepEqual(
  mergeReaderAnnotationsImport(conflictCurrentHighlights, conflictIncomingHighlights, 'merge').map((item) => ({ id: item.id, note: item.note, color: item.color, tags: item.tags, importance: item.importance, reviewStatus: item.reviewStatus })),
  [
    { id: 'h-update', note: '本地备注', color: 'green', tags: ['本地', '导入'], importance: 'high', reviewStatus: 'due' },
    { id: 'h-new', note: '新增', color: 'pink', tags: undefined, importance: undefined, reviewStatus: undefined },
  ],
  'annotation JSON import merge strategy must preserve local notes while merging tags and imported metadata',
);
assert.deepEqual(
  searchReaderChapter({ id: 's', title: '搜索章', index: 4, startLine: 0, paragraphs: ['没有命中。', '林七夜发现禁墟。', '禁墟再次出现。'] }, '禁墟').map((hit) => [hit.paragraphIndex, hit.matchIndex]),
  [[1, 5], [2, 0]],
  'chapter search should return paragraph indexes and local match offsets',
);
const readerSearchIndex = buildReaderSearchIndex(syntheticChapters, searchableHighlights, annotationBookmarks);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '隐秘档案', { scope: 'book' }).map((hit) => [hit.kind, hit.chapterIndex, hit.paragraphIndex]),
  [['chapter', 1, 0], ['chapter', 2, 0]],
  'reader search index should search the whole book with chapter and paragraph locations',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '隱秘檔案', { scope: 'book' }).map((hit) => [hit.kind, hit.chapterIndex, hit.paragraphIndex]),
  [['chapter', 1, 0], ['chapter', 2, 0]],
  'reader search index should match simplified body text with traditional Chinese queries',
);
assert.deepEqual(
  searchReaderIndex(buildReaderSearchIndex([{ id: 'case', title: 'Case', index: 9, startLine: 0, paragraphs: ['Alpha Beta'] }], [], []), 'alpha', { scope: 'book', caseSensitive: true }).map((hit) => hit.kind),
  [],
  'case-sensitive reader search must not fold letter case',
);
assert.deepEqual(
  searchReaderIndex(buildReaderSearchIndex([{ id: 'width', title: 'Width', index: 10, startLine: 0, paragraphs: ['ＡＢＣ１２３'] }], [], []), 'abc123', { scope: 'book' }).map((hit) => hit.kind),
  ['chapter'],
  'reader search index should match full-width alphanumerics with half-width queries',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '伏笔', { scope: 'annotations' }).map((hit) => hit.kind),
  ['highlight'],
  'reader search index should search annotation notes separately from body text',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '第2章', { scope: 'bookmarks' }).map((hit) => hit.kind),
  ['bookmark'],
  'reader search index should include bookmarks as a dedicated search scope',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '隐 档', { scope: 'book', fuzzy: true }).map((hit) => [hit.kind, hit.chapterIndex]),
  [['chapter', 1], ['chapter', 2]],
  'reader search index should support fuzzy token matching for spaced queries',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '隐秘', { scope: 'book', regex: true, chapterRange: [1] }).map((hit) => [hit.kind, hit.chapterIndex]),
  [['chapter', 1]],
  'reader search index should support regex queries with chapter range filtering',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '隐秘档案', { scope: 'book', limit: 1, offset: 1 }).map((hit) => [hit.kind, hit.chapterIndex, hit.paragraphIndex]),
  [['chapter', 2, 0]],
  'reader search index should support paginated result windows',
);
assert.deepEqual(
  searchReaderIndex(readerSearchIndex, '隐秘档案', { scope: 'book', regex: true }).map((hit) => hit.kind),
  ['chapter', 'chapter'],
  'reader search regex mode should still support literal-looking valid regex queries',
);
const invalidRegexSearchIndex = buildReaderSearchIndex([{ id: 'regex-fallback', title: '正则回退', index: 3, startLine: 30, paragraphs: ['正文包含[无效正则。'] }], [], []);
assert.deepEqual(
  searchReaderIndex(invalidRegexSearchIndex, '[无效正则', { scope: 'book', regex: true }).map((hit) => hit.kind),
  ['chapter'],
  'reader search regex mode should fall back safely to literal search when the query is invalid regex',
);
assert.deepEqual(
  searchReaderIndex(invalidRegexSearchIndex, '[无效正则', { scope: 'book', regex: true, regexFallbackLiteral: false }).map((hit) => hit.kind),
  [],
  'reader search regex mode should return no results for invalid regex when literal fallback is disabled',
);
assert.deepEqual(
  findReaderLocationForCitation({ id: 1, label: '第二章', text: '沧南市的守夜人', targetId: 'chunk-2' }, [
    { id: 'c1', title: '第一章', index: 0, startLine: 0, paragraphs: ['没有命中'] },
    { id: 'c2', title: '第二章', index: 1, startLine: 1, paragraphs: ['这里有沧南市的守夜人小队。'] },
  ], [{ id: 'chunk-2', chapter: '第二章', text: '沧南市的守夜人', ordinal: 2 }]),
  { status: 'ok', location: { chapterId: 'c2', sourceChapterIndex: 1, visibleChapterPosition: 1, paragraphIndex: 0, startOffset: 3, endOffset: 10, chunkId: 'chunk-2' } },
  'AI citation chunk ids should resolve to reader paragraph locations when chunk metadata or citation text matches',
);
assert.match(
  formatReaderHighlightsMarkdown('测试书', [{ id: 'c1', title: '第一章', index: 1, startLine: 0, paragraphs: [''] }], [{ id: 'a', chapterIndex: 1, paragraphIndex: 0, startOffset: 0, endOffset: 1, text: '甲', note: '批注', color: 'blue', prefixText: '前文', suffixText: '后文' }]),
  /# 测试书[\s\S]*## 第一章[\s\S]*- \[blue\] 甲[\s\S]*批注[\s\S]*Context: 前文\[甲\]后文[\s\S]*Location: reader:\/\/1\/0\?start=0&end=1/,
  'highlight markdown export should include book title, chapter title, color, text, note, context, and reader location',
);
const serializedPages = serializeReaderPageChunks(compactPages);
const serializedPagePayload = JSON.parse(serializedPages);
assert.equal(serializedPagePayload[0].entries[0].text, undefined, 'persistent pagination cache must store paragraph indexes and offsets without duplicating page text');
assert.deepEqual(
  deserializeReaderPageChunks(serializedPages, { id: 'compact', title: '短段分页', index: 0, startLine: 0, paragraphs: ['甲乙', '丙丁', '戊己庚辛'] }),
  compactPages,
  'page chunk deserialization must restore renderable text from chapter paragraphs',
);
assert.deepEqual(deserializeReaderPageChunks(JSON.stringify(compactPages)), compactPages, 'page chunk deserialization must keep legacy full-text cache compatibility');
assert.deepEqual(
  deserializeReaderPageChunks(JSON.stringify([
    { pageIndex: 0, entries: [{ paragraphIndex: 0, startOffset: 0, endOffset: 3, text: '赵空城' }] },
    { pageIndex: 1, entries: [{ paragraphIndex: 0, startOffset: 3, endOffset: 7, text: '赵空城' }] },
  ]), { id: 'legacy-text-mismatch', title: '旧缓存文本错位', index: 0, startLine: 0, paragraphs: ['赵空城短暂沉默'] }),
  [
    createReaderPageChunk(0, [{ paragraphIndex: 0, startOffset: 0, endOffset: 3, text: '赵空城' }]),
    createReaderPageChunk(1, [{ paragraphIndex: 0, startOffset: 3, endOffset: 7, text: '短暂沉默' }]),
  ],
  'page chunk deserialization must rebuild legacy entry text from chapter offsets so stale cache text cannot repeat the start of a paragraph',
);
assert.deepEqual(
  deserializeReaderPageChunks(JSON.stringify([
    { pageIndex: 0, entries: [{ paragraphIndex: 0, startOffset: 0, endOffset: 12 }] },
    { pageIndex: 1, entries: [{ paragraphIndex: 0, startOffset: 8, endOffset: 18 }] },
  ]), { id: 'overlap', title: '重叠缓存', index: 0, startLine: 0, paragraphs: ['那个疑似炽天使代理人的家伙？嗯。'] }),
  [],
  'page chunk deserialization must reject overlapping adjacent paragraph offsets so text cannot repeat across page turns',
);
assert.deepEqual(getVirtualParagraphRange(1000, 500, 30), { start: 470, end: 531, before: 470, after: 469 }, 'large chapters should have a bounded virtual paragraph window');
assert.deepEqual(
  createReaderBookmark('book-1', 2, 4, 6, '第3章 第7页', '2026-06-05T00:00:00.000Z'),
  { id: 'reader-bookmark-book-1-2-4-6-2026-06-05T00-00-00-000Z', bookId: 'book-1', chapterIndex: 2, paragraphIndex: 4, screenPage: 6, label: '第3章 第7页', createdAt: '2026-06-05T00:00:00.000Z' },
  'reader bookmarks should include creation time so multiple bookmarks at one location do not overwrite each other',
);
assert.deepEqual(
  createReaderBookmark('book-1', 2, 4, 6, '第3章 第7页', '2026-06-05T00:00:00.000Z', { title: '自定义标题', note: '重点备注', color: 'red', tags: ['伏笔', '人物'] }),
  { id: 'reader-bookmark-book-1-2-4-6-2026-06-05T00-00-00-000Z', bookId: 'book-1', chapterIndex: 2, paragraphIndex: 4, screenPage: 6, label: '第3章 第7页', title: '自定义标题', note: '重点备注', color: 'red', tags: ['伏笔', '人物'], createdAt: '2026-06-05T00:00:00.000Z' },
  'reader bookmarks should preserve custom title, note, color, and tags metadata',
);
assert.deepEqual(
  updateReaderBookmarkDetails([{ id: 'bm', label: '旧书签', title: '', note: '', color: 'red', tags: [], updatedAt: 'old' }, { id: 'keep', label: '保留' }], 'bm', { title: '新标题', note: '新备注', color: 'blue', tags: ['标签A', '标签B'], updatedAt: 'now' }),
  [{ id: 'bm', label: '新标题', title: '新标题', note: '新备注', color: 'blue', tags: ['标签A', '标签B'], updatedAt: 'now' }, { id: 'keep', label: '保留' }],
  'reader bookmark details should update editable metadata and keep the visible label in sync',
);
assert.deepEqual(deleteReaderBookmark([{ id: 'a' }, { id: 'b' }], 'a').map((item) => item.id), ['b'], 'deleting a bookmark should remove only that bookmark');
assert.deepEqual(getReaderHistoryTarget([{ chapterIndex: 0, paragraphIndex: 0, screenPage: 0 }, { chapterIndex: 2, paragraphIndex: 4, screenPage: 1 }], 'back'), { chapterIndex: 0, paragraphIndex: 0, screenPage: 0 }, 'history back should return the previous target');
assert.deepEqual(getReaderHistoryTarget([{ chapterIndex: 0, paragraphIndex: 0, screenPage: 0 }, { chapterIndex: 2, paragraphIndex: 4, screenPage: 1 }], 'forward'), { chapterIndex: 2, paragraphIndex: 4, screenPage: 1 }, 'history forward should return the next target');
assert.deepEqual(createReaderHistoryStack([{ chapterIndex: 0, paragraphIndex: 0, screenPage: 0 }, { chapterIndex: 1, paragraphIndex: 2, screenPage: 0 }], { chapterIndex: 2, paragraphIndex: 4, screenPage: 1 }, 2), [{ chapterIndex: 1, paragraphIndex: 2, screenPage: 0 }, { chapterIndex: 2, paragraphIndex: 4, screenPage: 1 }], 'history stack should respect the configured retention limit');
assert.deepEqual(createReaderGoalProgress({ pagesPerDay: 20, minutesPerDay: 30, chaptersPerDay: 4 }, { pages: 10, minutes: 45, chapters: 1 }), { pageRate: 0.5, minuteRate: 1, chapterRate: 0.25 }, 'reader goal progress should clamp each enabled daily goal independently');
assert.equal(computeReaderProgress({ chapterIndex: 1, paragraphIndex: 1, chapters: [{ id: 'a', index: 0, title: 'a', paragraphs: ['12345'] }, { id: 'b', index: 1, title: 'b', paragraphs: ['12345', '67890'] }] }), 67, 'character progress should calculate from characters before the active paragraph');
assert.deepEqual(getFloatingMenuPosition(480, 260, { left: 120, top: 80, width: 300, height: 500 }, { width: 160, height: 140 }), { x: 132, y: 180 }, 'right-click menu should be clamped near the mouse inside its container, not centered by viewport coordinates');
assert.deepEqual(getReaderFixedMenuPosition(720, 340, { left: 168, top: 136, right: 760, bottom: 940 }, { width: 244, height: 340 }), { x: 508, y: 340 }, 'fixed highlight menus opened near the right edge must stay inside the visible reader area instead of sliding under the AI panel');
assert.deepEqual(getReaderFixedMenuPosition(720, 820, { left: 168, top: 136, right: 760, bottom: 940 }, { width: 244, height: 340 }), { x: 508, y: 592 }, 'fixed highlight menus opened near the bottom must move upward inside the visible reader area');
assert.deepEqual(getReaderFixedMenuPosition(1908, 884, { left: 0, top: 0, right: 2048, bottom: 1080 }, { width: 280, height: 430 }), { x: 1760, y: 642 }, 'large highlight menus opened from the right annotation panel must stay fully inside the window');
assert.deepEqual(getReaderSelectionMenuPosition({ left: 220, right: 360, top: 300, bottom: 336 }, { left: 100, top: 80, width: 620, height: 700 }, { width: 210, height: 46 }), { x: 85, y: 268, placement: 'bottom' }, 'selection toolbar should return a clamped left edge instead of a center point so it cannot overflow at the viewport edge');
assert.deepEqual(getReaderSelectionMenuPosition({ left: 102, right: 122, top: 300, bottom: 336 }, { left: 100, top: 80, width: 620, height: 700 }, { width: 292, height: 92 }), { x: 8, y: 268, placement: 'bottom' }, 'selection toolbar must stay inside the left edge for near-edge selections');
assert.deepEqual(getReaderSelectionMenuPosition({ left: 280, right: 360, top: 612, bottom: 644 }, { left: 100, top: 80, width: 620, height: 700 }, { width: 260, height: 188 }), { x: 90, y: 332, placement: 'top' }, 'selection menu near the bottom must open upward and keep the full menu inside the reader viewport');
assert.deepEqual(getReaderSelectionMenuPosition({ left: 280, right: 360, top: 92, bottom: 118 }, { left: 100, top: 80, width: 620, height: 700 }, { width: 260, height: 188 }), { x: 90, y: 50, placement: 'bottom' }, 'selection menu near the top must open downward when there is not enough room above');
assert.deepEqual(getVisibleHighlightSegments('一二三四五六七八九十', [{ chapterIndex: 0, paragraphIndex: 0, startOffset: 23, endOffset: 26, text: '四五六', note: '' }], 0, 0, 10), [], 'existing highlights outside the current page chunk must not render into the wrong local offset');
assert.deepEqual(getVisibleHighlightSegments('四五六七八九十', [{ chapterIndex: 0, paragraphIndex: 0, startOffset: 13, endOffset: 16, text: '四五六', note: '' }], 0, 0, 13).map((segment) => segment.text), ['四五六'], 'later page chunk highlights must render at the selected original offset');
assert.deepEqual(
  getVisibleHighlightSegments('一二三四五六七八九十', [
    { id: 'short-same-start', chapterIndex: 0, paragraphIndex: 0, startOffset: 1, endOffset: 3, text: '二三', note: '' },
    { id: 'long-same-start', chapterIndex: 0, paragraphIndex: 0, startOffset: 1, endOffset: 5, text: '二三四五', note: '' },
    { id: 'overlap-later', chapterIndex: 0, paragraphIndex: 0, startOffset: 4, endOffset: 7, text: '五六七', note: '' },
    { id: 'separate', chapterIndex: 0, paragraphIndex: 0, startOffset: 7, endOffset: 9, text: '八九', note: '' },
  ], 0, 0, 0).map((segment) => [segment.id, segment.text]),
  [['long-same-start', '二三四五'], ['separate', '八九']],
  'overlapping highlights must render with a deterministic first-start longest-range-wins strategy and keep later non-overlapping ranges',
);
assert.deepEqual(
  getVisibleHighlightSegments('一二三四五六七八九十', [
    { id: 'older-wide', chapterIndex: 0, paragraphIndex: 0, startOffset: 1, endOffset: 6, text: '二三四五六', note: '', createdAt: '2026-06-01T00:00:00.000Z' },
    { id: 'newer-middle', chapterIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 7, text: '四五六七', note: '', createdAt: '2026-06-03T00:00:00.000Z' },
    { id: 'separate', chapterIndex: 0, paragraphIndex: 0, startOffset: 7, endOffset: 9, text: '八九', note: '', createdAt: '2026-06-02T00:00:00.000Z' },
  ], 0, 0, 0, { overlapStrategy: 'latest-created' }).map((segment) => [segment.id, segment.text]),
  [['newer-middle', '四五六七'], ['separate', '八九']],
  'latest-created highlight overlap strategy must keep the newest overlapping highlight before later non-overlapping ranges',
);
assert.deepEqual(
  getVisibleHighlightSegments('一二三四五六七八九十', [
    { id: 'older-updated-wide', chapterIndex: 0, paragraphIndex: 0, startOffset: 1, endOffset: 6, text: '二三四五六', note: '', createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-05T00:00:00.000Z' },
    { id: 'newer-created-middle', chapterIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 7, text: '四五六七', note: '', createdAt: '2026-06-03T00:00:00.000Z' },
  ], 0, 0, 0, { overlapStrategy: 'latest-created' }).map((segment) => [segment.id, segment.text]),
  [['newer-created-middle', '四五六七']],
  'latest-created highlight overlap strategy must ignore updatedAt and choose by createdAt only',
);
assert.deepEqual(
  getVisibleHighlightSegments('一二三四五六七八九十', [
    { id: 'normal-wide', chapterIndex: 0, paragraphIndex: 0, startOffset: 1, endOffset: 7, text: '二三四五六七', note: '', importance: 'normal' },
    { id: 'critical-middle', chapterIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 6, text: '四五六', note: '', importance: 'critical' },
    { id: 'high-later', chapterIndex: 0, paragraphIndex: 0, startOffset: 5, endOffset: 8, text: '六七八', note: '', importance: 'high' },
    { id: 'separate', chapterIndex: 0, paragraphIndex: 0, startOffset: 8, endOffset: 10, text: '九十', note: '', importance: 'normal' },
  ], 0, 0, 0, { overlapStrategy: 'highest-importance' }).map((segment) => [segment.id, segment.text]),
  [['critical-middle', '四五六'], ['separate', '九十']],
  'highest-importance highlight overlap strategy must keep critical highlights over wider lower-priority overlaps',
);
assert.deepEqual(
  createReaderHighlightIndex([
    { chapterIndex: 0, paragraphIndex: 0, startOffset: 8, endOffset: 10, text: '后', note: '' },
    { chapterIndex: 0, paragraphIndex: 0, startOffset: 1, endOffset: 3, text: '前', note: '' },
    { chapterIndex: 0, paragraphIndex: 0, startOffset: 4, endOffset: 6, text: '中', note: '' },
  ]).get('0:0')?.map((highlight) => highlight.text),
  ['前', '中', '后'],
  'highlight index buckets should be pre-sorted by offsets so paragraph rendering does not sort per render',
);
assert.deepEqual(normalizeReaderSelectionOffsets('也就是说，现在的林七夜，或许是集训营中唯一能使用禁墟的新兵。', 0, '也'), { startOffset: 0, endOffset: 1, text: '也' }, 'single-character selections must highlight the exact selected character');
assert.deepEqual(normalizeReaderSelectionOffsets('也就是说，现在的林七夜，或许是集训营中唯一能使用禁墟的新兵。', 0, ' 也就是说'), { startOffset: 0, endOffset: 4, text: '也就是说' }, 'browser selections with external whitespace must keep offsets aligned with the original paragraph text');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 80, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'next-page');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: -80, activeScreenPage: 1, screenPageCount: 3, atTop: false, atBottom: false }), 'prev-page');
assert.equal(getReaderWheelIntent({ layoutMode: 'flow', deltaY: 80, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'native-scroll');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 18, deltaMode: 0, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'native-scroll', 'small pixel-mode touchpad wheel should not page');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 120, deltaMode: 0, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'next-page', 'large pixel-mode mouse wheel should page');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 3, deltaMode: 1, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'next-page', 'line-mode mouse wheel should page');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 120, deltaMode: 0, wheelPaging: false, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'native-scroll', 'reader settings should allow disabling wheel page turns');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 100, deltaMode: 0, wheelPagingThresholdPx: 140, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'native-scroll', 'reader settings should allow raising the wheel paging threshold');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 100, deltaMode: 0, wheelPagingThresholdPx: 60, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'next-page', 'reader settings should allow lowering the wheel paging threshold');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 120, deltaMode: 0, touchpadNaturalScroll: true, activeScreenPage: 0, screenPageCount: 3, atTop: false, atBottom: false }), 'next-page', 'natural touchpad scrolling should keep downward gestures moving forward');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: 120, deltaMode: 0, touchpadNaturalScroll: false, activeScreenPage: 1, screenPageCount: 3, atTop: false, atBottom: false }), 'prev-page', 'reader settings should allow inverted touchpad wheel paging');
assert.deepEqual(getReaderWheelPageState({ layoutMode: 'page', activeScreenPage: 0, screenPageCount: 3, activeStreamIndex: 119, pageStreamLength: 2048 }), { activeScreenPage: 119, screenPageCount: 2048 }, 'page-mode wheel handling must classify from the global stream page, not the current chapter page');
assert.equal(getReaderWheelIntent({ layoutMode: 'page', deltaY: -120, deltaMode: 0, ...getReaderWheelPageState({ layoutMode: 'page', activeScreenPage: 0, screenPageCount: 3, activeStreamIndex: 119, pageStreamLength: 2048 }), atTop: false, atBottom: false }), 'prev-page', 'wheel up on the first page of a later chapter must stay in global page navigation instead of jumping chapters or the book start');
{
  const chaptersForOverride = [
    { id: 'chapter-a', title: 'A', index: 0, startLine: 0, paragraphs: ['1234567890'] },
    { id: 'chapter-b', title: 'B', index: 1, startLine: 1, paragraphs: ['abcdefghij'] },
  ];
  const estimatedStream = buildReaderPageStream(chaptersForOverride, 3);
  const overrideStream = buildReaderPageStreamWithOverrides(chaptersForOverride, 3, new Map([[
    'chapter-a',
    [{
      pageIndex: 0,
      paragraphIndex: 0,
      startOffset: 0,
      endOffset: 10,
      text: '1234567890',
      entries: [{ paragraphIndex: 0, startOffset: 0, endOffset: 10, text: '1234567890' }],
    }],
  ]]));
  assert.equal(estimatedStream.filter((page) => page.chapterId === 'chapter-a').length > 1, true, 'test fixture must estimate multiple pages before applying measured override');
  assert.equal(overrideStream.filter((page) => page.chapterId === 'chapter-a').length, 1, 'measured current-chapter chunks must replace estimated pages in the global stream');
  assert.deepEqual(overrideStream.map((page) => page.streamIndex), overrideStream.map((_, index) => index), 'global stream indexes must be recomputed after measured chunk overrides');
  assert.equal(overrideStream[1].chapterId, 'chapter-b', 'wheel paging after a single measured current page should advance to the next chapter instead of a stale estimated page');
}
assert.equal(shouldShowChapterStartBlock(0, 0), true, 'chapter title/meta should show only at the start of a chapter');
assert.equal(shouldShowChapterStartBlock(0, 12), false, 'chapter title/meta should not repeat on later pages of the same chapter');
assert.equal(shouldShowChapterStartBlock(2, 0), false, 'chapter title/meta should not repeat after the first paragraph when a page starts mid-chapter');
assert.equal(resolveReaderPageWidth(1200, 1600), 1200, 'initial/default page width should be the maximum configured width when it fits');
assert.equal(resolveReaderPageWidth(900, 1200), 900, 'page width should remain the configured fixed width when it fits');
assert.equal(resolveReaderPageWidth(1200, 900), 868, 'page width should clamp to available viewport instead of content text length');
assert.equal(resolveReaderSpreadPageWidth(900, 1200, 'single', 28), 900, 'single-page spread width should keep the configured page width when it fits');
assert.equal(resolveReaderSpreadPageWidth(900, 1200, 'double', 28), 570, 'double-page spread width must reserve room for both pages and the page gap inside the reader frame');
assert.ok(resolveReaderSpreadPageWidth(1200, 1100, 'double', 96) * 2 + 96 <= 1100 - 32, 'double-page spread width must keep the complete spread inside the available reader width');
assert.equal(resolveReaderEffectivePageMode('double', 900, 420), 'single', 'double page mode should degrade to single page when the viewport is too narrow');
assert.equal(resolveReaderEffectivePageMode('double', 1100, 420), 'double', 'double page mode should remain double when two readable pages fit');
assert.equal(resolveReaderEffectivePageMode('single', 1100, 420), 'single', 'single page mode should remain single');
const pageMeasurementCacheKey = getReaderPageMeasurementCacheKey({
  chapterId: 'reader-chapter-1',
  title: '第1章',
  contentSignature: '2:120:开头:结尾',
  fontFamily: 'serif',
  fontSize: 19,
  letterSpacing: 1,
  lineHeight: 1.9,
  paragraphSpacing: 22,
  firstLineIndent: 2,
  pageWidth: 800,
  pageTextHeight: 520,
  bodyMarginX: 54,
  bodyMarginY: 48,
  headerVisible: true,
  footerVisible: true,
  headerMarginY: 12,
  footerMarginY: 14,
  timeFormat: 'short-24h',
  titleOnlyOnChapterStart: true,
  titleNumberCleanup: 'keep',
  titleFontSize: 34,
  titleMarginTop: 2,
  titleMarginBottom: 24,
  longParagraphStrategy: 'strict',
});
assert.equal(
  pageMeasurementCacheKey,
  'pagination:v6|parser:v1|font:v1|reader-chapter-1|第1章|2:120:开头:结尾|serif|19|1|1.9|22|2|800|520|54|48|1|1|12|14|short-24h|1|keep|34|2|24|strict',
  'page measurement cache keys must include chapter, typography, geometry, chrome, title display modes, and long-paragraph strategy inputs',
);
assert.notEqual(pageMeasurementCacheKey, pageMeasurementCacheKey.replace(/\|strict$/, '|punctuation'), 'page measurement cache keys must change when the long-paragraph strategy changes');
assert.match(pageMeasurementCacheKey, /^pagination:v\d+\|parser:v\d+\|font:v\d+\|/, 'page measurement cache key must include pagination, parser, and font cache versions');
assert.equal(getReaderPageTextHeight(760, { headerVisible: true, footerVisible: true, titleVisible: false, bodyMarginY: 54, headerMarginY: 18, footerMarginY: 18, titleFontSize: 34, titleMarginTop: 0, titleMarginBottom: 22 }), 536, 'fixed header/footer reserve space outside the text frame');
console.log(`Parsed ${chapters.length} chapters from full TXT sample and verified TOC search ranges, grouping, snippets, locations, cleanup, TOC edits, hidden chapter restore/jump mapping, pagination, fixed page geometry, menu positioning, wheel paging, and highlights.`);

import type { Book, ReaderTitleNumberCleanup } from '../../types';

export type ReaderChapter = {
  id: string;
  title: string;
  index: number;
  startLine: number;
  paragraphs: string[];
  volumeTitle?: string;
  characterCount?: number;
  contentSignature?: string;
};

export type TxtCleanupOptions = {
  removeAds: boolean;
  normalizeBlankLines: boolean;
  trimTrailingWhitespace?: boolean;
  adKeywords?: string[];
  removeAdUrls?: boolean;
  removePaginationNoise?: boolean;
  normalizeFullWidthSpaces?: boolean;
  customCleanupRules?: ReaderTxtCleanupRule[];
};

export type ReaderTxtCleanupRule = {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  enabled: boolean;
  mode: 'remove-line' | 'replace';
  priority: number;
};

export type ReaderChapterParsingOptions = {
  enabled?: boolean;
  maxHeadingLength?: number;
  minHeadingConfidence?: number;
  enableChineseChapter?: boolean;
  enableChineseVolume?: boolean;
  enableSpecialHeadings?: boolean;
  enableEnglishChapter?: boolean;
  enableCompactSplit?: boolean;
  autoIgnoreAdHeadings?: boolean;
  autoIgnoreRepeatedTocHeadings?: boolean;
  compactHeadingSuffixLength?: number;
  preserveCompactPrefixText?: boolean;
  autoDetectBookTitle?: boolean;
  bookTitleBracketMode?: 'book-title' | 'angle' | 'both' | 'custom';
  customBookTitleBracketPattern?: string;
  bookTitleMaxLength?: number;
  firstLineAsBookTitle?: boolean;
  inferBookTitleFromFileName?: boolean;
  paragraphMode?: 'line' | 'blank-line' | 'merge-short-lines' | 'chinese-reflow';
  shortLineMergeThreshold?: number;
  longParagraphSliceSize?: number;
  forbiddenHeadingPunctuation?: string;
  forbiddenHeadingStartChars?: string;
  customRegexRules?: ReaderChapterRegexRule[];
};

export type ReaderChapterRegexRule = {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  priority: number;
};

export type ReaderChapterDiagnosticReason =
  | 'too-long'
  | 'forbidden-start'
  | 'ad-heading'
  | 'repeated-toc'
  | 'confidence-below-threshold'
  | 'forbidden-punctuation'
  | 'no-rule-match';

export type ReaderChapterRuleMatch = {
  lineIndex: number;
  line: string;
  rule: string;
  confidence: number;
};

export type ReaderChapterUnmatchedSample = {
  lineIndex: number;
  line: string;
  reason: ReaderChapterDiagnosticReason;
  confidence: number;
};

export type ReaderChapterSizeDiagnostic = {
  chapterId: string;
  sourceChapterIndex: number;
  title: string;
  characters: number;
};

export type ReaderChapterPreviewEntry = {
  chapterId: string;
  sourceChapterIndex: number;
  title: string;
  startLine: number;
  endLine: number;
  paragraphCount: number;
  characters: number;
  volumeTitle?: string;
};

export type ReaderChapterDiagnostics = {
  parserVersion: string;
  options: ReaderChapterParsingOptions;
  stats: {
    chapterCount: number;
    totalCharacters: number;
    averageCharacters: number;
  };
  hashManifest: Array<{ chapterId: string; sourceChapterIndex: number; hash: string }>;
  chapterPreview: ReaderChapterPreviewEntry[];
  ruleMatches: ReaderChapterRuleMatch[];
  unmatchedSamples: ReaderChapterUnmatchedSample[];
  shortChapters: ReaderChapterSizeDiagnostic[];
  longChapters: ReaderChapterSizeDiagnostic[];
};

export type ReaderTocManifestEntry = {
  id: string;
  title: string;
  index: number;
  startLine: number;
  endLine: number;
  volumeTitle?: string;
};

export type ReaderTocManifest = {
  schemaVersion: 1;
  parserVersion: string;
  contentHash: string;
  optionsSignature: string;
  generatedAt: string;
  entries: ReaderTocManifestEntry[];
};

export type ReaderTocManifestDiffSummary = {
  previousCount: number;
  nextCount: number;
  addedCount: number;
  removedCount: number;
  renamedCount: number;
  movedCount: number;
  addedTitles: string[];
  removedTitles: string[];
  renamedTitles: Array<{ from: string; to: string }>;
  movedTitles: string[];
};

export type ReaderChapterDiagnosticsOptions = {
  sampleLimit?: number;
  shortChapterCharacterThreshold?: number;
  longChapterCharacterThreshold?: number;
};

const parserVersion = 1;

const MAX_CHAPTER_HEADING_LENGTH = 20;
const DEFAULT_FORBIDDEN_HEADING_PUNCTUATION = '。；;：、';
const DEFAULT_FORBIDDEN_HEADING_START_CHARS = '([（【[';
const CHINESE_CHAPTER_HEADING_RE = /^第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[章回节]\s*\S{0,16}$/;
const SPECIAL_CHAPTER_HEADING_RE = /^(?:序章|楔子|尾声|番外\s*\S{0,16})$/;
const ENGLISH_CHAPTER_HEADING_RE = /^(?:Chapter|Part|Book|Volume)\s+\d+(?:\s+.{1,12})?$/i;
const SHORT_CHAPTER_HEADING_RE = /^(?:\d{1,4}|[一二三四五六七八九十百千万零〇两]{1,6})[.、．]\s*\S{0,40}$/;
const BARE_NUMERIC_CHAPTER_HEADING_RE = /^\d{1,4}$/;
const BOOK_TITLE_RE = /^(?:《[^》]{1,80}》|<[^>]{1,80}>)$/;
const BOOK_TITLE_MARK_RE = /^《([^》]{1,120})》$/;
const ANGLE_BOOK_TITLE_RE = /^<([^>]{1,120})>$/;
const AD_HEADING_RE = /(红包|领书币|加群|QQ群|微信|公众号|扫码|下载APP|关注|最新网址|www\.|https?:\/\/|广告)/i;
const MAX_READER_SECTION_CHARACTERS = 16000;

function normalizeChapterHeadingLength(value: number | undefined) {
  if (!Number.isFinite(value)) return MAX_CHAPTER_HEADING_LENGTH;
  return Math.min(Math.max(Math.round(value ?? MAX_CHAPTER_HEADING_LENGTH), 5), 80);
}

function normalizeHeadingConfidenceThreshold(value: number | undefined) {
  if (!Number.isFinite(value)) return 60;
  return Math.min(Math.max(Math.round(value ?? 60), 0), 100);
}

function normalizeCompactHeadingSuffixLength(value: number | undefined) {
  if (!Number.isFinite(value)) return 16;
  return Math.min(Math.max(Math.round(value ?? 16), 0), 40);
}

function normalizeBookTitleMaxLength(value: number | undefined) {
  if (!Number.isFinite(value)) return 80;
  return Math.min(Math.max(Math.round(value ?? 80), 5), 120);
}

function getReaderChapterParsingOptionsSignature(options: ReaderChapterParsingOptions = {}) {
  const normalized = {
    enabled: options.enabled !== false,
    maxHeadingLength: normalizeChapterHeadingLength(options.maxHeadingLength),
    minHeadingConfidence: normalizeHeadingConfidenceThreshold(options.minHeadingConfidence),
    enableChineseChapter: options.enableChineseChapter !== false,
    enableChineseVolume: options.enableChineseVolume !== false,
    enableSpecialHeadings: options.enableSpecialHeadings !== false,
    enableEnglishChapter: options.enableEnglishChapter !== false,
    enableCompactSplit: options.enableCompactSplit !== false,
    autoIgnoreAdHeadings: options.autoIgnoreAdHeadings !== false,
    autoIgnoreRepeatedTocHeadings: options.autoIgnoreRepeatedTocHeadings !== false,
    compactHeadingSuffixLength: normalizeCompactHeadingSuffixLength(options.compactHeadingSuffixLength),
    preserveCompactPrefixText: options.preserveCompactPrefixText !== false,
    autoDetectBookTitle: options.autoDetectBookTitle === true,
    bookTitleBracketMode: options.bookTitleBracketMode ?? 'book-title',
    customBookTitleBracketPattern: options.customBookTitleBracketPattern ?? '',
    bookTitleMaxLength: normalizeBookTitleMaxLength(options.bookTitleMaxLength),
    firstLineAsBookTitle: options.firstLineAsBookTitle === true,
    inferBookTitleFromFileName: options.inferBookTitleFromFileName !== false,
    paragraphMode: options.paragraphMode ?? 'line',
    shortLineMergeThreshold: Math.min(Math.max(Math.round(options.shortLineMergeThreshold ?? 18), 2), 80),
    longParagraphSliceSize: Math.min(Math.max(Math.round(options.longParagraphSliceSize ?? 1200), 1), 5000),
    forbiddenHeadingPunctuation: options.forbiddenHeadingPunctuation ?? DEFAULT_FORBIDDEN_HEADING_PUNCTUATION,
    forbiddenHeadingStartChars: options.forbiddenHeadingStartChars ?? DEFAULT_FORBIDDEN_HEADING_START_CHARS,
    customRegexRules: (options.customRegexRules ?? []).map((rule) => ({
      id: rule.id,
      name: rule.name,
      pattern: rule.pattern,
      enabled: rule.enabled,
      priority: rule.priority,
    })),
  };
  return getReaderParagraphHash(JSON.stringify(normalized));
}

function buildCompactChapterHeadingRegex(options: ReaderChapterParsingOptions = {}) {
  if (options.enableCompactSplit === false) return /$a/g;
  return new RegExp(`(第\\s*[一二三四五六七八九十百千万零〇两\\d]+\\s*[章节卷回部集篇][^第\\n\\r]{0,${normalizeCompactHeadingSuffixLength(options.compactHeadingSuffixLength)}})`, 'g');
}

function hasForbiddenHeadingPunctuation(line: string, punctuation = DEFAULT_FORBIDDEN_HEADING_PUNCTUATION) {
  if (!punctuation) return false;
  return Array.from(punctuation).some((char) => line.includes(char));
}

function startsWithForbiddenHeadingChar(line: string, startChars = DEFAULT_FORBIDDEN_HEADING_START_CHARS) {
  if (!startChars) return false;
  return Array.from(startChars).some((char) => line.startsWith(char));
}

function normalizeHeadingMatchText(line: string, options: ReaderChapterParsingOptions = {}) {
  const forbiddenStartChars = options.forbiddenHeadingStartChars ?? DEFAULT_FORBIDDEN_HEADING_START_CHARS;
  const allowedDecorators = Array.from(DEFAULT_FORBIDDEN_HEADING_START_CHARS).filter((char) => !forbiddenStartChars.includes(char));
  const firstChar = Array.from(line)[0] ?? '';
  return allowedDecorators.includes(firstChar) ? line.slice(firstChar.length).trimStart() : line;
}

export function matchReaderChapterRegexRule(line: string, options: ReaderChapterParsingOptions = {}): ReaderChapterRegexRule | null {
  if (options.enabled === false) return null;
  const trimmed = line.trim();
  if (!trimmed || !options.customRegexRules?.length) return null;
  const rules = options.customRegexRules
    .filter((rule) => rule.enabled && rule.pattern.trim())
    .sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    try {
      if (new RegExp(rule.pattern).test(trimmed)) return rule;
    } catch {
      continue;
    }
  }
  return null;
}

export function getReaderChapterHeadingConfidence(line: string, options: ReaderChapterParsingOptions = {}) {
  if (options.enabled === false) return 0;
  const trimmed = line.trim();
  if (!trimmed) return 0;
  if (matchReaderChapterRegexRule(trimmed, options)) return 98;
  if (isBuiltInChapterHeading(trimmed, options)) return 95;
  if (SHORT_CHAPTER_HEADING_RE.test(trimmed)) return 78;
  if (BARE_NUMERIC_CHAPTER_HEADING_RE.test(trimmed)) return 72;
  return 0;
}

function isAdLikeChapterHeading(line: string) {
  return AD_HEADING_RE.test(line);
}

function getRepeatedTocHeadingIndexes(lines: string[], options: ReaderChapterParsingOptions) {
  const indexes = new Set<number>();
  let run: number[] = [];
  function flushRun() {
    if (run.length >= 3) run.forEach((index) => indexes.add(index));
    run = [];
  }
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    if (isChapterHeading(line, { ...options, autoIgnoreRepeatedTocHeadings: false })) {
      run.push(index);
      return;
    }
    flushRun();
  });
  flushRun();
  return indexes;
}

export function buildReaderChapters(book: Book, options: ReaderChapterParsingOptions = {}): ReaderChapter[] {
  const lines = normalizeBookContent(book.content).split('\n').flatMap((line) => expandCompactChapterLine(line, options));
  const repeatedTocHeadingIndexes = options.autoIgnoreRepeatedTocHeadings === false ? new Set<number>() : getRepeatedTocHeadingIndexes(lines, options);
  const chapters: ReaderChapter[] = [];
  const resolvedBookTitle = resolveReaderBookTitle(book, options);
  let currentTitle = resolvedBookTitle;
  let currentStartLine = 0;
  let buffer: string[] = [];
  let lastHeading = '';
  let currentVolumeTitle = '';

  function pushChapter() {
    const paragraphs = buildParagraphs(buffer, options);
    if (paragraphs.length === 0) return;
    chapters.push(withReaderChapterTextStats({
      id: `reader-chapter-${chapters.length + 1}`,
      title: currentTitle,
      index: chapters.length,
      startLine: currentStartLine,
      paragraphs,
      volumeTitle: currentVolumeTitle,
    }));
  }

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) {
      buffer.push('');
      return;
    }
    const detectedBookTitle = options.autoDetectBookTitle !== false ? matchReaderBookTitleLine(line, options) : '';
    if (detectedBookTitle && chapters.length === 0 && buffer.filter(Boolean).length === 0) {
      currentTitle = detectedBookTitle;
      currentStartLine = lineIndex;
      lastHeading = line;
      return;
    }
    const ignoreHeading = (options.autoIgnoreAdHeadings !== false && isAdLikeChapterHeading(line)) || repeatedTocHeadingIndexes.has(lineIndex);
    if (!ignoreHeading && isVolumeHeading(line, options) && line !== lastHeading) {
      pushChapter();
      currentVolumeTitle = line;
      currentTitle = line;
      currentStartLine = lineIndex;
      buffer = [];
      lastHeading = line;
      return;
    }
    if (!ignoreHeading && isChapterHeading(line, options) && line !== lastHeading) {
      pushChapter();
      currentTitle = line;
      currentStartLine = lineIndex;
      buffer = [];
      lastHeading = line;
      return;
    }
    if (!ignoreHeading && isChapterHeading(line, options) && line === lastHeading) {
      return;
    }
    buffer.push(line);
  });

  pushChapter();

  if (chapters.length > 0) return splitOversizedReaderChapters(chapters);
  const fallback = buildParagraphs(lines, options);
  return splitOversizedReaderChapters([withReaderChapterTextStats({
    id: 'reader-chapter-1',
    title: resolvedBookTitle,
    index: 0,
    startLine: 0,
    paragraphs: fallback.length > 0 ? fallback : [book.content || ''],
    volumeTitle: '',
  })]);
}

export function buildReaderTocManifest(book: Book, options: ReaderChapterParsingOptions = {}, generatedAt = new Date().toISOString()): ReaderTocManifest {
  const chapters = buildReaderChapters(book, options);
  return buildReaderTocManifestFromChapters(book, chapters, options, generatedAt);
}

export function buildReaderTocManifestFromChapters(book: Book, chapters: ReaderChapter[], options: ReaderChapterParsingOptions = {}, generatedAt = new Date().toISOString()): ReaderTocManifest {
  const manifestChapters = normalizeReaderTocManifestChapters(chapters);
  return {
    schemaVersion: 1,
    parserVersion: String(parserVersion),
    contentHash: book.contentHash || getReaderParagraphHash(book.content || ''),
    optionsSignature: getReaderChapterParsingOptionsSignature(options),
    generatedAt,
    entries: manifestChapters.map((chapter, index) => ({
      id: getReaderBaseSectionId(chapter.id),
      title: stripReaderSectionTitleSuffix(chapter.title),
      index,
      startLine: chapter.startLine,
      endLine: manifestChapters[index + 1]?.startLine ?? Number.MAX_SAFE_INTEGER,
      volumeTitle: chapter.volumeTitle,
    })),
  };
}

export function getReaderChapterTextStats(paragraphs: string[]) {
  let hash = 2166136261;
  let length = 0;
  paragraphs.forEach((paragraph) => {
    length += paragraph.length;
    for (let index = 0; index < paragraph.length; index += 1) {
      hash ^= paragraph.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 10;
    hash = Math.imul(hash, 16777619);
  });
  return {
    characterCount: length,
    contentSignature: `${paragraphs.length}:${length}:${hash >>> 0}`,
  };
}

function withReaderChapterTextStats(chapter: ReaderChapter): ReaderChapter {
  return {
    ...chapter,
    ...getReaderChapterTextStats(chapter.paragraphs),
  };
}

function splitOversizedReaderChapters(chapters: ReaderChapter[], maxCharacters = MAX_READER_SECTION_CHARACTERS) {
  const safeMax = Math.max(4000, Math.floor(maxCharacters));
  const result: ReaderChapter[] = [];
  for (const chapter of chapters) {
    const totalCharacters = chapter.characterCount ?? chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
    if (totalCharacters <= safeMax) {
      result.push(withReaderChapterTextStats({ ...chapter, index: result.length }));
      continue;
    }
    let sectionParagraphs: string[] = [];
    let sectionCharacters = 0;
    let sectionIndex = 1;
    const pushSection = () => {
      if (!sectionParagraphs.length) return;
      const suffix = sectionIndex === 1 ? '' : ` · 第 ${sectionIndex} 节`;
      result.push(withReaderChapterTextStats({
        ...chapter,
        id: `${chapter.id}-section-${sectionIndex}`,
        title: `${chapter.title}${suffix}`,
        index: result.length,
        paragraphs: sectionParagraphs,
      }));
      sectionParagraphs = [];
      sectionCharacters = 0;
      sectionIndex += 1;
    };
    for (const paragraph of chapter.paragraphs) {
      if (sectionParagraphs.length && sectionCharacters + paragraph.length > safeMax) pushSection();
      sectionParagraphs.push(paragraph);
      sectionCharacters += paragraph.length;
    }
    pushSection();
  }
  return result;
}

export function summarizeReaderTocManifestDiff(previousManifest: ReaderTocManifest | null | undefined, nextManifest: ReaderTocManifest, sampleLimit = 5): ReaderTocManifestDiffSummary {
  const previousEntries = previousManifest?.entries ?? [];
  const nextEntries = nextManifest.entries;
  const previousByStartLine = new Map(previousEntries.map((entry) => [entry.startLine, entry]));
  const nextByStartLine = new Map(nextEntries.map((entry) => [entry.startLine, entry]));
  const added = nextEntries.filter((entry) => !previousByStartLine.has(entry.startLine));
  const removed = previousEntries.filter((entry) => !nextByStartLine.has(entry.startLine));
  const renamed = nextEntries
    .map((entry) => {
      const previous = previousByStartLine.get(entry.startLine);
      if (!previous || previous.title === entry.title) return null;
      return { from: previous.title, to: entry.title };
    })
    .filter((entry): entry is { from: string; to: string } => Boolean(entry));
  const previousIndexByStartLine = new Map(previousEntries.map((entry, index) => [entry.startLine, index]));
  const moved = nextEntries.filter((entry, index) => {
    const previousIndex = previousIndexByStartLine.get(entry.startLine);
    return previousIndex !== undefined && previousIndex !== index;
  });
  const limit = Math.max(0, Math.floor(sampleLimit));
  return {
    previousCount: previousEntries.length,
    nextCount: nextEntries.length,
    addedCount: added.length,
    removedCount: removed.length,
    renamedCount: renamed.length,
    movedCount: moved.length,
    addedTitles: added.slice(0, limit).map((entry) => entry.title),
    removedTitles: removed.slice(0, limit).map((entry) => entry.title),
    renamedTitles: renamed.slice(0, limit),
    movedTitles: moved.slice(0, limit).map((entry) => entry.title),
  };
}

export function buildReaderChaptersFromTocManifest(book: Book, manifest: ReaderTocManifest | null | undefined, options: ReaderChapterParsingOptions = {}): ReaderChapter[] | null {
  if (!isReaderTocManifestValidForBook(book, manifest, options)) return null;
  const safeManifest = manifest;
  const manifestEntries = normalizeReaderTocManifestEntries(safeManifest.entries);
  const lines = normalizeBookContent(book.content).split('\n').flatMap((line) => expandCompactChapterLine(line, options));
  const chapters = manifestEntries.map((entry, index) => {
    const startLine = Math.min(Math.max(0, Math.floor(entry.startLine)), lines.length);
    const nextStartLine = manifestEntries[index + 1]?.startLine ?? lines.length;
    const rawEndLine = Number.isFinite(entry.endLine) && entry.endLine !== Number.MAX_SAFE_INTEGER ? entry.endLine : nextStartLine;
    const endLine = Math.min(Math.max(startLine, Math.floor(rawEndLine)), lines.length);
    const paragraphs = buildParagraphs(lines.slice(startLine + 1, endLine), options);
    return withReaderChapterTextStats({
      id: getReaderBaseSectionId(entry.id || `reader-chapter-${index + 1}`),
      title: stripReaderSectionTitleSuffix(entry.title) || book.displayTitle || book.title || '正文',
      index,
      startLine,
      paragraphs,
      volumeTitle: entry.volumeTitle,
    });
  }).filter((chapter) => chapter.paragraphs.length > 0 || chapter.title.trim());
  return chapters.length ? splitOversizedReaderChapters(chapters) : null;
}

function getReaderBaseSectionId(id: string) {
  return id.replace(/(?:-section-\d+)+$/u, '');
}

function stripReaderSectionTitleSuffix(title: string) {
  return title.replace(/(?:\s*·\s*第\s*\d+\s*节)+$/u, '').trim();
}

function normalizeReaderTocManifestChapters(chapters: ReaderChapter[]) {
  const seen = new Set<string>();
  return chapters.flatMap((chapter) => {
    const baseId = getReaderBaseSectionId(chapter.id);
    const key = `${baseId}:${chapter.startLine}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...chapter, id: baseId, title: stripReaderSectionTitleSuffix(chapter.title) }];
  });
}

function normalizeReaderTocManifestEntries(entries: ReaderTocManifest['entries']) {
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const baseId = getReaderBaseSectionId(entry.id || '');
    const key = `${baseId || stripReaderSectionTitleSuffix(entry.title)}:${entry.startLine}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...entry, id: baseId || entry.id, title: stripReaderSectionTitleSuffix(entry.title) }];
  });
}

export function isReaderTocManifestValidForBook(book: Book, manifest: ReaderTocManifest | null | undefined, options: ReaderChapterParsingOptions = {}): manifest is ReaderTocManifest {
  if (!manifest || manifest.schemaVersion !== 1) return false;
  if (manifest.parserVersion !== String(parserVersion)) return false;
  if (manifest.contentHash !== (book.contentHash || getReaderParagraphHash(book.content || ''))) return false;
  if (manifest.optionsSignature !== getReaderChapterParsingOptionsSignature(options)) return false;
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) return false;
  return manifest.entries.every((entry) => typeof entry.title === 'string' && Number.isFinite(entry.startLine));
}

function getReaderChapterBuiltInRule(matchText: string, options: ReaderChapterParsingOptions) {
  if (isVolumeHeading(matchText, options)) return 'volume-heading';
  if (isBuiltInChapterHeading(matchText, options)) return 'standard-chapter';
  if (SHORT_CHAPTER_HEADING_RE.test(matchText)) return 'short-numbered-heading';
  if (BARE_NUMERIC_CHAPTER_HEADING_RE.test(matchText)) return 'bare-numeric-heading';
  return '';
}

function getReaderChapterDiagnosticMatch(line: string, options: ReaderChapterParsingOptions): Pick<ReaderChapterRuleMatch, 'rule' | 'confidence'> | null {
  const matchText = normalizeHeadingMatchText(line, options);
  const customRule = matchReaderChapterRegexRule(matchText, options);
  if (customRule) return { rule: `custom-regex:${customRule.name || customRule.id}`, confidence: getReaderChapterHeadingConfidence(matchText, options) };
  const builtInRule = getReaderChapterBuiltInRule(matchText, options);
  if (!builtInRule) return null;
  return { rule: builtInRule, confidence: getReaderChapterHeadingConfidence(matchText, options) };
}

function getReaderChapterUnmatchedReason(line: string, options: ReaderChapterParsingOptions, repeatedTocHeadingIndexes: Set<number>, lineIndex: number): ReaderChapterDiagnosticReason {
  const maxHeadingLength = normalizeChapterHeadingLength(options.maxHeadingLength);
  if (line.length > maxHeadingLength) return 'too-long';
  if (startsWithForbiddenHeadingChar(line, options.forbiddenHeadingStartChars)) return 'forbidden-start';
  const matchText = normalizeHeadingMatchText(line, options);
  if (options.autoIgnoreAdHeadings && isAdLikeChapterHeading(matchText)) return 'ad-heading';
  if (repeatedTocHeadingIndexes.has(lineIndex)) return 'repeated-toc';
  if (getReaderChapterHeadingConfidence(matchText, options) < normalizeHeadingConfidenceThreshold(options.minHeadingConfidence)) return 'confidence-below-threshold';
  if (hasForbiddenHeadingPunctuation(matchText, options.forbiddenHeadingPunctuation)) return 'forbidden-punctuation';
  return 'no-rule-match';
}

function isReaderChapterDiagnosticCandidate(line: string, options: ReaderChapterParsingOptions) {
  const matchText = normalizeHeadingMatchText(line, options);
  return Boolean(
    matchReaderChapterRegexRule(matchText, options)
    || isBuiltInChapterHeading(matchText, options)
    || SHORT_CHAPTER_HEADING_RE.test(matchText)
    || BARE_NUMERIC_CHAPTER_HEADING_RE.test(matchText)
    || /^第\s*[一二三四五六七八九十百千万零〇两\d]+/.test(matchText)
    || /^(?:chapter|part|book|volume)\s+\d+/i.test(matchText)
  );
}

export function buildReaderChapterDiagnostics(
  book: Book,
  options: ReaderChapterParsingOptions = {},
  diagnosticsOptions: ReaderChapterDiagnosticsOptions = {},
): ReaderChapterDiagnostics {
  const sampleLimit = Math.max(1, Math.floor(diagnosticsOptions.sampleLimit ?? 20));
  const shortChapterCharacterThreshold = Math.max(0, Math.floor(diagnosticsOptions.shortChapterCharacterThreshold ?? 120));
  const longChapterCharacterThreshold = Math.max(shortChapterCharacterThreshold + 1, Math.floor(diagnosticsOptions.longChapterCharacterThreshold ?? 20000));
  const lines = normalizeBookContent(book.content).split('\n').flatMap((line) => expandCompactChapterLine(line, options));
  const repeatedTocHeadingIndexes = options.autoIgnoreRepeatedTocHeadings === false ? new Set<number>() : getRepeatedTocHeadingIndexes(lines, options);
  const ruleMatches: ReaderChapterRuleMatch[] = [];
  const unmatchedSamples: ReaderChapterUnmatchedSample[] = [];

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    const ignoreHeading = (options.autoIgnoreAdHeadings === true && isAdLikeChapterHeading(normalizeHeadingMatchText(line, options))) || repeatedTocHeadingIndexes.has(lineIndex);
    const match = !ignoreHeading && isChapterHeading(line, options) ? getReaderChapterDiagnosticMatch(line, options) : null;
    if (match) {
      if (ruleMatches.length < sampleLimit) ruleMatches.push({ lineIndex, line, rule: match.rule, confidence: match.confidence });
      return;
    }
    if (unmatchedSamples.length < sampleLimit && isReaderChapterDiagnosticCandidate(line, options)) {
      unmatchedSamples.push({
        lineIndex,
        line,
        reason: getReaderChapterUnmatchedReason(line, options, repeatedTocHeadingIndexes, lineIndex),
        confidence: getReaderChapterHeadingConfidence(normalizeHeadingMatchText(line, options), options),
      });
    }
  });

  const chapters = buildReaderChapters(book, options);
  const chapterSizes = chapters.map((chapter) => ({
    chapterId: chapter.id,
    sourceChapterIndex: chapter.index,
    title: chapter.title,
    characters: chapter.paragraphs.join('').length,
  }));
  const chapterPreview = chapters.slice(0, sampleLimit).map((chapter, index) => ({
    chapterId: chapter.id,
    sourceChapterIndex: chapter.index,
    title: chapter.title,
    startLine: chapter.startLine,
    endLine: chapters[index + 1]?.startLine ?? lines.length,
    paragraphCount: chapter.paragraphs.length,
    characters: chapter.paragraphs.join('').length,
    volumeTitle: chapter.volumeTitle,
  }));
  const totalCharacters = chapterSizes.reduce((sum, chapter) => sum + chapter.characters, 0);

  return {
    parserVersion: String(parserVersion),
    options: { ...options, customRegexRules: options.customRegexRules?.map((rule) => ({ ...rule })) },
    stats: {
      chapterCount: chapters.length,
      totalCharacters,
      averageCharacters: chapters.length ? Math.round(totalCharacters / chapters.length) : 0,
    },
    hashManifest: buildReaderChapterHashManifest(chapters),
    chapterPreview,
    ruleMatches,
    unmatchedSamples,
    shortChapters: chapterSizes.filter((chapter) => chapter.characters <= shortChapterCharacterThreshold).slice(0, sampleLimit),
    longChapters: chapterSizes.filter((chapter) => chapter.characters >= longChapterCharacterThreshold).slice(0, sampleLimit),
  };
}

export function cleanTxtContent(content: string, options: TxtCleanupOptions) {
  const originalContent = normalizeBookContent(content);
  const baseAdLineRe = /(?:请收藏|最新网址|手机用户请浏览)/i;
  const adUrlRe = /(?:www\.|https?:\/\/|\b[a-z0-9-]+\.(?:com|net|org|cn)\b)/i;
  const paginationNoiseRe = /(?:点击下一页|本章未完)/i;
  const customAdKeywords = (options.adKeywords ?? []).map((keyword) => keyword.trim()).filter(Boolean);
  const customCleanupRules = (options.customCleanupRules ?? [])
    .filter((rule) => rule.enabled && rule.pattern.trim())
    .sort((a, b) => a.priority - b.priority);
  const shouldRemoveAdLine = (line: string) => {
    if (!options.removeAds) return false;
    if (baseAdLineRe.test(line)) return true;
    if (options.removeAdUrls !== false && adUrlRe.test(line)) return true;
    if (options.removePaginationNoise !== false && paginationNoiseRe.test(line)) return true;
    return customAdKeywords.some((keyword) => line.includes(keyword));
  };
  const applyCustomCleanupRules = (line: string) => {
    let next = line;
    for (const rule of customCleanupRules) {
      try {
        const expression = new RegExp(rule.pattern, 'g');
        if (rule.mode === 'remove-line' && expression.test(next)) return null;
        if (rule.mode === 'replace') next = next.replace(expression, rule.replacement);
      } catch {
        continue;
      }
    }
    return line.trim() && !next.trim() ? null : next;
  };
  const lines = originalContent
    .split('\n')
    .map((line) => options.normalizeFullWidthSpaces ? line.replace(/\u3000/g, ' ') : line)
    .map((line) => options.trimTrailingWhitespace === false ? line : line.trimEnd())
    .filter((line) => !shouldRemoveAdLine(line))
    .map(applyCustomCleanupRules)
    .filter((line): line is string => line !== null);
  const cleaned = options.normalizeBlankLines ? collapseBlankLines(lines) : lines;
  const cleanedText = cleaned.join('\n').trim();
  if (!cleanedText && originalContent.trim()) return originalContent.trim();
  return cleanedText;
}

export function formatReaderChapterTitle(title: string, cleanup: ReaderTitleNumberCleanup = 'keep') {
  const trimmed = title.trim();
  if (cleanup !== 'strip-number') return trimmed;
  const stripped = trimmed
    .replace(/^第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[章节回卷部集篇]\s*[-—:：、.\s]*/i, '')
    .replace(/^chapter\s+\d+\s*[-—:：、.\s]*/i, '')
    .replace(/^\d+\s*[.、)]\s*/, '')
    .trim();
  return stripped || trimmed;
}

export function buildReaderChapterHashManifest(chapters: ReaderChapter[]) {
  return chapters.map((chapter) => ({ chapterId: chapter.id, sourceChapterIndex: chapter.index, hash: getReaderParagraphHash(chapter.paragraphs.join('\n')) }));
}

export function estimateLongParagraphSlices(text: string, size = 1200) {
  const slices: Array<{ startOffset: number; endOffset: number }> = [];
  for (let startOffset = 0; startOffset < text.length; startOffset += size) slices.push({ startOffset, endOffset: Math.min(text.length, startOffset + size) });
  return slices;
}

export function getReaderParagraphHash(paragraph: string) {
  let hash = 2166136261;
  for (let index = 0; index < paragraph.length; index += 1) {
    hash ^= paragraph.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `1:${paragraph.length}:${hash >>> 0}`;
}

export function isChapterHeading(line: string, options: ReaderChapterParsingOptions = {}) {
  if (options.enabled === false) return false;
  const trimmed = line.trim();
  const maxHeadingLength = normalizeChapterHeadingLength(options.maxHeadingLength);
  if (trimmed.length === 0 || trimmed.length > maxHeadingLength) return false;
  if (startsWithForbiddenHeadingChar(trimmed, options.forbiddenHeadingStartChars)) return false;
  const matchText = normalizeHeadingMatchText(trimmed, options);
  if (options.autoIgnoreAdHeadings && isAdLikeChapterHeading(matchText)) return false;
  if (getReaderChapterHeadingConfidence(matchText, options) < normalizeHeadingConfidenceThreshold(options.minHeadingConfidence)) return false;
  if (matchReaderChapterRegexRule(matchText, options)) return true;
  if (SHORT_CHAPTER_HEADING_RE.test(matchText) || BARE_NUMERIC_CHAPTER_HEADING_RE.test(matchText)) return true;
  if (hasForbiddenHeadingPunctuation(matchText, options.forbiddenHeadingPunctuation)) return false;
  return isBuiltInChapterHeading(matchText, options);
}

export function isVolumeHeading(title: string, options: ReaderChapterParsingOptions = {}) {
  if (options.enabled === false || options.enableChineseVolume === false) return false;
  const trimmed = title.trim();
  const maxHeadingLength = normalizeChapterHeadingLength(options.maxHeadingLength);
  if (trimmed.length === 0 || trimmed.length > maxHeadingLength) return false;
  if (startsWithForbiddenHeadingChar(trimmed, options.forbiddenHeadingStartChars)) return false;
  const matchText = normalizeHeadingMatchText(trimmed, options);
  if (hasForbiddenHeadingPunctuation(matchText, options.forbiddenHeadingPunctuation)) return false;
  if (/[！，,.!?？]/.test(matchText)) return false;
  return /^第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[卷部集篇]/.test(matchText);
}

function isBuiltInChapterHeading(line: string, options: ReaderChapterParsingOptions = {}) {
  if (options.enableChineseChapter !== false && CHINESE_CHAPTER_HEADING_RE.test(line)) return true;
  if (options.enableSpecialHeadings !== false && SPECIAL_CHAPTER_HEADING_RE.test(line)) return true;
  if (options.enableEnglishChapter !== false && ENGLISH_CHAPTER_HEADING_RE.test(line)) return true;
  return false;
}

function normalizeBookContent(content: string) {
  return content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function expandCompactChapterLine(line: string, options: ReaderChapterParsingOptions = {}) {
  if (options.enabled === false || options.enableCompactSplit === false) return [line];
  const trimmed = line.trim();
  if (isChapterHeading(trimmed, options)) return [line];
  if (hasForbiddenHeadingPunctuation(trimmed, options.forbiddenHeadingPunctuation)) return [line];
  const matches = [...trimmed.matchAll(buildCompactChapterHeadingRegex(options))];
  if (matches.length === 0) return [line];
  const result: string[] = [];
  let cursor = 0;
  for (const match of matches) {
    const index = match.index ?? 0;
    const before = trimmed.slice(cursor, index).trim();
    if (before && options.preserveCompactPrefixText !== false) result.push(before);
    const heading = match[1].trim();
    if (isChapterHeading(heading, options)) result.push(heading);
    else result.push(trimmed.slice(index, index + match[1].length).trim());
    cursor = index + match[1].length;
  }
  const rest = trimmed.slice(cursor).trim();
  if (rest) result.push(rest);
  return result;
}

export function previewReaderCompactChapterSplit(line: string, options: ReaderChapterParsingOptions = {}) {
  return expandCompactChapterLine(line, options).map((part) => part.trim()).filter(Boolean);
}

function getFileNameTitle(fileName: string) {
  return fileName.replace(/\.[^.\\/]+$/, '').trim();
}

function matchReaderBookTitleLine(line: string, options: ReaderChapterParsingOptions = {}) {
  const trimmed = line.trim();
  const mode = options.bookTitleBracketMode ?? 'both';
  const maxLength = normalizeBookTitleMaxLength(options.bookTitleMaxLength);
  const matchers: RegExp[] = [];
  if (mode === 'book-title' || mode === 'both') matchers.push(BOOK_TITLE_MARK_RE);
  if (mode === 'angle' || mode === 'both') matchers.push(ANGLE_BOOK_TITLE_RE);
  if (mode === 'custom' && options.customBookTitleBracketPattern?.trim()) {
    try {
      matchers.push(new RegExp(options.customBookTitleBracketPattern));
    } catch {
      // Ignore invalid custom title patterns.
    }
  }
  for (const matcher of matchers) {
    const match = trimmed.match(matcher);
    const title = (match?.[1] ?? '').trim();
    if (title && title.length <= maxLength) return title;
  }
  return '';
}

export function resolveReaderBookTitle(book: Book, options: ReaderChapterParsingOptions = {}) {
  const maxLength = normalizeBookTitleMaxLength(options.bookTitleMaxLength);
  const firstLine = normalizeBookContent(book.content).split('\n').find((line) => line.trim())?.trim() ?? '';
  if (options.autoDetectBookTitle !== false) {
    const bracketTitle = matchReaderBookTitleLine(firstLine, options);
    if (bracketTitle) return bracketTitle;
  }
  if (options.firstLineAsBookTitle && firstLine && firstLine.length <= maxLength && !isChapterHeading(firstLine, options)) return firstLine;
  if (options.inferBookTitleFromFileName) {
    const fileTitle = getFileNameTitle(book.fileName);
    if (fileTitle && fileTitle.length <= maxLength) return fileTitle;
  }
  return book.displayTitle || book.title || '正文';
}

function collapseBlankLines(lines: string[]) {
  const result: string[] = [];
  let blank = false;
  for (const line of lines) {
    if (!line.trim()) {
      if (!blank) result.push('');
      blank = true;
      continue;
    }
    result.push(line);
    blank = false;
  }
  return result;
}

function buildParagraphs(lines: string[], options: ReaderChapterParsingOptions = {}) {
  const mode = options.paragraphMode ?? 'line';
  const shortLineMergeThreshold = Math.min(Math.max(Math.round(options.shortLineMergeThreshold ?? 18), 2), 80);
  const rawLongParagraphSliceSize = Number(options.longParagraphSliceSize ?? 1200);
  const longParagraphSliceSize = Number.isFinite(rawLongParagraphSliceSize) ? Math.min(Math.max(Math.round(rawLongParagraphSliceSize), 1), 5000) : 1200;
  if (mode === 'blank-line') {
    const paragraphs: string[] = [];
    let buffer: string[] = [];
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        if (buffer.length) paragraphs.push(buffer.join('\n'));
        buffer = [];
        return;
      }
      buffer.push(line);
    });
    if (buffer.length) paragraphs.push(buffer.join('\n'));
    return sliceLongParagraphs(mergeStandaloneEpubNoteRefParagraphs(paragraphs), longParagraphSliceSize);
  }
  if (mode === 'merge-short-lines') {
    const paragraphs: string[] = [];
    let buffer = '';
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        if (buffer) paragraphs.push(buffer);
        buffer = '';
        return;
      }
      if (line.length <= shortLineMergeThreshold) {
        buffer += line;
        return;
      }
      if (buffer) paragraphs.push(buffer);
      buffer = '';
      paragraphs.push(line);
    });
    if (buffer) paragraphs.push(buffer);
    return sliceLongParagraphs(mergeStandaloneEpubNoteRefParagraphs(paragraphs), longParagraphSliceSize);
  }
  if (mode === 'chinese-reflow') {
    const paragraphs: string[] = [];
    let buffer = '';
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        if (buffer) paragraphs.push(buffer);
        buffer = '';
        return;
      }
      buffer = joinChineseReflowLine(buffer, line);
    });
    if (buffer) paragraphs.push(buffer);
    return sliceLongParagraphs(mergeStandaloneEpubNoteRefParagraphs(paragraphs), longParagraphSliceSize);
  }
  const paragraphs: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line) paragraphs.push(line);
  }
  return sliceLongParagraphs(mergeStandaloneEpubNoteRefParagraphs(paragraphs), longParagraphSliceSize);
}

function mergeStandaloneEpubNoteRefParagraphs(paragraphs: string[]) {
  const noteRefRe = /^\[\[BOOKMIND_EPUB_NOTE_REF:[^\]\n]+\]\]$/;
  const noteRefEndRe = /\[\[BOOKMIND_EPUB_NOTE_REF:[^\]\n]+\]\]$/;
  const noteTargetOnlyRe = /^\[\[BOOKMIND_EPUB_NOTE_TARGET:[^\]\n]+\]\]$/;
  const noteTargetWithReturnRefRe = /^(\[\[BOOKMIND_EPUB_NOTE_TARGET:[^\]\n]+\]\])\[\[BOOKMIND_EPUB_NOTE_REF:[^\]\n]+\]\]$/;
  const punctuationContinuationRe = /^[、，,。；;：:！？!?）】》」』…—-]/;
  const merged: string[] = [];
  for (const paragraph of paragraphs) {
    const targetWithReturnRefMatch = paragraph.match(noteTargetWithReturnRefRe);
    if (targetWithReturnRefMatch) {
      merged.push(targetWithReturnRefMatch[1] ?? paragraph);
      continue;
    }
    if (noteRefRe.test(paragraph) && merged.length && noteTargetOnlyRe.test(merged[merged.length - 1])) {
      continue;
    }
    if (noteRefRe.test(paragraph) && merged.length) {
      merged[merged.length - 1] += paragraph;
      continue;
    }
    if (punctuationContinuationRe.test(paragraph) && merged.length && noteRefEndRe.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += paragraph;
      continue;
    }
    if (merged.length && noteTargetOnlyRe.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += paragraph;
      continue;
    }
    merged.push(paragraph);
  }
  return merged;
}

function joinChineseReflowLine(buffer: string, line: string) {
  if (!buffer) return line;
  if (/[A-Za-z0-9]$/.test(buffer) && /^[A-Za-z0-9]/.test(line)) return `${buffer} ${line}`;
  return `${buffer}${line}`;
}

function sliceLongParagraphs(paragraphs: string[], size: number) {
  return paragraphs.flatMap((paragraph) => (
    paragraph.length > size
      ? estimateLongParagraphSlices(paragraph, size).map((slice) => paragraph.slice(slice.startOffset, slice.endOffset))
      : [paragraph]
  ));
}

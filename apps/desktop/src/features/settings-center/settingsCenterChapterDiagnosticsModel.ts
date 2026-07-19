import type { ReaderChapterParsingOptions } from '../reader-core/readerModel';
import type { ChapterRuleDraft } from '../../services/settingsCenterService';
import type { Book } from '../../types';

export function createChapterDiagnosticsSampleBook(content: string): Book {
  return {
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
    contentHash: `sample:${content.length}`,
    importedAt: '',
    shelfGroups: [],
    content,
    chunks: [],
  };
}

export function buildChapterParsingOptions(chapterRules: ChapterRuleDraft): ReaderChapterParsingOptions {
  return {
    enabled: chapterRules.enabled,
    maxHeadingLength: chapterRules.maxHeadingLength,
    minHeadingConfidence: chapterRules.minHeadingConfidence,
    enableChineseChapter: chapterRules.enableChineseChapter,
    enableChineseVolume: chapterRules.enableChineseVolume,
    enableSpecialHeadings: chapterRules.enableSpecialHeadings,
    enableEnglishChapter: chapterRules.enableEnglishChapter,
    enableCompactSplit: chapterRules.enableCompactSplit,
    autoIgnoreAdHeadings: chapterRules.autoIgnoreAdHeadings,
    autoIgnoreRepeatedTocHeadings: chapterRules.autoIgnoreRepeatedTocHeadings,
    compactHeadingSuffixLength: chapterRules.compactHeadingSuffixLength,
    preserveCompactPrefixText: chapterRules.preserveCompactPrefixText,
    autoDetectBookTitle: chapterRules.autoDetectBookTitle,
    bookTitleBracketMode: chapterRules.bookTitleBracketMode,
    customBookTitleBracketPattern: chapterRules.customBookTitleBracketPattern,
    bookTitleMaxLength: chapterRules.bookTitleMaxLength,
    firstLineAsBookTitle: chapterRules.firstLineAsBookTitle,
    inferBookTitleFromFileName: chapterRules.inferBookTitleFromFileName,
    paragraphMode: chapterRules.paragraphMode,
    shortLineMergeThreshold: chapterRules.shortLineMergeThreshold,
    longParagraphSliceSize: chapterRules.longParagraphSliceSize,
    forbiddenHeadingPunctuation: chapterRules.forbiddenHeadingPunctuation,
    forbiddenHeadingStartChars: chapterRules.forbiddenHeadingStartChars,
    customRegexRules: chapterRules.customRegexRules,
  };
}

import type { CharacterEvidence, CharacterLocation, ReaderNoteLocation, SearchResult } from '../../types';

export type CharacterEvidenceResolvedReaderLocation = ReaderNoteLocation & {
  sourceChapterIndex: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
};

export type CharacterEvidenceReaderOpenDetail = {
  result: SearchResult;
  readerLocation: CharacterEvidenceResolvedReaderLocation;
};

export type CharacterLocationReaderOpenOptions = {
  bookId: string;
  bookTitle?: string;
  label?: string;
  snippet?: string;
  score?: number;
};

export function buildCharacterEvidenceReaderLocation(evidence: CharacterEvidence): CharacterEvidenceResolvedReaderLocation | null {
  return buildCharacterReaderLocation(evidence.location, evidence.bookId);
}

export function buildCharacterReaderLocation(characterLocation: CharacterLocation, fallbackBookId: string): CharacterEvidenceResolvedReaderLocation | null {
  const location = characterLocation.readerLocation ?? characterLocation;
  if (
    typeof location.sourceChapterIndex !== 'number'
    || typeof location.paragraphIndex !== 'number'
    || typeof location.startOffset !== 'number'
    || typeof location.endOffset !== 'number'
  ) {
    return null;
  }
  const readerLocation: CharacterEvidenceResolvedReaderLocation = {
    bookId: location.bookId || fallbackBookId,
    sourceChapterIndex: location.sourceChapterIndex,
    paragraphIndex: location.paragraphIndex,
    startOffset: location.startOffset,
    endOffset: location.endOffset,
  };
  if (location.chapterId) readerLocation.chapterId = location.chapterId;
  return readerLocation;
}

export function buildCharacterEvidenceSearchResult(evidence: CharacterEvidence, options: { bookTitle?: string } = {}): SearchResult | null {
  const readerLocation = buildCharacterEvidenceReaderLocation(evidence);
  if (!readerLocation) return null;
  const chapterTitle = evidence.location.chapterTitle?.trim() || `第 ${readerLocation.sourceChapterIndex + 1} 章`;
  return {
    chunkId: evidence.location.chunkId,
    bookId: readerLocation.bookId,
    bookTitle: options.bookTitle ?? '',
    chapter: chapterTitle,
    sourceChapterIndex: readerLocation.sourceChapterIndex,
    chapterTitle,
    snippet: evidence.quote.trim() || evidence.claim,
    score: evidence.confidence,
    paragraphIndex: readerLocation.paragraphIndex,
    startOffset: readerLocation.startOffset,
    endOffset: readerLocation.endOffset,
  };
}

export function buildCharacterEvidenceReaderOpenDetail(evidence: CharacterEvidence, options: { bookTitle?: string } = {}): CharacterEvidenceReaderOpenDetail | null {
  return buildCharacterLocationReaderOpenDetail(evidence.location, {
    bookId: evidence.bookId,
    bookTitle: options.bookTitle,
    snippet: evidence.quote.trim() || evidence.claim,
    score: evidence.confidence,
  });
}

export function buildCharacterLocationReaderOpenDetail(
  location: CharacterLocation,
  options: CharacterLocationReaderOpenOptions,
): CharacterEvidenceReaderOpenDetail | null {
  const readerLocation = buildCharacterReaderLocation(location, options.bookId);
  if (!readerLocation) return null;
  const chapterTitle = location.chapterTitle?.trim() || `第 ${readerLocation.sourceChapterIndex + 1} 章`;
  const result: SearchResult = {
    chunkId: location.chunkId ?? `${readerLocation.bookId}:character-location:${readerLocation.sourceChapterIndex}:${readerLocation.paragraphIndex}`,
    bookId: readerLocation.bookId,
    bookTitle: options.bookTitle ?? '',
    chapter: chapterTitle,
    sourceChapterIndex: readerLocation.sourceChapterIndex,
    chapterTitle,
    snippet: options.snippet?.trim() || options.label || chapterTitle,
    score: options.score ?? 1,
    paragraphIndex: readerLocation.paragraphIndex,
    startOffset: readerLocation.startOffset,
    endOffset: readerLocation.endOffset,
  };
  return { result, readerLocation };
}

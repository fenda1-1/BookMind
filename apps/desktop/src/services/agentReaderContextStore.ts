import type { ReaderChapter } from '../features/reader-core/readerModel';
import type { Book, TextChunk } from '../types';

type AgentReaderBookSnapshot = {
  bookId: string;
  contentHash: string;
  chapters: ReaderChapter[];
  updatedAt: number;
};

const readerBookSnapshots = new Map<string, AgentReaderBookSnapshot>();

export function rememberAgentReaderBookSnapshot(input: { book: Book | null; chapters: ReaderChapter[] }) {
  const { book, chapters } = input;
  if (!book || !chapters.length) return;
  readerBookSnapshots.set(book.id, {
    bookId: book.id,
    contentHash: book.contentHash,
    chapters,
    updatedAt: Date.now(),
  });
}

export function forgetAgentReaderBookSnapshot(bookId: string) {
  readerBookSnapshots.delete(bookId);
}

export function getAgentReaderBookForTools(book: Book): Book {
  if (book.chunks.length > 0) return book;
  const snapshot = readerBookSnapshots.get(book.id);
  if (!snapshot || snapshot.contentHash !== book.contentHash || !snapshot.chapters.length) return book;
  const chunks = buildAgentChunksFromReaderChapters(book, snapshot.chapters);
  if (!chunks.length) return book;
  return {
    ...book,
    chunks,
    content: book.content || chunks.map((chunk) => chunk.text).join('\n\n'),
  };
}

export function buildAgentChunksFromReaderChapters(book: Book, chapters: ReaderChapter[]): TextChunk[] {
  let charOffset = 0;
  return chapters
    .filter((chapter) => chapter.paragraphs.length || chapter.title.trim())
    .map((chapter, ordinal) => {
      const text = chapter.paragraphs.join('\n\n').trim();
      const charStart = charOffset;
      const charEnd = charStart + text.length;
      charOffset = charEnd + 2;
      return {
        id: `${book.id}:reader-chapter:${chapter.index}`,
        bookId: book.id,
        bookTitle: book.displayTitle || book.title,
        chapter: chapter.title,
        ordinal,
        text,
        chapterIndex: chapter.index,
        chapterTitle: chapter.title,
        paragraphStart: 0,
        paragraphEnd: Math.max(0, chapter.paragraphs.length - 1),
        charStart,
        charEnd,
        contentHash: book.contentHash,
        chunkStrategyVersion: 2,
        createdAt: String(Date.now()),
      };
    });
}

import type { Book, SearchResult } from '../../types';

export const allSearchBooksFilterValue = '__all__';

export type SearchBookFilterOption = {
  value: string;
  label: string;
  count: number;
};

export function buildSearchBookFilterOptions(books: Book[], results: SearchResult[], options: { currentBookId?: string } = {}): SearchBookFilterOption[] {
  const countByBook = new Map<string, number>();
  for (const result of results) {
    const bookId = result.bookId.trim();
    if (!bookId) continue;
    countByBook.set(bookId, (countByBook.get(bookId) ?? 0) + 1);
  }
  const allOption = {
    value: allSearchBooksFilterValue,
    label: '全部书籍',
    count: results.length,
  };
  const indexedBooks = books
    .filter((book) => !book.deleted)
    .map((book, index) => ({
      value: book.id,
      label: book.id === options.currentBookId ? `当前书籍：${book.displayTitle || book.title || book.id}` : book.displayTitle || book.title || book.id,
      count: countByBook.get(book.id) ?? 0,
      index,
    }))
    .sort((left, right) => {
      if (left.value === options.currentBookId) return -1;
      if (right.value === options.currentBookId) return 1;
      return left.index - right.index;
    })
    .map(({ index: _index, ...option }) => option);
  return [allOption, ...indexedBooks];
}

export function filterSearchResultsByBook(results: SearchResult[], selectedBookId: string) {
  if (!selectedBookId || selectedBookId === allSearchBooksFilterValue) return results;
  return results.filter((result) => result.bookId === selectedBookId);
}

export type ReaderLocalStorageCleanupPlan = {
  keys: string[];
  prefixes: string[];
};

export function readerPageCacheLocalStoragePrefix(bookId: string) {
  return `bookmind:reader-page-cache:${bookId}:`;
}

export function buildReaderCacheLocalStoragePlanForBook(bookId: string): ReaderLocalStorageCleanupPlan {
  return {
    keys: [
      `bookmind:reader-state:${bookId}`,
      `bookmind:reader-window:${bookId}`,
    ],
    prefixes: [
      readerPageCacheLocalStoragePrefix(bookId),
    ],
  };
}

export function buildAllReaderCacheLocalStoragePrefixes() {
  return [
    'bookmind:reader-state:',
    'bookmind:reader-window:',
    'bookmind:reader-page-cache:',
  ];
}

export function buildCurrentBookAllDataLocalStoragePlan(bookId: string): ReaderLocalStorageCleanupPlan {
  return {
    keys: [
      `bookmind:reader-state:${bookId}`,
      `bookmind:reader-window:${bookId}`,
      `bookmind:reader-highlights:${bookId}`,
      `bookmind:reader-bookmarks:${bookId}`,
      `bookmind:reader-highlight-color:${bookId}`,
      `bookmind:reader-toc-edits:${bookId}`,
      `bookmind:reader-highlights-index:${bookId}`,
    ],
    prefixes: [
      `bookmind:reader-highlight-entry:${bookId}:`,
      readerPageCacheLocalStoragePrefix(bookId),
    ],
  };
}

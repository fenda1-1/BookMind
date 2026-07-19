import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../app/platform';
import type { Book, ReaderBookmark, ReaderHighlight } from '../types';

export type DirectoryImportResult = { books: Book[]; failedCount: number };
export type DirectoryImportScanItem = {
  path: string;
  fileName: string;
  displayName: string;
  extension: string;
  relativePath: string;
  sizeBytes: number;
};
export type DirectoryImportScanResult = {
  directory: string;
  recursive: boolean;
  files: DirectoryImportScanItem[];
  totalBytes: number;
};
export type DirectoryImportFileSelection = {
  path: string;
  displayName: string;
};
export type TxtImportCleanupOptions = {
  enabled: boolean;
  encodingMode: 'auto' | 'utf-8' | 'gb18030';
  backupOriginalOnImport: boolean;
  coverToneStrategy: 'format' | 'hash' | 'progress';
  coverLabelStrategy: 'format' | 'ai' | 'read' | 'knowledge' | 'first-char';
  cleanTitleFromFilename: boolean;
  autoDetectAuthor: boolean;
  preserveOriginalBackup: boolean;
  removeAds: boolean;
  adKeywords: string[];
  removeAdUrls: boolean;
  removePaginationNoise: boolean;
  normalizeBlankLines: boolean;
  trimTrailingWhitespace: boolean;
  normalizeFullWidthSpaces: boolean;
  customCleanupRules: Array<{
    id: string;
    name: string;
    pattern: string;
    replacement: string;
    enabled: boolean;
    mode: 'remove-line' | 'replace';
    priority: number;
  }>;
};

export function browserPreviewUnavailable() {
  return new Error('Browser preview cannot access local files. Run the Tauri desktop app to import or manage books.');
}

export const BROWSER_DEMO_BOOK_ID = 'web-demo-rain-hospital';

type BrowserDemoHighlightSeed = {
  id: string;
  chapterIndex: number;
  paragraphIndex: number;
  text: string;
  note: string;
  color: ReaderHighlight['color'];
  tags: string[];
  importance: NonNullable<ReaderHighlight['importance']>;
  reviewStatus: NonNullable<ReaderHighlight['reviewStatus']>;
};

type BrowserDemoBookmarkSeed = {
  id: string;
  chapterIndex: number;
  paragraphIndex: number;
  screenPage: number;
  title: string;
  note: string;
  color: NonNullable<ReaderBookmark['color']>;
  tags: string[];
};

const BROWSER_DEMO_HIGHLIGHT_SEEDS: BrowserDemoHighlightSeed[] = [
  {
    id: 'web-demo-hl-ch1-clock',
    chapterIndex: 0,
    paragraphIndex: 0,
    text: '墙上的钟声忽然停止',
    note: '第一章线索：时间停摆。',
    color: 'yellow',
    tags: ['线索', '时间'],
    importance: 'high',
    reviewStatus: 'new',
  },
  {
    id: 'web-demo-hl-ch1-shadow',
    chapterIndex: 0,
    paragraphIndex: 1,
    text: '走廊尽头的影子',
    note: '可用来测试高亮跳转与批注筛选。',
    color: 'blue',
    tags: ['伏笔'],
    importance: 'normal',
    reviewStatus: 'due',
  },
  {
    id: 'web-demo-hl-ch2-notes',
    chapterIndex: 1,
    paragraphIndex: 0,
    text: '证据纸条',
    note: '第二章关键词，适合标签筛选。',
    color: 'green',
    tags: ['证据'],
    importance: 'high',
    reviewStatus: 'new',
  },
  {
    id: 'web-demo-hl-ch2-clock-repeat',
    chapterIndex: 1,
    paragraphIndex: 1,
    text: '重复出现的钟声',
    note: '和第一章钟声形成呼应。',
    color: 'pink',
    tags: ['时间', '呼应'],
    importance: 'critical',
    reviewStatus: 'due',
  },
  {
    id: 'web-demo-hl-ch3-jump',
    chapterIndex: 2,
    paragraphIndex: 0,
    text: 'citation 回跳到原文段落',
    note: '用于验证面板跳转与定位。',
    color: 'violet',
    tags: ['定位'],
    importance: 'normal',
    reviewStatus: 'reviewed',
  },
  {
    id: 'web-demo-hl-ch3-success',
    chapterIndex: 2,
    paragraphIndex: 2,
    text: '说明跳转成功',
    note: '章末高亮，便于测章末滚动。',
    color: 'red',
    tags: ['验收'],
    importance: 'high',
    reviewStatus: 'new',
  },
];

const BROWSER_DEMO_BOOKMARK_SEEDS: BrowserDemoBookmarkSeed[] = [
  {
    id: 'web-demo-bm-ch1-entry',
    chapterIndex: 0,
    paragraphIndex: 0,
    screenPage: 0,
    title: '第一章 · 雨夜入口',
    note: '到达病院的第一现场。',
    color: 'red',
    tags: ['章节入口'],
  },
  {
    id: 'web-demo-bm-ch1-card',
    chapterIndex: 0,
    paragraphIndex: 2,
    screenPage: 0,
    title: '旧就诊卡',
    note: '身份异常的关键物证。',
    color: 'yellow',
    tags: ['物证'],
  },
  {
    id: 'web-demo-bm-ch2-list',
    chapterIndex: 1,
    paragraphIndex: 2,
    screenPage: 0,
    title: '三件证据',
    note: '停摆的钟 / 影子 / 医生不看表。',
    color: 'green',
    tags: ['证据', '清单'],
  },
  {
    id: 'web-demo-bm-ch2-broadcast',
    chapterIndex: 1,
    paragraphIndex: 3,
    screenPage: 0,
    title: '三号诊室广播',
    note: '章节转折点，适合测书签跳转。',
    color: 'blue',
    tags: ['转折'],
  },
  {
    id: 'web-demo-bm-ch3-verify',
    chapterIndex: 2,
    paragraphIndex: 0,
    screenPage: 0,
    title: '回跳验证',
    note: '阅读器定位与 citation 联调入口。',
    color: 'violet',
    tags: ['定位'],
  },
  {
    id: 'web-demo-bm-ch3-end',
    chapterIndex: 2,
    paragraphIndex: 3,
    screenPage: 0,
    title: '雨停收束',
    note: '章末书签，测试列表分组与颜色筛选。',
    color: 'pink',
    tags: ['章末'],
  },
];

const BROWSER_DEMO_PARAGRAPHS: string[][] = [
  [
    '林七夜在雨夜抵达病院，墙上的钟声忽然停止。',
    '医生记录他的异常反应，并提醒他不要相信走廊尽头的影子。雨水顺着窗沿滑下，像一条条被打断的时间线。',
    '他在登记台写下自己的名字，笔尖却在纸上停顿了很久。护士说：“你来过这里。”林七夜摇头，却发现口袋里多了一张旧就诊卡。',
  ],
  [
    '主角开始把每次钟声、影子和医生的措辞记录成证据纸条。',
    '重复出现的钟声可能暗示时间异常，也适合测试伏笔、时间线和人物关系分析。',
    '纸条上最先写的是三件事：停摆的钟、走廊尽头的影子、医生从不看表。他把它们别在笔记本首页，像钉住一场尚未成形的案件。',
    '到了后半夜，病院广播忽然播报“请林七夜到三号诊室”。可三号诊室的门牌上，写的是他母亲的旧名。',
  ],
  [
    '研究台需要先检索本地索引，再用 citation 回跳到原文段落。',
    '这个示例书籍用于浏览器预览环境快速验证阅读器、高亮、书签和目录解析。',
    '林七夜推开诊室门时，里面只有一把椅子和一本摊开的病历。病历最后一行写着：“若你能读到这里，说明跳转成功。”',
    '他把这句话抄进证据纸条，合上本子。雨停了，钟又重新走动，病院走廊恢复成普通医院的模样。',
  ],
];

function createBrowserDemoHighlight(seed: BrowserDemoHighlightSeed, bookId: string, createdAt: string): ReaderHighlight {
  const paragraph = BROWSER_DEMO_PARAGRAPHS[seed.chapterIndex]?.[seed.paragraphIndex] ?? seed.text;
  const matchedOffset = paragraph.indexOf(seed.text);
  const startOffset = matchedOffset >= 0 ? matchedOffset : 0;
  return {
    id: seed.id,
    bookId,
    chapterIndex: seed.chapterIndex,
    sourceChapterIndex: seed.chapterIndex,
    paragraphIndex: seed.paragraphIndex,
    startOffset,
    endOffset: startOffset + seed.text.length,
    text: seed.text,
    note: seed.note,
    color: seed.color,
    createdAt,
    updatedAt: createdAt,
    prefixText: paragraph.slice(Math.max(0, startOffset - 12), startOffset),
    suffixText: paragraph.slice(startOffset + seed.text.length, startOffset + seed.text.length + 12),
    tags: seed.tags,
    importance: seed.importance,
    reviewStatus: seed.reviewStatus,
  };
}

function createBrowserDemoBookmark(seed: BrowserDemoBookmarkSeed, bookId: string, createdAt: string): ReaderBookmark {
  return {
    id: seed.id,
    bookId,
    chapterIndex: seed.chapterIndex,
    sourceChapterIndex: seed.chapterIndex,
    paragraphIndex: seed.paragraphIndex,
    screenPage: seed.screenPage,
    label: seed.title,
    title: seed.title,
    note: seed.note,
    color: seed.color,
    tags: seed.tags,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createBrowserDemoAnnotations(bookId = BROWSER_DEMO_BOOK_ID): { highlights: ReaderHighlight[]; bookmarks: ReaderBookmark[] } {
  const createdAt = '2026-07-13T00:00:00.000Z';
  return {
    highlights: BROWSER_DEMO_HIGHLIGHT_SEEDS.map((seed) => createBrowserDemoHighlight(seed, bookId, createdAt)),
    bookmarks: BROWSER_DEMO_BOOKMARK_SEEDS.map((seed) => createBrowserDemoBookmark(seed, bookId, createdAt)),
  };
}

export function isBrowserDemoBookId(bookId: string | null | undefined) {
  return bookId === BROWSER_DEMO_BOOK_ID;
}

export function createBrowserDemoBook(): Book {
  const content = [
    '第一章 雨夜病院',
    '林七夜在雨夜抵达病院，墙上的钟声忽然停止。',
    '医生记录他的异常反应，并提醒他不要相信走廊尽头的影子。雨水顺着窗沿滑下，像一条条被打断的时间线。',
    '他在登记台写下自己的名字，笔尖却在纸上停顿了很久。护士说：“你来过这里。”林七夜摇头，却发现口袋里多了一张旧就诊卡。',
    '',
    '第二章 证据纸条',
    '主角开始把每次钟声、影子和医生的措辞记录成证据纸条。',
    '重复出现的钟声可能暗示时间异常，也适合测试伏笔、时间线和人物关系分析。',
    '纸条上最先写的是三件事：停摆的钟、走廊尽头的影子、医生从不看表。他把它们别在笔记本首页，像钉住一场尚未成形的案件。',
    '到了后半夜，病院广播忽然播报“请林七夜到三号诊室”。可三号诊室的门牌上，写的是他母亲的旧名。',
    '',
    '第三章 回跳验证',
    '研究台需要先检索本地索引，再用 citation 回跳到原文段落。',
    '这个示例书籍用于浏览器预览环境快速验证阅读器、高亮、书签和目录解析。',
    '林七夜推开诊室门时，里面只有一把椅子和一本摊开的病历。病历最后一行写着：“若你能读到这里，说明跳转成功。”',
    '他把这句话抄进证据纸条，合上本子。雨停了，钟又重新走动，病院走廊恢复成普通医院的模样。',
  ].join('\n');
  return {
    id: BROWSER_DEMO_BOOK_ID,
    title: 'BookMind 网页演示书',
    displayTitle: 'BookMind 网页演示书',
    author: 'BookMind',
    format: 'TXT',
    status: '演示',
    progress: 0,
    fileName: 'bookmind-web-demo.txt',
    filePath: '',
    coverLabel: 'Demo',
    coverTone: 'indigo',
    deleted: false,
    deletedAt: '',
    contentHash: BROWSER_DEMO_BOOK_ID,
    importedAt: '2026-07-13T00:00:00.000Z',
    lastOpenedAt: '',
    shelfGroups: [],
    content,
    chunks: [],
  };
}

function getBrowserDemoBooks() {
  return [createBrowserDemoBook()];
}

export async function loadLibraryBooks(): Promise<Book[]> {
  if (!isTauriRuntime()) return getBrowserDemoBooks();
  return await invoke<Book[]>('get_library_books');
}

export async function refreshLibraryMetadata(): Promise<Book[]> {
  return await loadLibraryBooks();
}

export async function loadReaderDocument(bookId: string): Promise<Book> {
  if (!isTauriRuntime()) {
    const demo = getBrowserDemoBooks().find((book) => book.id === bookId);
    if (demo) return demo;
    throw browserPreviewUnavailable();
  }
  return await invoke<Book>('get_reader_document', { bookId });
}

export async function loadPdfSourceBytes(bookId: string): Promise<Uint8Array> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  const bytes = await invoke<number[]>('get_pdf_source_bytes', { bookId });
  return new Uint8Array(bytes);
}

export async function loadEpubSourceBytes(bookId: string): Promise<Uint8Array> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  const bytes = await invoke<number[]>('get_epub_source_bytes', { bookId });
  return new Uint8Array(bytes);
}

export async function saveBookMetadata(book: Book): Promise<Book> {
  if (!isTauriRuntime()) return book;
  const updated = await invoke<Omit<Book, 'content'>>('update_book_metadata', {
    updated: {
      id: book.id,
      title: book.title,
      displayTitle: book.displayTitle,
      author: book.author,
      format: book.format,
      status: book.status,
      progress: book.progress,
      fileName: book.fileName,
      filePath: book.filePath,
      sourceFilePath: book.sourceFilePath,
      coverLabel: book.coverLabel,
      coverTone: book.coverTone,
      coverImagePath: book.coverImagePath ?? '',
      deleted: book.deleted,
      deletedAt: book.deletedAt,
      contentHash: book.contentHash,
      importedAt: book.importedAt,
      lastOpenedAt: book.lastOpenedAt ?? '',
      shelfGroups: book.shelfGroups ?? [],
    },
  });
  return { ...book, ...updated };
}

export async function importBookFromPath(path: string, cleanupOptions?: TxtImportCleanupOptions | null): Promise<Book> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<Book>('import_book_from_path', { path, cleanupOptions });
}

export async function importBooksFromDirectory(path: string, recursive: boolean, continueAfterFailure: boolean, cleanupOptions?: TxtImportCleanupOptions | null): Promise<DirectoryImportResult> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<DirectoryImportResult>('import_books_from_directory', { path, recursive, continueAfterFailure, cleanupOptions });
}

export async function scanBookImportDirectory(path: string, recursive: boolean): Promise<DirectoryImportScanResult> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<DirectoryImportScanResult>('scan_book_import_directory', { path, recursive });
}

export async function importBookFiles(files: DirectoryImportFileSelection[], continueAfterFailure: boolean, cleanupOptions?: TxtImportCleanupOptions | null): Promise<DirectoryImportResult> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<DirectoryImportResult>('import_book_files', { files, continueAfterFailure, cleanupOptions });
}

export async function importLibraryCoverImage(path: string): Promise<string> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<string>('import_library_cover_image', { path });
}

export async function moveBookToTrash(bookId: string): Promise<Book> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<Book>('move_book_to_trash', { bookId });
}

export async function restoreBookFromTrash(bookId: string): Promise<Book> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<Book>('restore_book_from_trash', { bookId });
}

export async function permanentlyDeleteBook(bookId: string): Promise<Book[]> {
  if (!isTauriRuntime()) throw browserPreviewUnavailable();
  return await invoke<Book[]>('permanently_delete_book', { bookId });
}

export async function emptyTrash(force = true): Promise<Book[]> {
  if (!isTauriRuntime()) return [];
  return await invoke<Book[]>('empty_trash', { force });
}

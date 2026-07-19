import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function readSourceTree(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return readSourceTree(path);
    return /\.tsx?$/u.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  });
}
const app = readFileSync(resolve(root, 'src/app/App.tsx'), 'utf8');
const useLibrary = readFileSync(resolve(root, 'src/app/useLibrary.ts'), 'utf8');
const libraryPage = readFileSync(resolve(root, 'src/pages/LibraryPage.tsx'), 'utf8');
const libraryUi = [libraryPage, ...readSourceTree(resolve(root, 'src/features/library'))].join('\n');
const libraryPanel = readFileSync(resolve(root, 'src/features/library/LibraryPanel.tsx'), 'utf8');
const platform = readFileSync(resolve(root, 'src/app/platform.ts'), 'utf8');
const libraryService = readFileSync(resolve(root, 'src/services/libraryService.ts'), 'utf8');
const layoutCss = readFileSync(resolve(root, 'src/app/styles/layout.css'), 'utf8');
const bookMindIcon = readFileSync(resolve(root, 'src/components/BookMindIcon.tsx'), 'utf8');
const bookMindIconTypes = readFileSync(resolve(root, 'src/components/bookMindIconTypes.ts'), 'utf8');
const zhCn = [readFileSync(resolve(root, 'src/i18n/zh-CN.ts'), 'utf8'), ...readSourceTree(resolve(root, 'src/i18n/messages/zhCN'))].join('\n');
const enUs = [readFileSync(resolve(root, 'src/i18n/en-US.ts'), 'utf8'), ...readSourceTree(resolve(root, 'src/i18n/messages/enUS'))].join('\n');

const appRequirements = [
  'selectedBookId',
  'const libraryActions = useLibrary(',
  'openBook, openReaderFromSearch',
  'onOpenBook={openBook}',
];

for (const required of appRequirements) {
  if (!app.includes(required)) {
    throw new Error(`App is missing selected-book wiring: ${required}`);
  }
}

const libraryHookRequirements = [
  'const openBook = useCallback((id: string)',
  'saveLastReaderBookId(id, !shouldHideRecentReading(extendedSettings))',
  'setRestoreStartupReaderPosition(true)',
  'setSelectedBookId(id)',
  "setActivePage('reader')",
  'scanDirectoryImportPreview',
  'importDirectoryFileSelection',
  'return { updateBook, updateBookReadingProgress, importBook, importDirectory, scanDirectoryImportPreview, importDirectoryFileSelection, trashBook, restoreBook, deleteBookForever, clearTrash, openBook, openReaderFromSearch, chooseBookFile, chooseBookDirectory, runParseIndexFromReader }',
];

for (const required of libraryHookRequirements) {
  if (!useLibrary.includes(required)) {
    throw new Error(`useLibrary is missing selected-book behavior: ${required}`);
  }
}

const libraryRequirements = [
  'onOpenBook: (bookId: string) => void',
  'onOpenBook(book.id)',
  'onOpenBook(selectedBook.id)',
  'showBookDetail()',
  "t('library.menu.viewDetail')",
  "t('library.context.detail')",
  'closeDetailPanel()',
  'draftAuthor',
  'setDraftAuthor',
  "t('library.bookAuthor')",
  'author: draftAuthor.trim()',
  'editingBookId',
  'const editingBook',
  'deriveLibraryBookStatus',
  'readingStatusLabel',
  'indexStatusLabel',
  'library-status-line',
  'library.indexStatus.ready',
  'trashAutoCleanupEnabled',
  'autoCleanupEnabled={settings.trashAutoCleanupEnabled !== false}',
  'autoCleanupEnabled: boolean',
  'trashRemainingMillis',
  'library.trash.autoCleanupOff',
  'library.trash.expiryWarning',
  'trashActionError',
  'trashActionBusy',
  'setTrashActionError(error instanceof Error ? error.message : String(error))',
  'disabled={trashBooks.length === 0 || trashActionBusy}',
  'busy={trashActionBusy}',
  'role="alert"',
  'selectedBookIds',
  'onToggleSelection(book.id)',
  'checked={selectedBookIds.includes(book.id)}',
  'invertVisibleBookSelection',
  'applyBatchMetadataUpdate',
  'const selectedShelfBooks = shelfBooks.filter((item) => selectedBookIds.includes(item.id))',
  "t('library.batch.title')",
  "t('library.batch.apply')",
  "t('library.batch.clear')",
  "t('library.batch.invertVisible')",
  "t('library.batch.status.done')",
  'LibraryBatchIconButton',
];

for (const required of libraryRequirements) {
  if (!libraryUi.includes(required)) {
    throw new Error(`Library UI is missing per-book open behavior: ${required}`);
  }
}

if (!platform.includes('isTauriRuntime')) {
  throw new Error('platform utilities must expose isTauriRuntime for browser preview guards');
}

if (!libraryService.includes('isTauriRuntime()')) {
  throw new Error('library service must guard Tauri invoke calls in plain browser preview');
}

if (!libraryService.includes('return []') || !libraryService.includes('browserPreviewUnavailable')) {
  throw new Error('library service must return an empty browser preview library and throw friendly import errors');
}

if (!useLibrary.includes('isTauriRuntime()') || !useLibrary.includes("t('app.browserPreviewUnavailable')")) {
  throw new Error('Library native file picker actions must show a friendly browser-preview message instead of calling Tauri open');
}

if (!app.includes('updateBookReadingProgress') || !useLibrary.includes('updateBookReadingProgress') || !useLibrary.includes('Math.max(lb.progress, np)')) {
  throw new Error('App must automatically persist reader progress without regressing existing book progress');
}

if (!useLibrary.includes('booksRef.current = books') || !useLibrary.includes("booksRef.current.find((i) => i.id === bookId && !i.deleted)") || !useLibrary.includes('saveBookMetadata({ ...lb, progress: Math.max(lb.progress, np) })')) {
  throw new Error('Delayed reader progress saves must merge against the latest book metadata before persistence');
}

if (!app.includes('onReadingProgressChange={updateBookReadingProgress}')) {
  throw new Error('ReaderWorkspace must report reader progress back to the app library state');
}

if (!libraryUi.includes('autoCleanupEnabled ? trashRemaining(book, now, retentionDays, t) : null')) {
  throw new Error('Trash rows must avoid calculating auto-delete copy when trash auto-cleanup is disabled');
}

if (!libraryUi.includes('autoCleanupEnabled && trashRemainingMillis(book, now, retentionDays) <= DAY_MILLIS && !progressProtected')) {
  throw new Error('Trash rows must not mark books expiring soon when trash auto-cleanup is disabled');
}

if (!libraryUi.includes("!progressProtected && remaining ? <em>{t('library.trash.deleteIn', { time: remaining })}</em> : null")) {
  throw new Error('Trash rows must hide per-book auto-delete countdown copy when trash auto-cleanup is disabled');
}

if (libraryPanel.includes('sidebar-search-wrap') || libraryPanel.includes("t('sidebar.searchPlaceholder')") || libraryPanel.includes("formatShortcut('Ctrl/Cmd+K')")) {
  throw new Error('LibraryPanel must not render the obsolete sidebar quick search control');
}

if (!libraryPanel.includes('.slice(0, 1)') || libraryPanel.includes('privacySettings.sidebarRecentBookLimit')) {
  throw new Error('LibraryPanel must always show only the single most recently opened book');
}

const customCoverRequirements = [
  "import { open } from '@tauri-apps/plugin-dialog'",
  'async function chooseCustomCover',
  "extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']",
  'importLibraryCoverImage(selected)',
  'coverImagePath: await importLibraryCoverImage(selected)',
  'onCustomCover={chooseCustomCover}',
  "t('library.menu.customCover')",
  "t('library.context.customCover')",
  "t('library.cover.custom')",
];

for (const required of customCoverRequirements) {
  if (!libraryUi.includes(required)) {
    throw new Error(`Library UI is missing custom cover behavior: ${required}`);
  }
}

if (!libraryUi.includes("coverImagePath: ''")) {
  throw new Error('LibraryPage must clear custom cover image when switching back to a generated cover tone');
}

if (!zhCn.includes("'library.importTxt': '导入书籍'")) {
  throw new Error('Chinese library import label must be renamed to 导入书籍');
}

if (!enUs.includes("'library.importTxt': 'Import Books'")) {
  throw new Error('English library import label must be renamed to Import Books');
}

const libraryPaperIconRequirements = [
  'function LibraryMenuIcon',
  '<BookMindIcon name="libraryMore"',
  "BookMindIcon name={selectedBookIds.includes(book.id) ? 'librarySelect' : 'librarySelectEmpty'}",
  "'libraryGroupCollapse'",
  "'libraryGroupExpand'",
  '<LibraryMenuIcon kind="open"',
  '<LibraryMenuIcon kind="characters"',
  '<LibraryMenuIcon kind="cover"',
  '<LibraryMenuIcon kind="delete"',
];

for (const required of libraryPaperIconRequirements) {
  if (!libraryUi.includes(required)) {
    throw new Error(`Library UI must use paper-geometric library icons: ${required}`);
  }
}

const libraryPaperIconCssRequirements = [
  '.library-menu-icon .bm-icon',
  '.book-more-btn .bm-icon',
  '.book-select-control .bm-icon',
  '.library-group-expand-btn .bm-icon',
];

for (const required of libraryPaperIconCssRequirements) {
  if (!layoutCss.includes(required)) {
    throw new Error(`Library icon CSS is missing paper-geometric styling: ${required}`);
  }
}

const bookMindPaperIconNames = [
  'libraryMore',
  'librarySelect',
  'librarySelectEmpty',
  'libraryGroupCollapse',
  'libraryGroupExpand',
  'libraryMenuOpen',
  'libraryMenuCharacters',
  'libraryMenuDetail',
  'libraryMenuEdit',
  'libraryMenuCover',
  'libraryMenuCustomCover',
  'libraryMenuGroup',
  'libraryMenuDelete',
  'libraryMenuCreate',
];

for (const name of bookMindPaperIconNames) {
  if (!bookMindIconTypes.includes(`'${name}'`)) {
    throw new Error(`BookMindIconName must include paper geometry icon ${name}`);
  }
  if (!bookMindIcon.includes(`case '${name}':`)) {
    throw new Error(`BookMindIcon must render paper geometry icon ${name}`);
  }
}

if (libraryUi.includes('paper-geo-icon') || layoutCss.includes('paper-geo-icon')) {
  throw new Error('Library icons must not use the disconnected CSS line-icon system');
}

if (!libraryUi.includes('const menuHeight = 452')) {
  throw new Error('Book context menu clamp must reserve enough height for the full paper-geometry menu');
}

if (!layoutCss.includes('max-height: calc(100vh - 24px)') || !layoutCss.includes('overflow: auto')) {
  throw new Error('Book context menu must stay fully reachable inside short windows');
}

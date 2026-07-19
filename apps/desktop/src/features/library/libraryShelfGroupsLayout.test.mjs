import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
function readSourceTree(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return readSourceTree(path);
    return /\.tsx?$/u.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  });
}

const libraryUi = [
  readFileSync(resolve(sourceDirectory, '../../pages/LibraryPage.tsx'), 'utf8'),
  ...readSourceTree(sourceDirectory),
].join('\n');
const styles = readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8');
const zh = [
  readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8'),
  ...readSourceTree(resolve(sourceDirectory, '../../i18n/messages/zhCN')),
].join('\n');

assert.match(libraryUi, /buildShelfGroups/, 'library state should build shelf groups for the left sidebar');
assert.match(libraryUi, /filterBooksByShelfGroup/, 'library state should filter visible books by selected shelf group');
assert.match(libraryUi, /library-group-sidebar/, 'library UI should render a dedicated shelf group sidebar');
assert.match(libraryUi, /libraryGroupSidebarWidthStorageKey/, 'group shelf width should be persisted as local UI state');
assert.match(libraryUi, /className="library-group-resize-grip"/, 'group shelf should expose a resize grip');
assert.match(libraryUi, /onPointerDown=\{startShelfGroupResize\}/, 'group shelf resize should use pointer dragging');
assert.match(libraryUi, /onPointerDownBook=\{startPointerBookDrag\}/, 'book tiles should start pointer-based group assignment');
assert.match(libraryUi, /onPointerMoveBook=\{movePointerBookDrag\}/, 'book tiles should update pointer-based drag movement');
assert.match(libraryUi, /book-pointer-drag-preview/, 'book dragging should render an app-owned drag preview');
assert.match(libraryUi, /findShelfGroupAtPoint\(event\.clientX, event\.clientY\)/, 'book dragging should hit-test shelf groups at the pointer location');
assert.match(libraryUi, /else if \(!drag\.started\) onOpenBook\(drag\.bookId\);/, 'book pointer release without a drag should still open the book');
assert.match(libraryUi, /onDropGroup=\{dropBookOnShelfGroup\}/, 'group sidebar should receive the drop handler');
assert.match(libraryUi, /onDrop=\{\(event\) => onDrop\(event, group\.id\)\}/, 'group entries should accept dropped books by group id');
assert.match(libraryUi, /onDragOver=\{\(event\) => onDragOverGroup\(event, activeGroupId\)\}/, 'the group sidebar should accept drag-over events outside exact group buttons');
assert.match(libraryUi, /onGroup=\{openGroupEditor\}/, 'book menus should expose group management');
assert.match(libraryUi, /onExportAnnotations=\{\(\) => \{ void exportSelectedBookAnnotations\(selectedBook\); \}\}/, 'book menus should expose annotation export from the library');
assert.match(libraryUi, /type BookMenuPanel = 'main' \| 'more' \| 'cover'/, 'book menus should use in-place panel switching for More and cover tone actions');
assert.match(libraryUi, /panel === 'more'/, 'book menus should replace the main menu with the More panel');
assert.match(libraryUi, /panel === 'cover'/, 'cover tone choices should replace the More panel instead of expanding outward');
assert.match(libraryUi, /getReaderRecord\(book\.id, 'highlights'\)/, 'library annotation export should load saved reader highlights');
assert.match(libraryUi, /getReaderRecord\(book\.id, 'bookmarks'\)/, 'library annotation export should load saved reader bookmarks');
assert.match(libraryUi, /formatReaderAnnotationsMarkdown\(getPrivacyBookTitle\(sourceTitle, privacySettings\), buildLibraryReaderChapters\(book, highlights, bookmarks\), highlights, bookmarks/, 'library annotation export should write one markdown file containing highlights and bookmarks');
assert.match(libraryUi, /className="library-group-modal"/, 'library UI should include a group management modal');
assert.match(libraryUi, /expandedShelfGroupIds/, 'library state should track expanded custom shelf groups');
assert.match(libraryUi, /className="library-group-expand-btn"/, 'custom shelf groups should expose an expand/collapse control');
assert.match(libraryUi, /className="library-group-books"/, 'expanded custom shelf groups should show their contained books');
assert.match(libraryUi, /onDragBookStart=\{dragBookStart\}/, 'expanded shelf group books should reuse the main book drag source handler');
assert.match(libraryUi, /draggable onDragStart=\{\(event\) => onDragBookStart\(event, book\)\}/, 'books inside expanded shelf groups should be draggable into any shelf group');
assert.match(libraryUi, /setExpandedShelfGroupIds\(\(current\) => current\.includes\(groupId\) \? current : \[\.\.\.current, groupId\]\)/, 'dropping a book onto a custom shelf group should expand the target group after assignment');
assert.match(libraryUi, /libraryGroupCatalog/, 'library state should persist empty custom shelf groups');
assert.match(libraryUi, /groupContextMenu/, 'library UI should track a group context menu');
assert.match(libraryUi, /onOpenGroupContextMenu=\{openGroupContextMenu\}/, 'group sidebar blank area should open a create-group context menu');
assert.match(libraryUi, /onContextMenu=\{\(event\) => onOpenGroupContextMenu\(event, group\)\}/, 'custom group rows should open a group management context menu');
assert.match(libraryUi, /className="library-group-context-menu"/, 'library UI should render a group context menu');
assert.match(libraryUi, /renameShelfGroup/, 'library UI should support renaming custom shelf groups');
assert.match(libraryUi, /deleteShelfGroup/, 'library UI should support deleting custom shelf groups');
assert.match(libraryUi, /collapsed-groups/, 'collapsing the group rail should shrink its width instead of hiding groups');
assert.match(libraryUi, /className="library-group-name-modal"/, 'group create and rename should use a themed modal input');
assert.doesNotMatch(libraryUi, /window\.prompt/, 'group management should not use native browser prompt dialogs');
assert.match(libraryUi, /getShelfGroupIcon\(group\)/, 'collapsed custom groups should render a readable initial from the group name');
assert.match(libraryUi, /aria-label=\{group\.label\}/, 'collapsed group icon buttons should keep the group name available to assistive tech');
assert.match(libraryUi, /BookMindIcon name=\{selectedBookIds\.includes\(book\.id\) \? 'librarySelect' : 'librarySelectEmpty'\}/, 'book selection control should render an empty selection mark until the book is selected');
assert.match(libraryUi, /function invertVisibleBookSelection\(\)/, 'library UI should support inverting the current visible book selection');
assert.match(libraryUi, /function LibraryBatchIconButton\(/, 'library batch actions should use paper-geometric icon buttons instead of text-only buttons');
assert.match(libraryUi, /onSelectVisible=\{selectVisibleBooks\}/, 'select current results should be wired into the batch toolbar');
assert.match(libraryUi, /onInvertVisible=\{invertVisibleBookSelection\}/, 'batch actions should expose invert current results');
assert.match(libraryUi, /onClearSelection=\{clearBatchSelection\}/, 'clear selection should be wired into the batch toolbar');
assert.match(libraryUi, /onApplyBatch=\{applyBatchMetadataUpdate\}/, 'apply batch changes should be wired into the batch toolbar');
assert.match(libraryUi, /<LibraryBatchIconButton icon="librarySelect" label=\{t\('library\.batch\.selectVisible'\)\} onClick=\{onSelectVisible\}/, 'select current results should use a paper-geometric icon button');
assert.match(libraryUi, /<LibraryBatchIconButton icon="retry" label=\{t\('library\.batch\.invertVisible'\)\} onClick=\{onInvertVisible\}/, 'invert current results should use a paper-geometric icon button');
assert.match(libraryUi, /<LibraryBatchIconButton icon="librarySelectEmpty" label=\{t\('library\.batch\.clear'\)\} onClick=\{onClearSelection\}/, 'clear selection should use a paper-geometric icon button');
assert.match(libraryUi, /<LibraryBatchIconButton icon="saveCommand" label=\{t\('library\.batch\.apply'\)\} onClick=\{onApplyBatch\}/, 'apply batch changes should use a paper-geometric icon button');
assert.match(libraryUi, /t\('library\.trash\.exceptionProtectionEnabled'\)/, 'trash exception protection summary should use i18n');
assert.doesNotMatch(libraryUi, /已启用例外保护/, 'library UI should not hard-code trash exception protection text');

assert.match(styles, /\.library-shelf-layout\s*\{[^}]*--library-group-sidebar-width:\s*220px/s, 'library shelf layout should expose a configurable group rail width');
assert.match(styles, /\.library-shelf-layout\s*\{[^}]*grid-template-columns:\s*minmax\(160px,\s*var\(--library-group-sidebar-width\)\)\s+10px\s+minmax\(0,\s*1fr\)/s, 'library shelf layout should reserve a resizable left group rail');
assert.match(styles, /\.library-shelf-layout\.collapsed-groups\s*\{[^}]*grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)/s, 'collapsed group rail should become a narrow icon rail');
assert.match(styles, /\.library-group-resize-grip/s, 'group shelf resize grip should be styled');
assert.match(styles, /\.library-group-sidebar\s*\{[^}]*height:\s*100%/s, 'group sidebar should fill the available shelf height');
assert.match(styles, /\.library-group-item\.drop-target/s, 'group items should have a visible drag target state');
assert.match(styles, /\.book-pointer-drag-preview/s, 'book pointer drag preview should be styled');
assert.match(styles, /\.library-group-modal/s, 'group management modal should be styled');
assert.match(styles, /\.library-group-name-modal/s, 'themed group name input modal should be styled');
assert.match(styles, /\.library-group-node\.expanded/s, 'expanded shelf group nodes should have a styled state');
assert.match(styles, /\.library-group-books/s, 'expanded shelf group book lists should be styled');
assert.match(styles, /\.library-group-context-menu/s, 'group context menu should be styled');
assert.match(styles, /\.book-action-menu \.book-menu-next/s, 'book context menus should style in-place next panel actions');
assert.match(styles, /\.book-action-menu \.book-menu-back/s, 'book context menus should style in-place back actions');
assert.match(styles, /\.library-management-layout\s*\{[^}]*overflow:\s*auto/s, 'book area should scroll independently from the group sidebar');
assert.match(styles, /\.book-select-control input:not\(:checked\) \+ \.bm-icon/s, 'unchecked book selection controls should have a distinct empty-state icon style');
assert.match(styles, /\.library-batch-icon-btn/s, 'library batch icon buttons should have dedicated paper-geometric styling');
assert.match(styles, /\.library-batch-icon-btn:hover::after/s, 'library batch icon buttons should expose immediate hover tooltips');

assert.match(zh, /'library\.groups\.title':\s*'分组书架'/, 'Chinese i18n should include group shelf title');
assert.match(zh, /'library\.groups\.resize':\s*'调整分组书架宽度'/, 'Chinese i18n should include group shelf resize label');
assert.match(zh, /'library\.context\.groups':\s*'加入分组'/, 'Chinese i18n should include context menu grouping action');
assert.match(zh, /'library\.context\.more':\s*'更多'/, 'Chinese i18n should include the context menu More section');
assert.match(zh, /'library\.context\.exportAnnotations':\s*'导出高亮书签'/, 'Chinese i18n should include the library annotation export action');
assert.match(zh, /'library\.batch\.invertVisible':\s*'反选当前结果'/, 'Chinese i18n should include invert current result batch action');
assert.match(zh, /'library\.trash\.exceptionProtectionEnabled':\s*'已启用例外保护'/, 'Chinese i18n should include trash exception protection summary');

console.log('Verified library shelf group UI contract.');

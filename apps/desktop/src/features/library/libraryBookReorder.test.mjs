import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../pages/LibraryPage.tsx', import.meta.url), 'utf8');
const bookGrid = readFileSync(new URL('./LibraryBookGrid.tsx', import.meta.url), 'utf8');
const collectionModel = readFileSync(new URL('./libraryCollectionModel.ts', import.meta.url), 'utf8');
const dragAndDrop = readFileSync(new URL('./useLibraryBookDragAndDrop.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8');
const zhCN = readFileSync(new URL('../../i18n/messages/zhCN/library.ts', import.meta.url), 'utf8');
const enUS = readFileSync(new URL('../../i18n/messages/enUS/library.ts', import.meta.url), 'utf8');

assert.match(collectionModel, /libraryBookOrderStorageKey = 'bookmind:library-book-order:v1'/, 'Library book custom order should persist in localStorage');
assert.match(collectionModel, /type SortMode = 'manual' \| 'recent' \| 'title' \| 'progress' \| 'trashExpiry'/, 'Library sort mode should include manual order');
assert.match(collectionModel, /export function buildLibraryBookOrderAfterMove/u, 'Library collection model should own visible-order persistence updates');
assert.match(dragAndDrop, /function reorderVisibleBook\(bookId: string, targetBookId: string, placement: LibraryBookDropPlacement\)/, 'Drag controller should reorder visible books when dropped on another book');
assert.match(dragAndDrop, /buildLibraryBookOrderAfterMove\(visibleBookIds, libraryBookOrder\[activeShelfGroupId\]/, 'Reordering should update the active shelf group order');
assert.match(dragAndDrop, /setManualSortMode\(\)/, 'Dragging to reorder should switch the visible sort mode to custom order');
assert.match(page, /useLibraryBookDragAndDrop\(/, 'LibraryPage should compose the extracted drag controller');
assert.match(page, /<LibraryBookGrid/u, 'LibraryPage should compose the extracted book-grid view');
assert.match(bookGrid, /data-library-book-id=\{book\.id\}/, 'Book tiles should expose a hit-test id for pointer drag sorting');
assert.doesNotMatch(bookGrid, /data-library-book-id=\{book\.id\} draggable/, 'Main book tiles should keep pointer-owned dragging instead of native draggable');
assert.match(bookGrid, /onDrop=\{\(event\) => onDropBook\(event, book\.id\)\}/, 'Book tiles should accept native drops from expanded shelf groups');
assert.match(styles, /\.book-tile-wrap\.drop-target/s, 'Book reorder target should have visible drop feedback');
assert.match(zhCN, /'library\.sort\.manual': '自定义排序'/, 'Chinese locale should include manual sort label');
assert.match(enUS, /'library\.sort\.manual': 'Custom Order'/, 'English locale should include manual sort label');

console.log('Verified library book drag reorder contract.');

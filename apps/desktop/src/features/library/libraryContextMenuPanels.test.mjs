import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../pages/LibraryPage.tsx', import.meta.url), 'utf8');
const menus = readFileSync(new URL('./LibraryBookMenus.tsx', import.meta.url), 'utf8');
const bookGrid = readFileSync(new URL('./LibraryBookGrid.tsx', import.meta.url), 'utf8');

assert.match(page, /function closeMenus\(event: globalThis\.MouseEvent\) \{\s*const target = event\.target instanceof Element \? event\.target : null;/u, 'Library global menu closer should handle non-Element click targets safely');
assert.match(menus, /className="book-action-menu"[\s\S]*?onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}[\s\S]*?onClick=\{\(event\) => event\.stopPropagation\(\)\}[\s\S]*?onContextMenu=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/u, 'Book action menu should keep pointer, click, and context-menu events inside the menu');
assert.match(menus, /className="book-context-menu"[\s\S]*?onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}[\s\S]*?onClick=\{\(event\) => event\.stopPropagation\(\)\}[\s\S]*?onContextMenu=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/u, 'Book right-click menu should keep pointer, click, and context-menu events inside the menu');
assert.match(menus, /back\('more'\)/u, 'Library book menu should switch from main actions into the More panel in place');
assert.match(menus, /back\('cover'\)/u, 'Library book menu should switch from More into the cover-tone panel in place');
assert.match(menus, /back\('main'\)/u, 'Library book menu should let the More panel return to the main panel in place');
assert.match(page, /<LibraryBookGrid/u, 'LibraryPage should compose the extracted book-grid view');
assert.match(bookGrid, /<BookActionMenu/u, 'Book-grid view should compose the extracted action-menu component');

console.log('Verified library context menu panel switching stays open.');

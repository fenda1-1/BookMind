import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./LibraryPanel.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app/App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8');

assert.match(panel, /onReorderNavItems:\s*\(draggedPage: AppPage, targetPage: AppPage\) => void/, 'LibraryPanel should accept a persisted nav reorder callback');
assert.match(panel, /onPointerDown=\{\(event\) => startNavPointerDrag\(event, item\.id\)\}/, 'expanded sidebar nav items should start pointer-based reorder');
assert.match(panel, /onPointerMove=\{moveNavPointerDrag\}/, 'expanded sidebar nav items should update pointer-based reorder');
assert.match(panel, /findNavItemAtPoint\(event\.clientX, event\.clientY\)/, 'sidebar nav reorder should hit-test the target item at the pointer location');
assert.match(panel, /className=\{navItemClassName\('collapsed-nav-item', item\.id\)\}/, 'collapsed sidebar nav items should share drag target styling');

assert.match(app, /function reorderNavItems\(draggedPage: AppPage, targetPage: AppPage\)/, 'App should own sidebar nav reorder persistence');
assert.match(app, /saveExtendedSettings\(\{ \.\.\.extendedSettings, visibleNavItems: nextVisibleNavItems \}, \{ key: 'visibleNavItems' \}\)/, 'sidebar nav reorder should persist through visibleNavItems');
assert.match(app, /onReorderNavItems=\{reorderNavItems\}/, 'App should pass the reorder callback into LibraryPanel');

assert.match(styles, /\.nav-item\.drop-target/s, 'expanded sidebar nav drop targets should have a visible state');
assert.match(styles, /\.collapsed-nav-item\.drop-target/s, 'collapsed sidebar nav drop targets should have a visible state');
assert.match(styles, /\.nav-item, \.collapsed-nav-item \{ cursor: grab/s, 'sidebar nav items should use app-owned pointer dragging instead of native draggable');
assert.match(zh, /'sidebar\.eyebrow':\s*'AI集成阅读器'/, 'Chinese sidebar eyebrow should use the requested app label');

console.log('Verified sidebar nav drag reorder contract.');

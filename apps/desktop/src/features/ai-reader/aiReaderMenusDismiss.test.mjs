import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messageList = readFileSync(new URL('./AiConversationMessageList.tsx', import.meta.url), 'utf8');
const historyDrawer = readFileSync(new URL('./AiConversationHistoryDrawer.tsx', import.meta.url), 'utf8');
const readerPanel = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');

for (const [name, source] of [
  ['message menu', messageList],
  ['history menu', historyDrawer],
]) {
  assert.match(source, /document\.addEventListener\('pointerdown', closeOnOutsidePointer, true\);/u, `${name} should close on outside pointerdown`);
  assert.match(source, /document\.addEventListener\('keydown', closeOnEscape\);/u, `${name} should close on Escape`);
  assert.match(source, /contextMenuRef\.current\?\.contains\(target\)/u, `${name} should keep clicks inside the menu`);
}

assert.match(readerPanel, /function closeBottomPopovers\(\)/u, 'AI bottom popovers should have a shared close helper');
assert.match(readerPanel, /target\.closest\('\.ai-popover-wrap, \.ai-scope-status-wrap'\)/u, 'AI bottom popovers should keep clicks inside active popover wrappers');
assert.match(readerPanel, /document\.addEventListener\('pointerdown', closeOnOutsidePointer, true\);/u, 'AI bottom popovers should close on outside pointerdown');
assert.match(readerPanel, /document\.addEventListener\('keydown', closeOnEscape\);/u, 'AI bottom popovers should close on Escape');

console.log('Verified AI reader menus dismiss on outside click and Escape.');

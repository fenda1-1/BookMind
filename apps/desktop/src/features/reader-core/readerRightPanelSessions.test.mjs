import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(root, 'readerRightPanelSessions.ts'), 'utf8');
const barSource = readFileSync(join(root, 'ReaderRightPanelSessionBar.tsx'), 'utf8');
const highlightSource = readFileSync(join(root, 'ReaderHighlightPanel.tsx'), 'utf8');
const pageSource = readFileSync(join(root, 'ReaderPage.tsx'), 'utf8');
const topBarSource = readFileSync(join(root, '../../pages/reader-workspace/ReaderTopBar.tsx'), 'utf8');

assert.match(source, /collapsed:\s*boolean/, 'session snapshot must track collapsed body chrome');
assert.match(source, /ReaderRightPanelId = 'search' \| 'highlights' \| 'ai' \| 'settings'/, 'search must be a first-class right-panel session');
assert.match(source, /search:\s*\{ id: 'search', open: false, placement: 'floating' \}/, 'session snapshots must initialize the search tab');
assert.match(source, /width:\s*number/, 'session snapshot must track shared right-rail width');
assert.match(source, /export function toggleReaderRightPanelCollapsed/, 'store must expose collapsed toggle');
assert.match(source, /export function toggleReaderRightPanelSession/, 'store must expose exclusive-tab toggle');
assert.match(source, /export function setReaderRightPanelWidth/, 'store must expose shared width setter');
assert.match(source, /READER_RIGHT_PANEL_RESIZE_END_EVENT/, 'shared resize preview must expose a final measurement event');
assert.match(source, /dispatchEvent\(new Event\(READER_RIGHT_PANEL_RESIZE_END_EVENT\)\)/, 'ending a width preview must request one final reader measurement');
assert.match(source, /bookmind:reader-right-panel-width/, 'shared width must persist under one storage key');
assert.match(source, /bookmind:reader-highlight-panel-width/, 'shared width may migrate the legacy highlight width key once');
assert.match(source, /next\.collapsed\s*=\s*false/, 'opening/activating a panel must expand collapsed chrome');
assert.match(source, /if \(!next\.activeId\) next\.collapsed = false/, 'closing the last session must clear collapsed');
assert.match(source, /openIds\.length === 0[\s\S]*panels\.ai[\s\S]*activeId = 'ai'[\s\S]*collapsed = false/, 'empty toggle-collapsed must open the research desk expanded');
assert.match(source, /action: 'toggle-collapsed'/, 'command bus must accept toggle-collapsed');
assert.match(source, /action: 'set-collapsed'/, 'command bus must accept set-collapsed');
assert.match(source, /action: 'set-width'/, 'command bus must accept set-width');

assert.match(barSource, /reader-panel-tabstrip-host/, 'session bar must use fixed host chrome');
assert.match(barSource, /panel-\$\{activeId\}/, 'session host must identify the active panel so its fixed width matches the panel body');
assert.match(barSource, /classList\.toggle\('reader-right-panels-collapsed'/, 'session bar owns the collapsed grid class');
assert.match(barSource, /classList\.toggle\('reader-right-sessions-open'/, 'session bar marks when the right rail is occupied');
assert.match(barSource, /--reader-session-rail-width/, 'session bar publishes the exclusive right-rail width');
assert.match(barSource, /snapshot\.width/, 'session bar uses the shared store width for the whole rail');
assert.match(barSource, /id === 'search'[^\n]*reader\.search\.results/, 'session bar must label the search tab');
assert.doesNotMatch(barSource, /activeId === 'highlights' \? highlightWidth : dockWidth/, 'session bar must not pick per-panel widths');
assert.match(barSource, /openPanels\.length === 0 \|\| snapshot\.collapsed/, 'collapsed sessions hide the tabstrip body');
assert.match(barSource, /commandReaderRightPanel\(\{ action: 'activate'/, 'tabs activate without closing siblings');
assert.match(barSource, /commandReaderRightPanel\(\{ action: 'close'/, 'tab close button closes only that session');

assert.doesNotMatch(highlightSource, /classList\.toggle\('reader-right-panels-collapsed'/, 'highlight panel must not own collapsed grid chrome');
assert.doesNotMatch(highlightSource, /bookmind:reader-highlight-panel-width/, 'highlight panel must not keep an independent width storage key');
assert.match(highlightSource, /setReaderRightPanelWidth/, 'highlight resize must write the shared rail width');
assert.match(highlightSource, /highlightSessionOpen && highlightActive && !rightPanelsCollapsed/, 'highlight body requires active non-collapsed session');
assert.match(highlightSource, /command\.id !== 'highlights' && command\.id !== 'search'/, 'the shared highlight shell must own search session commands');
assert.match(highlightSource, /const showReaderSearchResults = searchPanelOpen/, 'search results must render only for the active search session');
assert.match(pageSource, /toggleReaderRightPanelSession\('highlights'\)/, 'toolbar highlight toggle goes through session store');
assert.match(pageSource, /snapshot\.panels\.search\.open && snapshot\.activeId === 'search' && !snapshot\.collapsed/, 'reader page must mirror active search-session visibility');
assert.match(pageSource, /if \(nextOpen\) openReaderRightPanelSession\('search'\)/, 'opening search must activate the shared right-panel session');
assert.match(pageSource, /else closeReaderRightPanelSession\('search'\)/, 'closing search must close its shared right-panel session');
assert.match(pageSource, /commandReaderRightPanel\(\{ action: 'toggle-collapsed' \}\)/, 'toolbar sidebar button toggles collapsed sessions');
assert.match(topBarSource, /aiSessionOpen && activeRightPanelId === 'ai' && !rightPanelsCollapsed/, 'AI body is exclusive and respects collapse');
assert.match(topBarSource, /settingsSessionOpen && activeRightPanelId === 'settings' && !rightPanelsCollapsed/, 'settings body is exclusive and respects collapse');

console.log('Verified reader right panel session contracts.');

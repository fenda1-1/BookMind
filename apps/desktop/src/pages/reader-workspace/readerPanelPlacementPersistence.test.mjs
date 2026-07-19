import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const storage = readFileSync('src/pages/readerWorkspaceStorage.ts', 'utf8');
const topBar = readFileSync('src/pages/reader-workspace/ReaderTopBar.tsx', 'utf8');
const persistence = readFileSync('src/pages/reader-workspace/useReaderWorkspacePersistence.ts', 'utf8');
const documentHook = readFileSync('src/pages/reader-workspace/useReaderWorkspaceDocument.ts', 'utf8');
const commandHandlers = readFileSync('src/pages/reader-workspace/ReaderCommandHandlers.ts', 'utf8');

assert.match(storage, /panelPlacements: ReaderStoredPanelPlacements/u, 'Reader stored state should include AI/settings panel placements');
assert.match(storage, /normalizeReaderPanelPlacements\(parsed\.panelPlacements\)/u, 'Legacy local reader state should normalize missing panel placements');
assert.match(storage, /normalizeReaderPanelPlacements\(stored\.panelPlacements\)/u, 'SQLite reader state should normalize missing panel placements');
assert.match(topBar, /initialPanelPlacements\?: Partial<ReaderStoredPanelPlacements> \| null/u, 'Reader top bar should accept restored panel placements');
assert.match(topBar, /setReaderPanelPlacements\(placements: Partial<ReaderStoredPanelPlacements> \| null \| undefined\)/u, 'Reader top bar should expose a restored placement setter');
assert.match(workspace, /initialPanelPlacements: initialReaderState\?\.panelPlacements/u, 'Reader workspace should seed panel placements from initial stored state');
assert.match(workspace, /setReaderPanelPlacements: readerTopBar\.setReaderPanelPlacements/u, 'Reader workspace should pass restored placement setter to restore/sync hooks');
assert.match(persistence, /panelPlacements: readerTopBar\.panelPlacements|panelPlacements/u, 'Reader persistence should receive current panel placements');
assert.match(persistence, /const state = \{ settings, activeChapterIndex: safeChapterIndex, activeParagraphIndex, activeScreenPage, aiCollapsed, tocOpen, settingsLevel, panelPlacements \}/u, 'Reader auto-save should persist panel placements');
assert.match(persistence, /if \(event\.payload\.panelPlacements\) setReaderPanelPlacements\(event\.payload\.panelPlacements\)/u, 'Reader window sync should apply remote panel placements');
assert.match(documentHook, /setReaderPanelPlacements\(stored\.panelPlacements\)/u, 'Reader document restore should restore panel placements from stored state');
assert.match(commandHandlers, /panelPlacements: context\.panelPlacements/u, 'Standalone reader command state snapshots should include panel placements');

console.log('Verified reader panel placement persistence.');

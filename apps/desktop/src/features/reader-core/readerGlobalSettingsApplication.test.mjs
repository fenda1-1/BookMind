import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readerPage = readFileSync(new URL('./ReaderPage.tsx', import.meta.url), 'utf8');
const readerSettings = readFileSync(new URL('./readerSettings.ts', import.meta.url), 'utf8');
const readerDomainEvents = readFileSync(new URL('./readerDomainEvents.ts', import.meta.url), 'utf8');
const settingsReaderActions = readFileSync(new URL('../settings-center/settingsCenterReaderActions.ts', import.meta.url), 'utf8');
const workspaceDocument = readFileSync(new URL('../../pages/reader-workspace/useReaderWorkspaceDocument.ts', import.meta.url), 'utf8');

assert.doesNotMatch(
  workspaceDocument,
  /function onGlobalReaderSettingsUpdated\(\)\s*\{\s*if \(book \|\| restoreStartupReaderPosition\) return;/u,
  'Active reader books must not ignore global reader setting updates from Settings Center.',
);

assert.match(
  workspaceDocument,
  /function onGlobalReaderSettingsUpdated\(detail: \{ settings: ReaderSettings;[\s\S]*loadGlobalReaderSettings\(\)[\s\S]*setSettings\(normalizeReaderSettings\(nextSettings\)\)[\s\S]*subscribeReaderGlobalSettingsUpdated\(onGlobalReaderSettingsUpdated\)/u,
  'Reader workspace should apply typed domain-event settings immediately instead of waiting for reload.',
);

assert.match(
  readerDomainEvents,
  /changedKeys\?: \(keyof ReaderSettings\)\[\]/u,
  'Global reader setting events should be able to describe which keys changed.',
);

assert.match(
  readerDomainEvents,
  /reason\?: 'user-action' \| 'hydrate'/u,
  'Global reader setting events should distinguish backend hydration from explicit user changes.',
);

assert.match(
  settingsReaderActions,
  /saveGlobalReaderSettings\(\{ \.\.\.current, \[key\]: value[\s\S]{0,220}changedKeys: \[key\]/u,
  'Changing one Settings Center reader control should only live-apply that changed key to the active reader.',
);

assert.match(
  workspaceDocument,
  /changedKeys[\s\S]{0,260}reduce<Partial<ReaderSettings>>[\s\S]{0,260}setSettings\(\(current\) => normalizeReaderSettings\(\{ \.\.\.current, \.\.\.livePatch \}\)\)/u,
  'Active reader should merge changed global keys into current book settings instead of replacing unrelated layout settings.',
);

assert.match(
  workspaceDocument,
  /setSettings\(loadGlobalReaderSettings\(\)\);[\s\S]{0,160}setActiveChapterIndex\(nextInitialState\.activeChapterIndex\)/u,
  'Opening a book should restore position from the book record but use shared global Reader settings.',
);

assert.doesNotMatch(
  workspaceDocument,
  /setSettings\(nextInitialState\.settings\)|setSettings\(stored\.settings\)/u,
  'Per-book reader state must not restore old private settings over the shared global settings.',
);

assert.match(
  workspaceDocument,
  /setSettings\(normalizeReaderSettings\(nextSettings\)\)/u,
  'Backend/global Reader setting hydration should update the active reader because the Reader scene and Settings Center share one settings set.',
);

assert.match(
  readerPage,
  /reader-canvas theme-\$\{visualSettings\.theme\}/u,
  'Reader canvas theme class should follow visualSettings so live/global updates render immediately.',
);

assert.match(
  readerPage,
  /reader-stage theme-\$\{visualSettings\.theme\}[\s\S]{0,180}layout-\$\{visualSettings\.layoutMode\}/u,
  'Reader stage theme and layout classes should follow visualSettings, not stale saved settings.',
);

console.log('Verified global Reader settings apply to the active reading scene.');

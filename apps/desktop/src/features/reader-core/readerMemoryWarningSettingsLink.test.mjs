import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readerPage = readFileSync('src/features/reader-core/ReaderPage.tsx', 'utf8');
const readerWorkspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const readerPagePropsBuilder = readFileSync('src/pages/reader-workspace/ReaderPagePropsBuilder.ts', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const settingsPage = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
const settingsLifecycle = readFileSync('src/pages/useSettingsPageLifecycle.ts', 'utf8');
const settingsReaderPanel = readFileSync('src/pages/SettingsReaderPanel.tsx', 'utf8');
const styles = readFileSync('src/app/readerStyles.css', 'utf8');

assert.match(readerPage, /onOpenReaderMemorySettings/u, 'Reader memory warning should expose a settings navigation handler');
assert.match(readerPage, /reader-memory-warning-settings/u, 'Reader memory warning should render a dedicated settings button');
assert.match(readerPage, />前往设置</u, 'Reader memory warning settings button should use the requested label');

assert.match(readerPagePropsBuilder, /onOpenReaderMemorySettings: \(\) => onOpenSettingsPageTarget\?\.\('reader-memory-warning'\)/u, 'Reader page props should route the memory warning button to the settings target');
assert.match(readerWorkspace, /onOpenSettings\?: \(target\?: 'ai-api' \| 'reader-memory-warning'\)/u, 'Reader workspace should accept the reader memory settings target');
assert.match(app, /openSettingsPage\(target\?: 'ai-api' \| 'reader-memory-warning'\)/u, 'App settings navigation should accept the reader memory settings target');
assert.match(settingsPage, /highlightTarget\?: 'ai-api' \| 'reader-memory-warning'/u, 'Settings page should accept the reader memory warning highlight target');
assert.match(settingsLifecycle, /context\.highlightTarget !== 'reader-memory-warning'/u, 'Settings lifecycle should handle the reader memory warning target');
assert.match(settingsLifecycle, /const searchQuery = tr\('settings\.reader\.memorySearchQuery'\)[\s\S]*context\.setSettingsQuery\(searchQuery\)/u, 'Reader memory warning target should open settings search with a localized memory query');
assert.doesNotMatch(settingsLifecycle, /readerMemoryWarningSettingRef\.current\?\.scrollIntoView/u, 'Reader memory warning target should not jump directly to one setting when it is expected to show search results');
assert.match(settingsReaderPanel, /readerMemoryWarningSettingRef/u, 'Settings reader panel should attach a ref to the memory warning setting');

assert.match(styles, /\.reader-memory-warning-settings/u, 'Reader memory warning button should have a distinct style');
assert.match(styles, /pointer-events: auto/u, 'Reader memory warning settings button should be clickable inside the passive warning chip');

console.log('Verified reader memory warning settings link contract.');

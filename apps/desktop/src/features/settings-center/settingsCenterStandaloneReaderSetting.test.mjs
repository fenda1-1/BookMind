import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync('src/services/settingsCenter/schema.ts', 'utf8');
const defaults = readFileSync('src/services/settingsCenter/defaults.ts', 'utf8');
const migrations = readFileSync('src/services/settingsCenter/migrations.ts', 'utf8');
const panel = readFileSync('src/pages/SettingsReaderPanel.tsx', 'utf8');
const resetActions = readFileSync('src/features/settings-center/settingsCenterDefaultResetActions.ts', 'utf8');
const generalActions = readFileSync('src/features/settings-center/settingsCenterGeneralActions.ts', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const zh = readFileSync('src/i18n/zh-CN.ts', 'utf8');
const en = readFileSync('src/i18n/en-US.ts', 'utf8');

assert.match(schema, /booksOpenInStandaloneReader: boolean/u, 'ExtendedSettings should define booksOpenInStandaloneReader');
assert.match(schema, /readerNavHiddenByStandaloneOnly: boolean/u, 'ExtendedSettings should track whether standalone-only mode hid the reader nav');
assert.match(defaults, /booksOpenInStandaloneReader: true/u, 'Standalone-only opening should be enabled by default');
assert.match(defaults, /readerNavHiddenByStandaloneOnly: false/u, 'Standalone-only reader nav marker should be disabled by default');
assert.match(migrations, /typeof settings\?\.booksOpenInStandaloneReader === 'boolean'/u, 'Settings migration should normalize booksOpenInStandaloneReader');
assert.match(migrations, /typeof settings\?\.readerNavHiddenByStandaloneOnly === 'boolean'/u, 'Settings migration should normalize readerNavHiddenByStandaloneOnly');
assert.match(panel, /updateExtendedSetting\('booksOpenInStandaloneReader'/u, 'Reader settings panel should expose booksOpenInStandaloneReader');
assert.match(resetActions, /readerNavHiddenByStandaloneOnly: defaultExtendedSettings\.readerNavHiddenByStandaloneOnly/u, 'Reader reset should restore readerNavHiddenByStandaloneOnly');
assert.match(generalActions, /key === 'booksOpenInStandaloneReader' && value === true[\s\S]*?current\.visibleNavItems\.includes\('reader'\)[\s\S]*?readerNavHiddenByStandaloneOnly = true/u, 'Enabling standalone-only books should mark the reader nav only when it was visible');
assert.match(generalActions, /key === 'booksOpenInStandaloneReader' && value === false && current\.readerNavHiddenByStandaloneOnly[\s\S]*?new Set\(\[\.{3}current\.visibleNavItems, 'reader'\]\)[\s\S]*?readerNavHiddenByStandaloneOnly = false/u, 'Disabling standalone-only books should restore reader nav only when it was auto-hidden');
assert.match(generalActions, /page === 'reader' \? false : extendedSettings\.readerNavHiddenByStandaloneOnly/u, 'Manual reader nav changes should clear the auto-hidden marker');
assert.match(app, /extendedSettings\.booksOpenInStandaloneReader[\s\S]*?filter\(\(id\) => id !== 'reader'\)/u, 'App navigation should hide reader entry while standalone-only mode is enabled');
assert.match(zh, /settings\.reader\.booksOpenInStandaloneReader\.title/u, 'Chinese locale should include booksOpenInStandaloneReader title');
assert.match(en, /settings\.reader\.booksOpenInStandaloneReader\.title/u, 'English locale should include booksOpenInStandaloneReader title');

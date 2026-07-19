import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-shortcut-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterShortcutModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  formatShortcutSettingValue,
  getShortcutConflictMessages,
} = require(join(outDir, 'settingsCenterShortcutModel.js'));
const zhShortcutLabels = {
  'settings.shortcutConflict.commandPalette': '命令面板',
  'settings.shortcutConflict.readerNavigation': '阅读器导航',
  'settings.shortcutConflict.libraryNavigation': '书库导航',
  'settings.shortcutConflict.searchNavigation': '搜索导航',
  'settings.shortcutConflict.importFile': '导入文件',
  'settings.shortcutConflict.aiSummary': 'AI 总结',
  'settings.shortcutConflict.separator': '、',
  'settings.shortcutConflict.format': '{shortcut}：{labels}',
};
const zh = (key, values) => {
  const template = zhShortcutLabels[key] ?? key;
  return values ? Object.entries(values).reduce((current, [name, value]) => current.replaceAll(`{${name}}`, String(value)), template) : template;
};

assert.equal(formatShortcutSettingValue('ctrl-enter'), 'Ctrl/Cmd+Enter');
assert.equal(formatShortcutSettingValue('ctrl-shift-p'), 'Ctrl/Cmd+Shift+P');
assert.equal(formatShortcutSettingValue('slash'), 'SLASH');

assert.deepEqual(getShortcutConflictMessages({
  commandPaletteShortcut: 'ctrl-k',
  navigationShortcuts: {
    reader: 'ctrl-b',
    library: 'ctrl-k',
    search: 'ctrl-f',
  },
  importShortcut: 'disabled',
  aiSummaryShortcut: 'ctrl-k',
}), [
  'Ctrl/Cmd+K: Command palette, Library navigation, AI summary',
]);

assert.deepEqual(getShortcutConflictMessages({
  commandPaletteShortcut: 'ctrl-k',
  navigationShortcuts: {
    reader: 'ctrl-b',
    library: 'ctrl-k',
    search: 'ctrl-f',
  },
  importShortcut: 'disabled',
  aiSummaryShortcut: 'ctrl-k',
}, zh), [
  'Ctrl/Cmd+K：命令面板、书库导航、AI 总结',
]);

assert.deepEqual(getShortcutConflictMessages({
  commandPaletteShortcut: 'ctrl-k',
  navigationShortcuts: {
    reader: 'ctrl-b',
    library: 'disabled',
    search: 'ctrl-f',
  },
  importShortcut: 'disabled',
  aiSummaryShortcut: 'ctrl-enter',
}), []);

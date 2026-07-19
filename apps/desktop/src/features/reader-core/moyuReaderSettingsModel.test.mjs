import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-moyu-reader-settings-test-${process.pid}`);
execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--ignoreConfig',
    '--target',
    'ES2022',
    '--module',
    'ES2022',
    '--moduleResolution',
    'Bundler',
    '--outDir',
    outDir,
    '--skipLibCheck',
    'src/features/reader-core/moyuReaderSettingsModel.ts',
  ],
  { cwd: process.cwd(), stdio: 'inherit' },
);

const {
  applyMoyuReaderPreset,
  defaultMoyuReaderProfile,
  describeMoyuEditorScope,
  formatMoyuPresetSummary,
  formatMoyuShortcut,
  formatMoyuWindowPresetLabel,
  buildMoyuLastGeometrySnapshot,
  deleteMoyuReaderCustomPreset,
  getMoyuShortcutConflictMessages,
  loadMoyuReaderCustomPresets,
  matchesMoyuShortcut,
  normalizeMoyuReaderProfile,
  recordMoyuRecentTextColor,
  patchMoyuReaderProfile,
  replaceMoyuReaderCustomPreset,
  resolveMoyuToolbarVisibilityState,
  resolveMoyuWindowGeometryFromProfile,
  saveMoyuReaderCustomPreset,
} = await import(pathToFileURL(join(outDir, 'moyuReaderSettingsModel.js')).href);

const normalized = normalizeMoyuReaderProfile({
  windowWidth: 9999,
  windowHeight: 20,
  backgroundOpacity: 2,
  textOpacity: -1,
  textScale: 9,
  fontFamily: '  "LXGW WenKai", serif  ',
  textColor: '  #123456  ',
  autoScrollSpeed: 999,
  toolbarRevealMode: 'click',
  windowPreset: 'floating-top-left',
  shortcuts: {
    nextPage: 'disabled',
    toggleLock: 'ctrl-l',
    exit: 'ctrl-shift-k',
  },
});

assert.equal(normalized.windowWidth, 1200);
assert.equal(normalized.windowHeight, 160);
assert.equal(normalized.backgroundOpacity, 0.96);
assert.equal(normalized.textOpacity, 0.2);
assert.equal(normalized.textScale, 1.8);
assert.equal(normalized.fontFamily, '"LXGW WenKai", serif');
assert.equal(normalized.textColor, '#123456');
assert.equal(normalized.autoScrollSpeed, 90);
assert.equal(normalized.windowPreset, 'bottom-right');
assert.equal(normalized.toolbarRevealMode, 'hover');
assert.equal(normalized.toolbarRevealDelayMs, 160);
assert.equal(normalized.shortcuts.nextPage, 'disabled');
assert.equal(normalized.shortcuts.toggleLock, 'ctrl-l');
assert.equal(normalized.shortcuts.exit, 'ctrl-shift-k');
assert.equal(normalized.shortcuts.toggleToolbars, 'ctrl-alt-t');
assert.equal(normalized.textColorMode, 'preset');
assert.equal(normalized.customTextColor, '#111827');
assert.equal(normalized.windowAspectLock, false);
assert.equal(normalized.rememberWindowPosition, true);
assert.equal(normalized.windowSnapToEdges, true);

const customColor = normalizeMoyuReaderProfile({
  textColorMode: 'custom',
  customTextColor: '  #224466  ',
  textColor: '#111827',
});
assert.equal(customColor.textColorMode, 'custom');
assert.equal(customColor.textColor, '#224466');
assert.equal(customColor.customTextColor, '#224466');

const patched = patchMoyuReaderProfile(defaultMoyuReaderProfile, {
  backgroundOpacity: 0,
  textOpacity: 0.8,
  fontFamily: ' "Microsoft YaHei", sans-serif ',
  textColor: '#111827',
  toolbarRevealMode: 'double-click',
  textColorMode: 'custom',
  customTextColor: '#445566',
});
assert.equal(patched.backgroundOpacity, 0);
assert.equal(patched.textOpacity, 0.8);
assert.equal(patched.fontFamily, '"Microsoft YaHei", sans-serif');
assert.equal(patched.textColor, '#445566');
assert.equal(patched.toolbarRevealMode, 'context-menu');
assert.equal(patched.textColorMode, 'custom');
assert.equal(patched.customTextColor, '#445566');
assert.equal(formatMoyuWindowPresetLabel('bottom-right'), '默认右下角');
assert.equal(formatMoyuPresetSummary({
  windowWidth: 640,
  windowHeight: 360,
  windowPreset: 'bottom-right',
  toolbarRevealMode: 'context-menu',
  textColorMode: 'preset',
  textColor: '#111827',
  customTextColor: '#111827',
  fontFamily: '"Noto Serif SC", serif',
  shortcuts: defaultMoyuReaderProfile.shortcuts,
  toolbarRevealDelayMs: 160,
}), '640 × 360 · 默认右下角 · 右键菜单 · Noto Serif SC');
assert.equal(describeMoyuEditorScope('current-window', 'night-read'), '当前窗口 · 预设 night-read');
assert.deepEqual(buildMoyuLastGeometrySnapshot({ width: 640, height: 360, x: 140, y: 260 }), { width: 640, height: 360, x: 140, y: 260 });

const recentColors = recordMoyuRecentTextColor({
  ...defaultMoyuReaderProfile,
  recentTextColors: ['#111827'],
}, '#445566');
assert.deepEqual(recentColors.recentTextColors, ['#445566', '#111827']);

assert.deepEqual(getMoyuShortcutConflictMessages({
  ...defaultMoyuReaderProfile.shortcuts,
  previousPage: 'ctrl-alt-t',
}), ['Ctrl/Cmd+Alt+T：切换工具栏、上一页']);

assert.equal(matchesMoyuShortcut('ctrl-l', { key: 'l', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), true);
assert.equal(matchesMoyuShortcut('ctrl-shift-k', { key: 'K', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }), true);
assert.equal(matchesMoyuShortcut('ctrl--', { key: '-', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), true);
assert.equal(matchesMoyuShortcut('disabled', { key: 'ArrowRight', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }), false);
assert.equal(formatMoyuShortcut('ctrl-arrowup'), 'Ctrl+ArrowUp');
assert.equal(formatMoyuShortcut('ctrl-shift-k'), 'Ctrl+Shift+K');
assert.equal(formatMoyuShortcut('ctrl--'), 'Ctrl+-');

assert.deepEqual(resolveMoyuToolbarVisibilityState({ toolbarsHidden: true, toolbarRevealMode: 'hover', toolbarVisible: false }), {
  toolbarsHidden: true,
  toolbarVisible: false,
  toolbarCanRevealByHover: true,
  toolbarCanRevealByContextMenu: false,
  toolbarCanRevealByShortcut: false,
});
assert.deepEqual(resolveMoyuToolbarVisibilityState({ toolbarsHidden: true, toolbarRevealMode: 'context-menu', toolbarVisible: false }), {
  toolbarsHidden: true,
  toolbarVisible: false,
  toolbarCanRevealByHover: false,
  toolbarCanRevealByContextMenu: true,
  toolbarCanRevealByShortcut: false,
});
assert.deepEqual(resolveMoyuToolbarVisibilityState({ toolbarsHidden: false, toolbarRevealMode: 'shortcut', toolbarVisible: true }), {
  toolbarsHidden: false,
  toolbarVisible: true,
  toolbarCanRevealByHover: false,
  toolbarCanRevealByContextMenu: false,
  toolbarCanRevealByShortcut: true,
});

assert.deepEqual(resolveMoyuWindowGeometryFromProfile({
  windowWidth: 520,
  windowHeight: 280,
  windowPreset: 'bottom-right',
  windowSnapToEdges: true,
  rememberWindowPosition: true,
  windowAspectLock: false,
  windowAspectRatio: 520 / 280,
}, {
  position: { x: 100, y: 200 },
  size: { width: 1920, height: 1080 },
}), {
  width: 520,
  height: 280,
  x: 100 + 1920 - 520,
  y: 200 + 1080 - 280 - 64,
});

const storage = new Map();
global.window = {
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
  },
  dispatchEvent() {},
};

const savedPresets = saveMoyuReaderCustomPreset('  我的预设  ', {
  ...defaultMoyuReaderProfile,
  windowWidth: 640,
  windowHeight: 320,
});
assert.equal(savedPresets[0].name, '我的预设');
assert.equal(savedPresets[0].settings.windowWidth, 640);

const loadedPresets = loadMoyuReaderCustomPresets();
assert.equal(loadedPresets.length, 1);

const replacedPresets = replaceMoyuReaderCustomPreset(savedPresets[0].id, '替换名', {
  ...defaultMoyuReaderProfile,
  windowWidth: 720,
  windowHeight: 360,
});
assert.equal(replacedPresets[0].name, '替换名');
assert.equal(replacedPresets[0].settings.windowWidth, 720);

const deletedPresets = deleteMoyuReaderCustomPreset(replacedPresets[0].id);
assert.equal(deletedPresets.length, 0);

const appliedPreset = applyMoyuReaderPreset(replacedPresets[0]);
assert.equal(appliedPreset.windowWidth, 720);
assert.equal(appliedPreset.windowHeight, 360);

console.log('Verified Moyu reader settings normalization, patching, shortcut matching, and labels.');

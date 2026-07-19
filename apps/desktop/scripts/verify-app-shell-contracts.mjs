import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const appSource = readFileSync('src/app/App.tsx', 'utf8');

// ---- useAppCommands.ts (485) ----
const useAppCommandsPath = 'src/app/useAppCommands.ts';
assert.ok(existsSync(useAppCommandsPath), 'App must extract command palette command assembly into app/useAppCommands');
const useAppCommands = readFileSync(useAppCommandsPath, 'utf8');
assert.match(useAppCommands, /createAppCommands/, 'useAppCommands must use createAppCommands from commandRegistry');
assert.match(useAppCommands, /extendedSettings\.commandPaletteShortcut/, 'useAppCommands must wire command palette shortcut');
assert.doesNotMatch(appSource, /const appCommands = useMemo\(\(\) => \{/, 'App must not inline command palette assembly after extraction');

// ---- useGlobalShortcuts.ts (486) ----
const useGlobalShortcutsPath = 'src/app/useGlobalShortcuts.ts';
assert.ok(existsSync(useGlobalShortcutsPath), 'App must extract global keyboard shortcut handling into app/useGlobalShortcuts');
const useGlobalShortcuts = readFileSync(useGlobalShortcutsPath, 'utf8');
assert.match(useGlobalShortcuts, /matchesCommandPaletteShortcut/, 'useGlobalShortcuts must own command palette shortcut matching');
assert.match(useGlobalShortcuts, /matchesConfiguredShortcut/, 'useGlobalShortcuts must own configured shortcut matching');
assert.match(useGlobalShortcuts, /globalShortcutsEnabled/, 'useGlobalShortcuts must respect global shortcuts enabled toggle');
assert.doesNotMatch(appSource, /function onGlobalShortcut\(/, 'App must not inline global shortcut handler after extraction');
assert.doesNotMatch(appSource, /globalShortcutStateRef/, 'App must not keep global shortcut state ref after extraction');

// ---- Phase 1: 5 typed domain hooks replace useAppCore ----
const domainHooks = ['useAppLock', 'useAppSettings', 'useLibrary', 'useTaskCenter', 'useCharacterCenter'];
for (const hook of domainHooks) {
  const p = `src/app/${hook}.ts`;
  assert.ok(existsSync(p), `${hook} must exist as standalone domain hook`);
  const src = readFileSync(p, 'utf8');
  assert.doesNotMatch(src, /@ts-nocheck/, `${hook} must NOT use @ts-nocheck`);
  assert.doesNotMatch(src, /@ts-ignore/, `${hook} must NOT use @ts-ignore`);
}
assert.ok(!existsSync('src/app/useAppCore.ts'), 'useAppCore.ts must be deleted');
for (const hook of domainHooks) assert.match(appSource, new RegExp(`from '\\.\\/${hook}'`), `App must import from ${hook}`);
assert.doesNotMatch(appSource, /from '\.\/useAppCore'/, 'App must NOT import from useAppCore');

console.log('Verified app shell architecture contracts.');

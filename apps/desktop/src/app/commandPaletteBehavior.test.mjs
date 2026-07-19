import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const commandRegistry = readFileSync('src/app/commandRegistry.ts', 'utf8');
const useAppCommands = readFileSync('src/app/useAppCommands.ts', 'utf8');
const commandPalette = readFileSync('src/app/CommandPalette.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const zhCNCommand = readFileSync('src/i18n/messages/zhCN/command.ts', 'utf8');
const enUSCommand = readFileSync('src/i18n/messages/enUS/command.ts', 'utf8');

assert.match(commandRegistry, /'go-characters'/, 'command registry must include the Characters page navigation command');
assert.match(commandRegistry, /command\.goCharacters\.label/, 'Characters command must be localized through i18n');
assert.match(commandRegistry, /createSettingsCommands\(settingsGroups[\s\S]*t: Translator/, 'settings commands must receive the active translator');
assert.match(commandRegistry, /t\('command\.settingsGroup\.label'[\s\S]*label: group\.label/, 'settings command labels must be built from localized templates');
assert.match(commandRegistry, /t\('command\.category\.settings'\)/, 'settings command category must be localized');
assert.doesNotMatch(commandRegistry, /label:\s*`设置：/, 'settings command labels must not hard-code Chinese');
assert.doesNotMatch(commandRegistry, /category:\s*'设置'/, 'settings command categories must not hard-code Chinese');

assert.match(useAppCommands, /buildSettingsGroups\(t\)/, 'command hook must build settings groups with the current locale');
assert.doesNotMatch(useAppCommands, /from '\.\.\/pages\/SettingsPage'/, 'command hook must not use static English settingsGroups');
assert.match(useAppCommands, /createSettingsCommands\(buildSettingsGroups\(t\), t\)/, 'command hook must pass translated setting groups to command generation');

assert.match(commandPalette, /function executeCommand/, 'command palette must route click and Enter through one close-then-run helper');
assert.match(commandPalette, /onClose\(\);\s*onRun\(command\.id\)/, 'command palette must close before running selected commands');
assert.match(commandPalette, /onClick=\{\(\) => executeCommand\(command\)\}/, 'mouse selection must close the command palette after running');
assert.match(commandPalette, /executeCommand\(command\)/, 'keyboard selection must close the command palette after running');

assert.match(app, /commandId\.startsWith\('open-settings-'\)/, 'app command runner must handle generated settings commands');
assert.match(app, /setSettingsInitialGroup\(groupId\)/, 'settings commands must select the target settings group');
assert.match(app, /saveRecentCommandIds\(commandId,\s*current\)/, 'app command runner must persist recent command usage for command palette sorting');

for (const key of [
  'command.category.settings',
  'command.goCharacters.label',
  'command.goCharacters.description',
  'command.settingsGroup.label',
]) {
  assert.match(zhCNCommand, new RegExp(`'${key}'`), `zh-CN command domain must define ${key}`);
  assert.match(enUSCommand, new RegExp(`'${key}'`), `en-US command domain must define ${key}`);
}

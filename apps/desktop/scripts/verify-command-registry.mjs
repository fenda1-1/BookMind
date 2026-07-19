import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/app/commandRegistry.ts'), 'utf8');

const requiredCommands = [
  'open-command-palette',
  'go-reader',
  'go-library',
  'go-characters',
  'go-search',
  'go-tasks',
  'import-file',
  'import-directory',
  'summarize-book',
  'toggle-night',
  'toggle-sidebar',
];

for (const commandId of requiredCommands) {
  if (!source.includes(`id: '${commandId}'`)) {
    throw new Error(`Missing command: ${commandId}`);
  }
}

const requiredShortcuts = ['Ctrl/Cmd+K', 'Ctrl/Cmd+L', 'Ctrl/Cmd+I', 'Ctrl/Cmd+B'];
for (const shortcut of requiredShortcuts) {
  if (!source.includes(`'${shortcut}'`)) {
    throw new Error(`Missing shortcut: ${shortcut}`);
  }
}

if (!source.includes('AppPage')) {
  throw new Error('Command registry must type navigation targets with AppPage.');
}

if (!source.includes('createSettingsCommands')) {
  throw new Error('Command registry must expose generated settings commands.');
}

if (!source.includes('settingsGroupId')) {
  throw new Error('Settings commands must carry a settingsGroupId target.');
}

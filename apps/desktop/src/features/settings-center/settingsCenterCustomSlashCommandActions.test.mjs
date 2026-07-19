import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-custom-slash-command-actions-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterCustomSlashCommandActions.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  createSettingsCustomSlashCommandActions,
} = require(join(outDir, 'features/settings-center/settingsCenterCustomSlashCommandActions.js'));
const {
  defaultCustomSlashCommandDraft,
} = require(join(outDir, 'features/settings-center/settingsCenterOptionsModel.js'));

const existingCommand = {
  id: 'custom-existing',
  label: 'existing',
  prompt: 'old prompt',
  aliases: ['old'],
  scopeHint: 'chapter',
  outputHint: 'old-output',
  retrievalStrategy: 'scope-first',
};

const testMessages = {
  'settings.customSlashActions.listRefreshed': 'Custom slash command list refreshed',
  'settings.customSlashActions.namePromptRequired': 'Custom command name and prompt cannot be empty',
  'settings.customSlashActions.limitZeroCreate': 'Custom command limit is 0; cannot create a new command',
  'settings.customSlashActions.commandCreated': 'Custom command added: /{label}',
  'settings.customSlashActions.editCanceled': 'Custom command edit canceled',
  'settings.customSlashActions.editNamePromptRequired': 'Edited command name and prompt cannot be empty',
  'settings.customSlashActions.commandMissingEditExited': 'Custom command no longer exists; exited editing',
  'settings.customSlashActions.commandSaved': 'Custom command saved: /{label}',
  'settings.customSlashActions.commandDeleted': 'Custom command deleted: /{label}',
  'settings.customSlashActions.commandsExported': 'Exported {count} custom commands',
  'settings.customSlashActions.commandsImported': 'Imported {count} custom commands',
  'settings.customSlashActions.commandsImportFailed': 'Custom command import failed: {error}',
  'settings.customSlashActions.limitZeroTemplate': 'Custom command limit is 0; cannot add template',
  'settings.customSlashActions.templateAdded': 'Command template added: /{label}',
};

function t(key, params = {}) {
  return String(testMessages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

function createHarness(overrides = {}) {
  let list = overrides.list ?? [existingCommand];
  let draft = overrides.draft ?? {
    label: '  new-command  ',
    prompt: '  answer with detail  ',
    aliases: ' a, b，c / d\n e ',
    scopeHint: 'book',
    outputHint: '  structured  ',
  };
  let editDraft = overrides.editDraft ?? {
    label: 'edited',
    prompt: 'edited prompt',
    aliases: 'alias-1, alias-2',
    scopeHint: 'selection',
    outputHint: '',
  };
  let editingId = overrides.editingId ?? '';
  const savedLists = [];
  const statuses = [];
  const downloads = [];
  const actions = createSettingsCustomSlashCommandActions({
    getCustomSlashCommandList: () => list,
    setCustomSlashCommandList: (next) => {
      list = next;
    },
    getCustomSlashCommandDraft: () => draft,
    setCustomSlashCommandDraft: (next) => {
      draft = next;
    },
    getCustomSlashCommandEditingId: () => editingId,
    setCustomSlashCommandEditingId: (next) => {
      editingId = next;
    },
    getCustomSlashCommandEditDraft: () => editDraft,
    setCustomSlashCommandEditDraft: (next) => {
      editDraft = next;
    },
    getAiCustomSlashCommandLimit: () => overrides.limit ?? '3',
    loadAiCustomSlashCommands: (limit) => list.slice(0, limit),
    saveAiCustomSlashCommands: (commands) => {
      savedLists.push(commands);
      list = commands;
    },
    downloadSettingsText: (fileName, text, mimeType) => {
      downloads.push({ fileName, text, mimeType });
    },
    setSaveStatus: (status) => {
      statuses.push(status);
    },
    t,
    createCustomCommandId: () => 'custom-created',
    createTemplateCommandId: () => 'custom-template-created',
    createImportIdSuffix: (index) => `imported-${index}`,
    createExportedAt: () => '2026-06-13T10:20:30.000Z',
    formatError: (error) => error instanceof Error ? error.message : String(error),
  });
  return {
    actions,
    downloads,
    getDraft: () => draft,
    getEditingId: () => editingId,
    getEditDraft: () => editDraft,
    getList: () => list,
    savedLists,
    statuses,
  };
}

{
  const harness = createHarness({ limit: '0' });

  harness.actions.createCustomSlashCommandFromSettings();

  assert.equal(harness.savedLists.length, 0);
  assert.deepEqual(harness.statuses, ['Custom command limit is 0; cannot create a new command']);
}

{
  const harness = createHarness({ limit: '2' });

  harness.actions.createCustomSlashCommandFromSettings();

  assert.deepEqual(harness.savedLists[0], [{
    id: 'custom-created',
    label: 'new-command',
    prompt: 'answer with detail',
    aliases: ['a', 'b', 'c', 'd', 'e'],
    scopeHint: 'book',
    outputHint: 'structured',
    retrievalStrategy: 'scope-first',
  }, existingCommand]);
  assert.deepEqual(harness.getDraft(), defaultCustomSlashCommandDraft);
  assert.deepEqual(harness.statuses, ['Custom command added: /new-command']);
}

{
  const harness = createHarness({ editingId: 'custom-existing' });

  harness.actions.deleteCustomSlashCommandFromSettings(existingCommand);

  assert.deepEqual(harness.savedLists[0], []);
  assert.deepEqual(harness.getList(), []);
  assert.equal(harness.getEditingId(), '');
  assert.deepEqual(harness.getEditDraft(), defaultCustomSlashCommandDraft);
  assert.deepEqual(harness.statuses, ['Custom command deleted: /existing']);
}

{
  const harness = createHarness({ editingId: 'custom-existing' });

  harness.actions.saveCustomSlashCommandEdit();

  assert.deepEqual(harness.savedLists[0], [{
    ...existingCommand,
    label: 'edited',
    prompt: 'edited prompt',
    aliases: ['alias-1', 'alias-2'],
    scopeHint: 'selection',
    outputHint: 'custom',
  }]);
  assert.equal(harness.getEditingId(), '');
  assert.deepEqual(harness.getEditDraft(), defaultCustomSlashCommandDraft);
  assert.deepEqual(harness.statuses, ['Custom command saved: /edited']);
}

{
  const harness = createHarness({ limit: '2' });
  const file = {
    async text() {
      return JSON.stringify({
        commands: [{
          id: 'external',
          label: 'imported',
          prompt: 'imported prompt',
          aliases: ['imp'],
          scopeHint: 'page',
          outputHint: 'imported-output',
          retrievalStrategy: 'scope-first',
        }],
      });
    },
  };

  await harness.actions.importCustomSlashCommandsFromSettings(file);

  assert.equal(harness.savedLists[0][0].id, 'custom-import-imported-0');
  assert.equal(harness.savedLists[0][0].label, 'imported');
  assert.equal(harness.savedLists[0][1].id, 'custom-existing');
  assert.deepEqual(harness.statuses, ['Imported 1 custom commands']);
}

{
  const harness = createHarness();

  harness.actions.exportCustomSlashCommandsFromSettings();

  assert.equal(harness.downloads.length, 1);
  assert.equal(harness.downloads[0].fileName, 'bookmind-custom-slash-commands-2026-06-13.json');
  assert.equal(JSON.parse(harness.downloads[0].text).schema, 'bookmind.ai.custom-slash-commands.v1');
  assert.deepEqual(harness.statuses, ['Exported 1 custom commands']);
}

{
  const harness = createHarness({ limit: '2' });

  harness.actions.addCustomSlashCommandTemplate({
    id: 'template-id',
    label: 'template',
    prompt: 'template prompt',
    aliases: ['tpl'],
    scopeHint: 'chapter',
    outputHint: 'template-output',
    retrievalStrategy: 'scope-first',
  });

  assert.deepEqual(harness.savedLists[0], [{
    id: 'custom-template-created',
    label: 'template',
    prompt: 'template prompt',
    aliases: ['tpl'],
    scopeHint: 'chapter',
    outputHint: 'template-output',
    retrievalStrategy: 'scope-first',
  }, existingCommand]);
  assert.deepEqual(harness.statuses, ['Command template added: /template']);
}

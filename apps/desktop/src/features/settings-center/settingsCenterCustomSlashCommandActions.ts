import type { AiCustomSlashCommandDraft, ExtendedSettings } from '../../services/settingsCenterService';
import type { Translator } from '../../i18n';
import type { CustomSlashCommandTemplate, EditableCustomSlashCommandDraft } from './settingsCenterOptionsModel';
import { defaultCustomSlashCommandDraft } from './settingsCenterOptionsModel';
import {
  buildCustomSlashCommandsExportPayload,
  parseCustomSlashCommandsImportPayload,
} from './settingsCenterImportModel';

type SettingsCustomSlashCommandActionDeps = {
  getCustomSlashCommandList: () => AiCustomSlashCommandDraft[];
  setCustomSlashCommandList: (commands: AiCustomSlashCommandDraft[]) => void;
  getCustomSlashCommandDraft: () => EditableCustomSlashCommandDraft;
  setCustomSlashCommandDraft: (draft: EditableCustomSlashCommandDraft) => void;
  getCustomSlashCommandEditingId: () => string;
  setCustomSlashCommandEditingId: (id: string) => void;
  getCustomSlashCommandEditDraft: () => EditableCustomSlashCommandDraft;
  setCustomSlashCommandEditDraft: (draft: EditableCustomSlashCommandDraft) => void;
  getAiCustomSlashCommandLimit: () => ExtendedSettings['aiCustomSlashCommandLimit'];
  setSaveStatus: (status: string) => void;
  t: Translator;
  loadAiCustomSlashCommands: (limit: number) => AiCustomSlashCommandDraft[];
  saveAiCustomSlashCommands: (commands: AiCustomSlashCommandDraft[]) => void;
  downloadSettingsText: (fileName: string, text: string, mimeType: string) => void;
  formatError: (error: unknown) => string;
  createCustomCommandId?: () => `custom-${string}`;
  createTemplateCommandId?: () => `custom-${string}`;
  createImportIdSuffix?: (index: number) => string;
  createExportedAt?: () => string;
};

function parseCustomSlashCommandAliases(value: string) {
  return value
    .split(/[,，/\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function refreshCommands(limit: number, deps: Pick<SettingsCustomSlashCommandActionDeps, 'setCustomSlashCommandList'> & {
  loadAiCustomSlashCommands: (limit: number) => AiCustomSlashCommandDraft[];
}) {
  deps.setCustomSlashCommandList(deps.loadAiCustomSlashCommands(limit));
}

export function createSettingsCustomSlashCommandActions(deps: SettingsCustomSlashCommandActionDeps) {
  const {
    getCustomSlashCommandList,
    setCustomSlashCommandList,
    getCustomSlashCommandDraft,
    setCustomSlashCommandDraft,
    getCustomSlashCommandEditingId,
    setCustomSlashCommandEditingId,
    getCustomSlashCommandEditDraft,
    setCustomSlashCommandEditDraft,
    getAiCustomSlashCommandLimit,
    setSaveStatus,
    t,
    loadAiCustomSlashCommands,
    saveAiCustomSlashCommands,
    downloadSettingsText,
    createCustomCommandId = () => `custom-${Date.now().toString(36)}`,
    createTemplateCommandId = () => `custom-template-${Date.now().toString(36)}`,
    createImportIdSuffix,
    createExportedAt = () => new Date().toISOString(),
    formatError,
  } = deps;

  function refreshCustomSlashCommandList() {
    setCustomSlashCommandList(loadAiCustomSlashCommands(Number(getAiCustomSlashCommandLimit())));
    setSaveStatus(t('settings.customSlashActions.listRefreshed'));
  }

  function createCustomSlashCommandFromSettings() {
    const customSlashCommandDraft = getCustomSlashCommandDraft();
    const label = customSlashCommandDraft.label.trim();
    const prompt = customSlashCommandDraft.prompt.trim();
    if (!label || !prompt) {
      setSaveStatus(t('settings.customSlashActions.namePromptRequired'));
      return;
    }
    const limit = Number(getAiCustomSlashCommandLimit());
    if (limit <= 0) {
      setSaveStatus(t('settings.customSlashActions.limitZeroCreate'));
      return;
    }
    const command: AiCustomSlashCommandDraft = {
      id: createCustomCommandId(),
      label: label.slice(0, 80),
      prompt: prompt.slice(0, 8000),
      aliases: parseCustomSlashCommandAliases(customSlashCommandDraft.aliases),
      scopeHint: customSlashCommandDraft.scopeHint,
      outputHint: customSlashCommandDraft.outputHint.trim().slice(0, 120) || 'custom',
      retrievalStrategy: 'scope-first',
    };
    saveAiCustomSlashCommands([command, ...getCustomSlashCommandList()].slice(0, limit));
    refreshCommands(Number(getAiCustomSlashCommandLimit()), { loadAiCustomSlashCommands, setCustomSlashCommandList });
    setCustomSlashCommandDraft(defaultCustomSlashCommandDraft);
    setSaveStatus(t('settings.customSlashActions.commandCreated', { label: command.label }));
  }

  function startEditingCustomSlashCommand(command: AiCustomSlashCommandDraft) {
    setCustomSlashCommandEditingId(command.id);
    setCustomSlashCommandEditDraft({
      label: command.label,
      prompt: command.prompt,
      aliases: command.aliases.join(', '),
      scopeHint: command.scopeHint,
      outputHint: command.outputHint,
    });
  }

  function cancelCustomSlashCommandEdit() {
    setCustomSlashCommandEditingId('');
    setCustomSlashCommandEditDraft(defaultCustomSlashCommandDraft);
    setSaveStatus(t('settings.customSlashActions.editCanceled'));
  }

  function saveCustomSlashCommandEdit() {
    const customSlashCommandEditingId = getCustomSlashCommandEditingId();
    const customSlashCommandEditDraft = getCustomSlashCommandEditDraft();
    const label = customSlashCommandEditDraft.label.trim();
    const prompt = customSlashCommandEditDraft.prompt.trim();
    if (!customSlashCommandEditingId) return;
    if (!label || !prompt) {
      setSaveStatus(t('settings.customSlashActions.editNamePromptRequired'));
      return;
    }
    const currentCommand = getCustomSlashCommandList().find((command) => command.id === customSlashCommandEditingId);
    if (!currentCommand) {
      cancelCustomSlashCommandEdit();
      setSaveStatus(t('settings.customSlashActions.commandMissingEditExited'));
      return;
    }
    const updatedCommand: AiCustomSlashCommandDraft = {
      ...currentCommand,
      label: label.slice(0, 80),
      prompt: prompt.slice(0, 8000),
      aliases: parseCustomSlashCommandAliases(customSlashCommandEditDraft.aliases),
      scopeHint: customSlashCommandEditDraft.scopeHint,
      outputHint: customSlashCommandEditDraft.outputHint.trim().slice(0, 120) || 'custom',
    };
    saveAiCustomSlashCommands(getCustomSlashCommandList().map((command) => command.id === customSlashCommandEditingId ? updatedCommand : command));
    refreshCommands(Number(getAiCustomSlashCommandLimit()), { loadAiCustomSlashCommands, setCustomSlashCommandList });
    setCustomSlashCommandEditingId('');
    setCustomSlashCommandEditDraft(defaultCustomSlashCommandDraft);
    setSaveStatus(t('settings.customSlashActions.commandSaved', { label: updatedCommand.label }));
  }

  function deleteCustomSlashCommandFromSettings(command: AiCustomSlashCommandDraft) {
    saveAiCustomSlashCommands(getCustomSlashCommandList().filter((item) => item.id !== command.id));
    refreshCommands(Number(getAiCustomSlashCommandLimit()), { loadAiCustomSlashCommands, setCustomSlashCommandList });
    if (getCustomSlashCommandEditingId() === command.id) {
      setCustomSlashCommandEditingId('');
      setCustomSlashCommandEditDraft(defaultCustomSlashCommandDraft);
    }
    setSaveStatus(t('settings.customSlashActions.commandDeleted', { label: command.label }));
  }

  function exportCustomSlashCommandsFromSettings() {
    const exportedAt = createExportedAt();
    downloadSettingsText(
      `bookmind-custom-slash-commands-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify(buildCustomSlashCommandsExportPayload(exportedAt, getCustomSlashCommandList()), null, 2),
      'application/json;charset=utf-8',
    );
    setSaveStatus(t('settings.customSlashActions.commandsExported', { count: getCustomSlashCommandList().length }));
  }

  async function importCustomSlashCommandsFromSettings(file: File) {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<{ commands: Partial<AiCustomSlashCommandDraft>[] }> | Partial<AiCustomSlashCommandDraft>[];
      const importedCommands = parseCustomSlashCommandsImportPayload(parsed, Number(getAiCustomSlashCommandLimit()), createImportIdSuffix);
      saveAiCustomSlashCommands([...importedCommands, ...getCustomSlashCommandList()].slice(0, Number(getAiCustomSlashCommandLimit())));
      refreshCommands(Number(getAiCustomSlashCommandLimit()), { loadAiCustomSlashCommands, setCustomSlashCommandList });
      setSaveStatus(t('settings.customSlashActions.commandsImported', { count: importedCommands.length }));
    } catch (error) {
      setSaveStatus(t('settings.customSlashActions.commandsImportFailed', { error: formatError(error) }));
    }
  }

  function addCustomSlashCommandTemplate(template: CustomSlashCommandTemplate) {
    const limit = Number(getAiCustomSlashCommandLimit());
    if (limit <= 0) {
      setSaveStatus(t('settings.customSlashActions.limitZeroTemplate'));
      return;
    }
    const command: AiCustomSlashCommandDraft = {
      ...template,
      id: createTemplateCommandId(),
    };
    saveAiCustomSlashCommands([command, ...getCustomSlashCommandList()].slice(0, limit));
    setCustomSlashCommandList(loadAiCustomSlashCommands(limit));
    setSaveStatus(t('settings.customSlashActions.templateAdded', { label: command.label }));
  }

  return {
    refreshCustomSlashCommandList,
    createCustomSlashCommandFromSettings,
    startEditingCustomSlashCommand,
    cancelCustomSlashCommandEdit,
    saveCustomSlashCommandEdit,
    deleteCustomSlashCommandFromSettings,
    exportCustomSlashCommandsFromSettings,
    importCustomSlashCommandsFromSettings,
    addCustomSlashCommandTemplate,
  };
}

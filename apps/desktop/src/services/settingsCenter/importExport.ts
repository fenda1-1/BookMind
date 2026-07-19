import type { AppSettings, ReaderSettings } from '../../types';
import type {
  AiCustomSlashCommandDraft,
  ChapterRuleDraft,
  ExtendedSettings,
} from './schema';

export type SettingsSnapshot = {
  schema: 'bookmind.settings.snapshot.v1';
  exportedAt: string;
  excludedFields: string[];
  app: AppSettings & { aiApiKey: string; redactedApiKey: true };
  reader: ReaderSettings;
  chapterRules: ChapterRuleDraft;
  extended: ExtendedSettings;
};

export type SettingsImportPreview = {
  fileName: string;
  snapshot: Partial<SettingsSnapshot>;
  additions: string[];
  overrides: string[];
  conflicts: string[];
  blockedFields: string[];
};

export type SettingsSnapshotInput = {
  exportedAt: string;
  appSettings: AppSettings;
  readerSettings: ReaderSettings;
  chapterRules: ChapterRuleDraft;
  extendedSettings: ExtendedSettings;
  sanitizeExtendedSettings: (settings: ExtendedSettings) => ExtendedSettings;
};

export type CustomCleanupRulesExportPayload = {
  schema: 'bookmind.txt-cleanup-rules.v1';
  exportedAt: string;
  rules: unknown[];
};

export type CustomSlashCommandsExportPayload = {
  schema: 'bookmind.ai.custom-slash-commands.v1';
  exportedAt: string;
  commands: Partial<AiCustomSlashCommandDraft>[];
};

const blockedSettingsImportFields = [
  'aiApiKey',
  'sidecarCommand',
  'sidecarWorkingDir',
  'aiProviderProfiles.apiKey',
  'aiProviderProfiles.customHeaders.Authorization',
  'aiProviderProfiles.customHeaders.Cookie',
  'providerApiKey',
  'translationSources.apiKey',
];

export function sanitizeSettingsSnapshotExtended(settings: ExtendedSettings): ExtendedSettings {
  return {
    ...settings,
    defaultImportPath: '',
    sidecarEnabled: false,
    sidecarCommand: '',
    sidecarWorkingDir: '',
  };
}

export function buildSettingsImportPreview(snapshot: Partial<SettingsSnapshot>, fileName: string): SettingsImportPreview {
  const additions: string[] = [];
  const overrides: string[] = [];
  const conflicts: string[] = [];
  const blockedFields = [...(snapshot.excludedFields ?? []), ...blockedSettingsImportFields];
  if (snapshot.app) overrides.push('AppSettings：回收站、AI Base URL、端点模式、模型、日志等级');
  else additions.push('无 AppSettings 变更');
  if (snapshot.reader) overrides.push('阅读器全局默认设置');
  if (snapshot.chapterRules) overrides.push('章节与目录规则');
  if (snapshot.extended) overrides.push('扩展设置与设置中心偏好');
  if (snapshot.extended?.sidecarCommand || snapshot.extended?.sidecarWorkingDir) overrides.push('Sidecar 本机路径需要确认');
  if (snapshot.app?.aiApiKey && snapshot.app.aiApiKey !== '[redacted]') conflicts.push('导入文件包含真实或疑似 API Key，将被拒绝覆盖');
  if (snapshot.schema !== 'bookmind.settings.snapshot.v1') conflicts.push('快照 schema 不兼容');
  return { fileName, snapshot, additions, overrides, conflicts, blockedFields: Array.from(new Set(blockedFields)) };
}

export function buildSettingsSnapshot({
  exportedAt,
  appSettings,
  readerSettings,
  chapterRules,
  extendedSettings,
  sanitizeExtendedSettings,
}: SettingsSnapshotInput): SettingsSnapshot {
  return {
    schema: 'bookmind.settings.snapshot.v1',
    exportedAt,
    excludedFields: ['aiApiKey', 'aiProviderProfiles.apiKey', 'translationSources.apiKey', 'sidecarCommand', 'sidecarWorkingDir', 'aiProviderProfiles.customHeaders.Authorization', 'aiProviderProfiles.customHeaders.Cookie', 'providerApiKey', 'diagnosticPaths', 'operationLogs', 'readerContent'],
    app: {
      ...appSettings,
      aiApiKey: '[redacted]',
      aiProviderProfiles: appSettings.aiProviderProfiles?.map((profile) => ({ ...profile, apiKey: '' })),
      translationSources: appSettings.translationSources?.map((source) => source.kind === 'ai-model' ? source : { ...source, apiKey: '' }),
      redactedApiKey: true,
    },
    reader: readerSettings,
    chapterRules,
    extended: sanitizeExtendedSettings(extendedSettings),
  };
}

export function buildCustomCleanupRulesExportPayload(exportedAt: string, rules: unknown[]): CustomCleanupRulesExportPayload {
  return {
    schema: 'bookmind.txt-cleanup-rules.v1',
    exportedAt,
    rules,
  };
}

export function parseCustomCleanupRulesImportPayload(parsed: Partial<{ rules: unknown; customCleanupRules: unknown }> | unknown[]): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const sourceRules = parsed.rules ?? parsed.customCleanupRules ?? [];
  return Array.isArray(sourceRules) ? sourceRules : [];
}

export function buildCustomSlashCommandsExportPayload(exportedAt: string, commands: Partial<AiCustomSlashCommandDraft>[]): CustomSlashCommandsExportPayload {
  return {
    schema: 'bookmind.ai.custom-slash-commands.v1',
    exportedAt,
    commands,
  };
}

export function parseCustomSlashCommandsImportPayload(
  parsed: Partial<{ commands: Partial<AiCustomSlashCommandDraft>[] }> | Partial<AiCustomSlashCommandDraft>[],
  limit: number,
  createImportIdSuffix: (index: number) => string = (index) => `${Date.now().toString(36)}-${index}`,
): AiCustomSlashCommandDraft[] {
  return (Array.isArray(parsed) ? parsed : parsed.commands ?? [])
    .slice(0, Math.max(0, limit))
    .map((command, index) => ({
      ...command,
      id: command.id?.startsWith('custom-') ? command.id : `custom-import-${createImportIdSuffix(index)}`,
    })) as AiCustomSlashCommandDraft[];
}

import {
  dispatchSettingsUpdated,
  loadSettingsChangeHistory,
  normalizeCustomCleanupRules,
  recordSettingsChangeHistory,
  saveChapterRules,
  saveExtendedSettings,
  type ChapterRegexRuleDraft,
  type ChapterRuleDraft,
  type ExtendedSettings,
  type SettingsChangeHistoryEntry,
  type TocTitleGroupRuleDraft,
} from '../../services/settingsCenterService';
import {
  buildCustomCleanupRulesExportPayload,
  parseCustomCleanupRulesImportPayload,
} from './settingsCenterImportModel';
import { downloadSettingsText } from './settingsCenterPageModel';
import type { Translator } from '../../i18n';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

type SettingsChapterActionDeps = {
  chapterRules: ChapterRuleDraft;
  extendedSettings: ExtendedSettings;
  setChapterRules: StateSetter<ChapterRuleDraft>;
  setExtendedSettings: StateSetter<ExtendedSettings>;
  setSettingsChangeHistory: StateSetter<SettingsChangeHistoryEntry[]>;
  setSaveStatus: (status: string) => void;
  t: Translator;
  createExportedAt?: () => string;
  formatError: (error: unknown) => string;
};

export function createSettingsChapterActions(deps: SettingsChapterActionDeps) {
  const {
    chapterRules,
    extendedSettings,
    setChapterRules,
    setExtendedSettings,
    setSettingsChangeHistory,
    setSaveStatus,
    t,
    createExportedAt = () => new Date().toISOString(),
    formatError,
  } = deps;

  function updateChapterRule<K extends keyof ChapterRuleDraft>(key: K, value: ChapterRuleDraft[K]) {
    const next = { ...chapterRules, [key]: value };
    setChapterRules(next);
    saveChapterRules(next);
    setSettingsChangeHistory(recordSettingsChangeHistory({ key: String(key), scope: 'chapterRules' }));
    dispatchSettingsUpdated({ key: String(key), scope: 'chapterRules' });
    setSaveStatus(t('settings.chapterActions.ruleSaved', { key: String(key) }));
  }

  function updateChapterRegexRules(customRegexRules: ChapterRegexRuleDraft[], status = t('settings.chapterActions.regexRulesSaved')) {
    const normalizedRules = customRegexRules.map((rule, index) => ({ ...rule, priority: index }));
    updateChapterRule('customRegexRules', normalizedRules);
    setSaveStatus(status);
  }

  function addChapterRegexRule() {
    const nextIndex = chapterRules.customRegexRules.length + 1;
    updateChapterRegexRules([
      ...chapterRules.customRegexRules,
      {
        id: `chapter-regex-${Date.now()}`,
        name: t('settings.chapterActions.regexRuleName', { index: nextIndex }),
        pattern: '^\\u7b2c\\d+\\u7ae0',
        enabled: true,
        priority: nextIndex - 1,
      },
    ], t('settings.chapterActions.regexRuleAdded'));
  }

  function updateChapterRegexRule(ruleId: string, patch: Partial<ChapterRegexRuleDraft>) {
    updateChapterRegexRules(chapterRules.customRegexRules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
  }

  function moveChapterRegexRule(ruleId: string, direction: -1 | 1) {
    const currentIndex = chapterRules.customRegexRules.findIndex((rule) => rule.id === ruleId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= chapterRules.customRegexRules.length) return;
    const next = [...chapterRules.customRegexRules];
    const [rule] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, rule);
    updateChapterRegexRules(next, t('settings.chapterActions.regexPriorityUpdated'));
  }

  function removeChapterRegexRule(ruleId: string) {
    updateChapterRegexRules(chapterRules.customRegexRules.filter((rule) => rule.id !== ruleId), t('settings.chapterActions.regexRuleDeleted'));
  }

  function updateCustomCleanupRules(customCleanupRules: ChapterRuleDraft['customCleanupRules'], status = t('settings.chapterActions.cleanupRulesSaved')) {
    const normalizedRules = customCleanupRules.map((rule, index) => ({ ...rule, priority: index }));
    updateChapterRule('customCleanupRules', normalizedRules);
    setSaveStatus(status);
  }

  function addCustomCleanupRule() {
    const nextIndex = chapterRules.customCleanupRules.length + 1;
    updateCustomCleanupRules([
      ...chapterRules.customCleanupRules,
      {
        id: `cleanup-rule-${Date.now()}`,
        name: t('settings.chapterActions.cleanupRuleName', { index: nextIndex }),
        pattern: '\\u4e66\\u53cb\\u7fa4\\s*\\d+',
        replacement: '',
        enabled: true,
        mode: 'remove-line',
        priority: nextIndex - 1,
      },
    ], t('settings.chapterActions.cleanupRuleAdded'));
  }

  function updateCustomCleanupRule(ruleId: string, patch: Partial<ChapterRuleDraft['customCleanupRules'][number]>) {
    updateCustomCleanupRules(chapterRules.customCleanupRules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
  }

  function moveCustomCleanupRule(ruleId: string, direction: -1 | 1) {
    const currentIndex = chapterRules.customCleanupRules.findIndex((rule) => rule.id === ruleId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= chapterRules.customCleanupRules.length) return;
    const next = [...chapterRules.customCleanupRules];
    const [rule] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, rule);
    updateCustomCleanupRules(next, t('settings.chapterActions.cleanupPriorityUpdated'));
  }

  function removeCustomCleanupRule(ruleId: string) {
    updateCustomCleanupRules(chapterRules.customCleanupRules.filter((rule) => rule.id !== ruleId), t('settings.chapterActions.cleanupRuleDeleted'));
  }

  function updateTocTitleGroupRules(tocTitleGroupRules: TocTitleGroupRuleDraft[], status = t('settings.chapterActions.tocGroupRulesSaved')) {
    const normalizedRules = tocTitleGroupRules.map((rule, index) => ({ ...rule, priority: index }));
    const saved = saveExtendedSettings({ ...extendedSettings, tocTitleGroupRules: normalizedRules }, { key: 'tocTitleGroupRules' });
    setExtendedSettings(saved);
    setSettingsChangeHistory(loadSettingsChangeHistory());
    setSaveStatus(status);
  }

  function addTocTitleGroupRule() {
    const nextIndex = extendedSettings.tocTitleGroupRules.length + 1;
    updateTocTitleGroupRules([
      ...extendedSettings.tocTitleGroupRules,
      {
        id: `toc-title-group-${Date.now()}`,
        name: t('settings.chapterActions.tocGroupRuleName', { index: nextIndex }),
        groupName: '\u756a\u5916',
        pattern: '^\\u756a\\u5916',
        enabled: true,
        priority: nextIndex - 1,
      },
    ], t('settings.chapterActions.tocGroupRuleAdded'));
  }

  function updateTocTitleGroupRule(ruleId: string, patch: Partial<TocTitleGroupRuleDraft>) {
    updateTocTitleGroupRules(extendedSettings.tocTitleGroupRules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
  }

  function moveTocTitleGroupRule(ruleId: string, direction: -1 | 1) {
    const currentIndex = extendedSettings.tocTitleGroupRules.findIndex((rule) => rule.id === ruleId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= extendedSettings.tocTitleGroupRules.length) return;
    const next = [...extendedSettings.tocTitleGroupRules];
    const [rule] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, rule);
    updateTocTitleGroupRules(next, t('settings.chapterActions.tocGroupPriorityUpdated'));
  }

  function removeTocTitleGroupRule(ruleId: string) {
    updateTocTitleGroupRules(extendedSettings.tocTitleGroupRules.filter((rule) => rule.id !== ruleId), t('settings.chapterActions.tocGroupRuleDeleted'));
  }

  function exportCustomCleanupRulesFromSettings() {
    const exportedAt = createExportedAt();
    downloadSettingsText(
      `bookmind-custom-cleanup-rules-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify(buildCustomCleanupRulesExportPayload(exportedAt, chapterRules.customCleanupRules), null, 2),
      'application/json;charset=utf-8',
    );
    setSaveStatus(t('settings.chapterActions.cleanupRulesExported', { count: chapterRules.customCleanupRules.length }));
  }

  async function importCustomCleanupRulesFromSettings(file: File) {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<{ rules: unknown; customCleanupRules: unknown }> | unknown[];
      const importedRules = normalizeCustomCleanupRules(parseCustomCleanupRulesImportPayload(parsed));
      if (!importedRules.length) {
        setSaveStatus(t('settings.chapterActions.cleanupRulesImportNoRules'));
        return;
      }
      updateCustomCleanupRules(importedRules, t('settings.chapterActions.cleanupRulesImported', { count: importedRules.length }));
    } catch (error) {
      setSaveStatus(t('settings.chapterActions.cleanupRulesImportFailed', { error: formatError(error) }));
    }
  }

  return {
    updateChapterRule,
    addChapterRegexRule,
    updateChapterRegexRule,
    moveChapterRegexRule,
    removeChapterRegexRule,
    addCustomCleanupRule,
    updateCustomCleanupRule,
    moveCustomCleanupRule,
    removeCustomCleanupRule,
    addTocTitleGroupRule,
    updateTocTitleGroupRule,
    moveTocTitleGroupRule,
    removeTocTitleGroupRule,
    exportCustomCleanupRulesFromSettings,
    importCustomCleanupRulesFromSettings,
  };
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-settings-center-i18n-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--jsx', 'react-jsx',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/i18n/index.ts',
  'src/i18n/en-US.ts',
  'src/i18n/zh-CN.ts',
  'src/features/settings-center/settingsCenterModel.ts',
  'src/features/settings-center/settingsCenterOptionsModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const requireFromTest = createRequire(import.meta.url);
const { createTranslator } = requireFromTest(join(outDir, 'i18n/index.js'));
const {
  buildSettingsGroups,
} = requireFromTest(join(outDir, 'features/settings-center/settingsCenterModel.js'));
const {
  buildReaderStaticSelectOptions,
  buildChapterStaticSelectOptions,
  buildAiProviderStaticSelectOptions,
  buildAiModeSelectOptions,
  buildAiInteractionStaticSelectOptions,
  buildSearchIndexStaticSelectOptions,
  buildLibraryImportStaticSelectOptions,
  buildSearchStaticSelectOptions,
  buildAnnotationKnowledgeStaticSelectOptions,
  buildNavigationShortcutStaticSelectOptions,
  buildCustomSlashCommandTemplateLibrary,
} = requireFromTest(join(outDir, 'features/settings-center/settingsCenterOptionsModel.js'));

const en = createTranslator('en-US', 'key');
const zh = createTranslator('zh-CN', 'key');

function assertNoHan(value, label) {
  assert.doesNotMatch(String(value), /\p{Script=Han}/u, `${label} should be localized for English UI`);
}

function assertResolvedTranslation(value, label) {
  assert.doesNotMatch(String(value), /^settings\./u, `${label} should resolve to translated text instead of the translation key`);
}

function flattenLabels(value, prefix = 'root') {
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenLabels(item, `${prefix}[${index}]`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => (
    key === 'label'
      ? [{ path: `${prefix}.${key}`, label: item }]
      : flattenLabels(item, `${prefix}.${key}`)
  ));
}

const englishGroups = buildSettingsGroups(en);
const chineseGroups = buildSettingsGroups(zh);
assert.equal(englishGroups.length, chineseGroups.length, 'Localized settings group count should stay stable across locales');
for (const group of englishGroups) {
  assertResolvedTranslation(group.label, `settings group ${group.id} label`);
  assertResolvedTranslation(group.description, `settings group ${group.id} description`);
  assertNoHan(group.label, `settings group ${group.id} label`);
  assertNoHan(group.description, `settings group ${group.id} description`);
}
for (const group of chineseGroups) {
  assertResolvedTranslation(group.label, `zh settings group ${group.id} label`);
  assertResolvedTranslation(group.description, `zh settings group ${group.id} description`);
}

const optionBuilders = {
  reader: buildReaderStaticSelectOptions,
  chapter: buildChapterStaticSelectOptions,
  aiProvider: buildAiProviderStaticSelectOptions,
  aiMode: buildAiModeSelectOptions,
  aiInteraction: buildAiInteractionStaticSelectOptions,
  searchIndex: buildSearchIndexStaticSelectOptions,
  libraryImport: buildLibraryImportStaticSelectOptions,
  search: buildSearchStaticSelectOptions,
  annotationKnowledge: buildAnnotationKnowledgeStaticSelectOptions,
  navigationShortcut: buildNavigationShortcutStaticSelectOptions,
};

for (const [name, builder] of Object.entries(optionBuilders)) {
  const labels = flattenLabels(builder(en), name);
  assert.ok(labels.length > 0, `${name} should expose labels to validate`);
  for (const item of labels) {
    assertNoHan(item.label, item.path);
  }
}

const englishCustomSlashTemplates = buildCustomSlashCommandTemplateLibrary(en);
const chineseCustomSlashTemplates = buildCustomSlashCommandTemplateLibrary(zh);
assert.equal(englishCustomSlashTemplates.length, chineseCustomSlashTemplates.length, 'custom slash template count should stay stable across locales');
for (const template of englishCustomSlashTemplates) {
  assertNoHan(template.prompt, `${template.id} prompt`);
  for (const alias of template.aliases) assertNoHan(alias, `${template.id} alias`);
}
assert.match(
  chineseCustomSlashTemplates.map((template) => [template.prompt, ...template.aliases].join(' ')).join(' '),
  /\p{Script=Han}/u,
  'custom slash templates should switch to Chinese text with zh-CN translator',
);

for (const sourcePath of [
  'src/pages/SettingsPageShell.tsx',
  'src/pages/SettingsGeneralPanel.tsx',
  'src/pages/SettingsAppearancePanel.tsx',
  'src/pages/SettingsReaderPanel.tsx',
  'src/pages/SettingsChapterPanel.tsx',
  'src/pages/SettingsSearchPanel.tsx',
  'src/pages/SettingsLibraryPanel.tsx',
  'src/pages/SettingsAccessibilityPanel.tsx',
  'src/pages/SettingsTasksPanel.tsx',
  'src/pages/SettingsDiagnosticsPanel.tsx',
  'src/pages/SettingsShortcutPanel.tsx',
  'src/pages/SettingsDataPanel.tsx',
  'src/pages/SettingsAnnotationPanel.tsx',
  'src/pages/SettingsAiPanel.tsx',
  'src/pages/SettingsPageGroupRenderer.tsx',
  'src/pages/SettingsPageScaffold.tsx',
  'src/pages/useSettingsPageOptions.ts',
  'src/pages/useSettingsPageLifecycle.ts',
  'src/pages/useSettingsPageState.ts',
  'src/features/reader-core/MoyuReaderSettingsPanel.tsx',
  'src/features/settings-center/settingsCenterModel.ts',
  'src/features/settings-center/settingsCenterOptionsModel.ts',
  'src/features/settings-center/settingsCenterAiActions.ts',
  'src/features/settings-center/settingsCenterAiProviderActions.ts',
  'src/features/settings-center/settingsCenterAiProviderModel.ts',
  'src/features/settings-center/settingsCenterChapterActions.ts',
  'src/features/settings-center/settingsCenterChapterDiagnosticsModel.ts',
  'src/features/settings-center/settingsCenterCustomSlashCommandActions.ts',
  'src/features/settings-center/settingsCenterDataMaintenanceActions.ts',
  'src/features/settings-center/settingsCenterDefaultResetActions.ts',
  'src/features/settings-center/settingsCenterDiagnosticsActions.ts',
  'src/features/settings-center/settingsCenterGeneralActions.ts',
  'src/features/settings-center/settingsCenterShortcutModel.ts',
  'src/features/settings-center/settingsCenterSnapshotActions.ts',
  'src/features/settings-center/settingsCenterStatusFormatModel.ts',
]) {
  const source = readFileSync(sourcePath, 'utf8');
  assertNoHan(source, `${sourcePath} source`);
}

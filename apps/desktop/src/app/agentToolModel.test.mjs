import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-agent-tool-model-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/app/agentToolModel.ts', 'src/i18n/zh-CN.ts', 'src/i18n/en-US.ts'], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildAgentChapterCatalog,
  buildAgentParagraphWindows,
  buildCharacterGrowthTimeline,
  defaultAgentSettingBranchKeyCount,
  getAgentRenderableFormats,
  getDefaultAgentPresetPrompt,
  getAgentSettingDescriptors,
  getAgentToolCatalog,
  getDefaultAgentEnabledTools,
  normalizeAgentEnabledTools,
  parseReaderSettingsPatchFromAgentArgs,
  readAgentChapterText,
  readAgentParagraphRange,
  resolveAgentAvailableTools,
  searchCharacterMentions,
  searchAgentChapterText,
  summarizeCharacterArc,
  searchReaderSettings,
} = require(join(outDir, 'app/agentToolModel.js'));
const { zhCN } = require(join(outDir, 'i18n/zh-CN.js'));
const { enUS } = require(join(outDir, 'i18n/en-US.js'));

const tools = resolveAgentAvailableTools();
for (const tool of ['list_chapters', 'read_chapter', 'search_chapter_text', 'get_paragraph_window', 'read_paragraph_range', 'get_reader_settings', 'search_settings', 'update_reader_settings', 'get_character_index', 'track_character_growth', 'search_character_mentions', 'summarize_character_arc', 'get_renderable_formats']) {
  assert.ok(tools.includes(tool), `Agent tools should include executable ${tool}`);
}

const catalog = getAgentToolCatalog();
assert.ok(catalog.length >= 8, 'Agent tool catalog should expose every user-controllable executable tool');
for (const tool of catalog) {
  assert.equal(typeof tool.name, 'string');
  assert.equal(typeof tool.label, 'string');
  assert.equal(typeof tool.description, 'string');
  assert.equal(typeof tool.argsExample, 'object', `${tool.name} should expose argsExample for the detail panel`);
  assert.equal(typeof tool.resultExample, 'object', `${tool.name} should expose resultExample for the detail panel`);
}
const searchSettingsTool = catalog.find((tool) => tool.name === 'search_settings');
assert.ok(searchSettingsTool.description.includes('值类型'), 'search_settings tool description should tell the Agent it returns value schema metadata');
assert.ok(searchSettingsTool.description.includes('更新参数示例'), 'search_settings tool description should tell the Agent it returns exact update argument examples');
assert.deepEqual(searchSettingsTool.argsExample, { query: '每日阅读目标' }, 'search_settings args example should demonstrate settings-center search terms');
assert.equal(searchSettingsTool.resultExample.matches[0].branch, 'extended', 'search_settings result example should include the target settings branch');
assert.equal(searchSettingsTool.resultExample.matches[0].key, 'readerDailyGoalEnabled', 'search_settings result example should include the exact mutable key');
assert.deepEqual(searchSettingsTool.resultExample.matches[0].allowedValues, [true, false], 'search_settings result example should include boolean allowed values');
assert.deepEqual(searchSettingsTool.resultExample.matches[1].valueSchema, { type: 'integerString', min: 0, max: 1000 }, 'search_settings result example should include bounded numeric schemas');
const renderableFormatsTool = catalog.find((tool) => tool.name === 'get_renderable_formats');
assert.ok(renderableFormatsTool, 'Agent tool catalog should expose renderable format toolbox');
assert.equal(renderableFormatsTool.category, 'format', 'Renderable format toolbox should use the format category');
assert.ok(renderableFormatsTool.description.includes('结构化回复格式'), 'Renderable format toolbox should explain that it returns structured response formats');
assert.ok(!getDefaultAgentEnabledTools().includes('finish'), 'Internal finish command should not be user-toggleable');
assert.ok(getDefaultAgentEnabledTools().includes('get_renderable_formats'), 'Renderable format toolbox should be enabled by default');
assert.deepEqual(
  normalizeAgentEnabledTools(['search_local_index', 'finish', 'unknown', 'update_reader_settings']),
  ['search_local_index', 'update_reader_settings'],
  'Enabled tool preferences should keep only user-controllable known tools in catalog order',
);
assert.deepEqual(
  resolveAgentAvailableTools(['search_local_index']),
  ['search_local_index', 'finish'],
  'Agent runtime available tools should append finish while honoring disabled tools',
);

const renderableFormats = getAgentRenderableFormats();
assert.equal(renderableFormats.schema, 'bookmind.ai.response.v2', 'Renderable format toolbox should describe the current schema');
assert.equal(renderableFormats.responseShape.version, 'bookmind.ai.response.v2', 'Renderable format toolbox should include the final response envelope');
const renderableTypes = renderableFormats.formats.map((format) => format.type);
for (const type of ['summary', 'paragraph', 'flashcards', 'timeline', 'character_table', 'foreshadowing_list', 'evidence_list', 'bullet_list', 'table', 'suggested_actions', 'paragraph_reference']) {
  assert.ok(renderableTypes.includes(type), `Renderable format toolbox should include ${type}`);
}
assert.ok(renderableFormats.formats.every((format) => format.exampleBlock?.type === format.type), 'Every renderable format should include a matching example block');
assert.ok(renderableFormats.notes.some((note) => note.includes('blocks')), 'Renderable format toolbox should tell the Agent to compose blocks');
const presetPrompt = getDefaultAgentPresetPrompt();
assert.match(presetPrompt, /bookmind\.ai\.response\.v2/u, 'Agent preset prompt should include the renderable response schema');
assert.match(presetPrompt, /character_table/u, 'Agent preset prompt should include the renderable block catalog');
assert.match(presetPrompt, /不要输出 Markdown/u, 'Agent preset prompt should enforce JSON-only final responses');

const chapterChunks = [
  { id: 'c0', ordinal: 0, chapterIndex: 0, chapterTitle: '第一章 起点', chapter: '第一章 起点', text: '第一章正文。钥匙出现一次。' },
  { id: 'c1', ordinal: 1, chapterIndex: 1, chapterTitle: '第二章 线索', chapter: '第二章 线索', text: '第二章正文。钥匙再次出现。钥匙被交给朋友。' },
  { id: 'c2', ordinal: 2, chapterIndex: 2, chapterTitle: '第三章 结尾', chapter: '第三章 结尾', text: '最后一章正文。拉德利站在门廊。' },
];
const chapterCatalog = buildAgentChapterCatalog(chapterChunks);
assert.equal(chapterCatalog.chapterCount, 3, 'Agent chapter catalog should expose total chapter count');
assert.equal(chapterCatalog.lastChapter.title, '第三章 结尾', 'Agent chapter catalog should expose the actual last chapter');

const lastChapter = readAgentChapterText(chapterChunks, { position: 'last', includeText: true });
assert.equal(lastChapter.status, 'ready', 'Agent chapter reader should support position:last');
assert.equal(lastChapter.chapter.sourceChapterIndex, 2, 'position:last must resolve to the final source chapter index');
assert.match(lastChapter.text, /最后一章正文/u, 'position:last must return final chapter text, not first/current chapter text');

const secondChapter = readAgentChapterText(chapterChunks, { chapterIndex: 1, includeText: true });
assert.equal(secondChapter.chapter.title, '第二章 线索', 'Agent chapter reader should support explicit chapterIndex');

const clueSearch = searchAgentChapterText(chapterChunks, { query: '钥匙', limit: 10, perChapterLimit: 3 });
assert.equal(clueSearch.status, 'ready', 'Agent chapter text search should return ready when matches exist');
assert.equal(clueSearch.totalMatches, 3, 'Agent chapter text search should count every occurrence');
assert.deepEqual(
  clueSearch.chapterMatches.map((item) => `${item.sourceChapterIndex}:${item.matchCount}`),
  ['0:1', '1:2'],
  'Agent chapter text search should group matches by original chapter order',
);

const paragraphChunks = [
  { id: 'p0', ordinal: 0, chapterIndex: 0, chapterTitle: '第一章', text: '一段。\n二段。\n三段。' },
  { id: 'p1', ordinal: 1, chapterIndex: 1, chapterTitle: '第二章', text: '甲段。\n乙段。\n丙段。\n丁段。' },
];
const paragraphRange = readAgentParagraphRange(paragraphChunks, { chapterIndex: 1, paragraphStart: 1, paragraphEnd: 2 });
assert.equal(paragraphRange.status, 'ready', 'Agent paragraph range reader should support direct chapterIndex and paragraph indexes');
assert.deepEqual(paragraphRange.paragraphs.map((item) => item.text), ['乙段。', '丙段。'], 'Agent paragraph range reader should return the requested paragraph span');
assert.equal(paragraphRange.chapter.title, '第二章');

const directWindows = buildAgentParagraphWindows(paragraphChunks, {
  chapterIndex: 1,
  paragraphIndex: 2,
  before: 1,
  after: 1,
}, []);
assert.equal(directWindows.status, 'ready', 'Agent paragraph window should support direct chapterIndex/paragraphIndex without citationIds');
assert.match(directWindows.windows[0].windowText, /乙段。\n\n丙段。\n\n丁段。/u, 'Direct paragraph window should include surrounding paragraphs');

const citationWindows = buildAgentParagraphWindows(paragraphChunks, { citationIds: ['7'], before: 0, after: 1 }, [
  { id: 7, label: '第二章 · P2', text: '乙段。', targetId: 't7', sourceChapterIndex: 1, paragraphIndex: 1 },
]);
assert.equal(citationWindows.status, 'ready', 'Agent paragraph window should still support citation based expansion');
assert.match(citationWindows.windows[0].windowText, /乙段。\n\n丙段。/u, 'Citation paragraph window should use original chapter paragraphs when chapter metadata exists');

assert.deepEqual(
  searchReaderSettings('字体 背景').slice(0, 3).map((item) => item.key),
  ['fontFamily', 'theme', 'customBackgroundColor'],
  'Agent settings search should expose concrete setting keys for Chinese setting names',
);

const dailyGoalMatches = searchReaderSettings('每日阅读目标');
assert.deepEqual(
  dailyGoalMatches.slice(0, 4).map((item) => `${item.branch}:${item.key}`),
  ['extended:readerDailyGoalEnabled', 'extended:readerDailyPagesGoal', 'extended:readerDailyMinutesGoal', 'extended:readerDailyChaptersGoal'],
  'Agent settings search should cover settings-center reader daily goal controls, not only reader style settings',
);
assert.equal(dailyGoalMatches[0].kind, 'boolean', 'Daily reading goal master switch should be described as a boolean setting');
assert.deepEqual(dailyGoalMatches[0].allowedValues, [true, false], 'Boolean settings should list true/false allowed values for safe AI updates');
assert.deepEqual(dailyGoalMatches[0].updateExample, { readerDailyGoalEnabled: true }, 'Settings search should return the exact patch shape the Agent can call');
assert.deepEqual(dailyGoalMatches[1].valueSchema, { type: 'integerString', min: 0, max: 1000 }, 'Daily page goal should expose numeric string bounds');
assert.equal(dailyGoalMatches[1].description.includes('0 表示'), true, 'Setting descriptions should include behavior constraints so the Agent does not invent values');

assert.equal(
  searchReaderSettings('字体族字符串')[0]?.key,
  'fontFamily',
  'Agent settings search should match setting descriptions, like Settings Center filtering does',
);
assert.ok(
  searchReaderSettings('chat.completions').some((item) => `${item.branch}:${item.key}` === 'appSettings:aiEndpointMode'),
  'Agent settings search should match enum/dropdown values exposed by Settings Center controls',
);
assert.ok(
  searchReaderSettings('设置项是自定义清洗规则 清洗').some((item) => `${item.branch}:${item.key}` === 'chapterRules:customCleanupRules'),
  'Agent settings search should tolerate natural-language query wrappers around Settings Center option names',
);

for (const [query, expectedKey] of [
  ['大小写敏感', 'extended:caseSensitive'],
  ['模糊搜索', 'extended:fuzzy'],
  ['正则错误时 fallback 到字面量匹配', 'extended:readerSearchRegexFallbackLiteral'],
  ['自动繁简归一', 'extended:searchNormalizeTraditionalChinese'],
  ['自动 NFKC 归一', 'extended:searchNormalizeNfkc'],
  ['拼音首字母匹配', 'extended:searchPinyinInitials'],
]) {
  const hits = searchReaderSettings(query).slice(0, 3).map((item) => `${item.branch}:${item.key}`);
  assert.ok(
    hits.includes(expectedKey),
    `Agent settings search for Settings Center visible label "${query}" should rank ${expectedKey} in the top 3`,
  );
}

const cleanupMatches = searchReaderSettings('清洗');
assert.deepEqual(
  cleanupMatches.slice(0, 4).map((item) => `${item.branch}:${item.key}`),
  ['chapterRules:customCleanupRules', 'chapterRules:normalizeFullWidthSpaces', 'chapterRules:removeAds', 'chapterRules:adKeywords'],
  'Agent settings search should cover settings-center chapter cleanup controls, not only reader style settings',
);
const customCleanupDescriptor = cleanupMatches.find((item) => item.key === 'customCleanupRules');
assert.ok(customCleanupDescriptor, 'Custom cleanup rules should be discoverable by Chinese search terms');
assert.deepEqual(
  customCleanupDescriptor.valueSchema,
  {
    type: 'array',
    maxItems: 16,
    item: {
      type: 'object',
      fields: {
        id: { type: 'string', optional: true, pattern: '^[a-zA-Z0-9_-]{1,48}$' },
        name: { type: 'string', maxLength: 40 },
        pattern: { type: 'string', maxLength: 240, required: true },
        replacement: { type: 'string', maxLength: 240 },
        enabled: { type: 'boolean' },
        mode: { type: 'enum', values: ['remove-line', 'replace'] },
        priority: { type: 'number', min: 0, max: 999, optional: true },
      },
    },
  },
  'Custom cleanup rules should expose a precise machine-readable array schema',
);
assert.deepEqual(
  customCleanupDescriptor.updateExample,
  { customCleanupRules: [{ name: '删除广告行', enabled: true, mode: 'remove-line', pattern: '书友群\\s*\\d+', replacement: '' }] },
  'Custom cleanup rules should return an exact update_reader_settings argument example',
);
assert.deepEqual(
  cleanupMatches.find((item) => item.key === 'normalizeFullWidthSpaces')?.allowedValues,
  [true, false],
  'Chapter cleanup boolean settings should expose true/false allowed values',
);

const allSettingDescriptors = getAgentSettingDescriptors();
const branchKeyCount = defaultAgentSettingBranchKeyCount();
assert.ok(
  allSettingDescriptors.filter((setting) => setting.branch === 'reader').length >= branchKeyCount.reader,
  'Agent settings descriptors should cover every top-level reader setting key',
);
assert.ok(
  allSettingDescriptors.filter((setting) => setting.branch === 'extended').length >= branchKeyCount.extended,
  'Agent settings descriptors should cover every top-level extended settings key',
);
assert.ok(
  allSettingDescriptors.filter((setting) => setting.branch === 'chapterRules').length >= branchKeyCount.chapterRules,
  'Agent settings descriptors should cover every top-level chapter rule key',
);
assert.ok(
  allSettingDescriptors.filter((setting) => setting.branch === 'appSettings').length >= branchKeyCount.appSettings,
  'Agent settings descriptors should cover every top-level app settings key',
);
for (const setting of allSettingDescriptors) {
  assert.ok(['reader', 'extended', 'chapterRules', 'appSettings', 'locale'].includes(setting.branch), `${setting.key} should declare which settings branch it updates`);
  assert.equal(typeof setting.key, 'string');
  assert.equal(typeof setting.label, 'string');
  assert.equal(typeof setting.description, 'string');
  assert.equal(typeof setting.kind, 'string');
  assert.equal(typeof setting.valueSchema, 'object', `${setting.key} should expose a machine-readable valueSchema`);
  assert.equal(typeof setting.updateExample, 'object', `${setting.key} should expose an exact update argument example`);
  if (setting.kind === 'boolean') assert.deepEqual(setting.allowedValues, [true, false], `${setting.key} boolean schema should list true/false`);
  if (setting.kind === 'enum') assert.ok(Array.isArray(setting.values) && setting.values.length > 0, `${setting.key} enum schema should list values`);
}

const uiSearchQueries = {
  日志: ['appSettings:operationLogLevel', 'extended:operationLogRetention'],
  导入: ['extended:defaultImportPath', 'extended:importFileFilter'],
  高对比: ['extended:highContrast'],
  快捷键: ['extended:globalShortcutsEnabled', 'extended:commandPaletteShortcut'],
  注释: ['extended:defaultHighlightColor', 'extended:annotationExportContent'],
  摸鱼: ['extended:moyuReaderProfile'],
  Provider: ['appSettings:aiProviderProfiles', 'appSettings:aiApiBaseUrl'],
  模型库: ['appSettings:aiProviderProfiles', 'appSettings:aiModel'],
};
for (const [query, expectedKeys] of Object.entries(uiSearchQueries)) {
  const hits = searchReaderSettings(query).map((item) => `${item.branch}:${item.key}`);
  for (const expectedKey of expectedKeys) {
    assert.ok(hits.includes(expectedKey), `Agent settings search for "${query}" should include ${expectedKey}`);
  }
}

const settingsPageGroupRendererSource = readFileSync('src/pages/SettingsPageGroupRenderer.tsx', 'utf8');
const settingsCenterSearchTerms = new Set();
for (const match of settingsPageGroupRendererSource.matchAll(/searchText="([^"]+)"/g)) {
  for (const term of match[1].split(/\s+/u).map((item) => item.trim()).filter(Boolean)) {
    settingsCenterSearchTerms.add(term);
  }
}
const agentSettingsSearchMisses = [...settingsCenterSearchTerms].filter((term) => !searchReaderSettings(term).length);
assert.deepEqual(
  agentSettingsSearchMisses,
  [],
  'Agent settings search should cover every Settings Center group search keyword',
);

const settingsCenterLocalizedGroupSearchMisses = [];
for (const [localeName, messages] of [['zh-CN', zhCN], ['en-US', enUS]]) {
  for (const [translationKey, value] of Object.entries(messages)) {
    if (!translationKey.startsWith('settings.groupSearch.')) continue;
    for (const term of String(value).split(/\s+/u).map((item) => item.trim()).filter((item) => item.length >= 2)) {
      if (!searchReaderSettings(term).length) settingsCenterLocalizedGroupSearchMisses.push(`${localeName}:${translationKey}:${term}`);
    }
  }
}
assert.deepEqual(
  settingsCenterLocalizedGroupSearchMisses,
  [],
  'Agent settings search should cover every localized Settings Center group search token',
);

const settingsCenterStaticSearchTerms = new Map();
for (const file of [
  'src/features/reader-core/MoyuReaderSettingsPanel.tsx',
  'src/pages/SettingsAccessibilityPanel.tsx',
  'src/pages/SettingsAiPanel.tsx',
  'src/pages/SettingsAnnotationPanel.tsx',
  'src/pages/SettingsAppearancePanel.tsx',
  'src/pages/SettingsChapterPanel.tsx',
  'src/pages/SettingsDataPanel.tsx',
  'src/pages/SettingsDiagnosticsPanel.tsx',
  'src/pages/SettingsGeneralPanel.tsx',
  'src/pages/SettingsLibraryPanel.tsx',
  'src/pages/SettingsReaderPanel.tsx',
  'src/pages/SettingsSearchPanel.tsx',
  'src/pages/SettingsShortcutPanel.tsx',
  'src/pages/SettingsTasksPanel.tsx',
  'src/pages/SettingsPageGroupRenderer.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<SettingControl\b[^>]*\btitle="([^"]+)"/g)) {
    settingsCenterStaticSearchTerms.set(match[1], file);
  }
  for (const match of source.matchAll(/<SettingControl\b[^>]*\bdescription="([^"]+)"/g)) {
    settingsCenterStaticSearchTerms.set(match[1], file);
  }
  for (const match of source.matchAll(/<SettingsSection\b[^>]*\btitle="([^"]+)"/g)) {
    settingsCenterStaticSearchTerms.set(match[1], file);
  }
  for (const match of source.matchAll(/<SettingsSection\b[^>]*\bdescription="([^"]+)"/g)) {
    settingsCenterStaticSearchTerms.set(match[1], file);
  }
  for (const match of source.matchAll(/searchText="([^"]+)"/g)) {
    for (const term of match[1].split(/\s+/u).map((item) => item.trim()).filter(Boolean)) {
      settingsCenterStaticSearchTerms.set(term, file);
    }
  }
}
const agentSettingsStaticMisses = [...settingsCenterStaticSearchTerms.entries()]
  .filter(([term]) => !searchReaderSettings(term).length)
  .map(([term, file]) => `${term} (${file})`);
assert.deepEqual(
  agentSettingsStaticMisses,
  [],
  'Agent settings search should find every static Settings Center filter term and control title',
);

const settingsCenterI18nControlTitleTerms = new Map();
for (const file of [
  'src/features/reader-core/MoyuReaderSettingsPanel.tsx',
  'src/pages/SettingsAccessibilityPanel.tsx',
  'src/pages/SettingsAiPanel.tsx',
  'src/pages/SettingsAnnotationPanel.tsx',
  'src/pages/SettingsAppearancePanel.tsx',
  'src/pages/SettingsChapterPanel.tsx',
  'src/pages/SettingsDataPanel.tsx',
  'src/pages/SettingsDiagnosticsPanel.tsx',
  'src/pages/SettingsGeneralPanel.tsx',
  'src/pages/SettingsLibraryPanel.tsx',
  'src/pages/SettingsReaderPanel.tsx',
  'src/pages/SettingsSearchPanel.tsx',
  'src/pages/SettingsShortcutPanel.tsx',
  'src/pages/SettingsTasksPanel.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<(?:SettingControl|SettingsSection)\b[^>]*\b(?:title|description)=\{(?:tr|t)\('([^']+)'/g)) {
    settingsCenterI18nControlTitleTerms.set(match[1], file);
  }
  for (const match of source.matchAll(/<ThemedSelect\b[^>]*\blabel=\{(?:tr|t)\('([^']+)'/g)) {
    settingsCenterI18nControlTitleTerms.set(match[1], file);
  }
}
const agentSettingsI18nControlTitleMisses = [];
for (const [translationKey, file] of settingsCenterI18nControlTitleTerms) {
  for (const [localeName, messages] of [['zh-CN', zhCN], ['en-US', enUS]]) {
    const term = messages[translationKey];
    if (typeof term !== 'string' || !term.trim()) continue;
    if (!searchReaderSettings(term).length) {
      agentSettingsI18nControlTitleMisses.push(`${localeName}:${translationKey}="${term}" (${file})`);
    }
  }
}
assert.deepEqual(
  agentSettingsI18nControlTitleMisses,
  [],
  'Agent settings search should find every i18n Settings Center control title',
);

const settingsDescriptorsByKey = new Map();
for (const descriptor of getAgentSettingDescriptors()) {
  const key = String(descriptor.key);
  settingsDescriptorsByKey.set(key, [...(settingsDescriptorsByKey.get(key) ?? []), `${descriptor.branch}:${key}`]);
}
const i18nSettingsSearchMisses = [];
for (const messages of [zhCN, enUS]) {
  for (const [translationKey, value] of Object.entries(messages)) {
    const match = translationKey.match(/^settings\.[^.]+\.([A-Za-z][A-Za-z0-9]*)\.(title|description)$/);
    if (!match) continue;
    const expectedKeys = settingsDescriptorsByKey.get(match[1]);
    if (!expectedKeys) continue;
    const hits = searchReaderSettings(String(value)).map((item) => `${item.branch}:${String(item.key)}`);
    if (!expectedKeys.some((key) => hits.includes(key))) {
      i18nSettingsSearchMisses.push(`${translationKey}="${value}" -> expected ${expectedKeys.join(' or ')}`);
    }
  }
}
assert.deepEqual(
  i18nSettingsSearchMisses,
  [],
  'Agent settings search should cover localized Settings Center option titles and descriptions',
);

const searchableSettingI18nSuffixes = new Set(['title', 'description', 'label', 'placeholder', 'empty', 'aria']);
const visibleSettingTextSearchMisses = [];
for (const [localeName, messages] of [['zh-CN', zhCN], ['en-US', enUS]]) {
  for (const [translationKey, value] of Object.entries(messages)) {
    const match = translationKey.match(/^settings\.[^.]+\.([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*)$/);
    if (!match || !searchableSettingI18nSuffixes.has(match[2])) continue;
    const expectedKeys = settingsDescriptorsByKey.get(match[1]);
    if (!expectedKeys) continue;
    const hits = searchReaderSettings(String(value)).map((item) => `${item.branch}:${String(item.key)}`);
    if (!expectedKeys.some((key) => hits.includes(key))) {
      visibleSettingTextSearchMisses.push(`${localeName}:${translationKey}="${value}" -> expected ${expectedKeys.join(' or ')}`);
    }
  }
}
assert.deepEqual(
  visibleSettingTextSearchMisses,
  [],
  'Agent settings search should cover every localized visible Settings Center text that maps directly to a setting key',
);

for (const [query, expectedKey] of [
  ['仅尖括号', 'chapterRules:bookTitleBracketMode'],
  ['标点优先', 'reader:longParagraphStrategy'],
  ['自动中西文间距', 'reader:mixedTextSpacing'],
  ['询问后重建', 'extended:tocRuleChangeRebuildMode'],
  ['Typography', 'reader:fontFamily'],
  ['Margins', 'reader:bodyMarginX'],
  ['Clear', 'reader:customBackgroundColor'],
  ['扫码关注，QQ群，下载APP', 'chapterRules:adKeywords'],
]) {
  const hits = searchReaderSettings(query).map((item) => `${item.branch}:${String(item.key)}`);
  assert.ok(hits.includes(expectedKey), `Agent settings search for localized option "${query}" should include ${expectedKey}`);
}

const localizedSettingsOptionMisses = [];
for (const [localeName, messages] of [['zh-CN', zhCN], ['en-US', enUS]]) {
  for (const [translationKey, value] of Object.entries(messages)) {
    const match = translationKey.match(/^settings\.options\.[^.]+\.([A-Za-z][A-Za-z0-9]*)\./);
    if (!match) continue;
    const expectedKeys = settingsDescriptorsByKey.get(match[1]);
    if (!expectedKeys) continue;
    const term = String(value).trim();
    if (!term || term.length < 2) continue;
    const hits = searchReaderSettings(term).map((item) => `${item.branch}:${String(item.key)}`);
    if (!expectedKeys.some((key) => hits.includes(key))) {
      localizedSettingsOptionMisses.push(`${localeName}:${translationKey}="${term}" -> expected ${expectedKeys.join(' or ')}`);
    }
  }
}
assert.deepEqual(
  localizedSettingsOptionMisses,
  [],
  'Agent settings search should cover every localized Settings Center select option label that maps to a setting key',
);

const readAloudVoiceMatches = searchReaderSettings('朗读角色声音').map((item) => `${item.branch}:${item.key}`);
for (const expectedKey of [
  'extended:readerReadAloudNarratorVoiceURI',
  'extended:readerReadAloudMaleVoiceURI',
  'extended:readerReadAloudFemaleVoiceURI',
  'extended:readerReadAloudCharacterVoiceRules',
]) {
  assert.ok(readAloudVoiceMatches.includes(expectedKey), `Agent settings search should expose ${expectedKey} for read-aloud voice configuration`);
}

const settingsPatch = parseReaderSettingsPatchFromAgentArgs({
  setting: '字体',
  value: '霞鹜文楷',
  background: '#f4ead2',
  color: '#111111',
  fontSize: 23,
});
assert.equal(settingsPatch.patch.fontFamily, '"LXGW WenKai", "Source Han Serif SC", serif', 'Font aliases should resolve to a real reader fontFamily value');
assert.equal(settingsPatch.patch.customBackgroundColor, '#f4ead2', 'Background color should map to customBackgroundColor');
assert.equal(settingsPatch.patch.customTextColor, '#111111', 'Text color should map to customTextColor instead of background color');
assert.equal(settingsPatch.patch.fontSize, 23, 'Numeric reader settings should be preserved in the patch');
assert.ok(settingsPatch.changedKeys.includes('fontFamily'), 'Changed keys should explain what the tool will update');
assert.deepEqual(settingsPatch.warnings, [], 'Recognized background/text color aliases should not emit misleading warnings');

const dailyGoalPatch = parseReaderSettingsPatchFromAgentArgs({
  setting: '每日阅读目标',
  value: true,
  readerDailyPagesGoal: 80,
  readerDailyMinutesGoal: '45',
  readerDailyChaptersGoal: 3,
});
assert.deepEqual(dailyGoalPatch.patch, {}, 'Extended settings should not be mixed into the ReaderSettings patch');
assert.deepEqual(dailyGoalPatch.changedKeys, [], 'Reader changed keys should stay reader-only');
assert.deepEqual(dailyGoalPatch.extendedPatch, {
  readerDailyGoalEnabled: true,
  readerDailyPagesGoal: '80',
  readerDailyMinutesGoal: '45',
  readerDailyChaptersGoal: '3',
}, 'Agent should parse daily goal settings into the extended settings patch with normalized string numbers');
assert.deepEqual(
  [...dailyGoalPatch.changedExtendedKeys].sort(),
  ['readerDailyPagesGoal', 'readerDailyMinutesGoal', 'readerDailyChaptersGoal', 'readerDailyGoalEnabled'].sort(),
  'Extended changed keys should explain what will be updated',
);

const cleanupPatch = parseReaderSettingsPatchFromAgentArgs({
  removeAds: false,
  normalizeFullWidthSpaces: true,
  customCleanupRules: [
    { name: '去掉网址', enabled: true, mode: 'replace', pattern: 'https?://\\S+', replacement: '' },
  ],
});
assert.deepEqual(cleanupPatch.patch, {}, 'Chapter rules should not be mixed into the ReaderSettings patch');
assert.deepEqual(cleanupPatch.extendedPatch, {}, 'Chapter rules should not be mixed into the ExtendedSettings patch');
assert.deepEqual(cleanupPatch.appSettingsPatch, {}, 'Chapter rules should not be mixed into the AppSettings patch');
assert.deepEqual(
  cleanupPatch.chapterRulesPatch,
  {
    removeAds: false,
    normalizeFullWidthSpaces: true,
    customCleanupRules: [
      { id: 'chapter-regex-1', name: '去掉网址', pattern: 'https?://\\S+', replacement: '', enabled: true, mode: 'replace', priority: 0 },
    ],
  },
  'Agent should parse cleanup settings into the chapter rules patch with normalized custom rules',
);
assert.deepEqual(
  [...cleanupPatch.changedChapterRuleKeys].sort(),
  ['removeAds', 'normalizeFullWidthSpaces', 'customCleanupRules'].sort(),
  'Chapter changed keys should explain what will be updated',
);

const appSettingsPatch = parseReaderSettingsPatchFromAgentArgs({
  aiModel: 'gemini-2.5-flash',
  aiStreamingEnabled: true,
  operationLogLevel: 'debug',
});
assert.deepEqual(appSettingsPatch.patch, {}, 'App settings should not be mixed into the ReaderSettings patch');
assert.deepEqual(appSettingsPatch.extendedPatch, {}, 'App settings should not be mixed into the ExtendedSettings patch');
assert.deepEqual(appSettingsPatch.chapterRulesPatch, {}, 'App settings should not be mixed into the ChapterRules patch');
assert.deepEqual(
  appSettingsPatch.appSettingsPatch,
  {
    aiModel: 'gemini-2.5-flash',
    aiStreamingEnabled: true,
    operationLogLevel: 'debug',
  },
  'Agent should parse provider/model/log settings into the app settings patch',
);
assert.deepEqual(
  [...appSettingsPatch.changedAppSettingKeys].sort(),
  ['aiModel', 'aiStreamingEnabled', 'operationLogLevel'].sort(),
  'App setting changed keys should explain what will be updated',
);

const localePatch = parseReaderSettingsPatchFromAgentArgs({
  setting: 'Interface Language',
  value: 'English',
});
assert.equal(localePatch.localePreference, 'en-US', 'Agent should parse interface language settings into locale preference changes');
assert.deepEqual(localePatch.changedLocaleKeys, ['localePreference'], 'Locale changed keys should explain what will be updated');

const payload = {
  book: { id: 'book-1', title: '测试书', displayTitle: '测试书' },
  manifest: { status: 'ready' },
  profiles: [
    {
      id: 'char-lqy',
      bookId: 'book-1',
      canonicalName: '林七夜',
      displayName: '林七夜',
      aliases: [{ name: '七夜' }],
      hidden: false,
      mentionCount: 2,
      relationCount: 0,
      eventCount: 0,
      summary: '',
    },
  ],
  mentions: [
    { id: 'm2', characterId: 'char-lqy', quote: '林七夜第二次做出选择。', prefixText: '后来', suffixText: '继续前进', location: { sourceChapterIndex: 3, chapterTitle: '第三章', paragraphIndex: 8 } },
    { id: 'm1', characterId: 'char-lqy', quote: '林七夜第一次登场。', prefixText: '开头', suffixText: '众人注视', location: { sourceChapterIndex: 1, chapterTitle: '第一章', paragraphIndex: 2 } },
  ],
  relations: [],
  evidence: [],
  events: [
    { id: 'e1', title: '加入小队', summary: '林七夜加入小队。', participantCharacterIds: ['char-lqy'], chapterLabel: '第二章', location: { sourceChapterIndex: 2, paragraphIndex: 1 } },
  ],
  factionMemberships: [],
  appearanceStats: [],
};

const growth = buildCharacterGrowthTimeline(payload, '七夜', { maxMentions: 8 });
assert.equal(growth.status, 'ready', 'Character growth tool should find profiles by alias');
assert.equal(growth.profile.displayName, '林七夜');
assert.deepEqual(
  growth.timeline.map((item) => `${item.kind}:${item.sourceChapterIndex}:${item.paragraphIndex}`),
  ['mention:1:2', 'event:2:1', 'mention:3:8'],
  'Character growth timeline should be sorted by original book order',
);

const mentionSearch = searchCharacterMentions(payload, {
  characterName: '七夜',
  chapterStart: 2,
  chapterEnd: 3,
  query: '选择',
  limit: 8,
});
assert.equal(mentionSearch.status, 'ready', 'Character mention search should find profiles by alias');
assert.equal(mentionSearch.profile.displayName, '林七夜');
assert.deepEqual(
  mentionSearch.mentions.map((item) => `${item.sourceChapterIndex}:${item.paragraphIndex}:${item.quote}`),
  ['3:8:林七夜第二次做出选择。'],
  'Character mention search should filter by chapter range and query text',
);

const arc = summarizeCharacterArc(payload, '七夜', { maxMentions: 8, maxStages: 4 });
assert.equal(arc.status, 'ready', 'Character arc summary should find profiles by alias');
assert.equal(arc.profile.displayName, '林七夜');
assert.deepEqual(
  arc.stages.map((stage) => `${stage.sourceChapterIndex}:${stage.mentionCount}:${stage.eventCount}`),
  ['1:1:0', '2:0:1', '3:1:0'],
  'Character arc summary should group mentions and events by source chapter order',
);
assert.match(arc.summary, /第一章/u, 'Character arc summary should include chapter labels in the compact summary');

console.log('Verified Agent executable tool model.');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-settings-center-model-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
const compiledSettingsCenterDir = join(outDir, 'features/settings-center');
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/i18n/index.ts',
  'src/i18n/en-US.ts',
  'src/i18n/zh-CN.ts',
  'src/features/settings-center/settingsCenterModel.ts',
  'src/features/settings-center/settingsCenterOptionsModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { createTranslator } = require(join(outDir, 'i18n/index.js'));
const zh = createTranslator('zh-CN', 'key');
const {
  defaultCustomSlashCommandDraft: defaultCustomSlashCommandDraftFromOptionsModel,
  buildRetentionSelectOptions: buildRetentionSelectOptionsFromOptionsModel,
  buildChapterStaticSelectOptions: buildChapterStaticSelectOptionsFromOptionsModel,
  buildAiProviderStaticSelectOptions: buildAiProviderStaticSelectOptionsFromOptionsModel,
  buildAiInteractionStaticSelectOptions: buildAiInteractionStaticSelectOptionsFromOptionsModel,
  buildAiModeSelectOptions: buildAiModeSelectOptionsFromOptionsModel,
  buildSearchIndexStaticSelectOptions: buildSearchIndexStaticSelectOptionsFromOptionsModel,
  buildLibraryImportStaticSelectOptions: buildLibraryImportStaticSelectOptionsFromOptionsModel,
  buildSearchStaticSelectOptions: buildSearchStaticSelectOptionsFromOptionsModel,
  buildAnnotationKnowledgeStaticSelectOptions: buildAnnotationKnowledgeStaticSelectOptionsFromOptionsModel,
  buildNavigationShortcutStaticSelectOptions: buildNavigationShortcutStaticSelectOptionsFromOptionsModel,
  buildReaderStaticSelectOptions: buildReaderStaticSelectOptionsFromOptionsModel,
  customSlashCommandTemplateLibrary: customSlashCommandTemplateLibraryFromOptionsModel,
  retentionDayOptions: retentionDayOptionsFromOptionsModel,
} = require(join(compiledSettingsCenterDir, 'settingsCenterOptionsModel.js'));
const {
  defaultCustomSlashCommandDraft,
  buildRetentionSelectOptions,
  buildChapterStaticSelectOptions,
  buildAiProviderStaticSelectOptions,
  buildAiInteractionStaticSelectOptions,
  buildAiModeSelectOptions,
  buildSearchIndexStaticSelectOptions,
  buildLibraryImportStaticSelectOptions,
  buildSearchStaticSelectOptions,
  buildAnnotationKnowledgeStaticSelectOptions,
  buildNavigationShortcutStaticSelectOptions,
  buildReaderStaticSelectOptions,
  customSlashCommandTemplateLibrary,
  retentionDayOptions,
  settingsGroups,
  resolveSettingsVisibleGroups,
  getNextSettingsGroupId,
  encryptionCoverageMatrix,
  matchesSettingsSearchText,
  normalizeSettingsSearchText,
  resolveAvailableAiModeOptions,
  settingsScopeMatrix,
  buildSettingsScopeMatrix,
} = require(join(compiledSettingsCenterDir, 'settingsCenterModel.js'));

assert.strictEqual(defaultCustomSlashCommandDraftFromOptionsModel, defaultCustomSlashCommandDraft);
assert.strictEqual(buildRetentionSelectOptionsFromOptionsModel, buildRetentionSelectOptions);
assert.strictEqual(buildChapterStaticSelectOptionsFromOptionsModel, buildChapterStaticSelectOptions);
assert.strictEqual(buildAiProviderStaticSelectOptionsFromOptionsModel, buildAiProviderStaticSelectOptions);
assert.strictEqual(buildAiInteractionStaticSelectOptionsFromOptionsModel, buildAiInteractionStaticSelectOptions);
assert.strictEqual(buildAiModeSelectOptionsFromOptionsModel, buildAiModeSelectOptions);
assert.strictEqual(buildSearchIndexStaticSelectOptionsFromOptionsModel, buildSearchIndexStaticSelectOptions);
assert.strictEqual(buildLibraryImportStaticSelectOptionsFromOptionsModel, buildLibraryImportStaticSelectOptions);
assert.strictEqual(buildSearchStaticSelectOptionsFromOptionsModel, buildSearchStaticSelectOptions);
assert.strictEqual(buildAnnotationKnowledgeStaticSelectOptionsFromOptionsModel, buildAnnotationKnowledgeStaticSelectOptions);
assert.strictEqual(buildNavigationShortcutStaticSelectOptionsFromOptionsModel, buildNavigationShortcutStaticSelectOptions);
assert.strictEqual(buildReaderStaticSelectOptionsFromOptionsModel, buildReaderStaticSelectOptions);
assert.strictEqual(customSlashCommandTemplateLibraryFromOptionsModel, customSlashCommandTemplateLibrary);
assert.strictEqual(retentionDayOptionsFromOptionsModel, retentionDayOptions);

assert.deepEqual(settingsGroups.map((group) => group.id), [
  'general',
  'appearance',
  'reader',
  'moyu',
  'chapters',
  'library',
  'ai',
  'translation',
  'search',
  'annotations',
  'data',
  'tasks',
  'shortcuts',
  'accessibility',
  'diagnostics',
]);

assert.equal(normalizeSettingsSearchText('  AI　连接  '), 'ai 连接');
assert.equal(matchesSettingsSearchText('api', ['AI API 连接', 'Base URL']), true);
assert.equal(matchesSettingsSearchText('zhong wen', ['中文章节', '目录']), false);
assert.equal(matchesSettingsSearchText('', ['AI']), true);

assert.deepEqual(resolveSettingsVisibleGroups('', 'reader').map((group) => group.id), ['reader']);
assert.deepEqual(resolveSettingsVisibleGroups('api', 'reader').map((group) => group.id), settingsGroups.map((group) => group.id));
assert.deepEqual(resolveSettingsVisibleGroups('　', 'ai').map((group) => group.id), ['ai']);

assert.equal(getNextSettingsGroupId('general', 'ArrowDown'), 'appearance');
assert.equal(getNextSettingsGroupId('general', 'ArrowRight'), 'appearance');
assert.equal(getNextSettingsGroupId('general', 'ArrowUp'), 'diagnostics');
assert.equal(getNextSettingsGroupId('diagnostics', 'ArrowDown'), 'general');
assert.equal(getNextSettingsGroupId('reader', 'Home'), 'general');
assert.equal(getNextSettingsGroupId('reader', 'End'), 'diagnostics');
assert.equal(getNextSettingsGroupId('reader', 'Enter'), null);
assert.equal(getNextSettingsGroupId('missing', 'ArrowDown'), null);

assert.deepEqual(settingsScopeMatrix.map((item) => item.scope), ['global', 'book', 'session', 'derived']);
assert.equal(settingsScopeMatrix.find((item) => item.scope === 'book').owner, 'Reader workspace');
assert.equal(
  buildSettingsScopeMatrix((key) => (key === 'settings.data.scopeMatrix.book.owner' ? '阅读器现场' : key)).find((item) => item.scope === 'book').owner,
  '阅读器现场',
);

assert.deepEqual(
  encryptionCoverageMatrix.map((item) => [item.kind, item.status]),
  [
    ['reader.highlights', 'protected'],
    ['reader.bookmarks', 'protected'],
    ['reader.tocEdits', 'protected'],
    ['reader.cloudAiRequestHistory', 'protected'],
    ['notes', 'protected'],
    ['highlights', 'protected'],
    ['flashcards', 'protected'],
    ['library.metadata', 'plain'],
    ['library.originals', 'plain'],
    ['indexes', 'plain'],
    ['settings', 'plain'],
    ['secure.keys', 'excluded'],
  ],
);

assert.deepEqual(defaultCustomSlashCommandDraft, {
  label: '',
  prompt: '',
  aliases: '',
  scopeHint: 'chapter',
  outputHint: 'custom',
});
assert.deepEqual(customSlashCommandTemplateLibrary.map((template) => template.id), [
  'custom-template-deep-summary',
  'custom-template-style-notes',
  'custom-template-question-maker',
]);
assert.equal(customSlashCommandTemplateLibrary.every((template) => template.retrievalStrategy === 'scope-first'), true);

assert.deepEqual(retentionDayOptions, [1, 3, 7, 30]);
assert.deepEqual(buildRetentionSelectOptions(zh), [
  { value: '1', label: '1 天' },
  { value: '3', label: '3 天' },
  { value: '7', label: '7 天' },
  { value: '30', label: '30 天' },
]);

assert.deepEqual(buildReaderStaticSelectOptions(zh), {
  pageVerticalAlign: [
    { value: 'top', label: '顶部' },
    { value: 'center', label: '居中' },
  ],
  longParagraphStrategy: [
    { value: 'strict', label: '严格分页' },
    { value: 'punctuation', label: '标点优先' },
  ],
  cjkPunctuation: [
    { value: 'off', label: '关闭' },
    { value: 'punctuation', label: '标点悬挂/挤压' },
  ],
  mixedTextSpacing: [
    { value: 'off', label: '关闭' },
    { value: 'auto', label: '自动中西文间距' },
  ],
  fontWeightBoost: [
    { value: 'off', label: '关闭' },
    { value: 'medium', label: '中等增强' },
    { value: 'strong', label: '强增强' },
  ],
});

assert.deepEqual(buildChapterStaticSelectOptions(zh), {
  bookTitleBracketMode: [
    { value: 'both', label: '书名号 + 尖括号' },
    { value: 'book-title', label: '仅书名号' },
    { value: 'angle', label: '仅尖括号' },
    { value: 'custom', label: '自定义正则' },
  ],
  paragraphMode: [
    { value: 'line', label: '每行作为段落' },
    { value: 'blank-line', label: '空行作为段落分隔' },
    { value: 'merge-short-lines', label: '自动合并短行' },
    { value: 'chinese-reflow', label: '中文段落重排' },
  ],
  tocRuleChangeRebuildMode: [
    { value: 'prompt', label: '询问后重建' },
    { value: 'auto', label: '自动重建' },
    { value: 'off', label: '不自动重建' },
  ],
});

assert.deepEqual(buildAiProviderStaticSelectOptions(zh), {
  endpoint: [
    { value: 'responses', label: 'Responses API' },
    { value: 'chat.completions', label: 'Chat Completions' },
  ],
  providerKind: [
    { value: 'openai', label: 'OpenAI' },
    { value: 'openai-compatible', label: '兼容服务' },
    { value: 'local-proxy', label: '本地代理' },
  ],
  cancelStrategy: [
    { value: 'abort-and-save-stopped', label: '中断并保存 stopped 历史' },
    { value: 'abort-only', label: '仅中断当前请求' },
    { value: 'abort-and-local-timeout', label: '中断并等待本地取消超时' },
  ],
  reasoningEffort: [
    { value: 'none', label: 'none' },
    { value: 'minimal', label: 'minimal' },
    { value: 'low', label: 'low' },
    { value: 'medium', label: 'medium' },
    { value: 'high', label: 'high' },
    { value: 'xhigh', label: 'xhigh' },
    { value: 'max', label: 'max' },
  ],
  responseFormat: [
    { value: 'auto', label: '自动' },
    { value: 'json_object', label: 'JSON object' },
    { value: 'json_schema', label: 'JSON schema' },
  ],
});

assert.deepEqual(buildAiInteractionStaticSelectOptions(zh), {
  scope: [
    { value: 'selection', label: '选中文本' },
    { value: 'page-lite', label: '当前页轻量' },
    { value: 'page', label: '当前页' },
    { value: 'chapter', label: '当前章' },
    { value: 'volume', label: '当前卷' },
    { value: 'book', label: '整本书' },
    { value: 'annotations', label: '标注' },
    { value: 'library', label: '书库' },
  ],
  noSelectionFallbackScope: [
    { value: 'page', label: '当前页' },
    { value: 'chapter', label: '当前章' },
    { value: 'book', label: '整本书' },
  ],
  scopePriorityStrategy: [
    { value: 'command-first', label: '命令范围优先' },
    { value: 'panel-first', label: '面板范围优先' },
    { value: 'narrowest-first', label: '较小范围优先' },
  ],
  retrievalStrategy: [
    { value: 'scope-first', label: '范围优先' },
    { value: 'entity-extraction', label: '实体抽取' },
    { value: 'anomaly-extraction', label: '异常/伏笔抽取' },
    { value: 'timeline-extraction', label: '时间线抽取' },
    { value: 'key-sentences', label: '关键句' },
  ],
  retrievalQueryRewriteMode: [
    { value: 'basic', label: '基础规则改写' },
    { value: 'off', label: '关闭改写' },
  ],
  multiStageRetrievalMode: [
    { value: 'off', label: '保持单阶段检索' },
    { value: 'auto', label: '自动多阶段检索' },
  ],
  ftsUnavailableBehavior: [
    { value: 'show-warning', label: '提示并要求修复' },
    { value: 'text-fallback', label: '降级到文本搜索' },
    { value: 'fail-fast', label: '直接失败' },
  ],
  defaultOutputFormat: [
    { value: 'structured', label: '结构化卡片' },
    { value: 'markdown', label: 'Markdown fallback' },
  ],
  citationCardDefaultDensity: [
    { value: 'detailed', label: '默认展开详细引用' },
    { value: 'compact', label: '默认紧凑引用' },
  ],
  citationFieldStrictness: [
    { value: 'normal', label: '普通：核心定位字段' },
    { value: 'lenient', label: '宽松：仅提示关键缺失' },
    { value: 'strict', label: '严格：要求完整定位和来源' },
  ],
  toolCallDisplayMode: [
    { value: 'summary', label: '摘要' },
    { value: 'hidden', label: '隐藏' },
    { value: 'full', label: '完整' },
  ],
  citationDefaultSaveTarget: [
    { value: 'excerpt', label: '摘录笔记' },
    { value: 'highlight', label: '高亮' },
    { value: 'both', label: '高亮 + 摘录笔记' },
  ],
});

assert.deepEqual(buildSearchIndexStaticSelectOptions(zh), {
  indexStrategyVersion: [
    { value: 'stable', label: '稳定策略' },
    { value: 'latest', label: '最新策略' },
    { value: 'compat', label: '兼容旧索引' },
  ],
  ftsRepairStrategy: [
    { value: 'prompt', label: '检测后提示修复' },
    { value: 'manual', label: '只手动修复' },
    { value: 'auto', label: '可自动修复' },
  ],
  indexRebuildStrategy: [
    { value: 'prompt', label: '标记过期并提示重建' },
    { value: 'manual', label: '只标记过期，手动重建' },
    { value: 'auto', label: '自动排队重建' },
  ],
  indexPauseResumeStrategy: [
    { value: 'manual', label: '暂停后手动恢复' },
    { value: 'ask', label: '启动时提示恢复' },
    { value: 'auto', label: '启动时自动恢复暂停索引' },
  ],
});

assert.deepEqual(buildLibraryImportStaticSelectOptions(zh), {
  viewMode: [
    { value: 'card', label: '卡片' },
    { value: 'list', label: '列表' },
    { value: 'shelf', label: '书架' },
  ],
  sort: [
    { value: 'recent', label: '最近导入' },
    { value: 'title', label: '标题' },
    { value: 'progress', label: '进度' },
    { value: 'trashExpiry', label: '回收站过期' },
  ],
  filter: [
    { value: 'all', label: '全部' },
    { value: 'unread', label: '未读' },
    { value: 'reading', label: '阅读中' },
    { value: 'done', label: '已完成' },
  ],
  duplicateStrategy: [
    { value: 'ask', label: '每次询问' },
    { value: 'skip', label: '跳过' },
    { value: 'replace', label: '覆盖' },
    { value: 'copy', label: '另存副本' },
  ],
  coverToneStrategy: [
    { value: 'format', label: '按格式' },
    { value: 'hash', label: '按内容 hash' },
    { value: 'progress', label: '按阅读进度' },
  ],
  coverLabelStrategy: [
    { value: 'format', label: 'TXT' },
    { value: 'ai', label: 'AI' },
    { value: 'read', label: '阅' },
    { value: 'knowledge', label: '知' },
    { value: 'first-char', label: '文件首字' },
  ],
  importFileFilter: [
    { value: 'txt', label: '推荐格式' },
    { value: 'all', label: '全部文件' },
  ],
  txtImportEncodingMode: [
    { value: 'auto', label: '自动识别' },
    { value: 'utf-8', label: '强制 UTF-8' },
    { value: 'gb18030', label: '强制 GB18030' },
  ],
  density: [
    { value: 'comfortable', label: '舒适' },
    { value: 'compact', label: '紧凑' },
    { value: 'spacious', label: '宽松' },
  ],
});

assert.deepEqual(buildSearchStaticSelectOptions(zh), {
  scope: [
    { value: 'page', label: '当前页' },
    { value: 'chapter', label: '当前章' },
    { value: 'book', label: '整本书' },
    { value: 'annotations', label: '标注' },
    { value: 'bookmarks', label: '书签' },
    { value: 'all', label: '全部' },
  ],
  globalMode: [
    { value: 'instant', label: '输入即搜' },
    { value: 'enter', label: '回车搜索' },
  ],
  readerChapterFilter: [
    { value: 'all', label: '全部章节' },
    { value: 'current', label: '当前章节' },
  ],
  readerHighlightColor: [
    { value: 'amber', label: '琥珀' },
    { value: 'blue', label: '蓝色' },
    { value: 'green', label: '绿色' },
    { value: 'pink', label: '粉色' },
    { value: 'violet', label: '紫色' },
    { value: 'red', label: '红色' },
  ],
});

assert.deepEqual(buildAnnotationKnowledgeStaticSelectOptions(zh), {
  highlightColor: [
    { value: 'yellow', label: '黄色' },
    { value: 'green', label: '绿色' },
    { value: 'blue', label: '蓝色' },
    { value: 'pink', label: '粉色' },
    { value: 'violet', label: '紫色' },
    { value: 'red', label: '红色' },
  ],
  highlightColorShortcut: [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
    { value: '6', label: '6' },
    { value: 'disabled', label: '禁用' },
  ],
  highlightImportance: [
    { value: 'normal', label: '普通' },
    { value: 'high', label: '重要' },
    { value: 'critical', label: '关键' },
  ],
  highlightReviewStatus: [
    { value: 'new', label: '新建' },
    { value: 'due', label: '待复习' },
    { value: 'reviewed', label: '已复习' },
  ],
  highlightOverlapStrategy: [
    { value: 'first-start-longest', label: '起点优先，长范围优先' },
    { value: 'latest-created', label: '最近创建优先' },
    { value: 'highest-importance', label: '重要性优先' },
  ],
  anchorRepairStrategy: [
    { value: 'context-first', label: '上下文优先自动修复' },
    { value: 'text-first', label: '文本优先自动修复' },
    { value: 'manual', label: '不自动迁移' },
  ],
  exportFormat: [
    { value: 'markdown', label: 'Markdown' },
    { value: 'csv', label: 'CSV' },
    { value: 'anki', label: 'Anki CSV' },
    { value: 'obsidian', label: 'Obsidian Markdown' },
    { value: 'logseq', label: 'Logseq Markdown' },
    { value: 'readwise', label: 'Readwise CSV' },
    { value: 'json', label: 'JSON' },
  ],
  annotationExportContent: [
    { value: 'all', label: '全部' },
    { value: 'highlights', label: '高亮' },
    { value: 'bookmarks', label: '书签' },
    { value: 'notes', label: '备注' },
  ],
  annotationJsonImportConflictStrategy: [
    { value: 'overwrite', label: '覆盖同 ID' },
    { value: 'skip', label: '跳过同 ID' },
    { value: 'merge', label: '合并备注和标签' },
  ],
  noteDefaultSaveTarget: [
    { value: 'knowledge', label: '知识库笔记' },
    { value: 'book', label: '当前书笔记' },
    { value: 'inbox', label: '阅读收件箱' },
  ],
  annotationCsvField: [
    { value: 'type', label: '类型' },
    { value: 'id', label: 'ID' },
    { value: 'chapter', label: '章节' },
    { value: 'text', label: '文本' },
    { value: 'note', label: '备注' },
    { value: 'color', label: '颜色' },
    { value: 'createdAt', label: '创建时间' },
    { value: 'location', label: '位置' },
  ],
  knowledgeDefaultColumn: [
    { value: 'highlights', label: '高亮' },
    { value: 'notes', label: '笔记' },
    { value: 'flashcards', label: '闪卡' },
  ],
  bookmarkSort: [
    { value: 'created-desc', label: '创建倒序' },
    { value: 'created-asc', label: '创建正序' },
    { value: 'chapter-asc', label: '章节顺序' },
  ],
  bookmarkGroup: [
    { value: 'none', label: '不分组' },
    { value: 'chapter', label: '按章节' },
    { value: 'created', label: '按创建日期' },
    { value: 'tag', label: '按标签' },
  ],
});

assert.deepEqual(buildNavigationShortcutStaticSelectOptions(zh), {
  navItem: [
    { value: 'overview', label: '总览' },
    { value: 'reader', label: '阅读' },
    { value: 'library', label: '书库' },
    { value: 'knowledge', label: '知识' },
    { value: 'characters', label: '角色' },
    { value: 'search', label: '搜索' },
    { value: 'tasks', label: '任务' },
    { value: 'settings', label: '设置' },
  ],
  topbarButton: [
    { value: 'command', label: '命令面板' },
    { value: 'night', label: '夜间' },
    { value: 'search', label: '搜索' },
    { value: 'aiSummary', label: 'AI 总结' },
  ],
  commandPaletteShortcut: [
    { value: 'ctrl-k', label: 'Ctrl/Cmd+K' },
    { value: 'ctrl-p', label: 'Ctrl/Cmd+P' },
    { value: 'ctrl-shift-p', label: 'Ctrl/Cmd+Shift+P' },
    { value: 'disabled', label: '禁用' },
  ],
  commandPaletteSortMode: [
    { value: 'fixed', label: '固定分类' },
    { value: 'recent', label: '最近使用优先' },
  ],
  readerNavigationShortcut: [
    { value: 'ctrl-b', label: 'Ctrl/Cmd+B' },
    { value: 'ctrl-r', label: 'Ctrl/Cmd+R' },
    { value: 'disabled', label: '禁用' },
  ],
  libraryNavigationShortcut: [
    { value: 'ctrl-l', label: 'Ctrl/Cmd+L' },
    { value: 'ctrl-alt-l', label: 'Ctrl/Cmd+Alt+L' },
    { value: 'disabled', label: '禁用' },
  ],
  searchNavigationShortcut: [
    { value: 'ctrl-f', label: 'Ctrl/Cmd+F' },
    { value: 'ctrl-alt-f', label: 'Ctrl/Cmd+Alt+F' },
    { value: 'disabled', label: '禁用' },
  ],
  importShortcut: [
    { value: 'ctrl-i', label: 'Ctrl/Cmd+I' },
    { value: 'ctrl-alt-i', label: 'Ctrl/Cmd+Alt+I' },
    { value: 'disabled', label: '禁用' },
  ],
  aiSummaryShortcut: [
    { value: 'ctrl-enter', label: 'Ctrl/Cmd+Enter' },
    { value: 'ctrl-shift-enter', label: 'Ctrl/Cmd+Shift+Enter' },
    { value: 'disabled', label: '禁用' },
  ],
  readerHighlightShortcut: [
    { value: 'h', label: 'H' },
    { value: 'ctrl-h', label: 'Ctrl/Cmd+H' },
    { value: 'disabled', label: '禁用' },
  ],
  readerBookmarkShortcut: [
    { value: 'm', label: 'M' },
    { value: 'ctrl-m', label: 'Ctrl/Cmd+M' },
    { value: 'disabled', label: '禁用' },
  ],
  readerAiPanelShortcut: [
    { value: 'a', label: 'A' },
    { value: 'ctrl-alt-a', label: 'Ctrl/Cmd+Alt+A' },
    { value: 'disabled', label: '禁用' },
  ],
  readerSearchShortcut: [
    { value: 'ctrl-f', label: 'Ctrl/Cmd+F' },
    { value: 'slash', label: '/' },
    { value: 'disabled', label: '禁用' },
  ],
});

const aiModeOptions = buildAiModeSelectOptions(zh);
assert.deepEqual(aiModeOptions, [
  { value: 'cloud', label: '云端模型' },
  { value: 'local', label: '本地索引' },
  { value: 'mock', label: '演示' },
]);
assert.deepEqual(resolveAvailableAiModeOptions(aiModeOptions, { cloudAiEnabled: true, localAiEnabled: true }).map((item) => item.value), ['cloud', 'local', 'mock']);
assert.deepEqual(resolveAvailableAiModeOptions(aiModeOptions, { cloudAiEnabled: false, localAiEnabled: true }).map((item) => item.value), ['local', 'mock']);
assert.deepEqual(resolveAvailableAiModeOptions(aiModeOptions, { cloudAiEnabled: true, localAiEnabled: false }).map((item) => item.value), ['cloud', 'mock']);
assert.deepEqual(resolveAvailableAiModeOptions(aiModeOptions, { cloudAiEnabled: false, localAiEnabled: false }).map((item) => item.value), ['mock']);

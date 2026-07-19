import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./ReaderSettingsPanel.tsx', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../i18n/en-US.ts', import.meta.url), 'utf8');

const forbiddenHardcodedLabels = [
  '保存为本书章节规则',
  '清除本书章节规则',
  '当前书籍正在使用独立章节规则覆盖全局规则。',
  '当前书籍使用设置中心的全局章节规则。',
  '标题编号清洗',
  '标题装饰线',
  '时间格式',
  '进度显示格式',
  '页眉页脚字体大小',
  '页眉页脚透明度',
  '24 小时短时间',
  '12 小时短时间',
  '日期 + 时间',
  '百分比',
  '当前页',
  '章节页',
  '总页数',
];

for (const label of forbiddenHardcodedLabels) {
  assert.equal(panel.includes(label), false, `Reader settings panel should translate hardcoded label: ${label}`);
}

const requiredReaderKeys = [
  'reader.titleNumberCleanup',
  'reader.titleNumberCleanup.keep',
  'reader.titleNumberCleanup.stripNumber',
  'reader.titleDecoration',
  'reader.titleDecoration.off',
  'reader.titleDecoration.line',
  'reader.headerFooterTimeFormat',
  'reader.headerFooterTimeFormat.short24h',
  'reader.headerFooterTimeFormat.short12h',
  'reader.headerFooterTimeFormat.dateTime',
  'reader.headerFooterProgressFormat',
  'reader.headerFooterProgressFormat.percent',
  'reader.headerFooterProgressFormat.currentPage',
  'reader.headerFooterProgressFormat.chapterPage',
  'reader.headerFooterProgressFormat.totalPages',
  'reader.headerFooterFontSize',
  'reader.headerFooterOpacity',
  'reader.settings.saveBookChapterRulesOverride',
  'reader.settings.clearBookChapterRulesOverride',
  'reader.settings.bookChapterRulesOverrideEnabled',
  'reader.settings.bookChapterRulesOverrideGlobal',
];

const requiredAccessibilityKeys = [
  'settings.accessibility.section.title',
  'settings.accessibility.section.description',
  'settings.accessibility.translationFallback.title',
  'settings.accessibility.translationFallback.description',
  'settings.accessibility.customTerminology.title',
  'settings.accessibility.customTerminology.description',
  'settings.accessibility.customTerminology.placeholder',
  'settings.accessibility.reduceMotion.title',
  'settings.accessibility.reduceMotion.description',
  'settings.accessibility.highContrast.title',
  'settings.accessibility.highContrast.description',
  'settings.accessibility.enhancedFocus.title',
  'settings.accessibility.enhancedFocus.description',
  'settings.accessibility.largeTouchTargets.title',
  'settings.accessibility.largeTouchTargets.description',
  'settings.accessibility.largeTouchTargets.compact',
  'settings.accessibility.largeTouchTargets.guaranteed',
  'settings.accessibility.largeTouchTargets.compactMode',
  'settings.accessibility.colorBlindFriendlyHighlights.title',
  'settings.accessibility.colorBlindFriendlyHighlights.description',
  'settings.accessibility.colorBlindFriendlyHighlights.friendly',
  'settings.accessibility.colorBlindFriendlyHighlights.default',
  'settings.accessibility.readerReadAloudEnabled.title',
  'settings.accessibility.readerReadAloudEnabled.description',
  'settings.accessibility.readerReadAloudEnabled.showButton',
  'settings.accessibility.readerReadAloudEnabled.hideButton',
  'settings.accessibility.readerReadAloudRate.title',
  'settings.accessibility.readerReadAloudRate.description',
  'settings.accessibility.readerReadAloudPitch.title',
  'settings.accessibility.readerReadAloudPitch.description',
  'settings.accessibility.narratorVoice.title',
  'settings.accessibility.narratorVoice.description',
  'settings.accessibility.maleVoice.title',
  'settings.accessibility.maleVoice.description',
  'settings.accessibility.femaleVoice.title',
  'settings.accessibility.femaleVoice.description',
  'settings.accessibility.characterVoiceRules.title',
  'settings.accessibility.characterVoiceRules.description',
  'settings.accessibility.characterVoiceRules.configured',
  'settings.accessibility.characterVoiceRules.notConfigured',
  'settings.accessibility.characterVoiceRules.placeholder',
  'settings.accessibility.voice.systemDefault',
  'settings.accessibility.voice.defaultSuffix',
  'settings.accessibility.voice.unavailable',
];

for (const key of [...requiredReaderKeys, ...requiredAccessibilityKeys]) {
  assert.match(zh, new RegExp(`'${escapeRegExp(key)}'\\s*:`), `zh-CN should define ${key}`);
  assert.match(en, new RegExp(`'${escapeRegExp(key)}'\\s*:`), `en-US should define ${key}`);
}

console.log('Verified reader settings and accessibility settings i18n coverage.');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

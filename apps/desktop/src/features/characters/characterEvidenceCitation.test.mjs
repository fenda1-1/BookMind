import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-evidence-citation-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterEvidenceCitation.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { formatCharacterEvidenceCitationCopy } = require(join(outDir, 'characterEvidenceCitation.js'));

const labels = {
  heading: '人物证据引用',
  book: '书籍',
  type: '类型',
  target: '关联目标',
  location: '位置',
  quote: '引用',
  claim: '结论',
  source: '来源',
  confidence: '置信度',
  evidenceId: '证据 ID',
  missingValue: '-',
};

assert.equal(formatCharacterEvidenceCitationCopy({
  evidenceId: 'evidence-1',
  bookTitle: '精神病病院学斩神',
  typeLabel: '出场',
  targetLabel: '林七夜',
  locationLabel: '第七章 雨夜 · 第 12 段',
  quote: '林七夜在雨夜抵达病院。',
  claim: '林七夜抵达病院',
  sourceLabel: '规则识别 · 有效',
  confidencePercent: 92,
  labels,
}), [
  '人物证据引用',
  '书籍: 精神病病院学斩神',
  '类型: 出场',
  '关联目标: 林七夜',
  '位置: 第七章 雨夜 · 第 12 段',
  '引用: 林七夜在雨夜抵达病院。',
  '结论: 林七夜抵达病院',
  '来源: 规则识别 · 有效',
  '置信度: 92%',
  '证据 ID: evidence-1',
].join('\n'));

assert.equal(formatCharacterEvidenceCitationCopy({
  evidenceId: 'evidence-empty',
  bookTitle: '  ',
  typeLabel: '',
  targetLabel: '  ',
  locationLabel: '',
  quote: '',
  claim: '  ',
  sourceLabel: '',
  confidencePercent: 101.8,
  labels,
}), [
  '人物证据引用',
  '书籍: -',
  '类型: -',
  '关联目标: -',
  '位置: -',
  '引用: -',
  '结论: -',
  '来源: -',
  '置信度: 100%',
  '证据 ID: evidence-empty',
].join('\n'));

assert.equal(formatCharacterEvidenceCitationCopy({
  evidenceId: 'evidence-private',
  bookTitle: '精神病病院学斩神',
  typeLabel: '出场',
  targetLabel: '林七夜',
  locationLabel: '第七章 雨夜 · 第 12 段',
  quote: '林七夜在雨夜抵达病院。',
  claim: '林七夜抵达病院',
  sourceLabel: '规则识别 · 有效',
  confidencePercent: 92,
  labels,
  privacyMode: true,
  privateValue: '已隐藏（隐私模式）',
}), [
  '人物证据引用',
  '书籍: 已隐藏（隐私模式）',
  '类型: 出场',
  '关联目标: 已隐藏（隐私模式）',
  '位置: 已隐藏（隐私模式）',
  '引用: 已隐藏（隐私模式）',
  '结论: 已隐藏（隐私模式）',
  '来源: 规则识别 · 有效',
  '置信度: 92%',
  '证据 ID: evidence-private',
].join('\n'));

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-ai-response-text-aliases-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/aiMarkdownFallback.ts',
  'src/services/aiResponseProtocol.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { parseAiResponseProtocol, renderBlockPlainText } = await import(pathToFileURL(join(outDir, 'aiResponseProtocol.js')).href);
const markdownOutDir = join(tmpdir(), `bookmind-ai-rich-markdown-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--outDir', markdownOutDir,
  '--skipLibCheck',
  'src/features/reader-core/markdownReaderModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });
const { buildMarkdownReaderDocument } = await import(pathToFileURL(join(markdownOutDir, 'markdownReaderModel.js')).href);

const textAliasResponse = parseAiResponseProtocol(JSON.stringify({
  schema: 'bookmind.ai.response.v2',
  title: 'BookMind AI 身份',
  analysis: {},
  blocks: [{ type: 'text', text: '我是一个由 BookMind 驱动的人工智能助手，旨在帮助您阅读和分析文档。' }],
  citations: [],
  diagnostics: {},
}));
assert.equal(textAliasResponse.blocks[0]?.type, 'paragraph', 'text blocks must normalize to the paragraph renderer');
assert.equal(textAliasResponse.blocks[0]?.content, '我是一个由 BookMind 驱动的人工智能助手，旨在帮助您阅读和分析文档。', 'text fields must normalize to visible block content');
assert.equal(renderBlockPlainText(textAliasResponse.blocks[0]), textAliasResponse.blocks[0].content, 'normalized text blocks must expose their actual answer instead of the type name');

const looseTextBlocks = parseAiResponseProtocol(JSON.stringify({
  schema: 'bookmind.ai.response.v2',
  blocks: [
    { body: '缺少 type 的正文仍应显示。' },
    '字符串块也应显示。',
    { type: 'final-answer', message: '常见类型和字段别名也应显示。' },
  ],
}));
assert.deepEqual(looseTextBlocks.blocks.map((block) => block.content), [
  '缺少 type 的正文仍应显示。',
  '字符串块也应显示。',
  '常见类型和字段别名也应显示。',
], 'loose text block shapes must all become visible paragraph content');
assert.ok(looseTextBlocks.blocks.every((block) => block.type === 'paragraph'), 'all loose text aliases must use the paragraph renderer');

const topLevelTextFallback = parseAiResponseProtocol(JSON.stringify({
  schema: 'bookmind.ai.response.v2',
  blocks: [],
  answer: '即使 blocks 为空，也必须显示顶层回答。',
}));
assert.equal(topLevelTextFallback.blocks[0]?.content, '即使 blocks 为空，也必须显示顶层回答。', 'empty block arrays must fall back to top-level answer text');

const richTextResponse = parseAiResponseProtocol(JSON.stringify({
  schema: 'bookmind.ai.response.v2',
  title: 'BookMind AI 功能介绍',
  blocks: [{
    type: 'text',
    text: '我是一个由 BookMind 驱动的AI助手，旨在帮助您更深入地理解和分析书籍内容。\n\n- get_current_context：获取当前阅读上下文。\n- search_local_index：在本地索引中搜索相关信息。\n- get_paragraph_window：获取指定段落的上下文窗口。\n- jump_to_source：跳转到原文出处。\n- save_ai_note：保存AI生成的笔记。\n- save_citation_highlight：保存引文高亮。\n- generate_flashcards：生成闪卡以帮助记忆。\n- build_timeline：构建事件时间线。\n- extract_characters：提取并分析人物。\n- extract_foreshadowing：提取伏笔。\n- request_cloud_ai：请求云端AI服务以进行更复杂的分析。',
  }],
}));
const richTextDocument = buildMarkdownReaderDocument(richTextResponse.blocks[0].content);
assert.equal(richTextDocument.blocks[0]?.type, 'paragraph', 'introductory rich text must remain a paragraph');
assert.equal(richTextDocument.blocks[1]?.type, 'list', 'newline-delimited tool descriptions must render as a semantic list');
assert.equal(richTextDocument.blocks[1]?.items.length, 11, 'every tool list item must remain visible');

const markdownCoverage = buildMarkdownReaderDocument('# 标题\n\n1. 有序列表\n2. 第二项\n\n> 引用\n\n| 字段 | 内容 |\n| --- | --- |\n| A | B |\n\n```ts\nconst ready = true;\n```');
assert.deepEqual(markdownCoverage.blocks.map((block) => block.type), ['heading', 'list', 'blockquote', 'table', 'code'], 'headings, lists, quotes, tables, and code fences must all retain renderable block types');

console.log('Verified AI response text block aliases and fallbacks.');

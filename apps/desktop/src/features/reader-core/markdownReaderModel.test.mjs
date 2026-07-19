import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-markdown-reader-model-test-${process.pid}`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck', 'src/features/reader-core/markdownReaderModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });
const compiledModelPath = existsSync(join(outDir, 'features/reader-core/markdownReaderModel.js'))
  ? join(outDir, 'features/reader-core/markdownReaderModel.js')
  : join(outDir, 'markdownReaderModel.js');
const { buildMarkdownReaderDocument, isMarkdownBookFormat } = await import(pathToFileURL(compiledModelPath).href);

assert.equal(isMarkdownBookFormat('md'), true);
assert.equal(isMarkdownBookFormat('markdown'), true);
assert.equal(isMarkdownBookFormat('txt'), false);

const source = [
  '# BookMind 手册',
  '',
  '开篇 **重点** 与 `code`。',
  '',
  '```md',
  '# 代码里的标题不进目录',
  '```',
  '',
  '## 安装',
  '- 导入',
  '- 阅读',
  '',
  '### 快捷键',
  '1. Ctrl+K',
  '2. Ctrl+F',
  '',
  '> 引用说明',
  '',
  '---',
  '',
  '## 安全 <script>alert(1)</script>',
].join('\n');

const document = buildMarkdownReaderDocument(source);

assert.deepEqual(
  document.toc.map((item) => ({ level: item.level, title: item.title, id: item.id, lineIndex: item.lineIndex })),
  [
    { level: 1, title: 'BookMind 手册', id: 'bookmind-手册', lineIndex: 0 },
    { level: 2, title: '安装', id: '安装', lineIndex: 8 },
    { level: 3, title: '快捷键', id: '快捷键', lineIndex: 12 },
    { level: 2, title: '安全 <script>alert(1)</script>', id: '安全-script-alert1-script', lineIndex: 20 },
  ],
  'Markdown TOC should be built from real headings and ignore headings inside fenced code blocks.',
);

assert.equal(document.blocks[0].type, 'heading');
assert.equal(document.blocks[0].text, 'BookMind 手册');
assert.equal(document.blocks[1].type, 'paragraph');
assert.equal(document.blocks[1].segments.some((segment) => segment.kind === 'strong' && segment.text === '重点'), true);
assert.equal(document.blocks[1].segments.some((segment) => segment.kind === 'code' && segment.text === 'code'), true);
assert.equal(document.blocks[2].type, 'code');
assert.equal(document.blocks[2].language, 'md');
assert.match(document.blocks[2].code, /代码里的标题不进目录/u);
assert.equal(document.blocks[3].type, 'heading');
assert.equal(document.blocks[4].type, 'list');
assert.equal(document.blocks[4].ordered, false);
assert.deepEqual(document.blocks[4].items.map((item) => item.segments.map((segment) => segment.text).join('')), ['导入', '阅读']);
assert.equal(document.blocks[6].type, 'list');
assert.equal(document.blocks[6].ordered, true);
assert.equal(document.blocks[7].type, 'blockquote');
assert.equal(document.blocks[8].type, 'divider');
assert.equal(document.blocks.at(-1).text, '安全 <script>alert(1)</script>');

const gfmSource = [
  '# GFM',
  '',
  '- [x] 25hz CosyVoice-300M base model',
  '- [ ] Streaming inference mode support',
  '',
  '| Model | Open-Source | test-zh<br>CER (%) ↓ |',
  '| :--- | :---: | ---: |',
  '| Human | - | 1.26 |',
  '| F5-TTS | ✅ | [![Stars](https://img.shields.io/github/stars/SWivid/F5-TTS.svg)](https://github.com/SWivid/F5-TTS) |',
].join('\n');

const gfmDocument = buildMarkdownReaderDocument(gfmSource);
const taskList = gfmDocument.blocks.find((block) => block.type === 'list' && block.task);
assert.ok(taskList, 'GFM task list items should be parsed as task list blocks.');
assert.equal(taskList.items[0].checked, true);
assert.equal(taskList.items[1].checked, false);
assert.equal(taskList.items[0].segments.map((segment) => segment.text).join(''), '25hz CosyVoice-300M base model');

const table = gfmDocument.blocks.find((block) => block.type === 'table');
assert.ok(table, 'GFM pipe tables should be parsed as table blocks instead of paragraph text.');
assert.deepEqual(table.headers.map((cell) => cell.map((segment) => segment.text).join('')), ['Model', 'Open-Source', 'test-zhCER (%) ↓']);
assert.deepEqual(table.alignments, ['left', 'center', 'right']);
assert.equal(table.headers[2].some((segment) => segment.kind === 'break'), true, 'HTML <br> inside Markdown tables should become a line break.');
assert.deepEqual(table.rows.map((row) => row[0].map((segment) => segment.text).join('')), ['Human', 'F5-TTS']);
assert.equal(table.rows[1][2][0].kind, 'link');
assert.equal(table.rows[1][2][0].segments[0].kind, 'image');
assert.equal(table.rows[1][2][0].segments[0].alt, 'Stars');
assert.match(table.rows[1][2][0].segments[0].src, /img\.shields\.io\/github\/stars/u);

const compatibilitySource = [
  '- Clone the repo',
  '',
  '    ``` sh',
  '    git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git',
  '    cd CosyVoice',
  '    ```',
  '',
  '<img src="./asset/dingding.png" width="250px">',
].join('\n');
const compatibilityDocument = buildMarkdownReaderDocument(compatibilitySource);
const indentedFence = compatibilityDocument.blocks.find((block) => block.type === 'code');
assert.ok(indentedFence, 'Indented fenced code blocks under list items should render as code blocks.');
assert.equal(indentedFence.language, 'sh');
assert.match(indentedFence.code, /git clone --recursive/u);
assert.doesNotMatch(indentedFence.code, /```/u);
const htmlImageParagraph = compatibilityDocument.blocks.find((block) => block.type === 'paragraph' && block.segments.some((segment) => segment.kind === 'image'));
assert.ok(htmlImageParagraph, 'Raw HTML img tags should render as Markdown image segments.');
const htmlImage = htmlImageParagraph.segments.find((segment) => segment.kind === 'image');
assert.equal(htmlImage.src, './asset/dingding.png');
assert.equal(htmlImage.width, '250px');

console.log('Verified dedicated Markdown reader model parses document blocks and heading TOC safely.');

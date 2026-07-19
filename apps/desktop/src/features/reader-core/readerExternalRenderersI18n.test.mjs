import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdfView = readFileSync(new URL('./PdfReaderView.tsx', import.meta.url), 'utf8');
const markdownView = readFileSync(new URL('./MarkdownReaderView.tsx', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../i18n/en-US.ts', import.meta.url), 'utf8');

for (const source of [pdfView, markdownView]) {
  assert.doesNotMatch(source, /隐藏目录|显示目录|正在加载|文档目录|当前 Markdown 没有标题|Markdown 目录|PDF 目录|目录显示方式|列表视图|缩略图视图|调整目录宽度|未找到可渲染的页面|加载中|已渲染|缩放|页码目录|内置书签|已完成|未完成/u, 'External reader renderers should not hard-code visible Chinese UI copy.');
  assert.match(source, /useI18n\(\)/u, 'External reader renderers should read visible copy through i18n.');
}

assert.doesNotMatch(markdownView, /按标题生成|未发现标题/u, 'Markdown TOC should not show explanatory helper text under the title.');
assert.doesNotMatch(pdfView, /页码目录|内置书签/u, 'PDF TOC should not show explanatory helper text under the title or each item.');

for (const key of [
  'reader.external.toc.show',
  'reader.external.toc.hide',
  'reader.external.toc.title',
  'reader.external.toc.listView',
  'reader.external.toc.thumbnailView',
  'reader.external.toc.resize',
  'reader.external.markdown.aria',
  'reader.external.markdown.loading',
  'reader.external.markdown.headingCount',
  'reader.external.markdown.emptyToc',
  'reader.external.markdown.taskDone',
  'reader.external.markdown.taskTodo',
  'reader.external.pdf.loading',
  'reader.external.pdf.pageCount',
  'reader.external.pdf.emptyPages',
  'reader.external.pdf.rendered',
]) {
  assert.match(zh, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `zh-CN should define ${key}`);
  assert.match(en, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `en-US should define ${key}`);
}

console.log('Verified PDF and Markdown external reader copy uses i18n without explanatory TOC helper text.');

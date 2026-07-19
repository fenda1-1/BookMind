import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-knowledge-export-test-${process.pid}`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/services/knowledgeExportService.ts'], { cwd: process.cwd(), stdio: 'inherit' });
const require = createRequire(import.meta.url);
const { serializeKnowledgeExport } = require(join(outDir, 'services', 'knowledgeExportService.js'));

const item = { id: 'reader-highlight:book-1:h1', recordId: 'h1', tab: 'highlights', title: '阅读高亮', body: '带有“引号”,逗号的正文', meta: '第 2 章', sourceLabel: '第 2 章', sourceTargetId: 'book-1:chapter:1', createdAt: '2026-07-18T00:00:00.000Z', kind: 'highlights', storage: 'reader-highlight', bookId: 'book-1', bookTitle: '测试书', note: '我的批注', tags: ['重点'] };

assert.equal(serializeKnowledgeExport([item], 'markdown', '知识索引').extension, 'md');
assert.match(serializeKnowledgeExport([item], 'markdown', '知识索引').content, /我的批注/u);
assert.match(serializeKnowledgeExport([item], 'json', '知识索引').content, /"schemaVersion": 1/u);
assert.match(serializeKnowledgeExport([item], 'csv', '知识索引').content, /"带有“引号”,逗号的正文"/u);
assert.match(serializeKnowledgeExport([item], 'anki', '知识索引').content, /"Front","Back","Tags"/u);
assert.match(serializeKnowledgeExport([item], 'obsidian', '知识索引').content, /\[\[测试书\]\]/u);
assert.match(serializeKnowledgeExport([item], 'logseq', '知识索引').content, /book:: 测试书/u);
assert.match(serializeKnowledgeExport([item], 'readwise', '知识索引').content, /"Title","Author","Highlight"/u);

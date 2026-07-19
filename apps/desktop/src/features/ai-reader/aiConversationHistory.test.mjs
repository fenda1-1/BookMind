import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-ai-conversation-history-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/ai-reader/aiConversationHistory.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const compiledModulePath = join(outDir, 'features', 'ai-reader', 'aiConversationHistory.js');
const fallbackCompiledModulePath = join(outDir, 'aiConversationHistory.js');
const {
  appendAssistantMessage,
  appendUserMessage,
  applyConversationContextCompression,
  createAiConversationHistory,
  deleteConversation,
  deleteConversationMessage,
  pinConversation,
  renameConversation,
  restoreConversationContextCompression,
  startNewConversation,
  upsertAssistantMessage,
  upsertAssistantMessageForConversation,
} = require(existsSync(compiledModulePath) ? compiledModulePath : fallbackCompiledModulePath);

let now = 0;
const clock = () => `2026-06-19T00:00:${String(now++).padStart(2, '0')}.000Z`;
const ids = ['c-1', 'm-1', 'c-2', 'm-3'];
const idFactory = () => ids.shift() ?? `id-${now}`;

let history = createAiConversationHistory({ now: clock, idFactory });
assert.equal(history.conversations.length, 1, 'history should start with one active conversation');
assert.equal(history.activeConversationId, 'c-1');

history = appendUserMessage(history, '总结本章人物关系', { now: clock, idFactory });
history = appendAssistantMessage(history, '正在检索证据...', { messageId: 'assistant-fixed', status: 'streaming', now: clock, idFactory });
history = upsertAssistantMessage(history, '已完成回答', { status: 'ready', citations: [{ id: 'c1' }], now: clock });

const active = history.conversations[0];
assert.equal(active.title, '总结本章人物关系', 'first user prompt should become the title');
assert.deepEqual(active.messages.map((message) => message.role), ['user', 'assistant']);
assert.equal(active.messages[0].content, '总结本章人物关系');
assert.equal(active.messages[1].content, '已完成回答');
assert.equal(active.messages[1].id, 'assistant-fixed');
assert.equal(active.messages[1].status, 'ready');
assert.deepEqual(active.messages[1].citations, [{ id: 'c1' }]);

history = startNewConversation(history, { now: clock, idFactory });
history = appendUserMessage(history, '继续分析伏笔', { now: clock, idFactory });
history = upsertAssistantMessageForConversation(history, 'c-1', '旧会话后台完成', { messageId: 'assistant-fixed', status: 'ready', now: clock });
assert.equal(history.conversations.length, 2, 'new conversation should append without deleting old messages');
assert.equal(history.conversations.find((conversation) => conversation.id === 'c-1').messages.length, 2);
assert.equal(history.conversations.find((conversation) => conversation.id === 'c-1').messages[1].content, '旧会话后台完成');

history = renameConversation(history, 'c-1', '人物关系复盘', { now: clock });
assert.equal(history.conversations.find((conversation) => conversation.id === 'c-1').title, '人物关系复盘');

history = pinConversation(history, 'c-1', true, { now: clock });
assert.equal(history.conversations[0].id, 'c-1', 'pinned conversations should sort before unpinned conversations');

history = deleteConversation(history, 'c-2', { now: clock, idFactory });
assert.equal(history.activeConversationId, 'c-1', 'deleting active conversation should switch to another conversation');
assert.equal(history.conversations.length, 1);

history = deleteConversation(history, 'c-1', { now: clock, idFactory });
assert.equal(history.conversations.length, 1, 'history should keep one empty conversation after deleting the last one');
assert.equal(history.conversations[0].messages.length, 0);

history = createAiConversationHistory({ now: clock, idFactory });
history = appendUserMessage(history, '需要删除的问题', { now: clock, idFactory });
history = appendAssistantMessage(history, '需要保留的回答', { messageId: 'assistant-delete-target', status: 'ready', now: clock, idFactory });
const userMessageId = history.conversations[0].messages.find((message) => message.role === 'user').id;
history = deleteConversationMessage(history, history.activeConversationId, userMessageId, { now: clock });
assert.deepEqual(history.conversations[0].messages.map((message) => message.id), ['assistant-delete-target'], 'deleting one message should keep the rest of the conversation');
assert.notEqual(history.conversations[0].title, '', 'deleting a message should keep a usable conversation title');

history = deleteConversationMessage(history, history.activeConversationId, 'assistant-delete-target', { now: clock, idFactory });
assert.equal(history.conversations.length, 1, 'deleting the last message should keep the conversation shell');
assert.equal(history.conversations[0].messages.length, 0);

history = createAiConversationHistory({ now: clock, idFactory });
history = appendUserMessage(history, '第一轮长上下文', { now: clock, idFactory });
history = appendAssistantMessage(history, '第一轮回答', { status: 'ready', now: clock, idFactory });
history = applyConversationContextCompression(history, history.activeConversationId, {
  id: 'compress-1',
  content: '压缩后一',
  sourceContent: '压缩前一',
  compressedAt: clock(),
  messageCount: 2,
  sourceTokenEstimate: 1000,
  targetTokenEstimate: 120,
  thresholdTokens: 800,
  model: 'model-a',
}, { now: clock, idFactory });
history = applyConversationContextCompression(history, history.activeConversationId, {
  id: 'compress-2',
  content: '压缩后二',
  sourceContent: '压缩前二',
  compressedAt: clock(),
  messageCount: 2,
  sourceTokenEstimate: 900,
  targetTokenEstimate: 100,
  thresholdTokens: 800,
  model: 'model-a',
}, { now: clock, idFactory });
assert.equal(history.conversations[0].contextCompression.content, '压缩后二', 'latest compression should be active');
assert.equal(history.conversations[0].contextCompressionHistory.length, 2, 'compression history should retain versions');
assert.equal(history.conversations[0].contextCompressionHistory[0].previousContent, '压缩后一', 'new snapshot should keep previous compressed content');
history = restoreConversationContextCompression(history, history.activeConversationId, 'compress-1', { now: clock });
assert.equal(history.conversations[0].contextCompression.content, '压缩后一', 'restoring a snapshot should make it active');
assert.equal(history.conversations[0].contextCompression.id, 'compress-1', 'restored active compression should keep snapshot id');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-agent-loop-model-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/app/agentLoopModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  buildAgentDecisionInstruction,
  buildAgentModelTranscript,
  estimateAgentRuntimeTokens,
  sanitizeAgentConversationContext,
  buildAgentTimelineBlock,
  interleaveAgentToolEvents,
  isRuntimeAgentTimeline,
  mergeAgentTimelineIntoAnswer,
  parseAgentToolDecision,
} = require(join(outDir, 'app/agentLoopModel.js'));
const { parseAiResponseProtocol } = require(join(outDir, 'services/aiResponseProtocol.js'));

const events = interleaveAgentToolEvents(
  [
    { id: 'call_context', tool: 'get_current_context', status: 'succeeded', reason: '读取当前阅读上下文' },
    { id: 'call_search', tool: 'search_local_index', status: 'succeeded', reason: '检索关键词' },
  ],
  [
    { id: 'result_context', toolCallId: 'call_context', tool: 'get_current_context', status: 'succeeded', summary: '当前第 3 章', collapsed: true },
    { id: 'result_search', toolCallId: 'call_search', tool: 'search_local_index', status: 'succeeded', summary: '命中 4 条', collapsed: true },
  ],
);

assert.deepEqual(
  events.map((event) => `${event.kind}:${event.tool}`),
  [
    'tool_call:get_current_context',
    'tool_result:get_current_context',
    'tool_call:search_local_index',
    'tool_result:search_local_index',
  ],
  'Agent tool events must be interleaved as an execution timeline instead of grouped request cards then result cards',
);

const timelineBlock = buildAgentTimelineBlock(events);
assert.equal(timelineBlock.type, 'agent_timeline', 'Agent trace should use a dedicated timeline block');
assert.equal(timelineBlock.events.length, 4, 'Agent timeline block should retain all events');
assert.equal(
  isRuntimeAgentTimeline(events),
  false,
  'Tool-first static traces must not be treated as a runtime Agent loop',
);
assert.equal(
  isRuntimeAgentTimeline([{ id: 'decision_1', kind: 'model_decision', title: '模型判断下一步', status: 'running' }, ...events]),
  true,
  'Runtime Agent loops must start with a model decision before any tool call',
);

assert.deepEqual(
  parseAgentToolDecision('```json\n{"next":{"tool":"search_local_index","args":{"query":"林七夜"},"reason":"需要找证据"}}\n```'),
  { kind: 'tool', tool: 'search_local_index', args: { query: '林七夜' }, reason: '需要找证据' },
  'Agent loop should parse model tool requests from fenced JSON',
);

assert.deepEqual(
  parseAgentToolDecision('{"next":{"tool":"finish","answer":"最终回答","reason":"证据足够"}}'),
  { kind: 'final', answer: '最终回答', reason: '证据足够' },
  'Agent loop should parse model finish decisions',
);

const objectAnswerDecision = parseAgentToolDecision('{"next":{"tool":"finish","answer":{"version":"bookmind.ai.response.v2","scope":"chapter","flashcards":[{"question":"问题","answer":"答案"}]},"reason":"证据足够"}}');
assert.equal(objectAnswerDecision?.kind, 'final', 'Agent loop should accept object-valued final answers');
assert.match(objectAnswerDecision?.answer ?? '', /"flashcards"/u, 'Agent loop should preserve object final answers as JSON instead of [object Object]');
assert.doesNotMatch(objectAnswerDecision?.answer ?? '', /\[object Object\]/u, 'Agent loop must never stringify object final answers as [object Object]');

const wrappedRawDecision = parseAgentToolDecision(JSON.stringify({ raw: JSON.stringify({ next: { tool: 'finish', answer: '{"version":"bookmind.ai.response.v2","scope":"chapter","blocks":[{"type":"text","content":"结构化正文"}]}' }, reason: '证据足够' }) }));
assert.equal(wrappedRawDecision?.kind, 'final', 'Agent loop should unwrap provider responses that place the decision JSON inside a raw field');
assert.match(wrappedRawDecision?.answer ?? '', /结构化正文/u, 'Unwrapped provider decisions must preserve the structured final answer');

const decisionInstruction = buildAgentDecisionInstruction({
  userTask: '分析当前章节',
  transcript: events,
  availableTools: ['get_current_context', 'list_chapters', 'read_chapter', 'search_chapter_text', 'search_local_index', 'get_paragraph_window', 'read_paragraph_range', 'get_reader_settings', 'search_settings', 'update_reader_settings', 'get_character_index', 'track_character_growth', 'search_character_mentions', 'summarize_character_arc', 'get_renderable_formats', 'finish'],
  maxSteps: 3,
});
assert.match(decisionInstruction, /只输出一个 JSON 对象/, 'Agent decision prompt must force machine-readable tool decisions');
assert.match(decisionInstruction, /已有执行流/, 'Agent decision prompt must feed previous tool results back to the model');
assert.match(decisionInstruction, /工具结果不是用户发送的上下文/, 'Agent decision prompt should prevent the model from calling tool results user-sent context');
assert.match(decisionInstruction, /list_chapters：读取当前书章节总数/u, 'Agent decision prompt should describe the chapter listing tool');
assert.match(decisionInstruction, /read_chapter：按 chapterIndex/u, 'Agent decision prompt should describe exact chapter reading arguments');
assert.match(decisionInstruction, /search_chapter_text：搜索关键词在整本书哪些章节出现/u, 'Agent decision prompt should describe whole-book chapter clue search');
assert.match(decisionInstruction, /用户要求“全书”“所有章节”“全部提及”时，必须优先使用此工具/u, 'Agent decision prompt should route whole-book requests to chapter clue search');
assert.match(decisionInstruction, /search_local_index：按 query 检索当前书本地索引；章节范围会限定到当前章节/u, 'Agent decision prompt should describe local-index scope behavior');
assert.match(decisionInstruction, /get_paragraph_window：基于 citationIds 或 chapterIndex\/paragraphIndex/u, 'Agent decision prompt should describe direct paragraph window arguments');
assert.match(decisionInstruction, /read_paragraph_range：按 chapterIndex/u, 'Agent decision prompt should describe paragraph range reading');
assert.match(decisionInstruction, /update_reader_settings：应用阅读设置补丁/u, 'Agent decision prompt should describe executable setting mutation tools');
assert.match(decisionInstruction, /track_character_growth：按 characterName/u, 'Agent decision prompt should describe executable character growth tools');
assert.match(decisionInstruction, /search_character_mentions：按 characterName/u, 'Agent decision prompt should describe character mention search tools');
assert.match(decisionInstruction, /summarize_character_arc：基于人物提及和事件/u, 'Agent decision prompt should describe character arc summary tools');
assert.match(decisionInstruction, /get_renderable_formats：列出 BookMind 当前可渲染/u, 'Agent decision prompt should describe the renderable format toolbox');
assert.match(decisionInstruction, /bookmind\.ai\.response\.v2/u, 'Agent decision prompt should mention the structured final answer schema');

const noisyEvents = [
  {
    id: 'decision-noisy',
    kind: 'model_decision',
    title: '模型判断下一步',
    status: 'fallback',
    content: '模型没有返回有效工具调用 JSON，已转入最终综合。',
    payload: {
      raw: '{"next":{"tool":"finish","answer":"very long raw answer that should not re-enter model context"}}',
      responseId: 'airesp_agent_dynamic',
      diagnostics: { agentTokensUsed: 9999 },
    },
  },
  {
    id: 'formats',
    kind: 'tool_result',
    title: '工具结果 · get_renderable_formats',
    status: 'succeeded',
    tool: 'get_renderable_formats',
    content: '已读取格式工具箱：17 种可渲染格式。',
    payload: {
      schema: 'bookmind.ai.response.v2',
      formats: [
        { type: 'summary', exampleBlock: { type: 'summary', content: 'x'.repeat(800) } },
        { type: 'flashcards', exampleBlock: { type: 'flashcards', cards: [{ front: 'Q', back: 'A' }] } },
      ],
      diagnostics: { responseId: 'dynamic' },
    },
  },
  {
    id: 'search-result',
    kind: 'tool_result',
    title: '工具结果 · search_local_index',
    status: 'succeeded',
    tool: 'search_local_index',
    content: '命中 2 条证据。',
    payload: {
      query: '林七夜',
      responseId: 'dynamic-response',
      diagnostics: { agentTokensUsed: 1234 },
      citations: [{ id: 'c1', label: '第 1 章 · P2', quote: '证据原文'.repeat(80), paragraphIndex: 2 }],
    },
  },
];
const modelTranscript = buildAgentModelTranscript(noisyEvents);
assert.match(modelTranscript, /命中 2 条证据/u, 'Model transcript should keep useful tool summaries');
assert.match(modelTranscript, /formatCount/u, 'Renderable format toolbox should be summarized for model context');
assert.match(modelTranscript, /summary/u, 'Renderable format toolbox summary should keep format types');
assert.doesNotMatch(modelTranscript, /very long raw answer/u, 'Model transcript must omit payload.raw');
assert.doesNotMatch(modelTranscript, /responseId/u, 'Model transcript must omit dynamic response ids');
assert.doesNotMatch(modelTranscript, /agentTokensUsed/u, 'Model transcript must omit token diagnostics');
assert.doesNotMatch(modelTranscript, /exampleBlock/u, 'Model transcript must not repeat full renderable format examples');

const sanitizedConversationContext = sanitizeAgentConversationContext([
  '【Agent 预设提示词】',
  '最终回答必须使用 bookmind.ai.response.v2 和 blocks。',
  '1. 用户：继续分析',
  '2. AI：{"schema":"bookmind.ai.response.v2","responseId":"airesp_agent_123","blocks":[{"type":"paragraph","content":"正文"}],"diagnostics":{"agentTokensUsed":9999}}',
  '3. AI："payload":{"raw":"huge raw"}',
  '4. 用户：保留这个目标',
].join('\n'));
assert.match(sanitizedConversationContext, /继续分析/u, 'Conversation sanitizer should keep useful user context');
assert.match(sanitizedConversationContext, /保留这个目标/u, 'Conversation sanitizer should keep later user constraints');
assert.match(sanitizedConversationContext, /Agent 预设提示词/u, 'Conversation sanitizer should keep the Agent preset at the top');
assert.match(sanitizedConversationContext, /最终回答必须使用 bookmind\.ai\.response\.v2/u, 'Conversation sanitizer should preserve preset format instructions');
assert.doesNotMatch(sanitizedConversationContext, /agentTokensUsed/u, 'Conversation sanitizer should remove diagnostics');
assert.doesNotMatch(sanitizedConversationContext, /payload/u, 'Conversation sanitizer should remove raw payload lines');
assert.doesNotMatch(sanitizedConversationContext, /responseId/u, 'Conversation sanitizer should remove dynamic response ids');

const noisyInstruction = buildAgentDecisionInstruction({
  userTask: '继续',
  conversationContext: sanitizedConversationContext,
  transcript: noisyEvents,
  availableTools: ['get_renderable_formats', 'search_local_index', 'finish'],
  maxSteps: 2,
});
assert.doesNotMatch(noisyInstruction, /very long raw answer/u, 'Decision prompt should use sanitized model transcript');
assert.doesNotMatch(noisyInstruction, /agentTokensUsed/u, 'Decision prompt should not include runtime diagnostics');

const runtimeTokens = estimateAgentRuntimeTokens({
  baseRequest: { scope: 'chapter', instruction: '追踪林七夜成长', userText: '', scopeText: '当前章节正文'.repeat(300), mode: 'cloud', interactionMode: 'agent' },
  transcript: [
    { id: 'decision', kind: 'model_decision', title: '模型判断下一步', content: '请求全文检索', payload: { kind: 'tool', tool: 'search_local_index', args: { query: '林七夜 成长' } } },
    { id: 'tool-result', kind: 'tool_result', title: '工具结果', tool: 'search_local_index', content: '命中 20 条', payload: { citations: Array.from({ length: 20 }, (_, index) => ({ text: `引用片段 ${index} ${'长文本'.repeat(80)}` })) } },
  ],
  decisionInstruction,
  finalInstruction: `${decisionInstruction}\n最终综合 ${'工具结果'.repeat(100)}`,
  latestModelAnswer: '最终回答'.repeat(100),
});
assert.ok(runtimeTokens > 2500, 'Agent runtime token estimate should include tool result payloads and model/final instructions, not only the initial prompt');

const merged = mergeAgentTimelineIntoAnswer('最终回答', {
  request: { scope: 'chapter', instruction: '分析', userText: '', mode: 'cloud', interactionMode: 'agent' },
  events,
  diagnostics: { agentToolSteps: 2 },
});
const parsed = parseAiResponseProtocol(merged);
assert.equal(parsed.toolCalls.length, 0, 'Agent timeline responses should not render duplicated tool rail cards');
assert.equal(parsed.toolResults.length, 0, 'Agent timeline responses should not render duplicated tool result cards');
assert.equal(parsed.blocks[0].type, 'agent_timeline', 'Agent timeline should be the first rendered block');
assert.equal(parsed.blocks[1].type, 'paragraph', 'Agent final answer should render after the execution timeline');

const structuredFinal = JSON.stringify({
  version: 'bookmind.ai.response.v2',
  scope: 'chapter',
  scope_label: '第九十三章 谁才是恶魔？',
  flashcards: [
    {
      question: '张若尘怎样处理血丹？',
      answer: '他用玉器封存血丹，留作后续修炼资源。',
      tags: ['张若尘', '血丹'],
      citation: '第九十三章 谁才是恶魔？',
    },
  ],
});
const mergedStructuredFinal = mergeAgentTimelineIntoAnswer(structuredFinal, {
  request: { scope: 'selection', instruction: '生成闪卡', userText: '', mode: 'cloud', interactionMode: 'agent' },
  events: [
    { id: 'decision_1', kind: 'model_decision', title: '模型判断下一步', content: '准备完成', status: 'succeeded' },
    { id: 'agent_final', kind: 'final', title: '最终回答', content: structuredFinal, status: 'succeeded' },
  ],
  diagnostics: { agentToolSteps: 2 },
});
const parsedStructuredFinal = parseAiResponseProtocol(mergedStructuredFinal);
assert.equal(parsedStructuredFinal.blocks[0].type, 'agent_timeline', 'Structured Agent final answers should still keep the execution timeline first');
assert.equal(parsedStructuredFinal.blocks[1].type, 'flashcards', 'Structured Agent final answers should render their protocol blocks instead of raw JSON paragraphs');
assert.notEqual(parsedStructuredFinal.blocks[1].type, 'paragraph', 'Structured Agent final JSON must not be wrapped as a paragraph block');
assert.doesNotMatch(JSON.stringify(parsedStructuredFinal.blocks[0]), /"flashcards"/u, 'Agent timeline final event should summarize structured JSON instead of embedding the full JSON payload');

console.log('Verified Agent loop model timeline and decision protocol.');

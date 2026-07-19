import { BOOKMIND_AI_RESPONSE_SCHEMA_V2, parseAiResponseProtocol, renderBlockPlainText } from '../services/aiResponseProtocol';
import type { AiProtocolCitation, AiResponseBlock, AiToolCall, AiToolResult } from '../services/aiResponseProtocol';
import type { AiAskRequest, AiDiagnostics } from '../types';

export type AgentLoopEvent = {
  id: string;
  kind: 'plan' | 'tool_call' | 'tool_result' | 'model_decision' | 'final';
  title: string;
  status?: string;
  tool?: string;
  content?: string;
  payload?: unknown;
};

export type AgentToolDecision =
  | { kind: 'tool'; tool: string; args: Record<string, unknown>; reason: string }
  | { kind: 'final'; answer: string; reason: string };

const agentModelPayloadOmitKeys = new Set([
  'raw',
  'diagnostics',
  'responseId',
  'agentTokensUsed',
  'agentTokenBudget',
  'agentToolSteps',
  'agentToolIterationCount',
  'agentTaskGoal',
  'agentTaskCompleted',
  'agentNextPlan',
  'toolCalls',
  'toolResults',
  'actions',
  'blocks',
  'answer',
  'final',
]);

const agentConversationContextOmitPattern = /"?(?:diagnostics|responseId|agentTokensUsed|agentTokenBudget|agentToolSteps|agentToolIterationCount|toolCalls|toolResults|payload|raw)"?\s*[:=]/iu;

export function interleaveAgentToolEvents(toolCalls: AiToolCall[], toolResults: AiToolResult[]): AgentLoopEvent[] {
  const resultByCallId = new Map(toolResults.map((result) => [result.toolCallId, result]));
  const knownCallIds = new Set(toolCalls.map((call) => call.id));
  const events = toolCalls.flatMap((call, index): AgentLoopEvent[] => {
    const result = resultByCallId.get(call.id);
    return [
      {
        id: `${call.id}_event`,
        kind: 'tool_call',
        title: `工具请求 · ${call.tool}`,
        status: call.status,
        tool: call.tool,
        content: call.reason ?? `第 ${index + 1} 步调用 ${call.tool}`,
        payload: call.args,
      },
      ...(result ? [toolResultToAgentEvent(result)] : []),
    ];
  });
  const orphanResults = toolResults.filter((result) => !result.toolCallId || !knownCallIds.has(result.toolCallId));
  return [...events, ...orphanResults.map(toolResultToAgentEvent)];
}

export function buildAgentTimelineBlock(events: AgentLoopEvent[], citationIds: string[] = []): AiResponseBlock {
  return {
    id: 'blk_agent_timeline',
    type: 'agent_timeline',
    title: 'Agent 执行流',
    events,
    citationIds,
  };
}

export function isRuntimeAgentTimeline(events: unknown[]) {
  if (!events.length) return false;
  const first = asRecord(events[0]);
  return first?.kind === 'model_decision';
}

export function mergeAgentTimelineIntoAnswer(answer: string, input: {
  request: AiAskRequest;
  events: AgentLoopEvent[];
  citations?: AiProtocolCitation[];
  diagnostics?: AiDiagnostics | Record<string, unknown> | null;
}) {
  const finalAnswer = answer.trim();
  const parsedFinalAnswer = parseStructuredFinalAnswer(finalAnswer);
  const agentCitations = input.citations ?? [];
  const citations = mergeProtocolCitations(agentCitations, parsedFinalAnswer?.citations ?? []);
  const finalBlocks = parsedFinalAnswer
    ? parsedFinalAnswer.blocks.map((block, index) => ({
      ...block,
      id: block.id === 'blk_agent_timeline' ? `blk_agent_final_${index + 1}` : block.id,
    }))
    : [{
      id: 'blk_agent_final_answer',
      type: 'paragraph',
      title: '最终回答',
      content: finalAnswer,
      citationIds: agentCitations.map((citation) => citation.id),
    }];
  const timelineEvents = input.events.map((event) => event.kind === 'final' ? {
    ...event,
    content: parsedFinalAnswer ? summarizeStructuredFinalAnswer(parsedFinalAnswer) : event.content,
  } : event);
  return JSON.stringify({
    schema: BOOKMIND_AI_RESPONSE_SCHEMA_V2,
    responseId: `airesp_agent_${Date.now()}`,
    mode: input.request.mode ?? 'cloud',
    title: 'Agent 回答',
    summary: parsedFinalAnswer?.summary ?? summarizePlainText(finalAnswer, 240),
    blocks: [
      buildAgentTimelineBlock(timelineEvents, citations.map((citation) => citation.id)),
      ...finalBlocks,
    ],
    citations,
    toolCalls: [],
    toolResults: [],
    actions: [],
    diagnostics: input.diagnostics ?? {},
  }, null, 2);
}

function parseStructuredFinalAnswer(answer: string) {
  if (!looksLikeStructuredFinalAnswer(answer)) return null;
  const parsed = parseAiResponseProtocol(answer);
  if (parsed.parseError) return null;
  const hasRenderableBlocks = parsed.blocks.some((block) => block.type !== 'diagnostics');
  if (!parsed.summary && !parsed.citations.length && !hasRenderableBlocks) return null;
  return parsed;
}

function looksLikeStructuredFinalAnswer(answer: string) {
  return answer.includes(BOOKMIND_AI_RESPONSE_SCHEMA_V2)
    || answer.includes('"version"')
    || answer.includes('"flashcards"')
    || answer.includes('"characters"')
    || answer.includes('"summary"')
    || answer.includes('"blocks"');
}

function summarizeStructuredFinalAnswer(response: ReturnType<typeof parseAiResponseProtocol>) {
  if (response.summary?.trim()) return summarizePlainText(response.summary, 220);
  const blockSummary = response.blocks
    .map((block) => renderBlockPlainText(block))
    .find((text) => text.trim());
  if (blockSummary) return summarizePlainText(blockSummary, 220);
  return response.title ? `已生成结构化回答：${response.title}` : '已生成结构化回答。';
}

function summarizePlainText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function mergeProtocolCitations(primary: AiProtocolCitation[], secondary: AiProtocolCitation[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((citation) => {
    const id = String(citation.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function parseAgentToolDecision(raw: string): AgentToolDecision | null {
  const parsed = parseFirstJsonObject(raw);
  if (!parsed) return null;
  for (const candidate of collectAgentDecisionRecords(parsed)) {
    const next = asRecord(candidate.next) ?? candidate;
    const tool = String(next.tool ?? next.name ?? '').trim();
    const reason = String(next.reason ?? candidate.reason ?? candidate.thought ?? '').trim();
    if (tool === 'finish' || tool === 'final_answer') {
      return {
        kind: 'final',
        answer: formatAgentAnswerPayload(next.answer ?? candidate.answer ?? candidate.final ?? '').trim(),
        reason,
      };
    }
    if (tool) {
      return {
        kind: 'tool',
        tool,
        args: asRecord(next.args) ?? {},
        reason,
      };
    }
  }
  return null;
}

function collectAgentDecisionRecords(value: Record<string, unknown>, depth = 0): Record<string, unknown>[] {
  if (depth > 3) return [];
  const records = [value];
  for (const key of ['raw', 'content', 'data', 'answer']) {
    const nested = value[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      records.push(...collectAgentDecisionRecords(nested as Record<string, unknown>, depth + 1));
      continue;
    }
    if (typeof nested === 'string') {
      const parsed = parseFirstJsonObject(nested);
      if (parsed) records.push(...collectAgentDecisionRecords(parsed, depth + 1));
    }
  }
  return records;
}

export function buildAgentModelTranscript(events: AgentLoopEvent[]) {
  return events.map((event, index) => {
    const payloadSummary = summarizeAgentModelPayload(event);
    return [
      `${index + 1}. ${event.kind} · ${event.title} · ${event.status ?? 'ready'}`,
      event.tool ? `工具：${event.tool}` : '',
      event.content ? `摘要：${summarizeAgentModelText(event.content, 700)}` : '',
      payloadSummary ? `模型可用数据：${payloadSummary}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

export function sanitizeAgentConversationContext(value?: string) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  let inAgentPreset = false;
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).flatMap((line) => {
    if (!line) return [];
    if (line === '【Agent 预设提示词】') {
      inAgentPreset = true;
      return [line];
    }
    if (inAgentPreset && (/^【/u.test(line) || /^\d+\.\s*(?:用户|AI)[:：]/u.test(line))) inAgentPreset = false;
    if (inAgentPreset) return [line];
    if (agentConversationContextOmitPattern.test(line)) return [];
    return [scrubStructuredJsonLine(line)];
  });
  const compact = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (compact.length <= 8000) return compact;
  const presetIndex = compact.indexOf('【Agent 预设提示词】');
  if (presetIndex >= 0) {
    const afterPreset = compact.slice(presetIndex);
    const nextSectionIndex = afterPreset.search(/\n\s*【/u);
    const preset = nextSectionIndex >= 0 ? afterPreset.slice(0, nextSectionIndex) : afterPreset;
    const body = nextSectionIndex >= 0 ? afterPreset.slice(nextSectionIndex) : '';
    const bodyBudget = Math.max(0, 8000 - preset.length - 40);
    return `${preset}\n\n...已截断更早的对话上下文...\n${body.slice(-bodyBudget)}`;
  }
  return `...已截断更早的对话上下文...\n${compact.slice(-8000)}`;
}

export function buildAgentDecisionInstruction(input: { userTask: string; conversationContext?: string; transcript: AgentLoopEvent[]; availableTools: string[]; maxSteps: number }) {
  const transcriptText = buildAgentModelTranscript(input.transcript);
  const conversationContext = sanitizeAgentConversationContext(input.conversationContext);
  const toolGuide = [
    '工具说明：',
    '- get_current_context：读取当前书籍、章节、选区、当前范围元数据/正文。',
    '- list_chapters：读取当前书章节总数、首章、末章和章节统计；参数 {"query":"可选标题过滤","limit":80}。',
    '- read_chapter：按 chapterIndex/sourceChapterIndex/title/query 或 position:"first"|"last" 读取指定章节正文；参数 {"position":"last","includeText":true,"maxChars":12000}。',
    '- search_chapter_text：搜索关键词在整本书哪些章节出现，适合追踪物品、线索、地点、人物名；参数 {"query":"关键词","limit":50,"perChapterLimit":5}。用户要求“全书”“所有章节”“全部提及”时，必须优先使用此工具。',
    '- search_local_index：按 query 检索当前书本地索引；章节范围会限定到当前章节，整书范围会检索整本书，适合核对引用证据。用户要求“全书”“所有章节”“全部提及”时，优先使用 search_chapter_text 获取完整章节分布。',
    '- get_paragraph_window：基于 citationIds 或 chapterIndex/paragraphIndex 展开前后段落；参数 {"citationIds":["1"],"chapterIndex":4,"paragraphIndex":12,"before":1,"after":1}。',
    '- read_paragraph_range：按 chapterIndex/sourceChapterIndex 与 paragraphStart/paragraphEnd 读取原文段落范围；参数 {"chapterIndex":4,"paragraphStart":10,"paragraphEnd":14}。',
    '- get_reader_settings：读取当前全局阅读设置、设置中心扩展设置和章节规则摘要。',
    '- search_settings：用 query 搜索所有可修改设置项，例如字体、背景、字号、每日阅读目标、搜索结果数量、自定义清洗规则；返回 branch、key、description、kind、valueSchema、allowedValues、updateExample。修改前优先调用它确认准确键名和值域。',
    '- update_reader_settings：应用阅读设置补丁和设置中心补丁，覆盖阅读器、设置中心扩展设置和章节规则；必须按 search_settings 返回的 key/valueSchema 传参，例如 {"fontFamily":"霞鹜文楷"}、{"background":"#f4ead2","fontSize":22}、{"readerDailyGoalEnabled":true,"readerDailyPagesGoal":30}、{"customCleanupRules":[{"name":"删除广告行","mode":"remove-line","pattern":"书友群\\\\s*\\\\d+","enabled":true}]}。',
    '- get_character_index：读取当前书人物索引摘要。',
    '- track_character_growth：按 characterName/name/query 整理指定人物在当前书中的提及与事件时间线。',
    '- search_character_mentions：按 characterName/name/characterId、chapterStart/chapterEnd 和 query 搜索人物原文提及。',
    '- summarize_character_arc：基于人物提及和事件按章节阶段总结人物弧线；参数 {"characterName":"人物名","maxMentions":160,"maxStages":12}。',
    '- get_renderable_formats：列出 BookMind 当前可渲染的结构化回复格式、字段和示例；当需要自由搭配卡片、表格、时间线、闪卡等输出时先调用。',
    '- finish：任务完成并输出最终回答。',
  ].filter((line) => line === '工具说明：' || input.availableTools.some((tool) => line.includes(tool)));
  return [
    '你是 BookMind Agent 调度器。你必须根据任务和已有工具结果决定下一步。',
    `可用工具：${input.availableTools.join('、')}`,
    toolGuide.join('\n'),
    `最多剩余步骤：${input.maxSteps}`,
    '如果还需要信息或需要执行操作，只输出一个 JSON 对象：{"next":{"tool":"search_local_index","args":{"query":"..."},"reason":"..."}}。',
    '如果证据足够，只输出一个 JSON 对象：{"next":{"tool":"finish","answer":"最终回答","reason":"..."}}。',
    '最终回答需要结构化渲染时，可以把 finish.answer 写成 {"version":"bookmind.ai.response.v2","scope":"chapter","scope_label":"...","blocks":[...],"citations":[...]}；不确定格式时先调用 get_renderable_formats。',
    '不要输出 Markdown，不要输出解释性前缀。',
    '工具结果不是用户发送的上下文；回答中不要说“用户发送了上下文”“用户提供了段落”“你发送了内容”，只能说“工具读取/检索到”。',
    `用户任务：${input.userTask}`,
    conversationContext ? `当前对话历史上下文：\n${conversationContext}` : '',
    transcriptText ? `已有执行流：\n${transcriptText}` : '',
  ].filter(Boolean).join('\n\n');
}

export function estimateAgentRuntimeTokens(input: {
  baseRequest?: Partial<AiAskRequest> | null;
  transcript?: AgentLoopEvent[];
  decisionInstruction?: string;
  finalInstruction?: string;
  latestModelAnswer?: string;
}) {
  const parts = [
    input.baseRequest?.instruction,
    input.baseRequest?.userText,
    input.baseRequest?.scopeText,
    input.baseRequest?.scopeLabel,
    input.baseRequest?.conversationContext,
    input.baseRequest?.retrievalQuery,
    input.decisionInstruction,
    input.finalInstruction,
    input.latestModelAnswer,
    ...(input.transcript ?? []).flatMap((event) => [
      event.title,
      event.content,
      summarizeAgentModelPayload(event),
    ]),
  ];
  const text = parts.filter((part): part is string => Boolean(part?.trim())).join('\n\n');
  return Math.ceil(text.length / 2.6) + 500;
}

function summarizeAgentModelPayload(event: AgentLoopEvent) {
  if (event.payload === undefined) return '';
  const payload = event.payload;
  if (event.tool === 'get_renderable_formats') {
    const record = asRecord(payload);
    const formats = Array.isArray(record?.formats) ? record.formats : [];
    const types = formats
      .map((item) => String(asRecord(item)?.type ?? ''))
      .filter(Boolean)
      .slice(0, 24);
    return safeStringify({
      schema: record?.schema,
      formatCount: formats.length,
      types,
      note: '格式工具箱完整结果仅用于 UI；模型上下文只保留 schema 和类型摘要。',
    });
  }
  if (event.kind === 'model_decision') {
    const record = asRecord(payload);
    if (record?.raw !== undefined) return '模型决策原始输出无效，原文已从模型上下文省略。';
  }
  if (event.kind === 'final') {
    return '';
  }
  const sanitized = sanitizeAgentModelPayload(payload);
  const text = typeof sanitized === 'string' ? sanitized : safeStringify(sanitized);
  return summarizeAgentModelText(text, 900);
}

function sanitizeAgentModelPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return summarizeAgentModelText(value, depth === 0 ? 900 : 420);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 6).map((item) => sanitizeAgentModelPayload(item, depth + 1));
  const record = asRecord(value);
  if (!record) return String(value);
  if (depth >= 3) return '[object omitted]';
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (agentModelPayloadOmitKeys.has(key)) continue;
    if (key === 'citations' && Array.isArray(item)) {
      output[key] = item.slice(0, 8).map((citation) => {
        const citationRecord = asRecord(citation);
        return {
          id: citationRecord?.id,
          label: citationRecord?.label,
          quote: summarizeAgentModelText(String(citationRecord?.quote ?? citationRecord?.text ?? citationRecord?.snippet ?? ''), 180),
          sourceChapterIndex: citationRecord?.sourceChapterIndex,
          paragraphIndex: citationRecord?.paragraphIndex,
        };
      });
      continue;
    }
    output[key] = sanitizeAgentModelPayload(item, depth + 1);
  }
  return output;
}

function summarizeAgentModelText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function scrubStructuredJsonLine(line: string) {
  if (!line.includes(BOOKMIND_AI_RESPONSE_SCHEMA_V2) && !line.includes('"blocks"') && !line.includes('"agent_timeline"')) return line;
  return line
    .replace(/\{[^\n]*"responseId"[^\n]*"diagnostics"[^\n]*\}/giu, '[BookMind 结构化回答已省略完整 JSON，仅保留可见对话摘要]')
    .replace(/"diagnostics"\s*:\s*\{[^\n]*\}/giu, '"diagnostics":"[omitted]"')
    .replace(/"agent_timeline"/giu, '"agent_timeline_omitted"')
    .slice(0, 1200);
}

function toolResultToAgentEvent(result: AiToolResult): AgentLoopEvent {
  return {
    id: `${result.id}_event`,
    kind: 'tool_result',
    title: `工具结果 · ${result.tool}`,
    status: result.status,
    tool: result.tool,
    content: result.summary ?? '',
    payload: result.content,
  };
}

function parseFirstJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    ...[...trimmed.matchAll(/```\s*(?:json)?\s*([\s\S]*?)```/giu)].map((match) => match[1].trim()),
    ...extractBalancedObjects(trimmed),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return asRecord(parsed);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function extractBalancedObjects(raw: string) {
  const results: string[] = [];
  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          results.push(raw.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return results;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatAgentAnswerPayload(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return safeStringify(value);
}

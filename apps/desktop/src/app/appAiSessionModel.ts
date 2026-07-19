import { parseAiResponseProtocol } from '../services/aiResponseProtocol';
import type { CloudAiRequestHistoryEntry } from '../services/cloudAiHistoryService';
import type { getBookIndexView } from '../services/indexDiagnosticsService';
import { getPrivacyBookTitle, redactPrivacyText, sanitizePrivacyObject, type ExtendedSettings } from '../services/settingsCenterService';
import type { AiAskRequest, AiDiagnostics, AiNoteMetadata, AiResponse, Book, Citation } from '../types';
import { parseBoundedFloat } from './appShellModel';

export type FtsUnavailablePreflight =
  | { action: 'none' }
  | { action: 'show-warning' | 'text-fallback' | 'fail-fast'; diagnostics: AiDiagnostics; message: string };

export function hasAiAnswerResult(response: { answer?: string; citations: Citation[]; diagnostics?: AiDiagnostics | null }) {
  if (response.citations.length > 0) return true;
  if ((response.diagnostics?.resultCount ?? 0) > 0) return true;
  const answerText = response.answer?.trim() ?? '';
  if (!answerText) return false;
  const parsed = parseAiResponseProtocol(answerText);
  const hasRenderableBlocks = parsed.blocks.some((block) => block.type !== 'diagnostics');
  return Boolean(parsed.summary || parsed.citations.length || parsed.toolResults.length || parsed.toolCalls.length || hasRenderableBlocks);
}

export function resolveFtsUnavailablePreflight(
  indexView: ReturnType<typeof getBookIndexView>,
  behavior: ExtendedSettings['aiFtsUnavailableBehavior'],
): FtsUnavailablePreflight {
  if (!isFtsUnavailableIndexView(indexView)) return { action: 'none' };
  const diagnostics = {
    chunkCount: indexView.chunkCount,
    ftsAvailable: false,
    resultCount: 0,
    fallbackUsed: false,
    errorKind: 'fts-unavailable',
    indexStatus: indexView.status,
    staleReason: indexView.staleReason || undefined,
    recommendations: ['去任务中心修复 FTS', '重新构建该书索引'],
  } satisfies AiDiagnostics;
  if (behavior === 'text-fallback') return { action: 'text-fallback', diagnostics, message: 'FTS 不可用，已降级到 chunk 文本搜索。' };
  if (behavior === 'fail-fast') return { action: 'fail-fast', diagnostics: { ...diagnostics, errorKind: 'fts-unavailable-fail-fast' }, message: 'FTS 不可用，已按设置直接失败。' };
  return { action: 'show-warning', diagnostics, message: 'FTS 不可用，请前往任务中心修复 FTS 后再使用本地索引。' };
}

function isFtsUnavailableIndexView(indexView: ReturnType<typeof getBookIndexView>) {
  if (indexView.chunkCount <= 0 || indexView.ftsRows > 0) return false;
  if (indexView.status === 'ready') return true;
  return indexView.status === 'stale' && /FTS|fts|chunks 与 FTS 行数不一致|FTS 校验失败/.test(indexView.staleReason);
}

export function applyFtsUnavailableFallbackDiagnostics(response: AiResponse, preflight: FtsUnavailablePreflight) {
  if (preflight.action !== 'text-fallback') return;
  response.diagnostics = {
    ...response.diagnostics,
    chunkCount: response.diagnostics?.chunkCount ?? preflight.diagnostics.chunkCount,
    ftsAvailable: false,
    fallbackUsed: true,
    errorKind: 'fts-unavailable-text-fallback',
    indexStatus: preflight.diagnostics.indexStatus,
    recommendations: [...(response.diagnostics?.recommendations ?? []), 'FTS 不可用，已降级到 chunk 文本搜索', '去任务中心修复 FTS'],
  };
}

export function sanitizeAiResponseForPrivacy(response: AiResponse, privacySettings: ExtendedSettings): AiResponse {
  return {
    ...response,
    answer: redactPrivacyText(response.answer, privacySettings),
    citations: sanitizeCitationsForPrivacy(response.citations, privacySettings),
    diagnostics: response.diagnostics ? sanitizePrivacyObject(response.diagnostics, privacySettings) : response.diagnostics,
  };
}

export function sanitizeCitationsForPrivacy(items: Citation[], privacySettings: ExtendedSettings) {
  return items.map((citation) => sanitizeCitationForPrivacy(citation, privacySettings));
}

export function sanitizeCitationForPrivacy(citation: Citation, privacySettings: ExtendedSettings): Citation {
  return {
    ...citation,
    label: redactPrivacyText(citation.label, privacySettings),
    text: redactPrivacyText(citation.text, privacySettings),
    targetId: redactPrivacyText(citation.targetId, privacySettings),
    failureReason: citation.failureReason ? redactPrivacyText(citation.failureReason, privacySettings) : citation.failureReason,
  };
}

export function sanitizeStructuredAiResponseForPrivacy<T>(structuredResponse: T, privacySettings: ExtendedSettings): T {
  return sanitizePrivacyObject(structuredResponse, privacySettings);
}

export function sanitizeAiNoteMetadataForPrivacy(metadata: AiNoteMetadata | undefined, privacySettings: ExtendedSettings): AiNoteMetadata | undefined {
  return metadata ? sanitizePrivacyObject(metadata, privacySettings) : metadata;
}

export function filterAiResponseCitations(response: AiResponse, minConfidenceSetting: string): AiResponse {
  const minConfidence = parseBoundedFloat(minConfidenceSetting, 0.25, 0, 1);
  return { ...response, citations: response.citations.filter((citation) => shouldKeepAiCitation(citation, minConfidence)), diagnostics: { ...response.diagnostics, resultCount: response.diagnostics?.resultCount ?? response.citations.length } };
}

function shouldKeepAiCitation(citation: Citation, minConfidence: number) {
  if (typeof citation.confidence !== 'number') return true;
  return citation.confidence >= minConfidence;
}

export function shouldFallbackCloudAiToLocalForMissingKey(settings: { aiApiKey?: string | null } | null) {
  return !settings?.aiApiKey?.trim();
}

export function resolveCloudDisabledAiRequest(request: AiAskRequest, _cloudAiEnabled: boolean): AiAskRequest {
  return request;
}

export function isLocalAiDisabledRequest(request: AiAskRequest, localAiEnabled: boolean) {
  return !localAiEnabled && (request.mode === 'local' || !request.mode);
}

export function buildCloudAiRequestHistoryEntry(
  request: AiAskRequest,
  bookId: string,
  requestId: string,
  startedAt: number,
  metadata: {
    endpointMode: string;
    model: string;
    resultCount: number;
    status: CloudAiRequestHistoryEntry['status'];
    errorKind?: string;
    errorMessage?: string;
  },
): CloudAiRequestHistoryEntry {
  return {
    id: requestId,
    bookId,
    createdAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    endpointMode: metadata.endpointMode,
    model: metadata.model,
    scope: request.scope,
    scopeLabel: request.scopeLabel,
    selectedCommandId: request.selectedCommandId,
    retrievalStrategy: request.retrievalStrategy,
    resultCount: metadata.resultCount,
    status: metadata.status,
    errorKind: metadata.errorKind,
    errorMessage: metadata.errorMessage,
    redactedFields: ['body', 'scopeText', 'userText', 'apiKey'],
  };
}

export function createCurrentContextToolTrace(
  request: AiAskRequest,
  currentBook: Book | null,
  privacySettings: ExtendedSettings,
  status: 'succeeded' | 'no_book' = 'succeeded',
  options: { includeText?: boolean } = {},
) {
  const scopeText = request.scopeText ?? '';
  const content = currentBook
    ? {
        status,
        bookId: currentBook.id,
        title: getPrivacyBookTitle(currentBook.displayTitle, privacySettings),
        scope: request.scope,
        scopeLabel: request.scopeLabel,
        chars: scopeText.length,
        chunks: currentBook.chunks.length,
        ...(options.includeText ? { text: scopeText } : {}),
      }
    : {
        status: 'no_book',
        scope: request.scope,
        scopeLabel: request.scopeLabel,
        chars: scopeText.length,
        recommendations: ['打开 AI 演示', '导入 TXT'],
      };
  return {
    toolCall: { id: 'toolcall_current_context', tool: 'get_current_context', status, args: { includeText: Boolean(options.includeText), includeSelection: true, includePage: true, includeChapter: true }, reason: '读取当前阅读上下文' },
    toolResult: { id: 'toolresult_current_context', toolCallId: 'toolcall_current_context', tool: 'get_current_context', status, durationMs: 1, summary: status === 'no_book' ? '当前没有打开书籍' : '读取当前阅读上下文', contentType: 'application/json', content, diagnostics: { status, errorKind: status === 'no_book' ? 'no_book' : undefined } },
  };
}

export function createDiagnosticAiResponse(request: AiAskRequest, errorKind: string, message: string, diagnostics: AiDiagnostics) {
  return JSON.stringify({
    schema: 'bookmind.ai.response.v2',
    responseId: `airesp_diag_${Date.now()}`,
    mode: request.mode ?? 'local',
    title: 'AI 诊断',
    summary: message,
    blocks: [{ id: `blk_diag_${errorKind}`, type: 'diagnostics', title: message, content: message, citationIds: [] }],
    citations: [],
    toolCalls: [],
    toolResults: [],
    actions: [],
    diagnostics,
  }, null, 2);
}

export function createNoBookAiResponse(request: AiAskRequest, noBookAnswer: string, privacySettings: ExtendedSettings) {
  const currentContext = createCurrentContextToolTrace(request, null, privacySettings, 'no_book');
  return JSON.stringify({
    schema: 'bookmind.ai.response.v2',
    responseId: `airesp_no_book_${Date.now()}`,
    mode: request.mode ?? 'local',
    title: '未打开书籍',
    summary: noBookAnswer,
    blocks: [{ id: 'blk_no_book_1', type: 'diagnostics', title: '需要先选择书籍', content: noBookAnswer, citationIds: [] }],
    citations: [],
    toolCalls: [currentContext.toolCall],
    toolResults: [currentContext.toolResult],
    actions: [],
    diagnostics: { scope: request.scope, selectedCommandId: request.selectedCommandId, retrievalQuery: request.retrievalQuery, errorKind: 'no_book' },
  }, null, 2);
}

export function createAiDemoResponse(request: AiAskRequest, privacySettings: ExtendedSettings) {
  const currentContext = createCurrentContextToolTrace(request, { id: 'demo-ai-research-desk', title: 'AI 研究台演示', displayTitle: 'AI 研究台演示', author: '', format: 'demo', status: 'ready', progress: 0, fileName: '', filePath: '', coverLabel: 'AI', coverTone: 'indigo', deleted: false, deletedAt: '', contentHash: '', importedAt: '', shelfGroups: [], content: request.scopeText ?? '', chunks: [] }, privacySettings);
  return JSON.stringify({
    schema: 'bookmind.ai.response.v2',
    responseId: `airesp_demo_${Date.now()}`,
    mode: 'mock',
    title: 'AI 研究台演示回答',
    summary: '演示模式基于内置短文本生成，不写入用户书库。',
    blocks: [
      {
        id: 'blk_chapter_summary_demo',
        type: 'summary',
        title: '章节报告卡',
        chapterRef: { bookId: 'demo-ai-research-desk', chapterId: 'demo-ch-1', chapterTitle: request.scopeLabel ?? '第一章 演示', sourceChapterIndex: 0 },
        bullets: [
          { text: '林七夜在雨夜抵达病院，场景和核心人物同时建立。', importance: 'high', citationIds: ['c1'] },
          { text: '墙上钟声突然停止，形成可追踪的异常线索。', importance: 'high', citationIds: ['c2'] },
          { text: '医生记录异常反应，角色状态从迷茫转向警觉。', importance: 'medium', citationIds: ['c3'] },
        ],
        openQuestions: ['钟声停止是否对应时间、感知或空间异常仍待后文验证。'],
        citationIds: ['c1', 'c2', 'c3'],
      },
    ],
    citations: [
      { id: 'c1', type: 'paragraph', bookId: 'demo-ai-research-desk', chapterId: 'demo-ch-1', sourceChapterIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 11, label: '演示文本 · 第 1 段', quote: '林七夜在雨夜抵达病院', snippet: '林七夜在雨夜抵达病院', sourceText: '林七夜在雨夜抵达病院' },
      { id: 'c2', type: 'paragraph', bookId: 'demo-ai-research-desk', chapterId: 'demo-ch-1', sourceChapterIndex: 0, paragraphIndex: 0, startOffset: 18, endOffset: 27, label: '演示文本 · 第 1 段', quote: '墙上的钟声突然停止', snippet: '墙上的钟声突然停止', sourceText: '墙上的钟声突然停止' },
      { id: 'c3', type: 'paragraph', bookId: 'demo-ai-research-desk', chapterId: 'demo-ch-1', sourceChapterIndex: 0, paragraphIndex: 0, startOffset: 40, endOffset: 51, label: '演示文本 · 第 1 段', quote: '角色状态从迷茫转为警觉', snippet: '角色状态从迷茫转为警觉', sourceText: '角色状态从迷茫转为警觉' },
    ],
    toolCalls: [currentContext.toolCall],
    toolResults: [currentContext.toolResult],
    actions: [],
    diagnostics: { scope: request.scope, selectedCommandId: request.selectedCommandId, retrievalQuery: request.retrievalQuery },
  }, null, 2);
}

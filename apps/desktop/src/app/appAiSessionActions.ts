import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { answerFromLocalIndex, cancelLocalAiAnswer, requestCloudAiAnswer, requestCloudAiAnswerStream } from '../services/aiService';
import { saveCloudAiRequestHistory, type CloudAiRequestHistoryEntry } from '../services/cloudAiHistoryService';
import { loadAppSettings, saveAppSettings } from '../services/settingsService';
import { saveAiNote, saveHighlight } from '../services/noteService';
import { buildToolCapabilityResponse, isToolCapabilityQuestion } from '../services/bookmindToolProtocol';
import { parseAiResponseProtocol, type AiProtocolCitation } from '../services/aiResponseProtocol';
import { createBookIndexAiDiagnostics, type getBookIndexView } from '../services/indexDiagnosticsService';
import { dispatchSettingsUpdated, getPrivacyBookTitle, loadChapterRules, redactPrivacyText, saveChapterRules, saveExtendedSettings, type ChapterRuleDraft, type ExtendedSettings } from '../services/settingsCenterService';
import type { AiAskRequest, AiDiagnostics, AiNoteMetadata, AiResponse, AppSettings, Book, Citation, IndexDiagnostics, ReaderNoteLocation } from '../types';
import type { LocalePreference, Translator } from '../i18n';
import { loadCharacterCenterPayload } from '../services/characterCenterService';
import { getAgentReaderBookForTools } from '../services/agentReaderContextStore';
import { emitHighlightsUpdated, emitNotesUpdated } from '../services/appDomainEvents';
import { emitReaderApplySettingsNow, loadGlobalReaderSettings, normalizeReaderSettings, saveGlobalReaderSettings } from '../features/reader-core/readerSettings';
import {
  applyFtsUnavailableFallbackDiagnostics,
  buildCloudAiRequestHistoryEntry,
  createCurrentContextToolTrace,
  createAiDemoResponse,
  createDiagnosticAiResponse,
  createNoBookAiResponse,
  filterAiResponseCitations,
  hasAiAnswerResult,
  isLocalAiDisabledRequest,
  resolveCloudDisabledAiRequest,
  resolveFtsUnavailablePreflight,
  sanitizeAiNoteMetadataForPrivacy,
  sanitizeAiResponseForPrivacy,
  sanitizeCitationForPrivacy,
  sanitizeCitationsForPrivacy,
  sanitizeStructuredAiResponseForPrivacy,
  shouldFallbackCloudAiToLocalForMissingKey,
  type FtsUnavailablePreflight,
} from './appAiSessionModel';
import {
  buildHybridLocalFirstCloudRequest,
  estimateCloudAiRequestTokens,
  parseBoundedInteger,
  shouldUseHybridLocalFirstCloudSummary,
} from './appShellModel';
import {
  buildAgentDecisionInstruction,
  estimateAgentRuntimeTokens,
  mergeAgentTimelineIntoAnswer,
  parseAgentToolDecision,
  type AgentLoopEvent,
} from './agentLoopModel';
import {
  buildAgentChapterCatalog,
  buildAgentParagraphWindows,
  buildCharacterGrowthTimeline,
  getAgentRenderableFormats,
  normalizeAgentEnabledTools,
  parseReaderSettingsPatchFromAgentArgs,
  readAgentChapterText,
  readAgentParagraphRange,
  resolveAgentAvailableTools,
  searchAgentChapterText,
  searchCharacterMentions,
  searchReaderSettings,
  summarizeCharacterArc,
} from './agentToolModel';
import { getAiProviderModelConfig, normalizeAiProviderProfilesForUi, resolveAiProviderRequestSettings } from '../features/settings-center/settingsCenterAiProviderModel';

type AiStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';
type CloudAiHistoryContext = {
  request: AiAskRequest;
  bookId: string;
  requestId: string;
  startedAt: number;
  endpointMode: string;
  model: string;
  historyLimit: number;
};

type AppAiSessionActionsContext = {
  answer: string;
  appSettingsRef: MutableRefObject<AppSettings | null>;
  aiAbortControllerRef: MutableRefObject<AbortController | null>;
  aiRequestIdRef: MutableRefObject<string | null>;
  aiStoppedRef: MutableRefObject<boolean>;
  aiStreamTokenBufferRef: MutableRefObject<string>;
  aiStreamTokenFlushTimerRef: MutableRefObject<number | null>;
  book: Book | null;
  citations: Citation[];
  cloudAiHistoryContextRef: MutableRefObject<CloudAiHistoryContext | null>;
  extendedSettings: ExtendedSettings;
  indexDiagnostics: IndexDiagnostics | null;
  lastAiModel: string;
  lastAiRequest: AiAskRequest | null;
  readerNoteLocation: ReaderNoteLocation | null;
  selectedBookIndexView: ReturnType<typeof getBookIndexView>;
  setActivePage: (page: 'reader') => void;
  setAiDiagnostics: Dispatch<SetStateAction<AiDiagnostics | null>>;
  setAiNoteToast: Dispatch<SetStateAction<{ noteId: string; message: string } | null>>;
  setAiSaveStatus: Dispatch<SetStateAction<string>>;
  setAiStatus: Dispatch<SetStateAction<AiStatus>>;
  setAiStopped: Dispatch<SetStateAction<boolean>>;
  setAnswer: Dispatch<SetStateAction<string>>;
  setCitations: Dispatch<SetStateAction<Citation[]>>;
  setLastAiModel: Dispatch<SetStateAction<string>>;
  setLastAiRequest: Dispatch<SetStateAction<AiAskRequest | null>>;
  setLocalePreference: (locale: LocalePreference) => void;
  t: Translator;
};

export function createAppAiSessionActions(context: AppAiSessionActionsContext) {
  async function summarizeBook(requestOrPrompt?: AiAskRequest | string, scope = 'book') {
    context.setActivePage('reader');
    const book = context.book;
    const request: AiAskRequest = typeof requestOrPrompt === 'object' && requestOrPrompt
      ? requestOrPrompt
      : {
          scope,
          instruction: typeof requestOrPrompt === 'string' ? requestOrPrompt.trim() : (book ? context.t('app.promptKeyClues', { title: getPrivacyBookTitle(book.displayTitle, context.extendedSettings) }) : ''),
          userText: '',
          retrievalQuery: typeof requestOrPrompt === 'string' ? requestOrPrompt.trim() : undefined,
          bookId: book?.id,
          mode: 'local',
        };
    const effectiveAiRequest = resolveCloudDisabledAiRequest(request, context.extendedSettings.cloudAiEnabled);
    const prompt = [effectiveAiRequest.instruction, effectiveAiRequest.userText].filter(Boolean).join('\n\n').trim();
    const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    context.setLastAiRequest({ ...effectiveAiRequest, requestId });
    context.setLastAiModel(effectiveAiRequest.mode === 'mock' ? 'mock' : effectiveAiRequest.mode === 'cloud' ? 'cloud' : 'local-index');
    context.setAiStopped(false);
    context.aiStoppedRef.current = false;
    if (isToolCapabilityQuestion(prompt)) {
      context.setAnswer(buildToolCapabilityResponse({ mode: effectiveAiRequest.mode ?? 'local', bookId: effectiveAiRequest.bookId ?? book?.id }));
      context.setCitations([]);
      context.setAiDiagnostics({ scope: effectiveAiRequest.scope, queryUsed: effectiveAiRequest.retrievalQuery ?? prompt, chunkCount: book?.chunks.length ?? 0, ftsAvailable: Boolean(book?.chunks.length), resultCount: 1, fallbackUsed: false });
      context.setAiStatus('ready');
      context.setAiSaveStatus('');
      return;
    }
    if (effectiveAiRequest.mode === 'mock' || effectiveAiRequest.bookId === 'demo-ai-research-desk') {
      context.setAnswer(createAiDemoResponse(effectiveAiRequest, context.extendedSettings));
      context.setCitations([]);
      context.setAiDiagnostics({ scope: effectiveAiRequest.scope, queryUsed: effectiveAiRequest.retrievalQuery, chunkCount: 0, ftsAvailable: false, resultCount: 1, fallbackUsed: true, recommendations: ['演示模式使用内置短文本'] });
      context.setAiStatus('ready');
      context.setAiSaveStatus('');
      return;
    }
    if (!book) {
      context.setAnswer(createNoBookAiResponse(effectiveAiRequest, context.t('app.noBookAnswer'), context.extendedSettings));
      context.setCitations([]);
      context.setAiDiagnostics({ scope: effectiveAiRequest.scope, queryUsed: effectiveAiRequest.retrievalQuery, chunkCount: 0, ftsAvailable: false, scopeEmpty: true, errorKind: 'no_book', recommendations: ['打开 AI 演示', '导入 TXT'] });
      context.setAiStatus('error');
      return;
    }
    if (isLocalAiDisabledRequest(effectiveAiRequest, context.extendedSettings.localAiEnabled)) {
      const diagnostics = { scope: effectiveAiRequest.scope, queryUsed: effectiveAiRequest.retrievalQuery ?? prompt, chunkCount: book.chunks.length, ftsAvailable: Boolean(book.chunks.length), resultCount: 0, fallbackUsed: false, errorKind: 'local-ai-disabled', recommendations: ['在设置中心重新启用本地索引模式', '切换到云端模型或演示模式'] } satisfies AiDiagnostics;
      context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, 'local-ai-disabled', '本地索引模式已在设置中心关闭。', diagnostics));
      context.setCitations([]);
      context.setAiDiagnostics(diagnostics);
      context.setAiStatus('error');
      return;
    }
    const shouldUseLocalIndexPreflight = effectiveAiRequest.mode !== 'cloud' && !effectiveAiRequest.scopeText?.trim();
    const ftsUnavailablePreflight = resolveFtsUnavailablePreflight(context.selectedBookIndexView, context.extendedSettings.aiFtsUnavailableBehavior);
    if (shouldUseLocalIndexPreflight && ftsUnavailablePreflight.action !== 'text-fallback' && (context.selectedBookIndexView.missing || context.selectedBookIndexView.failed || context.selectedBookIndexView.stale)) {
      const diagnostics = createBookIndexAiDiagnostics(book, context.indexDiagnostics, { scope: effectiveAiRequest.scope, queryUsed: effectiveAiRequest.retrievalQuery });
      const diagnosticMessage = context.selectedBookIndexView.stale
        ? context.t('reader.index.stale', { reason: context.selectedBookIndexView.staleReason || context.t('reader.index.staleFallbackReason') })
        : context.t('ai.status.no-index');
      context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, diagnostics.errorKind ?? 'no-index', diagnosticMessage, diagnostics));
      context.setCitations([]);
      context.setAiDiagnostics(diagnostics);
      context.setAiStatus('no-index');
      return;
    }
    if (shouldUseLocalIndexPreflight && ftsUnavailablePreflight.action === 'fail-fast') {
      context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
      context.setCitations([]);
      context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
      context.setAiStatus('error');
      return;
    }
    if (shouldUseLocalIndexPreflight && ftsUnavailablePreflight.action === 'show-warning') {
      context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
      context.setCitations([]);
      context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
      context.setAiStatus('no-index');
      return;
    }
    context.setAnswer('');
    context.setCitations([]);
    context.setAiDiagnostics(null);
    context.setAiStatus('loading');
    context.setAiSaveStatus('');
    discardAiStreamTokens();
    const abortController = new AbortController();
    const startedAt = performance.now();
    let cloudEndpointMode = 'responses';
    let cloudModel = 'gpt-4.1-mini';
    context.aiAbortControllerRef.current = abortController;
    context.aiRequestIdRef.current = effectiveAiRequest.mode === 'cloud' ? null : requestId;
    try {
      const loadedSettings = effectiveAiRequest.mode === 'cloud' ? await loadAppSettings() : null;
      const settings = loadedSettings ? resolveAiProviderRequestSettings(loadedSettings) : null;
      if (settings) context.appSettingsRef.current = settings;
      const shouldUseMissingKeyLocalFallback = effectiveAiRequest.mode === 'cloud' && !effectiveAiRequest.requireCloudApi && context.extendedSettings.aiFallbackEnabled && context.extendedSettings.localAiEnabled && shouldFallbackCloudAiToLocalForMissingKey(settings);
      if (shouldUseMissingKeyLocalFallback && ftsUnavailablePreflight.action === 'fail-fast') {
        context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
        context.setCitations([]);
        context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
        context.setAiStatus('error');
        return;
      }
      if (shouldUseMissingKeyLocalFallback && ftsUnavailablePreflight.action === 'show-warning') {
        context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
        context.setCitations([]);
        context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
        context.setAiStatus('no-index');
        return;
      }
      cloudEndpointMode = settings?.aiEndpointMode ?? 'responses';
      cloudModel = settings?.aiModel ?? 'gpt-4.1-mini';
      const cloudProviderProfiles = settings ? normalizeAiProviderProfilesForUi(settings) : [];
      const activeCloudProviderProfile = settings
        ? cloudProviderProfiles.find((profile) => profile.id === settings.aiActiveProviderProfileId)
          ?? cloudProviderProfiles.find((profile) => profile.model === cloudModel || profile.models?.includes(cloudModel))
          ?? cloudProviderProfiles[0]
        : null;
      const cloudRequestSizeLimitTokens = activeCloudProviderProfile ? getAiProviderModelConfig(activeCloudProviderProfile, cloudModel).contextWindowTokens : 128000;
      context.setLastAiModel(effectiveAiRequest.mode === 'cloud' && !shouldUseMissingKeyLocalFallback ? cloudModel : 'local-index');
      if (shouldUseMissingKeyLocalFallback) context.aiRequestIdRef.current = requestId;
      if (effectiveAiRequest.interactionMode === 'agent' && effectiveAiRequest.mode === 'cloud' && !shouldUseMissingKeyLocalFallback) {
        const agentExecutionBook = getAgentReaderBookForTools(book);
        const agentEnabledTools = normalizeAgentEnabledTools(effectiveAiRequest.agentEnabledTools);
        const agentEvents: AgentLoopEvent[] = [];
        let agentCitations: Citation[] = [];
        let latestAgentDecisionInstruction = '';
        let latestAgentFinalInstruction = '';
        let latestAgentModelAnswer = '';
        let agentDiagnostics: AiDiagnostics = {
          scope: effectiveAiRequest.scope,
          queryUsed: effectiveAiRequest.retrievalQuery ?? prompt,
          chunkCount: agentExecutionBook.chunks.length,
          ftsAvailable: Boolean(agentExecutionBook.chunks.length),
          resultCount: 0,
          fallbackUsed: false,
          agentToolSteps: 0,
          agentToolIterationCount: 0,
          agentTokensUsed: estimateAgentRuntimeTokens({ baseRequest: { ...effectiveAiRequest, scopeText: '' }, transcript: agentEvents }),
          agentTokenBudget: cloudRequestSizeLimitTokens,
          agentToolsUsed: [],
          agentTaskGoal: prompt,
          agentTaskCompleted: [],
          agentNextPlan: '等待模型决定第一个工具调用',
        };
        const refreshAgentTokenEstimate = () => {
          agentDiagnostics = {
            ...agentDiagnostics,
            agentTokensUsed: estimateAgentRuntimeTokens({
              baseRequest: { ...effectiveAiRequest, scopeText: '' },
              transcript: agentEvents,
              decisionInstruction: latestAgentDecisionInstruction,
              finalInstruction: latestAgentFinalInstruction,
              latestModelAnswer: latestAgentModelAnswer,
            }),
            agentTokenBudget: cloudRequestSizeLimitTokens,
          };
        };
        const renderAgentTimeline = (answerText: string) => {
          refreshAgentTokenEstimate();
          context.setAnswer(mergeAgentTimelineIntoAnswer(answerText, {
            request: effectiveAiRequest,
            events: agentEvents,
            citations: agentCitations.map(agentCitationToProtocol),
            diagnostics: agentDiagnostics,
          }));
          context.setCitations(agentCitations);
          context.setAiDiagnostics(agentDiagnostics);
        };
        context.setAiStatus('streaming');
        for (let step = 0; step < 6; step += 1) {
          const decisionEvent: AgentLoopEvent = {
            id: `agent_model_decision_${step + 1}`,
            kind: 'model_decision',
            title: '模型判断下一步',
            status: 'running',
            content: step === 0 ? 'Agent 正在判断要使用哪个工具。' : 'Agent 正在根据工具结果判断是否继续。',
          };
          agentEvents.push(decisionEvent);
          agentDiagnostics = {
            ...agentDiagnostics,
            agentToolSteps: agentEvents.length,
            agentToolIterationCount: step + 1,
            agentNextPlan: '模型决策中',
          };
          renderAgentTimeline(decisionEvent.content ?? '');
          const decisionInstruction = buildAgentDecisionInstruction({
            userTask: prompt,
            conversationContext: effectiveAiRequest.conversationContext,
            transcript: agentEvents.filter((event) => event !== decisionEvent),
            availableTools: resolveAgentAvailableTools(agentEnabledTools),
            maxSteps: 6 - step,
          });
          latestAgentDecisionInstruction = decisionInstruction;
          refreshAgentTokenEstimate();
          context.setAiDiagnostics(agentDiagnostics);
          const decisionResponse = await requestCloudAiAnswer(settings!, {
            ...effectiveAiRequest,
            instruction: decisionInstruction,
            userText: '',
            scopeText: '',
            scopeLabel: 'Agent 工具决策',
            cloudPromptMode: 'agent_tool_decision',
            cloudResponseFormat: 'json_object',
            requestId: `${requestId}-decision-${step + 1}`,
            bookId: effectiveAiRequest.bookId ?? book.id,
          });
          latestAgentModelAnswer = decisionResponse.answer;
          const decision = parseAgentToolDecision(decisionResponse.answer);
          decisionEvent.status = decision ? 'succeeded' : 'fallback';
          decisionEvent.content = decision
            ? decision.kind === 'tool'
              ? `模型请求调用 ${decision.tool}：${decision.reason || '未说明原因'}`
              : `模型发出完成指令：${decision.reason || '证据已足够'}`
            : '模型没有返回有效工具调用 JSON，已转入最终综合。';
          decisionEvent.payload = decision ?? { raw: decisionResponse.answer.slice(0, 1200) };
          if (!decision) {
            agentDiagnostics = { ...agentDiagnostics, agentNextPlan: '模型决策无效，转入最终综合' };
            refreshAgentTokenEstimate();
            break;
          }
          if (decision.kind === 'final') {
            const finalAnswer = decision.answer.trim() || 'Agent 已完成任务，但模型没有给出最终回答正文。';
            agentEvents.push({
              id: 'agent_final',
              kind: 'final',
              title: '完成指令',
              status: 'succeeded',
              content: finalAnswer,
              payload: { reason: decision.reason },
            });
          agentDiagnostics = {
            ...agentDiagnostics,
            resultCount: Math.max(1, agentDiagnostics.resultCount ?? 0),
            agentToolSteps: agentEvents.length,
            agentTaskCompleted: [...(agentDiagnostics.agentTaskCompleted ?? []), '生成最终回答'],
            agentNextPlan: '任务完成',
          };
            refreshAgentTokenEstimate();
            const privacySafeAnswer = sanitizeAiResponseForPrivacy({ answer: mergeAgentTimelineIntoAnswer(finalAnswer, { request: effectiveAiRequest, events: agentEvents, citations: agentCitations.map(agentCitationToProtocol), diagnostics: agentDiagnostics }), citations: agentCitations, diagnostics: agentDiagnostics }, context.extendedSettings);
            if (shouldSaveCloudAiRequestHistory('succeeded')) {
              void saveCloudAiRequestHistory(buildCloudAiRequestHistoryEntry(effectiveAiRequest, book.id, requestId, startedAt, {
                endpointMode: cloudEndpointMode,
                model: cloudModel,
                resultCount: privacySafeAnswer.diagnostics?.resultCount ?? privacySafeAnswer.citations.length,
                status: 'succeeded',
              }), parseBoundedInteger(context.extendedSettings.cloudAiRequestHistoryLimit, 50, 0, 500));
            }
            if (context.aiStoppedRef.current) return;
            context.setAnswer(privacySafeAnswer.answer);
            context.setCitations(privacySafeAnswer.citations);
            context.setAiDiagnostics(privacySafeAnswer.diagnostics ?? null);
            context.setAiStatus(hasAiAnswerResult(privacySafeAnswer) ? 'ready' : 'no-result');
            return;
          }
          const toolName = decision.tool;
          const toolEvent: AgentLoopEvent = {
            id: `agent_tool_call_${step + 1}_${toolName}`,
            kind: 'tool_call',
            title: `工具请求 · ${toolName}`,
            status: 'running',
            tool: toolName,
            content: decision.reason || '模型请求调用工具',
            payload: decision.args,
          };
          agentEvents.push(toolEvent);
          agentDiagnostics = {
            ...agentDiagnostics,
            agentToolSteps: agentEvents.length,
            agentToolsUsed: Array.from(new Set([...(agentDiagnostics.agentToolsUsed ?? []), toolName])),
            agentNextPlan: `执行工具 ${toolName}`,
          };
          renderAgentTimeline(`正在执行工具：${toolName}`);
          const toolResult = await runAgentRequestedTool(toolName, decision.args, effectiveAiRequest, agentExecutionBook, requestId, prompt, ftsUnavailablePreflight, agentCitations, agentEnabledTools);
          toolEvent.status = toolResult.status;
          if (toolResult.response) {
            agentCitations = mergeAiCitations(agentCitations, toolResult.response.citations);
            agentDiagnostics = {
              ...agentDiagnostics,
              ...toolResult.response.diagnostics,
              agentToolSteps: agentEvents.length + 1,
              agentToolsUsed: Array.from(new Set([...(agentDiagnostics.agentToolsUsed ?? []), toolName])),
              agentTaskCompleted: [...(agentDiagnostics.agentTaskCompleted ?? []), `完成工具 ${toolName}`],
            };
          }
          agentEvents.push({
            id: `agent_tool_result_${step + 1}_${toolName}`,
            kind: 'tool_result',
            title: `工具结果 · ${toolName}`,
            status: toolResult.status,
            tool: toolName,
            content: toolResult.summary,
            payload: toolResult.payload,
          });
          agentDiagnostics = {
            ...agentDiagnostics,
            agentToolSteps: agentEvents.length,
            resultCount: agentCitations.length || agentDiagnostics.resultCount,
            agentTaskCompleted: Array.from(new Set([...(agentDiagnostics.agentTaskCompleted ?? []), `完成工具 ${toolName}`])),
            agentNextPlan: '等待模型判断工具结果是否足够',
          };
          refreshAgentTokenEstimate();
          renderAgentTimeline(toolResult.summary);
          if (toolResult.status === 'confirmation-required') {
            const confirmationPayload = asRecord(toolResult.payload);
            const confirmationText = String(confirmationPayload?.confirmationText ?? `确认执行 ${toolName}`);
            const finalAnswer = [
              '这个操作需要用户确认后才能执行。',
              toolResult.summary,
              `确认方式：再次发送“${confirmationText}”。`,
            ].join('\n');
            agentEvents.push({
              id: 'agent_confirmation_required',
              kind: 'final',
              title: '等待确认',
              status: 'confirmation-required',
              content: finalAnswer,
              payload: toolResult.payload,
            });
            agentDiagnostics = {
              ...agentDiagnostics,
              agentToolSteps: agentEvents.length,
              agentNextPlan: '等待用户确认危险工具调用',
              agentTaskBlockedReason: '需要用户确认后才能写入设置或执行危险操作',
              agentPendingConfirmation: {
                tool: toolName,
                summary: toolResult.summary,
                confirmationText,
              },
            };
            refreshAgentTokenEstimate();
            const privacySafeConfirmation = sanitizeAiResponseForPrivacy({
              answer: mergeAgentTimelineIntoAnswer(finalAnswer, {
                request: effectiveAiRequest,
                events: agentEvents,
                citations: agentCitations.map(agentCitationToProtocol),
                diagnostics: agentDiagnostics,
              }),
              citations: agentCitations,
              diagnostics: agentDiagnostics,
            }, context.extendedSettings);
            if (context.aiStoppedRef.current) return;
            context.setAnswer(privacySafeConfirmation.answer);
            context.setCitations(privacySafeConfirmation.citations);
            context.setAiDiagnostics(privacySafeConfirmation.diagnostics ?? null);
            context.setAiStatus('ready');
            return;
          }
        }
        const finalInstruction = buildAgentDecisionInstruction({
          userTask: prompt,
          conversationContext: effectiveAiRequest.conversationContext,
          transcript: agentEvents,
          availableTools: ['finish'],
          maxSteps: 0,
        });
        latestAgentFinalInstruction = finalInstruction;
        refreshAgentTokenEstimate();
        context.setAiDiagnostics(agentDiagnostics);
        const finalResponse = await requestCloudAiAnswer(settings!, {
          ...effectiveAiRequest,
          instruction: finalInstruction,
          userText: '',
          scopeText: '',
          scopeLabel: 'Agent 最终回答',
          cloudPromptMode: 'agent_tool_decision',
          cloudResponseFormat: 'json_object',
          requestId: `${requestId}-final`,
          bookId: effectiveAiRequest.bookId ?? book.id,
        });
        latestAgentModelAnswer = finalResponse.answer;
        const finalDecision = parseAgentToolDecision(finalResponse.answer);
        const finalAnswer = finalDecision?.kind === 'final' && finalDecision.answer.trim()
          ? finalDecision.answer.trim()
          : finalResponse.answer.trim();
        agentEvents.push({
          id: 'agent_final',
          kind: 'final',
          title: '最终回答',
          status: finalAnswer ? 'succeeded' : 'no-result',
          content: finalAnswer || 'Agent 没有生成最终回答。',
        });
        agentDiagnostics = {
          ...agentDiagnostics,
          resultCount: Math.max(agentCitations.length, finalAnswer ? 1 : 0),
          agentToolSteps: agentEvents.length,
          agentTaskCompleted: [...(agentDiagnostics.agentTaskCompleted ?? []), finalAnswer ? '生成最终回答' : '尝试生成最终回答'],
          agentNextPlan: '任务完成',
        };
        refreshAgentTokenEstimate();
        const privacySafeAgentResponse = sanitizeAiResponseForPrivacy({
          answer: mergeAgentTimelineIntoAnswer(finalAnswer || 'Agent 没有生成最终回答。', {
            request: effectiveAiRequest,
            events: agentEvents,
            citations: agentCitations.map(agentCitationToProtocol),
            diagnostics: agentDiagnostics,
          }),
          citations: agentCitations,
          diagnostics: agentDiagnostics,
        }, context.extendedSettings);
        if (shouldSaveCloudAiRequestHistory(finalAnswer ? 'succeeded' : 'failed')) {
          void saveCloudAiRequestHistory(buildCloudAiRequestHistoryEntry(effectiveAiRequest, book.id, requestId, startedAt, {
            endpointMode: cloudEndpointMode,
            model: cloudModel,
            resultCount: privacySafeAgentResponse.diagnostics?.resultCount ?? privacySafeAgentResponse.citations.length,
            status: finalAnswer ? 'succeeded' : 'failed',
            errorKind: finalAnswer ? undefined : 'agent-no-final-answer',
          }), parseBoundedInteger(context.extendedSettings.cloudAiRequestHistoryLimit, 50, 0, 500));
        }
        if (context.aiStoppedRef.current) return;
        context.setAnswer(privacySafeAgentResponse.answer);
        context.setCitations(privacySafeAgentResponse.citations);
        context.setAiDiagnostics(privacySafeAgentResponse.diagnostics ?? null);
        context.setAiStatus(hasAiAnswerResult(privacySafeAgentResponse) ? 'ready' : 'no-result');
        return;
      }
      const hybridLocalFirstCloudSummary = shouldUseHybridLocalFirstCloudSummary(effectiveAiRequest, context.extendedSettings);
      let hybridCloudRequest: AiAskRequest | null = null;
      if (hybridLocalFirstCloudSummary) {
        if (ftsUnavailablePreflight.action === 'fail-fast') {
          context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
          context.setCitations([]);
          context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
          context.setAiStatus('error');
          return;
        }
        if (ftsUnavailablePreflight.action === 'show-warning') {
          context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
          context.setCitations([]);
          context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
          context.setAiStatus('no-index');
          return;
        }
        context.aiRequestIdRef.current = requestId;
        const hybridLocalResponse = await answerFromLocalIndex({ ...effectiveAiRequest, mode: 'local', requestId, bookId: effectiveAiRequest.bookId ?? book.id, retrievalQuery: effectiveAiRequest.retrievalQuery ?? prompt, multiStageRetrievalMode: effectiveAiRequest.multiStageRetrievalMode, localResultLimit: effectiveAiRequest.localResultLimit, citationMinConfidence: effectiveAiRequest.citationMinConfidence });
        if (ftsUnavailablePreflight.action === 'text-fallback') applyFtsUnavailableFallbackDiagnostics(hybridLocalResponse, ftsUnavailablePreflight);
        hybridCloudRequest = buildHybridLocalFirstCloudRequest(effectiveAiRequest, hybridLocalResponse, prompt);
        context.aiRequestIdRef.current = null;
      }
      const cloudRequestForSend = hybridCloudRequest ?? effectiveAiRequest;
      const originalCloudRequestEstimatedTokens = estimateCloudAiRequestTokens(effectiveAiRequest);
      const cloudRequestEstimatedTokens = hybridCloudRequest ? estimateCloudAiRequestTokens(cloudRequestForSend) : originalCloudRequestEstimatedTokens;
      if (effectiveAiRequest.mode === 'cloud' && !shouldUseMissingKeyLocalFallback && cloudRequestEstimatedTokens > cloudRequestSizeLimitTokens) {
        const diagnostics = {
          scope: cloudRequestForSend.scope,
          queryUsed: cloudRequestForSend.retrievalQuery ?? prompt,
          chunkCount: book.chunks.length,
          ftsAvailable: Boolean(book.chunks.length),
          resultCount: 0,
          fallbackUsed: false,
          errorKind: 'cloud-request-size-limit',
          recommendations: [`当前云端请求约 ${cloudRequestEstimatedTokens} tokens，超过模型最大上下文 ${cloudRequestSizeLimitTokens} tokens`, '缩小 AI 分析范围', '在模型设置中调整最大上下文'],
        } satisfies AiDiagnostics;
        context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, 'cloud-request-size-limit', `云端请求大小超过当前模型 ${cloudRequestSizeLimitTokens} tokens 最大上下文，已阻断发送。`, diagnostics));
        context.setCitations([]);
        context.setAiDiagnostics(diagnostics);
        context.setAiStatus('error');
        return;
      }
      const finalCloudRequestForSend = hybridCloudRequest ?? cloudRequestForSend;
      if (effectiveAiRequest.mode === 'cloud' && !shouldUseMissingKeyLocalFallback) {
        context.cloudAiHistoryContextRef.current = {
          request: finalCloudRequestForSend,
          bookId: book.id,
          requestId,
          startedAt,
          endpointMode: cloudEndpointMode,
          model: cloudModel,
          historyLimit: parseBoundedInteger(context.extendedSettings.cloudAiRequestHistoryLimit, 50, 0, 500),
        };
      }
      const response = effectiveAiRequest.mode === 'cloud' && !shouldUseMissingKeyLocalFallback
        ? settings?.aiStreamingEnabled === false || effectiveAiRequest.interactionMode === 'agent'
          ? await requestCloudAiAnswer(settings!, { ...finalCloudRequestForSend, requestId, bookId: finalCloudRequestForSend.bookId ?? book.id })
          : await requestCloudAiAnswerStream(settings!, { ...finalCloudRequestForSend, requestId, bookId: finalCloudRequestForSend.bookId ?? book.id }, { onToken: appendAiStreamToken, signal: abortController.signal })
        : await answerFromLocalIndex({ ...effectiveAiRequest, mode: 'local', requestId, bookId: effectiveAiRequest.bookId ?? book.id, retrievalQuery: effectiveAiRequest.retrievalQuery ?? prompt, multiStageRetrievalMode: effectiveAiRequest.multiStageRetrievalMode, localResultLimit: effectiveAiRequest.localResultLimit, citationMinConfidence: effectiveAiRequest.citationMinConfidence });
      flushAiStreamTokens();
      const filteredResponse = filterAiResponseCitations(response, context.extendedSettings.aiCitationMinConfidence);
      if (ftsUnavailablePreflight.action === 'text-fallback' && (effectiveAiRequest.mode !== 'cloud' || shouldUseMissingKeyLocalFallback)) {
        applyFtsUnavailableFallbackDiagnostics(filteredResponse, ftsUnavailablePreflight);
      }
      if (shouldUseMissingKeyLocalFallback) {
        filteredResponse.diagnostics = {
          ...filteredResponse.diagnostics,
          scope: filteredResponse.diagnostics?.scope ?? effectiveAiRequest.scope,
          queryUsed: filteredResponse.diagnostics?.queryUsed ?? effectiveAiRequest.retrievalQuery ?? prompt,
          fallbackUsed: true,
          errorKind: 'cloud-missing-api-key-fallback',
          recommendations: [...(filteredResponse.diagnostics?.recommendations ?? []), '云端 API Key 未配置，已自动回退到本地索引'],
        };
      }
      const privacySafeResponse = sanitizeAiResponseForPrivacy(filteredResponse, context.extendedSettings);
      if (effectiveAiRequest.mode === 'cloud' && !shouldUseMissingKeyLocalFallback && shouldSaveCloudAiRequestHistory('succeeded')) {
        void saveCloudAiRequestHistory(buildCloudAiRequestHistoryEntry(cloudRequestForSend, book.id, requestId, startedAt, {
          endpointMode: cloudEndpointMode,
          model: cloudModel,
          resultCount: privacySafeResponse.diagnostics?.resultCount ?? privacySafeResponse.citations.length,
          status: 'succeeded',
        }), parseBoundedInteger(context.extendedSettings.cloudAiRequestHistoryLimit, 50, 0, 500));
      }
      if (context.aiStoppedRef.current) return;
      if (effectiveAiRequest.mode !== 'cloud' || shouldUseMissingKeyLocalFallback) {
        context.setAiStatus('streaming');
        context.setAnswer(privacySafeResponse.answer);
      } else if (settings?.aiStreamingEnabled === false || effectiveAiRequest.interactionMode === 'agent') {
        context.setAnswer(privacySafeResponse.answer);
      }
      context.setCitations(privacySafeResponse.citations);
      context.setAiDiagnostics(privacySafeResponse.diagnostics ?? null);
      context.setAiStatus(hasAiAnswerResult(privacySafeResponse) ? 'ready' : 'no-result');
    } catch (error) {
      discardAiStreamTokens();
      if (context.aiStoppedRef.current || abortController.signal.aborted) return;
      const cloudErrorMessage = redactPrivacyText(formatAiRequestError(error), context.extendedSettings);
      const failedCloudRequestForHistory = context.cloudAiHistoryContextRef.current?.request ?? effectiveAiRequest;
      if (effectiveAiRequest.mode === 'cloud' && shouldSaveCloudAiRequestHistory('failed')) {
        void saveCloudAiRequestHistory(buildCloudAiRequestHistoryEntry(failedCloudRequestForHistory, book.id, requestId, startedAt, {
          endpointMode: cloudEndpointMode,
          model: cloudModel,
          resultCount: 0,
          status: 'failed',
          errorKind: 'cloud-request-error',
          errorMessage: cloudErrorMessage,
        }), parseBoundedInteger(context.extendedSettings.cloudAiRequestHistoryLimit, 50, 0, 500));
      }
      if (effectiveAiRequest.mode === 'cloud' && !effectiveAiRequest.requireCloudApi && context.extendedSettings.aiFallbackEnabled && context.extendedSettings.localAiEnabled && context.extendedSettings.cloudAiFallbackToLocalOnFailure) {
        if (ftsUnavailablePreflight.action === 'fail-fast') {
          context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
          context.setCitations([]);
          context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
          context.setAiStatus('error');
          return;
        }
        if (ftsUnavailablePreflight.action === 'show-warning') {
          context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, ftsUnavailablePreflight.diagnostics.errorKind ?? 'fts-unavailable', ftsUnavailablePreflight.message, ftsUnavailablePreflight.diagnostics));
          context.setCitations([]);
          context.setAiDiagnostics(ftsUnavailablePreflight.diagnostics);
          context.setAiStatus('no-index');
          return;
        }
        const fallbackResponse = filterAiResponseCitations(await answerFromLocalIndex({ ...effectiveAiRequest, mode: 'local', requestId, bookId: effectiveAiRequest.bookId ?? book.id, retrievalQuery: effectiveAiRequest.retrievalQuery ?? prompt, multiStageRetrievalMode: effectiveAiRequest.multiStageRetrievalMode, localResultLimit: effectiveAiRequest.localResultLimit, citationMinConfidence: effectiveAiRequest.citationMinConfidence }), context.extendedSettings.aiCitationMinConfidence);
        if (ftsUnavailablePreflight.action === 'text-fallback') applyFtsUnavailableFallbackDiagnostics(fallbackResponse, ftsUnavailablePreflight);
        const diagnostics = {
          ...fallbackResponse.diagnostics,
          scope: fallbackResponse.diagnostics?.scope ?? effectiveAiRequest.scope,
          queryUsed: fallbackResponse.diagnostics?.queryUsed ?? effectiveAiRequest.retrievalQuery ?? prompt,
          fallbackUsed: true,
          errorKind: 'cloud-request-fallback',
          cloudErrorMessage,
          recommendations: [...(fallbackResponse.diagnostics?.recommendations ?? []), `云端请求失败：${cloudErrorMessage}`, '已自动回退到本地索引'],
        } satisfies AiDiagnostics;
        context.setAiStatus('streaming');
        const privacySafeFallbackResponse = sanitizeAiResponseForPrivacy({ ...fallbackResponse, diagnostics }, context.extendedSettings);
        context.setAnswer(privacySafeFallbackResponse.answer);
        context.setCitations(privacySafeFallbackResponse.citations);
        context.setAiDiagnostics(privacySafeFallbackResponse.diagnostics ?? null);
        context.setAiStatus(hasAiAnswerResult(privacySafeFallbackResponse) ? 'ready' : 'no-result');
        return;
      }
      console.error('Failed to answer from local index:', error);
      const diagnostics = { scope: effectiveAiRequest.scope, queryUsed: effectiveAiRequest.retrievalQuery, errorKind: 'backend-error', recommendations: ['复制诊断信息', '去任务中心重新索引'] } satisfies AiDiagnostics;
      context.setAnswer(createDiagnosticAiResponse(effectiveAiRequest, 'backend-error', context.t('app.localAiFailed'), diagnostics));
      context.setCitations([]);
      context.setAiDiagnostics(diagnostics);
      context.setAiStatus('error');
    } finally {
      if (!context.aiStoppedRef.current) flushAiStreamTokens();
      if (context.aiAbortControllerRef.current === abortController) context.aiAbortControllerRef.current = null;
      if (context.aiRequestIdRef.current === requestId) context.aiRequestIdRef.current = null;
      if (context.cloudAiHistoryContextRef.current?.requestId === requestId) context.cloudAiHistoryContextRef.current = null;
    }
  }

  function formatAiRequestError(error: unknown) {
    if (error instanceof Error) return error.message || error.name;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  function appendAiStreamToken(token: string) {
    if (context.aiStoppedRef.current || !token) return;
    context.setAiStatus('streaming');
    context.aiStreamTokenBufferRef.current += redactPrivacyText(token, context.extendedSettings);
    scheduleAiStreamTokenFlush();
  }

  function scheduleAiStreamTokenFlush() {
    if (context.aiStreamTokenFlushTimerRef.current !== null) return;
    const flushIntervalMs = parseBoundedInteger(context.extendedSettings.aiStreamingFlushIntervalMs, 80, 16, 500);
    context.aiStreamTokenFlushTimerRef.current = window.setTimeout(() => {
      context.aiStreamTokenFlushTimerRef.current = null;
      flushAiStreamTokens();
    }, flushIntervalMs);
  }

  function flushAiStreamTokens() {
    if (context.aiStreamTokenFlushTimerRef.current !== null) {
      window.clearTimeout(context.aiStreamTokenFlushTimerRef.current);
      context.aiStreamTokenFlushTimerRef.current = null;
    }
    const chunk = context.aiStreamTokenBufferRef.current;
    if (!chunk) return;
    context.aiStreamTokenBufferRef.current = '';
    context.setAnswer((current) => current + chunk);
  }

  function discardAiStreamTokens() {
    if (context.aiStreamTokenFlushTimerRef.current !== null) {
      window.clearTimeout(context.aiStreamTokenFlushTimerRef.current);
      context.aiStreamTokenFlushTimerRef.current = null;
    }
    context.aiStreamTokenBufferRef.current = '';
  }

  async function runAgentRequestedTool(
    toolName: string,
    args: Record<string, unknown>,
    request: AiAskRequest,
    currentBook: Book,
    requestId: string,
    prompt: string,
    ftsUnavailablePreflight: FtsUnavailablePreflight,
    knownCitations: Citation[],
    enabledTools = normalizeAgentEnabledTools(request.agentEnabledTools),
  ): Promise<{ status: string; summary: string; payload: unknown; response?: AiResponse }> {
    const normalizedToolName = toolName.trim();
    if (!enabledTools.includes(normalizedToolName) && normalizedToolName !== 'finish') {
      return {
        status: 'failed',
        summary: `Agent 工具已禁用：${normalizedToolName}`,
        payload: {
          errorKind: 'disabled-agent-tool',
          tool: normalizedToolName,
          enabledTools,
        },
      };
    }
    if (normalizedToolName === 'get_current_context') {
      const includeText = args.includeText !== false;
      const trace = createCurrentContextToolTrace(request, currentBook, context.extendedSettings, 'succeeded', { includeText });
      return {
        status: 'succeeded',
        summary: includeText ? '已读取当前阅读上下文正文。' : '已读取当前阅读上下文元数据。',
        payload: trace.toolResult.content,
      };
    }
    if (normalizedToolName === 'get_renderable_formats') {
      const formats = getAgentRenderableFormats();
      return {
        status: 'succeeded',
        summary: `已读取格式工具箱：${formats.formats.length} 种可渲染格式。`,
        payload: formats,
      };
    }
    if (normalizedToolName === 'list_chapters') {
      const catalog = buildAgentChapterCatalog(currentBook.chunks, {
        query: readStringArg(args, 'query') || readStringArg(args, 'title'),
        limit: parseBoundedInteger(readStringArg(args, 'limit'), 120, 1, 2000),
      });
      return {
        status: catalog.status === 'ready' ? 'succeeded' : 'no-result',
        summary: catalog.status === 'ready'
          ? `已读取章节目录：共 ${catalog.chapterCount} 章，末章为「${catalog.lastChapter?.title ?? '未知'}」。`
          : '当前书没有可用章节目录。',
        payload: catalog,
      };
    }
    if (normalizedToolName === 'read_chapter') {
      const result = readAgentChapterText(currentBook.chunks, args);
      const citations = createAgentChapterCitations(currentBook, result, agentCitationSeed(knownCitations));
      return {
        status: result.status === 'ready' ? 'succeeded' : 'no-result',
        summary: result.status === 'ready'
          ? `已读取章节「${result.chapter.title}」：${result.text.length} 字${result.truncated ? '，内容已截断' : ''}。`
          : result.message,
        payload: result,
        response: result.status === 'ready' ? {
          answer: '',
          citations,
          diagnostics: { scope: request.scope, queryUsed: result.chapter.title, resultCount: citations.length, fallbackUsed: false },
        } : undefined,
      };
    }
    if (normalizedToolName === 'search_chapter_text') {
      const result = searchAgentChapterText(currentBook.chunks, args);
      const citations = createAgentChapterCitations(currentBook, result, agentCitationSeed(knownCitations));
      return {
        status: result.status === 'ready' ? 'succeeded' : result.status,
        summary: result.status === 'ready'
          ? `章节搜索“${result.query}”命中 ${result.totalMatches} 次，分布在 ${result.chapterMatches.length} 章。`
          : result.message,
        payload: result,
        response: result.status === 'ready' ? {
          answer: '',
          citations,
          diagnostics: { scope: request.scope, queryUsed: result.query, resultCount: citations.length, fallbackUsed: false },
        } : undefined,
      };
    }
    if (normalizedToolName === 'search_local_index') {
      const query = readStringArg(args, 'query') || readStringArg(args, 'retrievalQuery') || request.retrievalQuery || prompt;
      if (!query.trim()) {
        return { status: 'failed', summary: 'search_local_index 缺少 query。', payload: { errorKind: 'missing-query' } };
      }
      const started = performance.now();
      const response = filterAiResponseCitations(await answerFromLocalIndex({
        ...request,
        mode: 'local',
        requestId: `${requestId}-agent-search-${Date.now()}`,
        bookId: request.bookId ?? currentBook.id,
        retrievalQuery: query,
        localResultLimit: readStringArg(args, 'limit') || request.localResultLimit,
        citationMinConfidence: request.citationMinConfidence,
        multiStageRetrievalMode: request.multiStageRetrievalMode,
      }), context.extendedSettings.aiCitationMinConfidence);
      if (ftsUnavailablePreflight.action === 'text-fallback') applyFtsUnavailableFallbackDiagnostics(response, ftsUnavailablePreflight);
      const resultCount = response.diagnostics?.resultCount ?? response.citations.length;
      return {
        status: resultCount > 0 ? 'succeeded' : 'no-result',
        summary: `本地索引检索“${query}”返回 ${resultCount} 条结果。`,
        response,
        payload: {
          query,
          durationMs: Math.round(performance.now() - started),
          resultCount,
          answerPreview: response.answer.trim().slice(0, 1200),
          citations: response.citations.slice(0, 12).map((citation) => ({
            id: citation.id,
            label: citation.label,
            text: citation.text,
            bookId: citation.bookId,
            chapterId: citation.chapterId,
            chapterIndex: citation.chapterIndex,
            sourceChapterIndex: citation.sourceChapterIndex,
            paragraphIndex: citation.paragraphIndex,
            startOffset: citation.startOffset,
            endOffset: citation.endOffset,
            confidence: citation.confidence,
          })),
          diagnostics: response.diagnostics,
        },
      };
    }
    if (normalizedToolName === 'get_paragraph_window') {
      const windows = buildAgentParagraphWindows(currentBook.chunks, args, knownCitations as unknown as Array<Record<string, unknown>>);
      return {
        status: windows.status === 'ready' ? 'succeeded' : 'no-result',
        summary: windows.status === 'ready' ? `已展开 ${windows.windows.length} 个段落窗口。` : (windows.message ?? '没有可展开的引用或段落位置。'),
        payload: windows,
      };
    }
    if (normalizedToolName === 'read_paragraph_range') {
      const result = readAgentParagraphRange(currentBook.chunks, args);
      return {
        status: result.status === 'ready' ? 'succeeded' : 'no-result',
        summary: result.status === 'ready'
          ? `已读取「${result.chapter.title}」P${result.paragraphStart + 1}-P${result.paragraphEnd + 1}，共 ${result.paragraphs.length} 段。`
          : result.message,
        payload: result,
        response: result.status === 'ready' ? {
          answer: '',
          citations: createAgentParagraphRangeCitations(currentBook, result, agentCitationSeed(knownCitations)),
          diagnostics: { scope: request.scope, queryUsed: `${result.chapter.title} P${result.paragraphStart + 1}-${result.paragraphEnd + 1}`, resultCount: result.paragraphs.length, fallbackUsed: false },
        } : undefined,
      };
    }
    if (normalizedToolName === 'get_reader_settings') {
      const settings = loadGlobalReaderSettings();
      const chapterRules = loadChapterRules();
      const appSettings = context.appSettingsRef.current ?? await loadAppSettings();
      return {
        status: 'succeeded',
        summary: '已读取当前全局阅读设置和设置中心可改设置。',
        payload: {
          settings,
          extendedSettings: pickExtendedSettingsForAgent(context.extendedSettings),
          chapterRules: pickChapterRulesForAgent(chapterRules),
          appSettings: pickAppSettingsForAgent(appSettings),
          editableKeys: searchReaderSettings('').map((item) => ({
            branch: item.branch,
            key: item.key,
            label: item.label,
            description: item.description,
            kind: item.kind,
            values: item.values,
            allowedValues: item.allowedValues,
            valueSchema: item.valueSchema,
            updateExample: item.updateExample,
          })),
        },
      };
    }
    if (normalizedToolName === 'search_settings') {
      const query = readStringArg(args, 'query') || readStringArg(args, 'setting') || prompt;
      const matches = searchReaderSettings(query);
      return {
        status: matches.length ? 'succeeded' : 'no-result',
        summary: matches.length ? `设置搜索“${query}”命中 ${matches.length} 个可修改项。` : `设置搜索“${query}”没有命中可修改项。`,
        payload: {
          query,
          matches: matches.map((item) => ({
            branch: item.branch,
            key: item.key,
            label: item.label,
            description: item.description,
            aliases: item.aliases,
            kind: item.kind,
            values: item.values,
            allowedValues: item.allowedValues,
            valueSchema: item.valueSchema,
            updateExample: item.updateExample,
          })),
        },
      };
    }
    if (normalizedToolName === 'update_reader_settings') {
      const currentSettings = loadGlobalReaderSettings();
      const parsedPatch = parseReaderSettingsPatchFromAgentArgs(args);
      if (!parsedPatch.changedKeys.length && !parsedPatch.changedExtendedKeys.length && !parsedPatch.changedChapterRuleKeys.length && !parsedPatch.changedAppSettingKeys.length && !parsedPatch.changedLocaleKeys.length) {
        return {
          status: 'failed',
          summary: 'update_reader_settings 没有解析到可应用的阅读设置变更。',
          payload: {
            errorKind: 'empty-reader-settings-patch',
            warnings: parsedPatch.warnings,
            supportedSettings: searchReaderSettings('').map((item) => ({ branch: item.branch, key: item.key, label: item.label, description: item.description, kind: item.kind, values: item.values, allowedValues: item.allowedValues, valueSchema: item.valueSchema, updateExample: item.updateExample })),
          },
        };
      }
      const currentChapterRules = loadChapterRules();
      const currentAppSettings = context.appSettingsRef.current ?? await loadAppSettings();
      const previewSettings = parsedPatch.changedKeys.length
        ? normalizeReaderSettings({
          ...currentSettings,
          ...parsedPatch.patch,
          preset: parsedPatch.patch.preset ?? 'custom',
        })
        : currentSettings;
      const previewExtendedSettings = parsedPatch.changedExtendedKeys.length
        ? {
          ...context.extendedSettings,
          ...parsedPatch.extendedPatch,
        }
        : context.extendedSettings;
      const previewChapterRules = parsedPatch.changedChapterRuleKeys.length
        ? {
          ...currentChapterRules,
          ...parsedPatch.chapterRulesPatch,
        }
        : currentChapterRules;
      const previewAppSettings = parsedPatch.changedAppSettingKeys.length
        ? {
          ...currentAppSettings,
          ...parsedPatch.appSettingsPatch,
        }
        : currentAppSettings;
      const confirmationText = buildAgentToolConfirmationText(normalizedToolName, [
        ...parsedPatch.changedKeys,
        ...parsedPatch.changedExtendedKeys,
        ...parsedPatch.changedChapterRuleKeys,
        ...parsedPatch.changedAppSettingKeys,
        ...parsedPatch.changedLocaleKeys,
      ].map(String));
      if (!isAgentUnsafeToolConfirmed(prompt, normalizedToolName)) {
        return {
          status: 'confirmation-required',
          summary: `将修改设置：${[...parsedPatch.changedKeys, ...parsedPatch.changedExtendedKeys, ...parsedPatch.changedChapterRuleKeys, ...parsedPatch.changedAppSettingKeys, ...parsedPatch.changedLocaleKeys].join('、')}。尚未写入，等待确认。`,
          payload: {
            requiresConfirmation: true,
            tool: normalizedToolName,
            confirmationText,
            requestedArgs: args,
            changedKeys: parsedPatch.changedKeys,
            changedExtendedKeys: parsedPatch.changedExtendedKeys,
            changedChapterRuleKeys: parsedPatch.changedChapterRuleKeys,
            changedAppSettingKeys: parsedPatch.changedAppSettingKeys,
            changedLocaleKeys: parsedPatch.changedLocaleKeys,
            warnings: parsedPatch.warnings,
            before: pickReaderSettingsForAgent(currentSettings),
            after: pickReaderSettingsForAgent(previewSettings),
            extendedBefore: pickExtendedSettingsForAgent(context.extendedSettings),
            extendedAfter: pickExtendedSettingsForAgent(previewExtendedSettings),
            chapterRulesBefore: pickChapterRulesForAgent(currentChapterRules),
            chapterRulesAfter: pickChapterRulesForAgent(previewChapterRules),
            appSettingsBefore: pickAppSettingsForAgent(currentAppSettings),
            appSettingsAfter: pickAppSettingsForAgent(previewAppSettings),
          },
        };
      }
      const nextSettings = parsedPatch.changedKeys.length
        ? saveGlobalReaderSettings(previewSettings)
        : currentSettings;
      if (parsedPatch.changedKeys.length) {
        emitReaderApplySettingsNow({
            settings: nextSettings,
            source: 'agent',
            changedKeys: parsedPatch.changedKeys,
        });
      }
      const nextExtendedSettings = parsedPatch.changedExtendedKeys.length
        ? saveExtendedSettings(previewExtendedSettings, { key: 'reader', keys: parsedPatch.changedExtendedKeys.map(String) })
        : context.extendedSettings;
      const nextChapterRules = parsedPatch.changedChapterRuleKeys.length
        ? saveChapterRules(previewChapterRules)
        : currentChapterRules;
      if (parsedPatch.changedChapterRuleKeys.length) {
        dispatchSettingsUpdated({ key: 'chapterRules', keys: parsedPatch.changedChapterRuleKeys.map(String), scope: 'chapterRules' });
      }
      const nextAppSettings = parsedPatch.changedAppSettingKeys.length
        ? await saveAppSettings(previewAppSettings)
        : currentAppSettings;
      if (parsedPatch.changedAppSettingKeys.length) {
        context.appSettingsRef.current = nextAppSettings;
      }
      if (parsedPatch.localePreference) {
        context.setLocalePreference(parsedPatch.localePreference);
      }
      return {
        status: 'succeeded',
        summary: `已应用设置：${[...parsedPatch.changedKeys, ...parsedPatch.changedExtendedKeys, ...parsedPatch.changedChapterRuleKeys, ...parsedPatch.changedAppSettingKeys, ...parsedPatch.changedLocaleKeys].join('、')}。`,
        payload: {
          changedKeys: parsedPatch.changedKeys,
          changedExtendedKeys: parsedPatch.changedExtendedKeys,
          changedChapterRuleKeys: parsedPatch.changedChapterRuleKeys,
          changedAppSettingKeys: parsedPatch.changedAppSettingKeys,
          changedLocaleKeys: parsedPatch.changedLocaleKeys,
          localePreference: parsedPatch.localePreference,
          warnings: parsedPatch.warnings,
          before: pickReaderSettingsForAgent(currentSettings),
          after: pickReaderSettingsForAgent(nextSettings),
          extendedBefore: pickExtendedSettingsForAgent(context.extendedSettings),
          extendedAfter: pickExtendedSettingsForAgent(nextExtendedSettings),
          chapterRulesBefore: pickChapterRulesForAgent(currentChapterRules),
          chapterRulesAfter: pickChapterRulesForAgent(nextChapterRules),
          appSettingsBefore: pickAppSettingsForAgent(currentAppSettings),
          appSettingsAfter: pickAppSettingsForAgent(nextAppSettings),
        },
      };
    }
    if (normalizedToolName === 'get_character_index') {
      const payload = await loadCharacterCenterPayload(currentBook.id);
      if (!payload) {
        return {
          status: 'no-result',
          summary: '当前书籍没有可用人物索引。',
          payload: { errorKind: 'missing-character-index', bookId: currentBook.id, recommendation: '先在人物中心重建人物索引。' },
        };
      }
      const visibleProfiles = payload.profiles.filter((profile) => !profile.hidden);
      return {
        status: 'succeeded',
        summary: `已读取人物索引：${visibleProfiles.length} 个人物，${payload.mentions.length} 条提及。`,
        payload: {
          bookId: currentBook.id,
          bookTitle: currentBook.displayTitle,
          manifest: payload.manifest,
          profileCount: visibleProfiles.length,
          mentionCount: payload.mentions.length,
          profiles: visibleProfiles
            .slice()
            .sort((left, right) => right.mentionCount - left.mentionCount)
            .slice(0, parseBoundedInteger(readStringArg(args, 'limit'), 80, 1, 400))
            .map((profile) => ({
              id: profile.id,
              displayName: profile.displayName,
              canonicalName: profile.canonicalName,
              gender: profile.gender,
              role: profile.role,
              mentionCount: profile.mentionCount,
              aliases: profile.aliases.slice(0, 8).map((alias) => alias.name),
              summary: profile.summary,
            })),
        },
      };
    }
    if (normalizedToolName === 'track_character_growth') {
      const characterName = readStringArg(args, 'characterName') || readStringArg(args, 'name') || readStringArg(args, 'query') || prompt;
      const payload = await loadCharacterCenterPayload(currentBook.id);
      const growth = buildCharacterGrowthTimeline(payload, characterName, {
        maxMentions: parseBoundedInteger(readStringArg(args, 'limit') || readStringArg(args, 'maxMentions'), 120, 1, 400),
      });
      return {
        status: growth.status === 'ready' ? 'succeeded' : 'no-result',
        summary: growth.status === 'ready'
          ? `已整理“${growth.profile.displayName}”成长线：${growth.timeline.length} 个时间点，原始提及 ${growth.totalMentions} 条。`
          : growth.message,
        payload: growth,
      };
    }
    if (normalizedToolName === 'search_character_mentions') {
      const payload = await loadCharacterCenterPayload(currentBook.id);
      const result = searchCharacterMentions(payload, args);
      const citations = createAgentCharacterMentionCitations(currentBook, result, agentCitationSeed(knownCitations));
      return {
        status: result.status === 'ready' ? 'succeeded' : 'no-result',
        summary: result.status === 'ready'
          ? `已检索“${result.profile.displayName}”人物提及：${result.totalMatches} 条匹配。`
          : result.message,
        payload: result,
        response: result.status === 'ready' ? {
          answer: '',
          citations,
          diagnostics: { scope: request.scope, queryUsed: result.profile.displayName, resultCount: citations.length, fallbackUsed: false },
        } : undefined,
      };
    }
    if (normalizedToolName === 'summarize_character_arc') {
      const characterName = readStringArg(args, 'characterName') || readStringArg(args, 'name') || readStringArg(args, 'query') || prompt;
      const payload = await loadCharacterCenterPayload(currentBook.id);
      const result = summarizeCharacterArc(payload, characterName, {
        maxMentions: parseBoundedInteger(readStringArg(args, 'limit') || readStringArg(args, 'maxMentions'), 160, 1, 600),
        maxStages: parseBoundedInteger(readStringArg(args, 'maxStages'), 16, 1, 80),
      });
      const citations = createAgentCharacterArcCitations(currentBook, result, agentCitationSeed(knownCitations));
      return {
        status: result.status === 'ready' ? 'succeeded' : 'no-result',
        summary: result.status === 'ready'
          ? `已总结“${result.profile.displayName}”人物弧线：${result.stages.length} 个章节阶段。`
          : result.message,
        payload: result,
        response: result.status === 'ready' ? {
          answer: '',
          citations,
          diagnostics: { scope: request.scope, queryUsed: result.profile.displayName, resultCount: citations.length, fallbackUsed: false },
        } : undefined,
      };
    }
    return {
      status: 'failed',
      summary: `不支持的 Agent 工具：${normalizedToolName}`,
      payload: {
        errorKind: 'unsupported-agent-tool',
        supportedTools: resolveAgentAvailableTools(),
      },
    };
  }

  function readStringArg(args: Record<string, unknown>, key: string) {
    const value = args[key];
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
  }

  function selectAgentCitationsForWindow(args: Record<string, unknown>, citations: Citation[]) {
    const rawCitationIds = args.citationIds ?? args.citationId ?? args.ids;
    const wantedIds = new Set(
      (Array.isArray(rawCitationIds) ? rawCitationIds : rawCitationIds === undefined ? [] : [rawCitationIds])
        .map((value) => String(value)),
    );
    if (!wantedIds.size) return citations.slice(0, 8);
    return citations.filter((citation) => wantedIds.has(String(citation.id))).slice(0, 12);
  }

  function buildAgentParagraphWindow(citation: Citation, scopeText: string) {
    const paragraphs = scopeText.split(/\n{2,}|\r?\n/u).map((item) => item.trim()).filter(Boolean);
    const paragraphIndex = typeof citation.paragraphIndex === 'number' ? citation.paragraphIndex : -1;
    const around = paragraphIndex >= 0 && paragraphs.length
      ? paragraphs.slice(Math.max(0, paragraphIndex - 1), Math.min(paragraphs.length, paragraphIndex + 2))
      : [];
    return {
      citationId: citation.id,
      label: citation.label,
      text: citation.text,
      bookId: citation.bookId,
      chapterId: citation.chapterId,
      chapterIndex: citation.chapterIndex,
      sourceChapterIndex: citation.sourceChapterIndex,
      paragraphIndex: citation.paragraphIndex,
      startOffset: citation.startOffset,
      endOffset: citation.endOffset,
      windowText: around.length ? around.join('\n\n') : citation.text,
    };
  }

  function pickReaderSettingsForAgent(settings: ReturnType<typeof loadGlobalReaderSettings>) {
    return {
      theme: settings.theme,
      preset: settings.preset,
      layoutMode: settings.layoutMode,
      pageMode: settings.pageMode,
      fontFamily: settings.fontFamily,
      customFontFamily: settings.customFontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      paragraphSpacing: settings.paragraphSpacing,
      customBackgroundColor: settings.customBackgroundColor,
      customTextColor: settings.customTextColor,
      pageWidth: settings.pageWidth,
      headerVisible: settings.headerVisible,
      footerVisible: settings.footerVisible,
      wheelPaging: settings.wheelPaging,
    };
  }

  function pickExtendedSettingsForAgent(settings: ExtendedSettings) {
    return {
      readerDailyGoalEnabled: settings.readerDailyGoalEnabled,
      readerDailyPagesGoal: settings.readerDailyPagesGoal,
      readerDailyMinutesGoal: settings.readerDailyMinutesGoal,
      readerDailyChaptersGoal: settings.readerDailyChaptersGoal,
      autoSaveReaderPosition: settings.autoSaveReaderPosition,
      multiWindowReaderSync: settings.multiWindowReaderSync,
      readerProgressMode: settings.readerProgressMode,
    };
  }

  function pickChapterRulesForAgent(settings: ChapterRuleDraft) {
    return {
      enabled: settings.enabled,
      paragraphMode: settings.paragraphMode,
      removeAds: settings.removeAds,
      adKeywords: settings.adKeywords,
      removeAdUrls: settings.removeAdUrls,
      removePaginationNoise: settings.removePaginationNoise,
      preserveOriginalBackup: settings.preserveOriginalBackup,
      normalizeBlankLines: settings.normalizeBlankLines,
      trimTrailingWhitespace: settings.trimTrailingWhitespace,
      normalizeFullWidthSpaces: settings.normalizeFullWidthSpaces,
      customCleanupRules: settings.customCleanupRules,
      customRegexRules: settings.customRegexRules,
    };
  }

  function pickAppSettingsForAgent(settings: AppSettings) {
    return {
      aiApiBaseUrl: settings.aiApiBaseUrl,
      aiEndpointMode: settings.aiEndpointMode,
      aiModel: settings.aiModel,
      aiActiveProviderProfileId: settings.aiActiveProviderProfileId,
      aiProviderProfileCount: settings.aiProviderProfiles?.length ?? 0,
      aiStreamingEnabled: settings.aiStreamingEnabled,
      aiRequestTimeoutSecs: settings.aiRequestTimeoutSecs,
      aiRetryCount: settings.aiRetryCount,
      aiReasoningEffort: settings.aiReasoningEffort,
      aiResponseFormat: settings.aiResponseFormat,
      operationLogLevel: settings.operationLogLevel,
      trashRetentionDays: settings.trashRetentionDays,
    };
  }

  function mergeAiCitations(existing: Citation[], next: Citation[]) {
    const seen = new Set(existing.map(getCitationDedupeKey));
    const merged = [...existing];
    for (const citation of next) {
      const key = getCitationDedupeKey(citation);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(citation);
    }
    return merged;
  }

  function getCitationDedupeKey(citation: Citation) {
    return [
      citation.id,
      citation.bookId,
      citation.chapterId,
      citation.chapterIndex,
      citation.sourceChapterIndex,
      citation.paragraphIndex,
      citation.startOffset,
      citation.endOffset,
      citation.text,
    ].map((part) => String(part ?? '')).join('|');
  }

  function createAgentChapterCitations(currentBook: Book, result: unknown, startId: number): Citation[] {
    const record = result && typeof result === 'object' ? result as Record<string, unknown> : null;
    if (!record || record.status !== 'ready') return [];
    const citations: Citation[] = [];
    const chapterMatches = Array.isArray(record.chapterMatches) ? record.chapterMatches : null;
    if (chapterMatches) {
      for (const rawMatch of chapterMatches.slice(0, 24)) {
        const match = rawMatch && typeof rawMatch === 'object' ? rawMatch as Record<string, unknown> : null;
        if (!match) continue;
        const sourceChapterIndex = typeof match.sourceChapterIndex === 'number' ? match.sourceChapterIndex : undefined;
        const title = readStringArg(match, 'title') || (typeof sourceChapterIndex === 'number' ? `第 ${sourceChapterIndex + 1} 章` : '章节命中');
        const snippets = Array.isArray(match.snippets) ? match.snippets.map((snippet) => String(snippet)).filter(Boolean) : [];
        for (const [snippetIndex, snippet] of snippets.slice(0, 3).entries()) {
          citations.push({
            id: startId + citations.length,
            label: `${title} · 命中 ${snippetIndex + 1}`,
            text: snippet,
            targetId: `${currentBook.id}:chapter:${sourceChapterIndex ?? 'unknown'}:match:${snippetIndex}`,
            bookId: currentBook.id,
            chapterIndex: sourceChapterIndex,
            sourceChapterIndex,
          });
        }
      }
      return citations;
    }

    const rawChapter = record.chapter && typeof record.chapter === 'object' ? record.chapter as Record<string, unknown> : null;
    if (!rawChapter) return [];
    const sourceChapterIndex = typeof rawChapter.sourceChapterIndex === 'number' ? rawChapter.sourceChapterIndex : undefined;
    const title = readStringArg(rawChapter, 'title') || (typeof sourceChapterIndex === 'number' ? `第 ${sourceChapterIndex + 1} 章` : '指定章节');
    const text = readStringArg(record, 'text').slice(0, 1200) || title;
    return [{
      id: startId,
      label: title,
      text,
      targetId: `${currentBook.id}:chapter:${sourceChapterIndex ?? 'unknown'}`,
      bookId: currentBook.id,
      chapterIndex: sourceChapterIndex,
      sourceChapterIndex,
    }];
  }

  function agentCitationSeed(citations: Citation[]) {
    return citations.reduce((max, citation) => Math.max(max, typeof citation.id === 'number' ? citation.id : 0), 0) + 1;
  }

  function createAgentParagraphRangeCitations(currentBook: Book, result: {
    chapter: { sourceChapterIndex: number; title: string };
    paragraphs: Array<{ paragraphIndex: number; text: string }>;
  }, startId: number): Citation[] {
    return result.paragraphs.slice(0, 24).map((paragraph, index) => ({
      id: startId + index,
      label: `${result.chapter.title} · P${paragraph.paragraphIndex + 1}`,
      text: paragraph.text,
      targetId: `${currentBook.id}:chapter:${result.chapter.sourceChapterIndex}:paragraph:${paragraph.paragraphIndex}`,
      bookId: currentBook.id,
      chapterIndex: result.chapter.sourceChapterIndex,
      sourceChapterIndex: result.chapter.sourceChapterIndex,
      paragraphIndex: paragraph.paragraphIndex,
    }));
  }

  function createAgentCharacterMentionCitations(currentBook: Book, result: unknown, startId: number): Citation[] {
    const record = result && typeof result === 'object' ? result as Record<string, unknown> : null;
    if (!record || record.status !== 'ready' || !Array.isArray(record.mentions)) return [];
    return record.mentions.slice(0, 24).map((rawMention, index) => {
      const mention = rawMention && typeof rawMention === 'object' ? rawMention as Record<string, unknown> : {};
      const sourceChapterIndex = typeof mention.sourceChapterIndex === 'number' ? mention.sourceChapterIndex : undefined;
      const paragraphIndex = typeof mention.paragraphIndex === 'number' ? mention.paragraphIndex : undefined;
      const chapterTitle = readStringArg(mention, 'chapterTitle') || (typeof sourceChapterIndex === 'number' ? `第 ${sourceChapterIndex + 1} 章` : '人物提及');
      return {
        id: startId + index,
        label: `${chapterTitle}${typeof paragraphIndex === 'number' ? ` · P${paragraphIndex + 1}` : ''}`,
        text: readStringArg(mention, 'quote') || readStringArg(mention, 'context'),
        targetId: `${currentBook.id}:character-mention:${readStringArg(mention, 'id') || index}`,
        bookId: currentBook.id,
        chapterIndex: sourceChapterIndex,
        sourceChapterIndex,
        paragraphIndex,
        startOffset: typeof mention.startOffset === 'number' ? mention.startOffset : undefined,
        endOffset: typeof mention.endOffset === 'number' ? mention.endOffset : undefined,
      };
    });
  }

  function createAgentCharacterArcCitations(currentBook: Book, result: unknown, startId: number): Citation[] {
    const record = result && typeof result === 'object' ? result as Record<string, unknown> : null;
    if (!record || record.status !== 'ready' || !Array.isArray(record.stages)) return [];
    const citations: Citation[] = [];
    for (const rawStage of record.stages.slice(0, 16)) {
      const stage = rawStage && typeof rawStage === 'object' ? rawStage as Record<string, unknown> : {};
      const sourceChapterIndex = typeof stage.sourceChapterIndex === 'number' ? stage.sourceChapterIndex : undefined;
      const chapterTitle = readStringArg(stage, 'chapterTitle') || (typeof sourceChapterIndex === 'number' ? `第 ${sourceChapterIndex + 1} 章` : '人物阶段');
      const quotes = Array.isArray(stage.quotes) ? stage.quotes.map((quote) => String(quote)).filter(Boolean) : [];
      for (const [quoteIndex, quote] of quotes.slice(0, 2).entries()) {
        citations.push({
          id: startId + citations.length,
          label: `${chapterTitle} · 弧线证据 ${quoteIndex + 1}`,
          text: quote,
          targetId: `${currentBook.id}:character-arc:${sourceChapterIndex ?? 'unknown'}:${quoteIndex}`,
          bookId: currentBook.id,
          chapterIndex: sourceChapterIndex,
          sourceChapterIndex,
          paragraphIndex: typeof stage.firstParagraphIndex === 'number' ? stage.firstParagraphIndex : undefined,
        });
      }
    }
    return citations;
  }

  function agentCitationToProtocol(citation: Citation, index = 0): AiProtocolCitation {
    const sourceChapterIndex = typeof citation.sourceChapterIndex === 'number'
      ? citation.sourceChapterIndex
      : citation.chapterIndex;
    return {
      id: String(citation.id ?? `agent_citation_${index + 1}`),
      type: 'paragraph',
      label: citation.label,
      quote: citation.text,
      snippet: citation.text,
      sourceText: citation.text,
      bookId: citation.bookId,
      chapterId: citation.chapterId,
      chapterIndex: citation.chapterIndex,
      sourceChapterIndex,
      paragraphIndex: citation.paragraphIndex,
      startOffset: citation.startOffset,
      endOffset: citation.endOffset,
      chunkId: citation.chunkId,
      confidence: citation.confidence,
    };
  }

  async function cancelLocalAiAnswerWithTimeout(requestId: string) {
    const timeoutMs = parseBoundedInteger(context.extendedSettings.localAiCancelTimeoutMs, 2000, 100, 10000);
    let timeoutId: number | null = null;
    const canReportCancelStatus = () => context.aiRequestIdRef.current === requestId || context.aiStoppedRef.current;
    try {
      await Promise.race([
        cancelLocalAiAnswer(requestId),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('本地 AI 取消请求超时')), timeoutMs);
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地 AI 取消请求失败';
      if (!canReportCancelStatus()) return;
      if (message === '本地 AI 取消请求超时') {
        context.setAiSaveStatus('本地 AI 取消请求超时，后台会在下一次取消检查点停止');
        return;
      }
      console.error('Failed to cancel local AI request:', error);
      context.setAiSaveStatus(`本地 AI 取消请求失败：${message}`);
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }

  function shouldSaveCloudAiRequestHistory(status: CloudAiRequestHistoryEntry['status']) {
    if (!context.extendedSettings.cloudAiRequestHistoryEnabled) return false;
    if (status === 'failed') return context.extendedSettings.cloudAiRequestHistorySaveFailed;
    if (status === 'stopped') return context.appSettingsRef.current?.aiCancelStrategy !== 'abort-only' && context.extendedSettings.cloudAiRequestHistorySaveStopped;
    return true;
  }

  function shouldWaitForLocalAiCancel() {
    return context.appSettingsRef.current?.aiCancelStrategy === 'abort-and-local-timeout';
  }

  function stopAiGeneration() {
    context.setAiStopped(true);
    context.aiStoppedRef.current = true;
    const cloudHistoryContext = context.cloudAiHistoryContextRef.current;
    if (cloudHistoryContext && shouldSaveCloudAiRequestHistory('stopped')) {
      void saveCloudAiRequestHistory(buildCloudAiRequestHistoryEntry(cloudHistoryContext.request, cloudHistoryContext.bookId, cloudHistoryContext.requestId, cloudHistoryContext.startedAt, {
        endpointMode: cloudHistoryContext.endpointMode,
        model: cloudHistoryContext.model,
        resultCount: 0,
        status: 'stopped',
        errorKind: 'user-stopped',
      }), cloudHistoryContext.historyLimit);
    }
    context.aiAbortControllerRef.current?.abort();
    const requestId = context.aiRequestIdRef.current;
    if (requestId && shouldWaitForLocalAiCancel()) void cancelLocalAiAnswerWithTimeout(requestId);
    context.aiAbortControllerRef.current = null;
    context.aiRequestIdRef.current = null;
    context.cloudAiHistoryContextRef.current = null;
    discardAiStreamTokens();
    context.setAiStatus('idle');
    context.setAiSaveStatus(context.t('ai.stopped'));
  }

  function resetAiSessionForCurrentBookDataClear() {
    context.setAiStopped(true);
    context.aiStoppedRef.current = true;
    context.aiAbortControllerRef.current?.abort();
    const requestId = context.aiRequestIdRef.current;
    if (requestId) void cancelLocalAiAnswerWithTimeout(requestId);
    context.aiAbortControllerRef.current = null;
    context.aiRequestIdRef.current = null;
    context.cloudAiHistoryContextRef.current = null;
    discardAiStreamTokens();
    context.setAnswer('');
    context.setCitations([]);
    context.setAiDiagnostics(null);
    context.setAiStatus('idle');
    context.setAiSaveStatus('当前书 AI 会话已随数据清理重置');
  }

  function retryAiGeneration(requestOverride?: AiAskRequest) {
    const request = requestOverride ?? context.lastAiRequest;
    if (!request) return;
    void summarizeBook(request);
  }

  async function saveCurrentAnswerAsNote() {
    if (!context.answer.trim()) return;
    try {
      const readerLocation = context.readerNoteLocation ?? undefined;
      const parsedAnswerForMetadata = parseAiResponseProtocol(context.answer);
      const structuredResponse = context.extendedSettings.aiSaveStructuredResponseWithNote ? sanitizeStructuredAiResponseForPrivacy(parsedAnswerForMetadata, context.extendedSettings) : undefined;
      const saved = await saveAiNote(
        context.book ? context.t('app.aiNoteTitle', { title: getPrivacyBookTitle(context.book.displayTitle, context.extendedSettings) }) : context.t('app.aiAnswerTitle'),
        context.answer,
        sanitizeCitationsForPrivacy(context.citations, context.extendedSettings),
        readerLocation,
        sanitizeAiNoteMetadataForPrivacy(buildAiNoteMetadata(parsedAnswerForMetadata), context.extendedSettings),
        context.extendedSettings.noteDefaultSaveTarget,
        structuredResponse);
      emitNotesUpdated();
      context.setAiSaveStatus(context.t('ai.savedNote'));
      context.setAiNoteToast({ noteId: saved.id, message: context.t('ai.savedNote') });
    } catch (error) {
      console.error('Failed to save AI note:', error);
      context.setAiSaveStatus(context.t('ai.saveFailed'));
    }
  }

  function buildAiNoteMetadata(structuredResponse = context.answer.trim() ? parseAiResponseProtocol(context.answer) : undefined): AiNoteMetadata | undefined {
    if (!context.lastAiRequest) return undefined;
    const citationCoverage = structuredResponse ? `${structuredResponse.citations.length} citations / ${structuredResponse.blocks.length} blocks` : `${context.citations.length} citations`;
    return {
      instruction: context.lastAiRequest.instruction,
      scope: context.lastAiRequest.scope,
      userText: context.lastAiRequest.userText,
      selectedCommandId: context.lastAiRequest.selectedCommandId,
      retrievalStrategy: context.lastAiRequest.retrievalStrategy,
      retrievalQuery: context.lastAiRequest.retrievalQuery,
      multiStageRetrievalMode: context.lastAiRequest.multiStageRetrievalMode,
      model: context.lastAiModel,
      savedAt: new Date().toISOString(),
      schema: structuredResponse?.schema,
      mode: context.lastAiRequest.mode ?? 'local',
      interactionMode: context.lastAiRequest.interactionMode,
      generatedAt: new Date().toISOString(),
      citationCoverage,
      bookRange: context.lastAiRequest.scopeLabel ?? context.lastAiRequest.scope,
    };
  }

  async function saveCitationAsHighlight(citation: Citation) {
    try {
      await saveHighlight(sanitizeCitationForPrivacy(citation, context.extendedSettings));
      emitHighlightsUpdated();
      context.setAiSaveStatus(context.t('ai.savedHighlight'));
    } catch (error) {
      console.error('Failed to save highlight:', error);
      context.setAiSaveStatus(context.t('ai.saveFailed'));
    }
  }

  async function saveCitationAsExcerpt(citation: Citation) {
    try {
      const title = context.book ? context.t('app.aiExcerptTitle', { title: getPrivacyBookTitle(context.book.displayTitle, context.extendedSettings) }) : context.t('app.aiExcerptFallbackTitle');
      const safeCitation = sanitizeCitationForPrivacy(citation, context.extendedSettings);
      const saved = await saveAiNote(title, safeCitation.text, [safeCitation], context.readerNoteLocation ?? undefined, undefined, context.extendedSettings.noteDefaultSaveTarget, undefined);
      emitNotesUpdated();
      context.setAiSaveStatus(context.t('ai.savedExcerpt'));
      context.setAiNoteToast({ noteId: saved.id, message: context.t('ai.savedExcerpt') });
    } catch (error) {
      console.error('Failed to save citation excerpt:', error);
      context.setAiSaveStatus(context.t('ai.saveFailed'));
    }
  }

  function isAgentUnsafeToolConfirmed(promptText: string, toolName: string) {
    const normalized = promptText.trim().toLowerCase();
    if (!normalized) return false;
    const hasConfirmation = /确认执行|确认应用|确认修改|同意执行|允许执行|执行以上|应用以上|确认/.test(normalized);
    const mentionsTool = normalized.includes(toolName.toLowerCase()) || /设置|修改|应用/.test(normalized);
    return hasConfirmation && mentionsTool;
  }

  function buildAgentToolConfirmationText(toolName: string, changedKeys: string[]) {
    const keySummary = changedKeys.length ? ` ${changedKeys.join('、')}` : '';
    return `确认执行 ${toolName}${keySummary}`;
  }

  function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

  return {
    discardAiStreamTokens,
    resetAiSessionForCurrentBookDataClear,
    retryAiGeneration,
    saveCitationAsExcerpt,
    saveCitationAsHighlight,
    saveCurrentAnswerAsNote,
    stopAiGeneration,
    summarizeBook,
  };
}

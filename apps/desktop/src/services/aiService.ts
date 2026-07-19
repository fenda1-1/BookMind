import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { redactCloudText } from './cloudAiPrivacy';
import type { AiEndpointMode, AiReasoningEffort, AiResponse, AppSettings, SearchResult } from '../types';

export type AiMode = 'local' | 'cloud' | 'mock';

export type AiRequest = {
  scope: string;
  instruction: string;
  userText: string;
  selectedCommandId?: string;
  retrievalStrategy?: string;
  retrievalQuery?: string;
  multiStageRetrievalMode?: string;
  localResultLimit?: string;
  citationMinConfidence?: string;
  bookId?: string;
  scopeText?: string;
  scopeLabel?: string;
  conversationContext?: string;
  mode?: AiMode;
  interactionMode?: 'qa' | 'agent';
  requireCloudApi?: boolean;
  cloudPromptMode?: 'bookmind' | 'agent_tool_decision' | 'plain_text';
  cloudResponseFormat?: 'default' | 'text' | 'json_object' | 'json_schema';
  requestId?: string;
  customSensitiveWords?: string;
  reasoningEffort?: AiReasoningEffort;
};

export type CloudAiTestResult = {
  ok: boolean;
  status: number;
  model: string;
  durationMs: number;
  text: string;
  error?: string;
};

export type CloudAiModelsResult = {
  models: string[];
};

export type VectorIndexBuildResult = {
  ok: boolean;
  bookId: string;
  sidecarStatus: 'not-configured' | 'available' | 'unavailable' | 'error';
  vectorIndexStatus: 'not-built' | 'building' | 'ready' | 'stale' | 'failed';
  indexedChunkCount: number;
  message: string;
};

export type VectorSearchResult = {
  ok: boolean;
  query: string;
  sidecarStatus: 'not-configured' | 'available' | 'unavailable' | 'error';
  vectorIndexStatus: 'not-built' | 'building' | 'ready' | 'stale' | 'failed';
  results: SearchResult[];
  message: string;
};

export type AiSidecarHealthResult = {
  sidecarStatus: 'not-configured' | 'available' | 'unavailable' | 'error';
  message: string;
  version: string;
  capabilities: string[];
  checkedAt: string;
};

export type CloudAiStreamEvent = {
  requestId: string;
  token: string;
};

export type AiStreamHandlers = {
  onToken: (token: string) => void;
  signal?: AbortSignal;
};

export async function answerFromLocalIndex(request: AiRequest): Promise<AiResponse> {
  return await invoke<AiResponse>('answer_from_local_index', { request });
}

export async function cancelLocalAiAnswer(requestId: string): Promise<void> {
  if (!requestId) return;
  await invoke<void>('cancel_local_ai_answer', { requestId });
}

export async function buildVectorIndex(bookId: string): Promise<VectorIndexBuildResult> {
  return await invoke<VectorIndexBuildResult>('build_vector_index', { bookId });
}

export async function searchVectorIndex(query: string, limit = 20): Promise<VectorSearchResult> {
  return await invoke<VectorSearchResult>('search_vector_index', { query, limit });
}

export async function checkAiSidecarHealth(): Promise<AiSidecarHealthResult> {
  return await invoke<AiSidecarHealthResult>('check_ai_sidecar_health');
}

export async function testCloudAiConnection(settings: AppSettings): Promise<CloudAiTestResult> {
  const startedAt = performance.now();
  try {
    return await invoke<CloudAiTestResult>('test_cloud_ai_connection', { request: { settings } });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      model: '',
      durationMs: Math.round(performance.now() - startedAt),
      text: '',
      error: normalizeCloudAiError(error),
    };
  }
}

export async function requestCloudAiAnswer(settings: AppSettings, request: AiRequest): Promise<AiResponse> {
  return await invoke<AiResponse>('request_cloud_ai_answer', { request: { settings: applyAiRequestOverrides(settings, request), request: sanitizeCloudAiRequest(request) } });
}

export async function listCloudAiModels(settings: AppSettings): Promise<string[]> {
  const result = await invoke<CloudAiModelsResult>('list_cloud_ai_models', { request: { settings } });
  return result.models;
}

export async function requestCloudAiAnswerStream(settings: AppSettings, request: AiRequest, handlers: AiStreamHandlers): Promise<AiResponse> {
  if (handlers.signal?.aborted) throw new Error('云端请求已停止');
  const requestId = request.requestId ?? `cloud-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sanitizedRequest = sanitizeCloudAiRequest({ ...request, requestId });
  const unlisten = await listen<CloudAiStreamEvent>('cloud-ai-stream-token', (event) => {
    if (handlers.signal?.aborted || event.payload.requestId !== requestId) return;
    handlers.onToken(event.payload.token);
  });
  try {
    return await invoke<AiResponse>('request_cloud_ai_answer_stream', { request: { settings: applyAiRequestOverrides(settings, request), request: sanitizedRequest } });
  } finally {
    unlisten();
  }
}

export function applyAiRequestOverrides(settings: AppSettings, request: Pick<AiRequest, 'reasoningEffort'>): AppSettings {
  const reasoningEffort = request.reasoningEffort?.trim();
  return reasoningEffort ? { ...settings, aiReasoningEffort: reasoningEffort } : settings;
}

export function sanitizeCloudAiRequest(request: AiRequest): AiRequest {
  const customSensitiveWords = request.customSensitiveWords;
  return {
    ...request,
    instruction: redactOptionalCloudField(request.instruction, customSensitiveWords) ?? '',
    userText: redactOptionalCloudField(request.userText, customSensitiveWords) ?? '',
    retrievalQuery: redactOptionalCloudField(request.retrievalQuery, customSensitiveWords),
    scopeText: redactOptionalCloudField(request.scopeText, customSensitiveWords),
    scopeLabel: redactOptionalCloudField(request.scopeLabel, customSensitiveWords),
    conversationContext: redactOptionalCloudField(request.conversationContext, customSensitiveWords),
    bookId: undefined,
    customSensitiveWords: undefined,
  };
}

function redactOptionalCloudField(value: string | undefined, customSensitiveWords = '') {
  return value === undefined ? undefined : redactCloudText(value, customSensitiveWords);
}

export function resolveAiEndpointUrl(baseUrl: string | undefined, mode: AiEndpointMode | undefined) {
  const normalizedMode = mode ?? 'responses';
  const raw = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  if (normalizedMode === 'responses') {
    if (/\/responses$/i.test(raw)) return raw;
    if (/\/v1$/i.test(raw)) return `${raw}/responses`;
    return `${raw}/responses`;
  }
  if (/\/chat\/completions$/i.test(raw)) return raw;
  if (/\/v1$/i.test(raw)) return `${raw}/chat/completions`;
  return `${raw}/chat/completions`;
}

export function parseOpenAiText(payload: unknown): string {
  const data = payload as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return '';
  if (typeof data.output_text === 'string') return data.output_text;
  const choices = data.choices;
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === 'string') return message.content;
    if (Array.isArray(message?.content)) return contentArrayToText(message.content);
  }
  const output = data.output;
  if (Array.isArray(output)) {
    return output.flatMap((item) => {
      const content = (item as Record<string, unknown>).content;
      return Array.isArray(content) ? contentArrayToText(content) : [];
    }).join('\n').trim();
  }
  if (typeof data.content === 'string') return data.content;
  if (Array.isArray(data.content)) return contentArrayToText(data.content);
  return '';
}

function contentArrayToText(content: unknown[]) {
  return content.map((part) => {
    if (typeof part === 'string') return part;
    const item = part as Record<string, unknown>;
    if (typeof item.text === 'string') return item.text;
    if (typeof item.output_text === 'string') return item.output_text;
    if (typeof item.content === 'string') return item.content;
    return '';
  }).filter(Boolean).join('\n').trim();
}

function normalizeCloudAiError(error: unknown) {
  if (error instanceof Error) return error.message.replace(/Bearer\s+\S+/g, 'Bearer [hidden]');
  return String(error).replace(/Bearer\s+\S+/g, 'Bearer [hidden]');
}

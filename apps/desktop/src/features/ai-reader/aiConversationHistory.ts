export type AiConversationMessageRole = 'user' | 'assistant';
export type AiConversationMessageStatus = 'pending' | 'streaming' | 'ready' | 'error';

export type AiConversationMessage = {
  id: string;
  role: AiConversationMessageRole;
  content: string;
  createdAt: string;
  updatedAt: string;
  status?: AiConversationMessageStatus;
  citations?: unknown[];
  diagnostics?: unknown;
  model?: string;
};

export type AiConversationContextCompression = {
  id?: string;
  content: string;
  compressedAt: string;
  messageCount: number;
  sourceTokenEstimate: number;
  targetTokenEstimate: number;
  thresholdTokens: number;
  model?: string;
};

export type AiConversationContextCompressionSnapshot = AiConversationContextCompression & {
  id: string;
  sourceContent?: string;
  previousContent?: string;
  restoredAt?: string;
};

export type AiConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  messages: AiConversationMessage[];
  contextCompression?: AiConversationContextCompression;
  contextCompressionHistory?: AiConversationContextCompressionSnapshot[];
};

export type AiConversationHistoryState = {
  activeConversationId: string;
  conversations: AiConversation[];
};

type HistoryOptions = {
  now?: () => string;
  idFactory?: () => string;
  untitledConversation?: string;
};

type AssistantOptions = HistoryOptions & {
  status?: AiConversationMessageStatus;
  messageId?: string;
  citations?: unknown[];
  diagnostics?: unknown;
  model?: string;
};

const UNTITLED_CONVERSATION = '新对话';

export function createAiConversationHistory(options: HistoryOptions = {}): AiConversationHistoryState {
  const conversation = createConversation(options);
  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

export function normalizeAiConversationHistory(input: unknown, options: HistoryOptions = {}): AiConversationHistoryState {
  if (!input || typeof input !== 'object') return createAiConversationHistory(options);
  const state = input as Partial<AiConversationHistoryState>;
  const conversations = Array.isArray(state.conversations)
    ? state.conversations.map((conversation) => normalizeConversation(conversation, options)).filter((conversation): conversation is AiConversation => Boolean(conversation))
    : [];
  if (conversations.length === 0) return createAiConversationHistory(options);
  const sorted = sortConversations(conversations);
  const activeConversationId = typeof state.activeConversationId === 'string' && sorted.some((conversation) => conversation.id === state.activeConversationId)
    ? state.activeConversationId
    : sorted[0].id;
  return { activeConversationId, conversations: sorted };
}

export function startNewConversation(history: AiConversationHistoryState, options: HistoryOptions = {}): AiConversationHistoryState {
  const conversation = createConversation(options);
  return {
    activeConversationId: conversation.id,
    conversations: sortConversations([conversation, ...history.conversations]),
  };
}

export function appendUserMessage(history: AiConversationHistoryState, content: string, options: HistoryOptions = {}): AiConversationHistoryState {
  const text = content.trim();
  if (!text) return history;
  const timestamp = getNow(options);
  return updateActiveConversation(history, (conversation) => {
    const message = createMessage('user', text, { ...options, now: () => timestamp });
    const shouldUsePromptTitle = isUntitledConversationTitle(conversation.title, options) && conversation.messages.length === 0;
    return {
      ...conversation,
      title: shouldUsePromptTitle ? deriveConversationTitle(text) : conversation.title,
      updatedAt: timestamp,
      messages: [...conversation.messages, message],
    };
  });
}

export function appendAssistantMessage(history: AiConversationHistoryState, content: string, options: AssistantOptions = {}): AiConversationHistoryState {
  const timestamp = getNow(options);
  return updateActiveConversation(history, (conversation) => ({
    ...conversation,
    updatedAt: timestamp,
    messages: [
      ...conversation.messages,
      {
        ...createMessage('assistant', content, { ...options, now: () => timestamp, messageId: options.messageId }),
        status: options.status ?? 'pending',
        citations: options.citations,
        diagnostics: options.diagnostics,
        model: options.model,
      },
    ],
  }));
}

export function upsertAssistantMessage(history: AiConversationHistoryState, content: string, options: AssistantOptions = {}): AiConversationHistoryState {
  return upsertAssistantMessageForConversation(history, history.activeConversationId, content, options);
}

export function upsertAssistantMessageForConversation(history: AiConversationHistoryState, conversationId: string, content: string, options: AssistantOptions = {}): AiConversationHistoryState {
  const timestamp = getNow(options);
  return mapConversation(history, conversationId, (conversation) => {
    const targetIndex = options.messageId
      ? conversation.messages.findIndex((message) => message.id === options.messageId && message.role === 'assistant')
      : findLastAssistantIndex(conversation.messages);
    if (targetIndex < 0) {
      return {
        ...conversation,
        updatedAt: timestamp,
        messages: [
          ...conversation.messages,
          {
            ...createMessage('assistant', content, { ...options, now: () => timestamp, messageId: options.messageId }),
            status: options.status ?? 'ready',
            citations: options.citations,
            diagnostics: options.diagnostics,
            model: options.model,
          },
        ],
      };
    }
    const messages = conversation.messages.map((message, index) => index === targetIndex
      ? {
          ...message,
          content,
          updatedAt: timestamp,
          status: options.status ?? message.status ?? 'ready',
          citations: options.citations ?? message.citations,
          diagnostics: options.diagnostics ?? message.diagnostics,
          model: options.model ?? message.model,
        }
      : message);
    return { ...conversation, updatedAt: timestamp, messages };
  });
}

export function renameConversation(history: AiConversationHistoryState, conversationId: string, title: string, options: HistoryOptions = {}): AiConversationHistoryState {
  const nextTitle = title.trim() || getUntitledConversationTitle(options);
  return mapConversation(history, conversationId, (conversation) => ({
    ...conversation,
    title: nextTitle,
    updatedAt: getNow(options),
  }));
}

export function pinConversation(history: AiConversationHistoryState, conversationId: string, pinned: boolean, options: HistoryOptions = {}): AiConversationHistoryState {
  return mapConversation(history, conversationId, (conversation) => ({
    ...conversation,
    pinned,
    updatedAt: getNow(options),
  }));
}

export function deleteConversation(history: AiConversationHistoryState, conversationId: string, options: HistoryOptions = {}): AiConversationHistoryState {
  const remaining = history.conversations.filter((conversation) => conversation.id !== conversationId);
  if (remaining.length === history.conversations.length) return history;
  if (remaining.length === 0) return createAiConversationHistory(options);
  const conversations = sortConversations(remaining);
  const activeConversationId = history.activeConversationId === conversationId ? conversations[0].id : history.activeConversationId;
  return { activeConversationId, conversations };
}

export function deleteConversationMessage(history: AiConversationHistoryState, conversationId: string, messageId: string, options: HistoryOptions = {}): AiConversationHistoryState {
  const target = history.conversations.find((conversation) => conversation.id === conversationId);
  if (!target?.messages.some((message) => message.id === messageId)) return history;
  return mapConversation(history, conversationId, (conversation) => ({
    ...conversation,
    updatedAt: getNow(options),
    messages: conversation.messages.filter((message) => message.id !== messageId),
  }));
}

export function applyConversationContextCompression(history: AiConversationHistoryState, conversationId: string, compression: AiConversationContextCompression & { sourceContent?: string }, options: HistoryOptions = {}): AiConversationHistoryState {
  const timestamp = getNow(options);
  return mapConversation(history, conversationId, (conversation) => {
    const snapshot = normalizeContextCompressionSnapshot({
      ...compression,
      id: compression.id || getId(options),
      previousContent: conversation.contextCompression?.content,
    }, conversation.messages.length);
    return {
      ...conversation,
      updatedAt: timestamp,
      contextCompression: snapshot ? compressionSnapshotToActiveCompression(snapshot) : compression,
      contextCompressionHistory: snapshot
        ? [snapshot, ...(conversation.contextCompressionHistory ?? [])].slice(0, 12)
        : conversation.contextCompressionHistory,
    };
  });
}

export function restoreConversationContextCompression(history: AiConversationHistoryState, conversationId: string, snapshotId: string, options: HistoryOptions = {}): AiConversationHistoryState {
  const timestamp = getNow(options);
  return mapConversation(history, conversationId, (conversation) => {
    const target = conversation.contextCompressionHistory?.find((snapshot) => snapshot.id === snapshotId);
    if (!target) return conversation;
    return {
      ...conversation,
      updatedAt: timestamp,
      contextCompression: compressionSnapshotToActiveCompression({
        ...target,
        restoredAt: timestamp,
      }),
      contextCompressionHistory: conversation.contextCompressionHistory?.map((snapshot) => snapshot.id === snapshotId ? { ...snapshot, restoredAt: timestamp } : snapshot),
    };
  });
}

export function switchConversation(history: AiConversationHistoryState, conversationId: string): AiConversationHistoryState {
  if (!history.conversations.some((conversation) => conversation.id === conversationId)) return history;
  return { ...history, activeConversationId: conversationId };
}

export function getActiveConversation(history: AiConversationHistoryState): AiConversation {
  return history.conversations.find((conversation) => conversation.id === history.activeConversationId) ?? history.conversations[0];
}

function updateActiveConversation(history: AiConversationHistoryState, updater: (conversation: AiConversation) => AiConversation): AiConversationHistoryState {
  return mapConversation(history, history.activeConversationId, updater);
}

function mapConversation(history: AiConversationHistoryState, conversationId: string, updater: (conversation: AiConversation) => AiConversation): AiConversationHistoryState {
  const conversations = history.conversations.map((conversation) => conversation.id === conversationId ? updater(conversation) : conversation);
  return { ...history, conversations: sortConversations(conversations) };
}

function sortConversations(conversations: AiConversation[]) {
  return [...conversations].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function createConversation(options: HistoryOptions): AiConversation {
  const timestamp = getNow(options);
  return {
    id: getId(options),
    title: getUntitledConversationTitle(options),
    createdAt: timestamp,
    updatedAt: timestamp,
    pinned: false,
    messages: [],
  };
}

function createMessage(role: AiConversationMessageRole, content: string, options: HistoryOptions & { messageId?: string }): AiConversationMessage {
  const timestamp = getNow(options);
  return {
    id: options.messageId ?? getId(options),
    role,
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeConversation(input: unknown, options: HistoryOptions): AiConversation | null {
  if (!input || typeof input !== 'object') return null;
  const conversation = input as Partial<AiConversation>;
  if (typeof conversation.id !== 'string' || !conversation.id) return null;
  const createdAt = typeof conversation.createdAt === 'string' ? conversation.createdAt : new Date(0).toISOString();
  const updatedAt = typeof conversation.updatedAt === 'string' ? conversation.updatedAt : createdAt;
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map(normalizeMessage).filter((message): message is AiConversationMessage => Boolean(message))
    : [];
  return {
    id: conversation.id,
    title: typeof conversation.title === 'string' && conversation.title.trim() ? conversation.title.trim() : getUntitledConversationTitle(options),
    createdAt,
    updatedAt,
    pinned: conversation.pinned === true,
    messages,
    contextCompression: normalizeContextCompression(conversation.contextCompression, messages.length),
    contextCompressionHistory: normalizeContextCompressionHistory(conversation.contextCompressionHistory, messages.length),
  };
}

function getUntitledConversationTitle(options: HistoryOptions) {
  return options.untitledConversation?.trim() || UNTITLED_CONVERSATION;
}

function isUntitledConversationTitle(title: string, options: HistoryOptions) {
  return title === getUntitledConversationTitle(options) || title === UNTITLED_CONVERSATION;
}

function normalizeContextCompression(input: unknown, messageCount: number): AiConversationContextCompression | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const compression = input as Partial<AiConversationContextCompression>;
  if (typeof compression.content !== 'string' || !compression.content.trim()) return undefined;
  const safeMessageCount = clampInteger(compression.messageCount, 0, messageCount);
  return {
    id: typeof compression.id === 'string' ? compression.id : undefined,
    content: compression.content.slice(0, 20000),
    compressedAt: typeof compression.compressedAt === 'string' ? compression.compressedAt : new Date(0).toISOString(),
    messageCount: safeMessageCount,
    sourceTokenEstimate: clampInteger(compression.sourceTokenEstimate, 0, 10_000_000),
    targetTokenEstimate: clampInteger(compression.targetTokenEstimate, 0, 10_000_000),
    thresholdTokens: clampInteger(compression.thresholdTokens, 0, 10_000_000),
    model: typeof compression.model === 'string' ? compression.model : undefined,
  };
}

function normalizeContextCompressionHistory(input: unknown, messageCount: number): AiConversationContextCompressionSnapshot[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const snapshots = input
    .map((item) => normalizeContextCompressionSnapshot(item, messageCount))
    .filter((snapshot): snapshot is AiConversationContextCompressionSnapshot => Boolean(snapshot));
  return snapshots.length ? snapshots.slice(0, 12) : undefined;
}

function normalizeContextCompressionSnapshot(input: unknown, messageCount: number): AiConversationContextCompressionSnapshot | null {
  const compression = normalizeContextCompression(input, messageCount);
  if (!compression) return null;
  const raw = input && typeof input === 'object' ? input as Partial<AiConversationContextCompressionSnapshot> : {};
  const id = typeof raw.id === 'string' && raw.id ? raw.id : '';
  if (!id) return null;
  return {
    ...compression,
    id,
    sourceContent: typeof raw.sourceContent === 'string' ? raw.sourceContent.slice(0, 24000) : undefined,
    previousContent: typeof raw.previousContent === 'string' ? raw.previousContent.slice(0, 20000) : undefined,
    restoredAt: typeof raw.restoredAt === 'string' ? raw.restoredAt : undefined,
  };
}

function compressionSnapshotToActiveCompression(snapshot: AiConversationContextCompressionSnapshot): AiConversationContextCompression {
  return {
    id: snapshot.id,
    content: snapshot.content,
    compressedAt: snapshot.compressedAt,
    messageCount: snapshot.messageCount,
    sourceTokenEstimate: snapshot.sourceTokenEstimate,
    targetTokenEstimate: snapshot.targetTokenEstimate,
    thresholdTokens: snapshot.thresholdTokens,
    model: snapshot.model,
  };
}

function clampInteger(value: unknown, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeMessage(input: unknown): AiConversationMessage | null {
  if (!input || typeof input !== 'object') return null;
  const message = input as Partial<AiConversationMessage>;
  if (typeof message.id !== 'string' || !message.id) return null;
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  if (typeof message.content !== 'string') return null;
  const createdAt = typeof message.createdAt === 'string' ? message.createdAt : new Date(0).toISOString();
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt,
    updatedAt: typeof message.updatedAt === 'string' ? message.updatedAt : createdAt,
    status: message.status,
    citations: message.citations,
    diagnostics: message.diagnostics,
    model: message.model,
  };
}

function findLastAssistantIndex(messages: AiConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') return index;
  }
  return -1;
}

function deriveConversationTitle(content: string) {
  const firstLine = content.split(/\n/)[0]?.trim() ?? UNTITLED_CONVERSATION;
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}...` : firstLine;
}

function getNow(options: HistoryOptions) {
  return options.now?.() ?? new Date().toISOString();
}

function getId(options: HistoryOptions) {
  return options.idFactory?.() ?? `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

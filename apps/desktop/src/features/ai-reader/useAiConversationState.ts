import { useEffect, useMemo, useRef, useState } from 'react';
import type { Translator } from '../../i18n';
import { getReaderRecord, parseReaderRecord, saveReaderRecord } from '../../services/readerStorageService';
import type { AiDiagnostics, Citation } from '../../types';
import {
  appendAssistantMessage,
  appendUserMessage,
  createAiConversationHistory,
  deleteConversation,
  deleteConversationMessage,
  getActiveConversation,
  normalizeAiConversationHistory,
  pinConversation,
  renameConversation,
  startNewConversation,
  switchConversation,
  upsertAssistantMessageForConversation,
  type AiConversationHistoryState,
} from './aiConversationHistory';

type AiConversationStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';

type UseAiConversationStateInput = {
  bookId: string;
  answer: string;
  status: AiConversationStatus;
  saveStatus: string;
  citations: Citation[];
  diagnostics?: AiDiagnostics;
  model: string;
  t: Translator;
};

export function useAiConversationState({ bookId, answer, status, saveStatus, citations, diagnostics, model, t }: UseAiConversationStateInput) {
  const historyOptions = { untitledConversation: t('ai.history.new') };
  const [conversationHistory, setConversationHistory] = useState<AiConversationHistoryState>(() => createAiConversationHistory(historyOptions));
  const [conversationHistoryReady, setConversationHistoryReady] = useState(() => !bookId || bookId === 'demo-ai-research-desk');
  const activeAssistantRef = useRef<{ conversationId: string; messageId: string } | null>(null);
  const historyLoadedBookIdRef = useRef<string | null>(null);
  const activeConversation = useMemo(() => getActiveConversation(conversationHistory), [conversationHistory]);

  useEffect(() => {
    activeAssistantRef.current = null;
    setConversationHistoryReady(false);
    if (!bookId || bookId === 'demo-ai-research-desk') {
      historyLoadedBookIdRef.current = bookId || null;
      setConversationHistory(createAiConversationHistory(historyOptions));
      setConversationHistoryReady(true);
      return;
    }
    let disposed = false;
    void getReaderRecord(bookId, 'aiConversationHistory')
      .then((record) => {
        if (!disposed) setConversationHistory(normalizeAiConversationHistory(parseReaderRecord(record, null), historyOptions));
      })
      .catch(() => {
        if (!disposed) setConversationHistory(createAiConversationHistory(historyOptions));
      })
      .finally(() => {
        if (!disposed) {
          historyLoadedBookIdRef.current = bookId;
          setConversationHistoryReady(true);
        }
      });
    return () => { disposed = true; };
  }, [bookId, t]);

  useEffect(() => {
    if (!bookId || bookId === 'demo-ai-research-desk') return;
    if (historyLoadedBookIdRef.current !== bookId) return;
    const handle = window.setTimeout(() => {
      void saveReaderRecord(bookId, 'aiConversationHistory', conversationHistory, 'ai-research-desk').catch(() => undefined);
    }, 240);
    return () => window.clearTimeout(handle);
  }, [bookId, conversationHistory]);

  useEffect(() => {
    if (!activeAssistantRef.current) return;
    if (!answer.trim() && (status === 'loading' || status === 'streaming')) return;
    if (!answer.trim() && status !== 'error' && status !== 'no-result' && status !== 'no-index') return;
    const activeAssistant = activeAssistantRef.current;
    const assistantStatus = status === 'error' ? 'error' : status === 'loading' || status === 'streaming' ? 'streaming' : 'ready';
    setConversationHistory((current) => upsertAssistantMessageForConversation(current, activeAssistant.conversationId, answer || saveStatus || t(`ai.status.${status}`), {
      messageId: activeAssistant.messageId,
      status: assistantStatus,
      citations,
      diagnostics,
      model,
    }));
    if (status === 'ready' || status === 'error' || status === 'no-result' || status === 'no-index') activeAssistantRef.current = null;
  }, [answer, status, saveStatus, citations, diagnostics, model, t]);

  function updateConversationHistory(updater: (history: AiConversationHistoryState) => AiConversationHistoryState) {
    setConversationHistory((current) => updater(current));
  }

  function resetConversationHistory() {
    activeAssistantRef.current = null;
    setConversationHistory(createAiConversationHistory(historyOptions));
  }

  function createNewConversation() {
    activeAssistantRef.current = null;
    updateConversationHistory((current) => startNewConversation(current, historyOptions));
  }

  function selectConversation(conversationId: string) {
    updateConversationHistory((current) => switchConversation(current, conversationId));
  }

  function updateConversationTitle(conversationId: string, title: string) {
    updateConversationHistory((current) => renameConversation(current, conversationId, title, historyOptions));
  }

  function removeConversation(conversationId: string) {
    if (activeAssistantRef.current?.conversationId === conversationId) activeAssistantRef.current = null;
    updateConversationHistory((current) => deleteConversation(current, conversationId, historyOptions));
  }

  function removeConversationMessage(conversationId: string, messageId: string) {
    if (activeAssistantRef.current?.conversationId === conversationId && activeAssistantRef.current.messageId === messageId) activeAssistantRef.current = null;
    updateConversationHistory((current) => deleteConversationMessage(current, conversationId, messageId));
  }

  function updateConversationPinned(conversationId: string, pinned: boolean) {
    updateConversationHistory((current) => pinConversation(current, conversationId, pinned));
  }

  function beginAssistantRequest(input: { displayPrompt?: string; pendingLabel: string; includeUserMessage: boolean }) {
    const pendingAssistantId = createAiConversationId();
    const pendingConversationId = conversationHistory.activeConversationId;
    setConversationHistory((current) => {
      const withUser = input.includeUserMessage ? appendUserMessage(current, input.displayPrompt ?? '', historyOptions) : current;
      return appendAssistantMessage(withUser, input.pendingLabel, { messageId: pendingAssistantId, status: 'pending', model });
    });
    activeAssistantRef.current = { conversationId: pendingConversationId, messageId: pendingAssistantId };
  }

  return {
    activeConversation,
    conversationHistory,
    conversationHistoryReady,
    updateConversationHistory,
    resetConversationHistory,
    createNewConversation,
    selectConversation,
    updateConversationTitle,
    removeConversation,
    removeConversationMessage,
    updateConversationPinned,
    beginAssistantRequest,
  };
}

function createAiConversationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

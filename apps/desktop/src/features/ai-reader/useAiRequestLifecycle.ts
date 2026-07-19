import { useEffect, useRef } from 'react';
import type { AiAskRequest } from '../../types';

type UseAiRequestLifecycleInput = {
  isGenerating: boolean;
  resolveConversationContext: (prompt: string) => Promise<string | null>;
  buildRequest: (prompt: string, options: { conversationContext: string }) => AiAskRequest | null;
  buildDisplayPrompt: (prompt: string) => string;
  beginAssistantRequest: (input: { displayPrompt?: string; pendingLabel: string; includeUserMessage: boolean }) => void;
  clearSubmittedComposerDraft: () => void;
  onAsk: (request: AiAskRequest) => void;
  onRetry: (request: AiAskRequest) => void;
  onStop: () => void;
  searchingEvidenceLabel: string;
  regeneratingLabel: string;
};

type AiSubmitOptions = {
  displayPrompt?: string;
};

export function useAiRequestLifecycle({
  isGenerating,
  resolveConversationContext,
  buildRequest,
  buildDisplayPrompt,
  beginAssistantRequest,
  clearSubmittedComposerDraft,
  onAsk,
  onRetry,
  onStop,
  searchingEvidenceLabel,
  regeneratingLabel,
}: UseAiRequestLifecycleInput) {
  const dispatchInFlightRef = useRef(false);

  useEffect(() => {
    if (!isGenerating) dispatchInFlightRef.current = false;
  }, [isGenerating]);

  async function submit(prompt: string, options: AiSubmitOptions = {}) {
    await dispatch(prompt, false, options);
  }

  async function retry(prompt: string) {
    await dispatch(prompt, true);
  }

  function stop() {
    dispatchInFlightRef.current = false;
    onStop();
  }

  async function dispatch(prompt: string, isRetry: boolean, options: AiSubmitOptions = {}) {
    if (isGenerating || dispatchInFlightRef.current) return;
    dispatchInFlightRef.current = true;
    const conversationContext = await resolveConversationContext(prompt);
    if (conversationContext === null) {
      dispatchInFlightRef.current = false;
      return;
    }
    const request = buildRequest(prompt, { conversationContext });
    if (!request) {
      dispatchInFlightRef.current = false;
      return;
    }
    beginAssistantRequest(isRetry
      ? { pendingLabel: regeneratingLabel, includeUserMessage: false }
      : { displayPrompt: options.displayPrompt ?? buildDisplayPrompt(prompt), pendingLabel: searchingEvidenceLabel, includeUserMessage: true });
    if (!isRetry) clearSubmittedComposerDraft();
    (isRetry ? onRetry : onAsk)(request);
  }

  return { submit, retry, stop };
}

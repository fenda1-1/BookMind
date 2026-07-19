import { useMemo } from 'react';
import { createMessageAnchor, type MessageAnchor } from './messageAnchors';

/**
 * Collect user-submitted messages into a timeline data structure.
 * Only records user messages — does not include assistant/system/tool messages.
 */
export function useUserMessageTimeline(messages: Array<{ role: string; content: string; bookId?: string | null; timestamp?: number }>): MessageAnchor[] {
  return useMemo(() => {
    return messages
      .filter((msg) => msg.role === 'user')
      .map((msg) => createMessageAnchor({
        bookId: msg.bookId,
        text: msg.content,
        timestamp: msg.timestamp,
      }));
  }, [messages]);
}

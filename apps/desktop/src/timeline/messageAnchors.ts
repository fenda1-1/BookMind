/**
 * Message anchor contract for user message timeline.
 *
 * Each user-submitted message gets a stable anchor that survives answer streaming and UI re-renders.
 * Anchors are embedded into the rendered DOM as data attributes so the timeline panel can scroll to them.
 */

export type MessageAnchorId = string;

export type MessageAnchor = {
  /** Stable unique id, generated once when the user submits the message */
  id: MessageAnchorId;
  /** The user's message text (first 200 chars for timeline preview) */
  preview: string;
  /** ISO timestamp of when the user submitted the message */
  createdAt: string;
  /** The book id this message was sent in context of (may be null for no-book sessions) */
  bookId: string | null;
  /** DOM selector target for scroll-to — the rendered element's data attribute value */
  domTarget: string;
};

/** DOM attribute name used on rendered user message elements */
export const MESSAGE_ANCHOR_ATTR = 'data-message-anchor';

/**
 * Generate a stable message anchor id.
 * Idempotent: same inputs produce the same id (for dedup in re-renders).
 */
export function generateMessageAnchorId(input: { bookId?: string | null; text: string; timestamp: number }): MessageAnchorId {
  const key = `${input.bookId ?? 'no-book'}::${input.text.slice(0, 80)}::${input.timestamp}`;
  // Simple stable hash — avoids crypto dependency for this contract
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `msg-${Math.abs(hash).toString(36)}`;
}

/**
 * Build a DOM anchor string for use as the data attribute value on a rendered user message element.
 */
export function buildMessageAnchorDomTarget(anchorId: MessageAnchorId): string {
  return anchorId;
}

/**
 * Resolve the DOM element for a given anchor id.
 * Returns null if the element is not currently in the DOM.
 */
export function resolveMessageAnchorElement(anchorId: MessageAnchorId): HTMLElement | null {
  return document.querySelector(`[${MESSAGE_ANCHOR_ATTR}="${anchorId}"]`);
}

/**
 * Scroll the viewport to the message anchor element.
 * Returns true if the element was found and scrolled to.
 */
export function scrollToMessageAnchor(anchorId: MessageAnchorId): boolean {
  const element = resolveMessageAnchorElement(anchorId);
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

/**
 * Create a message anchor from a user-submitted message.
 */
export function createMessageAnchor(params: {
  bookId?: string | null;
  text: string;
  timestamp?: number;
}): MessageAnchor {
  const now = params.timestamp ?? Date.now();
  const id = generateMessageAnchorId({ bookId: params.bookId, text: params.text, timestamp: now });
  return {
    id,
    preview: params.text.slice(0, 200),
    createdAt: new Date(now).toISOString(),
    bookId: params.bookId ?? null,
    domTarget: buildMessageAnchorDomTarget(id),
  };
}

import { UserMessageTimeline } from '../../timeline/UserMessageTimeline';
import { useUserMessageTimeline } from '../../timeline/useUserMessageTimeline';
import type { MessageAnchor } from '../../timeline/messageAnchors';

type ReaderTimelinePanelProps = {
  /** Messages from the current reader AI conversation.
   *  Only user-role messages are displayed (assistant/system/tool are filtered). */
  messages: Array<{ role: string; content: string; bookId?: string | null; timestamp?: number }>;
  /** If true, clicking a timeline entry scrolls to the corresponding user message */
  scrollOnClick?: boolean;
};

/**
 * Reader workspace side panel that displays a timeline of user-submitted messages.
 * Intended to be placed alongside the existing AI and Settings side panels.
 */
export function ReaderTimelinePanel({ messages, scrollOnClick = true }: ReaderTimelinePanelProps) {
  const anchors = useUserMessageTimeline(messages);

  return (
    <div className="reader-timeline-panel" role="complementary" aria-label="用户消息时间线">
      <header className="reader-panel-header">
        <h3>消息时间线</h3>
      </header>
      <UserMessageTimeline anchors={anchors} scrollOnClick={scrollOnClick} />
    </div>
  );
}

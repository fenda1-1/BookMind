import { MESSAGE_ANCHOR_ATTR, scrollToMessageAnchor, type MessageAnchor } from './messageAnchors';

type UserMessageTimelineProps = {
  anchors: MessageAnchor[];
  /** If true, clicking a timeline entry scrolls to the message position */
  scrollOnClick?: boolean;
};

/**
 * Renders a timeline of user-submitted messages.
 * Clicking an entry scrolls to the corresponding message in the conversation.
 */
export function UserMessageTimeline({ anchors, scrollOnClick = true }: UserMessageTimelineProps) {
  if (!anchors.length) {
    return (
      <div className="timeline-empty" role="status">
        <p>暂无用户消息</p>
      </div>
    );
  }

  function handleClick(anchor: MessageAnchor) {
    if (!scrollOnClick) return;
    scrollToMessageAnchor(anchor.id);
  }

  return (
    <nav className="user-message-timeline" aria-label="用户消息时间线">
      <ul className="timeline-list">
        {anchors.map((anchor) => (
          <li key={anchor.id} className="timeline-entry">
            <button
              type="button"
              className="timeline-entry-btn"
              onClick={() => handleClick(anchor)}
              title={anchor.preview}
            >
              <time dateTime={anchor.createdAt} className="timeline-time">
                {formatTimelineTime(anchor.createdAt)}
              </time>
              <span className="timeline-preview">{anchor.preview || '(空消息)'}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function formatTimelineTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

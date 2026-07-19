import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');
const toolbar = readFileSync(new URL('./AiReaderPanelToolbar.tsx', import.meta.url), 'utf8');
const messageList = readFileSync(new URL('./AiConversationMessageList.tsx', import.meta.url), 'utf8');
const iconTypes = readFileSync(new URL('../../components/bookMindIconTypes.ts', import.meta.url), 'utf8');
const icons = readFileSync(new URL('../../components/BookMindIcon.tsx', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../i18n/en-US.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/styles/settings.css', import.meta.url), 'utf8');

assert.match(iconTypes, /'aiTimeline'/u, 'BookMind icon names should include a dedicated AI timeline icon');
assert.match(icons, /case 'aiTimeline':/u, 'BookMindIcon should render the AI timeline icon');

assert.match(panel, /const \[questionTimelineOpen, setQuestionTimelineOpen\]/u, 'AI reader should track the question timeline popover');
assert.match(panel, /activeQuestionTimelineItems/u, 'AI reader should derive timeline items from the active conversation');
assert.match(panel, /message\.role === 'user'/u, 'AI reader timeline should list user questions only');
assert.match(toolbar, /BookMindIcon name="aiTimeline"/u, 'AI reader toolbar should include the timeline icon button');
assert.match(toolbar, /ai-question-timeline-popover/u, 'AI reader toolbar should render a question timeline popover');
assert.match(panel, /<AiReaderPanelToolbar/u, 'AI reader panel should compose the extracted toolbar presentation component');
assert.match(toolbar, /onJumpToMessage\(item\.id\)/u, 'Clicking a timeline question should jump to that message');
assert.match(panel, /document\.getElementById\(`ai-message-\$\{messageId\}`\)/u, 'Jumping should target stable message DOM ids');
assert.match(panel, /setHighlightedTimelineMessageId\(messageId\)/u, 'Jumping should briefly highlight the target message');

assert.match(messageList, /highlightedMessageId\?: string \| null/u, 'Message list should accept a highlighted message id');
assert.match(messageList, /id=\{`ai-message-\$\{message\.id\}`\}/u, 'Each message should expose a stable DOM id');
assert.match(messageList, /message\.id === highlightedMessageId/u, 'Message list should highlight the target timeline message');

assert.match(zh, /'ai\.toolbar\.timeline': '提问时间线'/u, 'Chinese locale should label the question timeline toolbar button');
assert.match(en, /'ai\.toolbar\.timeline': 'Question timeline'/u, 'English locale should label the question timeline toolbar button');
assert.match(styles, /\.ai-question-timeline-popover/u, 'Question timeline popover should have dedicated styles');
assert.match(styles, /\.ai-question-timeline-popover \{[^}]*right:\s*0/u, 'Question timeline popover should align to the panel edge instead of drifting outside the card');
assert.match(styles, /\.ai-question-timeline-popover \{[^}]*max-height:\s*min\([^;]*calc\(100vh - 160px\)/u, 'Question timeline popover should use a viewport-safe max height');
assert.match(styles, /\.ai-question-timeline-popover \{[^}]*overflow:\s*hidden/u, 'Question timeline popover should clip itself and let the list scroll internally');
assert.match(styles, /\.ai-question-timeline-list \{[^}]*overflow-y:\s*auto/u, 'Question timeline list should scroll vertically inside the popover');
assert.match(styles, /\.ai-question-timeline-list \{[^}]*overscroll-behavior:\s*contain/u, 'Question timeline list should keep wheel scrolling inside the popover');
assert.match(styles, /\.ai-conversation-message\.timeline-highlight/u, 'Jumped message should have a visible temporary highlight');

console.log('Verified AI reader question timeline contract.');

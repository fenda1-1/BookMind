import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const renderer = readFileSync('src/features/ai-reader/AiStructuredSectionRenderers.tsx', 'utf8');
const styles = readFileSync('src/app/styles/settings.css', 'utf8');

assert.match(renderer, /case 'agent_timeline'/, 'structured renderer should have a dedicated Agent timeline block renderer');
assert.match(renderer, /AgentTimelineBlock/, 'structured renderer should render Agent timeline blocks with a dedicated component');
assert.match(renderer, /isRuntimeAgentTimeline/, 'Agent timeline renderer should distinguish runtime loops from legacy static traces');
assert.match(renderer, /mergeAgentTimelineToolEvents/, 'Agent timeline should merge each tool request and result into one rendered tool call item');
assert.match(renderer, /event-tool_exchange/, 'Merged Agent tool calls should use a dedicated event type for styling');
assert.match(renderer, /请求数据/, 'Merged Agent tool calls should expose request arguments separately');
assert.match(renderer, /结果数据/, 'Merged Agent tool calls should expose result payload separately');
assert.match(renderer, /InlineMarkdownText/, 'Agent final paragraph rendering should parse inline Markdown instead of showing raw markers');
assert.match(renderer, /旧版 Agent 静态记录/, 'legacy static Agent traces should not be rendered as normal runtime execution flow');
assert.match(styles, /\.ai-agent-timeline/, 'Agent timeline should have dedicated paper-geometry styling');
assert.match(styles, /\.ai-agent-timeline\.legacy/, 'legacy Agent timeline should have a distinct compatibility style');
assert.match(styles, /\.ai-agent-timeline \.event-model_decision/u, 'Agent model decision events should have a distinct configurable color');
assert.match(styles, /\.ai-agent-timeline \.event-tool_exchange/u, 'Merged Agent tool events should have a distinct configurable color');
assert.match(styles, /\.ai-agent-timeline \.event-final/u, 'Agent final events should have a distinct configurable color');
assert.doesNotMatch(styles, /\.ai-agent-timeline \.agent-event strong \{[^}]*display:\s*block/u, 'Agent timeline Markdown bold text inside event content must remain inline');
assert.match(styles, /\.ai-agent-timeline \.agent-event > div > strong \{[^}]*display:\s*block/u, 'Agent timeline event title should keep block styling without affecting Markdown bold text');
assert.doesNotMatch(styles, /\.ai-agent-timeline \.agent-event \{[^}]*grid-template-columns:\s*28px minmax\(0,1fr\) auto/u, 'Agent timeline status badge must not reserve a full right-side grid column');
assert.doesNotMatch(styles, /\.ai-agent-timeline \.agent-event \{[^}]*padding-right:\s*7[0-9]px/u, 'Agent timeline card must not reserve right-side status space for the entire card height');
assert.doesNotMatch(styles, /\.ai-agent-timeline \.agent-event strong,\s*\.ai-agent-timeline \.agent-event p \{[^}]*padding-right:/u, 'Agent timeline title/body text must not reserve a right-side status column');
assert.match(styles, /\.ai-agent-timeline \.agent-event > em \{[^}]*position:\s*absolute/u, 'Agent timeline status badge should float at the card top-right instead of consuming layout width');
assert.match(styles, /\.ai-agent-timeline \.agent-event details \{[^}]*grid-column:\s*1 \/ -1/u, 'Agent timeline details should occupy full content width below the status badge');
assert.doesNotMatch(renderer, /case 'agent_timeline'[\s\S]{0,220}renderBlockPlainText/, 'Agent timeline should not fall back to plain paragraph rendering');

console.log('Verified Agent timeline renderer contract.');

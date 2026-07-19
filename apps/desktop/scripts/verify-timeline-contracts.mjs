import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// ---- messageAnchors.ts (500) ----
const messageAnchorsPath = 'src/timeline/messageAnchors.ts';
assert.ok(existsSync(messageAnchorsPath), 'message anchor contract must live in timeline/messageAnchors.ts');
const messageAnchors = readFileSync(messageAnchorsPath, 'utf8');

assert.match(messageAnchors, /export type MessageAnchorId/, 'message anchors must export MessageAnchorId type');
assert.match(messageAnchors, /export type MessageAnchor/, 'message anchors must export MessageAnchor type');
assert.match(messageAnchors, /export function generateMessageAnchorId/, 'message anchors must export idempotent id generator');
assert.match(messageAnchors, /export function createMessageAnchor/, 'message anchors must export anchor factory');
assert.match(messageAnchors, /export function scrollToMessageAnchor/, 'message anchors must export scroll-to function');
assert.match(messageAnchors, /export function resolveMessageAnchorElement/, 'message anchors must export DOM resolver');
assert.match(messageAnchors, /MESSAGE_ANCHOR_ATTR/, 'message anchors must define the DOM attribute name');
assert.match(messageAnchors, /data-message-anchor/, 'message anchors must use data-message-anchor as the DOM attribute');

// Contract: anchors must be idempotent (same inputs = same id)
assert.match(messageAnchors, /bookId.*text.*timestamp/, 'message anchor id must derive from bookId, text, and timestamp');
// Contract: only user messages (bookId + text pattern, not assistant/system/tool)
assert.match(messageAnchors, /preview:.*text\.slice/, 'message anchors must store a preview of the user message text');

// ---- useUserMessageTimeline.ts (501) ----
const useTimelinePath = 'src/timeline/useUserMessageTimeline.ts';
assert.ok(existsSync(useTimelinePath), 'user message timeline data must live in timeline/useUserMessageTimeline');
const useTimeline = readFileSync(useTimelinePath, 'utf8');
assert.match(useTimeline, /filter.*role === 'user'/, 'timeline hook must only collect user messages, not assistant/system/tool');
assert.match(useTimeline, /createMessageAnchor/, 'timeline hook must use the message anchor factory');

// ---- UserMessageTimeline.tsx (502) ----
const timelineUiPath = 'src/timeline/UserMessageTimeline.tsx';
assert.ok(existsSync(timelineUiPath), 'user message timeline UI must live in timeline/UserMessageTimeline');
const timelineUi = readFileSync(timelineUiPath, 'utf8');
assert.match(timelineUi, /scrollToMessageAnchor/, 'timeline UI must wire click-to-scroll behavior');
assert.match(timelineUi, /user-message-timeline/, 'timeline UI must render user message timeline');

console.log('Verified timeline architecture contracts.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../../app/appAiSessionActions.ts', import.meta.url), 'utf8');
const loop = readFileSync(new URL('../../app/agentLoopModel.ts', import.meta.url), 'utf8');
const types = readFileSync(new URL('../../types.ts', import.meta.url), 'utf8');

assert.match(types, /conversationContext\?: string;/u, 'AiAskRequest should carry conversation context');
assert.match(panel, /const activeConversationContext = useMemo\(\(\) => formatAiConversationContext\(activeConversation, interactionMode === 'agent' \? agentPresetPrompt : ''\)/u, 'Reader panel should derive context from active conversation state and the Agent preset');
assert.match(panel, /activeConversationContext, question, selectedSlashCommand\?\.prompt, attachments\.join\('\\n'\)/u, 'Agent token estimate should include active conversation context');
assert.match(panel, /conversationContext: redactCloudText\(options\.conversationContext \?\? activeConversationContext\)/u, 'AI request should include active conversation context');
assert.match(panel, /function formatAiConversationContext/u, 'Reader panel should format bounded conversation context');
assert.match(panel, /contextCompression/u, 'Reader panel should support compressed conversation context');
assert.match(panel, /function buildAiContextCompressionInstruction/u, 'Reader panel should define a dedicated compression instruction');
assert.match(panel, /function compressActiveConversationContext/u, 'Reader panel should provide manual and automatic context compression');
assert.match(panel, /agentContextCompressionThreshold/u, 'Reader panel should expose a configurable compression threshold');
assert.match(panel, /AGENT_CONTEXT_COMPRESSION_RESERVE_TOKENS = 16000/u, 'Default compression threshold should reserve 16k tokens from the model context window');
assert.match(panel, /function resolveDefaultAgentContextCompressionThreshold/u, 'Reader panel should derive the default compression threshold from the current model context window');
assert.match(panel, /setAgentCompressionPreviewOpen\(true\)/u, 'Reader panel should let users preview the compressed context');
assert.match(panel, /ai-agent-compression-preview/u, 'Reader panel should render a compressed context preview overlay');
assert.match(panel, /restoreConversationContextCompression/u, 'Reader panel should allow restoring a previous compressed context version');
assert.match(panel, /activeCompressionHistory/u, 'Reader panel should render compression version history');
assert.match(panel, /ai-agent-compression-diff/u, 'Reader panel should show compression before/after diff panes');
assert.match(panel, /applyConversationContextCompression/u, 'Reader panel should replace sent context with compressed context');
assert.match(actions, /confirmation-required/u, 'Agent runtime should pause unsafe tool calls for user confirmation');
assert.match(actions, /isAgentUnsafeToolConfirmed/u, 'Agent runtime should require explicit user confirmation for unsafe tools');
assert.match(actions, /agentPendingConfirmation/u, 'Agent diagnostics should expose pending confirmation details');
assert.match(types, /agentTaskGoal\?: string/u, 'AI diagnostics should carry the Agent task goal');
assert.match(types, /agentTaskCompleted\?: string\[\]/u, 'AI diagnostics should carry completed Agent task items');
assert.match(types, /agentPendingConfirmation/u, 'AI diagnostics should carry pending confirmation metadata');
assert.match(loop, /conversationContext\?: string/u, 'Agent decision instruction should accept conversation context');
assert.match(loop, /当前对话历史上下文/u, 'Agent decision instruction should label conversation history');
assert.match(actions, /conversationContext: effectiveAiRequest\.conversationContext/u, 'Agent runtime should pass conversation context into decision instructions');

console.log('Verified AI reader sends active conversation context to Agent requests.');

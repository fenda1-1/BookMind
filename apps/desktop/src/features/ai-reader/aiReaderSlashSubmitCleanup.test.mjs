import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');
const lifecycle = readFileSync(new URL('./useAiRequestLifecycle.ts', import.meta.url), 'utf8');

assert.match(source, /function clearSubmittedComposerDraft\(\)/u, 'AI reader panel should centralize composer cleanup after submit');
assert.match(source, /function clearSubmittedComposerDraft\(\) \{[\s\S]*setQuestion\(''\)[\s\S]*setSelectedSlashCommand\(null\)[\s\S]*setSlashMenuOpen\(false\)[\s\S]*setSlashDetailCommand\(null\)[\s\S]*setActiveSlashIndex\(0\)[\s\S]*\}/u, 'Composer cleanup should clear slash command selection, menu state, and input text');
assert.match(source, /useAiRequestLifecycle\(/u, 'AI reader panel should delegate request dispatch to the request lifecycle hook');
assert.match(lifecycle, /clearSubmittedComposerDraft\(\);[\s\S]*\(isRetry \? onRetry : onAsk\)\(request\);/u, 'Submitting a prompt should clear the selected slash command before dispatching the request');

console.log('Verified AI slash submit cleanup.');

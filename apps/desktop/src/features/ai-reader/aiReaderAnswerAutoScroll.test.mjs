import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('src/features/ai-reader/AiReaderPanel.tsx', 'utf8');

assert.match(panel, /aiAnswerStreamRef\s*=\s*useRef/u, 'AI answer stream should keep a ref to the scroll container');
assert.match(panel, /shouldAutoScrollAnswerRef\s*=\s*useRef\(true\)/u, 'AI answer stream should default to following generated output');
assert.match(panel, /handleAnswerStreamScroll/u, 'AI answer stream should detect when the user scrolls away from the bottom');
assert.match(panel, /scrollHeight\s*-\s*scrollTop\s*-\s*clientHeight/u, 'AI answer stream should use bottom distance to decide whether auto-follow is active');
assert.match(panel, /aiAnswerStreamRef\.current\.scrollTo/u, 'AI answer stream should scroll to the bottom when new output arrives');
assert.match(panel, /<div className="ai-answer-stream" ref=\{aiAnswerStreamRef\} onScroll=\{handleAnswerStreamScroll\}>/u, 'AI answer stream should bind the ref and scroll handler to the actual scroll container');

console.log('Verified AI reader answer auto-scroll contract.');

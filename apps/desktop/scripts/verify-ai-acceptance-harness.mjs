import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/acceptance-ai-research-desk.mjs', 'utf8');

function requirePattern(pattern, message) {
  assert.match(source, pattern, message);
}

requirePattern(
  /function tauriPrelude\(\)[\s\S]*__BOOKMIND_ACCEPTANCE_PENDING__[\s\S]*__BOOKMIND_ACCEPTANCE_BINDING__[\s\S]*__TAURI_INTERNALS__/,
  'acceptance harness must install the full invoke promise bridge before app navigation',
);

requirePattern(
  /parsed\.stream\s*!==\s*true[\s\S]*application\/json[\s\S]*return;[\s\S]*text\/event-stream/,
  'mock Responses endpoint must return JSON for test connections before streaming cloud answer requests',
);

requirePattern(
  /['"]?output_text['"]?\s*:\s*['"]pong['"]/,
  'mock Responses endpoint must return JSON output_text pong for the non-streaming test connection',
);

requirePattern(
  /force_local_no_result/,
  'acceptance harness must force a local no-result path for a real diagnostic panel screenshot',
);

requirePattern(
  /error-diagnostics\.png/,
  'acceptance harness must save a dedicated error-diagnostics.png screenshot',
);

requirePattern(
  /node_modules\/vite\/bin\/vite\.js[\s\S]*--port[\s\S]*String\(vitePort\)[\s\S]*--strictPort/,
  'acceptance harness must start Vite directly through its JS entry on the acceptance port with strictPort',
);

console.log('AI research desk acceptance harness contracts passed.');

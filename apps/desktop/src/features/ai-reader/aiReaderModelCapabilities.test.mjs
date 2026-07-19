import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');

assert.match(source, /function renderReaderAiModelCapabilityIcons/);
assert.match(source, /className="ai-model-capability-icons"/);
assert.match(source, /model\.capabilities\.vision/);
assert.match(source, /model\.capabilities\.reasoning/);
assert.match(source, /model\.capabilities\.toolUse/);
assert.match(source, /renderReaderAiModelCapabilityIcons\(model\.settings,\s*t\)/);
assert.match(source, /renderReaderAiModelCapabilityIcons\(currentAiModelConfig,\s*t\)/);

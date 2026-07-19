import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');

assert.match(source, /setInteractionMode\(mode\);\s*setModePopoverOpen\(false\);/);
assert.match(source, /renderAiModeOptionIcon\(option\.value\)/);
assert.match(source, /t\('ai\.mode\.title'\)/);
assert.match(source, /t\('ai\.mode\.subtitle'\)/);
assert.match(source, /t\('ai\.agentToolbox\.expand'\)/);
assert.match(source, /t\('ai\.model\.title'\)/);
assert.match(source, /t\('ai\.model\.manage'\)/);
assert.match(source, /t\('ai\.toolbar\.newChat'\)/);
assert.match(source, /t\('ai\.attachment\.title'\)/);
assert.doesNotMatch(source, /<strong>问答模式<\/strong>/);
assert.doesNotMatch(source, /展开工具箱/);
assert.doesNotMatch(source, /AI 模型<\/strong>/);

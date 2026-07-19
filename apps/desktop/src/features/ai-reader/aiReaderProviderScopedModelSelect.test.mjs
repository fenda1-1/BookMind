import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app/App.tsx', import.meta.url), 'utf8');

assert.match(panel, /onSelectAiModel\?: \(providerId: string, model: string\) => Promise<void> \| void;/u);
assert.match(panel, /onSelectAiModel\?\.\(group\.providerId, model\.id\)/u);
assert.doesNotMatch(panel, /onSelectAiModel\?\.\(model\.id\)/u);
assert.match(panel, /const models = \[profile\.model, \.\.\.\(profile\.models \?\? \[\]\)\]/u);
assert.doesNotMatch(panel, /const models = \[profile\.model, \.\.\.\(profile\.models \?\? \[\]\), settings\?\.aiModel \?\? ''\]/u);

assert.match(app, /async function selectAiModelForReader\(providerId: string, model: string\)/u);
assert.match(app, /profiles\.find\(\(profile\) => profile\.id === providerId\)/u);
assert.doesNotMatch(app, /const activeProfile = profiles\.find\(\(profile\) => profile\.id === currentSettings\.aiActiveProviderProfileId\)/u);

console.log('Verified reader AI model selection is scoped to the clicked provider.');

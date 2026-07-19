import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/pages/SettingsAiPanel.tsx', 'utf8');

assert.match(source, /modelSettingsDraft/);
assert.match(source, /setModelSettingsDraft/);
assert.match(source, /saveModelSettingsDraft/);
assert.match(source, /cancelModelSettingsDraft/);
assert.match(source, /<ThemedSelect\s+label=\{t\('settings\.aiPanel\.modelSettings\.modelType'\)\}/);
assert.doesNotMatch(source, /<select\s+className="settings-inline-input"\s+value=\{editingModelConfig\.type\}/);
assert.match(source, /onClick=\{cancelModelSettingsDraft\}>\{t\('settings\.common\.cancel'\)\}<\/button>/);
assert.match(source, /onClick=\{\(\) => \{ void saveModelSettingsDraft\(\); \}\}>\{t\('settings\.common\.save'\)\}<\/button>/);
assert.match(source, /settings-ai-model-capability-icons/);
assert.match(source, /updateModelSettingsDraft\(\{\s*capabilities:/);
assert.match(source, /updateAiProviderModelSettings\(activeAiProviderProfile\.id,\s*next\)/);
assert.match(source, /onChange=\{\(event\) => updateModelSettingsDraft\(\{ displayName: event\.target\.value \}\)\}/);
assert.doesNotMatch(
  source,
  /function updateModelSettingsDraft[\s\S]*return normalizeAiProviderModelSettings/u,
  'model settings draft editing must not auto-normalize every keystroke because clearing a field would instantly refill it',
);
assert.doesNotMatch(source, /modelSettings\.saved/);

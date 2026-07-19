import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readerSettings = readFileSync('src/features/reader-core/readerSettings.ts', 'utf8');
const actions = readFileSync('src/app/appAiSessionActions.ts', 'utf8');
const workspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');

assert.match(readerSettings, /readerApplySettingsNowEvent/u, 'Reader settings should expose an immediate apply event for Agent mutations');
assert.match(actions, /readerApplySettingsNowEvent/u, 'Agent settings tool should dispatch the immediate apply event after saving settings');
assert.match(actions, /window\.dispatchEvent\(new CustomEvent\(readerApplySettingsNowEvent/u, 'Agent settings tool should notify the active reader window immediately');
assert.match(workspace, /window\.addEventListener\(readerApplySettingsNowEvent/u, 'Reader workspace should listen for immediate Agent setting applications');
assert.match(workspace, /markReaderStateChanged\(\)[\s\S]{0,260}setSettings\(normalizeReaderSettings/u, 'Reader workspace should apply Agent settings to current reader state, not only global defaults');

console.log('Verified Agent reader settings immediate apply contract.');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-translation-settings-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterTranslationModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const model = require(join(outDir, 'features', 'settings-center', 'settingsCenterTranslationModel.js'));
const profile = {
  id: 'provider-a', name: 'Provider A', kind: 'openai-compatible', enabled: true,
  apiBaseUrl: 'https://example.com/v1', apiKey: 'secret', endpointMode: 'chat.completions', model: 'model-a',
};
const settings = model.normalizeTranslationSettings({
  trashRetentionDays: 30,
  aiProviderProfiles: [profile],
  translationActiveSourceId: 'missing',
  translationSourceLanguage: 'invalid',
  translationTargetLanguage: 'auto',
  translationSources: [
    { id: 'ai', name: 'AI', kind: 'ai-model', enabled: true, providerId: profile.id, model: 'model-a' },
    { id: 'api', name: 'API', kind: 'libretranslate', enabled: true, apiBaseUrl: 'https://translate.example.com/', apiKey: '', requestTimeoutSecs: 900 },
  ],
});

assert.equal(settings.translationActiveSourceId, 'ai', 'missing active source must resolve to the first available source');
assert.equal(settings.translationSourceLanguage, 'auto');
assert.equal(settings.translationTargetLanguage, 'zh-CN', 'auto must not be accepted as a target language');
assert.equal(settings.translationSources[1].apiBaseUrl, 'https://translate.example.com');
assert.equal(settings.translationSources[1].requestTimeoutSecs, 600);
assert.deepEqual(model.getAvailableTranslationSources(settings).map((source) => source.id), ['ai', 'api']);

const disabledProviderSettings = model.normalizeTranslationSettings({ ...settings, aiProviderProfiles: [{ ...profile, enabled: false }] });
assert.deepEqual(model.getAvailableTranslationSources(disabledProviderSettings).map((source) => source.id), ['api'], 'disabled AI providers must not remain available translation sources');
assert.equal(disabledProviderSettings.translationActiveSourceId, 'ai', 'an unavailable active source must remain explicit instead of silently falling back');

const missingProviderKeySettings = model.normalizeTranslationSettings({ ...settings, aiProviderProfiles: [{ ...profile, apiKey: '' }] });
assert.deepEqual(model.getAvailableTranslationSources(missingProviderKeySettings).map((source) => source.id), ['ai', 'api'], 'frontend availability must not reject AI sources whose credentials are held only by native secure storage');
assert.deepEqual(model.getSelectableTranslationSources(missingProviderKeySettings).map((source) => source.id), ['ai', 'api'], 'enabled sources must remain selectable so incomplete configuration is visible instead of producing an empty disabled picker');

const missingEndpointSettings = model.normalizeTranslationSettings({ ...settings, aiProviderProfiles: [{ ...profile, apiBaseUrl: '' }] });
assert.deepEqual(model.getAvailableTranslationSources(missingEndpointSettings).map((source) => source.id), ['api'], 'AI translation sources without an endpoint must remain structurally unavailable');

const activeProfile = { ...profile, id: 'provider-active', name: 'Active Provider', model: 'active-model' };
const migratedDefaultSettings = model.normalizeTranslationSettings({
  ...settings,
  aiActiveProviderProfileId: activeProfile.id,
  aiProviderProfiles: [activeProfile],
  translationActiveSourceId: 'translation-ai-default',
  translationSources: [{ id: 'translation-ai-default', name: 'AI Translation', kind: 'ai-model', enabled: true, providerId: 'openai-default', model: 'gpt-4.1-mini' }],
});
assert.equal(migratedDefaultSettings.translationSources[0].providerId, activeProfile.id, 'legacy default translation sources must follow the configured active AI provider when the hard-coded provider is absent');
assert.equal(migratedDefaultSettings.translationSources[0].model, activeProfile.model, 'provider migration must also use the active provider model');
assert.deepEqual(model.getAvailableTranslationSources(migratedDefaultSettings).map((source) => source.id), ['translation-ai-default']);

const disabledApiSettings = model.updateTranslationSource(settings, 'api', { enabled: false });
assert.deepEqual(model.getAvailableTranslationSources(disabledApiSettings).map((source) => source.id), ['ai']);
assert.match(model.getTranslationSourceLabel(settings.translationSources[0], [profile]), /AI · model-a/);

const baidu = model.createTranslationSource('baidu-translate', [profile], 'baidu');
const google = model.createTranslationSource('google-translate', [profile], 'google');
const microsoft = model.createTranslationSource('microsoft-translator', [profile], 'microsoft');
const libre = model.createTranslationSource('libretranslate', [profile], 'libre');
assert.equal(baidu.apiBaseUrl, 'https://fanyi-api.baidu.com/api/trans/vip/translate');
assert.equal(google.apiBaseUrl, 'https://translation.googleapis.com/language/translate/v2');
assert.equal(microsoft.apiBaseUrl, 'https://api.cognitive.microsofttranslator.com');
assert.equal(libre.apiBaseUrl, '', 'custom LibreTranslate sources must require an explicit endpoint');

const multiProviderSettings = model.normalizeTranslationSettings({
  ...settings,
  translationActiveSourceId: 'baidu',
  translationSources: [
    { ...baidu, appId: 'app-id', apiKey: 'baidu-secret' },
    { ...baidu, id: 'baidu-second', name: 'Baidu Backup', appId: 'backup-app', apiKey: 'backup-secret' },
    { ...google, apiKey: 'google-secret' },
    { ...microsoft, apiKey: 'microsoft-secret', region: 'eastasia' },
    { ...libre, apiBaseUrl: 'https://libre.example.com', apiKey: 'libre-secret' },
    { ...settings.translationSources[0] },
  ],
});
assert.equal(multiProviderSettings.translationSources.filter((source) => source.kind === 'baidu-translate').length, 2, 'multiple sources using the same protocol must remain independent records');
assert.deepEqual(
  model.buildTranslationSourcePickerOptions(multiProviderSettings).map(({ id, groupId }) => [id, groupId]),
  [
    ['baidu', 'api:baidu-translate'],
    ['baidu-second', 'api:baidu-translate'],
    ['google', 'api:google-translate'],
    ['microsoft', 'api:microsoft-translator'],
    ['libre', 'api:libretranslate'],
    ['ai', 'ai:provider-a'],
  ],
  'reader picker options must preserve source order and group API sources by protocol and AI sources by provider',
);

const copiedGoogle = model.copyTranslationSource({ ...google, apiKey: 'do-not-copy' }, 'google-copy');
assert.equal(copiedGoogle.id, 'google-copy');
assert.equal(copiedGoogle.apiKey, '', 'copying a provider must never copy its credential');
const afterRemoval = model.removeTranslationSource(multiProviderSettings, 'baidu');
assert.equal(afterRemoval.translationActiveSourceId, 'baidu-second', 'deleting the active source must select the next enabled source');
assert.equal(afterRemoval.translationSources.some((source) => source.id === 'baidu'), false);

const duplicateIds = model.normalizeTranslationSources([
  { ...google, id: 'duplicate' },
  { ...google, id: 'duplicate' },
], [profile]);
assert.deepEqual(duplicateIds.map((source) => source.id), ['duplicate', 'duplicate-2'], 'source IDs must remain unique for isolated secret storage');

const emptySettings = model.normalizeTranslationSettings({
  ...settings,
  translationActiveSourceId: 'ai',
  translationSources: [],
});
assert.deepEqual(emptySettings.translationSources, [], 'deleting every provider must persist an explicit empty source list');
assert.equal(emptySettings.translationActiveSourceId, '');

console.log('Verified translation source settings model.');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-ai-provider-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterAiProviderModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  createAiProviderProfileFromSettings,
  getAiProviderModelConfig,
  mergeAiProviderProfileModels,
  inferAiProviderKindForUi,
  normalizeAiProviderModelSettings,
  normalizeAiReasoningEffortForUi,
  normalizeAiProviderProfileForUi,
  normalizeAiProviderProfilesForUi,
  parseAiProviderModelInput,
  resolveAiProviderRequestSettings,
  sanitizeAiProviderCustomHeaders,
  sanitizeProviderProfileSecrets,
} = require(join(outDir, 'features/settings-center/settingsCenterAiProviderModel.js'));

assert.equal(inferAiProviderKindForUi('https://api.openai.com/v1'), 'openai');
assert.equal(inferAiProviderKindForUi('http://localhost:11434/v1'), 'local-proxy');
assert.equal(inferAiProviderKindForUi('https://gateway.example.test/v1'), 'openai-compatible');

assert.deepEqual(normalizeAiProviderProfilesForUi({
  aiApiBaseUrl: 'http://localhost:11434/v1',
  aiEndpointMode: 'chat.completions',
  aiModel: 'local-model',
  aiProxyUrl: ' http://proxy ',
  aiCustomHeaders: '{"Authorization":"secret"}',
  aiStreamingEnabled: false,
  aiRequestTimeoutSecs: 700,
  aiRetryCount: 8,
  aiTemperature: 3,
  aiMaxTokens: -1,
  aiTopP: 2,
  aiReasoningEffort: 'invalid',
  aiResponseFormat: 'xml',
}), [{
  id: 'openai-default',
  name: 'OpenAI Default',
  kind: 'local-proxy',
  enabled: true,
  apiKey: '',
  apiBaseUrl: 'http://localhost:11434/v1',
  endpointMode: 'chat.completions',
  model: 'local-model',
  models: ['local-model'],
  proxyUrl: 'http://proxy',
  customHeaders: '{"Authorization":"secret"}',
  streamingEnabled: false,
  requestTimeoutSecs: 600,
  retryCount: 5,
  temperature: 2,
  maxTokens: 0,
  topP: 1,
  reasoningEffort: 'invalid',
  responseFormat: 'auto',
  modelSettings: {
    'local-model': {
      id: 'local-model',
      displayName: 'local-model',
      type: 'chat',
      contextWindowTokens: 1050000,
      maxOutputTokens: 128000,
      capabilities: { vision: false, reasoning: false, toolUse: true },
      favorite: true,
    },
  },
}]);

assert.equal(normalizeAiReasoningEffortForUi(' xhigh '), 'xhigh');
assert.equal(normalizeAiReasoningEffortForUi('max'), 'max');
assert.equal(normalizeAiReasoningEffortForUi('provider_custom-2.0'), 'provider_custom-2.0');
assert.equal(normalizeAiReasoningEffortForUi('not allowed'), 'none');

assert.deepEqual(normalizeAiProviderProfilesForUi({
  aiApiKey: 'legacy-global-secret',
  aiProviderProfiles: [
    { id: 'provider-a', name: 'Provider A', kind: 'openai', apiBaseUrl: 'https://a.example.test/v1', endpointMode: 'responses', model: 'model-a', models: ['model-a'] },
    { id: 'provider-b', name: 'Provider B', kind: 'openai-compatible', apiKey: '', apiBaseUrl: 'https://b.example.test/v1', endpointMode: 'responses', model: 'model-b', models: ['model-b'] },
  ],
}).map(({ id, apiKey }) => ({ id, apiKey })), [
  { id: 'provider-a', apiKey: '' },
  { id: 'provider-b', apiKey: '' },
], 'existing Provider profiles must never inherit the global compatibility API key');

assert.deepEqual(normalizeAiProviderProfileForUi({
  id: '  ',
  name: '',
  kind: 'unknown',
  enabled: false,
  apiKey: ' sk-provider ',
  apiBaseUrl: ' https://api.example.test/v1/// ',
  endpointMode: 'legacy',
  proxyUrl: '  socks://proxy  ',
  customHeaders: '  {"X-API-Key":"secret"}  ',
  streamingEnabled: undefined,
  requestTimeoutSecs: 1,
  retryCount: -2,
  temperature: -1,
  maxTokens: 300000,
  topP: -1,
  reasoningEffort: 'high',
  responseFormat: 'json_schema',
}, 1), {
  id: 'provider-2',
  name: 'Provider 2',
  kind: 'openai',
  enabled: false,
  apiKey: 'sk-provider',
  apiBaseUrl: 'https://api.example.test/v1///',
  endpointMode: 'responses',
  model: 'gpt-4.1-mini',
  models: ['gpt-4.1-mini'],
  proxyUrl: 'socks://proxy',
  customHeaders: '{"X-API-Key":"secret"}',
  streamingEnabled: true,
  requestTimeoutSecs: 5,
  retryCount: 0,
  temperature: 0,
  maxTokens: 200000,
  topP: 0,
  reasoningEffort: 'high',
  responseFormat: 'json_schema',
  modelSettings: {
    'gpt-4.1-mini': {
      id: 'gpt-4.1-mini',
      displayName: 'gpt-4.1-mini',
      type: 'chat',
      contextWindowTokens: 128000,
      maxOutputTokens: 4096,
      capabilities: { vision: false, reasoning: false, toolUse: false },
      favorite: false,
    },
  },
});

assert.equal(normalizeAiProviderProfileForUi({
  id: 'p-draft',
  name: 'Draft',
  kind: 'openai-compatible',
  apiBaseUrl: 'https:/',
  endpointMode: 'responses',
  model: 'gpt-4.1-mini',
}, 0).apiBaseUrl, 'https:/');

assert.equal(
  normalizeAiProviderModelSettings('gpt-4.1-mini', { id: 'gpt-4.1-mini', displayName: '' }).displayName,
  '',
  'explicitly cleared model display names must stay empty instead of being auto-repaired to the model id',
);

assert.deepEqual(normalizeAiProviderProfileForUi({
  id: 'p-blank',
  name: 'Blank Provider',
  kind: 'openai-compatible',
  apiKey: '',
  apiBaseUrl: '',
  endpointMode: 'responses',
  model: '',
  models: [],
}, 0), {
  id: 'p-blank',
  name: 'Blank Provider',
  kind: 'openai-compatible',
  enabled: true,
  apiKey: '',
  apiBaseUrl: '',
  endpointMode: 'responses',
  model: '',
  models: [],
  proxyUrl: '',
  customHeaders: '',
  streamingEnabled: true,
  requestTimeoutSecs: 120,
  retryCount: 1,
  temperature: 0.2,
  maxTokens: 0,
  topP: 1,
  reasoningEffort: 'none',
  responseFormat: 'auto',
  modelSettings: {},
});

assert.equal(sanitizeAiProviderCustomHeaders('{"Authorization":"Bearer token","X-API-Key":"key","Safe":"ok"}'), '{\n  "Authorization": "[redacted]",\n  "X-API-Key": "[redacted]",\n  "Safe": "ok"\n}');
assert.equal(sanitizeAiProviderCustomHeaders('not-json'), 'not-json');

const profile = createAiProviderProfileFromSettings({
  aiApiBaseUrl: 'https://gateway.example.test/v1',
  aiEndpointMode: 'responses',
  aiModel: 'gateway-model',
}, { id: 'manual-id', name: 'Manual' });
assert.equal(profile.id, 'manual-id');
assert.equal(profile.name, 'Manual');
assert.equal(profile.kind, 'openai-compatible');
assert.equal(profile.apiKey, '');
assert.deepEqual(profile.models, ['gateway-model']);

{
  const resolved = resolveAiProviderRequestSettings({
    aiApiKey: 'sk-global',
    aiApiBaseUrl: 'https://global.example.test/v1',
    aiEndpointMode: 'responses',
    aiModel: 'global-model',
    aiActiveProviderProfileId: 'p-local',
    aiProviderProfiles: [{
      id: 'p-openai',
      name: 'OpenAI',
      kind: 'openai',
      apiKey: 'sk-openai',
      apiBaseUrl: 'https://api.openai.com/v1',
      endpointMode: 'responses',
      model: 'gpt-4.1-mini',
    }, {
      id: 'p-local',
      name: 'Local',
      kind: 'local-proxy',
      apiKey: ' sk-local ',
      apiBaseUrl: 'http://localhost:11434/v1',
      endpointMode: 'chat.completions',
      model: 'local-model',
      proxyUrl: ' http://127.0.0.1:7890 ',
      customHeaders: '{"X-Trace":"safe"}',
      streamingEnabled: false,
      requestTimeoutSecs: 30,
      retryCount: 2,
      temperature: 0.4,
      maxTokens: 2048,
      topP: 0.8,
      reasoningEffort: 'low',
      responseFormat: 'json_object',
    }],
  });
  assert.equal(resolved.aiApiKey, 'sk-local');
  assert.equal(resolved.aiApiBaseUrl, 'http://localhost:11434/v1');
  assert.equal(resolved.aiEndpointMode, 'chat.completions');
  assert.equal(resolved.aiModel, 'local-model');
  assert.equal(resolved.aiProxyUrl, 'http://127.0.0.1:7890');
  assert.equal(resolved.aiStreamingEnabled, false);
  assert.equal(resolved.aiTemperature, 0.4);
}

{
  const legacyGlobalKeySettings = {
    aiApiKey: 'sk-legacy-global',
    aiApiBaseUrl: 'https://api.openai.com/v1',
    aiEndpointMode: 'responses',
    aiModel: 'gpt-4.1-mini',
    aiActiveProviderProfileId: 'openai-default',
    aiProviderProfiles: [{
      id: 'openai-default',
      name: 'OpenAI',
      kind: 'openai',
      apiBaseUrl: 'https://api.openai.com/v1',
      endpointMode: 'responses',
      model: 'gpt-4.1-mini',
    }],
  };
  const [legacyProfile] = normalizeAiProviderProfilesForUi(legacyGlobalKeySettings);
  assert.equal(legacyProfile.apiKey, '', 'an existing Provider must not inherit the global compatibility key in the WebView');
  assert.equal(resolveAiProviderRequestSettings(legacyGlobalKeySettings).aiApiKey, '', 'request settings must retain Provider key isolation');

  const [singleLegacyProfile] = normalizeAiProviderProfilesForUi({
    ...legacyGlobalKeySettings,
    aiProviderProfiles: [],
  });
  assert.equal(singleLegacyProfile.apiKey, 'sk-legacy-global', 'profile-less legacy settings may still create one migrated Provider');
}

{
  const [explicitEmptyKeyProfile] = normalizeAiProviderProfilesForUi({
    aiApiKey: 'sk-global',
    aiApiBaseUrl: 'https://api.openai.com/v1',
    aiEndpointMode: 'responses',
    aiModel: 'gpt-4.1-mini',
    aiProviderProfiles: [{
      id: 'p-empty',
      name: 'Empty Key',
      kind: 'openai',
      apiKey: '',
      apiBaseUrl: 'https://api.openai.com/v1',
      endpointMode: 'responses',
      model: 'gpt-4.1-mini',
    }],
  });
  assert.equal(explicitEmptyKeyProfile.apiKey, '');
}

assert.deepEqual(parseAiProviderModelInput('gpt-4.1-mini, claude-3\n qwen-max  '), ['gpt-4.1-mini', 'claude-3', 'qwen-max']);

const mergedProfile = mergeAiProviderProfileModels({
  id: 'p1',
  name: 'Provider',
  kind: 'openai',
  apiBaseUrl: 'https://api.openai.com/v1',
  endpointMode: 'responses',
  model: 'gpt-4.1-mini',
  models: ['gpt-4.1-mini', ' o3-mini '],
}, ['o3-mini', 'gpt-4.1', '']);
assert.deepEqual(mergedProfile.models, ['gpt-4.1-mini', 'o3-mini', 'gpt-4.1']);
assert.equal(mergedProfile.model, 'gpt-4.1-mini');
assert.equal(getAiProviderModelConfig(mergedProfile, 'gpt-4.1').contextWindowTokens, 128000);
assert.equal(getAiProviderModelConfig({
  ...mergedProfile,
  modelSettings: {
    'o3-mini': {
      id: 'o3-mini',
      displayName: 'O3 Mini',
      type: 'chat',
      contextWindowTokens: 200000,
      maxOutputTokens: 100000,
      capabilities: { vision: true, reasoning: true, toolUse: false },
      favorite: true,
    },
  },
}, 'o3-mini').favorite, true);

const switchedProfile = mergeAiProviderProfileModels(mergedProfile, ['gpt-4.1'], 'gpt-4.1');
assert.equal(switchedProfile.model, 'gpt-4.1');

const sanitized = sanitizeProviderProfileSecrets({
  aiProviderProfiles: [{
    id: 'p1',
    name: 'Provider',
    kind: 'openai',
    apiBaseUrl: 'https://api.openai.com/v1',
    endpointMode: 'responses',
    model: 'gpt-4.1-mini',
    apiKey: 'sk-provider-secret',
    customHeaders: '{"Cookie":"session","X-Trace":"safe"}',
  }],
  translationSources: [{
    id: 'libre',
    name: 'Libre',
    kind: 'libretranslate',
    enabled: true,
    apiBaseUrl: 'https://translate.example.test',
    apiKey: 'translation-secret',
  }],
});
assert.equal(sanitized.aiProviderProfiles[0].customHeaders, '{\n  "Cookie": "[redacted]",\n  "X-Trace": "safe"\n}');
assert.equal(sanitized.aiProviderProfiles[0].apiKey, '');
assert.equal(sanitized.translationSources[0].apiKey, '');

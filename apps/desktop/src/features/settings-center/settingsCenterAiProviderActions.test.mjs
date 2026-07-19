import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-settings-center-ai-provider-actions-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/settings-center/settingsCenterAiProviderActions.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  createSettingsAiProviderActions,
} = require(join(outDir, 'features/settings-center/settingsCenterAiProviderActions.js'));

const openAiProfile = {
  id: 'p-openai',
  name: 'OpenAI',
  kind: 'openai',
  enabled: true,
  apiKey: 'sk-openai',
  apiBaseUrl: 'https://api.openai.com/v1',
  endpointMode: 'responses',
  model: 'gpt-4.1-mini',
  models: ['gpt-4.1-mini'],
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
};

const localProfile = {
  id: 'p-local',
  name: 'Local',
  kind: 'local-proxy',
  enabled: true,
  apiKey: 'sk-local',
  apiBaseUrl: 'http://localhost:11434/v1',
  endpointMode: 'chat.completions',
  model: 'local-model',
  models: ['local-model'],
  proxyUrl: ' http://127.0.0.1:7890 ',
  customHeaders: ' {"X-Trace":"safe"} ',
  streamingEnabled: false,
  requestTimeoutSecs: 1,
  retryCount: 9,
  temperature: 3,
  maxTokens: -10,
  topP: 2,
  reasoningEffort: 'not allowed',
  responseFormat: 'invalid',
};

const testMessages = {
  'settings.aiProviderActions.profileSaved': 'Provider profile saved',
  'settings.aiProviderActions.profileSelected': 'Current Provider switched; click Apply Provider to write AI request config',
  'settings.aiProviderActions.profileCreated': 'New Provider profile saved',
  'settings.aiProviderActions.copyName': '{name} copy',
  'settings.aiProviderActions.profileCopied': 'Copied current config as Provider',
  'settings.aiProviderActions.keepOneProfile': 'Keep at least one Provider profile',
  'settings.aiProviderActions.deleteConfirm': 'Delete Provider profile? The API Key will not be deleted, but this profile Base URL, model, and request parameters will be removed.',
  'settings.aiProviderActions.profileDeleted': 'Provider profile deleted',
  'settings.aiProviderActions.profileApplied': 'Applied Provider to AI request config',
  'settings.aiProviderActions.noModelsToAdd': 'No models to add',
  'settings.aiProviderActions.modelsAdded': 'Added {count} models to current Provider',
  'settings.aiProviderActions.modelNameRequired': 'Model name cannot be empty',
  'settings.aiProviderActions.modelSelected': 'Current AI model switched',
  'settings.aiProviderActions.modelDeleted': 'Provider model deleted',
  'settings.aiProviderActions.modelLibraryReset': 'Provider model library reset',
  'settings.aiProviderActions.modelSettingsSaved': 'Provider model settings saved',
};

function t(key, params = {}) {
  return String(testMessages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

function createHarness(initialSettings, confirmDelete = () => true) {
  let settings = { ...initialSettings };
  const updates = [];
  const secretUpdates = [];
  const statuses = [];
  const aiModelLists = [];
  const actions = createSettingsAiProviderActions({
    getSettings: () => settings,
    updateAppSettings: async (update, status) => {
      updates.push({ update, status });
      settings = { ...settings, ...update };
    },
    updateAiProviderApiKey: async (profileId, apiKey, status) => {
      secretUpdates.push({ profileId, apiKey, status });
      settings = {
        ...settings,
        aiProviderProfiles: settings.aiProviderProfiles.map((profile) => (
          profile.id === profileId ? { ...profile, apiKey } : profile
        )),
      };
    },
    setSaveStatus: (status) => statuses.push(status),
    setAiModels: (models) => aiModelLists.push(models),
    confirmDelete,
    t,
    createProviderProfileId: () => 'p-created',
  });
  return {
    actions,
    updates,
    secretUpdates,
    statuses,
    aiModelLists,
    getSettings: () => settings,
  };
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiModel: openAiProfile.model,
  });

  await harness.actions.updateAiProviderProfile('p-openai', { apiKey: 'sk-replaced' });
  await harness.actions.updateAiProviderProfile('p-openai', { apiKey: '' });

  assert.deepEqual(harness.secretUpdates.map(({ profileId, apiKey }) => ({ profileId, apiKey })), [
    { profileId: 'p-openai', apiKey: 'sk-replaced' },
    { profileId: 'p-openai', apiKey: '' },
  ], 'setting and clearing a Provider API key must use the dedicated secret command');
  assert.equal(harness.updates.length, 0, 'API key-only patches must never enter generic AppSettings persistence');
  assert.equal(harness.getSettings().aiProviderProfiles[0].apiKey, '', 'the harness must reflect the explicit clear result');
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: openAiProfile.model,
  });

  await harness.actions.deleteAiProviderProfile('p-openai');

  assert.equal(harness.updates.length, 0);
  assert.deepEqual(harness.statuses, ['Keep at least one Provider profile']);
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile, localProfile],
    aiModel: openAiProfile.model,
  });
  await harness.actions.selectAiProviderProfile('p-local');
  assert.deepEqual(harness.aiModelLists[0], [], 'switching Provider must clear stale discovered model options from the previous Provider');
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile, localProfile],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: openAiProfile.model,
  });

  await harness.actions.applyAiProviderProfile(localProfile);

  assert.equal(harness.updates.length, 1);
  assert.equal(harness.updates[0].status, 'Applied Provider to AI request config');
  assert.equal(harness.updates[0].update.aiActiveProviderProfileId, 'p-local');
  assert.equal(harness.updates[0].update.aiApiBaseUrl, localProfile.apiBaseUrl);
  assert.equal('aiApiKey' in harness.updates[0].update, false, 'applying a Provider must not route its secret through generic settings');
  assert.equal(harness.updates[0].update.aiEndpointMode, localProfile.endpointMode);
  assert.equal(harness.updates[0].update.aiModel, localProfile.model);
  assert.equal(harness.updates[0].update.aiRequestTimeoutSecs, 5);
  assert.equal(harness.updates[0].update.aiRetryCount, 5);
  assert.equal(harness.updates[0].update.aiProxyUrl, 'http://127.0.0.1:7890');
  assert.equal(harness.updates[0].update.aiCustomHeaders, '{"X-Trace":"safe"}');
  assert.equal(harness.updates[0].update.aiStreamingEnabled, false);
  assert.equal(harness.updates[0].update.aiTemperature, 2);
  assert.equal(harness.updates[0].update.aiMaxTokens, 0);
  assert.equal(harness.updates[0].update.aiTopP, 1);
  assert.equal(harness.updates[0].update.aiReasoningEffort, 'none');
  assert.equal(harness.updates[0].update.aiResponseFormat, 'auto');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].modelSettings['local-model'].contextWindowTokens, 1050000);
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiApiBaseUrl: 'https://gateway.example.test/v1',
    aiEndpointMode: 'responses',
    aiModel: 'gateway-model',
  });

  await harness.actions.createAiProviderProfile();

  assert.equal(harness.updates[0].status, 'New Provider profile saved');
  assert.equal(harness.updates[0].update.aiActiveProviderProfileId, 'p-created');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].id, 'p-created');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].name, 'Provider 2');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].kind, 'openai-compatible');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].apiKey, '');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].apiBaseUrl, '');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].model, '');
  assert.deepEqual(harness.updates[0].update.aiProviderProfiles[1].models, []);
}

{
  const harness = createHarness({
    aiApiKey: 'sk-current',
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiApiBaseUrl: 'https://gateway.example.test/v1',
    aiEndpointMode: 'responses',
    aiModel: 'gateway-model',
  });

  await harness.actions.copyCurrentAiConfigAsProvider();

  assert.equal(harness.updates[0].status, 'Copied current config as Provider');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].apiKey, '', 'copying Provider configuration must not duplicate its API key');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].apiBaseUrl, 'https://gateway.example.test/v1');
  assert.equal(harness.updates[0].update.aiProviderProfiles[1].model, 'gateway-model');
  assert.deepEqual(harness.updates[0].update.aiProviderProfiles[1].models, ['gateway-model']);
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: openAiProfile.model,
  });

  await harness.actions.addAiProviderModels('p-openai', 'gpt-4.1, o3-mini\n gpt-4.1');

  assert.deepEqual(harness.updates[0].update.aiProviderProfiles[0].models, ['gpt-4.1-mini', 'gpt-4.1', 'o3-mini']);
  assert.equal(harness.updates[0].update.aiProviderProfiles[0].model, 'gpt-4.1-mini');
  assert.equal(harness.updates[0].update.aiProviderProfiles[0].modelSettings['gpt-4.1'].displayName, 'gpt-4.1');
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: openAiProfile.model,
  });

  await harness.actions.selectAiProviderModel('p-openai', 'gpt-4.1');

  assert.equal(harness.updates[0].update.aiProviderProfiles[0].model, 'gpt-4.1');
  assert.deepEqual(harness.updates[0].update.aiProviderProfiles[0].models, ['gpt-4.1-mini', 'gpt-4.1']);
  assert.equal(harness.updates[0].update.aiModel, 'gpt-4.1');
  assert.equal(harness.updates[0].update.aiProviderProfiles[0].modelSettings['gpt-4.1'].contextWindowTokens, 128000);
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [{ ...openAiProfile, models: ['gpt-4.1-mini', 'gpt-4.1'] }],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: openAiProfile.model,
  });

  await harness.actions.updateAiProviderModelSettings('p-openai', {
    id: 'gpt-4.1',
    displayName: 'Workhorse',
    type: 'chat',
    contextWindowTokens: 256000,
    maxOutputTokens: 32000,
    capabilities: { vision: true, reasoning: true, toolUse: true },
    favorite: true,
  });

  const saved = harness.updates[0].update.aiProviderProfiles[0].modelSettings['gpt-4.1'];
  assert.equal(harness.updates[0].status, 'Provider model settings saved');
  assert.equal(saved.displayName, 'Workhorse');
  assert.equal(saved.contextWindowTokens, 256000);
  assert.equal(saved.maxOutputTokens, 32000);
  assert.deepEqual(saved.capabilities, { vision: true, reasoning: true, toolUse: true });
  assert.equal(saved.favorite, true);
  assert.equal(harness.updates[0].update.aiProviderProfiles[0].modelSettings['gpt-4.1-mini'].displayName, 'gpt-4.1-mini');
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [{ ...openAiProfile, model: 'gpt-4.1', models: ['gpt-4.1-mini', 'gpt-4.1', 'o3-mini'] }],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: 'gpt-4.1',
  });

  await harness.actions.removeAiProviderModel('p-openai', 'gpt-4.1');

  assert.equal(harness.updates[0].update.aiProviderProfiles[0].model, 'gpt-4.1-mini');
  assert.deepEqual(harness.updates[0].update.aiProviderProfiles[0].models, ['gpt-4.1-mini', 'o3-mini']);
  assert.equal(harness.updates[0].update.aiModel, 'gpt-4.1-mini');
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [{ ...openAiProfile, model: 'gpt-4.1', models: ['gpt-4.1-mini', 'gpt-4.1', 'o3-mini'] }],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: 'gpt-4.1',
  });

  await harness.actions.resetAiProviderModels('p-openai');

  assert.equal(harness.updates[0].update.aiProviderProfiles[0].model, 'gpt-4.1');
  assert.deepEqual(harness.updates[0].update.aiProviderProfiles[0].models, ['gpt-4.1']);
  assert.equal(harness.updates[0].update.aiModel, 'gpt-4.1');
}

{
  const harness = createHarness({
    aiActiveProviderProfileId: 'p-openai',
    aiProviderProfiles: [openAiProfile],
    aiApiBaseUrl: openAiProfile.apiBaseUrl,
    aiEndpointMode: openAiProfile.endpointMode,
    aiModel: openAiProfile.model,
  });

  await harness.actions.updateAiProviderProfile('p-openai', {
    apiBaseUrl: '',
    model: '',
    proxyUrl: '',
  });

  assert.equal(harness.updates[0].update.aiProviderProfiles[0].apiBaseUrl, '');
  assert.equal(harness.updates[0].update.aiProviderProfiles[0].model, '');
  assert.equal(harness.updates[0].update.aiProviderProfiles[0].proxyUrl, '');
}

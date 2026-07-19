import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-i18n-test-${process.pid}`);
const appSource = readFileSync(join(process.cwd(), 'src', 'app', 'App.tsx'), 'utf8');
const settingsSchemaSource = readFileSync(join(process.cwd(), 'src', 'services', 'settingsCenter', 'schema.ts'), 'utf8');
const settingsOptionsSource = readFileSync(join(process.cwd(), 'src', 'pages', 'useSettingsPageOptions.ts'), 'utf8');
for (const locale of ['zhCN', 'enUS', 'jaJP', 'esES', 'frFR', 'koKR']) {
  const modules = readdirSync(join(process.cwd(), 'src', 'i18n', 'messages', locale)).filter((name) => name.endsWith('.ts'));
  assert.ok(modules.length >= 10, `${locale} messages must remain split into domain modules`);
}
for (const file of ['zh-CN.ts', 'en-US.ts', 'ja-JP.ts', 'es-ES.ts', 'fr-FR.ts', 'ko-KR.ts']) {
  const source = readFileSync(join(process.cwd(), 'src', 'i18n', file), 'utf8');
  assert.doesNotMatch(source, /^  '[^']+':/m, `${file} must remain an i18n aggregation module rather than a monolithic message map`);
  if (!['zh-CN.ts', 'en-US.ts'].includes(file)) {
    assert.doesNotMatch(source, /from ['"]\.\/en-US['"]/, `${file} must use its own complete message modules rather than an English runtime fallback`);
  }
}
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/i18n/index.ts',
  'src/i18n/en-US.ts',
  'src/i18n/zh-CN.ts',
  'src/i18n/ja-JP.ts',
  'src/i18n/es-ES.ts',
  'src/i18n/fr-FR.ts',
  'src/i18n/ko-KR.ts',
], { cwd: process.cwd(), stdio: 'inherit' });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}');

const requireFromTest = createRequire(import.meta.url);
const { createTranslator, resolveLocalePreference } = requireFromTest(join(outDir, 'index.js'));
const { enUS } = requireFromTest(join(outDir, 'en-US.js'));
const { zhCN } = requireFromTest(join(outDir, 'zh-CN.js'));
const { jaJP } = requireFromTest(join(outDir, 'ja-JP.js'));
const { esES } = requireFromTest(join(outDir, 'es-ES.js'));
const { frFR } = requireFromTest(join(outDir, 'fr-FR.js'));
const { koKR } = requireFromTest(join(outDir, 'ko-KR.js'));

for (const [locale, messages] of Object.entries({ 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': jaJP, 'es-ES': esES, 'fr-FR': frFR, 'ko-KR': koKR })) {
  assert.deepEqual(Object.keys(messages).sort(), Object.keys(zhCN).sort(), `${locale} must cover every translation key`);
  assert.notEqual(messages['settings.language.title'], 'settings.language.title', `${locale} must provide the language setting label`);
}
assert.equal(jaJP['settings.language.title'], 'インターフェース言語');
assert.equal(esES['settings.language.title'], 'Idioma de la interfaz');
assert.equal(frFR['settings.language.title'], "Langue de l'interface");
assert.equal(koKR['settings.language.title'], '인터페이스 언어');

assert.equal(resolveLocalePreference('zh-CN'), 'zh-CN');
assert.equal(resolveLocalePreference('en-US'), 'en-US');
assert.equal(resolveLocalePreference('ja-JP'), 'ja-JP');
assert.equal(resolveLocalePreference('es-ES'), 'es-ES');
assert.equal(resolveLocalePreference('fr-FR'), 'fr-FR');
assert.equal(resolveLocalePreference('ko-KR'), 'ko-KR');
assert.equal(resolveLocalePreference('system', 'en-US'), 'en-US');
assert.equal(resolveLocalePreference('system', 'en-GB'), 'en-US');
assert.equal(resolveLocalePreference('system', 'zh-Hans-CN'), 'zh-CN');
assert.equal(resolveLocalePreference('system', 'ja-JP'), 'ja-JP');
assert.equal(resolveLocalePreference('system', 'es-ES'), 'es-ES');
assert.equal(resolveLocalePreference('system', 'fr-FR'), 'fr-FR');
assert.equal(resolveLocalePreference('system', 'ko-KR'), 'ko-KR');
assert.equal(resolveLocalePreference('system', ''), 'zh-CN');

assert.match(settingsSchemaSource, /localePreference\?: 'system' \| 'zh-CN' \| 'en-US' \| 'ja-JP' \| 'es-ES' \| 'fr-FR' \| 'ko-KR'/, 'settings update broadcasts must carry locale changes between windows');
for (const locale of ['ja-JP', 'es-ES', 'fr-FR', 'ko-KR']) {
  assert.match(settingsOptionsSource, new RegExp(`value: '${locale}'`), `${locale} must be available in the Settings Center language selector`);
}
assert.match(appSource, /subscribeSettingsUpdated\(\(detail\) => \{[\s\S]*isLocalePreference\(detail\.localePreference\)[\s\S]*setLocalePreferenceState\(detail\.localePreference\)/, 'every app window must react to broadcast locale changes');
assert.match(appSource, /dispatchSettingsUpdated\(\{ key: 'localePreference',[\s\S]*localePreference: nextLocale \}\)/, 'changing the locale must broadcast it to standalone windows');

const removedKey = 'knowledge.title';
const originalEnglishValue = enUS[removedKey];
delete enUS[removedKey];

assert.equal(
  createTranslator('en-US', 'default-locale')(removedKey),
  zhCN[removedKey],
  'default fallback strategy must use the default locale when the active locale misses a translation',
);
assert.equal(
  createTranslator('en-US', 'key')(removedKey),
  removedKey,
  'key fallback strategy must expose the missing translation key for diagnostics',
);

enUS[removedKey] = originalEnglishValue;

assert.equal(
  createTranslator('zh-CN', 'default-locale', { enabled: true, rules: [{ source: '阅读现场', target: '阅读器' }] })('nav.reader.label'),
  '阅读器',
  'custom terminology must replace translated UI labels after interpolation',
);
assert.equal(
  createTranslator('zh-CN', 'default-locale', { enabled: false, rules: [{ source: '阅读现场', target: '阅读器' }] })('nav.reader.label'),
  zhCN['nav.reader.label'],
  'disabled custom terminology must leave translated UI labels unchanged',
);

const unavailableFeatureCopyCases = [
  {
    label: 'Chinese search navigation description',
    value: zhCN['nav.search.description'],
    forbidden: /语义|跨书|向量|混合/,
  },
  {
    label: 'English search navigation description',
    value: enUS['nav.search.description'],
    forbidden: /semantic|cross-book|vector|hybrid/i,
  },
  {
    label: 'Chinese search page eyebrow',
    value: zhCN['page.search.eyebrow'],
    forbidden: /语义|跨书|向量|混合/,
  },
  {
    label: 'English search page eyebrow',
    value: enUS['page.search.eyebrow'],
    forbidden: /semantic|cross-book|vector|hybrid/i,
  },
  {
    label: 'Chinese search title',
    value: zhCN['search.title'],
    forbidden: /语义|跨书|向量|混合/,
  },
  {
    label: 'English search title',
    value: enUS['search.title'],
    forbidden: /semantic|cross-book|vector|hybrid/i,
  },
  {
    label: 'Chinese task empty state',
    value: zhCN['tasks.empty'],
    forbidden: /语义|向量/,
  },
  {
    label: 'English task empty state',
    value: enUS['tasks.empty'],
    forbidden: /semantic|vector/i,
  },
];

for (const copyCase of unavailableFeatureCopyCases) {
  assert.doesNotMatch(
    copyCase.value,
    copyCase.forbidden,
    `${copyCase.label} must not present unavailable semantic, vector, hybrid, or cross-book capabilities as already available`,
  );
}

assert.match(
  zhCN['search.description'],
  /语义检索和跨书问答仍等待 AI sidecar/,
  'Chinese search description may mention semantic and cross-book features only as sidecar-gated future capabilities',
);
assert.match(
  enUS['search.description'],
  /semantic search and cross-book Q&A still wait for the AI sidecar/i,
  'English search description may mention semantic and cross-book features only as sidecar-gated future capabilities',
);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lifecycleSource = readFileSync('src/pages/useSettingsPageLifecycle.ts', 'utf8');
const shellSource = readFileSync('src/pages/SettingsPageShell.tsx', 'utf8');
const appSource = readFileSync('src/app/App.tsx', 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `Expected ${name} to exist.`);
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, index);
    }
  }
  throw new Error(`Could not read body for ${name}.`);
}

assert.match(
  shellSource,
  /function selectSettingsGroup[\s\S]*saveSettingsPageMemory\(\{\s*activeGroup:\s*groupId,\s*settingsQuery:\s*'',\s*pageFilterQuery:\s*''\s*\}\)/,
  'Manual settings group selection should persist the last viewed group and clear both search modes.',
);

assert.doesNotMatch(
  lifecycleSource,
  /highlightTarget\s*!==\s*'ai-api'[\s\S]*saveSettingsPageMemory\(\{\s*activeGroup:\s*'ai'/,
  'Opening the AI API target should not overwrite the remembered settings group.',
);

assert.doesNotMatch(
  lifecycleSource,
  /highlightTarget\s*!==\s*'reader-memory-warning'[\s\S]*saveSettingsPageMemory\(\{\s*activeGroup:\s*'reader'/,
  'Opening the reader memory warning target should not overwrite the remembered settings group.',
);

assert.doesNotMatch(
  lifecycleSource,
  /if\s*\(!context\.initialGroup\)\s*return;[\s\S]*saveSettingsPageMemory\(\{\s*activeGroup:\s*context\.initialGroup/,
  'Initial settings group routing should be transient and should not overwrite the remembered group.',
);

assert.doesNotMatch(
  functionBody(appSource, 'openSettingsPage'),
  /setSettingsInitialGroup\(target\s*===\s*'ai-api'\s*\?\s*'ai'\s*:\s*undefined\)/,
  'AI API settings targeting should be driven by highlightTarget, not a sticky initialGroup.',
);

assert.match(
  appSource,
  /const navigatePage = \(page: AppPage\) => \{\s*if \(page === 'settings'\) \{\s*setSettingsHighlightTarget\(undefined\);\s*setSettingsInitialGroup\(undefined\);\s*\}\s*setActivePage\(page\);\s*\};/,
  'Generic settings navigation should clear transient settings targets before opening.',
);

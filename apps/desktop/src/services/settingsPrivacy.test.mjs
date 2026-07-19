import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-settings-privacy-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/settingsCenterService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

function patchCompiledEsmImports(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      patchCompiledEsmImports(path);
      continue;
    }
    if (!path.endsWith('.js')) continue;
    const source = readFileSync(path, 'utf8');
    const patched = source.replace(
      /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
      (match, prefix, specifier, suffix) => {
        if (specifier.endsWith('.js') || specifier.endsWith('.json')) return match;
        return `${prefix}${specifier}.js${suffix}`;
      },
    );
    if (patched !== source) writeFileSync(path, patched);
  }
}

patchCompiledEsmImports(outDir);

const { defaultExtendedSettings, redactPrivacyText, sanitizePrivacyObject, sanitizeSettingsSnapshotExtended } = await import(pathToFileURL(join(outDir, 'services', 'settingsCenterService.js')).href);

const privacySettings = {
  ...defaultExtendedSettings,
  applicationPrivacyMode: true,
  hideBookTitlesInPrivacyMode: true,
  hideFilePathsInPrivacyMode: true,
  defaultImportPath: 'E:\\private\\library',
  sidecarEnabled: true,
  sidecarCommand: 'C:\\Users\\reader\\sidecar\\run.py',
  sidecarWorkingDir: 'E:\\models\\bookmind',
};

assert.equal(redactPrivacyText('路径 E:\\private\\library\\secret.txt', privacySettings), '路径 [path]');
assert.equal(redactPrivacyText('alice@example.com 13800138000', privacySettings), '[email] [number]');

const sanitized = sanitizePrivacyObject({
  diagnostics: {
    queryUsed: '请总结 E:\\private\\library\\secret.txt',
    nested: { prompt: '联系 alice@example.com' },
  },
  citation: {
    label: '秘密书 · 第 1 章',
    text: '正文摘录',
  },
}, privacySettings);

assert.equal(sanitized.diagnostics.queryUsed, '请总结 [path]');
assert.equal(sanitized.diagnostics.nested.prompt, '联系 [email]');
assert.equal(sanitized.citation.label, '私密书籍 · [location]');
assert.equal(sanitized.citation.text, '正文摘录');

const snapshotExtended = sanitizeSettingsSnapshotExtended(privacySettings);
assert.equal(snapshotExtended.defaultImportPath, '');
assert.equal(snapshotExtended.sidecarEnabled, false);
assert.equal(snapshotExtended.sidecarCommand, '');
assert.equal(snapshotExtended.sidecarWorkingDir, '');
assert.equal(snapshotExtended.applicationPrivacyMode, true);

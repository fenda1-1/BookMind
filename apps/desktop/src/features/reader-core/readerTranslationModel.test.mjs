import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-reader-translation-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/reader-core/readerTranslationModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { buildReaderTranslationInstruction, buildReaderTranslationRequest, normalizeReaderTranslationResult } = await import(
  pathToFileURL(join(outDir, 'features', 'reader-core', 'readerTranslationModel.js')).href
);

const request = buildReaderTranslationRequest({
  sourceText: '  雨夜里的医院  ',
  instruction: ' Translate faithfully. ',
  scopeLabel: 'Selected reader text',
  requestId: 'translation-1',
  customSensitiveWords: '医院',
  sourceLanguage: 'zh-CN',
  targetLanguage: 'en',
});

assert.equal(request.mode, 'cloud');
assert.equal(request.requireCloudApi, true);
assert.equal(request.cloudPromptMode, 'plain_text');
assert.equal(request.cloudResponseFormat, 'text');
assert.equal(request.scope, 'selection-translation');
assert.equal(request.scopeText, '雨夜里的医院');
assert.equal(request.retrievalQuery, '雨夜里的医院');
assert.equal(request.userText, '');
assert.equal(request.requestId, 'translation-1');
assert.equal(buildReaderTranslationInstruction('Translate {sourceLanguage} to {targetLanguage}.', 'auto', 'ja'), 'Translate auto to ja.');
assert.equal(normalizeReaderTranslationResult('```text\nThe hospital in the rainy night.\n```'), 'The hospital in the rainy night.');

console.log('Verified reader translation request model.');

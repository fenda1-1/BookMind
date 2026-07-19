import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-failure-diagnostics-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterFailureDiagnostics.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const {
  characterFailureAdviceKey,
  isStructuredCharacterErrorCode,
} = require(join(outDir, 'features', 'characters', 'characterFailureDiagnostics.js'));

assert.equal(isStructuredCharacterErrorCode('character_index_missing_text_index'), true);
assert.equal(isStructuredCharacterErrorCode('character_ai_parse_failed'), true);
assert.equal(isStructuredCharacterErrorCode('character_write_failed'), true);
assert.equal(isStructuredCharacterErrorCode('character-ai-parse-failed'), false, 'hyphenated codes are not structured character error codes');
assert.equal(isStructuredCharacterErrorCode('fts_write_failed'), false, 'task-center text-index codes must not be treated as character codes');
assert.equal(isStructuredCharacterErrorCode(''), false);

assert.equal(characterFailureAdviceKey('character_index_missing_text_index'), 'characters.failureAdvice.character_index_missing_text_index');
assert.equal(characterFailureAdviceKey('character_ai_parse_failed'), 'characters.failureAdvice.character_ai_parse_failed');
assert.equal(characterFailureAdviceKey('character_write_failed'), 'characters.failureAdvice.character_write_failed');
assert.equal(characterFailureAdviceKey('character_unknown_future_code'), 'characters.failureAdvice.generic');
assert.equal(characterFailureAdviceKey('fts_write_failed'), 'characters.failureAdvice.unstructured');
assert.equal(characterFailureAdviceKey(''), 'characters.failureAdvice.none');

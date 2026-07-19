import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-app-ai-session-model-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--jsx', 'react-jsx', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/app/appAiSessionModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const appAiSessionModel = require(join(outDir, 'app/appAiSessionModel.js'));
const {
  createCurrentContextToolTrace,
  resolveCloudDisabledAiRequest,
} = appAiSessionModel;

assert.deepEqual(
  resolveCloudDisabledAiRequest({ scope: 'chapter', instruction: '问', userText: '', mode: 'cloud' }, false),
  { scope: 'chapter', instruction: '问', userText: '', mode: 'cloud' },
  'reader research desk cloud requests must not silently downgrade to local when cloud is disabled',
);

const currentBook = {
  id: 'book-1',
  title: '测试书',
  displayTitle: '测试书',
  author: '',
  format: 'txt',
  status: 'ready',
  progress: 0,
  fileName: '',
  filePath: '',
  coverLabel: '测',
  coverTone: 'sage',
  deleted: false,
  deletedAt: '',
  contentHash: '',
  importedAt: '',
  content: '',
  chunks: [{ id: 'c1' }, { id: 'c2' }],
};
const request = {
  scope: 'chapter',
  scopeLabel: '第 1 章',
  instruction: 'Agent 模式：分析当前章',
  userText: '',
  retrievalQuery: '分析当前章',
  scopeText: '林七夜看向窗外。',
  mode: 'cloud',
  interactionMode: 'agent',
};
const redactedContext = createCurrentContextToolTrace(request, currentBook, { cloudAiAutoRedact: false });
assert.equal(
  Object.hasOwn(redactedContext.toolResult.content, 'text'),
  false,
  'current context tool trace should not include full text unless a runtime tool call asks for it',
);
const explicitContext = createCurrentContextToolTrace(request, currentBook, { cloudAiAutoRedact: false }, 'succeeded', { includeText: true });
assert.equal(
  explicitContext.toolResult.content.text,
  '林七夜看向窗外。',
  'Agent runtime current-context tool should be able to return locally retained scope text on demand',
);
assert.equal(
  explicitContext.toolCall.args.includeText,
  true,
  'current-context tool call args should reflect whether full text was requested',
);

assert.equal(
  appAiSessionModel.buildAgentRunTrace,
  undefined,
  'app AI session model should not expose a fixed precomputed Agent chain helper',
);
assert.equal(
  appAiSessionModel.mergeAgentRunTraceIntoAnswer,
  undefined,
  'app AI session model should not merge static Agent traces into answers',
);

console.log('Verified app AI session model cloud transport behavior.');

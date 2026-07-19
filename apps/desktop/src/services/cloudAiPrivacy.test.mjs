import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-cloud-ai-privacy-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/cloudAiPrivacy.ts',
  'src/services/aiService.ts',
], { cwd: process.cwd(), stdio: 'inherit' });
copyFileSync(join(outDir, 'services', 'cloudAiPrivacy.js'), join(outDir, 'services', 'cloudAiPrivacy'));

const { buildCloudRedactionPreview, redactCloudText } = await import(pathToFileURL(join(outDir, 'services', 'cloudAiPrivacy.js')).href);
const { applyAiRequestOverrides, sanitizeCloudAiRequest } = await import(pathToFileURL(join(outDir, 'services', 'aiService.js')).href);

assert.equal(redactCloudText('联系 alice.reader@example.com'), '联系 [email]');
assert.equal(redactCloudText('手机号 13800138000 和 +86 139 0013 8000'), '手机号 [phone] 和 [phone]');
assert.equal(redactCloudText('身份证 11010519900101123X'), '身份证 [id-card]');
assert.equal(redactCloudText('订单号 202601011234567890'), '订单号 [number]');
assert.equal(redactCloudText('Windows 路径 E:\\private\\library\\secret-book.txt'), 'Windows 路径 [path]');
assert.equal(redactCloudText('Unix 路径 /Users/alice/private/secret-book.txt'), 'Unix 路径 [path]');
assert.equal(redactCloudText('Linux 路径 /home/alice/books/secret.txt'), 'Linux 路径 [path]');
assert.equal(redactCloudText('角色 暗号.* 和 项目X 都要隐藏', '暗号.*\n项目X'), '角色 [custom] 和 [custom] 都要隐藏');
assert.equal(redactCloudText('正则符号 a+b 不应误伤 aaab', 'a+b'), '正则符号 [custom] 不应误伤 aaab');

const preview = buildCloudRedactionPreview('联系 alice.reader@example.com，手机号 13800138000，文件 /Users/alice/private/secret-book.txt，订单 202601011234567890。暗号.*', '暗号.*');
assert.equal(preview.originalText.includes('alice.reader@example.com'), true);
assert.equal(preview.redactedText, '联系 [email]，手机号 [phone]，文件 [path]，订单 [number]。[custom]');
assert.equal(preview.replacementCount, 5);
assert.deepEqual(preview.replacementTypes, ['email', 'phone', 'path', 'number', 'custom']);

const sanitizedRequest = sanitizeCloudAiRequest({
  scope: 'chapter',
  instruction: '总结 暗号.* 与 alice.reader@example.com',
  userText: '项目X 的内容',
  retrievalQuery: '查找 项目X',
  scopeText: '范围包含 暗号.*',
  scopeLabel: '章节 项目X',
  bookId: 'local-book-id',
  customSensitiveWords: '暗号.*\n项目X',
});
assert.equal(sanitizedRequest.instruction, '总结 [custom] 与 [email]');
assert.equal(sanitizedRequest.userText, '[custom] 的内容');
assert.equal(sanitizedRequest.retrievalQuery, '查找 [custom]');
assert.equal(sanitizedRequest.scopeText, '范围包含 [custom]');
assert.equal(sanitizedRequest.scopeLabel, '章节 [custom]');
assert.equal(sanitizedRequest.bookId, undefined);
assert.equal(sanitizedRequest.customSensitiveWords, undefined);

const baseSettings = { aiReasoningEffort: 'low', aiModel: 'gpt-test' };
assert.deepEqual(applyAiRequestOverrides(baseSettings, { reasoningEffort: ' xhigh ' }), { aiReasoningEffort: 'xhigh', aiModel: 'gpt-test' });
assert.equal(applyAiRequestOverrides(baseSettings, {}), baseSettings);

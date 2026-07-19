import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = join(tmpdir(), `bookmind-ai-reader-mode-model-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/features/ai-reader/aiReaderModeModel.ts', 'src/app/agentToolModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);

const {
  aiInteractionModeOptions,
  parseAiInteractionModePreference,
  resolveConfiguredAiInteractionMode,
  parseAgentEnabledToolsPreference,
  parseAgentPresetPromptPreference,
  createAiCapabilityPanelTitle,
  resolveAiTransportModeForInteraction,
  resolveScopeTextForInteraction,
  shouldShowCitationWarningsForInteraction,
  shouldShowAiScopeSelect,
  formatAgentTokenBudget,
  formatAgentTokenBudgetDisplay,
  buildAgentScopePanelItems,
  buildAgentModeInstruction,
} = require(join(outDir, 'features/ai-reader/aiReaderModeModel.js'));

assert.deepEqual(aiInteractionModeOptions.map((option) => option.value), ['qa', 'agent'], 'reader research desk should expose only QA and Agent interaction modes');
assert.equal(resolveConfiguredAiInteractionMode(undefined), 'qa', 'reader research desk should default to normal QA mode');
assert.equal(resolveConfiguredAiInteractionMode('cloud'), 'qa', 'legacy cloud transport preference should not appear as an interaction mode');
assert.equal(resolveConfiguredAiInteractionMode('local'), 'qa', 'legacy local transport preference should not keep the reader research desk in local mode');
assert.equal(resolveConfiguredAiInteractionMode('agent'), 'agent', 'saved Agent mode should be restored');
assert.equal(parseAiInteractionModePreference({ interactionMode: 'agent' }), 'agent', 'new interaction mode preference should be parsed');
assert.deepEqual(parseAgentEnabledToolsPreference({ agentEnabledTools: ['search_local_index', 'finish', 'missing'] }), ['search_local_index'], 'Agent enabled tool preference should ignore internal and unknown tools');
assert.equal(parseAgentPresetPromptPreference({ agentPresetPrompt: '  强化 Agent 输出  ' }), '强化 Agent 输出', 'Agent preset prompt preference should trim saved prompt text');
assert.equal(parseAgentPresetPromptPreference({ agentPresetPrompt: '   ' }), null, 'Blank Agent preset prompts should fall back to the default');
assert.equal(parseAiInteractionModePreference({ mode: 'local' }), null, 'legacy aiModePreference records should be ignored for interaction mode');
assert.equal(resolveAiTransportModeForInteraction('qa', true), 'cloud', 'QA mode should use cloud API transport');
assert.equal(resolveAiTransportModeForInteraction('agent', true), 'cloud', 'Agent mode should use cloud API transport');
assert.equal(resolveAiTransportModeForInteraction('agent', false), 'cloud', 'Agent mode should still request cloud transport so missing cloud config is surfaced');
assert.equal(resolveScopeTextForInteraction('qa', '当前章正文'), '当前章正文', 'QA mode should send the selected/current scope text by default');
assert.equal(resolveScopeTextForInteraction('agent', '当前章正文'), '当前章正文', 'Agent mode should retain scope text locally so tools can read it on demand');
assert.equal(shouldShowAiScopeSelect('qa'), true, 'QA mode should show the analysis scope selector');
assert.equal(shouldShowAiScopeSelect('agent'), false, 'Agent mode should hide the analysis scope selector because tools choose context on demand');
assert.equal(shouldShowCitationWarningsForInteraction('qa'), true, 'QA mode should keep citation quality warnings for evidence-based answers');
assert.equal(shouldShowCitationWarningsForInteraction('agent'), false, 'Agent mode should suppress citation warnings because tool execution results are not always source-text claims');
assert.equal(formatAgentTokenBudget(24200, 1000000), '24.2k/1M', 'Agent token budget should use compact k/M formatting');
assert.equal(formatAgentTokenBudgetDisplay(0, 128000), '待发送/128k', 'Agent token budget should not show a misleading 0 before a request is built');
assert.equal(formatAgentTokenBudgetDisplay(900, 128000), '900/128k', 'Agent token budget should show a concrete estimate once available');
assert.deepEqual(
  buildAgentScopePanelItems({ usedTokens: 24200, plannedTokens: 1000000, toolCount: 11, stepCount: 4 }).map((item) => item.label),
  ['Token', '工具箱', '步骤', '上下文'],
  'Agent scope panel should describe token budget and tool plan instead of current chapter sending fields',
);
assert.equal(createAiCapabilityPanelTitle('agent').title, 'Agent 工具箱', 'Agent popover should not be named as an analysis scope');
assert.equal(createAiCapabilityPanelTitle('qa').title, '上下文范围', 'QA popover should keep the scope concept');
assert.equal(
  buildAgentScopePanelItems({ usedTokens: 0, plannedTokens: 128000, toolCount: 11, stepCount: 4 })[0].value,
  '待发送/128k',
  'Agent scope panel should show pending token state before send',
);
assert.match(buildAgentModeInstruction('分析当前章节'), /Agent 模式/);
assert.match(buildAgentModeInstruction('分析当前章节'), /工具/);

console.log('Verified AI reader interaction mode model.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/app/appAiSessionActions.ts', 'utf8');

assert.doesNotMatch(source, /preCloudTrace|Agent 已完成本地工具取证/u, 'Agent mode must not precompute and display a fixed local tool chain before the model asks for a tool');
assert.match(source, /Agent 正在判断要使用哪个工具/u, 'Agent mode should first show a model decision step');
assert.match(source, /kind: 'model_decision'[\s\S]{0,240}status: 'running'/u, 'Agent mode should show the model decision as the first running event');
assert.match(source, /parseAgentToolDecision/u, 'Agent mode should parse model tool decisions before executing tools');
assert.match(source, /cloudPromptMode: 'agent_tool_decision'/u, 'Agent decision calls must use the raw tool-decision prompt mode');
assert.match(source, /cloudResponseFormat: 'json_object'/u, 'Agent decision calls must request raw JSON object output instead of BookMind answer schema');
assert.match(source, /resolveAgentAvailableTools\(\)/u, 'Agent mode should use the centralized executable tool registry');
assert.match(source, /normalizedToolName === 'list_chapters'/u, 'Agent mode should be able to list current book chapters');
assert.match(source, /normalizedToolName === 'read_chapter'/u, 'Agent mode should be able to read a specified chapter');
assert.match(source, /normalizedToolName === 'search_chapter_text'/u, 'Agent mode should be able to search clue occurrences grouped by chapter');
assert.match(source, /normalizedToolName === 'read_paragraph_range'/u, 'Agent mode should be able to read a direct paragraph range');
assert.match(source, /buildAgentParagraphWindows\(currentBook\.chunks/u, 'Agent paragraph window execution should use current book chunks, not only current scope text');
assert.match(source, /createAgentChapterCitations/u, 'Chapter tools should register source citations so final Agent answers can jump back to original text');
assert.match(source, /normalizedToolName === 'update_reader_settings'/u, 'Agent mode should be able to execute reader setting changes');
assert.match(source, /normalizedToolName === 'track_character_growth'/u, 'Agent mode should be able to execute character growth tracking');
assert.match(source, /normalizedToolName === 'search_character_mentions'/u, 'Agent mode should be able to search character mentions');
assert.match(source, /normalizedToolName === 'summarize_character_arc'/u, 'Agent mode should be able to summarize character arcs');
assert.match(
  source,
  /agentNextPlan: '任务完成'[\s\S]{0,500}refreshAgentTokenEstimate\(\)[\s\S]{0,240}const privacySafeAnswer = sanitizeAiResponseForPrivacy/u,
  'Agent finish-decision branch must refresh runtime token diagnostics after the final event is added',
);
assert.match(
  source,
  /agentNextPlan: '任务完成'[\s\S]{0,500}refreshAgentTokenEstimate\(\)[\s\S]{0,240}const privacySafeAgentResponse = sanitizeAiResponseForPrivacy/u,
  'Agent final-response branch must refresh runtime token diagnostics after the final model answer and final event are added',
);

console.log('Verified app AI session Agent flow does not pre-run a fixed tool chain.');

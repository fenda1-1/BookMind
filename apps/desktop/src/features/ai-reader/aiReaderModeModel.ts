import type { AiAskRequest } from '../../types';
import { normalizeAgentEnabledTools } from '../../app/agentToolModel';

export type AiInteractionMode = 'qa' | 'agent';

export const aiInteractionModeOptions: Array<{ value: AiInteractionMode; label: string; description: string }> = [
  { value: 'qa', label: '问答模式', description: '普通一问一答，直接使用云端 API 基于当前范围回答。' },
  { value: 'agent', label: 'Agent 模式', description: '让 AI 先规划，再按需要使用阅读、检索、引用和保存类工具直到任务完成。' },
];

export function parseAiInteractionModePreference(value: unknown): AiInteractionMode | null {
  if (!value || typeof value !== 'object') return null;
  const interactionMode = (value as { interactionMode?: unknown }).interactionMode;
  return isAiInteractionMode(interactionMode) ? interactionMode : null;
}

export function parseAgentEnabledToolsPreference(value: unknown): string[] | null {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray((value as { agentEnabledTools?: unknown }).agentEnabledTools)) return null;
  return normalizeAgentEnabledTools((value as { agentEnabledTools?: unknown }).agentEnabledTools);
}

export function parseAgentPresetPromptPreference(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const prompt = (value as { agentPresetPrompt?: unknown }).agentPresetPrompt;
  if (typeof prompt !== 'string') return null;
  const normalized = prompt.trim().slice(0, 24000);
  return normalized || null;
}

export function resolveConfiguredAiInteractionMode(value: unknown): AiInteractionMode {
  return isAiInteractionMode(value) ? value : 'qa';
}

export function resolveAiTransportModeForInteraction(_interactionMode: AiInteractionMode, _cloudEnabled: boolean): NonNullable<AiAskRequest['mode']> {
  return 'cloud';
}

export function resolveScopeTextForInteraction(interactionMode: AiInteractionMode, scopeText: string | undefined) {
  if (interactionMode === 'agent') return scopeText;
  return scopeText;
}

export function shouldShowAiScopeSelect(interactionMode: AiInteractionMode) {
  return interactionMode === 'qa';
}

export function shouldShowCitationWarningsForInteraction(interactionMode: AiInteractionMode) {
  return interactionMode === 'qa';
}

export function formatAgentTokenBudget(usedTokens: number, plannedTokens: number) {
  return `${formatCompactTokenCount(usedTokens)}/${formatCompactTokenCount(plannedTokens)}`;
}

export function formatAgentTokenBudgetDisplay(usedTokens: number, plannedTokens: number, pendingLabel = '待发送') {
  const safeUsedTokens = Math.max(0, Math.round(Number.isFinite(usedTokens) ? usedTokens : 0));
  if (safeUsedTokens <= 0) return `${pendingLabel}/${formatCompactTokenCount(plannedTokens)}`;
  return formatAgentTokenBudget(safeUsedTokens, plannedTokens);
}

export function buildAgentScopePanelItems(
  input: { usedTokens: number; plannedTokens: number; toolCount: number; stepCount: number },
  text: { pendingTokenLabel?: string; toolCountLabel?: string; stepCountLabel?: string; contextValue?: string } = {},
) {
  return [
    { label: 'Token', value: formatAgentTokenBudgetDisplay(input.usedTokens, input.plannedTokens, text.pendingTokenLabel), detail: '当前估算 / 计划总预算' },
    { label: '工具箱', value: text.toolCountLabel ?? `${Math.max(0, Math.floor(input.toolCount))} 个`, detail: '可按需调用阅读、检索、设置和人物工具' },
    { label: '步骤', value: text.stepCountLabel ?? `${Math.max(1, Math.floor(input.stepCount))} 步`, detail: '规划、取证、综合、输出' },
    { label: '上下文', value: text.contextValue ?? '工具按需读取', detail: '默认不直接发送当前章全文' },
  ];
}

export function createAiCapabilityPanelTitle(interactionMode: AiInteractionMode) {
  if (interactionMode === 'agent') {
    return {
      title: 'Agent 工具箱',
      subtitle: '控制可调用工具，查看参数和返回样例',
      tooltip: 'Agent 工具箱',
    };
  }
  return {
    title: '上下文范围',
    subtitle: '发送前将使用这些上下文',
    tooltip: '上下文范围',
  };
}

export function buildAgentModeInstruction(instruction: string) {
  return [
    'Agent 模式：你可以使用 BookMind 阅读研究台提供的阅读工具来完成任务。先判断任务目标，再按需使用当前上下文、本地索引搜索（全书/当前章）、段落窗口、引用回跳、保存笔记、高亮、生成闪卡、构建时间线、抽取人物关系和抽取伏笔线索等工具。',
    '如果一次工具结果不足以完成任务，请继续发起后续工具调用，直到可以给出完整结论；不要在证据不足时直接猜测。',
    '输出必须体现工具调用过程、工具结果摘要、最终回答和可回跳引用。',
    instruction,
  ].filter(Boolean).join('\n\n');
}

function isAiInteractionMode(value: unknown): value is AiInteractionMode {
  return value === 'qa' || value === 'agent';
}

function formatCompactTokenCount(value: number) {
  const safeValue = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  if (safeValue >= 1_000_000) return `${trimCompactNumber(safeValue / 1_000_000)}M`;
  if (safeValue >= 1_000) return `${trimCompactNumber(safeValue / 1_000)}k`;
  return String(safeValue);
}

function trimCompactNumber(value: number) {
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/u, '');
}

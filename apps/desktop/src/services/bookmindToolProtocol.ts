import { BOOKMIND_AI_RESPONSE_SCHEMA_V2 } from './aiResponseProtocol.js';

export type BookMindReaderTool = {
  name: string;
  label: string;
  description: string;
  local: boolean;
  cloudRequiresConsent?: boolean;
};

export const BOOKMIND_READER_TOOLS: BookMindReaderTool[] = [
  { name: 'get_current_context', label: '获取当前阅读上下文', description: '读取当前书、章节、页面、选区和阅读进度。', local: true },
  { name: 'list_chapters', label: '列出章节目录', description: '读取当前书章节总数、首章、末章和章节统计。', local: true },
  { name: 'read_chapter', label: '读取指定章节', description: '按章节序号、标题或首章/末章位置读取章节正文。', local: true },
  { name: 'search_chapter_text', label: '搜索章节线索', description: '搜索关键词在哪些章节出现，并返回分章命中统计和片段。', local: true },
  { name: 'search_local_index', label: '本地索引搜索（全书/当前章）', description: '在当前书本地索引中按关键词检索证据和引用位置；整书范围检索全书，章节范围限定到当前章节。', local: true },
  { name: 'get_paragraph_window', label: '展开引用上下文', description: '按引用位置展开前后段落，帮助核验证据。', local: true },
  { name: 'read_paragraph_range', label: '读取段落范围', description: '按章节和段落起止位置读取原文段落。', local: true },
  { name: 'get_reader_settings', label: '读取设置', description: '读取当前全局阅读设置、设置中心扩展设置和章节规则摘要。', local: true },
  { name: 'search_settings', label: '搜索可改设置', description: '按中文关键词查找所有可修改设置键，返回分支、值类型、允许值/范围和更新参数示例。', local: true },
  { name: 'update_reader_settings', label: '修改设置', description: '应用字体、背景色、字号、行距、布局、每日阅读目标、搜索设置、章节清洗规则等设置变更。', local: true },
  { name: 'get_character_index', label: '读取人物索引', description: '读取当前书人物、别名、性别、角色、提及次数和摘要。', local: true },
  { name: 'track_character_growth', label: '追踪人物成长线', description: '按人物名整理当前书中的提及、事件和章节顺序时间线。', local: true },
  { name: 'search_character_mentions', label: '搜索人物提及', description: '按人物名、章节范围和关键词检索人物原文提及。', local: true },
  { name: 'summarize_character_arc', label: '总结人物弧线', description: '基于人物提及和事件按章节阶段总结人物成长、关系和身份变化。', local: true },
  { name: 'jump_to_source', label: '跳转到引用来源', description: '回跳到章节、段落和偏移位置。', local: true },
  { name: 'save_ai_note', label: '保存 AI 笔记', description: '把回答、结构化块、来源和引用保存为笔记。', local: true },
  { name: 'save_citation_highlight', label: '保存引用高亮', description: '把引用片段保存为原文高亮。', local: true },
  { name: 'generate_flashcards', label: '生成闪卡', description: '从当前回答、选区或引用生成复习卡片。', local: true },
  { name: 'build_timeline', label: '构建时间线', description: '从当前范围抽取事件链。', local: true },
  { name: 'extract_characters', label: '抽取人物关系', description: '抽取人物状态、阵营和关系变化。', local: true },
  { name: 'extract_foreshadowing', label: '抽取伏笔线索', description: '抽取异常、重复意象、伏笔和后续关注点。', local: true },
  { name: 'request_cloud_ai', label: '请求云端 AI', description: '在用户明确确认后，把当前范围文本发送到已配置的云端模型。', local: false, cloudRequiresConsent: true },
];

const developerToolPattern = /\b(shell|apply_patch|update_plan|git|PowerShell)\b/i;
const toolQuestionPattern = /(可以|能|会|支持).{0,8}(调用|使用|访问).{0,8}(哪些|什么).{0,8}(工具|能力)|(?:工具|能力).{0,8}(列表|清单)|what tools can you/i;

export function isToolCapabilityQuestion(text: string) {
  return toolQuestionPattern.test(text.trim());
}

export function assertNoDeveloperToolNames(text: string) {
  return !developerToolPattern.test(text);
}

export function buildToolCapabilityResponse({ mode = 'local', bookId }: { mode?: 'local' | 'cloud' | 'mock'; bookId?: string } = {}) {
  const toolItems = BOOKMIND_READER_TOOLS.map((tool) => ({
    tool: tool.name,
    name: tool.label,
    text: `${tool.name}：${tool.description}`,
    local: tool.local,
    requiresConsent: Boolean(tool.cloudRequiresConsent),
  }));
  const response = {
    schema: BOOKMIND_AI_RESPONSE_SCHEMA_V2,
    responseId: `airesp_tools_${Date.now()}`,
    mode,
    title: 'BookMind 阅读工具清单',
    summary: '我只能使用 BookMind 阅读研究台的阅读、检索、引用、保存和生成类能力，不会暴露或调用开发代理工具。',
    blocks: [
      {
        id: 'blk_tool_summary',
        type: 'summary',
        title: '可用能力',
        content: '以下是面向普通读者的 BookMind 阅读工具。',
        bullets: toolItems,
        citationIds: [],
      },
      {
        id: 'blk_tool_constraints',
        type: 'diagnostics',
        title: '边界说明',
        content: mode === 'cloud'
          ? '云端模式只会在你确认后发送当前范围文本；引用只能来自提供的上下文。'
          : '本地模式只使用本地索引和当前阅读上下文。不能直接修改用户文件，也不能访问未导入的书籍。',
        citationIds: [],
      },
      {
        id: 'blk_tool_actions',
        type: 'suggested_actions',
        title: '你可以接着做',
        items: [
          { label: '总结当前章节', action: 'run_summary' },
          { label: '检索关键词', action: 'search_local_index' },
          { label: '生成本章闪卡', action: 'generate_flashcards' },
        ],
        citationIds: [],
      },
    ],
    citations: [],
    toolCalls: [bookId ? { id: 'toolcall_current_context', tool: 'get_current_context', status: 'succeeded', args: { bookId }, reason: '说明工具前读取当前阅读上下文' } : { id: 'toolcall_current_context', tool: 'get_current_context', status: 'no_book', args: {}, reason: '说明工具前检查当前阅读上下文' }],
    toolResults: [],
    actions: [],
    diagnostics: {
      mode,
      bookId,
      forbiddenDeveloperToolsHidden: true,
    },
  };
  const serialized = JSON.stringify(response, null, 2);
  if (!assertNoDeveloperToolNames(serialized)) throw new Error('developer-tool-name-leaked');
  return serialized;
}

export const BOOKMIND_AI_PROMPT_CONSTRAINTS = [
  `优先输出 ${BOOKMIND_AI_RESPONSE_SCHEMA_V2} JSON。`,
  '所有事实性章节分析必须附引用；没有引用时输出 diagnostics 块，不要编造引用。',
  '用户询问工具时只列 BookMind 阅读工具。',
  '禁止提到内部开发代理、命令行、仓库、补丁工具。',
  '云端模式的引用只能来自提供的上下文；未提供上下文时请说不确定或建议检索。',
].join('\n');

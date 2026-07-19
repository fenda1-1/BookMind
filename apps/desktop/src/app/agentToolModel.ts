import type { AppSettings, CharacterCenterPayload, CharacterEvent, CharacterMention, CharacterProfile, ReaderSettings, TextChunk } from '../types';
import type { LocalePreference } from '../i18n';
import { enUS } from '../i18n/en-US';
import { zhCN } from '../i18n/zh-CN';
import {
  defaultChapterRules,
  defaultExtendedSettings,
  normalizeCustomCleanupRules,
  type ChapterRuleDraft,
  type ExtendedSettings,
} from '../services/settingsCenterService';
import { defaultReaderSettings } from '../features/reader-core/readerSettings';

export const AGENT_AVAILABLE_TOOLS = [
  'get_current_context',
  'list_chapters',
  'read_chapter',
  'search_chapter_text',
  'search_local_index',
  'get_paragraph_window',
  'read_paragraph_range',
  'get_reader_settings',
  'search_settings',
  'update_reader_settings',
  'get_character_index',
  'track_character_growth',
  'search_character_mentions',
  'summarize_character_arc',
  'get_renderable_formats',
  'finish',
] as const;

export type AgentAvailableTool = typeof AGENT_AVAILABLE_TOOLS[number];

export type AgentToolCatalogItem = {
  name: Exclude<AgentAvailableTool, 'finish'>;
  label: string;
  description: string;
  category: 'context' | 'chapter' | 'search' | 'settings' | 'characters' | 'format';
  argsExample: Record<string, unknown>;
  resultExample: Record<string, unknown>;
};

export const AGENT_TOOL_CATALOG: AgentToolCatalogItem[] = [
  {
    name: 'get_current_context',
    label: '读取当前上下文',
    description: '读取当前书籍、章节、页面、选区和当前范围正文/元数据。',
    category: 'context',
    argsExample: { includeText: true },
    resultExample: { bookTitle: '当前书名', scopeLabel: '第 3 章', chapterTitle: '第 3 章', pageText: '当前页正文片段...' },
  },
  {
    name: 'list_chapters',
    label: '列出章节',
    description: '读取当前书章节总数、首章、末章和章节统计，可按标题关键词过滤。',
    category: 'chapter',
    argsExample: { query: '尾声', limit: 80, includeStats: true },
    resultExample: { chapterCount: 32, lastChapter: { sourceChapterIndex: 31, title: '第三十一章' }, chapters: [{ sourceChapterIndex: 0, title: '第一章', chars: 3200 }] },
  },
  {
    name: 'read_chapter',
    label: '读取指定章节',
    description: '按章节序号、标题或 first/last/current 位置读取章节正文。',
    category: 'chapter',
    argsExample: { position: 'last', includeText: true, maxChars: 12000 },
    resultExample: { chapter: { sourceChapterIndex: 31, title: '最后一章' }, text: '章节正文...', truncated: false },
  },
  {
    name: 'search_chapter_text',
    label: '章节线索搜索',
    description: '搜索某个词、物品、地点或线索在哪些章节出现，并返回分章命中统计和片段。',
    category: 'chapter',
    argsExample: { query: '拉德利', limit: 50, perChapterLimit: 5 },
    resultExample: { totalMatches: 8, chapterMatches: [{ sourceChapterIndex: 30, title: '第三十一章', matchCount: 3, snippets: ['...拉德利...'] }] },
  },
  {
    name: 'search_local_index',
    label: '本地索引搜索（全书/当前章）',
    description: '在当前书本地索引中按关键词检索证据和引用位置；整书范围检索全书，章节范围限定到当前章节。',
    category: 'search',
    argsExample: { query: '林七夜 成长', limit: 20 },
    resultExample: { resultCount: 12, citations: [{ label: '第 8 章 · P12', text: '命中片段...', paragraphIndex: 12 }] },
  },
  {
    name: 'get_paragraph_window',
    label: '展开段落窗口',
    description: '基于已命中的引用，或直接用章节/段落位置展开前后段落，核对上下文。',
    category: 'search',
    argsExample: { citationIds: ['1', '2'], chapterIndex: 4, paragraphIndex: 12, before: 1, after: 1 },
    resultExample: { windows: [{ citationId: '1', sourceChapterIndex: 4, paragraphIndex: 12, windowText: '上一段\\n\\n命中段\\n\\n下一段' }] },
  },
  {
    name: 'read_paragraph_range',
    label: '读取段落范围',
    description: '按章节和段落起止位置读取原文段落，适合精确核对指定片段。',
    category: 'search',
    argsExample: { chapterIndex: 4, paragraphStart: 10, paragraphEnd: 14 },
    resultExample: { chapter: { sourceChapterIndex: 4, title: '第五章' }, paragraphs: [{ paragraphIndex: 10, text: '原文段落...' }] },
  },
  {
    name: 'get_reader_settings',
    label: '读取阅读设置',
    description: '读取全局阅读设置，包括字体、背景、字号、布局等。',
    category: 'settings',
    argsExample: {},
    resultExample: { settings: { fontFamily: 'LXGW WenKai', theme: 'paper', fontSize: 20 } },
  },
  {
    name: 'search_settings',
    label: '搜索设置项',
    description: '用中文或英文关键词查找可修改设置项，返回分支、键名、值类型、允许值/范围和可直接调用的更新参数示例。',
    category: 'settings',
    argsExample: { query: '每日阅读目标' },
    resultExample: {
      matches: [
        { branch: 'extended', key: 'readerDailyGoalEnabled', label: '每日阅读目标', kind: 'boolean', allowedValues: [true, false], updateExample: { readerDailyGoalEnabled: true } },
        { branch: 'extended', key: 'readerDailyPagesGoal', label: '每日页数目标', kind: 'integerString', valueSchema: { type: 'integerString', min: 0, max: 1000 }, updateExample: { readerDailyPagesGoal: 30 } },
      ],
    },
  },
  {
    name: 'update_reader_settings',
    label: '修改阅读设置',
    description: '应用阅读器和设置中心阅读相关设置补丁。先用 search_settings 获取 branch/key/valueSchema/updateExample，再按返回键名提交。',
    category: 'settings',
    argsExample: { readerDailyGoalEnabled: true, readerDailyPagesGoal: 30 },
    resultExample: { changedKeys: [], changedExtendedKeys: ['readerDailyGoalEnabled', 'readerDailyPagesGoal'], extendedAfter: { readerDailyGoalEnabled: true, readerDailyPagesGoal: '30' } },
  },
  {
    name: 'get_character_index',
    label: '读取人物索引',
    description: '读取当前书人物索引摘要、别名、性别、角色和提及次数。',
    category: 'characters',
    argsExample: { limit: 80 },
    resultExample: { profileCount: 42, profiles: [{ displayName: '林七夜', mentionCount: 320, aliases: ['七夜'] }] },
  },
  {
    name: 'track_character_growth',
    label: '追踪人物成长线',
    description: '按人物名或别名整理当前书中的提及和事件时间线。',
    category: 'characters',
    argsExample: { characterName: '林七夜', maxMentions: 120 },
    resultExample: { profile: { displayName: '林七夜' }, timeline: [{ kind: 'mention', chapterTitle: '第 1 章', summary: '首次登场...' }] },
  },
  {
    name: 'search_character_mentions',
    label: '搜索人物提及',
    description: '按人物名/别名、章节范围和关键词检索人物原文提及。',
    category: 'characters',
    argsExample: { characterName: '林七夜', chapterStart: 1, chapterEnd: 20, query: '选择', limit: 80 },
    resultExample: { profile: { displayName: '林七夜' }, mentions: [{ sourceChapterIndex: 3, paragraphIndex: 8, quote: '原文提及...' }] },
  },
  {
    name: 'summarize_character_arc',
    label: '总结人物弧线',
    description: '基于人物提及和事件，按章节阶段压缩人物成长/关系/身份变化脉络。',
    category: 'characters',
    argsExample: { characterName: '林七夜', maxMentions: 160, maxStages: 12 },
    resultExample: { profile: { displayName: '林七夜' }, stages: [{ chapterTitle: '第 1 章', mentionCount: 3, eventCount: 1, summary: '阶段摘要...' }] },
  },
  {
    name: 'get_renderable_formats',
    label: '读取格式工具箱',
    description: '列出当前 BookMind 可以渲染的结构化回复格式、字段和示例，方便 Agent 自由组合卡片、表格、时间线、闪卡等输出。',
    category: 'format',
    argsExample: { detail: true },
    resultExample: {
      schema: 'bookmind.ai.response.v2',
      responseShape: { version: 'bookmind.ai.response.v2', scope: 'chapter', scope_label: '当前范围', blocks: [] },
      formats: [
        { type: 'summary', title: '摘要/章节报告', fields: ['title', 'content', 'bullets', 'openQuestions', 'citationIds'] },
        { type: 'flashcards', title: '闪卡', fields: ['cards[{front,back,tags,citationSource,citationIds}]'] },
        { type: 'table', title: '通用表格', fields: ['columns', 'rows', 'citationIds'] },
      ],
    },
  },
];

export type AgentRenderableFormat = {
  type: string;
  aliases?: string[];
  title: string;
  description: string;
  fields: string[];
  exampleBlock: Record<string, unknown>;
};

export type AgentRenderableFormatsPayload = {
  schema: 'bookmind.ai.response.v2';
  responseShape: {
    version: 'bookmind.ai.response.v2';
    scope: string;
    scope_label: string;
    title: string;
    blocks: unknown[];
    citations: unknown[];
  };
  formats: AgentRenderableFormat[];
  looseTopLevelAccepted: string[];
  notes: string[];
};

export type ReaderSettingDescriptor = {
  branch: 'reader' | 'extended' | 'chapterRules' | 'appSettings' | 'locale';
  key: keyof ReaderSettings | keyof ExtendedSettings | keyof ChapterRuleDraft | keyof AppSettings | 'localePreference';
  label: string;
  description: string;
  aliases: string[];
  kind: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'integerString' | 'array' | 'object';
  values?: string[];
  allowedValues?: unknown[];
  valueSchema: Record<string, unknown>;
  updateExample: Record<string, unknown>;
};

export type ReaderSettingsPatchParseResult = {
  patch: Partial<ReaderSettings>;
  changedKeys: Array<keyof ReaderSettings>;
  extendedPatch: Partial<ExtendedSettings>;
  changedExtendedKeys: Array<keyof ExtendedSettings>;
  chapterRulesPatch: Partial<ChapterRuleDraft>;
  changedChapterRuleKeys: Array<keyof ChapterRuleDraft>;
  appSettingsPatch: Partial<AppSettings>;
  changedAppSettingKeys: Array<keyof AppSettings>;
  localePreference?: LocalePreference;
  changedLocaleKeys: Array<'localePreference'>;
  warnings: string[];
};

export type CharacterGrowthTimelineItem = {
  id: string;
  kind: 'mention' | 'event';
  title: string;
  summary: string;
  quote: string;
  sourceChapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  location: unknown;
};

export type CharacterGrowthTimelineResult =
  | {
    status: 'ready';
    profile: Pick<CharacterProfile, 'id' | 'displayName' | 'canonicalName' | 'summary' | 'mentionCount' | 'relationCount' | 'eventCount' | 'gender'>;
    matchedBy: 'id' | 'name' | 'alias';
    totalMentions: number;
    totalEvents: number;
    timeline: CharacterGrowthTimelineItem[];
  }
  | {
    status: 'missing-character-index' | 'not-found';
    message: string;
    candidates: Array<Pick<CharacterProfile, 'id' | 'displayName' | 'canonicalName' | 'mentionCount'>>;
  };

export type CharacterMentionSearchResult =
  | {
    status: 'ready';
    profile: Pick<CharacterProfile, 'id' | 'displayName' | 'canonicalName' | 'gender' | 'role' | 'mentionCount'>;
    matchedBy: 'id' | 'name' | 'alias';
    totalMatches: number;
    mentions: Array<{
      id: string;
      quote: string;
      context: string;
      sourceChapterIndex: number;
      chapterTitle: string;
      paragraphIndex: number;
      startOffset: number;
      endOffset: number;
      location: CharacterMention['location'];
    }>;
  }
  | {
    status: 'missing-character-index' | 'not-found' | 'no-result';
    message: string;
    candidates: Array<Pick<CharacterProfile, 'id' | 'displayName' | 'canonicalName' | 'mentionCount'>>;
  };

export type CharacterArcSummaryResult =
  | {
    status: 'ready';
    profile: Pick<CharacterProfile, 'id' | 'displayName' | 'canonicalName' | 'summary' | 'gender' | 'role' | 'mentionCount' | 'eventCount'>;
    matchedBy: 'id' | 'name' | 'alias';
    summary: string;
    totalMentions: number;
    totalEvents: number;
    stages: Array<{
      sourceChapterIndex: number;
      chapterTitle: string;
      mentionCount: number;
      eventCount: number;
      firstParagraphIndex: number;
      lastParagraphIndex: number;
      quotes: string[];
      events: Array<{ id: string; title: string; summary: string; eventType: CharacterEvent['eventType'] }>;
      summary: string;
    }>;
  }
  | {
    status: 'missing-character-index' | 'not-found' | 'no-result';
    message: string;
    candidates: Array<Pick<CharacterProfile, 'id' | 'displayName' | 'canonicalName' | 'mentionCount'>>;
  };

export type AgentChapterCatalogEntry = {
  sourceChapterIndex: number;
  title: string;
  chunkCount: number;
  chars: number;
  ordinalStart: number;
  ordinalEnd: number;
  paragraphStart?: number;
  paragraphEnd?: number;
};

export type AgentChapterCatalog = {
  status: 'ready' | 'empty';
  chapterCount: number;
  chapters: AgentChapterCatalogEntry[];
  firstChapter: AgentChapterCatalogEntry | null;
  lastChapter: AgentChapterCatalogEntry | null;
};

export type AgentReadChapterResult =
  | {
    status: 'ready';
    chapter: AgentChapterCatalogEntry;
    text: string;
    paragraphs: string[];
    truncated: boolean;
  }
  | {
    status: 'not-found' | 'empty';
    message: string;
    chapterCount: number;
    candidates: AgentChapterCatalogEntry[];
  };

export type AgentSearchChapterTextResult =
  | {
    status: 'ready';
    query: string;
    totalMatches: number;
    chapterMatches: Array<AgentChapterCatalogEntry & { matchCount: number; snippets: string[] }>;
  }
  | {
    status: 'missing-query' | 'no-result' | 'empty';
    query: string;
    totalMatches: number;
    chapterMatches: [];
    message: string;
  };

export type AgentParagraphItem = {
  paragraphIndex: number;
  text: string;
};

export type AgentReadParagraphRangeResult =
  | {
    status: 'ready';
    chapter: AgentChapterCatalogEntry;
    paragraphStart: number;
    paragraphEnd: number;
    paragraphs: AgentParagraphItem[];
    text: string;
  }
  | {
    status: 'not-found' | 'empty';
    message: string;
    chapterCount: number;
    candidates: AgentChapterCatalogEntry[];
  };

export type AgentParagraphWindowResult = {
  status: 'ready' | 'no-result';
  windows: Array<{
    citationId?: number | string;
    label: string;
    text: string;
    bookId?: string;
    chapterId?: string;
    chapterIndex?: number;
    sourceChapterIndex?: number;
    paragraphIndex?: number;
    startOffset?: number;
    endOffset?: number;
    windowText: string;
    paragraphs: AgentParagraphItem[];
  }>;
  message?: string;
};

const customCleanupRulesValueSchema = {
  type: 'array',
  maxItems: 16,
  item: {
    type: 'object',
    fields: {
      id: { type: 'string', optional: true, pattern: '^[a-zA-Z0-9_-]{1,48}$' },
      name: { type: 'string', maxLength: 40 },
      pattern: { type: 'string', maxLength: 240, required: true },
      replacement: { type: 'string', maxLength: 240 },
      enabled: { type: 'boolean' },
      mode: { type: 'enum', values: ['remove-line', 'replace'] },
      priority: { type: 'number', min: 0, max: 999, optional: true },
    },
  },
};

const defaultAgentAppSettings: AppSettings = {
  schemaVersion: 1,
  trashRetentionDays: 3,
  trashAutoCleanupEnabled: true,
  trashProtectReadingProgress: true,
  trashProtectReaderAssets: true,
  aiApiKey: '',
  aiApiBaseUrl: 'https://api.openai.com/v1',
  aiEndpointMode: 'responses',
  aiModel: 'gpt-4.1-mini',
  aiRequestTimeoutSecs: 120,
  aiRetryCount: 1,
  aiProxyUrl: '',
  aiCustomHeaders: '',
  aiStreamingEnabled: true,
  aiTemperature: 0.2,
  aiMaxTokens: 0,
  aiTopP: 1,
  aiReasoningEffort: 'none',
  aiResponseFormat: 'auto',
  aiActiveProviderProfileId: 'openai-default',
  aiProviderProfiles: [],
  aiCancelStrategy: 'abort-and-save-stopped',
  operationLogLevel: 'none',
};

const settingMetadata: Partial<Record<ReaderSettingDescriptor['branch'], Record<string, { label: string; description: string; aliases?: string[]; values?: string[]; valueSchema?: Record<string, unknown>; updateExample?: Record<string, unknown> }>>> = {
  appSettings: {
    aiProviderProfiles: { label: 'Provider 模型库', description: '云端 AI Provider 配置、模型列表和模型能力配置。', aliases: ['Provider', '模型库', '模型设置', '模型能力', '视觉理解', '推理模型', '工具调用', '收藏模型'] },
    aiApiKey: { label: 'Provider API Key', description: '当前 AI Provider 的 API Key。', aliases: ['Provider', 'API Key', '密钥'] },
    aiApiBaseUrl: { label: 'Provider Base URL', description: '当前 AI Provider 的 Base URL。', aliases: ['Provider', 'Base URL', '接口地址'] },
    aiEndpointMode: { label: 'Provider 端点模式', description: 'AI 请求使用 responses 或 chat.completions 端点。', aliases: ['Provider', '端点', 'endpoint'], values: ['responses', 'chat.completions'] },
    aiModel: { label: '默认模型', description: '当前 AI Provider 默认模型。', aliases: ['模型', '默认模型', '模型库'] },
    aiRequestTimeoutSecs: { label: 'AI 请求超时', description: '云端 AI 请求超时时间。', aliases: ['AI超时', '请求超时'] },
    aiRetryCount: { label: 'AI 重试次数', description: '云端 AI 请求失败后的重试次数。', aliases: ['AI重试', '重试次数'] },
    aiStreamingEnabled: { label: 'AI 流式输出', description: '控制云端 AI 是否流式返回。', aliases: ['流式输出', '流式', 'streaming'] },
    aiReasoningEffort: { label: 'AI 思考深度', description: '控制支持推理模型的 reasoning effort，也可在设置中心输入 Provider 支持的自定义值。', aliases: ['思考深度', '推理强度', '推理模型'], values: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
    aiResponseFormat: { label: 'AI 回复格式', description: '控制 AI 回复格式偏好。', aliases: ['回复格式', 'JSON格式'], values: ['auto', 'json_object', 'json_schema'] },
    aiCancelStrategy: { label: 'AI 取消策略', description: '控制取消 AI 请求时是否保存停止结果或回退本地超时。', aliases: ['取消策略', 'AI取消'], values: ['abort-only', 'abort-and-save-stopped', 'abort-and-local-timeout'] },
    operationLogLevel: { label: '操作日志级别', description: '控制操作日志记录详细程度。', aliases: ['日志', '操作日志', '日志级别'], values: ['none', 'error', 'basic', 'debug'] },
    trashRetentionDays: { label: '回收站保留天数', description: '删除到回收站后的保留天数。', aliases: ['回收站', '保留天数'] },
  },
  chapterRules: {
    enabled: { label: '自动识别章节', description: '控制章节解析总开关。', aliases: ['章节解析', '目录解析', '自动识别章节'] },
    removeAds: { label: '广告清理', description: 'TXT 清理阶段移除广告行。', aliases: ['广告清理', '清洗', '清理', '广告'] },
    adKeywords: { label: '广告关键词列表', description: '用逗号或换行分隔；命中任一关键词的整行会在 TXT 清理阶段移除。', aliases: ['广告关键词列表', '广告关键词', '扫码关注', 'QQ群', '下载APP', 'follow us', 'QQ group', 'download app', '清洗', '清理'] },
    removeAdUrls: { label: '广告网址规则', description: '移除广告网址和站点链接噪声。', aliases: ['广告网址规则', '网址清理', 'URL清理', '清洗'] },
    removePaginationNoise: { label: '分页噪声清理', description: '移除页码、分页符等导入噪声。', aliases: ['分页噪声清理', '分页清理', '页码清理', '清洗'] },
    preserveOriginalBackup: { label: '清理后保留原文备份', description: '清理 TXT 时保留清理前原文备份。', aliases: ['保留原文备份', '清理备份', '清洗'] },
    normalizeBlankLines: { label: '合并/移除多余空行', description: '清理多余空行并归一化段落空白。', aliases: ['空行清理', '合并空行', '移除多余空行', '清洗'] },
    trimTrailingWhitespace: { label: '去除行尾空白', description: '移除每行末尾空白字符。', aliases: ['行尾空白', '去除行尾空白', '清洗'] },
    normalizeFullWidthSpaces: { label: '半角/全角空格清洗', description: '归一化半角/全角空格。', aliases: ['半角全角空格清洗', '全角空格', '空格清洗', '清洗'] },
    customCleanupRules: {
      label: '自定义清洗规则',
      description: '按优先级执行自定义 TXT 清洗规则；remove-line 删除整行，replace 执行正则替换。',
      aliases: ['自定义清洗规则', '清洗规则', '自定义清理', '清洗', '清理'],
      valueSchema: customCleanupRulesValueSchema,
      updateExample: { customCleanupRules: [{ name: '删除广告行', enabled: true, mode: 'remove-line', pattern: '书友群\\s*\\d+', replacement: '' }] },
    },
    maxHeadingLength: { label: '标题最大长度', description: '章节标题候选允许的最大长度。', aliases: ['标题最大长度', '章节标题长度'] },
    minHeadingConfidence: { label: '章节标题可信度阈值', description: '章节标题识别最低可信度。', aliases: ['可信度阈值', '章节标题可信度'] },
    enableChineseChapter: { label: '中文章节规则', description: '识别第 N 章 / 回 / 节等中文章节标题。', aliases: ['中文章节', '第N章', '章节规则'] },
    enableChineseVolume: { label: '卷/部/集/篇规则', description: '识别卷、部、集、篇等层级标题。', aliases: ['卷部集篇', '卷章', '分卷'] },
    enableSpecialHeadings: { label: '特殊标题规则', description: '识别序章、楔子、尾声、番外等特殊标题。', aliases: ['特殊标题', '序章', '楔子', '尾声', '番外'] },
    enableEnglishChapter: { label: '英文 Chapter 规则', description: '识别 Chapter / Part / Book / Volume 等英文标题。', aliases: ['英文章节', 'Chapter规则'] },
    paragraphMode: { label: '段落模式', description: '控制 TXT 行如何转换为阅读器段落。', aliases: ['段落模式', '段落规则'], values: ['line', 'blank-line', 'merge-short-lines', 'chinese-reflow'] },
    customRegexRules: { label: '自定义正则规则列表', description: '用于章节标题识别的自定义正则规则。', aliases: ['自定义正则', '正则规则', '章节正则'] },
  },
  extended: {
    readerDailyGoalEnabled: { label: '每日阅读目标', description: '开启每日阅读页数、分钟和章节目标统计。', aliases: ['每日阅读目标', '阅读目标', '目标进度'] },
    readerDailyPagesGoal: { label: '每日页数目标', description: '每天期望阅读的页数；0 表示不统计页数目标。', aliases: ['每日阅读目标', '每日页数目标', '页数目标'] },
    readerDailyMinutesGoal: { label: '每日分钟目标', description: '每天期望阅读的分钟数；0 表示不统计时长目标。', aliases: ['每日阅读目标', '每日分钟目标', '分钟目标', '时长目标'] },
    readerDailyChaptersGoal: { label: '每日章节目标', description: '每天期望完成的章节数；0 表示不统计章节目标。', aliases: ['每日阅读目标', '每日章节目标', '章节目标'] },
    searchLimit: { label: '默认每页结果数量', description: '全文搜索默认返回结果数量。', aliases: ['搜索结果数量', '默认每页结果数量', '搜索数量'] },
    globalSearchMode: { label: '全局搜索时机', description: '控制输入即搜或回车搜索。', aliases: ['全局搜索时机', '输入即搜', '回车搜索'], values: ['instant', 'enter'] },
    globalSearchDebounceMs: { label: '搜索防抖时间', description: '输入即搜模式下等待多少毫秒再查询。', aliases: ['搜索防抖', '防抖时间'] },
    globalSearchSnippetLength: { label: '全局搜索 snippet 长度', description: '控制搜索结果摘要最多显示多少字符。', aliases: ['搜索片段长度', 'snippet长度', '摘要长度'] },
    globalSearchShowScore: { label: '显示搜索分数', description: '控制全局搜索结果是否显示底层 score。', aliases: ['搜索分数', '显示分数'] },
    readerSearchChapterFilterDefault: { label: '阅读器章节过滤默认值', description: '阅读器搜索默认搜索全部章节还是当前章节。', aliases: ['章节过滤', '搜索章节', '全部章节', '当前章节'], values: ['all', 'current'] },
    readerSearchHighlightColor: { label: '阅读器搜索命中高亮颜色', description: '控制正文搜索命中的 mark 颜色。', aliases: ['搜索高亮颜色', '命中高亮'], values: ['amber', 'blue', 'green', 'pink', 'violet', 'red'] },
    defaultAiMode: { label: '默认 AI 模式', description: '控制默认使用本地、云端或 mock AI。', aliases: ['AI模式', '默认AI模式'], values: ['local', 'cloud', 'mock'] },
    aiDefaultScope: { label: 'AI 默认分析范围', description: '控制问答默认发送的上下文范围。', aliases: ['AI分析范围', '默认分析范围', '上下文范围'], values: ['selection', 'page-lite', 'page', 'chapter', 'volume', 'book', 'annotations', 'library'] },
    experimentalAiToolCallingEnabled: { label: 'AI 工具调用', description: '开启 Agent 工具调用能力。', aliases: ['AI工具调用', 'Agent模式', '工具调用'] },
    readerReadAloudEnabled: { label: '朗读设置', description: '开启或关闭阅读器朗读功能。', aliases: ['朗读设置', '朗读', 'TTS'] },
    readerReadAloudRate: { label: '朗读语速', description: '朗读语速百分比。', aliases: ['朗读语速', '语速'] },
    readerReadAloudPitch: { label: '朗读音高', description: '朗读音高百分比。', aliases: ['朗读音高', '音高'] },
    readerReadAloudNarratorVoiceURI: { label: '旁白朗读声音', description: '旁白文本使用的朗读 voiceURI。', aliases: ['朗读', '旁白', '旁白声音', '朗读声音', '声音', 'voice'] },
    readerReadAloudMaleVoiceURI: { label: '男性角色朗读声音', description: '男性角色台词使用的朗读 voiceURI。', aliases: ['朗读', '男声', '男性声音', '男性角色', '角色声音', '声音', 'voice'] },
    readerReadAloudFemaleVoiceURI: { label: '女性角色朗读声音', description: '女性角色台词使用的朗读 voiceURI。', aliases: ['朗读', '女声', '女性声音', '女性角色', '角色声音', '声音', 'voice'] },
    readerReadAloudCharacterVoiceRules: { label: '角色朗读声音规则', description: '按角色名指定朗读 voiceURI 的规则文本。', aliases: ['朗读', '角色声音', '角色朗读', '人物声音', '分男女', '旁白', '声音规则', 'voice rules'] },
    reduceMotion: { label: '减少动效', description: '降低界面动画和动效。', aliases: ['减少动效', '动画', '无障碍'] },
    highContrast: { label: '高对比', description: '启用高对比显示。', aliases: ['高对比', '无障碍'] },
    enhancedFocus: { label: '增强焦点', description: '增强键盘焦点可见性。', aliases: ['焦点', '增强焦点', '无障碍'] },
    largeTouchTargets: { label: '大触控目标', description: '增大可点击控件目标。', aliases: ['大触控', '触控目标', '无障碍'] },
    moyuReaderProfile: {
      label: '摸鱼模式',
      description: '摸鱼阅读器配置，包括窗口、透明度、工具栏、锁定交互、自动滚动和贴边吸附。',
      aliases: ['摸鱼', '摸鱼模式', '摸鱼设置', '悬浮窗口', '背景透明度', '文字不透明度', '文字缩放', '默认隐藏工具栏', '工具栏显示方式', '悬停延迟', '显示滚动条', '窗口比例锁定', '窗口宽度', '窗口高度', '窗口预设', '记住窗口位置', '贴边吸附', '锁定交互', '离开时隐藏正文', '自动滚动', '自动滚动速度', 'floating window', 'locked', 'locked interaction', 'textOpacity', 'textScale', 'toolbarRevealMode', 'toolbarRevealDelayMs', 'windowAspectLock', 'windowWidth', 'windowHeight', 'windowPreset', 'rememberWindowPosition', 'windowSnapToEdges'],
    },
    operationLogRetention: { label: '操作日志保留', description: '操作日志保留数量。', aliases: ['日志', '操作日志', '日志保留'] },
    taskLogRetention: { label: '任务日志保留', description: '任务日志保留策略。', aliases: ['日志', '任务日志'] },
  },
};

const settingsSearchKeywordGroups: Array<{ branch: ReaderSettingDescriptor['branch']; keys: string[]; keywords: string[] }> = [
  { branch: 'extended', keywords: ['应用基础', '设置管理', '默认启动页面', '启动总览内容', '设置变更历史', '恢复全部默认设置', 'management'], keys: ['startupPage', 'openLastReaderBookOnStartup', 'restoreLastReaderPositionOnStartup', 'startupOverviewMode', 'rememberWindowGeometry'] },
  { branch: 'extended', keywords: ['恢复阅读器默认设置'], keys: ['readerThemeFollowsApp', 'autoSaveReaderPosition', 'readerProgressMode'] },
  { branch: 'extended', keywords: ['侧栏默认展开', '折叠', '顶栏按钮配置', '导航项显示', '隐藏', '页面标题显示模式'], keys: ['sidebarCollapsed', 'libraryPanelPersistent', 'topbarButtonVisibility', 'visibleNavItems', 'pageTitleMode'] },
  { branch: 'reader', keywords: ['字体排版', '排版', 'Typography'], keys: ['fontFamily', 'customFontFamily', 'fontSize', 'lineHeight', 'paragraphSpacing', 'letterSpacing', 'firstLineIndent', 'fontWeightBoost', 'mixedTextSpacing', 'cjkPunctuationHanging'] },
  { branch: 'reader', keywords: ['边距', 'Margins'], keys: ['bodyMarginX', 'bodyMarginY', 'narrowBodyMarginX', 'narrowBodyMarginY', 'headerMarginX', 'headerMarginY', 'footerMarginX', 'footerMarginY', 'pageGap'] },
  { branch: 'reader', keywords: ['清空', 'Clear'], keys: ['customBackgroundColor', 'customTextColor', 'customSelectionColor'] },
  { branch: 'extended', keywords: ['阅读状态'], keys: ['autoSaveReaderPosition', 'readerPositionSaveDebounceMs', 'multiWindowReaderSync', 'booksOpenInStandaloneReader', 'multiWindowConflictStrategy', 'readerProgressMode', 'readerHistoryStackLimit', 'readerDailyGoalEnabled'] },
  { branch: 'chapterRules', keywords: ['解析总开关', 'parser'], keys: ['enabled'] },
  { branch: 'extended', keywords: ['解析总开关'], keys: ['autoParseTocOnImport', 'autoRebuildTocWhenEmpty', 'tocRuleChangeRebuildMode', 'previewTocRebuildDiff'] },
  { branch: 'extended', keywords: ['手工目录编辑', 'editing'], keys: ['tocAllowRename', 'tocAllowHide', 'tocAllowUnhide', 'tocAllowSplit', 'tocAllowMergeNext', 'tocAllowRestoreDefault', 'tocAllowUndoRedo'] },
  { branch: 'chapterRules', keywords: ['解析预览'], keys: ['paragraphMode', 'customRegexRules', 'customCleanupRules'] },
  { branch: 'chapterRules', keywords: ['书名识别'], keys: ['autoDetectBookTitle', 'bookTitleBracketMode', 'customBookTitleBracketPattern', 'bookTitleMaxLength', 'firstLineAsBookTitle', 'inferBookTitleFromFileName'] },
  { branch: 'extended', keywords: ['导入', 'txt编码', '文件过滤', '重复导入', '书库'], keys: ['defaultImportPath', 'importFileFilter', 'txtImportEncodingMode', 'openImportedBookAfterImport', 'directoryImportRecursive', 'showImportSummaryAfterImport', 'continueDirectoryImportAfterFailure', 'autoCleanTxtOnImport', 'autoParseTocOnImport', 'autoBackupImportedOriginals', 'duplicateStrategy', 'defaultViewMode', 'defaultSort', 'defaultFilter', 'libraryDensity'] },
  { branch: 'extended', keywords: ['批量操作', '默认视图', '默认排序', '默认筛选', '最近书籍'], keys: ['defaultViewMode', 'defaultSort', 'defaultFilter', 'libraryDensity', 'recordRecentReaderBooks', 'confirmMoveToTrash', 'confirmPermanentDelete', 'confirmEmptyTrash'] },
  { branch: 'extended', keywords: ['快捷键', '命令面板', '导航快捷键', '阅读器快捷键', '搜索快捷键', '交互'], keys: ['globalShortcutsEnabled', 'commandPaletteIncludesSettings', 'commandPaletteShortcut', 'commandPaletteShowDescriptions', 'commandPaletteSortMode', 'navigationShortcuts', 'importShortcut', 'aiSummaryShortcut', 'readerShortcuts', 'contextMenuEnabled', 'arrowKeyPaging', 'spaceKeyPaging', 'escapeClosesPanels', 'homeEndJump', 'vimStyleNavigation', 'doubleClickWordSelectionEnabled', 'pageClickPaging', 'gesturePagingEnabled', 'gesturePagingThresholdPx', 'autoHideCursor', 'pageTurnSound'] },
  { branch: 'extended', keywords: ['冲突检测', '鼠标', '键盘'], keys: ['globalShortcutsEnabled', 'readerShortcuts', 'navigationShortcuts', 'contextMenuEnabled', 'arrowKeyPaging', 'spaceKeyPaging', 'escapeClosesPanels', 'homeEndJump', 'vimStyleNavigation', 'doubleClickWordSelectionEnabled', 'pageClickPaging', 'gesturePagingEnabled', 'gesturePagingThresholdPx', 'autoHideCursor'] },
  { branch: 'extended', keywords: ['标注', '注释', '知识库', '高亮', '书签', '闪卡', '导出', 'templates'], keys: ['defaultHighlightColor', 'highlightColorShortcuts', 'highlightColorMeanings', 'defaultHighlightImportance', 'defaultHighlightReviewStatus', 'highlightOverlapStrategy', 'anchorRepairStrategy', 'defaultExportFormat', 'annotationExportContent', 'annotationJsonImportConflictStrategy', 'annotationMarkdownTemplate', 'annotationExportLastDirectory', 'annotationCsvFields', 'ankiDefaultTags', 'obsidianWikiLinks', 'logseqPropertyFormat', 'readwiseDefaultAuthor', 'annotationTagSuggestionsEnabled', 'annotationMarkdownEditorEnabled', 'selectionMenuEnabled', 'openNoteAfterHighlight', 'allowEmptyNotes', 'noteDefaultSaveTarget', 'noteAutoReaderLocation', 'noteAutoContext', 'noteTemplate', 'defaultBookmarkSort', 'defaultBookmarkGroupBy', 'defaultBookmarkTags', 'defaultBookmarkColor', 'bookmarkTitleFromChapter', 'knowledgeDefaultColumns', 'highlightFlashcardGenerationEnabled'] },
  { branch: 'extended', keywords: ['重要性', '复习状态', '锚点修复', '分组', '字段'], keys: ['defaultHighlightImportance', 'defaultHighlightReviewStatus', 'anchorRepairStrategy', 'defaultBookmarkGroupBy', 'annotationCsvFields', 'knowledgeDefaultColumns', 'tocTitleGroupingEnabled', 'tocTitleGroupKeywords', 'tocTitleGroupRules'] },
  { branch: 'extended', keywords: ['全局搜索', '搜索历史', '保存搜索', '搜索范围', '搜索归一化', '模糊', '大小写', '繁简', '拼音', '索引任务', 'timing', 'normalization'], keys: ['searchScope', 'searchLimit', 'globalSearchMode', 'globalSearchDebounceMs', 'globalSearchSnippetLength', 'globalSearchShowScore', 'globalSearchHistoryLimit', 'globalSearchSavedLimit', 'caseSensitive', 'fuzzy', 'regex', 'readerSearchRegexFallbackLiteral', 'searchNormalizeTraditionalChinese', 'searchNormalizeNfkc', 'searchPinyinInitials', 'autoIndexImportedBooks', 'indexStrategyVersion', 'indexChunkSize', 'indexChunkOverlap', 'indexRebuildStrategy', 'ftsRepairStrategy', 'indexPauseResumeStrategy', 'readerSearchHistoryLimit', 'readerSavedSearchLimit'] },
  { branch: 'extended', keywords: ['日志', '诊断', '操作日志', '任务日志', '索引诊断', '实验项', 'developer', 'package', 'information', 'experiments'], keys: ['operationLogRecordInputContent', 'operationLogRecordPaths', 'operationLogRetention', 'taskLogRetention', 'copyDiagnosticsAutoRedact', 'readerFpsDiagnosticsEnabled', 'readerMemoryWarningEnabled', 'indexRecentErrorLimit', 'experimentalAiToolCallingEnabled', 'experimentalEpubPdfEnabled', 'experimentalKnowledgeGraphEnabled', 'experimentalSyncEnabled'] },
  { branch: 'extended', keywords: ['系统信息', 'Tauri', '命令失败', '复制错误'], keys: ['operationLogRecordInputContent', 'operationLogRecordPaths', 'copyDiagnosticsAutoRedact'] },
  { branch: 'extended', keywords: ['备份', '数据', '隐私', '本机加密', '主密码', 'security', 'encryption', 'password'], keys: ['dataAutoBackupEnabled', 'dataAutoBackupFrequency', 'dataAutoBackupRetentionLimit', 'dataBackupMode', 'applicationPrivacyMode', 'hideRecentReadingInPrivacyMode', 'hideFilePathsInPrivacyMode', 'hideBookTitlesInPrivacyMode', 'appLockEnabled', 'appLockIdleTimeoutMinutes', 'copyDiagnosticsAutoRedact'] },
  { branch: 'extended', keywords: ['安全', '恢复', '阅读缓存', '页面缓存', '云端历史', '孤儿记录', 'VACUUM', 'orphan', 'records'], keys: ['applicationPrivacyMode', 'appLockEnabled', 'dataAutoBackupEnabled', 'readerPageCacheEnabled', 'readerPagePreheatEnabled', 'readerPageCacheLimit', 'cloudAiRequestHistoryEnabled', 'cloudAiRequestHistoryLimit', 'operationLogRetention'] },
  { branch: 'extended', keywords: ['任务与性能', '性能调优面板', '索引吞吐', '阅读内存', '大书模式', '任务中心', '并发', '解析并发', '写入串行', '自动重试', '未完成任务', '通知', '排队任务', '错误详情', '虚拟章节', '大段落窗口', 'tuning', 'throughput', 'notifications'], keys: ['largeBookPerformanceMode', 'readerMemoryWarningEnabled', 'readerMemoryWarningThresholdMb', 'taskConcurrency', 'importConcurrency', 'parseConcurrency', 'ftsWriteSerial', 'vectorConcurrencyReserved', 'taskRetryCount', 'taskAutoRunQueuedWhenIdle', 'taskCenterDefaultStatusFilter', 'completedTaskRetentionLimit', 'backgroundTaskNotificationMode', 'autoShowTaskCenterForLongOperations', 'errorDetailsDefaultExpanded', 'virtualChapterRadius', 'virtualParagraphWindowSize'] },
  { branch: 'extended', keywords: ['无障碍', '高对比', '焦点', '动效', '动画', '颜色辅助', '语言', '屏幕阅读器', '翻译回退', '朗读', '朗读角色声音', 'accessibility', 'assistance'], keys: ['reduceMotion', 'highContrast', 'enhancedFocus', 'largeTouchTargets', 'colorBlindFriendlyHighlights', 'translationFallbackStrategy', 'readerReadAloudEnabled', 'readerReadAloudRate', 'readerReadAloudPitch', 'readerReadAloudNarratorVoiceURI', 'readerReadAloudMaleVoiceURI', 'readerReadAloudFemaleVoiceURI', 'readerReadAloudCharacterVoiceRules'] },
  { branch: 'extended', keywords: ['摸鱼', '摸鱼模式', '摸鱼设置'], keys: ['moyuReaderProfile'] },
  { branch: 'appSettings', keywords: ['provider', 'Provider', '模型库', '模型设置', '模型能力', '视觉理解', '推理模型', '工具调用', '收藏模型', 'api key', 'Base URL'], keys: ['aiProviderProfiles', 'aiApiKey', 'aiApiBaseUrl', 'aiEndpointMode', 'aiModel', 'aiActiveProviderProfileId', 'aiRequestTimeoutSecs', 'aiRetryCount', 'aiStreamingEnabled', 'aiReasoningEffort', 'aiResponseFormat'] },
  { branch: 'appSettings', keywords: ['日志', '操作日志'], keys: ['operationLogLevel'] },
];

const settingsSearchPhraseTranslations: Array<{ phrases: string[]; tokens: string[] }> = [
  { phrases: ['ai', '模型'], tokens: ['ai'] },
  { phrases: ['provider'], tokens: ['provider'] },
  { phrases: ['api key', 'apikey', '密钥'], tokens: ['key'] },
  { phrases: ['base url', 'baseurl', '代理地址', '地址'], tokens: ['url'] },
  { phrases: ['top_p', 'topp'], tokens: ['top', 'p'] },
  { phrases: ['temperature'], tokens: ['temperature'] },
  { phrases: ['max tokens', 'maxtokens'], tokens: ['max', 'tokens'] },
  { phrases: ['token'], tokens: ['token'] },
  { phrases: ['云端'], tokens: ['cloud'] },
  { phrases: ['本地'], tokens: ['local'] },
  { phrases: ['索引'], tokens: ['index'] },
  { phrases: ['sidecar'], tokens: ['sidecar'] },
  { phrases: ['请求'], tokens: ['request'] },
  { phrases: ['取消'], tokens: ['cancel'] },
  { phrases: ['超时'], tokens: ['timeout'] },
  { phrases: ['重试'], tokens: ['retry'] },
  { phrases: ['流式'], tokens: ['streaming'] },
  { phrases: ['刷新'], tokens: ['refresh'] },
  { phrases: ['节流'], tokens: ['flush'] },
  { phrases: ['历史'], tokens: ['history'] },
  { phrases: ['记录'], tokens: ['record'] },
  { phrases: ['保留', '保留数量', '数量', '上限'], tokens: ['limit'] },
  { phrases: ['保存'], tokens: ['save'] },
  { phrases: ['失败'], tokens: ['failed'] },
  { phrases: ['停止'], tokens: ['stopped'] },
  { phrases: ['回退'], tokens: ['fallback'] },
  { phrases: ['开关', '启用', '开启', '是否允许'], tokens: ['enabled'] },
  { phrases: ['配置'], tokens: ['config'] },
  { phrases: ['默认'], tokens: ['default'] },
  { phrases: ['范围'], tokens: ['scope'] },
  { phrases: ['优先级'], tokens: ['priority'] },
  { phrases: ['策略'], tokens: ['strategy'] },
  { phrases: ['无选区'], tokens: ['no', 'selection'] },
  { phrases: ['自动'], tokens: ['auto'] },
  { phrases: ['降级'], tokens: ['downgrade'] },
  { phrases: ['斜杠', '/summary', '/characters', '/foreshadow', '/cards'], tokens: ['slash', 'command'] },
  { phrases: ['命令'], tokens: ['command'] },
  { phrases: ['菜单'], tokens: ['menu'] },
  { phrases: ['模板'], tokens: ['template'] },
  { phrases: ['检索'], tokens: ['retrieval'] },
  { phrases: ['改写'], tokens: ['rewrite'] },
  { phrases: ['多阶段'], tokens: ['multi', 'stage'] },
  { phrases: ['混合'], tokens: ['hybrid'] },
  { phrases: ['结果'], tokens: ['result'] },
  { phrases: ['引用'], tokens: ['citation'] },
  { phrases: ['最小'], tokens: ['min'] },
  { phrases: ['置信度'], tokens: ['confidence'] },
  { phrases: ['输出'], tokens: ['output'] },
  { phrases: ['格式'], tokens: ['format'] },
  { phrases: ['强制'], tokens: ['require'] },
  { phrases: ['警告'], tokens: ['warning'] },
  { phrases: ['覆盖率'], tokens: ['coverage'] },
  { phrases: ['展开'], tokens: ['expanded'] },
  { phrases: ['外部'], tokens: ['external'] },
  { phrases: ['来源'], tokens: ['citation'] },
  { phrases: ['禁用'], tokens: ['disabled'] },
  { phrases: ['回跳', '跳转'], tokens: ['jump'] },
  { phrases: ['修复'], tokens: ['repair'] },
  { phrases: ['渲染'], tokens: ['rendered'] },
  { phrases: ['块'], tokens: ['block'] },
  { phrases: ['结构化'], tokens: ['structured'] },
  { phrases: ['响应', '回答'], tokens: ['response'] },
  { phrases: ['发送前确认', '确认'], tokens: ['confirmation'] },
  { phrases: ['授权'], tokens: ['consent'] },
  { phrases: ['脱敏'], tokens: ['redact'] },
  { phrases: ['敏感词', '黑名单'], tokens: ['sensitive', 'words'] },
  { phrases: ['预览'], tokens: ['preview'] },
  { phrases: ['选中文本'], tokens: ['selection', 'text'] },
  { phrases: ['当前页'], tokens: ['current', 'page'] },
  { phrases: ['整章'], tokens: ['current', 'chapter'] },
  { phrases: ['整本书摘要'], tokens: ['book', 'summary'] },
  { phrases: ['自定义'], tokens: ['custom'] },
  { phrases: ['术语'], tokens: ['terminology'] },
  { phrases: ['点击目标', '触控目标'], tokens: ['touch', 'targets'] },
  { phrases: ['最小尺寸'], tokens: ['large'] },
  { phrases: ['减少动画', '减少动效'], tokens: ['reduce', 'motion'] },
  { phrases: ['高对比'], tokens: ['contrast'] },
  { phrases: ['焦点'], tokens: ['focus'] },
  { phrases: ['标注'], tokens: ['annotation'] },
  { phrases: ['注释', '备注'], tokens: ['note'] },
  { phrases: ['浮动菜单'], tokens: ['selection', 'menu'] },
  { phrases: ['空备注'], tokens: ['empty', 'notes'] },
  { phrases: ['保存位置'], tokens: ['save', 'target'] },
  { phrases: ['上下文'], tokens: ['context'] },
  { phrases: ['reader://', 'reader位置'], tokens: ['reader', 'location'] },
  { phrases: ['颜色'], tokens: ['color'] },
  { phrases: ['含义'], tokens: ['meanings'] },
  { phrases: ['标签'], tokens: ['tag'] },
  { phrases: ['建议'], tokens: ['suggestions'] },
  { phrases: ['markdown'], tokens: ['markdown'] },
  { phrases: ['编辑器'], tokens: ['editor'] },
  { phrases: ['anki'], tokens: ['anki'] },
  { phrases: ['obsidian'], tokens: ['obsidian'] },
  { phrases: ['wiki'], tokens: ['wiki'] },
  { phrases: ['logseq'], tokens: ['logseq'] },
  { phrases: ['property'], tokens: ['property'] },
  { phrases: ['readwise'], tokens: ['readwise'] },
  { phrases: ['作者'], tokens: ['author'] },
  { phrases: ['知识节点', '知识库'], tokens: ['knowledge'] },
  { phrases: ['双向链接'], tokens: ['bidirectional', 'links'] },
  { phrases: ['目录'], tokens: ['toc'] },
  { phrases: ['重建'], tokens: ['rebuild'] },
  { phrases: ['规则'], tokens: ['rule'] },
  { phrases: ['标题'], tokens: ['title'] },
  { phrases: ['禁止'], tokens: ['forbidden'] },
  { phrases: ['标点'], tokens: ['punctuation'] },
  { phrases: ['开头'], tokens: ['start'] },
  { phrases: ['字符'], tokens: ['chars'] },
  { phrases: ['拆分'], tokens: ['split'] },
  { phrases: ['书名'], tokens: ['book', 'title'] },
  { phrases: ['括号'], tokens: ['bracket'] },
  { phrases: ['正则'], tokens: ['regex'] },
  { phrases: ['应用锁'], tokens: ['app', 'lock'] },
  { phrases: ['加密覆盖范围', '加密'], tokens: ['encrypt'] },
  { phrases: ['最近阅读'], tokens: ['recent', 'reader', 'books'] },
  { phrases: ['阅读时长'], tokens: ['reading', 'time'] },
  { phrases: ['设置作用域', '作用域'], tokens: ['scope'] },
  { phrases: ['便携'], tokens: ['portable'] },
  { phrases: ['路径'], tokens: ['path'] },
  { phrases: ['完成任务'], tokens: ['completed', 'task'] },
  { phrases: ['实验', '实验性'], tokens: ['experimental'] },
  { phrases: ['epub', 'mobi', 'pdf'], tokens: ['epub', 'mobi', 'pdf'] },
  { phrases: ['多窗口'], tokens: ['multi', 'window'] },
  { phrases: ['知识图谱'], tokens: ['knowledge', 'graph'] },
  { phrases: ['同步'], tokens: ['sync'] },
  { phrases: ['tab'], tokens: ['tab'] },
  { phrases: ['排序筛选'], tokens: ['sort', 'filter'] },
  { phrases: ['显示密度'], tokens: ['density'] },
  { phrases: ['文件过滤'], tokens: ['file', 'filter'] },
  { phrases: ['外部路径'], tokens: ['external', 'path'] },
  { phrases: ['封面色'], tokens: ['cover', 'tone'] },
  { phrases: ['封面标签'], tokens: ['cover', 'label'] },
  { phrases: ['识别作者'], tokens: ['detect', 'author'] },
  { phrases: ['删除前'], tokens: ['delete', 'confirm'] },
  { phrases: ['永久删除'], tokens: ['permanent', 'delete'] },
  { phrases: ['重复文件'], tokens: ['duplicate'] },
  { phrases: ['便携模式'], tokens: ['data'] },
  { phrases: ['当前书籍设置'], tokens: ['reader'] },
  { phrases: ['阅读预设'], tokens: ['preset'] },
  { phrases: ['预设'], tokens: ['preset'] },
  { phrases: ['垂直对齐'], tokens: ['vertical', 'align'] },
  { phrases: ['长段落'], tokens: ['long', 'paragraph'] },
  { phrases: ['分页策略'], tokens: ['strategy'] },
  { phrases: ['中文标点', '挤压', '悬挂'], tokens: ['punctuation', 'hanging'] },
  { phrases: ['中英文混排'], tokens: ['mixed', 'text'] },
  { phrases: ['粗体'], tokens: ['font', 'weight'] },
  { phrases: ['标题对齐'], tokens: ['title', 'align'] },
  { phrases: ['装饰线'], tokens: ['decoration'] },
  { phrases: ['时间格式'], tokens: ['time', 'format'] },
  { phrases: ['进度显示'], tokens: ['progress', 'format'] },
  { phrases: ['阅读位置'], tokens: ['reader', 'position'] },
  { phrases: ['保存频率'], tokens: ['debounce'] },
  { phrases: ['冲突策略'], tokens: ['conflict', 'strategy'] },
  { phrases: ['进度计算'], tokens: ['progress', 'mode'] },
  { phrases: ['历史栈'], tokens: ['history', 'stack'] },
  { phrases: ['大书'], tokens: ['large', 'book'] },
  { phrases: ['分页缓存'], tokens: ['page', 'cache'] },
  { phrases: ['页面测量'], tokens: ['page', 'measure'] },
  { phrases: ['内存上限', '内存'], tokens: ['memory', 'warning'] },
  { phrases: ['预热'], tokens: ['preheat'] },
  { phrases: ['chunk'], tokens: ['chunk'] },
  { phrases: ['fts'], tokens: ['fts'] },
  { phrases: ['命令描述'], tokens: ['command', 'descriptions'] },
  { phrases: ['命令排序'], tokens: ['command', 'sort'] },
  { phrases: ['右键菜单'], tokens: ['context', 'menu'] },
  { phrases: ['esc'], tokens: ['escape'] },
  { phrases: ['home', 'end'], tokens: ['home', 'end'] },
  { phrases: ['vim'], tokens: ['vim'] },
  { phrases: ['双击选词'], tokens: ['double', 'click', 'word', 'selection'] },
  { phrases: ['文字不透明度'], tokens: ['text', 'opacity'] },
  { phrases: ['文字缩放'], tokens: ['text', 'scale'] },
  { phrases: ['工具栏'], tokens: ['toolbar'] },
  { phrases: ['悬停延迟'], tokens: ['delay'] },
  { phrases: ['窗口比例'], tokens: ['aspect', 'lock'] },
  { phrases: ['窗口宽度'], tokens: ['window', 'width'] },
  { phrases: ['窗口高度'], tokens: ['window', 'height'] },
  { phrases: ['窗口预设'], tokens: ['window', 'preset'] },
  { phrases: ['窗口位置'], tokens: ['window', 'position'] },
  { phrases: ['贴边吸附'], tokens: ['snap', 'edges'] },
];

const manualSettingDescriptors: ReaderSettingDescriptor[] = [
  readerSetting('fontFamily', '字体', '阅读正文字体。可传字体族字符串，常用别名如“霞鹜文楷”会规范化为真实 fontFamily。', ['字体', 'font', 'fontFamily', '字形', '阅读字体'], 'string', { fontFamily: '霞鹜文楷' }),
  readerSetting('theme', '背景主题', '阅读器内置背景主题。只能使用 values 中的枚举值；自定义颜色请改 customBackgroundColor。', ['背景', '主题', '底色', '护眼', '夜间', 'theme', 'background'], 'enum', { theme: 'eyeComfort' }, ['white', 'paper', 'eyeComfort', 'dark', 'oled', 'system', 'light', 'night', 'sepia']),
  readerSetting('customBackgroundColor', '自定义背景色', '阅读正文区域自定义背景色。必须是 #rgb 或 #rrggbb；设置后通常会进入 custom 预设。', ['背景', '背景色', '自定义背景', 'customBackgroundColor', 'backgroundColor', '底色'], 'color', { customBackgroundColor: '#f4ead2' }),
  readerSetting('customTextColor', '自定义文字颜色', '阅读正文文字颜色。必须是 #rgb 或 #rrggbb。', ['文字颜色', '文本颜色', '前景色', 'customTextColor', 'textColor', 'foregroundColor', 'color'], 'color', { customTextColor: '#111111' }),
  readerSetting('fontSize', '字号', '阅读正文字号，单位 px；保存时会按阅读器允许范围规范化。', ['字号', '字体大小', 'fontSize', 'size'], 'number', { fontSize: 22 }),
  readerSetting('lineHeight', '行距', '阅读正文行高。建议 1.2-2.4。', ['行距', '行高', 'lineHeight'], 'number', { lineHeight: 1.8 }),
  readerSetting('paragraphSpacing', '段距', '段落之间的间距，单位 px。', ['段距', '段落间距', 'paragraphSpacing'], 'number', { paragraphSpacing: 20 }),
  readerSetting('pageWidth', '页面宽度', '阅读正文页面最大宽度，单位 px。', ['页宽', '页面宽度', 'pageWidth'], 'number', { pageWidth: 920 }),
  readerSetting('layoutMode', '阅读布局', '阅读器正文布局模式。page 为分页，flow 为流式滚动。', ['布局', '翻页', '滚动', 'layoutMode'], 'enum', { layoutMode: 'flow' }, ['page', 'flow']),
  readerSetting('pageMode', '单双页', '分页模式下的单页/双页/自动。', ['页面模式', 'Page Mode', '单双页', '单页', '双页', 'pageMode'], 'enum', { pageMode: 'single' }, ['single', 'double', 'auto']),
  readerSetting('wheelPaging', '滚轮翻页', '是否允许鼠标滚轮触发翻页。', ['滚轮翻页', 'wheelPaging'], 'boolean', { wheelPaging: true }),
  readerSetting('headerVisible', '页眉', '是否显示阅读器页眉。', ['页眉', 'headerVisible'], 'boolean', { headerVisible: true }),
  readerSetting('footerVisible', '页脚', '是否显示阅读器页脚。', ['页脚', 'footerVisible'], 'boolean', { footerVisible: true }),
  extendedSetting('readerDailyGoalEnabled', '每日阅读目标', '开启后阅读器工具栏显示当前会话相对每日页数、分钟和章节目标的进度。传 true 开启，false 关闭。', ['每日阅读目标', '每日目标', '阅读目标', '目标进度', 'readerDailyGoalEnabled'], 'boolean', { readerDailyGoalEnabled: true }),
  extendedSetting('readerDailyPagesGoal', '每日页数目标', '每天期望阅读的页数，范围 0-1000；0 表示不统计页数目标。该设置在 ExtendedSettings 中以字符串保存。', ['每日阅读目标', '每日页数目标', '页数目标', '每天页数', 'readerDailyPagesGoal'], 'integerString', { readerDailyPagesGoal: 30 }, undefined, { min: 0, max: 1000 }),
  extendedSetting('readerDailyMinutesGoal', '每日分钟目标', '每天期望阅读的分钟数，范围 0-1440；0 表示不统计时长目标。该设置在 ExtendedSettings 中以字符串保存。', ['每日阅读目标', '每日分钟目标', '分钟目标', '时长目标', 'readerDailyMinutesGoal'], 'integerString', { readerDailyMinutesGoal: 30 }, undefined, { min: 0, max: 1440 }),
  extendedSetting('readerDailyChaptersGoal', '每日章节目标', '每天期望完成的章节数，范围 0-200；0 表示不统计章节目标。该设置在 ExtendedSettings 中以字符串保存。', ['每日阅读目标', '每日章节目标', '章节目标', '每天章节', 'readerDailyChaptersGoal'], 'integerString', { readerDailyChaptersGoal: 2 }, undefined, { min: 0, max: 200 }),
  chapterRuleSetting('customCleanupRules', '自定义清洗规则', '按优先级执行自定义 TXT 清洗规则；remove-line 删除整行，replace 执行正则替换。', ['自定义清洗规则', '清洗规则', '自定义清理', '清洗', '清理'], 'array', { customCleanupRules: [{ name: '删除广告行', enabled: true, mode: 'remove-line', pattern: '书友群\\s*\\d+', replacement: '' }] }),
  chapterRuleSetting('normalizeFullWidthSpaces', '半角/全角空格清洗', '归一化半角/全角空格。', ['半角全角空格清洗', '全角空格', '空格清洗', '清洗'], 'boolean', { normalizeFullWidthSpaces: true }),
  chapterRuleSetting('removeAds', '广告清理', 'TXT 清理阶段移除广告行。', ['广告清理', '清洗', '清理', '广告'], 'boolean', { removeAds: true }),
  chapterRuleSetting('adKeywords', '广告关键词列表', '用逗号或换行分隔；命中任一关键词的整行会在 TXT 清理阶段移除。', ['广告关键词列表', '广告关键词', '扫码关注', 'QQ群', '下载APP', 'follow us', 'QQ group', 'download app', '清洗', '清理'], 'string', { adKeywords: '扫码关注,QQ群,下载APP' }),
  localeSetting('localePreference', '界面语言', '设置中心界面语言偏好。system 跟随系统，zh-CN 使用中文，en-US 使用英文，ja-JP 使用日语，es-ES 使用西班牙语，fr-FR 使用法语，ko-KR 使用韩语。', ['界面语言', '语言', 'Interface Language', 'language', 'locale', '中文', '英文', '英语', '日语', '西班牙语', '法语', '韩语', 'Japanese', 'Spanish', 'French', 'Korean'], 'enum', { localePreference: 'zh-CN' }, ['system', 'zh-CN', 'en-US', 'ja-JP', 'es-ES', 'fr-FR', 'ko-KR']),
];

const readerSettingDescriptors: ReaderSettingDescriptor[] = buildCompleteSettingDescriptors();

const readerFontAliases: Array<{ patterns: RegExp[]; value: string }> = [
  {
    patterns: [/霞鹜/u, /lxgw/i, /文楷/u],
    value: '"LXGW WenKai", "Source Han Serif SC", serif',
  },
  {
    patterns: [/微软雅黑/u, /雅黑/u, /microsoft\s*yahei/i, /sans/i],
    value: '"Microsoft YaHei", "HarmonyOS Sans SC", sans-serif',
  },
  {
    patterns: [/georgia/i, /衬线/u, /serif/i],
    value: 'Georgia, "LXGW WenKai", "Source Han Serif SC", serif',
  },
];

const AGENT_RENDERABLE_FORMATS: AgentRenderableFormat[] = [
  { type: 'paragraph', aliases: ['answer'], title: '段落回答', description: '适合普通说明、分析结论、问答正文。', fields: ['id', 'type', 'title', 'content', 'citationIds'], exampleBlock: { id: 'answer_1', type: 'paragraph', title: '回答', content: '这里写结论和解释。', citationIds: ['c1'] } },
  { type: 'heading', title: '标题', description: '用于在结构化回答中插入小标题。', fields: ['id', 'type', 'title', 'content'], exampleBlock: { id: 'heading_1', type: 'heading', content: '人物动机' } },
  { type: 'quote', title: '引用块', description: '突出展示原文、证据或关键句。', fields: ['id', 'type', 'title', 'content', 'citationIds'], exampleBlock: { id: 'quote_1', type: 'quote', title: '关键原文', content: '原文引用片段。', citationIds: ['c1'] } },
  { type: 'bullet_list', title: '要点清单', description: '展示若干短要点或步骤。', fields: ['id', 'type', 'title', 'items[{text,citationIds}]', 'citationIds'], exampleBlock: { id: 'bullets_1', type: 'bullet_list', title: '要点', items: [{ text: '第一条判断。', citationIds: ['c1'] }] } },
  { type: 'summary', aliases: ['chapter_summary'], title: '摘要/章节报告', description: '展示章节报告、概览、开放问题和带引用的摘要点。', fields: ['id', 'type', 'title', 'content', 'bullets[{text,citationIds,action}]', 'openQuestions', 'citationIds'], exampleBlock: { id: 'summary_1', type: 'summary', title: '章节报告', content: '本章核心结论。', bullets: [{ text: '主角完成关键选择。', citationIds: ['c1'] }], openQuestions: ['这次选择的代价还未揭示。'] } },
  { type: 'evidence_list', title: '证据链', description: '按 claim 组织证据，适合需要逐条核验的回答。', fields: ['id', 'type', 'title', 'items[{claim,citationIds,references[{quote,locationHint,tool}]}]'], exampleBlock: { id: 'evidence_1', type: 'evidence_list', title: '证据链', items: [{ claim: '人物态度发生变化。', citationIds: ['c1'], references: [{ quote: '原文证据。', locationHint: '第 3 章 · P12', tool: 'search_local_index' }] }] } },
  { type: 'citation_group', title: '引用候选组', description: '展示候选引用或待确认证据。', fields: ['id', 'type', 'title', 'citations[{id,label,quote,sourceChapterIndex,paragraphIndex}]'], exampleBlock: { id: 'citation_group_1', type: 'citation_group', title: '候选引用', citations: [{ id: 'c1', label: '第 3 章 · P12', quote: '原文片段。' }] } },
  { type: 'timeline', title: '时间线', description: '展示事件顺序或章节顺序，可同步到章节时间线。', fields: ['id', 'type', 'title', 'events[{timeLabel,event,summary,kind,chapterRef,citationIds}]', 'chapterRef'], exampleBlock: { id: 'timeline_1', type: 'timeline', title: '事件时间线', events: [{ timeLabel: '第 3 章', event: '人物做出选择。', kind: 'decision', citationIds: ['c1'] }] } },
  { type: 'character_table', aliases: ['character_relationships'], title: '人物/关系表', description: '展示人物状态、阵营、关系或身份变化。', fields: ['id', 'type', 'title', 'characters[{name,role,status,evidence,citationIds}]', 'relationships[{from,to,label,evidence,citationIds}]', 'rows', 'factions'], exampleBlock: { id: 'characters_1', type: 'character_table', title: '人物关系', characters: [{ name: '张三', role: '主角', status: '态度转变', citationIds: ['c1'] }], relationships: [{ from: '张三', to: '李四', label: '同盟', evidence: '共同行动。', citationIds: ['c1'] }] } },
  { type: 'foreshadowing_list', aliases: ['foreshadowing'], title: '伏笔/冲突列表', description: '展示伏笔、潜在冲突、风险和后续验证点。', fields: ['id', 'type', 'title', 'items[{hint,payoff,confidence,status,citationIds}]'], exampleBlock: { id: 'foreshadowing_1', type: 'foreshadowing_list', title: '伏笔', items: [{ hint: '反复出现的玉佩。', payoff: '可能关联身世。', confidence: 0.7, citationIds: ['c1'] }] } },
  { type: 'flashcards', title: '闪卡', description: '生成可加入卡片库的复习卡。', fields: ['id', 'type', 'title', 'cards[{front,back,tags,citationSource,citationIds}]'], exampleBlock: { id: 'flashcards_1', type: 'flashcards', title: '复习卡', cards: [{ front: '张三在本章做了什么选择？', back: '他决定留下保护同伴。', tags: ['人物', '选择'], citationSource: '第 3 章', citationIds: ['c1'] }] } },
  { type: 'table', title: '通用表格', description: '展示可复制为 Markdown 的通用二维表格。', fields: ['id', 'type', 'title', 'columns[{key,label}]', 'rows[{[key]:value}]', 'citationIds'], exampleBlock: { id: 'table_1', type: 'table', title: '对比表', columns: [{ key: 'item', label: '项目' }, { key: 'value', label: '结论' }], rows: [{ item: '动机', value: '保护同伴' }] } },
  { type: 'suggested_actions', aliases: ['actions'], title: '建议操作', description: '展示可点击的下一步动作。', fields: ['id', 'type', 'title', 'items[{label,action,priority}]'], exampleBlock: { id: 'actions_1', type: 'suggested_actions', title: '下一步', items: [{ label: '展开前后文', action: 'explain_selection_with_window', priority: 'primary' }] } },
  { type: 'annotation', title: '批注', description: '生成可保存为批注或笔记的内容。', fields: ['id', 'type', 'title', 'annotationType', 'note', 'target', 'tags', 'citationIds'], exampleBlock: { id: 'annotation_1', type: 'annotation', annotationType: 'note', note: '这里值得标注人物动机。', tags: ['动机'], citationIds: ['c1'] } },
  { type: 'chapter_reference', title: '章节引用', description: '引用相关章节并提供跳转理由。', fields: ['id', 'type', 'title', 'reason', 'chapterRef{bookId,chapterId,sourceChapterIndex,title}', 'citationIds'], exampleBlock: { id: 'chapter_ref_1', type: 'chapter_reference', title: '相关章节', reason: '这里首次埋下伏笔。', chapterRef: { sourceChapterIndex: 2, title: '第三章' } } },
  { type: 'paragraph_reference', title: '段落引用', description: '引用具体段落并支持回跳和展开上下文。', fields: ['id', 'type', 'title', 'why', 'target{id,label,quote,sourceChapterIndex,paragraphIndex}', 'citationIds'], exampleBlock: { id: 'paragraph_ref_1', type: 'paragraph_reference', title: '证据纸条', why: '这段直接说明人物动机。', target: { id: 'c1', label: '第 3 章 · P12', quote: '原文片段。', sourceChapterIndex: 2, paragraphIndex: 11 } } },
  { type: 'diagnostics', title: '诊断信息', description: '折叠展示调试、检索或模型诊断数据。', fields: ['id', 'type', 'title', 'content', 'diagnostics'], exampleBlock: { id: 'diagnostics_1', type: 'diagnostics', title: '诊断', diagnostics: { query: '人物动机', resultCount: 8 } } },
];

export function getAgentToolCatalog(): AgentToolCatalogItem[] {
  return AGENT_TOOL_CATALOG.map((tool) => ({ ...tool, argsExample: { ...tool.argsExample }, resultExample: { ...tool.resultExample } }));
}

export function getAgentRenderableFormats(): AgentRenderableFormatsPayload {
  return {
    schema: 'bookmind.ai.response.v2',
    responseShape: {
      version: 'bookmind.ai.response.v2',
      scope: 'chapter',
      scope_label: '当前范围',
      title: '回答标题',
      blocks: [],
      citations: [{ id: 'c1', type: 'paragraph', label: '第 3 章 · P12', quote: '原文片段。' }],
    },
    formats: AGENT_RENDERABLE_FORMATS.map((format) => ({
      ...format,
      aliases: format.aliases ? [...format.aliases] : undefined,
      fields: [...format.fields],
      exampleBlock: { ...format.exampleBlock },
    })),
    looseTopLevelAccepted: ['summary', 'evidence', 'characters', 'relationships', 'timeline', 'events', 'foreshadowing', 'flashcards', 'possible_issues'],
    notes: [
      '最终回答优先返回 JSON 对象，不要用 Markdown 代码块包裹。',
      '推荐外形是 {"version":"bookmind.ai.response.v2","scope":"chapter","scope_label":"...","blocks":[...],"citations":[...]}。',
      'blocks 可以自由组合多个可渲染格式；每个 block 必须有稳定 id 和 type。',
      'block.citationIds 对应顶层 citations[].id；没有证据时不要伪造引用。',
      '兼容部分 loose top-level 字段，但新回答优先使用 blocks。',
    ],
  };
}

export function getDefaultAgentPresetPrompt() {
  const formats = getAgentRenderableFormats();
  const formatLines = formats.formats
    .map((format) => `- ${format.type}${format.aliases?.length ? `（别名：${format.aliases.join('、')}）` : ''}：${format.title}；字段：${format.fields.join('、')}`)
    .join('\n');
  return [
    '你是 BookMind 阅读研究台 Agent。这个预设提示词始终位于对话上下文顶部，必须优先遵守。',
    '先使用工具读取或检索证据，再给出结论；不要编造引用、章节位置、人物事实或工具结果。',
    '最终回答必须输出一个可被 BookMind 渲染的 JSON 对象，不要输出 Markdown 代码围栏、解释性前缀或 JSON 之外的文字。',
    '固定外形：{"version":"bookmind.ai.response.v2","scope":"selection|page|chapter|volume|book|annotations|library","scope_label":"...","title":"...","summary":"...","blocks":[...],"citations":[...]}。',
    'blocks 可组合以下格式；每个 block 都必须有唯一 id 和 type，引用时使用 citationIds 指向顶层 citations[].id：',
    formatLines,
    '文本支持行内富文本：优先使用 Markdown **加粗**、*斜体*、`代码`；也兼容 <b>/<strong>、<i>/<em>、<mark>、<u>、<del>、<small> 和 <br>。标签必须成对闭合，不能输出未闭合标签。',
    '顶层 citations 每项至少提供 id、label、quote 或 sourceText，并尽量提供 bookId、sourceChapterIndex/chapterIndex、paragraphIndex；没有证据时不要伪造引用。',
    '优先使用 blocks，不要把完整 JSON 当作 paragraph.content；普通文字使用 paragraph，标题使用 heading，证据使用 quote/evidence_list/citation_group。',
  ].join('\n');
}

export function getAgentSettingDescriptors(): ReaderSettingDescriptor[] {
  return readerSettingDescriptors.map((setting) => ({
    ...setting,
    aliases: [...setting.aliases],
    values: setting.values ? [...setting.values] : undefined,
    allowedValues: setting.allowedValues ? [...setting.allowedValues] : undefined,
    valueSchema: { ...setting.valueSchema },
    updateExample: { ...setting.updateExample },
  }));
}

export function defaultAgentSettingBranchKeyCount() {
  return {
    reader: Object.keys(defaultReaderSettings).length,
    extended: Object.keys(defaultExtendedSettings).length,
    chapterRules: Object.keys(defaultChapterRules).length,
    appSettings: Object.keys(defaultAgentAppSettings).length,
  };
}

export function getDefaultAgentEnabledTools(): string[] {
  return AGENT_TOOL_CATALOG.map((tool) => tool.name);
}

export function normalizeAgentEnabledTools(value: unknown): string[] {
  const requested = Array.isArray(value) ? value.map((item) => String(item)) : getDefaultAgentEnabledTools();
  const requestedSet = new Set(requested);
  return AGENT_TOOL_CATALOG.map((tool) => tool.name).filter((name) => requestedSet.has(name));
}

export function resolveAgentAvailableTools(enabledTools?: unknown): string[] {
  return [...normalizeAgentEnabledTools(enabledTools), 'finish'];
}

export function buildAgentChapterCatalog(chunks: Partial<TextChunk>[], options: { query?: string; limit?: number } = {}): AgentChapterCatalog {
  const grouped = groupChunksByChapter(chunks);
  const query = normalizeText(options.query ?? '');
  const limit = clampNumber(options.limit, 120, 1, 2000);
  const chapters = grouped
    .map((group) => group.entry)
    .filter((entry) => !query || normalizeText(entry.title).includes(query))
    .slice(0, limit);
  const allEntries = grouped.map((group) => group.entry);
  return {
    status: allEntries.length ? 'ready' : 'empty',
    chapterCount: allEntries.length,
    chapters,
    firstChapter: allEntries[0] ?? null,
    lastChapter: allEntries[allEntries.length - 1] ?? null,
  };
}

export function readAgentChapterText(chunks: Partial<TextChunk>[], args: Record<string, unknown> = {}): AgentReadChapterResult {
  const grouped = groupChunksByChapter(chunks);
  if (!grouped.length) {
    return { status: 'empty', message: '当前书没有可读取的章节索引。', chapterCount: 0, candidates: [] };
  }
  const match = resolveAgentChapterGroup(grouped, args);
  if (!match) {
    return {
      status: 'not-found',
      message: '没有找到指定章节。可先调用 list_chapters 查看章节编号和标题。',
      chapterCount: grouped.length,
      candidates: grouped.map((group) => group.entry).slice(0, 20),
    };
  }
  const maxChars = clampNumber(readNumber(args.maxChars, 12000), 12000, 500, 100000);
  const text = match.chunks.map((chunk) => readString(chunk.text)).filter(Boolean).join('\n\n').trim();
  const paragraphs = splitAgentChapterParagraphs(text);
  const slicedText = text.length > maxChars ? text.slice(0, maxChars) : text;
  return {
    status: 'ready',
    chapter: match.entry,
    text: args.includeText === false ? '' : slicedText,
    paragraphs: args.includeText === false ? [] : splitAgentChapterParagraphs(slicedText),
    truncated: text.length > maxChars,
  };
}

export function searchAgentChapterText(chunks: Partial<TextChunk>[], args: Record<string, unknown> = {}): AgentSearchChapterTextResult {
  const query = readString(args.query);
  if (!query) {
    return { status: 'missing-query', query: '', totalMatches: 0, chapterMatches: [], message: 'search_chapter_text 缺少 query。' };
  }
  const grouped = groupChunksByChapter(chunks);
  if (!grouped.length) {
    return { status: 'empty', query, totalMatches: 0, chapterMatches: [], message: '当前书没有可搜索的章节索引。' };
  }
  const caseSensitive = normalizeBoolean(args.caseSensitive) === true;
  const limit = clampNumber(readNumber(args.limit, 80), 80, 1, 1000);
  const perChapterLimit = clampNumber(readNumber(args.perChapterLimit, 5), 5, 1, 30);
  let totalMatches = 0;
  const chapterMatches: Array<AgentChapterCatalogEntry & { matchCount: number; snippets: string[] }> = [];
  for (const group of grouped) {
    const text = group.chunks.map((chunk) => readString(chunk.text)).filter(Boolean).join('\n\n');
    const matches = findAgentTextMatches(text, query, { caseSensitive });
    if (!matches.length) continue;
    totalMatches += matches.length;
    chapterMatches.push({
      ...group.entry,
      matchCount: matches.length,
      snippets: matches.slice(0, perChapterLimit).map((index) => createAgentSearchSnippet(text, index, query.length)),
    });
    if (chapterMatches.length >= limit) break;
  }
  if (!chapterMatches.length) {
    return { status: 'no-result', query, totalMatches: 0, chapterMatches: [], message: `没有在当前书章节文本中找到“${query}”。` };
  }
  return { status: 'ready', query, totalMatches, chapterMatches };
}

export function readAgentParagraphRange(chunks: Partial<TextChunk>[], args: Record<string, unknown> = {}): AgentReadParagraphRangeResult {
  const grouped = groupChunksByChapter(chunks);
  if (!grouped.length) {
    return { status: 'empty', message: '当前书没有可读取的章节索引。', chapterCount: 0, candidates: [] };
  }
  const match = resolveAgentChapterGroup(grouped, args);
  if (!match) {
    return {
      status: 'not-found',
      message: '没有找到指定章节。可先调用 list_chapters 查看章节编号和标题。',
      chapterCount: grouped.length,
      candidates: grouped.map((group) => group.entry).slice(0, 20),
    };
  }
  const paragraphs = splitAgentChapterParagraphs(match.chunks.map((chunk) => readString(chunk.text)).filter(Boolean).join('\n\n'));
  if (!paragraphs.length) {
    return {
      status: 'not-found',
      message: `章节「${match.entry.title}」没有可读取段落。`,
      chapterCount: grouped.length,
      candidates: grouped.map((group) => group.entry).slice(0, 20),
    };
  }
  const center = readNumber(args.paragraphIndex, 0);
  const startInput = args.paragraphStart ?? args.start ?? (Number.isFinite(center) ? center : 0);
  const endInput = args.paragraphEnd ?? args.end ?? startInput;
  const paragraphStart = Math.max(0, Math.min(paragraphs.length - 1, readNumber(startInput, 0)));
  const paragraphEnd = Math.max(paragraphStart, Math.min(paragraphs.length - 1, readNumber(endInput, paragraphStart)));
  const items = paragraphs.slice(paragraphStart, paragraphEnd + 1).map((text, index) => ({
    paragraphIndex: paragraphStart + index,
    text,
  }));
  return {
    status: 'ready',
    chapter: match.entry,
    paragraphStart,
    paragraphEnd,
    paragraphs: items,
    text: items.map((item) => item.text).join('\n\n'),
  };
}

export function buildAgentParagraphWindows(chunks: Partial<TextChunk>[], args: Record<string, unknown> = {}, citations: Array<Record<string, unknown>> = []): AgentParagraphWindowResult {
  const before = clampNumber(readNumber(args.before, 1), 1, 0, 20);
  const after = clampNumber(readNumber(args.after, 1), 1, 0, 20);
  const selectedCitations = selectAgentWindowCitations(args, citations);
  const windows = selectedCitations.length
    ? selectedCitations.flatMap((citation) => {
        const paragraphIndex = readNumber(citation.paragraphIndex, Number.NaN);
        const sourceChapterIndex = readNumber(citation.sourceChapterIndex ?? citation.chapterIndex, Number.NaN);
        if (!Number.isFinite(sourceChapterIndex) || !Number.isFinite(paragraphIndex)) {
          return [{
            citationId: citation.id as number | string | undefined,
            label: readString(citation.label) || '引用片段',
            text: readString(citation.text),
            bookId: readString(citation.bookId) || undefined,
            chapterId: readString(citation.chapterId) || undefined,
            chapterIndex: Number.isFinite(sourceChapterIndex) ? sourceChapterIndex : undefined,
            sourceChapterIndex: Number.isFinite(sourceChapterIndex) ? sourceChapterIndex : undefined,
            paragraphIndex: Number.isFinite(paragraphIndex) ? paragraphIndex : undefined,
            windowText: readString(citation.text),
            paragraphs: readString(citation.text) ? [{ paragraphIndex: Number.isFinite(paragraphIndex) ? paragraphIndex : 0, text: readString(citation.text) }] : [],
          }];
        }
        const range = readAgentParagraphRange(chunks, {
          chapterIndex: sourceChapterIndex,
          paragraphStart: paragraphIndex - before,
          paragraphEnd: paragraphIndex + after,
        });
        if (range.status !== 'ready') return [];
        return [{
          citationId: citation.id as number | string | undefined,
          label: readString(citation.label) || range.chapter.title,
          text: readString(citation.text),
          bookId: readString(citation.bookId) || undefined,
          chapterId: readString(citation.chapterId) || undefined,
          chapterIndex: sourceChapterIndex,
          sourceChapterIndex,
          paragraphIndex,
          startOffset: typeof citation.startOffset === 'number' ? citation.startOffset : undefined,
          endOffset: typeof citation.endOffset === 'number' ? citation.endOffset : undefined,
          windowText: range.text,
          paragraphs: range.paragraphs,
        }];
      })
    : [];

  if (windows.length) return { status: 'ready', windows };

  const directParagraphIndex = readNumber(args.paragraphIndex ?? args.paragraphStart ?? args.start, Number.NaN);
  if (Number.isFinite(directParagraphIndex)) {
    const range = readAgentParagraphRange(chunks, {
      ...args,
      paragraphStart: directParagraphIndex - before,
      paragraphEnd: directParagraphIndex + after,
    });
    if (range.status === 'ready') {
      return {
        status: 'ready',
        windows: [{
          label: `${range.chapter.title} · P${directParagraphIndex + 1}`,
          text: range.paragraphs.find((item) => item.paragraphIndex === directParagraphIndex)?.text ?? range.text,
          chapterIndex: range.chapter.sourceChapterIndex,
          sourceChapterIndex: range.chapter.sourceChapterIndex,
          paragraphIndex: directParagraphIndex,
          windowText: range.text,
          paragraphs: range.paragraphs,
        }],
      };
    }
  }

  return {
    status: 'no-result',
    windows: [],
    message: '没有可展开的引用或段落位置；请提供 citationIds，或 chapterIndex/sourceChapterIndex 与 paragraphIndex。',
  };
}

export function searchReaderSettings(query: string): ReaderSettingDescriptor[] {
  const normalized = normalizeText(query);
  const queryTokens = splitSettingSearchTokens(query);
  const queryTokenGroups = buildSettingSearchTokenGroups(query, queryTokens);
  if (!normalized) return readerSettingDescriptors;
  const scored = readerSettingDescriptors
    .map((descriptor, index) => ({
      descriptor,
      index,
      score: getSettingMatchScore(descriptor, normalized, queryTokenGroups),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return scored.map((item) => item.descriptor);
}

export function parseReaderSettingsPatchFromAgentArgs(args: Record<string, unknown>): ReaderSettingsPatchParseResult {
  const patch: Partial<ReaderSettings> = {};
  const extendedPatch: Partial<ExtendedSettings> = {};
  const chapterRulesPatch: Partial<ChapterRuleDraft> = {};
  const appSettingsPatch: Partial<AppSettings> = {};
  let localePreference: LocalePreference | undefined;
  const changedLocaleKeys: Array<'localePreference'> = [];
  const warnings: string[] = [];
  const directPatch = asRecord(args.patch);
  const inputs = directPatch ? { ...directPatch, ...args } : { ...args };
  delete inputs.patch;
  delete inputs.background;
  delete inputs.backgroundColor;
  delete inputs.color;
  delete inputs.textColor;
  delete inputs.foreground;
  delete inputs.foregroundColor;

  for (const [rawKey, rawValue] of Object.entries(inputs)) {
    const descriptor = resolveReaderSettingDescriptor(rawKey, rawValue);
    if (!descriptor) continue;
    const normalizedValue = normalizeReaderSettingValue(descriptor, rawValue);
    if (normalizedValue === undefined) {
      warnings.push(`无法解析设置 ${rawKey}=${String(rawValue)}`);
      continue;
    }
    localePreference = assignSettingPatchValue(descriptor, normalizedValue, patch, extendedPatch, chapterRulesPatch, appSettingsPatch, localePreference, changedLocaleKeys);
  }

  const settingName = readString(args.setting ?? args.key ?? args.name);
  if (settingName) {
    const descriptor = resolveReaderSettingDescriptor(settingName, args.value);
    const normalizedValue = descriptor ? normalizeReaderSettingValue(descriptor, args.value) : undefined;
    if (descriptor && normalizedValue !== undefined) {
      localePreference = assignSettingPatchValue(descriptor, normalizedValue, patch, extendedPatch, chapterRulesPatch, appSettingsPatch, localePreference, changedLocaleKeys);
    }
  }

  const background = args.background ?? args.backgroundColor;
  if (background !== undefined) {
    const backgroundText = readString(background);
    if (isHexColor(backgroundText)) patch.customBackgroundColor = normalizeHexColor(backgroundText);
    else {
      const theme = normalizeReaderTheme(backgroundText);
      if (theme) patch.theme = theme as ReaderSettings['theme'];
    }
  }
  const textColor = args.textColor ?? args.foreground ?? args.foregroundColor ?? args.color;
  if (textColor !== undefined) {
    const textColorText = readString(textColor);
    if (isHexColor(textColorText)) patch.customTextColor = normalizeHexColor(textColorText);
  }

  return {
    patch,
    changedKeys: Object.keys(patch) as Array<keyof ReaderSettings>,
    extendedPatch,
    changedExtendedKeys: Object.keys(extendedPatch) as Array<keyof ExtendedSettings>,
    chapterRulesPatch,
    changedChapterRuleKeys: Object.keys(chapterRulesPatch) as Array<keyof ChapterRuleDraft>,
    appSettingsPatch,
    changedAppSettingKeys: Object.keys(appSettingsPatch) as Array<keyof AppSettings>,
    localePreference,
    changedLocaleKeys,
    warnings,
  };
}

export function buildCharacterGrowthTimeline(payload: CharacterCenterPayload | null, characterQuery: string, options: { maxMentions?: number } = {}): CharacterGrowthTimelineResult {
  if (!payload || !payload.profiles.length) {
    return {
      status: 'missing-character-index',
      message: '当前书籍没有可用人物索引。请先在人物中心重建人物索引。',
      candidates: [],
    };
  }
  const match = findCharacterProfile(payload.profiles, characterQuery);
  if (!match) {
    return {
      status: 'not-found',
      message: `人物索引中没有找到“${characterQuery}”。`,
      candidates: payload.profiles.filter((profile) => !profile.hidden).slice(0, 12).map(toCharacterCandidate),
    };
  }
  const maxMentions = clampNumber(options.maxMentions, 80, 1, 400);
  const mentions = payload.mentions
    .filter((mention) => mention.characterId === match.profile.id)
    .sort(compareMentionOrder)
    .slice(0, maxMentions)
    .map(mentionToTimelineItem);
  const events = payload.events
    .filter((event) => event.participantCharacterIds.includes(match.profile.id))
    .map(eventToTimelineItem);
  return {
    status: 'ready',
    profile: {
      id: match.profile.id,
      displayName: match.profile.displayName,
      canonicalName: match.profile.canonicalName,
      summary: match.profile.summary,
      mentionCount: match.profile.mentionCount,
      relationCount: match.profile.relationCount,
      eventCount: match.profile.eventCount,
      gender: match.profile.gender,
    },
    matchedBy: match.matchedBy,
    totalMentions: payload.mentions.filter((mention) => mention.characterId === match.profile.id).length,
    totalEvents: payload.events.filter((event) => event.participantCharacterIds.includes(match.profile.id)).length,
    timeline: [...mentions, ...events].sort(compareTimelineOrder),
  };
}

export function searchCharacterMentions(payload: CharacterCenterPayload | null, args: Record<string, unknown> = {}): CharacterMentionSearchResult {
  if (!payload || !payload.profiles.length) {
    return {
      status: 'missing-character-index',
      message: '当前书籍没有可用人物索引。请先在人物中心重建人物索引。',
      candidates: [],
    };
  }
  const characterQuery = readString(args.characterName ?? args.name ?? args.query ?? args.characterId);
  const match = findCharacterProfile(payload.profiles, characterQuery);
  if (!match) {
    return {
      status: 'not-found',
      message: `人物索引中没有找到“${characterQuery}”。`,
      candidates: payload.profiles.filter((profile) => !profile.hidden).slice(0, 12).map(toCharacterCandidate),
    };
  }
  const textQuery = readString(args.textQuery ?? args.mentionQuery ?? args.keyword ?? (args.characterName || args.name || args.characterId ? args.query : ''));
  const chapterStart = readNumber(args.chapterStart ?? args.sourceChapterStart, Number.NEGATIVE_INFINITY);
  const chapterEnd = readNumber(args.chapterEnd ?? args.sourceChapterEnd, Number.POSITIVE_INFINITY);
  const limit = clampNumber(readNumber(args.limit, 80), 80, 1, 400);
  const mentions = payload.mentions
    .filter((mention) => mention.characterId === match.profile.id)
    .filter((mention) => mention.location.sourceChapterIndex >= chapterStart && mention.location.sourceChapterIndex <= chapterEnd)
    .filter((mention) => !textQuery || normalizeText([mention.quote, mention.prefixText, mention.suffixText].filter(Boolean).join(' ')).includes(normalizeText(textQuery)))
    .sort(compareMentionOrder);
  if (!mentions.length) {
    return {
      status: 'no-result',
      message: `没有找到“${match.profile.displayName}”的匹配提及。`,
      candidates: [toCharacterCandidate(match.profile)],
    };
  }
  return {
    status: 'ready',
    profile: toCharacterProfileSummary(match.profile),
    matchedBy: match.matchedBy,
    totalMatches: mentions.length,
    mentions: mentions.slice(0, limit).map((mention) => ({
      id: mention.id,
      quote: mention.quote,
      context: [mention.prefixText, mention.quote, mention.suffixText].filter(Boolean).join(' '),
      sourceChapterIndex: mention.location.sourceChapterIndex,
      chapterTitle: mention.location.chapterTitle || `第 ${mention.location.sourceChapterIndex + 1} 章`,
      paragraphIndex: mention.location.paragraphIndex,
      startOffset: mention.location.startOffset,
      endOffset: mention.location.endOffset,
      location: mention.location,
    })),
  };
}

export function summarizeCharacterArc(payload: CharacterCenterPayload | null, characterQuery: string, options: { maxMentions?: number; maxStages?: number } = {}): CharacterArcSummaryResult {
  if (!payload || !payload.profiles.length) {
    return {
      status: 'missing-character-index',
      message: '当前书籍没有可用人物索引。请先在人物中心重建人物索引。',
      candidates: [],
    };
  }
  const match = findCharacterProfile(payload.profiles, characterQuery);
  if (!match) {
    return {
      status: 'not-found',
      message: `人物索引中没有找到“${characterQuery}”。`,
      candidates: payload.profiles.filter((profile) => !profile.hidden).slice(0, 12).map(toCharacterCandidate),
    };
  }
  const maxMentions = clampNumber(options.maxMentions, 160, 1, 600);
  const maxStages = clampNumber(options.maxStages, 16, 1, 80);
  const mentions = payload.mentions
    .filter((mention) => mention.characterId === match.profile.id)
    .sort(compareMentionOrder)
    .slice(0, maxMentions);
  const events = payload.events
    .filter((event) => event.participantCharacterIds.includes(match.profile.id))
    .sort(compareCharacterEventOrder);
  if (!mentions.length && !events.length) {
    return {
      status: 'no-result',
      message: `“${match.profile.displayName}”没有可总结的提及或事件。`,
      candidates: [toCharacterCandidate(match.profile)],
    };
  }
  const stagesByChapter = new Map<number, {
    sourceChapterIndex: number;
    chapterTitle: string;
    mentions: CharacterMention[];
    events: CharacterEvent[];
  }>();
  for (const mention of mentions) {
    const sourceChapterIndex = mention.location.sourceChapterIndex;
    const stage = stagesByChapter.get(sourceChapterIndex) ?? {
      sourceChapterIndex,
      chapterTitle: mention.location.chapterTitle || `第 ${sourceChapterIndex + 1} 章`,
      mentions: [],
      events: [],
    };
    stage.mentions.push(mention);
    stagesByChapter.set(sourceChapterIndex, stage);
  }
  for (const event of events) {
    const sourceChapterIndex = getCharacterEventSourceChapterIndex(event);
    const stage = stagesByChapter.get(sourceChapterIndex) ?? {
      sourceChapterIndex,
      chapterTitle: event.location.chapterTitle || event.chapterLabel || `第 ${sourceChapterIndex + 1} 章`,
      mentions: [],
      events: [],
    };
    stage.events.push(event);
    stagesByChapter.set(sourceChapterIndex, stage);
  }
  const stages = [...stagesByChapter.values()]
    .sort((left, right) => left.sourceChapterIndex - right.sourceChapterIndex)
    .slice(0, maxStages)
    .map((stage) => {
      const paragraphIndexes = [
        ...stage.mentions.map((mention) => mention.location.paragraphIndex),
        ...stage.events.map((event) => typeof event.location.paragraphIndex === 'number' ? event.location.paragraphIndex : 0),
      ];
      const quotes = stage.mentions.slice(0, 4).map((mention) => mention.quote);
      const eventItems = stage.events.slice(0, 4).map((event) => ({
        id: event.id,
        title: event.title,
        summary: event.summary,
        eventType: event.eventType,
      }));
      return {
        sourceChapterIndex: stage.sourceChapterIndex,
        chapterTitle: stage.chapterTitle,
        mentionCount: stage.mentions.length,
        eventCount: stage.events.length,
        firstParagraphIndex: paragraphIndexes.length ? Math.min(...paragraphIndexes) : 0,
        lastParagraphIndex: paragraphIndexes.length ? Math.max(...paragraphIndexes) : 0,
        quotes,
        events: eventItems,
        summary: buildCharacterStageSummary(stage.chapterTitle, quotes, eventItems),
      };
    });
  return {
    status: 'ready',
    profile: {
      ...toCharacterProfileSummary(match.profile),
      summary: match.profile.summary,
      eventCount: match.profile.eventCount,
    },
    matchedBy: match.matchedBy,
    totalMentions: payload.mentions.filter((mention) => mention.characterId === match.profile.id).length,
    totalEvents: events.length,
    stages,
    summary: stages.map((stage) => `${stage.chapterTitle}：${stage.summary}`).join('\n'),
  };
}

function resolveReaderSettingDescriptor(key: string, value: unknown) {
  const normalizedKey = normalizeText(key);
  const exact = readerSettingDescriptors.find((descriptor) => normalizeText(String(descriptor.key)) === normalizedKey);
  if (exact) return exact;
  const alias = readerSettingDescriptors.find((descriptor) => descriptor.aliases.some((item) => normalizeText(item) === normalizedKey));
  if (alias) return alias;
  if (normalizedKey === 'value') return undefined;
  const textValue = readString(value);
  if (isHexColor(textValue) && /背景|background|color/u.test(key)) {
    return readerSettingDescriptors.find((descriptor) => descriptor.key === 'customBackgroundColor');
  }
  return readerSettingDescriptors.find((descriptor) => descriptor.aliases.some((item) => normalizedKey.includes(normalizeText(item))));
}

function readerSetting(
  key: keyof ReaderSettings,
  label: string,
  description: string,
  aliases: string[],
  kind: ReaderSettingDescriptor['kind'],
  updateExample: Record<string, unknown>,
  values?: string[],
  range?: { min?: number; max?: number },
): ReaderSettingDescriptor {
  return createSettingDescriptor('reader', key, label, description, aliases, kind, updateExample, values, range);
}

function extendedSetting(
  key: keyof ExtendedSettings,
  label: string,
  description: string,
  aliases: string[],
  kind: ReaderSettingDescriptor['kind'],
  updateExample: Record<string, unknown>,
  values?: string[],
  range?: { min?: number; max?: number },
): ReaderSettingDescriptor {
  return createSettingDescriptor('extended', key, label, description, aliases, kind, updateExample, values, range);
}

function chapterRuleSetting(
  key: keyof ChapterRuleDraft,
  label: string,
  description: string,
  aliases: string[],
  kind: ReaderSettingDescriptor['kind'],
  updateExample: Record<string, unknown>,
  values?: string[],
  range?: { min?: number; max?: number },
): ReaderSettingDescriptor {
  return createSettingDescriptor('chapterRules', key, label, description, aliases, kind, updateExample, values, range);
}

function localeSetting(
  key: 'localePreference',
  label: string,
  description: string,
  aliases: string[],
  kind: ReaderSettingDescriptor['kind'],
  updateExample: Record<string, unknown>,
  values?: string[],
): ReaderSettingDescriptor {
  return createSettingDescriptor('locale', key, label, description, aliases, kind, updateExample, values);
}

function createSettingDescriptor(
  branch: ReaderSettingDescriptor['branch'],
  key: ReaderSettingDescriptor['key'],
  label: string,
  description: string,
  aliases: string[],
  kind: ReaderSettingDescriptor['kind'],
  updateExample: Record<string, unknown>,
  values?: string[],
  range?: { min?: number; max?: number },
): ReaderSettingDescriptor {
  const allowedValues = kind === 'boolean' ? [true, false] : values;
  return {
    branch,
    key,
    label,
    description,
    aliases,
    kind,
    values,
    allowedValues,
    valueSchema: settingMetadata[branch]?.[String(key)]?.valueSchema ?? buildSettingValueSchema(kind, values, range),
    updateExample,
  };
}

function buildCompleteSettingDescriptors(): ReaderSettingDescriptor[] {
  const descriptors = [...manualSettingDescriptors];
  addMissingInferredSettings(descriptors, 'reader', defaultReaderSettings);
  addMissingInferredSettings(descriptors, 'extended', defaultExtendedSettings);
  addMissingInferredSettings(descriptors, 'chapterRules', defaultChapterRules);
  addMissingInferredSettings(descriptors, 'appSettings', defaultAgentAppSettings);
  addLocalizedSettingsSearchAliases(descriptors);
  return descriptors;
}

function addMissingInferredSettings(
  descriptors: ReaderSettingDescriptor[],
  branch: ReaderSettingDescriptor['branch'],
  defaults: Record<string, unknown>,
) {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (descriptors.some((descriptor) => descriptor.branch === branch && descriptor.key === key)) continue;
    descriptors.push(createInferredSettingDescriptor(branch, key, defaultValue));
  }
}

function createInferredSettingDescriptor(branch: ReaderSettingDescriptor['branch'], key: string, defaultValue: unknown): ReaderSettingDescriptor {
  const metadata = settingMetadata[branch]?.[key];
  const kind = inferSettingKind(key, defaultValue, metadata?.values);
  const updateExample = metadata?.updateExample ?? { [key]: inferSettingExampleValue(kind, defaultValue, metadata?.values) };
  return createSettingDescriptor(
    branch,
    key as ReaderSettingDescriptor['key'],
    metadata?.label ?? humanizeSettingKey(key),
    metadata?.description ?? `设置中心 ${branch} 分支的 ${key} 设置。`,
    [key, humanizeSettingKey(key), ...(metadata?.aliases ?? [])],
    kind,
    updateExample,
    metadata?.values,
  );
}

function addLocalizedSettingsSearchAliases(descriptors: ReaderSettingDescriptor[]) {
  const descriptorsByKey = new Map<string, ReaderSettingDescriptor[]>();
  for (const descriptor of descriptors) {
    const key = String(descriptor.key);
    descriptorsByKey.set(key, [...(descriptorsByKey.get(key) ?? []), descriptor]);
  }
  const searchableSettingTextSuffixes = new Set(['title', 'description', 'label', 'placeholder', 'empty', 'aria']);

  for (const messages of [zhCN, enUS]) {
    for (const [translationKey, value] of Object.entries(messages)) {
      const text = readString(value).trim();
      if (!text) continue;

      const settingTextMatch = translationKey.match(/^settings\.[^.]+\.([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*)$/);
      if (settingTextMatch && searchableSettingTextSuffixes.has(settingTextMatch[2])) {
        addAliasToSettingDescriptors(descriptorsByKey.get(settingTextMatch[1]), text);
        continue;
      }

      const optionMatch = translationKey.match(/^settings\.options\.[^.]+\.([A-Za-z][A-Za-z0-9]*)\..+$/);
      if (optionMatch) addAliasToSettingDescriptors(descriptorsByKey.get(optionMatch[1]), text);
    }
  }
}

function addAliasToSettingDescriptors(descriptors: ReaderSettingDescriptor[] | undefined, alias: string) {
  if (!descriptors?.length) return;
  for (const descriptor of descriptors) {
    if (!descriptor.aliases.includes(alias)) descriptor.aliases.push(alias);
  }
}

function inferSettingKind(key: string, value: unknown, values?: string[]): ReaderSettingDescriptor['kind'] {
  if (values?.length) return 'enum';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';
  if (/color/i.test(key)) return 'color';
  return 'string';
}

function inferSettingExampleValue(kind: ReaderSettingDescriptor['kind'], value: unknown, values?: string[]) {
  if (kind === 'enum') return values?.[0] ?? value;
  if (kind === 'boolean') return true;
  if (kind === 'number') return typeof value === 'number' ? value : 1;
  if (kind === 'array') return Array.isArray(value) ? value : [];
  if (kind === 'object') return value && typeof value === 'object' ? value : {};
  if (kind === 'color') return '#ffffff';
  return typeof value === 'string' ? value : '';
}

function humanizeSettingKey(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
}

function buildSettingValueSchema(kind: ReaderSettingDescriptor['kind'], values?: string[], range?: { min?: number; max?: number }): Record<string, unknown> {
  if (kind === 'boolean') return { type: 'boolean' };
  if (kind === 'enum') return { type: 'enum', values: values ?? [] };
  if (kind === 'color') return { type: 'hexColor', pattern: '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' };
  if (kind === 'integerString') return { type: 'integerString', ...(range ?? {}) };
  if (kind === 'number') return { type: 'number', ...(range ?? {}) };
  if (kind === 'array') return { type: 'array' };
  if (kind === 'object') return { type: 'object' };
  return { type: 'string' };
}

function assignSettingPatchValue(
  descriptor: ReaderSettingDescriptor,
  normalizedValue: unknown,
  patch: Partial<ReaderSettings>,
  extendedPatch: Partial<ExtendedSettings>,
  chapterRulesPatch: Partial<ChapterRuleDraft>,
  appSettingsPatch: Partial<AppSettings>,
  localePreference: LocalePreference | undefined,
  changedLocaleKeys: Array<'localePreference'>,
) {
  if (descriptor.branch === 'locale') {
    if (descriptor.key === 'localePreference' && isAgentLocalePreference(normalizedValue)) {
      if (!changedLocaleKeys.includes('localePreference')) changedLocaleKeys.push('localePreference');
      return normalizedValue;
    }
    return localePreference;
  }
  if (descriptor.branch === 'extended') {
    (extendedPatch as Record<string, unknown>)[descriptor.key] = normalizedValue;
    return localePreference;
  }
  if (descriptor.branch === 'chapterRules') {
    (chapterRulesPatch as Record<string, unknown>)[descriptor.key] = normalizedValue;
    return localePreference;
  }
  if (descriptor.branch === 'appSettings') {
    (appSettingsPatch as Record<string, unknown>)[descriptor.key] = normalizedValue;
    return localePreference;
  }
  (patch as Record<string, unknown>)[descriptor.key] = normalizedValue;
  return localePreference;
}

function normalizeReaderSettingValue(descriptor: ReaderSettingDescriptor, value: unknown): unknown {
  if (descriptor.key === 'fontFamily') return normalizeReaderFontFamily(readString(value));
  if (descriptor.key === 'theme') return normalizeReaderTheme(readString(value));
  if (descriptor.branch === 'locale' && descriptor.key === 'localePreference') return normalizeAgentLocalePreference(readString(value));
  if (descriptor.key === 'customBackgroundColor') {
    const text = readString(value);
    return isHexColor(text) ? normalizeHexColor(text) : undefined;
  }
  if (descriptor.branch === 'chapterRules' && descriptor.key === 'customCleanupRules') return normalizeCustomCleanupRules(value);
  if (descriptor.kind === 'boolean') return normalizeBoolean(value);
  if (descriptor.kind === 'integerString') {
    const numeric = typeof value === 'number' ? value : Number(readString(value));
    return Number.isFinite(numeric) ? String(Math.max(0, Math.floor(numeric))) : undefined;
  }
  if (descriptor.kind === 'number') {
    const numeric = typeof value === 'number' ? value : Number(readString(value));
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  if (descriptor.kind === 'array') return Array.isArray(value) ? value : undefined;
  if (descriptor.kind === 'object') return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  if (descriptor.values?.length) {
    const text = readString(value);
    return descriptor.values.includes(text) ? text : undefined;
  }
  return readString(value) || undefined;
}

function normalizeAgentLocalePreference(value: string): LocalePreference | undefined {
  const text = value.trim();
  const normalized = normalizeText(text);
  if (text === 'zh-CN' || normalized === 'zhcn' || normalized.includes('chinese') || /中文|简体/u.test(text)) return 'zh-CN';
  if (text === 'en-US' || normalized === 'enus' || normalized.includes('english') || /英文|英语/u.test(text)) return 'en-US';
  if (text === 'ja-JP' || normalized === 'jajp' || normalized.includes('japanese') || /日语|日文/u.test(text)) return 'ja-JP';
  if (text === 'es-ES' || normalized === 'eses' || normalized.includes('spanish') || /西班牙语|西语/u.test(text)) return 'es-ES';
  if (text === 'fr-FR' || normalized === 'frfr' || normalized.includes('french') || /法语|法文/u.test(text)) return 'fr-FR';
  if (text === 'ko-KR' || normalized === 'kokr' || normalized.includes('korean') || /韩语|韩文/u.test(text)) return 'ko-KR';
  if (normalized === 'system' || /系统|跟随/u.test(text)) return 'system';
  return undefined;
}

function isAgentLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || value === 'zh-CN' || value === 'en-US' || value === 'ja-JP' || value === 'es-ES' || value === 'fr-FR' || value === 'ko-KR';
}

function normalizeReaderFontFamily(value: string) {
  const text = value.trim();
  if (!text) return undefined;
  const match = readerFontAliases.find((item) => item.patterns.some((pattern) => pattern.test(text)));
  return match?.value ?? text;
}

function normalizeReaderTheme(value: string) {
  const text = value.trim();
  if (!text) return undefined;
  const normalized = normalizeText(text);
  if (['white', 'paper', 'eyecomfort', 'dark', 'oled', 'system', 'light', 'night', 'sepia'].includes(normalized)) {
    return normalized === 'eyecomfort' ? 'eyeComfort' : normalized;
  }
  if (/护眼|绿|eye/u.test(text)) return 'eyeComfort';
  if (/纸|paper|羊皮|sepia/u.test(text)) return 'paper';
  if (/夜|黑|dark|night/u.test(text)) return 'dark';
  if (/白|light|white/u.test(text)) return 'white';
  return undefined;
}

function getSettingMatchScore(descriptor: ReaderSettingDescriptor, query: string, queryTokenGroups: string[][]) {
  const aliases = [descriptor.key, descriptor.label, ...descriptor.aliases].map((item) => normalizeText(String(item)));
  const searchableFields = [
    descriptor.key,
    descriptor.label,
    descriptor.description,
    ...descriptor.aliases,
    ...(descriptor.values ?? []),
    ...(descriptor.allowedValues ?? []).map((value) => String(value)),
  ].map((item) => normalizeText(String(item))).filter(Boolean);
  const searchableText = searchableFields.join('');
  if (aliases.some((alias) => alias === query)) return 100;
  if (aliases.some((alias) => query.includes(alias))) return 80;
  if (searchableFields.some((field) => field === query)) return 75;
  if (searchableFields.some((field) => query.includes(field))) return 70;
  if (aliases.some((alias) => alias.includes(query))) return 60;
  if (searchableFields.some((field) => field.includes(query))) return 55;
  const tokenGroupScore = getSettingTokenGroupMatchScore(searchableText, queryTokenGroups);
  if (tokenGroupScore > 0) return tokenGroupScore;
  const groupScore = getSettingGroupMatchScore(descriptor, query);
  if (groupScore > 0) return groupScore;
  return 0;
}

function getSettingTokenGroupMatchScore(searchableText: string, queryTokenGroups: string[][]) {
  let bestScore = 0;
  for (const tokens of queryTokenGroups) {
    if (!tokens.length) continue;
    const matchedCount = tokens.filter((token) => searchableText.includes(token)).length;
    if (matchedCount === tokens.length) {
      bestScore = Math.max(bestScore, tokens.length > 1 ? 48 : 42);
      continue;
    }
    if (tokens.length >= 2 && matchedCount >= 1) bestScore = Math.max(bestScore, 32);
    if (tokens.length >= 3 && matchedCount >= 2) bestScore = Math.max(bestScore, 38);
  }
  return bestScore;
}

function buildSettingSearchTokenGroups(query: string, baseTokens: string[]) {
  const groups: string[][] = [];
  if (baseTokens.length > 1) groups.push(baseTokens);
  const translatedTokens = translateSettingSearchTokens(query);
  if (translatedTokens.length) groups.push(translatedTokens);
  return groups;
}

function splitSettingSearchTokens(value: string) {
  return value
    .split(/[\s,，、。；;:：|/\\()[\]{}"'“”‘’<>《》]+/u)
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= 2);
}

function translateSettingSearchTokens(value: string) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return [];
  const tokens: string[] = [];
  for (const item of settingsSearchPhraseTranslations) {
    if (!item.phrases.some((phrase) => normalizedValue.includes(normalizeText(phrase)))) continue;
    tokens.push(...item.tokens.map((token) => normalizeText(token)).filter(Boolean));
  }
  return [...new Set(tokens)];
}

function getSettingGroupMatchScore(descriptor: ReaderSettingDescriptor, query: string) {
  for (const group of settingsSearchKeywordGroups) {
    if (group.branch !== descriptor.branch || !group.keys.includes(String(descriptor.key))) continue;
    const keywords = group.keywords.map((keyword) => normalizeText(keyword));
    if (keywords.some((keyword) => keyword === query || query.includes(keyword) || keyword.includes(query))) return 50;
  }
  return 0;
}

function findCharacterProfile(profiles: CharacterProfile[], query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;
  for (const profile of profiles) {
    if (profile.id === query) return { profile, matchedBy: 'id' as const };
  }
  for (const profile of profiles) {
    if ([profile.displayName, profile.canonicalName].some((name) => normalizeText(name) === normalizedQuery)) {
      return { profile, matchedBy: 'name' as const };
    }
  }
  for (const profile of profiles) {
    if (profile.aliases.some((alias) => normalizeText(alias.name) === normalizedQuery)) {
      return { profile, matchedBy: 'alias' as const };
    }
  }
  for (const profile of profiles) {
    if ([profile.displayName, profile.canonicalName, ...profile.aliases.map((alias) => alias.name)].some((name) => normalizeText(name).includes(normalizedQuery))) {
      return { profile, matchedBy: 'name' as const };
    }
  }
  return null;
}

function mentionToTimelineItem(mention: CharacterMention): CharacterGrowthTimelineItem {
  return {
    id: mention.id,
    kind: 'mention',
    title: mention.location.chapterTitle || `第 ${mention.location.sourceChapterIndex + 1} 章`,
    summary: [mention.prefixText, mention.quote, mention.suffixText].filter(Boolean).join(' '),
    quote: mention.quote,
    sourceChapterIndex: mention.location.sourceChapterIndex,
    chapterTitle: mention.location.chapterTitle || '',
    paragraphIndex: mention.location.paragraphIndex,
    location: mention.location,
  };
}

function eventToTimelineItem(event: CharacterEvent): CharacterGrowthTimelineItem {
  const sourceChapterIndex = getCharacterEventSourceChapterIndex(event);
  return {
    id: event.id,
    kind: 'event',
    title: event.title || event.chapterLabel,
    summary: event.summary,
    quote: event.summary,
    sourceChapterIndex,
    chapterTitle: event.location.chapterTitle || event.chapterLabel || '',
    paragraphIndex: typeof event.location.paragraphIndex === 'number' ? event.location.paragraphIndex : 0,
    location: event.location,
  };
}

function compareMentionOrder(left: CharacterMention, right: CharacterMention) {
  return left.location.sourceChapterIndex - right.location.sourceChapterIndex
    || left.location.paragraphIndex - right.location.paragraphIndex
    || left.location.startOffset - right.location.startOffset;
}

function compareTimelineOrder(left: CharacterGrowthTimelineItem, right: CharacterGrowthTimelineItem) {
  return left.sourceChapterIndex - right.sourceChapterIndex
    || left.paragraphIndex - right.paragraphIndex
    || left.id.localeCompare(right.id);
}

function compareCharacterEventOrder(left: CharacterEvent, right: CharacterEvent) {
  return getCharacterEventSourceChapterIndex(left) - getCharacterEventSourceChapterIndex(right)
    || readNumber(left.location.paragraphIndex, 0) - readNumber(right.location.paragraphIndex, 0)
    || left.id.localeCompare(right.id);
}

function getCharacterEventSourceChapterIndex(event: CharacterEvent) {
  return typeof event.location.sourceChapterIndex === 'number'
    ? event.location.sourceChapterIndex
    : typeof event.location.chapterIndex === 'number'
      ? event.location.chapterIndex
      : 0;
}

function toCharacterCandidate(profile: CharacterProfile) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    canonicalName: profile.canonicalName,
    mentionCount: profile.mentionCount,
  };
}

function toCharacterProfileSummary(profile: CharacterProfile) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    canonicalName: profile.canonicalName,
    gender: profile.gender,
    role: profile.role,
    mentionCount: profile.mentionCount,
  };
}

function buildCharacterStageSummary(chapterTitle: string, quotes: string[], events: Array<{ title: string; summary: string }>) {
  const eventText = events.map((event) => event.summary || event.title).filter(Boolean).join('；');
  const quoteText = quotes.join('；');
  const parts = [eventText, quoteText].filter(Boolean);
  return parts.length ? parts.join('；').slice(0, 240) : `${chapterTitle} 有人物活动记录。`;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize('NFKC').replace(/[\s_\-./:：]+/gu, '');
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  const text = readString(value);
  if (/^(true|1|yes|on|开|开启|显示)$/iu.test(text)) return true;
  if (/^(false|0|no|off|关|关闭|隐藏)$/iu.test(text)) return false;
  return undefined;
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/iu.test(value.trim());
}

function normalizeHexColor(value: string) {
  const color = value.trim().toLowerCase();
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = readString(value);
  if (!text) return fallback;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function groupChunksByChapter(chunks: Partial<TextChunk>[]) {
  const groups = new Map<number, { entry: AgentChapterCatalogEntry; chunks: Partial<TextChunk>[] }>();
  const orderedChunks = chunks
    .filter((chunk) => readString(chunk.text) || readString(chunk.chapterTitle) || readString(chunk.chapter))
    .slice()
    .sort((left, right) => readNumber(left.ordinal, 0) - readNumber(right.ordinal, 0));

  orderedChunks.forEach((chunk, fallbackIndex) => {
    const sourceChapterIndex = typeof chunk.chapterIndex === 'number' && Number.isFinite(chunk.chapterIndex)
      ? chunk.chapterIndex
      : fallbackIndex;
    const title = readString(chunk.chapterTitle) || readString(chunk.chapter) || `第 ${sourceChapterIndex + 1} 章`;
    const text = readString(chunk.text);
    const ordinal = readNumber(chunk.ordinal, fallbackIndex);
    const existing = groups.get(sourceChapterIndex);
    if (existing) {
      existing.chunks.push(chunk);
      existing.entry.chunkCount += 1;
      existing.entry.chars += text.length;
      existing.entry.ordinalStart = Math.min(existing.entry.ordinalStart, ordinal);
      existing.entry.ordinalEnd = Math.max(existing.entry.ordinalEnd, ordinal);
      existing.entry.paragraphStart = minOptionalNumber(existing.entry.paragraphStart, chunk.paragraphStart);
      existing.entry.paragraphEnd = maxOptionalNumber(existing.entry.paragraphEnd, chunk.paragraphEnd);
      if (!existing.entry.title && title) existing.entry.title = title;
      return;
    }
    groups.set(sourceChapterIndex, {
      entry: {
        sourceChapterIndex,
        title,
        chunkCount: 1,
        chars: text.length,
        ordinalStart: ordinal,
        ordinalEnd: ordinal,
        paragraphStart: chunk.paragraphStart,
        paragraphEnd: chunk.paragraphEnd,
      },
      chunks: [chunk],
    });
  });

  return [...groups.values()].sort((left, right) => left.entry.sourceChapterIndex - right.entry.sourceChapterIndex || left.entry.ordinalStart - right.entry.ordinalStart);
}

function resolveAgentChapterGroup(groups: Array<{ entry: AgentChapterCatalogEntry; chunks: Partial<TextChunk>[] }>, args: Record<string, unknown>) {
  const position = normalizeText(readString(args.position));
  if (position === 'last' || position === '末章' || position === '最后一章' || position === '结尾') return groups[groups.length - 1] ?? null;
  if (position === 'first' || position === '首章' || position === '第一章' || position === '开头') return groups[0] ?? null;

  const chapterIndex = readNumber(args.chapterIndex ?? args.sourceChapterIndex ?? args.index, Number.NaN);
  if (Number.isFinite(chapterIndex)) {
    const exact = groups.find((group) => group.entry.sourceChapterIndex === chapterIndex);
    if (exact) return exact;
    const oneBased = groups.find((group) => group.entry.sourceChapterIndex === chapterIndex - 1);
    if (oneBased) return oneBased;
    const byPosition = groups[chapterIndex];
    if (byPosition) return byPosition;
  }

  const title = normalizeText(readString(args.title ?? args.chapterTitle ?? args.query));
  if (title) {
    return groups.find((group) => normalizeText(group.entry.title) === title)
      ?? groups.find((group) => normalizeText(group.entry.title).includes(title))
      ?? null;
  }

  return groups[0] ?? null;
}

function splitAgentChapterParagraphs(text: string) {
  return text.split(/\n{2,}|\r?\n/gu).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function findAgentTextMatches(text: string, query: string, options: { caseSensitive: boolean }) {
  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const indexes: number[] = [];
  if (!needle) return indexes;
  let fromIndex = 0;
  while (fromIndex < haystack.length) {
    const index = haystack.indexOf(needle, fromIndex);
    if (index < 0) break;
    indexes.push(index);
    fromIndex = index + Math.max(needle.length, 1);
  }
  return indexes;
}

function createAgentSearchSnippet(text: string, index: number, length: number) {
  const start = Math.max(0, index - 36);
  const end = Math.min(text.length, index + length + 48);
  return `${start > 0 ? '...' : ''}${text.slice(start, end).replace(/\s+/gu, ' ').trim()}${end < text.length ? '...' : ''}`;
}

function selectAgentWindowCitations(args: Record<string, unknown>, citations: Array<Record<string, unknown>>) {
  const rawCitationIds = args.citationIds ?? args.citationId ?? args.ids;
  const wantedIds = new Set(
    (Array.isArray(rawCitationIds) ? rawCitationIds : rawCitationIds === undefined ? [] : [rawCitationIds])
      .map((value) => String(value)),
  );
  if (!wantedIds.size) return citations.slice(0, 8);
  return citations.filter((citation) => wantedIds.has(String(citation.id))).slice(0, 12);
}

function minOptionalNumber(left: number | undefined, right: number | undefined) {
  if (typeof left !== 'number') return right;
  if (typeof right !== 'number') return left;
  return Math.min(left, right);
}

function maxOptionalNumber(left: number | undefined, right: number | undefined) {
  if (typeof left !== 'number') return right;
  if (typeof right !== 'number') return left;
  return Math.max(left, right);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

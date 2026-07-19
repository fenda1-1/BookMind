import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const ts = await import('typescript');
const aiMessages = {
  ...readMessageMap('src/i18n/messages/zhCN/common.ts', ts),
  ...readMessageMap('src/i18n/messages/zhCN/ai.ts', ts),
};
const aiI18nModuleId = '\0bookmind-ai-reader-render-i18n';
const aiEntryModuleId = '\0bookmind-ai-reader-render-entry';
const bundleDirectory = mkdtempSync(join(process.cwd(), '.ai-reader-render-'));
const aiRenderPlugin = {
  name: 'bookmind-ai-reader-render-modules',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'virtual:ai-reader-render-entry') return aiEntryModuleId;
    if (source === 'virtual:ai-reader-render-i18n' || /^(?:\.\.\/)+i18n$/.test(source)) return aiI18nModuleId;
    return null;
  },
  load(id) {
    if (id === aiEntryModuleId) {
      return `
        export { AiReaderPanel } from '/src/features/ai-reader/AiReaderPanel.tsx';
        export { AiConversationMessageList } from '/src/features/ai-reader/AiConversationMessageList.tsx';
        export { parseAiResponseProtocol } from '/src/services/aiResponseProtocol.ts';
        export { I18nContext, createTranslator } from 'virtual:ai-reader-render-i18n';
      `;
    }
    if (id !== aiI18nModuleId) return null;
    return `
      import React, { useContext } from 'react';
      const messages = ${JSON.stringify(aiMessages)};
      export function createTranslator() {
        return (key, values) => String(messages[key] ?? key).replace(/\\{(\\w+)\\}/g, (_, name) => String(values?.[name] ?? ''));
      }
      export const I18nContext = React.createContext({ locale: 'zh-CN', setLocale: () => undefined, t: createTranslator() });
      export function useI18n() { return useContext(I18nContext); }
    `;
  },
};
await build({
  configFile: false,
  logLevel: 'error',
  plugins: [react(), aiRenderPlugin],
  build: {
    ssr: true,
    outDir: bundleDirectory,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: 'virtual:ai-reader-render-entry',
      output: { entryFileNames: 'entry.mjs' },
    },
  },
});
const { AiReaderPanel, AiConversationMessageList, I18nContext, createTranslator, parseAiResponseProtocol } = await import(pathToFileURL(join(bundleDirectory, 'entry.mjs')).href);

const answer = readFileSync('src/tests/fixtures/mock-ai-response.v2.tool-list-answer.json', 'utf8');
const aiReaderPanelSource = readFileSync('src/features/ai-reader/AiReaderPanel.tsx', 'utf8');
const readerWorkspaceSource = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const noop = () => undefined;
const asyncNoop = async () => undefined;
const book = {
  id: 'book-demo',
  title: '示例书',
  displayTitle: '示例书',
  author: '',
  format: 'txt',
  status: 'ready',
  progress: 0,
  fileName: 'demo.txt',
  filePath: '',
  coverLabel: '示',
  coverTone: 'indigo',
  deleted: false,
  deletedAt: '',
  contentHash: '',
  importedAt: '',
  content: '',
  chunks: [],
};

function renderAiPanel(props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      I18nContext.Provider,
      { value: { locale: 'zh-CN', setLocale: noop, t: createTranslator('zh-CN') } },
      React.createElement(AiReaderPanel, {
        book,
        readerContext: { bookId: book.id, chapterTitle: '第2章 月亮上的天使', chapterText: '', pageText: '' },
        citations: [],
        status: 'ready',
        saveStatus: '回答已生成。',
        onAsk: noop,
        onStop: noop,
        onRetry: noop,
        onSaveNote: asyncNoop,
        onSaveHighlight: asyncNoop,
        onSaveExcerpt: asyncNoop,
        onJumpCitation: noop,
        onToggleCollapsed: noop,
        onOpenSettings: noop,
        onOpenTasks: noop,
        answer,
        ...props,
      }),
    ),
  );
}

function renderConversationMessageList(props = {}) {
  const t = createTranslator('zh-CN');
  const oldAnswer = JSON.stringify({
    schema: 'bookmind.ai.response.v2',
    title: '上一条章节感觉',
    blocks: [{ id: 'old-block', type: 'paragraph', content: '上一条回答仍然应该保持卡片渲染。', citationIds: [] }],
    citations: [],
  });
  const latestAnswer = JSON.stringify({
    schema: 'bookmind.ai.response.v2',
    title: '新的追问',
    blocks: [{ id: 'new-block', type: 'paragraph', content: '新的回答也保持卡片渲染。', citationIds: [] }],
    citations: [],
  });
  return renderToStaticMarkup(React.createElement(AiConversationMessageList, {
    conversation: {
      id: 'conversation-demo',
      title: '测试对话',
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:02:00.000Z',
      pinned: false,
      messages: [
        { id: 'u1', role: 'user', content: '当前章节你感觉怎么样', createdAt: '2026-06-27T00:00:00.000Z', updatedAt: '2026-06-27T00:00:00.000Z' },
        { id: 'a1', role: 'assistant', content: oldAnswer, createdAt: '2026-06-27T00:01:00.000Z', updatedAt: '2026-06-27T00:01:00.000Z', status: 'ready', model: 'AI' },
        { id: 'u2', role: 'user', content: '第二个问题', createdAt: '2026-06-27T00:02:00.000Z', updatedAt: '2026-06-27T00:02:00.000Z' },
        { id: 'a2', role: 'assistant', content: latestAnswer, createdAt: '2026-06-27T00:03:00.000Z', updatedAt: '2026-06-27T00:03:00.000Z', status: 'ready', model: 'AI' },
      ],
    },
    bookReady: true,
    status: 'ready',
    saveStatus: '回答已生成。',
    isGenerating: false,
    structuredAnswer: parseAiResponseProtocol(latestAnswer),
    shouldRenderStructuredAnswer: parseAiResponseProtocol(latestAnswer),
    renderedBlockLimit: 120,
    answer: latestAnswer,
    citations: [],
    scope: 'chapter',
    copyDiagnosticsAutoRedact: true,
    fallbackEnabled: true,
    localAiEnabled: true,
    cloudEnabled: true,
    defaultCitationDensity: 'compact',
    externalCitationsDisabled: true,
    citationJumpRepairEnabled: true,
    citationFieldStrictness: 'normal',
    toolCallDisplayMode: 'summary',
    flashcardDefaults: { tags: '', reviewStatus: 'new' },
    noCitationWarning: false,
    requiredCitationWarning: false,
    citationCoverage: { totalClaims: 1, supportedClaims: 1, percent: 100, level: 'high' },
    emptyGuide: null,
    onRenameConversationTitle: noop,
    onDeleteMessage: noop,
    onRunChapterFallback: noop,
    onSwitchToCloudMode: noop,
    onOpenTasks: noop,
    onStop: noop,
    onCopyAnswer: noop,
    onRetry: noop,
    onSaveProtocolDefault: noop,
    onSaveProtocolHighlight: noop,
    onSaveProtocolExcerpt: noop,
    t,
    ...props,
  }));
}

function renderSingleAssistantConversation(answerText, props = {}) {
  const t = createTranslator('zh-CN');
  return renderConversationMessageList({
    conversation: {
      id: 'conversation-answer',
      title: '回答渲染',
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:01:00.000Z',
      pinned: false,
      messages: [
        { id: 'u1', role: 'user', content: '总结当前章节', createdAt: '2026-06-27T00:00:00.000Z', updatedAt: '2026-06-27T00:00:00.000Z' },
        { id: 'a1', role: 'assistant', content: answerText, createdAt: '2026-06-27T00:01:00.000Z', updatedAt: '2026-06-27T00:01:00.000Z', status: 'ready', model: 'AI' },
      ],
    },
    answer: answerText,
    structuredAnswer: parseAiResponseProtocol(answerText),
    shouldRenderStructuredAnswer: parseAiResponseProtocol(answerText),
    t,
    ...props,
  });
}

let html = '';
let unavailableHtml = '';
try {
  html = renderAiPanel();
  unavailableHtml = renderAiPanel({
    answer: '',
    status: 'no-index',
    saveStatus: '当前书尚未索引。',
    diagnostics: {
      scope: 'book',
      queryUsed: '雨夜',
      chunkCount: 0,
      ftsAvailable: true,
      resultCount: 0,
      fallbackUsed: false,
      errorKind: 'no-index',
      indexStatus: 'missing',
      semanticCapabilityNotice: {
        status: 'unavailable',
        title: '本地全文检索可用',
        detail: '语义能力待配置：sidecar not-configured，vector not-built。',
        action: '当前会继续使用本地 FTS；配置 sidecar 并构建 vector index 后再启用语义检索。',
      },
      recommendations: ['去任务中心重新索引'],
    },
  });
} finally {
  rmSync(bundleDirectory, { recursive: true, force: true });
}

const structuredHtml = renderSingleAssistantConversation(answer);
const topChromeHtml = html.match(/<div class="ai-header-card[\s\S]*?<\/div><div class="ai-answer-stream"/)?.[0] ?? html;

for (const required of ['BookMind 阅读工具清单', '可用工具', 'get_current_context', 'request_cloud_ai']) {
  assert.match(structuredHtml, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `rendered panel must include ${required}`);
}
for (const forbidden of ['happened', '同步到章节时间线', '标记待验证 · 先预览确认', '全部标记待验证 · 先预览确认']) {
  assert.doesNotMatch(structuredHtml, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `rendered panel must not include ${forbidden}`);
}
assert.match(structuredHtml, /保存卡片截图/, 'rendered panel should expose the screenshot save action');
assert.match(html, /ai-mini-toolbar/, 'rendered panel should use the v5 minimal top icon toolbar');
assert.match(html, /ai-composer-card ai-companion-dock resizable-composer/, 'rendered panel should use the v5 resizable companion dock composer');
assert.match(html, /ai-composer-resize-handle/, 'rendered panel should expose a small drag handle for composer height');
assert.match(html, /ai-attachment-strip/, 'rendered panel should expose an attachment chip strip above the textarea');
assert.match(html, /ai-attachment-add-btn/, 'rendered panel should expose only one plus button for attachments in the bottom toolbar');
assert.match(html, /ai-scope-status-btn/, 'rendered panel should expose the upcoming range as a status icon');
assert.doesNotMatch(html, /ai-scope-popover/, 'rendered panel should keep the upcoming range popover hidden until the status icon is pressed');
assert.doesNotMatch(html, /范围[\s\S]*全书[\s\S]*章节[\s\S]*第2章 月亮上的天使[\s\S]*页码[\s\S]*P1[\s\S]*选区[\s\S]*0 字[\s\S]*预计消耗[\s\S]*0 tokens[\s\S]*附加内容/, 'hidden range popover details must not be rendered into the initial panel');
assert.match(html, /ai-send-stop-btn/, 'rendered panel should expose a single send-or-stop button at the bottom right');
assert.match(html, /添加附加内容/, 'plus icon should have an immediate Chinese tooltip');
assert.match(html, /上下文范围/, 'range status icon should have an immediate Chinese tooltip in QA mode');
assert.match(aiReaderPanelSource, /className="ai-agent-toolbox-disclosure"/, 'Agent toolbox must be a second-level disclosure instead of rendering all tools immediately');
assert.doesNotMatch(aiReaderPanelSource, /<details className="ai-agent-toolbox-disclosure"\s+open/, 'Agent toolbox disclosure must not be open by default');
assert.match(aiReaderPanelSource, /ai\.agentToolbox\.expand/, 'Agent toolbox disclosure should use the localized explicit-expand label');
assert.doesNotMatch(html, /ai-paper-tool-dock option-a-toolbar|ai-option-a-icon-row|ai-scope-orb/, 'rendered panel must not keep the old Option A icon row');
assert.doesNotMatch(html, /ai-toolbar-icon-btn|ai-dock-segment|ai-dock-status/, 'rendered panel must not keep extra bottom toolbar buttons or B-style segments');
assert.doesNotMatch(topChromeHtml, /AI 研究台|阅读研究台|严格本地/, 'v5 top chrome must remove the old title and strict-local text');
assert.match(html, /ai-question-input/, 'rendered panel should expose the fixed-height question input');
assert.match(html, /输入你想追问的内容/, 'rendered panel should keep the follow-up placeholder visible');
assert.match(unavailableHtml, /本地全文检索可用/, 'AI diagnostics must tell users local full-text retrieval is still available');
assert.match(unavailableHtml, /语义能力待配置/, 'AI diagnostics must tell users semantic capability is pending sidecar/vector configuration');
assert.match(unavailableHtml, /not-configured/, 'AI diagnostics must expose the not-configured sidecar status');
assert.match(unavailableHtml, /not-built/, 'AI diagnostics must expose the not-built vector status');
assert.doesNotMatch(unavailableHtml, /语义检索已启用|vector ready|semantic search ready/i, 'AI diagnostics must not imply semantic or vector search is ready');

const conversationHtml = renderConversationMessageList();
assert.equal((conversationHtml.match(/class="ai-structured-response"/g) ?? []).length, 2, 'historical assistant messages must keep structured card rendering after a later question is sent');
assert.match(conversationHtml, /上一条回答仍然应该保持卡片渲染。/, 'historical structured answer content must remain visible as rendered content');

const fencedJsonAnswer = "``` json\n{\"bookmind.ai.response.v2\":{\"analysis\":{\"chapter\":\"第31章 祈墨\",\"characters_extracted\":[{\"name\":\"林七夜\",\"evidence\":[\"林七夜慌了。\"]}]}}}\n```";
const activeFallbackStructuredHtml = renderSingleAssistantConversation(fencedJsonAnswer, {
  shouldRenderStructuredAnswer: null,
  structuredAnswer: null,
});
assert.match(activeFallbackStructuredHtml, /识别到的人物/, 'active assistant message should parse fenced JSON even when the panel structured flag is empty');
assert.doesNotMatch(activeFallbackStructuredHtml, /``` json/, 'active assistant message must not show raw JSON fences when structured parsing succeeds');
assert.doesNotMatch(activeFallbackStructuredHtml, /引用缺字段：chapterId\/sourceChapterIndex|引用缺字段：paragraphIndex/, 'text-searchable citations should not be marked as missing explicit chapter or paragraph coordinates');

const deletedConversationHtml = renderConversationMessageList({
  conversation: {
    id: 'conversation-deleted',
    title: '测试对话',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:04:00.000Z',
    pinned: false,
    messages: [],
  },
});
assert.equal((deletedConversationHtml.match(/class="ai-structured-response"/g) ?? []).length, 0, 'deleting every message must not resurrect the last live answer as a fallback card');
assert.doesNotMatch(aiReaderPanelSource, /setQuestion\(prompt\.trim\(\)\)/, 'sending a prompt must not write the submitted text back into the input');
assert.match(aiReaderPanelSource, /function clearSubmittedComposerDraft\(\)[\s\S]*setQuestion\(''\)[\s\S]*clearSubmittedComposerDraft,/, 'sending a valid prompt must clear the composer through the extracted request lifecycle callback');
assert.doesNotMatch(readerWorkspaceSource, /window\.alert\(/, 'AI citation jump and repair feedback must not use window.alert because Tauri dialog permissions may block it');
assert.doesNotMatch(readerWorkspaceSource, /bookmind:ai-protocol-hover-source/, 'hovering citation cards must not move the reader; only explicit jump actions should navigate');

function readMessageMap(filePath, typescript) {
  const source = typescript.createSourceFile(filePath, readFileSync(filePath, 'utf8'), typescript.ScriptTarget.ESNext, true);
  const messages = {};
  function visit(node) {
    if (typescript.isPropertyAssignment(node)
      && (typescript.isStringLiteral(node.name) || typescript.isNoSubstitutionTemplateLiteral(node.name))
      && (typescript.isStringLiteral(node.initializer) || typescript.isNoSubstitutionTemplateLiteral(node.initializer))) {
      messages[node.name.text] = node.initializer.text;
    }
    typescript.forEachChild(node, visit);
  }
  visit(source);
  return messages;
}

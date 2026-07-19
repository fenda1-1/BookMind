import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
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
const taskCenterMessages = {
  ...readMessageMap('src/i18n/messages/zhCN/common.ts', ts),
  ...readMessageMap('src/i18n/messages/zhCN/tasks.ts', ts),
};
const taskCenterI18nModuleId = '\0bookmind-task-center-render-i18n';
const taskCenterEntryModuleId = '\0bookmind-task-center-render-entry';
const bundleDirectory = mkdtempSync(join(process.cwd(), '.task-center-render-'));
const taskCenterRenderPlugin = {
  name: 'bookmind-task-center-render-modules',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'virtual:task-center-render-entry') return taskCenterEntryModuleId;
    if (source === 'virtual:task-center-render-i18n' || /^(?:\.\.\/)+i18n$/.test(source)) return taskCenterI18nModuleId;
    return null;
  },
  load(id) {
    if (id === taskCenterEntryModuleId) {
      return `
        export { TaskCommandCenter } from '/src/features/task-center/TaskCommandCenter.tsx';
        export { TaskModuleWorkspace } from '/src/features/task-center/TaskModuleWorkspace.tsx';
        export { I18nContext, createTranslator } from 'virtual:task-center-render-i18n';
      `;
    }
    if (id !== taskCenterI18nModuleId) return null;
    return `
      import React, { useContext } from 'react';
      const messages = ${JSON.stringify(taskCenterMessages)};
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
  plugins: [react(), taskCenterRenderPlugin],
  build: {
    ssr: true,
    outDir: bundleDirectory,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: 'virtual:task-center-render-entry',
      output: { entryFileNames: 'entry.mjs' },
    },
  },
});
const { TaskCommandCenter, TaskModuleWorkspace, I18nContext, createTranslator } = await import(pathToFileURL(join(bundleDirectory, 'entry.mjs')).href);

Date.now = () => Date.parse('2026-06-08T12:00:00.000Z');

const noop = () => undefined;
const tasks = Array.from({ length: 100 }, (_, index) => makeTask(index));
const books = Array.from({ length: 20 }, (_, index) => makeBookManifest(index));
const logs = Array.from({ length: 300 }, (_, index) => makeTaskLog(index, tasks[index % tasks.length]));
books.unshift({
  ...makeBookManifest(888),
  bookId: 'book-large-localized-numbers',
  bookTitle: '本地数字格式化压力书',
  chapterCount: 123456,
  paragraphCount: 234567,
  chunkCount: 345678,
  ftsRowCount: 456789,
  bytesIndexed: 567890,
});
const diagnostics = makeDiagnostics(tasks, books);
const initialChunkPreview = makeIndexedChunksPreview(books[0].bookId);
const importedQueuedTask = makeTask(1001, {
  bookId: 'book-imported-acceptance',
  bookTitle: '导入验收 TXT',
  fileName: 'import-acceptance.txt',
  kind: 'parse-and-index',
  message: '等待解析索引',
  name: '解析索引 · 导入验收 TXT',
  progress: 0,
  stage: 'queued',
  stageLabel: '排队中',
  status: 'queued',
  tone: 'amber',
});
const clickedRunProgressTasks = [
  ['read-file', '读取文件', 10],
  ['parse-chapters', '解析章节', 25],
  ['build-chunks', '生成 chunks', 45],
  ['write-chunks', '写入 chunk store', 65],
  ['write-fts', '写入 FTS', 85],
  ['verify', '校验索引', 95],
].map(([stage, stageLabel, progress], index) => makeTask(1100 + index, {
  bookId: 'book-imported-acceptance',
  bookTitle: '导入验收 TXT',
  fileName: 'import-acceptance.txt',
  kind: 'parse-and-index',
  message: `执行解析索引 · ${stageLabel}`,
  name: `执行后阶段变化 · ${stageLabel}`,
  progress,
  stage,
  stageLabel,
  status: 'running',
  tone: 'indigo',
}));
const missingSourceRetryTask = makeTask(1200, {
  bookId: 'book-missing-source',
  bookTitle: '移动后重试验收 TXT',
  fileName: 'moved-source.txt',
  kind: 'parse-and-index',
  message: '读取文件失败',
  name: '重试失败 · 源 TXT 缺失',
  progress: 10,
  stage: 'read-file',
  stageLabel: '读取文件',
  status: 'failed',
  tone: 'cinnabar',
  errorCode: 'file_missing',
  errorMessage: '读取文件失败',
  error: {
    code: 'file_missing',
    detail: { bookId: 'book-missing-source', inputPath: 'E:/books/moved-source.txt' },
    message: '读取文件失败',
    retryable: true,
    stage: 'read-file',
  },
});
const archivedRestoreTask = makeTask(1250, {
  bookId: 'book-archived-restore',
  bookTitle: '归档恢复验收 TXT',
  fileName: 'archived-restore.txt',
  kind: 'embedding-index',
  message: '任务已归档',
  name: '归档恢复 · 这是一个很长很长的后台任务标题用于验证单列卡片不会被详情面板覆盖',
  progress: 0,
  stage: 'done',
  stageLabel: '已归档',
  status: 'archived',
  tone: 'sage',
});
const longErrorTask = makeTask(999, {
  createdAt: '2026-06-08T08:00:00.000Z',
  durationMs: 1234567,
  errorCode: 'file_missing_extremely_long_path_' + 'chapter-segment-'.repeat(18),
  errorMessage: 'The selected TXT source could not be read. '.repeat(40),
  outputSummary: {
    chapters: 123456,
    paragraphs: 234567,
    chunks: 345678,
    ftsRows: 456789,
    bytesRead: 987654321,
    warnings: [],
  },
  status: 'failed',
  stage: 'verify',
});

assert.equal(tasks.length, 100, 'render fixture must construct 100 tasks');
assert.equal(books.length, 21, 'render fixture must construct 21 book index manifests');
assert.equal(logs.length, 300, 'render fixture must construct 300 task logs');

let html = '';
let emptyHtml = '';
let missingSourceHtml = '';
try {
  html = renderTaskCenterStaticMarkup({
    diagnostics,
    logs,
    selectedTask: longErrorTask,
    tasks: [importedQueuedTask, ...clickedRunProgressTasks, missingSourceRetryTask, archivedRestoreTask, longErrorTask, ...tasks],
  });
  missingSourceHtml = renderTaskCenterStaticMarkup({
    diagnostics,
    logs,
    selectedTask: missingSourceRetryTask,
    tasks: [missingSourceRetryTask, ...tasks],
  });
  emptyHtml = renderTaskCenterStaticMarkup({
    diagnostics: makeDiagnostics([], []),
    logs: [],
    selectedTask: null,
    tasks: [],
  });
} finally {
  rmSync(bundleDirectory, { recursive: true, force: true });
}

for (const required of [
  'task-center-console',
  'task-command-center',
  'task-module-nav',
  'task-module-workspace',
  'task-module-panel active',
  'task-workspace-scroll',
  'task-index-workspace-scroll',
  'task-detail-popover',
  'task-queue-table',
  'index-manifest-browser',
  'task-log-console',
  'task-detail-panel',
  '任务队列',
  '索引覆盖',
  '日志控制台',
  '资源策略',
  '命令中心',
]) {
  assert.match(html, escapeRegExp(required), `rendered task center must include ${required}`);
}

assert.doesNotMatch(html, /class="task-topbar"/, 'task center page must not render a duplicate internal topbar');
assert.doesNotMatch(html, /class="task-command-card/, 'left task sidebar must not render command cards above the workspace');
assert.doesNotMatch(html, /aria-label="刷新"[\s\S]*class="task-icon-btn"[\s\S]*aria-label="任务设置"/, 'task center must not render redundant refresh/settings buttons in an internal header');
assert.match(html, /class="task-module-card active"[\s\S]*任务队列[\s\S]*运行 \/ 暂停 \/ 重试/, 'module navigation must highlight the task queue module');
assert.match(html, /class="task-module-card"[\s\S]*索引覆盖[\s\S]*书籍 \/ chunks \/ FTS/, 'module navigation must include index coverage');
const leftCommandCenterHtml = sliceBetween(html, 'class="task-command-center"', 'class="task-module-workspace"');
assert.doesNotMatch(leftCommandCenterHtml, /正在发生|任务详情|索引健康|最近日志/, 'left switcher sidebar must not render residual status/insight sections');
assert.doesNotMatch(leftCommandCenterHtml, /task-insight-stream|task-status-rail|task-status-card|task-command-grid|task-command-card/, 'left switcher sidebar must only contain module switches');

assert.match(html, /1,234,567/, 'health dashboard must localize large dynamic numbers');
assert.match(html, /完成[\s\S]*11[\s\S]*已暂停[\s\S]*11[\s\S]*已取消[\s\S]*22/, 'health dashboard must render succeeded, paused, and cancelled task counts');
const firstIndexCardHtml = sliceBetween(html, '<article class="index-book-card status-ready"', '</article>');
assert.match(firstIndexCardHtml, /本地数字格式化压力书[\s\S]*已就绪/, 'index browser must render each book as a compact status card');
assert.doesNotMatch(firstIndexCardHtml, /123,456|234,567|345,678|456,789|hash-888/, 'compact index cards must keep counts and hashes out of the always-visible surface');
assert.match(html, /章节 123,456 · 段落 234,567 · chunks 345,678 · FTS 456,789/, 'task detail output summary must localize dynamic output counts');
assert.match(html, /987,654,321 bytes/, 'task detail byte count must be localized');
assert.match(html, /1,235s/, 'task duration seconds must be localized');
assert.match(html, /索引任务 001/, 'task table must render fixture task rows');
assert.match(html, /解析索引 · 导入验收 TXT[\s\S]*导入验收 TXT[\s\S]*排队中/, 'task center must show a queued parse/index row immediately after TXT import');
for (const [, stageLabel, progress] of clickedRunProgressTasks.map((task) => [task.stage, task.stageLabel, task.progress])) {
  assert.match(html, new RegExp(`执行后阶段变化 · ${escapeRegExpSource(stageLabel)}[\\s\\S]*导入验收 TXT[\\s\\S]*运行中[\\s\\S]*${escapeRegExpSource(stageLabel)}[\\s\\S]*${progress}%`), `task center must show click-run progress stage ${stageLabel} at ${progress}%`);
}
assert.match(html, /重试失败 · 源 TXT 缺失[\s\S]*移动后重试验收 TXT[\s\S]*失败[\s\S]*读取文件[\s\S]*10%[\s\S]*class="task-queue-card-menu-btn"[\s\S]*aria-expanded="false"/, 'task center must show a failed file_missing task with an action-menu entry after the source TXT is moved');
assert.match(missingSourceHtml, /task-1200[\s\S]*file_missing[\s\S]*读取文件失败[\s\S]*建议从书库移除、重新选择文件或保留记录后稍后重试。/, 'file_missing task details must show the source-missing reason and recovery advice');
assert.match(html, /示例书 001/, 'index browser must render fixture manifest rows');
assert.match(html, /字符范围[\s\S]*0-120/, 'chunk preview must render character ranges, not only character counts');
assert.match(html, /log-299/, 'log console must render the tail of the 300-log fixture');
const renderedLogMessages = (html.match(/class="task-log-message"/g) ?? []).length;
assert.ok(renderedLogMessages < 300, 'log console must window-render logs instead of dumping all 300 rows');
const expectedUpdatedTitle = escapeRegExpSource(formatFixtureAbsoluteTime('2026-06-08T09:00:00.000Z'));
assert.match(html, new RegExp(`title="${expectedUpdatedTitle}"[\\s\\S]*3小时前`), 'task table must render relative updated time with a localized absolute tooltip');
const taskLogConsoleHtml = sliceBetween(html, 'class="task-log-console"', 'class="task-resource-panel"');
assert.match(taskLogConsoleHtml, /dateTime="2026-06-08T11:\d{2}:00\.000Z"[\s\S]*分钟前/, 'log console must render relative log time with machine-readable absolute time');
assert.match(taskLogConsoleHtml, /aria-label="清空失败任务日志"/, 'log console must expose a clear action scoped to failed task logs');
assert.match(taskLogConsoleHtml, /aria-label="复制当前筛选日志"/, 'log console must expose a copy action for the current filtered log set');
const taskDetailPanelHtml = sliceBetween(html, 'class="task-detail-panel"', '</aside>');
assert.doesNotMatch(emptyHtml, /class="task-detail-panel"/, 'task detail panel must not render as an always-visible side panel when no task detail popover is open');
assert.match(html, /class="task-detail-popover-backdrop"[\s\S]*aria-label="关闭任务详情"/, 'task detail popover must expose an outside-click backdrop close target');
assert.match(taskDetailPanelHtml, /data-tooltip="关闭任务详情"[\s\S]*aria-label="关闭任务详情"/, 'task detail panel must expose a top-right close icon');
const expectedCreatedTitle = escapeRegExpSource(formatFixtureAbsoluteTime('2026-06-08T08:00:00.000Z'));
assert.match(html, new RegExp(`title="${expectedCreatedTitle}"[\\s\\S]*4小时前`), 'task detail panel must render relative created time with a localized absolute tooltip');
assert.match(taskDetailPanelHtml, /task-999/, 'task detail panel must render the selected task identity');
assert.match(taskDetailPanelHtml, /import-book[\s\S]*failed/, 'task detail panel must render selected task input type and status');
assert.match(taskDetailPanelHtml, /示例书 019[\s\S]*demo-999\.txt/, 'task detail panel must render associated book and input file');
assert.match(taskDetailPanelHtml, /章节 123,456 · 段落 234,567 · chunks 345,678 · FTS 456,789/, 'task detail panel must render index output artifacts');
assert.match(taskDetailPanelHtml, /The selected TXT source could not be read/, 'task detail panel must render selected task error details');
assert.match(taskDetailPanelHtml, /log-299/, 'task detail panel must render recent logs for investigation');
assert.match(taskLogConsoleHtml, /class="task-log-message"[\s\S]*log-000/, 'log message text must have a dedicated monospace hook');
assert.match(html, /class="task-queue-card-main task-cell-main"/, 'task queue cards must expose stable main-content hooks');
assert.match(html, /class="index-book-card status-ready"[\s\S]*class="[^"]*index-book-menu-trigger[^"]*"/, 'index book cards must expose a stable action-menu trigger');
assert.match(html, /<article class="task-queue-card"[\s\S]*role="button"[\s\S]*tabindex="0"/, 'task queue cards must expose keyboard-accessible action-menu entry points');
assert.match(html, /class="task-queue-card-menu-btn"[\s\S]*aria-label="操作"[\s\S]*aria-expanded="false"/, 'task queue cards must expose an accessible action-menu entry point');
assert.match(taskDetailPanelHtml, /建议查看任务日志后重试，或重建该书索引。/, 'failed task details must render a recommended recovery action');
const taskIconButtons = Array.from(html.matchAll(/<button\b[^>]*class="[^"]*\btask-icon-btn\b[^"]*"[^>]*>/g), ([button]) => button);
assert.ok(taskIconButtons.length >= 12, 'rendered task center must include task icon buttons for auditing');
for (const button of taskIconButtons) {
  assert.match(button, /\baria-label="[^"]+"/, `task icon button must include aria-label: ${button}`);
  assert.match(button, /\bdata-tooltip="[^"]+"/, `task icon button must include data-tooltip: ${button}`);
}
const dangerIconButtons = taskIconButtons.filter((button) => /\btask-icon-btn danger\b/.test(button));
assert.ok(dangerIconButtons.length >= 5, 'danger task actions must render as icon buttons, not plain text links');
for (const button of dangerIconButtons) {
  assert.match(button, /\baria-label="[^"]+"/, `danger icon button must include aria-label: ${button}`);
  assert.match(button, /\bdata-tooltip="[^"]+"/, `danger icon button must include tooltip: ${button}`);
}
assert.match(html, /file_missing_extremely_long_path_/, 'long error code fixture must render for overflow coverage');
assert.match(html, /The selected TXT source could not be read/, 'long error message fixture must render in details');

for (const required of [
  'task-empty-guide',
  '导入 TXT',
  '选择目录',
  '运行示例',
  'task-table-empty',
  'task-index-empty-state',
]) {
  assert.match(emptyHtml, escapeRegExp(required), `empty task center render must include ${required}`);
}
const emptyIndexBrowserHtml = sliceBetween(emptyHtml, 'class="index-manifest-browser"', 'class="task-queue-section"');
const emptyTaskQueueHtml = sliceBetween(emptyHtml, 'class="task-queue-section"', 'class="task-log-console"');
assert.match(emptyTaskQueueHtml, /<button[^>]*>导入 TXT<\/button>[\s\S]*<button[^>]*>选择目录<\/button>[\s\S]*<button[^>]*>运行示例<\/button>/, 'empty task queue must provide direct action buttons');
assert.match(emptyIndexBrowserHtml, /<button[^>]*class="primary-btn small"[^>]*>导入 TXT<\/button>/, 'empty index browser must provide a direct import entry action');
assert.doesNotMatch(emptyTaskQueueHtml + emptyIndexBrowserHtml + emptyHtml, /开启.*旅程|探索.*可能|智能.*升级|焕新|beautiful|journey|unlock|discover|delight/i, 'task center empty states must avoid marketing-style copy');
assert.doesNotMatch(emptyHtml, /undefined|null|\[object Object\]/, 'empty task center render must not leak broken placeholder values');

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(packageJson.scripts['test:task-center-render'], 'node scripts/verify-task-center-render-output.mjs', 'package.json must define test:task-center-render');
assert.match(packageJson.scripts.test, /test:task-center-render/, 'npm test must run task center render verification');

const styles = readCssWithImports('src/app/styles.css');
const taskModuleWorkspace = readFileSync('src/features/task-center/TaskModuleWorkspace.tsx', 'utf8');
const taskQueueTable = readFileSync('src/features/task-center/TaskQueueTable.tsx', 'utf8');
const indexManifestBrowser = readFileSync('src/features/task-center/IndexManifestBrowser.tsx', 'utf8');
const narrowTaskCommandStyles = (styles.match(/@media \(max-width:\s*980px\)\s*\{[\s\S]*?\n\}/g) ?? [])
  .find((block) => block.includes('.task-command-grid')) ?? '';
assert.match(styles, /\.task-center-console\s*\{[\s\S]*grid-template-columns:\s*minmax\(210px,\s*260px\)\s*minmax\(0,\s*1fr\)/, 'task center must use the visual companion left-switcher and right-workspace layout on desktop');
assert.match(styles, /\.tasks-page-main\s*\{[\s\S]*overflow:\s*hidden/, 'task center page shell must not scroll as a whole');
assert.match(styles, /\.task-command-center\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)/, 'left command center must be a standalone module sidebar');
assert.match(styles, /\.task-module-nav\s*\{[\s\S]*overflow:\s*auto/, 'left module sidebar must own its own overflow when needed');
assert.match(styles, /\.task-module-workspace\s*\{[\s\S]*overflow:\s*hidden/, 'right task workspace must own the visible module content and clip its scroll region');
assert.match(styles, /\.task-workspace-scroll\s*\{[\s\S]*overflow:\s*auto/, 'right task workspace must scroll independently');
assert.match(styles, /\.tasks-page-main \.task-queue-page-shell\s*\{[^}]*grid-template-rows:\s*auto\s*minmax\(0,\s*1fr\)[^}]*overflow:\s*hidden/, 'task queue must keep its three-page switcher fixed above the selected scroll region');
assert.match(styles, /\.tasks-page-main \.task-queue-view-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,1fr\)\)/, 'task queue must expose three equally weighted top-level page tabs');
assert.match(styles, /\.tasks-page-main \.task-log-page-shell\s*\{[^}]*grid-template-rows:\s*auto\s*minmax\(0,1fr\)[^}]*overflow:\s*hidden/, 'log console must keep its overview and filter switcher above the selected scroll region');
assert.match(styles, /\.tasks-page-main \.task-diagnostic-terminal\s*\{[^}]*color:\s*var\(--ink-0\)[^}]*background:\s*color-mix\(in srgb,\s*var\(--paper-0\)/, 'log overview must use theme paper and ink colors instead of a fixed black terminal surface');
assert.match(styles, /\.tasks-page-main \.task-log-filterbar\s*\{[^}]*z-index:\s*10[\s\S]*\.tasks-page-main \.task-log-actionbar\s*\{[^}]*z-index:\s*20/, 'log action tooltips must stack above the closed themed filter select');
assert.match(styles, /\.tasks-page-main \.task-log-filterbar:has\(\.themed-select\.open\)\s*\{\s*z-index:\s*40/, 'an open log filter menu must regain priority over the action tooltip layer');
assert.match(styles, /\.tasks-page-main \.task-execution-card\s*\{[^}]*grid-template-areas:[\s\S]*"head progress meta menu"/, 'task execution cards must use a dense desktop row layout');
assert.match(styles, /\.tasks-page-main \.task-card-grid\s*\{[^}]*grid-template-columns:\s*1fr[\s\S]*overflow:\s*auto/, 'task execution cards must render one queue card per row and scroll inside the workspace');
assert.match(styles, /\.tasks-page-main \.task-execution-card strong\s*\{[^}]*white-space:\s*normal[\s\S]*overflow-wrap:\s*anywhere/, 'long task card titles must wrap instead of pushing into the detail panel');
assert.doesNotMatch(taskModuleWorkspace, /tasks\.slice\(0,\s*12\)/, 'task execution deck must not truncate the scrollable queue to 12 cards');
assert.match(taskQueueTable, /canRetry[\s\S]*onControl\(task\.id,\s*'retry'\)/, 'failed task action menus must retain the retry command');
assert.match(taskQueueTable, /canRestore[\s\S]*onControl\(task\.id,\s*'restore'\)/, 'archived task action menus must retain the restore command');
assert.match(taskQueueTable, /canCancel[\s\S]*onControl\(task\.id,\s*'cancel'\)/, 'queued and running task action menus must retain the cancel command');
assert.match(taskQueueTable, /tasks\.detail\.open[\s\S]*onOpenDetails\(task\.id\)/, 'task action menus must retain the detail command');
assert.match(taskQueueTable, /tasks\.log[\s\S]*onOpenLogs\(task\.id\)/, 'task action menus must retain the log command');
assert.doesNotMatch(styles, /@media \(max-width:\s*1280px\)[\s\S]*\.task-workspace-sidecar/, 'task queue workspace must not reserve or collapse a permanent detail sidecar');
assert.match(narrowTaskCommandStyles, /\.task-command-metrics\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, 'command metrics must become two columns on narrow screens');
assert.match(styles, /\.task-queue-table\s*\{[^}]*display:\s*grid[\s\S]*overflow:\s*visible/, 'task queue list must use a grid while allowing open action menus to remain visible');
assert.match(styles, /\.task-queue-card\s*\{[^}]*grid-template-columns:\s*28px\s+minmax\(0,1fr\)\s+38px[\s\S]*padding:\s*12px/, 'task queue cards must use stable selection, content, and action columns');
assert.match(styles, /\.index-book-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(260px,\s*1fr\)\)/, 'index manifests must render as responsive book cards');
assert.match(styles, /\.tasks-page-main \.index-manifest-browser\s*\{[^}]*height:\s*100%[^}]*display:\s*flex[^}]*overflow:\s*hidden/, 'index manifest browser must occupy the bounded workspace height');
assert.match(styles, /\.tasks-page-main \.index-book-card-grid\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/, 'index manifest book cards must own a vertical scroll region instead of clipping overflow books');
assert.match(styles, /\.task-queue-card-menu\s*\{[^}]*position:\s*absolute[\s\S]*z-index:\s*80/, 'task action controls must open in a floating menu without resizing the card');
assert.match(styles, /\.task-floating-menu\s*\{[^}]*position:\s*fixed[\s\S]*z-index:\s*1300/, 'index right-click menus must float above the workspace');
assert.match(indexManifestBrowser, /onContextMenu=.*handleBookContextMenu/, 'index book cards must open their actions from a right click');
assert.match(indexManifestBrowser, /IndexBookDetail[\s\S]*chapterCount[\s\S]*paragraphCount[\s\S]*chunkCount[\s\S]*ftsRowCount[\s\S]*contentHash/, 'index counts, versions, and content hash must live in the on-demand detail view');
assert.match(styles, /\.task-cell-main strong[\s\S]*-webkit-line-clamp:\s*2/, 'task titles must be two-line clamped');
assert.match(styles, /\.task-cell-main em[\s\S]*overflow-wrap:\s*anywhere/, 'long task error codes must wrap inside task table cells');
assert.match(styles, /\.task-detail-panel details p[\s\S]*overflow-wrap:\s*anywhere/, 'long task error messages must wrap inside the detail panel');
assert.match(styles, /\.task-log-message[\s\S]*ui-monospace/, 'task log messages must use monospace');
assert.doesNotMatch(styles, /\.task-log-console\s*\{[^}]*ui-monospace/, 'task log console container must not make the whole section monospace');
assert.doesNotMatch(styles, /\.task-log-list\s*\{[^}]*ui-monospace/, 'task log list container must not make the whole list monospace');
assert.match(taskModuleWorkspace, /createPortal\(taskDetailPopover,\s*document\.querySelector<HTMLElement>\('\.app-shell'\)\s*\?\?\s*document\.body\)/, 'task detail popover must portal outside the task center page shell so fixed positioning is not constrained by the sticky task header');
assert.match(styles, /\.task-detail-popover\s*\{[^}]*position:\s*fixed[\s\S]*z-index:\s*1200/, 'task detail popover must render above the task queue and sticky task header instead of reserving a permanent side column');
assert.match(styles, /\.task-detail-popover-backdrop\s*\{[^}]*position:\s*absolute[\s\S]*inset:\s*0/, 'task detail popover must include a full outside-click backdrop');
assert.match(styles, /\.task-detail-panel\s*\{[^}]*border:\s*1px solid[\s\S]*background:/, 'task detail panel must render as an opaque bounded panel, not transparent floating text');
assert.match(styles, /\.task-detail-close\s*\{[\s\S]*justify-self:\s*end/, 'task detail close button must sit in the panel header action area');
assert.match(styles, /\.task-index-empty-state \.primary-btn\s*\{[^}]*justify-self:\s*start/, 'empty index import button must not stretch under the detail panel');
assert.match(styles, /\.task-icon-btn\.danger\s*\{[^}]*border-color:\s*color-mix\(in srgb,\s*var\(--cinnabar\)\s*42%[\s\S]*color:\s*var\(--cinnabar\)/, 'danger icon buttons must use red border and warning color');
assert.match(styles, /\.task-icon-btn\.danger:hover\s*\{[^}]*background:\s*var\(--cinnabar\)/, 'danger icon buttons must use warning hover fill');
assert.match(styles, /\.task-status-pill\.queued\s*\{[^}]*color:\s*var\(--amber\)/, 'queued task status must use the fixed amber color');
assert.match(styles, /\.task-status-pill\.running,[\s\S]*\.task-status-pill\.cancelling\s*\{[^}]*color:\s*var\(--indigo\)/, 'running task statuses must use the fixed indigo color');
assert.match(styles, /\.task-status-pill\.paused\s*\{[^}]*color:\s*var\(--violet\)/, 'paused task status must use the fixed violet color');
assert.match(styles, /\.task-status-pill\.succeeded,[\s\S]*\.task-status-pill\.skipped\s*\{[^}]*color:\s*var\(--sage\)/, 'successful task statuses must use the fixed sage color');
assert.match(styles, /\.task-status-pill\.failed,[\s\S]*\.task-status-pill\.cancelled\s*\{[^}]*color:\s*var\(--cinnabar\)/, 'failed and cancelled task statuses must use the fixed cinnabar color');
assert.match(styles, /\.task-table-empty[\s\S]*grid-column:\s*1\s*\/\s*-1/, 'empty states must span the full task grid');
assert.match(styles, /@media \(max-width:\s*980px\)[\s\S]*\.task-center-console[\s\S]*grid-template-columns:\s*1fr/, 'task center console must collapse to one column on narrow screens');

function renderTaskCenterStaticMarkup({ diagnostics, logs, selectedTask, tasks }) {
  return renderToStaticMarkup(
    React.createElement(
      I18nContext.Provider,
      { value: { locale: 'zh-CN', setLocale: noop, t: createTranslator('zh-CN') } },
      React.createElement(
        'main',
        { className: 'task-center-render-fixture' },
        React.createElement(
          'div',
          { className: 'task-center-console' },
          React.createElement(TaskCommandCenter, {
            activeModule: 'queue',
            onSelectModule: noop,
          }),
          React.createElement(TaskModuleWorkspace, {
            activeModule: 'queue',
            books: diagnostics.books,
            busy: false,
            diagnostics,
            errorDetailsDefaultExpanded: true,
            filter: 'all',
            indexEmptySummary: null,
            initialChunkPreview,
            logs,
            onArchive: noop,
            onBatchCancelSelected: noop,
            onBatchClearCompleted: noop,
            onBatchRebuildSelectedIndexes: noop,
            onBatchRetrySelected: noop,
            onClearLogs: noop,
            onControl: noop,
            onDeleteIndex: noop,
            onImportDirectory: noop,
            onImportIndexEntry: noop,
            onImportTxt: noop,
            onLearnIndexArtifacts: noop,
            onLoadAllLogs: noop,
            onOpenDetails: noop,
            onCloseDetails: noop,
            onOpenLogs: noop,
            onOpenTaskSettings: noop,
            onRebuildIndex: noop,
            onRepairFts: noop,
            onRunSample: noop,
            privacyMode: false,
            selectedTask,
            tasks,
          }),
        ),
      ),
    ),
  );
}

function makeTask(index, overrides = {}) {
  const statuses = ['queued', 'running', 'paused', 'cancelling', 'cancelled', 'failed', 'succeeded', 'skipped', 'archived'];
  const stages = ['queued', 'read-file', 'parse-chapters', 'build-chunks', 'write-chunks', 'write-fts', 'verify', 'done'];
  const status = overrides.status ?? statuses[index % statuses.length];
  const stage = overrides.stage ?? stages[index % stages.length];
  const progress = overrides.progress ?? (status === 'succeeded' ? 100 : (index * 7) % 100);
  return {
    id: `task-${String(index).padStart(3, '0')}`,
    kind: index % 3 === 0 ? 'import-book' : 'parse-and-index',
    name: `索引任务 ${String(index).padStart(3, '0')}`,
    status,
    progress,
    stage,
    stageLabel: stage,
    tone: status === 'failed' || status === 'cancelled' ? 'cinnabar' : status === 'running' ? 'indigo' : status === 'paused' ? 'violet' : status === 'succeeded' ? 'sage' : 'amber',
    message: `处理第 ${index + 1} 本书`,
    bookId: `book-${String(index % 20).padStart(3, '0')}`,
    bookTitle: `示例书 ${String(index % 20).padStart(3, '0')}`,
    fileName: `demo-${index}.txt`,
    createdAt: `2026-06-08T08:${String(index % 60).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-06-08T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
    startedAt: `2026-06-08T08:${String(index % 60).padStart(2, '0')}:10.000Z`,
    finishedAt: '',
    durationMs: index * 1234,
    attempt: index % 3,
    maxAttempts: 3,
    errorCode: status === 'failed' ? `file_missing_${index}` : '',
    errorMessage: status === 'failed' ? `文件缺失 ${index}` : '',
    error: {
      code: status === 'failed' ? `file_missing_${index}` : '',
      detail: {},
      message: status === 'failed' ? `文件缺失 ${index}` : '',
      retryable: true,
      stage,
    },
    logCount: index * 2,
    outputSummary: {
      chapters: 10 + index,
      paragraphs: 100 + index,
      chunks: 200 + index,
      ftsRows: 200 + index,
      bytesRead: 1024 * (index + 1),
      warnings: [],
    },
    ...overrides,
  };
}

function makeBookManifest(index) {
  const statuses = ['ready', 'missing', 'stale', 'failed'];
  return {
    bookId: `book-${String(index).padStart(3, '0')}`,
    bookTitle: `示例书 ${String(index).padStart(3, '0')}`,
    filePath: `E:/books/demo-${index}.txt`,
    contentHash: `hash-${index}`,
    indexVersion: 2,
    chunkStrategyVersion: 3,
    chapterRuleVersion: 1,
    ftsSchemaVersion: 1,
    status: statuses[index % statuses.length],
    builtAt: `2026-06-08T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
    staleReason: index % 4 === 2 ? 'chunk 策略已更新' : '',
    chapterCount: 12 + index,
    paragraphCount: 200 + index,
    chunkCount: index % 4 === 1 ? 0 : 300 + index,
    ftsRowCount: index % 5 === 0 ? 0 : 300 + index,
    bytesIndexed: 2048 * (index + 1),
    firstChunkPreview: `第一段预览 ${index}`,
    lastError: index % 4 === 3 ? 'FTS 写入失败' : '',
  };
}

function makeTaskLog(index, task) {
  const levels = ['debug', 'info', 'warn', 'error'];
  const stage = task.stage;
  return {
    id: `log-${String(index).padStart(3, '0')}`,
    taskId: task.id,
    bookId: task.bookId,
    level: levels[index % levels.length],
    stage,
    message: `log-${String(index).padStart(3, '0')} ${task.name} ${'long-message-'.repeat(index % 7)}`,
    detail: { index },
    createdAt: `2026-06-08T11:${String(index % 60).padStart(2, '0')}:00.000Z`,
  };
}

function makeDiagnostics(tasks, books) {
  return {
    summary: {
      queuedCount: tasks.filter((task) => task.status === 'queued').length,
      runningCount: tasks.filter((task) => task.status === 'running' || task.status === 'cancelling').length,
      succeededCount: tasks.filter((task) => task.status === 'succeeded' || task.status === 'skipped').length,
      failedCount: tasks.filter((task) => task.status === 'failed').length,
      pausedCount: tasks.filter((task) => task.status === 'paused').length,
      cancelledCount: tasks.filter((task) => task.status === 'cancelled').length,
      staleBookCount: books.filter((book) => book.status === 'stale').length,
      indexedChunkCount: books.length === 0 ? 0 : 1234567,
      indexedBookCount: books.filter((book) => book.status === 'ready').length,
      ftsAvailable: books.length > 0,
      ftsDatabasePath: books.length > 0 ? 'E:/BookMind/index/search.sqlite' : '',
      ftsDatabaseSizeBytes: 987654321,
      ftsDatabaseModifiedAt: '2026-06-08T12:00:00.000Z',
      recentError: '',
    },
    books,
  };
}

function makeIndexedChunksPreview(bookId) {
  return {
    bookId,
    total: 1,
    limit: 20,
    offset: 0,
    items: [{
      chunkId: 'chunk-preview-001',
      ordinal: 1,
      chapterIndex: 0,
      chapterTitle: '第一章 雨夜',
      paragraphStart: 0,
      paragraphEnd: 2,
      paragraphRange: 'P1-P3',
      charStart: 0,
      charEnd: 120,
      sourceChapterIndex: 0,
      paragraphIndex: 0,
      startOffset: 0,
      endOffset: 120,
      charCount: 120,
      textPreview: '林七夜在雨夜抵达病院。',
      fullText: '林七夜在雨夜抵达病院，墙上的钟声突然停止。',
      readerLocation: 'chapter=0&paragraph=0&start=0&end=120',
    }],
  };
}

function escapeRegExp(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

function escapeRegExpSource(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatFixtureAbsoluteTime(value) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function sliceBetween(value, start, end) {
  const startIndex = value.indexOf(start);
  assert.notEqual(startIndex, -1, `rendered markup must include ${start}`);
  const endIndex = value.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `rendered markup must include ${end} after ${start}`);
  return value.slice(startIndex, endIndex);
}

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

function readCssWithImports(filePath, seen = new Set()) {
  if (seen.has(filePath)) return '';
  seen.add(filePath);
  const source = readFileSync(filePath, 'utf8');
  const imports = [...source.matchAll(/@import\s+['"](.+?)['"];/g)]
    .map((match) => readCssWithImports(join(dirname(filePath), match[1]), seen));
  return [source, ...imports].join('\n');
}

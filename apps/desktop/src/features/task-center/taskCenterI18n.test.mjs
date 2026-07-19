import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('./TaskModuleWorkspace.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('./TaskDetailPanel.tsx', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../i18n/en-US.ts', import.meta.url), 'utf8');

const forbiddenHardcodedText = [
  '关闭任务详情',
  '打开完整任务表格',
  '打开日志筛选与导出明细',
  '任务执行舱',
  '后台队列',
  '导入 TXT',
  '选择目录',
  '运行示例',
  '了解索引产物',
  '无任务',
  '导入 TXT 后会在这里显示解析、全文索引和语义分块进度。',
  '查看任务详情',
  '日志',
  '暂停',
  '重试',
  '恢复任务',
  '取消',
  '归档',
  '诊断终端',
  '错误',
  '警告',
  '全部日志',
  '清空失败任务日志',
  '清空全部日志',
  '结构化日志',
  '暂无日志。',
  '资源策略',
  '并发 / 隐私 / 维护',
  '打开任务设置',
  '活跃或排队任务',
  'FTS 数据库',
  '最近错误',
  '文件名与路径隐私保护',
];

for (const text of forbiddenHardcodedText) {
  assert.equal(workspace.includes(text), false, `Task module workspace should translate hardcoded text: ${text}`);
  assert.equal(detail.includes(text), false, `Task detail panel should translate hardcoded text: ${text}`);
}

const requiredKeys = [
  'tasks.detail.close',
  'tasks.legacy.openFullTable',
  'tasks.legacy.openLogDetails',
  'tasks.execution.aria',
  'tasks.execution.eyebrow',
  'tasks.execution.title',
  'tasks.execution.emptyTitle',
  'tasks.execution.emptyDescription',
  'tasks.execution.details',
  'tasks.execution.restore',
  'tasks.diagnostics.aria',
  'tasks.diagnostics.title',
  'tasks.diagnostics.errors',
  'tasks.diagnostics.warnings',
  'tasks.diagnostics.logs',
  'tasks.diagnostics.allLogs',
  'tasks.diagnostics.empty',
  'tasks.resources.aria',
  'tasks.resources.eyebrow',
  'tasks.resources.title',
  'tasks.resources.openSettings',
  'tasks.resources.activeQueued',
  'tasks.resources.ftsDatabase',
  'tasks.resources.recentErrors',
  'tasks.resources.privacy',
  'tasks.resources.privacyDetail',
];

for (const key of requiredKeys) {
  assert.match(zh, new RegExp(`'${escapeRegExp(key)}'\\s*:`), `zh-CN should define ${key}`);
  assert.match(en, new RegExp(`'${escapeRegExp(key)}'\\s*:`), `en-US should define ${key}`);
}

console.log('Verified task center visible controls and tooltips use i18n keys.');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

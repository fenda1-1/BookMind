import type { TaskLogRecord } from '../../types';
import { redactTaskText } from './taskPrivacy';

export function formatTaskLogsJsonl(logs: TaskLogRecord[], privacyMode: boolean) {
  return logs.map((log) => JSON.stringify({ ...log, message: redactTaskText(log.message, privacyMode) })).join('\n');
}

export function formatTaskLogsMarkdown(logs: TaskLogRecord[], privacyMode: boolean, exportedAt = new Date().toISOString()) {
  const lines = ['# BookMind Task Logs', '', `Exported at: ${exportedAt}`, '', '| Time | Level | Stage | Book | Message |', '| --- | --- | --- | --- | --- |'];
  logs.forEach((log) => {
    lines.push(`| ${escapeMarkdownTableCell(log.createdAt)} | ${escapeMarkdownTableCell(log.level)} | ${escapeMarkdownTableCell(log.stage)} | ${escapeMarkdownTableCell(log.bookId)} | ${escapeMarkdownTableCell(redactTaskText(log.message, privacyMode))} |`);
  });
  return lines.join('\n');
}

export function copyVisibleTaskLogs(logs: TaskLogRecord[], privacyMode: boolean, exportedAt = new Date().toISOString()) {
  void navigator.clipboard?.writeText(formatTaskLogsMarkdown(logs, privacyMode, exportedAt));
}

export function copyRecentErrorLogs(logs: TaskLogRecord[], privacyMode: boolean, limit = 100, exportedAt = new Date().toISOString()) {
  const payload = formatTaskLogsMarkdown(logs.filter((log) => log.level === 'error').slice(-limit), privacyMode, exportedAt);
  void navigator.clipboard?.writeText(payload);
}

function escapeMarkdownTableCell(value: string | number | undefined) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

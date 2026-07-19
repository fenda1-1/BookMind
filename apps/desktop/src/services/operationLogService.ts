import type { OperationLogLevel } from '../types';

const OPERATION_LOG_LEVEL_KEY = 'bookmind:operation-log-level';
const OPERATION_LOG_ENTRIES_KEY = 'bookmind:operation-log-entries';
const MAX_OPERATION_LOG_ENTRIES = 500;

type OperationLogEntry = {
  at: string;
  level: Exclude<OperationLogLevel, 'none'>;
  action: string;
  detail?: Record<string, unknown>;
};

type OperationLogPrivacyPolicy = {
  recordInputContent?: boolean;
  recordPaths?: boolean;
};

const logRank: Record<OperationLogLevel, number> = { none: 0, error: 1, basic: 2, debug: 3 };
const DAY_MS = 86_400_000;
const pathKeyPattern = /(path|directory|dir|file|filename)$/i;
const embeddedAbsolutePathPattern = /([a-zA-Z]:[\\/][^\s"'<>|]+|\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[^\s"'<>|]+)/g;

export function setOperationLogLevel(level: OperationLogLevel) {
  localStorage.setItem(OPERATION_LOG_LEVEL_KEY, level);
}

export function getOperationLogLevel(): OperationLogLevel {
  const value = localStorage.getItem(OPERATION_LOG_LEVEL_KEY);
  return value === 'error' || value === 'basic' || value === 'debug' ? value : 'none';
}

export function recordOperationLog(level: Exclude<OperationLogLevel, 'none'>, action: string, detail?: Record<string, unknown>, retentionDays?: number, privacyPolicy: OperationLogPrivacyPolicy = {}) {
  const currentLevel = getOperationLogLevel();
  if (logRank[currentLevel] < logRank[level]) return;
  const entries = loadOperationLogs(retentionDays);
  entries.unshift({ at: new Date().toISOString(), level, action, detail: sanitizeOperationLogDetail(detail, privacyPolicy) });
  localStorage.setItem(OPERATION_LOG_ENTRIES_KEY, JSON.stringify(entries.slice(0, MAX_OPERATION_LOG_ENTRIES)));
}

export function loadOperationLogs(retentionDays?: number): OperationLogEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPERATION_LOG_ENTRIES_KEY) ?? '[]');
    const entries = Array.isArray(parsed) ? parsed.filter(isOperationLogEntry) : [];
    return filterOperationLogsByRetention(entries, retentionDays);
  } catch {
    return [];
  }
}

export function clearOperationLogs() {
  localStorage.removeItem(OPERATION_LOG_ENTRIES_KEY);
}

export function applyOperationLogRetention(retentionDays: number) {
  const retained = loadOperationLogs(retentionDays);
  localStorage.setItem(OPERATION_LOG_ENTRIES_KEY, JSON.stringify(retained.slice(0, MAX_OPERATION_LOG_ENTRIES)));
  return retained.length;
}

function filterOperationLogsByRetention(entries: OperationLogEntry[], retentionDays?: number) {
  if (retentionDays === undefined || !Number.isFinite(retentionDays) || retentionDays <= 0) return entries;
  const cutoff = Date.now() - retentionDays * DAY_MS;
  return entries.filter((entry) => {
    const timestamp = Date.parse(entry.at);
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  });
}

function isOperationLogEntry(value: unknown): value is OperationLogEntry {
  const entry = value as Partial<OperationLogEntry> | null;
  return Boolean(entry)
    && typeof entry?.at === 'string'
    && (entry.level === 'error' || entry.level === 'basic' || entry.level === 'debug')
    && typeof entry.action === 'string';
}

function sanitizeOperationLogDetail(detail: Record<string, unknown> | undefined, privacyPolicy: OperationLogPrivacyPolicy) {
  if (!detail) return detail;
  return sanitizeOperationLogValue(detail, '', privacyPolicy) as Record<string, unknown>;
}

function sanitizeOperationLogValue(value: unknown, key: string, privacyPolicy: OperationLogPrivacyPolicy): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeOperationLogValue(item, key, privacyPolicy));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeOperationLogValue(entryValue, entryKey, privacyPolicy)]));
  }
  if (typeof value !== 'string') return value;
  if (!privacyPolicy.recordInputContent && /^(value|text|input|prompt|query)$/i.test(key)) return `[redacted:${value.length}]`;
  if (!privacyPolicy.recordPaths && (pathKeyPattern.test(key) || embeddedAbsolutePathPattern.test(value))) return redactOperationLogPaths(value);
  return value;
}

function redactOperationLogPaths(value: string) {
  return value.replace(embeddedAbsolutePathPattern, (match) => basename(match) || '[path:redacted]');
}

function basename(value: string) {
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '');
  return normalized.split('/').filter(Boolean).pop() ?? '';
}

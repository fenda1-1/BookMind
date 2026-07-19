type DiagnosticValue = null | boolean | number | string | DiagnosticValue[] | { [key: string]: DiagnosticValue };

type TaskDiagnosticsExportInput = {
  createdAt?: string;
  diagnostics: unknown;
  logs: unknown[];
  tasks: unknown[];
};

type TaskDetailDiagnosticsInput = {
  exportedAt?: string;
  logs: unknown[];
  task: unknown;
};

type RedactedPath = {
  fileName: string;
  pathHash: string;
};

const pathKeyPattern = /(path|directory|dir|filePath|ftsDatabasePath)$/i;
const windowsAbsolutePathPattern = /^[a-zA-Z]:[\\/][\s\S]+/;
const posixAbsolutePathPattern = /^\/(Users|home|tmp|var|private|Volumes|mnt|opt|etc)[/\s\S]*/;
const embeddedAbsolutePathPattern = /([a-zA-Z]:[\\/][^\s"'<>|]+|\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[^\s"'<>|]+)/g;

export function buildTaskDiagnosticsExport(input: TaskDiagnosticsExportInput) {
  return {
    schema: 'bookmind.task-diagnostics.v1',
    createdAt: input.createdAt ?? new Date().toISOString(),
    redaction: {
      absolutePaths: 'basename-and-hash',
    },
    diagnostics: redactDiagnosticPaths(input.diagnostics),
    tasks: redactDiagnosticPaths(input.tasks),
    logs: redactDiagnosticPaths(input.logs),
  };
}

export function buildTaskDetailDiagnosticJson(input: TaskDetailDiagnosticsInput) {
  const taskId = taskIdentifier(input.task);
  return redactDiagnosticPaths({
    schema: 'bookmind.task-detail-diagnostic.v1',
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    task: input.task,
    recentLogs: input.logs.filter((log) => logTaskIdentifier(log) === taskId).slice(-20),
  });
}

export function redactDiagnosticPaths<T>(value: T): T {
  return redactValue(value, '') as T;
}

function taskIdentifier(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  return String((value as { id?: unknown }).id ?? '');
}

function logTaskIdentifier(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  return String((value as { taskId?: unknown }).taskId ?? '');
}

function redactValue(value: unknown, key: string): DiagnosticValue | RedactedPath {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, DiagnosticValue | RedactedPath> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      output[entryKey] = redactValue(entryValue, entryKey);
    }
    return output;
  }
  if (typeof value === 'string') {
    if (shouldRedactPath(key, value)) return redactPath(value);
    return redactEmbeddedPaths(value);
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }
  return String(value ?? '');
}

function redactEmbeddedPaths(value: string) {
  return value.replace(embeddedAbsolutePathPattern, (match) => `[path:${basename(match)}:${fnv1aHash(match)}]`);
}

function shouldRedactPath(key: string, value: string) {
  return pathKeyPattern.test(key) && (windowsAbsolutePathPattern.test(value) || posixAbsolutePathPattern.test(value));
}

function redactPath(value: string): RedactedPath {
  return {
    fileName: basename(value),
    pathHash: fnv1aHash(value),
  };
}

function basename(value: string) {
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '');
  return normalized.split('/').filter(Boolean).pop() ?? '';
}

function fnv1aHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

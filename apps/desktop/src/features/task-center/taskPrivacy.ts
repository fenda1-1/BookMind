const privacyPlaceholder = '***';
const embeddedAbsolutePathPattern = /([a-zA-Z]:[\\/][^\s"'<>|]+|\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[^\s"'<>|]+)/g;

export function displayTaskPath(value: string, privacyMode: boolean) {
  if (!value.trim()) return '-';
  if (!privacyMode) return value;
  const fileName = basename(value);
  return fileName || privacyPlaceholder;
}

export function displayTaskFileName(value: string, privacyMode: boolean) {
  if (!value.trim()) return '-';
  return privacyMode ? basename(value) || privacyPlaceholder : value;
}

export function redactTaskText(value: string, privacyMode: boolean) {
  if (!privacyMode || !value.trim()) return value;
  return value.replace(embeddedAbsolutePathPattern, (match) => basename(match) || privacyPlaceholder);
}

function basename(value: string) {
  const normalized = value.replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? '';
}

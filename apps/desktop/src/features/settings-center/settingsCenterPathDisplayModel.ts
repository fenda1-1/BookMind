export function normalizeDisplayPath(path: string) {
  return path.replaceAll('\\', '/').replace(/\/+$/, '');
}

export function joinDisplayPath(base: string, suffix: string) {
  return `${normalizeDisplayPath(base)}/${suffix}`;
}

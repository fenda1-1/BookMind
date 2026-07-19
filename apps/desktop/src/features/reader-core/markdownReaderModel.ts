export type MarkdownTocItem = {
  id: string;
  title: string;
  level: number;
  lineIndex: number;
};

export type MarkdownInlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'emphasis'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string; segments: MarkdownInlineSegment[] }
  | { kind: 'image'; text: string; alt: string; src: string; title?: string; width?: string; height?: string }
  | { kind: 'break'; text: '' };

export type MarkdownTableAlignment = 'left' | 'center' | 'right' | 'default';

export type MarkdownListItem = {
  segments: MarkdownInlineSegment[];
  checked?: boolean;
};

export type MarkdownReaderBlock =
  | { type: 'heading'; id: string; level: number; text: string; lineIndex: number; segments: MarkdownInlineSegment[] }
  | { type: 'paragraph'; lineIndex: number; segments: MarkdownInlineSegment[] }
  | { type: 'code'; lineIndex: number; language: string; code: string }
  | { type: 'list'; lineIndex: number; ordered: boolean; task: boolean; items: MarkdownListItem[] }
  | { type: 'table'; lineIndex: number; headers: MarkdownInlineSegment[][]; alignments: MarkdownTableAlignment[]; rows: MarkdownInlineSegment[][][] }
  | { type: 'blockquote'; lineIndex: number; segments: MarkdownInlineSegment[] }
  | { type: 'divider'; lineIndex: number };

export type MarkdownReaderDocument = {
  toc: MarkdownTocItem[];
  blocks: MarkdownReaderBlock[];
};

export function isMarkdownBookFormat(format: string | null | undefined) {
  const normalized = (format ?? '').trim().toLowerCase();
  return normalized === 'md' || normalized === 'markdown';
}

export function buildMarkdownReaderDocument(source: string): MarkdownReaderDocument {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const toc: MarkdownTocItem[] = [];
  const blocks: MarkdownReaderBlock[] = [];
  const usedIds = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^(\s*)```\s*([^\s`]*)?.*$/u);
    if (fence) {
      const start = index;
      const fenceIndent = fence[1] ?? '';
      const language = fence[2] ?? '';
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !/^\s*```\s*$/u.test(lines[index])) {
        codeLines.push(stripFenceIndent(lines[index], fenceIndent));
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', lineIndex: start, language, code: codeLines.join('\n') });
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      const id = createUniqueHeadingId(heading.title, usedIds);
      toc.push({ id, title: heading.title, level: heading.level, lineIndex: index });
      blocks.push({ type: 'heading', id, level: heading.level, text: heading.title, lineIndex: index, segments: parseMarkdownInline(heading.title) });
      index += 1;
      continue;
    }

    if (/^ {0,3}(([-*_])\s*){3,}$/u.test(line.trim())) {
      blocks.push({ type: 'divider', lineIndex: index });
      index += 1;
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      blocks.push(table.block);
      index = table.nextIndex;
      continue;
    }

    const list = parseList(lines, index);
    if (list) {
      blocks.push(list.block);
      index = list.nextIndex;
      continue;
    }

    if (/^ {0,3}>\s?/u.test(line)) {
      const start = index;
      const quoteLines: string[] = [];
      while (index < lines.length && /^ {0,3}>\s?/u.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^ {0,3}>\s?/u, ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', lineIndex: start, segments: parseMarkdownInline(quoteLines.join('\n')) });
      continue;
    }

    const start = index;
    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', lineIndex: start, segments: parseMarkdownInline(paragraphLines.join(' ')) });
  }

  return { toc, blocks };
}

export function parseMarkdownInline(text: string): MarkdownInlineSegment[] {
  const segments: MarkdownInlineSegment[] = [];
  let index = 0;
  while (index < text.length) {
    if (/^<img\b/iu.test(text.slice(index))) {
      const image = parseHtmlImage(text, index);
      if (image) {
        segments.push(image.segment);
        index = image.nextIndex;
        continue;
      }
    }
    if (/^<br\s*\/?>/iu.test(text.slice(index))) {
      const match = text.slice(index).match(/^<br\s*\/?>/iu);
      segments.push({ kind: 'break', text: '' });
      index += match?.[0].length ?? 4;
      continue;
    }
    if (text[index] === '`') {
      const end = text.indexOf('`', index + 1);
      if (end > index + 1) {
        segments.push({ kind: 'code', text: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }
    if (text.startsWith('**', index)) {
      const end = text.indexOf('**', index + 2);
      if (end > index + 2) {
        segments.push({ kind: 'strong', text: text.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }
    if (text[index] === '*') {
      const end = text.indexOf('*', index + 1);
      if (end > index + 1) {
        segments.push({ kind: 'emphasis', text: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }
    if (text.startsWith('![', index)) {
      const image = parseMarkdownImage(text, index);
      if (image) {
        segments.push(image.segment);
        index = image.nextIndex;
        continue;
      }
    }
    if (text[index] === '[') {
      const textEnd = findMarkdownClosingBracket(text, index);
      const hrefStart = textEnd >= 0 ? text.indexOf('(', textEnd) : -1;
      const hrefEnd = hrefStart >= 0 ? text.indexOf(')', hrefStart) : -1;
      if (textEnd > index + 1 && hrefStart === textEnd + 1 && hrefEnd > hrefStart + 1) {
        const linkText = text.slice(index + 1, textEnd);
        segments.push({ kind: 'link', text: linkText, href: text.slice(hrefStart + 1, hrefEnd), segments: parseMarkdownInline(linkText) });
        index = hrefEnd + 1;
        continue;
      }
    }
    const nextSpecial = findNextInlineSpecial(text, index + 1);
    segments.push({ kind: 'text', text: text.slice(index, nextSpecial) });
    index = nextSpecial;
  }
  return mergeAdjacentTextSegments(segments);
}

function findMarkdownClosingBracket(text: string, startIndex: number) {
  let depth = 0;
  for (let index = startIndex + 1; index < text.length; index += 1) {
    const char = text[index];
    if (char === '[') {
      depth += 1;
      continue;
    }
    if (char !== ']') continue;
    if (depth === 0) return index;
    depth -= 1;
  }
  return -1;
}

function parseMarkdownImage(text: string, startIndex: number): { segment: MarkdownInlineSegment; nextIndex: number } | null {
  const altEnd = text.indexOf(']', startIndex + 2);
  const srcStart = altEnd >= 0 ? text.indexOf('(', altEnd) : -1;
  const srcEnd = srcStart >= 0 ? text.indexOf(')', srcStart) : -1;
  if (altEnd <= startIndex + 1 || srcStart !== altEnd + 1 || srcEnd <= srcStart + 1) return null;
  const alt = text.slice(startIndex + 2, altEnd);
  const rawTarget = text.slice(srcStart + 1, srcEnd).trim();
  const targetParts = rawTarget.match(/^(\S+)(?:\s+["'](.+)["'])?$/u);
  const src = targetParts?.[1] ?? rawTarget;
  return {
    segment: { kind: 'image', text: alt, alt, src, title: targetParts?.[2] },
    nextIndex: srcEnd + 1,
  };
}

function parseHtmlImage(text: string, startIndex: number): { segment: MarkdownInlineSegment; nextIndex: number } | null {
  const match = text.slice(startIndex).match(/^<img\b([^>]*)>/iu);
  if (!match) return null;
  const attributes = parseHtmlAttributes(match[1] ?? '');
  const src = attributes.get('src')?.trim();
  if (!src) return null;
  const alt = attributes.get('alt') ?? '';
  const title = attributes.get('title');
  const width = attributes.get('width');
  const height = attributes.get('height');
  return {
    segment: { kind: 'image', text: alt, alt, src, title, width, height },
    nextIndex: startIndex + match[0].length,
  };
}

function parseHtmlAttributes(rawAttributes: string) {
  const attributes = new Map<string, string>();
  const attributePattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu;
  for (const match of rawAttributes.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    if (!['src', 'alt', 'title', 'width', 'height'].includes(name)) continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function parseHeading(line: string): { level: number; title: string } | null {
  const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u);
  if (!match) return null;
  return { level: match[1].length, title: match[2].trim() };
}

function parseList(lines: string[], startIndex: number): { block: MarkdownReaderBlock; nextIndex: number } | null {
  const first = lines[startIndex];
  const unordered = first.match(/^ {0,3}[-*+]\s+(.+)$/u);
  const ordered = first.match(/^ {0,3}\d+[.)]\s+(.+)$/u);
  if (!unordered && !ordered) return null;
  const isOrdered = Boolean(ordered);
  const items: MarkdownListItem[] = [];
  let hasTaskItem = false;
  let index = startIndex;
  while (index < lines.length) {
    const match = isOrdered ? lines[index].match(/^ {0,3}\d+[.)]\s+(.+)$/u) : lines[index].match(/^ {0,3}[-*+]\s+(.+)$/u);
    if (!match) break;
    const parsedTask = parseTaskListItem(match[1].trim());
    if (parsedTask) hasTaskItem = true;
    items.push({
      segments: parseMarkdownInline(parsedTask?.text ?? match[1].trim()),
      checked: parsedTask?.checked,
    });
    index += 1;
  }
  return { block: { type: 'list', lineIndex: startIndex, ordered: isOrdered, task: hasTaskItem, items }, nextIndex: index };
}

function parseTaskListItem(text: string): { checked: boolean; text: string } | null {
  const match = text.match(/^\[([ xX])\]\s+(.+)$/u);
  if (!match) return null;
  return { checked: match[1].toLowerCase() === 'x', text: match[2].trim() };
}

function parseTable(lines: string[], startIndex: number): { block: MarkdownReaderBlock; nextIndex: number } | null {
  if (startIndex + 1 >= lines.length) return null;
  if (!isPipeTableRow(lines[startIndex]) || !isTableDelimiterRow(lines[startIndex + 1])) return null;
  const headers = splitTableRow(lines[startIndex]).map(parseMarkdownInline);
  const alignments = splitTableRow(lines[startIndex + 1]).map(parseTableAlignment);
  if (!headers.length || headers.length !== alignments.length) return null;
  const rows: MarkdownInlineSegment[][][] = [];
  let index = startIndex + 2;
  while (index < lines.length && isPipeTableRow(lines[index]) && !isTableDelimiterRow(lines[index])) {
    rows.push(normalizeTableCells(splitTableRow(lines[index]), headers.length).map(parseMarkdownInline));
    index += 1;
  }
  return { block: { type: 'table', lineIndex: startIndex, headers, alignments, rows }, nextIndex: index };
}

function isPipeTableRow(line: string) {
  return line.includes('|') && line.trim().split('|').length >= 3;
}

function isTableDelimiterRow(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

function splitTableRow(line: string) {
  const trimmed = line.trim();
  const withoutOuterPipes = trimmed.replace(/^\|/u, '').replace(/\|$/u, '');
  return withoutOuterPipes.split(/(?<!\\)\|/u).map((cell) => cell.replace(/\\\|/gu, '|').trim());
}

function parseTableAlignment(cell: string): MarkdownTableAlignment {
  const trimmed = cell.trim();
  if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
  if (trimmed.endsWith(':')) return 'right';
  if (trimmed.startsWith(':')) return 'left';
  return 'default';
}

function normalizeTableCells(cells: string[], columnCount: number) {
  const normalized = cells.slice(0, columnCount);
  while (normalized.length < columnCount) normalized.push('');
  return normalized;
}

function isBlockStart(line: string) {
  return /^\s*```/u.test(line)
    || Boolean(parseHeading(line))
    || isPipeTableRow(line)
    || /^ {0,3}>\s?/u.test(line)
    || /^ {0,3}[-*+]\s+.+$/u.test(line)
    || /^ {0,3}\d+[.)]\s+.+$/u.test(line)
    || /^ {0,3}(([-*_])\s*){3,}$/u.test(line.trim());
}

function createUniqueHeadingId(title: string, usedIds: Map<string, number>) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\](){}"'“”‘’]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'section';
  const count = usedIds.get(base) ?? 0;
  usedIds.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function findNextInlineSpecial(text: string, start: number) {
  const candidates = ['`', '*', '![', '[', '<br', '<BR', '<img', '<IMG']
    .map((token) => text.indexOf(token, start))
    .filter((value) => value >= 0);
  return candidates.length ? Math.min(...candidates) : text.length;
}

function stripFenceIndent(line: string, fenceIndent: string) {
  if (!fenceIndent) return line;
  if (line.startsWith(fenceIndent)) return line.slice(fenceIndent.length);
  return line.replace(/^\s{1,4}/u, '');
}

function mergeAdjacentTextSegments(segments: MarkdownInlineSegment[]) {
  const merged: MarkdownInlineSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (segment.kind === 'text' && previous?.kind === 'text') {
      previous.text += segment.text;
    } else if (segment.kind !== 'text' || segment.text) {
      merged.push(segment);
    }
  }
  return merged;
}

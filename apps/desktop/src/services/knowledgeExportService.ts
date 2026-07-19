import type { KnowledgePageItem } from '../pages/knowledgePageState';

export type KnowledgeExportFormat = 'markdown' | 'json' | 'csv' | 'anki' | 'obsidian' | 'logseq' | 'readwise';

export type KnowledgeExportPayload = {
  content: string;
  extension: 'md' | 'json' | 'csv';
  mime: string;
};

export function serializeKnowledgeExport(items: KnowledgePageItem[], format: KnowledgeExportFormat, title: string): KnowledgeExportPayload {
  if (format === 'json') return payload(JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), title, items }, null, 2), 'json');
  if (format === 'csv') return payload(formatCsv([
    ['type', 'book', 'location', 'title', 'text', 'note', 'tags', 'createdAt'],
    ...items.map((item) => [item.kind, item.bookTitle || '', item.meta, item.title, item.body, item.note || '', (item.tags ?? []).join(' '), item.createdAt]),
  ]), 'csv');
  if (format === 'anki') return payload(formatCsv([
    ['Front', 'Back', 'Tags'],
    ...items.map((item) => [item.kind === 'flashcards' ? item.title : item.body || item.title, item.kind === 'flashcards' ? item.body : [item.note, item.bookTitle, item.meta].filter(Boolean).join('\n'), (item.tags ?? []).join(' ')]),
  ]), 'csv');
  if (format === 'readwise') return payload(formatCsv([
    ['Title', 'Author', 'Highlight', 'Note', 'Location', 'Tags'],
    ...items.map((item) => [item.bookTitle || title, '', item.body || item.title, item.note || '', item.meta, (item.tags ?? []).join(',')]),
  ]), 'csv');
  if (format === 'logseq') return payload(`# ${title}\n\n${items.map((item) => `- ${item.body || item.title}\n  - type:: ${item.kind}\n  - book:: ${item.bookTitle || ''}\n  - location:: ${item.meta}${item.note ? `\n  - note:: ${item.note}` : ''}${item.tags?.length ? `\n  - tags:: ${item.tags.join(', ')}` : ''}`).join('\n')}`, 'md');
  if (format === 'obsidian') return payload(`---\ntitle: ${yamlValue(title)}\nexported: ${new Date().toISOString()}\nitems: ${items.length}\n---\n\n# ${title}\n\n${items.map((item) => `## ${item.title}\n\n${item.bookTitle ? `Source: [[${item.bookTitle.replaceAll(']', '\\]')}]] · ${item.meta}\n\n` : ''}> ${normalizeQuote(item.body || item.title)}${item.note ? `\n\n**Note:** ${item.note}` : ''}${item.tags?.length ? `\n\n${item.tags.map((tag) => `#${tag.replace(/\s+/g, '-')}`).join(' ')}` : ''}`).join('\n\n---\n\n')}`, 'md');
  return payload(`# ${title}\n\n${groupByBook(items).map(([book, bookItems]) => `## ${book}\n\n${bookItems.map((item) => `### ${item.title}\n\n> ${normalizeQuote(item.body || item.title)}\n\n- Type: ${item.kind}\n- Location: ${item.meta}\n- Created: ${item.createdAt}${item.note ? `\n\n**Annotation**\n\n${item.note}` : ''}${item.tags?.length ? `\n\nTags: ${item.tags.map((tag) => `#${tag}`).join(' ')}` : ''}`).join('\n\n')}`).join('\n\n---\n\n')}`, 'md');
}

function payload(content: string, extension: KnowledgeExportPayload['extension']): KnowledgeExportPayload {
  return { content, extension, mime: extension === 'json' ? 'application/json;charset=utf-8' : extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/csv;charset=utf-8' };
}

function formatCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

function csvCell(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function groupByBook(items: KnowledgePageItem[]) {
  const groups = new Map<string, KnowledgePageItem[]>();
  items.forEach((item) => {
    const key = item.bookTitle || 'Unassigned';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.entries()];
}

function normalizeQuote(value: string) {
  return value.replace(/\r?\n/g, '\n> ');
}

function yamlValue(value: string) {
  return JSON.stringify(value);
}

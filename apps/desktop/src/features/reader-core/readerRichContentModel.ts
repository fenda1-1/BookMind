export type ReaderRichContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'noteRef'; id: string; label: string }
  | { type: 'noteTarget'; id: string };

const epubImageMarkerRe = /\[\[BOOKMIND_EPUB_IMAGE:([^\]\n]+)\]\]/g;
const epubRichMarkerRe = /\[\[BOOKMIND_EPUB_(IMAGE|NOTE_REF|NOTE_TARGET):([^\]\n]+)\]\]/g;

export function parseReaderRichContentParagraph(paragraph: string): ReaderRichContentPart[] {
  const parts: ReaderRichContentPart[] = [];
  let cursor = 0;
  for (const match of paragraph.matchAll(epubRichMarkerRe)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: 'text', text: normalizeReaderRichTextPart(paragraph.slice(cursor, index), parts.at(-1)?.type) });
    const kind = match[1] ?? '';
    const payload = (match[2] ?? '').trim();
    if (kind === 'IMAGE') {
      if (payload) parts.push({ type: 'image', src: payload, alt: getReaderImageAlt(payload) });
    } else if (kind === 'NOTE_REF') {
      const [rawId, ...labelParts] = payload.split('|');
      const id = (rawId ?? '').trim();
      const label = labelParts.join('|').trim() || '注';
      if (id) parts.push({ type: 'noteRef', id, label });
    } else if (kind === 'NOTE_TARGET') {
      const id = payload.trim();
      if (id) parts.push({ type: 'noteTarget', id });
    }
    cursor = index + match[0].length;
  }
  if (cursor < paragraph.length) parts.push({ type: 'text', text: normalizeReaderRichTextPart(paragraph.slice(cursor), parts.at(-1)?.type) });
  return parts.length ? parts : [{ type: 'text', text: paragraph }];
}

export function isReaderImageOnlyParagraph(paragraph: string) {
  const parts = parseReaderRichContentParagraph(paragraph.trim());
  return parts.length === 1 && parts[0]?.type === 'image';
}

export function buildReaderEpubNoteLabelMap(paragraphs: string[]) {
  const labels = new Map<string, string>();
  let nextNumber = 1;
  paragraphs.forEach((paragraph) => {
    parseReaderRichContentParagraph(paragraph).forEach((part) => {
      if (part.type !== 'noteRef' || labels.has(part.id)) return;
      labels.set(part.id, formatReaderEpubNoteLabel(part.label, nextNumber));
      nextNumber += 1;
    });
  });
  paragraphs.forEach((paragraph) => {
    parseReaderRichContentParagraph(paragraph).forEach((part) => {
      if (part.type !== 'noteTarget' || labels.has(part.id)) return;
      labels.set(part.id, `注${nextNumber}`);
      nextNumber += 1;
    });
  });
  return labels;
}

function getReaderImageAlt(src: string) {
  const fileName = src.split(/[\\/]/).pop()?.split('?')[0] ?? '';
  return decodeURIComponent(fileName || 'EPUB image');
}

function formatReaderEpubNoteLabel(label: string, noteNumber: number) {
  const trimmed = label.trim();
  if (!trimmed || /^注\d*$/u.test(trimmed)) return `注${noteNumber}`;
  return trimmed;
}

function normalizeReaderRichTextPart(text: string, previousType: ReaderRichContentPart['type'] | undefined) {
  if (previousType !== 'noteTarget') return text;
  return text.replace(/^\s*(?:注[:：、.\s]*)?/, '');
}

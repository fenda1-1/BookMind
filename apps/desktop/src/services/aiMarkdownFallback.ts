import type { AiProtocolCitation, AiResponseBlock, BookMindAiStructuredResponse } from './aiResponseProtocol.js';

const citationSectionPattern = /^(可回跳依据|引用来源|证据摘要|证据|引用)[:：]?\s*(.*)$/i;
const flashcardFieldPattern = /^[-*]?\s*`?(Q|A|标签|引用来源)`?\s*[:：]\s*(.*)$/i;

type PendingCitation = AiProtocolCitation & {
  status: 'pending_binding';
  sourceText: string;
};

export function parseAiMarkdownFallback(rawMarkdown: string, options: { parseError?: string } = {}): BookMindAiStructuredResponse {
  const rawText = rawMarkdown.trim();
  const citations: PendingCitation[] = [];
  const blocks: AiResponseBlock[] = [];
  const lines = rawText.split(/\r?\n/);
  let index = 0;
  let blockCounter = 1;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const flashcard = collectFlashcard(lines, index, citations, () => `c_pending_${citations.length + 1}`);
    if (flashcard) {
      blocks.push({
        id: `blk_md_${blockCounter++}`,
        type: 'flashcards',
        title: '闪卡',
        cards: [flashcard.card],
        citationIds: flashcard.card.citationIds,
      });
      index = flashcard.nextIndex;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ id: `blk_md_${blockCounter++}`, type: 'heading', level: heading[1].length, content: cleanInlineMarkdown(heading[2]), citationIds: [] });
      index += 1;
      continue;
    }

    const citationSection = trimmed.match(citationSectionPattern);
    if (citationSection) {
      const collected = collectIndentedOrFollowingText(lines, index, citationSection[2]);
      const citationId = addPendingCitation(citations, collected.text || citationSection[1], () => `c_pending_${citations.length + 1}`);
      blocks.push({
        id: `blk_md_${blockCounter++}`,
        type: 'citation_group',
        title: citationSection[1],
        status: 'pending_binding',
        candidates: [citations.find((citation) => citation.id === citationId)],
        citationIds: [citationId],
      });
      index = collected.nextIndex;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      const quote = quoteLines.join('\n').trim();
      const citationId = citationSectionPattern.test(quote) ? addPendingCitation(citations, quote.replace(citationSectionPattern, '$2').trim() || quote, () => `c_pending_${citations.length + 1}`) : undefined;
      blocks.push({ id: `blk_md_${blockCounter++}`, type: citationId ? 'citation_group' : 'quote', content: cleanInlineMarkdown(quote), status: citationId ? 'pending_binding' : undefined, citationIds: citationId ? [citationId] : [] });
      continue;
    }

    if (/^([-*+] |\d+[.)]\s+)/.test(trimmed)) {
      const items: Array<{ text: string; citationIds: string[] }> = [];
      while (index < lines.length && /^([-*+] |\d+[.)]\s+)/.test(lines[index].trim())) {
        const itemText = lines[index].trim().replace(/^([-*+] |\d+[.)]\s+)/, '').trim();
        const citationMatch = itemText.match(citationSectionPattern);
        const citationIds = citationMatch ? [addPendingCitation(citations, citationMatch[2] || itemText, () => `c_pending_${citations.length + 1}`)] : [];
        items.push({ text: cleanInlineMarkdown(itemText), citationIds });
        index += 1;
      }
      blocks.push({ id: `blk_md_${blockCounter++}`, type: 'bullet_list', items, citationIds: items.flatMap((item) => item.citationIds) });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current) break;
      if (index !== lines.indexOf(line) && (/^(#{1,6})\s+/.test(current) || /^([-*+] |\d+[.)]\s+)/.test(current) || /^>\s?/.test(current) || citationSectionPattern.test(current) || flashcardFieldPattern.test(current))) break;
      paragraphLines.push(current);
      index += 1;
    }
    const content = paragraphLines.join('\n').trim();
    if (content) blocks.push({ id: `blk_md_${blockCounter++}`, type: 'paragraph', content: cleanInlineMarkdown(content), citationIds: [] });
  }

  return {
    schema: 'bookmind.ai.response.v2',
    mode: 'mock',
    title: inferTitle(blocks) ?? 'Markdown 兜底回答',
    summary: inferSummary(blocks),
    blocks: blocks.length ? blocks : [{ id: 'blk_md_fallback_1', type: 'paragraph', content: cleanInlineMarkdown(rawText), citationIds: [] }],
    citations,
    toolCalls: [],
    toolResults: [],
    actions: [],
    diagnostics: {
      renderer: 'markdown-fallback',
      rawMarkdownRetained: true,
      ...(options.parseError ? { parseError: options.parseError } : {}),
    },
    rawText,
    parseError: options.parseError,
  };
}

function collectFlashcard(lines: string[], startIndex: number, citations: PendingCitation[], nextCitationId: () => string) {
  const fields: Record<string, string> = {};
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    const match = trimmed.match(flashcardFieldPattern);
    if (!match) break;
    fields[match[1]] = match[2].trim();
    index += 1;
  }
  if (!fields.Q || !fields.A) return null;
  const citationIds = fields.引用来源 ? [addPendingCitation(citations, fields.引用来源, nextCitationId)] : [];
  return {
    nextIndex: index,
    card: {
      id: `md_card_${startIndex + 1}`,
      front: cleanInlineMarkdown(fields.Q),
      back: cleanInlineMarkdown(fields.A),
      tags: splitTags(fields.标签),
      citationSource: fields.引用来源,
      citationIds,
    },
  };
}

function collectIndentedOrFollowingText(lines: string[], startIndex: number, firstText: string) {
  const text: string[] = [];
  if (firstText.trim()) text.push(firstText.trim());
  let index = startIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) break;
    if (!/^\s+/.test(line) && /^(#{1,6})\s+|^([-*+] |\d+[.)]\s+)/.test(line.trim())) break;
    text.push(line.trim().replace(/^[-*+]\s+/, ''));
    index += 1;
  }
  return { text: text.join('\n').trim(), nextIndex: index };
}

function addPendingCitation(citations: PendingCitation[], sourceText: string, nextCitationId: () => string) {
  const existing = citations.find((citation) => citation.sourceText === sourceText);
  if (existing) return existing.id;
  const id = nextCitationId();
  citations.push({
    id,
    type: 'pending',
    label: '待绑定引用',
    quote: sourceText,
    snippet: sourceText,
    sourceText,
    status: 'pending_binding',
    confidence: 0,
  });
  return id;
}

function splitTags(value?: string) {
  if (!value) return [];
  return value.split(/[\/、,，|]/).map((tag) => cleanInlineMarkdown(tag).trim()).filter(Boolean);
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function inferTitle(blocks: AiResponseBlock[]) {
  const heading = blocks.find((block) => block.type === 'heading' && typeof block.content === 'string');
  return typeof heading?.content === 'string' ? heading.content : undefined;
}

function inferSummary(blocks: AiResponseBlock[]) {
  const paragraph = blocks.find((block) => block.type === 'paragraph' && typeof block.content === 'string');
  if (typeof paragraph?.content !== 'string') return undefined;
  return paragraph.content.slice(0, 120);
}

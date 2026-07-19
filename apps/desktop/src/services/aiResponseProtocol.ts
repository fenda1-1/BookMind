import { parseAiMarkdownFallback } from './aiMarkdownFallback.js';

export const BOOKMIND_AI_RESPONSE_SCHEMA_V2 = 'bookmind.ai.response.v2';
export const BOOKMIND_AI_RESPONSE_SCHEMA_V1 = 'bookmind.ai.response.v1';

export type BookMindAiStructuredResponse = {
  schema: string;
  responseId?: string;
  mode?: 'local' | 'cloud' | 'mock';
  title?: string;
  summary?: string;
  blocks: AiResponseBlock[];
  citations: AiProtocolCitation[];
  toolCalls: AiToolCall[];
  toolResults: AiToolResult[];
  actions: AiProtocolAction[];
  diagnostics: Record<string, unknown>;
  rawText?: string;
  parseError?: string;
};

export type AiResponseBlock = {
  id: string;
  type: string;
  title?: string;
  content?: string;
  citationIds?: string[];
  [key: string]: unknown;
};

export type AiProtocolCitation = {
  id: string;
  type?: string;
  label?: string;
  quote?: string;
  bookId?: string;
  chapterId?: string;
  chapterIndex?: number;
  sourceChapterIndex?: number;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
  snippet?: string;
  sourceText?: string;
  confidence?: number;
  score?: number;
  chunkId?: string;
  toolResultId?: string;
  before?: string;
  after?: string;
  [key: string]: unknown;
};

type AnalysisCharacter = {
  name: string;
  evidence: string;
  evidenceItems: string[];
};

export type AiToolCall = {
  id: string;
  tool: string;
  status: string;
  args?: Record<string, unknown>;
  reason?: string;
};

export type AiToolResult = {
  id: string;
  toolCallId?: string;
  tool: string;
  status: string;
  durationMs?: number;
  summary?: string;
  contentType?: string;
  content?: unknown;
  diagnostics?: Record<string, unknown>;
  collapsed: boolean;
};

export type AiProtocolAction = {
  label?: string;
  action?: string;
  priority?: string;
  [key: string]: unknown;
};

export function parseAiResponseProtocol(raw: string): BookMindAiStructuredResponse {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    ...repairNearlyCompleteJsonCandidates(trimmed),
    ...extractJsonFenceBodies(trimmed).flatMap((body) => [body, ...repairNearlyCompleteJsonCandidates(body)]),
    ...extractJsonObjectCandidates(trimmed),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      for (const envelope of collectStructuredResponseEnvelopes(parsed)) {
        const unwrapped = unwrapStructuredResponseEnvelope(envelope);
        if (!isSupportedAiResponseSchema(unwrapped.schema)) continue;
        return normalizeStructuredResponse(unwrapped);
      }
    } catch {
      // Try the next candidate.
    }
  }
  return fallbackResponse(raw, 'invalid-json');
}

export function renderBlockPlainText(block: AiResponseBlock) {
  if (typeof block.content === 'string') return block.content;
  if ((block.type === 'chapter_summary' || block.type === 'summary') && Array.isArray(block.bullets)) {
    return block.bullets
      .map((item) => {
        const record = asRecord(item);
        return record && 'text' in record ? `- ${formatLooseText(record.text)}` : `- ${formatLooseText(item)}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  if (block.type === 'character_table' && Array.isArray(block.rows)) {
    const rows = block.rows
      .map((item) => {
        const record = asRecord(item);
        if (!record) return formatLooseText(item);
        const character = formatLooseText(record.character ?? record.name ?? record.from ?? '角色');
        const statusChange = formatLooseText(record.statusChange ?? record.statuschange ?? record.changeSummary ?? record.status ?? record.role ?? '');
        return statusChange ? `- ${character}: ${statusChange}` : `- ${character}`;
      })
      .filter(Boolean)
      .join('\n');
    const characterRows = Array.isArray(block.characters) ? block.characters.map((item) => {
      const record = asRecord(item);
      const name = formatLooseText(record?.name ?? record?.character ?? item);
      const role = formatLooseText(record?.role ?? record?.status);
      return role ? `- ${name}: ${role}` : `- ${name}`;
    }).filter(Boolean) : [];
    const relationshipRows = Array.isArray(block.relationships) ? block.relationships.map((item) => {
      const record = asRecord(item);
      return `- ${formatLooseText(record?.from ?? '?')} -> ${formatLooseText(record?.to ?? '?')}: ${formatLooseText(record?.label ?? record?.relation ?? '')}`;
    }).filter(Boolean) : [];
    const factionRows = Array.isArray(block.factions) ? block.factions.map((item) => {
      const record = asRecord(item);
      return `- ${formatLooseText(record?.character ?? '')} · ${formatLooseText(record?.name ?? '')}: ${formatLooseText(record?.status ?? '')}`;
    }).filter(Boolean) : [];
    return [rows, ...characterRows, ...relationshipRows, ...factionRows].filter(Boolean).join('\n');
  }
  if (block.type === 'timeline' && Array.isArray(block.events)) {
    return block.events
      .map((item) => typeof item === 'object' && item && 'event' in item ? `- ${String((item as { event: unknown }).event)}` : '')
      .filter(Boolean)
      .join('\n');
  }
  return formatLooseBlockRecord(block) ?? block.title ?? block.type;
}

function normalizeStructuredResponse(parsed: Partial<BookMindAiStructuredResponse>): BookMindAiStructuredResponse {
  const adapted = adaptLooseV2Response(parsed);
  const schema = parsed.schema === BOOKMIND_AI_RESPONSE_SCHEMA_V1 ? BOOKMIND_AI_RESPONSE_SCHEMA_V1 : BOOKMIND_AI_RESPONSE_SCHEMA_V2;
  const parsedBlocks = Array.isArray(adapted.blocks)
    ? adapted.blocks.flatMap((block, index) => {
        const normalized = normalizeBlockCandidate(block, index);
        return normalized ? [normalized] : [];
      })
    : [];
  const normalizedBlocks = parsedBlocks.length ? parsedBlocks : createTopLevelTextFallback(adapted);
  const toolCallBlocks = normalizedBlocks.filter((block) => block.type === 'tool_call');
  const toolResultBlocks = normalizedBlocks.filter((block) => block.type === 'tool_result');
  return {
    schema,
    responseId: adapted.responseId,
    mode: adapted.mode,
    title: adapted.title,
    summary: typeof adapted.summary === 'string' ? adapted.summary : undefined,
    blocks: normalizedBlocks,
    citations: Array.isArray(adapted.citations) ? adapted.citations.filter(isCitation).map(normalizeCitation) : [],
    toolCalls: [
      ...(Array.isArray(adapted.toolCalls) ? adapted.toolCalls.filter(isToolCall) : []),
      ...toolCallBlocks.map(blockToToolCall),
    ],
    toolResults: [
      ...(Array.isArray(adapted.toolResults) ? adapted.toolResults.filter(isToolResult).map((result) => ({ ...result, collapsed: true })) : []),
      ...toolResultBlocks.map(blockToToolResult),
    ],
    actions: Array.isArray(adapted.actions) ? adapted.actions : [],
    diagnostics: adapted.diagnostics && typeof adapted.diagnostics === 'object' ? adapted.diagnostics : {},
  };
}

function normalizeBlockCandidate(value: unknown, index: number): AiResponseBlock | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const content = formatLooseText(value).trim();
    return content ? normalizeBlock({ id: `blk_paragraph_${index + 1}`, type: 'paragraph', content }) : null;
  }
  const item = asRecord(value);
  if (!item) return null;
  const aliasedContent = resolveBlockContent(item);
  const rawType = typeof item.type === 'string' && item.type.trim() ? item.type : 'paragraph';
  const inferredContent = aliasedContent ?? (typeof item.type !== 'string' ? formatLooseBlockRecord(item) : undefined);
  if (!inferredContent && (typeof item.type !== 'string' || !item.type.trim())) return null;
  return normalizeBlock({
    ...item,
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `blk_${normalizeBlockType(rawType)}_${index + 1}`,
    type: rawType,
    ...(inferredContent !== undefined ? { content: inferredContent } : {}),
  } as AiResponseBlock);
}

function normalizeBlock(block: AiResponseBlock): AiResponseBlock {
  const content = resolveBlockContent(block);
  return {
    ...block,
    id: String(block.id),
    type: normalizeBlockType(String(block.type)),
    ...(content !== undefined ? { content } : {}),
    citationIds: Array.isArray(block.citationIds) ? block.citationIds.map(String) : [],
  };
}

function createTopLevelTextFallback(response: Partial<BookMindAiStructuredResponse>): AiResponseBlock[] {
  const record = asRecord(response);
  if (!record) return [];
  const content = resolveBlockContent(record)
    ?? (typeof response.summary === 'string' && response.summary.trim() ? response.summary.trim() : undefined);
  return content ? [normalizeBlock({ id: 'blk_paragraph_1', type: 'paragraph', content })] : [];
}

function resolveBlockContent(value: Record<string, unknown>): string | undefined {
  for (const key of ['content', 'text', 'body', 'message', 'answer', 'value', 'markdown', 'description']) {
    if (value[key] === undefined || value[key] === null) continue;
    const content = formatLooseText(value[key]).trim();
    if (content) return content;
  }
  return undefined;
}

function formatLooseBlockRecord(value: Record<string, unknown>) {
  const visibleEntries = Object.entries(value).filter(([key]) => !['id', 'type', 'title', 'citationIds'].includes(key));
  return formatLooseText(Object.fromEntries(visibleEntries)).trim() || undefined;
}

function fallbackResponse(rawText: string, parseError: string): BookMindAiStructuredResponse {
  return parseAiMarkdownFallback(rawText, { parseError });
}

function extractJsonFenceBodies(raw: string) {
  return [...raw.matchAll(/```\s*(?:json|JSON)?\s*([\s\S]*?)```/g)]
    .map((match) => match[1].trim())
    .filter((body) => body.startsWith('{') || body.startsWith('['));
}

function repairNearlyCompleteJsonCandidates(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !looksLikeBookMindJsonText(trimmed)) return [];
  if (canParseJson(trimmed)) return [];
  const closers = inferMissingJsonClosers(trimmed);
  const directCandidates = closers ? [trimmed + closers, ...swapTrailingJsonClosers(trimmed, closers)] : [];
  const repairedInsertionCandidates = buildSingleCloserInsertionCandidates(trimmed);
  return [...directCandidates, ...repairedInsertionCandidates].filter((candidate, index, values) => values.indexOf(candidate) === index);
}

function looksLikeBookMindJsonText(value: string) {
  return value.includes(BOOKMIND_AI_RESPONSE_SCHEMA_V2) || value.includes(BOOKMIND_AI_RESPONSE_SCHEMA_V1) || value.includes('"version"') || value.includes('"characters"') || value.includes('"flashcards"');
}

function canParseJson(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function inferMissingJsonClosers(raw: string) {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const char of raw) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === '}' || char === ']') {
      if (!stack.length) return '';
      const expected = stack[stack.length - 1];
      if (char === expected) {
        stack.pop();
      } else {
        return '';
      }
    }
  }
  if (inString || !stack.length || stack.length > 4) return '';
  return stack.reverse().join('');
}

function swapTrailingJsonClosers(raw: string, inferredClosers: string) {
  const candidates: string[] = [];
  const trailingClosersMatch = raw.match(/[}\]]+$/);
  if (!trailingClosersMatch) return candidates;
  const trailingClosers = trailingClosersMatch[0];
  for (let count = 1; count <= Math.min(2, trailingClosers.length); count += 1) {
    candidates.push(`${raw.slice(0, -count)}${inferredClosers}${trailingClosers.slice(trailingClosers.length - count)}`);
  }
  return candidates;
}

function buildSingleCloserInsertionCandidates(raw: string) {
  const candidates: string[] = [];
  const trailingClosersMatch = raw.match(/[}\]]+$/);
  const trailingStart = trailingClosersMatch ? raw.length - trailingClosersMatch[0].length : raw.length;
  const insertionPositions = new Set<number>([raw.length]);
  for (let index = trailingStart; index <= raw.length; index += 1) insertionPositions.add(index);
  for (const position of insertionPositions) {
    for (const closer of [']', '}']) {
      const inserted = `${raw.slice(0, position)}${closer}${raw.slice(position)}`;
      if (canParseJson(inserted)) {
        candidates.push(inserted);
        continue;
      }
      const missingClosers = inferMissingJsonClosers(inserted);
      if (!missingClosers) continue;
      const completed = inserted + missingClosers;
      if (canParseJson(completed)) candidates.push(completed);
    }
  }
  return candidates;
}

function extractJsonObjectCandidates(raw: string) {
  const candidates: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== '{') continue;
    const candidate = readBalancedJsonObject(raw, index);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function readBalancedJsonObject(raw: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(startIndex, index + 1);
    }
  }
  return '';
}

function isSupportedAiResponseSchema(schema: unknown) {
  return schema === BOOKMIND_AI_RESPONSE_SCHEMA_V2 || schema === BOOKMIND_AI_RESPONSE_SCHEMA_V1;
}

function collectStructuredResponseEnvelopes(value: unknown, depth = 0): unknown[] {
  if (depth > 4 || !value || typeof value !== 'object' || Array.isArray(value)) return [];
  const object = value as Record<string, unknown>;
  const values: unknown[] = [value];
  for (const key of [BOOKMIND_AI_RESPONSE_SCHEMA_V2, BOOKMIND_AI_RESPONSE_SCHEMA_V1, 'response', 'raw', 'answer', 'content', 'data', 'next']) {
    const nested = object[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      values.push(...collectStructuredResponseEnvelopes(nested, depth + 1));
    } else if (typeof nested === 'string') {
      try {
        const parsed = JSON.parse(nested);
        values.push(...collectStructuredResponseEnvelopes(parsed, depth + 1));
      } catch {
        // Ignore non-JSON wrapper fields.
      }
    }
  }
  return values;
}

function unwrapStructuredResponseEnvelope(value: unknown): Partial<BookMindAiStructuredResponse> {
  const object = value as Record<string, unknown> | null;
  if (!object || typeof object !== 'object') return {};
  const nested = object[BOOKMIND_AI_RESPONSE_SCHEMA_V2] ?? object[BOOKMIND_AI_RESPONSE_SCHEMA_V1];
  if (nested && typeof nested === 'object') {
    return { ...(nested as Partial<BookMindAiStructuredResponse>), schema: object[BOOKMIND_AI_RESPONSE_SCHEMA_V2] ? BOOKMIND_AI_RESPONSE_SCHEMA_V2 : BOOKMIND_AI_RESPONSE_SCHEMA_V1 };
  }
  const version = object.version;
  if (!object.schema && isSupportedAiResponseSchema(version)) {
    return { ...(object as Partial<BookMindAiStructuredResponse>), schema: String(version) };
  }
  const type = object.type;
  if (!object.schema && isSupportedAiResponseSchema(type)) {
    return { ...(object as Partial<BookMindAiStructuredResponse>), schema: String(type) };
  }
  if (!object.schema && looksLikeSchemaLessBookMindResponse(object)) {
    return { ...(object as Partial<BookMindAiStructuredResponse>), schema: BOOKMIND_AI_RESPONSE_SCHEMA_V2 };
  }
  return object as Partial<BookMindAiStructuredResponse>;
}

function looksLikeSchemaLessBookMindResponse(value: Record<string, unknown>) {
  return [
    'major_events',
    'information_increment',
    'character_state_changes',
    '主要事件',
    '信息增量',
    '角色状态变化',
    'evidence',
    'characters',
    'relationships',
    'faction_changes',
    'key_interactions',
    'potential_conflicts',
    'flashcards',
    'timeline',
    'events',
    'foreshadowing',
    'possible_issues',
    'possibleIssues',
  ].some((key) => Array.isArray(value[key]));
}

function adaptLooseV2Response(parsed: Partial<BookMindAiStructuredResponse>): Partial<BookMindAiStructuredResponse> {
  if (parsed.schema !== BOOKMIND_AI_RESPONSE_SCHEMA_V2 || Array.isArray(parsed.blocks)) return parsed;
  const parsedRecord = parsed as Partial<BookMindAiStructuredResponse> & Record<string, unknown>;
  const nestedResponse = asRecord(parsedRecord.response);
  const looseSource = nestedResponse ? { ...parsedRecord, ...nestedResponse } : parsedRecord;
  const loose = looseSource as Partial<BookMindAiStructuredResponse> & {
    scope?: string;
    scope_label?: string;
    scopeLabel?: string;
    chapterscope?: string;
    chapterScope?: string;
    chaptertitle?: string;
    chapterTitle?: string;
    summary?: unknown;
    evidence?: unknown;
    references?: unknown;
    major_events?: unknown;
    information_increment?: unknown;
    character_state_changes?: unknown;
    characters?: unknown;
    relationships?: unknown;
    faction_changes?: unknown;
    key_interactions?: unknown;
    potential_conflicts?: unknown;
    flashcards?: unknown;
    timeline?: unknown;
    events?: unknown;
    foreshadowing?: unknown;
    possible_issues?: unknown;
    possibleIssues?: unknown;
    overall_verdict?: unknown;
    overallVerdict?: unknown;
    analysis?: unknown;
  };
  const analysis = asRecord(loose.analysis);
  const analysisCharacters = normalizeAnalysisCharacters(
    analysis?.characters_identified
      ?? analysis?.charactersIdentified
      ?? analysis?.characters_extracted
      ?? analysis?.charactersExtracted,
  );
  const looseSummary = loose.summary ?? buildSummaryFromSchemaLessFields(loose);
  const summaryObject = asRecord(looseSummary);
  const evidenceReferences = normalizeLooseEvidenceReferences(loose.evidence);
  const flashcardReferences = normalizeLooseFlashcardReferences(loose.flashcards);
  const issueReferences = normalizeLooseIssueReferences(loose.possible_issues ?? loose.possibleIssues);
  const references = normalizeLooseReferences(loose.references ?? summaryObject?.references);
  const analysisReferences = normalizeAnalysisCharacterReferences(analysisCharacters);
  const citations = [...references, ...evidenceReferences, ...flashcardReferences, ...issueReferences, ...analysisReferences].map((reference) => normalizeCitation(reference));
  const blocks = normalizeLooseSummaryBlocks(looseSummary, citations);
  const evidenceBlocks = normalizeLooseEvidenceBlocks(loose.evidence);
  const commandBlocks = [
    ...normalizeAnalysisCharacterBlocks(analysisCharacters, analysisReferences),
    ...normalizeLooseCharacterBlocks(loose),
    ...normalizeLooseTimelineBlocks(mergeLooseArrays(loose.key_interactions, loose.timeline, loose.events, collectNestedCharacterItems(loose.characters, 'key_interactions'))),
    ...normalizeLooseForeshadowingBlocks(mergeLooseArrays(loose.potential_conflicts, loose.foreshadowing, collectNestedCharacterItems(loose.characters, 'potential_conflicts'))),
    ...normalizeLooseIssueBlocks(loose.possible_issues ?? loose.possibleIssues),
    ...normalizeLooseVerdictBlocks(loose.overall_verdict ?? loose.overallVerdict),
    ...normalizeLooseFlashcardBlocks(loose.flashcards),
  ];
  return {
    ...parsed,
    title: parsed.title ?? loose.chaptertitle ?? loose.chapterTitle ?? loose.chapterscope ?? loose.chapterScope ?? loose.scope_label ?? loose.scope ?? formatLooseText(analysis?.chapter),
    summary: inferLooseSummaryText(looseSummary),
    blocks: [...blocks, ...evidenceBlocks, ...commandBlocks],
    citations,
    toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls : [],
    toolResults: Array.isArray(parsed.toolResults) ? parsed.toolResults : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    diagnostics: parsed.diagnostics && typeof parsed.diagnostics === 'object' ? parsed.diagnostics : { adaptedFromLooseV2: true, scope: loose.scope },
  };
}

function normalizeAnalysisCharacters(value: unknown): AnalysisCharacter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawCharacter, index) => {
    const character = asRecord(rawCharacter);
    const name = formatLooseText(character?.name ?? character?.character ?? `角色 ${index + 1}`);
    const rawEvidence = character?.evidence ?? character?.quote ?? character?.sourceText;
    const evidenceItems = Array.isArray(rawEvidence)
      ? rawEvidence.map((item) => formatLooseText(item)).filter(Boolean)
      : [formatLooseText(rawEvidence)].filter(Boolean);
    const evidence = evidenceItems.join('；');
    if (!name && !evidence) return [];
    return [{ name: name || `角色 ${index + 1}`, evidence, evidenceItems }];
  });
}

function normalizeAnalysisCharacterReferences(characters: AnalysisCharacter[]): AiProtocolCitation[] {
  return characters.flatMap((character, index) => {
    const evidenceItems = character.evidenceItems.length ? character.evidenceItems : [character.evidence].filter(Boolean);
    const validEvidenceItems = evidenceItems.filter((item) => item.trim());
    if (!validEvidenceItems.length) return [];
    return validEvidenceItems.map((evidence, evidenceIndex) => {
      const id = validEvidenceItems.length === 1
        ? `analysis_char_${index + 1}`
        : `analysis_char_${index + 1}_${evidenceIndex + 1}`;
      const sourceText = extractReaderSearchableQuote(evidence);
      return {
      id,
      type: 'paragraph',
      label: character.name,
      quote: evidence,
      snippet: evidence,
      sourceText,
      confidence: 0,
      };
    });
  });
}

function extractReaderSearchableQuote(value: string) {
  const text = value.trim();
  const quoted = text.match(/[“"]([^”"]+)[”"]/);
  const candidate = (quoted?.[1] ?? text)
    .replace(/\.{2,}|…+/g, '')
    .trim();
  return candidate || text;
}

function normalizeAnalysisCharacterBlocks(characters: AnalysisCharacter[], citations: AiProtocolCitation[]): AiResponseBlock[] {
  if (!characters.length) return [];
  const citationIdsForIndex = (index: number) => {
    const baseId = `analysis_char_${index + 1}`;
    return citations
      .filter((citation) => citation.id === baseId || citation.id.startsWith(`${baseId}_`))
      .map((citation) => citation.id);
  };
  return [{
    id: 'blk_analysis_characters_identified',
    type: 'character_table',
    title: '识别到的人物',
    source: 'loose_command',
    characters: characters.map((character, index) => ({
      id: `analysis_char_${index + 1}`,
      name: character.name,
      role: '',
      evidence: character.evidence,
      citationIds: citationIdsForIndex(index),
    })),
    rows: characters.map((character, index) => ({
      character: character.name,
      statusChange: character.evidence,
      evidence: character.evidence,
      citationIds: citationIdsForIndex(index),
    })),
    relationships: [],
    factions: [],
    citationIds: citations.map((citation) => citation.id),
  }];
}

function normalizeLooseFlashcardReferences(value: unknown): AiProtocolCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawCard, index) => {
    const card = asRecord(rawCard);
    const quote = formatLooseText(card?.citation ?? card?.quote ?? card?.source ?? card?.citationSource);
    if (!quote) return [];
    return [{
      id: String(card?.citationId ?? `fc${index + 1}`),
      type: 'pending',
      label: `闪卡引用 ${index + 1}`,
      quote,
      snippet: quote,
      sourceText: quote,
      status: 'pending_binding',
      confidence: 0,
    }];
  });
}

function normalizeLooseCharacterBlocks(loose: {
  characters?: unknown;
  relationships?: unknown;
  faction_changes?: unknown;
}): AiResponseBlock[] {
  const characters = Array.isArray(loose.characters) ? loose.characters.map((rawCharacter, index) => {
    const character = asRecord(rawCharacter);
    return {
      id: String(character?.id ?? character?.name ?? `char_${index + 1}`),
      name: formatLooseText(character?.name ?? `角色 ${index + 1}`),
      role: formatLooseText(character?.faction ?? character?.role ?? ''),
      evidence: formatLooseText(character?.faction_evidence ?? character?.evidence ?? ''),
      relations: character?.relations,
      factions: character?.factions,
    };
  }) : [];
  const relationRows = [
    ...normalizeLooseRelationsFromCharacters(loose.characters),
    ...normalizeLooseRelationshipRows(loose.relationships),
  ];
  const statusRows = Array.isArray(loose.faction_changes) ? loose.faction_changes.map((rawChange, index) => {
    const change = asRecord(rawChange);
    return {
      character: formatLooseText(change?.entity ?? `阵营变化 ${index + 1}`),
      statusChange: [change?.from, change?.to].filter(Boolean).map(formatLooseText).join(' -> ') || formatLooseText(change),
      evidence: formatLooseText(change?.evidence),
      citationIds: [],
    };
  }) : [];
  if (!characters.length && !relationRows.length && !statusRows.length) return [];
  return [{
    id: 'blk_loose_character_relationships',
    type: 'character_table',
    title: '人物关系',
    source: 'loose_command',
    characters,
    relationships: relationRows,
    rows: statusRows,
    factions: normalizeLooseFactionRows(loose.characters),
    citationIds: [],
  }];
}

function normalizeLooseFactionRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawCharacter) => {
    const character = asRecord(rawCharacter);
    const owner = formatLooseText(character?.name);
    const factions = Array.isArray(character?.factions) ? character.factions : [];
    return factions.map((rawFaction) => {
      const faction = asRecord(rawFaction);
      return {
        character: owner,
        name: formatLooseText(faction?.name ?? faction),
        status: formatLooseText(faction?.status),
        evidence: formatLooseText(faction?.evidence),
      };
    });
  });
}

function collectNestedCharacterItems(value: unknown, key: string) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawCharacter) => {
    const character = asRecord(rawCharacter);
    return Array.isArray(character?.[key]) ? character[key] as unknown[] : [];
  });
}

function mergeLooseArrays(...values: unknown[]) {
  return values.flatMap((value) => Array.isArray(value) ? value : []);
}

function normalizeLooseRelationsFromCharacters(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawCharacter) => {
    const character = asRecord(rawCharacter);
    const from = formatLooseText(character?.name);
    const relations = Array.isArray(character?.relations) ? character.relations : [];
    return relations.map((rawRelation) => {
      const relation = asRecord(rawRelation);
      return {
        from,
        to: formatLooseText(relation?.target ?? '?'),
        label: formatLooseText(relation?.relation ?? relation?.type ?? ''),
        evidence: formatLooseText(relation?.evidence),
        status: 'inferred',
        citationIds: [],
      };
    });
  });
}

function normalizeLooseRelationshipRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((rawRelation) => {
    const relation = asRecord(rawRelation);
    const pair = Array.isArray(relation?.pair) ? relation.pair : [];
    return {
      from: formatLooseText(relation?.from ?? pair[0] ?? '?'),
      to: formatLooseText(relation?.to ?? pair[1] ?? '?'),
      label: formatLooseText(relation?.type ?? relation?.relation ?? relation?.label ?? ''),
      evidence: formatLooseText(relation?.details ?? relation?.evidence),
      status: 'inferred',
      citationIds: [],
    };
  });
}

function normalizeLooseTimelineBlocks(value: unknown): AiResponseBlock[] {
  if (!Array.isArray(value) || !value.length) return [];
  return [{
    id: 'blk_loose_key_interactions',
    type: 'timeline',
    title: '关键互动',
    source: 'loose_command',
    events: value.map((rawInteraction, index) => {
      const interaction = asRecord(rawInteraction);
      return {
        id: `interaction_${index + 1}`,
        order: index + 1,
        timeLabel: `互动 ${index + 1}`,
        event: formatLooseText(interaction?.interaction ?? interaction?.event ?? interaction?.summary ?? rawInteraction),
        kind: 'happened',
        evidence: formatLooseText(interaction?.evidence),
        participants: Array.isArray(interaction?.participants) ? interaction.participants.map(formatLooseText) : [],
        citationIds: [],
      };
    }),
    citationIds: [],
  }];
}

function normalizeLooseForeshadowingBlocks(value: unknown): AiResponseBlock[] {
  if (!Array.isArray(value) || !value.length) return [];
  return [{
    id: 'blk_loose_conflicts',
    type: 'foreshadowing_list',
    title: '潜在冲突',
    source: 'loose_command',
    items: value.map((rawConflict, index) => {
      const conflict = asRecord(rawConflict);
      return {
        clue: formatLooseText(conflict?.conflict ?? conflict?.issue ?? conflict?.clue ?? `潜在冲突 ${index + 1}`),
        hypothesis: formatLooseText(conflict?.trigger ?? conflict?.hypothesis ?? conflict?.status),
        evidence: formatLooseText(conflict?.evidence),
        status: formatLooseText(conflict?.status ?? 'new'),
        source: 'loose_command',
        citationIds: [],
      };
    }),
    citationIds: [],
  }];
}

function normalizeLooseIssueReferences(value: unknown): AiProtocolCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawIssue, issueIndex) => {
    const issue = asRecord(rawIssue);
    const citations = Array.isArray(issue?.citations) ? issue.citations : [];
    return citations.map((rawCitation, citationIndex) => {
      const citation = asRecord(rawCitation);
      const quote = formatLooseText(citation?.quote ?? citation?.snippet ?? citation?.sourceText ?? rawCitation);
      return {
        id: String(citation?.id ?? `issue_${issueIndex + 1}_cite_${citationIndex + 1}`),
        type: 'pending',
        label: formatLooseText(issue?.issue ?? issue?.title ?? `问题 ${issueIndex + 1}`),
        quote,
        snippet: quote,
        sourceText: quote,
        status: 'pending_binding',
        confidence: 0,
        issue: issue?.issue,
        severity: issue?.severity,
      };
    });
  });
}

function normalizeLooseIssueBlocks(value: unknown): AiResponseBlock[] {
  if (!Array.isArray(value) || !value.length) return [];
  return [{
    id: 'blk_loose_possible_issues',
    type: 'foreshadowing_list',
    title: '可能问题',
    source: 'loose_command',
    items: value.map((rawIssue, issueIndex) => {
      const issue = asRecord(rawIssue);
      const citationIds = Array.isArray(issue?.citations)
        ? issue.citations.map((rawCitation, citationIndex) => {
          const citation = asRecord(rawCitation);
          return String(citation?.id ?? `issue_${issueIndex + 1}_cite_${citationIndex + 1}`);
        })
        : [];
      const analysis = formatLooseText(issue?.analysis);
      const verdict = formatLooseText(issue?.verdict);
      return {
        clue: formatLooseText(issue?.issue ?? issue?.title ?? `可能问题 ${issueIndex + 1}`),
        hypothesis: [analysis, verdict].filter(Boolean).join('\n'),
        evidence: formatLooseText(issue?.citations),
        status: formatLooseText(issue?.severity ?? 'pending'),
        source: 'loose_command',
        citationIds,
      };
    }),
    citationIds: normalizeLooseIssueReferences(value).map((citation) => citation.id),
  }];
}

function normalizeLooseVerdictBlocks(value: unknown): AiResponseBlock[] {
  const content = formatLooseText(value).trim();
  if (!content) return [];
  return [{
    id: 'blk_loose_overall_verdict',
    type: 'summary',
    title: '整体判断',
    content,
    citationIds: [],
  }];
}

function normalizeLooseFlashcardBlocks(value: unknown): AiResponseBlock[] {
  if (!Array.isArray(value) || !value.length) return [];
  return [{
    id: 'blk_loose_flashcards',
    type: 'flashcards',
    title: '复习卡片',
    cards: value.map((rawCard, index) => {
      const card = asRecord(rawCard);
      const citationId = card?.citation || card?.quote || card?.source || card?.citationSource ? String(card?.citationId ?? `fc${index + 1}`) : '';
      return {
        front: formatLooseText(card?.front ?? card?.question ?? `问题 ${index + 1}`),
        back: formatLooseText(card?.back ?? card?.answer),
        tags: Array.isArray(card?.tags) ? card.tags.map(formatLooseText) : [],
        citationSource: formatLooseText(card?.citation ?? card?.quote ?? card?.source ?? card?.citationSource),
        citationIds: citationId ? [citationId] : [],
      };
    }),
    citationIds: value.map((rawCard, index) => {
      const card = asRecord(rawCard);
      return card?.citation || card?.quote || card?.source || card?.citationSource ? String(card?.citationId ?? `fc${index + 1}`) : '';
    }).filter(Boolean),
  }];
}

function buildSummaryFromSchemaLessFields(loose: { major_events?: unknown; information_increment?: unknown; character_state_changes?: unknown }) {
  if (!Array.isArray(loose.major_events) && !Array.isArray(loose.information_increment) && !Array.isArray(loose.character_state_changes)) return undefined;
  return {
    major_events: loose.major_events,
    information_increment: loose.information_increment,
    character_state_changes: loose.character_state_changes,
  };
}

function normalizeLooseReferences(value: unknown): AiProtocolCitation[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const reference = item as Record<string, unknown> | null;
    const id = typeof reference?.id === 'string' && reference.id.trim() ? reference.id : `r${index + 1}`;
    const quote = typeof reference?.quote === 'string' ? reference.quote : '';
    const uses = Array.isArray(reference?.uses) ? reference.uses.map(String) : [];
    return {
      id,
      type: 'pending',
      label: uses[0] ?? `引用 ${index + 1}`,
      quote,
      snippet: quote,
      sourceText: quote,
      status: 'pending_binding',
      confidence: 0,
      uses,
    };
  });
}

function normalizeLooseEvidenceReferences(value: unknown): AiProtocolCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawEvidence, evidenceIndex) => {
    const evidence = asRecord(rawEvidence);
    const references = Array.isArray(evidence?.references) ? evidence.references : [];
    return references.map((rawReference, referenceIndex) => {
      const reference = asRecord(rawReference);
      const id = String(reference?.id ?? `e${evidenceIndex + 1}r${referenceIndex + 1}`);
      const quote = String(reference?.quote ?? '');
      const locationHint = String(reference?.locationhint ?? reference?.locationHint ?? '');
      return {
        id,
        type: 'pending',
        label: locationHint || String(evidence?.claim ?? `证据 ${evidenceIndex + 1}`),
        quote,
        snippet: quote,
        sourceText: quote,
        status: 'pending_binding',
        confidence: 0,
        tool: reference?.tool,
        locationHint,
        claim: evidence?.claim,
      };
    });
  });
}

function normalizeLooseEvidenceBlocks(value: unknown): AiResponseBlock[] {
  if (!Array.isArray(value) || !value.length) return [];
  return [{
    id: 'blk_loose_evidence',
    type: 'evidence_list',
    title: '证据链',
    items: value.map((rawEvidence, evidenceIndex) => {
      const evidence = asRecord(rawEvidence);
      const references = Array.isArray(evidence?.references) ? evidence.references : [];
      return {
        claim: String(evidence?.claim ?? `证据 ${evidenceIndex + 1}`),
        references: references.map((rawReference, referenceIndex) => {
          const reference = asRecord(rawReference);
          return {
            id: String(reference?.id ?? `e${evidenceIndex + 1}r${referenceIndex + 1}`),
            tool: String(reference?.tool ?? ''),
            quote: String(reference?.quote ?? ''),
            locationHint: String(reference?.locationhint ?? reference?.locationHint ?? ''),
          };
        }),
        citationIds: references.map((rawReference, referenceIndex) => {
          const reference = asRecord(rawReference);
          return String(reference?.id ?? `e${evidenceIndex + 1}r${referenceIndex + 1}`);
        }),
      };
    }),
    citationIds: normalizeLooseEvidenceReferences(value).map((citation) => citation.id),
  }];
}

function normalizeLooseSummaryBlocks(summary: unknown, citations: AiProtocolCitation[]): AiResponseBlock[] {
  const data = summary as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') {
    return typeof summary === 'string' && summary.trim()
      ? [{ id: 'blk_loose_summary_1', type: 'summary', title: '摘要', content: summary.trim(), citationIds: citations.map((citation) => citation.id) }]
      : [];
  }
  const blocks: AiResponseBlock[] = [];
  const referenceIds = citations.map((citation) => citation.id);
  const addBulletBlock = (key: string, title: string) => {
    const values = Array.isArray(data[key]) ? data[key] : [];
    if (!values.length) return;
    blocks.push({
      id: `blk_loose_${key}`,
      type: 'summary',
      title,
      bullets: values.map((value, index) => ({
        text: String(value),
        citationIds: referenceIds[index] ? [referenceIds[index]] : referenceIds,
      })),
      citationIds: referenceIds,
    });
  };
  addBulletBlock('mainevents', '主要事件');
  addBulletBlock('mainEvents', '主要事件');
  addBulletBlock('major_events', '主要事件');
  addBulletBlock('majorEvents', '主要事件');
  addBulletBlock('主要事件', '主要事件');
  addBulletBlock('informationgain', '信息增量');
  addBulletBlock('informationGain', '信息增量');
  addBulletBlock('information_increment', '信息增量');
  addBulletBlock('informationIncrement', '信息增量');
  addBulletBlock('信息增量', '信息增量');
  const characterRows = Array.isArray(data.characterstatuschanges)
    ? data.characterstatuschanges
    : Array.isArray(data.characterStatusChanges)
      ? data.characterStatusChanges
      : Array.isArray(data.character_state_changes)
        ? data.character_state_changes
      : Array.isArray(data.characterStateChanges)
        ? data.characterStateChanges
      : Array.isArray(data['角色状态变化'])
        ? data['角色状态变化']
      : [];
  if (characterRows.length) {
    blocks.push({
      id: 'blk_loose_character_status',
      type: 'character_table',
      title: '角色状态变化',
      rows: characterRows.map((row, index) => {
        const item = row as Record<string, unknown> | null;
        if (typeof row === 'string') {
          const [name, ...rest] = row.split(/[：:]/);
          return {
            character: name?.trim() || `角色 ${index + 1}`,
            statusChange: rest.join(':').trim() || row,
            citationIds: referenceIds[index] ? [referenceIds[index]] : referenceIds,
          };
        }
        return {
          character: String(item?.character ?? `角色 ${index + 1}`),
          statusChange: item?.statuschange ?? item?.statusChange ?? '',
          citationIds: referenceIds[index] ? [referenceIds[index]] : referenceIds,
        };
      }),
      citationIds: referenceIds,
    });
  }
  if (!blocks.length) {
    blocks.push({ id: 'blk_loose_summary_1', type: 'summary', title: '摘要', content: JSON.stringify(summary), citationIds: referenceIds });
  }
  return blocks;
}

function inferLooseSummaryText(summary: unknown) {
  if (typeof summary === 'string') return summary;
  const data = summary as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return undefined;
  for (const key of ['mainevents', 'mainEvents', 'major_events', 'majorEvents', '主要事件', 'informationgain', 'informationGain', 'information_increment', 'informationIncrement', '信息增量']) {
    const values = data[key];
    if (Array.isArray(values) && values.length) return String(values[0]);
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function formatLooseText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatLooseText).filter(Boolean).join('；');
  const record = asRecord(value);
  if (!record) return String(value);
  for (const key of ['text', 'content', 'summary', 'statusChange', 'statuschange', 'changeSummary', 'description', 'note']) {
    if (record[key] !== undefined) return formatLooseText(record[key]);
  }
  return Object.entries(record)
    .map(([key, item]) => `${key}: ${formatLooseText(item)}`)
    .filter((line) => !line.endsWith(': '))
    .join('；');
}

function normalizeBlockType(type: string) {
  const normalizedType = type.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const legacyMap: Record<string, string> = {
    chapter_summary: 'summary',
    character_relationships: 'character_table',
    foreshadowing: 'foreshadowing_list',
    actions: 'suggested_actions',
    answer: 'paragraph',
    table: 'character_table',
    text: 'paragraph',
    plain_text: 'paragraph',
    text_block: 'paragraph',
    rich_text: 'paragraph',
    markdown: 'paragraph',
    md: 'paragraph',
    body: 'paragraph',
    message: 'paragraph',
    final_answer: 'paragraph',
  };
  return legacyMap[normalizedType] ?? normalizedType;
}

function normalizeCitation(citation: AiProtocolCitation): AiProtocolCitation {
  const sourceChapterIndex = typeof citation.sourceChapterIndex === 'number'
    ? citation.sourceChapterIndex
    : typeof citation.chapterIndex === 'number'
      ? citation.chapterIndex
      : undefined;
  const snippet = typeof citation.snippet === 'string'
    ? citation.snippet
    : typeof citation.sourceText === 'string'
      ? citation.sourceText
      : citation.quote;
  return {
    ...citation,
    id: String(citation.id),
    sourceChapterIndex,
    chapterIndex: typeof citation.chapterIndex === 'number' ? citation.chapterIndex : sourceChapterIndex,
    quote: citation.quote ?? snippet,
    snippet,
    sourceText: typeof citation.sourceText === 'string' ? citation.sourceText : snippet,
  };
}

function blockToToolCall(block: AiResponseBlock): AiToolCall {
  return {
    id: block.id,
    tool: String(block.tool ?? block.name ?? 'unknown_tool'),
    status: String(block.status ?? 'pending'),
    args: block.args && typeof block.args === 'object' ? block.args as Record<string, unknown> : undefined,
    reason: typeof block.reason === 'string' ? block.reason : undefined,
  };
}

function blockToToolResult(block: AiResponseBlock): AiToolResult {
  return {
    id: block.id,
    toolCallId: typeof block.toolCallId === 'string' ? block.toolCallId : undefined,
    tool: String(block.tool ?? block.name ?? 'unknown_tool'),
    status: String(block.status ?? 'succeeded'),
    durationMs: typeof block.durationMs === 'number' ? block.durationMs : undefined,
    summary: typeof block.summary === 'string' ? block.summary : typeof block.content === 'string' ? block.content : undefined,
    contentType: typeof block.contentType === 'string' ? block.contentType : undefined,
    content: block.result ?? block.content,
    diagnostics: block.diagnostics && typeof block.diagnostics === 'object' ? block.diagnostics as Record<string, unknown> : undefined,
    collapsed: true,
  };
}

function isBlock(value: unknown): value is AiResponseBlock {
  const item = value as Partial<AiResponseBlock> | null;
  return Boolean(item) && typeof item?.id === 'string' && typeof item.type === 'string';
}

function isCitation(value: unknown): value is AiProtocolCitation {
  const item = value as Partial<AiProtocolCitation> | null;
  return Boolean(item) && typeof item?.id === 'string';
}

function isToolCall(value: unknown): value is AiToolCall {
  const item = value as Partial<AiToolCall> | null;
  return Boolean(item) && typeof item?.id === 'string' && typeof item.tool === 'string' && typeof item.status === 'string';
}

function isToolResult(value: unknown): value is Omit<AiToolResult, 'collapsed'> {
  const item = value as Partial<AiToolResult> | null;
  return Boolean(item) && typeof item?.id === 'string' && typeof item.tool === 'string' && typeof item.status === 'string';
}

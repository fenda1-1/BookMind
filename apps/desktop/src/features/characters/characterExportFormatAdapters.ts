import type {
  CharacterCenterBookSummary,
  CharacterCenterPayload,
  CharacterEvidence,
  CharacterExportOptions,
  CharacterLocation,
  CharacterMention,
  CharacterProfile,
  CharacterRelation,
} from '../../types';

export type CharacterExportFile = {
  fileName: string;
  mimeType: string;
  content: string;
};

export type CharacterExportScope = {
  book: CharacterCenterBookSummary;
  profiles: CharacterProfile[];
  profileIds: Set<string>;
  relations: CharacterRelation[];
  relationIds: Set<string>;
  mentions: CharacterMention[];
  evidence: CharacterEvidence[];
};

type CharacterExportCounts = {
  profiles: number;
  relations: number;
  evidence: number;
  mentions: number;
};

const defaultQuoteLength = 280;
export function buildCharacterMarkdownExportFile(
  payload: CharacterCenterPayload,
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
  schemaVersion: string,
): CharacterExportFile {
  if (options.markdownStyle === 'logseq') {
    return buildCharacterLogseqMarkdownExportFile(payload, scope, options, generatedAt, schemaVersion);
  }
  const lines: string[] = [];
  lines.push(`# 人物档案：${privateValue(scope.book.displayTitle || scope.book.title, options)}`);
  lines.push('');
  lines.push(`- schemaVersion: ${schemaVersion}`);
  lines.push(`- generatedAt: ${generatedAt}`);
  lines.push(`- bookId: ${scope.book.id}`);
  lines.push(`- characterIndex: ${payload.manifest?.schemaVersion ?? '-'}`);
  lines.push(`- counts: 人物 ${scope.profiles.length}，关系 ${scope.relations.length}，证据 ${scope.evidence.length}`);
  lines.push('');

  lines.push('## 人物');
  if (scope.profiles.length === 0) {
    lines.push('');
    lines.push('- 暂无可导出人物。');
  } else {
    for (const profile of scope.profiles) {
      lines.push('');
      lines.push(`### ${formatMarkdownEntityName(profile.displayName || profile.canonicalName, options)}`);
      lines.push(`- 名称：${formatMarkdownEntityName(profile.displayName || profile.canonicalName, options)}`);
      lines.push(`- 类型：${profile.kind}`);
      lines.push(`- 角色：${profile.role}`);
      lines.push(`- 重要度：${formatRatio(profile.importanceScore)}`);
      lines.push(`- 置信度：${formatRatio(profile.confidence)}`);
      lines.push(`- 提及：${profile.mentionCount}`);
      lines.push(`- 首次出场：${formatCharacterExportLocation(profile.firstAppearance)}`);
      lines.push(`- 最近出场：${formatCharacterExportLocation(profile.lastAppearance)}`);
      const aliases = exportAliasNames(profile);
      if (aliases.length > 0) lines.push(`- 别名：${aliases.map((alias) => formatMarkdownEntityName(alias, options)).join('、')}`);
      if (profile.tags.length > 0) lines.push(`- 标签：${profile.tags.map((tag) => privateValue(tag, options)).join('、')}`);
      if (profile.summary) lines.push(`- 摘要：${privateValue(profile.summary, options)}`);
    }
  }

  if (options.includeRelations !== false && scope.relations.length > 0) {
    const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
    lines.push('');
    lines.push('## 关系');
    for (const relation of scope.relations) {
      const source = profileById.get(relation.sourceCharacterId);
      const target = profileById.get(relation.targetCharacterId);
      const sourceName = formatMarkdownEntityName(source?.displayName || source?.canonicalName || relation.sourceCharacterId, options);
      const targetName = formatMarkdownEntityName(target?.displayName || target?.canonicalName || relation.targetCharacterId, options);
      lines.push('');
      lines.push(`- ${sourceName} -> ${targetName}：${privateValue(relation.label || relation.relationType, options)}`);
      if (relation.summary) lines.push(`  - 摘要：${privateValue(relation.summary, options)}`);
      lines.push(`  - 置信度：${formatRatio(relation.confidence)}`);
      lines.push(`  - 证据：${relation.evidenceIds.length}`);
    }
  }

  if (options.includeEvidence !== false && scope.evidence.length > 0) {
    lines.push('');
    lines.push('## 证据');
    for (const evidence of scope.evidence) {
      lines.push('');
      lines.push(`- ${evidence.id} · ${evidence.targetType} · ${evidence.status} · ${formatCharacterExportLocation(evidence.location)}`);
      if (evidence.claim) lines.push(`  - claim: ${privateValue(evidence.claim, options)}`);
      lines.push(`  - quote: ${formatExportQuote(evidence.quote, options)}`);
      if (options.includeQuotes === false) lines.push(`  - location: ${formatCharacterLocationLink(evidence.location)}`);
    }
  }

  return {
    fileName: `${scope.book.id}-characters.md`,
    mimeType: 'text/markdown;charset=utf-8',
    content: `${lines.join('\n')}\n`,
  };
}

export function buildCharacterLogseqMarkdownExportFile(
  payload: CharacterCenterPayload,
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
  schemaVersion: string,
): CharacterExportFile {
  const lines: string[] = [];
  lines.push(`- 人物档案：${privateValue(scope.book.displayTitle || scope.book.title, options)}`);
  lines.push(`\t- schemaVersion: ${schemaVersion}`);
  lines.push(`\t- generatedAt: ${generatedAt}`);
  lines.push(`\t- bookId: ${scope.book.id}`);
  lines.push(`\t- characterIndex: ${payload.manifest?.schemaVersion ?? '-'}`);
  lines.push(`\t- counts: 人物 ${scope.profiles.length}，关系 ${scope.relations.length}，证据 ${scope.evidence.length}`);
  lines.push('\t- 人物');
  if (scope.profiles.length === 0) {
    lines.push('\t\t- 暂无可导出人物。');
  } else {
    for (const profile of scope.profiles) {
      lines.push(`\t\t- ${privateValue(profile.displayName || profile.canonicalName, options)}`);
      lines.push(`\t\t\t- 名称：${privateValue(profile.displayName || profile.canonicalName, options)}`);
      lines.push(`\t\t\t- 类型：${profile.kind}`);
      lines.push(`\t\t\t- 角色：${profile.role}`);
      lines.push(`\t\t\t- 重要度：${formatRatio(profile.importanceScore)}`);
      lines.push(`\t\t\t- 置信度：${formatRatio(profile.confidence)}`);
      lines.push(`\t\t\t- 提及：${profile.mentionCount}`);
      lines.push(`\t\t\t- 首次出场：${formatCharacterExportLocation(profile.firstAppearance)}`);
      lines.push(`\t\t\t- 最近出场：${formatCharacterExportLocation(profile.lastAppearance)}`);
      const aliases = exportAliasNames(profile);
      if (aliases.length > 0) lines.push(`\t\t\t- 别名：${aliases.map((alias) => privateValue(alias, options)).join('、')}`);
      if (profile.tags.length > 0) lines.push(`\t\t\t- 标签：${profile.tags.map((tag) => privateValue(tag, options)).join('、')}`);
      if (profile.summary) lines.push(`\t\t\t- 摘要：${privateValue(profile.summary, options)}`);
    }
  }
  if (options.includeRelations !== false && scope.relations.length > 0) {
    const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
    lines.push('\t- 关系');
    for (const relation of scope.relations) {
      const source = profileById.get(relation.sourceCharacterId);
      const target = profileById.get(relation.targetCharacterId);
      const sourceName = privateValue(source?.displayName || source?.canonicalName || relation.sourceCharacterId, options);
      const targetName = privateValue(target?.displayName || target?.canonicalName || relation.targetCharacterId, options);
      lines.push(`\t\t- ${sourceName} -> ${targetName}：${privateValue(relation.label || relation.relationType, options)}`);
      if (relation.summary) lines.push(`\t\t\t- 摘要：${privateValue(relation.summary, options)}`);
      lines.push(`\t\t\t- 置信度：${formatRatio(relation.confidence)}`);
      lines.push(`\t\t\t- 证据：${relation.evidenceIds.length}`);
    }
  }
  if (options.includeEvidence !== false && scope.evidence.length > 0) {
    lines.push('\t- 证据');
    for (const evidence of scope.evidence) {
      lines.push(`\t\t- ${evidence.id} · ${evidence.targetType} · ${evidence.status} · ${formatCharacterExportLocation(evidence.location)}`);
      if (evidence.claim) lines.push(`\t\t\t- claim: ${privateValue(evidence.claim, options)}`);
      lines.push(`\t\t\t- quote: ${formatExportQuote(evidence.quote, options)}`);
      if (options.includeQuotes === false) lines.push(`\t\t\t- location: ${formatCharacterLocationLink(evidence.location)}`);
    }
  }

  return {
    fileName: `${scope.book.id}-characters.md`,
    mimeType: 'text/markdown;charset=utf-8',
    content: `${lines.join('\n')}\n`,
  };
}

export function buildCharacterJsonExportFile(
  payload: CharacterCenterPayload,
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
  schemaVersion: string,
): CharacterExportFile {
  const counts = scopeCounts(scope);
  const data = {
    schemaVersion: schemaVersion,
    generatedAt,
    book: sanitizeCharacterExportBook(scope.book, options, counts),
    manifest: payload.manifest ? sanitizeCharacterExportManifest(payload.manifest, options, scope) : null,
    counts,
    profiles: scope.profiles.map((profile) => sanitizeCharacterExportProfile(profile, options)),
    relations: scope.relations.map((relation) => sanitizeCharacterExportRelation(relation, options)),
    evidence: scope.evidence.map((evidence) => sanitizeCharacterExportEvidence(evidence, options)),
    mentions: scope.mentions.map((mention) => sanitizeCharacterExportMention(mention, options)),
  };

  return {
    fileName: `${scope.book.id}-character-export.json`,
    mimeType: 'application/json;charset=utf-8',
    content: `${JSON.stringify(data, null, 2)}\n`,
  };
}

export function buildCharacterCsvExportFiles(
  scope: CharacterExportScope,
  options: CharacterExportOptions,
): CharacterExportFile[] {
  const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
  return [
    {
      fileName: `${scope.book.id}-character-profiles.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: buildCsv([
        ['id', 'displayName', 'kind', 'role', 'mentionCount', 'relationCount', 'importanceScore', 'confidence', 'source', 'firstAppearance', 'lastAppearance', 'tags', 'aliases', 'summary'],
        ...scope.profiles.map((profile) => [
          profile.id,
          privateValue(profile.displayName || profile.canonicalName, options),
          profile.kind,
          profile.role,
          String(profile.mentionCount),
          String(profile.relationCount),
          formatDecimal(profile.importanceScore),
          formatDecimal(profile.confidence),
          profile.source,
          formatCharacterExportLocation(profile.firstAppearance),
          formatCharacterExportLocation(profile.lastAppearance),
          profile.tags.map((tag) => privateValue(tag, options)).join(';'),
          exportAliasNames(profile).map((alias) => privateValue(alias, options)).join(';'),
          privateValue(profile.summary, options),
        ]),
      ], { forceQuoteColumns: new Set([13]) }),
    },
    {
      fileName: `${scope.book.id}-character-relations.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: buildCsv([
        ['id', 'sourceCharacterId', 'targetCharacterId', 'relationType', 'label', 'direction', 'confidence', 'evidenceIds', 'sourceName', 'targetName', 'summary'],
        ...scope.relations.map((relation) => [
          relation.id,
          relation.sourceCharacterId,
          relation.targetCharacterId,
          relation.relationType,
          privateValue(relation.label, options),
          relation.direction,
          formatDecimal(relation.confidence),
          relation.evidenceIds.join(';'),
          privateValue(profileById.get(relation.sourceCharacterId)?.displayName ?? relation.sourceCharacterId, options),
          privateValue(profileById.get(relation.targetCharacterId)?.displayName ?? relation.targetCharacterId, options),
          privateValue(relation.summary, options),
        ]),
      ], { forceQuoteColumns: new Set([10]) }),
    },
    {
      fileName: `${scope.book.id}-character-evidence.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: buildCsv([
        ['id', 'targetType', 'targetId', 'status', 'confidence', 'source', 'location', 'locationLink', 'claim', 'quote', 'evidenceHash'],
        ...scope.evidence.map((evidence) => [
          evidence.id,
          evidence.targetType,
          evidence.targetId,
          evidence.status,
          formatDecimal(evidence.confidence),
          evidence.source,
          formatCharacterExportLocation(evidence.location),
          formatCharacterLocationLink(evidence.location),
          privateValue(evidence.claim, options),
          formatExportQuote(evidence.quote, options),
          evidence.evidenceHash,
        ]),
      ], { forceQuoteColumns: new Set([8, 9]) }),
    },
  ];
}

export function buildCharacterRelationsJsonExportFile(
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
): CharacterExportFile {
  const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
  const evidenceByRelationId = new Map<string, CharacterEvidence[]>();
  for (const evidence of scope.evidence) {
    if (evidence.targetType !== 'relation') continue;
    const current = evidenceByRelationId.get(evidence.targetId) ?? [];
    current.push(evidence);
    evidenceByRelationId.set(evidence.targetId, current);
  }
  const data = {
    schemaVersion: 'bookmind.character-relations-export.v1',
    generatedAt,
    book: sanitizeCharacterExportBook(scope.book, options, scopeCounts(scope)),
    counts: {
      relations: scope.relations.length,
      evidence: scope.evidence.filter((item) => item.targetType === 'relation').length,
    },
    relations: scope.relations.map((relation) => ({
      ...sanitizeCharacterExportRelation(relation, options),
      sourceName: privateValue(profileById.get(relation.sourceCharacterId)?.displayName ?? relation.sourceCharacterId, options),
      targetName: privateValue(profileById.get(relation.targetCharacterId)?.displayName ?? relation.targetCharacterId, options),
    })),
    evidenceByRelationId: options.includeEvidence === false
      ? {}
      : Object.fromEntries(scope.relations.map((relation) => [
        relation.id,
        (evidenceByRelationId.get(relation.id) ?? []).map((evidence) => sanitizeCharacterExportEvidence(evidence, options)),
      ])),
  };
  return {
    fileName: `${scope.book.id}-character-relations.json`,
    mimeType: 'application/json;charset=utf-8',
    content: `${JSON.stringify(data, null, 2)}\n`,
  };
}

export function buildCharacterMentionsJsonlExportFile(
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
): CharacterExportFile {
  const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
  const rows = scope.mentions.map((mention) => ({
    schemaVersion: 'bookmind.character-mention-row.v1',
    generatedAt,
    ...sanitizeCharacterExportMention(mention, options),
    characterName: privateValue(profileById.get(mention.characterId)?.displayName ?? mention.characterId, options),
  }));
  return {
    fileName: `${scope.book.id}-character-mentions.jsonl`,
    mimeType: 'application/x-ndjson;charset=utf-8',
    content: rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '',
  };
}

export function buildCharacterMermaidExportFile(
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
): CharacterExportFile {
  const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
  const nodeIds = buildMermaidNodeIdMap(scope.profiles);
  const lines = [
    '---',
    `title: 人物关系：${escapeMermaidLabel(privateValue(scope.book.displayTitle || scope.book.title, options))}`,
    '---',
    'graph LR',
    `%% schemaVersion: bookmind.character-mermaid-export.v1`,
    `%% generatedAt: ${generatedAt}`,
  ];
  for (const profile of scope.profiles) {
    lines.push(`  ${nodeIds.get(profile.id)}["${escapeMermaidLabel(privateValue(profile.displayName || profile.canonicalName, options))}"]`);
  }
  for (const relation of scope.relations) {
    const source = profileById.get(relation.sourceCharacterId);
    const target = profileById.get(relation.targetCharacterId);
    if (!source || !target) continue;
    const arrow = relation.direction === 'undirected' ? '---' : '-->';
    const label = escapeMermaidLabel(privateValue(relation.label || relation.relationType, options));
    lines.push(`  ${nodeIds.get(source.id)} ${arrow}|\"${label}\"| ${nodeIds.get(target.id)}`);
  }
  return {
    fileName: `${scope.book.id}-character-graph.mmd`,
    mimeType: 'text/vnd.mermaid;charset=utf-8',
    content: `${lines.join('\n')}\n`,
  };
}

export function buildCharacterGraphmlExportFile(
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
): CharacterExportFile {
  const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <key id="label" for="all" attr.name="label" attr.type="string"/>',
    '  <key id="kind" for="node" attr.name="kind" attr.type="string"/>',
    '  <key id="role" for="node" attr.name="role" attr.type="string"/>',
    '  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>',
    '  <key id="direction" for="edge" attr.name="direction" attr.type="string"/>',
    '  <key id="confidence" for="all" attr.name="confidence" attr.type="double"/>',
    '  <key id="generatedAt" for="graph" attr.name="generatedAt" attr.type="string"/>',
    `  <graph id="${xmlEscape(scope.book.id)}" edgedefault="directed">`,
    `    <data key="label">${xmlEscape(privateValue(scope.book.displayTitle || scope.book.title, options))}</data>`,
    `    <data key="generatedAt">${xmlEscape(generatedAt)}</data>`,
  ];
  for (const profile of scope.profiles) {
    lines.push(`    <node id="${xmlEscape(profile.id)}">`);
    lines.push(`      <data key="label">${xmlEscape(privateValue(profile.displayName || profile.canonicalName, options))}</data>`);
    lines.push(`      <data key="kind">${xmlEscape(profile.kind)}</data>`);
    lines.push(`      <data key="role">${xmlEscape(profile.role)}</data>`);
    lines.push(`      <data key="confidence">${formatDecimal(profile.confidence)}</data>`);
    lines.push('    </node>');
  }
  for (const relation of scope.relations) {
    const source = profileById.get(relation.sourceCharacterId);
    const target = profileById.get(relation.targetCharacterId);
    if (!source || !target) continue;
    const directed = relation.direction === 'undirected' ? ' directed="false"' : '';
    lines.push(`    <edge id="${xmlEscape(relation.id)}" source="${xmlEscape(source.id)}" target="${xmlEscape(target.id)}"${directed}>`);
    lines.push(`      <data key="label">${xmlEscape(privateValue(relation.label || relation.relationType, options))}</data>`);
    lines.push(`      <data key="relationType">${xmlEscape(relation.relationType)}</data>`);
    lines.push(`      <data key="direction">${xmlEscape(relation.direction)}</data>`);
    lines.push(`      <data key="confidence">${formatDecimal(relation.confidence)}</data>`);
    lines.push('    </edge>');
  }
  lines.push('  </graph>');
  lines.push('</graphml>');
  return {
    fileName: `${scope.book.id}-character-graph.graphml`,
    mimeType: 'application/graphml+xml;charset=utf-8',
    content: `${lines.join('\n')}\n`,
  };
}

export function buildCharacterCytoscapeJsonExportFile(
  scope: CharacterExportScope,
  options: CharacterExportOptions,
  generatedAt: string,
): CharacterExportFile {
  const profileById = new Map(scope.profiles.map((profile) => [profile.id, profile]));
  const data = {
    schemaVersion: 'bookmind.character-cytoscape-export.v1',
    generatedAt,
    book: sanitizeCharacterExportBook(scope.book, options, scopeCounts(scope)),
    elements: {
      nodes: scope.profiles.map((profile) => ({
        data: {
          id: profile.id,
          label: privateValue(profile.displayName || profile.canonicalName, options),
          kind: profile.kind,
          role: profile.role,
          mentionCount: profile.mentionCount,
          relationCount: profile.relationCount,
          confidence: profile.confidence,
        },
      })),
      edges: scope.relations.flatMap((relation) => {
        const source = profileById.get(relation.sourceCharacterId);
        const target = profileById.get(relation.targetCharacterId);
        if (!source || !target) return [];
        return [{
          data: {
            id: relation.id,
            source: source.id,
            target: target.id,
            label: privateValue(relation.label || relation.relationType, options),
            relationType: relation.relationType,
            direction: relation.direction,
            confidence: relation.confidence,
            evidenceIds: options.includeEvidence === false ? [] : relation.evidenceIds,
          },
        }];
      }),
    },
  };
  return {
    fileName: `${scope.book.id}-character-cytoscape.json`,
    mimeType: 'application/json;charset=utf-8',
    content: `${JSON.stringify(data, null, 2)}\n`,
  };
}

function sanitizeCharacterExportBook(book: CharacterCenterBookSummary, options: CharacterExportOptions, counts: CharacterExportCounts) {
  return {
    id: book.id,
    title: privateValue(book.title, options),
    displayTitle: privateValue(book.displayTitle, options),
    author: privateValue(book.author, options),
    fileName: privateValue(book.fileName, options),
    progress: book.progress,
    textIndexStatus: book.textIndexStatus,
    textIndexReady: book.textIndexReady,
    textIndexChunkCount: book.textIndexChunkCount,
    textIndexFtsRows: book.textIndexFtsRows,
    characterIndexStatus: book.characterIndexStatus,
    characterCount: counts.profiles,
    relationCount: counts.relations,
    evidenceCount: counts.evidence,
    lastCharacterBuiltAt: book.lastCharacterBuiltAt,
    staleReason: book.staleReason,
  };
}

function sanitizeCharacterExportManifest(
  manifest: NonNullable<CharacterCenterPayload['manifest']>,
  options: CharacterExportOptions,
  scope: CharacterExportScope,
) {
  const counts = scopeCounts(scope);
  return {
    schemaVersion: manifest.schemaVersion,
    bookId: manifest.bookId,
    bookTitle: privateValue(manifest.bookTitle, options),
    contentHash: manifest.contentHash,
    textIndexContentHash: manifest.textIndexContentHash,
    indexVersion: manifest.indexVersion,
    chunkStrategyVersion: manifest.chunkStrategyVersion,
    chapterRuleVersion: manifest.chapterRuleVersion,
    status: manifest.status,
    extractionMode: manifest.extractionMode,
    builtAt: manifest.builtAt,
    updatedAt: manifest.updatedAt,
    staleReason: manifest.staleReason,
    lastError: manifest.lastError,
    characterCount: counts.profiles,
    aliasCount: scope.profiles.reduce((total, profile) => total + profile.aliases.length, 0),
    mentionCount: counts.mentions,
    relationCount: counts.relations,
    evidenceCount: counts.evidence,
    eventCount: 0,
    factionCount: scope.profiles.reduce((total, profile) => total + profile.factionMemberships.length, 0),
    sourceTextIndex: {
      status: manifest.sourceTextIndex.status,
      builtAt: manifest.sourceTextIndex.builtAt,
      chunkCount: manifest.sourceTextIndex.chunkCount,
      ftsRowCount: manifest.sourceTextIndex.ftsRowCount,
    },
  };
}

function sanitizeCharacterExportProfile(profile: CharacterProfile, options: CharacterExportOptions) {
  return {
    id: profile.id,
    bookId: profile.bookId,
    canonicalName: privateValue(profile.canonicalName, options),
    displayName: privateValue(profile.displayName, options),
    kind: profile.kind,
    role: profile.role,
    aliases: profile.aliases.map((alias) => ({
      ...alias,
      name: privateValue(alias.name, options),
      normalizedName: privateValue(alias.normalizedName, options),
    })),
    summary: privateValue(profile.summary, options),
    tags: profile.tags.map((tag) => privateValue(tag, options)),
    importanceScore: profile.importanceScore,
    confidence: profile.confidence,
    firstAppearance: profile.firstAppearance,
    lastAppearance: profile.lastAppearance,
    mentionCount: profile.mentionCount,
    relationCount: profile.relationCount,
    eventCount: profile.eventCount,
    hidden: profile.hidden,
    source: profile.source,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function sanitizeCharacterExportRelation(relation: CharacterRelation, options: CharacterExportOptions) {
  return {
    ...relation,
    evidenceIds: options.includeEvidence === false ? [] : relation.evidenceIds,
    label: privateValue(relation.label, options),
    summary: privateValue(relation.summary, options),
  };
}

function sanitizeCharacterExportEvidence(evidence: CharacterEvidence, options: CharacterExportOptions) {
  return {
    ...evidence,
    claim: privateValue(evidence.claim, options),
    quote: formatExportQuote(evidence.quote, options),
    locationLink: formatCharacterLocationLink(evidence.location),
  };
}

function sanitizeCharacterExportMention(mention: CharacterMention, options: CharacterExportOptions) {
  return {
    ...mention,
    name: privateValue(mention.name, options),
    normalizedName: privateValue(mention.normalizedName, options),
    quote: formatExportQuote(mention.quote, options),
    prefixText: formatExportContextText(mention.prefixText, options),
    suffixText: formatExportContextText(mention.suffixText, options),
    locationLink: formatCharacterLocationLink(mention.location),
  };
}

function scopeCounts(scope: CharacterExportScope): CharacterExportCounts {
  return {
    profiles: scope.profiles.length,
    relations: scope.relations.length,
    evidence: scope.evidence.length,
    mentions: scope.mentions.length,
  };
}

function exportAliasNames(profile: CharacterProfile) {
  const mainNames = new Set([profile.displayName, profile.canonicalName].map((name) => name.trim()).filter(Boolean));
  return Array.from(new Set(
    profile.aliases
      .map((alias) => alias.name.trim())
      .filter((name) => name && !mainNames.has(name)),
  ));
}

function formatExportQuote(quote: string, options: CharacterExportOptions) {
  if (options.privacyMode) return 'quote 已按隐私模式隐藏';
  if (options.includeQuotes === false) return 'quote 未导出';
  return truncateExportText(quote, options.maxQuoteLength ?? defaultQuoteLength);
}

function formatExportContextText(value: string | undefined, options: CharacterExportOptions) {
  if (options.includeQuotes === false) return '';
  return privateValue(value ?? '', options);
}

function truncateExportText(value: string, maxLength: number) {
  const characters = Array.from(value.trim());
  const normalizedMax = Math.max(0, Math.floor(maxLength));
  if (normalizedMax <= 0 || characters.length <= normalizedMax) return characters.join('');
  return `${characters.slice(0, normalizedMax).join('')}...`;
}

function formatRatio(value: number) {
  return `${Math.round(clampRatio(value) * 100)}%`;
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(clampRatio(value) * 100) / 100);
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function privateValue(value: string, options: CharacterExportOptions) {
  if (!options.privacyMode) return value;
  return options.privateValue?.trim() || '[private]';
}

function formatMarkdownEntityName(value: string, options: CharacterExportOptions) {
  const displayValue = privateValue(value, options);
  if (options.privacyMode || options.markdownStyle !== 'obsidian') return displayValue;
  const normalizedValue = displayValue.trim();
  if (!normalizedValue) return displayValue;
  return `[[${normalizedValue.replace(/\]/g, '\\]')}]]`;
}

function formatCharacterExportLocation(location: CharacterLocation | undefined) {
  if (!location) return '-';
  const chapter = location.chapterTitle || (typeof location.sourceChapterIndex === 'number'
    ? `第${location.sourceChapterIndex}章`
    : typeof location.chapterIndex === 'number'
      ? `第${location.chapterIndex}章`
      : '-');
  const paragraph = typeof location.paragraphIndex === 'number'
    ? `段落${location.paragraphIndex}`
    : typeof location.paragraphStart === 'number'
      ? `段落${location.paragraphStart}`
      : '';
  return paragraph ? `${chapter}:${paragraph}` : chapter;
}

function formatCharacterLocationLink(location: CharacterLocation | undefined) {
  if (!location?.bookId) return '';
  const params = new URLSearchParams();
  const chapter = location.sourceChapterIndex ?? location.chapterIndex;
  const paragraph = location.paragraphIndex ?? location.paragraphStart;
  if (typeof chapter === 'number') params.set('chapter', String(chapter));
  if (typeof paragraph === 'number') params.set('paragraph', String(paragraph));
  if (typeof location.startOffset === 'number') params.set('start', String(location.startOffset));
  if (typeof location.endOffset === 'number') params.set('end', String(location.endOffset));
  if (location.chunkId) params.set('chunk', location.chunkId);
  const query = params.toString();
  return `bookmind://reader/${encodeURIComponent(location.bookId)}${query ? `?${query}` : ''}`;
}

function buildCsv(rows: string[][], options: { forceQuoteColumns?: Set<number> } = {}) {
  return `${rows.map((row, rowIndex) => row
    .map((value, columnIndex) => csvValue(value, rowIndex > 0 && options.forceQuoteColumns?.has(columnIndex) === true))
    .join(',')).join('\n')}\n`;
}

function csvValue(value: string, forceQuote = false) {
  const normalizedValue = value ?? '';
  const mustQuote = forceQuote || /[",\r\n]/.test(normalizedValue);
  const escaped = normalizedValue.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function buildMermaidNodeIdMap(profiles: CharacterProfile[]) {
  return new Map(profiles.map((profile, index) => [
    profile.id,
    `node_${index + 1}_${shortStableId(profile.id)}`,
  ]));
}

function shortStableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function escapeMermaidLabel(value: string) {
  return value.replace(/["|<>\r\n]/g, ' ').trim();
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

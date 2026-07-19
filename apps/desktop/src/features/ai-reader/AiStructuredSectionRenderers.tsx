import { Fragment, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';
import { renderBlockPlainText, type AiProtocolCitation, type AiResponseBlock, type AiToolCall, type AiToolResult, type BookMindAiStructuredResponse } from '../../services/aiResponseProtocol';
import { saveGeneratedFlashcards } from '../../services/noteService';
import { saveReaderRecord } from '../../services/readerStorageService';
import { emitFlashcardsUpdated } from '../../services/appDomainEvents';
import type { AiGeneratedFlashcardRequest, Citation } from '../../types';
import { isRuntimeAgentTimeline } from '../../app/agentLoopModel';
import { buildMarkdownReaderDocument, type MarkdownInlineSegment, type MarkdownReaderBlock } from '../reader-core/markdownReaderModel';
import { AiCitationActionIcon, type AiCitationActionIconName } from './icons';
import {
  emitAiCitationRepair,
  emitAiForeshadowFollowUp,
  emitAiProtocolCitationDetail,
  emitAiProtocolJump,
  emitAiToolCall,
  emitAiToolResultRender,
  emitChapterTimelineUpdated,
} from './aiReaderDomainEvents';

export type AiStructuredFlashcardDefaults = { tags: string; reviewStatus: 'new' | 'due' | 'reviewed' };

const defaultFlashcardDefaults: AiStructuredFlashcardDefaults = {
  tags: '',
  reviewStatus: 'new',
};

type ParagraphWindowToolSurface = 'selection_explanation' | 'annotation_preview' | 'citation_expansion';
type AgentTimelineEvent = Record<string, unknown>;
type MergedAgentTimelineEvent = AgentTimelineEvent & {
  kind?: string;
  requestPayload?: unknown;
  resultPayload?: unknown;
  requestContent?: string;
  resultContent?: string;
};

export function renderToolRail(toolItems: Array<{ kind: 'call' | 'result'; item: AiToolCall | AiToolResult }>, toolCallDisplayMode: 'hidden' | 'summary' | 'full') {
  if (toolCallDisplayMode === 'hidden') return null;
  if (!toolItems.length) return null;
  return (
    <div className="ai-tool-rail">
      {toolItems.map(({ kind, item }) => (
        <ToolRailItem kind={kind} item={item} displayMode={toolCallDisplayMode} key={`${kind}-${item.id}`} />
      ))}
    </div>
  );
}

export function StructuredReplyFoldSections({ response }: { response: BookMindAiStructuredResponse }) {
  const { t } = useI18n();
  const summaryItems = uniqueFoldItems([
    response.summary,
    ...response.blocks
      .filter((block) => block.type === 'chapter_summary' || block.type === 'summary' || block.type === 'character_table')
      .map(renderBlockPlainText),
  ]);
  const evidenceItems = uniqueFoldItems([
    ...response.citations.map((citation) => citation.quote ?? citation.label ?? citation.id),
    ...response.toolResults.map((result) => result.summary ?? result.tool),
  ]);
  const actionItems = uniqueFoldItems([
    ...response.actions.map((action) => action.label ?? action.action),
    ...response.blocks.filter((block) => block.type === 'actions' || block.type === 'suggested_actions').flatMap((block) => Array.isArray(block.items) ? block.items.map((item) => item?.label ?? item?.action ?? item) : []),
  ]);
  const questionItems = uniqueFoldItems(response.blocks.flatMap((block) => Array.isArray(block.openQuestions) ? block.openQuestions.map(String) : []));
  return (
    <div className="ai-reply-fold-sections">
      <FoldSection className="ai-fold-summary" title={t('ai.structured.fold.summary')} items={summaryItems} defaultOpen />
      <FoldSection className="ai-fold-evidence" title={t('ai.structured.fold.evidence')} items={evidenceItems} />
      <FoldSection className="ai-fold-actions" title={t('ai.structured.fold.actions')} items={actionItems} />
      <FoldSection className="ai-fold-questions" title={t('ai.structured.fold.questions')} items={questionItems} />
    </div>
  );
}

function uniqueFoldItems(items: unknown[]) {
  const seen = new Set<string>();
  return items
    .filter(Boolean)
    .map(formatFoldItem)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function formatFoldItem(item: unknown): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : null;
  if (record) {
    for (const key of ['label', 'action', 'title', 'text', 'content', 'summary', 'question', 'answer']) {
      if (record[key] !== undefined) return formatFoldItem(record[key]);
    }
  }
  try {
    return JSON.stringify(item);
  } catch {
    return '';
  }
}

function FoldSection({ className, title, items, defaultOpen = false }: { className: string; title: string; items: string[]; defaultOpen?: boolean }) {
  if (!items.length) return null;
  return (
    <details className={`ai-fold-section ${className}`} open={defaultOpen}>
      <summary>{title}<span>{items.length}</span></summary>
      <ul>{items.slice(0, 6).map((item, index) => <li key={index}><InlineMarkdownText text={item} /></li>)}</ul>
    </details>
  );
}

function ToolRailItem({ kind, item, displayMode }: { kind: 'call' | 'result'; item: AiToolCall | AiToolResult; displayMode: 'summary' | 'full' }) {
  const { t } = useI18n();
  const isResult = kind === 'result';
  const result = isResult ? item as AiToolResult : null;
  const rawPayload = JSON.stringify(item, null, 2);
  const isLong = rawPayload.length > 1200;
  const visiblePayload = isLong ? `${rawPayload.slice(0, 1200)}\n...` : rawPayload;
  const derivedCitations = result ? toolResultToCitations(result, (count) => t('ai.structured.toolResultNumber', { count })) : [];
  const summaryText = isResult ? result?.summary : (item as AiToolCall).reason;
  const toolCallDisplayMode = displayMode;
  return (
    <details className="ai-tool-card collapsed">
      <summary><span>{kind === 'call' ? t('ai.structured.toolCall') : t('ai.structured.toolResult')}：{item.tool}</span><b>{item.status}</b></summary>
      {toolCallDisplayMode === 'summary' ? <p className="ai-tool-summary">{summaryText || t('ai.structured.toolCollapsed', { content: kind === 'call' ? t('ai.structured.requestPayload') : t('ai.structured.resultContent') })}</p> : null}
      <div className="ai-tool-card-actions">
        {result ? <button type="button" onClick={() => sendToolResultToRenderer(result, (count) => t('ai.structured.toolResultNumber', { count }))}>{t('ai.structured.sendToRenderer')}</button> : null}
        {derivedCitations.length ? <button type="button" onClick={() => copyToolCitations(derivedCitations)}>{t('ai.structured.generateCitations')}</button> : null}
      </div>
      {toolCallDisplayMode === 'full' ? (
        <>
          {isLong ? <p className="ai-tool-truncation">{t('ai.structured.toolTruncated', { count: 1200 })}</p> : null}
          <div className="ai-tool-result-viewer">
            <pre>{visiblePayload}</pre>
          </div>
          {isLong ? <details className="ai-tool-view-all"><summary>{t('ai.structured.viewAll')}</summary><pre>{rawPayload}</pre></details> : null}
        </>
      ) : null}
      {derivedCitations.length ? <div className="ai-tool-citations">{derivedCitations.map((citation) => <ProtocolCitationCard citation={citation} key={citation.id} />)}</div> : null}
    </details>
  );
}

function toolResultToCitations(result: AiToolResult, fallbackLabel: (count: number) => string): AiProtocolCitation[] {
  const content = result.content as { results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | undefined;
  const rows = Array.isArray(content) ? content : Array.isArray(content?.results) ? content.results : [];
  return rows.slice(0, 8).map((row, index) => ({
    id: `${result.id}_c${index + 1}`,
    type: 'search_result',
    label: String(row.label ?? row.chapter ?? row.bookTitle ?? fallbackLabel(index + 1)),
    quote: String(row.snippet ?? row.quote ?? row.text ?? result.summary ?? ''),
    chunkId: row.chunkId ? String(row.chunkId) : undefined,
    score: typeof row.score === 'number' ? row.score : undefined,
    toolResultId: result.id,
  }));
}

function sendToolResultToRenderer(result: AiToolResult, fallbackLabel: (count: number) => string) {
  const citations = toolResultToCitations(result, fallbackLabel);
  emitAiToolResultRender({
    schema: 'bookmind.ai.response.v1',
    title: result.summary ?? result.tool,
    blocks: [{ id: `${result.id}_block`, type: 'answer', title: result.tool, content: result.summary ?? '', citationIds: citations.map((citation) => citation.id) }],
    citations,
  });
}

function copyToolCitations(citations: AiProtocolCitation[]) {
  void navigator.clipboard?.writeText(JSON.stringify(citations, null, 2));
}

export function AiProtocolBlock({ block, citations = [], flashcardDefaults, runSafeAction }: { block: AiResponseBlock; citations?: BookMindAiStructuredResponse['citations']; flashcardDefaults: AiStructuredFlashcardDefaults; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  switch (block.type) {
    case 'answer':
    case 'paragraph':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.answer')} citations={citations} hideHeaderCitations><AnswerParagraphsWithCitations block={block} citations={citations} /></ProtocolCard>;
    case 'heading':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.heading')} citations={citations} hideHeaderCitations><h3><InlineMarkdownText text={String(block.content ?? block.title ?? '')} /></h3></ProtocolCard>;
    case 'quote':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.quote')} citations={citations}><blockquote><InlineMarkdownText text={String(block.content ?? renderBlockPlainText(block))} /></blockquote></ProtocolCard>;
    case 'bullet_list':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.list')} citations={citations}>{renderBulletList(block.items, citations)}</ProtocolCard>;
    case 'citation_group':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.citationCandidates')} citations={citations}>{renderCitationCandidateGroup(block, t)}</ProtocolCard>;
    case 'agent_timeline':
      return <AgentTimelineBlock block={block} />;
    case 'evidence_list':
      return <EvidenceListBlock block={block} citations={citations} />;
    case 'diagnostics':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.diagnostics')} citations={citations}><details open={false}><summary>{t('ai.structured.viewDiagnostics')}</summary><pre>{JSON.stringify(block, null, 2)}</pre></details></ProtocolCard>;
    case 'summary':
    case 'chapter_summary':
      return <ChapterSummaryBlock block={block} citations={citations} runSafeAction={runSafeAction} />;
    case 'annotation':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.annotation', { type: String(block.annotationType ?? 'note') })} citations={citations}><p><InlineMarkdownText text={String(block.note ?? renderBlockPlainText(block))} /></p>{renderTags(block.tags)}<div className="ai-block-actions"><button type="button" onClick={() => runSafeAction('create_annotation_preview')}>{block.target ? t('ai.structured.writeAnnotation') : t('ai.structured.saveFloatingNote')}</button><button type="button" onClick={() => runSafeAction('explain_selection_with_window')}>{t('ai.structured.explainSelection')}</button></div></ProtocolCard>;
    case 'chapter_reference':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.relatedChapter')} citations={citations}><p><InlineMarkdownText text={String(block.reason ?? renderBlockPlainText(block))} /></p><div className="ai-block-actions"><button type="button" disabled={!chapterRefBlockToReaderCitation(block, citations)} onClick={() => jumpChapterReferenceBlock(block, citations)}>{t('ai.structured.jumpChapter')}</button><button type="button" onClick={() => runSafeAction('save_note_preview')}>{t('ai.structured.linkRelatedChapter')}</button></div></ProtocolCard>;
    case 'paragraph_reference':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.evidenceNote')} citations={citations}><blockquote><InlineMarkdownText text={String((block.target as { quote?: unknown } | undefined)?.quote ?? block.why ?? t('ai.structured.citationFieldsMissing'))} /></blockquote><p><InlineMarkdownText text={String(block.why ?? '')} /></p><ParagraphReferenceContext block={block} /><div className="ai-block-actions"><button type="button" disabled={!paragraphRefBlockToReaderCitation(block)} onClick={() => jumpParagraphReferenceBlock(block)}>{t('ai.citationCard.jump')}</button><button type="button" onClick={() => dispatchParagraphWindowToolCall(buildParagraphWindowToolCall('citation_expansion', block.target as AiProtocolCitation | undefined))}>{t('ai.structured.expandContext')}</button><button type="button" onClick={() => runSafeAction('save_note_preview')}>{t('ai.saveHighlight')}</button></div></ProtocolCard>;
    case 'character_table':
    case 'character_relationships':
      return <CharacterRelationshipsBlock block={block} citations={citations} runSafeAction={runSafeAction} />;
    case 'foreshadowing_list':
    case 'foreshadowing':
      return <ForeshadowingBlock block={block} citations={citations} runSafeAction={runSafeAction} />;
    case 'timeline':
      return <TimelineBlock block={block} citations={citations} runSafeAction={runSafeAction} />;
    case 'flashcards':
      return <FlashcardsBlock block={block} citations={citations} flashcardDefaults={flashcardDefaults} runSafeAction={runSafeAction} />;
    case 'table':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.table')} citations={citations}>{renderTable(block, citations, t)}<button type="button" onClick={() => copyMarkdownTable(block)}>{t('ai.structured.copyMarkdownTable')}</button></ProtocolCard>;
    case 'suggested_actions':
    case 'actions':
      return <ProtocolCard block={block} title={block.title ?? t('ai.structured.block.actions')} citations={citations}>{renderActions(block.items, runSafeAction, t)}</ProtocolCard>;
    default:
      return <ProtocolCard block={block} title={block.title ?? block.type} citations={citations}><p>{renderBlockPlainText(block)}</p></ProtocolCard>;
  }
}

function ProtocolCard({ block, title, citations = [], children, hideHeaderCitations = false }: { block: AiResponseBlock; title: string; citations?: BookMindAiStructuredResponse['citations']; children: ReactNode; hideHeaderCitations?: boolean }) {
  return <section className={`ai-block-card block-${block.type}`}><header><strong>{title}</strong>{!hideHeaderCitations && block.citationIds?.length ? <CitationMarkers citationIds={block.citationIds} citations={citations} /> : null}</header>{children}</section>;
}

function AgentTimelineBlock({ block }: { block: AiResponseBlock }) {
  const { t } = useI18n();
  const events = Array.isArray(block.events) ? block.events : [];
  if (!isRuntimeAgentTimeline(events)) {
    return (
      <section className="ai-agent-timeline legacy" aria-label={t('ai.structured.legacyTimelineAria')}>
        <header><strong>{t('ai.structured.legacyTimeline')}</strong><span>{t('ai.structured.count', { count: events.length })}</span></header>
        <p>{t('ai.structured.legacyTimelineDescription')}</p>
      </section>
    );
  }
  const visibleEvents = mergeAgentTimelineToolEvents(events, t);
  return (
    <section className="ai-agent-timeline" aria-label={t('ai.structured.agentTimelineAria')}>
      <header><strong>{block.title ?? t('ai.structured.agentTimeline')}</strong><span>{t('ai.structured.steps', { count: visibleEvents.length })}</span></header>
      <ol>
        {visibleEvents.map((rawEvent, index) => {
          const event = asRecord(rawEvent);
          if (!event) return null;
          const kind = String(event?.kind ?? 'step');
          const status = String(event?.status ?? 'ready');
          const title = String(event?.title ?? t('ai.structured.stepNumber', { count: index + 1 }));
          const content = String(event?.content ?? '');
          const payload = event?.payload;
          const eventClassName = kind === 'tool_exchange' ? 'event-tool_exchange' : `event-${kind}`;
          return (
            <li className={`agent-event ${eventClassName}`} key={String(event?.id ?? index)}>
              <i aria-hidden="true">{index + 1}</i>
              <div>
                <strong>{title}</strong>
                {content ? <p><InlineMarkdownText text={content} /></p> : null}
                {kind === 'tool_exchange' ? <AgentToolExchangeDetails event={event} /> : payload !== undefined ? <details><summary>{t('ai.structured.viewData')}</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details> : null}
              </div>
              <em>{status}</em>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function mergeAgentTimelineToolEvents(events: unknown[], t: ReturnType<typeof useI18n>['t']): MergedAgentTimelineEvent[] {
  const merged: MergedAgentTimelineEvent[] = [];
  const consumed = new Set<number>();
  events.forEach((rawEvent, index) => {
    if (consumed.has(index)) return;
    const event = asRecord(rawEvent);
    if (!event) return;
    if (event.kind !== 'tool_call') {
      merged.push(event);
      return;
    }
    const tool = String(event.tool ?? '');
    const resultIndex = events.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index || consumed.has(candidateIndex)) return false;
      const result = asRecord(candidate);
      return result?.kind === 'tool_result' && String(result.tool ?? '') === tool;
    });
    const result = resultIndex >= 0 ? asRecord(events[resultIndex]) : null;
    if (resultIndex >= 0) consumed.add(resultIndex);
    const resultContent = String(result?.content ?? '').trim();
    merged.push({
      ...event,
      id: String(event.id ?? `agent_tool_exchange_${index + 1}`),
      kind: 'tool_exchange',
      title: t('ai.structured.toolCallTitle', { tool: tool || 'unknown' }),
      status: String(result?.status ?? event.status ?? 'running'),
      content: resultContent ? `${String(event.content ?? '').trim()}\n${resultContent}`.trim() : event.content,
      requestPayload: event.payload,
      resultPayload: result?.payload,
      requestContent: String(event.content ?? ''),
      resultContent,
    });
  });
  return merged;
}

function AgentToolExchangeDetails({ event }: { event: Record<string, unknown> }) {
  const { t } = useI18n();
  return (
    <>
      <details><summary>{t('ai.structured.requestData')}</summary><pre>{JSON.stringify(event.requestPayload ?? {}, null, 2)}</pre></details>
      <details><summary>{t('ai.structured.resultData')}</summary><pre>{JSON.stringify(event.resultPayload ?? {}, null, 2)}</pre></details>
    </>
  );
}

function ChapterSummaryBlock({ block, citations, runSafeAction }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations']; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  const jumpTarget = chapterRefBlockToReaderCitation(block, citations);
  return (
    <ProtocolCard block={block} title={block.title ?? t('ai.structured.chapterReport')} citations={citations}>
      {renderChapterSummaryBullets(block.bullets, citations, runSafeAction, t('ai.saveExcerpt'))}
      {renderStringList(block.openQuestions, t('ai.structured.fold.questions'))}
      {jumpTarget ? (
        <div className="ai-block-actions">
          <button type="button" onClick={() => jumpChapterReferenceBlock(block, citations)}>{t('ai.structured.jumpCitationPosition')}</button>
        </div>
      ) : null}
    </ProtocolCard>
  );
}

function EvidenceListBlock({ block, citations }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations'] }) {
  const { t } = useI18n();
  const items = Array.isArray(block.items) ? block.items : [];
  return (
    <ProtocolCard block={block} title={block.title ?? t('ai.structured.evidenceChain')} citations={citations}>
      <div className="ai-evidence-list">
        {items.map((rawItem, index) => {
          const item = asRecord(rawItem);
          const references = Array.isArray(item?.references) ? item.references : [];
          const citationIds = Array.isArray(item?.citationIds) ? item.citationIds.map(String) : [];
          return (
            <article className="ai-evidence-item" key={String(item?.id ?? index)}>
              <strong><InlineMarkdownText text={String(item?.claim ?? t('ai.structured.evidenceNumber', { count: index + 1 }))} /></strong>
              <CitationMarkers citationIds={citationIds} citations={citations} />
              <div className="ai-evidence-reference-grid">
                {references.map((rawReference, referenceIndex) => {
                  const reference = asRecord(rawReference);
                  return (
                    <blockquote key={String(reference?.id ?? referenceIndex)}>
                      <p><InlineMarkdownText text={String(reference?.quote ?? '')} /></p>
                      <small>{[reference?.locationHint, reference?.tool].filter(Boolean).map(String).join(' · ')}</small>
                    </blockquote>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </ProtocolCard>
  );
}

function TimelineBlock({ block, citations, runSafeAction }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations']; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  const [timelineOrder, setTimelineOrder] = useState<'event' | 'chapter'>('event');
  const events = useMemo(() => {
    const rows = Array.isArray(block.events) ? [...block.events] : [];
    if (timelineOrder === 'chapter') {
      rows.sort((left, right) => getTimelineChapterOrder(left) - getTimelineChapterOrder(right));
    }
    return rows;
  }, [block.events, timelineOrder]);
  async function syncTimelineToChapterTimeline() {
    const records = timelineEventsToChapterTimelineRecords(block);
    const bookId = records.find((record) => record.bookId)?.bookId ?? String((block.chapterRef as Record<string, unknown> | undefined)?.bookId ?? '');
    if (!bookId || !records.length) return;
    await saveReaderRecord(bookId, 'chapterTimeline', records);
    emitChapterTimelineUpdated({ bookId, records });
    runSafeAction('save_note_preview');
  }
  return (
    <ProtocolCard block={block} title={block.title ?? t('ai.structured.timeline')} citations={citations}>
      <div className="ai-timeline-order-toggle" role="group" aria-label={t('ai.structured.timelineOrder')}>
        <button type="button" className={timelineOrder === 'event' ? 'active' : ''} aria-pressed={timelineOrder === 'event'} onClick={() => setTimelineOrder('event')}>{t('ai.structured.eventOrder')}</button>
        <button type="button" className={timelineOrder === 'chapter' ? 'active' : ''} aria-pressed={timelineOrder === 'chapter'} onClick={() => setTimelineOrder('chapter')}>{t('ai.structured.chapterOrder')}</button>
      </div>
      {renderTimeline(events, t, { hideKind: isLooseCommandBlock(block) })}
      {isTimelineSyncAvailable(block) ? <button type="button" onClick={() => { void syncTimelineToChapterTimeline(); }}>{t('ai.structured.syncChapterTimeline')}</button> : null}
    </ProtocolCard>
  );
}

function timelineEventsToChapterTimelineRecords(block: AiResponseBlock) {
  const events = Array.isArray(block.events) ? block.events : [];
  return events.flatMap((item, index) => {
    const event = item as Record<string, unknown> | null;
    const chapterRef = event?.chapterRef as Record<string, unknown> | undefined;
    const fallbackChapterRef = block.chapterRef as Record<string, unknown> | undefined;
    const bookId = String(chapterRef?.bookId ?? fallbackChapterRef?.bookId ?? '');
    const chapterId = String(chapterRef?.chapterId ?? fallbackChapterRef?.chapterId ?? '');
    const sourceChapterIndex = typeof chapterRef?.sourceChapterIndex === 'number'
      ? chapterRef.sourceChapterIndex
      : typeof fallbackChapterRef?.sourceChapterIndex === 'number'
        ? fallbackChapterRef.sourceChapterIndex
        : undefined;
    const text = String(event?.event ?? event?.summary ?? event?.text ?? '').trim();
    if (!text) return [];
    return [{
      id: String(event?.id ?? `${block.id}-timeline-${index + 1}`),
      bookId,
      chapterId,
      sourceChapterIndex,
      order: typeof event?.order === 'number' ? event.order : index + 1,
      timeLabel: String(event?.timeLabel ?? event?.time ?? index + 1),
      event: text,
      kind: String(event?.kind ?? 'happened'),
      citationIds: Array.isArray(event?.citationIds) ? event.citationIds.map(String) : block.citationIds ?? [],
      syncedAt: new Date().toISOString(),
    }];
  });
}

function FlashcardsBlock({ block, citations, flashcardDefaults, runSafeAction }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations']; flashcardDefaults: AiStructuredFlashcardDefaults; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  const cards = Array.isArray(block.cards) ? block.cards : [];
  async function saveCards(cardItems: unknown[]) {
    const requests = blockFlashcardsToGeneratedRequests(cardItems, flashcardDefaults, {
      withCitations: (citations) => t('ai.structured.generatedCardWithCitations', { citations }),
      numbered: (count) => t('ai.structured.generatedCardNumber', { count }),
    });
    if (!requests.length) return;
    await saveGeneratedFlashcards(requests);
    emitFlashcardsUpdated();
    runSafeAction('create_flashcards_preview');
  }
  return (
    <ProtocolCard block={block} title={block.title ?? t('ai.structured.flashcards')} citations={citations}>
      <div className="ai-flashcard-grid">
        {cards.map((item, index) => (
          <article key={index}>
            <strong><InlineMarkdownText text={String(item?.front ?? t('ai.structured.question'))} /></strong>
            <p><InlineMarkdownText text={String(item?.back ?? '')} /></p>
            {renderTags(item?.tags)}
            {item?.citationSource ? <blockquote><InlineMarkdownText text={String(item.citationSource)} /></blockquote> : null}
            {!item?.citationIds?.length ? <em className="citation-field-missing">{t('ai.structured.citationsMissing')}</em> : null}
            <button className="confirmable-preview-action" type="button" onClick={() => { void saveCards([item]); }}>{t('ai.structured.addCard')}</button>
          </article>
        ))}
      </div>
      <button className="confirmable-preview-action" type="button" onClick={() => { void saveCards(cards); }}>{t('ai.structured.addAllCards')}</button>
    </ProtocolCard>
  );
}

function blockFlashcardsToGeneratedRequests(cards: unknown[], defaults: AiStructuredFlashcardDefaults = defaultFlashcardDefaults, labels: { withCitations: (citations: string) => string; numbered: (count: number) => string }): AiGeneratedFlashcardRequest[] {
  const defaultTags = splitFlashcardDefaultTags(defaults.tags);
  return cards.flatMap((item, index) => {
    const card = item as Record<string, unknown> | null;
    const front = String(card?.front ?? '').trim();
    const back = String(card?.back ?? '').trim();
    if (!front || !back) return [];
    const citationIds = Array.isArray(card?.citationIds) ? card.citationIds.map(String) : [];
    return [{
      front,
      back,
      sourceLabel: citationIds.length ? labels.withCitations(citationIds.join(', ')) : labels.numbered(index + 1),
      sourceTargetId: citationIds.length ? `ai:${citationIds.join(',')}` : `ai:flashcard:${index + 1}`,
      tags: mergeFlashcardTags(defaultTags, Array.isArray(card?.tags) ? card.tags.map(String) : []),
      citationIds,
      chapter: typeof card?.chapter === 'string' ? card.chapter : undefined,
      reviewStatus: defaults.reviewStatus,
    }];
  });
}

function splitFlashcardDefaultTags(value: string) {
  return value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean);
}

function mergeFlashcardTags(defaultTags: string[], cardTags: string[]) {
  return Array.from(new Set([...defaultTags, ...cardTags.map((tag) => tag.trim()).filter(Boolean)])).slice(0, 12);
}

function CharacterRelationshipsBlock({ block, citations, runSafeAction }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations']; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  return (
    <ProtocolCard block={block} title={block.title ?? t('ai.structured.characterRelationships')} citations={citations}>
      {renderCharacterStatusRows(block.rows, citations, t)}
      {renderCharacterFactions(block.factions, t)}
      {renderCharacters(block.characters)}
      {renderRelationships(block.relationships, t)}
      {renderRelationshipChangeRecords(block.relationships, t('ai.structured.relationshipChangeRecords'))}
      {isLooseCommandBlock(block) ? null : <ConfirmablePreviewAction label={t('ai.structured.syncCharacterPreview')} action="link_character_relationships_preview" runSafeAction={runSafeAction} />}
    </ProtocolCard>
  );
}

function ForeshadowingBlock({ block, citations, runSafeAction }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations']; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  return (
    <ProtocolCard block={block} title={block.title ?? t('ai.structured.foreshadowing')} citations={citations}>
      {renderForeshadowing(block.items, citations, runSafeAction, t, { hideActions: isLooseCommandBlock(block) })}
      {isLooseCommandBlock(block) ? null : <ConfirmablePreviewAction label={t('ai.structured.markAllPending')} action="save_note_preview" runSafeAction={runSafeAction} />}
    </ProtocolCard>
  );
}

function isLooseCommandBlock(block: AiResponseBlock) {
  return block.source === 'loose_command' || String(block.id ?? '').startsWith('blk_loose_');
}

function isTimelineSyncAvailable(block: AiResponseBlock) {
  if (isLooseCommandBlock(block)) return false;
  const chapterRef = block.chapterRef as Record<string, unknown> | undefined;
  return Boolean(chapterRef?.bookId || chapterRef?.chapterId || chapterRef?.sourceChapterIndex !== undefined);
}

function renderRelationshipChangeRecords(value: unknown, title: string) {
  if (!Array.isArray(value)) return null;
  const changes = value.filter((item) => {
    const status = String(item?.status ?? '');
    return status === 'changed' || Boolean(item?.previousStatus) || Boolean(item?.changeSummary);
  });
  if (!changes.length) return null;
  return (
    <div className="relationship-change-record">
      <strong>{title}</strong>
      {changes.map((item, index) => (
        <p key={index}>{String(item?.from ?? '?')} → {String(item?.to ?? '?')} · {String(item?.changeSummary ?? item?.label ?? item?.status ?? 'changed')}</p>
      ))}
    </div>
  );
}

function ConfirmablePreviewAction({ label, action, runSafeAction }: { label: string; action: string; runSafeAction: (action?: string) => void }) {
  const { t } = useI18n();
  return <button className="confirmable-preview-action" type="button" onClick={() => runSafeAction(action)}>{t('ai.structured.confirmPreviewAction', { label })}</button>;
}

function getTimelineChapterOrder(value: unknown) {
  const item = value as Record<string, unknown> | null;
  const chapterRef = item?.chapterRef as Record<string, unknown> | undefined;
  if (typeof chapterRef?.sourceChapterIndex === 'number') return chapterRef.sourceChapterIndex;
  if (typeof item?.order === 'number') return item.order;
  return Number.MAX_SAFE_INTEGER;
}

function renderChapterSummaryBullets(value: unknown, citations: BookMindAiStructuredResponse['citations'], runSafeAction: (action?: string) => void, saveLabel: string) {
  if (!Array.isArray(value)) return null;
  return (
    <ul className="ai-chapter-summary-bullets">
      {value.map((item, index) => (
        <li key={index}>
          <span><InlineMarkdownText text={String(item?.text ?? item)} /></span>
          {item?.importance ? <em>{String(item.importance)}</em> : null}
          <CitationMarkers citationIds={item?.citationIds} citations={citations} />
          <button type="button" onClick={() => runSafeAction('save_note_preview')}>{saveLabel}</button>
        </li>
      ))}
    </ul>
  );
}

function AnswerParagraphsWithCitations({ block, citations }: { block: AiResponseBlock; citations: BookMindAiStructuredResponse['citations'] }) {
  const content = String(block.content ?? renderBlockPlainText(block));
  return <RichMarkdownText text={content} blockId={block.id} citationIds={block.citationIds} citations={citations} />;
}

export function RichMarkdownText({ text, blockId = 'rich-text', citationIds = [], citations = [] }: { text: string; blockId?: string; citationIds?: string[]; citations?: BookMindAiStructuredResponse['citations'] }) {
  const markdownBlocks = useMemo(() => buildMarkdownReaderDocument(text).blocks, [text]);
  const visibleBlocks = markdownBlocks.length ? markdownBlocks : [{ type: 'paragraph', lineIndex: 0, segments: [{ kind: 'text', text }] } satisfies MarkdownReaderBlock];
  const lastBlockIndex = Math.max(0, visibleBlocks.length - 1);
  return (
    <div className="ai-answer-paragraphs ai-rich-markdown">
      {visibleBlocks.map((markdownBlock, index) => {
        const blockCitationIds = visibleBlocks.length === citationIds.length
          ? [citationIds[index]].filter(Boolean)
          : index === lastBlockIndex
            ? citationIds
            : [];
        return (
          <div className={`ai-rich-markdown-block type-${markdownBlock.type}`} key={`${blockId}-${markdownBlock.lineIndex}-${index}`}>
            {renderAiMarkdownBlock(markdownBlock)}
            <CitationMarkers citationIds={blockCitationIds} citations={citations} />
          </div>
        );
      })}
    </div>
  );
}

function renderAiMarkdownBlock(block: MarkdownReaderBlock): ReactNode {
  switch (block.type) {
    case 'heading':
      return renderAiMarkdownHeading(block);
    case 'paragraph':
      return <p>{renderAiMarkdownSegments(block.segments)}</p>;
    case 'code':
      return <pre className="ai-rich-code"><code data-language={block.language}>{block.code}</code></pre>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={block.task ? 'ai-rich-task-list' : undefined}>
          {block.items.map((item, index) => (
            <li className={typeof item.checked === 'boolean' ? 'ai-rich-task-item' : undefined} key={index}>
              {typeof item.checked === 'boolean' ? <input type="checkbox" checked={item.checked} readOnly aria-hidden="true" tabIndex={-1} /> : null}
              <span>{renderAiMarkdownSegments(item.segments)}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div className="ai-rich-table-wrap">
          <table>
            <thead><tr>{block.headers.map((cell, index) => <th className={`align-${block.alignments[index]}`} key={index}>{renderAiMarkdownSegments(cell)}</th>)}</tr></thead>
            <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td className={`align-${block.alignments[cellIndex]}`} key={cellIndex}>{renderAiMarkdownSegments(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'blockquote':
      return <blockquote>{renderAiMarkdownSegments(block.segments)}</blockquote>;
    case 'divider':
      return <hr />;
    default:
      return null;
  }
}

function renderAiMarkdownHeading(block: Extract<MarkdownReaderBlock, { type: 'heading' }>) {
  const content = renderAiMarkdownSegments(block.segments);
  if (block.level === 1) return <h1>{content}</h1>;
  if (block.level === 2) return <h2>{content}</h2>;
  if (block.level === 3) return <h3>{content}</h3>;
  if (block.level === 4) return <h4>{content}</h4>;
  if (block.level === 5) return <h5>{content}</h5>;
  return <h6>{content}</h6>;
}

function renderAiMarkdownSegments(segments: MarkdownInlineSegment[]): ReactNode {
  return segments.map((segment, index) => {
    if (segment.kind === 'strong') return <strong key={index}><InlineMarkdownText text={segment.text} /></strong>;
    if (segment.kind === 'emphasis') return <em key={index}><InlineMarkdownText text={segment.text} /></em>;
    if (segment.kind === 'code') return <code key={index}>{segment.text}</code>;
    if (segment.kind === 'break') return <br key={index} />;
    if (segment.kind === 'link') {
      const href = resolveSafeAiMarkdownLink(segment.href);
      return href ? <a href={href} target="_blank" rel="noreferrer" key={index}>{renderAiMarkdownSegments(segment.segments)}</a> : <InlineMarkdownText text={segment.text} key={index} />;
    }
    if (segment.kind === 'image') {
      const src = resolveSafeAiMarkdownImage(segment.src);
      return src ? <img src={src} alt={segment.alt} title={segment.title} loading="lazy" referrerPolicy="no-referrer" key={index} /> : <InlineMarkdownText text={segment.alt || segment.text} key={index} />;
    }
    return <InlineMarkdownText text={segment.text} key={index} />;
  });
}

function resolveSafeAiMarkdownLink(value: string) {
  const href = value.trim();
  return /^(https?:|mailto:)/iu.test(href) ? href : '';
}

function resolveSafeAiMarkdownImage(value: string) {
  const src = value.trim();
  return /^(https?:|data:image\/(?:png|jpe?g|gif|webp);base64,|blob:)/iu.test(src) ? src : '';
}

export function InlineMarkdownText({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text).map((node, index) => renderInlineMarkdownNode(node, index))}</>;
}

type InlineMarkdownNode = { kind: 'text' | 'strong' | 'em' | 'code' | 'mark' | 'underline' | 'strike' | 'small' | 'break'; text: string };

function parseInlineMarkdown(text: string): InlineMarkdownNode[] {
  const nodes: InlineMarkdownNode[] = [];
  const normalizedText = decodeInlineEntities(text);
  const pattern = /(<br\s*\/?>|<(b|strong|i|em|code|mark|u|s|del|small)>([\s\S]*?)<\/\2>|\*\*([\s\S]*?)\*\*|__([\s\S]*?)__|`([^`]+)`|\*([^*]+)\*)/giu;
  let cursor = 0;
  for (const match of normalizedText.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ kind: 'text', text: normalizedText.slice(cursor, index) });
    if (/^<br\s*\/?\s*>$/iu.test(match[1])) nodes.push({ kind: 'break', text: '' });
    else if (match[2]) nodes.push({ kind: inlineTagKind(match[2]), text: match[3] });
    else if (match[4] !== undefined) nodes.push({ kind: 'strong', text: match[4] });
    else if (match[5] !== undefined) nodes.push({ kind: 'strong', text: match[5] });
    else if (match[6] !== undefined) nodes.push({ kind: 'code', text: match[6] });
    else if (match[7] !== undefined) nodes.push({ kind: 'em', text: match[7] });
    cursor = index + match[0].length;
  }
  if (cursor < normalizedText.length) nodes.push({ kind: 'text', text: normalizedText.slice(cursor) });
  return nodes;
}

function renderInlineMarkdownNode(node: InlineMarkdownNode, index: number) {
  if (node.kind === 'strong') return <strong key={index}><InlineMarkdownText text={node.text} /></strong>;
  if (node.kind === 'em') return <em key={index}><InlineMarkdownText text={node.text} /></em>;
  if (node.kind === 'code') return <code key={index}>{node.text}</code>;
  if (node.kind === 'mark') return <mark key={index}><InlineMarkdownText text={node.text} /></mark>;
  if (node.kind === 'underline') return <u key={index}><InlineMarkdownText text={node.text} /></u>;
  if (node.kind === 'strike') return <del key={index}><InlineMarkdownText text={node.text} /></del>;
  if (node.kind === 'small') return <small key={index}><InlineMarkdownText text={node.text} /></small>;
  if (node.kind === 'break') return <br key={index} />;
  return <Fragment key={index}>{node.text}</Fragment>;
}

function inlineTagKind(tag: string): InlineMarkdownNode['kind'] {
  const normalized = tag.toLocaleLowerCase();
  if (normalized === 'b' || normalized === 'strong') return 'strong';
  if (normalized === 'i' || normalized === 'em') return 'em';
  if (normalized === 'code') return 'code';
  if (normalized === 'mark') return 'mark';
  if (normalized === 'u') return 'underline';
  if (normalized === 's' || normalized === 'del') return 'strike';
  return 'small';
}

function decodeInlineEntities(value: string) {
  return value
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&amp;/giu, '&');
}

function CitationMarkers({ citationIds, citations = [] }: { citationIds?: string[]; citations?: BookMindAiStructuredResponse['citations'] }) {
  if (!citationIds?.length) return null;
  return (
    <span className="citation-marker-row">
      {citationIds.map((id) => {
        const citation = citations.find((item) => item.id === id);
        return <CitationMarker id={id} citation={citation} key={id} />;
      })}
    </span>
  );
}

function CitationMarker({ id, citation }: { id: string; citation?: AiProtocolCitation }) {
  const { t } = useI18n();
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const [preview, setPreview] = useState<{ text: string; left: number; top: number; placement: 'top' | 'bottom' } | null>(null);
  const previewText = citation?.quote ?? citation?.snippet ?? citation?.sourceText ?? citation?.label ?? id;
  const readerCitation = citation ? protocolCitationToReaderCitation(citation) : null;
  function showPreview() {
    const marker = markerRef.current;
    if (!marker) return;
    const rect = marker.getBoundingClientRect();
    const maxWidth = Math.min(360, Math.max(220, window.innerWidth - 24));
    const estimatedHeight = Math.min(220, 46 + Math.ceil(previewText.length / 22) * 18);
    const topSpace = rect.top - 12;
    const placement = topSpace >= estimatedHeight ? 'top' : 'bottom';
    const left = Math.min(window.innerWidth - 12 - maxWidth / 2, Math.max(12 + maxWidth / 2, rect.left + rect.width / 2));
    const top = placement === 'top' ? Math.max(12, rect.top - 8) : Math.min(window.innerHeight - 12, rect.bottom + 8);
    setPreview({ text: previewText, left, top, placement });
  }
  function hidePreview() {
    setPreview(null);
  }
  function jumpToCitation() {
    if (!readerCitation) return;
    emitAiProtocolJump(readerCitation);
  }
  function handleMarkerKeyDown(event: ReactKeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!readerCitation) return;
    event.preventDefault();
    jumpToCitation();
  }
  return (
    <span className={readerCitation ? 'citation-marker jumpable' : 'citation-marker'} tabIndex={0} role={readerCitation ? 'button' : undefined} aria-label={readerCitation ? t('ai.structured.jumpCitationAria') : undefined} ref={markerRef} onMouseEnter={showPreview} onFocus={showPreview} onMouseLeave={hidePreview} onBlur={hidePreview} onClick={jumpToCitation} onKeyDown={handleMarkerKeyDown}>
      [{formatCitationMarkerId(id)}]
      {preview ? createPortal(
        <span className={`citation-marker-preview visible placement-${preview.placement}`} style={{ left: preview.left, top: preview.top }}>
          {preview.text}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}

export function formatCitationMarkerId(id: string) {
  const analysisCharacter = id.match(/^analysis_char_(\d+)(?:_(\d+))?$/);
  if (analysisCharacter) return analysisCharacter[2] ? `${analysisCharacter[1]}.${analysisCharacter[2]}` : analysisCharacter[1];
  const numeric = id.match(/(\d+)$/)?.[1];
  return numeric ?? id.replace(/^c/, '');
}

export function ProtocolCitationCard({
  citation,
  externalCitationsDisabled = true,
  citationJumpRepairEnabled = true,
  citationFieldStrictness = 'normal',
  onSaveProtocolDefault,
  onSaveProtocolHighlight,
  onSaveProtocolExcerpt
}: {
  citation: AiProtocolCitation;
  externalCitationsDisabled?: boolean;
  citationJumpRepairEnabled?: boolean;
  citationFieldStrictness?: 'lenient' | 'normal' | 'strict';
  onSaveProtocolDefault?: (citation: AiProtocolCitation) => void;
  onSaveProtocolHighlight?: (citation: AiProtocolCitation) => void;
  onSaveProtocolExcerpt?: (citation: AiProtocolCitation) => void;
}) {
  const { t } = useI18n();
  const canJump = citation.type === 'chapter' || citation.type === 'paragraph' || citation.type === 'range';
  const canOpenDetail = citation.type === 'note' || citation.type === 'highlight';
  const isExternal = citation.type === 'external';
  const readerCitation = protocolCitationToReaderCitation(citation);
  const knowledgeCitation = protocolCitationToKnowledgeCitation(citation);
  const externalBlocked = isExternal && externalCitationsDisabled;
  const canSaveKnowledgeCitation = Boolean(knowledgeCitation) && !externalBlocked;
  const missingFields = getMissingCitationFields(citation, citationFieldStrictness);
  const jumpDisabled = !canJump || !readerCitation || externalBlocked;
  const canRepairJump = citationJumpRepairEnabled && (!canJump || !readerCitation || missingFields.length > 0);
  const jumpLabel = canJump && !externalBlocked ? t('ai.citationCard.jump') : t('ai.citationCard.cannotJump');
  return (
    <article
      className={`citation-card protocol-citation citation-${citation.type ?? 'unknown'}${externalBlocked ? ' citation-external-disabled' : ''}`}
      data-target-id={readerCitation?.targetId}
    >
      <strong><CitationMarkers citationIds={[citation.id]} citations={[citation]} /> {citation.label ?? citation.type ?? t('ai.citationCard.fallbackLabel')}</strong>
      <p>{citation.quote ?? <span className="citation-field-missing">{t('ai.structured.citationFieldMissing', { fields: 'quote' })}</span>}</p>
      {typeof citation.confidence === 'number' || typeof citation.score === 'number' ? <span className="citation-search-score">{t('common.score')} {String(citation.score ?? citation.confidence)}</span> : null}
      {missingFields.length ? <small className="citation-field-missing">{t('ai.structured.citationFieldMissing', { fields: missingFields.join(', ') })}</small> : null}
      {citation.before || citation.after ? <details><summary>{t('ai.structured.context')}</summary><p>{[citation.before, citation.after].filter(Boolean).join('\n')}</p></details> : null}
      <div className="action-row citation-action-row" aria-label={t('ai.citationCard.actions')}>
        <CitationActionButton icon={jumpDisabled ? 'noDetail' : 'jumpSource'} label={jumpLabel} disabled={jumpDisabled} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && readerCitation && !jumpDisabled) emitAiProtocolJump(readerCitation); }} onClick={() => { if (readerCitation && !jumpDisabled) emitAiProtocolJump(readerCitation); }} />
        {canRepairJump ? <CitationActionButton className="citation-jump-repair" icon="repairJump" label={t('ai.structured.repairJump')} onClick={() => dispatchCitationRepair(citation, missingFields)} /> : null}
        <CitationActionButton icon="saveDefault" label={t('ai.citationCard.saveDefault')} disabled={!canSaveKnowledgeCitation || !onSaveProtocolDefault} onClick={() => onSaveProtocolDefault?.(citation)} />
        <CitationActionButton icon="saveHighlight" label={t('ai.saveHighlight')} disabled={!canSaveKnowledgeCitation || !onSaveProtocolHighlight} onClick={() => onSaveProtocolHighlight?.(citation)} />
        <CitationActionButton icon="saveExcerpt" label={t('ai.saveExcerpt')} disabled={!canSaveKnowledgeCitation || !onSaveProtocolExcerpt} onClick={() => onSaveProtocolExcerpt?.(citation)} />
        <CitationActionButton icon="expandContext" label={t('ai.structured.expandContext')} onClick={() => dispatchParagraphWindowToolCall(buildParagraphWindowToolCall('citation_expansion', citation))} />
        <CitationActionButton icon={canOpenDetail ? 'openDetail' : 'noDetail'} label={canOpenDetail ? t('ai.structured.openDetails') : t('ai.structured.noDetails')} disabled={!canOpenDetail} onClick={() => openProtocolCitationDetail(citation)} />
        {externalBlocked ? <CitationActionButton icon="externalBlocked" label={t('ai.structured.externalSourceDisabled')} disabled /> : null}
      </div>
    </article>
  );
}

function CitationActionButton({
  icon,
  label,
  className,
  disabled,
  onClick,
  onKeyDown,
}: {
  icon: AiCitationActionIconName;
  label: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={['citation-action-icon-btn', className].filter(Boolean).join(' ')}
      type="button"
      disabled={disabled}
      data-tooltip={label}
      aria-label={label}
      title={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <AiCitationActionIcon name={icon} />
    </button>
  );
}

export function buildParagraphWindowToolCall(surface: ParagraphWindowToolSurface, citation?: AiProtocolCitation) {
  return {
    tool: 'get_paragraph_window',
    surface,
    args: {
      chapterId: citation?.chapterId ?? citation?.sourceChapterIndex ?? '',
      paragraphIndex: Number(citation?.paragraphIndex ?? 0),
      before: 3,
      after: 3,
    },
    reason: surface === 'selection_explanation'
      ? 'Explain selected text with surrounding paragraphs.'
      : surface === 'annotation_preview'
        ? 'Preview annotation with paragraph context before writing.'
        : 'Expand citation evidence with before/after paragraph context.',
  };
}

export function dispatchParagraphWindowToolCall(toolCall: ReturnType<typeof buildParagraphWindowToolCall>) {
  emitAiToolCall(toolCall);
}

function dispatchCitationRepair(citation: AiProtocolCitation, missingFields: string[]) {
  emitAiCitationRepair({ citation, missingFields });
}

function protocolCitationToReaderCitation(citation: AiProtocolCitation): Citation | null {
  if (citation.type === 'external') return null;
  const text = citation.sourceText ?? citation.snippet ?? citation.quote ?? citation.label ?? '';
  const hasReaderLocation = Boolean(citation.chapterId)
    || typeof citation.sourceChapterIndex === 'number'
    || typeof citation.chapterIndex === 'number'
    || typeof citation.paragraphIndex === 'number'
    || Boolean(citation.chunkId)
    || Boolean(text.trim());
  if (!hasReaderLocation) return null;
  return {
    id: Number(String(citation.id).replace(/\D/g, '')) || 0,
    label: citation.label ?? citation.type ?? '引用',
    text,
    targetId: citation.chunkId ? String(citation.chunkId) : [citation.bookId, citation.chapterId, citation.paragraphIndex, citation.startOffset, citation.endOffset].filter((value) => value !== undefined && value !== '').join(':'),
    bookId: typeof citation.bookId === 'string' ? citation.bookId : undefined,
    chapterId: typeof citation.chapterId === 'string' ? citation.chapterId : undefined,
    chapterIndex: typeof citation.chapterIndex === 'number' ? citation.chapterIndex : undefined,
    sourceChapterIndex: typeof citation.sourceChapterIndex === 'number' ? citation.sourceChapterIndex : typeof citation.chapterIndex === 'number' ? citation.chapterIndex : undefined,
    paragraphIndex: typeof citation.paragraphIndex === 'number' ? citation.paragraphIndex : undefined,
    startOffset: typeof citation.startOffset === 'number' ? citation.startOffset : undefined,
    endOffset: typeof citation.endOffset === 'number' ? citation.endOffset : undefined,
    chunkId: typeof citation.chunkId === 'string' ? citation.chunkId : undefined,
    confidence: typeof citation.confidence === 'number' ? citation.confidence : typeof citation.score === 'number' ? citation.score : undefined,
  };
}

export function protocolCitationToKnowledgeCitation(citation: AiProtocolCitation): Citation | null {
  if (citation.type === 'external') return null;
  const text = citation.quote ?? citation.label ?? '';
  if (!text.trim()) return null;
  return {
    id: Number(String(citation.id).replace(/\D/g, '')) || 0,
    label: citation.label ?? citation.type ?? '引用',
    text,
    targetId: [citation.bookId, citation.chapterId, citation.paragraphIndex, citation.startOffset, citation.endOffset, citation.chunkId, citation.toolResultId, citation.id].filter((value) => value !== undefined && value !== '').join(':'),
  };
}

function chapterRefBlockToReaderCitation(block: AiResponseBlock, citations: BookMindAiStructuredResponse['citations'] = []): Citation | null {
  const chapterRef = block.chapterRef as Record<string, unknown> | undefined;
  if (chapterRef && typeof chapterRef === 'object') {
    const chapterId = typeof chapterRef.chapterId === 'string' ? chapterRef.chapterId : undefined;
    const sourceChapterIndex = typeof chapterRef.sourceChapterIndex === 'number' ? chapterRef.sourceChapterIndex : undefined;
    const chapterIndex = typeof chapterRef.chapterIndex === 'number' ? chapterRef.chapterIndex : undefined;
    if (chapterId || sourceChapterIndex !== undefined || chapterIndex !== undefined) {
      const label = String(chapterRef.chapterTitle ?? block.title ?? '章节');
      return {
        id: Number(sourceChapterIndex ?? chapterIndex ?? 0) + 1,
        label,
        text: String(block.reason ?? label),
        targetId: [chapterRef.bookId, chapterId, sourceChapterIndex ?? chapterIndex, 0].filter((value) => value !== undefined && value !== '').join(':'),
        bookId: typeof chapterRef.bookId === 'string' ? chapterRef.bookId : undefined,
        chapterId,
        chapterIndex,
        sourceChapterIndex: sourceChapterIndex ?? chapterIndex,
        paragraphIndex: 0,
      };
    }
  }
  return firstBlockCitationToReaderCitation(block, citations);
}

function firstBlockCitationToReaderCitation(block: AiResponseBlock, citations: BookMindAiStructuredResponse['citations']): Citation | null {
  const ids = new Set(Array.isArray(block.citationIds) ? block.citationIds.map(String) : []);
  const citation = citations.find((item) => ids.has(item.id)) ?? citations.find((item) => protocolCitationToReaderCitation(item));
  return citation ? protocolCitationToReaderCitation(citation) : null;
}

function jumpChapterReferenceBlock(block: AiResponseBlock, citations: BookMindAiStructuredResponse['citations'] = []) {
  const citation = chapterRefBlockToReaderCitation(block, citations);
  if (!citation) return;
  emitAiProtocolJump(citation);
}

function paragraphRefBlockToReaderCitation(block: AiResponseBlock): Citation | null {
  const target = block.target as Record<string, unknown> | undefined;
  if (!target || typeof target !== 'object') return null;
  const chapterId = typeof target.chapterId === 'string' ? target.chapterId : undefined;
  const paragraphIndex = typeof target.paragraphIndex === 'number' ? target.paragraphIndex : undefined;
  if (!chapterId || paragraphIndex === undefined) return null;
  const quote = String(target.quote ?? block.why ?? '');
  return {
    id: paragraphIndex + 1,
    label: String(block.title ?? `第 ${paragraphIndex + 1} 段`),
    text: quote,
    targetId: [target.bookId, chapterId, paragraphIndex, target.startOffset, target.endOffset].filter((value) => value !== undefined && value !== '').join(':'),
  };
}

function ParagraphReferenceContext({ block }: { block: AiResponseBlock }) {
  const { t } = useI18n();
  const target = block.target as Record<string, unknown> | undefined;
  const before = String(target?.before ?? block.before ?? '');
  const after = String(target?.after ?? block.after ?? '');
  if (!before && !after) return null;
  return <details className="paragraph-reference-context"><summary>{t('ai.structured.context')}</summary><p>{[before, after].filter(Boolean).join('\n')}</p></details>;
}

function jumpParagraphReferenceBlock(block: AiResponseBlock) {
  const citation = paragraphRefBlockToReaderCitation(block);
  if (!citation) return;
  emitAiProtocolJump(citation);
}

function openProtocolCitationDetail(citation: AiProtocolCitation) {
  emitAiProtocolCitationDetail(citation);
}

function getMissingCitationFields(citation: AiProtocolCitation, strictness: 'lenient' | 'normal' | 'strict' = 'normal') {
  const missing: string[] = [];
  const hasSearchableText = Boolean(String(citation.sourceText ?? citation.snippet ?? citation.quote ?? '').trim());
  if (!hasSearchableText) missing.push('quote/sourceText/snippet');
  if (strictness === 'lenient') return missing;
  if (!hasSearchableText && (citation.type === 'chapter' || citation.type === 'paragraph' || citation.type === 'range') && !citation.chapterId && citation.sourceChapterIndex === undefined) missing.push('chapterId/sourceChapterIndex');
  if (!hasSearchableText && (citation.type === 'paragraph' || citation.type === 'range') && citation.paragraphIndex === undefined) missing.push('paragraphIndex');
  if (citation.type === 'search_result' && citation.score === undefined && citation.confidence === undefined) missing.push('score');
  if (citation.type === 'external' && !citation.label) missing.push('label');
  if (strictness === 'strict') {
    if (!hasSearchableText && !citation.bookId && !citation.chunkId && !citation.toolResultId) missing.push('bookId/chunkId/toolResultId');
    if (!hasSearchableText && citation.type === 'range' && citation.startOffset === undefined) missing.push('startOffset');
    if (!hasSearchableText && citation.type === 'range' && citation.endOffset === undefined) missing.push('endOffset');
    if (citation.type === 'external' && !citation.url && !citation.sourceUrl) missing.push('url/sourceUrl');
  }
  return missing;
}

function renderBulletList(value: unknown, citations: BookMindAiStructuredResponse['citations']) {
  if (!Array.isArray(value)) return null;
  return <ul>{value.map((item, index) => <li key={index}><span><InlineMarkdownText text={formatAiValue(item?.text ?? item)} /></span>{item?.importance ? <em><InlineMarkdownText text={String(item.importance)} /></em> : null}<CitationMarkers citationIds={item?.citationIds} citations={citations} /></li>)}</ul>;
}

function renderCitationCandidateGroup(block: AiResponseBlock, t: ReturnType<typeof useI18n>['t']) {
  const candidates = Array.isArray(block.candidates) ? block.candidates : [];
  if (!candidates.length) return <p className="citation-field-missing">{t('ai.structured.citationPendingEmpty')}</p>;
  return (
    <div className="ai-citation-candidate-group">
      {candidates.map((candidate, index) => (
        <article className="citation-card location-failed" key={String(candidate?.id ?? index)}>
          <strong>{String(candidate?.label ?? t('ai.structured.citationPending'))}</strong>
          <p>{String(candidate?.quote ?? candidate?.sourceText ?? candidate?.snippet ?? '')}</p>
          <small className="citation-field-missing">{t('ai.structured.citationPendingDetail')}</small>
        </article>
      ))}
    </div>
  );
}

function renderStringList(value: unknown, title: string) {
  if (!Array.isArray(value) || !value.length) return null;
  return <div className="ai-inline-list"><strong>{title}</strong>{value.map((item, index) => <span key={index}>{String(item)}</span>)}</div>;
}

function renderTags(value: unknown) {
  if (!Array.isArray(value)) return null;
  return <div className="ai-tag-row">{value.map((tag) => <span key={String(tag)}>{String(tag)}</span>)}</div>;
}

function renderCharacters(value: unknown) {
  if (!Array.isArray(value)) return null;
  return <div className="ai-character-list">{value.map((item) => <span key={String(item?.id ?? item?.name)}>{String(item?.name ?? item)}{item?.role ? ` · ${String(item.role)}` : ''}</span>)}</div>;
}

function renderRelationships(value: unknown, t: ReturnType<typeof useI18n>['t']) {
  if (!Array.isArray(value)) return null;
  return <ul>{value.map((item, index) => <li key={index}><InlineMarkdownText text={`${String(item?.from ?? '?')} -> ${String(item?.to ?? '?')} · ${String(item?.label ?? '')}`} />{item?.status === 'inferred' ? <em className="ai-inferred">{t('ai.structured.inferred')}</em> : null}<p><InlineMarkdownText text={String(item?.evidence ?? '')} /></p></li>)}</ul>;
}

function renderCharacterFactions(value: unknown, t: ReturnType<typeof useI18n>['t']) {
  if (!Array.isArray(value) || !value.length) return null;
  return (
    <div className="ai-character-factions">
      <strong>{t('ai.structured.factions')}</strong>
      {value.map((rawItem, index) => {
        const item = asRecord(rawItem);
        return (
          <article key={index}>
            <span>{formatAiValue(item?.character)} · {formatAiValue(item?.name)}</span>
            {item?.status ? <em>{formatAiValue(item.status)}</em> : null}
            {item?.evidence ? <p>{formatAiValue(item.evidence)}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

function renderCharacterStatusRows(value: unknown, citations: BookMindAiStructuredResponse['citations'], t: ReturnType<typeof useI18n>['t']) {
  if (!Array.isArray(value) || !value.length) return null;
  return (
    <ul className="ai-character-status-list">
      {value.map((rawItem, index) => {
        const item = asRecord(rawItem);
        const character = formatAiValue(item?.character ?? item?.name ?? t('ai.structured.characterNumber', { count: index + 1 }));
        const statusChange = formatAiValue(item?.statusChange ?? item?.statuschange ?? item?.changeSummary ?? item?.status ?? '');
        return (
          <li key={`${character}-${index}`}>
            <strong>{character}</strong>
            <span>{statusChange || formatAiValue(rawItem)}</span>
            <CitationMarkers citationIds={Array.isArray(item?.citationIds) ? item.citationIds.map(String) : []} citations={citations} />
          </li>
        );
      })}
    </ul>
  );
}

function formatAiValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatAiValue).filter(Boolean).join('；');
  const item = asRecord(value);
  if (!item) return String(value);
  for (const key of ['text', 'content', 'summary', 'statusChange', 'statuschange', 'changeSummary', 'description', 'note']) {
    if (item[key] !== undefined) return formatAiValue(item[key]);
  }
  return Object.entries(item).map(([key, entry]) => `${key}: ${formatAiValue(entry)}`).filter((line) => !line.endsWith(': ')).join('；');
}

function renderForeshadowing(value: unknown, citations: BookMindAiStructuredResponse['citations'], runSafeAction: (action?: string) => void, t: ReturnType<typeof useI18n>['t'], options: { hideActions?: boolean } = {}) {
  if (!Array.isArray(value)) return null;
  return (
    <ul className="ai-foreshadow-list">
      {value.map((rawItem, index) => {
        const item = asRecord(rawItem);
        const followUps = item ? collectForeshadowFollowUps(item) : [];
        return (
          <li key={index}>
            <div className="ai-foreshadow-main">
            <span><InlineMarkdownText text={String(item?.clue ?? rawItem)} /></span>
              <em className={`foreshadow-status status-${normalizeForeshadowStatus(item?.status)}`}>{renderForeshadowStatus(item?.status, t)}</em>
              <CitationMarkers citationIds={item?.citationIds as string[] | undefined} citations={citations} />
            </div>
            {item?.hypothesis ? <p><InlineMarkdownText text={String(item.hypothesis)} /></p> : null}
            {typeof item?.confidence === 'number' ? <meter className="ai-confidence" min={0} max={1} value={item.confidence} title={`confidence ${item.confidence}`} /> : null}
            {followUps.length ? <div className="foreshadow-followup-list"><strong>{t('ai.structured.followUpEvidence')}</strong>{followUps.map((followUp, followUpIndex) => <ForeshadowFollowUpLink key={followUpIndex} followUp={followUp} citations={citations} />)}</div> : null}
            {options.hideActions || item?.source === 'loose_command' ? null : <ConfirmablePreviewAction label={t('ai.structured.markPending')} action="save_note_preview" runSafeAction={runSafeAction} />}
          </li>
        );
      })}
    </ul>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function normalizeForeshadowStatus(status: unknown) {
  const value = String(status ?? 'pending').toLocaleLowerCase();
  if (value === 'resolved' || value === 'verified') return 'resolved';
  if (value === 'new') return 'new';
  return 'pending';
}

function renderForeshadowStatus(status: unknown, t: ReturnType<typeof useI18n>['t']) {
  const normalized = normalizeForeshadowStatus(status);
  if (normalized === 'resolved') return t('ai.structured.foreshadowStatus.resolved');
  if (normalized === 'new') return t('ai.structured.foreshadowStatus.new');
  return t('ai.structured.foreshadowStatus.pending');
}

function collectForeshadowFollowUps(item: Record<string, unknown>) {
  const fields = ['followUps', 'linkedClues', 'laterEvidence', 'resolvedBy'];
  return fields.flatMap((field) => normalizeFollowUpEntries(item[field]));
}

function normalizeFollowUpEntries(value: unknown): Array<Record<string, unknown>> {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) => asRecord(entry) ?? { clue: entry }).filter(Boolean);
}

function ForeshadowFollowUpLink({ followUp, citations }: { followUp: Record<string, unknown>; citations: BookMindAiStructuredResponse['citations'] }) {
  const { t } = useI18n();
  const citationIds = Array.isArray(followUp.citationIds) ? followUp.citationIds.map(String) : [];
  const label = String(followUp.clue ?? followUp.label ?? followUp.chapterTitle ?? followUp.evidence ?? t('ai.structured.followUpClue'));
  const chapterLabel = [followUp.chapterTitle, followUp.sourceChapterIndex !== undefined ? t('ai.citationCard.chapterNumber', { count: Number(followUp.sourceChapterIndex) + 1 }) : undefined].filter(Boolean).join(' · ');
  return (
    <button className="foreshadow-followup-link" type="button" onClick={() => emitAiForeshadowFollowUp(followUp)}>
      <span>{label}</span>
      {chapterLabel ? <small>{chapterLabel}</small> : null}
      <CitationMarkers citationIds={citationIds} citations={citations} />
    </button>
  );
}

function renderTimeline(value: unknown, t: ReturnType<typeof useI18n>['t'], options: { hideKind?: boolean } = {}) {
  if (!Array.isArray(value)) return null;
  return <ol className="ai-timeline">{value.map((item, index) => <li key={String(item?.id ?? index)}><strong><InlineMarkdownText text={String(item?.timeLabel ?? item?.order ?? index + 1)} /></strong><span><InlineMarkdownText text={formatAiValue(item?.event ?? item)} /></span>{options.hideKind ? null : <em>{renderTimelineKind(item?.kind, t)}</em>}</li>)}</ol>;
}

function renderTimelineKind(value: unknown, t: ReturnType<typeof useI18n>['t']) {
  const kind = String(value ?? 'happened').toLocaleLowerCase();
  if (kind === 'memory') return t('ai.structured.timelineKind.memory');
  if (kind === 'forecast') return t('ai.structured.timelineKind.forecast');
  if (kind === 'inferred') return t('ai.structured.timelineKind.inferred');
  return t('ai.structured.timelineKind.happened');
}

function renderTable(block: AiResponseBlock, citations: BookMindAiStructuredResponse['citations'], t: ReturnType<typeof useI18n>['t']) {
  const columns = Array.isArray(block.columns) ? block.columns.map(String) : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  return <div className="ai-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => (
    <Fragment key={index}>
      <tr key={`${index}-row`}>{(Array.isArray(row?.cells) ? row.cells : []).map((cell: unknown, cellIndex: number) => <td key={cellIndex}><InlineMarkdownText text={String(cell)} /></td>)}</tr>
      {renderTableEvidence(row, columns.length || 1, index, citations, t)}
    </Fragment>
  ))}</tbody></table></div>;
}

function renderTableEvidence(row: unknown, colSpan: number, index: number, citations: BookMindAiStructuredResponse['citations'], t: ReturnType<typeof useI18n>['t']) {
  const item = row as Record<string, unknown> | null;
  const evidence = [item?.evidence, item?.quote, item?.why].filter(Boolean).map(String).join('\n');
  const citationIds = Array.isArray(item?.citationIds) ? item.citationIds.map(String) : [];
  if (!evidence && !citationIds.length) return null;
  return (
    <tr className="ai-table-evidence-row" key={`${index}-evidence`}>
      <td colSpan={colSpan}>
        <details>
          <summary>{t('ai.structured.expandEvidence')}</summary>
          {evidence ? <p>{evidence}</p> : null}
          <CitationMarkers citationIds={citationIds} citations={citations} />
        </details>
      </td>
    </tr>
  );
}

function renderActions(value: unknown, runSafeAction: (action?: string) => void, t: ReturnType<typeof useI18n>['t']) {
  if (!Array.isArray(value)) return null;
  return <div className="ai-block-actions">{value.map((item, index) => <button key={index} type="button" onClick={() => runSafeAction(String(item?.action ?? ''))}><InlineMarkdownText text={String(item?.label ?? item?.action ?? t('ai.structured.block.actions'))} /></button>)}</div>;
}

function copyMarkdownTable(block: AiResponseBlock) {
  const columns = Array.isArray(block.columns) ? block.columns.map(String) : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const markdown = [columns.join(' | '), columns.map(() => '---').join(' | '), ...rows.map((row) => (Array.isArray(row?.cells) ? row.cells : []).map(String).join(' | '))].join('\n');
  void navigator.clipboard?.writeText(markdown);
}

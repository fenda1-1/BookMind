import type { AiProtocolCitation, AiToolCall, BookMindAiStructuredResponse } from '../../services/aiResponseProtocol';
import { emitBrowserDomainEvent, subscribeBrowserDomainEvent } from '../../services/browserDomainEvents';
import type { Citation } from '../../types';

type AiToolResultRenderDetail = Pick<BookMindAiStructuredResponse, 'schema' | 'title' | 'blocks' | 'citations'>;
type ChapterTimelineUpdatedDetail = { bookId: string; records: Record<string, unknown>[] };
type CitationRepairDetail = { citation: AiProtocolCitation; missingFields: string[] };
type AiActionDetail = { action: 'run_parse_index' };
type AiReaderEventMap = {
  action: AiActionDetail;
  toolResultRender: AiToolResultRenderDetail;
  chapterTimelineUpdated: ChapterTimelineUpdatedDetail;
  protocolJump: Citation;
  toolCall: AiToolCall | { tool: string; surface: string; args: Record<string, unknown>; reason: string };
  citationRepair: CitationRepairDetail;
  protocolCitationDetail: AiProtocolCitation;
  foreshadowFollowUp: Record<string, unknown>;
};

const aiReaderEventNames: { [Name in keyof AiReaderEventMap]: `bookmind:${string}` } = {
  action: 'bookmind:ai-action',
  toolResultRender: 'bookmind:ai-tool-result-render',
  chapterTimelineUpdated: 'bookmind:chapter-timeline-updated',
  protocolJump: 'bookmind:ai-protocol-jump',
  toolCall: 'bookmind:ai-tool-call',
  citationRepair: 'bookmind:ai-citation-repair',
  protocolCitationDetail: 'bookmind:ai-protocol-citation-detail',
  foreshadowFollowUp: 'bookmind:ai-foreshadow-followup',
};

function emitAiReaderEvent<Name extends keyof AiReaderEventMap>(name: Name, detail: AiReaderEventMap[Name]) {
  emitBrowserDomainEvent(aiReaderEventNames[name], detail);
}

function subscribeAiReaderEvent<Name extends keyof AiReaderEventMap>(name: Name, handler: (detail: AiReaderEventMap[Name]) => void) {
  return subscribeBrowserDomainEvent(aiReaderEventNames[name], handler);
}

export function emitAiAction(detail: AiActionDetail) {
  emitAiReaderEvent('action', detail);
}

export function emitAiToolResultRender(detail: AiToolResultRenderDetail) {
  emitAiReaderEvent('toolResultRender', detail);
}

export function emitChapterTimelineUpdated(detail: ChapterTimelineUpdatedDetail) {
  emitAiReaderEvent('chapterTimelineUpdated', detail);
}

export function emitAiProtocolJump(citation: Citation) {
  emitAiReaderEvent('protocolJump', citation);
}

export function emitAiToolCall(toolCall: AiReaderEventMap['toolCall']) {
  emitAiReaderEvent('toolCall', toolCall);
}

export function emitAiCitationRepair(detail: CitationRepairDetail) {
  emitAiReaderEvent('citationRepair', detail);
}

export function emitAiProtocolCitationDetail(citation: AiProtocolCitation) {
  emitAiReaderEvent('protocolCitationDetail', citation);
}

export function emitAiForeshadowFollowUp(detail: Record<string, unknown>) {
  emitAiReaderEvent('foreshadowFollowUp', detail);
}

export function subscribeAiProtocolJump(handler: (citation: Citation) => void) {
  return subscribeAiReaderEvent('protocolJump', handler);
}

export function subscribeAiCitationRepair(handler: (detail: CitationRepairDetail) => void) {
  return subscribeAiReaderEvent('citationRepair', handler);
}

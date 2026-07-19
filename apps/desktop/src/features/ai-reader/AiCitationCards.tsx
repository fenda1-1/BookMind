import type { KeyboardEvent } from 'react';
import type { AiProtocolCitation } from '../../services/aiResponseProtocol';
import type { Citation } from '../../types';
import { useI18n } from '../../i18n';
import { AiCitationActionIcon, type AiCitationActionIconName } from './icons';

export type AiCitationCardsProps = {
  citations: AiProtocolCitation[];
  onJumpCitation?: (citation: Citation) => void;
  onHoverCitation?: (citation: Citation | null) => void;
  onSaveHighlight?: (citation: Citation) => void;
  onSaveExcerpt?: (citation: Citation) => void;
  onSaveDefault?: (citation: Citation) => void;
  onCopyCitation?: (citation: AiProtocolCitation) => void;
};

export function AiCitationCards({ citations, onJumpCitation, onHoverCitation, onSaveHighlight, onSaveExcerpt, onSaveDefault, onCopyCitation }: AiCitationCardsProps) {
  const { t } = useI18n();
  if (!citations.length) return null;
  return (
    <div className="ai-citation-cards" aria-label={t('ai.citationCard.aria')}>
      {citations.map((citation) => {
        const readerCitation = protocolCitationToReaderCitation(citation, t('ai.citationCard.fallbackLabel'));
        const canJump = Boolean(readerCitation);
        return (
          <article
            className={`ai-citation-card citation-card protocol-citation citation-${citation.type ?? 'unknown'}${canJump ? '' : ' location-failed'}`}
            tabIndex={0}
            role="button"
            aria-label={canJump
              ? t('ai.citationCard.ariaJump', { label: citation.label ?? citation.id })
              : t('ai.citationCard.ariaPending', { label: citation.label ?? citation.id })}
            key={citation.id}
            onMouseEnter={() => onHoverCitation?.(readerCitation)}
            onMouseLeave={() => onHoverCitation?.(null)}
            onFocus={() => onHoverCitation?.(readerCitation)}
            onBlur={() => onHoverCitation?.(null)}
            onKeyDown={(event) => activateCitationCard(event, readerCitation, onJumpCitation)}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button')) return;
              if (readerCitation) onJumpCitation?.(readerCitation);
            }}
          >
            <strong>{citation.label ?? citation.type ?? t('ai.citationCard.fallbackLabel')}</strong>
            <p>{citation.quote ?? citation.snippet ?? citation.sourceText ?? t('ai.citationCard.unboundContent')}</p>
            {canJump ? <small>{formatReaderLocation(citation, t)}</small> : <small className="ai-citation-failure">{t('ai.citationCard.unboundLocation')}</small>}
            <div className="action-row citation-action-row" aria-label={t('ai.citationCard.actions')}>
              <CitationActionButton icon={readerCitation ? 'jumpSource' : 'noDetail'} label={readerCitation ? t('ai.citationCard.jump') : t('ai.citationCard.cannotJump')} disabled={!readerCitation} onClick={() => readerCitation && onJumpCitation?.(readerCitation)} />
              <CitationActionButton icon="saveDefault" label={t('ai.citationCard.saveDefault')} disabled={!readerCitation} onClick={() => readerCitation && onSaveDefault?.(readerCitation)} />
              <CitationActionButton icon="saveHighlight" label={t('ai.saveHighlight')} disabled={!readerCitation} onClick={() => readerCitation && onSaveHighlight?.(readerCitation)} />
              <CitationActionButton icon="saveExcerpt" label={t('ai.saveExcerpt')} disabled={!readerCitation} onClick={() => readerCitation && onSaveExcerpt?.(readerCitation)} />
              <CitationActionButton icon="copyCitation" label={t('ai.citationCard.copy')} onClick={() => onCopyCitation?.(citation)} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CitationActionButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: AiCitationActionIconName;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="citation-action-icon-btn"
      type="button"
      disabled={disabled}
      data-tooltip={label}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <AiCitationActionIcon name={icon} />
    </button>
  );
}

function activateCitationCard(event: KeyboardEvent<HTMLElement>, citation: Citation | null, onJumpCitation?: (citation: Citation) => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (citation) onJumpCitation?.(citation);
}

export function protocolCitationToReaderCitation(citation: AiProtocolCitation, fallbackLabel = ''): Citation | null {
  if (citation.type === 'external' || citation.type === 'pending') return null;
  const hasReaderLocation = Boolean(citation.chapterId)
    || typeof citation.sourceChapterIndex === 'number'
    || typeof citation.chapterIndex === 'number'
    || typeof citation.paragraphIndex === 'number'
    || Boolean(citation.chunkId);
  if (!hasReaderLocation) return null;
  return {
    id: Number(String(citation.id).replace(/\D/g, '')) || 0,
    label: citation.label ?? citation.type ?? fallbackLabel,
    text: citation.quote ?? citation.sourceText ?? citation.snippet ?? citation.label ?? '',
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

function formatReaderLocation(citation: AiProtocolCitation, t: ReturnType<typeof useI18n>['t']) {
  const chapter = citation.chapterId ?? (citation.sourceChapterIndex !== undefined ? t('ai.citationCard.chapterNumber', { count: Number(citation.sourceChapterIndex) + 1 }) : t('ai.citationCard.currentChapter'));
  const paragraph = citation.paragraphIndex !== undefined ? t('ai.citationCard.paragraphNumber', { count: Number(citation.paragraphIndex) + 1 }) : t('ai.citationCard.paragraphPending');
  return `${chapter} · ${paragraph}`;
}

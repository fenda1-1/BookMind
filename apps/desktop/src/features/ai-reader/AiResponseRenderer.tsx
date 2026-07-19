import { parseAiResponseProtocol, type BookMindAiStructuredResponse } from '../../services/aiResponseProtocol';
import { useI18n } from '../../i18n';
import { AiCitationCards, type AiCitationCardsProps } from './AiCitationCards';

export type AiResponseRendererProps = Pick<AiCitationCardsProps, 'onJumpCitation' | 'onHoverCitation' | 'onSaveHighlight' | 'onSaveExcerpt' | 'onSaveDefault' | 'onCopyCitation'> & {
  rawAnswer: string;
  response?: BookMindAiStructuredResponse | null;
  renderedBlockLimit?: number;
};

export function AiResponseRenderer({ rawAnswer, response, renderedBlockLimit, ...citationProps }: AiResponseRendererProps) {
  const { t } = useI18n();
  const parsed = response ?? (rawAnswer.trim() ? parseAiResponseProtocol(rawAnswer) : null);
  if (!parsed) return null;
  const safeRenderedBlockLimit = normalizeRenderedBlockLimit(renderedBlockLimit);
  const visibleBlocks = parsed.blocks.slice(0, safeRenderedBlockLimit);
  const hiddenBlockCount = Math.max(0, parsed.blocks.length - visibleBlocks.length);
  return (
    <div className="ai-response-renderer" data-schema={parsed.schema}>
      {parsed.title ? <header className="ai-response-renderer-head"><strong>{parsed.title}</strong>{parsed.summary ? <p>{parsed.summary}</p> : null}</header> : null}
      <div className="ai-response-renderer-blocks">
        {visibleBlocks.map((block) => (
          <section className={`ai-markdown-block block-${block.type}`} key={block.id}>
            {block.type === 'heading' ? <h3 className="ai-markdown-heading">{String(block.content ?? block.title ?? '')}</h3> : null}
            {block.type === 'paragraph' ? <p>{String(block.content ?? '')}</p> : null}
            {block.type === 'bullet_list' && Array.isArray(block.items) ? <ul className="ai-markdown-list">{block.items.map((item, index) => <li key={index}>{String(item?.text ?? item)}</li>)}</ul> : null}
            {block.type === 'quote' ? <blockquote>{String(block.content ?? '')}</blockquote> : null}
            {block.type !== 'heading' && block.type !== 'paragraph' && block.type !== 'bullet_list' && block.type !== 'quote' ? <p>{String(block.content ?? block.title ?? block.type)}</p> : null}
          </section>
        ))}
      </div>
      {hiddenBlockCount > 0 ? <p className="ai-render-limit-notice">{t('ai.structured.renderLimitCompact', { shown: visibleBlocks.length, hidden: hiddenBlockCount })}</p> : null}
      <AiCitationCards citations={parsed.citations} {...citationProps} />
    </div>
  );
}

function normalizeRenderedBlockLimit(value?: number) {
  if (!Number.isFinite(value)) return 120;
  return Math.min(500, Math.max(20, Math.round(value ?? 120)));
}

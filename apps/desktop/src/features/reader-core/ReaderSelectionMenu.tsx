import { useI18n } from '../../i18n';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import type { ReaderHighlightColor } from '../../types';
import { readerHighlightColors } from './readerInteractionModel';
import type { ReaderSelectionParagraph } from './readerModel';

export { getReaderSelectionMenuPosition, buildReaderSelectionRanges } from './readerModel';

export type ReaderSelectionMenuState = {
  x: number;
  y: number;
  placement?: 'top' | 'bottom';
  ranges: ReaderSelectionParagraph[];
};

export function ReaderSelectionFloatingMenu({ menu, copySelectionText, searchSelectionText, explainSelectionText, translateSelectionText, createSelectionCard, generateSelectionQuestions, createSelectionAnnotation, startReadAloudFromSelectionParagraph, createSelectionHighlight, cancelSelectionMenu }: { menu: ReaderSelectionMenuState; copySelectionText: () => void; searchSelectionText: () => void; explainSelectionText: () => void; translateSelectionText: () => void; createSelectionCard: () => void; generateSelectionQuestions: () => void; createSelectionAnnotation: () => void; startReadAloudFromSelectionParagraph: () => void; createSelectionHighlight: (color?: ReaderHighlightColor) => void; cancelSelectionMenu: () => void }) {
  const { t } = useI18n();
  const actions: Array<{ key: string; icon: BookMindIconName; label: string; onClick: () => void }> = [
    { key: 'copy', icon: 'copy', label: t('reader.selection.copy'), onClick: copySelectionText },
    { key: 'search', icon: 'readerSearch', label: t('reader.selection.search'), onClick: searchSelectionText },
    { key: 'explain', icon: 'aiDesk', label: t('reader.selection.explain'), onClick: explainSelectionText },
    { key: 'translate', icon: 'translate', label: t('reader.selection.translate'), onClick: translateSelectionText },
    { key: 'card', icon: 'knowledge', label: t('reader.selection.card'), onClick: createSelectionCard },
    { key: 'questions', icon: 'question', label: t('reader.selection.questions'), onClick: generateSelectionQuestions },
    { key: 'annotate', icon: 'note', label: t('reader.selection.annotate'), onClick: createSelectionAnnotation },
    { key: 'readAloudFromParagraph', icon: 'play', label: t('reader.selection.readAloudFromParagraph'), onClick: startReadAloudFromSelectionParagraph },
    { key: 'highlight', icon: 'highlights', label: t('reader.selection.highlight'), onClick: () => createSelectionHighlight() },
    { key: 'cancel', icon: 'close', label: t('reader.selection.cancel'), onClick: cancelSelectionMenu },
  ];
  return (
    <div className={`reader-selection-menu ${menu.placement === 'bottom' ? 'placement-bottom' : 'placement-top'}`} role="menu" aria-label={t('reader.selection.menu')} style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
      <div className="reader-selection-actions">
        {actions.map((action) => (
          <button className="reader-selection-action" role="menuitem" type="button" key={action.key} aria-label={action.label} data-tooltip={action.label} onClick={action.onClick}>
            <BookMindIcon name={action.icon} />
          </button>
        ))}
      </div>
      <div className="reader-color-row" role="group" aria-label={t('reader.highlight.color')}>
        {readerHighlightColors.map((color) => (
          <button className={`reader-color-dot color-${color}`} type="button" key={color} aria-label={t(`reader.highlight.color.${color}`)} data-tooltip={t(`reader.highlight.color.${color}`)} onClick={() => createSelectionHighlight(color)} />
        ))}
      </div>
    </div>
  );
}

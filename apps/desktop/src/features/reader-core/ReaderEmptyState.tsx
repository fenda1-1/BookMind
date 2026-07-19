import { useI18n } from '../../i18n';
import type { Book } from '../../types';

type ReaderEmptyStateProps = {
  recentBook?: Book | null;
  onOpenRecentBook?: (bookId: string) => void;
  onChooseBookFile?: () => void;
  onOpenAiDemo?: () => void;
  onOpenLibrary?: () => void;
  onOpenTasks?: () => void;
};

export function ReaderEmptyState({
  recentBook,
  onOpenRecentBook,
  onChooseBookFile,
  onOpenAiDemo,
  onOpenLibrary,
  onOpenTasks,
}: ReaderEmptyStateProps) {
  const { t } = useI18n();

  return (
    <article className="reader-canvas" aria-label={t('reader.noBook.aria')}>
      <div className="reader-empty-state">
        <div className="empty-book-stack" aria-hidden="true"><span /><span /><span /></div>
        <p className="chapter-kicker">{t('reader.noBook.kicker')}</p>
        <h2>{t('reader.noBook.title')}</h2>
        <p>{t('reader.noBook.description')}</p>
        {recentBook ? (
          <button className="reader-recent-book" type="button" onClick={() => onOpenRecentBook?.(recentBook.id)}>
            <span className={`mini-cover ${recentBook.coverTone}`}>{recentBook.coverLabel}</span>
            <span><strong>{recentBook.displayTitle}</strong><em>{t('reader.noBook.recentProgress', { progress: recentBook.progress })}</em></span>
          </button>
        ) : null}
        <div className="empty-reader-steps"><span>{t('reader.noBook.stepImport')}</span><i /><span>{t('reader.noBook.stepIndex')}</span><i /><span>{t('reader.noBook.stepRead')}</span></div>
        <div className="reader-empty-actions">
          <button className="primary-btn" type="button" onClick={onChooseBookFile}>{t('reader.noBook.importTxt')}</button>
          <button className="ghost-btn" type="button" onClick={onOpenAiDemo}>{t('reader.noBook.aiDemo')}</button>
          <button className="ghost-btn" type="button" onClick={onOpenLibrary}>{t('reader.noBook.openLibrary')}</button>
          <button className="ghost-btn" type="button" onClick={onOpenTasks}>{t('reader.noBook.openTasks')}</button>
        </div>
      </div>
    </article>
  );
}

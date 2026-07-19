import { useEffect, useRef } from 'react';
import { BookMindIcon, type BookMindIconName } from '../components/BookMindIcon';
import { getPrivacyBookTitle, getPrivacyFileName, type ExtendedSettings } from '../services/settingsCenterService';
import { useI18n, type TranslationKey } from '../i18n';
import { indexStatusLabel, matchesBookStatusFilter, textIndexClassName, characterStatusLabel } from './CharacterPageUtils';
import type { CharacterCenterBookSummary } from '../types';
import { handleCharacterBookStripElementWheel } from '../features/characters/characterBookStripWheel';

type CharacterWorkbenchView = 'overview' | 'profiles' | 'relations' | 'heatmap' | 'timeline' | 'factions' | 'evidence' | 'review' | 'export';
type CharacterBookStatusFilter = 'all' | 'ready' | 'missing' | 'stale' | 'failed' | 'character-failed';

const characterWorkbenchViews: Array<{ id: CharacterWorkbenchView; labelKey: TranslationKey; icon: BookMindIconName }> = [
  { id: 'overview', labelKey: 'characters.mobileView.overview', icon: 'overview' },
  { id: 'profiles', labelKey: 'characters.mobileView.profiles', icon: 'characters' },
  { id: 'relations', labelKey: 'characters.mobileView.relations', icon: 'knowledge' },
  { id: 'heatmap', labelKey: 'characters.mobileView.heatmap', icon: 'librarySort' },
  { id: 'timeline', labelKey: 'characters.mobileView.timeline', icon: 'toc' },
  { id: 'factions', labelKey: 'characters.mobileView.factions', icon: 'libraryShelfView' },
  { id: 'evidence', labelKey: 'characters.mobileView.evidence', icon: 'note' },
  { id: 'review', labelKey: 'characters.mobileView.review', icon: 'diagnostics' },
  { id: 'export', labelKey: 'characters.mobileView.export', icon: 'saveCommand' },
];

type CharacterListPanelProps = {
  filteredBooks: CharacterCenterBookSummary[];
  selectedBook: CharacterCenterBookSummary | null;
  bookQuery: string;
  bookStatusFilter: CharacterBookStatusFilter;
  bookSearchInputRef: React.RefObject<HTMLInputElement | null>;
  privacySettings: ExtendedSettings;
  selectedWorkbenchView: CharacterWorkbenchView;
  onSelectBook: (bookId: string) => void;
  onSetBookQuery: (query: string) => void;
  onSetBookStatusFilter: (filter: CharacterBookStatusFilter) => void;
  onSelectWorkbenchView: (view: CharacterWorkbenchView) => void;
};

export function CharacterListPanel({
  filteredBooks,
  selectedBook,
  bookQuery,
  bookStatusFilter,
  bookSearchInputRef,
  privacySettings,
  selectedWorkbenchView,
  onSelectBook,
  onSetBookQuery,
  onSetBookStatusFilter,
  onSelectWorkbenchView,
}: CharacterListPanelProps) {
  const { t } = useI18n();
  const bookStripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const strip = bookStripRef.current;
    if (!strip) return undefined;
    const onWheel = (event: WheelEvent) => {
      handleCharacterBookStripElementWheel(strip, event);
    };
    strip.addEventListener('wheel', onWheel, { passive: false });
    return () => strip.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <header className="characters-atlas-toolbar">
      <div className="characters-atlas-title">
        <span className="characters-status-pill ready">{t('characters.center.title')}</span>
        <strong>{selectedBook ? getPrivacyBookTitle(selectedBook.displayTitle || selectedBook.title, privacySettings) : t('characters.noBookTitle')}</strong>
        <em>{t('characters.bookCount', { count: filteredBooks.length })}</em>
      </div>
      <nav className="characters-atlas-tabs" aria-label={t('characters.viewNavigationAria')}>
        {characterWorkbenchViews.map((view) => (
          <button
            className={selectedWorkbenchView === view.id ? 'characters-atlas-tab active' : 'characters-atlas-tab'}
            type="button"
            key={view.id}
            onClick={() => onSelectWorkbenchView(view.id)}
            aria-pressed={selectedWorkbenchView === view.id}
            aria-label={t(view.labelKey)}
            data-tooltip={t(view.labelKey)}
          >
            <BookMindIcon name={view.icon} />
            <span>{t(view.labelKey)}</span>
          </button>
        ))}
      </nav>
      <div className="characters-atlas-tools">
        <label className="characters-book-search">
          <span>{t('characters.bookSearch')}</span>
          <input
            ref={bookSearchInputRef}
            type="search"
            value={bookQuery}
            onChange={(event) => onSetBookQuery(event.target.value)}
            placeholder={t('characters.bookSearchPlaceholder')}
            aria-label={t('characters.bookSearchPlaceholder')}
          />
        </label>
        <label className="characters-book-filter">
          <span>{t('characters.bookStatusFilter')}</span>
          <select
            value={bookStatusFilter}
            onChange={(event) => onSetBookStatusFilter(event.target.value as CharacterBookStatusFilter)}
          >
            <option value="all">{t('characters.bookStatusFilter.all')}</option>
            <option value="ready">{t('characters.bookStatusFilter.ready')}</option>
            <option value="missing">{t('characters.bookStatusFilter.missing')}</option>
            <option value="stale">{t('characters.bookStatusFilter.stale')}</option>
            <option value="failed">{t('characters.bookStatusFilter.failed')}</option>
            <option value="character-failed">{t('characters.bookStatusFilter.characterFailed')}</option>
          </select>
        </label>
      </div>
      <div ref={bookStripRef} className="characters-book-strip" aria-label={t('characters.bookPicker')}>
        {filteredBooks.length === 0 ? (
          <div className="characters-book-filter-empty">
            <strong>{t('characters.bookNoMatchesTitle')}</strong>
            <p>{t('characters.bookNoMatchesBody')}</p>
          </div>
        ) : null}
        {filteredBooks.map((book) => {
          const bookDisplayTitle = getPrivacyBookTitle(book.displayTitle || book.title, privacySettings);
          const bookDisplayFileName = getPrivacyFileName(book.fileName, privacySettings);
          const active = selectedBook?.id === book.id;
          return (
            <button
              className={active ? 'characters-book-option active' : 'characters-book-option'}
              type="button"
              onClick={() => onSelectBook(book.id)}
              aria-label={t('characters.selectBookAria', { title: bookDisplayTitle })}
              key={book.id}
            >
              <span title={bookDisplayTitle}>{bookDisplayTitle}</span>
              <em title={bookDisplayFileName}>{bookDisplayFileName}</em>
              <span className="characters-book-status-row">
                <i className={`characters-status-pill ${textIndexClassName(book)}`}>{indexStatusLabel(book, t)}</i>
                <i className={`characters-status-pill ${book.characterIndexStatus}`}>{characterStatusLabel(book.characterIndexStatus, t)}</i>
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}

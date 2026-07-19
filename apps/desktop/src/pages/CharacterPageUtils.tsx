import type { CharacterCenterBookSummary, CharacterIndexStatus, CharacterLocation, CharacterOverviewSnapshot } from '../types';
import { useI18n, type TranslationKey } from '../i18n';
import type { CharacterCenterPrimaryAction, CharacterCenterSecondaryAction } from '../features/characters/characterCenterState';

type CharacterBookStatusFilter = 'all' | 'ready' | 'missing' | 'stale' | 'failed' | 'character-failed';

export function isOpenableCharacterLocation(location: CharacterLocation | undefined) {
  const readerLocation = location?.readerLocation ?? location;
  return Boolean(
    readerLocation
    && typeof readerLocation.sourceChapterIndex === 'number'
    && typeof readerLocation.paragraphIndex === 'number'
    && typeof readerLocation.startOffset === 'number'
    && typeof readerLocation.endOffset === 'number',
  );
}

export function formatCharacterLocation(location: CharacterLocation | undefined, t: ReturnType<typeof useI18n>['t']) {
  if (!location) return t('characters.detailUnknownLocation');
  const chapter = location.chapterTitle
    || (typeof location.visibleChapterPosition === 'number'
      ? t('characters.detailChapterFallback', { count: location.visibleChapterPosition })
      : typeof location.sourceChapterIndex === 'number'
        ? t('characters.detailChapterFallback', { count: location.sourceChapterIndex + 1 })
        : typeof location.chapterIndex === 'number'
          ? t('characters.detailChapterFallback', { count: location.chapterIndex + 1 })
          : '');
  const paragraph = typeof location.paragraphIndex === 'number' ? t('characters.detailParagraph', { count: location.paragraphIndex + 1 }) : '';
  return [chapter, paragraph].filter(Boolean).join(' · ') || t('characters.detailUnknownLocation');
}

export function renderCharacterCenterSecondaryAction(
  action: CharacterCenterSecondaryAction,
  bookId: string,
  onOpenBook: (bookId: string) => void,
  onOpenTasks: () => void,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (action === 'open-reader') {
    return <button className="ghost-btn" type="button" onClick={() => onOpenBook(bookId)} aria-label={t('characters.openReaderAria')} key={action}>{t('characters.openReader')}</button>;
  }
  return <button className="ghost-btn" type="button" onClick={onOpenTasks} aria-label={t('characters.openTasksAria')} key={action}>{t('characters.openTasks')}</button>;
}

export function isEditableCharacterCenterShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLocaleLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

export function canQueueCharacterRebuild(
  primaryAction: CharacterCenterPrimaryAction,
  selectedIndexView: ReturnType<typeof buildTextIndexViewFromSummary>,
  characterStatus: CharacterIndexStatus,
  extractingCharacters: boolean,
) {
  if (extractingCharacters || !selectedIndexView.ready) return false;
  if (characterStatus === 'queued' || characterStatus === 'building' || characterStatus === 'blocked-by-text-index') return false;
  return primaryAction !== 'character-extraction';
}

export function matchesBookStatusFilter(book: CharacterCenterBookSummary, filter: CharacterBookStatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'ready') return book.textIndexReady;
  if (filter === 'stale') return book.textIndexStatus === 'stale';
  if (filter === 'failed') return book.textIndexStatus === 'failed';
  if (filter === 'character-failed') return book.characterIndexStatus === 'failed';
  return book.textIndexStatus === 'missing' || !book.textIndexReady;
}

export function buildTextIndexViewFromSummary(book: CharacterCenterBookSummary | null) {
  const status = book?.textIndexStatus ?? 'missing';
  return {
    status,
    ready: Boolean(book?.textIndexReady),
    missing: status === 'missing' || !book?.textIndexReady,
    stale: status === 'stale',
    failed: status === 'failed',
    staleReason: book?.staleReason ?? '',
    chunkCount: book?.textIndexChunkCount ?? 0,
    ftsRows: book?.textIndexFtsRows ?? 0,
  };
}

export function characterOverviewStatLabelKey(statId: CharacterOverviewSnapshot['stats'][number]['id']): TranslationKey {
  if (statId === 'characters') return 'characters.overviewStat.characters';
  if (statId === 'relations') return 'characters.overviewStat.relations';
  if (statId === 'evidence') return 'characters.overviewStat.evidence';
  if (statId === 'chapter-coverage') return 'characters.overviewStat.chapterCoverage';
  return 'characters.overviewStat.review';
}

export function characterOverviewStatHintKey(statId: CharacterOverviewSnapshot['stats'][number]['id']): TranslationKey {
  if (statId === 'characters') return 'characters.overviewStat.charactersHint';
  if (statId === 'relations') return 'characters.overviewStat.relationsHint';
  if (statId === 'evidence') return 'characters.overviewStat.evidenceHint';
  if (statId === 'chapter-coverage') return 'characters.overviewStat.chapterCoverageHint';
  return 'characters.overviewStat.reviewHint';
}

export function indexStatusLabel(book: Pick<CharacterCenterBookSummary, 'textIndexStatus' | 'textIndexReady'>, t: ReturnType<typeof useI18n>['t']) {
  if (book.textIndexReady) return t('characters.textIndex.ready');
  if (book.textIndexStatus === 'stale') return t('characters.textIndex.stale');
  if (book.textIndexStatus === 'failed') return t('characters.textIndex.failed');
  return t('characters.textIndex.missing');
}

export function textIndexClassName(book: Pick<CharacterCenterBookSummary, 'textIndexStatus' | 'textIndexReady'>) {
  if (book.textIndexReady) return 'ready';
  if (book.textIndexStatus === 'stale') return 'stale';
  if (book.textIndexStatus === 'failed') return 'failed';
  return 'missing';
}

export function characterStatusLabel(status: CharacterIndexStatus, t: ReturnType<typeof useI18n>['t']) {
  if (status === 'blocked-by-text-index') return t('characters.characterIndex.blocked');
  if (status === 'ready') return t('characters.characterIndex.ready');
  if (status === 'building') return t('characters.characterIndex.building');
  if (status === 'queued') return t('characters.characterIndex.queued');
  if (status === 'stale') return t('characters.characterIndex.stale');
  if (status === 'failed') return t('characters.characterIndex.failed');
  return t('characters.characterIndex.missing');
}

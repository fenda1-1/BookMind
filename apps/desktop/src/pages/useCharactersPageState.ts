import { startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { buildCharacterProfileDetail, type CharacterProfileDetail } from '../features/characters/characterProfileDetail';
import { buildCharacterOverviewMetrics } from '../features/characters/characterOverviewMetrics';
import { resolveCharacterCenterState, type CharacterCenterPrimaryAction, type CharacterCenterSecondaryAction, type CharacterCenterState } from '../features/characters/characterCenterState';
import { getPrivacyBookTitle, getPrivacyFileName, type ExtendedSettings } from '../services/settingsCenterService';
import type { CharacterCenterBookSummary, CharacterCenterPayload } from '../types';
import type { CharacterGraphEdgeDetail } from '../features/characters/characterGraphEdgeDetail';
import { useI18n } from '../i18n';

type CharacterWorkbenchView = 'overview' | 'profiles' | 'relations' | 'heatmap' | 'timeline' | 'factions' | 'evidence' | 'review' | 'export';
type CharacterBookStatusFilter = 'all' | 'ready' | 'missing' | 'stale' | 'failed' | 'character-failed';

export function useCharactersPageState({
  bookSummaries,
  currentBook,
  characterPayload,
  privacySettings,
  indexingBookId,
  characterExtractionBookId,
}: {
  bookSummaries: CharacterCenterBookSummary[];
  currentBook: CharacterCenterBookSummary | null;
  characterPayload: CharacterCenterPayload | null;
  privacySettings: ExtendedSettings;
  indexingBookId: string | null;
  characterExtractionBookId: string | null;
}) {
  const { t } = useI18n();
  const bookSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [actionError, setActionError] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [bookStatusFilter, setBookStatusFilter] = useState<CharacterBookStatusFilter>('all');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedRelationDetail, setSelectedRelationDetail] = useState<CharacterGraphEdgeDetail | null>(null);
  const [selectedWorkbenchView, setSelectedWorkbenchView] = useState<CharacterWorkbenchView>('overview');
  const [renderedWorkbenchView, setRenderedWorkbenchView] = useState<CharacterWorkbenchView>('overview');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const deferredWorkbenchView = useDeferredValue(renderedWorkbenchView);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const workbenchSwitching = selectedWorkbenchView !== deferredWorkbenchView;

  const filteredBooks = useMemo<CharacterCenterBookSummary[]>(() => {
    const normalizedQuery = bookQuery.trim().toLocaleLowerCase();
    return bookSummaries.filter((book) => {
      const searchableText = [
        getPrivacyBookTitle(book.displayTitle || book.title, privacySettings),
        book.author,
        getPrivacyFileName(book.fileName, privacySettings),
      ].join(' ').toLocaleLowerCase();
      return (!normalizedQuery || searchableText.includes(normalizedQuery))
        && matchesBookStatusFilter(book, bookStatusFilter);
    });
  }, [bookQuery, bookStatusFilter, bookSummaries, privacySettings]);

  const selectedBook = currentBook;
  const workbenchNeedsFullPayload = selectedBook && (
    deferredWorkbenchView === 'profiles' || deferredWorkbenchView === 'relations'
    || deferredWorkbenchView === 'heatmap' || deferredWorkbenchView === 'evidence'
  );

  const selectedCharacterPayload = useMemo(() => {
    return selectedBook && characterPayload?.book.id === selectedBook.id ? characterPayload : null;
  }, [characterPayload, selectedBook]);

  const selectedCharacterDetail = useMemo((): CharacterProfileDetail | null => {
    if (!selectedCharacterPayload || !selectedCharacterId) return null;
    return buildCharacterProfileDetail(selectedCharacterPayload, selectedCharacterId);
  }, [selectedCharacterPayload, selectedCharacterId]);

  const selectedIndexView = buildTextIndexViewFromSummary(selectedBook);
  const characterStatus = selectedBook?.characterIndexStatus ?? 'missing';
  const centerState = resolveCharacterCenterState(selectedBook, selectedIndexView, characterStatus, {});
  const indexing = Boolean(selectedBook && indexingBookId === selectedBook.id);
  const extractingCharacters = Boolean(selectedBook && characterExtractionBookId === selectedBook.id);
  const metrics = useMemo(() => buildCharacterOverviewMetrics({
    book: selectedBook, manifest: null, profiles: [],
    centerState: { showZeroCharacterMetrics: centerState.showZeroCharacterMetrics },
  }), [centerState.showZeroCharacterMetrics, selectedBook]);
  const privacyMode = Boolean(privacySettings.applicationPrivacyMode);

  function selectWorkbenchView(view: CharacterWorkbenchView) {
    setRenderedWorkbenchView(view);
    startTransition(() => setSelectedWorkbenchView(view));
  }

  return {
    t, bookSearchInputRef, actionError, setActionError,
    bookQuery, setBookQuery, bookStatusFilter, setBookStatusFilter,
    selectedCharacterId, setSelectedCharacterId, selectedRelationDetail, setSelectedRelationDetail,
    selectedWorkbenchView, setSelectedWorkbenchView, renderedWorkbenchView, setRenderedWorkbenchView,
    graphFullscreen, setGraphFullscreen, deferredWorkbenchView, workbenchSwitching,
    inspectorCollapsed, setInspectorCollapsed, inspectorWidth, setInspectorWidth,
    filteredBooks, selectedBook, workbenchNeedsFullPayload,
    selectedCharacterPayload, selectedCharacterDetail,
    selectedIndexView, centerState, indexing, extractingCharacters, metrics, privacyMode,
    selectWorkbenchView,
  };
}

function matchesBookStatusFilter(book: CharacterCenterBookSummary, filter: CharacterBookStatusFilter) {
  const status = book.characterIndexStatus as string;
  if (filter === 'all') return true;
  if (filter === 'ready') return status === 'ready';
  if (filter === 'missing') return !status || status === 'missing';
  if (filter === 'stale') return status === 'stale';
  if (filter === 'failed') return status === 'text-failed' || status === 'character-failed';
  if (filter === 'character-failed') return status === 'character-failed';
  return true;
}

function buildTextIndexViewFromSummary(summary: CharacterCenterBookSummary | null): any {
  const status = (summary?.textIndexStatus as string) ?? 'missing';
  return {
    status,
    ready: Boolean(summary?.textIndexReady),
    missing: status === 'missing' || !summary?.textIndexReady,
    stale: status === 'stale',
    failed: status === 'failed',
    staleReason: summary?.staleReason ?? '',
    chunkCount: summary?.textIndexChunkCount ?? 0,
    ftsRows: summary?.textIndexFtsRows ?? 0,
  };
}

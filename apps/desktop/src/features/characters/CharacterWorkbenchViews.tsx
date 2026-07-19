import { useEffect, useMemo, useRef, useState } from 'react';
import type { Translator } from '../../i18n';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { CharacterCenterPayload, CharacterEntityKind, CharacterExtractionSource, CharacterLocation, CharacterRole } from '../../types';
import { buildCharacterAppearanceHeatmapModel, type CharacterAppearanceHeatmapModel } from './characterAppearanceHeatmap';
import { buildCharacterListModel, type CharacterListSortBy } from './characterListModel';
import { buildCharacterListViewport, getCharacterListViewportRowTop } from './characterListViewport';
import { ThemedSelect } from '../../components/ThemedSelect';

type CharacterProfileKindOption = Extract<CharacterEntityKind, 'person' | 'organization' | 'place' | 'artifact'>;
type CharacterProfileKindFilter = 'all' | CharacterProfileKindOption;
type CharacterProfileRoleOption = Exclude<CharacterRole, 'unknown'>;
type CharacterProfileRoleFilter = 'all' | CharacterProfileRoleOption;
type CharacterProfileConfidenceFilter = 'all' | 'low' | 'high';
type CharacterProfileSourceOption = Extract<CharacterExtractionSource, 'manual' | 'ai' | 'rule'>;
type CharacterProfileSourceFilter = 'all' | CharacterProfileSourceOption;

export function renderCharacterProfiles(
  characterPayload: CharacterCenterPayload,
  selectedCharacterId: string | null,
  onSelectCharacter: (characterId: string) => void,
  privacySettings: ExtendedSettings,
  t: Translator,
) {
  return (
    <CharacterProfileList
      characterPayload={characterPayload}
      selectedCharacterId={selectedCharacterId}
      onSelectCharacter={onSelectCharacter}
      privacySettings={privacySettings}
      t={t}
    />
  );
}

function CharacterProfileList({
  characterPayload,
  selectedCharacterId,
  onSelectCharacter,
  privacySettings,
  t,
}: {
  characterPayload: CharacterCenterPayload;
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  privacySettings: ExtendedSettings;
  t: Translator;
}) {
  const profileListRef = useRef<HTMLDivElement | null>(null);
  const [profileQuery, setProfileQuery] = useState('');
  const [profileSortBy, setProfileSortBy] = useState<CharacterListSortBy>('mention-count');
  const [profileKindFilter, setProfileKindFilter] = useState<CharacterProfileKindFilter>('all');
  const [profileRoleFilter, setProfileRoleFilter] = useState<CharacterProfileRoleFilter>('all');
  const [profileConfidenceFilter, setProfileConfidenceFilter] = useState<CharacterProfileConfidenceFilter>('all');
  const [profileSourceFilter, setProfileSourceFilter] = useState<CharacterProfileSourceFilter>('all');
  const [profileListScrollTop, setProfileListScrollTop] = useState(0);
  const [profileListHeight, setProfileListHeight] = useState(380);
  const model = useMemo(() => buildCharacterListModel(characterPayload.profiles, {
    query: profileQuery,
    sortBy: profileSortBy,
    kinds: profileKindFilter === 'all' ? [] : [profileKindFilter],
    roles: profileRoleFilter === 'all' ? [] : [profileRoleFilter],
    sources: profileSourceFilter === 'all' ? [] : [profileSourceFilter],
    minConfidence: profileConfidenceFilter === 'low' ? 0 : profileConfidenceFilter === 'high' ? 0.75 : 0,
    maxConfidence: profileConfidenceFilter === 'low' ? 0.749999 : 1,
  }), [characterPayload.profiles, profileQuery, profileSortBy, profileKindFilter, profileRoleFilter, profileConfidenceFilter, profileSourceFilter]);
  const viewport = buildCharacterListViewport({
    totalCount: model.items.length,
    scrollTop: profileListScrollTop,
    viewportHeight: profileListHeight,
    rowHeight: characterProfileRowHeight,
    rowGap: characterProfileRowGap,
    overscan: characterProfileOverscan,
  });
  const visibleItems = model.items.slice(viewport.startIndex, viewport.endIndex);

  useEffect(() => {
    const listElement = profileListRef.current;
    if (!listElement) return;
    const updateListHeight = () => setProfileListHeight(listElement.clientHeight || 380);
    updateListHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateListHeight);
      return () => window.removeEventListener('resize', updateListHeight);
    }
    const resizeObserver = new ResizeObserver(updateListHeight);
    resizeObserver.observe(listElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setProfileListScrollTop(0);
    if (profileListRef.current) {
      profileListRef.current.scrollTop = 0;
    }
  }, [characterPayload.book.id, profileQuery, profileSortBy, profileKindFilter, profileRoleFilter, profileConfidenceFilter, profileSourceFilter]);

  return (
    <article className="characters-profile-board" id="characters-profiles" aria-label={t('characters.profileListAria')}>
      <div className="characters-profile-board-head">
        <div>
          <p className="eyebrow">{t('characters.profileListEyebrow')}</p>
          <h3>{t('characters.profileListTitle', { count: model.summary.filteredCount })}</h3>
        </div>
        <span>{t('characters.profileListEvidence', { count: characterPayload.evidence.length })}</span>
      </div>
      <div className="characters-profile-tools characters-book-tools">
        <label className="characters-book-search">
          <span>{t('characters.profileSearch')}</span>
          <input
            type="search"
            value={profileQuery}
            onChange={(event) => setProfileQuery(event.target.value)}
            placeholder={t('characters.profileSearchPlaceholder')}
            aria-label={t('characters.profileSearchPlaceholder')}
          />
        </label>
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.profileSort')} value={profileSortBy} options={characterProfileSortOptions.map((option) => ({ value: option, label: t(`characters.profileSort.${option}`) }))} onChange={setProfileSortBy} menuPlacement="bottom" />
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.profileKindFilter')} value={profileKindFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...characterProfileKindOptions.map((option) => ({ value: option, label: t(`characters.profileKind.${option}`) }))]} onChange={setProfileKindFilter} menuPlacement="bottom" />
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.profileRoleFilter')} value={profileRoleFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...characterProfileRoleOptions.map((option) => ({ value: option, label: t(`characters.profileRole.${option}`) }))]} onChange={setProfileRoleFilter} menuPlacement="bottom" />
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.profileConfidenceFilter')} value={profileConfidenceFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, { value: 'low', label: t('characters.profileConfidence.low') }, { value: 'high', label: t('characters.profileConfidence.high') }]} onChange={setProfileConfidenceFilter} menuPlacement="bottom" />
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.profileSourceFilter')} value={profileSourceFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...characterProfileSourceOptions.map((option) => ({ value: option, label: t(`characters.profileSource.${option}`) }))]} onChange={setProfileSourceFilter} menuPlacement="bottom" />
      </div>
      {model.items.length === 0 ? (
        <p>{t('characters.profileListEmpty')}</p>
      ) : (
        <div
          className="characters-profile-list characters-profile-list-virtual"
          ref={profileListRef}
          onScroll={(event) => setProfileListScrollTop(event.currentTarget.scrollTop)}
          aria-label={t('characters.profileListVirtualAria', { count: model.summary.filteredCount })}
          style={{ display: 'block', position: 'relative' }}
        >
          <div className="characters-profile-virtual-spacer" style={{ height: `${viewport.totalHeight}px`, position: 'relative' }}>
            {visibleItems.map((item, relativeIndex) => (
              <button
                className={selectedCharacterId === item.id ? 'characters-profile-row active' : 'characters-profile-row'}
                key={item.id}
                type="button"
                onClick={() => onSelectCharacter(item.id)}
                aria-label={t('characters.profileOpenAria', { name: getPrivacyBookTitle(item.label, privacySettings) })}
                style={{
                  height: `${viewport.rowHeight}px`,
                  gridTemplateColumns: 'max-content minmax(110px,1.1fr) minmax(90px,1fr) minmax(64px,.55fr) minmax(44px,.45fr) max-content max-content minmax(92px,.75fr) minmax(92px,.75fr) max-content',
                  left: 0,
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  transform: `translateY(${getCharacterListViewportRowTop(viewport, viewport.startIndex + relativeIndex)}px)`,
                }}
              >
                <b
                  aria-hidden="true"
                  title={getPrivacyBookTitle(item.label, privacySettings)}
                  style={{
                    alignItems: 'center',
                    alignSelf: 'center',
                    background: 'color-mix(in srgb, var(--indigo) 12%, rgba(255,255,255,.28))',
                    border: '1px solid color-mix(in srgb, var(--indigo) 24%, rgba(59,51,42,.12))',
                    borderRadius: '999px',
                    color: 'var(--ink-1)',
                    display: 'inline-flex',
                    fontSize: '11px',
                    fontWeight: 900,
                    height: '28px',
                    justifyContent: 'center',
                    minWidth: '28px',
                    overflow: 'hidden',
                    padding: '0 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.avatarInitials}
                </b>
                <strong title={getPrivacyBookTitle(item.label, privacySettings)}>{getPrivacyBookTitle(item.label, privacySettings)}</strong>
                <span title={item.primaryAliasNames.join('、')}>{item.primaryAliasNames.join('、') || '-'}</span>
                <span>{item.role}</span>
                <span>{formatCharacterGenderLabel(item.gender)}</span>
                <em>{t('characters.profileMentionCount', { count: item.mentionCount })}</em>
                <em>{t('characters.profileRelationCount', { count: item.relationCount })}</em>
                <em>{formatCharacterLocation(item.firstAppearance, t)}</em>
                <em>{formatCharacterLocation(item.lastAppearance, t)}</em>
                <i>{Math.round(item.confidence * 100)}%</i>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const characterProfileSortOptions: CharacterListSortBy[] = ['importance', 'name', 'mention-count', 'relation-count', 'confidence', 'first-appearance', 'last-appearance'];
const characterProfileKindOptions: CharacterProfileKindOption[] = ['person', 'organization', 'place', 'artifact'];
const characterProfileRoleOptions: CharacterProfileRoleOption[] = ['protagonist', 'main', 'supporting', 'minor', 'antagonist'];
const characterProfileSourceOptions: CharacterProfileSourceOption[] = ['manual', 'ai', 'rule'];
const characterProfileRowHeight = 52;
const characterProfileRowGap = 8;
const characterProfileOverscan = 5;

function formatCharacterGenderLabel(gender: string) {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  return '未知';
}

export function renderCharacterAppearanceHeatmap(
  characterPayload: CharacterCenterPayload,
  onOpenLocation: (location: CharacterLocation, label: string) => void,
  privacySettings: ExtendedSettings,
  t: Translator,
) {
  return (
    <CharacterAppearanceHeatmapView
      characterPayload={characterPayload}
      onOpenLocation={onOpenLocation}
      privacySettings={privacySettings}
      t={t}
    />
  );
}

function CharacterAppearanceHeatmapView({
  characterPayload,
  onOpenLocation,
  privacySettings,
  t,
}: {
  characterPayload: CharacterCenterPayload;
  onOpenLocation: (location: CharacterLocation, label: string) => void;
  privacySettings: ExtendedSettings;
  t: Translator;
}) {
  const heatmapChapterListRef = useRef<HTMLDivElement | null>(null);
  const [selectedHeatmapCharacterId, setSelectedHeatmapCharacterId] = useState('all');
  const [heatmapScrollTop, setHeatmapScrollTop] = useState(0);
  const [heatmapListHeight, setHeatmapListHeight] = useState(390);
  const model = useMemo<CharacterAppearanceHeatmapModel>(() => buildCharacterAppearanceHeatmapModel({
    bookId: characterPayload.book.id,
    profiles: characterPayload.profiles,
    appearanceStats: characterPayload.appearanceStats,
    selectedCharacterId: selectedHeatmapCharacterId === 'all' ? null : selectedHeatmapCharacterId,
  }), [characterPayload.appearanceStats, characterPayload.book.id, characterPayload.profiles, selectedHeatmapCharacterId]);
  const selectedChapterBuckets = selectedHeatmapCharacterId === 'all' ? model.chapterBuckets : model.selectedCharacterChapters;
  const maxVisibleMentionCount = Math.max(1, ...selectedChapterBuckets.map((chapter) => (
    selectedHeatmapCharacterId === 'all' ? chapter.mentionCount : chapter.selectedMentionCount
  )));
  const chapterViewport = buildCharacterListViewport({
    totalCount: selectedChapterBuckets.length,
    scrollTop: heatmapScrollTop,
    viewportHeight: heatmapListHeight,
    rowHeight: characterAppearanceChapterRowHeight,
    rowGap: characterAppearanceChapterRowGap,
    overscan: characterAppearanceChapterOverscan,
  });
  const visibleChapterBuckets = selectedChapterBuckets.slice(chapterViewport.startIndex, chapterViewport.endIndex);
  const characterOptions = model.characterRankings.map((item) => ({
    id: item.characterId,
    label: getPrivacyBookTitle(item.label, privacySettings),
  }));

  useEffect(() => {
    setSelectedHeatmapCharacterId('all');
  }, [characterPayload.book.id]);

  useEffect(() => {
    const listElement = heatmapChapterListRef.current;
    if (!listElement) return;
    const updateListHeight = () => setHeatmapListHeight(listElement.clientHeight || 390);
    updateListHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateListHeight);
      return () => window.removeEventListener('resize', updateListHeight);
    }
    const resizeObserver = new ResizeObserver(updateListHeight);
    resizeObserver.observe(listElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setHeatmapScrollTop(0);
    if (heatmapChapterListRef.current) {
      heatmapChapterListRef.current.scrollTop = 0;
    }
  }, [characterPayload.book.id, selectedHeatmapCharacterId]);

  useEffect(() => {
    if (selectedHeatmapCharacterId === 'all') return;
    if (!model.characterRankings.some((item) => item.characterId === selectedHeatmapCharacterId)) {
      setSelectedHeatmapCharacterId('all');
    }
  }, [model.characterRankings, selectedHeatmapCharacterId]);

  return (
    <article className="characters-appearance-heatmap-card" id="characters-heatmap" aria-label={t('characters.appearanceHeatmapTitle')}>
      <div className="characters-profile-board-head">
        <div>
          <p className="eyebrow">{t('characters.appearanceHeatmapEyebrow')}</p>
          <h3>{t('characters.appearanceHeatmapTitle')}</h3>
        </div>
        <span>
          {t('characters.appearanceHeatmapSummary', {
            characters: model.summary.characterCount,
            chapters: model.summary.chapterCount,
            mentions: model.summary.mentionCount,
            evidence: model.summary.evidenceCount,
          })}
        </span>
      </div>
      <div className="characters-profile-tools characters-book-tools">
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.appearanceHeatmapCharacterFilter')} value={selectedHeatmapCharacterId} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...characterOptions.map((option) => ({ value: option.id, label: option.label }))]} onChange={setSelectedHeatmapCharacterId} menuPlacement="bottom" />
      </div>
      {model.characterRankings.length === 0 ? (
        <p>{t('characters.appearanceHeatmapEmpty')}</p>
      ) : (
        <div className="characters-appearance-grid">
          <section className="characters-appearance-ranking" aria-label={t('characters.appearanceHeatmapRankingTitle')}>
            <h4>{t('characters.appearanceHeatmapRankingTitle')}</h4>
            <div className="characters-appearance-ranking-list">
              {model.characterRankings.slice(0, 8).map((item) => {
                const label = getPrivacyBookTitle(item.label, privacySettings);
                const heatRatio = model.characterRankings[0]?.mentionCount ? item.mentionCount / model.characterRankings[0].mentionCount : 0;
                return (
                  <div className="characters-appearance-ranking-row" key={item.characterId}>
                    <strong title={label}>{label}</strong>
                    <span>{t('characters.appearanceHeatmapMentions', { count: item.mentionCount })}</span>
                    <span>{t('characters.appearanceHeatmapChapters', { count: item.chapterCount })}</span>
                    <i>{Math.round(item.confidence * 100)}%</i>
                    <b style={{ inlineSize: `${Math.max(5, Math.round(heatRatio * 100))}%` }} aria-hidden="true" />
                  </div>
                );
              })}
            </div>
          </section>
          <section className="characters-appearance-chapters" aria-label={t('characters.appearanceHeatmapChapterTitle')}>
            <div className="characters-appearance-section-head">
              <h4>{t('characters.appearanceHeatmapChapterTitle')}</h4>
              <span>{model.selectedCharacter ? getPrivacyBookTitle(model.selectedCharacter.label, privacySettings) : t('characters.profileFilterAll')}</span>
            </div>
            <div className="characters-appearance-chapter-list">
              {selectedChapterBuckets.length === 0 ? (
                <p>{t('characters.appearanceHeatmapChapterEmpty')}</p>
              ) : (
                <div
                  ref={heatmapChapterListRef}
                  className="characters-appearance-chapter-viewport"
                  onScroll={(event) => setHeatmapScrollTop(event.currentTarget.scrollTop)}
                >
                  <div className="characters-appearance-chapter-spacer" style={{ height: `${chapterViewport.totalHeight}px` }}>
                    {visibleChapterBuckets.map((chapter, relativeIndex) => {
                      const visibleMentionCount = selectedHeatmapCharacterId === 'all' ? chapter.mentionCount : chapter.selectedMentionCount;
                      const heatRatio = visibleMentionCount / maxVisibleMentionCount;
                      const chapterTitle = getPrivacyBookTitle(chapter.chapterTitle || formatCharacterLocation(chapter.location, t), privacySettings);
                      return (
                        <div
                          className="characters-appearance-chapter-row"
                          key={chapter.id}
                          style={{
                            height: `${characterAppearanceChapterRowHeight}px`,
                            top: `${getCharacterListViewportRowTop(chapterViewport, chapterViewport.startIndex + relativeIndex)}px`,
                          }}
                        >
                          <div>
                            <strong title={chapterTitle}>{chapterTitle}</strong>
                            <span>
                              {t('characters.appearanceHeatmapMentions', { count: visibleMentionCount })}
                              {' · '}
                              {t('characters.appearanceHeatmapChapterCharacters', { count: chapter.characterCount })}
                            </span>
                          </div>
                          <div className="characters-appearance-bar" aria-hidden="true">
                            <i style={{ inlineSize: `${Math.max(4, Math.round(heatRatio * 100))}%` }} />
                          </div>
                          <button
                            className="ghost-btn small"
                            type="button"
                            onClick={() => onOpenLocation(chapter.location, chapterTitle)}
                            aria-label={t('characters.appearanceHeatmapJumpChapterAria', { title: chapterTitle })}
                          >
                            {t('characters.appearanceHeatmapJumpChapter')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

const characterAppearanceChapterRowHeight = 58;
const characterAppearanceChapterRowGap = 8;
const characterAppearanceChapterOverscan = 6;

function formatCharacterLocation(location: CharacterLocation | undefined, t: Translator) {
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

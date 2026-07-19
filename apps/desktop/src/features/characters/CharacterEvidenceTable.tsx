import { useEffect, useMemo, useRef, useState } from 'react';
import { redactTaskText } from '../task-center/taskPrivacy';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Translator } from '../../i18n';
import type { CharacterCenterPayload, CharacterEvidence, CharacterExtractionSource, CharacterLocation, CharacterRelation } from '../../types';
import { buildCharacterListViewport, getCharacterListViewportRowTop } from './characterListViewport';
import { formatCharacterEvidenceCitationCopy } from './characterEvidenceCitation';
import { ThemedSelect } from '../../components/ThemedSelect';

type CharacterEvidenceLookup = {
  profileById: Map<string, CharacterCenterPayload['profiles'][number]>;
  aliasById: Map<string, CharacterCenterPayload['profiles'][number]['aliases'][number]>;
  profileIdByAliasId: Map<string, string>;
  mentionById: Map<string, CharacterCenterPayload['mentions'][number]>;
  relationById: Map<string, CharacterCenterPayload['relations'][number]>;
  relationByEvidenceId: Map<string, CharacterCenterPayload['relations'][number]>;
  eventById: Map<string, CharacterCenterPayload['events'][number]>;
  factionById: Map<string, CharacterCenterPayload['factionMemberships'][number]>;
};

const characterEvidenceLookupCache = new WeakMap<CharacterCenterPayload, CharacterEvidenceLookup>();
const characterEvidenceRowHeight = 84;
const characterEvidenceRowGap = 8;
const characterEvidenceOverscan = 6;

export function renderCharacterEvidenceTable(
  characterPayload: CharacterCenterPayload,
  onOpenEvidence: (evidence: CharacterEvidence) => void,
  privacySettings: ExtendedSettings,
  t: Translator,
) {
  return (
    <CharacterEvidenceTable
      characterPayload={characterPayload}
      onOpenEvidence={onOpenEvidence}
      privacySettings={privacySettings}
      t={t}
    />
  );
}

function CharacterEvidenceTable({
  characterPayload,
  onOpenEvidence,
  privacySettings,
  t,
}: {
  characterPayload: CharacterCenterPayload;
  onOpenEvidence: (evidence: CharacterEvidence) => void;
  privacySettings: ExtendedSettings;
  t: Translator;
}) {
  const evidenceTableRef = useRef<HTMLDivElement | null>(null);
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [evidenceCharacterFilter, setEvidenceCharacterFilter] = useState('all');
  const [evidenceRelationFilter, setEvidenceRelationFilter] = useState('all');
  const [evidenceChapterFilter, setEvidenceChapterFilter] = useState('all');
  const [evidenceListScrollTop, setEvidenceListScrollTop] = useState(0);
  const [evidenceListHeight, setEvidenceListHeight] = useState(360);
  const privacyMode = Boolean(privacySettings.applicationPrivacyMode);

  const evidenceCharacterOptions = useMemo(() => {
    return characterPayload.profiles
      .map((profile) => ({
        id: profile.id,
        label: getPrivacyBookTitle(profile.displayName || profile.canonicalName, privacySettings),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [characterPayload.profiles, privacySettings]);

  const evidenceRelationOptions = useMemo(() => {
    return characterPayload.relations
      .map((relation) => ({
        id: relation.id,
        label: formatCharacterRelationOption(relation, characterPayload, privacySettings, t),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [characterPayload, privacySettings, t]);

  const evidenceChapterOptions = useMemo(() => {
    const optionByKey = new Map<string, string>();
    for (const item of characterPayload.evidence) {
      const key = getCharacterEvidenceChapterKey(item.location);
      if (!key) continue;
      const locationLabel = formatCharacterLocation(item.location, t);
      optionByKey.set(key, formatCharacterEvidenceChapterLabel(item.location, t) || locationLabel);
    }
    return [...optionByKey.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [characterPayload.evidence, t]);

  const filteredEvidence = useMemo(() => {
    const normalizedQuery = evidenceQuery.trim().toLocaleLowerCase();
    return characterPayload.evidence.filter((item) => {
      const targetLabel = formatCharacterEvidenceTarget(item, characterPayload, privacySettings, t);
      const locationLabel = formatCharacterLocation(item.location, t);
      const sourceLabel = formatCharacterEvidenceSource(item.source, t);
      const typeLabel = formatCharacterEvidenceType(item.targetType, t);
      const searchableText = [
        item.claim,
        item.quote,
        item.source,
        item.status,
        typeLabel,
        targetLabel,
        locationLabel,
        sourceLabel,
      ].join(' ').toLocaleLowerCase();
      if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false;
      if (evidenceCharacterFilter !== 'all' && !getCharacterIdsForEvidence(item, characterPayload).includes(evidenceCharacterFilter)) return false;
      if (evidenceRelationFilter !== 'all' && !isEvidenceForRelation(item, characterPayload, evidenceRelationFilter)) return false;
      if (evidenceChapterFilter !== 'all' && getCharacterEvidenceChapterKey(item.location) !== evidenceChapterFilter) return false;
      return true;
    });
  }, [characterPayload, evidenceChapterFilter, evidenceCharacterFilter, evidenceQuery, evidenceRelationFilter, privacySettings, t]);

  const viewport = buildCharacterListViewport({
    totalCount: filteredEvidence.length,
    scrollTop: evidenceListScrollTop,
    viewportHeight: evidenceListHeight,
    rowHeight: characterEvidenceRowHeight,
    rowGap: characterEvidenceRowGap,
    overscan: characterEvidenceOverscan,
  });
  const visibleEvidence = filteredEvidence.slice(viewport.startIndex, viewport.endIndex);

  useEffect(() => {
    setEvidenceQuery('');
    setEvidenceCharacterFilter('all');
    setEvidenceRelationFilter('all');
    setEvidenceChapterFilter('all');
  }, [characterPayload.book.id]);

  useEffect(() => {
    const tableElement = evidenceTableRef.current;
    if (!tableElement) return;
    const updateListHeight = () => setEvidenceListHeight(tableElement.clientHeight || 360);
    updateListHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateListHeight);
      return () => window.removeEventListener('resize', updateListHeight);
    }
    const resizeObserver = new ResizeObserver(updateListHeight);
    resizeObserver.observe(tableElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setEvidenceListScrollTop(0);
    if (evidenceTableRef.current) {
      evidenceTableRef.current.scrollTop = 0;
    }
  }, [characterPayload.book.id, evidenceChapterFilter, evidenceCharacterFilter, evidenceQuery, evidenceRelationFilter]);

  return (
    <article className="characters-evidence-table-card" id="characters-evidence" tabIndex={-1} aria-label={t('characters.evidenceTableTitle')}>
      <div className="characters-profile-board-head">
        <div>
          <p className="eyebrow">{t('characters.evidenceTableEyebrow')}</p>
          <h3>{t('characters.evidenceTableTitle')}</h3>
        </div>
        <span>{t('characters.evidenceTableSummary', { visible: filteredEvidence.length, total: characterPayload.evidence.length })}</span>
      </div>
      <div className="characters-profile-tools characters-book-tools">
        <label className="characters-book-search">
          <span>{t('characters.evidenceTableSearch')}</span>
          <input
            type="search"
            value={evidenceQuery}
            onChange={(event) => setEvidenceQuery(event.target.value)}
            placeholder={t('characters.evidenceTableSearchPlaceholder')}
            aria-label={t('characters.evidenceTableSearchPlaceholder')}
          />
        </label>
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.evidenceTableCharacterFilter')} value={evidenceCharacterFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...evidenceCharacterOptions.map((option) => ({ value: option.id, label: option.label }))]} onChange={setEvidenceCharacterFilter} menuPlacement="bottom" />
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.evidenceTableRelationFilter')} value={evidenceRelationFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...evidenceRelationOptions.map((option) => ({ value: option.id, label: option.label }))]} onChange={setEvidenceRelationFilter} menuPlacement="bottom" />
        <ThemedSelect className="characters-book-filter characters-themed-filter" label={t('characters.evidenceTableChapterFilter')} value={evidenceChapterFilter} options={[{ value: 'all', label: t('characters.profileFilterAll') }, ...evidenceChapterOptions.map((option) => ({ value: option.id, label: option.label }))]} onChange={setEvidenceChapterFilter} menuPlacement="bottom" />
      </div>
      {filteredEvidence.length === 0 ? (
        <p>{t('characters.evidenceTableEmpty')}</p>
      ) : (
        <div
          ref={evidenceTableRef}
          className="characters-evidence-table-scroll"
          role="table"
          aria-label={t('characters.evidenceTableTitle')}
          aria-rowcount={filteredEvidence.length + 1}
          onScroll={(event) => setEvidenceListScrollTop(event.currentTarget.scrollTop)}
        >
          <div className="characters-evidence-row characters-evidence-header" role="row" aria-rowindex={1}>
            <span role="columnheader">{t('characters.evidenceTableType')}</span>
            <span role="columnheader">{t('characters.evidenceTableQuote')}</span>
            <span role="columnheader">{t('characters.evidenceTableTarget')}</span>
            <span role="columnheader">{t('characters.evidenceTableLocation')}</span>
            <span role="columnheader">{t('characters.evidenceTableSource')}</span>
            <span role="columnheader">{t('characters.evidenceTableConfidence')}</span>
            <span role="columnheader">{t('characters.evidenceTableAction')}</span>
          </div>
          <div className="characters-evidence-virtual-spacer" style={{ height: `${viewport.totalHeight}px` }}>
            {visibleEvidence.map((item, relativeIndex) => {
              const targetLabel = formatCharacterEvidenceTarget(item, characterPayload, privacySettings, t);
              const locationLabel = formatCharacterLocation(item.location, t);
              const excerpt = redactTaskText(item.quote || item.claim, privacyMode);
              const claim = redactTaskText(item.claim, privacyMode);
              return (
                <div
                  className="characters-evidence-row"
                  role="row"
                  key={item.id}
                  aria-rowindex={viewport.startIndex + relativeIndex + 2}
                  style={{
                    height: `${characterEvidenceRowHeight}px`,
                    top: `${getCharacterListViewportRowTop(viewport, viewport.startIndex + relativeIndex)}px`,
                  }}
                >
                  <span role="cell">{formatCharacterEvidenceType(item.targetType, t)}</span>
                  <span className="characters-evidence-quote" role="cell" title={redactTaskText(item.quote || item.claim, privacyMode)}>
                    <strong>{excerpt || '-'}</strong>
                    {claim && claim !== excerpt ? <em>{claim}</em> : null}
                  </span>
                  <span role="cell" title={formatCharacterEvidenceTarget(item, characterPayload, privacySettings, t)}>{targetLabel}</span>
                  <span role="cell" title={formatCharacterLocation(item.location, t)}>{locationLabel}</span>
                  <span role="cell">{formatCharacterEvidenceSource(item.source, t)} · {formatCharacterEvidenceStatus(item.status, t)}</span>
                  <span role="cell">{Math.round(item.confidence * 100)}%</span>
                  <span className="characters-evidence-actions" role="cell">
                    <button
                      className="ghost-btn small"
                      type="button"
                      onClick={() => onOpenEvidence(item)}
                      aria-label={t('characters.evidenceTableJumpEvidence')}
                    >
                      {t('characters.evidenceTableJumpEvidence')}
                    </button>
                    <button
                      className="ghost-btn small"
                      type="button"
                      onClick={() => copyCharacterEvidenceCitation(item, characterPayload, targetLabel, locationLabel, privacySettings, t)}
                      aria-label={t('characters.evidenceTableCopyCitationAria')}
                    >
                      {t('characters.evidenceTableCopyCitation')}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function copyCharacterEvidenceCitation(
  item: CharacterEvidence,
  characterPayload: CharacterCenterPayload,
  targetLabel: string,
  locationLabel: string,
  privacySettings: ExtendedSettings,
  t: Translator,
) {
  const privacyMode = Boolean(privacySettings.applicationPrivacyMode);
  const bookTitle = getPrivacyBookTitle(characterPayload.book.displayTitle || characterPayload.book.title, privacySettings);
  const sourceLabel = `${formatCharacterEvidenceSource(item.source, t)} · ${formatCharacterEvidenceStatus(item.status, t)}`;
  const payload = formatCharacterEvidenceCitationCopy({
    evidenceId: item.id,
    bookTitle,
    typeLabel: formatCharacterEvidenceType(item.targetType, t),
    targetLabel,
    locationLabel,
    quote: item.quote,
    claim: item.claim,
    sourceLabel,
    confidencePercent: item.confidence * 100,
    privacyMode,
    privateValue: t('characters.evidenceCitationPrivateValue'),
    labels: {
      heading: t('characters.evidenceCitationHeading'),
      book: t('characters.evidenceCitationBook'),
      type: t('characters.evidenceCitationType'),
      target: t('characters.evidenceCitationTarget'),
      location: t('characters.evidenceCitationLocation'),
      quote: t('characters.evidenceCitationQuote'),
      claim: t('characters.evidenceCitationClaim'),
      source: t('characters.evidenceCitationSource'),
      confidence: t('characters.evidenceCitationConfidence'),
      evidenceId: t('characters.evidenceCitationEvidenceId'),
      missingValue: t('characters.evidenceCitationMissingValue'),
    },
  });
  void navigator.clipboard?.writeText(payload);
}

function getCharacterEvidenceLookup(characterPayload: CharacterCenterPayload) {
  const cached = characterEvidenceLookupCache.get(characterPayload);
  if (cached) return cached;

  const profileById = new Map(characterPayload.profiles.map((profile) => [profile.id, profile]));
  const aliasById = new Map<string, CharacterCenterPayload['profiles'][number]['aliases'][number]>();
  const profileIdByAliasId = new Map<string, string>();
  for (const profile of characterPayload.profiles) {
    for (const alias of profile.aliases) {
      aliasById.set(alias.id, alias);
      profileIdByAliasId.set(alias.id, profile.id);
    }
  }
  const mentionById = new Map(characterPayload.mentions.map((mention) => [mention.id, mention]));
  const relationById = new Map(characterPayload.relations.map((relation) => [relation.id, relation]));
  const relationByEvidenceId = new Map<string, CharacterCenterPayload['relations'][number]>();
  for (const relation of characterPayload.relations) {
    for (const evidenceId of relation.evidenceIds) {
      if (!relationByEvidenceId.has(evidenceId)) relationByEvidenceId.set(evidenceId, relation);
    }
  }
  const eventById = new Map(characterPayload.events.map((event) => [event.id, event]));
  const factionById = new Map<string, CharacterCenterPayload['factionMemberships'][number]>();
  for (const faction of characterPayload.factionMemberships) {
    factionById.set(faction.id, faction);
    if (faction.factionId) factionById.set(faction.factionId, faction);
  }

  const lookup = {
    profileById,
    aliasById,
    profileIdByAliasId,
    mentionById,
    relationById,
    relationByEvidenceId,
    eventById,
    factionById,
  };
  characterEvidenceLookupCache.set(characterPayload, lookup);
  return lookup;
}

function formatCharacterEvidenceTarget(
  item: CharacterEvidence,
  characterPayload: CharacterCenterPayload,
  privacySettings: ExtendedSettings,
  t: Translator,
) {
  const lookup = getCharacterEvidenceLookup(characterPayload);
  const targetType = item.targetType;
  if (targetType === 'relation') {
    const relation = lookup.relationById.get(item.targetId) ?? lookup.relationByEvidenceId.get(item.id);
    if (relation) {
      const sourceCharacterId = relation.sourceCharacterId;
      const targetCharacterId = relation.targetCharacterId;
      const sourceName = findCharacterProfileName(characterPayload, sourceCharacterId, privacySettings);
      const targetName = findCharacterProfileName(characterPayload, targetCharacterId, privacySettings);
      const label = getPrivacyBookTitle(relation.label || relation.relationType || t('characters.detailUnknownRelation'), privacySettings);
      return `${sourceName} ${relation.direction === 'undirected' ? '<->' : '->'} ${targetName} · ${label}`;
    }
  }
  if (targetType === 'profile') {
    return findCharacterProfileName(characterPayload, item.targetId, privacySettings);
  }
  if (targetType === 'mention') {
    const mention = lookup.mentionById.get(item.targetId);
    return mention ? findCharacterProfileName(characterPayload, mention.characterId, privacySettings) : item.targetId;
  }
  if (targetType === 'event') {
    const event = lookup.eventById.get(item.targetId);
    return getPrivacyBookTitle(event?.title || event?.summary || item.targetId, privacySettings);
  }
  if (targetType === 'faction') {
    const faction = lookup.factionById.get(item.targetId);
    return getPrivacyBookTitle(faction?.factionName || item.targetId, privacySettings);
  }
  if (targetType === 'alias') {
    const profileId = lookup.profileIdByAliasId.get(item.targetId);
    const profile = profileId ? lookup.profileById.get(profileId) : undefined;
    const alias = lookup.aliasById.get(item.targetId);
    return getPrivacyBookTitle(alias?.name || profile?.displayName || profile?.canonicalName || item.targetId, privacySettings);
  }
  return `${formatCharacterEvidenceType(targetType, t)} · ${item.targetId}`;
}

function formatCharacterRelationOption(
  relation: CharacterRelation,
  characterPayload: CharacterCenterPayload,
  privacySettings: ExtendedSettings,
  t: Translator,
) {
  const sourceName = findCharacterProfileName(characterPayload, relation.sourceCharacterId, privacySettings);
  const targetName = findCharacterProfileName(characterPayload, relation.targetCharacterId, privacySettings);
  const relationLabel = getPrivacyBookTitle(relation.label || relation.relationType || t('characters.detailUnknownRelation'), privacySettings);
  return `${sourceName} ${relation.direction === 'undirected' ? '<->' : '->'} ${targetName} · ${relationLabel}`;
}

function findCharacterProfileName(characterPayload: CharacterCenterPayload, characterId: string, privacySettings: ExtendedSettings) {
  const profile = getCharacterEvidenceLookup(characterPayload).profileById.get(characterId);
  return getPrivacyBookTitle(profile?.displayName || profile?.canonicalName || characterId, privacySettings);
}

function getCharacterIdsForEvidence(item: CharacterEvidence, characterPayload: CharacterCenterPayload) {
  const lookup = getCharacterEvidenceLookup(characterPayload);
  if (item.targetType === 'profile') return [item.targetId];
  if (item.targetType === 'alias') {
    const profileId = lookup.profileById.has(item.targetId) ? item.targetId : lookup.profileIdByAliasId.get(item.targetId);
    return profileId ? [profileId] : [];
  }
  if (item.targetType === 'mention') {
    const mention = lookup.mentionById.get(item.targetId);
    return mention ? [mention.characterId] : [];
  }
  if (item.targetType === 'relation') {
    const relation = lookup.relationById.get(item.targetId) ?? lookup.relationByEvidenceId.get(item.id);
    return relation ? [relation.sourceCharacterId, relation.targetCharacterId] : [];
  }
  if (item.targetType === 'event') {
    const event = lookup.eventById.get(item.targetId);
    return event?.participantCharacterIds ?? [];
  }
  if (item.targetType === 'faction') {
    const faction = lookup.factionById.get(item.targetId);
    return faction ? [faction.characterId] : [];
  }
  return [];
}

function isEvidenceForRelation(item: CharacterEvidence, characterPayload: CharacterCenterPayload, relationId: string) {
  const relation = getCharacterEvidenceLookup(characterPayload).relationById.get(relationId);
  return Boolean(relation && (item.targetId === relation.id || relation.evidenceIds.includes(item.id)));
}

function getCharacterEvidenceChapterKey(location: CharacterEvidence['location']) {
  if (location.chapterId) return `chapter-id:${location.chapterId}`;
  if (typeof location.sourceChapterIndex === 'number') return `source:${location.sourceChapterIndex}`;
  if (typeof location.chapterIndex === 'number') return `chapter:${location.chapterIndex}`;
  if (typeof location.visibleChapterPosition === 'number') return `visible:${location.visibleChapterPosition}`;
  if (location.chapterTitle) return `title:${location.chapterTitle}`;
  return '';
}

function formatCharacterEvidenceChapterLabel(location: CharacterEvidence['location'], t: Translator) {
  if (location.chapterTitle) return location.chapterTitle;
  if (typeof location.visibleChapterPosition === 'number') return t('characters.detailChapterFallback', { count: location.visibleChapterPosition });
  if (typeof location.sourceChapterIndex === 'number') return t('characters.detailChapterFallback', { count: location.sourceChapterIndex + 1 });
  if (typeof location.chapterIndex === 'number') return t('characters.detailChapterFallback', { count: location.chapterIndex + 1 });
  return '';
}

function formatCharacterEvidenceSource(source: CharacterExtractionSource, t: Translator) {
  if (source === 'manual') return t('characters.profileSource.manual');
  if (source === 'ai') return t('characters.profileSource.ai');
  if (source === 'imported') return t('characters.profileSource.imported');
  return t('characters.profileSource.rule');
}

function formatCharacterEvidenceStatus(status: CharacterEvidence['status'], t: Translator) {
  if (status === 'valid') return t('characters.evidenceStatus.valid');
  if (status === 'stale') return t('characters.evidenceStatus.stale');
  if (status === 'broken') return t('characters.evidenceStatus.broken');
  return t('characters.evidenceStatus.pendingReview');
}

function formatCharacterEvidenceType(targetType: CharacterEvidence['targetType'], t: Translator) {
  if (targetType === 'profile') return t('characters.evidenceTarget.profile');
  if (targetType === 'alias') return t('characters.evidenceTarget.alias');
  if (targetType === 'mention') return t('characters.evidenceTarget.mention');
  if (targetType === 'relation') return t('characters.evidenceTarget.relation');
  if (targetType === 'event') return t('characters.evidenceTarget.event');
  return t('characters.evidenceTarget.faction');
}

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

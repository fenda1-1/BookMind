import type { CharacterCenterBookSummary, CharacterCenterPayload, CharacterEvent, CharacterEvidence, CharacterFactionMembership, CharacterIndexStatus, CharacterLocation, CharacterOverviewSnapshot, CharacterRelation } from '../types';
import { useI18n, type TranslationKey } from '../i18n';
import { getPrivacyBookTitle } from '../services/settingsCenterService';
import type { ExtendedSettings } from '../services/settingsCenterService';
import { buildCharacterOverviewMetrics } from '../features/characters/characterOverviewMetrics';
import { buildCharacterProfileDetail, type CharacterProfileDetail } from '../features/characters/characterProfileDetail';
import type { CharacterGraphEdgeDetail } from '../features/characters/characterGraphEdgeDetail';
import { renderCharacterGraphEdgeDetail } from '../features/characters/CharacterRelationGraphView';
import { buildCharacterEvidenceReaderOpenDetail, buildCharacterLocationReaderOpenDetail } from '../features/characters/characterEvidenceNavigation';
import type { CharacterCenterPrimaryAction, CharacterCenterSecondaryAction, CharacterCenterState } from '../features/characters/characterCenterState';
import { buildTextIndexViewFromSummary, canQueueCharacterRebuild, characterStatusLabel, formatCharacterLocation, isOpenableCharacterLocation, renderCharacterCenterSecondaryAction } from './CharacterPageUtils';

export function renderCharacterStubWorkbenchView(
  eyebrowKey: TranslationKey,
  titleKey: TranslationKey,
  bodyKey: TranslationKey,
  t: ReturnType<typeof useI18n>['t'],
) {
  return (
    <article className="characters-placeholder-board">
      <div>
        <p className="eyebrow">{t(eyebrowKey)}</p>
        <h3>{t(titleKey)}</h3>
        <p>{t(bodyKey)}</p>
      </div>
    </article>
  );
}

export function renderCharacterInspectorPanel(
  selectedCharacterDetail: CharacterProfileDetail | null,
  selectedRelationDetail: CharacterGraphEdgeDetail | null,
  selectedBook: CharacterCenterBookSummary,
  characterPayload: CharacterCenterPayload | null,
  metrics: ReturnType<typeof buildCharacterOverviewMetrics>,
  centerState: CharacterCenterState,
  onCloseRelationDetail: () => void,
  openCharacterEvidenceInReader: (evidence: CharacterEvidence) => void,
  openCharacterLocationInReader: (location: CharacterLocation, label: string) => void,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (selectedRelationDetail) {
    return renderCharacterGraphEdgeDetail(
      selectedRelationDetail,
      onCloseRelationDetail,
      openCharacterEvidenceInReader,
      privacySettings,
      t,
      (location) => formatCharacterLocation(location, t),
      (relation) => formatCharacterRelationMeta(relation, t),
    );
  }
  if (selectedCharacterDetail) {
    return renderCharacterProfileDetail(selectedCharacterDetail, selectedBook, openCharacterEvidenceInReader, openCharacterLocationInReader, privacySettings, t);
  }
  return renderCharacterBookInspectorSummary(selectedBook, characterPayload, metrics, centerState, privacySettings, t);
}

export function renderCharacterBookInspectorSummary(
  selectedBook: CharacterCenterBookSummary,
  characterPayload: CharacterCenterPayload | null,
  metrics: ReturnType<typeof buildCharacterOverviewMetrics>,
  centerState: CharacterCenterState,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  return (
    <article className="characters-detail-panel" id="characters-detail" aria-label={t('characters.inspectorSummaryAria')}>
      <div className="characters-detail-head">
        <div>
          <p className="eyebrow">{t('characters.inspectorSummaryEyebrow')}</p>
          <h3>{getPrivacyBookTitle(selectedBook.displayTitle || selectedBook.title, privacySettings)}</h3>
          <p>{t(centerState.readinessBodyKey, centerState.readinessBodyParams)}</p>
        </div>
        <span>{characterStatusLabel(selectedBook.characterIndexStatus, t)}</span>
      </div>
      <dl className="characters-detail-metrics">
        {metrics.slice(0, 4).map((metric) => (
          <div key={metric.id}><dt>{t(metric.labelKey)}</dt><dd>{metric.value}</dd></div>
        ))}
      </dl>
      <section className="characters-detail-section">
        <h4>{t('characters.inspectorSummaryData')}</h4>
        <p>{characterPayload ? t('characters.inspectorSummaryReady', { count: characterPayload.profiles.length }) : t('characters.inspectorSummaryMissing')}</p>
      </section>
    </article>
  );
}

export function renderCharacterCenterPrimaryAction(
  action: CharacterCenterPrimaryAction,
  indexing: boolean,
  extractingCharacters: boolean,
  runParseIndex: () => void,
  queueCharacterExtraction: (options?: { confirmRebuild?: boolean }) => void,
  onOpenTasks: () => void,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (action === 'none') return null;
  if (action === 'open-tasks') {
    return <button className="primary-btn" type="button" onClick={onOpenTasks} aria-label={t('characters.openTasksAria')}>{t('characters.openTasks')}</button>;
  }
  if (action === 'character-extraction' || action === 'rebuild-character-index') {
    const labelKey = action === 'rebuild-character-index' ? 'characters.rebuildCharacterIndex' : 'characters.extractCharacters';
    const ariaKey = action === 'rebuild-character-index' ? 'characters.rebuildCharacterIndexAria' : 'characters.extractCharactersAria';
    const handleClick = action === 'rebuild-character-index'
      ? () => queueCharacterExtraction({ confirmRebuild: true })
      : () => queueCharacterExtraction();
    return (
      <button className="primary-btn" type="button" onClick={handleClick} disabled={extractingCharacters} aria-label={t(extractingCharacters ? 'characters.extractingAria' : ariaKey)}>
        {extractingCharacters ? t('characters.extracting') : t(labelKey)}
      </button>
    );
  }
  return (
    <button className="primary-btn" type="button" onClick={runParseIndex} disabled={indexing} aria-label={t(indexing ? 'characters.indexingAria' : action === 'rebuild-text-index' ? 'characters.rebuildTextIndexAria' : 'characters.runTextIndexAria')}>
      {indexing ? t('characters.indexing') : action === 'rebuild-text-index' ? t('characters.rebuildTextIndex') : t('characters.runTextIndex')}
    </button>
  );
}

export function renderManualTextIndexRebuildAction(
  primaryAction: CharacterCenterPrimaryAction,
  selectedIndexView: ReturnType<typeof buildTextIndexViewFromSummary>,
  indexing: boolean,
  runParseIndex: () => void,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (!selectedIndexView.ready) return null;
  if (primaryAction === 'build-text-index' || primaryAction === 'rebuild-text-index') return null;
  return (
    <button
      className="ghost-btn"
      type="button"
      onClick={runParseIndex}
      disabled={indexing}
      aria-label={t(indexing ? 'characters.indexingAria' : 'characters.rebuildTextIndexAria')}
    >
      {indexing ? t('characters.indexing') : t('characters.rebuildTextIndex')}
    </button>
  );
}

export function renderManualCharacterRebuildAction(
  primaryAction: CharacterCenterPrimaryAction,
  selectedIndexView: ReturnType<typeof buildTextIndexViewFromSummary>,
  characterStatus: CharacterIndexStatus,
  extractingCharacters: boolean,
  queueCharacterExtraction: (options?: { confirmRebuild?: boolean }) => void,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (!selectedIndexView.ready) return null;
  if (primaryAction === 'character-extraction' || primaryAction === 'rebuild-character-index') return null;
  if (characterStatus === 'queued' || characterStatus === 'building' || characterStatus === 'blocked-by-text-index') return null;
  return (
    <button
      className="ghost-btn"
      type="button"
      onClick={() => queueCharacterExtraction({ confirmRebuild: true })}
      disabled={extractingCharacters}
      aria-label={t(extractingCharacters ? 'characters.extractingAria' : 'characters.rebuildCharacterIndexAria')}
    >
      {extractingCharacters ? t('characters.extracting') : t('characters.rebuildCharacterIndex')}
    </button>
  );
}

export function compareCharacterLocation(left: CharacterLocation | undefined, right: CharacterLocation | undefined) {
  return characterLocationSortValue(left) - characterLocationSortValue(right);
}

export function characterLocationSortValue(location: CharacterLocation | undefined) {
  if (!location) return -1;
  const chapter = location.sourceChapterIndex ?? location.chapterIndex ?? ((location.visibleChapterPosition ?? 1) - 1);
  const paragraph = location.paragraphIndex ?? location.paragraphStart ?? 0;
  const offset = location.startOffset ?? 0;
  return chapter * 1_000_000 + paragraph * 1_000 + offset;
}

export function renderCharacterProfileDetail(
  detail: CharacterProfileDetail,
  selectedBook: CharacterCenterBookSummary,
  onOpenEvidence: (evidence: CharacterEvidence) => void,
  onOpenLocation: (location: CharacterLocation, label: string) => void,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  const displayName = getPrivacyBookTitle(detail.profile.displayName || detail.profile.canonicalName, privacySettings);
  const aliasNames = detail.aliases.map((alias) => getPrivacyBookTitle(alias.name, privacySettings)).filter(Boolean);
  const mentions = detail.mentions.slice(0, 6);
  const evidence = detail.evidence.slice(0, 6);
  const relations = detail.relations.slice(0, 6);
  const events = detail.events.slice(0, 6);
  const factions = detail.factionMemberships.slice(0, 6);
  const relatedProfileById = new Map(detail.relatedProfiles.map((profile) => [profile.id, profile]));
  const sourceStateLabel = t(detail.meta.sourceStateLabelKey);
  return (
    <article className="characters-detail-panel" id="characters-detail" aria-label={t('characters.detailAria', { name: displayName })}>
      <div className="characters-detail-head">
        <div>
          <p className="eyebrow">{t('characters.detailEyebrow')}</p>
          <h3>{displayName}</h3>
          <p>{detail.profile.summary || t('characters.detailNoSummary')}</p>
        </div>
        <span>{Math.round(detail.profile.confidence * 100)}%</span>
      </div>
      <dl className="characters-detail-metrics">
        <div><dt>{t('characters.detailRole')}</dt><dd>{detail.profile.role || '-'}</dd></div>
        <div><dt>{t('characters.detailKind')}</dt><dd>{detail.profile.kind || '-'}</dd></div>
        <div><dt>{t('characters.detailImportance')}</dt><dd>{detail.meta.importancePercent}%</dd></div>
        <div><dt>{t('characters.detailSource')}</dt><dd>{t(detail.meta.sourceLabelKey)} · {sourceStateLabel}</dd></div>
        <div><dt>{t('characters.detailMentions')}</dt><dd>{String(detail.counts.mentions)}</dd></div>
        <div><dt>{t('characters.detailRelations')}</dt><dd>{String(detail.counts.relations)}</dd></div>
        <div><dt>{t('characters.detailEvents')}</dt><dd>{String(detail.counts.events)}</dd></div>
        <div><dt>{t('characters.detailEvidence')}</dt><dd>{String(detail.counts.evidence)}</dd></div>
      </dl>
      <section className="characters-detail-section">
        <h4>{t('characters.detailAliases')}</h4>
        {aliasNames.length > 0 ? (
          <div className="characters-detail-chip-row">
            {aliasNames.map((aliasName) => <span key={aliasName}>{aliasName}</span>)}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailTags')}</h4>
        {detail.meta.tags.length > 0 ? (
          <div className="characters-detail-chip-row">
            {detail.meta.tags.map((tag) => <span key={tag}>{getPrivacyBookTitle(tag, privacySettings)}</span>)}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailAppearances')}</h4>
        <div className="characters-detail-location-grid">
          {renderCharacterLocation(t('characters.detailFirstAppearance'), detail.profile.firstAppearance, onOpenLocation, t)}
          {renderCharacterLocation(t('characters.detailLastAppearance'), detail.profile.lastAppearance, onOpenLocation, t)}
        </div>
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailMentionsTitle')}</h4>
        {mentions.length > 0 ? (
          <div className="characters-detail-quote-list">
            {mentions.map((mention) => (
              <blockquote key={mention.id}>
                <p>{mention.quote}</p>
                <cite>{formatCharacterLocation(mention.location, t)}</cite>
              </blockquote>
            ))}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailRelationsTitle')}</h4>
        {relations.length > 0 ? (
          <div className="characters-detail-record-list">
            {relations.map((relation) => (
              <article key={relation.id}>
                <strong>{formatCharacterRelationHeading(relation, detail.profile.id, relatedProfileById, privacySettings, t)}</strong>
                <p>{relation.summary || relation.label || relation.relationType || t('characters.detailUnknownRelation')}</p>
                <span>{formatCharacterRelationMeta(relation, t)}</span>
              </article>
            ))}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailEventsTitle')}</h4>
        {events.length > 0 ? (
          <div className="characters-detail-record-list">
            {events.map((event) => (
              <article key={event.id}>
                <strong>{event.title || t('characters.detailUntitledEvent')}</strong>
                <p>{event.summary || event.eventType}</p>
                <span>{formatCharacterEventMeta(event, t)}</span>
              </article>
            ))}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailFactionsTitle')}</h4>
        {factions.length > 0 ? (
          <div className="characters-detail-record-list">
            {factions.map((faction) => (
              <article key={faction.id}>
                <strong>{getPrivacyBookTitle(faction.factionName, privacySettings)}</strong>
                <p>{[faction.role, faction.status].filter(Boolean).join(' · ') || t('characters.detailNone')}</p>
                <span>{formatCharacterFactionMeta(faction, t)}</span>
              </article>
            ))}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.detailEvidenceTitle')}</h4>
        {evidence.length > 0 ? (
          <div className="characters-detail-quote-list">
            {evidence.map((item) => (
              <blockquote key={item.id}>
                <p>{item.quote || item.claim}</p>
                <cite>{formatCharacterLocation(item.location, t)}</cite>
                <button
                  className="ghost-btn small"
                  type="button"
                  onClick={() => onOpenEvidence(item)}
                  aria-label={t('characters.detailJumpEvidenceAria', { title: getPrivacyBookTitle(selectedBook.displayTitle || selectedBook.title, privacySettings) })}
                >
                  {t('characters.detailJumpEvidence')}
                </button>
              </blockquote>
            ))}
          </div>
        ) : <p>{t('characters.detailNone')}</p>}
      </section>
    </article>
  );
}

export function formatCharacterRelationHeading(
  relation: CharacterRelation,
  currentCharacterId: string,
  relatedProfileById: Map<string, CharacterProfileDetail['profile']>,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  const relatedCharacterId = relation.sourceCharacterId === currentCharacterId ? relation.targetCharacterId : relation.sourceCharacterId;
  const relatedProfile = relatedProfileById.get(relatedCharacterId);
  const relatedName = relatedProfile ? getPrivacyBookTitle(relatedProfile.displayName || relatedProfile.canonicalName, privacySettings) : relatedCharacterId;
  const directionKey = relation.direction === 'undirected'
    ? 'characters.detailRelationUndirected'
    : relation.sourceCharacterId === currentCharacterId
      ? 'characters.detailRelationOutgoing'
      : 'characters.detailRelationIncoming';
  const label = relation.label || relation.relationType || t('characters.detailUnknownRelation');
  return t(directionKey, { name: relatedName, label });
}

export function formatCharacterRelationMeta(relation: CharacterRelation, t: ReturnType<typeof useI18n>['t']) {
  return [
    relation.status,
    t('characters.detailEvidenceCount', { count: relation.evidenceIds.length }),
    t('characters.detailConfidence', { count: Math.round(relation.confidence * 100) }),
    formatCharacterLocation(relation.firstSeen, t),
  ].filter(Boolean).join(' · ');
}

export function formatCharacterEventMeta(event: CharacterEvent, t: ReturnType<typeof useI18n>['t']) {
  return [
    event.eventType,
    event.chapterLabel || formatCharacterLocation(event.location, t),
    t('characters.detailEvidenceCount', { count: event.evidenceIds.length }),
    t('characters.detailConfidence', { count: Math.round(event.confidence * 100) }),
  ].filter(Boolean).join(' · ');
}

export function formatCharacterFactionMeta(faction: CharacterFactionMembership, t: ReturnType<typeof useI18n>['t']) {
  return [
    faction.joinedAt ? t('characters.detailFactionJoined', { location: formatCharacterLocation(faction.joinedAt, t) }) : '',
    faction.leftAt ? t('characters.detailFactionLeft', { location: formatCharacterLocation(faction.leftAt, t) }) : '',
    t('characters.detailEvidenceCount', { count: faction.evidenceIds.length }),
    t('characters.detailConfidence', { count: Math.round(faction.confidence * 100) }),
  ].filter(Boolean).join(' · ');
}

export function renderCharacterLocation(
  label: string,
  location: CharacterLocation | undefined,
  onOpenLocation: (location: CharacterLocation, label: string) => void,
  t: ReturnType<typeof useI18n>['t'],
) {
  const canOpenLocation = isOpenableCharacterLocation(location);
  return (
    <div>
      <span>{label}</span>
      <strong>{formatCharacterLocation(location, t)}</strong>
      {canOpenLocation && location ? (
        <button
          className="ghost-btn small"
          type="button"
          onClick={() => onOpenLocation(location, label)}
          aria-label={t('characters.detailJumpLocationAria', { label })}
        >
          {t('characters.detailJumpLocation')}
        </button>
      ) : null}
    </div>
  );
  return t('characters.characterIndex.missing');
}

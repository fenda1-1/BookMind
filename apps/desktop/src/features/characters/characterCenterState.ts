import type { Book, CharacterIndexStatus } from '../../types';
import type { TranslationKey } from '../../i18n';
import { characterFailureAdviceKey } from './characterFailureDiagnostics';

export type CharacterTextIndexView = {
  status: string;
  ready: boolean;
  missing: boolean;
  stale: boolean;
  failed: boolean;
  staleReason: string;
  chunkCount: number;
};

export type CharacterCenterStateId =
  | 'no-book'
  | 'text-index-missing'
  | 'text-index-stale'
  | 'text-index-failed'
  | 'character-index-missing'
  | 'character-index-queued'
  | 'character-index-building'
  | 'character-index-failed'
  | 'character-index-stale'
  | 'character-index-ready';

export type CharacterCenterPrimaryAction = 'build-text-index' | 'rebuild-text-index' | 'character-extraction' | 'rebuild-character-index' | 'open-tasks' | 'none';
export type CharacterCenterSecondaryAction = 'open-reader' | 'open-tasks';

export type CharacterCenterState = {
  stateId: CharacterCenterStateId;
  textIndexStatus: string;
  characterIndexStatus: CharacterIndexStatus;
  readinessTitleKey: TranslationKey;
  readinessBodyKey: TranslationKey;
  readinessBodyParams?: Record<string, string | number>;
  readinessHintKey?: TranslationKey;
  primaryAction: CharacterCenterPrimaryAction;
  secondaryActions: CharacterCenterSecondaryAction[];
  failureDiagnostics?: CharacterCenterFailureDiagnostics;
  showZeroCharacterMetrics: boolean;
  readinessClassName: string;
};

export type CharacterCenterFailureDiagnostics = {
  lastTaskId: string;
  errorCode: string;
  errorAdviceKey: TranslationKey;
  errorStage: string;
  recentLogEntry: string;
};

export type CharacterCenterIssue = {
  lastError?: string;
  staleReason?: string;
  lastTaskId?: string;
  errorCode?: string;
  errorStage?: string;
  recentLogEntry?: string;
};

export function resolveCharacterCenterState(
  book: Pick<Book, 'id'> | null,
  indexView: CharacterTextIndexView,
  characterStatus: CharacterIndexStatus,
  characterIssue: CharacterCenterIssue | string = {},
): CharacterCenterState {
  const lastError = typeof characterIssue === 'string' ? characterIssue : characterIssue.lastError ?? '';
  const staleReason = typeof characterIssue === 'string' ? characterIssue : characterIssue.staleReason ?? '';
  const failureDiagnostics = typeof characterIssue === 'string' ? undefined : buildFailureDiagnostics(characterIssue);
  if (!book) {
    return limitSecondaryActions({
      stateId: 'no-book',
      textIndexStatus: indexView.status,
      characterIndexStatus: 'missing',
      readinessTitleKey: 'characters.noBookTitle',
      readinessBodyKey: 'characters.noBookBody',
      primaryAction: 'none',
      secondaryActions: [],
      showZeroCharacterMetrics: false,
      readinessClassName: 'missing',
    });
  }

  if (characterStatus === 'failed') {
    return limitSecondaryActions({
      stateId: 'character-index-failed',
      textIndexStatus: indexView.status,
      characterIndexStatus: characterStatus,
      readinessTitleKey: 'characters.readiness.characterFailedTitle',
      readinessBodyKey: lastError ? 'characters.readiness.characterFailedBodyWithError' : 'characters.readiness.characterFailedBody',
      readinessBodyParams: lastError ? { error: lastError } : undefined,
      primaryAction: 'open-tasks',
      secondaryActions: ['open-reader'],
      failureDiagnostics,
      showZeroCharacterMetrics: false,
      readinessClassName: characterStatus,
    });
  }

  if (indexView.failed) {
    return limitSecondaryActions({
      stateId: 'text-index-failed',
      textIndexStatus: indexView.status,
      characterIndexStatus: 'blocked-by-text-index',
      readinessTitleKey: 'characters.readiness.textIndexFailedTitle',
      readinessBodyKey: lastError ? 'characters.readiness.textIndexFailedBodyWithError' : 'characters.readiness.textIndexFailedBody',
      readinessBodyParams: lastError ? { error: lastError } : undefined,
      primaryAction: 'open-tasks',
      secondaryActions: ['open-reader'],
      showZeroCharacterMetrics: false,
      readinessClassName: 'failed',
    });
  }

  if (indexView.stale) {
    return limitSecondaryActions({
      stateId: 'text-index-stale',
      textIndexStatus: indexView.status,
      characterIndexStatus: 'blocked-by-text-index',
      readinessTitleKey: 'characters.readiness.textIndexStaleTitle',
      readinessBodyKey: indexView.staleReason ? 'characters.readiness.textIndexStaleBodyWithReason' : 'characters.readiness.textIndexStaleBody',
      readinessBodyParams: indexView.staleReason ? { reason: indexView.staleReason } : undefined,
      primaryAction: 'rebuild-text-index',
      secondaryActions: ['open-reader', 'open-tasks'],
      showZeroCharacterMetrics: false,
      readinessClassName: 'blocked-by-text-index',
    });
  }

  if (indexView.missing || !indexView.ready) {
    return limitSecondaryActions({
      stateId: 'text-index-missing',
      textIndexStatus: indexView.status,
      characterIndexStatus: 'blocked-by-text-index',
      readinessTitleKey: 'characters.readiness.textIndexMissingTitle',
      readinessBodyKey: 'characters.readiness.textIndexMissingBody',
      primaryAction: 'build-text-index',
      secondaryActions: ['open-reader', 'open-tasks'],
      showZeroCharacterMetrics: false,
      readinessClassName: 'blocked-by-text-index',
    });
  }

  if (characterStatus === 'missing') {
    if (staleReason) {
      return limitSecondaryActions({
        stateId: 'character-index-missing',
        textIndexStatus: indexView.status,
        characterIndexStatus: characterStatus,
        readinessTitleKey: 'characters.readiness.characterMissingRepairTitle',
        readinessBodyKey: 'characters.readiness.characterMissingRepairBodyWithReason',
        readinessBodyParams: { reason: staleReason },
        primaryAction: 'rebuild-character-index',
        secondaryActions: ['open-reader', 'open-tasks'],
        showZeroCharacterMetrics: true,
        readinessClassName: characterStatus,
      });
    }
    return limitSecondaryActions({
      stateId: 'character-index-missing',
      textIndexStatus: indexView.status,
      characterIndexStatus: characterStatus,
      readinessTitleKey: 'characters.readiness.characterMissingTitle',
      readinessBodyKey: 'characters.readiness.characterMissingBody',
      readinessHintKey: 'characters.readiness.characterMissingHint',
      primaryAction: 'character-extraction',
      secondaryActions: ['open-reader', 'open-tasks'],
      showZeroCharacterMetrics: true,
      readinessClassName: characterStatus,
    });
  }

  if (characterStatus === 'queued') {
    return limitSecondaryActions({
      stateId: 'character-index-queued',
      textIndexStatus: indexView.status,
      characterIndexStatus: characterStatus,
      readinessTitleKey: 'characters.readiness.characterQueuedTitle',
      readinessBodyKey: 'characters.readiness.characterQueuedBody',
      primaryAction: 'open-tasks',
      secondaryActions: ['open-reader'],
      showZeroCharacterMetrics: false,
      readinessClassName: characterStatus,
    });
  }

  if (characterStatus === 'building') {
    return limitSecondaryActions({
      stateId: 'character-index-building',
      textIndexStatus: indexView.status,
      characterIndexStatus: characterStatus,
      readinessTitleKey: 'characters.readiness.characterBuildingTitle',
      readinessBodyKey: 'characters.readiness.characterBuildingBody',
      primaryAction: 'open-tasks',
      secondaryActions: ['open-reader'],
      showZeroCharacterMetrics: false,
      readinessClassName: characterStatus,
    });
  }

  if (characterStatus === 'stale') {
    return limitSecondaryActions({
      stateId: 'character-index-stale',
      textIndexStatus: indexView.status,
      characterIndexStatus: characterStatus,
      readinessTitleKey: 'characters.readiness.characterStaleTitle',
      readinessBodyKey: staleReason ? 'characters.readiness.characterStaleBodyWithReason' : 'characters.readiness.characterStaleBody',
      readinessBodyParams: staleReason ? { reason: staleReason } : undefined,
      primaryAction: 'rebuild-character-index',
      secondaryActions: ['open-reader', 'open-tasks'],
      showZeroCharacterMetrics: true,
      readinessClassName: characterStatus,
    });
  }

  return limitSecondaryActions({
    stateId: 'character-index-ready',
    textIndexStatus: indexView.status,
    characterIndexStatus: characterStatus,
    readinessTitleKey: 'characters.readiness.readyTitle',
    readinessBodyKey: 'characters.readiness.readyBody',
    primaryAction: 'none',
    secondaryActions: ['open-reader', 'open-tasks'],
    showZeroCharacterMetrics: true,
    readinessClassName: characterStatus,
  });
}

function limitSecondaryActions(state: CharacterCenterState): CharacterCenterState {
  return { ...state, secondaryActions: state.secondaryActions.slice(0, 3) };
}

function buildFailureDiagnostics(issue: CharacterCenterIssue): CharacterCenterFailureDiagnostics | undefined {
  const diagnostics = {
    lastTaskId: issue.lastTaskId ?? '',
    errorCode: issue.errorCode ?? '',
    errorAdviceKey: characterFailureAdviceKey(issue.errorCode ?? ''),
    errorStage: issue.errorStage ?? '',
    recentLogEntry: issue.recentLogEntry ?? '',
  };
  return [diagnostics.lastTaskId, diagnostics.errorCode, diagnostics.errorStage, diagnostics.recentLogEntry].some(Boolean)
    ? diagnostics
    : undefined;
}

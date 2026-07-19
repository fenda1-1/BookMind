import type { TranslationKey } from '../../i18n';
import type { CharacterCenterStateId } from './characterCenterState';

export function getCharacterOverviewSectionFallbackKey({
  hasOverviewSnapshot,
  overviewSnapshotLoading,
  centerStateId,
}: {
  hasOverviewSnapshot: boolean;
  overviewSnapshotLoading: boolean;
  centerStateId: CharacterCenterStateId;
}): TranslationKey | null {
  if (hasOverviewSnapshot) return null;
  if (overviewSnapshotLoading) return 'characters.overviewSnapshot.loadingBody';
  if (centerStateId === 'character-index-queued' || centerStateId === 'character-index-building') {
    return 'characters.graphStatus.loadingBody';
  }
  return 'characters.detailNone';
}

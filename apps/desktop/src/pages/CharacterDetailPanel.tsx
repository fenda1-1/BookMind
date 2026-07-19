import type { CharacterCenterBookSummary, CharacterCenterPayload, CharacterEvidence, CharacterLocation } from '../types';
import type { ExtendedSettings } from '../services/settingsCenterService';
import { useI18n } from '../i18n';
import { buildCharacterOverviewMetrics } from '../features/characters/characterOverviewMetrics';
import type { CharacterProfileDetail } from '../features/characters/characterProfileDetail';
import type { CharacterGraphEdgeDetail } from '../features/characters/characterGraphEdgeDetail';
import type { CharacterCenterState } from '../features/characters/characterCenterState';
import { renderCharacterInspectorPanel } from './CharacterPageRenderers';

type CharacterDetailPanelProps = {
  selectedCharacterDetail: CharacterProfileDetail | null;
  selectedRelationDetail: CharacterGraphEdgeDetail | null;
  selectedBook: CharacterCenterBookSummary;
  characterPayload: CharacterCenterPayload | null;
  centerState: CharacterCenterState;
  privacySettings: ExtendedSettings;
  onCloseRelationDetail: () => void;
  openCharacterEvidenceInReader: (evidence: CharacterEvidence) => void;
  openCharacterLocationInReader: (location: CharacterLocation, label: string) => void;
};

export function CharacterDetailPanel({
  selectedCharacterDetail,
  selectedRelationDetail,
  selectedBook,
  characterPayload,
  centerState,
  privacySettings,
  onCloseRelationDetail,
  openCharacterEvidenceInReader,
  openCharacterLocationInReader,
}: CharacterDetailPanelProps) {
  const { t } = useI18n();
  const metrics = buildCharacterOverviewMetrics({
    book: selectedBook, manifest: null, profiles: [],
    centerState: { showZeroCharacterMetrics: centerState.showZeroCharacterMetrics },
  });

  return renderCharacterInspectorPanel(
    selectedCharacterDetail,
    selectedRelationDetail,
    selectedBook,
    characterPayload,
    metrics,
    centerState,
    onCloseRelationDetail,
    openCharacterEvidenceInReader,
    openCharacterLocationInReader,
    privacySettings,
    t,
  );
}

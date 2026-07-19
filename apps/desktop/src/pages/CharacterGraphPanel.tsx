import { CharacterRelationGraphView, type CharacterRelationGraphViewProps } from '../features/characters/CharacterRelationGraphView';

/**
 * Thin wrapper around CharacterRelationGraphView, providing a consistent
 * component interface for the CharactersPage sub-panel extraction plan.
 */
export function CharacterGraphPanel(props: CharacterRelationGraphViewProps) {
  return <CharacterRelationGraphView {...props} />;
}

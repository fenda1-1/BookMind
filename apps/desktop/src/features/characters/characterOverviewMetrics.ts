import type { CharacterCenterBookSummary, CharacterCenterPayload, CharacterIndexManifest, CharacterProfile } from '../../types';
import type { TranslationKey } from '../../i18n';

export type CharacterOverviewMetric = {
  id: string;
  labelKey: TranslationKey;
  value: string;
  hintKey: TranslationKey;
};

export type CharacterOverviewMetricsInput = {
  book: Pick<CharacterCenterBookSummary, 'characterCount' | 'relationCount' | 'evidenceCount' | 'textIndexChunkCount' | 'lastCharacterBuiltAt'> | null;
  manifest: Pick<CharacterIndexManifest, 'indexVersion' | 'extractionMode' | 'builtAt' | 'sourceTextIndex'> | null;
  profiles: Array<Pick<CharacterProfile, 'role' | 'mentionCount' | 'hidden'>>;
  centerState: { showZeroCharacterMetrics: boolean };
};

export function buildCharacterOverviewMetrics(input: CharacterOverviewMetricsInput): CharacterOverviewMetric[] {
  const { book, manifest, profiles, centerState } = input;
  if (!centerState.showZeroCharacterMetrics) {
    return [{
      id: 'text-index',
      labelKey: 'characters.metric.textIndex',
      value: book && book.textIndexChunkCount > 0 ? String(book.textIndexChunkCount) : '-',
      hintKey: 'characters.metric.textIndexHint',
    }];
  }

  const textIndexChunkCount = book?.textIndexChunkCount ?? manifest?.sourceTextIndex.chunkCount ?? 0;
  const indexedChunkCount = manifest?.sourceTextIndex.chunkCount ?? 0;
  return [
    metric('characters', 'characters.metric.characters', String(book?.characterCount ?? 0), 'characters.metric.charactersReadyHint'),
    metric('main-characters', 'characters.metric.mainCharacters', String(countMainCharacters(profiles)), 'characters.metric.mainCharactersHint'),
    metric('relations', 'characters.metric.relations', String(book?.relationCount ?? 0), 'characters.metric.relationsHint'),
    metric('evidence', 'characters.metric.evidence', String(book?.evidenceCount ?? 0), 'characters.metric.evidenceHint'),
    metric('coverage', 'characters.metric.coverage', formatCoverage(indexedChunkCount, textIndexChunkCount), 'characters.metric.coverageHint'),
    metric('last-built', 'characters.metric.lastBuilt', formatCharacterTimestamp(book?.lastCharacterBuiltAt || manifest?.builtAt || ''), 'characters.metric.lastBuiltHint'),
    metric('algorithm', 'characters.metric.algorithm', formatAlgorithmLabel(manifest), 'characters.metric.algorithmHint'),
    metric('text-index', 'characters.metric.textIndex', textIndexChunkCount > 0 ? String(textIndexChunkCount) : '-', 'characters.metric.textIndexHint'),
  ];
}

function metric(id: string, labelKey: TranslationKey, value: string, hintKey: TranslationKey): CharacterOverviewMetric {
  return { id, labelKey, value, hintKey };
}

function countMainCharacters(profiles: Array<Pick<CharacterProfile, 'role' | 'mentionCount' | 'hidden'>>) {
  return profiles.filter((profile) => {
    if (profile.hidden) return false;
    return profile.role === 'protagonist' || profile.role === 'main' || profile.mentionCount >= 20;
  }).length;
}

function formatCoverage(indexedChunkCount: number, textIndexChunkCount: number) {
  if (textIndexChunkCount <= 0 || indexedChunkCount <= 0) return '-';
  return `${Math.min(100, Math.round((indexedChunkCount / textIndexChunkCount) * 100))}%`;
}

function formatAlgorithmLabel(manifest: Pick<CharacterIndexManifest, 'indexVersion' | 'extractionMode'> | null) {
  if (!manifest) return '-';
  return `${manifest.extractionMode} v${manifest.indexVersion}`;
}

function formatCharacterTimestamp(value: string) {
  const timestamp = parseCharacterTimestamp(value);
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function parseCharacterTimestamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

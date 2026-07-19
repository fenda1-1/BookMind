export type CharacterEvidenceCitationCopyLabels = {
  heading: string;
  book: string;
  type: string;
  target: string;
  location: string;
  quote: string;
  claim: string;
  source: string;
  confidence: string;
  evidenceId: string;
  missingValue: string;
};

export type CharacterEvidenceCitationCopyInput = {
  evidenceId: string;
  bookTitle: string;
  typeLabel: string;
  targetLabel: string;
  locationLabel: string;
  quote: string;
  claim: string;
  sourceLabel: string;
  confidencePercent: number;
  labels: CharacterEvidenceCitationCopyLabels;
  privacyMode?: boolean;
  privateValue?: string;
};

export function formatCharacterEvidenceCitationCopy(input: CharacterEvidenceCitationCopyInput) {
  const confidencePercent = Number.isFinite(input.confidencePercent)
    ? Math.max(0, Math.min(100, Math.round(input.confidencePercent)))
    : 0;
  return [
    input.labels.heading,
    formatCitationLine(input.labels.book, privacySensitiveValue(input.bookTitle, input), input.labels.missingValue),
    formatCitationLine(input.labels.type, input.typeLabel, input.labels.missingValue),
    formatCitationLine(input.labels.target, privacySensitiveValue(input.targetLabel, input), input.labels.missingValue),
    formatCitationLine(input.labels.location, privacySensitiveValue(input.locationLabel, input), input.labels.missingValue),
    formatCitationLine(input.labels.quote, privacySensitiveValue(input.quote, input), input.labels.missingValue),
    formatCitationLine(input.labels.claim, privacySensitiveValue(input.claim, input), input.labels.missingValue),
    formatCitationLine(input.labels.source, input.sourceLabel, input.labels.missingValue),
    `${input.labels.confidence}: ${confidencePercent}%`,
    formatCitationLine(input.labels.evidenceId, input.evidenceId, input.labels.missingValue),
  ].join('\n');
}

function formatCitationLine(label: string, value: string, missingValue: string) {
  const normalizedValue = value.trim();
  return `${label}: ${normalizedValue || missingValue}`;
}

function privacySensitiveValue(value: string, input: CharacterEvidenceCitationCopyInput) {
  if (!input.privacyMode) return value;
  return input.privateValue?.trim() || input.labels.missingValue;
}

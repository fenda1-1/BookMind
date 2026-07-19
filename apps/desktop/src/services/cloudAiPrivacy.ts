const emailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const phonePattern = /(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}\b/g;
const idCardPattern = /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g;
const pathPattern = /(?:[A-Za-z]:[\\/][^\s"'<>|，。；：、]+|\/(?:Users|home|tmp|var|private|Volumes|mnt|opt|etc)\/[^\s"'<>|，。；：、]+)/g;
const longNumberPattern = /\b\d{6,}\b/g;

export type CloudRedactionPreview = {
  originalText: string;
  redactedText: string;
  replacementCount: number;
  replacementTypes: Array<'email' | 'phone' | 'id-card' | 'path' | 'number' | 'custom'>;
};

const redactionRules: Array<{ type: CloudRedactionPreview['replacementTypes'][number]; pattern: RegExp; token: string }> = [
  { type: 'email', pattern: emailPattern, token: '[email]' },
  { type: 'phone', pattern: phonePattern, token: '[phone]' },
  { type: 'id-card', pattern: idCardPattern, token: '[id-card]' },
  { type: 'path', pattern: pathPattern, token: '[path]' },
  { type: 'number', pattern: longNumberPattern, token: '[number]' },
];

export function redactCloudText(value: string, customSensitiveWords = '') {
  return buildCloudRedactionPreview(value, customSensitiveWords).redactedText;
}

export function buildCloudRedactionPreview(value: string, customSensitiveWords = ''): CloudRedactionPreview {
  let redactedText = value;
  let replacementCount = 0;
  const replacementTypes: CloudRedactionPreview['replacementTypes'] = [];
  for (const rule of [...redactionRules, ...customSensitiveWordPatterns(customSensitiveWords)]) {
    const matches = redactedText.match(rule.pattern);
    if (!matches?.length) continue;
    replacementCount += matches.length;
    replacementTypes.push(rule.type);
    redactedText = redactedText.replace(rule.pattern, rule.token);
  }
  return {
    originalText: value,
    redactedText,
    replacementCount,
    replacementTypes,
  };
}

function customSensitiveWordPatterns(value: string): Array<{ type: 'custom'; pattern: RegExp; token: string }> {
  return Array.from(new Set(value
    .split(/[\n,，]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 100)))
    .sort((left, right) => right.length - left.length)
    .map((word) => ({ type: 'custom', pattern: new RegExp(escapeSensitiveWordPattern(word), 'g'), token: '[custom]' }));
}

function escapeSensitiveWordPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

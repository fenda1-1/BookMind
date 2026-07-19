import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { ReaderReadAloudSegment } from './readerInteractionModel';

export type ReaderReadAloudVoiceRole = 'narrator' | 'male' | 'female';

export type ReaderReadAloudVoiceProfile = Pick<
  ExtendedSettings,
  | 'readerReadAloudNarratorVoiceURI'
  | 'readerReadAloudMaleVoiceURI'
  | 'readerReadAloudFemaleVoiceURI'
  | 'readerReadAloudCharacterVoiceRules'
>;

export type ReaderReadAloudVoiceCandidate = Pick<SpeechSynthesisVoice, 'name' | 'voiceURI' | 'lang'>;

export type ReaderReadAloudVoiceResolution = {
  role: ReaderReadAloudVoiceRole;
  speaker: string | null;
  voiceURI: string;
};

type CharacterVoiceRule = {
  name: string;
  target: string;
};

const roleAliases: Record<string, ReaderReadAloudVoiceRole> = {
  '旁白': 'narrator',
  narrator: 'narrator',
  '男': 'male',
  '男声': 'male',
  male: 'male',
  '女': 'female',
  '女声': 'female',
  female: 'female',
};

export function parseReaderReadAloudCharacterVoiceRules(value: string): CharacterVoiceRule[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)(?:=>|=|：|:)(.+)$/);
      if (!match) return null;
      const name = match[1]?.trim().slice(0, 24) ?? '';
      const target = match[2]?.trim().slice(0, 160) ?? '';
      return name && target ? { name, target } : null;
    })
    .filter((item): item is CharacterVoiceRule => Boolean(item))
    .slice(0, 80);
}

export function detectReaderReadAloudSpeaker(text: string): string | null {
  const normalized = text.replace(/\s+/g, '');
  if (!/[“"]/.test(normalized)) return null;
  const speakerAfterQuote = normalized.match(/[”"]([^，。！？；：、“”"]{1,12}?)(?:说|道|问|喊|叫|答|笑|叹|低声|喃喃|提醒|开口)/);
  if (speakerAfterQuote?.[1]) return speakerAfterQuote[1];
  const speakerBeforeVerb = normalized.match(/([^，。！？；：、“”"]{1,12}?)(?:说|道|问|喊|叫|答|笑|叹|低声|喃喃|提醒|开口)[，,:：]?[“"]/);
  if (speakerBeforeVerb?.[1]) return speakerBeforeVerb[1];
  return null;
}

export function resolveReaderReadAloudVoiceURI(
  segment: ReaderReadAloudSegment,
  profile: ReaderReadAloudVoiceProfile,
  voices: ReaderReadAloudVoiceCandidate[],
): ReaderReadAloudVoiceResolution {
  const speaker = detectReaderReadAloudSpeaker(segment.text);
  const rules = parseReaderReadAloudCharacterVoiceRules(profile.readerReadAloudCharacterVoiceRules);
  const matchedRule = speaker ? rules.find((rule) => speaker.includes(rule.name) || rule.name.includes(speaker)) : null;
  const ruleTarget = matchedRule?.target ?? '';
  const ruleRole = roleAliases[ruleTarget.toLowerCase()] ?? roleAliases[ruleTarget];
  const role = ruleRole ?? (speaker ? 'narrator' : 'narrator');
  const explicitVoiceURI = ruleTarget && !ruleRole ? resolveVoiceURI(ruleTarget, voices) : '';
  const voiceURI = explicitVoiceURI || getRoleVoiceURI(role, profile);
  return { role, speaker, voiceURI };
}

function getRoleVoiceURI(role: ReaderReadAloudVoiceRole, profile: ReaderReadAloudVoiceProfile) {
  if (role === 'male') return profile.readerReadAloudMaleVoiceURI;
  if (role === 'female') return profile.readerReadAloudFemaleVoiceURI;
  return profile.readerReadAloudNarratorVoiceURI;
}

function resolveVoiceURI(target: string, voices: ReaderReadAloudVoiceCandidate[]) {
  const normalizedTarget = normalizeVoiceSearchText(target);
  return voices.find((voice) => normalizeVoiceSearchText(voice.voiceURI) === normalizedTarget)?.voiceURI
    ?? voices.find((voice) => normalizeVoiceSearchText(voice.name) === normalizedTarget)?.voiceURI
    ?? voices.find((voice) => normalizeVoiceSearchText(`${voice.name} ${voice.lang}`).includes(normalizedTarget))?.voiceURI
    ?? '';
}

function normalizeVoiceSearchText(value: string) {
  return value.trim().toLowerCase();
}

import type { CharacterProfile } from '../../types';

export type CharacterGender = 'unknown' | 'male' | 'female';

export type CharacterAiPostprocessNameItem = {
  index: number;
  id: string;
  name: string;
  quote: string;
};

export type CharacterAiPostprocessNameChunk = {
  startIndex: number;
  items: CharacterAiPostprocessNameItem[];
};

export type CharacterAiPostprocessParseResult = {
  genderByIndex: Map<number, CharacterGender>;
  noiseIndexes: Set<number>;
};

export type CharacterAiPostprocessOperation = {
  id: string;
  type: 'gender' | 'noise';
  profileId: string;
  name: string;
  from: CharacterGender | boolean;
  to: CharacterGender | boolean;
  enabled: boolean;
};

export function buildCharacterAiPostprocessNameList(
  profiles: Array<Pick<CharacterProfile, 'id' | 'canonicalName' | 'displayName' | 'hidden'>>,
  mentions: Array<{ characterId?: string; quote?: string }> = [],
  evidence: Array<{ targetType?: string; targetId?: string; quote?: string }> = [],
): CharacterAiPostprocessNameItem[] {
  const quoteByCharacterId = new Map<string, string>();
  mentions.forEach((mention) => {
    if (!mention.characterId || quoteByCharacterId.has(mention.characterId)) return;
    const quote = normalizeQuote(mention.quote ?? '');
    if (quote) quoteByCharacterId.set(mention.characterId, quote);
  });
  evidence.forEach((item) => {
    if (item.targetType !== 'profile' || !item.targetId || quoteByCharacterId.has(item.targetId)) return;
    const quote = normalizeQuote(item.quote ?? '');
    if (quote) quoteByCharacterId.set(item.targetId, quote);
  });
  return profiles
    .filter((profile) => !profile.hidden)
    .map((profile, index) => ({
      index: index + 1,
      id: profile.id,
      name: (profile.displayName || profile.canonicalName).trim(),
      quote: quoteByCharacterId.get(profile.id) ?? '',
    }))
    .filter((item) => item.name);
}

export function buildCharacterAiPostprocessPrompt(items: CharacterAiPostprocessNameItem[]) {
  const names = items.map((item) => `${item.index}. ${item.name}${item.quote ? `｜引用：${item.quote}` : ''}`).join('\n');
  return [
    '你是小说人物索引清洗器。只根据名字判断，不要输出解释。',
    '任务 A：判断人物性别，男=1，女=2，未知/非人物=3。',
    '任务 B：只识别 100% 明确的噪音名字，把编号放入 n。',
    '噪音只包括：代词/泛称（他说、女人、男人、老人）、明显误切词（安卿鱼说、林七夜问、林七夜如、林七夜时、林七夜装、林七夜见）。',
    '不要把称谓、职位、敬称、代号、神话生物、怪物、组织首领判为噪音；例如洪教官、常田小姐、路先生、郑医生、陈队长、京介大叔、赵空城、安卿鱼、古猿、魔皇都不是噪音。',
    '只输出 JSON，格式必须精简：{"g":{"1":1,"2":2},"n":[3]}',
    '不要使用 Markdown，不要补充其他字段。',
    '',
    names,
  ].join('\n');
}

export function buildCharacterAiPostprocessDebugText(items: CharacterAiPostprocessNameItem[]) {
  return items
    .map((item) => `${item.index}. ${item.name}${item.quote ? `\n   引用：${item.quote}` : ''}`)
    .join('\n');
}

export function chunkCharacterAiPostprocessNameList(items: CharacterAiPostprocessNameItem[], chunkSize = 100): CharacterAiPostprocessNameChunk[] {
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks: CharacterAiPostprocessNameChunk[] = [];
  for (let offset = 0; offset < items.length; offset += safeChunkSize) {
    const chunkItems = items.slice(offset, offset + safeChunkSize);
    if (!chunkItems.length) continue;
    chunks.push({ startIndex: chunkItems[0].index, items: chunkItems });
  }
  return chunks;
}

function normalizeQuote(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function parseCharacterAiPostprocessResponse(rawText: string): CharacterAiPostprocessParseResult {
  const parsed = parseJsonObject(rawText);
  const genderByIndex = new Map<number, CharacterGender>();
  const genderRecord = parsed?.g && typeof parsed.g === 'object' ? parsed.g as Record<string, unknown> : {};
  Object.entries(genderRecord).forEach(([key, value]) => {
    const keyAsGender = normalizeGenderCode(key);
    if (keyAsGender && Array.isArray(value)) {
      value.forEach((item) => {
        const index = Number(item);
        if (Number.isInteger(index) && index > 0) genderByIndex.set(index, keyAsGender);
      });
      return;
    }
    const index = Number(key);
    if (!Number.isInteger(index) || index <= 0) return;
    const gender = normalizeGenderCode(value);
    if (gender) genderByIndex.set(index, gender);
  });
  const noiseIndexes = new Set<number>();
  const noiseSource = Array.isArray(parsed?.n) ? parsed.n : [];
  noiseSource.forEach((value) => {
    const index = Number(value);
    if (Number.isInteger(index) && index > 0) noiseIndexes.add(index);
  });
  return { genderByIndex, noiseIndexes };
}

export function buildCharacterAiPostprocessPreview(
  profiles: Array<Pick<CharacterProfile, 'id' | 'canonicalName' | 'displayName' | 'hidden'> & { gender?: CharacterGender }>,
  parsed: CharacterAiPostprocessParseResult,
  disabledOperationIds = new Set<string>(),
) {
  const items = buildCharacterAiPostprocessNameList(profiles);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const operations: CharacterAiPostprocessOperation[] = [];
  items.forEach((item) => {
    const profile = profileById.get(item.id);
    if (!profile) return;
    const forcedNoise = isBrokenCharacterNameFragment(item.name);
    const nextGender = parsed.genderByIndex.get(item.index);
    const currentGender = normalizeGenderCode(profile.gender) ?? 'unknown';
    if (!forcedNoise && nextGender && nextGender !== currentGender) {
      const id = `gender:${item.id}`;
      operations.push({
        id,
        type: 'gender',
        profileId: item.id,
        name: item.name,
        from: currentGender,
        to: nextGender,
        enabled: !disabledOperationIds.has(id),
      });
    }
    if (!profile.hidden && (forcedNoise || parsed.noiseIndexes.has(item.index))) {
      const id = `noise:${item.id}`;
      operations.push({
        id,
        type: 'noise',
        profileId: item.id,
        name: item.name,
        from: false,
        to: true,
        enabled: !disabledOperationIds.has(id),
      });
    }
  });
  return { operations };
}

export function isBrokenCharacterNameFragment(name: string) {
  const normalized = name.replace(/\s+/g, '').trim();
  if (normalized.length < 3 || normalized.length > 8) return false;
  if (trustedTitlePattern.test(normalized)) return false;
  return /^[一-龥]{2,6}(?:如|时|装|见|看|想|听|走|跑|站|坐|拿|把|被|将|说|道|问|喊|叫|答|笑|叹|低声|喃喃|提醒|开口)$/.test(normalized);
}

export function isSafeCharacterNoiseName(name: string) {
  const normalized = name.replace(/\s+/g, '').trim();
  if (!normalized) return false;
  const genericNoiseNames = new Set([
    '他',
    '她',
    '它',
    '他们',
    '她们',
    '它们',
    '他说',
    '她说',
    '他问',
    '她问',
    '他喊',
    '她喊',
    '男人',
    '女人',
    '老人',
    '老者',
    '少年',
    '少女',
    '青年',
    '中年人',
    '众人',
    '所有人',
    '那人',
    '此人',
  ]);
  if (genericNoiseNames.has(normalized)) return true;
  if (/^(?:他|她|它|他们|她们|它们|那人|此人)(?:说|道|问|喊|叫|答|笑|叹|低声|喃喃)$/.test(normalized)) return true;
  if (isBrokenCharacterNameFragment(normalized)) return true;
  return false;
}

const trustedTitlePattern = /(?:大叔|小姐|先生|医生|教官|队长|老师|师傅|师父|殿下|陛下|皇|王|帝|神|魔|妖|鬼|猿|龙|兽|城|鱼|缨)$/;

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  const text = normalizeAiJsonText(rawText).trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizeAiJsonText(value: string) {
  return value
    .replace(/&quot;|&#34;|&ldquo;|&rdquo;/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function normalizeGenderCode(value: unknown): CharacterGender | null {
  if (value === 1 || value === '1' || value === '男' || value === 'male') return 'male';
  if (value === 2 || value === '2' || value === '女' || value === 'female') return 'female';
  if (value === 3 || value === '3' || value === '未知' || value === 'unknown') return 'unknown';
  return null;
}

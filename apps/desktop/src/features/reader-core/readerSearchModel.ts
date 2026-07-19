import type { ReaderBookmark } from '../../types';
import type { ReaderChapter, ReaderHighlightRange, ReaderPageEntry } from './readerModel.js';

export type ReaderChapterSearchHit = {
  chapterIndex: number;
  paragraphIndex: number;
  matchIndex: number;
  snippet: string;
};

export type ReaderSearchScope = 'page' | 'chapter' | 'book' | 'annotations' | 'bookmarks' | 'all';

export type ReaderSearchHit = {
  kind: 'chapter' | 'highlight' | 'bookmark';
  chapterIndex: number;
  paragraphIndex: number;
  matchIndex: number;
  snippet: string;
  label: string;
  targetId?: string;
};

export type ReaderSearchIndex = {
  chapters: ReaderChapter[];
  highlights: ReaderHighlightRange[];
  bookmarks: ReaderBookmark[];
};

export type ReaderSearchOptions = {
  scope: ReaderSearchScope;
  chapterIndex?: number;
  chapterRange?: number[];
  pageEntries?: ReaderPageEntry[];
  caseSensitive?: boolean;
  fuzzy?: boolean;
  regex?: boolean;
  regexFallbackLiteral?: boolean;
  normalizeNfkc?: boolean;
  normalizeTraditionalChinese?: boolean;
  pinyinInitials?: boolean;
  limit?: number;
  offset?: number;
};

export type ReaderSearchStepResult =
  | { done: false }
  | { done: true; hits: ReaderSearchHit[] };

export type ReaderSearchExecution = {
  step: (candidateBudget?: number) => ReaderSearchStepResult;
  getPartialHits: () => ReaderSearchHit[];
};

export function buildReaderSearchIndex(chapters: ReaderChapter[], highlights: ReaderHighlightRange[], bookmarks: ReaderBookmark[]): ReaderSearchIndex {
  return { chapters, highlights, bookmarks };
}

export function searchReaderIndex(index: ReaderSearchIndex, query: string, options: ReaderSearchOptions): ReaderSearchHit[] {
  const execution = createReaderSearchExecution(index, query, options);
  let result = execution.step(Number.MAX_SAFE_INTEGER);
  while (!result.done) result = execution.step(Number.MAX_SAFE_INTEGER);
  return result.hits;
}

export function createReaderSearchExecution(index: ReaderSearchIndex, query: string, options: ReaderSearchOptions): ReaderSearchExecution {
  const keyword = normalizeReaderSearchText(query, options);
  if (!keyword) return { step: () => ({ done: true, hits: [] }), getPartialHits: () => [] };
  const matcher = createReaderSearchMatcher(query, options);
  const results: ReaderSearchHit[] = [];
  const includeBody = options.scope === 'all' || options.scope === 'book' || options.scope === 'chapter' || options.scope === 'page';
  const includeHighlights = options.scope === 'all' || options.scope === 'annotations';
  const includeBookmarks = options.scope === 'all' || options.scope === 'bookmarks';
  const chapterRange = new Set(options.chapterRange ?? []);
  const resultLimit = Math.max(1, options.limit ?? Number.MAX_SAFE_INTEGER);
  const offsetLimit = Math.max(0, options.offset ?? 0) + resultLimit;
  const chapterFilter = options.scope === 'chapter' || options.scope === 'page' ? options.chapterIndex : undefined;
  const pageEntriesByParagraph = options.scope === 'page'
    ? new Map((options.pageEntries ?? []).map((entry) => [entry.paragraphIndex, entry]))
    : null;
  let phase: 'body' | 'highlights' | 'bookmarks' | 'done' = includeBody
    ? 'body'
    : includeHighlights
      ? 'highlights'
      : includeBookmarks
        ? 'bookmarks'
        : 'done';
  let chapterCursor = 0;
  let paragraphCursor = -1;
  let highlightCursor = 0;
  let bookmarkCursor = 0;
  let finalHits: ReaderSearchHit[] | null = null;

  function selectHits(source: ReaderSearchHit[]) {
    const offset = Math.max(0, options.offset ?? 0);
    return source.sort((left, right) =>
      left.chapterIndex - right.chapterIndex
      || left.paragraphIndex - right.paragraphIndex
      || left.matchIndex - right.matchIndex
      || left.kind.localeCompare(right.kind),
    ).slice(offset, offset + resultLimit);
  }

  function advanceAfterBody() {
    phase = includeHighlights ? 'highlights' : includeBookmarks ? 'bookmarks' : 'done';
  }

  function advanceAfterHighlights() {
    phase = includeBookmarks ? 'bookmarks' : 'done';
  }

  function finish() {
    if (!finalHits) {
      finalHits = selectHits(results);
    }
    return { done: true, hits: finalHits } as const;
  }

  return {
    getPartialHits() {
      return selectHits([...results]);
    },
    step(candidateBudget = 256) {
      const budget = Math.max(1, Math.floor(candidateBudget));
      let processed = 0;
      while (processed < budget && phase !== 'done') {
        if (phase === 'body') {
          if (results.length >= offsetLimit || chapterCursor >= index.chapters.length) {
            advanceAfterBody();
            continue;
          }
          const chapter = index.chapters[chapterCursor];
          if (paragraphCursor < 0) {
            processed += 1;
            if (typeof chapterFilter === 'number' && chapter.index !== chapterFilter
              || chapterRange.size && !chapterRange.has(chapter.index)) {
              chapterCursor += 1;
              continue;
            }
            const titleMatchIndex = matcher(chapter.title);
            paragraphCursor = 0;
            if (titleMatchIndex >= 0) {
              results.push({
                kind: 'chapter',
                chapterIndex: chapter.index,
                paragraphIndex: 0,
                matchIndex: 0,
                snippet: chapter.title,
                label: chapter.title,
              });
            }
            continue;
          }
          if (paragraphCursor >= chapter.paragraphs.length) {
            chapterCursor += 1;
            paragraphCursor = -1;
            continue;
          }
          const paragraphIndex = paragraphCursor;
          const paragraph = chapter.paragraphs[paragraphIndex];
          paragraphCursor += 1;
          processed += 1;
          const pageEntry = pageEntriesByParagraph?.get(paragraphIndex) ?? null;
          if (pageEntriesByParagraph && !pageEntry) continue;
          const text = pageEntry ? paragraph.slice(pageEntry.startOffset, pageEntry.endOffset) : paragraph;
          const matchIndex = matcher(text);
          if (matchIndex < 0) continue;
          results.push({
            kind: 'chapter',
            chapterIndex: chapter.index,
            paragraphIndex,
            matchIndex: pageEntry ? pageEntry.startOffset + matchIndex : matchIndex,
            snippet: buildSearchSnippet(text, matchIndex, keyword.length),
            label: chapter.title,
          });
          continue;
        }

        if (phase === 'highlights') {
          if (highlightCursor >= index.highlights.length) {
            advanceAfterHighlights();
            continue;
          }
          const highlight = index.highlights[highlightCursor];
          highlightCursor += 1;
          processed += 1;
          if (chapterRange.size && !chapterRange.has(highlight.chapterIndex)) continue;
          const haystack = `${highlight.text} ${highlight.note}`;
          const matchIndex = matcher(haystack);
          if (matchIndex < 0) continue;
          results.push({
            kind: 'highlight',
            chapterIndex: highlight.chapterIndex,
            paragraphIndex: highlight.paragraphIndex,
            matchIndex: highlight.startOffset,
            snippet: buildSearchSnippet(haystack.trim(), Math.min(matchIndex, highlight.text.length), keyword.length),
            label: highlight.note ? 'Highlight note' : 'Highlight',
            targetId: highlight.id,
          });
          continue;
        }

        if (bookmarkCursor >= index.bookmarks.length) {
          phase = 'done';
          continue;
        }
        const bookmark = index.bookmarks[bookmarkCursor];
        bookmarkCursor += 1;
        processed += 1;
        if (chapterRange.size && !chapterRange.has(bookmark.chapterIndex)) continue;
        const matchIndex = matcher(bookmark.label);
        if (matchIndex < 0) continue;
        results.push({
          kind: 'bookmark',
          chapterIndex: bookmark.chapterIndex,
          paragraphIndex: bookmark.paragraphIndex,
          matchIndex: 0,
          snippet: bookmark.label,
          label: 'Bookmark',
          targetId: bookmark.id,
        });
      }
      return phase === 'done' ? finish() : { done: false };
    },
  };
}

export function normalizeReaderSearchText(text: string, options: Pick<ReaderSearchOptions, 'normalizeNfkc' | 'normalizeTraditionalChinese'> = {}) {
  const normalized = options.normalizeNfkc === false ? text : text.normalize('NFKC');
  const simplified = options.normalizeTraditionalChinese === false
    ? normalized
    : normalized.replace(traditionalReaderSearchPattern, (char) => traditionalToSimplified[char] ?? char);
  return simplified
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getReaderSearchPinyinInitials(text: string, options: Pick<ReaderSearchOptions, 'normalizeNfkc' | 'normalizeTraditionalChinese'> = {}) {
  return Array.from(normalizeReaderSearchText(text, options), getChinesePinyinInitial)
    .join('')
    .replace(/\s+/g, '');
}

function getChinesePinyinInitial(char: string) {
  if (/^[a-z0-9]$/i.test(char)) return char.toLowerCase();
  if (char === ' ') return '';
  const override = commonChineseInitials[char];
  if (override) return override;
  if (char < '\u4e00' || char > '\u9fff') return '';
  const cached = pinyinInitialCache.get(char);
  if (cached !== undefined) return cached;
  for (let index = pinyinInitialBounds.length - 1; index >= 0; index -= 1) {
    if (char.localeCompare(pinyinInitialBounds[index], 'zh-Hans-CN') >= 0) {
      const initial = pinyinInitialLetters[index];
      pinyinInitialCache.set(char, initial);
      return initial;
    }
  }
  pinyinInitialCache.set(char, '');
  return '';
}

const pinyinInitialLetters = 'abcdefghjklmnopqrstwxyz';
const pinyinInitialBounds = Array.from('吖八嚓咑妸发旮哈讥咔垃妈拏噢妑七呥仨他哇夕丫帀咗');
const pinyinInitialCache = new Map<string, string>();

const commonChineseInitials: Record<string, string> = {
  重: 'z',
  长: 'c',
  行: 'x',
  乐: 'y',
  觉: 'j',
  角: 'j',
  藏: 'c',
  隐: 'y',
  秘: 'm',
  档: 'd',
  案: 'a',
};

const traditionalToSimplified: Record<string, string> = {
  與: '与',
  書: '书',
  筆: '笔',
  記: '记',
  讀: '读',
  檔: '档',
  案: '案',
  隱: '隐',
  萬: '万',
  專: '专',
  業: '业',
  東: '东',
  絲: '丝',
  兩: '两',
  嚴: '严',
  個: '个',
  臨: '临',
  為: '为',
  麗: '丽',
  舉: '举',
  麼: '么',
  義: '义',
  樂: '乐',
  習: '习',
  鄉: '乡',
  買: '买',
  亂: '乱',
  爭: '争',
  於: '于',
  雲: '云',
  亞: '亚',
  產: '产',
  親: '亲',
  億: '亿',
  從: '从',
  倉: '仓',
  們: '们',
  價: '价',
  會: '会',
  傳: '传',
  傷: '伤',
  倫: '伦',
  體: '体',
  兒: '儿',
  內: '内',
  寫: '写',
  軍: '军',
  農: '农',
  馮: '冯',
  決: '决',
  凍: '冻',
  淨: '净',
  準: '准',
  減: '减',
  鳳: '凤',
  凱: '凯',
  別: '别',
  創: '创',
  劇: '剧',
  劉: '刘',
  劍: '剑',
  動: '动',
  務: '务',
  勝: '胜',
  勞: '劳',
  勢: '势',
  勸: '劝',
  區: '区',
  單: '单',
  賣: '卖',
  衛: '卫',
  廠: '厂',
  廳: '厅',
  歷: '历',
  壓: '压',
  縣: '县',
  雙: '双',
  發: '发',
  變: '变',
  葉: '叶',
  號: '号',
  嗎: '吗',
  啟: '启',
  員: '员',
  問: '问',
  團: '团',
  園: '园',
  圖: '图',
  國: '国',
  聖: '圣',
  場: '场',
  壞: '坏',
  塊: '块',
  聲: '声',
  處: '处',
  複: '复',
  頭: '头',
  奮: '奋',
  婦: '妇',
  媽: '妈',
  嬰: '婴',
  孫: '孙',
  學: '学',
  寶: '宝',
  實: '实',
  審: '审',
  寬: '宽',
  對: '对',
  導: '导',
  將: '将',
  屬: '属',
  島: '岛',
  嶺: '岭',
  幣: '币',
  幫: '帮',
  廣: '广',
  張: '张',
  彎: '弯',
  彈: '弹',
  強: '强',
  歸: '归',
  錄: '录',
  徹: '彻',
  復: '复',
  憶: '忆',
  懷: '怀',
  態: '态',
  戀: '恋',
  惡: '恶',
  悅: '悦',
  懸: '悬',
  驚: '惊',
  慘: '惨',
  慶: '庆',
  憂: '忧',
  應: '应',
  戰: '战',
  戶: '户',
  撲: '扑',
  執: '执',
  擴: '扩',
  掃: '扫',
  揚: '扬',
  擾: '扰',
  撫: '抚',
  搶: '抢',
  護: '护',
  報: '报',
  擔: '担',
  擬: '拟',
  擁: '拥',
  擇: '择',
  敗: '败',
  敵: '敌',
  數: '数',
  斷: '断',
  無: '无',
  舊: '旧',
  時: '时',
  顯: '显',
  曉: '晓',
  暫: '暂',
  機: '机',
  殺: '杀',
  雜: '杂',
  權: '权',
  條: '条',
  來: '来',
  樹: '树',
  檢: '检',
  樓: '楼',
  歡: '欢',
  歐: '欧',
  歲: '岁',
  殘: '残',
  氣: '气',
  漢: '汉',
  湯: '汤',
  溝: '沟',
  沒: '没',
  滄: '沧',
  淚: '泪',
  淺: '浅',
  測: '测',
  濟: '济',
  濃: '浓',
  澤: '泽',
  濤: '涛',
  塗: '涂',
  湧: '涌',
  潤: '润',
  溫: '温',
  灣: '湾',
  濕: '湿',
  滿: '满',
  災: '灾',
  煙: '烟',
  煩: '烦',
  燒: '烧',
  熱: '热',
  營: '营',
  牆: '墙',
  獨: '独',
  獎: '奖',
  現: '现',
  電: '电',
  畫: '画',
  畢: '毕',
  療: '疗',
  瘋: '疯',
  鹽: '盐',
  蓋: '盖',
  眾: '众',
  礦: '矿',
  碼: '码',
  磚: '砖',
  禮: '礼',
  離: '离',
  種: '种',
  積: '积',
  稱: '称',
  穩: '稳',
  簡: '简',
  簽: '签',
  籠: '笼',
  紅: '红',
  級: '级',
  線: '线',
  組: '组',
  細: '细',
  織: '织',
  經: '经',
  結: '结',
  給: '给',
  絕: '绝',
  統: '统',
  綠: '绿',
  緒: '绪',
  緩: '缓',
  編: '编',
  緣: '缘',
  總: '总',
  績: '绩',
  繪: '绘',
  續: '续',
  羅: '罗',
  罵: '骂',
  藝: '艺',
  節: '节',
  華: '华',
  蒼: '苍',
  藍: '蓝',
  藥: '药',
  虛: '虚',
  蟲: '虫',
  裝: '装',
  裡: '里',
  見: '见',
  觀: '观',
  規: '规',
  視: '视',
  覺: '觉',
  計: '计',
  訊: '讯',
  討: '讨',
  訓: '训',
  議: '议',
  講: '讲',
  設: '设',
  訪: '访',
  證: '证',
  評: '评',
  識: '识',
  詩: '诗',
  話: '话',
  語: '语',
  誤: '误',
  說: '说',
  請: '请',
  課: '课',
  誰: '谁',
  調: '调',
  談: '谈',
  謝: '谢',
  謠: '谣',
  謙: '谦',
  謹: '谨',
  譜: '谱',
  譯: '译',
  讓: '让',
  豬: '猪',
  貓: '猫',
  貝: '贝',
  負: '负',
  責: '责',
  賢: '贤',
  貨: '货',
  質: '质',
  購: '购',
  賽: '赛',
  贊: '赞',
  贈: '赠',
  贏: '赢',
  趙: '赵',
  趕: '赶',
  趨: '趋',
  車: '车',
  轉: '转',
  輪: '轮',
  軟: '软',
  輕: '轻',
  載: '载',
  較: '较',
  輸: '输',
  辦: '办',
  辭: '辞',
  還: '还',
  遠: '远',
  違: '违',
  連: '连',
  遲: '迟',
  選: '选',
  遺: '遗',
  郵: '邮',
  鄰: '邻',
  釋: '释',
  鑒: '鉴',
  針: '针',
  鐘: '钟',
  鋼: '钢',
  錢: '钱',
  錦: '锦',
  鍵: '键',
  鏡: '镜',
  鐵: '铁',
  長: '长',
  門: '门',
  閉: '闭',
  間: '间',
  閱: '阅',
  關: '关',
  隊: '队',
  陽: '阳',
  陰: '阴',
  陣: '阵',
  階: '阶',
  際: '际',
  陸: '陆',
  陳: '陈',
  險: '险',
  隨: '随',
  難: '难',
  雖: '虽',
  雞: '鸡',
  霧: '雾',
  靈: '灵',
  靜: '静',
  韓: '韩',
  頁: '页',
  頂: '顶',
  項: '项',
  順: '顺',
  預: '预',
  領: '领',
  題: '题',
  額: '额',
  顏: '颜',
  類: '类',
  顧: '顾',
  風: '风',
  飛: '飞',
  飯: '饭',
  飲: '饮',
  飽: '饱',
  館: '馆',
  馬: '马',
  驗: '验',
  騎: '骑',
  驅: '驱',
  驟: '骤',
  驢: '驴',
  魯: '鲁',
  鮮: '鲜',
  鳥: '鸟',
  鳴: '鸣',
  龍: '龙',
};
const traditionalReaderSearchPattern = new RegExp(`[${Object.keys(traditionalToSimplified).join('')}]`, 'g');

function createReaderSearchMatcher(query: string, options: Pick<ReaderSearchOptions, 'caseSensitive' | 'fuzzy' | 'regex' | 'regexFallbackLiteral' | 'normalizeNfkc' | 'normalizeTraditionalChinese' | 'pinyinInitials'>) {
  const normalize = options.caseSensitive
    ? (value: string) => (options.normalizeNfkc === false ? value : value.normalize('NFKC')).replace(/\s+/g, ' ').trim()
    : (value: string) => normalizeReaderSearchText(value, options);
  const keyword = normalize(query);
  if (options.regex) {
    if (!hasReaderRegexSyntax(query)) {
      if (options.regexFallbackLiteral === false) return () => -1;
    } else {
    try {
      const expression = new RegExp(query, options.caseSensitive ? 'u' : 'iu');
      return (text: string) => {
        const match = expression.exec(text.normalize('NFKC'));
        return match?.index ?? -1;
      };
    } catch {
      if (options.regexFallbackLiteral === false) return () => -1;
      // Fall through to literal matching when a user types an incomplete regex.
    }
    }
  }
  if (options.fuzzy) {
    const tokens = keyword.split(/\s+/).filter(Boolean);
    return (text: string) => {
      const normalized = normalize(text);
      if (!tokens.length) return -1;
      let initials: string | null = null;
      let first = -1;
      let cursor = 0;
      for (const token of tokens) {
        const found = normalized.indexOf(token, cursor);
        if (found < 0) {
          if (options.caseSensitive || options.pinyinInitials === false || !isReaderPinyinInitialQuery(token)) return -1;
          initials ??= getReaderSearchPinyinInitials(text, options);
          if (!initials.includes(token)) return -1;
        }
        if (first < 0) first = found;
        if (found >= 0) cursor = found + token.length;
      }
      return first >= 0 ? first : 0;
    };
  }
  const pinyinKeyword = keyword.replace(/\s+/g, '');
  const canMatchPinyin = !options.caseSensitive && options.pinyinInitials !== false && isReaderPinyinInitialQuery(pinyinKeyword);
  return (text: string) => {
    const normalized = normalize(text);
    const matchIndex = normalized.indexOf(keyword);
    if (matchIndex >= 0 || options.caseSensitive) return matchIndex;
    if (!canMatchPinyin) return -1;
    return getReaderSearchPinyinInitials(text, options).includes(pinyinKeyword) ? 0 : -1;
  };
}

function isReaderPinyinInitialQuery(query: string) {
  return /^[a-z0-9]+$/i.test(query);
}

function hasReaderRegexSyntax(query: string) {
  return /[\\^$.*+?()[\]{}|]/.test(query);
}

export function searchReaderChapter(chapter: ReaderChapter, query: string): ReaderChapterSearchHit[] {
  const keyword = normalizeReaderSearchText(query);
  if (!keyword) return [];
  return chapter.paragraphs.flatMap((paragraph, paragraphIndex) => {
    const normalizedParagraph = normalizeReaderSearchText(paragraph);
    const matchIndex = normalizedParagraph.indexOf(keyword);
    if (matchIndex < 0) return [];
    return [{
      chapterIndex: chapter.index,
      paragraphIndex,
      matchIndex,
      snippet: buildSearchSnippet(paragraph, matchIndex, keyword.length),
    }];
  });
}

function buildSearchSnippet(text: string, matchIndex: number, keywordLength: number) {
  const start = Math.max(0, matchIndex - 18);
  const end = Math.min(text.length, matchIndex + keywordLength + 34);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

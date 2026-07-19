import type { Book } from '../../types';
import type { ReaderChapter } from './readerModel';

const networkChapterPlaceholder = '网络章节未加载，点击目录后获取正文。';
const audioUrlPattern = /^https?:\/\/\S+$/i;
const audioExtensionPattern = /\.(?:m4a|mp3|aac|wav|ogg|opus|flac)(?:[?#].*)?$/i;

export function isComicBook(book: Book | null | undefined) {
  if (!book || !(book.sourceKind === 'network' || book.format.toLowerCase() === 'network')) return false;
  const sourceName = book.networkSource?.sourceName ?? '';
  const sourceUrl = book.networkSource?.bookUrl ?? '';
  return /漫|comic|manhua|ac\.qq|kkmh/i.test(`${sourceName} ${sourceUrl}`);
}

export function isAudiobookChapter(chapter: ReaderChapter | null | undefined) {
  if (!chapter) return false;
  if (chapter.paragraphs.length === 1 && chapter.paragraphs[0] === networkChapterPlaceholder) return false;
  const normalized = chapter.paragraphs.join('\n').split(/\r?\n+/u).map((line) => line.trim()).filter(Boolean).join('\n').replace(/&amp;/g, '&').trim();
  return audioUrlPattern.test(normalized) && audioExtensionPattern.test(normalized);
}

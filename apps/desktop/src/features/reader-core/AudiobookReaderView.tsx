import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../../types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import { openExternalUrl } from '../../services/externalUrlService';
import { loadNetworkBookChapter } from '../../services/unsupportedRuntime';
import { recordLifecycleDiagnostic } from '../../services/lifecycleDiagnosticsService';
import type { ReaderChapter } from './readerModel';
import { putBoundedRecordCache, readerMediaCacheBudgets } from './readerMediaCacheBudgetModel';
export { isAudiobookChapter } from './readerFormatDetectionModel';

type AudiobookReaderViewProps = {
  book: Book;
  chapters: ReaderChapter[];
  activeChapterIndex: number;
  onSelectChapter: (index: number) => void;
  onProgressChange?: (progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
};

type AudioChapter = {
  src: string;
  host: string;
  format: string;
};

const audioUrlPattern = /^https?:\/\/\S+$/i;
const audioExtensionPattern = /\.(?:m4a|mp3|aac|wav|ogg|opus|flac)(?:[?#].*)?$/i;
const networkChapterPlaceholder = '网络章节未加载，点击目录后获取正文。';
const audiobookTocPageSize = 100;

export function AudiobookReaderView({ book, chapters, activeChapterIndex, onSelectChapter, onProgressChange }: AudiobookReaderViewProps) {
  const { t } = useI18n();
  const [loadedAudioByChapter, setLoadedAudioByChapter] = useState<Record<string, AudioChapter>>({});
  const [loadingChapterIndex, setLoadingChapterIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [tocQuery, setTocQuery] = useState('');
  const [tocPage, setTocPage] = useState(1);
  const [tocJumpValue, setTocJumpValue] = useState('');
  const chapterLoadInFlightRef = useRef<Set<string>>(new Set());
  const loadedAudioRef = useRef<Record<string, AudioChapter>>({});
  const audioOrderRef = useRef<string[]>([]);
  const cacheSessionBookRef = useRef(book.id);
  const safeChapterIndex = Math.min(Math.max(activeChapterIndex, 0), Math.max(0, chapters.length - 1));
  const activeChapter = chapters[safeChapterIndex] ?? chapters[0];
  const audioFromChapter = useMemo(() => detectAudioChapter(activeChapter), [activeChapter]);
  const cacheMatchesBook = cacheSessionBookRef.current === book.id;
  const activeAudio = audioFromChapter ?? (cacheMatchesBook ? loadedAudioByChapter[String(activeChapter?.index ?? safeChapterIndex)] : null) ?? null;
  const displayTitle = book.displayTitle || book.title;
  const normalizedTocQuery = tocQuery.trim().normalize('NFKC').toLowerCase();
  const filteredChapters = useMemo(() => chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter, index }) => {
      if (!normalizedTocQuery) return true;
      return chapter.title.normalize('NFKC').toLowerCase().includes(normalizedTocQuery) || String(index + 1).includes(normalizedTocQuery);
    }), [chapters, normalizedTocQuery]);
  const tocPageCount = Math.max(1, Math.ceil(filteredChapters.length / audiobookTocPageSize));
  const safeTocPage = Math.min(Math.max(1, tocPage), tocPageCount);
  const visibleTocChapters = filteredChapters.slice((safeTocPage - 1) * audiobookTocPageSize, safeTocPage * audiobookTocPageSize);

  function cacheAudio(chapterIndex: number, audio: AudioChapter) {
    const result = putBoundedRecordCache(loadedAudioRef.current, audioOrderRef.current, String(chapterIndex), audio, readerMediaCacheBudgets.audioEntries);
    loadedAudioRef.current = result.entries;
    audioOrderRef.current = result.order;
    setLoadedAudioByChapter(result.entries);
    if (result.evictedKeys.length) recordLifecycleDiagnostic('cache', 'audio-buffer.evicted', { bookId: book.id, count: result.evictedKeys.length, limit: readerMediaCacheBudgets.audioEntries });
    recordLifecycleDiagnostic('cache', 'audio-buffer.cached', { bookId: book.id, chapterIndex, size: result.order.length, limit: readerMediaCacheBudgets.audioEntries });
  }

  useEffect(() => {
    cacheSessionBookRef.current = book.id;
    loadedAudioRef.current = {};
    audioOrderRef.current = [];
    chapterLoadInFlightRef.current.clear();
    setLoadedAudioByChapter({});
    return () => {
      recordLifecycleDiagnostic('cache', 'audio-session.released', { bookId: book.id, entries: audioOrderRef.current.length });
      loadedAudioRef.current = {};
      audioOrderRef.current = [];
      chapterLoadInFlightRef.current.clear();
    };
  }, [book.id]);

  useEffect(() => {
    setTocPage((current) => Math.min(Math.max(1, current), tocPageCount));
  }, [tocPageCount]);

  useEffect(() => {
    if (normalizedTocQuery) return;
    setTocPage(Math.floor(safeChapterIndex / audiobookTocPageSize) + 1);
  }, [safeChapterIndex, normalizedTocQuery]);

  useEffect(() => {
    if (!activeChapter || audioFromChapter || (cacheMatchesBook && loadedAudioByChapter[String(activeChapter.index)])) return;
    const chapterRequestKey = `${book.id}:${activeChapter.index}`;
    if (chapterLoadInFlightRef.current.has(chapterRequestKey)) return;
    let cancelled = false;
    const abortController = new AbortController();
    chapterLoadInFlightRef.current.add(chapterRequestKey);
    setError('');
    setLoadingChapterIndex(activeChapter.index);
    loadNetworkBookChapter(book.id, activeChapter.index, { signal: abortController.signal }).then((payload) => {
      if (cancelled) return;
      const audio = payload.media.kind === 'audio'
        ? detectAudioFromText(payload.media.urls[0] ?? '')
        : detectAudioFromText(payload.content);
      if (!audio) {
        setError(t('reader.audiobook.noAudio'));
        return;
      }
      cacheAudio(activeChapter.index, audio);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
    }).finally(() => {
      chapterLoadInFlightRef.current.delete(chapterRequestKey);
      if (!cancelled) setLoadingChapterIndex(null);
    });
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [book.id, activeChapter?.index, audioFromChapter, cacheMatchesBook, loadedAudioByChapter, t]);

  useEffect(() => {
    const source = activeAudio?.src;
    if (!source) return;
    return () => {
      recordLifecycleDiagnostic('cache', 'audio-buffer.released', { bookId: book.id, reason: 'audio-element-replaced' });
    };
  }, [activeAudio?.src, book.id]);

  useEffect(() => {
    if (!activeChapter || !activeAudio) return;
    const pageCount = Math.max(1, chapters.length);
    const pageCurrent = Math.min(pageCount, safeChapterIndex + 1);
    onProgressChange?.(Math.round((pageCurrent / pageCount) * 100), {
      pageCount,
      pageCurrent,
      chapterTitle: activeChapter.title,
      timestamp: new Date().toISOString(),
    });
  }, [activeChapter, activeAudio, chapters.length, safeChapterIndex, onProgressChange]);

  const coverSrc = book.coverImagePath ? resolveAssetSrc(book.coverImagePath) : '';

  function updateTocQuery(value: string) {
    setTocQuery(value);
    setTocPage(1);
  }

  function jumpTocPage() {
    const parsed = Number.parseInt(tocJumpValue, 10);
    if (!Number.isFinite(parsed)) return;
    setTocPage(Math.min(Math.max(1, parsed), tocPageCount));
  }

  return (
    <article className="reader-canvas audiobook-reader-canvas" aria-label={t('reader.audiobook.aria')}>
      <aside className="audiobook-toc" aria-label={t('reader.audiobook.toc')}>
        <div className="audiobook-toc-head">
          <strong>{t('reader.audiobook.toc')}</strong>
          <span>{t('reader.chapterCount', { current: safeChapterIndex + 1, total: Math.max(1, chapters.length) })}</span>
        </div>
        <div className="audiobook-toc-tools">
          <label>
            <BookMindIcon name="readerSearch" />
            <input value={tocQuery} onChange={(event) => updateTocQuery(event.target.value)} placeholder={t('reader.audiobook.searchPlaceholder')} aria-label={t('reader.audiobook.searchPlaceholder')} />
          </label>
          <div className="audiobook-toc-pager" aria-label={t('reader.audiobook.pageAria')}>
            <button type="button" disabled={safeTocPage <= 1} onClick={() => setTocPage(1)}>{t('reader.pagination.first')}</button>
            <button type="button" disabled={safeTocPage <= 1} onClick={() => setTocPage((page) => Math.max(1, page - 1))}>{t('reader.pagination.prev')}</button>
            <span>{safeTocPage}/{tocPageCount}</span>
            <button type="button" disabled={safeTocPage >= tocPageCount} onClick={() => setTocPage((page) => Math.min(tocPageCount, page + 1))}>{t('reader.pagination.next')}</button>
            <button type="button" disabled={safeTocPage >= tocPageCount} onClick={() => setTocPage(tocPageCount)}>{t('reader.pagination.last')}</button>
          </div>
          <div className="audiobook-toc-jump">
            <input value={tocJumpValue} onChange={(event) => setTocJumpValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jumpTocPage(); }} inputMode="numeric" aria-label={t('reader.pagination.jump')} placeholder={t('reader.pagination.jump')} />
            <button type="button" onClick={jumpTocPage}>{t('reader.pagination.jump')}</button>
          </div>
          <span className="audiobook-toc-count">{t('reader.audiobook.pageSummary', { shown: visibleTocChapters.length, total: filteredChapters.length })}</span>
        </div>
        <div className="audiobook-toc-list">
          {visibleTocChapters.length ? visibleTocChapters.map(({ chapter, index }) => (
            <button className={index === safeChapterIndex ? 'active' : ''} type="button" key={chapter.id} onClick={() => onSelectChapter(index)}>
              <span>{chapter.title}</span>
              <em>{index + 1}</em>
            </button>
          )) : <p className="audiobook-toc-empty">{t('reader.audiobook.searchEmpty')}</p>}
        </div>
      </aside>
      <main className="audiobook-stage">
        <section className="audiobook-hero">
          <div className="audiobook-cover">
            {coverSrc ? <img src={coverSrc} alt="" draggable={false} /> : <BookMindIcon name="play" />}
          </div>
          <div className="audiobook-main">
            <div className="audiobook-kicker">
              <span>{t('reader.audiobook.label')}</span>
              {activeAudio ? <em>{activeAudio.format}</em> : null}
            </div>
            <h2>{activeChapter?.title || displayTitle}</h2>
            <p>{displayTitle}</p>
            {activeAudio ? (
              <audio key={activeAudio.src} className="audiobook-player" controls autoPlay={false} preload="metadata" src={activeAudio.src}>{t('reader.audiobook.unsupported')}</audio>
            ) : (
              <div className="audiobook-loading" role="status">{loadingChapterIndex === activeChapter?.index ? t('reader.audiobook.loading') : t('reader.audiobook.waiting')}</div>
            )}
            {error ? <div className="audiobook-error" role="alert">{error}</div> : null}
            <div className="audiobook-actions">
              <span title={activeAudio?.host || book.networkSource?.sourceName}>{activeAudio?.host || book.networkSource?.sourceName || t('reader.networkTools.sourceLoading')}</span>
              <button type="button" disabled={!activeAudio} onClick={() => activeAudio && navigator.clipboard?.writeText(activeAudio.src)} data-tooltip={t('reader.audiobook.copyUrl')} aria-label={t('reader.audiobook.copyUrl')}>
                <BookMindIcon name="copy" />
              </button>
              <button type="button" disabled={!activeAudio} onClick={() => activeAudio && void openExternalUrl(activeAudio.src)} data-tooltip={t('reader.audiobook.openUrl')} aria-label={t('reader.audiobook.openUrl')}>
                <BookMindIcon name="networkTools" />
              </button>
              <button type="button" disabled={safeChapterIndex <= 0} onClick={() => onSelectChapter(safeChapterIndex - 1)} data-tooltip={t('reader.prevChapter')} aria-label={t('reader.prevChapter')}>
                <BookMindIcon name="prevPage" />
              </button>
              <button type="button" disabled={safeChapterIndex >= chapters.length - 1} onClick={() => onSelectChapter(safeChapterIndex + 1)} data-tooltip={t('reader.nextChapter')} aria-label={t('reader.nextChapter')}>
                <BookMindIcon name="nextPage" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </article>
  );
}

function detectAudioChapter(chapter: ReaderChapter | null | undefined) {
  if (!chapter) return null;
  if (chapter.paragraphs.length === 1 && chapter.paragraphs[0] === networkChapterPlaceholder) return null;
  return detectAudioFromText(chapter.paragraphs.join('\n'));
}

function detectAudioFromText(text: string): AudioChapter | null {
  const normalized = text.split(/\r?\n+/u).map((line) => line.trim()).filter(Boolean).join('\n').replace(/&amp;/g, '&').trim();
  if (!audioUrlPattern.test(normalized) || !audioExtensionPattern.test(normalized)) return null;
  try {
    const url = new URL(normalized);
    return {
      src: url.toString(),
      host: url.host,
      format: url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase() ?? 'AUDIO',
    };
  } catch {
    return null;
  }
}

function resolveAssetSrc(src: string) {
  if (/^(?:https?|data|blob|asset):/i.test(src)) return src;
  try {
    return convertFileSrc(src);
  } catch {
    return src;
  }
}

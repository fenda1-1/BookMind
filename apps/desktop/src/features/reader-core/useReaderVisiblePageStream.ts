import { useEffect, useState } from 'react';
import type { ReaderSettings } from '../../types';
import type { ReaderStreamPage } from './ReaderContent';
import { buildReaderVisiblePageText, getReaderStreamPagesSignature } from './readerPageViewModel';

type UseReaderVisiblePageStreamOptions = {
  layoutMode: ReaderSettings['layoutMode'];
  activePageChunksMeasured: boolean;
  visiblePageStream: ReaderStreamPage[];
  pageMeasurementScopeKey: string;
  activeChapterIndex: number;
  activeScreenPage: number;
  activeStreamIndex: number;
  onVisiblePageTextChange?: (text: string) => void;
};

export function useReaderVisiblePageStream({
  layoutMode,
  activePageChunksMeasured,
  visiblePageStream,
  pageMeasurementScopeKey,
  activeChapterIndex,
  activeScreenPage,
  activeStreamIndex,
  onVisiblePageTextChange,
}: UseReaderVisiblePageStreamOptions) {
  const [stableVisiblePageStream, setStableVisiblePageStream] = useState<{ scopeKey: string; pageSignature: string; pages: ReaderStreamPage[] }>({ scopeKey: '', pageSignature: '', pages: [] });

  useEffect(() => {
    if (layoutMode !== 'page') {
      if (stableVisiblePageStream.pages.length) setStableVisiblePageStream({ scopeKey: '', pageSignature: '', pages: [] });
      return;
    }
    if (!activePageChunksMeasured || !visiblePageStream.length) return;
    const nextPageSignature = getReaderStreamPagesSignature(visiblePageStream);
    setStableVisiblePageStream((current) => {
      if (current.scopeKey === pageMeasurementScopeKey && current.pageSignature === nextPageSignature) return current;
      return { scopeKey: pageMeasurementScopeKey, pageSignature: nextPageSignature, pages: visiblePageStream };
    });
  }, [layoutMode, activePageChunksMeasured, visiblePageStream, stableVisiblePageStream.pages.length, pageMeasurementScopeKey]);

  const stableVisiblePageMatchesTarget = stableVisiblePageStream.scopeKey === pageMeasurementScopeKey
    && stableVisiblePageStream.pages.some((page) => page.visibleChapterPosition === activeChapterIndex && page.pageInChapter === activeScreenPage);
  const waitingForMeasuredPage = layoutMode === 'page'
    && !activePageChunksMeasured
    && stableVisiblePageStream.pages.length > 0
    && stableVisiblePageMatchesTarget;
  const renderVisiblePageStream = waitingForMeasuredPage ? stableVisiblePageStream.pages : visiblePageStream;
  const displayedStreamIndex = layoutMode === 'page' && renderVisiblePageStream.length
    ? renderVisiblePageStream[0].streamIndex
    : activeStreamIndex;

  useEffect(() => {
    onVisiblePageTextChange?.(layoutMode === 'page' ? buildReaderVisiblePageText(renderVisiblePageStream) : '');
  }, [layoutMode, renderVisiblePageStream, onVisiblePageTextChange]);

  return { renderVisiblePageStream, displayedStreamIndex, waitingForMeasuredPage };
}

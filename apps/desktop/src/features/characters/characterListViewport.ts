export type CharacterListViewportOptions = {
  totalCount: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  rowGap?: number;
  overscan?: number;
};

export type CharacterListViewport = {
  totalCount: number;
  startIndex: number;
  endIndex: number;
  renderedCount: number;
  rowHeight: number;
  rowGap: number;
  rowStride: number;
  totalHeight: number;
};

export function buildCharacterListViewport(options: CharacterListViewportOptions): CharacterListViewport {
  const totalCount = Math.max(0, Math.floor(options.totalCount));
  const rowHeight = Math.max(1, Math.floor(options.rowHeight));
  const rowGap = Math.max(0, Math.floor(options.rowGap ?? 0));
  const rowStride = rowHeight + rowGap;
  const viewportHeight = Math.max(0, Math.floor(options.viewportHeight));
  const scrollTop = Math.max(0, Math.floor(options.scrollTop));
  const overscan = Math.max(0, Math.floor(options.overscan ?? 0));
  const totalHeight = totalCount > 0 ? totalCount * rowStride - rowGap : 0;

  if (totalCount === 0) {
    return {
      totalCount,
      startIndex: 0,
      endIndex: 0,
      renderedCount: 0,
      rowHeight,
      rowGap,
      rowStride,
      totalHeight,
    };
  }

  const firstVisibleIndex = Math.min(totalCount - 1, Math.floor(scrollTop / rowStride));
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowStride) + 1);
  const startIndex = Math.max(0, firstVisibleIndex - overscan);
  const endIndex = Math.min(totalCount, firstVisibleIndex + visibleCount + overscan);

  return {
    totalCount,
    startIndex,
    endIndex,
    renderedCount: Math.max(0, endIndex - startIndex),
    rowHeight,
    rowGap,
    rowStride,
    totalHeight,
  };
}

export function getCharacterListViewportRowTop(viewport: Pick<CharacterListViewport, 'rowStride'>, index: number) {
  return Math.max(0, Math.floor(index)) * viewport.rowStride;
}

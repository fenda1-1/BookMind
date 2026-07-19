export type VirtualWindow = {
  startIndex: number;
  endIndex: number;
  beforeHeight: number;
  afterHeight: number;
  totalHeight: number;
};

export function getVirtualWindow(itemCount: number, scrollTop: number, viewportHeight: number, rowHeight: number, overscan = 4): VirtualWindow {
  const safeItemCount = Math.max(0, Math.floor(itemCount));
  const safeRowHeight = Math.max(1, rowHeight);
  const safeViewportHeight = Math.max(0, viewportHeight);
  const firstVisible = Math.floor(Math.max(0, scrollTop) / safeRowHeight);
  const visibleCount = Math.ceil(safeViewportHeight / safeRowHeight);
  const startIndex = Math.min(safeItemCount, Math.max(0, firstVisible - overscan));
  const endIndex = Math.min(safeItemCount, Math.max(startIndex, firstVisible + visibleCount + overscan));
  const totalHeight = safeItemCount * safeRowHeight;
  return {
    startIndex,
    endIndex,
    beforeHeight: startIndex * safeRowHeight,
    afterHeight: Math.max(0, totalHeight - endIndex * safeRowHeight),
    totalHeight,
  };
}

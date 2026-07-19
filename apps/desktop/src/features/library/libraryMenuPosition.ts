export type LibraryBookContextMenuState = { x: number; y: number; visible: boolean; bookId: string };

export function clampLibraryBookMenuPosition(x: number, y: number, bookId: string): LibraryBookContextMenuState {
  const menuWidth = 248;
  const menuHeight = 452;
  const padding = 12;
  return { x: Math.min(Math.max(padding, x), Math.max(padding, window.innerWidth - menuWidth - padding)), y: Math.min(Math.max(padding, y), Math.max(padding, window.innerHeight - menuHeight - padding)), visible: true, bookId };
}

export function clampLibraryGroupMenuPosition(x: number, y: number) {
  const menuWidth = 190;
  const menuHeight = 142;
  const padding = 12;
  return { x: Math.min(Math.max(padding, x), window.innerWidth - menuWidth - padding), y: Math.min(Math.max(padding, y), window.innerHeight - menuHeight - padding) };
}

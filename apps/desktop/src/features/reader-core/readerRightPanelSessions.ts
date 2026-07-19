import { emitBrowserDomainEvent, subscribeBrowserDomainEvent } from '../../services/browserDomainEvents';

export type ReaderRightPanelId = 'search' | 'highlights' | 'ai' | 'settings' | 'rules';
export type ReaderRightPanelPlacement = 'floating' | 'sidebar';

export type ReaderRightPanelSessionState = {
  id: ReaderRightPanelId;
  open: boolean;
  placement: ReaderRightPanelPlacement;
};

export type ReaderRightPanelSessionsSnapshot = {
  panels: Record<ReaderRightPanelId, ReaderRightPanelSessionState>;
  order: ReaderRightPanelId[];
  activeId: ReaderRightPanelId | null;
  /** When true, open sessions stay in memory but the right dock/body is hidden. */
  collapsed: boolean;
  /** Shared width for every right-rail panel (search / highlights / AI / settings). */
  width: number;
};

export type ReaderRightPanelCommand =
  | { action: 'open'; id: ReaderRightPanelId }
  | { action: 'close'; id: ReaderRightPanelId }
  | { action: 'activate'; id: ReaderRightPanelId }
  | { action: 'close-all' }
  | { action: 'toggle-collapsed' }
  | { action: 'set-collapsed'; collapsed: boolean }
  | { action: 'set-width'; width: number };

const REPORT_EVENT = 'bookmind:reader-right-panel-report';
const COMMAND_EVENT = 'bookmind:reader-right-panel-command';
const PANEL_ORDER: ReaderRightPanelId[] = ['search', 'highlights', 'ai', 'rules', 'settings'];
export const READER_RIGHT_PANEL_WIDTH_STORAGE_KEY = 'bookmind:reader-right-panel-width';
const LEGACY_HIGHLIGHT_PANEL_WIDTH_STORAGE_KEY = 'bookmind:reader-highlight-panel-width';
export const READER_RIGHT_PANEL_MIN_WIDTH = 340;
export const READER_RIGHT_PANEL_MAX_WIDTH = 720;
export const READER_RIGHT_PANEL_DEFAULT_WIDTH = 420;
export const READER_RIGHT_PANEL_RESIZE_END_EVENT = 'bookmind:reader-right-panel-resize-end';

export function clampReaderRightPanelWidth(value: number) {
  return Math.min(READER_RIGHT_PANEL_MAX_WIDTH, Math.max(READER_RIGHT_PANEL_MIN_WIDTH, Math.round(value)));
}

function readStoredReaderRightPanelWidth() {
  if (typeof window === 'undefined') return READER_RIGHT_PANEL_DEFAULT_WIDTH;
  const shared = Number(window.localStorage.getItem(READER_RIGHT_PANEL_WIDTH_STORAGE_KEY));
  if (Number.isFinite(shared)) return clampReaderRightPanelWidth(shared);
  const legacy = Number(window.localStorage.getItem(LEGACY_HIGHLIGHT_PANEL_WIDTH_STORAGE_KEY));
  if (Number.isFinite(legacy)) {
    const migrated = clampReaderRightPanelWidth(legacy);
    try {
      window.localStorage.setItem(READER_RIGHT_PANEL_WIDTH_STORAGE_KEY, String(migrated));
    } catch {
      // ignore quota / private mode
    }
    return migrated;
  }
  return READER_RIGHT_PANEL_DEFAULT_WIDTH;
}

function persistReaderRightPanelWidth(width: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(READER_RIGHT_PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // ignore quota / private mode
  }
}

let snapshot: ReaderRightPanelSessionsSnapshot = {
  panels: {
    search: { id: 'search', open: false, placement: 'floating' },
    highlights: { id: 'highlights', open: false, placement: 'floating' },
    ai: { id: 'ai', open: false, placement: 'floating' },
    rules: { id: 'rules', open: false, placement: 'floating' },
    settings: { id: 'settings', open: false, placement: 'floating' },
  },
  order: [],
  activeId: null,
  collapsed: false,
  width: READER_RIGHT_PANEL_DEFAULT_WIDTH,
};

const localListeners = new Set<(next: ReaderRightPanelSessionsSnapshot) => void>();

function cloneSnapshot(value: ReaderRightPanelSessionsSnapshot): ReaderRightPanelSessionsSnapshot {
  return {
    activeId: value.activeId,
    collapsed: Boolean(value.collapsed),
    width: clampReaderRightPanelWidth(value.width ?? READER_RIGHT_PANEL_DEFAULT_WIDTH),
    order: [...value.order],
    panels: {
      search: { ...value.panels.search },
      highlights: { ...value.panels.highlights },
      ai: { ...value.panels.ai },
      rules: { ...value.panels.rules },
      settings: { ...value.panels.settings },
    },
  };
}

function orderedOpenIds(next: ReaderRightPanelSessionsSnapshot) {
  const seen = new Set<ReaderRightPanelId>();
  const ids: ReaderRightPanelId[] = [];
  for (const id of next.order) {
    if (next.panels[id]?.open && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  for (const id of PANEL_ORDER) {
    if (next.panels[id]?.open && !seen.has(id)) ids.push(id);
  }
  return ids;
}

function firstOpenId(next: ReaderRightPanelSessionsSnapshot, prefer?: ReaderRightPanelId | null) {
  const openIds = orderedOpenIds(next);
  if (prefer && openIds.includes(prefer)) return prefer;
  return openIds[0] ?? null;
}

function publishSnapshot() {
  const next = cloneSnapshot(snapshot);
  localListeners.forEach((listener) => listener(next));
  emitBrowserDomainEvent(REPORT_EVENT, next);
}

function sameSnapshot(a: ReaderRightPanelSessionsSnapshot, b: ReaderRightPanelSessionsSnapshot) {
  if (a.activeId !== b.activeId) return false;
  if (Boolean(a.collapsed) !== Boolean(b.collapsed)) return false;
  if (clampReaderRightPanelWidth(a.width) !== clampReaderRightPanelWidth(b.width)) return false;
  if (a.order.length !== b.order.length) return false;
  if (a.order.some((id, index) => id !== b.order[index])) return false;
  for (const id of PANEL_ORDER) {
    const left = a.panels[id];
    const right = b.panels[id];
    if (left.open !== right.open || left.placement !== right.placement) return false;
  }
  return true;
}

function ensureStoredWidthLoaded() {
  if (typeof window === 'undefined') return;
  const stored = readStoredReaderRightPanelWidth();
  if (stored !== snapshot.width) {
    snapshot = { ...snapshot, width: stored };
  }
}

// Hydrate shared width once at module load in the browser.
if (typeof window !== 'undefined') {
  snapshot = { ...snapshot, width: readStoredReaderRightPanelWidth() };
}

function commit(next: ReaderRightPanelSessionsSnapshot) {
  next.order = orderedOpenIds(next);
  if (next.activeId && !next.panels[next.activeId]?.open) next.activeId = firstOpenId(next);
  if (!next.activeId) next.activeId = firstOpenId(next);
  if (sameSnapshot(snapshot, next)) return;
  snapshot = next;
  publishSnapshot();
}

export function getReaderRightPanelSessionsSnapshot() {
  return cloneSnapshot(snapshot);
}

export function getReaderRightPanelWidth() {
  return clampReaderRightPanelWidth(snapshot.width);
}

export function setReaderRightPanelWidth(width: number | ((current: number) => number)) {
  const current = clampReaderRightPanelWidth(snapshot.width);
  const nextWidth = clampReaderRightPanelWidth(typeof width === 'function' ? width(current) : width);
  if (nextWidth === current) return;
  const next = cloneSnapshot(snapshot);
  next.width = nextWidth;
  persistReaderRightPanelWidth(nextWidth);
  commit(next);
}

/**
 * Update the visible rail during a pointer drag without publishing a session
 * snapshot. Publishing on every pointermove causes the reader page to rerender
 * and remeasure its pagination for each frame.
 */
export function previewReaderRightPanelWidth(width: number) {
  if (typeof document === 'undefined') return;
  const grid = document.querySelector<HTMLElement>('.reader-grid');
  if (!grid) return;
  const value = `${clampReaderRightPanelWidth(width)}px`;
  grid.style.setProperty('--reader-right-panel-width', value);
  grid.style.setProperty('--reader-highlight-panel-width', value);
  grid.style.setProperty('--reader-dock-width', value);
  grid.style.setProperty('--reader-session-rail-width', value);
  grid.classList.add('reader-panel-resizing');
}

/** End the CSS-only preview and allow the ResizeObserver to perform one final measurement. */
export function finishReaderRightPanelWidthPreview() {
  if (typeof document === 'undefined') return;
  document.querySelector<HTMLElement>('.reader-grid')?.classList.remove('reader-panel-resizing');
  window.dispatchEvent(new Event(READER_RIGHT_PANEL_RESIZE_END_EVENT));
}

export function openReaderRightPanelSession(id: ReaderRightPanelId, placement?: ReaderRightPanelPlacement) {
  const next = cloneSnapshot(snapshot);
  const nextPlacement = placement ?? next.panels[id].placement;
  next.panels[id] = {
    id,
    open: true,
    placement: nextPlacement,
  };
  if (!next.order.includes(id)) next.order = [...next.order, id];
  next.activeId = id;
  next.collapsed = false;
  commit(next);
}

export function activateReaderRightPanelSession(id: ReaderRightPanelId) {
  const next = cloneSnapshot(snapshot);
  if (!next.panels[id].open) {
    next.panels[id] = { ...next.panels[id], open: true };
    if (!next.order.includes(id)) next.order = [...next.order, id];
  }
  next.activeId = id;
  next.collapsed = false;
  commit(next);
}

/** Close only when the tab is already the active body; otherwise open/activate it. */
export function toggleReaderRightPanelSession(id: ReaderRightPanelId, placement?: ReaderRightPanelPlacement) {
  if (snapshot.panels[id]?.open && snapshot.activeId === id) {
    closeReaderRightPanelSession(id);
    return;
  }
  openReaderRightPanelSession(id, placement);
}

export function closeReaderRightPanelSession(id: ReaderRightPanelId) {
  const next = cloneSnapshot(snapshot);
  next.panels[id] = { ...next.panels[id], open: false };
  next.order = next.order.filter((item) => item !== id);
  next.activeId = firstOpenId(next, next.activeId === id ? null : next.activeId);
  if (!next.activeId) next.collapsed = false;
  commit(next);
}

export function closeAllReaderRightPanelSessions() {
  const next = cloneSnapshot(snapshot);
  for (const id of PANEL_ORDER) next.panels[id] = { ...next.panels[id], open: false };
  next.order = [];
  next.activeId = null;
  next.collapsed = false;
  commit(next);
}

export function setReaderRightPanelCollapsed(collapsed: boolean) {
  const next = cloneSnapshot(snapshot);
  next.collapsed = collapsed;
  commit(next);
}

export function toggleReaderRightPanelCollapsed() {
  const next = cloneSnapshot(snapshot);
  const openIds = orderedOpenIds(next);
  if (openIds.length === 0) {
    // No sessions yet: open the research desk as the default right sidebar body.
    next.panels.ai = { ...next.panels.ai, open: true };
    if (!next.order.includes('ai')) next.order = [...next.order, 'ai'];
    next.activeId = 'ai';
    next.collapsed = false;
    commit(next);
    return;
  }
  next.collapsed = !next.collapsed;
  commit(next);
}

export function isReaderRightPanelBodyVisible(next = snapshot) {
  return !next.collapsed && orderedOpenIds(next).length > 0;
}

export function setReaderRightPanelPlacement(id: ReaderRightPanelId, placement: ReaderRightPanelPlacement) {
  const next = cloneSnapshot(snapshot);
  next.panels[id] = { ...next.panels[id], placement };
  commit(next);
}

/** @deprecated prefer open/activate/close helpers; kept for gradual migration */
export function reportReaderRightPanelSession(report: {
  id: ReaderRightPanelId;
  open: boolean;
  placement?: ReaderRightPanelPlacement;
  active?: boolean;
}) {
  if (report.open) {
    if (report.active === false) {
      const next = cloneSnapshot(snapshot);
      next.panels[report.id] = {
        id: report.id,
        open: true,
        placement: report.placement ?? next.panels[report.id].placement,
      };
      if (!next.order.includes(report.id)) next.order = [...next.order, report.id];
      commit(next);
      return;
    }
    openReaderRightPanelSession(report.id, report.placement);
    return;
  }
  closeReaderRightPanelSession(report.id);
  if (report.placement) setReaderRightPanelPlacement(report.id, report.placement);
}

export function subscribeReaderRightPanelSessions(handler: (next: ReaderRightPanelSessionsSnapshot) => void) {
  ensureStoredWidthLoaded();
  localListeners.add(handler);
  handler(cloneSnapshot(snapshot));
  const unsubscribeReport = subscribeBrowserDomainEvent<ReaderRightPanelSessionsSnapshot>(REPORT_EVENT, (detail) => {
    if (!detail?.panels) return;
    snapshot = cloneSnapshot({
      panels: detail.panels,
      order: Array.isArray(detail.order) ? detail.order : orderedOpenIds(detail as ReaderRightPanelSessionsSnapshot),
      activeId: detail.activeId ?? null,
      collapsed: Boolean(detail.collapsed),
      width: Number.isFinite(detail.width) ? Number(detail.width) : snapshot.width,
    });
    localListeners.forEach((listener) => listener(cloneSnapshot(snapshot)));
  });
  return () => {
    localListeners.delete(handler);
    unsubscribeReport();
  };
}

export function commandReaderRightPanel(command: ReaderRightPanelCommand) {
  if (command.action === 'toggle-collapsed') {
    toggleReaderRightPanelCollapsed();
    return;
  }
  if (command.action === 'set-collapsed') {
    setReaderRightPanelCollapsed(Boolean(command.collapsed));
    return;
  }
  if (command.action === 'set-width') {
    setReaderRightPanelWidth(command.width);
    return;
  }
  emitBrowserDomainEvent(COMMAND_EVENT, command);
}

export function subscribeReaderRightPanelCommands(handler: (command: ReaderRightPanelCommand) => void) {
  return subscribeBrowserDomainEvent<ReaderRightPanelCommand>(COMMAND_EVENT, (detail) => {
    if (!detail?.action) return;
    if (detail.action === 'toggle-collapsed') {
      toggleReaderRightPanelCollapsed();
      return;
    }
    if (detail.action === 'set-collapsed') {
      setReaderRightPanelCollapsed(Boolean(detail.collapsed));
      return;
    }
    if (detail.action === 'set-width') {
      setReaderRightPanelWidth(Number(detail.width));
      return;
    }
    handler(detail);
  });
}

export function listOpenReaderRightPanels(next = snapshot) {
  return orderedOpenIds(next).map((id) => next.panels[id]);
}

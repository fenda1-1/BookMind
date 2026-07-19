export type MoyuReaderWindowPreset = 'bottom-right' | 'bottom-center' | 'right-rail' | 'custom';

export type MoyuReaderShortcutAction =
  | 'exit'
  | 'previousPage'
  | 'nextPage'
  | 'toggleAutoScroll'
  | 'toggleToolbars'
  | 'decreaseBackgroundOpacity'
  | 'increaseBackgroundOpacity'
  | 'decreaseTextScale'
  | 'increaseTextScale'
  | 'toggleLock';

export type MoyuReaderShortcut =
  | 'disabled'
  | string;

export type MoyuReaderToolbarRevealMode = 'hover' | 'context-menu' | 'shortcut';
export type MoyuReaderTextColorMode = 'preset' | 'custom';

export type MoyuReaderPreset = {
  id: string;
  name: string;
  createdAt: string;
  settings: MoyuReaderProfile;
};

export const MOYU_READER_CUSTOM_PRESETS_KEY = 'bookmind:moyu-reader-custom-presets';

export type MoyuReaderProfile = {
  windowWidth: number;
  windowHeight: number;
  windowPreset: MoyuReaderWindowPreset;
  windowAspectLock: boolean;
  windowAspectRatio: number;
  rememberWindowPosition: boolean;
  windowSnapToEdges: boolean;
  windowX?: number;
  windowY?: number;
  lastWindowGeometry?: MoyuWindowGeometry;
  backgroundOpacity: number;
  textOpacity: number;
  textScale: number;
  textColorMode: MoyuReaderTextColorMode;
  fontFamily: string;
  textColor: string;
  customTextColor: string;
  recentTextColors: string[];
  toolbarsHidden: boolean;
  toolbarRevealMode: MoyuReaderToolbarRevealMode;
  toolbarRevealDelayMs: number;
  bodyHidden: boolean;
  scrollbarVisible: boolean;
  interactionLocked: boolean;
  autoScrollEnabled: boolean;
  autoScrollSpeed: number;
  shortcuts: Record<MoyuReaderShortcutAction, MoyuReaderShortcut>;
};

export type MoyuToolbarVisibilityState = {
  toolbarsHidden: boolean;
  toolbarVisible: boolean;
  toolbarCanRevealByHover: boolean;
  toolbarCanRevealByContextMenu: boolean;
  toolbarCanRevealByShortcut: boolean;
};

export type MoyuWindowMonitor = {
  position: { x: number; y: number };
  size: { width: number; height: number };
} | null | undefined;

export type MoyuWindowGeometry = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

export type MoyuEditorScope = 'current-window' | 'global';
export type MoyuPresetAutoApplyMode = 'off' | 'last-used' | 'current-book';

export type MoyuPresetAutoApplyState = {
  mode: MoyuPresetAutoApplyMode;
  lastPresetId: string | null;
  bookPresetIds: Record<string, string>;
};

export type MoyuPresetBundle = {
  schema: 'bookmind.moyu-reader.presets.v1';
  exportedAt: string;
  presets: MoyuReaderPreset[];
};

export const MOYU_READER_PRESET_AUTOSAVE_KEY = 'bookmind:moyu-reader-preset-auto-apply';

export const defaultMoyuReaderProfile: MoyuReaderProfile = {
  windowWidth: 520,
  windowHeight: 280,
  windowPreset: 'bottom-right',
  windowAspectLock: false,
  windowAspectRatio: 520 / 280,
  rememberWindowPosition: true,
  windowSnapToEdges: true,
  backgroundOpacity: 0.42,
  textOpacity: 0.92,
  textScale: 1.12,
  textColorMode: 'preset',
  fontFamily: 'Georgia, "LXGW WenKai", "Source Han Serif SC", serif',
  textColor: 'currentColor',
  customTextColor: '#111827',
  recentTextColors: [],
  toolbarsHidden: true,
  toolbarRevealMode: 'hover',
  toolbarRevealDelayMs: 160,
  bodyHidden: false,
  scrollbarVisible: false,
  interactionLocked: false,
  autoScrollEnabled: false,
  autoScrollSpeed: 18,
  shortcuts: {
    exit: 'escape',
    previousPage: 'arrowleft',
    nextPage: 'arrowright',
    toggleAutoScroll: 'space',
    toggleToolbars: 'ctrl-alt-t',
    decreaseBackgroundOpacity: 'ctrl-arrowdown',
    increaseBackgroundOpacity: 'ctrl-arrowup',
    decreaseTextScale: 'ctrl--',
    increaseTextScale: 'ctrl-=',
    toggleLock: 'ctrl-l',
  },
};

export function normalizeMoyuReaderProfile(value: Partial<MoyuReaderProfile> | null | undefined): MoyuReaderProfile {
  const draft = value && typeof value === 'object' ? value : {};
  const normalized: MoyuReaderProfile = {
    ...defaultMoyuReaderProfile,
    windowWidth: clampNumber(draft.windowWidth, defaultMoyuReaderProfile.windowWidth, 360, 1200),
    windowHeight: clampNumber(draft.windowHeight, defaultMoyuReaderProfile.windowHeight, 160, 900),
    windowPreset: isMoyuWindowPreset(draft.windowPreset) ? draft.windowPreset : defaultMoyuReaderProfile.windowPreset,
    windowAspectLock: typeof draft.windowAspectLock === 'boolean' ? draft.windowAspectLock : defaultMoyuReaderProfile.windowAspectLock,
    windowAspectRatio: clampNumber(draft.windowAspectRatio, defaultMoyuReaderProfile.windowAspectRatio, 0.2, 6),
    rememberWindowPosition: typeof draft.rememberWindowPosition === 'boolean' ? draft.rememberWindowPosition : defaultMoyuReaderProfile.rememberWindowPosition,
    windowSnapToEdges: typeof draft.windowSnapToEdges === 'boolean' ? draft.windowSnapToEdges : defaultMoyuReaderProfile.windowSnapToEdges,
    backgroundOpacity: clampNumber(draft.backgroundOpacity, defaultMoyuReaderProfile.backgroundOpacity, 0, 0.96),
    textOpacity: clampNumber(draft.textOpacity, defaultMoyuReaderProfile.textOpacity, 0.2, 1),
    textScale: clampNumber(draft.textScale, defaultMoyuReaderProfile.textScale, 0.72, 1.8),
    textColorMode: isMoyuTextColorMode(draft.textColorMode) ? draft.textColorMode : defaultMoyuReaderProfile.textColorMode,
    fontFamily: normalizeFontFamily(draft.fontFamily, defaultMoyuReaderProfile.fontFamily),
    textColor: normalizeTextColor(resolveTextColorDraft(draft), defaultMoyuReaderProfile.textColor),
    customTextColor: normalizeTextColor(draft.customTextColor, defaultMoyuReaderProfile.customTextColor),
    recentTextColors: normalizeRecentTextColors(draft.recentTextColors),
    toolbarsHidden: typeof draft.toolbarsHidden === 'boolean' ? draft.toolbarsHidden : defaultMoyuReaderProfile.toolbarsHidden,
    toolbarRevealMode: normalizeToolbarRevealMode(draft.toolbarRevealMode),
    toolbarRevealDelayMs: clampInteger(draft.toolbarRevealDelayMs, defaultMoyuReaderProfile.toolbarRevealDelayMs, 0, 1000),
    bodyHidden: typeof draft.bodyHidden === 'boolean' ? draft.bodyHidden : defaultMoyuReaderProfile.bodyHidden,
    scrollbarVisible: typeof draft.scrollbarVisible === 'boolean' ? draft.scrollbarVisible : defaultMoyuReaderProfile.scrollbarVisible,
    interactionLocked: typeof draft.interactionLocked === 'boolean' ? draft.interactionLocked : defaultMoyuReaderProfile.interactionLocked,
    autoScrollEnabled: typeof draft.autoScrollEnabled === 'boolean' ? draft.autoScrollEnabled : defaultMoyuReaderProfile.autoScrollEnabled,
    autoScrollSpeed: clampInteger(draft.autoScrollSpeed, defaultMoyuReaderProfile.autoScrollSpeed, 6, 90),
    shortcuts: normalizeMoyuShortcuts(draft.shortcuts),
  };

  const windowX = normalizeOptionalCoordinate(draft.windowX);
  const windowY = normalizeOptionalCoordinate(draft.windowY);
  if (windowX !== undefined) normalized.windowX = windowX;
  if (windowY !== undefined) normalized.windowY = windowY;
  const lastWindowGeometry = normalizeMoyuWindowGeometry(draft.lastWindowGeometry);
  if (lastWindowGeometry) normalized.lastWindowGeometry = lastWindowGeometry;
  return normalized;
}

export function patchMoyuReaderProfile(profile: MoyuReaderProfile, patch: Partial<MoyuReaderProfile>): MoyuReaderProfile {
  const nextTextColorMode = isMoyuTextColorMode(patch.textColorMode) ? patch.textColorMode : profile.textColorMode;
  const nextCustomTextColor = typeof patch.customTextColor === 'string' ? patch.customTextColor : profile.customTextColor;
  const nextTextColor = typeof patch.textColor === 'string'
    ? patch.textColor
    : nextTextColorMode === 'custom'
      ? nextCustomTextColor
      : profile.textColor;
  const nextWindowAspectLock = typeof patch.windowAspectLock === 'boolean' ? patch.windowAspectLock : profile.windowAspectLock;
  const nextWindowWidth = typeof patch.windowWidth === 'number' ? clampNumber(patch.windowWidth, profile.windowWidth, 360, 1200) : profile.windowWidth;
  const nextWindowHeight = typeof patch.windowHeight === 'number' ? clampNumber(patch.windowHeight, profile.windowHeight, 160, 900) : profile.windowHeight;
  const nextWindowAspectRatio = typeof patch.windowAspectRatio === 'number'
    ? clampNumber(patch.windowAspectRatio, profile.windowAspectRatio, 0.2, 6)
    : patch.windowWidth !== undefined || patch.windowHeight !== undefined
      ? Math.max(0.2, Math.min(6, nextWindowWidth / Math.max(1, nextWindowHeight)))
      : profile.windowAspectRatio;
  const ratioForLock = typeof patch.windowAspectRatio === 'number' ? nextWindowAspectRatio : profile.windowAspectRatio;
  const adjustedWindowWidth = nextWindowAspectLock && patch.windowWidth === undefined && patch.windowHeight !== undefined
    ? clampNumber(nextWindowHeight * ratioForLock, nextWindowWidth, 360, 1200)
    : nextWindowWidth;
  const adjustedWindowHeight = nextWindowAspectLock && patch.windowHeight === undefined && patch.windowWidth !== undefined
    ? clampNumber(nextWindowWidth / Math.max(0.2, ratioForLock), nextWindowHeight, 160, 900)
    : nextWindowHeight;
  const resolvedWindowAspectRatio = typeof patch.windowAspectRatio === 'number'
    ? nextWindowAspectRatio
    : patch.windowWidth !== undefined || patch.windowHeight !== undefined
      ? Math.max(0.2, Math.min(6, adjustedWindowWidth / Math.max(1, adjustedWindowHeight)))
      : profile.windowAspectRatio;
  return normalizeMoyuReaderProfile({
    ...profile,
    ...patch,
    windowWidth: adjustedWindowWidth,
    windowHeight: adjustedWindowHeight,
    windowAspectLock: nextWindowAspectLock,
    windowAspectRatio: resolvedWindowAspectRatio,
    textColorMode: nextTextColorMode,
    customTextColor: nextCustomTextColor,
    textColor: nextTextColor,
    shortcuts: {
      ...profile.shortcuts,
      ...(patch.shortcuts ?? {}),
    },
  });
}

export function recordMoyuRecentTextColor(profile: MoyuReaderProfile, color: string): MoyuReaderProfile {
  const normalized = normalizeTextColor(color, profile.textColor);
  const recentTextColors = [normalized, ...profile.recentTextColors.filter((item) => item !== normalized)].slice(0, 6);
  return patchMoyuReaderProfile(profile, {
    textColorMode: 'custom',
    textColor: normalized,
    customTextColor: normalized,
    recentTextColors,
  });
}

export function loadMoyuReaderCustomPresets(): MoyuReaderPreset[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MOYU_READER_CUSTOM_PRESETS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMoyuReaderPreset).slice(0, 24);
  } catch {
    return [];
  }
}

export function saveMoyuReaderCustomPreset(name: string, profile: MoyuReaderProfile): MoyuReaderPreset[] {
  const preset: MoyuReaderPreset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `自定义预设 ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    settings: normalizeMoyuReaderProfile(profile),
  };
  const presets = [preset, ...loadMoyuReaderCustomPresets()].slice(0, 24);
  window.localStorage.setItem(MOYU_READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  emitMoyuReaderPresetsUpdated();
  return presets;
}

export function replaceMoyuReaderCustomPreset(id: string, name: string, profile: MoyuReaderProfile): MoyuReaderPreset[] {
  const trimmedName = name.trim();
  const presets = loadMoyuReaderCustomPresets().map((preset) => (
    preset.id === id ? {
      ...preset,
      name: trimmedName || preset.name,
      settings: normalizeMoyuReaderProfile(profile),
    } : preset
  ));
  window.localStorage.setItem(MOYU_READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  emitMoyuReaderPresetsUpdated();
  return presets;
}

export function deleteMoyuReaderCustomPreset(id: string): MoyuReaderPreset[] {
  const presets = loadMoyuReaderCustomPresets().filter((preset) => preset.id !== id);
  window.localStorage.setItem(MOYU_READER_CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  emitMoyuReaderPresetsUpdated();
  return presets;
}

export function exportMoyuReaderPresets(presets = loadMoyuReaderCustomPresets()): string {
  const bundle: MoyuPresetBundle = {
    schema: 'bookmind.moyu-reader.presets.v1',
    exportedAt: new Date().toISOString(),
    presets: presets.map((preset) => ({
      ...preset,
      settings: normalizeMoyuReaderProfile(preset.settings),
    })),
  };
  return JSON.stringify(bundle, null, 2);
}

export function importMoyuReaderPresets(payload: string, strategy: 'replace' | 'merge' = 'merge'): MoyuReaderPreset[] {
  const parsed = JSON.parse(payload) as unknown;
  const imported = normalizeMoyuReaderPresetList(parsed);
  const current = strategy === 'replace' ? [] : loadMoyuReaderCustomPresets();
  const merged = mergeMoyuReaderPresetLists(imported, current);
  window.localStorage.setItem(MOYU_READER_CUSTOM_PRESETS_KEY, JSON.stringify(merged));
  emitMoyuReaderPresetsUpdated();
  return merged;
}

export function summarizeMoyuPresetDiff(current: MoyuReaderProfile, preset: MoyuReaderPreset) {
  const next = normalizeMoyuReaderProfile(preset.settings);
  const parts: string[] = [];
  if (current.windowWidth !== next.windowWidth || current.windowHeight !== next.windowHeight) parts.push(`窗口 ${current.windowWidth}×${current.windowHeight} -> ${next.windowWidth}×${next.windowHeight}`);
  if (current.windowPreset !== next.windowPreset) parts.push(`位置 ${formatMoyuWindowPresetLabel(current.windowPreset)} -> ${formatMoyuWindowPresetLabel(next.windowPreset)}`);
  if (current.toolbarRevealMode !== next.toolbarRevealMode) parts.push(`工具栏 ${current.toolbarRevealMode} -> ${next.toolbarRevealMode}`);
  if (current.toolbarRevealDelayMs !== next.toolbarRevealDelayMs) parts.push(`延迟 ${current.toolbarRevealDelayMs}ms -> ${next.toolbarRevealDelayMs}ms`);
  if (current.textScale !== next.textScale) parts.push(`文字 ${Math.round(current.textScale * 100)}% -> ${Math.round(next.textScale * 100)}%`);
  if (current.backgroundOpacity !== next.backgroundOpacity) parts.push(`背景 ${Math.round(current.backgroundOpacity * 100)}% -> ${Math.round(next.backgroundOpacity * 100)}%`);
  if (current.fontFamily !== next.fontFamily) parts.push(`字体 ${formatMoyuFontSummary(current.fontFamily)} -> ${formatMoyuFontSummary(next.fontFamily)}`);
  return parts;
}

export function loadMoyuPresetAutoApplyState(): MoyuPresetAutoApplyState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MOYU_READER_PRESET_AUTOSAVE_KEY) ?? 'null') as unknown;
    return normalizeMoyuPresetAutoApplyState(parsed);
  } catch {
    return normalizeMoyuPresetAutoApplyState(null);
  }
}

export function saveMoyuPresetAutoApplyState(state: Partial<MoyuPresetAutoApplyState>): MoyuPresetAutoApplyState {
  const next = normalizeMoyuPresetAutoApplyState({ ...loadMoyuPresetAutoApplyState(), ...state });
  window.localStorage.setItem(MOYU_READER_PRESET_AUTOSAVE_KEY, JSON.stringify(next));
  return next;
}

export function resolveMoyuPresetAutoApplyPreset(presets: MoyuReaderPreset[], state: MoyuPresetAutoApplyState, bookId?: string | null) {
  if (state.mode === 'off') return null;
  const presetId = state.mode === 'current-book' && bookId ? state.bookPresetIds[bookId] : state.lastPresetId;
  if (!presetId) return null;
  return presets.find((preset) => preset.id === presetId) ?? null;
}

export function rememberMoyuPresetAutoApplyUsage(presetId: string, bookId?: string | null) {
  const state = loadMoyuPresetAutoApplyState();
  return saveMoyuPresetAutoApplyState({
    lastPresetId: presetId,
    bookPresetIds: bookId ? { ...state.bookPresetIds, [bookId]: presetId } : state.bookPresetIds,
  });
}

export function applyMoyuReaderPreset(preset: MoyuReaderPreset) {
  return normalizeMoyuReaderProfile(preset.settings);
}

export function formatMoyuPresetSummary(profile: Pick<MoyuReaderProfile, 'windowWidth' | 'windowHeight' | 'windowPreset' | 'toolbarRevealMode' | 'textColorMode' | 'textColor' | 'customTextColor' | 'fontFamily' | 'shortcuts' | 'toolbarRevealDelayMs'>) {
  const windowLabel = formatMoyuWindowPresetLabel(profile.windowPreset);
  const toolbarLabel = profile.toolbarRevealMode === 'hover' ? '悬停显示' : profile.toolbarRevealMode === 'context-menu' ? '右键菜单' : '快捷键';
  const fontLabel = formatMoyuFontSummary(profile.fontFamily);
  return `${profile.windowWidth} × ${profile.windowHeight} · ${windowLabel} · ${toolbarLabel} · ${fontLabel}`;
}

export function describeMoyuEditorScope(scope: MoyuEditorScope, selectedPresetId?: string | null) {
  const presetLabel = selectedPresetId ? `预设 ${selectedPresetId}` : '无预设';
  return `${scope === 'current-window' ? '当前窗口' : '全局应用'} · ${presetLabel}`;
}

export function formatMoyuWindowPresetLabel(value: MoyuReaderWindowPreset) {
  if (value === 'bottom-center') return '底部居中';
  if (value === 'right-rail') return '右侧竖条';
  if (value === 'custom') return '自定义';
  return '默认右下角';
}

export function buildMoyuLastGeometrySnapshot(geometry: MoyuWindowGeometry) {
  return {
    width: geometry.width,
    height: geometry.height,
    ...(geometry.x !== undefined ? { x: geometry.x } : {}),
    ...(geometry.y !== undefined ? { y: geometry.y } : {}),
  };
}

export function getMoyuShortcutConflictMessages(shortcuts: Record<MoyuReaderShortcutAction, MoyuReaderShortcut>) {
  const shortcutEntries: Array<{ label: string; value: MoyuReaderShortcut }> = [
    { label: '切换工具栏', value: shortcuts.toggleToolbars },
    { label: '上一页', value: shortcuts.previousPage },
    { label: '下一页', value: shortcuts.nextPage },
    { label: '自动滚动', value: shortcuts.toggleAutoScroll },
    { label: '退出摸鱼模式', value: shortcuts.exit },
    { label: '降低背景透明度', value: shortcuts.decreaseBackgroundOpacity },
    { label: '提高背景透明度', value: shortcuts.increaseBackgroundOpacity },
    { label: '减小文字', value: shortcuts.decreaseTextScale },
    { label: '增大文字', value: shortcuts.increaseTextScale },
    { label: '锁定/解锁', value: shortcuts.toggleLock },
  ].filter((item) => item.value !== 'disabled');
  const grouped = new Map<string, string[]>();
  shortcutEntries.forEach((item) => grouped.set(item.value, [...(grouped.get(item.value) ?? []), item.label]));
  return Array.from(grouped.entries())
    .filter(([, labels]) => labels.length > 1)
    .map(([shortcut, labels]) => `${formatMoyuShortcutSettingValue(shortcut)}：${labels.join('、')}`);
}

export function resolveMoyuToolbarVisibilityState(input: Pick<MoyuReaderProfile, 'toolbarsHidden' | 'toolbarRevealMode'> & { toolbarVisible?: boolean }): MoyuToolbarVisibilityState {
  const toolbarVisible = typeof input.toolbarVisible === 'boolean' ? input.toolbarVisible : !input.toolbarsHidden;
  return {
    toolbarsHidden: input.toolbarsHidden,
    toolbarVisible,
    toolbarCanRevealByHover: input.toolbarRevealMode === 'hover',
    toolbarCanRevealByContextMenu: input.toolbarRevealMode === 'context-menu',
    toolbarCanRevealByShortcut: input.toolbarRevealMode === 'shortcut',
  };
}

export function resolveMoyuWindowGeometryFromProfile(profile: Pick<MoyuReaderProfile, 'windowWidth' | 'windowHeight' | 'windowPreset' | 'rememberWindowPosition' | 'windowSnapToEdges' | 'windowX' | 'windowY'>, monitor: MoyuWindowMonitor): MoyuWindowGeometry {
  const width = profile.windowWidth;
  const height = profile.windowHeight;
  if (!monitor) return { width, height };
  const resolvedMonitor = monitor;
  if (profile.windowPreset === 'custom' && profile.rememberWindowPosition && profile.windowX !== undefined && profile.windowY !== undefined) {
    return applyMoyuWindowSnap({ width, height, x: profile.windowX, y: profile.windowY }, profile.windowSnapToEdges, resolvedMonitor);
  }
  if (profile.windowPreset === 'bottom-center') {
    return applyMoyuWindowSnap({
      width,
      height,
      x: resolvedMonitor.position.x + Math.round((resolvedMonitor.size.width - width) / 2),
      y: resolvedMonitor.position.y + resolvedMonitor.size.height - height - 64,
    }, profile.windowSnapToEdges, resolvedMonitor);
  }
  if (profile.windowPreset === 'right-rail') {
    return applyMoyuWindowSnap({
      width,
      height,
      x: resolvedMonitor.position.x + resolvedMonitor.size.width - width - 24,
      y: resolvedMonitor.position.y + Math.round((resolvedMonitor.size.height - height) / 2),
    }, profile.windowSnapToEdges, resolvedMonitor);
  }
  return applyMoyuWindowSnap({
    width,
    height,
    x: resolvedMonitor.position.x + resolvedMonitor.size.width - width - 24,
    y: resolvedMonitor.position.y + resolvedMonitor.size.height - height - 64,
  }, profile.windowSnapToEdges, resolvedMonitor);
}

type PositionedMoyuWindowGeometry = MoyuWindowGeometry & { x: number; y: number };

function applyMoyuWindowSnap(position: PositionedMoyuWindowGeometry, enabled: boolean, monitor: NonNullable<MoyuWindowMonitor>) {
  if (!enabled || !monitor) return position;
  return {
    ...position,
    x: snapMoyuCoordinate(position.x, monitor.position.x, monitor.position.x + monitor.size.width - position.width),
    y: snapMoyuCoordinate(position.y, monitor.position.y, monitor.position.y + monitor.size.height - position.height),
  };
}

function snapMoyuCoordinate(value: number, min: number, max: number) {
  if (Math.abs(value - min) <= 24) return min;
  if (Math.abs(value - max) <= 24) return max;
  return value;
}

export function formatMoyuShortcut(shortcut: MoyuReaderShortcut): string {
  if (shortcut === 'disabled') return 'Disabled';
  const parsed = parseMoyuShortcut(shortcut);
  if (!parsed) return shortcut;
  return [...(parsed.ctrl ? ['Ctrl'] : []), ...(parsed.alt ? ['Alt'] : []), ...(parsed.shift ? ['Shift'] : []), formatMoyuShortcutKey(parsed.key)].join('+');
}

export function matchesMoyuShortcut(shortcut: MoyuReaderShortcut, event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): boolean {
  const parsed = parseMoyuShortcut(shortcut);
  if (!parsed) return false;
  return parsed.ctrl === (event.ctrlKey || event.metaKey)
    && parsed.alt === event.altKey
    && parsed.shift === event.shiftKey
    && parsed.key === normalizeEventKey(event.key);
}

export function createMoyuShortcutFromKeyboardEvent(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): MoyuReaderShortcut | null {
  const key = normalizeEventKey(event.key);
  if (!key || key === 'control' || key === 'meta' || key === 'alt' || key === 'shift') return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(key);
  return parts.join('-');
}

function normalizeMoyuShortcuts(value: unknown): MoyuReaderProfile['shortcuts'] {
  const draft = value && typeof value === 'object' ? value as Partial<Record<MoyuReaderShortcutAction, unknown>> : {};
  return {
    exit: normalizeMoyuShortcut(draft.exit, defaultMoyuReaderProfile.shortcuts.exit),
    previousPage: normalizeMoyuShortcut(draft.previousPage, defaultMoyuReaderProfile.shortcuts.previousPage),
    nextPage: normalizeMoyuShortcut(draft.nextPage, defaultMoyuReaderProfile.shortcuts.nextPage),
    toggleAutoScroll: normalizeMoyuShortcut(draft.toggleAutoScroll, defaultMoyuReaderProfile.shortcuts.toggleAutoScroll),
    toggleToolbars: normalizeMoyuShortcut(draft.toggleToolbars, defaultMoyuReaderProfile.shortcuts.toggleToolbars),
    decreaseBackgroundOpacity: normalizeMoyuShortcut(draft.decreaseBackgroundOpacity, defaultMoyuReaderProfile.shortcuts.decreaseBackgroundOpacity),
    increaseBackgroundOpacity: normalizeMoyuShortcut(draft.increaseBackgroundOpacity, defaultMoyuReaderProfile.shortcuts.increaseBackgroundOpacity),
    decreaseTextScale: normalizeMoyuShortcut(draft.decreaseTextScale, defaultMoyuReaderProfile.shortcuts.decreaseTextScale),
    increaseTextScale: normalizeMoyuShortcut(draft.increaseTextScale, defaultMoyuReaderProfile.shortcuts.increaseTextScale),
    toggleLock: normalizeMoyuShortcut(draft.toggleLock, defaultMoyuReaderProfile.shortcuts.toggleLock),
  };
}

function normalizeMoyuShortcut(value: unknown, fallback: MoyuReaderShortcut): MoyuReaderShortcut {
  if (typeof value !== 'string') return fallback;
  const normalized = normalizeShortcutString(value);
  return normalized ? normalized : fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(Math.min(max, Math.max(min, parsed)).toFixed(2));
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeFontFamily(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  return normalized || fallback;
}

function normalizeTextColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeRecentTextColors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map((item) => normalizeTextColor(item, '')).filter(Boolean))).slice(0, 6);
}

function resolveTextColorDraft(draft: Partial<MoyuReaderProfile>) {
  if (draft.textColorMode === 'custom') return draft.customTextColor ?? draft.textColor;
  return draft.textColor;
}

function normalizeOptionalCoordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function normalizeMoyuWindowGeometry(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const draft = value as Partial<MoyuWindowGeometry>;
  const width = Number(draft.width);
  const height = Number(draft.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  const snapshot: MoyuWindowGeometry = {
    width: clampNumber(width, width, 360, 1200),
    height: clampNumber(height, height, 160, 900),
  };
  const x = normalizeOptionalCoordinate(draft.x);
  const y = normalizeOptionalCoordinate(draft.y);
  if (x !== undefined) snapshot.x = x;
  if (y !== undefined) snapshot.y = y;
  return snapshot;
}

function normalizeMoyuReaderPresetList(value: unknown) {
  const rawList = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { presets?: unknown }).presets)
      ? (value as { presets: unknown[] }).presets
      : [];
  return rawList.filter(isMoyuReaderPreset).slice(0, 24).map((preset) => ({
    ...preset,
    settings: normalizeMoyuReaderProfile(preset.settings),
  }));
}

function mergeMoyuReaderPresetLists(imported: MoyuReaderPreset[], current: MoyuReaderPreset[]) {
  const map = new Map<string, MoyuReaderPreset>();
  [...current, ...imported].forEach((preset) => {
    map.set(preset.id, preset);
  });
  return Array.from(map.values()).slice(0, 24);
}

function normalizeMoyuPresetAutoApplyState(value: unknown): MoyuPresetAutoApplyState {
  const draft = value && typeof value === 'object' ? value as Partial<MoyuPresetAutoApplyState> : {};
  return {
    mode: draft.mode === 'last-used' || draft.mode === 'current-book' || draft.mode === 'off' ? draft.mode : 'off',
    lastPresetId: typeof draft.lastPresetId === 'string' && draft.lastPresetId.trim() ? draft.lastPresetId : null,
    bookPresetIds: draft.bookPresetIds && typeof draft.bookPresetIds === 'object'
      ? Object.fromEntries(Object.entries(draft.bookPresetIds).filter(([, presetId]) => typeof presetId === 'string' && presetId.trim()).map(([bookId, presetId]) => [bookId, presetId as string]))
      : {},
  };
}

function isMoyuWindowPreset(value: unknown): value is MoyuReaderWindowPreset {
  return value === 'bottom-right' || value === 'bottom-center' || value === 'right-rail' || value === 'custom';
}

function isMoyuToolbarRevealMode(value: unknown): value is MoyuReaderToolbarRevealMode {
  return value === 'hover' || value === 'context-menu' || value === 'shortcut';
}

function normalizeToolbarRevealMode(value: unknown): MoyuReaderToolbarRevealMode {
  if (value === 'double-click') return 'context-menu';
  return isMoyuToolbarRevealMode(value) ? value : defaultMoyuReaderProfile.toolbarRevealMode;
}

function formatMoyuFontSummary(fontFamily: string) {
  const firstFamily = fontFamily.split(',')[0]?.trim() ?? fontFamily;
  return firstFamily.replace(/^["']|["']$/g, '') || '默认字体';
}

function isMoyuTextColorMode(value: unknown): value is MoyuReaderTextColorMode {
  return value === 'preset' || value === 'custom';
}

function isMoyuReaderPreset(value: unknown): value is MoyuReaderPreset {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Partial<MoyuReaderPreset>;
  return typeof draft.id === 'string'
    && typeof draft.name === 'string'
    && typeof draft.createdAt === 'string'
    && typeof draft.settings === 'object'
    && draft.settings !== null;
}

function formatMoyuShortcutSettingValue(shortcut: string) {
  return shortcut.split('-').map((part) => (
    part === 'ctrl' ? 'Ctrl/Cmd' : part === 'alt' ? 'Alt' : part === 'shift' ? 'Shift' : part.toUpperCase()
  )).join('+');
}

function normalizeEventKey(key: string) {
  if (key === ' ') return 'space';
  if (key === 'Esc') return 'escape';
  return key.toLowerCase().replace(/\s+/g, '');
}

function formatMoyuShortcutKey(key: string) {
  if (key === 'ctrl') return 'Ctrl';
  if (key === 'alt') return 'Alt';
  if (key === 'shift') return 'Shift';
  if (key === 'escape') return 'Escape';
  if (key === 'arrowleft') return 'ArrowLeft';
  if (key === 'arrowright') return 'ArrowRight';
  if (key === 'arrowdown') return 'ArrowDown';
  if (key === 'arrowup') return 'ArrowUp';
  if (key === 'space') return 'Space';
  return key.toUpperCase();
}

function normalizeShortcutString(value: string): MoyuReaderShortcut | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'disabled') return 'disabled';
  return parseMoyuShortcut(trimmed)?.shortcut ?? null;
}

function parseMoyuShortcut(shortcut: MoyuReaderShortcut): { shortcut: MoyuReaderShortcut; ctrl: boolean; alt: boolean; shift: boolean; key: string } | null {
  if (shortcut === 'disabled') return null;
  const normalizedShortcut = shortcut.toLowerCase().trim();
  const parts = normalizedShortcut.split('-');
  let ctrl = false;
  let alt = false;
  let shift = false;
  const keyParts: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === 'ctrl' || part === 'cmd' || part === 'meta') ctrl = true;
    else if (part === 'alt' || part === 'option') alt = true;
    else if (part === 'shift') shift = true;
    else if (part === '' && index === parts.length - 1 && normalizedShortcut.endsWith('--')) keyParts.push('-');
    else if (part === '') continue;
    else keyParts.push(part);
  }
  const key = keyParts.join('-');
  if (!key || key === 'control' || key === 'meta' || key === 'alt' || key === 'shift') return null;
  return {
    shortcut: [...(ctrl ? ['ctrl'] : []), ...(alt ? ['alt'] : []), ...(shift ? ['shift'] : []), key].join('-'),
    ctrl,
    alt,
    shift,
    key,
  };
}
import { emitMoyuReaderPresetsUpdated } from './readerDomainEvents';

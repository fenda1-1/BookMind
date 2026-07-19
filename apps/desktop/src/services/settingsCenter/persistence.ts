import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import type {
  ChapterRuleDraft,
  ExtendedSettings,
  SettingsChangeHistoryEntry,
  SettingsUpdatedDetail,
  SettingsV2,
} from './schema';
import {
  chapterRuleStorageKey,
  defaultChapterRules,
  defaultExtendedSettings,
  extendedSettingsStorageKey,
  settingsCenterSaveFailedEvent,
  settingsChangeHistoryStorageKey,
  settingsUpdatedEvent,
} from './defaults';
import {
  normalizeChapterRules,
  normalizeExtendedSettings,
} from './migrations';
import { emitSettingsCenterSaveFailed, emitSettingsUpdated } from './events';

let settingsV2SaveQueue: Promise<unknown> = Promise.resolve();
let settingsUpdatedBridgeInstalled = false;
const settingsUpdatedSourceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type SettingsUpdatedBroadcast = SettingsUpdatedDetail & {
  sourceId?: string;
};

export async function loadSettingsV2Snapshot(): Promise<SettingsV2> {
  return await invoke<SettingsV2>('get_settings_v2');
}

export function loadExtendedSettings(): ExtendedSettings {
  try {
    const raw = window.localStorage.getItem(extendedSettingsStorageKey);
    if (!raw) return defaultExtendedSettings;
    return normalizeExtendedSettings(JSON.parse(raw) as Partial<ExtendedSettings>);
  } catch {
    return defaultExtendedSettings;
  }
}

export async function hydrateSettingsV2FromBackend(): Promise<ExtendedSettings> {
  try {
    const snapshot = await loadSettingsV2Snapshot();
    const normalized = normalizeExtendedSettings(snapshot.extended);
    window.localStorage.setItem(extendedSettingsStorageKey, JSON.stringify(normalized));
    dispatchSettingsUpdated({ key: 'settings_v2', scope: 'extended', extended: normalized });
    return normalized;
  } catch {
    return loadExtendedSettings();
  }
}

export function loadChapterRules(): ChapterRuleDraft {
  try {
    const raw = window.localStorage.getItem(chapterRuleStorageKey);
    if (!raw) return defaultChapterRules;
    return normalizeChapterRules(JSON.parse(raw) as Partial<ChapterRuleDraft>);
  } catch {
    return defaultChapterRules;
  }
}

export function saveChapterRules(settings: ChapterRuleDraft): ChapterRuleDraft {
  const normalized = normalizeChapterRules(settings);
  window.localStorage.setItem(chapterRuleStorageKey, JSON.stringify(normalized));
  return normalized;
}

export function saveExtendedSettings(settings: ExtendedSettings, detail: Omit<SettingsUpdatedDetail, 'extended' | 'scope'> = {}): ExtendedSettings {
  const previousExtendedSettings = loadExtendedSettings();
  const normalized = normalizeExtendedSettings(settings);
  window.localStorage.setItem(extendedSettingsStorageKey, JSON.stringify(normalized));
  void saveExtendedSettingsToSettingsV2(normalized);
  recordSettingsChangeHistory({ ...detail, scope: 'extended' }, { previousExtendedSettings });
  dispatchSettingsUpdated({ ...detail, scope: 'extended', extended: normalized });
  return normalized;
}

export function dispatchSettingsUpdated(detail: SettingsUpdatedDetail = {}, options: { broadcast?: boolean } = {}) {
  emitSettingsUpdated(detail);
  if (options.broadcast === false || !canUseTauriEvents()) return;
  void emit(settingsUpdatedEvent, { ...detail, sourceId: settingsUpdatedSourceId }).catch(() => undefined);
}

export function installSettingsUpdatedBridge() {
  if (settingsUpdatedBridgeInstalled || !canUseTauriEvents()) return;
  settingsUpdatedBridgeInstalled = true;
  void listen<SettingsUpdatedBroadcast>(settingsUpdatedEvent, (event) => {
    if (event.payload?.sourceId === settingsUpdatedSourceId) return;
    const { sourceId: _sourceId, ...detail } = event.payload ?? {};
    if (detail.extended) {
      window.localStorage.setItem(extendedSettingsStorageKey, JSON.stringify(normalizeExtendedSettings(detail.extended)));
    }
    dispatchSettingsUpdated(detail, { broadcast: false });
  }).catch(() => {
    settingsUpdatedBridgeInstalled = false;
  });
}

export function loadSettingsChangeHistory(): SettingsChangeHistoryEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(settingsChangeHistoryStorageKey) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSettingsChangeHistoryEntry).slice(0, 50);
  } catch {
    return [];
  }
}

export function recordSettingsChangeHistory(detail: SettingsUpdatedDetail, snapshot: Pick<SettingsChangeHistoryEntry, 'previousExtendedSettings'> = {}) {
  try {
    const keys = Array.from(new Set([...(detail.keys ?? []), detail.key].filter((key): key is string => Boolean(key))));
    const scope = detail.scope ?? 'all';
    const key = detail.key ?? keys[0] ?? scope;
    const entry: SettingsChangeHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      changedAt: new Date().toISOString(),
      scope,
      key,
      keys,
      summary: formatSettingsChangeSummary(scope, key, keys),
      ...snapshot,
    };
    const history = [entry, ...loadSettingsChangeHistory()].slice(0, 50);
    window.localStorage.setItem(settingsChangeHistoryStorageKey, JSON.stringify(history));
    return history;
  } catch {
    return loadSettingsChangeHistory();
  }
}

export function undoLastSettingsChange(): ExtendedSettings | null {
  const history = loadSettingsChangeHistory();
  const restorable = history.find((entry) => entry.previousExtendedSettings);
  if (!restorable?.previousExtendedSettings) return null;
  const restored = normalizeExtendedSettings(restorable.previousExtendedSettings);
  window.localStorage.setItem(extendedSettingsStorageKey, JSON.stringify(restored));
  void saveExtendedSettingsToSettingsV2(restored);
  window.localStorage.setItem(settingsChangeHistoryStorageKey, JSON.stringify(history.filter((entry) => entry.id !== restorable.id)));
  dispatchSettingsUpdated({ key: 'undoLastSettingsChange', keys: restorable.keys, scope: 'extended', extended: restored });
  return restored;
}

async function saveExtendedSettingsToSettingsV2(settings: ExtendedSettings) {
  try {
    await updateSettingsV2Branch({ extended: settings });
  } catch (error) {
    emitSettingsCenterSaveFailed({
      target: 'settings_v2',
      message: formatSettingsSaveError(error),
    });
  }
}

export function updateSettingsV2Branch(update: Partial<Pick<SettingsV2, 'global' | 'reader' | 'extended'>>): Promise<SettingsV2> {
  const saveOperation = settingsV2SaveQueue.then(async () => {
    const snapshot = await loadSettingsV2Snapshot();
    return await invoke<SettingsV2>('update_settings_v2', {
      settings: {
        settingsSchemaVersion: 2,
        global: update.global ?? snapshot.global ?? {},
        reader: update.reader ?? snapshot.reader ?? {},
        extended: update.extended ?? snapshot.extended ?? {},
      },
    });
  });
  settingsV2SaveQueue = saveOperation.catch(() => undefined);
  return saveOperation;
}

export function formatSettingsSaveError(error: unknown) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return '未知错误';
  }
}

export function removeLocalStorageByPrefix(prefix: string) {
  const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith(prefix)));
  keys.forEach((key) => window.localStorage.removeItem(key));
  return keys.length;
}

export function removeLocalStorageKeys(keys: string[]) {
  let removed = 0;
  keys.forEach((key) => {
    if (window.localStorage.getItem(key) !== null) removed += 1;
    window.localStorage.removeItem(key);
  });
  return removed;
}

function isSettingsChangeHistoryEntry(value: unknown): value is SettingsChangeHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<SettingsChangeHistoryEntry>;
  return typeof entry.id === 'string'
    && typeof entry.changedAt === 'string'
    && typeof entry.key === 'string'
    && Array.isArray(entry.keys)
    && typeof entry.summary === 'string'
    && (entry.previousExtendedSettings === undefined || typeof entry.previousExtendedSettings === 'object');
}

function formatSettingsChangeSummary(scope: SettingsUpdatedDetail['scope'], key: string, keys: string[]) {
  const scopeLabel = scope === 'app' ? '应用设置'
    : scope === 'extended' ? '扩展设置'
      : scope === 'reader' ? '阅读器设置'
        : scope === 'chapterRules' ? '章节规则'
          : '全部设置';
  const changedKeys = keys.length ? keys.join(', ') : key;
  return `${scopeLabel}已变更：${changedKeys}`;
}

function canUseTauriEvents() {
  return typeof window !== 'undefined' && Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

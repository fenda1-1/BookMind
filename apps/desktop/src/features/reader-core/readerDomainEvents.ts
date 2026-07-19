import { emitBrowserDomainEvent, subscribeBrowserDomainEvent } from '../../services/browserDomainEvents';
import type { ReaderSettings } from '../../types';

export const readerGlobalSettingsUpdatedEvent = 'bookmind:reader-global-settings-updated';
export const readerApplySettingsNowEvent = 'bookmind:reader-apply-settings-now';

const readerDomainEventNames = {
  readerCacheCleared: 'bookmind:reader-cache-cleared',
  readerPageCacheCleared: 'bookmind:reader-page-cache-cleared',
  readerSearchDataCleared: 'bookmind:clear-reader-search-data',
  cloudAiConsentUpdated: 'bookmind:cloud-ai-consent-updated',
  moyuReaderPresetsUpdated: 'bookmind:moyu-reader-presets-updated',
  moyuSettingsOpenTab: 'bookmind:moyu-settings-open-tab',
  networkPreloadChanged: 'bookmind:network-preload-changed',
  readerGlobalSettingsUpdated: readerGlobalSettingsUpdatedEvent,
  readerApplySettingsNow: readerApplySettingsNowEvent,
} as const;

export type ReaderApplySettingsNowDetail = {
  settings: ReaderSettings;
  source: 'agent';
  changedKeys: (keyof ReaderSettings)[];
};

export type ReaderGlobalSettingsUpdatedDetail = {
  settings: ReaderSettings;
  source: 'localStorage' | 'settings_v2';
  changedKeys?: (keyof ReaderSettings)[];
  reason?: 'user-action' | 'hydrate';
};

export function emitReaderCacheCleared() {
  emitBrowserDomainEvent(readerDomainEventNames.readerCacheCleared, undefined);
}

export function subscribeReaderCacheCleared(handler: () => void) {
  return subscribeBrowserDomainEvent<void>(readerDomainEventNames.readerCacheCleared, handler);
}

export function emitReaderPageCacheCleared() {
  emitBrowserDomainEvent(readerDomainEventNames.readerPageCacheCleared, undefined);
}

export function subscribeReaderPageCacheCleared(handler: () => void) {
  return subscribeBrowserDomainEvent<void>(readerDomainEventNames.readerPageCacheCleared, handler);
}

export function emitReaderSearchDataCleared() {
  emitBrowserDomainEvent(readerDomainEventNames.readerSearchDataCleared, undefined);
}

export function subscribeReaderSearchDataCleared(handler: () => void) {
  return subscribeBrowserDomainEvent<void>(readerDomainEventNames.readerSearchDataCleared, handler);
}

export function emitCloudAiConsentUpdated(detail: { bookId: string; alwaysAllowBook: boolean }) {
  emitBrowserDomainEvent(readerDomainEventNames.cloudAiConsentUpdated, detail);
}

export function emitMoyuReaderPresetsUpdated() {
  emitBrowserDomainEvent(readerDomainEventNames.moyuReaderPresetsUpdated, undefined);
}

export function subscribeMoyuReaderPresetsUpdated(handler: () => void) {
  return subscribeBrowserDomainEvent<void>(readerDomainEventNames.moyuReaderPresetsUpdated, handler);
}

export function emitMoyuSettingsOpenTab(detail: { tab: 'preset' }) {
  emitBrowserDomainEvent(readerDomainEventNames.moyuSettingsOpenTab, detail);
}

export function subscribeMoyuSettingsOpenTab(handler: (detail: { tab: 'preset' }) => void) {
  return subscribeBrowserDomainEvent(readerDomainEventNames.moyuSettingsOpenTab, handler);
}

export function emitNetworkPreloadChanged(detail: { bookId: string; preloadCount: number }) {
  emitBrowserDomainEvent(readerDomainEventNames.networkPreloadChanged, detail);
}

export function subscribeNetworkPreloadChanged(handler: (detail: { bookId: string; preloadCount: number }) => void) {
  return subscribeBrowserDomainEvent(readerDomainEventNames.networkPreloadChanged, handler);
}

export function emitReaderGlobalSettingsUpdated(detail: ReaderGlobalSettingsUpdatedDetail) {
  emitBrowserDomainEvent(readerDomainEventNames.readerGlobalSettingsUpdated, detail);
}

export function subscribeReaderGlobalSettingsUpdated(handler: (detail: ReaderGlobalSettingsUpdatedDetail) => void) {
  return subscribeBrowserDomainEvent(readerDomainEventNames.readerGlobalSettingsUpdated, handler);
}

export function emitReaderApplySettingsNow(detail: ReaderApplySettingsNowDetail) {
  emitBrowserDomainEvent(readerDomainEventNames.readerApplySettingsNow, detail);
}

export function subscribeReaderApplySettingsNow(handler: (detail: ReaderApplySettingsNowDetail) => void) {
  return subscribeBrowserDomainEvent<ReaderApplySettingsNowDetail>(readerDomainEventNames.readerApplySettingsNow, (detail) => {
    if (detail?.settings) handler(detail);
  });
}

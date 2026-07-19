import { emitBrowserDomainEvent, subscribeBrowserDomainEvent } from '../browserDomainEvents';
import type { SettingsUpdatedDetail } from './schema';
import {
  aiCustomSlashCommandsUpdatedEvent,
  settingsCenterSaveFailedEvent,
  settingsUpdatedEvent,
} from './defaults';

export type SettingsCenterSaveFailureDetail = {
  target: 'settings_v2' | 'storage';
  message: string;
};

export function emitSettingsUpdated(detail: SettingsUpdatedDetail = {}) {
  emitBrowserDomainEvent(settingsUpdatedEvent, detail);
}

export function subscribeSettingsUpdated(handler: (detail: SettingsUpdatedDetail) => void) {
  return subscribeBrowserDomainEvent(settingsUpdatedEvent, handler);
}

export function emitSettingsCenterSaveFailed(detail: SettingsCenterSaveFailureDetail) {
  emitBrowserDomainEvent(settingsCenterSaveFailedEvent, detail);
}

export function subscribeSettingsCenterSaveFailed(handler: (detail: SettingsCenterSaveFailureDetail) => void) {
  return subscribeBrowserDomainEvent(settingsCenterSaveFailedEvent, handler);
}

export function emitAiCustomSlashCommandsUpdated() {
  emitBrowserDomainEvent(aiCustomSlashCommandsUpdatedEvent, undefined);
}

export function subscribeAiCustomSlashCommandsUpdated(handler: () => void) {
  return subscribeBrowserDomainEvent<void>(aiCustomSlashCommandsUpdatedEvent, handler);
}

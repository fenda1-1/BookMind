import {
  loadAiApiKeyStorageStatus,
  loadLocalEncryptionStatus,
  rotateLocalDataKey,
  setLocalMasterPassword,
  verifyLocalMasterPassword,
  type LocalEncryptionStatus,
} from '../../services/settingsCenterService';
import type { Translator } from '../../i18n';
import { shortKeyId } from './settingsCenterStatusFormatModel';

type SettingsSecurityActionsDeps = {
  getLocalEncryptionStatus: () => LocalEncryptionStatus | null;
  getMasterPasswordDraft: () => string;
  getMasterPasswordVerifyDraft: () => string;
  t: Translator;
  setAiApiKeyStorageStatus: (status: Awaited<ReturnType<typeof loadAiApiKeyStorageStatus>> | null) => void;
  setAiApiKeyStorageStatusError: (error: string) => void;
  setLoadingAiApiKeyStorageStatus: (loading: boolean) => void;
  setLoadingLocalEncryptionStatus: (loading: boolean) => void;
  setLastLocalKeyRotationSummary: (summary: string) => void;
  setLocalEncryptionStatus: (status: LocalEncryptionStatus | null) => void;
  setLocalEncryptionStatusError: (error: string) => void;
  setLocalKeyRotationBusy: (busy: boolean) => void;
  setMasterPasswordBusy: (busy: boolean) => void;
  setMasterPasswordDraft: (draft: string) => void;
  setMasterPasswordVerifyDraft: (draft: string) => void;
  setSaveStatus: (status: string) => void;
  confirmRotate: (message: string) => Promise<boolean>;
  formatError: (error: unknown) => string;
};

export function createSettingsSecurityActions(deps: SettingsSecurityActionsDeps) {
  async function refreshLocalEncryptionStatus() {
    deps.setLoadingLocalEncryptionStatus(true);
    deps.setLocalEncryptionStatusError('');
    try {
      deps.setLocalEncryptionStatus(await loadLocalEncryptionStatus());
    } catch (error) {
      deps.setLocalEncryptionStatus(null);
      deps.setLocalEncryptionStatusError(deps.formatError(error));
    } finally {
      deps.setLoadingLocalEncryptionStatus(false);
    }
  }

  async function setMasterPasswordFromSettings() {
    const masterPasswordDraft = deps.getMasterPasswordDraft();
    if (!masterPasswordDraft.trim()) {
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordEmpty'));
      return;
    }
    if (masterPasswordDraft.length < 8) {
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordTooShort'));
      return;
    }
    deps.setMasterPasswordBusy(true);
    try {
      const status = await setLocalMasterPassword(masterPasswordDraft);
      deps.setLocalEncryptionStatus(status);
      deps.setMasterPasswordDraft('');
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordEnabled'));
    } catch (error) {
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordSetFailed', { error: deps.formatError(error) }));
    } finally {
      deps.setMasterPasswordBusy(false);
    }
  }

  async function verifyMasterPasswordFromSettings() {
    const masterPasswordVerifyDraft = deps.getMasterPasswordVerifyDraft();
    if (!masterPasswordVerifyDraft.trim()) {
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordVerifyEmpty'));
      return;
    }
    deps.setMasterPasswordBusy(true);
    try {
      const status = await verifyLocalMasterPassword(masterPasswordVerifyDraft);
      deps.setLocalEncryptionStatus(status);
      deps.setMasterPasswordVerifyDraft('');
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordVerified'));
    } catch (error) {
      deps.setSaveStatus(deps.t('settings.securityActions.masterPasswordVerifyFailed', { error: deps.formatError(error) }));
    } finally {
      deps.setMasterPasswordBusy(false);
    }
  }

  async function rotateLocalDataKeyFromSettings() {
    if (!await deps.confirmRotate(deps.t('settings.securityActions.confirmRotateLocalDataKey'))) return;
    deps.setLocalKeyRotationBusy(true);
    try {
      const localEncryptionStatus = deps.getLocalEncryptionStatus();
      const masterPasswordVerifyDraft = deps.getMasterPasswordVerifyDraft();
      const result = await rotateLocalDataKey(localEncryptionStatus?.masterPasswordEnabled ? masterPasswordVerifyDraft : undefined);
      deps.setLastLocalKeyRotationSummary(deps.t('settings.securityActions.localKeyRotationSummary', {
        previousKey: shortKeyId(result.previousKeyId),
        activeKey: shortKeyId(result.activeKeyId),
        readerRecords: result.reencryptedReaderRecords,
        noteFiles: result.reencryptedNoteFiles,
      }));
      deps.setMasterPasswordVerifyDraft('');
      deps.setLocalEncryptionStatus(await loadLocalEncryptionStatus());
      deps.setSaveStatus(deps.t('settings.securityActions.localKeyRotated'));
    } catch (error) {
      deps.setSaveStatus(deps.t('settings.securityActions.localKeyRotateFailed', { error: deps.formatError(error) }));
    } finally {
      deps.setLocalKeyRotationBusy(false);
    }
  }

  async function refreshAiApiKeyStorageStatus() {
    deps.setLoadingAiApiKeyStorageStatus(true);
    deps.setAiApiKeyStorageStatusError('');
    try {
      deps.setAiApiKeyStorageStatus(await loadAiApiKeyStorageStatus());
    } catch (error) {
      deps.setAiApiKeyStorageStatus(null);
      deps.setAiApiKeyStorageStatusError(deps.formatError(error));
    } finally {
      deps.setLoadingAiApiKeyStorageStatus(false);
    }
  }

  return {
    refreshLocalEncryptionStatus,
    setMasterPasswordFromSettings,
    verifyMasterPasswordFromSettings,
    rotateLocalDataKeyFromSettings,
    refreshAiApiKeyStorageStatus,
  };
}

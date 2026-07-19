import { invoke } from '@tauri-apps/api/core';

export type DataBackupMode = 'full' | 'incremental';

export type DataBackupResult = {
  backupPath: string;
  restoredFrom: string;
  copiedFiles: number;
  copiedBytes: number;
  reusedFiles: number;
  backupMode: 'full' | 'incremental';
  excludedSecrets: boolean;
  createdAt: string;
};

export async function createDataBackup(backupMode: DataBackupMode = 'full'): Promise<DataBackupResult> {
  return await invoke<DataBackupResult>('create_data_backup', { backupMode });
}

export async function createAutoDataBackup(retentionLimit: number, backupMode: DataBackupMode = 'full'): Promise<DataBackupResult> {
  return await invoke<DataBackupResult>('create_auto_data_backup', { retentionLimit, backupMode });
}

export async function restoreDataBackup(backupPath: string): Promise<DataBackupResult> {
  return await invoke<DataBackupResult>('restore_data_backup', { backupPath });
}

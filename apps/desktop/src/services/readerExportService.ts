import { invoke } from '@tauri-apps/api/core';

export async function writeReaderExportFile(path: string, payload: string): Promise<void> {
  await invoke('write_reader_export_file', { path, payload });
}

export async function writeReaderBinaryFile(path: string, payload: Uint8Array | number[]): Promise<void> {
  await invoke('write_reader_binary_file', { path, payload: Array.from(payload) });
}

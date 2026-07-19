import type { ExtendedSettings } from '../../services/settingsCenterService';

export type TaskConcurrencyPolicy = {
  globalLimit: number;
  importConcurrency: number;
  parseConcurrency: number;
  ftsWriteSerial: boolean;
  vectorConcurrencyReserved: number;
};

export function resolveTaskConcurrencyPolicy(settings: Pick<ExtendedSettings, 'taskConcurrency' | 'importConcurrency' | 'parseConcurrency' | 'ftsWriteSerial' | 'vectorConcurrencyReserved'>): TaskConcurrencyPolicy {
  const globalLimit = clampInteger(settings.taskConcurrency, 1, 8);
  const vectorConcurrencyReserved = Math.min(globalLimit, clampInteger(settings.vectorConcurrencyReserved, 0, 8));
  const availableForCpuTasks = Math.max(1, globalLimit - vectorConcurrencyReserved);
  return {
    globalLimit,
    importConcurrency: Math.min(availableForCpuTasks, clampInteger(settings.importConcurrency, 1, 8)),
    parseConcurrency: Math.min(availableForCpuTasks, clampInteger(settings.parseConcurrency, 1, 8)),
    ftsWriteSerial: settings.ftsWriteSerial,
    vectorConcurrencyReserved,
  };
}

function clampInteger(value: string, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

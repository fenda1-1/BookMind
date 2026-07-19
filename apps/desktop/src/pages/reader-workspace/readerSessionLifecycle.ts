export type ReaderSessionMode = 'main' | 'standalone' | 'detached';

export function resolveReaderSessionMode(options: {
  standaloneReader: boolean;
  detachedFromMain: boolean;
}): ReaderSessionMode {
  if (options.detachedFromMain) return 'detached';
  return options.standaloneReader ? 'standalone' : 'main';
}

export function shouldKeepMainReaderMounted(sessionMode: ReaderSessionMode) {
  return sessionMode === 'main';
}

export function shouldRestoreMainReaderAfterWindowClose(sessionMode: ReaderSessionMode) {
  return sessionMode === 'detached';
}

export function shouldBroadcastReaderState(options: {
  sessionMode: ReaderSessionMode;
  multiWindowReaderSync: boolean;
  forceSync?: boolean;
}) {
  return Boolean(options.forceSync || (options.sessionMode === 'standalone' && options.multiWindowReaderSync));
}

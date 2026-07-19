import { useEffect, useRef, useState } from 'react';
import type { Translator } from '../../i18n';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import { getReaderSpeechSynthesis } from './readerPageRuntime';
import { createReaderReadAloudActions } from './readerReadAloudActions';
import { parseBoundedInteger, type ReaderReadAloudSegment } from './readerInteractionModel';
import { resolveReaderReadAloudVoiceURI } from './readerReadAloudVoiceModel';
import type { ReaderChapter } from './readerModel';

export type ReaderReadAloudLocation = {
  sourceChapterIndex: number;
  paragraphIndex: number | null;
};

type UseReaderReadAloudControllerOptions = {
  activeChapter: ReaderChapter | undefined;
  bookId: string | undefined;
  extendedSettings: ExtendedSettings;
  t: Translator;
};

export function useReaderReadAloudController({
  activeChapter,
  bookId,
  extendedSettings,
  t,
}: UseReaderReadAloudControllerOptions) {
  const [readAloudActive, setReadAloudActive] = useState(false);
  const [readAloudPaused, setReadAloudPaused] = useState(false);
  const [readAloudSupported, setReadAloudSupported] = useState(false);
  const [readAloudLocation, setReadAloudLocation] = useState<ReaderReadAloudLocation | null>(null);
  const [readAloudVoices, setReadAloudVoices] = useState<SpeechSynthesisVoice[]>([]);
  const readAloudUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readAloudQueueRef = useRef<ReaderReadAloudSegment[]>([]);
  const readAloudQueueIndexRef = useRef(0);
  const readAloudStoppingRef = useRef(false);
  const readAloudSessionRef = useRef(0);

  const readerReadAloudEnabled = extendedSettings.readerReadAloudEnabled;
  const readerReadAloudRate = parseBoundedInteger(extendedSettings.readerReadAloudRate, 100, 50, 200) / 100;
  const readerReadAloudPitch = parseBoundedInteger(extendedSettings.readerReadAloudPitch, 100, 50, 200) / 100;
  const readAloudAvailable = readerReadAloudEnabled && readAloudSupported && Boolean(activeChapter);
  const readAloudStartLabel = readAloudSupported ? t('reader.readAloud.start') : t('reader.readAloud.unsupported');
  const readerReadAloudVoiceProfile = {
    readerReadAloudNarratorVoiceURI: extendedSettings.readerReadAloudNarratorVoiceURI,
    readerReadAloudMaleVoiceURI: extendedSettings.readerReadAloudMaleVoiceURI,
    readerReadAloudFemaleVoiceURI: extendedSettings.readerReadAloudFemaleVoiceURI,
    readerReadAloudCharacterVoiceRules: extendedSettings.readerReadAloudCharacterVoiceRules,
  };

  const readerReadAloudActions = createReaderReadAloudActions({
    getActiveChapter: () => activeChapter,
    getReadAloudAvailable: () => readAloudAvailable,
    getReaderReadAloudEnabled: () => readerReadAloudEnabled,
    getReaderReadAloudRate: () => readerReadAloudRate,
    getReaderReadAloudPitch: () => readerReadAloudPitch,
    resolveReaderReadAloudVoice: (segment) => {
      const resolution = resolveReaderReadAloudVoiceURI(segment, readerReadAloudVoiceProfile, readAloudVoices);
      return readAloudVoices.find((voice) => voice.voiceURI === resolution.voiceURI) ?? null;
    },
    getReaderSpeechSynthesis,
    canCreateSpeechSynthesisUtterance: () => typeof SpeechSynthesisUtterance !== 'undefined',
    createSpeechSynthesisUtterance: (text) => new SpeechSynthesisUtterance(text),
    readAloudUtteranceRef,
    readAloudQueueRef,
    readAloudQueueIndexRef,
    readAloudStoppingRef,
    readAloudSessionRef,
    getReadAloudActive: () => readAloudActive,
    getReadAloudPaused: () => readAloudPaused,
    setReadAloudActive,
    setReadAloudPaused,
    setReadAloudLocation,
  });

  const {
    startReaderReadAloud,
    pauseOrResumeReaderReadAloud,
    cancelReaderReadAloudEngine,
    stopReaderReadAloud,
  } = readerReadAloudActions;

  useEffect(() => {
    const synth = getReaderSpeechSynthesis();
    setReadAloudSupported(Boolean(synth && typeof SpeechSynthesisUtterance !== 'undefined'));
    if (!synth || typeof synth.getVoices !== 'function') return;
    const refreshVoices = () => setReadAloudVoices(synth.getVoices());
    refreshVoices();
    synth.addEventListener?.('voiceschanged', refreshVoices);
    return () => synth.removeEventListener?.('voiceschanged', refreshVoices);
  }, []);

  useEffect(() => {
    stopReaderReadAloud();
  }, [bookId, activeChapter?.id, readerReadAloudEnabled, readAloudSupported]);

  return {
    readAloudActive,
    readAloudPaused,
    readAloudLocation,
    readerReadAloudEnabled,
    readAloudAvailable,
    readAloudStartLabel,
    startReaderReadAloud,
    pauseOrResumeReaderReadAloud,
    cancelReaderReadAloudEngine,
    stopReaderReadAloud,
  };
}

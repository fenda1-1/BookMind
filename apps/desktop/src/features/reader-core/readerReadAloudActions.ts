import type { MutableRefObject } from 'react';
import type { ReaderChapter } from './readerModel';
import { buildReaderReadAloudSegments, type ReaderReadAloudSegment } from './readerInteractionModel';

type ReaderSpeechSynthesis = Pick<SpeechSynthesis, 'cancel' | 'pause' | 'resume' | 'speak'>;
type ReaderSpeechSynthesisUtterance = SpeechSynthesisUtterance & { text?: string };
type ReaderSpeechSynthesisVoice = SpeechSynthesisVoice;

type ReaderReadAloudActionDeps = {
  getActiveChapter: () => ReaderChapter | undefined;
  getReadAloudAvailable: () => boolean;
  getReaderReadAloudEnabled: () => boolean;
  getReaderReadAloudRate: () => number;
  getReaderReadAloudPitch: () => number;
  resolveReaderReadAloudVoice: (segment: ReaderReadAloudSegment) => ReaderSpeechSynthesisVoice | null;
  getReaderSpeechSynthesis: () => ReaderSpeechSynthesis | null;
  canCreateSpeechSynthesisUtterance: () => boolean;
  createSpeechSynthesisUtterance: (text: string) => ReaderSpeechSynthesisUtterance;
  readAloudUtteranceRef: MutableRefObject<ReaderSpeechSynthesisUtterance | null>;
  readAloudQueueRef: MutableRefObject<ReaderReadAloudSegment[]>;
  readAloudQueueIndexRef: MutableRefObject<number>;
  readAloudStoppingRef: MutableRefObject<boolean>;
  readAloudSessionRef: MutableRefObject<number>;
  getReadAloudActive: () => boolean;
  getReadAloudPaused: () => boolean;
  setReadAloudActive: (value: boolean) => void;
  setReadAloudPaused: (value: boolean) => void;
  setReadAloudLocation: (location: { sourceChapterIndex: number; paragraphIndex: number | null } | null) => void;
};

export function createReaderReadAloudActions(deps: ReaderReadAloudActionDeps) {
  const {
    getActiveChapter,
    getReadAloudAvailable,
    getReaderReadAloudEnabled,
    getReaderReadAloudRate,
    getReaderReadAloudPitch,
    resolveReaderReadAloudVoice,
    getReaderSpeechSynthesis,
    canCreateSpeechSynthesisUtterance,
    createSpeechSynthesisUtterance,
    readAloudUtteranceRef,
    readAloudQueueRef,
    readAloudQueueIndexRef,
    readAloudStoppingRef,
    readAloudSessionRef,
    getReadAloudActive,
    getReadAloudPaused,
    setReadAloudActive,
    setReadAloudPaused,
    setReadAloudLocation,
  } = deps;

  function cancelReaderReadAloudEngine() {
    readAloudSessionRef.current += 1;
    readAloudStoppingRef.current = true;
    readAloudQueueRef.current = [];
    readAloudQueueIndexRef.current = 0;
    readAloudUtteranceRef.current = null;
    setReadAloudLocation(null);
    getReaderSpeechSynthesis()?.cancel();
  }

  function stopReaderReadAloud() {
    cancelReaderReadAloudEngine();
    setReadAloudActive(false);
    setReadAloudPaused(false);
    readAloudStoppingRef.current = false;
  }

  function startNextReadAloudSegment(sessionId: number) {
    if (sessionId !== readAloudSessionRef.current || readAloudStoppingRef.current) return;
    const synth = getReaderSpeechSynthesis();
    if (!synth || !canCreateSpeechSynthesisUtterance() || !getReaderReadAloudEnabled()) {
      stopReaderReadAloud();
      return;
    }
    const segment = readAloudQueueRef.current[readAloudQueueIndexRef.current];
    if (!segment) {
      readAloudUtteranceRef.current = null;
      setReadAloudActive(false);
      setReadAloudPaused(false);
      setReadAloudLocation(null);
      return;
    }
    const activeChapter = getActiveChapter();
    setReadAloudLocation(activeChapter ? { sourceChapterIndex: activeChapter.index, paragraphIndex: segment.paragraphIndex } : null);
    const utterance = createSpeechSynthesisUtterance(segment.text);
    utterance.lang = 'zh-CN';
    utterance.rate = getReaderReadAloudRate();
    utterance.pitch = getReaderReadAloudPitch();
    const voice = resolveReaderReadAloudVoice(segment);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (sessionId !== readAloudSessionRef.current || readAloudStoppingRef.current) return;
      readAloudQueueIndexRef.current += 1;
      startNextReadAloudSegment(sessionId);
    };
    utterance.onerror = () => {
      if (sessionId !== readAloudSessionRef.current || readAloudStoppingRef.current) return;
      readAloudUtteranceRef.current = null;
      setReadAloudActive(false);
      setReadAloudPaused(false);
      setReadAloudLocation(null);
    };
    readAloudUtteranceRef.current = utterance;
    synth.speak(utterance);
  }

  function startReaderReadAloud(startParagraphIndex?: number) {
    const activeChapter = getActiveChapter();
    if (!activeChapter || !getReadAloudAvailable()) return;
    const synth = getReaderSpeechSynthesis();
    if (!synth || !canCreateSpeechSynthesisUtterance()) return;
    const segments = buildReaderReadAloudSegments(activeChapter, startParagraphIndex);
    if (!segments.length) return;
    readAloudSessionRef.current += 1;
    const sessionId = readAloudSessionRef.current;
    readAloudStoppingRef.current = true;
    synth.cancel();
    readAloudQueueRef.current = segments;
    readAloudQueueIndexRef.current = 0;
    readAloudStoppingRef.current = false;
    setReadAloudActive(true);
    setReadAloudPaused(false);
    startNextReadAloudSegment(sessionId);
  }

  function pauseOrResumeReaderReadAloud() {
    const synth = getReaderSpeechSynthesis();
    if (!synth || !getReadAloudActive()) return;
    if (getReadAloudPaused()) {
      synth.resume();
      setReadAloudPaused(false);
      return;
    }
    synth.pause();
    setReadAloudPaused(true);
  }

  return {
    startNextReadAloudSegment,
    startReaderReadAloud,
    pauseOrResumeReaderReadAloud,
    cancelReaderReadAloudEngine,
    stopReaderReadAloud,
  };
}

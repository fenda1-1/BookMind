import { useEffect, useRef, useState } from 'react';
import type { TranslationLanguage, TranslationSource } from '../../types';
import type { TranslationSourcePickerOption } from '../settings-center/settingsCenterTranslationModel';
import { getReaderTranslationErrorDetail, type ReaderTranslationErrorCode } from './readerTranslationModel';
import {
  executeReaderTranslation,
  prepareReaderTranslation,
  ReaderTranslationError,
  saveReaderTranslationPreferences,
  type PreparedReaderTranslation,
} from './readerTranslationService';

export type ReaderTranslationState = {
  open: boolean;
  sourceText: string;
  result: string;
  status: 'idle' | 'preparing' | 'confirming' | 'translating' | 'success' | 'error';
  errorCode: ReaderTranslationErrorCode | null;
  errorDetail: string;
  providerLabel: string;
  sourceId: string;
  sourceKind: TranslationSource['kind'] | null;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
  sourceOptions: TranslationSourcePickerOption[];
};

const initialReaderTranslationState: ReaderTranslationState = {
  open: false,
  sourceText: '',
  result: '',
  status: 'idle',
  errorCode: null,
  errorDetail: '',
  providerLabel: '',
  sourceId: '',
  sourceKind: null,
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  sourceOptions: [],
};

type ReaderTranslationChoices = Pick<ReaderTranslationState, 'sourceId' | 'sourceLanguage' | 'targetLanguage'>;

export function useReaderTranslationController() {
  const [state, setState] = useState<ReaderTranslationState>(initialReaderTranslationState);
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const preparedRef = useRef<PreparedReaderTranslation | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  async function startPreparedTranslation(prepared: PreparedReaderTranslation, sequence: number) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setState((current) => ({ ...current, status: 'translating', result: '', errorCode: null, errorDetail: '' }));
    try {
      const result = await executeReaderTranslation(prepared, controller.signal);
      if (controller.signal.aborted || sequence !== requestSequenceRef.current) return;
      setState((current) => ({ ...current, status: 'success', result }));
    } catch (error) {
      if (controller.signal.aborted || sequence !== requestSequenceRef.current) return;
      setState((current) => ({
        ...current,
        status: 'error',
        errorCode: error instanceof ReaderTranslationError ? error.code : 'request-failed',
        errorDetail: getReaderTranslationErrorDetail(error),
      }));
    }
  }

  async function run(sourceText: string, choices?: Partial<ReaderTranslationChoices>) {
    const selected = sourceText.trim();
    if (!selected) return;
    const sequence = ++requestSequenceRef.current;
    abortControllerRef.current?.abort();
    preparedRef.current = null;
    setState((current) => ({
      ...initialReaderTranslationState,
      open: true,
      sourceText: selected,
      sourceId: choices?.sourceId ?? current.sourceId,
      sourceLanguage: choices?.sourceLanguage ?? current.sourceLanguage,
      targetLanguage: choices?.targetLanguage ?? current.targetLanguage,
      sourceOptions: current.sourceOptions,
      status: 'preparing',
    }));
    try {
      const sourceLanguage = choices?.sourceLanguage;
      const targetLanguage = choices?.targetLanguage;
      const prepared = await prepareReaderTranslation({
        sourceText: selected,
        requestId: `reader-translation-${Date.now()}-${sequence}`,
        sourceId: choices?.sourceId,
        sourceLanguage,
        targetLanguage,
      });
      if (sequence !== requestSequenceRef.current) return;
      preparedRef.current = prepared;
      setState((current) => ({
        ...current,
        providerLabel: prepared.providerLabel,
        sourceId: prepared.source.id,
        sourceKind: prepared.source.kind,
        sourceLanguage: prepared.sourceLanguage,
        targetLanguage: prepared.targetLanguage,
        sourceOptions: prepared.sourceOptions,
        status: prepared.requireConfirmation ? 'confirming' : 'translating',
      }));
      if (!prepared.requireConfirmation) await startPreparedTranslation(prepared, sequence);
    } catch (error) {
      if (sequence !== requestSequenceRef.current) return;
      const selectionContext = error instanceof ReaderTranslationError ? error.selectionContext : undefined;
      setState((current) => ({
        ...current,
        ...selectionContext,
        status: 'error',
        errorCode: error instanceof ReaderTranslationError ? error.code : 'request-failed',
        errorDetail: getReaderTranslationErrorDetail(error),
      }));
    }
  }

  function open(sourceText: string) {
    void run(sourceText);
  }

  function confirm() {
    const prepared = preparedRef.current;
    if (!prepared) return;
    void startPreparedTranslation(prepared, requestSequenceRef.current);
  }

  function retry() {
    void run(state.sourceText, state);
  }

  function changeSource(sourceId: string) {
    void saveReaderTranslationPreferences({
      translationActiveSourceId: sourceId,
      translationSourceLanguage: state.sourceLanguage,
      translationTargetLanguage: state.targetLanguage,
    });
    void run(state.sourceText, { ...state, sourceId });
  }

  function changeSourceLanguage(sourceLanguage: TranslationLanguage) {
    void saveReaderTranslationPreferences({
      translationActiveSourceId: state.sourceId,
      translationSourceLanguage: sourceLanguage,
      translationTargetLanguage: state.targetLanguage,
    });
    void run(state.sourceText, { ...state, sourceLanguage });
  }

  function changeTargetLanguage(targetLanguage: Exclude<TranslationLanguage, 'auto'>) {
    void saveReaderTranslationPreferences({
      translationActiveSourceId: state.sourceId,
      translationSourceLanguage: state.sourceLanguage,
      translationTargetLanguage: targetLanguage,
    });
    void run(state.sourceText, { ...state, targetLanguage });
  }

  function swapLanguages() {
    const sourceLanguage = state.targetLanguage;
    const targetLanguage = state.sourceLanguage === 'auto'
      ? (state.targetLanguage.startsWith('zh') ? 'en' : 'zh-CN')
      : state.sourceLanguage;
    changeLanguages(sourceLanguage, targetLanguage);
  }

  function changeLanguages(sourceLanguage: TranslationLanguage, targetLanguage: Exclude<TranslationLanguage, 'auto'>) {
    void saveReaderTranslationPreferences({
      translationActiveSourceId: state.sourceId,
      translationSourceLanguage: sourceLanguage,
      translationTargetLanguage: targetLanguage,
    });
    void run(state.sourceText, { ...state, sourceLanguage, targetLanguage });
  }

  function close() {
    requestSequenceRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    preparedRef.current = null;
    setState(initialReaderTranslationState);
  }

  return { state, open, confirm, retry, close, changeSource, changeSourceLanguage, changeTargetLanguage, swapLanguages };
}

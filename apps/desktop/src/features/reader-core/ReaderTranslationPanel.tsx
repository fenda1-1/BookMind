import { useEffect, useState } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n } from '../../i18n';
import type { TranslationLanguage } from '../../types';
import type { ReaderTranslationState } from './useReaderTranslationController';
import { ReaderTranslationSourcePicker } from './ReaderTranslationSourcePicker';

const readerTranslationErrorKeys = {
  'cloud-disabled': 'reader.translation.error.cloud-disabled',
  'selection-disabled': 'reader.translation.error.selection-disabled',
  'provider-missing': 'reader.translation.error.provider-missing',
  'provider-disabled': 'reader.translation.error.provider-disabled',
  'provider-key-missing': 'reader.translation.error.provider-key-missing',
  'model-missing': 'reader.translation.error.model-missing',
  'request-failed': 'reader.translation.error.request-failed',
} as const;

type ReaderTranslationPanelProps = {
  state: ReaderTranslationState;
  onConfirm: () => void;
  onRetry: () => void;
  onClose: () => void;
  onSourceChange: (sourceId: string) => void;
  onSourceLanguageChange: (language: TranslationLanguage) => void;
  onTargetLanguageChange: (language: Exclude<TranslationLanguage, 'auto'>) => void;
  onSwapLanguages: () => void;
};

const translationLanguages: TranslationLanguage[] = ['auto', 'zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];

export function ReaderTranslationPanel({ state, onConfirm, onRetry, onClose, onSourceChange, onSourceLanguageChange, onTargetLanguageChange, onSwapLanguages }: ReaderTranslationPanelProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [state.result]);
  if (!state.open) return null;

  const errorLabel = state.errorCode ? t(readerTranslationErrorKeys[state.errorCode]) : '';
  const busy = state.status === 'preparing' || state.status === 'translating';
  const sourceLanguageOptions = translationLanguages.map((language) => ({ value: language, label: t(`reader.translation.language.${language}` as never) }));
  const targetLanguageOptions = sourceLanguageOptions.filter((option) => option.value !== 'auto') as Array<{ value: Exclude<TranslationLanguage, 'auto'>; label: string }>;
  const localizedSourceOptions = state.sourceOptions.map((option) => option.kind === 'ai-model'
    ? option
    : { ...option, groupLabel: t(`settings.translation.protocol.${option.kind}` as never) });

  async function copyResult() {
    if (!state.result.trim()) return;
    try {
      await navigator.clipboard.writeText(state.result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="reader-translation-panel" aria-label={t('reader.translation.title')} aria-live="polite">
      <header className="reader-translation-header">
        <div className="reader-translation-heading">
          <span className="reader-translation-mark" aria-hidden="true"><BookMindIcon name="translate" /></span>
          <div><strong>{t('reader.translation.title')}</strong>{state.providerLabel ? <span>{state.providerLabel}</span> : null}</div>
        </div>
        <div className="reader-translation-actions">
          <button type="button" onClick={copyResult} disabled={!state.result.trim()} title={copied ? t('reader.translation.copied') : t('reader.translation.copy')} aria-label={copied ? t('reader.translation.copied') : t('reader.translation.copy')}><BookMindIcon name="copy" /></button>
          {state.status === 'error' ? <button type="button" onClick={onRetry} title={t('reader.translation.retry')} aria-label={t('reader.translation.retry')}><BookMindIcon name="retry" /></button> : null}
          <button type="button" onClick={onClose} title={t('reader.translation.close')} aria-label={t('reader.translation.close')}><BookMindIcon name="close" /></button>
        </div>
      </header>
      <div className="reader-translation-controls" aria-label={t('reader.translation.controls')}>
        <ReaderTranslationSourcePicker
          label={t('reader.translation.sourcePicker')}
          searchPlaceholder={t('reader.translation.sourceSearch')}
          emptyLabel={t('reader.translation.sourceEmpty')}
          unavailableLabel={t('reader.translation.sourceUnavailable')}
          value={state.sourceId}
          options={localizedSourceOptions}
          onChange={onSourceChange}
        />
        <div className="reader-translation-direction">
          <ThemedSelect
            label={t('reader.translation.sourceLanguage')}
            ariaLabel={t('reader.translation.sourceLanguage')}
            value={state.sourceLanguage}
            options={sourceLanguageOptions}
            onChange={onSourceLanguageChange}
            menuPlacement="top"
          />
          <button type="button" className="reader-translation-swap" onClick={onSwapLanguages} title={t('reader.translation.swapLanguages')} aria-label={t('reader.translation.swapLanguages')}>⇄</button>
          <ThemedSelect
            label={t('reader.translation.targetLanguage')}
            ariaLabel={t('reader.translation.targetLanguage')}
            value={state.targetLanguage}
            options={targetLanguageOptions}
            onChange={onTargetLanguageChange}
            menuPlacement="top"
          />
        </div>
      </div>
      <div className="reader-translation-content">
        <div className="reader-translation-source">
          <span>{t('reader.translation.source')}</span>
          <div className="reader-translation-pane-scroll">
            <p>{state.sourceText}</p>
          </div>
        </div>
        <div className="reader-translation-result">
          <span>{t('reader.translation.result')}</span>
          <div className="reader-translation-pane-scroll">
            {state.status === 'confirming' ? (
              <div className="reader-translation-confirm">
                <p>{t('reader.translation.confirm')}</p>
                <button type="button" onClick={onConfirm}>{t('reader.translation.confirmAction')}</button>
              </div>
            ) : state.status === 'error' ? (
              <div className="reader-translation-error" role="alert"><strong>{errorLabel}</strong>{state.errorDetail ? <p>{state.errorDetail}</p> : null}</div>
            ) : (
              <p className={busy && !state.result ? 'reader-translation-placeholder' : ''}>{state.result || t(state.status === 'preparing' ? 'reader.translation.preparing' : 'reader.translation.translating')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

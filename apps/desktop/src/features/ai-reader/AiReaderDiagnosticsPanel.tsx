import { sanitizePrivacyObject } from '../../services/settingsCenterService';
import type { AiDiagnostics } from '../../types';
import { useI18n } from '../../i18n';

type AiReaderDiagnosticsPanelProps = {
  diagnostics?: AiDiagnostics;
  status: 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';
  scope: string;
  selectedCommandId?: string;
  copyDiagnosticsAutoRedact: boolean;
  fallbackEnabled: boolean;
  localAiEnabled: boolean;
  cloudEnabled: boolean;
  onRunChapterFallback: () => void;
  onSwitchToCloudMode: () => void;
  onOpenTasks: () => void;
};

export function AiReaderDiagnosticsPanel({
  diagnostics,
  status,
  scope,
  selectedCommandId,
  copyDiagnosticsAutoRedact,
  fallbackEnabled,
  localAiEnabled,
  cloudEnabled,
  onRunChapterFallback,
  onSwitchToCloudMode,
  onOpenTasks,
}: AiReaderDiagnosticsPanelProps) {
  const { t } = useI18n();
  if (!diagnostics || !(status === 'no-result' || status === 'no-index' || status === 'error' || diagnostics.errorKind)) return null;

  function copyDiagnosticInfo() {
    const diagnosticPayload = { diagnostics, status, scope, selectedCommandId };
    const copiedPayload = copyDiagnosticsAutoRedact ? sanitizePrivacyObject(diagnosticPayload, copyDiagnosticsAutoRedact) : diagnosticPayload;
    void navigator.clipboard?.writeText(JSON.stringify(copiedPayload, null, 2));
  }

  return (
    <section className="ai-diagnostic-panel" aria-live="polite">
      <header><strong>{t('ai.diagnostics.title')}</strong><button type="button" onClick={copyDiagnosticInfo}>{t('ai.diagnostics.copy')}</button></header>
      {diagnostics.semanticCapabilityNotice ? (
        <article className="ai-semantic-unavailable" role="status">
          <strong>{diagnostics.semanticCapabilityNotice.title}</strong>
          <p>{diagnostics.semanticCapabilityNotice.detail}</p>
          <span>{diagnostics.semanticCapabilityNotice.action}</span>
        </article>
      ) : null}
      <dl>
        <dt>{t('ai.diagnostics.scope')}</dt><dd>{diagnostics.scope ?? scope}</dd>
        <dt>{t('ai.diagnostics.retrievalQuery')}</dt><dd>{getDiagnosticDisplayText(diagnostics.queryUsed, copyDiagnosticsAutoRedact, t)}</dd>
        <dt>{t('ai.diagnostics.chunks')}</dt><dd>{diagnostics.chunkCount ?? 0}</dd>
        <dt>FTS</dt><dd>{diagnostics.ftsAvailable ? t('ai.diagnostics.available') : t('ai.diagnostics.unavailable')}</dd>
        <dt>{t('ai.diagnostics.indexStatus')}</dt><dd>{diagnostics.indexStatus ?? t('ai.diagnostics.unknown')}</dd>
        {diagnostics.staleReason ? <><dt>{t('ai.diagnostics.staleReason')}</dt><dd>{diagnostics.staleReason}</dd></> : null}
        {diagnostics.cloudErrorMessage ? <><dt>{t('ai.diagnostics.cloudError')}</dt><dd>{getDiagnosticDisplayText(diagnostics.cloudErrorMessage, copyDiagnosticsAutoRedact, t)}</dd></> : null}
        <dt>{t('ai.diagnostics.results')}</dt><dd>{diagnostics.resultCount ?? 0}</dd>
      </dl>
      <div className="ai-diagnostic-actions">
        <button type="button" onClick={onRunChapterFallback} disabled={!fallbackEnabled || !localAiEnabled}>{t('ai.diagnostics.chapterFallback')}</button>
        <button type="button" onClick={onSwitchToCloudMode} disabled={!fallbackEnabled || !cloudEnabled}>{t('ai.diagnostics.cloudFallback')}</button>
        <button type="button" onClick={onOpenTasks}>{t('ai.diagnostics.reindex')}</button>
      </div>
      {diagnostics.recommendations?.length ? <ul>{diagnostics.recommendations.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </section>
  );
}

function getDiagnosticDisplayText(value: string | undefined, redact: boolean, t: ReturnType<typeof useI18n>['t']) {
  if (!value) return t('ai.diagnostics.none');
  return redact ? `[redacted:${value.length}]` : value;
}

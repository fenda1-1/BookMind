import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookMindIcon } from '../../components/BookMindIcon';
import { StructuredAnswerView } from './AiStructuredAnswerView';
import { InlineMarkdownText } from './AiStructuredSectionRenderers';
import { AiReaderDiagnosticsPanel } from './AiReaderDiagnosticsPanel';
import type { AiConversation } from './aiConversationHistory';
import { useI18n, type TranslationKey } from '../../i18n';
import type { AiDiagnostics, Citation } from '../../types';
import { parseAiResponseProtocol } from '../../services/aiResponseProtocol';
import type { AiProtocolCitation, BookMindAiStructuredResponse } from '../../services/aiResponseProtocol';

type AiConversationMessageListProps = {
  conversation: AiConversation;
  bookReady: boolean;
  status: 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';
  saveStatus: string;
  isGenerating: boolean;
  structuredAnswer: BookMindAiStructuredResponse | null;
  shouldRenderStructuredAnswer: BookMindAiStructuredResponse | null;
  renderedBlockLimit: number;
  answer: string;
  citations: Citation[];
  diagnostics?: AiDiagnostics;
  scope: string;
  selectedCommandId?: string;
  copyDiagnosticsAutoRedact: boolean;
  fallbackEnabled: boolean;
  localAiEnabled: boolean;
  cloudEnabled: boolean;
  defaultCitationDensity: 'compact' | 'detailed';
  externalCitationsDisabled: boolean;
  citationJumpRepairEnabled: boolean;
  citationFieldStrictness: 'lenient' | 'normal' | 'strict';
  toolCallDisplayMode: 'hidden' | 'summary' | 'full';
  flashcardDefaults: { tags: string; reviewStatus: 'new' | 'due' | 'reviewed' };
  noCitationWarning: boolean;
  requiredCitationWarning: boolean;
  citationCoverage: { totalClaims: number; supportedClaims: number; percent: number; level: string };
  emptyGuide: React.ReactNode;
  onRenameConversationTitle: (conversationId: string, title: string) => void;
  onQuoteSelection: (text: string) => void;
  onDeleteMessage: (conversationId: string, messageId: string) => void;
  onRunChapterFallback: () => void;
  onSwitchToCloudMode: () => void;
  onOpenTasks: () => void;
  onStop: () => void;
  onCopyAnswer: () => void;
  onRetry: () => void;
  onSaveProtocolDefault: (citation: AiProtocolCitation) => void;
  onSaveProtocolHighlight: (citation: AiProtocolCitation) => void;
  onSaveProtocolExcerpt: (citation: AiProtocolCitation) => void;
  highlightedMessageId?: string | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

type MessageContextMenuState = {
  messageId: string;
  selectionText: string;
  x: number;
  y: number;
} | null;

type InputContextMenuState = { x: number; y: number } | null;

export function AiConversationMessageList({
  conversation,
  bookReady,
  status,
  saveStatus,
  isGenerating,
  shouldRenderStructuredAnswer,
  renderedBlockLimit,
  answer,
  citations,
  diagnostics,
  scope,
  selectedCommandId,
  copyDiagnosticsAutoRedact,
  fallbackEnabled,
  localAiEnabled,
  cloudEnabled,
  defaultCitationDensity,
  externalCitationsDisabled,
  citationJumpRepairEnabled,
  citationFieldStrictness,
  toolCallDisplayMode,
  flashcardDefaults,
  noCitationWarning,
  requiredCitationWarning,
  citationCoverage,
  emptyGuide,
  onRenameConversationTitle,
  onQuoteSelection,
  onDeleteMessage,
  onRunChapterFallback,
  onSwitchToCloudMode,
  onOpenTasks,
  onStop,
  onCopyAnswer,
  onRetry,
  onSaveProtocolDefault,
  onSaveProtocolHighlight,
  onSaveProtocolExcerpt,
  highlightedMessageId = null,
  t,
}: AiConversationMessageListProps) {
  const { locale } = useI18n();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLMenuElement | null>(null);
  const inputContextMenuRef = useRef<HTMLMenuElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [contextMenu, setContextMenu] = useState<MessageContextMenuState>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [inputContextMenu, setInputContextMenu] = useState<InputContextMenuState>(null);
  const messages = conversation.messages;
  const contextMessage = contextMenu ? messages.find((message) => message.id === contextMenu.messageId) : null;
  const contextSelectionText = contextMenu?.selectionText ?? '';
  useEffect(() => {
    if (!contextMenu) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) return;
      setContextMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);
  useEffect(() => {
    if (!inputContextMenu) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && inputContextMenuRef.current?.contains(event.target)) return;
      setInputContextMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setInputContextMenu(null); }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [inputContextMenu]);
  if (messages.length === 0 && status === 'idle' && !answer.trim()) return <>{emptyGuide}</>;
  const renderFallbackAssistant = messages.length === 0 && status !== 'idle' && status !== 'ready';

  function openMessageMenu(event: ReactMouseEvent, messageId: string) {
    event.preventDefault();
    event.stopPropagation();
    const rect = threadRef.current?.getBoundingClientRect();
    const x = rect ? Math.min(Math.max(event.clientX - rect.left, 8), Math.max(8, rect.width - 204)) : event.clientX;
    const y = rect ? Math.max(event.clientY - rect.top, 8) : event.clientY;
    const selection = event.type === 'contextmenu' ? window.getSelection() : null;
    const messageElement = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest<HTMLElement>('.ai-conversation-message') : null;
    const selectionInsideMessage = Boolean(
      selection?.rangeCount
      && selection.anchorNode
      && selection.focusNode
      && messageElement?.contains(selection.anchorNode)
      && messageElement.contains(selection.focusNode),
    );
    setContextMenu({ messageId, selectionText: selectionInsideMessage ? selection?.toString().trim() ?? '' : '', x, y });
  }

  function deleteMessage(messageId: string) {
    onDeleteMessage(conversation.id, messageId);
    setContextMenu(null);
  }

  function copyMessage(content: string) {
    void navigator.clipboard?.writeText(content);
    setContextMenu(null);
  }

  function copyContextSelection() {
    if (contextSelectionText) void navigator.clipboard?.writeText(contextSelectionText);
    setContextMenu(null);
  }

  function quoteContextSelection() {
    if (contextSelectionText) onQuoteSelection(contextSelectionText);
    setContextMenu(null);
  }

  function renameConversationFromMessage() {
    setContextMenu(null);
    setRenameDraft(conversation.title);
    setRenameDialogOpen(true);
  }

  function commitRenameDialog() {
    onRenameConversationTitle(conversation.id, renameDraft.trim());
    setRenameDialogOpen(false);
    setRenameDraft('');
    setInputContextMenu(null);
  }

  function openRenameInputContextMenu(event: ReactMouseEvent<HTMLInputElement>) {
    event.preventDefault();
    event.stopPropagation();
    setInputContextMenu({
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - 208)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - 184)),
    });
  }

  function copyRenameSelection(cut = false) {
    const input = renameInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const selected = renameDraft.slice(start, end);
    if (!selected) return setInputContextMenu(null);
    void navigator.clipboard?.writeText(selected);
    if (cut) {
      const next = `${renameDraft.slice(0, start)}${renameDraft.slice(end)}`;
      setRenameDraft(next);
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start, start); });
    }
    setInputContextMenu(null);
  }

  async function pasteIntoRename() {
    const input = renameInputRef.current;
    if (!input) return;
    try {
      const clipboardText = await navigator.clipboard?.readText();
      if (typeof clipboardText !== 'string') return;
      const start = input.selectionStart ?? renameDraft.length;
      const end = input.selectionEnd ?? start;
      const next = `${renameDraft.slice(0, start)}${clipboardText}${renameDraft.slice(end)}`;
      setRenameDraft(next);
      requestAnimationFrame(() => { input.focus(); const cursor = start + clipboardText.length; input.setSelectionRange(cursor, cursor); });
    } finally {
      setInputContextMenu(null);
    }
  }

  return (
    <div ref={threadRef} className="ai-conversation-thread" aria-label={t('ai.messages.thread')} onMouseLeave={() => setContextMenu(null)}>
      {messages.map((message, index) => (
        <article id={`ai-message-${message.id}`} className={`ai-conversation-message ${message.role}${message.id === highlightedMessageId ? ' timeline-highlight' : ''}`} key={message.id} onContextMenu={(event) => openMessageMenu(event, message.id)}>
          <span className="ai-message-avatar" aria-hidden="true">{message.role === 'user' ? t('ai.messages.userRole') : <BookMindIcon name="aiDesk" />}</span>
          <div className="ai-message-main">
            <header>
              {message.role === 'assistant' ? <span>{message.model ?? 'AI'}</span> : null}
              <span className="ai-message-header-actions">
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt, locale)}</time>
                <MessageActionRail
                  canRetry={message.role === 'assistant' && index === messages.length - 1 && (Boolean(answer.trim()) || status === 'error' || status === 'no-result')}
                  content={message.role === 'assistant' && index === messages.length - 1 ? answer || message.content : message.content}
                  onCopy={copyMessage}
                  onDelete={() => deleteMessage(message.id)}
                  onMore={(event) => openMessageMenu(event, message.id)}
                  onRetry={onRetry}
                  t={t}
                />
              </span>
            </header>
          </div>
          <div className="ai-message-body">
            {message.role === 'assistant' && index === messages.length - 1 ? (
              <AssistantMessageBody
                answer={answer || message.content}
                status={status}
                saveStatus={saveStatus}
                bookReady={bookReady}
                isGenerating={isGenerating}
                shouldRenderStructuredAnswer={shouldRenderStructuredAnswer}
                renderedBlockLimit={renderedBlockLimit}
                defaultCitationDensity={defaultCitationDensity}
                externalCitationsDisabled={externalCitationsDisabled}
                citationJumpRepairEnabled={citationJumpRepairEnabled}
                citationFieldStrictness={citationFieldStrictness}
                toolCallDisplayMode={toolCallDisplayMode}
                flashcardDefaults={flashcardDefaults}
                citations={citations}
                diagnostics={diagnostics}
                scope={scope}
                selectedCommandId={selectedCommandId}
                copyDiagnosticsAutoRedact={copyDiagnosticsAutoRedact}
                fallbackEnabled={fallbackEnabled}
                localAiEnabled={localAiEnabled}
                cloudEnabled={cloudEnabled}
                noCitationWarning={noCitationWarning}
                requiredCitationWarning={requiredCitationWarning}
                citationCoverage={citationCoverage}
                onRunChapterFallback={onRunChapterFallback}
                onSwitchToCloudMode={onSwitchToCloudMode}
                onOpenTasks={onOpenTasks}
                onStop={onStop}
                onCopyAnswer={onCopyAnswer}
                onRetry={onRetry}
                t={t}
                onSaveProtocolDefault={onSaveProtocolDefault}
                onSaveProtocolHighlight={onSaveProtocolHighlight}
                onSaveProtocolExcerpt={onSaveProtocolExcerpt}
              />
            ) : message.role === 'assistant' ? (
              <HistoricalAssistantMessageBody
                messageContent={message.content}
                messageStatus={message.status}
                bookReady={bookReady}
                renderedBlockLimit={renderedBlockLimit}
                defaultCitationDensity={defaultCitationDensity}
                externalCitationsDisabled={externalCitationsDisabled}
                citationJumpRepairEnabled={citationJumpRepairEnabled}
                citationFieldStrictness={citationFieldStrictness}
                toolCallDisplayMode={toolCallDisplayMode}
                flashcardDefaults={flashcardDefaults}
                onSaveProtocolDefault={onSaveProtocolDefault}
                onSaveProtocolHighlight={onSaveProtocolHighlight}
                onSaveProtocolExcerpt={onSaveProtocolExcerpt}
                t={t}
              />
            ) : <p>{message.content}</p>}
          </div>
        </article>
      ))}
      {contextMessage ? (
        <menu ref={contextMenuRef} className="ai-message-context-menu" style={{ left: contextMenu?.x, top: contextMenu?.y }} aria-label={t('ai.messages.menu')}>
          <li className="ai-context-menu-heading"><BookMindIcon name={contextSelectionText ? 'highlights' : 'aiMessageMore'} /><span>{contextSelectionText ? t('ai.messages.selectionMenu') : t('ai.messages.menu')}</span></li>
          {contextSelectionText ? (
            <>
              <button type="button" onClick={copyContextSelection}><BookMindIcon name="aiMessageCopy" /><span>{t('ai.messages.copySelection')}</span></button>
              <button type="button" onClick={quoteContextSelection}><BookMindIcon name="note" /><span>{t('ai.messages.quoteSelection')}</span></button>
              <button type="button" onClick={() => copyMessage(contextMessage.content)}><BookMindIcon name="copy" /><span>{t('ai.messages.copy')}</span></button>
            </>
          ) : (
            <>
              <button type="button" onClick={renameConversationFromMessage}><BookMindIcon name="libraryMenuEdit" /><span>{t('ai.messages.rename')}</span></button>
              <button type="button" onClick={() => copyMessage(contextMessage.content)}><BookMindIcon name="aiMessageCopy" /><span>{t('ai.messages.copy')}</span></button>
              <button type="button" className="danger" onClick={() => deleteMessage(contextMessage.id)}><BookMindIcon name="aiMessageDelete" /><span>{t('ai.messages.delete')}</span></button>
            </>
          )}
        </menu>
      ) : null}
      {renameDialogOpen ? (
        <div className="ai-rename-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setRenameDialogOpen(false); setRenameDraft(''); } }}>
          <form className="ai-rename-dialog" role="dialog" aria-modal="true" aria-label={t('ai.messages.renamePrompt')} onSubmit={(event) => { event.preventDefault(); commitRenameDialog(); }}>
            <header><span><BookMindIcon name="libraryMenuEdit" /><strong>{t('ai.messages.rename')}</strong></span><button type="button" className="ai-rename-dialog-close" aria-label={t('settings.common.close')} onClick={() => { setRenameDialogOpen(false); setRenameDraft(''); }}><BookMindIcon name="close" /></button></header>
            <label><span>{t('ai.messages.renamePrompt')}</span><input ref={renameInputRef} autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} onContextMenu={openRenameInputContextMenu} /></label>
            <footer><button type="button" className="ghost-btn small" onClick={() => { setRenameDialogOpen(false); setRenameDraft(''); }}>{t('common.cancel')}</button><button type="submit" className="primary-btn small">{t('common.save')}</button></footer>
          </form>
        </div>
      ) : null}
      {inputContextMenu && typeof document !== 'undefined' ? createPortal(
        <menu ref={inputContextMenuRef} className="ai-input-context-menu" style={{ left: inputContextMenu.x, top: inputContextMenu.y }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { renameInputRef.current?.select(); renameInputRef.current?.focus(); setInputContextMenu(null); }}><BookMindIcon name="toc" /><span>{t('ai.inputMenu.selectAll')}</span></button>
          <button type="button" onClick={() => copyRenameSelection()}><BookMindIcon name="aiMessageCopy" /><span>{t('ai.inputMenu.copy')}</span></button>
          <button type="button" onClick={() => copyRenameSelection(true)}><BookMindIcon name="note" /><span>{t('ai.inputMenu.cut')}</span></button>
          <button type="button" onClick={() => { void pasteIntoRename(); }}><BookMindIcon name="aiMessageExport" /><span>{t('ai.inputMenu.paste')}</span></button>
        </menu>
      , document.body) : null}
      {renderFallbackAssistant ? (
        <article className="ai-conversation-message assistant">
          <AssistantMessageBody
            answer={answer}
            status={status}
            saveStatus={saveStatus}
            bookReady={bookReady}
            isGenerating={isGenerating}
            shouldRenderStructuredAnswer={shouldRenderStructuredAnswer}
            renderedBlockLimit={renderedBlockLimit}
            defaultCitationDensity={defaultCitationDensity}
            externalCitationsDisabled={externalCitationsDisabled}
            citationJumpRepairEnabled={citationJumpRepairEnabled}
            citationFieldStrictness={citationFieldStrictness}
            toolCallDisplayMode={toolCallDisplayMode}
            flashcardDefaults={flashcardDefaults}
            citations={citations}
            diagnostics={diagnostics}
            scope={scope}
            selectedCommandId={selectedCommandId}
            copyDiagnosticsAutoRedact={copyDiagnosticsAutoRedact}
            fallbackEnabled={fallbackEnabled}
            localAiEnabled={localAiEnabled}
            cloudEnabled={cloudEnabled}
            noCitationWarning={noCitationWarning}
            requiredCitationWarning={requiredCitationWarning}
            citationCoverage={citationCoverage}
            onRunChapterFallback={onRunChapterFallback}
            onSwitchToCloudMode={onSwitchToCloudMode}
            onOpenTasks={onOpenTasks}
            onStop={onStop}
            onCopyAnswer={onCopyAnswer}
            onRetry={onRetry}
            t={t}
            onSaveProtocolDefault={onSaveProtocolDefault}
            onSaveProtocolHighlight={onSaveProtocolHighlight}
            onSaveProtocolExcerpt={onSaveProtocolExcerpt}
          />
        </article>
      ) : null}
      {messages.length === 0 && !renderFallbackAssistant ? (
        <article className="ai-conversation-message assistant">
          <p>{bookReady ? t('ai.helpReady') : t('ai.helpEmpty')}</p>
        </article>
      ) : null}
    </div>
  );
}

function HistoricalAssistantMessageBody({
  messageContent,
  messageStatus,
  bookReady,
  renderedBlockLimit,
  defaultCitationDensity,
  externalCitationsDisabled,
  citationJumpRepairEnabled,
  citationFieldStrictness,
  toolCallDisplayMode,
  flashcardDefaults,
  onSaveProtocolDefault,
  onSaveProtocolHighlight,
  onSaveProtocolExcerpt,
  t,
}: {
  messageContent: string;
  messageStatus?: 'pending' | 'streaming' | 'ready' | 'error';
  bookReady: boolean;
  renderedBlockLimit: number;
  defaultCitationDensity: 'compact' | 'detailed';
  externalCitationsDisabled: boolean;
  citationJumpRepairEnabled: boolean;
  citationFieldStrictness: 'lenient' | 'normal' | 'strict';
  toolCallDisplayMode: 'hidden' | 'summary' | 'full';
  flashcardDefaults: { tags: string; reviewStatus: 'new' | 'due' | 'reviewed' };
  onSaveProtocolDefault: (citation: AiProtocolCitation) => void;
  onSaveProtocolHighlight: (citation: AiProtocolCitation) => void;
  onSaveProtocolExcerpt: (citation: AiProtocolCitation) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) {
  const parsed = useMemo(() => messageContent.trim() ? parseAiResponseProtocol(messageContent) : null, [messageContent]);
  if (!parsed) {
    return (
      <div className="ai-response-card research-report-paper historical">
        <div className="message assistant">
          <p><InlineMarkdownText text={messageContent || (bookReady ? t('ai.helpReady') : t('ai.helpEmpty'))} /></p>
        </div>
        <div className="ai-status" aria-live="polite">{messageStatus ? t(`ai.status.${mapHistoricalStatus(messageStatus)}`) : t('ai.status.ready')}</div>
      </div>
    );
  }
  return (
    <div className="ai-response-card research-report-paper historical">
      <StructuredAnswerView response={parsed} rawAnswer={messageContent} renderedBlockLimit={renderedBlockLimit} defaultCitationDensity={defaultCitationDensity} externalCitationsDisabled={externalCitationsDisabled} citationJumpRepairEnabled={citationJumpRepairEnabled} citationFieldStrictness={citationFieldStrictness} toolCallDisplayMode={toolCallDisplayMode} flashcardDefaults={flashcardDefaults} onSaveProtocolDefault={onSaveProtocolDefault} onSaveProtocolHighlight={onSaveProtocolHighlight} onSaveProtocolExcerpt={onSaveProtocolExcerpt} />
      <div className="ai-status" aria-live="polite">{messageStatus ? t(`ai.status.${mapHistoricalStatus(messageStatus)}`) : t('ai.status.ready')}</div>
    </div>
  );
}

function mapHistoricalStatus(status: 'pending' | 'streaming' | 'ready' | 'error') {
  if (status === 'pending') return 'loading';
  if (status === 'streaming') return 'streaming';
  if (status === 'error') return 'error';
  return 'ready';
}

function AssistantMessageBody(props: Omit<AiConversationMessageListProps, 'conversation' | 'emptyGuide' | 'structuredAnswer' | 'onRenameConversationTitle' | 'onQuoteSelection' | 'onDeleteMessage'> & { bookReady: boolean }) {
  const {
    answer,
    status,
    saveStatus,
    bookReady,
    isGenerating,
    shouldRenderStructuredAnswer,
    renderedBlockLimit,
    defaultCitationDensity,
    externalCitationsDisabled,
    citationJumpRepairEnabled,
    citationFieldStrictness,
    toolCallDisplayMode,
    flashcardDefaults,
    diagnostics,
    scope,
    selectedCommandId,
    copyDiagnosticsAutoRedact,
    fallbackEnabled,
    localAiEnabled,
    cloudEnabled,
    noCitationWarning,
    requiredCitationWarning,
    citationCoverage,
    onRunChapterFallback,
    onSwitchToCloudMode,
    onOpenTasks,
    onStop,
    onRetry,
    onSaveProtocolDefault,
    onSaveProtocolHighlight,
    onSaveProtocolExcerpt,
    t,
  } = props;
  const parsedAnswer = useMemo(() => answer.trim() ? parseAiResponseProtocol(answer) : null, [answer]);
  const effectiveStructuredAnswer = shouldRenderStructuredAnswer ?? parsedAnswer;
  return (
    <div className="ai-response-card research-report-paper">
      {isGenerating ? <span className="ai-paper-scan-cursor" aria-hidden="true" /> : null}
      {isGenerating ? <AiGenerationStages status={status} t={t} /> : null}
      {effectiveStructuredAnswer ? <StructuredAnswerView response={effectiveStructuredAnswer} rawAnswer={answer} renderedBlockLimit={renderedBlockLimit} defaultCitationDensity={defaultCitationDensity} externalCitationsDisabled={externalCitationsDisabled} citationJumpRepairEnabled={citationJumpRepairEnabled} citationFieldStrictness={citationFieldStrictness} toolCallDisplayMode={toolCallDisplayMode} flashcardDefaults={flashcardDefaults} onSaveProtocolDefault={onSaveProtocolDefault} onSaveProtocolHighlight={onSaveProtocolHighlight} onSaveProtocolExcerpt={onSaveProtocolExcerpt} /> : (
        <div className="message assistant">
          <p><InlineMarkdownText text={answer || (bookReady ? t('ai.helpReady') : t('ai.helpEmpty'))} /></p>
        </div>
      )}
      {noCitationWarning ? (
        <section className="ai-no-citation-warning" role="status">
          <strong>{t('ai.messages.noCitationTitle')}</strong>
          <span>{t('ai.messages.noCitationDetail')}</span>
        </section>
      ) : null}
      {requiredCitationWarning ? (
        <section className="ai-required-citation-warning" role="status">
          <strong>{t('ai.messages.insufficientCitationTitle')}</strong>
          <span>{t('ai.messages.insufficientCitationDetail', { supported: citationCoverage.supportedClaims, total: citationCoverage.totalClaims })}</span>
        </section>
      ) : null}
      <AiReaderDiagnosticsPanel
        diagnostics={diagnostics}
        status={status}
        scope={scope}
        selectedCommandId={selectedCommandId}
        copyDiagnosticsAutoRedact={copyDiagnosticsAutoRedact}
        fallbackEnabled={fallbackEnabled}
        localAiEnabled={localAiEnabled}
        cloudEnabled={cloudEnabled}
        onRunChapterFallback={onRunChapterFallback}
        onSwitchToCloudMode={onSwitchToCloudMode}
        onOpenTasks={onOpenTasks}
      />
      <div className="ai-status" aria-live="polite">{saveStatus || t(`ai.status.${status}`)}</div>
      <div className="ai-response-card-actions">
        {isGenerating ? <button type="button" onClick={onStop}>{t('ai.stop')}</button> : null}
      </div>
    </div>
  );
}

function MessageActionRail({
  canRetry,
  content,
  onCopy,
  onDelete,
  onMore,
  onRetry,
  t,
}: {
  canRetry: boolean;
  content: string;
  onCopy: (content: string) => void;
  onDelete: () => void;
  onMore: (event: ReactMouseEvent) => void;
  onRetry: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <span className="ai-message-action-rail" aria-label={t('ai.messages.actions')}>
      {canRetry ? (
        <button className="ai-message-action-btn primary" type="button" data-tooltip={t('ai.retry')} aria-label={t('ai.retry')} onClick={onRetry}>
          <BookMindIcon name="aiMessageRetry" />
        </button>
      ) : null}
      <button className="ai-message-action-btn" type="button" data-tooltip={t('ai.messages.copy')} aria-label={t('ai.messages.copy')} onClick={() => onCopy(content)}>
        <BookMindIcon name="aiMessageCopy" />
      </button>
      <button className="ai-message-action-btn" type="button" data-tooltip={t('ai.messages.more')} aria-label={t('ai.messages.more')} onClick={onMore}>
        <BookMindIcon name="aiMessageMore" />
      </button>
      <span className="ai-message-action-divider" aria-hidden="true" />
      <button className="ai-message-action-btn danger" type="button" data-tooltip={t('ai.messages.delete')} aria-label={t('ai.messages.delete')} onClick={onDelete}>
        <BookMindIcon name="aiMessageDelete" />
      </button>
    </span>
  );
}

function AiGenerationStages({ status, t }: { status: AiConversationMessageListProps['status']; t: AiConversationMessageListProps['t'] }) {
  const stages = [
    { id: 'intent', label: t('ai.messages.stageIntent') },
    { id: 'retrieve', label: t('ai.messages.stageRetrieve') },
    { id: 'compose', label: t('ai.messages.stageCompose') },
    { id: 'citations', label: t('ai.messages.stageCitations') },
  ];
  const activeIndex = status === 'streaming' ? 2 : 1;
  return (
    <ol className="ai-generation-stages" aria-label={t('ai.messages.stages')}>
      {stages.map((stage, index) => (
        <li className={index < activeIndex ? 'done' : index === activeIndex ? 'active' : ''} key={stage.id}>
          <span>{stage.label}</span>
        </li>
      ))}
    </ol>
  );
}

function formatMessageTime(value: string, locale: ReturnType<typeof useI18n>['locale']) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

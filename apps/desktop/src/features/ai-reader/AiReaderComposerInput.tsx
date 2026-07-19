import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { BookMindIcon } from '../../components/BookMindIcon';
import type { Translator } from '../../i18n';

export type AiReaderComposerCommand = {
  id: string;
  label: string;
  prompt: string;
};

type AiReaderComposerInputProps = {
  t: Translator;
  attachments: string[];
  question: string;
  selectedCommand: AiReaderComposerCommand | null;
  slashMenuOpen: boolean;
  activeSlashIndex: number;
  activeSlashCommand: AiReaderComposerCommand | undefined;
  filteredSlashCommands: AiReaderComposerCommand[];
  slashCommandsEnabled: boolean;
  promptModifiers: string[];
  promptInputRef: RefObject<HTMLTextAreaElement | null>;
  slashDetail: React.ReactNode;
  renderSlashCommandPreview: (command: AiReaderComposerCommand) => React.ReactNode;
  onRemoveAttachment: (index: number) => void;
  onRemoveCommand: () => void;
  onQuestionChange: (value: string) => void;
  onOpenSlashMenu: () => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenSlashCommandDetail: (event: ReactMouseEvent, command: AiReaderComposerCommand) => void;
  onSelectSlashCommand: (command: AiReaderComposerCommand) => void;
  onSetActiveSlashIndex: (index: number) => void;
};

export function AiReaderComposerInput({
  t,
  attachments,
  question,
  selectedCommand,
  slashMenuOpen,
  activeSlashIndex,
  activeSlashCommand,
  filteredSlashCommands,
  slashCommandsEnabled,
  promptModifiers,
  promptInputRef,
  slashDetail,
  renderSlashCommandPreview,
  onRemoveAttachment,
  onRemoveCommand,
  onQuestionChange,
  onOpenSlashMenu,
  onPromptKeyDown,
  onOpenSlashCommandDetail,
  onSelectSlashCommand,
  onSetActiveSlashIndex,
}: AiReaderComposerInputProps) {
  const [inputContextMenu, setInputContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputContextMenuRef = useRef<HTMLMenuElement | null>(null);
  useEffect(() => {
    if (!inputContextMenu) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && inputContextMenuRef.current?.contains(event.target)) return;
      setInputContextMenu(null);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') setInputContextMenu(null); }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [inputContextMenu]);

  function openInputContextMenu(event: ReactMouseEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    event.stopPropagation();
    setInputContextMenu({ x: Math.min(event.clientX, Math.max(8, window.innerWidth - 208)), y: Math.min(event.clientY, Math.max(8, window.innerHeight - 184)) });
  }

  function updateSelection(cut = false) {
    const input = promptInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const selected = question.slice(start, end);
    if (selected) void navigator.clipboard?.writeText(selected);
    if (cut && selected) {
      onQuestionChange(`${question.slice(0, start)}${question.slice(end)}`);
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start, start); });
    }
    setInputContextMenu(null);
  }

  async function pasteSelection() {
    const input = promptInputRef.current;
    if (!input) return;
    try {
      const clipboardText = await navigator.clipboard?.readText();
      if (typeof clipboardText !== 'string') return;
      const start = input.selectionStart ?? question.length;
      const end = input.selectionEnd ?? start;
      onQuestionChange(`${question.slice(0, start)}${clipboardText}${question.slice(end)}`);
      requestAnimationFrame(() => { input.focus(); const cursor = start + clipboardText.length; input.setSelectionRange(cursor, cursor); });
    } finally {
      setInputContextMenu(null);
    }
  }

  return (
    <>
      <div className="ai-input-card">
        <div className="ai-attachment-strip" data-empty={attachments.length ? undefined : 'true'}>
          {attachments.map((attachment, index) => (
            <span className="ai-attach-chip" key={`${attachment}-${index}`}>
              <span>{attachment}</span>
              <button type="button" aria-label={t('ai.attachment.remove')} onClick={() => onRemoveAttachment(index)}>×</button>
            </span>
          ))}
        </div>
        <label className="ai-prompt-field ai-companion-question">
          <span className="ai-question-label">{t('ai.question')}</span>
          <span className="ai-prompt-shell">
            <span className="ai-command-input-row">
              {selectedCommand ? <button className="ai-command-token" type="button" onClick={onRemoveCommand} aria-label={t('ai.command.remove')}>/{selectedCommand.label}<b>×</b></button> : null}
            <textarea className="ai-question-input" ref={promptInputRef} value={question} onChange={(event) => onQuestionChange(event.target.value)} onContextMenu={openInputContextMenu} onFocus={() => { if (!selectedCommand && slashCommandsEnabled && question.trim().startsWith('/')) onOpenSlashMenu(); }} onKeyDown={onPromptKeyDown} rows={2} placeholder={selectedCommand ? t('ai.command.followupPlaceholder') : t('ai.questionPlaceholder')} aria-controls={slashMenuOpen ? 'ai-slash-menu' : undefined} aria-activedescendant={slashMenuOpen && activeSlashCommand ? `ai-slash-${activeSlashCommand.id}` : undefined} />
            </span>
            {slashMenuOpen ? (
              <div className="ai-slash-menu floating-card-stack" id="ai-slash-menu" role="listbox" aria-label={t('ai.command.menu')}>
                {filteredSlashCommands.length ? filteredSlashCommands.map((command, index) => (
                  <button id={`ai-slash-${command.id}`} type="button" role="option" aria-selected={index === activeSlashIndex} className={`slash-command-card ${index === activeSlashIndex ? 'active' : ''}`} key={command.id} title={t('ai.command.detailHint')} onContextMenu={(event) => onOpenSlashCommandDetail(event, command)} onMouseEnter={() => onSetActiveSlashIndex(index)} onClick={() => onSelectSlashCommand(command)}>
                    <strong>/{command.label}</strong><em>{command.prompt}</em>{renderSlashCommandPreview(command)}
                  </button>
                )) : <p>{t('ai.command.empty')}</p>}
                {slashDetail}
              </div>
            ) : null}
          </span>
        </label>
      </div>
      {inputContextMenu && typeof document !== 'undefined' ? createPortal(
        <menu ref={inputContextMenuRef} className="ai-input-context-menu" style={{ left: inputContextMenu.x, top: inputContextMenu.y }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { promptInputRef.current?.select(); promptInputRef.current?.focus(); setInputContextMenu(null); }}><BookMindIcon name="toc" /><span>{t('ai.inputMenu.selectAll')}</span></button>
          <button type="button" onClick={() => updateSelection()}><BookMindIcon name="aiMessageCopy" /><span>{t('ai.inputMenu.copy')}</span></button>
          <button type="button" onClick={() => updateSelection(true)}><BookMindIcon name="note" /><span>{t('ai.inputMenu.cut')}</span></button>
          <button type="button" onClick={() => { void pasteSelection(); }}><BookMindIcon name="aiMessageExport" /><span>{t('ai.inputMenu.paste')}</span></button>
        </menu>
      , document.body) : null}
      {promptModifiers.length ? <div className="ai-modifier-row" aria-label="Prompt modifiers">{promptModifiers.map((modifier) => <span key={modifier}>{modifier}</span>)}</div> : null}
    </>
  );
}

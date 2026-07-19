import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useI18n } from '../i18n';
import type { ExtendedSettings } from '../services/settingsCenterService';
import type { AppCommand, CommandId } from './commandRegistry';
import { formatShortcut } from './platform';

type CommandPaletteProps = {
  commands: AppCommand[];
  open: boolean;
  commandPaletteShortcut: string;
  commandPaletteShowDescriptions: boolean;
  commandPaletteSortMode: ExtendedSettings['commandPaletteSortMode'];
  recentCommandIds: CommandId[];
  onClose: () => void;
  onRun: (id: CommandId) => void;
};

export function CommandPalette({ commands, open, commandPaletteShortcut, commandPaletteShowDescriptions, commandPaletteSortMode, recentCommandIds, onClose, onRun }: CommandPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matched = normalized ? commands.filter((command) => {
      const haystack = `${command.label} ${command.description} ${command.category} ${command.shortcut ?? ''}`.toLowerCase();
      return haystack.includes(normalized);
    }) : commands;
    if (commandPaletteSortMode !== 'recent') return matched;
    const recentRank = new Map(recentCommandIds.map((id, index) => [id, index]));
    return matched
      .map((command, index) => ({ command, index }))
      .sort((left, right) => {
        const leftRank = recentRank.get(left.command.id);
        const rightRank = recentRank.get(right.command.id);
        if (leftRank === undefined && rightRank === undefined) return left.index - right.index;
        if (leftRank === undefined) return 1;
        if (rightRank === undefined) return -1;
        return leftRank - rightRank;
      })
      .map((item) => item.command);
  }, [commands, commandPaletteSortMode, query, recentCommandIds]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function runActive() {
    const command = filtered[activeIndex];
    if (!command) return;
    executeCommand(command);
  }

  function executeCommand(command: AppCommand) {
    onClose();
    onRun(command.id);
  }

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(filtered.length - 1, index + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runActive();
    }
  }

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={t('commandPalette.aria')} onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search">
          <span>{commandPaletteShortcut === 'disabled' ? '按钮打开' : formatShortcut(commandPaletteShortcut)}</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder={t('commandPalette.placeholder')} />
        </div>
        <div className="command-list" role="listbox" aria-label={t('commandPalette.listAria')}>
          {filtered.map((command, index) => (
            <button
              className={index === activeIndex ? 'command-item active' : 'command-item'}
              key={command.id}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => executeCommand(command)}
            >
              <span className="command-category">{command.category}</span>
              <span className="command-copy">
                <strong>{command.label}</strong>
                {commandPaletteShowDescriptions ? <em>{command.description}</em> : null}
              </span>
              {command.shortcut ? <kbd>{formatShortcut(command.shortcut)}</kbd> : null}
            </button>
          ))}
          {filtered.length === 0 ? <p className="empty-hint">{t('commandPalette.empty')}</p> : null}
        </div>
      </section>
    </div>
  );
}

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import type { TranslationSourcePickerOption } from '../settings-center/settingsCenterTranslationModel';

type ReaderTranslationSourcePickerProps = {
  label: string;
  searchPlaceholder: string;
  emptyLabel: string;
  unavailableLabel: string;
  value: string;
  options: TranslationSourcePickerOption[];
  onChange: (sourceId: string) => void;
};

export function ReaderTranslationSourcePicker({
  label,
  searchPlaceholder,
  emptyLabel,
  unavailableLabel,
  value,
  options,
  onChange,
}: ReaderTranslationSourcePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const selected = options.find((option) => option.id === value) ?? options[0];
  const groups = useMemo(() => groupTranslationSourceOptions(options, query), [options, query]);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setExpandedGroupIds((current) => current.has(selected.groupId) ? current : new Set([...current, selected.groupId]));
  }, [selected]);

  function choose(sourceId: string) {
    onChange(sourceId);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function getOptionButtons() {
    return [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-source-option="true"]') ?? [])];
  }

  function focusOption(edge: 'first' | 'last') {
    requestAnimationFrame(() => {
      const buttons = getOptionButtons();
      buttons[edge === 'first' ? 0 : buttons.length - 1]?.focus();
    });
  }

  function moveOptionFocus(current: HTMLButtonElement, direction: -1 | 1 | 'first' | 'last') {
    const buttons = getOptionButtons();
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(current);
    const nextIndex = direction === 'first'
      ? 0
      : direction === 'last'
        ? buttons.length - 1
        : (Math.max(0, currentIndex) + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!options.length) return;
    setOpen(true);
    focusOption(event.key === 'ArrowDown' ? 'first' : 'last');
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    focusOption(event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first');
  }

  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, sourceId: string) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveOptionFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      moveOptionFocus(event.currentTarget, event.key === 'Home' ? 'first' : 'last');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(sourceId);
    }
  }

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className={`reader-translation-source-picker${open ? ' open' : ''}`} ref={rootRef}>
      <span className="reader-translation-source-picker-label">{label}</span>
      <button
        ref={triggerRef}
        className="reader-translation-source-picker-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={!options.length}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <BookMindIcon name="translate" />
        <span>{selected?.label ?? emptyLabel}</span>
        <i aria-hidden="true">⌃</i>
      </button>
      {open ? (
        <div className="reader-translation-source-menu" id={menuId} role="dialog" aria-label={label}>
          <div className="reader-translation-source-search">
            <BookMindIcon name="search" />
            <input value={query} placeholder={searchPlaceholder} aria-label={searchPlaceholder} autoFocus onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKeyDown} />
          </div>
          <div className="reader-translation-source-groups">
            {groups.length ? groups.map((group) => {
              const expanded = Boolean(query.trim()) || expandedGroupIds.has(group.id);
              return (
                <section className="reader-translation-source-group" key={group.id} role="group" aria-label={group.label}>
                  <button type="button" className="reader-translation-source-group-toggle" aria-expanded={expanded} onClick={() => toggleGroup(group.id)}>
                    <span>{group.label}</span>
                    <b>{group.options.length}</b>
                    <i aria-hidden="true">{expanded ? '−' : '+'}</i>
                  </button>
                  {expanded ? <div className="reader-translation-source-options">
                    {group.options.map((option) => (
                      <button
                        type="button"
                        data-source-option="true"
                        aria-pressed={option.id === value}
                        className={`${option.id === value ? 'selected' : ''}${option.available ? '' : ' unavailable'}`}
                        key={option.id}
                        onClick={() => choose(option.id)}
                        onKeyDown={(event) => onOptionKeyDown(event, option.id)}
                      >
                        <span>{option.label}</span>
                        {!option.available ? <em>{unavailableLabel}</em> : null}
                        {option.id === value ? <strong>✓</strong> : null}
                      </button>
                    ))}
                  </div> : null}
                </section>
              );
            }) : <p className="reader-translation-source-empty">{emptyLabel}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function groupTranslationSourceOptions(options: TranslationSourcePickerOption[], query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = new Map<string, { id: string; label: string; options: TranslationSourcePickerOption[] }>();
  options.forEach((option) => {
    if (normalizedQuery && !`${option.groupLabel} ${option.label}`.toLocaleLowerCase().includes(normalizedQuery)) return;
    const group = groups.get(option.groupId) ?? { id: option.groupId, label: option.groupLabel, options: [] };
    group.options.push(option);
    groups.set(option.groupId, group);
  });
  return [...groups.values()];
}

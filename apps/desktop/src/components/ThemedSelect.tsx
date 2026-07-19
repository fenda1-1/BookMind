import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export type ThemedSelectOption<T extends string> = {
  value: T;
  label: string;
};

export type ThemedSelectProps<T extends string> = {
  label: string;
  value: T;
  options: ThemedSelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
  menuPlacement?: 'bottom' | 'top';
  disabled?: boolean;
};

export function ThemedSelect<T extends string>({ label, value, options, onChange, className = '', ariaLabel, menuPlacement = 'top', disabled = false }: ThemedSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const typeaheadBufferRef = useRef('');
  const typeaheadTimerRef = useRef<number | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedOption?.value));
  const activeOptionId = optionId(activeIndex);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('click', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
      if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  function optionId(index: number) {
    return `${listboxId}-option-${index}`;
  }

  function choose(nextValue: T) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function clampIndex(index: number) {
    if (!options.length) return 0;
    return Math.min(Math.max(index, 0), options.length - 1);
  }

  function moveActive(delta: number) {
    setActiveIndex((current) => clampIndex(current + delta));
  }

  function openAt(index: number) {
    if (disabled || !options.length) return;
    setActiveIndex(clampIndex(index));
    setOpen(true);
  }

  function searchByCharacter(character: string) {
    typeaheadBufferRef.current += character.toLocaleLowerCase();
    if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadBufferRef.current = '';
      typeaheadTimerRef.current = null;
    }, 700);
    const query = typeaheadBufferRef.current;
    const start = open ? activeIndex + 1 : selectedIndex + 1;
    const orderedOptions = [...options.slice(start), ...options.slice(0, start)];
    const match = orderedOptions.find((option) => option.label.toLocaleLowerCase().startsWith(query));
    if (!match) return;
    openAt(options.indexOf(match));
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) openAt(selectedIndex);
      else moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openAt(selectedIndex);
      else moveActive(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      openAt(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      openAt(options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(options[activeIndex]?.value ?? value);
      else openAt(selectedIndex);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      searchByCharacter(event.key);
    }
  }

  return (
    <div className={`themed-select menu-${menuPlacement} ${className}${open ? ' open' : ''}${disabled ? ' disabled' : ''}`} ref={rootRef}>
      <span className="themed-select-label">{label}</span>
      <button
        ref={triggerRef}
        className="themed-select-trigger"
        type="button"
        aria-label={ariaLabel ?? label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? activeOptionId : undefined}
        disabled={disabled || !options.length}
        onClick={(event) => { event.stopPropagation(); if (!disabled && options.length) setOpen((current) => !current); }}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selectedOption?.label}</span>
        <i aria-hidden="true">{menuPlacement === 'top' ? '⌃' : '⌄'}</i>
      </button>
      {open ? (
        <div className="themed-select-menu" role="listbox" id={listboxId} aria-label={ariaLabel ?? label}>
          {options.map((option, index) => (
            <button
              id={optionId(index)}
              className={`${option.value === value ? 'selected' : ''}${index === activeIndex ? ' active' : ''}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={index === activeIndex ? 0 : -1}
              key={option.value}
              onClick={(event) => { event.stopPropagation(); choose(option.value); }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span>{option.label}</span>
              {option.value === value ? <strong>✓</strong> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

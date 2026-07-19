import { Children, Fragment, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode, type Ref } from 'react';
import { BookMindIcon } from '../components/BookMindIcon';
import { matchesSettingsSearchText } from '../features/settings-center/settingsCenterModel';
import { useI18n } from '../i18n';

type SettingsSearchContextValue = {
  normalizedQuery: string;
  sectionMatches: boolean;
  path: string[];
};

type SettingsSearchableProps = {
  title?: unknown;
  description?: unknown;
  valueText?: unknown;
  label?: unknown;
  searchText?: unknown;
  searchValues?: unknown;
  options?: unknown;
  children?: ReactNode;
};

type SettingsLayoutContextValue = {
  maxColumnCount: number;
};

export const SettingsSearchContext = createContext<SettingsSearchContextValue>({ normalizedQuery: '', sectionMatches: false, path: [] });
export const SettingsLayoutContext = createContext<SettingsLayoutContextValue>({ maxColumnCount: 3 });

export function SettingsSection({ title, description, children, id, className = '', refNode, advanced = false, forceOpen = false }: { title: string; description: string; children: ReactNode; id?: string; className?: string; refNode?: Ref<HTMLElement>; advanced?: boolean; forceOpen?: boolean }) {
  const search = useContext(SettingsSearchContext);
  const { t } = useI18n();
  const sectionId = id ?? `settings-section-${slugifySettingsAnchor(title)}`;
  const sectionMatches = matchesSettingsSearchText(search.normalizedQuery, [title, description]);
  const effectiveSectionMatches = search.sectionMatches || sectionMatches;
  const childMatches = settingsSearchNodeMatches(children, search.normalizedQuery);
  const searchHidden = Boolean(search.normalizedQuery && !effectiveSectionMatches && !childMatches);
  const searchClassName = search.normalizedQuery && (effectiveSectionMatches || childMatches) ? ' settings-search-section-match' : '';
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const contentHidden = advanced && !advancedOpen && !forceOpen && !search.normalizedQuery;
  const sectionPath = useMemo(() => [...search.path, title], [search.path, title]);
  const controlListRef = useRef<HTMLDivElement>(null);
  const layout = useContext(SettingsLayoutContext);
  const measuredColumnCount = useSettingsControlColumnCount(controlListRef, !search.normalizedQuery);
  const columnCount = Math.min(measuredColumnCount, layout.maxColumnCount);
  return (
    <SettingsSearchContext.Provider value={{ normalizedQuery: search.normalizedQuery, sectionMatches: effectiveSectionMatches, path: sectionPath }}>
      <section ref={refNode} id={sectionId} data-settings-section-title={title} data-settings-section-description={description} data-settings-advanced={advanced || undefined} className={`settings-section-card ${advanced ? 'advanced' : ''} ${className}${searchClassName}`} hidden={searchHidden}>
        <div className="settings-section-head">
          <div>
            <h3>{highlightSettingsSearchText(title, search.normalizedQuery)}</h3>
            <p>{highlightSettingsSearchText(description, search.normalizedQuery)}</p>
          </div>
          {advanced ? (
            <button className="settings-section-toggle" type="button" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen || forceOpen || Boolean(search.normalizedQuery)} aria-controls={`${sectionId}-controls`}>
              {advancedOpen || forceOpen || search.normalizedQuery ? t('settings.scaffold.collapseAdvanced') : t('settings.scaffold.expandAdvanced')}
            </button>
          ) : null}
        </div>
        <div ref={controlListRef} id={`${sectionId}-controls`} className="settings-control-list" style={{ '--settings-control-column-count': columnCount } as CSSProperties} hidden={contentHidden}>{renderSettingsControlFlow(children, columnCount)}</div>
      </section>
    </SettingsSearchContext.Provider>
  );
}

function useSettingsControlColumnCount(refNode: { current: HTMLElement | null }, enabled: boolean) {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    if (!enabled) return;
    const element = refNode.current;
    if (!element) return;

    function updateColumnCount(width: number) {
      let nextColumnCount = 1;
      if (width >= 840) nextColumnCount = 3;
      else if (width >= 560) nextColumnCount = 2;
      setColumnCount((current) => current === nextColumnCount ? current : nextColumnCount);
    }

    updateColumnCount(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateColumnCount(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, refNode]);

  return columnCount;
}

function renderSettingsControlFlow(children: ReactNode, columnCount: number) {
  const groups: ReactNode[] = [];
  let columns: ReactNode[][] = Array.from({ length: columnCount }, () => []);
  let flowIndex = 0;

  function flushColumns() {
    if (!columns.some((column) => column.length)) return;
    groups.push(
      <div className="settings-control-columns" key={`columns-${groups.length}`}>
        {columns.map((column, index) => (
          <div className="settings-control-column" key={`column-${index}`}>{column}</div>
        ))}
      </div>,
    );
    columns = Array.from({ length: columnCount }, () => []);
  }

  flattenSettingsControlChildren(children).forEach((child) => {
    if (settingsControlSpansAllColumns(child) && isValidElement<SettingsSearchableProps & { className?: unknown }>(child) && child.type !== Fragment) {
      flushColumns();
      const className = typeof child.props.className === 'string' ? child.props.className : '';
      groups.push(cloneElement(child, { className: `${className} settings-control-span-all`.trim() }));
      return;
    }

    columns[flowIndex % columnCount].push(child);
    flowIndex += 1;
  });

  flushColumns();
  return groups;
}

function flattenSettingsControlChildren(children: ReactNode): ReactNode[] {
  const flattened: ReactNode[] = [];
  Children.toArray(children).forEach((child) => {
    if (isValidElement<SettingsSearchableProps>(child) && child.type === Fragment) {
      flattened.push(...flattenSettingsControlChildren(child.props.children));
      return;
    }
    flattened.push(child);
  });
  return flattened;
}

function settingsControlSpansAllColumns(node: ReactNode): boolean {
  const spanningClassNames = [
    'settings-key-storage-status',
    'settings-ai-model-list',
    'settings-custom-command-form',
    'cloud-ai-redaction-preview',
  ];
  return settingsNodeHasAnyClassName(node, spanningClassNames);
}

function settingsNodeHasAnyClassName(node: ReactNode, classNames: string[]): boolean {
  if (!node || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return false;
  if (Array.isArray(node)) return node.some((child) => settingsNodeHasAnyClassName(child, classNames));
  if (!isValidElement<SettingsSearchableProps & { className?: unknown }>(node)) return false;

  const props = node.props;
  const className = typeof props.className === 'string' ? props.className : '';
  if (classNames.some((value) => className.split(/\s+/).includes(value))) return true;
  return Children.toArray(props.children).some((child) => settingsNodeHasAnyClassName(child, classNames));
}

export function SettingControl({ title, description, valueText, children, className = '', refNode }: { title: string; description: string; valueText?: string | number; children: ReactNode; className?: string; refNode?: Ref<HTMLElement> }) {
  const search = useContext(SettingsSearchContext);
  const controlMatches = matchesSettingsSearchText(search.normalizedQuery, [title, description, valueText]) || settingsSearchNodeMatches(children, search.normalizedQuery);
  const searchHidden = Boolean(search.normalizedQuery && !controlMatches);
  if (searchHidden) {
    return <article ref={refNode} className={`settings-control-row${className ? ` ${className}` : ''}`} hidden />;
  }
  return <VisibleSettingControl title={title} description={description} valueText={valueText} className={className} refNode={refNode} normalizedQuery={search.normalizedQuery}>{children}</VisibleSettingControl>;
}

function VisibleSettingControl({ title, description, valueText, children, className, refNode, normalizedQuery }: { title: string; description: string; valueText?: string | number; children: ReactNode; className: string; refNode?: Ref<HTMLElement>; normalizedQuery: string }) {
  const { t } = useI18n();
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const descriptionId = useId();
  const openDuringSearch = Boolean(normalizedQuery);
  const showDescription = descriptionOpen || openDuringSearch;
  const helpLabel = showDescription ? t('settings.scaffold.collapseDescription') : t('settings.scaffold.expandDescription');
  return (
    <article ref={refNode} className={`settings-control-row${openDuringSearch ? ' search-open' : ''}${className ? ` ${className}` : ''}`}>
      <div className="settings-control-main">
        <div className="settings-control-head">
          <span className="settings-control-title">
            <h4>{highlightSettingsSearchText(title, normalizedQuery)}</h4>
            {valueText !== undefined ? <em>{highlightSettingsSearchText(String(valueText), normalizedQuery)}</em> : null}
          </span>
          <button className="settings-control-help-button" type="button" onClick={() => setDescriptionOpen((value) => !value)} aria-expanded={showDescription} aria-controls={descriptionId} aria-label={helpLabel} title={helpLabel}>
            <BookMindIcon name="settingsHelp" />
          </button>
        </div>
      </div>
      <div className="settings-control-field">{highlightSettingsSearchNode(children, normalizedQuery)}</div>
      {showDescription ? <p id={descriptionId} className="settings-control-desc">{highlightSettingsSearchText(description, normalizedQuery)}</p> : null}
    </article>
  );
}

export function ReadonlyPill({ text }: { text: string }) {
  const search = useContext(SettingsSearchContext);
  return <span className="settings-readonly-pill">{highlightSettingsSearchText(text, search.normalizedQuery)}</span>;
}

export function SettingsNumberInput({
  value,
  min,
  max,
  step,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: string | number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitDraft() {
    const normalizedValue = normalizeSettingsNumberDraft(draft, String(value), { min, max, step });
    setDraft(normalizedValue);
    onCommit(normalizedValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commitDraft();
    }
  }

  return (
    <input
      className="settings-number-input"
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={handleKeyDown}
    />
  );
}

export function SettingsTextInput({
  value,
  placeholder,
  ariaLabel,
  type = 'text',
  disabled,
  readOnly,
  ariaInvalid,
  commitOnUnmount = false,
  className = 'settings-inline-input',
  onCommit,
}: {
  value: string | number;
  placeholder?: string;
  ariaLabel?: string;
  type?: 'text' | 'password' | 'search' | 'url';
  disabled?: boolean;
  readOnly?: boolean;
  ariaInvalid?: boolean;
  commitOnUnmount?: boolean;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const draftRef = useRef(String(value));
  const committedRef = useRef(String(value));
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    setDraft(String(value));
    draftRef.current = String(value);
    committedRef.current = String(value);
  }, [value]);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => () => {
    if (commitOnUnmount && draftRef.current !== committedRef.current) {
      committedRef.current = draftRef.current;
      onCommitRef.current(draftRef.current);
    }
  }, [commitOnUnmount]);

  function commitDraft() {
    if (draft === committedRef.current) return;
    committedRef.current = draft;
    onCommit(draft);
  }

  function handleTextInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commitDraft();
    }
  }

  return (
    <input
      className={className}
      type={type}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={ariaInvalid || undefined}
      aria-label={ariaLabel}
      onChange={(event) => {
        draftRef.current = event.target.value;
        setDraft(event.target.value);
      }}
      onBlur={commitDraft}
      onKeyDown={handleTextInputKeyDown}
    />
  );
}

export function SettingsTextarea({
  value,
  placeholder,
  ariaLabel,
  rows,
  compact = false,
  readOnly,
  disabled,
  className,
  onCommit,
}: {
  value: string | number;
  placeholder?: string;
  ariaLabel?: string;
  rows?: number;
  compact?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitDraft() {
    onCommit(draft);
  }

  return (
    <textarea
      className={className ?? `settings-textarea${compact ? ' compact' : ''}`}
      value={draft}
      placeholder={placeholder}
      rows={rows}
      readOnly={readOnly}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
    />
  );
}

function normalizeSettingsNumberDraft(value: string, fallback: string, bounds: { min?: number; max?: number; step?: number }) {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return fallback;
  const minBounded = typeof bounds.min === 'number' ? Math.max(bounds.min, parsed) : parsed;
  const bounded = typeof bounds.max === 'number' ? Math.min(bounds.max, minBounded) : minBounded;
  const integerStep = bounds.step === undefined || Number.isInteger(bounds.step);
  return String(integerStep ? Math.round(bounded) : bounded);
}

export function settingsSearchNodeMatches(node: ReactNode, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  if (typeof node === 'string' || typeof node === 'number') return matchesSettingsSearchText(normalizedQuery, [node]);
  if (!node || typeof node === 'boolean') return false;
  if (Array.isArray(node)) return node.some((child) => settingsSearchNodeMatches(child, normalizedQuery));
  if (!isValidElement<SettingsSearchableProps>(node)) return false;

  const props = node.props;
  if (matchesSettingsSearchText(normalizedQuery, [
    props.title,
    props.description,
    props.valueText,
    props.label,
    props.searchText,
    props.searchValues,
    ...getSettingsSearchOptionValues(props.options),
    typeof props.children === 'string' || typeof props.children === 'number' ? props.children : undefined,
  ])) return true;

  return Children.toArray(props.children).some((child) => settingsSearchNodeMatches(child, normalizedQuery));
}

export function highlightSettingsSearchText(value: string, normalizedQuery: string): ReactNode {
  if (!normalizedQuery) return value;
  const matchRange = findSettingsSearchMatchRange(value, normalizedQuery);
  if (!matchRange) return value;
  const before = value.slice(0, matchRange.start);
  const matched = value.slice(matchRange.start, matchRange.end);
  const after = value.slice(matchRange.end);
  return (
    <>
      {before}
      <mark className="settings-search-highlight">{matched}</mark>
      {after}
    </>
  );
}

function getSettingsSearchOptionValues(options: unknown): unknown[] {
  if (!Array.isArray(options)) return [];
  return options.flatMap((option) => {
    if (!option || typeof option !== 'object') return [];
    const item = option as { label?: unknown; value?: unknown };
    return [item.label, item.value];
  });
}

function findSettingsSearchMatchRange(value: string, normalizedQuery: string) {
  let normalizedValue = '';
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];
  let sourceOffset = 0;

  for (const character of value) {
    const normalizedCharacter = character.toLowerCase().normalize('NFKC');
    const characterEnd = sourceOffset + character.length;
    normalizedValue += normalizedCharacter;
    for (let index = 0; index < normalizedCharacter.length; index += 1) {
      sourceStarts.push(sourceOffset);
      sourceEnds.push(characterEnd);
    }
    sourceOffset = characterEnd;
  }

  const matchIndex = normalizedValue.indexOf(normalizedQuery);
  if (matchIndex < 0) return null;
  const matchEndIndex = matchIndex + normalizedQuery.length - 1;
  return {
    start: sourceStarts[matchIndex] ?? 0,
    end: sourceEnds[matchEndIndex] ?? value.length,
  };
}

export function highlightSettingsSearchNode(node: ReactNode, normalizedQuery: string): ReactNode {
  if (!normalizedQuery) return node;
  if (typeof node === 'string') return highlightSettingsSearchText(node, normalizedQuery);
  if (typeof node === 'number') return highlightSettingsSearchText(String(node), normalizedQuery);
  if (!node || typeof node === 'boolean') return node;
  if (Array.isArray(node)) {
    return node.map((child, index) => <Fragment key={index}>{highlightSettingsSearchNode(child, normalizedQuery)}</Fragment>);
  }
  if (!isValidElement<SettingsSearchableProps>(node)) return node;

  const children = node.props.children;
  if (children === undefined) return node;
  if (node.type === Fragment) {
    return cloneElement(node, undefined, highlightSettingsSearchNode(children, normalizedQuery));
  }
  if (typeof node.type !== 'string' || shouldSkipSettingsSearchHighlightElement(node.type)) return node;
  return cloneElement(node as ReactElement<{ children?: ReactNode }>, undefined, highlightSettingsSearchNode(children, normalizedQuery));
}

function shouldSkipSettingsSearchHighlightElement(type: string) {
  return type === 'input' || type === 'textarea' || type === 'select' || type === 'option' || type === 'script' || type === 'style';
}

export function slugifySettingsAnchor(value: string) {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  return Array.from(value.trim())
    .map((char) => char.codePointAt(0)?.toString(36) ?? '')
    .filter(Boolean)
    .join('-') || 'section';
}

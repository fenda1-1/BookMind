import { Children, isValidElement, startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react';
import { BookMindIcon } from '../components/BookMindIcon';
import { normalizeSettingsSearchText, type SettingsGroup, type SettingsGroupId } from '../features/settings-center/settingsCenterModel';
import type { Translator } from '../i18n';
import { SettingsLayoutContext, SettingsSearchContext, settingsSearchNodeMatches } from './SettingsPageScaffold';
import { saveSettingsPageMemory } from './useSettingsPageState';

type RenderedSettingsGroup = {
  group: SettingsGroup;
  content: ReactNode;
  groupMatchesSearch: boolean;
};

type SettingsSectionNavItem = {
  id: string;
  title: string;
  advanced: boolean;
};

type SettingsSummaryItem = {
  label: string;
  value: string;
};

type SettingsPageShellProps = {
  activeGroup: SettingsGroupId;
  activeSettingsGroup?: SettingsGroup;
  displaySettingsQuery: string;
  normalizedSettingsQuery: string;
  onSettingsGroupNavKeyDown: (event: KeyboardEvent<HTMLButtonElement>, groupId: SettingsGroupId) => void;
  renderedSettingsGroups: RenderedSettingsGroup[];
  restoreGroupDefaults: (groupId: SettingsGroupId) => void | Promise<void>;
  settingsGroups: SettingsGroup[];
  setActiveGroup: (groupId: SettingsGroupId) => void;
  setSettingsQuery: (query: string) => void;
  settingsQuery: string;
  t: Translator;
};

export function SettingsPageShell({
  activeGroup,
  activeSettingsGroup,
  displaySettingsQuery,
  normalizedSettingsQuery,
  onSettingsGroupNavKeyDown,
  renderedSettingsGroups,
  restoreGroupDefaults,
  settingsGroups,
  setActiveGroup,
  setSettingsQuery,
  settingsQuery,
  t,
}: SettingsPageShellProps) {
  const [settingsSidebarCollapsed, setSettingsSidebarCollapsed] = useState(false);
  const [settingsSidebarWidth, setSettingsSidebarWidth] = useState(264);
  const [settingsPageFilterQuery, setSettingsPageFilterQuery] = useState(() => settingsQuery.trim() ? '' : loadRememberedSettingsPageFilterQuery());
  const [globalSettingsMaxColumnCount, setGlobalSettingsMaxColumnCount] = useState(3);
  const [settingsMaxColumnScopeAll, setSettingsMaxColumnScopeAll] = useState(true);
  const [groupSettingsMaxColumnCounts, setGroupSettingsMaxColumnCounts] = useState<Partial<Record<SettingsGroupId, number>>>({});
  const settingsContentRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoreFrameRef = useRef<number | null>(null);
  const previousGroupRef = useRef(activeGroup);
  const normalizedPageFilterQuery = normalizeSettingsSearchText(settingsPageFilterQuery);
  const effectiveSettingsQuery = normalizedSettingsQuery || normalizedPageFilterQuery;
  const settingsMaxColumnCount = settingsMaxColumnScopeAll ? globalSettingsMaxColumnCount : groupSettingsMaxColumnCounts[activeGroup] ?? globalSettingsMaxColumnCount;
  const pageFilteredRenderedSettingsGroups = renderedSettingsGroups;
  const shellStyle = useMemo(() => ({ '--settings-sidebar-width': `${settingsSidebarWidth}px` }) as CSSProperties, [settingsSidebarWidth]);
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);

  function updateSettingsMaxColumnCount(value: string) {
    const nextValue = Math.min(3, Math.max(1, Number(value) || 3));
    if (settingsMaxColumnScopeAll) {
      setGlobalSettingsMaxColumnCount(nextValue);
      return;
    }
    setGroupSettingsMaxColumnCounts((current) => ({ ...current, [activeGroup]: nextValue }));
  }

  function updateSettingsMaxColumnScopeAll(checked: boolean) {
    setSettingsMaxColumnScopeAll(checked);
    if (checked) setGlobalSettingsMaxColumnCount(settingsMaxColumnCount);
  }

  function rememberSettingsGroupScroll(groupId = activeGroup) {
    const content = settingsContentRef.current;
    if (!content || effectiveSettingsQuery) return;
    saveSettingsPageMemory({ scrollTopByGroup: { [groupId]: Math.max(0, Math.round(content.scrollTop)) } });
  }

  function selectSettingsGroup(groupId: SettingsGroupId) {
    rememberSettingsGroupScroll();
    saveSettingsPageMemory({ activeGroup: groupId, settingsQuery: '', pageFilterQuery: '' });
    setActiveGroup(groupId);
    setSettingsQuery('');
    setSettingsPageFilterQuery('');
  }

  function updateSettingsSearchQuery(query: string) {
    setSettingsPageFilterQuery('');
    setSettingsQuery(query);
  }

  function updateSettingsPageFilterQuery(query: string) {
    setSettingsQuery('');
    setSettingsPageFilterQuery(query);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => saveSettingsPageMemory({ settingsQuery }), 120);
    return () => window.clearTimeout(timer);
  }, [settingsQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveSettingsPageMemory({ pageFilterQuery: settingsPageFilterQuery }), 120);
    return () => window.clearTimeout(timer);
  }, [settingsPageFilterQuery]);

  useEffect(() => {
    if (previousGroupRef.current !== activeGroup) {
      rememberSettingsGroupScroll(previousGroupRef.current);
      previousGroupRef.current = activeGroup;
    }
    if (effectiveSettingsQuery) return;
    if (scrollRestoreFrameRef.current !== null) window.cancelAnimationFrame(scrollRestoreFrameRef.current);
    scrollRestoreFrameRef.current = window.requestAnimationFrame(() => {
      scrollRestoreFrameRef.current = null;
      try {
        const raw = window.localStorage.getItem('bookmind:settings-page-memory:v1');
        const memory = JSON.parse(raw ?? '{}') as { scrollTopByGroup?: Partial<Record<SettingsGroupId, number>> };
        settingsContentRef.current?.scrollTo({ top: Math.max(0, Number(memory.scrollTopByGroup?.[activeGroup] ?? 0)), behavior: 'auto' });
      } catch {
        settingsContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
    return () => {
      if (scrollRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollRestoreFrameRef.current);
        scrollRestoreFrameRef.current = null;
      }
    };
  }, [activeGroup, effectiveSettingsQuery]);

  function beginSettingsSidebarResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    setSettingsSidebarCollapsed(false);
    const startX = event.clientX;
    const startWidth = settingsSidebarWidth;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const nextWidth = Math.min(420, Math.max(204, startWidth + moveEvent.clientX - startX));
      setSettingsSidebarWidth(nextWidth);
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  return (
    <SettingsSearchContext.Provider value={{ normalizedQuery: effectiveSettingsQuery, sectionMatches: false, path: [] }}>
      <SettingsLayoutContext.Provider value={{ maxColumnCount: settingsMaxColumnCount }}>
      <section className={`page-surface settings-page settings-center-shell${settingsSidebarCollapsed ? ' sidebar-collapsed' : ''}${effectiveSettingsQuery ? ' search-active' : ''}`} style={shellStyle}>
        <aside className="settings-sidebar" aria-label={tr('settings.shell.sidebarAria')} aria-expanded={!settingsSidebarCollapsed}>
          <div className="settings-sidebar-head">
            <BookMindIcon name="settings" className="bm-icon settings-sidebar-head-icon" />
            <strong>{tr('settings.shell.title')}</strong>
            <button className="settings-sidebar-toggle" type="button" aria-label={settingsSidebarCollapsed ? tr('settings.shell.expandSidebar') : tr('settings.shell.collapseSidebar')} aria-expanded={!settingsSidebarCollapsed} onClick={() => setSettingsSidebarCollapsed((value) => !value)}>
              {settingsSidebarCollapsed ? '›' : '‹'}
            </button>
          </div>
          <div className="settings-search-box">
            <DeferredSettingsSearchInput className="settings-search-input" value={settingsQuery} onValueChange={updateSettingsSearchQuery} placeholder={tr('settings.shell.searchPlaceholder')} ariaLabel={tr('settings.shell.searchAria')} />
          </div>
          <nav className="settings-group-list">
            {settingsGroups.map((group) => (
              <button className={activeGroup === group.id ? 'active' : ''} type="button" key={group.id} data-settings-group={group.id} aria-current={activeGroup === group.id ? 'page' : undefined} onClick={() => selectSettingsGroup(group.id)} onKeyDown={(event) => onSettingsGroupNavKeyDown(event, group.id)}>
                <BookMindIcon name={group.icon} className="bm-icon settings-group-icon" />
                <span className="settings-group-label">
                  <strong>{group.label}</strong>
                  <small>{group.description}</small>
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <button className="settings-layout-splitter settings-sidebar-resize-grip" type="button" aria-label={tr('settings.shell.resizeSidebarAria')} onPointerDown={beginSettingsSidebarResize} />
        <div className="settings-content" ref={settingsContentRef} onScroll={() => rememberSettingsGroupScroll()}>
          <header className="settings-content-header">
            <div className="settings-content-title">
              <h2>{normalizedSettingsQuery ? tr('settings.shell.searchTitle', { query: displaySettingsQuery }) : activeSettingsGroup?.label}</h2>
              <p>{normalizedSettingsQuery ? tr('settings.shell.searchDescription') : activeSettingsGroup?.description}</p>
            </div>
            <div className="settings-layout-toolbar" aria-label={tr('settings.shell.toolbarAria')}>
               <DeferredSettingsSearchInput className="settings-page-filter-input" type="search" value={settingsPageFilterQuery} onValueChange={updateSettingsPageFilterQuery} placeholder={tr('settings.shell.pageFilterPlaceholder')} ariaLabel={tr('settings.shell.pageFilterAria')} />
              <label className="settings-toolbar-select">
                <span>{tr('settings.shell.maxColumns')}</span>
                <select className="settings-max-column-select" value={settingsMaxColumnCount} onChange={(event) => updateSettingsMaxColumnCount(event.target.value)} aria-label={tr('settings.shell.maxColumnsAria')}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              <label className="settings-scope-toggle">
                <span>{tr('settings.shell.applyToAllPages')}</span>
                <input type="checkbox" checked={settingsMaxColumnScopeAll} onChange={(event) => updateSettingsMaxColumnScopeAll(event.target.checked)} />
              </label>
            </div>
          </header>
          {pageFilteredRenderedSettingsGroups.length ? pageFilteredRenderedSettingsGroups.map(({ group, content }) => {
            const navItems = buildSettingsSectionNavItems(content);
            const summaryItems = buildSettingsSummaryItems(group, t);
            return (
            <SettingsSearchContext.Provider key={group.id} value={{ normalizedQuery: effectiveSettingsQuery, sectionMatches: false, path: [group.label] }}>
              <section className="settings-group-pane">
                {normalizedSettingsQuery ? <h3>{group.label}</h3> : null}
                {!normalizedSettingsQuery && summaryItems.length ? (
                  <div className="settings-summary-grid" aria-label={tr('settings.shell.summaryAria', { group: group.label })}>
                    {summaryItems.map((item) => (
                      <span key={item.label}>
                        <b>{item.label}</b>
                        <strong>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
                {!normalizedSettingsQuery && navItems.length > 1 ? (
                  <nav className="settings-subnav" aria-label={tr('settings.shell.subnavAria', { group: group.label })}>
                    {navItems.map((item) => (
                      <a key={item.id} href={`#${item.id}`} className={item.advanced ? 'advanced' : undefined}>{item.title}</a>
                    ))}
                  </nav>
                ) : null}
                {content}
                <footer className="settings-group-footer" hidden={Boolean(normalizedSettingsQuery)}>
                  <button className="settings-restore-link" type="button" onClick={() => { void restoreGroupDefaults(group.id); }}>{tr('settings.shell.restoreGroupDefaults')}</button>
                </footer>
              </section>
            </SettingsSearchContext.Provider>
            );
          }) : <section className="settings-section-card"><h3>{tr('settings.shell.emptyTitle')}</h3><p>{tr('settings.shell.emptyBody')}</p></section>}
        </div>
      </section>
      </SettingsLayoutContext.Provider>
    </SettingsSearchContext.Provider>
  );
}

function DeferredSettingsSearchInput({ className, type = 'text', value, placeholder, ariaLabel, onValueChange }: { className: string; type?: 'text' | 'search'; value: string; placeholder: string; ariaLabel: string; onValueChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const submitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (submitTimerRef.current !== null) window.clearTimeout(submitTimerRef.current);
  }, []);

  function updateDraft(nextValue: string) {
    setDraft(nextValue);
    if (submitTimerRef.current !== null) window.clearTimeout(submitTimerRef.current);
    submitTimerRef.current = window.setTimeout(() => {
      submitTimerRef.current = null;
      startTransition(() => onValueChange(nextValue));
    }, 100);
  }

  return <input className={className} type={type} value={draft} onChange={(event) => updateDraft(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} />;
}

function loadRememberedSettingsPageFilterQuery() {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(window.localStorage.getItem('bookmind:settings-page-memory:v1') ?? '{}') as { pageFilterQuery?: unknown };
    return typeof parsed.pageFilterQuery === 'string' ? parsed.pageFilterQuery : '';
  } catch {
    return '';
  }
}

function buildSettingsSectionNavItems(node: ReactNode): SettingsSectionNavItem[] {
  const items: SettingsSectionNavItem[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<Record<string, unknown>>;
    const title = typeof element.props.title === 'string' ? element.props.title : '';
    if (title && String(element.type).includes('SettingsSection')) {
      items.push({
        id: typeof element.props.id === 'string' ? element.props.id : `settings-section-${slugifySettingsNavId(title)}`,
        title,
        advanced: element.props.advanced === true,
      });
    }
    if (element.props.children) items.push(...buildSettingsSectionNavItems(element.props.children as ReactNode));
  });
  return dedupeSettingsSectionNavItems(items);
}

function dedupeSettingsSectionNavItems(items: SettingsSectionNavItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildSettingsSummaryItems(group: SettingsGroup, t: Translator): SettingsSummaryItem[] {
  const tr = (key: string) => t(key as never);
  if (group.id === 'ai') return [
    { label: tr('settings.shell.summary.ai.currentScope.label'), value: tr('settings.shell.summary.ai.currentScope.value') },
    { label: tr('settings.shell.summary.ai.advanced.label'), value: tr('settings.shell.summary.ai.advanced.value') },
    { label: tr('settings.shell.summary.ai.requestEntry.label'), value: tr('settings.shell.summary.ai.requestEntry.value') },
  ];
  if (group.id === 'reader') return [
    { label: tr('settings.shell.summary.reader.core.label'), value: tr('settings.shell.summary.reader.core.value') },
    { label: tr('settings.shell.summary.reader.advanced.label'), value: tr('settings.shell.summary.reader.advanced.value') },
    { label: tr('settings.shell.summary.reader.scope.label'), value: tr('settings.shell.summary.reader.scope.value') },
  ];
  if (group.id === 'library') return [
    { label: tr('settings.shell.summary.library.display.label'), value: tr('settings.shell.summary.library.display.value') },
    { label: tr('settings.shell.summary.library.import.label'), value: tr('settings.shell.summary.library.import.value') },
  ];
  if (group.id === 'data') return [
    { label: tr('settings.shell.summary.data.security.label'), value: tr('settings.shell.summary.data.security.value') },
    { label: tr('settings.shell.summary.data.maintenance.label'), value: tr('settings.shell.summary.data.maintenance.value') },
  ];
  if (group.id === 'diagnostics') return [
    { label: tr('settings.shell.summary.diagnostics.logs.label'), value: tr('settings.shell.summary.diagnostics.logs.value') },
    { label: tr('settings.shell.summary.diagnostics.experiments.label'), value: tr('settings.shell.summary.diagnostics.experiments.value') },
  ];
  return [];
}

function slugifySettingsNavId(value: string) {
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

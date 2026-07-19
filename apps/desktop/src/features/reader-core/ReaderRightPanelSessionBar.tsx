import { useEffect, useRef, useState } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import {
  commandReaderRightPanel,
  listOpenReaderRightPanels,
  subscribeReaderRightPanelSessions,
  type ReaderRightPanelId,
  type ReaderRightPanelSessionsSnapshot,
} from './readerRightPanelSessions';

type ReaderRightPanelSessionBarProps = {
  className?: string;
};

export function ReaderRightPanelSessionBar({ className }: ReaderRightPanelSessionBarProps) {
  const { t } = useI18n();
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [snapshot, setSnapshot] = useState<ReaderRightPanelSessionsSnapshot>(() => ({
    activeId: null,
    collapsed: false,
    width: 420,
    order: [],
    panels: {
      search: { id: 'search', open: false, placement: 'floating' },
      highlights: { id: 'highlights', open: false, placement: 'floating' },
      ai: { id: 'ai', open: false, placement: 'floating' },
      rules: { id: 'rules', open: false, placement: 'floating' },
      settings: { id: 'settings', open: false, placement: 'floating' },
    },
  }));

  function labelFor(id: ReaderRightPanelId) {
    if (id === 'search') return t('reader.search.results');
    if (id === 'highlights') return t('reader.highlights.panel');
    if (id === 'ai') return t('ai.title');
    if (id === 'rules') return t('reader.rules');
    return t('reader.settings');
  }

  useEffect(() => subscribeReaderRightPanelSessions(setSnapshot), []);

  useEffect(() => {
    const grid = document.querySelector<HTMLElement>('.reader-grid');
    if (!grid) return undefined;
    const openPanels = listOpenReaderRightPanels(snapshot);
    const sessionsOpen = openPanels.length > 0 && !snapshot.collapsed;
    const activeId = snapshot.activeId && openPanels.some((panel) => panel.id === snapshot.activeId)
      ? snapshot.activeId
      : (openPanels[0]?.id ?? null);
    grid.classList.toggle('reader-right-panels-collapsed', Boolean(snapshot.collapsed));
    grid.classList.toggle('reader-right-sessions-open', sessionsOpen);
    if (sessionsOpen) {
      const width = `${snapshot.width}px`;
      grid.style.setProperty('--reader-right-panel-width', width);
      grid.style.setProperty('--reader-highlight-panel-width', width);
      grid.style.setProperty('--reader-dock-width', width);
      grid.style.setProperty('--reader-session-rail-width', width);
    } else {
      grid.style.removeProperty('--reader-session-rail-width');
    }
    return () => {
      grid.classList.remove('reader-right-panels-collapsed');
      grid.classList.remove('reader-right-sessions-open');
      grid.style.removeProperty('--reader-session-rail-width');
    };
  }, [snapshot]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;
    function updateScrollState() {
      if (!strip) return;
      const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
      const next = {
        left: strip.scrollLeft > 2,
        right: strip.scrollLeft < maxScrollLeft - 2,
      };
      setScrollState((current) => current.left === next.left && current.right === next.right ? current : next);
    }
    function onWheel(event: WheelEvent) {
      if (!strip || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      strip.scrollLeft += event.deltaY;
      event.preventDefault();
    }
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(strip);
    strip.addEventListener('scroll', updateScrollState, { passive: true });
    strip.addEventListener('wheel', onWheel, { passive: false });
    const frame = window.requestAnimationFrame(updateScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      strip.removeEventListener('scroll', updateScrollState);
      strip.removeEventListener('wheel', onWheel);
    };
  }, [snapshot.order.join('|'), snapshot.collapsed]);

  const openPanels = listOpenReaderRightPanels(snapshot);
  const activeId = snapshot.activeId && openPanels.some((panel) => panel.id === snapshot.activeId)
    ? snapshot.activeId
    : (openPanels[0]?.id ?? null);

  useEffect(() => {
    if (!activeId) return;
    const frame = window.requestAnimationFrame(() => {
      stripRef.current?.querySelector<HTMLElement>('.reader-panel-tab.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId]);

  if (openPanels.length === 0 || snapshot.collapsed) return null;
  const activePlacement = activeId ? snapshot.panels[activeId].placement : 'floating';

  function scrollSessions(direction: -1 | 1) {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: direction * Math.max(140, Math.round(strip.clientWidth * 0.68)), behavior: 'smooth' });
  }

  return (
    <div
      className={[
        'reader-panel-tabstrip-host',
        `panel-${activeId}`,
        `placement-${activePlacement}`,
        scrollState.left || scrollState.right ? 'tabs-overflowing' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      <button type="button" className="reader-panel-tabscroll previous" aria-label={t('reader.panel.sessions.scrollLeft')} title={t('reader.panel.sessions.scrollLeft')} disabled={!scrollState.left} onClick={() => scrollSessions(-1)}><BookMindIcon name="prevPage" /></button>
      <div
        className="reader-panel-tabstrip"
        role="tablist"
        aria-label={t('reader.panel.sessions')}
        ref={stripRef}
      >
        {openPanels.map((panel) => {
          const active = panel.id === activeId;
          return (
            <div key={panel.id} className={active ? 'reader-panel-tab active' : 'reader-panel-tab'} role="presentation">
              <button
                type="button"
                role="tab"
                className="reader-panel-tab-main"
                aria-selected={active}
                title={labelFor(panel.id)}
                onClick={() => {
                  if (!active) commandReaderRightPanel({ action: 'activate', id: panel.id });
                }}
              >
                <span>{labelFor(panel.id)}</span>
              </button>
              <button
                type="button"
                className="reader-panel-tab-close"
                aria-label={t('reader.panel.sessions.closeTab', { title: labelFor(panel.id) })}
                title={t('reader.panel.sessions.close')}
                onClick={(event) => {
                  event.stopPropagation();
                  commandReaderRightPanel({ action: 'close', id: panel.id });
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="reader-panel-tabscroll next" aria-label={t('reader.panel.sessions.scrollRight')} title={t('reader.panel.sessions.scrollRight')} disabled={!scrollState.right} onClick={() => scrollSessions(1)}><BookMindIcon name="nextPage" /></button>
    </div>
  );
}

import type { BookMindIconName } from './bookMindIconTypes';

export type { BookMindIconName } from './bookMindIconTypes';

type BookMindIconProps = {
  name: BookMindIconName;
  className?: string;
};

export function BookMindIcon({ name, className = 'bm-icon' }: BookMindIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      {renderBookMindIcon(name)}
    </svg>
  );
}

function renderBookMindIcon(name: BookMindIconName) {
  switch (name) {
    case 'overview':
      return <><path className="bm-fill-soft" d="M8 38h36v4H8z" /><rect className="bm-fill-accent" x="10" y="22" width="7" height="16" rx="3" /><rect className="bm-fill-main" x="22" y="12" width="7" height="26" rx="3" /><rect className="bm-fill-warm" x="34" y="26" width="7" height="12" rx="3" /></>;
    case 'reader':
      return <><path className="bm-fill-main" d="M9 12c7-2 12 0 15 4v28c-3-4-8-6-15-4z" /><path className="bm-fill-accent" d="M27 16c3-4 8-6 16-4v28c-8-2-13 0-16 4z" /><path className="bm-fill-warm" d="M24 16h3v28h-3z" /></>;
    case 'library':
      return <><rect className="bm-fill-accent" x="10" y="12" width="9" height="31" rx="3" /><rect className="bm-fill-main" x="22" y="9" width="9" height="34" rx="3" /><rect className="bm-fill-warm" x="34" y="16" width="8" height="27" rx="3" /></>;
    case 'knowledge':
      return <><path className="bm-fill-accent" d="M26 8l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" /><path className="bm-fill-warm" d="M16 40h21v4H16z" /></>;
    case 'characters':
      return <><circle className="bm-fill-accent" cx="19" cy="18" r="7" /><circle className="bm-fill-main" cx="35" cy="17" r="6" /><path className="bm-fill-soft" d="M8 42c2-10 19-10 23 0z" /><path className="bm-fill-warm" d="M26 40c2-8 15-8 18 0z" /></>;
    case 'search':
    case 'readerSearch':
      return <><circle className="bm-fill-soft" cx="22" cy="22" r="13" /><circle className="bm-stroke-main" cx="22" cy="22" r="10" /><path className="bm-stroke-accent" d="M30 30l12 12" /></>;
    case 'tasks':
      return <><rect className="bm-fill-soft" x="12" y="9" width="30" height="34" rx="7" /><path className="bm-stroke-main" d="M18 20l4 4 8-9M18 34l4 4 8-9" /><path className="bm-stroke-accent" d="M32 23h5M32 37h5" /></>;
    case 'settings':
    case 'readerSettings':
      return <><circle className="bm-fill-accent" cx="26" cy="26" r="7" /><path className="bm-fill-main" d="M24 7h4l2 7-4 2-4-2zM24 45h4l2-7-4-2-4 2zM7 24v4l7 2 2-4-2-4zM45 24v4l-7 2-2-4 2-4z" /></>;
    case 'prevPage':
      return <><path className="bm-fill-accent" d="M33 10L16 26l17 16z" /><path className="bm-fill-main" d="M43 10L26 26l17 16z" /></>;
    case 'nextPage':
      return <><path className="bm-fill-accent" d="M19 10l17 16-17 16z" /><path className="bm-fill-main" d="M9 10l17 16L9 42z" /></>;
    case 'aiDesk':
      return <><path className="bm-fill-soft" d="M7 26c0-11 8-19 19-19s19 8 19 19-8 19-19 19S7 37 7 26z" /><path className="bm-fill-accent" d="M26 14l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" /></>;
    case 'aiNewChat':
      return <><path className="bm-fill-soft" d="M9 13h29c4 0 7 3 7 7v12c0 4-3 7-7 7H23l-10 6v-6H9z" /><path className="bm-stroke-main" d="M18 25h14M25 18v14" /><circle className="bm-fill-accent" cx="39" cy="15" r="5" /></>;
    case 'aiHistory':
      return <><path className="bm-fill-warm" d="M9 10h27c4 0 7 3 7 7v13c0 4-3 7-7 7H22l-9 6v-6H9z" /><path className="bm-fill-soft" d="M13 15h27c3 0 5 2 5 5v13c0 3-2 5-5 5H24l-8 5v-5h-3z" /><path className="bm-stroke-main" d="M20 24h16M20 31h11" /><path className="bm-stroke-accent" d="M16 14c4-4 10-6 16-4" /></>;
    case 'aiTimeline':
      return <><path className="bm-fill-soft" d="M12 9h28c3 0 5 2 5 5v24c0 3-2 5-5 5H18l-7 4v-4h-1c-3 0-5-2-5-5V16c0-4 3-7 7-7z" /><path className="bm-stroke-main" d="M18 17v20" /><circle className="bm-fill-accent" cx="18" cy="18" r="4" /><circle className="bm-fill-warm" cx="18" cy="27" r="4" /><circle className="bm-fill-accent" cx="18" cy="36" r="4" /><path className="bm-stroke-main" d="M26 18h12M26 27h9M26 36h13" /></>;
    case 'bookmark':
      return <><path className="bm-fill-accent" d="M14 9h24v35L26 36l-12 8z" /><path className="bm-fill-warm" d="M21 17h10v4H21z" /></>;
    case 'highlights':
      return <><path className="bm-fill-warm" d="M14 11h24l-4 20H18z" /><path className="bm-fill-accent" d="M12 38h28v5H12z" /></>;
    case 'toc':
      return <><rect className="bm-fill-accent" x="8" y="12" width="7" height="7" rx="2" /><rect className="bm-fill-main" x="18" y="13" width="25" height="5" rx="2" /><rect className="bm-fill-warm" x="8" y="24" width="7" height="7" rx="2" /><rect className="bm-fill-main" x="18" y="25" width="25" height="5" rx="2" /><rect className="bm-fill-accent" x="8" y="36" width="7" height="7" rx="2" /><rect className="bm-fill-main" x="18" y="37" width="25" height="5" rx="2" /></>;
    case 'tocScopeTitle':
      return <><path className="bm-fill-soft" d="M11 9h30v34H11z" /><path className="bm-fill-warm" d="M35 9h6v34h-6z" /><path className="bm-fill-accent" d="M16 17h20v5H16z" /><path className="bm-stroke-main" d="M19 29h14M19 36h10" /></>;
    case 'tocScopeContent':
      return <><path className="bm-fill-soft" d="M11 9h30v34H11z" /><path className="bm-fill-warm" d="M35 9h6v34h-6z" /><path className="bm-stroke-main" d="M17 17h18M17 24h18M17 31h14" /><path className="bm-stroke-accent" d="M17 38h10" /></>;
    case 'tocScopeAnnotations':
      return <><path className="bm-fill-soft" d="M12 9h24l6 6v28H12z" /><path className="bm-fill-accent" d="M36 9v9h8z" /><path className="bm-fill-warm" d="M17 34l5 6 17-17-5-5z" /><path className="bm-stroke-main" d="M18 20h13M18 27h9" /></>;
    case 'tocScopeBookmarks':
      return <><path className="bm-fill-soft" d="M12 9h28v34H12z" /><path className="bm-fill-accent" d="M20 9h14v20l-7-5-7 5z" /><path className="bm-stroke-main" d="M18 35h16" /><path className="bm-fill-warm" d="M36 9h4v34h-4z" /></>;
    case 'tocUndo':
      return <><path className="bm-fill-soft" d="M11 12h30v29H11z" /><path className="bm-fill-warm" d="M35 12h6v29h-6z" /><path className="bm-stroke-main" d="M31 19H17l7-7M18 19c0 10 6 16 18 16" /><path className="bm-fill-accent" d="M15 17h8v8h-8z" /></>;
    case 'tocRedo':
      return <><path className="bm-fill-soft" d="M11 12h30v29H11z" /><path className="bm-fill-warm" d="M11 12h6v29h-6z" /><path className="bm-stroke-main" d="M21 19h14l-7-7M34 19c0 10-6 16-18 16" /><path className="bm-fill-accent" d="M29 17h8v8h-8z" /></>;
    case 'pdfToc':
      return <><path className="bm-fill-soft" d="M13 8h18l8 8v28H13z" /><path className="bm-fill-accent" d="M31 8v9h9z" /><path className="bm-stroke-main" d="M18 19h11M18 26h14M18 33h9" /><path className="bm-fill-warm" d="M36 18h2v16h-2z" /><path className="bm-stroke-accent" d="M17 40h17" /></>;
    case 'zoomOut':
      return <><circle className="bm-fill-soft" cx="23" cy="23" r="13" /><circle className="bm-stroke-main" cx="23" cy="23" r="9.5" /><path className="bm-stroke-accent" d="M18 23h10" /><path className="bm-stroke-main" d="M30 30l10 10" /></>;
    case 'zoomIn':
      return <><circle className="bm-fill-soft" cx="23" cy="23" r="13" /><circle className="bm-stroke-main" cx="23" cy="23" r="9.5" /><path className="bm-stroke-accent" d="M18 23h10M23 18v10" /><path className="bm-stroke-main" d="M30 30l10 10" /></>;
    case 'fitWidth':
      return <><path className="bm-fill-soft" d="M11 12h30v28H11z" /><path className="bm-stroke-main" d="M16 18h20M16 34h20" /><path className="bm-stroke-accent" d="M14 14v24M38 14v24" /><path className="bm-fill-warm" d="M22 22h8v8h-8z" /></>;
    case 'focusMode':
      return <><path className="bm-fill-main" d="M9 9h14v6h-8v8H9zM29 9h14v14h-6v-8h-8zM37 29h6v14H29v-6h8zM9 29h6v8h8v6H9z" /><circle className="bm-fill-accent" cx="26" cy="26" r="6" /></>;
    case 'windowed':
      return <><rect className="bm-fill-soft" x="10" y="15" width="27" height="27" rx="5" /><path className="bm-fill-accent" d="M25 10h17v17h-6V20L24 32l-4-4 12-12h-7z" /></>;
    case 'networkTools':
      return <><circle className="bm-fill-soft" cx="25" cy="25" r="16" /><path className="bm-stroke-main" d="M9 25h34M25 9c5 5 8 11 8 16s-3 11-8 16M25 9c-5 5-8 11-8 16s3 11 8 16" /><path className="bm-fill-accent" d="M34 31l8 8-4 4-8-8z" /><circle className="bm-fill-warm" cx="29" cy="27" r="6" /></>;
    case 'moyuMode':
      return <><ellipse className="bm-fill-soft" cx="25" cy="26" rx="16" ry="10" /><path className="bm-fill-accent" d="M37 20l8 6-8 6-3-6z" /><circle className="bm-fill-main" cx="18" cy="24" r="2.5" /><path className="bm-fill-warm" d="M22 30c4 3 10 3 14 0l-5 7z" /><path className="bm-stroke-main" d="M10 26c4-7 16-12 29 0-13 12-25 7-29 0z" /></>;
    case 'moyuTransparent':
      return <><rect className="bm-fill-soft" x="10" y="12" width="32" height="28" rx="7" /><path className="bm-stroke-main" d="M14 36L38 12M24 40L42 22M10 30l18-18" /><circle className="bm-fill-accent" cx="36" cy="34" r="5" /></>;
    case 'moyuOpaque':
      return <><rect className="bm-fill-accent" x="10" y="12" width="32" height="28" rx="7" /><path className="bm-fill-warm" d="M16 18h20v5H16zM16 28h14v5H16z" /></>;
    case 'moyuTextSmall':
      return <><path className="bm-fill-soft" d="M10 38h18v4H10z" /><path className="bm-fill-accent" d="M14 12h16v5h-5v19h-6V17h-5z" /><path className="bm-fill-main" d="M34 24h9v4h-2v8h-5v-8h-2z" /></>;
    case 'moyuTextLarge':
      return <><path className="bm-fill-soft" d="M8 38h34v4H8z" /><path className="bm-fill-accent" d="M11 10h26v6h-9v22h-8V16h-9z" /><path className="bm-fill-warm" d="M36 22h8v5h-8zM38 18h4v13h-4z" /></>;
    case 'moyuHideToolbar':
      return <><rect className="bm-fill-soft" x="9" y="13" width="34" height="26" rx="7" /><path className="bm-stroke-main" d="M14 19h24M14 33h24M11 42L42 10" /><circle className="bm-fill-accent" cx="18" cy="26" r="3" /><circle className="bm-fill-warm" cx="34" cy="26" r="3" /></>;
    case 'more':
      return <><circle className="bm-fill-accent" cx="13" cy="26" r="4" /><circle className="bm-fill-main" cx="26" cy="26" r="4" /><circle className="bm-fill-warm" cx="39" cy="26" r="4" /></>;
    case 'aiSend':
      return <><path className="bm-fill-accent" d="M8 25l36-16-10 34-8-13-13-5z" /><path className="bm-fill-warm" d="M25 30l19-21-13 25z" /></>;
    case 'aiLocal':
      return <><rect className="bm-fill-soft" x="9" y="13" width="34" height="25" rx="6" /><path className="bm-stroke-main" d="M15 32h22M19 22h14" /><circle className="bm-fill-accent" cx="37" cy="18" r="5" /></>;
    case 'stop':
      return <><rect className="bm-fill-accent" x="14" y="14" width="24" height="24" rx="5" /><path className="bm-fill-warm" d="M20 20h12v12H20z" /></>;
    case 'retry':
      return <><path className="bm-stroke-main" d="M38 18a15 15 0 1 0 3 14" /><path className="bm-fill-accent" d="M35 8h10v10z" /><path className="bm-stroke-accent" d="M40 18c-4-4-8-6-14-6" /></>;
    case 'saveCommand':
      return <><rect className="bm-fill-soft" x="10" y="11" width="32" height="32" rx="6" /><path className="bm-fill-accent" d="M17 17h18v8H17z" /><path className="bm-fill-warm" d="M19 31h14v7H19z" /></>;
    case 'note':
      return <><path className="bm-fill-soft" d="M13 9h21l6 6v28H13z" /><path className="bm-fill-accent" d="M34 9v9h9z" /><path className="bm-stroke-main" d="M19 25h15M19 33h12" /></>;
    case 'copy':
      return <><rect className="bm-fill-soft" x="16" y="10" width="23" height="28" rx="5" /><rect className="bm-fill-accent" x="10" y="17" width="23" height="25" rx="5" /><path className="bm-fill-warm" d="M16 24h11v4H16zM16 32h9v4h-9z" /></>;
    case 'translate':
      return <><rect className="bm-fill-soft" x="8" y="11" width="23" height="25" rx="5" /><rect className="bm-fill-warm" x="21" y="18" width="23" height="25" rx="5" /><path className="bm-stroke-main" d="M14 19h12M20 16v16M15 31c5-4 8-8 10-12" /><path className="bm-stroke-accent" d="M28 36l4-10 4 10M30 32h4" /></>;
    case 'question':
      return <><circle className="bm-fill-soft" cx="26" cy="26" r="18" /><path className="bm-stroke-main" d="M19 20c2-6 14-6 14 2 0 6-7 6-7 11" /><circle className="bm-fill-accent" cx="26" cy="39" r="3" /></>;
    case 'plus':
      return <><circle className="bm-fill-soft" cx="26" cy="26" r="17" /><path className="bm-stroke-main" d="M26 16v20M16 26h20" /></>;
    case 'close':
      return <><rect className="bm-fill-soft" x="10" y="10" width="32" height="32" rx="8" /><path className="bm-fill-accent" d="M17 20 20 17l6 6 6-6 3 3-6 6 6 6-3 3-6-6-6 6-3-3 6-6z" /><path className="bm-fill-warm" d="M24 24h4v4h-4z" /></>;
    case 'play':
      return <><circle className="bm-fill-soft" cx="26" cy="26" r="18" /><path className="bm-fill-accent" d="M21 16l17 10-17 10z" /></>;
    case 'pause':
      return <><circle className="bm-fill-soft" cx="26" cy="26" r="18" /><path className="bm-fill-accent" d="M18 16h7v20h-7zM31 16h7v20h-7z" /></>;
    case 'folder':
      return <><path className="bm-fill-warm" d="M8 17h15l4 5h17v5H8z" /><path className="bm-fill-soft" d="M8 22h36l-4 21H12z" /><path className="bm-stroke-main" d="M12 28h28" /></>;
    case 'diagnostics':
      return <><rect className="bm-fill-soft" x="10" y="9" width="32" height="36" rx="7" /><path className="bm-stroke-main" d="M17 18h18M17 27h12M17 36h8" /><circle className="bm-fill-accent" cx="37" cy="36" r="6" /></>;
    case 'index':
      return <><rect className="bm-fill-soft" x="9" y="11" width="34" height="31" rx="6" /><path className="bm-fill-accent" d="M15 18h8v8h-8zM28 18h8v8h-8zM15 31h8v8h-8zM28 31h8v8h-8z" /></>;
    case 'logs':
      return <><path className="bm-fill-soft" d="M10 11h32v32H10z" /><path className="bm-stroke-main" d="M16 19h20M16 27h20M16 35h14" /><circle className="bm-fill-accent" cx="14" cy="19" r="2" /></>;
    case 'grid':
      return <><rect className="bm-fill-accent" x="10" y="10" width="14" height="14" rx="4" /><rect className="bm-fill-main" x="28" y="10" width="14" height="14" rx="4" /><rect className="bm-fill-warm" x="10" y="28" width="14" height="14" rx="4" /><rect className="bm-fill-soft" x="28" y="28" width="14" height="14" rx="4" /></>;
    case 'wrench':
      return <><path className="bm-fill-accent" d="M34 8a12 12 0 0 0-10 16L9 39l4 4 15-15A12 12 0 0 0 44 14l-8 8-6-6z" /><path className="bm-fill-warm" d="M12 36l4 4-3 3-4-4z" /></>;
    case 'aiMessageRetry':
      return <><path className="bm-fill-soft" d="M26 9c8 0 15 5 17 12l-5 2c-2-5-6-8-12-8-5 0-9 2-12 6l-4-3c4-6 9-9 16-9z" /><path className="bm-stroke-main" d="M38 19a14 14 0 0 0-23-5M14 33a14 14 0 0 0 23 5" /><path className="bm-stroke-accent" d="M38 12v7h-7M14 40v-7h7" /><path className="bm-fill-warm" d="M24 20h5v8h-5z" /></>;
    case 'aiMessageDelete':
      return <><path className="bm-fill-soft" d="M17 20h18l-2 21H19z" /><path className="bm-stroke-accent" d="M19 16h14" /><path className="bm-stroke-main" d="M22 16l2-5h8l2 5M20 20h14M23 25v11M29 25v11" /><path className="bm-fill-warm" d="M21 20h13l-1 5H22z" /></>;
    case 'aiMessagePin':
      return <g transform="translate(2 2) scale(2)"><path className="bm-fill-soft" d="M9.2 4.9h5.6l-.7 5.1 3.1 3.1-3.9 1.1-1.3 5-1.3-5-3.9-1.1 3.1-3.1z" /><path className="bm-stroke-main" d="M12 14.2v5" /></g>;
    case 'aiMessageCopy':
      return <><path className="bm-fill-soft" d="M13 18h17l6 6v20H13z" /><path className="bm-fill-accent" d="M19 13h17l6 6v22H19z" /><path className="bm-fill-warm" d="M36 13v7h7z" /><path className="bm-stroke-main" d="M13 18h17l6 6v20H13zM19 13h17l6 6v22H19z" /><path className="bm-stroke-accent" d="M24 27h12M24 34h9" /></>;
    case 'aiMessageExport':
      return <g transform="translate(2 2) scale(2)"><path className="bm-fill-soft" d="M7 13.2v5.1h10v-5.1" /><path className="bm-stroke-main" d="M12 4.8v9.1M8.8 8l3.2-3.2L15.2 8" /><path className="bm-stroke-accent" d="M8.6 18.2h6.8" /></g>;
    case 'aiMessageRead':
      return <g transform="translate(2 2) scale(2)"><path className="bm-fill-soft" d="M8.4 5.9v12.2l9.4-6.1z" /><path className="bm-stroke-main" d="M6 5.2v13.6" /></g>;
    case 'aiMessageMore':
      return <><path className="bm-fill-soft" d="M12 12h28v28H12z" /><path className="bm-stroke-main" d="M15 19h22M15 26h22M15 33h22" /><path className="bm-stroke-accent" d="M19 19h.1M26 26h.1M33 33h.1" /><path className="bm-fill-warm" d="M39 16h4v20h-4z" /></>;
    case 'librarySort':
      return <><rect className="bm-fill-soft" x="12" y="10" width="28" height="32" rx="7" /><path className="bm-stroke-main" d="M19 17h16M19 26h12M19 35h8" /><path className="bm-fill-accent" d="M39 15l5 5H34z" /><path className="bm-fill-warm" d="M39 38l-5-5h10z" /></>;
    case 'libraryFilter':
      return <><path className="bm-fill-soft" d="M10 12h32L30 27v12l-8 4V27z" /><path className="bm-stroke-main" d="M13 15h26M19 24h14" /><circle className="bm-fill-accent" cx="35" cy="36" r="6" /></>;
    case 'libraryImport':
      return <><path className="bm-fill-warm" d="M8 17h15l4 5h17v5H8z" /><path className="bm-fill-soft" d="M8 22h36l-4 21H12z" /><path className="bm-stroke-main" d="M26 18v17M18 27l8 8 8-8" /></>;
    case 'libraryCardView':
      return <><rect className="bm-fill-accent" x="10" y="10" width="14" height="14" rx="4" /><rect className="bm-fill-main" x="28" y="10" width="14" height="14" rx="4" /><rect className="bm-fill-warm" x="10" y="28" width="14" height="14" rx="4" /><rect className="bm-fill-soft" x="28" y="28" width="14" height="14" rx="4" /></>;
    case 'libraryListView':
      return <><rect className="bm-fill-soft" x="9" y="10" width="34" height="32" rx="7" /><rect className="bm-fill-accent" x="15" y="16" width="7" height="7" rx="2" /><path className="bm-stroke-main" d="M26 19h11" /><rect className="bm-fill-warm" x="15" y="29" width="7" height="7" rx="2" /><path className="bm-stroke-main" d="M26 32h11" /></>;
    case 'libraryShelfView':
      return <><rect className="bm-fill-accent" x="10" y="12" width="8" height="27" rx="3" /><rect className="bm-fill-main" x="21" y="9" width="8" height="30" rx="3" /><rect className="bm-fill-warm" x="32" y="15" width="8" height="24" rx="3" /><path className="bm-fill-soft" d="M8 39h36v4H8z" /></>;
    case 'libraryTrash':
      return <><path className="bm-fill-soft" d="M15 18h22l-2 25H17z" /><path className="bm-fill-accent" d="M13 14h26v5H13z" /><path className="bm-stroke-main" d="M21 24v13M26 24v13M31 24v13" /><path className="bm-fill-warm" d="M21 9h10l2 5H19z" /></>;
    case 'libraryMore':
      return <><rect className="bm-fill-soft" x="10" y="11" width="32" height="30" rx="10" /><circle className="bm-fill-accent" cx="17" cy="26" r="4" /><circle className="bm-fill-main" cx="26" cy="26" r="4" /><circle className="bm-fill-warm" cx="35" cy="26" r="4" /></>;
    case 'librarySelect':
      return <><rect className="bm-fill-soft" x="12" y="10" width="28" height="32" rx="7" /><path className="bm-fill-warm" d="M34 10h6v32h-6z" /><path className="bm-stroke-main" d="M18 26l6 6 12-14" /></>;
    case 'librarySelectEmpty':
      return <><rect className="bm-fill-soft" x="12" y="10" width="28" height="32" rx="7" /><path className="bm-fill-warm" d="M34 10h6v32h-6z" /><rect className="bm-stroke-main" x="18" y="19" width="15" height="15" rx="4" /><path className="bm-stroke-accent" d="M21 26h9" /></>;
    case 'libraryGroupCollapse':
      return <><path className="bm-fill-soft" d="M12 9h28v34H12z" /><path className="bm-fill-warm" d="M34 9h6v34h-6z" /><path className="bm-fill-accent" d="M14 16h13v6H14zM14 30h13v6H14z" /><path className="bm-stroke-main" d="M32 18l-7 8 7 8" /></>;
    case 'libraryGroupExpand':
      return <><path className="bm-fill-soft" d="M12 9h28v34H12z" /><path className="bm-fill-warm" d="M12 9h6v34h-6z" /><path className="bm-fill-accent" d="M25 16h13v6H25zM25 30h13v6H25z" /><path className="bm-stroke-main" d="M20 18l7 8-7 8" /></>;
    case 'libraryMenuOpen':
      return <><path className="bm-fill-soft" d="M10 13h21l8 8v23H10z" /><path className="bm-fill-accent" d="M31 13v9h9z" /><path className="bm-stroke-main" d="M18 29h19M29 21l8 8-8 8" /><path className="bm-fill-warm" d="M14 17h5v23h-5z" /></>;
    case 'libraryMenuCharacters':
      return <><circle className="bm-fill-accent" cx="19" cy="18" r="7" /><circle className="bm-fill-main" cx="34" cy="17" r="6" /><path className="bm-fill-soft" d="M8 42c2-10 19-10 23 0z" /><path className="bm-fill-warm" d="M26 40c2-8 15-8 18 0z" /></>;
    case 'libraryMenuDetail':
      return <><path className="bm-fill-soft" d="M13 8h21l7 7v29H13z" /><path className="bm-fill-accent" d="M34 8v9h9z" /><path className="bm-stroke-main" d="M19 24h15M19 32h11" /><circle className="bm-fill-warm" cx="36" cy="36" r="5" /></>;
    case 'libraryMenuEdit':
      return <><path className="bm-fill-soft" d="M13 9h22l6 6v28H13z" /><path className="bm-fill-accent" d="M35 9v9h8z" /><path className="bm-fill-warm" d="M18 33l4 6 16-16-5-5z" /><path className="bm-stroke-main" d="M20 22h12M20 28h8" /></>;
    case 'libraryMenuCover':
      return <><rect className="bm-fill-accent" x="13" y="9" width="26" height="34" rx="5" /><path className="bm-fill-warm" d="M34 9h5v34h-5z" /><path className="bm-fill-soft" d="M18 18h13v12H18z" /><path className="bm-stroke-main" d="M18 35h12" /></>;
    case 'libraryMenuCustomCover':
      return <><rect className="bm-fill-soft" x="10" y="12" width="32" height="28" rx="7" /><path className="bm-fill-accent" d="M15 33l8-9 6 6 4-5 7 8z" /><circle className="bm-fill-warm" cx="34" cy="19" r="4" /><path className="bm-stroke-main" d="M12 40h28" /></>;
    case 'libraryMenuGroup':
      return <><path className="bm-fill-warm" d="M8 17h15l4 5h17v6H8z" /><path className="bm-fill-soft" d="M8 22h36l-4 21H12z" /><path className="bm-fill-accent" d="M15 29h8v8h-8zM28 29h8v8h-8z" /></>;
    case 'libraryMenuDelete':
      return <><path className="bm-fill-soft" d="M15 18h22l-2 25H17z" /><path className="bm-fill-accent" d="M13 14h26v5H13z" /><path className="bm-stroke-main" d="M21 24v13M26 24v13M31 24v13" /><path className="bm-fill-warm" d="M21 9h10l2 5H19z" /></>;
    case 'libraryMenuCreate':
      return <><path className="bm-fill-warm" d="M8 17h15l4 5h17v6H8z" /><path className="bm-fill-soft" d="M8 22h36l-4 21H12z" /><path className="bm-stroke-main" d="M26 27v12M20 33h12" /><circle className="bm-fill-accent" cx="38" cy="16" r="5" /></>;
    case 'settingsGeneral':
      return <><path className="bm-fill-soft" d="M9 22l3-7 5 2 3-4 5 4 3-2 3 7 4 1-2 6 2 6-5 1-3 6-5-2-3 3-5-3-3 1-3-7-4-1 2-6-2-6 5-1 3-6 5 2 3-3 5 3z" /><circle className="bm-fill-accent" cx="26" cy="26" r="6" /></>;
    case 'settingsAppearance':
      return <><path className="bm-fill-soft" d="M26 7a19 19 0 1 0 0 38c2 0 4-2 4-4 0-3-3-4-3-7 0-2 2-4 4-4h5a9 9 0 0 0 9-9c0-8-9-14-19-14z" /><circle className="bm-fill-warm" cx="16" cy="20" r="3" /><circle className="bm-fill-accent" cx="24" cy="14" r="3" /><circle className="bm-fill-main" cx="34" cy="17" r="3" /><circle className="bm-fill-warm" cx="37" cy="27" r="3" /></>;
    case 'settingsChapters':
      return <><rect className="bm-fill-soft" x="10" y="9" width="32" height="34" rx="6" /><path className="bm-fill-accent" d="M15 16h12v3H15z" /><path className="bm-fill-main" d="M15 23h22v3H15z" /><path className="bm-fill-accent" d="M15 30h22v3H15z" /><path className="bm-fill-warm" d="M32 13l6 6-6 6-3-3 3-3-3-3z" /></>;
    case 'settingsAnnotations':
      return <><path className="bm-fill-warm" d="M11 11h24v22l-6 6H11z" /><path className="bm-fill-accent" d="M29 33v6h6z" /><path className="bm-fill-main" d="M17 17h12v4H17zM17 25h8v3h-8z" /><path className="bm-fill-soft" d="M33 19l8 8-9 9-8-1 1-8z" /><path className="bm-stroke-main" d="M33 27l-7 7" /></>;
    case 'settingsData':
      return <><path className="bm-fill-accent" d="M26 6l16 6v12c0 10-7 17-16 22-9-5-16-12-16-22V12z" /><path className="bm-fill-soft" d="M18 24l6 6 12-12-3-3-9 9-3-3z" /></>;
    case 'settingsShortcuts':
      return <><rect className="bm-fill-soft" x="7" y="15" width="38" height="22" rx="5" /><rect className="bm-fill-accent" x="12" y="20" width="6" height="6" rx="2" /><rect className="bm-fill-main" x="22" y="20" width="6" height="6" rx="2" /><rect className="bm-fill-accent" x="32" y="20" width="6" height="6" rx="2" /><rect className="bm-fill-main" x="17" y="29" width="18" height="3" rx="1.5" /></>;
    case 'settingsAccessibility':
      return <><circle className="bm-fill-soft" cx="26" cy="26" r="18" /><circle className="bm-fill-accent" cx="26" cy="14" r="3" /><path className="bm-fill-main" d="M14 20l8-1 4 5 4-5 8 1-1 4-5-1-2 4v11h-4V32l-2-4-5 1z" /></>;
    case 'settingsHelp':
      return <><path className="bm-fill-soft" d="M13 8h22l7 7v29H13z" /><path className="bm-fill-accent" d="M35 8v9h9z" /><path className="bm-stroke-main" d="M18 23h16" /><path className="bm-stroke-main settings-help-chevron" d="M21 32l5 5 5-5" /></>;
    case 'pdf':
      return <><path className="bm-fill-soft" d="M13 7h18l8 8v30H13z" /><path className="bm-fill-accent" d="M31 7v9h9z" /><path className="bm-stroke-main" d="M18 24h16M18 31h13" /><path className="bm-stroke-accent" d="M18 17h10" /></>;
    default:
      return null;
  }
}

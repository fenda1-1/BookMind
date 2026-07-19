export type AiCitationActionIconName =
  | 'jumpSource'
  | 'repairJump'
  | 'saveDefault'
  | 'saveHighlight'
  | 'saveExcerpt'
  | 'copyCitation'
  | 'expandContext'
  | 'openDetail'
  | 'noDetail'
  | 'externalBlocked';

type AiCitationActionIconProps = {
  name: AiCitationActionIconName;
  className?: string;
};

export function AiCitationActionIcon({ name, className = 'ai-citation-action-icon' }: AiCitationActionIconProps) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      {renderAiCitationActionIcon(name)}
    </svg>
  );
}

function renderAiCitationActionIcon(name: AiCitationActionIconName) {
  switch (name) {
    case 'jumpSource':
      return <><path className="bm-fill-soft" d="M13 8h21l7 7v29H13z" /><path className="bm-fill-accent" d="M34 8v9h9z" /><path className="bm-stroke-main" d="M18 26h17M29 20l7 6-7 6" /><circle className="bm-fill-warm" cx="19" cy="36" r="4" /></>;
    case 'repairJump':
      return <><path className="bm-fill-soft" d="M13 9h21l7 7v28H13z" /><path className="bm-fill-accent" d="M34 9v9h8z" /><path className="bm-fill-warm" d="M34 23a8 8 0 0 0-7 11L16 45l-5-5 11-11a8 8 0 0 0 11-10l-5 5-4-4z" /><path className="bm-stroke-main" d="M18 25h8" /></>;
    case 'saveDefault':
      return <><rect className="bm-fill-soft" x="10" y="10" width="32" height="32" rx="7" /><path className="bm-fill-accent" d="M16 16h20v10H16z" /><path className="bm-fill-warm" d="M19 31h14v7H19z" /><path className="bm-stroke-main" d="M34 16v8" /></>;
    case 'saveHighlight':
      return <><path className="bm-fill-warm" d="M16 9h19l-4 21H12z" /><path className="bm-fill-accent" d="M9 38h34v6H9z" /><path className="bm-stroke-main" d="M18 15h12M16 22h12" /></>;
    case 'saveExcerpt':
      return <><path className="bm-fill-soft" d="M12 8h22l7 7v29H12z" /><path className="bm-fill-accent" d="M34 8v9h9z" /><path className="bm-stroke-main" d="M18 24h16M18 31h13M18 38h9" /><path className="bm-fill-warm" d="M10 34h8v10l-4-3-4 3z" /></>;
    case 'copyCitation':
      return <><rect className="bm-fill-soft" x="17" y="9" width="22" height="28" rx="5" /><rect className="bm-fill-accent" x="10" y="16" width="22" height="27" rx="5" /><path className="bm-stroke-main" d="M16 24h11M16 31h9" /><path className="bm-fill-warm" d="M33 9v7h7z" /></>;
    case 'expandContext':
      return <><path className="bm-fill-soft" d="M12 10h28v32H12z" /><path className="bm-stroke-main" d="M18 18h16M18 26h16M18 34h16" /><path className="bm-stroke-accent" d="M7 18l-4 8 4 8M45 18l4 8-4 8" /><circle className="bm-fill-warm" cx="26" cy="26" r="3" /></>;
    case 'openDetail':
      return <><path className="bm-fill-soft" d="M13 8h22l6 6v30H13z" /><path className="bm-fill-accent" d="M35 8v8h8z" /><circle className="bm-fill-warm" cx="26" cy="23" r="4" /><path className="bm-stroke-main" d="M26 30v9M22 39h8" /></>;
    case 'noDetail':
      return <><path className="bm-fill-soft" d="M13 8h22l6 6v30H13z" /><path className="bm-fill-accent" d="M35 8v8h8z" /><path className="bm-stroke-main" d="M18 34h16M17 43L40 20" /><circle className="bm-fill-warm" cx="25" cy="23" r="4" /></>;
    case 'externalBlocked':
      return <><circle className="bm-fill-soft" cx="25" cy="26" r="17" /><path className="bm-stroke-main" d="M8 26h34M25 9c6 6 6 28 0 34M25 9c-6 6-6 28 0 34" /><path className="bm-stroke-accent" d="M12 42L40 14" /><circle className="bm-fill-warm" cx="38" cy="38" r="5" /></>;
    default:
      return null;
  }
}

import type { AppPage } from '../types';

type AppTopbarProps = {
  activePage: AppPage;
  compact: boolean;
  eyebrow: string;
  title: string;
  description: string;
  commandVisible: boolean;
  nightVisible: boolean;
  searchVisible: boolean;
  summaryVisible: boolean;
  lockVisible: boolean;
  locked: boolean;
  night: boolean;
  labels: { command: string; day: string; night: string; search: string; lock: string; summary: string };
  onOpenCommand: () => void;
  onToggleNight: () => void;
  onOpenSearch: () => void;
  onLock: () => void;
  onSummarize: () => void;
};

export function AppTopbar({ activePage, compact, eyebrow, title, description, commandVisible, nightVisible, searchVisible, summaryVisible, lockVisible, locked, night, labels, onOpenCommand, onToggleNight, onOpenSearch, onLock, onSummarize }: AppTopbarProps) {
  return <header className="topbar"><div className={compact ? 'topbar-title compact' : 'topbar-title'} title={description}>{eyebrow && !compact ? <p className="eyebrow">{eyebrow}</p> : null}<h1>{title}</h1></div><div className="topbar-actions">{commandVisible ? <button className="ghost-btn" onClick={onOpenCommand} disabled={locked}>{labels.command}</button> : null}{nightVisible ? <button className="ghost-btn" onClick={onToggleNight}>{night ? labels.day : labels.night}</button> : null}{searchVisible ? <button className="ghost-btn" onClick={onOpenSearch}>{labels.search}</button> : null}{lockVisible ? <button className="ghost-btn" type="button" onClick={onLock}>{labels.lock}</button> : null}{summaryVisible ? <button className="primary-btn" onClick={onSummarize}>{labels.summary}</button> : null}</div></header>;
}

import type { RefObject } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import type { Translator } from '../../i18n';
import type { AiConversation } from './aiConversationHistory';
import { AiConversationHistoryDrawer } from './AiConversationHistoryDrawer';

type AiReaderPanelToolbarProps = {
  t: Translator;
  apiSettingsOpen: boolean;
  questionTimelineOpen: boolean;
  historyDrawerOpen: boolean;
  conversations: AiConversation[];
  activeConversationId: string;
  timelineItems: Array<{ id: string; label: string; createdAt: string; order: number }>;
  timelineRef: RefObject<HTMLElement | null>;
  onToggleApiSettings: () => void;
  onToggleQuestionTimeline: () => void;
  onToggleHistory: () => void;
  onCloseQuestionTimeline: () => void;
  onOpenSettings: () => void;
  onToggleCollapsed: () => void;
  onCreateConversation: () => void;
  onSwitchConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onPinConversation: (conversationId: string, pinned: boolean) => void;
  onJumpToMessage: (messageId: string) => void;
  formatTimelineTime: (value: string) => string;
};

export function AiReaderPanelToolbar({
  t,
  apiSettingsOpen,
  questionTimelineOpen,
  historyDrawerOpen,
  conversations,
  activeConversationId,
  timelineItems,
  timelineRef,
  onToggleApiSettings,
  onToggleQuestionTimeline,
  onToggleHistory,
  onCloseQuestionTimeline,
  onOpenSettings,
  onToggleCollapsed,
  onCreateConversation,
  onSwitchConversation,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
  onJumpToMessage,
  formatTimelineTime,
}: AiReaderPanelToolbarProps) {
  return (
    <div className="ai-header-card research-desk-surface" data-layout="ai-mini-toolbar" aria-label={t('ai.toolbar.aria')}>
      <button className="ai-settings-seal-btn" type="button" onClick={onToggleApiSettings} aria-label={t('ai.toolbar.apiSettings')}>API</button>
      {apiSettingsOpen ? (
        <aside className="ai-api-settings-popover floating-card-stack" aria-label={t('ai.toolbar.apiSummary')}>
          <strong>{t('ai.toolbar.cloudEndpoint')}</strong>
          <span>apiKey · apiBaseUrl</span>
          <span>responses / chat.completions</span>
          <button type="button" onClick={onOpenSettings}>{t('ai.toolbar.openSettings')}</button>
        </aside>
      ) : null}
      <button className="reader-icon-btn ai-mini-icon-btn" type="button" onClick={onCreateConversation} data-tooltip={t('ai.toolbar.newChat')} aria-label={t('ai.toolbar.newChat')}><BookMindIcon name="aiNewChat" /></button>
      <button className={questionTimelineOpen ? 'reader-icon-btn ai-mini-icon-btn active' : 'reader-icon-btn ai-mini-icon-btn'} type="button" data-ai-question-timeline-trigger="true" onClick={onToggleQuestionTimeline} data-tooltip={t('ai.toolbar.timeline')} aria-label={t('ai.toolbar.timeline')}><BookMindIcon name="aiTimeline" /></button>
      <button className={historyDrawerOpen ? 'reader-icon-btn ai-mini-icon-btn active' : 'reader-icon-btn ai-mini-icon-btn'} type="button" onClick={onToggleHistory} data-tooltip={t('ai.toolbar.history')} aria-label={t('ai.toolbar.history')}><BookMindIcon name="aiHistory" /></button>
      <button className="reader-icon-btn ai-mini-icon-btn" type="button" onClick={onOpenSettings} data-tooltip={t('ai.toolbar.settings')} aria-label={t('ai.toolbar.settings')}><BookMindIcon name="readerSettings" /></button>
      <button className="reader-icon-btn ai-mini-icon-btn" type="button" onClick={onToggleCollapsed} data-tooltip={t('ai.toolbar.close')} aria-label={t('ai.toolbar.close')}><BookMindIcon name="close" /></button>
      {questionTimelineOpen ? (
        <aside ref={timelineRef} className="ai-question-timeline-popover floating-card-stack" aria-label={t('ai.timeline.title')}>
          <header>
            <div><strong>{t('ai.timeline.title')}</strong><span>{t('ai.timeline.count', { count: timelineItems.length })}</span></div>
            <button type="button" aria-label={t('ai.timeline.close')} onClick={onCloseQuestionTimeline}>×</button>
          </header>
          <div className="ai-question-timeline-list">
            {timelineItems.length ? timelineItems.map((item) => (
              <button type="button" key={item.id} onClick={() => onJumpToMessage(item.id)}>
                <em>{item.order}</em><span>{item.label}</span><time dateTime={item.createdAt}>{formatTimelineTime(item.createdAt)}</time>
              </button>
            )) : <p>{t('ai.timeline.empty')}</p>}
          </div>
        </aside>
      ) : null}
      <AiConversationHistoryDrawer
        open={historyDrawerOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewConversation={onCreateConversation}
        onSwitchConversation={onSwitchConversation}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
        onPinConversation={onPinConversation}
      />
    </div>
  );
}

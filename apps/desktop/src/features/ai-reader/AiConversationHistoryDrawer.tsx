import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n, type Locale, type Translator } from '../../i18n';
import type { AiConversation } from './aiConversationHistory';

type AiConversationHistoryDrawerProps = {
  open: boolean;
  conversations: AiConversation[];
  activeConversationId: string;
  onNewConversation: () => void;
  onSwitchConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onPinConversation: (conversationId: string, pinned: boolean) => void;
};

type ContextMenuState = {
  conversationId: string;
  x: number;
  y: number;
} | null;

export function AiConversationHistoryDrawer({
  open,
  conversations,
  activeConversationId,
  onNewConversation,
  onSwitchConversation,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
}: AiConversationHistoryDrawerProps) {
  const { t, locale } = useI18n();
  const drawerRef = useRef<HTMLElement | null>(null);
  const contextMenuRef = useRef<HTMLMenuElement | null>(null);
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) => [
      conversation.title,
      ...conversation.messages.map((message) => message.content),
    ].join(' ').toLocaleLowerCase().includes(needle));
  }, [conversations, query]);
  const menuConversation = contextMenu ? conversations.find((conversation) => conversation.id === contextMenu.conversationId) : null;

  useEffect(() => {
    if (!contextMenu) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) return;
      setContextMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  if (!open) return null;

  function beginRename(conversation: AiConversation) {
    setRenamingId(conversation.id);
    setRenameDraft(conversation.title);
    setContextMenu(null);
  }

  function commitRename(conversationId: string) {
    onRenameConversation(conversationId, renameDraft);
    setRenamingId(null);
    setRenameDraft('');
  }

  function openContextMenu(event: ReactMouseEvent, conversation: AiConversation) {
    event.preventDefault();
    const rect = drawerRef.current?.getBoundingClientRect();
    const x = rect ? Math.min(Math.max(event.clientX - rect.left, 8), Math.max(8, rect.width - 204)) : event.clientX;
    const y = rect ? Math.min(Math.max(event.clientY - rect.top, 8), Math.max(8, rect.height - 126)) : event.clientY;
    setContextMenu({ conversationId: conversation.id, x, y });
  }

  function deleteConversation(conversationId: string) {
    onDeleteConversation(conversationId);
    setContextMenu(null);
  }

  return (
    <aside ref={drawerRef} className="ai-history-drawer floating-card-stack" aria-label={t('ai.history.aria')} onMouseLeave={() => setContextMenu(null)}>
      <header className="ai-history-drawer-head">
        <div>
          <strong>{t('ai.history.title')}</strong>
          <span>{t('ai.history.count', { count: conversations.length })}</span>
        </div>
        <button className="reader-icon-btn ai-history-new-btn" type="button" data-tooltip={t('ai.history.new')} aria-label={t('ai.history.new')} onClick={onNewConversation}><BookMindIcon name="aiNewChat" /></button>
      </header>
      <label className="ai-history-search">
        <span>{t('ai.history.search')}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('ai.history.searchPlaceholder')} />
      </label>
      <div className="ai-history-list" role="listbox" tabIndex={0} aria-label={t('ai.history.list')}>
        {filteredConversations.map((conversation) => (
          <article
            className={`ai-history-item${conversation.id === activeConversationId ? ' active' : ''}${conversation.pinned ? ' pinned' : ''}`}
            key={conversation.id}
            role="option"
            aria-selected={conversation.id === activeConversationId}
            onContextMenu={(event) => openContextMenu(event, conversation)}
          >
            {renamingId === conversation.id ? (
              <form onSubmit={(event) => { event.preventDefault(); commitRename(conversation.id); }}>
                <input value={renameDraft} autoFocus onChange={(event) => setRenameDraft(event.target.value)} onBlur={() => commitRename(conversation.id)} />
              </form>
            ) : (
              <div className="ai-history-item-row">
                <button className="ai-history-item-main" type="button" onClick={() => onSwitchConversation(conversation.id)}>
                  <strong>{conversation.pinned ? '◆ ' : ''}{conversation.title}</strong>
                  <span>{summarizeConversation(conversation, t)}</span>
                  <time dateTime={conversation.updatedAt}>{formatHistoryTime(conversation.updatedAt, locale)}</time>
                </button>
                <button className="ai-history-delete-btn" type="button" data-tooltip={t('ai.history.delete')} aria-label={t('ai.history.deleteNamed', { title: conversation.title })} onClick={() => deleteConversation(conversation.id)}>
                  <BookMindIcon name="close" />
                </button>
              </div>
            )}
          </article>
        ))}
        {filteredConversations.length === 0 ? <p className="ai-history-empty">{t('ai.history.empty')}</p> : null}
      </div>
      {menuConversation ? (
        <menu ref={contextMenuRef} className="ai-history-context-menu" style={{ left: contextMenu?.x, top: contextMenu?.y }} aria-label={t('ai.history.menu')}>
          <li className="ai-context-menu-heading"><BookMindIcon name="aiHistory" /><span>{menuConversation.title}</span></li>
          <button type="button" onClick={() => beginRename(menuConversation)}><BookMindIcon name="libraryMenuEdit" /><span>{t('ai.history.rename')}</span></button>
          <button type="button" onClick={() => { onPinConversation(menuConversation.id, !menuConversation.pinned); setContextMenu(null); }}><BookMindIcon name="aiMessagePin" /><span>{menuConversation.pinned ? t('ai.history.unpin') : t('ai.history.pin')}</span></button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(exportConversation(menuConversation, t)); setContextMenu(null); }}><BookMindIcon name="aiMessageCopy" /><span>{t('ai.history.copy')}</span></button>
          <button type="button" className="danger" onClick={() => deleteConversation(menuConversation.id)}><BookMindIcon name="aiMessageDelete" /><span>{t('ai.history.delete')}</span></button>
        </menu>
      ) : null}
    </aside>
  );
}

function summarizeConversation(conversation: AiConversation, t: Translator) {
  const last = conversation.messages.at(-1);
  if (!last) return t('ai.history.emptyConversation');
  const text = last.content.replace(/\s+/g, ' ').trim();
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
}

function exportConversation(conversation: AiConversation, t: Translator) {
  return conversation.messages.map((message) => `${message.role === 'user' ? t('ai.history.userRole') : t('ai.history.assistantRole')}：${message.content}`).join('\n\n');
}

function formatHistoryTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

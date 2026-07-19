import { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import type { ReaderBookmark, ReaderHighlightColor } from '../../types';
import type { ReaderTextDialogRequest } from './ReaderAnnotationDrawers';
import { readerHighlightColors } from './readerInteractionModel';
import type { ReaderHighlightRange } from './readerModel';

export { getFloatingMenuPosition } from './readerModel';

export type ReaderHighlightMenuState = {
  x: number;
  y: number;
  highlight: ReaderHighlightRange;
};

export type ReaderBookmarkMenuState = {
  x: number;
  y: number;
  bookmark: ReaderBookmark;
  bounds?: { left: number; top: number; right: number; bottom: number };
};

export function ReaderBookmarkContextMenu({ menu, onUpdateBookmark, onJump, onView, onDelete, onClose }: { menu: ReaderBookmarkMenuState; onUpdateBookmark: (id: string, updates: { color?: ReaderHighlightColor; updatedAt?: string }) => void; onJump: (bookmark: ReaderBookmark) => void; onView: (bookmark: ReaderBookmark) => void; onDelete: (bookmark: ReaderBookmark) => void; onClose: () => void }) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: menu.x, y: menu.y });
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const margin = 8;
    const bounds = menu.bounds ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const maxX = Math.max(bounds.left + margin, bounds.right - rect.width - margin);
    const maxY = Math.max(bounds.top + margin, bounds.bottom - rect.height - margin);
    setPosition({
      x: Math.max(bounds.left + margin, Math.min(menu.x, maxX)),
      y: Math.max(bounds.top + margin, Math.min(menu.y, maxY)),
    });
  }, [menu.x, menu.y, menu.bounds]);
  return (
    <div ref={menuRef} className="reader-context-menu reader-highlight-menu reader-bookmark-menu" role="menu" aria-label={t('reader.bookmark.menu')} style={{ left: position.x, top: position.y }} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <div className="reader-color-row" role="group" aria-label={t('reader.highlight.color')}>
        {readerHighlightColors.map((color) => (
          <button className={`reader-color-dot color-${color}${(menu.bookmark.color ?? 'red') === color ? ' active' : ''}`} type="button" key={color} aria-label={t(`reader.highlight.color.${color}`)} aria-pressed={(menu.bookmark.color ?? 'red') === color} onClick={() => { onUpdateBookmark(menu.bookmark.id, { color, updatedAt: new Date().toISOString() }); onClose(); }} />
        ))}
      </div>
      <button role="menuitem" type="button" onClick={() => { onJump(menu.bookmark); onClose(); }}>{t('reader.bookmark.jump')}</button>
      <button role="menuitem" type="button" onClick={() => { onView(menu.bookmark); onClose(); }}>{t('reader.bookmark.view')}</button>
      <button role="menuitem" type="button" onClick={() => { onDelete(menu.bookmark); onClose(); }}>{t('reader.bookmark.delete')}</button>
    </div>
  );
}

export function ReaderHighlightContextMenu({ menu, annotationMarkdownEditorEnabled, jumpToParagraph, setHighlightViewer, setTextDialog, setHighlightMenu, onUpdateHighlightColor, onDefaultHighlightColorChange, onUpdateHighlightNote, onClearHighlightNote, deleteHighlightWithUndo }: { menu: ReaderHighlightMenuState; annotationMarkdownEditorEnabled: boolean; jumpToParagraph: (chapterIndex: number, paragraphIndex: number, offset?: number) => void; setHighlightViewer: (request: { highlight: ReaderHighlightRange }) => void; setTextDialog: (dialog: ReaderTextDialogRequest | null) => void; setHighlightMenu: (menu: ReaderHighlightMenuState | null) => void; onUpdateHighlightColor: (id: string, color: ReaderHighlightColor) => void; onDefaultHighlightColorChange: (color: ReaderHighlightColor) => void; onUpdateHighlightNote: (id: string, note: string) => void; onClearHighlightNote: (id: string) => void; deleteHighlightWithUndo: (highlight: ReaderHighlightRange) => void }) {
  const { t } = useI18n();
  return (
    <div className="reader-context-menu reader-highlight-menu" role="menu" aria-label={t('reader.highlight.menu')} style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
      <div className="reader-color-row" role="group" aria-label={t('reader.highlight.color')}>
        {readerHighlightColors.map((color) => (
          <button className={`reader-color-dot color-${color}${(menu.highlight.color ?? 'yellow') === color ? ' active' : ''}`} type="button" key={color} aria-label={t(`reader.highlight.color.${color}`)} aria-pressed={(menu.highlight.color ?? 'yellow') === color} onClick={() => {
            if (menu.highlight.id) onUpdateHighlightColor(menu.highlight.id, color);
            onDefaultHighlightColorChange(color);
            setHighlightMenu(null);
          }} />
        ))}
      </div>
      <button role="menuitem" type="button" onClick={() => {
        jumpToParagraph(menu.highlight.chapterIndex, menu.highlight.paragraphIndex, menu.highlight.startOffset);
        setHighlightMenu(null);
      }}>{t('reader.highlight.jump')}</button>
      <button role="menuitem" type="button" onClick={() => {
        setHighlightViewer({ highlight: menu.highlight });
        setHighlightMenu(null);
      }}>{t('reader.highlight.view')}</button>
      <button role="menuitem" type="button" onClick={() => {
        const selectedHighlight = menu.highlight;
        if (!selectedHighlight.id) return;
        setTextDialog({
          x: menu.x,
          y: menu.y,
          title: t('reader.highlight.editNote'),
          value: selectedHighlight.note,
          submitLabel: t('reader.highlight.saveNote'),
          markdownEditorEnabled: annotationMarkdownEditorEnabled,
          onSubmit: (note) => onUpdateHighlightNote(selectedHighlight.id ?? '', note),
        });
        setHighlightMenu(null);
      }}>{t('reader.highlight.editNote')}</button>
      {menu.highlight.note ? <button role="menuitem" type="button" onClick={() => { if (menu.highlight.id) onClearHighlightNote(menu.highlight.id); setHighlightMenu(null); }}>{t('reader.highlight.clearNote')}</button> : null}
      <button role="menuitem" type="button" onClick={() => { deleteHighlightWithUndo(menu.highlight); setHighlightMenu(null); }}>{t('reader.highlight.delete')}</button>
    </div>
  );
}

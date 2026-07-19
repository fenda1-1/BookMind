import { useRef, useState } from 'react';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n } from '../../i18n';
import type { ReaderBookmark, ReaderHighlightColor } from '../../types';
import { formatReaderTagInput, parseReaderTagInput, readerHighlightColors } from './readerInteractionModel';
import type { ReaderHighlightRange } from './readerModel';

export type ReaderTextDialogRequest = {
  x: number;
  y: number;
  title: string;
  value: string;
  submitLabel: string;
  markdownEditorEnabled?: boolean;
  onSubmit: (value: string) => void;
};

export type ReaderHighlightViewRequest = {
  highlight: ReaderHighlightRange;
};

type ReaderHighlightDetailsUpdate = {
  tags?: string[];
  importance?: 'normal' | 'high' | 'critical';
  reviewStatus?: 'new' | 'due' | 'reviewed';
  colorMeaning?: string;
  updatedAt?: string;
};

export function ReaderBookmarkDrawer({ bookmark, chapterTitle, tagSuggestions, markdownEditorEnabled, onUpdateBookmark, onDeleteBookmark, onJumpBookmark, onClose }: { bookmark: ReaderBookmark; chapterTitle: string; tagSuggestions: string[]; markdownEditorEnabled: boolean; onUpdateBookmark: (id: string, updates: { title?: string; note?: string; color?: ReaderHighlightColor; tags?: string[]; updatedAt?: string }) => void; onDeleteBookmark: (id: string) => void; onJumpBookmark: (bookmark: ReaderBookmark) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(bookmark.title || bookmark.label);
  const [note, setNote] = useState(bookmark.note ?? '');
  const [tags, setTags] = useState((bookmark.tags ?? []).join(', '));
  const [color, setColor] = useState<ReaderHighlightColor>(bookmark.color ?? 'red');
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const context = `${chapterTitle || bookmark.label} · ${bookmark.chapterIndex + 1}:${bookmark.paragraphIndex + 1} · ${bookmark.screenPage + 1}`;
  return (
    <aside className="reader-bookmark-drawer" role="dialog" aria-modal="false" aria-label={t('reader.bookmarks.panel')} onClick={(event) => event.stopPropagation()} onWheelCapture={(event) => { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); }} onWheel={(event) => event.stopPropagation()}>
      <div className="reader-highlight-drawer-head">
        <div>
          <p className="eyebrow">{t('reader.bookmarks.panel')}</p>
          <h3>{title || bookmark.label}</h3>
        </div>
        <button className="ghost-btn small" type="button" onClick={onClose} aria-label={t('common.cancel')}>×</button>
      </div>
      <div className="reader-highlight-drawer-body">
        <small>{context}</small>
        <label className="reader-highlight-note-editor">
          <span>{t('reader.bookmark.title')}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="reader-highlight-note-editor">
          <span>{t('reader.bookmark.note')}</span>
          <textarea ref={noteTextareaRef} value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
        </label>
        {markdownEditorEnabled ? <MarkdownNoteEditor value={note} onChange={setNote} textareaRef={noteTextareaRef} /> : null}
        <label className="reader-highlight-note-editor">
          <span>{t('reader.bookmark.tags')}</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} />
        </label>
        <ReaderTagSuggestions suggestions={tagSuggestions} value={tags} onChange={setTags} />
        <div className="reader-color-row" role="group" aria-label={t('reader.highlight.color')}>
          {readerHighlightColors.map((item) => (
            <button className={`reader-color-dot color-${item}${color === item ? ' active' : ''}`} type="button" key={item} aria-label={t(`reader.highlight.color.${item}`)} aria-pressed={color === item} onClick={() => setColor(item)} />
          ))}
        </div>
      </div>
      <div className="reader-highlight-drawer-actions">
        <button className="ghost-btn small" type="button" onClick={() => onDeleteBookmark(bookmark.id)}>{t('reader.bookmark.delete')}</button>
        <button className="ghost-btn small" type="button" onClick={() => onUpdateBookmark(bookmark.id, { title, note, color, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), updatedAt: new Date().toISOString() })}>{t('reader.highlight.saveNote')}</button>
        <button className="primary-btn small" type="button" onClick={() => onJumpBookmark(bookmark)}>{t('reader.highlight.jump')}</button>
      </div>
    </aside>
  );
}

export function ReaderHighlightDrawer({ request, tagSuggestions, markdownEditorEnabled, colorMeaningPlaceholder, onJump, onUpdateColor, onUpdateNote, onUpdateDetails, onDelete, onClose }: { request: ReaderHighlightViewRequest; tagSuggestions: string[]; markdownEditorEnabled: boolean; colorMeaningPlaceholder: string; onJump: (highlight: ReaderHighlightRange) => void; onUpdateColor: (highlight: ReaderHighlightRange, color: ReaderHighlightColor) => void; onUpdateNote: (highlight: ReaderHighlightRange, note: string) => void; onUpdateDetails: (highlight: ReaderHighlightRange, updates: ReaderHighlightDetailsUpdate) => void; onDelete: (highlight: ReaderHighlightRange) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [note, setNote] = useState(request.highlight.note);
  const [highlightTags, setHighlightTags] = useState((request.highlight.tags ?? []).join(', '));
  const [highlightImportance, setHighlightImportance] = useState<'normal' | 'high' | 'critical'>(request.highlight.importance ?? 'normal');
  const [highlightReviewStatus, setHighlightReviewStatus] = useState<'new' | 'due' | 'reviewed'>(request.highlight.reviewStatus ?? 'new');
  const [highlightColorMeaning, setHighlightColorMeaning] = useState(request.highlight.colorMeaning ?? '');
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const copyHighlight = () => {
    void navigator.clipboard.writeText([request.highlight.text, note].filter(Boolean).join('\n\n'));
  };
  const exportHighlight = () => {
    const context = `${request.highlight.prefixText ?? ''}[${request.highlight.text}]${request.highlight.suffixText ?? ''}`;
    const payload = `> ${request.highlight.text}\n\n${note ? `${note}\n\n` : ''}${context.trim() ? `Context: ${context}\n` : ''}Location: reader://${request.highlight.chapterIndex}/${request.highlight.paragraphIndex}?start=${request.highlight.startOffset}&end=${request.highlight.endOffset}\n`;
    const blob = new Blob([payload], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reader-highlight-${request.highlight.id ?? 'selection'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <aside className="reader-highlight-drawer" role="dialog" aria-modal="false" aria-label={t('reader.highlight.view')} onClick={(event) => event.stopPropagation()} onWheelCapture={(event) => { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); }} onWheel={(event) => event.stopPropagation()}>
      <div className="reader-highlight-drawer-head">
        <div>
          <p className="eyebrow">{request.highlight.note ? t('reader.highlight.annotated') : t('reader.highlight.marked')}</p>
          <h3>{t('reader.highlight.view')}</h3>
        </div>
        <button className="ghost-btn small" type="button" onClick={onClose} aria-label={t('common.cancel')}>×</button>
      </div>
      <div className="reader-highlight-drawer-body">
        <p>{request.highlight.text}</p>
        {request.highlight.prefixText || request.highlight.suffixText ? <small>{request.highlight.prefixText}<mark>{request.highlight.text}</mark>{request.highlight.suffixText}</small> : null}
        <div className="reader-color-row" role="group" aria-label={t('reader.highlight.color')}>
          {readerHighlightColors.map((color) => (
            <button className={`reader-color-dot color-${color}${(request.highlight.color ?? 'yellow') === color ? ' active' : ''}`} type="button" key={color} aria-label={t(`reader.highlight.color.${color}`)} aria-pressed={(request.highlight.color ?? 'yellow') === color} onClick={() => onUpdateColor(request.highlight, color)} />
          ))}
        </div>
        <label className="reader-highlight-note-editor">
          <span>{t('reader.highlight.editNote')}</span>
          <textarea ref={noteTextareaRef} value={note} onChange={(event) => setNote(event.target.value)} rows={5} />
        </label>
        {markdownEditorEnabled ? <MarkdownNoteEditor value={note} onChange={setNote} textareaRef={noteTextareaRef} /> : null}
        <label className="reader-highlight-note-editor">
          <span>{t('reader.highlight.tags')}</span>
          <input value={highlightTags} onChange={(event) => setHighlightTags(event.target.value)} />
        </label>
        <ReaderTagSuggestions suggestions={tagSuggestions} value={highlightTags} onChange={setHighlightTags} />
        <div className="reader-highlight-controls">
          <ThemedSelect
            label={t('reader.highlight.importance')}
            value={highlightImportance}
            options={[
              { value: 'normal', label: t('reader.highlight.importanceNormal') },
              { value: 'high', label: t('reader.highlight.importanceHigh') },
              { value: 'critical', label: t('reader.highlight.importanceCritical') },
            ]}
            onChange={setHighlightImportance}
            className="reader-compact-select"
            ariaLabel={t('reader.highlight.importance')}
          />
          <ThemedSelect
            label={t('reader.highlight.reviewStatus')}
            value={highlightReviewStatus}
            options={[
              { value: 'new', label: t('reader.highlight.reviewNew') },
              { value: 'due', label: t('reader.highlight.reviewDue') },
              { value: 'reviewed', label: t('reader.highlight.reviewed') },
            ]}
            onChange={setHighlightReviewStatus}
            className="reader-compact-select"
            ariaLabel={t('reader.highlight.reviewStatus')}
          />
        </div>
        <label className="reader-highlight-note-editor">
          <span>{t('reader.highlight.colorMeaning')}</span>
          <input value={highlightColorMeaning} placeholder={colorMeaningPlaceholder || t('reader.highlight.colorMeaning')} onChange={(event) => setHighlightColorMeaning(event.target.value)} />
        </label>
      </div>
      <div className="reader-highlight-drawer-actions">
        <button className="ghost-btn small" type="button" onClick={copyHighlight}>{t('reader.highlight.copy')}</button>
        <button className="ghost-btn small" type="button" onClick={exportHighlight}>{t('reader.highlight.exportOne')}</button>
        <button className="ghost-btn small" type="button" onClick={() => { onUpdateNote(request.highlight, note); onUpdateDetails(request.highlight, { tags: highlightTags.split(',').map((tag: string) => tag.trim()).filter(Boolean), importance: highlightImportance, reviewStatus: highlightReviewStatus, colorMeaning: highlightColorMeaning.trim(), updatedAt: new Date().toISOString() }); }}>{t('reader.highlight.saveNote')}</button>
        <button className="ghost-btn small" type="button" onClick={() => onDelete(request.highlight)}>{t('reader.highlight.delete')}</button>
        <button className="primary-btn small" type="button" onClick={() => onJump(request.highlight)}>{t('reader.highlight.jump')}</button>
      </div>
    </aside>
  );
}

export function ReaderTextDialog({ request, onClose }: { request: ReaderTextDialogRequest; onClose: () => void }) {
  const [value, setValue] = useState(request.value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <form
      className="reader-text-dialog"
      role="dialog"
      aria-modal="false"
      aria-label={request.title}
      style={{ left: request.x, top: request.y }}
      onClick={(event) => event.stopPropagation()}
      onWheelCapture={(event) => { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); }}
      onSubmit={(event) => {
        event.preventDefault();
        request.onSubmit(value);
        onClose();
      }}
    >
      <label>
        <span>{request.title}</span>
        <textarea ref={textareaRef} value={value} onChange={(event) => setValue(event.target.value)} autoFocus rows={4} />
      </label>
      {request.markdownEditorEnabled ? <MarkdownNoteEditor value={value} onChange={setValue} textareaRef={textareaRef} /> : null}
      <div className="action-row">
        <button className="primary-btn small" type="submit">{request.submitLabel}</button>
        <button className="ghost-btn small" type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
    </form>
  );
}

function ReaderTagSuggestions({ suggestions, value, onChange }: { suggestions: string[]; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const current = new Set(parseReaderTagInput(value));
  const visible = suggestions.filter((tag) => !current.has(tag)).slice(0, 12);
  if (!visible.length) return null;
  return (
    <div className="reader-highlight-tools" role="group" aria-label={t('reader.annotation.tagSuggestions')}>
      {visible.map((tag) => (
        <button className="ghost-btn small" type="button" key={tag} onClick={() => onChange(formatReaderTagInput([...current, tag]))}>
          <span>{tag}</span>
          <small>{t('reader.annotation.addTag')}</small>
        </button>
      ))}
    </div>
  );
}

function MarkdownNoteEditor({ value, onChange, textareaRef }: { value: string; onChange: (value: string) => void; textareaRef: { current: HTMLTextAreaElement | null } }) {
  const { t } = useI18n();
  const actions = [
    { label: 'B', wrap: '**', suffix: '**' },
    { label: 'I', wrap: '*', suffix: '*' },
    { label: 'H2', prefix: '## ' },
    { label: 'Quote', prefix: '> ' },
    { label: 'List', prefix: '- ' },
  ];

  function applyAction(action: { prefix?: string; wrap?: string; suffix?: string }) {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const before = value.slice(0, selectionStart);
    const selectedText = value.slice(selectionStart, selectionEnd);
    const after = value.slice(selectionEnd);
    const replacement = action.prefix
      ? selectedText ? selectedText.split('\n').map((line) => `${action.prefix}${line}`).join('\n') : action.prefix
      : `${action.wrap ?? ''}${selectedText || t('reader.annotation.markdownPlaceholder')}${action.suffix ?? ''}`;
    const nextValue = `${before}${replacement}${after}`;
    const nextSelectionStart = action.prefix || selectedText ? selectionStart : selectionStart + (action.wrap ?? '').length;
    const nextSelectionEnd = action.prefix || selectedText ? selectionStart + replacement.length : nextSelectionStart + t('reader.annotation.markdownPlaceholder').length;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  }

  return (
    <div className="reader-highlight-tools" role="group" aria-label={t('reader.annotation.markdownEditor')}>
      {actions.map((action) => (
        <button className="ghost-btn small" type="button" key={action.label} onClick={() => applyAction(action)}>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

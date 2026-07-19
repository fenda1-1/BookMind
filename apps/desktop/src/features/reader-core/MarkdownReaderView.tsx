import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, MutableRefObject, ReactNode } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Book } from '../../types';
import { useI18n } from '../../i18n';
import { BookMindIcon } from '../../components/BookMindIcon';
import { openExternalUrl } from '../../services/externalUrlService';
import { loadReaderDocument } from '../../services/libraryService';
import { buildMarkdownReaderDocument, type MarkdownInlineSegment, type MarkdownReaderBlock, type MarkdownTocItem } from './markdownReaderModel';

type MarkdownReaderViewProps = {
  book: Book;
  onProgressChange?: (progress: number, detail?: { pageCount: number; pageCurrent: number; chapterTitle: string; timestamp: string; minutesRead?: number }) => void;
};

type MarkdownTocTreeItem = MarkdownTocItem & {
  children: MarkdownTocTreeItem[];
};

export function MarkdownReaderView({ book, onProgressChange }: MarkdownReaderViewProps) {
  const { t } = useI18n();
  const [source, setSource] = useState(book.content ?? '');
  const [loading, setLoading] = useState(!book.content);
  const [error, setError] = useState('');
  const [tocOpen, setTocOpen] = useState(true);
  const [collapsedTocIds, setCollapsedTocIds] = useState<Set<string>>(() => new Set());
  const headingRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (book.content) {
      setSource(book.content);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadReaderDocument(book.id).then((document) => {
      if (cancelled) return;
      setSource(document.content ?? '');
      setLoading(false);
    }).catch((loadError) => {
      if (cancelled) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id, book.content]);

  const markdownDocument = useMemo(() => buildMarkdownReaderDocument(source), [source]);
  const tocTree = useMemo(() => buildMarkdownTocTree(markdownDocument.toc), [markdownDocument.toc]);
  const displayTitle = book.displayTitle || book.title;

  useEffect(() => {
    setCollapsedTocIds((current) => {
      const availableIds = new Set(markdownDocument.toc.map((item) => item.id));
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [markdownDocument.toc]);

  function jumpToHeading(id: string) {
    headingRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function reportMarkdownProgress() {
    const scroll = scrollRef.current;
    const scrollable = scroll ? Math.max(0, scroll.scrollHeight - scroll.clientHeight) : 0;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scroll!.scrollTop / scrollable)) : 0;
    const pageCount = 100;
    const pageCurrent = Math.min(pageCount, Math.max(1, Math.round(ratio * (pageCount - 1)) + 1));
    const progress = Math.min(100, Math.max(1, Math.round((pageCurrent / pageCount) * 100)));
    const nearestHeading = findNearestMarkdownHeading(headingRefs.current, scroll?.scrollTop ?? 0);
    onProgressChange?.(progress, {
      pageCount,
      pageCurrent,
      chapterTitle: nearestHeading || displayTitle,
      timestamp: new Date().toISOString(),
    });
  }

  function handleMarkdownLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    const normalizedHref = href.trim();
    if (!normalizedHref) return;
    if (normalizedHref.startsWith('#')) {
      event.preventDefault();
      const targetId = decodeURIComponent(normalizedHref.slice(1));
      jumpToHeading(targetId);
      return;
    }
    if (/^(https?:|mailto:)/iu.test(normalizedHref)) {
      event.preventDefault();
      void openExternalUrl(normalizedHref);
    }
  }

  useEffect(() => {
    if (loading || error) return;
    window.requestAnimationFrame(reportMarkdownProgress);
  }, [loading, error, markdownDocument.blocks.length, onProgressChange]);

  return (
    <article className="reader-canvas markdown-reader-canvas" aria-label={t('reader.external.markdown.aria')}>
      <header className="markdown-reader-header">
        <div>
          <p className="eyebrow">Markdown</p>
          <h2>{displayTitle}</h2>
        </div>
        <div className="markdown-reader-header-actions">
          <button
            type="button"
            className={tocOpen ? 'reader-icon-btn active' : 'reader-icon-btn'}
            data-tooltip={tocOpen ? t('reader.external.toc.hide') : t('reader.external.toc.show')}
            aria-label={tocOpen ? t('reader.external.toc.hide') : t('reader.external.toc.show')}
            aria-pressed={tocOpen}
            onClick={() => setTocOpen((current) => !current)}
          >
            <BookMindIcon name="toc" />
          </button>
          <p className="markdown-reader-hint">{loading ? t('reader.external.markdown.loading') : t('reader.external.markdown.headingCount', { count: markdownDocument.toc.length, fileName: book.fileName })}</p>
        </div>
      </header>
      {error ? <div className="pdf-reader-error" role="alert">{error}</div> : null}
      <div className={tocOpen ? 'markdown-reader-body toc-open' : 'markdown-reader-body'}>
        {tocOpen ? (
          <aside className="markdown-reader-toc" aria-label={t('reader.external.markdown.tocAria')}>
            <div className="markdown-reader-toc-head">
              <strong>{t('reader.external.toc.title')}</strong>
            </div>
            <div className="markdown-reader-toc-list">
              {tocTree.length ? tocTree.map((item) => renderMarkdownTocItem(item, collapsedTocIds, setCollapsedTocIds, jumpToHeading)) : <p>{t('reader.external.markdown.emptyToc')}</p>}
            </div>
          </aside>
        ) : null}
        <div className="markdown-reader-frame">
          <div className="markdown-reader-scroll" ref={scrollRef} onScroll={reportMarkdownProgress}>
            {loading ? <div className="pdf-reader-empty">{t('reader.external.markdown.loading')}</div> : null}
            {!loading && !error ? (
              <div className="markdown-reader-document">
                {markdownDocument.blocks.map((block, index) => renderMarkdownBlock(block, index, headingRefs, t, handleMarkdownLinkClick, book))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function findNearestMarkdownHeading(headings: Record<string, HTMLElement | null>, scrollTop: number) {
  let nearestTitle = '';
  let nearestOffset = Number.NEGATIVE_INFINITY;
  for (const element of Object.values(headings)) {
    if (!element) continue;
    const offset = element.offsetTop;
    if (offset <= scrollTop + 160 && offset >= nearestOffset) {
      nearestOffset = offset;
      nearestTitle = element.textContent?.trim() ?? '';
    }
  }
  return nearestTitle;
}

function buildMarkdownTocTree(items: MarkdownTocItem[]) {
  const roots: MarkdownTocTreeItem[] = [];
  const stack: MarkdownTocTreeItem[] = [];
  for (const item of items) {
    const node: MarkdownTocTreeItem = { ...item, children: [] };
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }
  return roots;
}

function renderMarkdownTocItem(item: MarkdownTocTreeItem, collapsedTocIds: Set<string>, setCollapsedTocIds: (updater: (current: Set<string>) => Set<string>) => void, jumpToHeading: (id: string) => void): ReactNode {
  const collapsed = collapsedTocIds.has(item.id);
  const hasChildren = item.children.length > 0;
  return (
    <div key={item.id} className="markdown-reader-toc-node">
      <div className="markdown-reader-toc-row" style={{ '--markdown-toc-level': item.level - 1 } as CSSProperties}>
        {hasChildren ? (
          <button
            type="button"
            className="markdown-reader-toc-toggle"
            aria-expanded={!collapsed}
            onClick={() => {
              setCollapsedTocIds((current) => {
                const next = new Set(current);
                if (next.has(item.id)) {
                  next.delete(item.id);
                } else {
                  next.add(item.id);
                }
                return next;
              });
            }}
          >
            <span>{collapsed ? '▸' : '▾'}</span>
          </button>
        ) : <span className="markdown-reader-toc-spacer" />}
        <button type="button" className="markdown-reader-toc-link" onClick={() => jumpToHeading(item.id)}>
          <span>{item.title}</span>
        </button>
      </div>
      {hasChildren && !collapsed ? (
        <div className="markdown-reader-toc-children">
          {item.children.map((child) => renderMarkdownTocItem(child, collapsedTocIds, setCollapsedTocIds, jumpToHeading))}
        </div>
      ) : null}
    </div>
  );
}

function renderMarkdownBlock(block: MarkdownReaderBlock, index: number, headingRefs: MutableRefObject<Record<string, HTMLElement | null>>, t: ReturnType<typeof useI18n>['t'], onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void, book: Book) {
  switch (block.type) {
    case 'heading':
      return renderMarkdownHeading(block, headingRefs, onLinkClick, book);
    case 'paragraph':
      return <p key={`${block.lineIndex}:${index}`}>{renderInlineSegments(block.segments, onLinkClick, book)}</p>;
    case 'code':
      return <pre key={`${block.lineIndex}:${index}`} className="markdown-block-code"><code data-language={block.language}>{block.code}</code></pre>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={`${block.lineIndex}:${index}`} className={block.task ? 'markdown-task-list' : undefined}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} className={typeof item.checked === 'boolean' ? 'markdown-task-item' : undefined}>
              {typeof item.checked === 'boolean' ? <input className="markdown-task-checkbox" type="checkbox" checked={item.checked} readOnly aria-label={item.checked ? t('reader.external.markdown.taskDone') : t('reader.external.markdown.taskTodo')} /> : null}
              <span>{renderInlineSegments(item.segments, onLinkClick, book)}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return renderMarkdownTable(block, index, onLinkClick, book);
    case 'blockquote':
      return <blockquote key={`${block.lineIndex}:${index}`}>{renderInlineSegments(block.segments, onLinkClick, book)}</blockquote>;
    case 'divider':
      return <hr key={`${block.lineIndex}:${index}`} />;
    default:
      return null;
  }
}

function renderMarkdownTable(block: Extract<MarkdownReaderBlock, { type: 'table' }>, index: number, onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void, book: Book) {
  return (
    <div key={`${block.lineIndex}:${index}`} className="markdown-reader-table-wrap">
      <table className="markdown-reader-table">
        <thead>
          <tr>
            {block.headers.map((cell, cellIndex) => <th key={cellIndex} className={`align-${block.alignments[cellIndex]}`}>{renderInlineSegments(cell, onLinkClick, book)}</th>)}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex} className={`align-${block.alignments[cellIndex]}`}>{renderInlineSegments(cell, onLinkClick, book)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderMarkdownHeading(block: Extract<MarkdownReaderBlock, { type: 'heading' }>, headingRefs: MutableRefObject<Record<string, HTMLElement | null>>, onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void, book: Book) {
  const ref = (element: HTMLHeadingElement | null) => {
    headingRefs.current[block.id] = element;
  };
  const className = 'markdown-reader-heading';
  if (block.level === 1) return <h1 key={block.id} id={block.id} ref={ref} className={className}>{renderInlineSegments(block.segments, onLinkClick, book)}</h1>;
  if (block.level === 2) return <h2 key={block.id} id={block.id} ref={ref} className={className}>{renderInlineSegments(block.segments, onLinkClick, book)}</h2>;
  if (block.level === 3) return <h3 key={block.id} id={block.id} ref={ref} className={className}>{renderInlineSegments(block.segments, onLinkClick, book)}</h3>;
  if (block.level === 4) return <h4 key={block.id} id={block.id} ref={ref} className={className}>{renderInlineSegments(block.segments, onLinkClick, book)}</h4>;
  if (block.level === 5) return <h5 key={block.id} id={block.id} ref={ref} className={className}>{renderInlineSegments(block.segments, onLinkClick, book)}</h5>;
  return <h6 key={block.id} id={block.id} ref={ref} className={className}>{renderInlineSegments(block.segments, onLinkClick, book)}</h6>;
}

function renderInlineSegments(segments: MarkdownInlineSegment[], onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void, book: Book): ReactNode {
  return segments.map((segment, index) => {
    switch (segment.kind) {
      case 'strong':
        return <strong key={index}>{segment.text}</strong>;
      case 'emphasis':
        return <em key={index}>{segment.text}</em>;
      case 'code':
        return <code key={index} className="markdown-inline-code">{segment.text}</code>;
      case 'link':
        return renderSafeMarkdownLink(segment, index, onLinkClick, book);
      case 'image':
        return <img key={index} className="markdown-inline-image" src={resolveMarkdownImageSrc(segment.src, book)} alt={segment.alt} title={segment.title} style={getMarkdownImageStyle(segment)} loading="lazy" draggable={false} />;
      case 'break':
        return <br key={index} />;
      default:
        return <span key={index}>{segment.text}</span>;
    }
  });
}

function renderSafeMarkdownLink(segment: Extract<MarkdownInlineSegment, { kind: 'link' }>, key: number, onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void, book: Book) {
  const href = segment.href.trim();
  if (/^(https?:|mailto:|#)/iu.test(href)) {
    return <a key={key} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noreferrer" onClick={(event) => onLinkClick(event, segment.href)}>{renderInlineSegments(segment.segments, onLinkClick, book)}</a>;
  }
  return <span key={key}>{segment.text}</span>;
}

function resolveMarkdownImageSrc(src: string, book: Book) {
  if (/^(?:https?|data|blob|asset):/iu.test(src)) return src;
  const localPath = isAbsoluteLocalPath(src) ? src : resolveRelativeMarkdownAssetPath(src, book.sourceFilePath || book.filePath);
  try {
    return convertFileSrc(localPath);
  } catch {
    return src;
  }
}

function resolveRelativeMarkdownAssetPath(src: string, baseFilePath: string) {
  if (!baseFilePath) return src;
  const separator = baseFilePath.includes('\\') ? '\\' : '/';
  const lastSlash = Math.max(baseFilePath.lastIndexOf('/'), baseFilePath.lastIndexOf('\\'));
  const baseDir = lastSlash >= 0 ? baseFilePath.slice(0, lastSlash) : '';
  const parts = `${baseDir}${separator}${src}`.split(/[\\/]+/u);
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      const last = normalized[normalized.length - 1];
      if (last && !last.endsWith(':')) normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  if (/^[a-zA-Z]:$/u.test(normalized[0] ?? '')) {
    return `${normalized[0]}${separator}${normalized.slice(1).join(separator)}`;
  }
  return normalized.join(separator);
}

function isAbsoluteLocalPath(src: string) {
  return /^[a-zA-Z]:[\\/]/u.test(src) || src.startsWith('/') || src.startsWith('\\\\');
}

function getMarkdownImageStyle(segment: Extract<MarkdownInlineSegment, { kind: 'image' }>): CSSProperties | undefined {
  const width = sanitizeMarkdownImageSize(segment.width);
  const height = sanitizeMarkdownImageSize(segment.height);
  if (!width && !height) return undefined;
  return { width, height };
}

function sanitizeMarkdownImageSize(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (/^\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)$/u.test(normalized)) return normalized;
  if (/^\d+(?:\.\d+)?$/u.test(normalized)) return `${normalized}px`;
  return undefined;
}

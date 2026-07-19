import { useEffect, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { isTauriRuntime } from '../../app/platform';
import { useI18n, type TranslationKey } from '../../i18n';
import { renderBlockPlainText, type AiProtocolCitation, type BookMindAiStructuredResponse } from '../../services/aiResponseProtocol';
import { recordOperationLog } from '../../services/operationLogService';
import { writeReaderBinaryFile } from '../../services/readerExportService';
import { emitFlashcardsUpdated } from '../../services/appDomainEvents';
import { emitAiAction } from './aiReaderDomainEvents';
import {
  AiProtocolBlock,
  InlineMarkdownText,
  ProtocolCitationCard,
  StructuredReplyFoldSections,
  buildParagraphWindowToolCall,
  dispatchParagraphWindowToolCall,
  renderToolRail,
} from './AiStructuredSectionRenderers';
import type { AiStructuredFlashcardDefaults } from './AiStructuredSectionRenderers';

export type { AiStructuredFlashcardDefaults } from './AiStructuredSectionRenderers';
export { protocolCitationToKnowledgeCitation } from './AiStructuredSectionRenderers';
export function StructuredAnswerView({
  response,
  rawAnswer,
  renderedBlockLimit,
  defaultCitationDensity,
  externalCitationsDisabled,
  citationJumpRepairEnabled,
  citationFieldStrictness,
  toolCallDisplayMode,
  flashcardDefaults,
  onSaveProtocolDefault,
  onSaveProtocolHighlight,
  onSaveProtocolExcerpt
}: {
  response: BookMindAiStructuredResponse;
  rawAnswer: string;
  renderedBlockLimit: number;
  defaultCitationDensity: 'compact' | 'detailed';
  externalCitationsDisabled: boolean;
  citationJumpRepairEnabled: boolean;
  citationFieldStrictness: 'lenient' | 'normal' | 'strict';
  toolCallDisplayMode: 'hidden' | 'summary' | 'full';
  flashcardDefaults: AiStructuredFlashcardDefaults;
  onSaveProtocolDefault: (citation: AiProtocolCitation) => void;
  onSaveProtocolHighlight: (citation: AiProtocolCitation) => void;
  onSaveProtocolExcerpt: (citation: AiProtocolCitation) => void;
}) {
  const { t } = useI18n();
  const [citationDensity, setCitationDensity] = useState<'compact' | 'detailed'>(defaultCitationDensity);
  const [screenshotStatus, setScreenshotStatus] = useState('');
  const responseCardRef = useRef<HTMLDivElement | null>(null);
  const toolItems = [...response.toolCalls.map((call) => ({ kind: 'call' as const, item: call })), ...response.toolResults.map((result) => ({ kind: 'result' as const, item: result }))];
  const safeRenderedBlockLimit = renderedBlockLimit;
  const visibleBlocks = response.blocks.slice(0, safeRenderedBlockLimit);
  const hiddenBlockCount = Math.max(0, response.blocks.length - visibleBlocks.length);

  useEffect(() => {
    setCitationDensity(defaultCitationDensity);
  }, [defaultCitationDensity]);
  const safeAiActionHandlers: Record<string, () => void> = {
    save_note: () => undefined,
    save_note_preview: () => undefined,
    explain_selection_with_window: () => dispatchParagraphWindowToolCall(buildParagraphWindowToolCall('selection_explanation')),
    create_annotation_preview: () => dispatchParagraphWindowToolCall(buildParagraphWindowToolCall('annotation_preview')),
    create_flashcards_preview: emitFlashcardsUpdated,
    link_character_relationships_preview: () => undefined,
    run_parse_index: () => emitAiAction({ action: 'run_parse_index' }),
  };

  function runSafeAction(action?: string) {
    if (!action || !safeAiActionHandlers[action]) return;
    safeAiActionHandlers[action]();
  }

  return (
    <div className="ai-structured-response">
      <div className="ai-response-card-actions">
        <button type="button" onClick={() => copyRawAiAnswer(rawAnswer)}>{t('ai.structured.copyRaw')}</button>
        <button type="button" onClick={() => { recordOperationLog('basic', 'ui.click.saveAiResponseScreenshot'); void saveStructuredAnswerScreenshot(responseCardRef.current, setScreenshotStatus, t); }}>{t('ai.structured.saveScreenshot')}</button>
        {screenshotStatus ? <span>{screenshotStatus}</span> : null}
      </div>
      <div className="ai-structured-response-capture" ref={responseCardRef}>
        <div className="ai-report-head">
          <strong>{response.title ?? t('ai.structured.answer')}</strong>
          {response.summary ? <AgentAnswerSummaryPreview summary={response.summary} fullText={buildFullAgentAnswerText(response, rawAnswer)} /> : null}
          {response.parseError ? <em>{t('ai.structured.parseError')}</em> : null}
        </div>
        {renderToolRail(toolItems, toolCallDisplayMode)}
        <StructuredReplyFoldSections response={response} />
        <div className="ai-block-stack">
          {visibleBlocks.map((block) => (
            <AiProtocolBlock block={block} citations={response.citations} flashcardDefaults={flashcardDefaults} runSafeAction={runSafeAction} key={block.id} />
          ))}
        </div>
        {hiddenBlockCount > 0 ? <p className="ai-render-limit-notice">{t('ai.structured.renderLimit', { shown: visibleBlocks.length, hidden: hiddenBlockCount })}</p> : null}
        {response.citations.length ? (
          <div className={`ai-protocol-citations density-${citationDensity}`}>
            <div className="ai-citation-density-toggle" role="group" aria-label={t('ai.structured.citationDensity')}>
              <button type="button" className={citationDensity === 'compact' ? 'active' : ''} aria-pressed={citationDensity === 'compact'} onClick={() => setCitationDensity('compact')}>{t('ai.structured.compact')}</button>
              <button type="button" className={citationDensity === 'detailed' ? 'active' : ''} aria-pressed={citationDensity === 'detailed'} onClick={() => setCitationDensity('detailed')}>{t('ai.structured.detailed')}</button>
            </div>
            <div className="ai-protocol-citation-list">
              {response.citations.map((citation) => (
                <ProtocolCitationCard citation={citation} externalCitationsDisabled={externalCitationsDisabled} citationJumpRepairEnabled={citationJumpRepairEnabled} citationFieldStrictness={citationFieldStrictness} onSaveProtocolDefault={onSaveProtocolDefault} onSaveProtocolHighlight={onSaveProtocolHighlight} onSaveProtocolExcerpt={onSaveProtocolExcerpt} key={citation.id} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AgentAnswerSummaryPreview({ summary, fullText }: { summary: string; fullText: string }) {
  const { t } = useI18n();
  const isLong = summary.length > 180;
  const hasFullText = fullText.trim() && fullText.trim() !== summary.trim();
  return (
    <div className="ai-agent-answer-preview">
      <p><InlineMarkdownText text={isLong ? `${summary.slice(0, 180)}...` : summary} /></p>
      {isLong || hasFullText ? (
        <details className="ai-agent-answer-full">
          <summary>{t('ai.structured.viewFull')}</summary>
          <pre>{hasFullText ? fullText : summary}</pre>
        </details>
      ) : null}
    </div>
  );
}

function buildFullAgentAnswerText(response: BookMindAiStructuredResponse, rawAnswer: string) {
  if (rawAnswer.trim()) return rawAnswer.trim();
  const blockText = response.blocks
    .filter((block) => block.type !== 'agent_timeline' && block.type !== 'diagnostics')
    .map((block) => renderBlockPlainText(block))
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n\n');
  if (blockText) return blockText;
  return response.summary?.trim() ?? '';
}

function copyRawAiAnswer(rawAnswer: string) {
  void navigator.clipboard?.writeText(rawAnswer);
  recordOperationLog('basic', 'ai.copyRawAnswer', { chars: rawAnswer.length });
}

async function saveStructuredAnswerScreenshot(target: HTMLElement | null, setStatus: (status: string) => void, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  if (!target) return;
  setStatus(t('ai.structured.screenshotGenerating'));
  recordOperationLog('basic', 'ai.screenshot.start');
  await document.fonts?.ready;
  const rect = target.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const cloned = cloneRenderedElementForScreenshot(target, width, height);
  const serializedNode = new XMLSerializer().serializeToString(cloned);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serializedNode}</foreignObject></svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const blob = await renderElementScreenshotBlob(image, url, target, width, height);
    if (!blob) throw new Error(t('ai.structured.screenshotGenerationFailed'));
    const filename = `bookmind-ai-response-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const saved = await saveScreenshotBlob(blob, filename, t);
    setStatus(saved ? t('ai.structured.screenshotSaved') : t('ai.structured.screenshotCancelled'));
    recordOperationLog(saved ? 'basic' : 'debug', saved ? 'ai.screenshot.saved' : 'ai.screenshot.cancelled', { filename, bytes: blob.size });
  } catch (error) {
    console.warn('Failed to save AI response screenshot:', error);
    setStatus(t('ai.structured.screenshotSaveFailed'));
    recordOperationLog('error', 'ai.screenshot.failed', { message: error instanceof Error ? error.message : String(error) });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cloneRenderedElementForScreenshot(target: HTMLElement, width: number, height: number) {
  const cloned = target.cloneNode(true) as HTMLElement;
  inlineRenderedStyles(target, cloned);
  cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  cloned.style.width = `${width}px`;
  cloned.style.minHeight = `${height}px`;
  cloned.style.height = `${height}px`;
  cloned.style.boxSizing = 'border-box';
  cloned.style.background = normalizeComputedBackground(getComputedStyle(target).backgroundColor);
  cloned.style.overflow = 'visible';
  cloned.querySelectorAll('details:not([open])').forEach((item) => {
    if (item instanceof HTMLDetailsElement) item.open = false;
  });
  return cloned;
}

function inlineRenderedStyles(source: Element, clone: Element) {
  if (source instanceof HTMLElement && clone instanceof HTMLElement) {
    copyComputedStyle(source, clone);
  }
  if (source instanceof SVGElement && clone instanceof SVGElement) {
    copyComputedStyle(source, clone);
  }
  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    const clonedChild = cloneChildren[index];
    if (clonedChild) inlineRenderedStyles(child, clonedChild);
  });
}

function copyComputedStyle(source: Element, clone: HTMLElement | SVGElement) {
  const computed = getComputedStyle(source);
  const inline = clone instanceof HTMLElement ? clone.style : clone.style;
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    const value = computed.getPropertyValue(property);
    if (!value) continue;
    inline.setProperty(property, value, computed.getPropertyPriority(property));
  }
  inline.setProperty('animation', 'none');
  inline.setProperty('transition', 'none');
  inline.setProperty('caret-color', 'transparent');
}

function normalizeComputedBackground(backgroundColor: string) {
  return !backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent'
    ? '#fffaf2'
    : backgroundColor;
}

async function renderElementScreenshotBlob(image: HTMLImageElement, url: string, target: HTMLElement, width: number, height: number) {
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('foreignObject 渲染失败'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建截图画布');
    context.fillStyle = '#fffaf2';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    const blob = await canvasToPngBlob(canvas);
    if (!blob) throw new Error('截图画布导出失败');
    return blob;
  } catch (error) {
    recordOperationLog('debug', 'ai.screenshot.foreignObjectFallback', { message: error instanceof Error ? error.message : String(error) });
    return await renderDomLayoutScreenshotBlob(target, width, height);
  }
}

async function renderDomLayoutScreenshotBlob(target: HTMLElement, width: number, height: number) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建截图画布');
  context.scale(scale, scale);
  context.fillStyle = normalizeComputedBackground(getComputedStyle(target).backgroundColor);
  context.fillRect(0, 0, width, height);
  const origin = target.getBoundingClientRect();
  paintElementBox(context, target, origin, true);
  paintTextNodes(context, target, origin);
  const blob = await canvasToPngBlob(canvas);
  if (!blob) throw new Error('布局截图画布导出失败');
  recordOperationLog('debug', 'ai.screenshot.domLayoutFallback', { width, height, bytes: blob.size });
  return blob;
}

function paintElementBox(context: CanvasRenderingContext2D, element: Element, origin: DOMRect, isRoot = false) {
  if (!(element instanceof HTMLElement)) return;
  const computed = getComputedStyle(element);
  if (computed.display === 'none' || computed.visibility === 'hidden' || Number(computed.opacity) === 0) return;
  const rect = element.getBoundingClientRect();
  const x = rect.left - origin.left;
  const y = rect.top - origin.top;
  const width = rect.width;
  const height = isRoot ? Math.max(element.scrollHeight, rect.height) : rect.height;
  if (width <= 0 || height <= 0) return;
  const background = normalizePaintColor(computed.backgroundColor);
  if (background) {
    context.save();
    context.globalAlpha = Number.isFinite(Number(computed.opacity)) ? Number(computed.opacity) : 1;
    context.fillStyle = background;
    roundedRectPath(context, x, y, width, height, parseFloat(computed.borderTopLeftRadius) || 0);
    context.fill();
    context.restore();
  }
  paintElementBorder(context, computed, x, y, width, height);
  Array.from(element.children).forEach((child) => paintElementBox(context, child, origin));
}

function paintElementBorder(context: CanvasRenderingContext2D, computed: CSSStyleDeclaration, x: number, y: number, width: number, height: number) {
  const borderWidth = parseFloat(computed.borderTopWidth) || 0;
  const borderColor = normalizePaintColor(computed.borderTopColor);
  if (!borderWidth || !borderColor) return;
  context.save();
  context.strokeStyle = borderColor;
  context.lineWidth = borderWidth;
  roundedRectPath(context, x + borderWidth / 2, y + borderWidth / 2, Math.max(0, width - borderWidth), Math.max(0, height - borderWidth), parseFloat(computed.borderTopLeftRadius) || 0);
  context.stroke();
  context.restore();
}

function paintTextNodes(context: CanvasRenderingContext2D, root: HTMLElement, origin: DOMRect) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const computed = getComputedStyle(parent);
      if (computed.display === 'none' || computed.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    paintTextNode(context, node as Text, origin, root);
    node = walker.nextNode();
  }
}

function paintTextNode(context: CanvasRenderingContext2D, node: Text, origin: DOMRect, root: HTMLElement) {
  const parent = node.parentElement;
  if (!parent) return;
  const computed = getComputedStyle(parent);
  const color = normalizePaintColor(computed.color);
  if (!color) return;
  context.save();
  context.fillStyle = color;
  context.font = buildCanvasFont(computed);
  context.textBaseline = 'alphabetic';
  const text = node.textContent ?? '';
  for (const segment of collectTextSegments(node, text, origin, root)) {
    context.fillText(segment.text, segment.x, segment.baseline);
  }
  context.restore();
}

function collectTextSegments(node: Text, text: string, origin: DOMRect, root: HTMLElement) {
  const segments: Array<{ text: string; x: number; baseline: number }> = [];
  let current: { text: string; x: number; baseline: number; right: number } | null = null;
  const parent = node.parentElement;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!char || char === '\n' || char === '\r') {
      if (current) segments.push(current);
      current = null;
      continue;
    }
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const rect = range.getBoundingClientRect();
    range.detach();
    if (rect.width <= 0 || rect.height <= 0) {
      if (/\s/u.test(char) && current) current.text += char;
      continue;
    }
    if (!parent || !isRectVisibleWithinRenderedClip(rect, parent, root)) {
      if (current) segments.push(current);
      current = null;
      continue;
    }
    const x = rect.left - origin.left;
    const baseline = rect.bottom - origin.top - Math.max(2, rect.height * 0.18);
    const sameLine = Boolean(current && Math.abs(current.baseline - baseline) < 2 && x >= current.right - 1);
    if (sameLine && current) {
      current.text += char;
      current.right = rect.right - origin.left;
    } else {
      if (current) segments.push(current);
      current = { text: char, x, baseline, right: rect.right - origin.left };
    }
  }
  if (current) segments.push(current);
  return segments;
}

function isRectVisibleWithinRenderedClip(rect: DOMRect, element: HTMLElement, root: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  if (!rectIntersects(rect, rootRect)) return false;
  let current: HTMLElement | null = element;
  while (current) {
    const computed = getComputedStyle(current);
    const clips = /(hidden|auto|scroll|clip)/u.test(`${computed.overflow} ${computed.overflowX} ${computed.overflowY}`);
    if (clips && !rectIntersects(rect, current.getBoundingClientRect())) return false;
    if (current === root) break;
    current = current.parentElement;
  }
  return true;
}

function rectIntersects(rect: DOMRect, clip: DOMRect) {
  return rect.right > clip.left && rect.left < clip.right && rect.bottom > clip.top && rect.top < clip.bottom;
}

function buildCanvasFont(computed: CSSStyleDeclaration) {
  return [
    computed.fontStyle,
    computed.fontVariant,
    computed.fontWeight,
    `${computed.fontSize}/${computed.lineHeight}`,
    computed.fontFamily,
  ].filter(Boolean).join(' ');
}

function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(Math.max(0, radius), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function normalizePaintColor(color: string) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return '';
  return color;
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

async function saveScreenshotBlob(blob: Blob, filename: string, t: (key: TranslationKey, vars?: Record<string, string | number>) => string): Promise<boolean> {
  if (!isTauriRuntime()) {
    downloadBlob(blob, filename);
    return true;
  }
  const selectedPath = await save({
    title: t('ai.structured.screenshotDialog'),
    defaultPath: filename,
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  if (!selectedPath) return false;
  await writeReaderBinaryFile(selectedPath, new Uint8Array(await blob.arrayBuffer()));
  return true;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

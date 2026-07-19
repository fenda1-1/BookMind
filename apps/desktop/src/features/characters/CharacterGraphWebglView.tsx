import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react';
import type { Translator } from '../../i18n';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { CharacterGraphModel } from './characterGraphModel';
import { buildCharacterGraphCanvasViewport, type CharacterGraphCanvasModel, type CharacterGraphCanvasViewport } from './characterGraphCanvasModel';
import { createCharacterGraphWebglRenderer, type CharacterGraphWebglRenderer } from './characterGraphWebglRenderer';
import type { CharacterGraphRenderModel } from './characterGraphRenderModel';

export function CharacterGraphWebglView({
  canvas,
  graph,
  renderModel,
  viewport,
  selectedGraphEdgeId,
  highlightedNodeIds = [],
  onSelectEdge,
  onSelectCharacter,
  onFocusSearch,
  onRestoreFullGraph,
  fullscreen,
  onToggleFullscreen,
  onViewportChange,
  viewportInitialized,
  resetSignal,
  privacySettings,
  t,
  formatEdgeLabel,
  fallbackView,
}: {
  canvas: CharacterGraphCanvasModel;
  graph: CharacterGraphModel;
  renderModel: CharacterGraphRenderModel;
  viewport: CharacterGraphCanvasViewport;
  selectedGraphEdgeId: string | null;
  highlightedNodeIds?: string[];
  onSelectEdge: (edgeId: string) => void;
  onSelectCharacter: (characterId: string) => void;
  onFocusSearch: (characterId: string, label: string) => void;
  onRestoreFullGraph: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onViewportChange: (viewport: CharacterGraphCanvasViewport) => void;
  viewportInitialized?: boolean;
  resetSignal: number;
  privacySettings: ExtendedSettings;
  t: Translator;
  formatEdgeLabel: (edge: CharacterGraphModel['edges'][number]) => string;
  fallbackView: ReactNode;
}) {
  const graphDescriptionId = 'characters-graph-webgl-description';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);
  const rendererRef = useRef<CharacterGraphWebglRenderer | null>(null);
  const viewportRef = useRef(viewport);
  const commitTimerRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const highlightedFocusKeyRef = useRef('');
  const [fallbackActive, setFallbackActive] = useState(false);
  const dragRef = useRef<{ active: boolean; pointerId: number | null; lastX: number; lastY: number; moved: boolean; nodeHit: string | null; edgeHit: string | null }>({
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    moved: false,
    nodeHit: null,
    edgeHit: null,
  });
  const rendererTelemetry = useMemo(() => ({ renderer: 'webgl' as const, drawMode: 'retained' as const }), []);
  const edgeById = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges]);

  useEffect(() => {
    viewportRef.current = viewport;
    rendererRef.current?.setViewport(viewport, 'settled');
    updateCharacterGraphWebglStatus();
  }, [viewport]);

  useEffect(() => {
    rendererRef.current?.setSelectedEdge(selectedGraphEdgeId);
  }, [selectedGraphEdgeId]);

  useEffect(() => {
    focusHighlightedNodeIntoView();
  }, [highlightedNodeIds, renderModel]);

  useEffect(() => {
    const element = canvasRef.current;
    const labelLayer = labelLayerRef.current;
    if (!element || !labelLayer) return undefined;
    const renderer = createCharacterGraphWebglRenderer({
      canvas: element,
      labelLayer,
      renderModel,
      viewport: viewportRef.current,
      getNodeLabel: (node) => getPrivacyBookTitle(node.displayLabel, privacySettings),
    });
    if (!renderer) {
      setFallbackActive(true);
      return undefined;
    }
    setFallbackActive(false);
    rendererRef.current = renderer;
    renderer.setSelectedEdge(selectedGraphEdgeId);
    updateCharacterGraphWebglStatus();
    return () => {
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [renderModel, privacySettings, selectedGraphEdgeId]);

  useEffect(() => {
    if (viewportInitialized) return undefined;
    const resizeFrame = requestAnimationFrame(() => fitGraphToCanvas('immediate'));
    return () => cancelAnimationFrame(resizeFrame);
  }, [renderModel, fullscreen, resetSignal, viewportInitialized]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => rendererRef.current?.setViewport(viewportRef.current, 'settled'));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  if (fallbackActive) return <>{fallbackView}</>;

  function fitGraphToCanvas(commit: 'immediate' | 'deferred') {
    const element = hostRef.current ?? canvasRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    updateViewport(fitCharacterGraphWebglViewport(rect.width, rect.height, renderModel), commit);
  }

  function focusHighlightedNodeIntoView() {
    const nodeId = highlightedNodeIds[0];
    if (!nodeId) {
      highlightedFocusKeyRef.current = '';
      return;
    }
    const node = renderModel.index.nodeById.get(nodeId);
    const element = hostRef.current ?? canvasRef.current;
    if (!node || !element) return;
    const focusKey = `${renderModel.width}:${renderModel.height}:${nodeId}:${node.x}:${node.y}`;
    if (highlightedFocusKeyRef.current === focusKey) return;
    highlightedFocusKeyRef.current = focusKey;
    const rect = element.getBoundingClientRect();
    const scale = Math.max(viewportRef.current.scale, 0.72);
    updateViewport(buildCharacterGraphCanvasViewport({
      scale,
      offsetX: rect.width / (2 * scale) - node.x,
      offsetY: rect.height / (2 * scale) - node.y,
    }), 'immediate');
  }

  function updateViewport(nextViewport: CharacterGraphCanvasViewport, commit: 'immediate' | 'deferred') {
    viewportRef.current = nextViewport;
    rendererRef.current?.setViewport(nextViewport, commit === 'immediate' ? 'settled' : 'interactive');
    updateCharacterGraphWebglStatus();
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    if (commit === 'immediate') {
      onViewportChange(nextViewport);
      return;
    }
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      rendererRef.current?.setViewport(viewportRef.current, 'settled');
      onViewportChange(viewportRef.current);
      updateCharacterGraphWebglStatus();
    }, 90);
  }

  function updateCharacterGraphWebglStatus() {
    if (!statusRef.current) return;
    statusRef.current.textContent = `${t('characters.graphCanvasViewportStatus', { zoom: Math.round(viewportRef.current.scale * 100), x: Math.round(viewportRef.current.offsetX), y: Math.round(viewportRef.current.offsetY) })} · ${canvas.summary.visibleNodeCount} / ${canvas.summary.visibleEdgeCount}`;
  }

  function toLocalPoint(event: { clientX: number; clientY: number }, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function preventCancelableDefault(event: { cancelable: boolean; preventDefault: () => void }) {
    if (event.cancelable) event.preventDefault();
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    preventCancelableDefault(event);
    const point = toLocalPoint(event, event.currentTarget);
    const nextViewport = rendererRef.current?.zoomAt(point.x, point.y, event.deltaY);
    if (nextViewport) updateViewport(nextViewport, 'deferred');
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    preventCancelableDefault(event);
    const point = toLocalPoint(event, event.currentTarget);
    const hit = rendererRef.current?.hitTestAt(point.x, point.y) ?? { nodeId: null, edgeId: null };
    if (canvasRef.current) {
      canvasRef.current.dataset.lastPointerDownNodeId = hit.nodeId ?? '';
      canvasRef.current.dataset.lastPointerDownEdgeId = hit.edgeId ?? '';
      canvasRef.current.dataset.lastPointerDownX = String(Math.round(point.x));
      canvasRef.current.dataset.lastPointerDownY = String(Math.round(point.y));
    }
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      nodeHit: hit.nodeId,
      edgeHit: hit.edgeId,
    };
    event.currentTarget.classList.add('panning');
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Browser parity tests can dispatch synthetic pointer events without active capture.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const point = toLocalPoint(event, event.currentTarget);
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      rendererRef.current?.handlePointerMove(point.x, point.y);
      return;
    }
    preventCancelableDefault(event);
    const deltaX = event.clientX - dragRef.current.lastX;
    const deltaY = event.clientY - dragRef.current.lastY;
    if (Math.hypot(deltaX, deltaY) > 1) dragRef.current.moved = true;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    updateViewport(renderer.panBy(deltaX, deltaY), 'deferred');
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const moved = dragRef.current.moved;
    const nodeHit = dragRef.current.nodeHit;
    const edgeHit = dragRef.current.edgeHit;
    dragRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0, moved: false, nodeHit: null, edgeHit: null };
    event.currentTarget.classList.remove('panning');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rendererRef.current?.setViewport(viewportRef.current, 'settled');
    onViewportChange(viewportRef.current);
    if (!moved && nodeHit) {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        onSelectCharacter(nodeHit);
      }, 180);
    } else if (!moved && edgeHit) {
      if (canvasRef.current) canvasRef.current.dataset.lastSelectedEdgeId = edgeHit;
      onSelectEdge(edgeHit);
    }
    else if (!moved) onRestoreFullGraph();
  }

  function handleDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    preventCancelableDefault(event);
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const point = toLocalPoint(event, event.currentTarget);
    const hit = rendererRef.current?.hitTestAt(point.x, point.y);
    if (!hit?.nodeId) return;
    const node = renderModel.index.nodeById.get(hit.nodeId);
    if (node) onFocusSearch(node.id, node.label);
  }

  return (
    <div className="characters-graph-canvas" aria-label={t('characters.graphCanvasTitle')} aria-describedby={graphDescriptionId}>
      {!fullscreen ? (
        <div className="characters-graph-canvas-controls compact" aria-label={t('characters.graphCanvasControlsAria')}>
          <button
            className="characters-graph-canvas-control-btn characters-graph-canvas-fullscreen-btn"
            type="button"
            onClick={onToggleFullscreen}
            aria-label={t('characters.graphCanvasFullscreen')}
            title={t('characters.graphCanvasFullscreen')}
          >
            <span aria-hidden="true">[]</span>
          </button>
        </div>
      ) : null}
      <p id={graphDescriptionId} className="sr-only">
        {t('characters.graphCanvasDescription', canvas.summary)}
      </p>
      <div
        ref={hostRef}
        className="characters-graph-canvas-bitmap-host characters-graph-webgl-host"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => rendererRef.current?.clearHover()}
        onDoubleClick={handleDoubleClick}
      >
        <canvas
          ref={canvasRef}
          className="characters-graph-canvas-bitmap characters-graph-webgl-canvas"
          role="img"
          aria-label={t('characters.graphCanvasAria', canvas.summary)}
          data-renderer={rendererTelemetry.renderer}
          data-draw-mode={rendererTelemetry.drawMode}
          data-node-count={canvas.nodes.length}
          data-edge-count={canvas.edges.length}
          data-highlighted-node-ids={highlightedNodeIds.join(',')}
          data-min-node-gap={canvas.layout.minNodeGap}
          data-renderer-fallback="none"
        />
        <div ref={labelLayerRef} className="characters-graph-webgl-label-layer" aria-hidden="true" />
      </div>
      <span ref={statusRef} className="characters-graph-canvas-viewport-status">{t('characters.graphCanvasViewportStatus', { zoom: Math.round(viewport.scale * 100), x: viewport.offsetX, y: viewport.offsetY })}</span>
      {canvas.summary.hiddenNodeCount > 0 || canvas.summary.hiddenEdgeCount > 0 ? (
        <span className="characters-graph-canvas-hidden-summary">
          {t('characters.graphCanvasHiddenSummary', { nodes: canvas.summary.hiddenNodeCount, edges: canvas.summary.hiddenEdgeCount })}
        </span>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {selectedGraphEdgeId && edgeById.has(selectedGraphEdgeId) ? formatEdgeLabel(edgeById.get(selectedGraphEdgeId)!) : ''}
      </div>
    </div>
  );
}

function fitCharacterGraphWebglViewport(
  width: number,
  height: number,
  renderModel: CharacterGraphRenderModel,
) {
  if (renderModel.nodeCount === 0) {
    return buildCharacterGraphCanvasViewport({
      scale: 1,
      offsetX: width / 2,
      offsetY: height / 2,
    });
  }
  const bounds = renderModel.nodes.reduce((box, node) => ({
    minX: Math.min(box.minX, node.x - 80),
    minY: Math.min(box.minY, node.y - 80),
    maxX: Math.max(box.maxX, node.x + 80),
    maxY: Math.max(box.maxY, node.y + 80),
  }), { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY });
  const scale = Math.round(Math.max(0.04, Math.min(64, Math.min(
    width / Math.max(1, bounds.maxX - bounds.minX),
    height / Math.max(1, bounds.maxY - bounds.minY),
  ) * 0.9)) * 100) / 100;
  return buildCharacterGraphCanvasViewport({
    scale,
    offsetX: width / 2 / scale - (bounds.minX + bounds.maxX) / 2,
    offsetY: height / 2 / scale - (bounds.minY + bounds.maxY) / 2,
  });
}

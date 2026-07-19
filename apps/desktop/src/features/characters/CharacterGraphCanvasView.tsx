import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { Translator } from '../../i18n';
import type { ExtendedSettings } from '../../services/settingsCenterService';
import type { CharacterGraphModel } from './characterGraphModel';
import {
  buildCharacterGraphCanvasViewport,
  type CharacterGraphCanvasModel,
  type CharacterGraphCanvasViewport,
} from './characterGraphCanvasModel';
import {
  clampCharacterGraphViewportScale,
  drawCharacterGraphCanvas,
  fitCharacterGraphCanvasViewport,
  getCharacterGraphCanvasInteractionProbes,
  findNearestGraphCanvasEdge,
  findNearestGraphCanvasNode,
  getZoomAnchoredOffset,
  screenToGraphPoint,
  type CharacterGraphCanvasDrawTelemetry,
} from './characterGraphCanvasRuntime';

export function CharacterGraphCanvasView({
  canvas,
  graph,
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
}: {
  canvas: CharacterGraphCanvasModel;
  graph: CharacterGraphModel;
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
}) {
  const graphDescriptionId = 'characters-graph-canvas-description';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  const renderedViewportRef = useRef(viewport);
  const highlightedFocusKeyRef = useRef('');
  const selectedEdgeIdRef = useRef(selectedGraphEdgeId);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredEdgeIdRef = useRef<string | null>(null);
  const interactionUntilRef = useRef(0);
  const detailUntilRef = useRef(0);
  const interactionTimerRef = useRef<number | null>(null);
  const viewportCommitTimerRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number; pointerId: number | null; moved: boolean; nodeHit: string | null; edgeHit: string | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
    moved: false,
    nodeHit: null,
    edgeHit: null,
  });
  const edgeById = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges]);

  useEffect(() => {
    viewportRef.current = viewport;
    viewRef.current = { scale: viewport.scale, x: viewport.offsetX, y: viewport.offsetY };
    scheduleCharacterGraphCanvasDraw();
  }, [viewport]);

  useEffect(() => {
    selectedEdgeIdRef.current = selectedGraphEdgeId;
    scheduleCharacterGraphCanvasDraw();
  }, [selectedGraphEdgeId]);

  useEffect(() => {
    scheduleCharacterGraphCanvasDraw();
  }, [canvas, graph, privacySettings, highlightedNodeIds]);

  useEffect(() => {
    focusHighlightedNodeIntoView();
  }, [canvas, highlightedNodeIds]);

  useEffect(() => {
    if (viewportInitialized) return undefined;
    const resizeFrame = requestAnimationFrame(() => fitGraphToCanvas('immediate'));
    return () => cancelAnimationFrame(resizeFrame);
  }, [canvas, fullscreen, resetSignal, viewportInitialized]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => scheduleCharacterGraphCanvasDraw());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (viewportCommitTimerRef.current !== null) window.clearTimeout(viewportCommitTimerRef.current);
      if (interactionTimerRef.current !== null) window.clearTimeout(interactionTimerRef.current);
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  function scheduleCharacterGraphCanvasDraw() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = canvasRef.current;
      if (!element) return;
      resetCharacterGraphCanvasCompositePreview(element);
      const telemetry = drawCharacterGraphCanvas(element, canvas, viewportRef.current, {
        selectedEdgeId: selectedEdgeIdRef.current,
        hoveredNodeId: hoveredNodeIdRef.current,
        hoveredEdgeId: hoveredEdgeIdRef.current,
        highlightedNodeIds,
        interactingUntil: interactionUntilRef.current,
        detailUntil: detailUntilRef.current,
      }, privacySettings);
      renderedViewportRef.current = viewportRef.current;
      if (performance.now() >= interactionUntilRef.current) {
        if (telemetry) applyCharacterGraphCanvasTelemetryDataset(element, telemetry);
        updateCharacterGraphCanvasProbeDatasets(element, canvas, viewportRef.current);
      }
      element.dataset.drawSerial = String(Number(element.dataset.drawSerial || 0) + 1);
      updateCharacterGraphCanvasStatus();
    });
  }

  function updateCharacterGraphCanvasProbeDatasets(
    element: HTMLCanvasElement,
    nextCanvas: CharacterGraphCanvasModel,
    nextViewport: CharacterGraphCanvasViewport,
  ) {
    const rect = element.getBoundingClientRect();
    const probes = getCharacterGraphCanvasInteractionProbes(rect.width, rect.height, nextCanvas, nextViewport);
    applyCharacterGraphCanvasProbeDataset(element, 'node', probes.node);
    applyCharacterGraphCanvasProbeDataset(element, 'edge', probes.edge);
  }

  function updateViewport(nextViewport: CharacterGraphCanvasViewport, commit: 'immediate' | 'deferred' | 'none' = 'immediate') {
    viewRef.current = { scale: nextViewport.scale, x: nextViewport.offsetX, y: nextViewport.offsetY };
    viewportRef.current = nextViewport;
    if (commit === 'immediate') {
      if (viewportCommitTimerRef.current !== null) {
        window.clearTimeout(viewportCommitTimerRef.current);
        viewportCommitTimerRef.current = null;
      }
      onViewportChange(nextViewport);
    } else if (commit === 'deferred') {
      if (viewportCommitTimerRef.current !== null) window.clearTimeout(viewportCommitTimerRef.current);
      viewportCommitTimerRef.current = window.setTimeout(() => {
        viewportCommitTimerRef.current = null;
        onViewportChange(viewportRef.current);
      }, 80);
    } else if (commit === 'none') {
      // Ref-only updates keep high-frequency panning off React's render path.
      applyCharacterGraphCanvasCompositePreview();
      updateCharacterGraphCanvasStatus();
      scheduleCharacterGraphCanvasSettledDraw();
      return;
    }
    scheduleCharacterGraphCanvasDraw();
  }

  function fitGraphToCanvas(commit: 'immediate' | 'deferred' | 'none' = 'immediate') {
    const element = hostRef.current ?? canvasRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    updateViewport(fitCharacterGraphCanvasViewport(rect.width, rect.height, canvas), commit);
  }

  function focusHighlightedNodeIntoView() {
    const nodeId = highlightedNodeIds[0];
    if (!nodeId) {
      highlightedFocusKeyRef.current = '';
      return;
    }
    const node = canvas.nodes.find((item) => item.id === nodeId);
    const element = hostRef.current ?? canvasRef.current;
    if (!node || !element) return;
    const focusKey = `${canvas.width}:${canvas.height}:${nodeId}:${node.x}:${node.y}`;
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

  function markInteracting() {
    interactionUntilRef.current = performance.now() + 180;
    detailUntilRef.current = performance.now() + 260;
  }

  function scheduleCharacterGraphCanvasSettledDraw() {
    if (interactionTimerRef.current !== null) window.clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = window.setTimeout(() => {
      interactionTimerRef.current = null;
      scheduleCharacterGraphCanvasDraw();
    }, 280);
  }

  function updateCharacterGraphCanvasStatus() {
    if (!statusRef.current) return;
    statusRef.current.textContent = `${t('characters.graphCanvasViewportStatus', { zoom: Math.round(viewportRef.current.scale * 100), x: Math.round(viewportRef.current.offsetX), y: Math.round(viewportRef.current.offsetY) })} · ${canvas.summary.visibleNodeCount} / ${canvas.summary.visibleEdgeCount}`;
  }

  function applyCharacterGraphCanvasCompositePreview() {
    const element = canvasRef.current;
    if (!element) return;
    const rendered = renderedViewportRef.current;
    const target = viewportRef.current;
    const scale = target.scale / Math.max(0.0001, rendered.scale);
    const translateX = target.scale * (target.offsetX - rendered.offsetX);
    const translateY = target.scale * (target.offsetY - rendered.offsetY);
    element.style.transform = `matrix(${formatCompositeNumber(scale)}, 0, 0, ${formatCompositeNumber(scale)}, ${formatCompositeNumber(translateX)}, ${formatCompositeNumber(translateY)})`;
    element.dataset.compositePreview = 'true';
  }

  function captureCharacterGraphPointer(element: HTMLElement, pointerId: number) {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Non-real pointer events from browser parity tests can lack an active browser pointer.
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    const nextScale = clampCharacterGraphViewportScale(viewportRef.current.scale * zoomFactor);
    const rect = event.currentTarget.getBoundingClientRect();
    const worldBefore = screenToGraphPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, canvas, viewportRef.current);
    const nextOffset = getZoomAnchoredOffset(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, canvas, viewportRef.current, nextScale, worldBefore);
    updateViewport(buildCharacterGraphCanvasViewport({
      scale: nextScale,
      offsetX: nextOffset.offsetX,
      offsetY: nextOffset.offsetY,
    }), 'none');
    markInteracting();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = screenToGraphPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, canvas, viewportRef.current);
    const nearestNode = findNearestGraphCanvasNode(canvas, point.x, point.y, viewportRef.current.scale);
    const nearestEdge = nearestNode ? null : findNearestGraphCanvasEdge(canvas, point.x, point.y, viewportRef.current.scale);
    dragRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
      moved: false,
      nodeHit: nearestNode?.id ?? null,
      edgeHit: nearestEdge?.id ?? null,
    };
    event.currentTarget.classList.add('panning');
    captureCharacterGraphPointer(event.currentTarget, event.pointerId);
  }

  function handleDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const point = screenToGraphPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, canvas, viewportRef.current);
    const nearestNode = findNearestGraphCanvasNode(canvas, point.x, point.y, viewportRef.current.scale);
    if (nearestNode) onFocusSearch(nearestNode.id, nearestNode.label);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      const point = screenToGraphPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, canvas, viewportRef.current);
      const nearestNode = findNearestGraphCanvasNode(canvas, point.x, point.y, viewportRef.current.scale);
      const nearestEdge = nearestNode ? null : findNearestGraphCanvasEdge(canvas, point.x, point.y, viewportRef.current.scale);
      const nextHoveredNodeId = nearestNode?.id ?? null;
      const nextHoveredEdgeId = nearestEdge?.id ?? null;
      if (hoveredNodeIdRef.current !== nextHoveredNodeId || hoveredEdgeIdRef.current !== nextHoveredEdgeId) {
        hoveredNodeIdRef.current = nextHoveredNodeId;
        hoveredEdgeIdRef.current = nextHoveredEdgeId;
        scheduleCharacterGraphCanvasDraw();
      }
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - dragRef.current.lastX;
    const deltaY = event.clientY - dragRef.current.lastY;
    if (Math.hypot(event.clientX - dragRef.current.lastX, event.clientY - dragRef.current.lastY) > 1) {
      dragRef.current.moved = true;
    }
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    updateViewport(buildCharacterGraphCanvasViewport({
      ...viewportRef.current,
      offsetX: viewportRef.current.offsetX + deltaX / viewportRef.current.scale,
      offsetY: viewportRef.current.offsetY + deltaY / viewportRef.current.scale,
    }), 'none');
    markInteracting();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId === event.pointerId) {
      const moved = dragRef.current.moved;
      const nodeHit = dragRef.current.nodeHit;
      const edgeHit = dragRef.current.edgeHit;
      dragRef.current = { active: false, lastX: 0, lastY: 0, pointerId: null, moved: false, nodeHit: null, edgeHit: null };
      event.currentTarget.classList.remove('panning');
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      onViewportChange(viewportRef.current);
      if (!moved && nodeHit) {
        if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = window.setTimeout(() => {
          clickTimerRef.current = null;
          onSelectCharacter(nodeHit);
        }, 180);
      }
      else if (!moved && edgeHit) onSelectEdge(edgeHit);
      else if (!moved && !hoveredNodeIdRef.current && !hoveredEdgeIdRef.current) onRestoreFullGraph();
    }
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
        className="characters-graph-canvas-bitmap-host"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          hoveredNodeIdRef.current = null;
          hoveredEdgeIdRef.current = null;
          scheduleCharacterGraphCanvasDraw();
        }}
        onDoubleClick={handleDoubleClick}
      >
        <canvas
          ref={canvasRef}
          className="characters-graph-canvas-bitmap"
          role="img"
          aria-label={t('characters.graphCanvasAria', canvas.summary)}
          data-node-count={canvas.nodes.length}
          data-edge-count={canvas.edges.length}
          data-min-node-gap={canvas.layout.minNodeGap}
        />
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

function applyCharacterGraphCanvasTelemetryDataset(
  element: HTMLCanvasElement,
  telemetry: CharacterGraphCanvasDrawTelemetry,
) {
  element.dataset.edgeClipMode = telemetry.edgeClipMode;
  element.dataset.visibleNodeCount = String(telemetry.visibleNodeCount);
  element.dataset.endpointNodeCount = String(telemetry.endpointNodeCount);
  element.dataset.candidateEdgeCount = String(telemetry.candidateEdgeCount);
  element.dataset.drawnEdgeCount = String(telemetry.drawnEdgeCount);
  element.dataset.totalEdgeCount = String(telemetry.totalEdgeCount);
  element.dataset.highZoom = String(telemetry.highZoom);
}

function resetCharacterGraphCanvasCompositePreview(element: HTMLCanvasElement) {
  element.style.transform = '';
  element.dataset.compositePreview = 'false';
}

function formatCompositeNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  return Math.abs(value) < 0.001 ? '0' : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function applyCharacterGraphCanvasProbeDataset(
  element: HTMLCanvasElement,
  key: 'node' | 'edge',
  probe: { id: string; x: number; y: number } | null,
) {
  const idKey = `${key}ProbeId` as const;
  const xKey = `${key}ProbeX` as const;
  const yKey = `${key}ProbeY` as const;
  if (!probe) {
    delete element.dataset[idKey];
    delete element.dataset[xKey];
    delete element.dataset[yKey];
    return;
  }
  element.dataset[idKey] = probe.id;
  element.dataset[xKey] = String(probe.x);
  element.dataset[yKey] = String(probe.y);
}

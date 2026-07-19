import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { CharacterCenterPayload, CharacterEvidence, CharacterLocation, CharacterRelation } from '../../types';
import { useI18n } from '../../i18n';
import { buildCharacterGraphModel, resolveCharacterGraphPanelState, type CharacterGraphChapterRange, type CharacterGraphFocusMode, type CharacterGraphModel, type CharacterGraphNode, type CharacterGraphPanelState } from './characterGraphModel';
import {
  buildCharacterGraphCanvasModel,
  buildCharacterGraphCanvasViewport,
  type CharacterGraphCanvasModel,
  type CharacterGraphCanvasViewport,
} from './characterGraphCanvasModel';
import {
  buildCharacterGraphCanvasSessionCacheKey,
  buildCharacterGraphModelSessionCacheKey,
  peekCharacterGraphCanvasSessionCache,
  readCharacterGraphModelSessionCache,
  readCharacterGraphRenderModelSessionCache,
  readCharacterGraphCanvasSessionCache,
  rememberCharacterGraphModelSessionCache,
  rememberCharacterGraphRenderModelSessionCache,
  rememberCharacterGraphCanvasSessionCache,
} from './characterGraphCanvasSessionCache';
import { CharacterGraphCanvasView } from './CharacterGraphCanvasView';
import { buildCharacterGraphRenderModel, type CharacterGraphRenderModel } from './characterGraphRenderModel';
import { CharacterGraphWebglView } from './CharacterGraphWebglView';
import type { CharacterGraphLayoutWorkerResponse } from './characterGraphLayoutWorker';
import { ThemedSelect } from '../../components/ThemedSelect';
import { buildCharacterGraphEdgeDetail, type CharacterGraphEdgeDetail } from './characterGraphEdgeDetail';
import type { CharacterCenterState } from './characterCenterState';
import { buildCharacterGraphRelationTableRows, type CharacterGraphRelationTableRow } from './characterGraphRelationTableModel';
import {
  buildCharacterBookCacheSignature,
  type CharacterGraphSessionEdgeMode,
  type CharacterGraphSessionNeighborDepth,
  type CharacterGraphSessionState,
  type CharacterGraphSessionStatePatch,
  type CharacterGraphSessionViewMode,
} from './characterCenterSession';

const characterGraphRelationRowHeight = 52;
const characterGraphRelationOverscan = 6;
const characterGraphRelationViewportHeight = 360;
const compactGraphCanvasMaxNodes = 260;
const compactGraphCanvasMaxEdges = 520;
const fullscreenGraphCanvasMaxNodes = 720;
const fullscreenGraphCanvasMaxEdges = 1800;

export type CharacterRelationGraphViewProps = {
  characterPayload: CharacterCenterPayload | null;
  centerState: CharacterCenterState;
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  onInspectRelationDetail: (detail: CharacterGraphEdgeDetail | null) => void;
  onOpenEvidence: (evidence: CharacterEvidence) => void;
  graphSessionState: CharacterGraphSessionState;
  onGraphSessionStateChange: (patch: CharacterGraphSessionStatePatch) => void;
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
  privacySettings: ExtendedSettings;
  t: ReturnType<typeof useI18n>['t'];
  formatLocation: (location: CharacterLocation | undefined) => string;
  formatRelationMeta: (relation: CharacterRelation) => string;
};

export function CharacterRelationGraphView({
  characterPayload,
  centerState,
  selectedCharacterId,
  onSelectCharacter,
  onInspectRelationDetail,
  onOpenEvidence,
  graphSessionState,
  onGraphSessionStateChange,
  fullscreen,
  onFullscreenChange,
  privacySettings,
  t,
  formatLocation,
  formatRelationMeta,
}: CharacterRelationGraphViewProps) {
  return (
    <CharacterRelationGraphTable
      characterPayload={characterPayload}
      centerState={centerState}
      selectedCharacterId={selectedCharacterId}
      onSelectCharacter={onSelectCharacter}
      onInspectRelationDetail={onInspectRelationDetail}
      onOpenEvidence={onOpenEvidence}
      graphSessionState={graphSessionState}
      onGraphSessionStateChange={onGraphSessionStateChange}
      fullscreen={fullscreen}
      onFullscreenChange={onFullscreenChange}
      privacySettings={privacySettings}
      t={t}
      formatLocation={formatLocation}
      formatRelationMeta={formatRelationMeta}
    />
  );
}

function CharacterRelationGraphTable({
  characterPayload,
  centerState,
  selectedCharacterId,
  onSelectCharacter,
  onInspectRelationDetail,
  onOpenEvidence,
  graphSessionState,
  onGraphSessionStateChange,
  fullscreen,
  onFullscreenChange,
  privacySettings,
  t,
  formatLocation,
  formatRelationMeta,
}: {
  characterPayload: CharacterCenterPayload | null;
  centerState: CharacterCenterState;
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  onInspectRelationDetail: (detail: CharacterGraphEdgeDetail | null) => void;
  onOpenEvidence: (evidence: CharacterEvidence) => void;
  graphSessionState: CharacterGraphSessionState;
  onGraphSessionStateChange: (patch: CharacterGraphSessionStatePatch) => void;
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
  privacySettings: ExtendedSettings;
  t: ReturnType<typeof useI18n>['t'];
  formatLocation: (location: CharacterLocation | undefined) => string;
  formatRelationMeta: (relation: CharacterRelation) => string;
}) {
  const [graphCanvasResetSignal, setGraphCanvasResetSignal] = useState(0);
  const [graphCanvas, setGraphCanvas] = useState<{ key: string; canvas: CharacterGraphCanvasModel } | null>(null);
  const [graphSearchDraft, setGraphSearchDraft] = useState(graphSessionState.searchQuery);
  const [relationTableSearchQuery, setRelationTableSearchQuery] = useState('');
  const [expandedRelationTableSourceIds, setExpandedRelationTableSourceIds] = useState<Set<string>>(() => new Set());
  const graphLayoutRequestIdRef = useRef(0);
  const graphTableScrollRef = useRef<HTMLDivElement | null>(null);
  const graphFocusMode = graphSessionState.focusMode;
  const graphRelationTypeFilter = graphSessionState.relationTypeFilter;
  const graphMinConfidenceFilter = graphSessionState.minConfidenceFilter;
  const graphChapterStartFilter = graphSessionState.chapterStartFilter;
  const graphChapterEndFilter = graphSessionState.chapterEndFilter;
  const selectedGraphEdgeId = graphSessionState.selectedGraphEdgeId;
  const graphCanvasViewport = graphSessionState.viewport;
  const graphViewMode = graphSessionState.viewMode;
  const graphSearchQuery = graphSessionState.searchQuery;
  const graphNeighborDepth = graphSessionState.neighborDepth;
  const graphEdgeMode = graphSessionState.edgeMode;
  const graphTableScrollTop = graphSessionState.tableScrollTop;
  const relationTypeOptions = useMemo(() => {
    if (!characterPayload) return [];
    return [...new Set(characterPayload.relations.map((relation) => relation.relationType).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  }, [characterPayload]);
  const minConfidence = Number(graphMinConfidenceFilter) || 0;
  const chapterRange = useMemo(
    () => buildCharacterGraphChapterRange(graphChapterStartFilter, graphChapterEndFilter),
    [graphChapterStartFilter, graphChapterEndFilter],
  );
  const payloadSignature = characterPayload ? buildCharacterBookCacheSignature(characterPayload.book) : '';
  const graphModelCacheKey = characterPayload
    ? buildCharacterGraphModelSessionCacheKey({
      bookId: characterPayload.book.id,
      payloadSignature,
      relationTypeFilter: graphRelationTypeFilter,
      minConfidence,
      chapterStartFilter: graphChapterStartFilter,
      chapterEndFilter: graphChapterEndFilter,
      focusMode: graphFocusMode,
      selectedCharacterId: graphFocusMode === 'all' ? '' : selectedCharacterId ?? '',
    })
    : '';
  const graph = useMemo(() => {
    if (!characterPayload || !graphModelCacheKey) return null;
    const cachedGraph = readCharacterGraphModelSessionCache(graphModelCacheKey);
    if (cachedGraph) return cachedGraph;
    const nextGraph = buildCharacterGraphModel(characterPayload.profiles, characterPayload.relations, {
      relationTypes: graphRelationTypeFilter === 'all' ? [] : [graphRelationTypeFilter],
      minConfidence,
      chapterRange,
      focusCharacterId: graphFocusMode === 'all' ? undefined : selectedCharacterId ?? undefined,
      focusDepth: graphFocusMode === 'one-hop' ? 1 : graphFocusMode === 'two-hop' ? 2 : 'all',
    });
    rememberCharacterGraphModelSessionCache(graphModelCacheKey, nextGraph);
    return nextGraph;
  }, [characterPayload, graphModelCacheKey, graphRelationTypeFilter, minConfidence, chapterRange, graphFocusMode, selectedCharacterId]);
  const graphPanelState = useMemo(() => resolveCharacterGraphPanelState({
    hasPayload: Boolean(characterPayload),
    centerStateId: centerState.stateId,
    graph,
    relationCount: characterPayload?.relations.length ?? 0,
    focusMode: graphFocusMode,
    selectedCharacterId,
  }), [centerState.stateId, characterPayload, graph, graphFocusMode, selectedCharacterId]);
  const selectedGraphEdge = useMemo(() => {
    if (!graph || !selectedGraphEdgeId) return null;
    return graph.edges.find((edge) => edge.id === selectedGraphEdgeId) ?? null;
  }, [graph, selectedGraphEdgeId]);
  const selectedGraphEdgeDetail = useMemo(() => {
    if (!characterPayload) return null;
    return buildCharacterGraphEdgeDetail(characterPayload, selectedGraphEdge);
  }, [characterPayload, selectedGraphEdge]);
  const graphNodeById = useMemo(() => new Map(graph?.nodes.map((node) => [node.id, node]) ?? []), [graph]);
  const graphNodeLabelById = useMemo(() => new Map(graph?.nodes.map((node) => [node.id, node.label]) ?? []), [graph]);
  const evidenceById = useMemo(() => new Map(characterPayload?.evidence.map((item) => [item.id, item]) ?? []), [characterPayload]);
  const relationTableRows = useMemo(
    () => graph ? buildCharacterGraphRelationTableRows(graph, graphNodeLabelById, relationTableSearchQuery, expandedRelationTableSourceIds) : [],
    [expandedRelationTableSourceIds, graph, graphNodeLabelById, relationTableSearchQuery],
  );
  const graphTableViewport = useMemo(
    () => buildCharacterGraphRelationViewport(relationTableRows.length, graphTableScrollTop),
    [relationTableRows.length, graphTableScrollTop],
  );
  const graphSearchHighlightedNodeIds = useMemo(
    () => graph ? findCharacterGraphSearchHighlightedNodeIds(graph.nodes, graphSearchQuery) : [],
    [graph, graphSearchQuery],
  );
  const graphSignature = graph
    ? `${graph.summary.nodeCount}:${graph.summary.edgeCount}:${graph.summary.relationCount}:${graph.edges[0]?.id ?? ''}:${graph.edges.at(-1)?.id ?? ''}`
    : '';
  const graphCanvasFocusCharacterId = graphViewMode === 'neighborhood' || graphFocusMode !== 'all' ? selectedCharacterId ?? '' : '';
  const graphCanvasCacheKey = characterPayload && graph
    ? buildCharacterGraphCanvasSessionCacheKey({
      bookId: characterPayload.book.id,
      payloadSignature,
      graphSignature,
      viewMode: graphViewMode,
      focusCharacterId: graphCanvasFocusCharacterId,
      searchQuery: graphSearchQuery,
      neighborDepth: String(graphNeighborDepth),
      edgeMode: graphEdgeMode,
      maxNodes: String(fullscreen ? fullscreenGraphCanvasMaxNodes : compactGraphCanvasMaxNodes),
      maxEdges: String(fullscreen ? fullscreenGraphCanvasMaxEdges : compactGraphCanvasMaxEdges),
    })
    : '';
  const cachedGraphCanvas = graphCanvasCacheKey ? peekCharacterGraphCanvasSessionCache(graphCanvasCacheKey) : null;
  const currentGraphCanvas = graphCanvas?.key === graphCanvasCacheKey ? graphCanvas.canvas : null;
  const displayedGraphCanvas = currentGraphCanvas ?? cachedGraphCanvas;
  const graphSearchHighlightKey = graphSearchHighlightedNodeIds.join(',');
  const graphRenderModelCacheKey = graphCanvasCacheKey ? `${graphCanvasCacheKey}|highlight:${graphSearchHighlightKey}` : '';
  const graphRenderModel: CharacterGraphRenderModel | null = useMemo(
    () => {
      if (!displayedGraphCanvas || !graphRenderModelCacheKey) return null;
      const cachedRenderModel = readCharacterGraphRenderModelSessionCache(graphRenderModelCacheKey);
      if (cachedRenderModel) return cachedRenderModel;
      const nextRenderModel = buildCharacterGraphRenderModel(displayedGraphCanvas, {
        labelBudget: fullscreen ? 120 : 42,
        maxVisibleEdges: fullscreen ? 3200 : 560,
        hoverEdgeBudget: fullscreen ? 180 : 48,
        highlightedNodeIds: graphSearchHighlightedNodeIds,
      });
      rememberCharacterGraphRenderModelSessionCache(graphRenderModelCacheKey, nextRenderModel);
      return nextRenderModel;
    },
    [displayedGraphCanvas, graphRenderModelCacheKey, graphSearchHighlightedNodeIds, fullscreen],
  );

  function selectGraphEdge(edgeId: string) {
    setSelectedGraphEdgeId(edgeId);
    if (!fullscreen && characterPayload && graph) {
      const edge = graph.edges.find((item) => item.id === edgeId) ?? null;
      onInspectRelationDetail(buildCharacterGraphEdgeDetail(characterPayload, edge));
    }
  }

  function resetGraphCanvasViewport() {
    setGraphCanvasViewport(buildCharacterGraphCanvasViewport(), false);
    setGraphCanvasResetSignal((signal) => signal + 1);
  }

  function resetPreviewGraph() {
    setGraphSearchDraft('');
    setGraphSearchQuery('');
    setGraphNeighborDepth(2);
    setGraphEdgeMode('skeleton');
    setSelectedGraphEdgeId(null);
    resetGraphCanvasViewport();
    onInspectRelationDetail(null);
  }

  useEffect(() => {
    setGraphCanvas(null);
    setGraphCanvasResetSignal((signal) => signal + 1);
    setGraphSearchDraft('');
    setRelationTableSearchQuery('');
    setExpandedRelationTableSourceIds(new Set());
    onInspectRelationDetail(null);
  }, [characterPayload?.book.id, onInspectRelationDetail]);

  useEffect(() => {
    setGraphSearchDraft(graphSearchQuery);
  }, [graphSearchQuery]);

  useEffect(() => {
    if (graphTableScrollRef.current) graphTableScrollRef.current.scrollTop = 0;
    setGraphTableScrollTop(0);
  }, [relationTableSearchQuery, graphModelCacheKey]);

  useEffect(() => {
    if (!graph || !graphPanelState.renderGraph) {
      setGraphCanvas(null);
      return undefined;
    }

    const requestId = graphLayoutRequestIdRef.current + 1;
    graphLayoutRequestIdRef.current = requestId;
    const cachedCanvas = readCharacterGraphCanvasSessionCache(graphCanvasCacheKey);
    if (cachedCanvas) {
      setGraphCanvas({ key: graphCanvasCacheKey, canvas: cachedCanvas });
      return undefined;
    }

    setGraphCanvas(null);

    let worker: Worker | null = null;
    let fallbackTimer: number | null = null;
    let disposed = false;

    function acceptCanvas(canvas: CharacterGraphCanvasModel) {
      if (disposed || graphLayoutRequestIdRef.current !== requestId) return;
      rememberCharacterGraphCanvasSessionCache(graphCanvasCacheKey, canvas);
      setGraphCanvas({ key: graphCanvasCacheKey, canvas });
    }

    try {
      worker = new Worker(new URL('./characterGraphLayoutWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<CharacterGraphLayoutWorkerResponse>) => {
        if (event.data.requestId === requestId) acceptCanvas(event.data.canvas);
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        fallbackTimer = window.setTimeout(() => acceptCanvas(buildCharacterGraphCanvasModel(graph, {
          viewMode: graphViewMode,
          focusCharacterId: graphCanvasFocusCharacterId,
          searchQuery: graphSearchQuery,
          neighborDepth: graphNeighborDepth,
          edgeMode: graphEdgeMode,
          maxNodes: fullscreen ? fullscreenGraphCanvasMaxNodes : compactGraphCanvasMaxNodes,
          maxEdges: fullscreen ? fullscreenGraphCanvasMaxEdges : compactGraphCanvasMaxEdges,
        })), 0);
      };
      worker.postMessage({
        requestId,
        graph: { nodes: graph.nodes, edges: graph.edges },
        options: {
          viewMode: graphViewMode,
          focusCharacterId: graphCanvasFocusCharacterId,
          searchQuery: graphSearchQuery,
          neighborDepth: graphNeighborDepth,
          edgeMode: graphEdgeMode,
          maxNodes: fullscreen ? fullscreenGraphCanvasMaxNodes : compactGraphCanvasMaxNodes,
          maxEdges: fullscreen ? fullscreenGraphCanvasMaxEdges : compactGraphCanvasMaxEdges,
        },
      });
    } catch {
      fallbackTimer = window.setTimeout(() => acceptCanvas(buildCharacterGraphCanvasModel(graph, {
        viewMode: graphViewMode,
        focusCharacterId: graphCanvasFocusCharacterId,
        searchQuery: graphSearchQuery,
        neighborDepth: graphNeighborDepth,
        edgeMode: graphEdgeMode,
        maxNodes: fullscreen ? fullscreenGraphCanvasMaxNodes : compactGraphCanvasMaxNodes,
        maxEdges: fullscreen ? fullscreenGraphCanvasMaxEdges : compactGraphCanvasMaxEdges,
      })), 0);
    }

    return () => {
      disposed = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (worker) worker.terminate();
    };
  }, [graph, graphPanelState.renderGraph, graphViewMode, graphCanvasFocusCharacterId, graphSearchQuery, graphNeighborDepth, graphEdgeMode, graphCanvasCacheKey, fullscreen]);

  useEffect(() => {
    if (!selectedCharacterId && graphFocusMode !== 'all') {
      setGraphFocusMode('all');
    }
  }, [graphFocusMode, selectedCharacterId]);

  useEffect(() => {
    if (graphRelationTypeFilter !== 'all' && !relationTypeOptions.includes(graphRelationTypeFilter)) {
      setGraphRelationTypeFilter('all');
    }
  }, [graphRelationTypeFilter, relationTypeOptions]);

  useEffect(() => {
    if (selectedGraphEdgeId && (!graph || !graph.edges.some((edge) => edge.id === selectedGraphEdgeId))) {
      setSelectedGraphEdgeId(null);
    }
  }, [graph, selectedGraphEdgeId]);

  useEffect(() => {
    if (!fullscreen && selectedGraphEdgeDetail) {
      onInspectRelationDetail(selectedGraphEdgeDetail);
    }
  }, [fullscreen, onInspectRelationDetail, selectedGraphEdgeDetail]);


  const graphPreview = !graphPanelState.renderGraph || !graph || !displayedGraphCanvas || !graphRenderModel || !characterPayload ? (
    renderCharacterGraphStatus(graphPanelState, t)
  ) : (
    <div className={fullscreen ? 'characters-graph-preview-app fullscreen' : 'characters-graph-preview-app compact'}>
          {fullscreen ? (
            <div className="characters-graph-preview-toolbar">
              <input
                type="search"
                placeholder={t('characters.graphSearchPlaceholder')}
                value={graphSearchDraft}
                onChange={(event) => {
                  setGraphSearchDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyGraphSearchDraft();
                  }
                }}
                aria-label={t('characters.graphSearch')}
              />
              <button type="button" onClick={applyGraphSearchDraft}>{t('characters.graphSearchApply')}</button>
              <button type="button" onClick={clearGraphSearch}>{t('characters.graphSearchClear')}</button>
              <ThemedSelect
                className="characters-graph-themed-select"
                label={t('characters.graphNeighborDepthFilter')}
                value={String(graphNeighborDepth) as '1' | '2' | 'all'}
                options={[{ value: '1', label: t('characters.graphNeighborDepthOne') }, { value: '2', label: t('characters.graphNeighborDepthTwo') }, { value: 'all', label: t('characters.graphNeighborDepthAll') }]}
                onChange={(value) => {
                  setGraphNeighborDepth(value === 'all' ? 'all' : Number(value) as CharacterGraphSessionNeighborDepth);
                  setSelectedGraphEdgeId(null);
                  resetGraphCanvasViewport();
                }}
                menuPlacement="bottom"
              />
              <ThemedSelect
                className="characters-graph-themed-select"
                label={t('characters.graphEdgeModeFilter')}
                value={graphEdgeMode}
                options={[{ value: 'skeleton', label: t('characters.graphEdgeModeSkeleton') }, { value: 'semantic', label: t('characters.graphEdgeModeSemantic') }, { value: 'all', label: t('characters.graphEdgeModeAll') }]}
                onChange={(value) => {
                  setGraphEdgeMode(value as CharacterGraphSessionEdgeMode);
                  setSelectedGraphEdgeId(null);
                  resetGraphCanvasViewport();
                }}
                menuPlacement="bottom"
              />
              <button type="button" onClick={resetPreviewGraph}>{t('characters.graphCanvasReset')}</button>
              <button type="button" onClick={() => onFullscreenChange(false)}>{t('characters.graphCanvasExitFullscreen')}</button>
              <div className="characters-graph-preview-stats">
                {t('characters.graphTableSummary', { nodes: displayedGraphCanvas.summary.visibleNodeCount, edges: displayedGraphCanvas.summary.visibleEdgeCount, relations: graph.summary.relationCount, visible: displayedGraphCanvas.summary.visibleEdgeCount })}
              </div>
            </div>
          ) : null}
          <div className="characters-graph-preview-content">
            <div className="characters-graph-preview-stage">
              {!fullscreen ? renderCharacterGraphRelationTable(graph) : null}
              <CharacterGraphWebglView
                canvas={displayedGraphCanvas}
                graph={graph}
                renderModel={graphRenderModel}
                viewport={graphCanvasViewport}
                selectedGraphEdgeId={selectedGraphEdgeId}
                highlightedNodeIds={graphSearchHighlightedNodeIds}
                onSelectEdge={selectGraphEdge}
                onSelectCharacter={onSelectCharacter}
                onFocusSearch={(characterId, label) => {
                  setGraphSearchDraft(label);
                  setGraphSearchQuery(label);
                  setGraphNeighborDepth(1);
                  setSelectedGraphEdgeId(null);
                  resetGraphCanvasViewport();
                }}
                onRestoreFullGraph={() => {
                  setGraphViewMode('full');
                  setGraphFocusMode('all');
                  setGraphSearchQuery('');
                  setGraphNeighborDepth(2);
                  setSelectedGraphEdgeId(null);
                  resetGraphCanvasViewport();
                }}
                fullscreen={fullscreen}
                onToggleFullscreen={() => onFullscreenChange(!fullscreen)}
                onViewportChange={setGraphCanvasViewport}
                viewportInitialized={graphSessionState.viewportInitialized}
                resetSignal={graphCanvasResetSignal}
                privacySettings={privacySettings}
                t={t}
                formatEdgeLabel={(edge) => formatCharacterGraphRelation(edge, privacySettings, t)}
                fallbackView={(
                  <CharacterGraphCanvasView
                    canvas={displayedGraphCanvas}
                    graph={graph}
                    viewport={graphCanvasViewport}
                    selectedGraphEdgeId={selectedGraphEdgeId}
                    highlightedNodeIds={graphSearchHighlightedNodeIds}
                    onSelectEdge={selectGraphEdge}
                    onSelectCharacter={onSelectCharacter}
                    onFocusSearch={(characterId, label) => {
                      setGraphSearchDraft(label);
                      setGraphSearchQuery(label);
                      setGraphNeighborDepth(1);
                      setSelectedGraphEdgeId(null);
                      resetGraphCanvasViewport();
                    }}
                    onRestoreFullGraph={() => {
                      setGraphViewMode('full');
                      setGraphFocusMode('all');
                      setGraphSearchQuery('');
                      setGraphNeighborDepth(2);
                      setSelectedGraphEdgeId(null);
                      resetGraphCanvasViewport();
                    }}
                    fullscreen={fullscreen}
                    onToggleFullscreen={() => onFullscreenChange(!fullscreen)}
                    onViewportChange={setGraphCanvasViewport}
                    viewportInitialized={graphSessionState.viewportInitialized}
                    resetSignal={graphCanvasResetSignal}
                    privacySettings={privacySettings}
                    t={t}
                    formatEdgeLabel={(edge) => formatCharacterGraphRelation(edge, privacySettings, t)}
                  />
                )}
              />
              {fullscreen ? <div className="characters-graph-preview-hud">Ctrl/滚轮缩放，拖动画布平移，双击人物聚焦</div> : null}
            </div>
            {fullscreen ? (
              <aside className="characters-graph-preview-side">
                {selectedGraphEdgeDetail ? renderCharacterGraphEdgeDetail(
                  selectedGraphEdgeDetail,
                  () => setSelectedGraphEdgeId(null),
                  onOpenEvidence,
                  privacySettings,
                  t,
                  formatLocation,
                  formatRelationMeta,
                ) : (
                  <section className="characters-graph-preview-inspector empty" aria-live="polite">
                    选中一条关系线后，这里会显示两个人物的关系、证据段落和原文跳转入口。
                  </section>
                )}
              </aside>
            ) : null}
          </div>
        </div>
  );
  const graphPreviewNode = fullscreen && graphPanelState.renderGraph && graph && displayedGraphCanvas && graphRenderModel && characterPayload && typeof document !== 'undefined'
    ? createPortal(graphPreview, document.body)
    : graphPreview;

  return (
    <article className="characters-graph-table-card" id="characters-relations" tabIndex={-1} aria-label={t('characters.graphTableTitle')}>
      <div className="characters-profile-board-head">
        <div>
          <p className="eyebrow">{t('characters.graphTableEyebrow')}</p>
          <h3>{t('characters.graphTableTitle')}</h3>
        </div>
        <span>{t('characters.graphTableSummary', { nodes: graph?.summary.nodeCount ?? 0, edges: relationTableRows.length, relations: graph?.summary.relationCount ?? 0, visible: relationTableRows.length })}</span>
      </div>
      {graphPreviewNode}
    </article>
  );

  function renderCharacterGraphRelationTable(currentGraph: CharacterGraphModel) {
    return (
      <div className="characters-graph-table-shell">
        <div className="characters-graph-table-toolbar">
          <input
            type="search"
            value={relationTableSearchQuery}
            onChange={(event) => setRelationTableSearchQuery(event.target.value)}
            placeholder={t('characters.graphTableSearchPlaceholder')}
            aria-label={t('characters.graphTableSearch')}
          />
          <span>{t('characters.graphTableGroupedSummary', { groups: relationTableRows.filter((row) => row.type === 'group').length, rows: relationTableRows.length })}</span>
        </div>
        <div
          ref={graphTableScrollRef}
          className="characters-graph-table-scroll"
          role="table"
          aria-label={t('characters.graphTableTitle')}
          onScroll={(event) => setGraphTableScrollTop(event.currentTarget.scrollTop)}
        >
          <div className="characters-graph-row characters-graph-header" role="row">
            <span role="columnheader">{t('characters.graphTableSource')}</span>
            <span role="columnheader">{t('characters.graphTableRelation')}</span>
            <span role="columnheader">{t('characters.graphTableTarget')}</span>
            <span role="columnheader">{t('characters.graphTableEvidence')}</span>
          </div>
          <div className="characters-graph-virtual-spacer" style={{ height: `${graphTableViewport.totalHeight}px` }}>
            {relationTableRows.slice(graphTableViewport.startIndex, graphTableViewport.endIndex).map((row, relativeIndex) => (
              renderCharacterGraphRelationTableRow(
                row,
                currentGraph,
                graphTableViewport.startIndex + relativeIndex,
              )
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderCharacterGraphRelationTableRow(
    row: CharacterGraphRelationTableRow,
    currentGraph: CharacterGraphModel,
    absoluteIndex: number,
  ) {
    const top = absoluteIndex * characterGraphRelationRowHeight;
    if (row.type === 'group') {
      const sourceNode = graphNodeById.get(row.sourceId) ?? null;
      const previewTargets = row.previewTargetIds
        .map((targetId) => getPrivacyBookTitle(graphNodeById.get(targetId)?.label || targetId, privacySettings))
        .join('、');
      return (
        <div className="characters-graph-row characters-graph-group-row" role="row" key={row.id} style={{ top: `${top}px` }}>
          <span role="cell">
            {renderCharacterGraphNodeButton(sourceNode, row.sourceId, onSelectCharacter, privacySettings, t)}
          </span>
          <span role="cell">
            <button className="characters-graph-relation-button" type="button" onClick={() => toggleRelationTableSource(row.sourceId)}>
              {row.expanded ? t('characters.graphTableCollapseTargets') : t('characters.graphTableExpandTargets')}
            </button>
          </span>
          <span role="cell" title={previewTargets}>
            <strong>{t('characters.graphTableTargetCount', { count: row.targetCount })}</strong>
            <em>{previewTargets}</em>
          </span>
          <span role="cell">{t('characters.graphTableEdgeCount', { count: row.edgeCount })}</span>
        </div>
      );
    }

    const edge = row.edge;
    const sourceNode = graphNodeById.get(edge.sourceId) ?? findGraphNode(currentGraph, edge.sourceId);
    const targetNode = graphNodeById.get(edge.targetId) ?? findGraphNode(currentGraph, edge.targetId);
    return (
      <div className="characters-graph-row characters-graph-edge-row" role="row" key={row.id} style={{ top: `${top}px` }}>
        <span role="cell">
          {renderCharacterGraphNodeButton(sourceNode, edge.sourceId, onSelectCharacter, privacySettings, t)}
        </span>
        <span role="cell" title={formatCharacterGraphRelation(edge, privacySettings, t)}>
          <button
            className={selectedGraphEdgeId === edge.id ? 'characters-graph-relation-button active' : 'characters-graph-relation-button'}
            type="button"
            onClick={() => selectGraphEdge(edge.id)}
            aria-label={t('characters.graphTableOpenRelation', { label: formatCharacterGraphRelation(edge, privacySettings, t) })}
          >
            {formatCharacterGraphRelation(edge, privacySettings, t)}
          </button>
        </span>
        <span role="cell">
          {renderCharacterGraphNodeButton(targetNode, edge.targetId, onSelectCharacter, privacySettings, t)}
        </span>
        {renderCharacterGraphEvidenceAction(edge, evidenceById, onOpenEvidence, t)}
      </div>
    );
  }

  function toggleRelationTableSource(sourceId: string) {
    setExpandedRelationTableSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function setGraphFocusMode(focusMode: CharacterGraphFocusMode) {
    onGraphSessionStateChange({ focusMode });
  }

  function setGraphRelationTypeFilter(relationTypeFilter: string) {
    onGraphSessionStateChange({ relationTypeFilter });
  }

  function setGraphMinConfidenceFilter(minConfidenceFilter: string) {
    onGraphSessionStateChange({ minConfidenceFilter });
  }

  function setGraphChapterStartFilter(chapterStartFilter: string) {
    onGraphSessionStateChange({ chapterStartFilter });
  }

  function setGraphChapterEndFilter(chapterEndFilter: string) {
    onGraphSessionStateChange({ chapterEndFilter });
  }

  function setSelectedGraphEdgeId(selectedGraphEdgeId: string | null) {
    onGraphSessionStateChange({ selectedGraphEdgeId });
  }

  function setGraphCanvasViewport(viewport: CharacterGraphCanvasViewport, viewportInitialized = true) {
    onGraphSessionStateChange({ viewport, viewportInitialized });
  }

  function setGraphViewMode(viewMode: CharacterGraphSessionViewMode) {
    onGraphSessionStateChange({ viewMode });
  }

  function setGraphSearchQuery(searchQuery: string) {
    onGraphSessionStateChange({ searchQuery });
  }

  function applyGraphSearchDraft() {
    const nextQuery = graphSearchDraft.trim();
    if (nextQuery === graphSearchQuery) return;
    setGraphSearchQuery(nextQuery);
    if (nextQuery) setGraphNeighborDepth(1);
    setSelectedGraphEdgeId(null);
    resetGraphCanvasViewport();
  }

  function clearGraphSearch() {
    if (!graphSearchDraft && !graphSearchQuery) return;
    setGraphSearchDraft('');
    setGraphSearchQuery('');
    setSelectedGraphEdgeId(null);
    resetGraphCanvasViewport();
  }

  function setGraphNeighborDepth(neighborDepth: CharacterGraphSessionNeighborDepth) {
    onGraphSessionStateChange({ neighborDepth });
  }

  function setGraphEdgeMode(edgeMode: CharacterGraphSessionEdgeMode) {
    onGraphSessionStateChange({ edgeMode });
  }

  function setGraphTableScrollTop(tableScrollTop: number) {
    onGraphSessionStateChange({ tableScrollTop });
  }
}

function renderCharacterGraphStatus(
  state: CharacterGraphPanelState,
  t: ReturnType<typeof useI18n>['t'],
) {
  return (
    <div className={`characters-graph-status ${state.status}`} role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite">
      <strong>{t(state.titleKey)}</strong>
      <p>{t(state.bodyKey)}</p>
    </div>
  );
}

function buildCharacterGraphRelationViewport(totalCount: number, scrollTop: number) {
  const safeCount = Math.max(0, Math.floor(totalCount));
  const safeScrollTop = Math.max(0, scrollTop);
  const firstVisible = Math.floor(safeScrollTop / characterGraphRelationRowHeight);
  const visibleCount = Math.ceil(characterGraphRelationViewportHeight / characterGraphRelationRowHeight);
  const startIndex = Math.max(0, firstVisible - characterGraphRelationOverscan);
  const endIndex = Math.min(safeCount, firstVisible + visibleCount + characterGraphRelationOverscan);
  return {
    startIndex,
    endIndex,
    totalHeight: safeCount * characterGraphRelationRowHeight,
  };
}

function findCharacterGraphSearchHighlightedNodeIds(nodes: CharacterGraphNode[], searchQuery: string) {
  const query = searchQuery.trim().toLocaleLowerCase();
  if (!query) return [];
  return nodes
    .filter((node) => node.label.toLocaleLowerCase().includes(query))
    .sort((left, right) => (
      (right.role === 'protagonist' ? 1 : 0) - (left.role === 'protagonist' ? 1 : 0)
      || (right.role === 'main' ? 1 : 0) - (left.role === 'main' ? 1 : 0)
      || right.mentionCount - left.mentionCount
      || right.importanceScore - left.importanceScore
      || left.id.localeCompare(right.id)
    ))
    .slice(0, 8)
    .map((node) => node.id);
}

function buildCharacterGraphChapterRange(startValue: string, endValue: string): CharacterGraphChapterRange | undefined {
  const startChapterIndex = parseVisibleChapterFilterValue(startValue);
  const endChapterIndex = parseVisibleChapterFilterValue(endValue);
  if (startChapterIndex === undefined && endChapterIndex === undefined) return undefined;
  return { startChapterIndex, endChapterIndex };
}

function parseVisibleChapterFilterValue(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed) - 1;
}

export function renderCharacterGraphEdgeDetail(
  detail: CharacterGraphEdgeDetail,
  onClose: () => void,
  onOpenEvidence: (evidence: CharacterEvidence) => void,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
  formatLocation: (location: CharacterLocation | undefined) => string,
  formatRelationMeta: (relation: CharacterRelation) => string,
) {
  const sourceName = getPrivacyBookTitle(detail.sourceProfile.displayName || detail.sourceProfile.canonicalName, privacySettings);
  const targetName = getPrivacyBookTitle(detail.targetProfile.displayName || detail.targetProfile.canonicalName, privacySettings);
  const relationTitle = getPrivacyBookTitle(detail.edge.label || detail.edge.relationType || t('characters.detailUnknownRelation'), privacySettings);
  return (
    <article className="characters-detail-panel characters-graph-edge-detail" id="characters-detail" aria-label={t('characters.graphEdgeDetailTitle')}>
      <div className="characters-graph-edge-detail-head">
        <div>
          <p className="eyebrow">{t('characters.graphEdgeDetailEyebrow')}</p>
          <h4>{sourceName} {detail.edge.direction === 'undirected' ? '<->' : '->'} {targetName}</h4>
          <p>{relationTitle}</p>
        </div>
        <div className="characters-graph-edge-detail-actions">
          <span>{t('characters.graphEdgeDetailSummary', detail.summary)}</span>
          <button className="ghost-btn small" type="button" onClick={onClose}>{t('characters.graphEdgeDetailClose')}</button>
        </div>
      </div>
      <section className="characters-detail-section">
        <h4>{t('characters.graphEdgeDetailEvidence')}</h4>
        {detail.evidence.length === 0 ? <p>{t('characters.graphTableNoEvidence')}</p> : (
          <div className="characters-detail-quote-list characters-graph-edge-evidence-list">
            {detail.evidence.slice(0, 8).map((item) => (
              <blockquote key={item.id}>
                <p>{getPrivacyBookTitle(item.quote || item.claim, privacySettings)}</p>
                {item.claim && item.claim !== item.quote ? <strong>{getPrivacyBookTitle(item.claim, privacySettings)}</strong> : null}
                <cite>{formatLocation(item.location)}</cite>
                <button
                  className="ghost-btn small"
                  type="button"
                  onClick={() => onOpenEvidence(item)}
                  aria-label={t('characters.graphTableJumpEvidence')}
                >
                  {t('characters.graphTableJumpEvidence')}
                </button>
              </blockquote>
            ))}
          </div>
        )}
      </section>
      <section className="characters-detail-section">
        <h4>{t('characters.graphEdgeDetailRelations')}</h4>
        {detail.relations.length === 0 ? <p>{t('characters.detailNone')}</p> : (
          <div className="characters-detail-record-list">
            {detail.relations.map((relation) => (
              <article key={relation.id}>
                <strong>{getPrivacyBookTitle(relation.label || relation.relationType || t('characters.detailUnknownRelation'), privacySettings)}</strong>
                <p>{getPrivacyBookTitle(relation.summary || relation.status || t('characters.detailNone'), privacySettings)}</p>
                <span>{formatRelationMeta(relation)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function renderCharacterGraphNodeButton(
  node: CharacterGraphNode | null,
  characterId: string,
  onSelectCharacter: (characterId: string) => void,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  const label = getPrivacyBookTitle(node?.label || characterId, privacySettings);
  const visual = node?.visual ?? { group: 'unknown', shape: 'square', marker: '?', labelKey: 'characters.profileKind.unknown' };
  const kindLabel = t(visual.labelKey);
  return (
    <button
      className={`characters-graph-node-button kind-${visual.group} shape-${visual.shape}`}
      type="button"
      onClick={() => onSelectCharacter(characterId)}
      title={`${kindLabel} · ${label}`}
      aria-label={t('characters.graphTableOpenCharacterWithKind', { kind: kindLabel, name: label })}
    >
      <span className="characters-graph-node-kind-badge" aria-hidden="true">{visual.marker}</span>
      <span className="characters-graph-node-name">{label}</span>
      <span className="characters-graph-node-kind-label">{kindLabel}</span>
    </button>
  );
}

function findGraphNode(graph: CharacterGraphModel, characterId: string) {
  return graph.nodes.find((item) => item.id === characterId) ?? null;
}

function renderCharacterGraphEvidenceAction(
  edge: CharacterGraphModel['edges'][number],
  evidenceById: Map<string, CharacterEvidence>,
  onOpenEvidence: (evidence: CharacterEvidence) => void,
  t: ReturnType<typeof useI18n>['t'],
) {
  const evidence = findEvidenceForGraphEdge(evidenceById, edge);
  if (!evidence) {
    return <span className="characters-graph-evidence-empty" role="cell">{t('characters.graphTableNoEvidence')}</span>;
  }
  return (
    <span role="cell">
      <button
        className="ghost-btn small"
        type="button"
        onClick={() => onOpenEvidence(evidence)}
        aria-label={t('characters.graphTableJumpEvidence')}
      >
        {t('characters.graphTableJumpEvidence')}
      </button>
    </span>
  );
}

function findEvidenceForGraphEdge(
  evidenceById: Map<string, CharacterEvidence>,
  edge: CharacterGraphModel['edges'][number],
) {
  for (const evidenceId of edge.evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    if (evidence) return evidence;
  }
  for (const evidence of evidenceById.values()) {
    if (edge.relationIds.includes(evidence.targetId) || evidence.targetId === edge.id) return evidence;
  }
  return null;
}

function formatCharacterGraphRelation(
  edge: CharacterGraphModel['edges'][number],
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  const label = getPrivacyBookTitle(edge.label || edge.relationType || t('characters.detailUnknownRelation'), privacySettings);
  return [
    label,
    edge.relationType ? getPrivacyBookTitle(edge.relationType, privacySettings) : '',
    t(edge.direction === 'undirected' ? 'characters.detailRelationUndirectedShort' : 'characters.detailRelationDirectedShort'),
    t('characters.detailEvidenceCount', { count: edge.evidenceIds.length }),
    t('characters.detailConfidence', { count: Math.round(edge.confidence * 100) }),
  ].filter(Boolean).join(' · ');
}

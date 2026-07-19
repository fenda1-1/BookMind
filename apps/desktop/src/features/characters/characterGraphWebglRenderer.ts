import {
  buildCharacterGraphHoverFrame,
  hitTestCharacterGraphRenderEdge,
  hitTestCharacterGraphRenderNode,
  queryVisibleCharacterGraphRenderFrame,
  type CharacterGraphRenderEdge,
  type CharacterGraphRenderFrame,
  type CharacterGraphRenderModel,
  type CharacterGraphRenderNode,
} from './characterGraphRenderModel';
import { buildCharacterGraphCanvasViewport, type CharacterGraphCanvasViewport } from './characterGraphCanvasModel';

export type CharacterGraphWebglTelemetry = {
  renderer: 'webgl';
  drawMode: 'retained';
  bufferUploadSerial: number;
  viewportUniformUpdates: number;
  hoverUploadSerial: number;
  drawSerial: number;
  edgeClipMode: CharacterGraphRenderFrame['edgeClipMode'];
  visibleNodeCount: number;
  candidateEdgeCount: number;
  drawnEdgeCount: number;
  totalEdgeCount: number;
  highZoom: boolean;
  hoverEdgeBudget: number;
  reactPointerCommits: 0;
};

export type CharacterGraphWebglRendererOptions = {
  canvas: HTMLCanvasElement;
  labelLayer: HTMLElement;
  renderModel: CharacterGraphRenderModel;
  viewport: CharacterGraphCanvasViewport;
  getNodeLabel: (node: CharacterGraphRenderNode) => string;
  onTelemetry?: (telemetry: CharacterGraphWebglTelemetry) => void;
};

export type CharacterGraphWebglHit = {
  nodeId: string | null;
  edgeId: string | null;
};

export type CharacterGraphWebglRenderer = {
  destroy: () => void;
  setModel: (renderModel: CharacterGraphRenderModel, viewport: CharacterGraphCanvasViewport) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  setViewport: (viewport: CharacterGraphCanvasViewport, mode?: 'interactive' | 'settled') => void;
  zoomAt: (screenX: number, screenY: number, deltaY: number) => CharacterGraphCanvasViewport;
  panBy: (screenDeltaX: number, screenDeltaY: number) => CharacterGraphCanvasViewport;
  handlePointerMove: (screenX: number, screenY: number) => CharacterGraphWebglHit;
  hitTestAt: (screenX: number, screenY: number) => CharacterGraphWebglHit;
  clearHover: () => void;
  getTelemetry: () => CharacterGraphWebglTelemetry;
};

type CharacterGraphWebglContext = WebGLRenderingContext | WebGL2RenderingContext;

const nodeStride = 8;
const edgeStride = 12;
const edgeVertexCount = 2;

export function createCharacterGraphWebglRenderer(options: CharacterGraphWebglRendererOptions): CharacterGraphWebglRenderer | null {
  const gl = options.canvas.getContext('webgl2', { antialias: true, alpha: false })
    ?? options.canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) return null;
  return new CharacterGraphWebglRendererImpl(gl, options);
}

class CharacterGraphWebglRendererImpl implements CharacterGraphWebglRenderer {
  private canvas: HTMLCanvasElement;
  private labelLayer: HTMLElement;
  private gl: CharacterGraphWebglContext;
  private model: CharacterGraphRenderModel;
  private viewport: CharacterGraphCanvasViewport;
  private getNodeLabel: (node: CharacterGraphRenderNode) => string;
  private onTelemetry: ((telemetry: CharacterGraphWebglTelemetry) => void) | undefined;
  private edgeProgram: WebGLProgram;
  private nodeProgram: WebGLProgram;
  private edgeBuffer: WebGLBuffer;
  private highlightEdgeBuffer: WebGLBuffer;
  private nodeBuffer: WebGLBuffer;
  private currentFrame: CharacterGraphRenderFrame;
  private selectedEdgeId: string | null = null;
  private hoveredNodeId: string | null = null;
  private hoveredEdgeId: string | null = null;
  private drawnEdgeVertexCount = 0;
  private highlightEdgeVertexCount = 0;
  private telemetry: CharacterGraphWebglTelemetry;
  private labelViewport: CharacterGraphCanvasViewport;
  private disposed = false;

  constructor(gl: CharacterGraphWebglContext, options: CharacterGraphWebglRendererOptions) {
    this.gl = gl;
    this.canvas = options.canvas;
    this.labelLayer = options.labelLayer;
    this.model = options.renderModel;
    this.viewport = options.viewport;
    this.getNodeLabel = options.getNodeLabel;
    this.onTelemetry = options.onTelemetry;
    this.edgeProgram = createProgram(gl, edgeVertexShader, edgeFragmentShader);
    this.nodeProgram = createProgram(gl, nodeVertexShader, nodeFragmentShader);
    this.edgeBuffer = createBuffer(gl);
    this.highlightEdgeBuffer = createBuffer(gl);
    this.nodeBuffer = createBuffer(gl);
    this.currentFrame = queryVisibleCharacterGraphRenderFrame(this.model, this.viewport, 1, 1);
    this.labelViewport = this.viewport;
    this.telemetry = {
      renderer: 'webgl',
      drawMode: 'retained',
      bufferUploadSerial: 0,
      viewportUniformUpdates: 0,
      hoverUploadSerial: 0,
      drawSerial: 0,
      edgeClipMode: 'viewport-bounds',
      visibleNodeCount: 0,
      candidateEdgeCount: 0,
      drawnEdgeCount: 0,
      totalEdgeCount: this.model.edgeCount,
      highZoom: false,
      hoverEdgeBudget: this.model.options.hoverEdgeBudget,
      reactPointerCommits: 0,
    };
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.setModel(this.model, this.viewport);
  }

  destroy() {
    this.disposed = true;
    const gl = this.gl;
    gl.deleteBuffer(this.edgeBuffer);
    gl.deleteBuffer(this.highlightEdgeBuffer);
    gl.deleteBuffer(this.nodeBuffer);
    gl.deleteProgram(this.edgeProgram);
    gl.deleteProgram(this.nodeProgram);
    this.labelLayer.replaceChildren();
  }

  setModel(renderModel: CharacterGraphRenderModel, viewport: CharacterGraphCanvasViewport) {
    if (this.disposed) return;
    this.model = renderModel;
    this.viewport = viewport;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.model.nodeBuffer, gl.STATIC_DRAW);
    this.telemetry.bufferUploadSerial += 1;
    this.updateVisibleFrame('settled');
    this.rebuildHighlightBuffer();
    this.draw();
  }

  setSelectedEdge(edgeId: string | null) {
    if (this.selectedEdgeId === edgeId) return;
    this.selectedEdgeId = edgeId;
    this.rebuildHighlightBuffer();
    this.draw();
  }

  setViewport(viewport: CharacterGraphCanvasViewport, mode: 'interactive' | 'settled' = 'settled') {
    if (this.disposed) return;
    this.viewport = viewport;
    this.telemetry.viewportUniformUpdates += 1;
    if (mode === 'settled') this.updateVisibleFrame('settled');
    else this.applyLabelLayerPreviewTransform();
    this.draw();
  }

  zoomAt(screenX: number, screenY: number, deltaY: number) {
    const zoomFactor = deltaY < 0 ? 1.18 : 1 / 1.18;
    const nextScale = clampWebglViewportScale(this.viewport.scale * zoomFactor);
    const worldBefore = this.screenToWorld(screenX, screenY);
    const nextViewport = buildCharacterGraphCanvasViewport({
      scale: nextScale,
      offsetX: screenX / nextScale - worldBefore.x,
      offsetY: screenY / nextScale - worldBefore.y,
    });
    return nextViewport;
  }

  panBy(screenDeltaX: number, screenDeltaY: number) {
    return buildCharacterGraphCanvasViewport({
      ...this.viewport,
      offsetX: this.viewport.offsetX + screenDeltaX / this.viewport.scale,
      offsetY: this.viewport.offsetY + screenDeltaY / this.viewport.scale,
    });
  }

  handlePointerMove(screenX: number, screenY: number) {
    const hit = this.hitTestAt(screenX, screenY);
    if (hit.nodeId !== this.hoveredNodeId || hit.edgeId !== this.hoveredEdgeId) {
      this.hoveredNodeId = hit.nodeId;
      this.hoveredEdgeId = hit.edgeId;
      this.rebuildHighlightBuffer();
      this.draw();
    }
    return hit;
  }

  hitTestAt(screenX: number, screenY: number): CharacterGraphWebglHit {
    const point = this.screenToWorld(screenX, screenY);
    const node = hitTestCharacterGraphRenderNode(this.model, point.x, point.y, this.viewport.scale);
    if (node) return { nodeId: node.id, edgeId: null };
    const edge = hitTestCharacterGraphRenderEdge(this.model, point.x, point.y, this.viewport.scale);
    return { nodeId: null, edgeId: edge?.id ?? null };
  }

  clearHover() {
    if (!this.hoveredNodeId && !this.hoveredEdgeId) return;
    this.hoveredNodeId = null;
    this.hoveredEdgeId = null;
    this.rebuildHighlightBuffer();
    this.draw();
  }

  getTelemetry() {
    return this.telemetry;
  }

  private updateVisibleFrame(mode: 'settled') {
    void mode;
    const rect = this.canvas.getBoundingClientRect();
    this.currentFrame = queryVisibleCharacterGraphRenderFrame(this.model, this.viewport, rect.width, rect.height);
    const visibleEdges = this.currentFrame.candidateEdgeIds
      .map((edgeId) => this.model.index.edgeById.get(edgeId))
      .filter((edge): edge is CharacterGraphRenderEdge => Boolean(edge));
    const visibleEdgeBuffer = packRenderEdges(visibleEdges);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, visibleEdgeBuffer, gl.DYNAMIC_DRAW);
    this.drawnEdgeVertexCount = visibleEdges.length * edgeVertexCount;
    this.telemetry.bufferUploadSerial += 1;
    this.renderLabels();
    this.applyProbeDatasets();
  }

  private rebuildHighlightBuffer() {
    const edges: CharacterGraphRenderEdge[] = [];
    const seen = new Set<string>();
    if (this.hoveredNodeId) {
      const hoverFrame = buildCharacterGraphHoverFrame(this.model, this.hoveredNodeId, this.currentFrame, {
        hoverEdgeBudget: this.model.options.hoverEdgeBudget,
      });
      for (const edgeId of hoverFrame.highlightEdgeIds) {
        const edge = this.model.index.edgeById.get(edgeId);
        if (edge && !seen.has(edge.id)) {
          seen.add(edge.id);
          edges.push(edge);
        }
      }
      this.canvas.dataset.hoverHighlightedEdgeCount = String(hoverFrame.highlightEdgeIds.length);
      this.canvas.dataset.hoverScannedEdgeCount = String(hoverFrame.queryStats.scannedEdgeCount);
    } else {
      this.canvas.dataset.hoverHighlightedEdgeCount = this.hoveredEdgeId ? '1' : '0';
      this.canvas.dataset.hoverScannedEdgeCount = this.hoveredEdgeId ? '1' : '0';
    }
    for (const edgeId of [this.hoveredEdgeId, this.selectedEdgeId]) {
      if (!edgeId) continue;
      const edge = this.model.index.edgeById.get(edgeId);
      if (edge && !seen.has(edge.id)) {
        seen.add(edge.id);
        edges.push(edge);
      }
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.highlightEdgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, packRenderEdges(edges, [0.18, 0.58, 0.24, 0.95]), gl.DYNAMIC_DRAW);
    this.highlightEdgeVertexCount = edges.length * edgeVertexCount;
    this.telemetry.hoverUploadSerial += 1;
    this.canvas.dataset.hoverEdgeBudget = String(this.model.options.hoverEdgeBudget);
  }

  private draw() {
    if (this.disposed) return;
    const gl = this.gl;
    const rect = this.resize();
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.972, 0.956, 0.925, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.drawEdges(this.edgeBuffer, this.drawnEdgeVertexCount, false, rect);
    this.drawEdges(this.highlightEdgeBuffer, this.highlightEdgeVertexCount, true, rect);
    this.drawNodes(rect);
    this.telemetry.drawSerial += 1;
    this.telemetry.edgeClipMode = this.currentFrame.edgeClipMode;
    this.telemetry.visibleNodeCount = this.currentFrame.visibleNodeIds.length;
    this.telemetry.candidateEdgeCount = this.currentFrame.candidateEdgeIds.length;
    this.telemetry.drawnEdgeCount = this.drawnEdgeVertexCount / edgeVertexCount;
    this.telemetry.totalEdgeCount = this.model.edgeCount;
    this.telemetry.highZoom = this.viewport.scale >= this.model.options.highZoomEdgeClipScale;
    this.applyTelemetryDataset();
    this.onTelemetry?.(this.telemetry);
  }

  private drawEdges(buffer: WebGLBuffer, vertexCount: number, highlight: boolean, rect: DOMRect) {
    if (vertexCount <= 0) return;
    const gl = this.gl;
    gl.useProgram(this.edgeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    this.applyCommonUniforms(this.edgeProgram, rect);
    const colorBoostLocation = gl.getUniformLocation(this.edgeProgram, 'u_colorBoost');
    if (colorBoostLocation) gl.uniform1f(colorBoostLocation, highlight ? 1 : 0);
    const positionLocation = gl.getAttribLocation(this.edgeProgram, 'a_position');
    const colorLocation = gl.getAttribLocation(this.edgeProgram, 'a_color');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, edgeStride * 4, 0);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, edgeStride * 4, 4 * 4);
    gl.drawArrays(gl.LINES, 0, vertexCount);
  }

  private drawNodes(rect: DOMRect) {
    if (this.model.nodeCount <= 0) return;
    const gl = this.gl;
    gl.useProgram(this.nodeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer);
    this.applyCommonUniforms(this.nodeProgram, rect);
    const positionLocation = gl.getAttribLocation(this.nodeProgram, 'a_position');
    const radiusLocation = gl.getAttribLocation(this.nodeProgram, 'a_radius');
    const colorLocation = gl.getAttribLocation(this.nodeProgram, 'a_color');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, nodeStride * 4, 0);
    gl.enableVertexAttribArray(radiusLocation);
    gl.vertexAttribPointer(radiusLocation, 1, gl.FLOAT, false, nodeStride * 4, 2 * 4);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, nodeStride * 4, 4 * 4);
    gl.drawArrays(gl.POINTS, 0, this.model.nodeCount);
  }

  private applyCommonUniforms(program: WebGLProgram, rect: DOMRect) {
    const gl = this.gl;
    const viewportLocation = gl.getUniformLocation(program, 'u_viewport');
    const viewLocation = gl.getUniformLocation(program, 'u_view');
    if (viewportLocation) gl.uniform2f(viewportLocation, rect.width, rect.height);
    if (viewLocation) gl.uniform4f(viewLocation, this.viewport.scale, this.viewport.offsetX, this.viewport.offsetY, window.devicePixelRatio || 1);
  }

  private renderLabels() {
    const fragment = document.createDocumentFragment();
    this.labelLayer.style.transform = '';
    for (const nodeId of this.currentFrame.labelNodeIds) {
      const node = this.model.index.nodeById.get(nodeId);
      if (!node) continue;
      const screen = this.worldToScreen(node.x, node.y);
      const label = document.createElement('span');
      label.className = `characters-graph-webgl-label tier-${node.labelTier}`;
      label.textContent = this.getNodeLabel(node);
      label.style.transform = `translate(${Math.round(screen.x)}px, ${Math.round(screen.y + node.radius * this.viewport.scale + 7)}px)`;
      fragment.appendChild(label);
    }
    this.labelLayer.replaceChildren(fragment);
    this.labelViewport = this.viewport;
    this.canvas.dataset.labelCount = String(this.currentFrame.labelNodeIds.length);
  }

  private applyLabelLayerPreviewTransform() {
    const scale = this.viewport.scale / Math.max(0.0001, this.labelViewport.scale);
    const translateX = this.viewport.scale * (this.viewport.offsetX - this.labelViewport.offsetX);
    const translateY = this.viewport.scale * (this.viewport.offsetY - this.labelViewport.offsetY);
    this.labelLayer.style.transform = `matrix(${formatWebglTransformNumber(scale)}, 0, 0, ${formatWebglTransformNumber(scale)}, ${formatWebglTransformNumber(translateX)}, ${formatWebglTransformNumber(translateY)})`;
  }

  private applyProbeDatasets() {
    const node = this.currentFrame.visibleNodeIds
      .map((nodeId) => this.model.index.nodeById.get(nodeId))
      .filter((item): item is CharacterGraphRenderNode => Boolean(item))
      .sort((left, right) => left.labelTier - right.labelTier || right.mentionCount - left.mentionCount)[0] ?? null;
    if (node) {
      const screen = this.worldToScreen(node.x, node.y);
      this.canvas.dataset.nodeProbeId = node.id;
      this.canvas.dataset.nodeProbeX = String(Math.round(screen.x));
      this.canvas.dataset.nodeProbeY = String(Math.round(screen.y));
    }
    const edgeProbe = this.findEdgeProbe();
    if (edgeProbe) {
      const { edge, point } = edgeProbe;
      const screen = this.worldToScreen(point.x, point.y);
      this.canvas.dataset.edgeProbeId = edge.id;
      this.canvas.dataset.edgeProbeX = String(Math.round(screen.x));
      this.canvas.dataset.edgeProbeY = String(Math.round(screen.y));
    }
  }

  private findEdgeProbe() {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const samples = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
    let best: { edge: CharacterGraphRenderEdge; point: { x: number; y: number }; score: number } | null = null;
    for (const edgeId of this.currentFrame.candidateEdgeIds) {
      const edge = this.model.index.edgeById.get(edgeId);
      if (!edge) continue;
      for (const sample of samples) {
        const point = linearPointAt(edge.x1, edge.y1, edge.x2, edge.y2, sample);
        const screen = this.worldToScreen(point.x, point.y);
        if (screen.x < 18 || screen.x > rect.width - 18 || screen.y < 18 || screen.y > rect.height - 18) continue;
        const nearestNodeGap = this.getNearestVisibleNodeGap(point.x, point.y);
        if (nearestNodeGap <= Math.max(12 / Math.max(0.08, this.viewport.scale), 3)) continue;
        const score = Math.hypot(screen.x - centerX, screen.y - centerY) - Math.min(edge.weight, 12) * 2 + 48 / Math.max(1, nearestNodeGap);
        if (!best || score < best.score) best = { edge, point, score };
      }
    }
    return best ? { edge: best.edge, point: best.point } : null;
  }

  private getNearestVisibleNodeGap(x: number, y: number) {
    let gap = Number.POSITIVE_INFINITY;
    for (const nodeId of this.currentFrame.visibleNodeIds) {
      const node = this.model.index.nodeById.get(nodeId);
      if (!node) continue;
      gap = Math.min(gap, Math.hypot(x - node.x, y - node.y) - node.radius);
    }
    return Number.isFinite(gap) ? gap : 999;
  }

  private applyTelemetryDataset() {
    const data = this.canvas.dataset;
    data.renderer = this.telemetry.renderer;
    data.drawMode = this.telemetry.drawMode;
    data.bufferUploadSerial = String(this.telemetry.bufferUploadSerial);
    data.viewportUniformUpdates = String(this.telemetry.viewportUniformUpdates);
    data.hoverUploadSerial = String(this.telemetry.hoverUploadSerial);
    data.drawSerial = String(this.telemetry.drawSerial);
    data.edgeClipMode = this.telemetry.edgeClipMode;
    data.visibleNodeCount = String(this.telemetry.visibleNodeCount);
    data.candidateEdgeCount = String(this.telemetry.candidateEdgeCount);
    data.drawnEdgeCount = String(this.telemetry.drawnEdgeCount);
    data.totalEdgeCount = String(this.telemetry.totalEdgeCount);
    data.highZoom = String(this.telemetry.highZoom);
    data.reactPointerCommits = '0';
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    return rect;
  }

  private screenToWorld(screenX: number, screenY: number) {
    return {
      x: screenX / this.viewport.scale - this.viewport.offsetX,
      y: screenY / this.viewport.scale - this.viewport.offsetY,
    };
  }

  private worldToScreen(x: number, y: number) {
    return {
      x: (x + this.viewport.offsetX) * this.viewport.scale,
      y: (y + this.viewport.offsetY) * this.viewport.scale,
    };
  }
}

function packRenderEdges(edges: CharacterGraphRenderEdge[], colorOverride?: [number, number, number, number]) {
  const buffer = new Float32Array(edges.length * edgeVertexCount * edgeStride);
  edges.forEach((edge, index) => {
    const first = index * edgeVertexCount * edgeStride;
    writeRenderEdgeVertex(buffer, first, edge, edge.x1, edge.y1, colorOverride);
    writeRenderEdgeVertex(buffer, first + edgeStride, edge, edge.x2, edge.y2, colorOverride);
  });
  return buffer;
}

function writeRenderEdgeVertex(
  buffer: Float32Array,
  offset: number,
  edge: CharacterGraphRenderEdge,
  x: number,
  y: number,
  colorOverride: [number, number, number, number] | undefined,
) {
  const color = colorOverride ?? edge.color;
  buffer[offset] = x;
  buffer[offset + 1] = y;
  buffer[offset + 2] = edge.weight;
  buffer[offset + 3] = edge.confidence;
  buffer[offset + 4] = color[0];
  buffer[offset + 5] = color[1];
  buffer[offset + 6] = color[2];
  buffer[offset + 7] = color[3];
  buffer[offset + 8] = edge.sourceIndex;
  buffer[offset + 9] = edge.targetIndex;
  buffer[offset + 10] = edge.controlX;
  buffer[offset + 11] = edge.controlY;
}

function createBuffer(gl: CharacterGraphWebglContext) {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Unable to create character graph WebGL buffer');
  return buffer;
}

function createProgram(gl: CharacterGraphWebglContext, vertexSource: string, fragmentSource: string) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create character graph WebGL program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Unable to link character graph WebGL program: ${log}`);
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

function compileShader(gl: CharacterGraphWebglContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create character graph WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`Unable to compile character graph WebGL shader: ${log}`);
  }
  return shader;
}

function quadraticPointAt(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

function linearPointAt(x1: number, y1: number, x2: number, y2: number, t: number) {
  return {
    x: x1 + (x2 - x1) * t,
    y: y1 + (y2 - y1) * t,
  };
}

function clampWebglViewportScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.round(Math.max(0.04, Math.min(64, value)) * 100) / 100;
}

function formatWebglTransformNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  return Math.abs(value) < 0.001 ? '0' : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

const edgeVertexShader = `
attribute vec2 a_position;
attribute vec4 a_color;
uniform vec2 u_viewport;
uniform vec4 u_view;
uniform float u_colorBoost;
varying vec4 v_color;
void main() {
  vec2 screen = (a_position + u_view.yz) * u_view.x;
  vec2 clip = vec2((screen.x / u_viewport.x) * 2.0 - 1.0, 1.0 - (screen.y / u_viewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = u_colorBoost > 0.5 ? vec4(0.18, 0.58, 0.24, 0.95) : a_color;
}
`;

const edgeFragmentShader = `
precision mediump float;
varying vec4 v_color;
void main() {
  gl_FragColor = v_color;
}
`;

const nodeVertexShader = `
attribute vec2 a_position;
attribute float a_radius;
attribute vec4 a_color;
uniform vec2 u_viewport;
uniform vec4 u_view;
varying vec4 v_color;
void main() {
  vec2 screen = (a_position + u_view.yz) * u_view.x;
  vec2 clip = vec2((screen.x / u_viewport.x) * 2.0 - 1.0, 1.0 - (screen.y / u_viewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(3.0, a_radius * u_view.x * 2.0 * u_view.w);
  v_color = a_color;
}
`;

const nodeFragmentShader = `
precision mediump float;
varying vec4 v_color;
void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float distanceFromCenter = dot(point, point);
  if (distanceFromCenter > 1.0) discard;
  float border = smoothstep(0.72, 0.95, distanceFromCenter);
  vec4 stroke = vec4(0.25, 0.24, 0.21, 0.72);
  gl_FragColor = mix(v_color, stroke, border);
}
`;

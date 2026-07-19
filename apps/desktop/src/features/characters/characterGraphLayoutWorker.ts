import { buildCharacterGraphCanvasModel, type CharacterGraphCanvasModel, type CharacterGraphCanvasOptions } from './characterGraphCanvasModel';
import type { CharacterGraphModel } from './characterGraphModel';

export type CharacterGraphLayoutWorkerRequest = {
  requestId: number;
  graph: Pick<CharacterGraphModel, 'nodes' | 'edges'>;
  options?: CharacterGraphCanvasOptions;
};

export type CharacterGraphLayoutWorkerResponse = {
  requestId: number;
  canvas: CharacterGraphCanvasModel;
};

self.onmessage = (event: MessageEvent<CharacterGraphLayoutWorkerRequest>) => {
  const { requestId, graph, options } = event.data;
  const canvas = buildCharacterGraphCanvasModel(graph, options);
  (self as unknown as { postMessage: (message: CharacterGraphLayoutWorkerResponse) => void }).postMessage({
    requestId,
    canvas,
  } satisfies CharacterGraphLayoutWorkerResponse);
};

import type { ReaderBookmark } from '../../types';
import {
  buildReaderSearchIndex,
  createReaderSearchExecution,
  type ReaderChapter,
  type ReaderHighlightRange,
  type ReaderSearchHit,
  type ReaderSearchIndex,
  type ReaderSearchOptions,
} from './readerModel';

export type ReaderSearchWorkerRequest =
  | { type: 'reset-index'; generation: number }
  | { type: 'append-chapters'; generation: number; chapters: ReaderChapter[] }
  | { type: 'set-annotations'; generation: number; highlights: ReaderHighlightRange[]; bookmarks: ReaderBookmark[] }
  | { type: 'complete-index'; generation: number }
  | { type: 'search'; generation: number; requestId: number; query: string; options: ReaderSearchOptions }
  | { type: 'cancel'; requestId: number };

export type ReaderSearchWorkerResponse =
  | { type: 'progress'; generation: number; requestId: number; hits: ReaderSearchHit[] }
  | { type: 'results'; generation: number; requestId: number; hits: ReaderSearchHit[] }
  | { type: 'error'; generation: number; requestId: number; error: string };

let generation = 0;
let chapters: ReaderChapter[] = [];
let highlights: ReaderHighlightRange[] = [];
let bookmarks: ReaderBookmark[] = [];
let index: ReaderSearchIndex | null = null;
let activeRequestId = 0;
let runToken = 0;
const SEARCH_CANDIDATES_PER_STEP = 2048;

self.onmessage = (event: MessageEvent<ReaderSearchWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    if (request.requestId === activeRequestId) runToken += 1;
    return;
  }
  if (request.type === 'reset-index') {
    generation = request.generation;
    chapters = [];
    highlights = [];
    bookmarks = [];
    index = null;
    runToken += 1;
    return;
  }
  if (request.generation !== generation) return;
  if (request.type === 'append-chapters') {
    chapters.push(...request.chapters);
    return;
  }
  if (request.type === 'set-annotations') {
    highlights = request.highlights;
    bookmarks = request.bookmarks;
    if (index) index = buildReaderSearchIndex(chapters, highlights, bookmarks);
    return;
  }
  if (request.type === 'complete-index') {
    index = buildReaderSearchIndex(chapters, highlights, bookmarks);
    return;
  }
  if (!index) return;
  activeRequestId = request.requestId;
  const currentToken = ++runToken;
  const execution = createReaderSearchExecution(index, request.query, request.options);
  void runSearch(execution, request.generation, request.requestId, currentToken);
};

async function runSearch(
  execution: ReturnType<typeof createReaderSearchExecution>,
  requestGeneration: number,
  requestId: number,
  token: number,
) {
  let nextProgressAt = performance.now();
  try {
    while (token === runToken && requestGeneration === generation) {
      const result = execution.step(SEARCH_CANDIDATES_PER_STEP);
      if (result.done) {
        self.postMessage({ type: 'results', generation: requestGeneration, requestId, hits: result.hits } satisfies ReaderSearchWorkerResponse);
        return;
      }
      const now = performance.now();
      if (now >= nextProgressAt) {
        const hits = execution.getPartialHits();
        if (hits.length) {
          self.postMessage({ type: 'progress', generation: requestGeneration, requestId, hits } satisfies ReaderSearchWorkerResponse);
        }
        nextProgressAt = now + 64;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } catch (error) {
    if (token !== runToken || requestGeneration !== generation) return;
    self.postMessage({
      type: 'error',
      generation: requestGeneration,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    } satisfies ReaderSearchWorkerResponse);
  }
}

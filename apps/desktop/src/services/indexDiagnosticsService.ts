import type { AiDiagnostics, Book, BookIndexManifest, IndexDiagnostics, SemanticCapabilityNotice } from '../types';
import { loadIndexDiagnostics } from './taskService';
import { appDomainEventNames } from './appDomainEvents';
import { emitBrowserDomainEvent } from './browserDomainEvents';

export const indexDiagnosticsUpdatedEvent = 'bookmind:index-diagnostics-updated';
export const tasksUpdatedEvent = appDomainEventNames.tasksUpdated;

let cachedDiagnostics: IndexDiagnostics | null = null;

export async function loadSharedIndexDiagnostics(): Promise<IndexDiagnostics> {
  const diagnostics = await loadIndexDiagnostics();
  cachedDiagnostics = diagnostics;
  emitBrowserDomainEvent(indexDiagnosticsUpdatedEvent, diagnostics);
  return diagnostics;
}

export function getCachedIndexDiagnostics() {
  return cachedDiagnostics;
}

export function findBookIndexManifest(diagnostics: IndexDiagnostics | null | undefined, bookId: string): BookIndexManifest | null {
  if (!diagnostics || !bookId) return null;
  return diagnostics.books.find((entry) => entry.bookId === bookId) ?? null;
}

export function getBookIndexView(book: Book | null | undefined, diagnostics: IndexDiagnostics | null | undefined) {
  const manifest = book ? findBookIndexManifest(diagnostics, book.id) : null;
  const chunkCount = manifest?.chunkCount ?? book?.chunks?.length ?? 0;
  const ftsRows = manifest?.ftsRowCount ?? 0;
  const diagnosticsLoaded = Boolean(diagnostics);
  const status = manifest?.status ?? (chunkCount > 0 ? 'ready' : 'missing');
  const staleReason = manifest?.staleReason ?? '';
  return {
    manifest,
    status,
    chunkCount,
    ftsRows,
    staleReason,
    ready: status === 'ready' && chunkCount > 0 && (!diagnosticsLoaded || ftsRows > 0),
    missing: status === 'missing' || chunkCount === 0 || (diagnosticsLoaded && ftsRows === 0),
    stale: status === 'stale',
    failed: status === 'failed',
  };
}

export function getIndexEmptyState(diagnostics: IndexDiagnostics | null | undefined) {
  const summary = diagnostics?.summary;
  if (!diagnostics) return null;
  if (!summary || summary.indexedChunkCount === 0) {
    return {
      status: 'missing',
      title: '当前没有可检索内容',
      detail: '',
      action: '导入 TXT 或在任务中心运行解析索引',
    };
  }
  if (!summary.ftsAvailable) {
    return {
      status: 'missing',
      title: '当前没有可检索内容',
      detail: '全文检索 FTS 不可用',
      action: 'FTS 缺失，请前往任务中心修复 FTS',
    };
  }
  return null;
}

export function getBookIndexEmptyState(book: Book | null | undefined, diagnostics: IndexDiagnostics | null | undefined) {
  if (!book) return getIndexEmptyState(diagnostics);
  const indexView = getBookIndexView(book, diagnostics);
  if (indexView.failed) {
    return {
      status: 'failed',
      title: '当前书索引失败',
      detail: indexView.manifest?.lastError ?? '',
      action: '前往任务中心查看错误日志或重建索引',
    };
  }
  if (indexView.stale) {
    return {
      status: 'stale',
      title: '当前书索引已过期',
      detail: indexView.staleReason || '索引策略、章节规则或原文内容已变化',
      action: '前往任务中心重建索引后再搜索',
    };
  }
  if (indexView.missing) {
    return {
      status: 'missing',
      title: '当前书尚未索引',
      detail: '',
      action: '在阅读现场或任务中心运行解析索引',
    };
  }
  return getIndexEmptyState(diagnostics);
}

export function getSemanticCapabilityNotice(diagnostics: IndexDiagnostics | null | undefined): SemanticCapabilityNotice | null {
  const summary = diagnostics?.summary;
  if (!summary?.ftsAvailable) return null;
  if (summary.sidecarStatus === 'available' && summary.vectorIndexStatus === 'ready') return null;

  const sidecarStatus = summary.sidecarStatus ?? 'not-configured';
  const vectorIndexStatus = summary.vectorIndexStatus ?? 'not-built';
  const sidecarMessage = summary.sidecarMessage ? ` ${summary.sidecarMessage}` : '';

  return {
    status: 'unavailable',
    title: '本地全文检索可用',
    detail: `语义能力待配置：sidecar ${sidecarStatus}，vector ${vectorIndexStatus}。${sidecarMessage}`.trim(),
    action: '当前会继续使用本地 FTS；配置 sidecar 并构建 vector index 后再启用语义检索。',
  };
}

export function createBookIndexAiDiagnostics(
  book: Book | null | undefined,
  diagnostics: IndexDiagnostics | null | undefined,
  options: { scope?: string; queryUsed?: string } = {},
): AiDiagnostics {
  const indexView = getBookIndexView(book, diagnostics);
  const status = indexView.status;
  const staleReason = indexView.staleReason || undefined;
  const errorKind = indexView.stale ? 'stale-index' : indexView.failed ? 'index-failed' : 'no-index';
  const recommendations = indexView.stale
    ? ['索引已过期，请前往任务中心重建索引', '改用当前章全文总结']
    : indexView.failed
      ? ['索引构建失败，请前往任务中心查看错误日志', '重建该书索引']
      : ['去任务中心重新索引', '改用当前章全文总结'];

  return {
    scope: options.scope,
    queryUsed: options.queryUsed,
    chunkCount: indexView.chunkCount,
    ftsAvailable: indexView.ftsRows > 0,
    resultCount: 0,
    fallbackUsed: false,
    errorKind,
    indexStatus: status,
    staleReason,
    semanticCapabilityNotice: getSemanticCapabilityNotice(diagnostics),
    recommendations,
  };
}

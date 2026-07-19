import type { Book, BookIndexManifest, CharacterCenterBookSummary, CharacterIndexStatus, IndexDiagnostics, TaskStatus } from '../../types';

export function buildCharacterCenterBookSummaries(
  books: Book[],
  indexDiagnostics: IndexDiagnostics | null | undefined,
  tasks: TaskStatus[] = [],
): CharacterCenterBookSummary[] {
  return books
    .filter((book) => !book.deleted)
    .map((book) => buildCharacterCenterBookSummary(book, indexDiagnostics, tasks));
}

export function buildCharacterCenterBookSummary(
  book: Book,
  indexDiagnostics: IndexDiagnostics | null | undefined,
  tasks: TaskStatus[] = [],
): CharacterCenterBookSummary {
  const manifest = findBookIndexManifest(indexDiagnostics, book.id);
  const characterTask = latestCharacterTaskForBook(tasks, book.id);
  const characterTaskFailed = characterTask?.status === 'failed';
  const diagnosticsLoaded = Boolean(indexDiagnostics);
  const textIndexChunkCount = manifest?.chunkCount ?? book.chunks?.length ?? 0;
  const ftsRows = manifest?.ftsRowCount ?? 0;
  const textIndexStatus = manifest?.status ?? (textIndexChunkCount > 0 ? 'ready' : 'missing');
  const textIndexReady = textIndexStatus === 'ready' && textIndexChunkCount > 0 && (!diagnosticsLoaded || ftsRows > 0);
  const characterTaskErrorMessage = characterTask ? characterTask.errorMessage || characterTask.error.message : '';
  const characterTaskErrorCode = characterTask ? characterTask.errorCode || characterTask.error.code : '';
  const characterTaskErrorStage = characterTask ? characterTask.error.stage || characterTask.stage : '';
  return {
    id: book.id,
    title: book.title,
    displayTitle: book.displayTitle,
    author: book.author,
    fileName: book.fileName,
    coverTone: book.coverTone,
    coverLabel: book.coverLabel,
    coverImagePath: book.coverImagePath,
    progress: book.progress,
    textIndexStatus,
    textIndexReady,
    textIndexChunkCount,
    textIndexFtsRows: ftsRows,
    characterIndexStatus: resolveCharacterIndexStatus(textIndexReady, characterTask),
    characterCount: 0,
    relationCount: 0,
    evidenceCount: 0,
    lastCharacterBuiltAt: '',
    staleReason: manifest?.staleReason ?? '',
    lastError: characterTaskFailed ? (characterTaskErrorMessage || (manifest?.lastError ?? '')) : manifest?.lastError ?? '',
    lastTaskId: characterTask?.id ?? '',
    errorCode: characterTaskFailed ? characterTaskErrorCode : '',
    errorStage: characterTaskFailed ? characterTaskErrorStage : '',
    recentLogEntry: characterTask?.message ?? '',
  };
}

function findBookIndexManifest(indexDiagnostics: IndexDiagnostics | null | undefined, bookId: string): BookIndexManifest | null {
  if (!indexDiagnostics || !bookId) return null;
  return indexDiagnostics.books.find((entry) => entry.bookId === bookId) ?? null;
}

function latestCharacterTaskForBook(tasks: TaskStatus[], bookId: string): TaskStatus | null {
  return tasks
    .filter((task) => task.bookId === bookId && task.kind === 'character-extraction')
    .sort((left, right) => taskSortMillis(right) - taskSortMillis(left))[0] ?? null;
}

function taskSortMillis(task: TaskStatus): number {
  return [task.finishedAt, task.updatedAt, task.startedAt, task.createdAt]
    .map((value) => parseTaskMillis(value))
    .find((value) => value > 0) ?? 0;
}

function parseTaskMillis(value: string): number {
  if (!value) return 0;
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsedDate = Date.parse(value);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

function resolveCharacterIndexStatus(textIndexReady: boolean, task: TaskStatus | null): CharacterIndexStatus {
  if (!textIndexReady) return 'blocked-by-text-index';
  if (!task) return 'missing';
  if (task.status === 'queued' || task.status === 'paused') return 'queued';
  if (task.status === 'running' || task.status === 'cancelling') return 'building';
  if (task.status === 'succeeded') return 'ready';
  if (task.status === 'failed') return 'failed';
  return 'missing';
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const events = read('services/appDomainEvents.ts');
const readerAnnotationEvents = read('services/readerAnnotationEvents.ts');

assert.match(events, /type AppDomainEventDetailMap/u, 'domain events must define payload contracts');
assert.match(events, /function emitLibraryUpdated/u, 'library mutations must use a named domain event');
assert.match(events, /function requestLibraryRefresh/u, 'network-book refreshes must use a named domain event');
assert.match(events, /function subscribeLibraryUpdated/u, 'library consumers must subscribe through the domain event service');
assert.match(events, /tasksCompleted: 'bookmind:tasks-completed'/u, 'task completion events must have a typed contract');
assert.match(events, /tasksUpdated: 'bookmind:tasks-updated'/u, 'task refresh events must have a typed contract');
assert.match(events, /notesUpdated: 'bookmind:notes-updated'/u, 'knowledge note refreshes must have a typed contract');
assert.match(events, /highlightsUpdated: 'bookmind:highlights-updated'/u, 'knowledge highlight refreshes must have a typed contract');
assert.match(events, /flashcardsUpdated: 'bookmind:flashcards-updated'/u, 'knowledge flashcard refreshes must have a typed contract');
assert.match(events, /readerFlashLocation: 'bookmind:reader-flash-location'/u, 'reader location jumps must have a typed contract');
assert.match(readerAnnotationEvents, /emitReaderAnnotationsUpdated/u, 'reader annotation changes must expose a named event emitter');
assert.match(readerAnnotationEvents, /subscribeReaderAnnotationsUpdated/u, 'knowledge consumers must subscribe to reader annotation changes');
assert.match(readerAnnotationEvents, /sourceId/u, 'cross-window reader annotation events must suppress same-source echoes');

for (const path of [
  'app/App.tsx',
  'app/useLibrary.ts',
  'app/appTaskActions.ts',
  'features/task-center/useTaskCenterState.ts',
  'features/reader-core/ReaderToolbar.tsx',
  'pages/LibraryPage.tsx',
  'pages/reader-workspace/useReaderWorkspaceDocument.ts',
  'services/taskService.ts',
  'app/useTaskCenter.ts',
  'app/appAiSessionActions.ts',
  'features/ai-reader/AiStructuredAnswerView.tsx',
  'features/ai-reader/AiStructuredSectionRenderers.tsx',
  'pages/KnowledgePage.tsx',
  'pages/OverviewPage.tsx',
  'pages/reader-workspace/useReaderWorkspacePersistence.ts',
  'pages/ReaderWorkspace.tsx',
  'features/reader-core/ReaderPage.tsx',
]) {
  const source = read(path);
  assert.doesNotMatch(source, /bookmind:(?:library-(?:updated|refresh-request)|tasks-(?:updated|completed)|(?:notes|highlights|flashcards)-updated|reader-flash-location)/u, `${path} must not hard-code managed domain event names`);
}

console.log('Verified typed library domain events replace scattered window event strings.');

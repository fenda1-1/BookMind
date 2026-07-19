import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const persistence = readFileSync(new URL('./useReaderWorkspacePersistence.ts', import.meta.url), 'utf8');
const readerPage = readFileSync(new URL('../../features/reader-core/ReaderPage.tsx', import.meta.url), 'utf8');
const standaloneLauncher = readFileSync(new URL('./readerWindowLauncher.ts', import.meta.url), 'utf8');

assert.match(
  persistence,
  /pendingReaderStateSaveRef/u,
  'Reader position persistence should keep the latest debounced state in a ref so book switches cannot drop it.',
);
assert.match(
  persistence,
  /function flushPendingReaderStateSave/u,
  'Reader position persistence should expose a flush path for pending state.',
);
assert.match(
  persistence,
  /useEffect\(\(\) => \(\) => \{[\s\S]{0,220}flushPendingReaderStateSave\(\)/u,
  'Reader position persistence should flush pending state when switching books or unmounting.',
);
assert.doesNotMatch(
  persistence,
  /return \(\) => \{[\s\S]{0,180}window\.clearTimeout\(readerStateSaveTimerRef\.current\)[\s\S]{0,80}readerStateSaveTimerRef\.current = null;[\s\S]{0,80}\};\n  \}, \[book, stateKey, settings, safeChapterIndex, activeParagraphIndex/u,
  'Reader state save effect must not cancel the pending debounce on every paragraph change.',
);
assert.match(
  persistence,
  /if \(hidden && !standaloneReader\) return;[\s\S]{0,120}if \(!book \|\| restoringRef\.current\) return;/u,
  'Hidden main-window reader must not persist the default opening position over the saved per-book state.',
);

assert.match(
  readerPage,
  /lastBookRestoreKeyRef/u,
  'Reader page should track the last restored book/location key.',
);
assert.match(
  readerPage,
  /restoreFlowAnchorAfterBookSwitch\(\)/u,
  'Flow reader should restore the saved paragraph when a book is opened or switched back to.',
);
const prepareBookRestoreIndex = readerPage.indexOf("pendingBookRestoreIdRef.current = book?.id ?? ''");
const restoreBookPositionIndex = readerPage.indexOf("if (!book || settings.layoutMode !== 'flow' || pendingBookRestoreIdRef.current !== book.id) return;");
assert.ok(prepareBookRestoreIndex >= 0 && restoreBookPositionIndex > prepareBookRestoreIndex, 'Flow reader should prepare the pending book before restoring its saved position.');
assert.match(
  readerPage.slice(Math.max(0, prepareBookRestoreIndex - 40), prepareBookRestoreIndex),
  /useLayoutEffect\(\(\) => \{[\s\S]*$/u,
  'Flow reader must prepare book restoration in a layout effect so the first intersection observation cannot overwrite it with page one.',
);
assert.match(
  readerPage,
  /scroll\.querySelector<HTMLElement>\(`\[data-location="\$\{getChapterLocation\(sourceChapterIndex, activeParagraphIndex\)\}"\]`\)/u,
  'Flow restore should target the saved source chapter and paragraph, not only the chapter start.',
);
assert.doesNotMatch(
  standaloneLauncher,
  /chapterIndex = state\?\.activeChapterIndex \?\? 0/u,
  'Ordinary standalone reader launches must not turn a missing location into an explicit chapter-zero override.',
);
assert.match(
  standaloneLauncher,
  /const launchChapterIndex = chapterIndex \?\? state\?\.activeChapterIndex;[\s\S]*if \(launchChapterIndex !== undefined\) search\.set\('chapter'/u,
  'Standalone launch URLs should include a chapter only when the caller explicitly supplies a live location.',
);
assert.match(
  standaloneLauncher,
  /if \(state && launchChapterIndex === state\.activeChapterIndex\) \{[\s\S]*search\.set\('paragraph'[\s\S]*search\.set\('screenPage'/u,
  'Detached standalone launches should hand off the complete chapter, paragraph, and screen-page position.',
);

console.log('Verified reader switches preserve and restore concrete flow text position.');

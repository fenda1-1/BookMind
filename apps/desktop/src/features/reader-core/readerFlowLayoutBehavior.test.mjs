import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const readerContent = readFileSync(new URL('./ReaderContent.tsx', import.meta.url), 'utf8');
const readerPage = readFileSync(new URL('./ReaderPage.tsx', import.meta.url), 'utf8');
const readerStyles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.match(
  readerContent,
  /const pageTurnData = settings\.layoutMode === 'page' \? pageTurnKey : undefined/u,
  'Flow layout should not attach page-turn data that can retrigger page animations during scroll virtualization.',
);
assert.match(
  readerContent,
  /data-page-turn=\{pageTurnData\}/u,
  'ReaderContent should only expose page-turn data through the layout-aware pageTurnData value.',
);
assert.match(
  readerContent,
  /const readerEpubNoteJoiner = '\\u2060'/u,
  'Numbered EPUB note refs should be glued to adjacent text with a word-joiner so they do not force a line break.',
);
assert.match(
  readerContent,
  /readerEpubNoteJoiner[\s\S]{0,420}<button className="reader-epub-note-ref"[\s\S]{0,420}readerEpubNoteJoiner/u,
  'EPUB note ref buttons should render word-joiners on both sides of the badge.',
);
assert.match(
  readerStyles,
  /\.reader-epub-note-ref \{[^}]*font-size:\s*\.46em[^}]*padding:\s*0 \.18em/u,
  'Numbered EPUB note refs should stay compact enough to avoid unnecessary line wrapping.',
);
assert.match(
  readerStyles,
  /\.reader-stage\.layout-flow \.reader-page \{[^}]*animation:\s*none/u,
  'Flow layout reader pages must not run page animations when chapters mount during scrolling.',
);

const outDir = join(tmpdir(), `bookmind-reader-flow-layout-test-${process.pid}`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', outDir, '--skipLibCheck', 'src/features/reader-core/readerModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });
const { getFlowReaderChapterRange } = await import(pathToFileURL(join(outDir, 'features/reader-core/readerModel.js')).href);

const chapters = Array.from({ length: 36 }, (_, index) => ({ id: `ch-${index}`, index, title: `第${index + 1}章`, paragraphs: [`正文 ${index}`] }));
const longTxtChapters = Array.from({ length: 1226 }, (_, index) => ({ id: `txt-${index}`, index, title: `第${index + 1}章`, paragraphs: [`正文 ${index}`] }));
const hugeTxtChapters = Array.from({ length: 4000 }, (_, index) => ({ id: `huge-${index}`, index, title: `第${index + 1}章`, paragraphs: [`正文 ${index}`] }));
assert.deepEqual(
  getFlowReaderChapterRange(chapters, 0, 1, { bookFormat: 'EPUB' }),
  { start: 0, end: 2, before: 0, after: 34 },
  'EPUB flow reading should keep a small render window and rely on boundary scrolling to load lower chapters.',
);
assert.deepEqual(
  getFlowReaderChapterRange(longTxtChapters, 0, 1, { bookFormat: 'TXT' }),
  { start: 0, end: 2, before: 0, after: 1224 },
  'Normal large TXT flow reading should keep a small current-window render instead of mounting every chapter at once.',
);
assert.deepEqual(
  getFlowReaderChapterRange(hugeTxtChapters, 18, 3, { bookFormat: 'TXT', fullRenderChapterLimit: 3000 }),
  { start: 18, end: 22, before: 18, after: 3978 },
  'Very large non-EPUB flow reading should keep a forward current-plus-next window.',
);
assert.match(
  readerPage,
  /function handleFlowVirtualBoundaryScroll/u,
  'Flow layout should advance virtual chapter windows when the reader scrolls near folded boundaries.',
);
assert.match(
  readerPage,
  /flowVirtualBoundaryLastScrollTopRef/u,
  'Flow boundary paging should track the last scrollTop so programmatic scroll clamping cannot be mistaken for user intent.',
);
assert.match(
  readerPage,
  /const scrollDelta = scroll\.scrollTop - flowVirtualBoundaryLastScrollTopRef\.current/u,
  'Flow boundary paging should derive the actual scroll direction before switching virtual chapter windows.',
);
assert.match(
  readerPage,
  /scrollDelta > 1[\s\S]{0,140}nearBottom[\s\S]{0,180}virtualRange\.after > 0[\s\S]{0,760}const nextChapterIndex = Math\.min\(activeChapterIndex \+ 1[\s\S]{0,760}onSelectChapterPage\(nextChapterIndex/u,
  'Scrolling near the lower folded boundary should load the next virtual chapter window.',
);
assert.match(
  readerPage,
  /captureFlowScrollAnchorAtViewport\(\{ preferChapterIndex: nextChapterIndex, requirePreferred: true \}\)/u,
  'Lower boundary paging should only switch after it can anchor to text that remains visible in the next virtual chapter window.',
);
assert.match(
  readerPage,
  /suppressFlowLocationObserverUntilRef\.current = Date\.now\(\) \+ 900[\s\S]{0,520}scheduleRestoreFlowScrollAnchor\(\)[\s\S]{0,260}onSelectChapterPage\(nextChapterIndex/u,
  'Virtual boundary paging should suppress flow location observation so the old chapter cannot immediately steal focus back.',
);
assert.match(
  readerPage,
  /scrollDelta < -1[\s\S]{0,140}nearTop[\s\S]{0,180}virtualRange\.before > 0[\s\S]{0,420}scheduleRestoreFlowScrollAnchor\(\)[\s\S]{0,180}onSelectChapterPage\(Math\.max\(0, activeChapterIndex - 1/u,
  'Scrolling near the upper folded boundary should load the previous virtual chapter window.',
);
assert.match(
  readerPage,
  /captureFlowScrollAnchorFromElement\(visible\)[\s\S]{0,260}onSelectChapter\(chapterValue, paragraphValue\)/u,
  'Flow location observation should capture the visible paragraph before active chapter changes can move the virtual render window.',
);
assert.match(
  readerPage,
  /scheduleRestoreFlowScrollAnchor\(\)/u,
  'Flow location observation should restore the captured paragraph after virtual chapter window changes.',
);
assert.match(
  readerPage,
  /useLayoutEffect\(\(\) => \{[\s\S]{0,260}restorePendingFlowScrollAnchor\(\)/u,
  'Flow scroll anchors must be restored after React commits the new virtual chapter window and before paint.',
);
assert.match(
  readerPage,
  /restorePendingFlowScrollAnchor\(attempt \+ 1\)/u,
  'Flow scroll anchor restoration should retry across frames until the target paragraph is mounted.',
);
assert.match(
  readerPage,
  /pendingEpubNoteJumpRef/u,
  'EPUB note jumps in flow layout should keep a pending target while virtual chapters mount.',
);
assert.match(
  readerPage,
  /function scrollToPendingEpubNote/u,
  'EPUB note jumps should retry after React commits the target note block.',
);
assert.match(
  readerPage,
  /function getEpubNoteScrollTarget\(noteId: string\)/u,
  'EPUB note jumps should resolve a visible scroll target instead of scrolling the zero-size note marker.',
);
assert.match(
  readerPage,
  /\.closest<HTMLElement>\('(?:\.reader-epub-note-block, \.source-paragraph|\.source-paragraph, \.reader-epub-note-block)'\)/u,
  'EPUB note jumps should scroll the containing note paragraph so the note text is immediately visible.',
);
assert.match(
  readerPage,
  /const target = getEpubNoteScrollTarget\(pending\.noteId\)[\s\S]{0,220}target\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/u,
  'Pending EPUB note jumps should center the resolved note block after virtual chapters mount.',
);
assert.match(
  readerPage,
  /useLayoutEffect\(\(\) => \{[\s\S]{0,220}scrollToPendingEpubNote\(\)/u,
  'Flow EPUB note jumps should be retried in a layout effect after visible chapters change.',
);
assert.match(
  readerPage,
  /pendingEpubNoteJumpRef\.current = \{ noteId, chapterIndex, paragraphIndex \}/u,
  'Clicking an EPUB note ref should record the note target location before switching virtual chapters.',
);
assert.match(
  readerPage,
  /settings\.layoutMode === 'flow'[\s\S]{0,80}\? activeChapterIndex \+ 1[\s\S]{0,80}:/u,
  'Flow layout page meter should report the active book chapter instead of the tiny virtual render window index.',
);
assert.match(
  readerPage,
  /settings\.layoutMode === 'flow'[\s\S]{0,80}\? Math\.max\(1, chapters\.length\)[\s\S]{0,80}:/u,
  'Flow layout page meter should report total book chapters instead of the tiny virtual render window size.',
);
assert.match(
  readerPage,
  /const runningPageCount = settings\.layoutMode === 'flow'[\s\S]{0,100}\? Math\.max\(1, chapters\.length\)/u,
  'Flow layout running headers and footers should use the full chapter count instead of the tiny virtual render window size.',
);
assert.match(
  readerContent,
  /settings\.layoutMode === 'flow'[\s\S]{0,100}\? chapter\.index \+ 1/u,
  'Flow layout running headers and footers should display the source chapter number for each rendered chapter.',
);

console.log('Verified flow layout disables page animations and keeps EPUB chapters continuously renderable.');

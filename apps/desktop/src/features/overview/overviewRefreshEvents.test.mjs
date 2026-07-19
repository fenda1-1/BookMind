import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const persistence = readFileSync(new URL('../../pages/reader-workspace/useReaderWorkspacePersistence.ts', import.meta.url), 'utf8');
const pdfView = readFileSync(new URL('../reader-core/PdfReaderView.tsx', import.meta.url), 'utf8');
const markdownView = readFileSync(new URL('../reader-core/MarkdownReaderView.tsx', import.meta.url), 'utf8');
const externalView = readFileSync(new URL('../../pages/reader-workspace/ReaderExternalView.tsx', import.meta.url), 'utf8');

assert.match(
  persistence,
  /emitHighlightsUpdated\(\)/u,
  'reader-created highlights should notify the overview dashboard after persistence succeeds',
);
assert.match(
  externalView,
  /<PdfReaderView book=\{book\} onProgressChange=\{onProgressChange\}/u,
  'PDF reader should report reading progress to the overview dashboard',
);
assert.match(
  externalView,
  /<MarkdownReaderView book=\{book\} onProgressChange=\{onProgressChange\}/u,
  'Markdown reader should report reading progress to the overview dashboard',
);
assert.match(pdfView, /onProgressChange\?:/u, 'PDF reader should accept a progress callback.');
assert.match(markdownView, /onProgressChange\?:/u, 'Markdown reader should accept a progress callback.');

console.log('Verified overview refresh events cover reader highlights and external reader progress.');

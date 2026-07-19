import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../../pages/ReaderWorkspace.tsx', import.meta.url), 'utf8');
const externalView = readFileSync(new URL('../../pages/reader-workspace/ReaderExternalView.tsx', import.meta.url), 'utf8');
const documentHook = readFileSync(new URL('../../pages/reader-workspace/useReaderWorkspaceDocument.ts', import.meta.url), 'utf8');
const view = readFileSync(new URL('./MarkdownReaderView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.match(workspace, /resolveReaderExternalViewKind\(book, chapters, safeChapterIndex\)/u, 'Reader workspace should route external formats through its format adapter.');
assert.match(externalView, /isMarkdownBookFormat\(book\.format\)/u, 'External reader routing should detect Markdown formats.');
assert.match(externalView, /import\('\.\.\/\.\.\/features\/reader-core\/MarkdownReaderView'\)/u, 'Markdown reader should be loaded on demand.');
assert.match(externalView, /kind === 'markdown'[^\n]*<MarkdownReaderView book=\{book\} onProgressChange=\{onProgressChange\}/u, 'Markdown books should render through the dedicated view and report progress.');

assert.match(documentHook, /const isExternalRenderBook = isPdfBook \|\| isMarkdownBook/u, 'Markdown books should bypass normal TXT document parsing.');
assert.match(documentHook, /resolveInstantReaderBook\(book, isExternalRenderBook, readerDocument, readerDocumentCache\)/u, 'Markdown should not be resolved as an instant TXT reader book.');
assert.match(documentHook, /shouldBlockForReaderDocument\(\{\s*isPdfBook: isExternalRenderBook/u, 'Markdown should not block on TXT worker document loading.');

assert.match(view, /buildMarkdownReaderDocument/u, 'MarkdownReaderView should use the Markdown model.');
assert.match(view, /loadReaderDocument\(book\.id\)/u, 'MarkdownReaderView should load full source content when the library row has no content.');
assert.doesNotMatch(view, /buildReaderChapters|createReaderChapterParsingOptions|readerDocumentWorker/u, 'MarkdownReaderView must not use TXT chapter rules or the reader document worker.');
assert.match(view, /className="markdown-reader-toc"/u, 'MarkdownReaderView should render a dedicated heading TOC.');

assert.match(styles, /\.markdown-reader-body\.toc-open\s*\{[^}]*grid-template-columns:\s*minmax\(220px, 280px\) minmax\(0,1fr\)/s, 'Markdown reader should use a documentation-style TOC/content layout when TOC is open.');
assert.match(styles, /\.markdown-reader-scroll\s*\{[^}]*overflow:\s*auto/s, 'Markdown content pane should scroll independently.');
assert.match(styles, /\.markdown-reader-toc-list\s*\{[^}]*overflow:\s*auto/s, 'Markdown TOC pane should scroll independently.');

console.log('Verified Markdown books route to a dedicated documentation-style reader.');

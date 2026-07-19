import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('./MarkdownReaderView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.match(view, /case 'table':/u, 'MarkdownReaderView should render parsed GFM table blocks.');
assert.match(view, /<table className="markdown-reader-table">/u, 'Markdown tables should use a real table element.');
assert.match(view, /case 'break':\s*return <br/u, 'Markdown inline <br> should render as a line break.');
assert.match(view, /case 'image':/u, 'Markdown image syntax should render image nodes instead of literal ![] text.');
assert.match(view, /className="markdown-inline-image"/u, 'Inline Markdown images should use a dedicated image class.');
assert.match(view, /className="markdown-task-checkbox"/u, 'Task list items should render checkbox indicators instead of raw [x] text.');
assert.match(view, /function handleMarkdownLinkClick/u, 'MarkdownReaderView should handle link clicks instead of relying on inert anchors.');
assert.match(view, /openExternalUrl\(normalizedHref\)/u, 'Markdown external links should use the desktop external URL command.');
assert.match(view, /normalizedHref\.startsWith\('#'\)/u, 'Markdown internal #heading links should be routed inside the current document.');
assert.match(view, /onClick=\{\(event\) => onLinkClick\(event, segment\.href\)\}/u, 'Rendered Markdown links should use the click router.');
assert.match(view, /resolveMarkdownImageSrc\(segment\.src, book\)/u, 'Markdown images should resolve paths relative to the current book.');
assert.match(view, /buildMarkdownTocTree/u, 'Markdown TOC should build a nested tree for collapsible sections.');
assert.match(view, /collapsedTocIds/u, 'Markdown TOC should track collapsed section ids.');
assert.match(view, /markdown-reader-toc-toggle/u, 'Markdown TOC parent headings should expose a collapse toggle.');

assert.match(styles, /\.markdown-reader-table-wrap\s*\{[^}]*overflow:\s*auto/s, 'Wide Markdown tables should scroll horizontally inside the document.');
assert.match(styles, /\.markdown-reader-table\s*\{[^}]*border-collapse:\s*separate/s, 'Markdown tables should have dedicated readable table styling.');
assert.match(styles, /\.markdown-task-checkbox\s*\{[^}]*appearance:\s*none/s, 'Task checkboxes should be styled consistently with the reader theme.');
assert.match(styles, /\.markdown-reader-toc-children/u, 'Nested Markdown TOC sections should have dedicated tree styling.');

console.log('Verified Markdown GFM table and task list rendering hooks.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tocSource = readFileSync(new URL('./ReaderTocPanel.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.ok(tocSource.includes('className="reader-toc-number"'), 'TOC chapter number should use a dedicated class instead of styling every span');
assert.ok(tocSource.includes('className="reader-toc-main"'), 'TOC title and metadata should be wrapped in a stable main column');
assert.ok(tocSource.includes('className="reader-toc-meta"'), 'TOC metadata should be grouped so volume, word count, and progress cannot overlap');
assert.ok(tocSource.includes('className="reader-toc-progress"'), 'TOC progress percentage should have a distinct non-overlapping style hook');

assert.match(styles, /\.reader-toc-list \.reader-toc-number\b/, 'TOC number pill styling should target only the number class');
assert.match(styles, /\.reader-toc-main\s*\{[^}]*display:\s*grid/s, 'TOC main column should own title/meta vertical layout');
assert.match(styles, /\.reader-toc-meta\s*\{[^}]*display:\s*flex/s, 'TOC metadata should flow in one wrapping flex row');
assert.match(styles, /\.reader-toc-progress\s*\{[^}]*flex:\s*0 0 auto/s, 'TOC progress should keep a stable inline width');

console.log('Verified Reader TOC metadata layout avoids title/progress overlap.');

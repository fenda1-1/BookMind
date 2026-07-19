import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./PdfReaderView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/zh-CN.ts', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../i18n/en-US.ts', import.meta.url), 'utf8');

assert.match(
  source,
  /type PdfTocItem = \{[\s\S]*?parentId: string \| null;[\s\S]*?hasChildren: boolean;[\s\S]*?\}/u,
  'PDF TOC items should retain parent/child metadata for collapsible list rendering.',
);
assert.match(
  source,
  /resolveVisiblePdfTocItems\(tocItems, collapsedTocItemIds\)/u,
  'PDF list TOC should filter collapsed descendants.',
);
assert.match(
  source,
  /tocMode === 'thumbnails' \? pageIndexes\.map/u,
  'PDF thumbnail TOC should render one thumbnail card per page, not one card per outline heading.',
);
assert.match(
  source,
  /visibleTocItems\.map/u,
  'PDF list TOC should render outline titles separately from page thumbnails.',
);
assert.match(
  source,
  /className=\{collapsedTocItemIds\.has\(item\.id\) \? 'pdf-reader-toc-toggle collapsed' : 'pdf-reader-toc-toggle'\}/u,
  'PDF list TOC should expose a collapse toggle for parent outline items.',
);
assert.doesNotMatch(
  styles,
  /\.pdf-reader-toc-list\.list \.pdf-reader-toc-item-body \{ display: none; \}/u,
  'PDF list TOC must not hide outline titles.',
);
assert.match(
  styles,
  /\.pdf-reader-toc-row \{[^}]*grid-template-columns:\s*24px minmax\(0,1fr\)/u,
  'PDF list TOC should reserve space for expand/collapse controls.',
);
assert.match(zh, /'reader\.external\.toc\.expand': '展开目录项'/u);
assert.match(en, /'reader\.external\.toc\.expand': 'Expand TOC item'/u);

console.log('Verified PDF TOC list and thumbnail modes.');

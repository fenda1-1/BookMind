import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./PdfReaderView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.match(
  source,
  /const PDF_PAGE_RENDER_BUFFER = 2/u,
  'PDF reader should keep a small render window around the current page.',
);
assert.match(
  source,
  /const \[renderWindow, setRenderWindow\]/u,
  'PDF reader should track a virtualized render window.',
);
assert.match(
  source,
  /const shouldRenderPage = Boolean\(pdfDocument && index >= renderWindow\.start && index <= renderWindow\.end\)/u,
  'PDF reader should only mount canvases for pages inside the render window.',
);
assert.doesNotMatch(
  source,
  /const \[pages, setPages\] = useState<PDFPageProxy\[\]>/u,
  'PDF reader should not keep every PDFPageProxy in React state.',
);
assert.doesNotMatch(
  source,
  /for \(let index = 1; index <= doc\.numPages; index \+= 1\)[\s\S]{0,120}doc\.getPage\(index\)/u,
  'PDF reader should not synchronously load every page proxy when opening a document.',
);
assert.match(
  source,
  /IntersectionObserver/u,
  'PDF TOC thumbnails should render lazily when they enter the sidebar viewport.',
);
assert.match(
  styles,
  /\.pdf-page-virtual-frame/u,
  'PDF virtual page frames should reserve stable page space while canvases are unmounted.',
);

console.log('Verified PDF reader memory policy.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./PdfReaderView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ TextLayerBuilder \} from 'pdfjs-dist\/web\/pdf_viewer\.mjs';/u,
  'PDF reader should use pdf.js TextLayerBuilder for native selection behavior.',
);
assert.match(
  source,
  /new TextLayerBuilder\(\{[\s\S]*?pdfPage: page![\s\S]*?onAppend:[\s\S]*?textLayerHost\.append\(element\)[\s\S]*?abortSignal: abortController\.signal[\s\S]*?\}\)/u,
  'PDF reader should build selectable text through the official builder and append it into the page overlay.',
);
assert.match(
  source,
  /textLayerBuilder\.div\.classList\.add\('pdf-page-text-layer'\)/u,
  'PDF text layer should receive the BookMind page overlay class.',
);
assert.match(
  source,
  /textLayerBuilder\?\.cancel\?\.\(\)/u,
  'PDF text layer rendering should be cancelled when a virtual page unmounts.',
);
assert.match(
  styles,
  /\.pdf-page-virtual-frame \{[^}]*position:\s*relative/u,
  'PDF page frame should create the positioning context for the overlay text layer.',
);
assert.match(
  styles,
  /\.pdf-page-text-layer-host \{[^}]*position:\s*absolute;[^}]*z-index:\s*2/u,
  'PDF text layer host should sit above the canvas.',
);
assert.match(
  styles,
  /\.pdf-page-text-layer span, \.pdf-page-text-layer br \{[^}]*user-select:\s*text/u,
  'PDF text layer spans should be selectable.',
);
assert.match(
  styles,
  /\.pdf-page-text-layer ::selection \{[^}]*var\(--indigo\) 28%/u,
  'PDF selected text should use a lighter overlay instead of a heavy blocky selection color.',
);

console.log('Verified selectable PDF text layer.');

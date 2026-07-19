import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./readerSettings.ts', import.meta.url), 'utf8');

const expectedSnippets = [
  "pageMode: 'double'",
  'fontSize: 16',
  'lineHeight: 1.2',
  'paragraphSpacing: 9',
  'pageWidth: 1160',
  'bodyMarginX: 24',
  'bodyMarginY: 24',
  'headerMarginY: 0',
  'footerMarginY: 0',
  "titleAlign: 'center'",
  "headerLeft: 'time'",
  "headerRight: 'title'",
  "footerRight: 'page'",
  'headerFooterFontSize: 15',
  "pageAnimation: 'turn'",
];

for (const snippet of expectedSnippets) {
  assert.ok(source.includes(snippet), `defaultReaderSettings should include ${snippet}`);
}

console.log('Verified default Reader settings match the Jian Lai exported profile.');

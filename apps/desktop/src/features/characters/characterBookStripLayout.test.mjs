import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = [readFileSync('src/app/styles/layout.css', 'utf8'), readFileSync('src/app/styles/characters.css', 'utf8')].join('\n');

assert.match(
  styles,
  /\.characters-book-strip\s*\{[^}]*display:\s*grid[^}]*overflow-y:\s*auto[^}]*scrollbar-width:\s*thin/u,
  'Character book picker should be an independently scrollable vertical book index.',
);

assert.match(
  styles,
  /\.characters-book-strip::-webkit-scrollbar\s*\{[^}]*width:\s*9px/u,
  'Character book picker should expose a visible vertical scrollbar.',
);

assert.match(
  styles,
  /\.characters-book-option\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*minmax\(0,1fr\) 44px[^}]*overflow:\s*hidden[\s\S]*\.characters-book-option-main\s*\{[^}]*grid-template-columns:\s*42px minmax\(0,1fr\)/u,
  'Character book cards should fill the left index and reserve stable cover, copy, and menu columns.',
);

console.log('Verified character book picker uses a vertical indexed list.');

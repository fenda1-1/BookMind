import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-character-book-strip-wheel-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterBookStripWheel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { handleCharacterBookStripWheel } = require(join(outDir, 'characterBookStripWheel.js'));

const target = { scrollLeft: 20, scrollWidth: 1000, clientWidth: 300 };
const event = createWheelEvent(target, { deltaY: 120, deltaX: 0 });

assert.equal(handleCharacterBookStripWheel(event), true, 'vertical wheel over a horizontal book strip should be handled');
assert.equal(target.scrollLeft, 140, 'vertical wheel should move the horizontal strip instead of the page');
assert.equal(event.defaultPrevented, true, 'handled wheel events must prevent page vertical scrolling');
assert.equal(event.propagationStopped, true, 'handled wheel events must not bubble to outer scroll containers');

const boundaryTarget = { scrollLeft: 700, scrollWidth: 1000, clientWidth: 300 };
const boundaryEvent = createWheelEvent(boundaryTarget, { deltaY: 120, deltaX: 0 });
assert.equal(handleCharacterBookStripWheel(boundaryEvent), true, 'wheel events over a scrollable strip should stay captured at the horizontal boundary');
assert.equal(boundaryTarget.scrollLeft, 700, 'horizontal strip should clamp at its max scroll position');
assert.equal(boundaryEvent.defaultPrevented, true, 'boundary wheel events should still not scroll the whole page');

const staticTarget = { scrollLeft: 0, scrollWidth: 300, clientWidth: 300 };
const staticEvent = createWheelEvent(staticTarget, { deltaY: 120, deltaX: 0 });
assert.equal(handleCharacterBookStripWheel(staticEvent), false, 'non-scrollable strips should not capture wheel events');
assert.equal(staticEvent.defaultPrevented, false);

const charactersPage = readFileSync('src/pages/CharactersPage.tsx', 'utf8');
const characterListPanel = readFileSync('src/pages/CharacterListPanel.tsx', 'utf8');
for (const [name, source] of [['CharactersPage', charactersPage], ['CharacterListPanel', characterListPanel]]) {
  assert.match(source, /addEventListener\('wheel', onWheel, \{ passive: false \}\)/u, `${name} must bind book strip wheel with a non-passive native listener`);
  assert.doesNotMatch(source, /onWheel=\{handleCharacterBookStripWheel\}/u, `${name} must not use React onWheel for the book strip because it can be passive`);
}

function createWheelEvent(currentTarget, overrides) {
  return {
    currentTarget,
    deltaX: overrides.deltaX,
    deltaY: overrides.deltaY,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
}

console.log('Verified character book strip captures vertical wheel as horizontal scroll.');

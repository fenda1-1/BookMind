import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(new URL('../library/LibraryPageToolbar.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8');

assert.match(
  toolbar,
  /className=\{`library-icon-toolbar\$\{toolbarPopover \? ' popover-open' : ''\}`\}/s,
  'library toolbar should add an open-state class while sort/filter/import popovers are visible',
);

const toolbarOpenRule = styles.match(/\.library-icon-toolbar\.popover-open\s*\{[^}]*z-index:\s*(\d+)/s);
assert.ok(toolbarOpenRule, 'open library toolbar should raise its stacking context above nearby controls');

const popoverRule = styles.match(/\.library-toolbar-popover\s*\{[^}]*z-index:\s*(\d+)/s);
const selectOpenRule = styles.match(/\.themed-select\.open\s*\{[^}]*z-index:\s*(\d+)/s);
const selectMenuRule = styles.match(/\.themed-select-menu\s*\{[^}]*z-index:\s*(\d+)/s);

assert.ok(popoverRule, 'library toolbar popover should define an explicit z-index');
assert.ok(selectOpenRule, 'themed select open state should define an explicit z-index');
assert.ok(selectMenuRule, 'themed select menu should define an explicit z-index');

const toolbarOpenZ = Number(toolbarOpenRule[1]);
const popoverZ = Number(popoverRule[1]);
const selectOpenZ = Number(selectOpenRule[1]);
const selectMenuZ = Number(selectMenuRule[1]);

assert.ok(toolbarOpenZ > selectOpenZ, 'open library toolbar stacking context should sit above open selects below it');
assert.ok(popoverZ > selectMenuZ, 'library popover should sit above select menus within the raised toolbar context');

console.log('Verified library import popover layers above lower batch dropdown controls.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(new URL('./ReaderToolbar.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/readerStyles.css', import.meta.url), 'utf8');

assert.match(
  toolbar,
  /type ReaderToolbarTooltip = \{[\s\S]*?text: string;[\s\S]*?left: number;[\s\S]*?top: number;[\s\S]*?\}/u,
  'Reader toolbar should keep tooltip position in component state',
);
assert.match(
  toolbar,
  /getReaderToolbarTooltipTarget\(target: EventTarget \| null\)[\s\S]*?closest<HTMLElement>\('\[data-tooltip\]'\)/u,
  'Reader toolbar should discover tooltip targets through data-tooltip',
);
assert.match(
  toolbar,
  /className="reader-toolbar"[\s\S]*?onPointerOver=\{onToolbarPointerOver\}[\s\S]*?onFocus=\{onToolbarFocus\}/u,
  'Reader toolbar should use delegated pointer and focus events for tooltips',
);
assert.match(
  toolbar,
  /createPortal\([\s\S]*?className="reader-toolbar-tooltip"[\s\S]*?role="tooltip"[\s\S]*?style=\{\{ left: toolbarTooltip\.left, top: toolbarTooltip\.top \}\}[\s\S]*?document\.body/u,
  'Reader toolbar tooltip should render through a body portal so reader layout containers cannot offset it',
);
assert.match(
  styles,
  /\.reader-toolbar \.reader-icon-btn:hover::after, \.reader-toolbar \.reader-icon-btn:focus-visible::after \{ content: none; \}/u,
  'Reader toolbar should disable old pseudo-element tooltips to avoid duplicate hints',
);
assert.match(
  styles,
  /\.reader-toolbar-tooltip \{[^}]*position:\s*fixed;[^}]*z-index:\s*10020/u,
  'Reader toolbar tooltip overlay should escape toolbar overflow and render above the reader chrome',
);

console.log('Verified reader toolbar overlay tooltips.');

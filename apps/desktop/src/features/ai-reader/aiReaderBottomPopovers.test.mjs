import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AiReaderPanel.tsx', import.meta.url), 'utf8');

assert.match(source, /type AiBottomPopoverId = 'attachment' \| 'scope' \| 'mode' \| 'evidence' \| 'model';/u);
assert.match(source, /function toggleBottomPopover\(target: AiBottomPopoverId\)/u);
assert.match(source, /const next = isOpen \? null : target;/u);
assert.match(source, /setAttachmentPopoverOpen\(next === 'attachment'\);/u);
assert.match(source, /setScopePopoverOpen\(next === 'scope'\);/u);
assert.match(source, /setModePopoverOpen\(next === 'mode'\);/u);
assert.match(source, /setEvidencePopoverOpen\(next === 'evidence'\);/u);
assert.match(source, /setModelPopoverOpen\(next === 'model'\);/u);

for (const popover of ['attachment', 'scope', 'mode', 'evidence', 'model']) {
  assert.match(source, new RegExp(`onClick=\\{\\(\\) => toggleBottomPopover\\('${popover}'\\)\\}`, 'u'), `Bottom ${popover} button should use the shared exclusive popover toggle.`);
}

assert.doesNotMatch(source, /onClick=\{\(\) => setAttachmentPopoverOpen\(\(open\) => !open\)\}/u);
assert.doesNotMatch(source, /onClick=\{\(\) => setScopePopoverOpen\(\(open\) => !open\)\}/u);
assert.doesNotMatch(source, /onClick=\{\(\) => setModePopoverOpen\(\(open\) => !open\)\}/u);
assert.doesNotMatch(source, /onClick=\{\(\) => setEvidencePopoverOpen\(\(open\) => !open\)\}/u);
assert.doesNotMatch(source, /onClick=\{\(\) => setModelPopoverOpen\(\(open\) => !open\)\}/u);

console.log('Verified bottom AI popovers are mutually exclusive.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('src/features/ai-reader/AiReaderPanel.tsx', 'utf8');
const styles = readFileSync('src/app/styles/settings.css', 'utf8');

assert.match(styles, /\.ai-scope-popover\.agent-toolbox-popover \{[^}]*z-index:\s*2[0-9]{2}/u, 'Agent toolbox popover should render above the AI header controls');
assert.match(styles, /\.ai-scope-popover\.agent-toolbox-popover \{[^}]*max-height:\s*min\(560px,\s*calc\(100vh - 220px\)\)/u, 'Agent toolbox popover should stay below the top toolbar and scroll instead of overflowing upward');
assert.match(styles, /\.ai-scope-popover\.agent-toolbox-popover \{[^}]*overflow:\s*auto/u, 'Agent toolbox popover itself should scroll as the outer panel');
assert.doesNotMatch(styles, /\.ai-scope-popover\.agent-toolbox-popover \{[^}]*78vh/u, 'Agent toolbox popover should not use the old over-tall 78vh height');
assert.match(styles, /\.ai-agent-toolbox-outer-scroll \{[^}]*overflow:\s*visible/u, 'Agent toolbox shell should let the popover provide the outer scroll');
assert.match(styles, /\.ai-agent-toolbox-scroll \{[^}]*overflow:\s*visible/u, 'Agent toolbox content should flow inside the outer scroll panel');
assert.match(styles, /\.ai-agent-toolbox-disclosure\[open\] \{[^}]*max-height:\s*min\(360px,\s*38vh\)/u, 'Expanded Agent toolbox should reserve enough height for tool rows without making the popover too tall');
assert.match(styles, /\.ai-agent-toolbox-list \{[^}]*overflow:\s*auto/u, 'Agent toolbox list should also scroll internally when many tools are expanded');
assert.match(panel, /className="ai-agent-tool-title"/u, 'Agent tool title should be separate from the enable toggle so clicking it can expand details');
assert.match(panel, /className="ai-agent-toolbox-outer-scroll"/u, 'Agent panel should wrap all content below the header in an outer scroll container');
assert.match(panel, /className="ai-agent-toolbox-scroll"/u, 'Agent panel content should be wrapped in the scroll container');
assert.match(panel, /ai-agent-task-card/u, 'Agent toolbox should render the task goal/status panel');
assert.match(styles, /\.ai-agent-task-card /u, 'Agent task panel should have dedicated styling');
assert.match(panel, /className="ai-agent-tool-toggle"[\s\S]{0,120}onClick=\{\(event\) => event\.stopPropagation\(\)\}/u, 'Agent tool enable toggle should stop propagation without swallowing the whole summary');
assert.doesNotMatch(panel, /<label className="ai-agent-tool-toggle"[\s\S]{0,220}<strong>\{tool\.label\}/u, 'Agent tool title must not live inside the checkbox label');

console.log('Verified Agent toolbox popover layout contract.');

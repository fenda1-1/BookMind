import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const charactersPage = readFileSync(new URL('../../pages/CharactersPage.tsx', import.meta.url), 'utf8');
const styles = [readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8'), readFileSync(new URL('../../app/styles/characters.css', import.meta.url), 'utf8')].join('\n');

assert.match(charactersPage, /characters-workspace-pane[\s\S]*characters-atlas-tabs[\s\S]*characterWorkbenchViews\.map[\s\S]*BookMindIcon name=\{view\.icon\}[\s\S]*<span>\{t\(view\.labelKey\)\}<\/span>/, 'Character Center workspace tabs should expose both icons and persistent text labels');

assert.match(charactersPage, /aria-label=\{t\(inspectorCollapsed \? 'characters\.inspectorExpand' : 'characters\.inspectorCollapse'\)\}[\s\S]*data-tooltip=\{t\(inspectorCollapsed \? 'characters\.inspectorExpand' : 'characters\.inspectorCollapse'\)\}/, 'Character inspector collapse button should expose the same immediate tooltip as its accessible label');
assert.match(charactersPage, /className="characters-inspector-resize"[\s\S]*aria-label=\{t\('characters\.inspectorResizeAria'\)\}[\s\S]*data-tooltip=\{t\('characters\.inspectorResizeAria'\)\}/, 'Character inspector resize handle should expose an immediate tooltip');

assert.match(styles, /\.characters-inspector-toolbar \[data-tooltip\]:hover::after/s, 'Character inspector toolbar buttons should render immediate data-tooltip hover hints');
assert.match(styles, /\.characters-workspace-pane \.characters-atlas-tab span\s*\{[^}]*display:\s*inline/s, 'Character workspace tabs should keep text labels visible instead of hiding them behind hover-only tooltips');

console.log('Verified Character Center labeled workspace tabs and inspector tooltips.');

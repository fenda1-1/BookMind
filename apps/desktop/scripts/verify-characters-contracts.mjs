import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const charactersPage = readFileSync('src/pages/CharactersPage.tsx', 'utf8');
const characterPageUtils = readFileSync('src/pages/CharacterPageUtils.tsx', 'utf8');
const characterPageRenderers = readFileSync('src/pages/CharacterPageRenderers.tsx', 'utf8');

// CharacterPageUtils exports
assert.match(characterPageUtils, /export function matchesBookStatusFilter/, 'CharactersPage utilities must export book status filter');
assert.match(characterPageUtils, /export function buildTextIndexViewFromSummary/, 'CharactersPage utilities must export text index view builder');
assert.match(characterPageUtils, /export function characterStatusLabel/, 'CharactersPage utilities must export character status label');
assert.match(characterPageUtils, /export function indexStatusLabel/, 'CharactersPage utilities must export index status label');
assert.match(characterPageUtils, /export function textIndexClassName/, 'CharactersPage utilities must export text index class name');
assert.match(characterPageUtils, /export function formatCharacterLocation/, 'CharactersPage utilities must export location formatter');

// CharacterPageRenderers exports
assert.match(characterPageRenderers, /export function renderCharacterInspectorPanel/, 'CharactersPage renderers must export inspector panel');
assert.match(characterPageRenderers, /export function renderCharacterProfileDetail/, 'CharactersPage renderers must export profile detail renderer');
assert.match(characterPageRenderers, /export function renderCharacterCenterPrimaryAction/, 'CharactersPage renderers must export primary action renderer');

// CharactersPage must import from extracted modules
assert.match(charactersPage, /from '\.\/CharacterPageUtils'/, 'CharactersPage must import from CharacterPageUtils');
assert.match(charactersPage, /from '\.\/CharacterPageRenderers'/, 'CharactersPage must import from CharacterPageRenderers');

// Character sub-panels
assert.ok(existsSync('src/pages/CharacterListPanel.tsx'), 'CharacterListPanel must exist as standalone component');
assert.ok(existsSync('src/pages/CharacterDetailPanel.tsx'), 'CharacterDetailPanel must exist as standalone component');
assert.ok(existsSync('src/pages/CharacterGraphPanel.tsx'), 'CharacterGraphPanel must exist as standalone component');

// readerModel sub-modules
assert.ok(existsSync('src/features/reader-core/readerModel/selection.ts'), 'readerModel selection must exist as standalone module');

console.log('Verified characters architecture contracts.');

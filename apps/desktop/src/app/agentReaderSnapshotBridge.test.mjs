import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const actions = readFileSync('src/app/appAiSessionActions.ts', 'utf8');
const store = readFileSync('src/services/agentReaderContextStore.ts', 'utf8');

assert.match(store, /rememberAgentReaderBookSnapshot/u, 'Reader Agent store should expose a way to remember parsed reader chapters');
assert.match(store, /getAgentReaderBookForTools/u, 'Reader Agent store should expose a book resolver for Agent tools');
assert.match(store, /buildAgentChunksFromReaderChapters/u, 'Reader Agent store should build TextChunk records from parsed reader chapters');
assert.match(workspace, /rememberAgentReaderBookSnapshot\(\{[\s\S]{0,260}chapters/u, 'Reader workspace should register parsed chapters for Agent tools');
assert.match(workspace, /if \(hidden && !standaloneReader\)[\s\S]{0,120}forgetAgentReaderBookSnapshot\(book\.id\)/u, 'Hidden main-window reader should release Agent chapter snapshots with the reader document.');
assert.match(actions, /getAgentReaderBookForTools\(book\)/u, 'Agent execution should resolve the current book through the reader snapshot bridge');
assert.match(actions, /const agentExecutionBook = getAgentReaderBookForTools\(book\)/u, 'Agent branch should use the resolved reader-backed book for diagnostics and tools');
assert.match(actions, /runAgentRequestedTool\(toolName, decision\.args, effectiveAiRequest, agentExecutionBook/u, 'Agent tool calls should use the reader-backed execution book');

console.log('Verified Agent reader snapshot bridge contract.');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = join(tmpdir(), `bookmind-character-relation-table-model-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/characters/characterGraphRelationTableModel.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { buildCharacterGraphRelationTableRows } = require(join(outDir, 'features', 'characters', 'characterGraphRelationTableModel.js'));

const graph = {
  nodes: [
    node('source-a', '纳兰夜行'),
    node('source-b', '赵空城'),
    ...Array.from({ length: 40 }, (_, index) => node(`target-${index}`, `目标${index}`)),
  ],
  edges: [
    ...Array.from({ length: 34 }, (_, index) => edge(`edge-a-${index}`, 'source-a', `target-${index}`, index % 2 === 0 ? 'co-occurrence' : 'ally')),
    ...Array.from({ length: 6 }, (_, index) => edge(`edge-b-${index}`, 'source-b', `target-${index}`, 'enemy')),
  ],
  summary: { nodeCount: 42, edgeCount: 40, relationCount: 40, hiddenRelationCount: 0, filteredRelationCount: 0 },
};
const labelById = new Map(graph.nodes.map((item) => [item.id, item.label]));

const collapsedRows = buildCharacterGraphRelationTableRows(graph, labelById, '', new Set());
assert.equal(collapsedRows.length, 2, 'collapsed relationship table should render one row per source character instead of every edge');
assert.equal(collapsedRows[0].type, 'group');
assert.equal(collapsedRows[0].sourceId, 'source-a');
assert.equal(collapsedRows[0].targetCount, 34);
assert.equal(collapsedRows[0].previewTargetIds.length, 4, 'collapsed source rows should only keep a small target preview');

const expandedRows = buildCharacterGraphRelationTableRows(graph, labelById, '', new Set(['source-b']));
assert.equal(expandedRows.length, 8, 'expanded relationship table should add only the selected source character edges');
assert.equal(expandedRows.filter((row) => row.type === 'edge').length, 6);

const searchedRows = buildCharacterGraphRelationTableRows(graph, labelById, '目标33', new Set(['source-a']));
assert.equal(searchedRows.length, 2, 'search should filter before grouping and expansion');
assert.equal(searchedRows[0].type, 'group');
assert.equal(searchedRows[0].targetCount, 1);
assert.equal(searchedRows[1].type, 'edge');
assert.equal(searchedRows[1].edge.targetId, 'target-33');

function node(id, label) {
  return { id, label };
}

function edge(id, sourceId, targetId, relationType) {
  return {
    id,
    sourceId,
    targetId,
    relationType,
    label: relationType,
    direction: 'undirected',
    confidence: 0.86,
    weight: 1,
    evidenceIds: [],
    relationIds: [id],
  };
}

console.log('Verified grouped character relation table model.');

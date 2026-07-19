import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const model = readFileSync('src/features/reader-core/readerModel.ts', 'utf8');
const interactions = readFileSync('scripts/verify-reader-interactions.mjs', 'utf8');
assert.match(model, /createReaderPendingRepairAnnotation/, 'Acceptance requires repairable annotations');
assert.match(interactions, /aria-current/, 'Acceptance requires accessibility contracts');
console.log('Verified Reader acceptance audit gate.');

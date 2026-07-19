import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const types = readFileSync(new URL('../../types.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../../services/libraryService.ts', import.meta.url), 'utf8');
const rustModels = readFileSync(new URL('../../../src-tauri/src/models/library.rs', import.meta.url), 'utf8');
const rustLibrary = readFileSync(new URL('../../../src-tauri/src/library/import.rs', import.meta.url), 'utf8');
const rustCommands = readFileSync(new URL('../../../src-tauri/src/commands/library_commands.rs', import.meta.url), 'utf8');

assert.match(types, /shelfGroups:\s*string\[\]/, 'Book type should expose shelfGroups');
assert.match(service, /shelfGroups:\s*book\.shelfGroups\s*\?\?\s*\[\]/, 'saveBookMetadata should persist shelfGroups');
assert.match(rustModels, /pub\(crate\)\s+shelf_groups:\s+Vec<String>/, 'BookRecord should store shelf_groups');
assert.match(rustLibrary, /shelf_groups:\s+Vec::new\(\)/, 'new imports should start without shelf groups');
assert.match(rustCommands, /record\.shelf_groups\s*=\s*normalize_shelf_groups\(&updated\.shelf_groups\)/, 'metadata updates should save sanitized shelf groups');

console.log('Verified shelf group persistence path.');

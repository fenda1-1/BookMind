import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const types = readFileSync(new URL('../../types.ts', import.meta.url), 'utf8');
const libraryService = readFileSync(new URL('../../services/libraryService.ts', import.meta.url), 'utf8');
const useLibrary = readFileSync(new URL('../../app/useLibrary.ts', import.meta.url), 'utf8');
const rustModels = readFileSync(new URL('../../../src-tauri/src/models.rs', import.meta.url), 'utf8');
const rustCommands = readFileSync(new URL('../../../src-tauri/src/commands.rs', import.meta.url), 'utf8');

assert.match(types, /lastOpenedAt\?:\s*string/, 'Book type should expose optional lastOpenedAt metadata');
assert.match(libraryService, /lastOpenedAt:\s*book\.lastOpenedAt\s*\?\?\s*''/, 'saveBookMetadata should persist lastOpenedAt');
assert.match(useLibrary, /function markBookOpened/, 'useLibrary should centralize last-opened metadata updates');
assert.match(useLibrary, /markBookOpened\(id\)/, 'openBook should mark the opened book');
assert.match(useLibrary, /markBookOpened\(result\.bookId\)/, 'opening from search should mark the opened book');
assert.match(rustModels, /last_opened_at:\s*String/, 'Tauri BookRecord should include last_opened_at');
assert.match(rustCommands, /record\.last_opened_at\s*=\s*updated\.last_opened_at/, 'Tauri metadata update should save last_opened_at');

console.log('Verified recent opened book metadata is persisted across frontend and Tauri.');

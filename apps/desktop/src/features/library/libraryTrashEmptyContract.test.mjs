import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const libraryPage = readFileSync(new URL('../../pages/LibraryPage.tsx', import.meta.url), 'utf8');
const useLibrary = readFileSync(new URL('../../app/useLibrary.ts', import.meta.url), 'utf8');
const libraryService = readFileSync(new URL('../../services/libraryService.ts', import.meta.url), 'utf8');
const tauriCommands = readFileSync(new URL('../../../src-tauri/src/commands.rs', import.meta.url), 'utf8');
const tauriLibrary = readFileSync(new URL('../../../src-tauri/src/library.rs', import.meta.url), 'utf8');

assert.match(libraryService, /export async function emptyTrash\(force = true\): Promise<Book\[\]>/u, 'manual empty-trash service should default to a force delete');
assert.match(libraryService, /invoke<Book\[\]>\('empty_trash', \{ force \}\)/u, 'emptyTrash should pass the force flag to Tauri');
assert.match(useLibrary, /const clearTrash = useCallback\(async \(\) => \{ const n = await emptyTrash\(true\);/u, 'useLibrary manual clearTrash should force-delete confirmed trash books');
assert.match(libraryPage, /onEmptyTrash\(\)/u, 'LibraryPage should keep confirmation separate from deletion execution');
assert.match(tauriCommands, /pub\(crate\) fn empty_trash\(force: Option<bool>\)/u, 'Tauri command should accept a force flag');
assert.match(tauriCommands, /empty_trash_command_in\(&data_dir, force\.unwrap_or\(false\)\)/u, 'Tauri command should default missing force to protected cleanup');
assert.match(tauriLibrary, /pub\(crate\) fn empty_trash_in\(data_dir: &Path, force: bool\)/u, 'backend empty trash should accept a force flag');
assert.match(tauriLibrary, /if force \{[\s\S]*return Some\(Ok\(record\.clone\(\)\)\);[\s\S]*is_trash_record_protected/u, 'backend should bypass trash protection when force is true');

console.log('Verified manual empty-trash uses explicit force deletion while preserving protected cleanup mode.');

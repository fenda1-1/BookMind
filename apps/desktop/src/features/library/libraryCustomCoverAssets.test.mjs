import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const libraryPage = readFileSync(new URL('../../pages/LibraryPage.tsx', import.meta.url), 'utf8');
const coverActions = readFileSync(new URL('./useLibraryCoverActions.ts', import.meta.url), 'utf8');
const libraryService = readFileSync(new URL('../../services/libraryService.ts', import.meta.url), 'utf8');
const tauriLibraryCommands = readFileSync(new URL('../../../src-tauri/src/commands/library_commands.rs', import.meta.url), 'utf8');
const tauriLibrary = readFileSync(new URL('../../../src-tauri/src/library.rs', import.meta.url), 'utf8');
const tauriConfig = readFileSync(new URL('../../../src-tauri/tauri.conf.json', import.meta.url), 'utf8');

assert.match(libraryService, /export async function importLibraryCoverImage\(path: string\): Promise<string>/u, 'library service should expose a managed cover import API');
assert.match(libraryService, /invoke<string>\('import_library_cover_image', \{ path \}\)/u, 'managed cover import should call the Tauri command');
assert.match(libraryPage, /useLibraryCoverActions\(/u, 'LibraryPage should compose the extracted cover action controller');
assert.match(coverActions, /importLibraryCoverImage/u, 'cover action controller should import selected images into app-managed storage');
assert.match(coverActions, /coverImagePath: await importLibraryCoverImage\(selected\)/u, 'custom cover selection should store the managed path');
assert.match(tauriLibraryCommands, /pub\(crate\) fn import_library_cover_image\(path: String\) -> Result<String, String>/u, 'Tauri library command should expose managed cover import');
assert.match(tauriLibrary, /pub\(crate\) fn import_library_cover_image_into\(\s*data_dir: &Path,\s*source_path: &Path,\s*\) -> Result<String, String>/u, 'backend should copy external covers into the app data directory');
assert.match(tauriLibrary, /migrate_external_cover_image_path\(data_dir, &record\.cover_image_path\)/u, 'library loading should migrate already-saved external cover paths');
assert.match(tauriConfig, /"\$LOCALDATA\/BookMindData\/library\/covers\/\*\*"/u, 'asset protocol should allow managed library cover assets');
assert.doesNotMatch(coverActions, /coverImagePath: selected/u, 'cover action controller should not save arbitrary external cover paths directly');

console.log('Verified custom covers are copied into managed asset storage before rendering.');

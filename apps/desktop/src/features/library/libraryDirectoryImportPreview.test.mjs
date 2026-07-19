import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const libraryPage = readFileSync(new URL('../../pages/LibraryPage.tsx', import.meta.url), 'utf8');
const importFlow = readFileSync(new URL('./useLibraryImportFlow.ts', import.meta.url), 'utf8');
const modals = readFileSync(new URL('./LibraryPageModals.tsx', import.meta.url), 'utf8');
const useLibrary = readFileSync(new URL('../../app/useLibrary.ts', import.meta.url), 'utf8');
const libraryService = readFileSync(new URL('../../services/libraryService.ts', import.meta.url), 'utf8');
const tauriLib = readFileSync(new URL('../../../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriCommands = readFileSync(new URL('../../../src-tauri/src/commands/library_commands.rs', import.meta.url), 'utf8');
const tauriLibrary = readFileSync(new URL('../../../src-tauri/src/library/import.rs', import.meta.url), 'utf8');
const models = readFileSync(new URL('../../../src-tauri/src/models/library.rs', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/messages/zhCN/library.ts', import.meta.url), 'utf8');

assert.match(libraryService, /export async function scanBookImportDirectory\(/, 'library service should expose a scan-only directory import API');
assert.match(libraryService, /invoke<DirectoryImportScanResult>\('scan_book_import_directory'/, 'directory scan must call a scan-only backend command');
assert.match(libraryService, /export async function importBookFiles\(/, 'library service should import only explicitly confirmed file paths');
assert.match(libraryService, /invoke<DirectoryImportResult>\('import_book_files', \{ files, continueAfterFailure, cleanupOptions \}\)/, 'confirmed import must call selected-file backend command');

assert.match(useLibrary, /scanDirectoryImportPreview/, 'useLibrary should expose a scan preview action');
assert.match(useLibrary, /importDirectoryFileSelection/, 'useLibrary should expose confirmed selected-file import');
assert.match(useLibrary, /const chooseBookDirectory = useCallback\(async \(\) => \{[\s\S]*scanDirectoryImportPreview\(s\)/, 'choosing a directory should scan for preview instead of importing immediately');
assert.doesNotMatch(useLibrary, /const chooseBookDirectory = useCallback\(async \(\) => \{[\s\S]*await importDirectory\(s\)/, 'choosing a directory must not import immediately');

assert.match(libraryPage, /directoryImportPreview/, 'LibraryPage should keep a directory import preview state');
assert.match(importFlow, /confirmDirectoryImportSelection/, 'import flow should confirm selected files before importing');
assert.match(importFlow, /cancelDirectoryImportPreview/, 'import flow should let the user cancel directory import preview');
assert.match(importFlow, /toggleDirectoryImportFile/, 'import flow should let users select and unselect scanned books');
assert.match(importFlow, /directoryImportDisplayNames/, 'import flow should let users manage scanned book names before import');
assert.match(modals, /className="library-import-preview-name"/, 'directory import preview should render themed editable book title inputs');
assert.match(modals, /className="library-import-preview-modal"/, 'directory import preview should render a directory import management modal');
assert.match(modals, /onMouseDown=\{onCancelDirectoryImport\}/, 'directory preview should be cancellable from the modal backdrop');

assert.match(models, /struct DirectoryImportScanItem/, 'backend models should define a directory import scan item payload');
assert.match(models, /struct DirectoryImportScanPayload/, 'backend models should define a directory import scan payload');
assert.match(models, /struct DirectoryImportFileSelection/, 'backend models should define confirmed file selections with editable names');
assert.match(tauriLibrary, /pub\(crate\) fn scan_book_import_directory_into\(/, 'backend library should provide scan-only directory discovery');
assert.match(tauriLibrary, /pub\(crate\) fn import_book_files_into\(/, 'backend library should provide selected-file directory import');
assert.match(tauriCommands, /pub\(crate\) fn scan_book_import_directory\(/, 'Tauri commands should expose scan_book_import_directory');
assert.match(tauriCommands, /pub\(crate\) fn import_book_files\(/, 'Tauri commands should expose import_book_files');
assert.match(tauriLib, /scan_book_import_directory,/, 'Tauri invoke handler should register scan_book_import_directory');
assert.match(tauriLib, /import_book_files,/, 'Tauri invoke handler should register import_book_files');

assert.match(styles, /\.library-import-preview-modal/, 'directory import preview modal should be styled');
assert.match(styles, /\.library-import-preview-list/, 'directory import preview file list should be scrollable and styled');
assert.match(styles, /\.library-import-preview-name/, 'directory import preview title input should use themed styling');
assert.match(zh, /'library\.importPreview\.title':\s*'确认导入书籍'/, 'Chinese i18n should include directory import preview title');

console.log('Verified directory import preview confirmation contract.');

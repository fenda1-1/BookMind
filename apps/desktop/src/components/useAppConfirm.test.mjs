import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./useAppConfirm.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/styles/layout.css', import.meta.url), 'utf8');
const libraryPage = readFileSync(new URL('../pages/LibraryPage.tsx', import.meta.url), 'utf8');
const taskCenterState = readFileSync(new URL('../features/task-center/useTaskCenterState.ts', import.meta.url), 'utf8');
const taskPage = readFileSync(new URL('../pages/TasksPage.tsx', import.meta.url), 'utf8');

assert.match(source, /export function useAppConfirm/u, 'shared app confirmation hook should exist');
assert.match(source, /new Promise<boolean>/u, 'confirmation hook should expose an awaitable boolean result');
assert.match(source, /className="app-confirm-accept"/u, 'confirm action should use a dedicated Paper Geometry accept button class');
assert.match(styles, /\.app-confirm-accept/u, 'confirm action should have dedicated Paper Geometry styling');
assert.match(styles, /\.app-confirm-accept[\s\S]*var\(--cinnabar\)/u, 'confirm action should use warm/cinnabar paper geometry styling instead of default blue');
assert.match(styles, /\.app-confirm-dialog \{[^}]*grid-template-rows:\s*minmax\(0,1fr\) auto/u, 'confirm dialog should keep the action row visible below scrollable long content');
assert.match(styles, /\.app-confirm-dialog p \{[^}]*overflow-wrap:\s*anywhere/u, 'confirm dialog text should wrap very long file paths instead of pushing buttons off-screen');
assert.match(styles, /\.app-confirm-dialog p \{[^}]*overflow:\s*auto/u, 'confirm dialog long content should scroll inside the dialog');
assert.doesNotMatch(source, /className="primary-btn danger-btn"/u, 'confirm action should not inherit the global blue primary button');
assert.match(libraryPage, /requestAppConfirm/u, 'LibraryPage should use the app confirmation service');
assert.doesNotMatch(libraryPage, /window\.confirm/u, 'LibraryPage should not call browser window.confirm');
assert.match(taskCenterState, /confirm\?:\s*\(message:\s*string\)\s*=>\s*Promise<boolean>/u, 'task center state should receive an app-level confirm function');
assert.match(taskCenterState, /const confirm = options\.confirm \?\? defaultTaskCenterConfirm/u, 'task center state should use the injected app confirmation function');
assert.doesNotMatch(taskCenterState, /window\.confirm/u, 'task center state should not call browser window.confirm');
assert.doesNotMatch(taskPage, /useAppConfirm/u, 'TasksPage should rely on the root app confirmation dialog');

console.log('Verified app confirmation avoids browser window.confirm.');

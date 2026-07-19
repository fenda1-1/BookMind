import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/pages/ReaderWorkspace.tsx', 'utf8');
const commandHandlers = readFileSync('src/pages/reader-workspace/ReaderCommandHandlers.ts', 'utf8');
const launcher = readFileSync('src/pages/reader-workspace/readerWindowLauncher.ts', 'utf8');

assert.match(commandHandlers, /saveWindowGeometry,\s*\n\s*scheduleWindowGeometrySave/u, 'Reader command handlers should expose immediate geometry saving');
assert.match(commandHandlers, /if \(await current\.isMinimized\(\)\) return/u, 'Standalone reader geometry should not persist minimized or hidden Windows coordinates');
assert.match(commandHandlers, /current\.outerSize\(\)/u, 'Standalone reader geometry should save the same physical size unit used for restoration');
assert.match(commandHandlers, /isStandaloneReaderWindowGeometryUsable\(previous\)/u, 'Standalone reader geometry should only reuse valid previous normal geometry');
assert.match(commandHandlers, /\(maximized \|\| fullscreen\) && previousGeometry \? previousGeometry : currentGeometry/u, 'Standalone reader geometry should preserve normal size while maximized or fullscreen');
assert.match(commandHandlers, /width: outerSize\.width, height: outerSize\.height/u, 'Standalone reader geometry should persist physical outer width and height');
assert.match(commandHandlers, /if \(!isStandaloneReaderWindowGeometryUsable\(normalGeometry\)\) return/u, 'Standalone reader geometry should not save unusable offscreen/minimized snapshots');
assert.match(launcher, /center:\s*!hasSavedReaderWindowGeometry\(savedWindow\)/u, 'Standalone reader windows should not recenter when saved geometry exists');
assert.match(launcher, /availableMonitors/u, 'Standalone reader launcher should inspect current monitors before restoring saved geometry');
assert.match(launcher, /resolveStandaloneReaderWindowGeometryForWorkAreas/u, 'Standalone reader launcher should clamp saved geometry to visible work areas');
assert.match(launcher, /revealStandaloneReaderWindow\(existing, savedWindow\)/u, 'Reopening an existing standalone reader should unminimize and reveal it');
assert.match(launcher, /readerWindow\.unminimize\(\)/u, 'Existing minimized standalone reader windows should be unminimized before focus');
assert.doesNotMatch(launcher, /void restoreStandaloneReaderWindowGeometry\(readerWindow, savedWindow\)/u, 'Standalone reader launcher should not race geometry restore against maximization');
assert.match(launcher, /restoreStandaloneReaderWindowState\(readerWindow, savedWindow, state, book\.id\)/u, 'Standalone reader launcher should restore the window state through a sequenced helper');
assert.match(launcher, /await restoreStandaloneReaderWindowGeometry\(readerWindow, geometry\)[\s\S]*?if \(geometry\.maximized\) await readerWindow\.maximize\(\)/u, 'Standalone reader launcher should maximize only after saved geometry restoration finishes');
assert.match(launcher, /setPosition\(new PhysicalPosition\(Math\.round\(resolved\.x!\), Math\.round\(resolved\.y!\)\)\)/u, 'Standalone reader launcher should restore a resolved visible physical position');
assert.match(launcher, /setSize\(new PhysicalSize\(Math\.round\(resolved\.width!\), Math\.round\(resolved\.height!\)\)\)/u, 'Standalone reader launcher should restore a resolved physical size');
assert.match(workspace, /const readerCommandsRef = useRef\(readerCommands\);[\s\S]*?readerCommandsRef\.current = readerCommands/u, 'Standalone geometry listeners should call the latest reader commands through a ref');
assert.match(workspace, /current\.onMoved\(\(\) => readerCommandsRef\.current\.scheduleWindowGeometrySave\(\)\)/u, 'Standalone moved events should schedule geometry saving through the ref');
assert.match(workspace, /current\.onResized\(\(\) => \{[\s\S]*?readerCommandsRef\.current\.scheduleWindowGeometrySave\(\)/u, 'Standalone resized events should schedule geometry saving through the ref');
assert.match(workspace, /void readerCommandsRef\.current\.saveWindowGeometry\(\)/u, 'Standalone listener cleanup should flush pending geometry immediately');

const effectMatch = workspace.match(/useEffect\(\(\) => \{[\s\S]*?current\.onMoved[\s\S]*?\}, \[([^\]]+)\]\);/u);
assert.ok(effectMatch, 'Standalone geometry listener effect should exist');
assert.equal(effectMatch[1].trim(), 'standaloneReader, book?.id, windowKey', 'Standalone geometry listener effect should not depend on volatile reading state');

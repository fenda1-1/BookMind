import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(currentDir, '..', '..');

const tauriConfig = JSON.parse(readFileSync(resolve(desktopRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const defaultCapability = JSON.parse(readFileSync(resolve(desktopRoot, 'src-tauri', 'capabilities', 'default.json'), 'utf8'));
const appSource = readFileSync(resolve(currentDir, 'App.tsx'), 'utf8');
const mainSource = readFileSync(resolve(currentDir, 'main.tsx'), 'utf8');
const indexHtml = readFileSync(resolve(desktopRoot, 'index.html'), 'utf8');
const readerWindowLauncherSource = readFileSync(resolve(desktopRoot, 'src', 'pages', 'reader-workspace', 'readerWindowLauncher.ts'), 'utf8');
const appWindowLifecycleSource = readFileSync(resolve(currentDir, 'useAppWindowLifecycle.ts'), 'utf8');
const readerCommandHandlersSource = readFileSync(resolve(desktopRoot, 'src', 'pages', 'reader-workspace', 'ReaderCommandHandlers.ts'), 'utf8');
const layoutCss = readFileSync(resolve(currentDir, 'styles', 'layout.css'), 'utf8');

const mainWindow = tauriConfig.app.windows[0];

assert.equal(mainWindow.decorations, false, 'main Tauri window must use a custom themed titlebar instead of native decorations');
assert.deepEqual(mainWindow.backgroundColor, [23, 19, 15, 255], 'native main window background must avoid a white flash before HTML paints');
assert.match(indexHtml, /id="bookmind-boot-shell"/u, 'HTML must provide a visible startup shell before React loads');
assert.match(indexHtml, /prefers-color-scheme:\s*dark/u, 'startup shell must adapt to the system theme');
assert.match(indexHtml, /prefers-reduced-motion:\s*reduce/u, 'startup animation must respect reduced motion');
assert.match(mainSource, /requestAnimationFrame\(\(\) => requestAnimationFrame\(finishBootSequence\)\)/u, 'window reveal must wait for a usable React frame');
assert.match(readerWindowLauncherSource, /visible:\s*false/u, 'new standalone reader windows must remain hidden until their first usable frame');
assert.match(readerWindowLauncherSource, /backgroundColor:\s*resolveStandaloneReaderBackgroundColor/u, 'standalone reader native background must match its theme');
assert.ok(defaultCapability.permissions.includes('core:window:allow-minimize'), 'custom titlebar needs minimize permission');
assert.ok(defaultCapability.permissions.includes('core:window:allow-toggle-maximize'), 'custom titlebar needs toggle maximize permission');
assert.ok(defaultCapability.permissions.includes('core:window:allow-set-decorations'), 'standalone reader windows need set decorations permission to hide native chrome for reused windows');
assert.ok(defaultCapability.permissions.includes('core:window:allow-close'), 'custom titlebar needs close permission');

assert.match(appSource, /function AppWindowFrame/, 'App must render a dedicated custom window frame');
assert.match(appSource, /className="app-window-titlebar"/, 'custom titlebar must be present in the app shell');
assert.match(appSource, /data-tauri-drag-region/, 'custom titlebar must expose a Tauri drag region');
assert.match(appSource, /moyuReader \? standaloneReaderContent : \(/u, 'immersive Moyu reader windows should keep their borderless shell');
assert.match(appSource, /<AppWindowFrame className=\{appWindowFrameClassName\} title=\{topbarTitleText\} style=\{appThemeStyle\}>/u, 'standalone reader windows must reuse the themed custom titlebar');
assert.match(appSource, /currentWindow\.listen<\{ target\?: 'ai-api' \| 'reader-memory-warning' \}>\('bookmind:open-settings'/u, 'main window must listen for settings navigation requested by standalone readers');
assert.match(appSource, /if \(standaloneReader && isTauriRuntime\(\)\)[\s\S]*WebviewWindow\.getByLabel\('main'\)[\s\S]*mainWindow\.emit\('bookmind:open-settings', \{ target \}\)/u, 'standalone reader settings links must focus the main window and route to the requested settings target');
assert.match(appSource, /<main className=\{appShellClassName\} style=\{appThemeStyle\}>/u, 'custom theme color must be applied directly to the main app shell so navigation, active buttons, and reader toolbar inherit it');
assert.match(appWindowLifecycleSource, /\.setDecorations\(false\)/u, 'standalone reader windows must force native decorations off after load so reused dev windows cannot keep the OS titlebar');
assert.match(readerCommandHandlersSource, /new WebviewWindow\(label,[\s\S]*?decorations: false,[\s\S]*?\);/u, 'standalone reader windows must disable native decorations so the themed titlebar is the only window chrome');
assert.match(appSource, /\.minimize\(\)/, 'custom titlebar minimize button must call the Tauri window API');
assert.match(appSource, /\.toggleMaximize\(\)/, 'custom titlebar maximize button must call the Tauri window API');
assert.match(appSource, /\.isMaximized\(\)/, 'custom titlebar maximize button must read the maximized state');
assert.match(appSource, /\.isFullscreen\(\)/, 'custom titlebar frame must read fullscreen state');
assert.match(appSource, /\.setFullscreen\(!fullscreen\)/, 'custom titlebar frame must handle F11 with the Tauri fullscreen API');
assert.match(appSource, /currentMonitor\(\)/u, 'custom titlebar fullscreen should use monitor geometry as a Windows taskbar fallback');
assert.match(appSource, /setPosition\(new PhysicalPosition\(monitor\.position\.x, monitor\.position\.y\)\)/u, 'custom titlebar fullscreen should move the window to the monitor origin');
assert.match(appSource, /setSize\(new PhysicalSize\(monitor\.size\.width, monitor\.size\.height\)\)/u, 'custom titlebar fullscreen should size the window to the full monitor');
assert.match(readerCommandHandlersSource, /setSize\(new PhysicalSize\(monitor\.size\.width, monitor\.size\.height\)\)/u, 'reader toolbar fullscreen should size standalone windows to the full monitor');
assert.match(appSource, /event\.key !== 'F11'/u, 'custom titlebar frame must intercept F11 before browser fullscreen handling');
assert.match(appSource, /glyph=\{windowMaximized \? 'restore' : 'maximize'\}/u, 'custom titlebar maximize button must switch to a restore glyph when maximized');
assert.match(appSource, /\.close\(\)/, 'custom titlebar close button must call the Tauri window API');

assert.match(layoutCss, /\.app-window-frame/, 'window frame CSS must define the themed root frame');
assert.match(layoutCss, /\.app-window-frame\.fullscreen \{[^}]*grid-template-rows:\s*minmax\(0,1fr\)/u, 'window frame CSS must give fullscreen windows the whole viewport');
assert.match(layoutCss, /\.app-window-frame\.fullscreen \{[^}]*position:\s*fixed;[^}]*inset:\s*0/u, 'fullscreen window frame must pin itself to the whole webview');
assert.match(layoutCss, /\.app-window-frame\.fullscreen \.standalone-reader-shell \{[^}]*padding:\s*0/u, 'standalone fullscreen reader must remove shell padding');
assert.match(layoutCss, /\.app-window-frame\.fullscreen \.app-window-titlebar \{[^}]*display:\s*none/u, 'window frame CSS must hide the custom titlebar while fullscreen');
assert.match(layoutCss, /\.app-window-titlebar/, 'window frame CSS must style the titlebar');
assert.match(layoutCss, /\.window-control-btn\.close:hover/, 'close button hover state must be styled separately');
assert.match(layoutCss, /\.window-control-glyph\.restore::before/u, 'window frame CSS must define a distinct restore glyph');
assert.match(layoutCss, /\.window-control-glyph\.restore::after/u, 'window frame CSS must draw the second restore glyph layer');

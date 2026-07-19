import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), '.tmp', `bookmind-app-shell-test-${process.pid}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--target', 'ES2022', '--module', 'CommonJS', '--moduleResolution', 'Node', '--jsx', 'react-jsx', '--ignoreDeprecations', '6.0', '--outDir', outDir, '--skipLibCheck', 'src/app/appShellModel.ts'], { cwd: process.cwd(), stdio: 'inherit' });
const require = createRequire(import.meta.url);
const {
  buildHybridLocalFirstCloudRequest,
  canOpenReaderOnStartup,
  isMainWindowGeometryUsable,
  resolveActiveCharacterExtractionBookId,
  resolveMainWindowGeometryForWorkAreas,
  resolveStartupPage,
  resolveVisibleAppPage,
  shouldRestoreMainWindowMaximized,
  shouldUseHybridLocalFirstCloudSummary,
} = require(join(outDir, 'app/appShellModel.js'));

const primaryWorkArea = { x: 0, y: 0, width: 1920, height: 1080 };
const allVisiblePages = ['overview', 'reader', 'library', 'knowledge', 'characters', 'search', 'tasks', 'settings'];

assert.equal(
  resolveStartupPage(false, 'library', allVisiblePages, false),
  'library',
  'explicit Library startup should not be overridden by the default Reader startup restore path',
);
assert.equal(
  resolveStartupPage(false, 'reader', ['overview', 'library', 'settings'], false),
  'overview',
  'hidden Reader page should fall back to the first visible startup page',
);
assert.equal(
  resolveStartupPage(false, 'reader', allVisiblePages, true),
  'overview',
  'standalone-only reader mode should keep the main window out of the hidden Reader page on startup',
);
assert.equal(
  resolveVisibleAppPage('reader', ['library', 'settings'], false),
  'library',
  'runtime page guard should move hidden Reader to the first visible page',
);
assert.equal(
  canOpenReaderOnStartup('library', allVisiblePages, false, true),
  false,
  'last reader restore must not override an explicit Library startup page',
);
assert.equal(
  canOpenReaderOnStartup('reader', allVisiblePages, false, true),
  true,
  'Reader startup can restore the last reading book when Reader is visible',
);
assert.equal(
  canOpenReaderOnStartup('last', allVisiblePages, false, true),
  true,
  'Last-page startup can restore the last reading book when Reader is visible',
);
assert.equal(
  canOpenReaderOnStartup('reader', allVisiblePages, true, true),
  false,
  'standalone-only reader mode should block main-window Reader startup restore',
);
assert.equal(
  canOpenReaderOnStartup('reader', ['overview', 'library', 'settings'], false, true),
  false,
  'hidden Reader page should block startup restore into Reader',
);
assert.equal(isMainWindowGeometryUsable({ x: -21333, y: -21333, width: 158, height: 26 }), false, 'minimized Windows geometry must not be considered usable');
assert.equal(isMainWindowGeometryUsable({ x: 80, y: 80, width: 1440, height: 920 }), true, 'ordinary app geometry should be usable');
assert.equal(isMainWindowGeometryUsable({ x: 80, y: 80, width: 1440, height: 920, maximized: true }), true, 'maximized window geometry should still be usable');
assert.equal(shouldRestoreMainWindowMaximized({ x: 80, y: 80, width: 1440, height: 920, maximized: true }), true, 'saved maximized state should restore as maximized');
assert.equal(shouldRestoreMainWindowMaximized({ x: 80, y: 80, width: 1440, height: 920, maximized: false }), false, 'non-maximized state should restore as normal window');
assert.equal(
  resolveActiveCharacterExtractionBookId('book-a', 'book-a', [
    { id: 'task-a', bookId: 'book-a', kind: 'character-extraction', status: 'succeeded', updatedAt: '2000', finishedAt: '2000', startedAt: '1000', createdAt: '1000' },
  ]),
  null,
  'completed character extraction tasks must clear stale local extracting state',
);
assert.equal(
  resolveActiveCharacterExtractionBookId('book-a', 'book-a', [
    { id: 'task-a', bookId: 'book-a', kind: 'character-extraction', status: 'running', updatedAt: '2000', finishedAt: '', startedAt: '1000', createdAt: '1000' },
  ]),
  'book-a',
  'running character extraction tasks should still mark the selected book as extracting',
);
assert.equal(
  resolveActiveCharacterExtractionBookId(null, 'book-a', [
    { id: 'task-a', bookId: 'book-a', kind: 'character-extraction', status: 'queued', updatedAt: '2000', finishedAt: '', startedAt: '', createdAt: '1000' },
  ]),
  'book-a',
  'queued character extraction tasks from the task snapshot should mark the selected book as extracting',
);
assert.equal(
  resolveActiveCharacterExtractionBookId(null, 'book-a', [
    { id: 'task-a', bookId: 'book-a', kind: 'character-extraction', status: 'failed', updatedAt: '2000', finishedAt: '2000', startedAt: '1000', createdAt: '1000' },
  ]),
  null,
  'terminal failed character extraction tasks should not leave the selected book extracting',
);
assert.deepEqual(
  resolveMainWindowGeometryForWorkAreas({ x: 80, y: 80, width: 1440, height: 920 }, [primaryWorkArea]),
  { x: 80, y: 80, width: 1440, height: 920 },
  'visible saved geometry should be restored unchanged',
);
assert.deepEqual(
  resolveMainWindowGeometryForWorkAreas({ x: -21333, y: -21333, width: 1440, height: 920 }, [primaryWorkArea]),
  { x: 240, y: 80, width: 1440, height: 920 },
  'off-screen saved geometry should be centered back into the primary work area',
);
assert.deepEqual(
  resolveMainWindowGeometryForWorkAreas({ x: 3000, y: 2000, width: 2200, height: 1400 }, [primaryWorkArea]),
  { x: 0, y: 0, width: 1920, height: 1080 },
  'oversized off-screen geometry should fit inside the available work area',
);
assert.equal(
  shouldUseHybridLocalFirstCloudSummary(
    { scope: 'chapter', instruction: '分析', userText: '', mode: 'cloud', interactionMode: 'agent', requireCloudApi: true },
    { aiHybridLocalFirstCloudSummary: false, localAiEnabled: true },
  ),
  false,
  'Agent mode should not run local evidence tools before the model asks for a tool',
);
assert.equal(
  shouldUseHybridLocalFirstCloudSummary(
    { scope: 'chapter', instruction: '分析', userText: '', mode: 'cloud', interactionMode: 'agent', requireCloudApi: true },
    { aiHybridLocalFirstCloudSummary: false, localAiEnabled: false },
  ),
  false,
  'Agent mode should not run local evidence tools when local tools are disabled',
);

const agentHybridRequest = buildHybridLocalFirstCloudRequest(
  { scope: 'chapter', instruction: '分析当前章', userText: '', mode: 'cloud', interactionMode: 'agent', scopeText: '', retrievalQuery: '当前章' },
  {
    answer: '工具摘要',
    citations: [{ id: 1, label: '第 2 章', text: '阿蒂克斯说了一句话。', targetId: '', chapterIndex: 1, paragraphIndex: 3 }],
    diagnostics: { resultCount: 1 },
  },
  '当前章',
);
assert.match(agentHybridRequest.instruction, /Agent 工具结果/, 'Agent cloud synthesis should label local evidence as tool results');
assert.match(agentHybridRequest.instruction, /不要表述为“用户发送|用户提供|你发送|你提供/, 'Agent cloud synthesis should forbid saying the user sent the tool context');
assert.match(agentHybridRequest.userText, /Agent 工具结果/, 'Agent evidence payload should be labelled as tool output');
assert.doesNotMatch(agentHybridRequest.userText, /^Context:/m, 'Agent evidence payload must not be labelled as raw user context');

console.log('Verified app shell main-window geometry recovery.');

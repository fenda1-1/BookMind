import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const outDir = join(process.cwd(), '.tmp', 'task-time-test');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const source = ts.transpileModule(readFileSync(new URL('./taskTime.ts', import.meta.url), 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

writeFileSync(join(outDir, 'taskTime.mjs'), source, 'utf8');

const { formatTaskRelativeTime } = await import(pathToFileURL(join(outDir, 'taskTime.mjs')).href);

const fixedNow = Date.parse('2026-07-04T10:00:00.000Z');
const realDateNow = Date.now;
Date.now = () => fixedNow;

try {
  const view = formatTaskRelativeTime(String(fixedNow - 60_000), 'zh-CN');
  assert.notEqual(view.label, String(fixedNow - 60_000), 'millisecond timestamp strings should not be shown as raw numbers');
  assert.notEqual(view.title, String(fixedNow - 60_000), 'millisecond timestamp titles should be formatted as readable time');
  assert.equal(view.dateTime, '2026-07-04T09:59:00.000Z', 'millisecond timestamp dateTime should be normalized to ISO');
  assert.match(view.title, /2026/, 'formatted timestamp title should include the readable year');

  const isoView = formatTaskRelativeTime('2026-07-04T09:59:00.000Z', 'zh-CN');
  assert.equal(isoView.dateTime, '2026-07-04T09:59:00.000Z', 'ISO timestamps should remain valid datetime values');
} finally {
  Date.now = realDateNow;
}

console.log('Verified task timestamp formatting.');

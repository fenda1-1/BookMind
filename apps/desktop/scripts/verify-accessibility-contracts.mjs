import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = [
  'src/app/App.tsx',
  'src/features/reader-core/ReaderPage.tsx',
  'src/pages/ReaderWorkspace.tsx',
  'src/pages/SettingsPage.tsx',
  'src/features/ai-reader/AiReaderPanel.tsx',
];

function readCssWithImports(filePath, seen = new Set()) {
  const fullPath = resolve(filePath);
  if (seen.has(fullPath)) return '';
  seen.add(fullPath);
  const source = readFileSync(fullPath, 'utf8');
  const imports = [...source.matchAll(/@import\s+['"](.+?)['"];/g)]
    .map((match) => readCssWithImports(resolve(dirname(fullPath), match[1]), seen));
  return [source, ...imports].join('\n');
}

const styles = readCssWithImports('src/app/styles.css');

assert.match(styles, /\.large-touch-targets[\s\S]*min-height:\s*44px/, 'large touch target mode must enforce 44px minimum interactive height');
assert.match(styles, /\.large-touch-targets[\s\S]*min-width:\s*44px/, 'large touch target mode must enforce 44px minimum interactive width');
assert.match(styles, /\.large-touch-targets[\s\S]*\.settings-toggle[\s\S]*min-height:\s*44px/, 'large touch target mode must give toggle rows a 44px hit area');

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const [button, attrs, body] = match;
    const visibleTextExpression = body
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const iconOnly = /<ReaderToolbarIcon\b|<Icon\b|reader-icon-btn|reader-color-dot/.test(button);
    const noStableVisibleText = !visibleTextExpression;
    if (!iconOnly && !noStableVisibleText) continue;
    assert.match(
      button,
      /aria-label=|aria-labelledby=|title=|data-tooltip=/,
      `${file} has an icon-only or unlabeled button without an accessible label: ${button.slice(0, 180)}`,
    );
  }
}

console.log('Verified accessibility contracts.');

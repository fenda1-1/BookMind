import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('./ReaderWorkspace.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../features/reader-core/ReaderPage.tsx', import.meta.url), 'utf8');
const propsBuilder = readFileSync(new URL('./reader-workspace/ReaderPagePropsBuilder.ts', import.meta.url), 'utf8');

assert.match(page, /onVisiblePageTextChange\?: \(text: string\) => void;/u);
assert.match(page, /buildReaderVisiblePageText\(renderVisiblePageStream\)/u);
assert.match(page, /onVisiblePageTextChange\?\.\(nextVisiblePageText\)/u);

assert.match(workspace, /const \[visibleReaderPageText, setVisibleReaderPageText\] = useState\(''\);/u);
assert.match(workspace, /const pageText = visibleReaderPageText\.trim\(\) \? visibleReaderPageText : buildFallbackReaderPageText\(activeChapter, activeParagraphIndex\);/u);
assert.match(workspace, /function buildFallbackReaderPageText\(chapter: ReaderChapter \| null, activeParagraphIndex: number\)/u);

assert.match(propsBuilder, /onVisiblePageTextChange: ReaderPageProps\['onVisiblePageTextChange'\]/u);
assert.match(propsBuilder, /onVisiblePageTextChange,/u);

console.log('Verified AI reader page context follows the visible page spread.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../pages/LibraryPage.tsx', import.meta.url), 'utf8');

assert.match(
  page,
  /const shelfBooks = useMemo\(\(\) => books\.filter\(\(item\) => !item\.deleted\), \[books\]\)/u,
  'LibraryPage shelfBooks must be memoized so shelf group effects do not rerun every render.',
);
assert.match(
  page,
  /const trashBooks = useMemo\(\(\) => books\.filter\(\(item\) => item\.deleted\), \[books\]\)/u,
  'LibraryPage trashBooks must be memoized so derived lists keep stable references.',
);
assert.match(
  page,
  /return next\.length === current\.length && next\.every\(\(groupId, index\) => groupId === current\[index\]\) \? current : next/u,
  'Expanded shelf group cleanup must return current state when nothing changed to avoid maximum update depth loops.',
);

console.log('Verified library shelf group render stability.');

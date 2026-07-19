import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(process.cwd(), 'node_modules', '.cache', `bookmind-library-shelf-groups-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/features/library/libraryShelfGroups.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const {
  addBookToShelfGroup,
  buildShelfGroups,
  deleteShelfGroup,
  filterBooksByShelfGroup,
  normalizeShelfGroupName,
  renameShelfGroup,
  removeBookFromShelfGroup,
} = await import(pathToFileURL(join(outDir, 'libraryShelfGroups.js')).href);

const books = [
  { id: 'a', displayTitle: 'Alpha', shelfGroups: ['科幻', '待读'] },
  { id: 'b', displayTitle: 'Beta', shelfGroups: ['科幻'] },
  { id: 'c', displayTitle: 'Gamma', shelfGroups: [] },
  { id: 'd', displayTitle: 'Deleted', deleted: true, shelfGroups: ['科幻'] },
];

assert.equal(normalizeShelfGroupName('  科幻 / 长篇  '), '科幻 长篇', 'group names should trim and remove path separators');
assert.equal(normalizeShelfGroupName(''), '', 'empty group names should stay empty so callers can reject them');

const groups = buildShelfGroups(books, ['空书架']);
assert.deepEqual(groups.map((group) => [group.id, group.label, group.count]), [
  ['all', '全部书籍', 3],
  ['ungrouped', '未分组', 1],
  ['custom:科幻', '科幻', 2],
  ['custom:待读', '待读', 1],
  ['custom:空书架', '空书架', 0],
]);

assert.deepEqual(filterBooksByShelfGroup(books, 'custom:科幻').map((book) => book.id), ['a', 'b']);
assert.deepEqual(filterBooksByShelfGroup(books, 'ungrouped').map((book) => book.id), ['c']);
assert.deepEqual(filterBooksByShelfGroup(books, 'all').map((book) => book.id), ['a', 'b', 'c']);

assert.deepEqual(addBookToShelfGroup({ id: 'x', shelfGroups: ['科幻'] }, ' 科幻 ').shelfGroups, ['科幻'], 'adding an existing group should not duplicate it');
assert.deepEqual(addBookToShelfGroup({ id: 'x', shelfGroups: ['科幻'] }, '新书架').shelfGroups, ['科幻', '新书架']);
assert.deepEqual(removeBookFromShelfGroup({ id: 'x', shelfGroups: ['科幻', '新书架'] }, '科幻').shelfGroups, ['新书架']);

const renamed = renameShelfGroup(books, ['空书架'], '科幻', '奇幻');
assert.deepEqual(renamed.books.map((book) => book.shelfGroups), [['奇幻', '待读'], ['奇幻'], [], ['奇幻']]);
assert.deepEqual(renamed.catalogGroups, ['空书架', '奇幻']);

const deleted = deleteShelfGroup(books, ['空书架', '科幻'], '科幻');
assert.deepEqual(deleted.books.map((book) => book.shelfGroups), [['待读'], [], [], []]);
assert.deepEqual(deleted.catalogGroups, ['空书架']);

console.log('Verified library shelf group model.');

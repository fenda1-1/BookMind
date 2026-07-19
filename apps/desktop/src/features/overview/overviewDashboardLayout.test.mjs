import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../../app/styles/layout.css', import.meta.url), 'utf8');

assert.match(styles, /\.overview-recent-strip\s*\{[^}]*min-height:\s*0/s, 'recent reading card should be allowed to shrink inside the page');
assert.match(styles, /\.overview-recent-list\s*\{[^}]*max-height:\s*min\(/s, 'recent reading list should have a bounded height');
assert.match(styles, /\.overview-recent-list\s*\{[^}]*overflow-y:\s*auto/s, 'recent reading list should scroll internally instead of extending the dashboard');

console.log('Verified overview recent reading list uses bounded internal scrolling.');

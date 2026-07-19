import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appShellModel = readFileSync(new URL('../../app/appShellModel.ts', import.meta.url), 'utf8');
const tauriLibrary = readFileSync(new URL('../../../src-tauri/src/library/import.rs', import.meta.url), 'utf8');
const documentReading = readFileSync(new URL('../../../src-tauri/src/library/document_reading.rs', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../../i18n/messages/zhCN/library.ts', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../i18n/messages/enUS/library.ts', import.meta.url), 'utf8');

assert.match(
  appShellModel,
  /extensions:\s*\['txt',\s*'md',\s*'markdown',\s*'epub',\s*'mobi',\s*'pdf'\]/u,
  'file picker recommended book filter should include Markdown files',
);

assert.match(
  tauriLibrary,
  /matches!\(\s*extension\.as_str\(\),\s*"txt"\s*\|\s*"md"\s*\|\s*"markdown"\s*\|\s*"epub"\s*\|\s*"mobi"\s*\|\s*"pdf"\s*\)/u,
  'single-file import should accept Markdown and MOBI in the supported book formats',
);

assert.match(
  tauriLibrary,
  /matches!\(\s*value\.to_ascii_lowercase\(\)\.as_str\(\),\s*"txt"\s*\|\s*"md"\s*\|\s*"markdown"\s*\|\s*"epub"\s*\|\s*"mobi"\s*\|\s*"pdf"\s*\)/u,
  'directory scan should discover Markdown and MOBI files',
);

assert.match(
  tauriLibrary,
  /"txt"\s*\|\s*"md"\s*\|\s*"markdown"\s*=>\s*decode_txt_bytes_with_mode\(bytes,\s*encoding_mode\)/u,
  'Markdown import should reuse the text decoding path',
);

assert.match(
  documentReading,
  /"txt"\s*\|\s*"md"\s*\|\s*"markdown"\s*=>\s*\{/u,
  'Markdown reader loading should reuse the text line stream path',
);

assert.match(tauriLibrary, /"mobi"\s*=>\s*decode_mobi_bytes\(bytes\)/u, 'MOBI import should decode the ebook payload');

assert.match(zh, /TXT、Markdown、EPUB、MOBI 或 PDF/u, 'Chinese import empty copy should mention supported formats');
assert.match(en, /TXT, Markdown, EPUB, MOBI, or PDF/u, 'English import empty copy should mention supported formats');

console.log('Verified Markdown files are supported by book import filters and backend import paths.');

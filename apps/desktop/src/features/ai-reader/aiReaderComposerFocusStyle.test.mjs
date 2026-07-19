import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync('src/app/styles/settings.css', 'utf8');

assert.match(
  styles,
  /\.ai-prompt-field textarea\.ai-question-input:focus,\s*\.ai-prompt-field textarea\.ai-question-input:focus-visible\s*\{[^}]*outline:\s*0[^}]*box-shadow:\s*none/u,
  'AI composer textarea focus should override the global hard outline.',
);

assert.match(
  styles,
  /\.ai-input-card:focus-within\s*\{[^}]*box-shadow:\s*inset 0 1px 0 rgba\(255,255,255,\.72\), inset 0 0 0 2px color-mix\(in srgb, var\(--indigo\) 18%, transparent\)/u,
  'AI composer focus should be shown as a soft internal paper-geometry ring on the input card.',
);

console.log('Verified AI composer focus style avoids the global hard outline.');

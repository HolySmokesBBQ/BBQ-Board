// The consent card has to say what Board sends to Google Analytics, and
// the way that goes wrong is omission: someone adds a tracked field and the
// sentence the user agreed to stops covering it. In October 2026 both the
// Board and Notebook sentences had been written by guessing, and both left
// out location. This test reads every analytics call in Board's source and
// fails when a parameter appears that consentCopy.js has not accounted for.
// Fix it by updating the consent sentence (and bumping CONSENT_TEXT_VERSION
// if the change is material), then adding the key to DISCLOSED_PARAMS.

import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DISCLOSED_PARAMS, BOARD_CONSENT } from './consentCopy.js';

const ROOT = resolve(__dirname, '../..');
const files = [
  'src/App.board.jsx',
  'src/main.board.jsx',
  ...readdirSync(resolve(ROOT, 'src/board'))
    .filter(f => /\.(js|jsx)$/.test(f) && !f.includes('.test.'))
    .map(f => join('src/board', f)),
];

// Parameter keys of every track('event', { ... }) call.
function trackedParamKeys() {
  const keys = new Set();
  for (const f of files) {
    const src = readFileSync(resolve(ROOT, f), 'utf8');
    for (const m of src.matchAll(/\btrack\(\s*['"`][\w-]+['"`]\s*,\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        // `key: value` or shorthand `key`; skips fragments like `100)` from
        // a comma inside a value expression.
        const k = part.trim().match(/^([A-Za-z_]\w*)\s*(?::|$)/);
        if (k) keys.add(k[1]);
      }
    }
  }
  return keys;
}

test('every tracked parameter is one the consent sentence accounts for', () => {
  const undisclosed = [...trackedParamKeys()].filter(k => !(k in DISCLOSED_PARAMS));
  expect(undisclosed, 'add these to the consent sentence and DISCLOSED_PARAMS').toEqual([]);
});

test('nothing outside src/board/analytics.js calls gtag directly', () => {
  const direct = files
    .filter(f => !f.endsWith('analytics.js'))
    .filter(f => /window\.gtag\s*\(|gtag\(\s*['"]event/.test(readFileSync(resolve(ROOT, f), 'utf8')));
  expect(direct).toEqual([]);
});

test('the sentence names the location data', () => {
  expect(BOARD_CONSENT.purpose).toMatch(/city you pick/);
  expect(BOARD_CONSENT.purpose).toMatch(/Near me/);
});

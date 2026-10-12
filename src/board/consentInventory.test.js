// The consent card has to say what Board sends to Google Analytics, and
// the way that goes wrong is omission: someone adds a tracked field and the
// sentence the user agreed to stops covering it. In October 2026 both the
// Board and Notebook sentences had been written by guessing, and both left
// out location. This test reads every analytics call Board ships and fails
// when a parameter appears that consentCopy.js has not accounted for, or
// when consentCopy.js still lists one the code no longer sends (the
// sentence matches the code in both directions).
//
// Fix a failure by updating the consent sentence and DISCLOSED_PARAMS. If
// the change adds data (not just rewording or sending less), bump
// CONSENT_VERSIONS.board in src/consent.js. CONSENT_TEXT_VERSION is the
// frozen legacy record version and never moves.
//
// It walks the real import graph out of src/main.board.jsx rather than a
// file list, so a shared module Board starts importing is covered too.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { DISCLOSED_PARAMS, BOARD_CONSENT } from './consentCopy.js';

const ROOT = resolve(__dirname, '../..');
const ENTRY = resolve(ROOT, 'src/main.board.jsx');
const norm = (p) => p.split(sep).join('/');

function reachableFiles() {
  const seen = new Set();
  const resolveSpec = (spec, from) => {
    if (!spec.startsWith('.')) return null;
    const base = resolve(dirname(from), spec);
    return [base, base + '.js', base + '.jsx', join(base, 'index.js'), join(base, 'index.jsx')]
      .find(c => existsSync(c) && statSync(c).isFile()) || null;
  };
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const r = resolveSpec(m[1], f);
      if (r) walk(r);
    }
  };
  walk(ENTRY);
  return [...seen].filter(f => !/\.test\.(js|jsx)$/.test(norm(f)));
}

// The text of every track( ... ) call, balanced on parentheses so a call
// split over several lines is read whole (after Scorecard's
// analyticsNoErrorText.test.js).
function trackCalls(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('track(', i)) !== -1) {
    if (/[\w.]/.test(src[i - 1] || '')) { i += 6; continue; } // x.track(, onTrack(
    let depth = 0, j = i + 5;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')' && --depth === 0) break;
    }
    out.push(src.slice(i, j + 1));
    i = j + 1;
  }
  return out;
}

const SHIPPED = reachableFiles();
const CALLS = SHIPPED.flatMap(f =>
  trackCalls(readFileSync(f, 'utf8')).map(call => ({ file: norm(f).replace(norm(ROOT) + '/', ''), call })));

// Top-level keys of the params object in a track('event', { ... }) call.
function paramKeys(call) {
  const open = call.indexOf('{');
  if (open === -1) return [];
  const keys = [];
  let depth = 0, token = '';
  for (let k = open; k < call.length; k++) {
    const ch = call[k];
    if ('{(['.includes(ch)) { depth++; if (depth === 1) continue; }
    if ('})]'.includes(ch)) { depth--; if (depth === 0) break; }
    if (depth === 1 && ch === ',') { token = ''; continue; }
    if (depth === 1) {
      token += ch;
      const m = token.match(/^\s*([A-Za-z_]\w*)\s*:$/);
      if (m) keys.push(m[1]);
    }
  }
  // Shorthand `{ cut, storeType }`: identifiers between commas at depth 1.
  const body = call.slice(open + 1, call.lastIndexOf('}'));
  for (const part of body.split(',')) {
    const m = part.trim().match(/^([A-Za-z_]\w*)$/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

const TRACKED = new Set(CALLS.flatMap(c => paramKeys(c.call)));

test("the walk reaches Board's screens", () => {
  const files = SHIPPED.map(norm);
  for (const f of ['src/App.board.jsx', 'src/board/Settings.jsx', 'src/board/Onboarding.jsx', 'src/board/ErrorBoundary.jsx']) {
    expect(files.some(x => x.endsWith(f)), f).toBe(true);
  }
  // A resolver regression would empty this and every check below would
  // pass by inspecting nothing.
  expect(CALLS.length).toBeGreaterThan(20);
});

test('every tracked parameter is one the consent sentence accounts for', () => {
  const undisclosed = [...TRACKED].filter(k => !(k in DISCLOSED_PARAMS));
  expect(undisclosed, 'add these to the consent sentence and DISCLOSED_PARAMS').toEqual([]);
});

test('the sentence lists nothing the code no longer sends', () => {
  const stale = Object.keys(DISCLOSED_PARAMS).filter(k => !TRACKED.has(k));
  expect(stale, 'narrow the consent sentence and drop these from DISCLOSED_PARAMS').toEqual([]);
});

test('no track() call sends error text', () => {
  const offenders = CALLS
    .filter(({ call }) => /\.(message|stack)\b|String\(\s*e(rr|rror)?\b/.test(call))
    .map(({ file, call }) => `${file}: ${call.replace(/\s+/g, ' ').slice(0, 120)}`);
  expect(offenders, 'route the error through errorCode() from src/analyticsCodes.js').toEqual([]);
});

test('nothing outside src/board/analytics.js calls gtag directly', () => {
  const direct = SHIPPED
    .filter(f => !norm(f).endsWith('src/board/analytics.js') && !norm(f).endsWith('src/consent.js'))
    .filter(f => /window\.gtag\s*\(|gtag\(\s*['"]event/.test(readFileSync(f, 'utf8')))
    .map(f => norm(f).replace(norm(ROOT) + '/', ''));
  expect(direct).toEqual([]);
});

test('the sentence names the location data', () => {
  expect(BOARD_CONSENT.purpose).toMatch(/city you pick/);
  expect(BOARD_CONSENT.purpose).toMatch(/Near me/);
});

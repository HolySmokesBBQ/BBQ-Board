// Scorecard's consent card has to say what Scorecard sends to Google
// Analytics. Modelled on consentInventory.notebook.test.js (Notebook
// session, 2026-10-07): walk the real import graph out of src/main.jsx and
// fail on any parameter the sentence doesn't account for. Omission is the
// failure mode, so reading the app never catches it.
//
// Scorecard's sentence through 4.3.0 named screens, features and restaurant
// names. This inventory found 19 more parameter keys plus the user
// properties, which is why 4.4.0 rewrote the sentence and bumped Scorecard's
// entry in CONSENT_VERSIONS (src/consent.js).
//
// Two things go to GA4 besides track() params, and both are checked here:
// the user properties scoring.js sets on every session (_gaContext), and the
// keys AppContext feeds into them through setGaContext().

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';

const ROOT = resolve(__dirname, '..');
const ENTRY = resolve(ROOT, 'src/main.jsx');
const norm = (p) => p.split(sep).join('/');
const rel = (p) => norm(p).replace(norm(ROOT) + '/', '');

// Every key Scorecard sends, mapped to the part of the scorecard entry in
// ConsentCard.jsx that discloses it. A key here is a promise that the
// sentence covers it.
const DISCLOSED_PARAMS = {
  // "which screens and features you use" -- navigation, and the shape of an
  // action rather than its content.
  view: 'features', from: 'features', to: 'features', target: 'features',
  source: 'features', method: 'features',
  // "the restaurant name on reviews you save, open, share, export or delete
  // and whether friends were on it"
  restaurant: 'restaurant', restaurant_a: 'restaurant', restaurant_b: 'restaurant',
  has_friends: 'restaurant',
  // "how many reviews and friends you have and whether you're signed in"
  reviews: 'library', review_count: 'library', friends: 'library',
  friend_count: 'library', signed_in: 'library',
  // Always 0 and always 'restaurants' in Scorecard: no cook screen is in
  // this graph (asserted below) and main.jsx pins the mode. Still sent as
  // user properties, so still listed.
  cook_count: 'library', recipe_count: 'library', app_mode: 'library',
  // "how much your score for a place moved since your last visit"
  delta: 'rematch',
  // "how many scorers sat at a blind table and how far apart they were"
  scorers: 'blind_table', top_spread: 'blind_table',
  // "the filters, sort and theme you pick" -- the filter's kind or chip key
  // (top/recent/photos, trip/city), never the trip or city itself.
  filter: 'choices', type: 'choices', sort: 'choices', theme: 'choices',
  // "how far a nearby search reached and how many places it found"
  radius: 'nearby', results: 'nearby',
  // "how many badges you've earned"
  earned_count: 'badges', total: 'badges',
  // "how many photos get saved or repaired"
  count: 'photos', restored: 'photos',
  // "a code for any error it runs into" -- bounded codes from
  // analyticsCodes.js; analyticsNoErrorText.test.js keeps that true.
  reason: 'errors',
};

function reachableFiles() {
  const seen = new Set();
  const resolveSpec = (spec, fromFile) => {
    if (!spec.startsWith('.')) return null;
    const base = resolve(dirname(fromFile), spec);
    const candidates = [base, base + '.js', base + '.jsx', join(base, 'index.js'), join(base, 'index.jsx')];
    return candidates.find((c) => existsSync(c) && statSync(c).isFile()) || null;
  };
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    // Static imports/re-exports and dynamic import() alike.
    for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const r = resolveSpec(m[1], file);
      if (r) walk(r);
    }
  };
  walk(ENTRY);
  return [...seen].filter((f) => !/\.test\.(js|jsx)$/.test(norm(f))).sort();
}

// Keys of every `fn('event', { ... })` / `fn({ ... })` object literal, with
// the file each came from so a failure says where to look.
function objectKeys(files, callRe) {
  const found = new Map();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(callRe)) {
      for (const part of m[1].split(',')) {
        // `key: value` or shorthand `key`; skips fragments such as `80)`
        // left behind by a comma inside a value expression.
        const k = part.trim().match(/^([A-Za-z_]\w*)\s*(?::|$)/);
        if (!k) continue;
        if (!found.has(k[1])) found.set(k[1], new Set());
        found.get(k[1]).add(rel(f));
      }
    }
  }
  return found;
}

const TRACK_RE = /\btrack\(\s*['"`][\w-]+['"`]\s*,\s*\{([^}]*)\}/g;
const SET_CONTEXT_RE = /\bsetGaContext\(\s*\{([^}]*)\}/g;

// Keys _flushUserProperties strips before anything reaches gtag.
function strippedKeys() {
  const src = readFileSync(resolve(ROOT, 'src/scoring.js'), 'utf8');
  const strip = src.match(/const \{([^}]*)\.\.\.userProps \} = _gaContext/);
  expect(strip, 'the user_properties destructure has moved').toBeTruthy();
  return strip[1].split(',').map((s) => s.trim()).filter(Boolean);
}

// The user properties scoring.js sends on every flush, read from the
// _gaContext initializer minus the keys it strips (user_id, _view).
function userProperties() {
  const src = readFileSync(resolve(ROOT, 'src/scoring.js'), 'utf8');
  const body = src.match(/const _gaContext = \{([\s\S]*?)\n\};/);
  expect(body, '_gaContext has moved; point this test at it').toBeTruthy();
  const stripped = strippedKeys();
  return [...body[1].matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)]
    .map((m) => m[1])
    .filter((k) => !stripped.includes(k));
}

function undisclosed(found) {
  return [...found]
    .filter(([k]) => !(k in DISCLOSED_PARAMS))
    .map(([k, where]) => `${k} (${[...where].join(', ')})`)
    .sort();
}

test('the import walk actually reaches Scorecard, not just its entry file', () => {
  // Guards the rest of this file: a resolver regression would empty the
  // graph and every assertion below would pass by looking at nothing.
  const files = reachableFiles().map(rel);
  expect(files).toContain('src/components/ReviewForm.jsx');
  expect(files).toContain('src/components/ConsentCard.jsx');
  expect(files).toContain('src/context/AppContext.jsx');
  expect(files.length).toBeGreaterThan(30);
});

test('every tracked parameter is one the consent sentence accounts for', () => {
  const found = objectKeys(reachableFiles(), TRACK_RE);
  expect(found.size, 'no track() calls found; the regex has broken').toBeGreaterThan(10);
  expect(undisclosed(found), 'Disclose these in the scorecard entry of ConsentCard.jsx, then map them above').toEqual([]);
});

test('every user property is one the consent sentence accounts for', () => {
  const props = userProperties();
  expect(props).toContain('review_count');
  expect(props).not.toContain('user_id');
  const found = objectKeys(reachableFiles(), SET_CONTEXT_RE);
  // user_id is handed to setGaContext but never sent (dropped 2026-09-29).
  for (const k of strippedKeys()) found.delete(k);
  for (const k of props) if (!found.has(k)) found.set(k, new Set(['src/scoring.js']));
  expect(undisclosed(found), 'Disclose these in the scorecard entry of ConsentCard.jsx, then map them above').toEqual([]);
});

test('no cook screen is in the Scorecard graph, so cook and recipe counts stay 0', () => {
  // The sentence says nothing about cooks or recipes because cook_count and
  // recipe_count only ever go out as their initial 0 here. If CookContext
  // becomes reachable they carry real numbers and the sentence has to say so.
  const files = reachableFiles().map(rel);
  expect(files).not.toContain('src/context/CookContext.jsx');
});

test('the sentence names what this inventory found', () => {
  // Read as text: importing the card would pull React and Firebase in behind
  // it, and CONSENT_PURPOSE follows window.GA_CONTENT_GROUP.
  const src = readFileSync(resolve(ROOT, 'src/components/ConsentCard.jsx'), 'utf8');
  const entry = src.match(/scorecard:\s*\{([\s\S]*?)\n  \}/);
  expect(entry, 'the scorecard entry has moved or been renamed').toBeTruthy();
  // Join the concatenated string literals so a phrase split across lines
  // still matches.
  const collects = entry[1].replace(/['"]\s*\+\s*['"]/g, '');
  expect(collects).toMatch(/restaurant name/);
  expect(collects).toMatch(/whether friends were on it/);
  expect(collects).toMatch(/reviews and friends you have/);
  expect(collects).toMatch(/signed in/);
  expect(collects).toMatch(/since your last visit/);
  expect(collects).toMatch(/blind table/);
  expect(collects).toMatch(/filters, sort and theme/);
  expect(collects).toMatch(/nearby search/);
  expect(collects).toMatch(/badges/);
  expect(collects).toMatch(/photos/);
  expect(collects).toMatch(/a code for any error/);
  expect(collects).toMatch(/holysmokesbbqco\.com\/privacy\.html/);
});

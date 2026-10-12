// The consent card has to say what BBQ Notebook sends to Google Analytics,
// and the way that goes wrong is omission: someone adds a tracked field and
// the sentence the user already agreed to stops covering it.
//
// That has happened twice. The first Notebook sentence named only cuts and
// cook types. The 2026-10-07 rewrite, done after the Board session showed
// their sentence had been written by guessing, still left out the error
// messages, the thermometer import and the humidity range. Both times the
// statement was incomplete rather than false, which is exactly why nobody
// caught it by reading the app.
//
// So this does not trust a hand-written file list the way the Board version
// does. Notebook draws most of its screens from the shared src/components
// and src/context trees, so a list would go stale the moment a shared
// component picked up a new track() call. This walks the real import graph
// out of src/main.notebook.jsx and fails on any parameter the sentence does
// not account for.
//
// When it fails: update COPY.collects in src/components/ConsentCard.jsx so
// the sentence covers the new field, then add the key here. Read the note on
// CONSENT_TEXT_VERSION in src/consent.js before bumping it — a bump
// re-prompts every user of all three apps, and a disclosure fix is not a
// reason to.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';

const ROOT = resolve(__dirname, '..');
const ENTRY = resolve(ROOT, 'src/main.notebook.jsx');
const norm = (p) => p.split(sep).join('/');
const rel = (p) => norm(p).replace(norm(ROOT) + '/', '');

// Every parameter key Notebook sends, mapped to the part of the consent
// sentence that discloses it. A key here is a promise that the sentence
// covers it; the mapping is what makes that checkable by eye.
const DISCLOSED_PARAMS = {
  // "which screens and features you use" — navigation, and the shape of an
  // action rather than its content.
  view: 'features', source: 'features', from: 'features', target: 'features',
  count: 'features', method: 'features', ok: 'features', restored: 'features',
  // "how many cooks, recipes and friends you have when it syncs"
  cooks: 'library', recipes: 'library', friend_cooks: 'library',
  tier_id: 'library', type: 'library',
  // "the meat type on cooks you share, export or delete"
  meat: 'cook', meatType: 'cook',
  // "a range for any pit humidity you work out and whether that used your
  // location" — rh_bucket is a band, never the computed figure.
  rh_bucket: 'humidity', pressure_source: 'humidity',
  // "the thermometer brand you import from and how much a file brought in"
  brand: 'import', photo_count: 'import', cook_temp_found: 'import',
  date_found: 'import', meat_found: 'import', duration_found: 'import',
  finish_found: 'import',
  // "the error messages the app runs into". Truncated at the call site and
  // run through scrubParams, which replaces anything email-shaped.
  reason: 'errors', message: 'errors',
};

// Scorecard's review events live in the shared AppContext, so they are
// reachable by import from Notebook's entry even though no Notebook screen
// calls them. That is the only reason Notebook's sentence can stay silent
// about restaurant names. These keys are allowed to exist in the files that
// define Scorecard's review flow, and nowhere else in Notebook's graph --
// if one turns up in a Notebook screen, a review flow has been wired in and
// the sentence has to start disclosing it.
// `location` here is the restaurant's own location field off the review
// record, not anything about where the user is. Notebook's one piece of real
// location telemetry is pressure_source, under 'humidity' above.
const REVIEW_ONLY_PARAMS = ['restaurant', 'location', 'stars', 'composite', 'reviews', 'review_count'];
const REVIEW_FLOW_FILES = ['src/context/AppContext.jsx', 'src/scoring.js'];

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

// Parameter keys of every track('event', { ... }) call, with the file each
// came from so a failure says where to look.
function trackedParams(files) {
  const found = new Map();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\btrack\(\s*['"`][\w-]+['"`]\s*,\s*\{([^}]*)\}/g)) {
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

test('the import walk actually reaches Notebook, not just its entry file', () => {
  // Guards the rest of this file: a resolver regression would empty the
  // graph and every assertion below would pass by looking at nothing.
  const files = reachableFiles().map(rel);
  expect(files).toContain('src/components/NotebookHome.jsx');
  expect(files).toContain('src/components/ConsentCard.jsx');
  expect(files).toContain('src/context/AppContext.jsx');
  expect(files.length).toBeGreaterThan(30);
});

test('every tracked parameter is one the consent sentence accounts for', () => {
  const found = trackedParams(reachableFiles());
  const undisclosed = [...found]
    .filter(([k]) => !(k in DISCLOSED_PARAMS) && !REVIEW_ONLY_PARAMS.includes(k))
    .map(([k, where]) => `${k} (${[...where].join(', ')})`);
  expect(
    undisclosed,
    'Disclose these in ConsentCard.jsx COPY.collects, then add them to DISCLOSED_PARAMS',
  ).toEqual([]);
});

test('no Notebook screen has been wired into a review flow', () => {
  const found = trackedParams(reachableFiles());
  const leaked = [];
  for (const key of REVIEW_ONLY_PARAMS) {
    for (const file of found.get(key) || []) {
      if (!REVIEW_FLOW_FILES.includes(file)) leaked.push(`${key} (${file})`);
    }
  }
  expect(
    leaked,
    "Notebook's consent sentence says nothing about restaurants or ratings",
  ).toEqual([]);
});

test('nothing outside scoring.js talks to gtag directly', () => {
  // scoring.js owns the wrapper, and the wrapper is where the consent gate
  // is. A direct call anywhere else would send without checking.
  const direct = reachableFiles()
    .filter((f) => !/src\/(scoring\.js|consent\.js)$/.test(norm(f)))
    .filter((f) => /window\.gtag\s*\(|gtag\(\s*['"]event/.test(readFileSync(f, 'utf8')))
    .map(rel);
  expect(direct, 'route this through track() in scoring.js so consent is checked').toEqual([]);
});

test('the sentence names the categories that were missing before', () => {
  // Read as text rather than imported: the card builds CONSENT_PURPOSE from
  // window.GA_CONTENT_GROUP, which is unset under vitest and would hand back
  // Scorecard's wording, and importing the module would pull React and
  // Firebase in behind it. The notebook entry is the thing under test.
  const src = readFileSync(resolve(ROOT, 'src/components/ConsentCard.jsx'), 'utf8');
  const entry = src.match(/notebook:\s*\{([\s\S]*?)\n  \}/);
  expect(entry, 'the notebook entry has moved or been renamed').toBeTruthy();
  const collects = entry[1];
  expect(collects).toMatch(/error messages/);
  expect(collects).toMatch(/thermometer brand/);
  expect(collects).toMatch(/pit humidity/);
  expect(collects).toMatch(/used your location/);
  expect(collects).toMatch(/cooks, recipes and friends/);
  // The card is shared, so a regression that points Notebook at Scorecard's
  // privacy page would otherwise be invisible here.
  expect(collects).toMatch(/privacy-notebook\.html/);
});

test('the shared card carries no stale copy for Board', () => {
  // Board cannot render this card (it would pull Scorecard's AppContext and
  // Firebase into Board) and keeps its own wording in src/board/consentCopy.js.
  // An entry here would be dead code that silently drifts behind the sentence
  // Board actually ships, which is worse than having none.
  const src = readFileSync(resolve(ROOT, 'src/components/ConsentCard.jsx'), 'utf8');
  expect(src).not.toMatch(/^\s*board:\s*\{/m);
});

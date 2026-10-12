// Field-parity check: client-sendable fields vs firestore.rules whitelists.
//
// Born from the third strike of one failure class (2026-10-01):
//   1. Board region allowlist drifted behind schema.js  -> submissions denied
//   2. pitWetBulbF missing from whitelists              -> pit data never synced
//   3. drinks/orderStyle missing from reviewFields()    -> ALL review sync dead
//      for 7 weeks (3.6.3 added the fields, rules never got them; the atomic
//      batch in syncReviewsUp meant one denied doc failed every review, silently)
//
// Rule the mechanism enforces: any new field on a synced doc goes into the
// rules whitelist and is PUBLISHED before the client ships it. This script
// catches the repo-side half: a client that can send a field the repo's
// rules don't allow is a failure. (Whether the PUBLISHED ruleset matches the
// repo is check:rules / deploy discipline.)
//
// Sources of truth compared:
//   reviews: keys of emptyReview() in src/scoring.js  (client sends emptyReview
//            keys minus _-prefixed, plus server-added: userId, restaurantKey,
//            syncedAt, photo, photos)                 vs rules reviewFields()
//   cooks:   COOK_FIELD_WHITELIST in src/firebaseSync.js   vs rules cookFields()
//   recipes: RECIPE_FIELD_WHITELIST in src/firebaseSync.js vs rules recipeFields()
//
// Directionality: client ⊆ rules is REQUIRED (missing-in-rules = silent write
// denial, the killer). rules ⊇ client surplus is reported as INFO only.
//
// Usage: npm run check:fields            report, exits 0
//        npm run check:fields -- --strict  exits 1 on any missing-in-rules

import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const strict = process.argv.includes('--strict');
// Comments stripped on read: the first run of this script "found" a FAIL that
// was actually an apostrophe inside a code comment. Parse code, not prose.
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"])\/\/[^\n'"]*$/gm, '$1');
const read = p => stripComments(readFileSync(ROOT + '/' + p, 'utf8'));

// ── rules side ──────────────────────────────────────────────
const rules = read('firestore.rules');
function rulesList(fnName) {
  const m = rules.match(new RegExp('function ' + fnName + '\\(\\)\\s*\\{\\s*return \\[([\\s\\S]*?)\\]', ''));
  if (!m) throw new Error('rules: ' + fnName + ' not found');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

// ── client side ─────────────────────────────────────────────
function jsArray(src, constName) {
  const m = src.match(new RegExp('const ' + constName + '\\s*=\\s*\\[([\\s\\S]*?)\\]', ''));
  if (!m) throw new Error('client: ' + constName + ' not found');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}
function emptyReviewKeys(src) {
  const start = src.indexOf('export function emptyReview');
  if (start < 0) throw new Error('client: emptyReview() not found in scoring.js');
  const open = src.indexOf('{', src.indexOf('return', start));
  let depth = 0, end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  // Depth-1 keys only: emptyReview nests objects (e.g. scores: {...}) whose
  // inner keys are NOT top-level Firestore fields.
  const body = src.slice(open + 1, end);
  // emptyReview packs several keys per line, so mask everything that is not
  // at object depth 0 (nested braces/brackets/parens and string contents),
  // then take every `identifier:` that survives.
  let masked = '';
  let nest = 0, inStr = null;
  for (const ch of body) {
    if (inStr) { masked += ' '; if (ch === inStr) inStr = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; masked += ' '; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { nest++; masked += ' '; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { nest--; masked += ' '; continue; }
    masked += nest === 0 ? ch : ' ';
  }
  return [...masked.matchAll(/([A-Za-z_]\w*)\s*:/g)].map(x => x[1]);
}

const sync = read('src/firebaseSync.js');
const scoring = read('src/scoring.js');

// Fields the sync layer adds server-side of the component (see prepForFirestore*)
const REVIEW_SYNC_ADDED = ['userId', 'restaurantKey', 'syncedAt', 'photo', 'photos'];

const CHECKS = [
  {
    name: 'reviews',
    client: [...new Set([...emptyReviewKeys(scoring).filter(k => !k.startsWith('_')), ...REVIEW_SYNC_ADDED])],
    rules: rulesList('reviewFields'),
    clientSrc: 'scoring.js emptyReview() + sync-added',
  },
  { name: 'cooks', client: jsArray(sync, 'COOK_FIELD_WHITELIST'), rules: rulesList('cookFields'), clientSrc: 'firebaseSync COOK_FIELD_WHITELIST' },
  { name: 'recipes', client: jsArray(sync, 'RECIPE_FIELD_WHITELIST'), rules: rulesList('recipeFields'), clientSrc: 'firebaseSync RECIPE_FIELD_WHITELIST' },
];

let failures = 0;
// Degenerate-parse guard: a guard tool must never false-OK. If any extraction
// returns implausibly few fields, that is a parser failure, not a pass.
const MIN_PLAUSIBLE = { reviews: 15, cooks: 20, recipes: 10 };
for (const c of CHECKS) {
  if (c.client.length < (MIN_PLAUSIBLE[c.name] || 5)) {
    console.log(`FAIL ${c.name.padEnd(8)} PARSER DEGENERATE: extracted only ${c.client.length} client fields (${c.clientSrc}) — the schema shape changed and this script can no longer see it. Fix the extractor; do not trust this run.`);
    failures++;
    process.exitCode = 1;
  }
}
for (const c of CHECKS) {
  const rulesSet = new Set(c.rules);
  const clientSet = new Set(c.client);
  const missingInRules = c.client.filter(f => !rulesSet.has(f));
  const rulesOnly = c.rules.filter(f => !clientSet.has(f));
  const status = missingInRules.length ? 'FAIL' : 'OK  ';
  if (missingInRules.length) failures++;
  console.log(`${status} ${c.name.padEnd(8)} client:${String(c.client.length).padStart(3)} (${c.clientSrc})  rules:${c.rules.length}`);
  if (missingInRules.length) console.log(`     MISSING IN RULES (writes will be DENIED, silently): ${missingInRules.join(', ')}`);
  if (rulesOnly.length) console.log(`     rules-only (permissive surplus, info): ${rulesOnly.join(', ')}`);
}
// ── Leg 3 (optional): repo rules vs PUBLISHED ruleset ───────
// The honest invariant is three-way: client ⊆ repo rules ⊆ published rules.
// Legs 1-2 above are repo-vs-repo; a correct repo whose publish never landed
// is exactly how the Notebook signup outage survived July→September.
// Usage: --published <file>  where <file> holds the LIVE ruleset body, read
// by CONTENT from the console/CLI. NEVER verify a publish via the console's
// ruleset-version list — it does not update reliably; read the rules body.
//
// SHIP-GATE ALTERNATIVE (Notebook's find): `firebase deploy --only
// firestore:rules --project <p>` printing "already up to date, skipping
// upload" IS leg-3 green from the authority itself (Firebase diffs local vs
// published). CAVEAT: that command is a DEPLOY, not a probe — on drift it
// PUBLISHES. Use it only at the ship gate where publishing is the intent,
// never as a casual read. (True read-only automation via the Rules API once
// CLI reauth is restored.)
//
// STRUCTURAL NOTE: the shared firestore.rules deploys to multiple projects,
// so one app's rules change creates automatic repo-vs-published "drift" on
// sibling projects. Harmless drift (fields for collections a project doesn't
// have) should be FLAGGED, not closed by republishing another app's changes
// into the wrong project. Clean fix direction: per-project rules files
// (Board's firestore.board.rules pattern).
const pubIdx = process.argv.indexOf('--published');
if (pubIdx > -1 && process.argv[pubIdx + 1]) {
  const pub = stripComments(readFileSync(process.argv[pubIdx + 1], 'utf8'));
  const pubList = fn => {
    const m = pub.match(new RegExp('function ' + fn + '\\(\\)\\s*\\{\\s*return \\[([\\s\\S]*?)\\]', ''));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;
  };
  console.log('\n── Leg 3: repo rules vs published ruleset ──');
  for (const fn of ['reviewFields', 'cookFields', 'recipeFields']) {
    const repo = rulesList(fn);
    const live = pubList(fn);
    if (!live) { console.log(`FAIL ${fn}: not found in published ruleset file`); failures++; continue; }
    const liveSet = new Set(live);
    const unpublished = repo.filter(f => !liveSet.has(f));
    if (unpublished.length) {
      console.log(`FAIL ${fn}: in repo but NOT PUBLISHED (live writes will be DENIED): ${unpublished.join(', ')}`);
      failures++;
    } else {
      console.log(`OK   ${fn}: published ruleset covers all ${repo.length} repo fields`);
    }
  }
}

console.log(failures === 0
  ? '\nAll checks green.'
  : `\n${failures} failure(s). Fix the rules, PUBLISH them, verify by CONTENT, then ship the client.`);
if (pubIdx === -1) console.log('(Legs 1-2 only: repo rules. Add --published <live-ruleset-file> for leg 3.)');
if (strict && failures) process.exit(1);

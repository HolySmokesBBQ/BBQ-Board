// No analytics event in Scorecard may carry error TEXT. Messages can hold
// emails, names or addresses; scrubParams only catches email-shaped strings.
// Every failure reason must go through errorCode() in analyticsCodes.js.
// (Auditor ruling 2026-10-12. profile_load_failed slipped past a
// single-line grep because its call spans two lines, so this reads whole
// track(...) calls, however they're wrapped.)
//
// Walks the real import graph out of src/main.jsx, so it covers exactly the
// code Scorecard ships.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';

const ROOT = resolve(__dirname, '..');
const ENTRY = resolve(ROOT, 'src/main.jsx');
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
// split over several lines is read whole.
function trackCalls(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('track(', i)) !== -1) {
    if (/[\w.]/.test(src[i - 1] || '')) { i += 6; continue; } // e.g. x.track(
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

test('the walk reaches Scorecard\'s screens', () => {
  const files = reachableFiles().map(f => norm(f));
  expect(files.some(f => f.endsWith('src/context/AppContext.jsx'))).toBe(true);
  expect(files.some(f => f.endsWith('src/components/ReviewForm.jsx'))).toBe(true);
});

test('no track() call sends error text', () => {
  const offenders = [];
  for (const f of reachableFiles()) {
    for (const call of trackCalls(readFileSync(f, 'utf8'))) {
      if (/\.(message|stack)\b|String\(\s*e(rr|rror)?\b/.test(call)) {
        offenders.push(`${norm(f).replace(norm(ROOT) + '/', '')}: ${call.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    }
  }
  expect(offenders, 'route the error through errorCode() from analyticsCodes.js').toEqual([]);
});

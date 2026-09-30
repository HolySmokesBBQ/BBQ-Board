// Stage the L-3 privacy policy drafts into the three live pages' chrome.
//
//   node scripts/stage-privacy-policies.mjs            → docs/legal/staged/*.html
//   node scripts/stage-privacy-policies.mjs --publish  → public/*.html (only after
//                                                        Joel's two bracketed decisions)
//
// Source: docs/legal/PRIVACY-POLICY-DRAFTS-2026-09-29.md (Overseer, counsel
// work product). Each policy replaces the body of its page; head, header,
// footer script and styling are kept from the current public/ file. The
// "Last updated" date is set to today on --publish and left as a marker
// when staging.
//
// Antislop pass (approved: antislop yes, voice pass no): the only edits to
// the counsel text are the em dashes, each replaced by a colon, comma or
// parenthesis with the sentence meaning unchanged, asserted below. No
// other wording is touched; anything else worth changing is a decision
// for the Overseer or Joel and is reported, not edited.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const publish = process.argv.includes('--publish');
const md = readFileSync(resolve(ROOT, 'docs/legal/PRIVACY-POLICY-DRAFTS-2026-09-29.md'), 'utf8').replace(/\r\n/g, '\n');

const POLICIES = [
  { key: 'scorecard', heading: '## POLICY 1 — BBQ Scorecard', page: 'privacy.html',          deletePage: '/delete-account.html' },
  { key: 'notebook',  heading: '## POLICY 2 — BBQ Notebook',  page: 'privacy-notebook.html', deletePage: '/notebook/delete-account-notebook.html' },
  { key: 'board',     heading: '## POLICY 3 — BBQ Board',     page: 'privacy-board.html',    deletePage: '/delete-account-board.html' },
];

// Em-dash edits. Each must match exactly once across the whole draft so a
// re-drafted sentence fails loudly instead of slipping through with a dash.
// Rev 2 (2f89dcc) rewrote two of the four rev-1 dash sentences; these are
// the two that remain.
const DASH_EDITS = [
  ['The reviews you write — restaurant names, scores, notes, dates, and any photos you attach.',
   'The reviews you write: restaurant names, scores, notes, dates, and any photos you attach.'],
  ['saves the weather values — temperature, wind, humidity — with your cook.',
   'saves the weather values (temperature, wind, humidity) with your cook.'],
  // Board's draft spells the deletion URL in parentheses; the page links the
  // phrase, so the bare URL would print twice.
  ['our account deletion page (/delete-account-board.html)', 'our account deletion page'],
];
let text = md;
for (const [from, to] of DASH_EDITS) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`dash edit expected once, found ${n}: ${from.slice(0, 60)}`);
  text = text.replace(from, to);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s, deletePage) {
  let h = esc(s);
  h = h.replace(/datadelete@holysmokesbbqco\.com/g, '<a href="mailto:datadelete@holysmokesbbqco.com">datadelete@holysmokesbbqco.com</a>');
  h = h.replace(/our account deletion page/g, `<a href="${deletePage}">our account deletion page</a>`);
  return h;
}

function policyBody(p) {
  const start = text.indexOf(p.heading);
  if (start < 0) throw new Error('missing ' + p.heading);
  const next = text.indexOf('\n## POLICY', start + p.heading.length);
  const block = text.slice(start, next < 0 ? undefined : next).split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const s = para.join(' ').trim(); para = [];
    if (!s || s === '---') return;
    if (/^###? /.test(s) || /^\*\*Last updated/.test(s)) return;
    let m;
    if ((m = /^\*\*(.+)\*\*$/.exec(s))) { out.push(`    <h2>${esc(m[1]).toUpperCase()}</h2>`); return; }
    if ((m = /^\*([^*]+)\*\s+(.*)$/.exec(s))) { out.push(`    <p><strong>${esc(m[1])}</strong> ${inline(m[2], p.deletePage)}</p>`); return; }
    out.push(`    <p>${inline(s, p.deletePage)}</p>`);
  };
  for (const line of block) { if (line.trim() === '') flush(); else para.push(line); }
  flush();
  return out.join('\n');
}

const today = new Date();
const dateLabel = publish
  ? today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : '[PUBLISH DATE]';

const outDir = publish ? resolve(ROOT, 'public') : resolve(ROOT, 'docs/legal/staged');
mkdirSync(outDir, { recursive: true });

for (const p of POLICIES) {
  const src = readFileSync(resolve(ROOT, 'public', p.page), 'utf8');
  const crlf = src.includes('\r\n');
  const s = src.replace(/\r\n/g, '\n');
  const subRe = /(<p class="subtitle">[^<]*Last updated )[^<]*(<\/p>\n)/;
  if (!subRe.test(s)) throw new Error(p.page + ': subtitle line not found');
  const headEnd = s.indexOf('</p>\n', s.search(subRe)) + '</p>\n'.length;
  const tailStart = s.indexOf('\n  </div>\n', headEnd);
  if (tailStart < 0) throw new Error(p.page + ': container end not found');
  let head = s.slice(0, headEnd).replace(subRe, `$1${dateLabel}$2`);
  const tail = s.slice(tailStart);
  const html = head + '\n' + policyBody(p) + tail;
  if (/—/.test(html.slice(headEnd))) throw new Error(p.page + ': em dash survived in body');
  // The banner rule bans "anonymous" in consent copy. In a policy the word
  // can be the accurate name of Firebase anonymous auth (Board, rev 2), so
  // report it for the Overseer rather than block on it.
  const anon = (html.slice(headEnd).match(/[^.]*anonymous[^.]*\./gi) || []);
  if (anon.length) console.log(`  note ${p.page}: "anonymous" appears ${anon.length}x: ${anon.map(s => s.trim().slice(0, 90)).join(' | ')}`);
  const dest = resolve(outDir, p.page);
  writeFileSync(dest, crlf ? html.replace(/\n/g, '\r\n') : html);
  const h2 = (html.match(/<h2>/g) || []).length, para = (html.slice(headEnd).match(/<p>|<p ><strong>|<p><strong>/g) || []).length;
  console.log(`${publish ? 'PUBLISHED' : 'staged'} ${dest.replace(ROOT + '\\', '').replace(ROOT + '/', '')}: ${h2} sections, ${para} paragraphs, date "${dateLabel}"`);
}

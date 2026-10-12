// public/brand-font.js: loads the Adobe Fonts kit only when lawful.
//   - no region cookie / other / unknown: load (US behaviour).
//   - hs_geo=eu with no stored consent: do NOT load (fallback faces).
//   - hs_geo=eu with stored granted: load. Stored denied: do not load.
//   - after a 'hs-consent' event with detail.choice === 'granted', load.
// Overseer ruling L-8 (2026-10-01): the font is a third-party IP transfer
// for EEA/UK/CH visitors and rides on the same consent as analytics.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SRC = readFileSync(resolve(__dirname, '../../public/brand-font.js'), 'utf8');

function run({ cookie = '', stored = null } = {}) {
  const store = new Map();
  if (stored) store.set('hs-consent-v1', JSON.stringify(stored));
  const head = { children: [], appendChild(n) { this.children.push(n); return n; } };
  const listeners = {};
  const sandbox = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null) },
    document: {
      cookie, head,
      createElement: tag => ({ tagName: tag.toUpperCase(), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, set rel(v) { this.attrs.rel = v; }, get rel() { return this.attrs.rel; }, set href(v) { this.attrs.href = v; }, get href() { return this.attrs.href; }, set crossOrigin(v) { this.attrs.crossorigin = v; } }),
      querySelector: sel => head.children.find(c => sel.includes('typekit') && String(c.attrs.href || '').includes('typekit')) || null,
    },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(SRC, sandbox, { filename: 'brand-font.js' });
  const kitLinks = () => head.children.filter(c => c.attrs.rel === 'stylesheet' && /use\.typekit\.net\/rrv8ywt\.css/.test(c.attrs.href));
  const fire = (choice) => (listeners['hs-consent'] || []).forEach(fn => fn({ detail: { choice } }));
  return { kitLinks, fire, head };
}

describe('brand-font loader', () => {
  it('loads for a visitor with no region cookie', () => { expect(run().kitLinks().length).toBe(1); });
  it('loads for hs_geo=other and unknown', () => {
    expect(run({ cookie: 'hs_geo=other' }).kitLinks().length).toBe(1);
    expect(run({ cookie: 'hs_geo=unknown' }).kitLinks().length).toBe(1);
  });
  it('does not load for hs_geo=eu without a stored choice', () => { expect(run({ cookie: 'a=1; hs_geo=eu' }).kitLinks().length).toBe(0); });
  it('loads for hs_geo=eu with a stored grant', () => {
    expect(run({ cookie: 'hs_geo=eu', stored: { choice: 'granted', timestamp: 't', consentTextVersion: '2026-10-01' } }).kitLinks().length).toBe(1);
  });
  it('does not load for hs_geo=eu with a stored denial', () => {
    expect(run({ cookie: 'hs_geo=eu', stored: { choice: 'denied', timestamp: 't', consentTextVersion: '2026-10-01' } }).kitLinks().length).toBe(0);
  });
  it('loads once when consent is granted on the page, and never twice', () => {
    const r = run({ cookie: 'hs_geo=eu' });
    expect(r.kitLinks().length).toBe(0);
    r.fire('denied'); expect(r.kitLinks().length).toBe(0);
    r.fire('granted'); expect(r.kitLinks().length).toBe(1);
    r.fire('granted'); expect(r.kitLinks().length).toBe(1);
  });
  it('adds a preconnect alongside the stylesheet', () => {
    const r = run();
    expect(r.head.children.some(c => c.attrs.rel === 'preconnect' && /use\.typekit\.net/.test(c.attrs.href))).toBe(true);
  });
});

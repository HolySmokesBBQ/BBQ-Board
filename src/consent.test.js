import { describe, test, expect, beforeEach, vi } from 'vitest';

// Minimal browser stand-ins: consent.js touches localStorage, document
// (to inject the analytics loader) and window flags.
function freshEnv() {
  const store = new Map();
  const appended = [];
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.window = { GA_MEASUREMENT_ID: 'G-TEST', GA_PAGE_TITLE: 'T', GA_CONTENT_GROUP: 'scorecard' };
  globalThis.document = {
    cookie: '',
    createElement: () => ({ dataset: {} }),
    head: { appendChild: (el) => appended.push(el) },
    querySelector: () => null,
  };
  return { store, appended };
}

let consent, env;
beforeEach(async () => {
  env = freshEnv();
  vi.resetModules();
  consent = await import('./consent.js');
});

describe('consent record', () => {
  test('no answer yet means analytics is not allowed', () => {
    expect(consent.getConsent()).toBeNull();
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('records choice, timestamp and text version, not a bare boolean', () => {
    consent.setConsent('granted');
    const rec = JSON.parse(env.store.get(consent.consentKeyFor('scorecard')));
    expect(rec.choice).toBe('granted');
    expect(rec.textVersion).toBe(consent.CONSENT_VERSIONS.scorecard);
    expect(typeof rec.at).toBe('string');
    expect(consent.analyticsAllowed()).toBe(true);
  });

  test('a record from an older consent text does not count', () => {
    env.store.set(consent.consentKeyFor('scorecard'), JSON.stringify({ choice: 'granted', at: '2026-01-01T00:00:00Z', textVersion: consent.CONSENT_VERSIONS.scorecard - 1 }));
    expect(consent.getConsent()).toBeNull();
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('garbage in storage is treated as unanswered', () => {
    env.store.set(consent.consentKeyFor('scorecard'), '{not json');
    expect(consent.getConsent()).toBeNull();
  });
});

// Per-app versions (2026-10-12). Each app reads its own key, falls back to
// the legacy shared key only when its own key is empty, and compares versions
// with strict equality. The stored shapes below are the ones already on
// users' devices, so each "validates without a prompt" test is a promise that
// the split does not re-prompt that app's users.
describe('per-app consent', () => {
  const legacyGrant = JSON.stringify({ choice: 'granted', at: '2026-10-01T00:00:00Z', textVersion: 1 });
  const asApp = (app) => { window.GA_CONTENT_GROUP = app; };

  test('Board: a 2.4.6 grant under the legacy key still counts, no prompt', () => {
    asApp('board');
    env.store.set(consent.LEGACY_CONSENT_KEY, legacyGrant);
    expect(consent.getConsent()?.choice).toBe('granted');
    expect(consent.analyticsAllowed()).toBe(true);
  });

  test('Notebook: an existing grant under the legacy key still counts, no prompt', () => {
    asApp('notebook');
    env.store.set(consent.LEGACY_CONSENT_KEY, legacyGrant);
    expect(consent.getConsent()?.choice).toBe('granted');
    expect(consent.analyticsAllowed()).toBe(true);
  });

  test('Scorecard: a version-1 record is asked again after the bump', () => {
    asApp('scorecard');
    expect(consent.CONSENT_VERSIONS.scorecard).not.toBe(1);
    env.store.set(consent.LEGACY_CONSENT_KEY, legacyGrant);
    expect(consent.getConsent()).toBeNull();
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('Board and Notebook stay on 1; any other value would re-prompt their users', () => {
    expect(consent.CONSENT_VERSIONS.board).toBe(1);
    expect(consent.CONSENT_VERSIONS.notebook).toBe(1);
  });

  test('each app writes only its own key and leaves the legacy record alone', () => {
    asApp('scorecard');
    env.store.set(consent.LEGACY_CONSENT_KEY, legacyGrant);
    consent.setConsent('denied');
    expect(JSON.parse(env.store.get('hs-analytics-consent:scorecard')).textVersion).toBe(consent.CONSENT_VERSIONS.scorecard);
    expect(env.store.get(consent.LEGACY_CONSENT_KEY)).toBe(legacyGrant);
  });

  test("one app answering does not change another app's answer on a shared origin", () => {
    asApp('notebook');
    consent.setConsent('granted');
    asApp('scorecard');
    consent.setConsent('denied');
    asApp('notebook');
    expect(consent.analyticsAllowed()).toBe(true);
    asApp('scorecard');
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('the own key wins whenever it holds anything, so a stale "No" never revives a legacy "Yes"', () => {
    asApp('board');
    env.store.set(consent.LEGACY_CONSENT_KEY, legacyGrant);
    env.store.set(consent.consentKeyFor('board'), JSON.stringify({ choice: 'denied', at: 'x', textVersion: 'stale' }));
    expect(consent.getConsent()).toBeNull();
    expect(consent.analyticsAllowed()).toBe(false);
  });

  test('versions compare strictly: a stored "1" is not 1', () => {
    asApp('board');
    env.store.set(consent.LEGACY_CONSENT_KEY, JSON.stringify({ choice: 'granted', at: 'x', textVersion: '1' }));
    expect(consent.getConsent()).toBeNull();
  });

  test('an unknown or missing app keeps the pre-split behaviour: legacy key, version 1', () => {
    delete window.GA_CONTENT_GROUP;
    env.store.set(consent.LEGACY_CONSENT_KEY, legacyGrant);
    expect(consent.analyticsAllowed()).toBe(true);
    asApp('toString');
    expect(consent.analyticsAllowed()).toBe(true);
    consent.setConsent('denied');
    expect(JSON.parse(env.store.get(consent.LEGACY_CONSENT_KEY)).choice).toBe('denied');
  });
});

describe('analytics loader', () => {
  test('nothing is injected before consent', () => {
    consent.startAnalyticsIfAllowed();
    expect(env.appended).toHaveLength(0);
  });

  test('granting injects the loader exactly once, carrying the page config', () => {
    consent.setConsent('granted');
    consent.startAnalyticsIfAllowed();
    expect(env.appended).toHaveLength(1);
    expect(env.appended[0].src).toMatch(/gtm-init\.js/);
    expect(env.appended[0].dataset.gaId).toBe('G-TEST');
  });

  test('declining never injects and withdrawing disables the loaded tag', () => {
    consent.setConsent('denied');
    consent.startAnalyticsIfAllowed();
    expect(env.appended).toHaveLength(0);
    consent.setConsent('granted');
    expect(env.appended).toHaveLength(1);
    consent.setConsent('denied');
    expect(window['ga-disable-G-TEST']).toBe(true);
    expect(consent.analyticsAllowed()).toBe(false);
  });
});

describe('scrubParams', () => {
  test('redacts anything shaped like an email, leaves the rest alone', () => {
    expect(consent.scrubParams({ reason: 'no account for pat@example.com', count: 3, restaurant: 'Kewpie' }))
      .toEqual({ reason: 'no account for [redacted]', count: 3, restaurant: 'Kewpie' });
  });
});

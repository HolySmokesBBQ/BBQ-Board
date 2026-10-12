// Board's analytics gate. Until 2.4.6 Board's track() checked only that
// window.gtag existed, and index.board.html loaded the Google tag on every
// launch, so Board sent usage analytics with no consent at all (audit L-1).
// Now track() runs only with consent on record, through the same consent.js
// gate Scorecard and Notebook use.

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { track } from './analytics.js';
import { CONSENT_KEY, CONSENT_TEXT_VERSION } from '../consent.js';

function store() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function consent(choice) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: 'x', textVersion: CONSENT_TEXT_VERSION }));
}

beforeEach(() => {
  globalThis.localStorage = store();
  globalThis.window = { gtag: vi.fn() };
});

describe('track', () => {
  test('sends nothing before the user has answered', () => {
    track('board_meat_filter', { meat: 'brisket' });
    expect(window.gtag).not.toHaveBeenCalled();
  });

  test('sends nothing after the user says no', () => {
    consent('denied');
    track('board_meat_filter', { meat: 'brisket' });
    expect(window.gtag).not.toHaveBeenCalled();
  });

  test('sends with consent, tagged with the board content group', () => {
    consent('granted');
    track('board_meat_filter', { meat: 'brisket' });
    expect(window.gtag).toHaveBeenCalledWith('event', 'board_meat_filter', { content_group: 'board', meat: 'brisket' });
  });

  test('a consent record from an older wording does not count', () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: 'granted', at: 'x', textVersion: CONSENT_TEXT_VERSION - 1 }));
    track('board_meat_filter');
    expect(window.gtag).not.toHaveBeenCalled();
  });

  test('scrubs email addresses out of string params', () => {
    consent('granted');
    track('board_signin_failed', { error: 'no account for joe@example.com' });
    expect(window.gtag.mock.calls[0][2].error).toBe('no account for [redacted]');
  });

  test('is a quiet no-op when the tag has not loaded', () => {
    consent('granted');
    window.gtag = undefined;
    expect(() => track('board_meat_filter')).not.toThrow();
  });
});

// Per-app consent (shared consent.js, Oct 2026): Board reads its own key
// hs-analytics-consent:board first and falls back to the legacy shared key,
// at CONSENT_VERSIONS.board = 1. Board 2.4.6 wrote grants to the legacy key
// at version 1, so those must keep counting without a re-prompt.
describe('Board consent under per-app keys', () => {
  beforeEach(() => { window.GA_CONTENT_GROUP = 'board'; });

  test('a 2.4.6 grant on the legacy key still counts', () => {
    localStorage.setItem('hs-analytics-consent', JSON.stringify({ choice: 'granted', at: 'x', textVersion: 1 }));
    track('board_meat_filter', { meat: 'brisket' });
    expect(window.gtag).toHaveBeenCalledTimes(1);
  });

  test("Board's own key wins over the legacy key", () => {
    localStorage.setItem('hs-analytics-consent', JSON.stringify({ choice: 'granted', at: 'x', textVersion: 1 }));
    localStorage.setItem('hs-analytics-consent:board', JSON.stringify({ choice: 'denied', at: 'y', textVersion: 1 }));
    track('board_meat_filter');
    expect(window.gtag).not.toHaveBeenCalled();
  });

  test('Board stays at consent version 1', async () => {
    const { CONSENT_VERSIONS } = await import('../consent.js');
    expect(CONSENT_VERSIONS.board).toBe(1);
  });
});

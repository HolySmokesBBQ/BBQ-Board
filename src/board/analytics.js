// Board's one analytics sender. Every Board event goes through here so the
// consent gate can't be skipped (consentInventory.test.js fails on any
// other direct gtag call).
//
// Two halves have to hold for nothing to reach Google without consent, and
// each alone is not enough: index.board.html no longer loads the Google tag
// (consent.js injects it once the user allows, from main.board.jsx), and
// track() refuses to send without consent on record. Notebook shipped the
// first half without the injection and sent nothing at all for a week.

import { analyticsAllowed, scrubParams } from '../consent.js';

export function track(event, params = {}) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', event, scrubParams({ content_group: 'board', ...params }));
  } catch {}
}

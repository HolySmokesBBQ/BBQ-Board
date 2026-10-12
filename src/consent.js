// Analytics consent: the single gate every analytics collector goes through.
//
// Nothing is collected until the user says yes. Until then the Google tag
// (gtm-init.js) is never loaded, so no request reaches Google at all, and
// track()/trackPageView()/setGaContext() in scoring.js are no-ops. The
// native Firebase Analytics SDK is switched off at the platform level
// (AndroidManifest meta-data / Info.plist) because it starts collecting
// before any of this JavaScript runs.
//
// Crash reporting (Crashlytics) is not gated here: it runs under
// legitimate interest and is disclosed in the privacy policy.
//
// Written app-agnostic so Notebook and Board can adopt it unchanged.
// Audit 2026-09-29, finding L-1.

// Each app keeps its own record under `hs-analytics-consent:<app>`, where
// <app> is the window.GA_CONTENT_GROUP the entry HTML sets. Before 4.4.0
// every app wrote one shared key; that is LEGACY_CONSENT_KEY below and is
// still read as a fallback, so nobody's existing answer is lost.
//
// Why per app: the web builds share one origin, so a single shared record
// would make Scorecard and Notebook overwrite each other's answer and
// re-prompt each other back and forth, and a wording change in one app
// would blank the other two (the old shared version could only move all
// three at once).
export const LEGACY_CONSENT_KEY = 'hs-analytics-consent';

// Kept as an alias so callers and tests that predate the split still name
// the legacy key. New code should use consentKeyFor().
export const CONSENT_KEY = LEGACY_CONSENT_KEY;

// The version every record under the legacy shared key carries. Frozen at 1:
// nothing writes the legacy key for a known app any more, so this never
// moves. An app's own version lives in CONSENT_VERSIONS.
export const CONSENT_TEXT_VERSION = 1;

// Bump an app's entry when ITS consent sentence changes what it says is
// collected or why. Records under an older version stop counting for that
// app only, so only that app's users are asked again, and until they
// answer, that app collects nothing, including from users who had said yes.
// Bump when the data changes, not the prose.
//
// Values are opaque tokens compared with strict equality. Never coerce or
// normalise them: a stored '1' is not 1.
//
//   scorecard 2  4.4.0 rewrote the sentence to name every parameter the
//                inventory test finds (src/consentInventory.scorecard.test.js).
//   notebook  1  unchanged; its 2026-10-12 rewrite only caught the text up
//                to what the app had always sent.
//   board     1  Board 2.4.6 stored its grants as 1 under the legacy key.
//                Any other value re-prompts every Board user.
export const CONSENT_VERSIONS = Object.freeze({ scorecard: 2, notebook: 1, board: 1 });

// The running app, or null when the page did not say (unit tests, an entry
// HTML without GA_CONTENT_GROUP). Null keeps the pre-split behaviour exactly:
// the legacy key at version 1.
function currentApp() {
  const app = typeof window !== 'undefined' ? window.GA_CONTENT_GROUP : undefined;
  return typeof app === 'string' && Object.hasOwn(CONSENT_VERSIONS, app) ? app : null;
}

export function consentKeyFor(app) {
  return app ? `${LEGACY_CONSENT_KEY}:${app}` : LEGACY_CONSENT_KEY;
}

export function consentVersionFor(app) {
  return app ? CONSENT_VERSIONS[app] : CONSENT_TEXT_VERSION;
}

const listeners = new Set();
let loaderInjected = false;

// { choice: 'granted' | 'denied', at: ISO string, textVersion } or null.
//
// The app's own key is authoritative whenever it holds anything at all, even
// a stale or unreadable record. Only an app that has never answered under its
// own key falls back to the legacy shared one. Otherwise a later "No" stored
// under the own key could go stale and resurrect an older legacy "Yes".
export function getConsent() {
  const app = currentApp();
  const version = consentVersionFor(app);
  try {
    let raw = localStorage.getItem(consentKeyFor(app));
    if (raw == null && app) raw = localStorage.getItem(LEGACY_CONSENT_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || (rec.choice !== 'granted' && rec.choice !== 'denied')) return null;
    if (rec.textVersion !== version) return null;
    return rec;
  } catch {
    return null;
  }
}

export function analyticsAllowed() {
  return getConsent()?.choice === 'granted';
}

export function setConsent(choice) {
  const app = currentApp();
  const rec = { choice, at: new Date().toISOString(), textVersion: consentVersionFor(app) };
  try { localStorage.setItem(consentKeyFor(app), JSON.stringify(rec)); } catch {}
  if (choice === 'granted') startAnalyticsIfAllowed();
  else stopAnalytics();
  listeners.forEach(fn => { try { fn(rec); } catch {} });
  return rec;
}

export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Inject the Google tag loader, once, and only with consent on record.
// Page config comes from the window.GA_* values the entry HTML sets.
export function startAnalyticsIfAllowed() {
  if (!analyticsAllowed() || loaderInjected) return;
  if (typeof document === 'undefined') return;
  const id = window.GA_MEASUREMENT_ID;
  if (id) window[`ga-disable-${id}`] = false;
  const s = document.createElement('script');
  s.src = '/gtm-init.js?v=7';
  s.defer = true;
  if (id) s.dataset.gaId = id;
  if (window.GA_PAGE_TITLE) s.dataset.gaTitle = window.GA_PAGE_TITLE;
  if (window.GA_CONTENT_GROUP) s.dataset.gaGroup = window.GA_CONTENT_GROUP;
  document.head.appendChild(s);
  loaderInjected = true;
}

// Withdrawal. If the tag already loaded this session, disable it and deny
// storage so it stops sending; on the next launch it is not loaded at all.
function stopAnalytics() {
  if (typeof window === 'undefined') return;
  const id = window.GA_MEASUREMENT_ID;
  if (id) window[`ga-disable-${id}`] = true;
  try { window.gtag?.('consent', 'update', { analytics_storage: 'denied' }); } catch {}
  try {
    document.cookie.split(';').map(c => c.trim().split('=')[0])
      .filter(n => /^_ga/.test(n))
      .forEach(n => { document.cookie = `${n}=; Max-Age=0; path=/`; });
  } catch {}
}

// Defence in depth: no event payload carries an email address, whatever
// consent says. Values are only rewritten when they contain one.
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
export function scrubParams(params) {
  if (!params) return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = typeof v === 'string' ? v.replace(EMAIL_RE, '[redacted]') : v;
  }
  return out;
}

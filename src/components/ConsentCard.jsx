import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { getConsent, setConsent, onConsentChange } from '../consent.js';

// Usage-analytics consent (audit 2026-09-29, L-1). An inline Home card,
// not a modal: it never blocks scoring, and nothing is collected while it
// sits unanswered. Allow and No thanks carry identical styling so neither
// is the "easy" button. The wording is versioned in consent.js
// (CONSENT_TEXT_VERSION); change it materially and bump the version.

// This card is shared by three apps, so the app name, the description of
// what gets collected, and the privacy link all have to follow the host.
// They were hardcoded to Scorecard until 2026-10-07, which meant a Notebook
// user was asked whether "BBQ Scorecard" could collect "the restaurant names
// on reviews you open" — an app they are not using, and data it does not
// hold. That is not a cosmetic slip: consent has to be informed, and a
// disclosure describing the wrong app's data does not describe this one's.
//
// window.GA_CONTENT_GROUP is already set per app by each index html before
// the bundle evaluates, so it is the signal to follow rather than new
// plumbing. Scorecard's wording below is unchanged from what it has been
// showing, deliberately — only the other two were wrong.
const APP = (typeof window !== 'undefined' && window.GA_CONTENT_GROUP) || 'scorecard';

const APP_COPY = {
  scorecard: {
    name: 'BBQ Scorecard',
    collects: 'plus the restaurant names on reviews you open, share, or compare',
    privacyUrl: 'https://holysmokesbbqco.com/privacy.html',
  },
  // Written from an inventory of every track() call reachable from the
  // Notebook entry, not from memory of what the app does. The failure mode
  // here is always omission, never a false statement, and it has caught this
  // sentence out twice: the first version named only cuts and cook types,
  // and the 2026-10-07 rewrite still left out the error messages, the
  // thermometer import and the humidity band. consentInventory.notebook.test.js
  // now walks the import graph and fails on any tracked parameter this
  // sentence does not account for, so a third round is a test failure rather
  // than something a user has to notice.
  //
  // GA4 receives none of: cook names, notes, photos, temperatures, dates,
  // friend identities, or the humidity reading itself (only a range). Error
  // strings are truncated and run through scrubParams, which replaces
  // anything email-shaped with [redacted].
  //
  // The error wording says "a code" rather than "the error messages" because
  // every reason Notebook can send is now a bounded code from
  // analyticsCodes.js. That took three commits to become true: 9334db6 did
  // the sign-in box, photo_upload_failed and story_card_failed, f140413 did
  // profile_load_failed, and the thermometer import in NotebookImport.jsx was
  // the last raw sender. The order matters and is the auditor's rule -- bound
  // the path first, narrow the copy second. Never narrow ahead of the code:
  // over-disclosing costs the user nothing, under-disclosing is the whole
  // failure mode this sentence keeps falling into.
  //
  // Scorecard's review events (restaurant names, star ratings) sit in the
  // shared AppContext and so are reachable by import from here, but no
  // Notebook screen calls them — which is why this sentence does not mention
  // restaurants. The test asserts that stays true.
  notebook: {
    name: 'BBQ Notebook',
    collects:
      'plus the meat type on cooks you share, export or delete, how many ' +
      'cooks, recipes and friends you have when it syncs, a range for any ' +
      'pit humidity you work out and whether that used your location, the ' +
      'thermometer brand you import from and how much a file brought in, ' +
      'and a code for any error it runs into',
    privacyUrl: 'https://holysmokesbbqco.com/notebook/privacy-notebook.html',
  },
  // No board entry on purpose. BBQ Board cannot render this card at all —
  // it reads its palette from Scorecard's AppContext, which would drag
  // Scorecard's Firebase setup into Board — so Board keeps its own card and
  // its own wording in src/board/ConsentPrompt.jsx and src/board/consentCopy.js.
  // An entry here was dead code that had already drifted behind Board's real
  // sentence, which is worse than no entry: the next person to read it would
  // have taken it for the text Board ships.
};

const COPY = APP_COPY[APP] || APP_COPY.scorecard;

export const APP_NAME = COPY.name;
const PRIVACY_URL = COPY.privacyUrl;

export const CONSENT_PURPOSE =
  `That covers which screens and features you use, ${COPY.collects}. ` +
  "It isn't linked to your account, name, or email.";

export function useConsent() {
  const [rec, setRec] = useState(() => getConsent());
  useEffect(() => onConsentChange(setRec), []);
  return rec;
}

export function openPrivacyPolicy() {
  window.open(PRIVACY_URL, '_blank', 'noopener,noreferrer');
}

export default function ConsentCard() {
  const { S } = useAppContext();
  const rec = useConsent();
  if (rec) return null;

  const choiceBtn = {
    flex: 1, padding: '10px 0', background: S.dark, color: S.text,
    border: `1px solid ${S.accent}`, borderRadius: '6px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div role="region" aria-label="Usage analytics choice" style={{
      background: S.card, border: `1px solid ${S.border}`, borderLeft: `4px solid ${S.accent}`,
      borderRadius: '8px', padding: '12px 14px', marginBottom: '12px',
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: S.accent, marginBottom: '4px' }}>
        USAGE ANALYTICS
      </div>
      <div style={{ fontSize: '12px', color: S.text, lineHeight: 1.5, marginBottom: '6px' }}>
        Can {APP_NAME} send usage analytics to Google Analytics? {CONSENT_PURPOSE}
      </div>
      <div style={{ fontSize: '12px', color: S.muted, lineHeight: 1.5, marginBottom: '10px' }}>
        It helps decide what to build next. Nothing is sent unless you allow it, and you can change this in Settings any time.{' '}
        <button onClick={openPrivacyPolicy} style={{ background: 'none', border: 'none', padding: 0, color: S.accent, fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}>
          Privacy policy
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setConsent('denied')} style={choiceBtn}>No thanks</button>
        <button onClick={() => setConsent('granted')} style={choiceBtn}>Allow</button>
      </div>
    </div>
  );
}

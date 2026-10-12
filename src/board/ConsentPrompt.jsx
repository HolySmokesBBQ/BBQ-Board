import React, { useEffect, useState } from 'react';
import { getConsent, setConsent, onConsentChange } from '../consent.js';
import { BOARD_CONSENT } from './consentCopy.js';

// Usage-analytics consent (audit L-1), Board's version of the shared
// ConsentCard: an inline card on the home screen, never a modal, so it
// doesn't stand between anyone and the prices. Nothing is collected while
// it sits unanswered. Allow and No thanks look identical so neither is the
// easy button. It disappears once answered; Settings can change the answer.

const PAL = {
  panel: '#232830', panelDeep: '#1c2027', border: '#3a4048',
  brass: '#d4a64a', text: '#f5e6d3', textDim: '#9aa3ad',
};

export function useConsent() {
  const [rec, setRec] = useState(() => getConsent());
  useEffect(() => onConsentChange(setRec), []);
  return rec;
}

export function openBoardPrivacyPolicy() {
  window.open(BOARD_CONSENT.privacyUrl, '_blank', 'noopener,noreferrer');
}

export default function ConsentPrompt() {
  const rec = useConsent();
  if (rec) return null;

  const choiceBtn = {
    flex: 1, padding: '10px 0', background: PAL.panelDeep, color: PAL.text,
    border: `1px solid ${PAL.brass}`, borderRadius: 6,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div role="region" aria-label="Usage analytics choice" style={{
      background: PAL.panel, border: `1px solid ${PAL.border}`, borderLeft: `4px solid ${PAL.brass}`,
      borderRadius: 8, padding: '12px 14px', marginBottom: 16,
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1, color: PAL.brass, marginBottom: 4 }}>
        USAGE ANALYTICS
      </div>
      <div style={{ fontSize: 13, color: PAL.text, lineHeight: 1.5, marginBottom: 6 }}>
        Can {BOARD_CONSENT.name} send usage analytics to Google Analytics? {BOARD_CONSENT.purpose}
      </div>
      <div style={{ fontSize: 13, color: PAL.textDim, lineHeight: 1.5, marginBottom: 10 }}>
        It helps decide what to build next. Nothing is sent unless you allow it, and you can change this in Settings any time.{' '}
        <button onClick={openBoardPrivacyPolicy} style={{ background: 'none', border: 'none', padding: 0, color: PAL.brass, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>
          Privacy policy
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setConsent('denied')} style={choiceBtn}>No thanks</button>
        <button onClick={() => setConsent('granted')} style={choiceBtn}>Allow</button>
      </div>
    </div>
  );
}

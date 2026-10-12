import { CATEGORIES, DESCRIPTORS } from './constants.js';
import { analyticsAllowed, scrubParams, onConsentChange } from './consent.js';

/* ── Scoring ── */
export function calcScores(scores) {
  const bbqKeys = CATEGORIES.bbq.map(c => c.key);
  const famKeys = CATEGORIES.family.map(c => c.key);
  const bbqVals = bbqKeys.map(k => scores[k]).filter(v => v > 0);
  const famVals = famKeys.map(k => scores[k]).filter(v => v > 0);
  const bbqAvg = bbqVals.length ? bbqVals.reduce((a,b) => a+b, 0) / bbqVals.length : 0;
  const famAvg = famVals.length ? famVals.reduce((a,b) => a+b, 0) / famVals.length : 0;
  let bonus = 0;
  if (famAvg >= 8) bonus = 1.25;
  else if (famAvg >= 7) bonus = 1.00;
  else if (famAvg >= 6) bonus = 0.75;
  else if (famAvg >= 5) bonus = 0.50;
  else if (famAvg >= 4) bonus = 0.25;
  const composite = bbqAvg + bonus;
  let stars = 1;
  if (composite >= 5.75) stars = 5;
  else if (composite >= 4.75) stars = 4;
  else if (composite >= 3.75) stars = 3;
  else if (composite >= 2.75) stars = 2;
  return { bbqAvg, famAvg, bonus, composite, stars };
}

// Cryptographically-secure random ID for documents stored under
// `{userId}_{id}` paths. Prefer randomUUID (32 hex chars) when available;
// otherwise fall back to getRandomValues. Math.random is NOT acceptable
// — its xorshift128+ output is observable and predictable from the page.
export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
  // Should never hit this in any modern browser — keep insecure fallback
  // out of the path entirely.
  throw new Error('Web Crypto API unavailable — cannot generate secure ID');
}

export function emptyReview() {
  return {
    id: genId(), restaurant: '', date: new Date().toISOString().split('T')[0],
    location: '', meats: [], meatOther: '', sides: [], sideOther: '', dessert: '',
    drinks: '', orderStyle: '',
    scores: {}, sauceDep: '', wouldReturn: '', notes: '', notesLog: [],
    price: '', priceSplit: '1', trip: '', googleReviewUrl: '', photo: null,
    photos: [], friends: [], lastEdited: null,
    // Google review draft (4.4.0). Each of these must be in firestore.rules
    // reviewFields() before a build that sends them ships.
    party: '', partySize: '', serviceNote: '', atmosphereNote: '',
    googleExtras: {}, googleRatings: {},
  };
}

/* ── Migrate old reviews (photo -> photos) ── */
export function migrateReview(r) {
  const migrated = { ...r };
  if (!migrated.photos) migrated.photos = [];
  if (!migrated.friends) migrated.friends = [];
  if (migrated.photo && migrated.photos.length === 0) {
    migrated.photos = [migrated.photo];
  }
  return migrated;
}

/* ── Photo compression ── */
export function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════════════════
   Analytics — GA4 (per-app measurement ID)
   ══════════════════════════════════════════
   Wraps gtag with:
   - Auto context enrichment (every event gets the current `view`)
   - User properties for segmentation (app_mode, signed_in, review_count, etc.)
   - (No GA4 User-ID: dropped 2026-09-29, see _flushUserProperties)
   - Page view firing for SPA navigations
*/

const _gaContext = {
  // Auto-attached to every event:
  _view: 'site',
  // User properties (sent via gtag('set', 'user_properties', ...)):
  user_id: null,
  signed_in: false,
  app_mode: 'restaurants',
  review_count: 0,
  friend_count: 0,
  cook_count: 0,
  recipe_count: 0,
  theme: 'system',
};

// Every sender below checks consent.js first. Without consent the Google
// tag is never loaded either, so these are no-ops twice over.
function _flushUserProperties() {
  if (!analyticsAllowed() || typeof window.gtag !== 'function') return;
  // user_id is deliberately NOT sent. GA4 User-ID would link analytics to
  // the Firebase uid; at this traffic nobody uses cross-device reports, so
  // the identifier isn't worth collecting (audit 2026-09-29 minimisation).
  // It stays in _gaContext only so callers don't need to change.
  const { user_id, _view, ...userProps } = _gaContext;
  try {
    window.gtag('set', 'user_properties', userProps);
  } catch {}
}

// A mid-session "Allow" loads the tag asynchronously; once it's up, send
// the user properties gathered so far so the session isn't unlabeled.
onConsentChange((rec) => {
  if (rec.choice !== 'granted' || typeof window === 'undefined') return;
  let tries = 0;
  const wait = setInterval(() => {
    if (typeof window.gtag === 'function' || ++tries > 50) {
      clearInterval(wait);
      _flushUserProperties();
    }
  }, 200);
});

/* Update GA context. Call from AppContext effects whenever signed-in state,
   app mode, or counts change. Safe to call before gtag has loaded — the
   context is buffered and flushed on the first event. */
export function setGaContext(updates) {
  Object.assign(_gaContext, updates);
  _flushUserProperties();
}

/* Fire a custom event with auto-injected `view` context. */
export function track(event, params) {
  if (!analyticsAllowed() || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', event, { view: _gaContext._view, ...scrubParams(params) });
  } catch {}
}

/* Fire a page_view event for an SPA navigation. Updates _view in context
   so subsequent events know where the user is. */
export function trackPageView(viewName) {
  _gaContext._view = viewName;
  if (!analyticsAllowed() || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', 'page_view', {
      page_title: viewName,
      page_path: typeof location !== 'undefined' ? location.pathname + '#' + viewName : viewName,
      view: viewName,
    });
  } catch {}
}

/* ── Share Card Generator (Canvas API) ── */
// Optional `opts` — { rankInfo: { rank: N, total: M } } paints a small
// "#N of M" badge under the composite score. Lets the share card brag
// naturally: "brisket was so good it went straight to #2 of 47." No
// badge if opts.rankInfo is missing, so old callers keep working.
export function generateShareCard(r, opts = {}) {
  return new Promise((resolve) => {
    const sc = calcScores(r.scores);
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Accent bar at top
    ctx.fillStyle = '#d4782f';
    ctx.fillRect(0, 0, W, 8);

    const drawContent = () => {
      let y = 80;

      // Logo/brand
      ctx.fillStyle = '#d4782f';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOLY SMOKES BBQ', W / 2, y);
      y += 24;
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.fillText('HOLY SMOKES BBQ CO', W / 2, y);
      y += 60;

      // Restaurant name
      ctx.fillStyle = '#f5e6d3';
      ctx.font = 'bold 52px sans-serif';
      const name = r.restaurant.toUpperCase();
      const words = name.split(' ');
      let line = '';
      const lines = [];
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > W - 120) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      for (const l of lines) {
        ctx.fillText(l, W / 2, y);
        y += 62;
      }
      y += 10;

      // Location & date
      ctx.fillStyle = '#888';
      ctx.font = '24px sans-serif';
      const locDate = [r.location, r.date].filter(Boolean).join('  |  ');
      ctx.fillText(locDate, W / 2, y);
      y += 60;

      // Stars
      ctx.font = '64px sans-serif';
      ctx.fillStyle = '#fbbf24';
      const starStr = '★'.repeat(sc.stars) + '☆'.repeat(5 - sc.stars);
      ctx.fillText(starStr, W / 2, y);
      y += 50;

      // Composite score
      ctx.fillStyle = '#d4782f';
      ctx.font = 'bold 80px sans-serif';
      ctx.fillText(sc.composite.toFixed(2), W / 2, y);
      y += 30;
      ctx.fillStyle = '#888';
      ctx.font = '20px sans-serif';
      ctx.fillText(`BBQ ${sc.bbqAvg.toFixed(2)}  +  Family Bonus ${sc.bonus.toFixed(2)}`, W / 2, y);
      y += 30;

      // Rank badge — only when caller passed rankInfo.
      if (opts.rankInfo && opts.rankInfo.rank && opts.rankInfo.total) {
        ctx.fillStyle = '#4A6741';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`RANK #${opts.rankInfo.rank} OF ${opts.rankInfo.total}`, W / 2, y);
        y += 30;
      }
      y += 30;

      // Divider
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, y);
      ctx.lineTo(W - 100, y);
      ctx.stroke();
      y += 40;

      // Category scores
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#d4782f';
      ctx.fillText('BBQ TRACK', 100, y);
      ctx.textAlign = 'right';
      ctx.fillText('FAMILY TRACK', W - 100, y);
      y += 35;

      const bbqCats = CATEGORIES.bbq;
      const famCats = CATEGORIES.family;
      const maxRows = Math.max(bbqCats.length, famCats.length);

      ctx.font = '22px sans-serif';
      for (let i = 0; i < maxRows; i++) {
        if (i < bbqCats.length) {
          const c = bbqCats[i];
          const v = r.scores[c.key] || 0;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ccc';
          ctx.fillText(c.label.split(' /')[0], 100, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = v >= 7 ? '#4ade80' : v >= 5 ? '#f5e6d3' : v > 0 ? '#f87171' : '#555';
          ctx.fillText(v > 0 ? `${v}/9` : '-', W / 2 - 40, y);
        }
        if (i < famCats.length) {
          const c = famCats[i];
          const v = r.scores[c.key] || 0;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ccc';
          ctx.fillText(c.label, W / 2 + 40, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = v >= 7 ? '#4ade80' : v >= 5 ? '#f5e6d3' : v > 0 ? '#f87171' : '#555';
          ctx.fillText(v > 0 ? `${v}/9` : '-', W - 100, y);
        }
        y += 34;
      }
      y += 20;

      // Would return
      if (r.wouldReturn) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.font = '22px sans-serif';
        ctx.fillText(`Would return: ${r.wouldReturn}`, W / 2, y);
        y += 40;
      }

      // Footer — light nudge toward the Play Store rather than a bare
      // URL. People who see the card and want the same tool now know
      // what to search for.
      ctx.textAlign = 'center';
      ctx.fillStyle = '#666';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('BBQ SCORECARD  |  ANDROID', W / 2, H - 55);
      ctx.fillStyle = '#444';
      ctx.font = '14px sans-serif';
      ctx.fillText('holysmokesbbqco.com', W / 2, H - 32);

      // Bottom accent bar
      ctx.fillStyle = '#d4782f';
      ctx.fillRect(0, H - 8, W, 8);

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };

    // If there's a photo, draw it at the top
    const photos = r.photos?.length ? r.photos : (r.photo ? [r.photo] : []);
    if (photos.length > 0) {
      const img = new Image();
      img.onload = () => {
        const imgH = 400;
        ctx.drawImage(img, 0, 0, W, imgH);
        const grad = ctx.createLinearGradient(0, imgH - 150, 0, imgH);
        grad.addColorStop(0, 'rgba(26,26,26,0)');
        grad.addColorStop(1, 'rgba(26,26,26,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, imgH - 150, W, 150);
        drawContent();
      };
      img.onerror = drawContent;
      img.src = photos[0];
    } else {
      drawContent();
    }
  });
}

/* ── Google Review Draft Generator ── */
// Google review draft. Rewritten 2026-07-18: the previous version was
// bullet-y and ignored the notesLog entirely, which left drafts skeletal
// even when the reviewer had written a full observation stream. Now
// notes ARE the body of the draft — timestamps stripped, joined as
// prose paragraphs. Score data gets woven in as context (highlight /
// weak link / sauce dependency), not as a trailing ratings row. Voice
// follows Joel's guide: no em dashes, no rule-of-three, no signposts.



/* ── CSV Export ── */
export function exportCSV(reviews) {
  const headers = [
    'Restaurant','Date','Location','Trip','Price','Split','Price Per Person',
    'Appearance','Taste','Tenderness','Smoke','Sides','Sauce','Portions',
    'Service','Cleanliness','Amenities',
    'BBQ Avg','Family Avg','Bonus','Composite','Stars',
    'Sauce Dependency','Would Return','Meats Ordered','Sides Ordered','Dessert','Notes',
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = reviews.map(r => {
    const sc = calcScores(r.scores);
    const pp = r.price && r.priceSplit > 0 ? (Number(r.price) / Number(r.priceSplit)).toFixed(2) : '';
    return [
      r.restaurant, r.date, r.location || '', r.trip || '', r.price || '', r.priceSplit || '1', pp,
      r.scores.appearance || '', r.scores.taste || '', r.scores.tenderness || '',
      r.scores.smoke || '', r.scores.sides || '', r.scores.sauce || '', r.scores.portions || '',
      r.scores.service || '', r.scores.cleanliness || '', r.scores.amenities || '',
      sc.bbqAvg.toFixed(2), sc.famAvg.toFixed(2), sc.bonus.toFixed(2), sc.composite.toFixed(2), sc.stars,
      r.sauceDep || '', r.wouldReturn || '',
      (r.meats || []).join('; '), (r.sides || []).join('; '),
      r.dessert || '', (r.notesLog || []).join(' | ') || r.notes || '',
    ].map(esc).join(',');
  });
  const csv = [headers.map(esc).join(','), ...rows].join('\n');
  track('csv_exported', { review_count: reviews.length });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bbq-reviews-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

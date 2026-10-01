import { CATEGORIES } from './constants.js';

// Google review draft (spec: BBQ Scorecard Google Review Draft Spec,
// 2026-10-01; gold standard J's BBQ, Ripon).
//
// Rules the code holds to:
// - Facts come only from the scorecard and its notes. A score never turns
//   into a description; scores only pick the TL;DR's best part and
//   shortfall, and the Google sub-ratings.
// - A section with no notes is left out.
// - Order: TL;DR, arrival, plate, each meat, sauces, sides, anything
//   else, service and room, the return line, then the Google ratings line.
// - "I" for a solo visit, "we" for anyone else.
// - Joel's wording is kept. Each note is split into sentences, tidied
//   (capital first letter, closing period) and filed under a topic; a
//   sentence with no topic word stays with the sentence before it.

// ── Mapping tables (spec section 4) ──────────────────────────────

export function returnLine(wouldReturn, P) {
  const we = P === 'we';
  switch ((wouldReturn || '').toLowerCase()) {
    case 'absolutely': case 'yes': return we ? "We'll be back." : "I'll be back.";
    case 'probably': return we ? "We'd go back." : "I'd go back.";
    case 'maybe': return we ? 'Would we go back? Maybe.' : 'Would I go back? Maybe.';
    case 'probably not': return we ? "We probably won't be back." : "I probably won't be back.";
    case 'no': return we ? "We won't be back." : "I won't be back.";
    default: return '';
  }
}

export function sauceLine(sauceDep, P, meat) {
  const s = (sauceDep || '').toLowerCase();
  if (!s) return '';
  if (s.startsWith('helped')) return "For me the sauce helped but wasn't necessary.";
  if (s.startsWith('no')) return "The meat didn't need sauce.";
  if (s.startsWith('yes') || s.includes('needed')) {
    return `${P === 'we' ? 'We' : 'I'} needed sauce to get through the ${meat || 'meat'}.`;
  }
  return '';
}

const avg = (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);

function foodStars(bbqAvg) {
  if (bbqAvg >= 7.5) return 5;
  if (bbqAvg >= 6.0) return 4;
  if (bbqAvg >= 4.5) return 3;
  if (bbqAvg >= 3.5) return 2;
  return 1;
}
function nineToFive(v) {
  if (v >= 9) return 5;
  if (v >= 7) return 4;
  if (v === 6) return 3;
  if (v === 5) return 2;
  return 1;
}

// Starting points only; a saved override always wins. A rating with no
// score behind it defaults to 3 and is flagged so the UI can say so.
export function defaultGoogleRatings(r) {
  const s = r.scores || {};
  const bbq = CATEGORIES.bbq.map(c => s[c.key]).filter(v => v > 0);
  const flagged = [];
  let food = 3, service = 3, atmosphere = 3;
  if (bbq.length) food = foodStars(avg(bbq)); else flagged.push('food');
  if (s.service > 0) service = nineToFive(s.service); else flagged.push('service');
  if (s.atmosphere > 0) atmosphere = nineToFive(s.atmosphere); else flagged.push('atmosphere');
  return { food, service, atmosphere, flagged };
}

export function googleRatings(r) {
  const d = defaultGoogleRatings(r);
  const o = r.googleRatings || {};
  const set = (k) => o[k] >= 1 && o[k] <= 5;
  return {
    food: set('food') ? o.food : d.food,
    service: set('service') ? o.service : d.service,
    atmosphere: set('atmosphere') ? o.atmosphere : d.atmosphere,
    flagged: d.flagged.filter(k => !set(k)),
  };
}

// ── Note handling ────────────────────────────────────────────────

const stripDate = (n) => (n || '').replace(/^\d{4}-\d{2}-\d{2}:\s*/, '').trim();

function tidy(s) {
  let t = s.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

function sentences(note) {
  return stripDate(note)
    .split(/\n+|(?<=[.!?])\s+/)
    .map(tidy)
    .filter(Boolean);
}

const ARRIVAL = /\b(stopped|stopping|stop by|arrived|got there|walked in|showed up|pulled in|opened|opening)\b/i;
const PLATE = /\b(portions?|plate|platter|basket|tray|came out|served (on|in)|serving size)\b/i;
const SAUCE = /\bsauces?\b/i;
const SERVICE = /\b(service|staff|server|waitress|waiter|cashier|counter|owner|friendly|rude|attentive|room|decor|music|seating|atmosphere|vibe|patio|bathroom|restroom|clean|dirty|line|wait)\b/i;
const GENERIC_MEATS = ['brisket', 'turkey', 'ribs', 'rib', 'pulled pork', 'pork', 'sausage', 'links', 'chicken', 'burnt ends', 'wings', 'beef', 'pastrami', 'tri-tip', 'tri tip', 'belly'];
const GENERIC_SIDES = ['beans', 'slaw', 'coleslaw', 'mac', 'cornbread', 'potato', 'fries', 'greens', 'corn', 'salad', 'okra', 'rice', 'pickles'];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Words that identify one listed item: the full name plus its notable
// words ("Smoked Turkey" -> "smoked turkey", "turkey").
function tokensFor(name) {
  const n = name.toLowerCase().replace(/&/g, 'and');
  const words = n.split(/\s+/).filter(w => w.length > 2 && !['and', 'the', 'with', 'smoked'].includes(w));
  return [n, ...words];
}
function mentions(text, tokens) {
  const t = text.replace(/&/g, 'and');
  return tokens.some(tok => new RegExp(`\\b${escapeRe(tok)}\\b`, 'i').test(t));
}

function classify(sentence, meats, sides) {
  if (ARRIVAL.test(sentence)) return { topic: 'arrival' };
  const meatIdx = meats.findIndex(m => mentions(sentence, tokensFor(m)));
  if (meatIdx >= 0) return { topic: 'meat', idx: meatIdx };
  if (sides.some(s => mentions(sentence, tokensFor(s))) || mentions(sentence, GENERIC_SIDES)) return { topic: 'sides' };
  if (mentions(sentence, GENERIC_MEATS)) return { topic: 'meat', idx: meats.length };
  if (SAUCE.test(sentence)) return { topic: 'sauce' };
  if (PLATE.test(sentence)) return { topic: 'plate' };
  if (SERVICE.test(sentence)) return { topic: 'service' };
  return null;
}

// ── Builders ─────────────────────────────────────────────────────

const lc = (s) => (s || '').toLowerCase();
function joinAnd(items) {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a.join('');
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`;
}

const TLDR_NOUN = {
  appearance: ['the look of the plate', false], taste: ['the flavor', false], tenderness: ['the texture', false],
  smoke: ['the smoke', false], sides: ['the sides', true], sauce: ['the sauce', false], portions: ['the portions', true],
};
function tldr(r, P) {
  const s = r.scores || {};
  const scored = CATEGORIES.bbq.filter(c => s[c.key] > 0).map(c => ({ k: c.key, v: s[c.key] }));
  const me = P === 'we' ? 'us' : 'me';
  if (scored.length < 2) return '';
  const best = scored.reduce((a, b) => (b.v > a.v ? b : a));
  const worst = scored.reduce((a, b) => (b.v < a.v ? b : a));
  if (best.v - worst.v < 2) return `TL;DR: Even across the board for ${me}, with no one thing standing out.`;
  const [bn, bp] = TLDR_NOUN[best.k];
  const [wn, wp] = TLDR_NOUN[worst.k];
  return `TL;DR: ${bn.charAt(0).toUpperCase() + bn.slice(1)} ${bp ? 'were' : 'was'} the best part for ${me}, and ${wn} ${wp ? 'were' : 'was'} where it fell short.`;
}

// "Stopped on a Thursday..." -> "Stopped at J's BBQ in Ripon on a Thursday..."
function placeArrival(sentence, place) {
  if (!place) return sentence;
  return sentence.replace(/^(Stopped|Stopping|Pulled in|Showed up|Walked in|Arrived)(\s+)(?!at\b|in\b|by\b)/, `$1 at ${place}$2`);
}

export function buildGoogleDraft(r) {
  const solo = !r.party || r.party === 'Solo';
  const P = solo ? 'I' : 'we';
  const meats = [...(r.meats || []), r.meatOther].filter(Boolean);
  const sides = [...(r.sides || []), r.sideOther].filter(Boolean);
  const city = (r.location || '').split(',')[0].trim();
  const place = [r.restaurant, city && `in ${city}`].filter(Boolean).join(' ');

  // File every note sentence under a topic.
  const buckets = { arrival: [], plate: [], meat: meats.map(() => []), otherMeat: [], sauce: [], sides: [], other: [], service: [] };
  const notes = r.notesLog?.length ? r.notesLog : [r.notes].filter(Boolean);
  for (const note of notes) {
    let last = null;
    for (const s of sentences(note)) {
      const c = classify(s, meats, sides) || last || { topic: 'other' };
      last = c;
      if (c.topic === 'meat') (c.idx < meats.length ? buckets.meat[c.idx] : buckets.otherMeat).push(s);
      else buckets[c.topic].push(s);
    }
  }
  for (const extra of [r.serviceNote, r.atmosphereNote]) {
    if (extra && extra.trim()) buckets.service.push(...sentences(extra));
  }

  const out = [tldr(r, P)];

  // Arrival: when and where, what was ordered, the price.
  const arrival = buckets.arrival.length
    ? [placeArrival(buckets.arrival[0], place), ...buckets.arrival.slice(1)]
    : (place ? [`Stopped at ${place}.`] : []);
  const Pcap = solo ? 'I' : 'We';
  const meatList = joinAnd(meats.map(lc));
  let order = '';
  if (r.orderStyle) order = `${Pcap} ordered the ${lc(r.orderStyle)}${meatList ? ` with ${meatList}` : ''}`;
  else if (meatList) order = `${Pcap} ordered ${meatList}`;
  if (order && sides.length) order += `, with ${joinAnd(sides.map(lc))} on the side`;
  if (order) arrival.push(order + '.');
  const price = Number(r.price);
  if (r.price && !Number.isNaN(price) && price > 0) arrival.push(`$${price.toFixed(2)}.`);
  if (arrival.length) out.push(arrival.join(' '));

  if (buckets.plate.length) out.push(buckets.plate.join(' '));
  for (const m of buckets.meat) if (m.length) out.push(m.join(' '));
  if (buckets.otherMeat.length) out.push(buckets.otherMeat.join(' '));

  const sauce = [...buckets.sauce];
  const dep = sauceLine(r.sauceDep, P, lc(meats[0]));
  if (dep) sauce.push(dep);
  if (sauce.length) out.push(sauce.join(' '));

  if (buckets.sides.length) out.push(buckets.sides.join(' '));
  if (buckets.other.length) out.push(buckets.other.join(' '));
  if (buckets.service.length) out.push(buckets.service.join(' '));

  const ret = returnLine(r.wouldReturn, P);
  if (ret) out.push(ret);

  const g = googleRatings(r);
  out.push(`Food: ${g.food} | Service: ${g.service} | Atmosphere: ${g.atmosphere}`);

  return { text: out.filter(Boolean).join('\n\n'), ratings: g };
}

// ── Google's extra fields (shown under the draft) ────────────────

export const PARTY_OPTIONS = ['Solo', 'Couple', 'Family', 'Group'];

export const GOOGLE_EXTRAS = [
  { key: 'orderType', label: 'Order type', options: ['Dine in', 'Takeout', 'Delivery'] },
  { key: 'mealType', label: 'Meal type', options: ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Other'] },
  { key: 'noiseLevel', label: 'Noise level', options: ['Quiet', 'Moderate', 'Loud'] },
  { key: 'parking', label: 'Parking', options: ['Free lot', 'Free street', 'Paid', 'Limited'] },
  { key: 'kidFriendly', label: 'Kid-friendly', options: ['Yes', 'No', 'Not sure'] },
  { key: 'wheelchair', label: 'Wheelchair access', options: ['Yes', 'No', 'Not sure'] },
  { key: 'waitTime', label: 'Wait time', options: ['No wait', 'Up to 10 min', '10-30 min', '30-60 min', '60+ min'] },
];

// Google's group-size field should match the Party field.
export function groupSize(r) {
  if (r.party === 'Solo') return 1;
  if (r.party === 'Couple') return 2;
  const n = Number(r.partySize);
  return n > 0 ? n : null;
}

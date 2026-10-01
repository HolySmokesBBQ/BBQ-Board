import { describe, test, expect } from 'vitest';
import { buildGoogleDraft, defaultGoogleRatings, returnLine, sauceLine } from './googleDraft.js';

// J's BBQ, Ripon, 2026-10-01: the gold example from the review-draft spec.
const jsBBQ = {
  restaurant: "J's BBQ", location: 'Ripon, WI', date: '2026-10-01',
  party: 'Solo', orderStyle: '2 Meat Plate',
  meats: ['Brisket', 'Smoked Turkey'], meatOther: '',
  sides: ['Potato Salad', 'Mac & Cheese'], sideOther: '',
  price: '24.12', priceSplit: '1',
  scores: { appearance: 4, taste: 4, tenderness: 7, smoke: 2, sides: 4, sauce: 6, portions: 7, service: 7, cleanliness: 7, amenities: 7 },
  sauceDep: 'Helped but not necessary', wouldReturn: 'Maybe',
  notesLog: [
    '2026-10-01: 4 Sauces to choose from. Sweet is the house sauce. The heat has some mild kick. Not a huge fan of the white sauce. The cranberry sauce was different but not negative.',
    '2026-10-01: The brisket was a combo of the lean and fat cuts. Cut much thicker than BBQ Standard. Brisket lacked smoke flavor. Turkey cuts also thick faint smoke flavor',
    '2026-10-01: Potato salad is bland and lacked flavor but got the texture. Mac and cheese was good but nothing signature there',
    '2026-10-01: Stopped on a Thursday morning about 15 minutes after they opened',
    '2026-10-01: Pretty generous portions for being as early on in the morning. Be curious to see if that holds through a weekend rush',
  ],
};

const paras = (r) => buildGoogleDraft(r).text.split('\n\n');

describe('structure (spec section 3)', () => {
  test('TL;DR first, ratings line last', () => {
    const p = paras(jsBBQ);
    expect(p[0]).toMatch(/^TL;DR: /);
    expect(p[p.length - 1]).toBe('Food: 3 | Service: 4 | Atmosphere: 3');
  });

  test('sections run in order: arrival, plate, meats, sauces, sides, return', () => {
    const t = buildGoogleDraft(jsBBQ).text;
    const at = (s) => t.indexOf(s);
    expect(at('Stopped at')).toBeGreaterThan(0);
    expect(at('Stopped at')).toBeLessThan(at('generous portions'));
    expect(at('generous portions')).toBeLessThan(at('brisket was a combo'));
    expect(at('brisket was a combo')).toBeLessThan(at('Turkey cuts'));
    expect(at('Turkey cuts')).toBeLessThan(at('4 Sauces'));
    expect(at('4 Sauces')).toBeLessThan(at('Potato salad'));
    expect(at('Potato salad')).toBeLessThan(at('Would I go back? Maybe.'));
  });

  test('arrival names the place, the order, and the price', () => {
    const p = paras(jsBBQ);
    expect(p[1]).toContain("Stopped at J's BBQ in Ripon on a Thursday morning");
    expect(p[1]).toContain('I ordered the 2 meat plate with brisket and smoked turkey, with potato salad and mac & cheese on the side.');
    expect(p[1]).toContain('$24.12.');
  });

  test('a sentence with no topic word stays with the one before it', () => {
    const t = buildGoogleDraft(jsBBQ).text;
    // "The heat has some mild kick." follows the house sauce, not the meats.
    expect(t.indexOf('mild kick')).toBeGreaterThan(t.indexOf('4 Sauces'));
    // "Be curious..." stays with the portions note.
    const plate = paras(jsBBQ).find(x => x.includes('generous portions'));
    expect(plate).toContain('weekend rush');
  });

  test('the sauce-dependency line closes the sauce paragraph', () => {
    const sauce = paras(jsBBQ).find(x => x.includes('4 Sauces'));
    expect(sauce.endsWith('For me the sauce helped but wasn\'t necessary.')).toBe(true);
  });
});

describe('facts (spec section 3)', () => {
  test('no section without notes: no service paragraph when nothing about service was noted', () => {
    expect(buildGoogleDraft(jsBBQ).text).not.toMatch(/friendly|attentive|service was/i);
  });

  test('scores never become descriptions', () => {
    const t = buildGoogleDraft(jsBBQ).text;
    expect(t).not.toMatch(/smoke ring|texture was good|clean and well kept/i);
  });

  test('banned style never appears', () => {
    const t = buildGoogleDraft(jsBBQ).text;
    expect(t).not.toMatch(/—|–/);
    expect(t).not.toMatch(/\b(overall|all in all|highlight|elevated|curated|journey|genuinely|testament|vibrant|delve)\b/i);
    expect(t).not.toMatch(/KCBS|Kansas City Barbeque Society|★|☆/);
  });

  test('with no notes at all the draft is only built from fields', () => {
    const t = buildGoogleDraft({ ...jsBBQ, notesLog: [] }).text;
    const p = t.split('\n\n');
    expect(p[0]).toMatch(/^TL;DR/);
    expect(t).toContain("Stopped at J's BBQ in Ripon.");
    expect(t).toContain('For me the sauce helped but wasn\'t necessary.');
    expect(p.length).toBe(5); // TL;DR, arrival, sauce line, return, ratings
  });
});

describe('voice: I for solo, we for anyone else', () => {
  test('a family visit uses we', () => {
    const t = buildGoogleDraft({ ...jsBBQ, party: 'Family', partySize: 4 }).text;
    expect(t).toContain('We ordered the 2 meat plate');
    expect(t).toContain('Would we go back? Maybe.');
    expect(t).not.toMatch(/\bI ordered\b/);
  });
  test('no party set falls back to I', () => {
    expect(buildGoogleDraft({ ...jsBBQ, party: '' }).text).toContain('I ordered');
  });
});

describe('mapping tables (spec section 4)', () => {
  test('return line, including the app\'s "Absolutely" as Yes', () => {
    expect(returnLine('Absolutely', 'I')).toBe("I'll be back.");
    expect(returnLine('Probably', 'I')).toBe("I'd go back.");
    expect(returnLine('Maybe', 'we')).toBe('Would we go back? Maybe.');
    expect(returnLine('Probably not', 'we')).toBe("We probably won't be back.");
    expect(returnLine('No', 'I')).toBe("I won't be back.");
    expect(returnLine('', 'I')).toBe('');
  });

  test('sauce dependency, using the app\'s option text', () => {
    expect(sauceLine('No — meat stood on its own', 'I', 'brisket')).toBe("The meat didn't need sauce.");
    expect(sauceLine('Helped but not necessary', 'I', 'brisket')).toBe("For me the sauce helped but wasn't necessary.");
    expect(sauceLine('Yes — meat needed sauce', 'we', 'ribs')).toBe('We needed sauce to get through the ribs.');
  });

  test('default sub-ratings and flags', () => {
    expect(defaultGoogleRatings(jsBBQ)).toEqual({ food: 3, service: 4, atmosphere: 3, flagged: ['atmosphere'] });
    expect(defaultGoogleRatings({ scores: { appearance: 8, taste: 8, tenderness: 8, smoke: 7, sides: 7, sauce: 7, portions: 8, service: 9, atmosphere: 5 } }))
      .toEqual({ food: 5, service: 5, atmosphere: 2, flagged: [] });
  });

  test('a saved override always wins over the default', () => {
    const t = buildGoogleDraft({ ...jsBBQ, googleRatings: { food: 4 } }).text;
    expect(t.endsWith('Food: 4 | Service: 4 | Atmosphere: 3')).toBe(true);
  });
});

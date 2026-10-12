import { describe, test, expect } from 'vitest';
import { sortSubmissions, submissionLabel } from './mySubmissions.js';

const ts = (iso) => ({ toMillis: () => Date.parse(iso) });

describe('sortSubmissions', () => {
  test('newest first, missing timestamps last', () => {
    const rows = [
      { id: 'a', reportedAt: ts('2026-09-01T00:00:00Z') },
      { id: 'b' },
      { id: 'c', reportedAt: ts('2026-10-01T00:00:00Z') },
    ];
    expect(sortSubmissions(rows).map(r => r.id)).toEqual(['c', 'a', 'b']);
  });

  test('accepts plain {seconds} timestamps too', () => {
    const rows = [{ id: 'old', reportedAt: { seconds: 1 } }, { id: 'new', reportedAt: { seconds: 2 } }];
    expect(sortSubmissions(rows)[0].id).toBe('new');
  });
});

describe('submissionLabel', () => {
  test('cut label, price, store and date', () => {
    expect(submissionLabel({
      cut: 'brisket_choice', pricePerLb: 5.99, store: 'Costco', reportedAt: ts('2026-09-11T15:00:00Z'),
    })).toBe('Brisket (USDA Choice) · $5.99/lb · Costco · Sep 11');
  });

  test('skips whatever is missing', () => {
    expect(submissionLabel({ cut: 'tri_tip' })).toBe('Tri-tip');
  });
});

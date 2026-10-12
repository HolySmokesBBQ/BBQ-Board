// "Your submissions" in Settings: list the prices this user has submitted
// and let them delete one. Firestore rules already allow an owner delete
// (firestore.board.rules, board_prices: resource.data.userId == auth.uid);
// until 2.4.6 there was no way to do it from the app, only by emailing.
//
// The query is a single equality filter, which Firestore indexes
// automatically. Sorting happens here instead of with orderBy, which would
// need a composite index (Board lost three weeks of submissions to a
// missing one in September).

import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { CUTS } from './schema.js';

export async function fetchMySubmissions(db, uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'board_prices'), where('userId', '==', uid)));
  return sortSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export function deleteSubmission(db, id) {
  return deleteDoc(doc(db, 'board_prices', id));
}

function millis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Newest first.
export function sortSubmissions(rows) {
  return [...rows].sort((a, b) => millis(b.reportedAt) - millis(a.reportedAt));
}

// "Brisket (USDA Choice) · $5.99/lb · Costco · Sep 11"
export function submissionLabel(row) {
  const cut = CUTS[row.cut]?.label || row.cut || 'Unknown cut';
  const price = typeof row.pricePerLb === 'number' ? `$${row.pricePerLb.toFixed(2)}/lb` : '';
  const ms = millis(row.reportedAt);
  const when = ms
    ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '';
  return [cut, price, row.store, when].filter(Boolean).join(' · ');
}

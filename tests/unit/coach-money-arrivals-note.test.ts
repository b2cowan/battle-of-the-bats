/**
 * **A ROW THAT SUMS ARRIVALS MUST NOT CLAIM THEY HAVE NO DATE** — the teeth on the owner ruling of
 * 2026-09-09 (from mockup artifact `7af46200`).
 *
 * WHY THIS EXISTS. A drive's or sponsor's row on the statement is one row per RECORD (owner ruling
 * 2026-09-07), so it adds up every arrival that record has taken and carries no single day. The
 * panel behind it read that null and printed **"no date recorded"** — five fully-dated sponsor
 * cheques in a row — while the Months view of the SAME report printed "Sep 4 · received" for one of
 * them. The words were true of the FIELD and false of the money, which is the only kind of untruth
 * a report can tell without any figure being wrong.
 *
 * ⚠ THE COUNT IS LOAD-BEARING, not decoration: it is the one thing on the line telling a coach the
 * row is an ADDITION rather than a payment. A coach who reads "$375.75 · May 10" goes looking for a
 * $375.75 cheque in the Ledger and finds two cheques of $301 and $200, gross, with a family's share
 * taken off — the row's figure is what the team KEPT. "2 payments" is what stops that trip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalsNote } from '../../lib/coach-money-derived.ts';

test('several arrivals name their count and the span they landed in', () => {
  assert.equal(arrivalsNote(2, 'May 10', 'Jun 14'), '2 payments · May 10 – Jun 14');
  assert.equal(arrivalsNote(8, 'May 2', 'Aug 19'), '8 payments · May 2 – Aug 19');
});

test('several arrivals on ONE day still say how many', () => {
  /* The money is still a sum — a coach still has to know that before they go looking for one
     payment of that size — so the count survives even when the span collapses to a point. */
  assert.equal(arrivalsNote(3, 'May 10', 'May 10'), '3 payments · May 10');
});

test('one arrival is just its date', () => {
  /* "1 payment · Sep 4" was drawn in the approved mockup and rejected: two words heavier on every
     single-cheque row, saying nothing the date does not. Do not re-propose it. */
  assert.equal(arrivalsNote(1, 'Sep 4', 'Sep 4'), 'Sep 4');
});

test('a count that has collapsed to nothing still reads as a date, never as an empty line', () => {
  /* Unreachable through the route — a record only reaches the statement because it has at least one
     arrival — but a helper that returned "0 payments · " on a shape it was not expecting would put
     that string on a coach's screen. It degrades to the plain date instead. */
  assert.equal(arrivalsNote(0, 'Sep 4', 'Sep 4'), 'Sep 4');
});

test('the words are the same on both sides of the panel — one spelling for one thing', () => {
  /* The panel's own closing sentence calls every record on it a payment. A drive's arrivals are
     families' amounts and a sponsor's are cheques; giving one of them a second word would be two
     names for one thing on one screen (owner ruling 2026-08-24). */
  assert.match(arrivalsNote(4, 'May 2', 'Jun 1'), /payments/);
  assert.doesNotMatch(arrivalsNote(4, 'May 2', 'Jun 1'), /entr(y|ies)|arrivals|amounts/);
});

'use client';
/**
 * "ONLINE PAYMENTS STOP…" (Club Tier Stage 12d-2 Part 3 — frame 4, words CLUB_TIER_STAGE12D_COPY.md §4.2–§4.4; asks 4, 11).
 *
 * The one section every ending window adds under its own shipped text, from the one count (`readOutstanding`): a move to
 * a plan without online payments (the owner's downgrade), a cancel (the owner's and the operator's) and the deletion
 * request. Each clause drops at 0. A count that failed (`counted: false`) says the rule without numbers — never "nobody
 * owes". The account is never disconnected by any of them (ask 4).
 */
import { formatStoredDate } from '@/lib/timezone';
import { LEAVING_WORDS as L } from '@/lib/online-payment-words';
import type { EndingSection } from '@/lib/online-payment-endings';
import ck from './Billing.module.css';

export type PaymentsEndingKind = { kind: 'move'; dateLong: string } | { kind: 'cancel' } | { kind: 'delete' };

export default function PaymentsEndingSection({ section, ending }: { section: EndingSection | null | undefined; ending: PaymentsEndingKind }) {
  if (!section) return null;
  const o = section.outstanding;
  const owe = section.counted ? L.oweToday(o.familiesOwing, o.teamsOwing) : '';
  if (ending.kind === 'move') {
    return (
      <section aria-label={L.move.heading(ending.dateLong)}>
        <h3 className={ck.label}>{L.move.heading(ending.dateLong)}</h3>
        <p>{L.move.stops(owe)}</p>
        <p>{L.move.finish}</p>
        <p>{L.move.connected}</p>
      </section>
    );
  }
  if (ending.kind === 'cancel') {
    return (
      <section aria-label={L.cancel.heading}>
        <h3 className={ck.label}>{L.cancel.heading}</h3>
        <p>{L.cancel.stops(owe)}</p>
        {o.openPages > 0 && <p>{L.cancel.pages(o.openPages)}</p>}
        {o.debitsClearing > 0 && <p>{L.cancel.clearing(o.debitsClearing)}</p>}
        <p>{L.cancel.stripe(o.openDisputes)}</p>
      </section>
    );
  }
  const waiting = L.delete.waiting(o.openDisputes, o.debitsClearing);
  const owing = L.delete.owe(owe);
  return (
    <section aria-label={L.delete.heading}>
      <h3 className={ck.label}>{L.delete.heading}</h3>
      {waiting && <p>{waiting}</p>}
      {owing && <p>{owing}</p>}
      <p>{L.delete.disconnect}</p>
      <p>{L.delete.export}</p>
    </section>
  );
}

/** "October 27, 2026" — the move date, as the plan-move text prints it. */
export function moveDateLong(iso: string | null | undefined): string {
  return formatStoredDate(iso ?? new Date().toISOString(), { longMonth: true });
}

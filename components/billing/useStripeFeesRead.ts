'use client';

import { useEffect, useState } from 'react';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import { owedInvoicesOf, type FeesRead } from '@/lib/fee-invoice-line';

/**
 * The club's Stripe fees, read ONCE for the whole Plan & billing page: the fees list and the one line above the plan card both
 * draw from this answer (Fee invoice alerts Part 3), so the two always agree and nothing is fetched twice. An extra read: a
 * failure leaves the page as it was, never a failed page.
 *
 * The owner pays an invoice in Stripe's page in ANOTHER tab. When they come back (the tab shows again) and an invoice was owed,
 * the read repeats; if what is owed changed, `onOwedChanged` runs so the pill on the Plan & billing door (the club brief)
 * re-reads too, and the pill, the line and the list agree without a manual reload. A tournament-only owner never visits the hub,
 * so this is the only refresh they get. A club that owes nothing never re-reads on a tab change.
 *
 * The page's body is keyed by the org, so one instance only ever reads one club's fees.
 */
const MIN_GAP_MS = 1500;

export function useStripeFeesRead(slug: string, onOwedChanged?: () => void): FeesRead | null {
  const [read, setRead] = useState<FeesRead | null>(null);
  const changed = useLatestRef(onOwedChanged);

  useEffect(() => {
    if (!slug) return;
    // Which invoices are owed and in what state ('' = nothing owed; null = not read yet), so an invoice that went overdue (or was
    // swapped for a new one) while the count stayed the same still refreshes the pill, whose tone and overdue count read the state.
    let sig: string | null = null;
    let lastFetch = 0;
    let seq = 0; // two reads can overlap; only the newest answer is used, and unmounting retires them all
    const load = () => {
      lastFetch = Date.now();
      const mine = ++seq;
      fetch(`/api/billing/stripe-fees?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d || mine !== seq) return;
          const next = d as FeesRead;
          const before = sig;
          sig = owedInvoicesOf(next).map(i => `${i.invoiceNo}:${i.state}`).join('|');
          setRead(next);
          if (before != null && before !== sig) changed.current?.(); // only a return can have a previous read
        })
        .catch(() => {});
    };
    load();
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      if (!sig) return; // nothing read yet, or nothing owed
      if (Date.now() - lastFetch < MIN_GAP_MS) return;
      load();
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => { seq = -1; document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back); };
  }, [slug, changed]);

  return read;
}

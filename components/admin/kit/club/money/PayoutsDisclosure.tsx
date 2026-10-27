'use client';
/**
 * "PAYOUTS TO YOUR BANK" (Club Tier Stage 12d-2 Part 2 — words §3.3; ask 5): for a club without Accounting, its owner is
 * the only one matching payouts, so the same list sits on the owner's Payouts card, in a disclosure closed every time
 * the card opens. Its summary line answers "is money coming?" while closed, from the list's own read (the default
 * dates); opening it mounts the list, whose read the server already holds.
 */
import { useCallback, useState } from 'react';
import { useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { day, money } from '@/components/admin/kit/club/money/MoneyKit';
import { PAYOUTS_LIST_WORDS as W } from '@/lib/online-payment-words';
import { payoutsSummary } from '@/lib/online-payouts-map';
import { tournamentToday } from '@/lib/timezone';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import PayoutsList, { payoutsUrl } from './PayoutsList';
import s from './PayoutsList.module.css';

export default function PayoutsDisclosure({ orgSlug }: { orgSlug: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    const today = tournamentToday();
    const [y, m] = today.split('-').map(Number);
    const from = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
    const res = await fetch(payoutsUrl(orgSlug, from, today), { credentials: 'same-origin' }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!current() || !data) return;
    const sum = payoutsSummary(data.payouts ?? []);
    setSummary(W.card.summary(
      sum.onItsWay != null ? money(sum.onItsWay) : null,
      sum.lastPaid ? { amount: money(sum.lastPaid.amount), day: day(sum.lastPaid.day) } : null,
    ) ?? W.empty);
  }, [orgSlug, beginRead]);
  useDeferredLoad(!!orgSlug, load);

  return (
    <details className={s.disclosure} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className={s.disclosureHead}>
        <span className={s.disclosureTitle}>{W.card.heading}</span>
        {summary && <span className={ck.hint}>{summary}</span>}
      </summary>
      {open && <div className={s.disclosureBody}><PayoutsList orgSlug={orgSlug} /></div>}
    </details>
  );
}

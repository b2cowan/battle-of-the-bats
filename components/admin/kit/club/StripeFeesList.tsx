'use client';

import { useEffect, useState } from 'react';
import { STRIPE_FEE_WORDS as W, money } from '@/lib/online-payment-words';
import { formatStoredDate } from '@/lib/timezone';
import ck from './ClubKit.module.css';
import css from './StripeFeesList.module.css';

/**
 * SETTINGS › PLAN & BILLING: THE CLUB'S STRIPE FEES (Club Tier Stage 12d-1 Part 4, owner ruling 4: what, when, billed /
 * unpaid, Pay the invoice). Every club pays the Stripe fees its online payments cause, comped and free included, so the
 * section shows on every plan; it is absent until the club has a fee (absent beats an empty table). An extra read: a
 * failure leaves the page as it was, never a failed page. Owner-only, like the page and its route.
 */

type Fee = {
  id: string; line: string; createdAt: string; amount: number; credit: boolean;
  state: 'next' | 'waiting' | 'own_open' | 'own_paid' | 'own_overdue' | 'credit' | 'returned' | 'test' | 'error';
  invoiceNo: string | null; invoiceDay: string | null; payUrl: string | null;
};

const short = (v: string | null) => (v ? formatStoredDate(v, { withYear: false }) : '');

function billedWords(f: Fee): string {
  switch (f.state) {
    case 'next': return W.billedNext;
    case 'waiting': return W.billedWaiting(short(f.invoiceDay));
    case 'own_open':
    case 'own_overdue': return W.billedOwn(f.invoiceNo ?? '', short(f.invoiceDay));
    case 'own_paid': return W.billedOwnPaid(f.invoiceNo ?? '', short(f.invoiceDay));
    case 'credit': return W.billedCredit;
    case 'returned': return W.billedReturned(short(f.invoiceDay));
    case 'test': return W.billedTest;
    case 'error': return W.billedError;
  }
}

export default function StripeFeesList({ slug }: { slug: string }) {
  const [read, setRead] = useState<{ fees: Fee[]; planFree: boolean } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    fetch(`/api/billing/stripe-fees?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d) setRead(d as { fees: Fee[]; planFree: boolean }); })
      .catch(() => {});
    return () => { live = false; };
  }, [slug]);

  if (!read?.fees.length) return null;
  // One "Pay the invoice" per open invoice, on its newest line.
  const payShown = new Set<string>();
  return (
    <section className={ck.section} aria-labelledby="billing-stripe-fees">
      <div className={ck.sectionHead}><h2 id="billing-stripe-fees" className={ck.sectionTitle}>{W.listHeading}</h2></div>
      <p className={ck.lede}>{W.listLead}{read.planFree ? ` ${W.listPlan}` : ''}</p>
      <ul className={css.list}>
        {read.fees.map(f => {
          const pay = f.payUrl && f.invoiceNo && !payShown.has(f.invoiceNo) ? f.payUrl : null;
          if (pay && f.invoiceNo) payShown.add(f.invoiceNo);
          return (
            <li key={f.id} className={css.row}>
              <div className={css.what}>
                <span className={css.line}>{f.line}</span>
                <span className={`${css.billed}${f.state === 'error' ? ` ${css.warn}` : ''}`}>{billedWords(f)}</span>
              </div>
              <div className={css.side}>
                <span className={css.amount}>{f.credit ? W.credit(money(f.amount)) : money(f.amount)}</span>
                {pay && <a className={ck.link} href={pay} target="_blank" rel="noopener noreferrer">{W.payInvoice}</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

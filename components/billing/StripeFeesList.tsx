'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { CoachChip } from '@/components/coaches/kit';
import { STRIPE_FEE_WORDS as W, money } from '@/lib/online-payment-words';
import { formatStoredDate } from '@/lib/timezone';
import ck from './Billing.module.css';
import css from './StripeFeesList.module.css';

/**
 * SETTINGS › PLAN & BILLING: THE CLUB'S STRIPE FEES (Club Tier Stage 12d-1 Part 4, owner ruling 4: what, when, billed /
 * unpaid, Pay invoice). Every club pays the Stripe fees its online payments cause, comped and free included, so the
 * section shows on every plan; it is absent until the club has a fee (absent beats an empty table). An extra read: a
 * failure leaves the page as it was, never a failed page. Owner-only, like the page and its route.
 *
 * Fee invoice alerts (owner drawings 2026-11-05, all eight asks as recommended): the fees are GROUPED BY INVOICE. An invoice is one
 * row (number, due day, an Overdue chip with the words "Was due {day}" once past, Stripe's total tax included, ONE Pay invoice
 * button that opens Stripe's page in a new tab) with its fee lines under it and the tax as its own line, so the lines add up to the
 * total. Fees not on an invoice yet wait under their own heading; paid invoices fold into a closed row. Words carry the state;
 * the red edge is a second cue only. A fee whose invoice the server did not describe falls back to the plain line it always had.
 */

type Fee = {
  id: string; line: string; createdAt: string; amount: number; credit: boolean;
  state: 'next' | 'waiting' | 'own_open' | 'own_paid' | 'own_overdue' | 'credit' | 'returned' | 'test' | 'error';
  invoiceNo: string | null; invoiceDay: string | null; payUrl: string | null;
};
type Invoice = {
  invoiceNo: string; state: 'own_open' | 'own_overdue' | 'own_paid'; day: string | null;
  total: number | null; taxLines: Array<{ label: string; amount: number }>; payUrl: string | null;
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

const amountOf = (f: Fee) => (f.credit ? W.credit(money(f.amount)) : money(f.amount));

function FeeRow({ fee, inGroup }: { fee: Fee; inGroup: boolean }) {
  return (
    <li className={`${css.row}${inGroup ? ` ${css.inGroup}` : ''}`}>
      <div className={css.what}>
        <span className={css.line}>{fee.line}</span>
        <span className={`${css.billed}${fee.state === 'error' ? ` ${css.warn}` : ''}`}>{billedWords(fee)}</span>
      </div>
      <div className={css.side}><span className={css.amount}>{amountOf(fee)}</span></div>
    </li>
  );
}

/** One invoice and the fees under it. In a group the fee's "billed" line is the invoice's own, so it is not repeated per fee. */
function InvoiceGroup({ invoice, fees }: { invoice: Invoice; fees: Fee[] }) {
  const overdue = invoice.state === 'own_overdue';
  const paid = invoice.state === 'own_paid';
  const sub = paid ? W.paidSub(short(invoice.day)) : overdue ? W.overdueSub(short(invoice.day)) : W.dueSub(short(invoice.day));
  return (
    <ul className={`${css.list} ${css.group}`}>
      <li className={`${css.head}${overdue ? ` ${css.headOverdue}` : ''}`}>
        <div className={css.what}>
          <span className={css.invoiceName}>{W.invoiceHeading(invoice.invoiceNo)}{overdue && <CoachChip tone="danger">{W.chipOverdue}</CoachChip>}</span>
          <span className={css.billed}>{sub}</span>
        </div>
        <div className={css.headSide}>
          {invoice.total != null && <span className={css.total}><span className={ck.srOnly}>{W.total} </span>{money(invoice.total)}</span>}
          {invoice.payUrl && (
            <a className={`btn btn-lime ${css.pay}`} href={invoice.payUrl} target="_blank" rel="noopener noreferrer" aria-label={W.payInvoiceAria(invoice.invoiceNo)}>
              {W.payInvoice}<ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      </li>
      {fees.map(f => (
        <li key={f.id} className={`${css.row} ${css.inGroup}`}>
          <div className={css.what}>
            <span className={css.line}>{f.line}</span>
          </div>
          <div className={css.side}><span className={css.amount}>{amountOf(f)}</span></div>
        </li>
      ))}
      {invoice.taxLines.map(t => (
        <li key={t.label} className={`${css.row} ${css.inGroup} ${css.taxRow}`}>
          <div className={css.what}><span className={css.line}>{t.label}</span></div>
          <div className={css.side}><span className={css.amount}>{money(t.amount)}</span></div>
        </li>
      ))}
    </ul>
  );
}

export default function StripeFeesList({ slug }: { slug: string }) {
  const [read, setRead] = useState<{ fees: Fee[]; invoices?: Invoice[]; planFree: boolean } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    fetch(`/api/billing/stripe-fees?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d) setRead(d as { fees: Fee[]; invoices?: Invoice[]; planFree: boolean }); })
      .catch(() => {});
    return () => { live = false; };
  }, [slug]);

  if (!read?.fees.length) return null;

  const invoices = read.invoices ?? [];
  const byNo = new Map(invoices.map(i => [i.invoiceNo, i]));
  const onInvoice = (f: Fee) => !!f.invoiceNo && byNo.has(f.invoiceNo) && (f.state === 'own_open' || f.state === 'own_overdue' || f.state === 'own_paid');
  const feesOf = (no: string) => read.fees.filter(f => f.invoiceNo === no && onInvoice(f));
  // Owed first (overdue before open, soonest due first), then the ones not on an invoice yet, then whatever has its own words.
  const owed = invoices.filter(i => i.state !== 'own_paid' && feesOf(i.invoiceNo).length)
    .sort((a, b) => (a.state === b.state ? (a.day ?? '').localeCompare(b.day ?? '') : a.state === 'own_overdue' ? -1 : 1));
  const paid = invoices.filter(i => i.state === 'own_paid' && feesOf(i.invoiceNo).length)
    .sort((a, b) => (b.day ?? '').localeCompare(a.day ?? ''));
  const unbilled = read.fees.filter(f => f.state === 'next' || f.state === 'waiting');
  const other = read.fees.filter(f => !onInvoice(f) && f.state !== 'next' && f.state !== 'waiting');

  return (
    <section className={ck.section} aria-labelledby="billing-stripe-fees">
      <div className={ck.sectionHead}><h2 id="billing-stripe-fees" className={ck.sectionTitle}>{W.listHeading}</h2></div>
      <p className={ck.lede}>{W.listLead}{read.planFree ? ` ${W.listPlan}` : ''}</p>
      {owed.map(i => <InvoiceGroup key={i.invoiceNo} invoice={i} fees={feesOf(i.invoiceNo)} />)}
      {unbilled.length > 0 && (
        <ul className={css.list}>
          <li className={css.quiet}>{W.groupUnbilled}</li>
          {unbilled.map(f => <FeeRow key={f.id} fee={f} inGroup={false} />)}
        </ul>
      )}
      {other.length > 0 && <ul className={css.list}>{other.map(f => <FeeRow key={f.id} fee={f} inGroup={false} />)}</ul>}
      {paid.length > 0 && (
        <details className={css.paidFold}>
          <summary className={css.paidSummary}>{W.groupPaid(paid.length)}</summary>
          {paid.map(i => <InvoiceGroup key={i.invoiceNo} invoice={i} fees={feesOf(i.invoiceNo)} />)}
        </details>
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { STRIPE_FEE_WORDS as W, money } from '@/lib/online-payment-words';
import { formatStoredDate, LONG_MONTHS } from '@/lib/timezone';
import type { ClubFeeView } from '@/lib/platform-stripe-fees';
import { errorOf, sendJson } from '../../console-fetch';
import kit from '../../console.module.css';

/**
 * THE MONEY TAB'S STRIPE-FEES PANEL (Club Tier Stage 12d-1 Part 4; words §6.1 `pa.panel.fees`): "platform admin tracks the
 * fees like other payments". Every fee this club's online payments caused, how it is billed, and — for a fee whose billing
 * failed — Stripe's error and a Retry (the billing power only; absent otherwise). An unpaid invoice of its own is shown
 * plainly: nothing switches off by itself. Absent when the club has no fee (the tab's caption covers families' money).
 */

const short = (v: string | null) => (v ? formatStoredDate(v, { withYear: false }) : '');
const monthOf = (iso: string) => LONG_MONTHS[Number(iso.slice(5, 7)) - 1] ?? '';

function billed(f: ClubFeeView): { text: string; tone: 'quiet' | 'info' | 'warn' } {
  switch (f.state) {
    case 'next': return { text: W.paNext(monthOf(f.billedAt ?? f.createdAt)), tone: 'quiet' };
    case 'waiting': return { text: W.billedWaiting(short(f.invoiceDay)), tone: 'quiet' };
    case 'own_open': return { text: W.billedOwn(f.invoiceNo ?? '', short(f.invoiceDay)), tone: 'quiet' };
    case 'own_overdue': return { text: W.billedOwnUnpaid(f.invoiceNo ?? '', short(f.invoiceDay)), tone: 'info' };
    case 'own_paid': return { text: W.billedOwnPaid(f.invoiceNo ?? '', short(f.invoiceDay)), tone: 'quiet' };
    case 'credit': return { text: W.paCredit, tone: 'quiet' };
    case 'returned': return { text: W.billedReturned(short(f.invoiceDay)), tone: 'quiet' };
    case 'test': return { text: W.billedTest, tone: 'quiet' };
    case 'legacy_exempt': return { text: W.paLegacy, tone: 'quiet' };
    case 'error': return { text: W.paError, tone: 'warn' };
  }
}

export default function StripeFeesPanel({ orgId, canRetry }: { orgId: string; canRetry: boolean }) {
  const [fees, setFees] = useState<ClubFeeView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/money/stripe-fees`, 'GET');
    if (ok) setFees((data as { fees?: ClubFeeView[] }).fees ?? []);
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);

  async function retry(id: string) {
    setBusy(id);
    const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/money/stripe-fees/${id}/retry`, 'POST');
    const outcome = (data as { outcome?: string }).outcome;
    setSaid(s => ({ ...s, [id]: !ok ? errorOf(data, W.paRetryFailed) : outcome === 'error' ? W.paRetryFailed : W.paRetried }));
    setBusy(null);
    await load();
  }

  if (!fees?.length) return null;
  return (
    <>
      <h2 className={kit.sectionTitle}>{W.paHeading}</h2>
      <div className={kit.card}>
        <div className={kit.tableWrap}>
          <table className={kit.comfortable}>
            <thead>
              <tr><th>{W.paFor}</th><th>{W.paBilled}</th><th>{W.paDate}</th><th className={kit.num}>{W.paFee}</th></tr>
            </thead>
            <tbody>
              {fees.map(f => {
                const b = billed(f);
                return (
                  <tr key={f.id}>
                    <td>
                      {f.line}
                      {f.source === 'rate' && <div className={kit.caption}>{W.paFromRate}</div>}
                    </td>
                    <td>
                      <span className={b.tone === 'warn' ? `${kit.chip} ${kit.chipWarn}` : b.tone === 'info' ? `${kit.chip} ${kit.chipInfo}` : undefined}>{b.text}</span>
                      {f.state === 'error' && f.billError && <div className={kit.caption}>{f.billError}</div>}
                      {f.state === 'error' && canRetry && (
                        <div>
                          <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => void retry(f.id)} disabled={busy === f.id}>
                            {busy === f.id ? 'Retrying…' : W.paRetry}
                          </button>
                        </div>
                      )}
                      {said[f.id] && <div className={kit.caption} role="status">{said[f.id]}</div>}
                    </td>
                    <td>{short(f.createdAt)}</td>
                    <td className={kit.num}>{f.credit ? W.credit(money(f.amount)) : money(f.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

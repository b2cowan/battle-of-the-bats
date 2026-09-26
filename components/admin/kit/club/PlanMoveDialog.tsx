'use client';
/**
 * The band move — "a question, not a checkout" (Club Tier Stage 1b, specimen 7; ⚖ D7 + Ask 4).
 *
 *   UP   (Club → Club · Association): now, on the ONE subscription the club has, prorated. The figure
 *        is STRIPE'S preview, fetched when the window opens, never our arithmetic — and the move is
 *        made with the preview's `prorationDate`, so the charge equals what the owner was shown.
 *   DOWN (Club · Association → Club): at the next renewal, with no credit — and REFUSED while the club
 *        has more active teams than the smaller band holds (the cap is what defines the band).
 *
 * A club that is not paying on a live subscription (an operator's trial, a comp) has nothing to
 * change: the move route says so (`no_live_subscription`) and the window offers checkout instead.
 * One window serves the plan page and the Rep Teams team-cap refusal ("offers the move in place").
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import { formatStoredDate } from '@/lib/timezone';
import type { OrgPlan } from '@/lib/types';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import styles from './Billing.module.css';

/** Where "Contact us" goes until a band is on sale (the Stage 8 flip) and above the largest band.
 *  The company's one inbox (owner 2026-09-26), the same address `lib/email.ts` falls back to. */
export const CONTACT_HREF = 'mailto:fieldlogichq@gmail.com';

type Preview =
  | { direction: 'up'; amountDueToday: number; currency: string; prorationDate: number; nextAmount: number; renewsAt: string | null; billingCycle: 'monthly' | 'annual' }
  | { direction: 'down'; effectiveAt: string | null; nextAmount: number; currency: string; billingCycle: 'monthly' | 'annual' };
type Refusal = { code: string; error: string; activeTeams?: number; teamLimit?: number };

/** Cents → "$12.34" (CAD unless Stripe says otherwise). */
export function money(cents: number, currency = 'cad'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export default function PlanMoveDialog({
  org,
  toPlan,
  onClose,
  onMoved,
}: {
  org: { slug: string; name: string; planId: OrgPlan; subscriptionPeriod?: 'monthly' | 'annual' };
  toPlan: OrgPlan;
  onClose: () => void;
  /** The move happened (or was scheduled): the sentence to show, and reload what depends on the plan. */
  onMoved: (notice: string) => void;
}) {
  const target = PLAN_CONFIG[toPlan];
  const [state, setState] = useState<{ status: 'loading' } | { status: 'preview'; preview: Preview } | { status: 'refused'; refusal: Refusal }>({ status: 'loading' });
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    fetch('/api/billing/move/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug: org.slug, planKey: toPlan }),
    })
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (stale) return;
        if (r.ok) setState({ status: 'preview', preview: d as Preview });
        else setState({ status: 'refused', refusal: { code: d.code ?? 'error', error: d.error ?? 'The move couldn’t be checked. Try again.', activeTeams: d.activeTeams, teamLimit: d.teamLimit } });
      })
      .catch(() => { if (!stale) setState({ status: 'refused', refusal: { code: 'network', error: 'The move couldn’t be checked. Check your connection and try again.' } }); });
    return () => { stale = true; };
  }, [org.slug, toPlan]);

  async function confirm() {
    if (state.status !== 'preview') return;
    setWorking(true);
    setFailure(null);
    try {
      const res = await fetch('/api/billing/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgSlug: org.slug,
          planKey: toPlan,
          ...(state.preview.direction === 'up' ? { prorationDate: state.preview.prorationDate } : {}),
        }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; scheduled?: { effectiveAt: string | null } };
      if (!res.ok) { setFailure(d.error ?? 'The move didn’t go through. Try again.'); return; }
      onMoved(state.preview.direction === 'up'
        ? `${org.name} is now on ${target.label}.`
        : `${org.name} moves to ${target.label}${d.scheduled?.effectiveAt ? ` on ${formatStoredDate(d.scheduled.effectiveAt, { longMonth: true })}` : ' at renewal'}.`);
    } catch {
      setFailure('The move didn’t go through. Check your connection and try again.');
    } finally {
      setWorking(false);
    }
  }

  async function checkout() {
    setWorking(true);
    setFailure(null);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: toPlan,
          billingCycle: org.subscriptionPeriod ?? 'monthly',
          orgSlug: org.slug,
          returnTo: `/${org.slug}/admin/org/billing`,
        }),
      });
      const d = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !d.url) { setFailure(d.error ?? 'Checkout didn’t open. Try again.'); return; }
      window.location.assign(d.url);
    } catch {
      setFailure('Checkout didn’t open. Check your connection and try again.');
    } finally {
      setWorking(false);
    }
  }

  const period = (cycle: 'monthly' | 'annual') => (cycle === 'annual' ? 'year' : 'month');
  const refusal = state.status === 'refused' ? state.refusal : null;

  // ── The footer answers the state: confirm a preview, go and archive, check out, or just close ──
  let footer = (
    <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>Close</button>
  );
  if (state.status === 'preview') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>Cancel</button>
        <button type="button" className="btn btn-lime" onClick={() => void confirm()} disabled={working} data-autofocus="">
          {working ? 'Moving…' : `Move to ${target.label}`}
        </button>
      </>
    );
  } else if (refusal?.code === 'band_too_small') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        <Link href={`/${org.slug}/admin/rep-teams`} className="btn btn-lime">Go to Rep Teams</Link>
      </>
    );
  } else if (refusal?.code === 'no_live_subscription') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>Cancel</button>
        <button type="button" className="btn btn-lime" onClick={() => void checkout()} disabled={working}>
          {working ? 'Opening checkout…' : 'Continue to checkout'}
        </button>
      </>
    );
  } else if (refusal?.code === 'plan_not_on_sale') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        <a href={CONTACT_HREF} className="btn btn-lime">Contact us</a>
      </>
    );
  }

  return (
    <KitDialog kind="question" title={`Move to ${target.label}?`} onClose={onClose} busy={working} footer={footer}>
      {failure && (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>{failure}</div>
        </div>
      )}
      {state.status === 'loading' && <p>Loading…</p>}

      {state.status === 'preview' && state.preview.direction === 'up' && (
        <>
          <p>{org.name} moves to {target.label} today and can hold up to {target.teamLimit} teams.</p>
          <dl className={styles.figures}>
            <div>
              <dt>Today, for the rest of this billing period</dt>
              <dd>{money(state.preview.amountDueToday, state.preview.currency)}</dd>
            </div>
            <div>
              <dt>From {state.preview.renewsAt ? formatStoredDate(state.preview.renewsAt, { longMonth: true }) : 'your next renewal'}</dt>
              <dd>{money(state.preview.nextAmount, state.preview.currency)} CAD / {period(state.preview.billingCycle)}</dd>
            </div>
          </dl>
          <p className={ck.hint}>Same subscription and card, with no second checkout. The prorated amount comes from Stripe before you confirm.</p>
        </>
      )}

      {state.status === 'preview' && state.preview.direction === 'down' && (
        <>
          <p>
            {org.name} moves to {target.label}
            {state.preview.effectiveAt ? ` on ${formatStoredDate(state.preview.effectiveAt, { longMonth: true })}` : ' at your next renewal'}
            , and can hold up to {target.teamLimit} teams from then.
          </p>
          <p className={ck.hint}>
            You keep {PLAN_CONFIG[org.planId].label} until then, with no credit for the rest of this period. From then it’s{' '}
            {money(state.preview.nextAmount, state.preview.currency)} CAD / {period(state.preview.billingCycle)}.
          </p>
        </>
      )}

      {refusal?.code === 'band_too_small' && (
        <p>
          {target.label} holds {refusal.teamLimit ?? target.teamLimit} teams and {org.name} has {refusal.activeTeams} active.
          {' '}Archive {(refusal.activeTeams ?? 0) - (refusal.teamLimit ?? target.teamLimit)} team{(refusal.activeTeams ?? 0) - (refusal.teamLimit ?? target.teamLimit) === 1 ? '' : 's'} first, then come back.
        </p>
      )}
      {refusal?.code === 'no_live_subscription' && (
        <p>
          {org.name} isn’t paying by card yet, so there’s no subscription to change. This starts {target.label}
          {' '}({formatPriceAmount(org.subscriptionPeriod === 'annual' ? target.annualPrice : target.monthlyPrice)} CAD / {org.subscriptionPeriod === 'annual' ? 'year' : 'month'}) at checkout, where you add a card.
        </p>
      )}
      {refusal?.code === 'plan_not_on_sale' && (
        <p>{target.label} isn’t open for purchase yet. Contact us and we’ll move {org.name} for you.</p>
      )}
      {refusal && !['band_too_small', 'no_live_subscription', 'plan_not_on_sale'].includes(refusal.code) && (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>{refusal.error}</div>
        </div>
      )}
    </KitDialog>
  );
}

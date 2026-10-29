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
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import KitDialog from '@/components/shared/KitDialog';
import PageNotice from '@/components/shared/PageNotice';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import styles from './Billing.module.css';
import LoadingState from '@/components/shared/LoadingState';

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
  returnTo,
  teamsHref,
  onClose,
  onMoved,
}: {
  org: { slug: string; name: string; planId: OrgPlan; subscriptionPeriod?: 'monthly' | 'annual' };
  toPlan: OrgPlan;
  returnTo: string;
  teamsHref: string;
  onClose: () => void;
  /** The move happened (or was scheduled): the sentence to show, and reload what depends on the plan. */
  onMoved: (notice: string) => void;
}) {
  const target = PLAN_CONFIG[toPlan];
  const live = useRef(true);
  const busyRef = useRef(false);
  const leaving = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'preview'; preview: Preview } | { status: 'refused'; refusal: Refusal }>({ status: 'loading' });
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) { leaving.current = false; busyRef.current = false; setWorking(false); }
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

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
        else setState({ status: 'refused', refusal: { code: d.code ?? 'error', error: d.error ?? W.errors.movePreview, activeTeams: d.activeTeams, teamLimit: d.teamLimit } });
      })
      .catch(() => { if (!stale) setState({ status: 'refused', refusal: { code: 'network', error: W.errors.movePreviewNetwork } }); });
    return () => { stale = true; };
  }, [org.slug, toPlan]);

  async function confirm() {
    if (state.status !== 'preview' || busyRef.current) return;
    busyRef.current = true;
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
      if (!res.ok) { setFailure(d.error ?? W.errors.move); return; }
      if (live.current) onMoved(state.preview.direction === 'up'
        ? W.move.moved(org.name, target.label)
        : W.move.scheduled(org.name, target.label, d.scheduled?.effectiveAt ?? null));
    } catch {
      setFailure(W.errors.moveNetwork);
    } finally {
      if (live.current && !leaving.current) { busyRef.current = false; setWorking(false); }
    }
  }

  async function checkout() {
    if (busyRef.current) return;
    busyRef.current = true;
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
          returnTo,
        }),
      });
      const d = await res.json().catch(() => ({})) as { url?: string; error?: string; applied?: boolean; restoredCount?: number; remainingRetainedCount?: number };
      if (!res.ok) { setFailure(d.error ?? W.errors.checkout); return; }
      if (!live.current) return;
      if (d.applied) { onMoved(W.notice.updated(target.label, d.restoredCount, d.remainingRetainedCount)); return; }
      if (!d.url) { setFailure(W.errors.checkout); return; }
      leaving.current = true;
      window.location.assign(d.url);
    } catch {
      leaving.current = false;
      setFailure(W.errors.checkoutNetwork);
    } finally {
      if (live.current && !leaving.current) { busyRef.current = false; setWorking(false); }
    }
  }

  const period = (cycle: 'monthly' | 'annual') => (cycle === 'annual' ? 'year' : 'month');
  const refusal = state.status === 'refused' ? state.refusal : null;

  // ── The footer answers the state: confirm a preview, go and archive, check out, or just close ──
  let footer = (
    <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>{W.move.close}</button>
  );
  if (state.status === 'preview') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>{W.move.cancel}</button>
        <button type="button" className="btn btn-lime" onClick={() => void confirm()} disabled={working} data-autofocus="">
          {working ? W.move.moving : W.change.move(target.label)}
        </button>
      </>
    );
  } else if (refusal?.code === 'band_too_small') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        <Link href={teamsHref} className="btn btn-lime">{W.move.repTeams}</Link>
      </>
    );
  } else if (refusal?.code === 'no_live_subscription') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>Cancel</button>
        <button type="button" className="btn btn-lime" onClick={() => void checkout()} disabled={working}>
          {working ? W.plan.openingCheckout : W.move.checkout}
        </button>
      </>
    );
  } else if (refusal?.code === 'plan_not_on_sale') {
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        <a href={CONTACT_HREF} className="btn btn-lime">{W.change.contact}</a>
      </>
    );
  }

  return (
    <KitDialog kind="question" title={W.move.title(target.label)} onClose={onClose} busy={working} footer={footer}>
      {failure && (
        <PageNotice notice={{ tone: 'bad', text: failure }} />
      )}
      {state.status === 'loading' && <LoadingState inline label="Loading what the move changes…" />}

      {state.status === 'preview' && state.preview.direction === 'up' && (
        <>
          <p>{W.move.up(org.name, target.label, target.teamLimit)}</p>
          <dl className={styles.figures}>
            <div>
              <dt>{W.move.today}</dt>
              <dd>{money(state.preview.amountDueToday, state.preview.currency)}</dd>
            </div>
            <div>
              <dt>{W.move.from(state.preview.renewsAt)}</dt>
              <dd>{money(state.preview.nextAmount, state.preview.currency)} CAD / {period(state.preview.billingCycle)}</dd>
            </div>
          </dl>
          <p className={styles.hint}>{W.move.previewHelp}</p>
        </>
      )}

      {state.status === 'preview' && state.preview.direction === 'down' && (
        <>
          <p>{W.move.down(org.name, target.label, target.teamLimit, state.preview.effectiveAt)}</p>
          <p className={styles.hint}>{W.move.downHelp(PLAN_CONFIG[org.planId].label, money(state.preview.nextAmount, state.preview.currency), state.preview.billingCycle)}</p>
        </>
      )}

      {refusal?.code === 'band_too_small' && (
        <p>{W.move.tooSmall(target.label, refusal.teamLimit ?? target.teamLimit, org.name, refusal.activeTeams ?? 0)}</p>
      )}
      {refusal?.code === 'no_live_subscription' && (
        <p>{W.move.noSubscription(org.name, target.label, org.subscriptionPeriod === 'annual' ? target.annualPrice : target.monthlyPrice, org.subscriptionPeriod ?? 'monthly')}</p>
      )}
      {refusal?.code === 'plan_not_on_sale' && (
        <p>{W.move.notOnSale(target.label, org.name)}</p>
      )}
      {refusal && !['band_too_small', 'no_live_subscription', 'plan_not_on_sale'].includes(refusal.code) && (
        <PageNotice notice={{ tone: 'bad', text: refusal.error }} />
      )}
    </KitDialog>
  );
}

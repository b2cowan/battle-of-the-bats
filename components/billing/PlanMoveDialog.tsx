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
 *
 * PREMIUM → CLUB (Stage 4b, `inPlace`): the same window becomes the form where a Coaches Portal starts its club — a
 * required club name, the charge as lines that add up to "Due today", and (with no live subscription) a server quote for
 * checkout with a Monthly/Yearly choice. Several refusals are worded here rather than shown as the server's sentence.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import { CLUB_NAME_MAX, inPlaceReturnPath, isPremiumToClub, parseClubName, type ClubCheckoutPreview } from '@/lib/workspace-upgrade';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import PageNotice from '@/components/shared/PageNotice';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import styles from './Billing.module.css';
import LoadingState from '@/components/shared/LoadingState';
import FreeTimeBand from './FreeTimeBand';
import { BILLING_ADDRESS_FORM_WORDS, BILLING_LOCATION_WORDS } from '@/lib/billing-location';
import BillingAddressFields, { useAddressDraft } from './BillingAddressFields';
import { isAddressRefusal, useBillingAddressGate } from './BillingAddressDialog';
import addressStyles from './BillingAddress.module.css';

/** Where "Contact us" goes until a band is on sale (the Stage 8 flip) and above the largest band.
 *  The company's one inbox (owner 2026-09-26), the same address `lib/email.ts` falls back to. */
export const CONTACT_HREF = 'mailto:fieldlogichq@gmail.com';
type Preview =
  | { direction: 'up'; amountDueToday: number; currency: string; prorationDate: number; nextAmount: number; renewsAt: string | null; billingCycle: 'monthly' | 'annual'; lines: { kind: 'charge' | 'credit'; plan: OrgPlan; amount: number }[] | null }
  | { direction: 'down'; effectiveAt: string | null; nextAmount: number; currency: string; billingCycle: 'monthly' | 'annual' };
type Refusal = { code: string; error: string; activeTeams?: number; teamLimit?: number; endsAt?: string | null; checkout?: ClubCheckoutPreview };

/** Cents from the server, with the currency Stripe supplied. */
export function money(cents: number, currency = 'cad'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export default function PlanMoveDialog({ org, toPlan, returnTo, teamsHref, freeThrough = null, onClose, onMoved, onKeep }: {
  org: { slug: string; name: string; planId: OrgPlan; subscriptionPeriod?: 'monthly' | 'annual' };
  toPlan: OrgPlan; returnTo: string; teamsHref: string; freeThrough?: string | null;
  onClose: () => void; onMoved: (notice: string) => void;
  /** A waiting cancel refuses every move (Plans end at renewal): the billing page opens its Keep {Plan} window in place.
   *  Without it (Rep teams' team-limit window) the door goes to the billing page, which opens the same window. */
  onKeep?: () => void;
}) {
  const target = PLAN_CONFIG[toPlan];
  const inPlace = isPremiumToClub(org.planId, toPlan);
  const live = useRef(true);
  const busyRef = useRef(false);
  const leaving = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'preview'; preview: Preview } | { status: 'refused'; refusal: Refusal } | { status: 'finished' }>({ status: 'loading' });
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [clubName, setClubName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(org.subscriptionPeriod ?? 'monthly');
  const [revision, setRevision] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null);
  // GST/HST Stage 1. The club's billing address: in place, a block under the club name filled in from the coach's own home
  // address (drawing tab 5) and saved to the CLUB's row with the purchase; otherwise the Billing address window, opened when
  // the move or checkout says none is on file.
  const address = useBillingAddressGate({ orgSlug: org.slug });
  const clubAddress = useAddressDraft(null, address.info?.usSalesOpen ?? false);
  const prefilled = useRef(false);
  const homeAddress = address.info?.location ?? null;
  useEffect(() => {
    if (!inPlace || prefilled.current || !address.info) return;
    prefilled.current = true;
    // A slow answer must not overwrite what the coach has already typed for the club.
    if (homeAddress && !clubAddress.dirty) clubAddress.reset(homeAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the coach's address first arrives
  }, [inPlace, address.info, homeAddress]);
  const clubHold = inPlace && clubAddress.usClosed;
  /** In place: the name and the address, checked together on press; null when either needs fixing. */
  function checkedClub(): Record<string, unknown> | null {
    if (!inPlace) return {};
    const name = checkedName();
    const located = clubAddress.check();
    if (name === null || !located.ok) return null;
    return { clubName: name, billingAddress: clubAddress.body };
  }
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug: org.slug, planKey: toPlan, ...(inPlace ? { billingCycle: cycle } : {}) }),
    }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (stale) return;
      if (r.ok) setState({ status: 'preview', preview: d as Preview });
      else setState({ status: 'refused', refusal: { ...d, code: d.code ?? 'error', error: d.error ?? W.clubUpgrade.previewFailed } });
    }).catch(() => { if (!stale) setState({ status: 'refused', refusal: { code: 'network', error: W.clubUpgrade.previewFailed } }); });
    return () => { stale = true; };
  }, [org.slug, toPlan, inPlace, cycle, revision]);
  function retry() { setState({ status: 'loading' }); setFailure(null); setRevision(n => n + 1); }
  function checkedName(): string | null {
    if (!inPlace) return '';
    const parsed = parseClubName(clubName);
    if (parsed.ok) { setNameError(null); return parsed.name; }
    setNameError(parsed.code === 'club_name_required' ? W.clubUpgrade.nameEmpty : W.clubUpgrade.nameLong(CLUB_NAME_MAX));
    nameInput.current?.focus();
    return null;
  }
  function refusalText(refusal: Refusal): string {
    switch (refusal.code) {
      case 'payment_failing': return W.clubUpgrade.paymentFailing;
      case 'cannot_become_club': return refusal.error || W.clubUpgrade.cannotBecome;
      case 'club_name_invalid':
      case 'club_name_required': return W.clubUpgrade.nameEmpty;
      case 'club_name_too_long': return W.clubUpgrade.nameLong(CLUB_NAME_MAX);
      case 'stripe_error': return refusal.error || W.clubUpgrade.paymentProvider;
      case 'subscription_ending': return W.cancel.endingRefusal(org.planId, refusal.endsAt ?? null);
      default: return refusal.error;
    }
  }
  async function confirm() {
    if (state.status !== 'preview' || busyRef.current) return;
    const club = checkedClub();
    if (club === null) return;
    busyRef.current = true; setWorking(true); setFailure(null);
    let accepted = false;
    try {
      const res = await fetch('/api/billing/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: org.slug, planKey: toPlan,
          ...(state.preview.direction === 'up' ? { prorationDate: state.preview.prorationDate } : {}),
          ...club,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!live.current) return;
      if (!res.ok) {
        if (isAddressRefusal(d)) { address.refused(() => void confirm()); return; }
        if (inPlace && d.code === 'invalid_billing_address' && d.errors) { clubAddress.setErrors(d.errors); return; }
        // The move already landed (a lost answer, then a second try): the workspace is the club now, so finish on the setup screen.
        if (inPlace && d.code === 'not_a_move') { leaving.current = true; window.location.replace(inPlaceReturnPath(org.slug)); return; }
        // A band move keeps its figures on screen and says what went wrong; the Premium window has a door for each refusal.
        if (inPlace) setState({ status: 'refused', refusal: { ...d, code: d.code ?? 'error', error: d.error ?? W.errors.move } });
        else setFailure(d.error ?? W.errors.move);
        return;
      }
      setState({ status: 'finished' });
      accepted = true;
      // The page is about to leave for the setup screen: keep the window busy so it cannot be closed onto the old billing page.
      if (inPlace) leaving.current = true;
      onMoved(d.finishing ? W.clubUpgrade.finishing : state.preview.direction === 'up'
        ? W.move.moved(org.name, target.label) : W.move.scheduled(org.name, target.label, d.scheduled?.effectiveAt ?? null));
    } catch {
      if (live.current) setFailure(accepted ? W.clubUpgrade.finishing : W.errors.moveNetwork);
    } finally {
      if (live.current && !leaving.current) { busyRef.current = false; setWorking(false); }
    }
  }
  const refusal = state.status === 'refused' ? state.refusal : null;
  const quote = refusal?.code === 'no_live_subscription' ? refusal.checkout : undefined;
  async function paymentPortal() {
    if (busyRef.current) return;
    busyRef.current = true; setWorking(true); setFailure(null);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: org.slug, returnTo }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(W.errors.portal);
      if (!live.current) return;
      leaving.current = true;
      window.location.assign(data.url);
    } catch {
      leaving.current = false;
      if (live.current) setFailure(W.errors.portal);
    } finally {
      if (live.current && !leaving.current) { busyRef.current = false; setWorking(false); }
    }
  }
  async function checkout() {
    if (busyRef.current || (inPlace && !quote)) return;
    const club = checkedClub();
    if (club === null) return;
    busyRef.current = true; setWorking(true); setFailure(null);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: toPlan, billingCycle: quote?.billingCycle ?? org.subscriptionPeriod ?? 'monthly', orgSlug: org.slug, returnTo,
          ...club,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!live.current) return;
      if (!res.ok) {
        if (isAddressRefusal(d)) { address.refused(() => void checkout()); return; }
        if (inPlace && d.code === 'invalid_billing_address' && d.errors) { clubAddress.setErrors(d.errors); return; }
        if (d.code === 'subscription_exists') { retry(); return; }
        if (d.code === 'cannot_become_club') setState({ status: 'refused', refusal: d });
        else setFailure(refusalText({ ...d, code: d.code ?? 'error', error: d.error ?? W.errors.checkout }));
        return;
      }
      if (d.applied) { setState({ status: 'finished' }); onMoved(W.notice.updated(target.label, d.restoredCount, d.remainingRetainedCount)); return; }
      if (!d.url) { setFailure(W.errors.checkout); return; }
      leaving.current = true;
      window.location.assign(d.url);
    } catch {
      leaving.current = false;
      if (live.current) setFailure(W.errors.checkoutNetwork);
    } finally {
      if (live.current && !leaving.current) { busyRef.current = false; setWorking(false); }
    }
  }
  const cancel = inPlace
    ? <DialogCancel className={`btn btn-outline ${styles.desktopCancel}`}>{W.move.cancel}</DialogCancel>
    : <button type="button" className="btn btn-outline" onClick={onClose} disabled={working}>{W.move.cancel}</button>;
  const preview = state.status === 'preview' ? state.preview : null;
  const canCheckout = refusal?.code === 'no_live_subscription' && (!inPlace || !!quote);
  const retryable = refusal && (refusal.code === 'no_live_subscription' ? inPlace && !quote : !['band_too_small', 'plan_not_on_sale', 'payment_failing', 'cannot_become_club', 'subscription_ending'].includes(refusal.code));
  const footer = <>
    {cancel}
    {preview && !clubHold && <button type="button" className="btn btn-lime" onClick={() => void confirm()} disabled={working} data-autofocus="">{working ? inPlace ? W.clubUpgrade.starting : W.move.moving : inPlace ? W.clubUpgrade.start : W.change.move(target.label)}</button>}
    {canCheckout && !clubHold && <button type="button" className="btn btn-lime" onClick={() => void checkout()} disabled={working}>{working ? W.plan.openingCheckout : W.move.checkout}</button>}
    {refusal?.code === 'band_too_small' && <Link href={teamsHref} className="btn btn-lime">{W.move.repTeams}</Link>}
    {refusal?.code === 'plan_not_on_sale' && <a href={CONTACT_HREF} className="btn btn-lime">{W.change.contact}</a>}
    {refusal?.code === 'subscription_ending' && (onKeep
      ? <button type="button" className="btn btn-lime" onClick={onKeep} disabled={working}>{W.cancel.keepDoor(org.planId)}</button>
      : <a className="btn btn-lime" href={`${returnTo}?keep_plan=1`}>{W.cancel.keepDoor(org.planId)}</a>)}
    {refusal?.code === 'payment_failing' && <button type="button" className="btn btn-lime" onClick={() => void paymentPortal()} disabled={working}>{W.plan.payment}</button>}
    {refusal?.code === 'cannot_become_club' && <a href={CONTACT_HREF} className="btn btn-lime">{W.change.contact}</a>}
    {retryable && <button type="button" className="btn btn-lime" onClick={retry}>{W.clubUpgrade.checkAgain}</button>}
  </>;
  const foot = !inPlace ? undefined : state.status === 'finished' ? W.clubUpgrade.finishing : quote ? W.clubUpgrade.checkoutFoot : preview?.direction === 'up' ? W.clubUpgrade.payingFoot : undefined;
  // The Billing address window takes this window's place while it is open (the move or checkout found no address on file).
  if (address.open) return address.dialog;
  return <KitDialog kind={inPlace ? 'form' : 'question'} title={inPlace ? W.clubUpgrade.title : W.move.title(target.label)}
    onClose={onClose} busy={working} dirty={inPlace && (clubName.trim().length > 0 || clubAddress.dirty) && state.status !== 'finished'} openOn={inPlace ? 'panel' : 'field'}
    footerStart={clubHold && (preview || quote) ? <span className={addressStyles.amber}>{BILLING_LOCATION_WORDS.usClosed}</span> : foot ? <span>{foot}</span> : undefined}
    footer={state.status === 'finished' ? null : footer}>
    {failure && <PageNotice notice={{ tone: 'bad', text: failure }} />}
    {state.status === 'loading' && <LoadingState inline label={W.move.loading} />}
    {state.status === 'finished' && <PageNotice notice={{ tone: 'good', text: W.clubUpgrade.finishing }} />}
    {inPlace && (preview || quote) && <>
      {quote && <FreeTimeBand band={{ tone: 'amber', eyebrow: W.page.sections.plan, title: W.clubUpgrade.freeTitle(), text: W.clubUpgrade.freeWarning(freeThrough) }} />}
      {quote && <p>{quote.trialDays > 0 ? W.clubUpgrade.trial(quote.trialDays) : W.clubUpgrade.noTrial}</p>}
      <p>{W.clubUpgrade.owner}</p>
      <div className={`${styles.field} ${styles.reviewField}`}>
        <label className={styles.label} htmlFor="upgrade-club-name">{W.clubUpgrade.name} <span aria-hidden>*</span></label>
        {/* HTML counts UTF-16 units; the change handler and server both cap at forty Unicode characters. */}
        <input ref={nameInput} id="upgrade-club-name" className={styles.select} value={clubName} required maxLength={CLUB_NAME_MAX * 2}
          placeholder={W.clubUpgrade.namePlaceholder} aria-invalid={Boolean(nameError)} aria-describedby="upgrade-name-help"
          onChange={event => { setClubName(Array.from(event.target.value).slice(0, CLUB_NAME_MAX).join('')); setNameError(null); }} disabled={working} />
        <p id="upgrade-name-help" className={styles.hint} role={nameError ? 'alert' : undefined}>{nameError ?? W.clubUpgrade.nameHelp}</p>
      </div>
      <div className={addressStyles.clubBlock} role="group" aria-labelledby="upgrade-billing-address">
        <p id="upgrade-billing-address" className={addressStyles.subhead}>{BILLING_ADDRESS_FORM_WORDS.clubSubhead}</p>
        {homeAddress && <p className={styles.hint}>{BILLING_ADDRESS_FORM_WORDS.clubPrefilled}</p>}
        <BillingAddressFields form={clubAddress} idPrefix="upgrade-billing"
          subject={{ kind: 'club', name: clubName.trim() || org.name }} disabled={working} />
      </div>
      <div className={styles.upgradeAddress}><span>{W.clubUpgrade.address}</span><span>{W.clubUpgrade.addressValue(org.slug)}</span><p className={styles.hint}>{W.clubUpgrade.addressHelp}</p></div>
      {quote && quote.trialDays > 0 && <div className={styles.cycle} role="group" aria-label={W.clubUpgrade.billing}>
        {(['monthly', 'annual'] as const).map(value => <button key={value} type="button" aria-pressed={cycle === value} disabled={working} onClick={() => { if (value === cycle) return; setState({ status: 'loading' }); setCycle(value); }}>{value === 'monthly' ? W.clubUpgrade.monthly : W.clubUpgrade.yearly}</button>)}
      </div>}
    </>}
    {preview?.direction === 'up' && <>
      {!inPlace && <p>{W.move.up(org.name, target.label, target.teamLimit)}</p>}
      <dl className={styles.figures}>
        {inPlace && preview.lines?.map((line, index) => <div key={index} className={line.kind === 'credit' ? styles.credit : undefined}><dt>{line.kind === 'charge' ? W.clubUpgrade.charge(PLAN_CONFIG[line.plan].label) : W.clubUpgrade.credit(PLAN_CONFIG[line.plan].label)}</dt><dd>{line.kind === 'credit' ? '−' : ''}{W.clubUpgrade.amount(money(line.amount, preview.currency), preview.currency)}</dd></div>)}
        <div><dt>{inPlace ? W.clubUpgrade.dueToday : W.move.today}</dt><dd>{W.clubUpgrade.amount(money(preview.amountDueToday, preview.currency), preview.currency)}</dd></div>
        <div><dt>{W.move.from(preview.renewsAt)}</dt><dd>{W.clubUpgrade.renewal(money(preview.nextAmount, preview.currency), preview.billingCycle, preview.currency)}</dd></div>
      </dl>
      <p className={styles.hint}>{inPlace ? W.clubUpgrade.billingKept(preview.billingCycle) : W.move.previewHelp}</p>
    </>}
    {quote && <dl className={styles.figures}>
      <div><dt>{W.clubUpgrade.dueToday}</dt><dd>{W.clubUpgrade.amount(money(quote.amountDueToday, quote.currency), quote.currency)}</dd></div>
      <div><dt>{quote.trialDays > 0 ? W.clubUpgrade.firstCharge(quote.firstChargeAt) : W.move.from(quote.renewsAt)}</dt><dd>{W.clubUpgrade.renewal(money(quote.nextAmount, quote.currency), quote.billingCycle, quote.currency)}</dd></div>
    </dl>}
    {preview?.direction === 'down' && <><p>{W.move.down(org.name, target.label, target.teamLimit, preview.effectiveAt)}</p><p className={styles.hint}>{W.move.downHelp(PLAN_CONFIG[org.planId].label, money(preview.nextAmount, preview.currency), preview.billingCycle)}</p></>}
    {refusal?.code === 'band_too_small' && <p>{W.move.tooSmall(target.label, refusal.teamLimit ?? target.teamLimit, org.name, refusal.activeTeams ?? 0)}</p>}
    {refusal?.code === 'no_live_subscription' && !quote && !inPlace && <p>{W.move.noSubscription(org.name, target.label, org.subscriptionPeriod === 'annual' ? target.annualPrice : target.monthlyPrice, org.subscriptionPeriod ?? 'monthly')}</p>}
    {refusal?.code === 'no_live_subscription' && !quote && inPlace && <PageNotice notice={{ tone: 'bad', text: W.clubUpgrade.previewFailed }} />}
    {refusal?.code === 'plan_not_on_sale' && <p>{W.move.notOnSale(target.label, org.name)}</p>}
    {refusal && !['band_too_small', 'no_live_subscription', 'plan_not_on_sale'].includes(refusal.code) && <PageNotice notice={{ tone: 'bad', text: refusalText(refusal) }} />}
  </KitDialog>;
}

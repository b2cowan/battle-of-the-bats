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
 *
 * GST/HST STAGE 2 PART 3 (drawings tabs 2–4, ruled 2026-11-05): every figure to pay shows its tax by name above Due today, and
 * Due today is what the card is charged. In place, the quote is for the club address typed in this window: changing the country
 * or province loads the charge again once the address passes its check, with the name and address kept on screen (only the
 * figures wait). Pressing the button works the charge out once more, and a charge that changed is not made: the window shows the
 * new figures and asks for a second press.
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
import { BILLING_ADDRESS_FORM_WORDS, BILLING_ADDRESS_REQUIRED, BILLING_LOCATION_WORDS, checkBillingLocation } from '@/lib/billing-location';
import BillingAddressFields, { useAddressDraft } from './BillingAddressFields';
import { isAddressRefusal, useBillingAddressGate } from './BillingAddressDialog';
// A held account (GST/HST Stage 2 Ask 1) shows the server's sentence with no "Check again": asking again cannot change it.
import { BILLING_REVIEW_HOLD, type QuoteTax } from '@/lib/billing-tax';
import addressStyles from './BillingAddress.module.css';
import PlanTermsLine from '@/components/legal/PlanTermsLine';
import { useTermsGate } from '@/components/legal/TermsAcceptWindow';

/** Where "Contact us" goes until a band is on sale (the Stage 8 flip) and above the largest band.
 *  The company's one inbox (owner 2026-09-26), the same address `lib/email.ts` falls back to. */
export const CONTACT_HREF = 'mailto:fieldlogichq@gmail.com';
type Preview =
  | { direction: 'up'; amountDueToday: number; currency: string; prorationDate: number; nextAmount: number; renewsAt: string | null; billingCycle: 'monthly' | 'annual'; lines: { kind: 'charge' | 'credit'; plan: OrgPlan; amount: number }[] | null; tax: QuoteTax }
  | { direction: 'down'; effectiveAt: string | null; nextAmount: number; currency: string; billingCycle: 'monthly' | 'annual' };
type Refusal = { code: string; error: string; activeTeams?: number; teamLimit?: number; endsAt?: string | null; checkout?: ClubCheckoutPreview };
/** Where the figures to pay stand: shown, loading again, waiting for a complete address, or not worked out by Stripe. */
type Figures = 'ready' | 'loading' | 'waits' | 'failed';

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
  // `key` names the question an answer was for (the cycle, a Check again, the address quoted), so a new question keeps the
  // window as it was and only the figures show that they are loading again.
  const [state, setState] = useState<{ status: 'loading' } | { status: 'preview'; preview: Preview; key: string } | { status: 'refused'; refusal: Refusal; key: string } | { status: 'finished' }>({ status: 'loading' });
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** The press-time check found a different charge (amber, drawing tab 3 frame 4). */
  const [changed, setChanged] = useState<string | null>(null);
  const [clubName, setClubName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(org.subscriptionPeriod ?? 'monthly');
  const [revision, setRevision] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null);
  // GST/HST Stage 1. The club's billing address: in place, a block under the club name filled in from the coach's own home
  // address (drawing tab 5) and saved to the CLUB's row with the purchase; otherwise the Billing address window, opened when
  // the move or checkout says none is on file.
  const address = useBillingAddressGate({ orgSlug: org.slug });
  // A person who has not agreed to the current Terms: the move or the checkout stops, the Terms window opens OVER this one, and
  // after the tick the same request is sent again (GST/HST Stage 6 step 6.3, C3; drawing tab 6, Ask 5A).
  const terms = useTermsGate();
  const clubAddress = useAddressDraft(null, address.info?.usSalesOpen ?? false);
  const homeAddress = address.info?.location ?? null;
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!inPlace || prefilled || !address.info) return;
    // A slow answer must not overwrite what the coach has already typed for the club.
    if (homeAddress && !clubAddress.dirty) clubAddress.reset(homeAddress);
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the coach's address first arrives
  }, [inPlace, address.info, homeAddress]);
  // A failed read of the home address leaves the block empty to type into; the quote must not wait for it forever.
  const [addressRead, setAddressRead] = useState(false);
  useEffect(() => {
    if (!inPlace) return;
    let gone = false;
    void address.load().then(() => { if (!gone) setAddressRead(true); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [inPlace]);
  // GST/HST Stage 2 Part 3: the club address the in-place quote is for. Only the country and province set the rate, so a new
  // quote is asked when they differ from the last one asked AND the address passes its check; typing in the street or city
  // asks nothing (drawing tab 3, "How it behaves"). The first quote waits for the prefill, so it is asked once, for it.
  const typed = inPlace ? checkBillingLocation(clubAddress.draft, { usSalesOpen: address.info?.usSalesOpen ?? false }) : null;
  const typedKey = typed?.ok ? `${typed.value.country}|${typed.value.regionCode}` : null;
  const [quoteFor, setQuoteFor] = useState<{ key: string; body: typeof clubAddress.body } | null>(null);
  const quoteSyncing = typedKey !== null && typedKey !== quoteFor?.key;
  useEffect(() => {
    if (quoteSyncing && typedKey) setQuoteFor({ key: typedKey, body: clubAddress.body });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the body is read when the key changes, never on its own
  }, [quoteSyncing, typedKey]);
  const quoteReady = !inPlace || ((prefilled || (addressRead && !address.info)) && !quoteSyncing);
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
  const requestKey = `${cycle}|${revision}|${quoteFor?.key ?? ''}`;
  useEffect(() => {
    if (!quoteReady) return;
    let stale = false;
    const key = `${cycle}|${revision}|${quoteFor?.key ?? ''}`;
    fetch('/api/billing/move/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug: org.slug, planKey: toPlan, ...(inPlace ? { billingCycle: cycle, ...(quoteFor ? { billingAddress: quoteFor.body } : {}) } : {}) }),
    }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (stale) return;
      // A new quote replaces any "the charge changed" sentence: it was about the figures this one replaces.
      if (r.ok) { setState({ status: 'preview', preview: d as Preview, key }); setChanged(null); }
      else setState({ status: 'refused', refusal: { ...d, code: d.code ?? 'error', error: d.error ?? W.clubUpgrade.previewFailed }, key });
    }).catch(() => { if (!stale) setState({ status: 'refused', refusal: { code: 'network', error: W.clubUpgrade.previewFailed }, key }); });
    return () => { stale = true; };
  }, [org.slug, toPlan, inPlace, cycle, revision, quoteFor, quoteReady]);
  /** A Check again keeps the window as it is when it has figures to show (only the figures load again). */
  function retry() {
    if (state.status !== 'preview' && !(state.status === 'refused' && state.refusal.checkout)) setState({ status: 'loading' });
    setFailure(null); setChanged(null); setRevision(n => n + 1);
  }
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
    if (state.status !== 'preview' || busyRef.current || figures !== 'ready') return;
    const club = checkedClub();
    if (club === null) return;
    busyRef.current = true; setWorking(true); setFailure(null); setChanged(null);
    let accepted = false;
    try {
      const res = await terms.send('/api/billing/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: org.slug, planKey: toPlan,
          ...(state.preview.direction === 'up' ? { prorationDate: state.preview.prorationDate, expectedAmountDue: state.preview.amountDueToday } : {}),
          ...club,
        }),
      });
      if (!res) return; // the Terms window was closed: this window stays as it was
      const d = await res.json().catch(() => ({}));
      if (!live.current) return;
      if (!res.ok) {
        if (isAddressRefusal(d)) { address.refused(() => void confirm()); return; }
        if (inPlace && d.code === 'invalid_billing_address' && d.errors) { clubAddress.setErrors(d.errors); return; }
        // Nothing was charged: the new figures replace the old ones, and the owner presses again (tab 3, frame 4).
        if (d.code === 'charge_changed' && d.preview) { setState({ status: 'preview', preview: d.preview as Preview, key: requestKey }); setChanged(d.error ?? null); return; }
        // The club's address didn't reach Stripe: nothing changed, the figures stay, and pressing again retries (tab 3, frame 6).
        if (d.code === 'billing_address_stamp_failed') { setFailure(d.error ?? W.errors.move); return; }
        // The move already landed (a lost answer, then a second try): the workspace is the club now, so finish on the setup screen.
        if (inPlace && d.code === 'not_a_move') { leaving.current = true; window.location.replace(inPlaceReturnPath(org.slug)); return; }
        // A band move keeps its figures on screen and says what went wrong; the Premium window has a door for each refusal.
        if (inPlace) setState({ status: 'refused', refusal: { ...d, code: d.code ?? 'error', error: d.error ?? W.errors.move }, key: requestKey });
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
  // GST/HST Stage 2 Part 3: the figures to pay, and where they stand. Only a charge made today carries tax (a move up, or a
  // checkout with no trial); a move down and a trial charge nothing today, so they show as they always have.
  const answered = state.status === 'preview' || state.status === 'refused' ? state.key : null;
  const charged = state.status === 'preview' && state.preview.direction === 'up' ? state.preview : quote && quote.trialDays === 0 ? quote : null;
  const tax = charged ? charged.tax : null;
  const figures: Figures = answered !== null && (answered !== requestKey || quoteSyncing) ? 'loading'
    : !tax ? 'ready'
    : tax.status === 'not_worked_out' ? 'failed'
    // In place, the answer is for the place it was ASKED for (the request key carries it), never for whatever Stripe echoed back:
    // a figure shows only while the typed country and province are still that place (/review 2026-11-05).
    : tax.status === 'needs_address' || (inPlace && `${clubAddress.draft.country.trim().toUpperCase()}|${clubAddress.draft.regionCode.trim().toUpperCase()}` !== quoteFor?.key) ? 'waits'
    : 'ready';
  const taxLines = tax?.status === 'taxed' ? tax.lines : [];
  const beforeTax = tax?.status === 'taxed' ? tax.beforeTax : null;
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
    if (busyRef.current || (inPlace && !quote) || figures !== 'ready') return;
    const club = checkedClub();
    if (club === null) return;
    busyRef.current = true; setWorking(true); setFailure(null);
    try {
      const res = await terms.send('/api/billing/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: toPlan, billingCycle: quote?.billingCycle ?? org.subscriptionPeriod ?? 'monthly', orgSlug: org.slug, returnTo,
          ...club,
        }),
      });
      if (!res) return; // the Terms window was closed: this window stays as it was
      const d = await res.json().catch(() => ({}));
      if (!live.current) return;
      if (!res.ok) {
        if (isAddressRefusal(d)) { address.refused(() => void checkout()); return; }
        if (inPlace && d.code === 'invalid_billing_address' && d.errors) { clubAddress.setErrors(d.errors); return; }
        if (d.code === 'subscription_exists') { retry(); return; }
        if (d.code === 'cannot_become_club') setState({ status: 'refused', refusal: d, key: requestKey });
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
  // No address on file for a band move: the Billing address window, which comes back here with the figures once saved.
  const retryable = figures === 'failed' || (refusal && (refusal.code === 'no_live_subscription' ? inPlace && !quote : !['band_too_small', 'plan_not_on_sale', 'payment_failing', 'cannot_become_club', 'subscription_ending', BILLING_REVIEW_HOLD, BILLING_ADDRESS_REQUIRED].includes(refusal.code)));
  const payWaits = working || figures !== 'ready';
  const footer = <>
    {cancel}
    {preview && !clubHold && figures !== 'failed' && <button type="button" className="btn btn-lime" onClick={() => void confirm()} disabled={payWaits} data-autofocus="">{working ? inPlace ? W.clubUpgrade.starting : W.move.moving : inPlace ? W.clubUpgrade.start : W.change.move(target.label)}</button>}
    {canCheckout && !clubHold && figures !== 'failed' && <button type="button" className="btn btn-lime" onClick={() => void checkout()} disabled={payWaits}>{working ? W.plan.openingCheckout : W.move.checkout}</button>}
    {refusal?.code === BILLING_ADDRESS_REQUIRED && <button type="button" className="btn btn-lime" onClick={() => address.refused(retry)}>{W.move.addressDoor}</button>}
    {refusal?.code === 'band_too_small' && <Link href={teamsHref} className="btn btn-lime">{W.move.repTeams}</Link>}
    {refusal?.code === 'plan_not_on_sale' && <a href={CONTACT_HREF} className="btn btn-lime">{W.change.contact}</a>}
    {refusal?.code === 'subscription_ending' && (onKeep
      ? <button type="button" className="btn btn-lime" onClick={onKeep} disabled={working}>{W.cancel.keepDoor(org.planId)}</button>
      : <a className="btn btn-lime" href={`${returnTo}?keep_plan=1`}>{W.cancel.keepDoor(org.planId)}</a>)}
    {refusal?.code === 'payment_failing' && <button type="button" className="btn btn-lime" onClick={() => void paymentPortal()} disabled={working}>{W.plan.payment}</button>}
    {refusal?.code === 'cannot_become_club' && <a href={CONTACT_HREF} className="btn btn-lime">{W.change.contact}</a>}
    {retryable && <button type="button" className="btn btn-lime" onClick={retry}>{W.clubUpgrade.checkAgain}</button>}
  </>;
  const foot = !inPlace ? undefined : state.status === 'finished' ? W.clubUpgrade.finishing : figures === 'failed' ? undefined : quote ? W.clubUpgrade.checkoutFoot : preview?.direction === 'up' ? W.clubUpgrade.payingFoot : undefined;
  // While the charge loads again the footer says so too: on a phone the figures are below the fold and the footer never is.
  const amount = (cents: number, currency: string) => W.clubUpgrade.amount(money(cents, currency), currency);
  const taxRows = (currency: string) => taxLines.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{amount(line.cents, currency)}</dd></div>);
  const renewalRow = (dt: string, cents: number, billing: 'monthly' | 'annual', currency: string) =>
    <div><dt>{dt}</dt><dd>{W.clubUpgrade.renewal(money(cents, currency), billing, currency)}<small>{W.move.plusTax}</small></dd></div>;
  const figureNote = figures === 'loading' ? <LoadingState inline label={W.move.loadingCharge} />
    : figures === 'waits' ? (clubHold ? null : <p className={styles.hint}>{W.move.chargeWaits}</p>)
    : figures === 'failed' && tax?.status === 'not_worked_out' ? <PageNotice notice={{ tone: 'bad', text: tax.error }} />
    : null;
  // The Billing address window takes this window's place while it is open (the move or checkout found no address on file).
  if (address.open) return address.dialog;
  // §20 (3) ends the body whenever a paid button is in the foot (drawing tab 5, pins 2 and 3): the move (up, or down at renewal)
  // or the checkout. The trial sentence first only where this window already says a trial applies.
  const paidButton = !clubHold && figures !== 'failed' && (preview !== null || canCheckout);
  return <><KitDialog kind={inPlace ? 'form' : 'question'} title={inPlace ? W.clubUpgrade.title : W.move.title(target.label)}
    onClose={onClose} busy={working} dirty={inPlace && (clubName.trim().length > 0 || clubAddress.dirty) && state.status !== 'finished'} openOn={inPlace ? 'panel' : 'field'}
    footerStart={clubHold && (preview || quote) ? <span className={addressStyles.amber}>{BILLING_LOCATION_WORDS.usClosed}</span>
      : figures === 'loading' && inPlace ? <LoadingState inline label={W.move.loadingCharge} />
      : foot ? <span>{foot}</span> : undefined}
    footer={state.status === 'finished' ? null : footer}>
    {failure && <PageNotice notice={{ tone: 'bad', text: failure }} />}
    {changed && <p className={styles.waitCallout} role="status">{changed}</p>}
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
        {(['monthly', 'annual'] as const).map(value => <button key={value} type="button" aria-pressed={cycle === value} disabled={working} onClick={() => { if (value !== cycle) setCycle(value); }}>{value === 'monthly' ? W.clubUpgrade.monthly : W.clubUpgrade.yearly}</button>)}
      </div>}
    </>}
    {preview?.direction === 'up' && <>
      {!inPlace && <p>{W.move.up(org.name, target.label, target.teamLimit)}</p>}
      {figures === 'ready' ? <dl className={styles.figures}>
        {inPlace && preview.lines?.map((line, index) => <div key={index} className={line.kind === 'credit' ? styles.credit : undefined}><dt>{line.kind === 'charge' ? W.clubUpgrade.charge(PLAN_CONFIG[line.plan].label) : W.clubUpgrade.credit(PLAN_CONFIG[line.plan].label)}</dt><dd>{line.kind === 'credit' ? '−' : ''}{amount(line.amount, preview.currency)}</dd></div>)}
        {/* A band move's one figure becomes the amount before tax, then the tax, then Due today (tab 2). No tax (a US buyer) keeps the one row. */}
        {!inPlace && taxLines.length > 0 && beforeTax !== null && <div><dt>{W.move.today}</dt><dd>{amount(beforeTax, preview.currency)}</dd></div>}
        {taxRows(preview.currency)}
        <div><dt>{inPlace || taxLines.length > 0 ? W.clubUpgrade.dueToday : W.move.today}</dt><dd>{amount(preview.amountDueToday, preview.currency)}</dd></div>
        {renewalRow(W.move.from(preview.renewsAt), preview.nextAmount, preview.billingCycle, preview.currency)}
      </dl> : figureNote}
      <p className={styles.hint}>{inPlace ? W.clubUpgrade.billingKept(preview.billingCycle) : W.move.previewHelp}</p>
    </>}
    {quote && (figures === 'ready' ? <dl className={styles.figures}>
      {/* No trial: the first period before tax, the tax, then Due today, for the typed club address (tab 4). */}
      {taxLines.length > 0 && beforeTax !== null && <div><dt>{W.clubUpgrade.firstPeriod(PLAN_CONFIG[quote.toPlan].label, quote.billingCycle)}</dt><dd>{amount(beforeTax, quote.currency)}</dd></div>}
      {taxRows(quote.currency)}
      <div><dt>{W.clubUpgrade.dueToday}</dt><dd>{amount(quote.amountDueToday, quote.currency)}</dd></div>
      {renewalRow(quote.trialDays > 0 ? W.clubUpgrade.firstCharge(quote.firstChargeAt) : W.move.from(quote.renewsAt), quote.nextAmount, quote.billingCycle, quote.currency)}
    </dl> : figureNote)}
    {preview?.direction === 'down' && <><p>{W.move.down(org.name, target.label, target.teamLimit, preview.effectiveAt)}</p><p className={styles.hint}>{W.move.downHelp(PLAN_CONFIG[org.planId].label, money(preview.nextAmount, preview.currency), preview.billingCycle)}</p></>}
    {refusal?.code === 'band_too_small' && <p>{W.move.tooSmall(target.label, refusal.teamLimit ?? target.teamLimit, org.name, refusal.activeTeams ?? 0)}</p>}
    {refusal?.code === 'no_live_subscription' && !quote && !inPlace && <p>{W.move.noSubscription(org.name, target.label, org.subscriptionPeriod === 'annual' ? target.annualPrice : target.monthlyPrice, org.subscriptionPeriod ?? 'monthly')}</p>}
    {refusal?.code === 'no_live_subscription' && !quote && inPlace && <PageNotice notice={{ tone: 'bad', text: W.clubUpgrade.previewFailed }} />}
    {refusal?.code === 'plan_not_on_sale' && <p>{W.move.notOnSale(target.label, org.name)}</p>}
    {refusal && !['band_too_small', 'no_live_subscription', 'plan_not_on_sale'].includes(refusal.code) && <PageNotice notice={{ tone: 'bad', text: refusalText(refusal) }} />}
    {paidButton && <PlanTermsLine trial={quote && quote.trialDays > 0 ? 'known' : undefined} />}
  </KitDialog>{terms.window}</>;
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import StartSteps from '@/components/auth/StartSteps';
import { StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import ChoicePair from '@/components/shared/ChoicePair';
import PlanTermsLine from '@/components/legal/PlanTermsLine';
import { useLegalLinks } from '@/components/legal/LegalLinksProvider';
import { PLAN_CONFIG, formatPlanPeriodPrice, pickedPlanLabel } from '@/lib/plan-config';
import { planTermsTrial, planTrialLine } from '@/lib/plan-trial-line';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import { PLAN_BILLING_WORDS } from '@/lib/plan-billing-words';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';
import {
  PAID_DOOR_STEPS, paidDoorPick,
  type StartBilling, type StartPaidPlan, type StartPlanCard, type StartPlanOffer, type StartPricing,
} from '@/lib/start-door';
import { ComparePlansLink, PlanStartButton } from './PlanStepParts';
import styles from './PlanStep.module.css';

/**
 * THE PAID DOORS' PLAN STEP (On-sale pages S2, drawings tabs 6 and 7, words CLUB_ON_SALE_COPY.md W48 and W53). Step 3 of
 * Start a club (Club and Club · Association side by side, by how many teams the club runs) and of Start a league season
 * (League Plus, one card). Its own component beside Run a tournament's `PlanStep`, on the same pieces and styles, so
 * neither door's plan step can change the other's by accident.
 *
 * Every trial it states is the SERVER's answer for this organization (`/api/billing/start-plan`, trap B): a customer
 * that has held a subscription is told before checkout that there is no second trial. Every figure comes from
 * plan-config; nothing here decides a price (checkout does). The pick from the pricing page leads, preselected (the
 * olive edge and the one lime); with no pick the door's first plan leads.
 */

const CLUB = PLAN_CONFIG.club;
const ASSOCIATION = PLAN_CONFIG.club_large;
const POINTS: Record<StartPaidPlan, readonly string[]> = {
  // The team limit is defined by what the club gets (a Premium Coaches Portal per team), never by a team label, and house
  // league teams are unlimited (BUSINESS_DECISIONS.md 2026-11-19).
  club: ['Tournaments, house league, rep teams and accounting', `Premium Coaches Portal for every coach on up to ${CLUB.teamLimit} teams, no per-team fee`, 'Unlimited house league teams'],
  club_large: ['Everything in Club', `Premium Coaches Portal for every coach on ${CLUB.teamLimit + 1} to ${ASSOCIATION.teamLimit} teams`, 'Move up from Club at any time'],
  league: ['Registration, divisions, seasons and standings', 'A public site for your league', 'Everything in Tournament Plus'],
};

/** The line under the Club heading: the unit the question counts, and the one place the team labels are listed. */
const TEAM_COUNT_NOTE = 'Rep, select, all-star: whatever your club calls them. House league teams are unlimited.';

// "Plan & billing" and a plan's name never break across lines (/design 2026-11-19): non-breaking spaces inside them.
const PLAN_AND_BILLING = 'Plan & billing';
/** A plan label's " · " with non-breaking spaces either side. */
const keepTogether = (label: string) => label.replace(' · ', ' · ');

export default function PaidPlanStep({ orgName, offer, pricing, initialBilling, loading, error, onChoose }: {
  orgName: string;
  offer: StartPlanOffer;
  /** The pricing page's pick; a pick this door does not sell reads as none. */
  pricing: StartPricing | null;
  /** Back from the billing address screen: the monthly or yearly choice made there. */
  initialBilling?: StartBilling | null;
  loading: string | null;
  error: string;
  onChoose: (plan: StartPaidPlan, billing: StartBilling) => void;
}) {
  const pick = paidDoorPick(offer.door, pricing);
  const pickOnSale = pick && offer.cards.some(card => card.plan === pick.plan) ? pick : null;
  const [billing, setBilling] = useState<StartBilling>(initialBilling ?? pickOnSale?.billing ?? 'monthly');
  const legalOn = useLegalLinks() !== null;
  const club = offer.door === 'club';
  const lead = pickOnSale?.plan ?? offer.cards[0]?.plan ?? null;
  const cards = lead ? [...offer.cards].sort((a, b) => (a.plan === lead ? -1 : b.plan === lead ? 1 : 0)) : offer.cards;
  const busy = loading !== null;

  const pickedName = pickOnSale ? keepTogether(pickedPlanLabel(pickOnSale.plan, pickOnSale.billing)) : '';
  const sub = pickOnSale
    ? club
      ? <>You picked <strong>{pickedName}</strong> on the pricing page. You can change it here, or any time in {PLAN_AND_BILLING}.</>
      : <>You picked <strong>{pickedName}</strong> on the pricing page.</>
    : club
      ? <>{orgName} starts on one of these. You can move between the two in {PLAN_AND_BILLING}.</>
      : <>{orgName} starts on League Plus. You manage it in {PLAN_AND_BILLING}.</>;

  function card({ plan, trialDays, returning }: StartPlanCard) {
    const config = PLAN_CONFIG[plan];
    const leads = plan === lead;
    const id = `paid-plan-${plan}`;
    const options = [
      { value: 'monthly', label: formatPlanPeriodPrice(plan, 'monthly') },
      { value: 'annual', label: formatPlanPeriodPrice(plan, 'annual') },
    ] as const;
    return (
      <section key={plan} className={leads ? styles.cardOn : styles.card} aria-labelledby={id}>
        <div className={styles.cardHead}>
          <h2 id={id} className={styles.name}>{config.label}</h2>
          <span className={styles.price}>{formatPlanPeriodPrice(plan, billing)}</span>
        </div>
        {/* The currency is said here too: the email link often opens step 2 on another device, so step 1's line was never seen. */}
        <p className={styles.note}>CAD, {BILLING_TAX_WORDS.plusTax}</p>
        {/* The server's answer for THIS organization: a trial, no second trial, or (history unread) nothing claimed. */}
        {trialDays !== null && trialDays > 0 && <p className={styles.trial}>{planTrialLine(trialDays)}</p>}
        {trialDays === 0 && returning === true && <p className={styles.trial}>{PLAN_BILLING_WORDS.clubUpgrade.noTrial}</p>}
        <ul className={styles.points}>{POINTS[plan].map(p => <li key={p}>{p}</li>)}</ul>
        <span className={`${accountForm.label} ${styles.billingLabel}`} id={`${id}-billing`}>Billing</span>
        <ChoicePair labelledBy={`${id}-billing`} value={billing} options={options} onChange={setBilling} disabled={busy} />
        {/* Step 1's tick was made before the club had a name: say whose Terms these are (`/legal` S2 review, 1(c)). */}
        {legalOn && (
          <p className={styles.behalf}>
            You’re starting this plan for {orgName}, and you confirm you’re allowed to agree to the Terms on its behalf.
          </p>
        )}
        <PlanTermsLine place="column" trial={planTermsTrial(trialDays, config.trialDays)} />
        <PlanStartButton lead={leads} busy={busy} starting={loading === plan} onClick={() => onChoose(plan, billing)}>
          {/* Only a trial the server confirmed is named on the button (an unread history promises nothing). */}
          {trialDays !== null && trialDays > 0 ? `Start your ${config.label} trial` : `Start ${config.label}`}
        </PlanStartButton>
      </section>
    );
  }

  return (
    <div className={`${accountForm.page} ${styles.page}`}>
      <div className={club ? styles.column : `${styles.column} ${styles.columnOne}`}>
        <StartHead
          title={club ? 'How many teams will have a Premium Coaches Portal?' : 'Start League Plus'}
          sub={<>
            {club && <span className={styles.sub}>{TEAM_COUNT_NOTE}</span>}
            <span className={styles.sub}>{sub}</span>
          </>}
          steps={<StartSteps current={3} labels={PAID_DOOR_STEPS[offer.door]} />}
        />
        {cards.length > 0
          ? <div className={club ? styles.choices : styles.choicesOne}>{cards.map(card)}</div>
          : <>
              <p className={accountForm.callout} role="status">{club ? 'Club' : 'League Plus'} isn’t open for sign-up right now. {orgName} is saved, and you can come back to this step.</p>
              {/* A way out of a page with no navigation (/review 2026-11-19). */}
              <Link href="/discover" className={`${accountForm.secondary} ${styles.start}`}>Go to Home</Link>
            </>}
        {error && <p className={`${accountForm.error} ${styles.error}`} role="alert">{error}</p>}
        <StartFoot>
          <p>
            {club && <>More than {ASSOCIATION.teamLimit} teams? Email <a href={`mailto:${FIELDLOGICHQ_CONTACT_EMAIL}`} className={accountForm.footLink}>{FIELDLOGICHQ_CONTACT_EMAIL}</a> for a custom quote. · </>}
            <ComparePlansLink />
          </p>
        </StartFoot>
      </div>
    </div>
  );
}

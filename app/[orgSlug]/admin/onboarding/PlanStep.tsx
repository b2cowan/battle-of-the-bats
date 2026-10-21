'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import StartSteps from '@/components/auth/StartSteps';
import { StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import ChoicePair from '@/components/shared/ChoicePair';
import { PLAN_CONFIG, formatPriceAmount, formatAnnualSavings, formatPlanPeriodPrice, pickedPlanLabel, showsFoundingZero, FOUNDING_SEASON_END_LABEL } from '@/lib/plan-config';
import { RUN_A_TOURNAMENT_STEPS, runATournamentPick, type StartBilling, type StartPricing } from '@/lib/start-door';
import type { OrgPlan } from '@/lib/types';
import styles from './PlanStep.module.css';

/**
 * THE PLAN STEP (The first look, Stage 3a — Ask 4, F07, F08; gate G3–G5 ruled 2026-10-20, drawn at
 * https://claude.ai/artifact/CtzAZMhmvnJZQxMTtn5xjj). Step 3 of Run a tournament: one heading, said once, and the two
 * plans this door sells — Tournament Plus and Tournament — three differences each. League Plus and Club are not here
 * (F08: this door cannot sell them; the guard in tests/unit/first-look-stage3.test.ts keeps their buttons off it).
 *
 * The pricing page's pick comes first, preselected (the olive edge) and holds the one lime; the other is the white
 * secondary. With no pick Tournament Plus comes first. A pick is only a preselection, never a price: the $0 is the one
 * shared rule (`showsFoundingZero`, the checkout's), and every figure comes from plan-config.
 *
 * Its own small component rather than the marketing cards (`PricingSection`), so nothing on the pricing page or the
 * home can change by accident; the change-plan window keeps the full cards. It sits in the admin's bare first-run frame
 * (G3), on the warm paper, and follows Warm / Dark like the start column it continues.
 */

/** The plans this step offers, and the only picks it names. */
type PlanStepChoice = 'tournament_plus' | 'tournament';

const PLUS_POINTS = ['Teams register themselves on your site', 'Fees, check-in and volunteers', 'Schedule generators, your branding, repeat events'];
const FREE = PLAN_CONFIG.tournament;
const FREE_POINTS = [
  'You add every team; each coach claims it by email',
  'Schedule, results and live scores',
  `${FREE.tournamentLimit} tournament at a time · ${FREE.seatLimit} staff seats`,
];

export default function PlanStep({ orgName, pricing, foundingOfferHeld, loading, error, onChoose }: {
  orgName: string;
  /** The pricing page's pick (A6, G4). A pick this step does not offer reads as none. */
  pricing: StartPricing | null;
  /** The server's answer for the offer after the sign-up window closes (`foundingSeasonOfferOnPlanChoice`). */
  foundingOfferHeld: boolean;
  /** The plan whose start is under way (the page's own plan-loading state). */
  loading: OrgPlan | null;
  error: string;
  onChoose: (plan: PlanStepChoice, billing: StartBilling) => void;
}) {
  const pick = runATournamentPick(pricing);
  const first: PlanStepChoice = pick?.plan === 'tournament' ? 'tournament' : 'tournament_plus';
  const [billing, setBilling] = useState<StartBilling>(pick?.billing ?? 'monthly');
  const busy = loading !== null;

  const zero = showsFoundingZero('tournament_plus', foundingOfferHeld);
  const monthly = formatPlanPeriodPrice('tournament_plus', 'monthly');
  const annual = formatPlanPeriodPrice('tournament_plus', 'annual');
  // G5: with the offer the price is $0 and the choice says what follows ("Then …"); without it the price follows the
  // choice, and annual carries the pricing page's own savings line.
  const plusPrice = zero ? '$0' : billing === 'annual' ? annual : monthly;
  const plusNote = zero
    ? `through ${FOUNDING_SEASON_END_LABEL} · normally ${monthly}`
    : billing === 'annual' ? formatAnnualSavings('tournament_plus') : null;
  const billingOptions = [
    { value: 'monthly', label: zero ? `Then ${monthly}` : monthly },
    { value: 'annual', label: zero ? `Then ${annual}` : annual },
  ] as const;

  function startButton(plan: PlanStepChoice, label: string) {
    return (
      <button
        type="button"
        className={`${plan === first ? accountForm.primary : accountForm.secondary} ${styles.start}`}
        onClick={() => onChoose(plan, billing)}
        disabled={busy}
        aria-busy={loading === plan || undefined}
      >
        {loading === plan ? 'Starting…' : label}
      </button>
    );
  }

  const plusCard = (
    <section className={first === 'tournament_plus' ? styles.cardOn : styles.card} aria-labelledby="plan-step-plus">
      {zero && <p className={styles.tag}>Founding Season</p>}
      <div className={styles.cardHead}>
        <h2 id="plan-step-plus" className={styles.name}>Tournament Plus</h2>
        <span className={styles.price}>{plusPrice}</span>
      </div>
      {plusNote && <p className={styles.note}>{plusNote}</p>}
      <ul className={styles.points}>{PLUS_POINTS.map(p => <li key={p}>{p}</li>)}</ul>
      <span className={`${accountForm.label} ${styles.billingLabel}`} id="plan-step-billing">Billing</span>
      <ChoicePair labelledBy="plan-step-billing" value={billing} options={billingOptions} onChange={setBilling} disabled={busy} />
      {startButton('tournament_plus', 'Start with Tournament Plus')}
    </section>
  );
  const freeCard = (
    <section className={first === 'tournament' ? styles.cardOn : styles.card} aria-labelledby="plan-step-free">
      <div className={styles.cardHead}>
        <h2 id="plan-step-free" className={styles.name}>Tournament</h2>
        <span className={styles.price}>{formatPriceAmount(FREE.monthlyPrice)}</span>
      </div>
      <p className={styles.note}>no time limit</p>
      <ul className={styles.points}>{FREE_POINTS.map(p => <li key={p}>{p}</li>)}</ul>
      {startButton('tournament', 'Start free with Tournament')}
    </section>
  );

  return (
    <div className={`${accountForm.page} ${styles.page}`}>
      <div className={styles.column}>
        <StartHead
          title="How do you want to start?"
          sub={(
            <span className={styles.sub}>
              {pick
                ? <>You picked <strong>{pickedPlanLabel(pick.plan, pick.billing)}</strong> on the pricing page. You can change it here, or any time in Plan &amp; billing.</>
                : <>{orgName} starts on one of these. You can change it any time in Plan &amp; billing.</>}
            </span>
          )}
          steps={<StartSteps current={3} labels={RUN_A_TOURNAMENT_STEPS} />}
        />
        <div className={styles.choices}>{first === 'tournament' ? <>{freeCard}{plusCard}</> : <>{plusCard}{freeCard}</>}</div>
        {error && <p className={`${accountForm.error} ${styles.error}`} role="alert">{error}</p>}
        <StartFoot>
          <a href="/pricing" target="_blank" rel="noopener noreferrer" className={accountForm.footLink}>
            Compare every plan <ExternalLink size={14} strokeWidth={2} aria-hidden className={styles.external} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </StartFoot>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import KitDialog from '@/components/shared/KitDialog';
import LoadingState from '@/components/shared/LoadingState';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { PLAN_CONFIG, type BillingCycle } from '@/lib/plan-config';
import { planTermsTrial, planTrialLine } from '@/lib/plan-trial-line';
import type { OrgPlan } from '@/lib/types';
import { BILLING_ADDRESS_FORM_WORDS as F } from '@/lib/billing-location';
import styles from './Billing.module.css';
import address from './BillingAddress.module.css';
import PlanTermsLine from '@/components/legal/PlanTermsLine';

type TrialRead = { status: 'loading' } | { status: 'ready'; trialDays: number | null; returning: boolean | null };

/**
 * The organization's TRUE trial for this plan (On-sale pages S4, call 38; trap B): the server's answer — the plan's trial, or
 * none for a customer that has had a subscription before — read-only, never making a Stripe customer. A failed read is
 * "unknown", and the window falls back to the Terms line's "if your plan starts with a trial".
 */
function usePlanTrial(orgSlug: string, plan: OrgPlan): TrialRead {
  const [read, setRead] = useState<TrialRead>({ status: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/billing/start-plan?orgSlug=${encodeURIComponent(orgSlug)}&plan=${encodeURIComponent(plan)}`, { cache: 'no-store', signal: abort.signal })
      .then(async res => {
        if (!res.ok) throw new Error('trial read failed');
        const data = await res.json() as { trial?: { trialDays: number | null; returning: boolean | null } };
        if (!abort.signal.aborted) setRead({ status: 'ready', trialDays: data.trial?.trialDays ?? null, returning: data.trial?.returning ?? null });
      })
      .catch(() => { if (!abort.signal.aborted) setRead({ status: 'ready', trialDays: null, returning: null }); });
    return () => abort.abort();
  }, [orgSlug, plan]);
  return read;
}

/** The payment step of every start by checkout: Monthly or Yearly, side by side with both prices, chosen where the money is
 *  committed — from Plan & billing's table and from the plan panel over any page (On-sale pages S4, call 38).
 *  GST/HST Stage 1: it opens only once a billing address is on file, and names it on one "Billed to … Change" line above
 *  the choices (the line Stage 2 hangs the tax on); Change swaps this window for the Billing address window. */
export default function PlanCycleDialog({ orgSlug, planKey, savings, initial, billedTo = null, onChangeAddress, onClose, onContinue }: {
  orgSlug: string; planKey: OrgPlan; savings: string | null; initial: BillingCycle;
  billedTo?: string | null; onChangeAddress?: () => void;
  onClose: () => void; onContinue: (cycle: BillingCycle) => void;
}) {
  const config = PLAN_CONFIG[planKey];
  const [pick, setPick] = useState<BillingCycle>(initial);
  const trial = usePlanTrial(orgSlug, planKey);
  const options = [
    { id: 'monthly' as const, name: W.plan.monthly, price: config.monthlyPrice, help: W.pay.monthlyHelp },
    { id: 'annual' as const, name: W.plan.annual, price: config.annualPrice, help: savings ?? W.pay.annualHelp },
  ];
  const trialDays = trial.status === 'ready' ? trial.trialDays : null;
  return (
    <KitDialog kind="question" title={W.pay.title(config.label)} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onClose}>{W.pay.cancel}</button>
        {/* Held for the trial read (about a second): the window never sends a buyer on before it has said what they get. */}
        <button type="button" className="btn btn-lime" onClick={() => onContinue(pick)} disabled={trial.status === 'loading'} data-autofocus="">{W.pay.continue}</button>
      </>}
    >
      {billedTo && <p className={address.billedTo}>
        <span>{F.billedTo(billedTo)}</span>
        {onChangeAddress && <button type="button" className={address.change} onClick={onChangeAddress}>{F.change}</button>}
      </p>}
      <div className={styles.payChoices} role="radiogroup" aria-label={W.pay.cycleLabel}>
        {options.map(option => (
          <label key={option.id} className={`${styles.payChoice}${pick === option.id ? ` ${styles.payChoiceOn}` : ''}`}>
            <span className={styles.payHead}>
              <input type="radio" name="billing-cycle" value={option.id} checked={pick === option.id} onChange={() => setPick(option.id)} />
              <span className={styles.payName}>{option.name}</span>
            </span>
            <span className={styles.payPrice}>{W.plan.price(option.price, option.id)}</span>
            {/* GST/HST Stage 2 Part 4 (drawing tab 5): the tax itself shows on Stripe's page, so each price says so. */}
            {option.price > 0 && <span className={styles.hint}>{W.move.plusTax}</span>}
            <span className={styles.hint}>{option.id === 'annual' && savings ? `${savings}. ${W.pay.annualHelp}` : option.help}</span>
          </label>
        ))}
      </div>
      {/* The true trial (drawing tab 3): its length, or "no second trial" for a buyer who has paid before; nothing while read. */}
      {trial.status === 'loading' ? <LoadingState inline label={W.pay.trialLoading} />
        : trialDays !== null && trialDays > 0 ? <p>{planTrialLine(trialDays)}</p>
        : trialDays === 0 && trial.status === 'ready' && trial.returning === true ? <p>{W.clubUpgrade.noTrial}</p>
        : null}
      {/* §20 (3) ends the body: Continue is the button that leads to Stripe's checkout (step 6.3, drawing tab 5's window rule). */}
      {trial.status === 'ready' && (config.monthlyPrice > 0 || config.annualPrice > 0) && <PlanTermsLine trial={planTermsTrial(trialDays, config.trialDays)} />}
    </KitDialog>
  );
}

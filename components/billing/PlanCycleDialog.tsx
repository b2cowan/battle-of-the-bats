'use client';

import { useState } from 'react';
import KitDialog from '@/components/shared/KitDialog';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import type { BillingCycle } from '@/lib/plan-config';
import { BILLING_ADDRESS_FORM_WORDS as F } from '@/lib/billing-location';
import styles from './Billing.module.css';
import address from './BillingAddress.module.css';
import PlanTermsLine from '@/components/legal/PlanTermsLine';

/** The payment step of an Upgrade: Monthly or Yearly, side by side with both prices, chosen where the money is committed.
 *  GST/HST Stage 1: it opens only once a billing address is on file, and names it on one "Billed to … Change" line above
 *  the choices (the line Stage 2 hangs the tax on); Change swaps this window for the Billing address window. */
export default function PlanCycleDialog({ label, monthlyPrice, annualPrice, trialDays = 0, savings, initial, billedTo = null, onChangeAddress, free = false, onClose, onContinue }: {
  label: string; monthlyPrice: number; annualPrice: number; savings: string | null; initial: BillingCycle;
  /** The plan's own trial days: checkout gives a trial to a first subscription only, so the line says "if" (§20 (3)). */
  trialDays?: number;
  billedTo?: string | null; onChangeAddress?: () => void;
  /** A comped Founding Season choice: the server applies it free, so no paid-plan line (§20 note 3). */
  free?: boolean;
  onClose: () => void; onContinue: (cycle: BillingCycle) => void;
}) {
  const [pick, setPick] = useState<BillingCycle>(initial);
  const options = [
    { id: 'monthly' as const, name: W.plan.monthly, price: monthlyPrice, help: W.pay.monthlyHelp },
    { id: 'annual' as const, name: W.plan.annual, price: annualPrice, help: savings ?? W.pay.annualHelp },
  ];
  return (
    <KitDialog kind="question" title={W.pay.title(label)} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onClose}>{W.pay.cancel}</button>
        <button type="button" className="btn btn-lime" onClick={() => onContinue(pick)} data-autofocus="">{W.pay.continue}</button>
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
      {/* §20 (3) ends the body: Continue is the button that leads to Stripe's checkout (step 6.3, drawing tab 5's window rule). */}
      {!free && (monthlyPrice > 0 || annualPrice > 0) && <PlanTermsLine trial={trialDays} />}
    </KitDialog>
  );
}

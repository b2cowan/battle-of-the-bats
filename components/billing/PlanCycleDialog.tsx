'use client';

import { useState } from 'react';
import KitDialog from '@/components/shared/KitDialog';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import type { BillingCycle } from '@/lib/plan-config';
import styles from './Billing.module.css';

/** The payment step of an Upgrade: Monthly or Yearly, side by side with both prices, chosen where the money is committed. */
export default function PlanCycleDialog({ label, monthlyPrice, annualPrice, savings, initial, onClose, onContinue }: {
  label: string; monthlyPrice: number; annualPrice: number; savings: string | null; initial: BillingCycle;
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
      <div className={styles.payChoices} role="radiogroup" aria-label={W.pay.cycleLabel}>
        {options.map(option => (
          <label key={option.id} className={`${styles.payChoice}${pick === option.id ? ` ${styles.payChoiceOn}` : ''}`}>
            <span className={styles.payHead}>
              <input type="radio" name="billing-cycle" value={option.id} checked={pick === option.id} onChange={() => setPick(option.id)} />
              <span className={styles.payName}>{option.name}</span>
            </span>
            <span className={styles.payPrice}>{W.plan.price(option.price, option.id)}</span>
            <span className={styles.hint}>{option.id === 'annual' && savings ? `${savings}. ${W.pay.annualHelp}` : option.help}</span>
          </label>
        ))}
      </div>
    </KitDialog>
  );
}

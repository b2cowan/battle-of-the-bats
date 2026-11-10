'use client';
import { useEffect, type FormEvent } from 'react';
import StartSteps from '@/components/auth/StartSteps';
import { StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import BillingAddressFields, { type AddressDraftState } from '@/components/billing/BillingAddressFields';
import { BILLING_ADDRESS_FORM_WORDS as F, BILLING_LOCATION_WORDS } from '@/lib/billing-location';
import { PLAN_CONFIG, formatPlanPeriodPrice } from '@/lib/plan-config';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import { RUN_A_TOURNAMENT_STEPS, type StartBilling } from '@/lib/start-door';
import type { OrgPlan } from '@/lib/types';
import styles from './PlanStep.module.css';
import PlanTermsLine from '@/components/legal/PlanTermsLine';

/**
 * THE BILLING ADDRESS SCREEN of first-time setup (GST/HST Stage 1, owner rulings 2026-11-04 on
 * PLAN_STEP_ADDRESS_DRAWINGS.html: Ask 1 A, Ask 2 C, Ask 3 A). A paid pick on the plan step with no address on file
 * lands here instead of opening the Billing address window over the page: this page is already a short walk through
 * numbered steps, and the coach sign-up asks the same six questions as a step of its own.
 *
 *   · The second half of step 3, so the step line stays "Account · Organization · Plan" with Plan current (Ask 2 C):
 *     the shipped three-label line already fills a 390px phone, and a free-plan owner never meets a fourth step.
 *   · The six fields are the coach sign-up's (`variant="start"`: 48 high, white), the words the window's, so the two
 *     doors read as one. The column is the one 420px start column (plan rule 1).
 *   · Six required fields push the button below the fold on a 390 × 844 phone and a 1366 × 768 laptop; the rule gives
 *     way here, as it does on the coach sign-up's Address step (Ask 3 A).
 *   · The draft lives in the page, not here, so Back keeps what was typed.
 *   · A US address while US sales are closed shows the amber line under Country and no button (the sign-up page's rule).
 */
export default function AddressStep({ orgName, plan, billing, form, saving, failed, error, onContinue, onBack }: {
  orgName: string;
  /** The paid plan being bought and its billing period: named under the heading, so the owner knows what this is for. */
  plan: OrgPlan;
  billing: StartBilling;
  form: AddressDraftState;
  /** The save is under way, then the checkout is starting: the button reads "Saving…" and cannot be pressed twice. */
  saving: boolean;
  /** The save itself failed (not a field error): one red sentence above the button; everything typed stays. */
  failed: boolean;
  /** A failure from the checkout that follows the save (the page's plan error). */
  error: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  // The plan step's buttons sit at the foot of a tall page: land at the top of this one, not partway down it.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onContinue();
  }

  const message = failed ? BILLING_LOCATION_WORDS.saveFailed : error;

  return (
    <div className={`${accountForm.page} ${styles.page}`}>
      <div className={accountForm.column}>
        <StartHead
          title={F.title}
          sub={`${orgName} · ${PLAN_CONFIG[plan].label}, ${formatPlanPeriodPrice(plan, billing)}${PLAN_CONFIG[plan].monthlyPrice > 0 ? ` ${BILLING_TAX_WORDS.plusTax}` : ''}`}
          steps={<StartSteps current={3} labels={RUN_A_TOURNAMENT_STEPS} />}
        />
        <form className={accountForm.form} onSubmit={submit}>
          <p className={accountForm.hint}>{F.intro}</p>
          <BillingAddressFields form={form} idPrefix="setup-address" subject={{ kind: 'club', name: orgName }} variant="start" disabled={saving} />
          {message && <p className={accountForm.error} role="alert">{message}</p>}
          {/* §20 (3) above Continue to checkout, at the column's fine-print size (step 6.3, drawing tab 5, pin 4). */}
          {!form.usClosed && PLAN_CONFIG[plan].monthlyPrice > 0 && <PlanTermsLine place="column" trial={PLAN_CONFIG[plan].trialDays} />}
          {!form.usClosed && (
            <button type="submit" className={accountForm.primary} disabled={saving} aria-busy={saving || undefined}>
              {saving ? F.saving : 'Continue to checkout'}
            </button>
          )}
        </form>
        <StartFoot>
          <p>
            <button type="button" className={accountForm.footLink} onClick={onBack} disabled={saving}>Back</button>
          </p>
        </StartFoot>
      </div>
    </div>
  );
}

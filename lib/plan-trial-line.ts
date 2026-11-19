import { PLAN_CONFIG } from './plan-config';
import { BILLING_TAX_WORDS } from './billing-tax';

/**
 * The Club trial sentence — ONE sentence, verbatim, on the Club pricing card, the billing page and
 * checkout (BUSINESS_DECISIONS.md 2026-09-25, "The 90-day Club trial collects a card at checkout";
 * canon in PRICING_PAGE_COPY.md). It says "a payment method", not "a card" (T1, owner: checkout collects a payment method
 * and is not changed to force cards; Plan & billing Stage 5 Part B, 2026-11-16). Never reword it per surface: the defect it replaced was a pricing
 * card promising "No credit card required" while checkout asked for one.
 *
 * Pass the trial length checkout will actually use where you have it (`getPlanConfigOverride()`
 * — a platform admin can override `trial_days`); the default is the code value the public pricing
 * card reads. Show it only where a trial applies: a paying org moving to Club gets no second trial.
 * No "free" in it — Club carries no "free until" framing (2026-09-25, Club has no Founding offer).
 */
export function clubTrialLine(trialDays: number = PLAN_CONFIG.club.trialDays): string {
  return planTrialLine(trialDays);
}

/**
 * THE trial sentence, plan-neutral (on-sale pages S1, owner rulings 2026-11-18): Club and Club · Association, League
 * Plus (Ask 7) and Tournament Plus (Ask 31) all say the same sentence with their own length. The tax sits inside it
 * (Ask 8 (b): the first charge is where tax first appears), with the tax line still under each price. Same rules as
 * `clubTrialLine`: pass the length checkout will use, never a typed number; show it only where a trial applies.
 */
export function planTrialLine(trialDays: number): string {
  return `${trialDays}-day trial — you add a payment method at checkout, and you’re first charged, ${BILLING_TAX_WORDS.plusTax}, when the trial ends.`;
}

/**
 * What the Terms line above a paid button says of the trial (`PlanTermsLine`'s `trial`), from a paid door's TRUE trial
 * (the server's, trap B): above 0 this purchase starts one (`'known'`); 0 says nothing of a trial; unread or absent falls
 * back to the plan's own length, where checkout decides ("If your plan starts with a trial…").
 */
export function planTermsTrial(trialDays: number | null | undefined, planOwnTrialDays: number): 'known' | number {
  return trialDays == null ? planOwnTrialDays : trialDays > 0 ? 'known' : 0;
}

# Free time catches an ending paid plan (On-sale pages S4 Part 3, call 40 option A)
**Last verified:** 2026-11-21
**Re-verify by:** the first live paid plan that ends while free time runs; an edit to the monthly estimate; free time ever given a price
**Depends on facts:** GST/HST registered, prices tax-exclusive (ACCOUNTING_FACTS.md); free time is staff-given with no price (PLAN_PRICING_FACTS.md "Operator free time")

## Question(s) this answers
- When a paid plan ends while staff-given free time still runs and the club falls back to the free plan instead of closing, what is invoiced, refunded or credited?
- Any tax, invoice, credit-note, revenue-report or Bookkeeping consequence?

## Finding
- **Nothing new is invoiced, refunded or credited by the fall-back.** The paid plan ends exactly as before: a cancel at period end runs to the end of the period paid for (no refund, no proration); Stripe giving up on a card leaves the failed invoice unpaid as today (an uncollectible invoice is a bad-debt expense, not a sales reduction — REVENUE_REPORT_DEFINITIONS.md); staff End now refunds nothing by itself, and a refund of the unused part, when it is not the club's doing, is the existing Money-tab part-refund with a credit note (REFUND_UNUSED_PLAN_TIME.md, CREDIT_NOTES_ON_REFUNDS.md) — unchanged by Part 3.
- **Free time after the fall-back is a no-consideration supply:** no invoice, no receipt, no GST/HST, no revenue line — the same as free time before a purchase. The club's stored plan becomes the $0 Tournament plan, so the platform-admin monthly estimate (list price of every active organization's stored plan) adds $0 for it — correct (before Part 3 an ended club was stored cancelled and excluded; either way $0).
- **The event is one `subscription_canceled` (churn), marked `fellBackToFreeTime`.** A churn event is a reporting count, not a sales or tax record; Sales by month reads invoices and credit notes, not events. No effect on the return.
- **A later purchase** by the fallen-back club is an ordinary new subscription with its own taxed invoice; it is not a comeback (no restore event, no welcome-back email) and gets no second trial (Stripe history decides).

## Recommendation
Nothing to change in Bookkeeping, invoices, credit notes or the return. Nothing for the accountant list from this change alone.

## Sources
- Internal: lib/plan-ending.ts `applyFallBack` (no Stripe money call), lib/plan-ending-server.ts `setPlan`; REVENUE_REPORT_DEFINITIONS.md; REFUND_UNUSED_PLAN_TIME.md; FOUNDING_REMOVAL_2B_REVIEW.md (the monthly estimate) — read 2026-11-21

## Professional sign-off needed?
No.
